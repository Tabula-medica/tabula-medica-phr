/**
 * Regression tests for Task #131: Patient deduplication / Master Patient Index
 * (MPI) match-scoring logic that decides whether two health records belong to
 * the same patient and should be merged.
 *
 * This is one of the highest-risk areas of the app: a false-positive merge
 * exposes one patient another patient's records, while a false-negative leaves
 * a patient's own records fragmented. These tests pin the deterministic and
 * probabilistic scoring paths in both MPI services and the edge cases that
 * historically cause mis-matches:
 *
 *   - missing middle name (NMN / "No Middle Name")
 *   - conflicting date of birth
 *   - transposed first/last name
 *   - same-name-different-patient
 *
 * The pure scoring primitives and the private probabilistic scorer are tested
 * directly (no DB). The DB-backed `checkForDuplicates` merge-decision path is
 * tested by swapping the shared drizzle `db.select` for an in-memory stub on
 * the singleton `db` object (the service holds the same object reference), so
 * no real Postgres connection is required.
 *
 * Run via: node --import tsx server/__tests__/mpi-deduplication.test.ts
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL || "postgres://test:test@127.0.0.1:5432/test";

import {
  levenshteinSimilarity,
  jaroWinklerSimilarity,
  normalizeMiddleName,
  compareMiddleNames,
  normalizePhoneNumber,
  comparePhoneNumbers,
  normalizeSSN,
  compareDates,
  patientMatchingService,
  NMN_MARKER,
  type PatientIdentifier,
} from "../mpi/patient-matching-service";
import { DeduplicationService } from "../deduplication-service";
import { db } from "../db";
import { patientProfiles, patientIdentifiers } from "@shared/schema";

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ok    ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

function approx(label: string, actual: number, expected: number, tol = 0.02): void {
  ok(`${label} (got ${actual.toFixed(4)}, want ~${expected})`, Math.abs(actual - expected) <= tol);
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

/**
 * Minimal in-memory stand-in for the chained drizzle query builder used by
 * DeduplicationService. Only the call shapes the service actually uses are
 * supported: db.select(..).from(table)[.where(..)] and the convenience
 * .orderBy/.limit no-ops. Resolves to the rows configured for the given table.
 */
function installDbSelectMock(rows: { identifiers?: any[]; profiles?: any[] }): void {
  (db as any).select = (_fields?: any) => ({
    from(table: any) {
      const data =
        table === patientIdentifiers
          ? rows.identifiers || []
          : table === patientProfiles
            ? rows.profiles || []
            : [];
      const q: any = {
        where: () => q,
        orderBy: () => q,
        limit: () => q,
        then: (res: (v: any) => void, rej: (e: any) => void) =>
          Promise.resolve(data).then(res, rej),
      };
      return q;
    },
  });
}

const realSelect = (db as any).select;
function restoreDb(): void {
  (db as any).select = realSelect;
}

