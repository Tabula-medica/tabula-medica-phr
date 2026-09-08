import { describe, it, expect, beforeEach } from "vitest";
import {
  classifyInbound,
  getConsent,
  grantConsent,
  handleInbound,
  normalizePhone,
  resetConsentRegistry,
  revokeConsent,
} from "../server/services/engagement/consent";
import {
  checkQuietHours,
  localHourIn,
  QUIET_HOURS_END_HOUR,
  QUIET_HOURS_START_HOUR,
} from "../server/services/engagement/quiet-hours";
import { renderTemplate, TEMPLATES } from "../server/services/engagement/templates";
import {
  evaluateSend,
  recordSend,
  resetSendHistory,
  WEEKLY_MESSAGE_CAP,
} from "../server/services/engagement/send-gate";
import { JOURNEYS, planJourney } from "../server/services/engagement/journeys";
import { dispatchWhatsApp } from "../server/services/engagement/whatsapp-channel";
import { channelPolicy, policyFor } from "../server/services/engagement/jurisdictions";
import {
  EIGHTH_SCHEDULE_LANGUAGES,
  isRtl,
  isValidNoticeLanguageIN,
} from "../server/services/engagement/languages";
import {
  isAllowedPortalUrl,
  isClinicStaff,
  parseInboundWebhook,
  portalOriginAllowList,
  twimlReply,
  verifyTwilioSignature,
} from "../server/services/engagement/inbound-auth";
import type { EngagementMessage, EngagementRecipient } from "@shared/engagement";

const PHONE = "+14155550100";

/**
 * What the dispatchers do: read consent, then run the pure gate.
 *
 * `evaluateSend` no longer looks consent up itself — consent lives in
 * Postgres now, because a process-local copy meant a STOP reached one Cloud
 * Run instance out of ten. Keeping the gate pure is what let that move happen
 * without making the gate async.
 */
async function gate(
  recipient: EngagementRecipient,
  message: EngagementMessage,
  context: Omit<Parameters<typeof evaluateSend>[2], "consent">,
) {
  return evaluateSend(recipient, message, {
    ...context,
    consent: await getConsent(recipient.phone),
  });
}
const US_WINDOW = { startHour: QUIET_HOURS_START_HOUR, endHour: QUIET_HOURS_END_HOUR };

function recipient(overrides: Partial<EngagementRecipient> = {}): EngagementRecipient {
  return {
    patientId: "p-1",
    phone: PHONE,
    languageCode: "en",
    timeZone: "America/Los_Angeles",
    jurisdiction: "US",
    ...overrides,
  };
}

function indianRecipient(overrides: Partial<EngagementRecipient> = {}): EngagementRecipient {
  return {
    patientId: "p-in",
    phone: "+919876543210",
    languageCode: "hi",
    timeZone: "Asia/Kolkata",
    jurisdiction: "IN",
    ...overrides,
  };
}

/** Grant with a DPDP notice recorded — the shape India requires. */
async function grantIN(purposes: EngagementMessage["purpose"][], noticeLanguage = "hi") {
  return grantConsent({
    phone: "+919876543210",
    purposes,
    capturedVia: "whatsapp-optin",
    noticeLanguage,
    noticeVersion: "v1",
  });
}

function message(overrides: Partial<EngagementMessage> = {}): EngagementMessage {
  return {
    templateId: "appointment-reminder",
    purpose: "appointment-reminder",
    tier: "appointment-logistics",
    body: "Reminder.",
    ...overrides,
  };
}

/** 14:00 Pacific — comfortably inside the US window. */
const MIDDAY_PT = new Date("2026-09-01T21:00:00.000Z");
/**
 * 12:00 in Kolkata. A separate instant on purpose: 21:00 UTC is midday in
 * Los Angeles and 02:30 the next morning in India, which is exactly the
 * mistake the per-recipient timezone check exists to catch.
 */
const MIDDAY_IST = new Date("2026-09-01T06:30:00.000Z");

beforeEach(() => {
  resetConsentRegistry();
  resetSendHistory();
});

describe("phone normalisation", () => {
  it("accepts the shapes a front desk actually types", async () => {
    expect(normalizePhone("415-555-0100")).toBe(PHONE);
    expect(normalizePhone("(415) 555 0100")).toBe(PHONE);
    expect(normalizePhone("14155550100")).toBe(PHONE);
    expect(normalizePhone("+1 415 555 0100")).toBe(PHONE);
  });

  it("refuses what it cannot turn into E.164 rather than guessing", async () => {
    expect(normalizePhone("555-0100")).toBeNull();
    expect(normalizePhone("not a phone")).toBeNull();
  });
});

