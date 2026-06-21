/**
 * S5 — California Consumer Privacy Act / CPRA self-serve surface
 *
 * The GDPR routes (server/routes/gdpr-routes.ts) already accept a
 * `framework: 'ccpa'` parameter on every request creator and the
 * account_privacy_prefs table already has the CCPA-specific flags
 * (doNotSell, limitSensitivePi, optOutAutomatedDecisions).
 *
 * What CCPA needs ON TOP of that:
 *   §1798.100(b)  Notice at Collection           → GET /notice-at-collection
 *   §1798.130     12-month look-back disclosure  → GET /disclosure-12mo
 *   §1798.135     "Do Not Sell or Share" link    → GET /opt-out-summary
 *   §1798.125     Non-discrimination notice      → embedded in notice
 *   §1798.105     Authorized agent requests      → POST /authorized-agent-request
 *   California-specific privacy contact          → GET /privacy-contact
 *   CCPA-only request history                    → GET /requests
 *
 * Like GDPR, these endpoints are LEGALLY MANDATED for ALL users —
 * including Free tier — and MUST NEVER be feature-gated.
 *
 * Categories of personal information are listed verbatim from CCPA
 * §1798.140(o)(1) so the disclosure is provably aligned with the statute.
 */

import { Router, type Request, type Response } from "express";
import { eq, and, gt, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import {
  accounts,
  dataRightsRequests,
  accountPrivacyPrefs,
  type DataRightsRequest,
  type AccountPrivacyPrefs,
} from "@shared/schema";
import { type AuthRequest } from "../middleware/require-feature";

const router = Router();

// ---------------------------------------------------------------------------
// Statutory constants. Edit ONLY in coordination with privacy counsel.
// ---------------------------------------------------------------------------

/**
 * CCPA §1798.140(o)(1) categories. We disclose every category we collect,
 * the SOURCES, the BUSINESS PURPOSE, the third parties we share it with for
 * a business purpose, and the retention period.
 *
 * "Sold" / "Shared for cross-context behavioral advertising" is hard-coded
 * to false everywhere because Tabula Medica does not sell or share PHI for
 * advertising under any circumstance. That commitment is also enforced by
 * the doNotSell flag default (true) and absence of any ad tracker.
 */
const NOTICE_AT_COLLECTION = {
  generatedAt: "2026-04-21",
  controller: "Tabula Medica, Inc.",
  scope:
    "This notice covers personal information of California residents who use the Tabula Medica patient health record service.",
  doWeSell: false,
  doWeShareForAds: false,
  retentionPolicy:
    "Personal information is retained for the duration of your account plus 7 years (HIPAA §164.530(j) requires 6 years; we add 1 year buffer). PHI may be retained longer if required by treating providers under separate retention obligations.",
  categories: [
    {
      category: "A — Identifiers",
      examples: ["Real name", "Email address", "Postal address", "Account ID"],
      sources: ["Directly from you at sign-up"],
      businessPurpose: "Account creation, authentication, communication",
      sharedWith: ["Google Cloud Identity Platform (identity provider, BAA in place)"],
      sold: false,
      sharedForAds: false,
    },
    {
      category: "B — Customer records (Cal. Civ. Code §1798.80(e))",
      examples: ["Name + medical/insurance information when combined"],
      sources: ["Directly from you", "Connected EHR (Epic, Cerner, etc., via SMART on FHIR with your authorization)"],
      businessPurpose: "Providing the Service (record aggregation, summaries, sharing controls)",
      sharedWith: ["Medplum (FHIR backend, BAA in place)", "Vertex AI (PHI-redacted prompts only, BAA in place)"],
      sold: false,
      sharedForAds: false,
    },
    {
      category: "F — Internet/network activity",
      examples: ["Pages visited within the app", "Feature interactions"],
      sources: ["Automatically from your use of the Service"],
      businessPurpose: "Quality, security, billing, debugging",
      sharedWith: ["Internal only (no third-party analytics by default)"],
      sold: false,
      sharedForAds: false,
    },
    {
      category: "G — Geolocation (coarse, IP-derived)",
      examples: ["City-level location from IP for security audit"],
      sources: ["Automatically from request headers"],
      businessPurpose: "Security (anomalous-access detection)",
      sharedWith: ["Internal only"],
      sold: false,
      sharedForAds: false,
    },
    {
      category: "I — Professional/employment information",
      examples: ["Provider NPI when you connect to a clinician account"],
      sources: ["Directly from you", "NPI registry (public)"],
      businessPurpose: "Care-team management",
      sharedWith: ["Internal only"],
      sold: false,
      sharedForAds: false,
    },
    {
      category: "K — Inferences",
      examples: ["AI-generated summaries of your health record"],
      sources: ["Derived from PHI you upload, processed by Vertex AI"],
      businessPurpose: "Providing the Service",
      sharedWith: ["Vertex AI (BAA in place; prompts redacted)"],
      sold: false,
      sharedForAds: false,
    },
    {
      category: "Sensitive PI — Health information",
      examples: ["Lab results", "Medications", "Conditions", "Imaging reports"],
      sources: ["Directly from you", "Connected EHR (your authorization)"],
      businessPurpose: "Providing the Service. NEVER used for ads or profiling.",
      sharedWith: ["Medplum (BAA)", "Vertex AI (BAA, redacted)"],
      sold: false,
      sharedForAds: false,
      limitable: true,
    },
  ],
  nonDiscriminationNotice:
    "Per §1798.125, exercising any CCPA right will not result in denial of service, different pricing, lower quality, or any retaliation. Free tier users keep all Free features; Pro tier users keep all Pro features.",
} as const;

const PRIVACY_CONTACT = {
  jurisdiction: "California",
  controller: "Tabula Medica, Inc.",
  privacyOfficerEmail: "privacy@tabulamedica.health",
  californiaTollFree: "1-800-PRIVACY (placeholder — to be activated before public launch)",
  postal: "Tabula Medica, Attn: Privacy Officer, 1 Health Way, Wilmington DE 19801, USA",
  responseSlaDays: 45, // CCPA §1798.130(a)(2) — extendable to 90 with notice
  agentInstructions:
    "Authorized agents may submit requests via /authorized-agent-request below or by mailing a notarized authorization to the postal address above.",
  appealPath:
    "If you are unsatisfied with our response, you may file a complaint with the California Privacy Protection Agency at https://cppa.ca.gov.",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveAccountIdFromSession(req: AuthRequest): Promise<string | null> {
  const email = req.user?.claims?.email;
  if (!email) return null;
  try {
    const [acct] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.email, email))
      .limit(1);
    return acct?.id ?? null;
  } catch (err) {
    console.error("[CCPA] resolveAccountIdFromSession error", err);
    return null;
  }
}

