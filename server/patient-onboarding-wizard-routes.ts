import { Router, Request, Response } from "express";
import { generatePhiSafeText } from "./services/ai-gateway";
import crypto from "crypto";

const router = Router();

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, details: string) {
  console.log(`[HIPAA-AUDIT][PatientOnboardingWizard] ${action} - User:${hashIdentifier(userId)} - ${details}`);
}

interface ProfileStep {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  preferredLanguage: string;
  timezone: string;
}

interface ConditionHistoryItem {
  id: string;
  name: string;
  diagnosisDate?: string;
  status: "active" | "resolved" | "managed";
  severity?: "mild" | "moderate" | "severe";
  notes?: string;
}

interface ConditionHistoryStep {
  conditions: ConditionHistoryItem[];
  allergies: Array<{
    id: string;
    allergen: string;
    reaction: string;
    severity: "mild" | "moderate" | "severe";
  }>;
  surgeries: Array<{
    id: string;
    procedure: string;
    date: string;
    hospital?: string;
  }>;
  familyHistory: Array<{
    id: string;
    condition: string;
    relationship: string;
  }>;
}

interface MedicationItem {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  prescribedBy?: string;
  startDate?: string;
  purpose?: string;
  instructions?: string;
}

interface MedicationListStep {
  currentMedications: MedicationItem[];
  pastMedications: MedicationItem[];
  supplements: Array<{
    id: string;
    name: string;
    dosage: string;
    frequency: string;
  }>;
  pharmacyInfo?: {
    name: string;
    phone: string;
    address: string;
  };
}

interface OnboardingProgress {
  patientId: string;
  currentStep: number;
  totalSteps: number;
  completedSteps: string[];
  profileData?: ProfileStep;
  conditionHistory?: ConditionHistoryStep;
  medicationList?: MedicationListStep;
  startedAt: string;
  lastUpdatedAt: string;
  isComplete: boolean;
}

const onboardingProgressStore = new Map<string, OnboardingProgress>();

router.get("/progress/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    logHipaaAudit("GET_PROGRESS", patientId, "Fetching onboarding progress");
    
    let progress = onboardingProgressStore.get(patientId);
    
    if (!progress) {
      progress = {
        patientId,
        currentStep: 1,
        totalSteps: 6,
        completedSteps: [],
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        isComplete: false,
      };
      onboardingProgressStore.set(patientId, progress);
    }
    
    res.json({
      success: true,
      progress,
    });
  } catch (error) {
    console.error("[PatientOnboardingWizard] Error fetching progress:", error);
    res.status(500).json({ error: "Failed to fetch onboarding progress" });
  }
});

router.post("/save-step", async (req: Request, res: Response) => {
  try {
    const { patientId, stepName, stepData } = req.body;
    
    if (!patientId || !stepName) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    logHipaaAudit("SAVE_STEP", patientId, `Saving step: ${stepName}`);
    
    let progress = onboardingProgressStore.get(patientId);
    
    if (!progress) {
      progress = {
        patientId,
        currentStep: 1,
        totalSteps: 6,
        completedSteps: [],
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        isComplete: false,
      };
    }
    
    switch (stepName) {
      case "connect":
        if (!progress.completedSteps.includes("connect")) {
          progress.completedSteps.push("connect");
        }
        progress.currentStep = Math.max(progress.currentStep, 2);
        break;
      case "profile":
        progress.profileData = stepData;
        progress.currentStep = Math.max(progress.currentStep, 3);
        if (!progress.completedSteps.includes("profile")) {
          progress.completedSteps.push("profile");
        }
        break;
      case "conditions":
        progress.conditionHistory = stepData;
        progress.currentStep = Math.max(progress.currentStep, 4);
        if (!progress.completedSteps.includes("conditions")) {
          progress.completedSteps.push("conditions");
        }
        break;
      case "medications":
        progress.medicationList = stepData;
        progress.currentStep = Math.max(progress.currentStep, 5);
        if (!progress.completedSteps.includes("medications")) {
          progress.completedSteps.push("medications");
        }
        break;
      case "wellness":
        (progress as any).wellnessData = stepData;
        progress.currentStep = Math.max(progress.currentStep, 6);
        if (!progress.completedSteps.includes("wellness")) {
          progress.completedSteps.push("wellness");
        }
        logHipaaAudit("SAVE_WELLNESS_PROMS", patientId, `Saved wellness/PROMS data with ${stepData?.completedProms?.length || 0} assessments`);
        break;
      case "review":
        if (!progress.completedSteps.includes("review")) {
          progress.completedSteps.push("review");
        }
        progress.isComplete = true;
        break;
    }
    
    progress.lastUpdatedAt = new Date().toISOString();
    onboardingProgressStore.set(patientId, progress);
    
    res.json({
      success: true,
      progress,
      message: `Step "${stepName}" saved successfully`,
    });
  } catch (error) {
    console.error("[PatientOnboardingWizard] Error saving step:", error);
    res.status(500).json({ error: "Failed to save step data" });
  }
});

