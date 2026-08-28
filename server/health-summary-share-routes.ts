/**
 * Shareable health summary API.
 *
 *   GET  /api/engagement/share/policy      per-jurisdiction sharing rules + basis
 *   POST /api/engagement/share             mint a link (patient or clinic)
 *   GET  /api/engagement/share/list        the caller's own live and dead links
 *   POST /api/engagement/share/:id/revoke  kill a link
 *   GET  /s/:token                         the page the link opens (public)
 *
 * The public page is served here rather than left to the SPA because the
 * person opening it is usually *outside* the practice — a pharmacist, an
 * emergency department, a daughter on an Android phone in another country.
 * A link that needs an app installed to render is not a shareable record.
 */

import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { profiles } from "@shared/schema";
import { phiDb } from "./storage/phi-storage";
import { isAuthenticated } from "./replit_integrations/auth";
import { noStorePhi } from "./lib/middleware/no-store-phi";
import { logPhiAccess } from "./security/hipaa-audit";
import { SHARE_LIMITS, SUMMARY_SECTIONS, type SummarySection } from "@shared/health-summary";
import type { Jurisdiction } from "@shared/engagement";
import { collectIpsInput } from "./services/world/ips-generator";
import { buildHealthSummary, summaryToPlainText } from "./services/engagement/summary-render";
import {
  SHARE_POLICIES,
  buildShareIntents,
  listShares,
  mintShare,
  redeemShare,
  revokeShare,
  shareBaseUrl,
} from "./services/engagement/summary-share";
import { renderShareMessage } from "./services/engagement/summary-strings";
import {
  errorPage,
  interstitialPage,
  pinPage,
  summaryPage,
} from "./services/engagement/summary-page";
import { isClinicStaff } from "./services/engagement/inbound-auth";

function getSessionUserId(req: Request): string | undefined {
  const session = req.session as any;
  return session?.userId || (req.user as any)?.id || (req.user as any)?.claims?.sub;
}

function callerRole(req: Request) {
  const session = req.session as any;
  return {
    userId: getSessionUserId(req),
    role: session?.role,
    isProvider: session?.isProvider,
  };
}

/**
 * The caller's own profile. Ownership is structural: a patient-initiated
 * share can only ever name the profile attached to the session account, so
 * there is no id to tamper with.
 */
async function resolveOwnProfileId(req: Request): Promise<string | null> {
  const accountId = getSessionUserId(req);
  if (!accountId) return null;
  const rows = await phiDb
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.accountId, accountId))
    .limit(1);
  return rows.length > 0 ? rows[0].id : null;
}

const sectionSchema = z.enum(["medications", "diagnoses", "allergies"]);

const mintSchema = z.object({
  sections: z.array(sectionSchema).min(1),
  initiator: z.enum(["patient", "clinic"]).default("patient"),
  delivery: z
    .enum(["server-sms", "server-whatsapp", "handoff-sms", "handoff-whatsapp", "copy-link"])
    .default("copy-link"),
  jurisdiction: z.enum(["US", "IN"]).default("US"),
  language: z.string().min(2).max(12).default("en"),
  ttlHours: z.number().int().positive().max(SHARE_LIMITS.MAX_TTL_HOURS).optional(),
  maxViews: z.number().int().positive().max(SHARE_LIMITS.MAX_MAX_VIEWS).optional(),
  withPin: z.boolean().optional(),
  label: z.string().max(120).optional(),
  /** Clinic-initiated shares to a third party only. */
  profileId: z.string().uuid().optional(),
  directive: z
    .object({
      recordedAt: z.string().min(1),
      signatureRef: z.string().min(1),
      designatedPerson: z.string().min(1),
      destination: z.string().min(1),
    })
    .optional(),
  attestations: z
    .object({
      noKnownAllergies: z.boolean().optional(),
      noKnownMedications: z.boolean().optional(),
      noKnownProblems: z.boolean().optional(),
    })
    .optional(),
});

