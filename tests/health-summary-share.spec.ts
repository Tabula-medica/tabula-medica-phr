import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildHealthSummary,
  summaryToPlainText,
} from "../server/services/engagement/summary-render";
import {
  SHARE_POLICIES,
  __resetShares,
  buildShareIntents,
  listShares,
  mintShare,
  redeemShare,
  revokeShare,
  shareBaseUrl,
} from "../server/services/engagement/summary-share";
import {
  SUMMARY_STRINGS,
  renderShareMessage,
  summaryStrings,
} from "../server/services/engagement/summary-strings";
import { TEMPLATES, findTemplate, renderTemplate } from "../server/services/engagement/templates";
import { evaluateSend, resetSendHistory } from "../server/services/engagement/send-gate";
import { grantConsent, resetConsentRegistry } from "../server/services/engagement/consent";
import { SHARE_LIMITS, SUMMARY_SECTIONS } from "@shared/health-summary";
import type { EngagementMessage, EngagementRecipient } from "@shared/engagement";
import type {
  IpsAllergyInput,
  IpsMedicationInput,
  IpsProblemInput,
} from "../server/services/world/ips-generator";

const BASE = "https://records.example.org";
const NOW = new Date("2026-09-01T12:00:00Z");

const MEDS: IpsMedicationInput[] = [
  { id: "m1", name: "Metformin", dose: "500 mg", frequency: "twice daily", status: "active" },
  { id: "m2", name: "Amlodipine", dose: "5 mg", frequency: "daily", status: "active" },
  { id: "m3", name: "Warfarin", dose: "3 mg", frequency: "daily", status: "stopped" },
];

const PROBLEMS: IpsProblemInput[] = [
  { id: "p1", name: "Type 2 diabetes mellitus", onsetDate: "2019-04-02", status: "active" },
];

const ALLERGIES: IpsAllergyInput[] = [
  { id: "a1", allergen: "Penicillin", reaction: "Anaphylaxis", severity: "severe", status: "active" },
];

function render(overrides: Partial<Parameters<typeof buildHealthSummary>[0]> = {}) {
  return buildHealthSummary({
    patientName: "Asha Rao",
    medications: MEDS,
    problems: PROBLEMS,
    allergies: ALLERGIES,
    sections: SUMMARY_SECTIONS,
    generatedAt: NOW.toISOString(),
    language: "en",
    ...overrides,
  });
}

function mint(overrides: Partial<Parameters<typeof mintShare>[0]> = {}) {
  return mintShare({
    profileId: "profile-1",
    createdByAccountId: "account-1",
    sections: ["medications", "allergies"],
    initiator: "patient",
    jurisdiction: "US",
    delivery: "copy-link",
    language: "en",
    now: NOW,
    ...overrides,
  });
}

let previousBaseUrl: string | undefined;

beforeEach(() => {
  previousBaseUrl = process.env.HEALTH_SHARE_BASE_URL;
  process.env.HEALTH_SHARE_BASE_URL = BASE;
  __resetShares();
  resetConsentRegistry();
  resetSendHistory();
});

afterEach(() => {
  if (previousBaseUrl === undefined) delete process.env.HEALTH_SHARE_BASE_URL;
  else process.env.HEALTH_SHARE_BASE_URL = previousBaseUrl;
});

// ── The empty-allergy distinction ───────────────────────────────────────────

describe("empty sections say which kind of empty", () => {
  it("renders an unattested empty allergy list as not-recorded, never as none", async () => {
    const summary = render({ allergies: [] });
    const allergies = summary.sections.find((s) => s.key === "allergies");

    expect(allergies?.emptyState?.kind).toBe("not-recorded");
    expect(allergies?.emptyState?.text).toMatch(/does not mean there are none/i);
    // And it is escalated to a warning, because a reader who never scrolls to
    // the allergy section is exactly the reader this protects.
    expect(summary.warnings.some((w) => /missing, not empty/i.test(w))).toBe(true);
  });

  it("renders an attested empty allergy list as attested-none with no warning", async () => {
    const summary = render({ allergies: [], attestations: { noKnownAllergies: true } });
    const allergies = summary.sections.find((s) => s.key === "allergies");

    expect(allergies?.emptyState?.kind).toBe("attested-none");
    expect(allergies?.emptyState?.text).toMatch(/no known allergies/i);
    expect(summary.warnings.some((w) => /missing, not empty/i.test(w))).toBe(false);
  });

  it("does not let an attestation on one section speak for another", async () => {
    const summary = render({
      allergies: [],
      medications: [],
      attestations: { noKnownMedications: true },
    });

    expect(summary.sections.find((s) => s.key === "medications")?.emptyState?.kind).toBe(
      "attested-none",
    );
    expect(summary.sections.find((s) => s.key === "allergies")?.emptyState?.kind).toBe(
      "not-recorded",
    );
  });
});