router.post("/ai-suggest/conditions", async (req: Request, res: Response) => {
  try {
    const { patientId, inputText, age, gender } = req.body;
    
    logHipaaAudit("AI_SUGGEST_CONDITIONS", patientId || "anonymous", "AI condition suggestions requested");
    
    if (!inputText) {
      return res.json({ suggestions: [] });
    }
    
    const systemPrompt = `You are a helpful medical intake assistant. Based on the patient's description of their health history, suggest relevant medical conditions that might be worth documenting. 

IMPORTANT: You are NOT diagnosing. You are only helping the patient identify conditions they may have been previously diagnosed with to add to their health record.

NO-CDS DISCLAIMER: This is for record-keeping purposes only. This is NOT medical advice or diagnosis.

Return suggestions as a JSON array of objects with: name, suggestedStatus (active/resolved/managed), severity (mild/moderate/severe), and reason (brief explanation).`;

    const userPrompt = `Patient description: "${inputText}"
${age ? `Age: ${age}` : ""}
${gender ? `Gender: ${gender}` : ""}

Based on this description, suggest conditions the patient may have been previously diagnosed with that they should document in their health record. Return as JSON array.`;

    try {
      const content = await generatePhiSafeText({
        system: systemPrompt,
        user: userPrompt,
        responseMimeType: "application/json",
        maxTokens: 500,
      });

      const parsed = JSON.parse(content || "{}");

      res.json({
        suggestions: parsed.suggestions || parsed.conditions || [],
        disclaimer: "These suggestions are for record-keeping purposes only and are NOT medical diagnoses. Please verify with your healthcare provider.",
      });
    } catch (aiError) {
      console.log("[PatientOnboardingWizard] OpenAI not configured, using fallback suggestions");
      
      const fallbackSuggestions = getFallbackConditionSuggestions(inputText);
      res.json({
        suggestions: fallbackSuggestions,
        disclaimer: "These suggestions are for record-keeping purposes only and are NOT medical diagnoses.",
      });
    }
  } catch (error) {
    console.error("[PatientOnboardingWizard] Error getting condition suggestions:", error);
    res.status(500).json({ error: "Failed to get condition suggestions" });
  }
});

router.post("/ai-suggest/medications", async (req: Request, res: Response) => {
  try {
    const { patientId, conditionName, inputText } = req.body;
    
    logHipaaAudit("AI_SUGGEST_MEDICATIONS", patientId || "anonymous", "AI medication suggestions requested");
    
    const systemPrompt = `You are a helpful medical intake assistant. Based on the condition or medication description provided, suggest common medications that the patient might be taking.

IMPORTANT: You are NOT prescribing. You are only helping the patient identify medications they may already be taking.

NO-CDS DISCLAIMER: This is for record-keeping purposes only. This is NOT medical advice.

Return suggestions as a JSON array of objects with: name, commonDosage, typicalFrequency, and purpose.`;

    const userPrompt = `${conditionName ? `Condition: ${conditionName}` : ""}
${inputText ? `Description: ${inputText}` : ""}

Suggest common medications associated with this. Return as JSON array.`;

    try {
      const content = await generatePhiSafeText({
        system: systemPrompt,
        user: userPrompt,
        responseMimeType: "application/json",
        maxTokens: 500,
      });

      const parsed = JSON.parse(content || "{}");

      res.json({
        suggestions: parsed.suggestions || parsed.medications || [],
        disclaimer: "These suggestions are for record-keeping purposes only. Always verify medications with your pharmacist or healthcare provider.",
      });
    } catch (aiError) {
      console.log("[PatientOnboardingWizard] OpenAI not configured, using fallback medication suggestions");
      
      const fallbackSuggestions = getFallbackMedicationSuggestions(conditionName || inputText);
      res.json({
        suggestions: fallbackSuggestions,
        disclaimer: "These suggestions are for record-keeping purposes only.",
      });
    }
  } catch (error) {
    console.error("[PatientOnboardingWizard] Error getting medication suggestions:", error);
    res.status(500).json({ error: "Failed to get medication suggestions" });
  }
});

