/**
 * Referral composition against a chosen NPPES provider.
 *
 * Takes the provider the user selected (by voice or by click) plus the
 * patient's clinical context and produces a referral letter draft addressed to
 * that specific NPI.
 *
 * ── BAA ──
 * The prompt carries PHI, so it goes through `baaChatFetch`, which routes to
 * Vertex AI under the existing Google BAA. It must never be sent to the
 * consumer OpenAI endpoint. (`server/referral-letter-service.ts`, the older
 * path, still calls OpenAI directly — that is pre-existing and tracked
 * separately; new PHI paths do not inherit it.)
 *
 * ── Degradation ──
 * When AI is unavailable the composer returns a deterministic template rather
 * than failing. A referral is a clinical workflow step; a clinician who cannot
 * generate a letter because a model is down will simply write one by hand, and
 * the structured draft is more useful than an error. `aiGenerated` records
 * which path produced the text so the UI never implies review of AI output
 * that never happened.
 */

import { baaChatFetch, isAiConfigured } from "../../lib/baa-chat";
import type { ProviderResult } from "./nppes-client";

export interface ReferralPatientContext {
  name: string;
  age: number;
  /** ISO date. */
  dateOfBirth?: string;
  gender?: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
}

export interface ReferralRequest {
  patient: ReferralPatientContext;
  /** The provider chosen from the pick list. */
  provider: ProviderResult;
  /** Why the referral is being made. */
  reason: string;
  urgency: "routine" | "urgent" | "emergent";
  referringClinician: string;
  referringClinic: string;
  /** Optional relevant results to include. */
  pertinentFindings?: string[];
  additionalNotes?: string;
}

export interface ReferralDraft {
  id: string;
  generatedAt: string;
  /** The NPI the referral is addressed to. */
  addressedToNpi: string;
  addressedToName: string;
  specialty: string;
  urgency: string;
  letterContent: string;
  /** False when the deterministic template produced this text. */
  aiGenerated: boolean;
  status: "draft";
  disclaimer: string;
}

const DISCLAIMER =
  "Auto-generated draft. Requires clinician review, correction, and signature before sending. Provider details come from the CMS NPPES registry and confirm enrolment only — verify the address, network participation, and that the provider accepts this referral.";

/**
 * House style for generated clinical text in this codebase: descriptive, never
 * prescriptive. The letter records what the chart shows; it does not tell the
 * receiving clinician what to do.
 */
const SYSTEM_PROMPT = `You draft outpatient referral letters from structured clinical data.

RULES:
- Report only what the supplied data states. Never infer, diagnose, or add findings.
- Be descriptive, not prescriptive. Do not write "should", "must", "recommend", "advise", or "needs".
- Do not state a probability or likelihood of any diagnosis.
- Omit a section entirely rather than writing "none documented" for every empty field.
- Format as a professional referral letter with a clear reason for referral.
- Keep it under 400 words.`;

function buildUserPrompt(request: ReferralRequest): string {
  const p = request.patient;
  const lines = [
    `Referring to: ${request.provider.name}${
      request.provider.credential ? `, ${request.provider.credential}` : ""
    } (${request.provider.specialty}), NPI ${request.provider.npi}`,
    `Practice: ${[
      request.provider.address.line1,
      request.provider.address.city,
      request.provider.address.state,
      request.provider.address.zip,
    ]
      .filter(Boolean)
      .join(", ")}`,
    "",
    `Patient: ${p.name}`,
    p.dateOfBirth ? `Date of birth: ${p.dateOfBirth}` : "",
    `Age: ${p.age}`,
    p.gender ? `Gender: ${p.gender}` : "",
    p.conditions.length ? `Active problems: ${p.conditions.join("; ")}` : "",
    p.medications.length ? `Current medications: ${p.medications.join("; ")}` : "",
    `Allergies: ${p.allergies.length ? p.allergies.join("; ") : "No known drug allergies"}`,
    "",
    `Reason for referral: ${request.reason}`,
    `Urgency: ${request.urgency}`,
    request.pertinentFindings?.length
      ? `Pertinent findings: ${request.pertinentFindings.join("; ")}`
      : "",
    request.additionalNotes ? `Additional notes: ${request.additionalNotes}` : "",
    "",
    `From: ${request.referringClinician}, ${request.referringClinic}`,
  ];
  return lines.filter((l) => l !== "").join("\n");
}

/** Deterministic fallback. Structured, complete, and obviously a draft. */
export function buildTemplateReferral(request: ReferralRequest): string {
  const p = request.patient;
  const provider = request.provider;
  const address = [
    provider.address.line1,
    provider.address.line2,
    [provider.address.city, provider.address.state, provider.address.zip]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);

  const section = (title: string, body: string[]): string[] =>
    body.length ? [`${title}:`, ...body.map((b) => `  - ${b}`), ""] : [];

  return [
    `${provider.name}${provider.credential ? `, ${provider.credential}` : ""}`,
    provider.specialty,
    ...address,
    `NPI: ${provider.npi}`,
    "",
    `RE: ${p.name}${p.dateOfBirth ? ` (DOB ${p.dateOfBirth})` : ""}, age ${p.age}`,
    `Urgency: ${request.urgency}`,
    "",
    "Dear Colleague,",
    "",
    `Thank you for seeing this patient. Reason for referral: ${request.reason}`,
    "",
    ...section("Active problems", p.conditions),
    ...section("Current medications", p.medications),
    ...section(
      "Allergies",
      p.allergies.length ? p.allergies : ["No known drug allergies"],
    ),
    ...section("Pertinent findings", request.pertinentFindings ?? []),
    ...(request.additionalNotes ? [`Notes: ${request.additionalNotes}`, ""] : []),
    "The chart is available on request.",
    "",
    "Kind regards,",
    request.referringClinician,
    request.referringClinic,
  ].join("\n");
}

/**
 * Compose a referral draft.
 *
 * `fetchImpl` is injected for tests; production uses the BAA-routed helper.
 */
export async function composeReferral(
  request: ReferralRequest,
  opts: { chatFetch?: typeof baaChatFetch; aiConfigured?: () => boolean } = {},
): Promise<ReferralDraft> {
  const chat = opts.chatFetch ?? baaChatFetch;
  const configured = (opts.aiConfigured ?? isAiConfigured)();

  let letterContent = buildTemplateReferral(request);
  let aiGenerated = false;

  if (configured) {
    try {
      const response = await chat({
        body: {
          model: "gpt-4o",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(request) },
          ],
          temperature: 0.2,
          max_tokens: 900,
        },
      });

      if (response.ok) {
        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = payload.choices?.[0]?.message?.content?.trim();
        if (text) {
          letterContent = text;
          aiGenerated = true;
        }
      }
    } catch {
      // Fall through to the template. A referral workflow must not break
      // because a model endpoint is unavailable.
    }
  }

  return {
    id: `ref-${request.provider.npi}-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    addressedToNpi: request.provider.npi,
    addressedToName: request.provider.name,
    specialty: request.provider.specialty,
    urgency: request.urgency,
    letterContent,
    aiGenerated,
    status: "draft",
    disclaimer: DISCLAIMER,
  };
}