// ── Ordering and completeness ───────────────────────────────────────────────

describe("summary rendering", () => {
  it("puts allergies first however the caller ordered the sections", async () => {
    const summary = render({ sections: ["diagnoses", "medications", "allergies"] });
    expect(summary.sections.map((s) => s.key)).toEqual([
      "allergies",
      "medications",
      "diagnoses",
    ]);
  });

  it("keeps a stopped medication, labelled and sorted after the active ones", async () => {
    const meds = render().sections.find((s) => s.key === "medications")!;
    const names = meds.lines.map((l) => l.primary);

    expect(names).toEqual(["Amlodipine", "Metformin", "Warfarin"]);
    expect(meds.lines[2].status).toBe("stopped");
    // The active ones carry no status chip — a chip on every row is a chip
    // nobody reads.
    expect(meds.lines[0].status).toBeUndefined();
  });

  it("warns that a partial share is withheld rather than empty", async () => {
    expect(render({ sections: ["medications"] }).warnings.some((w) => /withheld/i.test(w))).toBe(
      true,
    );
    expect(render().warnings.some((w) => /withheld/i.test(w))).toBe(false);
  });

  it("reports a language fallback instead of silently serving English", async () => {
    const summary = render({ language: "sat" });
    expect(summary.fellBackToEnglish).toBe(true);
    expect(summary.language).toBe("en");

    const hindi = render({ language: "hi" });
    expect(hindi.fellBackToEnglish).toBe(false);
    expect(hindi.sections.find((s) => s.key === "allergies")?.heading).toBe("एलर्जी");
  });

  it("carries the empty-state wording into the plain-text form", async () => {
    const text = summaryToPlainText(render({ allergies: [] }));
    expect(text).toMatch(/does not mean there are none/i);
    expect(text).toMatch(/Metformin \(500 mg · twice daily\)/);
    expect(text).toMatch(/Warfarin .*stopped/);
  });
});

// ── Translations ────────────────────────────────────────────────────────────

describe("translations", () => {
  it("gives every supported language the full string set", async () => {
    const keys = Object.keys(SUMMARY_STRINGS.en).sort();
    for (const [language, strings] of Object.entries(SUMMARY_STRINGS)) {
      expect(Object.keys(strings).sort(), `${language} is missing strings`).toEqual(keys);
      for (const [key, value] of Object.entries(strings)) {
        expect(value.trim(), `${language}.${key} is empty`).not.toBe("");
      }
    }
  });

  it("never lets a not-recorded string be shorter than its attested twin", async () => {
    // A cheap proxy for "the caveat survived translation": the sentence that
    // has to explain itself cannot be terser than the one that does not.
    for (const [language, s] of Object.entries(SUMMARY_STRINGS)) {
      expect(
        s.notRecordedAllergies.length,
        `${language} notRecordedAllergies looks like it lost its caveat`,
      ).toBeGreaterThan(s.attestedNoneAllergies.length);
    }
  });

  it("resolves a region tag and reports the fallback honestly", async () => {
    expect(summaryStrings("hi").fellBackToEnglish).toBe(false);
    expect(summaryStrings("qq").fellBackToEnglish).toBe(true);
    expect(summaryStrings("qq").strings.headingAllergies).toBe("Allergies");
  });
});

// ── Minting ─────────────────────────────────────────────────────────────────