describe("inbound classification", () => {
  it("recognises the CTIA stop keywords in any casing or punctuation", async () => {
    for (const word of ["STOP", "stop.", "Unsubscribe", "QUIT", "opt-out"]) {
      expect(classifyInbound(word)).toBe("revoke");
    }
  });

  it("reads free-text stop requests as a possible revoke", async () => {
    expect(classifyInbound("please stop texting me")).toBe("possible-revoke");
    expect(classifyInbound("take me off this list")).toBe("possible-revoke");
    expect(classifyInbound("dont text me")).toBe("possible-revoke");
  });

  it("does not read ordinary replies as a revoke", async () => {
    // The failure this guards: a patient answering a reminder gets silently
    // unsubscribed because their reply happened to contain "stop".
    expect(classifyInbound("I'll stop by the front desk at 3")).toBe("other");
    expect(classifyInbound("I had to cancel my ride, still coming")).toBe("other");
    expect(classifyInbound("C")).toBe("other");
  });
});

describe("consent", () => {
  it("treats an unrecorded number as unknown, not as permission", async () => {
    expect((await getConsent(PHONE)).state).toBe("unknown");
  });

  it("revokes globally across purposes, not just the campaign that prompted it", async () => {
    await grantConsent({
      phone: PHONE,
      purposes: ["appointment-reminder", "recall-reactivation"],
      capturedVia: "intake-form",
    });
    await handleInbound({ phone: PHONE, body: "STOP", practiceName: "Clinic" });

    const after = await getConsent(PHONE);
    expect(after.state).toBe("revoked");
    expect(after.purposes).toEqual([]);
  });

  it("revokes on a free-text stop AND flags it for a human", async () => {
    await grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    const result = await handleInbound({ phone: PHONE, body: "please stop texting me", practiceName: "Clinic" });

    expect(result.consent.state).toBe("revoked");
    expect(result.needsStaffReview).toBe(true);
  });

  it("answers HELP without changing consent state", async () => {
    await grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    const result = await handleInbound({ phone: PHONE, body: "HELP", practiceName: "Clinic" });

    expect(result.autoReply).toContain("STOP");
    expect(result.consent.state).toBe("granted");
  });

  it("routes a real patient reply to a human instead of auto-answering", async () => {
    await grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    const result = await handleInbound({ phone: PHONE, body: "is my blood pressure ok?", practiceName: "Clinic" });

    expect(result.autoReply).toBeNull();
    expect(result.needsStaffReview).toBe(true);
  });

  it("restores only the baseline purposes on START", async () => {
    await grantConsent({ phone: PHONE, purposes: ["recall-reactivation"], capturedVia: "intake-form" });
    await revokeConsent({ phone: PHONE });
    const result = await handleInbound({ phone: PHONE, body: "START", practiceName: "Clinic" });

    expect(result.consent.state).toBe("granted");
    expect(result.consent.purposes).toContain("appointment-reminder");
    expect(result.consent.purposes).not.toContain("recall-reactivation");
  });
});

describe("quiet hours", () => {
  it("reads the recipient's local hour, not the server's", async () => {
    // 21:00 UTC is 14:00 in Los Angeles and 06:00 the next day in Tokyo.
    expect(localHourIn("America/Los_Angeles", MIDDAY_PT)).toBe(14);
    expect(localHourIn("Asia/Tokyo", MIDDAY_PT)).toBe(6);
  });

  it("allows a send inside the window", async () => {
    expect(checkQuietHours("America/Los_Angeles", US_WINDOW, MIDDAY_PT)).toMatchObject({
      status: "allowed",
    });
  });

  it("defers rather than refusing when it is merely too early", async () => {
    // 06:00 Pacific — before the window opens.
    const early = new Date("2026-09-01T13:00:00.000Z");
    const verdict = checkQuietHours("America/Los_Angeles", US_WINDOW, early);
    expect(verdict.status).toBe("deferred");
    if (verdict.status === "deferred") {
      expect(localHourIn("America/Los_Angeles", new Date(verdict.sendAfter))).toBeGreaterThanOrEqual(
        QUIET_HOURS_START_HOUR,
      );
      expect(localHourIn("America/Los_Angeles", new Date(verdict.sendAfter))).toBeLessThan(
        QUIET_HOURS_END_HOUR,
      );
    }
  });

  it("reports an unknown timezone rather than substituting one", async () => {
    expect(checkQuietHours(undefined, US_WINDOW, MIDDAY_PT)).toEqual({ status: "unknown-timezone" });
    expect(checkQuietHours("Mars/Olympus_Mons", US_WINDOW, MIDDAY_PT)).toEqual({
      status: "unknown-timezone",
    });
  });
});

