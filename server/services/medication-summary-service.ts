// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import OpenAI from "openai";

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export interface MedicationInput {
  drug_name: string;
  dose: string;
  frequency: string;
  route: string;
  status: "taking" | "not taking" | "unsure";
  last_updated: string;
  source: string;
  record_id: string;
}

export interface MedicationEntry {
  drug: string;
  dose: string;
  frequency: string;
  route?: string;
  source: string;
  record_id: string;
  last_updated?: string;
}

export interface DuplicateOrConflict {
  issue: "duplicate" | "conflict";
  entries: Array<{
    drug: string;
    details: string;
    source: string;
    record_id: string;
  }>;
}

export interface MedicationSummaryOutput {
  language: string;
  taking: MedicationEntry[];
  not_taking: MedicationEntry[];
  unsure: MedicationEntry[];
  duplicates_or_conflicts: DuplicateOrConflict[];
  limitations: string[];
  disclaimer: string;
}

const MEDICATION_SUMMARY_SYSTEM_PROMPT = `You are a medical record summarization assistant. Your role is to organize medication lists clearly without providing any medical advice.

STRICT RULES:
1. NEVER provide medication advice, warnings, or recommendations
2. NEVER mention drug interactions, side effects, or safety concerns
3. NEVER suggest changes to medications or dosages
4. PRESERVE drug names and dosages EXACTLY as provided - do not modify or correct them
5. Group medications by status: "taking", "not taking", "unsure"
6. Flag duplicates (same drug, same details from different sources) and conflicts (same drug, different details)
7. Translate section headers and descriptive text to the target language, but keep drug names in their original form
8. Include full provenance (source, record_id) for every medication entry

DUPLICATE vs CONFLICT:
- DUPLICATE: Same drug name with identical dose/frequency from multiple sources
- CONFLICT: Same drug name with DIFFERENT dose/frequency from different sources

PROHIBITED OUTPUT:
Do not use phrases like: "you should", "you need to", "go to the ER", "urgent", "this indicates you have", "likely", "treatment", "start/stop/take", "get an MRI/CT/colonoscopy", "overdue", "safe/unsafe", "interacts with".

If asked for advice, respond:
"I can explain what the record says, but I can't provide medical advice. Consider contacting your clinician."

Always respond with valid JSON matching the output schema.`;

function detectDuplicatesAndConflicts(medications: MedicationInput[]): DuplicateOrConflict[] {
  const drugGroups: Map<string, MedicationInput[]> = new Map();
  
  for (const med of medications) {
    const normalizedName = med.drug_name.toLowerCase().trim();
    const existing = drugGroups.get(normalizedName) || [];
    existing.push(med);
    drugGroups.set(normalizedName, existing);
  }

  const issues: DuplicateOrConflict[] = [];

  Array.from(drugGroups.entries()).forEach(([_drugName, entries]) => {
    if (entries.length < 2) return;

    const uniqueDetails = new Set(
      entries.map((e: MedicationInput) => `${e.dose}|${e.frequency}|${e.route}`)
    );

    if (uniqueDetails.size === 1) {
      issues.push({
        issue: "duplicate",
        entries: entries.map((e: MedicationInput) => ({
          drug: e.drug_name,
          details: `${e.dose}, ${e.frequency}, ${e.route}`,
          source: e.source,
          record_id: e.record_id
        }))
      });
    } else {
      issues.push({
        issue: "conflict",
        entries: entries.map((e: MedicationInput) => ({
          drug: e.drug_name,
          details: `${e.dose}, ${e.frequency}, ${e.route}`,
          source: e.source,
          record_id: e.record_id
        }))
      });
    }
  });

  return issues;
}

function groupMedications(medications: MedicationInput[]): {
  taking: MedicationEntry[];
  not_taking: MedicationEntry[];
  unsure: MedicationEntry[];
} {
  const taking: MedicationEntry[] = [];
  const not_taking: MedicationEntry[] = [];
  const unsure: MedicationEntry[] = [];

  for (const med of medications) {
    const entry: MedicationEntry = {
      drug: med.drug_name,
      dose: med.dose,
      frequency: med.frequency,
      route: med.route,
      source: med.source,
      record_id: med.record_id,
      last_updated: med.last_updated
    };

    switch (med.status) {
      case "taking":
        taking.push(entry);
        break;
      case "not taking":
        not_taking.push(entry);
        break;
      case "unsure":
        unsure.push(entry);
        break;
    }
  }

  return { taking, not_taking, unsure };
}