function logAudit(action: string, accountId: string, meta?: Record<string, unknown>) {
  console.log(
    `[CCPA-AUDIT] action=${action} accountId=${accountId} ${meta ? `meta=${JSON.stringify(meta)}` : ""}`,
  );
}

// ---------------------------------------------------------------------------
// PUBLIC endpoints — no auth required (§1798.130 requires the notice be
// accessible to non-customers too, e.g. people deciding whether to sign up).
// ---------------------------------------------------------------------------

router.get("/notice-at-collection", (_req: Request, res: Response) => {
  res.json({ notice: NOTICE_AT_COLLECTION });
});

router.get("/privacy-contact", (_req: Request, res: Response) => {
  res.json({ contact: PRIVACY_CONTACT });
});

/**
 * GET /opt-out-summary — landing page payload for the §1798.135-required
 * "Do Not Sell or Share My Personal Information" link in the site footer.
 */
router.get("/opt-out-summary", (_req: Request, res: Response) => {
  res.json({
    summary: {
      headline: "Do Not Sell or Share My Personal Information",
      statement:
        "Tabula Medica does not sell personal information and does not share personal information for cross-context behavioral advertising. This commitment is hard-coded into our service: there are no advertising trackers, no data brokers, no marketing-attribution partners. Your data, especially your health data, stays with us and the providers you authorize.",
      furtherActions: [
        {
          label: "Confirm 'Do Not Sell or Share' on your account (immediate)",
          href: "/ccpa#opt-out",
        },
        {
          label: "Limit Use of Sensitive Personal Information",
          href: "/ccpa#limit-spi",
        },
        {
          label: "Request a copy of all data we hold about you",
          href: "/ccpa#access",
        },
        {
          label: "Delete your account and data",
          href: "/ccpa#delete",
        },
      ],
    },
  });
});

