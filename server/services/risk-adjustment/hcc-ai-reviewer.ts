/**
 * AI layer over the deterministic HCC findings.
 *
 * ## What the model is allowed to do
 *
 * The model receives a *closed candidate list* — the suspects and recapture gaps
 * that the deterministic rules already produced — and may only rank them, explain
 * them, and draft documentation language. It cannot introduce a condition that
 * was not already evidenced by structured data.
 *
 * That constraint is the whole design. A language model asked to "find HCCs in
 * this chart" will produce fluent, confident, unfalsifiable suggestions, and some
 * of them will be wrong in the direction of more revenue. Restricting it to
 * re-presenting a list built by explicit rules means a hallucination can make the
 * output less useful but cannot make it fraudulent. Anything the model emits that
 * is not in the candidate list is dropped before the caller sees it — enforced in
 * code below, not merely requested in the prompt.
 *
 * PHI goes to Vertex via `baaChatFetch` (Google BAA), never the consumer OpenAI
 * endpoint. When AI is unconfigured the deterministic findings are returned
 * as-is; the feature degrades to plainer text rather than failing.
 */

import { baaChatFetch, isAiConfigured } from "../../lib/baa-chat";
import type { RecaptureGap } from "./documentation-gaps";
import type { SuspectHit } from "./suspect-rules";

export interface HccWorklistItem {
  /** Stable id: the suspect rule id, or `recapture:<icd10>`. */
  id: string;
  kind: "suspect" | "recapture";
  condition: string;
  candidateIcd10: readonly string[];
  /** Objective findings supporting the item, in clinician-readable form. */
  evidence: readonly string[];
  /** What the clinician must confirm before this can be coded. */
  requiresConfirmation: string;
  /** Drafted assessment/plan language. Always a draft, never auto-filed. */
  suggestedDocumentation?: string;
  /** Ordering hint, 1 = review first. */
  priority: number;
  /** True when an AI pass contributed to this item's wording. */
  aiGenerated: boolean;
}

export interface HccReviewResult {
  items: readonly HccWorklistItem[];
  aiGenerated: boolean;
  /** Always present. Surfaced in the UI next to the worklist. */
  disclaimer: string;
}

const DISCLAIMER =
  "Suggestions only. Nothing here is coded, submitted, or added to the chart. Each " +
  "item requires a clinician to confirm the diagnosis on a face-to-face encounter " +
  "and document the clinical basis. Codes must reflect the patient's condition, not " +
  "the suggestion.";

/** Deterministic worklist — the fallback, and the closed candidate set. */
export function buildTemplateWorklist(
  suspects: readonly SuspectHit[],
  recaptures: readonly RecaptureGap[],
): HccWorklistItem[] {
  const items: HccWorklistItem[] = [];

  for (const hit of suspects) {
    items.push({
      id: hit.rule.id,
      kind: "suspect",
      condition: hit.rule.condition,
      candidateIcd10: hit.rule.candidateIcd10,
      evidence: hit.evidence.map((e) =>
        e.observedAt ? `${e.finding} (${e.observedAt.slice(0, 10)})` : e.finding,
      ),
      requiresConfirmation: hit.rule.requiresConfirmation,
      // Strong rules rest on objective, hard-to-dispute findings, so they are
      // both the most likely to be real and the fastest for a clinician to
      // settle. They go first.
      priority: hit.rule.strength === "strong" ? 1 : 2,
      aiGenerated: false,
    });
  }

  for (const gap of recaptures) {
    items.push({
      id: `recapture:${gap.icd10}`,
      kind: "recapture",
      condition: gap.name ?? gap.icd10,
      candidateIcd10: [gap.icd10],
      evidence: [`Coded in ${gap.lastCodedYear}, not yet re-documented in the current year`],
      requiresConfirmation: gap.action,
      priority: 1,
      aiGenerated: false,
    });
  }

  return items.sort((a, b) => a.priority - b.priority || a.condition.localeCompare(b.condition));
}

