/**
 * Build the shareable health summary. Pure — no DB, no clock, no randomness.
 *
 * The caller supplies the same row shapes `ips-generator.ts` collects, so the
 * two views of a patient's medications, problems and allergies cannot drift
 * apart. Purity matters for the same reason it does there: this output is
 * rendered to a third party who may act on it, and a function that reads the
 * clock or the environment produces a document nobody can reproduce when they
 * later need to ask what the reader actually saw.
 *
 * ## Ordering
 *
 * Allergies render first, then medications, then diagnoses — regardless of
 * the order the caller listed the sections. Every clinical handover format
 * that exists leads with allergies, because an allergy is the thing that
 * stops a prescription, and a reader who scrolls past it has already made the
 * decision it was meant to inform.
 *
 * ## Inactive entries are shown, not dropped
 *
 * A stopped medication is clinically live information: warfarin discontinued
 * last week still governs what is safe to give today. Filtering to `active`
 * would produce a shorter, cleaner, more dangerous list. Non-active entries
 * are therefore included, sorted after the active ones and labelled with
 * their status, so the reader can discount them deliberately rather than
 * never learning they existed.
 */

import {
  SUMMARY_SECTIONS,
  type HealthSummary,
  type SummaryAttestations,
  type SummaryLine,
  type SummarySection,
  type SummarySectionRender,
} from "@shared/health-summary";
import type {
  IpsAllergyInput,
  IpsMedicationInput,
  IpsProblemInput,
} from "../world/ips-generator";
import { summaryStrings, type SummaryStrings } from "./summary-strings";

export interface SummaryRenderInput {
  patientName: string;
  medications: readonly IpsMedicationInput[];
  problems: readonly IpsProblemInput[];
  allergies: readonly IpsAllergyInput[];
  attestations?: SummaryAttestations;
  /** Sections the patient chose to share. */
  sections: readonly SummarySection[];
  /** ISO 8601, injected so the builder stays pure. */
  generatedAt: string;
  /** ISO 8601 expiry of the link carrying this summary, for the footer. */
  expiresAt?: string;
  language: string;
}

/** Safety-first render order, independent of what the caller asked for. */
const RENDER_ORDER: readonly SummarySection[] = ["allergies", "medications", "diagnoses"];

/** Statuses that mean "currently true". Everything else sorts after and is labelled. */
const ACTIVE_STATUSES = new Set(["active", "current", "ongoing", "confirmed", ""]);

function isActive(status?: string | null): boolean {
  return ACTIVE_STATUSES.has((status ?? "").trim().toLowerCase());
}

/** Join the parts of a detail line, dropping blanks so no stray separators show. */
function detail(...parts: (string | null | undefined)[]): string | undefined {
  const kept = parts
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter((p) => p.length > 0);
  return kept.length > 0 ? kept.join(" · ") : undefined;
}

/**
 * Stable sort: active entries first, then alphabetical within each group.
 *
 * Alphabetical rather than insertion order because insertion order is an
 * artefact of how the data was entered, and a reader scanning for one drug
 * needs a predictable place to look.
 */
function orderLines(lines: (SummaryLine & { active: boolean })[]): SummaryLine[] {
  return [...lines]
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return a.primary.localeCompare(b.primary);
    })
    .map(({ active: _active, ...line }) => line);
}

function medicationLines(meds: readonly IpsMedicationInput[]): SummaryLine[] {
  return orderLines(
    meds.map((m) => ({
      primary: m.name,
      secondary: detail(m.dose, m.frequency),
      status: isActive(m.status) ? undefined : (m.status ?? undefined),
      active: isActive(m.status),
    })),
  );
}

function problemLines(problems: readonly IpsProblemInput[]): SummaryLine[] {
  return orderLines(
    problems.map((p) => ({
      primary: p.name,
      secondary: detail(p.onsetDate ?? undefined),
      status: isActive(p.status) ? undefined : (p.status ?? undefined),
      active: isActive(p.status),
    })),
  );
}

