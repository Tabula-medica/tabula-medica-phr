/**
 * AI Scheduling Triage — Vertex-only, BAA-covered.
 *
 * Accepts a patient's free-text symptom description plus their current chart
 * context (active problem names + medication names — NO demographics, SSN, or
 * insurance data), calls Vertex gemini-2.5-flash, and returns a structured
 * triage recommendation that the scheduling-routes layer can store and surface
 * to the patient.
 *
 * PHI rule:
 *   - Symptom text + problem/med names are PHI → Vertex ONLY (Google BAA covers
 *     project united-planet-485003-n7).
 *   - The returned recommendation text (urgency label, visit-type label,
 *     reasoning prose, warning symptoms list) is NOT PHI and can be returned
 *     to the client.
 *   - If Vertex is unavailable the function FAILS OPEN to within-3-days /
 *     in-person so the patient is never silently dropped.
 */

import { baaChatFetch, isAiConfigured } from "./lib/baa-chat";

// Public types

export type TriageUrgency =
  | "call-911"
  | "same-day"
  | "within-3-days"
  | "within-2-weeks";

export type TriageVisitType = "in-person" | "telehealth" | "urgent-care";

export interface TriageResult {
  urgency: TriageUrgency;
  visitType: TriageVisitType;
  reasoning: string;
  warningSymptoms: string[];
}

// Internal helpers

const SAFE_DEFAULT: TriageResult = {
  urgency: "within-3-days",
  visitType: "in-person",
  reasoning:
    "We were unable to complete an AI assessment right now. Please contact your care team directly for guidance.",
  warningSymptoms: [],
};

const SYSTEM_PROMPT = `You are a clinical triage assistant embedded in a HIPAA-regulated patient health record.
Your job is to read a patient's free-text description of their current concern, together with their
active medical problems and medications, and produce a structured triage recommendation.

CRITICAL OVERRIDE — 911 SCENARIOS: If the patient describes ANY of the following, you MUST output
urgency="call-911" regardless of everything else:
  - Chest pain, chest tightness, chest pressure, or chest heaviness
  - Difficulty breathing, shortness of breath, or not being able to breathe
  - Stroke symptoms: sudden face drooping, arm weakness, slurred speech, sudden severe headache
  - Signs of anaphylaxis: throat swelling, hives spreading rapidly, unable to swallow or breathe
  - Uncontrolled bleeding or suspected internal bleeding
  - Seizure that has not stopped
  - Loss of consciousness, unresponsive
  - Suspected overdose or poisoning
  - Suicidal ideation with a plan or intent

URGENCY LEVELS (choose exactly one):
  - call-911     -> patient requires immediate emergency services; recommend calling 911 now
  - same-day     -> must be seen within hours; call the office immediately or go to urgent care today
  - within-3-days -> should be seen in 1-3 business days
  - within-2-weeks -> routine, can wait up to 2 weeks for a scheduled visit

VISIT TYPE (choose exactly one):
  - urgent-care  -> acute concern, walk-in or same-day urgent care is appropriate
  - in-person    -> needs physical examination or procedure
  - telehealth   -> can be managed via video/phone visit

RULES:
  - Respond ONLY with valid JSON in exactly the shape shown below. No prose before or after.
  - Do not diagnose. Do not name specific diseases unless they appear in the patient's own text.
  - Keep "reasoning" to 1-2 plain-language sentences the patient can read.
  - List up to 5 "warningSymptoms" that, if they develop, would escalate urgency.
  - For call-911 set warningSymptoms to an empty array — escalation is already max.
  - FAIL SAFE: when in doubt, choose within-3-days / in-person.

RESPONSE SHAPE (strict JSON, nothing else):
{
  "urgency": "<call-911|same-day|within-3-days|within-2-weeks>",
  "visitType": "<in-person|telehealth|urgent-care>",
  "reasoning": "<1-2 sentences>",
  "warningSymptoms": ["<symptom1>", "..."]
}`;

function buildUserMessage(
  symptomText: string,
  patientLanguage: string,
  patientProblems: string[],
  patientMedications: string[]
): string {
  const problemStr =
    patientProblems.length > 0
      ? `Active problems: ${patientProblems.slice(0, 20).join(", ")}`
      : "Active problems: none on file";
  const medStr =
    patientMedications.length > 0
      ? `Current medications: ${patientMedications.slice(0, 20).join(", ")}`
      : "Current medications: none on file";

  return [
    `Patient language preference: ${patientLanguage || "en"}`,
    problemStr,
    medStr,
    "",
    `Patient description: ${symptomText.slice(0, 2000)}`,
  ].join("\n");
}

function parseTriageResponse(raw: string): TriageResult | null {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
    const parsed = JSON.parse(cleaned);
    const validUrgencies: TriageUrgency[] = [
      "call-911",
      "same-day",
      "within-3-days",
      "within-2-weeks",
    ];
    const validVisitTypes: TriageVisitType[] = [
      "in-person",
      "telehealth",
      "urgent-care",
    ];
    if (
      !validUrgencies.includes(parsed.urgency) ||
      !validVisitTypes.includes(parsed.visitType) ||
      typeof parsed.reasoning !== "string" ||
      !Array.isArray(parsed.warningSymptoms)
    ) {
      return null;
    }
    return {
      urgency: parsed.urgency,
      visitType: parsed.visitType,
      reasoning: String(parsed.reasoning).slice(0, 500),
      warningSymptoms: (parsed.warningSymptoms as unknown[])
        .filter((s) => typeof s === "string")
        .slice(0, 5) as string[],
    };
  } catch {
    return null;
  }
}

/**
 * triageSchedulingRequest — calls Vertex gemini-2.5-flash to classify a
 * patient's free-text symptom description and returns a structured triage
 * result. Fails open to SAFE_DEFAULT on any error.
 *
 * @param symptomText      Patient free-text description (PHI — server-side only)
 * @param patientLanguage  BCP-47 language code, e.g. "en", "es", "hi"
 * @param patientProblems  Active problem names from the chart (PHI context)
 * @param patientMedications Active medication names from the chart (PHI context)
 */
export async function triageSchedulingRequest(
  symptomText: string,
  patientLanguage: string,
  patientProblems: string[],
  patientMedications: string[]
): Promise<TriageResult> {
  if (!symptomText?.trim()) {
    return SAFE_DEFAULT;
  }

  if (!isAiConfigured()) {
    console.warn("[ai-scheduling-triage] AI not configured — returning safe default");
    return SAFE_DEFAULT;
  }

  try {
    const res = await baaChatFetch({
      body: {
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: buildUserMessage(
              symptomText,
              patientLanguage,
              patientProblems,
              patientMedications
            ),
          },
        ],
        max_tokens: 512,
        temperature: 0.1,
      },
    });

    if (!res.ok) {
      console.error(
        `[ai-scheduling-triage] Vertex returned ${res.status} — using safe default`
      );
      return SAFE_DEFAULT;
    }

    const data = (await res.json()) as any;
    const content: string = data?.choices?.[0]?.message?.content ?? "";

    const parsed = parseTriageResponse(content);
    if (!parsed) {
      console.warn(
        "[ai-scheduling-triage] Could not parse model response — using safe default"
      );
      return SAFE_DEFAULT;
    }

    return parsed;
  } catch (err: any) {
    console.error(
      "[ai-scheduling-triage] Error calling Vertex:",
      err?.message ?? err
    );
    return SAFE_DEFAULT;
  }
}
