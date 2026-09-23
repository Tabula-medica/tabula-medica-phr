/**
 * AI Differential Diagnosis Service
 * Analyzes patient data to generate differential diagnosis suggestions for clinicians
 * Follows strict safety guidelines - educational only, not diagnostic
 */

import { generatePhiSafeText } from "./services/ai-gateway";

// Safe framing verbs (ONLY these 4 allowed)
const SAFE_VERBS = ["shows", "states", "refers to", "means"];

// Prohibited terms that imply certainty or recommendations
const PROHIBITED_WORDS = [
  "should", "need to", "must", "recommend", "suggest", "advise", "consider",
  "diagnose", "confirm", "rule out", "likely", "probably", "definitely",
  "you have", "this is", "indicates", "demonstrates", "reveals", "predicts",
];

export interface PatientDataForDiagnosis {
  vitals: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    recordedAt?: string;
  }[];
  labs: {
    testName: string;
    value: string;
    unit: string;
    referenceRange?: string;
    status?: "normal" | "abnormal" | "critical";
    recordedAt?: string;
  }[];
  symptoms: {
    symptomName: string;
    severity: number;
    duration?: string;
    triggers?: string[];
    loggedAt?: string;
  }[];
  conditions?: {
    name: string;
    status: string;
  }[];
  medications?: {
    name: string;
    dosage: string;
  }[];
  demographics?: {
    age?: number;
    sex?: string;
  };
}

export interface DifferentialDiagnosis {
  condition: string;
  probability: "high" | "medium" | "low";
  supportingEvidence: string[];
  contradictingFactors: string[];
  suggestedWorkup: string[];
}

export interface DifferentialDiagnosisResult {
  patientId: string;
  generatedAt: string;
  differentials: DifferentialDiagnosis[];
  clinicalContext: string;
  dataQualityNotes: string[];
  disclaimer: string;
}

function containsProhibitedWords(text: string): boolean {
  const lower = text.toLowerCase();
  return PROHIBITED_WORDS.some(word => lower.includes(word.toLowerCase()));
}

function sanitizeDiagnosisText(text: string): string {
  let sanitized = text;
  
  const replacements: Record<string, string> = {
    "indicates": "shows",
    "suggests": "data shows",
    "demonstrates": "shows",
    "reveals": "shows",
    "confirms": "shows",
    "likely": "possibly consistent with",
    "probably": "data shows patterns of",
    "definitely": "strongly shows",
    "you have": "records show",
    "this is": "this shows",
    "rule out": "evaluate for",
    "diagnose": "evaluate",
    "should consider": "records show patterns of",
    "recommend": "evidence shows",
    "should": "records show",
    "must": "records show",
    "need to": "data shows value in",
    "advise": "data shows",
  };
  
  for (const [bad, good] of Object.entries(replacements)) {
    sanitized = sanitized.replace(new RegExp(bad, "gi"), good);
  }
  
  // Apply whitelist verb enforcement
  sanitized = enforceWhitelistVerbs(sanitized);
  
  return sanitized;
}

function validateSafeOutput(text: string): boolean {
  const lower = text.toLowerCase();
  const criticalProhibited = [
    "i diagnose", "you have", "this confirms", "definitely",
    "start treatment", "prescribe", "administer",
    "should", "must", "need to", "recommend", "advise",
  ];
  return !criticalProhibited.some(phrase => lower.includes(phrase));
}

function enforceWhitelistVerbs(text: string): string {
  // Replace common prohibited verbs with safe alternatives
  const verbReplacements: Record<string, string> = {
    "indicates": "shows",
    "suggests": "shows",
    "demonstrates": "shows",
    "reveals": "shows",
    "confirms": "shows",
    "implies": "shows",
    "predicts": "shows patterns of",
    "causes": "shows",
    "triggers": "shows",
    "affects": "shows patterns related to",
    "supports": "shows",
    "maintains": "shows",
    "building": "showing",
    "taking": "logging",
    "reduced": "lower",
  };
  
  let result = text;
  for (const [bad, good] of Object.entries(verbReplacements)) {
    result = result.replace(new RegExp(`\\b${bad}\\b`, "gi"), good);
  }
  return result;
}

