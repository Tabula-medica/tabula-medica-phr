import { logger } from "./utils/logger";
import { sendOpsAlert } from "./utils/ops-alert";
import { chatComplete as defaultChatComplete, PolicyBlockedError } from "./ai-client";

/**
 * TEST-ONLY seam: the AI entity-resolution call routes through this binding
 * so tests can inject a fake `chatComplete` (success, policy-blocked, or
 * provider-error) and exercise the rule-based-fallback / degraded-alert
 * paths without a live Vertex provider. Mirrors the `fetchImpl` seam in
 * `server/utils/safe-fetch.ts`. Production always uses the real client.
 */
let chatCompleteImpl: typeof defaultChatComplete = defaultChatComplete;

export function __setChatCompleteImplForTesting(impl: typeof defaultChatComplete | null): void {
  chatCompleteImpl = impl ?? defaultChatComplete;
}

const VERTEX_AI_AVAILABLE = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GCP_SERVICE_ACCOUNT_KEY || process.env.GCP_KEY);

export interface DuplicateMatch {
  recordA: string;
  recordB: string;
  confidence: number;
  matchReason: string;
  suggestedAction: "merge" | "review" | "keep_both";
}

export interface DeduplicationResult {
  totalRecords: number;
  duplicatesFound: number;
  mergedRecords: number;
  reviewQueue: DuplicateMatch[];
  processedAt: Date;
  provider: "vertex_ai" | "rule_based";
}

export interface DeduplicationConfig {
  dateProximityHours: number;
  minConfidence: number;
  autoMergeThreshold: number;
  resourceTypes: string[];
}

const DEFAULT_CONFIG: DeduplicationConfig = {
  dateProximityHours: 24,
  minConfidence: 0.75,
  autoMergeThreshold: 0.95,
  resourceTypes: [],
};

/**
 * Number of consecutive AI-path failures (policy block or provider error)
 * after which we escalate from a per-comparison warning to a single
 * high-severity "AI matching degraded" alert. Keeps on-call informed that
 * deduplication has silently dropped to the deterministic rule-based matcher.
 */
const AI_DEGRADED_ALERT_THRESHOLD = 5;
const AI_DEGRADED_REMINDER_INTERVAL_MS = 30 * 60 * 1000;

type AiFailureReason = "policy_blocked" | "provider_error" | "unparseable_response";

let stats = {
  totalProcessed: 0,
  totalDuplicatesFound: 0,
  totalMerged: 0,
  lastRunAt: null as Date | null,
  // AI-path observability (Task #134): surface when AI-quality matching
  // degrades to the rule-based fallback so operators see it in the stats /
  // health endpoint instead of inferring it from dropping confidence scores.
  aiComparisons: 0,
  ruleBasedFallbacks: 0,
  consecutiveAiFailures: 0,
  maxConsecutiveAiFailures: 0,
  lastAiFailureReason: null as AiFailureReason | null,
  lastAiFailureAt: null as Date | null,
  lastAiSuccessAt: null as Date | null,
};

let aiDegradedAlertActive = false;
let aiDegradedSince: number | null = null;
let aiDegradedReminderTimer: ReturnType<typeof setInterval> | null = null;

function startAiDegradedReminders(): void {
  // One timer per incident, independent of further comparison traffic.
  aiDegradedSince = Date.now();
  aiDegradedReminderTimer = setInterval(() => {
    if (!aiDegradedAlertActive || aiDegradedSince === null) return;
    const degradedForMinutes = Math.floor((Date.now() - aiDegradedSince) / 60_000);
    void sendOpsAlert({
      title: "AI duplicate-matching STILL DEGRADED",
      detail:
        `Vertex AI entity-resolution is still degraded for ${(degradedForMinutes / 60).toFixed(1)}h (${degradedForMinutes} minutes). Deduplication remains on the deterministic rule-based fallback; no AI recovery has been observed.`,
      severity: "critical",
      fields: {
        service: "vertex-deduplication",
        degradedSince: new Date(aiDegradedSince).toISOString(),
        degradedForMinutes,
        consecutiveAiFailures: stats.consecutiveAiFailures,
        lastAiFailureReason: stats.lastAiFailureReason,
        statusEndpoint: "GET /api/phr/dedup/status",
      },
    });
  }, AI_DEGRADED_REMINDER_INTERVAL_MS);
  // Alerting must not prevent graceful process exit.
  aiDegradedReminderTimer.unref();
}

