import { describe, it, expect } from "vitest";
import {
  JURISDICTIONS,
  UNKNOWN_JURISDICTION,
  nhsNumberIsValid,
  resolveJurisdiction,
  validateHealthId,
  verhoeffIsValid,
} from "@shared/jurisdictions";

describe("verhoeffIsValid (ABHA / Aadhaar check digit)", () => {
  it("accepts the canonical worked example", () => {
    expect(verhoeffIsValid("2363")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(verhoeffIsValid("2364")).toBe(false);
  });

  it("catches transposition, which is why UIDAI chose Verhoeff over Luhn", () => {
    expect(verhoeffIsValid("12345678901230")).toBe(true);
    // swap two adjacent digits — Luhn would miss this class of typo
    expect(verhoeffIsValid("12345678901320")).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(verhoeffIsValid("12a4")).toBe(false);
  });
});

describe("nhsNumberIsValid", () => {
  it("accepts a valid NHS number", () => {
    expect(nhsNumberIsValid("9434765919")).toBe(true);
  });

  it("rejects a single-digit typo", () => {
    expect(nhsNumberIsValid("9434765918")).toBe(false);
  });

  it("rejects the wrong length", () => {
    expect(nhsNumberIsValid("943476591")).toBe(false);
  });
});

describe("resolveJurisdiction", () => {
  it("resolves case-insensitively", () => {
    expect(resolveJurisdiction("in").code).toBe("IN");
    expect(resolveJurisdiction("IN").name).toBe("India");
  });

  it("falls back rather than throwing for unknown countries", () => {
    expect(resolveJurisdiction("XX")).toBe(UNKNOWN_JURISDICTION);
    expect(resolveJurisdiction(null)).toBe(UNKNOWN_JURISDICTION);
    expect(resolveJurisdiction(undefined)).toBe(UNKNOWN_JURISDICTION);
  });

  it("records the governing privacy regime, not a US default", () => {
    expect(resolveJurisdiction("IN").privacyRegime).toBe("DPDP-2023");
    expect(resolveJurisdiction("DE").privacyRegime).toBe("GDPR");
    expect(resolveJurisdiction("US").privacyRegime).toBe("HIPAA");
  });

  it("has no duplicate country codes", () => {
    const codes = JURISDICTIONS.map((j) => j.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("validateHealthId", () => {
  const india = resolveJurisdiction("IN");
  const germany = resolveJurisdiction("DE");

  it("accepts a well-formed ABHA number with formatting", () => {
    const result = validateHealthId(india, "12-3456-7890-1230");
    expect(result).toEqual({
      ok: true,
      normalized: "12345678901230",
      system: "https://healthid.abdm.gov.in/ns/abha-number",
    });
  });

  it("distinguishes a malformed ID from one that fails its check digit", () => {
    expect(validateHealthId(india, "123")).toEqual({
      ok: false,
      reason: "malformed",
    });
    expect(validateHealthId(india, "12345678901231")).toEqual({
      ok: false,
      reason: "checksum-failed",
    });
  });

  it("reports empty input distinctly", () => {
    expect(validateHealthId(india, "   ")).toEqual({ ok: false, reason: "empty" });
  });

  it("reports when a jurisdiction operates no national health ID", () => {
    expect(validateHealthId(germany, "123456")).toEqual({
      ok: false,
      reason: "no-scheme",
    });
  });
});
