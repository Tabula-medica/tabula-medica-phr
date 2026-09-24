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

  // --- AU-region identifiers (all government-issued numbers are PHI) ---
  auPatientIdentifiers: {
    text: [
      "ihiNumberEnc",
      "medicareNumberEnc",
      "dvaNumberEnc",
      "hpiiNumberEnc",
      "hpioNumberEnc",
      "concessionCardNumberEnc",
    ],
    jsonb: [],
  },
  auPatientDemographics: {
    text: ["mobilePhone", "homePhone"],
    jsonb: [],
  },
  auMyhrConsent: {
    text: ["adhaSystemHpioEnc"],
    jsonb: [],
  },
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

  // --- eRx cancellation / auto-discontinuation ---
  // NOTE: `pharmacyNcpdpId`, `prescriberNpi` and `pharmacyName` are excluded —
  // they identify the dispensing/prescribing organisation, not the patient, and
  // the transmission queue filters on them. `idempotencyKey` is excluded: it is
  // a one-way hash (see `buildIdempotencyKey`) used as a unique index.
  erxCancellationRequestsTable: {
    text: [
      "medicationName",
      "previousDose",
      "newDose",
      "rxReferenceNumber",
      "reasonText",
      "prescriberName",
      "responseText",
      "lastError",
      "initiatedBy",
    ],
    jsonb: ["metadata"],
  },
  erxCancellationEventsTable: { text: ["detail", "actor"], jsonb: [] },
  patientMortalityRecordsTable: {
    text: [
      "deceasedDate",
      "reportedBy",
      "reporterRelationship",
      "verifiedBy",
      "rescindedBy",
      "rescindReason",
      "notes",
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

  // --- Outpatient orders (labs, imaging, referrals, medications, DME) ---
  // Templates (note_template_library / clinician_note_templates) are
  // deliberately NOT here: they hold no patient reference (see the docblock
  // on those tables in shared/schema.ts), so there is nothing to encrypt.
  outpatientOrdersTable: {
    text: ["orderedByName", "description", "clinicalNotes", "recipientName", "cancelReason"],
    jsonb: ["details"],
    textArray: ["diagnosisCodes"],
  },
  outpatientOrderEventsTable: { text: ["eventDetail", "actorName"], jsonb: [] },

  // --- Advance directives ---
  advanceDirectivesTable: {
    text: ["familyPrimaryGoalOfCare", "goalsOfCare"],
    jsonb: ["treatmentPreferences"],
    textArray: ["codeStatus"],
  },

  // --- Symptoms & followups ---
  symptomEntries: { text: ["description"], jsonb: [] },
  followups: { text: ["name", "notes"], jsonb: [] },

  // --- Vitals & monitoring ---
  vitalSignsTable: { text: ["value", "notes"], jsonb: [] },
  monitoringAlertsTable: {
    text: ["title", "message", "threshold", "actualValue"],
    jsonb: [],
  },

  // --- Fitness & RPM ---
  // value is the actual health measurement (heart rate, sleep minutes,
  // weight, etc.) stored as text. rawPayload holds the vendor's full
  // source entry (Terra), which can include the same and other health
  // data — encrypt the whole jsonb blob rather than trying to allowlist
  // individual fields across an open-ended, vendor-controlled shape.
  wellnessMetricsTable: { text: ["value"], jsonb: ["rawPayload"] },

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

  // --- Engagement consent + health-summary shares ---
  // `phone` is the contact point itself; lookup goes through the HMAC in
  // `phoneHash`, so the plaintext never needs to be queryable.
  engagementConsentsTable: { text: ["phone"], jsonb: [] },
  // `label` is patient-chosen and names people ("Dr Rao", "Mum"); `directive`
  // carries the designated person and destination from a 164.524(c)(3)(ii)
  // written direction. `tokenHash` and `pinHash` are already one-way.
  healthSummarySharesTable: { text: ["label"], jsonb: ["directive"] },

  // Ambient scribe. `capturedBy` names the clinician who attests to having
  // asked for recording consent.
  scribeConsentsTable: { text: ["capturedBy"], jsonb: [] },

  // The verbatim transcript is the most identifying payload this application
  // stores — what a patient said about their own body, in their own words,
  // plus whatever a relative in the room volunteered. The draft carries the
  // same content in structured form, and the attestation names a clinician.
  scribeSessionsTable: { text: [], jsonb: ["transcript", "draft", "attestation"] },
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

  // --- CAC/PIV (DoD) enrollment ---
  // `edipiHash` is INTENTIONALLY OMITTED — already a one-way deterministic
  // hash (hashEdipi), used as the lookup/index key precisely because the
  // encrypted `edipi` column below can't be queried by equality.
  cacSoftwareCertsTable: {
    // certJson embeds the same EDIPI (in its subject/edipi fields), so it
    // needs the same protection as the plaintext column.
    text: ["edipi", "certJson"],
    jsonb: [],
  },
  cacEdipiClaimsTable: {
    text: ["edipi"],
    jsonb: [],
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