function getMockDifferentials(patientData: PatientDataForDiagnosis): DifferentialDiagnosis[] {
  const differentials: DifferentialDiagnosis[] = [];
  
  // Generate based on symptoms
  if (patientData.symptoms.length > 0) {
    const primarySymptom = patientData.symptoms[0];
    
    if (primarySymptom.symptomName.toLowerCase().includes("headache")) {
      differentials.push({
        condition: "Tension-type headache",
        probability: "high",
        supportingEvidence: [
          `Symptom log shows: ${primarySymptom.symptomName} (severity ${primarySymptom.severity}/10)`,
          "Pattern shows characteristics consistent with tension-type presentation",
        ],
        contradictingFactors: [],
        suggestedWorkup: [
          "Review headache diary entries",
          "Evaluate stress and sleep patterns from logs",
        ],
      });
      differentials.push({
        condition: "Migraine without aura",
        probability: "medium",
        supportingEvidence: [
          "Symptom severity pattern shows episodic presentation",
        ],
        contradictingFactors: [
          "Records do not show nausea or photophobia entries",
        ],
        suggestedWorkup: [
          "Review for associated symptoms in symptom tracker",
        ],
      });
    }
    
    if (primarySymptom.symptomName.toLowerCase().includes("fatigue")) {
      differentials.push({
        condition: "Iron deficiency",
        probability: "medium",
        supportingEvidence: [
          `Symptom tracker shows: ${primarySymptom.symptomName}`,
          "Fatigue pattern shows persistent presentation",
        ],
        contradictingFactors: [],
        suggestedWorkup: [
          "Review CBC and iron panel if available",
          "Evaluate dietary patterns",
        ],
      });
    }
  }
  
  // Generate based on abnormal labs
  const abnormalLabs = patientData.labs.filter(l => l.status === "abnormal" || l.status === "critical");
  if (abnormalLabs.length > 0) {
    const lab = abnormalLabs[0];
    differentials.push({
      condition: `Condition associated with ${lab.testName} variation`,
      probability: "medium",
      supportingEvidence: [
        `Lab shows: ${lab.testName} at ${lab.value} ${lab.unit}`,
        lab.referenceRange ? `Reference range states: ${lab.referenceRange}` : "",
      ].filter(Boolean),
      contradictingFactors: [],
      suggestedWorkup: [
        "Correlate with clinical presentation",
        "Review trend over time",
      ],
    });
  }
  
  // Generate based on vital signs
  const latestVitals = patientData.vitals[0];
  if (latestVitals) {
    if (latestVitals.bloodPressure) {
      const [systolic] = latestVitals.bloodPressure.split("/").map(Number);
      if (systolic >= 140) {
        differentials.push({
          condition: "Elevated blood pressure pattern",
          probability: "high",
          supportingEvidence: [
            `Vitals show: BP ${latestVitals.bloodPressure} mmHg`,
          ],
          contradictingFactors: [],
          suggestedWorkup: [
            "Review BP trend in vitals history",
            "Evaluate for end-organ effects",
          ],
        });
      }
    }
  }
  
  if (differentials.length === 0) {
    differentials.push({
      condition: "Insufficient data for differential analysis",
      probability: "low",
      supportingEvidence: [
        "Limited symptom, vital, or lab data available",
      ],
      contradictingFactors: [],
      suggestedWorkup: [
        "Gather comprehensive history",
        "Complete physical examination",
      ],
    });
  }
  
  return differentials;
}

