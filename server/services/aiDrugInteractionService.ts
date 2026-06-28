// CDS-GATED — this service performs Clinical Decision Support (AI drug-interaction,
// therapeutic-duplication, and allergy-conflict analysis with risk scoring and
// provider alerts). DISABLED by default via the ENABLE_CDS kill-switch pending FDA
// Non-Device CDS determination + counsel review. NOT a NO-CDS claim.
// See _cds-gate.ts, NO-CDS-TRIAGE.md, ventures/tabula-medica/PHR-CDS-COUNSEL-BRIEF.md.
import OpenAI from "openai";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import { assertCdsEnabled } from "./_cds-gate";
import { logPhiAccess } from "../security/hipaa-audit";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const SAFE_VERBS = ["shows", "states", "refers to", "means"];

function enforceSafeVerbs(text: string): string {
  const unsafePatterns = [
    { pattern: /\b(you should|you must|you need to)\b/gi, replacement: "the records show" },
    { pattern: /\b(take|taking)\b/gi, replacement: "shows" },
    { pattern: /\b(stop|stopping|discontinue)\b/gi, replacement: "refers to" },
    { pattern: /\b(avoid|avoiding)\b/gi, replacement: "refers to caution with" },
    { pattern: /\b(start|starting|begin)\b/gi, replacement: "states" },
    { pattern: /\b(increase|increasing)\b/gi, replacement: "shows elevated" },
    { pattern: /\b(decrease|decreasing)\b/gi, replacement: "shows reduced" },
    { pattern: /\b(causes?|caused|causing)\b/gi, replacement: "shows association with" },
    { pattern: /\b(results? in)\b/gi, replacement: "shows" },
    { pattern: /\b(leads? to)\b/gi, replacement: "refers to" },
    { pattern: /\b(recommend|recommending|recommended)\b/gi, replacement: "states consideration for" },
    { pattern: /\b(advise|advising|advised)\b/gi, replacement: "states" },
    { pattern: /\b(suggest|suggesting|suggested)\b/gi, replacement: "shows" },
    { pattern: /\b(indicates?|indicating|indicated)\b/gi, replacement: "shows" },
    { pattern: /\b(requires?|requiring|required)\b/gi, replacement: "refers to" },
    { pattern: /\b(may cause)\b/gi, replacement: "shows potential for" },
    { pattern: /\b(can cause)\b/gi, replacement: "shows association with" },
    { pattern: /\b(will cause)\b/gi, replacement: "shows potential for" },
    { pattern: /\b(could lead to)\b/gi, replacement: "refers to" },
    { pattern: /\b(might result in)\b/gi, replacement: "shows potential for" },
  ];

  let result = text;
  for (const { pattern, replacement } of unsafePatterns) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export type InteractionSeverity = "contraindicated" | "major" | "moderate" | "minor";
export type InteractionType = "drug_drug" | "drug_allergy" | "drug_food" | "drug_condition" | "therapeutic_duplication";

export interface DrugInteraction {
  id: string;
  medication1: { name: string; dosage: string };
  medication2: { name: string; dosage?: string };
  type: InteractionType;
  severity: InteractionSeverity;
  mechanism: string;
  clinicalEffects: string[];
  riskFactors: string[];
  recommendation: string;
  alternativeOptions?: string[];
  monitoringRequired?: string[];
  aiConfidence: number;
  evidenceLevel: "high" | "moderate" | "low";
}

export interface DrugInteractionAnalysis {
  id: string;
  patientId: string;
  patientName: string;
  analyzedAt: string;
  medicationsAnalyzed: number;
  overallRiskLevel: "safe" | "low" | "moderate" | "high" | "critical";
  riskScore: number;
  interactions: DrugInteraction[];
  therapeuticDuplications: {
    drugClass: string;
    medications: string[];
    concern: string;
  }[];
  allergyConflicts: {
    medication: string;
    allergen: string;
    reaction: string;
    severity: string;
  }[];
  summary: string;
  prioritizedActions: string[];
  carePlanRecommendations: string[];
  providerAlerts: {
    alertType: "critical" | "warning" | "info";
    message: string;
    actionRequired: boolean;
  }[];
  aiConfidence: number;
}

export interface CarePlanInteractionCheck {
  carePlanId: string;
  patientId: string;
  checkResult: "clear" | "warning" | "critical";
  interactions: DrugInteraction[];
  recommendations: string[];
  checkedAt: string;
}

const interactionCache = new Map<string, { analysis: DrugInteractionAnalysis; expiresAt: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

export async function analyzeMedicationInteractions(
  patientId: string,
  options?: { includeProposed?: string; forceRefresh?: boolean; userId?: string; ipAddress?: string }
): Promise<DrugInteractionAnalysis> {
  assertCdsEnabled("aiDrugInteractionService.analyzeMedicationInteractions");
  logPhiAccess({
    action: "read",
    resourceType: "drug_interaction_analysis",
    resourceId: patientId,
    patientId,
    userId: options?.userId || "provider",
    details: "AI drug interaction analysis requested",
    ipAddress: options?.ipAddress || "internal",
  });

  const cacheKey = `${patientId}-${options?.includeProposed || ""}`;
  if (!options?.forceRefresh) {
    const cached = interactionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.analysis;
    }
  }

  const patient = await storage.getPatient(patientId);
  const medications = await storage.getMedicationsByPatient(patientId);
  const activeMedications = medications.filter((m) => m.status === "active");
  const allergies = await storage.getAllergiesByPatient(patientId);
  const conditionsList = await storage.getConditionsList();

  const patientName = patient ? `${patient.firstName} ${patient.lastName}` : "Unknown Patient";

  if (activeMedications.length === 0 && !options?.includeProposed) {
    const noMedsResult: DrugInteractionAnalysis = {
      id: randomUUID(),
      patientId,
      patientName,
      analyzedAt: new Date().toISOString(),
      medicationsAnalyzed: 0,
      overallRiskLevel: "safe",
      riskScore: 0,
      interactions: [],
      therapeuticDuplications: [],
      allergyConflicts: [],
      summary: "No active medications to analyze for interactions.",
      prioritizedActions: [],
      carePlanRecommendations: [],
      providerAlerts: [],
      aiConfidence: 1.0,
    };
    return noMedsResult;
  }

  const medicationList = activeMedications.map((m) => ({
    name: m.name,
    dosage: m.dosage,
    frequency: m.frequency,
    startDate: m.startDate,
  }));

  if (options?.includeProposed) {
    medicationList.push({
      name: options.includeProposed,
      dosage: "proposed",
      frequency: "TBD",
      startDate: new Date().toISOString(),
    });
  }

  const allergyList = allergies
    .filter((a) => a.status === "active")
    .map((a) => ({
      name: a.name,
      type: a.type,
      reaction: a.reaction,
      severity: a.severity,
    }));

  const conditionList = conditionsList;

  const prompt = `Analyze the following patient's medications for potential drug interactions, therapeutic duplications, and allergy conflicts.

PATIENT MEDICATIONS:
${medicationList.map((m) => `- ${m.name} (${m.dosage}, ${m.frequency})`).join("\n")}

KNOWN ALLERGIES:
${allergyList.length > 0 ? allergyList.map((a) => `- ${a.name}: ${a.reaction} (${a.severity})`).join("\n") : "None documented"}

ACTIVE CONDITIONS:
${conditionList.length > 0 ? conditionList.join(", ") : "None documented"}

Provide a comprehensive drug interaction analysis in JSON format:
{
  "overallRiskLevel": "safe|low|moderate|high|critical",
  "riskScore": 0-100,
  "interactions": [
    {
      "medication1": { "name": "Drug A", "dosage": "10mg" },
      "medication2": { "name": "Drug B", "dosage": "20mg" },
      "type": "drug_drug|drug_allergy|drug_food|drug_condition|therapeutic_duplication",
      "severity": "contraindicated|major|moderate|minor",
      "mechanism": "Brief mechanism of interaction",
      "clinicalEffects": ["Effect 1", "Effect 2"],
      "riskFactors": ["Risk factor 1"],
      "recommendation": "Clinical recommendation",
      "alternativeOptions": ["Alternative 1"],
      "monitoringRequired": ["Monitor X levels"],
      "aiConfidence": 0.0-1.0,
      "evidenceLevel": "high|moderate|low"
    }
  ],
  "therapeuticDuplications": [
    {
      "drugClass": "Class name",
      "medications": ["Med1", "Med2"],
      "concern": "Concern description"
    }
  ],
  "allergyConflicts": [
    {
      "medication": "Med name",
      "allergen": "Allergen",
      "reaction": "Expected reaction",
      "severity": "Severity level"
    }
  ],
  "summary": "2-3 sentence summary for clinicians",
  "prioritizedActions": ["Action 1", "Action 2"],
  "carePlanRecommendations": ["Recommendation for care plan"],
  "providerAlerts": [
    {
      "alertType": "critical|warning|info",
      "message": "Alert message",
      "actionRequired": true/false
    }
  ],
  "aiConfidence": 0.0-1.0
}

IMPORTANT:
- Use only descriptive language. Use verbs like "shows", "states", "refers to", "means".
- Do NOT provide medical advice or treatment recommendations.
- Flag contraindicated combinations as critical.
- Consider patient conditions when assessing risks.
- Provide concise, clinician-focused explanations.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a clinical pharmacology expert. Analyze medications for potential interactions and provide evidence-based assessments. Respond in valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from AI");
    }

    const parsed = JSON.parse(content);

    const analysis: DrugInteractionAnalysis = {
      id: randomUUID(),
      patientId,
      patientName,
      analyzedAt: new Date().toISOString(),
      medicationsAnalyzed: medicationList.length,
      overallRiskLevel: parsed.overallRiskLevel || "safe",
      riskScore: parsed.riskScore || 0,
      interactions: (parsed.interactions || []).map((i: any) => ({
        id: randomUUID(),
        medication1: i.medication1 || { name: "Unknown", dosage: "" },
        medication2: i.medication2 || { name: "Unknown", dosage: "" },
        type: i.type || "drug_drug",
        severity: i.severity || "minor",
        mechanism: enforceSafeVerbs(i.mechanism || ""),
        clinicalEffects: (i.clinicalEffects || []).map(enforceSafeVerbs),
        riskFactors: (i.riskFactors || []).map(enforceSafeVerbs),
        recommendation: enforceSafeVerbs(i.recommendation || ""),
        alternativeOptions: i.alternativeOptions?.map(enforceSafeVerbs),
        monitoringRequired: i.monitoringRequired?.map(enforceSafeVerbs),
        aiConfidence: i.aiConfidence || 0.8,
        evidenceLevel: i.evidenceLevel || "moderate",
      })),
      therapeuticDuplications: (parsed.therapeuticDuplications || []).map((td: any) => ({
        drugClass: td.drugClass || "Unknown",
        medications: td.medications || [],
        concern: enforceSafeVerbs(td.concern || ""),
      })),
      allergyConflicts: parsed.allergyConflicts || [],
      summary: enforceSafeVerbs(parsed.summary || "Analysis complete."),
      prioritizedActions: (parsed.prioritizedActions || []).map(enforceSafeVerbs),
      carePlanRecommendations: (parsed.carePlanRecommendations || []).map(enforceSafeVerbs),
      providerAlerts: (parsed.providerAlerts || []).map((alert: any) => ({
        alertType: alert.alertType || "info",
        message: enforceSafeVerbs(alert.message || ""),
        actionRequired: alert.actionRequired || false,
      })),
      aiConfidence: parsed.aiConfidence || 0.85,
    };

    interactionCache.set(cacheKey, {
      analysis,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    logPhiAccess({
      action: "read",
      resourceType: "drug_interaction_result",
      resourceId: analysis.id,
      patientId,
      userId: options?.userId || "provider",
      details: `Drug interaction analysis completed: ${analysis.interactions.length} interactions found, risk level: ${analysis.overallRiskLevel}`,
      ipAddress: options?.ipAddress || "internal",
    });

    return analysis;
  } catch (error) {
    console.error("[DrugInteraction] Error analyzing medications:", error);

    return {
      id: randomUUID(),
      patientId,
      patientName,
      analyzedAt: new Date().toISOString(),
      medicationsAnalyzed: medicationList.length,
      overallRiskLevel: "safe",
      riskScore: 0,
      interactions: [],
      therapeuticDuplications: [],
      allergyConflicts: [],
      summary: "Unable to complete automated analysis. Manual review is appropriate.",
      prioritizedActions: ["Manual medication review is appropriate"],
      carePlanRecommendations: [],
      providerAlerts: [{
        alertType: "warning",
        message: "Automated drug interaction analysis was incomplete. Manual review is appropriate.",
        actionRequired: true,
      }],
      aiConfidence: 0.0,
    };
  }
}

export async function checkCarePlanInteractions(
  carePlanId: string,
  patientId: string,
  proposedMedications?: string[],
  context?: { userId?: string; ipAddress?: string }
): Promise<CarePlanInteractionCheck> {
  assertCdsEnabled("aiDrugInteractionService.checkCarePlanInteractions");
  logPhiAccess({
    action: "read",
    resourceType: "care_plan_interaction_check",
    resourceId: carePlanId,
    patientId,
    userId: context?.userId || "provider",
    details: "Care plan drug interaction check",
    ipAddress: context?.ipAddress || "internal",
  });

  const analysis = await analyzeMedicationInteractions(patientId, {
    includeProposed: proposedMedications?.join(", "),
    forceRefresh: true,
    userId: context?.userId,
    ipAddress: context?.ipAddress,
  });

  let checkResult: CarePlanInteractionCheck["checkResult"] = "clear";
  
  if (analysis.interactions.some((i) => i.severity === "contraindicated")) {
    checkResult = "critical";
  } else if (analysis.interactions.some((i) => i.severity === "major")) {
    checkResult = "warning";
  } else if (analysis.interactions.length > 0) {
    checkResult = "warning";
  }

  const recommendations = [
    ...analysis.carePlanRecommendations,
    ...analysis.prioritizedActions,
  ];

  return {
    carePlanId,
    patientId,
    checkResult,
    interactions: analysis.interactions,
    recommendations,
    checkedAt: new Date().toISOString(),
  };
}

export async function getProviderInteractionAlerts(
  patientId: string
): Promise<DrugInteractionAnalysis["providerAlerts"]> {
  assertCdsEnabled("aiDrugInteractionService.getProviderInteractionAlerts");
  const analysis = await analyzeMedicationInteractions(patientId);
  return analysis.providerAlerts.filter((a) => a.alertType !== "info" || a.actionRequired);
}

export async function batchAnalyzePatients(
  patientIds: string[]
): Promise<{ patientId: string; riskLevel: string; interactionCount: number; criticalAlerts: number }[]> {
  assertCdsEnabled("aiDrugInteractionService.batchAnalyzePatients");
  logPhiAccess({
    action: "read",
    resourceType: "batch_drug_interaction",
    resourceId: "batch",
    userId: "provider",
    details: `Batch drug interaction analysis for ${patientIds.length} patients`,
    ipAddress: "internal",
  });

  const results = await Promise.all(
    patientIds.slice(0, 20).map(async (patientId) => {
      try {
        const analysis = await analyzeMedicationInteractions(patientId);
        return {
          patientId,
          riskLevel: analysis.overallRiskLevel,
          interactionCount: analysis.interactions.length,
          criticalAlerts: analysis.providerAlerts.filter((a) => a.alertType === "critical").length,
        };
      } catch {
        return {
          patientId,
          riskLevel: "unknown",
          interactionCount: 0,
          criticalAlerts: 0,
        };
      }
    })
  );

  return results.sort((a, b) => {
    const riskOrder: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3, safe: 4, unknown: 5 };
    return (riskOrder[a.riskLevel] || 5) - (riskOrder[b.riskLevel] || 5);
  });
}

export function clearCache(patientId?: string): void {
  if (patientId) {
    const keysToDelete: string[] = [];
    interactionCache.forEach((_, key) => {
      if (key.startsWith(patientId)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => interactionCache.delete(key));
  } else {
    interactionCache.clear();
  }
}
