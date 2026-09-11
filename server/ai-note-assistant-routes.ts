import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { generatePhiSafeText } from "./services/ai-gateway";
import { isAuthenticated } from "./replit_integrations/auth";
import { requireRole } from "./rbac";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const NO_CDS_DISCLAIMER = "DRAFT - FOR PHYSICIAN REVIEW ONLY. This AI-generated content is for documentation assistance only and does not constitute clinical decision support. All content must be verified by a licensed healthcare provider before use in patient care.";

interface PatientContext {
  patientId: string;
  patientName?: string;
  age?: number;
  sex?: string;
  conditions: { name: string; status: string; onsetDate?: string; severity?: string }[];
  vitals: { type: string; value: string; unit: string; date?: string; status?: string }[];
  medications: { name: string; dosage: string; frequency: string; startDate?: string }[];
  allergies: string[];
  treatmentEfficacy?: { treatment: string; metric: string; currentValue: number; targetValue: number; trend: string; adherence: number }[];
  recentLabs?: { name: string; value: string; unit: string; referenceRange?: string; flag?: string }[];
}

const samplePatients: Record<string, PatientContext> = {
  "PT-2024-001": {
    patientId: "PT-2024-001",
    patientName: "James Mitchell",
    age: 58,
    sex: "Male",
    conditions: [
      { name: "Type 2 Diabetes Mellitus", status: "active", onsetDate: "2022-03-15", severity: "moderate" },
      { name: "Essential Hypertension", status: "active", onsetDate: "2020-08-10", severity: "mild" },
      { name: "Hyperlipidemia", status: "active", onsetDate: "2021-06-22" },
    ],
    vitals: [
      { type: "Blood Pressure", value: "138/86", unit: "mmHg", date: "2026-02-21", status: "elevated" },
      { type: "Heart Rate", value: "76", unit: "bpm", date: "2026-02-21", status: "normal" },
      { type: "Temperature", value: "98.4", unit: "°F", date: "2026-02-21", status: "normal" },
      { type: "Weight", value: "198", unit: "lbs", date: "2026-02-21" },
      { type: "BMI", value: "28.5", unit: "kg/m²", date: "2026-02-21", status: "overweight" },
      { type: "SpO2", value: "98", unit: "%", date: "2026-02-21", status: "normal" },
    ],
    medications: [
      { name: "Metformin", dosage: "1000mg", frequency: "twice daily", startDate: "2022-04-01" },
      { name: "Lisinopril", dosage: "10mg", frequency: "once daily", startDate: "2020-09-15" },
      { name: "Atorvastatin", dosage: "20mg", frequency: "once daily at bedtime", startDate: "2021-07-10" },
    ],
    allergies: ["Sulfa drugs", "Shellfish"],
    treatmentEfficacy: [
      { treatment: "Metformin 1000mg", metric: "HbA1c", currentValue: 7.2, targetValue: 6.5, trend: "improving", adherence: 88 },
      { treatment: "Lisinopril 10mg", metric: "Systolic BP", currentValue: 138, targetValue: 120, trend: "stable", adherence: 92 },
      { treatment: "Atorvastatin 20mg", metric: "LDL Cholesterol", currentValue: 128, targetValue: 100, trend: "improving", adherence: 85 },
    ],
    recentLabs: [
      { name: "HbA1c", value: "7.2", unit: "%", referenceRange: "4.0-5.6", flag: "high" },
      { name: "Fasting Glucose", value: "142", unit: "mg/dL", referenceRange: "70-100", flag: "high" },
      { name: "Total Cholesterol", value: "218", unit: "mg/dL", referenceRange: "<200", flag: "high" },
      { name: "LDL", value: "128", unit: "mg/dL", referenceRange: "<100", flag: "high" },
      { name: "HDL", value: "45", unit: "mg/dL", referenceRange: ">40", flag: "normal" },
      { name: "Triglycerides", value: "168", unit: "mg/dL", referenceRange: "<150", flag: "high" },
      { name: "Creatinine", value: "1.1", unit: "mg/dL", referenceRange: "0.7-1.3", flag: "normal" },
      { name: "eGFR", value: "78", unit: "mL/min", referenceRange: ">60", flag: "normal" },
      { name: "Microalbumin/Creatinine", value: "45", unit: "mg/g", referenceRange: "<30", flag: "high" },
    ],
  },
  "PT-2024-002": {
    patientId: "PT-2024-002",
    patientName: "Sarah Chen",
    age: 45,
    sex: "Female",
    conditions: [
      { name: "Generalized Anxiety Disorder", status: "active", onsetDate: "2019-05-20", severity: "moderate" },
      { name: "Chronic Migraine", status: "active", onsetDate: "2018-01-10", severity: "moderate" },
      { name: "Iron Deficiency Anemia", status: "active", onsetDate: "2025-08-15", severity: "mild" },
    ],
    vitals: [
      { type: "Blood Pressure", value: "118/74", unit: "mmHg", date: "2026-02-21", status: "normal" },
      { type: "Heart Rate", value: "82", unit: "bpm", date: "2026-02-21", status: "normal" },
      { type: "Temperature", value: "98.6", unit: "°F", date: "2026-02-21", status: "normal" },
      { type: "Weight", value: "135", unit: "lbs", date: "2026-02-21" },
      { type: "BMI", value: "23.1", unit: "kg/m²", date: "2026-02-21", status: "normal" },
    ],
    medications: [
      { name: "Sertraline", dosage: "100mg", frequency: "once daily", startDate: "2019-06-01" },
      { name: "Sumatriptan", dosage: "50mg", frequency: "as needed for migraines", startDate: "2018-02-15" },
      { name: "Ferrous Sulfate", dosage: "325mg", frequency: "once daily", startDate: "2025-09-01" },
    ],
    allergies: ["Penicillin", "Latex"],
    treatmentEfficacy: [
      { treatment: "Sertraline 100mg", metric: "GAD-7 Score", currentValue: 8, targetValue: 5, trend: "improving", adherence: 95 },
      { treatment: "Sumatriptan 50mg", metric: "Migraine Days/Month", currentValue: 6, targetValue: 4, trend: "stable", adherence: 78 },
      { treatment: "Ferrous Sulfate 325mg", metric: "Hemoglobin", currentValue: 11.8, targetValue: 12.5, trend: "improving", adherence: 90 },
    ],
    recentLabs: [
      { name: "Hemoglobin", value: "11.8", unit: "g/dL", referenceRange: "12.0-16.0", flag: "low" },
      { name: "Ferritin", value: "18", unit: "ng/mL", referenceRange: "20-200", flag: "low" },
      { name: "Iron", value: "45", unit: "mcg/dL", referenceRange: "60-170", flag: "low" },
      { name: "TIBC", value: "420", unit: "mcg/dL", referenceRange: "250-370", flag: "high" },
      { name: "TSH", value: "2.4", unit: "mIU/L", referenceRange: "0.4-4.0", flag: "normal" },
    ],
  },
  "PT-2024-003": {
    patientId: "PT-2024-003",
    patientName: "Robert Johnson",
    age: 72,
    sex: "Male",
    conditions: [
      { name: "Congestive Heart Failure (NYHA Class II)", status: "active", onsetDate: "2023-02-10", severity: "moderate" },
      { name: "Atrial Fibrillation", status: "active", onsetDate: "2023-02-10", severity: "moderate" },
      { name: "Chronic Kidney Disease Stage 3a", status: "active", onsetDate: "2024-01-20", severity: "moderate" },
      { name: "Type 2 Diabetes Mellitus", status: "active", onsetDate: "2015-06-10" },
    ],
    vitals: [
      { type: "Blood Pressure", value: "142/88", unit: "mmHg", date: "2026-02-21", status: "elevated" },
      { type: "Heart Rate", value: "88", unit: "bpm (irregular)", date: "2026-02-21", status: "irregular" },
      { type: "Temperature", value: "98.2", unit: "°F", date: "2026-02-21", status: "normal" },
      { type: "Weight", value: "210", unit: "lbs", date: "2026-02-21" },
      { type: "SpO2", value: "94", unit: "%", date: "2026-02-21", status: "borderline" },
    ],
    medications: [
      { name: "Furosemide", dosage: "40mg", frequency: "once daily", startDate: "2023-03-01" },
      { name: "Carvedilol", dosage: "12.5mg", frequency: "twice daily", startDate: "2023-03-01" },
      { name: "Apixaban", dosage: "5mg", frequency: "twice daily", startDate: "2023-03-15" },
      { name: "Metformin", dosage: "500mg", frequency: "twice daily", startDate: "2015-07-01" },
      { name: "Lisinopril", dosage: "20mg", frequency: "once daily", startDate: "2023-03-01" },
    ],
    allergies: ["Aspirin", "Codeine"],
    treatmentEfficacy: [
      { treatment: "Furosemide 40mg", metric: "Weight (fluid)", currentValue: 210, targetValue: 200, trend: "worsening", adherence: 80 },
      { treatment: "Carvedilol 12.5mg", metric: "Heart Rate", currentValue: 88, targetValue: 70, trend: "stable", adherence: 85 },
      { treatment: "Apixaban 5mg", metric: "INR Equivalent", currentValue: 2.1, targetValue: 2.5, trend: "stable", adherence: 92 },
    ],
    recentLabs: [
      { name: "BNP", value: "485", unit: "pg/mL", referenceRange: "<100", flag: "high" },
      { name: "Creatinine", value: "1.6", unit: "mg/dL", referenceRange: "0.7-1.3", flag: "high" },
      { name: "eGFR", value: "48", unit: "mL/min", referenceRange: ">60", flag: "low" },
      { name: "Potassium", value: "4.8", unit: "mEq/L", referenceRange: "3.5-5.0", flag: "normal" },
      { name: "Sodium", value: "138", unit: "mEq/L", referenceRange: "136-145", flag: "normal" },
      { name: "HbA1c", value: "7.8", unit: "%", referenceRange: "4.0-5.6", flag: "high" },
    ],
  },
};