/**
 * Per-run delta accumulator (Task #221). The in-memory `stats` above stays a
 * fast, per-instance write-through cache (so direct callers and tests see
 * immediate, DB-free updates), but it resets on restart and is not shared
 * across Cloud Run instances. To make the counters durable and cross-instance,
 * each `deduplicateFhirBundle()` run records its AI-path deltas here and flushes
 * them once (additively) to the `deduplication_metrics` singleton row at the end
 * of the run. We track the run's trailing consecutive-failure streak separately
 * from the simple additive counters because a streak is not additive: it must be
 * carried forward from the persisted value on a trailing failure, or reset to
 * zero when the run's last AI event was a success.
 */
let runDelta = {
  aiComparisons: 0,
  ruleBasedFallbacks: 0,
  trailingFailures: 0,
  endedWithFailure: false,
  hadSuccess: false,
  hadFailure: false,
};

function resetRunDelta(): void {
  runDelta = {
    aiComparisons: 0,
    ruleBasedFallbacks: 0,
    trailingFailures: 0,
    endedWithFailure: false,
    hadSuccess: false,
    hadFailure: false,
  };
}

function recordAiSuccess(): void {
  stats.aiComparisons++;
  stats.consecutiveAiFailures = 0;
  stats.lastAiSuccessAt = new Date();
  runDelta.aiComparisons++;
  runDelta.trailingFailures = 0;
  runDelta.endedWithFailure = false;
  runDelta.hadSuccess = true;
  if (aiDegradedAlertActive) {
    logger.info("[VertexDedup] AI entity resolution recovered; matching restored to AI path", {
      totalAiComparisons: stats.aiComparisons,
    });
    aiDegradedAlertActive = false;
    if (aiDegradedReminderTimer !== null) clearInterval(aiDegradedReminderTimer);
    aiDegradedReminderTimer = null;
    aiDegradedSince = null;
    // Auto-resolve the on-call alert (fire-and-forget; never blocks the
    // comparison path and never throws).
    void sendOpsAlert({
      title: "AI duplicate-matching RECOVERED",
      detail:
        "Vertex AI entity-resolution is back on the AI path; deduplication is no longer running on the rule-based fallback.",
      severity: "resolved",
      fields: {
        service: "vertex-deduplication",
        totalAiComparisons: stats.aiComparisons,
        ruleBasedFallbacks: stats.ruleBasedFallbacks,
        recoveredAt: new Date().toISOString(),
      },
    });
  }
}

function recordAiFallback(reason: AiFailureReason): void {
  stats.ruleBasedFallbacks++;
  stats.consecutiveAiFailures++;
  stats.lastAiFailureReason = reason;
  stats.lastAiFailureAt = new Date();
  if (stats.consecutiveAiFailures > stats.maxConsecutiveAiFailures) {
    stats.maxConsecutiveAiFailures = stats.consecutiveAiFailures;
  }
  runDelta.ruleBasedFallbacks++;
  runDelta.trailingFailures++;
  runDelta.endedWithFailure = true;
  runDelta.hadFailure = true;
  if (stats.consecutiveAiFailures >= AI_DEGRADED_ALERT_THRESHOLD && !aiDegradedAlertActive) {
    aiDegradedAlertActive = true;
    startAiDegradedReminders();
    logger.error("[VertexDedup] AI matching DEGRADED: entity resolution has fallen back to the rule-based matcher", {
      consecutiveAiFailures: stats.consecutiveAiFailures,
      threshold: AI_DEGRADED_ALERT_THRESHOLD,
      lastAiFailureReason: reason,
      lastAiSuccessAt: stats.lastAiSuccessAt,
    });
    // Page on-call (fire-and-forget; never blocks the comparison path and
    // never throws). Auto-resolves via the recovery path in recordAiSuccess().
    void sendOpsAlert({
      title: "AI duplicate-matching DEGRADED",
      detail:
        `Vertex AI entity-resolution has fallen back to the deterministic rule-based matcher for ${stats.consecutiveAiFailures} consecutive comparisons (threshold ${AI_DEGRADED_ALERT_THRESHOLD}). Likely a sustained Vertex outage or AI-policy block. Deduplication quality is reduced until it recovers.`,
      severity: "critical",
      fields: {
        service: "vertex-deduplication",
        consecutiveAiFailures: stats.consecutiveAiFailures,
        threshold: AI_DEGRADED_ALERT_THRESHOLD,
        lastAiFailureReason: reason,
        lastAiSuccessAt: stats.lastAiSuccessAt ? stats.lastAiSuccessAt.toISOString() : "never",
        statusEndpoint: "GET /api/phr/dedup/status",
      },
    });
  }
}

