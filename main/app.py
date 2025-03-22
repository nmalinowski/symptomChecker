from functools import lru_cache
import requests
import json
import os
import logging
from flask import Flask, request, jsonify, send_from_directory
from tenacity import retry, wait_exponential, stop_after_attempt
from duckduckgo_search import DDGS
from duckduckgo_search.exceptions import RatelimitException

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MISTRAL_API_KEY = os.getenv('MISTRAL_API_KEY')
MISTRAL_MODEL = "mistral-large-latest"

app = Flask(__name__, static_folder='.', static_url_path='')

@app.after_request
def add_noindex_header(response):
    response.headers['X-Robots-Tag'] = 'noindex'
    return response 

def create_prompt(user_data):
    prompt = "You are an expert medical diagnostic AI. Provide a JSON response with ranked possible diagnoses, their likelihood (%), explanation, urgency (true/false), consultation advice, and home care suggestions based on this data:\n"
    for key, value in user_data.items():
        prompt += f"{key.capitalize()}: {value}\n"
    prompt += "\nReturn JSON with fields: conditions (list of {name, likelihood, explanation}), urgent (bool), consult (str), homecare (str)."
    return prompt

def query_mistral(prompt):
    headers = {
        "Authorization": f"Bearer {MISTRAL_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": MISTRAL_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"},
        "temperature": 0.15
    }
    response = requests.post("https://api.mistral.ai/v1/chat/completions", headers=headers, json=data)
    response.raise_for_status()
    return response.json()

def process_response(response):
    content = response["choices"][0]["message"]["content"]
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None

def get_diagnoses(response):
    if response and "conditions" in response:
        return [{"name": c["name"], "likelihood": c["likelihood"], "explanation": c.get("explanation", "")} for c in response["conditions"]]
    return []

def get_highest_ranked_diagnosis(results):
    if not results:
        return "No diagnosis available"
    top_diagnosis = max(results, key=lambda x: x["likelihood"])
    if len(results) >= 3:
        top_three = sorted(results, key=lambda x: x["likelihood"], reverse=True)[:3]
        diagnoses_str = ', '.join(f"{d['name']} ({d['likelihood']}%)" for d in top_three)
        return f"Top 3 possible diagnoses: {diagnoses_str}"
    return f"{top_diagnosis['name']} ({top_diagnosis['likelihood']}%)"

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/scripts.js')
def serve_scripts():
    return send_from_directory('.', 'scripts.js')

@app.route('/styles.css')
def serve_css():
    return send_from_directory('.', 'styles.css')

@app.route('/images/<path:filename>')
def serve_image(filename):
    return send_from_directory('images', filename)

@app.route('/diagnose', methods=['POST'])
def diagnose():
    try:
        user_data = request.json
        prompt = create_prompt(user_data)
        results = []
        queried_models = []
        skipped_models = []
        
        if MISTRAL_API_KEY:
            mistral_response = process_response(query_mistral(prompt))
            if mistral_response:
                mistral_diagnoses = get_diagnoses(mistral_response)
                results.extend(mistral_diagnoses)
                queried_models.append("Mistral")
            else:
                skipped_models.append("Mistral (API error)")
        else:
            skipped_models.append("Mistral (no API key)")
        
        if not queried_models:
            return jsonify({"error": "No AI models were available to process your request. Please check API configurations.", "skipped_models": skipped_models}), 503
        
        final_diagnosis = get_highest_ranked_diagnosis(results)
        response = {
            "diagnosis": final_diagnosis,
            "conditions": mistral_response["conditions"],
            "urgent": mistral_response["urgent"],
            "consult": mistral_response["consult"],
            "homecare": mistral_response["homecare"],
            "disclaimer": "This is not medical advice. Please consult a healthcare professional for accurate diagnosis and treatment.",
            "queried_models": queried_models,
            "skipped_models": skipped_models
        }
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error in diagnose endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

@lru_cache(maxsize=128)
@retry(wait=wait_exponential(multiplier=1, min=4, max=10), stop=stop_after_attempt(3))
def search_mayo_clinic(query):
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(f"site:https://www.mayoclinic.org/diseases-conditions {query}", max_results=1))
            if results:
                return results[0]["href"]
            return "No Mayo Clinic link found."
    except RatelimitException:
        logger.warning("DuckDuckGo rate limit hit, retrying...")
        raise
    except Exception as e:
        logger.error(f"Error searching Mayo Clinic: {str(e)}")
        return "Error retrieving Mayo Clinic link."

def query_mayo_clinic_details(diagnosis):
    headers = {
        "Authorization": f"Bearer {MISTRAL_API_KEY}",
        "Content-Type": "application/json"
    }
    prompt = f"""Provide a JSON object with detailed information about "{diagnosis}" using data from Mayo Clinic or general medical knowledge if specific Mayo Clinic data is unavailable. Include these fields:
    - Overview (str)
    - Symptoms (list or str)
    - When to see a doctor (str)
    - Causes (str)
    - Risk factors (list or str)
    - Complications (str)
    - Prevention (str)
    Return only the JSON object, no additional text."""
    data = {
        "model": MISTRAL_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "response_format": {"type": "json_object"}
    }
    response = requests.post("https://api.mistral.ai/v1/chat/completions", headers=headers, json=data)
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]

@app.route('/mayo-clinic-details', methods=['POST'])
def mayo_clinic_details():
    try:
        data = request.json
        diagnosis = data.get("diagnosis")
        if not diagnosis:
            return jsonify({"error": "Diagnosis is required"}), 400
        
        queried_models = []
        skipped_models = []
        
        if MISTRAL_API_KEY:
            details = json.loads(query_mayo_clinic_details(diagnosis))
            queried_models.append("Mistral")
        else:
            details = None
            skipped_models.append("Mistral (no API key)")
        
        if not queried_models:
            return jsonify({"error": "No AI models available", "skipped_models": skipped_models}), 503
        
        mayo_link = search_mayo_clinic(diagnosis)
        response = {
            "diagnosis": diagnosis,
            "mayo_clinic_details": details if details else "No details available",
            "source": mayo_link,
            "queried_models": queried_models,
            "skipped_models": skipped_models
        }
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error in mayo-clinic-details endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/health')
def health():
    missing_keys = []
    available_models = []
    
    if not MISTRAL_API_KEY:
        missing_keys.append("MISTRAL_API_KEY")
    else:
        available_models.append("MISTRAL_API_KEY")
    
    if missing_keys:
        return jsonify({
            "status": "error",
            "message": "Service cannot function - no API key configured",
            "missing_keys": missing_keys
        }), 503
    
    return jsonify({
        "status": "healthy",
        "message": "Service is up and running with Mistral API key configured",
        "available_models": available_models
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)