describe("templates", () => {
  it("never ships a template whose tier exceeds what SMS may carry", async () => {
    // The structural guarantee: no clinical detail can reach an SMS body,
    // because no template is classified that way in the first place.
    for (const template of TEMPLATES) {
      expect(template.tier).not.toBe("clinical-detail");
    }
  });

  it("appends the STOP notice in the language the body was rendered in", async () => {
    const result = renderTemplate("appointment-reminder", "es", {
      practiceName: "Clínica",
      appointmentTime: "3 de septiembre a las 10:00",
    });
    expect(result.status).toBe("rendered");
    if (result.status === "rendered") {
      expect(result.body).toContain("Responda STOP");
      expect(result.fellBackToEnglish).toBe(false);
    }
  });

  it("falls back to English and says so, rather than machine-translating", async () => {
    const result = renderTemplate("appointment-reminder", "is", {
      practiceName: "Clinic",
      appointmentTime: "Sept 3 at 10:00",
    });
    expect(result.status).toBe("rendered");
    if (result.status === "rendered") {
      expect(result.fellBackToEnglish).toBe(true);
      expect(result.languageUsed).toBe("en");
    }
  });

  it("refuses to send a body with an unfilled placeholder", async () => {
    // A patient receiving "your appointment on {{appointmentTime}}" is worse
    // than a patient receiving nothing.
    const result = renderTemplate("appointment-reminder", "en", { practiceName: "Clinic" });
    expect(result).toMatchObject({ status: "failed", reason: "missing-variables" });
  });

  it("keeps preparation instructions behind the portal rather than in the text", async () => {
    const result = renderTemplate("pre-visit-preparation", "en", {
      practiceName: "Clinic",
      appointmentTime: "Sept 3 at 10:00",
      portalUrl: "https://example.org/portal",
    });
    expect(result.status).toBe("rendered");
    if (result.status === "rendered") {
      expect(result.body).toContain("https://example.org/portal");
      expect(result.body).not.toMatch(/fast|medication|stop taking/i);
    }
  });
});

describe("send gate", () => {
  const context = { channel: "sms" as const, channelConfigured: true, now: MIDDAY_PT };

  it("refuses when no consent is on file", async () => {
    expect(await gate(recipient(), message(), context)).toMatchObject({
      status: "refused",
      reason: "no-consent",
    });
  });

  it("refuses after revocation, permanently", async () => {
    await grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    await revokeConsent({ phone: PHONE });
    expect(await gate(recipient(), message(), context)).toMatchObject({
      status: "refused",
      reason: "consent-revoked",
    });
  });

  it("refuses a purpose the patient did not consent to", async () => {
    await grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    expect(
      await gate(recipient(), message({ purpose: "recall-reactivation" }), context),
    ).toMatchObject({ status: "refused", reason: "purpose-not-consented" });
  });

  it("refuses clinical detail over SMS rather than truncating it", async () => {
    await grantConsent({ phone: PHONE, purposes: ["post-visit-followup"], capturedVia: "intake-form" });
    const result = await gate(
      recipient(),
      message({ purpose: "post-visit-followup", tier: "clinical-detail", body: "Your A1c is 9.2." }),
      context,
    );
    expect(result).toMatchObject({ status: "refused", reason: "phi-tier-exceeds-channel" });
    expect(channelPolicy("US", "sms").phiCeiling).toBe("appointment-logistics");
  });

  it("refuses when the timezone is unknown instead of assuming the practice's", async () => {
    await grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    expect(
      await gate(recipient({ timeZone: undefined }), message(), context),
    ).toMatchObject({ status: "refused", reason: "unknown-timezone" });
  });

  it("defers outside quiet hours, and hands back when the window opens", async () => {
    await grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    const early = new Date("2026-09-01T13:00:00.000Z"); // 06:00 PT
    const result = await gate(recipient(), message(), { ...context, now: early });
    expect(result.status).toBe("deferred");
    if (result.status === "deferred") {
      expect(Date.parse(result.sendAfter)).toBeGreaterThan(early.getTime());
    }
  });

  it("caps the weekly volume, exempting replies the patient triggered", async () => {
    await grantConsent({
      phone: PHONE,
      purposes: ["appointment-reminder", "appointment-confirmation"],
      capturedVia: "intake-form",
    });
    for (let i = 0; i < WEEKLY_MESSAGE_CAP; i++) recordSend(PHONE, MIDDAY_PT);

    expect(await gate(recipient(), message(), context)).toMatchObject({
      status: "refused",
      reason: "frequency-cap",
    });
    expect(
      await gate(recipient(), message({ purpose: "appointment-confirmation" }), context),
    ).toMatchObject({ status: "send" });
  });

  it("reports a missing channel rather than silently dropping the message", async () => {
    await grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    expect(
      await gate(recipient(), message(), { ...context, channelConfigured: false }),
    ).toMatchObject({ status: "refused", reason: "channel-not-configured" });
  });

  it("sends when every gate passes", async () => {
    await grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    expect(await gate(recipient(), message(), context)).toMatchObject({ status: "send" });
  });
});