const DEDUP_METRICS_ROW_ID = "global";

/**
 * Flush the accumulated per-run deltas to the durable `deduplication_metrics`
 * singleton row (Task #221). Best-effort: any DB error is logged and swallowed
 * so deduplication observability never blocks or fails the actual dedup work.
 * The `db` module is imported lazily so this service does not require a live
 * `DATABASE_URL` at load time (keeping the unit tests, which exercise
 * `findDuplicateRecords` directly, DB-free).
 *
 * Counters are written additively (`existing + delta`) so concurrent Cloud Run
 * instances aggregate rather than clobber each other. The consecutive-failure
 * streak is carried forward from the persisted value on a trailing failure and
 * reset to zero when the run's last AI event was a success.
 */
async function flushRunMetrics(runDeltas: {
  totalProcessed: number;
  totalDuplicatesFound: number;
  totalMerged: number;
}): Promise<void> {
  try {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");

    const endedWithFailure = runDelta.endedWithFailure;
    const trailingFailures = runDelta.trailingFailures;
    const failureReason = runDelta.hadFailure ? stats.lastAiFailureReason : null;
    const failureAt = runDelta.hadFailure ? stats.lastAiFailureAt : null;
    const successAt = runDelta.hadSuccess ? stats.lastAiSuccessAt : null;
    const initialStreak = endedWithFailure ? trailingFailures : 0;

    await db.execute(sql`
      INSERT INTO deduplication_metrics (
        id, total_processed, total_duplicates_found, total_merged, last_run_at,
        ai_comparisons, rule_based_fallbacks, consecutive_ai_failures,
        max_consecutive_ai_failures, last_ai_failure_reason, last_ai_failure_at,
        last_ai_success_at, updated_at
      ) VALUES (
        ${DEDUP_METRICS_ROW_ID}, ${runDeltas.totalProcessed}, ${runDeltas.totalDuplicatesFound},
        ${runDeltas.totalMerged}, now(), ${runDelta.aiComparisons}, ${runDelta.ruleBasedFallbacks},
        ${initialStreak}, ${initialStreak}, ${failureReason}, ${failureAt}, ${successAt}, now()
      )
      ON CONFLICT (id) DO UPDATE SET
        total_processed = deduplication_metrics.total_processed + ${runDeltas.totalProcessed},
        total_duplicates_found = deduplication_metrics.total_duplicates_found + ${runDeltas.totalDuplicatesFound},
        total_merged = deduplication_metrics.total_merged + ${runDeltas.totalMerged},
        last_run_at = now(),
        ai_comparisons = deduplication_metrics.ai_comparisons + ${runDelta.aiComparisons},
        rule_based_fallbacks = deduplication_metrics.rule_based_fallbacks + ${runDelta.ruleBasedFallbacks},
        consecutive_ai_failures = CASE WHEN ${endedWithFailure}
          THEN deduplication_metrics.consecutive_ai_failures + ${trailingFailures}
          ELSE 0 END,
        max_consecutive_ai_failures = GREATEST(
          deduplication_metrics.max_consecutive_ai_failures,
          CASE WHEN ${endedWithFailure}
            THEN deduplication_metrics.consecutive_ai_failures + ${trailingFailures}
            ELSE 0 END
        ),
        last_ai_failure_reason = COALESCE(${failureReason}, deduplication_metrics.last_ai_failure_reason),
        last_ai_failure_at = COALESCE(${failureAt}, deduplication_metrics.last_ai_failure_at),
        last_ai_success_at = COALESCE(${successAt}, deduplication_metrics.last_ai_success_at),
        updated_at = now()
    `);
  } catch (err: any) {
    logger.warn("[VertexDedup] Failed to persist deduplication metrics; in-memory counters unaffected", {
      error: err?.message,
    });
  }
}

const PHI_FIELDS = [
  "Patient.name", "Patient.birthDate", "Patient.address", "Patient.telecom",
  "Patient.identifier", "Patient.photo", "Patient.contact",
  "subject.display", "subject.reference",
  "performer.display", "performer.reference",
  "requester.display", "requester.reference",
  "recorder.display", "recorder.reference",
  "asserter.display", "asserter.reference",
];