function allergyLines(allergies: readonly IpsAllergyInput[]): SummaryLine[] {
  return orderLines(
    allergies.map((a) => ({
      primary: a.allergen,
      // Reaction before severity: "anaphylaxis" is the fact that changes
      // behaviour, and severity without a reaction is close to meaningless.
      secondary: detail(a.reaction, a.severity),
      status: isActive(a.status) ? undefined : (a.status ?? undefined),
      active: isActive(a.status),
    })),
  );
}

function buildSection(
  key: SummarySection,
  lines: SummaryLine[],
  attested: boolean,
  s: SummaryStrings,
): SummarySectionRender {
  const heading =
    key === "medications"
      ? s.headingMedications
      : key === "diagnoses"
        ? s.headingDiagnoses
        : s.headingAllergies;

  if (lines.length > 0) return { key, heading, lines };

  // Empty. Which kind of empty is the whole question — see EmptyStateKind.
  const attestedText =
    key === "medications"
      ? s.attestedNoneMedications
      : key === "diagnoses"
        ? s.attestedNoneDiagnoses
        : s.attestedNoneAllergies;
  const notRecordedText =
    key === "medications"
      ? s.notRecordedMedications
      : key === "diagnoses"
        ? s.notRecordedDiagnoses
        : s.notRecordedAllergies;

  return {
    key,
    heading,
    lines: [],
    emptyState: attested
      ? { kind: "attested-none", text: attestedText }
      : { kind: "not-recorded", text: notRecordedText },
  };
}

export function buildHealthSummary(input: SummaryRenderInput): HealthSummary {
  const { strings, language, fellBackToEnglish } = summaryStrings(input.language);
  const attestations = input.attestations ?? {};

  const requested = new Set(input.sections);
  const sections: SummarySectionRender[] = [];

  for (const key of RENDER_ORDER) {
    if (!requested.has(key)) continue;

    if (key === "allergies") {
      sections.push(
        buildSection(
          key,
          allergyLines(input.allergies),
          attestations.noKnownAllergies === true,
          strings,
        ),
      );
    } else if (key === "medications") {
      sections.push(
        buildSection(
          key,
          medicationLines(input.medications),
          attestations.noKnownMedications === true,
          strings,
        ),
      );
    } else {
      sections.push(
        buildSection(
          key,
          problemLines(input.problems),
          attestations.noKnownProblems === true,
          strings,
        ),
      );
    }
  }

  const warnings: string[] = [];

  // The allergy caveat is a warning rather than only an empty-state line
  // because it has to be visible to a reader who never scrolls that far.
  const allergySection = sections.find((s) => s.key === "allergies");
  if (allergySection?.emptyState?.kind === "not-recorded") {
    warnings.push(strings.warningAllergiesUnknown);
  }

  // A withheld section is not an empty one, and a reader cannot tell the
  // difference from the page alone — so the page says which it is.
  if (requested.size < SUMMARY_SECTIONS.length) {
    warnings.push(strings.warningPartialShare);
  }

  return {
    patientName: input.patientName,
    generatedAt: input.generatedAt,
    language,
    fellBackToEnglish,
    sections,
    warnings,
    disclaimer: strings.disclaimer,
  };
}

/**
 * Flatten a summary to plain text.
 *
 * Not for SMS — the gate refuses to put any of this in a message body. This
 * exists for the "copy to clipboard" affordance on the share page and for
 * pasting into another system's free-text field, which is what a receiving
 * clinic without an interop connection will actually do with it.
 */
export function summaryToPlainText(summary: HealthSummary): string {
  const lines: string[] = [summary.patientName, ""];

  for (const warning of summary.warnings) lines.push(`! ${warning}`, "");

  for (const section of summary.sections) {
    lines.push(`${section.heading}:`);
    if (section.emptyState) {
      lines.push(`  ${section.emptyState.text}`);
    } else {
      for (const line of section.lines) {
        const suffix = detail(line.secondary, line.status);
        lines.push(`  - ${line.primary}${suffix ? ` (${suffix})` : ""}`);
      }
    }
    lines.push("");
  }

  lines.push(summary.disclaimer);
  return lines.join("\n");
}
