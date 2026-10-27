/**
 * Model Cards Service — Roadmap item 1.6
 *
 * Voluntary model cards for every AI feature in Tabula Medica.
 * HTI-5 likely removes the certification requirement but we publish these as a
 * trust differentiator and in case a future rule restores them.
 *
 * One card per AI feature:
 *   - Model(s) used
 *   - Data sent (de-identified or not, BAA coverage)
 *   - Human-in-the-loop step
 *   - Known failure modes / limitations
 *   - Version / last-reviewed date
 */

export interface ModelCard {
  id: string;
  featureName: string;
  featureCategory: "clinical" | "administrative" | "voice" | "search" | "safety";
  description: string;
  models: {
    name: string;
    provider: string;
    version?: string;
    baaStatus: "covered" | "not_used_for_phi" | "not_applicable";
  }[];
  dataInput: {
    description: string;
    containsPHI: boolean;
    deidentificationApplied: boolean;
    dataTypes: string[];
  };
  humanInTheLoop: {
    required: boolean;
    description: string;
    overridable: boolean;
  };
  knownLimitations: string[];
  outputDisclaimer: string;
  version: string;
  lastReviewed: string;
  regulatoryNotes?: string;
}

const MODEL_CARDS: ModelCard[] = [
  {
    id: "clinical-summary",
    featureName: "AI Health Summary",
    featureCategory: "clinical",
    description:
      "Generates a natural-language summary of a patient's health record, including active conditions, recent labs, medications, and timeline. Displayed on the home dashboard and health summary screen.",
    models: [
      { name: "Gemini 2.5 Pro", provider: "Google Vertex AI", baaStatus: "covered" },
    ],
    dataInput: {
      description: "De-identified subset of the patient's FHIR record (conditions, medications, labs, vitals). No free-text clinical notes are sent.",
      containsPHI: false,
      deidentificationApplied: true,
      dataTypes: ["FHIR Condition", "FHIR MedicationRequest", "FHIR Observation", "FHIR Immunization"],
    },
    humanInTheLoop: {
      required: false,
      description: "Patient views the summary; no clinician review gate. Summary is clearly labeled as AI-generated.",
      overridable: true,
    },
    knownLimitations: [
      "May miss recent data not yet synced from source EHRs.",
      "Structured summaries may lack clinical nuance present in provider notes.",
      "Not a substitute for a clinician's assessment.",
    ],
    outputDisclaimer: "This summary is for informational purposes only and does not constitute medical advice.",
    version: "2.0",
    lastReviewed: "2026-06-09",
    regulatoryNotes: "Not a clinical decision support tool. Does not generate diagnoses or treatment recommendations.",
  },
  {
    id: "soap-note",
    featureName: "AI SOAP Note Generation",
    featureCategory: "voice",
    description:
      "Transcribes ambient encounter audio and structures it into a SOAP (Subjective, Objective, Assessment, Plan) clinical note for provider review and editing.",
    models: [
      { name: "Gemini 2.5 Pro", provider: "Google Vertex AI", baaStatus: "covered" },
      { name: "Medical Dictation (GCP Speech-to-Text)", provider: "Google Cloud", baaStatus: "covered" },
    ],
    dataInput: {
      description: "Audio recording of the clinical encounter. Processed through GCP Medical Speech (BAA-covered). The resulting transcript is sent to Vertex AI for SOAP structuring.",
      containsPHI: true,
      deidentificationApplied: false,
      dataTypes: ["Audio (WEBM/OGG)", "Transcript text"],
    },
    humanInTheLoop: {
      required: true,
      description: "Clinician must review, edit, and sign the generated note before it is saved to the record. No AI-generated note is committed without explicit clinician approval.",
      overridable: false,
    },
    knownLimitations: [
      "Accuracy degrades with heavy accents, background noise, or rapid speech.",
      "Drug names and rare medical terms may be mis-transcribed; keyword boosting mitigates but does not eliminate this.",
      "SOAP structuring may incorrectly categorize patient vs. clinician speech.",
      "Assessment and Plan suggestions are speculative and require clinical validation.",
    ],
    outputDisclaimer: "All AI-generated note content must be reviewed and approved by a licensed clinician before use in the medical record.",
    version: "3.1",
    lastReviewed: "2026-06-09",
    regulatoryNotes: "Falls under FDA clinical decision support guidance. The required clinician review gate ensures this tool does not meet FDA's definition of a Software as a Medical Device (SaMD) requiring clearance.",
  },
  {
    id: "pre-visit-prep",
    featureName: "Pre-Visit Chart Prep",
    featureCategory: "clinical",
    description:
      "Generates a one-screen provider brief for upcoming appointments: active problems, medication changes, overdue health maintenance, and HCC/MIPS gap suggestions.",
    models: [
      { name: "Gemini 2.5 Pro (extended thinking)", provider: "Google Vertex AI", baaStatus: "covered" },
    ],
    dataInput: {
      description: "De-identified structured chart data: problem list, medication list, recent labs (test names and values only, no free text), due screenings, and appointment type.",
      containsPHI: false,
      deidentificationApplied: true,
      dataTypes: ["FHIR Condition", "FHIR MedicationRequest", "FHIR Observation", "FHIR CarePlan"],
    },
    humanInTheLoop: {
      required: true,
      description: "Brief is presented to the provider before the encounter. No auto-actions taken. HCC/MIPS suggestions are administrative only and require provider sign-off.",
      overridable: true,
    },
    knownLimitations: [
      "HCC/MIPS gap suggestions are speculative coding pointers — not verified diagnoses.",
      "Output quality depends on completeness of imported FHIR data.",
      "Does not access free-text notes or imaging reports.",
    ],
    outputDisclaimer: "All suggestions require clinician review. HCC and MIPS gap items are administrative suggestions only and do not constitute diagnoses.",
    version: "1.0",
    lastReviewed: "2026-06-09",
    regulatoryNotes: "Read-only, no write actions. Provider review required before any clinical decision. Follows FDA non-device CDS guidance (requires human review, clinician can independently review basis).",
  },
  {
    id: "health-insights",
    featureName: "Proactive Health Insights",
    featureCategory: "clinical",
    description:
      "Analyzes the patient's longitudinal record to surface personalized health insights, preventive care gaps, and proactive alerts (e.g., overdue screenings, potential drug interactions).",
    models: [
      { name: "Gemini 2.5 Pro", provider: "Google Vertex AI", baaStatus: "covered" },
    ],
    dataInput: {
      description: "De-identified structured FHIR resources. No free-text notes. Age/sex used for age-appropriate screening calculations.",
      containsPHI: false,
      deidentificationApplied: true,
      dataTypes: ["FHIR Condition", "FHIR MedicationRequest", "FHIR Observation", "FHIR Procedure", "FHIR Immunization"],
    },
    humanInTheLoop: {
      required: false,
      description: "Insights are displayed to the patient with 'discuss with your provider' framing. No clinical action is taken automatically.",
      overridable: true,
    },
    knownLimitations: [
      "Drug interaction checks are limited to structured medication data — may miss OTC drugs or supplements not in the record.",
      "Screening recommendations follow general USPSTF guidelines and may not reflect individual clinical history.",
      "Not a substitute for clinical evaluation.",
    ],
    outputDisclaimer: "Insights are for informational purposes and patient empowerment only. Discuss any concerns with your healthcare provider.",
    version: "2.2",
    lastReviewed: "2026-06-09",
    regulatoryNotes: "Patient-facing only. Not a diagnostic tool. Recommendations align with USPSTF Grade A/B guidelines.",
  },
  {
    id: "ai-chat-assistant",
    featureName: "24/7 AI Health Assistant",
    featureCategory: "clinical",
    description:
      "Conversational AI assistant for patients to ask health questions, understand their records, and get guidance on next steps.",
    models: [
      { name: "Gemini 2.5 Pro", provider: "Google Vertex AI", baaStatus: "covered" },
      { name: "Claude 3.5 Sonnet", provider: "Anthropic (BAA)", baaStatus: "covered" },
    ],
    dataInput: {
      description: "Patient's de-identified structured health data as context (when relevant to the query). Patient's free-text question is sent as-is — patient may include PHI. All processing is over BAA-covered infrastructure.",
      containsPHI: true,
      deidentificationApplied: false,
      dataTypes: ["User message (free text)", "FHIR context (de-identified structured)"],
    },
    humanInTheLoop: {
      required: false,
      description: "Patient interacts directly. All responses include a guardrail prompt reminding patients to consult their care team for medical decisions. Emergency escalation prompts are hard-coded and not AI-generated.",
      overridable: false,
    },
    knownLimitations: [
      "Not a substitute for clinical care. Cannot diagnose, prescribe, or treat.",
      "Responses based on general medical knowledge and provided context — may not reflect the patient's full clinical picture.",
      "Emergency situations require 911 or immediate in-person care.",
    ],
    outputDisclaimer: "The AI Health Assistant provides general health information only. It cannot diagnose or treat conditions. In an emergency, call 911.",
    version: "4.0",
    lastReviewed: "2026-06-09",
    regulatoryNotes: "General wellness / patient education tool. Not classified as SaMD. Emergency override prompts are static (non-AI) to ensure reliability.",
  },
  {
    id: "deduplication",
    featureName: "AI Record Deduplication (MPI)",
    featureCategory: "administrative",
    description:
      "Master Patient Index (MPI) algorithm deduplicates health records imported from multiple EHRs using deterministic matching, probabilistic scoring, and AI semantic normalization.",
    models: [
      { name: "Gemini 2.5 Pro (semantic normalization)", provider: "Google Vertex AI", baaStatus: "covered" },
    ],
    dataInput: {
      description: "Structured FHIR resource pairs for comparison. Patient identifiers are removed before LLM normalization calls; only clinical codes, values, and dates are sent.",
      containsPHI: false,
      deidentificationApplied: true,
      dataTypes: ["FHIR resource pairs (de-identified)"],
    },
    humanInTheLoop: {
      required: false,
      description: "Deterministic matches are auto-merged. Probabilistic matches above the confidence threshold are queued for patient or admin review in the Dedup Center.",
      overridable: true,
    },
    knownLimitations: [
      "Near-duplicate detection depends on code system alignment (e.g., ICD-10, SNOMED) — non-standard codes reduce accuracy.",
      "Semantic normalization quality varies by clinical domain.",
      "Manual review queue should be monitored for false merges.",
    ],
    outputDisclaimer: "Automated merges are reversible. Uncertain matches are held for review.",
    version: "2.1",
    lastReviewed: "2026-06-09",
  },
];

export function getAllModelCards(): ModelCard[] {
  return MODEL_CARDS;
}

export function getModelCardById(id: string): ModelCard | null {
  return MODEL_CARDS.find((c) => c.id === id) ?? null;
}

export function getModelCardsByCategory(
  category: ModelCard["featureCategory"]
): ModelCard[] {
  return MODEL_CARDS.filter((c) => c.featureCategory === category);
}

export function getModelCardsIndex(): { id: string; featureName: string; featureCategory: string; lastReviewed: string }[] {
  return MODEL_CARDS.map(({ id, featureName, featureCategory, lastReviewed }) => ({
    id,
    featureName,
    featureCategory,
    lastReviewed,
  }));
}
