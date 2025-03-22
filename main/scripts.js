const chatContainer = document.getElementById("chatContainer");
const inputArea = document.getElementById("inputArea");
const currentInput = document.getElementById("currentInput");
const loading = document.getElementById("loading");
const results = document.getElementById("results");
const diagnosisResult = document.getElementById("diagnosisResult");
const urgentResult = document.getElementById("urgentResult");
const consultResult = document.getElementById("consultResult");
const homecareResult = document.getElementById("homecareResult");
const mayoClinicResult = document.getElementById("mayoClinicResult");
const editBtn = document.getElementById("editBtn");

const questions = [
  {
    text: `Hello! I’m here to help you understand your symptoms. To assist you properly, I’ll need some basic information about you and your condition.\n\nWhen you’re ready, start by telling me your Age.`,
    input: '<input type="number" class="form-control" id="age" name="age" required placeholder="Enter your age">',
  },
  {
    text: 'What’s your biological sex? <span class="info-icon" data-bs-toggle="tooltip" data-bs-placement="right" title="While society recognizes gender as fluid, biological sex is a key diagnostic factor. An accurate selection improves diagnosis accuracy.">ⓘ</span>',
    input: '<select class="form-select" id="sex" name="sex" required><option value="">Select sex</option><option value="Male">Male</option><option value="Female">Female</option></select>',
  },
  {
    text: "Do you have any medical history (conditions, allergies, medications, surgeries)?",
    input: '<textarea class="form-control" id="medicalHistory" name="medical_history" rows="3" placeholder="e.g., Asthma, penicillin allergy"></textarea>',
  },
  {
    text: "What symptoms are you experiencing? Please include onset, severity, duration, and patterns.",
    input: '<textarea class="form-control" id="symptoms" name="symptoms" rows="3" required placeholder="e.g., Fever for 3 days, severe cough"></textarea>',
  },
  {
    text: "Anything else to add (lifestyle, smoking, alcohol use, stress, travel, family history)?",
    input: '<textarea class="form-control" id="otherInfo" name="other_info" rows="3" placeholder="e.g., Non-smoker, recent stress"></textarea>',
  },
];

let currentQuestionIndex = 0;
const userResponses = {};
let chatActivated = false;

function addMessage(text, isUser = false) {
  const message = document.createElement("div");
  message.classList.add("chat-message", isUser ? "user-message" : "ai-message");
  if (!isUser) {
    const typingSpan = document.createElement("span");
    typingSpan.classList.add("typing");
    if (text.includes("<") && text.includes(">")) {
      typingSpan.innerHTML = text;
    } else {
      const lines = text.split("\n").map((line) => {
        const span = document.createElement("span");
        span.textContent = line;
        span.style.display = "block";
        return span;
      });
      lines.forEach((line) => typingSpan.appendChild(line));
    }
    message.appendChild(typingSpan);
  } else {
    message.textContent = text;
  }
  chatContainer.appendChild(message);
  if (chatActivated) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  } else {
    chatContainer.scrollTop = 0;
  }

  const tooltipTriggerList = message.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltipTriggerList.forEach((el) => new bootstrap.Tooltip(el));
}

function showQuestion() {
  if (currentQuestionIndex >= questions.length) {
    submitDiagnosis();
    return;
  }
  const question = questions[currentQuestionIndex];
  addMessage(question.text);
  currentInput.innerHTML = `
    ${question.input}
    <button type="button" class="btn btn-primary" id="submitBtn">${currentQuestionIndex === questions.length - 1 ? "Get Diagnosis" : "Send"}</button>
  `;
  const inputElement = currentInput.querySelector("input, select, textarea");
  inputElement.focus();
  const submitBtn = currentInput.querySelector("#submitBtn");
  submitBtn.addEventListener("click", handleSubmit);

  inputElement.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  });

  const tooltipTriggerList = currentInput.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltipTriggerList.forEach((el) => new bootstrap.Tooltip(el));
}

function handleSubmit() {
  const inputElement = currentInput.querySelector("input, select, textarea");
  const value = inputElement.value.trim();
  const isRequired = inputElement.hasAttribute("required");

  if (isRequired && !value) {
    inputElement.classList.add("is-invalid");
    return;
  }
  inputElement.classList.remove("is-invalid");

  const fieldName = inputElement.name;
  userResponses[fieldName] = value;
  addMessage(value, true);
  chatActivated = true;
  currentInput.innerHTML = "";
  currentQuestionIndex++;
  setTimeout(showQuestion, 800);
}

