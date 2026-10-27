import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, integer, real, serial, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  appleId: text("apple_id").unique(),
  googleId: text("google_id").unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  isDemo: boolean("is_demo").default(false),
  biometricEnabled: boolean("biometric_enabled").default(false),
  autoSyncEnabled: boolean("auto_sync_enabled").default(true),
  notificationsEnabled: boolean("notifications_enabled").default(true),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  consentAiSummary: boolean("consent_ai_summary").default(false),
  consentFastenHealth: boolean("consent_fasten_health").default(false),
  consentGrantedAt: timestamp("consent_granted_at"),
  isVerified: boolean("is_verified").default(false),
  verificationProvider: text("verification_provider"),
  verifiedAt: timestamp("verified_at"),
  securityFlagged: boolean("security_flagged").default(false),
  securityFlaggedAt: timestamp("security_flagged_at"),
  securityFlagReason: text("security_flag_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const healthRecords = pgTable("health_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  date: timestamp("date").notNull(),
  provider: text("provider"),
  facility: text("facility"),
  details: jsonb("details"),
  rawFhirJson: jsonb("raw_fhir_json"),
  sourceId: varchar("source_id").references(() => dataSources.id),
  fhirResourceType: text("fhir_resource_type"),
  fhirResourceId: text("fhir_resource_id"),
  importedAt: timestamp("imported_at").defaultNow(),
  lastSyncedAt: timestamp("last_synced_at"),
  isManual: boolean("is_manual").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const recordAttachments = pgTable("record_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recordId: varchar("record_id").notNull().references(() => healthRecords.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path").notNull(),
  thumbnailPath: text("thumbnail_path"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const dataSources = pgTable("data_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  fhirEndpoint: text("fhir_endpoint"),
  clientId: text("client_id"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  patientId: text("patient_id"),
  isConnected: boolean("is_connected").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  recordCount: integer("record_count").default(0),
  gcpConfig: jsonb("gcp_config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const patients = pgTable("patients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saidPatientId: text("said_patient_id").unique().notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
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
  smsOptInAt: timestamp("sms_opt_in_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const fastenConnections = pgTable("fasten_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  saidPatientId: text("said_patient_id").notNull(),
  sourceType: text("source_type").notNull(),
  sourceName: text("source_name"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  orgConnectionId: text("org_connection_id"),
  lastSyncAt: timestamp("last_sync_at"),
  status: text("status").notNull().default("active"),
  recordCount: integer("record_count").default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const shareLinks = pgTable("share_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  passcode: text("passcode"),
  expiresAt: timestamp("expires_at").notNull(),
  isRevoked: boolean("is_revoked").default(false),
  recordIds: jsonb("record_ids"),
  dateRangeStart: timestamp("date_range_start"),
  dateRangeEnd: timestamp("date_range_end"),
  categories: jsonb("categories"),
  viewCount: integer("view_count").default(0),
  lastViewedAt: timestamp("last_viewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const packets = pgTable("packets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  shareLinkId: varchar("share_link_id").references(() => shareLinks.id),
  title: text("title").notNull(),
  pdfUrl: text("pdf_url"),
  dateRangeStart: timestamp("date_range_start"),
  dateRangeEnd: timestamp("date_range_end"),
  categories: jsonb("categories"),
  recordCount: integer("record_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  saidPatientId: text("said_patient_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  resourceId: varchar("resource_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  requestId: text("request_id"),
  appSource: text("app_source").default("TABULA_MEDICA"),
  blockchainAnchor: text("blockchain_anchor"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payerTokenConnections = pgTable(
  "payer_token_connections",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    accessTokenEncrypted: text("access_token_encrypted").notNull(),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    expiresAt: timestamp("expires_at"),
    fhirBaseUrl: text("fhir_base_url"),
    connectedAt: timestamp("connected_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    // Sync-health tracking (Task #210): surface silently-stale connections so
    // the patient can be re-prompted to reconnect. `syncStatus` is one of
    // "active" | "needs_reauth" | "error". `lastRefreshError` holds a short
    // reason CODE only (never token values / PHI).
    syncStatus: text("sync_status").notNull().default("active"),
    lastRefreshError: text("last_refresh_error"),
    lastRefreshAttemptAt: timestamp("last_refresh_attempt_at"),
    lastSyncedAt: timestamp("last_synced_at"),
    consecutiveRefreshFailures: integer("consecutive_refresh_failures").notNull().default(0),
    nextRefreshRetryAt: timestamp("next_refresh_retry_at"),
    lastRefreshAlertAt: timestamp("last_refresh_alert_at"),
  },
  (t) => ({
    userSourceUnique: unique("payer_token_connections_user_source_idx").on(t.userId, t.sourceType),
  }),
);

export const externalIdentities = pgTable("external_identities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  externalSub: text("external_sub").notNull(),
  email: text("email"),
  emailVerified: boolean("email_verified").default(false),
  linkedAt: timestamp("linked_at").defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
});

export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceId: text("device_id").notNull(),
  deviceName: text("device_name"),
  deviceType: text("device_type"),
  platform: text("platform"),
  browserName: text("browser_name"),
  browserVersion: text("browser_version"),
  ipAddress: text("ip_address"),
  location: text("location"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  accessTokenExpiresAt: timestamp("access_token_expires_at").notNull(),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at").notNull(),
  isActive: boolean("is_active").default(true),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
});

export const shareLinkAccessLogs = pgTable("share_link_access_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shareLinkId: varchar("share_link_id").notNull().references(() => shareLinks.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  accessorIp: text("accessor_ip"),
  accessorUserAgent: text("accessor_user_agent"),
  accessorLocation: text("accessor_location"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  encryptionKeyId: text("encryption_key_id"),
  retentionDays: integer("retention_days").default(2555),
  baaSignedAt: timestamp("baa_signed_at"),
  baaDocumentUrl: text("baa_document_url"),
  settings: jsonb("settings"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tenantUsers = pgTable("tenant_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  invitedAt: timestamp("invited_at"),
  joinedAt: timestamp("joined_at").defaultNow(),
  isActive: boolean("is_active").default(true),
});

export const patientProfiles = pgTable("patient_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  
  // Demographics
  firstName: text("first_name"),
  lastName: text("last_name"),
  middleName: text("middle_name").default("NMN"),
  middleNameStatus: text("middle_name_status").default("no_middle_name"), // has_middle_name, no_middle_name (NMN), unknown
  dateOfBirth: timestamp("date_of_birth"),
  gender: text("gender"),
  pronouns: text("pronouns"),
  maritalStatus: text("marital_status"),
  preferredLanguage: text("preferred_language"),
  ethnicity: text("ethnicity"),
  race: text("race"),
  
  // USCDI v3 Demographics (2026 mandate)
  sexualOrientation: text("sexual_orientation"),
  genderIdentity: text("gender_identity"),
  tribalAffiliation: text("tribal_affiliation"),
  
  // USCDI v3 Related Persons (stored as JSON array: [{name, relationship, phone, email}])
  relatedPersons: jsonb("related_persons"),
  
  // Contact Information
  phone: text("phone"),
  mobilePhone: text("mobile_phone"),
  email: text("email"),
  addressLine1: text("address_line_1"),
  addressLine2: text("address_line_2"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country"),
  
  // Emergency Contacts (stored as JSON array)
  emergencyContacts: jsonb("emergency_contacts"),
  
  // Insurance Information (stored as JSON array for multiple insurances)
  insuranceInfo: jsonb("insurance_info"),
  insuranceCoverageStatus: text("insurance_coverage_status"),
  
  // Deceased Information (FHIR Patient.deceased[x])
  deceasedBoolean: boolean("deceased_boolean").default(false),
  deceasedDate: timestamp("deceased_date"),
  
  // Medical Information Summary
  bloodType: text("blood_type"),
  organDonor: boolean("organ_donor"),
  advanceDirectives: boolean("advance_directives"),
  primaryPhysician: text("primary_physician"),
  primaryPhysicianPhone: text("primary_physician_phone"),
  primaryPhysicianNpi: text("primary_physician_npi"),
  pharmacy: text("pharmacy"),
  pharmacyPhone: text("pharmacy_phone"),
  mailOrderPharmacy: text("mail_order_pharmacy"),
  pharmacySavingsPrograms: jsonb("pharmacy_savings_programs").$type<string[]>(),
  
  // Annual Review tracking
  careTeamReviewedAt: timestamp("care_team_reviewed_at"),
  pharmacyReviewedAt: timestamp("pharmacy_reviewed_at"),
  annualReviewCompletedAt: timestamp("annual_review_completed_at"),
  
  // Profile metadata
  profileCompleteness: integer("profile_completeness").default(0),
  lastUpdatedSection: text("last_updated_section"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPatientProfileSchema = createInsertSchema(patientProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPatientProfile = z.infer<typeof insertPatientProfileSchema>;
export type PatientProfile = typeof patientProfiles.$inferSelect;

export const familyMembers = pgTable("family_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  middleName: text("middle_name"),
  relationship: text("relationship").notNull(),
  dateOfBirth: timestamp("date_of_birth"),
  gender: text("gender"),
  pronouns: text("pronouns"),
  phone: text("phone"),
  email: text("email"),
  bloodType: text("blood_type"),
  preferredLanguage: text("preferred_language"),
  insuranceInfo: jsonb("insurance_info"),
  emergencyContact: jsonb("emergency_contact"),
  primaryPhysician: text("primary_physician"),
  primaryPhysicianPhone: text("primary_physician_phone"),
  pharmacy: text("pharmacy"),
  pharmacyPhone: text("pharmacy_phone"),
  conditions: jsonb("conditions").$type<string[]>(),
  allergies: jsonb("allergies").$type<string[]>(),
  medications: jsonb("medications").$type<string[]>(),
  surgeries: jsonb("surgeries").$type<string[]>(),
  immunizations: jsonb("immunizations").$type<string[]>(),
  familyHistoryNotes: text("family_history_notes"),
  verificationStatus: text("verification_status").default("pending"),
  verificationMethod: text("verification_method"),
  verificationDate: timestamp("verification_date"),
  legalRelationshipDoc: text("legal_relationship_doc"),
  accessLevel: text("access_level").default("full"),
  isMinor: boolean("is_minor").default(false),
  guardianConsent: boolean("guardian_consent").default(false),
  notes: text("notes"),
  avatarColor: text("avatar_color"),
  profileCompleteness: integer("profile_completeness").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type FamilyMember = typeof familyMembers.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHealthRecordSchema = createInsertSchema(healthRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  importedAt: true,
});

export const insertRecordAttachmentSchema = createInsertSchema(recordAttachments).omit({
  id: true,
  uploadedAt: true,
});

export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFastenConnectionSchema = createInsertSchema(fastenConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDataSourceSchema = createInsertSchema(dataSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShareLinkSchema = createInsertSchema(shareLinks).omit({
  id: true,
  createdAt: true,
  viewCount: true,
  lastViewedAt: true,
});

export const insertPacketSchema = createInsertSchema(packets).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
});

export const insertExternalIdentitySchema = createInsertSchema(externalIdentities).omit({
  id: true,
  linkedAt: true,
  lastSeenAt: true,
});

export const insertShareLinkAccessLogSchema = createInsertSchema(shareLinkAccessLogs).omit({
  id: true,
  createdAt: true,
});

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTenantUserSchema = createInsertSchema(tenantUsers).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertHealthRecord = z.infer<typeof insertHealthRecordSchema>;
export type HealthRecord = typeof healthRecords.$inferSelect;
export type RecordAttachment = typeof recordAttachments.$inferSelect;
export type InsertRecordAttachment = z.infer<typeof insertRecordAttachmentSchema>;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patients.$inferSelect;
export type InsertFastenConnection = z.infer<typeof insertFastenConnectionSchema>;
export type FastenConnection = typeof fastenConnections.$inferSelect;
export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
export type DataSource = typeof dataSources.$inferSelect;
export type InsertShareLink = z.infer<typeof insertShareLinkSchema>;
export type ShareLink = typeof shareLinks.$inferSelect;
export type InsertPacket = z.infer<typeof insertPacketSchema>;
export type Packet = typeof packets.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type UserSession = typeof userSessions.$inferSelect;
export type InsertExternalIdentity = z.infer<typeof insertExternalIdentitySchema>;
export type ExternalIdentity = typeof externalIdentities.$inferSelect;
export type InsertShareLinkAccessLog = z.infer<typeof insertShareLinkAccessLogSchema>;
export type ShareLinkAccessLog = typeof shareLinkAccessLogs.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenantUser = z.infer<typeof insertTenantUserSchema>;
export type TenantUser = typeof tenantUsers.$inferSelect;

export const RECORD_TYPES = [
  "visit",
  "lab",
  "medication",
  "imaging",
  "procedure",
  "immunization",
  "allergy",
  "vital",
  "condition",
  "document",
  "dental",
] as const;

export const SOURCE_TYPES = [
  "hospital",
  "clinic",
  "pharmacy",
  "lab",
  "insurance",
  "imaging_center",
  "manual",
  "tefca",
  "dental_office",
] as const;

// FHIR Integration Metrics
export const fhirMetrics = pgTable("fhir_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").references(() => dataSources.id),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  statusCode: integer("status_code"),
  latencyMs: integer("latency_ms"),
  resourceType: text("resource_type"),
  resourceCount: integer("resource_count"),
  errorMessage: text("error_message"),
  fhirVersion: text("fhir_version"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// FHIR Alerts
export const fhirAlerts = pgTable("fhir_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").references(() => dataSources.id),
  alertType: text("alert_type").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  isResolved: boolean("is_resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Deduplication AI-health metrics (Task #221)
// Single-row ("global") durable counter store for the Vertex deduplication
// service. The service previously held these counters in a module-level
// in-memory object that reset on every restart/redeploy and was per-Cloud-Run
// -instance. This table aggregates them additively across instances and
// survives restarts so the /api/phr/dedup/status endpoint and future
// operational alerting see a stable, cross-instance picture of AI vs
// rule-based fallback activity and the consecutive-failure streak.
export const deduplicationMetrics = pgTable("deduplication_metrics", {
  id: varchar("id").primaryKey().default("global"),
  totalProcessed: integer("total_processed").notNull().default(0),
  totalDuplicatesFound: integer("total_duplicates_found").notNull().default(0),
  totalMerged: integer("total_merged").notNull().default(0),
  lastRunAt: timestamp("last_run_at"),
  aiComparisons: integer("ai_comparisons").notNull().default(0),
  ruleBasedFallbacks: integer("rule_based_fallbacks").notNull().default(0),
  consecutiveAiFailures: integer("consecutive_ai_failures").notNull().default(0),
  maxConsecutiveAiFailures: integer("max_consecutive_ai_failures").notNull().default(0),
  lastAiFailureReason: text("last_ai_failure_reason"),
  lastAiFailureAt: timestamp("last_ai_failure_at"),
  lastAiSuccessAt: timestamp("last_ai_success_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Harmonized Patient Records (unified view across sources)
export const harmonizedPatients = pgTable("harmonized_patients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  canonicalId: text("canonical_id").notNull(),
  matchConfidence: integer("match_confidence"),
  matchMethod: text("match_method"),
  linkedRecordIds: jsonb("linked_record_ids"),
  linkedSourceIds: jsonb("linked_source_ids"),
  demographics: jsonb("demographics"),
  inferredInsights: jsonb("inferred_insights"),
  lastHarmonizedAt: timestamp("last_harmonized_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Resource Version History
export const resourceVersions = pgTable("resource_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recordId: varchar("record_id").notNull().references(() => healthRecords.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  fhirVersion: text("fhir_version"),
  rawData: jsonb("raw_data").notNull(),
  changeType: text("change_type").notNull(),
  changedBy: text("changed_by"),
  changeReason: text("change_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Data Conflicts
export const dataConflicts = pgTable("data_conflicts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recordIds: jsonb("record_ids").notNull(),
  conflictType: text("conflict_type").notNull(),
  field: text("field").notNull(),
  values: jsonb("values").notNull(),
  resolution: text("resolution"),
  resolvedValue: jsonb("resolved_value"),
  isResolved: boolean("is_resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: text("resolved_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bulk Import Jobs
export const bulkImportJobs = pgTable("bulk_import_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  format: text("format").notNull(),
  status: text("status").notNull(),
  totalResources: integer("total_resources").default(0),
  processedResources: integer("processed_resources").default(0),
  failedResources: integer("failed_resources").default(0),
  errors: jsonb("errors"),
  metadata: jsonb("metadata"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// FHIR Sync Jobs - Tracks synchronization with external FHIR servers
export const fhirSyncJobs = pgTable("fhir_sync_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceId: varchar("source_id").notNull().references(() => dataSources.id, { onDelete: "cascade" }),
  direction: text("direction").notNull(), // 'import', 'export', 'bidirectional'
  status: text("status").notNull(), // 'pending', 'connecting', 'syncing', 'completed', 'failed', 'cancelled'
  phase: text("phase"), // 'authentication', 'discovery', 'fetching', 'processing', 'uploading', 'finalizing'
  totalResources: integer("total_resources").default(0),
  processedResources: integer("processed_resources").default(0),
  importedResources: integer("imported_resources").default(0),
  exportedResources: integer("exported_resources").default(0),
  skippedResources: integer("skipped_resources").default(0),
  failedResources: integer("failed_resources").default(0),
  conflictsDetected: integer("conflicts_detected").default(0),
  conflictsResolved: integer("conflicts_resolved").default(0),
  errors: jsonb("errors"), // Array of { resourceType, resourceId, error, timestamp }
  warnings: jsonb("warnings"), // Array of { message, details, timestamp }
  resourceTypes: jsonb("resource_types"), // Array of resource types being synced
  lastResourceType: text("last_resource_type"),
  lastResourceId: text("last_resource_id"),
  progressPercentage: integer("progress_percentage").default(0),
  bytesTransferred: integer("bytes_transferred").default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  nextRetryAt: timestamp("next_retry_at"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// FHIR Connection Configs - Extended configs for external FHIR servers
export const fhirConnectionConfigs = pgTable("fhir_connection_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull().references(() => dataSources.id, { onDelete: "cascade" }).unique(),
  authType: text("auth_type").notNull(), // 'none', 'basic', 'bearer', 'oauth2', 'smart_on_fhir'
  fhirVersion: text("fhir_version"), // 'DSTU2', 'STU3', 'R4', 'R5'
  capabilityStatement: jsonb("capability_statement"),
  supportedResources: jsonb("supported_resources"), // Array of supported resource types
  supportedOperations: jsonb("supported_operations"), // Array of supported operations
  syncConfig: jsonb("sync_config"), // { autoSync, syncInterval, resourceTypes, conflictResolution }
  lastCapabilityCheck: timestamp("last_capability_check"),
  connectionTestResult: jsonb("connection_test_result"), // { success, latencyMs, timestamp, errors }
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFhirSyncJobSchema = createInsertSchema(fhirSyncJobs).omit({
  id: true,
  createdAt: true,
});

export const insertFhirConnectionConfigSchema = createInsertSchema(fhirConnectionConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFhirMetricSchema = createInsertSchema(fhirMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertFhirAlertSchema = createInsertSchema(fhirAlerts).omit({
  id: true,
  createdAt: true,
});

export const insertHarmonizedPatientSchema = createInsertSchema(harmonizedPatients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertResourceVersionSchema = createInsertSchema(resourceVersions).omit({
  id: true,
  createdAt: true,
});

// FHIR Mapping Rules - Defines how FHIR resources map to internal health records
export const fhirMappingRules = pgTable("fhir_mapping_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sourceId: varchar("source_id").references(() => dataSources.id, { onDelete: "cascade" }), // null = global rule
  name: text("name").notNull(),
  description: text("description"),
  fhirResourceType: text("fhir_resource_type").notNull(), // 'Observation', 'Condition', 'MedicationRequest', etc.
  internalRecordType: text("internal_record_type").notNull(), // 'lab', 'vital', 'medication', 'condition', etc.
  priority: integer("priority").default(0), // Higher priority rules applied first
  isActive: boolean("is_active").default(true),
  isDefault: boolean("is_default").default(false), // System default rules
  
  // Field mappings as JSON array: [{fhirPath, internalField, transform, defaultValue, required}]
  fieldMappings: jsonb("field_mappings").notNull(),
  
  // Conditions for when this rule applies: [{field, operator, value}]
  conditions: jsonb("conditions"),
  
  // Validation rules: [{field, rule, params, errorMessage}]
  validationRules: jsonb("validation_rules"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// FHIR Transformation Functions - Reusable transformation definitions
export const fhirTransformations = pgTable("fhir_transformations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // null = system transformation
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // 'text', 'date', 'numeric', 'code', 'reference', 'custom'
  transformType: text("transform_type").notNull(), // 'format', 'convert', 'lookup', 'extract', 'combine', 'regex'
  
  // Configuration for the transformation
  config: jsonb("config").notNull(), // { pattern, replacement, format, lookupTable, expression }
  
  // Input/output type hints for validation
  inputType: text("input_type"), // 'string', 'number', 'date', 'object', 'array'
  outputType: text("output_type"),
  
  // Example input/output for documentation
  examples: jsonb("examples"),
  
  isSystem: boolean("is_system").default(false), // Built-in transformations
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// FHIR Code Mappings - Maps between code systems (LOINC, SNOMED, ICD-10, etc.)
export const fhirCodeMappings = pgTable("fhir_code_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }), // null = system mapping
  sourceSystem: text("source_system").notNull(), // 'http://loinc.org', 'http://snomed.info/sct', etc.
  sourceCode: text("source_code").notNull(),
  sourceDisplay: text("source_display"),
  targetSystem: text("target_system").notNull(),
  targetCode: text("target_code").notNull(),
  targetDisplay: text("target_display"),
  equivalence: text("equivalence").default("equivalent"), // 'equivalent', 'wider', 'narrower', 'inexact', 'unmatched'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// FHIR Validation Results - Tracks validation outcomes during sync
export const fhirValidationResults = pgTable("fhir_validation_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  syncJobId: varchar("sync_job_id").references(() => fhirSyncJobs.id, { onDelete: "cascade" }),
  mappingRuleId: varchar("mapping_rule_id").references(() => fhirMappingRules.id, { onDelete: "set null" }),
  resourceId: text("resource_id"),
  resourceType: text("resource_type").notNull(),
  direction: text("direction").notNull(), // 'import', 'export'
  status: text("status").notNull(), // 'valid', 'warning', 'error', 'skipped'
  issues: jsonb("issues"), // Array of {severity, field, message, code}
  originalData: jsonb("original_data"),
  transformedData: jsonb("transformed_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fhirResourceSyncConfigs = pgTable("fhir_resource_sync_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id").notNull().references(() => dataSources.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  resourceType: text("resource_type").notNull(),
  enabled: boolean("enabled").default(true),
  syncDirection: text("sync_direction").default("import"), // 'import', 'export', 'bidirectional'
  validationProfile: text("validation_profile"), // 'US_CORE', 'ARGONAUT', 'IPS', 'AU_CORE', 'UK_CORE', null for basic
  validationMode: text("validation_mode").default("warning"), // 'strict', 'warning', 'skip'
  priority: integer("priority").default(100),
  filterConditions: jsonb("filter_conditions").$type<Array<{
    field: string;
    operator: string;
    value: string;
  }>>(),
  transformOnImport: boolean("transform_on_import").default(true),
  mappingToRecordType: text("mapping_to_record_type"), // Override default mapping
  lastSyncCount: integer("last_sync_count").default(0),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFhirResourceSyncConfigSchema = createInsertSchema(fhirResourceSyncConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type FhirResourceSyncConfig = typeof fhirResourceSyncConfigs.$inferSelect;
export type InsertFhirResourceSyncConfig = typeof fhirResourceSyncConfigs.$inferInsert;

export const SUPPORTED_FHIR_RESOURCES = [
  { type: "Patient", category: "administrative", description: "Demographics and administrative information", defaultEnabled: true },
  { type: "Observation", category: "clinical", description: "Lab results, vital signs, and measurements", defaultEnabled: true },
  { type: "Condition", category: "clinical", description: "Problems, diagnoses, and health conditions", defaultEnabled: true },
  { type: "MedicationRequest", category: "medication", description: "Medication prescriptions and orders", defaultEnabled: true },
  { type: "Medication", category: "medication", description: "Medication definitions and details", defaultEnabled: true },
  { type: "MedicationStatement", category: "medication", description: "Medications being taken", defaultEnabled: true },
  { type: "MedicationDispense", category: "medication", description: "Medication dispensing records", defaultEnabled: false },
  { type: "Procedure", category: "clinical", description: "Performed procedures and surgeries", defaultEnabled: true },
  { type: "Immunization", category: "clinical", description: "Vaccination records", defaultEnabled: true },
  { type: "AllergyIntolerance", category: "clinical", description: "Allergies and adverse reactions", defaultEnabled: true },
  { type: "DiagnosticReport", category: "diagnostic", description: "Diagnostic test reports", defaultEnabled: true },
  { type: "DocumentReference", category: "document", description: "Clinical documents and attachments", defaultEnabled: false },
  { type: "Encounter", category: "administrative", description: "Healthcare visits and encounters", defaultEnabled: true },
  { type: "CarePlan", category: "clinical", description: "Care plans and treatment goals", defaultEnabled: false },
  { type: "CareTeam", category: "administrative", description: "Care team members", defaultEnabled: false },
  { type: "Goal", category: "clinical", description: "Patient health goals", defaultEnabled: false },
  { type: "ServiceRequest", category: "workflow", description: "Requested services and orders", defaultEnabled: false },
  { type: "Coverage", category: "financial", description: "Insurance coverage information", defaultEnabled: false },
  { type: "Claim", category: "financial", description: "Insurance claims", defaultEnabled: false },
  { type: "ExplanationOfBenefit", category: "financial", description: "Benefits explanations", defaultEnabled: false },
  { type: "FamilyMemberHistory", category: "clinical", description: "Family medical history", defaultEnabled: false },
  { type: "DeviceUseStatement", category: "clinical", description: "Medical device usage", defaultEnabled: false },
  { type: "Consent", category: "privacy", description: "Patient consents", defaultEnabled: false },
  { type: "QuestionnaireResponse", category: "clinical", description: "Completed questionnaires and assessments", defaultEnabled: false },
  { type: "RiskAssessment", category: "clinical", description: "Risk assessment results", defaultEnabled: false },
] as const;

export const VALIDATION_PROFILES = [
  { id: "US_CORE", name: "US Core", description: "US Core Implementation Guide (4.0.0)", region: "United States" },
  { id: "ARGONAUT", name: "Argonaut", description: "Argonaut Data Query IG", region: "United States" },
  { id: "IPS", name: "International Patient Summary", description: "IPS Implementation Guide", region: "International" },
  { id: "AU_CORE", name: "AU Core", description: "Australian Core IG", region: "Australia" },
  { id: "UK_CORE", name: "UK Core", description: "UK Core FHIR Assets", region: "United Kingdom" },
] as const;

export const insertFhirMappingRuleSchema = createInsertSchema(fhirMappingRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFhirTransformationSchema = createInsertSchema(fhirTransformations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFhirCodeMappingSchema = createInsertSchema(fhirCodeMappings).omit({
  id: true,
  createdAt: true,
});

export const insertFhirValidationResultSchema = createInsertSchema(fhirValidationResults).omit({
  id: true,
  createdAt: true,
});

export const insertDataConflictSchema = createInsertSchema(dataConflicts).omit({
  id: true,
  createdAt: true,
});

export const insertBulkImportJobSchema = createInsertSchema(bulkImportJobs).omit({
  id: true,
  createdAt: true,
});

export type InsertFhirMetric = z.infer<typeof insertFhirMetricSchema>;
export type FhirMetric = typeof fhirMetrics.$inferSelect;
export type InsertFhirAlert = z.infer<typeof insertFhirAlertSchema>;
export type FhirAlert = typeof fhirAlerts.$inferSelect;
export type InsertHarmonizedPatient = z.infer<typeof insertHarmonizedPatientSchema>;
export type HarmonizedPatient = typeof harmonizedPatients.$inferSelect;
export type InsertResourceVersion = z.infer<typeof insertResourceVersionSchema>;
export type ResourceVersion = typeof resourceVersions.$inferSelect;
export type InsertDataConflict = z.infer<typeof insertDataConflictSchema>;
export type DataConflict = typeof dataConflicts.$inferSelect;
export type InsertBulkImportJob = z.infer<typeof insertBulkImportJobSchema>;
export type BulkImportJob = typeof bulkImportJobs.$inferSelect;
export type InsertFhirSyncJob = z.infer<typeof insertFhirSyncJobSchema>;
export type FhirSyncJob = typeof fhirSyncJobs.$inferSelect;
export type InsertFhirConnectionConfig = z.infer<typeof insertFhirConnectionConfigSchema>;
export type FhirConnectionConfig = typeof fhirConnectionConfigs.$inferSelect;

export type RecordType = (typeof RECORD_TYPES)[number];
export type SourceType = (typeof SOURCE_TYPES)[number];

export const ALERT_SEVERITIES = ["info", "warning", "error", "critical"] as const;
export const BULK_IMPORT_FORMATS = ["ndjson", "fhir_bundle", "csv"] as const;
export const CONFLICT_TYPES = ["value_mismatch", "date_mismatch", "duplicate", "semantic"] as const;
export const MATCH_METHODS = ["deterministic", "probabilistic", "hybrid"] as const;

export const SYNC_DIRECTIONS = ["import", "export", "bidirectional"] as const;
export const SYNC_STATUSES = ["pending", "connecting", "syncing", "completed", "failed", "cancelled"] as const;
export const SYNC_PHASES = ["authentication", "discovery", "fetching", "processing", "uploading", "finalizing"] as const;
export const AUTH_TYPES = ["none", "basic", "bearer", "oauth2", "smart_on_fhir"] as const;
export const FHIR_VERSIONS = ["DSTU2", "STU3", "R4", "R5"] as const;
export const CONFLICT_RESOLUTIONS = ["keep_local", "keep_remote", "keep_newest", "keep_oldest", "manual"] as const;

// FHIR Profiles for semantic validation
export const fhirProfiles = pgTable("fhir_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull().unique(),
  name: text("name").notNull(),
  version: text("version"),
  fhirVersion: text("fhir_version").notNull(),
  resourceType: text("resource_type").notNull(),
  jurisdiction: text("jurisdiction"),
  description: text("description"),
  profileJson: jsonb("profile_json"),
  requiredElements: jsonb("required_elements"),
  constraints: jsonb("constraints"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Value Sets for integrity checks
export const fhirValueSets = pgTable("fhir_value_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull().unique(),
  name: text("name").notNull(),
  version: text("version"),
  codeSystem: text("code_system").notNull(),
  expansion: jsonb("expansion"),
  conceptCount: integer("concept_count").default(0),
  isActive: boolean("is_active").default(true),
  lastExpanded: timestamp("last_expanded"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Terminology Mappings (SNOMED CT, LOINC, ICD-10 cross-mapping)
export const terminologyMappings = pgTable("terminology_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceSystem: text("source_system").notNull(),
  sourceCode: text("source_code").notNull(),
  sourceDisplay: text("source_display"),
  targetSystem: text("target_system").notNull(),
  targetCode: text("target_code").notNull(),
  targetDisplay: text("target_display"),
  equivalenceType: text("equivalence_type").notNull(),
  confidence: integer("confidence"),
  mappingSource: text("mapping_source"),
  isVerified: boolean("is_verified").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Validation Results
export const validationResults = pgTable("validation_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  recordId: varchar("record_id").references(() => healthRecords.id, { onDelete: "cascade" }),
  sourceId: varchar("source_id").references(() => dataSources.id),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  profileUrl: text("profile_url"),
  isValid: boolean("is_valid").notNull(),
  severity: text("severity").notNull(),
  issues: jsonb("issues"),
  suggestions: jsonb("suggestions"),
  validatedAt: timestamp("validated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Canonical Patient View (unified harmonized data)
export const canonicalPatientViews = pgTable("canonical_patient_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  resourceType: text("resource_type").notNull(),
  canonicalData: jsonb("canonical_data").notNull(),
  sourceRecordIds: jsonb("source_record_ids"),
  terminologyMappings: jsonb("terminology_mappings"),
  harmonizationScore: integer("harmonization_score"),
  lastHarmonizedAt: timestamp("last_harmonized_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Harmonization Rules
export const harmonizationRules = pgTable("harmonization_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  resourceType: text("resource_type").notNull(),
  ruleType: text("rule_type").notNull(),
  priority: integer("priority").default(0),
  conditions: jsonb("conditions"),
  transformations: jsonb("transformations"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFhirProfileSchema = createInsertSchema(fhirProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFhirValueSetSchema = createInsertSchema(fhirValueSets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTerminologyMappingSchema = createInsertSchema(terminologyMappings).omit({
  id: true,
  createdAt: true,
});

export const insertValidationResultSchema = createInsertSchema(validationResults).omit({
  id: true,
  createdAt: true,
});

export const insertCanonicalPatientViewSchema = createInsertSchema(canonicalPatientViews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertHarmonizationRuleSchema = createInsertSchema(harmonizationRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFhirProfile = z.infer<typeof insertFhirProfileSchema>;
export type FhirProfile = typeof fhirProfiles.$inferSelect;
export type InsertFhirValueSet = z.infer<typeof insertFhirValueSetSchema>;
export type FhirValueSet = typeof fhirValueSets.$inferSelect;
export type InsertTerminologyMapping = z.infer<typeof insertTerminologyMappingSchema>;
export type TerminologyMapping = typeof terminologyMappings.$inferSelect;
export type InsertValidationResult = z.infer<typeof insertValidationResultSchema>;
export type ValidationResult = typeof validationResults.$inferSelect;
export type InsertCanonicalPatientView = z.infer<typeof insertCanonicalPatientViewSchema>;
export type CanonicalPatientView = typeof canonicalPatientViews.$inferSelect;
export type InsertHarmonizationRule = z.infer<typeof insertHarmonizationRuleSchema>;
export type HarmonizationRule = typeof harmonizationRules.$inferSelect;

export const TERMINOLOGY_SYSTEMS = [
  "http://snomed.info/sct",
  "http://loinc.org",
  "http://hl7.org/fhir/sid/icd-10",
  "http://hl7.org/fhir/sid/icd-10-cm",
  "http://www.nlm.nih.gov/research/umls/rxnorm",
  "http://hl7.org/fhir/sid/cvx",
  "http://hl7.org/fhir/sid/ndc",
] as const;

export const EQUIVALENCE_TYPES = [
  "equivalent",
  "equal",
  "wider",
  "narrower",
  "inexact",
  "unmatched",
  "disjoint",
] as const;

export const VALIDATION_SEVERITIES = ["fatal", "error", "warning", "information"] as const;

export const HARMONIZATION_RULE_TYPES = [
  "terminology_mapping",
  "unit_conversion",
  "date_normalization",
  "identifier_resolution",
  "duplicate_detection",
  "semantic_enrichment",
] as const;

// SMART on FHIR App Registrations
export const smartApps = pgTable("smart_apps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret"),
  redirectUri: text("redirect_uri").notNull(),
  scopes: jsonb("scopes").$type<string[]>().default([]),
  launchUrl: text("launch_url"),
  logoUrl: text("logo_url"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  lastAccessedAt: timestamp("last_accessed_at"),
  accessCount: integer("access_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// SMART App Access Logs
export const smartAppAccessLogs = pgTable("smart_app_access_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appId: varchar("app_id").notNull().references(() => smartApps.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  resourceCount: integer("resource_count"),
  scopesUsed: jsonb("scopes_used").$type<string[]>(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  responseTime: integer("response_time"),
  statusCode: integer("status_code"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// SMART App OAuth Tokens
export const smartAppTokens = pgTable("smart_app_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appId: varchar("app_id").notNull().references(() => smartApps.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenType: text("token_type").default("Bearer"),
  expiresAt: timestamp("expires_at").notNull(),
  scopes: jsonb("scopes").$type<string[]>().default([]),
  patientId: text("patient_id"),
  isRevoked: boolean("is_revoked").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Chat conversations for AI features
export const conversations = pgTable("conversations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSmartAppSchema = createInsertSchema(smartApps).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSmartAppAccessLogSchema = createInsertSchema(smartAppAccessLogs).omit({
  id: true,
  createdAt: true,
});

export const insertSmartAppTokenSchema = createInsertSchema(smartAppTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SmartApp = typeof smartApps.$inferSelect;
export type InsertSmartApp = z.infer<typeof insertSmartAppSchema>;
export type SmartAppAccessLog = typeof smartAppAccessLogs.$inferSelect;
export type InsertSmartAppAccessLog = z.infer<typeof insertSmartAppAccessLogSchema>;
export type SmartAppToken = typeof smartAppTokens.$inferSelect;
export type InsertSmartAppToken = z.infer<typeof insertSmartAppTokenSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;

// ============================================
// AI-Powered FHIR Analytics Tables
// ============================================

// Health Predictions - AI-generated health trend forecasts
export const healthPredictions = pgTable("health_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  predictionType: text("prediction_type").notNull(), // trend, risk, recommendation
  category: text("category").notNull(), // vitals, labs, conditions, medications
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  confidence: integer("confidence").default(0), // 0-100
  riskLevel: text("risk_level"), // low, moderate, high, critical
  timeframe: text("timeframe"), // next_week, next_month, next_quarter, next_year
  dataPoints: jsonb("data_points").$type<any[]>(), // historical data used for prediction
  predictedValues: jsonb("predicted_values").$type<any[]>(), // forecasted values
  recommendations: jsonb("recommendations").$type<string[]>(),
  relatedRecordIds: jsonb("related_record_ids").$type<string[]>(),
  aiModel: text("ai_model").default("gpt-5.2"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Anomaly Detections - Unusual patterns or data quality issues
export const anomalyDetections = pgTable("anomaly_detections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  anomalyType: text("anomaly_type").notNull(), // data_quality, clinical, pattern, duplicate
  severity: text("severity").notNull(), // info, warning, critical
  category: text("category").notNull(), // vitals, labs, medications, conditions
  title: text("title").notNull(),
  description: text("description").notNull(),
  affectedRecordIds: jsonb("affected_record_ids").$type<string[]>(),
  expectedValue: text("expected_value"),
  actualValue: text("actual_value"),
  deviation: integer("deviation"), // percentage deviation from normal
  suggestedAction: text("suggested_action"),
  isResolved: boolean("is_resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
  aiModel: text("ai_model").default("gpt-5.2"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Natural Language Queries - User queries and AI responses
export const nlQueries = pgTable("nl_queries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  query: text("query").notNull(),
  queryType: text("query_type").notNull(), // search, aggregate, trend, comparison
  parsedIntent: jsonb("parsed_intent").$type<{
    action: string;
    entities: any[];
    filters: any;
    timeRange?: any;
  }>(),
  generatedSql: text("generated_sql"),
  resultSummary: text("result_summary"),
  resultCount: integer("result_count"),
  resultData: jsonb("result_data"),
  relatedRecordIds: jsonb("related_record_ids").$type<string[]>(),
  aiModel: text("ai_model").default("gpt-5.2"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  processingTimeMs: integer("processing_time_ms"),
  feedback: text("feedback"), // helpful, not_helpful
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Population Analytics - Aggregated insights for at-risk populations
export const populationAnalytics = pgTable("population_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  analysisType: text("analysis_type").notNull(), // cohort, risk_stratification, trend
  cohortCriteria: jsonb("cohort_criteria").$type<any>(),
  metrics: jsonb("metrics").$type<{
    totalPatients?: number;
    riskDistribution?: any;
    commonConditions?: any[];
    trends?: any[];
  }>(),
  insights: jsonb("insights").$type<string[]>(),
  visualizationData: jsonb("visualization_data"),
  aiModel: text("ai_model").default("gpt-5.2"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHealthPredictionSchema = createInsertSchema(healthPredictions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAnomalyDetectionSchema = createInsertSchema(anomalyDetections).omit({
  id: true,
  createdAt: true,
});

export const insertNlQuerySchema = createInsertSchema(nlQueries).omit({
  id: true,
  createdAt: true,
});

export const insertPopulationAnalyticsSchema = createInsertSchema(populationAnalytics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type HealthPrediction = typeof healthPredictions.$inferSelect;
export type InsertHealthPrediction = z.infer<typeof insertHealthPredictionSchema>;
export type AnomalyDetection = typeof anomalyDetections.$inferSelect;
export type InsertAnomalyDetection = z.infer<typeof insertAnomalyDetectionSchema>;
export type NlQuery = typeof nlQueries.$inferSelect;
export type InsertNlQuery = z.infer<typeof insertNlQuerySchema>;
export type PopulationAnalytics = typeof populationAnalytics.$inferSelect;
export type InsertPopulationAnalytics = z.infer<typeof insertPopulationAnalyticsSchema>;

// Health Reports - Comprehensive personalized health summaries
export const healthReports = pgTable("health_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reportType: text("report_type").notNull(), // comprehensive, condition_specific, periodic, risk_assessment
  title: text("title").notNull(),
  executiveSummary: text("executive_summary").notNull(),
  overallHealthScore: integer("overall_health_score"), // 0-100
  healthStatus: text("health_status"), // excellent, good, fair, needs_attention, critical
  sections: jsonb("sections").$type<Array<{
    title: string;
    category: string;
    content: string;
    keyFindings: string[];
    recommendations: string[];
    riskLevel?: string;
    trendDirection?: string;
  }>>(),
  trends: jsonb("trends").$type<Array<{
    metric: string;
    category: string;
    direction: string;
    significance: string;
    dataPoints: Array<{ date: string; value: number }>;
    analysis: string;
  }>>(),
  riskFactors: jsonb("risk_factors").$type<Array<{
    name: string;
    level: string;
    description: string;
    mitigation: string[];
  }>>(),
  actionItems: jsonb("action_items").$type<Array<{
    priority: string;
    category: string;
    action: string;
    dueDate?: string;
    rationale: string;
  }>>(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  recordsAnalyzed: integer("records_analyzed"),
  relatedRecordIds: jsonb("related_record_ids").$type<string[]>(),
  aiModel: text("ai_model").default("gpt-4o"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  generationTimeMs: integer("generation_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Trend Analysis - Detailed analysis of health metric trends
export const trendAnalyses = pgTable("trend_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // vitals, labs, conditions, medications, overall
  metric: text("metric").notNull(), // blood_pressure, glucose, weight, etc.
  analysisType: text("analysis_type").notNull(), // time_series, comparative, correlation
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  trendDirection: text("trend_direction"), // improving, stable, declining, fluctuating
  significance: text("significance"), // high, medium, low
  changePercentage: integer("change_percentage"),
  dataPoints: jsonb("data_points").$type<Array<{
    date: string;
    value: number;
    label?: string;
    isAnomaly?: boolean;
  }>>(),
  projectedValues: jsonb("projected_values").$type<Array<{
    date: string;
    value: number;
    confidence: number;
  }>>(),
  correlations: jsonb("correlations").$type<Array<{
    metric: string;
    correlation: number;
    relationship: string;
  }>>(),
  clinicalInsights: jsonb("clinical_insights").$type<string[]>(),
  recommendations: jsonb("recommendations").$type<string[]>(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  relatedRecordIds: jsonb("related_record_ids").$type<string[]>(),
  aiModel: text("ai_model").default("gpt-4o"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHealthReportSchema = createInsertSchema(healthReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrendAnalysisSchema = createInsertSchema(trendAnalyses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type HealthReport = typeof healthReports.$inferSelect;
export type InsertHealthReport = z.infer<typeof insertHealthReportSchema>;
export type TrendAnalysis = typeof trendAnalyses.$inferSelect;
export type InsertTrendAnalysis = z.infer<typeof insertTrendAnalysisSchema>;

// ============================================
// Access Control & Consent Management Tables
// ============================================

// User Roles - Define user roles (patient, provider, admin, caregiver, etc.)
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false), // Built-in roles cannot be deleted
  priority: integer("priority").default(0), // Higher priority roles take precedence
  // Non-null only for portal-created custom roles; identifies the portal organization
  // that owns the role. System roles always have NULL here. Used to enforce
  // cross-tenant isolation: a portal admin can only see/edit roles belonging to
  // their own organization. (Added Task #160.)
  portalOrganization: text("portal_organization"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Role Assignments - Assign roles to users
export const userRoleAssignments = pgTable("user_role_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: varchar("role_id").notNull().references(() => userRoles.id, { onDelete: "cascade" }),
  assignedBy: varchar("assigned_by").references(() => users.id),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// FHIR Resource Permissions - Define what each role can do with FHIR resources
export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull().references(() => userRoles.id, { onDelete: "cascade" }),
  resourceType: text("resource_type").notNull(), // FHIR resource type or "*" for all
  action: text("action").notNull(), // read, write, delete, search, or *
  scope: text("scope"), // SMART scope pattern (e.g., patient/*.read)
  conditions: jsonb("conditions"), // Additional conditions (e.g., only own records)
  isAllowed: boolean("is_allowed").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Access Policies - Fine-grained access control policies
export const accessPolicies = pgTable("access_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  policyType: text("policy_type").notNull(), // user, app, role, default
  targetType: text("target_type").notNull(), // user_id, role_id, app_id
  targetId: varchar("target_id"),
  resourceType: text("resource_type").notNull(), // FHIR resource type
  resourceFilter: jsonb("resource_filter"), // Filter conditions for resources
  allowedActions: jsonb("allowed_actions").$type<string[]>().default([]),
  deniedActions: jsonb("denied_actions").$type<string[]>().default([]),
  priority: integer("priority").default(0),
  effectiveFrom: timestamp("effective_from"),
  effectiveUntil: timestamp("effective_until"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Patient Consents - Track patient consent for data sharing
export const patientConsents = pgTable("patient_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientUserId: varchar("patient_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  appId: varchar("app_id").references(() => smartApps.id, { onDelete: "cascade" }),
  consentType: text("consent_type").notNull(), // app_access, data_sharing, research, treatment
  status: text("status").notNull().default("active"), // active, revoked, expired, pending
  scope: jsonb("scope").$type<string[]>().default([]), // SMART scopes consented
  resourceTypes: jsonb("resource_types").$type<string[]>().default([]), // Allowed FHIR resource types
  purpose: text("purpose"), // Purpose of data access
  dataPeriodStart: timestamp("data_period_start"), // Only allow access to data from this date
  dataPeriodEnd: timestamp("data_period_end"), // Only allow access to data until this date
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  revokedReason: text("revoked_reason"),
  consentDocument: text("consent_document"), // Link to consent form
  signatureMethod: text("signature_method"), // electronic, written
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Consent Audit Trail - Track all consent-related actions
export const consentAuditLogs = pgTable("consent_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  consentId: varchar("consent_id").notNull().references(() => patientConsents.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // granted, modified, revoked, expired, accessed
  performedBy: varchar("performed_by").references(() => users.id),
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  changesApplied: jsonb("changes_applied"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Access Decision Logs - Track authorization decisions for compliance
export const accessDecisionLogs = pgTable("access_decision_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  appId: varchar("app_id").references(() => smartApps.id),
  resourceType: text("resource_type").notNull(),
  resourceId: varchar("resource_id"),
  action: text("action").notNull(),
  decision: text("decision").notNull(), // permit, deny
  decisionReason: text("decision_reason"),
  policyId: varchar("policy_id").references(() => accessPolicies.id),
  consentId: varchar("consent_id").references(() => patientConsents.id),
  scopesRequested: jsonb("scopes_requested").$type<string[]>(),
  scopesGranted: jsonb("scopes_granted").$type<string[]>(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  responseTimeMs: integer("response_time_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserRoleAssignmentSchema = createInsertSchema(userRoleAssignments).omit({
  id: true,
  createdAt: true,
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAccessPolicySchema = createInsertSchema(accessPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPatientConsentSchema = createInsertSchema(patientConsents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConsentAuditLogSchema = createInsertSchema(consentAuditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertAccessDecisionLogSchema = createInsertSchema(accessDecisionLogs).omit({
  id: true,
  createdAt: true,
});

export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRoleAssignment = typeof userRoleAssignments.$inferSelect;
export type InsertUserRoleAssignment = z.infer<typeof insertUserRoleAssignmentSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type AccessPolicy = typeof accessPolicies.$inferSelect;
export type InsertAccessPolicy = z.infer<typeof insertAccessPolicySchema>;
export type PatientConsent = typeof patientConsents.$inferSelect;
export type InsertPatientConsent = z.infer<typeof insertPatientConsentSchema>;
export type ConsentAuditLog = typeof consentAuditLogs.$inferSelect;
export type InsertConsentAuditLog = z.infer<typeof insertConsentAuditLogSchema>;
export type AccessDecisionLog = typeof accessDecisionLogs.$inferSelect;
export type InsertAccessDecisionLog = z.infer<typeof insertAccessDecisionLogSchema>;

// Access Control Constants
export const USER_ROLE_TYPES = ["patient", "caregiver", "provider", "admin", "researcher"] as const;
export const CONSENT_TYPES = ["app_access", "data_sharing", "research", "treatment", "emergency"] as const;
export const CONSENT_STATUSES = ["active", "revoked", "expired", "pending", "denied"] as const;
export const ACCESS_ACTIONS = ["read", "write", "delete", "search", "history", "*"] as const;
export const ACCESS_DECISIONS = ["permit", "deny"] as const;
export const POLICY_TYPES = ["user", "app", "role", "default", "emergency"] as const;

// Health Goals Schema
export const GOAL_CATEGORIES = ["exercise", "nutrition", "medication", "weight", "sleep", "mental_health", "vitals", "custom"] as const;
export const GOAL_FREQUENCIES = ["daily", "weekly", "monthly"] as const;
export const GOAL_STATUSES = ["active", "paused", "completed", "abandoned"] as const;

export const healthGoals = pgTable("health_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(), // exercise, nutrition, medication, weight, sleep, mental_health, vitals, custom
  targetValue: integer("target_value"), // numeric target (e.g., 10000 steps, 150 lbs)
  targetUnit: text("target_unit"), // steps, lbs, mg, hours, etc.
  frequency: text("frequency").notNull().default("daily"), // daily, weekly, monthly
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  isAiSuggested: boolean("is_ai_suggested").default(false),
  aiRationale: text("ai_rationale"), // Why AI suggested this goal
  relatedConditions: jsonb("related_conditions"), // Array of condition IDs this goal relates to
  status: text("status").notNull().default("active"), // active, paused, completed, abandoned
  reminderEnabled: boolean("reminder_enabled").default(true),
  reminderTime: text("reminder_time"), // HH:MM format
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const goalProgress = pgTable("goal_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id").notNull().references(() => healthGoals.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  value: integer("value").notNull(), // actual value logged
  notes: text("notes"),
  isCompleted: boolean("is_completed").default(false), // did they meet the target for this entry
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHealthGoalSchema = createInsertSchema(healthGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  currentStreak: true,
  longestStreak: true,
});

export const insertGoalProgressSchema = createInsertSchema(goalProgress).omit({
  id: true,
  createdAt: true,
});

export type HealthGoal = typeof healthGoals.$inferSelect;
export type InsertHealthGoal = z.infer<typeof insertHealthGoalSchema>;
export type GoalProgress = typeof goalProgress.$inferSelect;
export type InsertGoalProgress = z.infer<typeof insertGoalProgressSchema>;

// ==================== GAMIFICATION SYSTEM ====================

// Badge definitions - available achievements users can earn
export const badges = pgTable("badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(), // Feather icon name
  category: text("category").notNull(), // goals, logging, streaks, education, milestones, social
  tier: text("tier").notNull().default("bronze"), // bronze, silver, gold, platinum
  pointsAwarded: integer("points_awarded").notNull().default(10),
  requirement: jsonb("requirement"), // JSON criteria for earning (e.g., {type: "streak", value: 7})
  isSecret: boolean("is_secret").default(false), // Hidden badges revealed when earned
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User earned badges
export const userBadges = pgTable("user_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  badgeId: varchar("badge_id").notNull().references(() => badges.id, { onDelete: "cascade" }),
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
  notificationSent: boolean("notification_sent").default(false),
});

// User gamification profile - tracks points, level, streaks
export const userGamification = pgTable("user_gamification", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  totalPoints: integer("total_points").notNull().default(0),
  currentLevel: integer("current_level").notNull().default(1),
  levelProgress: integer("level_progress").notNull().default(0), // Points toward next level
  currentStreak: integer("current_streak").notNull().default(0), // Consecutive days active
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActiveDate: timestamp("last_active_date"),
  goalsCompleted: integer("goals_completed").notNull().default(0),
  recordsLogged: integer("records_logged").notNull().default(0),
  daysActive: integer("days_active").notNull().default(0),
  leaderboardOptIn: boolean("leaderboard_opt_in").default(false), // Privacy-conscious
  displayName: text("display_name"), // Anonymous name for leaderboard
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Point transactions - history of points earned
export const pointTransactions = pgTable("point_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  points: integer("points").notNull(),
  reason: text("reason").notNull(), // goal_completed, record_logged, streak_milestone, badge_earned, daily_login
  category: text("category").notNull(), // goals, logging, streaks, achievements, daily
  relatedEntityType: text("related_entity_type"), // goal, record, badge
  relatedEntityId: varchar("related_entity_id"),
  metadata: jsonb("metadata"), // Additional context
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Daily challenges - rotating engagement boosters
export const dailyChallenges = pgTable("daily_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // goals, logging, wellness
  pointsReward: integer("points_reward").notNull().default(25),
  requirement: jsonb("requirement").notNull(), // {type: "log_records", count: 1}
  isActive: boolean("is_active").default(true),
  activeDate: timestamp("active_date"), // When this challenge is/was active
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User daily challenge completions
export const userChallenges = pgTable("user_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  challengeId: varchar("challenge_id").notNull().references(() => dailyChallenges.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  pointsAwarded: integer("points_awarded").notNull(),
});

// Gamification insert schemas
export const insertBadgeSchema = createInsertSchema(badges).omit({
  id: true,
  createdAt: true,
});

export const insertUserBadgeSchema = createInsertSchema(userBadges).omit({
  id: true,
  earnedAt: true,
  notificationSent: true,
});

export const insertUserGamificationSchema = createInsertSchema(userGamification).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPointTransactionSchema = createInsertSchema(pointTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertDailyChallengeSchema = createInsertSchema(dailyChallenges).omit({
  id: true,
  createdAt: true,
});

export const insertUserChallengeSchema = createInsertSchema(userChallenges).omit({
  id: true,
  completedAt: true,
});

// Gamification types
export type Badge = typeof badges.$inferSelect;
export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type UserBadge = typeof userBadges.$inferSelect;
export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;
export type UserGamification = typeof userGamification.$inferSelect;
export type InsertUserGamification = z.infer<typeof insertUserGamificationSchema>;
export type PointTransaction = typeof pointTransactions.$inferSelect;
export type InsertPointTransaction = z.infer<typeof insertPointTransactionSchema>;
export type DailyChallenge = typeof dailyChallenges.$inferSelect;
export type InsertDailyChallenge = z.infer<typeof insertDailyChallengeSchema>;
export type UserChallenge = typeof userChallenges.$inferSelect;
export type InsertUserChallenge = z.infer<typeof insertUserChallengeSchema>;

// Level thresholds - points needed for each level
export const LEVEL_THRESHOLDS = [
  0,      // Level 1
  100,    // Level 2
  300,    // Level 3
  600,    // Level 4
  1000,   // Level 5
  1500,   // Level 6
  2100,   // Level 7
  2800,   // Level 8
  3600,   // Level 9
  4500,   // Level 10
  5500,   // Level 11
  6600,   // Level 12
  7800,   // Level 13
  9100,   // Level 14
  10500,  // Level 15
  12000,  // Level 16
  13600,  // Level 17
  15300,  // Level 18
  17100,  // Level 19
  19000,  // Level 20
] as const;

// Point values for different actions
export const POINT_VALUES = {
  DAILY_LOGIN: 5,
  GOAL_PROGRESS_LOG: 10,
  GOAL_COMPLETED: 50,
  RECORD_LOGGED: 15,
  STREAK_7_DAYS: 100,
  STREAK_30_DAYS: 500,
  STREAK_100_DAYS: 2000,
  FIRST_GOAL_CREATED: 25,
  FIRST_RECORD: 25,
  PROFILE_COMPLETED: 50,
  DAILY_CHALLENGE: 25,
} as const;

// ============================================
// AI Health Assistant Tables
// ============================================

// Medication Reminders
export const medicationReminders = pgTable("medication_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  medicationName: text("medication_name").notNull(),
  dosage: text("dosage"),
  instructions: text("instructions"),
  frequency: text("frequency").notNull(), // 'once_daily', 'twice_daily', 'three_times_daily', 'as_needed', 'custom'
  scheduledTimes: jsonb("scheduled_times").notNull(), // Array of time strings: ["08:00", "20:00"]
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
  healthRecordId: varchar("health_record_id").references(() => healthRecords.id, { onDelete: "set null" }),
  lastTakenAt: timestamp("last_taken_at"),
  nextReminderAt: timestamp("next_reminder_at"),
  reminderEnabled: boolean("reminder_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Medication Reminder Logs
export const medicationLogs = pgTable("medication_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reminderId: varchar("reminder_id").notNull().references(() => medicationReminders.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scheduledTime: timestamp("scheduled_time").notNull(),
  action: text("action").notNull(), // 'taken', 'skipped', 'snoozed'
  takenAt: timestamp("taken_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Appointments
export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  appointmentType: text("appointment_type").notNull(), // 'checkup', 'specialist', 'lab', 'imaging', 'therapy', 'vaccination', 'other'
  providerName: text("provider_name"),
  facilityName: text("facility_name"),
  facilityAddress: text("facility_address"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: integer("duration").default(30), // Duration in minutes
  status: text("status").default("scheduled"), // 'scheduled', 'confirmed', 'cancelled', 'completed', 'no_show'
  reminderEnabled: boolean("reminder_enabled").default(true),
  reminderMinutesBefore: integer("reminder_minutes_before").default(60),
  notes: text("notes"),
  healthRecordId: varchar("health_record_id").references(() => healthRecords.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Educational Modules
export const educationalModules = pgTable("educational_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(), // 'medication', 'condition', 'lifestyle', 'prevention', 'nutrition', 'exercise', 'mental_health'
  content: text("content").notNull(), // Markdown content
  duration: integer("duration").default(5), // Estimated reading time in minutes
  difficulty: text("difficulty").default("beginner"), // 'beginner', 'intermediate', 'advanced'
  relatedConditions: jsonb("related_conditions"), // Array of condition names
  relatedMedications: jsonb("related_medications"), // Array of medication names
  imageUrl: text("image_url"),
  isPublished: boolean("is_published").default(true),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User Educational Progress
export const userEducationalProgress = pgTable("user_educational_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  moduleId: varchar("module_id").notNull().references(() => educationalModules.id, { onDelete: "cascade" }),
  status: text("status").default("not_started"), // 'not_started', 'in_progress', 'completed'
  progressPercentage: integer("progress_percentage").default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  lastAccessedAt: timestamp("last_accessed_at"),
});

// AI Conversation History
export const aiConversations = pgTable("ai_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  context: text("context"),
  isActive: boolean("is_active").default(true),
  fingerprint: varchar("fingerprint", { length: 64 }),
  summary: text("summary"),
  messageCount: integer("message_count").default(0),
  topicTags: jsonb("topic_tags").$type<string[]>(),
  mergedInto: varchar("merged_into"),
  mergedFrom: jsonb("merged_from").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI Conversation Messages
export const aiMessages = pgTable("ai_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => aiConversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  metadata: jsonb("metadata"), // Store referenced health records, actions taken, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiInsights = pgTable("ai_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conversationId: varchar("conversation_id").references(() => aiConversations.id, { onDelete: "set null" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  tags: jsonb("tags").$type<string[]>(),
  confidence: real("confidence"),
  sourceMessageIds: jsonb("source_message_ids").$type<string[]>(),
  isArchived: boolean("is_archived").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas for AI Health Assistant
export const insertMedicationReminderSchema = createInsertSchema(medicationReminders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMedicationLogSchema = createInsertSchema(medicationLogs).omit({
  id: true,
  createdAt: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEducationalModuleSchema = createInsertSchema(educationalModules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
});

export const insertUserEducationalProgressSchema = createInsertSchema(userEducationalProgress).omit({
  id: true,
});

export const insertAiConversationSchema = createInsertSchema(aiConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAiMessageSchema = createInsertSchema(aiMessages).omit({
  id: true,
  createdAt: true,
});

export const insertAiInsightSchema = createInsertSchema(aiInsights).omit({
  id: true,
  createdAt: true,
});

// AI Health Assistant types
export type MedicationReminder = typeof medicationReminders.$inferSelect;
export type InsertMedicationReminder = z.infer<typeof insertMedicationReminderSchema>;
export type MedicationLog = typeof medicationLogs.$inferSelect;
export type InsertMedicationLog = z.infer<typeof insertMedicationLogSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type EducationalModule = typeof educationalModules.$inferSelect;
export type InsertEducationalModule = z.infer<typeof insertEducationalModuleSchema>;
export type UserEducationalProgress = typeof userEducationalProgress.$inferSelect;
export type InsertUserEducationalProgress = z.infer<typeof insertUserEducationalProgressSchema>;
export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;
export type AiMessage = typeof aiMessages.$inferSelect;
export type InsertAiMessage = z.infer<typeof insertAiMessageSchema>;
export type AiInsight = typeof aiInsights.$inferSelect;
export type InsertAiInsight = z.infer<typeof insertAiInsightSchema>;

// ============================================
// AI Workflow Automation Tables
// ============================================

export const appointmentSuggestions = pgTable("appointment_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  suggestionType: text("suggestion_type").notNull(), // preventive, follow_up, risk_based, routine
  priority: text("priority").notNull(), // high, medium, low
  appointmentType: text("appointment_type").notNull(), // checkup, specialist, lab, imaging, etc.
  title: text("title").notNull(),
  description: text("description").notNull(),
  rationale: text("rationale").notNull(), // Why AI suggests this
  suggestedProvider: text("suggested_provider"),
  suggestedSpecialty: text("suggested_specialty"),
  suggestedTimeframe: text("suggested_timeframe"), // "within 2 weeks", "within 1 month", etc.
  relatedConditions: jsonb("related_conditions").$type<string[]>(),
  relatedRisks: jsonb("related_risks").$type<string[]>(),
  relatedRecordIds: jsonb("related_record_ids").$type<string[]>(),
  status: text("status").notNull().default("pending"), // pending, scheduled, dismissed, expired
  scheduledAppointmentId: varchar("scheduled_appointment_id").references(() => appointments.id),
  userFeedback: text("user_feedback"),
  aiModel: text("ai_model"),
  confidence: integer("confidence"), // 0-100
  expiresAt: timestamp("expires_at"),
  dismissedAt: timestamp("dismissed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const refillRequests = pgTable("refill_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  medicationReminderId: varchar("medication_reminder_id").references(() => medicationReminders.id),
  medicationName: text("medication_name").notNull(),
  medicationDetails: jsonb("medication_details").$type<{
    dosage?: string;
    frequency?: string;
    prescribedBy?: string;
    pharmacy?: string;
    rxNumber?: string;
  }>(),
  requestType: text("request_type").notNull(), // predicted, low_supply, manual
  predictedRunOutDate: timestamp("predicted_run_out_date"),
  daysSupplyRemaining: integer("days_supply_remaining"),
  insuranceEligible: boolean("insurance_eligible"),
  insuranceDetails: jsonb("insurance_details").$type<{
    copay?: number;
    priorAuthRequired?: boolean;
    formularyStatus?: string;
    restrictions?: string[];
  }>(),
  pharmacyInfo: jsonb("pharmacy_info").$type<{
    name?: string;
    phone?: string;
    address?: string;
    preferredMethod?: string;
  }>(),
  status: text("status").notNull().default("pending"), // pending, approved, submitted, fulfilled, cancelled
  aiRationale: text("ai_rationale"),
  aiModel: text("ai_model"),
  priority: text("priority").notNull().default("normal"), // urgent, high, normal, low
  userNotes: text("user_notes"),
  approvedAt: timestamp("approved_at"),
  submittedAt: timestamp("submitted_at"),
  fulfilledAt: timestamp("fulfilled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const consultationSummaries = pgTable("consultation_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  summaryType: text("summary_type").notNull(), // visit, lab_results, imaging, procedure, medication_change, comprehensive
  title: text("title").notNull(),
  executiveSummary: text("executive_summary").notNull(),
  keyFindings: jsonb("key_findings").$type<Array<{
    category: string;
    finding: string;
    significance: string;
    actionRequired?: boolean;
  }>>(),
  recommendations: jsonb("recommendations").$type<Array<{
    priority: string;
    recommendation: string;
    rationale: string;
    dueDate?: string;
  }>>(),
  medications: jsonb("medications").$type<Array<{
    name: string;
    action: string; // started, continued, stopped, changed
    details?: string;
  }>>(),
  followUpActions: jsonb("follow_up_actions").$type<Array<{
    action: string;
    timeframe: string;
    provider?: string;
  }>>(),
  questionsToAsk: jsonb("questions_to_ask").$type<string[]>(),
  relatedRecordIds: jsonb("related_record_ids").$type<string[]>(),
  sourceAppointmentId: varchar("source_appointment_id").references(() => appointments.id),
  dateRange: jsonb("date_range").$type<{ start: string; end: string }>(),
  aiModel: text("ai_model"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  generationTimeMs: integer("generation_time_ms"),
  status: text("status").notNull().default("generated"), // generating, generated, reviewed, archived
  userRating: integer("user_rating"), // 1-5
  userFeedback: text("user_feedback"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAppointmentSuggestionSchema = createInsertSchema(appointmentSuggestions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRefillRequestSchema = createInsertSchema(refillRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertConsultationSummarySchema = createInsertSchema(consultationSummaries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AppointmentSuggestion = typeof appointmentSuggestions.$inferSelect;
export type InsertAppointmentSuggestion = z.infer<typeof insertAppointmentSuggestionSchema>;
export type RefillRequest = typeof refillRequests.$inferSelect;
export type InsertRefillRequest = z.infer<typeof insertRefillRequestSchema>;
export type ConsultationSummary = typeof consultationSummaries.$inferSelect;
export type InsertConsultationSummary = z.infer<typeof insertConsultationSummarySchema>;

// Constants
export const MEDICATION_FREQUENCIES = ["once_daily", "twice_daily", "three_times_daily", "four_times_daily", "as_needed", "weekly", "custom"] as const;
export const APPOINTMENT_TYPES = ["checkup", "specialist", "lab", "imaging", "therapy", "vaccination", "follow_up", "emergency", "other"] as const;
export const APPOINTMENT_STATUSES = ["scheduled", "confirmed", "cancelled", "completed", "no_show", "rescheduled"] as const;
export const EDUCATION_CATEGORIES = ["medication", "condition", "lifestyle", "prevention", "nutrition", "exercise", "mental_health", "general"] as const;

// SMART on FHIR scope patterns
export const SMART_SCOPES = [
  "patient/*.read",
  "patient/*.write",
  "patient/Observation.read",
  "patient/MedicationRequest.read",
  "patient/Condition.read",
  "patient/AllergyIntolerance.read",
  "patient/Immunization.read",
  "patient/Procedure.read",
  "patient/DiagnosticReport.read",
  "patient/DocumentReference.read",
  "user/*.read",
  "user/*.write",
  "launch",
  "launch/patient",
  "openid",
  "fhirUser",
  "offline_access",
] as const;

// ==================== PERSONALIZED HEALTH JOURNEYS ====================

export const JOURNEY_STATUSES = ["not_started", "active", "paused", "completed", "abandoned"] as const;
export const JOURNEY_TYPES = ["chronic_condition", "preventive_care", "post_surgery", "wellness", "lifestyle_change"] as const;
export const MILESTONE_STATUSES = ["locked", "available", "in_progress", "completed", "skipped"] as const;
export const CARE_PLAN_STATUSES = ["draft", "active", "on_hold", "completed", "revoked"] as const;
export const MESSAGE_TYPES = ["text", "image", "document", "system", "ai_triage"] as const;
export const MESSAGE_PRIORITIES = ["routine", "urgent", "emergency"] as const;
export const PROVIDER_TYPES = ["physician", "nurse", "specialist", "pharmacist", "care_coordinator", "ai_assistant"] as const;

// Health Journey - Personalized learning path for chronic conditions
export const healthJourneys = pgTable("health_journeys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  journeyType: text("journey_type").notNull(), // chronic_condition, preventive_care, post_surgery, wellness, lifestyle_change
  relatedConditions: jsonb("related_conditions"), // Array of condition names/IDs
  targetDurationDays: integer("target_duration_days").default(90),
  status: text("status").notNull().default("not_started"), // not_started, active, paused, completed, abandoned
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  currentPhase: integer("current_phase").default(1),
  totalPhases: integer("total_phases").default(4),
  progressPercentage: integer("progress_percentage").default(0),
  aiPersonalizationData: jsonb("ai_personalization_data"), // AI-generated adjustments based on user progress
  lastAiAdjustmentAt: timestamp("last_ai_adjustment_at"),
  pointsEarned: integer("points_earned").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Journey Milestones - Steps within a health journey
export const journeyMilestones = pgTable("journey_milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  journeyId: varchar("journey_id").notNull().references(() => healthJourneys.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  phase: integer("phase").notNull().default(1),
  orderIndex: integer("order_index").notNull(),
  status: text("status").notNull().default("locked"), // locked, available, in_progress, completed, skipped
  requiredModuleIds: jsonb("required_module_ids"), // Educational modules to complete
  requiredGoalIds: jsonb("required_goal_ids"), // Health goals to achieve
  pointsReward: integer("points_reward").default(25),
  completionCriteria: jsonb("completion_criteria"), // JSON criteria for completion
  unlockedAt: timestamp("unlocked_at"),
  completedAt: timestamp("completed_at"),
  aiNotes: text("ai_notes"), // AI-generated tips for this milestone
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Adaptive Educational Content - Modules that adjust based on progress
export const adaptiveContent = pgTable("adaptive_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").references(() => educationalModules.id, { onDelete: "cascade" }),
  journeyId: varchar("journey_id").references(() => healthJourneys.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  adaptationType: text("adaptation_type").notNull(), // difficulty_adjustment, content_focus, pacing, format
  originalDifficulty: text("original_difficulty"),
  adjustedDifficulty: text("adjusted_difficulty"),
  adjustmentReason: text("adjustment_reason"),
  userPerformanceScore: integer("user_performance_score"), // 0-100
  engagementLevel: text("engagement_level"), // low, medium, high
  recommendedNextModules: jsonb("recommended_next_modules"), // AI-recommended follow-up
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Interactive Care Plans - Dynamic care plans that evolve
export const carePlans = pgTable("care_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(), // chronic_disease, preventive, wellness, post_acute, palliative
  status: text("status").notNull().default("draft"), // draft, active, on_hold, completed, revoked
  relatedConditions: jsonb("related_conditions"),
  relatedMedications: jsonb("related_medications"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  reviewDate: timestamp("review_date"), // Next scheduled review
  goals: jsonb("goals"), // Array of care plan goals with progress
  activities: jsonb("activities"), // Scheduled activities with status
  team: jsonb("team"), // Care team members
  aiGeneratedRecommendations: jsonb("ai_generated_recommendations"),
  lastAiReviewAt: timestamp("last_ai_review_at"),
  adherenceScore: integer("adherence_score").default(0), // 0-100
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Care Plan Activities - Tasks within a care plan
export const carePlanActivities = pgTable("care_plan_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  carePlanId: varchar("care_plan_id").notNull().references(() => carePlans.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  activityType: text("activity_type").notNull(), // medication, appointment, exercise, diet, monitoring, education
  frequency: text("frequency"), // daily, weekly, monthly, once
  scheduledTime: text("scheduled_time"), // HH:MM or cron-like
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, missed, skipped
  completedAt: timestamp("completed_at"),
  pointsReward: integer("points_reward").default(10),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==================== SECURE PROVIDER MESSAGING ====================

// Provider Profiles - Healthcare providers who can message with patients
export const providerProfiles = pgTable("provider_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  providerType: text("provider_type").notNull(), // physician, nurse, specialist, pharmacist, care_coordinator, ai_assistant
  specialty: text("specialty"),
  organization: text("organization"),
  npiNumber: text("npi_number"), // National Provider Identifier
  isAiProvider: boolean("is_ai_provider").default(false),
  isAvailable: boolean("is_available").default(true),
  averageResponseTime: integer("average_response_time"), // In minutes
  profileImageUrl: text("profile_image_url"),
  credentials: jsonb("credentials"), // Array of credentials/certifications
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Messaging Threads - Conversations between patients and providers
export const messagingThreads = pgTable("messaging_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerId: varchar("provider_id").references(() => providerProfiles.id, { onDelete: "set null" }),
  subject: text("subject"),
  category: text("category"), // general, medication, appointment, lab_results, symptoms, billing, referral
  priority: text("priority").notNull().default("routine"), // routine, urgent, emergency
  status: text("status").notNull().default("open"), // open, pending_response, resolved, closed
  isAiTriaged: boolean("is_ai_triaged").default(false),
  aiTriageSummary: text("ai_triage_summary"),
  aiSuggestedCategory: text("ai_suggested_category"),
  aiSuggestedPriority: text("ai_suggested_priority"),
  aiSuggestedProvider: varchar("ai_suggested_provider").references(() => providerProfiles.id, { onDelete: "set null" }),
  lastMessageAt: timestamp("last_message_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Secure Messages - Individual messages within threads
export const secureMessages = pgTable("secure_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => messagingThreads.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull(), // User ID or Provider Profile ID
  senderType: text("sender_type").notNull(), // patient, provider, ai_assistant
  messageType: text("message_type").notNull().default("text"), // text, image, document, system, ai_triage
  content: text("content").notNull(),
  attachments: jsonb("attachments"), // Array of attachment URLs/references
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  isAiGenerated: boolean("is_ai_generated").default(false),
  aiConfidenceScore: integer("ai_confidence_score"), // 0-100 for AI responses
  relatedRecordIds: jsonb("related_record_ids"), // Links to health records
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Message Templates - Pre-defined responses for providers
export const messageTemplates = pgTable("message_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").references(() => providerProfiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  isShared: boolean("is_shared").default(false), // Available to all providers
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertHealthJourneySchema = createInsertSchema(healthJourneys).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  progressPercentage: true,
  pointsEarned: true,
});

export const insertJourneyMilestoneSchema = createInsertSchema(journeyMilestones).omit({
  id: true,
  createdAt: true,
});

export const insertAdaptiveContentSchema = createInsertSchema(adaptiveContent).omit({
  id: true,
  createdAt: true,
});

export const insertCarePlanSchema = createInsertSchema(carePlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  adherenceScore: true,
});

export const insertCarePlanActivitySchema = createInsertSchema(carePlanActivities).omit({
  id: true,
  createdAt: true,
});

export const insertProviderProfileSchema = createInsertSchema(providerProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessagingThreadSchema = createInsertSchema(messagingThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSecureMessageSchema = createInsertSchema(secureMessages).omit({
  id: true,
  createdAt: true,
});

export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({
  id: true,
  createdAt: true,
});

// Wearable Devices & IoT Sensors
export const DEVICE_TYPES = ["blood_pressure_monitor", "glucose_meter", "pulse_oximeter", "heart_rate_monitor", "smart_scale", "thermometer", "sleep_tracker", "fitness_tracker", "cgm", "ecg_monitor", "spirometer", "other"] as const;
export const DEVICE_STATUSES = ["connected", "disconnected", "pairing", "error", "low_battery"] as const;
export const SENSOR_DATA_TYPES = ["blood_pressure", "glucose", "heart_rate", "spo2", "weight", "temperature", "sleep", "steps", "calories", "respiratory_rate", "ecg", "hrv"] as const;
export const ALERT_TYPES = ["anomaly", "threshold", "trend", "missing_data", "device_issue"] as const;
export const ALERT_STATUSES = ["active", "acknowledged", "resolved", "dismissed"] as const;

export const connectedDevices = pgTable("connected_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  deviceType: text("device_type").notNull(),
  manufacturer: text("manufacturer"),
  model: text("model"),
  serialNumber: text("serial_number"),
  firmwareVersion: text("firmware_version"),
  connectionType: text("connection_type"),
  status: text("status").default("disconnected"),
  batteryLevel: integer("battery_level"),
  lastSyncAt: timestamp("last_sync_at"),
  settings: jsonb("settings"),
  credentials: jsonb("credentials"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sensorReadings = pgTable("sensor_readings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceId: varchar("device_id").references(() => connectedDevices.id, { onDelete: "set null" }),
  dataType: text("data_type").notNull(),
  value: jsonb("value").notNull(),
  unit: text("unit"),
  timestamp: timestamp("timestamp").notNull(),
  quality: integer("quality"),
  isManual: boolean("is_manual").default(false),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sensorAlerts = pgTable("sensor_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  deviceId: varchar("device_id").references(() => connectedDevices.id, { onDelete: "set null" }),
  readingId: varchar("reading_id").references(() => sensorReadings.id, { onDelete: "set null" }),
  alertType: text("alert_type").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  dataType: text("data_type"),
  triggerValue: jsonb("trigger_value"),
  thresholdValue: jsonb("threshold_value"),
  aiAnalysis: text("ai_analysis"),
  recommendations: jsonb("recommendations"),
  status: text("status").default("active"),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  notifiedProvider: boolean("notified_provider").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sensorThresholds = pgTable("sensor_thresholds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dataType: text("data_type").notNull(),
  minValue: jsonb("min_value"),
  maxValue: jsonb("max_value"),
  warningMinValue: jsonb("warning_min_value"),
  warningMaxValue: jsonb("warning_max_value"),
  isEnabled: boolean("is_enabled").default(true),
  isAiManaged: boolean("is_ai_managed").default(false),
  aiRationale: text("ai_rationale"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sensorTrends = pgTable("sensor_trends", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dataType: text("data_type").notNull(),
  period: text("period").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  averageValue: jsonb("average_value"),
  minValue: jsonb("min_value"),
  maxValue: jsonb("max_value"),
  readingCount: integer("reading_count").default(0),
  trendDirection: text("trend_direction"),
  percentageChange: integer("percentage_change"),
  aiInsights: text("ai_insights"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConnectedDeviceSchema = createInsertSchema(connectedDevices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSensorReadingSchema = createInsertSchema(sensorReadings).omit({
  id: true,
  createdAt: true,
});

export const insertSensorAlertSchema = createInsertSchema(sensorAlerts).omit({
  id: true,
  createdAt: true,
});

export const insertSensorThresholdSchema = createInsertSchema(sensorThresholds).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSensorTrendSchema = createInsertSchema(sensorTrends).omit({
  id: true,
  createdAt: true,
});

// Types
export type HealthJourney = typeof healthJourneys.$inferSelect;
export type InsertHealthJourney = z.infer<typeof insertHealthJourneySchema>;
export type JourneyMilestone = typeof journeyMilestones.$inferSelect;
export type InsertJourneyMilestone = z.infer<typeof insertJourneyMilestoneSchema>;
export type AdaptiveContent = typeof adaptiveContent.$inferSelect;
export type InsertAdaptiveContent = z.infer<typeof insertAdaptiveContentSchema>;
export type CarePlan = typeof carePlans.$inferSelect;
export type InsertCarePlan = z.infer<typeof insertCarePlanSchema>;
export type CarePlanActivity = typeof carePlanActivities.$inferSelect;
export type InsertCarePlanActivity = z.infer<typeof insertCarePlanActivitySchema>;
export type ProviderProfile = typeof providerProfiles.$inferSelect;
export type InsertProviderProfile = z.infer<typeof insertProviderProfileSchema>;
export type MessagingThread = typeof messagingThreads.$inferSelect;
export type InsertMessagingThread = z.infer<typeof insertMessagingThreadSchema>;
export type SecureMessage = typeof secureMessages.$inferSelect;
export type InsertSecureMessage = z.infer<typeof insertSecureMessageSchema>;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;

// Device & Sensor Types
export type ConnectedDevice = typeof connectedDevices.$inferSelect;
export type InsertConnectedDevice = z.infer<typeof insertConnectedDeviceSchema>;
export type SensorReading = typeof sensorReadings.$inferSelect;
export type InsertSensorReading = z.infer<typeof insertSensorReadingSchema>;
export type SensorAlert = typeof sensorAlerts.$inferSelect;
export type InsertSensorAlert = z.infer<typeof insertSensorAlertSchema>;
export type SensorThreshold = typeof sensorThresholds.$inferSelect;
export type InsertSensorThreshold = z.infer<typeof insertSensorThresholdSchema>;
export type SensorTrend = typeof sensorTrends.$inferSelect;
export type InsertSensorTrend = z.infer<typeof insertSensorTrendSchema>;

// ============================================
// Provider Collaboration AI Tables
// ============================================

export const caseSummaries = pgTable("case_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").notNull(),
  specialtyType: text("specialty_type").notNull(),
  referringProvider: text("referring_provider"),
  targetSpecialist: text("target_specialist"),
  chiefComplaint: text("chief_complaint").notNull(),
  historyOfPresentIllness: text("history_of_present_illness"),
  relevantMedicalHistory: jsonb("relevant_medical_history"),
  currentMedications: jsonb("current_medications"),
  allergies: jsonb("allergies"),
  relevantLabResults: jsonb("relevant_lab_results"),
  relevantImaging: jsonb("relevant_imaging"),
  vitalSigns: jsonb("vital_signs"),
  clinicalAssessment: text("clinical_assessment"),
  specificQuestions: jsonb("specific_questions"),
  urgencyLevel: text("urgency_level").default("routine"),
  aiSummary: text("ai_summary"),
  aiKeyFindings: jsonb("ai_key_findings"),
  aiRecommendations: jsonb("ai_recommendations"),
  aiModel: text("ai_model"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  status: text("status").default("draft"),
  sentAt: timestamp("sent_at"),
  responseReceivedAt: timestamp("response_received_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const researchRecommendations = pgTable("research_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id"),
  caseSummaryId: varchar("case_summary_id").references(() => caseSummaries.id, { onDelete: "set null" }),
  queryContext: text("query_context").notNull(),
  conditions: jsonb("conditions"),
  medications: jsonb("medications"),
  procedures: jsonb("procedures"),
  recommendations: jsonb("recommendations").$type<Array<{
    title: string;
    authors: string[];
    journal: string;
    year: number;
    doi?: string;
    pmid?: string;
    abstract: string;
    relevanceScore: number;
    relevanceReason: string;
    keyFindings: string[];
    clinicalImplications: string[];
  }>>(),
  searchTerms: jsonb("search_terms"),
  evidenceLevel: text("evidence_level"),
  aiModel: text("ai_model"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const providerCommunications = pgTable("provider_communications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id"),
  caseSummaryId: varchar("case_summary_id").references(() => caseSummaries.id, { onDelete: "set null" }),
  communicationType: text("communication_type").notNull(),
  fromProvider: text("from_provider"),
  toProvider: text("to_provider"),
  subject: text("subject"),
  draftContent: text("draft_content"),
  finalContent: text("final_content"),
  patientContext: jsonb("patient_context"),
  keyPoints: jsonb("key_points"),
  tone: text("tone").default("professional"),
  format: text("format").default("standard"),
  aiModel: text("ai_model"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  status: text("status").default("draft"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// Advanced Analytics Tables
// ============================================

export const treatmentProtocols = pgTable("treatment_protocols", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  conditionType: text("condition_type").notNull(),
  icdCodes: jsonb("icd_codes"),
  snomedCodes: jsonb("snomed_codes"),
  steps: jsonb("steps").$type<Array<{
    order: number;
    name: string;
    description: string;
    expectedTimeframe: string;
    requiredActions: string[];
    expectedOutcomes: string[];
    contraindications: string[];
  }>>(),
  requiredAssessments: jsonb("required_assessments"),
  requiredLabs: jsonb("required_labs"),
  requiredMedications: jsonb("required_medications"),
  monitoringCriteria: jsonb("monitoring_criteria"),
  successCriteria: jsonb("success_criteria"),
  evidenceLevel: text("evidence_level"),
  source: text("source"),
  version: text("version"),
  isActive: boolean("is_active").default(true),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const protocolDeviations = pgTable("protocol_deviations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").notNull(),
  protocolId: varchar("protocol_id").references(() => treatmentProtocols.id, { onDelete: "set null" }),
  deviationType: text("deviation_type").notNull(),
  severity: text("severity").notNull(),
  protocolStep: integer("protocol_step"),
  expectedAction: text("expected_action"),
  actualAction: text("actual_action"),
  expectedTimeframe: text("expected_timeframe"),
  actualTimeframe: text("actual_timeframe"),
  deviationReason: text("deviation_reason"),
  clinicalJustification: text("clinical_justification"),
  relatedRecordIds: jsonb("related_record_ids"),
  aiAnalysis: text("ai_analysis"),
  aiRecommendations: jsonb("ai_recommendations"),
  riskAssessment: jsonb("risk_assessment"),
  status: text("status").default("detected"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  resolution: text("resolution"),
  aiModel: text("ai_model"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kpiReports = pgTable("kpi_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reportType: text("report_type").notNull(),
  reportPeriod: text("report_period").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  metrics: jsonb("metrics").$type<Array<{
    name: string;
    category: string;
    value: number;
    unit: string;
    target?: number;
    previousValue?: number;
    changePercentage?: number;
    trend: string;
    status: string;
    benchmark?: number;
  }>>(),
  categoryBreakdown: jsonb("category_breakdown"),
  trends: jsonb("trends"),
  insights: jsonb("insights"),
  recommendations: jsonb("recommendations"),
  visualizations: jsonb("visualizations"),
  comparisons: jsonb("comparisons"),
  aiAnalysis: text("ai_analysis"),
  aiModel: text("ai_model"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  generatedAt: timestamp("generated_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const outcomePredictions = pgTable("outcome_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").notNull(),
  predictionType: text("prediction_type").notNull(),
  condition: text("condition"),
  treatment: text("treatment"),
  timeframe: text("timeframe").notNull(),
  predictedOutcome: text("predicted_outcome"),
  confidenceScore: integer("confidence_score"),
  riskFactors: jsonb("risk_factors").$type<Array<{
    factor: string;
    impact: string;
    modifiable: boolean;
    currentValue?: string;
    targetValue?: string;
  }>>(),
  protectiveFactors: jsonb("protective_factors"),
  probabilityDistribution: jsonb("probability_distribution"),
  comparisonToPopulation: jsonb("comparison_to_population"),
  interventionRecommendations: jsonb("intervention_recommendations"),
  dataPointsUsed: jsonb("data_points_used"),
  modelMetrics: jsonb("model_metrics"),
  aiModel: text("ai_model"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const populationHealthReports = pgTable("population_health_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reportType: text("report_type").notNull(),
  cohortCriteria: jsonb("cohort_criteria"),
  cohortSize: integer("cohort_size"),
  reportPeriod: text("report_period"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  title: text("title").notNull(),
  executiveSummary: text("executive_summary"),
  demographics: jsonb("demographics"),
  prevalenceRates: jsonb("prevalence_rates"),
  incidenceRates: jsonb("incidence_rates"),
  riskStratification: jsonb("risk_stratification"),
  outcomeMetrics: jsonb("outcome_metrics"),
  qualityIndicators: jsonb("quality_indicators"),
  disparitiesAnalysis: jsonb("disparities_analysis"),
  trends: jsonb("trends"),
  benchmarkComparisons: jsonb("benchmark_comparisons"),
  interventionEffectiveness: jsonb("intervention_effectiveness"),
  costAnalysis: jsonb("cost_analysis"),
  aiInsights: jsonb("ai_insights"),
  aiRecommendations: jsonb("ai_recommendations"),
  visualizationData: jsonb("visualization_data"),
  aiModel: text("ai_model"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const treatmentEfficacyAnalyses = pgTable("treatment_efficacy_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  analysisType: text("analysis_type").notNull(),
  treatmentType: text("treatment_type").notNull(),
  condition: text("condition"),
  medicationClass: text("medication_class"),
  procedureType: text("procedure_type"),
  cohortSize: integer("cohort_size"),
  studyPeriod: text("study_period"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  primaryOutcome: text("primary_outcome"),
  secondaryOutcomes: jsonb("secondary_outcomes"),
  efficacyMetrics: jsonb("efficacy_metrics").$type<Array<{
    metric: string;
    value: number;
    unit: string;
    confidenceInterval?: { lower: number; upper: number };
    pValue?: number;
    significance: string;
  }>>(),
  safetyMetrics: jsonb("safety_metrics"),
  adherenceRates: jsonb("adherence_rates"),
  subgroupAnalyses: jsonb("subgroup_analyses"),
  comparatorAnalyses: jsonb("comparator_analyses"),
  numberNeededToTreat: integer("number_needed_to_treat"),
  absoluteRiskReduction: integer("absolute_risk_reduction"),
  relativeRiskReduction: integer("relative_risk_reduction"),
  costEffectiveness: jsonb("cost_effectiveness"),
  limitations: jsonb("limitations"),
  conclusions: text("conclusions"),
  recommendations: jsonb("recommendations"),
  aiModel: text("ai_model"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertCaseSummarySchema = createInsertSchema(caseSummaries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertResearchRecommendationSchema = createInsertSchema(researchRecommendations).omit({
  id: true,
  createdAt: true,
});

export const insertProviderCommunicationSchema = createInsertSchema(providerCommunications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTreatmentProtocolSchema = createInsertSchema(treatmentProtocols).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProtocolDeviationSchema = createInsertSchema(protocolDeviations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKpiReportSchema = createInsertSchema(kpiReports).omit({
  id: true,
  createdAt: true,
});

export const insertOutcomePredictionSchema = createInsertSchema(outcomePredictions).omit({
  id: true,
  createdAt: true,
});

export const insertPopulationHealthReportSchema = createInsertSchema(populationHealthReports).omit({
  id: true,
  createdAt: true,
});

export const insertTreatmentEfficacyAnalysisSchema = createInsertSchema(treatmentEfficacyAnalyses).omit({
  id: true,
  createdAt: true,
});

// Types
export type CaseSummary = typeof caseSummaries.$inferSelect;
export type InsertCaseSummary = z.infer<typeof insertCaseSummarySchema>;
export type ResearchRecommendation = typeof researchRecommendations.$inferSelect;
export type InsertResearchRecommendation = z.infer<typeof insertResearchRecommendationSchema>;
export type ProviderCommunication = typeof providerCommunications.$inferSelect;
export type InsertProviderCommunication = z.infer<typeof insertProviderCommunicationSchema>;
export type TreatmentProtocol = typeof treatmentProtocols.$inferSelect;
export type InsertTreatmentProtocol = z.infer<typeof insertTreatmentProtocolSchema>;
export type ProtocolDeviation = typeof protocolDeviations.$inferSelect;
export type InsertProtocolDeviation = z.infer<typeof insertProtocolDeviationSchema>;
export type KpiReport = typeof kpiReports.$inferSelect;
export type InsertKpiReport = z.infer<typeof insertKpiReportSchema>;
export type OutcomePrediction = typeof outcomePredictions.$inferSelect;
export type InsertOutcomePrediction = z.infer<typeof insertOutcomePredictionSchema>;
export type PopulationHealthReport = typeof populationHealthReports.$inferSelect;
export type InsertPopulationHealthReport = z.infer<typeof insertPopulationHealthReportSchema>;
export type TreatmentEfficacyAnalysis = typeof treatmentEfficacyAnalyses.$inferSelect;
export type InsertTreatmentEfficacyAnalysis = z.infer<typeof insertTreatmentEfficacyAnalysisSchema>;

// ============================================
// AI DYNAMIC CONTENT & PERSONALIZATION
// ============================================

// User sentiment analysis logs - tracks emotional state from interactions
export const userSentimentLogs = pgTable("user_sentiment_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  source: text("source").notNull(), // 'chat', 'journal', 'feedback', 'goal_note', 'care_plan_comment'
  sourceId: varchar("source_id"), // Reference to the source entity
  content: text("content"), // The analyzed text (optional, for privacy)
  sentiment: text("sentiment").notNull(), // 'positive', 'neutral', 'negative', 'anxious', 'hopeful', 'frustrated'
  sentimentScore: integer("sentiment_score").notNull(), // -100 to 100
  emotionalIndicators: jsonb("emotional_indicators"), // {stress: 0.3, motivation: 0.8, confusion: 0.1}
  healthContextIndicators: jsonb("health_context_indicators"), // {symptomConcern: true, treatmentAnxiety: false}
  aiConfidence: integer("ai_confidence"), // 0-100 confidence in analysis
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Personalized content recommendations - AI-curated educational content
export const personalizedContent = pgTable("personalized_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(), // 'article', 'video', 'tip', 'exercise', 'meditation', 'recipe'
  title: text("title").notNull(),
  description: text("description"),
  contentUrl: text("content_url"),
  contentBody: text("content_body"), // For inline content
  category: text("category").notNull(), // 'nutrition', 'exercise', 'mental_health', 'medication', 'condition_specific'
  conditionTags: jsonb("condition_tags"), // Related health conditions
  difficultyLevel: text("difficulty_level").default("beginner"), // 'beginner', 'intermediate', 'advanced'
  estimatedDuration: integer("estimated_duration"), // minutes
  relevanceScore: integer("relevance_score"), // 0-100 AI-calculated relevance
  personalizedReason: text("personalized_reason"), // Why this was recommended
  isViewed: boolean("is_viewed").default(false),
  isCompleted: boolean("is_completed").default(false),
  isSaved: boolean("is_saved").default(false),
  userRating: integer("user_rating"), // 1-5 stars
  viewedAt: timestamp("viewed_at"),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"), // Content may become less relevant
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Care plan task adjustments - AI-driven modifications based on progress
export const carePlanAdjustments = pgTable("care_plan_adjustments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  carePlanId: varchar("care_plan_id").notNull().references(() => carePlans.id, { onDelete: "cascade" }),
  activityId: varchar("activity_id").references(() => carePlanActivities.id, { onDelete: "set null" }),
  adjustmentType: text("adjustment_type").notNull(), // 'difficulty_change', 'frequency_change', 'new_task', 'remove_task', 'priority_change', 'deadline_extension'
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value"),
  reason: text("reason").notNull(), // AI-generated explanation
  triggerType: text("trigger_type").notNull(), // 'progress_slow', 'progress_fast', 'sentiment_low', 'streak_broken', 'goal_achieved'
  triggerMetrics: jsonb("trigger_metrics"), // Supporting data for the adjustment
  status: text("status").notNull().default("pending"), // 'pending', 'accepted', 'rejected', 'auto_applied'
  userFeedback: text("user_feedback"),
  appliedAt: timestamp("applied_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User progress snapshots - periodic summaries for AI analysis
export const userProgressSnapshots = pgTable("user_progress_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  snapshotDate: timestamp("snapshot_date").notNull(),
  period: text("period").notNull(), // 'daily', 'weekly', 'monthly'
  goalsMetrics: jsonb("goals_metrics"), // {activeGoals, completedTasks, streakDays, avgCompletionRate}
  carePlanMetrics: jsonb("care_plan_metrics"), // {activePlans, tasksCompleted, tasksOverdue, adherenceRate}
  sentimentMetrics: jsonb("sentiment_metrics"), // {avgScore, trend, dominantMood}
  engagementMetrics: jsonb("engagement_metrics"), // {loginDays, timeSpent, featuresUsed}
  healthMetrics: jsonb("health_metrics"), // {vitalsLogged, conditionsTracked, medicationAdherence}
  aiRecommendations: jsonb("ai_recommendations"), // Array of {type, priority, suggestion}
  overallWellnessScore: integer("overall_wellness_score"), // 0-100 composite score
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// COMMUNITY FEATURES
// ============================================

// Health communities - condition-based support groups
export const healthCommunities = pgTable("health_communities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  conditionTags: jsonb("condition_tags").notNull(), // Array of related conditions
  iconName: text("icon_name").default("users"), // Feather icon
  coverImageUrl: text("cover_image_url"),
  isPublic: boolean("is_public").default(true),
  isOfficial: boolean("is_official").default(false), // Moderated by health professionals
  memberCount: integer("member_count").default(0),
  postCount: integer("post_count").default(0),
  guidelines: text("guidelines"), // Community rules
  moderatorIds: jsonb("moderator_ids"), // Array of user IDs
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Community memberships
export const communityMemberships = pgTable("community_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  communityId: varchar("community_id").notNull().references(() => healthCommunities.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // 'member', 'moderator', 'admin'
  displayName: text("display_name"), // Anonymous display name
  isAnonymous: boolean("is_anonymous").default(true), // Privacy protection
  notificationsEnabled: boolean("notifications_enabled").default(true),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at"),
});

// Community posts - experience sharing
export const communityPosts = pgTable("community_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").notNull().references(() => healthCommunities.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  authorDisplayName: text("author_display_name"), // Cached for anonymity
  postType: text("post_type").notNull().default("experience"), // 'experience', 'question', 'tip', 'milestone', 'support_request'
  title: text("title"),
  content: text("content").notNull(),
  tags: jsonb("tags"), // Array of topic tags
  attachmentUrls: jsonb("attachment_urls"), // Array of image URLs
  isAnonymous: boolean("is_anonymous").default(true),
  isPinned: boolean("is_pinned").default(false),
  isHidden: boolean("is_hidden").default(false), // Moderation flag
  likeCount: integer("like_count").default(0),
  commentCount: integer("comment_count").default(0),
  viewCount: integer("view_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Post comments
export const postComments = pgTable("post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  authorDisplayName: text("author_display_name"),
  parentCommentId: varchar("parent_comment_id"), // For nested replies
  content: text("content").notNull(),
  isAnonymous: boolean("is_anonymous").default(true),
  isHidden: boolean("is_hidden").default(false),
  likeCount: integer("like_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Post/comment reactions
export const communityReactions = pgTable("community_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(), // 'post', 'comment'
  targetId: varchar("target_id").notNull(),
  reactionType: text("reaction_type").notNull(), // 'like', 'heart', 'support', 'helpful', 'celebrate'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Community content reports
export const contentReports = pgTable("content_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetType: text("target_type").notNull(), // 'post', 'comment'
  targetId: varchar("target_id").notNull(),
  communityId: varchar("community_id").references(() => healthCommunities.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(), // 'spam', 'harassment', 'misinformation', 'inappropriate', 'self_harm', 'other'
  description: text("description"),
  status: text("status").notNull().default("pending"), // 'pending', 'reviewed', 'action_taken', 'dismissed'
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  actionTaken: text("action_taken"), // 'none', 'content_hidden', 'user_warned', 'user_suspended'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Moderation actions log
export const moderationActions = pgTable("moderation_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moderatorId: varchar("moderator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  communityId: varchar("community_id").notNull().references(() => healthCommunities.id, { onDelete: "cascade" }),
  targetUserId: varchar("target_user_id").references(() => users.id, { onDelete: "cascade" }),
  targetPostId: varchar("target_post_id"),
  targetCommentId: varchar("target_comment_id"),
  actionType: text("action_type").notNull(), // 'hide_post', 'hide_comment', 'warn_user', 'mute_user', 'ban_user', 'unban_user', 'pin_post', 'unpin_post'
  reason: text("reason"),
  duration: integer("duration"), // Duration in hours for temporary actions (mute/ban)
  expiresAt: timestamp("expires_at"),
  relatedReportId: varchar("related_report_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User warnings and bans
export const communityUserStatus = pgTable("community_user_status", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  communityId: varchar("community_id").notNull().references(() => healthCommunities.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("active"), // 'active', 'warned', 'muted', 'suspended', 'banned'
  warningCount: integer("warning_count").default(0),
  muteExpiresAt: timestamp("mute_expires_at"),
  banExpiresAt: timestamp("ban_expires_at"),
  banReason: text("ban_reason"),
  lastWarningAt: timestamp("last_warning_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Goal progress shares - anonymized goal milestones shared to community
export const goalProgressShares = pgTable("goal_progress_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  communityId: varchar("community_id").notNull().references(() => healthCommunities.id, { onDelete: "cascade" }),
  goalCategory: text("goal_category").notNull(), // 'exercise', 'nutrition', 'medication', 'sleep', 'wellness', 'custom'
  milestoneTitle: text("milestone_title").notNull(),
  progressPercent: integer("progress_percent"),
  insightText: text("insight_text"), // anonymized insight
  isAnonymous: boolean("is_anonymous").default(true),
  displayName: text("display_name"),
  linkedPostId: varchar("linked_post_id"),
  privacyLevel: text("privacy_level").notNull().default("anonymized"), // 'anonymized', 'pseudonymous', 'named'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// TEAM-BASED GAMIFICATION
// ============================================

// Health teams - groups for team challenges
export const healthTeams = pgTable("health_teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  iconName: text("icon_name").default("users"),
  teamColor: text("team_color").default("#4A90A4"), // Theme color
  conditionFocus: text("condition_focus"), // Primary condition this team focuses on
  maxMembers: integer("max_members").default(20),
  currentMembers: integer("current_members").default(0),
  totalPoints: integer("total_points").default(0),
  weeklyPoints: integer("weekly_points").default(0),
  monthlyPoints: integer("monthly_points").default(0),
  challengesWon: integer("challenges_won").default(0),
  captainId: varchar("captain_id").references(() => users.id, { onDelete: "set null" }),
  isPublic: boolean("is_public").default(true),
  inviteCode: text("invite_code"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Team memberships
export const teamMemberships = pgTable("team_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  teamId: varchar("team_id").notNull().references(() => healthTeams.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // 'member', 'captain', 'co-captain'
  contributedPoints: integer("contributed_points").default(0),
  weeklyContribution: integer("weekly_contribution").default(0),
  challengesCompleted: integer("challenges_completed").default(0),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  lastContributionAt: timestamp("last_contribution_at"),
});

// Team challenges - competitive health goals
export const teamChallenges = pgTable("team_challenges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(), // 'steps', 'exercise', 'nutrition', 'medication', 'sleep', 'mindfulness', 'custom'
  challengeType: text("challenge_type").notNull(), // 'team_vs_team', 'team_goal', 'individual_contribution'
  goalType: text("goal_type").notNull(), // 'cumulative', 'average', 'streak', 'completion_rate'
  targetValue: integer("target_value").notNull(),
  targetUnit: text("target_unit").notNull(),
  pointsReward: integer("points_reward").notNull().default(500),
  bonusPoints: integer("bonus_points").default(0), // Extra for winning team
  conditionTag: text("condition_tag"), // Specific condition focus
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").default(true),
  isCompleted: boolean("is_completed").default(false),
  winnerTeamId: varchar("winner_team_id").references(() => healthTeams.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Team challenge participations
export const teamChallengeParticipations = pgTable("team_challenge_participations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => healthTeams.id, { onDelete: "cascade" }),
  challengeId: varchar("challenge_id").notNull().references(() => teamChallenges.id, { onDelete: "cascade" }),
  currentProgress: integer("current_progress").default(0),
  targetProgress: integer("target_progress").notNull(),
  progressPercentage: integer("progress_percentage").default(0),
  contributingMembers: integer("contributing_members").default(0),
  isCompleted: boolean("is_completed").default(false),
  isWinner: boolean("is_winner").default(false),
  pointsEarned: integer("points_earned").default(0),
  completedAt: timestamp("completed_at"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// Individual contributions to team challenges
export const teamChallengeContributions = pgTable("team_challenge_contributions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  teamId: varchar("team_id").notNull().references(() => healthTeams.id, { onDelete: "cascade" }),
  challengeId: varchar("challenge_id").notNull().references(() => teamChallenges.id, { onDelete: "cascade" }),
  contributionValue: integer("contribution_value").notNull(),
  contributionDate: timestamp("contribution_date").notNull(),
  notes: text("notes"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Team leaderboards - cached rankings
export const teamLeaderboards = pgTable("team_leaderboards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  period: text("period").notNull(), // 'weekly', 'monthly', 'all_time'
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end"),
  category: text("category"), // null for overall, or specific condition
  rankings: jsonb("rankings").notNull(), // Array of {teamId, rank, points, memberCount}
  totalTeams: integer("total_teams").default(0),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas for new tables
export const insertUserSentimentLogSchema = createInsertSchema(userSentimentLogs).omit({
  id: true,
  createdAt: true,
});

export const insertPersonalizedContentSchema = createInsertSchema(personalizedContent).omit({
  id: true,
  createdAt: true,
});

export const insertCarePlanAdjustmentSchema = createInsertSchema(carePlanAdjustments).omit({
  id: true,
  createdAt: true,
});

export const insertUserProgressSnapshotSchema = createInsertSchema(userProgressSnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertHealthCommunitySchema = createInsertSchema(healthCommunities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommunityMembershipSchema = createInsertSchema(communityMemberships).omit({
  id: true,
  joinedAt: true,
});

export const insertCommunityPostSchema = createInsertSchema(communityPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  likeCount: true,
  commentCount: true,
  viewCount: true,
});

export const insertPostCommentSchema = createInsertSchema(postComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  likeCount: true,
});

export const insertCommunityReactionSchema = createInsertSchema(communityReactions).omit({
  id: true,
  createdAt: true,
});

export const insertContentReportSchema = createInsertSchema(contentReports).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
  reviewedBy: true,
  reviewNotes: true,
  actionTaken: true,
});

export const insertModerationActionSchema = createInsertSchema(moderationActions).omit({
  id: true,
  createdAt: true,
});

export const insertCommunityUserStatusSchema = createInsertSchema(communityUserStatus).omit({
  id: true,
  updatedAt: true,
});

export const insertGoalProgressShareSchema = createInsertSchema(goalProgressShares).omit({
  id: true,
  createdAt: true,
});

export const insertHealthTeamSchema = createInsertSchema(healthTeams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  currentMembers: true,
  totalPoints: true,
  weeklyPoints: true,
  monthlyPoints: true,
  challengesWon: true,
});

export const insertTeamMembershipSchema = createInsertSchema(teamMemberships).omit({
  id: true,
  joinedAt: true,
  contributedPoints: true,
  weeklyContribution: true,
  challengesCompleted: true,
});

export const insertTeamChallengeSchema = createInsertSchema(teamChallenges).omit({
  id: true,
  createdAt: true,
  isCompleted: true,
  winnerTeamId: true,
});

export const insertTeamChallengeParticipationSchema = createInsertSchema(teamChallengeParticipations).omit({
  id: true,
  joinedAt: true,
  currentProgress: true,
  progressPercentage: true,
  contributingMembers: true,
  isCompleted: true,
  isWinner: true,
  pointsEarned: true,
});

export const insertTeamChallengeContributionSchema = createInsertSchema(teamChallengeContributions).omit({
  id: true,
  createdAt: true,
});

export const insertTeamLeaderboardSchema = createInsertSchema(teamLeaderboards).omit({
  id: true,
  createdAt: true,
  calculatedAt: true,
});

// ==================== AI-DRIVEN CARE PATHWAYS ====================

// Care Pathway Templates - Provider-created condition-specific pathways
export const carePathways = pgTable("care_pathways", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  condition: text("condition").notNull(), // e.g., "Type 2 Diabetes", "Hypertension", "Post-Surgery Recovery"
  conditionCode: text("condition_code"), // ICD-10 or SNOMED code
  category: text("category").notNull(), // chronic_management, acute_care, preventive, rehabilitation, mental_health
  targetDurationDays: integer("target_duration_days").notNull().default(90),
  difficultyLevel: text("difficulty_level").notNull().default("standard"), // beginner, standard, intensive
  isAiGenerated: boolean("is_ai_generated").default(false),
  aiGenerationPrompt: text("ai_generation_prompt"),
  createdByProviderId: varchar("created_by_provider_id").references(() => providerProfiles.id, { onDelete: "set null" }),
  isTemplate: boolean("is_template").default(true), // Templates can be cloned for individual patients
  isPublished: boolean("is_published").default(false),
  estimatedCompletionRate: integer("estimated_completion_rate"), // Based on historical data
  totalSteps: integer("total_steps").default(0),
  requiredMilestones: integer("required_milestones").default(0),
  tags: jsonb("tags"), // Array of searchable tags
  prerequisites: jsonb("prerequisites"), // Required conditions/assessments before starting
  outcomes: jsonb("outcomes"), // Expected outcomes with measurable targets
  evidenceBase: jsonb("evidence_base"), // Clinical guidelines/studies supporting the pathway
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Pathway Steps - Individual steps within a care pathway
export const pathwaySteps = pgTable("pathway_steps", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pathwayId: varchar("pathway_id").notNull().references(() => carePathways.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  stepType: text("step_type").notNull(), // education, task, assessment, appointment, medication, monitoring, lifestyle, milestone
  orderIndex: integer("order_index").notNull(),
  phase: integer("phase").default(1), // Grouping steps into phases (1, 2, 3...)
  phaseName: text("phase_name"), // "Initial Assessment", "Active Treatment", "Maintenance"
  durationDays: integer("duration_days"), // How long this step should take
  isMandatory: boolean("is_mandatory").default(true),
  isMilestone: boolean("is_milestone").default(false), // Key checkpoints in the pathway
  prerequisiteStepIds: jsonb("prerequisite_step_ids"), // Steps that must be completed first
  educationalContent: jsonb("educational_content"), // { title, body, contentType, duration }
  taskInstructions: jsonb("task_instructions"), // { instructions, frequency, targetMetric }
  assessmentQuestions: jsonb("assessment_questions"), // Array of questions for assessment steps
  expectedOutcome: text("expected_outcome"),
  successCriteria: jsonb("success_criteria"), // Measurable criteria for completion
  adaptiveRules: jsonb("adaptive_rules"), // Rules for dynamic content adjustment
  pointsReward: integer("points_reward").default(10),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Patient Pathway Assignments - Linking patients to pathways
export const patientPathwayAssignments = pgTable("patient_pathway_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pathwayId: varchar("pathway_id").notNull().references(() => carePathways.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedByProviderId: varchar("assigned_by_provider_id").references(() => providerProfiles.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"), // pending, active, paused, completed, abandoned, graduated
  currentPhase: integer("current_phase").default(1),
  currentStepIndex: integer("current_step_index").default(0),
  progressPercentage: integer("progress_percentage").default(0),
  startDate: timestamp("start_date"),
  expectedEndDate: timestamp("expected_end_date"),
  actualEndDate: timestamp("actual_end_date"),
  adherenceScore: integer("adherence_score").default(100), // 0-100
  engagementScore: integer("engagement_score").default(100), // 0-100
  totalPointsEarned: integer("total_points_earned").default(0),
  stepsCompleted: integer("steps_completed").default(0),
  stepsMissed: integer("steps_missed").default(0),
  lastActivityAt: timestamp("last_activity_at"),
  pausedAt: timestamp("paused_at"),
  pauseReason: text("pause_reason"),
  personalizedNotes: text("personalized_notes"), // Provider notes specific to this patient
  adaptationLevel: text("adaptation_level").default("standard"), // reduced, standard, enhanced
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Patient Step Progress - Tracking individual step completion
export const patientStepProgress = pgTable("patient_step_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => patientPathwayAssignments.id, { onDelete: "cascade" }),
  stepId: varchar("step_id").notNull().references(() => pathwaySteps.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("locked"), // locked, available, in_progress, completed, missed, skipped
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  dueDate: timestamp("due_date"),
  attempts: integer("attempts").default(0),
  timeSpentMinutes: integer("time_spent_minutes").default(0),
  assessmentResponses: jsonb("assessment_responses"), // For assessment-type steps
  assessmentScore: integer("assessment_score"), // 0-100
  patientNotes: text("patient_notes"),
  providerFeedback: text("provider_feedback"),
  pointsEarned: integer("points_earned").default(0),
  adaptedContent: jsonb("adapted_content"), // AI-personalized content for this patient
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Pathway Nudges - Automated feedback and reminders
export const pathwayNudges = pgTable("pathway_nudges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => patientPathwayAssignments.id, { onDelete: "cascade" }),
  stepId: varchar("step_id").references(() => pathwaySteps.id, { onDelete: "cascade" }),
  nudgeType: text("nudge_type").notNull(), // reminder, encouragement, warning, milestone_celebration, educational, check_in
  triggerType: text("trigger_type").notNull(), // scheduled, progress_based, inactivity, deadline, achievement
  title: text("title").notNull(),
  message: text("message").notNull(),
  aiGeneratedMessage: text("ai_generated_message"), // Personalized AI-generated content
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  deliveryChannel: text("delivery_channel").notNull().default("in_app"), // in_app, push, email, sms
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  readAt: timestamp("read_at"),
  dismissedAt: timestamp("dismissed_at"),
  actionTaken: text("action_taken"), // What the patient did in response
  actionTakenAt: timestamp("action_taken_at"),
  isAiGenerated: boolean("is_ai_generated").default(false),
  aiContext: jsonb("ai_context"), // Context used for AI generation
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Pathway Adherence Logs - Detailed tracking of patient actions
export const pathwayAdherenceLogs = pgTable("pathway_adherence_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => patientPathwayAssignments.id, { onDelete: "cascade" }),
  stepId: varchar("step_id").references(() => pathwaySteps.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // step_started, step_completed, step_skipped, step_missed, content_viewed, assessment_submitted, check_in, milestone_reached
  eventData: jsonb("event_data"), // Flexible data for the event
  adherenceImpact: integer("adherence_impact"), // How this event affects adherence score (-10 to +10)
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Pathway Analytics - Aggregated metrics for providers
export const pathwayAnalytics = pgTable("pathway_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pathwayId: varchar("pathway_id").notNull().references(() => carePathways.id, { onDelete: "cascade" }),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  totalAssignments: integer("total_assignments").default(0),
  activePatients: integer("active_patients").default(0),
  completedPatients: integer("completed_patients").default(0),
  abandonedPatients: integer("abandoned_patients").default(0),
  averageAdherence: integer("average_adherence").default(0),
  averageCompletionDays: integer("average_completion_days"),
  stepCompletionRates: jsonb("step_completion_rates"), // Per-step completion rates
  commonDropoffPoints: jsonb("common_dropoff_points"), // Steps where patients often abandon
  outcomeMetrics: jsonb("outcome_metrics"), // Tracked outcomes vs expected
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI-Assisted Case Reviews
export const aiCaseReviews = pgTable("ai_case_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").references(() => users.id),
  anonymizedData: jsonb("anonymized_data").notNull(),
  chiefComplaint: text("chief_complaint").notNull(),
  clinicalHistory: text("clinical_history"),
  currentMedications: jsonb("current_medications"),
  labResults: jsonb("lab_results"),
  imagingResults: jsonb("imaging_results"),
  vitalSigns: jsonb("vital_signs"),
  status: text("status").notNull().default("pending"),
  aiAnalysis: jsonb("ai_analysis"),
  potentialDiagnoses: jsonb("potential_diagnoses"),
  treatmentOptions: jsonb("treatment_options"),
  clinicalTrialMatches: jsonb("clinical_trial_matches"),
  differentialDiagnosis: jsonb("differential_diagnosis"),
  riskAssessment: jsonb("risk_assessment"),
  followUpRecommendations: jsonb("follow_up_recommendations"),
  evidenceReferences: jsonb("evidence_references"),
  confidenceScore: integer("confidence_score"),
  reviewedByProviderId: varchar("reviewed_by_provider_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Clinical Trials Database
export const clinicalTrials = pgTable("clinical_trials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  nctId: text("nct_id").unique(),
  title: text("title").notNull(),
  condition: text("condition").notNull(),
  phase: text("phase"),
  status: text("status").notNull(),
  sponsor: text("sponsor"),
  location: text("location"),
  eligibilityCriteria: jsonb("eligibility_criteria"),
  interventions: jsonb("interventions"),
  outcomes: jsonb("outcomes"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  enrollmentTarget: integer("enrollment_target"),
  currentEnrollment: integer("current_enrollment"),
  contactInfo: jsonb("contact_info"),
  description: text("description"),
  keywords: jsonb("keywords"),
  lastUpdated: timestamp("last_updated"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Provider Messages with AI Summarization
export const providerMessages = pgTable("provider_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull(),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  senderName: text("sender_name").notNull(),
  senderRole: text("sender_role"),
  senderSpecialty: text("sender_specialty"),
  content: text("content").notNull(),
  messageType: text("message_type").notNull().default("message"),
  attachments: jsonb("attachments"),
  referencedCaseId: varchar("referenced_case_id").references(() => aiCaseReviews.id),
  referencedPatientId: varchar("referenced_patient_id").references(() => users.id),
  isUrgent: boolean("is_urgent").default(false),
  readBy: jsonb("read_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Provider Message Threads
export const providerMessageThreads = pgTable("provider_message_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subject: text("subject").notNull(),
  threadType: text("thread_type").notNull().default("discussion"),
  participants: jsonb("participants").notNull(),
  caseReviewId: varchar("case_review_id").references(() => aiCaseReviews.id),
  patientId: varchar("patient_id").references(() => users.id),
  status: text("status").notNull().default("active"),
  priority: text("priority").default("normal"),
  lastMessageAt: timestamp("last_message_at"),
  messageCount: integer("message_count").default(0),
  aiSummary: text("ai_summary"),
  aiKeyPoints: jsonb("ai_key_points"),
  aiActionItems: jsonb("ai_action_items"),
  aiSummaryUpdatedAt: timestamp("ai_summary_updated_at"),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas for case reviews and messaging
export const insertAiCaseReviewSchema = createInsertSchema(aiCaseReviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClinicalTrialSchema = createInsertSchema(clinicalTrials).omit({
  id: true,
  createdAt: true,
});

export const insertProviderMessageSchema = createInsertSchema(providerMessages).omit({
  id: true,
  createdAt: true,
});

export const insertProviderMessageThreadSchema = createInsertSchema(providerMessageThreads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types for case reviews and messaging
export type AiCaseReview = typeof aiCaseReviews.$inferSelect;
export type InsertAiCaseReview = z.infer<typeof insertAiCaseReviewSchema>;
export type ClinicalTrial = typeof clinicalTrials.$inferSelect;
export type InsertClinicalTrial = z.infer<typeof insertClinicalTrialSchema>;
export type ProviderMessage = typeof providerMessages.$inferSelect;
export type InsertProviderMessage = z.infer<typeof insertProviderMessageSchema>;
export type ProviderMessageThread = typeof providerMessageThreads.$inferSelect;
export type InsertProviderMessageThread = z.infer<typeof insertProviderMessageThreadSchema>;

// Constants for case reviews
export const CASE_REVIEW_STATUS = ["pending", "analyzing", "completed", "reviewed", "archived"] as const;
export const PROVIDER_MESSAGE_TYPES = ["message", "case_update", "ai_insight", "action_item", "decision"] as const;
export const THREAD_TYPES = ["discussion", "case_review", "consultation", "care_coordination", "referral"] as const;
export const THREAD_PRIORITY = ["low", "normal", "high", "urgent"] as const;

// Insert schemas for care pathways
export const insertCarePathwaySchema = createInsertSchema(carePathways).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalSteps: true,
  requiredMilestones: true,
});

export const insertPathwayStepSchema = createInsertSchema(pathwaySteps).omit({
  id: true,
  createdAt: true,
});

export const insertPatientPathwayAssignmentSchema = createInsertSchema(patientPathwayAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  progressPercentage: true,
  stepsCompleted: true,
  stepsMissed: true,
  totalPointsEarned: true,
});

export const insertPatientStepProgressSchema = createInsertSchema(patientStepProgress).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPathwayNudgeSchema = createInsertSchema(pathwayNudges).omit({
  id: true,
  createdAt: true,
});

export const insertPathwayAdherenceLogSchema = createInsertSchema(pathwayAdherenceLogs).omit({
  id: true,
  timestamp: true,
});

export const insertPathwayAnalyticsSchema = createInsertSchema(pathwayAnalytics).omit({
  id: true,
  createdAt: true,
});

// Types for new tables
export type UserSentimentLog = typeof userSentimentLogs.$inferSelect;
export type InsertUserSentimentLog = z.infer<typeof insertUserSentimentLogSchema>;
export type PersonalizedContent = typeof personalizedContent.$inferSelect;
export type InsertPersonalizedContent = z.infer<typeof insertPersonalizedContentSchema>;
export type CarePlanAdjustment = typeof carePlanAdjustments.$inferSelect;
export type InsertCarePlanAdjustment = z.infer<typeof insertCarePlanAdjustmentSchema>;
export type UserProgressSnapshot = typeof userProgressSnapshots.$inferSelect;
export type InsertUserProgressSnapshot = z.infer<typeof insertUserProgressSnapshotSchema>;
export type HealthCommunity = typeof healthCommunities.$inferSelect;
export type InsertHealthCommunity = z.infer<typeof insertHealthCommunitySchema>;
export type CommunityMembership = typeof communityMemberships.$inferSelect;
export type InsertCommunityMembership = z.infer<typeof insertCommunityMembershipSchema>;
export type CommunityPost = typeof communityPosts.$inferSelect;
export type InsertCommunityPost = z.infer<typeof insertCommunityPostSchema>;
export type PostComment = typeof postComments.$inferSelect;
export type InsertPostComment = z.infer<typeof insertPostCommentSchema>;
export type CommunityReaction = typeof communityReactions.$inferSelect;
export type InsertCommunityReaction = z.infer<typeof insertCommunityReactionSchema>;
export type ContentReport = typeof contentReports.$inferSelect;
export type InsertContentReport = z.infer<typeof insertContentReportSchema>;
export type ModerationAction = typeof moderationActions.$inferSelect;
export type InsertModerationAction = z.infer<typeof insertModerationActionSchema>;
export type CommunityUserStatus = typeof communityUserStatus.$inferSelect;
export type InsertCommunityUserStatus = z.infer<typeof insertCommunityUserStatusSchema>;
export type GoalProgressShare = typeof goalProgressShares.$inferSelect;
export type InsertGoalProgressShare = z.infer<typeof insertGoalProgressShareSchema>;
export type HealthTeam = typeof healthTeams.$inferSelect;
export type InsertHealthTeam = z.infer<typeof insertHealthTeamSchema>;
export type TeamMembership = typeof teamMemberships.$inferSelect;
export type InsertTeamMembership = z.infer<typeof insertTeamMembershipSchema>;
export type TeamChallenge = typeof teamChallenges.$inferSelect;
export type InsertTeamChallenge = z.infer<typeof insertTeamChallengeSchema>;
export type TeamChallengeParticipation = typeof teamChallengeParticipations.$inferSelect;
export type InsertTeamChallengeParticipation = z.infer<typeof insertTeamChallengeParticipationSchema>;
export type TeamChallengeContribution = typeof teamChallengeContributions.$inferSelect;
export type InsertTeamChallengeContribution = z.infer<typeof insertTeamChallengeContributionSchema>;
export type TeamLeaderboard = typeof teamLeaderboards.$inferSelect;
export type InsertTeamLeaderboard = z.infer<typeof insertTeamLeaderboardSchema>;
export type CarePathway = typeof carePathways.$inferSelect;
export type InsertCarePathway = z.infer<typeof insertCarePathwaySchema>;
export type PathwayStep = typeof pathwaySteps.$inferSelect;
export type InsertPathwayStep = z.infer<typeof insertPathwayStepSchema>;
export type PatientPathwayAssignment = typeof patientPathwayAssignments.$inferSelect;
export type InsertPatientPathwayAssignment = z.infer<typeof insertPatientPathwayAssignmentSchema>;
export type PatientStepProgress = typeof patientStepProgress.$inferSelect;
export type InsertPatientStepProgress = z.infer<typeof insertPatientStepProgressSchema>;
export type PathwayNudge = typeof pathwayNudges.$inferSelect;
export type InsertPathwayNudge = z.infer<typeof insertPathwayNudgeSchema>;
export type PathwayAdherenceLog = typeof pathwayAdherenceLogs.$inferSelect;
export type InsertPathwayAdherenceLog = z.infer<typeof insertPathwayAdherenceLogSchema>;
export type PathwayAnalytics = typeof pathwayAnalytics.$inferSelect;
export type InsertPathwayAnalytics = z.infer<typeof insertPathwayAnalyticsSchema>;

// Constants for personalized journeys
export const SENTIMENT_TYPES = ["positive", "neutral", "negative", "anxious", "hopeful", "frustrated"] as const;
export const CONTENT_TYPES = ["article", "video", "tip", "exercise", "meditation", "recipe"] as const;
export const ADJUSTMENT_TYPES = ["difficulty_change", "frequency_change", "new_task", "remove_task", "priority_change", "deadline_extension"] as const;
export const POST_TYPES = ["experience", "question", "tip", "milestone", "support_request"] as const;
export const REACTION_TYPES = ["like", "heart", "support", "helpful", "celebrate"] as const;
export const CHALLENGE_CATEGORIES = ["steps", "exercise", "nutrition", "medication", "sleep", "mindfulness", "custom"] as const;
export const CHALLENGE_TYPES = ["team_vs_team", "team_goal", "individual_contribution"] as const;
export const PATHWAY_CATEGORIES = ["chronic_management", "acute_care", "preventive", "rehabilitation", "mental_health"] as const;
export const PATHWAY_STEP_TYPES = ["education", "task", "assessment", "appointment", "medication", "monitoring", "lifestyle", "milestone"] as const;
export const NUDGE_TYPES = ["reminder", "encouragement", "warning", "milestone_celebration", "educational", "check_in"] as const;
export const NUDGE_TRIGGER_TYPES = ["scheduled", "progress_based", "inactivity", "deadline", "achievement"] as const;

// ==================== PROVIDER DASHBOARD ====================

export const DASHBOARD_WIDGET_TYPES = [
  "ai_insights",
  "pathway_progress",
  "adherence_summary",
  "case_review_alerts",
  "upcoming_tasks",
  "patient_alerts",
  "quick_stats",
  "recent_activity"
] as const;

export const providerDashboardWidgets = pgTable("provider_dashboard_widgets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  widgetType: varchar("widget_type", { length: 50 }).notNull(),
  title: varchar("title", { length: 100 }).notNull(),
  position: integer("position").notNull().default(0),
  size: varchar("size", { length: 20 }).notNull().default("medium"),
  isVisible: boolean("is_visible").notNull().default(true),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const providerDashboardPreferences = pgTable("provider_dashboard_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  defaultView: varchar("default_view", { length: 20 }).notNull().default("grid"),
  refreshInterval: integer("refresh_interval").default(300),
  showWelcomeMessage: boolean("show_welcome_message").default(true),
  theme: varchar("theme", { length: 20 }).default("system"),
  notificationsEnabled: boolean("notifications_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const providerTasks = pgTable("provider_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assigneeId: varchar("assignee_id").references(() => users.id, { onDelete: "set null" }),
  patientId: varchar("patient_id").references(() => users.id, { onDelete: "set null" }),
  patientName: varchar("patient_name", { length: 255 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  notes: text("notes"),
  taskType: varchar("task_type", { length: 50 }).notNull(),
  priority: varchar("priority", { length: 20 }).notNull().default("normal"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  dueDate: timestamp("due_date"),
  reminderDate: timestamp("reminder_date"),
  completedAt: timestamp("completed_at"),
  relatedEntityType: varchar("related_entity_type", { length: 50 }),
  relatedEntityId: varchar("related_entity_id"),
  recurrence: varchar("recurrence", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const providerTaskComments = pgTable("provider_task_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => providerTasks.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProviderDashboardWidgetSchema = createInsertSchema(providerDashboardWidgets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProviderDashboardPreferencesSchema = createInsertSchema(providerDashboardPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProviderTaskSchema = createInsertSchema(providerTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ProviderDashboardWidget = typeof providerDashboardWidgets.$inferSelect;
export type InsertProviderDashboardWidget = z.infer<typeof insertProviderDashboardWidgetSchema>;
export type ProviderDashboardPreferences = typeof providerDashboardPreferences.$inferSelect;
export type InsertProviderDashboardPreferences = z.infer<typeof insertProviderDashboardPreferencesSchema>;
export const insertProviderTaskCommentSchema = createInsertSchema(providerTaskComments).omit({
  id: true,
  createdAt: true,
});

export type ProviderTask = typeof providerTasks.$inferSelect;
export type InsertProviderTask = z.infer<typeof insertProviderTaskSchema>;
export type ProviderTaskComment = typeof providerTaskComments.$inferSelect;
export type InsertProviderTaskComment = z.infer<typeof insertProviderTaskCommentSchema>;

export const PROVIDER_TASK_TYPES = ["follow_up", "review_results", "call_patient", "prescription_renewal", "referral", "documentation", "care_plan_update", "other"] as const;
export const PROVIDER_TASK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const PROVIDER_TASK_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;
export const WIDGET_SIZES = ["small", "medium", "large", "full"] as const;

// Clinical Documentation Tables
export const clinicalNotes = pgTable("clinical_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  encounterId: varchar("encounter_id"),
  noteType: varchar("note_type", { length: 50 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  title: text("title").notNull(),
  chiefComplaint: text("chief_complaint"),
  historyOfPresentIllness: text("history_of_present_illness"),
  reviewOfSystems: jsonb("review_of_systems"),
  physicalExamination: jsonb("physical_examination"),
  assessment: text("assessment"),
  plan: text("plan"),
  fullNoteContent: text("full_note_content"),
  aiGeneratedContent: jsonb("ai_generated_content"),
  icdCodes: jsonb("icd_codes"),
  cptCodes: jsonb("cpt_codes"),
  transcriptId: varchar("transcript_id"),
  signedAt: timestamp("signed_at"),
  signedBy: varchar("signed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const audioTranscripts = pgTable("audio_transcripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").references(() => users.id, { onDelete: "set null" }),
  audioFileName: text("audio_file_name"),
  audioDurationSeconds: integer("audio_duration_seconds"),
  transcriptionStatus: varchar("transcription_status", { length: 20 }).notNull().default("pending"),
  rawTranscript: text("raw_transcript"),
  structuredTranscript: jsonb("structured_transcript"),
  speakerLabels: jsonb("speaker_labels"),
  medicalTermsExtracted: jsonb("medical_terms_extracted"),
  keyPointsSummary: jsonb("key_points_summary"),
  aiProcessedAt: timestamp("ai_processed_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const codeSuggestions = pgTable("code_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clinicalNoteId: varchar("clinical_note_id").references(() => clinicalNotes.id, { onDelete: "cascade" }),
  providerId: varchar("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").references(() => users.id, { onDelete: "set null" }),
  codeType: varchar("code_type", { length: 20 }).notNull(),
  code: varchar("code", { length: 20 }).notNull(),
  description: text("description").notNull(),
  confidence: integer("confidence"),
  reasoning: text("reasoning"),
  clinicalEvidence: text("clinical_evidence"),
  status: varchar("status", { length: 20 }).notNull().default("suggested"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const priorAuthRequests = pgTable("prior_auth_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clinicalNoteId: varchar("clinical_note_id").references(() => clinicalNotes.id, { onDelete: "set null" }),
  requestType: varchar("request_type", { length: 50 }).notNull(),
  serviceDescription: text("service_description").notNull(),
  icdCodes: jsonb("icd_codes"),
  cptCodes: jsonb("cpt_codes"),
  clinicalJustification: text("clinical_justification"),
  aiGeneratedJustification: text("ai_generated_justification"),
  supportingDocuments: jsonb("supporting_documents"),
  insurerName: text("insurer_name"),
  insurerContactInfo: jsonb("insurer_contact_info"),
  status: varchar("status", { length: 30 }).notNull().default("draft"),
  submittedAt: timestamp("submitted_at"),
  responseReceivedAt: timestamp("response_received_at"),
  approvalStatus: varchar("approval_status", { length: 20 }),
  denialReason: text("denial_reason"),
  appealDeadline: timestamp("appeal_deadline"),
  externalReferenceNumber: text("external_reference_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertClinicalNoteSchema = createInsertSchema(clinicalNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAudioTranscriptSchema = createInsertSchema(audioTranscripts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCodeSuggestionSchema = createInsertSchema(codeSuggestions).omit({
  id: true,
  createdAt: true,
});

export const insertPriorAuthRequestSchema = createInsertSchema(priorAuthRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ClinicalNote = typeof clinicalNotes.$inferSelect;
export type InsertClinicalNote = z.infer<typeof insertClinicalNoteSchema>;
export type AudioTranscript = typeof audioTranscripts.$inferSelect;
export type InsertAudioTranscript = z.infer<typeof insertAudioTranscriptSchema>;
export type CodeSuggestion = typeof codeSuggestions.$inferSelect;
export type InsertCodeSuggestion = z.infer<typeof insertCodeSuggestionSchema>;
export type PriorAuthRequest = typeof priorAuthRequests.$inferSelect;
export type InsertPriorAuthRequest = z.infer<typeof insertPriorAuthRequestSchema>;

export const CLINICAL_NOTE_TYPES = ["soap", "progress", "consultation", "procedure", "admission", "discharge", "follow_up", "telehealth"] as const;
export const CLINICAL_NOTE_STATUSES = ["draft", "in_progress", "pending_review", "signed", "amended"] as const;
export const TRANSCRIPTION_STATUSES = ["pending", "processing", "completed", "failed"] as const;
export const CODE_TYPES = ["icd10", "cpt"] as const;
export const CODE_SUGGESTION_STATUSES = ["suggested", "accepted", "rejected", "modified"] as const;
export const PRIOR_AUTH_REQUEST_TYPES = ["medication", "procedure", "imaging", "dme", "specialist_referral", "inpatient", "outpatient", "home_health"] as const;
export const PRIOR_AUTH_STATUSES = ["draft", "pending_submission", "submitted", "under_review", "approved", "denied", "appealed", "expired"] as const;

// =====================================
// Personalized Patient Education System
// =====================================

// Educational Quizzes linked to modules
export const educationalQuizzes = pgTable("educational_quizzes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").references(() => educationalModules.id, { onDelete: "cascade" }),
  pathwayStepId: varchar("pathway_step_id").references(() => pathwaySteps.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  passingScore: integer("passing_score").default(70), // Percentage needed to pass
  maxAttempts: integer("max_attempts").default(3),
  timeLimit: integer("time_limit"), // Minutes, null = unlimited
  shuffleQuestions: boolean("shuffle_questions").default(true),
  showCorrectAnswers: boolean("show_correct_answers").default(true),
  difficulty: text("difficulty").default("beginner"), // beginner, intermediate, advanced
  category: text("category").notNull(), // medication, condition, lifestyle, prevention, nutrition, exercise, mental_health
  isAiGenerated: boolean("is_ai_generated").default(false),
  aiGenerationContext: jsonb("ai_generation_context"),
  isPublished: boolean("is_published").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Quiz Questions
export const quizQuestions = pgTable("quiz_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quizId: varchar("quiz_id").notNull().references(() => educationalQuizzes.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  questionType: text("question_type").notNull(), // multiple_choice, true_false, fill_in_blank
  options: jsonb("options").notNull(), // Array of {id, text, isCorrect}
  correctAnswer: text("correct_answer"), // For fill_in_blank
  explanation: text("explanation"), // Shown after answering
  points: integer("points").default(10),
  order: integer("order").default(0),
  mediaUrl: text("media_url"), // Optional image or video
  isAiGenerated: boolean("is_ai_generated").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Quiz Attempts
export const quizAttempts = pgTable("quiz_attempts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  quizId: varchar("quiz_id").notNull().references(() => educationalQuizzes.id, { onDelete: "cascade" }),
  attemptNumber: integer("attempt_number").default(1),
  score: integer("score").default(0),
  maxScore: integer("max_score").default(0),
  percentageScore: integer("percentage_score").default(0),
  passed: boolean("passed").default(false),
  timeSpent: integer("time_spent"), // Seconds
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Quiz Responses (individual question answers)
export const quizResponses = pgTable("quiz_responses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  attemptId: varchar("attempt_id").notNull().references(() => quizAttempts.id, { onDelete: "cascade" }),
  questionId: varchar("question_id").notNull().references(() => quizQuestions.id, { onDelete: "cascade" }),
  selectedOption: text("selected_option"), // For multiple_choice/true_false
  textResponse: text("text_response"), // For fill_in_blank
  isCorrect: boolean("is_correct").default(false),
  pointsEarned: integer("points_earned").default(0),
  answeredAt: timestamp("answered_at").defaultNow().notNull(),
});

// Learning Needs Assessment
export const learningNeedsAssessments = pgTable("learning_needs_assessments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assessmentType: text("assessment_type").notNull(), // initial, periodic, pathway_based, condition_triggered
  identifiedNeeds: jsonb("identified_needs").notNull(), // Array of {topic, priority, reason, suggestedModules}
  learningStyle: text("learning_style"), // visual, auditory, reading, kinesthetic
  preferredContentTypes: jsonb("preferred_content_types"), // Array of content types (article, video, quiz, etc.)
  knowledgeGaps: jsonb("knowledge_gaps"), // Areas where user shows low comprehension
  strengthAreas: jsonb("strength_areas"), // Areas where user demonstrates mastery
  aiRecommendations: jsonb("ai_recommendations"), // AI-suggested learning path
  sourcePathwayId: varchar("source_pathway_id").references(() => carePathways.id),
  sourceConditions: jsonb("source_conditions"), // Conditions that triggered this assessment
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Personalized Content Recommendations
export const contentRecommendations = pgTable("content_recommendations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  moduleId: varchar("module_id").references(() => educationalModules.id, { onDelete: "cascade" }),
  quizId: varchar("quiz_id").references(() => educationalQuizzes.id, { onDelete: "cascade" }),
  pathwayId: varchar("pathway_id").references(() => carePathways.id),
  recommendationType: text("recommendation_type").notNull(), // pathway_aligned, knowledge_gap, trending, condition_specific, goal_related
  relevanceScore: real("relevance_score").default(0.5), // 0.0 to 1.0
  personalizedReason: text("personalized_reason"), // AI-generated explanation
  priority: integer("priority").default(5), // 1-10, higher = more important
  triggerContext: jsonb("trigger_context"), // What triggered this recommendation
  status: text("status").default("pending"), // pending, viewed, started, completed, dismissed
  viewedAt: timestamp("viewed_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  dismissedAt: timestamp("dismissed_at"),
  feedbackRating: integer("feedback_rating"), // 1-5 star rating
  feedbackText: text("feedback_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

// Enhanced Personalized Nudges
export const personalizedNudges = pgTable("personalized_nudges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  nudgeType: text("nudge_type").notNull(), // reminder, encouragement, warning, celebration, educational, check_in, goal_progress, streak, behavior_change
  triggerType: text("trigger_type").notNull(), // scheduled, behavior_pattern, inactivity, goal_progress, sentiment_based, pathway_event, achievement
  title: text("title").notNull(),
  message: text("message").notNull(),
  aiPersonalizedMessage: text("ai_personalized_message"), // AI-tailored version based on user's communication history
  messageTone: text("message_tone"), // supportive, motivational, informative, celebratory, empathetic, direct
  targetedBehavior: text("targeted_behavior"), // What behavior is this nudge trying to influence
  relatedGoalId: varchar("related_goal_id").references(() => healthGoals.id),
  relatedPathwayId: varchar("related_pathway_id").references(() => carePathways.id),
  sentimentContext: jsonb("sentiment_context"), // User's recent sentiment that influenced this nudge
  behaviorPatterns: jsonb("behavior_patterns"), // Detected patterns that triggered this nudge
  communicationHistory: jsonb("communication_history"), // Recent interactions used for personalization
  optimalTiming: jsonb("optimal_timing"), // AI-determined best time to send based on user patterns
  priority: text("priority").default("normal"), // low, normal, high, urgent
  deliveryChannel: text("delivery_channel").default("in_app"), // in_app, push, email, sms
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  readAt: timestamp("read_at"),
  clickedAt: timestamp("clicked_at"),
  dismissedAt: timestamp("dismissed_at"),
  responseAction: text("response_action"), // What action did user take
  responseAt: timestamp("response_at"),
  effectivenessScore: integer("effectiveness_score"), // 0-100, how effective was this nudge
  aiModelVersion: text("ai_model_version"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert Schemas
export const insertEducationalQuizSchema = createInsertSchema(educationalQuizzes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuizQuestionSchema = createInsertSchema(quizQuestions).omit({
  id: true,
  createdAt: true,
});

export const insertQuizAttemptSchema = createInsertSchema(quizAttempts).omit({
  id: true,
  startedAt: true,
});

export const insertQuizResponseSchema = createInsertSchema(quizResponses).omit({
  id: true,
  answeredAt: true,
});

export const insertLearningNeedsAssessmentSchema = createInsertSchema(learningNeedsAssessments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContentRecommendationSchema = createInsertSchema(contentRecommendations).omit({
  id: true,
  createdAt: true,
});

export const insertPersonalizedNudgeSchema = createInsertSchema(personalizedNudges).omit({
  id: true,
  createdAt: true,
});

// Types
export type EducationalQuiz = typeof educationalQuizzes.$inferSelect;
export type InsertEducationalQuiz = z.infer<typeof insertEducationalQuizSchema>;
export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type InsertQuizQuestion = z.infer<typeof insertQuizQuestionSchema>;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;
export type QuizResponse = typeof quizResponses.$inferSelect;
export type InsertQuizResponse = z.infer<typeof insertQuizResponseSchema>;
export type LearningNeedsAssessment = typeof learningNeedsAssessments.$inferSelect;
export type InsertLearningNeedsAssessment = z.infer<typeof insertLearningNeedsAssessmentSchema>;
export type ContentRecommendation = typeof contentRecommendations.$inferSelect;
export type InsertContentRecommendation = z.infer<typeof insertContentRecommendationSchema>;
export type PersonalizedNudge = typeof personalizedNudges.$inferSelect;
export type InsertPersonalizedNudge = z.infer<typeof insertPersonalizedNudgeSchema>;

// Constants
export const QUIZ_QUESTION_TYPES = ["multiple_choice", "true_false", "fill_in_blank"] as const;
export const LEARNING_ASSESSMENT_TYPES = ["initial", "periodic", "pathway_based", "condition_triggered"] as const;
export const LEARNING_STYLES = ["visual", "auditory", "reading", "kinesthetic"] as const;
export const RECOMMENDATION_TYPES = ["pathway_aligned", "knowledge_gap", "trending", "condition_specific", "goal_related"] as const;
export const PERSONALIZED_NUDGE_TYPES = ["reminder", "encouragement", "warning", "celebration", "educational", "check_in", "goal_progress", "streak", "behavior_change"] as const;
export const PERSONALIZED_NUDGE_TRIGGER_TYPES = ["scheduled", "behavior_pattern", "inactivity", "goal_progress", "sentiment_based", "pathway_event", "achievement"] as const;
export const MESSAGE_TONES = ["supportive", "motivational", "informative", "celebratory", "empathetic", "direct"] as const;

// ==================== PROVIDER COLLABORATION SYSTEM ====================

// Care Teams - Groups of providers collaborating on patient care
export const careTeams = pgTable("care_teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  teamType: text("team_type").notNull().default("general"), // general, specialist, primary_care, oncology, cardiac, etc.
  organizationId: varchar("organization_id"),
  patientId: varchar("patient_id").references(() => users.id, { onDelete: "cascade" }),
  leadProviderId: varchar("lead_provider_id").references(() => providerProfiles.id),
  status: text("status").notNull().default("active"), // active, inactive, archived
  settings: jsonb("settings"), // { notificationPrefs, defaultPermissions, etc. }
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Care Team Members - Providers in a care team with specific roles
export const careTeamMembers = pgTable("care_team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  careTeamId: varchar("care_team_id").notNull().references(() => careTeams.id, { onDelete: "cascade" }),
  providerId: varchar("provider_id").notNull().references(() => providerProfiles.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // lead, member, consultant, observer
  permissions: jsonb("permissions"), // { canEdit, canMessage, canAssignTasks, canViewAllRecords, etc. }
  specialtyFocus: text("specialty_focus"),
  joinedAt: timestamp("joined_at").defaultNow(),
  invitedBy: varchar("invited_by").references(() => users.id),
  isActive: boolean("is_active").default(true),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Shared Patient Access - RBAC-controlled access to patient records
export const sharedPatientAccess = pgTable("shared_patient_access", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  grantedToId: varchar("granted_to_id").notNull(), // Provider ID or Care Team ID
  grantedToType: text("granted_to_type").notNull(), // provider, care_team
  accessLevel: text("access_level").notNull().default("read"), // read, read_write, full
  allowedRecordTypes: jsonb("allowed_record_types"), // null = all, or array of specific types
  allowedCategories: jsonb("allowed_categories"), // null = all, or specific categories
  dateRangeStart: timestamp("date_range_start"),
  dateRangeEnd: timestamp("date_range_end"),
  purposeOfUse: text("purpose_of_use").notNull(), // treatment, payment, operations, research
  consentRecordId: varchar("consent_record_id"),
  grantedBy: varchar("granted_by").notNull(), // patient user ID
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  revokedAt: timestamp("revoked_at"),
  revokedBy: varchar("revoked_by"),
  revokeReason: text("revoke_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Collaboration Tasks - Task lists for patient care coordination
export const collaborationTasks = pgTable("collaboration_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  careTeamId: varchar("care_team_id").references(() => careTeams.id, { onDelete: "set null" }),
  carePlanId: varchar("care_plan_id").references(() => carePlans.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  taskType: text("task_type").notNull().default("general"), // general, medication, appointment, lab_order, referral, follow_up, documentation, care_plan_step
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, cancelled, overdue
  assignedToId: varchar("assigned_to_id").references(() => providerProfiles.id),
  assignedToRole: text("assigned_to_role"), // If not assigned to specific provider, assign to role
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  completedById: varchar("completed_by_id").references(() => providerProfiles.id),
  relatedRecordIds: jsonb("related_record_ids"), // Links to health records
  notes: text("notes"),
  isRecurring: boolean("is_recurring").default(false),
  recurringPattern: text("recurring_pattern"), // daily, weekly, monthly
  parentTaskId: varchar("parent_task_id"), // For subtasks
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Task Comments - Discussion on tasks
export const taskComments = pgTable("task_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => collaborationTasks.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  authorType: text("author_type").notNull(), // provider, patient
  content: text("content").notNull(),
  attachments: jsonb("attachments"),
  isInternal: boolean("is_internal").default(false), // Internal comments not visible to patient
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Shared Care Plans - Care plans shared among care team members
export const sharedCarePlans = pgTable("shared_care_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  carePlanId: varchar("care_plan_id").notNull().references(() => carePlans.id, { onDelete: "cascade" }),
  careTeamId: varchar("care_team_id").notNull().references(() => careTeams.id, { onDelete: "cascade" }),
  sharedBy: varchar("shared_by").notNull().references(() => users.id),
  permissions: jsonb("permissions"), // { canEdit, canAddActivities, canAssignTasks }
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Patient Summaries - AI-generated summaries for provider collaboration
export const patientSummaries = pgTable("patient_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  summaryType: text("summary_type").notNull(), // comprehensive, visit, handoff, referral, specialist
  title: text("title").notNull(),
  content: text("content").notNull(),
  structuredData: jsonb("structured_data"), // { demographics, conditions, medications, allergies, recentLabs, etc. }
  dateRangeStart: timestamp("date_range_start"),
  dateRangeEnd: timestamp("date_range_end"),
  generatedBy: text("generated_by").notNull(), // ai, manual
  aiModel: text("ai_model"),
  aiConfidenceScore: integer("ai_confidence_score"),
  includedRecordIds: jsonb("included_record_ids"),
  requestedById: varchar("requested_by_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

// Collaboration Audit Logs - Detailed logging for all collaboration activities
export const collaborationAuditLogs = pgTable("collaboration_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorId: varchar("actor_id").notNull().references(() => users.id),
  actorType: text("actor_type").notNull(), // provider, patient, system
  actorName: text("actor_name"),
  actorRole: text("actor_role"),
  action: text("action").notNull(), // message_sent, task_created, task_completed, access_granted, access_revoked, summary_viewed, care_plan_updated, etc.
  resourceType: text("resource_type").notNull(), // care_team, task, message_thread, patient_summary, care_plan, shared_access
  resourceId: varchar("resource_id"),
  patientId: varchar("patient_id").references(() => users.id),
  careTeamId: varchar("care_team_id").references(() => careTeams.id),
  details: jsonb("details"), // Detailed context of the action
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  phiAccessed: boolean("phi_accessed").default(false),
  sensitivityLevel: text("sensitivity_level").default("standard"), // standard, sensitive, highly_sensitive
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas for collaboration tables
export const insertCareTeamSchema = createInsertSchema(careTeams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCareTeamMemberSchema = createInsertSchema(careTeamMembers).omit({
  id: true,
  createdAt: true,
});

export const insertSharedPatientAccessSchema = createInsertSchema(sharedPatientAccess).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCollaborationTaskSchema = createInsertSchema(collaborationTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskCommentSchema = createInsertSchema(taskComments).omit({
  id: true,
  createdAt: true,
});

export const insertSharedCarePlanSchema = createInsertSchema(sharedCarePlans).omit({
  id: true,
  createdAt: true,
});

export const insertPatientSummarySchema = createInsertSchema(patientSummaries).omit({
  id: true,
  createdAt: true,
});

export const insertCollaborationAuditLogSchema = createInsertSchema(collaborationAuditLogs).omit({
  id: true,
  createdAt: true,
});

// Types for collaboration tables
export type CareTeam = typeof careTeams.$inferSelect;
export type InsertCareTeam = z.infer<typeof insertCareTeamSchema>;
export type CareTeamMember = typeof careTeamMembers.$inferSelect;
export type InsertCareTeamMember = z.infer<typeof insertCareTeamMemberSchema>;
export type SharedPatientAccess = typeof sharedPatientAccess.$inferSelect;
export type InsertSharedPatientAccess = z.infer<typeof insertSharedPatientAccessSchema>;
export type CollaborationTask = typeof collaborationTasks.$inferSelect;
export type InsertCollaborationTask = z.infer<typeof insertCollaborationTaskSchema>;
export type TaskComment = typeof taskComments.$inferSelect;
export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type SharedCarePlan = typeof sharedCarePlans.$inferSelect;
export type InsertSharedCarePlan = z.infer<typeof insertSharedCarePlanSchema>;
export type PatientSummary = typeof patientSummaries.$inferSelect;
export type InsertPatientSummary = z.infer<typeof insertPatientSummarySchema>;
export type CollaborationAuditLog = typeof collaborationAuditLogs.$inferSelect;
export type InsertCollaborationAuditLog = z.infer<typeof insertCollaborationAuditLogSchema>;

// Constants for collaboration
export const CARE_TEAM_TYPES = ["general", "specialist", "primary_care", "oncology", "cardiac", "mental_health", "rehabilitation", "palliative"] as const;
export const CARE_TEAM_ROLES = ["lead", "member", "consultant", "observer"] as const;
export const ACCESS_LEVELS = ["read", "read_write", "full"] as const;
export const PURPOSE_OF_USE = ["treatment", "payment", "operations", "research"] as const;
export const TASK_TYPES = ["general", "medication", "appointment", "lab_order", "referral", "follow_up", "documentation", "care_plan_step"] as const;
export const TASK_STATUSES = ["pending", "in_progress", "completed", "cancelled", "overdue"] as const;
export const COLLABORATION_ACTIONS = ["message_sent", "message_read", "task_created", "task_assigned", "task_completed", "task_cancelled", "access_granted", "access_revoked", "access_modified", "summary_generated", "summary_viewed", "care_plan_shared", "care_plan_updated", "team_created", "team_member_added", "team_member_removed", "patient_record_viewed"] as const;
export const SUMMARY_TYPES = ["comprehensive", "visit", "handoff", "referral", "specialist", "emergency"] as const;

// Team Invitations - Allow patients to invite providers and family members
export const teamInvitations = pgTable("team_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  careTeamId: varchar("care_team_id").references(() => careTeams.id, { onDelete: "cascade" }),
  inviteeEmail: text("invitee_email").notNull(),
  inviteeName: text("invitee_name").notNull(),
  inviteeRole: text("invitee_role").notNull().default("family_member"), // provider, family_member, caregiver
  invitationToken: text("invitation_token").notNull().unique(),
  accessLevel: text("access_level").notNull().default("read"), // read, read_write, full
  purposeOfUse: text("purpose_of_use").default("treatment"),
  personalMessage: text("personal_message"),
  status: text("status").notNull().default("pending"), // pending, accepted, declined, expired, revoked
  expiresAt: timestamp("expires_at"),
  acceptedAt: timestamp("accepted_at"),
  acceptedByUserId: varchar("accepted_by_user_id").references(() => users.id),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  lastReminderAt: timestamp("last_reminder_at"),
  reminderCount: integer("reminder_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Care Plan Notes - Team member contributions to care plans
export const carePlanNotes = pgTable("care_plan_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  carePlanId: varchar("care_plan_id").notNull().references(() => carePlans.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  authorRole: text("author_role").notNull(), // provider, family_member, patient, caregiver
  noteType: text("note_type").notNull().default("general"), // general, progress, concern, recommendation, medication, symptom, observation
  title: text("title"),
  content: text("content").notNull(),
  priority: text("priority").default("normal"), // low, normal, high, urgent
  isPrivate: boolean("is_private").default(false), // Private notes visible only to providers
  attachments: jsonb("attachments"), // Array of attachment references
  mentionedUserIds: jsonb("mentioned_user_ids"), // For @ mentions
  parentNoteId: varchar("parent_note_id"), // For threaded replies
  isEdited: boolean("is_edited").default(false),
  editedAt: timestamp("edited_at"),
  isArchived: boolean("is_archived").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Care Team Message Participants - Track who is part of each care team conversation
export const careTeamMessageParticipants = pgTable("care_team_message_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => messagingThreads.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  userName: text("user_name").notNull(),
  userRole: text("user_role").notNull(),
  lastReadAt: timestamp("last_read_at"),
  unreadCount: integer("unread_count").default(0),
  isActive: boolean("is_active").default(true),
  mutedUntil: timestamp("muted_until"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// Insert schemas for new collaboration tables
export const insertTeamInvitationSchema = createInsertSchema(teamInvitations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCarePlanNoteSchema = createInsertSchema(carePlanNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCareTeamMessageParticipantSchema = createInsertSchema(careTeamMessageParticipants).omit({
  id: true,
  joinedAt: true,
});

// Types for new collaboration tables
export type TeamInvitation = typeof teamInvitations.$inferSelect;
export type InsertTeamInvitation = z.infer<typeof insertTeamInvitationSchema>;
export type CarePlanNote = typeof carePlanNotes.$inferSelect;
export type InsertCarePlanNote = z.infer<typeof insertCarePlanNoteSchema>;
export type CareTeamMessageParticipant = typeof careTeamMessageParticipants.$inferSelect;
export type InsertCareTeamMessageParticipant = z.infer<typeof insertCareTeamMessageParticipantSchema>;

// Extended constants for collaboration
export const INVITEE_ROLES = ["provider", "family_member", "caregiver", "specialist", "therapist"] as const;
export const INVITATION_STATUSES = ["pending", "accepted", "declined", "expired", "revoked"] as const;
export const NOTE_TYPES = ["general", "progress", "concern", "recommendation", "medication", "symptom", "observation", "goal_update"] as const;
export const CARE_TEAM_MESSAGE_TYPES = ["text", "question", "update", "alert", "reminder", "appointment", "lab_result"] as const;

// ============================================
// ACO REPORTING SUITE
// ============================================

// HEDIS Measure Definitions
export const hedisMeasures = pgTable("hedis_measures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  measureId: text("measure_id").notNull().unique(), // e.g., "BCS", "CCS", "CDC"
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // effectiveness_of_care, access_availability, experience_of_care, utilization
  subcategory: text("subcategory"),
  numeratorDescription: text("numerator_description"),
  denominatorDescription: text("denominator_description"),
  exclusionCriteria: jsonb("exclusion_criteria"),
  targetPercentage: real("target_percentage"),
  weightingFactor: real("weighting_factor").default(1.0),
  dataElements: jsonb("data_elements"), // Required data elements for calculation
  calculationLogic: text("calculation_logic"),
  reportingYear: integer("reporting_year").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Report Templates
export const reportTemplates = pgTable("report_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  reportType: text("report_type").notNull(), // quality_metrics, population_health, provider_performance, compliance_audit, custom
  category: text("category").notNull(), // hedis, star_ratings, aco_quality, payer_reporting, internal
  configJson: jsonb("config_json").notNull(), // Template configuration including metrics, filters, groupings
  layoutJson: jsonb("layout_json"), // Visual layout configuration
  defaultFilters: jsonb("default_filters"),
  requiredDataSources: jsonb("required_data_sources"),
  isSystemTemplate: boolean("is_system_template").default(false),
  createdById: varchar("created_by_id").references(() => users.id),
  organizationId: varchar("organization_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Generated Reports
export const generatedReports = pgTable("generated_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => reportTemplates.id),
  name: text("name").notNull(),
  reportType: text("report_type").notNull(),
  status: text("status").notNull().default("pending"), // pending, generating, completed, failed, expired
  filtersApplied: jsonb("filters_applied"),
  dateRangeStart: timestamp("date_range_start"),
  dateRangeEnd: timestamp("date_range_end"),
  resultData: jsonb("result_data"), // Aggregated results
  summaryStats: jsonb("summary_stats"), // Key summary statistics
  patientCount: integer("patient_count"),
  providerCount: integer("provider_count"),
  measureResults: jsonb("measure_results"), // HEDIS/quality measure results
  csvContent: text("csv_content"),
  pdfUrl: text("pdf_url"),
  fileSize: integer("file_size"),
  generatedById: varchar("generated_by_id").notNull().references(() => users.id),
  generationTimeMs: integer("generation_time_ms"),
  errorMessage: text("error_message"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Scheduled Reports
export const scheduledReports = pgTable("scheduled_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull().references(() => reportTemplates.id),
  name: text("name").notNull(),
  description: text("description"),
  scheduleType: text("schedule_type").notNull(), // daily, weekly, monthly, quarterly, annual
  scheduleConfig: jsonb("schedule_config").notNull(), // Cron expression, day of week/month, time
  filtersConfig: jsonb("filters_config"),
  outputFormats: jsonb("output_formats").default(sql`'["csv", "pdf"]'::jsonb`),
  deliveryConfig: jsonb("delivery_config"), // Email recipients, secure link settings
  isEnabled: boolean("is_enabled").default(true),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  runCount: integer("run_count").default(0),
  createdById: varchar("created_by_id").notNull().references(() => users.id),
  organizationId: varchar("organization_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Report Delivery Tracking
export const reportDeliveries = pgTable("report_deliveries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull().references(() => generatedReports.id),
  deliveryMethod: text("delivery_method").notNull(), // secure_link, email, sftp, api
  recipientEmail: text("recipient_email"),
  recipientName: text("recipient_name"),
  secureAccessToken: text("secure_access_token"),
  accessUrl: text("access_url"),
  status: text("status").notNull().default("pending"), // pending, sent, delivered, accessed, expired, failed
  accessCount: integer("access_count").default(0),
  maxAccessCount: integer("max_access_count"),
  expiresAt: timestamp("expires_at"),
  firstAccessedAt: timestamp("first_accessed_at"),
  lastAccessedAt: timestamp("last_accessed_at"),
  deliveredAt: timestamp("delivered_at"),
  errorMessage: text("error_message"),
  ipAddressLog: jsonb("ip_address_log"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Report Access Audit Log
export const reportAccessLogs = pgTable("report_access_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull().references(() => generatedReports.id),
  deliveryId: varchar("delivery_id").references(() => reportDeliveries.id),
  accessorId: varchar("accessor_id").references(() => users.id),
  accessorEmail: text("accessor_email"),
  accessType: text("access_type").notNull(), // view, download_csv, download_pdf, api_access
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  success: boolean("success").default(true),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Quality Measure Results (Cached calculations)
export const qualityMeasureResults = pgTable("quality_measure_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  measureId: varchar("measure_id").notNull().references(() => hedisMeasures.id),
  organizationId: varchar("organization_id"),
  providerId: varchar("provider_id").references(() => providerProfiles.id),
  reportingPeriodStart: timestamp("reporting_period_start").notNull(),
  reportingPeriodEnd: timestamp("reporting_period_end").notNull(),
  denominatorCount: integer("denominator_count").notNull(),
  numeratorCount: integer("numerator_count").notNull(),
  exclusionCount: integer("exclusion_count").default(0),
  rate: real("rate").notNull(), // Percentage 0-100
  targetRate: real("target_rate"),
  priorPeriodRate: real("prior_period_rate"),
  rateChange: real("rate_change"),
  starRating: integer("star_rating"), // 1-5 stars
  performanceTier: text("performance_tier"), // below_average, average, above_average, top_performer
  patientBreakdown: jsonb("patient_breakdown"), // Demographic breakdown of results
  gapAnalysis: jsonb("gap_analysis"), // Patients not meeting measure
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Provider Performance Metrics
export const providerPerformanceMetrics = pgTable("provider_performance_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => providerProfiles.id),
  organizationId: varchar("organization_id"),
  reportingPeriodStart: timestamp("reporting_period_start").notNull(),
  reportingPeriodEnd: timestamp("reporting_period_end").notNull(),
  patientPanelSize: integer("patient_panel_size"),
  activePatients: integer("active_patients"),
  visitCount: integer("visit_count"),
  averageVisitDuration: integer("average_visit_duration"),
  qualityScore: real("quality_score"), // Composite quality score
  hedisCompliance: real("hedis_compliance"),
  patientSatisfaction: real("patient_satisfaction"),
  careGapsClosed: integer("care_gaps_closed"),
  careGapsOpen: integer("care_gaps_open"),
  referralRate: real("referral_rate"),
  readmissionRate: real("readmission_rate"),
  edUtilizationRate: real("ed_utilization_rate"),
  costEfficiency: real("cost_efficiency"),
  timeToCare: real("time_to_care"), // Average days to appointment
  preventiveCareRate: real("preventive_care_rate"),
  chronicCareManagement: real("chronic_care_management"),
  performanceTrends: jsonb("performance_trends"),
  benchmarkComparison: jsonb("benchmark_comparison"),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Population Health Metrics
export const populationHealthMetrics = pgTable("population_health_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id"),
  reportingPeriodStart: timestamp("reporting_period_start").notNull(),
  reportingPeriodEnd: timestamp("reporting_period_end").notNull(),
  totalPopulation: integer("total_population").notNull(),
  riskStratification: jsonb("risk_stratification"), // Low, Medium, High, Very High counts
  ageDistribution: jsonb("age_distribution"),
  genderDistribution: jsonb("gender_distribution"),
  chronicConditions: jsonb("chronic_conditions"), // Diabetes, HTN, COPD, etc. prevalence
  socialDeterminants: jsonb("social_determinants"), // SDOH factors
  healthOutcomes: jsonb("health_outcomes"),
  utilizationMetrics: jsonb("utilization_metrics"), // ED, inpatient, outpatient visits
  costMetrics: jsonb("cost_metrics"),
  preventiveCareGaps: jsonb("preventive_care_gaps"),
  immunizationRates: jsonb("immunization_rates"),
  screeningRates: jsonb("screening_rates"),
  diseaseManagement: jsonb("disease_management"),
  trendData: jsonb("trend_data"),
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas for ACO Reporting
export const insertHedisMeasureSchema = createInsertSchema(hedisMeasures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReportTemplateSchema = createInsertSchema(reportTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGeneratedReportSchema = createInsertSchema(generatedReports).omit({
  id: true,
  createdAt: true,
});

export const insertScheduledReportSchema = createInsertSchema(scheduledReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReportDeliverySchema = createInsertSchema(reportDeliveries).omit({
  id: true,
  createdAt: true,
});

export const insertReportAccessLogSchema = createInsertSchema(reportAccessLogs).omit({
  id: true,
  createdAt: true,
});

export const insertQualityMeasureResultSchema = createInsertSchema(qualityMeasureResults).omit({
  id: true,
  createdAt: true,
});

export const insertProviderPerformanceMetricSchema = createInsertSchema(providerPerformanceMetrics).omit({
  id: true,
  createdAt: true,
});

export const insertPopulationHealthMetricSchema = createInsertSchema(populationHealthMetrics).omit({
  id: true,
  createdAt: true,
});

// Types for ACO Reporting
export type HedisMeasure = typeof hedisMeasures.$inferSelect;
export type InsertHedisMeasure = z.infer<typeof insertHedisMeasureSchema>;
export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type InsertReportTemplate = z.infer<typeof insertReportTemplateSchema>;
export type GeneratedReport = typeof generatedReports.$inferSelect;
export type InsertGeneratedReport = z.infer<typeof insertGeneratedReportSchema>;
export type ScheduledReport = typeof scheduledReports.$inferSelect;
export type InsertScheduledReport = z.infer<typeof insertScheduledReportSchema>;
export type ReportDelivery = typeof reportDeliveries.$inferSelect;
export type InsertReportDelivery = z.infer<typeof insertReportDeliverySchema>;
export type ReportAccessLog = typeof reportAccessLogs.$inferSelect;
export type InsertReportAccessLog = z.infer<typeof insertReportAccessLogSchema>;
export type QualityMeasureResult = typeof qualityMeasureResults.$inferSelect;
export type InsertQualityMeasureResult = z.infer<typeof insertQualityMeasureResultSchema>;
export type ProviderPerformanceMetric = typeof providerPerformanceMetrics.$inferSelect;
export type InsertProviderPerformanceMetric = z.infer<typeof insertProviderPerformanceMetricSchema>;
export type PopulationHealthMetric = typeof populationHealthMetrics.$inferSelect;
export type InsertPopulationHealthMetric = z.infer<typeof insertPopulationHealthMetricSchema>;

// Constants for ACO Reporting
export const REPORT_TYPES = ["quality_metrics", "population_health", "provider_performance", "compliance_audit", "custom", "hedis", "star_ratings"] as const;
export const REPORT_CATEGORIES = ["hedis", "star_ratings", "aco_quality", "payer_reporting", "internal", "regulatory"] as const;
export const REPORT_STATUSES = ["pending", "generating", "completed", "failed", "expired"] as const;
export const SCHEDULE_TYPES = ["daily", "weekly", "monthly", "quarterly", "annual"] as const;
export const DELIVERY_METHODS = ["secure_link", "email", "sftp", "api"] as const;
export const HEDIS_CATEGORIES = ["effectiveness_of_care", "access_availability", "experience_of_care", "utilization", "health_plan_descriptive"] as const;
export const PERFORMANCE_TIERS = ["below_average", "average", "above_average", "top_performer"] as const;

// =====================================================
// MASTER PATIENT INDEX (MPI) & DEDUPLICATION SYSTEM
// =====================================================

// Patient Identifiers - external MRNs, SSN (last 4), state IDs for deterministic matching
export const patientIdentifiers = pgTable("patient_identifiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => patientProfiles.id, { onDelete: "cascade" }),
  identifierType: text("identifier_type").notNull(), // mrn, ssn_last4, state_id, insurance_id, drivers_license
  identifierValue: text("identifier_value").notNull(),
  issuingAuthority: text("issuing_authority"), // hospital name, state, insurance company
  isVerified: boolean("is_verified").default(false),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: varchar("verified_by"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// NMN Status - tracks middle name validation (No Middle Name standard)
export const NMN_STATUS = ["has_middle_name", "no_middle_name", "unknown"] as const;

// Duplicate Candidates - records flagged for review (80-95% match)
export const duplicateCandidates = pgTable("duplicate_candidates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  primaryPatientId: varchar("primary_patient_id").notNull().references(() => patientProfiles.id, { onDelete: "cascade" }),
  duplicatePatientId: varchar("duplicate_patient_id").notNull().references(() => patientProfiles.id, { onDelete: "cascade" }),
  similarityScore: real("similarity_score").notNull(), // 0.0 to 1.0 (80% = 0.8)
  matchType: text("match_type").notNull(), // deterministic, probabilistic
  matchedFields: jsonb("matched_fields").notNull(), // { firstName: 0.95, lastName: 1.0, dob: 1.0 }
  status: text("status").default("pending").notNull(), // pending, confirmed_duplicate, confirmed_unique, auto_merged
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  autoMergeEligible: boolean("auto_merge_eligible").default(false), // true if score >= 95%
  sourceSystem: text("source_system"), // which import/system flagged this
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Merge History - audit trail of all patient merges
export const patientMergeHistory = pgTable("patient_merge_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  survivorPatientId: varchar("survivor_patient_id").notNull().references(() => patientProfiles.id, { onDelete: "cascade" }),
  mergedPatientId: varchar("merged_patient_id").notNull(), // Original ID before merge (kept for audit)
  mergeType: text("merge_type").notNull(), // auto_merge, manual_merge, undo_merge
  similarityScore: real("similarity_score"),
  matchDetails: jsonb("match_details"), // Full matching analysis at time of merge
  mergedData: jsonb("merged_data").notNull(), // Snapshot of merged patient data
  fieldResolutions: jsonb("field_resolutions"), // How conflicting fields were resolved
  mergedBy: varchar("merged_by").references(() => users.id),
  mergeReason: text("merge_reason"),
  isUndone: boolean("is_undone").default(false),
  undoneBy: varchar("undone_by").references(() => users.id),
  undoneAt: timestamp("undone_at"),
  undoReason: text("undo_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// MPI Match Rules - configurable matching rules and weights
export const mpiMatchRules = pgTable("mpi_match_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleName: text("rule_name").notNull(),
  ruleType: text("rule_type").notNull(), // deterministic, probabilistic
  fieldName: text("field_name").notNull(), // firstName, lastName, dob, email, ssn_last4, etc.
  weight: real("weight").notNull().default(1.0), // Weight in scoring (0.0 to 1.0)
  matchAlgorithm: text("match_algorithm").notNull(), // exact, levenshtein, phonetic, date
  threshold: real("threshold").default(0.8), // Minimum similarity for this field
  isRequired: boolean("is_required").default(false), // Must match for overall match
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Deduplication Run History - tracks batch deduplication jobs
export const deduplicationRuns = pgTable("deduplication_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  runType: text("run_type").notNull(), // full_scan, incremental, import_triggered
  status: text("status").default("running").notNull(), // running, completed, failed
  totalRecordsScanned: integer("total_records_scanned").default(0),
  duplicatesFound: integer("duplicates_found").default(0),
  autoMerged: integer("auto_merged").default(0),
  flaggedForReview: integer("flagged_for_review").default(0),
  errors: integer("errors").default(0),
  errorDetails: jsonb("error_details"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  triggeredBy: varchar("triggered_by").references(() => users.id),
  configuration: jsonb("configuration"), // Settings used for this run
});

// Insert schemas for deduplication tables
export const insertPatientIdentifierSchema = createInsertSchema(patientIdentifiers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDuplicateCandidateSchema = createInsertSchema(duplicateCandidates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPatientMergeHistorySchema = createInsertSchema(patientMergeHistory).omit({
  id: true,
  createdAt: true,
});

export const insertMpiMatchRuleSchema = createInsertSchema(mpiMatchRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDeduplicationRunSchema = createInsertSchema(deduplicationRuns).omit({
  id: true,
  startedAt: true,
});

// Types for MPI/Deduplication
export type PatientIdentifier = typeof patientIdentifiers.$inferSelect;
export type InsertPatientIdentifier = z.infer<typeof insertPatientIdentifierSchema>;
export type DuplicateCandidate = typeof duplicateCandidates.$inferSelect;
export type InsertDuplicateCandidate = z.infer<typeof insertDuplicateCandidateSchema>;
export type PatientMergeHistory = typeof patientMergeHistory.$inferSelect;
export type InsertPatientMergeHistory = z.infer<typeof insertPatientMergeHistorySchema>;
export type MpiMatchRule = typeof mpiMatchRules.$inferSelect;
export type InsertMpiMatchRule = z.infer<typeof insertMpiMatchRuleSchema>;
export type DeduplicationRun = typeof deduplicationRuns.$inferSelect;
export type InsertDeduplicationRun = z.infer<typeof insertDeduplicationRunSchema>;

// Constants for MPI/Deduplication
export const IDENTIFIER_TYPES = ["mrn", "ssn_last4", "state_id", "insurance_id", "drivers_license", "passport", "military_id"] as const;
export const MATCH_TYPES = ["deterministic", "probabilistic"] as const;
export const DUPLICATE_STATUSES = ["pending", "confirmed_duplicate", "confirmed_unique", "auto_merged"] as const;
export const MERGE_TYPES = ["auto_merge", "manual_merge", "undo_merge"] as const;
export const MATCH_ALGORITHMS = ["exact", "levenshtein", "phonetic", "date", "numeric"] as const;
export const DEDUP_RUN_TYPES = ["full_scan", "incremental", "import_triggered"] as const;
export const DEDUP_RUN_STATUSES = ["running", "completed", "failed"] as const;

// =============================================
// COMPLIANCE ALERTS SYSTEM
// =============================================

// Compliance Alerts - stores all compliance anomaly alerts
export const complianceAlerts = pgTable("compliance_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertType: text("alert_type").notNull(), // merge_rate_anomaly, phi_access_pattern, outstanding_access_review, break_glass_abuse, unusual_export
  severity: text("severity").notNull(), // critical, high, medium, low
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // deduplication, phi_access, access_review, data_export
  
  // Related entities
  userId: varchar("user_id").references(() => users.id),
  resourceType: text("resource_type"), // patient_record, audit_log, access_review, etc.
  resourceId: varchar("resource_id"),
  
  // Detection details
  detectionRule: text("detection_rule"), // The rule that triggered this alert
  thresholdValue: real("threshold_value"), // Threshold that was exceeded
  actualValue: real("actual_value"), // Actual observed value
  timeWindow: text("time_window"), // Time window analyzed (e.g., "24h", "7d")
  
  // Status tracking
  status: text("status").default("open").notNull(), // open, acknowledged, investigating, resolved, dismissed
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedBy: varchar("acknowledged_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolution: text("resolution"), // How the alert was resolved
  
  // Additional context
  metadata: jsonb("metadata"), // Additional data about the alert
  relatedAlertIds: jsonb("related_alert_ids"), // Related/grouped alerts
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Alert Rules - configurable rules for triggering alerts
export const alertRules = pgTable("alert_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  alertType: text("alert_type").notNull(),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  
  // Rule configuration
  isEnabled: boolean("is_enabled").default(true),
  thresholdValue: real("threshold_value").notNull(),
  thresholdOperator: text("threshold_operator").notNull(), // gt, gte, lt, lte, eq, ne
  timeWindowMinutes: integer("time_window_minutes").default(60),
  
  // Notification settings
  notifyEmail: boolean("notify_email").default(false),
  notifyInApp: boolean("notify_in_app").default(true),
  notifySlack: boolean("notify_slack").default(false),
  
  // Escalation
  autoEscalateAfterMinutes: integer("auto_escalate_after_minutes"),
  escalateSeverity: text("escalate_severity"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Access Reviews - tracks outstanding access reviews for PHI
export const accessReviews = pgTable("access_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reviewType: text("review_type").notNull(), // periodic, triggered, onboarding
  status: text("status").default("pending").notNull(), // pending, completed, overdue, expired
  
  // Review scope
  accessType: text("access_type").notNull(), // phi_access, admin_access, provider_access
  resourceScope: text("resource_scope"), // all, specific_patients, specific_data_types
  resourceIds: jsonb("resource_ids"),
  
  // Review details
  reviewer: varchar("reviewer").references(() => users.id),
  reviewDecision: text("review_decision"), // approved, revoked, modified
  reviewNotes: text("review_notes"),
  
  // Timing
  dueDate: timestamp("due_date").notNull(),
  completedAt: timestamp("completed_at"),
  lastReminderAt: timestamp("last_reminder_at"),
  reminderCount: integer("reminder_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// PHI Access Patterns - stores aggregated access pattern data for analysis
export const phiAccessPatterns = pgTable("phi_access_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  patternDate: timestamp("pattern_date").notNull(),
  
  // Access metrics
  totalAccesses: integer("total_accesses").default(0),
  uniquePatientRecords: integer("unique_patient_records").default(0),
  accessesByType: jsonb("accesses_by_type"), // { view: 10, export: 2, share: 1 }
  accessesByHour: jsonb("accesses_by_hour"), // { "09": 5, "10": 3, ... }
  
  // Anomaly detection
  isAnomalous: boolean("is_anomalous").default(false),
  anomalyScore: real("anomaly_score"), // 0-100 anomaly score
  anomalyReasons: jsonb("anomaly_reasons"), // Array of reasons why flagged
  
  // Baseline comparison
  baselineAverage: real("baseline_average"),
  deviationFromBaseline: real("deviation_from_baseline"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Alert Notifications - tracks when alerts were sent to users
export const alertNotifications = pgTable("alert_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  alertId: varchar("alert_id").notNull().references(() => complianceAlerts.id, { onDelete: "cascade" }),
  recipientId: varchar("recipient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(), // email, in_app, slack, sms
  status: text("status").default("pending").notNull(), // pending, sent, failed, read
  sentAt: timestamp("sent_at"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas for compliance alerts
export const insertComplianceAlertSchema = createInsertSchema(complianceAlerts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAlertRuleSchema = createInsertSchema(alertRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAccessReviewSchema = createInsertSchema(accessReviews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPhiAccessPatternSchema = createInsertSchema(phiAccessPatterns).omit({
  id: true,
  createdAt: true,
});

export const insertAlertNotificationSchema = createInsertSchema(alertNotifications).omit({
  id: true,
  createdAt: true,
});

// Types for compliance alerts
export type ComplianceAlert = typeof complianceAlerts.$inferSelect;
export type InsertComplianceAlert = z.infer<typeof insertComplianceAlertSchema>;
export type AlertRule = typeof alertRules.$inferSelect;
export type InsertAlertRule = z.infer<typeof insertAlertRuleSchema>;
export type AccessReview = typeof accessReviews.$inferSelect;
export type InsertAccessReview = z.infer<typeof insertAccessReviewSchema>;
export type PhiAccessPattern = typeof phiAccessPatterns.$inferSelect;
export type InsertPhiAccessPattern = z.infer<typeof insertPhiAccessPatternSchema>;
export type AlertNotification = typeof alertNotifications.$inferSelect;
export type InsertAlertNotification = z.infer<typeof insertAlertNotificationSchema>;

// Constants for compliance alerts
export const COMPLIANCE_ALERT_TYPES = [
  "merge_rate_anomaly",
  "rejection_rate_anomaly", 
  "phi_access_pattern",
  "break_glass_abuse",
  "unusual_export",
  "outstanding_access_review",
  "failed_auth_attempts",
  "after_hours_access",
  "identical_vital_entries",
  "overlapping_medication_logs",
  "duplicate_lab_results",
  "redundant_ai_audit_findings",
  "double_entitlement",
  "multi_device_abuse",
  "restoration_conflict",
  "mhmda_consent_gap",
  "ccpa_request_anomaly",
  "identity_document_expiry",
  "identity_cross_reference_mismatch"
] as const;

export const COMPLIANCE_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export const COMPLIANCE_STATUSES = ["open", "acknowledged", "investigating", "resolved", "dismissed"] as const;
export const COMPLIANCE_CATEGORIES = ["deduplication", "phi_access", "access_review", "data_export", "authentication", "clinical_data", "subscription", "regulatory"] as const;
export const REVIEW_TYPES = ["periodic", "triggered", "onboarding"] as const;
export const REVIEW_STATUSES = ["pending", "completed", "overdue", "expired"] as const;
export const PHI_ACCESS_TYPES = ["phi_access", "admin_access", "provider_access"] as const;

// ============================================
// Episodes of Care Tables
// ============================================

// Episode of Care - groups related health events into unified care journeys
export const episodesOfCare = pgTable("episodes_of_care", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  episodeType: text("episode_type").notNull(), // surgery, chronic_management, acute_illness, preventive_care, maternity, mental_health, rehabilitation
  status: text("status").notNull().default("active"), // active, resolved, ongoing, paused
  primaryCondition: text("primary_condition"),
  secondaryConditions: jsonb("secondary_conditions").$type<string[]>(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  triggerEventId: varchar("trigger_event_id").references(() => healthRecords.id, { onDelete: "set null" }),
  primaryProvider: text("primary_provider"),
  careTeam: jsonb("care_team").$type<{ name: string; role: string; specialty?: string }[]>(),
  treatmentGoals: jsonb("treatment_goals").$type<string[]>(),
  outcomeNotes: text("outcome_notes"),
  aiGenerated: boolean("ai_generated").default(false),
  confidence: integer("confidence"), // 0-100 for AI-generated episodes
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Episode Events - links health records to episodes
export const episodeEvents = pgTable("episode_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  episodeId: varchar("episode_id").notNull().references(() => episodesOfCare.id, { onDelete: "cascade" }),
  healthRecordId: varchar("health_record_id").notNull().references(() => healthRecords.id, { onDelete: "cascade" }),
  eventRole: text("event_role").notNull(), // trigger, follow_up, lab, medication, procedure, imaging, consultation, outcome
  sequenceOrder: integer("sequence_order"),
  clinicalRelevance: text("clinical_relevance"), // Brief explanation of how this event relates to the episode
  isKeyMilestone: boolean("is_key_milestone").default(false),
  aiLinked: boolean("ai_linked").default(false), // Whether AI suggested this link
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Episode Summaries - AI-generated summaries for episodes
export const episodeSummaries = pgTable("episode_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  episodeId: varchar("episode_id").notNull().references(() => episodesOfCare.id, { onDelete: "cascade" }),
  summaryType: text("summary_type").notNull(), // timeline, clinical, patient_friendly, handoff
  content: text("content").notNull(),
  keyEvents: jsonb("key_events").$type<{ date: string; event: string; significance: string }[]>(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  aiModel: text("ai_model"),
});

// Insert schemas for episodes of care
export const insertEpisodeOfCareSchema = createInsertSchema(episodesOfCare).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEpisodeEventSchema = createInsertSchema(episodeEvents).omit({
  id: true,
  createdAt: true,
});

export const insertEpisodeSummarySchema = createInsertSchema(episodeSummaries).omit({
  id: true,
  generatedAt: true,
});

// Types for episodes of care
export type EpisodeOfCare = typeof episodesOfCare.$inferSelect;
export type InsertEpisodeOfCare = z.infer<typeof insertEpisodeOfCareSchema>;
export type EpisodeEvent = typeof episodeEvents.$inferSelect;
export type InsertEpisodeEvent = z.infer<typeof insertEpisodeEventSchema>;
export type EpisodeSummary = typeof episodeSummaries.$inferSelect;
export type InsertEpisodeSummary = z.infer<typeof insertEpisodeSummarySchema>;

// Episode type constants
export const EPISODE_TYPES = [
  "surgery",
  "chronic_management", 
  "acute_illness",
  "preventive_care",
  "maternity",
  "mental_health",
  "rehabilitation",
  "emergency",
  "diagnostic_workup"
] as const;

export const EPISODE_STATUSES = ["active", "resolved", "ongoing", "paused"] as const;

export const EPISODE_EVENT_ROLES = [
  "trigger",
  "follow_up",
  "lab",
  "medication",
  "procedure",
  "imaging",
  "consultation",
  "outcome",
  "complication"
] as const;

// ==========================================
// PATIENT EDUCATION SYSTEM
// ==========================================

// Education Categories - organize articles by condition or specialty
export const educationCategories = pgTable("education_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  iconName: text("icon_name"), // Feather icon name
  colorHex: text("color_hex"), // Category color for UI
  parentId: varchar("parent_id").references((): any => educationCategories.id), // For subcategories
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Education Articles - health content articles
export const educationArticles = pgTable("education_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull().references(() => educationCategories.id),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  summary: text("summary"), // Brief description for cards
  content: text("content").notNull(), // Full article content (markdown)
  authorName: text("author_name"),
  authorCredentials: text("author_credentials"), // e.g., "MD, PhD"
  imageUrl: text("image_url"),
  readTimeMinutes: integer("read_time_minutes").default(5),
  difficultyLevel: text("difficulty_level").default("beginner"), // beginner, intermediate, advanced
  tags: jsonb("tags").$type<string[]>(),
  relatedConditions: jsonb("related_conditions").$type<string[]>(), // SNOMED codes or condition names
  relatedMedications: jsonb("related_medications").$type<string[]>(), // RxNorm codes or medication names
  sources: jsonb("sources").$type<{ title: string; url?: string; publishedDate?: string }[]>(),
  isAiGenerated: boolean("is_ai_generated").default(false),
  aiGeneratedFor: varchar("ai_generated_for").references(() => users.id), // User it was personalized for
  isFeatured: boolean("is_featured").default(false),
  isActive: boolean("is_active").default(true),
  viewCount: integer("view_count").default(0),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Saved Articles - user's bookmarked articles
export const savedArticles = pgTable("saved_articles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  articleId: varchar("article_id").notNull().references(() => educationArticles.id, { onDelete: "cascade" }),
  notes: text("notes"), // User's personal notes about the article
  savedAt: timestamp("saved_at").defaultNow().notNull(),
});

// Article Reading Progress - track user's reading history
export const articleReadingProgress = pgTable("article_reading_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  articleId: varchar("article_id").notNull().references(() => educationArticles.id, { onDelete: "cascade" }),
  progressPercent: integer("progress_percent").default(0),
  completedAt: timestamp("completed_at"),
  lastReadAt: timestamp("last_read_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Article Shares - track email shares for analytics
export const articleShares = pgTable("article_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  articleId: varchar("article_id").notNull().references(() => educationArticles.id, { onDelete: "cascade" }),
  recipientEmail: text("recipient_email").notNull(),
  personalMessage: text("personal_message"),
  sharedAt: timestamp("shared_at").defaultNow().notNull(),
});

// AI Personalized Content Queue - tracks AI-generated content requests
export const aiEducationContent = pgTable("ai_education_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  conditionContext: jsonb("condition_context").$type<{ conditions: string[]; medications: string[]; recentEvents: string[] }>(),
  promptUsed: text("prompt_used"),
  generatedContent: text("generated_content"),
  articleId: varchar("article_id").references(() => educationArticles.id), // If content was saved as article
  status: text("status").default("pending"), // pending, generating, completed, failed
  generatedAt: timestamp("generated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertEducationCategorySchema = createInsertSchema(educationCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEducationArticleSchema = createInsertSchema(educationArticles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSavedArticleSchema = createInsertSchema(savedArticles).omit({
  id: true,
  savedAt: true,
});

export const insertArticleReadingProgressSchema = createInsertSchema(articleReadingProgress).omit({
  id: true,
  createdAt: true,
});

export const insertArticleShareSchema = createInsertSchema(articleShares).omit({
  id: true,
  sharedAt: true,
});

export const insertAiEducationContentSchema = createInsertSchema(aiEducationContent).omit({
  id: true,
  createdAt: true,
});

// Types
export type EducationCategory = typeof educationCategories.$inferSelect;
export type InsertEducationCategory = z.infer<typeof insertEducationCategorySchema>;
export type EducationArticle = typeof educationArticles.$inferSelect;
export type InsertEducationArticle = z.infer<typeof insertEducationArticleSchema>;
export type SavedArticle = typeof savedArticles.$inferSelect;
export type InsertSavedArticle = z.infer<typeof insertSavedArticleSchema>;
export type ArticleReadingProgress = typeof articleReadingProgress.$inferSelect;
export type InsertArticleReadingProgress = z.infer<typeof insertArticleReadingProgressSchema>;
export type ArticleShare = typeof articleShares.$inferSelect;
export type InsertArticleShare = z.infer<typeof insertArticleShareSchema>;
export type AiEducationContent = typeof aiEducationContent.$inferSelect;
export type InsertAiEducationContent = z.infer<typeof insertAiEducationContentSchema>;

// Constants
export const EDUCATION_DIFFICULTY_LEVELS = ["beginner", "intermediate", "advanced"] as const;

export const DEFAULT_EDUCATION_CATEGORIES = [
  { name: "Heart Health", slug: "heart-health", iconName: "heart", colorHex: "#EF4444" },
  { name: "Diabetes", slug: "diabetes", iconName: "droplet", colorHex: "#3B82F6" },
  { name: "Mental Health", slug: "mental-health", iconName: "smile", colorHex: "#8B5CF6" },
  { name: "Nutrition", slug: "nutrition", iconName: "coffee", colorHex: "#F59E0B" },
  { name: "Medications", slug: "medications", iconName: "package", colorHex: "#10B981" },
  { name: "Preventive Care", slug: "preventive-care", iconName: "shield", colorHex: "#14B8A6" },
  { name: "Chronic Conditions", slug: "chronic-conditions", iconName: "activity", colorHex: "#EC4899" },
  { name: "Women's Health", slug: "womens-health", iconName: "user", colorHex: "#F472B6" },
  { name: "Men's Health", slug: "mens-health", iconName: "user", colorHex: "#6366F1" },
  { name: "Pediatrics", slug: "pediatrics", iconName: "users", colorHex: "#22D3EE" },
  { name: "Seniors", slug: "seniors", iconName: "sunset", colorHex: "#A78BFA" },
  { name: "Surgery & Recovery", slug: "surgery-recovery", iconName: "scissors", colorHex: "#FB923C" },
] as const;

// ============================================
// Provider Portal Tables
// ============================================

export const portalProviders = pgTable("portal_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("provider"),
  specialty: text("specialty"),
  npiNumber: text("npi_number"),
  organization: text("organization"),
  phone: text("phone"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const portalSessions = pgTable("portal_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => portalProviders.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const portalTasks = pgTable("portal_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerId: varchar("provider_id").notNull().references(() => portalProviders.id, { onDelete: "cascade" }),
  patientId: varchar("patient_id"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  taskType: varchar("task_type", { length: 50 }).notNull(),
  priority: varchar("priority", { length: 20 }).notNull().default("normal"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const portalPatientOrgs = pgTable("portal_patient_orgs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  organization: text("organization").notNull(),
  enrolledById: varchar("enrolled_by_id").notNull().references(() => portalProviders.id),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
}, (t) => ({
  uniquePatientOrg: unique().on(t.patientId, t.organization),
}));

// ============================================
// Medication Adherence
// ============================================
export const medicationSchedules = pgTable("medication_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  medicationName: varchar("medication_name", { length: 255 }).notNull(),
  dosage: varchar("dosage", { length: 100 }),
  frequency: varchar("frequency", { length: 50 }).notNull(),
  timesPerDay: integer("times_per_day").notNull().default(1),
  scheduledTimes: jsonb("scheduled_times").notNull().default(sql`'["08:00"]'::jsonb`),
  instructions: text("instructions"),
  prescribedBy: varchar("prescribed_by", { length: 255 }),
  rxNormCode: varchar("rxnorm_code", { length: 50 }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  remindersEnabled: boolean("reminders_enabled").notNull().default(true),
  reminderMinutesBefore: integer("reminder_minutes_before").notNull().default(15),
  refillDate: timestamp("refill_date"),
  refillReminder: boolean("refill_reminder").default(false),
  pillCount: integer("pill_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const adherenceLogs = pgTable("adherence_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scheduleId: varchar("schedule_id").notNull().references(() => medicationSchedules.id, { onDelete: "cascade" }),
  scheduledTime: timestamp("scheduled_time").notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  takenAt: timestamp("taken_at"),
  skippedReason: text("skipped_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// Health Journal
// ============================================
export const healthJournalEntries = pgTable("health_journal_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  entryType: varchar("entry_type", { length: 30 }).notNull(),
  title: varchar("title", { length: 255 }),
  content: text("content"),
  mood: integer("mood"),
  painLevel: integer("pain_level"),
  energyLevel: integer("energy_level"),
  symptoms: jsonb("symptoms"),
  tags: jsonb("tags"),
  entryDate: timestamp("entry_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// Gamification
// ============================================
export const patientBadges = pgTable("patient_badges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  badgeType: varchar("badge_type", { length: 50 }).notNull(),
  badgeName: varchar("badge_name", { length: 100 }).notNull(),
  description: text("description"),
  iconName: varchar("icon_name", { length: 50 }),
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
  metadata: jsonb("metadata"),
});

export const patientStreaks = pgTable("patient_streaks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  streakType: varchar("streak_type", { length: 50 }).notNull(),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastActivityDate: timestamp("last_activity_date"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// Telehealth Virtual Visits
// ============================================
export const telehealthVisits = pgTable("telehealth_visits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerId: varchar("provider_id").references(() => portalProviders.id),
  providerName: text("provider_name"),
  providerSpecialty: text("provider_specialty"),
  title: text("title").notNull(),
  reason: text("reason"),
  visitType: text("visit_type").notNull().default("follow_up"),
  status: text("status").notNull().default("scheduled"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: integer("duration").default(30),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  actualDuration: integer("actual_duration"),
  roomId: text("room_id"),
  roomUrl: text("room_url"),
  waitingRoomJoinedAt: timestamp("waiting_room_joined_at"),
  chiefComplaint: text("chief_complaint"),
  subjective: text("subjective"),
  objective: text("objective"),
  assessment: text("assessment"),
  plan: text("plan"),
  visitNotes: text("visit_notes"),
  aiVisitSummary: text("ai_visit_summary"),
  diagnoses: jsonb("diagnoses"),
  prescriptions: jsonb("prescriptions"),
  followUpInstructions: text("follow_up_instructions"),
  followUpDate: timestamp("follow_up_date"),
  attachments: jsonb("attachments"),
  vitalsSigned: jsonb("vitals_signed"),
  patientRating: integer("patient_rating"),
  patientFeedback: text("patient_feedback"),
  consentGiven: boolean("consent_given").default(false),
  consentTimestamp: timestamp("consent_timestamp"),
  transcription: text("transcription"),
  medicalTerms: jsonb("medical_terms"),
  aiGeneratedNotes: jsonb("ai_generated_notes"),
  transcriptionStatus: text("transcription_status").default("idle"),
  isRecorded: boolean("is_recorded").default(false),
  recordingConsentGiven: boolean("recording_consent_given").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const telehealthChatMessages = pgTable("telehealth_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitId: varchar("visit_id").notNull().references(() => telehealthVisits.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull(),
  senderRole: text("sender_role").notNull().default("patient"),
  message: text("message").notNull(),
  encryptedPayload: text("encrypted_payload"),
  encryptionIv: text("encryption_iv"),
  messageType: text("message_type").notNull().default("text"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const telehealthSharedDocuments = pgTable("telehealth_shared_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitId: varchar("visit_id").notNull().references(() => telehealthVisits.id, { onDelete: "cascade" }),
  sharedBy: varchar("shared_by").notNull(),
  sharedByRole: text("shared_by_role").notNull().default("provider"),
  documentType: text("document_type").notNull().default("image"),
  title: text("title").notNull(),
  description: text("description"),
  resourceUrl: text("resource_url"),
  thumbnailUrl: text("thumbnail_url"),
  recordId: varchar("record_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const telehealthRecordings = pgTable("telehealth_recordings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitId: varchar("visit_id").notNull().references(() => telehealthVisits.id, { onDelete: "cascade" }),
  patientConsentGiven: boolean("patient_consent_given").notNull().default(false),
  patientConsentTimestamp: timestamp("patient_consent_timestamp"),
  providerConsentGiven: boolean("provider_consent_given").notNull().default(false),
  status: text("status").notNull().default("pending"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  durationSeconds: integer("duration_seconds"),
  filePath: text("file_path"),
  fileSize: integer("file_size"),
  encryptionKey: text("encryption_key"),
  encryptionIv: text("encryption_iv"),
  integrityHash: text("integrity_hash"),
  retentionPolicy: text("retention_policy").default("90_days"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TelehealthChatMessage = typeof telehealthChatMessages.$inferSelect;
export type TelehealthSharedDocument = typeof telehealthSharedDocuments.$inferSelect;
export type TelehealthRecording = typeof telehealthRecordings.$inferSelect;

export const insertTelehealthVisitSchema = createInsertSchema(telehealthVisits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type TelehealthVisit = typeof telehealthVisits.$inferSelect;
export type InsertTelehealthVisit = z.infer<typeof insertTelehealthVisitSchema>;

// ============================================
// Types
// ============================================
export const insertPortalProviderSchema = createInsertSchema(portalProviders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
});

export type PortalProvider = typeof portalProviders.$inferSelect;
export type InsertPortalProvider = z.infer<typeof insertPortalProviderSchema>;
export type PortalSession = typeof portalSessions.$inferSelect;
export type PortalTask = typeof portalTasks.$inferSelect;
export type MedicationSchedule = typeof medicationSchedules.$inferSelect;
export type AdherenceLog = typeof adherenceLogs.$inferSelect;
export type HealthJournalEntry = typeof healthJournalEntries.$inferSelect;
export type PatientBadge = typeof patientBadges.$inferSelect;

// ============================================
// 2026 Compliance: Notice of Privacy Practices (NPP) & Data Access Requests
// ============================================
export const nppAcknowledgments = pgTable("npp_acknowledgments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  nppVersion: text("npp_version").notNull(),
  acknowledgedAt: timestamp("acknowledged_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
});

export const dataAccessRequests = pgTable("data_access_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  requestType: text("request_type").notNull(),
  status: text("status").notNull().default("pending"),
  description: text("description"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  acknowledgedAt: timestamp("acknowledged_at"),
  fulfilledAt: timestamp("fulfilled_at"),
  dueDate: timestamp("due_date").notNull(),
  responseNotes: text("response_notes"),
  dataCategories: jsonb("data_categories"),
  metadata: jsonb("metadata"),
});

export type NppAcknowledgment = typeof nppAcknowledgments.$inferSelect;
export type DataAccessRequest = typeof dataAccessRequests.$inferSelect;
export type PatientStreak = typeof patientStreaks.$inferSelect;

// ============================================
// Provider Lab Ordering System
// ============================================
export const labOrders = pgTable("lab_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").notNull(),
  providerId: varchar("provider_id").notNull(),
  labProvider: text("lab_provider").notNull(),
  status: text("status").notNull().default("draft"),
  priority: text("priority").notNull().default("routine"),
  orderNumber: text("order_number"),
  accessionNumber: text("accession_number"),
  tests: jsonb("tests").notNull(),
  diagnoses: jsonb("diagnoses"),
  specialInstructions: text("special_instructions"),
  collectionSite: text("collection_site"),
  fastingRequired: boolean("fasting_required").default(false),
  scheduledDate: timestamp("scheduled_date"),
  submittedAt: timestamp("submitted_at"),
  collectedAt: timestamp("collected_at"),
  resultedAt: timestamp("resulted_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  results: jsonb("results"),
  cdsAlerts: jsonb("cds_alerts"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLabOrderSchema = createInsertSchema(labOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LabOrderRecord = typeof labOrders.$inferSelect;
export type InsertLabOrder = z.infer<typeof insertLabOrderSchema>;

export const comprehensiveIntakes = pgTable("comprehensive_intakes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("in_progress"),

  demographics: jsonb("demographics"),
  medicalHistory: jsonb("medical_history"),
  allergies: jsonb("allergies"),
  currentMedications: jsonb("current_medications"),
  socialHistory: jsonb("social_history"),
  insuranceInfo: jsonb("insurance_info"),

  completedSteps: jsonb("completed_steps"),
  currentStep: integer("current_step").default(0),
  cdsTriggered: boolean("cds_triggered").default(false),
  cdsResults: jsonb("cds_results"),

  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertComprehensiveIntakeSchema = createInsertSchema(comprehensiveIntakes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ComprehensiveIntake = typeof comprehensiveIntakes.$inferSelect;
export type InsertComprehensiveIntake = z.infer<typeof insertComprehensiveIntakeSchema>;

// Appointment Reminder Preferences - Stores per-user reminder preferences for telehealth appointments
export const appointmentReminderPreferences = pgTable("appointment_reminder_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").notNull().default(true),
  reminderTimes: jsonb("reminder_times").notNull().default(sql`'[1440, 60]'::jsonb`), // minutes before: [1440=24h, 60=1h]
  channels: jsonb("channels").notNull().default(sql`'["in_app"]'::jsonb`), // ["in_app", "sms", "email"]
  quietHoursStart: text("quiet_hours_start"), // HH:MM format, e.g. "22:00"
  quietHoursEnd: text("quiet_hours_end"), // HH:MM format, e.g. "07:00"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Appointment Reminders - Tracks individual reminders that have been scheduled/sent for specific visits
export const appointmentReminders = pgTable("appointment_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  visitId: varchar("visit_id").notNull().references(() => telehealthVisits.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reminderType: text("reminder_type").notNull(), // "24h", "1h", "15min", "custom"
  minutesBefore: integer("minutes_before").notNull(),
  channel: text("channel").notNull().default("in_app"), // "in_app", "sms", "email"
  status: text("status").notNull().default("scheduled"), // "scheduled", "sent", "failed", "cancelled"
  scheduledFor: timestamp("scheduled_for").notNull(),
  sentAt: timestamp("sent_at"),
  failureReason: text("failure_reason"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas for appointment reminder preferences and reminders
export const insertAppointmentReminderPreferenceSchema = createInsertSchema(appointmentReminderPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAppointmentReminderSchema = createInsertSchema(appointmentReminders).omit({
  id: true,
  createdAt: true,
});

// Types for appointment reminders
export type AppointmentReminderPreference = typeof appointmentReminderPreferences.$inferSelect;
export type InsertAppointmentReminderPreference = z.infer<typeof insertAppointmentReminderPreferenceSchema>;
export type AppointmentReminder = typeof appointmentReminders.$inferSelect;
export type InsertAppointmentReminder = z.infer<typeof insertAppointmentReminderSchema>;

// ==================== WEBHOOK EVENTS ====================
export const webhookEvents = pgTable("webhook_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: text("source").notNull(),
  eventType: text("event_type").notNull(),
  aggregatorEventId: text("aggregator_event_id").notNull().unique(),
  patientId: text("patient_id"),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull().default("received"),
  signatureVerified: boolean("signature_verified").default(false),
  processingNotes: text("processing_notes"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const insertWebhookEventSchema = createInsertSchema(webhookEvents).omit({
  id: true,
  receivedAt: true,
  processedAt: true,
});

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;

export const phiAuditLogs = pgTable("phi_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  actorId: varchar("actor_id").references(() => users.id),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: varchar("resource_id"),
  patientId: varchar("patient_id"),
  phiFieldsAccessed: jsonb("phi_fields_accessed"),
  previousValues: jsonb("previous_values"),
  newValues: jsonb("new_values"),
  accessReason: text("access_reason"),
  breakGlass: boolean("break_glass").default(false),
  breakGlassReason: text("break_glass_reason"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  deviceId: text("device_id"),
  geoLocation: jsonb("geo_location"),
  riskScore: real("risk_score"),
  complianceFlags: jsonb("compliance_flags"),
  outcome: text("outcome").default("success"),
  errorDetails: text("error_details"),
  responseTimeMs: integer("response_time_ms"),
  dataClassification: text("data_classification").default("PHI"),
  legalBasis: text("legal_basis"),
  consentReference: varchar("consent_reference"),
  retentionExpiresAt: timestamp("retention_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPhiAuditLogSchema = createInsertSchema(phiAuditLogs).omit({
  id: true,
  createdAt: true,
});

export type PhiAuditLog = typeof phiAuditLogs.$inferSelect;
export type InsertPhiAuditLog = z.infer<typeof insertPhiAuditLogSchema>;

export const mfaCredentials = pgTable("mfa_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  method: text("method").notNull(),
  isEnabled: boolean("is_enabled").default(false),
  isPrimary: boolean("is_primary").default(false),
  secretHash: text("secret_hash"),
  backupCodesHash: text("backup_codes_hash"),
  phoneNumber: text("phone_number"),
  email: text("email"),
  deviceToken: text("device_token"),
  lastUsedAt: timestamp("last_used_at"),
  failedAttempts: integer("failed_attempts").default(0),
  lockedUntil: timestamp("locked_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMfaCredentialSchema = createInsertSchema(mfaCredentials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MfaCredential = typeof mfaCredentials.$inferSelect;
export type InsertMfaCredential = z.infer<typeof insertMfaCredentialSchema>;

export const sessionManagement = pgTable("session_management", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sessionToken: text("session_token").notNull().unique(),
  deviceId: text("device_id"),
  deviceType: text("device_type"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  mfaVerified: boolean("mfa_verified").default(false),
  mfaVerifiedAt: timestamp("mfa_verified_at"),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  timeoutMinutes: integer("timeout_minutes").default(15),
  isActive: boolean("is_active").default(true),
  terminationReason: text("termination_reason"),
  terminatedAt: timestamp("terminated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertSessionManagementSchema = createInsertSchema(sessionManagement).omit({
  id: true,
  createdAt: true,
});

export type SessionManagement = typeof sessionManagement.$inferSelect;
export type InsertSessionManagement = z.infer<typeof insertSessionManagementSchema>;

export const dataRetentionPolicies = pgTable("data_retention_policies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  policyName: text("policy_name").notNull().unique(),
  resourceType: text("resource_type").notNull(),
  retentionDays: integer("retention_days").notNull(),
  archiveBeforeDelete: boolean("archive_before_delete").default(true),
  legalHold: boolean("legal_hold").default(false),
  legalHoldReason: text("legal_hold_reason"),
  complianceFramework: text("compliance_framework"),
  isActive: boolean("is_active").default(true),
  lastExecutedAt: timestamp("last_executed_at"),
  nextScheduledAt: timestamp("next_scheduled_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDataRetentionPolicySchema = createInsertSchema(dataRetentionPolicies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type DataRetentionPolicy = typeof dataRetentionPolicies.$inferSelect;
export type InsertDataRetentionPolicy = z.infer<typeof insertDataRetentionPolicySchema>;

export const dataRetentionExecutions = pgTable("data_retention_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  policyId: varchar("policy_id").notNull().references(() => dataRetentionPolicies.id),
  status: text("status").notNull().default("pending"),
  recordsScanned: integer("records_scanned").default(0),
  recordsArchived: integer("records_archived").default(0),
  recordsDeleted: integer("records_deleted").default(0),
  recordsRetained: integer("records_retained").default(0),
  errors: jsonb("errors"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  executedBy: varchar("executed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDataRetentionExecutionSchema = createInsertSchema(dataRetentionExecutions).omit({
  id: true,
  createdAt: true,
});

export type DataRetentionExecution = typeof dataRetentionExecutions.$inferSelect;
export type InsertDataRetentionExecution = z.infer<typeof insertDataRetentionExecutionSchema>;

export const ambientEncounters = pgTable("ambient_encounters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  visitDate: timestamp("visit_date").notNull(),
  provider: text("provider"),
  facility: text("facility"),
  duration: integer("duration"),
  transcript: text("transcript"),
  summary: jsonb("summary"),
  summaryText: text("summary_text"),
  language: text("language").default("en"),
  status: text("status").notNull().default("recording"),
  confidence: real("confidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAmbientEncounterSchema = createInsertSchema(ambientEncounters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AmbientEncounter = typeof ambientEncounters.$inferSelect;
export type InsertAmbientEncounter = z.infer<typeof insertAmbientEncounterSchema>;

export const encounterActionItems = pgTable("encounter_action_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  encounterId: varchar("encounter_id").notNull().references(() => ambientEncounters.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("follow_up"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("pending"),
  dueDate: timestamp("due_date"),
  reminderDate: timestamp("reminder_date"),
  reminderSent: boolean("reminder_sent").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEncounterActionItemSchema = createInsertSchema(encounterActionItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type EncounterActionItem = typeof encounterActionItems.$inferSelect;
export type InsertEncounterActionItem = z.infer<typeof insertEncounterActionItemSchema>;

export const petProfiles = pgTable("pet_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  species: text("species").notNull(),
  breed: text("breed"),
  dateOfBirth: timestamp("date_of_birth"),
  weight: real("weight"),
  weightUnit: text("weight_unit").default("lbs"),
  gender: text("gender"),
  color: text("color"),
  microchipId: text("microchip_id"),
  licenseNumber: text("license_number"),
  licenseState: text("license_state"),
  veterinarian: text("veterinarian"),
  vetClinic: text("vet_clinic"),
  vetPhone: text("vet_phone"),
  photoUri: text("photo_uri"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPetProfileSchema = createInsertSchema(petProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PetProfile = typeof petProfiles.$inferSelect;
export type InsertPetProfile = z.infer<typeof insertPetProfileSchema>;

export const petHealthRecords = pgTable("pet_health_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  petId: varchar("pet_id").notNull().references(() => petProfiles.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  date: timestamp("date").notNull(),
  provider: text("provider"),
  facility: text("facility"),
  details: jsonb("details"),
  reminderDate: timestamp("reminder_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPetHealthRecordSchema = createInsertSchema(petHealthRecords).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PetHealthRecord = typeof petHealthRecords.$inferSelect;
export type InsertPetHealthRecord = z.infer<typeof insertPetHealthRecordSchema>;

export const petStateRegistrations = pgTable("pet_state_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  petId: varchar("pet_id").notNull().references(() => petProfiles.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  state: text("state").notNull(),
  registrationType: text("registration_type").notNull(),
  registrationNumber: text("registration_number"),
  issuedDate: timestamp("issued_date"),
  expirationDate: timestamp("expiration_date"),
  status: text("status").notNull().default("active"),
  registryUrl: text("registry_url"),
  lastChecked: timestamp("last_checked"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPetStateRegistrationSchema = createInsertSchema(petStateRegistrations).omit({
  id: true,
  createdAt: true,
});

export type PetStateRegistration = typeof petStateRegistrations.$inferSelect;
export type InsertPetStateRegistration = z.infer<typeof insertPetStateRegistrationSchema>;

export const clinicalAiAudit = pgTable("clinical_ai_audit", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow(),
  patientId: text("patient_id"),
  requestPayload: jsonb("request_payload"),
  aiSummary: text("ai_summary"),
  modelVersion: text("model_version").default("med-gemini-1.5-pro"),
  status: text("status"),
  confidenceScore: real("confidence_score"),
  sourceReferences: jsonb("source_references").$type<{ sourceSystem: string; documentId: string; excerpt: string; highlightRange: { start: number; end: number } }[]>(),
  explainabilityFactors: jsonb("explainability_factors").$type<{ factor: string; weight: number; direction: string }[]>(),
  verificationStatus: text("verification_status").default("pending"),
  verifiedBy: text("verified_by"),
  verifiedAt: timestamp("verified_at"),
  flagReason: text("flag_reason"),
  feedbackNotes: text("feedback_notes"),
  category: text("category").default("summary"),
});

export const insertClinicalAiAuditSchema = createInsertSchema(clinicalAiAudit).omit({
  id: true,
  timestamp: true,
});

export type ClinicalAiAudit = typeof clinicalAiAudit.$inferSelect;
export type InsertClinicalAiAudit = z.infer<typeof insertClinicalAiAuditSchema>;

export const baaAgreements = pgTable("baa_agreements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  partnerName: text("partner_name").notNull(),
  partnerEmail: text("partner_email").notNull(),
  partnerOrganization: text("partner_organization"),
  status: text("status").notNull().default("draft"),
  signedDate: timestamp("signed_date"),
  expirationDate: timestamp("expiration_date").notNull(),
  documentPath: text("document_path"),
  documentName: text("document_name"),
  documentMimeType: text("document_mime_type"),
  documentSizeBytes: integer("document_size_bytes"),
  notes: text("notes"),
  reminderSent30Days: boolean("reminder_sent_30_days").default(false),
  reminderSent14Days: boolean("reminder_sent_14_days").default(false),
  reminderSent7Days: boolean("reminder_sent_7_days").default(false),
  lastReminderSentAt: timestamp("last_reminder_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBaaAgreementSchema = createInsertSchema(baaAgreements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  reminderSent30Days: true,
  reminderSent14Days: true,
  reminderSent7Days: true,
  lastReminderSentAt: true,
});

export type BaaAgreement = typeof baaAgreements.$inferSelect;
export type InsertBaaAgreement = z.infer<typeof insertBaaAgreementSchema>;

export const networkHealthChecks = pgTable("network_health_checks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  endpointId: varchar("endpoint_id").notNull(),
  endpointName: text("endpoint_name").notNull(),
  networkId: varchar("network_id").notNull(),
  networkName: text("network_name").notNull(),
  networkType: text("network_type").notNull().default("qhin"),
  baseUrl: text("base_url").notNull(),
  connectionStatus: text("connection_status").notNull().default("unknown"),
  latencyMs: integer("latency_ms"),
  statusCode: integer("status_code"),
  errorMessage: text("error_message"),
  lastCheckedAt: timestamp("last_checked_at").defaultNow().notNull(),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  alertSentAt: timestamp("alert_sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type NetworkHealthCheck = typeof networkHealthChecks.$inferSelect;

export const soc2Evidence = pgTable("soc2_evidence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("audit_log"),
  tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`),
  controlId: text("control_id"),
  framework: text("framework").notNull().default("SOC2"),
  evidenceType: text("evidence_type").notNull().default("automatic"),
  status: text("status").notNull().default("collected"),
  severity: text("severity").default("info"),
  sourceService: text("source_service"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  attachmentPath: text("attachment_path"),
  attachmentName: text("attachment_name"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  expiresAt: timestamp("expires_at"),
  collectedAt: timestamp("collected_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSoc2EvidenceSchema = createInsertSchema(soc2Evidence).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Soc2Evidence = typeof soc2Evidence.$inferSelect;
export type InsertSoc2Evidence = z.infer<typeof insertSoc2EvidenceSchema>;

export const soc2ComplianceReports = pgTable("soc2_compliance_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportType: text("report_type").notNull().default("weekly"),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  summary: jsonb("summary").$type<Record<string, unknown>>().notNull(),
  controlScores: jsonb("control_scores").$type<Record<string, unknown>>(),
  evidenceCount: integer("evidence_count").notNull().default(0),
  openFindings: integer("open_findings").notNull().default(0),
  criticalFindings: integer("critical_findings").notNull().default(0),
  overallScore: integer("overall_score").notNull().default(100),
  status: text("status").notNull().default("draft"),
  generatedBy: text("generated_by").default("system"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSoc2ComplianceReportSchema = createInsertSchema(soc2ComplianceReports).omit({
  id: true,
  createdAt: true,
});

export type Soc2ComplianceReport = typeof soc2ComplianceReports.$inferSelect;
export type InsertSoc2ComplianceReport = z.infer<typeof insertSoc2ComplianceReportSchema>;

export const soc2RemediationTickets = pgTable("soc2_remediation_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  controlId: text("control_id").notNull(),
  controlName: text("control_name").notNull(),
  category: text("category").notNull(),
  severity: text("severity").notNull().default("high"),
  status: text("status").notNull().default("open"),
  title: text("title").notNull(),
  description: text("description"),
  incidentDetails: jsonb("incident_details").$type<Record<string, unknown>>(),
  affectedUserIds: jsonb("affected_user_ids").$type<string[]>().default(sql`'[]'::jsonb`),
  remediationSteps: jsonb("remediation_steps").$type<string[]>().default(sql`'[]'::jsonb`),
  ticketRef: text("ticket_ref"),
  assignedTo: text("assigned_to"),
  notificationsSent: jsonb("notifications_sent").$type<Record<string, unknown>[]>().default(sql`'[]'::jsonb`),
  flaggedAccounts: jsonb("flagged_accounts").$type<string[]>().default(sql`'[]'::jsonb`),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  resolvedNotes: text("resolved_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSoc2RemediationTicketSchema = createInsertSchema(soc2RemediationTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Soc2RemediationTicket = typeof soc2RemediationTickets.$inferSelect;
export type InsertSoc2RemediationTicket = z.infer<typeof insertSoc2RemediationTicketSchema>;

// ─── WebAuthn / Passkey credentials (Roadmap 1.1) ────────────────────────────

export const webauthnCredentials = pgTable("webauthn_credentials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  publicKeyJwk: text("public_key_jwk").notNull(),
  counter: integer("counter").notNull().default(0),
  aaguid: text("aaguid").notNull().default("00000000-0000-0000-0000-000000000000"),
  transports: jsonb("transports").$type<string[]>().default(sql`'[]'::jsonb`),
  deviceName: text("device_name"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWebauthnCredentialSchema = createInsertSchema(webauthnCredentials).omit({
  id: true,
  createdAt: true,
});

export type WebauthnCredential = typeof webauthnCredentials.$inferSelect;
export type InsertWebauthnCredential = z.infer<typeof insertWebauthnCredentialSchema>;

// ─── Practice AI Config (Roadmap 1.5 — jurisdiction-aware disclosure) ────────

export const aiReviewQueue = pgTable("ai_review_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  route: text("route").notNull(),
  aiOutput: text("ai_output").notNull(),
  requestContext: jsonb("request_context"),
  guardrailFlags: jsonb("guardrail_flags"),
  blockedPhrases: jsonb("blocked_phrases").$type<string[]>(),
  status: text("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  reviewerNotes: text("reviewer_notes"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAiReviewQueueSchema = createInsertSchema(aiReviewQueue).omit({
  id: true,
  createdAt: true,
});
export type AiReviewQueueItem = typeof aiReviewQueue.$inferSelect;
export type InsertAiReviewQueueItem = z.infer<typeof insertAiReviewQueueSchema>;

export const practiceAiConfig = pgTable("practice_ai_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  practiceId: varchar("practice_id").notNull().unique(),
  state: text("state").notNull().default(""),
  aiDisclosureRequired: boolean("ai_disclosure_required").notNull().default(false),
  clinicianReviewSuppressesDisclaimer: boolean("clinician_review_suppresses_disclaimer").notNull().default(true),
  enabledFeatures: jsonb("enabled_features").$type<string[]>().default(sql`'[]'::jsonb`),
  customDisclaimerOverride: text("custom_disclaimer_override"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPracticeAiConfigSchema = createInsertSchema(practiceAiConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PracticeAiConfig = typeof practiceAiConfig.$inferSelect;
export type InsertPracticeAiConfig = z.infer<typeof insertPracticeAiConfigSchema>;
