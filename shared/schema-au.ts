/**
 * AU-specific PHR schema extensions.
 *
 * These tables are additive — every row references an existing `profiles.id`.
 * Nothing in the core schema changes; AU data lives alongside it.
 *
 * Conformance targets:
 *   - AU Base IG  https://build.fhir.org/ig/hl7au/au-fhir-base/
 *   - AU Core IG  https://build.fhir.org/ig/hl7au/au-fhir-core/
 *   - My Health Record FHIR API (ADHA)
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  integer,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { profiles } from "./schema";

// ─── Enums ────────────────────────────────────────────────────────────────────

/**
 * IHI status values as per HI Service specification.
 * https://www.digitalhealth.gov.au/healthcare-providers/hi-service
 */
export const ihiStatusEnum = pgEnum("au_ihi_status", [
  "active",
  "retired",
  "resolved",
  "deceased",
]);

/**
 * IHI record status — whether the IHI has been verified against the HI Service.
 */
export const ihiRecordStatusEnum = pgEnum("au_ihi_record_status", [
  "verified",   // confirmed against HI Service
  "provisional", // self-reported, not yet confirmed
  "unverified",
]);

/**
 * DVA card colour determines scope of coverage.
 * Gold = all conditions; White = service-related only; Orange = disability.
 */
export const dvaCardColorEnum = pgEnum("au_dva_card_color", [
  "gold",
  "white",
  "orange",
]);

/**
 * Australian indigenous status — required by ADHA for MyHR patient matching.
 * Values from METEOR 602543.
 */
export const indigenousStatusEnum = pgEnum("au_indigenous_status", [
  "aboriginal",
  "torres_strait_islander",
  "both",
  "neither",
  "not_stated",
]);

/**
 * Date accuracy indicator per AS 5017-2006 Health Care Client Identification.
 * Used on IHI-linked records to signal DOB precision.
 */
export const dobAccuracyEnum = pgEnum("au_dob_accuracy", [
  "AAA", // exact year/month/day
  "AAU", // year/month known, day unknown
  "AUU", // year known, month/day unknown
  "UUU", // completely unknown
]);

// ─── AU Patient Identifiers ───────────────────────────────────────────────────

/**
 * Australian government-issued healthcare identifiers for a PHR profile.
 *
 * FHIR AU Patient identifier slices this maps to:
 *   ihi        → system: http://ns.electronichealth.net.au/id/hi/ihi/1.0
 *   medicare   → system: http://ns.electronichealth.net.au/id/medicare-number
 *   dva        → system: http://ns.electronichealth.net.au/id/dva
 *
 * Encrypted at rest: all identifier values go through the phi-column-map
 * encryption wrapper before persistence (see server/security/phi-encryption.ts).
 */
export const auPatientIdentifiers = pgTable(
  "au_patient_identifiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    // ── Individual Healthcare Identifier (IHI) ──────────────────────────────
    // 16-digit number. Stored encrypted; display as XXXX XXXX XXXX XXXX.
    ihiNumberEnc: text("ihi_number_enc"),
    ihiStatus: ihiStatusEnum("ihi_status"),
    ihiRecordStatus: ihiRecordStatusEnum("ihi_record_status"),
    ihiVerifiedAt: timestamp("ihi_verified_at", { withTimezone: true }),

    // ── Medicare card ────────────────────────────────────────────────────────
    // Card number (10 digits) + IRN (1 digit) + expiry (MM/YYYY).
    // Combined value stored as "XXXXXXXXXX/Y" — system expects this format.
    medicareNumberEnc: text("medicare_number_enc"),
    medicareIrn: text("medicare_irn"),           // Individual Reference Number 1-9
    medicareExpiryMmYyyy: text("medicare_expiry"), // "MM/YYYY"

    // ── Department of Veterans' Affairs ─────────────────────────────────────
    // Format: state prefix + 7–8 chars (e.g. NVIC123456).
    dvaNumberEnc: text("dva_number_enc"),
    dvaCardColor: dvaCardColorEnum("dva_card_color"),

    // ── Healthcare Provider identifiers (when profile = provider) ───────────
    // HPI-I: 16-digit individual provider; HPI-O: 16-digit organisation.
    hpiiNumberEnc: text("hpii_number_enc"),
    hpioNumberEnc: text("hpio_number_enc"),

    // ── Concession & entitlements ────────────────────────────────────────────
    // Pension Concession Card / Health Care Card / Commonwealth Seniors.
    concessionCardNumberEnc: text("concession_card_number_enc"),
    concessionCardType: text("concession_card_type")
      .$type<"pcc" | "hcc" | "cshc" | null>(),
    concessionCardExpiryDate: date("concession_card_expiry"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    profileUniq: uniqueIndex("au_patient_identifiers_profile_uniq").on(
      t.profileId,
    ),
  }),
);

