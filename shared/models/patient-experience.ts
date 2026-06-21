import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const messageTypes = ["general", "urgent", "follow_up", "prescription", "lab_results", "appointment"] as const;
export type MessageType = typeof messageTypes[number];

export const messages = pgTable(
  "patient_messages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    patientId: varchar("patient_id").notNull(),
    senderId: varchar("sender_id").notNull(),
    senderType: varchar("sender_type", { length: 20 }).notNull(), // "patient" | "clinician" | "system"
    senderName: varchar("sender_name", { length: 255 }).notNull(),
    recipientId: varchar("recipient_id").notNull(),
    recipientType: varchar("recipient_type", { length: 20 }).notNull(),
    recipientName: varchar("recipient_name", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 500 }),
    content: text("content").notNull(),
    messageType: varchar("message_type", { length: 50 }).default("general"),
    threadId: varchar("thread_id"),
    parentMessageId: varchar("parent_message_id"),
    isRead: boolean("is_read").default(false),
    isArchived: boolean("is_archived").default(false),
    isUrgent: boolean("is_urgent").default(false),
    attachments: text("attachments").array(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    readAt: timestamp("read_at"),
  },
  (table) => [
    index("IDX_message_patient").on(table.patientId),
    index("IDX_message_sender").on(table.senderId),
    index("IDX_message_recipient").on(table.recipientId),
    index("IDX_message_thread").on(table.threadId),
    index("IDX_message_created").on(table.createdAt),
  ]
);

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

export const insertMessageSchema = createInsertSchema(messages, {
  content: z.string().min(1, "Message content is required").max(10000),
  subject: z.string().max(500).optional().nullable(),
  messageType: z.enum(messageTypes).optional(),
}).omit({ id: true, createdAt: true, readAt: true, senderType: true, senderName: true, recipientId: true, recipientName: true, recipientType: true, patientId: true, senderId: true, threadId: true });

export type InsertMessageInput = z.infer<typeof insertMessageSchema>;

export const recommendationPriorities = ["low", "medium", "high", "critical"] as const;
export type RecommendationPriority = typeof recommendationPriorities[number];

export const recommendationCategories = [
  "lifestyle",
  "medication",
  "screening",
  "follow_up",
  "diet",
  "exercise",
  "mental_health",
  "preventive_care",
  "chronic_management",
] as const;
export type RecommendationCategory = typeof recommendationCategories[number];

export const healthRecommendations = pgTable(
  "health_recommendations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    patientId: varchar("patient_id").notNull(),
    clinicianId: varchar("clinician_id").notNull(),
    clinicianName: varchar("clinician_name", { length: 255 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    category: varchar("category", { length: 50 }).notNull(),
    priority: varchar("priority", { length: 20 }).default("medium"),
    actionItems: text("action_items").array(),
    relatedConditions: text("related_conditions").array(),
    dueDate: timestamp("due_date"),
    isCompleted: boolean("is_completed").default(false),
    completedAt: timestamp("completed_at"),
    patientNotes: text("patient_notes"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_recommendation_patient").on(table.patientId),
    index("IDX_recommendation_clinician").on(table.clinicianId),
    index("IDX_recommendation_category").on(table.category),
    index("IDX_recommendation_priority").on(table.priority),
  ]
);

export type HealthRecommendation = typeof healthRecommendations.$inferSelect;
export type InsertHealthRecommendation = typeof healthRecommendations.$inferInsert;

export const insertHealthRecommendationSchema = createInsertSchema(healthRecommendations, {
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().min(1, "Description is required").max(5000),
  category: z.enum(recommendationCategories),
  priority: z.enum(recommendationPriorities).optional(),
  actionItems: z.array(z.string()).optional(),
  relatedConditions: z.array(z.string()).optional(),
}).omit({ id: true, createdAt: true, updatedAt: true, completedAt: true, clinicianId: true, clinicianName: true });

export type InsertHealthRecommendationInput = z.infer<typeof insertHealthRecommendationSchema>;

export const alertSeverities = ["info", "warning", "critical"] as const;
export type AlertSeverity = typeof alertSeverities[number];

export const alertCategories = [
  "medication",
  "appointment",
  "lab_results",
  "vital_signs",
  "care_gap",
  "refill_needed",
  "follow_up_due",
  "screening_due",
  "message_received",
  "recommendation",
] as const;
export type AlertCategory = typeof alertCategories[number];

export const patientAlerts = pgTable(
  "patient_alerts",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    patientId: varchar("patient_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    category: varchar("category", { length: 50 }).notNull(),
    severity: varchar("severity", { length: 20 }).default("info"),
    actionUrl: varchar("action_url", { length: 500 }),
    actionLabel: varchar("action_label", { length: 100 }),
    relatedResourceType: varchar("related_resource_type", { length: 50 }),
    relatedResourceId: varchar("related_resource_id"),
    isRead: boolean("is_read").default(false),
    isDismissed: boolean("is_dismissed").default(false),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    readAt: timestamp("read_at"),
  },
  (table) => [
    index("IDX_alert_patient").on(table.patientId),
    index("IDX_alert_category").on(table.category),
    index("IDX_alert_severity").on(table.severity),
    index("IDX_alert_created").on(table.createdAt),
  ]
);

export type PatientAlert = typeof patientAlerts.$inferSelect;
export type InsertPatientAlert = typeof patientAlerts.$inferInsert;

export const insertPatientAlertSchema = createInsertSchema(patientAlerts, {
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(2000).optional().nullable(),
  category: z.enum(alertCategories),
  severity: z.enum(alertSeverities).optional(),
}).omit({ id: true, createdAt: true, readAt: true });

export type InsertPatientAlertInput = z.infer<typeof insertPatientAlertSchema>;

export const appointments = pgTable(
  "patient_appointments",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    patientId: varchar("patient_id").notNull(),
    clinicianId: varchar("clinician_id").notNull(),
    clinicianName: varchar("clinician_name", { length: 255 }).notNull(),
    facilityId: varchar("facility_id"),
    facilityName: varchar("facility_name", { length: 255 }),
    appointmentType: varchar("appointment_type", { length: 100 }).notNull(),
    status: varchar("status", { length: 50 }).default("scheduled"),
    scheduledAt: timestamp("scheduled_at").notNull(),
    duration: integer("duration").default(30),
    reason: text("reason"),
    notes: text("notes"),
    isTelehealth: boolean("is_telehealth").default(false),
    meetingUrl: varchar("meeting_url", { length: 500 }),
    reminderSent: boolean("reminder_sent").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("IDX_appointment_patient").on(table.patientId),
    index("IDX_appointment_clinician").on(table.clinicianId),
    index("IDX_appointment_scheduled").on(table.scheduledAt),
    index("IDX_appointment_status").on(table.status),
  ]
);

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = typeof appointments.$inferInsert;

export const insertAppointmentSchema = createInsertSchema(appointments, {
  appointmentType: z.string().min(1, "Appointment type is required").max(100),
  duration: z.number().min(5).max(480).optional(),
  reason: z.string().max(1000).optional().nullable(),
}).omit({ id: true, createdAt: true, updatedAt: true, clinicianId: true, clinicianName: true, status: true, meetingUrl: true, facilityId: true, facilityName: true });

export type InsertAppointmentInput = z.infer<typeof insertAppointmentSchema>;
