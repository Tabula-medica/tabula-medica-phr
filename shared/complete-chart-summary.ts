/**
 * Types for the complete chart/notes summarization connector.
 *
 * The point of this connector — across eCW, Fasten Health-aggregated
 * records, and this app's own PHR entries — is a single evidence-linked
 * summary rather than four disconnected AI narratives. Same discipline as
 * `shared/medicare-care-gaps.ts` and the ambient-scribe note builder: a
 * narrative sentence is only as good as the fact ids it cites, and a
 * sentence that cites nothing in the closed fact set is dropped, not kept.
 */

export type ChartFactCategory =
  | "note"
  | "diagnosis"
  | "procedure"
  | "imaging"
  | "lab_result_record"
  | "problem"
  | "medication"
  | "lab_result"
  | "vital"
  | "allergy"
  | "immunization"
  | "family_history"
  | "uploaded_document";

/** Where a fact came from, for per-fact attribution (mirrors provenance-badge.tsx's shape). */
export interface FactProvenance {
  /** The internal `Patient` row (one EHR connection's identity) this fact belongs to. */
  patientRowId: string;
  ehrConnectionId?: string;
  /** e.g. "ecw" | "fastenhealth" | "epic" | "manual_entry". */
  platform?: string;
  facilityName?: string;
  lastSync?: string;
}

export interface ChartFact {
  /** Stable id: `${category}:${sourceRecordId}`. What the AI narrative must cite. */
  id: string;
  category: ChartFactCategory;
  /** ISO date this fact is anchored to, when known. */
  date?: string;
  /** One-line, deterministically rendered fact text. Never AI-generated. */
  text: string;
  provenance: FactProvenance;
}

export interface ChartFactSet {
  unifiedPatientId: string;
  facts: readonly ChartFact[];
  /** Fact count by source platform, for a coverage-at-a-glance check. */
  sourceCounts: Readonly<Record<string, number>>;
  generatedAt: string;
}

export type SummaryRefusalReason = "no-patient-rows" | "no-facts";

export interface SummaryRefused {
  reason: SummaryRefusalReason;
  detail: string;
}

export interface NarrativeSection {
  title: string;
  narrative: string;
  /** Fact ids this section's narrative is grounded in — always a subset of the ChartFactSet. */
  citedFactIds: readonly string[];
}

export interface CompleteChartSummary {
  unifiedPatientId: string;
  facts: readonly ChartFact[];
  sections: readonly NarrativeSection[];
  /**
   * Fact ids the model referenced that were not in the closed set the facts
   * were built from. Always empty in a well-behaved response; non-empty
   * means a hallucinated citation was caught and discarded before it reached
   * the caller.
   */
  discardedReferences: readonly string[];
  /** True when the AI pass failed/was unavailable and sections are the deterministic fallback. */
  unverifiedNarrative: boolean;
  sourceCounts: Readonly<Record<string, number>>;
  disclaimer: string;
  generatedAt: string;
}
