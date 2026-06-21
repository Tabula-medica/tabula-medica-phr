import { pgTable, index, varchar, jsonb, timestamp, foreignKey, uuid, text, date, inet, boolean, unique, integer, uniqueIndex, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const sessions = pgTable("sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: jsonb().notNull(),
	expire: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const medicationsNew = pgTable("medications_new", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	name: text().notNull(),
	dose: text(),
	frequency: text(),
	status: text().notNull(),
	startDate: date("start_date"),
	endDate: date("end_date"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "medications_new_profile_id_profiles_id_fk"
		}).onDelete("cascade"),
]);

export const timelineEvents = pgTable("timeline_events", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	eventType: text("event_type").notNull(),
	title: text().notNull(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date"),
	providerName: text("provider_name"),
	facilityName: text("facility_name"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "timeline_events_profile_id_profiles_id_fk"
		}).onDelete("cascade"),
]);

export const authAnalyticsEvents = pgTable("auth_analytics_events", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id"),
	eventType: varchar("event_type").notNull(),
	metadata: jsonb(),
	ipAddress: varchar("ip_address"),
	userAgent: varchar("user_agent"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "auth_analytics_events_user_id_users_id_fk"
		}),
]);

export const auditLogNew = pgTable("audit_log_new", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	accountId: uuid("account_id"),
	profileId: uuid("profile_id"),
	action: text().notNull(),
	targetType: text("target_type"),
	targetId: uuid("target_id"),
	ipAddress: inet("ip_address"),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "audit_log_new_account_id_accounts_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "audit_log_new_profile_id_profiles_id_fk"
		}).onDelete("set null"),
]);

export const profiles = pgTable("profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	accountId: uuid("account_id").notNull(),
	profileType: text("profile_type").notNull(),
	fullName: text("full_name").notNull(),
	dob: date().notNull(),
	preferredLanguage: text("preferred_language").default('en').notNull(),
	simplifiedMode: boolean("simplified_mode").default(false).notNull(),
	photoObjectKey: text("photo_object_key"),
	metadata: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "profiles_account_id_accounts_id_fk"
		}).onDelete("cascade"),
]);

export const tags = pgTable("tags", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	key: text().notNull(),
	label: text().notNull(),
	category: text().notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	isSystem: boolean("is_system").default(false).notNull(),
}, (table) => [
	unique("tags_key_unique").on(table.key),
]);

export const users = pgTable("users", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	email: varchar(),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	profileImageUrl: varchar("profile_image_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	passwordHash: varchar("password_hash"),
	authProvider: varchar("auth_provider").default('oidc'),
	mfaRequired: varchar("mfa_required").default('true'),
	passwordUpdatedAt: timestamp("password_updated_at", { mode: 'string' }),
	isVerified: boolean("is_verified").default(false),
	verificationProvider: varchar("verification_provider"),
	verifiedAt: timestamp("verified_at", { mode: 'string' }),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const healthGoals = pgTable("health_goals", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	goalType: text("goal_type").notNull(),
	title: text().notNull(),
	description: text(),
	targetValue: text("target_value").notNull(),
	targetUnit: text("target_unit").notNull(),
	baselineValue: text("baseline_value"),
	currentValue: text("current_value"),
	startDate: date("start_date").notNull(),
	targetDate: date("target_date"),
	status: text().default('active').notNull(),
	priority: integer().default(1).notNull(),
	reminderFrequency: text("reminder_frequency"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "health_goals_profile_id_profiles_id_fk"
		}).onDelete("cascade"),
]);

export const monitoringAlerts = pgTable("monitoring_alerts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	vitalSignId: uuid("vital_sign_id"),
	alertType: text("alert_type").notNull(),
	severity: text().notNull(),
	title: text().notNull(),
	message: text().notNull(),
	threshold: text(),
	actualValue: text("actual_value"),
	status: text().default('pending').notNull(),
	acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true, mode: 'string' }),
	acknowledgedBy: uuid("acknowledged_by"),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "monitoring_alerts_profile_id_profiles_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.vitalSignId],
			foreignColumns: [vitalSigns.id],
			name: "monitoring_alerts_vital_sign_id_vital_signs_id_fk"
		}).onDelete("set null"),
]);

export const caregivers = pgTable("caregivers", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	patientUserId: varchar("patient_user_id").notNull(),
	caregiverUserId: varchar("caregiver_user_id"),
	caregiverEmail: varchar("caregiver_email").notNull(),
	caregiverName: varchar("caregiver_name"),
	relationship: varchar().notNull(),
	status: varchar().default('pending').notNull(),
	permissions: text().array().default(["RAY['view'::tex"]).notNull(),
	inviteToken: varchar("invite_token"),
	invitedAt: timestamp("invited_at", { mode: 'string' }).defaultNow(),
	acceptedAt: timestamp("accepted_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.caregiverUserId],
			foreignColumns: [users.id],
			name: "caregivers_caregiver_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.patientUserId],
			foreignColumns: [users.id],
			name: "caregivers_patient_user_id_users_id_fk"
		}),
]);

export const facilities = pgTable("facilities", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	aliases: text().array().default(["RAY"]),
	facilityType: varchar("facility_type", { length: 50 }).notNull(),
	addressLine1: varchar("address_line_1", { length: 255 }),
	addressLine2: varchar("address_line_2", { length: 255 }),
	city: varchar({ length: 100 }),
	state: varchar({ length: 100 }),
	postalCode: varchar("postal_code", { length: 20 }),
	country: varchar({ length: 100 }).default('USA'),
	phone: varchar({ length: 50 }),
	website: varchar({ length: 500 }),
	npi: varchar({ length: 20 }),
	orgId: varchar("org_id", { length: 100 }),
	healthSystem: varchar("health_system", { length: 255 }),
	ehrVendor: varchar("ehr_vendor", { length: 100 }),
	supportsFhir: boolean("supports_fhir"),
	fhirBaseUrl: varchar("fhir_base_url", { length: 500 }),
	patientPortalUrl: varchar("patient_portal_url", { length: 500 }),
	notes: text(),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	index("IDX_facility_city").using("btree", table.city.asc().nullsLast().op("text_ops")),
	index("IDX_facility_health_system").using("btree", table.healthSystem.asc().nullsLast().op("text_ops")),
	index("IDX_facility_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("IDX_facility_npi").using("btree", table.npi.asc().nullsLast().op("text_ops")),
	index("IDX_facility_state").using("btree", table.state.asc().nullsLast().op("text_ops")),
	index("IDX_facility_type").using("btree", table.facilityType.asc().nullsLast().op("text_ops")),
]);

