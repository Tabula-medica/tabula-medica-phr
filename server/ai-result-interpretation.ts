/**
 * AI Result Interpretation — PHI-safe, Vertex-only.
 *
 * Context-aware lab result interpretation personalised to the patient's own
 * history: prior values, active medications, and active conditions.
 *
 * ALL Vertex calls go through generatePhiSafeText (BAA-covered endpoint).
 * No patient name or MRN is ever included in the prompt — only clinical
 * values, medication names, condition names, and dates.
 *
 * PHI handling: result values, medication names, and condition names are PHI
 * and included in the prompt. The interpretation text returned to the client
 * is general clinical-context language (not PHI reasoning verbatim) but is
 * still served over authenticated endpoints only.
 */

import { generatePhiSafeText } from "./services/ai-gateway";
import { getLogger } from "./lib/logger";

const log = getLogger("ai-result-interpretation");

// Critical / panic values for common tests. Extend as needed.
const CRITICAL_FLAGS = new Set(["critical", "panic", "hh", "ll", "ch", "cl"]);

export interface PriorValue {
  value: number | string;
  date: string; // ISO 8601
}

export interface ActiveMedication {
  name: string;
  dose?: string;
  unit?: string;
}

export interface ActiveCondition {
  name: string;
}

export interface InterpretResultInput {
  /** Current result: test name, value, unit, reference range, flag. */
  testName: string;
  value: string | number;
  unit?: string;
  referenceRange?: string;
  /** Low boundary of reference range for numeric critical check. */
  referenceRangeLow?: number;
  /** High boundary of reference range for numeric critical check. */
  referenceRangeHigh?: number;
  /** Normalised abnormality flag from the source system. */
  flag?: string;
  /** Up to 3 prior values for the same test, newest first. */
  priorValues?: PriorValue[];
  /** Relevant active medications (caller must pre-filter for relevance). */
  activeMedications?: ActiveMedication[];
  /** Active diagnoses/conditions. */
  activeConditions?: ActiveCondition[];
  /** BCP-47 language tag for the output (e.g. "en", "es", "hi"). */
  patientLanguage?: string;
}

export interface InterpretResultOutput {
  /** 2-3 plain-language sentences in patientLanguage. */
  interpretation: string;
  /** 1-sentence trend summary when >=3 prior values exist; otherwise null. */
  trendSummary: string | null;
  /** Suggested next actions for the patient. */
  actionOptions: Array<{
    label: string;
    type: "message_care_team" | "no_action" | "schedule_followup" | "view_education";
  }>;
  /** True when the result is flagged or critical — triggers 15-min hold + care-team notify. */
  holdForClinician: boolean;
}

/**
 * Determines whether this result should be held and the care team notified.
 */
function isHoldRequired(flag?: string, value?: string | number, low?: number, high?: number): boolean {
  const normFlag = String(flag ?? "").toLowerCase();
  if (CRITICAL_FLAGS.has(normFlag)) return true;
  if (["abnormal", "high", "low", "h", "l", "a"].includes(normFlag)) return true;

  // Numeric extremes even when flag is absent
  if (value !== undefined && value !== null && value !== "") {
    const num = Number(value);
    if (!isNaN(num)) {
      if (low !== undefined && num < low * 0.7) return true;
      if (high !== undefined && num > high * 1.5) return true;
    }
  }
  return false;
}

function buildTrendSentence(priorValues: PriorValue[], currentValue: string | number, testName: string): string | null {
  if (!priorValues || priorValues.length < 3) return null;
  const nums = priorValues.map((p) => Number(p.value)).filter((n) => !isNaN(n));
  if (nums.length < 2) return null;
  const current = Number(currentValue);
  if (isNaN(current)) return null;
  const oldest = nums[nums.length - 1];
  const diff = current - oldest;
  const pct = oldest !== 0 ? Math.round(Math.abs(diff / oldest) * 100) : 0;
  if (Math.abs(diff) < Number.EPSILON || pct < 3) {
    return `Your ${testName} has been stable across your recent tests.`;
  }
  return diff > 0
    ? `Your ${testName} has trended upward by roughly ${pct}% compared to your earlier results.`
    : `Your ${testName} has trended downward by roughly ${pct}% compared to your earlier results.`;
}

