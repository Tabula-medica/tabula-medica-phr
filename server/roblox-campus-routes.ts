import { Router, Request, Response } from "express";
import { generateText } from "./services/ai-provider";
import {
  awardRobloxBadge,
  getLinkedPatientId,
  getPatientId,
  requireRobloxApiKey,
} from "./roblox-education-link-routes";

/**
 * "Campus Life" — the teen/college-age/newly-married tier of World Clinic,
 * a SEPARATE Roblox experience from the kids' game (see
 * roblox-campus/README.md for why: Roblox's content-maturity labeling only
 * works correctly when age-appropriate content lives in its own place, not
 * as a "mode" inside an all-ages experience).
 *
 * Same architecture as Future Health (roblox-clinic-routes.ts): fictional
 * NPC patients present a care-gap modeled on a real preventive-care concept
 * relevant to this life stage, a rules-based star scorecard, and an AI
 * coach ("Nova," same voice, an older register) for tips only.
 *
 * Content boundary: every topic here is handled the way Roblox's Community
 * Standards require for teen/young-adult content — conceptual and
 * "here's why this matters," never a depiction of drinking, drug use, or
 * explicit sexual content, and no real medical advice. Screening/counseling
 * topics (alcohol, tobacco, mental health, sexual health) are framed as
 * "your doctor may ask about X, and that's normal and confidential" rather
 * than simulated. This experience should be published with Roblox's 13+
 * content-maturity descriptors, not bundled with the all-ages one.
 *
 * PHI boundary: identical to the rest of /api/roblox — only a Roblox
 * UserId, a measure id, and an outcome ever cross. AI coaching receives
 * only aggregate game counts, routed through the BAA-covered provider path.
 */

const router = Router();

export interface CampusMeasure {
  id: string;
  kidName: string;
  whatItTeaches: string;
  clinicalReference: string;
  npcPrompt: string;
}

// Preventive-care concepts relevant to teens (13-17), college-age (18-22),
// and newly-married young adults (20s-30s) — grounded in USPSTF/ACOG-style
// guidance, framed conceptually per the content boundary above.
export const CAMPUS_MEASURES: CampusMeasure[] = [
  {
    id: "mental-health-checkin",
    kidName: "Mind Check",
    whatItTeaches: "A regular mental health check-in catches burnout and anxiety before they snowball.",
    clinicalReference: "Depression/anxiety screening for adolescents and adults (USPSTF)",
    npcPrompt: "Everyone says college is supposed to be stressful. Is it weird that I want to talk about it?",
  },
  {
    id: "hpv-catchup",
    kidName: "Shot Catch-Up",
    whatItTeaches: "HPV and meningitis vaccines are usually most effective before or during the teen years — catching up matters.",
    clinicalReference: "HPV / meningococcal catch-up immunization (ACIP)",
    npcPrompt: "I never got my HPV shot as a kid. Is it too late now?",
  },
  {
    id: "sexual-health-checkin",
    kidName: "Confidential Check-In",
    whatItTeaches: "Sexual health visits are routine, confidential, and just part of good preventive care.",
    clinicalReference: "Sexual health / STI screening counseling access (USPSTF, ACOG)",
    npcPrompt: "My doctor asked some personal questions at my last visit. Is that normal?",
  },
  {
    id: "substance-use-screening",
    kidName: "Honest Answers",
    whatItTeaches: "Doctors ask about alcohol and tobacco because honest answers lead to better, judgment-free care — not to get anyone in trouble.",
    clinicalReference: "Alcohol and tobacco use screening/counseling (USPSTF, SBIRT)",
    npcPrompt: "Do I really have to answer the questions about drinking and smoking honestly?",
  },
  {
    id: "sports-physical",
    kidName: "Cleared to Play",
    whatItTeaches: "A sports physical (and knowing concussion warning signs) keeps you safer, not sidelined.",
    clinicalReference: "Pre-participation sports physical / concussion protocol awareness",
    npcPrompt: "I feel fine — do I actually need a physical before the season starts?",
  },
  {
    id: "sleep-and-stress",
    kidName: "Recharge Check",
    whatItTeaches: "Chronic sleep debt shows up as mood, focus, and even immune problems — it's worth tracking.",
    clinicalReference: "Sleep health counseling for adolescents/young adults",
    npcPrompt: "I run on 4 hours of sleep most nights. That's just normal for college, right?",
  },
  {
    id: "family-planning-conversation",
    kidName: "Planning Ahead",
    whatItTeaches: "Talking with a provider about family planning options — whenever that's relevant to you — is a normal, judgment-free visit.",
    clinicalReference: "Contraception/family-planning counseling access (ACOG)",
    npcPrompt: "We just got married — when should we even bring up family planning with a doctor?",
  },
  {
    id: "insurance-literacy",
    kidName: "Coverage Check",
    whatItTeaches: "Understanding your own insurance (or your spouse's plan) before you need it saves a lot of stress later.",
    clinicalReference: "Health insurance literacy / preventive-care-benefit awareness",
    npcPrompt: "I just aged off my parents' insurance. What am I even supposed to do now?",
  },
];

