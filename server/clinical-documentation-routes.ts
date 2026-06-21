import type { Express, Request, Response } from "express";
import { logPhiAccess } from "./security/hipaa-audit";
import OpenAI, { toFile } from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface EncounterData {
  patientName: string;
  dateOfBirth: string;
  visitDate: string;
  visitType: string;
  chiefComplaint: string;
  symptoms: string[];
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: string;
    temperature?: string;
    respiratoryRate?: string;
    oxygenSaturation?: string;
    weight?: string;
    height?: string;
  };
  medications?: string[];
  allergies?: string[];
  medicalHistory?: string[];
  socialHistory?: string;
  assessment?: string;
  plan?: string;
}

interface EHRSection {
  sectionName: string;
  content: string;
  confidence: "High" | "Medium" | "Low";
  needsReview: boolean;
  reviewNotes?: string;
}

interface SynthesizedNote {
  encounterSummary: string;
  sections: EHRSection[];
  extractedDiagnoses: Array<{
    description: string;
    icdSuggestion?: string;
    confidence: "High" | "Medium" | "Low";
  }>;
  suggestedFollowUp: string;
  disclaimer: string;
}

interface TranscriptionResult {
  text: string;
  duration: number;
  language: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

function generateFallbackAnalysis(noteText: string) {
  const text = noteText.toLowerCase();

  const subjective: string[] = [];
  const objective: string[] = [];
  const assessment: string[] = [];
  const plan: string[] = [];

  const lines = noteText.split(/[.\n]+/).map(l => l.trim()).filter(Boolean);
  const subjectiveKeywords = ["complain", "report", "denies", "states", "history", "symptom", "feeling", "pain", "nausea", "fatigue", "cough", "headache", "dizziness"];
  const objectiveKeywords = ["vital", "bp", "hr", "temp", "exam", "auscultation", "palpation", "inspection", "lab", "result", "weight", "height", "spo2", "respiratory rate", "blood pressure"];
  const assessmentKeywords = ["diagnos", "assessment", "impression", "condition", "problem", "differential"];
  const planKeywords = ["plan", "prescri", "order", "follow", "referr", "recommend", "return", "schedule", "increase", "decrease", "start", "discontinue", "monitor"];

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (planKeywords.some(k => lower.includes(k))) plan.push(line);
    else if (assessmentKeywords.some(k => lower.includes(k))) assessment.push(line);
    else if (objectiveKeywords.some(k => lower.includes(k))) objective.push(line);
    else if (subjectiveKeywords.some(k => lower.includes(k))) subjective.push(line);
    else subjective.push(line);
  }

  const diagnoses: Array<{ name: string; status: string; confidence: string }> = [];
  const medications: Array<{ name: string; dosage: string; frequency: string; route: string; action: string }> = [];
  const symptoms: Array<{ name: string; duration: string; severity: string }> = [];

  const symptomWords = ["pain", "headache", "fatigue", "nausea", "dizziness", "cough", "fever", "shortness of breath", "dyspnea", "vomiting", "swelling"];
  symptomWords.forEach(s => {
    if (text.includes(s)) symptoms.push({ name: s, duration: "", severity: "" });
  });

  const conditionPatterns = ["diabetes", "hypertension", "hyperlipidemia", "asthma", "copd", "pneumonia", "bronchitis", "arthritis", "depression", "anxiety", "migraine", "anemia"];
  conditionPatterns.forEach(c => {
    if (text.includes(c)) diagnoses.push({ name: c.charAt(0).toUpperCase() + c.slice(1), status: "active", confidence: "medium" });
  });

  const medPatterns = ["metformin", "lisinopril", "aspirin", "atorvastatin", "amlodipine", "omeprazole", "ibuprofen", "acetaminophen", "amoxicillin", "prednisone", "insulin"];
  medPatterns.forEach(m => {
    if (text.includes(m)) medications.push({ name: m.charAt(0).toUpperCase() + m.slice(1), dosage: "", frequency: "", route: "oral", action: "continued" });
  });

