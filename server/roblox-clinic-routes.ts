import { Router, Request, Response } from "express";
import { generateText } from "./services/ai-provider";
import {
  awardRobloxBadge,
  getLinkedPatientId,
  getPatientId,
  requireRobloxApiKey,
} from "./roblox-education-link-routes";

/**
 * "Future Health" — the HEDIS-concept mini-game for World Clinic.
 *
 * The player runs a pretend clinic staffed by an AI guide ("Dr. Nova"). Fictional
 * NPC patients show up with a care gap modeled on a real HEDIS measure concept
 * (well-child visit due, immunization due, blood-pressure check, ...). Closing
 * the gap in time counts toward the clinic's scorecard; the scorecard is rated
 * with a rules-based star rating, and Dr. Nova offers a short coaching tip.
 *
 * What this is NOT: a rating of any real physician, hospital, or health plan.
 * Every "patient" is fictional and every score reflects only the player's own
 * in-game choices. HEDIS® is a registered trademark of NCQA; the measures here
 * are simplified educational approximations, not certified HEDIS measures.
 *
 * PHI boundary: identical to the rest of /api/roblox — only a Roblox UserId,
 * a measure id, and an outcome ever cross. The AI coaching prompt receives
 * only aggregate game counts (never a name or any real health data), and it
 * is routed through the BAA-covered provider path (services/ai-provider.ts).
 */

const router = Router();

export interface ClinicMeasure {
  id: string;
  kidName: string;
  whatItTeaches: string;
  hedisReference: string;
  npcPrompt: string;
}

// Kid-appropriate subset of HEDIS measure *concepts*. Adult-only screenings
// (e.g. breast/colorectal cancer) are deliberately left out.
export const CLINIC_MEASURES: ClinicMeasure[] = [
  {
    id: "well-child-visit",
    kidName: "Yearly Stat Check",
    whatItTeaches: "Even a maxed-out character gets a yearly stat check — that's how you catch small stuff early.",
    hedisReference: "Child and Adolescent Well-Care Visits (WCV)",
    npcPrompt: "I feel 100% today. Do I still need my stat check?",
  },
  {
    id: "immunizations",
    kidName: "Shot Streak",
    whatItTeaches: "Shots on time keep your whole squad in the game, not just you.",
    hedisReference: "Childhood Immunization Status (CIS) / Immunizations for Adolescents (IMA)",
    npcPrompt: "My tracker says a shot's due this month. Keep the streak alive?",
  },
  {
    id: "weight-and-activity",
    kidName: "Fuel & Move Check",
    whatItTeaches: "Snacks and playtime are basically your character's stat build — worth checking in on.",
    hedisReference: "Weight Assessment and Counseling for Nutrition and Physical Activity (WCC)",
    npcPrompt: "Can we talk loadout — snacks and how much I move around?",
  },
  {
    id: "asthma-controller",
    kidName: "Breathe-Easy Combo",
    whatItTeaches: "The everyday controller move is what stops the big flare-ups from happening at all.",
    hedisReference: "Asthma Medication Ratio (AMR)",
    npcPrompt: "I only pull out my inhaler when I'm already wheezing. That's fine, right?",
  },
  {
    id: "blood-pressure",
    kidName: "Pressure Check",
    whatItTeaches: "A quick arm-cuff squeeze is a live read on how hard your heart's engine is working.",
    hedisReference: "Controlling High Blood Pressure (CBP)",
    npcPrompt: "What's this squeezy arm thing even do?",
  },
  {
    id: "lead-screening",
    kidName: "Safe-House Scan",
    whatItTeaches: "A tiny blood test checks for lead, which can hide in old paint and pipes.",
    hedisReference: "Lead Screening in Children (LSC)",
    npcPrompt: "We just moved into an old house — should I get scanned for anything?",
  },
  {
    id: "dental-visit",
    kidName: "Smile Check",
    whatItTeaches: "Twice a year keeps your smile's defense stats maxed, cavities or not.",
    hedisReference: "Oral Evaluation, Dental Services (OED)",
    npcPrompt: "Zero cavities so far. Do I really still need to go?",
  },
  {
    id: "depression-screening",
    kidName: "Feelings Check-In",
    whatItTeaches: "Your mood counts as a stat too — it's okay to say 'not great.'",
    hedisReference: "Depression Screening and Follow-Up for Adolescents and Adults (DSF-E)",
    npcPrompt: "The nurse asked how I've been feeling lately. Why's that part of the checkup?",
  },
];