export const folders = pgTable("folders", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id"),
	parentId: uuid("parent_id"),
	name: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	key: text().notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	isSystem: boolean("is_system").default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "folders_parent_id_folders_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "folders_profile_id_profiles_id_fk"
		}).onDelete("cascade"),
	unique("folders_key_unique").on(table.key),
]);

export const patientAppointments = pgTable("patient_appointments", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	patientId: varchar("patient_id").notNull(),
	clinicianId: varchar("clinician_id").notNull(),
	clinicianName: varchar("clinician_name", { length: 255 }).notNull(),
	facilityId: varchar("facility_id"),
	facilityName: varchar("facility_name", { length: 255 }),
	appointmentType: varchar("appointment_type", { length: 100 }).notNull(),
	status: varchar({ length: 50 }).default('scheduled'),
	scheduledAt: timestamp("scheduled_at", { mode: 'string' }).notNull(),
	duration: integer().default(30),
	reason: text(),
	notes: text(),
	isTelehealth: boolean("is_telehealth").default(false),
	meetingUrl: varchar("meeting_url", { length: 500 }),
	reminderSent: boolean("reminder_sent").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("IDX_appointment_clinician").using("btree", table.clinicianId.asc().nullsLast().op("text_ops")),
	index("IDX_appointment_patient").using("btree", table.patientId.asc().nullsLast().op("text_ops")),
	index("IDX_appointment_scheduled").using("btree", table.scheduledAt.asc().nullsLast().op("timestamp_ops")),
	index("IDX_appointment_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
]);

export const healthRecommendations = pgTable("health_recommendations", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	patientId: varchar("patient_id").notNull(),
	clinicianId: varchar("clinician_id").notNull(),
	clinicianName: varchar("clinician_name", { length: 255 }).notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
	category: varchar({ length: 50 }).notNull(),
	priority: varchar({ length: 20 }).default('medium'),
	actionItems: text("action_items").array(),
	relatedConditions: text("related_conditions").array(),
	dueDate: timestamp("due_date", { mode: 'string' }),
	isCompleted: boolean("is_completed").default(false),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	patientNotes: text("patient_notes"),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("IDX_recommendation_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("IDX_recommendation_clinician").using("btree", table.clinicianId.asc().nullsLast().op("text_ops")),
	index("IDX_recommendation_patient").using("btree", table.patientId.asc().nullsLast().op("text_ops")),
	index("IDX_recommendation_priority").using("btree", table.priority.asc().nullsLast().op("text_ops")),
]);

export const patientMessages = pgTable("patient_messages", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	patientId: varchar("patient_id").notNull(),
	senderId: varchar("sender_id").notNull(),
	senderType: varchar("sender_type", { length: 20 }).notNull(),
	senderName: varchar("sender_name", { length: 255 }).notNull(),
	recipientId: varchar("recipient_id").notNull(),
	recipientType: varchar("recipient_type", { length: 20 }).notNull(),
	recipientName: varchar("recipient_name", { length: 255 }).notNull(),
	subject: varchar({ length: 500 }),
	content: text().notNull(),
	messageType: varchar("message_type", { length: 50 }).default('general'),
	threadId: varchar("thread_id"),
	parentMessageId: varchar("parent_message_id"),
	isRead: boolean("is_read").default(false),
	isArchived: boolean("is_archived").default(false),
	isUrgent: boolean("is_urgent").default(false),
	attachments: text().array(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	readAt: timestamp("read_at", { mode: 'string' }),
}, (table) => [
	index("IDX_message_created").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("IDX_message_patient").using("btree", table.patientId.asc().nullsLast().op("text_ops")),
	index("IDX_message_recipient").using("btree", table.recipientId.asc().nullsLast().op("text_ops")),
	index("IDX_message_sender").using("btree", table.senderId.asc().nullsLast().op("text_ops")),
	index("IDX_message_thread").using("btree", table.threadId.asc().nullsLast().op("text_ops")),
]);

export const patientAlerts = pgTable("patient_alerts", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	patientId: varchar("patient_id").notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	category: varchar({ length: 50 }).notNull(),
	severity: varchar({ length: 20 }).default('info'),
	actionUrl: varchar("action_url", { length: 500 }),
	actionLabel: varchar("action_label", { length: 100 }),
	relatedResourceType: varchar("related_resource_type", { length: 50 }),
	relatedResourceId: varchar("related_resource_id"),
	isRead: boolean("is_read").default(false),
	isDismissed: boolean("is_dismissed").default(false),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	readAt: timestamp("read_at", { mode: 'string' }),
}, (table) => [
	index("IDX_alert_category").using("btree", table.category.asc().nullsLast().op("text_ops")),
	index("IDX_alert_created").using("btree", table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("IDX_alert_patient").using("btree", table.patientId.asc().nullsLast().op("text_ops")),
	index("IDX_alert_severity").using("btree", table.severity.asc().nullsLast().op("text_ops")),
]);

