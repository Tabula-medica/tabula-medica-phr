import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  getTierDefinitions,
  getUserSubscription,
  checkFeatureAccess,
  updateUserSubscription,
  startTrial,
  getComparison,
  type SubscriptionTier,
  type BillingCycle,
} from "./subscription-service";

function getUserId(req: Request): string {
  return (req as any)._authenticatedUserId || "";
}

export function registerSubscriptionRoutes(
  app: Express,
  requireAuth: (req: Request, res: Response, next: () => void) => void
) {
  app.get("/api/subscription/tiers", requireAuth, (_req: Request, res: Response) => {
    res.json({ tiers: getTierDefinitions(), comparison: getComparison() });
  });

  app.get("/api/subscription/current", requireAuth, (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const subscription = getUserSubscription(userId);
    res.json({ subscription });
  });

  app.post("/api/subscription/check-feature", requireAuth, (req: Request, res: Response) => {
    const schema = z.object({ feature: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request" });
    }
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const result = checkFeatureAccess(userId, parsed.data.feature);
    res.json(result);
  });

  app.post("/api/subscription/start-trial", requireAuth, (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const existing = getUserSubscription(userId);
    if (existing.tier !== "basic") {
      return res.status(400).json({ error: "Trial only available for Basic tier users" });
    }
    if (existing.status === "trial" || existing.trialEndDate) {
      return res.status(400).json({ error: "Trial already used" });
    }

    const subscription = startTrial(userId);
    res.json({ subscription, message: "14-day Professional trial activated" });
  });

  app.post("/api/subscription/update", requireAuth, (req: Request, res: Response) => {
    const schema = z.object({
      tier: z.enum(["basic", "professional"]),
      billingCycle: z.enum(["monthly", "annual"]),
      revenueCatCustomerId: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
    }
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const subscription = updateUserSubscription(
      userId,
      parsed.data.tier as SubscriptionTier,
      parsed.data.billingCycle as BillingCycle,
      parsed.data.revenueCatCustomerId
    );
    res.json({ subscription });
  });
}