router.post("/ai-suggest/autofill", async (req: Request, res: Response) => {
  try {
    const { patientId, fieldType, partialInput, context } = req.body;
    
    logHipaaAudit("AI_AUTOFILL", patientId || "anonymous", `AI autofill for ${fieldType}`);
    
    const systemPrompt = `You are a helpful form assistant. Based on the partial input and context, suggest field completions.

NO-CDS DISCLAIMER: This is for form completion assistance only. Not medical advice.

Return as JSON with: suggestions (array of strings), confidence (0-1).`;

    const userPrompt = `Field type: ${fieldType}
Partial input: "${partialInput}"
Context: ${JSON.stringify(context || {})}

Suggest completions for this field.`;

    try {
      const content = await generatePhiSafeText({
        system: systemPrompt,
        user: userPrompt,
        responseMimeType: "application/json",
        maxTokens: 200,
      });

      const parsed = JSON.parse(content || "{}");

      res.json({
        suggestions: parsed.suggestions || [],
        confidence: parsed.confidence || 0.5,
      });
    } catch (aiError) {
      const fallbackSuggestions = getFallbackAutofillSuggestions(fieldType, partialInput);
      res.json({
        suggestions: fallbackSuggestions,
        confidence: 0.3,
      });
    }
  } catch (error) {
    console.error("[PatientOnboardingWizard] Error getting autofill suggestions:", error);
    res.status(500).json({ error: "Failed to get autofill suggestions" });
  }
});

router.post("/complete", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: "Patient ID is required" });
    }
    
    logHipaaAudit("COMPLETE_ONBOARDING", patientId, "Onboarding completed");
    
    const progress = onboardingProgressStore.get(patientId);
    
    if (!progress) {
      return res.status(404).json({ error: "Onboarding progress not found" });
    }
    
    progress.isComplete = true;
    progress.lastUpdatedAt = new Date().toISOString();
    onboardingProgressStore.set(patientId, progress);
    
    res.json({
      success: true,
      message: "Onboarding completed successfully",
      summary: {
        profileComplete: !!progress.profileData,
        conditionsCount: progress.conditionHistory?.conditions?.length || 0,
        allergiesCount: progress.conditionHistory?.allergies?.length || 0,
        medicationsCount: progress.medicationList?.currentMedications?.length || 0,
        completedAt: progress.lastUpdatedAt,
      },
    });
  } catch (error) {
    console.error("[PatientOnboardingWizard] Error completing onboarding:", error);
    res.status(500).json({ error: "Failed to complete onboarding" });
  }
});

function getFallbackConditionSuggestions(input: string): any[] {
  const lowercaseInput = input.toLowerCase();
  const suggestions = [];
  
  if (lowercaseInput.includes("blood pressure") || lowercaseInput.includes("hypertension")) {
    suggestions.push({
      name: "Hypertension (High Blood Pressure)",
      suggestedStatus: "managed",
      severity: "moderate",
      reason: "Based on mention of blood pressure",
    });
  }
  
  if (lowercaseInput.includes("diabetes") || lowercaseInput.includes("blood sugar") || lowercaseInput.includes("glucose")) {
    suggestions.push({
      name: "Type 2 Diabetes Mellitus",
      suggestedStatus: "managed",
      severity: "moderate",
      reason: "Based on mention of diabetes or blood sugar",
    });
  }
  
  if (lowercaseInput.includes("asthma") || lowercaseInput.includes("breathing") || lowercaseInput.includes("inhaler")) {
    suggestions.push({
      name: "Asthma",
      suggestedStatus: "managed",
      severity: "mild",
      reason: "Based on mention of breathing issues or inhaler use",
    });
  }
  
  if (lowercaseInput.includes("cholesterol") || lowercaseInput.includes("lipid")) {
    suggestions.push({
      name: "Hyperlipidemia (High Cholesterol)",
      suggestedStatus: "managed",
      severity: "mild",
      reason: "Based on mention of cholesterol",
    });
  }
  
  if (lowercaseInput.includes("anxiety") || lowercaseInput.includes("stress") || lowercaseInput.includes("worried")) {
    suggestions.push({
      name: "Generalized Anxiety Disorder",
      suggestedStatus: "active",
      severity: "mild",
      reason: "Based on mention of anxiety symptoms",
    });
  }
  
  if (lowercaseInput.includes("depression") || lowercaseInput.includes("sad") || lowercaseInput.includes("mood")) {
    suggestions.push({
      name: "Major Depressive Disorder",
      suggestedStatus: "active",
      severity: "moderate",
      reason: "Based on mention of mood symptoms",
    });
  }
  
  if (lowercaseInput.includes("arthritis") || lowercaseInput.includes("joint pain") || lowercaseInput.includes("stiff")) {
    suggestions.push({
      name: "Osteoarthritis",
      suggestedStatus: "active",
      severity: "moderate",
      reason: "Based on mention of joint issues",
    });
  }
  
  return suggestions;
}

