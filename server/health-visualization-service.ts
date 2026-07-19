/**
import { baaChatFetch, isAiConfigured } from "./lib/baa-chat";
 * Health Visualization Service
 * 
 * Analyzes trends from symptoms, medication adherence, and lab results.
 * Generates AI-powered insights framed as "observations your clinician might find useful."
 * 
 * SAFETY GUIDELINES:
 * - ONLY use safe verbs: "shows", "states", "refers to", "means"
 * - NO clinical recommendations, diagnosis, or risk scoring
 * - Quote-first approach when referencing data
 * - Disclaimer: "Informational only. Not medical advice."
 */

export interface SymptomDataPoint {
  date: string;
  symptomName: string;
  severity: number; // 1-10 scale
}

export interface MedicationAdherencePoint {
  date: string;
  medicationName: string;
  taken: boolean;
  adherenceRate: number; // percentage
}

export interface LabResultPoint {
  date: string;
  testName: string;
  value: number;
  unit: string;
  referenceMin?: number;
  referenceMax?: number;
}

export interface TrendInsight {
  category: "symptom" | "medication" | "lab";
  title: string;
  observation: string;
  dataReference: string;
  source: string;
  questionForClinician: string;
}

export interface HealthVisualizationData {
  symptomTrends: SymptomDataPoint[];
  medicationAdherence: MedicationAdherencePoint[];
  labTrends: LabResultPoint[];
  insights: TrendInsight[];
  disclaimer: string;
  generatedAt: string;
}

const SAFE_VERBS = ["shows", "states", "refers to", "means"];
const PROHIBITED_WORDS = [
  "should", "must", "need to", "recommend", "suggest", "advise", "consider",
  "may cause", "could indicate", "might be related", "risk of", "continue",
  "follow up", "monitor", "review", "coordinate", "prepare", "decide",
  "help", "supports", "works by affecting", "commonly prescribed",
  "well controlled", "performed", "ordered", "assess", "take", "stop",
  "start", "increase", "decrease", "requires", "immediately", "urgent",
  "dangerous", "severe", "critical",
];

function validateInsight(insight: any): TrendInsight | null {
  if (!insight.category || !insight.title || !insight.observation || 
      !insight.dataReference || !insight.source) {
    return null;
  }
  
  const obsLower = insight.observation.toLowerCase();
  
  for (const word of PROHIBITED_WORDS) {
    if (obsLower.includes(word)) {
      console.warn(`[HealthViz] Filtered prohibited word: "${word}"`);
      return null;
    }
  }
  
  const hasSafeVerb = SAFE_VERBS.some(verb => obsLower.includes(verb));
  if (!hasSafeVerb) {
    console.warn(`[HealthViz] Missing safe verb in: "${insight.observation}"`);
    return null;
  }
  
  return {
    category: insight.category,
    title: String(insight.title).slice(0, 100),
    observation: String(insight.observation).slice(0, 300),
    dataReference: String(insight.dataReference).slice(0, 200),
    source: String(insight.source).slice(0, 100),
    questionForClinician: insight.questionForClinician || "What does this trend show about my health?",
  };
}

const TREND_ANALYSIS_PROMPT = `You analyze health data trends and generate observations for patients to discuss with their clinicians.

ONLY USE THESE 4 VERBS: "shows", "states", "refers to", "means"

NEVER USE:
- "should", "must", "need to", "recommend", "suggest", "advise"
- Clinical interpretation, diagnosis, or risk assessment
- Treatment suggestions or medication advice
- Any actionable medical guidance

FRAME ALL INSIGHTS AS:
"The data shows..." or "Your records show..." or "This trend refers to..."

OUTPUT FORMAT (JSON array):
[
  {
    "category": "symptom|medication|lab",
    "title": "Brief title",
    "observation": "The data shows [factual observation using safe verbs]",
    "dataReference": "Specific data point being referenced",
    "source": "Data source and date range",
    "questionForClinician": "A question the patient could ask their clinician"
  }
]

End each insight with framing: "Observation your clinician might find useful."`;

