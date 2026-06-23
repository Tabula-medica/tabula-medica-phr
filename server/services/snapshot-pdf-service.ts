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

export interface SnapshotInput {
  problems: Array<{ name: string; onset_date?: string; status?: string; source: string; record_id: string }>;
  allergies: Array<{ allergen: string; reaction?: string; severity?: string; source: string; record_id: string }>;
  meds: Array<{ drug_name: string; dose: string; frequency?: string; status?: string; source: string; record_id: string }>;
  recent_labs: Array<{ test_name: string; value: string; unit?: string; date: string; source: string; record_id: string }>;
  recent_imaging: Array<{ modality: string; body_part: string; date: string; impression?: string; source: string; record_id: string }>;
  key_documents: Array<{ title: string; type: string; date: string; source: string; record_id: string }>;
  last_sync_date: string;
  sources: string[];
}

export interface SnapshotSection {
  en?: string;
  translated?: string;
}

export interface SnapshotOutput {
  language: string;
  bilingual: boolean;
  snapshot_sections: {
    problems: string[];
    allergies: string[];
    medications: string[];
    recent_results: string[];
    documents: string[];
  };
  metadata: {
    last_updated: string;
    sources_connected: string[];
  };
  disclaimer: string;
}

const SNAPSHOT_SYSTEM_PROMPT = `You are a medical record summarization assistant creating concise one-page PDF snapshots.

STRICT RULES:
1. Be concise and factual - this must fit on one page
2. Do NOT provide medical advice, recommendations, or interpretations
3. Do NOT add urgency language or clinical guidance
4. Preserve medical terms, drug names, and values exactly as provided
5. Format for readability: use bullet points, keep entries brief
6. Include all provenance information (source)
7. If bilingual, output paired lines: English first, then translation

FORMATTING:
- Problems: "Problem Name (Status) - Source"
- Allergies: "Allergen: Reaction (Severity) - Source"
- Medications: "Drug Dose Frequency - Source"
- Labs/Results: "Test: Value Unit (Date) - Source"
- Documents: "Title (Type) Date - Source"

PROHIBITED OUTPUT:
Do not use phrases like: "you should", "you need to", "go to the ER", "urgent", "this indicates you have", "likely", "treatment", "start/stop/take", "get an MRI/CT/colonoscopy", "overdue", "safe/unsafe", "interacts with".

If asked for advice, respond:
"I can explain what the record says, but I can't provide medical advice. Consider contacting your clinician."

Always respond with valid JSON matching the output schema.`;

function formatProblem(p: SnapshotInput["problems"][0]): string {
  let text = p.name;
  if (p.status) text += ` (${p.status})`;
  if (p.onset_date) text += ` since ${p.onset_date}`;
  text += ` - ${p.source}`;
  return text;
}

function formatAllergy(a: SnapshotInput["allergies"][0]): string {
  let text = a.allergen;
  if (a.reaction) text += `: ${a.reaction}`;
  if (a.severity) text += ` (${a.severity})`;
  text += ` - ${a.source}`;
  return text;
}

function formatMedication(m: SnapshotInput["meds"][0]): string {
  let text = `${m.drug_name} ${m.dose}`;
  if (m.frequency) text += ` ${m.frequency}`;
  if (m.status) text += ` [${m.status}]`;
  text += ` - ${m.source}`;
  return text;
}

function formatLabResult(l: SnapshotInput["recent_labs"][0]): string {
  let text = `${l.test_name}: ${l.value}`;
  if (l.unit) text += ` ${l.unit}`;
  text += ` (${l.date}) - ${l.source}`;
  return text;
}

function formatImaging(i: SnapshotInput["recent_imaging"][0]): string {
  let text = `${i.modality} ${i.body_part} (${i.date})`;
  if (i.impression) text += ` - "${i.impression}"`;
  text += ` - ${i.source}`;
  return text;
}

function formatDocument(d: SnapshotInput["key_documents"][0]): string {
  return `${d.title} (${d.type}) ${d.date} - ${d.source}`;
}

function getLocalizedDisclaimer(language: string): string {
  const disclaimers: Record<string, string> = {
    en: "For informational purposes only. This is a data snapshot, not medical advice.",
    es: "Solo con fines informativos. Esta es una instantánea de datos, no un consejo médico.",
    zh: "仅供参考。这是数据快照，不是医疗建议。",
    fr: "À titre informatif uniquement. Ceci est un instantané de données, pas un avis médical.",
    de: "Nur zu Informationszwecken. Dies ist ein Daten-Snapshot, keine medizinische Beratung.",
    ar: "للأغراض المعلوماتية فقط. هذه لقطة بيانات وليست نصيحة طبية.",
    pt: "Apenas para fins informativos. Este é um instantâneo de dados, não aconselhamento médico.",
    ru: "Только для информационных целей. Это снимок данных, а не медицинская консультация.",
    ja: "情報提供のみを目的としています。これはデータのスナップショットであり、医療アドバイスではありません。",
    ko: "정보 제공 목적으로만 사용됩니다. 이것은 데이터 스냅샷이며 의료 조언이 아닙니다.",
    vi: "Chỉ dành cho mục đích thông tin. Đây là ảnh chụp dữ liệu, không phải tư vấn y tế.",
    tl: "Para sa layuning pang-impormasyon lamang. Ito ay snapshot ng data, hindi medikal na payo.",
    hi: "केवल सूचनात्मक उद्देश्यों के लिए। यह डेटा स्नैपशॉट है, चिकित्सा सलाह नहीं।"
  };
  return disclaimers[language] || disclaimers.en;
}

