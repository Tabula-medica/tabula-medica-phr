import type { 
  GuardrailCheckResult, 
  GuardrailRefusalResponse,
  GuardrailTriggerReason 
} from "@shared/schema";

const MEDICAL_ADVICE_PATTERNS: { pattern: RegExp; reason: GuardrailTriggerReason; category: string }[] = [
  { pattern: /what\s+should\s+i\s+do/i, reason: "medical_advice_request", category: "action advice" },
  { pattern: /should\s+i\s+(take|stop|start|change)/i, reason: "treatment_recommendation", category: "treatment decision" },
  { pattern: /is\s+this\s+(serious|dangerous|bad|urgent|emergency)/i, reason: "urgency_assessment", category: "severity assessment" },
  { pattern: /should\s+i\s+(worry|be\s+concerned|see\s+a\s+doctor)/i, reason: "urgency_assessment", category: "concern level" },
  { pattern: /do\s+i\s+(need|have)\s+to\s+(go|see|visit|call)/i, reason: "urgency_assessment", category: "care seeking" },
  { pattern: /is\s+(it|this)\s+(normal|okay|fine|safe)/i, reason: "diagnosis_request", category: "normalcy assessment" },
  { pattern: /what\s+(does|do)\s+(this|it)\s+mean\s+for\s+my\s+health/i, reason: "diagnosis_request", category: "health impact" },
  { pattern: /am\s+i\s+(sick|ill|dying|healthy)/i, reason: "diagnosis_request", category: "health status" },
  { pattern: /could\s+(this|it)\s+be\s+(\w+\s+)?(cancer|disease|illness|infection)/i, reason: "diagnosis_request", category: "diagnosis speculation" },
  { pattern: /how\s+much\s+(\w+\s+)?should\s+i\s+take/i, reason: "medication_dosage", category: "dosage advice" },
  { pattern: /can\s+i\s+(take|use|stop|increase|decrease)\s+(\w+\s+)?(medication|medicine|drug|pill)/i, reason: "medication_dosage", category: "medication decision" },
  { pattern: /what\s+(medication|medicine|treatment)\s+should/i, reason: "treatment_recommendation", category: "treatment selection" },
  { pattern: /how\s+(serious|bad|severe)\s+is\s+(this|it|my)/i, reason: "symptom_severity", category: "severity rating" },
  { pattern: /on\s+a\s+scale\s+of\s+\d+\s+to\s+\d+/i, reason: "symptom_severity", category: "severity rating" },
  { pattern: /will\s+(this|i)\s+(get\s+worse|die|recover|heal)/i, reason: "diagnosis_request", category: "prognosis" },
  { pattern: /recommend\s+(a\s+)?(treatment|medication|doctor|specialist)/i, reason: "treatment_recommendation", category: "recommendation request" },
  { pattern: /what\s+(treatment|cure|remedy)\s+(is|would\s+be)\s+best/i, reason: "treatment_recommendation", category: "treatment selection" },
  { pattern: /diagnose\s+(me|this|my)/i, reason: "diagnosis_request", category: "diagnosis request" },
  { pattern: /tell\s+me\s+(if|whether)\s+i\s+(have|should)/i, reason: "diagnosis_request", category: "diagnosis/advice request" },
];

const REFUSAL_MESSAGES: Record<GuardrailTriggerReason, string> = {
  medical_advice_request: "I'm not able to provide medical advice or tell you what actions to take regarding your health.",
  diagnosis_request: "I'm not able to diagnose conditions or assess your health status. Only a qualified healthcare provider can do this.",
  treatment_recommendation: "I'm not able to recommend treatments, medications, or changes to your care plan.",
  urgency_assessment: "I'm not able to assess whether something is serious or urgent. If you're concerned, please contact a healthcare provider.",
  medication_dosage: "I'm not able to advise on medication dosages or changes. Please consult your healthcare provider or pharmacist.",
  symptom_severity: "I'm not able to rate the severity of symptoms or conditions. A healthcare provider can properly evaluate this.",
};

const CLINICIAN_HANDOFF_MESSAGES: Record<GuardrailTriggerReason, string> = {
  medical_advice_request: "For personalized medical advice, please speak with your doctor or healthcare provider who knows your complete medical history.",
  diagnosis_request: "For an accurate diagnosis, please schedule an appointment with your healthcare provider who can examine you and review your full history.",
  treatment_recommendation: "Treatment decisions should be made with your healthcare team who can consider all factors specific to your situation.",
  urgency_assessment: "If you believe you may need urgent care, please call your doctor, visit an urgent care center, or call emergency services (911) if you think it's an emergency.",
  medication_dosage: "For questions about medications, please contact your prescribing doctor or a pharmacist who can review your medications and health conditions.",
  symptom_severity: "Your healthcare provider can properly assess your symptoms during an examination and recommend appropriate next steps.",
};

const SUGGESTED_ACTIONS: Record<GuardrailTriggerReason, string[]> = {
  medical_advice_request: [
    "Schedule an appointment with your primary care provider",
    "Prepare a list of questions to discuss with your doctor",
    "Review your health records to share relevant information",
  ],
  diagnosis_request: [
    "Contact your healthcare provider's office",
    "Note your symptoms to discuss with your doctor",
    "Bring any relevant test results to your appointment",
  ],
  treatment_recommendation: [
    "Discuss treatment options with your care team",
    "Ask your doctor to explain the benefits and risks",
    "Get a second opinion if you'd like more perspectives",
  ],
  urgency_assessment: [
    "Call your doctor's office for guidance",
    "Visit an urgent care if your doctor is unavailable",
    "Call 911 or go to the ER if you believe it's an emergency",
  ],
  medication_dosage: [
    "Contact your prescribing doctor's office",
    "Speak with a pharmacist about your medications",
    "Never change doses without consulting a healthcare provider",
  ],
  symptom_severity: [
    "Track your symptoms and when they occur",
    "Share your symptom log with your healthcare provider",
    "Seek immediate care if symptoms worsen suddenly",
  ],
};

export function checkForMedicalAdviceRequest(prompt: string): GuardrailCheckResult {
  const normalizedPrompt = prompt.toLowerCase().trim();
  
  for (const { pattern, reason, category } of MEDICAL_ADVICE_PATTERNS) {
    if (pattern.test(normalizedPrompt)) {
      const refusalResponse: GuardrailRefusalResponse = {
        id: `guardrail-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        triggered: true,
        triggerReason: reason,
        detectedPattern: category,
        originalPrompt: prompt,
        refusalMessage: REFUSAL_MESSAGES[reason],
        clinicianHandoffMessage: CLINICIAN_HANDOFF_MESSAGES[reason],
        suggestedActions: SUGGESTED_ACTIONS[reason],
        timestamp: new Date().toISOString(),
      };
      return refusalResponse;
    }
  }
  
  return {
    triggered: false,
    originalPrompt: prompt,
  };
}

export function isGuardrailTriggered(result: GuardrailCheckResult): result is GuardrailRefusalResponse {
  return result.triggered === true;
}
