/**
 * WhatsApp channel.
 *
 * India's primary patient channel, and the one whose rules are most often
 * assumed rather than read. Three corrections this module encodes:
 *
 *   1. **WhatsApp is outside TRAI DLT.** DLT registration attaches to telecom
 *      resources — numbering, SMS routes, voice. WhatsApp Business API traffic
 *      is data-channel on Meta's platform, so there is no DLT step. Applying
 *      one is harmless bureaucracy; assuming DLT *covers* WhatsApp is not,
 *      because it leaves Meta's actual requirements unimplemented.
 *
 *   2. **Meta's template approval is the real gate.** Outside the 24-hour
 *      service window, only an approved template may be sent, and its
 *      category — utility, marketing, authentication — determines price and
 *      whether review passes at all.
 *
 *   3. **The 24-hour service window is opened by the patient, not the clinic.**
 *      Free-form replies are permitted only within 24 hours of the patient's
 *      last inbound message.
 *
 * On top of Meta's rules sits the jurisdiction's own PHI ceiling, and this is
 * where US and India genuinely diverge. Meta signs no BAA, so in the US
 * nothing patient-specific may cross WhatsApp — not even that an appointment
 * exists. India has no BAA construct; the DPDP obligation runs to the Data
 * Fiduciary directly, so appointment logistics are permissible with consent.
 * The same template is therefore sendable in Mumbai and refused in Chicago,
 * which is the correct behaviour and not a bug.
 *
 * No transport is wired. `dispatchWhatsApp` evaluates every gate and returns
 * what would happen; a deployment supplies a BSP client and calls `send`.
 */

import type {
  EngagementMessage,
  EngagementRecipient,
  SendDecision,
} from "@shared/engagement";
import { evaluateSend } from "./send-gate";
import { getConsent } from "./consent";
import { channelPolicy } from "./jurisdictions";
import { findTemplate, renderTemplate, type TemplateVariables } from "./templates";

export function whatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
}

/**
 * Approved template names, keyed by internal template id.
 *
 * Populated from `WHATSAPP_APPROVED_TEMPLATES` as `internalId=approved_name`
 * pairs. Empty is the honest default for a deployment that has not been
 * through Meta review — and the gate refuses rather than letting the send
 * fail at Meta with a message the practice never sees.
 */
function approvedTemplates(): Map<string, string> {
  const raw = process.env.WHATSAPP_APPROVED_TEMPLATES;
  const map = new Map<string, string>();
  if (!raw) return map;
  for (const pair of raw.split(",")) {
    const [id, name] = pair.split("=").map((p) => p.trim());
    if (id && name) map.set(id, name);
  }
  return map;
}

export type WhatsAppDispatch =
  | {
      status: "would-send";
      templateName: string | null;
      category: string;
      body: string;
      languageUsed: string;
      fellBackToEnglish: boolean;
      note: string;
    }
  | { status: "deferred"; sendAfter: string; detail: string }
  | { status: "refused"; reason: string; detail: string };

/**
 * Evaluate a WhatsApp send end to end without transmitting.
 *
 * Returns `would-send` rather than `sent` because no BSP transport is wired.
 * Naming it honestly keeps a caller from believing a message went out.
 */
export async function dispatchWhatsApp(params: {
  recipient: EngagementRecipient;
  templateId: string;
  variables: TemplateVariables;
  now?: Date;
}): Promise<WhatsAppDispatch> {
  const template = findTemplate(params.templateId);
  if (!template) {
    return { status: "refused", reason: "unknown-template", detail: `No template "${params.templateId}".` };
  }

  const rendered = renderTemplate(params.templateId, params.recipient.languageCode, params.variables);
  if (rendered.status === "failed") {
    return { status: "refused", reason: rendered.reason, detail: rendered.detail };
  }

  const registeredName =
    template.whatsappTemplateName ?? approvedTemplates().get(template.id) ?? undefined;

  const message: EngagementMessage = {
    templateId: template.id,
    purpose: template.purpose,
    tier: template.tier,
    body: rendered.body,
  };

  // Consent is read here rather than inside the gate so the gate stays a
  // pure function of its inputs. It lives in Postgres now: a process-local
  // copy meant a STOP landed on one instance out of ten.
  const consent = await getConsent(params.recipient.phone);

  const decision: SendDecision = evaluateSend(params.recipient, message, {
    consent,
    channel: "whatsapp",
    channelConfigured: whatsAppConfigured(),
    registeredTemplateId: registeredName,
    now: params.now,
  });

  if (decision.status === "refused") {
    return { status: "refused", reason: decision.reason, detail: decision.detail };
  }
  if (decision.status === "deferred") {
    return { status: "deferred", sendAfter: decision.sendAfter, detail: decision.detail };
  }

  const policy = channelPolicy(params.recipient.jurisdiction, "whatsapp");

  return {
    status: "would-send",
    templateName: registeredName ?? null,
    category: template.whatsappCategory,
    body: decision.body,
    languageUsed: rendered.languageUsed,
    fellBackToEnglish: rendered.fellBackToEnglish,
    note:
      "Evaluated only — no BSP transport is wired, so nothing was transmitted. " +
      `Channel ceiling in this jurisdiction: ${policy.phiCeiling}.`,
  };
}
