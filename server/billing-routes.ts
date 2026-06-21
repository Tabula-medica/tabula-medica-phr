import { Router, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { monetizationService } from "./services/monetization-service";
import {
  insertOrganizationSchema,
  insertSubscriptionSchema,
  insertOrganizationMemberSchema,
  insertAuditExportRequestSchema,
} from "@shared/schema";
import { isAuthenticated } from "./replit_integrations/auth";
import {
  FEATURE_GATES,
  tierIncludesFeature,
} from "./services/feature-gates";
import { resolveUserTier } from "./middleware/require-feature";

const router = Router();

interface AuthRequest extends Request {
  user?: {
    claims: {
      sub: string;
      email?: string;
    };
  };
}

router.get("/entitlements", async (_req: Request, res: Response) => {
  try {
    const entitlements = monetizationService.getEntitlements(null);
    res.json({ success: true, ...entitlements });
  } catch (error) {
    console.error("Error fetching entitlements:", error);
    res.status(500).json({ success: false, error: "Failed to fetch entitlements" });
  }
});

router.get("/fhir-source-limit", async (_req: Request, res: Response) => {
  try {
    const check = monetizationService.checkFhirSourceLimit(null, 0);
    res.json({ success: true, ...check });
  } catch (error) {
    console.error("Error checking FHIR source limit:", error);
    res.status(500).json({ success: false, error: "Failed to check limit" });
  }
});

router.get("/plans", async (_req: Request, res: Response) => {
  try {
    const plans = monetizationService.getPlans();
    res.json({
      success: true,
      plans: plans.map((plan) => ({
        ...plan,
        priceMonthlyFormatted: monetizationService.formatPrice(plan.priceMonthly),
        priceAnnualFormatted: plan.priceAnnual
          ? monetizationService.formatPrice(plan.priceAnnual)
          : null,
        pricePerProviderFormatted: plan.pricePerProvider
          ? monetizationService.formatPrice(plan.pricePerProvider)
          : null,
        pricePmpmFormatted: plan.pricePmpm
          ? monetizationService.formatPrice(plan.pricePmpm)
          : null,
      })),
    });
  } catch (error) {
    console.error("Error fetching plans:", error);
    res.status(500).json({ success: false, error: "Failed to fetch plans" });
  }
});

router.get("/plans/:planId", async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const plan = monetizationService.getPlanById(planId);

    if (!plan) {
      return res.status(404).json({ success: false, error: "Plan not found" });
    }

    res.json({
      success: true,
      plan: {
        ...plan,
        priceMonthlyFormatted: monetizationService.formatPrice(plan.priceMonthly),
        priceAnnualFormatted: plan.priceAnnual
          ? monetizationService.formatPrice(plan.priceAnnual)
          : null,
      },
    });
  } catch (error) {
    console.error("Error fetching plan:", error);
    res.status(500).json({ success: false, error: "Failed to fetch plan" });
  }
});

router.get("/addons", async (_req: Request, res: Response) => {
  try {
    const addons = monetizationService.getEnterpriseAddons();
    res.json({
      success: true,
      addons: addons.map((addon) => ({
        ...addon,
        priceMonthlyFormatted: monetizationService.formatPrice(addon.priceMonthly),
      })),
    });
  } catch (error) {
    console.error("Error fetching addons:", error);
    res.status(500).json({ success: false, error: "Failed to fetch addons" });
  }
});

router.get("/outcome-metrics", async (_req: Request, res: Response) => {
  try {
    const metrics = monetizationService.getOutcomeMetrics();
    res.json({ success: true, metrics });
  } catch (error) {
    console.error("Error fetching outcome metrics:", error);
    res.status(500).json({ success: false, error: "Failed to fetch metrics" });
  }
});

router.post("/calculate-price", async (req: Request, res: Response) => {
  try {
    const { planId, billingCycle, providerCount, memberCount } = req.body;

    if (!planId) {
      return res.status(400).json({ success: false, error: "planId is required" });
    }

    const plan = monetizationService.getPlanById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, error: "Plan not found" });
    }

    const monthlyPrice = monetizationService.calculateMonthlyPrice(
      planId,
      billingCycle || "monthly",
      providerCount,
      memberCount
    );

    const annualPrice = billingCycle === "annual" ? monthlyPrice * 12 : undefined;
    const annualSavings =
      billingCycle === "annual" && plan.priceAnnual
        ? plan.priceMonthly * 12 - plan.priceAnnual
        : undefined;

    res.json({
      success: true,
      pricing: {
        monthlyPrice,
        monthlyPriceFormatted: monetizationService.formatPrice(monthlyPrice),
        annualPrice,
        annualPriceFormatted: annualPrice
          ? monetizationService.formatPrice(annualPrice)
          : undefined,
        annualSavings,
        annualSavingsFormatted: annualSavings
          ? monetizationService.formatPrice(annualSavings)
          : undefined,
        billingCycle: billingCycle || "monthly",
      },
    });
  } catch (error) {
    console.error("Error calculating price:", error);
    res.status(500).json({ success: false, error: "Failed to calculate price" });
  }
});