const MEASURE_IDS = new Set(CAMPUS_MEASURES.map((m) => m.id));

const CAMPUS_CHAMPION_BADGE = "roblox-campus-champion";
const CHAMPION_MIN_EVENTS = 10;
const CHAMPION_MIN_STARS = 4;

type Outcome = "closed" | "missed";

interface CampusEvent {
  robloxUserId: string;
  measureId: string;
  outcome: Outcome;
  at: string;
}

interface MeasureScore {
  measureId: string;
  kidName: string;
  closed: number;
  missed: number;
  rate: number | null;
}

export interface CampusScorecard {
  robloxUserId: string;
  totalEvents: number;
  overallRate: number | null;
  stars: number;
  measures: MeasureScore[];
  coachingTip: string;
  championEarned: boolean;
}

// In-memory, consistent with the rest of the Roblox module.
const campusEvents: CampusEvent[] = [];
const tipCache = new Map<string, { key: string; tip: string }>();

const CURATED_TIPS = [
  "The doctor's office isn't a trap — it's one of the few places where honesty only helps you.",
  "Catching up on care now is easier than fixing what you skipped later.",
  "Confidential means confidential. That's not a technicality, it's the point.",
  "Sleep debt compounds just like the other kind. Pay it down when you can.",
  "'Is this normal to ask about?' — yes, almost always. That's the job.",
];

function starsFor(rate: number | null, totalEvents: number): number {
  if (rate === null || totalEvents === 0) return 0;
  if (rate >= 0.9) return 5;
  if (rate >= 0.75) return 4;
  if (rate >= 0.6) return 3;
  if (rate >= 0.4) return 2;
  return 1;
}

function curatedTip(scores: MeasureScore[]): string {
  const weakest = scores
    .filter((s) => s.rate !== null)
    .sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1))[0];
  const measure = weakest && CAMPUS_MEASURES.find((m) => m.id === weakest.measureId);
  if (measure && (weakest.rate ?? 1) < 0.75) {
    return `Your "${measure.kidName}" numbers could use attention. ${measure.whatItTeaches}`;
  }
  return CURATED_TIPS[Math.floor(Math.random() * CURATED_TIPS.length)];
}

async function novaTip(scores: MeasureScore[], stars: number): Promise<string> {
  const summary = scores
    .filter((s) => s.closed + s.missed > 0)
    .map((s) => `${s.kidName}: ${s.closed} done, ${s.missed} missed`)
    .join("; ");

  try {
    const text = await generateText(
      {
        systemPrompt:
          "You are Nova, an AI co-pilot inside a life-sim game about running a campus/young-adult health " +
          "clinic. You talk to players aged roughly 13-30 like a smart, direct, non-preachy friend — " +
          "confident and a little dry, never clinical or corny. Reply with ONE tip, at most two short " +
          "sentences and under 200 characters. Talk only about the pretend clinic's preventive-care habits. " +
          "Never give medical advice, never mention medicines or drugs by name, never mention real doctors, " +
          "hospitals, or brands, never discuss or depict alcohol/drug use itself (only that screening for it " +
          "is routine and confidential), and never ask the player for personal information.",
        userPrompt: `The pretend clinic has ${stars} out of 5 stars. Visit tally: ${summary || "no visits yet"}. Give the tip.`,
        temperature: 0.6,
        maxTokens: 90,
      },
      "roblox-campus-nova-coach"
    );
    const cleaned = text.trim().replace(/\s+/g, " ");
    return cleaned.length > 0 && cleaned.length <= 300 ? cleaned : curatedTip(scores);
  } catch {
    return curatedTip(scores);
  }
}

