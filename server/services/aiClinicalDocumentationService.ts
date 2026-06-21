import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export const NO_CDS_DISCLAIMER = "DISCLAIMER: This AI-generated content is for documentation assistance only and does not constitute clinical decision support. All generated notes and code suggestions require clinician review and validation before use. The final clinical judgment rests with the licensed healthcare provider.";

export interface VisitData {
  patientId: string;
  patientName: string;
  dateOfBirth?: string;
  visitDate: string;
  visitType: string;
  chiefComplaint: string;
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    weight?: number;
    height?: number;
  };
  symptoms?: string[];
  physicalExam?: {
    general?: string;
    heent?: string;
    cardiovascular?: string;
    respiratory?: string;
    abdominal?: string;
    musculoskeletal?: string;
    neurological?: string;
    skin?: string;
  };
  diagnoses?: string[];
  medications?: Array<{
    name: string;
    dose?: string;
    frequency?: string;
  }>;
  allergies?: string[];
  procedures?: string[];
  labResults?: Array<{
    test: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    flag?: "normal" | "abnormal" | "critical";
  }>;
  imagingResults?: Array<{
    study: string;
    findings: string;
    impression?: string;
  }>;
  assessmentPlan?: string;
  followUp?: string;
}

export interface GeneratedNote {
  id: string;
  patientId: string;
  visitDate: string;
  noteType: "soap" | "progress" | "discharge" | "procedure" | "consultation";
  content: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    fullNote?: string;
  };
  suggestedCodes: CodeSuggestion[];
  generatedAt: string;
  status: "draft" | "reviewed" | "finalized";
  disclaimer: string;
}

export interface CodeSuggestion {
  type: "ICD-10" | "CPT" | "HCPCS";
  code: string;
  description: string;
  confidence: "high" | "medium" | "low";
  rationale: string;
  relatedDocumentation?: string;
}

export interface LabSummary {
  patientId: string;
  patientName: string;
  labDate: string;
  results: Array<{
    test: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    flag?: string;
  }>;
}

const generatedNotes: Map<string, GeneratedNote> = new Map();
const codeHistory: Map<string, CodeSuggestion[]> = new Map();

function initializeSampleData(): void {
  const sampleNote: GeneratedNote = {
    id: "note-001",
    patientId: "patient-123",
    visitDate: new Date().toISOString().split("T")[0],
    noteType: "soap",
    content: {
      subjective: "Patient presents with complaints of persistent headaches for the past 3 days. Pain is described as throbbing, located in the frontal region, rated 6/10 severity. Associated with photophobia and mild nausea. No fever, neck stiffness, or visual changes. Patient reports stress at work and poor sleep quality recently.",
      objective: "Vital Signs: BP 128/82 mmHg, HR 76 bpm, Temp 98.4°F, RR 16. General: Alert, oriented, appears uncomfortable. HEENT: PERRLA, no papilledema, no sinus tenderness. Neck: Supple, no meningismus. Neuro: Cranial nerves II-XII intact, no focal deficits.",
      assessment: "1. Tension-type headache, likely stress-related\n2. Insomnia\n3. Rule out migraine without aura",
      plan: "1. Acetaminophen 500mg PRN for headache\n2. Sleep hygiene counseling provided\n3. Stress management recommendations\n4. Return if symptoms worsen or new symptoms develop\n5. Consider neurology referral if no improvement in 2 weeks"
    },
    suggestedCodes: [
      {
        type: "ICD-10",
        code: "G44.209",
        description: "Tension-type headache, unspecified, not intractable",
        confidence: "high",
        rationale: "Chief complaint of headache with stress-related etiology and frontal location pattern consistent with tension-type headache"
      },
      {
        type: "ICD-10",
        code: "G47.00",
        description: "Insomnia, unspecified",
        confidence: "medium",
        rationale: "Patient reports poor sleep quality; documented in subjective findings"
      },
      {
        type: "CPT",
        code: "99213",
        description: "Office visit, established patient, low complexity",
        confidence: "high",
        rationale: "Established patient visit with straightforward MDM for acute uncomplicated headache"
      }
    ],
    generatedAt: new Date().toISOString(),
    status: "draft",
    disclaimer: NO_CDS_DISCLAIMER
  };
  
  generatedNotes.set(sampleNote.id, sampleNote);
  codeHistory.set("patient-123", sampleNote.suggestedCodes);
}

initializeSampleData();