router.get("/subscription/:accountId", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.params;
    const userId = req.user?.claims?.sub;

    if (userId !== accountId) {
      return res.status(403).json({
        success: false,
        error: "You can only view your own subscription",
      });
    }

    monetizationService.hipaaAuditLog("subscription_view", { accountId, viewedBy: userId }, accountId);

    const summary = monetizationService.getSubscriptionSummary(null);

    res.json({
      success: true,
      subscription: summary,
    });
  } catch (error) {
    console.error("Error fetching subscription:", error);
    res.status(500).json({ success: false, error: "Failed to fetch subscription" });
  }
});

router.post("/subscription", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.claims?.sub;
    const parsed = insertSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid subscription data",
        details: parsed.error.errors,
      });
    }

    const { planId, billingCycle, organizationId, providerCount, memberCount } =
      parsed.data;

    const accountId = userId;

    const plan = monetizationService.getPlanById(planId);
    if (!plan) {
      return res.status(404).json({ success: false, error: "Plan not found" });
    }

    if (plan.pricePerProvider && (!providerCount || providerCount < 1)) {
      return res.status(400).json({
        success: false,
        error: "Provider count is required for per-provider pricing plans",
      });
    }

    if (plan.pricePmpm && (!memberCount || memberCount < 1)) {
      return res.status(400).json({
        success: false,
        error: "Member count is required for PMPM pricing plans",
      });
    }

    const now = new Date();
    const trialEnd = plan.trialDays > 0
      ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000)
      : null;
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscription = {
      id: `sub_${Date.now()}`,
      accountId,
      organizationId,
      planId,
      status: trialEnd ? "trialing" : "active",
      billingCycle: billingCycle || "monthly",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialStart: trialEnd ? now : null,
      trialEnd,
      providerCount,
      memberCount,
      createdAt: now,
    };

    monetizationService.hipaaAuditLog(
      "subscription_created",
      { subscriptionId: subscription.id, planId, billingCycle, createdBy: userId },
      accountId
    );

    res.status(201).json({
      success: true,
      subscription,
      message: trialEnd
        ? `Your ${plan.trialDays}-day trial has started`
        : "Subscription activated successfully",
    });
  } catch (error) {
    console.error("Error creating subscription:", error);
    res.status(500).json({ success: false, error: "Failed to create subscription" });
  }
});

router.post("/subscription/:subscriptionId/cancel", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const { reason, immediate } = req.body;
    const userId = req.user?.claims?.sub;

    monetizationService.hipaaAuditLog("subscription_cancelled", {
      subscriptionId,
      reason,
      immediate,
      cancelledBy: userId,
    });

    res.json({
      success: true,
      message: immediate
        ? "Subscription cancelled immediately"
        : "Subscription will be cancelled at end of billing period",
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    res.status(500).json({ success: false, error: "Failed to cancel subscription" });
  }
});

router.post("/subscription/:subscriptionId/upgrade", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { subscriptionId } = req.params;
    const { newPlanId, billingCycle } = req.body;
    const userId = req.user?.claims?.sub;

    const plan = monetizationService.getPlanById(newPlanId);
    if (!plan) {
      return res.status(404).json({ success: false, error: "Plan not found" });
    }

    monetizationService.hipaaAuditLog("subscription_upgraded", {
      subscriptionId,
      newPlanId,
      billingCycle,
      upgradedBy: userId,
    });

    res.json({
      success: true,
      message: `Upgraded to ${plan.name} successfully`,
    });
  } catch (error) {
    console.error("Error upgrading subscription:", error);
    res.status(500).json({ success: false, error: "Failed to upgrade subscription" });
  }
});

/**
 * Bulk entitlements lookup. Used by the client `useSubscription()` hook
 * to populate the global feature map in a single round-trip. Returns the
 * tier, a feature-key → boolean map for all gated features, and limits.
 */
router.get("/entitlements", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const tier = await resolveUserTier(req);
    const entitlements = monetizationService.getEntitlements(tier);
    res.json({
      success: true,
      ...entitlements,
      gates: FEATURE_GATES,
    });
  } catch (error) {
    console.error("Error fetching entitlements:", error);
    res.status(500).json({ success: false, error: "Failed to fetch entitlements" });
  }
});