function buildPatientDataPrompt(patient: PatientContext): string {
  let prompt = `PATIENT DATA:
Name: ${patient.patientName || "Unknown"} | ID: ${patient.patientId}
Age: ${patient.age || "Unknown"} | Sex: ${patient.sex || "Unknown"}

ACTIVE CONDITIONS:
${patient.conditions.map(c => `- ${c.name} (Status: ${c.status}${c.severity ? `, Severity: ${c.severity}` : ""}${c.onsetDate ? `, Onset: ${c.onsetDate}` : ""})`).join("\n")}

CURRENT VITALS:
${patient.vitals.map(v => `- ${v.type}: ${v.value} ${v.unit}${v.status ? ` (${v.status})` : ""}`).join("\n")}

CURRENT MEDICATIONS:
${patient.medications.map(m => `- ${m.name} ${m.dosage} ${m.frequency}${m.startDate ? ` (since ${m.startDate})` : ""}`).join("\n")}

ALLERGIES: ${patient.allergies.length > 0 ? patient.allergies.join(", ") : "NKDA"}`;

  if (patient.treatmentEfficacy && patient.treatmentEfficacy.length > 0) {
    prompt += `\n\nTREATMENT EFFICACY:
${patient.treatmentEfficacy.map(t => `- ${t.treatment}: ${t.metric} = ${t.currentValue} (Target: ${t.targetValue}, Trend: ${t.trend}, Adherence: ${t.adherence}%)`).join("\n")}`;
  }

  if (patient.recentLabs && patient.recentLabs.length > 0) {
    prompt += `\n\nRECENT LAB RESULTS:
${patient.recentLabs.map(l => `- ${l.name}: ${l.value} ${l.unit}${l.referenceRange ? ` (Ref: ${l.referenceRange})` : ""}${l.flag && l.flag !== "normal" ? ` [${l.flag.toUpperCase()}]` : ""}`).join("\n")}`;
  }

  return prompt;
}