const MEASURE_IDS = new Set(CLINIC_MEASURES.map((m) => m.id));

const CHECKUP_CHAMPION_BADGE = "roblox-checkup-champion";
const CHAMPION_MIN_EVENTS = 10;
const CHAMPION_MIN_STARS = 4;

type Outcome = "closed" | "missed";

interface ClinicEvent {
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

export interface Scorecard {
  robloxUserId: string;
  totalEvents: number;
  overallRate: number | null;
  stars: number;
  measures: MeasureScore[];
  coachingTip: string;
  championEarned: boolean;
}

// In-memory, consistent with the rest of the Roblox module.
const clinicEvents: ClinicEvent[] = [];
const tipCache = new Map<string, { key: string; tip: string }>();

const CURATED_TIPS = [
  "Real MVPs get checked even when they feel unstoppable — that's the move.",
  "Shots on time keep your whole squad in the game, not just one player.",
  "Every scan and check is intel. More intel, stronger build.",
  "Feelings count as stats too — check in, not just check-ups.",
  "'Do I really need this?' is your cue to drop the knowledge, not skip the visit.",
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
  const measure = weakest && CLINIC_MEASURES.find((m) => m.id === weakest.measureId);
  if (measure && (weakest.rate ?? 1) < 0.75) {
    return `Your "${measure.kidName}" numbers are slipping. ${measure.whatItTeaches}`;
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
          "You are Nova, a hyped-up AI co-pilot inside a kids' clinic-sim game. You talk to players aged " +
          "7-12 like a friendly esports coach — upbeat and encouraging, using light game words (streak, " +
          "level up, boss move, squad) instead of clinical language. Reply with ONE tip, at most two short " +
          "sentences and under 180 characters. Talk only about the pretend clinic's checkup habits. Never " +
          "give medical advice, never mention medicines by name, never mention real doctors or hospitals, " +
          "and never ask the child for personal information.",
        userPrompt: `The pretend clinic has ${stars} out of 5 stars. Visit tally: ${summary || "no visits yet"}. Give the tip.`,
        temperature: 0.6,
        maxTokens: 80,
      },
      "roblox-nova-coach"
    );
    const cleaned = text.trim().replace(/\s+/g, " ");
    return cleaned.length > 0 && cleaned.length <= 280 ? cleaned : curatedTip(scores);
  } catch {
    return curatedTip(scores);
  }
}

async function buildScorecard(robloxUserId: string): Promise<Scorecard> {
  const mine = clinicEvents.filter((e) => e.robloxUserId === robloxUserId);

  const measures: MeasureScore[] = CLINIC_MEASURES.map((m) => {
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
    const result = awardRobloxBadge(robloxUserId, CHECKUP_CHAMPION_BADGE, "future-health", "health_improvement");
    championEarned = result.awarded || result.reason === "already_awarded";
  }

  return { robloxUserId, totalEvents: mine.length, overallRate, stars, measures, coachingTip, championEarned };
}

// ---------------------------------------------------------------------------
// Roblox game-server endpoints
// ---------------------------------------------------------------------------

router.get("/measures", requireRobloxApiKey, (_req: Request, res: Response) => {
  res.json({ measures: CLINIC_MEASURES });
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

  clinicEvents.push({
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
// Authenticated app-side endpoint (family views the kid's clinic in the app)
// ---------------------------------------------------------------------------

router.get("/me", async (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  if (!patientId) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  const robloxUserId = clinicEvents.find((e) => getLinkedPatientId(e.robloxUserId) === patientId)?.robloxUserId;
  if (!robloxUserId) {
    res.json({ scorecard: null });
    return;
  }
  res.json({ scorecard: await buildScorecard(robloxUserId) });
});

export default router;

export function registerRobloxClinicRoutes(app: import("express").Express) {
  app.use("/api/roblox/clinic", router);
  console.log("[Routes] Roblox Future Health routes registered at /api/roblox/clinic/*");
}
