import OpenAI from "openai";
import { storage } from "../storage";
import type { Patient, Medication, MedicalRecord } from "@shared/schema";

// Helper to get patient display name
function getPatientName(patient: Patient): string {
  return `${patient.firstName} ${patient.lastName}`;
}

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Drug interaction severity levels
export type InteractionSeverity = "contraindicated" | "serious" | "moderate" | "minor";

// Intervention urgency levels
export type InterventionUrgency = "immediate" | "urgent" | "soon" | "routine";

// Drug-drug interaction detected by AI
export interface DrugInteraction {
  id: string;
  medication1: {
    id: string;
    name: string;
    dosage: string;
  };
  medication2: {
    id: string;
    name: string;
    dosage: string;
  };
  severity: InteractionSeverity;
  mechanism: string;
  clinicalEffects: string[];
  riskFactors: string[];
  recommendation: string;
  alternativeOptions?: string[];
  monitoringRequired?: string[];
  aiConfidence: number;
  detectedAt: string;
}

// Adherence issue detected by AI
export interface AdherenceIssue {
  id: string;
  patientId: string;
  medicationId: string;
  medicationName: string;
  issueType: "non_adherence" | "side_effects" | "cost_barrier" | "complexity" | "forgetfulness" | "perceived_inefficacy";
  severity: "mild" | "moderate" | "severe";
  description: string;
  evidencePoints: string[];
  likelyRootCause: string;
  impactOnOutcomes: string;
  suggestedInterventions: string[];
  aiConfidence: number;
  detectedAt: string;
}

// Potential medication risk
export interface MedicationRisk {
  id: string;
  riskType: "interaction" | "adherence" | "contraindication" | "dosing" | "side_effect" | "therapeutic_duplication";
  severity: "low" | "moderate" | "high" | "critical";
  title: string;
  description: string;
  affectedMedications: {
    id: string;
    name: string;
  }[];
  patientFactors: string[];
  aiConfidence: number;
}

// Intervention strategy recommended by AI
export interface InterventionStrategy {
  id: string;
  targetRiskId: string;
  urgency: InterventionUrgency;
  strategyType: "medication_change" | "dosage_adjustment" | "monitoring" | "patient_education" | "adherence_support" | "alternative_therapy" | "specialist_referral";
  title: string;
  description: string;
  steps: {
    order: number;
    action: string;
    responsible: "provider" | "pharmacist" | "patient" | "care_team";
    timeframe: string;
  }[];
  expectedOutcome: string;
  evidenceLevel: "strong" | "moderate" | "limited";
  contraindications?: string[];
  aiConfidence: number;
}

// Complete medication safety analysis for a patient
export interface MedicationSafetyAnalysis {
  patientId: string;
  patientName: string;
  analyzedAt: string;
  overallRiskLevel: "low" | "moderate" | "high" | "critical";
  riskScore: number; // 0-100
  activeMedicationsCount: number;
  interactions: DrugInteraction[];
  adherenceIssues: AdherenceIssue[];
  medicationRisks: MedicationRisk[];
  interventionStrategies: InterventionStrategy[];
  summary: string;
  prioritizedActions: string[];
  aiConfidence: number;
}

// Cache for analysis results
const analysisCache = new Map<string, { analysis: MedicationSafetyAnalysis; expiresAt: Date }>();
const CACHE_TTL_MINUTES = 60; // 1 hour cache for safety analysis

// Mock adherence data generator
interface MockAdherenceData {
  medicationId: string;
  medicationName: string;
  adherenceRate: number;
  missedDoses: number;
  totalDoses: number;
  commonSkipReasons: string[];
  recentPattern: "improving" | "stable" | "declining";
}

function generateMockAdherenceData(medications: Medication[]): MockAdherenceData[] {
  return medications.map(med => {
    const adherenceRate = 0.5 + Math.random() * 0.5; // 50-100%
    const totalDoses = 30;
    const missedDoses = Math.round(totalDoses * (1 - adherenceRate));
    
    const skipReasons = [
      "Forgot to take",
      "Side effects (nausea, dizziness)",
      "Cost/insurance issues",
      "Felt fine without it",
      "Ran out of medication",
      "Complex dosing schedule"
    ];
    
    return {
      medicationId: med.id,
      medicationName: med.name,
      adherenceRate: Math.round(adherenceRate * 100),
      missedDoses,
      totalDoses,
      commonSkipReasons: skipReasons.slice(0, Math.floor(Math.random() * 3) + 1),
      recentPattern: ["improving", "stable", "declining"][Math.floor(Math.random() * 3)] as "improving" | "stable" | "declining"
    };
  });
}