export function registerAINoteAssistantRoutes(app: Express) {
  app.get("/api/ai-note-assistant/patients", isAuthenticated, requireRole("provider", "admin", "clinician"), (_req: Request, res: Response) => {
    try {
      const patients = Object.values(samplePatients).map(p => ({
        patientId: p.patientId,
        patientName: p.patientName,
        age: p.age,
        sex: p.sex,
        conditionCount: p.conditions.length,
        primaryCondition: p.conditions[0]?.name || "None",
      }));
      res.json({ success: true, data: patients });
    } catch (error) {
      console.error("[AINoteAssistant] Error fetching patients:", error);
      res.status(500).json({ success: false, error: "Failed to fetch patients" });
    }
  });

  app.get("/api/ai-note-assistant/patient/:patientId", isAuthenticated, requireRole("provider", "admin", "clinician"), (req: Request, res: Response) => {
    try {
      const patient = samplePatients[req.params.patientId];
      if (!patient) {
        return res.status(404).json({ success: false, error: "Patient not found" });
      }
      res.json({ success: true, data: patient });
    } catch (error) {
      console.error("[AINoteAssistant] Error fetching patient:", error);
      res.status(500).json({ success: false, error: "Failed to fetch patient data" });
    }
  });

  app.post("/api/ai-note-assistant/draft-note", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req: Request, res: Response) => {
    try {
      const { patientId, visitType, chiefComplaint, additionalNotes, noteFormat } = req.body;

      if (!patientId || !chiefComplaint) {
        return res.status(400).json({ success: false, error: "Patient ID and chief complaint are required" });
      }

      const patient = samplePatients[patientId];
      if (!patient) {
        return res.status(404).json({ success: false, error: "Patient not found" });
      }

      console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} | Action: AI_NOTE_DRAFT | Patient: ${patientId} | Type: ${visitType || "follow_up"}`);

      const patientData = buildPatientDataPrompt(patient);
      const format = noteFormat || "soap";

      const systemPrompt = `You are a clinical documentation assistant helping physicians create accurate, comprehensive clinical notes. You have access to the patient's full medical record including conditions, vitals, medications, treatment efficacy data, and recent lab results.

CRITICAL COMPLIANCE:
- This is a DRAFT for physician review only
- Do NOT provide clinical decision support or treatment recommendations beyond documenting what is observed
- All content requires verification by a licensed healthcare provider
- Include appropriate medical terminology and standard documentation format
- Flag any concerning values or trends for physician awareness (NOT as recommendations)

Generate a complete clinical note in ${format === "soap" ? "SOAP (Subjective, Objective, Assessment, Plan)" : format === "hp" ? "H&P (History and Physical)" : format === "progress" ? "Progress Note" : "SOAP"} format.

Return a JSON object with these fields:
1. "draftNote": The full narrative clinical note as a string
2. "structuredSections": Object with keys matching the note format sections, each containing the relevant content
3. "summary": A 2-3 sentence executive summary of the patient's current status
4. "nextSteps": Array of suggested follow-up actions (observations, not recommendations)
5. "concerns": Array of flagged items requiring physician attention
6. "suggestedCodes": Array of objects with {code, type (ICD-10 or CPT), description, confidence (0-1), rationale}
7. "billingComplexity": Object with {level (1-5), justification, suggestedEMCode}`;

      const userPrompt = `${patientData}

VISIT DETAILS:
Visit Type: ${visitType || "Follow-up"}
Chief Complaint: ${chiefComplaint}
${additionalNotes ? `Provider Notes: ${additionalNotes}` : ""}

Generate a comprehensive ${format.toUpperCase()} clinical note incorporating all available patient data, treatment efficacy trends, and lab results. Ensure proper medical coding suggestions.`;

      try {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const stream = await openai.chat.completions.create({
          model: "gpt-5.2",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 4000,
          stream: true,
        });

        let fullResponse = "";

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullResponse += content;
            res.write(`data: ${JSON.stringify({ type: "chunk", content })}\n\n`);
          }
        }

        try {
          const parsed = JSON.parse(fullResponse);
          res.write(`data: ${JSON.stringify({
            type: "complete",
            data: {
              ...parsed,
              noteId: `note-${Date.now()}`,
              patientId,
              generatedAt: new Date().toISOString(),
              disclaimer: NO_CDS_DISCLAIMER,
            },
          })}\n\n`);
        } catch {
          res.write(`data: ${JSON.stringify({
            type: "complete",
            data: {
              draftNote: fullResponse,
              structuredSections: {},
              summary: "Note generated. Please review the full draft above.",
              nextSteps: [],
              concerns: [],
              suggestedCodes: [],
              billingComplexity: { level: 3, justification: "Unable to parse structured output", suggestedEMCode: "99214" },
              noteId: `note-${Date.now()}`,
              patientId,
              generatedAt: new Date().toISOString(),
              disclaimer: NO_CDS_DISCLAIMER,
            },
          })}\n\n`);
        }

        res.write("data: [DONE]\n\n");
        res.end();
      } catch (aiError: any) {
        console.warn("[AINoteAssistant] AI unavailable, using fallback:", aiError.message);

        const fallbackNote = generateFallbackNote(patient, visitType || "follow_up", chiefComplaint, format);
        res.json({ success: true, data: fallbackNote });
      }
    } catch (error) {
      console.error("[AINoteAssistant] Draft note error:", error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "Failed to generate note" });
      }
    }
  });

  app.post("/api/ai-note-assistant/suggest-codes", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req: Request, res: Response) => {
    try {
      const { clinicalText, patientId } = req.body;

      if (!clinicalText) {
        return res.status(400).json({ success: false, error: "Clinical text is required" });
      }

      console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} | Action: CODE_SUGGESTION | Patient: ${patientId || "unknown"}`);

      const patient = patientId ? samplePatients[patientId] : null;
      let contextPrompt = "";
      if (patient) {
        contextPrompt = `\n\nPatient Context:\n- Age: ${patient.age}, Sex: ${patient.sex}\n- Conditions: ${patient.conditions.map(c => c.name).join(", ")}\n- Medications: ${patient.medications.map(m => `${m.name} ${m.dosage}`).join(", ")}`;
      }

      try {
        const content = await generatePhiSafeText({
          system: `You are a medical coding specialist. Analyze clinical documentation and suggest appropriate ICD-10 diagnosis codes and CPT procedure codes.

IMPORTANT: These are suggestions for coder/physician review only. Final code selection must be verified by a certified medical coder.

Return JSON with:
- "codes": array of {code, type (ICD-10 or CPT), description, confidence (0-1), rationale}
- "billingLevel": {emCode, level (1-5), justification, mdmComplexity, timeEstimate}`,
          user: `Suggest ICD-10 and CPT codes for this clinical documentation:\n\n${clinicalText}${contextPrompt}\n\nReturn up to 12 most relevant codes.`,
          responseMimeType: "application/json",
          maxTokens: 2000,
        }) || "{}";
        console.log("[AINoteAssistant] Code suggestion raw response length:", content.length);
        const parsed = JSON.parse(content);
        const codes = parsed.codes || parsed.suggestions || parsed.code_suggestions || [];
        const billingLevel = parsed.billingLevel || parsed.billing_level || parsed.billing || null;
        if (codes.length === 0 && !billingLevel) {
          console.warn("[AINoteAssistant] AI returned no codes, using fallback");
          res.json({ success: true, data: getFallbackCodes(patient) });
        } else {
          res.json({ success: true, data: { codes, billingLevel } });
        }
      } catch (aiError: any) {
        console.warn("[AINoteAssistant] AI code suggestion unavailable:", aiError.message);
        res.json({ success: true, data: getFallbackCodes(patient) });
      }
    } catch (error) {
      console.error("[AINoteAssistant] Code suggestion error:", error);
      res.status(500).json({ success: false, error: "Failed to suggest codes" });
    }
  });

  app.post("/api/ai-note-assistant/summarize", isAuthenticated, requireRole("provider", "admin", "clinician"), async (req: Request, res: Response) => {
    try {
      const { patientId, focusArea } = req.body;

      if (!patientId) {
        return res.status(400).json({ success: false, error: "Patient ID is required" });
      }

      const patient = samplePatients[patientId];
      if (!patient) {
        return res.status(404).json({ success: false, error: "Patient not found" });
      }

      console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} | Action: PATIENT_SUMMARY | Patient: ${patientId}`);

      const patientData = buildPatientDataPrompt(patient);

      try {
        const content = await generatePhiSafeText({
          system: `You are a clinical documentation assistant. Generate a concise patient summary based on their medical data.

IMPORTANT: This is for documentation assistance only. Not clinical decision support.

Return JSON with:
- "summary": Concise 3-5 sentence overview of patient's current health status
- "keyFindings": Array of important findings/observations
- "treatmentProgress": Brief assessment of how treatments are progressing based on efficacy data
- "activeProblems": Prioritized list of active clinical problems
- "medicationReview": Brief medication appropriateness observations
- "preventiveCare": Any preventive care gaps noted`,
          user: `Generate a clinical summary for this patient${focusArea ? ` with focus on: ${focusArea}` : ""}:\n\n${patientData}`,
          responseMimeType: "application/json",
          maxTokens: 2000,
        }) || "{}";
        const parsed = JSON.parse(content);
        res.json({
          success: true,
          data: {
            ...parsed,
            patientId,
            generatedAt: new Date().toISOString(),
            disclaimer: NO_CDS_DISCLAIMER,
          },
        });
      } catch (aiError: any) {
        console.warn("[AINoteAssistant] AI summary unavailable:", aiError.message);
        res.json({
          success: true,
          data: getFallbackSummary(patient),
        });
      }
    } catch (error) {
      console.error("[AINoteAssistant] Summary error:", error);
      res.status(500).json({ success: false, error: "Failed to generate summary" });
    }
  });

  console.log("[Routes] AI Note Assistant routes registered at /api/ai-note-assistant/*");
}

function generateFallbackNote(patient: PatientContext, visitType: string, chiefComplaint: string, format: string) {
  const abnormalLabs = (patient.recentLabs || []).filter(l => l.flag && l.flag !== "normal");
  const worseningTx = (patient.treatmentEfficacy || []).filter(t => t.trend === "worsening");
  const elevatedVitals = patient.vitals.filter(v => v.status === "elevated" || v.status === "borderline" || v.status === "irregular");

  const draftNote = `CLINICAL NOTE - DRAFT

Patient: ${patient.patientName} (${patient.patientId})
Date: ${new Date().toLocaleDateString()}
Visit Type: ${visitType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}

SUBJECTIVE:
Chief Complaint: ${chiefComplaint}
${patient.age}-year-old ${patient.sex?.toLowerCase()} presents for ${visitType.replace(/_/g, " ")}. Active conditions include ${patient.conditions.map(c => c.name).join(", ")}.

Current Medications: ${patient.medications.map(m => `${m.name} ${m.dosage} ${m.frequency}`).join("; ")}.
Allergies: ${patient.allergies.join(", ") || "NKDA"}.

OBJECTIVE:
Vital Signs:
${patient.vitals.map(v => `  ${v.type}: ${v.value} ${v.unit}${v.status && v.status !== "normal" ? ` (${v.status})` : ""}`).join("\n")}

${abnormalLabs.length > 0 ? `Relevant Lab Results:\n${abnormalLabs.map(l => `  ${l.name}: ${l.value} ${l.unit} [${l.flag?.toUpperCase()}] (Ref: ${l.referenceRange})`).join("\n")}` : ""}

ASSESSMENT:
${patient.conditions.map((c, i) => `${i + 1}. ${c.name} - ${c.status}${c.severity ? `, ${c.severity}` : ""}`).join("\n")}

${(patient.treatmentEfficacy || []).length > 0 ? `Treatment Response:\n${(patient.treatmentEfficacy || []).map(t => `  ${t.treatment}: ${t.metric} at ${t.currentValue} (target: ${t.targetValue}), trend: ${t.trend}, adherence: ${t.adherence}%`).join("\n")}` : ""}

PLAN:
${patient.conditions.map((c, i) => `${i + 1}. ${c.name}: Continue current management, monitor per protocol`).join("\n")}
${abnormalLabs.length > 0 ? `${patient.conditions.length + 1}. Follow up on abnormal lab values` : ""}
${elevatedVitals.length > 0 ? `${patient.conditions.length + 2}. Monitor ${elevatedVitals.map(v => v.type.toLowerCase()).join(", ")}` : ""}

---
${NO_CDS_DISCLAIMER}`;

  const suggestedCodes = getFallbackCodes(patient);

  return {
    noteId: `note-${Date.now()}`,
    patientId: patient.patientId,
    draftNote,
    structuredSections: {
      subjective: chiefComplaint,
      objective: `Vitals: ${patient.vitals.map(v => `${v.type} ${v.value} ${v.unit}`).join(", ")}`,
      assessment: patient.conditions.map(c => c.name).join("; "),
      plan: "Continue current management, monitor per protocol",
    },
    summary: `${patient.patientName} is a ${patient.age}-year-old ${patient.sex?.toLowerCase()} with ${patient.conditions.map(c => c.name).join(", ")} presenting for ${visitType.replace(/_/g, " ")}. ${worseningTx.length > 0 ? `Concerning trend in ${worseningTx.map(t => t.metric).join(", ")}.` : "Treatment trends generally stable or improving."} ${abnormalLabs.length > 0 ? `${abnormalLabs.length} abnormal lab value(s) noted.` : ""}`,
    nextSteps: [
      "Review and verify all AI-generated content",
      "Confirm assessment and modify plan as clinically appropriate",
      ...abnormalLabs.map(l => `Address abnormal ${l.name}: ${l.value} ${l.unit}`),
      ...worseningTx.map(t => `Evaluate ${t.treatment} efficacy - ${t.metric} trend worsening`),
      "Schedule appropriate follow-up",
    ],
    concerns: [
      ...elevatedVitals.map(v => `${v.type} ${v.status}: ${v.value} ${v.unit}`),
      ...abnormalLabs.map(l => `${l.name} ${l.flag}: ${l.value} ${l.unit} (ref: ${l.referenceRange})`),
      ...worseningTx.map(t => `${t.treatment}: ${t.metric} worsening (current: ${t.currentValue}, target: ${t.targetValue})`),
    ],
    suggestedCodes: suggestedCodes.codes,
    billingComplexity: suggestedCodes.billingLevel,
    generatedAt: new Date().toISOString(),
    disclaimer: NO_CDS_DISCLAIMER,
  };
}

function getFallbackCodes(patient: PatientContext | null) {
  const codes: any[] = [];
  if (patient) {
    for (const condition of patient.conditions) {
      const name = condition.name.toLowerCase();
      if (name.includes("diabetes")) {
        codes.push({ code: "E11.65", type: "ICD-10", description: "Type 2 diabetes mellitus with hyperglycemia", confidence: 0.9, rationale: "Active diabetes diagnosis" });
      }
      if (name.includes("hypertension")) {
        codes.push({ code: "I10", type: "ICD-10", description: "Essential (primary) hypertension", confidence: 0.92, rationale: "Active hypertension diagnosis" });
      }
      if (name.includes("hyperlipidemia") || name.includes("cholesterol")) {
        codes.push({ code: "E78.5", type: "ICD-10", description: "Hyperlipidemia, unspecified", confidence: 0.88, rationale: "Active hyperlipidemia diagnosis" });
      }
      if (name.includes("heart failure")) {
        codes.push({ code: "I50.9", type: "ICD-10", description: "Heart failure, unspecified", confidence: 0.9, rationale: "Active heart failure diagnosis" });
      }
      if (name.includes("atrial fibrillation")) {
        codes.push({ code: "I48.91", type: "ICD-10", description: "Unspecified atrial fibrillation", confidence: 0.9, rationale: "Active atrial fibrillation" });
      }
      if (name.includes("anxiety")) {
        codes.push({ code: "F41.1", type: "ICD-10", description: "Generalized anxiety disorder", confidence: 0.9, rationale: "Active anxiety disorder" });
      }
      if (name.includes("migraine")) {
        codes.push({ code: "G43.909", type: "ICD-10", description: "Migraine, unspecified, not intractable", confidence: 0.85, rationale: "Active chronic migraine" });
      }
      if (name.includes("anemia")) {
        codes.push({ code: "D50.9", type: "ICD-10", description: "Iron deficiency anemia, unspecified", confidence: 0.88, rationale: "Active iron deficiency anemia" });
      }
      if (name.includes("kidney")) {
        codes.push({ code: "N18.31", type: "ICD-10", description: "Chronic kidney disease, stage 3a", confidence: 0.88, rationale: "Active CKD diagnosis" });
      }
    }
    codes.push({ code: "99214", type: "CPT", description: "Office visit, established patient, moderate complexity", confidence: 0.85, rationale: "Follow-up visit with chronic disease management" });
  }

  return {
    codes,
    billingLevel: {
      emCode: "99214",
      level: 4,
      justification: "Multiple chronic conditions with medication management and lab review",
      mdmComplexity: "Moderate",
      timeEstimate: "30-39 minutes",
    },
  };
}

function getFallbackSummary(patient: PatientContext) {
  const abnormalLabs = (patient.recentLabs || []).filter(l => l.flag && l.flag !== "normal");
  const worseningTx = (patient.treatmentEfficacy || []).filter(t => t.trend === "worsening");

  return {
    summary: `${patient.patientName} is a ${patient.age}-year-old ${patient.sex?.toLowerCase()} with ${patient.conditions.length} active conditions. ${worseningTx.length > 0 ? `There are concerning trends in ${worseningTx.map(t => t.metric).join(" and ")}.` : "Treatment efficacy trends are generally stable or improving."} ${abnormalLabs.length > 0 ? `${abnormalLabs.length} lab values are outside normal range.` : "Lab values are within normal ranges."}`,
    keyFindings: [
      ...abnormalLabs.map(l => `${l.name}: ${l.value} ${l.unit} [${l.flag}]`),
      ...patient.vitals.filter(v => v.status && v.status !== "normal").map(v => `${v.type}: ${v.value} ${v.unit} (${v.status})`),
    ],
    treatmentProgress: (patient.treatmentEfficacy || []).map(t => `${t.treatment}: ${t.trend} (${t.metric} = ${t.currentValue}, target: ${t.targetValue})`).join("; "),
    activeProblems: patient.conditions.map(c => c.name),
    medicationReview: `Patient on ${patient.medications.length} medications. ${patient.treatmentEfficacy ? `Adherence ranges from ${Math.min(...patient.treatmentEfficacy.map(t => t.adherence))}% to ${Math.max(...patient.treatmentEfficacy.map(t => t.adherence))}%.` : ""}`,
    preventiveCare: ["Review immunization status", "Ensure age-appropriate screenings are current"],
    patientId: patient.patientId,
    generatedAt: new Date().toISOString(),
    disclaimer: NO_CDS_DISCLAIMER,
  };
}