function getFallbackMedicationSuggestions(input: string): any[] {
  const lowercaseInput = (input || "").toLowerCase();
  const suggestions = [];
  
  if (lowercaseInput.includes("blood pressure") || lowercaseInput.includes("hypertension")) {
    suggestions.push(
      { name: "Lisinopril", commonDosage: "10-40mg", typicalFrequency: "Once daily", purpose: "Blood pressure control" },
      { name: "Amlodipine", commonDosage: "5-10mg", typicalFrequency: "Once daily", purpose: "Blood pressure control" },
      { name: "Hydrochlorothiazide", commonDosage: "12.5-25mg", typicalFrequency: "Once daily", purpose: "Diuretic for blood pressure" }
    );
  }
  
  if (lowercaseInput.includes("diabetes")) {
    suggestions.push(
      { name: "Metformin", commonDosage: "500-1000mg", typicalFrequency: "Twice daily", purpose: "Blood sugar control" },
      { name: "Glipizide", commonDosage: "5-10mg", typicalFrequency: "Once daily", purpose: "Blood sugar control" }
    );
  }
  
  if (lowercaseInput.includes("cholesterol")) {
    suggestions.push(
      { name: "Atorvastatin", commonDosage: "10-80mg", typicalFrequency: "Once daily", purpose: "Cholesterol management" },
      { name: "Rosuvastatin", commonDosage: "5-40mg", typicalFrequency: "Once daily", purpose: "Cholesterol management" }
    );
  }
  
  if (lowercaseInput.includes("anxiety")) {
    suggestions.push(
      { name: "Sertraline", commonDosage: "50-200mg", typicalFrequency: "Once daily", purpose: "Anxiety/depression" },
      { name: "Buspirone", commonDosage: "5-30mg", typicalFrequency: "2-3 times daily", purpose: "Anxiety" }
    );
  }
  
  if (lowercaseInput.includes("pain") || lowercaseInput.includes("arthritis")) {
    suggestions.push(
      { name: "Ibuprofen", commonDosage: "200-800mg", typicalFrequency: "As needed", purpose: "Pain relief" },
      { name: "Acetaminophen", commonDosage: "325-650mg", typicalFrequency: "Every 4-6 hours", purpose: "Pain relief" }
    );
  }
  
  return suggestions;
}

function getFallbackAutofillSuggestions(fieldType: string, partialInput: string): string[] {
  const suggestions: Record<string, string[]> = {
    allergen: ["Penicillin", "Sulfa drugs", "Aspirin", "Ibuprofen", "Peanuts", "Shellfish", "Latex", "Bee stings"],
    reaction: ["Rash", "Hives", "Swelling", "Difficulty breathing", "Anaphylaxis", "Nausea", "Itching"],
    relationship: ["Mother", "Father", "Sister", "Brother", "Grandmother", "Grandfather", "Aunt", "Uncle"],
    surgery: ["Appendectomy", "Cholecystectomy", "Hip replacement", "Knee replacement", "C-section", "Tonsillectomy"],
    condition: ["Hypertension", "Type 2 Diabetes", "Asthma", "GERD", "Arthritis", "Hypothyroidism", "Depression", "Anxiety"],
    frequency: ["Once daily", "Twice daily", "Three times daily", "Every 12 hours", "Every 8 hours", "As needed", "Weekly"],
  };
  
  const defaultSuggestions = suggestions[fieldType] || [];
  
  if (partialInput) {
    return defaultSuggestions.filter(s => 
      s.toLowerCase().includes(partialInput.toLowerCase())
    );
  }
  
  return defaultSuggestions.slice(0, 5);
}

const connectedSourcesDataStore = new Map<string, {
  source: string;
  conditions: Array<{ name: string; code?: string; diagnosisDate?: string }>;
  medications: Array<{ name: string; dosage?: string; frequency?: string }>;
  allergies: Array<{ allergen: string; reaction?: string }>;
  demographics: { firstName?: string; lastName?: string; dateOfBirth?: string; gender?: string };
  lastSync: string;
}>();

