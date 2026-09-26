/**
 * tabulamedica.us consumer subscription — $9.99/year HARD PAYWALL (US edition ONLY).
 *
 * This is the consumer B2C paywall for the `.us` edition. It is deliberately
 * separate from the B2B monetization surface (accounts/subscriptions, org/PMPM)
 * in shared/schema.ts + billing-routes.ts. State lives on the auth `users` row
 * (shared/models/auth.ts): stripeCustomerId / stripeSubscriptionId /
 * subscriptionStatus / subscriptionCurrentPeriodEnd / subscriptionUpdatedAt.
 *
 * SAFETY — FAIL OPEN: if Stripe env is absent/misconfigured, PAYWALL_CONFIGURED
 * is false and the status endpoint reports { configured:false, active:true } so
 * the client never gates. A paywall must never lock users out before keys exist.
 *
 * PHI: never place PHI in Stripe. Metadata carries only userId + email.
 *
 * Mounted at /api/billing/us (see server/routes.ts). The Stripe webhook itself
 * is the EXISTING handler in billing-routes.ts (/api/billing/webhook/stripe);
 * that handler calls the exported applyStripeSubscriptionEvent() below.
 */
import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { isAuthenticated } from "./replit_integrations/auth";

const router = Router();

interface AuthRequest extends Request {
  user?: {
    claims: {
      sub: string;
      email?: string;
    };
  };
}

// Paywall is only "configured" (and therefore enforceable) when BOTH the
// secret key and the annual price id are present. Missing either => fail open.
export const PAYWALL_CONFIGURED = !!(
  process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID_US_ANNUAL
);

// Lazy Stripe client. The `stripe` package may not be installed yet; import via
// a non-literal specifier so tsc does not require the module to be resolvable at
// build time, and cache the instance. Returns null if unconfigured/unavailable.
let stripeClientPromise: Promise<any> | null = null;
async function getStripe(): Promise<any> {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeClientPromise) {
    stripeClientPromise = (async () => {
      const moduleName = "stripe";
      const mod: any = await import(moduleName);
      const Stripe = mod.default || mod;
      return new Stripe(process.env.STRIPE_SECRET_KEY as string, {
        apiVersion: undefined, // use account default; avoids version pinning drift
        appInfo: { name: "tabula-medica-phr-us-paywall" },
      });
    })();
  }
  return stripeClientPromise;
}

function isActive(status: string | null | undefined, periodEnd: Date | null | undefined): boolean {
  if (status !== "active") return false;
  if (!periodEnd) return true; // no explicit end => treat as active
  return periodEnd.getTime() > Date.now();
}

/**
 * GET /api/billing/us/status  (authenticated)
 * Returns whether the paywall is configured and whether this user is active.
 * When not configured, returns { configured:false, active:true } so the client
 * never gates (FAIL OPEN).
 */
router.get("/status", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    if (!PAYWALL_CONFIGURED) {
      return res.json({ configured: false, active: true });
    }

    const userId = req.user?.claims?.sub;
    if (!userId) {
      // Should not happen behind isAuthenticated, but fail open rather than lock out.
      return res.json({ configured: true, active: true, status: "unknown", currentPeriodEnd: null });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.json({ configured: true, active: true, status: "unknown", currentPeriodEnd: null });
    }

    const active = isActive(user.subscriptionStatus, user.subscriptionCurrentPeriodEnd);
    return res.json({
      configured: true,
      active,
      status: user.subscriptionStatus ?? "inactive",
      currentPeriodEnd: user.subscriptionCurrentPeriodEnd
        ? user.subscriptionCurrentPeriodEnd.toISOString()
        : null,
    });
  } catch (error) {
    console.error("[US Paywall] status error:", error);
    // FAIL OPEN on any error.
    return res.json({ configured: false, active: true });
  }
});

/**
 * POST /api/billing/us/checkout  (authenticated)
 * Creates (or reuses) a Stripe customer for this user and starts a Checkout
 * Session for the $9.99/yr annual subscription. Returns { url }.
 */
