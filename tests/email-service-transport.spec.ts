import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, isEmailConfigured } from "../server/services/email-service";

const originalKey = process.env.RESEND_API_KEY;

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test_key";
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalKey;
});

describe("email-service transport fallback", () => {
  it("reports configuration from the API key alone", () => {
    expect(isEmailConfigured()).toBe(true);
    delete process.env.RESEND_API_KEY;
    expect(isEmailConfigured()).toBe(false);
  });

  it("drops the send with no-api-key when unconfigured", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendEmail({ to: "a@example.com", subject: "hi", text: "hi" });
    expect(result).toEqual({ ok: false, reason: "no-api-key" });
  });

  // The `resend` SDK is not a declared dependency, so without the REST
  // fallback every configured send silently no-ops. This is the regression
  // that kept MFA confirmation emails from ever leaving the server.
  it("posts to the Resend REST API when the SDK is not installed", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "email_abc" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendEmail({
      to: "owner@example.com",
      subject: "Two-factor authentication enabled",
      text: "body",
      html: "<p>body</p>",
    });

    expect(result.ok).toBe(true);
    expect(result.transport).toBe("rest");
    expect(result.id).toBe("email_abc");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(["owner@example.com"]);
    expect(body.subject).toBe("Two-factor authentication enabled");
  });

  it("reports a non-2xx REST response as send-failed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "domain not verified" }),
      })
    );
    const result = await sendEmail({ to: "a@example.com", subject: "hi", text: "hi" });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("send-failed");
    expect(result.error).toBe("domain not verified");
  });

  it("reports a thrown transport error as send-failed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    const result = await sendEmail({ to: "a@example.com", subject: "hi", text: "hi" });
    expect(result).toMatchObject({ ok: false, reason: "send-failed", error: "ECONNRESET" });
  });
});
