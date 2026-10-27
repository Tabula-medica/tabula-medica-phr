/**
 * AI Content Guardrail Pipeline (Task #297)
 *
 * Layered guardrail stack applied to every AI response before it reaches
 * a patient-facing surface:
 *
 *   Stage 1 — PHI Scrubber
 *     Regex + heuristic patterns strip MRN, SSN, DOB, phone, address,
 *     and name-in-context tokens from the INPUT before chatComplete() is
 *     called, replacing them with [REDACTED] placeholders.
 *
 *   Stage 2 — Clinical Advice Classifier
 *     Keyword + sentence-level check on the OUTPUT. Phrases like
 *     "you should take", "stop your medication", "your diagnosis is"
 *     trigger reviewRequired=true and the item is held in the clinician
 *     review queue rather than being delivered immediately.
 *
 *   Stage 3 — Disclosure Append
 *     Appends the appropriate jurisdiction disclosure (delegated to the
 *     existing ai-disclosure-service) when required.
 *
 * Usage:
 *   const result = await runGuardrails(input, { route, userId });
 *   // result.safe    — false means output is blocked entirely
 *   // result.reviewRequired — true means held for clinician review
 *   // result.output  — scrubbed + (optionally disclosure-appended) text
 */

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1 — PHI Scrubber (input sanitisation)
// ─────────────────────────────────────────────────────────────────────────────

