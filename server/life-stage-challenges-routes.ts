import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { calculatePoints } from "./gamification-engine";
import { Badge, PointCategory } from "@shared/schema";
import { storage } from "./storage";

/**
 * Life Stage Health Challenges — decade-banded preventive-care nudges for
 * adults 50+, layered on top of the existing gamification engine
 * (gamification-engine.ts) the same way the pediatric Roblox badge catalog
 * was. This is NOT a diagnostic tool and does not replace
 * preventive-care-service.ts's clinical recommendation engine — it's a
 * lightweight, self-report "did you do this" companion that turns routine
 * preventive care into a completable checklist with points and a tier badge.
 *
 * Unlike the Roblox module, this runs entirely inside the authenticated PHR,
 * so it can read the signed-in profile's real date of birth (same `Profile`
 * shape already returned by GET /api/profiles/active) to pick a tier. Every
 * challenge description is a general educational nudge ("talk to your
 * doctor about X"), never a diagnosis or personalized medical advice.
 */

const router = Router();

export type AgeBand = "50-59" | "60-69" | "70-plus";

export interface LifeStageChallenge {
  id: string;
  title: string;
  description: string;
  category: string;
  pointCategory: PointCategory;
}

const CHALLENGE_CATALOG: Record<AgeBand, LifeStageChallenge[]> = {
  "50-59": [
    {
      id: "cardio-checkin",
      title: "Cardiometabolic Check-In",
      description: "Ask your doctor to review your blood pressure, cholesterol, and blood sugar together this year.",
      category: "heart",
      pointCategory: "health_improvement",
    },
    {
      id: "colon-screening-start",
      title: "Colon Screening Conversation",
      description: "Talk to your doctor about when to start colorectal cancer screening — many guidelines now recommend beginning at 45.",
      category: "cancer_screening",
      pointCategory: "milestone_reached",
    },
    {
      id: "cancer-screening-checkin",
      title: "Screening Check-In",
      description: "Confirm you're current on the cancer screenings your doctor recommends for your age and risk factors.",
      category: "cancer_screening",
      pointCategory: "health_improvement",
    },
    {
      id: "hormone-health",
      title: "Hormone Health Check-In",
      description: "If you're noticing perimenopause or hormone-related changes, bring them up at your next visit — they're worth discussing.",
      category: "hormone",
      pointCategory: "engagement",
    },
    {
      id: "bone-density-baseline",
      title: "Bone Density Conversation",
      description: "Ask whether a baseline bone density scan makes sense for you based on your risk factors.",
      category: "bone",
      pointCategory: "engagement",
    },
    {
      id: "midlife-stress-checkin",
      title: "Stress & Burnout Check-In",
      description: "Midlife often means caregiving for kids and parents at once. Take 5 minutes to honestly check in on your stress load.",
      category: "mental_health",
      pointCategory: "daily_checkin",
    },
    {
      id: "sleep-tuneup",
      title: "Sleep Quality Tune-Up",
      description: "Track your sleep for a week and flag anything worth mentioning to your doctor (snoring, waking often, daytime fatigue).",
      category: "sleep",
      pointCategory: "engagement",
    },
    {
      id: "hearing-vision-baseline",
      title: "Hearing & Vision Baseline",
      description: "Schedule a hearing and vision check if it's been a few years — small changes are easy to miss day to day.",
      category: "senses",
      pointCategory: "engagement",
    },
  ],
  "60-69": [
    {
      id: "colonoscopy-continuation",
      title: "Cancer Screening Continuation",
      description: "Confirm your colonoscopy and other age-appropriate cancer screenings are up to date.",
      category: "cancer_screening",
      pointCategory: "milestone_reached",
    },
    {
      id: "shingles-vaccine",
      title: "Shingles Vaccine Check",
      description: "Ask your doctor or pharmacist whether you're due for the shingles vaccine.",
      category: "immunization",
      pointCategory: "health_improvement",
    },
    {
      id: "seasonal-vaccines",
      title: "Seasonal Vaccine Check",
      description: "Confirm your flu, pneumonia, and COVID vaccines are current for the season.",
      category: "immunization",
      pointCategory: "health_improvement",
    },
    {
      id: "fall-risk-checkin",
      title: "Fall-Risk & Balance Check-In",
      description: "Try standing on one foot for 10 seconds. If it's hard, mention balance to your doctor — it's a easy thing to work on early.",
      category: "mobility",
      pointCategory: "engagement",
    },
    {
      id: "retirement-transition",
      title: "Retirement Transition Check-In",
      description: "Big life transitions affect mental health too. Check in with yourself (or a professional) about how the adjustment is going.",
      category: "mental_health",
      pointCategory: "daily_checkin",
    },
    {
      id: "hearing-loss-screening",
      title: "Hearing Loss Screening",
      description: "Hearing changes are common and very treatable. Get a hearing screening if you haven't in the last couple years.",
      category: "senses",
      pointCategory: "engagement",
    },
    {
      id: "medicare-literacy",
      title: "Medicare Enrollment Check",
      description: "Review your Medicare coverage during open enrollment to make sure it still fits your needs.",
      category: "insurance",
      pointCategory: "engagement",
    },
    {
      id: "joint-mobility-checkin",
      title: "Joint & Mobility Check-In",
      description: "Note any new joint pain or stiffness and bring it up at your next visit rather than working around it.",
      category: "mobility",
      pointCategory: "engagement",
    },
  ],
  "70-plus": [
    {
      id: "fall-prevention-walkthrough",
      title: "Home Safety Walkthrough",
      description: "Walk through your home looking for fall hazards — loose rugs, poor lighting, missing grab bars.",
      category: "safety",
      pointCategory: "milestone_reached",
    },
    {
      id: "cognitive-checkin",
      title: "Cognitive Health Check-In",
      description: "Memory changes are worth an open conversation with your doctor, even if they seem minor — early is always better.",
      category: "cognitive",
      pointCategory: "health_improvement",
    },
    {
      id: "medication-reconciliation",
      title: "Medication Reconciliation",
      description: "Bring every pill bottle and supplement to your next visit so your doctor can review them all together.",
      category: "medication",
      pointCategory: "milestone_reached",
    },
    {
      id: "social-connection-checkin",
      title: "Social Connection Check-In",
      description: "Loneliness affects health as much as physical risk factors do. Check in on your social connections this week.",
      category: "mental_health",
      pointCategory: "daily_checkin",
    },
    {
      id: "advance-directive",
      title: "Advance Directive Conversation",
      description: "Start or review an advance directive with your family so your wishes are documented and known.",
      category: "planning",
      pointCategory: "milestone_reached",
    },
    {
      id: "caregiver-support",
      title: "Caregiver Support Check-In",
      description: "If someone cares for you, or you care for someone, make sure they know what support resources exist.",
      category: "caregiving",
      pointCategory: "engagement",
    },
    {
      id: "hydration-nutrition",
      title: "Hydration & Nutrition Check-In",
      description: "Thirst cues weaken with age — set a daily water reminder and note it if appetite has changed.",
      category: "nutrition",
      pointCategory: "engagement",
    },
    {
      id: "driving-safety",
      title: "Driving Safety Conversation",
      description: "Have an honest, judgment-free conversation with family about driving comfort and safety.",
      category: "safety",
      pointCategory: "engagement",
    },
  ],
};

