/**
 * Africa-region PHR schema extensions.
 *
 * Africa has 54 countries and no single unified health ID system, so this
 * schema takes a pan-African approach: a country code field selects the
 * relevant national identifier scheme, with well-known schemes given typed
 * columns and a catch-all JSON metadata field for edge cases.
 *
 * Priority markets reflected here:
 *   South Africa — NHN (National Health Number), ICD-10 ZA
 *   Kenya         — NHIF (National Hospital Insurance Fund)
 *   Nigeria       — NHIS (National Health Insurance Authority), NIN
 *   Ethiopia      — HMIS patient ID
 *   WHO Africa    — WHO EPI, DHIS2 tracked entity
 *
 * Conformance targets:
 *   - WHO AFRO FHIR IG (draft)
 *   - Smart Health Links (IETF draft — used by African Union digital health)
 *   - DHIS2 tracked entity attribute mapping
 *   - East African Community Health IG (EAC)
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
 * ISO 3166-1 alpha-2 codes for the priority Africa markets we model.
 * Other African countries fall through to the metadata JSON column.
 */
export const africaCountryEnum = pgEnum("af_country_code", [
  "ZA", // South Africa
  "KE", // Kenya
  "NG", // Nigeria
  "ET", // Ethiopia
  "GH", // Ghana
  "TZ", // Tanzania
  "UG", // Uganda
  "ZW", // Zimbabwe
  "ZM", // Zambia
  "RW", // Rwanda
  "MZ", // Mozambique
  "SN", // Senegal
  "CI", // Côte d'Ivoire
  "CM", // Cameroon
  "AO", // Angola
  "EG", // Egypt
  "MA", // Morocco
  "OTHER",
]);

/** South Africa medical aid scheme membership status. */
export const saMedicalAidStatusEnum = pgEnum("af_sa_medical_aid_status", [
  "active",
  "suspended",
  "lapsed",
  "dependant",
]);

/** NHIF Kenya membership category. */
export const nhifCategoryEnum = pgEnum("af_ke_nhif_category", [
  "formal_sector",    // employed; deducted from payroll
  "informal_sector",  // self-employed; voluntary
  "civil_servant",
  "nhif_scheme_for_vulnerable", // NHIF-SV subsidised
]);

/** Nigeria NHIA (formerly NHIS) enrollment tier. */
export const nhiaEnrollmentEnum = pgEnum("af_ng_nhia_enrollment", [
  "formal_sector_ecws", // Employees/Employers Contributory
  "informal_sector",
  "vulnerable_group",
  "tertiary_education",
]);

// ─── AF Patient Identifiers ───────────────────────────────────────────────────

/**
 * Pan-African health identifiers for a PHR profile.
 *
 * FHIR identifier systems:
 *   SA NHN   → system: https://www.health.gov.za/nhn
 *   KE NHIF  → system: https://www.nhif.or.ke/member
 *   NG NIN   → system: https://nin.gov.ng
 *   DHIS2    → system: https://dhis2.org/tracked-entity
 */