describe("journeys", () => {
  it("keeps appointment reminders to two touches", async () => {
    const journey = JOURNEYS.find((j) => j.id === "appointment-reminders");
    expect(journey?.steps).toHaveLength(2);
  });

  it("drops touches whose time has already passed", async () => {
    // A "reminder" for a visit starting in 20 minutes, fired because a job
    // backed up, is worse than silence.
    const anchor = "2026-09-01T21:00:00.000Z";
    const now = new Date("2026-09-01T20:40:00.000Z");
    expect(planJourney("appointment-reminders", anchor, now)).toEqual([]);
  });

  it("orders touches earliest first", async () => {
    const anchor = "2026-12-01T17:00:00.000Z";
    const touches = planJourney("appointment-reminders", anchor, new Date("2026-09-01T00:00:00.000Z"));
    expect(touches).toHaveLength(2);
    expect(Date.parse(touches[0].dueAt)).toBeLessThan(Date.parse(touches[1].dueAt));
  });

  it("returns nothing for an unknown journey rather than throwing", async () => {
    expect(planJourney("no-such-journey", "2026-12-01T17:00:00.000Z")).toEqual([]);
  });
});


describe("jurisdiction policy", () => {
  it("refuses any patient-specific content over WhatsApp in the US", async () => {
    // Meta signs no BAA, so in a HIPAA jurisdiction even "you have an
    // appointment on Tuesday" is a disclosure that cannot cross the channel.
    expect(channelPolicy("US", "whatsapp").phiCeiling).toBe("none");
  });

  it("permits appointment logistics over WhatsApp in India", async () => {
    // No BAA construct exists under DPDP; the duty runs to the Data Fiduciary
    // directly, so the same template is sendable here and refused in the US.
    expect(channelPolicy("IN", "whatsapp").phiCeiling).toBe("appointment-logistics");
  });

  it("requires a registered template for India SMS but not US SMS", async () => {
    expect(channelPolicy("IN", "sms").requiresRegisteredTemplate).toBe(true);
    expect(channelPolicy("US", "sms").requiresRegisteredTemplate).toBe(false);
  });

  it("applies a tighter clock to promotional traffic in India", async () => {
    const india = policyFor("IN");
    expect(india.windows.promotional).toEqual({ startHour: 9, endHour: 21 });
    expect(india.windows.transactional.startHour).toBeLessThan(
      india.windows.promotional.startHour,
    );
  });

  it("requires a consent notice in India and not in the US", async () => {
    expect(policyFor("IN").requiresConsentNotice).toBe(true);
    expect(policyFor("US").requiresConsentNotice).toBe(false);
  });
});

describe("Eighth Schedule languages", () => {
  it("carries all 22 constitutional languages", async () => {
    expect(EIGHTH_SCHEDULE_LANGUAGES).toHaveLength(22);
  });

  it("accepts English and Eighth Schedule codes for a DPDP notice", async () => {
    expect(isValidNoticeLanguageIN("en")).toBe(true);
    expect(isValidNoticeLanguageIN("ta")).toBe(true);
    expect(isValidNoticeLanguageIN("sat")).toBe(true); // Santali, no 639-1 code
    expect(isValidNoticeLanguageIN("hi-IN")).toBe(true);
  });

  it("rejects a language the DPDP Rules do not permit for a notice", async () => {
    expect(isValidNoticeLanguageIN("fr")).toBe(false);
    expect(isValidNoticeLanguageIN("zh")).toBe(false);
  });

  it("flags the right-to-left scripts among them", async () => {
    expect(isRtl("ur")).toBe(true);
    expect(isRtl("ta")).toBe(false);
  });
});