connectedSourcesDataStore.set("patient-default", {
  source: "Primary Care Provider",
  conditions: [
    { name: "Essential Hypertension", code: "I10", diagnosisDate: "2020-03-15" },
    { name: "Type 2 Diabetes Mellitus", code: "E11.9", diagnosisDate: "2019-08-22" },
    { name: "Hyperlipidemia", code: "E78.5", diagnosisDate: "2021-01-10" },
  ],
  medications: [
    { name: "Metformin", dosage: "500mg", frequency: "Twice daily" },
    { name: "Lisinopril", dosage: "10mg", frequency: "Once daily" },
    { name: "Atorvastatin", dosage: "20mg", frequency: "Once daily at bedtime" },
  ],
  allergies: [
    { allergen: "Penicillin", reaction: "Hives and rash" },
    { allergen: "Sulfa Drugs", reaction: "Difficulty breathing" },
  ],
  demographics: {
    firstName: "John",
    lastName: "Smith",
    dateOfBirth: "1965-04-12",
    gender: "male",
  },
  lastSync: new Date().toISOString(),
});

router.post("/ai-prefill", async (req: Request, res: Response) => {
  try {
    const { patientId, sources } = req.body;
    
    logHipaaAudit("AI_PREFILL_REQUEST", patientId || "anonymous", "AI pre-fill from connected sources requested");
    
    const connectedData = connectedSourcesDataStore.get("patient-default");
    
    if (!connectedData) {
      return res.json({
        success: true,
        prefillData: null,
        message: "No connected health data sources found. Connect your EHR or wearables to auto-fill your profile.",
        disclaimer: "AI pre-fill is for convenience only. Please verify all information for accuracy.",
      });
    }
    
    const systemPrompt = `You are a helpful health data assistant. Analyze the patient's connected health data and prepare structured pre-fill suggestions for their onboarding form.

NO-CDS DISCLAIMER: This is for record-keeping convenience only. This is NOT medical advice.

Return a JSON object with the following structure:
{
  "profile": { "firstName", "lastName", "dateOfBirth", "gender" },
  "conditions": [{ "name", "diagnosisDate", "status", "severity" }],
  "medications": [{ "name", "dosage", "frequency", "purpose" }],
  "allergies": [{ "allergen", "reaction", "severity" }],
  "confidence": "high" | "medium" | "low",
  "sources": ["source names"],
  "suggestedReviewItems": ["items that need patient verification"]
}`;

    const userPrompt = `Connected health data from ${connectedData.source}:

Demographics: ${JSON.stringify(connectedData.demographics)}
Conditions: ${JSON.stringify(connectedData.conditions)}
Medications: ${JSON.stringify(connectedData.medications)}
Allergies: ${JSON.stringify(connectedData.allergies)}
Last synced: ${connectedData.lastSync}

Prepare structured pre-fill data for the patient onboarding form.`;

    try {
      const content = await generatePhiSafeText({
        system: systemPrompt,
        user: userPrompt,
        responseMimeType: "application/json",
        maxTokens: 1000,
      });

      const parsed = JSON.parse(content || "{}");

      logHipaaAudit("AI_PREFILL_GENERATED", patientId || "anonymous", `Pre-fill data generated from ${connectedData.source}`);
      
      res.json({
        success: true,
        prefillData: parsed,
        source: connectedData.source,
        lastSync: connectedData.lastSync,
        disclaimer: "This data was imported from your connected health records. Please review and confirm all information is accurate before proceeding.",
      });
    } catch (aiError) {
      res.json({
        success: true,
        prefillData: {
          profile: connectedData.demographics,
          conditions: connectedData.conditions.map(c => ({
            name: c.name,
            diagnosisDate: c.diagnosisDate,
            status: "active",
            severity: "moderate",
          })),
          medications: connectedData.medications.map(m => ({
            name: m.name,
            dosage: m.dosage,
            frequency: m.frequency,
            purpose: "",
          })),
          allergies: connectedData.allergies.map(a => ({
            allergen: a.allergen,
            reaction: a.reaction,
            severity: "moderate",
          })),
          confidence: "medium",
          sources: [connectedData.source],
          suggestedReviewItems: ["Please verify all imported information"],
        },
        source: connectedData.source,
        lastSync: connectedData.lastSync,
        disclaimer: "This data was imported from your connected health records. Please review and confirm all information is accurate.",
      });
    }
  } catch (error) {
    console.error("[PatientOnboardingWizard] AI prefill error:", error);
    res.status(500).json({ error: "Failed to generate pre-fill data" });
  }
});