router.get("/feature-access/:featureKey", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { featureKey } = req.params;
    const userId = req.user?.claims?.sub;
    const validFeatures = [
      "advancedPacketSharing",
      "carePathways",
      "iotIntegration",
      "aiAssistant",
      "telehealth",
      "prioritySupport",
      "customAuditExports",
      "apiAccess",
      "whiteLabeling",
      "sso",
      "dedicatedAccountManager",
      "intakeTools",
      "outcomeTracking",
      "populationHealth",
    ];

    // Accept both legacy PlanFeatures keys and new gated feature keys.
    if (FEATURE_GATES[featureKey]) {
      const tier = await resolveUserTier(req);
      const hasAccess = tierIncludesFeature(tier, featureKey);
      return res.json({
        success: true,
        feature: featureKey,
        hasAccess,
        upgradeRequired: !hasAccess,
        currentTier: tier,
        requiredTier: FEATURE_GATES[featureKey].requiredTier,
        upgradeMessage: FEATURE_GATES[featureKey].upgradeMessage,
      });
    }

    if (!validFeatures.includes(featureKey)) {
      return res.status(400).json({ success: false, error: "Invalid feature key" });
    }

    const hasAccess = monetizationService.checkFeatureAccess(
      null,
      featureKey as Exclude<
        keyof {
          maxProfiles: number;
          advancedPacketSharing: boolean;
          carePathways: boolean;
          iotIntegration: boolean;
          aiAssistant: boolean;
          telehealth: boolean;
          prioritySupport: boolean;
          customAuditExports: boolean;
          apiAccess: boolean;
          whiteLabeling: boolean;
          sso: boolean;
          dedicatedAccountManager: boolean;
          intakeTools: boolean;
          outcomeTracking: boolean;
          populationHealth: boolean;
        },
        "maxProfiles"
      >
    );

    res.json({
      success: true,
      feature: featureKey,
      hasAccess,
      upgradeRequired: !hasAccess,
    });
  } catch (error) {
    console.error("Error checking feature access:", error);
    res.status(500).json({ success: false, error: "Failed to check feature access" });
  }
});

router.get("/profile-limit/:accountId", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.params;
    const userId = req.user?.claims?.sub;
    const currentProfiles = parseInt(req.query.current as string) || 0;

    if (userId !== accountId) {
      return res.status(403).json({
        success: false,
        error: "You can only check your own profile limit",
      });
    }

    const result = monetizationService.checkProfileLimit(null, currentProfiles);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error checking profile limit:", error);
    res.status(500).json({ success: false, error: "Failed to check profile limit" });
  }
});

router.post("/organization", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.claims?.sub;
    const parsed = insertOrganizationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid organization data",
        details: parsed.error.errors,
      });
    }

    const organization = {
      id: `org_${Date.now()}`,
      ...parsed.data,
      createdAt: new Date(),
    };

    monetizationService.hipaaAuditLog("organization_created", {
      organizationId: organization.id,
      type: organization.type,
      createdBy: userId,
    });

    res.status(201).json({
      success: true,
      organization,
    });
  } catch (error) {
    console.error("Error creating organization:", error);
    res.status(500).json({ success: false, error: "Failed to create organization" });
  }
});

router.post("/organization/:organizationId/member", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { organizationId } = req.params;
    const userId = req.user?.claims?.sub;
    const parsed = insertOrganizationMemberSchema.safeParse({
      ...req.body,
      organizationId,
    });

    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid member data",
        details: parsed.error.errors,
      });
    }

    const member = {
      id: `member_${Date.now()}`,
      ...parsed.data,
      joinedAt: new Date(),
      createdAt: new Date(),
    };

    monetizationService.hipaaAuditLog("organization_member_added", {
      organizationId,
      memberId: member.id,
      role: member.role,
      addedBy: userId,
    });

    res.status(201).json({
      success: true,
      member,
    });
  } catch (error) {
    console.error("Error adding organization member:", error);
    res.status(500).json({ success: false, error: "Failed to add member" });
  }
});

