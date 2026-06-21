import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const facilityTypes = [
  "hospital",
  "clinic",
  "lab",
  "imaging",
  "pharmacy",
] as const;
export type FacilityType = typeof facilityTypes[number];

export const facilities = pgTable(
  "facilities",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: varchar("name", { length: 255 }).notNull(),
    aliases: text("aliases").array().default(sql`ARRAY[]::text[]`),
    facilityType: varchar("facility_type", { length: 50 }).notNull(),
    addressLine1: varchar("address_line_1", { length: 255 }),
    addressLine2: varchar("address_line_2", { length: 255 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    postalCode: varchar("postal_code", { length: 20 }),
    country: varchar("country", { length: 100 }).default("USA"),
    phone: varchar("phone", { length: 50 }),
    website: varchar("website", { length: 500 }),
    npi: varchar("npi", { length: 20 }),
    orgId: varchar("org_id", { length: 100 }),
    healthSystem: varchar("health_system", { length: 255 }),
    ehrVendor: varchar("ehr_vendor", { length: 100 }),
    supportsFhir: boolean("supports_fhir"),
    fhirBaseUrl: varchar("fhir_base_url", { length: 500 }),
    patientPortalUrl: varchar("patient_portal_url", { length: 500 }),
    notes: text("notes"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("IDX_facility_name").on(table.name),
    index("IDX_facility_type").on(table.facilityType),
    index("IDX_facility_city").on(table.city),
    index("IDX_facility_state").on(table.state),
    index("IDX_facility_health_system").on(table.healthSystem),
    index("IDX_facility_npi").on(table.npi),
  ]
);

export type Facility = typeof facilities.$inferSelect;
export type InsertFacility = typeof facilities.$inferInsert;

export const insertFacilitySchema = createInsertSchema(facilities, {
  name: z.string().min(1, "Name is required").max(255),
  facilityType: z.enum(facilityTypes, { message: "Invalid facility type" }),
  phone: z.string().max(50).optional().nullable(),
  website: z.string().url("Invalid website URL").max(500).optional().nullable().or(z.literal("")),
  npi: z.string().max(20).optional().nullable(),
  fhirBaseUrl: z.string().url("Invalid FHIR base URL").max(500).optional().nullable().or(z.literal("")),
  patientPortalUrl: z.string().url("Invalid patient portal URL").max(500).optional().nullable().or(z.literal("")),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const updateFacilitySchema = insertFacilitySchema.partial();

export type InsertFacilityInput = z.infer<typeof insertFacilitySchema>;
export type UpdateFacilityInput = z.infer<typeof updateFacilitySchema>;