export const afPatientIdentifiers = pgTable(
  "af_patient_identifiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    countryCode: africaCountryEnum("country_code").notNull(),

    // ── South Africa ─────────────────────────────────────────────────────────
    // NHN: unique patient number across all public health facilities.
    saNhnEnc: text("sa_nhn_enc"),
    saIdNumberEnc: text("sa_id_number_enc"),   // SA green ID / smart ID (13-digit)
    saMedicalAidNumber: text("sa_medical_aid_number"),
    saMedicalAidScheme: text("sa_medical_aid_scheme"), // Discovery, Momentum, Bonitas, etc.

    // ── Kenya ─────────────────────────────────────────────────────────────────
    keNhifMemberNumberEnc: text("ke_nhif_member_number_enc"),
    keNationalIdEnc: text("ke_national_id_enc"),
    keHudumaNumber: text("ke_huduma_number"),           // integrated gov't services ID

    // ── Nigeria ───────────────────────────────────────────────────────────────
    ngNinEnc: text("ng_nin_enc"),              // 11-digit National Identification Number
    ngNhiaIdEnc: text("ng_nhia_id_enc"),       // NHIA enrollment ID
    ngBvnEnc: text("ng_bvn_enc"),              // Bank Verification Number (used for identity)
    ngHfrid: text("ng_hfrid"),                 // Health Facility Registration ID

    // ── Ethiopia ──────────────────────────────────────────────────────────────
    etHmisIdEnc: text("et_hmis_id_enc"),       // facility HMIS patient ID
    etFidaNumber: text("et_fida_number"),       // national digital ID (FID — in rollout)

    // ── Ghana ─────────────────────────────────────────────────────────────────
    ghNhisIdEnc: text("gh_nhis_id_enc"),       // National Health Insurance Authority Ghana
    ghGhanaCardEnc: text("gh_ghana_card_enc"), // GHA-XXXXXXXXX-X format

    // ── WHO / DHIS2 cross-country ─────────────────────────────────────────────
    dhis2TrackedEntityId: text("dhis2_tracked_entity_id"),  // global DHIS2 TE UID
    whoPatientId: text("who_patient_id"),                    // WHO AFRO EPI system
    smartHealthLinkToken: text("smart_health_link_token"),  // SHL credential for sharing

    // ── Catch-all ─────────────────────────────────────────────────────────────
    additionalIdentifiers: jsonb("additional_identifiers")
      .$type<{ system: string; value: string; type: string }[]>()
      .default([]),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    profileUniq: uniqueIndex("af_patient_identifiers_profile_uniq").on(t.profileId),
  }),
);

export const insertAfPatientIdentifiersSchema = createInsertSchema(
  afPatientIdentifiers,
).omit({ id: true, createdAt: true, updatedAt: true });

export type AfPatientIdentifiers = typeof afPatientIdentifiers.$inferSelect;
export type InsertAfPatientIdentifiers = z.infer<
  typeof insertAfPatientIdentifiersSchema
>;

// ─── AF Patient Demographics ──────────────────────────────────────────────────

/**
 * Africa-specific demographic fields — primarily address and language.
 *
 * Address format varies greatly; we use a flat multi-line structure with a
 * country code so the UI can apply country-specific formatting.
 */
export const afPatientDemographics = pgTable(
  "af_patient_demographics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    countryCode: africaCountryEnum("country_code").notNull(),

    // ── Address ───────────────────────────────────────────────────────────────
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    suburb: text("suburb"),      // SA term; equiv to "neighbourhood" elsewhere
    city: text("city"),
    province: text("province"),  // state/county/region per country
    postalCode: text("postal_code"),
    country: text("country").notNull(), // ISO 3166-1 alpha-2

    // ── Language ──────────────────────────────────────────────────────────────
    preferredLanguage: text("preferred_language")
      .$type<
        | "af" | "zu" | "xh" | "st" | "tn" | "sw" | "yo" | "ha" | "ig"
        | "am" | "om" | "so" | "fr" | "pt" | "ar" | "en" | "other" | null
      >(),

    // ── Emergency contact ─────────────────────────────────────────────────────
    emergencyContactNameEnc: text("emergency_contact_name_enc"),
    emergencyContactRelation: text("emergency_contact_relation"),
    emergencyContactPhoneEnc: text("emergency_contact_phone_enc"),

    // ── Rural health context ──────────────────────────────────────────────────
    nearestPublicFacility: text("nearest_public_facility"),
    distanceToFacilityKm: integer("distance_to_facility_km"),
    communityHealthWorkerLinked: boolean("community_health_worker_linked").default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    profileUniq: uniqueIndex("af_patient_demographics_profile_uniq").on(t.profileId),
  }),
);

export type AfPatientDemographics = typeof afPatientDemographics.$inferSelect;

// ─── AF Health Coverage ───────────────────────────────────────────────────────

/**
 * Africa health coverage model — national insurance schemes and private plans.
 *
 * Coverage types:
 *   sa_medical_aid       — SA medical aid scheme (private; ~16% population)
 *   sa_public            — SA public sector (uninsured, public hospital)
 *   ke_nhif              — Kenya NHIF
 *   ng_nhia              — Nigeria NHIA (formerly NHIS)
 *   gh_nhis              — Ghana NHIS
 *   rw_mutuelle          — Rwanda Mutuelle de Santé (community-based)
 *   tz_nhif              — Tanzania NHIF
 *   et_cbhi              — Ethiopia Community-Based Health Insurance
 *   pepfar               — PEPFAR-funded ART program
 *   private_international — Cigna Global, AXA PPP, etc.
 *   ngo_funded           — MSF, IRC, Partners in Health programmes
 *   self_pay
 */
