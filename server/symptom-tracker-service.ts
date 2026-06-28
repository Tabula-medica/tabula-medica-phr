/**
 * Symptom Tracker Service
 * 
 * Allows patients to log symptoms and provides AI-powered contextual insights
 * by correlating symptoms with existing conditions, medications, and lab results.
 * 
 * SAFETY GUIDELINES:
 * - ONLY use safe verbs: "shows", "states", "refers to", "means"
 * - NO symptom checking, triage, risk scoring, or diagnosis predictions
 * - NO medication interaction advice or clinical recommendations
 * - Quote-first approach with source attribution from patient records
 * - Disclaimer: "Informational only. Not medical advice."
 */

// CDS-GATED — getSymptomInsights and getSymptomPeriodSummary perform Clinical Decision Support:
// AI symptom interpretation that correlates patient-logged symptoms with their conditions,
// medications, and labs, and generates interpretive symptom-trend summaries. DISABLED by default
// via the ENABLE_CDS kill-switch pending FDA Non-Device CDS determination (21st Century Cures Act
// §3060) + counsel review. NOT a NO-CDS claim. Plain symptom logging and log retrieval are not
// CDS and remain ungated.
// See services/_cds-gate.ts, NO-CDS-TRIAGE.md, ventures/tabula-medica/PHR-CDS-COUNSEL-BRIEF.md.
import { assertCdsEnabled } from "./services/_cds-gate";

export interface SymptomTrigger {
  type: "diet" | "activity" | "environment" | "stress" | "sleep" | "other";
  description: string;
}

export interface SymptomLog {
  id: string;
  patientId: string;
  symptomName: string;
  severity: "mild" | "moderate" | "severe";
  duration: string;
  notes?: string;
  triggers?: SymptomTrigger[];
  loggedAt: string;
}

export interface RecordCorrelation {
  type: "condition" | "medication" | "lab_result";
  name: string;
  quote: string;
  source: string;
  observation: string;
}

export interface MedicationSideEffectPattern {
  medicationName: string;
  knownSideEffects: string[];
  patternObservation: string;
  source: string;
}

export interface TriggerPattern {
  triggerType: string;
  frequency: number;
  observation: string;
}

export interface SymptomInsight {
  symptomId: string;
  symptomName: string;
  correlations: RecordCorrelation[];
  medicationPatterns: MedicationSideEffectPattern[];
  triggerPatterns: TriggerPattern[];
  questionsForClinician: string[];
  disclaimer: string;
}

export interface SymptomPeriodSummary {
  periodStart: string;
  periodEnd: string;
  totalSymptoms: number;
  mostFrequent: Array<{ symptom: string; count: number }>;
  severityBreakdown: { mild: number; moderate: number; severe: number };
  keyChanges: string[];
  persistentIssues: string[];
  triggerSummary: TriggerPattern[];
  medicationCorrelations: string[];
  aiSummary: string;
  disclaimer: string;
}

const SYMPTOM_CORRELATION_PROMPT = `You correlate patient-logged symptoms with their existing health records.

ONLY USE THESE 4 VERBS: "shows", "states", "refers to", "means"

PROHIBITED - NEVER USE:
- "should", "must", "need to", "recommend", "suggest", "advise"
- "may cause", "could indicate", "might be related to", "risk of"
- Clinical interpretation, diagnosis predictions, triage, or recommendations
- Medication interaction advice or side effect warnings
- Any actionable guidance

SAFE FRAMING EXAMPLES:
- "Your records show a diagnosis of [condition]."
- "The record states [medication] is listed."
- "This refers to [lab result] from [date]."

REQUIRED 3-PART STRUCTURE (QUOTE-FIRST RULE):
1. Quote: Exact text from patient records with source attribution
2. Observation: Factual statement using safe verbs (what records show)
3. Questions: What patient can ask their clinician about this symptom

OUTPUT FORMAT:
{
  "correlations": [
    {
      "type": "condition|medication|lab_result",
      "name": "Name from records",
      "quote": "Exact quote from patient record",
      "source": "Source and date of record",
      "observation": "This record shows... / The record states..."
    }
  ],
  "questionsForClinician": [
    "What does this symptom mean in my case?",
    "Is this something I can discuss with my care team?"
  ]
}

End with: "Informational only. Not medical advice."`;

// In-memory storage for logged symptoms
const symptomStorage: SymptomLog[] = [];

