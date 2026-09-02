import { z } from "zod";
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  integer,
  serial,
  jsonb,
  inet,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// ============================================
// DRIZZLE DATABASE TABLES
// ============================================

export const appRegions = ["us", "international"] as const;
export type AppRegion = (typeof appRegions)[number];

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    emailHash: text("email_hash"),
    passwordHash: text("password_hash").notNull(),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    region: text("region").$type<AppRegion>().notNull().default("international"),
    phiAccessUnlocked: boolean("phi_access_unlocked").notNull().default(false),
    betaConsentVersion: text("beta_consent_version"),
    betaConsentSignedAt: timestamp("beta_consent_signed_at", { withTimezone: true }),
    betaConsentSha256: text("beta_consent_sha256"),
    betaConsentIp: text("beta_consent_ip"),
    betaConsentUserAgent: text("beta_consent_user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUx: uniqueIndex("accounts_email_ux").on(t.email),
    emailHashUx: uniqueIndex("accounts_email_hash_ux").on(t.emailHash),
  })
);

export const betaConsentAgreements = pgTable("beta_consent_agreements", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  agreementSha256: text("agreement_sha256").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profileTransitionStatuses = ["pending", "complete"] as const;
export type ProfileTransitionStatus = typeof profileTransitionStatuses[number];

export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  profileType: text("profile_type").notNull(),
  fullName: text("full_name").notNull(),
  dob: date("dob").notNull(),
  preferredLanguage: text("preferred_language").notNull().default("en"),
  simplifiedMode: boolean("simplified_mode").notNull().default(false),
  photoObjectKey: text("photo_object_key"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  transitionStatus: text("transition_status").$type<ProfileTransitionStatus | null>(),
  transitionPendingAt: timestamp("transition_pending_at", { withTimezone: true }),
  transitionCompletedAt: timestamp("transition_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const caregiverAccessTable = pgTable(
  "caregiver_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    caregiverAccountId: uuid("caregiver_account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    canExport: boolean("can_export").notNull().default(true),
    canUpload: boolean("can_upload").notNull().default(true),
    canViewSensitive: boolean("can_view_sensitive").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ux: uniqueIndex("caregiver_access_profile_caregiver_ux").on(t.profileId, t.caregiverAccountId),
  })
);

export const folders = pgTable("folders", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id").references(() => folders.id, { onDelete: "set null" }),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull().unique(),
    label: text("label").notNull(),
    category: text("category").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

export const documentsTable = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  source: text("source"),
  dateOfService: date("date_of_service"),
  mimeType: text("mime_type").notNull(),
  objectKey: text("object_key").notNull(),
  isSensitive: boolean("is_sensitive").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentTags = pgTable(
  "document_tags",
  {
    documentId: uuid("document_id").notNull().references(() => documentsTable.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "restrict" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.documentId, t.tagId] }),
  })
);

export const timelineEvents = pgTable("timeline_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  title: text("title").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  providerName: text("provider_name"),
  facilityName: text("facility_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const timelineEventTags = pgTable(
  "timeline_event_tags",
  {
    timelineEventId: uuid("timeline_event_id").notNull().references(() => timelineEvents.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "restrict" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.timelineEventId, t.tagId] }),
  })
);

export const timelineEventDocuments = pgTable(
  "timeline_event_documents",
  {
    timelineEventId: uuid("timeline_event_id").notNull().references(() => timelineEvents.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => documentsTable.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.timelineEventId, t.documentId] }),
  })
);

export const medicationsTable = pgTable("medications_new", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dose: text("dose"),
  frequency: text("frequency"),
  status: text("status").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const allergiesTable = pgTable("phr_allergies", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  allergen: text("allergen").notNull(),
  reaction: text("reaction"),
  severity: text("severity"),
  status: text("status").notNull().default("active"),
  onsetDate: date("onset_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const surgeriesTable = pgTable("phr_surgeries", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  procedureName: text("procedure_name").notNull(),
  surgeryDate: date("surgery_date"),
  surgeon: text("surgeon"),
  facility: text("facility"),
  outcome: text("outcome"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const medicalHistoryTable = pgTable("phr_medical_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  condition: text("condition").notNull(),
  diagnosedDate: date("diagnosed_date"),
  status: text("status").notNull().default("active"),
  treatedBy: text("treated_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const socialHistoryTable = pgTable("phr_social_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  description: text("description").notNull(),
  status: text("status"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vaccinesTable = pgTable("phr_vaccines", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  vaccineName: text("vaccine_name").notNull(),
  cvxCode: text("cvx_code"),
  vaccineGroup: text("vaccine_group"),
  manufacturer: text("manufacturer"),
  dateAdministered: date("date_administered"),
  provider: text("provider"),
  lotNumber: text("lot_number"),
  site: text("site"),
  route: text("route"),
  doseNumber: integer("dose_number"),
  notes: text("notes"),
  iisVerified: boolean("iis_verified").default(false),
  iisSource: text("iis_source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sdohTable = pgTable("phr_sdoh", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  domain: text("domain").notNull(),
  question: text("question"),
  response: text("response").notNull(),
  screeningDate: date("screening_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPhrAllergySchema = createInsertSchema(allergiesTable).omit({ id: true, createdAt: true });
export type InsertPhrAllergy = z.infer<typeof insertPhrAllergySchema>;
export type PhrAllergyRecord = typeof allergiesTable.$inferSelect;

export const insertPhrSurgerySchema = createInsertSchema(surgeriesTable).omit({ id: true, createdAt: true });
export type InsertPhrSurgery = z.infer<typeof insertPhrSurgerySchema>;
export type PhrSurgeryRecord = typeof surgeriesTable.$inferSelect;

export const insertPhrMedicalHistorySchema = createInsertSchema(medicalHistoryTable).omit({ id: true, createdAt: true });
export type InsertPhrMedicalHistory = z.infer<typeof insertPhrMedicalHistorySchema>;
export type PhrMedicalHistoryRecord = typeof medicalHistoryTable.$inferSelect;

export const insertPhrSocialHistorySchema = createInsertSchema(socialHistoryTable).omit({ id: true, createdAt: true });
export type InsertPhrSocialHistory = z.infer<typeof insertPhrSocialHistorySchema>;
export type PhrSocialHistoryRecord = typeof socialHistoryTable.$inferSelect;

export const insertPhrVaccineSchema = createInsertSchema(vaccinesTable).omit({ id: true, createdAt: true });
export type InsertPhrVaccine = z.infer<typeof insertPhrVaccineSchema>;
export type PhrVaccineRecord = typeof vaccinesTable.$inferSelect;

export const insertPhrSdohSchema = createInsertSchema(sdohTable).omit({ id: true, createdAt: true });
export type InsertPhrSdoh = z.infer<typeof insertPhrSdohSchema>;
export type PhrSdohRecord = typeof sdohTable.$inferSelect;

// ============================================
// ADVANCE DIRECTIVES — Goals of Care & Treatment Preferences
// ============================================
//
// One structured directive row per profile. PHI fields (goalsOfCare,
// familyPrimaryGoalOfCare, codeStatus, treatmentPreferences) are encrypted at
// rest via the phi-storage wrapper (see server/security/phi-column-map.ts →
// `advanceDirectivesTable`). Uploaded directive FORMS are stored as normal
// documents in the "advance_directives" system folder (folders.key).

/** Code-status options for an advance directive. */
export const advanceDirectiveCodeStatuses = ["Full Code", "DNR", "DNI"] as const;
export type AdvanceDirectiveCodeStatus = typeof advanceDirectiveCodeStatuses[number];

/** yes/no/null answer for each treatment-preference item. */
export type TreatmentPreferenceValue = "yes" | "no" | null;

/**
 * Structured treatment-preference grid. The first 9 items are displayed as
 * "requested" and the last 2 (feedingTube, intubation) as "not to be
 * initiated", but all are stored uniformly as yes/no/null.
 */
export interface TreatmentPreferences {
  antibioticsIv: TreatmentPreferenceValue;
  antibioticsOral: TreatmentPreferenceValue;
  bloodTransfusion: TreatmentPreferenceValue;
  diagnosticTest: TreatmentPreferenceValue;
  hcProxyInvoked: TreatmentPreferenceValue;
  hospitalization: TreatmentPreferenceValue;
  ivHydration: TreatmentPreferenceValue;
  labTest: TreatmentPreferenceValue;
  surgicalIntervention: TreatmentPreferenceValue;
  feedingTube: TreatmentPreferenceValue;
  intubation: TreatmentPreferenceValue;
}

export const advanceDirectivesTable = pgTable(
  "advance_directives",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    familyPrimaryGoalOfCare: text("family_primary_goal_of_care"),
    goalsOfCare: text("goals_of_care"),
    // Multi-select code status stored as text[] (options: Full Code / DNR / DNI).
    codeStatus: text("code_status").array(),
    // Structured yes/no/null grid stored as jsonb (encrypted as an envelope).
    treatmentPreferences: jsonb("treatment_preferences").$type<TreatmentPreferences>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileUx: uniqueIndex("advance_directives_profile_ux").on(t.profileId),
  })
);

export const insertAdvanceDirectiveSchema = createInsertSchema(advanceDirectivesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAdvanceDirective = z.infer<typeof insertAdvanceDirectiveSchema>;
export type AdvanceDirectiveRecord = typeof advanceDirectivesTable.$inferSelect;

// ============================================
// MEDICATION MANAGEMENT MODULE
// ============================================

export const medicationReminderFrequencies = ["once_daily", "twice_daily", "three_times_daily", "four_times_daily", "weekly", "as_needed", "custom"] as const;
export type MedicationReminderFrequency = typeof medicationReminderFrequencies[number];

export const medicationRemindersTable = pgTable("medication_reminders", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  medicationId: uuid("medication_id").references(() => medicationsTable.id, { onDelete: "cascade" }),
  medicationName: text("medication_name").notNull(),
  dosage: text("dosage"),
  frequency: text("frequency").notNull(),
  scheduledTimes: text("scheduled_times").array().notNull(),
  daysOfWeek: integer("days_of_week").array(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  notifyPush: boolean("notify_push").notNull().default(true),
  notifyEmail: boolean("notify_email").notNull().default(false),
  notifySms: boolean("notify_sms").notNull().default(false),
  advanceMinutes: integer("advance_minutes").notNull().default(15),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adherenceLogStatuses = ["taken", "skipped", "late", "pending", "missed"] as const;
export type AdherenceLogStatus = typeof adherenceLogStatuses[number];

export const medicationAdherenceLogsTable = pgTable("medication_adherence_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  medicationId: uuid("medication_id").references(() => medicationsTable.id, { onDelete: "set null" }),
  reminderId: uuid("reminder_id").references(() => medicationRemindersTable.id, { onDelete: "set null" }),
  medicationName: text("medication_name").notNull(),
  scheduledTime: timestamp("scheduled_time", { withTimezone: true }).notNull(),
  actualTime: timestamp("actual_time", { withTimezone: true }),
  status: text("status").notNull(),
  notes: text("notes"),
  sideEffects: text("side_effects").array(),
  mood: text("mood"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const medicationInteractionSeverities = ["low", "moderate", "high", "critical"] as const;
export type MedicationInteractionSeverity = typeof medicationInteractionSeverities[number];

export const medicationInteractionFlagStatuses = ["pending", "reviewed", "dismissed", "resolved"] as const;
export type MedicationInteractionFlagStatus = typeof medicationInteractionFlagStatuses[number];

export const medicationInteractionFlagsTable = pgTable("medication_interaction_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  medication1Id: uuid("medication_1_id").references(() => medicationsTable.id, { onDelete: "set null" }),
  medication1Name: text("medication_1_name").notNull(),
  medication2Id: uuid("medication_2_id").references(() => medicationsTable.id, { onDelete: "set null" }),
  medication2Name: text("medication_2_name").notNull(),
  severity: text("severity").notNull(),
  interactionType: text("interaction_type").notNull(),
  description: text("description").notNull(),
  recommendation: text("recommendation"),
  aiGenerated: boolean("ai_generated").notNull().default(true),
  status: text("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const providerMedicationActionsTable = pgTable("provider_medication_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  medicationId: uuid("medication_id").references(() => medicationsTable.id, { onDelete: "set null" }),
  medicationName: text("medication_name").notNull(),
  actionType: text("action_type").notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  reason: text("reason"),
  providerId: text("provider_id").notNull(),
  providerName: text("provider_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMedicationReminderDBSchema = createInsertSchema(medicationRemindersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMedicationReminderDB = z.infer<typeof insertMedicationReminderDBSchema>;
export type MedicationReminderDB = typeof medicationRemindersTable.$inferSelect;

export const insertAdherenceLogDBSchema = createInsertSchema(medicationAdherenceLogsTable).omit({ id: true, createdAt: true });
export type InsertAdherenceLogDB = z.infer<typeof insertAdherenceLogDBSchema>;
export type AdherenceLogDB = typeof medicationAdherenceLogsTable.$inferSelect;

export const insertInteractionFlagDBSchema = createInsertSchema(medicationInteractionFlagsTable).omit({ id: true, createdAt: true });
export type InsertInteractionFlagDB = z.infer<typeof insertInteractionFlagDBSchema>;
export type InteractionFlagDB = typeof medicationInteractionFlagsTable.$inferSelect;

export const insertProviderMedicationActionDBSchema = createInsertSchema(providerMedicationActionsTable).omit({ id: true, createdAt: true });
export type InsertProviderMedicationActionDB = z.infer<typeof insertProviderMedicationActionDBSchema>;
export type ProviderMedicationActionDB = typeof providerMedicationActionsTable.$inferSelect;

export const symptomEntries = pgTable("symptom_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  medicationId: uuid("medication_id").references(() => medicationsTable.id, { onDelete: "set null" }),
  occurredOn: date("occurred_on").notNull(),
  severity: integer("severity"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const symptomEntryTags = pgTable(
  "symptom_entry_tags",
  {
    symptomEntryId: uuid("symptom_entry_id").notNull().references(() => symptomEntries.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "restrict" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.symptomEntryId, t.tagId] }),
  })
);

export const followups = pgTable("followups", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  cadence: text("cadence").notNull(),
  nextDueDate: date("next_due_date").notNull(),
  lastCompletedOn: date("last_completed_on"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const followupTags = pgTable(
  "followup_tags",
  {
    followupId: uuid("followup_id").notNull().references(() => followups.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "restrict" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.followupId, t.tagId] }),
  })
);

export const packetExports = pgTable("packet_exports", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  createdByAccountId: uuid("created_by_account_id").notNull().references(() => accounts.id, { onDelete: "restrict" }),
  packetType: text("packet_type").notNull(),
  optionsJson: jsonb("options_json").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    packetExportId: uuid("packet_export_id").notNull().references(() => packetExports.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    pinHash: text("pin_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenUx: uniqueIndex("share_links_token_hash_ux").on(t.tokenHash),
  })
);

/**
 * TCPA / DPDP consent, one row per contact point.
 *
 * Durable rather than process-local because a revocation that only reaches
 * one instance is not a revocation. Every production deploy path in this repo
 * (`deploy.sh`, `deploy-world.sh`, `deploy/gcp-deploy.sh`, `cloudbuild.yaml`)
 * runs Cloud Run with `--max-instances=10` and no session affinity, so a STOP
 * processed on one instance has to be visible to the other nine before the
 * next send is gated — otherwise the statutory opt-out is honoured on a tenth
 * of the traffic and ignored on the rest.
 *
 * Lookup is by `phoneHash` (HMAC via `hashPhone`) so a number can be found
 * without decrypting the table; `phone` itself is encrypted at rest.
 */
export const engagementConsentsTable = pgTable(
  "engagement_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phoneHash: text("phone_hash").notNull(),
    phone: text("phone").notNull(),
    state: text("state").notNull(),
    purposes: jsonb("purposes").$type<string[]>().notNull().default([]),
    capturedVia: text("captured_via"),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByKeyword: text("revoked_by_keyword"),
    noticeLanguage: text("notice_language"),
    noticeVersion: text("notice_version"),
    needsStaffReview: boolean("needs_staff_review").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    phoneUx: uniqueIndex("engagement_consents_phone_hash_ux").on(t.phoneHash),
  }),
);

/**
 * Share grants for the health-summary link.
 *
 * Same reasoning as consent, with a sharper edge: `/s/:token` is
 * unauthenticated, so a grant that lives only in one process means a staff
 * revoke on instance A leaves instance B serving medications, diagnoses and
 * allergies to anyone holding the link. The view cap and the PIN attempt
 * lockout are equally worthless per-process — ten instances multiply both by
 * ten.
 *
 * `tokenHash` is SHA-256 of the token; the token itself is never stored.
 */
export const healthSummarySharesTable = pgTable(
  "health_summary_shares",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    sections: jsonb("sections").$type<string[]>().notNull(),
    initiator: text("initiator").notNull(),
    createdByAccountId: text("created_by_account_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    maxViews: integer("max_views").notNull(),
    viewCount: integer("view_count").notNull().default(0),
    pinAttempts: integer("pin_attempts").notNull().default(0),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    language: text("language").notNull().default("en"),
    pinRequired: boolean("pin_required").notNull().default(false),
    /** base64 scrypt output and its salt. Null when no PIN was set. */
    pinHash: text("pin_hash"),
    pinSalt: text("pin_salt"),
    /** Patient-chosen label ("Dr Rao", "Mum"). Encrypted — it names people. */
    label: text("label"),
    attestations: jsonb("attestations").$type<Record<string, boolean>>(),
    /** 45 CFR 164.524(c)(3)(ii) directive. Names a person — encrypted. */
    directive: jsonb("directive").$type<Record<string, string>>(),
  },
  (t) => ({
    tokenUx: uniqueIndex("health_summary_shares_token_hash_ux").on(t.tokenHash),
    profileIdx: index("health_summary_shares_profile_idx").on(t.profileId),
  }),
);

export const auditLogTable = pgTable("audit_log_new", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
  profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: uuid("target_id"),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  saidPatientId: text("said_patient_id"),
  appSource: text("app_source").default("tabula-medica"),
  blockchainAnchor: text("blockchain_anchor"),
  requestId: text("request_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  account: one(accounts, { fields: [profiles.accountId], references: [accounts.id] }),
  folders: many(folders),
  documents: many(documentsTable),
}));

// ============================================
// HEALTH GOALS & REMOTE MONITORING
// ============================================

export const healthGoalTypes = ["weight_loss", "weight_gain", "exercise_frequency", "blood_pressure", "blood_glucose", "heart_rate", "steps", "sleep_hours", "water_intake", "medication_adherence", "custom"] as const;
export type HealthGoalType = typeof healthGoalTypes[number];

export const healthGoalStatuses = ["active", "completed", "paused", "cancelled"] as const;
export type HealthGoalStatus = typeof healthGoalStatuses[number];

export const healthGoalsTable = pgTable("health_goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  goalType: text("goal_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  targetValue: text("target_value").notNull(),
  targetUnit: text("target_unit").notNull(),
  baselineValue: text("baseline_value"),
  currentValue: text("current_value"),
  startDate: date("start_date").notNull(),
  targetDate: date("target_date"),
  status: text("status").notNull().default("active"),
  priority: integer("priority").notNull().default(1),
  reminderFrequency: text("reminder_frequency"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const goalProgressTable = pgTable("goal_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  goalId: uuid("goal_id").notNull().references(() => healthGoalsTable.id, { onDelete: "cascade" }),
  recordedOn: date("recorded_on").notNull(),
  value: text("value").notNull(),
  notes: text("notes"),
  source: text("source").default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vitalSignTypes = ["blood_pressure_systolic", "blood_pressure_diastolic", "heart_rate", "blood_glucose", "weight", "temperature", "oxygen_saturation", "respiratory_rate"] as const;
export type VitalSignType = typeof vitalSignTypes[number];

export const vitalSignsTable = pgTable("vital_signs", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  vitalType: text("vital_type").notNull(),
  value: text("value").notNull(),
  unit: text("unit").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  source: text("source").default("manual"),
  deviceId: text("device_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const monitoringAlertSeverities = ["low", "medium", "high", "critical"] as const;
export type MonitoringAlertSeverity = typeof monitoringAlertSeverities[number];

export const monitoringAlertStatuses = ["pending", "acknowledged", "resolved", "dismissed"] as const;
export type MonitoringAlertStatus = typeof monitoringAlertStatuses[number];

export const monitoringAlertsTable = pgTable("monitoring_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  vitalSignId: uuid("vital_sign_id").references(() => vitalSignsTable.id, { onDelete: "set null" }),
  alertType: text("alert_type").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  threshold: text("threshold"),
  actualValue: text("actual_value"),
  status: text("status").notNull().default("pending"),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  acknowledgedBy: uuid("acknowledged_by"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ============================================
// SAID• PATIENTS TABLE (Shared Layer)
// ============================================

export const idDocTypes = [
  "PASSPORT", "DRIVERS_LICENSE", "STATE_ID", "CONSULAR_ID",
  "ITIN_CARD", "SCHOOL_ID", "MILITARY_ID", "VA_CARD",
] as const;
export type IdDocType = typeof idDocTypes[number];

export const patientsTable = pgTable("patients", {
  id: uuid("id").defaultRandom().primaryKey(),
  saidPatientId: text("said_patient_id").unique().notNull(),
  userId: uuid("user_id").references(() => accounts.id, { onDelete: "set null" }),
  nameFirstEnc: text("name_first_enc").notNull(),
  nameMiddleEnc: text("name_middle_enc").notNull(),
  nameLastEnc: text("name_last_enc").notNull(),
  hasNoMiddleName: boolean("has_no_middle_name").notNull().default(false),
  dobEnc: text("dob_enc"),
  idDocType: text("id_doc_type").notNull(),
  idDocHash: text("id_doc_hash").notNull(),
  residencyState: text("residency_state"),
  preferredLang: text("preferred_lang").default("en"),
  isVeteran: boolean("is_veteran").default(false),
  smsOptIn: boolean("sms_opt_in").default(false),
  smsOptInAt: timestamp("sms_opt_in_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSaidPatientSchema = createInsertSchema(patientsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSaidPatient = z.infer<typeof insertSaidPatientSchema>;
export type SaidPatient = typeof patientsTable.$inferSelect;

// ============================================
// FASTEN HEALTH CONNECTIONS
// ============================================

export const fastenConnectionsTable = pgTable("fasten_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  saidPatientId: text("said_patient_id").notNull(),
  sourceType: text("source_type").notNull(),
  sourceName: text("source_name").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  status: text("status").notNull().default("active"),
  recordsPulled: integer("records_pulled").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFastenConnectionSchema = createInsertSchema(fastenConnectionsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertFastenConnection = z.infer<typeof insertFastenConnectionSchema>;
export type FastenConnection = typeof fastenConnectionsTable.$inferSelect;

// ============================================
// ROLE-BASED ACCESS CONTROL (RBAC) SYSTEM
// ============================================

// User Roles
export const userRoles = ["patient", "caregiver", "admin", "support", "provider", "clinician"] as const;
export type UserRole = typeof userRoles[number];

// Permission Types
export const permissions = [
  // Health Records
  "records:read",
  "records:write",
  "records:delete",
  "records:export",
  
  // Medications
  "medications:read",
  "medications:write",
  
  // Conditions/Allergies
  "conditions:read",
  "conditions:write",
  
  // Documents
  "documents:read",
  "documents:download",
  "documents:share",
  
  // Appointments
  "appointments:read",
  "appointments:write",
  
  // EHR Connections
  "connections:read",
  "connections:write",
  "connections:delete",
  
  // Caregivers
  "caregivers:read",
  "caregivers:manage",
  
  // Security Settings
  "security:read",
  "security:write",
  "security:2fa",
  
  // Admin Functions
  "admin:users",
  "admin:audit",
  "admin:system",
  
  // Support Functions
  "support:view_patient",
  "support:assist",
  
  // Data Export Controls
  "export:full",           // Export complete records with all PHI
  "export:summary",        // Export summary/redacted records
  "export:bulk",           // Bulk export multiple patients (admin/research)
  "export:fhir",           // Export in FHIR format
  "export:pdf",            // Export as PDF documents
  "export:csv",            // Export as CSV/spreadsheet
  "export:manage_policies", // Manage export policies (admin only)
] as const;

export type Permission = typeof permissions[number];

// Permission Matrix - defines what each role can do
export const rolePermissions: Record<UserRole, Permission[]> = {
  patient: [
    "records:read",
    "records:export",
    "medications:read",
    "conditions:read",
    "documents:read",
    "documents:download",
    "documents:share",
    "appointments:read",
    "connections:read",
    "connections:write",
    "connections:delete",
    "caregivers:read",
    "caregivers:manage",
    "security:read",
    "security:write",
    "security:2fa",
    // Export permissions - patients can export their own data
    "export:full",
    "export:pdf",
    "export:fhir",
  ],
  caregiver: [
    "records:read",
    "medications:read",
    "conditions:read",
    "documents:read",
    "appointments:read",
    // Caregivers can only export summaries
    "export:summary",
    "export:pdf",
  ],
  admin: [
    "records:read",
    "records:write",
    "records:delete",
    "records:export",
    "medications:read",
    "medications:write",
    "conditions:read",
    "conditions:write",
    "documents:read",
    "documents:download",
    "documents:share",
    "appointments:read",
    "appointments:write",
    "connections:read",
    "connections:write",
    "connections:delete",
    "caregivers:read",
    "caregivers:manage",
    "security:read",
    "security:write",
    "security:2fa",
    "admin:users",
    "admin:audit",
    "admin:system",
    "support:view_patient",
    "support:assist",
    // Full export permissions for admin
    "export:full",
    "export:summary",
    "export:bulk",
    "export:fhir",
    "export:pdf",
    "export:csv",
    "export:manage_policies",
  ],
  support: [
    "support:view_patient",
    "support:assist",
    "admin:audit",
    // Support can export summaries only
    "export:summary",
    "export:pdf",
  ],
  provider: [
    "records:read",
    "records:write",
    "records:export",
    "medications:read",
    "medications:write",
    "conditions:read",
    "conditions:write",
    "documents:read",
    "documents:download",
    "documents:share",
    "appointments:read",
    "appointments:write",
    "connections:read",
    "caregivers:read",
    "security:read",
    "admin:audit",
    "support:view_patient",
    // Providers can export patient data in various formats
    "export:full",
    "export:summary",
    "export:fhir",
    "export:pdf",
    "export:csv",
  ],
  clinician: [
    "records:read",
    "records:write",
    "records:export",
    "medications:read",
    "medications:write",
    "conditions:read",
    "conditions:write",
    "documents:read",
    "documents:download",
    "documents:share",
    "appointments:read",
    "appointments:write",
    "connections:read",
    "caregivers:read",
    "security:read",
    "admin:audit",
    "support:view_patient",
    // Clinicians can export patient data in various formats
    "export:full",
    "export:summary",
    "export:fhir",
    "export:pdf",
    "export:csv",
  ],
};

// Helper function to check if a role has a permission
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

// Helper function to get all permissions for a role
export function getPermissionsForRole(role: UserRole): Permission[] {
  return rolePermissions[role];
}

// ============================================
// DATA EXPORT CONTROL SYSTEM
// ============================================

// Export formats
export const exportFormats = ["pdf", "fhir", "csv", "json", "ccd"] as const;
export type ExportFormat = typeof exportFormats[number];

// Export data types
export const exportDataTypes = [
  "demographics",
  "medications",
  "conditions",
  "allergies",
  "lab_results",
  "vital_signs",
  "immunizations",
  "procedures",
  "encounters",
  "documents",
  "notes",
  "care_plans",
  "all"
] as const;
export type ExportDataType = typeof exportDataTypes[number];

// Export request statuses
export const exportRequestStatuses = ["pending", "approved", "denied", "processing", "completed", "expired", "cancelled"] as const;
export type ExportRequestStatus = typeof exportRequestStatuses[number];

// Export policy - controls what can be exported
export interface ExportPolicy {
  id: string;
  name: string;
  description: string;
  allowedFormats: ExportFormat[];
  allowedDataTypes: ExportDataType[];
  allowedRoles: UserRole[];
  requiresApproval: boolean;
  approverRoles: UserRole[];
  maxRecordsPerExport: number;
  retentionDays: number; // How long exported files are kept
  requiresMfa: boolean;
  allowBulkExport: boolean;
  redactSensitive: boolean; // Auto-redact sensitive data (mental health, HIV, etc.)
  watermarkExports: boolean;
  auditRequired: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Export request - tracks individual export requests
export interface ExportRequest {
  id: string;
  requesterId: string;
  requesterRole: UserRole;
  patientId: string;
  policyId: string;
  format: ExportFormat;
  dataTypes: ExportDataType[];
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  purpose: string;
  status: ExportRequestStatus;
  approverId?: string;
  approvalDate?: Date;
  denialReason?: string;
  exportedAt?: Date;
  expiresAt?: Date;
  downloadCount: number;
  maxDownloads: number;
  fileSize?: number;
  checksum?: string;
  ipAddress: string;
  userAgent: string;
  metadata: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

// Export audit log entry
export interface ExportAuditEntry {
  id: string;
  exportRequestId: string;
  action: "requested" | "approved" | "denied" | "downloaded" | "expired" | "cancelled";
  performedBy: string;
  performedByRole: UserRole;
  ipAddress: string;
  userAgent: string;
  details: string;
  timestamp: Date;
}

// Default export policy for each role
export const defaultExportPolicies: Record<UserRole, Partial<ExportPolicy>> = {
  patient: {
    allowedFormats: ["pdf", "fhir", "json"],
    allowedDataTypes: ["all"],
    requiresApproval: false,
    maxRecordsPerExport: 1000,
    retentionDays: 30,
    requiresMfa: false,
    allowBulkExport: false,
    redactSensitive: false,
    watermarkExports: false,
  },
  caregiver: {
    allowedFormats: ["pdf"],
    allowedDataTypes: ["demographics", "medications", "conditions", "allergies", "vital_signs"],
    requiresApproval: true,
    approverRoles: ["patient", "admin"],
    maxRecordsPerExport: 100,
    retentionDays: 7,
    requiresMfa: true,
    allowBulkExport: false,
    redactSensitive: true,
    watermarkExports: true,
  },
  provider: {
    allowedFormats: ["pdf", "fhir", "csv", "ccd"],
    allowedDataTypes: ["all"],
    requiresApproval: false,
    maxRecordsPerExport: 5000,
    retentionDays: 14,
    requiresMfa: false,
    allowBulkExport: false,
    redactSensitive: false,
    watermarkExports: true,
  },
  support: {
    allowedFormats: ["pdf"],
    allowedDataTypes: ["demographics", "encounters"],
    requiresApproval: true,
    approverRoles: ["admin"],
    maxRecordsPerExport: 50,
    retentionDays: 1,
    requiresMfa: true,
    allowBulkExport: false,
    redactSensitive: true,
    watermarkExports: true,
  },
  admin: {
    allowedFormats: ["pdf", "fhir", "csv", "json", "ccd"],
    allowedDataTypes: ["all"],
    requiresApproval: false,
    maxRecordsPerExport: 10000,
    retentionDays: 90,
    requiresMfa: true,
    allowBulkExport: true,
    redactSensitive: false,
    watermarkExports: true,
  },
  clinician: {
    allowedFormats: ["pdf", "fhir", "csv", "ccd"],
    allowedDataTypes: ["all"],
    requiresApproval: false,
    maxRecordsPerExport: 5000,
    retentionDays: 14,
    requiresMfa: false,
    allowBulkExport: false,
    redactSensitive: false,
    watermarkExports: true,
  },
};

// ============================================
// CLINICIAN PATIENT RECOMMENDATIONS
// ============================================

// Recommendation priority levels
export const clinicianRecommendationPriorities = ["low", "medium", "high", "urgent"] as const;
export type ClinicianRecommendationPriority = typeof clinicianRecommendationPriorities[number];

// Recommendation categories
export const clinicianRecommendationCategories = [
  "medication",
  "lifestyle",
  "follow_up",
  "lab_test",
  "specialist_referral",
  "preventive_care",
  "diet_nutrition",
  "exercise",
  "mental_health",
  "education",
  "other"
] as const;
export type ClinicianRecommendationCategory = typeof clinicianRecommendationCategories[number];

// Recommendation statuses
export const clinicianRecommendationStatuses = ["pending", "viewed", "acknowledged", "completed", "dismissed"] as const;
export type ClinicianRecommendationStatus = typeof clinicianRecommendationStatuses[number];

// Clinician recommendation for patient
export interface ClinicianPatientRecommendation {
  id: string;
  clinicianId: string;
  clinicianName: string;
  clinicianSpecialty?: string;
  patientId: string;
  documentId?: string;
  title: string;
  description: string;
  category: ClinicianRecommendationCategory;
  priority: ClinicianRecommendationPriority;
  status: ClinicianRecommendationStatus;
  dueDate?: string;
  actionRequired?: string;
  relatedConditions?: string[];
  relatedMedications?: string[];
  patientAcknowledgedAt?: string;
  patientNotes?: string;
  isVisibleToPatient: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const insertClinicianPatientRecommendationSchema = z.object({
  patientId: z.string().min(1),
  documentId: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  category: z.enum(clinicianRecommendationCategories),
  priority: z.enum(clinicianRecommendationPriorities).default("medium"),
  dueDate: z.string().optional(),
  actionRequired: z.string().optional(),
  relatedConditions: z.array(z.string()).optional(),
  relatedMedications: z.array(z.string()).optional(),
  isVisibleToPatient: z.boolean().default(true),
});
export type InsertClinicianPatientRecommendation = z.infer<typeof insertClinicianPatientRecommendationSchema>;

export const updateClinicianRecommendationStatusSchema = z.object({
  status: z.enum(clinicianRecommendationStatuses),
  patientNotes: z.string().optional(),
});
export type UpdateClinicianRecommendationStatus = z.infer<typeof updateClinicianRecommendationStatusSchema>;

// ============================================
// DATA ACCESS POLICY SYSTEM (PHI/PII CONTROLS)
// ============================================

// Data classification tags for sensitive patient data
export const dataClassificationTags = [
  "PHI",           // Protected Health Information (HIPAA)
  "PII",           // Personally Identifiable Information
  "SENSITIVE",     // Highly sensitive (mental health, HIV, substance abuse)
  "RESTRICTED",    // Restricted access (court-ordered, legal holds)
  "FINANCIAL",     // Financial/billing data
  "GENETIC",       // Genetic information (GINA)
  "MINORS",        // Minor patient data (additional protections)
  "RESEARCH",      // Research participant data
  "EMERGENCY",     // Emergency contact information
  "STANDARD",      // Standard clinical data
] as const;
export type DataClassificationTag = typeof dataClassificationTags[number];

// Access context types for minimum necessary principle
export const accessContexts = [
  "treatment",        // Direct patient care
  "payment",          // Billing and payment operations
  "healthcare_ops",   // Healthcare operations
  "emergency",        // Emergency access (break-the-glass)
  "patient_request",  // Patient-initiated access
  "legal",            // Legal/compliance requirement
  "research",         // IRB-approved research
  "audit",            // Compliance auditing
  "public_health",    // Public health reporting
  "quality_review",   // Quality improvement
  "care_coordination", // Care team coordination
  "caregiver_access", // Authorized caregiver access
] as const;
export type AccessContext = typeof accessContexts[number];

// Policy effect - allow or deny
export const policyEffects = ["allow", "deny"] as const;
export type PolicyEffect = typeof policyEffects[number];

// Resource types that can be controlled
export const fhirResourceTypes = [
  "Patient",
  "Medication",
  "MedicationRequest",
  "Condition",
  "AllergyIntolerance",
  "Observation",
  "DiagnosticReport",
  "DocumentReference",
  "Encounter",
  "Procedure",
  "Immunization",
  "CarePlan",
  "CareTeam",
  "Practitioner",
  "Organization",
  "Coverage",
  "Claim",
  "ExplanationOfBenefit",
  "Consent",
  "Communication",
  "Appointment",
  "Task",
  "Goal",
  "All", // Wildcard for all resources
] as const;
export type FhirResourceType = typeof fhirResourceTypes[number];

// Access actions
export const accessActions = ["read", "write", "delete", "export", "share", "print"] as const;
export type AccessAction = typeof accessActions[number];

// Data Access Policy entity
export interface DataAccessPolicy {
  id: string;
  name: string;
  description: string;
  
  // Targeting - who does this policy apply to
  targetRoles: UserRole[];              // Roles this policy applies to
  targetUserIds?: string[];             // Specific user IDs (optional)
  excludeUserIds?: string[];            // Users excluded from this policy
  
  // Resources - what data is controlled
  resourceTypes: FhirResourceType[];    // FHIR resource types affected
  dataClassifications: DataClassificationTag[]; // Data classification tags
  
  // Actions - what operations are controlled
  actions: AccessAction[];              // Operations this policy controls
  
  // Conditions - when does this policy apply
  requiredContexts: AccessContext[];    // Access contexts that allow this
  minimumNecessary: boolean;            // Enforce minimum necessary principle
  requiresBreakTheGlass: boolean;       // Requires emergency access override
  requiresMfa: boolean;                 // Requires MFA for access
  requiresJustification: boolean;       // Requires documented reason
  
  // Time-based controls
  accessWindowStart?: string;           // Time window start (HH:MM)
  accessWindowEnd?: string;             // Time window end (HH:MM)
  maxAccessDurationMinutes?: number;    // Max session duration for access
  
  // Effect
  effect: PolicyEffect;                 // Allow or deny
  priority: number;                     // Higher priority policies evaluated first
  
  // Audit settings
  auditLevel: "all" | "violations_only" | "none";
  alertOnViolation: boolean;            // Send alert on policy violation
  
  // Status
  isActive: boolean;
  isSystemPolicy: boolean;              // System policies cannot be modified
  
  // Metadata
  createdBy: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt: string;
}

// Policy violation record
export interface PolicyViolation {
  id: string;
  policyId: string;
  policyName: string;
  userId: string;
  userRole: UserRole;
  patientId?: string;
  resourceType: FhirResourceType;
  resourceId?: string;
  action: AccessAction;
  context?: AccessContext;
  justification?: string;
  violationType: "denied" | "override" | "time_restricted" | "mfa_required" | "context_mismatch";
  violationDetails: string;
  ipAddress: string;
  userAgent: string;
  wasOverridden: boolean;
  overrideReason?: string;
  overrideApprovedBy?: string;
  timestamp: string;
}

// Access grant record (for approved access)
export interface AccessGrant {
  id: string;
  policyId: string;
  userId: string;
  patientId: string;
  resourceType: FhirResourceType;
  resourceId?: string;
  action: AccessAction;
  context: AccessContext;
  justification?: string;
  grantedAt: string;
  expiresAt?: string;
  grantedBy: string;
  isActive: boolean;
}

// Break-the-glass record for emergency access
export interface BreakTheGlassRecord {
  id: string;
  userId: string;
  userRole: UserRole;
  patientId: string;
  resourceTypes: FhirResourceType[];
  reason: string;
  activatedAt: string;
  expiresAt: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  reviewStatus: "pending" | "approved" | "flagged" | "investigated";
  reviewedBy?: string;
  reviewNotes?: string;
}

// Zod schemas for data access policy
export const dataAccessPolicySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  targetRoles: z.array(z.enum(userRoles)),
  targetUserIds: z.array(z.string()).optional(),
  excludeUserIds: z.array(z.string()).optional(),
  resourceTypes: z.array(z.enum(fhirResourceTypes)),
  dataClassifications: z.array(z.enum(dataClassificationTags)),
  actions: z.array(z.enum(accessActions)),
  requiredContexts: z.array(z.enum(accessContexts)),
  minimumNecessary: z.boolean(),
  requiresBreakTheGlass: z.boolean(),
  requiresMfa: z.boolean(),
  requiresJustification: z.boolean(),
  accessWindowStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  accessWindowEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  maxAccessDurationMinutes: z.number().min(1).max(480).optional(),
  effect: z.enum(policyEffects),
  priority: z.number().min(0).max(1000),
  auditLevel: z.enum(["all", "violations_only", "none"]),
  alertOnViolation: z.boolean(),
  isActive: z.boolean(),
  isSystemPolicy: z.boolean().default(false),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedBy: z.string().optional(),
  updatedAt: z.string(),
});

export const insertDataAccessPolicySchema = dataAccessPolicySchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertDataAccessPolicy = z.infer<typeof insertDataAccessPolicySchema>;

export const policyViolationSchema = z.object({
  id: z.string(),
  policyId: z.string(),
  policyName: z.string(),
  userId: z.string(),
  userRole: z.enum(userRoles),
  patientId: z.string().optional(),
  resourceType: z.enum(fhirResourceTypes),
  resourceId: z.string().optional(),
  action: z.enum(accessActions),
  context: z.enum(accessContexts).optional(),
  justification: z.string().optional(),
  violationType: z.enum(["denied", "override", "time_restricted", "mfa_required", "context_mismatch"]),
  violationDetails: z.string(),
  ipAddress: z.string(),
  userAgent: z.string(),
  wasOverridden: z.boolean(),
  overrideReason: z.string().optional(),
  overrideApprovedBy: z.string().optional(),
  timestamp: z.string(),
});

export const insertPolicyViolationSchema = policyViolationSchema.omit({ id: true, timestamp: true });
export type InsertPolicyViolation = z.infer<typeof insertPolicyViolationSchema>;

export const breakTheGlassSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userRole: z.enum(userRoles),
  patientId: z.string(),
  resourceTypes: z.array(z.enum(fhirResourceTypes)),
  reason: z.string().min(10).max(500),
  activatedAt: z.string(),
  expiresAt: z.string(),
  deactivatedAt: z.string().optional(),
  deactivatedBy: z.string().optional(),
  reviewStatus: z.enum(["pending", "approved", "flagged", "investigated"]),
  reviewedBy: z.string().optional(),
  reviewNotes: z.string().optional(),
});

export const insertBreakTheGlassSchema = breakTheGlassSchema.omit({ 
  id: true, 
  activatedAt: true 
});
export type InsertBreakTheGlass = z.infer<typeof insertBreakTheGlassSchema>;

// Default system policies for HIPAA compliance
export const defaultDataAccessPolicies: Omit<DataAccessPolicy, "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "PHI Read Access - Treatment",
    description: "Allows PHI access for direct patient care",
    targetRoles: ["provider", "admin"],
    resourceTypes: ["All"],
    dataClassifications: ["PHI", "STANDARD"],
    actions: ["read"],
    requiredContexts: ["treatment", "emergency", "care_coordination"],
    minimumNecessary: true,
    requiresBreakTheGlass: false,
    requiresMfa: false,
    requiresJustification: false,
    effect: "allow",
    priority: 100,
    auditLevel: "all",
    alertOnViolation: false,
    isActive: true,
    isSystemPolicy: true,
    createdBy: "system",
  },
  {
    name: "Sensitive Data Access - Restricted",
    description: "Restricts access to sensitive data (mental health, HIV, substance abuse)",
    targetRoles: ["patient", "caregiver", "provider", "admin", "support"],
    resourceTypes: ["Condition", "Observation", "DiagnosticReport", "DocumentReference"],
    dataClassifications: ["SENSITIVE"],
    actions: ["read", "write", "export", "share"],
    requiredContexts: ["treatment", "patient_request"],
    minimumNecessary: true,
    requiresBreakTheGlass: true,
    requiresMfa: true,
    requiresJustification: true,
    effect: "deny",
    priority: 200,
    auditLevel: "all",
    alertOnViolation: true,
    isActive: true,
    isSystemPolicy: true,
    createdBy: "system",
  },
  {
    name: "Patient Self-Access",
    description: "Allows patients full access to their own records",
    targetRoles: ["patient"],
    resourceTypes: ["All"],
    dataClassifications: ["PHI", "PII", "STANDARD", "FINANCIAL"],
    actions: ["read", "export"],
    requiredContexts: ["patient_request"],
    minimumNecessary: false,
    requiresBreakTheGlass: false,
    requiresMfa: false,
    requiresJustification: false,
    effect: "allow",
    priority: 50,
    auditLevel: "all",
    alertOnViolation: false,
    isActive: true,
    isSystemPolicy: true,
    createdBy: "system",
  },
  {
    name: "Caregiver Limited Access",
    description: "Limits caregiver access to authorized data only",
    targetRoles: ["caregiver"],
    resourceTypes: ["Patient", "Medication", "Condition", "AllergyIntolerance", "Appointment"],
    dataClassifications: ["PHI", "STANDARD"],
    actions: ["read"],
    requiredContexts: ["caregiver_access", "care_coordination"],
    minimumNecessary: true,
    requiresBreakTheGlass: false,
    requiresMfa: false,
    requiresJustification: false,
    effect: "allow",
    priority: 75,
    auditLevel: "all",
    alertOnViolation: false,
    isActive: true,
    isSystemPolicy: true,
    createdBy: "system",
  },
  {
    name: "Genetic Data Protection",
    description: "Restricts access to genetic information per GINA",
    targetRoles: ["patient", "caregiver", "provider", "admin", "support"],
    resourceTypes: ["Observation", "DiagnosticReport", "DocumentReference"],
    dataClassifications: ["GENETIC"],
    actions: ["read", "write", "export", "share", "print"],
    requiredContexts: ["treatment", "research", "patient_request"],
    minimumNecessary: true,
    requiresBreakTheGlass: false,
    requiresMfa: true,
    requiresJustification: true,
    effect: "deny",
    priority: 250,
    auditLevel: "all",
    alertOnViolation: true,
    isActive: true,
    isSystemPolicy: true,
    createdBy: "system",
  },
  {
    name: "Minor Patient Protection",
    description: "Additional protections for minor patient data",
    targetRoles: ["caregiver", "provider", "support"],
    resourceTypes: ["All"],
    dataClassifications: ["MINORS"],
    actions: ["read", "write", "export", "share"],
    requiredContexts: ["treatment", "caregiver_access", "legal"],
    minimumNecessary: true,
    requiresBreakTheGlass: false,
    requiresMfa: false,
    requiresJustification: true,
    effect: "allow",
    priority: 150,
    auditLevel: "all",
    alertOnViolation: false,
    isActive: true,
    isSystemPolicy: true,
    createdBy: "system",
  },
];

// Zod schemas for export control
export const exportPolicySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  allowedFormats: z.array(z.enum(exportFormats)),
  allowedDataTypes: z.array(z.enum(exportDataTypes)),
  allowedRoles: z.array(z.enum(userRoles)),
  requiresApproval: z.boolean(),
  approverRoles: z.array(z.enum(userRoles)).optional(),
  maxRecordsPerExport: z.number().min(1).max(100000),
  retentionDays: z.number().min(1).max(365),
  requiresMfa: z.boolean(),
  allowBulkExport: z.boolean(),
  redactSensitive: z.boolean(),
  watermarkExports: z.boolean(),
  auditRequired: z.boolean(),
  isActive: z.boolean(),
});

export const insertExportPolicySchema = exportPolicySchema.omit({ id: true });
export type InsertExportPolicy = z.infer<typeof insertExportPolicySchema>;

export const exportRequestSchema = z.object({
  id: z.string(),
  requesterId: z.string(),
  requesterRole: z.enum(userRoles),
  patientId: z.string(),
  policyId: z.string(),
  format: z.enum(exportFormats),
  dataTypes: z.array(z.enum(exportDataTypes)),
  dateRangeStart: z.date().optional(),
  dateRangeEnd: z.date().optional(),
  purpose: z.string().min(10).max(500),
  status: z.enum(exportRequestStatuses),
  approverId: z.string().optional(),
  denialReason: z.string().optional(),
  downloadCount: z.number(),
  maxDownloads: z.number(),
  ipAddress: z.string(),
  userAgent: z.string(),
  metadata: z.record(z.string()),
});

export const insertExportRequestSchema = z.object({
  patientId: z.string(),
  format: z.enum(exportFormats),
  dataTypes: z.array(z.enum(exportDataTypes)),
  dateRangeStart: z.string().optional(),
  dateRangeEnd: z.string().optional(),
  purpose: z.string().min(10).max(500),
});
export type InsertExportRequest = z.infer<typeof insertExportRequestSchema>;

// EHR Platform types — Fasten Health aggregator plus direct EHR connections
export const ehrPlatforms = ["fastenhealth", "epic", "ecw", "athena", "meditech"] as const;
export type EhrPlatform = typeof ehrPlatforms[number];

export const ehrPlatformInfo: Record<EhrPlatform, { name: string; color: string; description: string }> = {
  fastenhealth: { name: "Fasten Health", color: "#4A90D9", description: "Connect to 25,000+ US healthcare providers via Fasten Health for unified FHIR data" },
  epic: { name: "Epic MyChart", color: "#E31937", description: "Direct SMART on FHIR connection to Epic EHR systems (MyChart)" },
  ecw: { name: "eClinicalWorks", color: "#00A4E4", description: "Direct SMART on FHIR connection to eClinicalWorks EHR" },
  athena: { name: "athenahealth", color: "#7B2D8E", description: "Direct SMART on FHIR connection to athenahealth EHR" },
  meditech: { name: "MEDITECH", color: "#005A9C", description: "Direct SMART on FHIR connection to MEDITECH Expanse EHR" },
};

// Wearable Device platforms
export const wearablePlatforms = ["fitbit", "apple_health", "garmin", "withings", "oura", "whoop", "samsung_health", "google_fit"] as const;
export type WearablePlatform = typeof wearablePlatforms[number];

export const wearablePlatformInfo: Record<WearablePlatform, { name: string; color: string; description: string; icon: string; dataTypes: string[] }> = {
  fitbit: { 
    name: "Fitbit", 
    color: "#00B0B9", 
    description: "Sync fitness and health data from Fitbit devices",
    icon: "F",
    dataTypes: ["steps", "heart_rate", "sleep", "activity", "weight"]
  },
  apple_health: { 
    name: "Apple Health", 
    color: "#FF2D55", 
    description: "Import health data from Apple Health on iPhone",
    icon: "A",
    dataTypes: ["steps", "heart_rate", "sleep", "activity", "nutrition", "vitals"]
  },
  garmin: { 
    name: "Garmin Connect", 
    color: "#000000", 
    description: "Sync workout and health data from Garmin devices",
    icon: "G",
    dataTypes: ["steps", "heart_rate", "sleep", "activity", "stress", "spo2"]
  },
  withings: { 
    name: "Withings Health Mate", 
    color: "#00B9E4", 
    description: "Sync data from Withings smart scales and devices",
    icon: "W",
    dataTypes: ["weight", "blood_pressure", "sleep", "activity"]
  },
  oura: { 
    name: "Oura Ring", 
    color: "#1A1A2E", 
    description: "Import sleep and readiness data from Oura Ring",
    icon: "O",
    dataTypes: ["sleep", "heart_rate", "activity", "readiness", "temperature"]
  },
  whoop: { 
    name: "WHOOP", 
    color: "#00D46A", 
    description: "Sync recovery and strain data from WHOOP",
    icon: "W",
    dataTypes: ["heart_rate", "sleep", "strain", "recovery", "hrv"]
  },
  samsung_health: { 
    name: "Samsung Health", 
    color: "#1428A0", 
    description: "Import health data from Samsung Health",
    icon: "S",
    dataTypes: ["steps", "heart_rate", "sleep", "activity", "stress"]
  },
  google_fit: { 
    name: "Google Fit", 
    color: "#4285F4", 
    description: "Sync fitness data from Google Fit",
    icon: "G",
    dataTypes: ["steps", "heart_rate", "activity", "nutrition", "weight"]
  },
};

// Wearable data types
export const wearableDataTypes = ["steps", "heart_rate", "sleep", "activity", "weight", "blood_pressure", "spo2", "stress", "hrv", "temperature", "nutrition", "readiness", "strain", "recovery", "vitals"] as const;
export type WearableDataType = typeof wearableDataTypes[number];

// Wearable Device Connection
export interface WearableConnection {
  id: string;
  userId: string;
  platform: WearablePlatform;
  deviceName?: string;
  status: "connected" | "disconnected" | "syncing" | "pending_auth" | "error" | "expired";
  lastSync: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  enabledDataTypes: WearableDataType[];
  syncFrequency: "realtime" | "hourly" | "daily" | "manual";
  createdAt: string;
}

export const insertWearableConnectionSchema = z.object({
  userId: z.string(),
  platform: z.enum(wearablePlatforms),
  deviceName: z.string().optional(),
  status: z.enum(["connected", "disconnected", "syncing", "pending_auth", "error", "expired"]).default("pending_auth"),
  enabledDataTypes: z.array(z.enum(wearableDataTypes)).default([]),
  syncFrequency: z.enum(["realtime", "hourly", "daily", "manual"]).default("daily"),
});

export type InsertWearableConnection = z.infer<typeof insertWearableConnectionSchema>;

// Wearable Data Record (synced from devices)
export interface WearableDataRecord {
  id: string;
  userId: string;
  wearableConnectionId: string;
  dataType: WearableDataType;
  value: number;
  unit: string;
  metadata?: Record<string, unknown>;
  recordedAt: string;
  syncedAt: string;
}

export const insertWearableDataRecordSchema = z.object({
  userId: z.string(),
  wearableConnectionId: z.string(),
  dataType: z.enum(wearableDataTypes),
  value: z.number(),
  unit: z.string(),
  metadata: z.record(z.unknown()).optional(),
  recordedAt: z.string(),
});

export type InsertWearableDataRecord = z.infer<typeof insertWearableDataRecordSchema>;

// External Data Source (unified type for all external sources)
export type ExternalDataSourceType = "ehr" | "wearable" | "lab" | "pharmacy" | "imaging";

export interface ExternalDataSource {
  id: string;
  type: ExternalDataSourceType;
  platform: string;
  name: string;
  status: "connected" | "disconnected" | "syncing" | "pending_auth" | "error" | "expired";
  lastSync: string;
  recordCount: number;
  color: string;
}

// FHIR Configuration for EHR platforms (SMART on FHIR endpoints)
export interface FhirConfig {
  fhirBaseUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  issuer: string;
  scopes: string[];
  clientId?: string;
  usePkce: boolean;
}

// OAuth Token storage
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt: string;
  scopes: string[];
  idToken?: string;
}

// SMART on FHIR launch context
export interface SmartLaunchContext {
  patientId?: string;
  encounterId?: string;
  userId?: string;
  needPatientBanner?: boolean;
}

// EHR Connection with FHIR/OAuth support
// Sync schedule configuration for EHR connections
export type SyncScheduleInterval = "15min" | "30min" | "1hour" | "4hours" | "12hours" | "24hours" | "manual";

export interface SyncSettings {
  autoSyncEnabled: boolean;
  syncInterval: SyncScheduleInterval;
  lastScheduledSync?: string;
  nextScheduledSync?: string;
  retryCount?: number;
  maxRetries?: number;
}

export const defaultSyncSettings: SyncSettings = {
  autoSyncEnabled: true,
  syncInterval: "4hours",
  retryCount: 0,
  maxRetries: 3,
};

export interface EhrConnection {
  id: string;
  userId: string;
  platform: EhrPlatform;
  facilityName: string;
  status: "connected" | "disconnected" | "syncing" | "pending_auth" | "error" | "expired";
  lastSync: string;
  patientCount: number;
  fhirConfig?: FhirConfig;
  tokens?: OAuthTokens;
  smartContext?: SmartLaunchContext;
  syncError?: string;
  syncSettings?: SyncSettings;
  lastSyncResult?: {
    success: boolean;
    recordsAdded: number;
    errors: string[];
    partialSync: boolean;
    duration: number;
  };
  createdAt: string;
}

// Pending OAuth state for PKCE flow
export interface OAuthPendingState {
  id: string;
  userId: string;
  ehrConnectionId: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: string;
  expiresAt: string;
}

export const insertEhrConnectionSchema = z.object({
  userId: z.string(),
  platform: z.enum(ehrPlatforms),
  facilityName: z.string().min(1),
  status: z.enum(["connected", "disconnected", "syncing", "pending_auth", "error", "expired"]).default("pending_auth"),
  fhirConfig: z.object({
    fhirBaseUrl: z.string().url(),
    authorizationEndpoint: z.string().url(),
    tokenEndpoint: z.string().url(),
    issuer: z.string(),
    scopes: z.array(z.string()),
    clientId: z.string().optional(),
    usePkce: z.boolean(),
  }).optional(),
});

export type InsertEhrConnection = z.infer<typeof insertEhrConnectionSchema>;

// Unified Patient (Master Patient Index - MPI)
// Links the same person across different EHR platforms
export interface UnifiedPatient {
  id: string;
  firstName: string;
  middleName: string; // Required for FHIR matching accuracy - use "NMN" (No Middle Name) or "UNK" (Unknown) if not known
  lastName: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other";
  email: string;
  phone: string;
  address: string;
  primaryInsurance?: string;
  primaryPhysician?: string;
  ehrSources: EhrPatientSource[];
  matchConfidence: "high" | "medium" | "low";
  createdAt: string;
}

// Tracks which EHR platforms have data for this unified patient
export interface EhrPatientSource {
  ehrConnectionId: string;
  platform: EhrPlatform;
  facilityName: string;
  mrn: string;
  patientId: string;
  lastSync: string;
}

// Patient record from a specific EHR
export interface Patient {
  id: string;
  unifiedPatientId: string; // Links to UnifiedPatient for cross-platform matching
  ehrConnectionId: string;
  mrn: string;
  firstName: string;
  middleName: string; // Required for FHIR matching accuracy - use "NMN" (No Middle Name) or "UNK" (Unknown) if not known
  lastName: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other";
  email: string;
  phone: string;
  address: string;
  insuranceProvider: string;
  insuranceId: string;
  primaryPhysician: string;
  avatarUrl?: string;
}

export const insertPatientSchema = z.object({
  unifiedPatientId: z.string().optional(),
  ehrConnectionId: z.string(),
  mrn: z.string().min(1),
  firstName: z.string().min(1),
  middleName: z.string().min(1, "Middle name is required. Use 'NMN' (No Middle Name) or 'UNK' (Unknown) if not known."),
  lastName: z.string().min(1),
  dateOfBirth: z.string(),
  gender: z.enum(["male", "female", "other"]),
  email: z.string().email(),
  phone: z.string(),
  address: z.string(),
  insuranceProvider: z.string(),
  insuranceId: z.string(),
  primaryPhysician: z.string(),
  avatarUrl: z.string().optional(),
});

export type InsertPatient = z.infer<typeof insertPatientSchema>;

// Medical Record
export interface MedicalRecord {
  id: string;
  patientId: string;
  ehrConnectionId: string;
  type: "diagnosis" | "procedure" | "lab_result" | "imaging" | "note";
  title: string;
  description: string;
  date: string;
  provider: string;
  facility: string;
  status: "active" | "resolved" | "pending";
}

export const insertMedicalRecordSchema = z.object({
  patientId: z.string(),
  ehrConnectionId: z.string(),
  type: z.enum(["diagnosis", "procedure", "lab_result", "imaging", "note"]),
  title: z.string().min(1),
  description: z.string(),
  date: z.string(),
  provider: z.string(),
  facility: z.string(),
  status: z.enum(["active", "resolved", "pending"]).default("active"),
});

export type InsertMedicalRecord = z.infer<typeof insertMedicalRecordSchema>;

// Medication
export interface Medication {
  id: string;
  patientId: string;
  ehrConnectionId: string;
  name: string;
  dosage: string;
  frequency: string;
  prescribedBy: string;
  startDate: string;
  endDate?: string;
  status: "active" | "discontinued" | "on_hold";
  refillsRemaining: number;
  patientReported?: "taking" | "not_taking" | "unknown";
}

export const insertMedicationSchema = z.object({
  patientId: z.string(),
  ehrConnectionId: z.string(),
  name: z.string().min(1),
  dosage: z.string(),
  frequency: z.string(),
  prescribedBy: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  status: z.enum(["active", "discontinued", "on_hold"]).default("active"),
  refillsRemaining: z.number().default(0),
  patientReported: z.enum(["taking", "not_taking", "unknown"]).optional(),
});

export type InsertMedication = z.infer<typeof insertMedicationSchema>;

// ============================================
// PRESCRIPTION MANAGEMENT
// ============================================

// Prescription Status
export const prescriptionStatuses = [
  "pending",      // Awaiting provider approval
  "active",       // Currently active prescription
  "filled",       // Filled at pharmacy
  "expired",      // Prescription has expired
  "cancelled",    // Cancelled by provider
  "on_hold",      // Temporarily on hold
] as const;
export type PrescriptionStatus = typeof prescriptionStatuses[number];

// Refill Request Status
export const refillRequestStatuses = [
  "pending",      // Awaiting review
  "approved",     // Approved by provider
  "denied",       // Denied by provider
  "processing",   // Being processed by pharmacy
  "ready",        // Ready for pickup/delivery
  "completed",    // Picked up/delivered
  "cancelled",    // Cancelled by patient
] as const;
export type RefillRequestStatus = typeof refillRequestStatuses[number];

// Pharmacy Network Status
export const pharmacyNetworkStatuses = [
  "active",       // Active in the network
  "inactive",     // Temporarily inactive
  "suspended",    // Suspended from network
  "pending",      // Pending verification
] as const;
export type PharmacyNetworkStatus = typeof pharmacyNetworkStatuses[number];

// Pharmacy Interface
export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  fax?: string;
  email?: string;
  isPreferred: boolean;
  supportsElectronicPrescribing: boolean;
  hours?: string;
  // Extended fields for admin management
  npiNumber?: string;           // National Provider Identifier
  licenseNumber?: string;       // State pharmacy license
  chainAffiliation?: string;    // CVS, Walgreens, Independent, etc.
  networkStatus: PharmacyNetworkStatus;
  apiKeyConfigured: boolean;    // Whether API integration is set up (don't expose actual key)
  apiKeyLastUpdated?: string;   // When API key was last updated
  contactPerson?: string;       // Primary contact at pharmacy
  contactPhone?: string;        // Contact person's direct phone
  deliveryAvailable: boolean;   // Offers home delivery
  is24Hour: boolean;            // Open 24 hours
  acceptsMedicare: boolean;     // Accepts Medicare
  acceptsMedicaid: boolean;     // Accepts Medicaid
  specialties?: string[];       // Compounding, specialty, etc.
  notes?: string;               // Admin notes
  createdAt: string;
  updatedAt: string;
}

export const insertPharmacySchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zipCode: z.string().min(5),
  phone: z.string().min(10),
  fax: z.string().optional(),
  email: z.string().email().optional(),
  isPreferred: z.boolean().default(false),
  supportsElectronicPrescribing: z.boolean().default(true),
  hours: z.string().optional(),
  npiNumber: z.string().optional(),
  licenseNumber: z.string().optional(),
  chainAffiliation: z.string().optional(),
  networkStatus: z.enum(pharmacyNetworkStatuses).default("pending"),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  deliveryAvailable: z.boolean().default(false),
  is24Hour: z.boolean().default(false),
  acceptsMedicare: z.boolean().default(true),
  acceptsMedicaid: z.boolean().default(true),
  specialties: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export type InsertPharmacy = z.infer<typeof insertPharmacySchema>;

// Schema for updating pharmacy API key (admin only)
export const updatePharmacyApiKeySchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
});

export type UpdatePharmacyApiKey = z.infer<typeof updatePharmacyApiKeySchema>;

// Prescription - Electronic prescribing by providers
export interface Prescription {
  id: string;
  patientId: string;
  providerId: string;
  providerName: string;
  pharmacyId?: string;
  pharmacyName?: string;
  medicationName: string;
  genericName?: string;
  strength: string;
  dosageForm: string; // tablet, capsule, liquid, injection, etc.
  quantity: number;
  daysSupply: number;
  directions: string; // Sig: Take 1 tablet by mouth twice daily
  refillsAuthorized: number;
  refillsRemaining: number;
  dispenseAsWritten: boolean; // DAW - no generic substitution
  status: PrescriptionStatus;
  prescribedDate: string;
  expirationDate: string;
  lastFilledDate?: string;
  diagnosis?: string;
  icdCode?: string;
  notes?: string;
  isControlledSubstance: boolean;
  deaSchedule?: string; // II, III, IV, V for controlled substances
  createdAt: string;
  updatedAt: string;
}

export const insertPrescriptionSchema = z.object({
  patientId: z.string().min(1),
  providerId: z.string().min(1),
  providerName: z.string().min(1),
  pharmacyId: z.string().optional(),
  pharmacyName: z.string().optional(),
  medicationName: z.string().min(1),
  genericName: z.string().optional(),
  strength: z.string().min(1),
  dosageForm: z.string().min(1),
  quantity: z.number().min(1),
  daysSupply: z.number().min(1),
  directions: z.string().min(1),
  refillsAuthorized: z.number().min(0).max(12).default(0),
  dispenseAsWritten: z.boolean().default(false),
  diagnosis: z.string().optional(),
  icdCode: z.string().optional(),
  notes: z.string().optional(),
  isControlledSubstance: z.boolean().default(false),
  deaSchedule: z.string().optional(),
});

export type InsertPrescription = z.infer<typeof insertPrescriptionSchema>;

// Refill Request - Patient requests for prescription refills
export interface RefillRequest {
  id: string;
  prescriptionId: string;
  patientId: string;
  pharmacyId?: string;
  status: RefillRequestStatus;
  requestedDate: string;
  processedDate?: string;
  processedBy?: string;
  denialReason?: string;
  patientNotes?: string;
  providerNotes?: string;
  urgency: "routine" | "urgent" | "emergency";
  preferredPickupDate?: string;
  deliveryRequested: boolean;
  deliveryAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export const insertRefillRequestSchema = z.object({
  prescriptionId: z.string().min(1),
  patientId: z.string().min(1),
  pharmacyId: z.string().optional(),
  patientNotes: z.string().optional(),
  urgency: z.enum(["routine", "urgent", "emergency"]).default("routine"),
  preferredPickupDate: z.string().optional(),
  deliveryRequested: z.boolean().default(false),
  deliveryAddress: z.string().optional(),
});

export type InsertRefillRequest = z.infer<typeof insertRefillRequestSchema>;

// Patient Pharmacy Preference - Links patients to their pharmacies
export interface PatientPharmacy {
  id: string;
  patientId: string;
  pharmacyId: string;
  isPrimary: boolean;
  addedAt: string;
}

export const insertPatientPharmacySchema = z.object({
  patientId: z.string().min(1),
  pharmacyId: z.string().min(1),
  isPrimary: z.boolean().default(false),
});

export type InsertPatientPharmacy = z.infer<typeof insertPatientPharmacySchema>;

// Prescription Fill History - Track pharmacy fill events
export interface PrescriptionFillHistory {
  id: string;
  prescriptionId: string;
  pharmacyId: string;
  pharmacyName: string;
  fillDate: string;
  quantityDispensed: number;
  daysSupply: number;
  pharmacistName?: string;
  copayAmount?: number;
  insurancePaid?: number;
  notes?: string;
}

export const insertPrescriptionFillHistorySchema = z.object({
  prescriptionId: z.string().min(1),
  pharmacyId: z.string().min(1),
  pharmacyName: z.string().min(1),
  fillDate: z.string(),
  quantityDispensed: z.number().min(1),
  daysSupply: z.number().min(1),
  pharmacistName: z.string().optional(),
  copayAmount: z.number().optional(),
  insurancePaid: z.number().optional(),
  notes: z.string().optional(),
});

export type InsertPrescriptionFillHistory = z.infer<typeof insertPrescriptionFillHistorySchema>;

// Prescription Transfer Request - Patient requests to move prescription between pharmacies
export type TransferRequestStatus = "pending" | "submitted" | "in_progress" | "completed" | "rejected" | "cancelled";

export interface PrescriptionTransferRequest {
  id: string;
  prescriptionId: string;
  patientId: string;
  fromPharmacyId: string;
  toPharmacyId: string;
  status: TransferRequestStatus;
  requestedAt: string;
  submittedAt?: string;
  completedAt?: string;
  patientNotes?: string;
  pharmacyNotes?: string;
  rejectionReason?: string;
  estimatedCompletionDate?: string;
  trackingNumber?: string;
}

export const insertPrescriptionTransferRequestSchema = z.object({
  prescriptionId: z.string().min(1),
  patientId: z.string().min(1),
  fromPharmacyId: z.string().min(1),
  toPharmacyId: z.string().min(1),
  patientNotes: z.string().optional(),
});

export type InsertPrescriptionTransferRequest = z.infer<typeof insertPrescriptionTransferRequestSchema>;

// Refill Status Notification - Track automated patient notifications
export type NotificationChannel = "email" | "sms" | "push" | "in_app";
export type RefillNotificationType = "status_update" | "ready_pickup" | "out_of_stock" | "refill_reminder" | "transfer_update";

export interface RefillStatusNotification {
  id: string;
  patientId: string;
  prescriptionId?: string;
  refillRequestId?: string;
  transferRequestId?: string;
  type: RefillNotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  sentAt: string;
  readAt?: string;
  actionUrl?: string;
}

export const insertRefillStatusNotificationSchema = z.object({
  patientId: z.string().min(1),
  prescriptionId: z.string().optional(),
  refillRequestId: z.string().optional(),
  transferRequestId: z.string().optional(),
  type: z.enum(["status_update", "ready_pickup", "out_of_stock", "refill_reminder", "transfer_update"]),
  channel: z.enum(["email", "sms", "push", "in_app"]),
  title: z.string().min(1),
  message: z.string().min(1),
  actionUrl: z.string().optional(),
});

export type InsertRefillStatusNotification = z.infer<typeof insertRefillStatusNotificationSchema>;

// Patient Notification Preferences
export interface PatientNotificationPreferences {
  id: string;
  patientId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  refillReminders: boolean;
  statusUpdates: boolean;
  transferUpdates: boolean;
  reminderDaysBefore: number;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  preferredLanguage: string;
}

export const insertPatientNotificationPreferencesSchema = z.object({
  patientId: z.string().min(1),
  emailEnabled: z.boolean().default(true),
  smsEnabled: z.boolean().default(false),
  pushEnabled: z.boolean().default(true),
  refillReminders: z.boolean().default(true),
  statusUpdates: z.boolean().default(true),
  transferUpdates: z.boolean().default(true),
  reminderDaysBefore: z.number().min(1).max(14).default(3),
  quietHoursStart: z.string().optional(),
  quietHoursEnd: z.string().optional(),
  preferredLanguage: z.string().default("en"),
});

export type InsertPatientNotificationPreferences = z.infer<typeof insertPatientNotificationPreferencesSchema>;

// Drug Interaction Check Result - AI-powered safety analysis before prescribing
export type InteractionSeverity = "minor" | "moderate" | "major" | "contraindicated";

export interface DrugInteractionCheckResult {
  id: string;
  patientId: string;
  prescriptionId?: string;
  checkedAt: string;
  proposedMedication: string;
  proposedDosage: string;
  existingMedications: string[];
  interactions: DrugInteractionDetail[];
  overallRiskLevel: InteractionSeverity | "safe";
  aiRecommendation: string;
  providerAcknowledged: boolean;
  providerAcknowledgedAt?: string;
  providerNotes?: string;
}

export interface DrugInteractionDetail {
  medication1: string;
  medication2: string;
  severity: InteractionSeverity;
  description: string;
  clinicalEffects: string;
  recommendation: string;
  evidenceLevel?: string;
}

export const insertDrugInteractionCheckSchema = z.object({
  patientId: z.string().min(1),
  prescriptionId: z.string().optional(),
  proposedMedication: z.string().min(1),
  proposedDosage: z.string().min(1),
  existingMedications: z.array(z.string()),
});

export type InsertDrugInteractionCheck = z.infer<typeof insertDrugInteractionCheckSchema>;

// Vital Signs
export interface VitalSign {
  id: string;
  patientId: string;
  ehrConnectionId: string;
  type: "blood_pressure" | "heart_rate" | "temperature" | "weight" | "oxygen_saturation" | "respiratory_rate";
  value: string;
  unit: string;
  recordedAt: string;
  recordedBy: string;
}

export const insertVitalSignSchema = z.object({
  patientId: z.string(),
  ehrConnectionId: z.string(),
  type: z.enum(["blood_pressure", "heart_rate", "temperature", "weight", "oxygen_saturation", "respiratory_rate"]),
  value: z.string(),
  unit: z.string(),
  recordedAt: z.string(),
  recordedBy: z.string(),
});

export type InsertVitalSign = z.infer<typeof insertVitalSignSchema>;

// Lab Result
export interface LabResult {
  id: string;
  patientId: string;
  ehrConnectionId: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange?: string;
  status: "normal" | "abnormal" | "critical";
  date: string;
  orderedBy?: string;
  facility?: string;
  notes?: string;
}

export const insertLabResultSchema = z.object({
  patientId: z.string(),
  ehrConnectionId: z.string(),
  testName: z.string().min(1),
  value: z.string(),
  unit: z.string(),
  referenceRange: z.string().optional(),
  status: z.enum(["normal", "abnormal", "critical"]).default("normal"),
  date: z.string(),
  orderedBy: z.string().optional(),
  facility: z.string().optional(),
  notes: z.string().optional(),
});

export type InsertLabResult = z.infer<typeof insertLabResultSchema>;

// ============================================
// DATA DEDUPLICATION & NORMALIZATION
// ============================================

// Record types that can be deduplicated
export const dedupRecordTypes = ["medication", "lab_result", "document", "condition", "allergy"] as const;
export type DedupRecordType = typeof dedupRecordTypes[number];

// Conflict types that can be detected
export const dedupConflictTypes = [
  "dose_mismatch",       // Same med, different dosages
  "frequency_mismatch",  // Same med, different frequencies
  "value_mismatch",      // Same lab, different values
  "status_mismatch",     // Different statuses (active vs discontinued)
  "date_mismatch",       // Significant date differences
  "provider_mismatch",   // Different prescribing providers
] as const;
export type DedupConflictType = typeof dedupConflictTypes[number];

// Conflict severity levels
export const conflictSeverities = ["low", "medium", "high", "critical"] as const;
export type ConflictSeverity = typeof conflictSeverities[number];

// Status of dedup groups
export const dedupGroupStatuses = ["active", "resolved", "dismissed"] as const;
export type DedupGroupStatus = typeof dedupGroupStatuses[number];

// Provenance link - tracks which original record contributes to a dedup group
export interface ProvenanceLink {
  id: string;
  dedupGroupId: string;
  originalRecordId: string;
  recordType: DedupRecordType;
  sourceConnectionId: string;
  sourcePlatform: string;
  sourceFacility: string;
  importedAt: string;
  rawData: Record<string, unknown>; // Original FHIR/source data preserved
  confidence: number; // 0-1 confidence this belongs in the group
  isPrimary: boolean; // If true, this is the canonical record
}

export const insertProvenanceLinkSchema = z.object({
  dedupGroupId: z.string(),
  originalRecordId: z.string(),
  recordType: z.enum(dedupRecordTypes),
  sourceConnectionId: z.string(),
  sourcePlatform: z.string(),
  sourceFacility: z.string(),
  importedAt: z.string(),
  rawData: z.record(z.unknown()),
  confidence: z.number().min(0).max(1).default(1),
  isPrimary: z.boolean().default(false),
});
export type InsertProvenanceLink = z.infer<typeof insertProvenanceLinkSchema>;

// Dedup Group - represents a merged/canonical record
export interface DedupGroup {
  id: string;
  userId: string;
  recordType: DedupRecordType;
  status: DedupGroupStatus;
  
  // Canonical/merged data (normalized)
  canonicalName: string; // Normalized name (e.g., "Lisinopril 10mg")
  canonicalCode?: string; // RxNorm, LOINC, SNOMED code if available
  canonicalData: Record<string, unknown>; // Merged/normalized record data
  
  // Matching metadata
  matchingAlgorithm: string; // Which algorithm matched these
  matchScore: number; // 0-1 overall match confidence
  sourceCount: number; // Number of sources contributing
  
  // Conflict tracking
  hasConflicts: boolean;
  conflictCount: number;
  
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export const insertDedupGroupSchema = z.object({
  userId: z.string(),
  recordType: z.enum(dedupRecordTypes),
  status: z.enum(dedupGroupStatuses).default("active"),
  canonicalName: z.string(),
  canonicalCode: z.string().optional(),
  canonicalData: z.record(z.unknown()),
  matchingAlgorithm: z.string(),
  matchScore: z.number().min(0).max(1),
  sourceCount: z.number().min(1),
  hasConflicts: z.boolean().default(false),
  conflictCount: z.number().default(0),
});
export type InsertDedupGroup = z.infer<typeof insertDedupGroupSchema>;

// Dedup Conflict - detected discrepancy between source records
export interface DedupConflict {
  id: string;
  dedupGroupId: string;
  userId: string;
  conflictType: DedupConflictType;
  severity: ConflictSeverity;
  
  // Fields in conflict
  fieldName: string;
  
  // Values from different sources
  values: Array<{
    sourceConnectionId: string;
    sourcePlatform: string;
    value: string;
    recordId: string;
    recordDate?: string;
  }>;
  
  // Resolution
  status: "pending" | "resolved" | "dismissed";
  resolvedValue?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  
  createdAt: string;
}

export const insertDedupConflictSchema = z.object({
  dedupGroupId: z.string(),
  userId: z.string(),
  conflictType: z.enum(dedupConflictTypes),
  severity: z.enum(conflictSeverities),
  fieldName: z.string(),
  values: z.array(z.object({
    sourceConnectionId: z.string(),
    sourcePlatform: z.string(),
    value: z.string(),
    recordId: z.string(),
    recordDate: z.string().optional(),
  })),
  status: z.enum(["pending", "resolved", "dismissed"]).default("pending"),
});
export type InsertDedupConflict = z.infer<typeof insertDedupConflictSchema>;

// Dedup analytics event types
export const dedupAnalyticsEventTypes = [
  "dedup_group_created",
  "dedup_conflict_detected", 
  "dedup_user_viewed_provenance",
  "dedup_conflict_resolved",
  "dedup_group_dismissed",
] as const;
export type DedupAnalyticsEventType = typeof dedupAnalyticsEventTypes[number];

export interface DedupAnalyticsEvent {
  id: string;
  userId: string;
  eventType: DedupAnalyticsEventType;
  dedupGroupId?: string;
  conflictId?: string;
  recordType?: DedupRecordType;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export const insertDedupAnalyticsEventSchema = z.object({
  userId: z.string(),
  eventType: z.enum(dedupAnalyticsEventTypes),
  dedupGroupId: z.string().optional(),
  conflictId: z.string().optional(),
  recordType: z.enum(dedupRecordTypes).optional(),
  metadata: z.record(z.unknown()).default({}),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});
export type InsertDedupAnalyticsEvent = z.infer<typeof insertDedupAnalyticsEventSchema>;

// ============================================
// DATA QUALITY DASHBOARD
// ============================================

export const dataQualityIssueSeverities = ["critical", "high", "medium", "low"] as const;
export type DataQualityIssueSeverity = typeof dataQualityIssueSeverities[number];

export const dataQualityIssueTypes = [
  "duplicate_record",
  "missing_required_field",
  "invalid_code_system",
  "inconsistent_data",
  "stale_record",
  "normalization_error",
  "source_conflict",
] as const;
export type DataQualityIssueType = typeof dataQualityIssueTypes[number];

export const dataQualityIssueStatuses = ["open", "in_review", "resolved", "dismissed"] as const;
export type DataQualityIssueStatus = typeof dataQualityIssueStatuses[number];

export const dataQualityActionTypes = [
  "merge_records",
  "confirm_duplicate",
  "dismiss_duplicate",
  "update_record",
  "resolve_conflict",
  "mark_reviewed",
] as const;
export type DataQualityActionType = typeof dataQualityActionTypes[number];

export interface DataQualityIssue {
  id: string;
  patientId: string;
  issueType: DataQualityIssueType;
  severity: DataQualityIssueSeverity;
  status: DataQualityIssueStatus;
  recordType: DedupRecordType;
  affectedRecordIds: string[];
  description: string;
  details: Record<string, unknown>;
  suggestedAction?: string;
  assignedTo?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export const insertDataQualityIssueSchema = z.object({
  patientId: z.string(),
  issueType: z.enum(dataQualityIssueTypes),
  severity: z.enum(dataQualityIssueSeverities),
  status: z.enum(dataQualityIssueStatuses).default("open"),
  recordType: z.enum(dedupRecordTypes),
  affectedRecordIds: z.array(z.string()),
  description: z.string(),
  details: z.record(z.unknown()).default({}),
  suggestedAction: z.string().optional(),
  assignedTo: z.string().optional(),
});
export type InsertDataQualityIssue = z.infer<typeof insertDataQualityIssueSchema>;

export interface DataQualityAction {
  id: string;
  issueId: string;
  userId: string;
  actionType: DataQualityActionType;
  sourceRecordIds: string[];
  targetRecordId?: string;
  previousValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  notes?: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export const insertDataQualityActionSchema = z.object({
  issueId: z.string(),
  userId: z.string(),
  actionType: z.enum(dataQualityActionTypes),
  sourceRecordIds: z.array(z.string()),
  targetRecordId: z.string().optional(),
  previousValues: z.record(z.unknown()).optional(),
  newValues: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
  ipAddress: z.string(),
  userAgent: z.string(),
});
export type InsertDataQualityAction = z.infer<typeof insertDataQualityActionSchema>;

export interface CareTeamDataQualityMetrics {
  totalIssues: number;
  issuesBySeverity: Record<DataQualityIssueSeverity, number>;
  issuesByType: Record<DataQualityIssueType, number>;
  issuesByStatus: Record<DataQualityIssueStatus, number>;
  issuesByRecordType: Record<DedupRecordType, number>;
  duplicateGroups: number;
  pendingMerges: number;
  resolvedThisWeek: number;
  resolutionRate: number;
  averageResolutionTimeHours: number;
}

export interface CareTeamDataQualityDashboard {
  metrics: CareTeamDataQualityMetrics;
  recentIssues: DataQualityIssue[];
  topPatientsByIssues: Array<{ patientId: string; patientName: string; issueCount: number }>;
  issuesTrend: Array<{ date: string; open: number; resolved: number }>;
  recentActions: DataQualityAction[];
}

// ============================================
// IMMUNIZATION RECORDS
// ============================================

export const immunizationStatuses = ["completed", "entered-in-error", "not-done"] as const;
export type ImmunizationStatus = typeof immunizationStatuses[number];

export const vaccineSites = ["left_arm", "right_arm", "left_thigh", "right_thigh", "oral", "nasal", "other"] as const;
export type VaccineSite = typeof vaccineSites[number];

export interface Immunization {
  id: string;
  patientId: string;
  ehrConnectionId?: string;
  vaccineName: string;
  vaccineCode?: string; // CVX code
  manufacturer?: string;
  lotNumber?: string;
  expirationDate?: string;
  doseNumber?: number;
  doseQuantity?: number;
  doseUnit?: string;
  site?: VaccineSite;
  route?: string;
  administeredDate: string;
  administeredBy?: string;
  facility?: string;
  status: ImmunizationStatus;
  reaction?: string;
  reactionDate?: string;
  reactionSeverity?: "mild" | "moderate" | "severe";
  notes?: string;
  nextDoseDate?: string;
  seriesComplete?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const insertImmunizationSchema = z.object({
  patientId: z.string().min(1),
  ehrConnectionId: z.string().optional(),
  vaccineName: z.string().min(1, "Vaccine name is required"),
  vaccineCode: z.string().optional(),
  manufacturer: z.string().optional(),
  lotNumber: z.string().optional(),
  expirationDate: z.string().optional(),
  doseNumber: z.number().min(1).optional(),
  doseQuantity: z.number().optional(),
  doseUnit: z.string().optional(),
  site: z.enum(vaccineSites).optional(),
  route: z.string().optional(),
  administeredDate: z.string().min(1, "Administration date is required"),
  administeredBy: z.string().optional(),
  facility: z.string().optional(),
  status: z.enum(immunizationStatuses).default("completed"),
  reaction: z.string().optional(),
  reactionDate: z.string().optional(),
  reactionSeverity: z.enum(["mild", "moderate", "severe"]).optional(),
  notes: z.string().optional(),
  nextDoseDate: z.string().optional(),
  seriesComplete: z.boolean().optional(),
});

export type InsertImmunization = z.infer<typeof insertImmunizationSchema>;

// ============================================
// ADVANCED HEALTH METRICS TRACKING
// ============================================

export const advancedMetricTypes = [
  "hba1c",
  "blood_pressure_systolic",
  "blood_pressure_diastolic",
  "fasting_glucose",
  "cholesterol_total",
  "cholesterol_ldl",
  "cholesterol_hdl",
  "triglycerides",
  "bmi",
  "waist_circumference",
  "egfr",
  "creatinine",
  "urine_albumin",
  "blood_oxygen_average",
  "resting_heart_rate",
  "peak_flow",
  "inr"
] as const;
export type AdvancedMetricType = typeof advancedMetricTypes[number];

export interface AdvancedHealthMetric {
  id: string;
  patientId: string;
  metricType: AdvancedMetricType;
  value: number;
  unit: string;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
  targetValue?: number;
  status: "normal" | "borderline" | "abnormal" | "critical";
  trend?: "improving" | "stable" | "worsening";
  recordedAt: string;
  source: "lab" | "device" | "self_reported" | "ehr_import";
  sourceDetail?: string;
  notes?: string;
  relatedCondition?: string;
  createdAt: string;
}

export const insertAdvancedHealthMetricSchema = z.object({
  patientId: z.string().min(1),
  metricType: z.enum(advancedMetricTypes),
  value: z.number(),
  unit: z.string().min(1),
  referenceRangeLow: z.number().optional(),
  referenceRangeHigh: z.number().optional(),
  targetValue: z.number().optional(),
  status: z.enum(["normal", "borderline", "abnormal", "critical"]).default("normal"),
  trend: z.enum(["improving", "stable", "worsening"]).optional(),
  recordedAt: z.string().min(1),
  source: z.enum(["lab", "device", "self_reported", "ehr_import"]).default("self_reported"),
  sourceDetail: z.string().optional(),
  notes: z.string().optional(),
  relatedCondition: z.string().optional(),
});

export type InsertAdvancedHealthMetric = z.infer<typeof insertAdvancedHealthMetricSchema>;

// Health metric reference ranges by condition
export const metricReferenceRanges: Record<AdvancedMetricType, { low: number; high: number; unit: string; description: string }> = {
  hba1c: { low: 4.0, high: 5.6, unit: "%", description: "Hemoglobin A1c (glycated hemoglobin)" },
  blood_pressure_systolic: { low: 90, high: 120, unit: "mmHg", description: "Systolic blood pressure" },
  blood_pressure_diastolic: { low: 60, high: 80, unit: "mmHg", description: "Diastolic blood pressure" },
  fasting_glucose: { low: 70, high: 100, unit: "mg/dL", description: "Fasting blood glucose" },
  cholesterol_total: { low: 0, high: 200, unit: "mg/dL", description: "Total cholesterol" },
  cholesterol_ldl: { low: 0, high: 100, unit: "mg/dL", description: "LDL (bad) cholesterol" },
  cholesterol_hdl: { low: 40, high: 60, unit: "mg/dL", description: "HDL (good) cholesterol" },
  triglycerides: { low: 0, high: 150, unit: "mg/dL", description: "Triglycerides" },
  bmi: { low: 18.5, high: 24.9, unit: "kg/m²", description: "Body Mass Index" },
  waist_circumference: { low: 0, high: 102, unit: "cm", description: "Waist circumference (men)" },
  egfr: { low: 90, high: 120, unit: "mL/min/1.73m²", description: "Estimated glomerular filtration rate" },
  creatinine: { low: 0.7, high: 1.3, unit: "mg/dL", description: "Serum creatinine" },
  urine_albumin: { low: 0, high: 30, unit: "mg/g", description: "Urine albumin-to-creatinine ratio" },
  blood_oxygen_average: { low: 95, high: 100, unit: "%", description: "Blood oxygen saturation" },
  resting_heart_rate: { low: 60, high: 100, unit: "bpm", description: "Resting heart rate" },
  peak_flow: { low: 400, high: 700, unit: "L/min", description: "Peak expiratory flow rate" },
  inr: { low: 2.0, high: 3.0, unit: "", description: "International normalized ratio (anticoagulation)" },
};

// ============================================
// CONDITION-SPECIFIC PROM TEMPLATES
// ============================================

export interface ConditionSpecificPROM {
  id: string;
  patientId: string;
  conditionType: "diabetes" | "hypertension" | "copd" | "heart_failure" | "arthritis" | "depression" | "chronic_pain";
  templateName: string;
  responses: {
    questionId: string;
    questionText: string;
    answer: string | number;
    score?: number;
  }[];
  totalScore: number;
  maxScore: number;
  interpretation: string;
  riskLevel: "low" | "moderate" | "high";
  completedAt: string;
  nextDueDate?: string;
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export const insertConditionSpecificPROMSchema = z.object({
  patientId: z.string().min(1),
  conditionType: z.enum(["diabetes", "hypertension", "copd", "heart_failure", "arthritis", "depression", "chronic_pain"]),
  templateName: z.string().min(1),
  responses: z.array(z.object({
    questionId: z.string(),
    questionText: z.string(),
    answer: z.union([z.string(), z.number()]),
    score: z.number().optional(),
  })),
  totalScore: z.number(),
  maxScore: z.number(),
  interpretation: z.string(),
  riskLevel: z.enum(["low", "moderate", "high"]),
  completedAt: z.string(),
  nextDueDate: z.string().optional(),
  notes: z.string().optional(),
});

export type InsertConditionSpecificPROM = z.infer<typeof insertConditionSpecificPROMSchema>;

// ============================================
// AI DOCUMENT INSIGHTS
// ============================================

export interface DocumentKeyFinding {
  id: string;
  category: "abnormal_result" | "normal_result" | "diagnosis" | "medication" | "procedure" | "follow_up" | "observation";
  severity: "critical" | "warning" | "info" | "success";
  title: string;
  description: string;
  value?: string;
  referenceRange?: string;
  clinicalSignificance?: string;
}

export interface DocumentTrendAnalysis {
  metric: string;
  direction: "improving" | "stable" | "worsening" | "new";
  description: string;
  previousValue?: string;
  currentValue?: string;
}

export interface DocumentActionItem {
  id: string;
  priority: "urgent" | "high" | "normal" | "low";
  action: string;
  reason: string;
  timeframe?: string;
  relatedFinding?: string;
}

export interface DocumentInsight {
  id: string;
  documentId: string;
  patientId: string;
  summary: string;
  keyFindings: DocumentKeyFinding[];
  trends: DocumentTrendAnalysis[];
  actionItems: DocumentActionItem[];
  plainLanguageExplanation: string;
  medicalTermsGlossary: Array<{
    term: string;
    definition: string;
  }>;
  generatedAt: string;
  confidenceScore: number;
  createdAt: string;
}

export const insertDocumentInsightSchema = z.object({
  documentId: z.string().min(1),
  patientId: z.string().min(1),
  summary: z.string(),
  keyFindings: z.array(z.object({
    id: z.string(),
    category: z.enum(["abnormal_result", "normal_result", "diagnosis", "medication", "procedure", "follow_up", "observation"]),
    severity: z.enum(["critical", "warning", "info", "success"]),
    title: z.string(),
    description: z.string(),
    value: z.string().optional(),
    referenceRange: z.string().optional(),
    clinicalSignificance: z.string().optional(),
  })),
  trends: z.array(z.object({
    metric: z.string(),
    direction: z.enum(["improving", "stable", "worsening", "new"]),
    description: z.string(),
    previousValue: z.string().optional(),
    currentValue: z.string().optional(),
  })),
  actionItems: z.array(z.object({
    id: z.string(),
    priority: z.enum(["urgent", "high", "normal", "low"]),
    action: z.string(),
    reason: z.string(),
    timeframe: z.string().optional(),
    relatedFinding: z.string().optional(),
  })),
  plainLanguageExplanation: z.string(),
  medicalTermsGlossary: z.array(z.object({
    term: z.string(),
    definition: z.string(),
  })),
  generatedAt: z.string(),
  confidenceScore: z.number().min(0).max(1),
});

export type InsertDocumentInsight = z.infer<typeof insertDocumentInsightSchema>;

// Diabetes-specific PROM template
export const diabetesPROMTemplate = {
  name: "Diabetes Self-Management Assessment",
  conditionType: "diabetes" as const,
  questions: [
    { id: "d1", text: "How often did you check your blood sugar in the past week?", type: "scale", min: 0, max: 7, labels: { 0: "Never", 7: "Every day" } },
    { id: "d2", text: "How often did you take your diabetes medication as prescribed?", type: "scale", min: 0, max: 7, labels: { 0: "Never", 7: "Every day" } },
    { id: "d3", text: "How often did you follow a healthy eating plan?", type: "scale", min: 0, max: 7, labels: { 0: "Never", 7: "Every day" } },
    { id: "d4", text: "How often did you engage in at least 30 minutes of physical activity?", type: "scale", min: 0, max: 7, labels: { 0: "Never", 7: "Every day" } },
    { id: "d5", text: "How often did you check your feet for cuts, blisters, or sores?", type: "scale", min: 0, max: 7, labels: { 0: "Never", 7: "Every day" } },
    { id: "d6", text: "Have you experienced episodes of low blood sugar (hypoglycemia)?", type: "choice", options: ["None", "1-2 times", "3-5 times", "More than 5 times"] },
    { id: "d7", text: "Rate your overall diabetes management confidence", type: "scale", min: 1, max: 10, labels: { 1: "Not confident", 10: "Very confident" } },
  ],
};

// Hypertension-specific PROM template
export const hypertensionPROMTemplate = {
  name: "Hypertension Self-Care Assessment",
  conditionType: "hypertension" as const,
  questions: [
    { id: "h1", text: "How often did you take your blood pressure medication as prescribed?", type: "scale", min: 0, max: 7, labels: { 0: "Never", 7: "Every day" } },
    { id: "h2", text: "How often did you check your blood pressure at home?", type: "scale", min: 0, max: 7, labels: { 0: "Never", 7: "Every day" } },
    { id: "h3", text: "How often did you limit salt/sodium in your diet?", type: "scale", min: 0, max: 7, labels: { 0: "Never", 7: "Every day" } },
    { id: "h4", text: "How often did you exercise for at least 30 minutes?", type: "scale", min: 0, max: 7, labels: { 0: "Never", 7: "Every day" } },
    { id: "h5", text: "How often did you limit alcohol consumption?", type: "scale", min: 0, max: 7, labels: { 0: "Never", 7: "Every day" } },
    { id: "h6", text: "Have you experienced symptoms like headaches, dizziness, or chest pain?", type: "choice", options: ["None", "Occasionally", "Frequently", "Very frequently"] },
    { id: "h7", text: "How would you rate your stress levels this week?", type: "scale", min: 1, max: 10, labels: { 1: "Very low", 10: "Very high" } },
  ],
};

// Allergy
export type AllergySeverity = "mild" | "moderate" | "severe" | "life_threatening";
export type AllergyType = "drug" | "food" | "environmental" | "other";
export type AllergyStatus = "active" | "inactive" | "resolved";

export interface Allergy {
  id: string;
  patientId: string;
  ehrConnectionId: string;
  name: string;
  type: AllergyType;
  severity: AllergySeverity;
  reaction: string;
  onsetDate?: string;
  status: AllergyStatus;
  verifiedBy?: string;
  verifiedDate?: string;
  notes?: string;
}

export const insertAllergySchema = z.object({
  patientId: z.string(),
  ehrConnectionId: z.string(),
  name: z.string().min(1),
  type: z.enum(["drug", "food", "environmental", "other"]),
  severity: z.enum(["mild", "moderate", "severe", "life_threatening"]),
  reaction: z.string(),
  onsetDate: z.string().optional(),
  status: z.enum(["active", "inactive", "resolved"]).default("active"),
  verifiedBy: z.string().optional(),
  verifiedDate: z.string().optional(),
  notes: z.string().optional(),
});

export type InsertAllergy = z.infer<typeof insertAllergySchema>;

// Extended Allergy with emergency information
export interface AllergyEmergencyInfo {
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  epinephrineAvailable: boolean;
  epinephrineLocation?: string;
  crossReactivityNotes?: string;
  lastReactionDate?: string;
  actionPlan?: string;
}

export interface ExtendedAllergy extends Allergy {
  emergencyInfo?: AllergyEmergencyInfo;
}

export const insertAllergyEmergencyInfoSchema = z.object({
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  epinephrineAvailable: z.boolean().default(false),
  epinephrineLocation: z.string().optional(),
  crossReactivityNotes: z.string().optional(),
  lastReactionDate: z.string().optional(),
  actionPlan: z.string().optional(),
});

export type InsertAllergyEmergencyInfo = z.infer<typeof insertAllergyEmergencyInfoSchema>;

// Family Medical History
export const familyRelationships = [
  "mother", "father", "sister", "brother", 
  "maternal_grandmother", "maternal_grandfather",
  "paternal_grandmother", "paternal_grandfather",
  "aunt", "uncle", "cousin", "child", "other"
] as const;
export type FamilyRelationship = typeof familyRelationships[number];

export interface FamilyMedicalHistory {
  id: string;
  patientId: string;
  relationship: FamilyRelationship;
  relativeName?: string;
  conditionName: string;
  icdCode?: string;
  ageOfOnset?: number;
  ageAtDeath?: number;
  isDeceased: boolean;
  causeOfDeath?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export const insertFamilyMedicalHistorySchema = z.object({
  patientId: z.string().min(1),
  relationship: z.enum(familyRelationships),
  relativeName: z.string().optional(),
  conditionName: z.string().min(1, "Condition name is required"),
  icdCode: z.string().optional(),
  ageOfOnset: z.number().min(0).max(120).optional(),
  ageAtDeath: z.number().min(0).max(120).optional(),
  isDeceased: z.boolean().default(false),
  causeOfDeath: z.string().optional(),
  notes: z.string().optional(),
});

export type InsertFamilyMedicalHistory = z.infer<typeof insertFamilyMedicalHistorySchema>;

// Lifestyle Profile
export const dietTypes = ["omnivore", "vegetarian", "vegan", "pescatarian", "keto", "paleo", "mediterranean", "low_carb", "other"] as const;
export type DietType = typeof dietTypes[number];

export const exerciseFrequencies = ["none", "rarely", "1-2_weekly", "3-4_weekly", "5+_weekly", "daily"] as const;
export type ExerciseFrequency = typeof exerciseFrequencies[number];

export const sleepQualities = ["poor", "fair", "good", "excellent"] as const;
export type SleepQuality = typeof sleepQualities[number];

export const stressLevels = ["low", "moderate", "high", "severe"] as const;
export type StressLevel = typeof stressLevels[number];

export const exerciseTypes = ["walking", "running", "cycling", "swimming", "weight_training", "yoga", "pilates", "sports", "hiking", "dancing", "other"] as const;
export type ExerciseType = typeof exerciseTypes[number];

export interface LifestyleProfile {
  id: string;
  patientId: string;
  // Diet
  dietType: DietType;
  dietaryRestrictions?: string[];
  dietNotes?: string;
  // Exercise
  exerciseFrequency: ExerciseFrequency;
  exerciseTypes: ExerciseType[];
  exerciseMinutesPerSession?: number;
  exerciseNotes?: string;
  // Sleep
  averageSleepHours: number;
  sleepQuality: SleepQuality;
  sleepIssues?: string[];
  sleepNotes?: string;
  // Stress
  stressLevel: StressLevel;
  stressSources?: string[];
  stressManagement?: string[];
  stressNotes?: string;
  // Habits
  smokingStatus: "never" | "former" | "current";
  alcoholConsumption: "none" | "occasional" | "moderate" | "heavy";
  caffeineIntake: "none" | "low" | "moderate" | "high";
  // Timestamps
  createdAt: string;
  updatedAt?: string;
}

export const insertLifestyleProfileSchema = z.object({
  patientId: z.string().min(1),
  dietType: z.enum(dietTypes).default("omnivore"),
  dietaryRestrictions: z.array(z.string()).optional(),
  dietNotes: z.string().optional(),
  exerciseFrequency: z.enum(exerciseFrequencies).default("rarely"),
  exerciseTypes: z.array(z.enum(exerciseTypes)).default([]),
  exerciseMinutesPerSession: z.number().min(0).max(300).optional(),
  exerciseNotes: z.string().optional(),
  averageSleepHours: z.number().min(0).max(24).default(7),
  sleepQuality: z.enum(sleepQualities).default("fair"),
  sleepIssues: z.array(z.string()).optional(),
  sleepNotes: z.string().optional(),
  stressLevel: z.enum(stressLevels).default("moderate"),
  stressSources: z.array(z.string()).optional(),
  stressManagement: z.array(z.string()).optional(),
  stressNotes: z.string().optional(),
  smokingStatus: z.enum(["never", "former", "current"]).default("never"),
  alcoholConsumption: z.enum(["none", "occasional", "moderate", "heavy"]).default("occasional"),
  caffeineIntake: z.enum(["none", "low", "moderate", "high"]).default("moderate"),
});

export type InsertLifestyleProfile = z.infer<typeof insertLifestyleProfileSchema>;

// Problem/Condition (for problem list view)
export type ProblemStatus = "active" | "resolved" | "inactive" | "recurrence";

export interface Problem {
  id: string;
  patientId: string;
  ehrConnectionId: string;
  name: string;
  icdCode?: string;
  category: "chronic" | "acute" | "preventive" | "social" | "other";
  status: ProblemStatus;
  onsetDate?: string;
  resolvedDate?: string;
  severity?: "mild" | "moderate" | "severe";
  diagnosedBy?: string;
  facility: string;
  notes?: string;
}

export const insertProblemSchema = z.object({
  patientId: z.string(),
  ehrConnectionId: z.string(),
  name: z.string().min(1),
  icdCode: z.string().optional(),
  category: z.enum(["chronic", "acute", "preventive", "social", "other"]),
  status: z.enum(["active", "resolved", "inactive", "recurrence"]).default("active"),
  onsetDate: z.string().optional(),
  resolvedDate: z.string().optional(),
  severity: z.enum(["mild", "moderate", "severe"]).optional(),
  diagnosedBy: z.string().optional(),
  facility: z.string(),
  notes: z.string().optional(),
});

export type InsertProblem = z.infer<typeof insertProblemSchema>;

// Appointment
export interface Appointment {
  id: string;
  patientId: string;
  ehrConnectionId: string;
  type: "checkup" | "followup" | "specialist" | "procedure" | "lab";
  title: string;
  provider: string;
  facility: string;
  scheduledAt: string;
  duration: number;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes?: string;
}

export const insertAppointmentSchema = z.object({
  patientId: z.string(),
  ehrConnectionId: z.string(),
  type: z.enum(["checkup", "followup", "specialist", "procedure", "lab"]),
  title: z.string().min(1),
  provider: z.string(),
  facility: z.string(),
  scheduledAt: z.string(),
  duration: z.number(),
  status: z.enum(["scheduled", "completed", "cancelled", "no_show"]).default("scheduled"),
  notes: z.string().optional(),
});

export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

// Health Goal - for tracking patient health objectives
export type HealthGoalStatus = "active" | "in_progress" | "completed" | "abandoned";
export type HealthGoalCategory = "weight" | "exercise" | "nutrition" | "medication" | "mental_health" | "sleep" | "other";

export interface HealthGoal {
  id: string;
  patientId: string;
  title: string;
  description?: string;
  category: HealthGoalCategory;
  targetValue?: string;
  currentValue?: string;
  unit?: string;
  startDate: string;
  targetDate?: string;
  status: HealthGoalStatus;
  progress: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const insertHealthGoalSchema = z.object({
  patientId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(["weight", "exercise", "nutrition", "medication", "mental_health", "sleep", "other"]),
  targetValue: z.string().optional(),
  currentValue: z.string().optional(),
  unit: z.string().optional(),
  startDate: z.string(),
  targetDate: z.string().optional(),
  status: z.enum(["active", "in_progress", "completed", "abandoned"]).default("active"),
  progress: z.number().min(0).max(100).default(0),
  notes: z.string().optional(),
});

export type InsertHealthGoal = z.infer<typeof insertHealthGoalSchema>;

// ============================================
// CARE PLAN MANAGEMENT SYSTEM
// ============================================

export type CarePlanStatus = "draft" | "active" | "on_hold" | "completed" | "cancelled";
export type CarePlanCategory = "chronic_disease" | "post_surgical" | "preventive" | "mental_health" | "rehabilitation" | "palliative" | "wellness" | "other";
export type GoalPriority = "high" | "medium" | "low";
export type GoalStatus = "not_started" | "in_progress" | "achieved" | "not_achieved" | "cancelled";
export type InterventionStatus = "scheduled" | "in_progress" | "completed" | "cancelled" | "overdue";
export type CareTeamRole = "primary_physician" | "specialist" | "nurse" | "care_coordinator" | "pharmacist" | "therapist" | "social_worker" | "caregiver" | "other";

export interface CarePlanGoal {
  id: string;
  description: string;
  targetDate?: string;
  priority: GoalPriority;
  status: GoalStatus;
  progress: number;
  metrics?: {
    name: string;
    target: string;
    current: string;
    unit: string;
  }[];
  notes?: string;
}

export interface CarePlanIntervention {
  id: string;
  goalId: string;
  description: string;
  frequency: string;
  assignedTo?: string;
  startDate: string;
  endDate?: string;
  status: InterventionStatus;
  lastPerformed?: string;
  notes?: string;
}

export interface CareTeamMember {
  id: string;
  name: string;
  role: CareTeamRole;
  specialty?: string;
  phone?: string;
  email?: string;
  organization?: string;
  isPrimary: boolean;
  userId?: string;
  avatar?: string;
  lastActive?: string;
  status?: "available" | "busy" | "offline";
}

// Care Team Task - task assignment between team members
export type CareTeamTaskPriority = "urgent" | "high" | "normal" | "low";
export type CareTeamTaskStatus = "pending" | "in_progress" | "completed" | "cancelled" | "overdue";

export interface CareTeamTask {
  id: string;
  carePlanId: string;
  patientId: string;
  title: string;
  description: string;
  priority: CareTeamTaskPriority;
  status: CareTeamTaskStatus;
  assignedTo: string;
  assignedBy: string;
  dueDate: string;
  completedAt?: string;
  completedBy?: string;
  category: "assessment" | "medication" | "follow_up" | "documentation" | "coordination" | "patient_education" | "other";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const insertCareTeamTaskSchema = z.object({
  carePlanId: z.string(),
  patientId: z.string(),
  title: z.string().min(1),
  description: z.string(),
  priority: z.enum(["urgent", "high", "normal", "low"]).default("normal"),
  status: z.enum(["pending", "in_progress", "completed", "cancelled", "overdue"]).default("pending"),
  assignedTo: z.string(),
  assignedBy: z.string(),
  dueDate: z.string(),
  category: z.enum(["assessment", "medication", "follow_up", "documentation", "coordination", "patient_education", "other"]).default("other"),
  notes: z.string().optional(),
});

export type InsertCareTeamTask = z.infer<typeof insertCareTeamTaskSchema>;

// Care Handoff - care transition between team members
export type HandoffUrgency = "routine" | "urgent" | "stat";
export type HandoffStatus = "pending" | "acknowledged" | "accepted" | "completed" | "declined";

export interface CareHandoff {
  id: string;
  carePlanId: string;
  patientId: string;
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  urgency: HandoffUrgency;
  status: HandoffStatus;
  reason: string;
  summary: string;
  pendingTasks: string[];
  criticalInfo: string[];
  medications: string[];
  recentChanges: string[];
  acknowledgedAt?: string;
  acceptedAt?: string;
  completedAt?: string;
  notes?: string;
  createdAt: string;
}

export const insertCareHandoffSchema = z.object({
  carePlanId: z.string(),
  patientId: z.string(),
  fromMemberId: z.string(),
  fromMemberName: z.string(),
  toMemberId: z.string(),
  toMemberName: z.string(),
  urgency: z.enum(["routine", "urgent", "stat"]).default("routine"),
  reason: z.string().min(1),
  summary: z.string().min(1),
  pendingTasks: z.array(z.string()).default([]),
  criticalInfo: z.array(z.string()).default([]),
  medications: z.array(z.string()).default([]),
  recentChanges: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export type InsertCareHandoff = z.infer<typeof insertCareHandoffSchema>;

// Care Team Note - secure notes between team members
export type CareTeamNoteVisibility = "team" | "specific_roles" | "private";

export interface CareTeamNote {
  id: string;
  carePlanId: string;
  patientId: string;
  authorId: string;
  authorName: string;
  authorRole: CareTeamRole;
  content: string;
  visibility: CareTeamNoteVisibility;
  visibleToRoles?: CareTeamRole[];
  mentions: string[];
  isUrgent: boolean;
  readBy: string[];
  createdAt: string;
  updatedAt: string;
}

export const insertCareTeamNoteSchema = z.object({
  carePlanId: z.string(),
  patientId: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  authorRole: z.enum(["primary_physician", "specialist", "nurse", "care_coordinator", "pharmacist", "therapist", "social_worker", "caregiver", "other"]),
  content: z.string().min(1),
  visibility: z.enum(["team", "specific_roles", "private"]).default("team"),
  visibleToRoles: z.array(z.enum(["primary_physician", "specialist", "nurse", "care_coordinator", "pharmacist", "therapist", "social_worker", "caregiver", "other"])).optional(),
  mentions: z.array(z.string()).default([]),
  isUrgent: z.boolean().default(false),
});

export type InsertCareTeamNote = z.infer<typeof insertCareTeamNoteSchema>;

// Care Team Activity - activity feed for team collaboration
export type CareTeamActivityType = 
  | "task_created" 
  | "task_assigned" 
  | "task_completed" 
  | "handoff_initiated" 
  | "handoff_accepted" 
  | "handoff_completed"
  | "note_added"
  | "member_joined"
  | "member_left"
  | "goal_updated"
  | "intervention_completed"
  | "patient_update"
  | "alert";

export interface CareTeamActivity {
  id: string;
  carePlanId: string;
  patientId: string;
  type: CareTeamActivityType;
  actorId: string;
  actorName: string;
  actorRole: CareTeamRole;
  description: string;
  metadata?: Record<string, any>;
  relatedEntityId?: string;
  relatedEntityType?: "task" | "handoff" | "note" | "goal" | "intervention";
  isRead: boolean;
  createdAt: string;
}

// ============================================
// ADVANCED CARE TEAM MANAGEMENT
// ============================================

// Extended Care Team Member with availability and workload tracking
export type MemberAvailabilityStatus = "available" | "busy" | "on_break" | "off_duty" | "on_call";
export type ShiftType = "day" | "evening" | "night" | "weekend" | "on_call";

export interface CareTeamMemberExtended {
  id: string;
  userId: string;
  name: string;
  role: CareTeamRole;
  specialty?: string;
  credentials?: string[];
  phone?: string;
  email?: string;
  organization?: string;
  department?: string;
  isPrimary: boolean;
  avatar?: string;
  availabilityStatus: MemberAvailabilityStatus;
  currentShift?: ShiftType;
  shiftStartTime?: string;
  shiftEndTime?: string;
  workload: {
    activeTasks: number;
    pendingHandoffs: number;
    patientsAssigned: number;
  };
  skills: string[];
  certifications: string[];
  preferredContactMethod?: "phone" | "email" | "secure_message";
  emergencyContact?: string;
  supervisorId?: string;
  lastActiveAt?: string;
  joinedAt: string;
  updatedAt: string;
}

export const insertCareTeamMemberExtendedSchema = z.object({
  userId: z.string(),
  name: z.string().min(1),
  role: z.enum(["primary_physician", "specialist", "nurse", "care_coordinator", "pharmacist", "therapist", "social_worker", "caregiver", "other"]),
  specialty: z.string().optional(),
  credentials: z.array(z.string()).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  organization: z.string().optional(),
  department: z.string().optional(),
  isPrimary: z.boolean().default(false),
  skills: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  preferredContactMethod: z.enum(["phone", "email", "secure_message"]).optional(),
  emergencyContact: z.string().optional(),
  supervisorId: z.string().optional(),
});

export type InsertCareTeamMemberExtended = z.infer<typeof insertCareTeamMemberExtendedSchema>;

// Care Protocol Template - Pre-defined task templates for common care scenarios
export type ProtocolCategory = "admission" | "discharge" | "medication_change" | "post_procedure" | "chronic_care" | "acute_care" | "preventive" | "emergency" | "custom";

export interface CareProtocolTemplate {
  id: string;
  name: string;
  description: string;
  category: ProtocolCategory;
  isActive: boolean;
  estimatedDuration: string; // e.g., "2 days", "1 week"
  tasks: {
    title: string;
    description: string;
    assignToRole: CareTeamRole;
    priority: CareTeamTaskPriority;
    category: CareTeamTask["category"];
    dueInHours: number; // hours from protocol start
    dependsOn?: string[]; // task IDs within the template
    isRequired: boolean;
  }[];
  triggers?: {
    condition: string;
    action: string;
  }[];
  checklistItems?: string[];
  requiredRoles: CareTeamRole[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const insertCareProtocolTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  category: z.enum(["admission", "discharge", "medication_change", "post_procedure", "chronic_care", "acute_care", "preventive", "emergency", "custom"]),
  isActive: z.boolean().default(true),
  estimatedDuration: z.string(),
  tasks: z.array(z.object({
    title: z.string().min(1),
    description: z.string(),
    assignToRole: z.enum(["primary_physician", "specialist", "nurse", "care_coordinator", "pharmacist", "therapist", "social_worker", "caregiver", "other"]),
    priority: z.enum(["urgent", "high", "normal", "low"]).default("normal"),
    category: z.enum(["assessment", "medication", "follow_up", "documentation", "coordination", "patient_education", "other"]).default("other"),
    dueInHours: z.number().min(0),
    dependsOn: z.array(z.string()).optional(),
    isRequired: z.boolean().default(true),
  })),
  triggers: z.array(z.object({
    condition: z.string(),
    action: z.string(),
  })).optional(),
  checklistItems: z.array(z.string()).optional(),
  requiredRoles: z.array(z.enum(["primary_physician", "specialist", "nurse", "care_coordinator", "pharmacist", "therapist", "social_worker", "caregiver", "other"])),
  createdBy: z.string(),
});

export type InsertCareProtocolTemplate = z.infer<typeof insertCareProtocolTemplateSchema>;

// Escalation Rule - Automated escalation for overdue or critical items
export type EscalationTrigger = "task_overdue" | "handoff_pending" | "critical_value" | "no_response" | "high_priority_unassigned" | "patient_deterioration";
export type EscalationAction = "notify_supervisor" | "reassign_task" | "send_alert" | "create_incident" | "notify_team" | "page_on_call";
export type EscalationSeverity = "low" | "medium" | "high" | "critical";

export interface EscalationRule {
  id: string;
  name: string;
  description: string;
  trigger: EscalationTrigger;
  triggerCondition: {
    thresholdHours?: number; // e.g., escalate if overdue > 2 hours
    thresholdMinutes?: number;
    priority?: CareTeamTaskPriority[];
    roles?: CareTeamRole[];
    excludeWeekends?: boolean;
  };
  actions: {
    action: EscalationAction;
    target?: string; // member ID or role
    message?: string;
    delayMinutes?: number;
  }[];
  severity: EscalationSeverity;
  isActive: boolean;
  appliesTo: "all" | "specific_care_plans" | "specific_roles";
  carePlanIds?: string[];
  notifyPatient: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const insertEscalationRuleSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  trigger: z.enum(["task_overdue", "handoff_pending", "critical_value", "no_response", "high_priority_unassigned", "patient_deterioration"]),
  triggerCondition: z.object({
    thresholdHours: z.number().optional(),
    thresholdMinutes: z.number().optional(),
    priority: z.array(z.enum(["urgent", "high", "normal", "low"])).optional(),
    roles: z.array(z.enum(["primary_physician", "specialist", "nurse", "care_coordinator", "pharmacist", "therapist", "social_worker", "caregiver", "other"])).optional(),
    excludeWeekends: z.boolean().optional(),
  }),
  actions: z.array(z.object({
    action: z.enum(["notify_supervisor", "reassign_task", "send_alert", "create_incident", "notify_team", "page_on_call"]),
    target: z.string().optional(),
    message: z.string().optional(),
    delayMinutes: z.number().optional(),
  })),
  severity: z.enum(["low", "medium", "high", "critical"]),
  isActive: z.boolean().default(true),
  appliesTo: z.enum(["all", "specific_care_plans", "specific_roles"]).default("all"),
  carePlanIds: z.array(z.string()).optional(),
  notifyPatient: z.boolean().default(false),
  createdBy: z.string(),
});

export type InsertEscalationRule = z.infer<typeof insertEscalationRuleSchema>;

// Escalation Event - Record of triggered escalations
export interface EscalationEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  trigger: EscalationTrigger;
  severity: EscalationSeverity;
  carePlanId?: string;
  patientId?: string;
  taskId?: string;
  handoffId?: string;
  triggeredBy: string;
  actionsTaken: {
    action: EscalationAction;
    target: string;
    completedAt?: string;
    result?: string;
  }[];
  status: "pending" | "in_progress" | "resolved" | "dismissed";
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  createdAt: string;
}

// Team Performance Metrics
export interface TeamMemberMetrics {
  memberId: string;
  memberName: string;
  role: CareTeamRole;
  period: "daily" | "weekly" | "monthly";
  periodStart: string;
  periodEnd: string;
  tasksAssigned: number;
  tasksCompleted: number;
  tasksOverdue: number;
  averageCompletionTimeHours: number;
  handoffsReceived: number;
  handoffsCompleted: number;
  averageHandoffResponseMinutes: number;
  notesAdded: number;
  patientInteractions: number;
  escalationsTriggered: number;
  workloadScore: number; // 0-100, higher = busier
  responseTimeScore: number; // 0-100, higher = faster
  collaborationScore: number; // 0-100, based on notes/handoffs
}

export interface TeamPerformanceMetrics {
  carePlanId?: string;
  period: "daily" | "weekly" | "monthly";
  periodStart: string;
  periodEnd: string;
  overview: {
    totalTasks: number;
    completedTasks: number;
    overdueRate: number; // percentage
    averageCompletionTimeHours: number;
    escalationRate: number; // percentage
  };
  handoffMetrics: {
    totalHandoffs: number;
    completedHandoffs: number;
    averageResponseTimeMinutes: number;
    declinedHandoffs: number;
  };
  communicationMetrics: {
    totalNotes: number;
    urgentNotes: number;
    averageNotesPerDay: number;
    teamEngagementScore: number; // 0-100
  };
  workloadDistribution: {
    memberId: string;
    memberName: string;
    role: CareTeamRole;
    taskCount: number;
    percentage: number;
  }[];
  memberMetrics: TeamMemberMetrics[];
  trends: {
    date: string;
    tasksCompleted: number;
    tasksCreated: number;
    escalations: number;
  }[];
}

export interface CarePlanProgress {
  id: string;
  date: string;
  goalId?: string;
  interventionId?: string;
  note: string;
  recordedBy: string;
  type: "progress_note" | "goal_update" | "intervention_completed" | "status_change" | "care_team_note";
}

export interface CarePlan {
  id: string;
  patientId: string;
  title: string;
  description?: string;
  category: CarePlanCategory;
  status: CarePlanStatus;
  startDate: string;
  endDate?: string;
  reviewDate?: string;
  goals: CarePlanGoal[];
  interventions: CarePlanIntervention[];
  careTeam: CareTeamMember[];
  progressNotes: CarePlanProgress[];
  conditions: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const insertCarePlanSchema = z.object({
  patientId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(["chronic_disease", "post_surgical", "preventive", "mental_health", "rehabilitation", "palliative", "wellness", "other"]),
  status: z.enum(["draft", "active", "on_hold", "completed", "cancelled"]).default("draft"),
  startDate: z.string(),
  endDate: z.string().optional(),
  reviewDate: z.string().optional(),
  goals: z.array(z.object({
    id: z.string(),
    description: z.string(),
    targetDate: z.string().optional(),
    priority: z.enum(["high", "medium", "low"]),
    status: z.enum(["not_started", "in_progress", "achieved", "not_achieved", "cancelled"]).default("not_started"),
    progress: z.number().min(0).max(100).default(0),
    metrics: z.array(z.object({
      name: z.string(),
      target: z.string(),
      current: z.string(),
      unit: z.string(),
    })).optional(),
    notes: z.string().optional(),
  })).default([]),
  interventions: z.array(z.object({
    id: z.string(),
    goalId: z.string(),
    description: z.string(),
    frequency: z.string(),
    assignedTo: z.string().optional(),
    startDate: z.string(),
    endDate: z.string().optional(),
    status: z.enum(["scheduled", "in_progress", "completed", "cancelled", "overdue"]).default("scheduled"),
    lastPerformed: z.string().optional(),
    notes: z.string().optional(),
  })).default([]),
  careTeam: z.array(z.object({
    id: z.string(),
    name: z.string(),
    role: z.enum(["primary_physician", "specialist", "nurse", "care_coordinator", "pharmacist", "therapist", "social_worker", "caregiver", "other"]),
    specialty: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    organization: z.string().optional(),
    isPrimary: z.boolean().default(false),
  })).default([]),
  conditions: z.array(z.string()).default([]),
  createdBy: z.string(),
});

export type InsertCarePlan = z.infer<typeof insertCarePlanSchema>;

export const insertCarePlanProgressSchema = z.object({
  carePlanId: z.string(),
  goalId: z.string().optional(),
  interventionId: z.string().optional(),
  note: z.string().min(1),
  recordedBy: z.string(),
  type: z.enum(["progress_note", "goal_update", "intervention_completed", "status_change", "care_team_note"]),
});

export type InsertCarePlanProgress = z.infer<typeof insertCarePlanProgressSchema>;

// ============================================
// COLLABORATIVE CARE PLAN PORTAL
// ============================================

// Contributor role types
export const carePlanContributorRoles = [
  "owner", "editor", "viewer", "reviewer", "approver"
] as const;
export type CarePlanContributorRole = typeof carePlanContributorRoles[number];

// Change types for version tracking
export const carePlanChangeTypes = [
  "created", "goal_added", "goal_updated", "goal_removed",
  "intervention_added", "intervention_updated", "intervention_removed",
  "status_changed", "care_team_added", "care_team_removed",
  "notes_updated", "title_updated", "description_updated",
  "acknowledged", "suggestion_applied", "version_created"
] as const;
export type CarePlanChangeType = typeof carePlanChangeTypes[number];

// Suggestion status
export const suggestionStatuses = [
  "pending", "accepted", "rejected", "implemented", "expired"
] as const;
export type SuggestionStatus = typeof suggestionStatuses[number];

// Care Plan Contributor
export interface CarePlanContributor {
  id: string;
  carePlanId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  contributorRole: CarePlanContributorRole;
  canEdit: boolean;
  canApprove: boolean;
  addedBy: string;
  addedAt: string;
  lastAccessedAt?: string;
  isActive: boolean;
}

export const insertCarePlanContributorSchema = z.object({
  carePlanId: z.string(),
  userId: z.string(),
  userName: z.string(),
  userRole: z.enum(userRoles),
  contributorRole: z.enum(carePlanContributorRoles),
  canEdit: z.boolean().default(false),
  canApprove: z.boolean().default(false),
  addedBy: z.string(),
});

export type InsertCarePlanContributor = z.infer<typeof insertCarePlanContributorSchema>;

// Care Plan Version (for history tracking)
export interface CarePlanVersion {
  id: string;
  carePlanId: string;
  versionNumber: number;
  snapshot: string; // JSON snapshot of the care plan at this version
  createdBy: string;
  createdByName: string;
  createdAt: string;
  changesSummary: string;
  changesCount: number;
}

export const insertCarePlanVersionSchema = z.object({
  carePlanId: z.string(),
  versionNumber: z.number().int().positive(),
  snapshot: z.string(),
  createdBy: z.string(),
  createdByName: z.string(),
  changesSummary: z.string(),
  changesCount: z.number().int().default(1),
});

export type InsertCarePlanVersion = z.infer<typeof insertCarePlanVersionSchema>;

// Care Plan Change (granular change tracking)
export interface CarePlanChange {
  id: string;
  carePlanId: string;
  versionId?: string;
  changeType: CarePlanChangeType;
  fieldPath: string; // e.g., "goals[0].title" or "status"
  previousValue?: string;
  newValue?: string;
  changedBy: string;
  changedByName: string;
  changedByRole: UserRole;
  changedAt: string;
  reason?: string;
}

export const insertCarePlanChangeSchema = z.object({
  carePlanId: z.string(),
  versionId: z.string().optional(),
  changeType: z.enum(carePlanChangeTypes),
  fieldPath: z.string(),
  previousValue: z.string().optional(),
  newValue: z.string().optional(),
  changedBy: z.string(),
  changedByName: z.string(),
  changedByRole: z.enum(userRoles),
  reason: z.string().optional(),
});

export type InsertCarePlanChange = z.infer<typeof insertCarePlanChangeSchema>;

// Patient Acknowledgment
export interface CarePlanAcknowledgment {
  id: string;
  carePlanId: string;
  versionId: string;
  patientId: string;
  patientName: string;
  acknowledgedAt: string;
  signature?: string; // Base64 signature if captured
  acknowledgedVia: "web" | "mobile" | "in_person" | "verbal";
  witnessName?: string;
  notes?: string;
  ipAddress?: string;
}

export const insertCarePlanAcknowledgmentSchema = z.object({
  carePlanId: z.string(),
  versionId: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  signature: z.string().optional(),
  acknowledgedVia: z.enum(["web", "mobile", "in_person", "verbal"]),
  witnessName: z.string().optional(),
  notes: z.string().optional(),
  ipAddress: z.string().optional(),
});

export type InsertCarePlanAcknowledgment = z.infer<typeof insertCarePlanAcknowledgmentSchema>;

// AI Care Plan Suggestion
export interface CarePlanSuggestion {
  id: string;
  carePlanId: string;
  patientId: string;
  suggestionType: "goal_adjustment" | "intervention_add" | "intervention_modify" | "status_change" | "escalation" | "de_escalation" | "new_goal" | "remove_intervention";
  title: string;
  description: string;
  rationale: string;
  evidenceBasis: string[];
  suggestedChanges: {
    fieldPath: string;
    currentValue?: string;
    suggestedValue: string;
  }[];
  priority: "high" | "medium" | "low";
  confidence: number; // 0-100
  basedOnMetrics: {
    metricName: string;
    currentValue: string;
    targetValue?: string;
    trend: "improving" | "stable" | "worsening";
  }[];
  status: SuggestionStatus;
  createdAt: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  appliedToVersionId?: string;
}

export const insertCarePlanSuggestionSchema = z.object({
  carePlanId: z.string(),
  patientId: z.string(),
  suggestionType: z.enum([
    "goal_adjustment", "intervention_add", "intervention_modify", 
    "status_change", "escalation", "de_escalation", "new_goal", "remove_intervention"
  ]),
  title: z.string(),
  description: z.string(),
  rationale: z.string(),
  evidenceBasis: z.array(z.string()).default([]),
  suggestedChanges: z.array(z.object({
    fieldPath: z.string(),
    currentValue: z.string().optional(),
    suggestedValue: z.string(),
  })).default([]),
  priority: z.enum(["high", "medium", "low"]),
  confidence: z.number().min(0).max(100),
  basedOnMetrics: z.array(z.object({
    metricName: z.string(),
    currentValue: z.string(),
    targetValue: z.string().optional(),
    trend: z.enum(["improving", "stable", "worsening"]),
  })).default([]),
});

export type InsertCarePlanSuggestion = z.infer<typeof insertCarePlanSuggestionSchema>;

// Collaborative Care Plan (extends CarePlan with collaboration features)
export interface CollaborativeCarePlan {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  description?: string;
  category: CarePlanCategory;
  status: CarePlanStatus;
  startDate: string;
  targetEndDate?: string;
  goals: CarePlanGoal[];
  interventions: CarePlanIntervention[];
  progressNotes: CarePlanProgress[];
  careTeam: {
    id: string;
    name: string;
    role: string;
    specialty?: string;
    phone?: string;
    email?: string;
    organization?: string;
    isPrimary: boolean;
  }[];
  conditions: string[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  // Collaboration specific fields
  currentVersionNumber: number;
  lastAcknowledgedVersionId?: string;
  lastAcknowledgedAt?: string;
  pendingSuggestionsCount: number;
  contributorCount: number;
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: string;
  lockReason?: string;
}

export const insertCollaborativeCarePlanSchema = insertCarePlanSchema.extend({
  patientName: z.string(),
  createdByName: z.string(),
  isLocked: z.boolean().default(false),
  lockReason: z.string().optional(),
});

export type InsertCollaborativeCarePlan = z.infer<typeof insertCollaborativeCarePlanSchema>;

// Timeline Event - unified chronological view
export type TimelineEventType = 
  | "encounter" 
  | "diagnosis" 
  | "medication" 
  | "lab_result" 
  | "imaging" 
  | "procedure" 
  | "immunization"
  | "vital_sign"
  | "note"
  | "treatment"
  | "surgery"
  | "follow_up"
  | "symptom";

export interface TimelineEvent {
  id: string;
  profileId: string;                  // Link to profile (primary)
  patientId: string;                  // Legacy field for backward compatibility
  ehrConnectionId: string;
  type: TimelineEventType;
  title: string;
  description: string;
  startDate: string;                  // Event start date
  endDate: string | null;             // Event end date (null for single-day events)
  provider?: string;
  facility: string;
  sourceRecordId: string;
  sourceRecordType: string;
  duplicateGroupId?: string;
  isPrimary: boolean;
  tags: string[];                     // Array of tag IDs
  linkedDocuments: string[];          // Array of document IDs
  metadata?: Record<string, string>;
}

export const insertTimelineEventSchema = z.object({
  profileId: z.string().min(1),
  patientId: z.string().optional().default(""),
  ehrConnectionId: z.string().optional().default(""),
  type: z.enum([
    "encounter", "diagnosis", "medication", "lab_result", "imaging", 
    "procedure", "immunization", "vital_sign", "note", "treatment",
    "surgery", "follow_up", "symptom"
  ]),
  title: z.string().min(1),
  description: z.string().default(""),
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
  provider: z.string().optional(),
  facility: z.string().optional().default(""),
  sourceRecordId: z.string().optional().default(""),
  sourceRecordType: z.string().optional().default(""),
  duplicateGroupId: z.string().optional(),
  isPrimary: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  linkedDocuments: z.array(z.string()).default([]),
  metadata: z.record(z.string()).optional(),
});

export type InsertTimelineEvent = z.infer<typeof insertTimelineEventSchema>;

// Folder for organizing documents
export interface Folder {
  id: string;
  profileId: string;
  name: string;
  description: string | null;
  parentFolderId: string | null;      // For nested folders
  color: string | null;               // Optional folder color
  icon: string | null;                // Optional icon name
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const insertFolderSchema = z.object({
  profileId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  parentFolderId: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  sortOrder: z.number().default(0),
});

export type InsertFolder = z.infer<typeof insertFolderSchema>;

// Tag for categorizing documents, events, and follow-ups
export interface Tag {
  id: string;
  profileId: string;
  name: string;
  color: string;                      // Tag color for display
  category: "condition" | "provider" | "treatment" | "custom";
  createdAt: string;
}

export const insertTagSchema = z.object({
  profileId: z.string().min(1),
  name: z.string().min(1),
  color: z.string().default("#6366f1"),
  category: z.enum(["condition", "provider", "treatment", "custom"]).default("custom"),
});

export type InsertTag = z.infer<typeof insertTagSchema>;

// Document types for health records
export const documentTypes = [
  "pdf", 
  "ccd", 
  "lab_report", 
  "imaging_report", 
  "clinical_note", 
  "discharge_summary",
  "consent_form",
  "insurance_card",
  "referral",
  "prescription",
  "other"
] as const;
export type DocumentType = (typeof documentTypes)[number];

// Document for Document/Result Viewer
export interface Document {
  id: string;
  profileId: string;                  // Link to profile (primary)
  patientId: string;                  // Legacy field for backward compatibility
  folderId: string | null;            // Optional folder organization
  ehrConnectionId: string;
  type: DocumentType;
  title: string;
  description: string;
  dateOfService: string;              // When the service/event occurred
  uploadedAt: string;                 // When document was uploaded
  source: string;                     // Source system/provider
  provider?: string;
  facility: string;
  fileUrl?: string;
  content?: string;
  mimeType: string;
  tags: string[];                     // Array of tag IDs
  metadata?: Record<string, string>;
}

export const insertDocumentSchema = z.object({
  profileId: z.string().min(1),
  patientId: z.string().optional().default(""),
  folderId: z.string().nullable().optional(),
  ehrConnectionId: z.string(),
  type: z.enum(documentTypes),
  title: z.string().min(1),
  description: z.string(),
  dateOfService: z.string(),
  uploadedAt: z.string().optional(),
  source: z.string().default("manual"),
  provider: z.string().optional(),
  facility: z.string(),
  fileUrl: z.string().optional(),
  content: z.string().optional(),
  mimeType: z.string(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string()).optional(),
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;

// Patient Identity - for identity matching controls
export interface PatientIdentity {
  id: string;
  patientId: string;
  nameVariants: string[];
  dateOfBirth: string;
  emails: string[];
  phones: string[];
  addresses: string[];
  matchConfidence: "high" | "medium" | "low";
  flaggedAsIncorrect: boolean;
  flaggedItems: string[];
  lastVerified?: string;
}

// Medication with reconciliation fields
export interface MedicationReconciliation {
  id: string;
  patientId: string;
  ehrConnectionId: string;
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  route?: string;
  prescribedBy: string;
  startDate: string;
  endDate?: string;
  status: "active" | "discontinued" | "on_hold";
  patientReported: "taking" | "not_taking" | "unknown";
  duplicateGroupId?: string;
  isPrimary: boolean;
  conflictingDoses?: string[];
  refillsRemaining: number;
  facility: string;
}

// Medication conflict types for reconciliation
export type MedicationConflictType = "dose_mismatch" | "frequency_mismatch" | "status_mismatch" | "prescriber_mismatch";

// Medication conflict details
export interface MedicationConflict {
  id: string;
  medicationName: string;
  conflictType: MedicationConflictType;
  sources: {
    facility: string;
    value: string;
    lastUpdated: string;
  }[];
  severity: "low" | "medium" | "high";
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
}

// Merged medication group (for duplicate display)
export interface MergedMedicationGroup {
  id: string;
  name: string;
  genericName?: string;
  primaryMedication: MedicationReconciliation;
  duplicates: MedicationReconciliation[];
  conflicts: MedicationConflict[];
  hasConflicts: boolean;
  sourceCount: number;
  status: "active" | "discontinued" | "on_hold";
}

// Medication list response with merged view
export interface MedicationListResponse {
  currentMedications: MergedMedicationGroup[];
  allMedications: MergedMedicationGroup[];
  totalCurrent: number;
  totalAll: number;
  conflictCount: number;
  duplicateCount: number;
}

// Medication list analytics events
export const medicationListAnalyticsEvents = [
  "med_list_opened",
  "med_conflict_viewed",
  "med_toggle_current_all",
  "med_duplicate_expanded",
] as const;
export type MedicationListAnalyticsEvent = (typeof medicationListAnalyticsEvents)[number];

// Schema for medication list analytics
export const medicationListAnalyticsSchema = z.object({
  eventType: z.enum(medicationListAnalyticsEvents),
  medicationId: z.string().optional(),
  conflictId: z.string().optional(),
  view: z.enum(["current", "all"]).optional(),
  metadata: z.record(z.string()).optional(),
});
export type MedicationListAnalytics = z.infer<typeof medicationListAnalyticsSchema>;

// Medical Term Explanation - for plain-English layer
export interface MedicalTermExplanation {
  term: string;
  category: "lab" | "diagnosis" | "procedure" | "medication" | "anatomy" | "general";
  plainEnglish: string;
  whatItMeasures?: string;
  normalRange?: string;
  relatedTerms?: string[];
}

// Caregiver - trusted family member access
export const caregiverRelationships = ["spouse", "parent", "child", "sibling", "grandparent", "grandchild", "friend", "other"] as const;
export type CaregiverRelationship = typeof caregiverRelationships[number];

export const caregiverStatuses = ["pending", "accepted", "declined", "suspended", "expired"] as const;
export type CaregiverStatus = typeof caregiverStatuses[number];

// Granular caregiver permission categories
export const caregiverPermissionCategories = [
  "view_medications",        // View current and past medications
  "view_conditions",         // View health conditions and diagnoses
  "view_allergies",          // View allergy information
  "view_appointments",       // View appointments and scheduling
  "view_lab_results",        // View lab results and test history
  "view_vital_signs",        // View vital signs and measurements
  "view_documents",          // View medical documents
  "view_care_plans",         // View care plans and goals
  "view_immunizations",      // View immunization records
  "receive_alerts",          // Receive health alerts and notifications
  "communicate_providers",   // Send messages to care team on behalf of patient
  "manage_appointments",     // Schedule/cancel appointments
  "request_refills",         // Request medication refills
  "view_billing",            // View billing and insurance information
  "emergency_contact",       // Designated emergency contact with full access
] as const;
export type CaregiverPermissionCategory = typeof caregiverPermissionCategories[number];

// Permission category descriptions for UI
export const caregiverPermissionDescriptions: Record<CaregiverPermissionCategory, { label: string; description: string; sensitive: boolean }> = {
  view_medications: { label: "Medications", description: "View current and past medications, dosages, and instructions", sensitive: false },
  view_conditions: { label: "Health Conditions", description: "View diagnosed conditions and health problems", sensitive: true },
  view_allergies: { label: "Allergies", description: "View allergy information and reactions", sensitive: false },
  view_appointments: { label: "Appointments", description: "View scheduled and past medical appointments", sensitive: false },
  view_lab_results: { label: "Lab Results", description: "View laboratory test results and history", sensitive: true },
  view_vital_signs: { label: "Vital Signs", description: "View blood pressure, weight, and other measurements", sensitive: false },
  view_documents: { label: "Medical Documents", description: "View clinical notes, reports, and documents", sensitive: true },
  view_care_plans: { label: "Care Plans", description: "View care plans, goals, and treatment progress", sensitive: false },
  view_immunizations: { label: "Immunizations", description: "View vaccination records", sensitive: false },
  receive_alerts: { label: "Health Alerts", description: "Receive notifications about health changes or concerns", sensitive: false },
  communicate_providers: { label: "Provider Communication", description: "Send messages to the care team on patient's behalf", sensitive: true },
  manage_appointments: { label: "Manage Appointments", description: "Schedule or cancel appointments for the patient", sensitive: false },
  request_refills: { label: "Request Refills", description: "Request medication refills on patient's behalf", sensitive: false },
  view_billing: { label: "Billing Information", description: "View billing statements and insurance information", sensitive: true },
  emergency_contact: { label: "Emergency Contact", description: "Full access during emergencies with notification to patient", sensitive: true },
};

// Access restriction types
export const accessRestrictionTypes = ["none", "time_limited", "approval_required", "view_only"] as const;
export type AccessRestrictionType = typeof accessRestrictionTypes[number];

export interface Caregiver {
  id: string;
  patientUserId: string;
  caregiverUserId: string | null;
  caregiverEmail: string;
  caregiverName: string | null;
  relationship: CaregiverRelationship;
  status: CaregiverStatus;
  permissions: CaregiverPermissionCategory[];
  accessRestriction: AccessRestrictionType;
  accessExpiresAt: string | null;         // For time-limited access
  requiresApprovalFor: CaregiverPermissionCategory[];  // Permissions that need patient approval each time
  sensitiveDataAccess: boolean;           // Whether caregiver can access sensitive data
  notifyPatientOnAccess: boolean;         // Notify patient when caregiver accesses data
  emergencyAccessEnabled: boolean;        // Allow emergency override access
  lastAccessAt: string | null;            // Track last access time
  inviteToken: string | null;
  invitedAt: string;
  acceptedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// Caregiver access log for audit trail
export interface CaregiverAccessLog {
  id: string;
  caregiverId: string;
  caregiverName: string;
  patientUserId: string;
  accessType: "view" | "action" | "emergency";
  resourceType: string;                   // What was accessed (medications, documents, etc.)
  resourceId: string | null;              // Specific resource ID if applicable
  action: string;                         // Description of the action taken
  ipAddress: string | null;
  userAgent: string | null;
  approved: boolean;                      // Whether access was approved (for approval_required)
  emergencyOverride: boolean;             // Whether emergency access was used
  patientNotified: boolean;               // Whether patient was notified
  accessedAt: string;
}

export const insertCaregiverAccessLogSchema = z.object({
  caregiverId: z.string().min(1),
  caregiverName: z.string(),
  patientUserId: z.string().min(1),
  accessType: z.enum(["view", "action", "emergency"]),
  resourceType: z.string().min(1),
  resourceId: z.string().optional(),
  action: z.string().min(1),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  approved: z.boolean().default(true),
  emergencyOverride: z.boolean().default(false),
  patientNotified: z.boolean().default(false),
});
export type InsertCaregiverAccessLog = z.infer<typeof insertCaregiverAccessLogSchema>;

// Caregiver permission update request (for sensitive permissions requiring approval)
export interface CaregiverAccessRequest {
  id: string;
  caregiverId: string;
  caregiverName: string;
  patientUserId: string;
  requestedPermission: CaregiverPermissionCategory;
  reason: string;
  status: "pending" | "approved" | "denied";
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  expiresAt: string | null;               // Auto-expire pending requests
}

export const insertCaregiverAccessRequestSchema = z.object({
  caregiverId: z.string().min(1),
  caregiverName: z.string(),
  patientUserId: z.string().min(1),
  requestedPermission: z.enum(caregiverPermissionCategories),
  reason: z.string().min(1, "Please provide a reason for this access request"),
});
export type InsertCaregiverAccessRequest = z.infer<typeof insertCaregiverAccessRequestSchema>;

export const insertCaregiverSchema = z.object({
  patientUserId: z.string().min(1),
  caregiverEmail: z.string().email("Please enter a valid email address"),
  caregiverName: z.string().optional(),
  relationship: z.enum(caregiverRelationships, { message: "Please select a relationship" }),
  permissions: z.array(z.enum(caregiverPermissionCategories)).default(["view_medications", "view_appointments", "view_allergies"]),
  accessRestriction: z.enum(accessRestrictionTypes).default("none"),
  accessExpiresAt: z.string().optional(),
  requiresApprovalFor: z.array(z.enum(caregiverPermissionCategories)).default([]),
  sensitiveDataAccess: z.boolean().default(false),
  notifyPatientOnAccess: z.boolean().default(true),
  emergencyAccessEnabled: z.boolean().default(false),
});

export type InsertCaregiver = z.infer<typeof insertCaregiverSchema>;

// Schema for updating caregiver permissions
export const updateCaregiverPermissionsSchema = z.object({
  permissions: z.array(z.enum(caregiverPermissionCategories)),
  accessRestriction: z.enum(accessRestrictionTypes).optional(),
  accessExpiresAt: z.string().optional().nullable(),
  requiresApprovalFor: z.array(z.enum(caregiverPermissionCategories)).optional(),
  sensitiveDataAccess: z.boolean().optional(),
  notifyPatientOnAccess: z.boolean().optional(),
  emergencyAccessEnabled: z.boolean().optional(),
});
export type UpdateCaregiverPermissions = z.infer<typeof updateCaregiverPermissionsSchema>;

// Caregiver Update Request - for AI-assisted caregiver coordination
export const updateRequestStatuses = ["pending", "completed", "cancelled"] as const;
export type UpdateRequestStatus = typeof updateRequestStatuses[number];

export const updateRequestTypes = ["status_update", "medication_check", "appointment_reminder", "general_question", "health_concern"] as const;
export type UpdateRequestType = typeof updateRequestTypes[number];

export interface CaregiverUpdateRequest {
  id: string;
  patientUserId: string;
  requesterId: string;        // The caregiver who is requesting an update
  recipientId: string;        // The caregiver who should respond
  requestType: UpdateRequestType;
  message: string;            // The request message
  aiGeneratedContext?: string; // AI-generated context about recent patient activity
  response?: string;          // The response from the recipient
  aiAssistedResponse?: string; // AI-assisted suggested response
  status: UpdateRequestStatus;
  priority: "low" | "normal" | "high";
  createdAt: string;
  respondedAt?: string;
  updatedAt: string;
}

export const insertCaregiverUpdateRequestSchema = z.object({
  patientUserId: z.string().min(1),
  requesterId: z.string().min(1),
  recipientId: z.string().min(1),
  requestType: z.enum(updateRequestTypes),
  message: z.string().min(1, "Please enter a message"),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
});

export type InsertCaregiverUpdateRequest = z.infer<typeof insertCaregiverUpdateRequestSchema>;

// Caregiver Update - AI-generated patient summary
export interface CaregiverPatientUpdate {
  id: string;
  patientUserId: string;
  generatedBy: string;        // User ID who requested the update
  summary: string;            // AI-generated summary
  recentMedications: string[];
  recentAppointments: string[];
  recentLabResults: string[];
  healthAlerts: string[];
  generatedAt: string;
  expiresAt: string;          // Updates are valid for limited time
}

// Onboarding status tracking
export interface OnboardingStatus {
  hasCompletedOnboarding: boolean;
  completedSteps: string[];
  lastStepCompleted?: string;
  completedAt?: string;
}

// User for auth
export interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  onboarding?: OnboardingStatus;
  // Local auth fields
  passwordHash: string | null;
  authProvider: string | null;
  mfaRequired: string | null;
  passwordUpdatedAt: Date | null;
  emailVerified: boolean;
  status: string;
  dateOfBirth?: string | null;
  preferredLanguage?: string | null;
}

export interface InsertUser {
  id?: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  role?: UserRole;
  // Local auth fields
  passwordHash?: string | null;
  authProvider?: string | null;
  mfaRequired?: string | null;
  emailVerified?: boolean;
  status?: string;
  dateOfBirth?: string | null;
  preferredLanguage?: string | null;
}

// ============================================
// PROFILE MANAGEMENT SYSTEM (Family Health Records)
// ============================================

// Profile relationship types
export const profileRelationshipTypes = ["self", "child", "parent", "spouse", "sibling", "grandparent", "guardian", "other"] as const;
export type ProfileRelationshipType = typeof profileRelationshipTypes[number];

// Profile status
export const profileStatuses = ["active", "inactive", "pending"] as const;
export type ProfileStatus = typeof profileStatuses[number];

// Profile types for multi-profile system (defined before Profile interface)
export const profileTypeValues = ["self", "child", "dependent_adult", "elder"] as const;
export type ProfileTypeValue = typeof profileTypeValues[number];

// Profile - represents a health profile (self or dependent)
export interface Profile {
  id: string;
  userId: string;                           // Owner user who manages this profile
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  profileType: ProfileTypeValue;            // Type of profile (self, child, etc.)
  relationship: ProfileRelationshipType;    // Relationship to the owner
  profileImageUrl: string | null;
  status: ProfileStatus;
  isDefault: boolean;                       // Is this the default/self profile
  simplifiedMode: boolean;                  // Per-profile simplified mode setting
  unifiedPatientId: string | null;          // Link to unified patient data
  medicalRecordNumber: string | null;       // Optional MRN for EHR linking
  insuranceId: string | null;               // Optional insurance ID
  emergencyContact: string | null;          // Emergency contact info (JSON)
  notes: string | null;                     // Additional notes about the profile
  createdAt: string;
  updatedAt: string;
}

export const insertProfileSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.string().nullable().optional(),
  profileType: z.enum(profileTypeValues).default("self"),
  relationship: z.enum(profileRelationshipTypes),
  profileImageUrl: z.string().nullable().optional(),
  status: z.enum(profileStatuses).default("active"),
  isDefault: z.boolean().default(false),
  simplifiedMode: z.boolean().default(false),
  unifiedPatientId: z.string().nullable().optional(),
  medicalRecordNumber: z.string().nullable().optional(),
  insuranceId: z.string().nullable().optional(),
  emergencyContact: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type InsertProfile = z.infer<typeof insertProfileSchema>;

// Active profile tracking per user
export interface UserActiveProfile {
  id: string;
  userId: string;
  activeProfileId: string;
  switchedAt: string;
}

export const insertUserActiveProfileSchema = z.object({
  userId: z.string().min(1),
  activeProfileId: z.string().min(1),
});

export type InsertUserActiveProfile = z.infer<typeof insertUserActiveProfileSchema>;

// Profile-specific accessibility settings
export interface ProfileAccessibilitySettings {
  id: string;
  profileId: string;
  simplifiedMode: boolean;
  largeText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: "normal" | "large" | "extra-large";
  simpleLanguage: boolean;
  screenReaderOptimized: boolean;
  createdAt: string;
  updatedAt: string;
}

export const insertProfileAccessibilitySettingsSchema = z.object({
  profileId: z.string().min(1),
  simplifiedMode: z.boolean().default(false),
  largeText: z.boolean().default(false),
  highContrast: z.boolean().default(false),
  reducedMotion: z.boolean().default(false),
  fontSize: z.enum(["normal", "large", "extra-large"]).default("normal"),
  simpleLanguage: z.boolean().default(false),
  screenReaderOptimized: z.boolean().default(false),
});

export type InsertProfileAccessibilitySettings = z.infer<typeof insertProfileAccessibilitySettingsSchema>;

// Profile analytics events
export const profileAnalyticsEventTypes = ["profile_created", "profile_switched", "dependent_added", "profile_updated", "profile_deleted"] as const;
export type ProfileAnalyticsEventType = typeof profileAnalyticsEventTypes[number];

export interface ProfileAnalyticsEvent {
  id: string;
  userId: string;
  profileId: string;
  eventType: ProfileAnalyticsEventType;
  metadata: Record<string, string> | null;
  createdAt: string;
}

export const insertProfileAnalyticsEventSchema = z.object({
  userId: z.string().min(1),
  profileId: z.string().min(1),
  eventType: z.enum(profileAnalyticsEventTypes),
  metadata: z.record(z.string()).nullable().optional(),
});

export type InsertProfileAnalyticsEvent = z.infer<typeof insertProfileAnalyticsEventSchema>;

// Profile summary for UI display
export interface ProfileSummary {
  id: string;
  firstName: string;
  lastName: string;
  profileType: ProfileTypeValue;
  relationship: ProfileRelationshipType;
  profileImageUrl: string | null;
  isActive: boolean;
  isDefault: boolean;
  recordsCount?: number;
  lastActivity?: string;
  medsCount: number;
  upcomingFollowUps: number;
  hasCancerTrack: boolean;
  hasVaccineRecord: boolean;
}

// ============================================
// MULTI-PROFILE ACCESS CONTROL SYSTEM
// ============================================

// Note: profileTypeValues defined above the Profile interface is the canonical source
// for profile types. Use ProfileTypeValue for all profile type references.

// Profile tags - special tracking (e.g., cancer survivorship)
export const profileTags = ["cancer_survivorship", "chronic_condition", "pregnancy", "mental_health", "post_surgery"] as const;
export type ProfileTag = typeof profileTags[number];

// Profile member roles - defines access level
export const profileMemberRoles = [
  "owner",              // Full control, can manage profile
  "caregiver_full",     // Full access to all data
  "caregiver_limited",  // Limited access: meds + appointments only
  "clinician_readonly", // Time-limited read-only view
  "emergency_access"    // Break-glass emergency access with PIN
] as const;
export type ProfileMemberRole = typeof profileMemberRoles[number];

// Permission scopes for limited access roles
export const profileAccessScopes = [
  "medications",
  "appointments",
  "allergies",
  "diagnoses",
  "documents",
  "tasks",
  "sharing",
  "cancer_track",         // Cancer Track timeline and documents
  "side_effects_journal", // Side Effects Journal entries
  "all"
] as const;
export type ProfileAccessScope = typeof profileAccessScopes[number];

// Caregiver permission levels for specific sections
export const caregiverPermissionLevels = [
  "none",        // No access
  "view_only",   // Read-only access
  "add_entries", // Can add new entries but not edit/delete
  "full"         // Can add, edit, and delete entries
] as const;
export type CaregiverPermissionLevel = typeof caregiverPermissionLevels[number];

// Role-based access scope mapping
export const roleScopePermissions: Record<ProfileMemberRole, ProfileAccessScope[]> = {
  owner: ["all"],
  caregiver_full: ["all"],
  caregiver_limited: ["medications", "appointments"],
  clinician_readonly: ["all"],
  emergency_access: ["medications", "allergies", "diagnoses", "appointments"],
};

// Caregiver Section Consent - tracks patient consent for caregiver access to specific sections
export interface CaregiverSectionConsent {
  id: string;
  profileId: string;
  caregiverId: string;              // The caregiver user ID
  caregiverName: string;
  section: "cancer_track" | "side_effects_journal";
  permissionLevel: CaregiverPermissionLevel;
  grantedBy: string;                // Profile owner who granted consent
  grantedAt: string;
  expiresAt: string | null;         // Optional expiration
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const insertCaregiverSectionConsentSchema = z.object({
  profileId: z.string().min(1),
  caregiverId: z.string().min(1),
  caregiverName: z.string().min(1),
  section: z.enum(["cancer_track", "side_effects_journal"]),
  permissionLevel: z.enum(caregiverPermissionLevels),
  grantedBy: z.string().min(1),
  expiresAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type InsertCaregiverSectionConsent = z.infer<typeof insertCaregiverSectionConsentSchema>;

// Caregiver Notification Types
export const caregiverNotificationTypes = [
  "appointment_reminder",       // Upcoming appointment
  "appointment_scheduled",      // New appointment scheduled
  "appointment_changed",        // Appointment rescheduled/cancelled
  "medication_added",           // New medication added
  "medication_changed",         // Medication dosage/schedule changed
  "medication_reminder",        // Medication due reminder
  "side_effect_reported",       // New side effect entry
  "side_effect_severe",         // Severe side effect reported
  "cancer_track_update",        // New timeline entry
  "cancer_track_result",        // New test result or scan
  "document_uploaded",          // New document added
  "care_packet_shared",         // Care packet shared with provider
  "profile_access_change",      // Access permissions changed
  "emergency_alert",            // Urgent/emergency notification
] as const;
export type CaregiverNotificationType = typeof caregiverNotificationTypes[number];

// Notification priority levels
export const notificationPriorities = ["low", "normal", "high", "urgent"] as const;
export type NotificationPriority = typeof notificationPriorities[number];

// Caregiver Notification
export interface CaregiverNotification {
  id: string;
  caregiverId: string;           // The caregiver receiving the notification
  profileId: string;             // The patient profile this relates to
  profileName: string;           // Patient name for display
  type: CaregiverNotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  actionUrl: string | null;      // Deep link to relevant page
  relatedEntityId: string | null; // ID of related appointment/medication/etc
  relatedEntityType: string | null;
  isRead: boolean;
  readAt: string | null;
  isDismissed: boolean;
  dismissedAt: string | null;
  expiresAt: string | null;      // Auto-dismiss after this time
  createdAt: string;
}

export const insertCaregiverNotificationSchema = z.object({
  caregiverId: z.string().min(1),
  profileId: z.string().min(1),
  profileName: z.string().min(1),
  type: z.enum(caregiverNotificationTypes),
  priority: z.enum(notificationPriorities).default("normal"),
  title: z.string().min(1),
  message: z.string().min(1),
  actionUrl: z.string().nullable().optional(),
  relatedEntityId: z.string().nullable().optional(),
  relatedEntityType: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

export type InsertCaregiverNotification = z.infer<typeof insertCaregiverNotificationSchema>;

// Notification Preferences for Caregivers
export interface CaregiverNotificationPreferences {
  id: string;
  caregiverId: string;
  profileId: string;             // Preferences per patient profile
  enabledTypes: CaregiverNotificationType[];
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  quietHoursStart: string | null; // e.g., "22:00"
  quietHoursEnd: string | null;   // e.g., "08:00"
  urgentOverrideQuietHours: boolean;
  createdAt: string;
  updatedAt: string;
}

export const insertCaregiverNotificationPreferencesSchema = z.object({
  caregiverId: z.string().min(1),
  profileId: z.string().min(1),
  enabledTypes: z.array(z.enum(caregiverNotificationTypes)).default([
    "appointment_reminder",
    "appointment_scheduled",
    "medication_added",
    "side_effect_severe",
    "emergency_alert",
  ]),
  emailNotifications: z.boolean().default(true),
  pushNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(false),
  quietHoursStart: z.string().nullable().optional(),
  quietHoursEnd: z.string().nullable().optional(),
  urgentOverrideQuietHours: z.boolean().default(true),
});

export type InsertCaregiverNotificationPreferences = z.infer<typeof insertCaregiverNotificationPreferencesSchema>;

// Caregiver Activity Entry - tracks what caregivers do for audit
export interface CaregiverActivityEntry {
  id: string;
  caregiverId: string;
  caregiverName: string;
  profileId: string;
  section: "cancer_track" | "side_effects_journal";
  action: "view" | "add" | "edit" | "delete";
  entityType: string;            // e.g., "timeline_entry", "symptom_entry"
  entityId: string;
  description: string;
  timestamp: string;
}

// Profile Member - links users to profiles with specific roles
export interface ProfileMember {
  id: string;
  profileId: string;
  userId: string;
  role: ProfileMemberRole;
  accessScopes: ProfileAccessScope[];  // Specific scopes if role is limited
  invitedBy: string | null;            // User who invited this member
  invitedAt: string | null;
  acceptedAt: string | null;
  expiresAt: string | null;            // For time-limited access
  isActive: boolean;
  lastAccessAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const insertProfileMemberSchema = z.object({
  profileId: z.string().min(1, "Profile ID is required"),
  userId: z.string().min(1, "User ID is required"),
  role: z.enum(profileMemberRoles),
  accessScopes: z.array(z.enum(profileAccessScopes)).default(["all"]),
  invitedBy: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

export type InsertProfileMember = z.infer<typeof insertProfileMemberSchema>;

// Profile Tag Association - links tags to profiles
export interface ProfileTagAssociation {
  id: string;
  profileId: string;
  tag: ProfileTag;
  addedBy: string;
  addedAt: string;
  notes: string | null;
  isActive: boolean;
}

export const insertProfileTagAssociationSchema = z.object({
  profileId: z.string().min(1),
  tag: z.enum(profileTags),
  addedBy: z.string().min(1),
  notes: z.string().nullable().optional(),
});

export type InsertProfileTagAssociation = z.infer<typeof insertProfileTagAssociationSchema>;

// Profile Share Link - time-limited sharing for clinicians
export interface ProfileShareLink {
  id: string;
  profileId: string;
  createdBy: string;
  token: string;                       // Unique secure token
  recipientEmail: string | null;       // Optional recipient email
  recipientName: string | null;
  accessScopes: ProfileAccessScope[];
  expiresAt: string;
  maxViews: number | null;             // Limit number of views
  viewCount: number;
  password: string | null;             // Optional password protection
  isActive: boolean;
  lastAccessedAt: string | null;
  createdAt: string;
}

export const insertProfileShareLinkSchema = z.object({
  profileId: z.string().min(1),
  createdBy: z.string().min(1),
  recipientEmail: z.string().email().nullable().optional(),
  recipientName: z.string().nullable().optional(),
  accessScopes: z.array(z.enum(profileAccessScopes)).default(["all"]),
  expiresAt: z.string(),
  maxViews: z.number().int().positive().nullable().optional(),
  password: z.string().min(4).nullable().optional(),
});

export type InsertProfileShareLink = z.infer<typeof insertProfileShareLinkSchema>;

// Break Glass Emergency Access - emergency access with PIN
export interface BreakGlassAccess {
  id: string;
  profileId: string;
  pin: string;                         // Hashed PIN
  isEnabled: boolean;
  accessDurationMinutes: number;       // How long access lasts once activated
  allowedScopes: ProfileAccessScope[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const insertBreakGlassAccessSchema = z.object({
  profileId: z.string().min(1),
  pin: z.string().min(4).max(8),
  accessDurationMinutes: z.number().int().min(5).max(480).default(30),
  allowedScopes: z.array(z.enum(profileAccessScopes)).default(["medications", "allergies", "diagnoses"]),
  createdBy: z.string().min(1),
});

export type InsertBreakGlassAccess = z.infer<typeof insertBreakGlassAccessSchema>;

// Break Glass Event - audit log for emergency access
export interface BreakGlassEvent {
  id: string;
  profileId: string;
  accessedBy: string;
  accessedByName: string;
  accessedByRole: string;
  reason: string;
  ipAddress: string | null;
  userAgent: string | null;
  scopesAccessed: ProfileAccessScope[];
  accessGrantedAt: string;
  accessExpiresAt: string;
  accessRevokedAt: string | null;
  revokedBy: string | null;
  revokeReason: string | null;
}

export const insertBreakGlassEventSchema = z.object({
  profileId: z.string().min(1),
  accessedBy: z.string().min(1),
  accessedByName: z.string().min(1),
  accessedByRole: z.string().min(1),
  reason: z.string().min(10, "Please provide a reason for emergency access"),
  ipAddress: z.string().nullable().optional(),
  userAgent: z.string().nullable().optional(),
  scopesAccessed: z.array(z.enum(profileAccessScopes)),
  accessExpiresAt: z.string(),
});

export type InsertBreakGlassEvent = z.infer<typeof insertBreakGlassEventSchema>;

// Profile Access Request - for requesting access to a profile
export interface ProfileAccessRequest {
  id: string;
  profileId: string;
  requestedBy: string;
  requestedByName: string;
  requestedRole: ProfileMemberRole;
  requestedScopes: ProfileAccessScope[];
  message: string | null;
  status: "pending" | "approved" | "denied" | "expired";
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  expiresAt: string;
  createdAt: string;
}

export const insertProfileAccessRequestSchema = z.object({
  profileId: z.string().min(1),
  requestedBy: z.string().min(1),
  requestedByName: z.string().min(1),
  requestedRole: z.enum(profileMemberRoles),
  requestedScopes: z.array(z.enum(profileAccessScopes)).default(["all"]),
  message: z.string().max(500).nullable().optional(),
  expiresAt: z.string().optional(),
});

export type InsertProfileAccessRequest = z.infer<typeof insertProfileAccessRequestSchema>;

// Extended Profile with type and tags for UI display
export interface ExtendedProfile extends Profile {
  profileType: ProfileTypeValue;
  tags: ProfileTag[];
  memberCount: number;
  pendingRequestCount: number;
  shareLinksCount: number;
  hasEmergencyAccess: boolean;
}

// Profile Member Summary for UI
export interface ProfileMemberSummary {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  profileImageUrl: string | null;
  role: ProfileMemberRole;
  accessScopes: ProfileAccessScope[];
  isActive: boolean;
  expiresAt: string | null;
  lastAccessAt: string | null;
}

// Two-Factor Authentication
export interface TwoFactorAuth {
  id: string;
  userId: string;
  secret: string;
  enabled: boolean;
  verifiedAt: string | null;
  backupCodes: string[];
  createdAt: string;
  updatedAt: string;
}

export const insertTwoFactorAuthSchema = z.object({
  userId: z.string().min(1),
  secret: z.string().min(1),
});

export type InsertTwoFactorAuth = z.infer<typeof insertTwoFactorAuthSchema>;

// User Session - for session management
export interface UserSession {
  id: string;
  userId: string;
  deviceInfo: string;
  ipAddress: string;
  userAgent: string;
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
  isCurrentSession: boolean;
}

export const insertUserSessionSchema = z.object({
  userId: z.string().min(1),
  deviceInfo: z.string().default("Unknown Device"),
  ipAddress: z.string().default("Unknown"),
  userAgent: z.string().default("Unknown"),
  expiresAt: z.string(),
});

export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;

// Security Audit Log
export const securityEventTypes = [
  "login",
  "logout",
  "new_device_login",
  "2fa_enabled",
  "2fa_disabled",
  "2fa_verified",
  "backup_code_used",
  "session_revoked",
  "password_changed",
  "account_locked",
  "account_unlocked",
  "caregiver_invited",
  "caregiver_removed",
  "security_alert",
  "role_changed",
  "permission_denied",
  "data_access",
  "data_export",
  "admin_action",
  "connection_start_clicked",
  "connection_auth_started",
  "connection_success",
  "connection_failed",
  "connection_expired",
  "sync_triggered",
  "sync_completed",
  "sync_failed",
  "sync_retry_clicked",
  "dedup_group_created",
  "dedup_conflict_detected",
  "dedup_user_viewed_provenance",
  "dedup_conflict_resolved",
  "timeline_opened",
  "timeline_filter_applied",
  "timeline_item_opened",
  "audit_export_requested",
  "audit_export_completed",
  "dq_dashboard_opened",
  "dq_member_score_viewed",
  "dq_issue_viewed",
  "dq_records_merged",
  "dq_duplicate_confirmed",
  "dq_issue_dismissed",
  "dq_audit_trail_viewed",
] as const;

export type SecurityEventType = typeof securityEventTypes[number];

// Analytics platform types
export const analyticsPlatforms = ["ios", "android", "web"] as const;
export type AnalyticsPlatform = typeof analyticsPlatforms[number];

export interface SecurityAuditLog {
  id: string;
  userId: string;
  profileId: string | null;
  eventType: SecurityEventType;
  description: string;
  ipAddress: string;
  userAgent: string;
  platform: AnalyticsPlatform;
  appVersion: string;
  source: string | null;
  connectionId: string | null;
  syncId: string | null;
  metadata: Record<string, string> | null;
  createdAt: string;
}

export const insertSecurityAuditLogSchema = z.object({
  userId: z.string().min(1),
  profileId: z.string().nullish(),
  eventType: z.enum(securityEventTypes),
  description: z.string(),
  ipAddress: z.string().default("Unknown"),
  userAgent: z.string().default("Unknown"),
  platform: z.enum(analyticsPlatforms).default("web"),
  appVersion: z.string().default("1.0.0"),
  source: z.string().nullish(),
  connectionId: z.string().nullish(),
  syncId: z.string().nullish(),
  metadata: z.record(z.string()).optional(),
});

export type InsertSecurityAuditLog = z.infer<typeof insertSecurityAuditLogSchema>;

// ============================================================================
// PAYER-COMPLIANT AUDIT EVENTS TABLE (Append-only)
// Meets SOC2/HIPAA/payer auditability requirements
// ============================================================================

export const auditEventActions = [
  // Authentication events
  "auth.login",
  "auth.logout",
  "auth.login_failed",
  "auth.mfa_enabled",
  "auth.mfa_disabled",
  "auth.password_changed",
  "auth.session_expired",
  // Data access events
  "data.read",
  "data.create",
  "data.update",
  "data.delete",
  "data.export",
  "data.share",
  // PHI-specific events
  "phi.accessed",
  "phi.viewed",
  "phi.downloaded",
  "phi.printed",
  "phi.shared",
  "phi.break_the_glass",
  // Administrative events
  "admin.user_created",
  "admin.user_modified",
  "admin.user_deleted",
  "admin.role_changed",
  "admin.permission_granted",
  "admin.permission_revoked",
  // Consent events
  "consent.granted",
  "consent.revoked",
  "consent.updated",
  // Integration events
  "integration.connected",
  "integration.disconnected",
  "integration.sync_started",
  "integration.sync_completed",
  "integration.sync_failed",
  // Security events
  "security.suspicious_activity",
  "security.rate_limited",
  "security.csrf_blocked",
  "security.unauthorized_access",
] as const;

export type AuditEventAction = typeof auditEventActions[number];

export const auditEventResults = ["success", "failure", "denied", "error"] as const;
export type AuditEventResult = typeof auditEventResults[number];

export const auditResourceTypes = [
  "user",
  "patient",
  "medical_record",
  "medication",
  "lab_result",
  "vital_sign",
  "appointment",
  "document",
  "consent",
  "ehr_connection",
  "caregiver",
  "message",
  "care_plan",
  "session",
  "api_key",
  "policy",
  "report",
  "export",
  "other",
] as const;

export type AuditResourceType = typeof auditResourceTypes[number];

/**
 * Payer-compliant audit event record
 * This table is APPEND-ONLY - no updates or deletes allowed
 * All entries are immutable for compliance purposes
 */
export interface AuditEvent {
  id: string;
  // Actor information (who performed the action)
  actorId: string;           // System/service ID if automated, user ID otherwise
  actorType: "user" | "system" | "service" | "automated";
  // Target user/profile (who was affected)
  userId: string | null;     // User whose data was affected (may be null for system events)
  profileId: string | null;  // Specific profile if applicable
  // Action details
  action: AuditEventAction;
  resourceType: AuditResourceType;
  resourceId: string | null;
  // Result
  result: AuditEventResult;
  resultReason: string | null; // Reason for failure/denial if applicable
  // Privacy-preserving identifiers (hashed for compliance)
  ipHash: string;            // SHA-256 hash of IP address
  userAgentHash: string;     // SHA-256 hash of user agent
  // Request context
  requestId: string | null;  // Correlation ID for request tracing
  sessionId: string | null;  // Session ID if applicable
  // Additional context
  metadata: Record<string, unknown> | null; // Flexible field for additional context
  // Timestamps
  timestamp: string;         // When the event occurred (ISO 8601)
  createdAt: string;         // When the record was created
  // Integrity
  previousHash: string | null; // Hash of previous record for chain integrity
  recordHash: string;        // Hash of this record for tamper detection
}

export const insertAuditEventSchema = z.object({
  actorId: z.string().min(1),
  actorType: z.enum(["user", "system", "service", "automated"]),
  userId: z.string().nullish(),
  profileId: z.string().nullish(),
  action: z.enum(auditEventActions),
  resourceType: z.enum(auditResourceTypes),
  resourceId: z.string().nullish(),
  result: z.enum(auditEventResults),
  resultReason: z.string().nullish(),
  ipHash: z.string().min(1),
  userAgentHash: z.string().min(1),
  requestId: z.string().nullish(),
  sessionId: z.string().nullish(),
  metadata: z.record(z.unknown()).optional(),
  timestamp: z.string().datetime().optional(),
});

export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;

// Security Notification - for alerting users about security events
export const securityNotificationTypes = [
  "new_login",
  "new_device",
  "unusual_location",
  "2fa_change",
  "session_activity",
  "security_recommendation",
] as const;

export type SecurityNotificationType = typeof securityNotificationTypes[number];

export interface SecurityNotification {
  id: string;
  userId: string;
  type: SecurityNotificationType;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  isRead: boolean;
  metadata: Record<string, string> | null;
  createdAt: string;
}

export const insertSecurityNotificationSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(securityNotificationTypes),
  title: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
  metadata: z.record(z.string()).optional(),
});

export type InsertSecurityNotification = z.infer<typeof insertSecurityNotificationSchema>;

// Security Settings - user preferences for security features
export interface SecuritySettings {
  id: string;
  userId: string;
  loginNotifications: boolean;
  newDeviceAlerts: boolean;
  sessionActivityAlerts: boolean;
  emailNotifications: boolean;
  createdAt: string;
  updatedAt: string;
}

export const insertSecuritySettingsSchema = z.object({
  userId: z.string().min(1),
  loginNotifications: z.boolean().default(true),
  newDeviceAlerts: z.boolean().default(true),
  sessionActivityAlerts: z.boolean().default(false),
  emailNotifications: z.boolean().default(true),
});

export type InsertSecuritySettings = z.infer<typeof insertSecuritySettingsSchema>;

// ============================================
// AI MEDICAL ASSISTANT
// ============================================

// Assistant Conversation - persistent chat sessions with the AI Medical Assistant
export interface AssistantConversation {
  id: string;
  userId: string;
  patientId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  messageCount: number;
  fingerprint: string | null;
  summary: string | null;
  mergedInto: string | null;
  tags: string[];
}

export const insertAssistantConversationSchema = z.object({
  userId: z.string().min(1),
  patientId: z.string().optional(),
  title: z.string().min(1).default("New Conversation"),
});

export type InsertAssistantConversation = z.infer<typeof insertAssistantConversationSchema>;

// Assistant Message - messages in a conversation with context and explainability
export const assistantMessageRoles = ["user", "assistant", "system"] as const;
export type AssistantMessageRole = typeof assistantMessageRoles[number];

export interface AssistantMessage {
  id: string;
  conversationId: string;
  role: AssistantMessageRole;
  content: string;
  audioUrl: string | null;
  metadata: {
    healthContext?: {
      medicationsReferenced?: string[];
      conditionsReferenced?: string[];
      labResultsReferenced?: string[];
      allergiesReferenced?: string[];
    };
    explainability?: {
      insightType: string;
      confidence: number;
      sources: string[];
      reasoning: string[];
    };
    language?: string;
    isVoice?: boolean;
  } | null;
  fingerprint: string | null;
  createdAt: string;
}

export const insertAssistantMessageSchema = z.object({
  conversationId: z.string().min(1),
  role: z.enum(assistantMessageRoles),
  content: z.string().min(1),
  audioUrl: z.string().optional(),
  metadata: z.object({
    healthContext: z.object({
      medicationsReferenced: z.array(z.string()).optional(),
      conditionsReferenced: z.array(z.string()).optional(),
      labResultsReferenced: z.array(z.string()).optional(),
      allergiesReferenced: z.array(z.string()).optional(),
    }).optional(),
    explainability: z.object({
      insightType: z.string(),
      confidence: z.number(),
      sources: z.array(z.string()),
      reasoning: z.array(z.string()),
    }).optional(),
    language: z.string().optional(),
    isVoice: z.boolean().optional(),
  }).optional(),
});

export type InsertAssistantMessage = z.infer<typeof insertAssistantMessageSchema>;

// Assistant Insight - AI-generated summaries and insights from conversation history
export const assistantInsightTypes = ["conversation_summary", "period_summary", "topic_insight", "health_trend"] as const;
export type AssistantInsightType = typeof assistantInsightTypes[number];

export interface AssistantInsight {
  id: string;
  userId: string;
  type: AssistantInsightType;
  title: string;
  content: string;
  conversationIds: string[];
  periodStart: string | null;
  periodEnd: string | null;
  topicsExtracted: string[];
  fingerprint: string | null;
  createdAt: string;
}

export const insertAssistantInsightSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(assistantInsightTypes),
  title: z.string().min(1),
  content: z.string().min(1),
  conversationIds: z.array(z.string()).default([]),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  topicsExtracted: z.array(z.string()).default([]),
});

export type InsertAssistantInsight = z.infer<typeof insertAssistantInsightSchema>;

// Suggested Questions - personalized suggestions based on patient health data
export interface SuggestedQuestion {
  id: string;
  category: "medications" | "conditions" | "labs" | "general" | "education";
  question: string;
  context: string;
  priority: number;
}

// ============================================
// PRIVACY BY DESIGN - GRANULAR CONSENT SYSTEM
// ============================================

// Data categories that can be shared
export const dataCategories = [
  "medications",
  "conditions",
  "allergies",
  "lab_results",
  "vital_signs",
  "documents",
  "appointments",
  "immunizations",
  "procedures",
  "imaging",
  "notes",
  "demographics",
  "insurance",
] as const;

export type DataCategory = typeof dataCategories[number];

// Human-readable labels for data categories
export const dataCategoryLabels: Record<DataCategory, { label: string; description: string }> = {
  medications: { label: "Medications", description: "Current and past medications, dosages, and prescriptions" },
  conditions: { label: "Conditions & Diagnoses", description: "Medical conditions, diagnoses, and problems" },
  allergies: { label: "Allergies", description: "Drug, food, and environmental allergies" },
  lab_results: { label: "Lab Results", description: "Blood tests, urinalysis, and other laboratory results" },
  vital_signs: { label: "Vital Signs", description: "Blood pressure, heart rate, temperature, weight" },
  documents: { label: "Medical Documents", description: "Clinical notes, discharge summaries, and reports" },
  appointments: { label: "Appointments", description: "Past and upcoming medical appointments" },
  immunizations: { label: "Immunizations", description: "Vaccination history and records" },
  procedures: { label: "Procedures", description: "Surgical and medical procedures performed" },
  imaging: { label: "Imaging Studies", description: "X-rays, MRIs, CT scans, and ultrasounds" },
  notes: { label: "Clinical Notes", description: "Provider notes and visit summaries" },
  demographics: { label: "Demographics", description: "Name, address, phone, email, and date of birth" },
  insurance: { label: "Insurance Information", description: "Insurance provider, policy number, and coverage" },
};

// Recipient types for sharing
export const recipientTypes = ["doctor", "caregiver", "payer", "facility", "researcher", "other"] as const;
export type RecipientType = typeof recipientTypes[number];

export const recipientTypeLabels: Record<RecipientType, string> = {
  doctor: "Healthcare Provider",
  caregiver: "Family Caregiver",
  payer: "Insurance/Payer",
  facility: "Healthcare Facility",
  researcher: "Research Organization",
  other: "Other",
};

// Access levels for sharing
export const accessLevels = ["none", "read", "read_write", "full"] as const;
export type AccessLevel = typeof accessLevels[number];

export const accessLevelLabels: Record<AccessLevel, { label: string; description: string }> = {
  none: { label: "No Access", description: "Cannot view this data" },
  read: { label: "View Only", description: "Can view but not modify data" },
  read_write: { label: "View & Edit", description: "Can view and add notes/comments" },
  full: { label: "Full Access", description: "Complete access including download and sharing" },
};

// Sharing Recipient - someone the patient shares data with
export interface SharingRecipient {
  id: string;
  patientUserId: string; // The patient who created this recipient
  recipientType: RecipientType;
  name: string;
  organization?: string;
  email?: string;
  phone?: string;
  npi?: string; // National Provider Identifier for healthcare providers
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const insertSharingRecipientSchema = z.object({
  patientUserId: z.string().min(1),
  recipientType: z.enum(recipientTypes),
  name: z.string().min(1),
  organization: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  npi: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type InsertSharingRecipient = z.infer<typeof insertSharingRecipientSchema>;

// Data Sharing Consent - granular consent for specific data categories
export interface DataSharingConsent {
  id: string;
  patientUserId: string; // The patient granting consent
  recipientId: string; // The SharingRecipient who receives access
  dataCategory: DataCategory;
  accessLevel: AccessLevel;
  purpose?: string; // Why this data is being shared
  expiresAt?: string; // Optional expiration date
  isActive: boolean;
  grantedAt: string;
  revokedAt?: string;
  lastAccessedAt?: string;
  accessCount: number;
  createdAt: string;
  updatedAt: string;
}

export const insertDataSharingConsentSchema = z.object({
  patientUserId: z.string().min(1),
  recipientId: z.string().min(1),
  dataCategory: z.enum(dataCategories),
  accessLevel: z.enum(accessLevels).default("read"),
  purpose: z.string().optional(),
  expiresAt: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type InsertDataSharingConsent = z.infer<typeof insertDataSharingConsentSchema>;

// Default Sharing Policy - patient's default sharing preferences
export interface DefaultSharingPolicy {
  id: string;
  patientUserId: string;
  recipientType: RecipientType;
  dataCategory: DataCategory;
  defaultAccessLevel: AccessLevel;
  autoApprove: boolean; // Auto-approve new recipients of this type
  createdAt: string;
  updatedAt: string;
}

export const insertDefaultSharingPolicySchema = z.object({
  patientUserId: z.string().min(1),
  recipientType: z.enum(recipientTypes),
  dataCategory: z.enum(dataCategories),
  defaultAccessLevel: z.enum(accessLevels).default("none"),
  autoApprove: z.boolean().default(false),
});

export type InsertDefaultSharingPolicy = z.infer<typeof insertDefaultSharingPolicySchema>;

// Consent Audit Log - tracks all consent changes
export interface ConsentAuditLog {
  id: string;
  patientUserId: string;
  recipientId?: string;
  action: "grant" | "revoke" | "modify" | "access" | "export" | "policy_update";
  dataCategory?: DataCategory;
  previousAccessLevel?: AccessLevel;
  newAccessLevel?: AccessLevel;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export const insertConsentAuditLogSchema = z.object({
  patientUserId: z.string().min(1),
  recipientId: z.string().optional(),
  action: z.enum(["grant", "revoke", "modify", "access", "export", "policy_update"]),
  dataCategory: z.enum(dataCategories).optional(),
  previousAccessLevel: z.enum(accessLevels).optional(),
  newAccessLevel: z.enum(accessLevels).optional(),
  reason: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export type InsertConsentAuditLog = z.infer<typeof insertConsentAuditLogSchema>;

// Consent Summary - aggregated view of sharing status
export interface ConsentSummary {
  recipientId: string;
  recipientName: string;
  recipientType: RecipientType;
  organization?: string;
  categoriesShared: number;
  totalCategories: number;
  lastAccessed?: string;
  isActive: boolean;
}

// Privacy Dashboard Stats
export interface PrivacyDashboardStats {
  totalRecipients: number;
  activeRecipients: number;
  totalConsentsGranted: number;
  categoriesWithFullAccess: number;
  recentAccessCount: number; // Last 30 days
  pendingRequests: number;
  expiringConsents: number; // Consents expiring in 30 days
}

// ============================================
// CONSENT DOCUMENTS & VERSIONING (GDPR/HIPAA)
// ============================================

export const consentDocumentTypes = [
  "privacy_policy",
  "terms_of_service", 
  "hipaa_notice",
  "data_processing_agreement",
  "research_consent",
  "marketing_consent",
] as const;
export type ConsentDocumentType = typeof consentDocumentTypes[number];

export const consentDocumentTypeLabels: Record<ConsentDocumentType, { label: string; description: string }> = {
  privacy_policy: { label: "Privacy Policy", description: "How we collect, use, and protect your personal information" },
  terms_of_service: { label: "Terms of Service", description: "Terms and conditions for using Tabula Medica" },
  hipaa_notice: { label: "HIPAA Notice of Privacy Practices", description: "Your rights regarding protected health information" },
  data_processing_agreement: { label: "Data Processing Agreement", description: "How your health data is processed and stored" },
  research_consent: { label: "Research Participation", description: "Optional consent for de-identified research use" },
  marketing_consent: { label: "Marketing Communications", description: "Optional consent for promotional communications" },
};

// Consent Document - versioned legal/compliance documents
export interface ConsentDocument {
  id: string;
  type: ConsentDocumentType;
  version: string; // Semantic versioning: "1.0.0", "1.1.0", etc.
  title: string;
  summary: string; // Plain-language summary
  content: string; // Full document content (markdown)
  effectiveDate: string;
  expirationDate?: string; // Optional expiration for time-limited consents
  isRequired: boolean; // Required for app usage
  isActive: boolean; // Currently active version
  previousVersionId?: string; // Link to previous version
  createdAt: string;
  updatedAt: string;
}

export const insertConsentDocumentSchema = z.object({
  type: z.enum(consentDocumentTypes),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must be in semantic versioning format (e.g., 1.0.0)"),
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(1000),
  content: z.string().min(1),
  effectiveDate: z.string(),
  expirationDate: z.string().optional(),
  isRequired: z.boolean().default(true),
  isActive: z.boolean().default(true),
  previousVersionId: z.string().optional(),
});

export type InsertConsentDocument = z.infer<typeof insertConsentDocumentSchema>;

// User Consent Record - tracks individual user acceptances
export interface UserConsentRecord {
  id: string;
  userId: string;
  documentId: string;
  documentType: ConsentDocumentType;
  documentVersion: string;
  status: "accepted" | "declined" | "withdrawn" | "expired";
  acceptedAt?: string;
  declinedAt?: string;
  withdrawnAt?: string;
  expiresAt?: string; // For time-limited consents
  ipAddress?: string;
  userAgent?: string;
  method: "click" | "signature" | "verbal" | "written";
  metadata?: Record<string, unknown>; // Additional context (e.g., guardian consent)
  createdAt: string;
  updatedAt: string;
}

export const insertUserConsentRecordSchema = z.object({
  userId: z.string().min(1),
  documentId: z.string().min(1),
  documentType: z.enum(consentDocumentTypes),
  documentVersion: z.string(),
  status: z.enum(["accepted", "declined", "withdrawn", "expired"]),
  acceptedAt: z.string().optional(),
  declinedAt: z.string().optional(),
  withdrawnAt: z.string().optional(),
  expiresAt: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  method: z.enum(["click", "signature", "verbal", "written"]).default("click"),
  metadata: z.record(z.unknown()).optional(),
});

export type InsertUserConsentRecord = z.infer<typeof insertUserConsentRecordSchema>;

// Consent Analytics Event Types
export const consentAnalyticsEvents = [
  "consent_viewed",
  "consent_accepted",
  "consent_declined",
  "consent_withdrawn",
  "consent_expired",
  "consent_reminder_sent",
] as const;
export type ConsentAnalyticsEvent = typeof consentAnalyticsEvents[number];

// Consent Analytics Record
export interface ConsentAnalyticsRecord {
  id: string;
  userId?: string; // Optional for anonymous views
  documentId: string;
  documentType: ConsentDocumentType;
  documentVersion: string;
  event: ConsentAnalyticsEvent;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export const insertConsentAnalyticsRecordSchema = z.object({
  userId: z.string().optional(),
  documentId: z.string().min(1),
  documentType: z.enum(consentDocumentTypes),
  documentVersion: z.string(),
  event: z.enum(consentAnalyticsEvents),
  metadata: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export type InsertConsentAnalyticsRecord = z.infer<typeof insertConsentAnalyticsRecordSchema>;

// User Consent Status Summary
export interface UserConsentStatus {
  userId: string;
  requiredConsentsGiven: boolean;
  missingRequiredConsents: ConsentDocumentType[];
  allConsents: {
    documentType: ConsentDocumentType;
    documentVersion: string;
    status: "accepted" | "declined" | "withdrawn" | "expired" | "pending";
    acceptedAt?: string;
    expiresAt?: string;
    needsRenewal: boolean;
  }[];
  canConnectSources: boolean; // All required consents accepted
  lastUpdated: string;
}

// ============================================
// DE-IDENTIFICATION PIPELINE FOR RESEARCH
// ============================================

// HIPAA Safe Harbor - 18 Identifier Types
export const phiIdentifiers = [
  "names",
  "geographic_subdivisions", // Smaller than state
  "dates", // Except year for ages under 90
  "phone_numbers",
  "fax_numbers",
  "email_addresses",
  "ssn", // Social Security Numbers
  "mrn", // Medical Record Numbers
  "health_plan_beneficiary",
  "account_numbers",
  "certificate_license_numbers",
  "vehicle_identifiers",
  "device_identifiers",
  "web_urls",
  "ip_addresses",
  "biometric_identifiers",
  "full_face_photos",
  "unique_identifying_codes",
] as const;

export type PhiIdentifier = typeof phiIdentifiers[number];

export const phiIdentifierLabels: Record<PhiIdentifier, { label: string; description: string }> = {
  names: { label: "Names", description: "Patient names, relative names, employer names" },
  geographic_subdivisions: { label: "Geographic Data", description: "Street address, city, zip code (smaller than state)" },
  dates: { label: "Dates", description: "Birth date, admission date, discharge date, death date (except year)" },
  phone_numbers: { label: "Phone Numbers", description: "All telephone numbers" },
  fax_numbers: { label: "Fax Numbers", description: "All fax numbers" },
  email_addresses: { label: "Email Addresses", description: "All email addresses" },
  ssn: { label: "Social Security Numbers", description: "Social Security Numbers" },
  mrn: { label: "Medical Record Numbers", description: "Medical record numbers and health record IDs" },
  health_plan_beneficiary: { label: "Health Plan Numbers", description: "Health plan beneficiary numbers" },
  account_numbers: { label: "Account Numbers", description: "Bank account, credit card numbers" },
  certificate_license_numbers: { label: "License Numbers", description: "Certificate and license numbers" },
  vehicle_identifiers: { label: "Vehicle Identifiers", description: "Vehicle identifiers and serial numbers" },
  device_identifiers: { label: "Device Identifiers", description: "Medical device identifiers and serial numbers" },
  web_urls: { label: "Web URLs", description: "Website URLs" },
  ip_addresses: { label: "IP Addresses", description: "Internet Protocol addresses" },
  biometric_identifiers: { label: "Biometric Identifiers", description: "Fingerprints, voice prints, retinal scans" },
  full_face_photos: { label: "Full-Face Photos", description: "Full-face photographs and comparable images" },
  unique_identifying_codes: { label: "Unique Codes", description: "Any other unique identifying number or code" },
};

// De-identification methods
export const deidentificationMethods = ["safe_harbor", "expert_determination", "limited_dataset"] as const;
export type DeidentificationMethod = typeof deidentificationMethods[number];

export const deidentificationMethodLabels: Record<DeidentificationMethod, { label: string; description: string }> = {
  safe_harbor: { 
    label: "Safe Harbor", 
    description: "Removes all 18 HIPAA-specified identifiers. Most conservative approach." 
  },
  expert_determination: { 
    label: "Expert Determination", 
    description: "Statistical/scientific method to ensure very small re-identification risk." 
  },
  limited_dataset: { 
    label: "Limited Data Set", 
    description: "Removes direct identifiers but allows dates and geographic data. Requires Data Use Agreement." 
  },
};

// De-identification job statuses
export const deidentificationStatuses = ["pending", "processing", "completed", "failed", "expired"] as const;
export type DeidentificationStatus = typeof deidentificationStatuses[number];

// Research purposes for de-identified data
export const researchPurposes = [
  "population_health",
  "clinical_research",
  "quality_improvement",
  "public_health",
  "health_economics",
  "medical_education",
  "drug_safety",
  "epidemiology",
] as const;
export type ResearchPurpose = typeof researchPurposes[number];

export const researchPurposeLabels: Record<ResearchPurpose, string> = {
  population_health: "Population Health Analytics",
  clinical_research: "Clinical Research Studies",
  quality_improvement: "Quality Improvement Programs",
  public_health: "Public Health Reporting",
  health_economics: "Health Economics & Outcomes",
  medical_education: "Medical Education",
  drug_safety: "Drug Safety Surveillance",
  epidemiology: "Epidemiological Studies",
};

// De-identification Configuration
export interface DeidentificationConfig {
  id: string;
  patientUserId: string;
  method: DeidentificationMethod;
  purpose: ResearchPurpose;
  dataCategories: DataCategory[]; // Which data to include
  retainFields?: string[]; // Specific fields to retain (for limited dataset)
  excludeFields?: string[]; // Additional fields to exclude
  dateShiftDays?: number; // For date shifting (0-365)
  ageThreshold?: number; // Ages above this are generalized (default 89)
  zipCodeTruncation?: number; // Digits to keep (0-3)
  monetizationConsent: boolean; // Patient consented to monetization
  createdAt: string;
  updatedAt: string;
}

export const insertDeidentificationConfigSchema = z.object({
  patientUserId: z.string().min(1),
  method: z.enum(deidentificationMethods),
  purpose: z.enum(researchPurposes),
  dataCategories: z.array(z.enum(dataCategories)).min(1),
  retainFields: z.array(z.string()).optional(),
  excludeFields: z.array(z.string()).optional(),
  dateShiftDays: z.number().min(0).max(365).optional(),
  ageThreshold: z.number().min(80).max(100).default(89),
  zipCodeTruncation: z.number().min(0).max(3).default(3),
  monetizationConsent: z.boolean().default(false),
});

export type InsertDeidentificationConfig = z.infer<typeof insertDeidentificationConfigSchema>;

// De-identified Dataset - tracks generated datasets
export interface DeidentifiedDataset {
  id: string;
  configId: string;
  patientUserId: string;
  method: DeidentificationMethod;
  purpose: ResearchPurpose;
  status: DeidentificationStatus;
  recordCount: number;
  dataCategories: DataCategory[];
  hashSalt: string; // For consistent pseudonymization
  expiresAt?: string; // When dataset should be deleted
  downloadCount: number;
  lastDownloadedAt?: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export const insertDeidentifiedDatasetSchema = z.object({
  configId: z.string().min(1),
  patientUserId: z.string().min(1),
  method: z.enum(deidentificationMethods),
  purpose: z.enum(researchPurposes),
  status: z.enum(deidentificationStatuses).default("pending"),
  recordCount: z.number().min(0).default(0),
  dataCategories: z.array(z.enum(dataCategories)),
  hashSalt: z.string().min(1),
  expiresAt: z.string().optional(),
});

export type InsertDeidentifiedDataset = z.infer<typeof insertDeidentifiedDatasetSchema>;

// De-identification Audit Log - tracks all de-id operations
export interface DeidentificationAuditLog {
  id: string;
  datasetId: string;
  patientUserId: string;
  action: "create" | "process" | "complete" | "download" | "delete" | "expire";
  accessorId?: string; // Who downloaded/accessed
  accessorType?: "researcher" | "organization" | "api";
  accessorName?: string;
  recordsProcessed?: number;
  fieldsRemoved?: PhiIdentifier[];
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export const insertDeidentificationAuditLogSchema = z.object({
  datasetId: z.string().min(1),
  patientUserId: z.string().min(1),
  action: z.enum(["create", "process", "complete", "download", "delete", "expire"]),
  accessorId: z.string().optional(),
  accessorType: z.enum(["researcher", "organization", "api"]).optional(),
  accessorName: z.string().optional(),
  recordsProcessed: z.number().optional(),
  fieldsRemoved: z.array(z.enum(phiIdentifiers)).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export type InsertDeidentificationAuditLog = z.infer<typeof insertDeidentificationAuditLogSchema>;

// Patient Research Preferences
export interface ResearchPreferences {
  id: string;
  patientUserId: string;
  allowResearch: boolean;
  allowMonetization: boolean;
  preferredMethod: DeidentificationMethod;
  allowedPurposes: ResearchPurpose[];
  excludedCategories: DataCategory[];
  requireNotification: boolean; // Notify when data is used
  createdAt: string;
  updatedAt: string;
}

export const insertResearchPreferencesSchema = z.object({
  patientUserId: z.string().min(1),
  allowResearch: z.boolean().default(false),
  allowMonetization: z.boolean().default(false),
  preferredMethod: z.enum(deidentificationMethods).default("safe_harbor"),
  allowedPurposes: z.array(z.enum(researchPurposes)).default([]),
  excludedCategories: z.array(z.enum(dataCategories)).default([]),
  requireNotification: z.boolean().default(true),
});

export type InsertResearchPreferences = z.infer<typeof insertResearchPreferencesSchema>;

// Research Data Usage Summary
export interface ResearchDataUsageSummary {
  totalDatasetsGenerated: number;
  totalRecordsShared: number;
  totalDownloads: number;
  revenueGenerated?: number; // If monetized
  purposeBreakdown: Record<ResearchPurpose, number>;
  lastUsedAt?: string;
}

// ============================================
// AI-POWERED MEDICATION MANAGEMENT
// ============================================

// Medication Reminder Schedule
export const reminderFrequencies = ["once_daily", "twice_daily", "three_times_daily", "four_times_daily", "weekly", "as_needed", "custom"] as const;
export type ReminderFrequency = typeof reminderFrequencies[number];

export const reminderStatuses = ["active", "snoozed", "completed", "skipped", "missed"] as const;
export type ReminderStatus = typeof reminderStatuses[number];

export interface MedicationReminder {
  id: string;
  patientId: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  frequency: ReminderFrequency;
  scheduledTimes: string[]; // Array of times like ["08:00", "20:00"]
  aiGeneratedMessage?: string; // AI-personalized reminder message
  isActive: boolean;
  notifyViaApp: boolean;
  notifyViaPush: boolean;
  createdAt: string;
  updatedAt: string;
}

export const insertMedicationReminderSchema = z.object({
  patientId: z.string().min(1),
  medicationId: z.string().min(1),
  medicationName: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.enum(reminderFrequencies),
  scheduledTimes: z.array(z.string()),
  aiGeneratedMessage: z.string().optional(),
  isActive: z.boolean().default(true),
  notifyViaApp: z.boolean().default(true),
  notifyViaPush: z.boolean().default(false),
});

export type InsertMedicationReminder = z.infer<typeof insertMedicationReminderSchema>;

// Missed Dose Reason Categories
export const missedDoseReasons = [
  "forgot",
  "side_effects", 
  "felt_better",
  "ran_out",
  "cost",
  "away_from_home",
  "sleeping",
  "busy",
  "confused_instructions",
  "intentional_skip",
  "other"
] as const;
export type MissedDoseReason = typeof missedDoseReasons[number];

// Medication Adherence Record - tracks when patients take/skip medications
export interface MedicationAdherenceRecord {
  id: string;
  patientId: string;
  medicationId: string;
  medicationName: string;
  reminderId?: string;
  scheduledTime: string;
  action: "taken" | "skipped" | "delayed" | "missed";
  takenAt?: string; // Actual time taken if different from scheduled
  missedReason?: MissedDoseReason;
  missedReasonDetails?: string; // User-provided details
  notes?: string;
  createdAt: string;
}

export const insertMedicationAdherenceRecordSchema = z.object({
  patientId: z.string().min(1),
  medicationId: z.string().min(1),
  medicationName: z.string().min(1),
  reminderId: z.string().optional(),
  scheduledTime: z.string().min(1),
  action: z.enum(["taken", "skipped", "delayed", "missed"]),
  takenAt: z.string().optional(),
  missedReason: z.enum(missedDoseReasons).optional(),
  missedReasonDetails: z.string().optional(),
  notes: z.string().optional(),
});

export type InsertMedicationAdherenceRecord = z.infer<typeof insertMedicationAdherenceRecordSchema>;

// Adherence Coaching Session - AI-powered personalized coaching
export interface AdherenceCoachingSession {
  id: string;
  patientId: string;
  medicationId?: string;
  medicationName?: string;
  sessionType: "barrier_analysis" | "motivation" | "habit_building" | "problem_solving" | "check_in";
  triggerReason: string; // What triggered this coaching session
  patientInput?: string; // User's description of their situation
  aiAnalysis: string; // AI's analysis of the situation
  recommendations: string[];
  actionPlan: string[];
  motivationalMessage: string;
  followUpDate?: string;
  isCompleted: boolean;
  createdAt: string;
  completedAt?: string;
}

export const insertAdherenceCoachingSessionSchema = z.object({
  patientId: z.string().min(1),
  medicationId: z.string().optional(),
  medicationName: z.string().optional(),
  sessionType: z.enum(["barrier_analysis", "motivation", "habit_building", "problem_solving", "check_in"]),
  triggerReason: z.string().min(1),
  patientInput: z.string().optional(),
  aiAnalysis: z.string().min(1),
  recommendations: z.array(z.string()),
  actionPlan: z.array(z.string()),
  motivationalMessage: z.string().min(1),
  followUpDate: z.string().optional(),
});

export type InsertAdherenceCoachingSession = z.infer<typeof insertAdherenceCoachingSessionSchema>;

// Adherence Pattern Analysis - aggregated insights from missed dose patterns  
export interface AdherencePatternAnalysis {
  patientId: string;
  medicationId?: string;
  analysisDate: string;
  topMissedReasons: { reason: MissedDoseReason; count: number; percentage: number }[];
  timePatterns: { timeOfDay: string; missedCount: number }[];
  dayPatterns: { dayOfWeek: string; missedCount: number }[];
  streakHistory: { startDate: string; endDate: string; length: number }[];
  riskFactors: string[];
  suggestedInterventions: string[];
}

// Adherence Statistics - computed metrics
export interface AdherenceStatistics {
  patientId: string;
  medicationId?: string; // If null, overall stats
  periodStart: string;
  periodEnd: string;
  totalScheduled: number;
  totalTaken: number;
  totalSkipped: number;
  totalMissed: number;
  totalDelayed: number;
  adherenceRate: number; // Percentage 0-100
  streak: number; // Current consecutive days of adherence
  longestStreak: number;
  averageDelayMinutes?: number;
}

// Drug Interaction Severity Levels
export const interactionSeverities = ["minor", "moderate", "major", "contraindicated"] as const;
export type InteractionSeverity = typeof interactionSeverities[number];

// Drug Interaction Detection Result
export interface DrugInteraction {
  id: string;
  medication1Id: string;
  medication1Name: string;
  medication2Id: string;
  medication2Name: string;
  severity: InteractionSeverity;
  description: string;
  clinicalEffects: string;
  recommendation: string;
  source: string; // Where the interaction info came from
  aiConfidence: number; // 0-100 confidence score
  detectedAt: string;
  acknowledgedAt?: string; // When patient viewed/acknowledged
  acknowledgedBy?: string;
}

export const insertDrugInteractionSchema = z.object({
  medication1Id: z.string().min(1),
  medication1Name: z.string().min(1),
  medication2Id: z.string().min(1),
  medication2Name: z.string().min(1),
  severity: z.enum(interactionSeverities),
  description: z.string().min(1),
  clinicalEffects: z.string().min(1),
  recommendation: z.string().min(1),
  source: z.string().default("AI Analysis"),
  aiConfidence: z.number().min(0).max(100),
});

export type InsertDrugInteraction = z.infer<typeof insertDrugInteractionSchema>;

// Medication AI Insights - AI-generated analysis
export interface MedicationAIInsight {
  id: string;
  patientId: string;
  insightType: "adherence_trend" | "interaction_alert" | "refill_reminder" | "timing_optimization" | "general_tip";
  title: string;
  message: string;
  priority: "low" | "medium" | "high" | "urgent";
  relatedMedications: string[];
  actionable: boolean;
  actionText?: string;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
  expiresAt?: string;
}

export const insertMedicationAIInsightSchema = z.object({
  patientId: z.string().min(1),
  insightType: z.enum(["adherence_trend", "interaction_alert", "refill_reminder", "timing_optimization", "general_tip"]),
  title: z.string().min(1),
  message: z.string().min(1),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  relatedMedications: z.array(z.string()),
  actionable: z.boolean().default(false),
  actionText: z.string().optional(),
});

export type InsertMedicationAIInsight = z.infer<typeof insertMedicationAIInsightSchema>;

// ============================================
// AI HEALTH INSIGHTS & COACHING
// ============================================

// Risk Assessment Categories
export const riskCategories = ["cardiovascular", "metabolic", "respiratory", "mental_health", "chronic_disease", "lifestyle", "medication", "preventive_care"] as const;
export type RiskCategory = typeof riskCategories[number];

// Risk Levels
export const riskLevels = ["low", "moderate", "elevated", "high"] as const;
export type RiskLevel = typeof riskLevels[number];

// Health Risk Assessment - Proactive risk identification
export interface HealthRiskAssessment {
  id: string;
  patientId: string;
  category: RiskCategory;
  riskLevel: RiskLevel;
  riskScore: number; // 0-100
  title: string;
  description: string;
  riskFactors: string[]; // Contributing factors
  recommendations: string[];
  evidenceBasis: string[]; // Data points used for assessment
  aiConfidence: number; // 0-100
  isAcknowledged: boolean;
  createdAt: string;
  expiresAt?: string;
}

export const insertHealthRiskAssessmentSchema = z.object({
  patientId: z.string().min(1),
  category: z.enum(riskCategories),
  riskLevel: z.enum(riskLevels),
  riskScore: z.number().min(0).max(100),
  title: z.string().min(1),
  description: z.string().min(1),
  riskFactors: z.array(z.string()),
  recommendations: z.array(z.string()),
  evidenceBasis: z.array(z.string()),
  aiConfidence: z.number().min(0).max(100),
});

export type InsertHealthRiskAssessment = z.infer<typeof insertHealthRiskAssessmentSchema>;

// Coaching Goal Types
export const coachingGoalTypes = ["medication_adherence", "vital_monitoring", "lifestyle", "preventive_care", "condition_management", "mental_wellness"] as const;
export type CoachingGoalType = typeof coachingGoalTypes[number];

// AI Health Coaching Session
export interface HealthCoachingSession {
  id: string;
  patientId: string;
  goalType: CoachingGoalType;
  title: string;
  currentGoal: string;
  progress: number; // 0-100
  milestones: CoachingMilestone[];
  aiRecommendations: string[];
  personalizedTips: string[];
  lastInteraction: string;
  nextCheckIn?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CoachingMilestone {
  id: string;
  title: string;
  description: string;
  targetDate?: string;
  completedAt?: string;
  isCompleted: boolean;
}

export const insertHealthCoachingSessionSchema = z.object({
  patientId: z.string().min(1),
  goalType: z.enum(coachingGoalTypes),
  title: z.string().min(1),
  currentGoal: z.string().min(1),
  aiRecommendations: z.array(z.string()),
  personalizedTips: z.array(z.string()),
});

export type InsertHealthCoachingSession = z.infer<typeof insertHealthCoachingSessionSchema>;

// Population Health Trend (de-identified aggregate data)
export interface PopulationHealthTrend {
  id: string;
  trendType: "condition_prevalence" | "medication_usage" | "vital_trend" | "adherence_pattern" | "seasonal_pattern" | "outbreak_indicator";
  title: string;
  description: string;
  dataPoints: number; // Number of de-identified records analyzed
  timeRange: string; // e.g., "last_30_days"
  significance: "informational" | "noteworthy" | "significant" | "critical";
  relatedConditions?: string[];
  relatedMedications?: string[];
  percentageChange?: number;
  comparisonPeriod?: string;
  detectedAt: string;
  isActive: boolean;
}

export const insertPopulationHealthTrendSchema = z.object({
  trendType: z.enum(["condition_prevalence", "medication_usage", "vital_trend", "adherence_pattern", "seasonal_pattern", "outbreak_indicator"]),
  title: z.string().min(1),
  description: z.string().min(1),
  dataPoints: z.number().min(0),
  timeRange: z.string(),
  significance: z.enum(["informational", "noteworthy", "significant", "critical"]),
  relatedConditions: z.array(z.string()).optional(),
  relatedMedications: z.array(z.string()).optional(),
  percentageChange: z.number().optional(),
  comparisonPeriod: z.string().optional(),
});

export type InsertPopulationHealthTrend = z.infer<typeof insertPopulationHealthTrendSchema>;

// Personalized Health Insight
export interface PersonalizedHealthInsight {
  id: string;
  patientId: string;
  insightType: "trend_alert" | "coaching_tip" | "risk_update" | "achievement" | "recommendation" | "reminder";
  category: RiskCategory | "general";
  title: string;
  message: string;
  priority: "low" | "medium" | "high" | "urgent";
  actionRequired: boolean;
  actionText?: string;
  actionLink?: string;
  relatedData: { type: string; id: string; label: string }[];
  aiConfidence: number;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
  expiresAt?: string;
}

export const insertPersonalizedHealthInsightSchema = z.object({
  patientId: z.string().min(1),
  insightType: z.enum(["trend_alert", "coaching_tip", "risk_update", "achievement", "recommendation", "reminder"]),
  category: z.union([z.enum(riskCategories), z.literal("general")]),
  title: z.string().min(1),
  message: z.string().min(1),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  actionRequired: z.boolean().default(false),
  actionText: z.string().optional(),
  actionLink: z.string().optional(),
  relatedData: z.array(z.object({
    type: z.string(),
    id: z.string(),
    label: z.string(),
  })).default([]),
  aiConfidence: z.number().min(0).max(100),
});

export type InsertPersonalizedHealthInsight = z.infer<typeof insertPersonalizedHealthInsightSchema>;

// ============================================
// PREDICTIVE HEALTH ANALYTICS
// ============================================

// Prediction timeframes
export const predictionTimeframes = ["30_days", "90_days", "6_months", "1_year"] as const;
export type PredictionTimeframe = typeof predictionTimeframes[number];

// Prediction confidence levels
export const predictionConfidenceLevels = ["low", "moderate", "high", "very_high"] as const;
export type PredictionConfidenceLevel = typeof predictionConfidenceLevels[number];

// Data source types for predictions
export const predictionDataSources = ["conditions", "medications", "labs", "vitals", "proms", "triage", "family_history", "lifestyle"] as const;
export type PredictionDataSource = typeof predictionDataSources[number];

// Intervention urgency levels
export const interventionUrgencyLevels = ["routine", "soon", "priority", "urgent", "critical"] as const;
export type InterventionUrgency = typeof interventionUrgencyLevels[number];

// Predictive Risk Forecast - AI-generated future risk predictions
export interface PredictiveRiskForecast {
  id: string;
  patientId: string;
  category: RiskCategory;
  forecastType: "risk_progression" | "condition_onset" | "complication_risk" | "hospitalization_risk" | "adverse_event";
  title: string;
  description: string;
  
  // Current state
  currentRiskScore: number; // 0-100
  currentRiskLevel: RiskLevel;
  
  // Predicted future state
  predictedRiskScore: number; // 0-100
  predictedRiskLevel: RiskLevel;
  timeframe: PredictionTimeframe;
  predictedDate: string; // When the prediction is for
  
  // Risk trajectory
  riskTrajectory: "improving" | "stable" | "worsening" | "rapidly_worsening";
  trajectoryConfidence: number; // 0-100
  
  // Contributing factors with impact scores
  riskFactors: PredictiveRiskFactor[];
  
  // Protective factors that reduce risk
  protectiveFactors: PredictiveRiskFactor[];
  
  // AI-generated interventions
  recommendedInterventions: RecommendedIntervention[];
  
  // Data sources used
  dataSources: PredictionDataSource[];
  dataPointsAnalyzed: number;
  
  // Confidence and model info
  predictionConfidence: PredictionConfidenceLevel;
  confidenceScore: number; // 0-100
  modelVersion: string;
  
  // Audit trail
  generatedAt: string;
  expiresAt: string;
  isActive: boolean;
  isAcknowledgedByProvider: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

// Risk factor with quantified impact
export interface PredictiveRiskFactor {
  name: string;
  category: PredictionDataSource;
  impact: "low" | "moderate" | "significant" | "major";
  impactScore: number; // -100 to 100 (negative = protective)
  evidence: string; // What data supports this
  modifiable: boolean; // Can patient/provider change this?
}

// AI-recommended intervention
export interface RecommendedIntervention {
  id: string;
  type: "medication" | "lifestyle" | "monitoring" | "referral" | "diagnostic" | "preventive" | "education";
  title: string;
  description: string;
  urgency: InterventionUrgency;
  expectedImpact: number; // Predicted risk reduction 0-100
  timeToImplement: string; // e.g., "immediate", "1 week", "1 month"
  evidenceBasis: string;
  isImplemented: boolean;
  implementedAt?: string;
  implementedBy?: string;
}

export const insertPredictiveRiskForecastSchema = z.object({
  patientId: z.string().min(1),
  category: z.enum(riskCategories),
  forecastType: z.enum(["risk_progression", "condition_onset", "complication_risk", "hospitalization_risk", "adverse_event"]),
  title: z.string().min(1),
  description: z.string().min(1),
  currentRiskScore: z.number().min(0).max(100),
  currentRiskLevel: z.enum(riskLevels),
  predictedRiskScore: z.number().min(0).max(100),
  predictedRiskLevel: z.enum(riskLevels),
  timeframe: z.enum(predictionTimeframes),
  riskTrajectory: z.enum(["improving", "stable", "worsening", "rapidly_worsening"]),
  dataSources: z.array(z.enum(predictionDataSources)),
  dataPointsAnalyzed: z.number().min(0),
  predictionConfidence: z.enum(predictionConfidenceLevels),
  confidenceScore: z.number().min(0).max(100),
});

export type InsertPredictiveRiskForecast = z.infer<typeof insertPredictiveRiskForecastSchema>;

// Patient Risk Stratification - Summary view for provider dashboards
export interface PatientRiskStratification {
  id: string;
  patientId: string;
  patientName: string;
  
  // Overall risk profile
  overallRiskScore: number; // 0-100
  overallRiskLevel: RiskLevel;
  overallTrajectory: "improving" | "stable" | "worsening" | "rapidly_worsening";
  
  // Risk breakdown by category
  categoryRisks: {
    category: RiskCategory;
    riskScore: number;
    riskLevel: RiskLevel;
    trajectory: "improving" | "stable" | "worsening" | "rapidly_worsening";
    primaryConcern?: string;
  }[];
  
  // Top concerns requiring attention
  topConcerns: {
    title: string;
    category: RiskCategory;
    urgency: InterventionUrgency;
    description: string;
  }[];
  
  // Active forecasts count
  activeForecastCount: number;
  urgentInterventionCount: number;
  
  // Engagement metrics
  promCompletionRate: number; // 0-100
  lastPromDate?: string;
  lastTriageDate?: string;
  recentTriageUrgency?: string;
  
  // Timestamps
  lastUpdated: string;
  nextReviewDate?: string;
}

// Risk Trend Data Point for charts
export interface RiskTrendDataPoint {
  date: string;
  riskScore: number;
  riskLevel: RiskLevel;
  category: RiskCategory;
  event?: string; // Notable event on this date
}

// Provider Dashboard Summary
export interface RiskStratificationDashboard {
  // Patient counts by risk level
  patientsByRiskLevel: {
    low: number;
    moderate: number;
    elevated: number;
    high: number;
  };
  
  // Patients by trajectory
  patientsByTrajectory: {
    improving: number;
    stable: number;
    worsening: number;
    rapidlyWorsening: number;
  };
  
  // High-priority patients needing attention
  highPriorityPatients: PatientRiskStratification[];
  
  // Recent forecasts requiring review
  pendingForecasts: PredictiveRiskForecast[];
  
  // Urgent interventions across all patients
  urgentInterventions: {
    patientId: string;
    patientName: string;
    intervention: RecommendedIntervention;
  }[];
  
  // Analytics
  averageRiskScore: number;
  patientsWithWorseningTrajectory: number;
  interventionImplementationRate: number;
  
  lastUpdated: string;
}

// ============================================
// SECURE MESSAGING SYSTEM
// ============================================

// Message thread participants
export const messageParticipantRoles = ["patient", "provider", "nurse", "care_coordinator", "caregiver", "specialist"] as const;
export type MessageParticipantRole = typeof messageParticipantRoles[number];

// Message thread types
export const messageThreadTypes = ["general", "prescription_request", "appointment_follow_up", "test_results", "urgent", "billing"] as const;
export type MessageThreadType = typeof messageThreadTypes[number];

// Message priority levels
export const messagePriorities = ["normal", "high", "urgent"] as const;
export type MessagePriority = typeof messagePriorities[number];

// Attachment types
export const attachmentTypes = ["image", "document", "lab_result", "prescription", "other"] as const;
export type AttachmentType = typeof attachmentTypes[number];

// Message thread participant
export interface MessageParticipant {
  id: string;
  name: string;
  role: MessageParticipantRole;
  avatarUrl?: string;
  isOnline?: boolean;
}

// Message attachment
export interface MessageAttachment {
  id: string;
  messageId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  attachmentType: AttachmentType;
  objectPath: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  uploadedAt: string;
  uploadedBy: string;
}

export const insertMessageAttachmentSchema = z.object({
  messageId: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().min(0),
  attachmentType: z.enum(attachmentTypes),
  objectPath: z.string().min(1),
  downloadUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  uploadedBy: z.string().min(1),
});

export type InsertMessageAttachment = z.infer<typeof insertMessageAttachmentSchema>;

// Secure message
export interface SecureMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: MessageParticipantRole;
  content: string;
  attachments: MessageAttachment[];
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt?: string;
  isEdited: boolean;
  isDeleted: boolean;
}

export const insertSecureMessageSchema = z.object({
  threadId: z.string().min(1),
  senderId: z.string().min(1),
  senderName: z.string().min(1),
  senderRole: z.enum(messageParticipantRoles),
  content: z.string().min(1),
});

export type InsertSecureMessage = z.infer<typeof insertSecureMessageSchema>;

// Message thread
export interface MessageThread {
  id: string;
  patientId: string;
  subject: string;
  threadType: MessageThreadType;
  priority: MessagePriority;
  participants: MessageParticipant[];
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
  isArchived: boolean;
  isClosed: boolean;
  closedAt?: string;
  closedBy?: string;
  createdAt: string;
  createdBy: string;
}

export const insertMessageThreadSchema = z.object({
  patientId: z.string().min(1),
  subject: z.string().min(1).max(200),
  threadType: z.enum(messageThreadTypes),
  priority: z.enum(messagePriorities).default("normal"),
  participants: z.array(z.object({
    id: z.string(),
    name: z.string(),
    role: z.enum(messageParticipantRoles),
    avatarUrl: z.string().optional(),
  })),
  createdBy: z.string().min(1),
});

export type InsertMessageThread = z.infer<typeof insertMessageThreadSchema>;

// ============================================
// CONTENT RECOMMENDATIONS & PREDICTIVE ANALYTICS
// ============================================

// Content categories for health education
export const contentCategories = [
  "nutrition", "exercise", "mental_health", "medication_management", 
  "chronic_conditions", "preventive_care", "sleep", "stress_management",
  "heart_health", "diabetes_management", "weight_management", "wellness"
] as const;
export type ContentCategory = typeof contentCategories[number];

// Content types
export const contentTypes = ["article", "video", "guide", "infographic", "podcast", "tool"] as const;
export type ContentType = typeof contentTypes[number];

// Health content/article
export interface HealthContent {
  id: string;
  title: string;
  summary: string;
  contentType: ContentType;
  category: ContentCategory;
  tags: string[];
  readTimeMinutes: number;
  imageUrl?: string;
  sourceUrl?: string;
  sourceName: string;
  publishedAt: string;
  isVerified: boolean;
  relevanceScore?: number;
  viewCount: number;
  likeCount: number;
}

export const insertHealthContentSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  contentType: z.enum(contentTypes),
  category: z.enum(contentCategories),
  tags: z.array(z.string()).default([]),
  readTimeMinutes: z.number().min(1),
  imageUrl: z.string().optional(),
  sourceUrl: z.string().optional(),
  sourceName: z.string().min(1),
  publishedAt: z.string(),
  isVerified: z.boolean().default(true),
});

export type InsertHealthContent = z.infer<typeof insertHealthContentSchema>;

// Personalized content recommendation
export interface ContentRecommendation {
  id: string;
  patientId: string;
  contentId: string;
  content: HealthContent;
  relevanceScore: number;
  matchedConditions: string[];
  matchedGoals: string[];
  matchedMedications: string[];
  recommendationReason: string;
  aiExplanation: string;
  isSaved: boolean;
  isViewed: boolean;
  isHelpful?: boolean;
  recommendedAt: string;
  viewedAt?: string;
}

export const insertContentRecommendationSchema = z.object({
  patientId: z.string().min(1),
  contentId: z.string().min(1),
  relevanceScore: z.number().min(0).max(100),
  matchedConditions: z.array(z.string()).default([]),
  matchedGoals: z.array(z.string()).default([]),
  matchedMedications: z.array(z.string()).default([]),
  recommendationReason: z.string().min(1),
  aiExplanation: z.string().min(1),
});

export type InsertContentRecommendation = z.infer<typeof insertContentRecommendationSchema>;

// Health trend analysis
export const trendDirections = ["improving", "stable", "declining", "fluctuating"] as const;
export type TrendDirection = typeof trendDirections[number];

export const trendSignificance = ["normal", "notable", "concerning", "critical"] as const;
export type TrendSignificance = typeof trendSignificance[number];

export interface HealthTrendAnalysis {
  id: string;
  patientId: string;
  metricType: string;
  metricName: string;
  direction: TrendDirection;
  significance: TrendSignificance;
  currentValue: string;
  previousValue: string;
  percentageChange: number;
  dataPoints: { date: string; value: number }[];
  timeRangeDays: number;
  prediction: string;
  predictedValue?: string;
  predictedDate?: string;
  confidenceLevel: number;
  aiAnalysis: string;
  recommendedActions: string[];
  relatedConditions: string[];
  createdAt: string;
}

export const insertHealthTrendAnalysisSchema = z.object({
  patientId: z.string().min(1),
  metricType: z.string().min(1),
  metricName: z.string().min(1),
  direction: z.enum(trendDirections),
  significance: z.enum(trendSignificance),
  currentValue: z.string(),
  previousValue: z.string(),
  percentageChange: z.number(),
  dataPoints: z.array(z.object({ date: z.string(), value: z.number() })),
  timeRangeDays: z.number().min(1),
  prediction: z.string(),
  predictedValue: z.string().optional(),
  predictedDate: z.string().optional(),
  confidenceLevel: z.number().min(0).max(100),
  aiAnalysis: z.string(),
  recommendedActions: z.array(z.string()),
  relatedConditions: z.array(z.string()).default([]),
});

export type InsertHealthTrendAnalysis = z.infer<typeof insertHealthTrendAnalysisSchema>;

// Early warning indicator
export const warningLevels = ["watch", "caution", "warning", "alert"] as const;
export type WarningLevel = typeof warningLevels[number];

export interface EarlyWarningIndicator {
  id: string;
  patientId: string;
  warningType: string;
  title: string;
  description: string;
  warningLevel: WarningLevel;
  triggerConditions: string[];
  affectedMetrics: string[];
  potentialOutcome: string;
  timeToAction: string;
  recommendedSteps: string[];
  confidenceScore: number;
  aiReasoning: string;
  isAcknowledged: boolean;
  acknowledgedAt?: string;
  isResolved: boolean;
  resolvedAt?: string;
  createdAt: string;
  expiresAt?: string;
}

export const insertEarlyWarningIndicatorSchema = z.object({
  patientId: z.string().min(1),
  warningType: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  warningLevel: z.enum(warningLevels),
  triggerConditions: z.array(z.string()),
  affectedMetrics: z.array(z.string()),
  potentialOutcome: z.string(),
  timeToAction: z.string(),
  recommendedSteps: z.array(z.string()),
  confidenceScore: z.number().min(0).max(100),
  aiReasoning: z.string(),
});

export type InsertEarlyWarningIndicator = z.infer<typeof insertEarlyWarningIndicatorSchema>;

// ============================================
// GAMIFICATION SYSTEM
// ============================================

// Badge categories and types
export const badgeCategories = ["milestone", "streak", "achievement", "special", "seasonal"] as const;
export type BadgeCategory = typeof badgeCategories[number];

export const badgeRarities = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type BadgeRarity = typeof badgeRarities[number];

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory;
  rarity: BadgeRarity;
  pointsRequired?: number;
  criteria: string;
  isSecret: boolean;
  createdAt: string;
}

export interface PlayerBadge {
  id: string;
  patientId: string;
  badgeId: string;
  badge: Badge;
  earnedAt: string;
  progress: number;
  isNew: boolean;
}

// Points and XP system
export const pointCategories = [
  "goal_progress",
  "goal_completion",
  "streak_bonus",
  "daily_checkin",
  "milestone_reached",
  "badge_earned",
  "health_improvement",
  "engagement",
] as const;
export type PointCategory = typeof pointCategories[number];

export interface PointTransaction {
  id: string;
  patientId: string;
  amount: number;
  category: PointCategory;
  description: string;
  relatedGoalId?: string;
  createdAt: string;
}

export interface PlayerStats {
  id: string;
  patientId: string;
  totalPoints: number;
  currentLevel: number;
  pointsToNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  goalsCompleted: number;
  badgesEarned: number;
  lastActivityDate: string;
  weeklyPoints: number;
  monthlyPoints: number;
  updatedAt: string;
}

// Level definitions
export interface LevelDefinition {
  level: number;
  name: string;
  pointsRequired: number;
  icon: string;
  perks: string[];
}

export const levelDefinitions: LevelDefinition[] = [
  { level: 1, name: "Health Starter", pointsRequired: 0, icon: "seedling", perks: ["Basic goal tracking"] },
  { level: 2, name: "Wellness Warrior", pointsRequired: 100, icon: "leaf", perks: ["Streak bonuses unlocked"] },
  { level: 3, name: "Health Hero", pointsRequired: 300, icon: "tree", perks: ["Custom goal categories"] },
  { level: 4, name: "Vitality Champion", pointsRequired: 600, icon: "star", perks: ["Priority insights"] },
  { level: 5, name: "Wellness Master", pointsRequired: 1000, icon: "crown", perks: ["Exclusive badges"] },
  { level: 6, name: "Health Legend", pointsRequired: 1500, icon: "trophy", perks: ["Leaderboard features"] },
  { level: 7, name: "Ultimate Champion", pointsRequired: 2500, icon: "gem", perks: ["All perks unlocked"] },
];

// Streak tracking
export interface StreakRecord {
  id: string;
  patientId: string;
  streakType: "daily_checkin" | "goal_progress" | "medication_adherence" | "exercise";
  currentCount: number;
  longestCount: number;
  lastCheckinDate: string;
  startDate: string;
  isActive: boolean;
  frozenUntil?: string;
}

// Achievements
export const achievementTypes = [
  "first_goal",
  "goal_streak_7",
  "goal_streak_30",
  "goal_streak_100",
  "five_goals_completed",
  "ten_goals_completed",
  "first_health_check",
  "weight_goal_met",
  "exercise_champion",
  "medication_master",
  "early_bird",
  "night_owl",
  "social_butterfly",
  "data_driven",
] as const;
export type AchievementType = typeof achievementTypes[number];

export interface Achievement {
  id: string;
  type: AchievementType;
  name: string;
  description: string;
  icon: string;
  points: number;
  rarity: BadgeRarity;
  criteria: {
    type: string;
    target: number;
    current?: number;
  };
}

export interface PlayerAchievement {
  id: string;
  patientId: string;
  achievementType: AchievementType;
  progress: number;
  targetValue: number;
  isCompleted: boolean;
  completedAt?: string;
  createdAt: string;
}

// Leaderboard
export interface LeaderboardEntry {
  rank: number;
  anonymousId: string;
  displayName: string;
  avatarEmoji: string;
  totalPoints: number;
  level: number;
  levelName: string;
  badgeCount: number;
  currentStreak: number;
  isCurrentUser: boolean;
}

export interface Leaderboard {
  id: string;
  type: "weekly" | "monthly" | "all_time";
  entries: LeaderboardEntry[];
  totalParticipants: number;
  userRank?: number;
  lastUpdated: string;
}

// Motivational nudges
export const nudgeTypes = [
  "streak_reminder",
  "goal_encouragement",
  "milestone_celebration",
  "comeback_welcome",
  "daily_motivation",
  "achievement_unlock",
  "level_up",
  "streak_freeze_warning",
] as const;
export type NudgeType = typeof nudgeTypes[number];

export const nudgePriorities = ["low", "medium", "high", "urgent"] as const;
export type NudgePriority = typeof nudgePriorities[number];

export interface MotivationalNudge {
  id: string;
  patientId: string;
  type: NudgeType;
  title: string;
  message: string;
  icon: string;
  priority: NudgePriority;
  actionLabel?: string;
  actionUrl?: string;
  relatedGoalId?: string;
  expiresAt?: string;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
}

// Gamification summary for dashboard
export interface GamificationSummary {
  patientId: string;
  stats: PlayerStats;
  recentBadges: PlayerBadge[];
  activeStreaks: StreakRecord[];
  pendingAchievements: PlayerAchievement[];
  nudges: MotivationalNudge[];
  weeklyProgress: {
    pointsEarned: number;
    goalsProgressed: number;
    badgesEarned: number;
    streakDays: number;
  };
  nextMilestone: {
    type: string;
    name: string;
    progress: number;
    target: number;
  };
}

// Insert schemas
export const insertPointTransactionSchema = z.object({
  patientId: z.string().min(1),
  amount: z.number().int(),
  category: z.enum(pointCategories),
  description: z.string().min(1),
  relatedGoalId: z.string().optional(),
});

export type InsertPointTransaction = z.infer<typeof insertPointTransactionSchema>;

export const insertPlayerBadgeSchema = z.object({
  patientId: z.string().min(1),
  badgeId: z.string().min(1),
  progress: z.number().min(0).max(100).default(100),
});

export type InsertPlayerBadge = z.infer<typeof insertPlayerBadgeSchema>;

export const insertStreakRecordSchema = z.object({
  patientId: z.string().min(1),
  streakType: z.enum(["daily_checkin", "goal_progress", "medication_adherence", "exercise"]),
  currentCount: z.number().int().min(0).default(0),
  longestCount: z.number().int().min(0).default(0),
  lastCheckinDate: z.string(),
  startDate: z.string(),
  isActive: z.boolean().default(true),
  frozenUntil: z.string().optional(),
});

export type InsertStreakRecord = z.infer<typeof insertStreakRecordSchema>;

export const insertMotivationalNudgeSchema = z.object({
  patientId: z.string().min(1),
  type: z.enum(nudgeTypes),
  title: z.string().min(1),
  message: z.string().min(1),
  icon: z.string().default("sparkles"),
  priority: z.enum(nudgePriorities).default("medium"),
  actionLabel: z.string().optional(),
  actionUrl: z.string().optional(),
  relatedGoalId: z.string().optional(),
  expiresAt: z.string().optional(),
});

export type InsertMotivationalNudge = z.infer<typeof insertMotivationalNudgeSchema>;

// ============================================
// PATIENT-REPORTED OUTCOME MEASURES (PROMs)
// ============================================

export const promCategories = [
  "general_health",
  "pain",
  "mental_health",
  "fatigue",
  "physical_function",
  "sleep",
  "diabetes",
  "cardiac",
  "respiratory",
  "custom",
] as const;
export type PromCategory = typeof promCategories[number];

export const promFrequencies = ["daily", "weekly", "biweekly", "monthly", "quarterly", "as_needed"] as const;
export type PromFrequency = typeof promFrequencies[number];

export const questionTypes = ["scale", "multiple_choice", "yes_no", "text", "numeric"] as const;
export type QuestionType = typeof questionTypes[number];

// PROM Questionnaire Template
export interface PromQuestionnaire {
  id: string;
  name: string;
  description: string;
  category: PromCategory;
  conditionTargets: string[];
  questions: PromQuestion[];
  scoringMethod: "sum" | "average" | "weighted" | "custom";
  scoringThresholds: ScoringThreshold[];
  isActive: boolean;
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromQuestion {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  options?: { value: string | number; label: string; score?: number }[];
  minValue?: number;
  maxValue?: number;
  minLabel?: string;
  maxLabel?: string;
  weight?: number;
}

export interface ScoringThreshold {
  minScore: number;
  maxScore: number;
  severity: "normal" | "mild" | "moderate" | "severe";
  interpretation: string;
  alertProvider: boolean;
}

// Patient PROM Assignment
export interface PatientPromAssignment {
  id: string;
  patientId: string;
  questionnaireId: string;
  frequency: PromFrequency;
  startDate: string;
  endDate?: string;
  nextDueDate: string;
  assignedBy: string;
  assignedByName: string;
  isActive: boolean;
  reminderEnabled: boolean;
  createdAt: string;
}

// PROM Response/Submission
export interface PromResponse {
  id: string;
  patientId: string;
  assignmentId: string;
  questionnaireId: string;
  questionnaireName: string;
  answers: PromAnswer[];
  totalScore: number;
  maxPossibleScore: number;
  percentageScore: number;
  severity: "normal" | "mild" | "moderate" | "severe";
  interpretation: string;
  triggeredAlert: boolean;
  completedAt: string;
  timeToComplete: number;
}

export interface PromAnswer {
  questionId: string;
  questionText: string;
  value: string | number;
  displayValue: string;
  score: number;
}

// PROM Trend Data
export interface PromTrend {
  patientId: string;
  questionnaireId: string;
  questionnaireName: string;
  category: PromCategory;
  dataPoints: {
    date: string;
    score: number;
    severity: string;
  }[];
  averageScore: number;
  trend: "improving" | "stable" | "worsening";
  trendPercentage: number;
}

// ============================================
// ANOMALY DETECTION & PROVIDER ALERTS
// ============================================

export const alertSeverities = ["low", "medium", "high", "critical"] as const;
export type AlertSeverity = typeof alertSeverities[number];

export const alertTypes = [
  "prom_threshold",
  "prom_trend_change",
  "vital_sign_abnormal",
  "medication_adherence",
  "symptom_escalation",
  "mental_health_risk",
  "missed_prom",
  "ai_detected_anomaly",
] as const;
export type AlertType = typeof alertTypes[number];

export const alertStatuses = ["new", "acknowledged", "in_review", "resolved", "dismissed"] as const;
export type AlertStatus = typeof alertStatuses[number];

export interface ProviderAlert {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  alertType: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  details: AlertDetails;
  recommendedActions: string[];
  aiAnalysis?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertDetails {
  sourceType: "prom" | "vital" | "lab" | "medication" | "ai_analysis";
  sourceId?: string;
  currentValue?: number;
  previousValue?: number;
  threshold?: number;
  trendDirection?: "up" | "down" | "stable";
  percentageChange?: number;
  relatedData?: Record<string, unknown>;
}

// ============================================
// PERSONALIZED HEALTH TIPS & EDUCATION
// ============================================

export const healthTipCategories = [
  "nutrition",
  "exercise",
  "medication",
  "mental_health",
  "sleep",
  "chronic_disease",
  "preventive_care",
  "lifestyle",
  "general_wellness",
] as const;
export type HealthTipCategory = typeof healthTipCategories[number];

export const contentFormats = ["tip", "article", "video_link", "infographic_link", "checklist", "reminder"] as const;
export type ContentFormat = typeof contentFormats[number];

export interface HealthTip {
  id: string;
  title: string;
  content: string;
  summary: string;
  category: HealthTipCategory;
  format: ContentFormat;
  targetConditions: string[];
  targetMedications: string[];
  targetAgeRange?: { min?: number; max?: number };
  imageUrl?: string;
  externalUrl?: string;
  readTimeMinutes: number;
  isAiGenerated: boolean;
  aiPromptContext?: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Personalized tip delivery to patient
export interface PatientHealthTip {
  id: string;
  patientId: string;
  healthTipId: string;
  healthTip?: HealthTip;
  reason: string;
  relevanceScore: number;
  isRead: boolean;
  readAt?: string;
  isBookmarked: boolean;
  feedbackRating?: number;
  feedbackComment?: string;
  deliveredAt: string;
  expiresAt?: string;
}

// AI-generated personalized content
export interface PersonalizedHealthContent {
  id: string;
  patientId: string;
  title: string;
  content: string;
  category: HealthTipCategory;
  basedOnConditions: string[];
  basedOnMedications: string[];
  basedOnRecentProms: string[];
  basedOnHealthGoals: string[];
  generatedAt: string;
  expiresAt: string;
  isRead: boolean;
  feedbackRating?: number;
}

// ============================================
// HEALTH ENGAGEMENT ANALYTICS
// ============================================

export interface PatientEngagementMetrics {
  patientId: string;
  promCompletionRate: number;
  averageResponseTime: number;
  streakDays: number;
  tipsViewed: number;
  tipsBookmarked: number;
  lastActiveDate: string;
  engagementScore: number;
  engagementTrend: "improving" | "stable" | "declining";
}

// ============================================
// INSERT SCHEMAS FOR PROMS & HEALTH ENGAGEMENT
// ============================================

export const insertPromQuestionnaireSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(promCategories),
  conditionTargets: z.array(z.string()).default([]),
  questions: z.array(z.object({
    id: z.string(),
    text: z.string(),
    type: z.enum(questionTypes),
    required: z.boolean().default(true),
    options: z.array(z.object({
      value: z.union([z.string(), z.number()]),
      label: z.string(),
      score: z.number().optional(),
    })).optional(),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    minLabel: z.string().optional(),
    maxLabel: z.string().optional(),
    weight: z.number().optional(),
  })),
  scoringMethod: z.enum(["sum", "average", "weighted", "custom"]).default("sum"),
  scoringThresholds: z.array(z.object({
    minScore: z.number(),
    maxScore: z.number(),
    severity: z.enum(["normal", "mild", "moderate", "severe"]),
    interpretation: z.string(),
    alertProvider: z.boolean(),
  })),
  version: z.string().default("1.0"),
});
export type InsertPromQuestionnaire = z.infer<typeof insertPromQuestionnaireSchema>;

export const insertPatientPromAssignmentSchema = z.object({
  patientId: z.string().min(1),
  questionnaireId: z.string().min(1),
  frequency: z.enum(promFrequencies),
  startDate: z.string(),
  endDate: z.string().optional(),
  assignedBy: z.string().min(1),
  assignedByName: z.string().min(1),
  reminderEnabled: z.boolean().default(true),
});
export type InsertPatientPromAssignment = z.infer<typeof insertPatientPromAssignmentSchema>;

export const insertPromResponseSchema = z.object({
  patientId: z.string().min(1),
  assignmentId: z.string().min(1),
  questionnaireId: z.string().min(1),
  questionnaireName: z.string().min(1),
  answers: z.array(z.object({
    questionId: z.string(),
    questionText: z.string(),
    value: z.union([z.string(), z.number()]),
    displayValue: z.string(),
    score: z.number(),
  })),
  totalScore: z.number(),
  maxPossibleScore: z.number(),
  percentageScore: z.number(),
  severity: z.enum(["normal", "mild", "moderate", "severe"]),
  interpretation: z.string(),
  triggeredAlert: z.boolean().default(false),
  timeToComplete: z.number(),
});
export type InsertPromResponse = z.infer<typeof insertPromResponseSchema>;

export const insertProviderAlertSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  providerId: z.string().min(1),
  providerName: z.string().min(1),
  alertType: z.enum(alertTypes),
  severity: z.enum(alertSeverities),
  title: z.string().min(1),
  description: z.string().min(1),
  details: z.object({
    sourceType: z.enum(["prom", "vital", "lab", "medication", "ai_analysis"]),
    sourceId: z.string().optional(),
    currentValue: z.number().optional(),
    previousValue: z.number().optional(),
    threshold: z.number().optional(),
    trendDirection: z.enum(["up", "down", "stable"]).optional(),
    percentageChange: z.number().optional(),
    relatedData: z.record(z.unknown()).optional(),
  }),
  recommendedActions: z.array(z.string()).default([]),
  aiAnalysis: z.string().optional(),
});
export type InsertProviderAlert = z.infer<typeof insertProviderAlertSchema>;

export const insertHealthTipSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  summary: z.string().min(1),
  category: z.enum(healthTipCategories),
  format: z.enum(contentFormats).default("tip"),
  targetConditions: z.array(z.string()).default([]),
  targetMedications: z.array(z.string()).default([]),
  targetAgeRange: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  imageUrl: z.string().optional(),
  externalUrl: z.string().optional(),
  readTimeMinutes: z.number().min(1).default(2),
  isAiGenerated: z.boolean().default(false),
  aiPromptContext: z.string().optional(),
  priority: z.number().default(50),
});
export type InsertHealthTip = z.infer<typeof insertHealthTipSchema>;

export const insertPatientHealthTipSchema = z.object({
  patientId: z.string().min(1),
  healthTipId: z.string().min(1),
  reason: z.string().min(1),
  relevanceScore: z.number().min(0).max(100),
  expiresAt: z.string().optional(),
});
export type InsertPatientHealthTip = z.infer<typeof insertPatientHealthTipSchema>;

export const updateProviderAlertSchema = z.object({
  status: z.enum(alertStatuses).optional(),
  acknowledgedBy: z.string().optional(),
  resolvedBy: z.string().optional(),
  resolutionNotes: z.string().optional(),
});
export type UpdateProviderAlert = z.infer<typeof updateProviderAlertSchema>;

// AI Triage System
export const triageUrgencyLevels = [
  "emergency",
  "urgent",
  "soon",
  "routine",
  "self_care",
] as const;
export type TriageUrgencyLevel = typeof triageUrgencyLevels[number];

export const symptomSeverities = [
  "mild",
  "moderate",
  "severe",
  "very_severe",
] as const;
export type SymptomSeverity = typeof symptomSeverities[number];

export const symptomDurations = [
  "just_started",
  "few_hours",
  "today",
  "few_days",
  "week_or_more",
  "chronic",
] as const;
export type SymptomDuration = typeof symptomDurations[number];

export const bodyRegions = [
  "head",
  "face",
  "neck",
  "chest",
  "upper_back",
  "lower_back",
  "abdomen",
  "pelvis",
  "left_arm",
  "right_arm",
  "left_leg",
  "right_leg",
  "skin",
  "general",
] as const;
export type BodyRegion = typeof bodyRegions[number];

export const recommendationTypes = [
  "emergency_call",
  "emergency_room",
  "urgent_care",
  "schedule_appointment",
  "telehealth",
  "specialist_referral",
  "self_care",
  "monitor",
] as const;
export type RecommendationType = typeof recommendationTypes[number];

export interface TriageSymptom {
  name: string;
  bodyRegion: BodyRegion;
  severity: SymptomSeverity;
  duration: SymptomDuration;
  description?: string;
  worsening: boolean;
  interferesWithDailyLife: boolean;
}

export interface TriageRecommendation {
  type: RecommendationType;
  urgency: TriageUrgencyLevel;
  title: string;
  description: string;
  timeframe?: string;
  specialistType?: string;
  selfCareInstructions?: string[];
  warningSignsToWatch?: string[];
}

export interface PotentialCondition {
  name: string;
  likelihood: "possible" | "likely" | "less_likely";
  description: string;
  commonSymptoms: string[];
  whenToSeekCare: string;
}

export interface TriageSession {
  id: string;
  patientId: string;
  createdAt: string;
  completedAt?: string;
  status: "in_progress" | "completed" | "abandoned";
  chiefComplaint: string;
  symptoms: TriageSymptom[];
  additionalContext?: string;
  vitalSigns?: {
    temperature?: number;
    heartRate?: number;
    bloodPressure?: string;
    oxygenSaturation?: number;
  };
  riskFactors?: string[];
  currentMedications?: string[];
  relevantConditions?: string[];
  aiAnalysis?: {
    summary: string;
    urgencyLevel: TriageUrgencyLevel;
    urgencyReasoning: string;
    potentialConditions: PotentialCondition[];
    recommendations: TriageRecommendation[];
    questionsToAsk?: string[];
    disclaimer: string;
    confidence: number;
    analyzedAt: string;
  };
  patientFeedback?: {
    helpful: boolean;
    followedRecommendation: boolean;
    actualOutcome?: string;
    rating?: number;
  };
  providerReview?: {
    reviewedBy: string;
    reviewedAt: string;
    agreedWithAssessment: boolean;
    notes?: string;
    actualDiagnosis?: string;
  };
}

export const insertTriageSessionSchema = z.object({
  patientId: z.string().min(1),
  chiefComplaint: z.string().min(1),
  symptoms: z.array(z.object({
    name: z.string().min(1),
    bodyRegion: z.enum(bodyRegions),
    severity: z.enum(symptomSeverities),
    duration: z.enum(symptomDurations),
    description: z.string().optional(),
    worsening: z.boolean(),
    interferesWithDailyLife: z.boolean(),
  })),
  additionalContext: z.string().optional(),
  vitalSigns: z.object({
    temperature: z.number().optional(),
    heartRate: z.number().optional(),
    bloodPressure: z.string().optional(),
    oxygenSaturation: z.number().optional(),
  }).optional(),
  riskFactors: z.array(z.string()).optional(),
  currentMedications: z.array(z.string()).optional(),
  relevantConditions: z.array(z.string()).optional(),
});
export type InsertTriageSession = z.infer<typeof insertTriageSessionSchema>;

export const updateTriageSessionSchema = z.object({
  status: z.enum(["in_progress", "completed", "abandoned"]).optional(),
  patientFeedback: z.object({
    helpful: z.boolean(),
    followedRecommendation: z.boolean(),
    actualOutcome: z.string().optional(),
    rating: z.number().min(1).max(5).optional(),
  }).optional(),
});
export type UpdateTriageSession = z.infer<typeof updateTriageSessionSchema>;

// ============================================
// MEDICAL SUMMARY SCHEMA
// ============================================

export const summaryTypes = ["comprehensive", "focused", "brief", "emergency"] as const;
export type SummaryType = typeof summaryTypes[number];

export const summaryPurposes = [
  "new_provider_visit",
  "specialist_referral", 
  "emergency_transfer",
  "care_coordination",
  "insurance_review",
  "patient_request"
] as const;
export type SummaryPurpose = typeof summaryPurposes[number];

export interface ExtractedDataPoint {
  category: "condition" | "medication" | "allergy" | "procedure" | "vital" | "lab" | "triage" | "family_history";
  name: string;
  value?: string;
  date?: string;
  status?: string;
  source: string;
  relevance: "high" | "medium" | "low";
  notes?: string;
}

export interface MedicalSummary {
  id: string;
  patientId: string;
  generatedAt: string;
  generatedBy: string;
  summaryType: SummaryType;
  purpose: SummaryPurpose;
  title: string;
  
  patientOverview: {
    name: string;
    dateOfBirth?: string;
    age?: number;
    gender?: string;
    primaryPhysician?: string;
  };
  
  chiefConcerns: string[];
  
  activeConditions: ExtractedDataPoint[];
  currentMedications: ExtractedDataPoint[];
  allergies: ExtractedDataPoint[];
  recentProcedures: ExtractedDataPoint[];
  recentVitals: ExtractedDataPoint[];
  relevantLabResults: ExtractedDataPoint[];
  recentTriageHistory: ExtractedDataPoint[];
  familyHistory: ExtractedDataPoint[];
  
  narrativeSummary: string;
  clinicalImpressions: string[];
  recommendations: string[];
  
  dataSourceCount: number;
  extractionConfidence: number;
  lastUpdated: string;
  
  metadata: {
    totalRecordsReviewed: number;
    timeRangeStart?: string;
    timeRangeEnd?: string;
    excludedCategories?: string[];
    aiModel: string;
    generationDuration: number;
  };
}

export const insertMedicalSummarySchema = z.object({
  patientId: z.string().min(1),
  summaryType: z.enum(summaryTypes),
  purpose: z.enum(summaryPurposes),
  generatedBy: z.string().optional(),
  timeRangeStart: z.string().optional(),
  timeRangeEnd: z.string().optional(),
  focusAreas: z.array(z.string()).optional(),
});
export type InsertMedicalSummary = z.infer<typeof insertMedicalSummarySchema>;

// ============================================
// PERSONALIZED HEALTH EDUCATION SYSTEM
// ============================================

export const educationContentTypes = [
  "article",
  "faq",
  "video",
  "infographic",
  "checklist",
] as const;
export type EducationContentType = typeof educationContentTypes[number];

export const educationCategories = [
  "conditions",
  "medications",
  "nutrition",
  "exercise",
  "mental_health",
  "prevention",
  "treatment",
  "lifestyle",
  "emergency",
  "general_wellness",
] as const;
export type EducationCategory = typeof educationCategories[number];

export const difficultyLevels = ["beginner", "intermediate", "advanced"] as const;
export type DifficultyLevel = typeof difficultyLevels[number];

export interface EducationContent {
  id: string;
  patientId: string;
  type: EducationContentType;
  category: EducationCategory;
  title: string;
  content: string;
  summary: string;
  readTimeMinutes: number;
  difficulty: DifficultyLevel;
  relatedConditions: string[];
  relatedMedications: string[];
  relatedAlerts: string[];
  videoUrl?: string;
  imageUrl?: string;
  externalLinks?: { title: string; url: string }[];
  isAiGenerated: boolean;
  aiContext?: string;
  relevanceScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface EducationFAQ {
  id: string;
  patientId: string;
  question: string;
  answer: string;
  category: EducationCategory;
  relatedConditions: string[];
  relatedMedications: string[];
  isAiGenerated: boolean;
  helpfulVotes: number;
  relevanceScore: number;
  createdAt: string;
}

export interface EducationQuiz {
  id: string;
  patientId: string;
  title: string;
  description: string;
  category: EducationCategory;
  difficulty: DifficultyLevel;
  questions: QuizQuestion[];
  passingScore: number;
  timeLimit?: number;
  relatedContentIds: string[];
  pointsReward: number;
  badgeReward?: string;
  isAiGenerated: boolean;
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: "multiple_choice" | "true_false" | "fill_blank";
  options?: string[];
  correctAnswer: string;
  explanation: string;
  points: number;
}

export interface QuizAttempt {
  id: string;
  patientId: string;
  quizId: string;
  quiz?: EducationQuiz;
  answers: { questionId: string; answer: string; isCorrect: boolean }[];
  score: number;
  totalPoints: number;
  passed: boolean;
  timeSpent: number;
  completedAt: string;
}

export interface LearningProgress {
  id: string;
  patientId: string;
  contentId: string;
  contentType: EducationContentType | "quiz";
  status: "not_started" | "in_progress" | "completed";
  progressPercent: number;
  timeSpent: number;
  lastAccessedAt: string;
  completedAt?: string;
  notes?: string;
}

export interface LearningStreak {
  id: string;
  patientId: string;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string;
  totalDaysActive: number;
}

export interface LearningStats {
  patientId: string;
  totalContentViewed: number;
  totalQuizzesTaken: number;
  totalQuizzesPassed: number;
  averageQuizScore: number;
  totalTimeSpentMinutes: number;
  articlesRead: number;
  faqsViewed: number;
  videosWatched: number;
  currentStreak: number;
  longestStreak: number;
  pointsEarned: number;
  badgesEarned: string[];
  topCategories: { category: EducationCategory; count: number }[];
  weeklyProgress: { date: string; minutes: number; items: number }[];
  lastActivityDate: string;
}

export interface PersonalizedEducationDashboard {
  patientId: string;
  recommendedContent: EducationContent[];
  recommendedFAQs: EducationFAQ[];
  recommendedQuizzes: EducationQuiz[];
  recentProgress: LearningProgress[];
  stats: LearningStats;
  activeAlerts: string[];
  focusAreas: {
    category: EducationCategory;
    reason: string;
    priority: number;
  }[];
}

export const insertEducationContentSchema = z.object({
  patientId: z.string().min(1),
  type: z.enum(educationContentTypes),
  category: z.enum(educationCategories),
  title: z.string().min(1),
  content: z.string().min(1),
  summary: z.string().min(1),
  readTimeMinutes: z.number().min(1).default(5),
  difficulty: z.enum(difficultyLevels).default("beginner"),
  relatedConditions: z.array(z.string()).default([]),
  relatedMedications: z.array(z.string()).default([]),
  relatedAlerts: z.array(z.string()).default([]),
  videoUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  externalLinks: z.array(z.object({
    title: z.string(),
    url: z.string(),
  })).optional(),
  isAiGenerated: z.boolean().default(true),
  aiContext: z.string().optional(),
  relevanceScore: z.number().min(0).max(100).default(50),
});
export type InsertEducationContent = z.infer<typeof insertEducationContentSchema>;

export const insertEducationQuizSchema = z.object({
  patientId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(educationCategories),
  difficulty: z.enum(difficultyLevels).default("beginner"),
  questions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    type: z.enum(["multiple_choice", "true_false", "fill_blank"]),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string(),
    explanation: z.string(),
    points: z.number().default(10),
  })),
  passingScore: z.number().min(0).max(100).default(70),
  timeLimit: z.number().optional(),
  relatedContentIds: z.array(z.string()).default([]),
  pointsReward: z.number().default(50),
  badgeReward: z.string().optional(),
  isAiGenerated: z.boolean().default(true),
});
export type InsertEducationQuiz = z.infer<typeof insertEducationQuizSchema>;

export const insertQuizAttemptSchema = z.object({
  patientId: z.string().min(1),
  quizId: z.string().min(1),
  answers: z.array(z.object({
    questionId: z.string(),
    answer: z.string(),
    isCorrect: z.boolean(),
  })),
  score: z.number().min(0).max(100),
  totalPoints: z.number(),
  passed: z.boolean(),
  timeSpent: z.number(),
});
export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;

export const insertLearningProgressSchema = z.object({
  patientId: z.string().min(1),
  contentId: z.string().min(1),
  contentType: z.union([z.enum(educationContentTypes), z.literal("quiz")]),
  status: z.enum(["not_started", "in_progress", "completed"]).default("not_started"),
  progressPercent: z.number().min(0).max(100).default(0),
  timeSpent: z.number().default(0),
  notes: z.string().optional(),
});
export type InsertLearningProgress = z.infer<typeof insertLearningProgressSchema>;

// ============================================
// TELEHEALTH & VIDEO CONSULTATION SYSTEM
// ============================================

export const telehealthSessionStatus = [
  "scheduled",
  "waiting",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type TelehealthSessionStatus = typeof telehealthSessionStatus[number];

export const consultationTypes = [
  "initial_consultation",
  "follow_up",
  "urgent_care",
  "mental_health",
  "prescription_review",
  "lab_review",
  "post_procedure",
] as const;
export type ConsultationType = typeof consultationTypes[number];

export interface TelehealthSession {
  id: string;
  patientId: string;
  providerId: string;
  providerName: string;
  providerSpecialty?: string;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  status: TelehealthSessionStatus;
  consultationType: ConsultationType;
  reasonForVisit: string;
  notes?: string;
  roomId: string;
  joinUrl?: string;
  recordingUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsultationNote {
  id: string;
  sessionId: string;
  patientId: string;
  providerId: string;
  providerName: string;
  chiefComplaint: string;
  historyOfPresentIllness: string;
  physicalExamFindings?: string;
  assessment: string;
  diagnoses: Diagnosis[];
  plan: string;
  prescriptions: TelehealthPrescription[];
  labOrders?: LabOrder[];
  followUpInstructions?: string;
  followUpDate?: string;
  signedAt?: string;
  signedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Diagnosis {
  code: string;
  description: string;
  type: "primary" | "secondary";
}

export interface TelehealthPrescription {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  refills: number;
  instructions: string;
  prescribedAt: string;
}

export interface LabOrder {
  id: string;
  testName: string;
  testCode: string;
  priority: "routine" | "stat" | "urgent";
  instructions?: string;
  orderedAt: string;
}

// Telehealth-specific messaging - uses existing SecureMessage/MessageThread system

export const insertTelehealthSessionSchema = z.object({
  patientId: z.string().min(1),
  providerId: z.string().min(1),
  providerName: z.string().min(1),
  providerSpecialty: z.string().optional(),
  scheduledAt: z.string(),
  consultationType: z.enum(consultationTypes),
  reasonForVisit: z.string().min(1),
  notes: z.string().optional(),
});
export type InsertTelehealthSession = z.infer<typeof insertTelehealthSessionSchema>;

export const insertConsultationNoteSchema = z.object({
  sessionId: z.string().min(1),
  patientId: z.string().min(1),
  providerId: z.string().min(1),
  providerName: z.string().min(1),
  chiefComplaint: z.string().min(1),
  historyOfPresentIllness: z.string().min(1),
  physicalExamFindings: z.string().optional(),
  assessment: z.string().min(1),
  diagnoses: z.array(z.object({
    code: z.string(),
    description: z.string(),
    type: z.enum(["primary", "secondary"]),
  })),
  plan: z.string().min(1),
  prescriptions: z.array(z.object({
    id: z.string(),
    medicationName: z.string(),
    dosage: z.string(),
    frequency: z.string(),
    duration: z.string(),
    quantity: z.number(),
    refills: z.number(),
    instructions: z.string(),
    prescribedAt: z.string(),
  })).default([]),
  labOrders: z.array(z.object({
    id: z.string(),
    testName: z.string(),
    testCode: z.string(),
    priority: z.enum(["routine", "stat", "urgent"]),
    instructions: z.string().optional(),
    orderedAt: z.string(),
  })).optional(),
  followUpInstructions: z.string().optional(),
  followUpDate: z.string().optional(),
});
export type InsertConsultationNote = z.infer<typeof insertConsultationNoteSchema>;


// ============================================
// UNIVERSAL SEARCH SYSTEM
// ============================================

export const searchableDataTypes = [
  "conditions",
  "medications",
  "prescriptions",
  "lab_results",
  "vitals",
  "allergies",
  "immunizations",
  "procedures",
  "documents",
  "telehealth_notes",
  "triage_assessments",
  "family_history",
  "appointments",
] as const;
export type SearchableDataType = typeof searchableDataTypes[number];

export interface SearchQuery {
  id: string;
  patientId?: string;
  userId: string;
  query: string;
  queryLanguage: string;
  isVoiceQuery: boolean;
  voiceTranscription?: string;
  naturalLanguageIntent?: string;
  filters: SearchFilters;
  resultsCount: number;
  executionTimeMs: number;
  createdAt: string;
}

export interface SearchFilters {
  dataTypes?: SearchableDataType[];
  dateFrom?: string;
  dateTo?: string;
  providers?: string[];
  status?: string[];
}

export interface SearchResult {
  id: string;
  dataType: SearchableDataType;
  patientId: string;
  patientName: string;
  title: string;
  summary: string;
  highlights: string[];
  relevanceScore: number;
  date: string;
  provider?: string;
  metadata: Record<string, unknown>;
}

export interface UniversalSearchResponse {
  query: string;
  interpretedQuery: string;
  totalResults: number;
  executionTimeMs: number;
  results: SearchResult[];
  facets: {
    dataTypes: { type: SearchableDataType; count: number }[];
    dateRanges: { range: string; count: number }[];
    providers: { name: string; count: number }[];
  };
  suggestions: string[];
}

export const insertSearchQuerySchema = z.object({
  patientId: z.string().optional(),
  userId: z.string().min(1),
  query: z.string().min(1),
  queryLanguage: z.string().default("en"),
  isVoiceQuery: z.boolean().default(false),
  voiceTranscription: z.string().optional(),
  filters: z.object({
    dataTypes: z.array(z.enum(searchableDataTypes)).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    providers: z.array(z.string()).optional(),
    status: z.array(z.string()).optional(),
  }).default({}),
});
export type InsertSearchQuery = z.infer<typeof insertSearchQuerySchema>;

// ============================================
// PROVIDER ANALYTICS DASHBOARD TYPES
// ============================================

// Note: RiskCategory is already defined above - reusing it here for analytics

export const demographicCategories = ["age_group", "gender", "ethnicity", "insurance_type", "location", "primary_language"] as const;
export type DemographicCategory = typeof demographicCategories[number];

export const cohortTypes = ["risk_based", "condition_based", "medication_based", "demographic_based", "custom"] as const;
export type CohortType = typeof cohortTypes[number];

export const reportTypes = ["population_health", "treatment_efficacy", "risk_assessment", "quality_metrics", "utilization", "outcomes", "cohort_analysis", "at_risk_patients", "comprehensive"] as const;
export type ReportType = typeof reportTypes[number];

export interface PatientCohort {
  id: string;
  name: string;
  description: string;
  type: CohortType;
  criteria: CohortCriteria;
  patientIds: string[];
  patientCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface CohortCriteria {
  conditions?: string[];
  medications?: string[];
  ageRange?: { min?: number; max?: number };
  gender?: string[];
  riskScoreRange?: { min?: number; max?: number };
  riskCategories?: RiskCategory[];
  promScoreRange?: { min?: number; max?: number };
  telehealthUtilization?: { min?: number; max?: number };
  customFilters?: { field: string; operator: string; value: string | number }[];
}

export const insertCohortSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  type: z.enum(cohortTypes),
  criteria: z.object({
    conditions: z.array(z.string()).optional(),
    medications: z.array(z.string()).optional(),
    ageRange: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
    gender: z.array(z.string()).optional(),
    riskScoreRange: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
    riskCategories: z.array(z.enum(riskCategories)).optional(),
    promScoreRange: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
    telehealthUtilization: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
    customFilters: z.array(z.object({ field: z.string(), operator: z.string(), value: z.union([z.string(), z.number()]) })).optional(),
  }),
  createdBy: z.string(),
});
export type InsertCohort = z.infer<typeof insertCohortSchema>;

export interface PopulationRiskScore {
  id: string;
  patientId: string;
  category: RiskCategory;
  score: number;
  percentile: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  factors: RiskFactor[];
  recommendations: string[];
  modelVersion: string;
  calculatedAt: string;
  validUntil: string;
}

export interface RiskFactor {
  name: string;
  contribution: number;
  value: string | number;
  normalRange?: string;
  isModifiable: boolean;
}

export interface PopulationHealthMetrics {
  id: string;
  period: string;
  periodType: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  totalPatients: number;
  activePatients: number;
  metrics: {
    conditionPrevalence: { condition: string; count: number; percentage: number }[];
    medicationUtilization: { medication: string; count: number; adherenceRate: number }[];
    riskDistribution: { category: RiskCategory; levels: { level: string; count: number }[] }[];
    promScores: { questionnaire: string; averageScore: number; responseRate: number }[];
    telehealthMetrics: { totalSessions: number; completionRate: number; averageDuration: number };
    demographics: { category: DemographicCategory; distribution: { value: string; count: number }[] }[];
  };
  trends: {
    metric: string;
    currentValue: number;
    previousValue: number;
    changePercent: number;
    direction: "up" | "down" | "stable";
  }[];
  calculatedAt: string;
}

export interface TreatmentEfficacy {
  id: string;
  treatmentType: "medication" | "procedure" | "therapy" | "lifestyle";
  treatmentName: string;
  targetCondition: string;
  cohortId?: string;
  sampleSize: number;
  demographics: {
    category: DemographicCategory;
    breakdown: { value: string; count: number; efficacyRate: number }[];
  }[];
  outcomes: {
    metric: string;
    baseline: number;
    current: number;
    improvement: number;
    confidenceInterval: { lower: number; upper: number };
  }[];
  timeToEffect: number;
  sideEffectRate: number;
  adherenceRate: number;
  nntTreat?: number;
  calculatedAt: string;
  periodStart: string;
  periodEnd: string;
}

export interface AnalyticsReport {
  id: string;
  name: string;
  type: ReportType;
  description: string;
  parameters: {
    dateRange: { start: string; end: string };
    cohortIds?: string[];
    conditions?: string[];
    medications?: string[];
    demographics?: DemographicCategory[];
    metrics?: string[];
  };
  sections: ReportSection[];
  summary: string;
  generatedBy: string;
  generatedAt: string;
  format: "pdf" | "excel" | "json";
  downloadUrl?: string;
}

export interface ReportSection {
  title: string;
  type: "summary" | "chart" | "table" | "narrative";
  data: Record<string, unknown>;
  insights: string[];
}

export const insertReportSchema = z.object({
  name: z.string().min(1),
  type: z.enum(reportTypes),
  description: z.string(),
  parameters: z.object({
    dateRange: z.object({ start: z.string(), end: z.string() }),
    cohortIds: z.array(z.string()).optional(),
    conditions: z.array(z.string()).optional(),
    medications: z.array(z.string()).optional(),
    demographics: z.array(z.enum(demographicCategories)).optional(),
    metrics: z.array(z.string()).optional(),
  }),
  generatedBy: z.string(),
});
export type InsertReport = z.infer<typeof insertReportSchema>;

export interface AtRiskPatient {
  patientId: string;
  patientName: string;
  age: number;
  gender: string;
  primaryConditions: string[];
  riskScores: { category: RiskCategory; score: number; level: string }[];
  overallRiskLevel: "low" | "moderate" | "high" | "critical";
  priorityRank: number;
  lastVisit?: string;
  nextScheduledVisit?: string;
  openAlerts: number;
  interventionRecommendations: string[];
}

export interface AnalyticsDashboardData {
  overview: {
    totalPatients: number;
    activePatients: number;
    atRiskPatients: number;
    avgRiskScore: number;
    telehealthSessions: number;
    promCompletionRate: number;
  };
  riskDistribution: { level: string; count: number; percentage: number }[];
  conditionPrevalence: { condition: string; count: number; trend: number }[];
  topMedications: { medication: string; patientCount: number; adherenceRate: number }[];
  demographicBreakdown: { category: string; data: { value: string; count: number }[] }[];
  recentTrends: { metric: string; values: { date: string; value: number }[] }[];
  atRiskPatients: AtRiskPatient[];
  cohorts: PatientCohort[];
}

// ============================================
// USPSTF PREVENTIVE CARE RECOMMENDATIONS
// ============================================

// USPSTF Grade Levels
export const uspstfGrades = ["A", "B", "C", "D", "I"] as const;
export type UspstfGrade = typeof uspstfGrades[number];

// Recommendation Categories
export const recommendationCategories = [
  "cancer_screening",
  "cardiovascular",
  "infectious_disease",
  "mental_health",
  "metabolic",
  "musculoskeletal",
  "substance_use",
  "women_health",
  "men_health",
  "pediatric",
  "immunization",
] as const;
export type RecommendationCategory = typeof recommendationCategories[number];

// Care Gap Status
export const careGapStatuses = [
  "open",
  "in_progress",
  "addressed",
  "declined",
  "not_applicable",
] as const;
export type CareGapStatus = typeof careGapStatuses[number];

// Care Gap Priority
export const careGapPriorities = ["critical", "high", "medium", "low"] as const;
export type CareGapPriority = typeof careGapPriorities[number];

// USPSTF Recommendation Definition
export interface UspstfRecommendation {
  id: string;
  code: string;
  title: string;
  description: string;
  category: RecommendationCategory;
  grade: UspstfGrade;
  ageRangeStart: number;
  ageRangeEnd: number;
  gender: "male" | "female" | "all";
  frequency: string;
  frequencyMonths: number;
  riskFactors?: string[];
  contraindications?: string[];
  cptCodes?: string[];
  icd10Codes?: string[];
  evidenceSummary: string;
  patientEducation: string;
  lastUpdated: string;
}

// Patient Care Gap
export interface CareGap {
  id: string;
  patientId: string;
  recommendationId: string;
  recommendation: UspstfRecommendation;
  status: CareGapStatus;
  priority: CareGapPriority;
  dueDate?: string;
  lastCompletedDate?: string;
  lastAssessmentDate?: string;
  identifiedAt: string;
  addressedAt?: string;
  declinedReason?: string;
  notes?: string;
  aiReasoning?: string;
  dataSourcesSummary?: {
    claims: string[];
    fhirRecords: string[];
    vaccinations: string[];
  };
}

// Vaccination Record
export interface VaccinationRecord {
  id: string;
  patientId: string;
  vaccineName: string;
  cvxCode?: string;
  manufacturer?: string;
  lotNumber?: string;
  administrationDate: string;
  expirationDate?: string;
  site?: string;
  route?: string;
  administeredBy?: string;
  facility?: string;
  doseNumber?: number;
  seriesComplete?: boolean;
  nextDoseDate?: string;
  ehrConnectionId?: string;
  status: "completed" | "entered_in_error" | "not_done";
}

// Claims Data Summary (for care gap analysis)
export interface ClaimsSummary {
  patientId: string;
  claimType: "professional" | "institutional" | "pharmacy" | "dental" | "vision";
  serviceDate: string;
  diagnosisCodes: string[];
  procedureCodes: string[];
  providerSpecialty?: string;
  placeOfService?: string;
  amountPaid?: number;
}

// Patient Preventive Care Summary
export interface PatientPreventiveSummary {
  patientId: string;
  patientName: string;
  age: number;
  gender: string;
  dateOfBirth: string;
  recommendations: UspstfRecommendation[];
  careGaps: CareGap[];
  vaccinationHistory: VaccinationRecord[];
  lastScreenings: {
    screeningType: string;
    date: string;
    result?: string;
    provider?: string;
  }[];
  riskFactors: string[];
  aiSummary?: string;
  aiGeneratedAt?: string;
  overallComplianceScore: number;
  nextActions: {
    action: string;
    priority: CareGapPriority;
    dueDate?: string;
    reasoning?: string;
  }[];
}

// AI Care Gap Analysis Request/Response
export interface CareGapAnalysisRequest {
  patientId: string;
  includeVaccinations: boolean;
  includeClaims: boolean;
  includeFhirRecords: boolean;
  focusCategories?: RecommendationCategory[];
}

export interface CareGapAnalysisResponse {
  patientId: string;
  analysisDate: string;
  careGaps: CareGap[];
  summary: string;
  keyFindings: string[];
  prioritizedRecommendations: {
    recommendation: UspstfRecommendation;
    priority: CareGapPriority;
    reasoning: string;
    evidenceFromRecords: string[];
  }[];
  vaccineGaps: {
    vaccineName: string;
    status: "overdue" | "due_soon" | "up_to_date";
    lastDose?: string;
    nextDueDate?: string;
    recommendation: string;
  }[];
  confidenceScore: number;
  dataSources: {
    type: string;
    recordCount: number;
    dateRange: { start: string; end: string };
  }[];
}

export const insertCareGapSchema = z.object({
  patientId: z.string(),
  recommendationId: z.string(),
  status: z.enum(careGapStatuses).default("open"),
  priority: z.enum(careGapPriorities).default("medium"),
  dueDate: z.string().optional(),
  lastCompletedDate: z.string().optional(),
  notes: z.string().optional(),
  aiReasoning: z.string().optional(),
});
export type InsertCareGap = z.infer<typeof insertCareGapSchema>;

export const insertVaccinationSchema = z.object({
  patientId: z.string(),
  vaccineName: z.string().min(1),
  cvxCode: z.string().optional(),
  manufacturer: z.string().optional(),
  lotNumber: z.string().optional(),
  administrationDate: z.string(),
  expirationDate: z.string().optional(),
  site: z.string().optional(),
  route: z.string().optional(),
  administeredBy: z.string().optional(),
  facility: z.string().optional(),
  doseNumber: z.number().optional(),
  seriesComplete: z.boolean().optional(),
  nextDoseDate: z.string().optional(),
  ehrConnectionId: z.string().optional(),
  status: z.enum(["completed", "entered_in_error", "not_done"]).default("completed"),
});
export type InsertVaccination = z.infer<typeof insertVaccinationSchema>;

// ============================================
// PATIENT ONBOARDING
// ============================================

export const onboardingSteps = [
  "welcome",
  "personal_info",
  "medical_history",
  "medications",
  "allergies",
  "emergency_contacts",
  "insurance",
  "rpm_devices",
  "health_assessment",
  "document_upload",
  "consent",
  "complete",
] as const;
export type OnboardingStep = (typeof onboardingSteps)[number];

export const rpmDeviceTypes = [
  "blood_pressure_monitor",
  "glucose_monitor",
  "pulse_oximeter",
  "weight_scale",
  "thermometer",
  "heart_rate_monitor",
  "activity_tracker",
  "spirometer",
  "ecg_monitor",
  "sleep_tracker",
] as const;
export type RpmDeviceType = (typeof rpmDeviceTypes)[number];

export const deviceConnectionStatus = ["pending", "connecting", "connected", "failed", "disconnected"] as const;
export type DeviceConnectionStatus = (typeof deviceConnectionStatus)[number];

export const uploadedDocumentTypes = [
  "insurance_card",
  "id_document",
  "medical_record",
  "lab_result",
  "imaging",
  "prescription",
  "referral",
  "discharge_summary",
  "advance_directive",
  "immunization_record",
  "other",
] as const;
export type UploadedDocumentType = (typeof uploadedDocumentTypes)[number];

export interface PatientOnboardingSession {
  id: string;
  patientId?: string;
  userId: string;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  formData: PatientOnboardingFormData;
  aiExtractedData?: AiExtractedFormData;
  personalizedWelcome?: PersonalizedWelcome;
  healthAssessment?: InitialHealthAssessment;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  isComplete: boolean;
}

export interface PatientOnboardingFormData {
  personalInfo?: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    preferredLanguage?: string;
    preferredContactMethod?: string;
  };
  medicalHistory?: {
    conditions: string[];
    surgeries: { name: string; date: string; notes?: string }[];
    familyHistory: { condition: string; relation: string }[];
    immunizations: { name: string; date?: string }[];
  };
  medications?: {
    name: string;
    dosage: string;
    frequency: string;
    prescribedBy?: string;
    startDate?: string;
  }[];
  allergies?: {
    allergen: string;
    reaction: string;
    severity: "mild" | "moderate" | "severe";
  }[];
  emergencyContacts?: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
    isPrimaryContact: boolean;
  }[];
  insurance?: {
    provider: string;
    policyNumber: string;
    groupNumber?: string;
    subscriberName?: string;
    subscriberDob?: string;
    relationship?: string;
  };
  lifestyle?: {
    smokingStatus?: string;
    alcoholUse?: string;
    exerciseFrequency?: string;
    dietaryRestrictions?: string[];
    sleepQuality?: string;
    stressLevel?: string;
  };
  consent?: {
    termsAccepted: boolean;
    privacyPolicyAccepted: boolean;
    dataProcessingConsent: boolean;
    communicationConsent: boolean;
    signatureData?: string;
    signedAt?: string;
  };
}

export interface AiExtractedFormData {
  extractedFrom: string;
  extractedAt: string;
  confidence: number;
  fields: {
    fieldName: string;
    value: string;
    confidence: number;
    source: string;
  }[];
  suggestions?: string[];
}

export interface PersonalizedWelcome {
  greeting: string;
  introduction: string;
  keyBenefits: string[];
  recommendedActions: string[];
  healthFocusAreas?: string[];
  estimatedTime: string;
  generatedAt: string;
}

export interface RpmDeviceRegistration {
  id: string;
  onboardingSessionId: string;
  patientId?: string;
  deviceType: RpmDeviceType;
  deviceName: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  connectionStatus: DeviceConnectionStatus;
  pairingCode?: string;
  lastSyncAt?: string;
  setupInstructions?: RpmSetupInstructions;
  createdAt: string;
  updatedAt: string;
}

export interface RpmSetupInstructions {
  deviceType: RpmDeviceType;
  steps: {
    stepNumber: number;
    title: string;
    description: string;
    imageUrl?: string;
    videoUrl?: string;
    tips?: string[];
  }[];
  troubleshooting: {
    issue: string;
    solution: string;
  }[];
  estimatedSetupTime: string;
  requirements?: string[];
}

export interface InitialHealthAssessment {
  id: string;
  onboardingSessionId: string;
  patientId?: string;
  questions: HealthAssessmentQuestion[];
  responses: HealthAssessmentResponse[];
  aiAnalysis?: HealthAssessmentAnalysis;
  completedAt?: string;
  createdAt: string;
}

export interface HealthAssessmentQuestion {
  id: string;
  category: string;
  question: string;
  type: "text" | "single_choice" | "multiple_choice" | "scale" | "boolean";
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: { min: string; max: string };
  isRequired: boolean;
  order: number;
}

export interface HealthAssessmentResponse {
  questionId: string;
  answer: string | string[] | number | boolean;
  answeredAt: string;
}

export interface HealthAssessmentAnalysis {
  overallHealthScore: number;
  riskLevel: "low" | "moderate" | "high";
  keyFindings: string[];
  recommendations: string[];
  areasOfConcern: {
    area: string;
    severity: "mild" | "moderate" | "severe";
    recommendation: string;
  }[];
  followUpSuggestions: string[];
  analyzedAt: string;
  confidence: number;
}

export interface UploadedDocument {
  id: string;
  onboardingSessionId?: string;
  patientId: string;
  documentType: UploadedDocumentType;
  title: string;
  documentDate?: string;
  tags: string[];
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  storageUrl: string;
  thumbnailUrl?: string;
  uploadedAt: string;
  processedAt?: string;
  aiExtractedData?: {
    documentType: string;
    extractedFields: Record<string, string>;
    confidence: number;
    summary?: string;
  };
  isVerified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  scanStatus?: "pending" | "clean" | "suspicious" | "error";
  scanMessage?: string;
  linkedRecordType?: string;
  linkedRecordId?: string;
  providerName?: string;
}

// Insert schemas
export const insertPatientOnboardingSessionSchema = z.object({
  userId: z.string().min(1),
  patientId: z.string().optional(),
  currentStep: z.enum(onboardingSteps).default("welcome"),
  completedSteps: z.array(z.enum(onboardingSteps)).default([]),
  formData: z.any().default({}),
  aiExtractedData: z.any().optional(),
  personalizedWelcome: z.any().optional(),
  healthAssessment: z.any().optional(),
  isComplete: z.boolean().default(false),
});
export type InsertPatientOnboardingSession = z.infer<typeof insertPatientOnboardingSessionSchema>;

export const insertRpmDeviceRegistrationSchema = z.object({
  onboardingSessionId: z.string().min(1),
  patientId: z.string().optional(),
  deviceType: z.enum(rpmDeviceTypes),
  deviceName: z.string().min(1),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  connectionStatus: z.enum(deviceConnectionStatus).default("pending"),
  pairingCode: z.string().optional(),
  setupInstructions: z.any().optional(),
});
export type InsertRpmDeviceRegistration = z.infer<typeof insertRpmDeviceRegistrationSchema>;

export const insertUploadedDocumentSchema = z.object({
  onboardingSessionId: z.string().optional(),
  patientId: z.string().min(1),
  documentType: z.enum(uploadedDocumentTypes),
  title: z.string().min(1).max(255),
  documentDate: z.string().optional(),
  tags: z.array(z.string()).default([]),
  fileName: z.string().min(1),
  originalFileName: z.string().min(1),
  mimeType: z.string().min(1),
  fileSize: z.number().positive(),
  storageUrl: z.string().min(1),
  thumbnailUrl: z.string().optional(),
  aiExtractedData: z.any().optional(),
  isVerified: z.boolean().default(false),
  notes: z.string().optional(),
  scanStatus: z.enum(["pending", "clean", "suspicious", "error"]).default("pending"),
  scanMessage: z.string().optional(),
  linkedRecordType: z.string().optional(),
  linkedRecordId: z.string().optional(),
  providerName: z.string().optional(),
});
export type InsertUploadedDocument = z.infer<typeof insertUploadedDocumentSchema>;

// Document upload analytics schema
export const documentUploadAnalyticsSchema = z.object({
  eventType: z.enum(["document_upload_started", "document_upload_success", "document_upload_failed"]),
  metadata: z.record(z.string()).optional(),
});
export type DocumentUploadAnalyticsEvent = z.infer<typeof documentUploadAnalyticsSchema>;

// ============================================
// CARE FACILITY ONBOARDING
// ============================================

export const facilityTypes = [
  "hospital",
  "primary_care",
  "specialist",
  "urgent_care",
  "emergency",
  "lab",
  "imaging",
  "pharmacy",
  "telehealth",
  "physical_therapy",
  "mental_health",
  "dental",
  "vision",
  "other",
] as const;
export type FacilityType = (typeof facilityTypes)[number];

export const serviceTypes = [
  "office_visits",
  "emergency_visit",
  "surgery_procedure",
  "imaging",
  "lab_tests",
  "hospital_admission",
  "physical_therapy",
  "mental_health",
  "dental",
  "vision",
  "telehealth",
  "other",
] as const;
export type ServiceType = (typeof serviceTypes)[number];

export const portalStatus = ["yes", "no", "not_sure"] as const;
export type PortalStatus = (typeof portalStatus)[number];

export const ehrVendors = [
  "fastenhealth",
  "other",
  "unknown",
] as const;
export type EhrVendor = (typeof ehrVendors)[number];

export interface CareFacility {
  id: string;
  name: string;
  aliases: string[];
  facilityType: FacilityType;
  city: string;
  state: string;
  country: string;
  zipCode?: string;
  address?: string;
  phone?: string;
  website?: string;
  npi?: string;
  healthSystemId?: string;
  healthSystemName?: string;
  ehrVendor?: EhrVendor;
  supportsFhir: boolean | null;
  fhirBaseUrl?: string;
  patientPortalUrl?: string;
  logoUrl?: string;
  notes?: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PatientCareFacility {
  id: string;
  patientId: string;
  facilityId?: string;
  facilityName: string;
  facilityType: FacilityType;
  city: string;
  state: string;
  country: string;
  firstVisitYear?: number;
  lastVisitYear?: number;
  visitDateUnsure: boolean;
  servicesReceived: ServiceType[];
  hasPortalAccount: PortalStatus;
  knowsPortalLogin: boolean | null;
  isManualEntry: boolean;
  phone?: string;
  website?: string;
  notes?: string;
  connectionStatus?: "pending" | "connected" | "failed" | "not_supported";
  ehrConnectionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FacilityOnboardingSession {
  id: string;
  patientId: string;
  currentStep: number;
  selectedFacilityTypes: FacilityType[];
  facilities: PatientCareFacility[];
  quickPickLabs: string[];
  quickPickImaging: string[];
  isComplete: boolean;
  skippedAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export const insertPatientCareFacilitySchema = z.object({
  patientId: z.string().min(1),
  facilityId: z.string().optional(),
  facilityName: z.string().min(1),
  facilityType: z.enum(facilityTypes),
  city: z.string().min(1),
  state: z.string().min(1),
  country: z.string().default("USA"),
  firstVisitYear: z.number().min(1900).max(2100).optional(),
  lastVisitYear: z.number().min(1900).max(2100).optional(),
  visitDateUnsure: z.boolean().default(false),
  servicesReceived: z.array(z.enum(serviceTypes)).default([]),
  hasPortalAccount: z.enum(portalStatus).default("not_sure"),
  knowsPortalLogin: z.boolean().nullable().default(null),
  isManualEntry: z.boolean().default(false),
  phone: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
});
export type InsertPatientCareFacility = z.infer<typeof insertPatientCareFacilitySchema>;

export const facilitySearchResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()).optional(),
  facilityType: z.enum(facilityTypes),
  city: z.string(),
  state: z.string(),
  country: z.string(),
  phone: z.string().optional(),
  website: z.string().optional(),
  npi: z.string().optional(),
  healthSystemId: z.string().optional(),
  healthSystemName: z.string().optional(),
  ehrVendor: z.enum(ehrVendors).optional(),
  supportsFhir: z.boolean().nullable(),
  fhirBaseUrl: z.string().optional(),
  patientPortalUrl: z.string().optional(),
  notes: z.string().optional(),
  matchScore: z.number(),
});
export type FacilitySearchResult = z.infer<typeof facilitySearchResultSchema>;

export const facilityOnboardingAnalyticsSchema = z.object({
  eventType: z.enum([
    "facility_onboarding_started",
    "facility_search_used",
    "facility_selected",
    "facility_manual_added",
    "facility_onboarding_completed",
    "facility_portal_known_yes",
    "facility_portal_known_no",
    "facility_skipped",
  ]),
  metadata: z.record(z.string()).optional(),
});
export type FacilityOnboardingAnalyticsEvent = z.infer<typeof facilityOnboardingAnalyticsSchema>;

// ============================================
// DOCUMENT AUTO-TAGGING SYSTEM
// ============================================

// Auto-tag document categories per acceptance criteria
export const autoTagCategories = [
  "discharge_summary",
  "lab",
  "imaging",
  "insurance",
  "referral",
  "other",
] as const;
export type AutoTagCategory = (typeof autoTagCategories)[number];

// Auto-tag result with explainability
export interface DocumentAutoTag {
  id: string;
  documentId: string;
  category: AutoTagCategory;
  confidence: number;
  explanation: string; // Why the document was tagged this way
  suggestedTags: string[];
  isOverridden: boolean;
  overriddenCategory?: AutoTagCategory;
  overriddenAt?: string;
  overriddenBy?: string;
  overrideReason?: string;
  createdAt: string;
  updatedAt: string;
}

// Schema for auto-tag API response
export const documentAutoTagResultSchema = z.object({
  category: z.enum(autoTagCategories),
  confidence: z.number().min(0).max(100),
  explanation: z.string(),
  suggestedTags: z.array(z.string()),
  extractedMetadata: z.object({
    date: z.string().nullable().optional(),
    facility: z.string().nullable().optional(),
    provider: z.string().nullable().optional(),
    testName: z.string().nullable().optional(),
  }).optional(),
});
export type DocumentAutoTagResult = z.infer<typeof documentAutoTagResultSchema>;

// Schema for overriding auto-tags
export const documentTagOverrideSchema = z.object({
  documentId: z.string().min(1),
  newCategory: z.enum(autoTagCategories),
  newTags: z.array(z.string()).optional(),
  reason: z.string().optional(),
});
export type DocumentTagOverride = z.infer<typeof documentTagOverrideSchema>;

// Auto-tag analytics events
export const autoTagAnalyticsSchema = z.object({
  eventType: z.enum(["doc_autotag_applied", "doc_autotag_overridden"]),
  metadata: z.record(z.string()).optional(),
});
export type AutoTagAnalyticsEvent = z.infer<typeof autoTagAnalyticsSchema>;

// File upload size limits (in bytes)
export const FILE_UPLOAD_LIMITS = {
  maxFileSize: 25 * 1024 * 1024, // 25 MB
  allowedMimeTypes: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",
  ],
  allowedExtensions: [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif"],
} as const;

// ============================================
// EXPLAIN ANYTHING (AI, NON-CLINICAL)
// ============================================

// Explanation source quote (quote-first reference)
export interface ExplanationSourceQuote {
  text: string;         // The quoted text from the record
  source: string;       // Where it came from (e.g., "Lab Results - 2024-01-15")
  date?: string;        // Date of the source record
  recordType?: string;  // Type of record (lab_result, diagnosis, etc.)
  recordId?: string;    // ID of the source record for linking
}

// Explanation response from AI
export interface ExplanationResponse {
  id: string;
  term: string;                       // The term/phrase being explained
  plainEnglish: string;               // Simple explanation
  sourceQuote?: ExplanationSourceQuote; // Quote-first reference when applicable
  questionsForDoctor: string[];       // Safe questions to ask clinician
  relatedTerms?: string[];            // Other terms user might want to explore
  disclaimer: string;                 // Always "Informational only. Not medical advice."
  generatedAt: string;
}

// Explanation analytics events
export const explainAnalyticsEvents = [
  "explain_opened",
  "explain_generated",
  "explain_viewed_sources",
  "explain_feedback_helpful_yes",
  "explain_feedback_helpful_no",
] as const;
export type ExplainAnalyticsEvent = (typeof explainAnalyticsEvents)[number];

// Schema for explain request
export const explainRequestSchema = z.object({
  term: z.string().min(1, "Term is required"),
  context: z.string().optional(),
  recordType: z.enum(["lab_result", "diagnosis", "procedure", "medication", "imaging", "vital_sign", "allergy", "encounter", "immunization", "general"]).optional(),
  sourceQuote: z.object({
    text: z.string(),
    source: z.string(),
    date: z.string().optional(),
    recordId: z.string().optional(),
  }).optional(),
});
export type ExplainRequest = z.infer<typeof explainRequestSchema>;

// Schema for explain analytics
export const explainAnalyticsSchema = z.object({
  eventType: z.enum(explainAnalyticsEvents),
  term: z.string().optional(),
  explanationId: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});
export type ExplainAnalytics = z.infer<typeof explainAnalyticsSchema>;

// Schema for explanation feedback
export const explainFeedbackSchema = z.object({
  explanationId: z.string().min(1),
  helpful: z.boolean(),
  comment: z.string().optional(),
});
export type ExplainFeedback = z.infer<typeof explainFeedbackSchema>;

// ============================================
// AI GUARDRAIL ENFORCEMENT
// ============================================

// Guardrail trigger reasons
export const guardrailTriggerReasons = [
  "medical_advice_request",
  "diagnosis_request",
  "treatment_recommendation",
  "urgency_assessment",
  "medication_dosage",
  "symptom_severity",
] as const;
export type GuardrailTriggerReason = (typeof guardrailTriggerReasons)[number];

// Guardrail response when refusal is triggered
export interface GuardrailRefusalResponse {
  id: string;
  triggered: true;
  triggerReason: GuardrailTriggerReason;
  detectedPattern: string;
  originalPrompt: string;
  refusalMessage: string;
  clinicianHandoffMessage: string;
  suggestedActions: string[];
  timestamp: string;
}

// Guardrail pass response
export interface GuardrailPassResponse {
  triggered: false;
  originalPrompt: string;
}

export type GuardrailCheckResult = GuardrailRefusalResponse | GuardrailPassResponse;

// Guardrail analytics events
export const guardrailAnalyticsEvents = [
  "ai_guardrail_triggered",
  "ai_refusal_shown",
] as const;
export type GuardrailAnalyticsEvent = (typeof guardrailAnalyticsEvents)[number];

// Schema for guardrail analytics
export const guardrailAnalyticsSchema = z.object({
  eventType: z.enum(guardrailAnalyticsEvents),
  refusalId: z.string().optional(),
  triggerReason: z.enum(guardrailTriggerReasons).optional(),
  detectedPattern: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});
export type GuardrailAnalytics = z.infer<typeof guardrailAnalyticsSchema>;

export const insertHealthAssessmentSchema = z.object({
  onboardingSessionId: z.string().min(1),
  patientId: z.string().optional(),
  questions: z.array(z.any()),
  responses: z.array(z.any()).default([]),
  aiAnalysis: z.any().optional(),
});
export type InsertHealthAssessment = z.infer<typeof insertHealthAssessmentSchema>;

// ============================================
// PERSONAL HEALTH METRICS TRACKING
// ============================================

export const personalMetricTypes = [
  "weight",
  "blood_pressure_systolic",
  "blood_pressure_diastolic",
  "heart_rate",
  "blood_glucose",
  "steps",
  "sleep_hours",
  "water_intake",
  "mood",
  "pain_level",
  "energy_level",
  "stress_level",
  "exercise_minutes",
  "custom",
] as const;
export type PersonalMetricType = (typeof personalMetricTypes)[number];

export interface PersonalHealthMetric {
  id: string;
  patientId: string;
  metricType: PersonalMetricType;
  customName?: string;
  value: number;
  unit: string;
  notes?: string;
  source: "manual" | "device" | "ehr";
  deviceId?: string;
  recordedAt: string;
  createdAt: string;
}

export interface MetricGoal {
  id: string;
  patientId: string;
  metricType: PersonalMetricType;
  targetValue: number;
  comparison: "less_than" | "greater_than" | "between" | "equals";
  targetValueMax?: number;
  unit: string;
  frequency: "daily" | "weekly" | "monthly";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SharedHealthData {
  id: string;
  patientId: string;
  recipientType: "provider" | "caregiver" | "family" | "care_team";
  recipientId: string;
  recipientName: string;
  dataCategories: string[];
  accessLevel: "view" | "view_and_download";
  validFrom: string;
  validUntil?: string;
  isActive: boolean;
  createdAt: string;
  revokedAt?: string;
  lastAccessedAt?: string;
}

export interface HealthSummaryExport {
  patientId: string;
  generatedAt: string;
  format: "pdf" | "json" | "fhir";
  sections: {
    demographics: boolean;
    conditions: boolean;
    medications: boolean;
    allergies: boolean;
    labResults: boolean;
    vitals: boolean;
    immunizations: boolean;
    documents: boolean;
    carePlans: boolean;
  };
  dateRange?: {
    from: string;
    to: string;
  };
}

export const insertPersonalHealthMetricSchema = z.object({
  patientId: z.string().min(1),
  metricType: z.enum(personalMetricTypes),
  customName: z.string().optional(),
  value: z.number(),
  unit: z.string().min(1),
  notes: z.string().optional(),
  source: z.enum(["manual", "device", "ehr"]).default("manual"),
  deviceId: z.string().optional(),
  recordedAt: z.string().optional(),
});
export type InsertPersonalHealthMetric = z.infer<typeof insertPersonalHealthMetricSchema>;

export const insertMetricGoalSchema = z.object({
  patientId: z.string().min(1),
  metricType: z.enum(personalMetricTypes),
  targetValue: z.number(),
  comparison: z.enum(["less_than", "greater_than", "between", "equals"]),
  targetValueMax: z.number().optional(),
  unit: z.string().min(1),
  frequency: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  isActive: z.boolean().default(true),
});
export type InsertMetricGoal = z.infer<typeof insertMetricGoalSchema>;

export const insertSharedHealthDataSchema = z.object({
  patientId: z.string().min(1),
  recipientType: z.enum(["provider", "caregiver", "family", "care_team"]),
  recipientId: z.string().min(1),
  recipientName: z.string().min(1),
  dataCategories: z.array(z.string()).min(1),
  accessLevel: z.enum(["view", "view_and_download"]).default("view"),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
  isActive: z.boolean().default(true),
});
export type InsertSharedHealthData = z.infer<typeof insertSharedHealthDataSchema>;

// ============================================
// PATIENT HEALTH GOALS TRACKING SYSTEM
// ============================================

export const patientGoalTypes = [
  "weight_loss",
  "weight_gain",
  "blood_pressure",
  "blood_sugar",
  "cholesterol",
  "exercise_frequency",
  "exercise_duration",
  "steps",
  "sleep_hours",
  "water_intake",
  "medication_adherence",
  "diet",
  "smoking_cessation",
  "stress_reduction",
  "custom"
] as const;
export type PatientGoalType = typeof patientGoalTypes[number];

export const patientGoalStatuses = ["active", "completed", "paused", "cancelled"] as const;
export type PatientGoalStatus = typeof patientGoalStatuses[number];

export const goalLinkedResourceTypes = ["medication", "condition", "lab_result", "care_plan"] as const;
export type GoalLinkedResourceType = typeof goalLinkedResourceTypes[number];

export interface GoalLinkedResource {
  type: GoalLinkedResourceType;
  resourceId: string;
  resourceName: string;
  reason?: string;
}

export interface PatientHealthGoal {
  id: string;
  patientId: string;
  goalType: PatientGoalType;
  title: string;
  description?: string;
  targetValue: number;
  targetValueMax?: number;
  currentValue?: number;
  unit: string;
  comparison: "less_than" | "greater_than" | "between" | "equals" | "at_least";
  startDate: string;
  targetDate?: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly";
  status: PatientGoalStatus;
  linkedResources: GoalLinkedResource[];
  milestones?: PatientGoalMilestone[];
  reminderEnabled: boolean;
  reminderFrequency?: "daily" | "weekly";
  sharedWith: PatientGoalShare[];
  createdAt: string;
  updatedAt: string;
}

export interface PatientGoalMilestone {
  id: string;
  value: number;
  label: string;
  achievedAt?: string;
}

export interface PatientGoalProgress {
  id: string;
  goalId: string;
  patientId: string;
  value: number;
  notes?: string;
  recordedAt: string;
  source: "manual" | "device" | "ehr";
}

export interface PatientGoalShare {
  id: string;
  goalId: string;
  recipientType: "provider" | "caregiver" | "family";
  recipientId: string;
  recipientName: string;
  canComment: boolean;
  sharedAt: string;
}

export const insertPatientHealthGoalSchema = z.object({
  goalType: z.enum(patientGoalTypes),
  title: z.string().min(1, "Goal title is required"),
  description: z.string().optional(),
  targetValue: z.number(),
  targetValueMax: z.number().optional(),
  currentValue: z.number().optional(),
  unit: z.string().min(1),
  comparison: z.enum(["less_than", "greater_than", "between", "equals", "at_least"]),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly"]).default("weekly"),
  linkedResources: z.array(z.object({
    type: z.enum(goalLinkedResourceTypes),
    resourceId: z.string(),
    resourceName: z.string(),
    reason: z.string().optional(),
  })).default([]),
  reminderEnabled: z.boolean().default(false),
  reminderFrequency: z.enum(["daily", "weekly"]).optional(),
});
export type InsertPatientHealthGoal = z.infer<typeof insertPatientHealthGoalSchema>;

export const insertPatientGoalProgressSchema = z.object({
  goalId: z.string().min(1),
  value: z.number(),
  notes: z.string().optional(),
  recordedAt: z.string().optional(),
  source: z.enum(["manual", "device", "ehr"]).default("manual"),
});
export type InsertPatientGoalProgress = z.infer<typeof insertPatientGoalProgressSchema>;

export const insertPatientGoalShareSchema = z.object({
  goalId: z.string().min(1),
  recipientType: z.enum(["provider", "caregiver", "family"]),
  recipientId: z.string().min(1),
  recipientName: z.string().min(1),
  canComment: z.boolean().default(false),
});
export type InsertPatientGoalShare = z.infer<typeof insertPatientGoalShareSchema>;

// ============================================
// AI PROGRESS FEEDBACK CLINICIAN FLAGS
// ============================================

export const clinicianFlagSeverities = ["low", "medium", "high", "urgent"] as const;
export type ClinicianFlagSeverity = typeof clinicianFlagSeverities[number];

export const clinicianFlagCategories = ["non_adherence", "adverse_trend", "goal_revision", "intervention_needed", "patient_request"] as const;
export type ClinicianFlagCategory = typeof clinicianFlagCategories[number];

export const clinicianFlagStatuses = ["pending", "reviewed", "addressed", "dismissed"] as const;
export type ClinicianFlagStatus = typeof clinicianFlagStatuses[number];

export const createClinicianFlagSchema = z.object({
  severity: z.enum(clinicianFlagSeverities),
  category: z.enum(clinicianFlagCategories),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  relatedData: z.array(z.object({
    dataType: z.string(),
    metric: z.string(),
    values: z.string(),
    trend: z.string()
  })).default([]),
  suggestedAction: z.string().min(1, "Suggested action is required"),
  patientContext: z.string().optional()
});
export type CreateClinicianFlag = z.infer<typeof createClinicianFlagSchema>;

export const updateClinicianFlagSchema = z.object({
  status: z.enum(clinicianFlagStatuses).optional(),
  reviewNotes: z.string().optional()
});
export type UpdateClinicianFlag = z.infer<typeof updateClinicianFlagSchema>;

// ============================================
// AI-DRIVEN PATIENT COMMUNICATION SYSTEM
// ============================================

export const communicationChannels = ["email", "sms", "in_app", "push_notification"] as const;
export type CommunicationChannel = typeof communicationChannels[number];

export const communicationTypes = [
  "follow_up",
  "appointment_reminder",
  "screening_reminder",
  "medication_reminder",
  "lab_result_notification",
  "rpm_alert",
  "health_tip",
  "care_gap_alert",
  "query_response",
  "wellness_check",
  "post_encounter_summary",
] as const;
export type CommunicationType = typeof communicationTypes[number];

export const communicationStatuses = ["draft", "scheduled", "pending", "sent", "delivered", "failed", "cancelled"] as const;
export type CommunicationStatus = typeof communicationStatuses[number];

export const communicationPriorities = ["low", "normal", "high", "urgent"] as const;
export type CommunicationPriority = typeof communicationPriorities[number];

export const triggerTypes = ["manual", "scheduled", "event_based", "ai_proactive"] as const;
export type TriggerType = typeof triggerTypes[number];

export interface CommunicationTemplate {
  id: string;
  name: string;
  description?: string;
  communicationType: CommunicationType;
  channel: CommunicationChannel;
  subject?: string;
  bodyTemplate: string;
  variables: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const insertCommunicationTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
  communicationType: z.enum(communicationTypes),
  channel: z.enum(communicationChannels),
  subject: z.string().optional(),
  bodyTemplate: z.string().min(1, "Template body is required"),
  variables: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  createdBy: z.string().min(1),
});
export type InsertCommunicationTemplate = z.infer<typeof insertCommunicationTemplateSchema>;

export interface PatientCommunication {
  id: string;
  patientId: string;
  templateId?: string;
  communicationType: CommunicationType;
  channel: CommunicationChannel;
  priority: CommunicationPriority;
  subject?: string;
  content: string;
  aiGeneratedContent?: string;
  aiPromptUsed?: string;
  aiConfidence?: number;
  status: CommunicationStatus;
  triggerType: TriggerType;
  triggerEventId?: string;
  triggerEventType?: string;
  scheduledAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  failureReason?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  readAt?: string;
  responseReceived?: boolean;
  patientResponse?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const insertPatientCommunicationSchema = z.object({
  patientId: z.string().min(1),
  templateId: z.string().optional(),
  communicationType: z.enum(communicationTypes),
  channel: z.enum(communicationChannels),
  priority: z.enum(communicationPriorities).default("normal"),
  subject: z.string().optional(),
  content: z.string().min(1),
  aiGeneratedContent: z.string().optional(),
  aiPromptUsed: z.string().optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
  status: z.enum(communicationStatuses).default("draft"),
  triggerType: z.enum(triggerTypes).default("manual"),
  triggerEventId: z.string().optional(),
  triggerEventType: z.string().optional(),
  scheduledAt: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  recipientPhone: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type InsertPatientCommunication = z.infer<typeof insertPatientCommunicationSchema>;

export interface CommunicationRule {
  id: string;
  name: string;
  description?: string;
  communicationType: CommunicationType;
  channel: CommunicationChannel;
  triggerType: TriggerType;
  triggerConditions: {
    eventType?: string;
    daysAfterEvent?: number;
    daysBefore?: number;
    timeOfDay?: string;
    patientConditions?: string[];
    ageRange?: { min?: number; max?: number };
  };
  templateId?: string;
  useAiGeneration: boolean;
  aiPromptTemplate?: string;
  priority: CommunicationPriority;
  isActive: boolean;
  lastTriggeredAt?: string;
  triggerCount: number;
  createdAt: string;
  updatedAt: string;
}

export const insertCommunicationRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required"),
  description: z.string().optional(),
  communicationType: z.enum(communicationTypes),
  channel: z.enum(communicationChannels),
  triggerType: z.enum(triggerTypes),
  triggerConditions: z.object({
    eventType: z.string().optional(),
    daysAfterEvent: z.number().optional(),
    daysBefore: z.number().optional(),
    timeOfDay: z.string().optional(),
    patientConditions: z.array(z.string()).optional(),
    ageRange: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
  }).default({}),
  templateId: z.string().optional(),
  useAiGeneration: z.boolean().default(true),
  aiPromptTemplate: z.string().optional(),
  priority: z.enum(communicationPriorities).default("normal"),
  isActive: z.boolean().default(true),
});
export type InsertCommunicationRule = z.infer<typeof insertCommunicationRuleSchema>;

export interface PatientQueryResponse {
  id: string;
  patientId: string;
  query: string;
  queryCategory?: string;
  aiResponse: string;
  aiConfidence: number;
  aiReasoningSteps?: string[];
  relevantRecordIds?: string[];
  relevantMedicationIds?: string[];
  wasHelpful?: boolean;
  patientFeedback?: string;
  requiresFollowUp: boolean;
  followUpScheduled?: boolean;
  respondedAt: string;
  createdAt: string;
}

export const insertPatientQueryResponseSchema = z.object({
  patientId: z.string().min(1),
  query: z.string().min(1),
  queryCategory: z.string().optional(),
  aiResponse: z.string().min(1),
  aiConfidence: z.number().min(0).max(1),
  aiReasoningSteps: z.array(z.string()).optional(),
  relevantRecordIds: z.array(z.string()).optional(),
  relevantMedicationIds: z.array(z.string()).optional(),
  requiresFollowUp: z.boolean().default(false),
});
export type InsertPatientQueryResponse = z.infer<typeof insertPatientQueryResponseSchema>;

// ============================================
// HEALTH JOURNALING SYSTEM
// ============================================

export const journalEventTypes = [
  "medication_taken",
  "medication_missed",
  "vital_logged",
  "appointment_attended",
  "appointment_missed",
  "lab_result_received",
  "education_completed",
  "symptom_reported",
  "mood_logged",
  "exercise_logged",
  "sleep_logged",
  "diet_logged",
  "manual_entry",
] as const;
export type JournalEventType = typeof journalEventTypes[number];

export const journalEntrySources = ["automatic", "manual", "voice", "wearable"] as const;
export type JournalEntrySource = typeof journalEntrySources[number];

export const moodLevels = ["very_low", "low", "neutral", "good", "excellent"] as const;
export type MoodLevel = typeof moodLevels[number];

export const sentimentTypes = ["negative", "neutral", "positive", "concerning"] as const;
export type SentimentType = typeof sentimentTypes[number];

export interface JournalEntry {
  id: string;
  patientId: string;
  eventType: JournalEventType;
  source: JournalEntrySource;
  title: string;
  content?: string;
  mood?: MoodLevel;
  symptoms?: string[];
  relatedEntityId?: string;
  relatedEntityType?: string;
  metadata?: Record<string, unknown>;
  aiAnalysis?: JournalAIAnalysis;
  timestamp: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalAIAnalysis {
  sentiment: SentimentType;
  sentimentScore: number;
  detectedSymptoms: string[];
  concerningIndicators: string[];
  positiveIndicators: string[];
  suggestedFollowUp?: string;
  healthTrends?: string[];
  confidenceScore: number;
  analyzedAt: string;
}

export const insertJournalEntrySchema = z.object({
  patientId: z.string().min(1),
  eventType: z.enum(journalEventTypes),
  source: z.enum(journalEntrySources).default("manual"),
  title: z.string().min(1, "Title is required"),
  content: z.string().optional(),
  mood: z.enum(moodLevels).optional(),
  symptoms: z.array(z.string()).optional(),
  relatedEntityId: z.string().optional(),
  relatedEntityType: z.string().optional(),
  metadata: z.any().optional(),
  timestamp: z.string().optional(),
});
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;

export interface JournalSummary {
  id: string;
  patientId: string;
  periodType: "daily" | "weekly" | "monthly";
  periodStart: string;
  periodEnd: string;
  totalEntries: number;
  eventBreakdown: Record<JournalEventType, number>;
  overallSentiment: SentimentType;
  averageMood?: number;
  aiSummary: string;
  keyHighlights: string[];
  concerningTrends: string[];
  positiveAchievements: string[];
  recommendations: string[];
  medicationAdherence?: number;
  symptomFrequency: Record<string, number>;
  generatedAt: string;
}

export const insertJournalSummarySchema = z.object({
  patientId: z.string().min(1),
  periodType: z.enum(["daily", "weekly", "monthly"]),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
});
export type InsertJournalSummary = z.infer<typeof insertJournalSummarySchema>;

// ============================================
// ANALYTICS DASHBOARD SYSTEM
// ============================================

// Engagement Metrics
export interface EngagementMetric {
  id: string;
  userId: string;
  metricType: "login" | "feature_use" | "session_duration" | "page_view" | "action_completed";
  featureName?: string;
  value: number;
  metadata?: Record<string, unknown>;
  timestamp: string;
  createdAt: string;
}

export const insertEngagementMetricSchema = z.object({
  userId: z.string().min(1),
  metricType: z.enum(["login", "feature_use", "session_duration", "page_view", "action_completed"]),
  featureName: z.string().optional(),
  value: z.number().default(1),
  metadata: z.any().optional(),
  timestamp: z.string().optional(),
});
export type InsertEngagementMetric = z.infer<typeof insertEngagementMetricSchema>;

// User Satisfaction Scores (SUS, NPS)
export interface SatisfactionScore {
  id: string;
  userId: string;
  scoreType: "sus" | "nps" | "csat" | "ces";
  score: number;
  maxScore: number;
  feedback?: string;
  surveyId?: string;
  responses?: Record<string, unknown>;
  timestamp: string;
  createdAt: string;
}

export const insertSatisfactionScoreSchema = z.object({
  userId: z.string().min(1),
  scoreType: z.enum(["sus", "nps", "csat", "ces"]),
  score: z.number(),
  maxScore: z.number(),
  feedback: z.string().optional(),
  surveyId: z.string().optional(),
  responses: z.any().optional(),
});
export type InsertSatisfactionScore = z.infer<typeof insertSatisfactionScoreSchema>;

// Safety Incident Reports
export const incidentSeverityLevels = ["low", "medium", "high", "critical"] as const;
export type IncidentSeverity = typeof incidentSeverityLevels[number];

export const incidentStatuses = ["reported", "investigating", "resolved", "closed"] as const;
export type IncidentStatus = typeof incidentStatuses[number];

export interface SafetyIncident {
  id: string;
  reporterId: string;
  patientId?: string;
  incidentType: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  affectedFeatures?: string[];
  rootCause?: string;
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  metadata?: Record<string, unknown>;
  reportedAt: string;
  createdAt: string;
  updatedAt: string;
}

export const insertSafetyIncidentSchema = z.object({
  reporterId: z.string().min(1),
  patientId: z.string().optional(),
  incidentType: z.string().min(1),
  severity: z.enum(incidentSeverityLevels),
  title: z.string().min(1),
  description: z.string().min(1),
  affectedFeatures: z.array(z.string()).optional(),
  metadata: z.any().optional(),
});
export type InsertSafetyIncident = z.infer<typeof insertSafetyIncidentSchema>;

// Feature Usage Analytics
export interface FeatureUsage {
  id: string;
  featureName: string;
  totalUsage: number;
  uniqueUsers: number;
  successRate: number;
  avgCompletionTime: number;
  abandonmentRate: number;
  lastUsed: string;
  trendDirection: "up" | "down" | "stable";
  trendPercentage: number;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

// Task Success Metrics
export interface TaskSuccessMetric {
  id: string;
  taskName: string;
  taskCategory: string;
  totalAttempts: number;
  successfulCompletions: number;
  failures: number;
  abandonments: number;
  successRate: number;
  avgTimeToComplete: number;
  errorTypes?: Record<string, number>;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
}

// Churn Prediction
export interface ChurnPrediction {
  id: string;
  userId: string;
  churnRisk: "low" | "medium" | "high" | "critical";
  churnProbability: number;
  riskFactors: string[];
  lastActiveDate: string;
  daysSinceLastLogin: number;
  engagementScore: number;
  recommendedActions: string[];
  predictedAt: string;
  createdAt: string;
}

// Analytics Dashboard Summary
export interface AnalyticsDashboardSummary {
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  avgSessionDuration: number;
  taskSuccessRate: number;
  avgNpsScore: number;
  avgSusScore: number;
  openIncidents: number;
  criticalIncidents: number;
  highRiskChurnUsers: number;
  lowAdoptionFeatures: string[];
  topFeatures: { name: string; usage: number }[];
  engagementTrend: { date: string; value: number }[];
  satisfactionTrend: { date: string; nps: number; sus: number }[];
}

// ============================================
// PROACTIVE HEALTH MONITORING SYSTEM
// ============================================

export const healthAlertSeverity = ["critical", "high", "medium", "low"] as const;
export type HealthAlertSeverity = typeof healthAlertSeverity[number];

export const healthAlertCategory = [
  "vital_signs",
  "lab_results",
  "prom_scores",
  "medication_adherence",
  "symptom_progression",
  "journal_sentiment",
  "care_plan_deviation",
  "composite_risk",
] as const;
export type HealthAlertCategory = typeof healthAlertCategory[number];

export const healthAlertStatus = [
  "new",
  "acknowledged",
  "in_progress",
  "resolved",
  "escalated",
  "dismissed",
] as const;
export type HealthAlertStatus = typeof healthAlertStatus[number];

export const interventionType = [
  "medication_adjustment",
  "care_plan_modification",
  "urgent_consultation",
  "lifestyle_recommendation",
  "monitoring_frequency_increase",
  "patient_outreach",
  "specialist_referral",
  "emergency_protocol",
] as const;
export type InterventionType = typeof interventionType[number];

export const interventionPriority = ["immediate", "urgent", "routine", "elective"] as const;
export type InterventionPriority = typeof interventionPriority[number];

export const interventionStatus = [
  "recommended",
  "approved",
  "in_progress",
  "completed",
  "declined",
  "deferred",
] as const;
export type InterventionStatus = typeof interventionStatus[number];

export interface HealthMonitoringAlert {
  id: string;
  patientId: string;
  patientName: string;
  severity: HealthAlertSeverity;
  category: HealthAlertCategory;
  status: HealthAlertStatus;
  title: string;
  description: string;
  aiAnalysis: string;
  triggerData: {
    dataType: string;
    dataPoints: { label: string; value: string; date: string; isAbnormal: boolean }[];
    threshold?: { min?: number; max?: number; unit: string };
    detectedPattern: string;
  };
  riskScore: number;
  confidenceScore: number;
  relatedConditions: string[];
  relatedMedications: string[];
  earlyWarningSignals: string[];
  recommendedActions: string[];
  assignedTo?: string;
  assignedToName?: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  escalatedTo?: string;
  escalatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InterventionRecommendation {
  id: string;
  alertId: string;
  patientId: string;
  type: InterventionType;
  priority: InterventionPriority;
  status: InterventionStatus;
  title: string;
  description: string;
  rationale: string;
  expectedOutcome: string;
  evidenceBasis: string[];
  actionSteps: {
    step: number;
    action: string;
    responsible: string;
    dueDate?: string;
    completed: boolean;
  }[];
  estimatedImpact: {
    riskReduction: number;
    timeToEffect: string;
    confidence: number;
  };
  contraindications: string[];
  alternativeOptions: {
    type: InterventionType;
    description: string;
    tradeoffs: string;
  }[];
  approvedBy?: string;
  approvedAt?: string;
  completedBy?: string;
  completedAt?: string;
  outcomeNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientMonitoringSummary {
  patientId: string;
  patientName: string;
  overallRiskLevel: HealthAlertSeverity;
  riskScore: number;
  activeAlerts: number;
  criticalAlerts: number;
  pendingInterventions: number;
  lastAssessmentDate: string;
  vitalTrends: {
    type: string;
    trend: "improving" | "stable" | "worsening" | "critical";
    latestValue: string;
    unit: string;
    changePercent: number;
  }[];
  labTrends: {
    testName: string;
    trend: "improving" | "stable" | "worsening" | "critical";
    latestValue: string;
    unit: string;
    status: "normal" | "abnormal" | "critical";
  }[];
  promScores: {
    questionnaireName: string;
    latestScore: number;
    trend: "improving" | "stable" | "worsening";
    severity: string;
  }[];
  adherenceRate: number;
  lastActivity: string;
  conditions: string[];
  medications: string[];
}

export interface MonitoringDashboard {
  summary: {
    totalMonitoredPatients: number;
    criticalAlerts: number;
    highPriorityAlerts: number;
    pendingInterventions: number;
    resolvedToday: number;
    avgResponseTime: number;
  };
  alertsByCategory: { category: HealthAlertCategory; count: number }[];
  alertsBySeverity: { severity: HealthAlertSeverity; count: number }[];
  trendData: { date: string; critical: number; high: number; medium: number; low: number }[];
  topRiskPatients: PatientMonitoringSummary[];
  recentAlerts: HealthMonitoringAlert[];
  pendingInterventions: InterventionRecommendation[];
}

export const insertHealthMonitoringAlertSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  severity: z.enum(healthAlertSeverity),
  category: z.enum(healthAlertCategory),
  status: z.enum(healthAlertStatus).default("new"),
  title: z.string().min(1),
  description: z.string().min(1),
  aiAnalysis: z.string().min(1),
  triggerData: z.object({
    dataType: z.string(),
    dataPoints: z.array(z.object({
      label: z.string(),
      value: z.string(),
      date: z.string(),
      isAbnormal: z.boolean(),
    })),
    threshold: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
      unit: z.string(),
    }).optional(),
    detectedPattern: z.string(),
  }),
  riskScore: z.number().min(0).max(100),
  confidenceScore: z.number().min(0).max(100),
  relatedConditions: z.array(z.string()).default([]),
  relatedMedications: z.array(z.string()).default([]),
  earlyWarningSignals: z.array(z.string()).default([]),
  recommendedActions: z.array(z.string()).default([]),
  assignedTo: z.string().optional(),
  assignedToName: z.string().optional(),
});
export type InsertHealthMonitoringAlert = z.infer<typeof insertHealthMonitoringAlertSchema>;

export const insertInterventionRecommendationSchema = z.object({
  alertId: z.string().min(1),
  patientId: z.string().min(1),
  type: z.enum(interventionType),
  priority: z.enum(interventionPriority),
  status: z.enum(interventionStatus).default("recommended"),
  title: z.string().min(1),
  description: z.string().min(1),
  rationale: z.string().min(1),
  expectedOutcome: z.string().min(1),
  evidenceBasis: z.array(z.string()).default([]),
  actionSteps: z.array(z.object({
    step: z.number(),
    action: z.string(),
    responsible: z.string(),
    dueDate: z.string().optional(),
    completed: z.boolean().default(false),
  })),
  estimatedImpact: z.object({
    riskReduction: z.number().min(0).max(100),
    timeToEffect: z.string(),
    confidence: z.number().min(0).max(100),
  }),
  contraindications: z.array(z.string()).default([]),
  alternativeOptions: z.array(z.object({
    type: z.enum(interventionType),
    description: z.string(),
    tradeoffs: z.string(),
  })).default([]),
});
export type InsertInterventionRecommendation = z.infer<typeof insertInterventionRecommendationSchema>;

// Request validation schemas for health monitoring API
export const resolveAlertRequestSchema = z.object({
  notes: z.string().default(""),
});
export type ResolveAlertRequest = z.infer<typeof resolveAlertRequestSchema>;

export const escalateAlertRequestSchema = z.object({
  escalateTo: z.string().min(1, "Escalation target is required"),
});
export type EscalateAlertRequest = z.infer<typeof escalateAlertRequestSchema>;

export const completeInterventionRequestSchema = z.object({
  notes: z.string().default(""),
});
export type CompleteInterventionRequest = z.infer<typeof completeInterventionRequestSchema>;

// ============================================
// PROVIDER INTEGRATION SYSTEM
// ============================================

// EHR System Types
export const ehrSystemTypes = ["fastenhealth"] as const;
export type EhrSystemType = typeof ehrSystemTypes[number];

export const ehrConnectionStatuses = ["pending", "connected", "disconnected", "error", "expired", "revoked"] as const;
export type EhrConnectionStatus = typeof ehrConnectionStatuses[number];

// Note: fhirResourceTypes and FhirResourceType are defined in the DATA ACCESS POLICY SYSTEM section

// FHIR EHR Connection (for direct FHIR API access)
export interface FhirEhrConnection {
  id: string;
  patientId: string;
  ehrSystem: EhrSystemType;
  status: EhrConnectionStatus;
  institutionName: string;
  institutionId: string;
  fhirEndpoint: string;
  patientFhirId: string;
  scopes: string[];
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  lastSyncAt?: string;
  lastSyncStatus?: "success" | "partial" | "failed";
  syncedResources: FhirResourceType[];
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// EHR Sync Log
export interface EhrSyncLog {
  id: string;
  connectionId: string;
  patientId: string;
  syncType: "full" | "incremental" | "resource_specific";
  status: "started" | "in_progress" | "completed" | "failed";
  resourceTypes: FhirResourceType[];
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errors: { resource: string; error: string }[];
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

// Provider Directory Types
export const providerSpecialties = [
  "family_medicine", "internal_medicine", "pediatrics", "cardiology", "dermatology",
  "endocrinology", "gastroenterology", "neurology", "obstetrics_gynecology", "oncology",
  "ophthalmology", "orthopedics", "psychiatry", "pulmonology", "rheumatology",
  "urology", "allergy_immunology", "emergency_medicine", "radiology", "pathology",
  "anesthesiology", "surgery_general", "plastic_surgery", "physical_therapy", "other"
] as const;
export type ProviderSpecialty = typeof providerSpecialties[number];

export const providerTypes = ["physician", "nurse_practitioner", "physician_assistant", "therapist", "pharmacist", "specialist", "surgeon", "dentist", "optometrist", "other"] as const;
export type ProviderType = typeof providerTypes[number];

export const appointmentModes = ["in_person", "telehealth", "hybrid"] as const;
export type AppointmentMode = typeof appointmentModes[number];

export const providerStatuses = ["active", "inactive", "on_leave", "not_accepting"] as const;
export type ProviderStatus = typeof providerStatuses[number];

// Healthcare Provider
export interface HealthcareProvider {
  id: string;
  npi: string;
  firstName: string;
  lastName: string;
  credentials: string[];
  providerType: ProviderType;
  specialties: ProviderSpecialty[];
  primarySpecialty: ProviderSpecialty;
  status: ProviderStatus;
  bio?: string;
  photoUrl?: string;
  languages: string[];
  acceptingNewPatients: boolean;
  appointmentModes: AppointmentMode[];
  averageRating?: number;
  reviewCount: number;
  yearsExperience?: number;
  medicalSchool?: string;
  residency?: string;
  boardCertifications: string[];
  hospitalAffiliations: string[];
  groupPractice?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Provider Location
export interface ProviderLocation {
  id: string;
  providerId: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  phone: string;
  fax?: string;
  email?: string;
  isPrimary: boolean;
  appointmentModes: AppointmentMode[];
  officeHours: { day: string; open: string; close: string; closed: boolean }[];
  handicapAccessible: boolean;
  parkingAvailable: boolean;
  publicTransitAccess: boolean;
  latitude?: number;
  longitude?: number;
  distanceMiles?: number;
  createdAt: string;
}

// Insurance Network Types
export const insuranceTypes = ["hmo", "ppo", "epo", "pos", "hdhp", "medicare", "medicaid", "tricare", "other"] as const;
export type InsuranceType = typeof insuranceTypes[number];

export const networkStatuses = ["in_network", "out_of_network", "pending_verification"] as const;
export type NetworkStatus = typeof networkStatuses[number];

// Insurance Plan
export interface InsurancePlan {
  id: string;
  carrierId: string;
  carrierName: string;
  planName: string;
  planType: InsuranceType;
  groupNumber?: string;
  networkName: string;
  effectiveDate: string;
  terminationDate?: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// Provider Network Affiliation
export interface ProviderNetworkAffiliation {
  id: string;
  providerId: string;
  insurancePlanId: string;
  networkStatus: NetworkStatus;
  effectiveDate: string;
  terminationDate?: string;
  verifiedAt?: string;
  verificationSource?: string;
  copay?: number;
  coinsurance?: number;
  priorAuthRequired: boolean;
  referralRequired: boolean;
  createdAt: string;
}

// Patient Insurance
export interface PatientInsurance {
  id: string;
  patientId: string;
  insurancePlanId: string;
  memberId: string;
  groupNumber?: string;
  subscriberName: string;
  subscriberRelationship: string;
  isPrimary: boolean;
  effectiveDate: string;
  terminationDate?: string;
  copay?: number;
  deductible?: number;
  deductibleMet?: number;
  outOfPocketMax?: number;
  outOfPocketMet?: number;
  verifiedAt?: string;
  cardFrontUrl?: string;
  cardBackUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// E-Prescription Routing Types (extended for routing)
export const ePrescriptionStatuses = ["pending", "sent", "received", "processing", "filled", "ready_pickup", "picked_up", "delivered", "cancelled", "expired", "denied"] as const;
export type EPrescriptionStatus = typeof ePrescriptionStatuses[number];

export const prescriptionTransmissionMethods = ["electronic", "fax", "phone", "mail", "in_person"] as const;
export type PrescriptionTransmissionMethod = typeof prescriptionTransmissionMethods[number];

// Extended Pharmacy for routing (uses existing Pharmacy as base)
export interface PharmacyExtended {
  id: string;
  ncpdpId: string;
  npi?: string;
  name: string;
  chainName?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  fax?: string;
  email?: string;
  is24Hour: boolean;
  hasDelivery: boolean;
  hasDriveThru: boolean;
  acceptsElectronic: boolean;
  acceptedInsurance: string[];
  hours: { day: string; open: string; close: string; closed: boolean }[];
  latitude?: number;
  longitude?: number;
  distanceMiles?: number;
  isPreferred: boolean;
  createdAt: string;
}

// E-Prescription
export interface EPrescription {
  id: string;
  patientId: string;
  prescriberId: string;
  prescriberName: string;
  pharmacyId: string;
  pharmacyName: string;
  medicationName: string;
  medicationNdc?: string;
  medicationRxcui?: string;
  strength: string;
  form: string;
  quantity: number;
  daysSupply: number;
  directions: string;
  refillsAuthorized: number;
  refillsRemaining: number;
  dispensedAsWritten: boolean;
  priorAuthRequired: boolean;
  priorAuthStatus?: "not_required" | "pending" | "approved" | "denied";
  status: EPrescriptionStatus;
  transmissionMethod: PrescriptionTransmissionMethod;
  transmittedAt?: string;
  receivedAt?: string;
  filledAt?: string;
  readyAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  notes?: string;
  pharmacyNotes?: string;
  estimatedCost?: number;
  patientPay?: number;
  insurancePay?: number;
  trackingNumber?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Referral Management Types
export const referralStatuses = ["draft", "pending", "submitted", "received", "scheduled", "completed", "cancelled", "expired", "denied"] as const;
export type ReferralStatus = typeof referralStatuses[number];

export const referralPriorities = ["routine", "urgent", "emergent"] as const;
export type ReferralPriority = typeof referralPriorities[number];

export const referralTypes = ["consultation", "procedure", "diagnostic", "therapy", "surgery", "second_opinion", "ongoing_care"] as const;
export type ReferralType = typeof referralTypes[number];

// Specialist Referral
export interface SpecialistReferral {
  id: string;
  patientId: string;
  patientName: string;
  referringProviderId: string;
  referringProviderName: string;
  referringProviderNpi: string;
  specialistProviderId?: string;
  specialistProviderName?: string;
  specialistProviderNpi?: string;
  specialty: ProviderSpecialty;
  referralType: ReferralType;
  priority: ReferralPriority;
  status: ReferralStatus;
  reasonForReferral: string;
  clinicalSummary: string;
  diagnoses: { code: string; description: string }[];
  relevantHistory: string;
  currentMedications: string[];
  allergies: string[];
  requestedServices: string[];
  preferredProviderIds?: string[];
  insuranceVerified: boolean;
  priorAuthRequired: boolean;
  priorAuthStatus?: "not_required" | "pending" | "approved" | "denied";
  priorAuthNumber?: string;
  validFrom: string;
  validUntil: string;
  maxVisits?: number;
  visitsUsed: number;
  appointmentScheduled: boolean;
  scheduledAppointmentId?: string;
  scheduledDate?: string;
  completedDate?: string;
  specialistNotes?: string;
  consultationReport?: string;
  followUpRecommendations?: string;
  documents: { id: string; name: string; type: string }[];
  communicationLog: { date: string; from: string; to: string; message: string; method: string }[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Provider Availability Types
export const appointmentTypes = ["new_patient", "follow_up", "urgent", "wellness", "procedure", "telehealth", "consultation"] as const;
export type AppointmentType = typeof appointmentTypes[number];

export const slotStatuses = ["available", "booked", "blocked", "tentative"] as const;
export type SlotStatus = typeof slotStatuses[number];

// Provider Schedule Template
export interface ProviderScheduleTemplate {
  id: string;
  providerId: string;
  locationId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  appointmentTypes: AppointmentType[];
  appointmentModes: AppointmentMode[];
  maxPatientsPerSlot: number;
  bufferMinutes: number;
  breakStartTime?: string;
  breakEndTime?: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  isActive: boolean;
  createdAt: string;
}

// Provider Availability Slot
export interface ProviderAvailabilitySlot {
  id: string;
  providerId: string;
  locationId: string;
  scheduleTemplateId?: string;
  date: string;
  startTime: string;
  endTime: string;
  status: SlotStatus;
  appointmentTypes: AppointmentType[];
  appointmentModes: AppointmentMode[];
  bookedPatientId?: string;
  bookedAppointmentId?: string;
  blockReason?: string;
  externalCalendarId?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// External Calendar Sync
export interface ExternalCalendarSync {
  id: string;
  providerId: string;
  calendarType: "google" | "outlook" | "apple" | "ehr" | "practice_management" | "other";
  calendarId: string;
  calendarName: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  syncDirection: "import" | "export" | "bidirectional";
  syncFrequencyMinutes: number;
  lastSyncAt?: string;
  lastSyncStatus?: "success" | "partial" | "failed";
  errorMessage?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Provider Appointment Booking
export interface ProviderAppointmentBooking {
  id: string;
  patientId: string;
  patientName: string;
  providerId: string;
  providerName: string;
  locationId: string;
  locationName: string;
  slotId: string;
  appointmentType: AppointmentType;
  appointmentMode: AppointmentMode;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  status: "scheduled" | "confirmed" | "checked_in" | "in_progress" | "completed" | "cancelled" | "no_show";
  reasonForVisit: string;
  chiefComplaint?: string;
  insuranceVerified: boolean;
  copayAmount?: number;
  copayCollected: boolean;
  priorAuthRequired: boolean;
  priorAuthStatus?: "not_required" | "pending" | "approved" | "denied";
  referralId?: string;
  telehealth?: {
    platform: string;
    meetingUrl: string;
    meetingId: string;
    passcode?: string;
  };
  checkInTime?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  remindersSent: { type: string; sentAt: string }[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// Insurance Network Match Result
export interface InsuranceNetworkMatch {
  providerId: string;
  provider: HealthcareProvider;
  location: ProviderLocation;
  networkStatus: NetworkStatus;
  insurancePlanId: string;
  copay?: number;
  coinsurance?: number;
  priorAuthRequired: boolean;
  referralRequired: boolean;
  estimatedCost?: number;
  matchScore: number;
  matchReasons: string[];
}

// Provider Search Filters
export interface ProviderSearchFilters {
  specialty?: ProviderSpecialty;
  providerType?: ProviderType;
  name?: string;
  zipCode?: string;
  radiusMiles?: number;
  insurancePlanId?: string;
  acceptingNewPatients?: boolean;
  appointmentMode?: AppointmentMode;
  language?: string;
  gender?: string;
  minRating?: number;
  availableWithin?: number;
  sortBy?: "distance" | "rating" | "availability" | "name";
  page?: number;
  pageSize?: number;
}

// Provider Search Result
export interface ProviderSearchResult {
  providers: (HealthcareProvider & { primaryLocation: ProviderLocation; networkStatus?: NetworkStatus; nextAvailable?: string })[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Insert schemas for provider integration validation
export const insertFhirEhrConnectionSchema = z.object({
  patientId: z.string().min(1),
  ehrSystem: z.enum(ehrSystemTypes),
  institutionName: z.string().min(1),
  institutionId: z.string().min(1),
  fhirEndpoint: z.string().url(),
  patientFhirId: z.string().min(1),
  scopes: z.array(z.string()).default([]),
});
export type InsertFhirEhrConnection = z.infer<typeof insertFhirEhrConnectionSchema>;

export const insertHealthcareProviderSchema = z.object({
  npi: z.string().length(10),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  credentials: z.array(z.string()).default([]),
  providerType: z.enum(providerTypes),
  specialties: z.array(z.enum(providerSpecialties)),
  primarySpecialty: z.enum(providerSpecialties),
  status: z.enum(providerStatuses).default("active"),
  bio: z.string().optional(),
  languages: z.array(z.string()).default(["English"]),
  acceptingNewPatients: z.boolean().default(true),
  appointmentModes: z.array(z.enum(appointmentModes)).default(["in_person"]),
});
export type InsertHealthcareProvider = z.infer<typeof insertHealthcareProviderSchema>;

export const insertProviderLocationSchema = z.object({
  providerId: z.string().min(1),
  name: z.string().min(1),
  addressLine1: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  zipCode: z.string().min(5),
  country: z.string().default("USA"),
  phone: z.string().min(10),
  isPrimary: z.boolean().default(false),
  appointmentModes: z.array(z.enum(appointmentModes)).default(["in_person"]),
});
export type InsertProviderLocation = z.infer<typeof insertProviderLocationSchema>;

export const insertPharmacyExtendedSchema = z.object({
  ncpdpId: z.string().min(1),
  name: z.string().min(1),
  addressLine1: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  zipCode: z.string().min(5),
  phone: z.string().min(10),
  acceptsElectronic: z.boolean().default(true),
});
export type InsertPharmacyExtended = z.infer<typeof insertPharmacyExtendedSchema>;

export const insertEPrescriptionSchema = z.object({
  patientId: z.string().min(1),
  prescriberId: z.string().min(1),
  prescriberName: z.string().min(1),
  pharmacyId: z.string().min(1),
  pharmacyName: z.string().min(1),
  medicationName: z.string().min(1),
  strength: z.string().min(1),
  form: z.string().min(1),
  quantity: z.number().positive(),
  daysSupply: z.number().positive(),
  directions: z.string().min(1),
  refillsAuthorized: z.number().min(0).default(0),
  dispensedAsWritten: z.boolean().default(false),
  transmissionMethod: z.enum(prescriptionTransmissionMethods).default("electronic"),
});
export type InsertEPrescription = z.infer<typeof insertEPrescriptionSchema>;

export const insertSpecialistReferralSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  referringProviderId: z.string().min(1),
  referringProviderName: z.string().min(1),
  referringProviderNpi: z.string().length(10),
  specialty: z.enum(providerSpecialties),
  referralType: z.enum(referralTypes),
  priority: z.enum(referralPriorities).default("routine"),
  reasonForReferral: z.string().min(1),
  clinicalSummary: z.string().min(1),
  diagnoses: z.array(z.object({ code: z.string(), description: z.string() })).default([]),
  requestedServices: z.array(z.string()).default([]),
  validFrom: z.string(),
  validUntil: z.string(),
});
export type InsertSpecialistReferral = z.infer<typeof insertSpecialistReferralSchema>;

export const insertProviderAppointmentBookingSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  providerId: z.string().min(1),
  providerName: z.string().min(1),
  locationId: z.string().min(1),
  locationName: z.string().min(1),
  slotId: z.string().min(1),
  appointmentType: z.enum(appointmentTypes),
  appointmentMode: z.enum(appointmentModes),
  scheduledDate: z.string(),
  scheduledTime: z.string(),
  durationMinutes: z.number().positive(),
  reasonForVisit: z.string().min(1),
});
export type InsertProviderAppointmentBooking = z.infer<typeof insertProviderAppointmentBookingSchema>;

export const providerSearchFiltersSchema = z.object({
  specialty: z.enum(providerSpecialties).optional(),
  providerType: z.enum(providerTypes).optional(),
  name: z.string().optional(),
  zipCode: z.string().optional(),
  radiusMiles: z.number().positive().optional(),
  insurancePlanId: z.string().optional(),
  acceptingNewPatients: z.boolean().optional(),
  appointmentMode: z.enum(appointmentModes).optional(),
  language: z.string().optional(),
  gender: z.string().optional(),
  minRating: z.number().min(0).max(5).optional(),
  availableWithin: z.number().positive().optional(),
  sortBy: z.enum(["distance", "rating", "availability", "name"]).optional(),
  page: z.number().positive().optional(),
  pageSize: z.number().positive().max(100).optional(),
});

// ============================================
// COLLABORATION TOOLS
// ============================================

// Document Sharing & Annotation
export const documentAccessLevels = ["read", "comment", "edit"] as const;
export type DocumentAccessLevel = typeof documentAccessLevels[number];

export const documentShareStatuses = ["active", "revoked"] as const;
export type DocumentShareStatus = typeof documentShareStatuses[number];

export interface DocumentShare {
  id: string;
  documentId: string;
  patientId: string;
  sharedWithId: string;
  sharedWithRole: string;
  sharedWithName: string;
  accessLevel: DocumentAccessLevel;
  status: DocumentShareStatus;
  sharedById: string;
  sharedAt: string;
  expiresAt?: string;
}

export const insertDocumentShareSchema = z.object({
  documentId: z.string().min(1),
  sharedWithId: z.string().min(1),
  sharedWithRole: z.string().min(1),
  sharedWithName: z.string().min(1),
  accessLevel: z.enum(documentAccessLevels).default("read"),
  expiresAt: z.string().optional(),
});
export type InsertDocumentShare = z.infer<typeof insertDocumentShareSchema>;

export interface DocumentAnnotation {
  id: string;
  documentId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  body: string;
  pageNumber?: number;
  anchorText?: string;
  createdAt: string;
  updatedAt?: string;
}

export const insertDocumentAnnotationSchema = z.object({
  documentId: z.string().min(1),
  body: z.string().min(1),
  pageNumber: z.number().positive().optional(),
  anchorText: z.string().optional(),
});
export type InsertDocumentAnnotation = z.infer<typeof insertDocumentAnnotationSchema>;

export interface AnnotationReply {
  id: string;
  annotationId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

export const insertAnnotationReplySchema = z.object({
  annotationId: z.string().min(1),
  body: z.string().min(1),
});
export type InsertAnnotationReply = z.infer<typeof insertAnnotationReplySchema>;

// Shared Care Plan Tasks & Progress
export const taskStatuses = ["todo", "in_progress", "done", "cancelled"] as const;
export type TaskStatus = typeof taskStatuses[number];

export const taskPriorities = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = typeof taskPriorities[number];

export interface CarePlanTask {
  id: string;
  carePlanId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  assigneeName?: string;
  assigneeRole?: string;
  dueDate?: string;
  completedAt?: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
}

export const insertCarePlanTaskSchema = z.object({
  carePlanId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(taskPriorities).default("medium"),
  assigneeId: z.string().optional(),
  assigneeName: z.string().optional(),
  assigneeRole: z.string().optional(),
  dueDate: z.string().optional(),
});
export type InsertCarePlanTask = z.infer<typeof insertCarePlanTaskSchema>;

export const updateCarePlanTaskSchema = insertCarePlanTaskSchema.partial().extend({
  status: z.enum(taskStatuses).optional(),
});
export type UpdateCarePlanTask = z.infer<typeof updateCarePlanTaskSchema>;

export interface CarePlanProgressUpdate {
  id: string;
  carePlanId: string;
  taskId?: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  note: string;
  percentComplete?: number;
  createdAt: string;
}

export const insertCarePlanProgressUpdateSchema = z.object({
  carePlanId: z.string().min(1),
  taskId: z.string().optional(),
  note: z.string().min(1),
  percentComplete: z.number().min(0).max(100).optional(),
});
export type InsertCarePlanProgressUpdate = z.infer<typeof insertCarePlanProgressUpdateSchema>;

export const carePlanCollaboratorPermissions = ["view", "edit", "comment", "manage"] as const;
export type CarePlanCollaboratorPermission = typeof carePlanCollaboratorPermissions[number];

export interface CarePlanCollaborator {
  id: string;
  carePlanId: string;
  memberId: string;
  memberName: string;
  memberRole: string;
  permissions: CarePlanCollaboratorPermission[];
  addedById: string;
  addedAt: string;
}

export const insertCarePlanCollaboratorSchema = z.object({
  carePlanId: z.string().min(1),
  memberId: z.string().min(1),
  memberName: z.string().min(1),
  memberRole: z.string().min(1),
  permissions: z.array(z.enum(carePlanCollaboratorPermissions)).default(["view"]),
});
export type InsertCarePlanCollaborator = z.infer<typeof insertCarePlanCollaboratorSchema>;

// Collaborative Notes & Whiteboard
export interface SharedNote {
  id: string;
  patientId: string;
  title: string;
  content: string;
  createdById: string;
  createdByName: string;
  lastEditedById?: string;
  lastEditedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export const insertSharedNoteSchema = z.object({
  title: z.string().min(1),
  content: z.string().default(""),
});
export type InsertSharedNote = z.infer<typeof insertSharedNoteSchema>;

export const updateSharedNoteSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
});
export type UpdateSharedNote = z.infer<typeof updateSharedNoteSchema>;

export interface NoteCollaborator {
  id: string;
  noteId: string;
  memberId: string;
  memberName: string;
  memberRole: string;
  permissions: string[];
  addedAt: string;
}

export const insertNoteCollaboratorSchema = z.object({
  noteId: z.string().min(1),
  memberId: z.string().min(1),
  memberName: z.string().min(1),
  memberRole: z.string().min(1),
  permissions: z.array(z.string()).default(["view"]),
});
export type InsertNoteCollaborator = z.infer<typeof insertNoteCollaboratorSchema>;

export interface WhiteboardSession {
  id: string;
  patientId: string;
  title: string;
  dataJson: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export const insertWhiteboardSchema = z.object({
  title: z.string().min(1),
  dataJson: z.string().default("{}"),
});
export type InsertWhiteboard = z.infer<typeof insertWhiteboardSchema>;

export const updateWhiteboardSchema = z.object({
  title: z.string().min(1).optional(),
  dataJson: z.string().optional(),
});
export type UpdateWhiteboard = z.infer<typeof updateWhiteboardSchema>;

// Group Messaging
export interface CollabMessageThread {
  id: string;
  patientId: string;
  subject: string;
  threadType: "direct" | "group" | "care_team";
  createdById: string;
  createdByName: string;
  createdAt: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
}

export const insertCollabMessageThreadSchema = z.object({
  subject: z.string().min(1),
  threadType: z.enum(["direct", "group", "care_team"]).default("direct"),
  participantIds: z.array(z.string()).optional(),
});
export type InsertCollabMessageThread = z.infer<typeof insertCollabMessageThreadSchema>;

export interface ThreadParticipant {
  id: string;
  threadId: string;
  memberId: string;
  memberName: string;
  memberRole: string;
  joinedAt: string;
  muted: boolean;
  lastReadAt?: string;
}

export const insertThreadParticipantSchema = z.object({
  threadId: z.string().min(1),
  memberId: z.string().min(1),
  memberName: z.string().min(1),
  memberRole: z.string().min(1),
});
export type InsertThreadParticipant = z.infer<typeof insertThreadParticipantSchema>;

export interface ThreadMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  body: string;
  attachments?: string[];
  sentAt: string;
  editedAt?: string;
}

export const insertThreadMessageSchema = z.object({
  threadId: z.string().min(1),
  body: z.string().min(1),
  attachments: z.array(z.string()).optional(),
});
export type InsertThreadMessage = z.infer<typeof insertThreadMessageSchema>;

// AI Care Plan Draft with Clinician Approval Workflow
export const aiCarePlanDraftStatuses = ["pending_review", "under_review", "revisions_requested", "approved", "rejected", "assigned"] as const;
export type AICarePlanDraftStatus = typeof aiCarePlanDraftStatuses[number];

export interface AICarePlanMedicationRec {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration?: string;
  rationale: string;
  contraindications?: string[];
  sideEffects?: string[];
  clinicianApproved?: boolean;
  clinicianNotes?: string;
}

export interface AICarePlanLifestyleRec {
  id: string;
  category: "exercise" | "diet" | "sleep" | "stress" | "habits";
  title: string;
  description: string;
  frequency: string;
  priority: "high" | "medium" | "low";
  rationale: string;
  evidenceBasis: string;
  clinicianApproved?: boolean;
  clinicianNotes?: string;
}

export interface AICarePlanAppointmentRec {
  id: string;
  type: "follow_up" | "specialist" | "lab_work" | "imaging" | "procedure" | "telehealth";
  specialty?: string;
  purpose: string;
  suggestedTimeframe: string;
  priority: "urgent" | "routine" | "preventive";
  rationale: string;
  clinicianApproved?: boolean;
  clinicianNotes?: string;
}

export interface AICarePlanEducationRec {
  id: string;
  topic: string;
  summary: string;
  resources: { title: string; url?: string; type: "article" | "video" | "pdf" | "app" }[];
  relevance: string;
  clinicianApproved?: boolean;
  clinicianNotes?: string;
}

export interface AICarePlanDraft {
  id: string;
  patientId: string;
  patientName: string;
  status: AICarePlanDraftStatus;
  generatedAt: string;
  generatedBy: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  approvedAt?: string;
  assignedAt?: string;
  primaryCondition: string;
  conditions: string[];
  treatmentGoals: string[];
  analysisNotes: string;
  medications: AICarePlanMedicationRec[];
  lifestyle: AICarePlanLifestyleRec[];
  appointments: AICarePlanAppointmentRec[];
  education: AICarePlanEducationRec[];
  overallRationale: string;
  evidenceBasis: string[];
  riskFactors: { factor: string; severity: "high" | "medium" | "low"; mitigation: string }[];
  clinicianFeedback?: string;
  rejectionReason?: string;
  finalCarePlanId?: string;
}

export const insertAICarePlanDraftSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  primaryCondition: z.string().min(1),
  conditions: z.array(z.string()).default([]),
  treatmentGoals: z.array(z.string()).default([]),
});
export type InsertAICarePlanDraft = z.infer<typeof insertAICarePlanDraftSchema>;

export const aiCarePlanMedicationRecSchema = z.object({
  id: z.string(),
  name: z.string(),
  dosage: z.string(),
  frequency: z.string(),
  duration: z.string().optional(),
  rationale: z.string(),
  contraindications: z.array(z.string()).optional(),
  sideEffects: z.array(z.string()).optional(),
  clinicianApproved: z.boolean().optional(),
  clinicianNotes: z.string().optional(),
});

export const aiCarePlanLifestyleRecSchema = z.object({
  id: z.string(),
  category: z.enum(["exercise", "diet", "sleep", "stress", "habits"]),
  title: z.string(),
  description: z.string(),
  frequency: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  rationale: z.string(),
  evidenceBasis: z.string(),
  clinicianApproved: z.boolean().optional(),
  clinicianNotes: z.string().optional(),
});

export const aiCarePlanAppointmentRecSchema = z.object({
  id: z.string(),
  type: z.enum(["follow_up", "specialist", "lab_work", "imaging", "procedure", "telehealth"]),
  specialty: z.string().optional(),
  purpose: z.string(),
  suggestedTimeframe: z.string(),
  priority: z.enum(["urgent", "routine", "preventive"]),
  rationale: z.string(),
  clinicianApproved: z.boolean().optional(),
  clinicianNotes: z.string().optional(),
});

export const aiCarePlanEducationRecSchema = z.object({
  id: z.string(),
  topic: z.string(),
  summary: z.string(),
  resources: z.array(z.object({
    title: z.string(),
    url: z.string().optional(),
    type: z.enum(["article", "video", "pdf", "app"]),
  })),
  relevance: z.string(),
  clinicianApproved: z.boolean().optional(),
  clinicianNotes: z.string().optional(),
});

export const updateAICarePlanDraftSchema = z.object({
  status: z.enum(aiCarePlanDraftStatuses).optional(),
  medications: z.array(aiCarePlanMedicationRecSchema).optional(),
  lifestyle: z.array(aiCarePlanLifestyleRecSchema).optional(),
  appointments: z.array(aiCarePlanAppointmentRecSchema).optional(),
  education: z.array(aiCarePlanEducationRecSchema).optional(),
  clinicianFeedback: z.string().optional(),
  rejectionReason: z.string().optional(),
});
export type UpdateAICarePlanDraft = z.infer<typeof updateAICarePlanDraftSchema>;

// ========================================
// AI Patient Insights Types
// ========================================

export const vitalTrendSchema = z.object({
  metric: z.string(),
  currentValue: z.number(),
  unit: z.string(),
  trend: z.enum(["improving", "stable", "declining", "concerning"]),
  percentChange: z.number(),
  timeframe: z.string(),
  analysis: z.string(),
});
export type VitalTrend = z.infer<typeof vitalTrendSchema>;

export const labTrendSchema = z.object({
  testName: z.string(),
  currentValue: z.number(),
  unit: z.string(),
  referenceRange: z.string(),
  status: z.enum(["normal", "borderline", "abnormal", "critical"]),
  trend: z.enum(["improving", "stable", "worsening"]),
  analysis: z.string(),
});
export type LabTrend = z.infer<typeof labTrendSchema>;

export const symptomPatternSchema = z.object({
  symptom: z.string(),
  frequency: z.enum(["daily", "weekly", "occasional", "rare"]),
  severity: z.enum(["mild", "moderate", "severe"]),
  triggers: z.array(z.string()),
  correlations: z.array(z.string()),
  analysis: z.string(),
});
export type SymptomPattern = z.infer<typeof symptomPatternSchema>;

export const adherenceMetricSchema = z.object({
  category: z.enum(["medication", "appointment", "lifestyle", "monitoring"]),
  itemName: z.string(),
  adherenceRate: z.number(),
  missedInstances: z.number(),
  totalInstances: z.number(),
  trend: z.enum(["improving", "stable", "declining"]),
  barriers: z.array(z.string()),
});
export type AdherenceMetric = z.infer<typeof adherenceMetricSchema>;

export const nonAdherenceRiskSchema = z.object({
  riskLevel: z.enum(["low", "moderate", "high", "critical"]),
  riskScore: z.number(),
  factors: z.array(z.object({
    factor: z.string(),
    impact: z.enum(["low", "medium", "high"]),
    description: z.string(),
  })),
  predictedOutcome: z.string(),
  timeToIntervention: z.string(),
});
export type NonAdherenceRisk = z.infer<typeof nonAdherenceRiskSchema>;

export const optimizationSuggestionSchema = z.object({
  id: z.string(),
  category: z.enum(["medication", "lifestyle", "monitoring", "appointment", "education"]),
  title: z.string(),
  description: z.string(),
  rationale: z.string(),
  expectedBenefit: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  evidenceBasis: z.string(),
  implementationSteps: z.array(z.string()),
});
export type OptimizationSuggestion = z.infer<typeof optimizationSuggestionSchema>;

export const proactiveInterventionSchema = z.object({
  id: z.string(),
  type: z.enum(["reminder", "education", "support", "escalation", "adjustment"]),
  title: z.string(),
  description: z.string(),
  targetBehavior: z.string(),
  timing: z.string(),
  deliveryMethod: z.enum(["in_app", "sms", "email", "phone", "care_team"]),
  urgency: z.enum(["immediate", "within_24h", "within_week", "scheduled"]),
  rationale: z.string(),
});
export type ProactiveIntervention = z.infer<typeof proactiveInterventionSchema>;

export const patientInsightsSchema = z.object({
  patientId: z.string(),
  generatedAt: z.string(),
  vitalTrends: z.array(vitalTrendSchema),
  labTrends: z.array(labTrendSchema),
  symptomPatterns: z.array(symptomPatternSchema),
  adherenceMetrics: z.array(adherenceMetricSchema),
  nonAdherenceRisk: nonAdherenceRiskSchema,
  optimizationSuggestions: z.array(optimizationSuggestionSchema),
  proactiveInterventions: z.array(proactiveInterventionSchema),
  overallHealthStatus: z.string(),
  keyFindings: z.array(z.string()),
  priorityActions: z.array(z.string()),
});
export type PatientInsights = z.infer<typeof patientInsightsSchema>;

// ============================================
// TIMELINE STORY MODE
// ============================================

export const timelineEventTypes = [
  "visit",
  "medication_started",
  "medication_stopped",
  "lab_result",
  "imaging",
  "hospitalization",
  "procedure",
  "diagnosis",
  "vaccination",
] as const;
export type TimelineEventType = typeof timelineEventTypes[number];

export const timelinePeriods = [6, 12, 18, 24] as const;
export type TimelinePeriod = typeof timelinePeriods[number];

export const timelineEventSchema = z.object({
  id: z.string(),
  type: z.enum(timelineEventTypes),
  date: z.string(),
  title: z.string(),
  description: z.string(),
  source: z.string().optional(),
  provider: z.string().optional(),
  location: z.string().optional(),
  significance: z.enum(["routine", "notable", "significant", "critical"]),
  relatedEventIds: z.array(z.string()).optional(),
});
export type TimelineEvent = z.infer<typeof timelineEventSchema>;

export const quarterlyPeriodSchema = z.object({
  quarter: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  events: z.array(timelineEventSchema),
  summary: z.string(),
  keyHighlights: z.array(z.string()),
});
export type QuarterlyPeriod = z.infer<typeof quarterlyPeriodSchema>;

export const timelineStorySchema = z.object({
  patientId: z.string(),
  profileId: z.string().optional(),
  generatedAt: z.string(),
  periodMonths: z.number(),
  periodLabel: z.string(),
  quarters: z.array(quarterlyPeriodSchema),
  overallNarrative: z.string(),
  keyTakeaways: z.array(z.string()),
  eventCounts: z.record(z.string(), z.number()),
  disclaimer: z.string(),
});
export type TimelineStory = z.infer<typeof timelineStorySchema>;

export const timelineStoryRequestSchema = z.object({
  periodMonths: z.union([z.literal(6), z.literal(12), z.literal(18), z.literal(24)]).default(12),
  profileId: z.string().optional(),
});
export type TimelineStoryRequest = z.infer<typeof timelineStoryRequestSchema>;

// ==========================================
// Automated Patient Outreach
// ==========================================

export const outreachCampaignStatuses = ["draft", "active", "paused", "completed", "cancelled"] as const;
export type OutreachCampaignStatus = typeof outreachCampaignStatuses[number];

export const outreachTargetCriteria = ["all_patients", "high_risk", "chronic_condition", "recent_visit", "overdue_screening", "medication_adherence", "care_gap", "custom"] as const;
export type OutreachTargetCriteria = typeof outreachTargetCriteria[number];

export const checkInTypes = ["adherence", "symptom_monitoring", "post_visit", "wellness", "care_plan_progress", "lab_follow_up", "medication_side_effects"] as const;
export type CheckInType = typeof checkInTypes[number];

export const checkInFrequencies = ["once", "daily", "weekly", "biweekly", "monthly", "quarterly"] as const;
export type CheckInFrequency = typeof checkInFrequencies[number];

export interface OutreachCampaign {
  id: string;
  name: string;
  description?: string;
  status: OutreachCampaignStatus;
  targetCriteria: OutreachTargetCriteria;
  targetConditions?: string[];
  targetPatientIds?: string[];
  communicationType: CommunicationType;
  channel: CommunicationChannel;
  priority: CommunicationPriority;
  templateId?: string;
  useAiPersonalization: boolean;
  aiPromptContext?: string;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  sendTime?: string;
  totalTargetPatients: number;
  messagesSent: number;
  messagesDelivered: number;
  messagesOpened: number;
  responsesReceived: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const insertOutreachCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().optional(),
  status: z.enum(outreachCampaignStatuses).default("draft"),
  targetCriteria: z.enum(outreachTargetCriteria),
  targetConditions: z.array(z.string()).optional(),
  targetPatientIds: z.array(z.string()).optional(),
  communicationType: z.enum(communicationTypes),
  channel: z.enum(communicationChannels),
  priority: z.enum(communicationPriorities).default("normal"),
  templateId: z.string().optional(),
  useAiPersonalization: z.boolean().default(true),
  aiPromptContext: z.string().optional(),
  scheduledStartDate: z.string().optional(),
  scheduledEndDate: z.string().optional(),
  sendTime: z.string().optional(),
  createdBy: z.string().min(1),
});
export type InsertOutreachCampaign = z.infer<typeof insertOutreachCampaignSchema>;

export interface ScheduledCheckIn {
  id: string;
  patientId: string;
  providerId?: string;
  checkInType: CheckInType;
  frequency: CheckInFrequency;
  title: string;
  description?: string;
  questions: CheckInQuestion[];
  reminderMessage?: string;
  useAiPersonalization: boolean;
  aiGeneratedMessage?: string;
  nextScheduledAt: string;
  lastCompletedAt?: string;
  completionCount: number;
  isActive: boolean;
  relatedCarePlanId?: string;
  relatedMedicationIds?: string[];
  relatedConditionIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CheckInQuestion {
  id: string;
  questionText: string;
  questionType: "yes_no" | "scale_1_10" | "multiple_choice" | "free_text" | "symptom_severity";
  options?: string[];
  isRequired: boolean;
  followUpTrigger?: {
    condition: string;
    action: "alert_provider" | "schedule_appointment" | "send_education" | "escalate";
  };
}

export const insertScheduledCheckInSchema = z.object({
  patientId: z.string().min(1),
  providerId: z.string().optional(),
  checkInType: z.enum(checkInTypes),
  frequency: z.enum(checkInFrequencies),
  title: z.string().min(1, "Check-in title is required"),
  description: z.string().optional(),
  questions: z.array(z.object({
    id: z.string(),
    questionText: z.string().min(1),
    questionType: z.enum(["yes_no", "scale_1_10", "multiple_choice", "free_text", "symptom_severity"]),
    options: z.array(z.string()).optional(),
    isRequired: z.boolean().default(true),
    followUpTrigger: z.object({
      condition: z.string(),
      action: z.enum(["alert_provider", "schedule_appointment", "send_education", "escalate"]),
    }).optional(),
  })).default([]),
  reminderMessage: z.string().optional(),
  useAiPersonalization: z.boolean().default(true),
  nextScheduledAt: z.string(),
  relatedCarePlanId: z.string().optional(),
  relatedMedicationIds: z.array(z.string()).optional(),
  relatedConditionIds: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});
export type InsertScheduledCheckIn = z.infer<typeof insertScheduledCheckInSchema>;

export interface CheckInResponse {
  id: string;
  checkInId: string;
  patientId: string;
  responses: {
    questionId: string;
    answer: string | number | boolean;
    answeredAt: string;
  }[];
  overallStatus: "green" | "yellow" | "red";
  aiAnalysis?: string;
  aiRecommendations?: string[];
  providerReviewRequired: boolean;
  providerReviewedAt?: string;
  providerNotes?: string;
  triggeredActions?: string[];
  completedAt: string;
  createdAt: string;
}

export const insertCheckInResponseSchema = z.object({
  checkInId: z.string().min(1),
  patientId: z.string().min(1),
  responses: z.array(z.object({
    questionId: z.string(),
    answer: z.union([z.string(), z.number(), z.boolean()]),
    answeredAt: z.string(),
  })),
  overallStatus: z.enum(["green", "yellow", "red"]).default("green"),
});
export type InsertCheckInResponse = z.infer<typeof insertCheckInResponseSchema>;

export interface OutreachTemplate {
  id: string;
  name: string;
  category: "follow_up" | "adherence" | "symptom_check" | "post_visit" | "preventive_care" | "care_gap" | "wellness" | "custom";
  description: string;
  subjectTemplate: string;
  bodyTemplate: string;
  variables: string[];
  aiPersonalizationPrompt?: string;
  recommendedChannel: CommunicationChannel;
  recommendedTiming?: string;
  targetAudience?: string;
  isSystemTemplate: boolean;
  usageCount: number;
  successRate?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const insertOutreachTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  category: z.enum(["follow_up", "adherence", "symptom_check", "post_visit", "preventive_care", "care_gap", "wellness", "custom"]),
  description: z.string().min(1),
  subjectTemplate: z.string().min(1),
  bodyTemplate: z.string().min(1),
  variables: z.array(z.string()).default([]),
  aiPersonalizationPrompt: z.string().optional(),
  recommendedChannel: z.enum(communicationChannels).default("in_app"),
  recommendedTiming: z.string().optional(),
  targetAudience: z.string().optional(),
  isSystemTemplate: z.boolean().default(false),
  createdBy: z.string().min(1),
});
export type InsertOutreachTemplate = z.infer<typeof insertOutreachTemplateSchema>;

// ============================================
// HEALTH METRICS TRACKING SYSTEM
// ============================================

// Sleep Tracking
export type SleepQuality = "excellent" | "good" | "fair" | "poor" | "very_poor";
export type SleepStage = "awake" | "light" | "deep" | "rem";

export interface SleepRecord {
  id: string;
  patientId: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  totalSleepMinutes: number;
  sleepQuality: SleepQuality;
  sleepScore?: number;
  stages?: {
    stage: SleepStage;
    durationMinutes: number;
    percentage: number;
  }[];
  interruptions: number;
  notes?: string;
  source: "manual" | "device";
  deviceId?: string;
  createdAt: string;
  updatedAt: string;
}

export const insertSleepRecordSchema = z.object({
  patientId: z.string().min(1),
  date: z.string().min(1),
  bedtime: z.string().min(1),
  wakeTime: z.string().min(1),
  totalSleepMinutes: z.number().min(0).max(1440),
  sleepQuality: z.enum(["excellent", "good", "fair", "poor", "very_poor"]),
  sleepScore: z.number().min(0).max(100).optional(),
  stages: z.array(z.object({
    stage: z.enum(["awake", "light", "deep", "rem"]),
    durationMinutes: z.number(),
    percentage: z.number(),
  })).optional(),
  interruptions: z.number().min(0).default(0),
  notes: z.string().optional(),
  source: z.enum(["manual", "device"]).default("manual"),
  deviceId: z.string().optional(),
});
export type InsertSleepRecord = z.infer<typeof insertSleepRecordSchema>;

// Nutrition Tracking
export type MealType = "breakfast" | "lunch" | "dinner" | "snack" | "other";

export interface NutritionEntry {
  id: string;
  patientId: string;
  date: string;
  mealType: MealType;
  mealTime: string;
  foodItems: {
    name: string;
    portion: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sodium?: number;
  }[];
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  waterIntakeOz?: number;
  notes?: string;
  photoUrl?: string;
  source: "manual" | "device" | "barcode";
  createdAt: string;
  updatedAt: string;
}

export const insertNutritionEntrySchema = z.object({
  patientId: z.string().min(1),
  date: z.string().min(1),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack", "other"]),
  mealTime: z.string().min(1),
  foodItems: z.array(z.object({
    name: z.string().min(1),
    portion: z.string().min(1),
    calories: z.number().optional(),
    protein: z.number().optional(),
    carbs: z.number().optional(),
    fat: z.number().optional(),
    fiber: z.number().optional(),
    sodium: z.number().optional(),
  })).min(1),
  totalCalories: z.number().optional(),
  totalProtein: z.number().optional(),
  totalCarbs: z.number().optional(),
  totalFat: z.number().optional(),
  waterIntakeOz: z.number().optional(),
  notes: z.string().optional(),
  photoUrl: z.string().optional(),
  source: z.enum(["manual", "device", "barcode"]).default("manual"),
});
export type InsertNutritionEntry = z.infer<typeof insertNutritionEntrySchema>;

// Exercise/Activity Tracking
export type ExerciseIntensity = "light" | "moderate" | "vigorous" | "maximum";
export type ExerciseType = "cardio" | "strength" | "flexibility" | "balance" | "sports" | "walking" | "running" | "cycling" | "swimming" | "yoga" | "other";

export interface ExerciseRecord {
  id: string;
  patientId: string;
  date: string;
  startTime: string;
  endTime?: string;
  exerciseType: ExerciseType;
  activityName: string;
  durationMinutes: number;
  intensity: ExerciseIntensity;
  caloriesBurned?: number;
  distance?: number;
  distanceUnit?: "miles" | "km" | "meters";
  steps?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  sets?: {
    exercise: string;
    reps: number;
    weight?: number;
    weightUnit?: "lbs" | "kg";
  }[];
  notes?: string;
  feelingRating?: number;
  source: "manual" | "device";
  deviceId?: string;
  createdAt: string;
  updatedAt: string;
}

export const insertExerciseRecordSchema = z.object({
  patientId: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().optional(),
  exerciseType: z.enum(["cardio", "strength", "flexibility", "balance", "sports", "walking", "running", "cycling", "swimming", "yoga", "other"]),
  activityName: z.string().min(1),
  durationMinutes: z.number().min(1),
  intensity: z.enum(["light", "moderate", "vigorous", "maximum"]),
  caloriesBurned: z.number().optional(),
  distance: z.number().optional(),
  distanceUnit: z.enum(["miles", "km", "meters"]).optional(),
  steps: z.number().optional(),
  averageHeartRate: z.number().optional(),
  maxHeartRate: z.number().optional(),
  sets: z.array(z.object({
    exercise: z.string(),
    reps: z.number(),
    weight: z.number().optional(),
    weightUnit: z.enum(["lbs", "kg"]).optional(),
  })).optional(),
  notes: z.string().optional(),
  feelingRating: z.number().min(1).max(5).optional(),
  source: z.enum(["manual", "device"]).default("manual"),
  deviceId: z.string().optional(),
});
export type InsertExerciseRecord = z.infer<typeof insertExerciseRecordSchema>;

// Device/Wearable Connections
export type DeviceType = "smartwatch" | "fitness_tracker" | "smart_scale" | "blood_pressure_monitor" | "glucose_monitor" | "pulse_oximeter" | "thermometer" | "sleep_tracker" | "other";
export type DeviceStatus = "connected" | "disconnected" | "syncing" | "error" | "pending";

export interface ConnectedDevice {
  id: string;
  patientId: string;
  deviceType: DeviceType;
  deviceName: string;
  manufacturer: string;
  model?: string;
  serialNumber?: string;
  status: DeviceStatus;
  lastSyncAt?: string;
  syncFrequency?: "realtime" | "hourly" | "daily" | "manual";
  dataTypes: string[];
  batteryLevel?: number;
  firmwareVersion?: string;
  connectionDetails?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const insertConnectedDeviceSchema = z.object({
  patientId: z.string().min(1),
  deviceType: z.enum(["smartwatch", "fitness_tracker", "smart_scale", "blood_pressure_monitor", "glucose_monitor", "pulse_oximeter", "thermometer", "sleep_tracker", "other"]),
  deviceName: z.string().min(1),
  manufacturer: z.string().min(1),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  status: z.enum(["connected", "disconnected", "syncing", "error", "pending"]).default("pending"),
  syncFrequency: z.enum(["realtime", "hourly", "daily", "manual"]).optional(),
  dataTypes: z.array(z.string()).default([]),
  batteryLevel: z.number().min(0).max(100).optional(),
  firmwareVersion: z.string().optional(),
});
export type InsertConnectedDevice = z.infer<typeof insertConnectedDeviceSchema>;

// Daily Health Summary - aggregates all metrics
export interface DailyHealthSummary {
  id: string;
  patientId: string;
  date: string;
  steps?: number;
  activeMinutes?: number;
  caloriesBurned?: number;
  caloriesConsumed?: number;
  waterIntakeOz?: number;
  sleepMinutes?: number;
  sleepQuality?: SleepQuality;
  restingHeartRate?: number;
  stressLevel?: number;
  moodRating?: number;
  weight?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  bloodGlucose?: number;
  healthScore?: number;
  insights?: string[];
  createdAt: string;
  updatedAt: string;
}

export const insertDailyHealthSummarySchema = z.object({
  patientId: z.string().min(1),
  date: z.string().min(1),
  steps: z.number().optional(),
  activeMinutes: z.number().optional(),
  caloriesBurned: z.number().optional(),
  caloriesConsumed: z.number().optional(),
  waterIntakeOz: z.number().optional(),
  sleepMinutes: z.number().optional(),
  sleepQuality: z.enum(["excellent", "good", "fair", "poor", "very_poor"]).optional(),
  restingHeartRate: z.number().optional(),
  stressLevel: z.number().min(1).max(10).optional(),
  moodRating: z.number().min(1).max(5).optional(),
  weight: z.number().optional(),
  bloodPressureSystolic: z.number().optional(),
  bloodPressureDiastolic: z.number().optional(),
  bloodGlucose: z.number().optional(),
  healthScore: z.number().min(0).max(100).optional(),
  insights: z.array(z.string()).optional(),
});
export type InsertDailyHealthSummary = z.infer<typeof insertDailyHealthSummarySchema>;

// ============================================
// ENHANCED HEALTH RECORDS - Comprehensive Data Model
// ============================================

// Enhanced Medication with drug interactions and adherence
export interface EnhancedMedication {
  id: string;
  patientId: string;
  // Basic info
  name: string;
  genericName?: string;
  brandNames?: string[];
  dosage: string;
  dosageUnit: "mg" | "mcg" | "g" | "ml" | "units" | "other";
  frequency: string;
  route: "oral" | "topical" | "injection" | "inhalation" | "sublingual" | "rectal" | "transdermal" | "iv" | "other";
  // Prescriber info
  prescribedBy: string;
  prescriberNPI?: string;
  prescriberSpecialty?: string;
  prescribedDate: string;
  // Status tracking
  status: "active" | "discontinued" | "on_hold" | "completed" | "pending";
  startDate: string;
  endDate?: string;
  discontinuedReason?: string;
  discontinuedBy?: string;
  // Pharmacy & refills
  pharmacy?: string;
  refillsRemaining: number;
  refillsTotal?: number;
  lastFilledDate?: string;
  nextRefillDate?: string;
  daysSupply?: number;
  // Drug info
  drugClass?: string;
  ndc?: string; // National Drug Code
  rxNormCode?: string;
  instructions?: string;
  warnings?: string[];
  sideEffects?: string[];
  // Drug interactions
  interactions: DrugInteraction[];
  contraindications?: string[];
  // Adherence tracking
  adherence: MedicationAdherence;
  patientReported: "taking" | "not_taking" | "modified" | "unknown";
  // Dosage history
  dosageHistory: DosageChange[];
  // Source tracking
  source: "ehr" | "patient_reported" | "pharmacy" | "manual";
  ehrConnectionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DrugInteraction {
  id: string;
  interactingDrug: string;
  severity: "major" | "moderate" | "minor" | "unknown";
  description: string;
  clinicalEffect?: string;
  recommendation?: string;
  source?: string;
  checkedAt: string;
}

export interface MedicationAdherence {
  overallScore: number; // 0-100
  last30Days: number;
  last7Days: number;
  missedDoses: number;
  takenDoses: number;
  lastTakenAt?: string;
  streak?: number; // Days in a row
  reminderEnabled: boolean;
  reminderTimes?: string[];
}

export interface DosageChange {
  id: string;
  previousDosage: string;
  newDosage: string;
  changedBy: string;
  reason?: string;
  changedAt: string;
}

export const insertEnhancedMedicationSchema = z.object({
  patientId: z.string().min(1),
  name: z.string().min(1),
  genericName: z.string().optional(),
  brandNames: z.array(z.string()).optional(),
  dosage: z.string().min(1),
  dosageUnit: z.enum(["mg", "mcg", "g", "ml", "units", "other"]).default("mg"),
  frequency: z.string().min(1),
  route: z.enum(["oral", "topical", "injection", "inhalation", "sublingual", "rectal", "transdermal", "iv", "other"]).default("oral"),
  prescribedBy: z.string(),
  prescriberNPI: z.string().optional(),
  prescriberSpecialty: z.string().optional(),
  prescribedDate: z.string(),
  status: z.enum(["active", "discontinued", "on_hold", "completed", "pending"]).default("active"),
  startDate: z.string(),
  endDate: z.string().optional(),
  pharmacy: z.string().optional(),
  refillsRemaining: z.number().default(0),
  refillsTotal: z.number().optional(),
  daysSupply: z.number().optional(),
  drugClass: z.string().optional(),
  instructions: z.string().optional(),
  warnings: z.array(z.string()).optional(),
  patientReported: z.enum(["taking", "not_taking", "modified", "unknown"]).default("unknown"),
  source: z.enum(["ehr", "patient_reported", "pharmacy", "manual"]).default("manual"),
  ehrConnectionId: z.string().optional(),
});
export type InsertEnhancedMedication = z.infer<typeof insertEnhancedMedicationSchema>;

// ============================================
// COMPREHENSIVE ALLERGY RECORDS
// ============================================

export type AllergySeverity = "mild" | "moderate" | "severe" | "life_threatening" | "unknown";
export type AllergyType = "drug" | "food" | "environmental" | "latex" | "insect" | "other";
export type AllergyStatus = "active" | "inactive" | "resolved" | "entered_in_error";

export interface ComprehensiveAllergy {
  id: string;
  patientId: string;
  // Basic info
  allergen: string;
  allergenCode?: string; // RxNorm, SNOMED CT
  allergenCodeSystem?: "rxnorm" | "snomed" | "ndfrt" | "unii" | "other";
  type: AllergyType;
  category?: string;
  // Clinical info
  severity: AllergySeverity;
  criticality?: "low" | "high" | "unable_to_assess";
  status: AllergyStatus;
  verificationStatus: "unconfirmed" | "confirmed" | "refuted" | "entered_in_error";
  // Reactions
  reactions: AllergyReaction[];
  // Dates
  onsetDate?: string;
  onsetAge?: number;
  recordedDate: string;
  lastOccurrence?: string;
  resolvedDate?: string;
  // Provider info
  recordedBy: string;
  asserter?: string; // Who stated the allergy (patient, parent, provider)
  // Testing
  testingPerformed: boolean;
  testingDetails?: AllergyTest[];
  // Notes
  notes?: string;
  patientNotes?: string;
  // Source
  source: "ehr" | "patient_reported" | "provider" | "manual";
  ehrConnectionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AllergyReaction {
  id: string;
  manifestation: string; // e.g., "Hives", "Anaphylaxis"
  manifestationCode?: string;
  severity: AllergySeverity;
  description?: string;
  onset?: string;
  duration?: string;
  treatment?: string;
  exposureRoute?: string;
  exposureDate?: string;
}

export interface AllergyTest {
  id: string;
  testType: "skin_prick" | "blood_test" | "patch_test" | "oral_challenge" | "other";
  testName: string;
  result: "positive" | "negative" | "inconclusive";
  value?: string;
  unit?: string;
  performedBy: string;
  performedAt: string;
  notes?: string;
}

export const insertComprehensiveAllergySchema = z.object({
  patientId: z.string().min(1),
  allergen: z.string().min(1),
  allergenCode: z.string().optional(),
  allergenCodeSystem: z.enum(["rxnorm", "snomed", "ndfrt", "unii", "other"]).optional(),
  type: z.enum(["drug", "food", "environmental", "latex", "insect", "other"]),
  category: z.string().optional(),
  severity: z.enum(["mild", "moderate", "severe", "life_threatening", "unknown"]),
  criticality: z.enum(["low", "high", "unable_to_assess"]).optional(),
  status: z.enum(["active", "inactive", "resolved", "entered_in_error"]).default("active"),
  verificationStatus: z.enum(["unconfirmed", "confirmed", "refuted", "entered_in_error"]).default("unconfirmed"),
  onsetDate: z.string().optional(),
  onsetAge: z.number().optional(),
  recordedBy: z.string(),
  asserter: z.string().optional(),
  testingPerformed: z.boolean().default(false),
  notes: z.string().optional(),
  patientNotes: z.string().optional(),
  source: z.enum(["ehr", "patient_reported", "provider", "manual"]).default("manual"),
  ehrConnectionId: z.string().optional(),
});
export type InsertComprehensiveAllergy = z.infer<typeof insertComprehensiveAllergySchema>;

// ============================================
// SURGICAL HISTORY
// ============================================

export type SurgeryType = "major" | "minor" | "outpatient" | "emergency" | "elective" | "laparoscopic" | "robotic" | "open";
export type SurgeryOutcome = "successful" | "partially_successful" | "unsuccessful" | "complicated" | "unknown";

export interface SurgicalHistory {
  id: string;
  patientId: string;
  // Procedure info
  procedureName: string;
  procedureCode?: string; // CPT, ICD-10-PCS
  procedureCodeSystem?: "cpt" | "icd10pcs" | "snomed" | "other";
  surgeryType: SurgeryType;
  bodyPart?: string;
  laterality?: "left" | "right" | "bilateral" | "not_applicable";
  // Clinical info
  indication: string; // Why surgery was performed
  preOpDiagnosis?: string;
  postOpDiagnosis?: string;
  // Provider info
  surgeon: string;
  surgeonNPI?: string;
  anesthesiologist?: string;
  anesthesiaType?: "general" | "regional" | "local" | "sedation" | "none";
  facility: string;
  // Dates
  surgeryDate: string;
  duration?: number; // Minutes
  admissionDate?: string;
  dischargeDate?: string;
  // Outcome
  outcome: SurgeryOutcome;
  complications: SurgeryComplication[];
  findings?: string;
  pathologyResults?: string;
  // Recovery
  recoveryNotes?: string;
  followUpRequired: boolean;
  followUpDate?: string;
  restrictions?: string[];
  // Implants/devices
  implantsUsed: Implant[];
  // Notes
  operativeNotes?: string;
  patientNotes?: string;
  // Source
  source: "ehr" | "patient_reported" | "provider" | "manual";
  ehrConnectionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SurgeryComplication {
  id: string;
  type: "intraoperative" | "immediate_postop" | "delayed" | "chronic";
  description: string;
  severity: "minor" | "moderate" | "major" | "life_threatening";
  treatment?: string;
  resolved: boolean;
  resolvedDate?: string;
  sequelae?: string;
}

export interface Implant {
  id: string;
  name: string;
  manufacturer?: string;
  modelNumber?: string;
  serialNumber?: string;
  lotNumber?: string;
  expirationDate?: string;
  implantDate: string;
  location: string;
  status: "active" | "removed" | "replaced" | "failed";
  mriCompatible?: boolean;
  notes?: string;
}

export const insertSurgicalHistorySchema = z.object({
  patientId: z.string().min(1),
  procedureName: z.string().min(1),
  procedureCode: z.string().optional(),
  procedureCodeSystem: z.enum(["cpt", "icd10pcs", "snomed", "other"]).optional(),
  surgeryType: z.enum(["major", "minor", "outpatient", "emergency", "elective", "laparoscopic", "robotic", "open"]),
  bodyPart: z.string().optional(),
  laterality: z.enum(["left", "right", "bilateral", "not_applicable"]).optional(),
  indication: z.string().min(1),
  preOpDiagnosis: z.string().optional(),
  postOpDiagnosis: z.string().optional(),
  surgeon: z.string().min(1),
  surgeonNPI: z.string().optional(),
  anesthesiologist: z.string().optional(),
  anesthesiaType: z.enum(["general", "regional", "local", "sedation", "none"]).optional(),
  facility: z.string().min(1),
  surgeryDate: z.string().min(1),
  duration: z.number().optional(),
  outcome: z.enum(["successful", "partially_successful", "unsuccessful", "complicated", "unknown"]).default("unknown"),
  findings: z.string().optional(),
  pathologyResults: z.string().optional(),
  recoveryNotes: z.string().optional(),
  followUpRequired: z.boolean().default(false),
  followUpDate: z.string().optional(),
  operativeNotes: z.string().optional(),
  patientNotes: z.string().optional(),
  source: z.enum(["ehr", "patient_reported", "provider", "manual"]).default("manual"),
  ehrConnectionId: z.string().optional(),
});
export type InsertSurgicalHistory = z.infer<typeof insertSurgicalHistorySchema>;

// ============================================
// FAMILY HEALTH HISTORY
// ============================================

export type FamilyRelationship = 
  | "mother" | "father" | "sister" | "brother" 
  | "maternal_grandmother" | "maternal_grandfather" 
  | "paternal_grandmother" | "paternal_grandfather"
  | "maternal_aunt" | "maternal_uncle" | "paternal_aunt" | "paternal_uncle"
  | "daughter" | "son" | "half_sister" | "half_brother"
  | "maternal_cousin" | "paternal_cousin" | "twin" | "other";

export interface FamilyMember {
  id: string;
  patientId: string;
  // Relationship
  relationship: FamilyRelationship;
  name?: string; // Optional - privacy
  gender: "male" | "female" | "other" | "unknown";
  // Living status
  isLiving: boolean;
  birthYear?: number;
  deathYear?: number;
  ageAtDeath?: number;
  causeOfDeath?: string;
  // Conditions
  conditions: FamilyCondition[];
  // Genetic info
  geneticTestingDone: boolean;
  geneticTestResults?: GeneticTestResult[];
  // Notes
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyCondition {
  id: string;
  conditionName: string;
  conditionCode?: string; // ICD-10, SNOMED
  codeSystem?: "icd10" | "snomed" | "other";
  onsetAge?: number;
  currentAge?: number;
  outcome?: "ongoing" | "resolved" | "death" | "unknown";
  severity?: "mild" | "moderate" | "severe" | "unknown";
  notes?: string;
  // Risk assessment
  heritability?: "high" | "moderate" | "low" | "unknown";
  patientRiskLevel?: "elevated" | "average" | "reduced" | "unknown";
}

export interface GeneticTestResult {
  id: string;
  testName: string;
  gene?: string;
  variant?: string;
  result: "positive" | "negative" | "variant_of_uncertain_significance" | "inconclusive";
  interpretation?: string;
  performedAt?: string;
  lab?: string;
}

export interface FamilyHistorySummary {
  patientId: string;
  lastUpdated: string;
  // Risk summary
  highRiskConditions: string[];
  moderateRiskConditions: string[];
  geneticCounselingRecommended: boolean;
  // Condition prevalence
  conditionCounts: Record<string, { count: number; closestRelation: FamilyRelationship }>;
  // Three-generation status
  threeGenerationComplete: boolean;
  membersDocumented: number;
  // Screening recommendations
  screeningRecommendations: ScreeningRecommendation[];
}

export interface ScreeningRecommendation {
  id: string;
  condition: string;
  screening: string;
  startAge?: number;
  frequency?: string;
  rationale: string;
  priority: "high" | "medium" | "low";
}

export const insertFamilyMemberSchema = z.object({
  patientId: z.string().min(1),
  relationship: z.enum(["mother", "father", "sister", "brother", "maternal_grandmother", "maternal_grandfather", "paternal_grandmother", "paternal_grandfather", "maternal_aunt", "maternal_uncle", "paternal_aunt", "paternal_uncle", "daughter", "son", "half_sister", "half_brother", "maternal_cousin", "paternal_cousin", "twin", "other"]),
  name: z.string().optional(),
  gender: z.enum(["male", "female", "other", "unknown"]),
  isLiving: z.boolean().default(true),
  birthYear: z.number().optional(),
  deathYear: z.number().optional(),
  ageAtDeath: z.number().optional(),
  causeOfDeath: z.string().optional(),
  geneticTestingDone: z.boolean().default(false),
  notes: z.string().optional(),
});
export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;

export const insertFamilyConditionSchema = z.object({
  familyMemberId: z.string().min(1),
  conditionName: z.string().min(1),
  conditionCode: z.string().optional(),
  codeSystem: z.enum(["icd10", "snomed", "other"]).optional(),
  onsetAge: z.number().optional(),
  currentAge: z.number().optional(),
  outcome: z.enum(["ongoing", "resolved", "death", "unknown"]).optional(),
  severity: z.enum(["mild", "moderate", "severe", "unknown"]).optional(),
  notes: z.string().optional(),
  heritability: z.enum(["high", "moderate", "low", "unknown"]).optional(),
  patientRiskLevel: z.enum(["elevated", "average", "reduced", "unknown"]).optional(),
});
export type InsertFamilyCondition = z.infer<typeof insertFamilyConditionSchema>;

// ============================================
// SOCIAL DETERMINANTS OF HEALTH (SDOH)
// ============================================

export interface SocialDeterminants {
  id: string;
  patientId: string;
  lastAssessmentDate: string;
  assessedBy?: string;
  
  // Housing
  housing: HousingStatus;
  
  // Employment & Income
  employment: EmploymentStatus;
  
  // Education
  education: EducationStatus;
  
  // Food Security
  foodSecurity: FoodSecurityStatus;
  
  // Transportation
  transportation: TransportationStatus;
  
  // Social Support
  socialSupport: SocialSupportStatus;
  
  // Safety
  safety: SafetyStatus;
  
  // Lifestyle
  lifestyle: LifestyleFactors;
  
  // Healthcare Access
  healthcareAccess: HealthcareAccessStatus;
  
  // Overall risk level
  overallSdohRisk: "low" | "moderate" | "high" | "critical";
  priorityInterventions: string[];
  referrals: SdohReferral[];
  
  createdAt: string;
  updatedAt: string;
}

export interface HousingStatus {
  status: "stable" | "unstable" | "homeless" | "transitional" | "unknown";
  type?: "own" | "rent" | "family" | "shelter" | "other";
  qualityConcerns?: string[]; // mold, pests, no heat, etc.
  addressStable: boolean;
  householdSize?: number;
  monthlyHousingCost?: number;
  housingCostBurden?: "none" | "moderate" | "severe"; // >30% or >50% of income
  notes?: string;
}

export interface EmploymentStatus {
  status: "employed_full" | "employed_part" | "unemployed" | "retired" | "disabled" | "student" | "homemaker" | "other";
  occupation?: string;
  industry?: string;
  employer?: string;
  hoursPerWeek?: number;
  hasHealthInsurance: boolean;
  incomeLevel?: "below_poverty" | "low" | "moderate" | "adequate" | "prefer_not_to_say";
  annualIncomeRange?: string;
  publicAssistance?: string[]; // SNAP, Medicaid, etc.
  notes?: string;
}

export interface EducationStatus {
  highestLevel: "less_than_high_school" | "high_school" | "some_college" | "associates" | "bachelors" | "masters" | "doctorate" | "unknown";
  currentlyEnrolled: boolean;
  enrolledProgram?: string;
  healthLiteracy?: "limited" | "adequate" | "proficient";
  preferredLanguage?: string;
  needsInterpreter: boolean;
  notes?: string;
}

export interface FoodSecurityStatus {
  status: "secure" | "low" | "very_low" | "unknown";
  skippedMealsLast30Days: boolean;
  usedFoodPantry: boolean;
  receivesSnapBenefits: boolean;
  accessToHealthyFood: "easy" | "moderate" | "difficult" | "none";
  cookingFacilities: boolean;
  dietaryRestrictions?: string[];
  notes?: string;
}

export interface TransportationStatus {
  hasReliableTransportation: boolean;
  transportationType?: string[]; // car, public transit, rideshare, etc.
  transportationBarriers?: string[];
  missedAppointmentsDueToTransport: boolean;
  needsTransportationAssistance: boolean;
  notes?: string;
}

export interface SocialSupportStatus {
  livesAlone: boolean;
  hasEmergencyContact: boolean;
  socialIsolation: "none" | "mild" | "moderate" | "severe";
  supportNetwork?: string[]; // family, friends, church, etc.
  caregiverStatus?: "not_caregiver" | "caregiver" | "caregiver_with_burden";
  communityInvolvement?: string[];
  notes?: string;
}

export interface SafetyStatus {
  feelsPhysicallySafe: boolean;
  feelsEmotionallySafe: boolean;
  domesticViolenceConcern: boolean;
  abuseNeglectConcern: boolean;
  gunSafetyAssessed?: boolean;
  fallRisk?: boolean;
  neighborhoodSafety?: "safe" | "moderate" | "unsafe" | "unknown";
  notes?: string;
}

export interface LifestyleFactors {
  // Tobacco
  tobaccoUse: "never" | "former" | "current" | "unknown";
  tobaccoType?: string[];
  packYears?: number;
  quitDate?: string;
  readyToQuit?: boolean;
  
  // Alcohol
  alcoholUse: "none" | "occasional" | "moderate" | "heavy" | "unknown";
  drinksPerWeek?: number;
  bingeFrequency?: "never" | "monthly" | "weekly" | "daily";
  concernedAboutDrinking: boolean;
  
  // Substances
  substanceUse: "none" | "past" | "current" | "prefer_not_to_say";
  substanceTypes?: string[];
  inRecovery?: boolean;
  recoveryProgram?: string;
  
  // Physical Activity
  physicalActivityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  exerciseMinutesPerWeek?: number;
  exerciseBarriers?: string[];
  
  // Sleep
  sleepHoursPerNight?: number;
  sleepQualityConcerns: boolean;
  sleepDisorders?: string[];
  
  // Stress
  stressLevel: "low" | "moderate" | "high" | "severe";
  stressSources?: string[];
  copingStrategies?: string[];
  
  // Mental Health
  mentalHealthConcerns: boolean;
  mentalHealthDiagnoses?: string[];
  currentTreatment?: boolean;
  
  notes?: string;
}

export interface HealthcareAccessStatus {
  hasUsualSourceOfCare: boolean;
  primaryCareProvider?: string;
  lastPrimaryVisit?: string;
  hasHealthInsurance: boolean;
  insuranceType?: "private" | "medicare" | "medicaid" | "dual" | "uninsured" | "other";
  insuranceAdequacy?: "adequate" | "underinsured" | "gaps";
  costBarriers: boolean;
  delayedCareDueToCost: boolean;
  prescriptionCostBarriers: boolean;
  teleHealthAccess: boolean;
  preferredCommunication?: "phone" | "email" | "text" | "portal" | "mail";
  healthcareProxyDesignated: boolean;
  advanceDirectivesComplete: boolean;
  notes?: string;
}

export interface SdohReferral {
  id: string;
  domain: "housing" | "food" | "transportation" | "employment" | "education" | "safety" | "social" | "behavioral_health" | "other";
  organization: string;
  program?: string;
  contactInfo?: string;
  referralDate: string;
  status: "pending" | "accepted" | "declined" | "completed" | "lost_to_follow_up";
  outcome?: string;
  notes?: string;
}

export const insertSocialDeterminantsSchema = z.object({
  patientId: z.string().min(1),
  assessedBy: z.string().optional(),
});
export type InsertSocialDeterminants = z.infer<typeof insertSocialDeterminantsSchema>;

// ============================================
// FAMILY ACCOUNTS - Dependents & Proxy Access
// ============================================

export type DependentType = "child" | "elderly_parent" | "spouse" | "disabled_adult" | "other";
export type ProxyAccessLevel = "full" | "limited" | "emergency_only" | "view_only";
export type ProxyAccessStatus = "active" | "pending" | "expired" | "revoked" | "suspended";

export interface FamilyAccount {
  id: string;
  primaryUserId: string; // The account owner
  familyName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Dependent {
  id: string;
  familyAccountId: string;
  patientId: string; // Links to health records
  // Demographics
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other" | "unknown";
  relationship: DependentType;
  // Status
  isActive: boolean;
  // Pediatric specific
  pediatricInfo?: PediatricInfo;
  // Elderly specific  
  elderlyInfo?: ElderlyInfo;
  // Notes
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PediatricInfo {
  schoolName?: string;
  gradeLevel?: string;
  primaryCarePediatrician?: string;
  immunizationsUpToDate: boolean;
  developmentalMilestones?: DevelopmentalMilestone[];
  growthChartPercentiles?: GrowthChartData;
  allergiesConfirmed?: boolean;
  parentalConsentDate?: string;
  specialNeeds?: string[];
}

export interface DevelopmentalMilestone {
  milestone: string;
  expectedAge: string;
  achievedAge?: string;
  status: "achieved" | "delayed" | "not_applicable" | "pending";
  notes?: string;
}

export interface GrowthChartData {
  heightPercentile?: number;
  weightPercentile?: number;
  bmiPercentile?: number;
  headCircumferencePercentile?: number;
  lastMeasurementDate?: string;
}

export interface ElderlyInfo {
  primaryCaregiver?: string;
  livingArrangement: "independent" | "assisted_living" | "nursing_home" | "with_family" | "other";
  cognitiveStatus?: "intact" | "mild_impairment" | "moderate_impairment" | "severe_impairment" | "unknown";
  mobilityStatus?: "independent" | "assistive_device" | "wheelchair" | "bedbound";
  fallRisk: boolean;
  polypharmacy: boolean; // 5+ medications
  advanceDirectives: boolean;
  healthcareProxy?: string;
  doNotResuscitate?: boolean;
  preferredHospital?: string;
  homeHealthServices?: boolean;
  mealServices?: boolean;
  transportationNeeds?: boolean;
}

export interface ProxyAccess {
  id: string;
  dependentId: string;
  proxyUserId: string;
  proxyName: string;
  proxyEmail: string;
  // Access configuration
  accessLevel: ProxyAccessLevel;
  status: ProxyAccessStatus;
  // Permissions
  permissions: ProxyPermission[];
  // Time limits
  grantedAt: string;
  expiresAt?: string;
  lastAccessAt?: string;
  // Approval
  approvedBy: string;
  approvalMethod: "legal_guardian" | "healthcare_proxy" | "power_of_attorney" | "patient_consent" | "court_order" | "emergency";
  legalDocumentRef?: string;
  // Audit
  accessCount: number;
  notifications: boolean;
  auditLevel: "all_access" | "sensitive_only" | "none";
  createdAt: string;
  updatedAt: string;
}

export type ProxyPermission = 
  | "view_records" | "view_medications" | "view_appointments" | "view_lab_results"
  | "manage_appointments" | "request_refills" | "message_providers"
  | "consent_to_treatment" | "access_sensitive_records" | "export_data"
  | "emergency_decisions" | "end_of_life_decisions";

export interface ProxyAccessAuditLog {
  id: string;
  proxyAccessId: string;
  proxyUserId: string;
  proxyName: string;
  dependentId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
  success: boolean;
  denialReason?: string;
}

export const insertDependentSchema = z.object({
  familyAccountId: z.string().min(1),
  patientId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  gender: z.enum(["male", "female", "other", "unknown"]),
  relationship: z.enum(["child", "elderly_parent", "spouse", "disabled_adult", "other"]),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});
export type InsertDependent = z.infer<typeof insertDependentSchema>;

export const insertProxyAccessSchema = z.object({
  dependentId: z.string().min(1),
  proxyUserId: z.string().min(1),
  proxyName: z.string().min(1),
  proxyEmail: z.string().email(),
  accessLevel: z.enum(["full", "limited", "emergency_only", "view_only"]),
  permissions: z.array(z.enum([
    "view_records", "view_medications", "view_appointments", "view_lab_results",
    "manage_appointments", "request_refills", "message_providers",
    "consent_to_treatment", "access_sensitive_records", "export_data",
    "emergency_decisions", "end_of_life_decisions"
  ])),
  expiresAt: z.string().optional(),
  approvedBy: z.string().min(1),
  approvalMethod: z.enum(["legal_guardian", "healthcare_proxy", "power_of_attorney", "patient_consent", "court_order", "emergency"]),
  legalDocumentRef: z.string().optional(),
  notifications: z.boolean().default(true),
  auditLevel: z.enum(["all_access", "sensitive_only", "none"]).default("all_access"),
});
export type InsertProxyAccess = z.infer<typeof insertProxyAccessSchema>;

// ============================================
// ENHANCED VITALS
// ============================================

export interface EnhancedVital {
  id: string;
  patientId: string;
  recordedAt: string;
  recordedBy?: string;
  source: "ehr" | "device" | "patient_reported" | "provider" | "manual";
  deviceId?: string;
  
  // Blood Pressure
  bloodPressure?: {
    systolic: number;
    diastolic: number;
    position?: "sitting" | "standing" | "lying";
    arm?: "left" | "right";
    cuffSize?: "small" | "regular" | "large";
  };
  
  // Heart
  heartRate?: number;
  heartRhythm?: "regular" | "irregular" | "unknown";
  pulseOximetry?: number;
  
  // Temperature
  temperature?: number;
  temperatureUnit?: "F" | "C";
  temperatureMethod?: "oral" | "temporal" | "tympanic" | "axillary" | "rectal";
  
  // Respiratory
  respiratoryRate?: number;
  
  // Measurements
  height?: number;
  heightUnit?: "in" | "cm";
  weight?: number;
  weightUnit?: "lbs" | "kg";
  bmi?: number;
  waistCircumference?: number;
  
  // Pain
  painLevel?: number; // 0-10
  painLocation?: string;
  
  // Blood Glucose
  bloodGlucose?: number;
  bloodGlucoseTiming?: "fasting" | "pre_meal" | "post_meal" | "random" | "bedtime";
  
  // Other
  notes?: string;
  abnormalFlags?: string[];
  
  createdAt: string;
  updatedAt: string;
}

export const insertEnhancedVitalSchema = z.object({
  patientId: z.string().min(1),
  recordedAt: z.string().min(1),
  recordedBy: z.string().optional(),
  source: z.enum(["ehr", "device", "patient_reported", "provider", "manual"]).default("manual"),
  deviceId: z.string().optional(),
  heartRate: z.number().optional(),
  pulseOximetry: z.number().optional(),
  temperature: z.number().optional(),
  temperatureUnit: z.enum(["F", "C"]).optional(),
  respiratoryRate: z.number().optional(),
  height: z.number().optional(),
  heightUnit: z.enum(["in", "cm"]).optional(),
  weight: z.number().optional(),
  weightUnit: z.enum(["lbs", "kg"]).optional(),
  painLevel: z.number().min(0).max(10).optional(),
  painLocation: z.string().optional(),
  bloodGlucose: z.number().optional(),
  bloodGlucoseTiming: z.enum(["fasting", "pre_meal", "post_meal", "random", "bedtime"]).optional(),
  notes: z.string().optional(),
});
export type InsertEnhancedVital = z.infer<typeof insertEnhancedVitalSchema>;

// ============================================
// WEARABLE DATA IMPORT
// ============================================

export type WearablePlatform = "apple_health" | "google_fit" | "fitbit" | "garmin" | "whoop" | "oura" | "samsung_health" | "withings" | "dexcom" | "libre" | "other";

export interface WearableConnection {
  id: string;
  patientId: string;
  platform: WearablePlatform;
  accountId?: string;
  displayName: string;
  // OAuth tokens — persisted ENCRYPTED via encryptConnectionForStorage
  // (server/security/phi-encryption.ts). Always pass instances of this
  // interface through that helper before storing, and through
  // decryptConnectionFromStorage on read. The IStorage methods
  // updateWearableConnection / getWearableConnection enforce this.
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  // Sync settings
  syncEnabled: boolean;
  lastSyncAt?: string;
  lastSyncStatus: "success" | "partial" | "failed" | "never";
  syncError?: string;
  // Data types
  enabledDataTypes: WearableDataType[];
  availableDataTypes: WearableDataType[];
  // Permissions
  permissionGrantedAt?: string;
  permissionScope?: string[];
  // Status
  status: "connected" | "disconnected" | "expired" | "error" | "pending";
  createdAt: string;
  updatedAt: string;
}

export type WearableDataType = 
  | "steps" | "distance" | "floors_climbed" | "active_minutes" | "calories"
  | "heart_rate" | "heart_rate_variability" | "resting_heart_rate" | "vo2_max"
  | "sleep" | "sleep_stages" | "respiratory_rate" | "blood_oxygen"
  | "weight" | "body_fat" | "lean_mass" | "bmi" | "water_percent"
  | "blood_pressure" | "blood_glucose" | "temperature"
  | "workouts" | "workout_routes" | "cycling" | "running" | "swimming"
  | "menstrual_cycle" | "mindfulness" | "stress";

export interface WearableDataImport {
  id: string;
  connectionId: string;
  patientId: string;
  dataType: WearableDataType;
  importedAt: string;
  recordCount: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  status: "pending" | "processing" | "completed" | "failed";
  errorMessage?: string;
}

// Privacy Center Analytics
export const privacyCenterEventTypes = [
  "privacy_center_opened",
  "connection_revoked",
  "account_delete_requested",
  "data_export_requested",
  "data_export_completed",
] as const;
export type PrivacyCenterEventType = typeof privacyCenterEventTypes[number];

export interface PrivacyCenterAnalyticsRecord {
  id: string;
  userId: string;
  eventType: PrivacyCenterEventType;
  resourceId?: string; // e.g., connection ID, export ID
  resourceType?: string; // e.g., "connection", "export", "account"
  metadata?: Record<string, string>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export const insertPrivacyCenterAnalyticsRecordSchema = z.object({
  userId: z.string().min(1),
  eventType: z.enum(privacyCenterEventTypes),
  resourceId: z.string().optional(),
  resourceType: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

export type InsertPrivacyCenterAnalyticsRecord = z.infer<typeof insertPrivacyCenterAnalyticsRecordSchema>;

// Data Export types
export const dataExportFormats = ["json", "pdf", "fhir"] as const;
export type DataExportFormat = typeof dataExportFormats[number];

export const dataExportStatuses = ["pending", "processing", "completed", "failed"] as const;
export type DataExportStatus = typeof dataExportStatuses[number];

export interface DataExportRecord {
  id: string;
  userId: string;
  format: DataExportFormat;
  status: DataExportStatus;
  requestedAt: string;
  completedAt?: string;
  downloadUrl?: string;
  expiresAt?: string;
  includeCategories: string[];
  fileSizeBytes?: number;
}

export const insertDataExportRecordSchema = z.object({
  userId: z.string().min(1),
  format: z.enum(dataExportFormats),
  includeCategories: z.array(z.string()).default(["all"]),
});

export type InsertDataExportRecord = z.infer<typeof insertDataExportRecordSchema>;

// Account Deletion Request
export const accountDeletionStatuses = ["pending", "confirmed", "processing", "completed", "cancelled"] as const;
export type AccountDeletionStatus = typeof accountDeletionStatuses[number];

export interface AccountDeletionRequest {
  id: string;
  userId: string;
  status: AccountDeletionStatus;
  requestedAt: string;
  confirmationToken: string;
  confirmedAt?: string;
  completedAt?: string;
  expiresAt: string;
  reason?: string;
}

export const insertAccountDeletionRequestSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().optional(),
});

export type InsertAccountDeletionRequest = z.infer<typeof insertAccountDeletionRequestSchema>;

// AI Preferences - User opt-out controls for AI features
export interface AIPreferences {
  userId: string;
  aiExplanationsEnabled: boolean;
  aiSummariesEnabled: boolean;
  updatedAt: string;
}

export const insertAIPreferencesSchema = z.object({
  userId: z.string().min(1),
  aiExplanationsEnabled: z.boolean().default(true),
  aiSummariesEnabled: z.boolean().default(true),
});

export type InsertAIPreferences = z.infer<typeof insertAIPreferencesSchema>;

export const updateAIPreferencesSchema = z.object({
  aiExplanationsEnabled: z.boolean().optional(),
  aiSummariesEnabled: z.boolean().optional(),
});

export type UpdateAIPreferences = z.infer<typeof updateAIPreferencesSchema>;

// AI opt-out analytics event types
export const aiOptOutEventTypes = ["ai_optout_enabled", "ai_optout_disabled"] as const;
export type AIOptOutEventType = typeof aiOptOutEventTypes[number];

// ============================================
// SMART SEARCH
// ============================================

export const searchResultTypes = [
  "lab_result",
  "medication",
  "imaging",
  "visit",
  "document",
  "condition",
  "allergy",
  "procedure",
  "vaccination",
] as const;
export type SearchResultType = typeof searchResultTypes[number];

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  description: string;
  date: string;
  source: string;
  sourcePlatform?: string;
  matchType: "exact" | "synonym" | "fuzzy";
  matchedTerms: string[];
  relevanceScore: number;
}

export const searchQuerySchema = z.object({
  query: z.string().min(1).max(200),
  types: z.array(z.enum(searchResultTypes)).optional(),
  limit: z.number().min(1).max(100).default(20),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const searchResponseSchema = z.object({
  query: z.string(),
  results: z.array(z.object({
    id: z.string(),
    type: z.enum(searchResultTypes),
    title: z.string(),
    description: z.string(),
    date: z.string(),
    source: z.string(),
    sourcePlatform: z.string().optional(),
    matchType: z.enum(["exact", "synonym", "fuzzy"]),
    matchedTerms: z.array(z.string()),
    relevanceScore: z.number(),
  })),
  totalCount: z.number(),
  synonymsUsed: z.array(z.string()).optional(),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

// Search Analytics Events
export const searchAnalyticsEventTypes = [
  "search_opened",
  "search_query_submitted",
  "search_result_clicked",
  "search_zero_results",
] as const;
export type SearchAnalyticsEventType = typeof searchAnalyticsEventTypes[number];

export const searchAnalyticsSchema = z.object({
  eventType: z.enum(searchAnalyticsEventTypes),
  metadata: z.record(z.string()).optional(),
});
export type SearchAnalyticsEvent = z.infer<typeof searchAnalyticsSchema>;

// ============================================
// DELTA INBOX ("What Changed Since Last Time")
// ============================================

export const deltaItemTypes = [
  "lab_result",
  "document",
  "medication_started",
  "medication_stopped",
  "medication_changed",
  "condition_added",
  "allergy_added",
  "appointment_scheduled",
  "imaging_result",
] as const;
export type DeltaItemType = typeof deltaItemTypes[number];

export const deltaItemStatuses = ["new", "reviewed"] as const;
export type DeltaItemStatus = typeof deltaItemStatuses[number];

export interface DeltaItem {
  id: string;
  userId: string;
  itemType: DeltaItemType;
  itemId: string;
  title: string;
  description: string;
  source: string;
  sourcePlatform?: string;
  createdAt: string;
  detectedAt: string;
  status: DeltaItemStatus;
  reviewedAt?: string;
  priority: "low" | "medium" | "high" | "critical";
  metadata?: Record<string, string>;
}

export const insertDeltaItemSchema = z.object({
  userId: z.string().min(1),
  itemType: z.enum(deltaItemTypes),
  itemId: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  source: z.string(),
  sourcePlatform: z.string().optional(),
  createdAt: z.string(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  metadata: z.record(z.string()).optional(),
});
export type InsertDeltaItem = z.infer<typeof insertDeltaItemSchema>;

export const markDeltaItemReviewedSchema = z.object({
  itemIds: z.array(z.string()).min(1),
});
export type MarkDeltaItemReviewed = z.infer<typeof markDeltaItemReviewedSchema>;

// Delta Inbox Analytics Events
export const deltaAnalyticsEventTypes = [
  "delta_inbox_opened",
  "delta_item_clicked",
  "delta_marked_reviewed",
] as const;
export type DeltaAnalyticsEventType = typeof deltaAnalyticsEventTypes[number];

export const deltaAnalyticsSchema = z.object({
  eventType: z.enum(deltaAnalyticsEventTypes),
  metadata: z.record(z.string()).optional(),
});
export type DeltaAnalyticsEvent = z.infer<typeof deltaAnalyticsSchema>;

// User last login tracking for delta detection
export interface UserLoginSession {
  userId: string;
  lastLoginAt: string;
  previousLoginAt?: string;
}

// ==================== Health Journeys ====================

// Journey trigger types - what can initiate a journey
export const journeyTriggerTypes = [
  "risk_indicator",
  "condition_diagnosis",
  "medication_start",
  "lab_result",
  "vital_threshold",
  "manual",
  "provider_assigned",
] as const;
export type JourneyTriggerType = typeof journeyTriggerTypes[number];

// Journey step types
export const journeyStepTypes = [
  "education",
  "reminder",
  "data_collection",
  "check_in",
  "action_item",
  "milestone",
] as const;
export type JourneyStepType = typeof journeyStepTypes[number];

// Journey statuses
export const journeyStatuses = [
  "not_started",
  "active",
  "paused",
  "completed",
  "abandoned",
] as const;
export type JourneyStatus = typeof journeyStatuses[number];

// Step statuses
export const stepStatuses = [
  "pending",
  "available",
  "in_progress",
  "completed",
  "skipped",
] as const;
export type StepStatus = typeof stepStatuses[number];

// Journey template - defines the blueprint for a journey
export interface HealthJourneyTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  triggerType: JourneyTriggerType;
  triggerConditions: {
    riskIndicatorTypes?: string[];
    conditionCodes?: string[];
    medicationClasses?: string[];
    labCodes?: string[];
    vitalTypes?: string[];
    severityThreshold?: string;
  };
  estimatedDurationDays: number;
  steps: HealthJourneyStepTemplate[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Step template within a journey template
export interface HealthJourneyStepTemplate {
  id: string;
  order: number;
  type: JourneyStepType;
  title: string;
  description: string;
  content?: {
    educationText?: string;
    educationLinks?: { title: string; url: string }[];
    reminderMessage?: string;
    actionInstructions?: string;
    milestoneDescription?: string;
  };
  dataCollection?: {
    fields: {
      name: string;
      label: string;
      type: "text" | "number" | "boolean" | "select" | "scale";
      options?: string[];
      required: boolean;
      unit?: string;
    }[];
  };
  timing: {
    delayFromPreviousDays: number;
    reminderIntervalHours?: number;
    dueWithinDays?: number;
  };
  conditions?: {
    requiresPreviousCompletion: boolean;
    skipConditions?: Record<string, string>;
  };
}

// Active journey instance for a patient
export interface HealthJourneyInstance {
  id: string;
  userId: string;
  templateId: string;
  templateName: string;
  status: JourneyStatus;
  triggeredBy: JourneyTriggerType;
  triggerDetails: Record<string, string>;
  startedAt: string;
  expectedCompletionAt: string;
  completedAt?: string;
  pausedAt?: string;
  currentStepIndex: number;
  progressPercent: number;
  steps: HealthJourneyStepInstance[];
  metadata?: Record<string, string>;
}

// Step instance within an active journey
export interface HealthJourneyStepInstance {
  id: string;
  templateStepId: string;
  order: number;
  type: JourneyStepType;
  title: string;
  status: StepStatus;
  availableAt: string;
  dueAt?: string;
  completedAt?: string;
  skippedAt?: string;
  collectedData?: Record<string, string | number | boolean>;
  remindersSent: number;
  lastReminderAt?: string;
}

// Reminder for journey steps
export interface JourneyReminder {
  id: string;
  userId: string;
  journeyId: string;
  stepId: string;
  scheduledAt: string;
  sentAt?: string;
  type: "step_available" | "step_due" | "follow_up" | "milestone";
  message: string;
  channel: "in_app" | "push" | "email";
  status: "scheduled" | "sent" | "dismissed" | "failed";
}

// Insert schemas
export const insertHealthJourneyTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  category: z.string(),
  triggerType: z.enum(journeyTriggerTypes),
  triggerConditions: z.object({
    riskIndicatorTypes: z.array(z.string()).optional(),
    conditionCodes: z.array(z.string()).optional(),
    medicationClasses: z.array(z.string()).optional(),
    labCodes: z.array(z.string()).optional(),
    vitalTypes: z.array(z.string()).optional(),
    severityThreshold: z.string().optional(),
  }),
  estimatedDurationDays: z.number().positive(),
  steps: z.array(z.any()),
  isActive: z.boolean().default(true),
});
export type InsertHealthJourneyTemplate = z.infer<typeof insertHealthJourneyTemplateSchema>;

export const insertHealthJourneyInstanceSchema = z.object({
  userId: z.string().min(1),
  templateId: z.string().min(1),
  triggeredBy: z.enum(journeyTriggerTypes),
  triggerDetails: z.record(z.string()),
});
export type InsertHealthJourneyInstance = z.infer<typeof insertHealthJourneyInstanceSchema>;

export const completeJourneyStepSchema = z.object({
  stepId: z.string().min(1),
  collectedData: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type CompleteJourneyStep = z.infer<typeof completeJourneyStepSchema>;

export const journeyAnalyticsEventTypes = [
  "journey_started",
  "journey_step_viewed",
  "journey_step_completed",
  "journey_step_skipped",
  "journey_data_submitted",
  "journey_completed",
  "journey_paused",
  "journey_resumed",
  "journey_reminder_sent",
  "journey_reminder_dismissed",
] as const;
export type JourneyAnalyticsEventType = typeof journeyAnalyticsEventTypes[number];

export const journeyAnalyticsSchema = z.object({
  eventType: z.enum(journeyAnalyticsEventTypes),
  journeyId: z.string().optional(),
  stepId: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});
export type JourneyAnalyticsEvent = z.infer<typeof journeyAnalyticsSchema>;

// ==================== Admin Analytics Dashboard ====================

// Journey Analytics Summary
export interface JourneyAnalyticsSummary {
  totalJourneysStarted: number;
  totalJourneysCompleted: number;
  totalJourneysActive: number;
  totalJourneysAbandoned: number;
  completionRate: number;
  averageCompletionDays: number;
  averageEngagementScore: number;
}

// Journey Metrics by Template
export interface JourneyTemplateMetrics {
  templateId: string;
  templateName: string;
  category: string;
  totalStarted: number;
  totalCompleted: number;
  totalActive: number;
  totalAbandoned: number;
  completionRate: number;
  averageProgressPercent: number;
  averageCompletionDays: number;
  totalDataPointsCollected: number;
}

// Journey Engagement Metrics (for admin analytics)
export interface JourneyEngagementMetrics {
  totalActivePatients: number;
  totalPatientsWithJourneys: number;
  averageJourneysPerPatient: number;
  averageStepsCompletedPerDay: number;
  reminderResponseRate: number;
  dataSubmissionRate: number;
}

// Time-series data point for trend charts
export interface TrendDataPoint {
  date: string;
  value: number;
  label?: string;
}

// Trend data for analytics
export interface AnalyticsTrends {
  journeysStarted: TrendDataPoint[];
  journeysCompleted: TrendDataPoint[];
  stepCompletions: TrendDataPoint[];
  dataSubmissions: TrendDataPoint[];
  engagementScores: TrendDataPoint[];
}

// Feedback summary
export interface JourneyFeedbackSummary {
  totalFeedbackSubmissions: number;
  averageRating: number;
  ratingDistribution: { rating: number; count: number }[];
  commonChallenges: { challenge: string; count: number }[];
  commonQuestions: { question: string; count: number }[];
}

// Data Quality Metrics
export interface DataQualityMetrics {
  overallScore: number;
  completenessScore: number;
  accuracyScore: number;
  timelinessScore: number;
  consistencyScore: number;
  totalRecordsAnalyzed: number;
  issuesDetected: number;
  issuesByCategory: { category: string; count: number; severity: string }[];
}

// Admin Analytics Dashboard Response
export interface AdminAnalyticsDashboard {
  generatedAt: string;
  dateRange: { start: string; end: string };
  journeySummary: JourneyAnalyticsSummary;
  templateMetrics: JourneyTemplateMetrics[];
  patientEngagement: JourneyEngagementMetrics;
  trends: AnalyticsTrends;
  feedbackSummary: JourneyFeedbackSummary;
  dataQuality: DataQualityMetrics;
}

// Analytics filter options
export const analyticsTimeRanges = [
  "7d", "14d", "30d", "90d", "180d", "365d", "all"
] as const;
export type AnalyticsTimeRange = typeof analyticsTimeRanges[number];

export const analyticsFilterSchema = z.object({
  timeRange: z.enum(analyticsTimeRanges).default("30d"),
  templateIds: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  journeyStatuses: z.array(z.enum(journeyStatuses)).optional(),
});
export type AnalyticsFilter = z.infer<typeof analyticsFilterSchema>;

// ==================== Care Team AI Outreach System ====================

// Risk priority levels for patient prioritization
export const riskPriorityLevels = ["critical", "high", "moderate", "low"] as const;
export type RiskPriorityLevel = typeof riskPriorityLevels[number];

// Outreach action types
export const outreachActionTypes = ["phone_call", "secure_message", "email", "in_person_visit", "video_call", "care_coordination"] as const;
export type OutreachActionType = typeof outreachActionTypes[number];

// Outreach status
export const outreachStatuses = ["scheduled", "in_progress", "completed", "no_response", "cancelled", "rescheduled"] as const;
export type OutreachStatus = typeof outreachStatuses[number];

// Patient response types
export const patientResponseTypes = ["answered", "voicemail", "no_answer", "declined", "callback_requested", "message_read", "message_replied", "appointment_scheduled"] as const;
export type PatientResponseType = typeof patientResponseTypes[number];

// High-risk patient profile for care team dashboard
export interface HighRiskPatient {
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  priorityLevel: RiskPriorityLevel;
  riskScore: number;
  riskFactors: PatientRiskFactor[];
  recentAlerts: PatientAlert[];
  lastContactDate: string | null;
  daysSinceContact: number;
  suggestedActions: SuggestedOutreachAction[];
  assignedCareTeamMember: string | null;
  insuranceInfo?: string;
  primaryProvider?: string;
  contactInfo: {
    phone?: string;
    email?: string;
    preferredContactMethod?: OutreachActionType;
  };
}

// Individual risk factor
export interface PatientRiskFactor {
  id: string;
  category: "vital_trend" | "lab_abnormality" | "medication_adherence" | "care_gap" | "social_determinant" | "chronic_condition" | "hospitalization_risk";
  severity: "critical" | "high" | "moderate" | "low";
  title: string;
  description: string;
  dataPoints: string[];
  lastUpdated: string;
  trendDirection?: "worsening" | "stable" | "improving";
}

// Patient alert for dashboard
export interface PatientAlert {
  id: string;
  type: "critical_value" | "missed_appointment" | "medication_issue" | "hospitalization" | "er_visit" | "care_gap";
  severity: "critical" | "high" | "moderate";
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

// Suggested outreach action from AI
export interface SuggestedOutreachAction {
  id: string;
  actionType: OutreachActionType;
  priority: RiskPriorityLevel;
  reason: string;
  suggestedTiming: string;
  estimatedDuration: number;
  requiredRole?: CareTeamRole;
}

// AI-generated talking points for outreach
export interface OutreachTalkingPoints {
  patientId: string;
  generatedAt: string;
  patientContext: {
    name: string;
    recentChanges: string[];
    keyRisks: string[];
    lastInteraction: string;
  };
  openingStatement: string;
  keyDiscussionPoints: {
    topic: string;
    importance: "critical" | "high" | "moderate";
    talkingPoint: string;
    suggestedQuestions: string[];
    anticipatedConcerns: string[];
  }[];
  suggestedInterventions: {
    intervention: string;
    rationale: string;
    patientBenefits: string[];
  }[];
  closingGuidance: string;
  followUpRecommendations: string[];
  messageTemplate?: string;
  escalationTriggers: string[];
  culturalConsiderations?: string;
}

// Outreach action record
export interface OutreachAction {
  id: string;
  patientId: string;
  patientName: string;
  actionType: OutreachActionType;
  status: OutreachStatus;
  priority: RiskPriorityLevel;
  scheduledDate: string;
  scheduledTime?: string;
  assignedTo: string;
  assignedToRole: CareTeamRole;
  reason: string;
  talkingPointsId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  notes?: string;
  outcome?: PatientOutcome;
  attempts: OutreachAttempt[];
  triggeredBy: "ai_recommendation" | "manual" | "care_gap" | "population_health";
  riskFactorIds: string[];
}

// Individual outreach attempt
export interface OutreachAttempt {
  id: string;
  attemptNumber: number;
  timestamp: string;
  method: OutreachActionType;
  response: PatientResponseType;
  duration?: number;
  notes?: string;
  performedBy: string;
  nextSteps?: string;
}

// Patient outcome after outreach
export interface PatientOutcome {
  appointmentScheduled: boolean;
  appointmentDate?: string;
  medicationChanged: boolean;
  referralMade: boolean;
  referralType?: string;
  educationProvided: boolean;
  patientAgreesToFollowUp: boolean;
  escalatedToProvider: boolean;
  escalationReason?: string;
  additionalNotes?: string;
}

// Care Team Outreach Dashboard Summary
export interface OutreachDashboardSummary {
  totalHighRiskPatients: number;
  patientsByPriority: { priority: RiskPriorityLevel; count: number }[];
  pendingOutreachActions: number;
  completedToday: number;
  overdueActions: number;
  averageResponseRate: number;
  topRiskCategories: { category: string; count: number }[];
  teamPerformance: {
    memberId: string;
    memberName: string;
    role: CareTeamRole;
    assignedPatients: number;
    completedActions: number;
    pendingActions: number;
  }[];
}

// Outreach analytics
export interface OutreachAnalytics {
  dateRange: { start: string; end: string };
  totalOutreachAttempts: number;
  successfulContacts: number;
  contactRate: number;
  averageAttemptsPerPatient: number;
  outcomeBreakdown: {
    appointmentsScheduled: number;
    medicationsAdjusted: number;
    referralsMade: number;
    escalations: number;
  };
  responseByMethod: { method: OutreachActionType; successRate: number; count: number }[];
  patientEngagementTrend: { date: string; contacted: number; responded: number }[];
}

// Insert schema for outreach action
export const insertOutreachActionSchema = z.object({
  patientId: z.string(),
  patientName: z.string(),
  actionType: z.enum(outreachActionTypes),
  priority: z.enum(riskPriorityLevels),
  scheduledDate: z.string(),
  scheduledTime: z.string().optional(),
  assignedTo: z.string(),
  assignedToRole: z.enum(["primary_physician", "specialist", "nurse", "care_coordinator", "pharmacist", "therapist", "social_worker", "caregiver", "other"]),
  reason: z.string(),
  riskFactorIds: z.array(z.string()).default([]),
  triggeredBy: z.enum(["ai_recommendation", "manual", "care_gap", "population_health"]).default("manual"),
});
export type InsertOutreachAction = z.infer<typeof insertOutreachActionSchema>;

// Insert schema for outreach attempt
export const insertOutreachAttemptSchema = z.object({
  outreachActionId: z.string(),
  method: z.enum(outreachActionTypes),
  response: z.enum(patientResponseTypes),
  duration: z.number().optional(),
  notes: z.string().optional(),
  nextSteps: z.string().optional(),
});
export type InsertOutreachAttempt = z.infer<typeof insertOutreachAttemptSchema>;

// Patient outcome schema
export const patientOutcomeSchema = z.object({
  appointmentScheduled: z.boolean().default(false),
  appointmentDate: z.string().optional(),
  medicationChanged: z.boolean().default(false),
  referralMade: z.boolean().default(false),
  referralType: z.string().optional(),
  educationProvided: z.boolean().default(false),
  patientAgreesToFollowUp: z.boolean().default(false),
  escalatedToProvider: z.boolean().default(false),
  escalationReason: z.string().optional(),
  additionalNotes: z.string().optional(),
});

// ============================================
// AI-GENERATED CARE PLAN SYSTEM
// ============================================

// Care Plan Status
export const carePlanStatuses = ["draft", "pending_review", "approved", "active", "completed", "cancelled"] as const;
export type CarePlanStatus = typeof carePlanStatuses[number];

// SMART Goal Status
export const smartGoalStatuses = ["not_started", "in_progress", "achieved", "partially_achieved", "not_achieved", "deferred"] as const;
export type SmartGoalStatus = typeof smartGoalStatuses[number];

// Goal Categories
export const goalCategories = [
  "medication_management",
  "vital_monitoring", 
  "lifestyle_modification",
  "disease_management",
  "preventive_care",
  "mental_health",
  "social_support",
  "care_coordination",
] as const;
export type GoalCategory = typeof goalCategories[number];

// Intervention Categories
export const interventionCategories = [
  "medication",
  "monitoring",
  "education",
  "counseling",
  "referral",
  "diagnostic",
  "therapeutic",
  "lifestyle",
  "care_coordination",
  "social_services",
] as const;
export type InterventionCategory = typeof interventionCategories[number];

// AI Care Plan Intervention Priority
export const aiInterventionPriorities = ["critical", "high", "medium", "low"] as const;
export type AIInterventionPriority = typeof aiInterventionPriorities[number];

// Education Material Types
export const educationMaterialTypes = [
  "video",
  "document",
  "interactive",
  "infographic",
  "checklist",
  "worksheet",
  "webinar",
  "app",
] as const;
export type EducationMaterialType = typeof educationMaterialTypes[number];

// Follow-up Frequency
export const followUpFrequencies = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "as_needed",
] as const;
export type FollowUpFrequency = typeof followUpFrequencies[number];

// SMART Goal structure
export interface SmartGoal {
  id: string;
  category: GoalCategory;
  specific: string;        // What exactly the patient will accomplish
  measurable: string;      // How progress will be measured
  achievable: string;      // Why this goal is realistic
  relevant: string;        // Why this goal matters to the patient
  timeBound: string;       // Target completion date/timeframe
  targetValue?: string;    // Quantitative target (e.g., "A1C < 7%")
  currentValue?: string;   // Current baseline value
  status: SmartGoalStatus;
  progress: number;        // 0-100 percentage
  milestones: {
    id: string;
    description: string;
    targetDate: string;
    completed: boolean;
    completedDate?: string;
  }[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// AI Care Plan Intervention Status
export const aiInterventionStatuses = ["pending", "active", "completed", "cancelled"] as const;
export type AIInterventionStatus = typeof aiInterventionStatuses[number];

// AI Care Plan Intervention structure
export interface AICarePlanIntervention {
  id: string;
  category: InterventionCategory;
  priority: AIInterventionPriority;
  title: string;
  description: string;
  rationale: string;         // Why this intervention is recommended
  isFromLibrary: boolean;    // From existing library or AI-generated
  libraryId?: string;        // Reference to intervention library
  responsibleParty: string;  // Who performs this intervention
  frequency?: string;        // How often (if recurring)
  duration?: string;         // How long the intervention lasts
  resources?: string[];      // Required resources/equipment
  contraindications?: string[];
  status: AIInterventionStatus;
  startDate?: string;
  endDate?: string;
  outcomes?: string;
  createdAt: string;
  updatedAt: string;
}

// Patient Education Material
export interface PatientEducationMaterial {
  id: string;
  title: string;
  description: string;
  type: EducationMaterialType;
  category: GoalCategory;
  url?: string;
  content?: string;
  readingLevel: "basic" | "intermediate" | "advanced";
  languages: string[];
  estimatedDuration: number; // minutes
  isRecommended: boolean;
  relevanceScore: number;    // 0-100 AI-determined relevance
  rationale: string;         // Why this material is recommended
  tags: string[];
  viewedAt?: string;
  completedAt?: string;
}

// Follow-up Schedule Item
export interface FollowUpScheduleItem {
  id: string;
  type: "appointment" | "lab_test" | "screening" | "check_in" | "review";
  title: string;
  description: string;
  frequency: FollowUpFrequency;
  scheduledDate: string;
  scheduledTime?: string;
  provider?: string;
  location?: string;
  preparationInstructions?: string;
  reminderDays: number[];    // Days before to send reminders
  status: "scheduled" | "completed" | "missed" | "rescheduled" | "cancelled";
  completedDate?: string;
  notes?: string;
  relatedGoalIds: string[];  // Goals this follow-up supports
}

// Risk Assessment Summary for Care Plan
export interface CarePlanRiskAssessment {
  overallRiskScore: number;  // 0-100
  riskLevel: RiskPriorityLevel;
  conditions: {
    id: string;
    name: string;
    severity: "mild" | "moderate" | "severe";
    wellControlled: boolean;
  }[];
  aiIdentifiedRisks: {
    id: string;
    risk: string;
    probability: number;
    impact: "low" | "medium" | "high" | "critical";
    mitigationStrategy: string;
  }[];
  socialDeterminants: {
    factor: string;
    impact: "positive" | "neutral" | "negative";
    details: string;
    interventionNeeded: boolean;
  }[];
  barriers: {
    barrier: string;
    severity: "low" | "medium" | "high";
    suggestedApproach: string;
  }[];
}

// AI-Generated Care Plan
export interface AICarePlan {
  id: string;
  patientId: string;
  patientName: string;
  status: CarePlanStatus;
  version: number;
  
  // Risk Assessment
  riskAssessment: CarePlanRiskAssessment;
  
  // AI Generation Metadata
  generatedAt: string;
  generatedBy: "ai" | "manual" | "hybrid";
  aiModelVersion: string;
  confidenceScore: number;   // 0-100 AI confidence in recommendations
  
  // Care Plan Components
  summary: string;           // Executive summary of the care plan
  primaryGoals: string[];    // High-level objectives
  smartGoals: SmartGoal[];
  interventions: AICarePlanIntervention[];
  educationMaterials: PatientEducationMaterial[];
  followUpSchedule: FollowUpScheduleItem[];
  
  // Care Team
  careTeam: {
    role: string;
    name: string;
    responsibilities: string[];
    contactInfo?: string;
  }[];
  
  // Review & Approval Workflow
  reviewHistory: {
    reviewerId: string;
    reviewerName: string;
    reviewerRole: string;
    action: "reviewed" | "approved" | "rejected" | "requested_changes";
    comments?: string;
    changesRequested?: string[];
    timestamp: string;
  }[];
  
  approvedBy?: string;
  approvedAt?: string;
  activatedAt?: string;
  completedAt?: string;
  
  // Patient Engagement
  patientAccepted?: boolean;
  patientAcceptedAt?: string;
  patientFeedback?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

// Intervention Library Item (pre-built interventions)
export interface InterventionLibraryItem {
  id: string;
  category: InterventionCategory;
  title: string;
  description: string;
  applicableConditions: string[];
  evidenceLevel: "strong" | "moderate" | "limited" | "expert_opinion";
  sourceGuideline?: string;
  defaultPriority: AIInterventionPriority;
  defaultDuration?: string;
  requiredResources?: string[];
  contraindications?: string[];
  isActive: boolean;
  usageCount: number;
  successRate?: number;
  createdAt: string;
  updatedAt: string;
}

// Care Plan Generation Request
export interface CarePlanGenerationRequest {
  patientId: string;
  includeConditions?: string[];
  focusAreas?: GoalCategory[];
  timeframe?: "short_term" | "medium_term" | "long_term";
  complexityLevel?: "simple" | "moderate" | "comprehensive";
  patientPreferences?: string;
  caregiverInvolvement?: boolean;
  socialDeterminants?: Record<string, string>;
}

// Care Plan Edit Request
export interface CarePlanEditRequest {
  carePlanId: string;
  editedBy: string;
  editedByRole: string;
  changes: {
    field: string;
    previousValue: any;
    newValue: any;
    reason?: string;
  }[];
  editedAt: string;
}

// Care Plan Approval Request
export interface CarePlanApprovalRequest {
  carePlanId: string;
  action: "approve" | "reject" | "request_changes";
  reviewerId: string;
  reviewerName: string;
  reviewerRole: string;
  comments?: string;
  changesRequested?: string[];
}

// Zod Schemas
export const smartGoalSchema = z.object({
  id: z.string(),
  category: z.enum(goalCategories),
  specific: z.string().min(1),
  measurable: z.string().min(1),
  achievable: z.string().min(1),
  relevant: z.string().min(1),
  timeBound: z.string().min(1),
  targetValue: z.string().optional(),
  currentValue: z.string().optional(),
  status: z.enum(smartGoalStatuses).default("not_started"),
  progress: z.number().min(0).max(100).default(0),
  milestones: z.array(z.object({
    id: z.string(),
    description: z.string(),
    targetDate: z.string(),
    completed: z.boolean().default(false),
    completedDate: z.string().optional(),
  })).default([]),
  notes: z.string().optional(),
});

export const carePlanInterventionSchema = z.object({
  id: z.string(),
  category: z.enum(interventionCategories),
  priority: z.enum(aiInterventionPriorities),
  title: z.string().min(1),
  description: z.string().min(1),
  rationale: z.string().min(1),
  isFromLibrary: z.boolean().default(false),
  libraryId: z.string().optional(),
  responsibleParty: z.string(),
  frequency: z.string().optional(),
  duration: z.string().optional(),
  resources: z.array(z.string()).optional(),
  contraindications: z.array(z.string()).optional(),
  status: z.enum(["pending", "active", "completed", "cancelled"]).default("pending"),
});

export const generateAICarePlanSchema = z.object({
  patientId: z.string(),
  focusAreas: z.array(z.enum(goalCategories)).optional(),
  timeframe: z.enum(["short_term", "medium_term", "long_term"]).optional(),
  complexityLevel: z.enum(["simple", "moderate", "comprehensive"]).optional(),
  patientPreferences: z.string().optional(),
  caregiverInvolvement: z.boolean().optional(),
});
export type GenerateAICarePlanInput = z.infer<typeof generateAICarePlanSchema>;

export const carePlanApprovalSchema = z.object({
  action: z.enum(["approve", "reject", "request_changes"]),
  comments: z.string().optional(),
  changesRequested: z.array(z.string()).optional(),
});
export type CarePlanApprovalInput = z.infer<typeof carePlanApprovalSchema>;

export const updateSmartGoalSchema = z.object({
  status: z.enum(smartGoalStatuses).optional(),
  progress: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});
export type UpdateSmartGoal = z.infer<typeof updateSmartGoalSchema>;

export const updateInterventionSchema = z.object({
  status: z.enum(["pending", "active", "completed", "cancelled"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  outcomes: z.string().optional(),
});
export type UpdateIntervention = z.infer<typeof updateInterventionSchema>;

// ============================================
// PATIENT EDUCATION MESSAGING SYSTEM
// ============================================

// Message delivery channels
export const messageChannels = ["in_app", "sms", "email", "push"] as const;
export type MessageChannel = typeof messageChannels[number];

// Message types
export const messageTypes = ["education", "reminder", "follow_up", "motivation", "alert", "check_in"] as const;
export type MessageType = typeof messageTypes[number];

// Message status
export const messageStatuses = ["scheduled", "pending", "sent", "delivered", "failed", "cancelled"] as const;
export type MessageStatus = typeof messageStatuses[number];

// Interaction types
export const interactionTypes = ["delivered", "opened", "clicked", "completed", "dismissed", "replied"] as const;
export type InteractionType = typeof interactionTypes[number];

// Message template for AI-generated content
export interface MessageTemplate {
  id: string;
  name: string;
  type: MessageType;
  category: GoalCategory;
  subject: string;
  bodyTemplate: string;
  variables: string[];
  channels: MessageChannel[];
  isAIGenerated: boolean;
  conditionTriggers: string[];
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

// Scheduled message configuration
export interface MessageSchedule {
  id: string;
  carePlanId: string;
  patientId: string;
  templateId?: string;
  type: MessageType;
  title: string;
  frequency: "once" | "daily" | "weekly" | "biweekly" | "monthly" | "custom";
  customCronExpression?: string;
  startDate: string;
  endDate?: string;
  nextScheduledDate: string;
  lastSentDate?: string;
  channels: MessageChannel[];
  isActive: boolean;
  triggerConditions?: {
    goalProgress?: { goalId: string; threshold: number; operator: "above" | "below" };
    interventionStatus?: { interventionId: string; status: string };
    daysWithoutInteraction?: number;
  };
  createdAt: string;
  updatedAt: string;
}

// Individual patient message
export interface PatientMessage {
  id: string;
  scheduleId?: string;
  carePlanId?: string;
  patientId: string;
  type: MessageType;
  channel: MessageChannel;
  subject: string;
  body: string;
  personalizedContent: {
    patientName: string;
    relevantGoals?: string[];
    progressUpdate?: string;
    educationTips?: string[];
    actionItems?: string[];
    encouragement?: string;
  };
  status: MessageStatus;
  scheduledAt: string;
  sentAt?: string;
  deliveredAt?: string;
  externalMessageId?: string;
  failureReason?: string;
  retryCount: number;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// Patient interaction with a message
export interface MessageInteraction {
  id: string;
  messageId: string;
  patientId: string;
  interactionType: InteractionType;
  timestamp: string;
  deviceInfo?: string;
  ipAddress?: string;
  clickedLinks?: string[];
  completionData?: {
    questionAnswers?: Record<string, string>;
    feedbackRating?: number;
    feedbackText?: string;
  };
  metadata: Record<string, string>;
}

// Patient engagement summary
export interface PatientEngagementSummary {
  patientId: string;
  carePlanId: string;
  period: "daily" | "weekly" | "monthly";
  periodStart: string;
  periodEnd: string;
  messagesSent: number;
  messagesDelivered: number;
  messagesOpened: number;
  messagesClicked: number;
  messagesCompleted: number;
  openRate: number;
  clickRate: number;
  completionRate: number;
  avgResponseTime?: number;
  topEngagedTopics: string[];
  lowEngagementTopics: string[];
  recommendedActions: string[];
}

// AI-generated education content request
export interface GenerateEducationContentInput {
  patientId: string;
  carePlanId: string;
  contentType: MessageType;
  focusAreas?: GoalCategory[];
  currentProgress?: Record<string, number>;
  recentInteractions?: string[];
  preferredReadingLevel?: "basic" | "intermediate" | "advanced";
  languagePreference?: string;
}

// AI-generated education content response
export interface GeneratedEducationContent {
  subject: string;
  body: string;
  educationTips: string[];
  actionItems: string[];
  encouragement: string;
  suggestedFollowUp: {
    type: MessageType;
    scheduledFor: string;
    topic: string;
  };
  relevanceScore: number;
  safetyDisclaimer: string;
}

// Message delivery result
export interface MessageDeliveryResult {
  messageId: string;
  channel: MessageChannel;
  success: boolean;
  deliveredAt?: string;
  externalMessageId?: string;
  failureReason?: string;
  retryable: boolean;
}

// Zod schemas for validation
export const messageScheduleSchema = z.object({
  carePlanId: z.string(),
  patientId: z.string(),
  templateId: z.string().optional(),
  type: z.enum(messageTypes),
  title: z.string().min(1),
  frequency: z.enum(["once", "daily", "weekly", "biweekly", "monthly", "custom"]),
  customCronExpression: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  channels: z.array(z.enum(messageChannels)).min(1),
  triggerConditions: z.object({
    goalProgress: z.object({
      goalId: z.string(),
      threshold: z.number(),
      operator: z.enum(["above", "below"]),
    }).optional(),
    interventionStatus: z.object({
      interventionId: z.string(),
      status: z.string(),
    }).optional(),
    daysWithoutInteraction: z.number().optional(),
  }).optional(),
});
export type CreateMessageScheduleInput = z.infer<typeof messageScheduleSchema>;

export const generateEducationContentSchema = z.object({
  patientId: z.string(),
  carePlanId: z.string(),
  contentType: z.enum(messageTypes),
  focusAreas: z.array(z.enum(goalCategories)).optional(),
  currentProgress: z.record(z.number()).optional(),
  recentInteractions: z.array(z.string()).optional(),
  preferredReadingLevel: z.enum(["basic", "intermediate", "advanced"]).optional(),
  languagePreference: z.string().optional(),
});

export const recordInteractionSchema = z.object({
  messageId: z.string(),
  interactionType: z.enum(interactionTypes),
  clickedLinks: z.array(z.string()).optional(),
  completionData: z.object({
    questionAnswers: z.record(z.string()).optional(),
    feedbackRating: z.number().min(1).max(5).optional(),
    feedbackText: z.string().optional(),
  }).optional(),
  deviceInfo: z.string().optional(),
});
export type RecordInteractionInput = z.infer<typeof recordInteractionSchema>;

export const sendMessageSchema = z.object({
  patientId: z.string(),
  type: z.enum(messageTypes),
  channel: z.enum(messageChannels),
  subject: z.string().min(1),
  body: z.string().min(1),
  carePlanId: z.string().optional(),
  scheduledAt: z.string().optional(),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// ============================================
// PATIENT EDUCATION LIBRARY (WITH APPROVAL WORKFLOW)
// ============================================

export const libraryContentTypes = ["article", "faq", "video", "infographic", "checklist"] as const;
export type LibraryContentType = typeof libraryContentTypes[number];

export const contentApprovalStatuses = ["draft", "pending_review", "approved", "rejected", "archived"] as const;
export type ContentApprovalStatus = typeof contentApprovalStatuses[number];

export const libraryReadingLevels = ["basic", "intermediate", "advanced"] as const;
export type LibraryReadingLevel = typeof libraryReadingLevels[number];

export interface LibraryEducationContent {
  id: string;
  type: LibraryContentType;
  category: EducationCategory;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  relatedConditions: string[];
  readingLevel: LibraryReadingLevel;
  estimatedReadTime: number;
  mediaUrl?: string;
  thumbnailUrl?: string;
  status: ContentApprovalStatus;
  aiGenerated: boolean;
  generatedBy?: string;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  safetyDisclaimer: string;
}

export interface LibraryEducationFAQ {
  id: string;
  category: EducationCategory;
  question: string;
  answer: string;
  relatedConditions: string[];
  tags: string[];
  readingLevel: LibraryReadingLevel;
  status: ContentApprovalStatus;
  aiGenerated: boolean;
  generatedBy?: string;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
}

export interface LibraryContentGenerationRequest {
  type: LibraryContentType;
  category: EducationCategory;
  topic: string;
  targetConditions?: string[];
  readingLevel: LibraryReadingLevel;
  keywords?: string[];
  languagePreference?: string;
  additionalContext?: string;
}

export interface GeneratedLibraryArticle {
  title: string;
  summary: string;
  content: string;
  keyPoints: string[];
  actionItems: string[];
  relatedTopics: string[];
  estimatedReadTime: number;
  safetyDisclaimer: string;
}

export interface GeneratedLibraryFAQSet {
  faqs: Array<{
    question: string;
    answer: string;
    tags: string[];
  }>;
  safetyDisclaimer: string;
}

export interface ContentApprovalAction {
  contentId: string;
  action: "approve" | "reject" | "request_changes";
  reviewerNotes?: string;
  rejectionReason?: string;
  suggestedChanges?: string;
}

export interface LibraryCurationStats {
  totalContent: number;
  byType: Record<LibraryContentType, number>;
  byCategory: Record<EducationCategory, number>;
  byStatus: Record<ContentApprovalStatus, number>;
  pendingReview: number;
  aiGenerated: number;
  manuallyCreated: number;
  mostViewed: Array<{ id: string; title: string; viewCount: number }>;
  mostHelpful: Array<{ id: string; title: string; helpfulCount: number }>;
}

export const libraryContentGenerationRequestSchema = z.object({
  type: z.enum(libraryContentTypes),
  category: z.enum(educationCategories),
  topic: z.string().min(3),
  targetConditions: z.array(z.string()).optional(),
  readingLevel: z.enum(libraryReadingLevels),
  keywords: z.array(z.string()).optional(),
  languagePreference: z.string().optional(),
  additionalContext: z.string().optional(),
});

export const contentApprovalActionSchema = z.object({
  contentId: z.string(),
  action: z.enum(["approve", "reject", "request_changes"]),
  reviewerNotes: z.string().optional(),
  rejectionReason: z.string().optional(),
  suggestedChanges: z.string().optional(),
});

export const libraryContentFilterSchema = z.object({
  type: z.enum(libraryContentTypes).optional(),
  category: z.enum(educationCategories).optional(),
  status: z.enum(contentApprovalStatuses).optional(),
  readingLevel: z.enum(libraryReadingLevels).optional(),
  aiGenerated: z.boolean().optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

// ============================================
// FHIR ADVANCED SEARCH
// ============================================
// Note: Uses FhirResourceType from DATA ACCESS POLICY SYSTEM section (line ~382)

export const codeSystemTypes = ["SNOMED_CT", "LOINC", "ICD10_CM", "RXNORM", "CPT", "NDC", "CVX"] as const;
export type CodeSystemType = typeof codeSystemTypes[number];

export const fhirSearchOperators = ["eq", "ne", "gt", "lt", "ge", "le", "contains", "exact", "starts-with"] as const;
export type FHIRSearchOperator = typeof fhirSearchOperators[number];

export const searchableResourceTypes = [
  "Patient",
  "Condition",
  "Medication",
  "MedicationRequest",
  "Observation",
  "AllergyIntolerance",
  "Procedure",
  "Immunization",
  "DiagnosticReport",
  "DocumentReference",
  "Encounter",
] as const;
export type SearchableResourceType = typeof searchableResourceTypes[number];

export interface FHIRSearchParameter {
  field: string;
  operator: FHIRSearchOperator;
  value: string;
  codeSystem?: CodeSystemType;
}

export interface FHIRSearchQuery {
  resourceTypes: SearchableResourceType[];
  parameters: FHIRSearchParameter[];
  codeSearch?: {
    code: string;
    system: CodeSystemType;
    includeDescendants?: boolean;
  };
  textSearch?: string;
  dateRange?: {
    field: string;
    start?: string;
    end?: string;
  };
  patientId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page: number;
  pageSize: number;
}

export interface FHIRSearchResult {
  id: string;
  resourceType: SearchableResourceType;
  patientId: string;
  displayName: string;
  code?: {
    value: string;
    system: CodeSystemType;
    display: string;
  };
  date?: string;
  status?: string;
  source?: string;
  rawResource: Record<string, unknown>;
}

export interface FHIRSearchResponse {
  results: FHIRSearchResult[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  searchId: string;
  executionTimeMs: number;
}

export interface FHIRSearchAuditEntry {
  id: string;
  userId: string;
  searchQuery: FHIRSearchQuery;
  resultCount: number;
  executionTimeMs: number;
  patientIdsAccessed: string[];
  timestamp: string;
  ipAddress: string;
  userAgent: string;
}

export const fhirSearchQuerySchema = z.object({
  resourceTypes: z.array(z.enum(searchableResourceTypes)).min(1),
  parameters: z.array(z.object({
    field: z.string(),
    operator: z.enum(fhirSearchOperators),
    value: z.string(),
    codeSystem: z.enum(codeSystemTypes).optional(),
  })).optional().default([]),
  codeSearch: z.object({
    code: z.string(),
    system: z.enum(codeSystemTypes),
    includeDescendants: z.boolean().optional(),
  }).optional(),
  textSearch: z.string().optional(),
  dateRange: z.object({
    field: z.string(),
    start: z.string().optional(),
    end: z.string().optional(),
  }).optional(),
  patientId: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.number().min(1).optional().default(1),
  pageSize: z.number().min(1).max(100).optional().default(20),
});

export type FHIRSearchQueryInput = z.infer<typeof fhirSearchQuerySchema>;

// ============================================
// PATIENT ONBOARDING WORKFLOW (Enhanced)
// ============================================

export const patientOnboardingStepTypes = [
  "welcome",
  "identity_verification",
  "demographics",
  "insurance",
  "medical_history",
  "ehr_connection",
  "consent",
  "emergency_contact",
  "care_preferences",
  "complete",
] as const;
export type PatientOnboardingStepType = typeof patientOnboardingStepTypes[number];

export const patientOnboardingStatuses = ["not_started", "in_progress", "completed", "skipped", "error"] as const;
export type PatientOnboardingStatus = typeof patientOnboardingStatuses[number];

export interface PatientOnboardingWelcomeMessage {
  id: string;
  patientId: string;
  type: "welcome" | "reminder" | "completion";
  channel: "in_app" | "email" | "sms";
  subject: string;
  body: string;
  sentAt: string;
  deliveredAt?: string;
  readAt?: string;
}

export interface PatientOnboardingStep {
  id: string;
  workflowId: string;
  stepType: PatientOnboardingStepType;
  stepOrder: number;
  status: PatientOnboardingStatus;
  title: string;
  description: string;
  isRequired: boolean;
  collectedData?: Record<string, unknown>;
  validationErrors?: string[];
  startedAt?: string;
  completedAt?: string;
  skipReason?: string;
}

export interface PatientOnboardingWorkflow {
  id: string;
  patientId: string;
  currentStepOrder: number;
  overallStatus: PatientOnboardingStatus;
  steps: PatientOnboardingStep[];
  welcomeMessagesSent: string[];
  careTeamTasksCreated: string[];
  startedAt: string;
  completedAt?: string;
  lastUpdatedAt: string;
  assignedCareTeamMember?: string;
  notes?: string;
}

export interface PatientOnboardingDataCollectionForm {
  stepType: PatientOnboardingStepType;
  fields: Array<{
    name: string;
    label: string;
    type: "text" | "date" | "select" | "checkbox" | "phone" | "email" | "address";
    required: boolean;
    fhirMapping?: string;
    options?: string[];
    validation?: string;
  }>;
}

export interface PatientOnboardingCareTeamAssignment {
  workflowId: string;
  patientId: string;
  taskType: "review_demographics" | "verify_insurance" | "review_medical_history" | "initial_assessment" | "schedule_visit" | "follow_up";
  assignedTo: string;
  assignedBy: string;
  priority: "urgent" | "high" | "normal" | "low";
  dueDate: string;
  notes?: string;
}

export interface PatientOnboardingMetrics {
  totalWorkflows: number;
  completedWorkflows: number;
  inProgressWorkflows: number;
  abandonedWorkflows: number;
  averageCompletionTimeHours: number;
  stepCompletionRates: Record<PatientOnboardingStepType, number>;
  taskAssignmentCounts: Record<string, number>;
}

export interface PatientOnboardingAuditEntry {
  id: string;
  workflowId: string;
  patientId: string;
  action: "workflow_started" | "step_started" | "step_completed" | "step_skipped" | "data_collected" | "task_assigned" | "message_sent" | "workflow_completed";
  stepType?: PatientOnboardingStepType;
  actorId: string;
  actorRole: string;
  metadata: Record<string, unknown>;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
}

export const startPatientOnboardingSchema = z.object({
  patientId: z.string(),
  assignedCareTeamMember: z.string().optional(),
  sendWelcomeMessage: z.boolean().optional().default(true),
  notes: z.string().optional(),
});

export type StartPatientOnboardingInput = z.infer<typeof startPatientOnboardingSchema>;

export const submitPatientOnboardingStepSchema = z.object({
  workflowId: z.string(),
  stepType: z.enum(patientOnboardingStepTypes),
  data: z.record(z.unknown()),
  skip: z.boolean().optional().default(false),
  skipReason: z.string().optional(),
});

export type SubmitPatientOnboardingStepInput = z.infer<typeof submitPatientOnboardingStepSchema>;

export const assignPatientOnboardingTaskSchema = z.object({
  workflowId: z.string(),
  taskType: z.enum(["review_demographics", "verify_insurance", "review_medical_history", "initial_assessment", "schedule_visit", "follow_up"]),
  assignedTo: z.string(),
  priority: z.enum(["urgent", "high", "normal", "low"]).optional().default("normal"),
  dueDate: z.string(),
  notes: z.string().optional(),
});

export type AssignPatientOnboardingTaskInput = z.infer<typeof assignPatientOnboardingTaskSchema>;

// =====================================================
// Automated Alerting System Types
// =====================================================

export type AlertType = 
  | "sync_failure_rate"
  | "data_quality_increase"
  | "validation_failure"
  | "security_anomaly"
  | "system_health";

export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";

export type NotificationChannel = "in_app" | "email" | "webhook";

export type AlertStatus = "active" | "acknowledged" | "resolved" | "suppressed";

export interface AlertThreshold {
  metricName: string;
  operator: ">" | ">=" | "<" | "<=" | "==" | "!=";
  value: number;
  timeWindowMinutes: number;
}

export interface AlertConfiguration {
  id: string;
  name: string;
  description: string;
  alertType: AlertType;
  enabled: boolean;
  severity: AlertSeverity;
  thresholds: AlertThreshold[];
  notificationChannels: NotificationChannel[];
  emailRecipients?: string[];
  webhookUrl?: string;
  cooldownMinutes: number;
  filters?: {
    connectionIds?: string[];
    resourceTypes?: string[];
    patientIds?: string[];
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  configurationId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  details: Record<string, unknown>;
  triggeredAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  notificationsSent: Array<{
    channel: NotificationChannel;
    sentAt: string;
    success: boolean;
    error?: string;
  }>;
}

export interface InAppNotification {
  id: string;
  userId: string;
  alertId?: string;
  type: "alert" | "info" | "warning" | "success";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  readAt?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface AlertMetrics {
  totalAlerts: number;
  alertsByType: Record<AlertType, number>;
  alertsBySeverity: Record<AlertSeverity, number>;
  alertsByStatus: Record<AlertStatus, number>;
  averageResolutionTimeMinutes: number;
  alertsTriggeredLast24h: number;
  alertsResolvedLast24h: number;
}

export const createAlertConfigurationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  alertType: z.enum(["sync_failure_rate", "data_quality_increase", "validation_failure", "security_anomaly", "system_health"]),
  enabled: z.boolean().default(true),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  thresholds: z.array(z.object({
    metricName: z.string(),
    operator: z.enum([">", ">=", "<", "<=", "==", "!="]),
    value: z.number(),
    timeWindowMinutes: z.number().min(1).max(1440),
  })).min(1),
  notificationChannels: z.array(z.enum(["in_app", "email", "webhook"])).min(1),
  emailRecipients: z.array(z.string().email()).optional(),
  webhookUrl: z.string().url().optional(),
  cooldownMinutes: z.number().min(1).max(1440).default(15),
  filters: z.object({
    connectionIds: z.array(z.string()).optional(),
    resourceTypes: z.array(z.string()).optional(),
    patientIds: z.array(z.string()).optional(),
  }).optional(),
});

export type CreateAlertConfigurationInput = z.infer<typeof createAlertConfigurationSchema>;

// ============================================
// AI-POWERED COMPLIANCE MONITORING ENGINE
// ============================================

export type ComplianceRegulation = "HIPAA" | "GDPR" | "HITECH" | "SOC2" | "CCPA";

export type ComplianceRiskLevel = "critical" | "high" | "medium" | "low" | "info";

export type ComplianceRiskCategory = 
  | "access_anomaly"           // Unusual access patterns
  | "policy_violation"         // Direct policy breach
  | "consent_violation"        // Missing/expired consent
  | "data_retention"           // Retention policy issues
  | "unauthorized_access"      // Access without authorization
  | "data_export"              // Excessive/suspicious exports
  | "audit_gap"                // Missing audit trails
  | "encryption_weakness"      // Encryption issues
  | "access_control"           // RBAC/permission issues
  | "data_breach_indicator"    // Potential breach patterns
  | "training_gap"             // Compliance training issues
  | "documentation_gap";       // Missing documentation

export type ComplianceRiskStatus = 
  | "open"
  | "acknowledged"
  | "investigating"
  | "remediated"
  | "accepted"
  | "false_positive";

export interface ComplianceRisk {
  id: string;
  category: ComplianceRiskCategory;
  level: ComplianceRiskLevel;
  regulations: ComplianceRegulation[];
  title: string;
  description: string;
  evidence: {
    type: string;
    count: number;
    sampleDetails?: string;
    timeRange?: { start: string; end: string };
  }[];
  affectedSystems: string[];
  detectedAt: string;
  status: ComplianceRiskStatus;
  remediationSuggestions: string[];
  aiAnalysis?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  remediatedAt?: string;
  remediationNotes?: string;
}

export interface ComplianceMetric {
  name: string;
  value: number;
  threshold?: number;
  trend?: "improving" | "stable" | "degrading";
  lastUpdated: string;
}

export interface ComplianceReport {
  id: string;
  type: "daily" | "weekly" | "monthly" | "on_demand" | "incident";
  regulations: ComplianceRegulation[];
  period: { start: string; end: string };
  generatedAt: string;
  generatedBy: string;
  summary: {
    overallScore: number;
    riskCounts: Record<ComplianceRiskLevel, number>;
    totalFindings: number;
    resolvedFindings: number;
    newFindings: number;
    comparedToPrevious?: {
      scoreChange: number;
      findingChange: number;
    };
  };
  risksByCategory: Record<ComplianceRiskCategory, number>;
  risksByRegulation: Record<ComplianceRegulation, number>;
  topRisks: ComplianceRisk[];
  metrics: ComplianceMetric[];
  aiInsights: string;
  recommendations: string[];
  auditTrail: {
    action: string;
    timestamp: string;
    userId?: string;
  }[];
}

export interface ComplianceRuleConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  regulation: ComplianceRegulation;
  category: ComplianceRiskCategory;
  severity: ComplianceRiskLevel;
  conditions: {
    metric: string;
    operator: ">" | ">=" | "<" | "<=" | "==" | "!=";
    threshold: number;
    timeWindowMinutes: number;
  }[];
  remediationSteps: string[];
  createdAt: string;
  updatedAt: string;
}

export const createComplianceRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
  enabled: z.boolean().default(true),
  regulation: z.enum(["HIPAA", "GDPR", "HITECH", "SOC2", "CCPA"]),
  category: z.enum([
    "access_anomaly", "policy_violation", "consent_violation", 
    "data_retention", "unauthorized_access", "data_export",
    "audit_gap", "encryption_weakness", "access_control",
    "data_breach_indicator", "training_gap", "documentation_gap"
  ]),
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  conditions: z.array(z.object({
    metric: z.string(),
    operator: z.enum([">", ">=", "<", "<=", "==", "!="]),
    threshold: z.number(),
    timeWindowMinutes: z.number().min(1).max(10080),
  })).min(1),
  remediationSteps: z.array(z.string()).default([]),
});

export type CreateComplianceRuleInput = z.infer<typeof createComplianceRuleSchema>;

// ============================================
// AI FHIR DATA HARMONIZATION ENGINE
// ============================================

export type HarmonizationStatus = "pending" | "analyzing" | "completed" | "failed";
export type DiscrepancyType = "semantic" | "structural" | "cardinality" | "terminology" | "format" | "missing";
export type DiscrepancySeverity = "critical" | "high" | "medium" | "low";
export type ResolutionStrategy = "consolidate" | "prefer_source" | "prefer_target" | "manual_review" | "ai_suggested";

export interface ExternalSystemMapping {
  id: string;
  systemId: string;
  systemName: string;
  systemType: "ehr" | "hie" | "lab" | "pharmacy" | "payer" | "registry";
  resourceType: string;
  fieldMappings: FieldMappingDefinition[];
  codeSystemMappings: CodeSystemMappingDefinition[];
  lastUpdated: string;
  version: string;
}

export interface FieldMappingDefinition {
  id: string;
  sourcePath: string;
  sourceType: string;
  targetPath: string;
  targetType: string;
  cardinality: "1..1" | "0..1" | "0..*" | "1..*";
  transform?: string;
  defaultValue?: unknown;
  required: boolean;
  description?: string;
}

export interface CodeSystemMappingDefinition {
  id: string;
  sourceCodeSystem: string;
  sourceCodeSystemUrl: string;
  targetCodeSystem: string;
  targetCodeSystemUrl: string;
  mappings: Array<{
    sourceCode: string;
    sourceDisplay: string;
    targetCode: string;
    targetDisplay: string;
    equivalence: "equivalent" | "equal" | "wider" | "narrower" | "inexact" | "unmatched";
  }>;
}

export interface SemanticDiscrepancy {
  id: string;
  type: DiscrepancyType;
  severity: DiscrepancySeverity;
  affectedSystems: string[];
  resourceType: string;
  fieldPath: string;
  description: string;
  sourceDetails: {
    systemId: string;
    systemName: string;
    definition: string;
    example?: unknown;
  }[];
  impact: string;
  detectedAt: string;
  status: "open" | "acknowledged" | "resolved" | "ignored";
  resolution?: {
    strategy: ResolutionStrategy;
    rule?: ConsolidatedMappingRule;
    resolvedBy?: string;
    resolvedAt?: string;
    notes?: string;
  };
}

export interface ConsolidatedMappingRule {
  id: string;
  name: string;
  description: string;
  resourceType: string;
  fieldPath: string;
  sourceSystemRules: Array<{
    systemId: string;
    sourcePath: string;
    transform?: string;
    priority: number;
  }>;
  targetDefinition: {
    path: string;
    type: string;
    format?: string;
    codeSystem?: string;
  };
  conflictResolution: "first_non_null" | "most_recent" | "highest_priority" | "merge_array" | "custom";
  validationRules: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  aiGenerated: boolean;
  aiConfidence?: number;
}

export interface HarmonizationAnalysis {
  id: string;
  status: HarmonizationStatus;
  analyzedSystems: string[];
  analyzedResourceTypes: string[];
  startedAt: string;
  completedAt?: string;
  summary: {
    totalMappingsAnalyzed: number;
    discrepanciesFound: number;
    discrepanciesBySeverity: Record<DiscrepancySeverity, number>;
    discrepanciesByType: Record<DiscrepancyType, number>;
    suggestedRules: number;
    harmonizationScore: number;
  };
  discrepancies: SemanticDiscrepancy[];
  suggestedRules: ConsolidatedMappingRule[];
  aiRecommendations: string[];
  interoperabilityReport: {
    overallScore: number;
    categoryScores: Record<string, number>;
    criticalGaps: string[];
    recommendations: string[];
  };
}

export interface HarmonizationConfig {
  autoDetectDiscrepancies: boolean;
  autoSuggestRules: boolean;
  discrepancyThreshold: DiscrepancySeverity;
  preferredCodeSystems: string[];
  preferredDateFormat: string;
  enableAIAnalysis: boolean;
  notifyOnCritical: boolean;
}

// =====================================================
// PREDICTIVE DATA QUALITY AI TYPES
// =====================================================

export const predictionTargetTypes = [
  "patient",
  "resource_type",
  "connection",
  "data_source",
] as const;
export type PredictionTargetType = typeof predictionTargetTypes[number];

export const predictionRiskLevels = ["critical", "high", "medium", "low", "minimal"] as const;
export type PredictionRiskLevel = typeof predictionRiskLevels[number];

export const predictionStatuses = ["active", "acknowledged", "mitigated", "expired", "false_positive"] as const;
export type PredictionStatus = typeof predictionStatuses[number];

export const predictiveTrendDirections = ["improving", "stable", "degrading", "volatile"] as const;
export type PredictiveTrendDirection = typeof predictiveTrendDirections[number];

export interface QualityDataPoint {
  timestamp: string;
  value: number;
  issueCount: number;
  severity: Record<string, number>;
  metadata?: Record<string, unknown>;
}

export interface QualityTrendAnalysis {
  targetId: string;
  targetType: PredictionTargetType;
  targetName: string;
  currentScore: number;
  historicalScores: QualityDataPoint[];
  trendDirection: PredictiveTrendDirection;
  trendSlope: number;
  volatility: number;
  seasonalPatterns: string[];
  anomalies: Array<{
    timestamp: string;
    type: string;
    magnitude: number;
    description: string;
  }>;
  analyzedPeriod: {
    start: string;
    end: string;
    dataPoints: number;
  };
}

export interface QualityPrediction {
  id: string;
  targetId: string;
  targetType: PredictionTargetType;
  targetName: string;
  predictedAt: string;
  predictionHorizon: string;
  predictedScore: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  confidence: number;
  riskLevel: PredictionRiskLevel;
  status: PredictionStatus;
  predictedIssues: Array<{
    issueType: string;
    probability: number;
    estimatedCount: number;
    potentialImpact: string;
  }>;
  contributingFactors: Array<{
    factor: string;
    weight: number;
    description: string;
    trend: PredictiveTrendDirection;
  }>;
  aiAnalysis: string;
  recommendations: string[];
  expiresAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  mitigatedAt?: string;
  mitigationNotes?: string;
}

export interface ProactiveAlert {
  id: string;
  predictionId: string;
  alertType: "quality_degradation" | "pattern_anomaly" | "threshold_breach" | "trend_reversal";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  message: string;
  targetId: string;
  targetType: PredictionTargetType;
  targetName: string;
  predictedRiskLevel: PredictionRiskLevel;
  predictedScore: number;
  currentScore: number;
  predictionHorizon: string;
  triggeredAt: string;
  expiresAt: string;
  status: "active" | "acknowledged" | "resolved" | "expired";
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  actionsTaken: string[];
  metadata: Record<string, unknown>;
}

export interface PredictiveModelConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  targetTypes: PredictionTargetType[];
  predictionHorizons: string[];
  riskThresholds: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  minDataPoints: number;
  retrainIntervalHours: number;
  alertOnRiskLevel: PredictionRiskLevel;
  notificationChannels: ("in_app" | "email" | "webhook")[];
  createdAt: string;
  updatedAt: string;
}

export interface PredictiveQualityDashboard {
  overallRiskScore: number;
  riskDistribution: Record<PredictionRiskLevel, number>;
  activePredictions: number;
  activeAlerts: number;
  predictionsByTarget: {
    patients: QualityPrediction[];
    resourceTypes: QualityPrediction[];
    connections: QualityPrediction[];
  };
  recentAlerts: ProactiveAlert[];
  trendSummary: Record<PredictiveTrendDirection, number>;
  topRiskTargets: Array<{
    targetId: string;
    targetType: PredictionTargetType;
    targetName: string;
    riskLevel: PredictionRiskLevel;
    predictedScore: number;
    daysUntilCritical?: number;
  }>;
  modelPerformance: {
    accuracy: number;
    precision: number;
    recall: number;
    lastTrainedAt: string;
    dataPointsUsed: number;
  };
}

// =============================================================================
// AI-Powered Automated Remediation Workflow Types
// =============================================================================

export type RemediationSourceType = "data_quality" | "compliance_monitoring" | "predictive_alert" | "manual";
export type RemediationRiskLevel = "critical" | "high" | "medium" | "low";
export type RemediationExecutionMode = "auto" | "guided" | "manual";
export type RemediationWorkflowStatus = "pending" | "in_progress" | "awaiting_approval" | "approved" | "executing" | "completed" | "failed" | "cancelled" | "rolled_back";
export type RemediationStepStatus = "pending" | "executing" | "completed" | "failed" | "skipped" | "rolled_back";

export interface RemediationTrigger {
  sourceType: RemediationSourceType;
  sourceId: string;
  issueType: string;
  severity: RemediationRiskLevel;
  title: string;
  description: string;
  affectedResource: {
    resourceType: string;
    resourceId: string;
    patientId?: string;
  };
  detectedAt: string;
  metadata: Record<string, unknown>;
}

export interface RemediationStep {
  id: string;
  order: number;
  name: string;
  description: string;
  actionType: "validate" | "transform" | "update" | "notify" | "audit" | "rollback";
  actionConfig: Record<string, unknown>;
  preconditions: string[];
  expectedOutcome: string;
  rollbackAction?: Record<string, unknown>;
  status: RemediationStepStatus;
  startedAt?: string;
  completedAt?: string;
  result?: {
    success: boolean;
    message: string;
    data?: unknown;
    error?: string;
  };
  retryCount: number;
  maxRetries: number;
}

export interface RemediationWorkflow {
  id: string;
  name: string;
  description: string;
  trigger: RemediationTrigger;
  executionMode: RemediationExecutionMode;
  riskLevel: RemediationRiskLevel;
  steps: RemediationStep[];
  status: RemediationWorkflowStatus;
  priority: number;
  aiAnalysis: string;
  aiConfidence: number;
  requiresApproval: boolean;
  approvalRequest?: {
    requestedAt: string;
    requestedBy: string;
    reason: string;
    approvedAt?: string;
    approvedBy?: string;
    rejectedAt?: string;
    rejectedBy?: string;
    rejectionReason?: string;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  completedBy?: string;
  rollbackAvailable: boolean;
  rollbackPerformedAt?: string;
  rollbackPerformedBy?: string;
  auditTrail: Array<{
    timestamp: string;
    action: string;
    actor: string;
    details: Record<string, unknown>;
  }>;
  metadata: Record<string, unknown>;
}

export interface RemediationTemplate {
  id: string;
  name: string;
  description: string;
  issueTypes: string[];
  sourceTypes: RemediationSourceType[];
  applicableRiskLevels: RemediationRiskLevel[];
  executionMode: RemediationExecutionMode;
  autoExecuteThreshold: number;
  stepTemplates: Array<Omit<RemediationStep, "id" | "status" | "startedAt" | "completedAt" | "result" | "retryCount">>;
  validationRules: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RemediationApprovalRequest {
  id: string;
  workflowId: string;
  workflowName: string;
  trigger: RemediationTrigger;
  proposedSteps: RemediationStep[];
  aiAnalysis: string;
  aiConfidence: number;
  riskAssessment: {
    overallRisk: RemediationRiskLevel;
    potentialImpact: string;
    affectedResources: number;
    reversible: boolean;
  };
  requestedAt: string;
  requestedBy: string;
  expiresAt: string;
  status: "pending" | "approved" | "rejected" | "expired";
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface RemediationMetrics {
  totalWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  pendingApprovals: number;
  autoRemediations: number;
  guidedRemediations: number;
  avgExecutionTimeMs: number;
  successRate: number;
  rollbackRate: number;
  bySourceType: Record<RemediationSourceType, number>;
  byRiskLevel: Record<RemediationRiskLevel, number>;
  recentActivity: Array<{
    workflowId: string;
    workflowName: string;
    status: RemediationWorkflowStatus;
    timestamp: string;
  }>;
}

export interface RemediationDashboard {
  metrics: RemediationMetrics;
  pendingApprovals: RemediationApprovalRequest[];
  activeWorkflows: RemediationWorkflow[];
  recentCompletions: RemediationWorkflow[];
  templateSummary: Array<{
    templateId: string;
    templateName: string;
    usageCount: number;
    successRate: number;
  }>;
}

// =============================================================================
// AI-Powered Data Observability Types
// =============================================================================

export type DataPipelineStatus = "healthy" | "warning" | "critical" | "unknown" | "inactive";
export type DataAnomalyType = "freshness" | "volume" | "schema" | "quality" | "latency" | "missing_data" | "duplicate_data";
export type DataAnomalySeverity = "critical" | "high" | "medium" | "low";
export type LineageNodeType = "source" | "transform" | "destination" | "external" | "api" | "database" | "file";

export interface DataPipeline {
  id: string;
  name: string;
  description: string;
  sourceType: string;
  destinationType: string;
  status: DataPipelineStatus;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  avgLatencyMs: number;
  recordsProcessed24h: number;
  errorRate24h: number;
  freshnessThresholdMinutes: number;
  volumeThreshold: { min: number; max: number };
  isActive: boolean;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DataLineageNode {
  id: string;
  name: string;
  type: LineageNodeType;
  description: string;
  systemName: string;
  schemaInfo?: {
    fields: Array<{ name: string; type: string; nullable: boolean }>;
    primaryKey?: string[];
  };
  metadata: Record<string, unknown>;
}

export interface DataLineageEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  transformationType: string;
  transformationLogic?: string;
  dataFields: string[];
  isActive: boolean;
  lastDataFlowAt?: string;
  metadata: Record<string, unknown>;
}

export interface DataLineageGraph {
  nodes: DataLineageNode[];
  edges: DataLineageEdge[];
  lastUpdatedAt: string;
}

export interface DataAnomaly {
  id: string;
  pipelineId: string;
  pipelineName: string;
  type: DataAnomalyType;
  severity: DataAnomalySeverity;
  title: string;
  description: string;
  detectedAt: string;
  expectedValue?: unknown;
  actualValue?: unknown;
  deviationPercent?: number;
  affectedRecords?: number;
  affectedFields?: string[];
  rootCauseAnalysis?: RootCauseAnalysis;
  status: "open" | "acknowledged" | "investigating" | "resolved" | "dismissed";
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  alertSent: boolean;
  alertSentAt?: string;
  metadata: Record<string, unknown>;
}

export interface RootCauseAnalysis {
  id: string;
  anomalyId: string;
  analysisTimestamp: string;
  aiConfidence: number;
  primaryCause: string;
  contributingFactors: string[];
  affectedComponents: string[];
  impactAssessment: string;
  recommendedActions: string[];
  historicalPatterns?: Array<{
    timestamp: string;
    similarityScore: number;
    resolution?: string;
  }>;
  correlatedAnomalies: string[];
}

export interface FreshnessMetric {
  pipelineId: string;
  pipelineName: string;
  lastDataReceivedAt: string;
  expectedIntervalMinutes: number;
  actualIntervalMinutes: number;
  freshnessStatus: "fresh" | "stale" | "critical";
  staleSinceMinutes?: number;
}

export interface VolumeMetric {
  pipelineId: string;
  pipelineName: string;
  timestamp: string;
  recordCount: number;
  expectedMin: number;
  expectedMax: number;
  deviationPercent: number;
  volumeStatus: "normal" | "low" | "high" | "zero";
}

export interface DataObservabilityAlert {
  id: string;
  anomalyId: string;
  pipelineId: string;
  alertType: DataAnomalyType;
  severity: DataAnomalySeverity;
  title: string;
  message: string;
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  channels: ("in_app" | "email" | "webhook")[];
  deliveryStatus: Record<string, "pending" | "sent" | "failed">;
  metadata: Record<string, unknown>;
}

export interface DataObservabilityMetrics {
  totalPipelines: number;
  healthyPipelines: number;
  warningPipelines: number;
  criticalPipelines: number;
  totalAnomalies24h: number;
  openAnomalies: number;
  resolvedAnomalies24h: number;
  avgTimeToDetectionMinutes: number;
  avgTimeToResolutionMinutes: number;
  anomaliesBySeverity: Record<DataAnomalySeverity, number>;
  anomaliesByType: Record<DataAnomalyType, number>;
  pipelineHealthTrend: Array<{ timestamp: string; healthy: number; warning: number; critical: number }>;
}

export interface DataObservabilityDashboard {
  metrics: DataObservabilityMetrics;
  pipelineStatuses: Array<{
    pipeline: DataPipeline;
    freshnessMetric: FreshnessMetric;
    volumeMetric: VolumeMetric;
  }>;
  recentAnomalies: DataAnomaly[];
  activeAlerts: DataObservabilityAlert[];
  lineageSummary: {
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<LineageNodeType, number>;
  };
}

// ============================================
// AI-POWERED FHIR DEEP ANALYSIS ENGINE TYPES
// ============================================

export type FHIRInconsistencyType = 
  | "missing_required_field"
  | "invalid_reference"
  | "orphaned_resource"
  | "duplicate_identifier"
  | "conflicting_data"
  | "temporal_inconsistency"
  | "coding_mismatch"
  | "cardinality_violation"
  | "narrative_data_mismatch"
  | "invalid_value_set";

export type FHIRInconsistencySeverity = "critical" | "high" | "medium" | "low";

export type DataSafetyRiskType =
  | "missing_allergy_info"
  | "incomplete_medication_list"
  | "outdated_immunization"
  | "missing_emergency_contact"
  | "incomplete_problem_list"
  | "missing_vital_signs"
  | "stale_care_plan"
  | "conflicting_medications"
  | "missing_patient_identifier";

export interface FHIRInconsistency {
  id: string;
  resourceType: string;
  resourceId: string;
  inconsistencyType: FHIRInconsistencyType;
  severity: FHIRInconsistencySeverity;
  field: string;
  description: string;
  expectedValue?: string;
  actualValue?: string;
  relatedResources: string[];
  detectedAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}

export interface DataSafetyRisk {
  id: string;
  patientId: string;
  riskType: DataSafetyRiskType;
  severity: FHIRInconsistencySeverity;
  description: string;
  affectedResources: string[];
  detectedAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  mitigationSteps: string[];
  metadata: Record<string, unknown>;
}

export interface FHIRCorrectionStrategy {
  id: string;
  inconsistencyId: string;
  strategyType: "auto_fix" | "manual_review" | "data_enrichment" | "source_reconciliation";
  description: string;
  confidence: number;
  suggestedChanges: Array<{
    field: string;
    currentValue: string | null;
    suggestedValue: string;
    rationale: string;
  }>;
  requiredApprovals: string[];
  estimatedEffort: "low" | "medium" | "high";
  createdAt: string;
  appliedAt?: string;
  appliedBy?: string;
}

export interface FHIRQualityTrendReport {
  id: string;
  reportPeriod: { start: string; end: string };
  generatedAt: string;
  overallQualityScore: number;
  scoreChange: number;
  totalResourcesAnalyzed: number;
  inconsistenciesByType: Record<FHIRInconsistencyType, number>;
  inconsistenciesBySeverity: Record<FHIRInconsistencySeverity, number>;
  trendData: Array<{
    date: string;
    qualityScore: number;
    inconsistencyCount: number;
    resolvedCount: number;
  }>;
  topIssues: Array<{
    issueType: FHIRInconsistencyType;
    count: number;
    trend: "increasing" | "decreasing" | "stable";
  }>;
  recommendations: string[];
  metadata: Record<string, unknown>;
}

export interface FHIRDeepAnalysisResult {
  analysisId: string;
  resourceType: string;
  resourceId: string;
  analyzedAt: string;
  inconsistencies: FHIRInconsistency[];
  safetyRisks: DataSafetyRisk[];
  correctionStrategies: FHIRCorrectionStrategy[];
  qualityScore: number;
  completenessScore: number;
  consistencyScore: number;
  aiInsights: string[];
  metadata: Record<string, unknown>;
}

// ============================================
// AI-POWERED DATA GOVERNANCE MODULE TYPES
// ============================================

export type DataPolicyType =
  | "access_control"
  | "retention"
  | "encryption"
  | "consent"
  | "audit"
  | "data_classification"
  | "cross_border_transfer"
  | "anonymization"
  | "breach_notification";

export type PolicyComplianceStatus = "compliant" | "non_compliant" | "partial" | "unknown" | "pending_review";

export type ViolationSeverity = "critical" | "high" | "medium" | "low";

export interface DataPolicy {
  id: string;
  name: string;
  description: string;
  policyType: DataPolicyType;
  regulation: string;
  version: string;
  effectiveDate: string;
  expirationDate?: string;
  rules: DataPolicyRule[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  metadata: Record<string, unknown>;
}

export interface DataPolicyRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: "allow" | "deny" | "require_approval" | "log" | "encrypt" | "anonymize";
  priority: number;
  isEnabled: boolean;
  exceptions: string[];
}

export interface GovernancePolicyViolation {
  id: string;
  policyId: string;
  policyName: string;
  ruleId: string;
  violationType: DataPolicyType;
  severity: ViolationSeverity;
  description: string;
  affectedResource: string;
  affectedUser?: string;
  detectedAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  remediationStatus: "pending" | "in_progress" | "resolved" | "waived";
  metadata: Record<string, unknown>;
}

export interface DataAccessReview {
  id: string;
  reviewPeriod: { start: string; end: string };
  userId: string;
  userRole: string;
  accessedResources: Array<{
    resourceType: string;
    resourceId: string;
    accessType: "read" | "write" | "delete" | "export";
    accessCount: number;
    lastAccessedAt: string;
  }>;
  policyCompliance: PolicyComplianceStatus;
  violations: GovernancePolicyViolation[];
  riskScore: number;
  reviewStatus: "pending" | "approved" | "revoked" | "modified";
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  recommendations: string[];
  createdAt: string;
}

export interface PolicyEnforcementAction {
  id: string;
  policyId: string;
  actionType: "block" | "warn" | "log" | "notify" | "revoke_access" | "require_mfa";
  targetUser?: string;
  targetResource?: string;
  reason: string;
  executedAt: string;
  executedBy: string;
  result: "success" | "failed" | "pending";
  rollbackAvailable: boolean;
  metadata: Record<string, unknown>;
}

export interface GovernancePolicyUpdate {
  id: string;
  policyId: string;
  updateType: "add_rule" | "modify_rule" | "remove_rule" | "change_scope" | "update_threshold";
  description: string;
  suggestedChanges: Array<{
    field: string;
    currentValue: unknown;
    suggestedValue: unknown;
    rationale: string;
  }>;
  aiConfidence: number;
  status: "pending" | "approved" | "rejected" | "applied";
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  appliedAt?: string;
}

export interface DataGovernanceDashboard {
  totalPolicies: number;
  activePolicies: number;
  complianceScore: number;
  openViolations: number;
  pendingReviews: number;
  recentViolations: GovernancePolicyViolation[];
  policyComplianceByType: Record<DataPolicyType, PolicyComplianceStatus>;
  violationTrend: Array<{ date: string; count: number; severity: ViolationSeverity }>;
  pendingPolicyUpdates: GovernancePolicyUpdate[];
  recentEnforcementActions: PolicyEnforcementAction[];
}

// ============================================
// PATIENT ENGAGEMENT - APPOINTMENTS & MONITORING
// ============================================

// Enhanced Appointment Management with Reminders
export const appointmentTypesFull = ["checkup", "followup", "specialist", "procedure", "lab", "telehealth", "vaccination", "screening", "therapy", "consultation"] as const;
export type AppointmentTypeFull = typeof appointmentTypesFull[number];

export const appointmentStatusesFull = ["scheduled", "confirmed", "checked_in", "in_progress", "completed", "cancelled", "no_show", "rescheduled"] as const;
export type AppointmentStatusFull = typeof appointmentStatusesFull[number];

export const reminderChannels = ["email", "sms", "push", "in_app"] as const;
export type ReminderChannel = typeof reminderChannels[number];

export interface PatientAppointment {
  id: string;
  patientId: string;
  providerId?: string;
  providerName: string;
  providerSpecialty?: string;
  facilityName: string;
  facilityAddress?: string;
  type: AppointmentTypeFull;
  title: string;
  description?: string;
  scheduledAt: string;
  duration: number;
  status: AppointmentStatusFull;
  telehealth: boolean;
  telehealthUrl?: string;
  confirmationCode?: string;
  notes?: string;
  patientNotes?: string;
  preVisitInstructions?: string;
  remindersSent: AppointmentReminder[];
  checkedInAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  rescheduledFrom?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentReminder {
  id: string;
  appointmentId: string;
  channel: ReminderChannel;
  scheduledFor: string;
  sentAt?: string;
  status: "pending" | "sent" | "failed" | "acknowledged";
  message: string;
}

export const insertPatientAppointmentSchema = z.object({
  patientId: z.string(),
  providerId: z.string().optional(),
  providerName: z.string().min(1),
  providerSpecialty: z.string().optional(),
  facilityName: z.string().min(1),
  facilityAddress: z.string().optional(),
  type: z.enum(appointmentTypesFull),
  title: z.string().min(1),
  description: z.string().optional(),
  scheduledAt: z.string(),
  duration: z.number().min(5).max(480).default(30),
  status: z.enum(appointmentStatusesFull).default("scheduled"),
  telehealth: z.boolean().default(false),
  telehealthUrl: z.string().optional(),
  notes: z.string().optional(),
  patientNotes: z.string().optional(),
  preVisitInstructions: z.string().optional(),
});

export type InsertPatientAppointment = z.infer<typeof insertPatientAppointmentSchema>;

export const rescheduleAppointmentSchema = z.object({
  appointmentId: z.string(),
  newScheduledAt: z.string(),
  reason: z.string().optional(),
});

export type RescheduleAppointment = z.infer<typeof rescheduleAppointmentSchema>;

// Remote Patient Monitoring - Vital Signs Submission
export const remoteVitalTypes = [
  "blood_pressure_systolic",
  "blood_pressure_diastolic", 
  "heart_rate",
  "temperature",
  "weight",
  "oxygen_saturation",
  "respiratory_rate",
  "blood_glucose",
  "pain_level",
  "peak_flow"
] as const;
export type RemoteVitalType = typeof remoteVitalTypes[number];

export const submissionSources = ["manual_entry", "bluetooth_device", "wearable_sync", "home_device"] as const;
export type SubmissionSource = typeof submissionSources[number];

export interface RemoteVitalSubmission {
  id: string;
  patientId: string;
  vitalType: RemoteVitalType;
  value: number;
  unit: string;
  secondaryValue?: number;
  recordedAt: string;
  submittedAt: string;
  source: SubmissionSource;
  deviceId?: string;
  deviceName?: string;
  notes?: string;
  isAbnormal: boolean;
  abnormalReason?: string;
  reviewedByProvider: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
  providerNotes?: string;
  flaggedForAttention: boolean;
  metadata?: Record<string, unknown>;
}

export const insertRemoteVitalSubmissionSchema = z.object({
  patientId: z.string(),
  vitalType: z.enum(remoteVitalTypes),
  value: z.number(),
  unit: z.string(),
  secondaryValue: z.number().optional(),
  recordedAt: z.string(),
  source: z.enum(submissionSources).default("manual_entry"),
  deviceId: z.string().optional(),
  deviceName: z.string().optional(),
  notes: z.string().optional(),
});

export type InsertRemoteVitalSubmission = z.infer<typeof insertRemoteVitalSubmissionSchema>;

// Health Status Updates
export const healthStatusTypes = ["symptom_report", "wellness_check", "medication_adherence", "side_effect_report", "general_update", "post_visit_followup"] as const;
export type HealthStatusType = typeof healthStatusTypes[number];

// Note: SymptomSeverity is already defined elsewhere in this file

export interface HealthStatusUpdate {
  id: string;
  patientId: string;
  type: HealthStatusType;
  title: string;
  description: string;
  overallFeeling: number;
  symptoms?: SymptomEntry[];
  medicationsTaken?: MedicationAdherenceEntry[];
  sideEffects?: SideEffectEntry[];
  mood?: "excellent" | "good" | "neutral" | "poor" | "very_poor";
  sleepQuality?: "excellent" | "good" | "fair" | "poor" | "very_poor";
  sleepHours?: number;
  activityLevel?: "none" | "light" | "moderate" | "vigorous";
  notes?: string;
  attachedPhotos?: string[];
  submittedAt: string;
  reviewedByProvider: boolean;
  reviewedAt?: string;
  reviewedBy?: string;
  providerNotes?: string;
  flaggedForAttention: boolean;
  followUpRequired: boolean;
  followUpScheduledFor?: string;
}

export interface SymptomEntry {
  symptom: string;
  severity: SymptomSeverity;
  duration?: string;
  location?: string;
  notes?: string;
}

export interface MedicationAdherenceEntry {
  medicationName: string;
  taken: boolean;
  takenAt?: string;
  dosage?: string;
  missedReason?: string;
}

export interface SideEffectEntry {
  medicationName: string;
  sideEffect: string;
  severity: SymptomSeverity;
  startedAt?: string;
  notes?: string;
}

const healthStatusSymptomSeverities = ["none", "mild", "moderate", "severe", "very_severe"] as const;
type HealthStatusSymptomSeverity = typeof healthStatusSymptomSeverities[number];

export const insertHealthStatusUpdateSchema = z.object({
  patientId: z.string(),
  type: z.enum(healthStatusTypes),
  title: z.string().min(1),
  description: z.string(),
  overallFeeling: z.number().min(1).max(10),
  symptoms: z.array(z.object({
    symptom: z.string(),
    severity: z.enum(healthStatusSymptomSeverities),
    duration: z.string().optional(),
    location: z.string().optional(),
    notes: z.string().optional(),
  })).optional(),
  medicationsTaken: z.array(z.object({
    medicationName: z.string(),
    taken: z.boolean(),
    takenAt: z.string().optional(),
    dosage: z.string().optional(),
    missedReason: z.string().optional(),
  })).optional(),
  sideEffects: z.array(z.object({
    medicationName: z.string(),
    sideEffect: z.string(),
    severity: z.enum(healthStatusSymptomSeverities),
    startedAt: z.string().optional(),
    notes: z.string().optional(),
  })).optional(),
  mood: z.enum(["excellent", "good", "neutral", "poor", "very_poor"]).optional(),
  sleepQuality: z.enum(["excellent", "good", "fair", "poor", "very_poor"]).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  activityLevel: z.enum(["none", "light", "moderate", "vigorous"]).optional(),
  notes: z.string().optional(),
  attachedPhotos: z.array(z.string()).optional(),
});

export type InsertHealthStatusUpdate = z.infer<typeof insertHealthStatusUpdateSchema>;

// Clinician Review Dashboard Types
export interface PatientMonitoringDashboard {
  patientId: string;
  patientName: string;
  recentVitals: RemoteVitalSubmission[];
  recentStatusUpdates: HealthStatusUpdate[];
  upcomingAppointments: PatientAppointment[];
  flaggedItems: number;
  lastSubmission?: string;
  complianceScore: number;
  trends: VitalTrendSummary[];
}

export interface VitalTrendSummary {
  vitalType: RemoteVitalType;
  average: number;
  min: number;
  max: number;
  trend: "improving" | "stable" | "worsening" | "insufficient_data";
  dataPoints: number;
  unit: string;
}

export interface ClinicianReviewQueue {
  pendingVitals: RemoteVitalSubmission[];
  pendingStatusUpdates: HealthStatusUpdate[];
  flaggedPatients: PatientMonitoringDashboard[];
  totalPendingReviews: number;
}

// Language Preferences for Clinical Summaries
export const supportedSummaryLanguages = [
  "en", "es", "zh", "zh-TW", "vi", "ko", "tl", "ru", "ar", "fr", 
  "de", "pt", "ja", "hi", "it", "pl", "uk", "fa", "bn", "th", 
  "tr", "nl", "el", "he", "id", "ms", "ro", "sv", "cs", "hu"
] as const;
export type SummaryLanguageCode = typeof supportedSummaryLanguages[number];

export interface UserLanguagePreference {
  userId: string;
  defaultLanguage: SummaryLanguageCode;
  summaryLanguageOverrides: Record<string, SummaryLanguageCode>; // summaryId -> language
  updatedAt: string;
  createdAt: string;
}

export interface LanguageAnalyticsEvent {
  eventType: "language_selected" | "summary_language_changed" | "translation_requested" | "translation_completed" | "translation_viewed_original";
  userId: string;
  previousLanguage?: SummaryLanguageCode;
  newLanguage: SummaryLanguageCode;
  summaryId?: string;
  documentType?: "snapshot_pdf" | "discharge_summary" | "timeline_monthly";
  context: "profile_default" | "quick_switch" | "document_translation" | "view_original";
  timestamp: string;
}

export const insertUserLanguagePreferenceSchema = z.object({
  userId: z.string(),
  defaultLanguage: z.enum(supportedSummaryLanguages),
  summaryLanguageOverrides: z.record(z.string(), z.enum(supportedSummaryLanguages)).optional()
});

export type InsertUserLanguagePreference = z.infer<typeof insertUserLanguagePreferenceSchema>;

// ============================================
// CLINICIAN DASHBOARD TYPES
// ============================================

// Remote vital sign alert for clinician dashboard
export const vitalAlertSeverities = ["critical", "high", "moderate", "low"] as const;
export type VitalAlertSeverity = typeof vitalAlertSeverities[number];

export const vitalAlertStatuses = ["new", "acknowledged", "in_review", "resolved", "escalated"] as const;
export type VitalAlertStatus = typeof vitalAlertStatuses[number];

export interface RemoteVitalAlert {
  id: string;
  patientId: string;
  patientName: string;
  vitalType: string;
  value: number;
  unit: string;
  normalRange: { min: number; max: number };
  severity: VitalAlertSeverity;
  status: VitalAlertStatus;
  triggeredAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  deviceType?: string;
  notes?: string;
  trendDirection?: "increasing" | "decreasing" | "stable";
  previousValues?: { value: number; timestamp: string }[];
}

// Pending appointment request for clinician dashboard
export const appointmentRequestStatuses = ["pending", "approved", "declined", "rescheduled", "cancelled"] as const;
export type AppointmentRequestStatus = typeof appointmentRequestStatuses[number];

export const appointmentRequestTypes = ["new_patient", "follow_up", "urgent", "routine", "telehealth", "specialist_referral"] as const;
export type AppointmentRequestType = typeof appointmentRequestTypes[number];

export interface PendingAppointmentRequest {
  id: string;
  patientId: string;
  patientName: string;
  requestType: AppointmentRequestType;
  requestedDate: string;
  requestedTimeSlot?: string;
  reason: string;
  urgencyLevel: "routine" | "soon" | "urgent" | "emergency";
  status: AppointmentRequestStatus;
  submittedAt: string;
  notes?: string;
  insuranceVerified?: boolean;
  previousVisitDate?: string;
  preferredProvider?: string;
}

// AI-identified follow-up patient for clinician dashboard
export const followUpReasons = [
  "abnormal_lab_results",
  "medication_review",
  "chronic_condition_monitoring", 
  "post_procedure",
  "care_gap",
  "missed_appointment",
  "deteriorating_vitals",
  "medication_adherence",
  "preventive_care_due",
  "high_risk_score"
] as const;
export type FollowUpReason = typeof followUpReasons[number];

export const followUpPriorities = ["critical", "high", "medium", "low"] as const;
export type FollowUpPriority = typeof followUpPriorities[number];

export interface AIFollowUpPatient {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  conditions: string[];
  followUpReason: FollowUpReason;
  priority: FollowUpPriority;
  aiConfidenceScore: number;
  aiRationale: string;
  suggestedAction: string;
  suggestedTimeframe: string;
  lastVisitDate?: string;
  daysSinceLastVisit?: number;
  riskFactors?: string[];
  relevantMetrics?: { name: string; value: string; status: "normal" | "borderline" | "abnormal" }[];
  generatedAt: string;
  status: "pending" | "scheduled" | "contacted" | "dismissed";
}

// Clinician task for task list
export const clinicianTaskTypes = [
  "review_results",
  "sign_orders", 
  "respond_message",
  "review_referral",
  "complete_documentation",
  "prior_authorization",
  "prescription_renewal",
  "care_plan_update",
  "patient_callback",
  "other"
] as const;
export type ClinicianTaskType = typeof clinicianTaskTypes[number];

export const clinicianTaskStatuses = ["pending", "in_progress", "completed", "deferred", "cancelled"] as const;
export type ClinicianTaskStatus = typeof clinicianTaskStatuses[number];

export const clinicianTaskPriorities = ["urgent", "high", "normal", "low"] as const;
export type ClinicianTaskPriority = typeof clinicianTaskPriorities[number];

export interface ClinicianTask {
  id: string;
  taskType: ClinicianTaskType;
  title: string;
  description: string;
  patientId?: string;
  patientName?: string;
  priority: ClinicianTaskPriority;
  status: ClinicianTaskStatus;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  assignedTo: string;
  assignedBy?: string;
  relatedDocumentId?: string;
  tags?: string[];
  notes?: string;
}

// Clinician dashboard summary
export interface ClinicianDashboardSummary {
  clinicianId: string;
  clinicianName: string;
  lastUpdated: string;
  vitalAlerts: {
    total: number;
    critical: number;
    high: number;
    newCount: number;
  };
  appointmentRequests: {
    total: number;
    urgent: number;
    pendingToday: number;
  };
  followUpPatients: {
    total: number;
    highPriority: number;
    criticalPriority: number;
  };
  tasks: {
    total: number;
    overdue: number;
    dueTodayCount: number;
    pendingCount: number;
  };
}

// Insert schemas for clinician dashboard entities
export const insertRemoteVitalAlertSchema = z.object({
  patientId: z.string(),
  patientName: z.string(),
  vitalType: z.string(),
  value: z.number(),
  unit: z.string(),
  normalRange: z.object({ min: z.number(), max: z.number() }),
  severity: z.enum(vitalAlertSeverities),
  deviceType: z.string().optional(),
  notes: z.string().optional(),
});
export type InsertRemoteVitalAlert = z.infer<typeof insertRemoteVitalAlertSchema>;

export const insertAppointmentRequestSchema = z.object({
  patientId: z.string(),
  patientName: z.string(),
  requestType: z.enum(appointmentRequestTypes),
  requestedDate: z.string(),
  requestedTimeSlot: z.string().optional(),
  reason: z.string(),
  urgencyLevel: z.enum(["routine", "soon", "urgent", "emergency"]),
  notes: z.string().optional(),
  preferredProvider: z.string().optional(),
});
export type InsertAppointmentRequest = z.infer<typeof insertAppointmentRequestSchema>;

export const insertClinicianTaskSchema = z.object({
  taskType: z.enum(clinicianTaskTypes),
  title: z.string(),
  description: z.string(),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  priority: z.enum(clinicianTaskPriorities),
  dueDate: z.string().optional(),
  assignedTo: z.string(),
  assignedBy: z.string().optional(),
  relatedDocumentId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
});
export type InsertClinicianTask = z.infer<typeof insertClinicianTaskSchema>;

export const updateClinicianTaskSchema = z.object({
  status: z.enum(clinicianTaskStatuses).optional(),
  priority: z.enum(clinicianTaskPriorities).optional(),
  notes: z.string().optional(),
  dueDate: z.string().optional(),
});
export type UpdateClinicianTask = z.infer<typeof updateClinicianTaskSchema>;

// ============================================================================
// COMPREHENSIVE PATIENT HEALTH RECORD
// ============================================================================

export const labResultRecordStatuses = ["final", "preliminary", "corrected", "cancelled"] as const;
export type LabResultRecordStatus = typeof labResultRecordStatuses[number];

export const labResultRecordFlags = ["normal", "low", "high", "critical_low", "critical_high", "abnormal"] as const;
export type LabResultRecordFlag = typeof labResultRecordFlags[number];

export interface LabResultRecord {
  id: string;
  patientId: string;
  testName: string;
  testCode: string;
  category: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: LabResultRecordFlag;
  status: LabResultRecordStatus;
  collectionDate: string;
  resultDate: string;
  orderingProvider: string;
  performingLab: string;
  notes?: string;
  interpretation?: string;
}

export const clinicianNoteTypes = ["progress", "consultation", "procedure", "discharge", "telephone", "nursing", "social_work", "therapy"] as const;
export type ClinicianNoteType = typeof clinicianNoteTypes[number];

export interface ClinicianNote {
  id: string;
  patientId: string;
  noteType: ClinicianNoteType;
  title: string;
  content: string;
  author: string;
  authorRole: string;
  createdAt: string;
  updatedAt?: string;
  signedAt?: string;
  signedBy?: string;
  encounterDate: string;
  encounterType?: string;
  diagnosisCodes?: string[];
  procedureCodes?: string[];
  isAddendum: boolean;
  parentNoteId?: string;
}

export interface PatientDemographics {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  insuranceInfo?: {
    provider: string;
    policyNumber: string;
    groupNumber: string;
  };
  primaryCareProvider?: string;
  preferredLanguage?: string;
  ethnicity?: string;
  maritalStatus?: string;
}

export interface AppointmentHistoryEntry {
  id: string;
  patientId: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  provider: string;
  providerSpecialty?: string;
  location: string;
  status: "completed" | "cancelled" | "no_show" | "scheduled" | "checked_in";
  reasonForVisit: string;
  duration: number;
  notes?: string;
  followUpRequired: boolean;
  followUpDate?: string;
}

export interface VitalSignRecord {
  id: string;
  patientId: string;
  recordedAt: string;
  recordedBy: string;
  location: string;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  respiratoryRate?: number;
  temperature?: number;
  temperatureUnit?: "F" | "C";
  oxygenSaturation?: number;
  weight?: number;
  weightUnit?: "lbs" | "kg";
  height?: number;
  heightUnit?: "in" | "cm";
  bmi?: number;
  painLevel?: number;
  notes?: string;
}

export interface ComprehensiveHealthRecord {
  patientId: string;
  demographics: PatientDemographics;
  appointmentHistory: AppointmentHistoryEntry[];
  vitalSigns: VitalSignRecord[];
  labResults: LabResultRecord[];
  clinicianNotes: ClinicianNote[];
  lastUpdated: string;
  totalRecords: {
    appointments: number;
    vitals: number;
    labs: number;
    notes: number;
  };
}

export interface HealthRecordSearchFilters {
  searchQuery?: string;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  recordType?: "all" | "appointments" | "vitals" | "labs" | "notes";
  provider?: string;
  status?: string;
}

export interface HealthRecordSearchResult {
  type: "appointment" | "vital" | "lab" | "note";
  id: string;
  date: string;
  title: string;
  summary: string;
  category?: string;
  provider?: string;
  relevanceScore?: number;
}

// ============================================
// AI SUMMARY FEEDBACK SYSTEM
// ============================================

export type AiFeedbackType = "timeline_summary" | "document_summary" | "lab_explanation" | "imaging_summary" | "copilot_insight" | "medication_summary" | "snapshot_pdf";

export interface AiFeedback {
  id: string;
  feedbackType: AiFeedbackType;
  summaryId: string;
  userId: string;
  accuracyRating: number; // 1-5
  usefulnessRating: number; // 1-5
  textFeedback?: string;
  isInaccurate: boolean; // Report inaccurate summary flag
  inaccuracyDetails?: string;
  createdAt: string;
}

export interface InsertAiFeedback {
  feedbackType: AiFeedbackType;
  summaryId: string;
  userId?: string;
  accuracyRating: number;
  usefulnessRating: number;
  textFeedback?: string;
  isInaccurate?: boolean;
  inaccuracyDetails?: string;
}

export interface AiFeedbackStats {
  feedbackType: AiFeedbackType;
  totalFeedback: number;
  avgAccuracyRating: number;
  avgUsefulnessRating: number;
  inaccuracyReports: number;
}

// ============================================
// AI CHRONIC DISEASE MANAGEMENT SYSTEM
// ============================================

export const chronicConditionTypes = [
  "diabetes_type1",
  "diabetes_type2",
  "hypertension",
  "heart_failure",
  "copd",
  "asthma",
  "chronic_kidney_disease",
  "arthritis",
  "obesity",
  "depression",
  "anxiety",
  "hypothyroidism",
  "hyperthyroidism",
  "osteoporosis",
  "multiple_sclerosis",
  "parkinsons",
  "alzheimers",
  "cancer_remission",
  "hiv",
  "hepatitis_c",
  "inflammatory_bowel_disease",
  "celiac_disease",
  "fibromyalgia",
  "lupus",
  "psoriasis",
  "eczema",
  "migraines",
  "epilepsy",
  "sleep_apnea",
  "other",
] as const;
export type ChronicConditionType = typeof chronicConditionTypes[number];

export const managementPlanStatuses = ["draft", "active", "paused", "completed", "archived"] as const;
export type ManagementPlanStatus = typeof managementPlanStatuses[number];

export const adherenceStatuses = ["taken", "missed", "delayed", "partial"] as const;
export type AdherenceStatus = typeof adherenceStatuses[number];

export const alertPriorities = ["low", "medium", "high", "urgent"] as const;
export type AlertPriority = typeof alertPriorities[number];

export interface ChronicConditionProfile {
  id: string;
  patientId: string;
  conditionType: ChronicConditionType;
  conditionName: string;
  diagnosisDate?: string;
  severity?: string;
  status: "active" | "managed" | "remission" | "resolved";
  primaryProvider?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ChronicDiseaseManagementPlan {
  id: string;
  patientId: string;
  conditionId: string;
  title: string;
  description: string;
  status: ManagementPlanStatus;
  goals: ManagementGoal[];
  interventions: ManagementIntervention[];
  monitoringSchedule: MonitoringItem[];
  educationTopics: EducationTopic[];
  startDate: string;
  targetEndDate?: string;
  lastAIAnalysis?: string;
  aiGeneratedInsights?: string;
  progressScore?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ManagementGoal {
  id: string;
  title: string;
  description: string;
  targetValue?: string;
  currentValue?: string;
  unit?: string;
  targetDate?: string;
  status: "not_started" | "in_progress" | "achieved" | "not_achieved" | "modified";
  progressPercentage?: number;
  aiRecommendation?: string;
}

export interface ManagementIntervention {
  id: string;
  category: "medication" | "lifestyle" | "monitoring" | "therapy" | "education" | "follow_up";
  title: string;
  description: string;
  frequency?: string;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
}

export interface MonitoringItem {
  id: string;
  type: "vital" | "lab" | "symptom" | "behavior";
  name: string;
  frequency: string;
  lastRecorded?: string;
  targetRange?: string;
  unit?: string;
}

export interface EducationTopic {
  id: string;
  title: string;
  category: string;
  content: string;
  isCompleted: boolean;
  completedAt?: string;
  aiPersonalized: boolean;
}

export interface SymptomLog {
  id: string;
  patientId: string;
  conditionId?: string;
  symptomName: string;
  severity: SymptomSeverity;
  description?: string;
  triggers?: string[];
  duration?: string;
  affectsDaily: boolean;
  loggedAt: string;
  notes?: string;
}

export interface AdherenceLog {
  id: string;
  patientId: string;
  medicationId?: string;
  medicationName: string;
  scheduledTime: string;
  actualTime?: string;
  status: AdherenceStatus;
  dosage?: string;
  notes?: string;
  loggedAt: string;
}

export interface LifestyleLog {
  id: string;
  patientId: string;
  category: "diet" | "exercise" | "sleep" | "stress" | "hydration" | "alcohol" | "smoking" | "other";
  description: string;
  value?: string;
  unit?: string;
  duration?: number;
  loggedAt: string;
  notes?: string;
}

export interface PredictiveAlert {
  id: string;
  patientId: string;
  conditionId?: string;
  alertType: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  recommendation?: string;
  aiConfidence?: number;
  triggerData?: Record<string, unknown>;
  isRead: boolean;
  isDismissed: boolean;
  actionTaken?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface ProgressSnapshot {
  id: string;
  patientId: string;
  planId: string;
  snapshotDate: string;
  overallScore: number;
  goalProgress: Record<string, number>;
  adherenceRate: number;
  symptomTrend: "improving" | "stable" | "worsening";
  aiSummary: string;
  recommendations: string[];
  comparedToPrevious?: {
    scoreChange: number;
    adherenceChange: number;
    trendChange: string;
  };
}

export interface PersonalizedEducationContent {
  id: string;
  patientId: string;
  conditionType: ChronicConditionType;
  title: string;
  content: string;
  contentType: "article" | "video_summary" | "tip" | "quiz" | "checklist";
  readingLevel: "simple" | "standard" | "detailed";
  isAIGenerated: boolean;
  relevanceScore?: number;
  isCompleted: boolean;
  completedAt?: string;
  feedback?: {
    helpful: boolean;
    comments?: string;
  };
  createdAt: string;
}

export const insertSymptomLogSchema = z.object({
  patientId: z.string(),
  conditionId: z.string().optional(),
  symptomName: z.string().min(1),
  severity: z.enum(symptomSeverities),
  description: z.string().optional(),
  triggers: z.array(z.string()).optional(),
  duration: z.string().optional(),
  affectsDaily: z.boolean().default(false),
  notes: z.string().optional(),
});
export type InsertSymptomLog = z.infer<typeof insertSymptomLogSchema>;

export const insertAdherenceLogSchema = z.object({
  patientId: z.string(),
  medicationId: z.string().optional(),
  medicationName: z.string().min(1),
  scheduledTime: z.string(),
  actualTime: z.string().optional(),
  status: z.enum(adherenceStatuses),
  dosage: z.string().optional(),
  notes: z.string().optional(),
});
export type InsertAdherenceLog = z.infer<typeof insertAdherenceLogSchema>;

export const insertLifestyleLogSchema = z.object({
  patientId: z.string(),
  category: z.enum(["diet", "exercise", "sleep", "stress", "hydration", "alcohol", "smoking", "other"]),
  description: z.string().min(1),
  value: z.string().optional(),
  unit: z.string().optional(),
  duration: z.number().optional(),
  notes: z.string().optional(),
});
export type InsertLifestyleLog = z.infer<typeof insertLifestyleLogSchema>;

// ============================================
// VIDEO CONSULTATION MODULE
// ============================================

export const videoCallStatuses = [
  "scheduled",
  "waiting",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type VideoCallStatus = (typeof videoCallStatuses)[number];

export const videoParticipantRoles = ["patient", "clinician", "caregiver"] as const;
export type VideoParticipantRole = (typeof videoParticipantRoles)[number];

export interface VideoAppointment {
  id: string;
  patientId: string;
  clinicianId: string;
  patientName: string;
  clinicianName: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  duration: number;
  reason: string;
  notes?: string;
  status: VideoCallStatus;
  roomId: string;
  joinUrl?: string;
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VideoSession {
  id: string;
  appointmentId: string;
  roomId: string;
  status: VideoCallStatus;
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  participants: VideoParticipant[];
  patientContext?: VideoPatientContext;
  notes?: string;
  recordingEnabled: boolean;
  recordingUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VideoParticipant {
  id: string;
  sessionId: string;
  userId: string;
  userName: string;
  role: VideoParticipantRole;
  joinedAt?: string;
  leftAt?: string;
  isConnected: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export interface VideoPatientContext {
  patientId: string;
  patientName: string;
  dateOfBirth?: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
  recentVisits: { date: string; reason: string; provider: string }[];
  vitalSigns?: { type: string; value: string; date: string }[];
  upcomingAppointments: { date: string; reason: string }[];
}

export interface VideoCallLog {
  id: string;
  sessionId: string;
  appointmentId: string;
  patientId: string;
  clinicianId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: "connected" | "disconnected" | "failed";
  qualityScore?: number;
  technicalIssues?: string[];
  notes?: string;
  createdAt: string;
}

export const insertVideoAppointmentSchema = z.object({
  patientId: z.string().min(1),
  clinicianId: z.string().min(1),
  patientName: z.string().min(1),
  clinicianName: z.string().min(1),
  scheduledStartTime: z.string(),
  scheduledEndTime: z.string(),
  duration: z.number().min(5).max(120),
  reason: z.string().min(1),
  notes: z.string().optional(),
});
export type InsertVideoAppointment = z.infer<typeof insertVideoAppointmentSchema>;

export const updateVideoAppointmentSchema = z.object({
  scheduledStartTime: z.string().optional(),
  scheduledEndTime: z.string().optional(),
  duration: z.number().min(5).max(120).optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(videoCallStatuses).optional(),
});
export type UpdateVideoAppointment = z.infer<typeof updateVideoAppointmentSchema>;

export interface WebRTCSignal {
  type: "offer" | "answer" | "ice-candidate" | "join" | "leave" | "ready";
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: VideoParticipantRole;
  payload?: RTCSessionDescriptionInit | RTCIceCandidateInit | null;
  timestamp: string;
}

export interface EncryptedChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: "patient" | "provider";
  ciphertext: string;
  iv: string;
  timestamp: string;
}

export interface SessionRecording {
  id: string;
  sessionId: string;
  roomId: string;
  recordedBy: string;
  consentedBy: string[];
  consentTimestamp: string;
  objectKey: string;
  durationSeconds: number;
  fileSizeBytes: number;
  mimeType: string;
  encryptionStatus: "encrypted" | "unencrypted";
  status: "recording" | "uploading" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
}

export const insertSessionRecordingSchema = z.object({
  sessionId: z.string().min(1),
  roomId: z.string().min(1),
  recordedBy: z.string().min(1),
  consentedBy: z.array(z.string()),
  consentTimestamp: z.string(),
  durationSeconds: z.number().min(0),
  fileSizeBytes: z.number().min(0),
  mimeType: z.string().default("video/webm"),
});
export type InsertSessionRecording = z.infer<typeof insertSessionRecordingSchema>;

// ============================================
// TELEHEALTH APPOINTMENT REMINDERS
// ============================================

export const reminderTimings = ["24_hours", "2_hours", "1_hour", "30_minutes", "15_minutes"] as const;
export type ReminderTiming = typeof reminderTimings[number];

export const telehealthReminderStatuses = ["scheduled", "sent", "failed", "acknowledged", "cancelled"] as const;
export type TelehealthReminderStatus = typeof telehealthReminderStatuses[number];

export interface TelehealthReminderPreference {
  id: string;
  userId: string;
  userRole: "patient" | "provider";
  channels: ReminderChannel[];
  timings: ReminderTiming[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export const insertTelehealthReminderPreferenceSchema = z.object({
  userId: z.string().min(1),
  userRole: z.enum(["patient", "provider"]),
  channels: z.array(z.enum(reminderChannels)).min(1),
  timings: z.array(z.enum(reminderTimings)).min(1),
  enabled: z.boolean().default(true),
});
export type InsertTelehealthReminderPreference = z.infer<typeof insertTelehealthReminderPreferenceSchema>;

export interface TelehealthReminder {
  id: string;
  appointmentId: string;
  recipientId: string;
  recipientRole: "patient" | "provider";
  recipientName: string;
  recipientEmail?: string;
  appointmentTitle: string;
  providerName: string;
  scheduledTime: string;
  reminderTime: string;
  timing: ReminderTiming;
  channel: ReminderChannel;
  status: TelehealthReminderStatus;
  message: string;
  sentAt?: string;
  acknowledgedAt?: string;
  failureReason?: string;
  createdAt: string;
}

export const insertTelehealthReminderSchema = z.object({
  appointmentId: z.string().min(1),
  recipientId: z.string().min(1),
  recipientRole: z.enum(["patient", "provider"]),
  recipientName: z.string().min(1),
  recipientEmail: z.string().email().optional(),
  appointmentTitle: z.string().min(1),
  providerName: z.string().min(1),
  scheduledTime: z.string(),
  reminderTime: z.string(),
  timing: z.enum(reminderTimings),
  channel: z.enum(reminderChannels),
  message: z.string().optional(),
});
export type InsertTelehealthReminder = z.infer<typeof insertTelehealthReminderSchema>;

export interface TelehealthNotification {
  id: string;
  userId: string;
  type: "appointment_reminder" | "session_starting" | "recording_available" | "consent_request" | "general";
  title: string;
  message: string;
  actionUrl?: string;
  read: boolean;
  createdAt: string;
  expiresAt?: string;
}

// ============================================
// CLINICIAN PROVIDER DIRECTORY
// ============================================

export const connectionStatuses = ["fhir_enabled", "direct_enabled", "manual_only", "pending", "not_connected"] as const;
export type ConnectionStatus = (typeof connectionStatuses)[number];

export const directoryProviderTypes = ["physician", "specialist", "facility", "lab", "imaging", "pharmacy", "hospital"] as const;
export type DirectoryProviderType = (typeof directoryProviderTypes)[number];

export interface DirectoryProvider {
  id: string;
  npi?: string;
  name: string;
  type: DirectoryProviderType;
  specialties: string[];
  primarySpecialty?: string;
  credentials?: string[];
  organization?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  fax?: string;
  email?: string;
  website?: string;
  connectionStatus: ConnectionStatus;
  fhirBaseUrl?: string;
  ehrVendor?: string;
  acceptingNewPatients: boolean;
  acceptingReferrals: boolean;
  languages: string[];
  hospitalAffiliations: string[];
  networkStatus: "in_network" | "out_of_network" | "unknown";
  lastVerified?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderBookmark {
  id: string;
  clinicianId: string;
  providerId: string;
  notes?: string;
  tags?: string[];
  createdAt: string;
}

export interface DirectorySearchFilters {
  query?: string;
  type?: DirectoryProviderType;
  specialty?: string;
  city?: string;
  state?: string;
  connectionStatus?: ConnectionStatus;
  acceptingReferrals?: boolean;
  bookmarkedOnly?: boolean;
}

export interface DirectorySearchResult {
  providers: (DirectoryProvider & { isBookmarked: boolean })[];
  totalCount: number;
  page: number;
  hasMore: boolean;
}

export const insertProviderBookmarkSchema = z.object({
  providerId: z.string().min(1),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type InsertProviderBookmark = z.infer<typeof insertProviderBookmarkSchema>;

// ============================================
// SECURE MESSAGING SYSTEM
// ============================================

export const secureMessageStatuses = ["sent", "delivered", "read"] as const;
export type SecureMessageStatus = (typeof secureMessageStatuses)[number];

export const conversationTypes = ["patient_caregiver", "patient_provider", "caregiver_provider", "group"] as const;
export type ConversationType = (typeof conversationTypes)[number];

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string | null;
  profileId: string;
  participantIds: string[];
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  isArchived: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const insertConversationSchema = z.object({
  type: z.enum(conversationTypes),
  title: z.string().nullable().optional(),
  profileId: z.string().min(1),
  participantIds: z.array(z.string().min(1)).min(1),
});
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export interface SecureMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  attachmentUrl: string | null;
  attachmentType: string | null;
  status: SecureMessageStatus;
  isEdited: boolean;
  isDeleted: boolean;
  replyToId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const insertMessageSchema = z.object({
  conversationId: z.string().min(1),
  content: z.string().min(1, "Message cannot be empty"),
  attachmentUrl: z.string().url().nullable().optional(),
  attachmentType: z.string().nullable().optional(),
  replyToId: z.string().nullable().optional(),
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export interface MessageReadReceipt {
  id: string;
  messageId: string;
  userId: string;
  readAt: string;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  joinedAt: string;
  lastReadAt: string | null;
  isMuted: boolean;
  isActive: boolean;
}

// ============================================
// PATIENT DASHBOARD - APPOINTMENTS
// ============================================

export const appointmentStatuses = ["scheduled", "confirmed", "checked_in", "in_progress", "completed", "cancelled", "no_show", "rescheduled"] as const;
export type AppointmentStatus = (typeof appointmentStatuses)[number];

export const patientAppointmentTypes = ["routine_checkup", "follow_up", "vaccination", "specialist", "lab_work", "imaging", "telehealth", "urgent_care", "wellness", "dental", "vision", "mental_health"] as const;
export type PatientAppointmentType = (typeof patientAppointmentTypes)[number];

export interface PatientAppointment {
  id: string;
  profileId: string;
  providerId: string | null;
  providerName: string;
  providerSpecialty: string | null;
  facilityName: string | null;
  facilityAddress: string | null;
  appointmentType: PatientAppointmentType;
  title: string;
  description: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  isTelehealth: boolean;
  telehealthUrl: string | null;
  notes: string | null;
  reminderSentAt: string | null;
  confirmedAt: string | null;
  checkedInAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const insertPatientDashboardAppointmentSchema = z.object({
  profileId: z.string().min(1),
  providerId: z.string().nullable().optional(),
  providerName: z.string().min(1),
  providerSpecialty: z.string().nullable().optional(),
  facilityName: z.string().nullable().optional(),
  facilityAddress: z.string().nullable().optional(),
  appointmentType: z.enum(patientAppointmentTypes),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  scheduledAt: z.string().min(1),
  durationMinutes: z.number().min(5).max(480).default(30),
  isTelehealth: z.boolean().default(false),
  telehealthUrl: z.string().url().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type InsertPatientDashboardAppointment = z.infer<typeof insertPatientDashboardAppointmentSchema>;

// ============================================
// PATIENT DASHBOARD - HEALTH SUMMARY
// ============================================

export interface PatientHealthSummary {
  profileId: string;
  lastUpdated: string;
  totalMedications: number;
  activeMedications: number;
  totalAllergies: number;
  totalConditions: number;
  activeConditions: number;
  upcomingAppointments: number;
  overdueVaccinations: number;
  recentLabResults: number;
  unreadMessages: number;
  activeChallenges: number;
  healthScore: number;
  lastCheckupDate: string | null;
  nextAppointmentDate: string | null;
}

// ============================================
// GAMIFICATION - HEALTH CHALLENGES
// ============================================

export const challengeCategories = ["medication_adherence", "exercise", "nutrition", "sleep", "mental_wellness", "preventive_care", "hydration", "screenings", "vaccinations", "custom"] as const;
export type ChallengeCategory = (typeof challengeCategories)[number];

export const challengeDifficulties = ["easy", "medium", "hard", "expert"] as const;
export type ChallengeDifficulty = (typeof challengeDifficulties)[number];

export const challengeStatuses = ["active", "completed", "failed", "expired", "paused"] as const;
export type ChallengeStatus = (typeof challengeStatuses)[number];

export interface HealthChallenge {
  id: string;
  title: string;
  description: string;
  category: ChallengeCategory;
  difficulty: ChallengeDifficulty;
  pointsReward: number;
  badgeReward: string | null;
  goalValue: number;
  goalUnit: string;
  durationDays: number;
  iconName: string;
  colorTheme: string;
  isSystemChallenge: boolean;
  isActive: boolean;
  createdAt: string;
}

export const insertHealthChallengeSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(challengeCategories),
  difficulty: z.enum(challengeDifficulties),
  pointsReward: z.number().min(1).max(1000),
  badgeReward: z.string().nullable().optional(),
  goalValue: z.number().min(1),
  goalUnit: z.string().min(1),
  durationDays: z.number().min(1).max(365),
  iconName: z.string().default("target"),
  colorTheme: z.string().default("blue"),
});
export type InsertHealthChallenge = z.infer<typeof insertHealthChallengeSchema>;

export interface UserChallengeProgress {
  id: string;
  userId: string;
  profileId: string;
  challengeId: string;
  status: ChallengeStatus;
  currentValue: number;
  goalValue: number;
  startedAt: string;
  completedAt: string | null;
  expiresAt: string;
  lastUpdatedAt: string;
  streakDays: number;
  notes: string | null;
}

export const insertUserChallengeProgressSchema = z.object({
  profileId: z.string().min(1),
  challengeId: z.string().min(1),
});
export type InsertUserChallengeProgress = z.infer<typeof insertUserChallengeProgressSchema>;

export const updateChallengeProgressSchema = z.object({
  progressValue: z.number().min(0),
  notes: z.string().nullable().optional(),
});
export type UpdateChallengeProgress = z.infer<typeof updateChallengeProgressSchema>;

// ============================================
// GAMIFICATION - ACHIEVEMENTS & BADGES
// ============================================

export interface Achievement {
  id: string;
  name: string;
  description: string;
  iconName: string;
  colorTheme: string;
  rarity: BadgeRarity;
  pointsValue: number;
  category: ChallengeCategory;
  requirement: string;
  requirementValue: number;
  isHidden: boolean;
  createdAt: string;
}

export interface UserAchievement {
  id: string;
  userId: string;
  profileId: string;
  achievementId: string;
  earnedAt: string;
  celebratedAt: string | null;
}

// ============================================
// GAMIFICATION - STREAKS & POINTS
// ============================================

export const streakTypes = ["daily_login", "medication_taken", "exercise", "water_intake", "sleep_logged", "mood_logged", "challenge_completed"] as const;
export type StreakType = (typeof streakTypes)[number];

export interface UserStreak {
  id: string;
  userId: string;
  profileId: string;
  streakType: StreakType;
  currentStreak: number;
  longestStreak: number;
  lastActivityAt: string;
  streakStartedAt: string;
  isFrozen: boolean;
  freezesRemaining: number;
}

export interface UserPoints {
  id: string;
  userId: string;
  profileId: string;
  totalPoints: number;
  currentPoints: number;
  lifetimePoints: number;
  level: number;
  levelName: string;
  pointsToNextLevel: number;
  lastEarnedAt: string | null;
  updatedAt: string;
}

export interface PointTransaction {
  id: string;
  userId: string;
  profileId: string;
  amount: number;
  transactionType: "earned" | "spent" | "bonus" | "expired";
  source: string;
  sourceId: string | null;
  description: string;
  createdAt: string;
}

// ============================================
// GAMIFICATION - LEADERBOARD
// ============================================

export const leaderboardPeriods = ["daily", "weekly", "monthly", "all_time"] as const;
export type LeaderboardPeriod = (typeof leaderboardPeriods)[number];

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  points: number;
  level: number;
  achievementCount: number;
  streakDays: number;
  isCurrentUser: boolean;
}

export interface LeaderboardData {
  period: LeaderboardPeriod;
  entries: LeaderboardEntry[];
  userRank: number | null;
  totalParticipants: number;
  lastUpdatedAt: string;
}

// ============================================
// CANCER TRACK - STRUCTURED ONCOLOGY TIMELINE
// ============================================

export const cancerTypes = [
  "breast", "lung", "colon", "prostate", "melanoma", "lymphoma", "leukemia",
  "ovarian", "pancreatic", "bladder", "kidney", "liver", "thyroid", "brain",
  "stomach", "esophageal", "cervical", "uterine", "testicular", "sarcoma",
  "multiple_myeloma", "head_neck", "other"
] as const;
export type CancerType = (typeof cancerTypes)[number];

export const cancerStages = ["0", "I", "IA", "IB", "II", "IIA", "IIB", "III", "IIIA", "IIIB", "IIIC", "IV", "IVA", "IVB", "unknown", "not_staged"] as const;
export type CancerStage = (typeof cancerStages)[number];

export const treatmentTypes = [
  "diagnosis", "surgery", "chemotherapy", "radiation", "immunotherapy", "hormone_therapy",
  "targeted_therapy", "stem_cell_transplant", "bone_marrow_transplant",
  "clinical_trial", "palliative_care", "watchful_waiting", "other"
] as const;
export type TreatmentType = (typeof treatmentTypes)[number];

// Cancer Track Folder Types - Flat list for database storage
export const cancerFolderTypes = [
  // Diagnosis & Pathology
  "diagnosis_pathology", "pathology_reports", "biopsy_results", "molecular_biomarkers",
  // Imaging
  "imaging", "imaging_pet_ct", "imaging_ct", "imaging_mri", "imaging_ultrasound", "imaging_nuclear",
  // Treatment
  "treatment", "treatment_surgery", "treatment_chemo", "treatment_radiation", 
  "treatment_immunotherapy", "treatment_hormonal", "treatment_clinical_trials",
  // Infusion & Orders
  "infusion_orders", "chemo_orders", "infusion_summaries", "dose_adjustments",
  // Labs
  "labs", "labs_cbc", "labs_cmp", "labs_tumor_markers", "labs_other",
  // Oncology Notes
  "oncology_notes", "notes_medical_oncology", "notes_radiation_oncology", 
  "notes_surgical_oncology", "tumor_board_notes",
  // Complications & Side Effects
  "complications", "ed_visits", "hospitalizations", "toxicity_notes", "side_effect_journal",
  // Survivorship
  "survivorship", "survivorship_care_plan", "followup_schedule", "long_term_monitoring",
  // Insurance & Authorizations
  "insurance", "prior_auth", "denials_appeals", "eobs",
  // Other
  "other"
] as const;
export type CancerFolderType = (typeof cancerFolderTypes)[number];

// Cancer Track Folder Hierarchy - Defines parent-child relationships
export interface CancerFolderNode {
  id: CancerFolderType;
  label: string;
  icon?: string;
  children?: CancerFolderNode[];
}

export const CANCER_FOLDER_TAXONOMY: CancerFolderNode[] = [
  {
    id: "diagnosis_pathology",
    label: "Diagnosis & Pathology",
    icon: "Microscope",
    children: [
      { id: "pathology_reports", label: "Pathology Reports", icon: "FileText" },
      { id: "biopsy_results", label: "Biopsy Results", icon: "Syringe" },
      { id: "molecular_biomarkers", label: "Molecular / Biomarkers", icon: "Dna" },
    ],
  },
  {
    id: "imaging",
    label: "Imaging",
    icon: "ScanLine",
    children: [
      { id: "imaging_pet_ct", label: "PET/CT", icon: "ScanLine" },
      { id: "imaging_ct", label: "CT", icon: "ScanLine" },
      { id: "imaging_mri", label: "MRI", icon: "ScanLine" },
      { id: "imaging_ultrasound", label: "Ultrasound", icon: "Radio" },
      { id: "imaging_nuclear", label: "Nuclear Medicine", icon: "Atom" },
    ],
  },
  {
    id: "treatment",
    label: "Treatment",
    icon: "Stethoscope",
    children: [
      { id: "treatment_surgery", label: "Surgery", icon: "Scissors" },
      { id: "treatment_chemo", label: "Chemotherapy", icon: "FlaskConical" },
      { id: "treatment_radiation", label: "Radiation Therapy", icon: "Zap" },
      { id: "treatment_immunotherapy", label: "Immunotherapy / Targeted Therapy", icon: "Shield" },
      { id: "treatment_hormonal", label: "Hormonal Therapy", icon: "Pill" },
      { id: "treatment_clinical_trials", label: "Clinical Trials", icon: "ClipboardList" },
    ],
  },
  {
    id: "infusion_orders",
    label: "Infusion & Orders",
    icon: "Droplets",
    children: [
      { id: "chemo_orders", label: "Chemo Orders", icon: "FileText" },
      { id: "infusion_summaries", label: "Infusion Summaries", icon: "FileText" },
      { id: "dose_adjustments", label: "Dose Adjustments", icon: "Sliders" },
    ],
  },
  {
    id: "labs",
    label: "Labs",
    icon: "TestTube",
    children: [
      { id: "labs_cbc", label: "CBC", icon: "Droplet" },
      { id: "labs_cmp", label: "CMP", icon: "FlaskConical" },
      { id: "labs_tumor_markers", label: "Tumor Markers", icon: "Target" },
      { id: "labs_other", label: "Other Labs", icon: "TestTube" },
    ],
  },
  {
    id: "oncology_notes",
    label: "Oncology Notes",
    icon: "ClipboardList",
    children: [
      { id: "notes_medical_oncology", label: "Medical Oncology Notes", icon: "FileText" },
      { id: "notes_radiation_oncology", label: "Radiation Oncology Notes", icon: "FileText" },
      { id: "notes_surgical_oncology", label: "Surgical Oncology Notes", icon: "FileText" },
      { id: "tumor_board_notes", label: "Tumor Board Notes", icon: "Users" },
    ],
  },
  {
    id: "complications",
    label: "Complications & Side Effects",
    icon: "AlertTriangle",
    children: [
      { id: "ed_visits", label: "ED Visits", icon: "Ambulance" },
      { id: "hospitalizations", label: "Hospitalizations", icon: "Building2" },
      { id: "toxicity_notes", label: "Toxicity Notes", icon: "AlertCircle" },
      { id: "side_effect_journal", label: "Side Effect Journal Exports", icon: "BookOpen" },
    ],
  },
  {
    id: "survivorship",
    label: "Survivorship",
    icon: "Heart",
    children: [
      { id: "survivorship_care_plan", label: "Survivorship Care Plan", icon: "FileHeart" },
      { id: "followup_schedule", label: "Follow-up Schedule", icon: "Calendar" },
      { id: "long_term_monitoring", label: "Long-term Monitoring", icon: "Activity" },
    ],
  },
  {
    id: "insurance",
    label: "Insurance & Authorizations",
    icon: "CreditCard",
    children: [
      { id: "prior_auth", label: "Prior Authorization", icon: "FileCheck" },
      { id: "denials_appeals", label: "Denials / Appeals", icon: "FileX" },
      { id: "eobs", label: "EOBs (Optional)", icon: "Receipt" },
    ],
  },
  {
    id: "other",
    label: "Other",
    icon: "Folder",
  },
];

// Cancer-specific document tags for categorization
export const cancerDocumentTags = [
  // Treatment status
  "active_treatment", "post_treatment", "surveillance", "palliative",
  // Urgency
  "urgent", "routine", "follow_up_required",
  // Document characteristics
  "baseline", "comparison", "final_report", "preliminary",
  // Clinical significance
  "significant_finding", "stable", "progression", "regression", "new_lesion",
  // Insurance status
  "pending_auth", "approved", "denied", "appealing",
  // Care coordination
  "shared_with_provider", "needs_review", "patient_reviewed",
] as const;
export type CancerDocumentTag = (typeof cancerDocumentTags)[number];

export const cancerDocumentTagLabels: Record<CancerDocumentTag, string> = {
  active_treatment: "Active Treatment",
  post_treatment: "Post-Treatment",
  surveillance: "Surveillance",
  palliative: "Palliative",
  urgent: "Urgent",
  routine: "Routine",
  follow_up_required: "Follow-up Required",
  baseline: "Baseline",
  comparison: "Comparison",
  final_report: "Final Report",
  preliminary: "Preliminary",
  significant_finding: "Significant Finding",
  stable: "Stable",
  progression: "Progression",
  regression: "Regression",
  new_lesion: "New Lesion",
  pending_auth: "Pending Authorization",
  approved: "Approved",
  denied: "Denied",
  appealing: "Appealing",
  shared_with_provider: "Shared with Provider",
  needs_review: "Needs Review",
  patient_reviewed: "Patient Reviewed",
};

// ============================================
// MACHINE-FRIENDLY TAGGING SCHEMA
// Consistent, exportable tag format: category:subcategory:value
// ============================================

// 1) Track Tags - Identifies which care track a record belongs to
export const trackTags = [
  "track:cancer",
  "track:peds",
  "track:geriatrics",
  "track:special_needs",
] as const;
export type TrackTag = (typeof trackTags)[number];

export const trackTagLabels: Record<TrackTag, string> = {
  "track:cancer": "Cancer Track",
  "track:peds": "Pediatrics Track",
  "track:geriatrics": "Geriatrics Track",
  "track:special_needs": "Special Needs Track",
};

// 2) Document Type Tags - Identifies document category
export const documentTypeTags = [
  "doc:pathology",
  "doc:imaging",
  "doc:oncology_note",
  "doc:lab",
  "doc:chemo_order",
  "doc:infusion_summary",
  "doc:radiation_summary",
  "doc:surgery_op_note",
  "doc:survivorship_plan",
] as const;
export type DocumentTypeTag = (typeof documentTypeTags)[number];

export const documentTypeTagLabels: Record<DocumentTypeTag, string> = {
  "doc:pathology": "Pathology Report",
  "doc:imaging": "Imaging Study",
  "doc:oncology_note": "Oncology Note",
  "doc:lab": "Lab Results",
  "doc:chemo_order": "Chemo Order",
  "doc:infusion_summary": "Infusion Summary",
  "doc:radiation_summary": "Radiation Summary",
  "doc:surgery_op_note": "Surgery Op Note",
  "doc:survivorship_plan": "Survivorship Plan",
};

// 3) Cancer Specific Tags - Type, Stage, Status (per specification)
export const cancerTypeTags = [
  "cancer:type:breast",
  "cancer:type:colon",
  "cancer:type:lung",
  "cancer:type:lymphoma",
] as const;
export type CancerTypeTag = (typeof cancerTypeTags)[number];

export const cancerStageTags = [
  "cancer:stage:1",
  "cancer:stage:2",
  "cancer:stage:3",
  "cancer:stage:4",
] as const;
export type CancerStageTag = (typeof cancerStageTags)[number];

export const cancerStatusTags = [
  "cancer:status:active_treatment",
  "cancer:status:remission",
  "cancer:status:survivorship",
] as const;
export type CancerStatusTag = (typeof cancerStatusTags)[number];

export const cancerTypeTagLabels: Record<CancerTypeTag, string> = {
  "cancer:type:breast": "Breast Cancer",
  "cancer:type:colon": "Colorectal Cancer",
  "cancer:type:lung": "Lung Cancer",
  "cancer:type:lymphoma": "Lymphoma",
};

export const cancerStageTagLabels: Record<CancerStageTag, string> = {
  "cancer:stage:1": "Stage 1",
  "cancer:stage:2": "Stage 2",
  "cancer:stage:3": "Stage 3",
  "cancer:stage:4": "Stage 4",
};

export const cancerStatusTagLabels: Record<CancerStatusTag, string> = {
  "cancer:status:active_treatment": "Active Treatment",
  "cancer:status:remission": "Remission",
  "cancer:status:survivorship": "Survivorship",
};

// 4) Treatment Tags
export const treatmentTags = [
  "tx:surgery",
  "tx:chemo",
  "tx:radiation",
  "tx:immunotherapy",
  "tx:hormonal",
  "tx:targeted",
  "tx:trial",
] as const;
export type TreatmentTag = (typeof treatmentTags)[number];

export const treatmentTagLabels: Record<TreatmentTag, string> = {
  "tx:surgery": "Surgery",
  "tx:chemo": "Chemotherapy",
  "tx:radiation": "Radiation",
  "tx:immunotherapy": "Immunotherapy",
  "tx:hormonal": "Hormonal Therapy",
  "tx:targeted": "Targeted Therapy",
  "tx:trial": "Clinical Trial",
};

// 5) Phase/Time Tags
export const phaseTags = [
  "phase:diagnosis",
  "phase:treatment",
  "phase:post_treatment",
  "phase:survivorship",
] as const;
export type PhaseTag = (typeof phaseTags)[number];

export const phaseTagLabels: Record<PhaseTag, string> = {
  "phase:diagnosis": "Diagnosis Phase",
  "phase:treatment": "Treatment Phase",
  "phase:post_treatment": "Post-Treatment Phase",
  "phase:survivorship": "Survivorship Phase",
};

// 6) Symptom Tags (for side effects journal - per specification)
export const symptomTags = [
  "sx:fatigue",
  "sx:nausea",
  "sx:neuropathy",
  "sx:insomnia",
  "sx:rash",
  "sx:diarrhea",
  "sx:pain",
  "sx:brain_fog",
] as const;
export type SymptomTag = (typeof symptomTags)[number];

export const symptomTagLabels: Record<SymptomTag, string> = {
  "sx:fatigue": "Fatigue",
  "sx:nausea": "Nausea",
  "sx:neuropathy": "Neuropathy",
  "sx:insomnia": "Insomnia",
  "sx:rash": "Rash",
  "sx:diarrhea": "Diarrhea",
  "sx:pain": "Pain",
  "sx:brain_fog": "Brain Fog",
};

// 7) Follow-up Tags
export const followUpTags = [
  "fu:oncology_visit",
  "fu:imaging",
  "fu:lab",
  "fu:screening",
  "fu:cardiac",
  "fu:bone_health",
] as const;
export type FollowUpTag = (typeof followUpTags)[number];

export const followUpTagLabels: Record<FollowUpTag, string> = {
  "fu:oncology_visit": "Oncology Visit",
  "fu:imaging": "Follow-up Imaging",
  "fu:lab": "Lab Work",
  "fu:screening": "Screening",
  "fu:cardiac": "Cardiac Follow-up",
  "fu:bone_health": "Bone Health",
};

// Combined type for all machine-friendly tags
export type MachineTag = 
  | TrackTag 
  | DocumentTypeTag 
  | CancerTypeTag 
  | CancerStageTag 
  | CancerStatusTag 
  | TreatmentTag 
  | PhaseTag 
  | SymptomTag 
  | FollowUpTag;

// All machine tags combined for validation
export const allMachineTags = [
  ...trackTags,
  ...documentTypeTags,
  ...cancerTypeTags,
  ...cancerStageTags,
  ...cancerStatusTags,
  ...treatmentTags,
  ...phaseTags,
  ...symptomTags,
  ...followUpTags,
] as const;

// Tag categories for UI organization
export interface TagCategory {
  id: string;
  label: string;
  description: string;
  tags: readonly string[];
  labels: Record<string, string>;
}

export const TAG_CATEGORIES: TagCategory[] = [
  {
    id: "track",
    label: "Care Track",
    description: "Which care track this belongs to",
    tags: trackTags,
    labels: trackTagLabels,
  },
  {
    id: "document",
    label: "Document Type",
    description: "Type of medical document",
    tags: documentTypeTags,
    labels: documentTypeTagLabels,
  },
  {
    id: "cancer_type",
    label: "Cancer Type",
    description: "Type of cancer diagnosis",
    tags: cancerTypeTags,
    labels: cancerTypeTagLabels,
  },
  {
    id: "cancer_stage",
    label: "Cancer Stage",
    description: "Cancer staging information",
    tags: cancerStageTags,
    labels: cancerStageTagLabels,
  },
  {
    id: "cancer_status",
    label: "Cancer Status",
    description: "Current treatment status",
    tags: cancerStatusTags,
    labels: cancerStatusTagLabels,
  },
  {
    id: "treatment",
    label: "Treatment Type",
    description: "Type of treatment received",
    tags: treatmentTags,
    labels: treatmentTagLabels,
  },
  {
    id: "phase",
    label: "Care Phase",
    description: "Phase of cancer journey",
    tags: phaseTags,
    labels: phaseTagLabels,
  },
  {
    id: "symptom",
    label: "Symptoms",
    description: "Side effects and symptoms",
    tags: symptomTags,
    labels: symptomTagLabels,
  },
  {
    id: "followup",
    label: "Follow-up Type",
    description: "Type of follow-up appointment",
    tags: followUpTags,
    labels: followUpTagLabels,
  },
];

// Helper function to get tag label
export function getTagLabel(tag: string): string {
  for (const category of TAG_CATEGORIES) {
    if (tag in category.labels) {
      return category.labels[tag];
    }
  }
  return tag;
}

// Helper function to get tag category
export function getTagCategory(tag: string): TagCategory | null {
  const prefix = tag.split(":")[0];
  const categoryMap: Record<string, string> = {
    "track": "track",
    "doc": "document",
    "cancer": tag.includes(":type:") ? "cancer_type" : tag.includes(":stage:") ? "cancer_stage" : "cancer_status",
    "tx": "treatment",
    "phase": "phase",
    "sx": "symptom",
    "fu": "followup",
  };
  const categoryId = categoryMap[prefix];
  return TAG_CATEGORIES.find(c => c.id === categoryId) || null;
}

// Helper function to validate a tag
export function isValidMachineTag(tag: string): boolean {
  return (allMachineTags as readonly string[]).includes(tag);
}

// Helper function to parse tag components
export function parseTag(tag: string): { prefix: string; category?: string; value: string } {
  const parts = tag.split(":");
  if (parts.length === 2) {
    return { prefix: parts[0], value: parts[1] };
  } else if (parts.length === 3) {
    return { prefix: parts[0], category: parts[1], value: parts[2] };
  }
  return { prefix: "", value: tag };
}

// Export all tags as structured data for external systems
export function exportTagSchema(): {
  version: string;
  categories: { id: string; label: string; tags: { id: string; label: string }[] }[];
} {
  return {
    version: "1.0.0",
    categories: TAG_CATEGORIES.map(cat => ({
      id: cat.id,
      label: cat.label,
      tags: (cat.tags as readonly string[]).map(tag => ({
        id: tag,
        label: cat.labels[tag] || tag,
      })),
    })),
  };
}

// Helper function to get folder path from folder type
export function getCancerFolderPath(folderType: CancerFolderType): string[] {
  for (const parent of CANCER_FOLDER_TAXONOMY) {
    if (parent.id === folderType) {
      return [parent.label];
    }
    if (parent.children) {
      for (const child of parent.children) {
        if (child.id === folderType) {
          return [parent.label, child.label];
        }
      }
    }
  }
  return ["Other"];
}

// Helper function to get parent folder type
export function getCancerParentFolder(folderType: CancerFolderType): CancerFolderType | null {
  for (const parent of CANCER_FOLDER_TAXONOMY) {
    if (parent.children) {
      for (const child of parent.children) {
        if (child.id === folderType) {
          return parent.id;
        }
      }
    }
  }
  return null;
}

// Helper to flatten taxonomy for export
export function flattenCancerFolderTaxonomy(): { id: CancerFolderType; path: string; label: string; parentId: CancerFolderType | null }[] {
  const result: { id: CancerFolderType; path: string; label: string; parentId: CancerFolderType | null }[] = [];
  
  for (const parent of CANCER_FOLDER_TAXONOMY) {
    result.push({
      id: parent.id,
      path: `Cancer Track / ${parent.label}`,
      label: parent.label,
      parentId: null,
    });
    
    if (parent.children) {
      for (const child of parent.children) {
        result.push({
          id: child.id,
          path: `Cancer Track / ${parent.label} / ${child.label}`,
          label: child.label,
          parentId: parent.id,
        });
      }
    }
  }
  
  return result;
}

export const insertCancerBasicsSchema = z.object({
  profileId: z.string(),
  cancerType: z.enum(cancerTypes),
  subtype: z.string().optional(),
  stage: z.enum(cancerStages).optional(),
  diagnosisDate: z.string(),
  biomarkers: z.array(z.object({
    name: z.string(),
    value: z.string(),
    status: z.enum(["positive", "negative", "equivocal", "unknown"]),
    testedAt: z.string().optional(),
  })).optional(),
  treatmentCenters: z.array(z.object({
    name: z.string(),
    address: z.string().optional(),
    phone: z.string().optional(),
    isPrimary: z.boolean().default(false),
  })).optional(),
  oncologists: z.array(z.object({
    name: z.string(),
    specialty: z.string().optional(),
    facility: z.string().optional(),
    phone: z.string().optional(),
    isPrimary: z.boolean().default(false),
  })).optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
  inRemission: z.boolean().default(false),
  remissionDate: z.string().optional(),
});

export type InsertCancerBasics = z.infer<typeof insertCancerBasicsSchema>;

export interface CancerBasics extends InsertCancerBasics {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export const insertCancerTimelineEntrySchema = z.object({
  profileId: z.string(),
  cancerId: z.string(),
  treatmentType: z.enum(treatmentTypes),
  title: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  isOngoing: z.boolean().default(false),
  facility: z.string().optional(),
  provider: z.string().optional(),
  details: z.object({
    diagnosisType: z.string().optional(),
    stage: z.string().optional(),
    biomarkers: z.string().optional(),
    pathologyReportId: z.string().optional(),
    surgeryType: z.string().optional(),
    surgeonName: z.string().optional(),
    drugs: z.array(z.string()).optional(),
    cycleNumber: z.number().optional(),
    totalCycles: z.number().optional(),
    radiationSite: z.string().optional(),
    radiationDose: z.string().optional(),
    radiationFractions: z.number().optional(),
    trialName: z.string().optional(),
    trialId: z.string().optional(),
    trialPhase: z.string().optional(),
    outcome: z.string().optional(),
  }).optional(),
  sideEffects: z.array(z.object({
    name: z.string(),
    severity: z.enum(["mild", "moderate", "severe"]),
    startedAt: z.string().optional(),
    resolvedAt: z.string().optional(),
    isOngoing: z.boolean().default(false),
  })).optional(),
  notes: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
});

export type InsertCancerTimelineEntry = z.infer<typeof insertCancerTimelineEntrySchema>;

export interface CancerTimelineEntry extends InsertCancerTimelineEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export const insertCancerDocumentSchema = z.object({
  profileId: z.string(),
  cancerId: z.string(),
  folderType: z.enum(cancerFolderTypes),
  title: z.string(),
  fileName: z.string(),
  fileUrl: z.string().optional(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
  documentDate: z.string(),
  provider: z.string().optional(),
  facility: z.string().optional(),
  summary: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isAutoFiled: z.boolean().default(false),
  linkedTimelineEntryId: z.string().optional(),
});

export type InsertCancerDocument = z.infer<typeof insertCancerDocumentSchema>;

export interface CancerDocument extends InsertCancerDocument {
  id: string;
  uploadedAt: string;
  uploadedBy: string;
}

export const cancerFolderLabels: Record<CancerFolderType, string> = {
  // Diagnosis & Pathology
  diagnosis_pathology: "Diagnosis & Pathology",
  pathology_reports: "Pathology Reports",
  biopsy_results: "Biopsy Results",
  molecular_biomarkers: "Molecular / Biomarkers",
  // Imaging
  imaging: "Imaging",
  imaging_pet_ct: "PET/CT",
  imaging_ct: "CT",
  imaging_mri: "MRI",
  imaging_ultrasound: "Ultrasound",
  imaging_nuclear: "Nuclear Medicine",
  // Treatment
  treatment: "Treatment",
  treatment_surgery: "Surgery",
  treatment_chemo: "Chemotherapy",
  treatment_radiation: "Radiation Therapy",
  treatment_immunotherapy: "Immunotherapy / Targeted Therapy",
  treatment_hormonal: "Hormonal Therapy",
  treatment_clinical_trials: "Clinical Trials",
  // Infusion & Orders
  infusion_orders: "Infusion & Orders",
  chemo_orders: "Chemo Orders",
  infusion_summaries: "Infusion Summaries",
  dose_adjustments: "Dose Adjustments",
  // Labs
  labs: "Labs",
  labs_cbc: "CBC",
  labs_cmp: "CMP",
  labs_tumor_markers: "Tumor Markers",
  labs_other: "Other Labs",
  // Oncology Notes
  oncology_notes: "Oncology Notes",
  notes_medical_oncology: "Medical Oncology Notes",
  notes_radiation_oncology: "Radiation Oncology Notes",
  notes_surgical_oncology: "Surgical Oncology Notes",
  tumor_board_notes: "Tumor Board Notes",
  // Complications & Side Effects
  complications: "Complications & Side Effects",
  ed_visits: "ED Visits",
  hospitalizations: "Hospitalizations",
  toxicity_notes: "Toxicity Notes",
  side_effect_journal: "Side Effect Journal Exports",
  // Survivorship
  survivorship: "Survivorship",
  survivorship_care_plan: "Survivorship Care Plan",
  followup_schedule: "Follow-up Schedule",
  long_term_monitoring: "Long-term Monitoring",
  // Insurance & Authorizations
  insurance: "Insurance & Authorizations",
  prior_auth: "Prior Authorization",
  denials_appeals: "Denials / Appeals",
  eobs: "EOBs (Optional)",
  // Other
  other: "Other",
};

export const treatmentTypeLabels: Record<TreatmentType, string> = {
  diagnosis: "Cancer Diagnosis",
  surgery: "Surgery",
  chemotherapy: "Chemotherapy",
  radiation: "Radiation Therapy",
  immunotherapy: "Immunotherapy",
  hormone_therapy: "Hormone Therapy",
  targeted_therapy: "Targeted Therapy",
  stem_cell_transplant: "Stem Cell Transplant",
  bone_marrow_transplant: "Bone Marrow Transplant",
  clinical_trial: "Clinical Trial",
  palliative_care: "Palliative Care",
  watchful_waiting: "Watchful Waiting",
  other: "Other Treatment",
};

export const cancerTypeLabels: Record<CancerType, string> = {
  breast: "Breast Cancer",
  lung: "Lung Cancer",
  colon: "Colorectal Cancer",
  prostate: "Prostate Cancer",
  melanoma: "Melanoma",
  lymphoma: "Lymphoma",
  leukemia: "Leukemia",
  ovarian: "Ovarian Cancer",
  pancreatic: "Pancreatic Cancer",
  bladder: "Bladder Cancer",
  kidney: "Kidney Cancer",
  liver: "Liver Cancer",
  thyroid: "Thyroid Cancer",
  brain: "Brain Cancer",
  stomach: "Stomach Cancer",
  esophageal: "Esophageal Cancer",
  cervical: "Cervical Cancer",
  uterine: "Uterine Cancer",
  testicular: "Testicular Cancer",
  sarcoma: "Sarcoma",
  multiple_myeloma: "Multiple Myeloma",
  head_neck: "Head & Neck Cancer",
  other: "Other Cancer",
};

// ============================================
// SIDE EFFECTS JOURNAL
// ============================================

export const symptomTypes = [
  "fatigue",
  "neuropathy",
  "nausea",
  "insomnia",
  "brain_fog",
  "diarrhea",
  "rash",
  "mood_changes",
  "pain",
  "swelling",
  "shortness_of_breath",
  "hair_loss",
  "loss_of_appetite",
  "constipation",
  "headache",
  "dizziness",
  "muscle_pain",
  "joint_pain",
  "dry_mouth",
  "weight_change",
  "other",
] as const;

export type SymptomType = (typeof symptomTypes)[number];

export const symptomTypeLabels: Record<SymptomType, string> = {
  fatigue: "Fatigue",
  neuropathy: "Neuropathy (Tingling/Numbness)",
  nausea: "Nausea",
  insomnia: "Insomnia / Sleep Issues",
  brain_fog: "Brain Fog / Cognitive Issues",
  diarrhea: "Diarrhea",
  rash: "Rash / Skin Issues",
  mood_changes: "Mood Changes",
  pain: "Pain",
  swelling: "Swelling",
  shortness_of_breath: "Shortness of Breath",
  hair_loss: "Hair Loss",
  loss_of_appetite: "Loss of Appetite",
  constipation: "Constipation",
  headache: "Headache",
  dizziness: "Dizziness",
  muscle_pain: "Muscle Pain",
  joint_pain: "Joint Pain",
  dry_mouth: "Dry Mouth",
  weight_change: "Weight Change",
  other: "Other",
};

export const severityLevels = ["mild", "moderate", "severe"] as const;
export type SeverityLevel = (typeof severityLevels)[number];

export const severityLabels: Record<SeverityLevel, string> = {
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
};

export const insertMedicationEntrySchema = z.object({
  profileId: z.string(),
  medicationName: z.string(),
  genericName: z.string().optional(),
  dose: z.string(),
  frequency: z.string().optional(),
  indication: z.string().optional(),
  prescriber: z.string().optional(),
  pharmacy: z.string().optional(),
  startDate: z.string(),
  stopDate: z.string().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
});

export type InsertMedicationEntry = z.infer<typeof insertMedicationEntrySchema>;

export interface MedicationEntry extends InsertMedicationEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export const insertSymptomEntrySchema = z.object({
  profileId: z.string(),
  medicationId: z.string(),
  symptomType: z.enum(symptomTypes),
  customSymptomName: z.string().optional(),
  severity: z.enum(severityLevels),
  startDate: z.string(),
  endDate: z.string().optional(),
  isOngoing: z.boolean().default(true),
  improvesAfterDose: z.enum(["yes", "no", "unknown"]).default("unknown"),
  notes: z.string().optional(),
});

export type InsertSymptomEntry = z.infer<typeof insertSymptomEntrySchema>;

export interface SymptomEntry extends InsertSymptomEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// SURVIVORSHIP ENGINE TYPES
// ==========================================

export const survivorshipPhases = ["high_intensity", "medium_intensity", "low_intensity"] as const;
export type SurvivorshipPhase = (typeof survivorshipPhases)[number];

export const survivorshipPhaseLabels: Record<SurvivorshipPhase, string> = {
  high_intensity: "High Intensity (Year 0-1)",
  medium_intensity: "Medium Intensity (Years 2-5)",
  low_intensity: "Low Intensity (Years 5-10+)",
};

export const survivorshipFollowUpFrequencies = ["monthly", "quarterly", "biannually", "annually", "custom"] as const;
export type SurvivorshipFollowUpFrequency = (typeof survivorshipFollowUpFrequencies)[number];

export const survivorshipFollowUpFrequencyLabels: Record<SurvivorshipFollowUpFrequency, string> = {
  monthly: "Monthly",
  quarterly: "Every 3 months",
  biannually: "Every 6 months",
  annually: "Yearly",
  custom: "Custom",
};

export const followUpCategories = [
  "oncology",
  "imaging",
  "lab_work",
  "cardiac",
  "bone_health",
  "skin",
  "endocrine",
  "fertility",
  "mental_health",
  "vaccination",
  "other",
] as const;
export type FollowUpCategory = (typeof followUpCategories)[number];

export const followUpCategoryLabels: Record<FollowUpCategory, string> = {
  oncology: "Oncology Follow-up",
  imaging: "Imaging/Scans",
  lab_work: "Lab Work",
  cardiac: "Cardio-Oncology",
  bone_health: "Bone Health",
  skin: "Skin Checks",
  endocrine: "Endocrine",
  fertility: "Fertility",
  mental_health: "Mental Health",
  vaccination: "Vaccinations",
  other: "Other",
};

export const lateEffectTypes = [
  "neuropathy",
  "cardiomyopathy",
  "cognitive_changes",
  "lymphedema",
  "osteoporosis",
  "hypothyroidism",
  "infertility",
  "secondary_malignancy",
  "fatigue",
  "hearing_loss",
  "pulmonary",
  "dental",
  "vision",
  "other",
] as const;
export type LateEffectType = (typeof lateEffectTypes)[number];

export const lateEffectLabels: Record<LateEffectType, string> = {
  neuropathy: "Peripheral Neuropathy",
  cardiomyopathy: "Cardiomyopathy",
  cognitive_changes: "Cognitive Changes (Chemo Brain)",
  lymphedema: "Lymphedema",
  osteoporosis: "Osteoporosis/Bone Loss",
  hypothyroidism: "Hypothyroidism",
  infertility: "Fertility Issues",
  secondary_malignancy: "Secondary Malignancy Screening",
  fatigue: "Chronic Fatigue",
  hearing_loss: "Hearing Loss",
  pulmonary: "Pulmonary Issues",
  dental: "Dental Issues",
  vision: "Vision Changes",
  other: "Other",
};

export const survivorshipTreatmentTypes = [
  "chemotherapy",
  "radiation",
  "surgery",
  "immunotherapy",
  "hormone_therapy",
  "targeted_therapy",
  "stem_cell_transplant",
  "other",
] as const;
export type SurvivorshipTreatmentType = (typeof survivorshipTreatmentTypes)[number];

export const survivorshipTreatmentTypeLabels: Record<SurvivorshipTreatmentType, string> = {
  chemotherapy: "Chemotherapy",
  radiation: "Radiation Therapy",
  surgery: "Surgery",
  immunotherapy: "Immunotherapy",
  hormone_therapy: "Hormone Therapy",
  targeted_therapy: "Targeted Therapy",
  stem_cell_transplant: "Stem Cell Transplant",
  other: "Other Treatment",
};

export const treatmentLateEffectMap: Record<SurvivorshipTreatmentType, LateEffectType[]> = {
  chemotherapy: ["neuropathy", "cognitive_changes", "fatigue", "infertility", "hearing_loss", "secondary_malignancy"],
  radiation: ["cardiomyopathy", "hypothyroidism", "secondary_malignancy", "pulmonary", "dental", "fatigue"],
  surgery: ["lymphedema", "fatigue"],
  immunotherapy: ["fatigue", "hypothyroidism", "pulmonary"],
  hormone_therapy: ["osteoporosis", "cognitive_changes", "fatigue", "infertility"],
  targeted_therapy: ["cardiomyopathy", "fatigue", "vision"],
  stem_cell_transplant: ["infertility", "secondary_malignancy", "fatigue", "pulmonary"],
  other: [],
};

export const insertSurvivorshipProfileSchema = z.object({
  profileId: z.string(),
  diagnosisDate: z.string(),
  cancerType: z.string(),
  stage: z.string().optional(),
  treatmentEndDate: z.string().optional(),
  treatments: z.array(z.enum(survivorshipTreatmentTypes)).default([]),
  notes: z.string().optional(),
});

export type InsertSurvivorshipProfile = z.infer<typeof insertSurvivorshipProfileSchema>;

export interface SurvivorshipProfile extends InsertSurvivorshipProfile {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export const insertFollowUpScheduleSchema = z.object({
  profileId: z.string(),
  survivorshipProfileId: z.string(),
  title: z.string(),
  category: z.enum(followUpCategories),
  frequency: z.enum(survivorshipFollowUpFrequencies),
  customIntervalDays: z.number().optional(),
  startDate: z.string(),
  nextDueDate: z.string(),
  lastCompletedDate: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type InsertFollowUpSchedule = z.infer<typeof insertFollowUpScheduleSchema>;

export interface FollowUpSchedule extends InsertFollowUpSchedule {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export const insertFollowUpCompletionSchema = z.object({
  profileId: z.string(),
  followUpScheduleId: z.string(),
  completedDate: z.string(),
  notes: z.string().optional(),
  results: z.string().optional(),
});

export type InsertFollowUpCompletion = z.infer<typeof insertFollowUpCompletionSchema>;

export interface FollowUpCompletion extends InsertFollowUpCompletion {
  id: string;
  createdAt: string;
}

export const insertLateEffectWatchlistItemSchema = z.object({
  profileId: z.string(),
  survivorshipProfileId: z.string(),
  effectType: z.enum(lateEffectTypes),
  customEffectName: z.string().optional(),
  relatedTreatment: z.enum(survivorshipTreatmentTypes).optional(),
  severity: z.enum(severityLevels).optional(),
  status: z.enum(["watching", "detected", "resolved"]).default("watching"),
  notes: z.string().optional(),
});

export type InsertLateEffectWatchlistItem = z.infer<typeof insertLateEffectWatchlistItemSchema>;

export interface LateEffectWatchlistItem extends InsertLateEffectWatchlistItem {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// CARE PACKETS TYPES
// ==========================================

export const carePacketTypes = [
  "new_oncologist",
  "er_visit",
  "primary_care",
  "survivorship",
  "specialist",
  "insurance",
] as const;
export type CarePacketType = (typeof carePacketTypes)[number];

export const carePacketLabels: Record<CarePacketType, string> = {
  new_oncologist: "New Oncologist Packet",
  er_visit: "ER Visit Packet",
  primary_care: "Primary Care Packet",
  survivorship: "Survivorship Packet",
  specialist: "Specialist Visit Packet",
  insurance: "Insurance/Prior Auth Packet",
};

export const carePacketDescriptions: Record<CarePacketType, string> = {
  new_oncologist: "Complete cancer history for a new oncology provider",
  er_visit: "Critical information for emergency room staff",
  primary_care: "Summary for your primary care physician",
  survivorship: "Long-term follow-up and monitoring summary",
  specialist: "Relevant history for specialist consultations",
  insurance: "Documentation for insurance or prior authorization",
};

export const carePacketSections = [
  "diagnosis_timeline",
  "current_medications",
  "allergies",
  "recent_labs",
  "recent_imaging",
  "side_effects_highlights",
  "side_effects_detailed",
  "follow_up_schedule",
  "care_team",
  "emergency_contacts",
  "treatment_history",
  "treatment_history_reference",
  "late_effects_watchlist",
] as const;
export type CarePacketSection = (typeof carePacketSections)[number];

export const carePacketSectionLabels: Record<CarePacketSection, string> = {
  diagnosis_timeline: "Diagnosis & Timeline",
  current_medications: "Current Medications",
  allergies: "Allergies & Reactions",
  recent_labs: "Recent Lab Results",
  recent_imaging: "Recent Scans/Imaging",
  side_effects_highlights: "Side Effects Journal Highlights",
  side_effects_detailed: "Detailed Side Effects Analysis",
  follow_up_schedule: "Follow-up Schedule",
  care_team: "Care Team",
  emergency_contacts: "Emergency Contacts",
  treatment_history: "Treatment History",
  treatment_history_reference: "Full Treatment History Reference",
  late_effects_watchlist: "Late Effects Watchlist",
};

export const carePacketContents: Record<CarePacketType, CarePacketSection[]> = {
  new_oncologist: [
    "diagnosis_timeline",
    "treatment_history",
    "treatment_history_reference",
    "current_medications",
    "allergies",
    "recent_labs",
    "recent_imaging",
    "side_effects_detailed",
    "follow_up_schedule",
    "care_team",
  ],
  er_visit: [
    "diagnosis_timeline",
    "current_medications",
    "allergies",
    "recent_labs",
    "recent_imaging",
    "side_effects_detailed",
    "follow_up_schedule",
    "treatment_history",
    "emergency_contacts",
  ],
  primary_care: [
    "diagnosis_timeline",
    "current_medications",
    "allergies",
    "recent_labs",
    "recent_imaging",
    "side_effects_detailed",
    "late_effects_watchlist",
    "follow_up_schedule",
    "treatment_history",
    "care_team",
  ],
  survivorship: [
    "diagnosis_timeline",
    "treatment_history",
    "current_medications",
    "allergies",
    "recent_labs",
    "recent_imaging",
    "side_effects_detailed",
    "late_effects_watchlist",
    "follow_up_schedule",
    "care_team",
  ],
  specialist: [
    "diagnosis_timeline",
    "current_medications",
    "allergies",
    "recent_labs",
    "recent_imaging",
    "side_effects_highlights",
    "follow_up_schedule",
    "treatment_history",
    "care_team",
  ],
  insurance: [
    "diagnosis_timeline",
    "treatment_history",
    "current_medications",
    "allergies",
    "recent_labs",
    "recent_imaging",
    "side_effects_highlights",
    "follow_up_schedule",
    "care_team",
  ],
};

export interface CarePacketData {
  packetType: CarePacketType;
  generatedAt: string;
  patientInfo: {
    name: string;
    dateOfBirth?: string;
    mrn?: string;
  };
  sections: {
    diagnosis_timeline?: {
      diagnosisDate: string;
      cancerType: string;
      stage?: string;
      treatmentEndDate?: string;
      yearsSinceTreatment?: number;
    };
    treatment_history?: Array<{
      type: string;
      name?: string;
      startDate?: string;
      endDate?: string;
      notes?: string;
    }>;
    current_medications?: Array<{
      name: string;
      dose: string;
      frequency?: string;
      indication?: string;
      prescriber?: string;
    }>;
    allergies?: Array<{
      allergen: string;
      reaction?: string;
      severity?: string;
    }>;
    recent_labs?: Array<{
      testName: string;
      value: string;
      date: string;
      status?: string;
    }>;
    recent_imaging?: Array<{
      type: string;
      date: string;
      findings?: string;
    }>;
    side_effects_highlights?: Array<{
      symptom: string;
      severity: string;
      medication?: string;
      status: string;
    }>;
    follow_up_schedule?: Array<{
      title: string;
      category: string;
      nextDue: string;
      frequency: string;
    }>;
    care_team?: Array<{
      name: string;
      role: string;
      specialty?: string;
      phone?: string;
    }>;
    emergency_contacts?: Array<{
      name: string;
      relationship: string;
      phone: string;
      isPrimary?: boolean;
      notes?: string;
    }>;
    side_effects_detailed?: {
      topSymptoms: Array<{
        symptom: string;
        occurrences: number;
        avgSeverity: number;
        trend: "improving" | "stable" | "worsening";
        medication: string;
        firstReported: string;
        lastReported: string;
        notes?: string;
      }>;
      severityTrends: {
        last30Days: { mild: number; moderate: number; severe: number };
        last90Days: { mild: number; moderate: number; severe: number };
        overallTrend: "improving" | "stable" | "worsening";
      };
      totalEntries: number;
      activeMedications: number;
      summary?: string;
    };
    late_effects_watchlist?: Array<{
      effectType: string;
      status: "watching" | "detected" | "resolved";
      riskLevel: "low" | "moderate" | "high";
      relatedTreatments: string[];
      monitoringFrequency: string;
      lastScreening?: string;
      nextScreening?: string;
      notes?: string;
    }>;
    treatment_history_reference?: {
      summary: string;
      totalDocuments: number;
      categories: Array<{ type: string; count: number }>;
      accessInstructions: string;
      portalLink: string;
      lastUpdated: string;
    };
  };
}

// ============================================
// SUPPORT RESOURCES FOR CANCER PATIENTS
// ============================================

export const supportResourceCategories = [
  "advocacy_groups",
  "mental_health",
  "financial_assistance",
  "educational_materials",
  "caregiver_support",
  "community_forums",
  "clinical_trials",
  "nutritional_support",
] as const;

export type SupportResourceCategory = typeof supportResourceCategories[number];

export interface SupportResource {
  id: string;
  name: string;
  description: string;
  category: SupportResourceCategory;
  url: string;
  phone?: string;
  email?: string;
  cancerTypes?: string[];
  stages?: string[];
  languages?: string[];
  isVerified: boolean;
  lastVerified?: string;
  rating?: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export const insertSupportResourceSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(supportResourceCategories),
  url: z.string().url(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  cancerTypes: z.array(z.string()).optional(),
  stages: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  isVerified: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

export type InsertSupportResource = z.infer<typeof insertSupportResourceSchema>;

export interface AIResourceSuggestion {
  id: string;
  resourceId: string;
  resource: SupportResource;
  reason: string;
  relevanceScore: number;
  basedOn: {
    cancerType?: string;
    stage?: string;
    symptoms?: string[];
    lateEffects?: string[];
  };
  suggestedAt: string;
}

// ============================================
// REPORT SCHEDULING SYSTEM
// ============================================

export const reportFrequencies = ["daily", "weekly", "biweekly", "monthly"] as const;
export type ReportFrequency = typeof reportFrequencies[number];

export const reportDataTypes = [
  "vitals",
  "medications",
  "lab_results",
  "appointments",
  "conditions",
  "allergies",
  "immunizations",
  "documents",
  "ai_insights",
  "wearable_data",
] as const;
export type ReportDataType = typeof reportDataTypes[number];

export const reportExportFormats = ["pdf", "csv"] as const;
export type ReportExportFormat = typeof reportExportFormats[number];

export interface ReportSchedule {
  id: string;
  patientId: string;
  profileId?: string;
  name: string;
  frequency: ReportFrequency;
  dataTypes: ReportDataType[];
  exportFormat: ReportExportFormat;
  dateRangeType: "last_7_days" | "last_30_days" | "last_90_days" | "custom";
  customStartDate?: string;
  customEndDate?: string;
  emailRecipients: string[];
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const insertReportScheduleSchema = z.object({
  patientId: z.string().min(1),
  profileId: z.string().optional(),
  name: z.string().min(1).max(100),
  frequency: z.enum(reportFrequencies),
  dataTypes: z.array(z.enum(reportDataTypes)).min(1),
  exportFormat: z.enum(reportExportFormats),
  dateRangeType: z.enum(["last_7_days", "last_30_days", "last_90_days", "custom"]),
  customStartDate: z.string().optional(),
  customEndDate: z.string().optional(),
  emailRecipients: z.array(z.string().email()).min(1),
  isActive: z.boolean().default(true),
});

export type InsertReportSchedule = z.infer<typeof insertReportScheduleSchema>;

// ============================================
// HEALTH DATA SOURCE INTEGRATIONS
// ============================================

export const healthDataSources = [
  "apple_health",
  "google_fit",
  "fitbit",
  "garmin",
  "withings",
  "oura",
  "whoop",
  "fastenhealth",
  "cms_bluebutton",
  "custom_fhir",
] as const;
export type HealthDataSource = typeof healthDataSources[number];

export const integrationConnectionStatuses = [
  "pending",
  "connected",
  "disconnected",
  "error",
  "requires_reauth",
] as const;
export type IntegrationConnectionStatus = typeof integrationConnectionStatuses[number];

export interface CustomFhirServerConfig {
  serverUrl: string;
  serverName: string;
  authType: "none" | "api_key" | "basic" | "oauth2" | "smart_on_fhir";
  apiKey?: string;
  apiKeyHeader?: string;
  basicUsername?: string;
  basicPassword?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  oauthTokenUrl?: string;
  oauthScopes?: string[];
  smartOnFhirLaunchUrl?: string;
  fhirVersion?: "R4" | "STU3" | "DSTU2";
  supportedResources?: string[];
  customHeaders?: Record<string, string>;
  verifySsl?: boolean;
}

export interface IntegrationConnection {
  id: string;
  patientId: string;
  source: HealthDataSource;
  status: IntegrationConnectionStatus;
  displayName: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  scopes: string[];
  lastSyncAt?: string;
  syncErrorMessage?: string;
  consentGrantedAt?: string;
  consentVersion?: string;
  metadata?: Record<string, unknown>;
  customFhirConfig?: CustomFhirServerConfig;
  createdAt: string;
  updatedAt: string;
}

export const insertIntegrationConnectionSchema = z.object({
  patientId: z.string().min(1),
  source: z.enum(healthDataSources),
  displayName: z.string().min(1),
  scopes: z.array(z.string()).default([]),
});

export type InsertIntegrationConnection = z.infer<typeof insertIntegrationConnectionSchema>;

export interface DataSourceSyncResult {
  connectionId: string;
  source: HealthDataSource;
  syncedAt: string;
  recordsImported: number;
  recordTypes: string[];
  errors: string[];
  warnings: string[];
}

// ============================================
// GENERATED REPORTS HISTORY
// ============================================

export interface GeneratedReport {
  id: string;
  patientId: string;
  profileId?: string;
  scheduleId?: string;
  name: string;
  dataTypes: ReportDataType[];
  exportFormat: ReportExportFormat;
  dateRangeStart: string;
  dateRangeEnd: string;
  fileUrl?: string;
  fileSizeBytes?: number;
  generatedAt: string;
  expiresAt?: string;
  downloadCount: number;
  status: "pending" | "generating" | "completed" | "failed";
  errorMessage?: string;
}

export const insertGeneratedReportSchema = z.object({
  patientId: z.string().min(1),
  profileId: z.string().optional(),
  scheduleId: z.string().optional(),
  name: z.string().min(1),
  dataTypes: z.array(z.enum(reportDataTypes)),
  exportFormat: z.enum(reportExportFormats),
  dateRangeStart: z.string(),
  dateRangeEnd: z.string(),
});

export type InsertGeneratedReport = z.infer<typeof insertGeneratedReportSchema>;

// FollowUp - recurring care follow-up tracking
export const followUpCadences = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "biannually",
  "annually",
  "custom"
] as const;
export type FollowUpCadence = (typeof followUpCadences)[number];

export const followUpStatuses = ["active", "paused", "completed", "cancelled"] as const;
export type FollowUpStatus = (typeof followUpStatuses)[number];

export interface FollowUp {
  id: string;
  profileId: string;
  name: string;
  description: string | null;
  cadence: FollowUpCadence;
  customCadenceDays: number | null;   // For custom cadence
  nextDueDate: string;
  lastCompletedDate: string | null;
  status: FollowUpStatus;
  provider: string | null;
  facility: string | null;
  tags: string[];                     // Array of tag IDs
  reminderEnabled: boolean;
  reminderDaysBefore: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const insertFollowUpSchema = z.object({
  profileId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  cadence: z.enum(followUpCadences),
  customCadenceDays: z.number().nullable().optional(),
  nextDueDate: z.string(),
  lastCompletedDate: z.string().nullable().optional(),
  status: z.enum(followUpStatuses).default("active"),
  provider: z.string().nullable().optional(),
  facility: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  reminderEnabled: z.boolean().default(true),
  reminderDaysBefore: z.number().default(7),
  notes: z.string().nullable().optional(),
});

export type InsertFollowUp = z.infer<typeof insertFollowUpSchema>;

// PacketExport - tracking care packet exports
export const packetExportFormats = ["pdf", "zip", "fhir_bundle"] as const;
export type PacketExportFormat = (typeof packetExportFormats)[number];

export const packetExportStatuses = ["pending", "generating", "completed", "failed", "expired"] as const;
export type PacketExportStatus = (typeof packetExportStatuses)[number];

export interface PacketExport {
  id: string;
  profileId: string;
  packetType: string;                 // Type of care packet
  format: PacketExportFormat;
  status: PacketExportStatus;
  sections: string[];                 // Sections included in export
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  expiresAt: string | null;
  downloadCount: number;
  recipientEmail: string | null;      // If shared via email
  recipientName: string | null;
  shareMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export const insertPacketExportSchema = z.object({
  profileId: z.string().min(1),
  packetType: z.string().min(1),
  format: z.enum(packetExportFormats).default("pdf"),
  status: z.enum(packetExportStatuses).default("pending"),
  sections: z.array(z.string()).default([]),
  dateRangeStart: z.string().nullable().optional(),
  dateRangeEnd: z.string().nullable().optional(),
  fileUrl: z.string().nullable().optional(),
  fileSizeBytes: z.number().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  downloadCount: z.number().default(0),
  recipientEmail: z.string().nullable().optional(),
  recipientName: z.string().nullable().optional(),
  shareMessage: z.string().nullable().optional(),
});

export type InsertPacketExport = z.infer<typeof insertPacketExportSchema>;

// Re-export auth models for database schema
export * from "./models/auth";

// Re-export facility models for database schema
export * from "./models/facility";

// Re-export patient experience models for database schema
export * from "./models/patient-experience";

// ============================================
// SUCCESS METRICS ANALYTICS
// ============================================

// Event types for analytics tracking
export const analyticsEventTypes = [
  "packet_export_started",
  "packet_export_completed",
  "document_upload",
  "document_auto_folder_suggested",
  "document_folder_corrected",
  "profile_created",
  "survivorship_followup_scheduled",
  "survivorship_followup_completed",
  "survivorship_followup_missed",
] as const;
export type AnalyticsEventType = (typeof analyticsEventTypes)[number];

export interface AnalyticsEvent {
  id: string;
  eventType: AnalyticsEventType;
  userId: string;
  profileId: string | null;
  metadata: Record<string, unknown>;
  durationMs: number | null;
  createdAt: string;
}

export const insertAnalyticsEventSchema = z.object({
  eventType: z.enum(analyticsEventTypes),
  userId: z.string().min(1),
  profileId: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  durationMs: z.number().nullable().optional(),
});

export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;

// Aggregate metrics for dashboard
export interface SuccessMetrics {
  avgPacketExportTimeMs: number;
  autoFolderAccuracyPercent: number;
  usersWithMultipleProfiles: number;
  totalUsers: number;
  multiProfilePercent: number;
  packetExportsPerUserPerMonth: number;
  survivorshipAdherencePercent: number;
  periodStart: string;
  periodEnd: string;
}

// ============================================
// PATIENT IMMUNIZATION PORTAL
// ============================================

// IIS Consent Management
export const iisConsentStatuses = ["active", "revoked", "expired", "pending"] as const;
export type IISConsentStatus = typeof iisConsentStatuses[number];

export const iisConsentTypes = [
  "full_access",
  "view_only",
  "share_with_providers",
  "research_participation",
] as const;
export type IISConsentType = typeof iisConsentTypes[number];

export interface IISConsent {
  id: string;
  patientId: string;
  consentType: IISConsentType;
  status: IISConsentStatus;
  stateCode: string;
  iisSystemName: string;
  grantedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  revokeReason?: string;
  consentDocument?: string;
  ipAddress?: string;
  userAgent?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const insertIISConsentSchema = z.object({
  patientId: z.string().min(1),
  consentType: z.enum(iisConsentTypes),
  stateCode: z.string().min(2).max(2),
  iisSystemName: z.string().min(1),
  expiresAt: z.string().optional(),
  consentDocument: z.string().optional(),
});

export type InsertIISConsent = z.infer<typeof insertIISConsentSchema>;

// IIS Connection Status
export const iisConnectionStatuses = [
  "connected",
  "disconnected",
  "pending_verification",
  "error",
  "requires_consent",
] as const;
export type IISConnectionStatus = typeof iisConnectionStatuses[number];

export interface IISConnectionState {
  id: string;
  patientId: string;
  stateCode: string;
  iisSystemName: string;
  status: IISConnectionStatus;
  lastSyncAt?: string;
  lastSyncStatus?: "success" | "partial" | "failed";
  recordsCount?: number;
  errorMessage?: string;
  consentId?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Patient Portal Secure Messages (IIS-related)
export const patientPortalMessagePriorities = ["low", "normal", "high", "urgent"] as const;
export type PatientPortalMessagePriority = typeof patientPortalMessagePriorities[number];

export const patientPortalMessageStatuses = ["unread", "read", "archived", "deleted"] as const;
export type PatientPortalMessageStatus = typeof patientPortalMessageStatuses[number];

export const patientPortalMessageCategories = [
  "immunization_reminder",
  "immunization_due",
  "immunization_overdue",
  "iis_notification",
  "consent_request",
  "general",
  "appointment",
  "clinical",
] as const;
export type PatientPortalMessageCategory = typeof patientPortalMessageCategories[number];

export interface PatientPortalMessage {
  id: string;
  patientId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  subject: string;
  body: string;
  category: PatientPortalMessageCategory;
  priority: PatientPortalMessagePriority;
  status: PatientPortalMessageStatus;
  readAt?: string;
  attachments?: {
    id: string;
    name: string;
    type: string;
    size: number;
    url?: string;
  }[];
  relatedImmunizationId?: string;
  relatedConsentId?: string;
  replyToMessageId?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const insertPatientPortalMessageSchema = z.object({
  patientId: z.string().min(1),
  senderId: z.string().min(1),
  senderName: z.string().min(1),
  senderRole: z.string().min(1),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
  category: z.enum(patientPortalMessageCategories).default("general"),
  priority: z.enum(patientPortalMessagePriorities).default("normal"),
  attachments: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    size: z.number(),
    url: z.string().optional(),
  })).optional(),
  relatedImmunizationId: z.string().optional(),
  relatedConsentId: z.string().optional(),
  replyToMessageId: z.string().optional(),
  expiresAt: z.string().optional(),
});

export type InsertPatientPortalMessage = z.infer<typeof insertPatientPortalMessageSchema>;

// Patient Immunization Portal Summary
export interface PatientImmunizationPortalSummary {
  patient: {
    id: string;
    name: string;
    dateOfBirth?: string;
    lastLogin?: string;
  };
  immunizations: {
    total: number;
    upToDate: number;
    overdue: number;
    upcoming: number;
    records: Immunization[];
  };
  iisConnections: {
    activeConsents: number;
    connectedStates: string[];
    connections: IISConnectionState[];
  };
  messages: {
    unread: number;
    total: number;
    recentMessages: PatientPortalMessage[];
  };
  lastUpdated: string;
}

// Secure Link Access Token
export interface SecurePortalAccessToken {
  id: string;
  patientId: string;
  token: string;
  purpose: "one_time_access" | "limited_access" | "caregiver_access";
  expiresAt: string;
  usedAt?: string;
  maxUses: number;
  useCount: number;
  ipRestriction?: string;
  createdBy: string;
  createdAt: string;
}

// ============================================
// AI TREND PARAMETERS & INSIGHT PREFERENCES
// ============================================

export interface TrendParameters {
  sensitivity: "low" | "medium" | "high";
  timeframeDays: number;
  includeOutliers: boolean;
  smoothingLevel: "none" | "light" | "moderate" | "heavy";
  comparisonMode: "absolute" | "percentage" | "standard_deviation";
}

export interface InsightPreferences {
  userId: string;
  detailLevel: "summary" | "standard" | "detailed";
  focusAreas: Array<"medications" | "conditions" | "vitals" | "labs" | "encounters" | "all">;
  language: "simple" | "clinical";
  showConfidenceScores: boolean;
  highlightCritical: boolean;
}

export const DEFAULT_TREND_PARAMETERS: TrendParameters = {
  sensitivity: "medium",
  timeframeDays: 90,
  includeOutliers: true,
  smoothingLevel: "light",
  comparisonMode: "absolute",
};

export const DEFAULT_INSIGHT_PREFERENCES: InsightPreferences = {
  userId: "",
  detailLevel: "standard",
  focusAreas: ["all"],
  language: "simple",
  showConfidenceScores: false,
  highlightCritical: true,
};

// ============================================
// AI AUDIT LOG TYPES
// ============================================

export type AiAuditEventType = 
  | "patient_summary_generated"
  | "risk_stratification_generated"
  | "imaging_analysis_generated"
  | "document_summary_generated"
  | "lab_explanation_generated"
  | "medication_summary_generated"
  | "trend_analysis_generated"
  | "insight_generated"
  | "clinical_documentation_generated"
  | "referral_note_generated"
  | "preventive_care_orders_generated";

export interface AiAuditLogEntry {
  id: string;
  eventType: AiAuditEventType;
  userId: string;
  userRole: UserRole;
  patientId: string;
  sessionId?: string;
  timestamp: string;
  parameters: {
    sensitivity?: string;
    timeframeDays?: number;
    smoothingEnabled?: boolean;
    comparisonMode?: string;
    includeOutliers?: boolean;
    detailLevel?: string;
    language?: string;
    focusAreas?: string[];
    modelUsed?: string;
    promptTokens?: number;
    completionTokens?: number;
    [key: string]: unknown;
  };
  summary: {
    title: string;
    contentPreview: string;
    confidenceScore?: number;
    warningsGenerated?: string[];
    disclaimersIncluded: boolean;
  };
  feedback?: {
    feedbackId: string;
    accuracyRating?: number;
    usefulnessRating?: number;
    isInaccurate?: boolean;
    feedbackTimestamp: string;
  };
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    requestDurationMs?: number;
    cacheHit?: boolean;
    fallbackUsed?: boolean;
  };
}

export interface InsertAiAuditLogEntry {
  eventType: AiAuditEventType;
  userId: string;
  userRole: UserRole;
  patientId: string;
  sessionId?: string;
  parameters: AiAuditLogEntry["parameters"];
  summary: AiAuditLogEntry["summary"];
  metadata?: AiAuditLogEntry["metadata"];
}

export interface AiAuditLogQuery {
  userId?: string;
  patientId?: string;
  eventType?: AiAuditEventType;
  userRole?: UserRole;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface AiAuditLogStats {
  totalEntries: number;
  entriesByType: Record<AiAuditEventType, number>;
  entriesByRole: Record<UserRole, number>;
  avgConfidenceScore: number;
  inaccuracyReportsCount: number;
  avgRequestDurationMs: number;
  cacheHitRate: number;
  periodStart: string;
  periodEnd: string;
}

// ============================================================================
// COMPREHENSIVE CARE PLAN MODULE
// ============================================================================

export const comprehensiveCarePlansTable = pgTable("comprehensive_care_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  providerId: text("provider_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("wellness"),
  status: text("status").notNull().default("draft"),
  startDate: date("start_date").notNull(),
  targetEndDate: date("target_end_date"),
  reviewDate: date("review_date"),
  priorityLevel: text("priority_level").notNull().default("medium"),
  patientAcknowledged: boolean("patient_acknowledged").notNull().default(false),
  patientAcknowledgedAt: timestamp("patient_acknowledged_at", { withTimezone: true }),
  overallProgress: integer("overall_progress").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const carePlanGoalLinksTable = pgTable("care_plan_goal_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  carePlanId: uuid("care_plan_id").notNull().references(() => comprehensiveCarePlansTable.id, { onDelete: "cascade" }),
  healthGoalId: uuid("health_goal_id").notNull().references(() => healthGoalsTable.id, { onDelete: "cascade" }),
  priority: integer("priority").notNull().default(1),
  providerNotes: text("provider_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const carePlanMedicationLinksTable = pgTable("care_plan_medication_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  carePlanId: uuid("care_plan_id").notNull().references(() => comprehensiveCarePlansTable.id, { onDelete: "cascade" }),
  medicationReminderId: uuid("medication_reminder_id").notNull().references(() => medicationRemindersTable.id, { onDelete: "cascade" }),
  dosageInstructions: text("dosage_instructions"),
  providerNotes: text("provider_notes"),
  adherenceTarget: integer("adherence_target").default(90),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const carePlanEducationLinksTable = pgTable("care_plan_education_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  carePlanId: uuid("care_plan_id").notNull().references(() => comprehensiveCarePlansTable.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  contentUrl: text("content_url"),
  aiGenerated: boolean("ai_generated").notNull().default(false),
  priority: integer("priority").notNull().default(1),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  providerNotes: text("provider_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const carePlanMonitoringParamsTable = pgTable("care_plan_monitoring_params", {
  id: uuid("id").defaultRandom().primaryKey(),
  carePlanId: uuid("care_plan_id").notNull().references(() => comprehensiveCarePlansTable.id, { onDelete: "cascade" }),
  vitalType: text("vital_type").notNull(),
  frequency: text("frequency").notNull().default("daily"),
  minThreshold: text("min_threshold"),
  maxThreshold: text("max_threshold"),
  unit: text("unit").notNull(),
  alertOnBreach: boolean("alert_on_breach").notNull().default(true),
  providerNotes: text("provider_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const carePlanProgressNotesTable = pgTable("care_plan_progress_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  carePlanId: uuid("care_plan_id").notNull().references(() => comprehensiveCarePlansTable.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull(),
  authorRole: text("author_role").notNull(),
  noteType: text("note_type").notNull().default("general"),
  content: text("content").notNull(),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const carePlanStatusHistoryTable = pgTable("care_plan_status_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  carePlanId: uuid("care_plan_id").notNull().references(() => comprehensiveCarePlansTable.id, { onDelete: "cascade" }),
  previousStatus: text("previous_status").notNull(),
  newStatus: text("new_status").notNull(),
  changedBy: text("changed_by").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const comprehensiveCarePlanStatuses = ["draft", "pending_approval", "active", "on_hold", "completed", "cancelled"] as const;
export type ComprehensiveCarePlanStatus = typeof comprehensiveCarePlanStatuses[number];

export const comprehensiveCarePlanCategories = ["chronic_disease", "post_surgical", "preventive", "mental_health", "rehabilitation", "palliative", "wellness", "medication_management", "other"] as const;
export type ComprehensiveCarePlanCategory = typeof comprehensiveCarePlanCategories[number];

export const comprehensiveCarePlanPriorityLevels = ["low", "medium", "high", "critical"] as const;
export type ComprehensiveCarePlanPriorityLevel = typeof comprehensiveCarePlanPriorityLevels[number];

export const remoteMonitoringFrequencies = ["hourly", "twice_daily", "daily", "twice_weekly", "weekly", "biweekly", "monthly", "as_needed"] as const;
export type RemoteMonitoringFrequency = typeof remoteMonitoringFrequencies[number];

export const carePlanProgressNoteTypes = ["general", "provider_update", "patient_update", "milestone", "concern", "adjustment"] as const;
export type CarePlanProgressNoteType = typeof carePlanProgressNoteTypes[number];

export const carePlanEducationContentTypes = ["article", "video", "quiz", "checklist", "infographic", "external_link"] as const;
export type CarePlanEducationContentType = typeof carePlanEducationContentTypes[number];

export const insertComprehensiveCarePlanSchema = z.object({
  profileId: z.string().uuid(),
  providerId: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.enum(comprehensiveCarePlanCategories).default("wellness"),
  status: z.enum(comprehensiveCarePlanStatuses).default("draft"),
  startDate: z.string(),
  targetEndDate: z.string().optional(),
  reviewDate: z.string().optional(),
  priorityLevel: z.enum(comprehensiveCarePlanPriorityLevels).default("medium"),
  notes: z.string().optional(),
});

export type InsertComprehensiveCarePlan = z.infer<typeof insertComprehensiveCarePlanSchema>;
export type ComprehensiveCarePlan = typeof comprehensiveCarePlansTable.$inferSelect;

export const insertCarePlanGoalLinkSchema = z.object({
  carePlanId: z.string().uuid(),
  healthGoalId: z.string().uuid(),
  priority: z.number().int().min(1).max(10).default(1),
  providerNotes: z.string().optional(),
});

export type InsertCarePlanGoalLink = z.infer<typeof insertCarePlanGoalLinkSchema>;
export type CarePlanGoalLink = typeof carePlanGoalLinksTable.$inferSelect;

export const insertCarePlanMedicationLinkSchema = z.object({
  carePlanId: z.string().uuid(),
  medicationReminderId: z.string().uuid(),
  dosageInstructions: z.string().optional(),
  providerNotes: z.string().optional(),
  adherenceTarget: z.number().int().min(0).max(100).default(90),
});

export type InsertCarePlanMedicationLink = z.infer<typeof insertCarePlanMedicationLinkSchema>;
export type CarePlanMedicationLink = typeof carePlanMedicationLinksTable.$inferSelect;

export const insertCarePlanEducationLinkSchema = z.object({
  carePlanId: z.string().uuid(),
  contentType: z.enum(carePlanEducationContentTypes),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  contentUrl: z.string().url().optional(),
  aiGenerated: z.boolean().default(false),
  priority: z.number().int().min(1).max(10).default(1),
  providerNotes: z.string().optional(),
});

export type InsertCarePlanEducationLink = z.infer<typeof insertCarePlanEducationLinkSchema>;
export type CarePlanEducationLink = typeof carePlanEducationLinksTable.$inferSelect;

export const insertCarePlanMonitoringParamSchema = z.object({
  carePlanId: z.string().uuid(),
  vitalType: z.string(),
  frequency: z.enum(remoteMonitoringFrequencies).default("daily"),
  minThreshold: z.string().optional(),
  maxThreshold: z.string().optional(),
  unit: z.string(),
  alertOnBreach: z.boolean().default(true),
  providerNotes: z.string().optional(),
});

export type InsertCarePlanMonitoringParam = z.infer<typeof insertCarePlanMonitoringParamSchema>;
export type CarePlanMonitoringParam = typeof carePlanMonitoringParamsTable.$inferSelect;

export const insertCarePlanProgressNoteSchema = z.object({
  carePlanId: z.string().uuid(),
  authorId: z.string(),
  authorRole: z.string(),
  noteType: z.enum(carePlanProgressNoteTypes).default("general"),
  content: z.string().min(1),
  attachmentUrl: z.string().url().optional(),
});

export type InsertCarePlanProgressNote = z.infer<typeof insertCarePlanProgressNoteSchema>;
export type CarePlanProgressNote = typeof carePlanProgressNotesTable.$inferSelect;

// ============================================
// Patient-Reported Outcomes (PRO) Tables
// ============================================

export const outcomeReportTypes = ["treatment_outcome", "care_plan_experience", "quality_of_life", "symptom_assessment", "satisfaction_survey", "general_experience"] as const;
export type OutcomeReportType = typeof outcomeReportTypes[number];

export const patientOutcomeReportsTable = pgTable("patient_outcome_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id),
  reportType: text("report_type").notNull().$type<OutcomeReportType>(),
  relatedCarePlanId: uuid("related_care_plan_id").references(() => comprehensiveCarePlansTable.id),
  relatedTreatmentId: text("related_treatment_id"),
  qualityOfLifeRating: integer("quality_of_life_rating"),
  symptomSeverityRating: integer("symptom_severity_rating"),
  satisfactionRating: integer("satisfaction_rating"),
  overallWellbeingRating: integer("overall_wellbeing_rating"),
  painLevel: integer("pain_level"),
  energyLevel: integer("energy_level"),
  moodRating: integer("mood_rating"),
  sleepQualityRating: integer("sleep_quality_rating"),
  dailyFunctioningRating: integer("daily_functioning_rating"),
  treatmentEffectivenessRating: integer("treatment_effectiveness_rating"),
  sideEffectsReported: text("side_effects_reported"),
  improvementAreas: text("improvement_areas"),
  concernsNotes: text("concerns_notes"),
  additionalComments: text("additional_comments"),
  wouldRecommend: boolean("would_recommend"),
  reportPeriodStart: timestamp("report_period_start", { withTimezone: true }),
  reportPeriodEnd: timestamp("report_period_end", { withTimezone: true }),
  providerReviewed: boolean("provider_reviewed").default(false),
  providerReviewedAt: timestamp("provider_reviewed_at", { withTimezone: true }),
  providerReviewedBy: text("provider_reviewed_by"),
  providerNotes: text("provider_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const patientSymptomLogsTable = pgTable("patient_symptom_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id),
  outcomeReportId: uuid("outcome_report_id").references(() => patientOutcomeReportsTable.id),
  symptomName: text("symptom_name").notNull(),
  severity: integer("severity").notNull(),
  frequency: text("frequency"),
  duration: text("duration"),
  triggerFactors: text("trigger_factors"),
  reliefMeasures: text("relief_measures"),
  impactOnDaily: text("impact_on_daily"),
  notes: text("notes"),
  loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
});

export const patientExperienceFeedbackTable = pgTable("patient_experience_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id),
  outcomeReportId: uuid("outcome_report_id").references(() => patientOutcomeReportsTable.id),
  feedbackCategory: text("feedback_category").notNull(),
  rating: integer("rating").notNull(),
  feedbackText: text("feedback_text"),
  isAnonymous: boolean("is_anonymous").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPatientOutcomeReportSchema = z.object({
  profileId: z.string().uuid(),
  reportType: z.enum(outcomeReportTypes),
  relatedCarePlanId: z.string().uuid().optional(),
  relatedTreatmentId: z.string().optional(),
  qualityOfLifeRating: z.number().int().min(1).max(10).optional(),
  symptomSeverityRating: z.number().int().min(1).max(10).optional(),
  satisfactionRating: z.number().int().min(1).max(10).optional(),
  overallWellbeingRating: z.number().int().min(1).max(10).optional(),
  painLevel: z.number().int().min(0).max(10).optional(),
  energyLevel: z.number().int().min(1).max(10).optional(),
  moodRating: z.number().int().min(1).max(10).optional(),
  sleepQualityRating: z.number().int().min(1).max(10).optional(),
  dailyFunctioningRating: z.number().int().min(1).max(10).optional(),
  treatmentEffectivenessRating: z.number().int().min(1).max(10).optional(),
  sideEffectsReported: z.string().optional(),
  improvementAreas: z.string().optional(),
  concernsNotes: z.string().optional(),
  additionalComments: z.string().optional(),
  wouldRecommend: z.boolean().optional(),
  reportPeriodStart: z.string().optional(),
  reportPeriodEnd: z.string().optional(),
});

export type InsertPatientOutcomeReport = z.infer<typeof insertPatientOutcomeReportSchema>;
export type PatientOutcomeReport = typeof patientOutcomeReportsTable.$inferSelect;

export const insertPatientSymptomLogSchema = z.object({
  profileId: z.string().uuid(),
  outcomeReportId: z.string().uuid().optional(),
  symptomName: z.string().min(1).max(200),
  severity: z.number().int().min(1).max(10),
  frequency: z.string().optional(),
  duration: z.string().optional(),
  triggerFactors: z.string().optional(),
  reliefMeasures: z.string().optional(),
  impactOnDaily: z.string().optional(),
  notes: z.string().optional(),
});

export type InsertPatientSymptomLog = z.infer<typeof insertPatientSymptomLogSchema>;
export type PatientSymptomLog = typeof patientSymptomLogsTable.$inferSelect;

export const insertPatientExperienceFeedbackSchema = z.object({
  profileId: z.string().uuid(),
  outcomeReportId: z.string().uuid().optional(),
  feedbackCategory: z.string().min(1).max(100),
  rating: z.number().int().min(1).max(5),
  feedbackText: z.string().optional(),
  isAnonymous: z.boolean().optional(),
});

export type InsertPatientExperienceFeedback = z.infer<typeof insertPatientExperienceFeedbackSchema>;
export type PatientExperienceFeedback = typeof patientExperienceFeedbackTable.$inferSelect;

// ============================================
// Patient Engagement Module Tables
// ============================================

export const messageThreadStatuses = ["active", "archived", "closed"] as const;
export type MessageThreadStatus = typeof messageThreadStatuses[number];

export const messageThreadCategories = ["general", "prescription_request", "appointment", "lab_results", "billing", "urgent", "follow_up"] as const;
export type MessageThreadCategory = typeof messageThreadCategories[number];

export const engagementMessageThreadsTable = pgTable("engagement_message_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientProfileId: uuid("patient_profile_id").notNull().references(() => profiles.id),
  providerUserId: text("provider_user_id").notNull(),
  providerName: text("provider_name").notNull(),
  subject: text("subject").notNull(),
  category: text("category").notNull().$type<MessageThreadCategory>(),
  status: text("status").notNull().$type<MessageThreadStatus>().default("active"),
  priority: text("priority").$type<"low" | "normal" | "high" | "urgent">().default("normal"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  patientUnreadCount: integer("patient_unread_count").default(0),
  providerUnreadCount: integer("provider_unread_count").default(0),
  isEncrypted: boolean("is_encrypted").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const engagementMessagesTable = pgTable("engagement_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: uuid("thread_id").notNull().references(() => engagementMessageThreadsTable.id),
  senderType: text("sender_type").notNull().$type<"patient" | "provider" | "system">(),
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"),
  attachmentName: text("attachment_name"),
  isSystemGenerated: boolean("is_system_generated").default(false),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const appointmentScheduleStatuses = ["pending", "confirmed", "checked_in", "in_progress", "completed", "cancelled", "no_show", "rescheduled"] as const;
export type AppointmentScheduleStatus = typeof appointmentScheduleStatuses[number];

export const appointmentScheduleTypes = ["checkup", "follow_up", "urgent", "telehealth", "procedure", "vaccination", "lab_work", "specialist", "therapy", "consultation"] as const;
export type AppointmentScheduleType = typeof appointmentScheduleTypes[number];

export const engagementAppointmentsTable = pgTable("engagement_appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientProfileId: uuid("patient_profile_id").notNull().references(() => profiles.id),
  providerUserId: text("provider_user_id").notNull(),
  providerName: text("provider_name").notNull(),
  providerSpecialty: text("provider_specialty"),
  appointmentType: text("appointment_type").notNull().$type<AppointmentScheduleType>(),
  status: text("status").notNull().$type<AppointmentScheduleStatus>().default("pending"),
  scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
  scheduledEndDate: timestamp("scheduled_end_date", { withTimezone: true }),
  durationMinutes: integer("duration_minutes").default(30),
  location: text("location"),
  locationAddress: text("location_address"),
  isTelehealth: boolean("is_telehealth").default(false),
  telehealthLink: text("telehealth_link"),
  reasonForVisit: text("reason_for_visit"),
  patientNotes: text("patient_notes"),
  providerNotes: text("provider_notes"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledBy: text("cancelled_by"),
  cancellationReason: text("cancellation_reason"),
  rescheduledFromId: uuid("rescheduled_from_id"),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const engagementAppointmentRemindersTable = pgTable("engagement_appointment_reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  appointmentId: uuid("appointment_id").notNull().references(() => engagementAppointmentsTable.id),
  patientProfileId: uuid("patient_profile_id").notNull().references(() => profiles.id),
  reminderType: text("reminder_type").notNull().$type<"24_hours" | "2_hours" | "30_minutes" | "custom">(),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  channel: text("channel").notNull().$type<ReminderChannel>(),
  isSent: boolean("is_sent").default(false),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  isAcknowledged: boolean("is_acknowledged").default(false),
  acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const engagementRewardTypes = ["badge", "points", "streak_bonus", "level_up", "milestone", "challenge_complete"] as const;
export type EngagementRewardType = typeof engagementRewardTypes[number];

export const engagementRewardCategories = ["medication_adherence", "appointment_attendance", "goal_achievement", "health_tracking", "education", "messaging", "general"] as const;
export type EngagementRewardCategory = typeof engagementRewardCategories[number];

export const engagementRewardsTable = pgTable("engagement_rewards", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientProfileId: uuid("patient_profile_id").notNull().references(() => profiles.id),
  rewardType: text("reward_type").notNull().$type<EngagementRewardType>(),
  category: text("category").notNull().$type<EngagementRewardCategory>(),
  name: text("name").notNull(),
  description: text("description"),
  pointsEarned: integer("points_earned").default(0),
  badgeId: text("badge_id"),
  badgeIcon: text("badge_icon"),
  badgeColor: text("badge_color"),
  triggerAction: text("trigger_action"),
  triggerEntityId: text("trigger_entity_id"),
  streakDays: integer("streak_days"),
  isNotified: boolean("is_notified").default(false),
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
  earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const engagementStreaksTable = pgTable("engagement_streaks", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientProfileId: uuid("patient_profile_id").notNull().references(() => profiles.id),
  category: text("category").notNull().$type<EngagementRewardCategory>(),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  lastActivityDate: timestamp("last_activity_date", { withTimezone: true }),
  streakStartDate: timestamp("streak_start_date", { withTimezone: true }),
  totalActiveDays: integer("total_active_days").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const engagementPointsLedgerTable = pgTable("engagement_points_ledger", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientProfileId: uuid("patient_profile_id").notNull().references(() => profiles.id),
  transactionType: text("transaction_type").notNull().$type<"earned" | "spent" | "bonus" | "expired" | "adjusted">(),
  amount: integer("amount").notNull(),
  balance: integer("balance").notNull(),
  source: text("source").notNull(),
  sourceId: text("source_id"),
  description: text("description"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Insert schemas
export const insertEngagementMessageThreadSchema = z.object({
  patientProfileId: z.string().uuid(),
  providerUserId: z.string(),
  providerName: z.string().min(1).max(200),
  subject: z.string().min(1).max(500),
  category: z.enum(messageThreadCategories).default("general"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

export type InsertEngagementMessageThread = z.infer<typeof insertEngagementMessageThreadSchema>;
export type EngagementMessageThread = typeof engagementMessageThreadsTable.$inferSelect;

export const insertEngagementMessageSchema = z.object({
  threadId: z.string().uuid(),
  senderType: z.enum(["patient", "provider", "system"]),
  senderId: z.string(),
  senderName: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
  attachmentUrl: z.string().url().optional(),
  attachmentType: z.string().optional(),
  attachmentName: z.string().optional(),
  isSystemGenerated: z.boolean().optional(),
});

export type InsertEngagementMessage = z.infer<typeof insertEngagementMessageSchema>;
export type EngagementMessage = typeof engagementMessagesTable.$inferSelect;

export const insertEngagementAppointmentSchema = z.object({
  patientProfileId: z.string().uuid(),
  providerUserId: z.string(),
  providerName: z.string().min(1).max(200),
  providerSpecialty: z.string().optional(),
  appointmentType: z.enum(appointmentScheduleTypes),
  scheduledDate: z.string(),
  scheduledEndDate: z.string().optional(),
  durationMinutes: z.number().int().min(5).max(480).default(30),
  location: z.string().optional(),
  locationAddress: z.string().optional(),
  isTelehealth: z.boolean().default(false),
  telehealthLink: z.string().url().optional(),
  reasonForVisit: z.string().max(1000).optional(),
  patientNotes: z.string().max(2000).optional(),
});

export type InsertEngagementAppointment = z.infer<typeof insertEngagementAppointmentSchema>;
export type EngagementAppointment = typeof engagementAppointmentsTable.$inferSelect;

export const insertEngagementReminderSchema = z.object({
  appointmentId: z.string().uuid(),
  patientProfileId: z.string().uuid(),
  reminderType: z.enum(["24_hours", "2_hours", "30_minutes", "custom"]),
  scheduledFor: z.string(),
  channel: z.enum(reminderChannels),
});

export type InsertEngagementReminder = z.infer<typeof insertEngagementReminderSchema>;
export type EngagementAppointmentReminder = typeof engagementAppointmentRemindersTable.$inferSelect;

export const insertEngagementRewardSchema = z.object({
  patientProfileId: z.string().uuid(),
  rewardType: z.enum(engagementRewardTypes),
  category: z.enum(engagementRewardCategories),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  pointsEarned: z.number().int().min(0).default(0),
  badgeId: z.string().optional(),
  badgeIcon: z.string().optional(),
  badgeColor: z.string().optional(),
  triggerAction: z.string().optional(),
  triggerEntityId: z.string().optional(),
  streakDays: z.number().int().optional(),
});

export type InsertEngagementReward = z.infer<typeof insertEngagementRewardSchema>;
export type EngagementReward = typeof engagementRewardsTable.$inferSelect;

// ============================================
// MONETIZATION & BILLING TABLES
// ============================================

// Subscription tier types
export const subscriptionTiers = ["free", "pro", "concierge", "enterprise"] as const;
export type SubscriptionTier = typeof subscriptionTiers[number];

export const subscriptionStatuses = ["active", "cancelled", "past_due", "trialing", "paused"] as const;
export type SubscriptionStatus = typeof subscriptionStatuses[number];

export const billingCycles = ["monthly", "annual"] as const;
export type BillingCycle = typeof billingCycles[number];

export const organizationTypes = ["consumer", "concierge_practice", "aco", "ma_plan", "enterprise"] as const;
export type OrganizationType = typeof organizationTypes[number];

// Organizations table for B2B customers
export const organizationsTable = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").notNull().$type<OrganizationType>(),
  domain: text("domain"),
  logoUrl: text("logo_url"),
  primaryContactEmail: text("primary_contact_email").notNull(),
  primaryContactName: text("primary_contact_name"),
  billingEmail: text("billing_email"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  state: text("state"),
  postalCode: text("postal_code"),
  country: text("country").default("US"),
  taxId: text("tax_id"),
  stripeCustomerId: text("stripe_customer_id"),
  ssoEnabled: boolean("sso_enabled").default(false),
  ssoProvider: text("sso_provider"),
  ssoConfig: jsonb("sso_config").$type<Record<string, unknown>>(),
  whiteLabeling: jsonb("white_labeling").$type<{
    enabled: boolean;
    brandName?: string;
    primaryColor?: string;
    secondaryColor?: string;
    logoUrl?: string;
    faviconUrl?: string;
    customDomain?: string;
  }>(),
  contractStartDate: timestamp("contract_start_date", { withTimezone: true }),
  contractEndDate: timestamp("contract_end_date", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Subscription plans table
export const subscriptionPlansTable = pgTable("subscription_plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  tier: text("tier").notNull().$type<SubscriptionTier>(),
  description: text("description"),
  targetAudience: text("target_audience").$type<OrganizationType>(),
  priceMonthly: integer("price_monthly").notNull(), // in cents
  priceAnnual: integer("price_annual"), // in cents
  pricePerProvider: integer("price_per_provider"), // for concierge practices
  pricePmpm: integer("price_pmpm"), // per member per month for ACOs/MA plans
  features: jsonb("features").$type<{
    maxProfiles: number;
    advancedPacketSharing: boolean;
    carePathways: boolean;
    iotIntegration: boolean;
    aiAssistant: boolean;
    telehealth: boolean;
    prioritySupport: boolean;
    customAuditExports: boolean;
    apiAccess: boolean;
    whiteLabeling: boolean;
    sso: boolean;
    dedicatedAccountManager: boolean;
    intakeTools: boolean;
    outcomeTracking: boolean;
    populationHealth: boolean;
  }>().notNull(),
  trialDays: integer("trial_days").default(14),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  stripePriceIdMonthly: text("stripe_price_id_monthly"),
  stripePriceIdAnnual: text("stripe_price_id_annual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// User subscriptions table
export const subscriptionsTable = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").notNull().references(() => subscriptionPlansTable.id),
  status: text("status").notNull().$type<SubscriptionStatus>().default("active"),
  billingCycle: text("billing_cycle").notNull().$type<BillingCycle>().default("monthly"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }).notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }).notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancellationReason: text("cancellation_reason"),
  trialStart: timestamp("trial_start", { withTimezone: true }),
  trialEnd: timestamp("trial_end", { withTimezone: true }),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  // For B2B pricing
  providerCount: integer("provider_count"),
  memberCount: integer("member_count"), // for PMPM pricing
  // Enterprise add-ons
  addons: jsonb("addons").$type<{
    whiteLabeling?: boolean;
    sso?: boolean;
    customAuditExports?: boolean;
    dedicatedSupport?: boolean;
    customIntegrations?: boolean;
  }>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Organization members table
export const organizationMembersTable = pgTable("organization_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  role: text("role").notNull().$type<"owner" | "admin" | "provider" | "staff" | "member">(),
  isProvider: boolean("is_provider").default(false),
  providerNpi: text("provider_npi"),
  providerSpecialty: text("provider_specialty"),
  invitedBy: uuid("invited_by").references(() => accounts.id),
  invitedAt: timestamp("invited_at", { withTimezone: true }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Invoices table
export const invoicesTable = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id").notNull().references(() => subscriptionsTable.id),
  organizationId: uuid("organization_id").references(() => organizationsTable.id),
  accountId: uuid("account_id").references(() => accounts.id),
  invoiceNumber: text("invoice_number").notNull(),
  status: text("status").notNull().$type<"draft" | "open" | "paid" | "void" | "uncollectible">(),
  subtotal: integer("subtotal").notNull(), // in cents
  tax: integer("tax").default(0),
  total: integer("total").notNull(),
  currency: text("currency").default("usd"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  stripeInvoiceId: text("stripe_invoice_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  lineItems: jsonb("line_items").$type<Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>>(),
  billingPeriodStart: timestamp("billing_period_start", { withTimezone: true }),
  billingPeriodEnd: timestamp("billing_period_end", { withTimezone: true }),
  notes: text("notes"),
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Payment methods table
export const paymentMethodsTable = pgTable("payment_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  stripePaymentMethodId: text("stripe_payment_method_id").notNull(),
  type: text("type").notNull().$type<"card" | "bank_account" | "us_bank_account">(),
  isDefault: boolean("is_default").default(false),
  cardBrand: text("card_brand"),
  cardLast4: text("card_last_4"),
  cardExpMonth: integer("card_exp_month"),
  cardExpYear: integer("card_exp_year"),
  bankName: text("bank_name"),
  bankLast4: text("bank_last_4"),
  billingName: text("billing_name"),
  billingEmail: text("billing_email"),
  billingAddress: jsonb("billing_address").$type<{
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Usage tracking for PMPM/outcome-based billing
export const usageMetricsTable = pgTable("usage_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  subscriptionId: uuid("subscription_id").notNull().references(() => subscriptionsTable.id),
  metricType: text("metric_type").notNull().$type<
    "active_members" | "provider_count" | "api_calls" | "storage_gb" |
    "reduced_duplicate_tests" | "improved_care_transitions" | "cost_savings"
  >(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  value: integer("value").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Outcome tracking for ACO/MA plans
export const outcomeTrackingTable = pgTable("outcome_tracking", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  subscriptionId: uuid("subscription_id").notNull().references(() => subscriptionsTable.id),
  measureType: text("measure_type").notNull().$type<
    "duplicate_test_reduction" | "care_transition_success" | "medication_adherence" |
    "er_visit_reduction" | "readmission_reduction" | "preventive_care_completion"
  >(),
  baselineValue: integer("baseline_value"),
  targetValue: integer("target_value"),
  currentValue: integer("current_value"),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  achievedAt: timestamp("achieved_at", { withTimezone: true }),
  incentiveAmount: integer("incentive_amount"), // bonus/rebate in cents
  notes: text("notes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Feature flags and entitlements
export const featureEntitlementsTable = pgTable("feature_entitlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id").references(() => subscriptionsTable.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  featureKey: text("feature_key").notNull(),
  isEnabled: boolean("is_enabled").default(true),
  limitValue: integer("limit_value"),
  usedValue: integer("used_value").default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  grantedBy: text("granted_by"),
  grantReason: text("grant_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Audit export requests for enterprise
export const auditExportRequestsTable = pgTable("audit_export_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id),
  requestedBy: uuid("requested_by").notNull().references(() => accounts.id),
  exportType: text("export_type").notNull().$type<"full" | "date_range" | "custom">(),
  format: text("format").notNull().$type<"csv" | "json" | "pdf">(),
  dateRangeStart: timestamp("date_range_start", { withTimezone: true }),
  dateRangeEnd: timestamp("date_range_end", { withTimezone: true }),
  filters: jsonb("filters").$type<Record<string, unknown>>(),
  status: text("status").notNull().$type<"pending" | "processing" | "completed" | "failed">(),
  fileUrl: text("file_url"),
  fileSize: integer("file_size"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Insert schemas for monetization
export const insertOrganizationSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(organizationTypes),
  domain: z.string().optional(),
  primaryContactEmail: z.string().email(),
  primaryContactName: z.string().optional(),
  billingEmail: z.string().email().optional(),
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;

export const insertSubscriptionPlanSchema = z.object({
  name: z.string().min(1).max(100),
  tier: z.enum(subscriptionTiers),
  description: z.string().optional(),
  targetAudience: z.enum(organizationTypes).optional(),
  priceMonthly: z.number().int().min(0),
  priceAnnual: z.number().int().min(0).optional(),
  pricePerProvider: z.number().int().min(0).optional(),
  pricePmpm: z.number().int().min(0).optional(),
  features: z.object({
    maxProfiles: z.number().int().min(1),
    advancedPacketSharing: z.boolean(),
    carePathways: z.boolean(),
    iotIntegration: z.boolean(),
    aiAssistant: z.boolean(),
    telehealth: z.boolean(),
    prioritySupport: z.boolean(),
    customAuditExports: z.boolean(),
    apiAccess: z.boolean(),
    whiteLabeling: z.boolean(),
    sso: z.boolean(),
    dedicatedAccountManager: z.boolean(),
    intakeTools: z.boolean(),
    outcomeTracking: z.boolean(),
    populationHealth: z.boolean(),
  }),
  trialDays: z.number().int().min(0).optional(),
});

export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlansTable.$inferSelect;

export const insertSubscriptionSchema = z.object({
  accountId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  planId: z.string().uuid(),
  billingCycle: z.enum(billingCycles).default("monthly"),
  providerCount: z.number().int().min(1).optional(),
  memberCount: z.number().int().min(1).optional(),
});

export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;

export const insertOrganizationMemberSchema = z.object({
  organizationId: z.string().uuid(),
  accountId: z.string().uuid(),
  role: z.enum(["owner", "admin", "provider", "staff", "member"]),
  isProvider: z.boolean().optional(),
  providerNpi: z.string().optional(),
  providerSpecialty: z.string().optional(),
});

export type InsertOrganizationMember = z.infer<typeof insertOrganizationMemberSchema>;
export type OrganizationMember = typeof organizationMembersTable.$inferSelect;

export const insertAuditExportRequestSchema = z.object({
  organizationId: z.string().uuid(),
  requestedBy: z.string().uuid(),
  exportType: z.enum(["full", "date_range", "custom"]),
  format: z.enum(["csv", "json", "pdf"]),
  dateRangeStart: z.string().datetime().optional(),
  dateRangeEnd: z.string().datetime().optional(),
  filters: z.record(z.unknown()).optional(),
});

export type InsertAuditExportRequest = z.infer<typeof insertAuditExportRequestSchema>;
export type AuditExportRequest = typeof auditExportRequestsTable.$inferSelect;

// H5 — Audit-of-audit: who looked at the audit data, when, and what they queried.
// Append-only enforced at the DB layer via trigger (see .local/migrations/h5_audit_access_log.sql).
export const auditAccessLogTable = pgTable("audit_access_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id"),
  email: text("email"),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  query: jsonb("query").$type<Record<string, unknown>>(),
  statusCode: integer("status_code"),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type AuditAccessLog = typeof auditAccessLogTable.$inferSelect;

// H6 — HIPAA compliance role assignments. DB-backed (the in-memory map in
// rbac-service.ts is dev-only). One account may hold multiple compliance
// roles (e.g. small orgs where Privacy Officer == Security Officer).
// auditor_external assignments MUST set expires_at (enforced at insert time
// in the admin endpoint, and re-checked on every middleware call).
export const HIPAA_COMPLIANCE_ROLES = [
  "privacy_officer",
  "security_officer",
  "compliance_viewer",
  "auditor_external",
] as const;
export type HipaaComplianceRole = typeof HIPAA_COMPLIANCE_ROLES[number];

export const accountRoleAssignmentsTable = pgTable("account_role_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  role: text("role").$type<HipaaComplianceRole>().notNull(),
  scopeOrganizationId: uuid("scope_organization_id"),
  grantedBy: uuid("granted_by").notNull().references(() => accounts.id),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedBy: uuid("revoked_by").references(() => accounts.id),
  notes: text("notes"),
});
export type AccountRoleAssignment = typeof accountRoleAssignmentsTable.$inferSelect;
export type InsertAccountRoleAssignment = typeof accountRoleAssignmentsTable.$inferInsert;

// ============================================
// HIPAA COMPLIANCE & AUDIT LOGGING TABLES
// ============================================

// HIPAA Audit Logs - Immutable append-only table for compliance
export const hipaaAuditLogsTable = pgTable("hipaa_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: text("event_id").notNull().unique(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  eventType: text("event_type").notNull().$type<"PHI_ACCESS" | "PHI_MODIFY" | "PHI_CREATE" | "PHI_DELETE" | "LOGIN" | "LOGOUT" | "MFA_SETUP" | "MFA_VERIFY" | "SESSION_START" | "SESSION_END" | "EXPORT" | "CONSENT_CHANGE" | "ACCESS_DENIED">(),
  userId: text("user_id").notNull(),
  userName: text("user_name"),
  userRole: text("user_role"),
  patientId: text("patient_id"),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  action: text("action").notNull(),
  outcome: text("outcome").notNull().$type<"success" | "failure" | "denied">(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  deviceFingerprint: text("device_fingerprint"),
  sessionId: text("session_id"),
  phiAccessed: boolean("phi_accessed").notNull().default(false),
  sensitivityLevel: text("sensitivity_level").$type<"low" | "medium" | "high" | "critical">(),
  accessReason: text("access_reason"),
  accessReasonDetail: text("access_reason_detail"),
  dataClassification: text("data_classification"),
  complianceFrameworks: text("compliance_frameworks").array(),
  integrityHash: text("integrity_hash").notNull(),
  previousHash: text("previous_hash"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
});

// MFA Secrets - Encrypted storage for TOTP secrets
export const mfaSecretsTable = pgTable("mfa_secrets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  encryptedSecret: text("encrypted_secret").notNull(),
  backupCodesHash: text("backup_codes_hash").array(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Session Security - Device and session tracking
export const securitySessionsTable = pgTable("security_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: text("session_id").notNull().unique(),
  userId: text("user_id").notNull(),
  deviceFingerprint: text("device_fingerprint"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  riskScore: integer("risk_score").notNull().default(0),
  mfaVerified: boolean("mfa_verified").notNull().default(false),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  terminatedAt: timestamp("terminated_at", { withTimezone: true }),
  terminationReason: text("termination_reason"),
});

// Insert schemas for compliance tables
export const insertHipaaAuditLogSchema = z.object({
  eventType: z.enum(["PHI_ACCESS", "PHI_MODIFY", "PHI_CREATE", "PHI_DELETE", "LOGIN", "LOGOUT", "MFA_SETUP", "MFA_VERIFY", "SESSION_START", "SESSION_END", "EXPORT", "CONSENT_CHANGE", "ACCESS_DENIED"]),
  userId: z.string(),
  userName: z.string().optional(),
  userRole: z.string().optional(),
  patientId: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  action: z.string(),
  outcome: z.enum(["success", "failure", "denied"]),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  deviceFingerprint: z.string().optional(),
  sessionId: z.string().optional(),
  phiAccessed: z.boolean().default(false),
  sensitivityLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  accessReason: z.enum(["emergency", "treatment", "payment", "operations", "research", "patient_request"]).optional(),
  accessReasonDetail: z.string().optional(),
  dataClassification: z.string().optional(),
  complianceFrameworks: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type InsertHipaaAuditLog = z.infer<typeof insertHipaaAuditLogSchema>;
export type HipaaAuditLog = typeof hipaaAuditLogsTable.$inferSelect;

export const insertMfaSecretSchema = z.object({
  userId: z.string(),
  encryptedSecret: z.string(),
  backupCodesHash: z.array(z.string()).optional(),
});

export type InsertMfaSecret = z.infer<typeof insertMfaSecretSchema>;
export type MfaSecret = typeof mfaSecretsTable.$inferSelect;

export type SecuritySession = typeof securitySessionsTable.$inferSelect;

// ============================================
// PATIENT IDENTITY & DEDUPLICATION TABLES
// ============================================

// Patient Identity - Master patient index with NMN standard support
export const patientIdentityTable = pgTable("patient_identity", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name").notNull().default("NMN"),
  hasNoMiddleName: boolean("has_no_middle_name").notNull().default(false),
  lastName: text("last_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  gender: text("gender").$type<"male" | "female" | "other" | "unknown">(),
  ssnHash: text("ssn_hash"), // Hashed SSN for secure deterministic matching
  ssnLast4: text("ssn_last_4"),
  stateId: text("state_id"),
  stateIdState: text("state_id_state"),
  mrn: text("mrn"),
  mrnSource: text("mrn_source"),
  email: text("email"),
  emailHash: text("email_hash"),
  phoneNumber: text("phone_number"),
  phoneHash: text("phone_hash"),
  mrnHash: text("mrn_hash"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country").default("US"),
  matchScore: integer("match_score"),
  matchStatus: text("match_status").$type<"unique" | "auto_merged" | "pending_review" | "manually_merged" | "split">().notNull().default("unique"),
  masterPatientId: uuid("master_patient_id"),
  sourceSystem: text("source_system"),
  sourceRecordId: text("source_record_id"),
  dataQualityScore: integer("data_quality_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
});

// Match Candidates - Records flagged for review (80-95% similarity)
export const matchCandidatesTable = pgTable("match_candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourcePatientId: uuid("source_patient_id").notNull().references(() => patientIdentityTable.id, { onDelete: "cascade" }),
  candidatePatientId: uuid("candidate_patient_id").notNull().references(() => patientIdentityTable.id, { onDelete: "cascade" }),
  similarityScore: integer("similarity_score").notNull(),
  matchType: text("match_type").$type<"deterministic" | "probabilistic">().notNull(),
  matchDetails: jsonb("match_details").$type<{
    firstNameScore: number;
    lastNameScore: number;
    dobMatch: boolean;
    emailMatch: boolean;
    ssnMatch: boolean;
    addressScore: number;
    phoneMatch: boolean;
  }>(),
  status: text("status").$type<"pending" | "confirmed_match" | "confirmed_different" | "auto_merged" | "deferred">().notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Merge History - Audit trail for patient record merges
export const mergeHistoryTable = pgTable("merge_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  survivingPatientId: uuid("surviving_patient_id").notNull().references(() => patientIdentityTable.id),
  retiredPatientId: uuid("retired_patient_id").notNull(),
  mergeType: text("merge_type").$type<"auto" | "manual" | "system">().notNull(),
  mergeReason: text("merge_reason"),
  matchScore: integer("match_score"),
  premergeData: jsonb("premerge_data").$type<Record<string, unknown>>(),
  postmergeData: jsonb("postmerge_data").$type<Record<string, unknown>>(),
  mergedBy: text("merged_by"),
  mergedAt: timestamp("merged_at", { withTimezone: true }).notNull().defaultNow(),
  canUnmerge: boolean("can_unmerge").notNull().default(true),
  unmergedAt: timestamp("unmerged_at", { withTimezone: true }),
  unmergedBy: text("unmerged_by"),
});

export const clinicalAiAudit = pgTable("clinical_ai_audit", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  patientId: text("patient_id"),
  requestPayload: jsonb("request_payload").$type<Record<string, unknown>>(),
  aiSummary: text("ai_summary"),
  modelVersion: text("model_version").default("med-gemini-1.5-pro"),
  status: text("status"),
  confidenceScore: text("confidence_score"),
  sourceGrounding: jsonb("source_grounding").$type<Array<{ sentence: string; sourceDocument: string; sourceField: string; highlightStart: number; highlightEnd: number }>>(),
  explainabilityFactors: jsonb("explainability_factors").$type<Array<{ factor: string; weight: number; direction: string }>>(),
  clinicianVerification: text("clinician_verification"),
  clinicianFeedback: text("clinician_feedback"),
  verifiedBy: text("verified_by"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  rlhfFeedbackSubmitted: timestamp("rlhf_feedback_submitted", { withTimezone: true }),
});

export const insertClinicalAiAuditSchema = createInsertSchema(clinicalAiAudit).omit({ id: true, timestamp: true });
export type InsertClinicalAiAudit = z.infer<typeof insertClinicalAiAuditSchema>;
export type ClinicalAiAudit = typeof clinicalAiAudit.$inferSelect;

// Insert schemas for patient identity tables
export const insertPatientIdentitySchema = z.object({
  profileId: z.string().uuid().optional(),
  firstName: z.string().min(1),
  middleName: z.string().default("NMN"),
  hasNoMiddleName: z.boolean().default(false),
  lastName: z.string().min(1),
  dateOfBirth: z.string(),
  gender: z.enum(["male", "female", "other", "unknown"]).optional(),
  ssn: z.string().optional(), // Full SSN (will be hashed)
  ssnLast4: z.string().length(4).optional(),
  stateId: z.string().optional(),
  stateIdState: z.string().optional(),
  mrn: z.string().optional(),
  mrnSource: z.string().optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().default("US"),
  sourceSystem: z.string().optional(),
  sourceRecordId: z.string().optional(),
});

export const insertMatchCandidateSchema = z.object({
  sourcePatientId: z.string().uuid(),
  candidatePatientId: z.string().uuid(),
  similarityScore: z.number().min(0).max(100),
  matchType: z.enum(["deterministic", "probabilistic"]),
  matchDetails: z.object({
    firstNameScore: z.number(),
    lastNameScore: z.number(),
    dobMatch: z.boolean(),
    emailMatch: z.boolean(),
    ssnMatch: z.boolean(),
    addressScore: z.number(),
    phoneMatch: z.boolean(),
  }).optional(),
});

export type InsertMasterPatientRecord = z.infer<typeof insertPatientIdentitySchema>;
export type MasterPatientRecord = typeof patientIdentityTable.$inferSelect;
export type InsertMatchCandidate = z.infer<typeof insertMatchCandidateSchema>;
export type MatchCandidate = typeof matchCandidatesTable.$inferSelect;
export type MergeHistory = typeof mergeHistoryTable.$inferSelect;

export const comprehensiveIntakeDemographicsSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().min(1),
  sex: z.enum(["male", "female", "other", "prefer_not_to_say"]),
  gender: z.string().optional(),
  race: z.string().optional(),
  ethnicity: z.string().optional(),
  preferredLanguage: z.string().default("English"),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional(),
  emergencyContact: z.object({
    name: z.string().optional(),
    relationship: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
});

export const comprehensiveIntakeMedicalHistorySchema = z.object({
  conditions: z.array(z.object({
    code: z.string(),
    display: z.string(),
    year: z.number().optional(),
    status: z.string().default("active"),
  })).default([]),
  surgeries: z.array(z.object({
    code: z.string(),
    display: z.string(),
    year: z.number().optional(),
    notes: z.string().optional(),
  })).default([]),
  familyHistory: z.array(z.object({
    condition: z.string(),
    relationship: z.string(),
    ageOfOnset: z.number().optional(),
  })).default([]),
});

export const comprehensiveIntakeAllergySchema = z.object({
  allergies: z.array(z.object({
    name: z.string(),
    type: z.enum(["medication", "food", "environmental"]),
    severity: z.enum(["mild", "moderate", "severe", "life-threatening"]),
    reaction: z.string(),
    status: z.string().default("active"),
  })).default([]),
});

export const comprehensiveIntakeMedicationSchema = z.object({
  medications: z.array(z.object({
    name: z.string(),
    dosage: z.string().optional(),
    frequency: z.string().optional(),
    prescribedFor: z.string().optional(),
    status: z.string().default("active"),
  })).default([]),
});

export const comprehensiveIntakeSocialHistorySchema = z.object({
  tobacco: z.object({
    status: z.enum(["never", "former", "current"]),
    type: z.string().optional(),
    amount: z.string().optional(),
    yearsUsed: z.number().optional(),
    quitDate: z.string().optional(),
  }).default({ status: "never" }),
  alcohol: z.object({
    status: z.enum(["never", "social", "moderate", "heavy"]),
    frequency: z.string().optional(),
  }).default({ status: "never" }),
  exercise: z.object({
    frequency: z.string().default("none"),
    type: z.string().optional(),
    duration: z.string().optional(),
  }).default({ frequency: "none" }),
  occupation: z.string().optional(),
  maritalStatus: z.string().optional(),
  livingSituation: z.string().optional(),
});

export const comprehensiveIntakeInsuranceSchema = z.object({
  hasInsurance: z.boolean().default(false),
  primary: z.object({
    provider: z.string().optional(),
    planName: z.string().optional(),
    memberId: z.string().optional(),
    groupNumber: z.string().optional(),
    subscriberName: z.string().optional(),
    relationship: z.string().optional(),
  }).optional(),
  secondary: z.object({
    provider: z.string().optional(),
    planName: z.string().optional(),
    memberId: z.string().optional(),
    groupNumber: z.string().optional(),
  }).optional(),
  pharmacy: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }).optional(),
});

export const comprehensiveIntakeSchema = z.object({
  id: z.string(),
  patientId: z.string(),
  demographics: comprehensiveIntakeDemographicsSchema,
  medicalHistory: comprehensiveIntakeMedicalHistorySchema,
  allergies: comprehensiveIntakeAllergySchema,
  medications: comprehensiveIntakeMedicationSchema,
  socialHistory: comprehensiveIntakeSocialHistorySchema,
  insurance: comprehensiveIntakeInsuranceSchema,
  status: z.enum(["draft", "submitted", "reviewed"]).default("draft"),
  submittedAt: z.string().optional(),
  cdsResults: z.any().optional(),
});

export const insertComprehensiveIntakeSchema = comprehensiveIntakeSchema.omit({ id: true, submittedAt: true, cdsResults: true, status: true });

export type ComprehensiveIntake = z.infer<typeof comprehensiveIntakeSchema>;
export type InsertComprehensiveIntake = z.infer<typeof insertComprehensiveIntakeSchema>;

export interface PatientProfileSetup {
  id: string;
  userId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  preferredLanguage: string;
  communicationPreference: "email" | "phone" | "sms" | "portal";
  timezone: string;
  ssnLast4?: string;
  stateIdNumber?: string;
  stateIdIssuingState?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
    email: string;
  };
  insurance?: {
    planName: string;
    memberId: string;
    groupNumber: string;
  };
  race?: string;
  ethnicity?: string;
  preferredPharmacy?: {
    name: string;
    address: string;
    phone: string;
  };
  createdAt: string;
  updatedAt: string;
}

export const insertPatientProfileSetupSchema = z.object({
  userId: z.string().min(1),
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().default("NMN"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone number is required"),
  address: z.object({
    street: z.string().default(""),
    city: z.string().default(""),
    state: z.string().default(""),
    zipCode: z.string().default(""),
  }),
  preferredLanguage: z.string().default("English"),
  communicationPreference: z.enum(["email", "phone", "sms", "portal"]).default("portal"),
  timezone: z.string().default("America/New_York"),
  ssnLast4: z.string().max(4).optional(),
  stateIdNumber: z.string().optional(),
  stateIdIssuingState: z.string().optional(),
  emergencyContact: z.object({
    name: z.string().default(""),
    relationship: z.string().default(""),
    phone: z.string().default(""),
    email: z.string().default(""),
  }).optional(),
  insurance: z.object({
    planName: z.string().default(""),
    memberId: z.string().default(""),
    groupNumber: z.string().default(""),
  }).optional(),
  race: z.string().optional(),
  ethnicity: z.string().optional(),
  preferredPharmacy: z.object({
    name: z.string().default(""),
    address: z.string().default(""),
    phone: z.string().default(""),
  }).optional(),
});

export type InsertPatientProfileSetup = z.infer<typeof insertPatientProfileSetupSchema>;

export interface DataUsageConsent {
  id: string;
  userId: string;
  consentVersion: string;
  healthDataSharing: boolean;
  aiAnalysis: boolean;
  researchParticipation: boolean;
  thirdPartySharing: boolean;
  marketingCommunications: boolean;
  consentTimestamp: string;
  ipAddress?: string;
  revokedAt?: string;
}

export const insertDataUsageConsentSchema = z.object({
  userId: z.string().min(1),
  consentVersion: z.string().default("1.0"),
  healthDataSharing: z.boolean(),
  aiAnalysis: z.boolean(),
  researchParticipation: z.boolean(),
  thirdPartySharing: z.boolean(),
  marketingCommunications: z.boolean(),
});

export type InsertDataUsageConsent = z.infer<typeof insertDataUsageConsentSchema>;

export interface NewPatientOnboarding {
  id: string;
  userId: string;
  currentStep: "welcome" | "profile" | "consent" | "tutorial" | "complete";
  profileId?: string;
  consentId?: string;
  tutorialCompleted: boolean;
  startedAt: string;
  completedAt?: string;
}

export const insertNewPatientOnboardingSchema = z.object({
  userId: z.string().min(1),
});

export type InsertNewPatientOnboarding = z.infer<typeof insertNewPatientOnboardingSchema>;

// ============================================
// PROVIDER TASK MANAGEMENT
// ============================================

export const providerTaskStatusEnum = z.enum([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
  "overdue",
]);
export type ProviderTaskStatus = z.infer<typeof providerTaskStatusEnum>;

export const providerTaskPriorityEnum = z.enum([
  "low",
  "medium",
  "high",
  "urgent",
]);
export type ProviderTaskPriority = z.infer<typeof providerTaskPriorityEnum>;

export const providerTaskCategoryEnum = z.enum([
  "follow_up",
  "review_lab_results",
  "contact_patient",
  "referral",
  "prescription",
  "documentation",
  "care_coordination",
  "other",
]);
export type ProviderTaskCategory = z.infer<typeof providerTaskCategoryEnum>;

export interface ProviderTask {
  id: string;
  title: string;
  description: string;
  category: ProviderTaskCategory;
  status: ProviderTaskStatus;
  priority: ProviderTaskPriority;
  patientId?: string;
  patientName?: string;
  assignedTo: string;
  assignedToName: string;
  createdBy: string;
  createdByName: string;
  dueDate: string;
  completedAt?: string;
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

export const insertProviderTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().default(""),
  category: providerTaskCategoryEnum,
  priority: providerTaskPriorityEnum.default("medium"),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  assignedTo: z.string().min(1, "Assignee is required"),
  assignedToName: z.string().min(1),
  dueDate: z.string().min(1, "Due date is required"),
});

export type InsertProviderTask = z.infer<typeof insertProviderTaskSchema>;

export const updateProviderTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: providerTaskCategoryEnum.optional(),
  status: providerTaskStatusEnum.optional(),
  priority: providerTaskPriorityEnum.optional(),
  assignedTo: z.string().optional(),
  assignedToName: z.string().optional(),
  dueDate: z.string().optional(),
  note: z.string().optional(),
});

export const dentalRecordTypes = ["exam", "cleaning", "filling", "extraction", "crown", "root_canal", "implant", "bridge", "veneer", "whitening", "orthodontics", "periodontal", "denture", "sealant", "xray", "emergency", "consultation", "other"] as const;
export type DentalRecordType = typeof dentalRecordTypes[number];

export const dentalRecordStatuses = ["completed", "scheduled", "in_progress", "cancelled"] as const;
export type DentalRecordStatus = typeof dentalRecordStatuses[number];

export const toothConditions = ["healthy", "cavity", "filled", "crowned", "missing", "impacted", "root_canal", "fractured", "sensitive", "decayed"] as const;
export type ToothCondition = typeof toothConditions[number];

export interface DentalRecord {
  id: string;
  patientId: string;
  type: DentalRecordType;
  status: DentalRecordStatus;
  dentistName: string;
  clinicName: string;
  date: string;
  toothNumbers: number[];
  toothConditions: { tooth: number; condition: ToothCondition; notes?: string }[];
  diagnosis: string;
  treatment: string;
  notes: string;
  nextAppointment?: string;
  xrayImageIds: string[];
  insuranceClaim?: {
    claimId: string;
    amount: number;
    status: "submitted" | "approved" | "denied" | "pending";
    coveredAmount?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export const insertDentalRecordSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  type: z.enum(dentalRecordTypes),
  status: z.enum(dentalRecordStatuses).default("completed"),
  dentistName: z.string().min(1, "Dentist name is required"),
  clinicName: z.string().min(1, "Clinic name is required"),
  date: z.string().min(1, "Date is required"),
  toothNumbers: z.array(z.number().min(1).max(32)).default([]),
  toothConditions: z.array(z.object({
    tooth: z.number().min(1).max(32),
    condition: z.enum(toothConditions),
    notes: z.string().optional(),
  })).default([]),
  diagnosis: z.string().default(""),
  treatment: z.string().default(""),
  notes: z.string().default(""),
  nextAppointment: z.string().optional(),
  xrayImageIds: z.array(z.string()).default([]),
  insuranceClaim: z.object({
    claimId: z.string(),
    amount: z.number(),
    status: z.enum(["submitted", "approved", "denied", "pending"]),
    coveredAmount: z.number().optional(),
  }).optional(),
});

export type InsertDentalRecord = z.infer<typeof insertDentalRecordSchema>;

export const updateDentalRecordSchema = z.object({
  type: z.enum(dentalRecordTypes).optional(),
  status: z.enum(dentalRecordStatuses).optional(),
  dentistName: z.string().optional(),
  clinicName: z.string().optional(),
  date: z.string().optional(),
  toothNumbers: z.array(z.number().min(1).max(32)).optional(),
  toothConditions: z.array(z.object({
    tooth: z.number().min(1).max(32),
    condition: z.enum(toothConditions),
    notes: z.string().optional(),
  })).optional(),
  diagnosis: z.string().optional(),
  treatment: z.string().optional(),
  notes: z.string().optional(),
  nextAppointment: z.string().optional(),
  insuranceClaim: z.object({
    claimId: z.string(),
    amount: z.number(),
    status: z.enum(["submitted", "approved", "denied", "pending"]),
    coveredAmount: z.number().optional(),
  }).optional(),
});

export type UpdateDentalRecord = z.infer<typeof updateDentalRecordSchema>;

export type UpdateProviderTask = z.infer<typeof updateProviderTaskSchema>;

export const growthMeasurementSexes = ["male", "female"] as const;
export type GrowthMeasurementSex = typeof growthMeasurementSexes[number];

export const growthChartTypes = ["weight_for_age", "height_for_age", "bmi_for_age", "head_circumference_for_age"] as const;
export type GrowthChartType = typeof growthChartTypes[number];

export interface GrowthMeasurement {
  id: string;
  patientId: string;
  measuredAt: string;
  ageMonths: number;
  sex: GrowthMeasurementSex;
  weightKg: number | null;
  heightCm: number | null;
  headCircumferenceCm: number | null;
  bmi: number | null;
  notes?: string;
}

export const insertGrowthMeasurementSchema = z.object({
  patientId: z.string().min(1),
  measuredAt: z.string().min(1),
  ageMonths: z.number().min(0).max(240),
  sex: z.enum(growthMeasurementSexes),
  weightKg: z.number().positive().nullable().optional(),
  heightCm: z.number().positive().nullable().optional(),
  headCircumferenceCm: z.number().positive().nullable().optional(),
  notes: z.string().optional(),
});

export type InsertGrowthMeasurement = z.infer<typeof insertGrowthMeasurementSchema>;

export interface GrowthPercentilePoint {
  ageMonths: number;
  p3: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p97: number;
}

export interface AdultVitalTrendPoint {
  date: string;
  value: number;
  unit: string;
}

export interface AdultVitalTrendData {
  vitalType: string;
  label: string;
  unit: string;
  data: AdultVitalTrendPoint[];
  normalRange: { low: number; high: number } | null;
}

// ============================================
// SMS MESSAGING
// ============================================

export const smsStatuses = ["queued", "sending", "sent", "delivered", "failed", "undelivered"] as const;
export type SmsStatus = typeof smsStatuses[number];

export const smsCategories = ["appointment_reminder", "lab_result", "prescription", "care_follow_up", "billing", "general", "emergency"] as const;
export type SmsCategory = typeof smsCategories[number];

export interface SmsMessage {
  id: string;
  to: string;
  from: string;
  body: string;
  category: SmsCategory;
  status: SmsStatus;
  twilioSid: string | null;
  errorMessage: string | null;
  patientId: string | null;
  sentBy: string;
  sentAt: string;
  deliveredAt: string | null;
}

export const sendSmsSchema = z.object({
  to: z.string().min(10, "Phone number must be at least 10 digits"),
  body: z.string().min(1, "Message body is required").max(1600, "SMS body cannot exceed 1600 characters"),
  category: z.enum(smsCategories).default("general"),
  patientId: z.string().optional(),
});

export type SendSmsInput = z.infer<typeof sendSmsSchema>;

// ============================================
// SECURE PATIENT ONBOARDING
// ============================================

export const onboardingStepNames = ["welcome", "profile", "documents", "consents", "complete"] as const;
export type OnboardingStepName = typeof onboardingStepNames[number];

export const onboardingDocTypes = ["government_id", "insurance_front", "insurance_back", "secondary_insurance_front", "secondary_insurance_back"] as const;
export type OnboardingDocType = typeof onboardingDocTypes[number];

export const onboardingConsentTypes = ["terms_of_service", "privacy_policy", "hipaa_notice", "data_sharing", "telehealth_consent", "hipaa_ai_disclosure", "fasten_health_authorization"] as const;
export type OnboardingConsentType = typeof onboardingConsentTypes[number];

export interface SecureOnboardingSession {
  id: string;
  patientId: string;
  currentStep: OnboardingStepName;
  completedSteps: OnboardingStepName[];
  profileData: SecureOnboardingProfile | null;
  status: "in_progress" | "completed" | "abandoned";
  startedAt: string;
  completedAt: string | null;
  lastActivityAt: string;
}

export interface SecureOnboardingProfile {
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  preferredLanguage: string;
}

export interface OnboardingDocument {
  id: string;
  sessionId: string;
  patientId: string;
  docType: OnboardingDocType;
  fileName: string;
  mimeType: string;
  objectKey: string;
  uploadedAt: string;
  verified: boolean;
}

export interface OnboardingConsent {
  id: string;
  sessionId: string;
  patientId: string;
  consentType: OnboardingConsentType;
  agreed: boolean;
  agreedAt: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  version: string;
}

export interface OnboardingAuditEntry {
  id: string;
  sessionId: string;
  patientId: string;
  action: string;
  details: string;
  ipAddress: string | null;
  timestamp: string;
}

export const secureOnboardingProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.string().min(1, "Gender is required"),
  phone: z.string().min(10, "Valid phone number required"),
  email: z.string().email("Valid email required"),
  address: z.object({
    street: z.string().min(1, "Street address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    zipCode: z.string().min(5, "Valid zip code required"),
  }),
  emergencyContact: z.object({
    name: z.string().min(1, "Emergency contact name is required"),
    relationship: z.string().min(1, "Relationship is required"),
    phone: z.string().min(10, "Valid phone number required"),
  }),
  preferredLanguage: z.string().default("en"),
});

export const submitConsentSchema = z.object({
  consentType: z.enum(onboardingConsentTypes),
  agreed: z.boolean(),
  version: z.string().default("1.0"),
});

// ============================================
// AGGREGATOR SYNC & WEBHOOK/CDC DATA STORAGE
// ============================================

export type AggregatorSyncStatus = "idle" | "pending_webhook" | "syncing" | "error" | "completed";

export type AggregatorSource = 
  | "redox" 
  | "plaid_health" 
  | "human_api" 
  | "particle_health" 
  | "fasten_health"
  | "cms_bluebutton";

export interface AggregatorSyncRecord {
  id: string;
  patientId: string;
  aggregatorSource: AggregatorSource;
  aggregatorRefId: string;
  lastSuccessfulSync: string | null;
  syncStatus: AggregatorSyncStatus;
  fingerprintHash: string | null;
  errorMessage: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  webhookReceivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InsertAggregatorSyncRecord {
  patientId: string;
  aggregatorSource: AggregatorSource;
  aggregatorRefId: string;
  syncStatus?: AggregatorSyncStatus;
  fingerprintHash?: string | null;
}

export interface WebhookEvent {
  id: string;
  source: AggregatorSource;
  eventType: string;
  payload: Record<string, unknown>;
  receivedAt: string;
  processedAt: string | null;
  status: "received" | "processing" | "processed" | "failed" | "duplicate";
  fingerprintHash: string;
  aggregatorRefId: string | null;
  patientId: string | null;
  errorMessage: string | null;
  retryCount: number;
}

export interface InsertWebhookEvent {
  source: AggregatorSource;
  eventType: string;
  payload: Record<string, unknown>;
  fingerprintHash: string;
  aggregatorRefId?: string | null;
  patientId?: string | null;
}

export interface WebhookConfig {
  id: string;
  source: AggregatorSource;
  endpointUrl: string;
  secret: string;
  enabled: boolean;
  eventTypes: string[];
  lastHealthCheck: string | null;
  healthStatus: "healthy" | "degraded" | "unreachable";
  createdAt: string;
}

// Stale data threshold check (24 hours default)
export const SYNC_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export function isSyncStale(lastSync: string | null): boolean {
  if (!lastSync) return true;
  return Date.now() - new Date(lastSync).getTime() > SYNC_STALE_THRESHOLD_MS;
}

// ============================================
// GCP ARCHITECTURE CONFIGURATION
// ============================================

export type GcpService = 
  | "apigee"
  | "cloud_sql"
  | "cloud_healthcare_api"
  | "bigquery"
  | "secret_manager"
  | "cloud_kms"
  | "cloud_logging"
  | "vpc_service_controls"
  | "cloud_run"
  | "artifact_registry"
  | "iam";

export type GcpServiceStatus = "configured" | "pending" | "not_configured" | "error";

export interface GcpServiceConfig {
  service: GcpService;
  displayName: string;
  description: string;
  status: GcpServiceStatus;
  hipaaEligible: boolean;
  region: string;
  projectId: string | null;
  configuration: Record<string, unknown>;
  lastVerified: string | null;
}

export interface VpcConfig {
  networkName: string;
  subnetCidr: string;
  region: string;
  servicePerimeter: string;
  privateGoogleAccess: boolean;
  firewallRules: {
    name: string;
    direction: "ingress" | "egress";
    action: "allow" | "deny";
    ports: string[];
    sourceRanges?: string[];
    targetTags?: string[];
  }[];
}

export interface KmsConfig {
  keyRingName: string;
  keyName: string;
  region: string;
  purpose: "ENCRYPT_DECRYPT" | "ASYMMETRIC_SIGN" | "ASYMMETRIC_DECRYPT";
  algorithm: string;
  rotationPeriod: string;
  nextRotation: string | null;
  state: "enabled" | "disabled" | "pending_destruction";
}

export interface IamServiceAccount {
  email: string;
  displayName: string;
  roles: string[];
  description: string;
  leastPrivilege: boolean;
  lastUsed: string | null;
}

export interface GcpArchitectureStatus {
  projectId: string;
  region: string;
  baaStatus: "signed" | "pending" | "not_signed";
  services: GcpServiceConfig[];
  vpc: VpcConfig | null;
  kmsKeys: KmsConfig[];
  serviceAccounts: IamServiceAccount[];
  complianceChecks: {
    check: string;
    passed: boolean;
    details: string;
    lastVerified: string;
  }[];
}

// ============================================
// HIPAA/SOC 2/HITRUST COMPLIANCE CONTROLS
// ============================================

export type ComplianceFramework = "HIPAA" | "SOC2" | "HITRUST";

export type ComplianceControlStatus = "implemented" | "partial" | "planned" | "not_applicable" | "gap";

export interface ComplianceControl {
  id: string;
  framework: ComplianceFramework;
  controlId: string;
  title: string;
  description: string;
  category: string;
  status: ComplianceControlStatus;
  implementationNotes: string;
  evidenceLinks: string[];
  owner: string;
  lastReviewDate: string | null;
  nextReviewDate: string | null;
  inherited: boolean;
  inheritedFrom?: string;
}

export interface ComplianceFrameworkStatus {
  framework: ComplianceFramework;
  overallScore: number;
  totalControls: number;
  implementedControls: number;
  partialControls: number;
  plannedControls: number;
  gapControls: number;
  lastAuditDate: string | null;
  nextAuditDate: string | null;
  certificationStatus: "certified" | "in_progress" | "expired" | "not_started";
  certificationExpiry: string | null;
}

export interface SecurityComplianceDashboard {
  frameworks: ComplianceFrameworkStatus[];
  controls: ComplianceControl[];
  recentActivity: {
    action: string;
    framework: ComplianceFramework;
    controlId: string;
    timestamp: string;
    user: string;
  }[];
  trustServicesCriteria: {
    criterion: "Security" | "Availability" | "Processing Integrity" | "Confidentiality" | "Privacy";
    score: number;
    status: "compliant" | "partially_compliant" | "non_compliant";
    controlCount: number;
  }[];
}

// ============================================
// DATA AGGREGATION LAYER
// ============================================

export type DataSourceType = "fhir" | "aggregator" | "cms_bluebutton" | "wearable" | "manual";
export type DataCacheStatus = "fresh" | "stale" | "refreshing" | "error" | "expired";
export type AggregationDataCategory = "labs" | "medications" | "documents" | "claims" | "vitals" | "conditions" | "procedures" | "immunizations" | "allergies" | "imaging";
export type SyncTrigger = "manual" | "scheduled" | "webhook" | "on_demand";
export type SourceHealthStatus = "healthy" | "degraded" | "unreachable" | "unknown";

export interface DataCacheEntry {
  id: string;
  patientId: string;
  sourceType: DataSourceType;
  sourceId: string;
  sourceName: string;
  dataCategory: AggregationDataCategory;
  cacheStatus: DataCacheStatus;
  lastFetchedAt: string | null;
  lastVisitDate: string | null;
  expiresAt: string | null;
  ttlSeconds: number;
  etag: string | null;
  fingerprintHash: string | null;
  objectStorageKey: string | null;
  payloadSizeBytes: number;
  recordCount: number;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InsertDataCacheEntry {
  patientId: string;
  sourceType: DataSourceType;
  sourceId: string;
  sourceName: string;
  dataCategory: AggregationDataCategory;
  ttlSeconds?: number;
  metadata?: Record<string, unknown>;
}

export interface DataSyncRun {
  id: string;
  patientId: string;
  sourceType: DataSourceType;
  sourceId: string;
  sourceName: string;
  trigger: SyncTrigger;
  status: "pending" | "running" | "completed" | "failed" | "partial";
  startedAt: string;
  finishedAt: string | null;
  recordsAdded: number;
  recordsUpdated: number;
  recordsSkipped: number;
  bytesTransferred: number;
  errorMessage: string | null;
  categoriesSynced: AggregationDataCategory[];
  metadata: Record<string, unknown>;
}

export interface InsertDataSyncRun {
  patientId: string;
  sourceType: DataSourceType;
  sourceId: string;
  sourceName: string;
  trigger: SyncTrigger;
}

export interface DataSourceHealth {
  id: string;
  sourceType: DataSourceType;
  sourceId: string;
  sourceName: string;
  status: SourceHealthStatus;
  lastHeartbeatAt: string | null;
  lastSuccessfulFetch: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  avgResponseTimeMs: number;
  uptime24h: number;
  patientsConnected: number;
  totalRecordsCached: number;
  objectStorageSizeBytes: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const complianceEvidenceCategories = [
  "audit_log",
  "screenshot",
  "policy_update",
  "access_review",
  "risk_assessment",
  "penetration_test",
  "vulnerability_scan",
  "training_record",
  "incident_response",
  "change_management",
  "vendor_assessment",
  "encryption_cert",
  "backup_verification",
  "disaster_recovery",
  "other",
] as const;
export type ComplianceEvidenceCategory = typeof complianceEvidenceCategories[number];

export const soc2TrustServiceCategories = [
  "security",
  "availability",
  "processing_integrity",
  "confidentiality",
  "privacy",
] as const;
export type SOC2TrustServiceCategory = typeof soc2TrustServiceCategories[number];

export const complianceEvidence = pgTable("compliance_evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").$type<ComplianceEvidenceCategory>().notNull(),
  soc2Category: text("soc2_category").$type<SOC2TrustServiceCategory>().notNull(),
  controlId: text("control_id").notNull(),
  tags: text("tags").array().notNull().default([]),
  source: text("source").notNull().default("manual"),
  severity: text("severity").$type<"critical" | "high" | "medium" | "low" | "info">().notNull().default("info"),
  status: text("status").$type<"active" | "archived" | "expired" | "pending_review">().notNull().default("active"),
  objectKey: text("object_key"),
  collectedBy: text("collected_by").notNull().default("system"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertComplianceEvidenceSchema = createInsertSchema(complianceEvidence).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertComplianceEvidence = z.infer<typeof insertComplianceEvidenceSchema>;
export type ComplianceEvidence = typeof complianceEvidence.$inferSelect;

export const complianceWeeklyReports = pgTable("compliance_weekly_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  weekStartDate: date("week_start_date").notNull(),
  weekEndDate: date("week_end_date").notNull(),
  totalAuditEvents: integer("total_audit_events").notNull().default(0),
  totalEvidenceCollected: integer("total_evidence_collected").notNull().default(0),
  newFindings: integer("new_findings").notNull().default(0),
  resolvedFindings: integer("resolved_findings").notNull().default(0),
  overallComplianceScore: integer("overall_compliance_score").notNull().default(100),
  soc2Scores: jsonb("soc2_scores").$type<Record<SOC2TrustServiceCategory, number>>().notNull().default({
    security: 100,
    availability: 100,
    processing_integrity: 100,
    confidentiality: 100,
    privacy: 100,
  }),
  eventBreakdown: jsonb("event_breakdown").$type<Record<string, number>>().notNull().default({}),
  criticalEvents: jsonb("critical_events").$type<Array<{ type: string; count: number; description: string }>>().notNull().default([]),
  recommendations: text("recommendations").array().notNull().default([]),
  status: text("status").$type<"draft" | "reviewed" | "approved" | "published">().notNull().default("draft"),
  generatedBy: text("generated_by").notNull().default("system"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertComplianceWeeklyReportSchema = createInsertSchema(complianceWeeklyReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertComplianceWeeklyReport = z.infer<typeof insertComplianceWeeklyReportSchema>;
export type ComplianceWeeklyReport = typeof complianceWeeklyReports.$inferSelect;

// ============================================
// SOC 2 AUTOMATED REMEDIATION
// ============================================

export const remediationTriggerTypes = [
  "failed_auth_spike",
  "unauthorized_access",
  "data_exfiltration",
  "compliance_drift",
  "encryption_failure",
  "backup_failure",
  "availability_degradation",
  "privilege_escalation",
  "policy_violation",
  "anomalous_activity",
] as const;
export type RemediationTriggerType = (typeof remediationTriggerTypes)[number];

export const remediationStatuses = [
  "triggered",
  "account_flagged",
  "ticket_created",
  "alert_sent",
  "completed",
  "failed",
  "acknowledged",
  "resolved",
] as const;
export type RemediationStatus = (typeof remediationStatuses)[number];

export const remediationWorkflows = pgTable("remediation_workflows", {
  id: uuid("id").defaultRandom().primaryKey(),
  triggerType: text("trigger_type").$type<RemediationTriggerType>().notNull(),
  severity: text("severity").$type<"critical" | "high" | "medium" | "low">().notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").$type<RemediationStatus>().notNull().default("triggered"),
  affectedUserId: text("affected_user_id"),
  affectedUserEmail: text("affected_user_email"),
  accountFlagged: boolean("account_flagged").notNull().default(false),
  accountFlaggedAt: timestamp("account_flagged_at", { withTimezone: true }),
  ticketId: text("ticket_id"),
  ticketTitle: text("ticket_title"),
  ticketCreatedAt: timestamp("ticket_created_at", { withTimezone: true }),
  alertChannel: text("alert_channel").$type<"email" | "slack" | "both">().notNull().default("email"),
  alertSentAt: timestamp("alert_sent_at", { withTimezone: true }),
  alertRecipients: text("alert_recipients").array().notNull().default([]),
  incidentLogs: jsonb("incident_logs").$type<Array<{ timestamp: string; level: string; message: string; source: string }>>().notNull().default([]),
  soc2Category: text("soc2_category").$type<SOC2TrustServiceCategory>().notNull().default("security"),
  controlId: text("control_id"),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolutionNotes: text("resolution_notes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRemediationWorkflowSchema = createInsertSchema(remediationWorkflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertRemediationWorkflow = z.infer<typeof insertRemediationWorkflowSchema>;
export type RemediationWorkflow = typeof remediationWorkflows.$inferSelect;

// ============================================
// FHIR API DATA HUB
// ============================================

export const fhirApiPartners = pgTable("fhir_api_partners", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  organization: text("organization").notNull(),
  contactEmail: text("contact_email").notNull(),
  apiKeyHash: text("api_key_hash").notNull(),
  apiKeyPrefix: text("api_key_prefix").notNull(),
  status: text("status").$type<"active" | "suspended" | "revoked">().notNull().default("active"),
  allowedScopes: text("allowed_scopes").array().notNull().default([]),
  rateLimitPerHour: integer("rate_limit_per_hour").notNull().default(100),
  lastAccessAt: timestamp("last_access_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFhirApiPartnerSchema = createInsertSchema(fhirApiPartners).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFhirApiPartner = z.infer<typeof insertFhirApiPartnerSchema>;
export type FhirApiPartner = typeof fhirApiPartners.$inferSelect;

export const fhirApiScopeGrants = pgTable("fhir_api_scope_grants", {
  id: uuid("id").defaultRandom().primaryKey(),
  patientUserId: text("patient_user_id").notNull(),
  partnerId: uuid("partner_id").notNull().references(() => fhirApiPartners.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  granted: boolean("granted").notNull().default(false),
  grantedAt: timestamp("granted_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFhirApiScopeGrantSchema = createInsertSchema(fhirApiScopeGrants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFhirApiScopeGrant = z.infer<typeof insertFhirApiScopeGrantSchema>;
export type FhirApiScopeGrant = typeof fhirApiScopeGrants.$inferSelect;

export const fhirApiAuditLogs = pgTable("fhir_api_audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  partnerId: uuid("partner_id").references(() => fhirApiPartners.id),
  partnerName: text("partner_name").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  patientEmail: text("patient_email"),
  scopesUsed: text("scopes_used").array().notNull().default([]),
  statusCode: integer("status_code").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  requestPath: text("request_path").notNull(),
  responseTimeMs: integer("response_time_ms"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFhirApiAuditLogSchema = createInsertSchema(fhirApiAuditLogs).omit({
  id: true,
  createdAt: true,
});
export type InsertFhirApiAuditLog = z.infer<typeof insertFhirApiAuditLogSchema>;
export type FhirApiAuditLog = typeof fhirApiAuditLogs.$inferSelect;

export const FHIR_API_SCOPES = [
  "patient/Patient.read",
  "patient/Observation.read",
  "patient/Condition.read",
  "patient/MedicationRequest.read",
  "patient/Procedure.read",
  "patient/Immunization.read",
  "patient/AllergyIntolerance.read",
  "patient/DiagnosticReport.read",
  "patient/Encounter.read",
  "patient/DocumentReference.read",
  "patient/CarePlan.read",
  "patient/CareTeam.read",
  "patient/Coverage.read",
  "patient/Claim.read",
  "patient/ExplanationOfBenefit.read",
] as const;

export type FhirApiScope = (typeof FHIR_API_SCOPES)[number];

export interface DataAggregationDashboard {
  sources: DataSourceHealth[];
  cacheStats: {
    totalEntries: number;
    freshEntries: number;
    staleEntries: number;
    errorEntries: number;
    totalSizeBytes: number;
    objectStorageSizeBytes: number;
  };
  syncStats: {
    totalRuns: number;
    last24Hours: number;
    successRate: number;
    avgDurationMs: number;
    lastSyncAt: string | null;
  };
  recentSyncs: DataSyncRun[];
  patientCoverage: {
    totalPatients: number;
    patientsWithFreshData: number;
    patientsNeedingRefresh: number;
  };
}

// ---------------------------------------------------------------------------
// Symptom Checker (G3) — guided-triage session log.
// Free-tier feature. Persists one row per completed triage so the user can
// review their history and so clinicians (with consent) can see context.
// ---------------------------------------------------------------------------
export const symptomCheckerSessions = pgTable("symptom_checker_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  transcript: jsonb("transcript").$type<Record<string, unknown>>().notNull(),
  triageResult: jsonb("triage_result").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSymptomCheckerSessionSchema = createInsertSchema(symptomCheckerSessions).omit({
  id: true,
  createdAt: true,
});
export type InsertSymptomCheckerSession = z.infer<typeof insertSymptomCheckerSessionSchema>;
export type SymptomCheckerSession = typeof symptomCheckerSessions.$inferSelect;

// ---------------------------------------------------------------------------
// AI Patient Chart Summary (G6) — cached AI-generated home-dashboard summary.
// Pro-tier feature (gated by `ai_summaries`). Cached per account; regenerated
// every 24h or on explicit user refresh (server-side rate-limited to 1/hour).
// ---------------------------------------------------------------------------
export const aiPatientSummariesTable = pgTable("ai_patient_summaries", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" })
    .unique(),
  summary: jsonb("summary").$type<Record<string, unknown>>().notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  modelVersion: text("model_version").notNull(),
  tokenCost: integer("token_cost").notNull().default(0),
  lastRegenerateAt: timestamp("last_regenerate_at", { withTimezone: true }),
});

export const insertAiPatientSummarySchema = createInsertSchema(aiPatientSummariesTable).omit({
  id: true,
  generatedAt: true,
});
export type InsertAiPatientSummary = z.infer<typeof insertAiPatientSummarySchema>;
export type AiPatientSummaryRow = typeof aiPatientSummariesTable.$inferSelect;

// ---------------------------------------------------------------------------
// Patient-Reported Outcomes (G5) — validated PRO instruments (PHQ-9, GAD-7,
// PROMIS-29, etc.) with per-account responses, scores, and severity bands.
// Pro-tier feature (gated by `pro_outcomes`).
// ---------------------------------------------------------------------------
export const proInstruments = pgTable("pro_instruments", {
  code: text("code").primaryKey(), // e.g. "PHQ-9", "GAD-7", "PROMIS-29"
  name: text("name").notNull(),
  version: text("version").notNull(),
  description: text("description").notNull(),
  items: jsonb("items").$type<Array<{
    id: string;
    text: string;
    options: Array<{ label: string; value: number }>;
  }>>().notNull(),
  scoringFn: text("scoring_fn").notNull(), // identifier resolved server-side
  severityBands: jsonb("severity_bands").$type<Array<{
    min: number;
    max: number;
    severity: string;
    color: string;
  }>>().notNull(),
});

export const insertProInstrumentSchema = createInsertSchema(proInstruments);
export type InsertProInstrument = z.infer<typeof insertProInstrumentSchema>;
export type ProInstrument = typeof proInstruments.$inferSelect;

export const proResponses = pgTable("pro_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  instrumentCode: text("instrument_code")
    .notNull()
    .references(() => proInstruments.code, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<Record<string, number>>().notNull(),
  score: integer("score").notNull(),
  severity: text("severity").notNull(),
  flagged: boolean("flagged").notNull().default(false),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProResponseSchema = createInsertSchema(proResponses).omit({
  id: true,
  submittedAt: true,
});
export type InsertProResponse = z.infer<typeof insertProResponseSchema>;
export type ProResponse = typeof proResponses.$inferSelect;

// ---------------------------------------------------------------------------
// Data Rights Requests (G1 GDPR / G2 CCPA) — patient-facing self-serve
// data-subject-rights workflow. Free tier (legally mandated, must NOT be gated).
// ---------------------------------------------------------------------------
export const dataRightsRequests = pgTable("data_rights_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  // Type covers both GDPR and CCPA request kinds:
  //   "access" | "portability" | "erasure" | "rectification"
  //   "do_not_sell" | "limit_sensitive" | "opt_out_automated_decisions"
  type: text("type").notNull(),
  // "pending" | "in_progress" | "completed" | "cancelled" | "failed"
  status: text("status").notNull().default("pending"),
  framework: text("framework").notNull().default("gdpr"), // "gdpr" | "ccpa"
  notes: text("notes"),
  fulfillmentRef: text("fulfillment_ref"), // e.g. export job id, deletion job id
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertDataRightsRequestSchema = createInsertSchema(dataRightsRequests).omit({
  id: true,
  requestedAt: true,
  completedAt: true,
});
export type InsertDataRightsRequest = z.infer<typeof insertDataRightsRequestSchema>;
export type DataRightsRequest = typeof dataRightsRequests.$inferSelect;

// Mobile guided onboarding — per-user progress so first-time setup can
// resume across server restarts. user_id is the same identifier carried on
// the mobile JWT (req.user.id), which may be an internal account UUID, an
// Auth0 sub, or a GCIP-resolved user id — so we store it as text without a
// foreign key. Cleared once /api/onboarding/complete fires.
export const mobileOnboardingProgress = pgTable("mobile_onboarding_progress", {
  userId: text("user_id").primaryKey(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  dateOfBirth: text("date_of_birth"),
  preferredLanguage: text("preferred_language"),
  connectDoctorChoice: text("connect_doctor_choice").$type<"connect" | "skip" | null>(),
  currentStep: text("current_step").$type<"profile" | "language" | "connect" | "complete" | null>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MobileOnboardingProgress = typeof mobileOnboardingProgress.$inferSelect;

// Per-account privacy preferences. Single row per account, upserted on change.
export const accountPrivacyPrefs = pgTable("account_privacy_prefs", {
  accountId: uuid("account_id")
    .primaryKey()
    .references(() => accounts.id, { onDelete: "cascade" }),
  aiProcessingOptOut: boolean("ai_processing_opt_out").notNull().default(false),
  marketingEmailsOptOut: boolean("marketing_emails_opt_out").notNull().default(false),
  analyticsOptOut: boolean("analytics_opt_out").notNull().default(false),
  doNotSell: boolean("do_not_sell").notNull().default(false),
  limitSensitivePi: boolean("limit_sensitive_pi").notNull().default(false),
  optOutAutomatedDecisions: boolean("opt_out_automated_decisions").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAccountPrivacyPrefsSchema = createInsertSchema(accountPrivacyPrefs).omit({
  updatedAt: true,
});
export type InsertAccountPrivacyPrefs = z.infer<typeof insertAccountPrivacyPrefsSchema>;
export type AccountPrivacyPrefs = typeof accountPrivacyPrefs.$inferSelect;

/**
 * Ambient scribe: consent to record a consultation.
 *
 * Deliberately not folded into `engagement_consents`. That table answers "may
 * we text this number"; this one answers "may we capture this room". A patient
 * who agreed to appointment reminders has agreed to nothing here, and one
 * table with a widened purpose list would let the first answer satisfy a
 * question about the second.
 *
 * `noticeElements` records which DPDP s.5 elements the delivered notice
 * covered. Section 5 makes the notice constitutive rather than procedural, so
 * this is part of whether consent exists at all — not an audit nicety.
 */
export const scribeConsentsTable = pgTable(
  "scribe_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    jurisdiction: text("jurisdiction").notNull(),
    purpose: text("purpose").notNull(),
    state: text("state").notNull(),
    method: text("method").notNull(),
    noticeLanguage: text("notice_language").notNull(),
    noticeVersion: text("notice_version").notNull(),
    noticeElements: jsonb("notice_elements").$type<string[]>().notNull().default([]),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    /** The clinician who attests to having asked. Names a person — encrypted. */
    capturedBy: text("captured_by"),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdx: index("scribe_consents_profile_idx").on(t.profileId),
    /**
     * One authoritative row per (patient, purpose).
     *
     * Without this the store's insert appended, and `findConsent` — `LIMIT 1`
     * with no ordering — could return the superseded `granted` row after a
     * withdrawal had been written. Recording would then continue for a patient
     * who had exercised DPDP s.6(6), and every surface would look correct.
     *
     * `engagement_consents` has had the equivalent unique index on `phoneHash`
     * since it was written; this table was added without it.
     */
    profilePurposeUx: uniqueIndex("scribe_consents_profile_purpose_ux").on(
      t.profileId,
      t.purpose,
    ),
  }),
);

/**
 * Ambient scribe sessions.
 *
 * `transcript` and `draft` are the most identifying payloads this application
 * stores: a verbatim record of what a patient said about their own body, in
 * their own words, plus whatever a relative in the room volunteered. Both are
 * encrypted jsonb.
 *
 * The audio itself is **not** stored here and no column references it. It is
 * working material with a 24-hour life (`SCRIBE_LIMITS.AUDIO_RETENTION_HOURS`);
 * keeping it alongside the note would build a voice-biometric corpus nobody
 * consented to, one consultation at a time.
 *
 * `attestation` being null is the difference between a draft and a clinical
 * record. Nothing downstream may exchange a row whose attestation is null.
 */
export const scribeSessionsTable = pgTable(
  "scribe_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    clinicianAccountId: text("clinician_account_id").notNull(),
    jurisdiction: text("jurisdiction").notNull(),
    status: text("status").notNull(),
    language: text("language").notNull(),
    mixedWith: jsonb("mixed_with").$type<string[]>().notNull().default([]),
    engine: text("engine"),
    /** Region inference actually ran in, recorded at start for the audit trail. */
    processedInRegion: text("processed_in_region"),
    rolesEstablished: boolean("roles_established").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    /** When the working audio was destroyed. Null means it has not been yet. */
    audioDeletedAt: timestamp("audio_deleted_at", { withTimezone: true }),
    /** Unattested drafts expire; an abandoned session must not linger as a shadow record. */
    draftExpiresAt: timestamp("draft_expires_at", { withTimezone: true }),
    /** Verbatim diarised turns. The most identifying payload here — encrypted. */
    transcript: jsonb("transcript").$type<Record<string, unknown>>(),
    /** Structured note items with their evidence spans — encrypted. */
    draft: jsonb("draft").$type<Record<string, unknown>>(),
    /** Null until a named clinician signs. Null means "not a clinical record". */
    attestation: jsonb("attestation").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profileIdx: index("scribe_sessions_profile_idx").on(t.profileId),
    clinicianIdx: index("scribe_sessions_clinician_idx").on(t.clinicianAccountId),
  }),
);