export const afHealthCoverage = pgTable("af_health_coverage", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),

  countryCode: africaCountryEnum("country_code").notNull(),

  schemeType: text("scheme_type")
    .notNull()
    .$type<
      | "sa_medical_aid"
      | "sa_public"
      | "ke_nhif"
      | "ng_nhia"
      | "gh_nhis"
      | "rw_mutuelle"
      | "tz_nhif"
      | "et_cbhi"
      | "pepfar"
      | "private_international"
      | "ngo_funded"
      | "self_pay"
      | "other"
    >(),

  isActive: boolean("is_active").notNull().default(true),
  effectiveDate: date("effective_date"),
  terminationDate: date("termination_date"),

  // ── SA Medical Aid ────────────────────────────────────────────────────────
  saMedicalAidScheme: text("sa_medical_aid_scheme"),
  saMedicalAidStatus: saMedicalAidStatusEnum("sa_medical_aid_status"),
  saMedicalAidPlan: text("sa_medical_aid_plan"),    // plan tier within the scheme
  saMedicalAidMemberIdEnc: text("sa_medical_aid_member_id_enc"),

  // ── KE NHIF ────────────────────────────────────────────────────────────────
  keNhifCategory: nhifCategoryEnum("ke_nhif_category"),
  keNhifMemberNumberEnc: text("ke_nhif_member_number_enc"),

  // ── NG NHIA ───────────────────────────────────────────────────────────────
  ngNhiaEnrollment: nhiaEnrollmentEnum("ng_nhia_enrollment"),
  ngNhiaHmoName: text("ng_nhia_hmo_name"),

  // ── Private / international ───────────────────────────────────────────────
  insurerName: text("insurer_name"),
  policyNumberEnc: text("policy_number_enc"),
  sumInsuredUsd: integer("sum_insured_usd"),

  // ── NGO / PEPFAR programme ────────────────────────────────────────────────
  programmeName: text("programme_name"),
  programmePartnerOrg: text("programme_partner_org"),

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

export type AfHealthCoverage = typeof afHealthCoverage.$inferSelect;

// ─── AF Condition Codes ───────────────────────────────────────────────────────

/**
 * Links a core `phr_medical_history` row to Africa-region clinical coding.
 *
 * Africa predominantly uses ICD-10 (WHO). South Africa uses ICD-10 ZA
 * (unmodified ICD-10 with local groupings). DHIS2 uses ICD-10 internally.
 * Rwanda has piloted ICD-11 for primary care.
 *
 * SNOMED CT is used in SA private sector and some WHO AFRO programs.
 *
 * FHIR Condition code systems:
 *   ICD-10   → system: http://hl7.org/fhir/sid/icd-10
 *   ICD-11   → system: http://id.who.int/icd/release/11/mms
 *   SNOMED   → system: http://snomed.info/sct
 *   DHIS2    → system: https://dhis2.org/disease-code
 */
export const afConditionCodes = pgTable("af_condition_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  medicalHistoryId: uuid("medical_history_id").notNull(),

  countryCode: africaCountryEnum("country_code").notNull(),

  // ── ICD-10 (WHO) ──────────────────────────────────────────────────────────
  icd10Code: text("icd10_code"),
  icd10Display: text("icd10_display"),

  // ── ICD-11 ────────────────────────────────────────────────────────────────
  icd11Code: text("icd11_code"),
  icd11Uri: text("icd11_uri"),
  icd11Display: text("icd11_display"),

  // ── SNOMED CT ─────────────────────────────────────────────────────────────
  snomedSctId: text("snomed_sct_id"),
  snomedDisplay: text("snomed_display"),

  // ── DHIS2 disease tracking ────────────────────────────────────────────────
  dhis2DiseaseCode: text("dhis2_disease_code"),
  dhis2ProgramStageId: text("dhis2_program_stage_id"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AfConditionCodes = typeof afConditionCodes.$inferSelect;
