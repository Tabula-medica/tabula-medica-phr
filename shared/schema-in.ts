/**
 * India-specific PHR schema extensions.
 *
 * These tables are additive — every row references an existing `profiles.id`.
 * The ABDM (Ayushman Bharat Digital Mission) transaction layer is in
 * server/abdm/; this schema persists the resulting identifiers and coverage
 * data for the PHR profile.
 *
 * Conformance targets:
 *   - ABDM Health Data Management Policy 2023
 *   - NDHM FHIR IG  https://nrces.in/ndhm/fhir/r4/
 *   - IN Base IG    https://build.fhir.org/ig/hl7-india/FHIR-India/
 *   - ICD-10 (WHO; India uses unmodified ICD-10 for mortality; ICD-11 rollout in progress)
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

/** ABHA verification status — mirrors ABDM gateway states. */
export const abhaVerificationStatusEnum = pgEnum("in_abha_verification_status", [
  "verified",    // OTP-confirmed with ABDM gateway
  "provisional", // created, OTP not yet completed
  "linked",      // linked to Aadhaar / mobile
  "deactivated",
]);

/** PM-JAY coverage category — determines benefit ceiling. */
export const pmjayBenefitCategoryEnum = pgEnum("in_pmjay_benefit_category", [
  "health_benefit_package", // standard HBP
  "empanelled_hospital",    // treatment at empanelled hospital
  "pre_existing",           // pre-existing condition covered
]);

/** Central government scheme type. */
export const centralSchemeEnum = pgEnum("in_central_scheme", [
  "cghs",    // Central Government Health Scheme
  "echs",    // Ex-Servicemen Contributory Health Scheme
  "esis",    // Employees' State Insurance Scheme
  "pmjay",   // Pradhan Mantri Jan Arogya Yojana (Ayushman Bharat)
  "rsby",    // Rashtriya Swasthya Bima Yojana (legacy)
  "other",
]);

/** Indian state code — ISO 3166-2:IN */
export const indianStateEnum = pgEnum("in_state_code", [
  "AN", "AP", "AR", "AS", "BR", "CH", "CG", "DD", "DL", "DN",
  "GA", "GJ", "HP", "HR", "JH", "JK", "KA", "KL", "LA", "LD",
  "MH", "ML", "MN", "MP", "MZ", "NL", "OD", "PB", "PY", "RJ",
  "SK", "TN", "TR", "TS", "UP", "UT", "WB",
]);

// ─── IN Patient Identifiers ───────────────────────────────────────────────────

/**
 * India government-issued and ABDM health identifiers for a PHR profile.
 *
 * FHIR IN Patient identifier slices this maps to:
 *   abha-number   → system: https://nrces.in/ndhm/fhir/r4/CodeSystem/ndhm-identifier-type-code
 *   aadhaar       → system: https://uidai.gov.in (ENCRYPTED; never stored plaintext)
 *   pmjay         → system: https://pmjay.gov.in/beneficiary
 *
 * Encrypted at rest: all *Enc fields use phi-column-map AES-256-GCM wrapper.
 */
