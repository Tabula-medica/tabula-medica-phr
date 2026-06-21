# USCDI v3 → v4 Delta Plan
**Date:** 2026-05-06  **Standard:** USCDI v4 (published July 2023, finalized for 2026 Cures Act compliance)  **Status:** Planning — no code changes

## Current state
- `server/services/uscdi-v3-compliance-service.ts` covers USCDI v3.
- `server/services/uscdi-v5-exchange-service.ts` exists but is forward-looking placeholder; v4 is the current contractual target.
- FHIR R4 endpoints in `server/fhir-r4-api-routes.ts` already cover the v3 data classes.

## USCDI v4 net-new content over v3

### New data classes (whole-class additions)
| Class | Elements | FHIR resource | New endpoint? |
|---|---|---|---|
| **Facility Information** | Facility Identifier, Facility Name, Facility Type | `Location`, `Organization` | Yes — `GET /fhir/r4/Location/[id]` |

### New data elements added to existing classes
| Existing class | New element | FHIR field | Schema impact |
|---|---|---|---|
| Patient Demographics / Information | Sex Parameter for Clinical Use (SPCU) | `Patient.extension[us-core-sex-for-clinical-use]` | Add `sexForClinicalUse` enum to `patients` |
| Patient Demographics | Sexual Orientation | `Patient.extension[sexual-orientation]` | Add `sexualOrientation` text/coded col |
| Patient Demographics | Gender Identity | `Patient.extension[gender-identity]` | Add `genderIdentity` text/coded col |
| Patient Demographics | Tribal Affiliation | `Patient.extension[tribal-affiliation]` | Add `tribalAffiliation` text col |
| Patient Demographics | Name to Use | `Patient.name.use=usual` | Already supported via FHIR HumanName |
| Patient Demographics | Pronouns | `Patient.extension[individual-pronouns]` | Add `pronouns` text col |
| Encounter Information | Encounter Type | `Encounter.type` | Already in FHIR Encounter; add to our table |
| Encounter Information | Encounter Diagnosis | `Encounter.diagnosis.condition` | Add encounter-diagnosis link table |
| Encounter Information | Encounter Time | `Encounter.period.start/end` | Already supported |
| Encounter Information | Encounter Location | `Encounter.location.location` | Add location FK on encounters |
| Encounter Information | Encounter Disposition | `Encounter.hospitalization.dischargeDisposition` | Add `dischargeDisposition` col |
| Health Status / Assessments | Treatment Intervention Preferences | `Consent` resource with category | New `treatment_preferences` table |
| Health Status / Assessments | Care Experience Preferences | `Consent` resource with category | Same `treatment_preferences` table |
| Health Status / Assessments | Mental / Cognitive Status | `Observation` (LOINC panel) | No schema change — observation row |
| Health Status / Assessments | Functional Status | `Observation` (LOINC panel) | No schema change — observation row |
| Health Status / Assessments | Disability Status | `Observation` (LOINC panel) | No schema change — observation row |
| Health Status / Assessments | Pregnancy Status | `Observation` LOINC 82810-3 | No schema change — observation row |
| Health Status / Assessments | Alcohol Use | `Observation` LOINC 74013-4 | No schema change — observation row |
| Health Status / Assessments | Substance Use | `Observation` LOINC 11343-1 | No schema change — observation row |
| Health Status / Assessments | Physical Activity | `Observation` LOINC | No schema change — observation row |
| Health Status / Assessments | SDOH Assessment | `Observation` LOINC 96777-8 | No schema change — observation row |
| Medications | Dose | `MedicationRequest.dosageInstruction.doseAndRate` | Add `dose` JSON col |
| Medications | Dose Unit of Measure | UCUM in same field | Same |
| Medications | Indication | `MedicationRequest.reasonCode` | Add `indication` text col |
| Medications | Fill Status | `MedicationDispense.status` | New `medication_dispenses` table |
| Procedures | Reason for Referral | `ServiceRequest.reasonCode` | Add `referralReason` col |
| Care Team Member(s) | Care Team Member Location | `CareTeam.participant.member` ref `Location` | FK addition |
| Care Team Member(s) | Care Team Member Telecom | `CareTeam.participant.telecom` | Add JSON col |
| Goals | SDOH Goals | `Goal` with category | Existing table; add category enum |
| Health Insurance Information (whole class enriched) | Coverage Status, Coverage Type, Relationship to Subscriber, Member Identifier, Group Identifier, Payer Identifier | `Coverage` resource | New `coverage` table or extend `insurance_info` |

## Schema deltas (concrete `shared/schema.ts` changes)

