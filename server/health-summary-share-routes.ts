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
import { collectIpsInput, escapeXhtml } from "./services/world/ips-generator";
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
import { renderShareMessage, summaryStrings } from "./services/engagement/summary-strings";
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

/** Attestations live with the grant so the page renders what was minted. */
const attestationsByGrant = new Map<string, Record<string, boolean | undefined>>();

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

      // A clinic-initiated share names a patient and is a staff action. A
      // patient-initiated one can only ever be the caller's own record.
      let profileId: string | null;
      if (input.initiator === "clinic") {
        if (!staff) {
          return res.status(403).json({
            error: "Clinic-initiated sharing is a staff action",
            detail:
              "Sharing on a patient's behalf discloses their record under the practice's " +
              "authority. A signed-in patient account is not that authority.",
          });
        }
        profileId = input.profileId ?? null;
        if (!profileId) {
          return res
            .status(400)
            .json({ error: "profileId is required for a clinic-initiated share" });
        }
      } else {
        profileId = await resolveOwnProfileId(req);
      }

      if (!profileId) {
        return res.status(404).json({ error: "No profile found for this account" });
      }

      const jurisdiction = input.jurisdiction as Jurisdiction;
      const policy = SHARE_POLICIES[jurisdiction];

      // India has no portability right and no duty to transmit: sharing to a
      // third party is a fresh purpose under DPDP s.4/s.6, not the discharge
      // of an access right. The US signed-writing requirement under
      // 164.524(c)(3)(ii) does not exist there and must not be demanded.
      if (
        input.initiator === "clinic" &&
        policy.requiresSignedDirective &&
        !input.directive
      ) {
        return res.status(400).json({
          error: "A written, signed direction is required",
          detail:
            "45 CFR 164.524(c)(3)(ii) requires the individual's request to be in writing, " +
            "signed, and to identify both the designated person and where to send the copy. " +
            "Record it and pass a reference to it. Note this is a separate permission from " +
            "the recipient's consent to be messaged — the patient cannot supply that one.",
          legalBasis: policy.legalBasis,
        });
      }

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
      });

      if (!result.ok) {
        return res.status(422).json({ error: result.reason, detail: result.detail });
      }

      if (input.attestations) {
        attestationsByGrant.set(result.grant.id, input.attestations);
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
      const caller = callerRole(req);
      const staff = isClinicStaff(caller);
      const requested = typeof req.query.profileId === "string" ? req.query.profileId : undefined;

      const profileId = staff && requested ? requested : await resolveOwnProfileId(req);
      if (!profileId) return res.status(404).json({ error: "No profile found for this account" });

      res.json({ shares: listShares(profileId) });
    },
  );

  // ── Revoke ───────────────────────────────────────────────────────────────
  app.post(
    "/api/engagement/share/:id/revoke",
    isAuthenticated,
    noStorePhi,
    async (req: Request, res: Response) => {
      const caller = callerRole(req);
      const staff = isClinicStaff(caller);
      const ownProfileId = await resolveOwnProfileId(req);

      // Only the record's owner or clinic staff may revoke. Checked against
      // the caller's own listing rather than by trusting the id, so a guessed
      // grant id belonging to someone else revokes nothing.
      const mine = ownProfileId ? listShares(ownProfileId).some((g) => g.id === req.params.id) : false;
      if (!mine && !staff) {
        return res.status(403).json({ error: "Not permitted to revoke this share" });
      }

      const reason = typeof req.body?.reason === "string" ? req.body.reason : "revoked by user";
      const grant = revokeShare(req.params.id, reason);
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

  async function loadSummaryFor(grant: { id: string; profileId: string; sections: readonly SummarySection[]; language: string; expiresAt: string }) {
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
      attestations: attestationsByGrant.get(grant.id) ?? {},
      sections: grant.sections,
      generatedAt: new Date().toISOString(),
      expiresAt: grant.expiresAt,
      language: grant.language,
    });
  }

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

  app.get("/s/:token", shareViewRateLimiter, renderShare);
  app.post("/s/:token", shareViewRateLimiter, renderShare);

  // JSON twin, for the mobile app and for a receiving system that wants the
  // data rather than the page. Takes the PIN from a header or a POST body for
  // the same reason the HTML route does.
  const renderShareJson = async (req: Request, res: Response) => {
    const redemption = await redeemShare(req.params.token, { pin: pinFromRequest(req) });
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");

    if (!redemption.ok) {
      const status =
        redemption.failure === "pin-required" || redemption.failure === "pin-incorrect" ? 401 : 410;
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
  };

  app.get("/api/engagement/share/view/:token", shareViewRateLimiter, renderShareJson);
  app.post("/api/engagement/share/view/:token", shareViewRateLimiter, renderShareJson);
}

// ── HTML ────────────────────────────────────────────────────────────────────