export const goalProgress = pgTable("goal_progress", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	goalId: uuid("goal_id").notNull(),
	recordedOn: date("recorded_on").notNull(),
	value: text().notNull(),
	notes: text(),
	source: text().default('manual'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.goalId],
			foreignColumns: [healthGoals.id],
			name: "goal_progress_goal_id_health_goals_id_fk"
		}).onDelete("cascade"),
]);

export const caregiverAccess = pgTable("caregiver_access", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	caregiverAccountId: uuid("caregiver_account_id").notNull(),
	role: text().notNull(),
	canExport: boolean("can_export").default(true).notNull(),
	canUpload: boolean("can_upload").default(true).notNull(),
	canViewSensitive: boolean("can_view_sensitive").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("caregiver_access_profile_caregiver_ux").using("btree", table.profileId.asc().nullsLast().op("uuid_ops"), table.caregiverAccountId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.caregiverAccountId],
			foreignColumns: [accounts.id],
			name: "caregiver_access_caregiver_account_id_accounts_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "caregiver_access_profile_id_profiles_id_fk"
		}).onDelete("cascade"),
]);

export const documents = pgTable("documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	folderId: uuid("folder_id"),
	title: text().notNull(),
	source: text(),
	dateOfService: date("date_of_service"),
	mimeType: text("mime_type").notNull(),
	objectKey: text("object_key").notNull(),
	isSensitive: boolean("is_sensitive").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.folderId],
			foreignColumns: [folders.id],
			name: "documents_folder_id_folders_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "documents_profile_id_profiles_id_fk"
		}).onDelete("cascade"),
]);

export const followups = pgTable("followups", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	name: text().notNull(),
	cadence: text().notNull(),
	nextDueDate: date("next_due_date").notNull(),
	lastCompletedOn: date("last_completed_on"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "followups_profile_id_profiles_id_fk"
		}).onDelete("cascade"),
]);

export const accounts = pgTable("accounts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	mfaEnabled: boolean("mfa_enabled").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("accounts_email_ux").using("btree", table.email.asc().nullsLast().op("text_ops")),
]);

export const shareLinks = pgTable("share_links", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	packetExportId: uuid("packet_export_id").notNull(),
	tokenHash: text("token_hash").notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	pinHash: text("pin_hash"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("share_links_token_hash_ux").using("btree", table.tokenHash.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.packetExportId],
			foreignColumns: [packetExports.id],
			name: "share_links_packet_export_id_packet_exports_id_fk"
		}).onDelete("cascade"),
]);

export const packetExports = pgTable("packet_exports", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	createdByAccountId: uuid("created_by_account_id").notNull(),
	packetType: text("packet_type").notNull(),
	optionsJson: jsonb("options_json").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdByAccountId],
			foreignColumns: [accounts.id],
			name: "packet_exports_created_by_account_id_accounts_id_fk"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "packet_exports_profile_id_profiles_id_fk"
		}).onDelete("cascade"),
]);

export const symptomEntries = pgTable("symptom_entries", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	medicationId: uuid("medication_id"),
	occurredOn: date("occurred_on").notNull(),
	severity: integer(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.medicationId],
			foreignColumns: [medicationsNew.id],
			name: "symptom_entries_medication_id_medications_new_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "symptom_entries_profile_id_profiles_id_fk"
		}).onDelete("cascade"),
]);

export const vitalSigns = pgTable("vital_signs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	vitalType: text("vital_type").notNull(),
	value: text().notNull(),
	unit: text().notNull(),
	recordedAt: timestamp("recorded_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	source: text().default('manual'),
	deviceId: text("device_id"),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "vital_signs_profile_id_profiles_id_fk"
		}).onDelete("cascade"),
]);

export const carePlanMonitoringParams = pgTable("care_plan_monitoring_params", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	carePlanId: uuid("care_plan_id").notNull(),
	vitalType: text("vital_type").notNull(),
	frequency: text().default('daily').notNull(),
	minThreshold: text("min_threshold"),
	maxThreshold: text("max_threshold"),
	unit: text().notNull(),
	alertOnBreach: boolean("alert_on_breach").default(true).notNull(),
	providerNotes: text("provider_notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.carePlanId],
			foreignColumns: [comprehensiveCarePlans.id],
			name: "care_plan_monitoring_params_care_plan_id_comprehensive_care_pla"
		}).onDelete("cascade"),
]);

export const medicationAdherenceLogs = pgTable("medication_adherence_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	medicationId: uuid("medication_id"),
	reminderId: uuid("reminder_id"),
	medicationName: text("medication_name").notNull(),
	scheduledTime: timestamp("scheduled_time", { withTimezone: true, mode: 'string' }).notNull(),
	actualTime: timestamp("actual_time", { withTimezone: true, mode: 'string' }),
	status: text().notNull(),
	notes: text(),
	sideEffects: text("side_effects").array(),
	mood: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.medicationId],
			foreignColumns: [medicationsNew.id],
			name: "medication_adherence_logs_medication_id_medications_new_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "medication_adherence_logs_profile_id_profiles_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.reminderId],
			foreignColumns: [medicationReminders.id],
			name: "medication_adherence_logs_reminder_id_medication_reminders_id_f"
		}).onDelete("set null"),
]);

export const medicationReminders = pgTable("medication_reminders", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	medicationId: uuid("medication_id"),
	medicationName: text("medication_name").notNull(),
	dosage: text(),
	frequency: text().notNull(),
	scheduledTimes: text("scheduled_times").array().notNull(),
	daysOfWeek: integer("days_of_week").array(),
	startDate: date("start_date").notNull(),
	endDate: date("end_date"),
	isActive: boolean("is_active").default(true).notNull(),
	notifyPush: boolean("notify_push").default(true).notNull(),
	notifyEmail: boolean("notify_email").default(false).notNull(),
	notifySms: boolean("notify_sms").default(false).notNull(),
	advanceMinutes: integer("advance_minutes").default(15).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.medicationId],
			foreignColumns: [medicationsNew.id],
			name: "medication_reminders_medication_id_medications_new_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "medication_reminders_profile_id_profiles_id_fk"
		}).onDelete("cascade"),
]);