export async function logSymptom(
  patientId: string,
  symptomData: Omit<SymptomLog, "id" | "patientId" | "loggedAt">
): Promise<SymptomLog> {
  const symptom: SymptomLog = {
    id: `symptom-${Date.now()}`,
    patientId,
    symptomName: symptomData.symptomName,
    severity: symptomData.severity,
    duration: symptomData.duration,
    notes: symptomData.notes,
    triggers: symptomData.triggers,
    loggedAt: new Date().toISOString(),
  };

  symptomStorage.push(symptom);
  return symptom;
}

export async function getSymptomLogs(patientId: string): Promise<SymptomLog[]> {
  // Return user-logged symptoms plus mock data for sample
  const userLogs = symptomStorage.filter(s => s.patientId === patientId);
  const mockLogs = getMockSymptomLogs(patientId);
  return [...userLogs, ...mockLogs];
}

const SAFE_VERBS = ["shows", "states", "refers to", "means"];
const PROHIBITED_WORDS = [
  "should", "must", "need to", "recommend", "suggest", "advise", "consider",
  "may cause", "could indicate", "might be related", "risk of", "continue",
  "follow up", "monitor", "review", "coordinate", "prepare", "decide",
  "help", "supports", "works by affecting", "commonly prescribed", "well controlled",
  "performed", "ordered", "assess", "take", "stop", "start", "increase", "decrease",
  "requires", "immediately", "urgent", "dangerous", "severe", "critical",
];

function validateCorrelation(corr: any): RecordCorrelation | null {
  if (!corr.type || !corr.name || !corr.quote || !corr.source || !corr.observation) {
    return null;
  }
  if (!["condition", "medication", "lab_result"].includes(corr.type)) {
    return null;
  }
  const obsLower = corr.observation.toLowerCase();
  for (const word of PROHIBITED_WORDS) {
    if (obsLower.includes(word)) {
      console.warn(`[SymptomTracker] Filtered prohibited word: "${word}" in "${corr.observation}"`);
      return null;
    }
  }
  const hasSafeVerb = SAFE_VERBS.some(verb => obsLower.includes(verb));
  if (!hasSafeVerb) {
    console.warn(`[SymptomTracker] Missing safe verb in: "${corr.observation}"`);
    return null;
  }
  return {
    type: corr.type,
    name: String(corr.name).slice(0, 200),
    quote: String(corr.quote).slice(0, 500),
    source: String(corr.source).slice(0, 200),
    observation: String(corr.observation).slice(0, 500),
  };
}

function sanitizeQuestions(questions: any[]): string[] {
  if (!Array.isArray(questions)) return [];
  return questions
    .filter((q): q is string => typeof q === "string")
    .map(q => q.slice(0, 200))
    .filter(q => {
      const lower = q.toLowerCase();
      for (const word of PROHIBITED_WORDS) {
        if (lower.includes(word)) return false;
      }
      return true;
    })
    .slice(0, 5);
}

