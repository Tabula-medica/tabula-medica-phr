import { Router, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { accounts, proInstruments, proResponses, type ProInstrument } from "@shared/schema";
import { requireFeature, type AuthRequest } from "../middleware/require-feature";

const router = Router();

interface InstrumentItem {
  id: string;
  text: string;
  options: Array<{ label: string; value: number }>;
}

interface SeverityBand {
  min: number;
  max: number;
  severity: string;
  color: string;
}

const PHQ9_OPTIONS = [
  { label: "Not at all", value: 0 },
  { label: "Several days", value: 1 },
  { label: "More than half the days", value: 2 },
  { label: "Nearly every day", value: 3 },
];

const PHQ9_ITEMS: InstrumentItem[] = [
  { id: "q1", text: "Little interest or pleasure in doing things", options: PHQ9_OPTIONS },
  { id: "q2", text: "Feeling down, depressed, or hopeless", options: PHQ9_OPTIONS },
  { id: "q3", text: "Trouble falling/staying asleep, or sleeping too much", options: PHQ9_OPTIONS },
  { id: "q4", text: "Feeling tired or having little energy", options: PHQ9_OPTIONS },
  { id: "q5", text: "Poor appetite or overeating", options: PHQ9_OPTIONS },
  { id: "q6", text: "Feeling bad about yourself — or that you are a failure or have let yourself or your family down", options: PHQ9_OPTIONS },
  { id: "q7", text: "Trouble concentrating on things, such as reading or watching TV", options: PHQ9_OPTIONS },
  { id: "q8", text: "Moving or speaking so slowly that other people could have noticed — or being so fidgety/restless that you have been moving around a lot more than usual", options: PHQ9_OPTIONS },
  { id: "q9", text: "Thoughts that you would be better off dead, or of hurting yourself in some way", options: PHQ9_OPTIONS },
];

const PHQ9_BANDS: SeverityBand[] = [
  { min: 0, max: 4, severity: "Minimal", color: "#10b981" },
  { min: 5, max: 9, severity: "Mild", color: "#84cc16" },
  { min: 10, max: 14, severity: "Moderate", color: "#f59e0b" },
  { min: 15, max: 19, severity: "Moderately severe", color: "#f97316" },
  { min: 20, max: 27, severity: "Severe", color: "#ef4444" },
];

const GAD7_OPTIONS = PHQ9_OPTIONS;

const GAD7_ITEMS: InstrumentItem[] = [
  { id: "q1", text: "Feeling nervous, anxious, or on edge", options: GAD7_OPTIONS },
  { id: "q2", text: "Not being able to stop or control worrying", options: GAD7_OPTIONS },
  { id: "q3", text: "Worrying too much about different things", options: GAD7_OPTIONS },
  { id: "q4", text: "Trouble relaxing", options: GAD7_OPTIONS },
  { id: "q5", text: "Being so restless that it's hard to sit still", options: GAD7_OPTIONS },
  { id: "q6", text: "Becoming easily annoyed or irritable", options: GAD7_OPTIONS },
  { id: "q7", text: "Feeling afraid as if something awful might happen", options: GAD7_OPTIONS },
];

const GAD7_BANDS: SeverityBand[] = [
  { min: 0, max: 4, severity: "Minimal", color: "#10b981" },
  { min: 5, max: 9, severity: "Mild", color: "#84cc16" },
  { min: 10, max: 14, severity: "Moderate", color: "#f59e0b" },
  { min: 15, max: 21, severity: "Severe", color: "#ef4444" },
];

const PROMIS29_OPTIONS_5 = [
  { label: "Never", value: 1 },
  { label: "Rarely", value: 2 },
  { label: "Sometimes", value: 3 },
  { label: "Often", value: 4 },
  { label: "Always", value: 5 },
];

const PROMIS29_ITEMS: InstrumentItem[] = [
  { id: "q1", text: "I am able to perform my daily routines", options: PROMIS29_OPTIONS_5 },
  { id: "q2", text: "I feel anxious", options: PROMIS29_OPTIONS_5 },
  { id: "q3", text: "I feel depressed", options: PROMIS29_OPTIONS_5 },
  { id: "q4", text: "I feel fatigued", options: PROMIS29_OPTIONS_5 },
  { id: "q5", text: "My sleep quality is good", options: PROMIS29_OPTIONS_5 },
  { id: "q6", text: "I am satisfied with my social activities", options: PROMIS29_OPTIONS_5 },
  { id: "q7", text: "I have pain that interferes with daily activities", options: PROMIS29_OPTIONS_5 },
];

const PROMIS29_BANDS: SeverityBand[] = [
  { min: 0, max: 14, severity: "Within normal limits", color: "#10b981" },
  { min: 15, max: 22, severity: "Mild concerns", color: "#f59e0b" },
  { min: 23, max: 35, severity: "Significant concerns", color: "#ef4444" },
];

const SEED_INSTRUMENTS: ProInstrument[] = [
  {
    code: "PHQ-9",
    name: "Patient Health Questionnaire-9",
    version: "1.0",
    description: "Validated 9-item depression screener. Over the last 2 weeks, how often have you been bothered by any of the following problems?",
    items: PHQ9_ITEMS,
    scoringFn: "sum",
    severityBands: PHQ9_BANDS,
  },
  {
    code: "GAD-7",
    name: "Generalized Anxiety Disorder-7",
    version: "1.0",
    description: "Validated 7-item anxiety screener. Over the last 2 weeks, how often have you been bothered by the following problems?",
    items: GAD7_ITEMS,
    scoringFn: "sum",
    severityBands: GAD7_BANDS,
  },
  {
    code: "PROMIS-29",
    name: "PROMIS-29 (short form)",
    version: "1.0",
    description: "Patient-Reported Outcomes Measurement Information System — short global health profile.",
    items: PROMIS29_ITEMS,
    scoringFn: "sum",
    severityBands: PROMIS29_BANDS,
  },
];

let seeded = false;
async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  try {
    for (const inst of SEED_INSTRUMENTS) {
      const [existing] = await db
        .select({ code: proInstruments.code })
        .from(proInstruments)
        .where(eq(proInstruments.code, inst.code))
        .limit(1);
      if (!existing) {
        await db.insert(proInstruments).values(inst);
      }
    }
    seeded = true;
  } catch (err) {
    console.error("[PRO] failed to seed instruments", err);
  }
}