// ---------------------------------------------------------------------------
// AUTHENTICATED endpoints
// ---------------------------------------------------------------------------

/**
 * GET /requests — CCPA-only request history (12 months).
 * Filtered to framework='ccpa' so the patient sees only the California
 * column, even if they've made GDPR requests in the past.
 */
router.get("/requests", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  try {
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const rows = await db
      .select()
      .from(dataRightsRequests)
      .where(
        and(
          eq(dataRightsRequests.accountId, accountId),
          eq(dataRightsRequests.framework, "ccpa"),
          gt(dataRightsRequests.requestedAt, since),
        ),
      )
      .orderBy(desc(dataRightsRequests.requestedAt))
      .limit(100);
    res.json({ requests: rows });
  } catch (err) {
    console.error("[CCPA] GET /requests error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * GET /disclosure-12mo — §1798.130(a)(5) consumer-specific disclosure of
 * categories collected, disclosed for business purpose, and sold/shared
 * (always empty for the latter) over the last 12 months.
 */
router.get("/disclosure-12mo", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  try {
    const since = new Date();
    since.setMonth(since.getMonth() - 12);
    const completedRequests = await db
      .select()
      .from(dataRightsRequests)
      .where(
        and(
          eq(dataRightsRequests.accountId, accountId),
          gt(dataRightsRequests.requestedAt, since),
        ),
      )
      .orderBy(desc(dataRightsRequests.requestedAt));

    res.json({
      window: {
        from: since.toISOString(),
        to: new Date().toISOString(),
      },
      categoriesCollected: NOTICE_AT_COLLECTION.categories.map((c) => c.category),
      categoriesDisclosedForBusinessPurpose: NOTICE_AT_COLLECTION.categories
        .filter((c) => c.sharedWith.some((s) => s !== "Internal only"))
        .map((c) => ({
          category: c.category,
          recipients: c.sharedWith.filter((s) => s !== "Internal only"),
        })),
      categoriesSold: [], // never
      categoriesSharedForAds: [], // never
      categoriesDisclosedToThirdParties:
        // Currently the only "third parties" outside business-purpose are
        // those the patient explicitly authorizes (e.g. a clinician via
        // /provider-share). Pull them from completed requests if present.
        completedRequests
          .filter((r) => r.type === "portability" || r.type === "access")
          .map((r) => ({
            category: "B — Customer records (FHIR bundle)",
            recipient: r.fulfillmentRef ?? "you (download link emailed)",
            requestId: r.id,
            disclosedAt: r.completedAt ?? r.requestedAt,
          })),
      requestActivity: completedRequests.map((r) => ({
        id: r.id,
        type: r.type,
        framework: r.framework,
        status: r.status,
        requestedAt: r.requestedAt,
        completedAt: r.completedAt,
      })),
    });
  } catch (err) {
    console.error("[CCPA] GET /disclosure-12mo error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * GET /preferences — re-export of accountPrivacyPrefs scoped to the CCPA
 * subset. (Full prefs available via /api/gdpr/preferences.)
 */
router.get("/preferences", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  try {
    const [existing] = await db
      .select()
      .from(accountPrivacyPrefs)
      .where(eq(accountPrivacyPrefs.accountId, accountId))
      .limit(1);
    const prefs: Partial<AccountPrivacyPrefs> = existing ?? (await db
      .insert(accountPrivacyPrefs)
      .values({ accountId })
      .returning())[0];
    res.json({
      preferences: {
        doNotSell: prefs.doNotSell ?? true,
        limitSensitivePi: prefs.limitSensitivePi ?? false,
        optOutAutomatedDecisions: prefs.optOutAutomatedDecisions ?? false,
        analyticsOptOut: prefs.analyticsOptOut ?? false,
        marketingEmailsOptOut: prefs.marketingEmailsOptOut ?? false,
      },
    });
  } catch (err) {
    console.error("[CCPA] GET /preferences error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * POST /confirm-opt-out — §1798.135 single-click confirmation of the "Do
 * Not Sell or Share" preference. Records a CCPA request row AND flips the
 * pref to true. Idempotent.
 */
router.post("/confirm-opt-out", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  try {
    const [existing] = await db
      .select()
      .from(accountPrivacyPrefs)
      .where(eq(accountPrivacyPrefs.accountId, accountId))
      .limit(1);
    if (!existing) {
      await db.insert(accountPrivacyPrefs).values({ accountId, doNotSell: true });
    } else {
      await db
        .update(accountPrivacyPrefs)
        .set({ doNotSell: true, updatedAt: new Date() })
        .where(eq(accountPrivacyPrefs.accountId, accountId));
    }
    const [row] = await db
      .insert(dataRightsRequests)
      .values({
        accountId,
        type: "do_not_sell",
        framework: "ccpa",
        status: "completed",
        completedAt: new Date(),
        notes:
          "Honored immediately — Tabula Medica does not sell or share PI under any circumstance.",
      })
      .returning();
    logAudit("confirm_opt_out", accountId, { requestId: row.id });
    res.json({ request: row, confirmed: true });
  } catch (err) {
    console.error("[CCPA] POST /confirm-opt-out error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * POST /limit-spi — §1798.121 right to limit use of sensitive PI.
 * Toggles the limitSensitivePi flag and records a CCPA request.
 */
const limitSchema = z.object({ enabled: z.boolean() });
router.post("/limit-spi", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  const parsed = limitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "INVALID_INPUT" });
  try {
    const [existing] = await db
      .select()
      .from(accountPrivacyPrefs)
      .where(eq(accountPrivacyPrefs.accountId, accountId))
      .limit(1);
    if (!existing) {
      await db.insert(accountPrivacyPrefs).values({
        accountId,
        limitSensitivePi: parsed.data.enabled,
      });
    } else {
      await db
        .update(accountPrivacyPrefs)
        .set({ limitSensitivePi: parsed.data.enabled, updatedAt: new Date() })
        .where(eq(accountPrivacyPrefs.accountId, accountId));
    }
    const [row] = await db
      .insert(dataRightsRequests)
      .values({
        accountId,
        type: "limit_sensitive",
        framework: "ccpa",
        status: "completed",
        completedAt: new Date(),
        notes: parsed.data.enabled
          ? "Sensitive PI use limited to those purposes permitted under §1798.121(a)."
          : "Patient re-enabled full use of sensitive PI.",
      })
      .returning();
    logAudit("limit_spi", accountId, { enabled: parsed.data.enabled, requestId: row.id });
    res.json({ request: row, limitSensitivePi: parsed.data.enabled });
  } catch (err) {
    console.error("[CCPA] POST /limit-spi error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

/**
 * POST /authorized-agent-request — Records a request submitted on behalf
 * of the authenticated user by an authorized agent. The user must still
 * verify their identity through normal sign-in; the agent's name and the
 * power-of-attorney evidence reference are stored in `notes`.
 */
const agentSchema = z.object({
  requestType: z.enum(["access", "portability", "erasure", "do_not_sell", "limit_sensitive"]),
  agentName: z.string().min(1).max(200),
  agentEmail: z.string().email(),
  authorizationRef: z.string().min(1).max(500),
  consumerStatement: z.string().max(2000).optional(),
});
router.post("/authorized-agent-request", async (req: AuthRequest, res: Response) => {
  const accountId = await resolveAccountIdFromSession(req);
  if (!accountId) return res.status(401).json({ error: "UNAUTHORIZED" });
  const parsed = agentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "INVALID_INPUT", issues: parsed.error.issues });
  }
  try {
    const [row] = await db
      .insert(dataRightsRequests)
      .values({
        accountId,
        type: parsed.data.requestType,
        framework: "ccpa",
        status: "pending",
        notes: JSON.stringify({
          channel: "authorized_agent",
          agentName: parsed.data.agentName,
          agentEmail: parsed.data.agentEmail,
          authorizationRef: parsed.data.authorizationRef,
          consumerStatement: parsed.data.consumerStatement ?? null,
        }),
      })
      .returning();
    logAudit("authorized_agent_request", accountId, {
      requestId: row.id,
      requestType: parsed.data.requestType,
      agent: parsed.data.agentName,
    });
    res.json({
      request: row,
      message:
        "Authorized-agent request received. Our Privacy Officer will verify the authorization with you directly within 10 business days before any action is taken.",
    });
  } catch (err) {
    console.error("[CCPA] POST /authorized-agent-request error", err);
    res.status(500).json({ error: "INTERNAL_ERROR" });
  }
});

export default router;