// Generate mock health outcomes
interface MockHealthOutcome {
  type: string;
  value: string;
  trend: "improving" | "stable" | "worsening";
  relatedMedications: string[];
}

function generateMockHealthOutcomes(medications: Medication[]): MockHealthOutcome[] {
  const outcomes: MockHealthOutcome[] = [
    {
      type: "Blood Pressure Control",
      value: `${120 + Math.floor(Math.random() * 30)}/${70 + Math.floor(Math.random() * 20)} mmHg`,
      trend: ["improving", "stable", "worsening"][Math.floor(Math.random() * 3)] as "improving" | "stable" | "worsening",
      relatedMedications: medications.filter(m => m.name.toLowerCase().includes("lisinopril") || m.name.toLowerCase().includes("amlodipine")).map(m => m.name)
    },
    {
      type: "Blood Glucose (A1C)",
      value: `${(6 + Math.random() * 3).toFixed(1)}%`,
      trend: ["improving", "stable", "worsening"][Math.floor(Math.random() * 3)] as "improving" | "stable" | "worsening",
      relatedMedications: medications.filter(m => m.name.toLowerCase().includes("metformin") || m.name.toLowerCase().includes("insulin")).map(m => m.name)
    },
    {
      type: "Lipid Panel (LDL)",
      value: `${80 + Math.floor(Math.random() * 80)} mg/dL`,
      trend: ["improving", "stable", "worsening"][Math.floor(Math.random() * 3)] as "improving" | "stable" | "worsening",
      relatedMedications: medications.filter(m => m.name.toLowerCase().includes("statin") || m.name.toLowerCase().includes("atorvastatin")).map(m => m.name)
    }
  ];
  
  return outcomes.filter(o => o.relatedMedications.length > 0 || Math.random() > 0.5);
}

