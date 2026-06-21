import { Router, type Request, type Response } from "express";
import { z } from "zod";
import OpenAI from "openai";
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import { symptomCheckerSessions, accounts } from "@shared/schema";

const router = Router();

function getOpenAIClient(): OpenAI | null {
  try {
    return new OpenAI();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Deterministic red-flag rules. These short-circuit any LLM output and force
// urgent / ER triage. Keeping them small and auditable on purpose — every
// rule must be defensible against published guidance (NHS 111, MedlinePlus,
// AHA chest-pain guidance, etc.).
// ---------------------------------------------------------------------------

interface RedFlagRule {
  id: string;
  symptoms: string[];
  bodyRegion?: string;
  matchAll: boolean;
  urgency: "ER" | "URGENT_CARE";
  rationale: string;
  source: string;
  minSeverity?: number;
}

const RED_FLAG_RULES: RedFlagRule[] = [
  {
    id: "rf-cardiac-1",
    symptoms: ["chest pain", "shortness of breath"],
    matchAll: true,
    urgency: "ER",
    rationale:
      "Chest pain combined with shortness of breath can indicate a heart attack or pulmonary embolism. Call 911 or your local emergency number now.",
    source: "American Heart Association",
  },
  {
    id: "rf-cardiac-2",
    symptoms: ["chest pain", "left arm pain"],
    matchAll: true,
    urgency: "ER",
    rationale:
      "Chest pain radiating to the left arm is a classic warning sign of a heart attack. Call 911 immediately.",
    source: "American Heart Association",
  },
  {
    id: "rf-cardiac-3",
    // Crushing / pressure / squeezing chest pain — single-keyword phrasing.
    // Word-tokenized matcher means any of these phrases firing in any order
    // within a single user-reported symptom will trigger.
    symptoms: [
      "crushing chest pain",
      "chest pressure",
      "squeezing chest",
      "chest tightness",
      "chest pain radiating",
    ],
    matchAll: false,
    urgency: "ER",
    rationale:
      "Crushing, squeezing, or pressure-like chest pain is a classic warning sign of a heart attack. Call 911 immediately — do not drive yourself.",
    source: "American Heart Association",
  },
  {
    id: "rf-cardiac-4",
    // Plain "chest pain" alone, gated to severity >= 7. Mild chest twinges
    // (sev <= 6) are still triaged via LLM/heuristic so we don't 911 every
    // muscle strain — but severe chest pain alone always escalates to ER.
    symptoms: ["chest pain"],
    matchAll: true,
    urgency: "ER",
    minSeverity: 7,
    rationale:
      "Severe chest pain warrants emergency evaluation to rule out a heart attack or other life-threatening cause. Call 911.",
    source: "American Heart Association",
  },
  {
    id: "rf-stroke",
    symptoms: ["facial droop", "slurred speech", "weakness one side"],
    matchAll: false,
    urgency: "ER",
    rationale:
      "Sudden facial droop, slurred speech, or one-sided weakness can indicate a stroke. Time matters — call 911 now (FAST: Face, Arms, Speech, Time).",
    source: "CDC Stroke Signs",
  },
  {
    id: "rf-anaphylaxis",
    symptoms: ["swelling face", "difficulty breathing"],
    matchAll: true,
    urgency: "ER",
    rationale:
      "Facial swelling with breathing difficulty can indicate anaphylaxis. Use an epinephrine auto-injector if prescribed and call 911.",
    source: "AAAAI Anaphylaxis Guidance",
  },
  {
    id: "rf-severe-bleeding",
    symptoms: ["uncontrolled bleeding"],
    matchAll: true,
    urgency: "ER",
    rationale: "Bleeding that won't stop with pressure requires emergency care.",
    source: "American Red Cross",
  },
  {
    id: "rf-suicidal",
    symptoms: ["suicidal thoughts"],
    matchAll: true,
    urgency: "ER",
    rationale:
      "If you're having thoughts of harming yourself, please reach out now. Call or text 988 (US Suicide & Crisis Lifeline) — free, confidential, 24/7.",
    source: "988 Suicide & Crisis Lifeline",
  },
  {
    id: "rf-severe-headache",
    symptoms: ["worst headache ever", "sudden severe headache"],
    matchAll: false,
    urgency: "ER",
    rationale:
      "A sudden 'worst headache of your life' can indicate bleeding in the brain. Seek emergency care immediately.",
    source: "American Stroke Association",
  },
  {
    id: "rf-high-fever-infant",
    symptoms: ["fever", "infant under 3 months"],
    matchAll: true,
    urgency: "ER",
    rationale:
      "Any fever in an infant under 3 months requires immediate medical evaluation.",
    source: "AAP Pediatric Fever Guidance",
  },
];

function evaluateRedFlags(
  symptoms: string[],
  bodyRegion?: string,
  severity?: number
): RedFlagRule | null {
  const lowered = symptoms.map((s) => s.toLowerCase().trim());
  // Word-tokenized matcher: rule keyword matches if ALL of its words appear
  // (in any order) inside a SINGLE user-reported symptom term.
  //
  //  rule "chest pain"           ✓ user "chest pain crushing"
  //  rule "crushing chest pain"  ✓ user "chest pain crushing" (word-order tolerant)
  //  rule "worst headache ever"  ✗ user "headache" (preserves prior fix — short
  //                                generic terms don't trigger long ER phrases)
  //  rule "chest pain"           ✗ user ["back pain", "chest cold"] (words split
  //                                across terms — must co-occur in same term)
  const matchKeyword = (keyword: string): boolean => {
    const words = keyword.split(/\s+/).filter(Boolean);
    return lowered.some((u) => words.every((w) => u.includes(w)));
  };

  for (const rule of RED_FLAG_RULES) {
    if (rule.bodyRegion && rule.bodyRegion !== bodyRegion) continue;
    if (
      rule.minSeverity !== undefined &&
      (severity === undefined || severity < rule.minSeverity)
    )
      continue;
    const ruleSymsLower = rule.symptoms.map((s) => s.toLowerCase());
    const matches = ruleSymsLower.filter(matchKeyword);
    if (rule.matchAll && matches.length === ruleSymsLower.length) return rule;
    if (!rule.matchAll && matches.length > 0) return rule;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

const triageSchema = z.object({
  bodyRegion: z.string().min(1).max(64),
  symptoms: z.array(z.string().min(1).max(120)).min(1).max(8),
  onsetHours: z.number().int().min(0).max(720).optional(),
  severity: z.number().int().min(1).max(10),
  notes: z.string().max(2000).optional(),
});

interface TriageResult {
  urgency: "SELF_CARE" | "PRIMARY_CARE" | "URGENT_CARE" | "ER";
  recommendedAction: string;
  rationale: string;
  selfCareSteps: string[];
  whenToSeekCare: string[];
  redFlagRuleId?: string;
  modelGenerated: boolean;
  disclaimer: string;
}

const DISCLAIMER =
  "This is not a medical diagnosis. The Symptom Checker is an informational tool only. Always consult a qualified clinician for evaluation, diagnosis, or treatment.";

function fallbackTriage(input: z.infer<typeof triageSchema>): TriageResult {
  const sev = input.severity;
  const urgency: TriageResult["urgency"] =
    sev >= 9 ? "URGENT_CARE" : sev >= 6 ? "PRIMARY_CARE" : "SELF_CARE";
  const action =
    urgency === "URGENT_CARE"
      ? "Visit an urgent care clinic today, or call your primary care provider for a same-day appointment."
      : urgency === "PRIMARY_CARE"
      ? "Schedule an appointment with your primary care provider within the next few days."
      : "Self-care and monitoring may be appropriate. Watch for changes.";
  return {
    urgency,
    recommendedAction: action,
    rationale: `Based on your reported severity (${sev}/10) and symptoms.`,
    selfCareSteps: [
      "Rest and stay hydrated.",
      "Track your symptoms — note when they change.",
      "If new symptoms appear or existing ones worsen, seek care sooner.",
    ],
    whenToSeekCare: [
      "Symptoms get worse instead of better.",
      "New symptoms appear.",
      "You develop chest pain, shortness of breath, or signs of stroke (facial droop, slurred speech, one-sided weakness).",
    ],
    modelGenerated: false,
    disclaimer: DISCLAIMER,
  };
}

async function llmTriage(
  input: z.infer<typeof triageSchema>
): Promise<TriageResult> {
  const client = getOpenAIClient();
  if (!client) return fallbackTriage(input);

  const userContext = `
Patient-reported information:
- Body region: ${input.bodyRegion}
- Symptoms: ${input.symptoms.join(", ")}
- Onset: ${input.onsetHours ?? "unknown"} hours ago
- Severity: ${input.severity}/10
- Additional notes: ${input.notes ?? "none"}
  `.trim();

  const systemPrompt = `You are a careful, conservative symptom-triage assistant. You do NOT diagnose. You categorize urgency only and recommend an appropriate level of care. Always err on the side of safety. If anything is ambiguous, recommend PRIMARY_CARE rather than SELF_CARE. Always include the disclaimer that this is not medical advice.

Respond ONLY in this JSON shape:
{
  "urgency": "SELF_CARE" | "PRIMARY_CARE" | "URGENT_CARE" | "ER",
  "recommendedAction": string (1-2 sentences),
  "rationale": string (2-3 sentences explaining why this urgency level),
  "selfCareSteps": string[] (3-5 concrete steps),
  "whenToSeekCare": string[] (3-5 specific warning signs that should prompt seeking higher-level care)
}`;

  try {
    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    const completion = await client.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContext },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    const allowedUrgency = ["SELF_CARE", "PRIMARY_CARE", "URGENT_CARE", "ER"];
    const urgency = allowedUrgency.includes(parsed.urgency)
      ? parsed.urgency
      : "PRIMARY_CARE";

    return {
      urgency,
      recommendedAction:
        typeof parsed.recommendedAction === "string"
          ? parsed.recommendedAction
          : "Speak with your primary care provider.",
      rationale:
        typeof parsed.rationale === "string"
          ? parsed.rationale
          : "Based on your reported symptoms.",
      selfCareSteps: Array.isArray(parsed.selfCareSteps)
        ? parsed.selfCareSteps.slice(0, 6).map(String)
        : [],
      whenToSeekCare: Array.isArray(parsed.whenToSeekCare)
        ? parsed.whenToSeekCare.slice(0, 6).map(String)
        : [],
      modelGenerated: true,
      disclaimer: DISCLAIMER,
    };
  } catch (err) {
    console.error("[symptom-checker] LLM triage failed, using fallback:", err);
    return fallbackTriage(input);
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

async function resolveAccountIdFromSession(
  req: Request
): Promise<string | null> {
  // Best-effort account resolution. Never block triage on auth — anonymous
  // users should still be able to use the symptom checker (acquisition
  // surface). We only persist sessions when we can match an account.
  const sessionAny = (req as any).session;
  const email: string | undefined =
    sessionAny?.user?.email ??
    sessionAny?.passport?.user?.email ??
    sessionAny?.email;
  if (!email) return null;
  try {
    const [acct] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.email, email))
      .limit(1);
    return acct?.id ?? null;
  } catch {
    return null;
  }
}

router.post("/triage", async (req: Request, res: Response) => {
  const parse = triageSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid input", details: parse.error.flatten() });
  }

  // 1) Deterministic red-flag rules ALWAYS run first and short-circuit.
  const redFlag = evaluateRedFlags(
    parse.data.symptoms,
    parse.data.bodyRegion,
    parse.data.severity
  );
  let result: TriageResult;
  if (redFlag) {
    result = {
      urgency: redFlag.urgency,
      recommendedAction:
        redFlag.urgency === "ER"
          ? "Call 911 (or your local emergency number) immediately."
          : "Go to an urgent-care clinic now.",
      rationale: redFlag.rationale,
      selfCareSteps: [],
      whenToSeekCare: [
        "These red-flag symptoms always warrant emergency evaluation — don't wait.",
      ],
      redFlagRuleId: redFlag.id,
      modelGenerated: false,
      disclaimer: DISCLAIMER,
    };
  } else {
    // 2) No red flag → LLM triage with structured output (or fallback).
    result = await llmTriage(parse.data);
  }

  // 3) Persist session for the user's history (only if authenticated).
  const accountId = await resolveAccountIdFromSession(req);
  if (accountId) {
    try {
      await db.insert(symptomCheckerSessions).values({
        accountId,
        transcript: parse.data,
        triageResult: result,
      });
    } catch (err) {
      console.error("[symptom-checker] persist session failed:", err);
      // Do not fail the request — triage is the user value.
    }
  }

  res.json({ success: true, result });
});

router.get("/sessions", async (req: Request, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.json({ success: true, sessions: [] });
  try {
    const rows = await db
      .select()
      .from(symptomCheckerSessions)
      .where(eq(symptomCheckerSessions.accountId, accountId))
      .orderBy(desc(symptomCheckerSessions.createdAt))
      .limit(50);
    res.json({ success: true, sessions: rows });
  } catch (err) {
    console.error("[symptom-checker] list sessions failed:", err);
    res.json({ success: true, sessions: [] });
  }
});

export default router;