interface AiRankedItem {
  id?: unknown;
  priority?: unknown;
  suggestedDocumentation?: unknown;
}

/** Options exist so tests can inject a fetch and skip the network. */
export interface ReviewOptions {
  chatFetch?: typeof baaChatFetch;
  aiConfigured?: boolean;
}

export async function reviewHccOpportunities(
  suspects: readonly SuspectHit[],
  recaptures: readonly RecaptureGap[],
  options: ReviewOptions = {},
): Promise<HccReviewResult> {
  const candidates = buildTemplateWorklist(suspects, recaptures);
  const configured = options.aiConfigured ?? isAiConfigured();

  if (candidates.length === 0 || !configured) {
    return { items: candidates, aiGenerated: false, disclaimer: DISCLAIMER };
  }

  const chat = options.chatFetch ?? baaChatFetch;
  const byId = new Map(candidates.map((c) => [c.id, c]));

  const prompt = [
    "You are assisting a clinician reviewing possible under-documented conditions.",
    "",
    "You may ONLY work with the candidate list below. Do not add conditions, do not",
    "infer additional diagnoses, and do not change any candidate's ICD-10 codes.",
    "For each candidate, return its id, a priority from 1 (review first) to 5, and",
    "one or two sentences of draft assessment-and-plan language the clinician could",
    "edit. Draft language must describe only what the listed evidence supports.",
    "",
    "Respond with JSON only: {\"items\":[{\"id\":...,\"priority\":...,\"suggestedDocumentation\":...}]}",
    "",
    "Candidates:",
    JSON.stringify(
      candidates.map((c) => ({
        id: c.id,
        condition: c.condition,
        evidence: c.evidence,
        mustConfirm: c.requiresConfirmation,
      })),
      null,
      2,
    ),
  ].join("\n");

  try {
    const response = await chat({
      body: {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1200,
        temperature: 0.2,
      },
    });

    if (!response.ok) return { items: candidates, aiGenerated: false, disclaimer: DISCLAIMER };

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return { items: candidates, aiGenerated: false, disclaimer: DISCLAIMER };

    const jsonStart = content.indexOf("{");
    const jsonEnd = content.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd <= jsonStart) {
      return { items: candidates, aiGenerated: false, disclaimer: DISCLAIMER };
    }

    const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1)) as {
      items?: AiRankedItem[];
    };
    if (!Array.isArray(parsed.items)) {
      return { items: candidates, aiGenerated: false, disclaimer: DISCLAIMER };
    }

    // Enforce the closed candidate set in code. Any id the model invented is
    // discarded here — this is the line that makes a hallucination harmless.
    const merged = new Map(candidates.map((c) => [c.id, { ...c }]));
    let touched = false;

    for (const raw of parsed.items) {
      const id = typeof raw.id === "string" ? raw.id : null;
      if (!id) continue;
      const target = byId.get(id) ? merged.get(id) : undefined;
      if (!target) continue;

      if (typeof raw.priority === "number" && Number.isFinite(raw.priority)) {
        target.priority = Math.min(5, Math.max(1, Math.round(raw.priority)));
        touched = true;
      }
      if (typeof raw.suggestedDocumentation === "string" && raw.suggestedDocumentation.trim()) {
        target.suggestedDocumentation = raw.suggestedDocumentation.trim();
        target.aiGenerated = true;
        touched = true;
      }
    }

    const items = Array.from(merged.values()).sort(
      (a, b) => a.priority - b.priority || a.condition.localeCompare(b.condition),
    );

    return { items, aiGenerated: touched, disclaimer: DISCLAIMER };
  } catch {
    // Any failure — network, BAA misconfiguration, malformed JSON — falls back
    // to the deterministic list rather than surfacing an error to the clinician.
    return { items: candidates, aiGenerated: false, disclaimer: DISCLAIMER };
  }
}