const PAGE_CSS = `
:root{color-scheme:light dark;--bg:#fff;--fg:#111;--muted:#555;--line:#e3e3e3;--warn-bg:#fff4e5;--warn-fg:#7a4100;--warn-line:#f0b357}
@media(prefers-color-scheme:dark){:root{--bg:#151719;--fg:#f2f2f2;--muted:#a8a8a8;--line:#31353a;--warn-bg:#3a2a10;--warn-fg:#ffcf8f;--warn-line:#8a5f1d}}
*{box-sizing:border-box}
body{margin:0;padding:1.5rem 1rem 3rem;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:38rem;margin:0 auto}
h1{font-size:1.35rem;margin:0 0 .25rem}
h2{font-size:1.05rem;margin:2rem 0 .5rem;padding-bottom:.3rem;border-bottom:1px solid var(--line)}
.meta{color:var(--muted);font-size:.85rem;margin:0 0 1.25rem}
.warn{background:var(--warn-bg);color:var(--warn-fg);border:1px solid var(--warn-line);border-radius:8px;padding:.7rem .85rem;margin:.5rem 0;font-weight:600}
ul{list-style:none;margin:0;padding:0}
li{padding:.55rem 0;border-bottom:1px solid var(--line)}
li:last-child{border-bottom:0}
.primary{font-weight:600}
.secondary{color:var(--muted);font-size:.9rem}
.status{display:inline-block;margin-left:.4rem;padding:.05rem .4rem;border:1px solid var(--line);border-radius:4px;font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}
.empty{color:var(--muted);font-style:italic}
footer{margin-top:2.5rem;padding-top:1rem;border-top:1px solid var(--line);color:var(--muted);font-size:.85rem}
form{margin-top:1rem;display:flex;flex-direction:column;gap:.5rem;max-width:14rem}
label{font-size:.85rem}
input{padding:.6rem .7rem;font-size:1.25rem;letter-spacing:.25em;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg)}
button{padding:.6rem .9rem;font-size:1rem;border:1px solid var(--line);border-radius:8px;background:var(--fg);color:var(--bg);cursor:pointer}
`;

function shell(title: string, bodyHtml: string, lang: string, dir: "ltr" | "rtl"): string {
  return `<!doctype html><html lang="${escapeXhtml(lang)}" dir="${dir}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="referrer" content="no-referrer">
<title>${escapeXhtml(title)}</title><style>${PAGE_CSS}</style></head><body><main>${bodyHtml}</main></body></html>`;
}

/** Scripts from `languages.ts`' RTL set. Getting this wrong makes Urdu unreadable. */
const RTL = new Set(["ar", "ur", "fa", "he"]);

function errorPage(failure: string, detail: string): string {
  const heading =
    failure === "pin-locked"
      ? "This link is closed"
      : "This link is no longer available";
  return shell(
    heading,
    `<h1>${escapeXhtml(heading)}</h1><p class="meta">${escapeXhtml(detail)}</p>` +
      `<p class="meta">Ask the person who sent it for a new one.</p>`,
    "en",
    "ltr",
  );
}

/**
 * PIN entry. The form POSTs to the same path, so the PIN travels in a request
 * body rather than a URL — access logs, proxy logs and browser history all
 * record the request line, and a PIN sitting in any of them is a PIN that no
 * longer protects anything.
 *
 * `autocomplete="off"` and `inputmode="numeric"` because this is a one-time
 * code read off a message, not a credential a password manager should keep.
 */
function pinPage(token: string, error: string | null): string {
  const action = `/s/${encodeURIComponent(token)}`;
  const body =
    `<h1>Enter the PIN</h1>` +
    `<p class="meta">The person who shared this summary was given a 6-digit PIN.</p>` +
    (error ? `<p class="warn">${escapeXhtml(error)}</p>` : "") +
    `<form method="post" action="${escapeXhtml(action)}">` +
    `<label class="secondary" for="pin">PIN</label>` +
    `<input id="pin" name="pin" type="text" inputmode="numeric" pattern="[0-9]*" ` +
    `maxlength="6" autocomplete="off" autofocus>` +
    `<button type="submit">Open summary</button>` +
    `</form>`;
  return shell("Enter the PIN", body, "en", "ltr");
}

function summaryPage(
  summary: ReturnType<typeof buildHealthSummary>,
  expiresAt: string,
  language: string,
): string {
  const { strings } = summaryStrings(language);
  const dir = RTL.has(summary.language) ? "rtl" : "ltr";

  const warnings = summary.warnings
    .map((w) => `<p class="warn">${escapeXhtml(w)}</p>`)
    .join("");

  const sections = summary.sections
    .map((section) => {
      const body = section.emptyState
        ? `<p class="empty">${escapeXhtml(section.emptyState.text)}</p>`
        : `<ul>${section.lines
            .map((line) => {
              const secondary = line.secondary
                ? `<div class="secondary">${escapeXhtml(line.secondary)}</div>`
                : "";
              const status = line.status
                ? `<span class="status">${escapeXhtml(line.status)}</span>`
                : "";
              return `<li><div class="primary">${escapeXhtml(line.primary)}${status}</div>${secondary}</li>`;
            })
            .join("")}</ul>`;
      return `<h2>${escapeXhtml(section.heading)}</h2>${body}`;
    })
    .join("");

  const body =
    `<h1>${escapeXhtml(summary.patientName)}</h1>` +
    `<p class="meta">${escapeXhtml(strings.generatedLabel)}: ${escapeXhtml(summary.generatedAt)}` +
    ` &middot; ${escapeXhtml(strings.expiresLabel)}: ${escapeXhtml(expiresAt)}</p>` +
    warnings +
    sections +
    `<footer>${escapeXhtml(summary.disclaimer)}</footer>`;

  return shell(summary.patientName, body, summary.language, dir);
}
