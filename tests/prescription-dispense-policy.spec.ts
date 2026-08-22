import { describe, it, expect } from "vitest";
import {
  DEFAULT_DAYS_SUPPLY,
  DEFAULT_REFILLS,
  NEW_START_DAYS_SUPPLY,
  dosesPerDayFromFrequency,
  resolveDispenseDefaults,
  type DispenseClass,
} from "../server/services/prescription-dispense-policy";

describe("the product default", () => {
  it("gives chronic maintenance drugs 100 days with 1 refill, outpatient", () => {
    const r = resolveDispenseDefaults({
      dispenseClass: "chronic-maintenance",
      dosesPerDay: 1,
    });
    expect(r.daysSupply).toBe(100);
    expect(r.refills).toBe(1);
    expect(r.careSetting).toBe("outpatient");
    expect(r.appliedPolicy).toBe("standard-100-day");
    expect(r.capReason).toBeUndefined();
  });

  it("matches the exported constants", () => {
    const r = resolveDispenseDefaults({
      dispenseClass: "chronic-maintenance",
      dosesPerDay: 1,
    });
    expect(r.daysSupply).toBe(DEFAULT_DAYS_SUPPLY);
    expect(r.refills).toBe(DEFAULT_REFILLS);
  });

  it("scales quantity by doses per day", () => {
    expect(
      resolveDispenseDefaults({ dispenseClass: "chronic-maintenance", dosesPerDay: 2 })
        .quantity,
    ).toBe(200);
    expect(
      resolveDispenseDefaults({ dispenseClass: "chronic-maintenance", dosesPerDay: 3 })
        .quantity,
    ).toBe(300);
  });

  it("rounds a fractional regimen up to a whole dose unit", () => {
    // Weekly dosing over 100 days is 14.28 doses — you cannot dispense .28.
    const r = resolveDispenseDefaults({
      dispenseClass: "chronic-maintenance",
      dosesPerDay: 1 / 7,
    });
    expect(r.quantity).toBe(15);
  });

  it("treats a nonsensical doses-per-day as one rather than dispensing zero", () => {
    const r = resolveDispenseDefaults({
      dispenseClass: "chronic-maintenance",
      dosesPerDay: 0,
    });
    expect(r.quantity).toBe(100);
  });
});

describe("class caps — drugs that must not take the extended default", () => {
  const cases: Array<[DispenseClass, number, number]> = [
    ["acute-course", 14, 0],
    ["guideline-limited-course", 56, 0],
    ["monitoring-bound", 30, 0],
    ["controlled-schedule-ii", 30, 0],
    ["controlled-schedule-iii-v", 30, 1],
    ["rems-restricted", 30, 0],
    ["prn-rescue", 30, 1],
    ["unclassified", 30, 0],
  ];

  it.each(cases)(
    "%s is capped at %i days / %i refills",
    (dispenseClass, days, refills) => {
      const r = resolveDispenseDefaults({ dispenseClass, dosesPerDay: 1 });
      expect(r.daysSupply).toBe(days);
      expect(r.refills).toBe(refills);
      expect(r.appliedPolicy).toBe("class-capped");
      expect(r.capReason).toBeTruthy();
    },
  );

  it("never emits a refillable Schedule II prescription", () => {
    // 21 CFR 1306.12 — Schedule II cannot be refilled at all.
    const r = resolveDispenseDefaults({
      dispenseClass: "controlled-schedule-ii",
      dosesPerDay: 1,
      requestedRefills: 5,
      requestedDaysSupply: 100,
    });
    expect(r.refills).toBe(0);
    expect(r.daysSupply).toBe(30);
  });

  it("never emits a 100-day antibiotic course", () => {
    const r = resolveDispenseDefaults({
      dispenseClass: "acute-course",
      dosesPerDay: 3,
      requestedDaysSupply: 100,
    });
    expect(r.daysSupply).toBe(14);
    expect(r.quantity).toBe(42);
  });

  it("keeps the refill interval as the lab-monitoring interlock", () => {
    const r = resolveDispenseDefaults({
      dispenseClass: "monitoring-bound",
      dosesPerDay: 1,
      requestedDaysSupply: 100,
      requestedRefills: 1,
    });
    expect(r.daysSupply).toBe(30);
    expect(r.refills).toBe(0);
    expect(r.capReason).toContain("monitoring");
  });
});