export const medicationInteractionFlags = pgTable("medication_interaction_flags", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	medication1Id: uuid("medication_1_id"),
	medication1Name: text("medication_1_name").notNull(),
	medication2Id: uuid("medication_2_id"),
	medication2Name: text("medication_2_name").notNull(),
	severity: text().notNull(),
	interactionType: text("interaction_type").notNull(),
	description: text().notNull(),
	recommendation: text(),
	aiGenerated: boolean("ai_generated").default(true).notNull(),
	status: text().default('pending').notNull(),
	reviewedBy: text("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	reviewNotes: text("review_notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.medication1Id],
			foreignColumns: [medicationsNew.id],
			name: "medication_interaction_flags_medication_1_id_medications_new_id"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.medication2Id],
			foreignColumns: [medicationsNew.id],
			name: "medication_interaction_flags_medication_2_id_medications_new_id"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "medication_interaction_flags_profile_id_profiles_id_fk"
		}).onDelete("cascade"),
]);

export const providerMedicationActions = pgTable("provider_medication_actions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	medicationId: uuid("medication_id"),
	medicationName: text("medication_name").notNull(),
	actionType: text("action_type").notNull(),
	previousValue: text("previous_value"),
	newValue: text("new_value"),
	reason: text(),
	providerId: text("provider_id").notNull(),
	providerName: text("provider_name").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.medicationId],
			foreignColumns: [medicationsNew.id],
			name: "provider_medication_actions_medication_id_medications_new_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "provider_medication_actions_profile_id_profiles_id_fk"
		}).onDelete("cascade"),
]);

export const carePlanGoalLinks = pgTable("care_plan_goal_links", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	carePlanId: uuid("care_plan_id").notNull(),
	healthGoalId: uuid("health_goal_id").notNull(),
	priority: integer().default(1).notNull(),
	providerNotes: text("provider_notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.carePlanId],
			foreignColumns: [comprehensiveCarePlans.id],
			name: "care_plan_goal_links_care_plan_id_comprehensive_care_plans_id_f"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.healthGoalId],
			foreignColumns: [healthGoals.id],
			name: "care_plan_goal_links_health_goal_id_health_goals_id_fk"
		}).onDelete("cascade"),
]);

export const carePlanMedicationLinks = pgTable("care_plan_medication_links", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	carePlanId: uuid("care_plan_id").notNull(),
	medicationReminderId: uuid("medication_reminder_id").notNull(),
	dosageInstructions: text("dosage_instructions"),
	providerNotes: text("provider_notes"),
	adherenceTarget: integer("adherence_target").default(90),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.carePlanId],
			foreignColumns: [comprehensiveCarePlans.id],
			name: "care_plan_medication_links_care_plan_id_comprehensive_care_plan"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.medicationReminderId],
			foreignColumns: [medicationReminders.id],
			name: "care_plan_medication_links_medication_reminder_id_medication_re"
		}).onDelete("cascade"),
]);

export const carePlanProgressNotes = pgTable("care_plan_progress_notes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	carePlanId: uuid("care_plan_id").notNull(),
	authorId: text("author_id").notNull(),
	authorRole: text("author_role").notNull(),
	noteType: text("note_type").default('general').notNull(),
	content: text().notNull(),
	attachmentUrl: text("attachment_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.carePlanId],
			foreignColumns: [comprehensiveCarePlans.id],
			name: "care_plan_progress_notes_care_plan_id_comprehensive_care_plans_"
		}).onDelete("cascade"),
]);

export const carePlanStatusHistory = pgTable("care_plan_status_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	carePlanId: uuid("care_plan_id").notNull(),
	previousStatus: text("previous_status").notNull(),
	newStatus: text("new_status").notNull(),
	changedBy: text("changed_by").notNull(),
	reason: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.carePlanId],
			foreignColumns: [comprehensiveCarePlans.id],
			name: "care_plan_status_history_care_plan_id_comprehensive_care_plans_"
		}).onDelete("cascade"),
]);

export const carePlanEducationLinks = pgTable("care_plan_education_links", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	carePlanId: uuid("care_plan_id").notNull(),
	contentType: text("content_type").notNull(),
	title: text().notNull(),
	description: text(),
	contentUrl: text("content_url"),
	aiGenerated: boolean("ai_generated").default(false).notNull(),
	priority: integer().default(1).notNull(),
	completed: boolean().default(false).notNull(),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	providerNotes: text("provider_notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.carePlanId],
			foreignColumns: [comprehensiveCarePlans.id],
			name: "care_plan_education_links_care_plan_id_comprehensive_care_plans"
		}).onDelete("cascade"),
]);

export const comprehensiveCarePlans = pgTable("comprehensive_care_plans", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	providerId: text("provider_id").notNull(),
	title: text().notNull(),
	description: text(),
	category: text().default('wellness').notNull(),
	status: text().default('draft').notNull(),
	startDate: date("start_date").notNull(),
	targetEndDate: date("target_end_date"),
	reviewDate: date("review_date"),
	priorityLevel: text("priority_level").default('medium').notNull(),
	patientAcknowledged: boolean("patient_acknowledged").default(false).notNull(),
	patientAcknowledgedAt: timestamp("patient_acknowledged_at", { withTimezone: true, mode: 'string' }),
	overallProgress: integer("overall_progress").default(0).notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "comprehensive_care_plans_profile_id_profiles_id_fk"
		}).onDelete("cascade"),
]);

export const engagementPointsLedger = pgTable("engagement_points_ledger", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	patientProfileId: uuid("patient_profile_id").notNull(),
	transactionType: text("transaction_type").notNull(),
	amount: integer().notNull(),
	balance: integer().notNull(),
	source: text().notNull(),
	sourceId: text("source_id"),
	description: text(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.patientProfileId],
			foreignColumns: [profiles.id],
			name: "engagement_points_ledger_patient_profile_id_profiles_id_fk"
		}),
]);