async function resolveAccountIdFromSession(req: AuthRequest): Promise<string | null> {
  const sub = req.user?.claims?.sub;
  const email = req.user?.claims?.email;
  if (!sub && !email) return null;
  try {
    if (email) {
      const [acct] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.email, email))
        .limit(1);
      if (acct) return acct.id;
    }
    return null;
  } catch (err) {
    console.error("[PRO] resolveAccountIdFromSession error", err);
    return null;
  }
}

function scoreSubmission(
  instrument: ProInstrument,
  answers: Record<string, number>,
): { score: number; severity: string; flagged: boolean } {
  const values = instrument.items.map((it) => Number(answers[it.id] ?? 0));
  const score = values.reduce((acc, v) => acc + v, 0);
  const band = instrument.severityBands.find((b) => score >= b.min && score <= b.max);
  const severity = band?.severity ?? "Unknown";
  let flagged = false;
  if (instrument.code === "PHQ-9") {
    const q9 = Number(answers["q9"] ?? 0);
    if (score >= 20 || q9 >= 1) flagged = true;
  } else if (instrument.code === "GAD-7") {
    if (score >= 15) flagged = true;
  } else if (instrument.code === "PROMIS-29") {
    if (score >= 23) flagged = true;
  }
  return { score, severity, flagged };
}

