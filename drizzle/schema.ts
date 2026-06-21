import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  integer,
  jsonb,
  inet,
  primaryKey,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    mfaEnabled: boolean("mfa_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailUx: uniqueIndex("accounts_email_ux").on(t.email),
  })
);

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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const caregiverAccess = pgTable(
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
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  parentFolderId: uuid("parent_folder_id").references(() => folders.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  systemKey: text("system_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    namespace: text("namespace").notNull(),
    value: text("value").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ux: uniqueIndex("tags_namespace_value_ux").on(t.namespace, t.value),
  })
);

export const documents = pgTable("documents", {
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
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
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
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.timelineEventId, t.documentId] }),
  })
);

export const medications = pgTable("medications", {
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

export const symptomEntries = pgTable("symptom_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  profileId: uuid("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  medicationId: uuid("medication_id").references(() => medications.id, { onDelete: "set null" }),
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

export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
  profileId: uuid("profile_id").references(() => profiles.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: uuid("target_id"),
  ipAddress: inet("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  account: one(accounts, { fields: [profiles.accountId], references: [accounts.id] }),
  folders: many(folders),
  documents: many(documents),
}));