router.get("/connected-sources/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    
    logHipaaAudit("GET_CONNECTED_SOURCES", patientId, "Checking connected health data sources");
    
    const sampleSources = [
      { id: "epic-1", name: "Primary Care Provider", type: "ehr", status: "connected", lastSync: new Date().toISOString(), dataTypes: ["conditions", "medications", "allergies", "demographics"] },
      { id: "fitbit-1", name: "Fitbit", type: "wearable", status: "available", lastSync: null, dataTypes: ["activity", "sleep", "heart_rate"] },
      { id: "apple-1", name: "Apple Health", type: "health_app", status: "available", lastSync: null, dataTypes: ["vitals", "activity", "sleep"] },
    ];
    
    res.json({
      success: true,
      sources: sampleSources,
      hasConnectedSources: sampleSources.some(s => s.status === "connected"),
    });
  } catch (error) {
    console.error("[PatientOnboardingWizard] Get connected sources error:", error);
    res.status(500).json({ error: "Failed to get connected sources" });
  }
});

interface PROMSResponse {
  id: string;
  patientId: string;
  instrument: "PHQ9" | "GAD7" | "PAIN_SCALE" | "FATIGUE" | "SLEEP_QUALITY" | "FUNCTIONAL_STATUS";
  responses: Record<string, number>;
  totalScore: number;
  interpretation: string;
  severity: "minimal" | "mild" | "moderate" | "moderately_severe" | "severe";
  completedAt: string;
}

const promsStore = new Map<string, PROMSResponse[]>();

const PHQ9_QUESTIONS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself - or that you are a failure",
  "Trouble concentrating on things",
  "Moving or speaking slowly, or being restless",
  "Thoughts that you would be better off dead, or of hurting yourself",
];

const GAD7_QUESTIONS = [
  "Feeling nervous, anxious, or on edge",
  "Not being able to stop or control worrying",
  "Worrying too much about different things",
  "Trouble relaxing",
  "Being so restless that it's hard to sit still",
  "Becoming easily annoyed or irritable",
  "Feeling afraid as if something awful might happen",
];

function interpretPHQ9Score(score: number): { severity: PROMSResponse["severity"]; interpretation: string } {
  if (score <= 4) return { severity: "minimal", interpretation: "Minimal depression symptoms" };
  if (score <= 9) return { severity: "mild", interpretation: "Mild depression symptoms" };
  if (score <= 14) return { severity: "moderate", interpretation: "Moderate depression symptoms" };
  if (score <= 19) return { severity: "moderately_severe", interpretation: "Moderately severe depression symptoms" };
  return { severity: "severe", interpretation: "Severe depression symptoms" };
}

function interpretGAD7Score(score: number): { severity: PROMSResponse["severity"]; interpretation: string } {
  if (score <= 4) return { severity: "minimal", interpretation: "Minimal anxiety symptoms" };
  if (score <= 9) return { severity: "mild", interpretation: "Mild anxiety symptoms" };
  if (score <= 14) return { severity: "moderate", interpretation: "Moderate anxiety symptoms" };
  return { severity: "severe", interpretation: "Severe anxiety symptoms" };
}

