# F1 — PHI Schema Audit (verified inventory)

**Status:** Item 1 of Session 1 deliverable. Verified against `shared/schema.ts`
column-by-column. Supersedes the table in `f1-encryption-plan-v2.md`.
**Action requested:** confirm corrections before items 2/4/6 are built.

---

## Top-line corrections vs v2 plan

v2's column lists were inferred from table names. Several were wrong. Items
2 and 4 (`phi-storage.ts` wrapper + hash columns) would have been built
against fabricated columns and immediately blown up at runtime. Concrete
errors:

| v2 said                                | Reality                                                                  |
|----------------------------------------|--------------------------------------------------------------------------|
| `accounts.full_name`, `accounts.phone` | Don't exist. `accounts` has only `email` + `passwordHash`.               |
| `profiles.first_name`/`middle_name`/`last_name`/`mrn` | Don't exist. `profiles` has `fullName` (one field) + `dob` + `metadata` jsonb. |
| `medications.prescribed_by` / `.instructions` / `.notes` | Don't exist. `medicationsTable` has `name`, `dose`, `frequency`, `status`, `startDate`, `endDate` only. |
| `documents.filename` / `.ocr_text` / `.notes` | Don't exist. `documentsTable` has `title`, `objectKey`, `mimeType`. OCR/content lives in object storage (GCS-encrypted). |
| `auditLogTable` needs field-name redaction on `metadata` jsonb | `auditLogTable` has NO jsonb column. It is `action` + `targetType` + `targetId` only. Already PHI-clean by design. |
| `mergeHistoryTable` not listed         | Has `premergeData` and `postmergeData` jsonb — full PHI snapshots. **Critical miss.** |

The structural finding: **the app does not have a `patients` table.** The
PHI tables anchor to `profiles.id`. The closest thing to a "patient
record" is the pair `(profiles, patientIdentityTable)` — `profiles` is
the always-present app-owned record, `patientIdentityTable` is the MPI
identity record populated during EHR sync / dedup.

---

## Verified Tier-1 inventory (encrypt these columns)

Format: `tableVar` → `db_table` → fields to encrypt → fields needing hash column

