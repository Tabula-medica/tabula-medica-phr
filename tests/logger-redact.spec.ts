/**
 * F1 Session 1 verification — pino redact PHI proof.
 *
 * Demonstrates the difference between object-form and string-interpolation
 * logger calls so the team can see *why* Phase-2 restructuring is mandatory,
 * not optional.
 *
 * Object-form  → redact engages, PHI never reaches stdout.
 * String-form  → redact CANNOT see inside the message, PHI leaks verbatim.
 */

import { describe, it, expect } from "vitest";
import { Writable } from "node:stream";
import pino from "pino";
import { PHI_FIELD_NAMES } from "../server/security/phi-column-map";

function buildRedactPaths(): string[] {
  const paths = new Set<string>();
  for (const k of PHI_FIELD_NAMES) {
    paths.add(k);
    paths.add(`*.${k}`);
    paths.add(`*.*.${k}`);
    paths.add(`req.body.${k}`);
    paths.add(`req.query.${k}`);
    paths.add(`res.body.${k}`);
    paths.add(`body.${k}`);
    paths.add(`payload.${k}`);
  }
  paths.add("patient");
  paths.add("*.patient");
  return Array.from(paths);
}

function captureLoggerOutput(fn: (log: pino.Logger) => void): string {
  let captured = "";
  const sink = new Writable({
    write(chunk, _enc, cb) {
      captured += chunk.toString();
      cb();
    },
  });
  const log = pino(
    {
      level: "debug",
      redact: { paths: buildRedactPaths(), censor: "[PHI_REDACTED]" },
    },
    sink,
  );
  fn(log);
  return captured;
}