export const patientExperienceFeedback = pgTable("patient_experience_feedback", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	outcomeReportId: uuid("outcome_report_id"),
	feedbackCategory: text("feedback_category").notNull(),
	rating: integer().notNull(),
	feedbackText: text("feedback_text"),
	isAnonymous: boolean("is_anonymous").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.outcomeReportId],
			foreignColumns: [patientOutcomeReports.id],
			name: "patient_experience_feedback_outcome_report_id_patient_outcome_r"
		}),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "patient_experience_feedback_profile_id_profiles_id_fk"
		}),
]);

export const patientOutcomeReports = pgTable("patient_outcome_reports", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	reportType: text("report_type").notNull(),
	relatedCarePlanId: uuid("related_care_plan_id"),
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
	reportPeriodStart: timestamp("report_period_start", { withTimezone: true, mode: 'string' }),
	reportPeriodEnd: timestamp("report_period_end", { withTimezone: true, mode: 'string' }),
	providerReviewed: boolean("provider_reviewed").default(false),
	providerReviewedAt: timestamp("provider_reviewed_at", { withTimezone: true, mode: 'string' }),
	providerReviewedBy: text("provider_reviewed_by"),
	providerNotes: text("provider_notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "patient_outcome_reports_profile_id_profiles_id_fk"
		}),
	foreignKey({
			columns: [table.relatedCarePlanId],
			foreignColumns: [comprehensiveCarePlans.id],
			name: "patient_outcome_reports_related_care_plan_id_comprehensive_care"
		}),
]);

export const patientSymptomLogs = pgTable("patient_symptom_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id").notNull(),
	outcomeReportId: uuid("outcome_report_id"),
	symptomName: text("symptom_name").notNull(),
	severity: integer().notNull(),
	frequency: text(),
	duration: text(),
	triggerFactors: text("trigger_factors"),
	reliefMeasures: text("relief_measures"),
	impactOnDaily: text("impact_on_daily"),
	notes: text(),
	loggedAt: timestamp("logged_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.outcomeReportId],
			foreignColumns: [patientOutcomeReports.id],
			name: "patient_symptom_logs_outcome_report_id_patient_outcome_reports_"
		}),
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "patient_symptom_logs_profile_id_profiles_id_fk"
		}),
]);

export const engagementMessageThreads = pgTable("engagement_message_threads", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	patientProfileId: uuid("patient_profile_id").notNull(),
	providerUserId: text("provider_user_id").notNull(),
	providerName: text("provider_name").notNull(),
	subject: text().notNull(),
	category: text().notNull(),
	status: text().default('active').notNull(),
	priority: text().default('normal'),
	lastMessageAt: timestamp("last_message_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	patientUnreadCount: integer("patient_unread_count").default(0),
	providerUnreadCount: integer("provider_unread_count").default(0),
	isEncrypted: boolean("is_encrypted").default(true),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.patientProfileId],
			foreignColumns: [profiles.id],
			name: "engagement_message_threads_patient_profile_id_profiles_id_fk"
		}),
]);

export const engagementMessages = pgTable("engagement_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	threadId: uuid("thread_id").notNull(),
	senderType: text("sender_type").notNull(),
	senderId: text("sender_id").notNull(),
	senderName: text("sender_name").notNull(),
	content: text().notNull(),
	isRead: boolean("is_read").default(false),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
	attachmentUrl: text("attachment_url"),
	attachmentType: text("attachment_type"),
	attachmentName: text("attachment_name"),
	isSystemGenerated: boolean("is_system_generated").default(false),
	metadata: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.threadId],
			foreignColumns: [engagementMessageThreads.id],
			name: "engagement_messages_thread_id_engagement_message_threads_id_fk"
		}),
]);

export const engagementRewards = pgTable("engagement_rewards", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	patientProfileId: uuid("patient_profile_id").notNull(),
	rewardType: text("reward_type").notNull(),
	category: text().notNull(),
	name: text().notNull(),
	description: text(),
	pointsEarned: integer("points_earned").default(0),
	badgeId: text("badge_id"),
	badgeIcon: text("badge_icon"),
	badgeColor: text("badge_color"),
	triggerAction: text("trigger_action"),
	triggerEntityId: text("trigger_entity_id"),
	streakDays: integer("streak_days"),
	isNotified: boolean("is_notified").default(false),
	notifiedAt: timestamp("notified_at", { withTimezone: true, mode: 'string' }),
	earnedAt: timestamp("earned_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.patientProfileId],
			foreignColumns: [profiles.id],
			name: "engagement_rewards_patient_profile_id_profiles_id_fk"
		}),
]);

export const engagementStreaks = pgTable("engagement_streaks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	patientProfileId: uuid("patient_profile_id").notNull(),
	category: text().notNull(),
	currentStreak: integer("current_streak").default(0),
	longestStreak: integer("longest_streak").default(0),
	lastActivityDate: timestamp("last_activity_date", { withTimezone: true, mode: 'string' }),
	streakStartDate: timestamp("streak_start_date", { withTimezone: true, mode: 'string' }),
	totalActiveDays: integer("total_active_days").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.patientProfileId],
			foreignColumns: [profiles.id],
			name: "engagement_streaks_patient_profile_id_profiles_id_fk"
		}),
]);