function getBilingualDisclaimer(language: string): string {
  const enDisclaimer = getLocalizedDisclaimer("en");
  const targetDisclaimer = getLocalizedDisclaimer(language);
  if (language === "en") return enDisclaimer;
  return `${enDisclaimer}\n${targetDisclaimer}`;
}

export async function generateSnapshotPdf(
  snapshot: SnapshotInput,
  targetLanguage: string,
  bilingual: boolean
): Promise<SnapshotOutput> {
  const problems = snapshot.problems.map(formatProblem);
  const allergies = snapshot.allergies.map(formatAllergy);
  const medications = snapshot.meds.map(formatMedication);
  const recentResults = [
    ...snapshot.recent_labs.map(formatLabResult),
    ...snapshot.recent_imaging.map(formatImaging)
  ];
  const documents = snapshot.key_documents.map(formatDocument);

  const englishSnapshot: SnapshotOutput = {
    language: targetLanguage,
    bilingual,
    snapshot_sections: {
      problems,
      allergies,
      medications,
      recent_results: recentResults,
      documents
    },
    metadata: {
      last_updated: snapshot.last_sync_date,
      sources_connected: snapshot.sources
    },
    disclaimer: bilingual ? getBilingualDisclaimer(targetLanguage) : getLocalizedDisclaimer(targetLanguage)
  };

  if (targetLanguage === "en" && !bilingual) {
    return englishSnapshot;
  }

  const openai = getOpenAIClient();
  if (!openai) {
    if (bilingual) {
      return {
        language: targetLanguage,
        bilingual: true,
        snapshot_sections: {
          problems: problems.map(p => `${p}\n→ [Translation unavailable]`),
          allergies: allergies.map(a => `${a}\n→ [Translation unavailable]`),
          medications: medications.map(m => `${m}\n→ [Translation unavailable]`),
          recent_results: recentResults.map(r => `${r}\n→ [Translation unavailable]`),
          documents: documents.map(d => `${d}\n→ [Translation unavailable]`)
        },
        metadata: {
          last_updated: snapshot.last_sync_date,
          sources_connected: snapshot.sources
        },
        disclaimer: `${getLocalizedDisclaimer("en")}\n→ [Translation unavailable]`
      };
    }
    return {
      ...englishSnapshot,
      bilingual: false,
      disclaimer: getLocalizedDisclaimer("en")
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SNAPSHOT_SYSTEM_PROMPT },
        {
          role: "user",
          content: bilingual
            ? `Create a bilingual snapshot in English and ${targetLanguage}. For each item, provide the English version first, then the ${targetLanguage} translation on a new line prefixed with "→ ".

Input data:
Problems: ${JSON.stringify(problems)}
Allergies: ${JSON.stringify(allergies)}
Medications: ${JSON.stringify(medications)}
Recent Results: ${JSON.stringify(recentResults)}
Documents: ${JSON.stringify(documents)}
Last Updated: ${snapshot.last_sync_date}
Sources: ${JSON.stringify(snapshot.sources)}

Return valid JSON:
{
  "problems": ["English line\\n→ Translation", ...],
  "allergies": ["English line\\n→ Translation", ...],
  "medications": ["English line\\n→ Translation", ...],
  "recent_results": ["English line\\n→ Translation", ...],
  "documents": ["English line\\n→ Translation", ...],
  "disclaimer": "English disclaimer\\n${targetLanguage} disclaimer"
}`
            : `Translate this snapshot to ${targetLanguage}. Keep drug names, test names, and values exactly as written. Only translate descriptive text.

Input data:
Problems: ${JSON.stringify(problems)}
Allergies: ${JSON.stringify(allergies)}
Medications: ${JSON.stringify(medications)}
Recent Results: ${JSON.stringify(recentResults)}
Documents: ${JSON.stringify(documents)}

Return valid JSON:
{
  "problems": [...],
  "allergies": [...],
  "medications": [...],
  "recent_results": [...],
  "documents": [...],
  "disclaimer": "..."
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

    const parsed = JSON.parse(content);

    return {
      language: targetLanguage,
      bilingual,
      snapshot_sections: {
        problems: parsed.problems || problems,
        allergies: parsed.allergies || allergies,
        medications: parsed.medications || medications,
        recent_results: parsed.recent_results || recentResults,
        documents: parsed.documents || documents
      },
      metadata: {
        last_updated: snapshot.last_sync_date,
        sources_connected: snapshot.sources
      },
      disclaimer: parsed.disclaimer || (bilingual ? getBilingualDisclaimer(targetLanguage) : getLocalizedDisclaimer(targetLanguage))
    };
  } catch (error) {
    console.error("AI translation failed:", error);
    if (bilingual) {
      return {
        language: targetLanguage,
        bilingual: true,
        snapshot_sections: {
          problems: problems.map(p => `${p}\n→ [Translation failed]`),
          allergies: allergies.map(a => `${a}\n→ [Translation failed]`),
          medications: medications.map(m => `${m}\n→ [Translation failed]`),
          recent_results: recentResults.map(r => `${r}\n→ [Translation failed]`),
          documents: documents.map(d => `${d}\n→ [Translation failed]`)
        },
        metadata: {
          last_updated: snapshot.last_sync_date,
          sources_connected: snapshot.sources
        },
        disclaimer: `${getLocalizedDisclaimer("en")}\n→ [Translation failed]`
      };
    }
    return { ...englishSnapshot, bilingual: false };
  }
}