const TIER_BADGES: Record<AgeBand, Badge> = {
  "50-59": {
    id: "life-stage-50s-champion",
    name: "Heart-Smart Fifties",
    description: "Completed every Life Stage challenge in the 50s tier.",
    icon: "heart-pulse",
    category: "milestone",
    rarity: "uncommon",
    criteria: "Complete all 50-59 Life Stage challenges",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  "60-69": {
    id: "life-stage-60s-champion",
    name: "Screening Streak Sixties",
    description: "Completed every Life Stage challenge in the 60s tier.",
    icon: "calendar-check",
    category: "milestone",
    rarity: "uncommon",
    criteria: "Complete all 60-69 Life Stage challenges",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  "70-plus": {
    id: "life-stage-70plus-champion",
    name: "Safety-First Seventies+",
    description: "Completed every Life Stage challenge in the 70+ tier.",
    icon: "shield-check",
    category: "milestone",
    rarity: "rare",
    criteria: "Complete all 70+ Life Stage challenges",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
};

interface CompletionRecord {
  id: string;
  patientId: string;
  challengeId: string;
  ageBand: AgeBand;
  points: number;
  completedAt: string;
}

// In-memory, consistent with the rest of the gamification module pending a
// shared persistence layer (see gamification-routes.ts).
const completions: CompletionRecord[] = [];
const tierBadgesAwarded = new Set<string>(); // `${patientId}:${ageBand}`

function getPatientId(req: Request): string | undefined {
  const user = req.user as any;
  return user?.claims?.sub || user?.id;
}

export function ageBandFromDob(dateOfBirth: string | null | undefined): AgeBand | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;

  if (age >= 70) return "70-plus";
  if (age >= 60) return "60-69";
  if (age >= 50) return "50-59";
  return null;
}

function isValidAgeBand(value: unknown): value is AgeBand {
  return value === "50-59" || value === "60-69" || value === "70-plus";
}

async function resolveAgeBand(req: Request, patientId: string): Promise<{ ageBand: AgeBand | null; age: number | null }> {
  const override = req.query.ageBand;
  if (isValidAgeBand(override)) {
    return { ageBand: override, age: null };
  }

  const profile = await storage.getActiveProfile(patientId).catch(() => null);
  const dob = profile?.dateOfBirth ?? null;
  const ageBand = ageBandFromDob(dob);
  const age = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : null;
  return { ageBand, age };
}

function buildResponse(patientId: string, ageBand: AgeBand) {
  const mine = completions.filter((c) => c.patientId === patientId && c.ageBand === ageBand);
  const completedIds = new Set(mine.map((c) => c.challengeId));
  const catalog = CHALLENGE_CATALOG[ageBand];

  const challenges = catalog.map((c) => ({
    ...c,
    completed: completedIds.has(c.id),
    completedAt: mine.find((m) => m.challengeId === c.id)?.completedAt ?? null,
  }));

  const totalPoints = mine.reduce((sum, c) => sum + c.points, 0);
  const allComplete = catalog.every((c) => completedIds.has(c.id));

  return {
    ageBand,
    tierBadge: TIER_BADGES[ageBand],
    tierBadgeEarned: tierBadgesAwarded.has(`${patientId}:${ageBand}`),
    totalPoints,
    completedCount: mine.length,
    totalCount: catalog.length,
    allComplete,
    challenges,
  };
}

// ---------------------------------------------------------------------------

router.get("/challenges", async (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  if (!patientId) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }

  const { ageBand, age } = await resolveAgeBand(req, patientId);
  if (!ageBand) {
    res.json({ ageBand: null, age, message: "Life Stage challenges are available starting at age 50." });
    return;
  }

  res.json({ age, ...buildResponse(patientId, ageBand) });
});

router.post("/challenges/:challengeId/complete", async (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  if (!patientId) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }

  const { ageBand } = await resolveAgeBand(req, patientId);
  if (!ageBand) {
    res.status(400).json({ error: "No Life Stage tier applies to this profile" });
    return;
  }

  const { challengeId } = req.params;
  const challenge = CHALLENGE_CATALOG[ageBand].find((c) => c.id === challengeId);
  if (!challenge) {
    res.status(404).json({ error: "Unknown challenge id for this tier" });
    return;
  }

  const alreadyDone = completions.some(
    (c) => c.patientId === patientId && c.ageBand === ageBand && c.challengeId === challengeId
  );
  if (alreadyDone) {
    res.json({ completed: false, reason: "already_completed", ...buildResponse(patientId, ageBand) });
    return;
  }

  const points = calculatePoints(challenge.pointCategory);
  completions.push({
    id: randomUUID(),
    patientId,
    challengeId,
    ageBand,
    points,
    completedAt: new Date().toISOString(),
  });

  const tierKey = `${patientId}:${ageBand}`;
  const result = buildResponse(patientId, ageBand);
  if (result.allComplete && !tierBadgesAwarded.has(tierKey)) {
    tierBadgesAwarded.add(tierKey);
  }

  res.json({ completed: true, points, ...buildResponse(patientId, ageBand) });
});

export default router;

export function registerLifeStageChallengesRoutes(app: import("express").Express) {
  app.use("/api/life-stage", router);
  console.log("[Routes] Life Stage Health Challenges routes registered at /api/life-stage/*");
}