describe("minting a share", () => {
  it("refuses a share with no sections", async () => {
    const result = await mint({ sections: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no-sections-selected");
  });

  it("refuses to let a patient-initiated share ask the server to send", async () => {
    const result = await mint({ initiator: "patient", delivery: "server-sms" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("server-send-requires-clinic-initiation");
      // The reason matters: the practice would become the sender, and the
      // consent TCPA looks for then belongs to the recipient.
      expect(result.detail).toMatch(/recipient's own prior express consent/i);
    }
  });

  it("refuses an over-long lifetime rather than silently shortening it", async () => {
    const result = await mint({ ttlHours: SHARE_LIMITS.MAX_TTL_HOURS + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expiry-exceeds-maximum");
  });

  it("refuses when no https share origin is configured", async () => {
    process.env.HEALTH_SHARE_BASE_URL = "";
    expect(shareBaseUrl()).toBeNull();
    const result = await mint();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("share-base-url-not-configured");
  });

  it("refuses a plain-http share origin", async () => {
    process.env.HEALTH_SHARE_BASE_URL = "http://records.example.org";
    expect(shareBaseUrl()).toBeNull();
  });

  it("issues a distinct high-entropy token per share and never returns it again", async () => {
    const a = await mint();
    const b = await mint();
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(40);
    expect(a.url).toBe(`${BASE}/s/${a.token}`);

    // The listing never carries the token, the profile, or the PIN material.
    const listed = listShares("profile-1");
    for (const grant of listed) {
      expect(Object.keys(grant)).not.toContain("tokenHash");
      expect(Object.keys(grant)).not.toContain("profileId");
      expect(Object.keys(grant)).not.toContain("pinHash");
      expect(JSON.stringify(grant)).not.toContain(a.token);
    }
  });

  it("keeps the URL free of anything but the token", async () => {
    const result = await mint();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.url).not.toMatch(/profile-1|Asha|medication/i);
  });
});

// ── Redemption ──────────────────────────────────────────────────────────────

describe("redeeming a share", () => {
  it("resolves a live token and counts the view", async () => {
    const minted = await mint();
    if (!minted.ok) throw new Error("mint failed");

    const first = await redeemShare(minted.token, { now: NOW });
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.grant.viewCount).toBe(1);
  });

  it("rejects an unknown token", async () => {
    const result = await redeemShare("not-a-real-token", { now: NOW });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toBe("token-not-found");
  });

  it("expires on time", async () => {
    const minted = await mint({ ttlHours: 1 });
    if (!minted.ok) throw new Error("mint failed");

    const later = new Date(NOW.getTime() + 61 * 60 * 1000);
    const result = await redeemShare(minted.token, { now: later });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toBe("token-expired");
  });

  it("reports a revoked link as revoked, not as missing", async () => {
    const minted = await mint();
    if (!minted.ok) throw new Error("mint failed");

    revokeShare(minted.grant.id, "patient changed their mind", NOW);
    const result = await redeemShare(minted.token, { now: NOW });

    expect(result.ok).toBe(false);
    // The person holding the link cannot otherwise tell a revocation from a
    // typo, and will keep retrying a link that will never work again.
    if (!result.ok) expect(result.failure).toBe("token-revoked");
  });

  it("stops at the view cap", async () => {
    const minted = await mint({ maxViews: 2 });
    if (!minted.ok) throw new Error("mint failed");

    expect((await redeemShare(minted.token, { now: NOW })).ok).toBe(true);
    expect((await redeemShare(minted.token, { now: NOW })).ok).toBe(true);

    const third = await redeemShare(minted.token, { now: NOW });
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.failure).toBe("view-cap-reached");
  });
});

// ── PIN ─────────────────────────────────────────────────────────────────────

describe("PIN-gated shares", () => {
  it("issues a numeric PIN once and requires it on redemption", async () => {
    const minted = await mint({ withPin: true });
    if (!minted.ok) throw new Error("mint failed");

    expect(minted.pin).toMatch(/^\d{6}$/);
    expect(minted.grant.pinRequired).toBe(true);

    const noPin = await redeemShare(minted.token, { now: NOW });
    expect(noPin.ok).toBe(false);
    if (!noPin.ok) expect(noPin.failure).toBe("pin-required");

    expect((await redeemShare(minted.token, { pin: minted.pin, now: NOW })).ok).toBe(true);
  });

  it("does not burn a view on a wrong PIN, and locks before the keyspace falls", async () => {
    const minted = await mint({ withPin: true, maxViews: 2 });
    if (!minted.ok) throw new Error("mint failed");

    // Guessing must not be a way to exhaust somebody else's link...
    for (let i = 0; i < SHARE_LIMITS.MAX_PIN_ATTEMPTS - 1; i += 1) {
      const attempt = await redeemShare(minted.token, { pin: "000000", now: NOW });
      expect(attempt.ok).toBe(false);
      if (!attempt.ok) expect(attempt.failure).toBe("pin-incorrect");
    }

    // ...but it must not be free either. A 6-digit PIN is a million-wide
    // space, which is minutes to a machine, so the grant closes at the cap.
    const last = await redeemShare(minted.token, { pin: "000000", now: NOW });
    expect(last.ok).toBe(false);
    if (!last.ok) expect(last.failure).toBe("pin-locked");

    // Locked means locked: the real PIN no longer opens it either.
    const withRealPin = await redeemShare(minted.token, { pin: minted.pin, now: NOW });
    expect(withRealPin.ok).toBe(false);
    if (!withRealPin.ok) expect(withRealPin.failure).toBe("pin-locked");
  });

  it("leaves the view count untouched by failed attempts", async () => {
    const minted = await mint({ withPin: true, maxViews: 2 });
    if (!minted.ok) throw new Error("mint failed");

    await redeemShare(minted.token, { pin: "000000", now: NOW });
    await redeemShare(minted.token, { pin: "111111", now: NOW });

    const good = await redeemShare(minted.token, { pin: minted.pin, now: NOW });
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.grant.viewCount).toBe(1);
      // A correct PIN clears the count — the cap exists to stop a walk of the
      // keyspace, not to punish somebody who fat-fingered it last week.
      expect(good.grant.pinAttempts).toBe(0);
    }
  });

  it("keeps saying locked rather than changing its story to expired", async () => {
    const minted = await mint({ withPin: true, ttlHours: 1 });
    if (!minted.ok) throw new Error("mint failed");

    for (let i = 0; i < SHARE_LIMITS.MAX_PIN_ATTEMPTS; i += 1) {
      await redeemShare(minted.token, { pin: "000000", now: NOW });
    }

    const later = new Date(NOW.getTime() + 61 * 60 * 1000);
    const result = await redeemShare(minted.token, { pin: minted.pin, now: later });
    expect(result.ok).toBe(false);
    // "Expired" invites asking for the same link again; "locked" does not.
    if (!result.ok) expect(result.failure).toBe("pin-locked");
  });
});

// ── Jurisdiction asymmetry ──────────────────────────────────────────────────

describe("sharing policy differs by jurisdiction", () => {
  it("treats US transmission as a duty and Indian transmission as discretionary", async () => {
    expect(SHARE_POLICIES.US.transmissionIsADuty).toBe(true);
    expect(SHARE_POLICIES.IN.transmissionIsADuty).toBe(false);
  });

  it("requires a signed written direction only where the law does", async () => {
    // 45 CFR 164.524(c)(3)(ii) has no Indian equivalent — the DPDP Act gives
    // no portability right, so there is no directive to sign.
    expect(SHARE_POLICIES.US.requiresSignedDirective).toBe(true);
    expect(SHARE_POLICIES.IN.requiresSignedDirective).toBe(false);

    expect(SHARE_POLICIES.IN.requiresFreshPurposeConsent).toBe(true);
    expect(SHARE_POLICIES.US.requiresFreshPurposeConsent).toBe(false);
  });

  it("cites Ciox alongside the third-party directive", async () => {
    expect(SHARE_POLICIES.US.legalBasis.join(" ")).toMatch(/Ciox Health/);
  });
});

// ── Handoff intents ─────────────────────────────────────────────────────────

describe("handoff intents", () => {
  it("builds sms and WhatsApp intents the patient's own device sends", async () => {
    const intents = buildShareIntents(`${BASE}/s/abc`, "Open it here: https://x/y");

    // `?&body=` is the form that works on both iOS and Android.
    expect(intents.sms.startsWith("sms:?&body=")).toBe(true);
    // No number in the wa.me link: the patient picks the contact.
    expect(intents.whatsapp.startsWith("https://wa.me/?text=")).toBe(true);
    expect(intents.copy).toBe(`${BASE}/s/abc`);
  });

  it("does not duplicate the link when the message already contains it", async () => {
    const message = renderShareMessage("en", {
      practiceName: "Ltfm Health",
      shareUrl: `${BASE}/s/abc`,
    });
    const intents = buildShareIntents(`${BASE}/s/abc`, message.body);
    const decoded = decodeURIComponent(intents.sms.replace("sms:?&body=", ""));

    expect(decoded).toBe(message.body);
    expect(decoded.match(/https:/g)?.length).toBe(1);
  });

  it("omits the STOP notice on a message the patient sends themselves", async () => {
    const message = renderShareMessage("en", { practiceName: "X", shareUrl: "https://x/s/1" });
    // "Reply STOP" on a text from your mother reads as spam, and there is
    // nothing for the recipient to opt out of.
    expect(message.body).not.toMatch(/STOP/i);
  });

  it("still carries the STOP notice when the practice sends it", async () => {
    const rendered = renderTemplate("record-share", "en", {
      practiceName: "X",
      shareUrl: "https://x/s/1",
    });
    expect(rendered.status).toBe("rendered");
    if (rendered.status === "rendered") expect(rendered.body).toMatch(/STOP/);
  });
});

// ── The channel ceiling, end to end ─────────────────────────────────────────

describe("the notification never carries clinical detail", () => {
  const shareMessage: EngagementMessage = {
    templateId: "record-share",
    purpose: "record-share",
    tier: "appointment-logistics",
    body: "ignored by the gate",
  };

  function recipient(overrides: Partial<EngagementRecipient> = {}): EngagementRecipient {
    return {
      patientId: "p-1",
      phone: "+14155550100",
      languageCode: "en",
      timeZone: "America/Los_Angeles",
      jurisdiction: "US",
      ...overrides,
    };
  }

  it("classifies the record-share template below clinical-detail", async () => {
    const template = findTemplate("record-share");
    expect(template).not.toBeNull();
    expect(template?.tier).toBe("appointment-logistics");
  });

  it("keeps every template below clinical-detail, this one included", async () => {
    for (const template of TEMPLATES) {
      expect(template.tier, `${template.id} must not be clinical-detail`).not.toBe(
        "clinical-detail",
      );
    }
  });

  it("has no template variable that could carry a drug or diagnosis name", async () => {
    const template = findTemplate("record-share")!;
    for (const body of Object.values(template.bodies)) {
      const placeholders = [...body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
      expect(placeholders.sort()).toEqual(["practiceName", "shareUrl"]);
    }
  });

  it("refuses the share notification over WhatsApp in the US", async () => {
    grantConsent({
      phone: "+14155550100",
      purposes: ["record-share"],
      capturedVia: "patient-portal",
    });

    const decision = evaluateSend(recipient(), shareMessage, {
      channel: "whatsapp",
      channelConfigured: true,
      registeredTemplateId: "record_share_v1",
      now: new Date("2026-09-01T21:00:00Z"),
    });

    // Meta signs no BAA, so US WhatsApp carries nothing patient-specific —
    // not even that a clinic has a summary waiting.
    expect(decision.status).toBe("refused");
    if (decision.status === "refused") expect(decision.reason).toBe("phi-tier-exceeds-channel");
  });

  it("allows the same notification over WhatsApp in India", async () => {
    grantConsent({
      phone: "+919876543210",
      purposes: ["record-share"],
      capturedVia: "whatsapp-optin",
      noticeLanguage: "hi",
      noticeVersion: "v1",
    });

    const decision = evaluateSend(
      recipient({
        patientId: "p-in",
        phone: "+919876543210",
        languageCode: "hi",
        timeZone: "Asia/Kolkata",
        jurisdiction: "IN",
      }),
      shareMessage,
      {
        channel: "whatsapp",
        channelConfigured: true,
        registeredTemplateId: "record_share_v1",
        now: new Date("2026-09-01T06:30:00Z"),
      },
    );

    expect(decision.status).toBe("send");
  });

  it("allows it over SMS in the US", async () => {
    grantConsent({
      phone: "+14155550100",
      purposes: ["record-share"],
      capturedVia: "patient-portal",
    });

    const decision = evaluateSend(recipient(), shareMessage, {
      channel: "sms",
      channelConfigured: true,
      now: new Date("2026-09-01T21:00:00Z"),
    });

    expect(decision.status).toBe("send");
  });
});
