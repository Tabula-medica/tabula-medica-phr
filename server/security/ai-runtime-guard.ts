/**
 * AI runtime guard — AI Detection & Response (AIDR) controls for the app's
 * ~100 AI-backed routes.
 *
 * CrowdStrike's 2026 Threat Hunting Report recorded adversaries injecting
 * malicious prompts into GenAI tools at 90+ organizations and an 89% rise in
 * AI-enabled threats. Their Falcon Guardian launch (Fal.Con, Sep 2026) frames
 * the control as: discover AI surfaces, watch prompts at runtime, connect
 * prompts to downstream actions, and enforce policy. This module is the
 * application-layer equivalent for Tabula Medica:
 *
 *   1. `scanForPromptInjection`  — weighted, categorised detection over
 *      normalised text (zero-width / homoglyph stripping, encoded payloads).
 *   2. `scanModelOutput`          — output-side exfiltration checks
 *      (markdown image beacons, data: URIs, credential-shaped strings).
 *   3. `aiRuntimeGuard()`         — Express middleware for every AI route:
 *      monitor mode tags + logs; enforce mode blocks HIGH severity input.
 *
 * Every emitted security event is PHI-free by construction: only rule ids,
 * scores, path, actor id and mode are recorded — never prompt text.
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { logSecurityEvent } from "./gcp-audit-logger";
import { getRequestId } from "./production-logger";
import { SYSTEM_ACTOR } from "./audit-constants";

export type InjectionCategory =
  | "instruction_override"
  | "role_hijack"
  | "system_prompt_probe"
  | "tool_coercion"
  | "exfiltration"
  | "encoding_obfuscation"
  | "delimiter_spoof"
  | "safety_bypass";

export type InjectionSeverity = "none" | "low" | "medium" | "high";

export interface InjectionRule {
  id: string;
  category: InjectionCategory;
  weight: number;
  pattern: RegExp;
}

export interface InjectionScanResult {
  score: number;
  severity: InjectionSeverity;
  matches: Array<{ id: string; category: InjectionCategory; weight: number }>;
  normalizedLength: number;
  obfuscationSignals: string[];
}

export const INJECTION_RULES: readonly InjectionRule[] = [
  // Instruction override
  { id: "io.ignore_previous", category: "instruction_override", weight: 4, pattern: /\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|your)\b[^.\n]{0,30}\b(instructions?|rules?|prompts?|guidelines?|constraints?)\b/i },
  { id: "io.new_instructions", category: "instruction_override", weight: 3, pattern: /\b(new|updated|real|actual|true)\s+(instructions?|rules?|directives?)\s*(:|are|follow)/i },
  { id: "io.from_now_on", category: "instruction_override", weight: 2, pattern: /\bfrom\s+now\s+on\b[^.\n]{0,60}\b(you|respond|answer|act|behave)\b/i },
  { id: "io.do_not_follow", category: "instruction_override", weight: 3, pattern: /\b(do\s+not|don't|never)\s+(follow|obey|apply)\b[^.\n]{0,40}\b(system|developer|safety|guardrail|policy|rules?)\b/i },

  // Role hijack / persona swaps
  { id: "rh.you_are_now", category: "role_hijack", weight: 3, pattern: /\byou\s+are\s+now\s+(a|an|the|in)\b/i },
  { id: "rh.act_as", category: "role_hijack", weight: 2, pattern: /\b(act|behave|respond|roleplay|role-play)\s+as\s+(a|an|the|if|though)\b/i },
  { id: "rh.pretend", category: "role_hijack", weight: 2, pattern: /\bpretend\s+(that\s+)?(you|to\s+be)\b/i },
  { id: "rh.dan_jailbreak", category: "safety_bypass", weight: 5, pattern: /\b(DAN|developer\s+mode|jailbreak|god\s*mode|unrestricted\s+mode|no\s+restrictions?\s+mode)\b/i },
  { id: "rh.switch_role", category: "role_hijack", weight: 2, pattern: /\b(switch|change)\s+(your\s+)?(role|persona|identity|character)\b/i },

  // System prompt probing / leakage
  { id: "sp.reveal_prompt", category: "system_prompt_probe", weight: 4, pattern: /\b(reveal|print|show|repeat|output|dump|display|leak)\b[^.\n]{0,40}\b(system|developer|hidden|initial|original)\s+(prompt|instructions?|message)\b/i },
  { id: "sp.verbatim_instructions", category: "system_prompt_probe", weight: 3, pattern: /\b(repeat|recite|echo)\b[^.\n]{0,30}\b(everything|all|text|words)\b[^.\n]{0,30}\b(above|before|previous)\b/i },
  { id: "sp.system_prompt_ref", category: "system_prompt_probe", weight: 1, pattern: /\bsystem\s+prompt\b/i },

  // Tool / agent coercion (agentic surfaces: FHIR write, export, share)
  { id: "tc.call_tool", category: "tool_coercion", weight: 4, pattern: /\b(call|invoke|run|execute|use)\s+(the\s+)?(tool|function|api|endpoint|command)\b[^.\n]{0,60}\b(delete|export|share|send|transfer|email|post|write|update|grant)\b/i },
  { id: "tc.export_all", category: "tool_coercion", weight: 4, pattern: /\b(export|download|dump|send|email|transfer)\b[^.\n]{0,30}\b(all|every|entire|complete|full)\b[^.\n]{0,30}\b(records?|patients?|data|history|documents?|files?)\b/i },
  { id: "tc.grant_access", category: "tool_coercion", weight: 4, pattern: /\b(grant|give|add|enable)\b[^.\n]{0,30}\b(admin|administrator|caregiver|provider|full|unrestricted)\s+(access|role|permissions?|privileges?)\b/i },
  { id: "tc.function_json", category: "tool_coercion", weight: 3, pattern: /["']?(tool_calls?|function_call|tool_use)["']?\s*[:=]\s*[\[{]/i },

  // Exfiltration channels
  { id: "ex.markdown_image_beacon", category: "exfiltration", weight: 5, pattern: /!\[[^\]]*\]\(\s*https?:\/\/[^)\s]+[?&][^)\s]+\)/i },
  { id: "ex.send_to_url", category: "exfiltration", weight: 4, pattern: /\b(send|post|forward|upload|transmit)\b[^.\n]{0,40}\b(to|at)\s+(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|io|org|xyz|ru|cn|top))/i },
  { id: "ex.encode_and_include", category: "exfiltration", weight: 3, pattern: /\b(base64|hex|url)[- ]?(encode|encoded)\b[^.\n]{0,40}\b(include|append|add|put)\b[^.\n]{0,30}\b(url|link|image|response)\b/i },
  { id: "ex.webhook", category: "exfiltration", weight: 3, pattern: /\b(webhook|ngrok|requestbin|pipedream|burpcollaborator|interact\.sh|oast)\b/i },

  // Delimiter / chat-template spoofing
  { id: "ds.chatml", category: "delimiter_spoof", weight: 4, pattern: /<\|(im_start|im_end|system|user|assistant|endoftext|start_header_id|end_header_id|eot_id)\|>/i },
  { id: "ds.bracket_roles", category: "delimiter_spoof", weight: 3, pattern: /(^|\n)\s*\[(system|assistant|developer|instructions?)\]\s*/i },
  { id: "ds.role_prefix", category: "delimiter_spoof", weight: 2, pattern: /(^|\n)\s*(system|assistant|developer)\s*:\s*[^\n]{0,80}\b(you\s+(must|are|will|should)|ignore|override)\b/i },
  { id: "ds.xml_system", category: "delimiter_spoof", weight: 3, pattern: /<\/?(system|instructions?|developer|admin)(_prompt|_message)?\s*>/i },
  { id: "ds.inst_tokens", category: "delimiter_spoof", weight: 4, pattern: /\[\/?INST\]|<<\/?SYS>>|###\s*(system|instruction)\s*[:\n]/i },

  // Encoding / obfuscation hints
  { id: "eo.long_base64", category: "encoding_obfuscation", weight: 2, pattern: /(?:^|[^A-Za-z0-9+/])[A-Za-z0-9+/]{120,}={0,2}(?:$|[^A-Za-z0-9+/])/ },
  { id: "eo.decode_and_execute", category: "encoding_obfuscation", weight: 4, pattern: /\b(decode|unescape|deobfuscate|rot13|atob|base64\s*-d)\b[^.\n]{0,40}\b(then|and)\s+(follow|execute|run|obey|apply|do)\b/i },
  { id: "eo.spaced_letters", category: "encoding_obfuscation", weight: 2, pattern: /\b(?:[a-z]\s){6,}[a-z]\b/i },
];

const ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;
const UNICODE_TAGS = /\uDB40[\uDC00-\uDC7F]/g; // U+E0000–U+E007F "tag" characters (surrogate pairs) used to smuggle text
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Cross-script homoglyphs for the Latin letters the rules above match
// against. NFKC does NOT fold these — it only folds Unicode-compatibility
// equivalents (fullwidth, mathematical alphanumerics), not cross-script
// confusables — so "igore" written with a Cyrillic i (U+0456) reads as
// non-ASCII and evades every \b...\b rule. This is a bounded,
// manually-curated map of Cyrillic letters that are exact visual matches
// for common Latin ones, not the full Unicode confusables table (UTS #39,
// thousands of entries across many scripts) — this covers the realistic
// single-script-swap evasion.
const HOMOGLYPH_MAP: Record<string, string> = {
  "а": "a", "А": "A", "е": "e", "Е": "E", "о": "o", "О": "O",
  "р": "p", "Р": "P", "с": "c", "С": "C", "х": "x", "Х": "X",
  "у": "y", "У": "Y", "і": "i", "І": "I", "ѕ": "s", "Ѕ": "S",
};
const HOMOGLYPH_RE = new RegExp(`[${Object.keys(HOMOGLYPH_MAP).join("")}]`, "g");

export const HIGH_THRESHOLD = 6;
export const MEDIUM_THRESHOLD = 3;