describe("India consent and DPDP notice", () => {
  const context = { channel: "sms" as const, channelConfigured: true, now: MIDDAY_IST };

  it("refuses a send when consent carries no recorded notice", async () => {
    // s.5 makes the notice constitutive: consent nobody can evidence the
    // content of is not informed consent.
    await grantConsent({
      phone: "+919876543210",
      purposes: ["appointment-reminder"],
      capturedVia: "intake-form",
    });
    expect(
      await gate(indianRecipient(), message(), { ...context, registeredTemplateId: "DLT-1" }),
    ).toMatchObject({ status: "refused", reason: "consent-notice-missing" });
  });

  it("refuses a notice served in a language outside English and the Eighth Schedule", async () => {
    grantIN(["appointment-reminder"], "fr");
    expect(
      await gate(indianRecipient(), message(), { ...context, registeredTemplateId: "DLT-1" }),
    ).toMatchObject({ status: "refused", reason: "consent-notice-missing" });
  });

  it("sends when the notice is recorded in an Eighth Schedule language", async () => {
    grantIN(["appointment-reminder"], "ta");
    expect(
      await gate(indianRecipient(), message(), { ...context, registeredTemplateId: "DLT-1" }),
    ).toMatchObject({ status: "send" });
  });
});

describe("India SMS and TRAI DLT", () => {
  it("refuses India SMS with no registered DLT template id", async () => {
    // Indian operators discard unregistered traffic. Refusing locally is the
    // difference between a visible failure and a message that reports success
    // and never arrives.
    grantIN(["appointment-reminder"]);
    expect(
      await gate(indianRecipient(), message(), {
        channel: "sms",
        channelConfigured: true,
        now: MIDDAY_IST,
      }),
    ).toMatchObject({ status: "refused", reason: "dlt-registration-missing" });
  });

  it("does not demand a DLT id for the same send in the US", async () => {
    await grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    expect(
      await gate(recipient(), message(), {
        channel: "sms",
        channelConfigured: true,
        now: MIDDAY_PT,
      }),
    ).toMatchObject({ status: "send" });
  });
});

describe("WhatsApp", () => {
  it("refuses patient-specific content in the US even with consent", async () => {
    await grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    const result = await gate(recipient(), message(), {
      channel: "whatsapp",
      channelConfigured: true,
      registeredTemplateId: "appt_reminder_v1",
      now: MIDDAY_PT,
    });
    expect(result).toMatchObject({ status: "refused", reason: "phi-tier-exceeds-channel" });
    if (result.status === "refused") {
      expect(result.detail).toContain("No BAA");
    }
  });

  it("allows the same message in India", async () => {
    grantIN(["appointment-reminder"]);
    expect(
      await gate(indianRecipient(), message(), {
        channel: "whatsapp",
        channelConfigured: true,
        registeredTemplateId: "appt_reminder_v1",
        now: MIDDAY_IST,
      }),
    ).toMatchObject({ status: "send" });
  });

  it("refuses free-form outside the 24-hour service window", async () => {
    grantIN(["appointment-reminder"]);
    const stale = new Date(MIDDAY_IST.getTime() - 30 * 3_600_000).toISOString();
    expect(
      await gate(indianRecipient({ lastInboundAt: stale }), message(), {
        channel: "whatsapp",
        channelConfigured: true,
        now: MIDDAY_IST,
      }),
    ).toMatchObject({ status: "refused", reason: "outside-service-window" });
  });

  it("allows free-form inside the service window", async () => {
    grantIN(["appointment-reminder"]);
    const fresh = new Date(MIDDAY_IST.getTime() - 2 * 3_600_000).toISOString();
    expect(
      await gate(indianRecipient({ lastInboundAt: fresh }), message(), {
        channel: "whatsapp",
        channelConfigured: true,
        now: MIDDAY_IST,
      }),
    ).toMatchObject({ status: "send" });
  });

  it("reports would-send rather than sent, since no BSP transport is wired", async () => {
    grantIN(["appointment-reminder"]);
    process.env.WHATSAPP_PHONE_NUMBER_ID = "test";
    process.env.WHATSAPP_ACCESS_TOKEN = "test";
    process.env.WHATSAPP_APPROVED_TEMPLATES = "appointment-reminder=appt_reminder_v1";

    const result = await dispatchWhatsApp({
      recipient: indianRecipient(),
      templateId: "appointment-reminder",
      variables: { practiceName: "Clinic", appointmentTime: "3 Sept, 10:00" },
      now: MIDDAY_IST,
    });

    expect(result.status).toBe("would-send");
    if (result.status === "would-send") {
      expect(result.templateName).toBe("appt_reminder_v1");
      expect(result.category).toBe("utility");
    }

    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    delete process.env.WHATSAPP_APPROVED_TEMPLATES;
  });
});