async function buildScorecard(robloxUserId: string): Promise<CampusScorecard> {
  const mine = campusEvents.filter((e) => e.robloxUserId === robloxUserId);

  const measures: MeasureScore[] = CAMPUS_MEASURES.map((m) => {
    const closed = mine.filter((e) => e.measureId === m.id && e.outcome === "closed").length;
    const missed = mine.filter((e) => e.measureId === m.id && e.outcome === "missed").length;
    const total = closed + missed;
    return { measureId: m.id, kidName: m.kidName, closed, missed, rate: total ? closed / total : null };
  });

  const closedAll = mine.filter((e) => e.outcome === "closed").length;
  const overallRate = mine.length ? closedAll / mine.length : null;
  const stars = starsFor(overallRate, mine.length);

  const cacheKey = `${mine.length}:${closedAll}`;
  const cached = tipCache.get(robloxUserId);
  const coachingTip = cached?.key === cacheKey ? cached.tip : await novaTip(measures, stars);
  tipCache.set(robloxUserId, { key: cacheKey, tip: coachingTip });

  let championEarned = false;
  if (mine.length >= CHAMPION_MIN_EVENTS && stars >= CHAMPION_MIN_STARS) {
    const result = awardRobloxBadge(robloxUserId, CAMPUS_CHAMPION_BADGE, "campus-life", "health_improvement");
    championEarned = result.awarded || result.reason === "already_awarded";
  }

  return { robloxUserId, totalEvents: mine.length, overallRate, stars, measures, coachingTip, championEarned };
}

// ---------------------------------------------------------------------------
// Roblox game-server endpoints
// ---------------------------------------------------------------------------

router.get("/measures", requireRobloxApiKey, (_req: Request, res: Response) => {
  res.json({ measures: CAMPUS_MEASURES });
});

router.post("/event", requireRobloxApiKey, async (req: Request, res: Response) => {
  const { robloxUserId, measureId, outcome } = req.body ?? {};
  if (!robloxUserId || !MEASURE_IDS.has(String(measureId)) || (outcome !== "closed" && outcome !== "missed")) {
    res.status(400).json({ error: "robloxUserId, a known measureId, and outcome ('closed'|'missed') are required" });
    return;
  }
  if (!getLinkedPatientId(String(robloxUserId))) {
    res.status(404).json({ error: "This Roblox account is not linked to a Tabula Medica profile" });
    return;
  }

  campusEvents.push({
    robloxUserId: String(robloxUserId),
    measureId: String(measureId),
    outcome,
    at: new Date().toISOString(),
  });

  res.json(await buildScorecard(String(robloxUserId)));
});

router.get("/scorecard", requireRobloxApiKey, async (req: Request, res: Response) => {
  const robloxUserId = String(req.query.robloxUserId ?? "");
  if (!robloxUserId) {
    res.status(400).json({ error: "robloxUserId is required" });
    return;
  }
  if (!getLinkedPatientId(robloxUserId)) {
    res.status(404).json({ error: "This Roblox account is not linked to a Tabula Medica profile" });
    return;
  }
  res.json(await buildScorecard(robloxUserId));
});

// ---------------------------------------------------------------------------
// Authenticated app-side endpoint (family/self views the scorecard in the app)
// ---------------------------------------------------------------------------

router.get("/me", async (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  if (!patientId) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  const robloxUserId = campusEvents.find((e) => getLinkedPatientId(e.robloxUserId) === patientId)?.robloxUserId;
  if (!robloxUserId) {
    res.json({ scorecard: null });
    return;
  }
  res.json({ scorecard: await buildScorecard(robloxUserId) });
});

export default router;

export function registerRobloxCampusRoutes(app: import("express").Express) {
  app.use("/api/roblox/campus", router);
  console.log("[Routes] Roblox Campus Life routes registered at /api/roblox/campus/*");
}
