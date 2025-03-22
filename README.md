# AI Symptom Analyzer - Prototype

This is a web-based AI-powered medical symptom triage tool designed to provide users with preliminary diagnostic insights based on their symptoms. It uses the Mistral AI model for diagnosis and integrates Mayo Clinic data for detailed condition information. The project is built with Flask (Python) for the backend prototype and JavaScript for the frontend, running in a Docker container.

**Note**: This tool is not a substitute for professional medical advice. Always consult a healthcare professional for accurate diagnosis and treatment.

## Features
- **Symptom-Based Diagnosis**: Users input age, sex, medical history, symptoms, and additional info to receive ranked possible diagnoses with likelihoods, urgency indicators, consultation advice, and home care suggestions.
- **Mayo Clinic Integration**: Fetches detailed condition information from Mayo Clinic via DuckDuckGo search (scoped to `https://www.mayoclinic.org/diseases-conditions`) and Mistral AI.
- **Responsive UI**: Chat-style interface with auto-scrolling and result categorization (green/yellow/red).

## Tech Stack
- **Backend**: Flask, Gunicorn, Python 3.9
- **Frontend**: HTML, CSS, JavaScript (Bootstrap 5)
- **AI**: Mistral API (`mistral-large-latest`)
- **Search**: DuckDuckGo API (`duckduckgo_search`)
- **Containerization**: Docker, Docker Compose
- **Dependencies**: Managed via `requirements.txt`

## Project Structure
```
main/
├── app.py               # Flask application with API endpoints
├── Dockerfile           # Docker configuration for building the app
├── requirements.txt     # Python dependencies
├── scripts.js           # Frontend JavaScript logic
├── index.html           # Main page
└── styles.css           # Custom CSS
```

## Setup Instructions

### Prerequisites
- Docker and Docker Compose installed
- A Mistral API key (obtain from Mistral AI)

### Steps
1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd <repository-name>/main
   ```

2. **Set Environment Variables**:
   Update `docker-compose.yml` with your Mistral API key:
   ```yaml
   environment:
     - FLASK_ENV=production
     - MISTRAL_API_KEY=your-mistral-api-key
   ```
   Replace `your-mistral-api-key` with your actual Mistral API key.

3. **Build and Run with Docker Compose**:
   ```bash
   docker-compose up -d --build
   ```
   - Builds the Docker image and starts the container.
   - The app will be available at `http://localhost:5000`.

4. **Verify the App**:
   - Check logs: `docker-compose logs app`
   - Visit `http://localhost:5000` in a browser.

5. **Stop the App**:
   ```bash
   docker-compose down
   ```

## API Endpoints
- **POST /diagnose**: Analyzes symptoms and returns diagnoses.
- **POST /mayo-clinic-details**: Fetches detailed info for a diagnosis.
- **GET /health**: Checks API key configuration status.
- **Static Routes**: `/`, `/scripts.js`, `/styles.css`, `/images/*`

## Troubleshooting
- **503 Service Unavailable**: Verify `MISTRAL_API_KEY` is set in `docker-compose.yml`.
- **Port Conflict**: If port 5000 is in use, adjust `ports` in `docker-compose.yml` (e.g., `"5001:5000"`).

## Deployment
- Deploy with a reverse proxy (e.g., Nginx) and HTTPS for production use.
- Ensure the Mistral API key is securely managed in the production environment.

## License
This project is for educational purposes and not licensed for commercial use without modification and proper legal compliance.