export const insertAuPatientIdentifiersSchema = createInsertSchema(
  auPatientIdentifiers,
).omit({ id: true, createdAt: true, updatedAt: true });

export type AuPatientIdentifiers = typeof auPatientIdentifiers.$inferSelect;
export type InsertAuPatientIdentifiers = z.infer<
  typeof insertAuPatientIdentifiersSchema
>;

// ─── AU Patient Demographics ──────────────────────────────────────────────────

/**
 * AU-specific demographic fields that don't exist on the core `profiles` table.
 *
 * FHIR AU Patient extensions this maps to:
 *   gender-identity  → ext: http://hl7.org.au/fhir/StructureDefinition/gender-identity
 *   indigenous-status → ext: http://hl7.org.au/fhir/StructureDefinition/indigenous-status
 *   dob-accuracy     → ext: http://hl7.org.au/fhir/StructureDefinition/date-accuracy-indicator
 *   address          → Patient.address (AU Base adds postcode validation)
 */
export const auPatientDemographics = pgTable(
  "au_patient_demographics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    // ── Gender (AU Core separates gender identity from sex at birth) ─────────
    // FHIR Patient.gender remains administrative; these are extensions.
    genderIdentity: text("gender_identity"),       // free text per AU Core spec
    sexAssignedAtBirth: text("sex_assigned_at_birth")
      .$type<"male" | "female" | "intersex" | "unknown" | null>(),

    // ── Indigenous status ────────────────────────────────────────────────────
    indigenousStatus: indigenousStatusEnum("indigenous_status").default(
      "not_stated",
    ),

    // ── Date of birth accuracy ───────────────────────────────────────────────
    dobAccuracy: dobAccuracyEnum("dob_accuracy").default("AAA"),

    // ── Australian address ───────────────────────────────────────────────────
    // Stored separately to core profile; AU addresses require postcode for
    // Medicare/PBS eligibility checks and HI Service matching.
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    suburb: text("suburb"),
    state: text("state")
      .$type<"ACT" | "NSW" | "NT" | "QLD" | "SA" | "TAS" | "VIC" | "WA" | null>(),
    postcode: text("postcode"),  // 4-digit AU postcode, stored as text
    country: text("country").default("AU"),

    // ── Contact (AU systems expect phone in E.164 or local format) ───────────
    mobilePhone: text("mobile_phone"),   // encrypted via phi-column-map
    homePhone: text("home_phone"),

    // ── ATSI health service registration ────────────────────────────────────
    // Some AU health services require this flag for funding purposes.
    atsiHealthServiceRegistered: boolean(
      "atsi_health_service_registered",
    ).default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    profileUniq: uniqueIndex("au_patient_demographics_profile_uniq").on(
      t.profileId,
    ),
  }),
);

export type AuPatientDemographics = typeof auPatientDemographics.$inferSelect;

// ─── AU Medication Codes (AMT / PBS) ─────────────────────────────────────────

