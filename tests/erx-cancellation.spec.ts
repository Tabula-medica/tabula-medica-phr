/**
 * eRx cancellation — pure logic tests.
 *
 * Covers the decision logic that decides whether a pharmacy gets a CancelRx,
 * the SCRIPT message shape, response interpretation and the waste estimate.
 * The persistence layer is exercised separately against a live database; these
 * specs are hermetic and import no DB modules.
 *
 * Run:
 *   npx vitest run tests/erx-cancellation.spec.ts
 */

import { describe, it, expect } from "vitest";

import {
  assessDoseChange,
  buildCancelRxMessage,
  buildIdempotencyKey,
  CANCEL_REASON_BY_TRIGGER,
  classifyCostTier,
  DEFAULT_SCRIPT_VERSION,
  estimateWasteAvoidedCents,
  hashPayload,
  interpretCancelRxResponse,
  MAX_TRANSMISSION_ATTEMPTS,
  nextRetryDelayMs,
  parseDose,
  WASTE_COST_TIERS,
} from "../server/services/erx-script-messages";
import { classifyHttpFailure, readSurescriptsConfig } from "../server/services/erx-transport";

describe("parseDose", () => {
  it("reads magnitude and canonical unit from common dose strings", () => {
    expect(parseDose("10 mg")).toMatchObject({ value: 10, unit: "mg" });
    expect(parseDose("0.5MG")).toMatchObject({ value: 0.5, unit: "mg" });
    expect(parseDose("500mcg")).toMatchObject({ value: 500, unit: "mcg" });
    expect(parseDose("2 tablets")).toMatchObject({ value: 2, unit: "tab" });
    expect(parseDose("1,000 units")).toMatchObject({ value: 1000, unit: "unit" });
  });

  it("returns a null magnitude when there is no number to read", () => {
    expect(parseDose("as directed").value).toBeNull();
    expect(parseDose("").value).toBeNull();
    expect(parseDose(null).value).toBeNull();
    expect(parseDose(undefined).value).toBeNull();
  });
});

describe("assessDoseChange", () => {
  it("treats a strength change as material", () => {
    const result = assessDoseChange("10 mg", "20 mg");
    expect(result.isMaterial).toBe(true);
    expect(result.reason).toBe("strength_changed");
  });

  it("ignores whitespace- and case-only edits", () => {
    expect(assessDoseChange("10mg", "10 MG").isMaterial).toBe(false);
    expect(assessDoseChange("10 mg", "10mg").reason).toBe("identical");
  });

  it("treats equivalent mass units as unchanged", () => {
    // 1000 mcg and 1 mg are the same dose written two ways — cancelling the
    // pharmacy's prescription over a unit rewrite would be a false positive.
    expect(assessDoseChange("1000 mcg", "1 mg").isMaterial).toBe(false);
    expect(assessDoseChange("1 g", "1000 mg").isMaterial).toBe(false);
  });

  it("treats a change between incompatible units as material", () => {
    const result = assessDoseChange("2 tablets", "2 ml");
    expect(result.isMaterial).toBe(true);
    expect(result.reason).toBe("unit_changed");
  });

  it("does not fire when there was no prior dose on file", () => {
    const result = assessDoseChange(null, "10 mg");
    expect(result.isMaterial).toBe(false);
    expect(result.reason).toBe("no_previous_dose");
  });

  it("treats removing a dose as material", () => {
    const result = assessDoseChange("10 mg", "");
    expect(result.isMaterial).toBe(true);
    expect(result.reason).toBe("dose_removed");
  });

  it("flags an unparseable text change for a human rather than dropping it", () => {
    const result = assessDoseChange("as directed", "taper as tolerated");
    expect(result.isMaterial).toBe(true);
    expect(result.reason).toBe("unparseable_change");
  });
});