describe("logger PHI redaction", () => {
  it("OBJECT-FORM: redacts patient.firstName when passed as a structured field", () => {
    const out = captureLoggerOutput((log) =>
      log.info({ patient: { firstName: "TESTLEAK_OBJ" } }, "patient updated"),
    );

    expect(out).not.toContain("TESTLEAK_OBJ");
    expect(out).toContain("[PHI_REDACTED]");
    expect(out).toContain("patient updated");
  });

  it("OBJECT-FORM: redacts top-level email/mrn/dob fields", () => {
    const out = captureLoggerOutput((log) =>
      log.info(
        {
          email: "leak1@test.com",
          mrn: "TESTLEAK_MRN",
          dob: "1980-01-01",
          ssn: "999-00-1234",
        },
        "user record",
      ),
    );

    expect(out).not.toContain("leak1@test.com");
    expect(out).not.toContain("TESTLEAK_MRN");
    expect(out).not.toContain("1980-01-01");
    expect(out).not.toContain("999-00-1234");
    // Each redacted key emits one censor; expect at least 4.
    const censorCount = (out.match(/\[PHI_REDACTED\]/g) ?? []).length;
    expect(censorCount).toBeGreaterThanOrEqual(4);
  });

  it("OBJECT-FORM: redacts nested req.body.email (express body shape)", () => {
    const out = captureLoggerOutput((log) =>
      log.info({ req: { body: { email: "TESTLEAK_BODY@x.com" } } }, "req in"),
    );
    expect(out).not.toContain("TESTLEAK_BODY");
    expect(out).toContain("[PHI_REDACTED]");
  });

  it("STRING-FORM (the trap): does NOT redact PHI baked into the message", () => {
    const out = captureLoggerOutput((log) =>
      log.info(`Patient updated: TESTLEAK_STR firstName=John email=jane@x.com`),
    );

    // This is the failure mode the team must understand:
    expect(out).toContain("TESTLEAK_STR");
    expect(out).toContain("jane@x.com");
    expect(out).not.toContain("[PHI_REDACTED]");
  });

  it("STRING-FORM (the trap): template literal with ${patient.firstName} also leaks", () => {
    const patient = { firstName: "TESTLEAK_TEMPLATE", email: "leak2@x.com" };
    const out = captureLoggerOutput((log) =>
      // Mimics the existing 51 Phase-1 conversions exactly.
      log.info(`Updated patient ${patient.firstName} <${patient.email}>`),
    );

    expect(out).toContain("TESTLEAK_TEMPLATE");
    expect(out).toContain("leak2@x.com");
    expect(out).not.toContain("[PHI_REDACTED]");
  });

  it("PRODUCTION-SHAPE (logHipaaAudit): redacts decrypted PHI but leaves opaque UUIDs visible", () => {
    // Mirrors server/patient-health-record-routes.ts logHipaaAudit() exactly.
    // The Session 2a fix was: spread `details` into top-level keys instead of
    // burying them in JSON.stringify(). This test proves the spread shape is
    // redact-eligible for the keys that matter.
    //
    // POLICY (reviewer-approved 2026-04-18, Decision 1):
    //   Opaque UUIDs (patientId, profileId, userId, granteeId, packageId, ...)
    //   are NOT PHI under HIPAA Safe Harbor (45 CFR §164.514(b)(2)). They are
    //   foreign-key pointers into encrypted tables — meaningless without DB
    //   access, which is itself behind the F1 encryption wrapper. They REMAIN
    //   VISIBLE in audit logs so incident responders can trace user actions
    //   (a §164.312(b) requirement).
    //
    //   Decrypted PHI fields (mrn, email, firstName, dob, ssn, ...) ARE
    //   redacted via PHI_FIELD_NAMES. That is what this test verifies.
    //
    // See: .local/deliverables/object-form-conversion-template.md
    //      § "What counts as PHI vs. opaque identifiers"
    const action = "READ_MEDICATIONS";
    const details = {
      profileId: "TESTLEAK_PROFILE_UUID",
      patientId: "TESTLEAK_PATIENT_UUID",
      userId: "TESTLEAK_USER_UUID",
      mrn: "TESTLEAK_MRN_99",
      email: "phr-leak@example.com",
    };

    const out = captureLoggerOutput((log) =>
      log.info(
        { component: "PHR", audit: "HIPAA", action, ...details },
        "PHI access",
      ),
    );

    // Decrypted PHI fields MUST be redacted.
    expect(out).not.toContain("TESTLEAK_MRN_99");
    expect(out).not.toContain("phr-leak@example.com");

    // Opaque UUIDs MUST remain visible for forensic traceability.
    expect(out).toContain("TESTLEAK_PROFILE_UUID");
    expect(out).toContain("TESTLEAK_PATIENT_UUID");
    expect(out).toContain("TESTLEAK_USER_UUID");

    // Non-PHI scaffolding stays visible (proves only PHI was redacted).
    expect(out).toContain("PHR");
    expect(out).toContain("HIPAA");
    expect(out).toContain("READ_MEDICATIONS");
    expect(out).toContain("PHI access");

    // Exactly 2 redactions: mrn + email. Anything more means we accidentally
    // pulled an opaque ID into PHI_FIELD_NAMES; anything less means a true PHI
    // field stopped being redacted.
    const censorCount = (out.match(/\[PHI_REDACTED\]/g) ?? []).length;
    expect(censorCount).toBe(2);
  });

  it("PRE-FIX REGRESSION GUARD: JSON.stringify(details) inside template DOES leak", () => {
    // This is the bug Session 2a fixed. Keeping it in the suite as a regression
    // guard so anyone tempted to "log a single tidy JSON line" sees the failure mode.
    const details = {
      profileId: "TESTLEAK_PRE_FIX_PROFILE",
      patientId: "TESTLEAK_PRE_FIX_PATIENT",
    };

    const out = captureLoggerOutput((log) =>
      log.info(`[HIPAA_AUDIT][PHR] | READ | ${JSON.stringify(details)}`),
    );

    // PHI leaks because redact cannot see inside the message string.
    expect(out).toContain("TESTLEAK_PRE_FIX_PROFILE");
    expect(out).toContain("TESTLEAK_PRE_FIX_PATIENT");
    expect(out).not.toContain("[PHI_REDACTED]");
  });

  it("redact path list is non-empty and was built from PHI_FIELD_NAMES", () => {
    const paths = buildRedactPaths();
    expect(paths.length).toBeGreaterThan(50);
    expect(paths).toContain("email");
    expect(paths).toContain("mrn");
    expect(paths).toContain("ssn");
    expect(paths).toContain("dob");
    expect(paths).toContain("firstName");
    expect(paths).toContain("lastName");
    expect(paths).toContain("req.body.email");
  });
});