router.get(
  "/instruments",
  requireFeature("pro_outcomes"),
  async (_req, res: Response) => {
    await ensureSeeded();
    try {
      const rows = await db.select().from(proInstruments);
      res.json({ instruments: rows });
    } catch (err) {
      console.error("[PRO] GET /instruments error", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  },
);

router.get(
  "/responses",
  requireFeature("pro_outcomes"),
  async (req: AuthRequest, res: Response) => {
    const accountId = await resolveAccountIdFromSession(req);
    if (!accountId) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    try {
      const rows = await db
        .select()
        .from(proResponses)
        .where(eq(proResponses.accountId, accountId))
        .orderBy(desc(proResponses.submittedAt))
        .limit(200);
      res.json({ responses: rows });
    } catch (err) {
      console.error("[PRO] GET /responses error", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  },
);

router.post(
  "/responses",
  requireFeature("pro_outcomes"),
  async (req: AuthRequest, res: Response) => {
    const accountId = await resolveAccountIdFromSession(req);
    if (!accountId) {
      return res.status(401).json({ error: "UNAUTHORIZED" });
    }
    await ensureSeeded();

    const { instrumentCode, answers } = req.body ?? {};
    if (typeof instrumentCode !== "string" || !instrumentCode) {
      return res.status(400).json({ error: "INVALID_INSTRUMENT_CODE" });
    }
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return res.status(400).json({ error: "INVALID_ANSWERS" });
    }

    try {
      const [instrument] = await db
        .select()
        .from(proInstruments)
        .where(eq(proInstruments.code, instrumentCode))
        .limit(1);
      if (!instrument) {
        return res.status(404).json({ error: "INSTRUMENT_NOT_FOUND" });
      }

      // Validate every item answered with a value within its options range.
      for (const item of instrument.items) {
        const v = answers[item.id];
        if (typeof v !== "number" || !Number.isFinite(v)) {
          return res.status(400).json({ error: "MISSING_ANSWER", item: item.id });
        }
        const allowed = item.options.map((o) => o.value);
        if (!allowed.includes(v)) {
          return res.status(400).json({ error: "OUT_OF_RANGE_ANSWER", item: item.id });
        }
      }

      const { score, severity, flagged } = scoreSubmission(instrument, answers as Record<string, number>);

      const [inserted] = await db
        .insert(proResponses)
        .values({
          accountId,
          instrumentCode: instrument.code,
          answers: answers as Record<string, number>,
          score,
          severity,
          flagged,
        })
        .returning();

      res.json({
        response: inserted,
        clinicianBanner: flagged
          ? {
              title: "Your responses suggest you may benefit from speaking with a clinician.",
              description:
                instrument.code === "PHQ-9"
                  ? "If you are having thoughts of self-harm, please call or text 988 (Suicide & Crisis Lifeline) right now. Your care team can also help — see options below."
                  : "Your score is in a higher range. Consider reaching out to your care team — see options below.",
              ctaHref: "/care-access",
              ctaLabel: "Find care options",
            }
          : null,
      });
    } catch (err) {
      console.error("[PRO] POST /responses error", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  },
);

router.get(
  "/responses/by-instrument",
  requireFeature("pro_outcomes"),
  async (req: AuthRequest, res: Response) => {
    const accountId = await resolveAccountIdFromSession(req);
    if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
    const code = String(req.query.code ?? "");
    if (!code) return res.status(400).json({ error: "MISSING_CODE" });
    try {
      const rows = await db
        .select()
        .from(proResponses)
        .where(and(eq(proResponses.accountId, accountId), eq(proResponses.instrumentCode, code)))
        .orderBy(desc(proResponses.submittedAt))
        .limit(60);
      res.json({ responses: rows });
    } catch (err) {
      console.error("[PRO] GET /responses/by-instrument error", err);
      res.status(500).json({ error: "INTERNAL_ERROR" });
    }
  },
);

export default router;