  return {
    soap: {
      subjective: subjective.join(". ") || "Unable to parse subjective content.",
      objective: objective.join(". ") || "No objective findings extracted.",
      assessment: assessment.join(". ") || "Assessment requires manual entry.",
      plan: plan.join(". ") || "Plan requires manual entry.",
    },
    entities: {
      diagnoses,
      medications,
      procedures: [] as Array<{ name: string; status: string }>,
      allergies: [] as Array<{ substance: string; reaction: string; severity: string }>,
      labOrders: [] as Array<{ name: string; status: string; value: string; flag: string }>,
      symptoms,
    },
    codeSuggestions: [] as Array<{ type: string; code: string; description: string; confidence: string; rationale: string }>,
    noteSummary: "Fallback analysis — AI service unavailable. Basic keyword-based extraction applied.",
    completenessScore: 0.3,
    missingElements: ["AI-powered SOAP categorization", "ICD-10/CPT code suggestions", "Detailed entity extraction"],
  };
}

export function registerClinicalDocumentationRoutes(app: Express) {
  app.post("/api/clinical-docs/transcribe", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";
      const { audioBase64, mimeType } = req.body;

      if (!audioBase64) {
        return res.status(400).json({ error: "Audio data is required" });
      }

      logPhiAccess({
        userId,
        patientId: "patient-default",
        resourceType: "AudioRecording",
        action: "read",
        details: "TRANSCRIBE_CLINICAL_AUDIO",
      });

      const audioBuffer = Buffer.from(audioBase64, "base64");
      const detectedMime = mimeType || "audio/webm";
      const extension = detectedMime.includes("wav") ? "wav" : 
                        detectedMime.includes("webm") ? "webm" :
                        detectedMime.includes("mp3") ? "mp3" :
                        detectedMime.includes("mp4") ? "mp4" : "webm";
      
      const audioFile = await toFile(audioBuffer, `recording.${extension}`, {
        type: detectedMime,
      });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "gpt-4o-mini-transcribe",
        response_format: "json",
      });

      logPhiAccess({
        userId,
        patientId: "patient-default",
        resourceType: "Transcription",
        action: "write",
        details: "AUDIO_TRANSCRIPTION_COMPLETED",
      });

      const result: TranscriptionResult = {
        text: transcription.text,
        duration: 0,
        language: "en",
      };

      res.json({
        success: true,
        data: result,
        disclaimer: "This transcription is AI-generated and requires clinician review for accuracy. Not for direct clinical use without verification.",
      });
    } catch (error) {
      console.error("[ClinicalDocs] Transcription error:", error);
      res.status(500).json({ error: "Failed to transcribe audio" });
    }
  });

  app.post("/api/clinical-docs/synthesize-note", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";
      const { encounterData, transcriptionText } = req.body;

      if (!encounterData && !transcriptionText) {
        return res.status(400).json({ error: "Either encounter data or transcription text is required" });
      }

      logPhiAccess({
        userId,
        patientId: "patient-default",
        resourceType: "EncounterNote",
        action: "write",
        details: "SYNTHESIZE_ENCOUNTER_NOTE",
      });

      let inputContext = "";
      if (transcriptionText) {
        inputContext = `Clinical Consultation Transcription:\n${transcriptionText}`;
      }
      if (encounterData) {
        const data = encounterData as EncounterData;
        inputContext += `\n\nStructured Encounter Data:
Patient: ${data.patientName}
DOB: ${data.dateOfBirth}
Visit Date: ${data.visitDate}
Visit Type: ${data.visitType}
Chief Complaint: ${data.chiefComplaint}
${data.symptoms?.length ? `Symptoms: ${data.symptoms.join(", ")}` : ""}
${data.vitalSigns ? `Vital Signs: BP ${data.vitalSigns.bloodPressure || "N/A"}, HR ${data.vitalSigns.heartRate || "N/A"}, Temp ${data.vitalSigns.temperature || "N/A"}` : ""}
${data.medications?.length ? `Current Medications: ${data.medications.join(", ")}` : ""}
${data.allergies?.length ? `Allergies: ${data.allergies.join(", ")}` : ""}
${data.medicalHistory?.length ? `Medical History: ${data.medicalHistory.join(", ")}` : ""}
${data.socialHistory ? `Social History: ${data.socialHistory}` : ""}
${data.assessment ? `Assessment: ${data.assessment}` : ""}
${data.plan ? `Plan: ${data.plan}` : ""}`;
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a medical documentation assistant that helps synthesize clinical encounter notes. Your role is strictly administrative - you help organize and format clinical information for documentation purposes ONLY.

CRITICAL GUIDELINES:
- You are NOT providing clinical decision support
- You are NOT making treatment recommendations
- You are ONLY organizing and formatting information that has been provided
- All outputs require physician review before use
- Flag any sections that may need additional review

Format your response as JSON with this structure:
{
  "encounterSummary": "Brief summary of the encounter",
  "sections": [
    {
      "sectionName": "Chief Complaint",
      "content": "...",
      "confidence": "High|Medium|Low",
      "needsReview": boolean,
      "reviewNotes": "optional notes if review needed"
    }
  ],
  "extractedDiagnoses": [
    {
      "description": "...",
      "icdSuggestion": "optional ICD-10 code suggestion for billing",
      "confidence": "High|Medium|Low"
    }
  ],
  "suggestedFollowUp": "Administrative follow-up suggestions only"
}

Required sections: Chief Complaint, History of Present Illness, Review of Systems, Physical Examination, Assessment, Plan.`,
          },
          {
            role: "user",
            content: inputContext,
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2000,
      });

      const synthesized = JSON.parse(response.choices[0]?.message?.content || "{}");

      const result: SynthesizedNote = {
        encounterSummary: synthesized.encounterSummary || "Encounter summary unavailable",
        sections: synthesized.sections || [],
        extractedDiagnoses: synthesized.extractedDiagnoses || [],
        suggestedFollowUp: synthesized.suggestedFollowUp || "",
        disclaimer: "This AI-generated note is for documentation assistance only. It requires physician review and approval before becoming part of the medical record. No clinical decision support is provided.",
      };

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("[ClinicalDocs] Note synthesis error:", error);
      res.status(500).json({ error: "Failed to synthesize encounter note" });
    }
  });

  app.post("/api/clinical-docs/extract-ehr-fields", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";
      const { noteText, targetTemplate } = req.body;

      if (!noteText) {
        return res.status(400).json({ error: "Note text is required" });
      }

      logPhiAccess({
        userId,
        patientId: "patient-default",
        resourceType: "EHRTemplate",
        action: "write",
        details: "EXTRACT_EHR_FIELDS",
      });

      const template = targetTemplate || "SOAP";

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an EHR data extraction assistant. Extract structured data from clinical notes to auto-populate EHR template fields. This is an ADMINISTRATIVE task only - you are not providing clinical guidance.

Target template format: ${template}

Extract and return JSON with these fields based on the template:
{
  "templateType": "${template}",
  "fields": {
    "subjective": { "value": "...", "confidence": "High|Medium|Low", "needsReview": boolean },
    "objective": { "value": "...", "confidence": "High|Medium|Low", "needsReview": boolean },
    "assessment": { "value": "...", "confidence": "High|Medium|Low", "needsReview": boolean },
    "plan": { "value": "...", "confidence": "High|Medium|Low", "needsReview": boolean },
    "vitalSigns": { "value": "...", "confidence": "High|Medium|Low", "needsReview": boolean },
    "medications": { "value": "...", "confidence": "High|Medium|Low", "needsReview": boolean },
    "allergies": { "value": "...", "confidence": "High|Medium|Low", "needsReview": boolean },
    "diagnoses": { "value": "...", "confidence": "High|Medium|Low", "needsReview": boolean },
    "procedures": { "value": "...", "confidence": "High|Medium|Low", "needsReview": boolean },
    "followUp": { "value": "...", "confidence": "High|Medium|Low", "needsReview": boolean }
  },
  "missingFields": ["list of fields that could not be extracted"],
  "warnings": ["any data quality or completeness warnings"]
}

Mark needsReview=true for any field where:
- The extracted data is ambiguous
- Confidence is Medium or Low
- Critical clinical information may be missing`,
          },
          {
            role: "user",
            content: noteText,
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 1500,
      });

      const extracted = JSON.parse(response.choices[0]?.message?.content || "{}");

      res.json({
        success: true,
        data: {
          ...extracted,
          disclaimer: "These extracted fields are AI-generated suggestions for documentation purposes only. All fields require clinician verification before saving to the EHR. This is not clinical decision support.",
        },
      });
    } catch (error) {
      console.error("[ClinicalDocs] EHR extraction error:", error);
      res.status(500).json({ error: "Failed to extract EHR fields" });
    }
  });

  app.post("/api/clinical-docs/analyze-note", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";
      const { noteText, patientContext } = req.body;

      if (!noteText || noteText.trim().length < 10) {
        return res.status(400).json({ error: "Clinical note text is required (minimum 10 characters)" });
      }

      logPhiAccess({
        userId,
        patientId: patientContext?.patientId || "unknown",
        resourceType: "ClinicalNote",
        action: "write",
        details: "AI_CLINICAL_NOTE_ANALYSIS",
      });

      let contextBlock = "";
      if (patientContext) {
        const parts: string[] = [];
        if (patientContext.patientName) parts.push(`Patient: ${patientContext.patientName}`);
        if (patientContext.dateOfBirth) parts.push(`DOB: ${patientContext.dateOfBirth}`);
        if (patientContext.visitDate) parts.push(`Visit Date: ${patientContext.visitDate}`);
        if (patientContext.visitType) parts.push(`Visit Type: ${patientContext.visitType}`);
        if (parts.length > 0) contextBlock = `\n\nPatient Context:\n${parts.join("\n")}`;
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a clinical documentation assistant that analyzes free-text clinical notes. Your tasks:

1. SOAP CATEGORIZATION: Organize the note content into SOAP sections (Subjective, Objective, Assessment, Plan). Each section should contain only the relevant information extracted from the note.

2. ENTITY EXTRACTION: Identify and extract key clinical entities:
   - diagnoses: conditions, diseases, clinical findings
   - medications: drug names with dosage/frequency if mentioned
   - procedures: any procedures performed or ordered
   - allergies: any allergies or adverse reactions mentioned
   - labOrders: any lab tests ordered or results mentioned
   - symptoms: patient-reported symptoms

3. CODE SUGGESTIONS: Suggest appropriate ICD-10 diagnosis codes and CPT procedure/E&M codes based on the documented encounter. Include confidence level and brief rationale.

CRITICAL COMPLIANCE:
- This is documentation assistance ONLY, NOT clinical decision support
- All outputs require physician review before use
- Do NOT make diagnostic or treatment decisions
- Code suggestions are for billing reference only and require certified coder review

Return JSON with this exact structure:
{
  "soap": {
    "subjective": "...",
    "objective": "...",
    "assessment": "...",
    "plan": "..."
  },
  "entities": {
    "diagnoses": [{ "name": "...", "status": "active|resolved|suspected", "confidence": "high|medium|low" }],
    "medications": [{ "name": "...", "dosage": "...", "frequency": "...", "route": "...", "action": "continued|new|changed|discontinued" }],
    "procedures": [{ "name": "...", "status": "performed|ordered|planned" }],
    "allergies": [{ "substance": "...", "reaction": "...", "severity": "mild|moderate|severe" }],
    "labOrders": [{ "name": "...", "status": "ordered|resulted", "value": "...", "flag": "normal|abnormal|critical" }],
    "symptoms": [{ "name": "...", "duration": "...", "severity": "..." }]
  },
  "codeSuggestions": [
    { "type": "ICD-10", "code": "...", "description": "...", "confidence": "high|medium|low", "rationale": "..." },
    { "type": "CPT", "code": "...", "description": "...", "confidence": "high|medium|low", "rationale": "..." }
  ],
  "noteSummary": "Brief one-paragraph summary of the encounter",
  "completenessScore": 0.0-1.0,
  "missingElements": ["list of typical documentation elements not found in the note"]
}

Only include entities that are explicitly mentioned or clearly implied in the note. Do not fabricate information.`,
          },
          {
            role: "user",
            content: `Analyze this clinical note:${contextBlock}\n\n${noteText}`,
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 3000,
      });

      const analysis = JSON.parse(response.choices[0]?.message?.content || "{}");

      logPhiAccess({
        userId,
        patientId: patientContext?.patientId || "unknown",
        resourceType: "ClinicalNote",
        action: "write",
        details: `AI_NOTE_ANALYSIS_COMPLETE | Entities: ${(analysis.entities?.diagnoses?.length || 0) + (analysis.entities?.medications?.length || 0)} | Codes: ${analysis.codeSuggestions?.length || 0}`,
      });

      res.json({
        success: true,
        data: {
          ...analysis,
          disclaimer: "DISCLAIMER: This AI-generated analysis is for documentation assistance only and does NOT constitute clinical decision support. SOAP categorization, entity extraction, and code suggestions all require review and validation by a licensed healthcare provider and certified medical coder. The final clinical judgment and coding decisions rest with the treating physician and billing team.",
          analyzedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("[ClinicalDocs] Note analysis error:", error);

      const fallbackAnalysis = generateFallbackAnalysis(req.body.noteText || "");
      res.json({
        success: true,
        data: {
          ...fallbackAnalysis,
          disclaimer: "DISCLAIMER: This is a rule-based fallback analysis (AI unavailable). All content requires physician review. This is NOT clinical decision support.",
          analyzedAt: new Date().toISOString(),
          fallback: true,
        },
      });
    }
  });

  app.get("/api/clinical-docs/templates", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";

      logPhiAccess({
        userId,
        patientId: "system",
        resourceType: "EHRTemplate",
        action: "read",
        details: "VIEW_AVAILABLE_TEMPLATES",
      });

      const templates = [
        {
          id: "soap",
          name: "SOAP Note",
          description: "Subjective, Objective, Assessment, Plan format",
          sections: ["Subjective", "Objective", "Assessment", "Plan"],
        },
        {
          id: "progress",
          name: "Progress Note",
          description: "Standard follow-up visit documentation",
          sections: ["Interval History", "Current Medications", "Vital Signs", "Examination", "Assessment", "Plan"],
        },
        {
          id: "h-and-p",
          name: "History & Physical",
          description: "Comprehensive new patient evaluation",
          sections: ["Chief Complaint", "HPI", "PMH", "Family History", "Social History", "ROS", "Physical Exam", "Assessment", "Plan"],
        },
        {
          id: "procedure",
          name: "Procedure Note",
          description: "Documentation for clinical procedures",
          sections: ["Indication", "Consent", "Procedure Description", "Findings", "Complications", "Post-Procedure Orders"],
        },
      ];

      res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      console.error("[ClinicalDocs] Error fetching templates");
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/clinical-docs/sample-encounter", async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub || "current-user";

      logPhiAccess({
        userId,
        patientId: "patient-default",
        resourceType: "EncounterData",
        action: "read",
        details: "VIEW_SAMPLE_ENCOUNTER",
      });

      const sampleEncounter: EncounterData = {
        patientName: "Maria Garcia",
        dateOfBirth: "1965-08-12",
        visitDate: "2026-01-20",
        visitType: "Follow-up Visit",
        chiefComplaint: "Follow-up for diabetes management and new onset shortness of breath",
        symptoms: ["Fatigue", "Shortness of breath on exertion", "Occasional dizziness"],
        vitalSigns: {
          bloodPressure: "142/88",
          heartRate: "78",
          temperature: "98.4",
          respiratoryRate: "18",
          oxygenSaturation: "96%",
          weight: "185 lbs",
          height: "5'4\"",
        },
        medications: ["Metformin 1000mg BID", "Lisinopril 10mg daily", "Aspirin 81mg daily"],
        allergies: ["Penicillin - rash", "Sulfa - hives"],
        medicalHistory: ["Type 2 Diabetes Mellitus (diagnosed 2018)", "Hypertension (diagnosed 2015)", "Hyperlipidemia"],
        socialHistory: "Former smoker (quit 2020), occasional alcohol use. Works as administrative assistant. Lives with spouse.",
        assessment: "Type 2 DM with suboptimal control. Hypertension - slightly elevated today. New dyspnea on exertion - needs evaluation.",
        plan: "Order HbA1c, BMP, lipid panel. Consider stress test for dyspnea. Increase Lisinopril to 20mg. Follow up in 4 weeks.",
      };

      res.json({
        success: true,
        data: sampleEncounter,
      });
    } catch (error) {
      console.error("[ClinicalDocs] Error fetching sample encounter");
      res.status(500).json({ error: "Failed to fetch sample encounter" });
    }
  });
}
