/**
 * The complete chart/notes summarization connector.
 *
 * One evaluation across every source connected for a person — eCW (or any
 * other EHR connection), Fasten Health-aggregated external records, and this
 * app's own PHR entries — because they already land in the same unified
 * storage tables under a shared `unifiedPatientId` (see
 * `server/services/patient-identity-resolution.ts`); what was missing was a
 * summarizer that actually queried across that identity instead of one
 * connection's rows, and one that could not silently fabricate a fact the
 * chart does not contain.
 *
 * Facts in, narrative out, nothing here is a diagnosis. `fact-gatherer.ts`
 * builds the closed set of what is actually on file; `narrative-builder.ts`
 * may only phrase and cite it.
 */

import { logPhiAccess } from "../../security/hipaa-audit";
import { gatherChartFacts } from "./fact-gatherer";
import { buildNarrative, type NarrativeOptions } from "./narrative-builder";
import type { CompleteChartSummary, SummaryRefused } from "@shared/complete-chart-summary";

export interface BuildSummaryOptions extends NarrativeOptions {
  /** Caller identity, for the audit log. */
  requestedBy: string;
}

export type BuildSummaryResult =
  | { summary: CompleteChartSummary; refused: null }
  | { summary: null; refused: SummaryRefused };

const DISCLAIMER =
  "AI-organized summary of this patient's own records across every connected source. " +
  "Every statement is grounded in the listed facts; nothing here is a diagnosis, " +
  "recommendation, or clinical decision support. A clinician must verify against the " +
  "source records before relying on it.";

export async function buildCompleteChartSummary(
  unifiedPatientId: string,
  options: BuildSummaryOptions,
): Promise<BuildSummaryResult> {
  const { factSet, refused } = await gatherChartFacts(unifiedPatientId);
  if (!factSet) {
    return { summary: null, refused: refused! };
  }

  const { sections, discardedReferences, unverifiedNarrative } = await buildNarrative(factSet, options);

  await logPhiAccess({
    userId: options.requestedBy,
    patientId: unifiedPatientId,
    resourceType: "complete-chart-summary",
    action: "read",
    details:
      `${factSet.facts.length} fact(s) across ${Object.keys(factSet.sourceCounts).length} source(s); ` +
      `${sections.length} section(s); ${discardedReferences.length} discarded citation(s); ` +
      `narrative ${unverifiedNarrative ? "template fallback" : "AI-generated"}`,
  });

  return {
    summary: {
      unifiedPatientId,
      facts: factSet.facts,
      sections,
      discardedReferences,
      unverifiedNarrative,
      sourceCounts: factSet.sourceCounts,
      disclaimer: DISCLAIMER,
      generatedAt: new Date().toISOString(),
    },
    refused: null,
  };
}