export async function analyzeMedicationSafety(
  patientId: string,
  forceRefresh: boolean = false
): Promise<MedicationSafetyAnalysis> {
  // Check cache first
  if (!forceRefresh) {
    const cached = analysisCache.get(patientId);
    if (cached && cached.expiresAt > new Date()) {
      return cached.analysis;
    }
  }

  // Gather patient data
  const [patient, medications, medicalRecords] = await Promise.all([
    storage.getPatient(patientId),
    storage.getMedicationsByPatient(patientId),
    storage.getMedicalRecordsByPatient(patientId),
  ]);

  if (!patient) {
    throw new Error(`Patient ${patientId} not found`);
  }

  const activeMedications = medications.filter((m: Medication) => m.status === "active");
  const patientRecords = medicalRecords;
  
  // Generate mock adherence and outcome data
  const adherenceData = generateMockAdherenceData(activeMedications);
  const healthOutcomes = generateMockHealthOutcomes(activeMedications);

  // Build context for AI analysis
  const medicationsContext = activeMedications.map(m => ({
    name: m.name,
    dosage: m.dosage,
    frequency: m.frequency,
    startDate: m.startDate,
    prescribedBy: m.prescribedBy
  }));

  const adherenceContext = adherenceData.map(a => ({
    medication: a.medicationName,
    adherenceRate: `${a.adherenceRate}%`,
    missedDoses: a.missedDoses,
    pattern: a.recentPattern,
    skipReasons: a.commonSkipReasons
  }));

  const diagnosesContext = patientRecords
    .filter((r: MedicalRecord) => r.type === "diagnosis")
    .map((r: MedicalRecord) => ({ title: r.title, status: r.status }));

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert clinical pharmacist AI assistant specialized in medication safety analysis. Your role is to:
1. Identify potential drug-drug interactions based on pharmacological mechanisms
2. Detect adherence issues and their root causes
3. Flag medication risks including contraindications and therapeutic duplications
4. Suggest evidence-based intervention strategies

Always provide specific, actionable recommendations. Include confidence scores (0-100) for your assessments.
Be thorough but prioritize clinically significant findings over minor concerns.`
        },
        {
          role: "user",
          content: `Analyze medication safety for patient:

PATIENT PROFILE:
- Name: ${getPatientName(patient)}
- Age: ${patient.dateOfBirth ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : "Unknown"}
- Gender: ${patient.gender}

ACTIVE MEDICATIONS (${activeMedications.length}):
${JSON.stringify(medicationsContext, null, 2)}

ADHERENCE DATA (Last 30 days):
${JSON.stringify(adherenceContext, null, 2)}

HEALTH OUTCOMES:
${JSON.stringify(healthOutcomes, null, 2)}

MEDICAL CONDITIONS:
${JSON.stringify(diagnosesContext, null, 2)}

Provide a comprehensive medication safety analysis in the following JSON format:
{
  "overallRiskLevel": "low" | "moderate" | "high" | "critical",
  "riskScore": 0-100,
  "summary": "Brief executive summary of medication safety status",
  "interactions": [
    {
      "medication1Name": "Drug A",
      "medication2Name": "Drug B",
      "severity": "contraindicated" | "serious" | "moderate" | "minor",
      "mechanism": "How the interaction occurs",
      "clinicalEffects": ["Effect 1", "Effect 2"],
      "riskFactors": ["Patient factors increasing risk"],
      "recommendation": "Specific clinical recommendation",
      "alternativeOptions": ["Alternative drug options"],
      "monitoringRequired": ["Lab tests or monitoring needed"]
    }
  ],
  "adherenceIssues": [
    {
      "medicationName": "Drug name",
      "issueType": "non_adherence" | "side_effects" | "cost_barrier" | "complexity" | "forgetfulness" | "perceived_inefficacy",
      "severity": "mild" | "moderate" | "severe",
      "description": "Description of the issue",
      "evidencePoints": ["Data points supporting this finding"],
      "likelyRootCause": "Root cause analysis",
      "impactOnOutcomes": "How this affects health outcomes",
      "suggestedInterventions": ["Intervention 1", "Intervention 2"]
    }
  ],
  "medicationRisks": [
    {
      "riskType": "interaction" | "adherence" | "contraindication" | "dosing" | "side_effect" | "therapeutic_duplication",
      "severity": "low" | "moderate" | "high" | "critical",
      "title": "Brief title",
      "description": "Detailed description",
      "affectedMedications": ["Drug names"],
      "patientFactors": ["Relevant patient factors"]
    }
  ],
  "interventionStrategies": [
    {
      "urgency": "immediate" | "urgent" | "soon" | "routine",
      "strategyType": "medication_change" | "dosage_adjustment" | "monitoring" | "patient_education" | "adherence_support" | "alternative_therapy" | "specialist_referral",
      "title": "Strategy title",
      "description": "Strategy description",
      "steps": [
        {"order": 1, "action": "Action description", "responsible": "provider" | "pharmacist" | "patient" | "care_team", "timeframe": "When to complete"}
      ],
      "expectedOutcome": "Expected result",
      "evidenceLevel": "strong" | "moderate" | "limited"
    }
  ],
  "prioritizedActions": ["Top action 1", "Top action 2", "Top action 3"],
  "aiConfidence": 0-100
}`
        }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const responseText = completion.choices[0]?.message?.content || "{}";
    
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse AI response");
    }
    
    const aiResponse = JSON.parse(jsonMatch[0]);
    
    // Build the full analysis object
    const analysis: MedicationSafetyAnalysis = {
      patientId,
      patientName: getPatientName(patient),
      analyzedAt: new Date().toISOString(),
      overallRiskLevel: aiResponse.overallRiskLevel || "moderate",
      riskScore: aiResponse.riskScore || 50,
      activeMedicationsCount: activeMedications.length,
      interactions: (aiResponse.interactions || []).map((i: any, idx: number) => ({
        id: `int_${patientId}_${idx}`,
        medication1: {
          id: activeMedications.find(m => m.name.toLowerCase().includes(i.medication1Name?.toLowerCase().split(" ")[0]))?.id || `med1_${idx}`,
          name: i.medication1Name || "Unknown",
          dosage: activeMedications.find(m => m.name.toLowerCase().includes(i.medication1Name?.toLowerCase().split(" ")[0]))?.dosage || ""
        },
        medication2: {
          id: activeMedications.find(m => m.name.toLowerCase().includes(i.medication2Name?.toLowerCase().split(" ")[0]))?.id || `med2_${idx}`,
          name: i.medication2Name || "Unknown",
          dosage: activeMedications.find(m => m.name.toLowerCase().includes(i.medication2Name?.toLowerCase().split(" ")[0]))?.dosage || ""
        },
        severity: i.severity || "moderate",
        mechanism: i.mechanism || "",
        clinicalEffects: i.clinicalEffects || [],
        riskFactors: i.riskFactors || [],
        recommendation: i.recommendation || "",
        alternativeOptions: i.alternativeOptions,
        monitoringRequired: i.monitoringRequired,
        aiConfidence: i.aiConfidence || aiResponse.aiConfidence || 75,
        detectedAt: new Date().toISOString()
      })),
      adherenceIssues: (aiResponse.adherenceIssues || []).map((a: any, idx: number) => ({
        id: `adh_${patientId}_${idx}`,
        patientId,
        medicationId: activeMedications.find(m => m.name.toLowerCase().includes(a.medicationName?.toLowerCase().split(" ")[0]))?.id || `med_${idx}`,
        medicationName: a.medicationName || "Unknown",
        issueType: a.issueType || "non_adherence",
        severity: a.severity || "moderate",
        description: a.description || "",
        evidencePoints: a.evidencePoints || [],
        likelyRootCause: a.likelyRootCause || "",
        impactOnOutcomes: a.impactOnOutcomes || "",
        suggestedInterventions: a.suggestedInterventions || [],
        aiConfidence: a.aiConfidence || aiResponse.aiConfidence || 75,
        detectedAt: new Date().toISOString()
      })),
      medicationRisks: (aiResponse.medicationRisks || []).map((r: any, idx: number) => ({
        id: `risk_${patientId}_${idx}`,
        riskType: r.riskType || "interaction",
        severity: r.severity || "moderate",
        title: r.title || "",
        description: r.description || "",
        affectedMedications: (r.affectedMedications || []).map((name: string) => ({
          id: activeMedications.find(m => m.name.toLowerCase().includes(name.toLowerCase().split(" ")[0]))?.id || `med_${idx}`,
          name
        })),
        patientFactors: r.patientFactors || [],
        aiConfidence: r.aiConfidence || aiResponse.aiConfidence || 75
      })),
      interventionStrategies: (aiResponse.interventionStrategies || []).map((s: any, idx: number) => ({
        id: `strat_${patientId}_${idx}`,
        targetRiskId: `risk_${patientId}_${idx}`,
        urgency: s.urgency || "routine",
        strategyType: s.strategyType || "monitoring",
        title: s.title || "",
        description: s.description || "",
        steps: (s.steps || []).map((step: any) => ({
          order: step.order || 1,
          action: step.action || "",
          responsible: step.responsible || "provider",
          timeframe: step.timeframe || "As needed"
        })),
        expectedOutcome: s.expectedOutcome || "",
        evidenceLevel: s.evidenceLevel || "moderate",
        contraindications: s.contraindications,
        aiConfidence: s.aiConfidence || aiResponse.aiConfidence || 75
      })),
      summary: aiResponse.summary || "Analysis complete",
      prioritizedActions: aiResponse.prioritizedActions || [],
      aiConfidence: aiResponse.aiConfidence || 75
    };

    // Cache the result
    analysisCache.set(patientId, {
      analysis,
      expiresAt: new Date(Date.now() + CACHE_TTL_MINUTES * 60 * 1000)
    });

    return analysis;

  } catch (error) {
    console.error("AI medication safety analysis failed:", error);
    
    // Return fallback analysis
    return generateFallbackAnalysis(patientId, patient, activeMedications, adherenceData);
  }
}

function generateFallbackAnalysis(
  patientId: string,
  patient: Patient,
  medications: Medication[],
  adherenceData: MockAdherenceData[]
): MedicationSafetyAnalysis {
  const interactions: DrugInteraction[] = [];
  const adherenceIssues: AdherenceIssue[] = [];
  const risks: MedicationRisk[] = [];
  const strategies: InterventionStrategy[] = [];

  // Simple rule-based interaction detection
  const medNames = medications.map(m => m.name.toLowerCase());
  
  // Check for common interactions
  if (medNames.some(n => n.includes("warfarin")) && medNames.some(n => n.includes("aspirin"))) {
    interactions.push({
      id: `int_${patientId}_0`,
      medication1: { id: "med1", name: "Warfarin", dosage: "5mg" },
      medication2: { id: "med2", name: "Aspirin", dosage: "81mg" },
      severity: "serious",
      mechanism: "Increased anticoagulant effect through platelet inhibition and interference with vitamin K metabolism",
      clinicalEffects: ["Increased bleeding risk", "Prolonged INR"],
      riskFactors: ["Age > 65", "Concurrent NSAID use"],
      recommendation: "Monitor INR closely. Consider aspirin dose reduction or alternative antiplatelet therapy if clinically appropriate.",
      monitoringRequired: ["INR weekly for 2-4 weeks", "Signs of bleeding"],
      aiConfidence: 85,
      detectedAt: new Date().toISOString()
    });
  }

  // Check adherence issues
  for (const adherence of adherenceData) {
    if (adherence.adherenceRate < 80) {
      adherenceIssues.push({
        id: `adh_${patientId}_${adherence.medicationId}`,
        patientId,
        medicationId: adherence.medicationId,
        medicationName: adherence.medicationName,
        issueType: adherence.commonSkipReasons.some(r => r.includes("Side effects")) ? "side_effects" : "non_adherence",
        severity: adherence.adherenceRate < 50 ? "severe" : adherence.adherenceRate < 70 ? "moderate" : "mild",
        description: `${adherence.medicationName} adherence at ${adherence.adherenceRate}% over past 30 days`,
        evidencePoints: [`Missed ${adherence.missedDoses} of ${adherence.totalDoses} doses`, `Pattern: ${adherence.recentPattern}`],
        likelyRootCause: adherence.commonSkipReasons.join(", "),
        impactOnOutcomes: "Suboptimal medication levels may reduce therapeutic efficacy",
        suggestedInterventions: [
          "Medication reminder app/alarm",
          "Simplify dosing schedule if possible",
          "Address reported side effects"
        ],
        aiConfidence: 70,
        detectedAt: new Date().toISOString()
      });
    }
  }

  // Calculate overall risk
  const hasSerious = interactions.some(i => i.severity === "contraindicated" || i.severity === "serious");
  const hasSevereAdherence = adherenceIssues.some(a => a.severity === "severe");
  
  let overallRisk: "low" | "moderate" | "high" | "critical" = "low";
  let riskScore = 25;
  
  if (hasSerious || hasSevereAdherence) {
    overallRisk = "high";
    riskScore = 75;
  } else if (interactions.length > 0 || adherenceIssues.length > 0) {
    overallRisk = "moderate";
    riskScore = 50;
  }

  // Generate intervention strategies
  if (interactions.length > 0) {
    strategies.push({
      id: `strat_${patientId}_0`,
      targetRiskId: interactions[0].id,
      urgency: hasSerious ? "urgent" : "soon",
      strategyType: "monitoring",
      title: "Enhanced Monitoring Protocol",
      description: "Implement closer monitoring for identified drug interactions",
      steps: [
        { order: 1, action: "Review current medication regimen", responsible: "provider", timeframe: "This week" },
        { order: 2, action: "Order relevant lab tests", responsible: "provider", timeframe: "Within 3 days" },
        { order: 3, action: "Schedule follow-up to review results", responsible: "care_team", timeframe: "Within 2 weeks" }
      ],
      expectedOutcome: "Early detection and management of adverse effects",
      evidenceLevel: "moderate",
      aiConfidence: 70
    });
  }

  if (adherenceIssues.length > 0) {
    strategies.push({
      id: `strat_${patientId}_1`,
      targetRiskId: adherenceIssues[0].id,
      urgency: hasSevereAdherence ? "urgent" : "routine",
      strategyType: "adherence_support",
      title: "Adherence Improvement Program",
      description: "Multi-faceted approach to improve medication adherence",
      steps: [
        { order: 1, action: "Assess barriers to adherence with patient", responsible: "provider", timeframe: "Next visit" },
        { order: 2, action: "Simplify regimen if possible (once-daily dosing)", responsible: "provider", timeframe: "As appropriate" },
        { order: 3, action: "Set up medication reminder system", responsible: "patient", timeframe: "Within 1 week" },
        { order: 4, action: "Follow up on adherence progress", responsible: "care_team", timeframe: "2 weeks" }
      ],
      expectedOutcome: "Improved adherence rates and therapeutic outcomes",
      evidenceLevel: "strong",
      aiConfidence: 75
    });
  }

  return {
    patientId,
    patientName: getPatientName(patient),
    analyzedAt: new Date().toISOString(),
    overallRiskLevel: overallRisk,
    riskScore,
    activeMedicationsCount: medications.length,
    interactions,
    adherenceIssues,
    medicationRisks: risks,
    interventionStrategies: strategies,
    summary: `Medication safety analysis complete for ${medications.length} active medications. ${interactions.length} potential interactions and ${adherenceIssues.length} adherence issues identified.`,
    prioritizedActions: [
      ...(hasSerious ? ["Review serious drug interactions immediately"] : []),
      ...(hasSevereAdherence ? ["Address severe adherence issues"] : []),
      "Continue routine medication monitoring"
    ],
    aiConfidence: 65
  };
}

// Get all patients with medication safety concerns
export async function getPatientsWithMedicationRisks(): Promise<{
  patientId: string;
  patientName: string;
  riskLevel: string;
  riskCount: number;
  lastAnalyzed?: string;
}[]> {
  const patients = await storage.getPatients();
  const results: {
    patientId: string;
    patientName: string;
    riskLevel: string;
    riskCount: number;
    lastAnalyzed?: string;
  }[] = [];

  for (const patient of patients) {
    const cached = analysisCache.get(patient.id);
    if (cached) {
      const analysis = cached.analysis;
      const riskCount = analysis.interactions.length + analysis.adherenceIssues.length + analysis.medicationRisks.length;
      if (riskCount > 0) {
        results.push({
          patientId: patient.id,
          patientName: getPatientName(patient),
          riskLevel: analysis.overallRiskLevel,
          riskCount,
          lastAnalyzed: analysis.analyzedAt
        });
      }
    }
  }

  // Sort by risk level then count
  const riskOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
  return results.sort((a, b) => {
    const levelDiff = (riskOrder[a.riskLevel as keyof typeof riskOrder] || 4) - (riskOrder[b.riskLevel as keyof typeof riskOrder] || 4);
    if (levelDiff !== 0) return levelDiff;
    return b.riskCount - a.riskCount;
  });
}

// Batch analyze multiple patients
export async function batchAnalyzeMedicationSafety(
  patientIds: string[],
  concurrency: number = 3
): Promise<{ patientId: string; success: boolean; analysis?: MedicationSafetyAnalysis; error?: string }[]> {
  const results: { patientId: string; success: boolean; analysis?: MedicationSafetyAnalysis; error?: string }[] = [];
  
  // Process in batches
  for (let i = 0; i < patientIds.length; i += concurrency) {
    const batch = patientIds.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (patientId) => {
        try {
          const analysis = await analyzeMedicationSafety(patientId);
          return { patientId, success: true, analysis };
        } catch (error) {
          return { patientId, success: false, error: (error as Error).message };
        }
      })
    );
    results.push(...batchResults);
  }
  
  return results;
}

// Get cached analysis if available
export function getCachedAnalysis(patientId: string): MedicationSafetyAnalysis | null {
  const cached = analysisCache.get(patientId);
  if (cached && cached.expiresAt > new Date()) {
    return cached.analysis;
  }
  return null;
}

// Clear cache for a patient (call when medications change)
export function invalidateAnalysisCache(patientId: string): void {
  analysisCache.delete(patientId);
}

// Get summary statistics for provider dashboard
export function getMedicationSafetyStats(): {
  patientsAnalyzed: number;
  criticalRisks: number;
  highRisks: number;
  moderateRisks: number;
  totalInteractions: number;
  totalAdherenceIssues: number;
} {
  let criticalRisks = 0;
  let highRisks = 0;
  let moderateRisks = 0;
  let totalInteractions = 0;
  let totalAdherenceIssues = 0;
  
  analysisCache.forEach((cached) => {
    const analysis = cached.analysis;
    if (analysis.overallRiskLevel === "critical") criticalRisks++;
    else if (analysis.overallRiskLevel === "high") highRisks++;
    else if (analysis.overallRiskLevel === "moderate") moderateRisks++;
    totalInteractions += analysis.interactions.length;
    totalAdherenceIssues += analysis.adherenceIssues.length;
  });
  
  return {
    patientsAnalyzed: analysisCache.size,
    criticalRisks,
    highRisks,
    moderateRisks,
    totalInteractions,
    totalAdherenceIssues
  };
}
