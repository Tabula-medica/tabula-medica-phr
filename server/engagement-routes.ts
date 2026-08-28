/**
 * Patient engagement API — mounted at /api/engagement.
 *
 * Runs in every deployment. Jurisdiction is a property of the *patient*, not
 * of the build: the rules that govern a message follow the person receiving
 * it, so a `.world` deployment serving Indian patients and a US deployment
 * serving American ones run the same code and reach different answers.
 *
 * This is why the module is no longer gated on TEFCA_ENABLED. An earlier cut
 * disabled itself on the international build, which had the effect of
 * shipping nothing to the market that needs it most.
 *
 *   GET  /policy                per-jurisdiction rules, and the instrument behind each
 *   GET  /languages             Eighth Schedule list vs what is actually translated
 *   GET  /templates             catalogue with tiers, languages and registration state
 *   GET  /journeys              cadences with the reasoning for each
 *   POST /journeys/plan         expand a journey against an anchor instant
 *   GET  /consent/:phone        consent state for one number
 *   POST /consent               record or revoke consent
 *   POST /inbound               process an inbound SMS (STOP/START/HELP)
 *   POST /preview               render a template without sending
 *   POST /send                  run the gate and dispatch over sms or whatsapp
 */

import type { Express, NextFunction, Request, Response } from "express";
import { z } from "zod";
import twilio from "twilio";
import { isAuthenticated } from "./replit_integrations/auth";
import { noStorePhi } from "./lib/middleware/no-store-phi";
import { logPhiAccess } from "./security/hipaa-audit";
import { PHI_TIER_ORDER, PURPOSE_CLASS, type Jurisdiction } from "@shared/engagement";
import {
  getConsent,
  grantConsent,
  handleInbound,
  normalizePhone,
  revokeConsent,
} from "./services/engagement/consent";
import { JOURNEYS, planJourney } from "./services/engagement/journeys";
import { TEMPLATES, renderTemplate } from "./services/engagement/templates";
import { dispatchSms, smsConfigured } from "./services/engagement/sms-channel";
import { dispatchWhatsApp, whatsAppConfigured } from "./services/engagement/whatsapp-channel";
import { policyFor } from "./services/engagement/jurisdictions";
import {
  isAllowedPortalUrl,
  isClinicStaff,
  parseInboundWebhook,
  twimlReply,
  verifyTwilioSignature,
} from "./services/engagement/inbound-auth";
import {
  EIGHTH_SCHEDULE_LANGUAGES,
  isValidNoticeLanguageIN,
} from "./services/engagement/languages";

/**
 * Clinic-staff guard. The predicate itself lives in `inbound-auth.ts` so it
 * can be tested; this is the express wrapper around it.
 */
