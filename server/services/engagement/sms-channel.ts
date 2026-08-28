/**
 * SMS channel — binds the engagement engine to the existing Twilio sender.
 *
 * Nothing here decides whether a message may go out; that is the gate's job.
 * This module renders, asks the gate, and either sends or reports the refusal
 * unchanged. Keeping the two apart means the gate can be tested without
 * Twilio credentials and the sender cannot accidentally grow a bypass.
 */

import type {
  EngagementMessage,
  EngagementRecipient,
  SendDecision,
} from "@shared/engagement";
import type { SmsCategory } from "@shared/schema";
import { sendSms } from "../../sms-service";
import { evaluateSend, recordSend } from "./send-gate";
import { findTemplate, renderTemplate, type TemplateVariables } from "./templates";

/**
 * Engagement purpose -> the SMS audit category the existing sender records.
 *
 * Kept explicit rather than defaulting, so a new purpose has to be
 * categorised deliberately instead of landing in "general" and disappearing
 * from whatever report someone runs on categories later.
 */
const PURPOSE_CATEGORY: Record<EngagementMessage["purpose"], SmsCategory> = {
  "appointment-reminder": "appointment_reminder",
  "appointment-confirmation": "appointment_reminder",
  "pre-visit-preparation": "appointment_reminder",
  "post-visit-followup": "care_follow_up",
  "care-plan-checkin": "care_follow_up",
  "recall-reactivation": "care_follow_up",
  "consent-management": "general",
  // Not "lab_result": the message carries a link, and the summary behind it
  // is a record the patient already holds, not a new clinical finding.
  "record-share": "general",
};

/**
 * TRAI DLT template ids, from `DLT_TEMPLATE_IDS` as `internalId=dltId` pairs.
 *
 * Empty is correct for a deployment that has not registered on a DLT
 * platform. What is not correct is sending anyway: Indian operators discard
 * unregistered traffic, so the message would report success and never arrive.
 */
function dltRegistry(): Map<string, string> {
  const raw = process.env.DLT_TEMPLATE_IDS;
  const map = new Map<string, string>();
  if (!raw) return map;
  for (const pair of raw.split(",")) {
    const [id, dlt] = pair.split("=").map((p) => p.trim());
    if (id && dlt) map.set(id, dlt);
  }
  return map;
}

export function smsConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER,
  );
}

export type DispatchResult =
  | { status: "sent"; messageId: string; body: string; languageUsed: string; fellBackToEnglish: boolean }
  | { status: "deferred"; sendAfter: string; detail: string }
  | { status: "refused"; reason: string; detail: string }
  | { status: "send-failed"; detail: string };

/**
 * Render one template for one recipient and dispatch it over SMS.
 *
 * `dryRun` runs every check and returns what would have happened without
 * touching Twilio — the mode a practice should use before its first campaign,
 * because it surfaces the missing-consent and missing-timezone rows while
 * they are still fixable.
 */
export async function dispatchSms(params: {
  recipient: EngagementRecipient;
  templateId: string;
  variables: TemplateVariables;
  sentBy: string;
  dryRun?: boolean;
  now?: Date;
}): Promise<DispatchResult> {
  const template = findTemplate(params.templateId);
  if (!template) {
    return { status: "refused", reason: "unknown-template", detail: `No template "${params.templateId}".` };
  }

  const rendered = renderTemplate(params.templateId, params.recipient.languageCode, params.variables);
  if (rendered.status === "failed") {
    return { status: "refused", reason: rendered.reason, detail: rendered.detail };
  }

  const message: EngagementMessage = {
    templateId: template.id,
    purpose: template.purpose,
    tier: template.tier,
    body: rendered.body,
  };

  // India SMS needs a registered DLT template id; the US does not. Passing it
  // unconditionally lets the jurisdiction policy decide whether it matters.
  const dltId = template.dltTemplateId ?? dltRegistry().get(template.id);

  const decision: SendDecision = evaluateSend(params.recipient, message, {
    channel: "sms",
    registeredTemplateId: dltId,
    // A dry run must not be blocked by missing credentials — the whole point
    // is to check consent and timing before the account is wired up.
    channelConfigured: params.dryRun ? true : smsConfigured(),
    now: params.now,
  });

  if (decision.status === "refused") {
    return { status: "refused", reason: decision.reason, detail: decision.detail };
  }
  if (decision.status === "deferred") {
    return { status: "deferred", sendAfter: decision.sendAfter, detail: decision.detail };
  }

  if (params.dryRun) {
    return {
      status: "sent",
      messageId: "dry-run",
      body: decision.body,
      languageUsed: rendered.languageUsed,
      fellBackToEnglish: rendered.fellBackToEnglish,
    };
  }

  const sent = await sendSms({
    to: params.recipient.phone,
    body: decision.body,
    category: PURPOSE_CATEGORY[message.purpose],
    patientId: params.recipient.patientId,
    sentBy: params.sentBy,
  });

  if (sent.status === "failed") {
    return { status: "send-failed", detail: sent.errorMessage ?? "Twilio rejected the message." };
  }

  recordSend(params.recipient.phone, params.now);

  return {
    status: "sent",
    messageId: sent.id,
    body: decision.body,
    languageUsed: rendered.languageUsed,
    fellBackToEnglish: rendered.fellBackToEnglish,
  };
}