export function registerHealthSummaryShareRoutes(app: Express): void {
  // ── Policy ───────────────────────────────────────────────────────────────
  app.get("/api/engagement/share/policy", (_req: Request, res: Response) => {
    res.json({
      policies: SHARE_POLICIES,
      limits: SHARE_LIMITS,
      sections: SUMMARY_SECTIONS,
      configured: shareBaseUrl() !== null,
      note:
        "The message carries a link, never the list. Medications, diagnoses and allergies are " +
        "classified clinical-detail and exceed the PHI ceiling of every messaging channel in " +
        "both jurisdictions, so the send gate refuses to put them in a message body.",
    });
  });

  // ── Mint ─────────────────────────────────────────────────────────────────
  app.post(
    "/api/engagement/share",
    isAuthenticated,
    noStorePhi,
    async (req: Request, res: Response) => {
      const parsed = mintSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid share request", detail: parsed.error.issues });
      }
      const input = parsed.data;
      const caller = callerRole(req);
      const staff = isClinicStaff(caller);

      // A clinic-initiated share names a patient by id and mints a **bearer
      // link** to their medications, diagnoses and allergies — redeemable with
      // no authentication at all. A role check cannot carry that.
      //
      // I had reasoned, on the engagement `/send` route, that "staff
      // legitimately message patients other than themselves, so the role check
      // is the right boundary, not ownership". That is true for messaging a
      // number the practice already holds. It is not true here, and carrying
      // the reasoning across was the mistake: this path takes an arbitrary
      // profile UUID and opens that person's chart to whoever holds the URL.
      //
      // The check it needs is a treatment relationship, and this codebase
      // cannot answer that. `storage.isProviderAuthorizedForPatient` exists but
      // is itself a process-local Map — on ten Cloud Run instances it would
      // return false on nine of them, denying legitimate access rather than
      // granting illegitimate access, which is a different bug rather than a
      // control. There is no durable provider-patient table.
      //
      // So it refuses. An unauthenticated link to any profile in the database
      // is not a flow worth keeping while the control that would bound it does
      // not exist. The patient-initiated path is unaffected and is the one the
      // feature is built around.
      if (input.initiator === "clinic") {
        if (!staff) {
          return res.status(403).json({
            error: "Clinic-initiated sharing is a staff action",
            detail:
              "Sharing on a patient's behalf discloses their record under the practice's " +
              "authority. A signed-in patient account is not that authority.",
          });
        }
        return res.status(501).json({
          error: "Clinic-initiated sharing is not available",
          detail:
            "This would mint a link that renders a named patient's medications, diagnoses " +
            "and allergies to anyone holding the URL, with no authentication. Clinic staff " +
            "role is not sufficient authority for that — it proves the caller works here, " +
            "not that they have any business with this patient. A treatment-relationship " +
            "check is required and this deployment has no durable source for one. Until it " +
            "does, the patient shares their own record from their own account.",
        });
      }
      const profileId = await resolveOwnProfileId(req);

      if (!profileId) {
        return res.status(404).json({ error: "No profile found for this account" });
      }

      const jurisdiction = input.jurisdiction as Jurisdiction;
      const policy = SHARE_POLICIES[jurisdiction];

      // The 164.524(c)(3)(ii) signed-directive requirement used to be enforced
      // here. It only ever applied to clinic-initiated shares, which now
      // refuse above, so the check would be unreachable — TypeScript said so,
      // which is the right way to find out.
      //
      // The rule itself is unchanged and still lives in `SHARE_POLICIES`,
      // reported by `GET /api/engagement/share/policy`: a US third-party
      // directive must be in writing, signed, and name both the person and the
      // destination, while India has no portability right at all and treats
      // the same disclosure as a fresh DPDP s.6 purpose. Whoever restores the
      // clinic path restores this check with it — and must not collapse it
      // into the recipient's consent to be messaged, which is a different
      // permission from a different person.

      const result = await mintShare({
        profileId,
        createdByAccountId: caller.userId ?? "unknown",
        sections: input.sections as SummarySection[],
        initiator: input.initiator,
        jurisdiction,
        delivery: input.delivery,
        language: input.language,
        ttlHours: input.ttlHours,
        maxViews: input.maxViews,
        withPin: input.withPin,
        label: input.label,
        directive: input.directive,
        // Stored on the grant rather than in a process-local map, so a
        // redemption served by any instance renders the same "no known
        // allergies" the minting instance meant.
        attestations: input.attestations as Record<string, boolean> | undefined,
      });

      if (!result.ok) {
        return res.status(422).json({ error: result.reason, detail: result.detail });
      }

      await logPhiAccess({
        userId: caller.userId ?? "unknown",
        patientId: profileId,
        resourceType: "health-summary-share",
        action: "export",
        details:
          `minted share ${result.grant.id} sections=${result.grant.sections.join("+")} ` +
          `initiator=${input.initiator} delivery=${input.delivery} ` +
          `jurisdiction=${jurisdiction} expires=${result.grant.expiresAt}`,
      });

      const practiceName = process.env.PRACTICE_DISPLAY_NAME ?? "Your clinic";
      const message = renderShareMessage(input.language, {
        practiceName,
        shareUrl: result.url,
      });

      // Handoff intents are returned for every mint. They are inert unless the
      // client opens one, and having them means the patient always has the
      // path that keeps the practice out of the sender's chair.
      const intents = buildShareIntents(result.url, message.body);

      res.json({
        grant: result.grant,
        url: result.url,
        pin: result.pin,
        message: message.body,
        languageUsed: message.language,
        fellBackToEnglish: message.fellBackToEnglish,
        intents,
        policy,
        notice:
          policy.transmissionIsADuty
            ? "Warn the patient that a message can be read in transit, and record that they " +
              "accepted that risk. Once warned, the request must be honoured and the practice " +
              "is not responsible for interception in transit."
            : "Under the DPDP Act this disclosure rests on the patient's consent for this " +
              "specific purpose, not on a right of access. Record the consent and the notice.",
      });
    },
  );

  // ── List ─────────────────────────────────────────────────────────────────
  app.get(
    "/api/engagement/share/list",
    isAuthenticated,
    noStorePhi,
    async (req: Request, res: Response) => {
      // Always the caller's own profile. `?profileId=` used to be honoured for
      // staff, which let anyone past the role check enumerate another account's
      // grants — the same missing treatment-relationship check as the mint
      // path, so it fails the same way.
      const profileId = await resolveOwnProfileId(req);
      if (!profileId) return res.status(404).json({ error: "No profile found for this account" });

      res.json({ shares: await listShares(profileId) });
    },
  );

  // ── Revoke ───────────────────────────────────────────────────────────────
  app.post(
    "/api/engagement/share/:id/revoke",
    isAuthenticated,
    noStorePhi,
    async (req: Request, res: Response) => {
      const caller = callerRole(req);
      const ownProfileId = await resolveOwnProfileId(req);

      // Own grants only. The staff bypass that used to be here meant any
      // caller passing the role check could revoke any grant id in the
      // database — a denial-of-service on other practices' links rather than a
      // disclosure, but built on the same missing check.
      //
      // Membership is tested against the caller's own listing rather than by
      // trusting the id, so a guessed grant id revokes nothing.
      const mine = ownProfileId
        ? (await listShares(ownProfileId)).some((g) => g.id === req.params.id)
        : false;
      if (!mine) {
        return res.status(403).json({ error: "Not permitted to revoke this share" });
      }

      const reason = typeof req.body?.reason === "string" ? req.body.reason : "revoked by user";
      const grant = await revokeShare(req.params.id, reason);
      if (!grant) return res.status(404).json({ error: "No such share" });

      await logPhiAccess({
        userId: caller.userId ?? "unknown",
        patientId: ownProfileId ?? undefined,
        resourceType: "health-summary-share",
        action: "write",
        details: `revoked share ${grant.id}: ${reason}`,
      });

      res.json({ grant });
    },
  );

  // ── The page the link opens ──────────────────────────────────────────────
  //
  // Unauthenticated by design: the recipient is a pharmacist or a relative,
  // not an account holder. The token is the credential, which is why it is
  // 256 bits, short-lived, view-capped and revocable, and why this handler
  // sets `Referrer-Policy: no-referrer` — a page that loaded any external
  // resource would leak the token in the Referer header to whoever served it.
  //
  // The global `apiRateLimiter` skips every path that does not start with
  // `/api`, so these routes would otherwise have no application rate limit at
  // all. This one is deliberately tighter than the API limiter: a human
  // opening a link they were sent needs a handful of requests, not 200 a
  // minute, and everything above that is either a scraper or a PIN walk.
  const shareViewRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: "SHARE_RATE_LIMITED", message: "Too many requests. Please slow down." },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
  });

  function setShareHeaders(res: Response): void {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    res.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.set("Referrer-Policy", "no-referrer");
    res.set(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    );
  }

  /**
   * The PIN never travels in the query string.
   *
   * `?pin=` would be written to access logs, proxy logs, browser history, and
   * anything that records request lines — which is precisely the set of places
   * the PIN exists to be absent from. A GET on a PIN-gated link renders a form
   * instead, and the form POSTs. A `?pin=` on the URL is ignored rather than
   * honoured, so a stale link built the old way fails closed to the form.
   */
  function pinFromRequest(req: Request): string | undefined {
    const fromBody = (req.body as Record<string, unknown> | undefined)?.pin;
    if (typeof fromBody === "string" && fromBody.trim() !== "") return fromBody.trim();
    const header = req.get("x-share-pin");
    if (typeof header === "string" && header.trim() !== "") return header.trim();
    return undefined;
  }

  async function loadSummaryFor(grant: {
    id: string;
    profileId: string;
    sections: readonly SummarySection[];
    language: string;
    expiresAt: string;
    attestations?: Record<string, boolean>;
  }) {
    const ips = await collectIpsInput(grant.profileId, {
      timestamp: new Date().toISOString(),
      documentId: grant.id,
    });
    if (!ips) return null;
    return buildHealthSummary({
      patientName: ips.patient.fullName,
      medications: ips.medications,
      problems: ips.problems,
      allergies: ips.allergies,
      attestations: grant.attestations ?? {},
      sections: grant.sections,
      generatedAt: new Date().toISOString(),
      expiresAt: grant.expiresAt,
      language: grant.language,
    });
  }

  /**
   * GET renders an interstitial and touches nothing.
   *
   * This is the fix for the hole that ran straight through the feature's
   * central claim. The whole design rests on "the message carries a link, not
   * the list", justified by Meta signing no BAA — and then WhatsApp, iMessage,
   * Slack and mail scanners *fetch the link* to build a preview. The first GET
   * is the platform's crawler, not the recipient. Rendering PHI on GET meant
   * the medication and allergy list went to Meta anyway, burned a view before
   * the human ever opened it, and put the patient's name in a cached preview
   * snippet via the page title. The `handoff-whatsapp` intent handed the link
   * to the exact platform the architecture existed to keep it away from.
   *
   * So GET is inert: a generic page, no patient name, no registry lookup at
   * all. It does not even reveal whether the token is real — an unfurler
   * learns nothing. Redemption happens on POST, which crawlers do not issue
   * and preview generators do not click.
   */
  const shareInterstitial = (req: Request, res: Response) => {
    setShareHeaders(res);
    res.type("html").send(interstitialPage(req.params.token));
  };

  const renderShare = async (req: Request, res: Response) => {
    const token = req.params.token;
    const redemption = await redeemShare(token, { pin: pinFromRequest(req) });

    setShareHeaders(res);

    if (!redemption.ok) {
      if (redemption.failure === "pin-required" || redemption.failure === "pin-incorrect") {
        return res
          .status(401)
          .type("html")
          .send(pinPage(token, redemption.failure === "pin-incorrect" ? redemption.detail : null));
      }
      return res.status(410).type("html").send(errorPage(redemption.failure, redemption.detail));
    }

    const grant = redemption.grant;
    const summary = await loadSummaryFor(grant);
    if (!summary) {
      return res
        .status(410)
        .type("html")
        .send(errorPage("token-not-found", "This link is not valid."));
    }

    await logPhiAccess({
      userId: `share:${grant.id}`,
      patientId: grant.profileId,
      resourceType: "health-summary-share",
      action: "read",
      details: `share viewed (${grant.viewCount}/${grant.maxViews}) sections=${grant.sections.join("+")}`,
    });

    res.type("html").send(summaryPage(summary, grant.expiresAt, grant.language));
  };

  app.get("/s/:token", shareViewRateLimiter, shareInterstitial);
  app.post("/s/:token", shareViewRateLimiter, renderShare);

  /**
   * JSON twin. The token travels in the **body**, not the path.
   *
   * `server/index.ts` logs `{ method, path, status }` as JSON to stdout for
   * every request whose path starts with `/api`. A token in the path is
   * therefore written to the application log — and for a default grant with no
   * PIN, that token is the only secret. Anyone who can read stdout or the log
   * aggregator could replay outstanding links, which is a strictly wider
   * audience than the HIPAA audit table this module writes to deliberately.
   *
   * POST-only for the same reason as the HTML route: a GET is what a crawler
   * issues.
   */
  const viewBodySchema = z.object({
    token: z.string().min(20).max(200),
    pin: z.string().min(1).max(32).optional(),
  });

  app.post(
    "/api/engagement/share/view",
    shareViewRateLimiter,
    async (req: Request, res: Response) => {
      res.set("Cache-Control", "no-store");
      res.set("Referrer-Policy", "no-referrer");

      const parsed = viewBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "token is required in the request body" });
      }

      const redemption = await redeemShare(parsed.data.token, { pin: parsed.data.pin });
      if (!redemption.ok) {
        const status =
          redemption.failure === "pin-required" || redemption.failure === "pin-incorrect"
            ? 401
            : 410;
        return res.status(status).json({ error: redemption.failure, detail: redemption.detail });
      }

      const grant = redemption.grant;
      const summary = await loadSummaryFor(grant);
      if (!summary) return res.status(410).json({ error: "token-not-found" });

      await logPhiAccess({
        userId: `share:${grant.id}`,
        patientId: grant.profileId,
        resourceType: "health-summary-share",
        action: "read",
        details: `share viewed as JSON (${grant.viewCount}/${grant.maxViews})`,
      });

      res.json({ summary, plainText: summaryToPlainText(summary), expiresAt: grant.expiresAt });
    },
  );
}