function requireEngagementStaff(req: Request, res: Response, next: NextFunction) {
  const session = req.session as any;
  const caller = {
    userId: session?.userId || (req.user as any)?.id || (req.user as any)?.claims?.sub,
    role: session?.role,
    isProvider: session?.isProvider,
  };

  if (!caller.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (!isClinicStaff(caller)) {
    return res.status(403).json({
      error: "Clinic staff role required",
      detail:
        "Engagement messaging acts on a patient rather than for the caller, so it is " +
        "restricted to clinic staff. A signed-in patient account cannot enrol a number, " +
        "read another patient's consent, or send from the practice number.",
    });
  }

  next();
}

/** Rebuild the exact URL Twilio signed, honouring the proxy-facing host. */
function signedRequestUrl(req: Request): string {
  const proto = req.header("X-Forwarded-Proto") ?? req.protocol;
  const host = req.header("X-Forwarded-Host") ?? req.get("host") ?? "";
  return `${proto}://${host}${req.originalUrl}`;
}

function sessionUserId(req: Request): string {
  return (
    (req.session as any)?.userId ||
    (req.user as any)?.id ||
    (req.user as any)?.claims?.sub ||
    "unknown"
  );
}

const PURPOSES = [
  "appointment-reminder",
  "appointment-confirmation",
  "pre-visit-preparation",
  "post-visit-followup",
  "care-plan-checkin",
  "recall-reactivation",
  "consent-management",
] as const;

const recipientSchema = z.object({
  patientId: z.string().min(1),
  phone: z.string().min(7).max(20),
  languageCode: z.string().min(2).max(8).default("en"),
  timeZone: z.string().min(1).max(64).optional(),
  jurisdiction: z.enum(["US", "IN"]),
  lastInboundAt: z.string().optional(),
});

const variablesSchema = z.object({
  practiceName: z.string().min(1).max(80),
  providerName: z.string().max(80).optional(),
  appointmentTime: z.string().max(80).optional(),
  location: z.string().max(120).optional(),
  portalUrl: z.string().url().max(200).optional(),
});

const consentSchema = z.object({
  phone: z.string().min(7).max(20),
  action: z.enum(["grant", "revoke"]),
  purposes: z.array(z.enum(PURPOSES)).optional(),
  capturedVia: z
    .enum(["patient-portal", "intake-form", "verbal-documented", "sms-double-optin", "whatsapp-optin"])
    .optional(),
  /** DPDP: which notice was shown, in which language. */
  noticeLanguage: z.string().min(2).max(8).optional(),
  noticeVersion: z.string().max(40).optional(),
  jurisdiction: z.enum(["US", "IN"]).default("US"),
});

export function registerEngagementRoutes(app: Express): void {
  app.use("/api/engagement", noStorePhi);

  /**
   * The whole policy surface, per jurisdiction — what will and will not be
   * sent, over which channel, and which instrument says so. Published rather
   * than buried so a practice can audit the rules without reading the code.
   */
  app.get("/api/engagement/policy", (req: Request, res: Response) => {
    const requested = String(req.query.jurisdiction ?? "").toUpperCase();
    const scope: Jurisdiction[] =
      requested === "US" || requested === "IN" ? [requested as Jurisdiction] : ["US", "IN"];

    res.json({
      jurisdictions: scope.map((code) => {
        const policy = policyFor(code);
        return {
          jurisdiction: code,
          displayName: policy.displayName,
          legalBasis: policy.legalBasis,
          windows: policy.windows,
          purposeClasses: PURPOSE_CLASS,
          weeklyCap: policy.weeklyCap,
          requiresConsentNotice: policy.requiresConsentNotice,
          noticeLanguagePolicy: policy.noticeLanguagePolicy,
          channels: {
            sms: { ...policy.channels.sms, configured: smsConfigured() },
            whatsapp: { ...policy.channels.whatsapp, configured: whatsAppConfigured() },
            voice: { ...policy.channels.voice, configured: false },
          },
        };
      }),
      phiTiers: PHI_TIER_ORDER,
      refusals: [
        "A number with no consent record is refused — having the number is not consent.",
        "Revocation is global across purposes and permanent until a fresh opt-in.",
        "A template above the channel's PHI ceiling is refused, not truncated or redacted.",
        "India SMS without a registered DLT template id is refused — operators discard unregistered traffic, so a 'successful' send would never arrive.",
        "WhatsApp without an approved template is refused outside the 24-hour service window.",
        "In the US, WhatsApp carries no patient-specific content at all: Meta signs no BAA.",
        "In India, consent with no recorded notice is refused — the DPDP Act makes the notice part of what consent is.",
      ],
    });
  });

  /** The 22 Eighth Schedule languages, and what has actually been translated. */
  app.get("/api/engagement/languages", (_req: Request, res: Response) => {
    const translated = new Set<string>();
    for (const template of TEMPLATES) {
      for (const code of Object.keys(template.bodies)) translated.add(code);
    }

    res.json({
      eighthSchedule: EIGHTH_SCHEDULE_LANGUAGES.map((lang) => ({
        ...lang,
        validForNotice: true,
        templatesTranslated: translated.has(lang.code),
      })),
      translated: Array.from(translated).sort(),
      note:
        "Two different lists on purpose. The Eighth Schedule is what the DPDP Rules 2025 " +
        "permit a consent notice to be served in; the translated list is what this system " +
        "actually has copy for. A dropdown offering 22 languages that silently serves " +
        "English for most of them has not met the notice requirement.",
    });
  });

  app.get("/api/engagement/templates", (_req: Request, res: Response) => {
    res.json({
      templates: TEMPLATES.map((t) => ({
        id: t.id,
        purpose: t.purpose,
        tier: t.tier,
        requires: t.requires,
        languages: Object.keys(t.bodies),
        whatsappCategory: t.whatsappCategory,
        whatsappTemplateName: t.whatsappTemplateName ?? null,
        dltTemplateId: t.dltTemplateId ?? null,
      })),
      registration:
        "whatsappTemplateName and dltTemplateId are null until the deployment registers " +
        "with Meta and a TRAI DLT platform. Sends over a channel that requires one are " +
        "refused while it is null, rather than being discarded downstream where the " +
        "practice never sees the failure.",
      localisation:
        "Translations are hand-written, not machine-produced at send time. A language " +
        "without a translation falls back to English and the response says so — a " +
        "mistranslated appointment time is a missed appointment.",
    });
  });

  app.get("/api/engagement/journeys", (_req: Request, res: Response) => {
    res.json({ journeys: JOURNEYS });
  });

  app.post("/api/engagement/journeys/plan", requireEngagementStaff, (req: Request, res: Response) => {
    const parsed = z
      .object({ journeyId: z.string().min(1), anchorInstant: z.string().min(1) })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid plan request", details: parsed.error.issues });
    }
    const touches = planJourney(parsed.data.journeyId, parsed.data.anchorInstant);
    res.json({
      touches,
      note: "Touches already in the past are omitted. A reminder delivered after the fact is worse than none.",
    });
  });

  app.get("/api/engagement/consent/:phone", requireEngagementStaff, async (req: Request, res: Response) => {
    const normalized = normalizePhone(req.params.phone);
    if (!normalized) {
      return res.status(400).json({ error: "Not a usable phone number" });
    }
    res.json({ consent: await getConsent(normalized) });
  });

  app.post("/api/engagement/consent", requireEngagementStaff, async (req: Request, res: Response) => {
    const parsed = consentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid consent request", details: parsed.error.issues });
    }

    try {
      if (
        parsed.data.action === "grant" &&
        policyFor(parsed.data.jurisdiction).requiresConsentNotice
      ) {
        if (!parsed.data.noticeLanguage) {
          return res.status(400).json({
            error: "Consent notice required",
            detail:
              "Under the DPDP Act the notice is part of what makes consent valid. Record " +
              "which notice was shown and in which language.",
          });
        }
        if (parsed.data.jurisdiction === "IN" && !isValidNoticeLanguageIN(parsed.data.noticeLanguage)) {
          return res.status(400).json({
            error: "Notice language not permitted",
            detail:
              `"${parsed.data.noticeLanguage}" is neither English nor one of the 22 Eighth ` +
              "Schedule languages the DPDP Rules 2025 permit for a consent notice.",
          });
        }
      }

      const consent =
        parsed.data.action === "revoke"
          ? await revokeConsent({ phone: parsed.data.phone })
          : await grantConsent({
              phone: parsed.data.phone,
              purposes: parsed.data.purposes ?? [],
              capturedVia: parsed.data.capturedVia ?? "intake-form",
              noticeLanguage: parsed.data.noticeLanguage,
              noticeVersion: parsed.data.noticeVersion,
            });

      await logPhiAccess({
        userId: sessionUserId(req),
        resourceType: "engagement-consent",
        action: "write",
        details: `TCPA consent ${parsed.data.action} recorded`,
      }).catch(() => {});

      res.json({ consent });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  /**
   * Inbound SMS. Unauthenticated by necessity — this is the carrier webhook,
   * and a STOP that fails because a signature check was misconfigured is a
   * violation. Verify the Twilio signature at the edge in production.
   */
  app.post("/api/engagement/inbound", async (req: Request, res: Response) => {
    const signature = verifyTwilioSignature({
      signature: req.header("X-Twilio-Signature"),
      url: signedRequestUrl(req),
      params: (req.body ?? {}) as Record<string, unknown>,
    });
    if (!signature.ok) {
      return res.status(403).json({ error: "Webhook signature verification failed", detail: signature.detail });
    }

    // Twilio posts form-encoded From/Body, not JSON phone/body. Parsing the
    // real carrier shape rather than a convenient one is the difference
    // between a STOP that revokes and a STOP that 400s after the signature
    // check and leaves consent granted.
    const payload = parseInboundWebhook(req.body);
    if (!payload.ok) {
      return res.status(400).json({ error: "Invalid inbound payload", detail: payload.detail });
    }

    const result = await handleInbound({
      phone: payload.phone,
      body: payload.body,
      practiceName: process.env.PRACTICE_DISPLAY_NAME ?? "Your clinic",
    });

    // Reply in TwiML — Twilio does not read a JSON body, so a confirmation
    // returned as JSON is a confirmation the patient never receives.
    res.set("Content-Type", "text/xml").send(twimlReply(result.autoReply));
  });

  app.post("/api/engagement/preview", requireEngagementStaff, (req: Request, res: Response) => {
    const parsed = z
      .object({
        templateId: z.string().min(1),
        languageCode: z.string().min(2).max(8).default("en"),
        variables: variablesSchema,
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid preview request", details: parsed.error.issues });
    }
    if (!isAllowedPortalUrl(parsed.data.variables.portalUrl)) {
      return res.status(400).json({
        error: "portalUrl not allowed",
        detail:
          "Template links must point at an https origin listed in PATIENT_PORTAL_ORIGINS. " +
          "An arbitrary URL in a clinic-branded message from the practice number is an " +
          "SMS phishing primitive, so an unset allow-list refuses rather than permits.",
      });
    }

    res.json(renderTemplate(parsed.data.templateId, parsed.data.languageCode, parsed.data.variables));
  });

  app.post("/api/engagement/send", requireEngagementStaff, async (req: Request, res: Response) => {
    const parsed = z
      .object({
        recipient: recipientSchema,
        templateId: z.string().min(1),
        variables: variablesSchema,
        channel: z.enum(["sms", "whatsapp"]).default("sms"),
        dryRun: z.boolean().default(false),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid send request", details: parsed.error.issues });
    }

    if (!isAllowedPortalUrl(parsed.data.variables.portalUrl)) {
      return res.status(400).json({
        error: "portalUrl not allowed",
        detail:
          "Template links must point at an https origin listed in PATIENT_PORTAL_ORIGINS. " +
          "An arbitrary URL in a clinic-branded message from the practice number is an " +
          "SMS phishing primitive, so an unset allow-list refuses rather than permits.",
      });
    }

    await logPhiAccess({
      userId: sessionUserId(req),
      patientId: parsed.data.recipient.patientId,
      resourceType: "engagement-message",
      action: "read",
      details:
        `Engagement send evaluated: template=${parsed.data.templateId} ` +
        `channel=${parsed.data.channel} jurisdiction=${parsed.data.recipient.jurisdiction} ` +
        `dryRun=${parsed.data.dryRun}`,
    }).catch(() => {});

    const result =
      parsed.data.channel === "whatsapp"
        ? dispatchWhatsApp({
            recipient: parsed.data.recipient,
            templateId: parsed.data.templateId,
            variables: parsed.data.variables,
          })
        : await dispatchSms({
            recipient: parsed.data.recipient,
            templateId: parsed.data.templateId,
            variables: parsed.data.variables,
            sentBy: sessionUserId(req),
            dryRun: parsed.data.dryRun,
          });

    res.json(result);
  });

  console.log("[Routes] Patient engagement routes registered at /api/engagement/*");
}