export async function getHealthVisualizationData(patientId: string): Promise<HealthVisualizationData> {
  const symptomTrends = getMockSymptomTrends();
  const medicationAdherence = getMockMedicationAdherence();
  const labTrends = getMockLabTrends();
  
  const insights = await generateTrendInsights(symptomTrends, medicationAdherence, labTrends);
  
  return {
    symptomTrends,
    medicationAdherence,
    labTrends,
    insights,
    disclaimer: "Informational only. Not medical advice.",
    generatedAt: new Date().toISOString(),
  };
}

async function generateTrendInsights(
  symptoms: SymptomDataPoint[],
  medications: MedicationAdherencePoint[],
  labs: LabResultPoint[]
): Promise<TrendInsight[]> {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  if (!isAiConfigured()) {
    return getMockInsights();
  }

  try {
    const response = await baaChatFetch({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: TREND_ANALYSIS_PROMPT },
          {
            role: "user",
            content: `Analyze these health data trends and generate 3-5 observations:

SYMPTOM DATA (last 30 days):
${symptoms.map(s => `${s.date}: ${s.symptomName} severity ${s.severity}/10`).join("\n")}

MEDICATION ADHERENCE:
${medications.map(m => `${m.date}: ${m.medicationName} - ${m.taken ? "Taken" : "Missed"} (${m.adherenceRate}% overall)`).join("\n")}

LAB RESULTS:
${labs.map(l => `${l.date}: ${l.testName} = ${l.value} ${l.unit}${l.referenceMin ? ` (ref: ${l.referenceMin}-${l.referenceMax})` : ""}`).join("\n")}

Generate observations using only safe verbs. Frame as "observations your clinician might find useful."`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      console.error("[HealthViz] API error:", response.status);
      return getMockInsights();
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const validatedInsights: TrendInsight[] = [];
      
      for (const insight of parsed) {
        const validated = validateInsight(insight);
        if (validated) {
          validatedInsights.push(validated);
        }
      }
      
      if (validatedInsights.length === 0) {
        return getMockInsights();
      }
      
      return validatedInsights;
    }

    return getMockInsights();
  } catch (error) {
    console.error("[HealthViz] Error:", error);
    return getMockInsights();
  }
}

function getMockSymptomTrends(): SymptomDataPoint[] {
  const now = Date.now();
  const day = 86400000;
  
  return [
    { date: new Date(now - 30 * day).toISOString().split("T")[0], symptomName: "Fatigue", severity: 7 },
    { date: new Date(now - 25 * day).toISOString().split("T")[0], symptomName: "Fatigue", severity: 6 },
    { date: new Date(now - 20 * day).toISOString().split("T")[0], symptomName: "Fatigue", severity: 5 },
    { date: new Date(now - 15 * day).toISOString().split("T")[0], symptomName: "Fatigue", severity: 4 },
    { date: new Date(now - 10 * day).toISOString().split("T")[0], symptomName: "Fatigue", severity: 4 },
    { date: new Date(now - 5 * day).toISOString().split("T")[0], symptomName: "Fatigue", severity: 3 },
    { date: new Date(now - 30 * day).toISOString().split("T")[0], symptomName: "Headache", severity: 4 },
    { date: new Date(now - 20 * day).toISOString().split("T")[0], symptomName: "Headache", severity: 3 },
    { date: new Date(now - 10 * day).toISOString().split("T")[0], symptomName: "Headache", severity: 5 },
    { date: new Date(now - 5 * day).toISOString().split("T")[0], symptomName: "Headache", severity: 2 },
  ];
}

function getMockMedicationAdherence(): MedicationAdherencePoint[] {
  const now = Date.now();
  const day = 86400000;
  
  const data: MedicationAdherencePoint[] = [];
  
  for (let i = 30; i >= 0; i -= 5) {
    data.push({
      date: new Date(now - i * day).toISOString().split("T")[0],
      medicationName: "Metformin",
      taken: Math.random() > 0.15,
      adherenceRate: 85 + Math.floor(Math.random() * 10),
    });
    data.push({
      date: new Date(now - i * day).toISOString().split("T")[0],
      medicationName: "Lisinopril",
      taken: Math.random() > 0.1,
      adherenceRate: 90 + Math.floor(Math.random() * 8),
    });
  }
  
  return data;
}

function getMockLabTrends(): LabResultPoint[] {
  const now = Date.now();
  const month = 30 * 86400000;
  
  return [
    { date: new Date(now - 6 * month).toISOString().split("T")[0], testName: "HbA1c", value: 8.2, unit: "%", referenceMin: 4.0, referenceMax: 5.6 },
    { date: new Date(now - 3 * month).toISOString().split("T")[0], testName: "HbA1c", value: 7.8, unit: "%", referenceMin: 4.0, referenceMax: 5.6 },
    { date: new Date(now - 1 * month).toISOString().split("T")[0], testName: "HbA1c", value: 7.2, unit: "%", referenceMin: 4.0, referenceMax: 5.6 },
    { date: new Date(now - 6 * month).toISOString().split("T")[0], testName: "Fasting Glucose", value: 165, unit: "mg/dL", referenceMin: 70, referenceMax: 99 },
    { date: new Date(now - 3 * month).toISOString().split("T")[0], testName: "Fasting Glucose", value: 152, unit: "mg/dL", referenceMin: 70, referenceMax: 99 },
    { date: new Date(now - 1 * month).toISOString().split("T")[0], testName: "Fasting Glucose", value: 142, unit: "mg/dL", referenceMin: 70, referenceMax: 99 },
    { date: new Date(now - 6 * month).toISOString().split("T")[0], testName: "LDL Cholesterol", value: 145, unit: "mg/dL", referenceMin: 0, referenceMax: 100 },
    { date: new Date(now - 3 * month).toISOString().split("T")[0], testName: "LDL Cholesterol", value: 132, unit: "mg/dL", referenceMin: 0, referenceMax: 100 },
    { date: new Date(now - 1 * month).toISOString().split("T")[0], testName: "LDL Cholesterol", value: 118, unit: "mg/dL", referenceMin: 0, referenceMax: 100 },
  ];
}

function getMockInsights(): TrendInsight[] {
  return [
    {
      category: "symptom",
      title: "Fatigue Trend",
      observation: "The symptom log shows fatigue severity values of 7, 6, 5, 4, 4, and 3 over 30 days. This data refers to your logged entries. Observation your clinician might find useful.",
      dataReference: "Fatigue: 7 → 6 → 5 → 4 → 4 → 3",
      source: "Symptom Tracker, last 30 days",
      questionForClinician: "What does this fatigue trend show about my condition?",
    },
    {
      category: "medication",
      title: "Medication Adherence Pattern",
      observation: "Your medication log shows adherence rates of 85-95% for Metformin and Lisinopril. This refers to recorded doses over the past month. Observation your clinician might find useful.",
      dataReference: "Metformin ~87%, Lisinopril ~92%",
      source: "Medication Tracker, last 30 days",
      questionForClinician: "What does my adherence pattern show that we could discuss?",
    },
    {
      category: "lab",
      title: "HbA1c Trend",
      observation: "Lab records show HbA1c values of 8.2%, 7.8%, and 7.2% over 6 months. This data refers to measured values over time. Observation your clinician might find useful.",
      dataReference: "HbA1c: 8.2% → 7.8% → 7.2%",
      source: "Lab Results, 6 months",
      questionForClinician: "What does this HbA1c trend mean for my diabetes management?",
    },
    {
      category: "lab",
      title: "Fasting Glucose Pattern",
      observation: "The lab data shows fasting glucose values of 165, 152, and 142 mg/dL. This refers to measurements over 6 months. Observation your clinician might find useful.",
      dataReference: "Glucose: 165 → 152 → 142 mg/dL",
      source: "Lab Results, 6 months",
      questionForClinician: "What does this glucose trend show about my blood sugar levels?",
    },
    {
      category: "lab",
      title: "Cholesterol Observations",
      observation: "Records show LDL cholesterol values of 145, 132, and 118 mg/dL over 6 months. This data refers to your lab results. Observation your clinician might find useful.",
      dataReference: "LDL: 145 → 132 → 118 mg/dL",
      source: "Lab Results, 6 months",
      questionForClinician: "What does my cholesterol trend show that I could discuss with you?",
    },
  ];
}