/**
 * Links a core `medications_new` row to Australian Medicines Terminology and
 * Pharmaceutical Benefits Scheme codes.
 *
 * AMT is a SNOMED CT-AU extension; every AMT concept has a SNOMED SCT ID.
 * PBS codes are separate (item number, restriction code, manufacturer).
 *
 * FHIR AU MedicationRequest identifier systems:
 *   AMT  → system: http://snomed.info/sct  (AU edition)
 *   PBS  → system: http://pbs.gov.au/code/item
 *   GTIN → system: http://www.gs1.org/gtin
 *   ARTG (TGA) → system: http://www.tga.gov.au/artg
 */
export const auMedicationCodes = pgTable("au_medication_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  medicationId: uuid("medication_id").notNull(), // FK to medicationsTable.id

  // ── AMT ──────────────────────────────────────────────────────────────────
  // AMT uses SNOMED SCT IDs. Three granularity levels:
  //   CTPP: container/trade product pack  (most specific, for dispensing)
  //   TPP:  trade product pack            (same product, any pack size)
  //   MPP:  medicinal product pack        (generic-level)
  amtCtppSctId: text("amt_ctpp_sct_id"),         // e.g. "28237011000036101"
  amtTppSctId: text("amt_tpp_sct_id"),
  amtMppSctId: text("amt_mpp_sct_id"),
  amtTgaApprovedName: text("amt_tga_approved_name"), // TGA-registered display name

  // ── PBS ───────────────────────────────────────────────────────────────────
  pbsItemCode: text("pbs_item_code"),             // e.g. "2622B"
  pbsRestrictionCode: text("pbs_restriction_code"),
  pbsBenefitType: text("pbs_benefit_type")
    .$type<"unrestricted" | "restricted" | "authority_required" | "authority_required_streamlined" | null>(),
  pbsMaxQuantity: integer("pbs_max_quantity"),
  pbsMaxRepeats: integer("pbs_max_repeats"),
  pbsSafetyNetContribution: text("pbs_safety_net_contribution"), // dollar amount as text

  // ── TGA / ARTG ────────────────────────────────────────────────────────────
  artgId: text("artg_id"),                        // TGA ARTG entry number

  // ── GTIN (barcode) ───────────────────────────────────────────────────────
  gtin: text("gtin"),                             // 14-digit GTIN

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AuMedicationCodes = typeof auMedicationCodes.$inferSelect;

// ─── AU Condition Codes (ICD-10-AM / SNOMED CT-AU) ───────────────────────────

/**
 * Links a core `phr_medical_history` row to Australian clinical coding.
 *
 * ICD-10-AM (Australian Modification) is published by AIHW and updated
 * annually. It diverges from ICD-10-CM in ~4,000 codes (procedure chapters
 * especially). Conditions imported from AU GP software (Best Practice, Medical
 * Director) will arrive with ICD-10-AM codes.
 *
 * FHIR Condition code system:
 *   ICD-10-AM → system: http://hl7.org/fhir/sid/icd-10-am
 *   SNOMED CT-AU → system: http://snomed.info/sct (AU edition OID: 32506021000036107)
 */
export const auConditionCodes = pgTable("au_condition_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  medicalHistoryId: uuid("medical_history_id").notNull(), // FK to phr_medical_history.id

  // ── ICD-10-AM ────────────────────────────────────────────────────────────
  icd10amCode: text("icd10am_code"),              // e.g. "J06.9"
  icd10amEdition: text("icd10am_edition"),        // e.g. "12th" (2022–23)
  icd10amDisplay: text("icd10am_display"),

  // ── SNOMED CT-AU ─────────────────────────────────────────────────────────
  snomedSctId: text("snomed_sct_id"),             // e.g. "195967001"
  snomedDisplay: text("snomed_display"),
  snomedEditionDate: text("snomed_edition_date"), // e.g. "20230531"

  // ── ACHI (procedures) ────────────────────────────────────────────────────
  // Australian Classification of Health Interventions (companion to ICD-10-AM)
  achiCode: text("achi_code"),
  achiDisplay: text("achi_display"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AuConditionCodes = typeof auConditionCodes.$inferSelect;

// ─── AU Health Coverage ───────────────────────────────────────────────────────

/**
 * Australian health coverage model. Replaces the US InsurancePlan interface
 * for AU-region profiles.
 *
 * Coverage types in AU:
 *   medicare      — universal, funded by Medicare levy
 *   pbs           — Pharmaceutical Benefits Scheme (subsidised medicines)
 *   private_hospital — private health insurance, hospital tier
 *   private_extras  — extras/ancillary (dental, optical, physio)
 *   dva           — Department of Veterans' Affairs
 *   atsi_mbs      — ATSI-specific MBS items (715 health check, etc.)
 *   workers_comp  — state-based workers compensation
 *
 * FHIR AU Coverage:
 *   profile: http://hl7.org.au/fhir/StructureDefinition/au-coverage
 *   insurer.identifier.system: Medicare → http://ns.electronichealth.net.au/id/hi/ihi/1.0
 */
export const auHealthCoverage = pgTable("au_health_coverage", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),

  coverageType: text("coverage_type")
    .notNull()
    .$type<
      | "medicare"
      | "pbs"
      | "private_hospital"
      | "private_extras"
      | "dva"
      | "atsi_mbs"
      | "workers_comp"
      | "other"
    >(),

  isActive: boolean("is_active").notNull().default(true),
  effectiveDate: date("effective_date"),
  terminationDate: date("termination_date"),

  // ── Private health insurer details ───────────────────────────────────────
  insurerName: text("insurer_name"),   // Medibank, Bupa, HCF, NIB, HBF, etc.
  policyNumber: text("policy_number"),
  membershipNumber: text("membership_number"),
  hospitalTier: text("hospital_tier"),   // gold/silver/bronze/basic (PHI tiers)
  extrasTier: text("extras_tier"),

  // ── PBS safety net tracking ──────────────────────────────────────────────
  pbsSafetyNetNumber: text("pbs_safety_net_number"),
  pbsSafetyNetThresholdReached: boolean(
    "pbs_safety_net_threshold_reached",
  ).default(false),
  pbsYtdCopayments: text("pbs_ytd_copayments"), // dollar amount as text

  // ── Medicare Safety Net ──────────────────────────────────────────────────
  medicareSafetyNetRegistered: boolean(
    "medicare_safety_net_registered",
  ).default(false),

  // ── Flexible metadata ────────────────────────────────────────────────────
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AuHealthCoverage = typeof auHealthCoverage.$inferSelect;

// ─── AU MyHR Consent ─────────────────────────────────────────────────────────

/**
 * My Health Record access consent record.
 *
 * Patients control which providers/systems can access their MyHR. This table
 * tracks the consent state for each connected system so the PHR can surface
 * it in the UI and respect restrictions when syncing.
 *
 * Required before any MyHR read/write via the ADHA FHIR gateway.
 */
export const auMyhrConsent = pgTable("au_myhr_consent", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),

  consentStatus: text("consent_status")
    .notNull()
    .$type<"active" | "withdrawn" | "restricted" | "opt_out">(),

  // Restricted access code — patient-set 4-digit PIN that limits emergency access
  restrictedAccessCode: text("restricted_access_code"), // hashed, never plaintext

  // Document-type access restrictions (patient can hide specific doc types)
  restrictedDocTypes: jsonb("restricted_doc_types")
    .$type<string[]>()
    .default([]),

  // Provider-level access codes (per-provider access restrictions)
  providerAccessRestrictions: jsonb("provider_access_restrictions")
    .$type<{ hpioNumber: string; restricted: boolean }[]>()
    .default([]),

  consentGrantedAt: timestamp("consent_granted_at", { withTimezone: true }),
  consentWithdrawnAt: timestamp("consent_withdrawn_at", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),

  // ADHA-issued access token metadata (NOT the token itself — store in Secret Manager)
  adhaTokenExpiry: timestamp("adha_token_expiry", { withTimezone: true }),
  adhaSystemHpioEnc: text("adha_system_hpio_enc"), // our registered HPI-O

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AuMyhrConsent = typeof auMyhrConsent.$inferSelect;
