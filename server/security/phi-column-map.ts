/**
 * F1 — Canonical PHI column map.
 *
 * Single source of truth for:
 *   1. Which columns on which tables hold PHI (consumed by `phi-storage.ts`).
 *   2. Which JSON object keys are PHI (consumed by `logger.ts` redact paths).
 *
 * If you add a new PHI column anywhere, edit this file ONLY. The storage
 * wrapper, the structured logger, and the CI guard all derive their
 * behaviour from these constants.
 *
 * Verified against `shared/schema.ts` column-by-column on 2026-04-18.
 * See `.local/deliverables/f1-schema-audit.md` for the rationale and
 * v2.1 reviewer approval notes.
 */

export type PhiColumnSpec = {
  /** text/varchar/date columns — encrypted as ciphertext strings in-place. */
  text: readonly string[];
  /** jsonb columns — wrapped as `{ __enc: <ciphertext> }` envelopes. */
  jsonb: readonly string[];
  /** text[] (array) columns — each element encrypted independently. */
  textArray?: readonly string[];
};

/**
 * Maps Drizzle table-variable name → encrypted columns.
 * Keys MUST match the variable names exported from `shared/schema.ts`
 * so the CI guard (`scripts/check-phi-db-access.ts`) can detect raw
 * `db.insert(<key>)` / `db.update(<key>)` violations.
 */
export const PHI_COLUMN_MAP: Record<string, PhiColumnSpec> = {
  // --- Identity & profile ---
  accounts: { text: ["email"], jsonb: [] },
  profiles: { text: ["fullName", "dob"], jsonb: ["metadata"] },
  patientIdentityTable: {
    // NOTE: `ssnHash` is excluded — already a one-way hash.
    // NOTE: `stateIdState` is excluded — US-state FK ("VA"), not PHI.
    text: [
      "firstName",
      "middleName",
      "lastName",
      "dateOfBirth",
      "ssnLast4",
      "stateId",
      "mrn",
      "email",
      "phoneNumber",
      "addressLine1",
      "addressLine2",
      "city",
      "zipCode",
    ],
    jsonb: [],
  },

  // --- Documents & timeline ---
  documentsTable: { text: ["title"], jsonb: [] },
  timelineEvents: {
    text: ["title", "providerName", "facilityName", "notes"],
    jsonb: [],
  },

  // --- Medications ---
  medicationsTable: { text: ["name", "dose", "frequency"], jsonb: [] },
  medicationRemindersTable: { text: ["medicationName", "dosage"], jsonb: [] },
  medicationAdherenceLogsTable: {
    text: ["medicationName", "notes", "mood"],
    jsonb: [],
    textArray: ["sideEffects"],
  },
  medicationInteractionFlagsTable: {
    text: [
      "medication1Name",
      "medication2Name",
      "description",
      "recommendation",
      "reviewNotes",
    ],
    jsonb: [],
  },
  providerMedicationActionsTable: {
    text: [
      "medicationName",
      "previousValue",
      "newValue",
      "reason",
      "providerName",
    ],
    jsonb: [],
  },

  // --- PHR sub-tables ---
  allergiesTable: { text: ["allergen", "reaction", "notes"], jsonb: [] },
  surgeriesTable: {
    text: ["procedureName", "surgeon", "facility", "outcome", "notes"],
    jsonb: [],
  },
  medicalHistoryTable: { text: ["condition", "treatedBy", "notes"], jsonb: [] },
  socialHistoryTable: {
    text: ["category", "description", "notes"],
    jsonb: [],
  },
  vaccinesTable: {
    text: ["vaccineName", "manufacturer", "provider", "lotNumber", "notes"],
    jsonb: [],
  },
  sdohTable: { text: ["question", "response", "notes"], jsonb: [] },

  // --- Symptoms & followups ---
  symptomEntries: { text: ["description"], jsonb: [] },
  followups: { text: ["name", "notes"], jsonb: [] },

  // --- Vitals & monitoring ---
  vitalSignsTable: { text: ["value", "notes"], jsonb: [] },
  monitoringAlertsTable: {
    text: ["title", "message", "threshold", "actualValue"],
    jsonb: [],
  },

  // --- Health goals ---
  healthGoalsTable: {
    text: ["title", "description", "targetValue", "currentValue", "notes"],
    jsonb: [],
  },
  goalProgressTable: { text: ["value", "notes"], jsonb: [] },

  // --- Comprehensive care plans ---
  comprehensiveCarePlansTable: {
    text: ["title", "description", "notes"],
    jsonb: [],
  },
  carePlanGoalLinksTable: { text: ["providerNotes"], jsonb: [] },
  carePlanMedicationLinksTable: {
    text: ["dosageInstructions", "providerNotes"],
    jsonb: [],
  },
  carePlanEducationLinksTable: {
    text: ["title", "description", "providerNotes"],
    jsonb: [],
  },
  carePlanMonitoringParamsTable: {
    text: ["minThreshold", "maxThreshold", "providerNotes"],
    jsonb: [],
  },
  carePlanProgressNotesTable: { text: ["content"], jsonb: [] },
  carePlanStatusHistoryTable: { text: ["reason"], jsonb: [] },

  // --- Patient-reported outcomes ---
  // V1 LIMITATION: integer rating columns (qualityOfLifeRating, painLevel,
  // etc.) are intentionally LEFT PLAINTEXT — they're loosely identifying at
  // worst (1–10 ordinal scores), and encrypting integers requires text-cast
  // which would break numeric aggregation needed for outcome reporting.
  // Approved by reviewer 2026-04-18. Re-evaluate if an auditor flags it.
  patientOutcomeReportsTable: {
    text: [
      "sideEffectsReported",
      "improvementAreas",
      "concernsNotes",
      "additionalComments",
      "providerNotes",
    ],
    jsonb: [],
  },
  patientSymptomLogsTable: {
    text: [
      "symptomName",
      "frequency",
      "duration",
      "triggerFactors",
      "reliefMeasures",
      "impactOnDaily",
      "notes",
    ],
    jsonb: [],
  },
  patientExperienceFeedbackTable: { text: ["feedbackText"], jsonb: [] },

  // --- Engagement ---
  engagementMessageThreadsTable: {
    text: ["subject", "providerName"],
    jsonb: [],
  },
  engagementMessagesTable: {
    // `metadata` is a text column on this table (not jsonb).
    text: ["content", "senderName", "attachmentName", "metadata"],
    jsonb: [],
  },
  engagementAppointmentsTable: {
    text: [
      "providerName",
      "providerSpecialty",
      "location",
      "locationAddress",
      "telehealthLink",
      "reasonForVisit",
      "patientNotes",
      "providerNotes",
      "cancellationReason",
    ],
    jsonb: [],
  },
  engagementAppointmentRemindersTable: {
    text: ["failureReason"],
    jsonb: [],
  },

  // --- Packets, dedup, AI audit ---
  packetExports: { text: [], jsonb: ["optionsJson"] },
  matchCandidatesTable: { text: ["reviewNotes"], jsonb: ["matchDetails"] },
  mergeHistoryTable: {
    text: ["mergeReason"],
    jsonb: ["premergeData", "postmergeData"],
  },
  clinicalAiAudit: {
    text: ["aiSummary", "clinicianFeedback"],
    jsonb: ["requestPayload", "sourceGrounding", "explainabilityFactors"],
  },

  // --- Tier-2: audit logs (special handling) ---
  // `auditLogTable` is INTENTIONALLY OMITTED — has no PHI columns and no
  // jsonb. Write-time regex denylist on `action` is enforced separately.
  hipaaAuditLogsTable: {
    // `accessReason` is INTENTIONALLY OMITTED — Session 2c split it into
    // a plaintext enum (emergency/treatment/payment/operations/research/
    // patient_request) for queryability, while the freeform detail is
    // routed to `accessReasonDetail` and encrypted at rest.
    text: ["userName", "accessReasonDetail"],
    // `metadata` jsonb is scrubbed (not encrypted) by the audit writer.
    jsonb: [],
  },
  fhirApiAuditLogs: {
    text: ["patientEmail", "errorMessage"],
    jsonb: ["metadata"],
  },
} as const;

