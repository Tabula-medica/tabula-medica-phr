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
import { CHANNEL_PHI_CEILING } from "@shared/engagement";
import type { EngagementMessage, EngagementRecipient } from "@shared/engagement";

const PHONE = "+14155550100";

function recipient(overrides: Partial<EngagementRecipient> = {}): EngagementRecipient {
  return {
    patientId: "p-1",
    phone: PHONE,
    languageCode: "en",
    timeZone: "America/Los_Angeles",
    ...overrides,
  };
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

/** 14:00 Pacific — comfortably inside the quiet-hours window. */
const MIDDAY_PT = new Date("2026-09-01T21:00:00.000Z");

beforeEach(() => {
  resetConsentRegistry();
  resetSendHistory();
});

describe("phone normalisation", () => {
  it("accepts the shapes a front desk actually types", () => {
    expect(normalizePhone("415-555-0100")).toBe(PHONE);
    expect(normalizePhone("(415) 555 0100")).toBe(PHONE);
    expect(normalizePhone("14155550100")).toBe(PHONE);
    expect(normalizePhone("+1 415 555 0100")).toBe(PHONE);
  });

  it("refuses what it cannot turn into E.164 rather than guessing", () => {
    expect(normalizePhone("555-0100")).toBeNull();
    expect(normalizePhone("not a phone")).toBeNull();
  });
});

describe("inbound classification", () => {
  it("recognises the CTIA stop keywords in any casing or punctuation", () => {
    for (const word of ["STOP", "stop.", "Unsubscribe", "QUIT", "opt-out"]) {
      expect(classifyInbound(word)).toBe("revoke");
    }
  });

  it("reads free-text stop requests as a possible revoke", () => {
    expect(classifyInbound("please stop texting me")).toBe("possible-revoke");
    expect(classifyInbound("take me off this list")).toBe("possible-revoke");
    expect(classifyInbound("dont text me")).toBe("possible-revoke");
  });

  it("does not read ordinary replies as a revoke", () => {
    // The failure this guards: a patient answering a reminder gets silently
    // unsubscribed because their reply happened to contain "stop".
    expect(classifyInbound("I'll stop by the front desk at 3")).toBe("other");
    expect(classifyInbound("I had to cancel my ride, still coming")).toBe("other");
    expect(classifyInbound("C")).toBe("other");
  });
});

describe("consent", () => {
  it("treats an unrecorded number as unknown, not as permission", () => {
    expect(getConsent(PHONE).state).toBe("unknown");
  });

  it("revokes globally across purposes, not just the campaign that prompted it", () => {
    grantConsent({
      phone: PHONE,
      purposes: ["appointment-reminder", "recall-reactivation"],
      capturedVia: "intake-form",
    });
    handleInbound({ phone: PHONE, body: "STOP", practiceName: "Clinic" });

    const after = getConsent(PHONE);
    expect(after.state).toBe("revoked");
    expect(after.purposes).toEqual([]);
  });

  it("revokes on a free-text stop AND flags it for a human", () => {
    grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    const result = handleInbound({ phone: PHONE, body: "please stop texting me", practiceName: "Clinic" });

    expect(result.consent.state).toBe("revoked");
    expect(result.needsStaffReview).toBe(true);
  });

  it("answers HELP without changing consent state", () => {
    grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    const result = handleInbound({ phone: PHONE, body: "HELP", practiceName: "Clinic" });

    expect(result.autoReply).toContain("STOP");
    expect(result.consent.state).toBe("granted");
  });

  it("routes a real patient reply to a human instead of auto-answering", () => {
    grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    const result = handleInbound({ phone: PHONE, body: "is my blood pressure ok?", practiceName: "Clinic" });

    expect(result.autoReply).toBeNull();
    expect(result.needsStaffReview).toBe(true);
  });

  it("restores only the baseline purposes on START", () => {
    grantConsent({ phone: PHONE, purposes: ["recall-reactivation"], capturedVia: "intake-form" });
    revokeConsent({ phone: PHONE });
    const result = handleInbound({ phone: PHONE, body: "START", practiceName: "Clinic" });

    expect(result.consent.state).toBe("granted");
    expect(result.consent.purposes).toContain("appointment-reminder");
    expect(result.consent.purposes).not.toContain("recall-reactivation");
  });
});

describe("quiet hours", () => {
  it("reads the recipient's local hour, not the server's", () => {
    // 21:00 UTC is 14:00 in Los Angeles and 06:00 the next day in Tokyo.
    expect(localHourIn("America/Los_Angeles", MIDDAY_PT)).toBe(14);
    expect(localHourIn("Asia/Tokyo", MIDDAY_PT)).toBe(6);
  });

  it("allows a send inside the window", () => {
    expect(checkQuietHours("America/Los_Angeles", MIDDAY_PT)).toMatchObject({ status: "allowed" });
  });

  it("defers rather than refusing when it is merely too early", () => {
    // 06:00 Pacific — before the window opens.
    const early = new Date("2026-09-01T13:00:00.000Z");
    const verdict = checkQuietHours("America/Los_Angeles", early);
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

  it("reports an unknown timezone rather than substituting one", () => {
    expect(checkQuietHours(undefined, MIDDAY_PT)).toEqual({ status: "unknown-timezone" });
    expect(checkQuietHours("Mars/Olympus_Mons", MIDDAY_PT)).toEqual({ status: "unknown-timezone" });
  });
});

describe("templates", () => {
  it("never ships a template whose tier exceeds what SMS may carry", () => {
    // The structural guarantee: no clinical detail can reach an SMS body,
    // because no template is classified that way in the first place.
    for (const template of TEMPLATES) {
      expect(template.tier).not.toBe("clinical-detail");
    }
  });

  it("appends the STOP notice in the language the body was rendered in", () => {
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

  it("falls back to English and says so, rather than machine-translating", () => {
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

  it("refuses to send a body with an unfilled placeholder", () => {
    // A patient receiving "your appointment on {{appointmentTime}}" is worse
    // than a patient receiving nothing.
    const result = renderTemplate("appointment-reminder", "en", { practiceName: "Clinic" });
    expect(result).toMatchObject({ status: "failed", reason: "missing-variables" });
  });

  it("keeps preparation instructions behind the portal rather than in the text", () => {
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

  it("refuses when no consent is on file", () => {
    expect(evaluateSend(recipient(), message(), context)).toMatchObject({
      status: "refused",
      reason: "no-consent",
    });
  });

  it("refuses after revocation, permanently", () => {
    grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    revokeConsent({ phone: PHONE });
    expect(evaluateSend(recipient(), message(), context)).toMatchObject({
      status: "refused",
      reason: "consent-revoked",
    });
  });

  it("refuses a purpose the patient did not consent to", () => {
    grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    expect(
      evaluateSend(recipient(), message({ purpose: "recall-reactivation" }), context),
    ).toMatchObject({ status: "refused", reason: "purpose-not-consented" });
  });

  it("refuses clinical detail over SMS rather than truncating it", () => {
    grantConsent({ phone: PHONE, purposes: ["post-visit-followup"], capturedVia: "intake-form" });
    const result = evaluateSend(
      recipient(),
      message({ purpose: "post-visit-followup", tier: "clinical-detail", body: "Your A1c is 9.2." }),
      context,
    );
    expect(result).toMatchObject({ status: "refused", reason: "phi-tier-exceeds-channel" });
    expect(CHANNEL_PHI_CEILING.sms).toBe("appointment-logistics");
  });

  it("refuses when the timezone is unknown instead of assuming the practice's", () => {
    grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    expect(
      evaluateSend(recipient({ timeZone: undefined }), message(), context),
    ).toMatchObject({ status: "refused", reason: "unknown-timezone" });
  });

  it("defers outside quiet hours, and hands back when the window opens", () => {
    grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    const early = new Date("2026-09-01T13:00:00.000Z"); // 06:00 PT
    const result = evaluateSend(recipient(), message(), { ...context, now: early });
    expect(result.status).toBe("deferred");
    if (result.status === "deferred") {
      expect(Date.parse(result.sendAfter)).toBeGreaterThan(early.getTime());
    }
  });

  it("caps the weekly volume, exempting replies the patient triggered", () => {
    grantConsent({
      phone: PHONE,
      purposes: ["appointment-reminder", "appointment-confirmation"],
      capturedVia: "intake-form",
    });
    for (let i = 0; i < WEEKLY_MESSAGE_CAP; i++) recordSend(PHONE, MIDDAY_PT);

    expect(evaluateSend(recipient(), message(), context)).toMatchObject({
      status: "refused",
      reason: "frequency-cap",
    });
    expect(
      evaluateSend(recipient(), message({ purpose: "appointment-confirmation" }), context),
    ).toMatchObject({ status: "send" });
  });

  it("reports a missing channel rather than silently dropping the message", () => {
    grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    expect(
      evaluateSend(recipient(), message(), { ...context, channelConfigured: false }),
    ).toMatchObject({ status: "refused", reason: "channel-not-configured" });
  });

  it("sends when every gate passes", () => {
    grantConsent({ phone: PHONE, purposes: ["appointment-reminder"], capturedVia: "intake-form" });
    expect(evaluateSend(recipient(), message(), context)).toMatchObject({ status: "send" });
  });
});

describe("journeys", () => {
  it("keeps appointment reminders to two touches", () => {
    const journey = JOURNEYS.find((j) => j.id === "appointment-reminders");
    expect(journey?.steps).toHaveLength(2);
  });

  it("drops touches whose time has already passed", () => {
    // A "reminder" for a visit starting in 20 minutes, fired because a job
    // backed up, is worse than silence.
    const anchor = "2026-09-01T21:00:00.000Z";
    const now = new Date("2026-09-01T20:40:00.000Z");
    expect(planJourney("appointment-reminders", anchor, now)).toEqual([]);
  });

  it("orders touches earliest first", () => {
    const anchor = "2026-12-01T17:00:00.000Z";
    const touches = planJourney("appointment-reminders", anchor, new Date("2026-09-01T00:00:00.000Z"));
    expect(touches).toHaveLength(2);
    expect(Date.parse(touches[0].dueAt)).toBeLessThan(Date.parse(touches[1].dueAt));
  });

  it("returns nothing for an unknown journey rather than throwing", () => {
    expect(planJourney("no-such-journey", "2026-12-01T17:00:00.000Z")).toEqual([]);
  });
});
