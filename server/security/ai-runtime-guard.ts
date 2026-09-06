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

  return { text: folded, obfuscationSignals: signals };
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
 * AI route surface. Kept broad on purpose: the codebase mounts ~100
 * `ai-*-routes.ts` modules under `/api/ai-…` plus a handful of AI-backed
 * features that don't carry the prefix.
 */
export const DEFAULT_AI_ROUTE_PATTERN = /^\/api\/(ai(?:[-/]|$)|multimodal|document-summary|documents?\/[^/]+\/(summar|explain|extract)|symptom-checker|explain|summar(y|ies)|health-summary|scribe|assistant|chat|voice)/i;

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

    const body = req.body;
    if (!body || typeof body !== "object") return next();

    let worst: InjectionScanResult = { score: 0, severity: "none", matches: [], normalizedLength: 0, obfuscationSignals: [] };
    const ruleIds = new Set<string>();
    const categories = new Set<InjectionCategory>();

    for (const s of collectStrings(body)) {
      const r = scanForPromptInjection(s);
      for (const m of r.matches) { ruleIds.add(m.id); categories.add(m.category); }
      if (r.score > worst.score) worst = r;
    }

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
      actor: ctx.actor || "system",
      riskLevel: "high",
      details: { feature: ctx.feature, requestId: ctx.requestId, findings: result.findings },
    });
  }
  return result;
}