async function submitDiagnosis() {
  loading.style.display = "block";
  chatContainer.style.display = "none";
  inputArea.style.display = "none";
  results.style.display = "none";

  try {
    const diagnoseResponse = await fetch("/diagnose", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify(userResponses),
    });
    const diagnoseData = await diagnoseResponse.json();

    let topDiagnosis = diagnoseData.diagnosis;
    if (topDiagnosis.startsWith("Top 3 possible diagnoses:")) {
      topDiagnosis = topDiagnosis.split(":")[1].split(",")[0].split("(")[0].trim();
    }
    const mayoResponse = await fetch("/mayo-clinic-details", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ diagnosis: topDiagnosis }),
    });
    const mayoData = await mayoResponse.json();

    loading.style.display = "none";

    if (diagnoseData.error) {
      diagnosisResult.textContent = "Error: " + diagnoseData.error;
      urgentResult.textContent = "";
      consultResult.textContent = "";
      homecareResult.textContent = "";
      mayoClinicResult.textContent = "";
      results.classList.remove("shadow-sm", "results-green", "results-yellow", "results-red");
      results.classList.add("results-red");
    } else {
      const isHighConfidence = !diagnoseData.diagnosis.includes("Top 3");
      const topLikelihood = parseInt(diagnoseData.conditions[0].likelihood) || 0;

      if (isHighConfidence) {
        const topCondition = diagnoseData.conditions[0];
        diagnosisResult.innerHTML = `
          <div class="diagnosis-item">
            <h4>${topCondition.name} (${topCondition.likelihood}% certainty)</h4>
            <p>${topCondition.explanation || "No explanation provided"}</p>
          </div>
        `;
      } else {
        const topThree = diagnoseData.conditions.slice(0, 3);
        diagnosisResult.innerHTML = topThree.map(condition => `
          <div class="diagnosis-item">
            <h4>${condition.name} (${condition.likelihood}% certainty)</h4>
            <p>${condition.explanation || "No explanation provided"}</p>
          </div>
        `).join("");
      }

      urgentResult.textContent = diagnoseData.urgent ? "Urgent medical attention required" : "Not urgent";
      urgentResult.className = diagnoseData.urgent ? "urgent" : "";
      consultResult.textContent = diagnoseData.consult;
      homecareResult.textContent = diagnoseData.homecare;

      if (mayoData.error || !mayoData.mayo_clinic_details) {
        mayoClinicResult.textContent = "No additional details available from Mayo Clinic.";
      } else {
        const details = mayoData.mayo_clinic_details;
        const cleanedPrevention = (details.Prevention || "Not available").replace(/\.,/g, ". ");
        mayoClinicResult.innerHTML = `
          <h4>${mayoData.diagnosis}</h4>
          <p><strong>Overview:</strong> ${details.Overview || "Not available"}</p>
          <p><strong>Symptoms:</strong> ${Array.isArray(details.Symptoms) ? "<ul>" + details.Symptoms.map(s => `<li>${s}</li>`).join("") + "</ul>" : (details.Symptoms || "Not available")
          }</p>
          <p><strong>When to see a doctor:</strong> ${details["When to see a doctor"] || "Not available"}</p>
          <p><strong>Causes:</strong> ${details.Causes || "Not available"}</p>
          <p><strong>Risk factors:</strong> ${Array.isArray(details["Risk factors"]) ? "<ul>" + details["Risk factors"].map(r => `<li>${r}</li>`).join("") + "</ul>" : (details["Risk factors"] || "Not available")
          }</p>
          <p><strong>Complications:</strong> ${details.Complications || "Not available"}</p>
          <p><strong>Prevention:</strong> ${cleanedPrevention}</p>
          <p><a href="${mayoData.source}" target="_blank" rel="noopener noreferrer">For more information, click here</a></p>
        `;
      }

      results.classList.remove("shadow-sm", "results-green", "results-yellow", "results-red");
      if (diagnoseData.urgent) {
        results.classList.add("results-red");
      } else if (isHighConfidence && topLikelihood >= 50 && topLikelihood <= 75) {
        results.classList.add("results-yellow");
      } else {
        results.classList.add("results-green");
      }
    }
    chatContainer.innerHTML = "";
    results.style.display = "block";
  } catch (error) {
    loading.style.display = "none";
    diagnosisResult.textContent = "Error connecting to the server. Please try again later.";
    urgentResult.textContent = "";
    consultResult.textContent = "";
    homecareResult.textContent = "";
    mayoClinicResult.textContent = "";
    results.classList.remove("shadow-sm", "results-green", "results-yellow", "results-red");
    results.classList.add("results-red");
    chatContainer.innerHTML = "";
    results.style.display = "block";
  }
}

function resetChat() {
  chatContainer.innerHTML = '';
  results.style.display = "none";
  inputArea.style.display = "block";
  chatContainer.style.display = "block";
  currentQuestionIndex = 0;
  chatActivated = false;
  Object.keys(userResponses).forEach(key => delete userResponses[key]);
  showQuestion();
}

editBtn.addEventListener("click", resetChat);

function forceScrollToTop() {
  window.scrollTo(0, 0);
  chatContainer.scrollTop = 0;
}

document.addEventListener("DOMContentLoaded", () => {
  forceScrollToTop();
  showQuestion();
});

window.addEventListener("load", () => {
  setTimeout(forceScrollToTop, 100);
});