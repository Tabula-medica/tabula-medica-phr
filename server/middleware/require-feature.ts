import type { Request, Response, NextFunction } from "express";
import type { SubscriptionTier } from "@shared/schema";
import {
  accounts,
  subscriptionsTable,
  subscriptionPlansTable,
  organizationMembersTable,
} from "@shared/schema";
import { users } from "@shared/models/auth";
import { db } from "../db";
import { and, eq, inArray } from "drizzle-orm";
import {
  FEATURE_GATES,
  tierIncludesFeature,
} from "../services/feature-gates";

interface AuthRequest extends Request {
  user?: {
    claims?: {
      sub: string;
      email?: string;
    };
  };
  subscriptionTier?: SubscriptionTier;
}

const VALID_TIERS: ReadonlySet<SubscriptionTier> = new Set([
  "free",
  "pro",
  "concierge",
  "enterprise",
]);

const PAYING_STATUSES: ReadonlyArray<"active" | "trialing"> = ["active", "trialing"];

function coerceTier(value: unknown): SubscriptionTier | null {
  if (typeof value === "string" && VALID_TIERS.has(value as SubscriptionTier)) {
    return value as SubscriptionTier;
  }
  return null;
}

/**
 * Look up the user's effective tier in the database.
 *
 * Architecture:
 *   req.user.claims.sub  -> users.id (varchar)
 *   users.email          -> accounts.email (bridge — both unique)
 *   accounts.id          -> subscriptionsTable.accountId
 *   subscriptions.planId -> subscriptionPlansTable.tier
 *
 * Returns "free" on any miss or error so a paying user is never silently
 * upgraded but a lookup failure never blocks an otherwise-valid request.
 */
async function lookupTierFromDb(authSub: string, claimsEmail?: string): Promise<SubscriptionTier> {
  try {
    let email: string | null = claimsEmail?.toLowerCase() ?? null;

    if (!email) {
      const [userRow] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, authSub))
        .limit(1);
      email = userRow?.email?.toLowerCase() ?? null;
    }

    if (!email) return "free";

    const [accountRow] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.email, email))
      .limit(1);

    if (!accountRow) return "free";

    // Run the per-account and org-inherited lookups in parallel.
    // - Account-direct: any sub where subscriptions.accountId = this account
    // - Org-inherited:  any sub where subscriptions.organizationId = an org this account is a member of
    // We pick the highest tier across all hits (enterprise > concierge > pro > free).
    const [accountSubs, orgSubs] = await Promise.all([
      db
        .select({ tier: subscriptionPlansTable.tier })
        .from(subscriptionsTable)
        .innerJoin(
          subscriptionPlansTable,
          eq(subscriptionsTable.planId, subscriptionPlansTable.id),
        )
        .where(
          and(
            eq(subscriptionsTable.accountId, accountRow.id),
            inArray(subscriptionsTable.status, PAYING_STATUSES as unknown as string[]),
          ),
        ),
      db
        .select({ tier: subscriptionPlansTable.tier })
        .from(organizationMembersTable)
        .innerJoin(
          subscriptionsTable,
          eq(subscriptionsTable.organizationId, organizationMembersTable.organizationId),
        )
        .innerJoin(
          subscriptionPlansTable,
          eq(subscriptionsTable.planId, subscriptionPlansTable.id),
        )
        .where(
          and(
            eq(organizationMembersTable.accountId, accountRow.id),
            inArray(subscriptionsTable.status, PAYING_STATUSES as unknown as string[]),
          ),
        ),
    ]);

    const rank: Record<SubscriptionTier, number> = {
      free: 0,
      pro: 1,
      concierge: 2,
      enterprise: 3,
    };
    let best: SubscriptionTier = "free";
    for (const row of [...accountSubs, ...orgSubs]) {
      const t = coerceTier(row.tier);
      if (t && rank[t] > rank[best]) best = t;
    }
    return best;
  } catch (err) {
    console.error("[resolveUserTier] DB lookup failed; defaulting to free:", err);
    return "free";
  }
}

/**
 * Resolve the current user's subscription tier.
 *
 * Resolution order:
 *   1. req.subscriptionTier (per-request memo set by an upstream middleware)
 *   2. Custom JWT claim "https://tabula-medica.com/tier" (fast path; no DB hit)
 *   3. DB chain: users.id -> users.email -> accounts.id -> active subscription -> plan.tier
 *   4. "free" fallback
 *
 * Result is memoized on the request to avoid duplicate lookups within a single request lifecycle.
 */
export async function resolveUserTier(req: AuthRequest): Promise<SubscriptionTier> {
  if (req.subscriptionTier) return req.subscriptionTier;

  const claimsRecord = req.user?.claims as Record<string, unknown> | undefined;
  const claimsTier = coerceTier(claimsRecord?.["https://tabula-medica.com/tier"]);
  if (claimsTier) {
    req.subscriptionTier = claimsTier;
    return claimsTier;
  }

  const authSub = req.user?.claims?.sub;
  if (!authSub) {
    req.subscriptionTier = "free";
    return "free";
  }

  const tier = await lookupTierFromDb(authSub, req.user?.claims?.email);
  req.subscriptionTier = tier;
  return tier;
}

/**
 * Express middleware that gates a route on a specific feature key.
 * On denial, returns 403 with the FEATURE_GATED envelope expected
 * by the client-side global feature-gate listener.
 */
export function requireFeature(featureKey: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const gate = FEATURE_GATES[featureKey];
    if (!gate) {
      return res.status(500).json({
        success: false,
        error: `Unknown feature key: ${featureKey}`,
      });
    }

    const tier = await resolveUserTier(req);

    if (!tierIncludesFeature(tier, featureKey)) {
      return res.status(403).json({
        success: false,
        code: "FEATURE_GATED",
        feature: featureKey,
        currentTier: tier,
        requiredTier: gate.requiredTier,
        upgradeMessage: gate.upgradeMessage,
      });
    }

    return next();
  };
}
