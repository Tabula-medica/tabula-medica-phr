import { describe, it, expect } from "vitest";
import {
  validateAuditAction,
  assertSafeAuditAction,
  AuditActionPhiViolation,
} from "../server/security/audit-action-validator";

describe("audit-action-validator — accepts safe action codes", () => {
  it.each([
    "LOGIN",
    "LOGOUT",
    "VIEW_PATIENT_RECORD",
    "EXPORT_PATIENT_BUNDLE",
    "MFA_VERIFY",
    "patient.read",
    "Patient.read",
    "fhir.observation.create",
    "AUDIT_VIEW",
  ])("accepts %s", (action) => {
    expect(validateAuditAction(action)).toEqual({ ok: true });
  });
});

describe("audit-action-validator — rejects email patterns", () => {
  it.each([
    "view_jane.doe@example.com_record",
    "EXPORT(jane@clinic.org)",
    "lookup user:test+tag@hospital.health",
  ])("rejects %s", (action) => {
    const verdict = validateAuditAction(action);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.matched).toBe("email");
  });
});

describe("audit-action-validator — rejects SSN patterns", () => {
  it.each([
    "verify_ssn_123-45-6789",
    "EXPORT 123 45 6789",
    "lookup 123.45.6789",
    "audit ssn=987654321",
  ])("rejects %s", (action) => {
    const verdict = validateAuditAction(action);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.matched).toBe("ssn");
  });
});

describe("audit-action-validator — rejects DOB patterns", () => {
  it.each([
    "VIEW_DOB 1985-03-12",
    "lookup_2001/07/04_record",
    "audit-1990.12.25-event",
  ])("rejects YYYY-first %s", (action) => {
    const verdict = validateAuditAction(action);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.matched).toBe("dob_yyyy_mm_dd");
  });

  it.each([
    "VIEW_DOB 03/12/1985",
    "lookup-07/04/2001-record",
    "audit_12.25.1990_event",
  ])("rejects MM-first %s", (action) => {
    const verdict = validateAuditAction(action);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.matched).toBe("dob_mm_dd_yyyy");
  });
});

describe("audit-action-validator — rejects phone patterns", () => {
  it.each([
    "callback to 415-555-0123",
    "patient (415) 555-0123",
    "+1-415-555-0123",
    "phone 4155550123",
  ])("rejects %s", (action) => {
    const verdict = validateAuditAction(action);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.matched).toBe("phone");
  });
});

describe("audit-action-validator — rejects MRN patterns", () => {
  it.each([
    "lookup MRN-12345",
    "view mrn:67890",
    "EXPORT MRN 999999",
  ])("rejects %s", (action) => {
    const verdict = validateAuditAction(action);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.matched).toBe("mrn");
  });
});

describe("audit-action-validator — rejects ZIP+4 patterns", () => {
  it("rejects ZIP+4 sequences", () => {
    const verdict = validateAuditAction("audit zip 94110-1234 lookup");
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.matched).toBe("zip_plus4");
  });
});

describe("audit-action-validator — rejects two-token name shape", () => {
  it.each([
    "VIEW John Smith record",
    "EXPORT for Jane Doe",
    "audit Maria Rodriguez account",
  ])("rejects %s", (action) => {
    const verdict = validateAuditAction(action);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.matched).toBe("name_two_token");
  });
});

describe("audit-action-validator — guards against degenerate inputs", () => {
  it("rejects non-string input", () => {
    // @ts-expect-error intentional bad input
    const verdict = validateAuditAction(undefined);
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.matched).toBe("non_string");
  });

  it("rejects oversize action strings", () => {
    const verdict = validateAuditAction("A".repeat(257));
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.matched).toBe("oversize");
  });
});

describe("audit-action-validator — assertSafeAuditAction throws on violations", () => {
  it("throws AuditActionPhiViolation with pattern + sample", () => {
    try {
      assertSafeAuditAction("export jane@example.com data");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AuditActionPhiViolation);
      expect((err as AuditActionPhiViolation).pattern).toBe("email");
      expect((err as AuditActionPhiViolation).sample).toContain("@");
    }
  });

  it("does not throw on safe actions", () => {
    expect(() => assertSafeAuditAction("VIEW_PATIENT_RECORD")).not.toThrow();
  });
});