export const engagementAppointments = pgTable("engagement_appointments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	patientProfileId: uuid("patient_profile_id").notNull(),
	providerUserId: text("provider_user_id").notNull(),
	providerName: text("provider_name").notNull(),
	providerSpecialty: text("provider_specialty"),
	appointmentType: text("appointment_type").notNull(),
	status: text().default('pending').notNull(),
	scheduledDate: timestamp("scheduled_date", { withTimezone: true, mode: 'string' }).notNull(),
	scheduledEndDate: timestamp("scheduled_end_date", { withTimezone: true, mode: 'string' }),
	durationMinutes: integer("duration_minutes").default(30),
	location: text(),
	locationAddress: text("location_address"),
	isTelehealth: boolean("is_telehealth").default(false),
	telehealthLink: text("telehealth_link"),
	reasonForVisit: text("reason_for_visit"),
	patientNotes: text("patient_notes"),
	providerNotes: text("provider_notes"),
	cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: 'string' }),
	cancelledBy: text("cancelled_by"),
	cancellationReason: text("cancellation_reason"),
	rescheduledFromId: uuid("rescheduled_from_id"),
	checkedInAt: timestamp("checked_in_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.patientProfileId],
			foreignColumns: [profiles.id],
			name: "engagement_appointments_patient_profile_id_profiles_id_fk"
		}),
]);

export const engagementAppointmentReminders = pgTable("engagement_appointment_reminders", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	appointmentId: uuid("appointment_id").notNull(),
	patientProfileId: uuid("patient_profile_id").notNull(),
	reminderType: text("reminder_type").notNull(),
	scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: 'string' }).notNull(),
	channel: text().notNull(),
	isSent: boolean("is_sent").default(false),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }),
	isAcknowledged: boolean("is_acknowledged").default(false),
	acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true, mode: 'string' }),
	failureReason: text("failure_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.appointmentId],
			foreignColumns: [engagementAppointments.id],
			name: "engagement_appointment_reminders_appointment_id_engagement_appo"
		}),
	foreignKey({
			columns: [table.patientProfileId],
			foreignColumns: [profiles.id],
			name: "engagement_appointment_reminders_patient_profile_id_profiles_id"
		}),
]);

export const featureEntitlements = pgTable("feature_entitlements", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	subscriptionId: uuid("subscription_id"),
	accountId: uuid("account_id"),
	organizationId: uuid("organization_id"),
	featureKey: text("feature_key").notNull(),
	isEnabled: boolean("is_enabled").default(true),
	limitValue: integer("limit_value"),
	usedValue: integer("used_value").default(0),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	grantedBy: text("granted_by"),
	grantReason: text("grant_reason"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "feature_entitlements_account_id_accounts_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "feature_entitlements_organization_id_organizations_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "feature_entitlements_subscription_id_subscriptions_id_fk"
		}).onDelete("cascade"),
]);

export const invoices = pgTable("invoices", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	subscriptionId: uuid("subscription_id").notNull(),
	organizationId: uuid("organization_id"),
	accountId: uuid("account_id"),
	invoiceNumber: text("invoice_number").notNull(),
	status: text().notNull(),
	subtotal: integer().notNull(),
	tax: integer().default(0),
	total: integer().notNull(),
	currency: text().default('usd'),
	dueDate: timestamp("due_date", { withTimezone: true, mode: 'string' }),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	stripeInvoiceId: text("stripe_invoice_id"),
	stripePaymentIntentId: text("stripe_payment_intent_id"),
	lineItems: jsonb("line_items"),
	billingPeriodStart: timestamp("billing_period_start", { withTimezone: true, mode: 'string' }),
	billingPeriodEnd: timestamp("billing_period_end", { withTimezone: true, mode: 'string' }),
	notes: text(),
	pdfUrl: text("pdf_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "invoices_account_id_accounts_id_fk"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "invoices_organization_id_organizations_id_fk"
		}),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "invoices_subscription_id_subscriptions_id_fk"
		}),
]);

export const hipaaAuditLogs = pgTable("hipaa_audit_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	eventId: text("event_id").notNull(),
	timestamp: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	eventType: text("event_type").notNull(),
	userId: text("user_id").notNull(),
	userName: text("user_name"),
	userRole: text("user_role"),
	patientId: text("patient_id"),
	resourceType: text("resource_type"),
	resourceId: text("resource_id"),
	action: text().notNull(),
	outcome: text().notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	deviceFingerprint: text("device_fingerprint"),
	sessionId: text("session_id"),
	phiAccessed: boolean("phi_accessed").default(false).notNull(),
	sensitivityLevel: text("sensitivity_level"),
	accessReason: text("access_reason"),
	dataClassification: text("data_classification"),
	complianceFrameworks: text("compliance_frameworks").array(),
	integrityHash: text("integrity_hash").notNull(),
	previousHash: text("previous_hash"),
	metadata: jsonb(),
}, (table) => [
	unique("hipaa_audit_logs_event_id_unique").on(table.eventId),
]);

export const organizationMembers = pgTable("organization_members", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	accountId: uuid("account_id").notNull(),
	role: text().notNull(),
	isProvider: boolean("is_provider").default(false),
	providerNpi: text("provider_npi"),
	providerSpecialty: text("provider_specialty"),
	invitedBy: uuid("invited_by"),
	invitedAt: timestamp("invited_at", { withTimezone: true, mode: 'string' }),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "organization_members_account_id_accounts_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.invitedBy],
			foreignColumns: [accounts.id],
			name: "organization_members_invited_by_accounts_id_fk"
		}),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "organization_members_organization_id_organizations_id_fk"
		}).onDelete("cascade"),
]);

export const mfaSecrets = pgTable("mfa_secrets", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	encryptedSecret: text("encrypted_secret").notNull(),
	backupCodesHash: text("backup_codes_hash").array(),
	isEnabled: boolean("is_enabled").default(false).notNull(),
	setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true, mode: 'string' }),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	failedAttempts: integer("failed_attempts").default(0).notNull(),
	lockedUntil: timestamp("locked_until", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("mfa_secrets_user_id_unique").on(table.userId),
]);