function getLocalizedDisclaimer(language: string): string {
  const disclaimers: Record<string, string> = {
    en: "For informational purposes only. This is a data summary, not medical advice.",
    es: "Solo con fines informativos. Este es un resumen de datos, no un consejo médico.",
    zh: "仅供参考。这是数据摘要，不是医疗建议。",
    fr: "À titre informatif uniquement. Ceci est un résumé de données, pas un avis médical.",
    de: "Nur zu Informationszwecken. Dies ist eine Datenzusammenfassung, keine medizinische Beratung.",
    ar: "للأغراض المعلوماتية فقط. هذا ملخص بيانات وليس نصيحة طبية.",
    pt: "Apenas para fins informativos. Este é um resumo de dados, não aconselhamento médico.",
    ru: "Только для информационных целей. Это сводка данных, а не медицинская консультация.",
    ja: "情報提供のみを目的としています。これはデータの要約であり、医療アドバイスではありません。",
    ko: "정보 제공 목적으로만 사용됩니다. 이것은 데이터 요약이며 의료 조언이 아닙니다."
  };
  return disclaimers[language] || disclaimers.en;
}

export async function generateMedicationSummary(
  medications: MedicationInput[],
  targetLanguage: string
): Promise<MedicationSummaryOutput> {
  if (!medications || medications.length === 0) {
    return {
      language: targetLanguage,
      taking: [],
      not_taking: [],
      unsure: [],
      duplicates_or_conflicts: [],
      limitations: ["No medications provided"],
      disclaimer: getLocalizedDisclaimer(targetLanguage)
    };
  }

  for (const med of medications) {
    if (!med.drug_name || !med.dose || !med.source || !med.record_id) {
      throw new Error("Each medication must have drug_name, dose, source, and record_id");
    }
    if (!["taking", "not taking", "unsure"].includes(med.status)) {
      throw new Error("Medication status must be 'taking', 'not taking', or 'unsure'");
    }
  }

  const grouped = groupMedications(medications);
  const duplicatesOrConflicts = detectDuplicatesAndConflicts(medications);

  const limitations: string[] = [];
  
  const sourcesSet = new Set(medications.map(m => m.source));
  if (sourcesSet.size === 1) {
    limitations.push("Data from single source only; other sources may have additional medications");
  }
  
  const unsureCount = medications.filter(m => m.status === "unsure").length;
  if (unsureCount > 0) {
    limitations.push(`${unsureCount} medication(s) have uncertain status`);
  }

  if (duplicatesOrConflicts.length > 0) {
    limitations.push(`${duplicatesOrConflicts.length} duplicate/conflict issue(s) detected`);
  }

  if (targetLanguage === "en") {
    return {
      language: targetLanguage,
      taking: grouped.taking,
      not_taking: grouped.not_taking,
      unsure: grouped.unsure,
      duplicates_or_conflicts: duplicatesOrConflicts,
      limitations,
      disclaimer: getLocalizedDisclaimer(targetLanguage)
    };
  }

  const openai = getOpenAIClient();
  if (!openai) {
    return {
      language: targetLanguage,
      taking: grouped.taking,
      not_taking: grouped.not_taking,
      unsure: grouped.unsure,
      duplicates_or_conflicts: duplicatesOrConflicts,
      limitations: [...limitations, "Translation unavailable; shown in English"],
      disclaimer: getLocalizedDisclaimer("en")
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: MEDICATION_SUMMARY_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Translate ONLY the limitations array and disclaimer to ${targetLanguage}. DO NOT modify any medication data fields (drug, dose, frequency, route, source, record_id, details).

Limitations to translate: ${JSON.stringify(limitations)}
Disclaimer to translate: "${getLocalizedDisclaimer("en")}"

Return valid JSON:
{
  "translated_limitations": [...],
  "translated_disclaimer": "..."
}`
        }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content) as { translated_limitations?: string[]; translated_disclaimer?: string };
    
    return {
      language: targetLanguage,
      taking: grouped.taking,
      not_taking: grouped.not_taking,
      unsure: grouped.unsure,
      duplicates_or_conflicts: duplicatesOrConflicts,
      limitations: parsed.translated_limitations || limitations,
      disclaimer: parsed.translated_disclaimer || getLocalizedDisclaimer(targetLanguage)
    };
  } catch (error) {
    console.error("AI translation failed, returning English version:", error);
    return {
      language: targetLanguage,
      taking: grouped.taking,
      not_taking: grouped.not_taking,
      unsure: grouped.unsure,
      duplicates_or_conflicts: duplicatesOrConflicts,
      limitations: [...limitations, "Translation unavailable; shown in English"],
      disclaimer: getLocalizedDisclaimer("en")
    };
  }
}