```ts
// patients table — additive columns (all nullable)
sexForClinicalUse: text("sex_for_clinical_use"),  // SNOMED CT
sexualOrientation: text("sexual_orientation"),     // coded or free-text
genderIdentity: text("gender_identity"),
pronouns: text("pronouns"),
tribalAffiliation: text("tribal_affiliation"),

// encounters table — additive columns
encounterType: text("encounter_type"),
locationId: uuid("location_id").references(() => locations.id),
dischargeDisposition: text("discharge_disposition"),

// new encounterDiagnoses join table
export const encounterDiagnoses = pgTable("encounter_diagnoses", {
  id: uuid("id").primaryKey().defaultRandom(),
  encounterId: uuid("encounter_id").notNull().references(() => encounters.id, { onDelete: "cascade" }),
  conditionId: uuid("condition_id").notNull().references(() => conditions.id),
  rank: integer("rank"),
  use: text("use"), // admitting | discharge | billing
});

// new locations table (Facility Information)
export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  facilityType: text("facility_type"),
  externalIdentifier: text("external_identifier"),
  address: jsonb("address"),
});

// new treatmentPreferences table
export const treatmentPreferences = pgTable("treatment_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  category: text("category").notNull(), // treatment-intervention | care-experience
  preference: text("preference").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});

// new medicationDispenses table
export const medicationDispenses = pgTable("medication_dispenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  medicationRequestId: uuid("medication_request_id").references(() => medicationRequests.id),
  status: text("status").notNull(), // preparation | in-progress | completed | cancelled
  whenPrepared: timestamp("when_prepared"),
  whenHandedOver: timestamp("when_handed_over"),
});

// medicationRequests table — additive columns
indication: text("indication"),
doseDetail: jsonb("dose_detail"),

// new coverage table
export const coverage = pgTable("coverage", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  status: text("status").notNull(),
  type: text("type"),
  subscriberId: text("subscriber_id"),
  groupId: text("group_id"),
  payerId: text("payer_id"),
  relationship: text("relationship"), // self | spouse | child | other
});
```

## FHIR endpoint deltas

### New endpoints
- `GET /fhir/r4/Location/[id]`
- `GET /fhir/r4/Location?organization=...`
- `GET /fhir/r4/MedicationDispense?patient=...`
- `GET /fhir/r4/Coverage?patient=...`
- `GET /fhir/r4/Consent?patient=...&category=treatment-intervention`

### Endpoints needing v4 element exposure
- `Patient` — add SOGI extensions, pronouns, tribal affiliation, SPCU
- `Encounter` — populate `type`, `diagnosis`, `location`, `hospitalization.dischargeDisposition`
- `MedicationRequest` — populate `reasonCode`, `dosageInstruction.doseAndRate`
- `ServiceRequest` — populate `reasonCode` for referrals
- `CareTeam` — populate `participant.telecom`
- `Goal` — expose `category` (LOINC SDOH categories)
- `Observation` — confirm LOINC code coverage for new health-status assessments

## SMART-on-FHIR scope changes
USCDI v4 introduces no new FHIR scopes — the existing `patient/*.read` and resource-specific scopes cover it. New `Location` and `Coverage` resources need explicit scope additions in our scope registry.

## Migration sequencing — 3–5 days

### Day 1 — Schema migration
- Author Drizzle schema deltas above.
- Run `npm run db:push --force` against staging.
- Backfill nullable cols with `NULL` defaults.

### Day 2 — Resource serializers
- Update FHIR resource transformers in `server/fhir-r4-api-routes.ts` to emit v4 extensions and new fields.
- Add `Location`, `Coverage`, `MedicationDispense` route handlers.

### Day 3 — Capability statement
- Update `/fhir/r4/metadata` capability statement to declare USCDI v4 conformance.
- Update `well-known/smart-configuration.json` to declare `Location` + `Coverage` scope support.

### Day 4 — UI surfaces
- Add SOGI, pronouns, tribal affiliation fields to patient profile editor.
- Add facility/location to encounter view.
- Add discharge disposition to encounter detail.
- Add treatment intervention preferences page.

### Day 5 — Compliance evidence
- Update `server/services/uscdi-v3-compliance-service.ts` → rename to `uscdi-v4-compliance-service.ts`, add v4 element coverage matrix.
- Generate compliance attestation report.
- File ONC HTI-2 conformance documentation.

## Acceptance criteria
- All v4 elements queryable via FHIR R4 API.
- Capability statement declares v4 conformance.
- Patient profile UI captures SOGI, pronouns, tribal affiliation.
- Encounter detail shows type, location, diagnosis, discharge disposition.
- USCDI v4 compliance service returns 100% element coverage.

## Risks
- **Backfill quality:** existing patients have no SOGI/pronoun data. UI must prompt without forcing. Ensure profile completeness scoring de-weights these for legacy patients.
- **Vocabulary licensing:** SNOMED CT for SPCU requires UMLS license. Confirm we have it (likely yes via NLM affiliate license).
- **Coverage data source:** Insurance info is currently freeform. Coverage as a structured FHIR resource may require provider/payer integration, not patient self-report. Phase rollout accordingly.