describe("cross-timezone correctness", () => {
  it("treats the same instant differently for a US and an Indian patient", async () => {
    // 21:00 UTC is 14:00 in Los Angeles and 02:30 the next morning in
    // Kolkata. A system that checked the practice's clock instead of the
    // patient's would text an Indian patient at half past two.
    await grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    grantIN(["appointment-reminder"]);

    const us = await gate(recipient(), message(), {
      channel: "sms",
      channelConfigured: true,
      now: MIDDAY_PT,
    });
    const india = await gate(indianRecipient(), message(), {
      channel: "sms",
      channelConfigured: true,
      registeredTemplateId: "DLT-1",
      now: MIDDAY_PT,
    });

    expect(us.status).toBe("send");
    expect(india.status).toBe("deferred");
  });
});

describe("Indian-language rendering", () => {
  it("renders every template in the major Indian languages", async () => {
    const required = ["hi", "bn", "ta", "te", "mr", "gu", "kn", "ml", "pa", "ur"];
    for (const template of TEMPLATES) {
      for (const code of required) {
        expect(Object.keys(template.bodies)).toContain(code);
      }
    }
  });

  it("localises the STOP notice to match the body", async () => {
    const result = renderTemplate("appointment-reminder", "ta", {
      practiceName: "மருத்துவமனை",
      appointmentTime: "செப் 3, காலை 10",
    });
    expect(result.status).toBe("rendered");
    if (result.status === "rendered") {
      expect(result.body).toContain("STOP");
      expect(result.languageUsed).toBe("ta");
      expect(result.fellBackToEnglish).toBe(false);
    }
  });

  it("classifies recall as marketing, not utility", async () => {
    // Reaching a patient not seen in a year is marketing however warmly it is
    // worded. Classifying it honestly keeps it inside the promotional rules.
    const recall = TEMPLATES.find((t) => t.id === "recall-reactivation");
    expect(recall?.whatsappCategory).toBe("marketing");
  });
});


describe("inbound webhook authenticity", () => {
  const request = {
    signature: "abc123",
    url: "https://clinic.example/api/engagement/inbound",
    params: { From: "+14155550100", Body: "STOP" },
  };

  it("refuses when no auth token is configured, rather than accepting everything", async () => {
    // The failure this prevents: a staging deployment with no credentials
    // silently becomes an open consent-mutation endpoint.
    const verdict = verifyTwilioSignature(request, undefined);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.detail).toContain("not configured");
  });

  it("refuses a request with no signature header", async () => {
    const verdict = verifyTwilioSignature({ ...request, signature: undefined }, "token");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.detail).toContain("Missing");
  });

  it("refuses a forged signature", async () => {
    // Anyone could POST {phone, body:"START"} and manufacture an opt-in that
    // later lets the clinic text somebody who never agreed.
    expect(verifyTwilioSignature({ ...request, signature: "not-a-real-sig" }, "token").ok).toBe(
      false,
    );
  });
});

describe("outbound link safety", () => {
  const allow = ["https://portal.clinic.example"];

  it("refuses every URL when no allow-list is configured", async () => {
    // "Not configured yet" must not read as "anything goes" on a channel that
    // carries the practice's own sender identity.
    expect(portalOriginAllowList("")).toEqual([]);
    expect(isAllowedPortalUrl("https://portal.clinic.example/x", [])).toBe(false);
  });

  it("accepts a URL on an allowed origin", async () => {
    expect(isAllowedPortalUrl("https://portal.clinic.example/prep/123", allow)).toBe(true);
  });

  it("refuses a lookalike origin", async () => {
    // Clinic-branded copy, practice sender id, attacker's link — patients are
    // trained to trust exactly this message.
    expect(isAllowedPortalUrl("https://portal.clinic.example.evil.test/x", allow)).toBe(false);
    expect(isAllowedPortalUrl("https://portal-clinic.example/x", allow)).toBe(false);
  });

  it("refuses plaintext http even on an allowed host", async () => {
    expect(isAllowedPortalUrl("http://portal.clinic.example/x", allow)).toBe(false);
  });

  it("treats an absent URL as fine — the render step catches what it needs", async () => {
    expect(isAllowedPortalUrl(undefined, allow)).toBe(true);
  });
});

