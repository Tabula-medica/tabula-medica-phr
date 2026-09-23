import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The notification service touches the DB only to look up a fallback
// recipient; stub the pool so the suite never needs a live database.
const selectMock = vi.fn();
vi.mock("../server/db", () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

const sendEmailMock = vi.fn();
const isEmailConfiguredMock = vi.fn(() => true);
vi.mock("../server/services/email-service", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
  isEmailConfigured: () => isEmailConfiguredMock(),
}));

import {
  buildMfaEmail,
  resolveNotificationEmail,
  sendMfaSecurityEmail,
} from "../server/services/mfa-notification-service";

function dbReturns(rows: { email: string | null }[]) {
  selectMock.mockReturnValue({
    from: () => ({
      where: () => ({
        limit: async () => rows,
      }),
    }),
  });
}

beforeEach(() => {
  selectMock.mockReset();
  sendEmailMock.mockReset();
  isEmailConfiguredMock.mockReturnValue(true);
  sendEmailMock.mockResolvedValue({ ok: true, id: "email_123" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildMfaEmail — event copy", () => {
  it.each([
    ["enrolled", "Two-factor authentication enabled"],
    ["disabled", "Two-factor authentication disabled"],
    ["recovery_codes_regenerated", "New recovery codes issued"],
    ["recovery_code_used", "Recovery code used"],
  ] as const)("%s renders its own headline", (event, headline) => {
    const mail = buildMfaEmail(event);
    expect(mail.subject.length).toBeGreaterThan(0);
    expect(mail.text).toContain(headline);
    expect(mail.html).toContain(headline);
  });

  it("includes the request context so the owner can spot a hijack", () => {
    const mail = buildMfaEmail("enrolled", {
      ipAddress: "203.0.113.9",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
      occurredAt: new Date("2026-08-23T12:34:56Z"),
      recoveryCodesRemaining: 10,
    });
    expect(mail.text).toContain("203.0.113.9");
    expect(mail.text).toContain("iPhone");
    expect(mail.text).toContain("2026-08-23 12:34:56 UTC");
    expect(mail.text).toContain("Recovery codes remaining: 10");
  });

  it("falls back to placeholders when context is missing", () => {
    const mail = buildMfaEmail("disabled");
    expect(mail.text).toContain("IP address: Unknown");
    expect(mail.text).toContain("Device: Unknown device");
    expect(mail.text).not.toContain("Recovery codes remaining");
  });

  it("escapes attacker-controlled user-agent strings in the HTML body", () => {
    const mail = buildMfaEmail("enrolled", {
      userAgent: '<img src=x onerror="alert(1)">',
    });
    // Angle brackets are stripped by the user-agent summarizer and any
    // surviving quotes are entity-escaped, so no markup reaches the body.
    expect(mail.html).not.toContain("<img");
    expect(mail.html).not.toContain('onerror="');
    expect(mail.html).toContain("&quot;alert(1)&quot;");
  });

  it("carries no health information", () => {
    const mail = buildMfaEmail("recovery_code_used", {
      recoveryCodesRemaining: 3,
    });
    expect(mail.text).toContain("contains no health information");
  });
});

describe("resolveNotificationEmail", () => {
  it("prefers the session claim over a database round trip", async () => {
    const to = await resolveNotificationEmail("user-1", "claim@example.com");
    expect(to).toBe("claim@example.com");
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("falls back to the users table when the claim is absent", async () => {
    dbReturns([{ email: "stored@example.com" }]);
    const to = await resolveNotificationEmail("user-1", null);
    expect(to).toBe("stored@example.com");
  });

  it("returns null when no address is on file", async () => {
    dbReturns([{ email: null }]);
    expect(await resolveNotificationEmail("user-1", undefined)).toBeNull();
  });

  it("returns null instead of throwing when the lookup fails", async () => {
    selectMock.mockImplementation(() => {
      throw new Error("connection refused");
    });
    expect(await resolveNotificationEmail("user-1", undefined)).toBeNull();
  });
});

describe("sendMfaSecurityEmail", () => {
  it("sends to the account address and tags the event", async () => {
    const outcome = await sendMfaSecurityEmail("user-1", "owner@example.com", "enrolled", {
      ipAddress: "198.51.100.4",
    });
    expect(outcome.sent).toBe(true);
    const payload = sendEmailMock.mock.calls[0][0];
    expect(payload.to).toBe("owner@example.com");
    expect(payload.text).toContain("198.51.100.4");
    expect(payload.tags).toEqual([
      { name: "channel", value: "mfa-security" },
      { name: "event", value: "enrolled" },
    ]);
  });

  it("skips sending when Resend is not configured", async () => {
    isEmailConfiguredMock.mockReturnValue(false);
    const outcome = await sendMfaSecurityEmail("user-1", "owner@example.com", "disabled");
    expect(outcome).toEqual({ sent: false, reason: "not-configured" });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("reports no-recipient rather than sending nowhere", async () => {
    dbReturns([{ email: null }]);
    const outcome = await sendMfaSecurityEmail("user-1", null, "disabled");
    expect(outcome).toEqual({ sent: false, reason: "no-recipient" });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("surfaces a provider failure without throwing", async () => {
    sendEmailMock.mockResolvedValue({
      ok: false,
      reason: "send-failed",
      error: "domain not verified",
    });
    const outcome = await sendMfaSecurityEmail("user-1", "owner@example.com", "enrolled");
    expect(outcome.sent).toBe(false);
    expect(outcome.reason).toBe("send-failed");
    expect(outcome.error).toBe("domain not verified");
  });
});