export async function generateClinicalNote(
  visitData: VisitData,
  noteType: "soap" | "progress" | "discharge" | "procedure" | "consultation" = "soap"
): Promise<GeneratedNote> {
  const noteId = `note-${Date.now()}`;
  
  const prompt = buildNotePrompt(visitData, noteType);
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a clinical documentation assistant helping healthcare providers create accurate, comprehensive clinical notes. 
You generate notes in a structured format based on the provided visit data.
IMPORTANT: Your output is for documentation assistance only and requires clinician review before use.
Do NOT provide clinical decision support, diagnostic recommendations, or treatment advice.
Focus only on accurately documenting the provided information in professional medical terminology.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const content = JSON.parse(response.choices[0]?.message?.content || "{}");
    
    const codes = await suggestCodes(visitData, content);
    
    const note: GeneratedNote = {
      id: noteId,
      patientId: visitData.patientId,
      visitDate: visitData.visitDate,
      noteType,
      content: {
        subjective: content.subjective || "",
        objective: content.objective || "",
        assessment: content.assessment || "",
        plan: content.plan || "",
        fullNote: content.fullNote || ""
      },
      suggestedCodes: codes,
      generatedAt: new Date().toISOString(),
      status: "draft",
      disclaimer: NO_CDS_DISCLAIMER
    };
    
    generatedNotes.set(noteId, note);
    
    const existingCodes = codeHistory.get(visitData.patientId) || [];
    codeHistory.set(visitData.patientId, [...existingCodes, ...codes]);
    
    return note;
  } catch (error) {
    console.error("[AIClinicalDocumentation] Error generating note:", error);
    return generateFallbackNote(visitData, noteType, noteId);
  }
}

function buildNotePrompt(visitData: VisitData, noteType: string): string {
  let prompt = `Generate a clinical ${noteType.toUpperCase()} note based on the following visit data:\n\n`;
  
  prompt += `Patient: ${visitData.patientName}\n`;
  prompt += `Visit Date: ${visitData.visitDate}\n`;
  prompt += `Visit Type: ${visitData.visitType}\n`;
  prompt += `Chief Complaint: ${visitData.chiefComplaint}\n\n`;
  
  if (visitData.vitalSigns) {
    prompt += "Vital Signs:\n";
    const vs = visitData.vitalSigns;
    if (vs.bloodPressure) prompt += `- Blood Pressure: ${vs.bloodPressure}\n`;
    if (vs.heartRate) prompt += `- Heart Rate: ${vs.heartRate} bpm\n`;
    if (vs.temperature) prompt += `- Temperature: ${vs.temperature}°F\n`;
    if (vs.respiratoryRate) prompt += `- Respiratory Rate: ${vs.respiratoryRate}/min\n`;
    if (vs.oxygenSaturation) prompt += `- O2 Saturation: ${vs.oxygenSaturation}%\n`;
    if (vs.weight) prompt += `- Weight: ${vs.weight} kg\n`;
    if (vs.height) prompt += `- Height: ${vs.height} cm\n`;
    prompt += "\n";
  }
  
  if (visitData.symptoms && visitData.symptoms.length > 0) {
    prompt += `Symptoms: ${visitData.symptoms.join(", ")}\n\n`;
  }
  
  if (visitData.physicalExam) {
    prompt += "Physical Examination:\n";
    const pe = visitData.physicalExam;
    if (pe.general) prompt += `- General: ${pe.general}\n`;
    if (pe.heent) prompt += `- HEENT: ${pe.heent}\n`;
    if (pe.cardiovascular) prompt += `- Cardiovascular: ${pe.cardiovascular}\n`;
    if (pe.respiratory) prompt += `- Respiratory: ${pe.respiratory}\n`;
    if (pe.abdominal) prompt += `- Abdominal: ${pe.abdominal}\n`;
    if (pe.musculoskeletal) prompt += `- Musculoskeletal: ${pe.musculoskeletal}\n`;
    if (pe.neurological) prompt += `- Neurological: ${pe.neurological}\n`;
    if (pe.skin) prompt += `- Skin: ${pe.skin}\n`;
    prompt += "\n";
  }
  
  if (visitData.diagnoses && visitData.diagnoses.length > 0) {
    prompt += `Known Diagnoses: ${visitData.diagnoses.join(", ")}\n\n`;
  }
  
  if (visitData.medications && visitData.medications.length > 0) {
    prompt += "Current Medications:\n";
    visitData.medications.forEach(med => {
      prompt += `- ${med.name}`;
      if (med.dose) prompt += ` ${med.dose}`;
      if (med.frequency) prompt += ` ${med.frequency}`;
      prompt += "\n";
    });
    prompt += "\n";
  }
  
  if (visitData.allergies && visitData.allergies.length > 0) {
    prompt += `Allergies: ${visitData.allergies.join(", ")}\n\n`;
  }
  
  if (visitData.labResults && visitData.labResults.length > 0) {
    prompt += "Lab Results:\n";
    visitData.labResults.forEach(lab => {
      prompt += `- ${lab.test}: ${lab.value}`;
      if (lab.unit) prompt += ` ${lab.unit}`;
      if (lab.referenceRange) prompt += ` (Ref: ${lab.referenceRange})`;
      if (lab.flag && lab.flag !== "normal") prompt += ` [${lab.flag.toUpperCase()}]`;
      prompt += "\n";
    });
    prompt += "\n";
  }
  
  if (visitData.imagingResults && visitData.imagingResults.length > 0) {
    prompt += "Imaging Results:\n";
    visitData.imagingResults.forEach(img => {
      prompt += `- ${img.study}: ${img.findings}`;
      if (img.impression) prompt += ` Impression: ${img.impression}`;
      prompt += "\n";
    });
    prompt += "\n";
  }
  
  if (visitData.assessmentPlan) {
    prompt += `Assessment/Plan Notes: ${visitData.assessmentPlan}\n\n`;
  }
  
  if (visitData.followUp) {
    prompt += `Follow-up: ${visitData.followUp}\n\n`;
  }
  
  prompt += `\nGenerate the note in JSON format with these fields:
{
  "subjective": "Patient's reported symptoms and history",
  "objective": "Physical exam findings, vital signs, and test results",
  "assessment": "Clinical assessment/diagnoses",
  "plan": "Treatment plan and follow-up",
  "fullNote": "Complete narrative note if not SOAP format"
}`;
  
  return prompt;
}