describe("buildIdempotencyKey", () => {
  const base = {
    profileId: "profile-1",
    medicationId: "med-1",
    medicationName: "Lisinopril",
    triggerType: "dose_change" as const,
  };

  it("is stable across identical inputs", () => {
    expect(buildIdempotencyKey(base)).toBe(buildIdempotencyKey({ ...base }));
  });

  it("ignores case and surrounding whitespace in the medication name", () => {
    expect(buildIdempotencyKey({ ...base, medicationName: "  lisinopril " })).toBe(
      buildIdempotencyKey(base),
    );
  });

  it("differs per patient, per trigger and per discriminator", () => {
    const key = buildIdempotencyKey(base);
    expect(buildIdempotencyKey({ ...base, profileId: "profile-2" })).not.toBe(key);
    expect(buildIdempotencyKey({ ...base, triggerType: "patient_deceased" })).not.toBe(key);
    expect(buildIdempotencyKey({ ...base, discriminator: "10mg->20mg" })).not.toBe(key);
  });

  it("does not leak the medication name into the key", () => {
    expect(buildIdempotencyKey(base)).not.toContain("isinopril");
    expect(buildIdempotencyKey(base)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("buildCancelRxMessage", () => {
  const baseInput = {
    requestId: "req-1",
    profileReference: "profile-1",
    medicationName: "Lisinopril",
    senderId: "TABULA-TEST",
    now: new Date("2026-08-15T12:00:00.000Z"),
    messageId: "msg-1",
  };

  it("carries the dose-change reason and the routing pharmacy", () => {
    const message = buildCancelRxMessage({
      ...baseInput,
      triggerType: "dose_change",
      previousDose: "10 mg",
      newDose: "20 mg",
      pharmacyNcpdpId: "1234567",
      pharmacyName: "Main Street Pharmacy",
      rxReferenceNumber: "RX-999",
      originalMessageId: "orig-1",
    });

    expect(message.header.messageId).toBe("msg-1");
    expect(message.header.scriptVersion).toBe(DEFAULT_SCRIPT_VERSION);
    expect(message.header.relatesToMessageId).toBe("orig-1");
    expect(message.header.to).toMatchObject({ qualifier: "D", identifier: "1234567" });
    expect(message.body.cancelRx.cancelReason.code).toBe(
      CANCEL_REASON_BY_TRIGGER.dose_change.code,
    );
    expect(message.body.cancelRx.medicationPrescribed).toMatchObject({
      drugDescription: "Lisinopril",
      strength: "10 mg",
      rxReferenceNumber: "RX-999",
    });
    expect(message.body.cancelRx.note).toContain("10 mg");
    expect(message.body.cancelRx.note).toContain("20 mg");
  });

  it("sets the deceased indicator and date only for the demise trigger", () => {
    const deceased = buildCancelRxMessage({
      ...baseInput,
      triggerType: "patient_deceased",
      deceasedDate: "2026-08-01",
    });
    expect(deceased.body.cancelRx.patient.deceasedIndicator).toBe(true);
    expect(deceased.body.cancelRx.patient.dateOfDeath).toBe("2026-08-01");

    const manual = buildCancelRxMessage({
      ...baseInput,
      triggerType: "patient_request",
      deceasedDate: "2026-08-01",
    });
    expect(manual.body.cancelRx.patient.deceasedIndicator).toBeUndefined();
    expect(manual.body.cancelRx.patient.dateOfDeath).toBeUndefined();
  });

  it("references the patient by opaque id and never by name", () => {
    const message = buildCancelRxMessage({ ...baseInput, triggerType: "medication_discontinued" });
    expect(message.body.cancelRx.patient.identifier).toBe("profile-1");
    expect(Object.keys(message.body.cancelRx.patient)).not.toContain("name");
  });

  it("marks the message unrouted rather than inventing a pharmacy id", () => {
    const message = buildCancelRxMessage({ ...baseInput, triggerType: "patient_request" });
    expect(message.header.to.identifier).toBe("UNROUTED");
  });

  it("produces a stable payload hash for identical messages", () => {
    const a = buildCancelRxMessage({ ...baseInput, triggerType: "therapy_completed" });
    const b = buildCancelRxMessage({ ...baseInput, triggerType: "therapy_completed" });
    expect(hashPayload(a)).toBe(hashPayload(b));
  });
});

describe("interpretCancelRxResponse", () => {
  it("treats an approval as an acknowledged, waste-avoiding cancellation", () => {
    expect(interpretCancelRxResponse({ responseStatus: "Approved" })).toMatchObject({
      status: "acknowledged",
      wasteAvoided: true,
      terminal: true,
    });
  });

  it("counts a denial as waste-avoided when the drug never left the pharmacy", () => {
    // AK = not picked up, returned to stock.
    expect(interpretCancelRxResponse({ responseStatus: "Denied", denialCode: "AK" })).toMatchObject({
      status: "denied",
      wasteAvoided: true,
    });
  });

  it("does not claim waste avoided when the patient already collected the drug", () => {
    const result = interpretCancelRxResponse({ responseStatus: "Denied", denialCode: "AH" });
    expect(result.status).toBe("denied");
    expect(result.wasteAvoided).toBe(false);
    expect(result.denialDescription).toMatch(/already picked up/i);
  });

  it("treats an unknown denial code conservatively", () => {
    const result = interpretCancelRxResponse({ responseStatus: "Denied", denialCode: "ZZ" });
    expect(result.wasteAvoided).toBe(false);
    expect(result.terminal).toBe(true);
    expect(result.denialDescription).toBeUndefined();
  });
});

describe("waste estimation", () => {
  it("returns zero when there is no remaining supply to waste", () => {
    expect(estimateWasteAvoidedCents({ medicationName: "Lisinopril", daysSupplyRemaining: 0 })).toBe(0);
    expect(estimateWasteAvoidedCents({ medicationName: "Lisinopril" })).toBe(0);
  });

  it("scales with the remaining days of supply", () => {
    const cents = estimateWasteAvoidedCents({
      medicationName: "lisinopril 10mg",
      daysSupplyRemaining: 30,
    });
    expect(cents).toBe(WASTE_COST_TIERS.generic * 30);
  });

  it("prices specialty medications on the specialty tier", () => {
    expect(classifyCostTier("adalimumab-atto")).toBe("specialty");
    expect(
      estimateWasteAvoidedCents({ medicationName: "adalimumab-atto", daysSupplyRemaining: 30 }),
    ).toBe(WASTE_COST_TIERS.specialty * 30);
  });

  it("defaults to the cheapest tier so the estimate stays conservative", () => {
    expect(classifyCostTier("hydrochlorothiazide 25 mg")).toBe("generic");
  });

  it("honours an explicit tier hint over the name heuristic", () => {
    expect(classifyCostTier("hydrochlorothiazide 25 mg", "brand")).toBe("brand");
  });
});

describe("retry policy", () => {
  it("backs off exponentially and stops climbing at the ceiling", () => {
    expect(nextRetryDelayMs(1)).toBe(30_000);
    expect(nextRetryDelayMs(2)).toBe(60_000);
    expect(nextRetryDelayMs(3)).toBe(120_000);
    expect(nextRetryDelayMs(50)).toBe(6 * 60 * 60 * 1000);
  });

  it("keeps the attempt budget finite", () => {
    expect(MAX_TRANSMISSION_ATTEMPTS).toBeGreaterThan(1);
    expect(MAX_TRANSMISSION_ATTEMPTS).toBeLessThanOrEqual(10);
  });
});

describe("transport configuration", () => {
  it("refuses to build a config from partial credentials", () => {
    expect(readSurescriptsConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(
      readSurescriptsConfig({
        SURESCRIPTS_ERX_ENDPOINT: "https://example.test/erx",
        SURESCRIPTS_ACCOUNT_ID: "acct",
      } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("builds a config once every credential is present", () => {
    const config = readSurescriptsConfig({
      SURESCRIPTS_ERX_ENDPOINT: "https://example.test/erx",
      SURESCRIPTS_ACCOUNT_ID: "acct",
      SURESCRIPTS_API_KEY: "key",
      SURESCRIPTS_SENDER_ID: "sender",
    } as NodeJS.ProcessEnv);

    expect(config).toMatchObject({ endpoint: "https://example.test/erx", senderId: "sender" });
    expect(config?.timeoutMs).toBeGreaterThan(0);
  });

  it("classifies transient gateway failures as retryable and auth failures as not", () => {
    expect(classifyHttpFailure(503).retryable).toBe(true);
    expect(classifyHttpFailure(429)).toMatchObject({ errorKind: "rate_limited", retryable: true });
    expect(classifyHttpFailure(401)).toMatchObject({ errorKind: "unauthorized", retryable: false });
    expect(classifyHttpFailure(400).retryable).toBe(false);
  });
});

describe("cancellation reasons", () => {
  it("defines a reason for every trigger", () => {
    for (const [trigger, reason] of Object.entries(CANCEL_REASON_BY_TRIGGER)) {
      expect(reason.code, `${trigger} is missing a code`).toBeTruthy();
      expect(reason.text.length, `${trigger} is missing text`).toBeGreaterThan(10);
    }
  });

  it("tells the pharmacy not to dispense on the demise path", () => {
    expect(CANCEL_REASON_BY_TRIGGER.patient_deceased.text).toMatch(/do not dispense/i);
  });
});
