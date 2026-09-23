import { describe, it, expect } from "vitest";
import { resolveVitalType, normalizeUnit } from "../server/routes/rpm-device-routes";

describe("resolveVitalType", () => {
  it.each([
    ["spo2", "oxygen_saturation"],
    ["hr", "heart_rate"],
    ["bp_systolic", "blood_pressure_systolic"],
    ["temp", "temperature"],
  ])("maps vendor alias %s to %s", (alias, expected) => {
    expect(resolveVitalType(alias)).toBe(expected);
  });

  it("returns null for an unrecognized vital_type", () => {
    expect(resolveVitalType("ecg_waveform")).toBeNull();
  });
});

describe("normalizeUnit", () => {
  it("passes through a value already in the canonical unit", () => {
    expect(normalizeUnit("heart_rate", 72, "bpm")).toEqual({ value: 72, unit: "bpm" });
  });

  it("converts kg to lbs for weight", () => {
    const result = normalizeUnit("weight", 70, "kg");
    expect(result).not.toBeNull();
    expect(result!.value).toBeCloseTo(154.3, 0);
    expect(result!.unit).toBe("lbs");
  });

  it("converts Celsius to Fahrenheit for temperature", () => {
    expect(normalizeUnit("temperature", 37, "°C")).toEqual({ value: 99, unit: "°F" });
  });

  it("converts mmol/L to mg/dL for blood glucose", () => {
    const result = normalizeUnit("blood_glucose", 7, "mmol/L");
    expect(result).not.toBeNull();
    expect(result!.value).toBeCloseTo(126.1, 1);
    expect(result!.unit).toBe("mg/dL");
  });

  it("rejects an unrecognized unit rather than guessing", () => {
    // A vendor sending "F" won't be silently treated as the canonical
    // symbol form unless explicitly aliased — this locks that in.
    expect(normalizeUnit("blood_pressure_systolic", 132, "kPa")).toBeNull();
  });

  it("is case-insensitive on the unit string", () => {
    expect(normalizeUnit("oxygen_saturation", 97, "PERCENT")).toEqual({ value: 97, unit: "%" });
  });
});
