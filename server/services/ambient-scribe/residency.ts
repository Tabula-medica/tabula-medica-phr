/**
 * Where the audio and the transcript are allowed to be processed.
 *
 * The NHA call specifies deployment "on NHA-approved infrastructure". That is
 * not a deployment detail to be handled later by whoever writes the Terraform:
 * it is a property every single inference request has to satisfy, and the only
 * place it can be enforced is immediately before the request is made.
 *
 * ## The specific hazard
 *
 * This repo's BAA-safe AI helper, `server/lib/baa-chat.ts`, defaults to Vertex
 * AI in `us-central1`. That default is correct for the US product — Vertex runs
 * under the existing Google BAA, which is exactly what HIPAA needs. Applied
 * unchanged to an Indian consultation it sends a recording of an Indian
 * patient's voice to Iowa. Nothing in the existing code would stop it, nothing
 * would log it as unusual, and the feature would work perfectly.
 *
 * A BAA is a US instrument. It answers a HIPAA question and says nothing about
 * where data may sit for a Data Fiduciary under the DPDP Act, and nothing at
 * all about what NHA will approve for infrastructure hosting ABDM records. So
 * residency is checked as its own condition rather than being assumed to
 * follow from the BAA being in place.
 *
 * ## Configured, not hardcoded
 *
 * The approved region list is set by the operator, because only the operator
 * knows what NHA approved for their deployment. An **unset list refuses**: a
 * deployment that has not stated where it may process Indian audio may not
 * process Indian audio. The failure mode of the opposite default — assume the
 * ambient region is fine — is silent and unrecoverable, since the data has
 * already left by the time anyone checks.
 */

import type { ScribeRefusal } from "@shared/ambient-scribe";

/** ISO 3166-1 alpha-2, matching `shared/jurisdictions.ts`. */
export type Jurisdiction = string;

/**
 * The region this process will actually send inference to.
 *
 * Falls through to `VERTEX_LOCATION` because that is what `baa-chat.ts` uses;
 * reading the same variable is what makes this check describe reality rather
 * than a parallel setting somebody forgot to keep in step.
 */
export function inferenceRegion(): string | null {
  return (
    process.env.SCRIBE_INFERENCE_REGION ||
    process.env.VERTEX_LOCATION ||
    null
  );
}

/**
 * Regions the operator has confirmed are approved for a jurisdiction's data.
 *
 * `SCRIBE_RESIDENCY_REGIONS_IN=asia-south1,asia-south2` for India. The suffix
 * is the jurisdiction code, so adding a country is configuration rather than
 * a code change.
 */
export function approvedRegions(jurisdiction: Jurisdiction): readonly string[] {
  const raw = process.env[`SCRIBE_RESIDENCY_REGIONS_${jurisdiction.toUpperCase()}`];
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export type ResidencyDecision =
  | { ok: true; jurisdiction: Jurisdiction; region: string }
  | {
      ok: false;
      reason: Extract<ScribeRefusal, "residency-not-configured" | "residency-violation">;
      detail: string;
    };

/**
 * Decide whether this process may handle a consultation for this jurisdiction.
 *
 * Called before audio is accepted, not after transcription — the point is to
 * refuse before the data exists in a place it should not be, and a check that
 * runs on the way out has already lost.
 */
export function checkResidency(jurisdiction: Jurisdiction): ResidencyDecision {
  const region = inferenceRegion();
  const approved = approvedRegions(jurisdiction);

  if (approved.length === 0) {
    return {
      ok: false,
      reason: "residency-not-configured",
      detail:
        `SCRIBE_RESIDENCY_REGIONS_${jurisdiction.toUpperCase()} is unset, so no processing ` +
        `region has been approved for ${jurisdiction}. Refusing rather than falling back ` +
        "to the ambient inference region: for an Indian consultation that region is " +
        "us-central1 by default, and a recording that has already crossed a border " +
        "cannot be un-sent.",
    };
  }

  if (!region) {
    return {
      ok: false,
      reason: "residency-not-configured",
      detail:
        "Neither SCRIBE_INFERENCE_REGION nor VERTEX_LOCATION is set, so this process " +
        "cannot say where it would send audio. An unknown region cannot be checked " +
        "against an approved list.",
    };
  }

  if (!approved.includes(region.toLowerCase())) {
    return {
      ok: false,
      reason: "residency-violation",
      detail:
        `Inference is configured for "${region}", which is not among the regions approved ` +
        `for ${jurisdiction} (${approved.join(", ")}). A Business Associate Agreement does ` +
        "not answer this question — it is a HIPAA instrument and says nothing about where " +
        "a Data Fiduciary may process personal data under the DPDP Act, or what NHA has " +
        "approved for infrastructure hosting ABDM records.",
    };
  }

  return { ok: true, jurisdiction, region };
}
