import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, timestamp, uniqueIndex, varchar, text } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  middleName: varchar("middle_name").default("NMN").notNull(),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Local auth fields
  passwordHash: varchar("password_hash"),
  authProvider: varchar("auth_provider").default("oidc"), // 'local' or 'oidc'
  mfaRequired: varchar("mfa_required").default("true"), // MFA required by default for HIPAA
  passwordUpdatedAt: timestamp("password_updated_at"),
  isVerified: boolean("is_verified").default(false),
  verificationProvider: varchar("verification_provider"),
  verifiedAt: timestamp("verified_at"),
  // Consumer Stripe subscription (tabulamedica.us edition hard paywall only).
  // These power the $9.99/yr .us paywall and are unrelated to the B2B
  // accounts/subscriptions (org/PMPM) tables in shared/schema.ts.
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: varchar("subscription_status").default("inactive"), // 'active'|'inactive'|'past_due'|'canceled'
  subscriptionCurrentPeriodEnd: timestamp("subscription_current_period_end"),
  subscriptionUpdatedAt: timestamp("subscription_updated_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Analytics events for auth tracking
export const authAnalyticsEvents = pgTable("auth_analytics_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  eventType: varchar("event_type").notNull(), // auth_register_started, auth_register_success, etc.
  metadata: jsonb("metadata"),
  ipAddress: varchar("ip_address"),
  userAgent: varchar("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type AuthAnalyticsEvent = typeof authAnalyticsEvents.$inferSelect;
export type InsertAuthAnalyticsEvent = typeof authAnalyticsEvents.$inferInsert;

// Caregiver access - allows trusted family members to view patient health records
export const caregivers = pgTable("caregivers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientUserId: varchar("patient_user_id").notNull().references(() => users.id),
  caregiverUserId: varchar("caregiver_user_id").references(() => users.id),
  caregiverEmail: varchar("caregiver_email").notNull(),
  caregiverName: varchar("caregiver_name"),
  relationship: varchar("relationship").notNull(),
  status: varchar("status").notNull().default("pending"),
  permissions: text("permissions").array().notNull().default(sql`ARRAY['view']::text[]`),
  inviteToken: varchar("invite_token"),
  invitedAt: timestamp("invited_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Caregiver = typeof caregivers.$inferSelect;
export type InsertCaregiver = typeof caregivers.$inferInsert;

// External identity provider mapping.
// Decouples internal user.id from any one auth provider's `sub` claim so we can
// migrate auth providers without breaking foreign keys. Active provider is
// 'gcip'; legacy rows from retired IdPs are preserved for ownership history.
// One row per (provider, externalSub) pair; many rows can map to the same userId.
export const externalIdentities = pgTable(
  "external_identities",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider").notNull(), // 'gcip' (legacy values preserved)
    externalSub: varchar("external_sub").notNull(),
    email: varchar("email"),
    emailVerified: boolean("email_verified").default(false),
    metadata: jsonb("metadata"),
    linkedAt: timestamp("linked_at").defaultNow(),
    lastSeenAt: timestamp("last_seen_at"),
  },
  (table) => [
    uniqueIndex("external_identities_provider_sub_ux").on(table.provider, table.externalSub),
    index("external_identities_user_id_idx").on(table.userId),
    index("external_identities_email_idx").on(table.email),
  ]
);

export type ExternalIdentity = typeof externalIdentities.$inferSelect;
export type InsertExternalIdentity = typeof externalIdentities.$inferInsert;