function generateFallbackNote(visitData: VisitData, noteType: string, noteId: string): GeneratedNote {
  const note: GeneratedNote = {
    id: noteId,
    patientId: visitData.patientId,
    visitDate: visitData.visitDate,
    noteType: noteType as any,
    content: {
      subjective: `Patient ${visitData.patientName} presents with chief complaint of ${visitData.chiefComplaint}. ${visitData.symptoms ? `Associated symptoms include: ${visitData.symptoms.join(", ")}.` : ""}`,
      objective: buildObjectiveFromData(visitData),
      assessment: visitData.diagnoses ? visitData.diagnoses.join("; ") : "Assessment pending clinician review.",
      plan: visitData.assessmentPlan || "Plan to be determined by treating clinician.",
      fullNote: ""
    },
    suggestedCodes: getFallbackCodes(visitData),
    generatedAt: new Date().toISOString(),
    status: "draft",
    disclaimer: NO_CDS_DISCLAIMER
  };
  
  generatedNotes.set(noteId, note);
  return note;
}

function buildObjectiveFromData(visitData: VisitData): string {
  let objective = "";
  
  if (visitData.vitalSigns) {
    const vs = visitData.vitalSigns;
    const parts = [];
    if (vs.bloodPressure) parts.push(`BP ${vs.bloodPressure}`);
    if (vs.heartRate) parts.push(`HR ${vs.heartRate}`);
    if (vs.temperature) parts.push(`Temp ${vs.temperature}°F`);
    if (vs.respiratoryRate) parts.push(`RR ${vs.respiratoryRate}`);
    if (vs.oxygenSaturation) parts.push(`SpO2 ${vs.oxygenSaturation}%`);
    objective += `Vital Signs: ${parts.join(", ")}. `;
  }
  
  if (visitData.physicalExam) {
    const pe = visitData.physicalExam;
    if (pe.general) objective += `General: ${pe.general}. `;
  }
  
  if (visitData.labResults && visitData.labResults.length > 0) {
    objective += "Labs: ";
    objective += visitData.labResults.map(l => 
      `${l.test} ${l.value}${l.unit ? ` ${l.unit}` : ""}${l.flag === "abnormal" || l.flag === "critical" ? " *" : ""}`
    ).join(", ");
    objective += ". ";
  }
  
  return objective || "Physical examination and objective findings to be documented.";
}

function getFallbackCodes(visitData: VisitData): CodeSuggestion[] {
  const codes: CodeSuggestion[] = [];
  
  codes.push({
    type: "CPT",
    code: "99213",
    description: "Office or other outpatient visit, established patient, low complexity",
    confidence: "low",
    rationale: "Default E/M code for established patient visit - requires verification based on actual documentation"
  });
  
  if (visitData.chiefComplaint.toLowerCase().includes("headache")) {
    codes.push({
      type: "ICD-10",
      code: "R51.9",
      description: "Headache, unspecified",
      confidence: "low",
      rationale: "Chief complaint mentions headache - specific type requires clinical determination"
    });
  }
  
  return codes;
}