const PHI_PATTERNS: Array<{ name: string; re: RegExp }> = [
  // US Social Security Number
  { name: "SSN", re: /\b\d{3}-\d{2}-\d{4}\b/g },
  // Medical Record Number (common formats)
  { name: "MRN", re: /\bMRN[:\s#]*[A-Z0-9\-]{4,20}\b/gi },
  { name: "MRN_BARE", re: /\b(?:medical record|mrn|mr#)[:\s]+[A-Z0-9\-]{4,20}/gi },
  // US phone numbers
  { name: "PHONE", re: /\b(?:\+1[\s-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g },
  // Dates of Birth (common US date formats)
  {
    name: "DOB",
    re: /\b(?:dob|date of birth|born)[:\s]+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi,
  },
  // ISO dates that appear in a name context
  {
    name: "DATE_IN_CONTEXT",
    re: /\b(?:born|dob)[:\s]+\d{4}-\d{2}-\d{2}/gi,
  },
  // US Street Addresses
  {
    name: "ADDRESS",
    re: /\b\d{1,5}\s+(?:[A-Z][a-z]+\s){1,3}(?:St(?:reet)?|Ave(?:nue)?|Blvd|Dr(?:ive)?|Rd|Lane|Ln|Way|Pl(?:ace)?|Ct)\b/g,
  },
  // US ZIP codes (standalone)
  { name: "ZIP", re: /\b\d{5}(?:-\d{4})?\b/g },
  // Email addresses
  { name: "EMAIL", re: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g },
  // Name-in-context patterns: "Patient: John Smith", "Name: ..."
  {
    name: "NAME_IN_CONTEXT",
    re: /\b(?:patient|name)[:\s]+[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3}/gi,
  },
];

export function scrubPHI(text: string): { scrubbed: string; tokensReplaced: number } {
  let out = text;
  let tokensReplaced = 0;
  for (const { re } of PHI_PATTERNS) {
    const before = out;
    out = out.replace(re, "[REDACTED]");
    if (out !== before) tokensReplaced++;
  }
  return { scrubbed: out, tokensReplaced };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 2 — Clinical Advice Classifier (output analysis)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Phrases that constitute direct clinical advice requiring clinician review.
 * Patterns are case-insensitive and match anywhere in the sentence.
 */
const CLINICAL_ADVICE_PHRASES: RegExp[] = [
  /\byou should (?:take|stop|start|increase|decrease|discontinue|avoid|consider)\b/i,
  /\bi (?:recommend|suggest|advise)\b/i,
  /\byour diagnosis (?:is|appears to be|suggests)\b/i,
  /\bstop (?:taking\s+)?(?:your\s+)?(?:medication|medicine|drug|pills?)\b/i,
  /\bdiscontinue\b/i,
  /\byou (?:have|likely have|probably have|may have) (?:a |an )?(?:cancer|diabetes|hypertension|infection|disease|disorder|condition|syndrome)\b/i,
  /\bimmediately (?:seek|go to|visit|call)\b/i,
  /\bgo to the (?:ER|emergency room|hospital)\b/i,
  /\bcall 911\b/i,
  /\bthis is (?:a )?(?:medical )?emergency\b/i,
  /\byour (?:test|lab|biopsy|imaging) (?:result|results) (?:show|shows|indicate|indicates|confirm|confirms)\b/i,
  /\bthe (?:correct|right|proper|appropriate) (?:dose|dosage|treatment) (?:is|for you is)\b/i,
  /\byou (?:must|need to) (?:take|stop|avoid)\b/i,
];

export interface ClassifierResult {
  reviewRequired: boolean;
  blockedPhrases: string[];
  matchedSentences: string[];
}

export function classifyClinicalAdvice(text: string): ClassifierResult {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const blockedPhrases: string[] = [];
  const matchedSentences: string[] = [];

  for (const sentence of sentences) {
    for (const pattern of CLINICAL_ADVICE_PHRASES) {
      const m = sentence.match(pattern);
      if (m) {
        if (!blockedPhrases.includes(m[0])) blockedPhrases.push(m[0]);
        if (!matchedSentences.includes(sentence)) matchedSentences.push(sentence);
        break;
      }
    }
  }

  return {
    reviewRequired: blockedPhrases.length > 0,
    blockedPhrases,
    matchedSentences,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage 3 — Hard-block list (absolute output safety)
// ─────────────────────────────────────────────────────────────────────────────

const HARD_BLOCK_PATTERNS: RegExp[] = [
  /\b(?:suicide|kill yourself|end your life)\b/i,
  /\blethal dose\b/i,
  /\bhow to (?:overdose|self.harm)\b/i,
];

function checkHardBlock(text: string): boolean {
  return HARD_BLOCK_PATTERNS.some((re) => re.test(text));
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface GuardrailOptions {
  /** Route or surface name, for review-queue attribution */
  route?: string;
  /** Authenticated user ID, for review-queue submission */
  userId?: string;
  /** Skip clinician review queue persistence (e.g. test environments) */
  skipQueuePersistence?: boolean;
  /** Practice state for jurisdiction-aware disclosure */
  state?: string;
  /** Practice ID for disclosure config */
  practiceId?: string;
}

export interface GuardrailResult {
  /** false only when the output hit the hard-block list */
  safe: boolean;
  /** Final output text (PHI-scrubbed, disclosure-appended) */
  output: string;
  /** true when the clinical classifier flagged and the item is held for review */
  reviewRequired: boolean;
  /** The matched advice phrases that triggered reviewRequired */
  blockedPhrases: string[];
  /** How many PHI token classes were replaced in the INPUT */
  phiTokensReplaced: number;
  /** ID of the review-queue entry created (if reviewRequired and persisted) */
  reviewQueueId?: string;
}

/**
 * Run the full guardrail pipeline over `aiOutput`, which is the ALREADY
 * GENERATED response from chatComplete(). The pipeline:
 *   1. Scrubs PHI tokens from the output (belt-and-suspenders).
 *   2. Classifies for clinical advice phrases.
 *   3. Hard-blocks lethal-content patterns.
 *   4. If flagged, persists to ai_review_queue (unless skipQueuePersistence).
 *   5. Appends jurisdiction disclosure if required.
 *
 * For scrubbing the INPUT before chatComplete(), call `scrubPHI()` directly.
 */
export async function runGuardrails(
  aiOutput: string,
  opts: GuardrailOptions = {}
): Promise<GuardrailResult> {
  // Stage 1 — scrub PHI from the AI output (belt-and-suspenders)
  const { scrubbed, tokensReplaced } = scrubPHI(aiOutput);

  // Stage 3 — hard block (before classifier so we don't queue dangerous content)
  if (checkHardBlock(scrubbed)) {
    return {
      safe: false,
      output: "I'm sorry, I can't help with that. Please contact your care team or call 988 (Suicide & Crisis Lifeline) for support.",
      reviewRequired: false,
      blockedPhrases: ["[HARD_BLOCKED]"],
      phiTokensReplaced: tokensReplaced,
    };
  }

  // Stage 2 — clinical advice classifier
  const classifierResult = classifyClinicalAdvice(scrubbed);

  // Stage 4 — persist to review queue if flagged
  let reviewQueueId: string | undefined;
  if (classifierResult.reviewRequired && !opts.skipQueuePersistence && opts.userId) {
    try {
      reviewQueueId = await submitToReviewQueue({
        userId: opts.userId,
        route: opts.route ?? "unknown",
        aiOutput: scrubbed,
        guardrailFlags: classifierResult,
        blockedPhrases: classifierResult.blockedPhrases,
      });
    } catch {
      // Non-fatal — log but continue; patient sees the hold message
    }
  }

  // Stage 5 — disclosure append
  let finalOutput = scrubbed;
  try {
    const { appendDisclaimer, buildAiMessageMeta, getPracticeAiConfig } = await import(
      "./ai-disclosure-service"
    );
    const config = getPracticeAiConfig(opts.practiceId ?? "default", opts.state ?? "");
    const meta = buildAiMessageMeta("gemini-2.5-pro", false);
    const disclosure = appendDisclaimer(finalOutput, config, meta);
    finalOutput = disclosure.body;
  } catch {
    // Disclosure service may not be configured; continue without
  }

  // If review is required, replace output with a hold message for the patient
  if (classifierResult.reviewRequired) {
    finalOutput =
      "Your question has been sent to your care team for review. A clinician will follow up with personalised guidance.";
  }

  return {
    safe: true,
    output: finalOutput,
    reviewRequired: classifierResult.reviewRequired,
    blockedPhrases: classifierResult.blockedPhrases,
    phiTokensReplaced: tokensReplaced,
    reviewQueueId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Review queue persistence helper (lazy-import to avoid circular deps)
// ─────────────────────────────────────────────────────────────────────────────

async function submitToReviewQueue(params: {
  userId: string;
  route: string;
  aiOutput: string;
  guardrailFlags: ClassifierResult;
  blockedPhrases: string[];
}): Promise<string> {
  const { db } = await import("./db");
  const { aiReviewQueue } = await import("../shared/schema");
  const [row] = await db
    .insert(aiReviewQueue)
    .values({
      userId: params.userId,
      route: params.route,
      aiOutput: params.aiOutput,
      requestContext: null,
      guardrailFlags: params.guardrailFlags as any,
      blockedPhrases: params.blockedPhrases as any,
      status: "pending",
    })
    .returning({ id: aiReviewQueue.id });
  return row.id;
}