| Table                         | DB name                     | Encrypt                                                                                      | Hash column         |
|-------------------------------|-----------------------------|----------------------------------------------------------------------------------------------|---------------------|
| `accounts`                    | accounts                    | `email`                                                                                      | `email_hash` (login)|
| `profiles`                    | profiles                    | `fullName`, `dob`, `metadata` (jsonb — encrypt blob)                                         | —                   |
| `patientIdentityTable`        | patient_identity            | `firstName`, `middleName`, `lastName`, `dateOfBirth`, `ssnLast4`, `stateId`, `mrn`, `email`, `phoneNumber`, `addressLine1`, `addressLine2`, `city`, `zipCode` (NOT `ssnHash` — already hashed) | `email_hash`, `mrn_hash`, `phone_hash` |
| `documentsTable`              | documents                   | `title`                                                                                      | —                   |
| `timelineEvents`              | timeline_events             | `title`, `providerName`, `facilityName`, `notes`                                             | —                   |
| `medicationsTable`            | medications_new             | `name`, `dose`, `frequency`                                                                  | —                   |
| `medicationRemindersTable`    | medication_reminders        | `medicationName`, `dosage`                                                                   | —                   |
| `medicationAdherenceLogsTable`| medication_adherence_logs   | `medicationName`, `notes`, `sideEffects` (text[]), `mood`                                    | —                   |
| `medicationInteractionFlagsTable` | medication_interaction_flags | `medication1Name`, `medication2Name`, `description`, `recommendation`, `reviewNotes`     | —                   |
| `providerMedicationActionsTable` | provider_medication_actions | `medicationName`, `previousValue`, `newValue`, `reason`, `providerName`                  | —                   |
| `allergiesTable`              | phr_allergies               | `allergen`, `reaction`, `notes`                                                              | —                   |
| `surgeriesTable`              | phr_surgeries               | `procedureName`, `surgeon`, `facility`, `outcome`, `notes`                                   | —                   |
| `medicalHistoryTable`         | phr_medical_history         | `condition`, `treatedBy`, `notes`                                                            | —                   |
| `socialHistoryTable`          | phr_social_history          | `category`, `description`, `notes`                                                           | —                   |
| `vaccinesTable`               | phr_vaccines                | `vaccineName`, `manufacturer`, `provider`, `lotNumber`, `notes`                              | —                   |
| `sdohTable`                   | phr_sdoh                    | `question`, `response`, `notes`                                                              | —                   |
| `symptomEntries`              | symptom_entries             | `description`                                                                                | —                   |
| `followups`                   | followups                   | `name`, `notes`                                                                              | —                   |
| `vitalSignsTable`             | vital_signs                 | `value`, `notes` (HIPAA: vital readings are PHI)                                             | —                   |
| `monitoringAlertsTable`       | monitoring_alerts           | `title`, `message`, `threshold`, `actualValue`                                               | —                   |
| `healthGoalsTable`            | health_goals                | `title`, `description`, `targetValue`, `currentValue`, `notes`                               | —                   |
| `goalProgressTable`           | goal_progress               | `value`, `notes`                                                                             | —                   |
| `comprehensiveCarePlansTable` | comprehensive_care_plans    | `title`, `description`, `notes`                                                              | —                   |
| `carePlanGoalLinksTable`      | care_plan_goal_links        | `providerNotes`                                                                              | —                   |
| `carePlanMedicationLinksTable`| care_plan_medication_links  | `dosageInstructions`, `providerNotes`                                                        | —                   |
| `carePlanEducationLinksTable` | care_plan_education_links   | `title`, `description`, `providerNotes`                                                      | —                   |
| `carePlanMonitoringParamsTable`| care_plan_monitoring_params| `minThreshold`, `maxThreshold`, `providerNotes`                                              | —                   |
| `carePlanProgressNotesTable`  | care_plan_progress_notes    | `content`                                                                                    | —                   |
| `carePlanStatusHistoryTable`  | care_plan_status_history    | `reason`                                                                                     | —                   |
| `patientOutcomeReportsTable`  | patient_outcome_reports     | `sideEffectsReported`, `improvementAreas`, `concernsNotes`, `additionalComments`, `providerNotes` (NOTE: integer rating columns are also PHI — quality-of-life scores; encrypt as text-cast or accept that ratings are PHI in the open) | — |
| `patientSymptomLogsTable`     | patient_symptom_logs        | `symptomName`, `frequency`, `duration`, `triggerFactors`, `reliefMeasures`, `impactOnDaily`, `notes` | — |
| `patientExperienceFeedbackTable` | patient_experience_feedback | `feedbackText`                                                                            | —                   |
| `engagementMessageThreadsTable`| engagement_message_threads | `subject`, `providerName`                                                                    | —                   |
| `engagementMessagesTable`     | engagement_messages         | `content`, `senderName`, `attachmentName`, `metadata` (text)                                 | —                   |
| `engagementAppointmentsTable` | engagement_appointments     | `providerName`, `providerSpecialty`, `location`, `locationAddress`, `telehealthLink`, `reasonForVisit`, `patientNotes`, `providerNotes`, `cancellationReason` | — |
| `engagementAppointmentRemindersTable` | engagement_appointment_reminders | `failureReason`                                                                | —                   |
| `packetExports`               | packet_exports              | `optionsJson` (jsonb — contains profile snapshots)                                           | —                   |
| `matchCandidatesTable`        | match_candidates            | `matchDetails` (jsonb — name/email/SSN match scores), `reviewNotes`                          | —                   |
| `mergeHistoryTable`           | merge_history               | `mergeReason`, `premergeData` (jsonb — FULL PHI SNAPSHOT), `postmergeData` (jsonb — FULL PHI SNAPSHOT) | — |
| `clinicalAiAudit`             | clinical_ai_audit           | `requestPayload` (jsonb), `aiSummary`, `clinicianFeedback`                                   | —                   |

**Total Tier-1: 40 tables** (v2 estimated 34). Adds `mergeHistoryTable`,
`carePlanGoalLinksTable`, `carePlanEducationLinksTable`,
`carePlanMonitoringParamsTable`, `carePlanStatusHistoryTable`,
`engagementAppointmentRemindersTable`, `matchCandidatesTable`.

## Verified Tier-2 inventory (audit logs — special handling)

| Table                  | DB name                | Strategy                                                                                  |
|------------------------|------------------------|-------------------------------------------------------------------------------------------|
| `auditLogTable`        | audit_log_new          | **No PHI fields.** No jsonb. Add a write-time regex denylist on `action` (no email/SSN patterns). v2 was overcautious here. |
| `hipaaAuditLogsTable`  | hipaa_audit_logs       | Encrypt `userName`, encrypt `accessReason`. Scrub `metadata` jsonb via field-name redaction (per v2 Adjustment B5: split `accessReason` into a constrained enum + encrypted `accessReasonDetail`). |
| `fhirApiAuditLogs`     | fhir_api_audit_logs    | Encrypt `patientEmail`, `errorMessage`, `metadata` jsonb wholesale (per Adjustment B2: keep in-place, ~30% storage cost accepted). |