export async function suggestCodes(
  visitData: VisitData,
  noteContent?: any
): Promise<CodeSuggestion[]> {
  const prompt = buildCodePrompt(visitData, noteContent);
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a medical coding assistant that suggests appropriate ICD-10 and CPT codes based on clinical documentation.
Your role is to identify potential codes for clinician review - NOT to make final coding decisions.
Always include a rationale explaining why each code might apply.
Provide confidence levels: high (clear documentation support), medium (some documentation support), low (inferred or possible).
IMPORTANT: All code suggestions require professional coder and clinician verification before billing use.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const result = JSON.parse(response.choices[0]?.message?.content || "{}");
    
    if (result.codes && Array.isArray(result.codes)) {
      return result.codes.map((code: any) => ({
        type: code.type || "ICD-10",
        code: code.code || "",
        description: code.description || "",
        confidence: code.confidence || "low",
        rationale: code.rationale || "AI-suggested code requires verification",
        relatedDocumentation: code.relatedDocumentation
      }));
    }
    
    return getFallbackCodes(visitData);
  } catch (error) {
    console.error("[AIClinicalDocumentation] Error suggesting codes:", error);
    return getFallbackCodes(visitData);
  }
}

function buildCodePrompt(visitData: VisitData, noteContent?: any): string {
  let prompt = "Based on the following clinical documentation, suggest appropriate ICD-10 diagnosis codes and CPT procedure codes:\n\n";
  
  prompt += `Visit Type: ${visitData.visitType}\n`;
  prompt += `Chief Complaint: ${visitData.chiefComplaint}\n`;
  
  if (visitData.diagnoses && visitData.diagnoses.length > 0) {
    prompt += `Documented Diagnoses: ${visitData.diagnoses.join(", ")}\n`;
  }
  
  if (visitData.procedures && visitData.procedures.length > 0) {
    prompt += `Procedures Performed: ${visitData.procedures.join(", ")}\n`;
  }
  
  if (noteContent) {
    if (noteContent.assessment) {
      prompt += `\nClinical Assessment:\n${noteContent.assessment}\n`;
    }
    if (noteContent.plan) {
      prompt += `\nTreatment Plan:\n${noteContent.plan}\n`;
    }
  }
  
  if (visitData.labResults && visitData.labResults.length > 0) {
    const abnormalLabs = visitData.labResults.filter(l => l.flag === "abnormal" || l.flag === "critical");
    if (abnormalLabs.length > 0) {
      prompt += `\nAbnormal Lab Results:\n`;
      abnormalLabs.forEach(lab => {
        prompt += `- ${lab.test}: ${lab.value}${lab.unit ? ` ${lab.unit}` : ""} [${lab.flag}]\n`;
      });
    }
  }
  
  prompt += `\nProvide suggested codes in JSON format:
{
  "codes": [
    {
      "type": "ICD-10 or CPT",
      "code": "code value",
      "description": "code description",
      "confidence": "high/medium/low",
      "rationale": "why this code applies based on documentation",
      "relatedDocumentation": "specific text from documentation supporting this code"
    }
  ]
}`;
  
  return prompt;
}