export const outcomeTracking = pgTable("outcome_tracking", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	subscriptionId: uuid("subscription_id").notNull(),
	measureType: text("measure_type").notNull(),
	baselineValue: integer("baseline_value"),
	targetValue: integer("target_value"),
	currentValue: integer("current_value"),
	periodStart: timestamp("period_start", { withTimezone: true, mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { withTimezone: true, mode: 'string' }).notNull(),
	achievedAt: timestamp("achieved_at", { withTimezone: true, mode: 'string' }),
	incentiveAmount: integer("incentive_amount"),
	notes: text(),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "outcome_tracking_organization_id_organizations_id_fk"
		}),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "outcome_tracking_subscription_id_subscriptions_id_fk"
		}),
]);

export const paymentMethods = pgTable("payment_methods", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	accountId: uuid("account_id"),
	organizationId: uuid("organization_id"),
	stripePaymentMethodId: text("stripe_payment_method_id").notNull(),
	type: text().notNull(),
	isDefault: boolean("is_default").default(false),
	cardBrand: text("card_brand"),
	cardLast4: text("card_last_4"),
	cardExpMonth: integer("card_exp_month"),
	cardExpYear: integer("card_exp_year"),
	bankName: text("bank_name"),
	bankLast4: text("bank_last_4"),
	billingName: text("billing_name"),
	billingEmail: text("billing_email"),
	billingAddress: jsonb("billing_address"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "payment_methods_account_id_accounts_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "payment_methods_organization_id_organizations_id_fk"
		}).onDelete("cascade"),
]);

export const securitySessions = pgTable("security_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: text("session_id").notNull(),
	userId: text("user_id").notNull(),
	deviceFingerprint: text("device_fingerprint"),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	riskScore: integer("risk_score").default(0).notNull(),
	mfaVerified: boolean("mfa_verified").default(false).notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastActivityAt: timestamp("last_activity_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	terminatedAt: timestamp("terminated_at", { withTimezone: true, mode: 'string' }),
	terminationReason: text("termination_reason"),
}, (table) => [
	unique("security_sessions_session_id_unique").on(table.sessionId),
]);

export const organizations = pgTable("organizations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	type: text().notNull(),
	domain: text(),
	logoUrl: text("logo_url"),
	primaryContactEmail: text("primary_contact_email").notNull(),
	primaryContactName: text("primary_contact_name"),
	billingEmail: text("billing_email"),
	addressLine1: text("address_line_1"),
	addressLine2: text("address_line_2"),
	city: text(),
	state: text(),
	postalCode: text("postal_code"),
	country: text().default('US'),
	taxId: text("tax_id"),
	stripeCustomerId: text("stripe_customer_id"),
	ssoEnabled: boolean("sso_enabled").default(false),
	ssoProvider: text("sso_provider"),
	ssoConfig: jsonb("sso_config"),
	whiteLabeling: jsonb("white_labeling"),
	contractStartDate: timestamp("contract_start_date", { withTimezone: true, mode: 'string' }),
	contractEndDate: timestamp("contract_end_date", { withTimezone: true, mode: 'string' }),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const auditExportRequests = pgTable("audit_export_requests", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	requestedBy: uuid("requested_by").notNull(),
	exportType: text("export_type").notNull(),
	format: text().notNull(),
	dateRangeStart: timestamp("date_range_start", { withTimezone: true, mode: 'string' }),
	dateRangeEnd: timestamp("date_range_end", { withTimezone: true, mode: 'string' }),
	filters: jsonb(),
	status: text().notNull(),
	fileUrl: text("file_url"),
	fileSize: integer("file_size"),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	completedAt: timestamp("completed_at", { withTimezone: true, mode: 'string' }),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "audit_export_requests_organization_id_organizations_id_fk"
		}),
	foreignKey({
			columns: [table.requestedBy],
			foreignColumns: [accounts.id],
			name: "audit_export_requests_requested_by_accounts_id_fk"
		}),
]);

export const subscriptions = pgTable("subscriptions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	accountId: uuid("account_id"),
	organizationId: uuid("organization_id"),
	planId: uuid("plan_id").notNull(),
	status: text().default('active').notNull(),
	billingCycle: text("billing_cycle").default('monthly').notNull(),
	currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: 'string' }).notNull(),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: 'string' }).notNull(),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
	cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: 'string' }),
	cancellationReason: text("cancellation_reason"),
	trialStart: timestamp("trial_start", { withTimezone: true, mode: 'string' }),
	trialEnd: timestamp("trial_end", { withTimezone: true, mode: 'string' }),
	stripeSubscriptionId: text("stripe_subscription_id"),
	stripeCustomerId: text("stripe_customer_id"),
	providerCount: integer("provider_count"),
	memberCount: integer("member_count"),
	addons: jsonb(),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "subscriptions_account_id_accounts_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "subscriptions_organization_id_organizations_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.planId],
			foreignColumns: [subscriptionPlans.id],
			name: "subscriptions_plan_id_subscription_plans_id_fk"
		}),
]);

export const subscriptionPlans = pgTable("subscription_plans", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	tier: text().notNull(),
	description: text(),
	targetAudience: text("target_audience"),
	priceMonthly: integer("price_monthly").notNull(),
	priceAnnual: integer("price_annual"),
	pricePerProvider: integer("price_per_provider"),
	pricePmpm: integer("price_pmpm"),
	features: jsonb().notNull(),
	trialDays: integer("trial_days").default(14),
	isActive: boolean("is_active").default(true),
	sortOrder: integer("sort_order").default(0),
	stripePriceIdMonthly: text("stripe_price_id_monthly"),
	stripePriceIdAnnual: text("stripe_price_id_annual"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const usageMetrics = pgTable("usage_metrics", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	organizationId: uuid("organization_id").notNull(),
	subscriptionId: uuid("subscription_id").notNull(),
	metricType: text("metric_type").notNull(),
	periodStart: timestamp("period_start", { withTimezone: true, mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { withTimezone: true, mode: 'string' }).notNull(),
	value: integer().notNull(),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organizations.id],
			name: "usage_metrics_organization_id_organizations_id_fk"
		}),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [subscriptions.id],
			name: "usage_metrics_subscription_id_subscriptions_id_fk"
		}),
]);

