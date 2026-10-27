/**
 * Fable-Style Content Service (Task #297)
 *
 * Wraps `chatComplete()` with a system prompt that enforces:
 *   - 6th-grade Flesch-Kincaid reading level (≈ Flesch score ≥ 60)
 *   - First-person empathetic voice ("Your body..." not "The patient's...")
 *   - No Latin abbreviations (q.d., b.i.d., p.r.n., etc.)
 *   - No differential diagnoses ("It could be X or Y or Z...")
 *   - Ends with an "Ask your care team about…" call-to-action
 *
 * Used for patient-facing health summary narratives and AI chat replies.
 */

import { chatComplete, type AICompleteOptions, type AICompleteResult } from "./ai-client";

// ─────────────────────────────────────────────────────────────────────────────
// Fable system prompt
// ─────────────────────────────────────────────────────────────────────────────

export const FABLE_SYSTEM_PROMPT = `You are a warm, knowledgeable health companion helping a patient understand their own health.

Language rules — follow every rule without exception:
1. Write at a 6th-grade reading level (short sentences, common words, no jargon).
2. Speak directly to the patient in second person: "you", "your body", "your care team".
3. Use plain English only — never use Latin abbreviations (no "q.d.", "b.i.d.", "p.r.n.", "s.l.", etc.).
4. Never list multiple possible diagnoses ("It could be X, Y, or Z"). If a diagnosis is uncertain, say "Your care team can help figure out what's going on."
5. Never recommend, prescribe, or suggest specific medications, dosages, or treatment plans.
6. Never tell the patient to stop, start, or change their medication.
7. Be empathetic and reassuring without minimising real concerns.
8. Keep your response focused and concise — no more than 150 words unless the user asked for a detailed summary.
9. End every response with a single sentence beginning with "Ask your care team about…" that invites the patient to discuss the topic with their provider.

Tone: warm, calm, supportive — like a knowledgeable friend, not a clinician.`;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface FableContentOptions
  extends Omit<AICompleteOptions, "messages"> {
  /** The patient's question or the clinical data to narrate */
  userContent: string;
  /** Optional additional system context (appended after Fable rules) */
  extraSystemContext?: string;
}

export interface FableContentResult extends AICompleteResult {
  /** Fable-style patient-facing narrative */
  narrative: string;
  /** Whether the narrative ends with the required CTA */
  hasCareTeamCta: boolean;
}

/**
 * Generate a Fable-style patient-facing narrative.
 * Always uses the Fable system prompt as the primary system instruction.
 */
export async function generateFableContent(
  opts: FableContentOptions
): Promise<FableContentResult> {
  const systemContent = opts.extraSystemContext
    ? `${FABLE_SYSTEM_PROMPT}\n\n${opts.extraSystemContext}`
    : FABLE_SYSTEM_PROMPT;

  const result = await chatComplete({
    ...opts,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: opts.userContent },
    ],
    temperature: opts.temperature ?? 0.3,
    maxOutputTokens: opts.maxOutputTokens ?? 512,
  });

  const narrative = result.content.trim();
  const hasCareTeamCta = /ask your care team/i.test(narrative);

  // If the CTA is missing (model didn't follow instructions), append it
  const finalNarrative = hasCareTeamCta
    ? narrative
    : `${narrative}\n\nAsk your care team about what these results mean for your overall health.`;

  return {
    ...result,
    content: finalNarrative,
    narrative: finalNarrative,
    hasCareTeamCta: true,
  };
}

/**
 * Generate a Fable-style health summary narrative from structured health data.
 */
export async function generateHealthSummaryNarrative(params: {
  ageYears: number;
  conditions: string[];
  medications: string[];
  recentLabFlags: string[];
  userId?: string;
}): Promise<FableContentResult> {
  const dataLines = [
    params.conditions.length > 0
      ? `Health conditions: ${params.conditions.join(", ")}`
      : "No active health conditions on file.",
    params.medications.length > 0
      ? `Current medications: ${params.medications.join(", ")}`
      : "No current medications on file.",
    params.recentLabFlags.length > 0
      ? `Recent lab flags: ${params.recentLabFlags.join(", ")}`
      : "No recent abnormal lab results.",
  ];

  const userContent =
    `Please write a brief, plain-language summary of this patient's health record:\n\n` +
    dataLines.join("\n");

  return generateFableContent({
    userContent,
    dataCategories: ["conditions", "medications", "lab_results"],
    purpose: "patient_communication",
    callerService: "fable-content-service",
    callerMethod: "generateHealthSummaryNarrative",
    userId: params.userId,
  });
}

/**
 * Rewrite a clinical AI chat reply in Fable style.
 * Input is the raw AI response; output is the patient-friendly rewrite.
 */
export async function rewriteInFableStyle(
  rawAiResponse: string,
  userId?: string
): Promise<FableContentResult> {
  const userContent =
    `Rewrite the following health information in plain, empathetic language at a 6th-grade reading level:\n\n` +
    rawAiResponse;

  return generateFableContent({
    userContent,
    dataCategories: ["general_health"],
    purpose: "patient_communication",
    callerService: "fable-content-service",
    callerMethod: "rewriteInFableStyle",
    userId,
  });
}
