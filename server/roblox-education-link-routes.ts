import { Router, Request, Response, NextFunction } from "express";
import { randomBytes, randomUUID } from "crypto";
import { calculatePoints } from "./gamification-engine";
import { Badge, PointCategory } from "@shared/schema";

/**
 * Bridges the Tabula Medica gamification system to the "World Clinic"
 * Roblox experience. Roblox is a public, unauthenticated-by-us, COPPA-governed
 * platform, so this module is deliberately a one-way, PHI-free reward relay:
 *
 *  - No health record, diagnosis, medication, or PHI of any kind is ever sent
 *    to or accepted from Roblox. The only things that cross the boundary are
 *    a short-lived link code, a Roblox user id, and a catalog badge id.
 *  - Linking is opt-in and initiated from inside the authenticated Tabula
 *    Medica app (the family generates the code, not Roblox).
 *  - The Roblox game server (not individual players) authenticates with a
 *    shared secret (ROBLOX_SERVER_API_KEY) via Roblox's HttpService.
 */

const router = Router();

const ROBLOX_API_KEY = process.env.ROBLOX_SERVER_API_KEY;
const CODE_TTL_MS = 10 * 60 * 1000;

// Kid-safe, PHI-free badge catalog. Deliberately separate from the clinical
// AVAILABLE_BADGES catalogs in gamification-engine.ts / gamification-routes.ts
// so nothing here ever implies a real diagnosis, medication, or health status.
const ROBLOX_BADGES: Badge[] = [
  {
    id: "roblox-handwash-hero",
    name: "Handwashing Hero",
    description: "Full 20-second scrub, no shortcuts. Germs: 0. You: 1.",
    icon: "sparkles",
    category: "achievement",
    rarity: "common",
    criteria: "Finish the Handwashing Hero mini-game",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "roblox-body-explorer",
    name: "Body Systems Explorer",
    description: "Toured the heart, lung, and gut stations like a pro — full map cleared.",
    icon: "compass",
    category: "achievement",
    rarity: "common",
    criteria: "Finish the Body Systems Quest mini-game",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "roblox-med-match-bronze",
    name: "Medication Match: Bronze",
    description: "10-match streak — bottles to charts, zero mix-ups.",
    icon: "pill",
    category: "achievement",
    rarity: "common",
    criteria: "Reach 10 correct matches in Medication Match",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "roblox-med-match-gold",
    name: "Medication Match: Gold",
    description: "50-match streak. You could run the pharmacy at this point.",
    icon: "pill",
    category: "achievement",
    rarity: "uncommon",
    criteria: "Reach 50 correct matches in Medication Match",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "roblox-germ-buster",
    name: "Germ Buster",
    description: "Cleared every germ zone before the clock hit zero.",
    icon: "shield",
    category: "achievement",
    rarity: "common",
    criteria: "Clear a full Germ Buster round",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
  // Awarded automatically by roblox-clinic-routes.ts once the Future Health
  // scorecard reaches 4+ stars over 10+ visits — no direct client sync call.
  {
    id: "roblox-checkup-champion",
    name: "Checkup Champion",
    description: "Ran a Future Health clinic to 4+ stars over 10+ visits. Legendary run.",
    icon: "stethoscope",
    category: "milestone",
    rarity: "uncommon",
    criteria: "Reach 4+ stars over 10+ visits in Future Health",
    isSecret: false,
    createdAt: new Date().toISOString(),
  },
];

function getRobloxBadgeById(id: string): Badge | undefined {
  return ROBLOX_BADGES.find((b) => b.id === id);
}

interface LinkCode {
  code: string;
  patientId: string;
  expiresAt: number;
}

interface RobloxLink {
  robloxUserId: string;
  patientId: string;
  linkedAt: string;
}

interface RobloxReward {
  id: string;
  patientId: string;
  robloxUserId: string;
  badgeId: string;
  gameId: string;
  points: number;
  awardedAt: string;
}

// In-memory stores, consistent with the rest of the gamification module
// (gamification-routes.ts) pending a shared persistence layer.
const linkCodes = new Map<string, LinkCode>();
const robloxLinks = new Map<string, RobloxLink>(); // keyed by robloxUserId
const robloxRewards: RobloxReward[] = [];

function generateCode(): string {
  return randomBytes(4).toString("hex").toUpperCase(); // e.g. "8F3C1A9B"
}

export function getLinkedPatientId(robloxUserId: string): string | undefined {
  return robloxLinks.get(robloxUserId)?.patientId;
}

export type AwardResult =
  | { awarded: true; points: number; badge: Badge }
  | { awarded: false; reason: "not_linked" | "unknown_badge" | "already_awarded" };

export function awardRobloxBadge(
  robloxUserId: string,
  badgeId: string,
  gameId: string,
  pointCategory?: string
): AwardResult {
  const patientId = getLinkedPatientId(robloxUserId);
  if (!patientId) return { awarded: false, reason: "not_linked" };

  const badge = getRobloxBadgeById(badgeId);
  if (!badge) return { awarded: false, reason: "unknown_badge" };

  if (robloxRewards.some((r) => r.patientId === patientId && r.badgeId === badge.id)) {
    return { awarded: false, reason: "already_awarded" };
  }

  const category: PointCategory = (pointCategory as PointCategory) || "engagement";
  const points = calculatePoints(category);
  robloxRewards.push({
    id: randomUUID(),
    patientId,
    robloxUserId,
    badgeId: badge.id,
    gameId,
    points,
    awardedAt: new Date().toISOString(),
  });
  return { awarded: true, points, badge };
}

function getPatientId(req: Request): string | undefined {
  const user = req.user as any;
  return user?.claims?.sub || user?.id;
}

function requireRobloxApiKey(req: Request, res: Response, next: NextFunction) {
  if (!ROBLOX_API_KEY) {
    res.status(503).json({ error: "Roblox integration is not configured on this server" });
    return;
  }
  if (req.header("X-Roblox-Api-Key") !== ROBLOX_API_KEY) {
    res.status(401).json({ error: "Invalid Roblox server API key" });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Authenticated app-side endpoints (the family's Tabula Medica session)
// ---------------------------------------------------------------------------

router.post("/link/code", (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  if (!patientId) {
    res.status(401).json({ error: "Sign in required to link a Roblox account" });
    return;
  }

  for (const [code, entry] of Array.from(linkCodes.entries())) {
    if (entry.patientId === patientId) linkCodes.delete(code);
  }

  const code = generateCode();
  const expiresAt = Date.now() + CODE_TTL_MS;
  linkCodes.set(code, { code, patientId, expiresAt });

  res.json({
    code,
    expiresAt: new Date(expiresAt).toISOString(),
    ttlSeconds: CODE_TTL_MS / 1000,
  });
});

router.get("/link/status", (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  if (!patientId) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  const link = Array.from(robloxLinks.values()).find((l) => l.patientId === patientId);
  res.json({ linked: !!link, linkedAt: link?.linkedAt ?? null });
});

router.post("/link/unlink", (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  if (!patientId) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  for (const [robloxUserId, link] of Array.from(robloxLinks.entries())) {
    if (link.patientId === patientId) robloxLinks.delete(robloxUserId);
  }
  res.json({ unlinked: true });
});

router.get("/rewards/me", (req: Request, res: Response) => {
  const patientId = getPatientId(req);
  if (!patientId) {
    res.status(401).json({ error: "Sign in required" });
    return;
  }
  const mine = robloxRewards.filter((r) => r.patientId === patientId);
  const totalPoints = mine.reduce((sum, r) => sum + r.points, 0);
  res.json({
    totalPoints,
    badgeCount: mine.length,
    rewards: mine
      .slice()
      .reverse()
      .map((r) => ({ ...r, badge: getRobloxBadgeById(r.badgeId) })),
  });
});

// ---------------------------------------------------------------------------
// Roblox game-server endpoints (shared-secret auth, never a player's own auth)
// ---------------------------------------------------------------------------

router.get("/catalog", requireRobloxApiKey, (_req: Request, res: Response) => {
  res.json({ badges: ROBLOX_BADGES });
});

router.post("/link/redeem", requireRobloxApiKey, (req: Request, res: Response) => {
  const { code, robloxUserId } = req.body ?? {};
  if (!code || !robloxUserId) {
    res.status(400).json({ error: "code and robloxUserId are required" });
    return;
  }

  const entry = linkCodes.get(String(code).toUpperCase());
  if (!entry || entry.expiresAt < Date.now()) {
    res.status(410).json({ error: "Code is invalid or expired" });
    return;
  }

  linkCodes.delete(entry.code);
  robloxLinks.set(String(robloxUserId), {
    robloxUserId: String(robloxUserId),
    patientId: entry.patientId,
    linkedAt: new Date().toISOString(),
  });

  res.json({ linked: true });
});

router.post("/rewards/sync", requireRobloxApiKey, (req: Request, res: Response) => {
  const { robloxUserId, badgeId, gameId, pointCategory } = req.body ?? {};
  if (!robloxUserId || !badgeId) {
    res.status(400).json({ error: "robloxUserId and badgeId are required" });
    return;
  }

  const result = awardRobloxBadge(
    String(robloxUserId),
    String(badgeId),
    gameId ? String(gameId) : "unknown",
    pointCategory
  );

  if (result.awarded === false && result.reason === "not_linked") {
    res.status(404).json({ error: "This Roblox account is not linked to a Tabula Medica profile" });
    return;
  }
  if (result.awarded === false && result.reason === "unknown_badge") {
    res.status(404).json({ error: "Unknown badge id" });
    return;
  }

  res.json(result);
});

export { requireRobloxApiKey, getPatientId };
export default router;

export function registerRobloxEducationRoutes(app: import("express").Express) {
  app.use("/api/roblox", router);
  console.log("[Routes] Roblox Education Games routes registered at /api/roblox/*");
}