describe("who may send", () => {
  it("refuses an ordinary signed-in patient account", async () => {
    // isAuthenticated alone let a patient enrol a stranger's number and send
    // clinic-branded SMS from the practice number.
    expect(isClinicStaff({ userId: "patient-1" })).toBe(false);
    expect(isClinicStaff({ userId: "patient-1", role: "patient" })).toBe(false);
  });

  it("refuses an unauthenticated caller", async () => {
    expect(isClinicStaff({})).toBe(false);
    expect(isClinicStaff({ role: "admin" })).toBe(false);
  });

  it("admits provider, staff and admin roles", async () => {
    expect(isClinicStaff({ userId: "u", isProvider: true })).toBe(true);
    expect(isClinicStaff({ userId: "u", role: "provider" })).toBe(true);
    expect(isClinicStaff({ userId: "u", role: "staff" })).toBe(true);
    expect(isClinicStaff({ userId: "u", role: "admin" })).toBe(true);
  });
});


describe("carrier webhook payload", () => {
  /** What Twilio actually posts: form-encoded, capitalised field names. */
  const twilioSms = {
    ToCountry: "US",
    From: "+14155550100",
    Body: "STOP",
    MessageSid: "SM0123456789abcdef",
    AccountSid: "AC0123456789abcdef",
    To: "+14155559999",
  };

  it("reads Twilio's From/Body, which is what a real carrier sends", async () => {
    // The bug this pins: the handler validated JSON {phone, body} — the shape
    // a test harness sends — so once the signature check was added, a real
    // STOP passed verification, failed schema validation, and never reached
    // the consent engine. Secured and inert.
    const parsed = parseInboundWebhook(twilioSms);
    expect(parsed).toMatchObject({ ok: true, phone: "+14155550100", body: "STOP", channel: "sms" });
  });

  it("strips the whatsapp: prefix so downstream sees an E.164 number", async () => {
    const parsed = parseInboundWebhook({
      From: "whatsapp:+919876543210",
      Body: "START",
    });
    expect(parsed).toMatchObject({
      ok: true,
      phone: "+919876543210",
      channel: "whatsapp",
    });
  });

  it("refuses a payload with no From — that is not a carrier webhook", async () => {
    expect(parseInboundWebhook({ phone: "+14155550100", body: "STOP" })).toMatchObject({
      ok: false,
    });
    expect(parseInboundWebhook({}).ok).toBe(false);
    expect(parseInboundWebhook(null).ok).toBe(false);
  });

  it("accepts an empty body rather than treating it as a parse failure", async () => {
    // A media-only message is legitimate; it simply matches no keyword.
    expect(parseInboundWebhook({ From: "+14155550100" })).toMatchObject({ ok: true, body: "" });
  });

  it("carries a real STOP all the way through to revocation", async () => {
    // End to end, the path the finding said was broken.
    await grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    const parsed = parseInboundWebhook(twilioSms);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      await handleInbound({ phone: parsed.phone, body: parsed.body, practiceName: "Clinic" });
      expect((await getConsent(PHONE)).state).toBe("revoked");
    }
  });
});

describe("TwiML reply", () => {
  it("wraps a reply so the patient actually receives it", async () => {
    // Returning { autoReply } as JSON meant the confirmation was computed and
    // discarded — Twilio does not read a JSON body.
    const xml = twimlReply("You are unsubscribed.");
    expect(xml).toContain("<Response><Message>You are unsubscribed.</Message></Response>");
  });

  it("emits an empty Response when there is nothing to say", async () => {
    expect(twimlReply(null)).toContain("<Response></Response>");
  });

  it("escapes XML metacharacters", async () => {
    const xml = twimlReply('Call us at "1 & 2" <now>');
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&lt;now&gt;");
    expect(xml).not.toMatch(/<now>/);
  });
});