export const inPatientIdentifiers = pgTable(
  "in_patient_identifiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    // ── ABHA (Ayushman Bharat Health Account) ────────────────────────────────
    // 14-digit health ID assigned by ABDM. Format: XX-XXXX-XXXX-XXXX.
    abhaNumberEnc: text("abha_number_enc"),
    abhaAddress: text("abha_address"),               // user-chosen "name@abdm" alias
    abhaVerificationStatus: abhaVerificationStatusEnum("abha_verification_status"),
    abhaLinkedAt: timestamp("abha_linked_at", { withTimezone: true }),
    abhaQrDataEnc: text("abha_qr_data_enc"),         // encrypted QR payload for sharing

    // ── Aadhaar (linked HID) ─────────────────────────────────────────────────
    // 12-digit UID. DPDP Act 2023 classifies as sensitive personal data.
    // Stored as last-4 for display; full number only if explicitly required.
    aadhaarLast4: text("aadhaar_last_4"),             // plain last 4 digits for display
    aadhaarLinked: boolean("aadhaar_linked").default(false), // whether ABHA linked to Aadhaar

    // ── PM-JAY (Pradhan Mantri Jan Arogya Yojana / Ayushman Bharat) ─────────
    // Beneficiary ID from NHA PMJAY portal. Format varies by state.
    pmjayBeneficiaryIdEnc: text("pmjay_beneficiary_id_enc"),
    pmjayFamilyId: text("pmjay_family_id"),
    pmjayBenefitCategory: pmjayBenefitCategoryEnum("pmjay_benefit_category"),
    pmjayCardVerified: boolean("pmjay_card_verified").default(false),

    // ── CGHS / ECHS ──────────────────────────────────────────────────────────
    cghsBeneficiaryIdEnc: text("cghs_beneficiary_id_enc"),
    cghsWellnessCenter: text("cghs_wellness_center"),

    // ── ESI (Employees' State Insurance) ────────────────────────────────────
    esiInsuranceNumberEnc: text("esi_insurance_number_enc"),
    esiDispensary: text("esi_dispensary"),

    // ── UHID (legacy Unique Health ID) ──────────────────────────────────────
    // Pre-ABDM hospital-issued unique IDs — relevant for EHR continuity.
    uhidEnc: text("uhid_enc"),
    uhidIssuerHospital: text("uhid_issuer_hospital"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    profileUniq: uniqueIndex("in_patient_identifiers_profile_uniq").on(t.profileId),
  }),
);

export const insertInPatientIdentifiersSchema = createInsertSchema(
  inPatientIdentifiers,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InPatientIdentifiers = typeof inPatientIdentifiers.$inferSelect;
export type InsertInPatientIdentifiers = z.infer<
  typeof insertInPatientIdentifiersSchema
>;

// ─── IN Patient Demographics ──────────────────────────────────────────────────

/**
 * India-specific demographic fields.
 *
 * FHIR IN Patient extensions this maps to:
 *   religion      → ext: http://hl7.org/fhir/StructureDefinition/patient-religion
 *   caste         → not in core FHIR; stored in extensions per India MoHFW requirements
 *   bpl-status    → Below Poverty Line flag (required for PM-JAY eligibility)
 */
export const inPatientDemographics = pgTable(
  "in_patient_demographics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    // ── Address ──────────────────────────────────────────────────────────────
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    village: text("village"),
    taluka: text("taluka"),
    district: text("district"),
    state: indianStateEnum("state"),
    pincode: text("pincode"),           // 6-digit Indian PIN code
    country: text("country").default("IN"),

    // ── Socioeconomic ────────────────────────────────────────────────────────
    belowPovertyLine: boolean("below_poverty_line").default(false),
    rationCardType: text("ration_card_type")
      .$type<"aay" | "phh" | "nphh" | null>(), // Antyodaya / Priority / Non-Priority

    // ── Contact ──────────────────────────────────────────────────────────────
    mobilePhone: text("mobile_phone"),  // encrypted via phi-column-map; E.164 format
    alternatePhone: text("alternate_phone"),

    // ── Language (for ABDM consent communications) ───────────────────────────
    preferredLanguage: text("preferred_language")
      .$type<"hi" | "en" | "bn" | "te" | "mr" | "ta" | "ur" | "gu" | "kn" | "or" | "ml" | "pa" | "as" | "other" | null>(),

    // ── Emergency contact ────────────────────────────────────────────────────
    emergencyContactNameEnc: text("emergency_contact_name_enc"),
    emergencyContactRelation: text("emergency_contact_relation"),
    emergencyContactPhoneEnc: text("emergency_contact_phone_enc"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    profileUniq: uniqueIndex("in_patient_demographics_profile_uniq").on(t.profileId),
  }),
);

export type InPatientDemographics = typeof inPatientDemographics.$inferSelect;

// ─── IN Health Coverage ───────────────────────────────────────────────────────

/**
 * India health coverage — government and private schemes.
 *
 * Coverage types:
 *   pmjay         — Ayushman Bharat PM-JAY (₹5L/family/year)
 *   cghs          — Central Govt Health Scheme (central govt employees)
 *   echs          — Ex-Servicemen Contributory Health Scheme
 *   esis          — Employees' State Insurance (organised sector workers)
 *   state_scheme  — State-level schemes (Arogyasri, MA, Muthyalu, etc.)
 *   private       — Private health insurance (Star, HDFC, etc.)
 *   employer      — Employer-sponsored group health
 *   none          — Self-pay / uninsured
 */