/** Normalises text so that visually-hidden or confusable payloads are scanned as plain ASCII where possible. */
export function normalizeForScan(input: string): { text: string; obfuscationSignals: string[] } {
  const signals: string[] = [];
  let text = input;

  if (ZERO_WIDTH.test(text)) { signals.push("zero_width_chars"); text = text.replace(ZERO_WIDTH, ""); }
  ZERO_WIDTH.lastIndex = 0;
  if (UNICODE_TAGS.test(text)) { signals.push("unicode_tag_chars"); text = text.replace(UNICODE_TAGS, ""); }
  UNICODE_TAGS.lastIndex = 0;
  if (CONTROL_CHARS.test(text)) { signals.push("control_chars"); text = text.replace(CONTROL_CHARS, " "); }
  CONTROL_CHARS.lastIndex = 0;

  // NFKC folds fullwidth / mathematical alphanumerics onto ASCII so
  // "ｉｇｎｏｒｅ" or "𝐢𝐠𝐧𝐨𝐫𝐞" match the same rules as "ignore".
  const folded = text.normalize("NFKC");
  if (folded !== text) signals.push("nfkc_fold_changed");
  text = folded;

  if (HOMOGLYPH_RE.test(text)) {
    signals.push("cross_script_homoglyphs");
    text = text.replace(HOMOGLYPH_RE, (ch) => HOMOGLYPH_MAP[ch]);
  }
  HOMOGLYPH_RE.lastIndex = 0;

  return { text, obfuscationSignals: signals };
}

export function severityForScore(score: number): InjectionSeverity {
  if (score >= HIGH_THRESHOLD) return "high";
  if (score >= MEDIUM_THRESHOLD) return "medium";
  if (score > 0) return "low";
  return "none";
}

export function scanForPromptInjection(input: string | null | undefined): InjectionScanResult {
  if (typeof input !== "string" || input.length === 0) {
    return { score: 0, severity: "none", matches: [], normalizedLength: 0, obfuscationSignals: [] };
  }
  const { text, obfuscationSignals } = normalizeForScan(input);
  const matches: InjectionScanResult["matches"] = [];
  let score = 0;

  for (const rule of INJECTION_RULES) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(text)) {
      matches.push({ id: rule.id, category: rule.category, weight: rule.weight });
      score += rule.weight;
    }
  }

  // Obfuscation alone is suspicious only in combination with a rule hit;
  // on its own it adds a small weight so it surfaces in monitoring.
  if (obfuscationSignals.length > 0) {
    score += matches.length > 0 ? 2 : 1;
  }

  return { score, severity: severityForScore(score), matches, normalizedLength: text.length, obfuscationSignals };
}

export interface OutputScanResult {
  flagged: boolean;
  findings: string[];
}

