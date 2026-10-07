/**
 * Patient Operations Hub — tests for the pure, deterministic logic only
 * (template catalog, answer filtering, status-step derivation).
 *
 * What is NOT covered here: the actual Drizzle round trip through
 * `db`/`phiDb` (createAssignment, submitResponse, runEligibilityCheck,
 * getLatestEligibility) — this test environment has no live Postgres
 * connection, and mocking the DB client would only prove the mock behaves
 * as mocked, not that the real insert/select statements are correct. That
 * gap is the same shape as the one already-honest limitation documented
 * for `docs/complete-chart-summary-connector.md`'s eCW sync: stated here
 * rather than papered over with a mock.
 */
import { describe, it, expect } from "vitest";
import { SEED_FORM_TEMPLATES, findTemplate, filterAnswers } from "../server/services/patient-operations/forms-service";
import { formsStep, eligibilityStep } from "../server/services/patient-operations/status";
import type { IntakeFormAssignment, IntakeFormTemplate, PersistedEligibilityCheck } from "../shared/patient-operations";

describe("SEED_FORM_TEMPLATES", () => {
  it("is a closed, non-empty catalog with unique field ids per template", () => {
    expect(SEED_FORM_TEMPLATES.length).toBeGreaterThan(0);
    for (const template of SEED_FORM_TEMPLATES) {
      const ids = template.fields.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("findTemplate returns undefined for an unknown id rather than throwing", () => {
    expect(findTemplate("not-a-real-template")).toBeUndefined();
  });
});

describe("filterAnswers", () => {
  const template = findTemplate("consent-to-treat")!;

  it("keeps answers for fields that exist on the template", () => {
    const { answers, discardedFields } = filterAnswers(template, {
      consentToTreat: true,
      consentToCommunicate: true,
      signatureName: "Jane Doe",
    });
    expect(answers).toEqual({ consentToTreat: true, consentToCommunicate: true, signatureName: "Jane Doe" });
    expect(discardedFields).toEqual([]);
  });

  it("discards any key not on the template instead of storing it", () => {
    const { answers, discardedFields } = filterAnswers(template, {
      consentToTreat: true,
      ssn: "123-45-6789", // not a field on this template — must never be persisted
      role: "admin", // a crafted privilege-escalation-shaped key — must also be dropped
    });
    expect(answers).toEqual({ consentToTreat: true });
    expect(discardedFields.sort()).toEqual(["role", "ssn"]);
  });

  it("discards everything and persists nothing when the template has no fields (unknown template id)", () => {
    const emptyTemplate: IntakeFormTemplate = { id: "consent-to-treat", title: "", description: "", fields: [] };
    const { answers, discardedFields } = filterAnswers(emptyTemplate, { anything: "value" });
    expect(answers).toEqual({});
    expect(discardedFields).toEqual(["anything"]);
  });
});

describe("formsStep", () => {
  const base: Omit<IntakeFormAssignment, "status"> = {
    id: "a1",
    unifiedPatientId: "u1",
    templateId: "new-patient-intake",
    token: "t1",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1000).toISOString(),
  };

  it("reports not-started with no assignments", () => {
    expect(formsStep([]).status).toBe("not-started");
  });

  it("reports complete only when every assignment is submitted", () => {
    const step = formsStep([{ ...base, status: "submitted" }]);
    expect(step.status).toBe("complete");
  });

  it("reports needs-attention when a form expired unsubmitted and nothing else is pending", () => {
    const step = formsStep([{ ...base, status: "expired" }]);
    expect(step.status).toBe("needs-attention");
  });

  it("reports in-progress when some are submitted and others still pending", () => {
    const step = formsStep([
      { ...base, id: "a1", status: "submitted" },
      { ...base, id: "a2", status: "pending" },
    ]);
    expect(step.status).toBe("in-progress");
  });
});

describe("eligibilityStep", () => {
  const base: PersistedEligibilityCheck = {
    id: "e1",
    unifiedPatientId: "u1",
    active: true,
    source: "clearinghouse",
    checkedAt: new Date().toISOString(),
  };

  it("reports not-started with no check on file", () => {
    expect(eligibilityStep(undefined).status).toBe("not-started");
  });

  it("reports needs-attention when coverage is inactive", () => {
    expect(eligibilityStep({ ...base, active: false }).status).toBe("needs-attention");
  });

  it("never reports a stub check as complete or verified — this is the honesty guarantee the whole bridge exists for", () => {
    const step = eligibilityStep({ ...base, source: "stub" });
    expect(step.status).toBe("needs-attention");
    expect(step.detail.toLowerCase()).toContain("stub");
  });

  it("reports complete for a fresh, active, non-stub check", () => {
    expect(eligibilityStep(base).status).toBe("complete");
  });

  it("reports needs-attention when a real check is stale (>30 days)", () => {
    const stale = { ...base, checkedAt: new Date(Date.now() - 40 * 86_400_000).toISOString() };
    expect(eligibilityStep(stale).status).toBe("needs-attention");
  });
});
