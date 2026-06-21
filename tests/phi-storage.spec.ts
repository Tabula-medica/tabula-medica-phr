/**
 * F1 — phi-storage wrapper tests.
 *
 * Session 1 shipped 3 fixtures (text/text-array/jsonb).
 * Session 2b expands to 14 fixtures covering ciphertext-at-rest invariants
 * across the most-sensitive Tier-1 tables plus the backward-compat policy
 * that the migration relies on (mixed plaintext+ciphertext rows).
 *
 * Coverage matrix (post Session 2b):
 *   #  Subject                                   Mode          Asserts
 *   1  medicationsTable                          text          encrypt
 *   2  medicationsTable                          text          round-trip
 *   3  medicationsTable                          text          idempotent
 *   4  medicationAdherenceLogsTable.sideEffects  textArray     encrypt+rt
 *   5  mergeHistoryTable.premerge/postmergeData  jsonb         envelope+rt
 *   6  hashEmail                                 hash          determinism
 *   7  folders                                   non-PHI       no-op
 *   8  decryptPhiRows                            list          decrypt-all
 *   --- Session 2b additions (ciphertext-at-rest) ---
 *   9  patientIdentityTable                      Tier-1 PII    encrypt-all-13
 *   10 timelineEvents                            multi-text    encrypt+rt
 *   11 clinicalAiAudit                           text+jsonb    encrypt+rt
 *   12 accounts.email                            text+hash     parity
 *   13 hipaaAuditLogsTable                       Tier-2        encrypt
 *   14 decryptPhiRows                            mixed rows    plaintext-passthrough
 *   --- Session 2b.5 additions (dedup engine forensic snapshots) ---
 *   15 mergeHistoryTable.postmergeData           jsonb env     encrypt+rt
 *   16 mergeHistoryTable.premergeData            jsonb env     deep round-trip
 *   17 matchCandidatesTable                      text+jsonb    encrypt+rt
 *   18 matchCandidatesTable                      partial upd   no-synthesize
 *   19 mergeHistoryTable                         deep nested   forensic integrity
 *   20 mergeHistoryTable                         mixed rows    legacy passthrough
 *
 * Run:
 *   npx vitest run tests/phi-storage.spec.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  encryptPhiRow,
  decryptPhiRow,
  decryptPhiRows,
  isRowFullyEncrypted,
  hashEmail,
  hashMrn,
} from "../server/storage/phi-storage";
import { isEncrypted } from "../server/security/phi-encryption";

beforeAll(() => {
  // Use deterministic dev-mode keys so the test is hermetic.
  process.env.PHI_ENCRYPTION_KEY ??= "test-key-do-not-use-in-prod-0123456789ab";
  process.env.PHI_ENCRYPTION_SALT ??=
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

describe("phi-storage — text columns (medications)", () => {
  it("encrypts name/dose/frequency on insert", () => {
    const input = {
      profileId: "00000000-0000-0000-0000-000000000001",
      name: "Lisinopril",
      dose: "10 mg",
      frequency: "once_daily",
      status: "active",
    };
    const encrypted = encryptPhiRow("medicationsTable", input);
    expect(isEncrypted(encrypted.name)).toBe(true);
    expect(isEncrypted(encrypted.dose)).toBe(true);
    expect(isEncrypted(encrypted.frequency)).toBe(true);
    // Non-PHI fields untouched.
    expect(encrypted.status).toBe("active");
    expect(encrypted.profileId).toBe(input.profileId);
    expect(isRowFullyEncrypted("medicationsTable", encrypted)).toBe(true);
  });

  it("round-trips back to plaintext on select", () => {
    const input = { name: "Atorvastatin", dose: "20 mg", frequency: "daily" };
    const encrypted = encryptPhiRow("medicationsTable", input);
    const decrypted = decryptPhiRow("medicationsTable", encrypted);
    expect(decrypted.name).toBe("Atorvastatin");
    expect(decrypted.dose).toBe("20 mg");
    expect(decrypted.frequency).toBe("daily");
  });

  it("does not double-encrypt already-ciphertext input", () => {
    const once = encryptPhiRow("medicationsTable", { name: "Metformin" });
    const twice = encryptPhiRow("medicationsTable", once);
    expect(twice.name).toBe(once.name);
  });
});

describe("phi-storage — text array (medication adherence sideEffects)", () => {
  it("encrypts each element of the sideEffects array", () => {
    const input = {
      profileId: "00000000-0000-0000-0000-000000000002",
      medicationName: "Lisinopril",
      scheduledTime: new Date(),
      status: "taken",
      sideEffects: ["dry cough", "dizziness"],
    };
    const encrypted = encryptPhiRow("medicationAdherenceLogsTable", input);
    expect(Array.isArray(encrypted.sideEffects)).toBe(true);
    expect(encrypted.sideEffects).toHaveLength(2);
    encrypted.sideEffects.forEach((el: string) => {
      expect(isEncrypted(el)).toBe(true);
    });
    const back = decryptPhiRow("medicationAdherenceLogsTable", encrypted);
    expect(back.sideEffects).toEqual(["dry cough", "dizziness"]);
  });
});

describe("phi-storage — jsonb blob envelope (merge history)", () => {
  it("wraps premergeData / postmergeData as encrypted envelopes", () => {
    const input = {
      survivingPatientId: "00000000-0000-0000-0000-000000000003",
      retiredPatientId: "00000000-0000-0000-0000-000000000004",
      mergeType: "auto",
      mergeReason: "deterministic SSN+DOB match",
      premergeData: {
        firstName: "Jane",
        lastName: "Doe",
        ssnLast4: "1234",
        dateOfBirth: "1980-01-01",
      },
      postmergeData: {
        firstName: "Jane",
        lastName: "Doe-Smith",
        ssnLast4: "1234",
        dateOfBirth: "1980-01-01",
      },
    };
    const encrypted = encryptPhiRow("mergeHistoryTable", input);
    // Envelope shape: { __enc: "<ciphertext>" }
    expect(typeof encrypted.premergeData).toBe("object");
    expect(encrypted.premergeData.__enc).toBeDefined();
    expect(isEncrypted(encrypted.premergeData.__enc)).toBe(true);
    expect(encrypted.postmergeData.__enc).toBeDefined();
    // mergeReason text column is also encrypted
    expect(isEncrypted(encrypted.mergeReason)).toBe(true);

    // Round-trip: blob comes back as the original object
    const back = decryptPhiRow("mergeHistoryTable", encrypted);
    expect(back.premergeData).toEqual(input.premergeData);
    expect(back.postmergeData).toEqual(input.postmergeData);
    expect(back.mergeReason).toBe(input.mergeReason);
  });
});

describe("phi-storage — searchable hash (login email)", () => {
  it("produces a deterministic hash for case-insensitive lookup", () => {
    const a = hashEmail("Alice@Example.COM");
    const b = hashEmail("alice@example.com");
    const c = hashEmail("  alice@example.com  ");
    expect(a).toBe(b);
    expect(a).toBe(c);
    expect(a).toHaveLength(64); // 32 bytes hex
    expect(hashEmail("bob@example.com")).not.toBe(a);
  });
});

describe("phi-storage — non-PHI table is a no-op", () => {
  it("does not modify rows for tables not in PHI_COLUMN_MAP", () => {
    const input = { id: "x", name: "system folder", isSystem: true };
    const out = encryptPhiRow("folders", input);
    expect(out).toEqual(input);
  });
});

describe("phi-storage — decryptPhiRows on .select() result", () => {
  it("decrypts every row in the array", () => {
    const inputs = [
      { name: "Med A", dose: "5 mg", frequency: "daily" },
      { name: "Med B", dose: "10 mg", frequency: "weekly" },
    ];
    const encrypted = inputs.map((r) => encryptPhiRow("medicationsTable", r));
    const decrypted = decryptPhiRows("medicationsTable", encrypted);
    expect(decrypted[0].name).toBe("Med A");
    expect(decrypted[1].name).toBe("Med B");
  });
});

// ---------------------------------------------------------------------------
// Session 2b additions — ciphertext-at-rest invariants on Tier-1 PII tables
// and the backward-compat policy that lets the migration ship against a DB
// containing pre-existing plaintext rows.
// ---------------------------------------------------------------------------

describe("phi-storage — patientIdentityTable (Tier-1 PII, 13 text columns)", () => {
  it("encrypts every text PHI column on a full identity record", () => {
    const input = {
      patientId: "00000000-0000-0000-0000-000000000010",
      firstName: "Maria",
      middleName: "Elena",
      lastName: "Rodriguez",
      dateOfBirth: "1985-03-14",
      ssnLast4: "6789",
      stateId: "VA1234567",
      mrn: "MRN-987654321",
      email: "maria.rodriguez@example.com",
      phoneNumber: "+15551234567",
      addressLine1: "742 Evergreen Terrace",
      addressLine2: "Apt 4B",
      city: "Springfield",
      zipCode: "22150",
      ssnHash: "deadbeef".repeat(8), // pre-hashed, NOT in PHI map; must pass through
      stateIdState: "VA", // also excluded; pass through
    };
    const encrypted = encryptPhiRow("patientIdentityTable", input);

    // All 13 text PHI columns must be ciphertext.
    const phiCols = [
      "firstName", "middleName", "lastName", "dateOfBirth", "ssnLast4",
      "stateId", "mrn", "email", "phoneNumber", "addressLine1",
      "addressLine2", "city", "zipCode",
    ];
    for (const col of phiCols) {
      expect(isEncrypted(encrypted[col]), `${col} must be ciphertext`).toBe(true);
    }
    // Non-PHI columns must be untouched (HIPAA Safe Harbor §164.514(b)(2):
    // opaque IDs and one-way hashes are not PHI).
    expect(encrypted.patientId).toBe(input.patientId);
    expect(encrypted.ssnHash).toBe(input.ssnHash);
    expect(encrypted.stateIdState).toBe("VA");
    expect(isRowFullyEncrypted("patientIdentityTable", encrypted)).toBe(true);
  });
});

describe("phi-storage — timelineEvents (multi-text round-trip)", () => {
  it("encrypts title/providerName/facilityName/notes and decrypts cleanly", () => {
    const input = {
      patientId: "00000000-0000-0000-0000-000000000011",
      eventDate: new Date("2025-11-02"),
      title: "Annual Wellness Visit",
      providerName: "Dr. Susan Chen, MD",
      facilityName: "Northside Family Medicine",
      notes: "BP 118/76, BMI 24.1, no acute concerns. Discussed colonoscopy referral.",
    };
    const encrypted = encryptPhiRow("timelineEvents", input);
    expect(isEncrypted(encrypted.title)).toBe(true);
    expect(isEncrypted(encrypted.providerName)).toBe(true);
    expect(isEncrypted(encrypted.facilityName)).toBe(true);
    expect(isEncrypted(encrypted.notes)).toBe(true);

    const back = decryptPhiRow("timelineEvents", encrypted);
    expect(back.title).toBe(input.title);
    expect(back.providerName).toBe(input.providerName);
    expect(back.facilityName).toBe(input.facilityName);
    expect(back.notes).toBe(input.notes);
  });
});

describe("phi-storage — clinicalAiAudit (mixed text + jsonb envelope)", () => {
  it("encrypts text columns AND wraps jsonb columns as {__enc} envelopes", () => {
    const input = {
      patientId: "00000000-0000-0000-0000-000000000012",
      aiSummary: "Patient presents with stable hypertension on Lisinopril 10mg.",
      clinicianFeedback: "Agree with summary; add note re: K+ recheck in 2 weeks.",
      requestPayload: {
        model: "gpt-4o-mini",
        prompt_tokens: 412,
        patient_context: { age: 67, sex: "F", problemList: ["HTN", "T2DM"] },
      },
      sourceGrounding: { citations: ["doc-id-7", "lab-id-22"] },
      explainabilityFactors: { topFeatures: ["recent_bp", "med_adherence"] },
    };
    const encrypted = encryptPhiRow("clinicalAiAudit", input);

    // Text PHI → ciphertext strings
    expect(isEncrypted(encrypted.aiSummary)).toBe(true);
    expect(isEncrypted(encrypted.clinicianFeedback)).toBe(true);

    // jsonb PHI → {__enc: <ciphertext>} envelope shape
    expect(typeof encrypted.requestPayload).toBe("object");
    expect(isEncrypted(encrypted.requestPayload.__enc)).toBe(true);
    expect(isEncrypted(encrypted.sourceGrounding.__enc)).toBe(true);
    expect(isEncrypted(encrypted.explainabilityFactors.__enc)).toBe(true);

    // Round-trip restores original structure
    const back = decryptPhiRow("clinicalAiAudit", encrypted);
    expect(back.aiSummary).toBe(input.aiSummary);
    expect(back.requestPayload).toEqual(input.requestPayload);
    expect(back.sourceGrounding).toEqual(input.sourceGrounding);
    expect(back.explainabilityFactors).toEqual(input.explainabilityFactors);
  });
});

describe("phi-storage — accounts.email + emailHash search parity", () => {
  it("encrypts email at rest while emailHash stays deterministic for lookup", () => {
    const input = {
      id: "00000000-0000-0000-0000-000000000013",
      email: "Patient.Person@Example.COM",
      emailHash: hashEmail("Patient.Person@Example.COM"),
    };
    const encrypted = encryptPhiRow("accounts", input);

    // Stored email is ciphertext (cannot be queried directly)
    expect(isEncrypted(encrypted.email)).toBe(true);

    // emailHash is NOT in PHI_COLUMN_MAP — it's a search column, must remain
    // deterministic plaintext so login lookups (`WHERE emailHash = ?`) still
    // resolve. Critical security invariant: hashEmail is case-insensitive +
    // trim-normalized, so `Patient.Person@Example.COM` and
    // `patient.person@example.com` produce the same hash.
    expect(encrypted.emailHash).toBe(input.emailHash);
    expect(encrypted.emailHash).toBe(hashEmail("patient.person@example.com"));
    expect(encrypted.emailHash).toBe(hashEmail("  PATIENT.PERSON@example.com  "));

    // Decrypt round-trip restores original casing
    const back = decryptPhiRow("accounts", encrypted);
    expect(back.email).toBe(input.email);

    // hashMrn parity check (same algorithm, different field) — covers Tier-1
    // patient lookup path used by external EHR sync.
    expect(hashMrn("MRN-001-A")).toBe(hashMrn("mrn-001-a"));
    expect(hashMrn("MRN-001-A")).toHaveLength(64);
  });
});

describe("phi-storage — hipaaAuditLogsTable (Tier-2 audit special handling)", () => {
  it("encrypts userName + accessReasonDetail; leaves accessReason enum + non-PHI columns intact", () => {
    // Session 2c (item b) — accessReason was split. The plaintext enum
    // (emergency/treatment/payment/operations/research/patient_request)
    // stays queryable; the freeform "why" routes to accessReasonDetail
    // and is encrypted at rest.
    const input = {
      id: "00000000-0000-0000-0000-000000000014",
      userId: "00000000-0000-0000-0000-000000000015",
      userName: "Dr. Julia Park",
      action: "VIEW_PATIENT_RECORD",
      resourceType: "patient",
      resourceId: "patient-uuid-x",
      accessReason: "treatment",
      accessReasonDetail: "Patient called clinic to request medication refill",
      success: true,
      ipAddress: "10.0.0.42",
      userAgent: "Mozilla/5.0",
    };
    const encrypted = encryptPhiRow("hipaaAuditLogsTable", input);

    // PHI text columns must encrypt
    expect(isEncrypted(encrypted.userName)).toBe(true);
    expect(isEncrypted(encrypted.accessReasonDetail)).toBe(true);

    // Plaintext enum must remain queryable (auditor can WHERE access_reason = 'treatment')
    expect(encrypted.accessReason).toBe("treatment");

    // Audit forensic columns must remain queryable (HIPAA §164.312(b))
    expect(encrypted.userId).toBe(input.userId);
    expect(encrypted.action).toBe("VIEW_PATIENT_RECORD");
    expect(encrypted.resourceType).toBe("patient");
    expect(encrypted.resourceId).toBe(input.resourceId);
    expect(encrypted.success).toBe(true);
    expect(encrypted.ipAddress).toBe("10.0.0.42");
  });
});

// ---------------------------------------------------------------------------
// Session 2c additions — audit-log scrubbing fixtures (#21–#23).
// Bring the suite from 20/40 to 23/40.
// ---------------------------------------------------------------------------

describe("phi-storage — hipaaAuditLogsTable accessReason split (queryable enum + encrypted detail)", () => {
  it("keeps accessReason plaintext when accessReasonDetail is absent (no synthesis)", () => {
    // Reviewer-critical: the column-map removed `accessReason` from the
    // PHI text[] list. encryptPhiRow MUST treat it as plaintext now and
    // MUST NOT synthesize an `accessReasonDetail` key when the caller
    // omitted it (else partial UPDATE payloads would NULL the column).
    const input = {
      eventId: "evt-2c-001",
      userId: "00000000-0000-0000-0000-000000000033",
      userName: "Dr. Marcus Chen",
      action: "EXPORT_PATIENT_BUNDLE",
      accessReason: "patient_request" as const,
      // accessReasonDetail intentionally absent
      ipAddress: "10.0.0.99",
    };
    const encrypted = encryptPhiRow("hipaaAuditLogsTable", input);

    // Enum stays plaintext
    expect(encrypted.accessReason).toBe("patient_request");
    // Detail must NOT appear (would clobber existing column on UPDATE)
    expect("accessReasonDetail" in encrypted).toBe(false);
    // userName still encrypted
    expect(isEncrypted(encrypted.userName)).toBe(true);
  });

  it("supports all six HIPAA access-reason enum values without encryption", () => {
    const reasons = [
      "emergency",
      "treatment",
      "payment",
      "operations",
      "research",
      "patient_request",
    ] as const;
    for (const reason of reasons) {
      const out = encryptPhiRow("hipaaAuditLogsTable", {
        eventId: `evt-2c-enum-${reason}`,
        userId: "00000000-0000-0000-0000-000000000034",
        action: "AUDIT_VIEW",
        accessReason: reason,
      });
      expect(out.accessReason).toBe(reason);
    }
  });
});

describe("phi-storage — fhirApiAuditLogs (jsonb metadata blob + text PHI columns)", () => {
  it("wraps metadata as a {__enc} jsonb envelope and encrypts patientEmail + errorMessage", () => {
    // Session 2c (item d) — fhirApiAuditLogs.metadata can carry arbitrary
    // partner-supplied payload fragments. Treat as opaque PHI: blob-
    // encrypt the entire jsonb so a future leaked partner field cannot
    // land plaintext on disk. Same precedent as mergeHistoryTable.
    const metadata = {
      requestHeaders: { authorization: "Bearer redacted" },
      requestParams: { patient: "Patient/123", _count: 50 },
      partnerEcho: { lastSyncAt: "2026-04-18T15:00:00.000Z", note: "ok" },
    };
    const input = {
      partnerId: "00000000-0000-0000-0000-000000000035",
      partnerName: "Epic on FHIR",
      action: "Patient.read",
      resourceType: "Patient",
      patientEmail: "jane.doe@example.com",
      scopesUsed: ["patient/Patient.read"],
      statusCode: 200,
      ipAddress: "10.0.0.7",
      userAgent: "EpicFHIRClient/1.0",
      requestPath: "/fhir/Patient/123",
      responseTimeMs: 142,
      errorMessage: "Patient John Smith requested deletion",
      metadata: metadata as Record<string, unknown>,
    };

    const encrypted = encryptPhiRow("fhirApiAuditLogs", input);
    const back = decryptPhiRow("fhirApiAuditLogs", encrypted);

    // Text PHI columns: ciphertext at rest
    expect(isEncrypted(encrypted.patientEmail)).toBe(true);
    expect(isEncrypted(encrypted.errorMessage)).toBe(true);
    // jsonb PHI: wrapped as __enc envelope
    expect((encrypted.metadata as any).__enc).toBeDefined();
    expect((encrypted.metadata as any).requestHeaders).toBeUndefined();

    // Round-trip restores all PHI cleanly
    expect(back.patientEmail).toBe("jane.doe@example.com");
    expect(back.errorMessage).toBe("Patient John Smith requested deletion");
    expect(back.metadata).toEqual(metadata);

    // Non-PHI forensic columns unchanged
    expect(encrypted.partnerName).toBe("Epic on FHIR");
    expect(encrypted.action).toBe("Patient.read");
    expect(encrypted.statusCode).toBe(200);
    expect(encrypted.scopesUsed).toEqual(["patient/Patient.read"]);
    expect(encrypted.requestPath).toBe("/fhir/Patient/123");
    expect(encrypted.responseTimeMs).toBe(142);
  });
});

// ---------------------------------------------------------------------------
// Session 2b.5 additions — dedup-engine tables. These are the v2.1-flagged
// "forensically-sensitive snapshot" tables. A regression here produces
// plaintext PHI snapshots on every dedup merge — and merges are append-only,
// so plaintext leaked here lives forever. Treat as auditor-critical.
// ---------------------------------------------------------------------------

describe("phi-storage — mergeHistoryTable.postmergeData (forensic snapshot)", () => {
  it("wraps the full snapshot as a {__enc} jsonb envelope at rest", () => {
    // The realistic snapshot: an entire encrypted patient row that
    // recordMerge() in deduplication-engine-service.ts captures via
    // `phiDb.select().from(patientIdentityTable)` (i.e. ciphertext per
    // column). encryptPhiRow then wraps the ENTIRE object as a jsonb
    // envelope, providing defense-in-depth: even if per-column encryption
    // were ever weakened, the envelope still hides the snapshot contents.
    const survivingRowAsRead = {
      id: "00000000-0000-0000-0000-000000000020",
      firstName: "enc:v1:abc...", // already-ciphertext (came from phiDb read)
      lastName: "enc:v1:def...",
      ssnHash: "deadbeef".repeat(8),
      matchStatus: "auto_merged",
    };
    const input = {
      survivingPatientId: "00000000-0000-0000-0000-000000000021",
      retiredPatientId: "00000000-0000-0000-0000-000000000022",
      mergeType: "auto" as const,
      matchScore: 97,
      postmergeData: survivingRowAsRead as Record<string, unknown>,
      canUnmerge: true,
    };
    const encrypted = encryptPhiRow("mergeHistoryTable", input);

    // jsonb PHI column → must be {__enc: <ciphertext-string>} envelope
    expect(typeof encrypted.postmergeData).toBe("object");
    expect(encrypted.postmergeData).toHaveProperty("__enc");
    expect(isEncrypted(encrypted.postmergeData.__enc)).toBe(true);

    // Forensic non-PHI columns must remain queryable for unmerge / audit
    expect(encrypted.survivingPatientId).toBe(input.survivingPatientId);
    expect(encrypted.retiredPatientId).toBe(input.retiredPatientId);
    expect(encrypted.mergeType).toBe("auto");
    expect(encrypted.matchScore).toBe(97);
    expect(encrypted.canUnmerge).toBe(true);

    // Round-trip restores the snapshot exactly (object equality, including
    // the inner ciphertext strings — they are returned as-is, not re-decrypted)
    const back = decryptPhiRow("mergeHistoryTable", encrypted);
    expect(back.postmergeData).toEqual(survivingRowAsRead);
  });
});

describe("phi-storage — mergeHistoryTable.premergeData (forensic snapshot)", () => {
  it("encrypts premergeData jsonb envelope and round-trips structurally", () => {
    // premergeData captures the retired record's state immediately before
    // the merge (used by unmerge/restore flows). Same envelope rules.
    const retiredSnapshot = {
      id: "00000000-0000-0000-0000-000000000023",
      firstName: "Robert",
      lastName: "Smith",
      dateOfBirth: "1972-09-04",
      mrn: "MRN-RETIRED-001",
      addresses: [
        { type: "home", line1: "123 Old Street", city: "Boston", zip: "02110" },
        { type: "work", line1: "1 Workplace Plaza", city: "Cambridge", zip: "02139" },
      ],
      lastVerifiedAt: "2025-08-12T14:22:11Z",
      mergedFromSources: ["epic-1", "fasten-2", "manual"],
    };
    const input = {
      survivingPatientId: "00000000-0000-0000-0000-000000000024",
      retiredPatientId: "00000000-0000-0000-0000-000000000023",
      mergeType: "manual" as const,
      matchScore: 92,
      mergeReason: "Patient confirmed identity at clinic intake",
      premergeData: retiredSnapshot as Record<string, unknown>,
      canUnmerge: true,
    };
    const encrypted = encryptPhiRow("mergeHistoryTable", input);

    // Both jsonb and text PHI must be ciphertext
    expect(encrypted.premergeData).toHaveProperty("__enc");
    expect(isEncrypted(encrypted.premergeData.__enc)).toBe(true);
    expect(isEncrypted(encrypted.mergeReason)).toBe(true);

    // Deep round-trip restores nested arrays + nested objects exactly
    const back = decryptPhiRow("mergeHistoryTable", encrypted);
    expect(back.premergeData).toEqual(retiredSnapshot);
    expect(back.mergeReason).toBe(input.mergeReason);
    expect((back.premergeData as any).addresses).toHaveLength(2);
    expect((back.premergeData as any).mergedFromSources).toEqual([
      "epic-1", "fasten-2", "manual",
    ]);
  });
});

describe("phi-storage — matchCandidatesTable (jsonb matchDetails + text reviewNotes)", () => {
  it("encrypts both matchDetails (jsonb) and reviewNotes (text)", () => {
    const matchDetails = {
      firstNameScore: 0.94,
      lastNameScore: 1.0,
      dobScore: 1.0,
      addressScore: 0.71,
      phoneFuzzy: { strategy: "last7", matched: true },
      tieBreakers: ["middleName=NMN", "stateId=present"],
    };
    const input = {
      sourcePatientId: "00000000-0000-0000-0000-000000000025",
      candidatePatientId: "00000000-0000-0000-0000-000000000026",
      similarityScore: 91,
      matchType: "probabilistic",
      matchDetails: matchDetails as Record<string, unknown>,
      status: "pending",
      reviewNotes: "Patient confirmed by phone they are the same person",
      reviewedBy: "user-uuid-123",
    };
    const encrypted = encryptPhiRow("matchCandidatesTable", input);

    // PHI columns encrypted
    expect(encrypted.matchDetails).toHaveProperty("__enc");
    expect(isEncrypted(encrypted.matchDetails.__enc)).toBe(true);
    expect(isEncrypted(encrypted.reviewNotes)).toBe(true);

    // Forensic / status columns pass through (not PHI)
    expect(encrypted.sourcePatientId).toBe(input.sourcePatientId);
    expect(encrypted.candidatePatientId).toBe(input.candidatePatientId);
    expect(encrypted.similarityScore).toBe(91);
    expect(encrypted.status).toBe("pending");
    expect(encrypted.reviewedBy).toBe("user-uuid-123");

    const back = decryptPhiRow("matchCandidatesTable", encrypted);
    expect(back.matchDetails).toEqual(matchDetails);
    expect(back.reviewNotes).toBe(input.reviewNotes);
  });
});

describe("phi-storage — matchCandidatesTable partial UPDATE payload", () => {
  it("encrypts only PHI columns present in the partial update set", () => {
    // resolveMatch() in dedup engine does:
    //   phiDb.update(matchCandidatesTable).set(encryptPhiRow("matchCandidatesTable",
    //     { status, reviewedBy, reviewedAt, reviewNotes }))
    // — encryptPhiRow must encrypt reviewNotes only, leave status/reviewedBy
    // alone, and not invent missing PHI columns (matchDetails not present
    // in this update should NOT appear in the output object).
    const update = {
      status: "confirmed_match",
      reviewedBy: "user-uuid-456",
      reviewedAt: new Date("2026-04-18T10:00:00Z"),
      reviewNotes: "Confirmed via phone callback. Same person.",
    };
    const encrypted = encryptPhiRow("matchCandidatesTable", update);

    expect(isEncrypted(encrypted.reviewNotes)).toBe(true);
    expect(encrypted.status).toBe("confirmed_match");
    expect(encrypted.reviewedBy).toBe("user-uuid-456");
    expect(encrypted.reviewedAt).toBeInstanceOf(Date);
    // matchDetails was not in input — must NOT be synthesized as undefined
    // (would overwrite existing column on UPDATE with NULL).
    expect("matchDetails" in encrypted).toBe(false);
  });
});

describe("phi-storage — mergeHistoryTable forensic integrity (deeply nested + arrays + Date)", () => {
  it("preserves a complex snapshot through encrypt → decrypt", () => {
    // Reviewer-critical: the snapshot must round-trip without losing
    // structural fidelity. JSON.stringify-then-parse mangles Date objects
    // (Date → ISO string), so we assert the ISO-string equality of dates,
    // which is the documented behavior of jsonb columns generally.
    const snapshot = {
      patient: {
        id: "00000000-0000-0000-0000-000000000027",
        firstName: "Aisha",
        lastName: "Khan",
        addresses: [
          { line1: "1 First Ave", line2: null, city: "NYC", zip: "10001" },
        ],
        identifiers: [
          { system: "ssn", value: "***-**-1234" },
          { system: "mrn", value: "MRN-789", source: "epic" },
        ],
      },
      meta: {
        capturedAt: "2026-04-18T15:00:00.000Z",
        sourceSystem: "deduplication-engine",
        version: 3,
      },
      counters: { matchAttempts: 4, mergedRecords: 2 },
    };
    const input = {
      survivingPatientId: "00000000-0000-0000-0000-000000000027",
      retiredPatientId: "00000000-0000-0000-0000-000000000028",
      mergeType: "system" as const,
      matchScore: 100,
      postmergeData: snapshot as Record<string, unknown>,
      canUnmerge: false,
    };
    const encrypted = encryptPhiRow("mergeHistoryTable", input);
    const back = decryptPhiRow("mergeHistoryTable", encrypted);

    // Deep equality: nested objects, nested arrays, nulls, mixed types
    expect(back.postmergeData).toEqual(snapshot);
    // Spot checks for the auditor:
    expect((back.postmergeData as any).patient.identifiers[1].source).toBe("epic");
    expect((back.postmergeData as any).counters.matchAttempts).toBe(4);
    expect((back.postmergeData as any).meta.capturedAt).toBe(
      "2026-04-18T15:00:00.000Z",
    );
    // Non-PHI forensic columns intact
    expect(back.survivingPatientId).toBe(input.survivingPatientId);
    expect(back.canUnmerge).toBe(false);
  });
});

describe("phi-storage — mergeHistoryTable plaintext snapshot backward-compat", () => {
  it("passes legacy plaintext mergeHistory rows through decrypt unchanged", () => {
    // Same backward-compat invariant as fixture #14 but for the dedup
    // tables: a pre-F1 mergeHistory row contains a raw plaintext jsonb
    // snapshot. After F1 deploys, decryptPhiRows must NOT throw on these
    // legacy rows, because Action Item H backfill has not yet run.
    const legacyRow = {
      id: "legacy-merge-1",
      survivingPatientId: "00000000-0000-0000-0000-000000000029",
      retiredPatientId: "00000000-0000-0000-0000-000000000030",
      mergeType: "manual",
      matchScore: 88,
      // plaintext jsonb (no __enc envelope) — pre-F1 write
      postmergeData: { firstName: "Legacy", lastName: "Patient", id: "x" },
      mergeReason: "Manual review confirmed match",
      canUnmerge: true,
    };
    const newRow = encryptPhiRow("mergeHistoryTable", {
      id: "new-merge-1",
      survivingPatientId: "00000000-0000-0000-0000-000000000031",
      retiredPatientId: "00000000-0000-0000-0000-000000000032",
      mergeType: "auto" as const,
      matchScore: 99,
      postmergeData: { firstName: "New", lastName: "Patient", id: "y" } as Record<string, unknown>,
      mergeReason: "High-confidence auto-merge",
      canUnmerge: true,
    });

    // Sanity: legacy row is plaintext, new row is ciphertext
    expect(legacyRow.postmergeData).toHaveProperty("firstName");
    expect((newRow.postmergeData as any).__enc).toBeDefined();
    expect(isEncrypted(newRow.mergeReason)).toBe(true);

    // Mixed-batch decrypt must NOT throw and must yield correct plaintext
    // for both rows. This is the contract the dedup engine relies on for
    // getPatientWithHistory's mergeHistory list.
    const out = decryptPhiRows("mergeHistoryTable", [legacyRow, newRow]);
    expect(out).toHaveLength(2);
    expect(out[0].postmergeData).toEqual({ firstName: "Legacy", lastName: "Patient", id: "x" });
    expect(out[0].mergeReason).toBe("Manual review confirmed match");
    expect(out[1].postmergeData).toEqual({ firstName: "New", lastName: "Patient", id: "y" });
    expect(out[1].mergeReason).toBe("High-confidence auto-merge");
  });
});

describe("phi-storage — backward-compat: mixed plaintext+ciphertext rows", () => {
  // This is the architecturally-critical fixture. The migration ships against
  // a production DB that already contains plaintext rows. Reads MUST tolerate
  // a mixed batch where some rows are encrypted (post-migration writes) and
  // some are still plaintext (pre-migration legacy data) without throwing
  // and without corrupting either.
  //
  // Action Item H (backfill plaintext → ciphertext) will eventually eliminate
  // the legacy plaintext rows, but until then this contract MUST hold.
  it("passes plaintext rows through unchanged while decrypting encrypted rows", () => {
    const plaintextRow = {
      id: "row-legacy",
      name: "Aspirin",        // pre-migration plaintext
      dose: "81 mg",          // pre-migration plaintext
      frequency: "daily",     // pre-migration plaintext
      status: "active",
    };
    const encryptedRow = encryptPhiRow("medicationsTable", {
      id: "row-new",
      name: "Metoprolol",
      dose: "25 mg",
      frequency: "twice_daily",
      status: "active",
    });

    // Sanity: the new row is genuinely ciphertext
    expect(isEncrypted(encryptedRow.name)).toBe(true);
    // Sanity: the legacy row is genuinely plaintext
    expect(isEncrypted(plaintextRow.name)).toBe(false);

    // Mixed-batch decrypt must NOT throw and must yield correct plaintext
    // for both rows.
    const out = decryptPhiRows("medicationsTable", [plaintextRow, encryptedRow]);
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe("Aspirin");      // plaintext passed through
    expect(out[0].dose).toBe("81 mg");
    expect(out[1].name).toBe("Metoprolol");   // ciphertext decrypted
    expect(out[1].dose).toBe("25 mg");

    // Conversely, encryptPhiRow on an already-encrypted input is a no-op
    // (idempotent). This is what allows the backfill migration to be
    // re-runnable safely — if a row was already encrypted by a write that
    // raced the backfill, the backfill won't double-encrypt it.
    const reEncrypted = encryptPhiRow("medicationsTable", encryptedRow);
    expect(reEncrypted.name).toBe(encryptedRow.name);
    expect(reEncrypted.dose).toBe(encryptedRow.dose);
  });
});