router.post("/audit-export", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.claims?.sub;
    const parsed = insertAuditExportRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid export request",
        details: parsed.error.errors,
      });
    }

    const hasAccess = monetizationService.checkFeatureAccess(null, "customAuditExports");
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: "Custom audit exports require Enterprise plan or add-on",
        upgradeRequired: true,
      });
    }

    const exportRequest = {
      id: `export_${Date.now()}`,
      ...parsed.data,
      status: "pending",
      createdAt: new Date(),
    };

    monetizationService.hipaaAuditLog("audit_export_requested", {
      exportId: exportRequest.id,
      exportType: exportRequest.exportType,
      format: exportRequest.format,
      requestedBy: userId,
    });

    res.status(201).json({
      success: true,
      exportRequest,
      message: "Audit export request submitted. You will be notified when ready.",
    });
  } catch (error) {
    console.error("Error creating audit export:", error);
    res.status(500).json({ success: false, error: "Failed to create export request" });
  }
});

router.get("/invoices/:accountId", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { accountId } = req.params;
    const userId = req.user?.claims?.sub;

    if (userId !== accountId) {
      return res.status(403).json({
        success: false,
        error: "You can only view your own invoices",
      });
    }

    monetizationService.hipaaAuditLog("invoices_viewed", { accountId, viewedBy: userId }, accountId);

    const mockInvoices = [
      {
        id: "inv_001",
        invoiceNumber: "INV-2025-001",
        status: "paid",
        subtotal: 999,
        tax: 0,
        total: 999,
        totalFormatted: "$9.99",
        billingPeriodStart: new Date("2025-01-01"),
        billingPeriodEnd: new Date("2025-01-31"),
        paidAt: new Date("2025-01-01"),
      },
    ];

    res.json({
      success: true,
      invoices: mockInvoices,
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ success: false, error: "Failed to fetch invoices" });
  }
});

const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

function verifyStripeSignature(
  rawBody: Buffer,
  header: string,
  secret: string,
  toleranceSeconds: number = STRIPE_WEBHOOK_TOLERANCE_SECONDS,
): { ok: true } | { ok: false; reason: string } {
  if (!header || typeof header !== "string") {
    return { ok: false, reason: "missing_signature_header" };
  }

  const parts = header.split(",").map((s) => s.trim());
  let timestamp: string | null = null;
  const v1Signatures: string[] = [];
  for (const part of parts) {
    const [k, v] = part.split("=");
    if (k === "t") timestamp = v;
    else if (k === "v1" && v) v1Signatures.push(v);
  }
  if (!timestamp || v1Signatures.length === 0) {
    return { ok: false, reason: "malformed_signature_header" };
  }

  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) {
    return { ok: false, reason: "invalid_timestamp" };
  }
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - tsNum);
  if (ageSeconds > toleranceSeconds) {
    return { ok: false, reason: `timestamp_outside_tolerance:${ageSeconds}s` };
  }

  const signedPayload = `${timestamp}.${rawBody.toString("utf8")}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");

  for (const candidate of v1Signatures) {
    let candidateBuf: Buffer;
    try {
      candidateBuf = Buffer.from(candidate, "hex");
    } catch {
      continue;
    }
    if (candidateBuf.length === expectedBuf.length && timingSafeEqual(candidateBuf, expectedBuf)) {
      return { ok: true };
    }
  }
  return { ok: false, reason: "signature_mismatch" };
}

router.post("/webhook/stripe", async (req: Request, res: Response) => {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === "production") {
        console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set in production — rejecting");
        return res.status(500).json({ error: "Webhook not configured" });
      }
      console.warn(
        "[Stripe Webhook] STRIPE_WEBHOOK_SECRET not set (dev only) — accepting unverified payload",
      );
    }

    const rawBody = (req as Request & { rawBody?: unknown }).rawBody;
    if (secret) {
      if (!Buffer.isBuffer(rawBody)) {
        console.error("[Stripe Webhook] Raw body unavailable — cannot verify signature");
        return res.status(400).json({ error: "Raw body required for signature verification" });
      }
      const sigHeader = req.headers["stripe-signature"];
      const headerStr = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
      const verification = verifyStripeSignature(rawBody, headerStr ?? "", secret);
      if (!verification.ok) {
        console.warn(`[Stripe Webhook] Signature verification failed: ${verification.reason}`);
        monetizationService.hipaaAuditLog("stripe_webhook_signature_failed", {
          reason: verification.reason,
          ip: req.ip,
        });
        return res.status(400).json({ error: "Invalid signature" });
      }
    }

    const event = req.body;
    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        monetizationService.hipaaAuditLog("stripe_subscription_event", {
          eventType: event.type,
          subscriptionId: event.data?.object?.id,
        });
        break;

      case "invoice.paid":
      case "invoice.payment_failed":
        monetizationService.hipaaAuditLog("stripe_invoice_event", {
          eventType: event.type,
          invoiceId: event.data?.object?.id,
        });
        break;

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Error handling stripe webhook:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
});

export default router;
