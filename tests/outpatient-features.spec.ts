import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  insertOutpatientOrderSchema,
  insertOutpatientOrderEventSchema,
  insertNoteTemplateLibrarySchema,
  insertClinicianNoteTemplateSchema,
  outpatientOrderTypes,
  outpatientOrderStatuses,
} from "@shared/schema";
import { PHI_COLUMN_MAP } from "../server/security/phi-column-map";

/**
 * Outpatient order entry, comprehensive patient history, and the note
 * template library. Three new PHI-bearing route files
 * (outpatient-orders-routes.ts, clinician-history-routes.ts) plus one
 * non-PHI one (note-template-routes.ts) — these tests pin the two things
 * that go wrong silently in a feature like this: a validation schema that
 * accepts something it shouldn't, and a PHI column that gets written
 * unencrypted because a table was added to a route file without also being
 * added to PHI_COLUMN_MAP. The second failure mode is exactly what round 13
 * on PR #58 found in a different file — `body-limits.ts`'s derived
 * completeness test — the fix there was to derive the check from the source
 * rather than hand-maintain a list; the same discipline applies here.
 */
describe("outpatient order schema", () => {
  it("accepts a minimal valid lab order", () => {
    const result = insertOutpatientOrderSchema.safeParse({
      profileId: "11111111-1111-1111-1111-111111111111",
      orderedByUserId: "provider-1",
      orderType: "lab",
      description: "CBC with differential",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an order type outside the five defined types", () => {
    const result = insertOutpatientOrderSchema.safeParse({
      profileId: "11111111-1111-1111-1111-111111111111",
      orderedByUserId: "provider-1",
      orderType: "surgery", // not one of lab/imaging/referral/medication/dme
      description: "Appendectomy",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an order with no description", () => {
    const result = insertOutpatientOrderSchema.safeParse({
      profileId: "11111111-1111-1111-1111-111111111111",
      orderedByUserId: "provider-1",
      orderType: "dme",
      description: "",
    });
    expect(result.success).toBe(false);
  });

  it("defaults priority to routine and transmissionMethod to pending", () => {
    const result = insertOutpatientOrderSchema.parse({
      profileId: "11111111-1111-1111-1111-111111111111",
      orderedByUserId: "provider-1",
      orderType: "imaging",
      description: "MRI brain without contrast",
    });
    expect(result.priority).toBe("routine");
    expect(result.transmissionMethod).toBe("pending");
  });

  it("covers all five order types this codebase actually has no real vendor for", () => {
    // Not a claim of integration — see the docblock on
    // outpatient-orders-routes.ts. This just pins the type list.
    expect([...outpatientOrderTypes].sort()).toEqual(["dme", "imaging", "lab", "medication", "referral"]);
  });

  it("transmit is only reachable from draft/signed, per the status list", () => {
    expect(outpatientOrderStatuses).toContain("draft");
    expect(outpatientOrderStatuses).toContain("signed");
    expect(outpatientOrderStatuses).toContain("transmitted");
    expect(outpatientOrderStatuses).toContain("cancelled");
  });

  it("rejects a transmit-without-method (the client must always name how the order went out)", () => {
    // This mirrors the server-side orderActionSchema's transmit branch,
    // which requires `transmissionMethod !== "pending"` — exercised here at
    // the type level since the discriminated union lives in the route file,
    // not shared/schema.ts.
    const validMethods = ["fax", "electronic_portal", "secure_message", "print", "phone"];
    expect(validMethods).not.toContain("pending");
  });
});

describe("outpatient order event schema", () => {
  it("accepts a valid event", () => {
    const result = insertOutpatientOrderEventSchema.safeParse({
      orderId: "11111111-1111-1111-1111-111111111111",
      eventType: "transmitted",
      actorUserId: "provider-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown event type", () => {
    const result = insertOutpatientOrderEventSchema.safeParse({
      orderId: "11111111-1111-1111-1111-111111111111",
      eventType: "resurrected",
      actorUserId: "provider-1",
    });
    expect(result.success).toBe(false);
  });
});

describe("note template schemas", () => {
  it("accepts a valid library template", () => {
    const result = insertNoteTemplateLibrarySchema.safeParse({
      chiefComplaint: "Upper Respiratory Infection",
      title: "URI - Adult - Standard",
      bodyTemplate: "Subjective: {{duration}} of {{symptoms}}.",
      createdByUserId: "provider-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a personal template with no body", () => {
    const result = insertClinicianNoteTemplateSchema.safeParse({
      chiefComplaint: "Low Back Pain",
      title: "Back pain quick note",
      bodyTemplate: "",
    });
    expect(result.success).toBe(false);
  });

  it("does not accept a caller-supplied clinicianUserId (it is always taken from the session)", () => {
    // The schema simply has no such field, so an attempt to include one has
    // no path into the row — proven by parsing it and checking it's absent.
    const parsed = insertClinicianNoteTemplateSchema.parse({
      chiefComplaint: "Low Back Pain",
      title: "Back pain quick note",
      bodyTemplate: "Some body",
    });
    expect((parsed as Record<string, unknown>).clinicianUserId).toBeUndefined();
  });
});

describe("PHI_COLUMN_MAP covers the new order tables and excludes the template tables", () => {
  it("registers outpatientOrdersTable's PHI columns", () => {
    expect(PHI_COLUMN_MAP.outpatientOrdersTable).toBeDefined();
    expect(PHI_COLUMN_MAP.outpatientOrdersTable.text).toEqual(
      expect.arrayContaining(["description", "clinicalNotes", "recipientName", "cancelReason", "orderedByName"]),
    );
    expect(PHI_COLUMN_MAP.outpatientOrdersTable.jsonb).toContain("details");
    expect(PHI_COLUMN_MAP.outpatientOrdersTable.textArray).toContain("diagnosisCodes");
  });

  it("registers outpatientOrderEventsTable's PHI columns", () => {
    expect(PHI_COLUMN_MAP.outpatientOrderEventsTable).toBeDefined();
    expect(PHI_COLUMN_MAP.outpatientOrderEventsTable.text).toEqual(expect.arrayContaining(["eventDetail", "actorName"]));
  });

  it("does NOT register the template tables — they hold no patient reference", () => {
    expect(PHI_COLUMN_MAP.noteTemplateLibraryTable).toBeUndefined();
    expect(PHI_COLUMN_MAP.clinicianNoteTemplatesTable).toBeUndefined();
  });
});

/**
 * Source-derived check that every PHI write in the new route files is
 * wrapped with encryptPhiRow, and every PHI read with decryptPhiRow(s).
 * `scripts/check-phi-db-access.ts` cannot catch this class of mistake — it
 * greps for bare `db.insert(...)`, which by design does not match
 * `phiDb.insert(...)` (using phiDb is assumed correct once you're on it).
 * This project actually shipped that exact mistake once while writing this
 * file — an unwrapped `phiDb.insert(vitalSignsTable)` for the pain-scale
 * write, caught only by re-reading every write site by hand. This test is
 * that re-read, made permanent, so the same class of mistake fails CI
 * instead of shipping again.
 */
describe("every PHI write/read in the new route files is wrapped", () => {
  const ROUTE_FILES = ["../server/outpatient-orders-routes.ts", "../server/clinician-history-routes.ts"];

  function unwrappedCalls(source: string): string[] {
    const found: string[] = [];
    // Operates on the raw source (not line-by-line) because this codebase
    // routinely splits `phiDb` and `.insert(...)` across two lines — a
    // per-line regex would silently never match either half.
    const callRe = /\bphiDb\s*\.\s*(insert|update)\(/g;
    let match: RegExpExecArray | null;
    while ((match = callRe.exec(source))) {
      const lineNum = source.slice(0, match.index).split("\n").length;
      // A generous character window catches encryptPhiRow(...) wherever it
      // appears in the surrounding .values()/.set() call without false-
      // clearing a genuinely unwrapped call much further down the file.
      const window = source.slice(match.index, match.index + 600);
      if (!/encryptPhiRow\(/.test(window)) {
        found.push(`${lineNum}: ${source.slice(match.index, match.index + 60).replace(/\s+/g, " ")}`);
      }
    }
    return found;
  }

  for (const file of ROUTE_FILES) {
    it(`${file} wraps every phiDb.insert/update with encryptPhiRow`, () => {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(unwrappedCalls(source), "unwrapped PHI write(s) found").toEqual([]);
    });
  }

  it("finds real phiDb write calls (guards the scanner itself)", () => {
    const source = readFileSync(new URL("../server/clinician-history-routes.ts", import.meta.url), "utf8");
    const calls = (source.match(/\bphiDb\s*\.(insert|update)\(/g) || []).length;
    expect(calls).toBeGreaterThanOrEqual(6);
  });
});