function buildPrompt(input: InterpretResultInput): string {
  const lang = input.patientLanguage ?? "en";

  const priorSection =
    input.priorValues && input.priorValues.length > 0
      ? `Prior values for the same test (newest first):\n${input.priorValues
          .slice(0, 3)
          .map((p) => `  - ${p.value}${input.unit ? " " + input.unit : ""} on ${p.date}`)
          .join("\n")}`
      : "No prior values available for this test.";

  const medSection =
    input.activeMedications && input.activeMedications.length > 0
      ? `Relevant active medications:\n${input.activeMedications
          .map((m) => `  - ${m.name}${m.dose ? " " + m.dose + (m.unit ? " " + m.unit : "") : ""}`)
          .join("\n")}`
      : "No relevant medications on file.";

  const condSection =
    input.activeConditions && input.activeConditions.length > 0
      ? `Active conditions:\n${input.activeConditions.map((c) => `  - ${c.name}`).join("\n")}`
      : "No active conditions on file.";

  return `You are helping a patient understand one of their own lab results.

RESULT:
  Test: ${input.testName}
  Value: ${input.value}${input.unit ? " " + input.unit : ""}
  Reference range: ${input.referenceRange ?? "not provided"}
  Flag: ${input.flag ?? "none"}

${priorSection}

${medSection}

${condSection}

INSTRUCTIONS:
1. Write 2-3 plain-language sentences explaining what this result value means and whether it is in the expected range for this patient's clinical history (considering medications and conditions listed above).
2. Do NOT include any statement that sounds like a diagnosis or treatment recommendation.
3. Do NOT mention the patient's name, date of birth, or any identifier.
4. Respond ONLY with a JSON object in this exact shape (no markdown, no prose outside JSON):
{"interpretation": "<2-3 sentences>"}
5. Write the interpretation in the language identified by BCP-47 tag: ${lang}.`;
}

export async function interpretResult(input: InterpretResultInput): Promise<InterpretResultOutput> {
  const holdForClinician = isHoldRequired(
    input.flag,
    input.value,
    input.referenceRangeLow,
    input.referenceRangeHigh,
  );

  const trendSummary = buildTrendSentence(input.priorValues ?? [], input.value, input.testName);

  let interpretation = "";
  try {
    const raw = await generatePhiSafeText({
      purpose: "lab-result-interpretation",
      system:
        "You produce plain-language patient-facing lab result explanations. " +
        "Return ONLY valid JSON — no markdown fences, no prose outside the JSON object.",
      user: buildPrompt(input),
      maxTokens: 512,
      temperature: 0.2,
      responseMimeType: "application/json",
    });
    const parsed = JSON.parse(raw.trim());
    interpretation = typeof parsed.interpretation === "string" ? parsed.interpretation.trim() : "";
  } catch (err) {
    log.error({ err, testName: input.testName }, "lab-result-interpretation-failed");
    interpretation =
      `Your ${input.testName} result is ${input.value}${input.unit ? " " + input.unit : ""}. ` +
      (input.flag && input.flag !== "none"
        ? "This result was flagged — your care team will review it. "
        : "This result appears within the reference range. ") +
      "Please speak with your care team if you have any questions.";
  }

  const actionOptions: InterpretResultOutput["actionOptions"] = holdForClinician
    ? [
        { label: "Message my care team", type: "message_care_team" },
        { label: "Schedule a follow-up", type: "schedule_followup" },
      ]
    : [
        { label: "Message my care team", type: "message_care_team" },
        { label: "No action needed", type: "no_action" },
      ];

  return { interpretation, trendSummary, actionOptions, holdForClinician };
}