## Tier-3 (left plaintext — opaque identifiers)

`profileId`, `accountId`, `patientId` (text in audit logs), `userId`,
`carePlanId`, `medicationId`, all `*_id` foreign keys, all UUID PKs.

## Tier-4 (excluded from F1 scope)

- `caregiverAccessTable` — only role/permission flags, no PHI
- `folders`, `tags`, `documentTags`, `timelineEventTags`, `symptomEntryTags`, `followupTags`, `timelineEventDocuments` — pure FK/metadata
- `shareLinks` — `tokenHash`/`pinHash` already hashed
- `mfaSecretsTable` — `encryptedSecret` already encrypted, separate crypto regime
- `securitySessionsTable` — session metadata, no PHI
- `engagementRewardsTable`, `engagementStreaksTable`, `engagementPointsLedgerTable` — engagement gamification, no PHI (provided `name`/`description` stay generic — add a write-time regex denylist as defense-in-depth)
- `fhirApiPartners`, `fhirApiScopeGrants` — partner config, no patient PHI
- All Auth0/RBAC/subscription/billing/organization/compliance-evidence/feature-entitlement tables — no PHI

---

## Delta to plan items 2, 4

### Item 2 (`phi-storage.ts` wrapper)

Implementation can proceed as designed in v2 Gap 5, but the `PhiKind` enum
must use the corrected 40-entry list above, and the wrapper needs a
**jsonb-aware code path** for these 7 columns:

- `profiles.metadata`
- `engagementMessagesTable.metadata` (text, not jsonb — special-case)
- `packetExports.optionsJson`
- `matchCandidatesTable.matchDetails`
- `mergeHistoryTable.premergeData`
- `mergeHistoryTable.postmergeData`
- `clinicalAiAudit.requestPayload`, `clinicalAiAudit.sourceGrounding`,
  `clinicalAiAudit.explainabilityFactors`
- `fhirApiAuditLogs.metadata`
- `hipaaAuditLogsTable.metadata` (scrubbed, not encrypted — per Gap 2)

Encrypting whole jsonb blobs means storing them as text strings (the
ciphertext) in jsonb columns, which Drizzle accepts but breaks
PostgreSQL JSON operators (`->`, `->>`, `@>`, etc) on those columns.
**Decision needed:** is it acceptable to lose JSON-operator queryability
on those 7 columns in exchange for blob encryption? My recommendation:
yes — none of the queryable JSON paths are needed in the patient-facing
flows; the audit/dedup blobs are write-once, read-rarely.

### Item 4 (hash columns)

v2's hash-column list shrinks because the columns it referenced don't all
exist:

| Hash column needed             | On table                | Replaces v2 entry                                                  |
|--------------------------------|-------------------------|--------------------------------------------------------------------|
| `email_hash`                   | `accounts`              | unchanged ✅                                                       |
| `email_hash`                   | `patientIdentityTable`  | unchanged ✅                                                       |
| `mrn_hash`                     | `patientIdentityTable`  | unchanged ✅ (mrn lives here, not on `profiles`)                   |
| `phone_hash`                   | `patientIdentityTable`  | **Moved from `accounts`** — `accounts.phone` doesn't exist         |
| ~~`mrn_hash` on `profiles`~~  | —                       | **DELETED** — no `mrn` column on profiles                          |
| ~~`phone_hash` on `accounts`~~| —                       | **DELETED** — no `phone` column on accounts                        |
| ~~`recipient_email_hash` on `shareLinks`~~ | —          | **DELETED** — no `recipient_email` column on shareLinks            |

**Net: 4 hash columns to add** (down from v2's 6).

### Item 6 (pino logger)

Unchanged from v2 plan. Implementation note: `pino` is **not currently
installed** — needs `npx replit add pino` (or equivalent package install).
38 PHI-touching files are still the right Phase-1 conversion scope.

---

## Bonus question still open

The user explicitly asked "confirm no production PHI exists" and "verify
Neon multi-role support." These are user-side checks per the Adjustment B
note, not agent work. Both still pending.

---

## Recommendation — please confirm before I write code

1. **Approve the corrected 40-table Tier-1 inventory** (or flag tables to
   add/remove).
2. **Confirm jsonb-blob-encryption is acceptable** for the 7 jsonb
   columns in exchange for losing JSON-operator queryability.
3. **Confirm the hash-column list** shrinks from 6 → 4.
4. **Confirm `pino` install is permitted** via the package manager (it
   adds 4 deps: pino, pino-pretty, pino-http, plus types).

Once confirmed I'll proceed with items 2, 4, 6 against this verified
inventory and ship Session 1 results in a single follow-up.