const OUTPUT_RULES: Array<{ id: string; pattern: RegExp }> = [
  { id: "out.markdown_image_with_query", pattern: /!\[[^\]]*\]\(\s*https?:\/\/[^)\s]+[?&][^)\s]{8,}\)/i },
  { id: "out.data_uri", pattern: /\bdata:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/]{40,}/i },
  { id: "out.long_query_string", pattern: /https?:\/\/[^\s)"']+\?[^\s)"']{200,}/i },
  { id: "out.bearer_token", pattern: /\bBearer\s+[A-Za-z0-9\-_.]{20,}/ },
  { id: "out.private_key", pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { id: "out.aws_key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "out.gcp_sa_key", pattern: /"type"\s*:\s*"service_account"/ },
];

/** Output-side check: catches the model being steered into exfiltration or credential echo. */
export function scanModelOutput(output: string | null | undefined): OutputScanResult {
  if (typeof output !== "string" || output.length === 0) return { flagged: false, findings: [] };
  const findings: string[] = [];
  for (const r of OUTPUT_RULES) {
    r.pattern.lastIndex = 0;
    if (r.pattern.test(output)) findings.push(r.id);
  }
  return { flagged: findings.length > 0, findings };
}

/** Walks a JSON body and returns all string leaves (bounded). */
export function collectStrings(value: unknown, opts?: { maxDepth?: number; maxTotalChars?: number; maxStrings?: number }): string[] {
  const maxDepth = opts?.maxDepth ?? 5;
  const maxTotal = opts?.maxTotalChars ?? 200_000;
  const maxStrings = opts?.maxStrings ?? 500;
  const out: string[] = [];
  let total = 0;

  const walk = (v: unknown, depth: number): void => {
    if (out.length >= maxStrings || total >= maxTotal) return;
    if (typeof v === "string") {
      if (v.length === 0) return;
      const slice = v.slice(0, Math.max(0, maxTotal - total));
      total += slice.length;
      out.push(slice);
      return;
    }
    if (depth >= maxDepth || v === null || typeof v !== "object") return;
    if (Array.isArray(v)) {
      for (const item of v) walk(item, depth + 1);
      return;
    }
    for (const item of Object.values(v as Record<string, unknown>)) walk(item, depth + 1);
  };

  walk(value, 0);
  return out;
}

export type AiGuardMode = "off" | "monitor" | "enforce";

export interface AiRuntimeGuardOptions {
  /** Route predicate. Defaults to `DEFAULT_AI_ROUTE_PATTERN`. */
  match?: (req: Request) => boolean;
  /** Overrides AI_GUARD_MODE env. */
  mode?: AiGuardMode;
  /** Minimum severity that produces a security event (default: medium). */
  logAtOrAbove?: Exclude<InjectionSeverity, "none">;
}

/**
 * AI route surface. An explicit list rather than a name-based guess: three
 * review rounds on this PR each found more AI-backed routes the previous
 * (name-based, "ai(-|/|$)") pattern missed, because the codebase mounts
 * ~100 `ai-*-routes.ts` modules under `/api/ai-…` PLUS a long tail of
 * feature routes — `medications`, `care-team`, `visit-prep`, etc. — that
 * call the shared AI gateway (`server/services/ai-gateway.ts`'s
 * `generatePhiSafeText`/`generatePhiSafeChat*`) without an "ai" prefix.
 * Every entry below was traced from an actual Express-mounted path back to
 * that gateway or a direct OpenAI/Vertex-shim call, not guessed from the
 * name. A NEW AI feature route MUST add its prefix here (or route through
 * `ai-gateway.ts` under a prefix already covered) — nothing else keeps
 * this guard's coverage honest.
 *
 * Three entries are narrow AI corners of an otherwise non-AI route file, so
 * they're listed by full sub-path rather than the bare top-level prefix
 * (matching the whole prefix would scan that file's ordinary CRUD traffic
 * too — harmless in monitor mode, but noisy).
 */
const AI_ROUTE_PREFIXES = [
  "ai(?:[-/]|$)",
  "multimodal",
  "document-summary",
  "documents?/[^/]+/(summar|explain|extract)",
  "symptom-checker",
  "explain",
  "summar(y|ies)",
  "health-summary",
  "scribe",
  "assistant",
  "chat",
  "voice",
  "translation",
  "patient-ai-onboarding",
  "patient-friendly-summary",
  "patient-assistant",
  // Narrow AI corners of otherwise non-AI route files. `ai-` sub-prefixes
  // (not one literal action) so every AI action in the file is covered,
  // not just the first one this list happened to name.
  "comprehensive-onboarding/ai-",
  "clinical-docs", // whole prefix: no shared AI sub-prefix in this file, and the non-AI actions (templates, sample-encounter) are GET/static
  "patient-onboarding-wizard/ai-",
  // AI actions nested under a resource id, so the bare top-level prefix
  // (`patients`, `provider/portal/patients`) is deliberately NOT matched —
  // that would also scan ordinary patient-record CRUD.
  "patients/[^/]+/(ai-summary|history-summary|care-gaps-ai|education/(generate|ask|generate-faqs))",
  "provider/portal/patients/[^/]+/ai-summary",
  // The rest: top-level feature prefixes whose routes call ai-gateway.ts.
  "referral-letters",
  "ambient-encounter",
  "preventive-care",
  "care-team",
  "card-ocr",
  "dental-integrations",
  "drug-savings",
  "insurance-learning",
  "patient-education-center",
  "prior-auth-letter",
  "admin-workflow",
  "health-story",
  "patient-chatbot",
  "patient-health-record",
  "personalized-education",
  "medication-management",
  "telehealth",
  "support-resources",
  "survivorship",
  "infrastructure",
  "patient-analytics",
  "health-content",
  "treatment-efficacy",
  "care-plans",
  "caregivers",
  "clinician-summary",
  "communication-summaries",
  "content-recommendations",
  "deduplicated-records",
  "differential-diagnosis",
  "eli12",
  "health-inbox",
  "health-insights",
  "journal",
  "imaging-reports",
  "med-reconciliation",
  "medical",
  "medications",
  "transfer-requests",
  "proactive-alerts",
  "smart-search",
  "timeline-story",
  "visit-prep",
  "cds",
  "enhanced-health-journey",
  "operations-analytics",
  "workflow-monitoring",
  "feedback-analysis",
  "third-party-governance",
  "proactive-support",
  "fhir-monitoring",
];

export const DEFAULT_AI_ROUTE_PATTERN = new RegExp(`^/api/(${AI_ROUTE_PREFIXES.join("|")})`, "i");

const SEVERITY_RANK: Record<InjectionSeverity, number> = { none: 0, low: 1, medium: 2, high: 3 };

export function resolveAiGuardMode(explicit?: AiGuardMode): AiGuardMode {
  if (explicit) return explicit;
  const env = (process.env.AI_GUARD_MODE || "monitor").toLowerCase();
  if (env === "off" || env === "enforce" || env === "monitor") return env;
  return "monitor";
}

function actorOf(req: Request): string {
  const user = req.user as any;
  return user?.claims?.sub || user?.sub || user?.id || "anonymous";
}

function clientIp(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || "unknown";
}

/**
 * Express middleware. Scans every string leaf in the JSON body of AI routes.
 *   monitor → sets `X-AI-Guard: monitor;<severity>` and logs medium+.
 *   enforce → additionally rejects HIGH with 400 `AI_INPUT_REJECTED`.
 * Never touches non-matching routes or GET requests without a body.
 */
export function aiRuntimeGuard(options: AiRuntimeGuardOptions = {}): RequestHandler {
  const match = options.match ?? ((req: Request) => DEFAULT_AI_ROUTE_PATTERN.test(req.path));
  const logAt = SEVERITY_RANK[options.logAtOrAbove ?? "medium"];

  return (req: Request, res: Response, next: NextFunction): void => {
    const mode = resolveAiGuardMode(options.mode);
    if (mode === "off" || !match(req)) return next();

    // Output-side scan: checks the model's response for exfiltration-shaped
    // content (image beacons, data URIs, bearer tokens, private keys) before
    // it reaches the client. Detection only — never blocks or alters the
    // response, in monitor or enforce. Covers both a single JSON response
    // (res.json) and a streamed one (res.write/res.end — SSE chat routes use
    // this), since either can carry model output.
    let outputFlagged = false;
    let streamTail = "";
    const MAX_STREAM_TAIL = 4000; // enough to catch a pattern split across chunk boundaries
    const reportFlagged = (findings: string[]) => {
      outputFlagged = true;
      void logSecurityEvent({
        eventType: "ai_output_exfiltration_pattern",
        actor: actorOf(req),
        ip: clientIp(req),
        riskLevel: "high",
        details: { requestId: getRequestId(req), path: req.path, method: req.method, findings },
      });
    };

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      try {
        for (const s of collectStrings(body)) {
          const outResult = scanModelOutput(s);
          if (outResult.flagged) {
            reportFlagged(outResult.findings);
            break;
          }
        }
      } catch {
        /* telemetry must never break the response */
      }
      return originalJson(body);
    }) as typeof res.json;

    const scanStreamChunk = (chunk: unknown): void => {
      if (outputFlagged) return;
      try {
        const text = typeof chunk === "string" ? chunk : Buffer.isBuffer(chunk) ? chunk.toString("utf8") : "";
        if (!text) return;
        streamTail = (streamTail + text).slice(-MAX_STREAM_TAIL);
        const outResult = scanModelOutput(streamTail);
        if (outResult.flagged) reportFlagged(outResult.findings);
      } catch {
        /* telemetry must never break the response */
      }
    };
    const originalWrite = res.write.bind(res);
    res.write = ((chunk: unknown, ...rest: unknown[]) => {
      scanStreamChunk(chunk);
      return (originalWrite as (...a: unknown[]) => boolean)(chunk, ...rest);
    }) as typeof res.write;
    const originalEnd = res.end.bind(res);
    res.end = ((chunk?: unknown, ...rest: unknown[]) => {
      if (chunk !== undefined) scanStreamChunk(chunk);
      return (originalEnd as (...a: unknown[]) => Response)(chunk, ...rest);
    }) as typeof res.end;

    const body = req.body;
    // A valid JSON body can be a bare string, not just an object/array — only
    // skip when there is genuinely nothing to scan. collectStrings handles
    // every other shape (string, object, array) itself.
    if (body === undefined || body === null) return next();

    // Score the whole request as one scan, not each field independently:
    // per-field scoring let a payload split across fields (e.g. "ignore
    // previous instructions" in one field, "export all patient records" in
    // another) stay under the HIGH threshold in every field while the
    // combined intent was clearly high-risk. Joining bounds the same way
    // collectStrings already bounds each piece.
    const combined = collectStrings(body).join("\n\n");
    const worst: InjectionScanResult = scanForPromptInjection(combined);
    const ruleIds = new Set(worst.matches.map((m) => m.id));
    const categories = new Set(worst.matches.map((m) => m.category));

    (req as any).aiGuard = { severity: worst.severity, score: worst.score, ruleIds: Array.from(ruleIds), mode };
    const blocked = mode === "enforce" && worst.severity === "high";
    res.setHeader("X-AI-Guard", `${blocked ? "blocked" : mode};${worst.severity}`);

    if (SEVERITY_RANK[worst.severity] >= logAt) {
      void logSecurityEvent({
        eventType: blocked ? "ai_prompt_injection_blocked" : "ai_prompt_injection_detected",
        actor: actorOf(req),
        ip: clientIp(req),
        riskLevel: worst.severity === "high" ? "high" : "medium",
        details: {
          requestId: getRequestId(req),
          path: req.path,
          method: req.method,
          mode,
          severity: worst.severity,
          score: worst.score,
          ruleIds: Array.from(ruleIds).slice(0, 20),
          categories: Array.from(categories),
          obfuscationSignals: worst.obfuscationSignals,
          actionTaken: blocked ? "rejected_400" : "allowed_tagged",
        },
      });
    }

    if (blocked) {
      res.status(400).json({
        error: "AI_INPUT_REJECTED",
        message: "The request contained content that cannot be processed by the AI assistant.",
        requestId: getRequestId(req),
      });
      return;
    }

    next();
  };
}

/** Convenience for AI services: call after model completion to flag exfiltration-shaped output. */
export function auditModelOutput(output: string, ctx: { feature: string; actor?: string; requestId?: string }): OutputScanResult {
  const result = scanModelOutput(output);
  if (result.flagged) {
    void logSecurityEvent({
      eventType: "ai_output_exfiltration_pattern",
      actor: ctx.actor || SYSTEM_ACTOR,
      riskLevel: "high",
      details: { feature: ctx.feature, requestId: ctx.requestId, findings: result.findings },
    });
  }
  return result;
}