(async () => {
  const dedup = DeduplicationService.getInstance();

  // ─── 1. patient-matching: pure string-similarity primitives ──────────────

  section("patient-matching: string similarity primitives");

  ok("levenshteinSimilarity identical = 1", levenshteinSimilarity("Smith", "Smith") === 1);
  ok(
    "levenshteinSimilarity 'Jon'/'John' is high (>0.7)",
    levenshteinSimilarity("Jon", "John") > 0.7,
  );
  ok(
    "levenshteinSimilarity unrelated is low (<0.3)",
    levenshteinSimilarity("Smith", "Zelinsky") < 0.3,
  );
  ok("levenshteinSimilarity both empty = 1", levenshteinSimilarity("", "") === 1);
  ok("levenshteinSimilarity one empty = 0", levenshteinSimilarity("", "Smith") === 0);

  ok("jaroWinkler identical = 1", jaroWinklerSimilarity("Robert", "Robert") === 1);
  ok(
    "jaroWinkler 'Jon'/'John' very high (>0.9) — shared prefix",
    jaroWinklerSimilarity("Jon", "John") > 0.9,
  );
  ok(
    "jaroWinkler is case-insensitive",
    jaroWinklerSimilarity("SMITH", "smith") === 1,
  );
  ok(
    "jaroWinkler unrelated short names low (<0.6)",
    jaroWinklerSimilarity("John", "Smith") < 0.6,
  );

  // ─── 2. patient-matching: middle-name (NMN) normalization & compare ──────

  section("patient-matching: NMN normalization & comparison");

  ok("normalizeMiddleName(undefined) -> NMN", normalizeMiddleName(undefined) === NMN_MARKER);
  ok("normalizeMiddleName('') -> NMN", normalizeMiddleName("") === NMN_MARKER);
  ok("normalizeMiddleName('  ') -> NMN", normalizeMiddleName("   ") === NMN_MARKER);
  ok("normalizeMiddleName('nmn') -> NMN", normalizeMiddleName("nmn") === NMN_MARKER);
  ok("normalizeMiddleName('Michael') -> 'MICHAEL'", normalizeMiddleName("Michael") === "MICHAEL");

  ok(
    "compareMiddleNames: one side NMN/blank matches anything",
    compareMiddleNames(null, "Michael") === true,
  );
  ok(
    "compareMiddleNames: both NMN match",
    compareMiddleNames(null, undefined) === true,
  );
  ok(
    "compareMiddleNames: equal full names match",
    compareMiddleNames("Michael", "michael") === true,
  );
  ok(
    "compareMiddleNames: initial vs full name matches on first letter",
    compareMiddleNames("M", "Michael") === true,
  );
  ok(
    "compareMiddleNames: different middle names do NOT match",
    compareMiddleNames("Michael", "David") === false,
  );

  // ─── 3. patient-matching: phone / SSN / date primitives ──────────────────

  section("patient-matching: phone / SSN / date primitives");

  ok("normalizePhoneNumber strips & takes last 10", normalizePhoneNumber("+1 (555) 123-4567") === "5551234567");
  ok("normalizePhoneNumber undefined -> ''", normalizePhoneNumber(undefined) === "");
  ok(
    "comparePhoneNumbers same number diff formatting = 1",
    comparePhoneNumbers("555-123-4567", "(555) 123 4567") === 1,
  );
  ok(
    "comparePhoneNumbers different numbers < 1",
    comparePhoneNumbers("5551234567", "5559999999") < 1,
  );
  ok("comparePhoneNumbers missing side = 0", comparePhoneNumbers(undefined, "5551234567") === 0);

  ok("normalizeSSN strips non-digits", normalizeSSN("123-45-6789") === "123456789");

  ok(
    "compareDates same date, different formats -> true",
    compareDates("1990-05-15", "May 15, 1990") === true,
  );
  ok("compareDates conflicting DOB -> false", compareDates("1990-05-15", "1991-05-15") === false);
  ok("compareDates missing side -> false", compareDates(undefined, "1990-05-15") === false);

  // ─── 4. patient-matching: PROBABILISTIC scoring path + edge cases ────────
  // Exercises the private calculateProbabilisticMatch scorer directly.

  section("patient-matching: probabilistic scorer — exact same person");

  const calc = (identifier: PatientIdentifier, candidate: any) =>
    (patientMatchingService as any).calculateProbabilisticMatch(identifier, candidate) as {
      confidence: number;
      matchedFields: string[];
      details: any;
    };

  const base: PatientIdentifier = {
    firstName: "John",
    lastName: "Smith",
    middleName: "Michael",
    dateOfBirth: "1990-05-15",
    phoneNumber: "555-123-4567",
    email: "john.smith@example.com",
  };

  {
    const r = calc(base, {
      firstName: "John",
      lastName: "Smith",
      middleName: "Michael",
      dateOfBirth: "1990-05-15",
      phoneNumber: "(555) 123-4567",
      email: "John.Smith@example.com",
    });
    approx("exact match confidence ~1.0", r.confidence, 1.0);
    ok("exact match is high-confidence (>=0.85)", r.confidence >= 0.85);
    ok("exact match matchedFields include name", r.matchedFields.includes("name"));
    ok("exact match matchedFields include dateOfBirth", r.matchedFields.includes("dateOfBirth"));
    ok("exact match matchedFields include email", r.matchedFields.includes("email"));
    ok("exact match matchedFields include phone", r.matchedFields.includes("phone"));
  }

  section("patient-matching: probabilistic scorer — NMN edge");

  {
    // Identifier has no middle name; candidate has one. NMN must not penalize.
    const r = calc(
      { ...base, middleName: null },
      {
        firstName: "John",
        lastName: "Smith",
        middleName: "Michael",
        dateOfBirth: "1990-05-15",
        phoneNumber: "555-123-4567",
        email: "john.smith@example.com",
      },
    );
    ok("NMN side still matches name", r.matchedFields.includes("name"));
    ok("NMN side stays high-confidence (>=0.85)", r.confidence >= 0.85);
    ok("NMN side name score not penalized (>=0.99)", (r.details.nameScore ?? 0) >= 0.99);
  }

  section("patient-matching: probabilistic scorer — conflicting DOB");

  {
    // Everything matches except DOB. A perfect-but-for-DOB record must drop
    // below the HIGH (auto) threshold so it is not silently auto-merged.
    const r = calc(base, {
      firstName: "John",
      lastName: "Smith",
      middleName: "Michael",
      dateOfBirth: "1991-05-15",
      phoneNumber: "555-123-4567",
      email: "john.smith@example.com",
    });
    ok("conflicting DOB -> dobMatch false", r.details.dobMatch === false);
    ok("conflicting DOB drops below high threshold (<0.85)", r.confidence < 0.85);
    ok("conflicting DOB still name-matched", r.matchedFields.includes("name"));
    ok("conflicting DOB excludes dateOfBirth from matched", !r.matchedFields.includes("dateOfBirth"));
  }

  section("patient-matching: probabilistic scorer — transposed first/last name");

  {
    // first/last swapped, but DOB+phone+email identical. Name similarity must
    // collapse so the record is not treated as a high-confidence match.
    const r = calc(base, {
      firstName: "Smith",
      lastName: "John",
      middleName: "Michael",
      dateOfBirth: "1990-05-15",
      phoneNumber: "555-123-4567",
      email: "john.smith@example.com",
    });
    ok("transposed name -> nameScore < 0.8", (r.details.nameScore ?? 1) < 0.8);
    ok("transposed name -> name NOT in matchedFields", !r.matchedFields.includes("name"));
    ok("transposed name -> below high threshold (<0.85)", r.confidence < 0.85);
  }

  section("patient-matching: probabilistic scorer — same name, different patient");

  {
    // Identical name but different DOB, phone, and email. Name alone must not
    // be enough to merge (must fall below the MEDIUM 0.70 threshold).
    const r = calc(base, {
      firstName: "John",
      lastName: "Smith",
      middleName: "Michael",
      dateOfBirth: "1972-11-02",
      phoneNumber: "555-987-6543",
      email: "different.john@example.com",
    });
    ok("same-name-different-patient: name matches", r.matchedFields.includes("name"));
    ok("same-name-different-patient: DOB does not match", r.details.dobMatch === false);
    ok("same-name-different-patient: below medium threshold (<0.70)", r.confidence < 0.70);
  }

  // ─── 5. deduplication-service: similarity primitives ─────────────────────

  section("deduplication-service: similarity primitives");

  ok("calculateSimilarity identical = 1", dedup.calculateSimilarity("Smith", "Smith") === 1);
  ok(
    "calculateSimilarity 'Jon'/'John' high (>0.7)",
    dedup.calculateSimilarity("Jon", "John") > 0.7,
  );
  ok("calculateSimilarity both empty = 1", dedup.calculateSimilarity("", "") === 1);
  ok("calculateSimilarity one empty = 0", dedup.calculateSimilarity("Smith", "") === 0);

  ok(
    "exactMatch case/trim-insensitive equal = 1",
    (dedup as any).exactMatch("  John ", "john") === 1,
  );
  ok("exactMatch different = 0", (dedup as any).exactMatch("John", "Jane") === 0);
  ok("exactMatch both empty = 1", (dedup as any).exactMatch("", "") === 1);

  ok(
    "dateMatch same date diff format = 1",
    (dedup as any).dateMatch("1990-05-15", "May 15, 1990") === 1,
  );
  ok("dateMatch conflicting = 0", (dedup as any).dateMatch("1990-05-15", "1991-05-15") === 0);
  ok("dateMatch invalid input = 0", (dedup as any).dateMatch("not-a-date", "1990-05-15") === 0);
  ok("dateMatch both null = 1", (dedup as any).dateMatch(null, null) === 1);

  ok(
    "calculateFieldSimilarity exact",
    (dedup as any).calculateFieldSimilarity("a@b.com", "A@B.com", "exact") === 1,
  );
  ok(
    "calculateFieldSimilarity date",
    (dedup as any).calculateFieldSimilarity("1990-05-15", "1990-05-15", "date") === 1,
  );
  ok(
    "calculateFieldSimilarity levenshtein",
    (dedup as any).calculateFieldSimilarity("Smith", "Smith", "levenshtein") === 1,
  );

  // ─── 6. deduplication-service: checkForDuplicates merge decisions ────────
  // The DB-backed deterministic + probabilistic decision path. db.select is
  // stubbed per case; the real scoring/threshold logic runs unchanged.

  section("deduplication-service: DETERMINISTIC merge decision (identifier match)");

  {
    installDbSelectMock({ identifiers: [{ patientId: "patient-A" }] });
    const res = await dedup.checkForDuplicates({
      firstName: "John",
      lastName: "Smith",
      identifiers: [{ type: "ssn_last4", value: "6789" }],
    } as any);
    ok("identifier match -> action auto_merge", res.action === "auto_merge");
    ok("identifier match -> bestMatch deterministic", res.bestMatch?.matchType === "deterministic");
    ok("identifier match -> score 1.0", res.bestMatch?.score === 1.0);
    ok("identifier match -> points at patient-A", res.bestMatch?.patientId === "patient-A");
    restoreDb();
  }

  section("deduplication-service: DETERMINISTIC merge decision (email + DOB)");

  {
    installDbSelectMock({ profiles: [{ id: "patient-B" }] });
    const res = await dedup.checkForDuplicates({
      email: "john.smith@example.com",
      dateOfBirth: "1990-05-15",
      firstName: "John",
      lastName: "Smith",
    } as any);
    ok("email+DOB match -> action auto_merge", res.action === "auto_merge");
    ok("email+DOB match -> deterministic", res.bestMatch?.matchType === "deterministic");
    ok("email+DOB match -> points at patient-B", res.bestMatch?.patientId === "patient-B");
    restoreDb();
  }

  section("deduplication-service: PROBABILISTIC auto_merge (>=0.95)");

  {
    // No email/identifiers -> deterministic path is empty; identical demographic
    // candidate yields a 1.0 probabilistic score -> auto_merge.
    installDbSelectMock({
      profiles: [
        {
          id: "patient-C",
          firstName: "John",
          lastName: "Smith",
          middleName: "Michael",
          dateOfBirth: "1990-05-15",
        },
      ],
    });
    const res = await dedup.checkForDuplicates({
      firstName: "John",
      lastName: "Smith",
      middleName: "Michael",
      dateOfBirth: "1990-05-15",
    } as any);
    ok("identical demographics -> action auto_merge", res.action === "auto_merge");
    ok("identical demographics -> probabilistic", res.bestMatch?.matchType === "probabilistic");
    ok("identical demographics -> score >= 0.95", (res.bestMatch?.score ?? 0) >= 0.95);
    restoreDb();
  }

  section("deduplication-service: PROBABILISTIC flag_for_review (0.80–0.95)");

  {
    // Smith/Smyth are identical under Soundex, so they no longer exercise the
    // review band. Robert/Richard receive 0.85; Jones/James receive 1.0.
    installDbSelectMock({
      profiles: [
        {
          id: "patient-D",
          firstName: "Richard",
          lastName: "James",
        },
      ],
    });
    const res = await dedup.checkForDuplicates({
      firstName: "Robert",
      lastName: "Jones",
    } as any);
    ok("near-match -> action flag_for_review", res.action === "flag_for_review");
    ok(
      "near-match -> score in [0.80, 0.95)",
      (res.bestMatch?.score ?? 0) >= 0.8 && (res.bestMatch?.score ?? 0) < 0.95,
    );
    restoreDb();
  }

  section("deduplication-service: PROBABILISTIC create_new (different patient)");

  {
    // Same-name-different-patient is covered above for the MPI scorer; here the
    // candidate differs across the board -> below threshold -> create_new.
    installDbSelectMock({
      profiles: [
        {
          id: "patient-E",
          firstName: "Zachary",
          lastName: "Zimmerman",
          middleName: "Quinn",
          dateOfBirth: "1975-12-31",
        },
      ],
    });
    const res = await dedup.checkForDuplicates({
      firstName: "John",
      lastName: "Smith",
      middleName: "Michael",
      dateOfBirth: "1990-05-15",
    } as any);
    ok("unrelated candidate -> action create_new", res.action === "create_new");
    ok("unrelated candidate -> no matches", res.matches.length === 0);
    restoreDb();
  }

  // ─── Summary ─────────────────────────────────────────────────────────────

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
})();