export const matchCandidates = pgTable("match_candidates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sourcePatientId: uuid("source_patient_id").notNull(),
	candidatePatientId: uuid("candidate_patient_id").notNull(),
	similarityScore: integer("similarity_score").notNull(),
	matchType: text("match_type").notNull(),
	matchDetails: jsonb("match_details"),
	status: text().default('pending').notNull(),
	reviewedBy: text("reviewed_by"),
	reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: 'string' }),
	reviewNotes: text("review_notes"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.candidatePatientId],
			foreignColumns: [patientIdentity.id],
			name: "match_candidates_candidate_patient_id_patient_identity_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sourcePatientId],
			foreignColumns: [patientIdentity.id],
			name: "match_candidates_source_patient_id_patient_identity_id_fk"
		}).onDelete("cascade"),
]);

export const mergeHistory = pgTable("merge_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	survivingPatientId: uuid("surviving_patient_id").notNull(),
	retiredPatientId: uuid("retired_patient_id").notNull(),
	mergeType: text("merge_type").notNull(),
	mergeReason: text("merge_reason"),
	matchScore: integer("match_score"),
	premergeData: jsonb("premerge_data"),
	postmergeData: jsonb("postmerge_data"),
	mergedBy: text("merged_by"),
	mergedAt: timestamp("merged_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	canUnmerge: boolean("can_unmerge").default(true).notNull(),
	unmergedAt: timestamp("unmerged_at", { withTimezone: true, mode: 'string' }),
	unmergedBy: text("unmerged_by"),
}, (table) => [
	foreignKey({
			columns: [table.survivingPatientId],
			foreignColumns: [patientIdentity.id],
			name: "merge_history_surviving_patient_id_patient_identity_id_fk"
		}),
]);

export const patientIdentity = pgTable("patient_identity", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	profileId: uuid("profile_id"),
	firstName: text("first_name").notNull(),
	middleName: text("middle_name"),
	hasNoMiddleName: boolean("has_no_middle_name").default(false).notNull(),
	lastName: text("last_name").notNull(),
	dateOfBirth: date("date_of_birth").notNull(),
	gender: text(),
	ssnLast4: text("ssn_last_4"),
	stateId: text("state_id"),
	stateIdState: text("state_id_state"),
	mrn: text(),
	mrnSource: text("mrn_source"),
	email: text(),
	phoneNumber: text("phone_number"),
	addressLine1: text("address_line_1"),
	addressLine2: text("address_line_2"),
	city: text(),
	state: text(),
	zipCode: text("zip_code"),
	country: text().default('US'),
	matchScore: integer("match_score"),
	matchStatus: text("match_status").default('unique').notNull(),
	masterPatientId: uuid("master_patient_id"),
	sourceSystem: text("source_system"),
	sourceRecordId: text("source_record_id"),
	dataQualityScore: integer("data_quality_score"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true, mode: 'string' }),
	ssnHash: text("ssn_hash"),
}, (table) => [
	foreignKey({
			columns: [table.profileId],
			foreignColumns: [profiles.id],
			name: "patient_identity_profile_id_profiles_id_fk"
		}).onDelete("cascade"),
]);

export const timelineEventDocuments = pgTable("timeline_event_documents", {
	timelineEventId: uuid("timeline_event_id").notNull(),
	documentId: uuid("document_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "timeline_event_documents_document_id_documents_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.timelineEventId],
			foreignColumns: [timelineEvents.id],
			name: "timeline_event_documents_timeline_event_id_timeline_events_id_f"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.timelineEventId, table.documentId], name: "timeline_event_documents_timeline_event_id_document_id_pk"}),
]);

export const timelineEventTags = pgTable("timeline_event_tags", {
	timelineEventId: uuid("timeline_event_id").notNull(),
	tagId: uuid("tag_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [tags.id],
			name: "timeline_event_tags_tag_id_tags_id_fk"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.timelineEventId],
			foreignColumns: [timelineEvents.id],
			name: "timeline_event_tags_timeline_event_id_timeline_events_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.timelineEventId, table.tagId], name: "timeline_event_tags_timeline_event_id_tag_id_pk"}),
]);

export const documentTags = pgTable("document_tags", {
	documentId: uuid("document_id").notNull(),
	tagId: uuid("tag_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [documents.id],
			name: "document_tags_document_id_documents_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [tags.id],
			name: "document_tags_tag_id_tags_id_fk"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.documentId, table.tagId], name: "document_tags_document_id_tag_id_pk"}),
]);

export const followupTags = pgTable("followup_tags", {
	followupId: uuid("followup_id").notNull(),
	tagId: uuid("tag_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.followupId],
			foreignColumns: [followups.id],
			name: "followup_tags_followup_id_followups_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [tags.id],
			name: "followup_tags_tag_id_tags_id_fk"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.followupId, table.tagId], name: "followup_tags_followup_id_tag_id_pk"}),
]);

export const symptomEntryTags = pgTable("symptom_entry_tags", {
	symptomEntryId: uuid("symptom_entry_id").notNull(),
	tagId: uuid("tag_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.symptomEntryId],
			foreignColumns: [symptomEntries.id],
			name: "symptom_entry_tags_symptom_entry_id_symptom_entries_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.tagId],
			foreignColumns: [tags.id],
			name: "symptom_entry_tags_tag_id_tags_id_fk"
		}).onDelete("restrict"),
	primaryKey({ columns: [table.symptomEntryId, table.tagId], name: "symptom_entry_tags_symptom_entry_id_tag_id_pk"}),
]);