function deidentifyForVertexAI(resource: any): any {
  if (!resource || typeof resource !== "object") return resource;
  const deid = JSON.parse(JSON.stringify(resource));
  delete deid.text;
  delete deid.contained;
  if (deid.subject) {
    deid.subject = { reference: "Patient/REDACTED" };
  }
  if (deid.patient) {
    deid.patient = { reference: "Patient/REDACTED" };
  }
  const stripFields = ["name", "birthDate", "address", "telecom", "identifier", "photo", "contact", "maritalStatus", "communication"];
  if (deid.resourceType === "Patient") {
    for (const field of stripFields) {
      delete deid[field];
    }
  }
  for (const ref of ["performer", "requester", "recorder", "asserter", "author", "informant"]) {
    if (deid[ref]) {
      if (Array.isArray(deid[ref])) {
        deid[ref] = deid[ref].map(() => ({ reference: "Practitioner/REDACTED" }));
      } else if (typeof deid[ref] === "object") {
        deid[ref] = { reference: "Practitioner/REDACTED" };
      }
    }
  }
  if (deid.encounter) {
    deid.encounter = { reference: "Encounter/REDACTED" };
  }
  delete deid.id;
  delete deid.meta?.versionId;
  delete deid.meta?.source;
  return deid;
}

export function extractCoding(resource: any): Array<{ system: string; code: string; display: string }> {
  const codings: Array<{ system: string; code: string; display: string }> = [];
  const codingArray = resource?.code?.coding;
  if (Array.isArray(codingArray)) {
    for (const c of codingArray) {
      if (c.system || c.code) {
        codings.push({
          system: c.system || "",
          code: c.code || "",
          display: c.display || "",
        });
      }
    }
  }
  if (resource?.vaccineCode?.coding) {
    for (const c of resource.vaccineCode.coding) {
      if (c.system || c.code) {
        codings.push({ system: c.system || "", code: c.code || "", display: c.display || "" });
      }
    }
  }
  if (resource?.medicationCodeableConcept?.coding) {
    for (const c of resource.medicationCodeableConcept.coding) {
      if (c.system || c.code) {
        codings.push({ system: c.system || "", code: c.code || "", display: c.display || "" });
      }
    }
  }
  return codings;
}