router.get("/proms/instruments", async (req: Request, res: Response) => {
  try {
    const instruments = [
      {
        id: "PHQ9",
        name: "Patient Health Questionnaire-9",
        description: "Screens for depression symptoms over the past 2 weeks",
        questions: PHQ9_QUESTIONS.map((q, i) => ({ id: `phq9_${i + 1}`, text: q })),
        responseOptions: [
          { value: 0, label: "Not at all" },
          { value: 1, label: "Several days" },
          { value: 2, label: "More than half the days" },
          { value: 3, label: "Nearly every day" },
        ],
        maxScore: 27,
        timeframe: "Past 2 weeks",
      },
      {
        id: "GAD7",
        name: "Generalized Anxiety Disorder-7",
        description: "Screens for anxiety symptoms over the past 2 weeks",
        questions: GAD7_QUESTIONS.map((q, i) => ({ id: `gad7_${i + 1}`, text: q })),
        responseOptions: [
          { value: 0, label: "Not at all" },
          { value: 1, label: "Several days" },
          { value: 2, label: "More than half the days" },
          { value: 3, label: "Nearly every day" },
        ],
        maxScore: 21,
        timeframe: "Past 2 weeks",
      },
      {
        id: "PAIN_SCALE",
        name: "Pain Assessment",
        description: "Rate your current pain level",
        questions: [{ id: "pain_1", text: "Rate your current pain level" }],
        responseOptions: Array.from({ length: 11 }, (_, i) => ({ value: i, label: i === 0 ? "No pain" : i === 10 ? "Worst pain" : `${i}` })),
        maxScore: 10,
        timeframe: "Current",
      },
      {
        id: "FUNCTIONAL_STATUS",
        name: "Daily Function Assessment",
        description: "How well you can perform daily activities",
        questions: [
          { id: "func_1", text: "Ability to perform work or usual activities" },
          { id: "func_2", text: "Ability to enjoy recreational or leisure activities" },
          { id: "func_3", text: "Ability to manage daily responsibilities" },
        ],
        responseOptions: [
          { value: 0, label: "No difficulty" },
          { value: 1, label: "A little difficulty" },
          { value: 2, label: "Some difficulty" },
          { value: 3, label: "A lot of difficulty" },
          { value: 4, label: "Unable to do" },
        ],
        maxScore: 12,
        timeframe: "Past week",
      },
    ];
    
    res.json({
      success: true,
      instruments,
      disclaimer: "These assessments help document your baseline health status. They are NOT diagnostic tools and do NOT replace professional evaluation.",
    });
  } catch (error) {
    console.error("[PatientOnboardingWizard] Get PROMS instruments error:", error);
    res.status(500).json({ error: "Failed to get PROMS instruments" });
  }
});

router.post("/proms/submit", async (req: Request, res: Response) => {
  try {
    const { patientId, instrument, responses } = req.body;
    
    if (!patientId || !instrument || !responses) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    logHipaaAudit("SUBMIT_PROMS", patientId, `Submitting ${instrument} assessment`);
    
    const totalScore = Object.values(responses as Record<string, number>).reduce((sum, val) => sum + val, 0);
    
    let interpretation: { severity: PROMSResponse["severity"]; interpretation: string };
    
    switch (instrument) {
      case "PHQ9":
        interpretation = interpretPHQ9Score(totalScore);
        break;
      case "GAD7":
        interpretation = interpretGAD7Score(totalScore);
        break;
      case "PAIN_SCALE":
        if (totalScore <= 3) interpretation = { severity: "mild", interpretation: "Mild pain" };
        else if (totalScore <= 6) interpretation = { severity: "moderate", interpretation: "Moderate pain" };
        else interpretation = { severity: "severe", interpretation: "Severe pain" };
        break;
      default:
        if (totalScore <= 4) interpretation = { severity: "minimal", interpretation: "Good functional status" };
        else if (totalScore <= 8) interpretation = { severity: "moderate", interpretation: "Some functional limitations" };
        else interpretation = { severity: "severe", interpretation: "Significant functional limitations" };
    }
    
    const promsResponse: PROMSResponse = {
      id: `proms-${Date.now()}`,
      patientId,
      instrument: instrument as PROMSResponse["instrument"],
      responses,
      totalScore,
      interpretation: interpretation.interpretation,
      severity: interpretation.severity,
      completedAt: new Date().toISOString(),
    };
    
    const patientProms = promsStore.get(patientId) || [];
    patientProms.push(promsResponse);
    promsStore.set(patientId, patientProms);
    
    res.json({
      success: true,
      result: promsResponse,
      disclaimer: "This result is for baseline documentation only. It is NOT a diagnosis. Consult your healthcare provider for evaluation.",
    });
  } catch (error) {
    console.error("[PatientOnboardingWizard] Submit PROMS error:", error);
    res.status(500).json({ error: "Failed to submit PROMS" });
  }
});

router.get("/proms/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    
    logHipaaAudit("GET_PROMS", patientId, "Fetching PROMS history");
    
    const patientProms = promsStore.get(patientId) || [];
    
    res.json({
      success: true,
      assessments: patientProms,
    });
  } catch (error) {
    console.error("[PatientOnboardingWizard] Get PROMS error:", error);
    res.status(500).json({ error: "Failed to get PROMS history" });
  }
});