router.post("/checkout", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    if (!PAYWALL_CONFIGURED) {
      return res.status(503).json({ error: "billing_not_configured" });
    }

    const userId = req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "unauthenticated" });
    }

    const stripe = await getStripe();
    if (!stripe) {
      return res.status(503).json({ error: "billing_not_configured" });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return res.status(404).json({ error: "user_not_found" });
    }

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { userId }, // NEVER put PHI here — only userId/email.
      });
      customerId = customer.id;
      await db
        .update(users)
        .set({ stripeCustomerId: customerId, subscriptionUpdatedAt: new Date() })
        .where(eq(users.id, userId));
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID_US_ANNUAL as string, quantity: 1 }],
      customer: customerId,
      client_reference_id: userId,
      allow_promotion_codes: true,
      success_url: "https://tabulamedica.us/?checkout=success",
      cancel_url: "https://tabulamedica.us/?checkout=cancel",
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error("[US Paywall] checkout error:", error);
    return res.status(500).json({ error: "checkout_failed" });
  }
});

/**
 * Maps a Stripe subscription status to our narrow status set.
 */
function mapStripeStatus(stripeStatus: string | undefined): string {
  switch (stripeStatus) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
    default:
      return "inactive";
  }
}

function unixToDate(seconds: number | null | undefined): Date | null {
  if (!seconds || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000);
}

/**
 * applyStripeSubscriptionEvent — called by the EXISTING Stripe webhook handler
 * in billing-routes.ts for:
 *   - checkout.session.completed
 *   - customer.subscription.created | updated | deleted
 * Resolves the user (via users.stripeCustomerId, or client_reference_id on a
 * checkout session) and persists subscription status/id/period end.
 *
 * Safe to call for any event; unknown/unresolvable events are ignored.
 */
export async function applyStripeSubscriptionEvent(event: any): Promise<void> {
  try {
    const type: string = event?.type;
    const obj: any = event?.data?.object;
    if (!obj) return;

    if (type === "checkout.session.completed") {
      // On checkout completion we may only have the session; resolve the user
      // via client_reference_id (our userId) or customer, then hydrate the
      // subscription record. Detailed status will also arrive via the
      // customer.subscription.* events.
      const userId: string | undefined = obj.client_reference_id || undefined;
      const customerId: string | undefined =
        typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
      const subscriptionId: string | undefined =
        typeof obj.subscription === "string" ? obj.subscription : obj.subscription?.id;

      const setValues: Record<string, unknown> = {
        subscriptionStatus: "active",
        subscriptionUpdatedAt: new Date(),
      };
      if (customerId) setValues.stripeCustomerId = customerId;
      if (subscriptionId) setValues.stripeSubscriptionId = subscriptionId;

      if (userId) {
        await db.update(users).set(setValues).where(eq(users.id, userId));
      } else if (customerId) {
        await db.update(users).set(setValues).where(eq(users.stripeCustomerId, customerId));
      }
      return;
    }

    if (
      type === "customer.subscription.created" ||
      type === "customer.subscription.updated" ||
      type === "customer.subscription.deleted"
    ) {
      const customerId: string | undefined =
        typeof obj.customer === "string" ? obj.customer : obj.customer?.id;
      if (!customerId) return;

      const status =
        type === "customer.subscription.deleted" ? "canceled" : mapStripeStatus(obj.status);
      const periodEnd = unixToDate(obj.current_period_end);

      await db
        .update(users)
        .set({
          subscriptionStatus: status,
          stripeSubscriptionId: obj.id ?? null,
          subscriptionCurrentPeriodEnd: periodEnd,
          subscriptionUpdatedAt: new Date(),
        })
        .where(eq(users.stripeCustomerId, customerId));
      return;
    }
  } catch (error) {
    console.error("[US Paywall] applyStripeSubscriptionEvent error:", error);
    // Do not throw — webhook must still 200 so Stripe does not retry-storm.
  }
}

export default router;