describe("prescriber overrides", () => {
  it("honours a shorter request for a chronic drug", () => {
    const r = resolveDispenseDefaults({
      dispenseClass: "chronic-maintenance",
      dosesPerDay: 1,
      requestedDaysSupply: 45,
    });
    expect(r.daysSupply).toBe(45);
    expect(r.quantity).toBe(45);
    expect(r.appliedPolicy).toBe("prescriber-override");
  });

  it("honours extra refills for a chronic drug", () => {
    const r = resolveDispenseDefaults({
      dispenseClass: "chronic-maintenance",
      dosesPerDay: 1,
      requestedRefills: 3,
    });
    expect(r.refills).toBe(3);
  });

  it("cannot override through a class cap", () => {
    const r = resolveDispenseDefaults({
      dispenseClass: "rems-restricted",
      dosesPerDay: 1,
      requestedDaysSupply: 100,
      requestedRefills: 2,
    });
    expect(r.daysSupply).toBe(30);
    expect(r.refills).toBe(0);
    expect(r.appliedPolicy).toBe("class-capped");
  });

  it("allows an explicit zero-refill request", () => {
    const r = resolveDispenseDefaults({
      dispenseClass: "chronic-maintenance",
      dosesPerDay: 1,
      requestedRefills: 0,
    });
    expect(r.refills).toBe(0);
  });
});

describe("new starts", () => {
  it("shortens the first fill of a chronic drug", () => {
    const r = resolveDispenseDefaults({
      dispenseClass: "chronic-maintenance",
      dosesPerDay: 1,
      isNewStart: true,
    });
    expect(r.daysSupply).toBe(NEW_START_DAYS_SUPPLY);
    expect(r.appliedPolicy).toBe("new-start");
    expect(r.capReason).toContain("tolerance");
  });

  it("does not lengthen a request that is already shorter", () => {
    const r = resolveDispenseDefaults({
      dispenseClass: "chronic-maintenance",
      dosesPerDay: 1,
      isNewStart: true,
      requestedDaysSupply: 7,
    });
    expect(r.daysSupply).toBe(7);
  });

  it("still yields to a stricter class cap", () => {
    const r = resolveDispenseDefaults({
      dispenseClass: "acute-course",
      dosesPerDay: 1,
      isNewStart: true,
    });
    expect(r.daysSupply).toBe(14);
    expect(r.appliedPolicy).toBe("class-capped");
  });
});

describe("care setting", () => {
  it("does not apply a days-supply default to inpatient orders", () => {
    const r = resolveDispenseDefaults({
      dispenseClass: "chronic-maintenance",
      dosesPerDay: 2,
      careSetting: "inpatient",
    });
    expect(r.daysSupply).toBe(1);
    expect(r.refills).toBe(0);
    expect(r.quantity).toBe(2);
    expect(r.appliedPolicy).toBe("inpatient");
  });

  it("defaults to outpatient when unspecified", () => {
    expect(
      resolveDispenseDefaults({ dispenseClass: "chronic-maintenance", dosesPerDay: 1 })
        .careSetting,
    ).toBe("outpatient");
  });
});

describe("dosesPerDayFromFrequency", () => {
  it.each([
    ["once daily", 1],
    ["twice daily", 2],
    ["three times daily", 3],
    ["four times daily", 4],
    ["BID", 2],
    ["TID", 3],
    ["once daily at bedtime", 1],
    ["once daily on empty stomach", 1],
    ["every 12 hours", 2],
    ["every other day", 0.5],
    ["weekly", 1 / 7],
  ])("reads %s as %s doses/day", (input, expected) => {
    expect(dosesPerDayFromFrequency(input)).toBe(expected);
  });

  it("returns null rather than guessing on an unreadable frequency", () => {
    // Guessing 1 here would silently under-dispense a 4-times-daily regimen.
    expect(dosesPerDayFromFrequency("as directed by the specialist")).toBeNull();
    expect(dosesPerDayFromFrequency("")).toBeNull();
  });
});