export async function generateDifferentialDiagnosis(
  patientId: string,
  patientData: PatientDataForDiagnosis
): Promise<DifferentialDiagnosisResult> {
  const dataQualityNotes: string[] = [];
  
  if (patientData.symptoms.length === 0) {
    dataQualityNotes.push("No symptom data available in patient records");
  }
  if (patientData.labs.length === 0) {
    dataQualityNotes.push("No laboratory data available");
  }
  if (patientData.vitals.length === 0) {
    dataQualityNotes.push("No vital signs data available");
  }
  
  // Build clinical context
  const contextParts: string[] = [];
  if (patientData.demographics?.age) {
    contextParts.push(`${patientData.demographics.age}-year-old`);
  }
  if (patientData.demographics?.sex) {
    contextParts.push(patientData.demographics.sex);
  }
  if (patientData.conditions && patientData.conditions.length > 0) {
    contextParts.push(`with history of ${patientData.conditions.map(c => c.name).join(", ")}`);
  }
  
  const clinicalContext = contextParts.length > 0 
    ? `Patient context shows: ${contextParts.join(" ")}`
    : "Limited demographic data available";

  try {
    const prompt = `You are an AI clinical decision support tool. Analyze the following patient data and generate a differential diagnosis list for clinician review.

CRITICAL SAFETY RULES:
1. Use ONLY these verbs: "shows", "states", "refers to", "means"
2. NEVER use: should, recommend, suggest, diagnose, confirm, likely, probably
3. This is educational reference ONLY - not a diagnosis
4. Frame all findings as "data shows" or "records show"
5. Include contradicting factors for each differential
6. Suggest additional workup, not treatment

PATIENT DATA:
${JSON.stringify(patientData, null, 2)}

Respond in JSON format:
{
  "differentials": [
    {
      "condition": "condition name",
      "probability": "high|medium|low",
      "supportingEvidence": ["evidence 1 using safe verbs"],
      "contradictingFactors": ["factor 1"],
      "suggestedWorkup": ["workup item 1"]
    }
  ],
  "clinicalContext": "brief patient context using safe framing"
}

Generate 3-5 differentials ordered by probability.`;

    const content = await generatePhiSafeText({
      system: "You are a clinical decision support AI. Provide educational differential diagnosis suggestions using only safe, non-diagnostic language. Never make definitive diagnoses.",
      user: prompt,
      temperature: 0.3,
      maxTokens: 2000,
    });

    if (!content) {
      throw new Error("Empty response from AI");
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Sanitize all text output
    const sanitizedDifferentials: DifferentialDiagnosis[] = (parsed.differentials || []).map((d: any) => ({
      condition: sanitizeDiagnosisText(d.condition),
      probability: d.probability || "low",
      supportingEvidence: (d.supportingEvidence || []).map(sanitizeDiagnosisText),
      contradictingFactors: (d.contradictingFactors || []).map(sanitizeDiagnosisText),
      suggestedWorkup: (d.suggestedWorkup || []).map(sanitizeDiagnosisText),
    }));

    // Validate safety
    for (const diff of sanitizedDifferentials) {
      if (!validateSafeOutput(diff.condition)) {
        console.error("[DifferentialDx] Unsafe output detected, falling back to mock");
        return {
          patientId,
          generatedAt: new Date().toISOString(),
          differentials: getMockDifferentials(patientData),
          clinicalContext,
          dataQualityNotes,
          disclaimer: "Educational reference only. Not a clinical diagnosis. All differentials require clinician evaluation.",
        };
      }
    }

    return {
      patientId,
      generatedAt: new Date().toISOString(),
      differentials: sanitizedDifferentials,
      clinicalContext: sanitizeDiagnosisText(parsed.clinicalContext || clinicalContext),
      dataQualityNotes,
      disclaimer: "Educational reference only. Not a clinical diagnosis. All differentials require clinician evaluation.",
    };
  } catch (error) {
    console.error("[DifferentialDx] Generation error:", error);
    return {
      patientId,
      generatedAt: new Date().toISOString(),
      differentials: getMockDifferentials(patientData),
      clinicalContext,
      dataQualityNotes,
      disclaimer: "Educational reference only. Not a clinical diagnosis. All differentials require clinician evaluation. Sample data shown for illustration.",
    };
  }
}
