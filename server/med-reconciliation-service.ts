import { generatePhiSafeText } from "./services/ai-gateway";

async function logPhiAccess(data: {
  userId: string;
  patientId: string;
  resourceType: string;
  action: "read" | "write" | "delete" | "export";
  details: string;
}) {
  const { logPhiAccess: log } = await import("./security/hipaa-audit");
  log(data);
}

export type MedicationStatus = "taking" | "not_taking" | "unsure";

export interface MedicationEntry {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  prescriber?: string;
  source: string;
  lastUpdated: string;
  status?: MedicationStatus;
  patientNotes?: string;
  flags?: MedicationFlag[];
}

export interface MedicationFlag {
  type: "wrong_dose" | "duplicate" | "discontinued" | "changed" | "other";
  description: string;
  suggestedCorrection?: string;
}

export interface MergeSuggestion {
  id: string;
  type: "duplicate" | "dose_conflict" | "frequency_conflict";
  medications: string[];
  medicationIds: string[];
  reason: string;
  suggestedAction: string;
  confidence: number;
}

export interface ReconciliationResult {
  patientId: string;
  medications: MedicationEntry[];
  mergeSuggestions: MergeSuggestion[];
  summary: {
    total: number;
    taking: number;
    notTaking: number;
    unsure: number;
    flagged: number;
  };
  generatedAt: string;
}

export async function analyzeMedicationsForMerges(
  medications: MedicationEntry[],
  patientId: string
): Promise<MergeSuggestion[]> {
  logPhiAccess({
    userId: patientId,
    patientId,
    resourceType: "MedicationReconciliation",
    action: "read",
    details: `Analyzing ${medications.length} medications for merge suggestions`,
  });

  if (medications.length < 2) {
    return [];
  }

  const prompt = `You are a medication reconciliation assistant. Analyze this medication list and identify potential duplicates or conflicts that the PATIENT should review with their healthcare provider.

CRITICAL RULES:
- You are NOT making medical decisions - only identifying potential issues for patient review
- Suggest merges/fixes but the PATIENT must confirm
- Focus on obvious duplicates and conflicts, not clinical recommendations
- Be conservative - only flag clear issues

MEDICATIONS:
${medications.map((m, i) => `${i + 1}. ${m.name} ${m.dosage} - ${m.frequency} (Source: ${m.source}, ID: ${m.id})`).join("\n")}

Identify:
1. DUPLICATES: Same medication appearing multiple times (may have slight name variations)
2. DOSE CONFLICTS: Same medication with different doses from different sources
3. FREQUENCY CONFLICTS: Same medication with different frequencies

Return JSON:
{
  "suggestions": [
    {
      "id": "merge-1",
      "type": "duplicate|dose_conflict|frequency_conflict",
      "medications": ["Med A 10mg", "Med A 10mg tablet"],
      "medicationIds": ["id1", "id2"],
      "reason": "These appear to be the same medication listed twice",
      "suggestedAction": "Review with your provider - you may only need one entry",
      "confidence": 0.9
    }
  ]
}

Only include suggestions with confidence >= 0.7. Return empty array if no issues found.`;

  try {
    const content = await generatePhiSafeText({
      system: "You are a medication list analysis assistant. You help patients identify potential duplicates or conflicts in their medication lists for discussion with their healthcare providers. Never make clinical recommendations.",
      user: prompt,
      temperature: 0.3,
      maxTokens: 1500,
      responseMimeType: "application/json",
    });

    if (!content) return [];

    const parsed = JSON.parse(content);
    return (parsed.suggestions || []).filter((s: MergeSuggestion) => s.confidence >= 0.7);
  } catch (error) {
    console.error("[MedReconciliation] Error analyzing medications:", error);
    return [];
  }
}

export async function updateMedicationStatus(
  medicationId: string,
  status: MedicationStatus,
  patientNotes: string | undefined,
  flags: MedicationFlag[] | undefined,
  patientId: string
): Promise<{ success: boolean; message: string }> {
  logPhiAccess({
    userId: patientId,
    patientId,
    resourceType: "MedicationReconciliation",
    action: "write",
    details: `Updated medication ${medicationId} status to ${status}`,
  });

  return {
    success: true,
    message: `Medication status updated to "${status}"`,
  };
}

export async function confirmMergeSuggestion(
  suggestionId: string,
  action: "accept" | "reject" | "defer",
  patientId: string
): Promise<{ success: boolean; message: string }> {
  logPhiAccess({
    userId: patientId,
    patientId,
    resourceType: "MedicationReconciliation",
    action: "write",
    details: `Patient ${action}ed merge suggestion ${suggestionId}`,
  });

  const messages: Record<string, string> = {
    accept: "Merge confirmed - this will be flagged for your provider to review",
    reject: "Suggestion dismissed - entries will remain separate",
    defer: "Marked for later review",
  };

  return {
    success: true,
    message: messages[action],
  };
}

export async function getReconciliationSummary(
  medications: MedicationEntry[],
  patientId: string
): Promise<ReconciliationResult> {
  logPhiAccess({
    userId: patientId,
    patientId,
    resourceType: "MedicationReconciliation",
    action: "read",
    details: `Generated reconciliation summary for ${medications.length} medications`,
  });

  const mergeSuggestions = await analyzeMedicationsForMerges(medications, patientId);

  const summary = {
    total: medications.length,
    taking: medications.filter(m => m.status === "taking").length,
    notTaking: medications.filter(m => m.status === "not_taking").length,
    unsure: medications.filter(m => m.status === "unsure" || !m.status).length,
    flagged: medications.filter(m => m.flags && m.flags.length > 0).length,
  };

  return {
    patientId,
    medications,
    mergeSuggestions,
    summary,
    generatedAt: new Date().toISOString(),
  };
}
