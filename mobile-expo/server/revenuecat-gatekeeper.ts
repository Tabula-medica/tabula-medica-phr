import type { Request, Response, NextFunction } from "express";
import { checkFeatureAccess, getUserSubscription, type SubscriptionTier } from "./subscription-service";
import { logger } from "./utils/logger";

export interface GatedResponse<T = any> {
  gated: boolean;
  tier: SubscriptionTier;
  requiredTier?: SubscriptionTier;
  upgradeMessage?: string;
  showPaywall?: boolean;
  preview?: Partial<T>;
  data?: T;
}

function getUserId(req: Request): string {
  return (req as any)._authenticatedUserId || "";
}

export function requireFeature(feature: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const access = checkFeatureAccess(userId, feature);
    (req as any)._featureAccess = access;

    if (!access.allowed) {
      logger.info(
        `[Gatekeeper] Feature "${feature}" blocked for user ${userId} (tier: ${access.currentTier}, requires: ${access.requiredTier})`
      );
      return res.status(403).json({
        gated: true,
        tier: access.currentTier,
        requiredTier: access.requiredTier,
        upgradeMessage: access.upgradeMessage,
        showPaywall: true,
      } satisfies GatedResponse);
    }

    next();
  };
}

export function maskSummary(fullSummary: {
  summary: string;
  sections: Record<string, string>;
  resourceCounts: Record<string, number>;
  duplicatesRemoved: number;
  provider: string;
  disclaimer: string;
  generatedAt: string;
}): GatedResponse {
  const words = fullSummary.summary.split(" ");
  const previewLength = Math.min(words.length, 40);
  const truncated = words.slice(0, previewLength).join(" ") + (words.length > previewLength ? " ..." : "");

  const maskedSections: Record<string, string> = {};
  for (const [key, value] of Object.entries(fullSummary.sections)) {
    const sectionWords = value.split(" ");
    const sLen = Math.min(sectionWords.length, 12);
    maskedSections[key] = sectionWords.slice(0, sLen).join(" ") + (sectionWords.length > sLen ? " ..." : "");
  }

  return {
    gated: true,
    tier: "basic",
    requiredTier: "professional",
    upgradeMessage: "Upgrade to Professional for full AI-powered health summaries with deduplication.",
    showPaywall: true,
    preview: {
      summary: truncated,
      sections: maskedSections,
      resourceCounts: fullSummary.resourceCounts,
      duplicatesRemoved: fullSummary.duplicatesRemoved,
      disclaimer: fullSummary.disclaimer,
      generatedAt: fullSummary.generatedAt,
    },
  } as GatedResponse & { showPaywall: boolean };
}

export function gatedSuccess<T>(data: T, userId: string): GatedResponse<T> {
  const sub = getUserSubscription(userId);
  return {
    gated: false,
    tier: sub.tier,
    data,
  };
}