router.post("/ai-connection-guide", async (req: Request, res: Response) => {
  try {
    const { patientId, sourceType, userQuestion } = req.body;
    
    logHipaaAudit("AI_CONNECTION_GUIDE", patientId || "anonymous", `Connection guide requested for ${sourceType}`);
    
    const connectionGuides: Record<string, {
      steps: string[];
      tips: string[];
      commonIssues: Array<{ issue: string; solution: string }>;
      estimatedTime: string;
    }> = {
      epic_mychart: {
        steps: [
          "Open the MyChart app on your phone or visit mychart.com",
          "Log in with your existing MyChart credentials",
          "Navigate to 'Share My Record' or 'Health Records' section",
          "Look for 'Connect to Apps' or 'Share with Third Parties'",
          "Search for 'Tabula Medica' and authorize access",
          "Confirm the data types you want to share",
          "Return to Tabula Medica to complete the connection",
        ],
        tips: [
          "Make sure you have your MyChart login credentials ready",
          "Some healthcare systems require approval which may take 24-48 hours",
          "You can revoke access at any time from MyChart settings",
        ],
        commonIssues: [
          { issue: "Can't find my provider in the list", solution: "Your healthcare provider may use a different EHR system. Try searching by hospital name or ask your provider which patient portal they use." },
          { issue: "Authorization is pending", solution: "Some providers require manual approval. Check your email for confirmation or contact your provider's records department." },
        ],
        estimatedTime: "5-10 minutes",
      },
      apple_health: {
        steps: [
          "On your iPhone, open the Health app",
          "Tap your profile picture in the top right",
          "Scroll down and tap 'Health Records'",
          "Tap 'Get Started' if this is your first time",
          "Search for and connect your healthcare providers",
          "To export data: tap Browse > Summary > Export Health Data",
          "Share the exported file with Tabula Medica",
        ],
        tips: [
          "Make sure your iPhone is running iOS 11.3 or later",
          "Not all healthcare providers support Health Records",
          "Exporting can take a few minutes for large health histories",
        ],
        commonIssues: [
          { issue: "My provider isn't listed", solution: "Not all providers support Apple Health Records yet. Contact your provider to ask about SMART on FHIR support." },
        ],
        estimatedTime: "5-15 minutes",
      },
      fitbit: {
        steps: [
          "Make sure your Fitbit app is up to date",
          "In Tabula Medica, go to Health Data Sources",
          "Select Fitbit from the list of available connections",
          "You'll be redirected to Fitbit's login page",
          "Log in with your Fitbit credentials",
          "Review and approve the data sharing permissions",
          "Return to Tabula Medica to confirm connection",
        ],
        tips: [
          "Sync your Fitbit device before connecting for the most recent data",
          "You can select which data types to share",
        ],
        commonIssues: [
          { issue: "Data not syncing", solution: "Make sure your Fitbit app has synced recently. Try syncing manually before connecting." },
        ],
        estimatedTime: "3-5 minutes",
      },
    };
    
    const guide = connectionGuides[sourceType] || {
      steps: [
        "Go to Health Data Sources in Tabula Medica",
        "Select your data source from the list",
        "Follow the prompts to authorize access",
        "Return to complete the connection",
      ],
      tips: ["Have your login credentials ready", "Make sure your device or app is up to date"],
      commonIssues: [],
      estimatedTime: "5-10 minutes",
    };
    
    if (userQuestion) {
      try {
        const systemPrompt = `You are a helpful health technology assistant helping patients connect their health data sources to Tabula Medica. Answer questions about the connection process in simple, non-technical language.

NO-CDS DISCLAIMER: You provide technical support only. You do NOT provide medical advice.

Be friendly, patient, and focus on practical step-by-step guidance.`;

        const aiAnswer = (await generatePhiSafeText({
          system: systemPrompt,
          user: `The user is trying to connect ${sourceType} and asks: "${userQuestion}"

Connection guide available: ${JSON.stringify(guide)}

Please provide a helpful, friendly answer.`,
          maxTokens: 400,
        })) || "I'd be happy to help you connect your health data. Could you provide more details about what you're trying to do?";
        
        res.json({
          success: true,
          guide,
          aiResponse: aiAnswer,
          disclaimer: "This guide helps you connect your health data sources. If you have trouble, contact your healthcare provider or device manufacturer for support.",
        });
      } catch (aiError) {
        res.json({
          success: true,
          guide,
          aiResponse: null,
          disclaimer: "This guide helps you connect your health data sources.",
        });
      }
    } else {
      res.json({
        success: true,
        guide,
        disclaimer: "This guide helps you connect your health data sources. If you have trouble, contact your healthcare provider or device manufacturer for support.",
      });
    }
  } catch (error) {
    console.error("[PatientOnboardingWizard] AI connection guide error:", error);
    res.status(500).json({ error: "Failed to generate connection guide" });
  }
});

export default router;
