/**
 * Patient engagement API — mounted at /api/engagement.
 *
 * US only, gated on TEFCA_ENABLED. Not because engagement is a US idea, but
 * because everything enforced here is US law: TCPA consent and quiet hours,
 * and a HIPAA minimum-necessary content ceiling. Shipping these rules to a
 * jurisdiction they do not apply to would be worse than shipping nothing —
 * it would look like compliance while enforcing the wrong statute.
 *
 *   GET  /policy                what this system will and will not send, and why
 *   GET  /templates             the template catalogue with tiers and languages
 *   GET  /journeys              cadences with the reasoning for each
 *   POST /journeys/plan         expand a journey against an anchor instant
 *   GET  /consent/:phone        consent state for one number
 *   POST /consent               record or revoke consent
 *   POST /inbound               process an inbound SMS (STOP/START/HELP)
 *   POST /preview               render a template without sending
 *   POST /send                  run the gate and dispatch (dryRun supported)
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "./replit_integrations/auth";
import { noStorePhi } from "./lib/middleware/no-store-phi";
import { logPhiAccess } from "./security/hipaa-audit";
import { CHANNEL_PHI_CEILING, PHI_TIER_ORDER } from "@shared/engagement";
import {
  getConsent,
  grantConsent,
  handleInbound,
  normalizePhone,
  revokeConsent,
} from "./services/engagement/consent";
import { JOURNEYS, planJourney } from "./services/engagement/journeys";
import { TEMPLATES, renderTemplate } from "./services/engagement/templates";
import { WEEKLY_MESSAGE_CAP } from "./services/engagement/send-gate";
import { QUIET_HOURS_END_HOUR, QUIET_HOURS_START_HOUR } from "./services/engagement/quiet-hours";
import { dispatchSms, smsConfigured } from "./services/engagement/sms-channel";

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
  capturedVia: z.enum(["patient-portal", "intake-form", "verbal-documented", "sms-double-optin"]).optional(),
});

export function registerEngagementRoutes(app: Express): void {
  const usOnly = process.env.TEFCA_ENABLED !== "false";
  if (!usOnly) {
    console.log(
      "[Engagement] TEFCA_ENABLED=false — patient engagement endpoints disabled. " +
        "The consent and quiet-hours rules enforced here are US statute (TCPA/HIPAA) " +
        "and must not be presented as compliance in another jurisdiction.",
    );
    return;
  }

  app.use("/api/engagement", noStorePhi);

  app.get("/api/engagement/policy", (_req: Request, res: Response) => {
    res.json({
      jurisdiction: "US",
      channels: {
        sms: { configured: smsConfigured(), phiCeiling: CHANNEL_PHI_CEILING.sms },
        voice: { configured: false, phiCeiling: CHANNEL_PHI_CEILING.voice, note: "Declared, not yet wired." },
      },
      phiTiers: PHI_TIER_ORDER,
      quietHours: {
        startHour: QUIET_HOURS_START_HOUR,
        endHour: QUIET_HOURS_END_HOUR,
        basis: "recipient local time",
        unknownTimezone: "refused, never assumed from the practice's own timezone",
      },
      frequencyCap: { messagesPerRollingWeek: WEEKLY_MESSAGE_CAP },
      refusals: [
        "A number with no consent record is refused — having the number is not consent.",
        "Revocation is global across purposes and permanent until a fresh opt-in.",
        "A template above the channel's PHI ceiling is refused, not truncated or redacted.",
        "No clinical content over SMS: results, diagnoses and medications live behind the portal login.",
      ],
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
      })),
      localisation:
        "Translations are hand-written, not machine-produced at send time. A language " +
        "without a translation falls back to English and the response says so — a " +
        "mistranslated appointment time is a missed appointment.",
    });
  });

  app.get("/api/engagement/journeys", (_req: Request, res: Response) => {
    res.json({ journeys: JOURNEYS });
  });

  app.post("/api/engagement/journeys/plan", isAuthenticated, (req: Request, res: Response) => {
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

  app.get("/api/engagement/consent/:phone", isAuthenticated, (req: Request, res: Response) => {
    const normalized = normalizePhone(req.params.phone);
    if (!normalized) {
      return res.status(400).json({ error: "Not a usable phone number" });
    }
    res.json({ consent: getConsent(normalized) });
  });

  app.post("/api/engagement/consent", isAuthenticated, async (req: Request, res: Response) => {
    const parsed = consentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid consent request", details: parsed.error.issues });
    }

    try {
      const consent =
        parsed.data.action === "revoke"
          ? revokeConsent({ phone: parsed.data.phone })
          : grantConsent({
              phone: parsed.data.phone,
              purposes: parsed.data.purposes ?? [],
              capturedVia: parsed.data.capturedVia ?? "intake-form",
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
  app.post("/api/engagement/inbound", (req: Request, res: Response) => {
    const parsed = z
      .object({
        phone: z.string().min(7).max(20),
        body: z.string().max(1600),
        practiceName: z.string().min(1).max(80).default("Your clinic"),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid inbound payload", details: parsed.error.issues });
    }

    const result = handleInbound(parsed.data);
    res.json(result);
  });

  app.post("/api/engagement/preview", isAuthenticated, (req: Request, res: Response) => {
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
    res.json(renderTemplate(parsed.data.templateId, parsed.data.languageCode, parsed.data.variables));
  });

  app.post("/api/engagement/send", isAuthenticated, async (req: Request, res: Response) => {
    const parsed = z
      .object({
        recipient: recipientSchema,
        templateId: z.string().min(1),
        variables: variablesSchema,
        dryRun: z.boolean().default(false),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid send request", details: parsed.error.issues });
    }

    await logPhiAccess({
      userId: sessionUserId(req),
      patientId: parsed.data.recipient.patientId,
      resourceType: "engagement-message",
      action: "read",
      details: `Engagement send evaluated: template=${parsed.data.templateId} dryRun=${parsed.data.dryRun}`,
    }).catch(() => {});

    const result = await dispatchSms({
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