export async function getSymptomInsights(
  patientId: string,
  symptomId: string,
  symptomName: string,
  patientRecords: {
    conditions: Array<{ name: string; quote: string; source: string }>;
    medications: Array<{ name: string; quote: string; source: string }>;
    labResults: Array<{ name: string; value: string; quote: string; source: string }>;
  }
): Promise<SymptomInsight> {
  assertCdsEnabled("symptom-tracker:insights");
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";

  if (!apiKey) {
    return getMockSymptomInsight(symptomId, symptomName);
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: SYMPTOM_CORRELATION_PROMPT,
          },
          {
            role: "user",
            content: `The patient logged this symptom: "${symptomName}"

Their health records show:

CONDITIONS:
${patientRecords.conditions.map(c => `- ${c.name}: "${c.quote}" (${c.source})`).join("\n") || "No conditions on record"}

MEDICATIONS:
${patientRecords.medications.map(m => `- ${m.name}: "${m.quote}" (${m.source})`).join("\n") || "No medications on record"}

LAB RESULTS:
${patientRecords.labResults.map(l => `- ${l.name}: ${l.value} "${l.quote}" (${l.source})`).join("\n") || "No lab results on record"}

Correlate this symptom with the patient's records using only safe verbs and quote-first format. Do NOT provide medical advice, diagnosis, or recommendations.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      console.error("[SymptomTracker] API error:", response.status);
      return getMockSymptomInsight(symptomId, symptomName);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      const validatedCorrelations: RecordCorrelation[] = [];
      if (Array.isArray(parsed.correlations)) {
        for (const corr of parsed.correlations) {
          const validated = validateCorrelation(corr);
          if (validated) {
            validatedCorrelations.push(validated);
          }
        }
      }
      
      const sanitizedQuestions = sanitizeQuestions(parsed.questionsForClinician);
      
      if (validatedCorrelations.length === 0) {
        console.warn("[SymptomTracker] All AI correlations failed validation, using mock");
        return getMockSymptomInsight(symptomId, symptomName);
      }
      
      // Include medication patterns and trigger patterns even when using AI API
      const mockLogs = getMockSymptomLogs("mock");
      const relevantLogs = mockLogs.filter(s => s.symptomName === symptomName);

      return {
        symptomId,
        symptomName,
        correlations: validatedCorrelations,
        medicationPatterns: getMockMedicationPatterns(symptomName),
        triggerPatterns: getMockTriggerPatterns(relevantLogs),
        questionsForClinician: sanitizedQuestions.length > 0 ? sanitizedQuestions : [
          "What does this symptom mean in my situation?",
          "Is there anything in my records I can discuss with you about this?",
        ],
        disclaimer: "Informational only. Not medical advice.",
      };
    }

    return getMockSymptomInsight(symptomId, symptomName);
  } catch (error) {
    console.error("[SymptomTracker] Error:", error);
    return getMockSymptomInsight(symptomId, symptomName);
  }
}

function getMockSymptomLogs(patientId: string): SymptomLog[] {
  return [
    {
      id: "symptom-1",
      patientId,
      symptomName: "Fatigue",
      severity: "moderate",
      duration: "2-3 days",
      notes: "Feeling tired in the afternoons",
      triggers: [
        { type: "sleep", description: "Less than 6 hours sleep" },
        { type: "stress", description: "Work deadline" },
      ],
      loggedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "symptom-2",
      patientId,
      symptomName: "Headache",
      severity: "mild",
      duration: "A few hours",
      notes: "After screen time",
      triggers: [
        { type: "activity", description: "Extended screen time" },
        { type: "environment", description: "Bright office lights" },
      ],
      loggedAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: "symptom-3",
      patientId,
      symptomName: "Increased thirst",
      severity: "mild",
      duration: "1 week",
      notes: "Drinking more water than usual",
      triggers: [
        { type: "diet", description: "High sodium meal" },
      ],
      loggedAt: new Date(Date.now() - 604800000).toISOString(),
    },
    {
      id: "symptom-4",
      patientId,
      symptomName: "Fatigue",
      severity: "mild",
      duration: "1 day",
      notes: "After heavy lunch",
      triggers: [
        { type: "diet", description: "Large carb-heavy meal" },
      ],
      loggedAt: new Date(Date.now() - 259200000).toISOString(),
    },
    {
      id: "symptom-5",
      patientId,
      symptomName: "Headache",
      severity: "moderate",
      duration: "A few hours",
      notes: "Morning headache",
      triggers: [
        { type: "sleep", description: "Poor sleep quality" },
        { type: "diet", description: "Missed morning coffee" },
      ],
      loggedAt: new Date(Date.now() - 432000000).toISOString(),
    },
  ];
}

function getMockMedicationPatterns(symptomName: string): MedicationSideEffectPattern[] {
  const patternsBySymptom: Record<string, MedicationSideEffectPattern[]> = {
    "Fatigue": [
      {
        medicationName: "Metformin",
        knownSideEffects: ["fatigue", "weakness", "drowsiness"],
        patternObservation: "Drug information shows fatigue refers to a listed side effect for Metformin.",
        source: "Medication Reference, FDA Label",
      },
      {
        medicationName: "Lisinopril",
        knownSideEffects: ["fatigue", "dizziness", "cough"],
        patternObservation: "Reference data shows fatigue means a commonly reported effect with ACE inhibitors.",
        source: "Medication Reference, Drug Database",
      },
    ],
    "Headache": [
      {
        medicationName: "Lisinopril",
        knownSideEffects: ["headache", "dizziness", "cough"],
        patternObservation: "Drug reference shows headache refers to a known effect for blood pressure medications.",
        source: "Medication Reference, FDA Label",
      },
    ],
    "Increased thirst": [
      {
        medicationName: "Metformin",
        knownSideEffects: ["increased thirst", "dry mouth"],
        patternObservation: "Reference data states increased thirst refers to effects noted with diabetes medications.",
        source: "Medication Reference, Drug Database",
      },
    ],
  };

  return patternsBySymptom[symptomName] || [];
}

function getMockTriggerPatterns(symptoms: SymptomLog[]): TriggerPattern[] {
  const triggerCounts: Record<string, { count: number; examples: string[] }> = {};
  
  for (const symptom of symptoms) {
    if (symptom.triggers) {
      for (const trigger of symptom.triggers) {
        if (!triggerCounts[trigger.type]) {
          triggerCounts[trigger.type] = { count: 0, examples: [] };
        }
        triggerCounts[trigger.type].count++;
        if (triggerCounts[trigger.type].examples.length < 3) {
          triggerCounts[trigger.type].examples.push(trigger.description);
        }
      }
    }
  }

  return Object.entries(triggerCounts).map(([type, data]) => ({
    triggerType: type,
    frequency: data.count,
    observation: `Logs show ${type} triggers appearing ${data.count} times. Examples refer to: ${data.examples.join(", ")}.`,
  }));
}

function getMockSymptomInsight(symptomId: string, symptomName: string): SymptomInsight {
  const correlationsBySymptom: Record<string, RecordCorrelation[]> = {
    "Fatigue": [
      {
        type: "condition",
        name: "Type 2 Diabetes Mellitus",
        quote: "Primary Diagnosis: Type 2 Diabetes Mellitus (E11.9)",
        source: "Discharge Summary, Jan 2024",
        observation: "Your records show a diagnosis of Type 2 Diabetes Mellitus.",
      },
      {
        type: "medication",
        name: "Metformin",
        quote: "Metformin 500mg tablet, 1 tablet by mouth twice daily",
        source: "Medication List, Jan 2024",
        observation: "The record states Metformin is on your medication list.",
      },
      {
        type: "lab_result",
        name: "Hemoglobin A1C",
        quote: "HbA1c: 7.2% (Reference: < 5.7%)",
        source: "Lab Results, Jan 2024",
        observation: "Lab records show an HbA1c value of 7.2%.",
      },
    ],
    "Headache": [
      {
        type: "condition",
        name: "Essential Hypertension",
        quote: "Secondary Diagnosis: Essential Hypertension (I10)",
        source: "Discharge Summary, Jan 2024",
        observation: "Your records show a diagnosis of Essential Hypertension.",
      },
      {
        type: "lab_result",
        name: "Blood Pressure",
        quote: "BP: 138/88 mmHg",
        source: "Vital Signs, Jan 2024",
        observation: "The record shows a blood pressure reading of 138/88 mmHg.",
      },
    ],
    "Increased thirst": [
      {
        type: "condition",
        name: "Type 2 Diabetes Mellitus",
        quote: "Primary Diagnosis: Type 2 Diabetes Mellitus (E11.9)",
        source: "Discharge Summary, Jan 2024",
        observation: "Your records show a diagnosis of Type 2 Diabetes Mellitus.",
      },
      {
        type: "lab_result",
        name: "Fasting Glucose",
        quote: "Fasting Glucose: 142 mg/dL (Reference: 70-99 mg/dL)",
        source: "Lab Results, Jan 2024",
        observation: "Lab records show a fasting glucose value of 142 mg/dL.",
      },
    ],
  };

  const defaultCorrelations: RecordCorrelation[] = [
    {
      type: "condition",
      name: "General Health",
      quote: "Patient demographics and health summary on file",
      source: "Patient Profile",
      observation: "Your health profile shows general information on record.",
    },
  ];

  const mockLogs = getMockSymptomLogs("mock");
  const relevantLogs = mockLogs.filter(s => s.symptomName === symptomName);

  return {
    symptomId,
    symptomName,
    correlations: correlationsBySymptom[symptomName] || defaultCorrelations,
    medicationPatterns: getMockMedicationPatterns(symptomName),
    triggerPatterns: getMockTriggerPatterns(relevantLogs),
    questionsForClinician: [
      `What does ${symptomName.toLowerCase()} mean in my case?`,
      "Are there related items in my records I can discuss with you?",
      "What information from my records is relevant to this symptom?",
      "Is this symptom listed as a side effect of any of my medications?",
    ],
    disclaimer: "Informational only. Not medical advice.",
  };
}

const PERIOD_SUMMARY_PROMPT = `You summarize symptom history for a selected period.

ONLY USE THESE 4 VERBS: "shows", "states", "refers to", "means"

NEVER:
- Make clinical interpretations or diagnoses
- Suggest treatments or medications
- Assess severity or urgency
- Provide actionable medical advice

FRAME ALL SUMMARIES AS:
"The log shows...", "Records state...", "This refers to...", "Data means..."

OUTPUT FORMAT (JSON):
{
  "keyChanges": ["Factual change observations using safe verbs"],
  "persistentIssues": ["Symptoms that appear repeatedly in logs"],
  "aiSummary": "Overall summary using only safe verbs, framing what records show"
}`;

export async function getSymptomPeriodSummary(
  patientId: string,
  periodDays: number
): Promise<SymptomPeriodSummary> {
  assertCdsEnabled("symptom-tracker:period-summary");
  const allSymptoms = getMockSymptomLogs(patientId);
  const cutoffDate = new Date(Date.now() - periodDays * 86400000);
  
  const periodSymptoms = allSymptoms.filter(s => new Date(s.loggedAt) >= cutoffDate);
  
  const symptomCounts: Record<string, number> = {};
  const severityCounts = { mild: 0, moderate: 0, severe: 0 };
  
  for (const symptom of periodSymptoms) {
    symptomCounts[symptom.symptomName] = (symptomCounts[symptom.symptomName] || 0) + 1;
    severityCounts[symptom.severity]++;
  }
  
  const mostFrequent = Object.entries(symptomCounts)
    .map(([symptom, count]) => ({ symptom, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  const triggerPatterns = getMockTriggerPatterns(periodSymptoms);
  
  const aiSummary = await generatePeriodSummary(periodSymptoms, periodDays);
  
  return {
    periodStart: cutoffDate.toISOString().split("T")[0],
    periodEnd: new Date().toISOString().split("T")[0],
    totalSymptoms: periodSymptoms.length,
    mostFrequent,
    severityBreakdown: severityCounts,
    keyChanges: aiSummary.keyChanges,
    persistentIssues: aiSummary.persistentIssues,
    triggerSummary: triggerPatterns,
    medicationCorrelations: [
      "Logs show fatigue entries correlating with Metformin in medication list.",
      "Records state headache entries appearing with Lisinopril on file.",
    ],
    aiSummary: aiSummary.summary,
    disclaimer: "Informational only. Not medical advice.",
  };
}

async function generatePeriodSummary(
  symptoms: SymptomLog[],
  periodDays: number
): Promise<{ keyChanges: string[]; persistentIssues: string[]; summary: string }> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1";

  const fallback = {
    keyChanges: [
      `Logs show ${symptoms.length} symptom entries over the past ${periodDays} days.`,
      "Records state severity levels ranging from mild to moderate.",
    ],
    persistentIssues: symptoms.length > 1 
      ? ["Fatigue entries show repeated occurrence in logs."]
      : [],
    summary: `The symptom log shows ${symptoms.length} entries over ${periodDays} days. This refers to patient-reported symptoms. Records state varying severity levels. Informational only. Not medical advice.`,
  };

  if (!apiKey) {
    return fallback;
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: PERIOD_SUMMARY_PROMPT },
          {
            role: "user",
            content: `Summarize this symptom history for the past ${periodDays} days:

SYMPTOMS LOGGED:
${symptoms.map(s => `- ${s.loggedAt.split("T")[0]}: ${s.symptomName} (${s.severity})${s.triggers?.length ? `, triggers: ${s.triggers.map(t => t.description).join(", ")}` : ""}${s.notes ? ` - "${s.notes}"` : ""}`).join("\n")}

Generate a factual summary using only safe verbs. Highlight key changes and persistent issues.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      const validatedChanges = (parsed.keyChanges || []).filter((c: string) => {
        const lower = c.toLowerCase();
        return SAFE_VERBS.some(v => lower.includes(v)) &&
               !PROHIBITED_WORDS.some(w => lower.includes(w));
      });
      
      const validatedIssues = (parsed.persistentIssues || []).filter((i: string) => {
        const lower = i.toLowerCase();
        return !PROHIBITED_WORDS.some(w => lower.includes(w));
      });
      
      let summary = parsed.aiSummary || fallback.summary;
      const summaryLower = summary.toLowerCase();
      if (!SAFE_VERBS.some(v => summaryLower.includes(v))) {
        summary = "Logs show: " + summary;
      }
      for (const word of PROHIBITED_WORDS) {
        if (summaryLower.includes(word)) {
          return fallback;
        }
      }
      
      return {
        keyChanges: validatedChanges.length > 0 ? validatedChanges : fallback.keyChanges,
        persistentIssues: validatedIssues.length > 0 ? validatedIssues : fallback.persistentIssues,
        summary: summary + " Informational only. Not medical advice.",
      };
    }

    return fallback;
  } catch (error) {
    console.error("[SymptomTracker] Period summary error:", error);
    return fallback;
  }
}