export const inHealthCoverage = pgTable("in_health_coverage", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),

  schemeType: centralSchemeEnum("scheme_type").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  effectiveDate: date("effective_date"),
  expiryDate: date("expiry_date"),

  // ── State scheme details ──────────────────────────────────────────────────
  stateSchemeState: indianStateEnum("state_scheme_state"),
  stateSchemeName: text("state_scheme_name"),  // e.g. "Aarogyasri", "Mukhyamantri Chiranjeevi"

  // ── Private insurer details ───────────────────────────────────────────────
  insurerName: text("insurer_name"),
  policyNumberEnc: text("policy_number_enc"),
  sumInsured: integer("sum_insured"),            // in INR
  premiumAnnual: integer("premium_annual"),      // in INR
  criticalIllnessCover: boolean("critical_illness_cover").default(false),

  // ── TPA (Third Party Administrator) ─────────────────────────────────────
  tpaName: text("tpa_name"),                     // Medi Assist, MD India, etc.
  tpaIdEnc: text("tpa_id_enc"),

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

export type InHealthCoverage = typeof inHealthCoverage.$inferSelect;

// ─── IN Condition Codes ───────────────────────────────────────────────────────

/**
 * Links a core `phr_medical_history` row to India-specific clinical coding.
 *
 * India uses:
 *   ICD-10 WHO (unmodified) for mortality coding (MoHFW)
 *   ICD-11 for morbidity (rollout in progress; NHP target FY2026)
 *   SNOMED CT International for clinical terminology (via ABDM)
 *
 * FHIR Condition code system for IN IG:
 *   ICD-10   → system: http://hl7.org/fhir/sid/icd-10
 *   ICD-11   → system: http://id.who.int/icd/release/11/mms
 *   SNOMED   → system: http://snomed.info/sct
 */
export const inConditionCodes = pgTable("in_condition_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  medicalHistoryId: uuid("medical_history_id").notNull(),

  // ── ICD-10 (WHO) ─────────────────────────────────────────────────────────
  icd10Code: text("icd10_code"),
  icd10Display: text("icd10_display"),

  // ── ICD-11 ───────────────────────────────────────────────────────────────
  icd11Code: text("icd11_code"),
  icd11Uri: text("icd11_uri"),           // e.g. "http://id.who.int/icd/entity/594985290"
  icd11Display: text("icd11_display"),

  // ── SNOMED CT ─────────────────────────────────────────────────────────────
  snomedSctId: text("snomed_sct_id"),
  snomedDisplay: text("snomed_display"),

  // ── ABDM FHIR encounter linkage ──────────────────────────────────────────
  abdmEncounterId: text("abdm_encounter_id"), // links back to an ABDM health record

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type InConditionCodes = typeof inConditionCodes.$inferSelect;

// ─── IN ABDM Consent Record ───────────────────────────────────────────────────

/**
 * Persists the ABDM consent artefact state for a profile.
 *
 * ABDM consent is initiated in server/abdm/consent.ts; this table records
 * what was consented and whether it's still active, so the UI can show
 * consent status without re-querying the gateway.
 *
 * Conforms to: Health Data Management Policy 2023, §6 (consent framework)
 */
export const inAbdmConsent = pgTable("in_abdm_consent", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),

  // Gateway consent artefact ID
  consentArtefactId: text("consent_artefact_id"),

  consentStatus: text("consent_status")
    .notNull()
    .$type<"granted" | "denied" | "expired" | "revoked" | "pending">(),

  // HI types consented (OPConsultation, Prescription, DiagnosticReport, etc.)
  hiTypes: jsonb("hi_types")
    .$type<string[]>()
    .notNull()
    .default([]),

  purposeCode: text("purpose_code")
    .$type<"CAREMGT" | "BTG" | "PUBHLTH" | "HPAYMT" | "DSRCH" | "PATRQST" | null>(),

  consentGrantedAt: timestamp("consent_granted_at", { withTimezone: true }),
  consentExpiresAt: timestamp("consent_expires_at", { withTimezone: true }),
  consentRevokedAt: timestamp("consent_revoked_at", { withTimezone: true }),
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type InAbdmConsent = typeof inAbdmConsent.$inferSelect;