export function extractResourceDate(resource: any): Date | null {
  const dateFields = [
    "effectiveDateTime",
    "issued",
    "recordedDate",
    "onsetDateTime",
    "authoredOn",
    "occurrenceDateTime",
    "date",
  ];
  for (const field of dateFields) {
    if (resource?.[field]) {
      const parsed = new Date(resource[field]);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  if (resource?.period?.start) {
    const parsed = new Date(resource.period.start);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

export function calculateDateProximity(dateA: Date, dateB: Date): number {
  return Math.abs(dateA.getTime() - dateB.getTime()) / (1000 * 60 * 60);
}

export function calculateCodeSimilarity(codingsA: any[], codingsB: any[]): number {
  if (codingsA.length === 0 || codingsB.length === 0) return 0;
  let matches = 0;
  let total = Math.max(codingsA.length, codingsB.length);
  for (const a of codingsA) {
    for (const b of codingsB) {
      if (a.system === b.system && a.code === b.code) {
        matches++;
        break;
      }
    }
  }
  return total > 0 ? matches / total : 0;
}

/**
 * Vertex-backed FHIR entity resolution. Task #108: this used to construct
 * its own JWT, exchange it for a GCP access token, and POST directly to
 * the `generateContent` REST endpoint. That bypassed the unified policy
 * gate and was the second of two files allow-listed for direct Vertex
 * SDK / REST usage. It now routes through `chatComplete()` in
 * `server/ai-client.ts` so the BAA-policy gate, provider selection, and
 * audit logging happen in exactly one place. Any failure (including
 * `PolicyBlockedError`) returns `null` so the caller falls back to the
 * deterministic rule-based matcher — same behavior as the previous
 * direct path, but now policy-aware.
 */
async function callVertexAIEntityResolution(recordA: any, recordB: any): Promise<{ isDuplicate: boolean; confidence: number; reason: string } | null> {
  if (!VERTEX_AI_AVAILABLE) return null;

  const deidA = deidentifyForVertexAI(recordA);
  const deidB = deidentifyForVertexAI(recordB);
  logger.info("[VertexDedup] PHI de-identified before Vertex AI transmission", {
    resourceTypeA: recordA?.resourceType,
    resourceTypeB: recordB?.resourceType,
    fieldsStripped: PHI_FIELDS.length,
  });

  const systemPrompt = `You are a clinical data entity resolution system. Compare two de-identified FHIR resources and determine if they represent the same clinical event, observation, or entity. Patient identifiers have been removed for privacy — focus only on clinical codes, values, and dates. Respond with strict JSON only.`;

  const userPrompt = `Resource A:
${JSON.stringify(deidA, null, 2)}

Resource B:
${JSON.stringify(deidB, null, 2)}

Analyze the following:
1. Do they share the same clinical codes (LOINC, SNOMED, RxNorm, ICD-10)?
2. Are their dates within a reasonable clinical window?
3. Do they reference the same provider or facility?
4. Do the clinical values/findings overlap?

Respond in JSON format only:
{
  "isDuplicate": true/false,
  "confidence": 0.0 to 1.0,
  "reason": "Brief explanation of why these are or are not duplicates"
}`;

  try {
    const result = await chatCompleteImpl({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      model: "deep",
      temperature: 0.1,
      maxOutputTokens: 1024,
      jsonMode: true,
      dataCategories: ["clinical_notes"],
      purpose: "documentation",
      callerService: "vertex-deduplication-service",
      callerMethod: "callVertexAIEntityResolution",
    });

    const parsed: any =
      result.json ??
      (() => {
        const m = result.content.match(/\{[\s\S]*\}/);
        try { return m ? JSON.parse(m[0]) : null; } catch { return null; }
      })();

    if (!parsed) {
      logger.warn("[VertexDedup] Vertex AI returned an unparseable response; falling back to rule-based matcher");
      recordAiFallback("unparseable_response");
      return null;
    }
    recordAiSuccess();
    return {
      isDuplicate: !!parsed.isDuplicate,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      reason: parsed.reason || "Vertex AI entity resolution",
    };
  } catch (err: any) {
    if (err instanceof PolicyBlockedError) {
      logger.warn("[VertexDedup] Entity resolution blocked by AI policy; falling back to rule-based matcher", { violations: err.violations });
      recordAiFallback("policy_blocked");
    } else {
      logger.warn("[VertexDedup] Vertex AI entity resolution error", { error: err?.message });
      recordAiFallback("provider_error");
    }
    return null;
  }
}

export async function findDuplicateRecords(recordA: any, recordB: any): Promise<DuplicateMatch | null> {
  const idA = recordA.id || JSON.stringify(recordA).substring(0, 40);
  const idB = recordB.id || JSON.stringify(recordB).substring(0, 40);

  const codingsA = extractCoding(recordA);
  const codingsB = extractCoding(recordB);
  const dateA = extractResourceDate(recordA);
  const dateB = extractResourceDate(recordB);

  if (VERTEX_AI_AVAILABLE) {
    const vertexResult = await callVertexAIEntityResolution(recordA, recordB);
    if (vertexResult) {
      if (!vertexResult.isDuplicate) return null;
      let suggestedAction: "merge" | "review" | "keep_both" = "review";
      if (vertexResult.confidence >= 0.95) suggestedAction = "merge";
      if (vertexResult.confidence < 0.75) suggestedAction = "keep_both";
      return {
        recordA: idA,
        recordB: idB,
        confidence: vertexResult.confidence,
        matchReason: vertexResult.reason,
        suggestedAction,
      };
    }
  }

  const codeSimilarity = calculateCodeSimilarity(codingsA, codingsB);

  if (codeSimilarity < 1.0) return null;

  if (dateA && dateB) {
    const hoursApart = calculateDateProximity(dateA, dateB);
    if (hoursApart > DEFAULT_CONFIG.dateProximityHours) return null;

    const confidence = hoursApart === 0 ? 0.98 : Math.max(0.75, 1.0 - hoursApart / (DEFAULT_CONFIG.dateProximityHours * 2));
    let suggestedAction: "merge" | "review" | "keep_both" = "review";
    if (confidence >= 0.95) suggestedAction = "merge";
    if (confidence < 0.75) suggestedAction = "keep_both";

    const systemCodes = codingsA.map((c) => `${c.system}|${c.code}`).join(", ");
    return {
      recordA: idA,
      recordB: idB,
      confidence,
      matchReason: `Exact code match (${systemCodes}) with dates ${hoursApart.toFixed(1)}h apart`,
      suggestedAction,
    };
  }

  if (codeSimilarity === 1.0) {
    const systemCodes = codingsA.map((c) => `${c.system}|${c.code}`).join(", ");
    return {
      recordA: idA,
      recordB: idB,
      confidence: 0.80,
      matchReason: `Exact code match (${systemCodes}), dates not available for comparison`,
      suggestedAction: "review",
    };
  }

  return null;
}

export function mergeRecords(recordA: any, recordB: any): any {
  const countFields = (obj: any): number => {
    if (!obj || typeof obj !== "object") return 0;
    let count = 0;
    for (const key of Object.keys(obj)) {
      if (obj[key] !== null && obj[key] !== undefined && obj[key] !== "") {
        count++;
        if (typeof obj[key] === "object") {
          count += countFields(obj[key]);
        }
      }
    }
    return count;
  };

  const fieldsA = countFields(recordA);
  const fieldsB = countFields(recordB);
  const primary = fieldsA >= fieldsB ? { ...recordA } : { ...recordB };
  const secondary = fieldsA >= fieldsB ? recordB : recordA;

  if (Array.isArray(secondary.extension)) {
    if (!Array.isArray(primary.extension)) {
      primary.extension = [];
    }
    for (const ext of secondary.extension) {
      const exists = primary.extension.some((e: any) => e.url === ext.url);
      if (!exists) {
        primary.extension.push(ext);
      }
    }
  }

  if (Array.isArray(secondary.contained)) {
    if (!Array.isArray(primary.contained)) {
      primary.contained = [];
    }
    for (const cont of secondary.contained) {
      const exists = primary.contained.some((c: any) => c.id === cont.id);
      if (!exists) {
        primary.contained.push(cont);
      }
    }
  }

  if (!primary.meta) primary.meta = {};
  if (!Array.isArray(primary.meta.tag)) primary.meta.tag = [];
  primary.meta.tag.push({
    system: "urn:tabula-medica:deduplication",
    code: "merged",
    display: `Merged from ${recordA.id || "unknown"} and ${recordB.id || "unknown"}`,
  });

  if (!primary._provenance) primary._provenance = [];
  primary._provenance.push({
    sourceA: recordA.id || "unknown",
    sourceB: recordB.id || "unknown",
    mergedAt: new Date().toISOString(),
    strategy: "most_complete_primary",
  });

  logger.info("[VertexDedup] Records merged", {
    primaryId: primary.id,
    secondaryId: secondary.id,
    primaryFields: fieldsA,
    secondaryFields: fieldsB,
  });

  return primary;
}

export async function deduplicateFhirBundle(
  records: any[],
  config?: Partial<DeduplicationConfig>
): Promise<DeduplicationResult> {
  const cfg: DeduplicationConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  logger.info("[VertexDedup] Starting deduplication", {
    totalRecords: records.length,
    config: cfg,
    vertexAIAvailable: VERTEX_AI_AVAILABLE,
  });

  resetRunDelta();

  const groups: Record<string, any[]> = {};
  for (const record of records) {
    const resourceType = record.resourceType || "Unknown";
    if (cfg.resourceTypes.length > 0 && !cfg.resourceTypes.includes(resourceType)) {
      continue;
    }
    if (!groups[resourceType]) groups[resourceType] = [];
    groups[resourceType].push(record);
  }

  const reviewQueue: DuplicateMatch[] = [];
  let mergedCount = 0;

  for (const [resourceType, group] of Object.entries(groups)) {
    logger.info("[VertexDedup] Processing resource type", { resourceType, count: group.length });

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const match = await findDuplicateRecords(group[i], group[j]);
        if (!match) continue;
        if (match.confidence < cfg.minConfidence) continue;

        if (match.confidence >= cfg.autoMergeThreshold) {
          mergeRecords(group[i], group[j]);
          mergedCount++;
          match.suggestedAction = "merge";
        }

        reviewQueue.push(match);
      }
    }
  }

  stats.totalProcessed += records.length;
  stats.totalDuplicatesFound += reviewQueue.length;
  stats.totalMerged += mergedCount;
  stats.lastRunAt = new Date();

  await flushRunMetrics({
    totalProcessed: records.length,
    totalDuplicatesFound: reviewQueue.length,
    totalMerged: mergedCount,
  });

  const result: DeduplicationResult = {
    totalRecords: records.length,
    duplicatesFound: reviewQueue.length,
    mergedRecords: mergedCount,
    reviewQueue,
    processedAt: new Date(),
    provider: VERTEX_AI_AVAILABLE ? "vertex_ai" : "rule_based",
  };

  logger.info("[VertexDedup] Deduplication complete", {
    totalRecords: result.totalRecords,
    duplicatesFound: result.duplicatesFound,
    mergedRecords: result.mergedRecords,
    provider: result.provider,
    durationMs: Date.now() - startTime,
  });

  return result;
}

export function getDeduplicationStats(): {
  totalProcessed: number;
  totalDuplicatesFound: number;
  totalMerged: number;
  lastRunAt: Date | null;
  aiComparisons: number;
  ruleBasedFallbacks: number;
  consecutiveAiFailures: number;
  maxConsecutiveAiFailures: number;
  lastAiFailureReason: AiFailureReason | null;
  lastAiFailureAt: Date | null;
  lastAiSuccessAt: Date | null;
  aiDegradedAlertThreshold: number;
  aiMatchingDegraded: boolean;
  vertexAiAvailable: boolean;
} {
  return {
    ...stats,
    aiDegradedAlertThreshold: AI_DEGRADED_ALERT_THRESHOLD,
    aiMatchingDegraded: aiDegradedAlertActive,
    vertexAiAvailable: VERTEX_AI_AVAILABLE,
  };
}

export interface PersistedDeduplicationStats {
  totalProcessed: number;
  totalDuplicatesFound: number;
  totalMerged: number;
  lastRunAt: Date | null;
  aiComparisons: number;
  ruleBasedFallbacks: number;
  consecutiveAiFailures: number;
  maxConsecutiveAiFailures: number;
  lastAiFailureReason: AiFailureReason | null;
  lastAiFailureAt: Date | null;
  lastAiSuccessAt: Date | null;
  aiDegradedAlertThreshold: number;
  aiMatchingDegraded: boolean;
  vertexAiAvailable: boolean;
  source: "persisted" | "in_memory";
}

/**
 * Durable, cross-instance view of the deduplication AI-health metrics
 * (Task #221). Reads the `deduplication_metrics` singleton row so the
 * /api/phr/dedup/status endpoint reflects activity aggregated across all
 * Cloud Run instances and surviving restarts, rather than just the in-memory
 * counters of the instance serving the request. The degraded flag is derived
 * from the persisted consecutive-failure streak vs the alert threshold.
 *
 * Falls back to the in-memory snapshot (`source: "in_memory"`) when the DB is
 * unreachable or no row exists yet, so the endpoint never hard-fails on a
 * metrics-store hiccup.
 */
export async function getPersistedDeduplicationStats(): Promise<PersistedDeduplicationStats> {
  try {
    const { db } = await import("./db");
    const { deduplicationMetrics } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");

    const rows = await db
      .select()
      .from(deduplicationMetrics)
      .where(eq(deduplicationMetrics.id, DEDUP_METRICS_ROW_ID))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return { ...getDeduplicationStats(), source: "in_memory" };
    }

    return {
      totalProcessed: row.totalProcessed,
      totalDuplicatesFound: row.totalDuplicatesFound,
      totalMerged: row.totalMerged,
      lastRunAt: row.lastRunAt,
      aiComparisons: row.aiComparisons,
      ruleBasedFallbacks: row.ruleBasedFallbacks,
      consecutiveAiFailures: row.consecutiveAiFailures,
      maxConsecutiveAiFailures: row.maxConsecutiveAiFailures,
      lastAiFailureReason: row.lastAiFailureReason as AiFailureReason | null,
      lastAiFailureAt: row.lastAiFailureAt,
      lastAiSuccessAt: row.lastAiSuccessAt,
      aiDegradedAlertThreshold: AI_DEGRADED_ALERT_THRESHOLD,
      aiMatchingDegraded: row.consecutiveAiFailures >= AI_DEGRADED_ALERT_THRESHOLD,
      vertexAiAvailable: VERTEX_AI_AVAILABLE,
      source: "persisted",
    };
  } catch (err: any) {
    logger.warn("[VertexDedup] Failed to read persisted deduplication metrics; serving in-memory snapshot", {
      error: err?.message,
    });
    return { ...getDeduplicationStats(), source: "in_memory" };
  }
}