/**
 * Tables that have a deterministic-hash lookup column for searchable PHI.
 * Hash is `scrypt(value.toLowerCase().trim(), encryptionKey, 32)` — see
 * `phi-encryption.ts::hashPhiForSearch`.
 */
export const PHI_HASH_COLUMNS = {
  accounts: { email: "emailHash" },
  patientIdentityTable: {
    email: "emailHash",
    mrn: "mrnHash",
    phoneNumber: "phoneHash",
  },
} as const;

/**
 * Flat union of all PHI field names (across all tables) for use in
 * structured logger redaction. Generated programmatically so the
 * encryption list and the redaction list cannot drift.
 */
export const PHI_FIELD_NAMES: readonly string[] = (() => {
  const set = new Set<string>();
  for (const spec of Object.values(PHI_COLUMN_MAP)) {
    spec.text.forEach((c) => set.add(c));
    spec.jsonb.forEach((c) => set.add(c));
    spec.textArray?.forEach((c) => set.add(c));
  }
  // Common PHI-shaped synonyms that may appear in API payloads under
  // different names than the DB columns.
  [
    "ssn",
    "socialSecurityNumber",
    "phone",
    "address",
    "dateOfBirth",
    "patient",
    "patientName",
    "name",
    "birthDate",
  ].forEach((c) => set.add(c));
  return Array.from(set).sort();
})();

/** Names of every PHI table — used by the CI guard. */
export const PHI_TABLE_NAMES: readonly string[] = Object.keys(PHI_COLUMN_MAP);

/** Names of every table excluded from F1 scope (Tier-3 / Tier-4). */
export const PHI_EXCLUDED_TABLES: readonly string[] = [
  "auditLogTable", // structurally PHI-clean; regex denylist on action
  "caregiverAccessTable",
  "folders",
  "tags",
  "documentTags",
  "timelineEventTags",
  "symptomEntryTags",
  "followupTags",
  "timelineEventDocuments",
  "shareLinks", // tokenHash/pinHash already hashed
  "mfaSecretsTable", // encryptedSecret already encrypted (F2 path)
  "securitySessionsTable",
  "engagementRewardsTable",
  "engagementStreaksTable",
  "engagementPointsLedgerTable",
  "fhirApiPartners",
  "fhirApiScopeGrants",
];