export async function generateLabSummaryNote(labSummary: LabSummary): Promise<GeneratedNote> {
  const noteId = `note-lab-${Date.now()}`;
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a clinical documentation assistant that summarizes laboratory results.
Create clear, professional summaries of lab results highlighting abnormal findings.
IMPORTANT: Do NOT interpret results or suggest diagnoses - only summarize and flag abnormalities.
This is documentation assistance only and requires clinician review.`
        },
        {
          role: "user",
          content: `Summarize these lab results for patient ${labSummary.patientName} (Date: ${labSummary.labDate}):

${labSummary.results.map(r => 
  `${r.test}: ${r.value}${r.unit ? ` ${r.unit}` : ""}${r.referenceRange ? ` (Ref: ${r.referenceRange})` : ""}${r.flag ? ` [${r.flag}]` : ""}`
).join("\n")}

Provide a JSON response with:
{
  "summary": "Brief overview of results",
  "abnormalFindings": "List of abnormal results with values",
  "criticalFindings": "Any critical values requiring immediate attention",
  "normalFindings": "Summary of normal results"
}`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    const content = JSON.parse(response.choices[0]?.message?.content || "{}");
    
    const note: GeneratedNote = {
      id: noteId,
      patientId: labSummary.patientId,
      visitDate: labSummary.labDate,
      noteType: "progress",
      content: {
        fullNote: `LAB RESULTS SUMMARY - ${labSummary.labDate}\n\n${content.summary || ""}\n\nAbnormal Findings:\n${content.abnormalFindings || "None"}\n\nCritical Findings:\n${content.criticalFindings || "None"}\n\nNormal Results:\n${content.normalFindings || "All other results within normal limits"}`
      },
      suggestedCodes: [],
      generatedAt: new Date().toISOString(),
      status: "draft",
      disclaimer: NO_CDS_DISCLAIMER
    };
    
    generatedNotes.set(noteId, note);
    return note;
  } catch (error) {
    console.error("[AIClinicalDocumentation] Error generating lab summary:", error);
    
    const abnormal = labSummary.results.filter(r => r.flag === "abnormal" || r.flag === "critical");
    const critical = labSummary.results.filter(r => r.flag === "critical");
    
    const note: GeneratedNote = {
      id: noteId,
      patientId: labSummary.patientId,
      visitDate: labSummary.labDate,
      noteType: "progress",
      content: {
        fullNote: `LAB RESULTS SUMMARY - ${labSummary.labDate}\n\nTotal Results: ${labSummary.results.length}\n\nAbnormal Findings (${abnormal.length}):\n${abnormal.map(r => `- ${r.test}: ${r.value}`).join("\n") || "None"}\n\nCritical Values (${critical.length}):\n${critical.map(r => `- ${r.test}: ${r.value}`).join("\n") || "None"}`
      },
      suggestedCodes: [],
      generatedAt: new Date().toISOString(),
      status: "draft",
      disclaimer: NO_CDS_DISCLAIMER
    };
    
    generatedNotes.set(noteId, note);
    return note;
  }
}

export function getGeneratedNote(noteId: string): GeneratedNote | undefined {
  return generatedNotes.get(noteId);
}

export function getPatientNotes(patientId: string): GeneratedNote[] {
  return Array.from(generatedNotes.values()).filter(n => n.patientId === patientId);
}

export function getAllNotes(): GeneratedNote[] {
  return Array.from(generatedNotes.values());
}

export function updateNoteStatus(noteId: string, status: "draft" | "reviewed" | "finalized"): GeneratedNote | undefined {
  const note = generatedNotes.get(noteId);
  if (note) {
    note.status = status;
    generatedNotes.set(noteId, note);
  }
  return note;
}

export function updateNoteContent(
  noteId: string, 
  content: Partial<GeneratedNote["content"]>
): GeneratedNote | undefined {
  const note = generatedNotes.get(noteId);
  if (note) {
    note.content = { ...note.content, ...content };
    generatedNotes.set(noteId, note);
  }
  return note;
}

export function getCodeHistory(patientId: string): CodeSuggestion[] {
  return codeHistory.get(patientId) || [];
}

export function getCommonCodes(): { icd10: CodeSuggestion[]; cpt: CodeSuggestion[] } {
  return {
    icd10: [
      { type: "ICD-10", code: "J06.9", description: "Acute upper respiratory infection, unspecified", confidence: "high", rationale: "Common diagnosis for URI visits" },
      { type: "ICD-10", code: "I10", description: "Essential (primary) hypertension", confidence: "high", rationale: "Chronic condition, frequently documented" },
      { type: "ICD-10", code: "E11.9", description: "Type 2 diabetes mellitus without complications", confidence: "high", rationale: "Common chronic condition" },
      { type: "ICD-10", code: "M54.5", description: "Low back pain", confidence: "high", rationale: "Frequent chief complaint" },
      { type: "ICD-10", code: "J02.9", description: "Acute pharyngitis, unspecified", confidence: "high", rationale: "Common acute condition" }
    ],
    cpt: [
      { type: "CPT", code: "99213", description: "Office visit, established patient, low complexity", confidence: "high", rationale: "Most common E/M code for routine visits" },
      { type: "CPT", code: "99214", description: "Office visit, established patient, moderate complexity", confidence: "high", rationale: "E/M code for visits requiring moderate MDM" },
      { type: "CPT", code: "99203", description: "Office visit, new patient, low complexity", confidence: "high", rationale: "New patient visit with straightforward MDM" },
      { type: "CPT", code: "99204", description: "Office visit, new patient, moderate complexity", confidence: "high", rationale: "New patient visit with moderate MDM" },
      { type: "CPT", code: "36415", description: "Collection of venous blood by venipuncture", confidence: "high", rationale: "Common lab draw procedure" }
    ]
  };
}

console.log("[AIClinicalDocumentation] Service initialized with AI note generation and code suggestion capabilities");
