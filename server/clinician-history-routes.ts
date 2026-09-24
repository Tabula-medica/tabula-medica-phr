/**
 * Comprehensive patient history — one clinician-facing page's worth of chart
 * data at a glance: problem list, surgical history, allergies, social
 * history (including smoking/vaping/alcohol status), structured social
 * determinants of health, pain scale, and preventive care (immunizations).
 *
 * Every domain reuses an existing PHR table rather than duplicating one:
 * `medicalHistoryTable`, `surgeriesTable`, `allergiesTable`,
 * `socialHistoryTable`, `sdohTable`, `vitalSignsTable` (pain scale is
 * charted as a vital, `vitalType: "pain_score"`), and `vaccinesTable`. Those
 * tables previously had only patient-self-service routes (a patient reading
 * or writing their own record, resolved from their own session). This file
 * is the missing other half: a clinician reading or writing an arbitrary
 * patient's history by `profileId`.
 *
 * ## Screenings ride the SDOH table on purpose
 *
 * `sdohTable`'s shape — `domain` / `question` / `response` — is exactly the
 * shape a standardized screening instrument takes (one item, one answer),
 * so opioid-risk and alcohol-use (AUDIT-C) screening items are stored there
 * too, under their own `domain` values, alongside the social-determinants
 * questions the table was named for. This route layer does not compute or
 * validate any screening score: the question text, the answer options, and
 * (for AUDIT-C) the point arithmetic live entirely in the client's static
 * instrument definitions, so a wording or scoring correction is a client
 * change, not a migration. `docs/rcm-capability-and-why.md` established the
 * pattern this follows: capture structured data plainly, and do not have
 * the server assert a clinical score it cannot independently verify.
 *
 * ## Authorization
 *
 * Same `requirePermission` guard as outpatient-orders-routes.ts, and the
 * same caveat: it proves the caller's role, not a treatment relationship
 * with this specific patient. See that file's docblock for the full
 * accounting — it is not repeated here to avoid the warning going stale in
 * one copy while the other is updated.
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import {
  profiles,
  medicalHistoryTable,
  surgeriesTable,
  allergiesTable,
  socialHistoryTable,
  sdohTable,
  vitalSignsTable,
  vaccinesTable,
} from "@shared/schema";
import { phiDb, encryptPhiRow, decryptPhiRows } from "./storage/phi-storage";
import { requirePermission, auditDataAccess } from "./rbac";
import { logPhiAccess } from "./security/hipaa-audit";
import { noStorePhi } from "./lib/middleware/no-store-phi";

function callerUserId(req: Request): string {
  return (
    (req.session as any)?.userId ||
    (req.user as any)?.id ||
    (req.user as any)?.claims?.sub ||
    "unknown"
  );
}

async function patientExists(profileId: string): Promise<boolean> {
  const rows = await phiDb.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, profileId)).limit(1);
  return rows.length > 0;
}

async function audit(req: Request, profileId: string, resourceType: string, action: "read" | "write", resourceId?: string) {
  await logPhiAccess({
    userId: callerUserId(req),
    patientId: profileId,
    resourceType,
    action,
    resourceId,
    requestPath: req.path,
    requestMethod: req.method,
  });
}

const conditionSchema = z.object({
  condition: z.string().min(1).max(500),
  diagnosedDate: z.string().optional().nullable(),
  status: z.enum(["active", "resolved", "inactive", "chronic"]).default("active"),
  treatedBy: z.string().max(300).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const surgerySchema = z.object({
  procedureName: z.string().min(1).max(500),
  surgeryDate: z.string().optional().nullable(),
  surgeon: z.string().max(300).optional().nullable(),
  facility: z.string().max(300).optional().nullable(),
  outcome: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const allergySchema = z.object({
  allergen: z.string().min(1).max(300),
  reaction: z.string().max(500).optional().nullable(),
  severity: z.enum(["mild", "moderate", "severe", "life_threatening"]).optional().nullable(),
  status: z.enum(["active", "resolved", "inactive"]).default("active"),
  onsetDate: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// Covers general social history AND the smoking/vaping/alcohol status
// fields — `category` names which; the client sends a fixed set of
// category values ("Tobacco Use", "Vaping / E-cigarette Use", "Alcohol
// Use", plus free-form categories like occupation or living situation).
const socialHistorySchema = z.object({
  category: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  status: z.enum(["never", "former", "current", "unknown"]).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// One screening item's answer — SDOH domain, opioid-risk factor, or one
// AUDIT-C question. `domain` groups items that belong to the same
// screening instance (client sets it, e.g. "Alcohol Use (AUDIT-C)").
const screeningItemSchema = z.object({
  domain: z.string().min(1).max(200),
  question: z.string().max(500).optional().nullable(),
  response: z.string().min(1).max(500),
  screeningDate: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const painScaleSchema = z.object({
  value: z.string().regex(/^(10|[0-9])$/, "Pain score must be 0-10"),
  notes: z.string().max(1000).optional().nullable(),
});

const vaccineSchema = z.object({
  vaccineName: z.string().min(1).max(300),
  cvxCode: z.string().max(20).optional().nullable(),
  vaccineGroup: z.string().max(200).optional().nullable(),
  dateAdministered: z.string().optional().nullable(),
  provider: z.string().max(300).optional().nullable(),
  doseNumber: z.number().int().min(1).max(20).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export function registerClinicianHistoryRoutes(app: Express): void {
  app.use("/api/clinician/patient-history", noStorePhi);
  app.use("/api/clinician/patients", noStorePhi);

  // Minimal patient header — name and DOB only, for the "charting for"
  // banner on the orders, history, and (via the patient picker) any future
  // clinician-facing per-patient page. Deliberately thin: everything else
  // about the patient lives in the domain-specific endpoints above.
  app.get(
    "/api/clinician/patients/:profileId",
    requirePermission("records:read"),
    auditDataAccess("patient_header", "view"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        const rows = await phiDb.select().from(profiles).where(eq(profiles.id, profileId)).limit(1);
        if (rows.length === 0) return res.status(404).json({ error: "Patient not found" });
        const [patient] = decryptPhiRows("profiles", rows);
        await audit(req, profileId, "patient_header", "read");
        res.json({ id: patient.id, fullName: patient.fullName, dob: patient.dob });
      } catch (error) {
        console.error("[clinician-history:patient-header] error:", error);
        res.status(500).json({ error: "Failed to load patient" });
      }
    },
  );

  // ─── Conditions (problem list / PMH) ───────────────────────────────────
  app.get(
    "/api/clinician/patient-history/:profileId/conditions",
    requirePermission("records:read"),
    auditDataAccess("patient_conditions", "view"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        if (!(await patientExists(profileId))) return res.status(404).json({ error: "Patient not found" });
        const rows = await phiDb.select().from(medicalHistoryTable).where(eq(medicalHistoryTable.profileId, profileId)).orderBy(desc(medicalHistoryTable.createdAt));
        res.json({ items: decryptPhiRows("medicalHistoryTable", rows) });
      } catch (error) {
        console.error("[clinician-history:conditions] list error:", error);
        res.status(500).json({ error: "Failed to load conditions" });
      }
    },
  );

  app.post(
    "/api/clinician/patient-history/:profileId/conditions",
    requirePermission("records:write"),
    auditDataAccess("patient_conditions", "create"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        if (!(await patientExists(profileId))) return res.status(404).json({ error: "Patient not found" });
        const parsed = conditionSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid entry", details: parsed.error.flatten() });
        const [row] = await phiDb.insert(medicalHistoryTable).values(encryptPhiRow("medicalHistoryTable", { ...parsed.data, profileId })).returning();
        await audit(req, profileId, "patient_conditions", "write", row.id);
        res.status(201).json({ item: decryptPhiRows("medicalHistoryTable", [row])[0] });
      } catch (error) {
        console.error("[clinician-history:conditions] create error:", error);
        res.status(500).json({ error: "Failed to add condition" });
      }
    },
  );

  // ─── Surgical history ───────────────────────────────────────────────────
  app.get(
    "/api/clinician/patient-history/:profileId/surgeries",
    requirePermission("records:read"),
    auditDataAccess("patient_surgical_history", "view"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        if (!(await patientExists(profileId))) return res.status(404).json({ error: "Patient not found" });
        const rows = await phiDb.select().from(surgeriesTable).where(eq(surgeriesTable.profileId, profileId)).orderBy(desc(surgeriesTable.createdAt));
        res.json({ items: decryptPhiRows("surgeriesTable", rows) });
      } catch (error) {
        console.error("[clinician-history:surgeries] list error:", error);
        res.status(500).json({ error: "Failed to load surgical history" });
      }
    },
  );

  app.post(
    "/api/clinician/patient-history/:profileId/surgeries",
    requirePermission("records:write"),
    auditDataAccess("patient_surgical_history", "create"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        if (!(await patientExists(profileId))) return res.status(404).json({ error: "Patient not found" });
        const parsed = surgerySchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid entry", details: parsed.error.flatten() });
        const [row] = await phiDb.insert(surgeriesTable).values(encryptPhiRow("surgeriesTable", { ...parsed.data, profileId })).returning();
        await audit(req, profileId, "patient_surgical_history", "write", row.id);
        res.status(201).json({ item: decryptPhiRows("surgeriesTable", [row])[0] });
      } catch (error) {
        console.error("[clinician-history:surgeries] create error:", error);
        res.status(500).json({ error: "Failed to add surgery" });
      }
    },
  );

  // ─── Allergies ──────────────────────────────────────────────────────────
  app.get(
    "/api/clinician/patient-history/:profileId/allergies",
    requirePermission("records:read"),
    auditDataAccess("patient_allergies", "view"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        if (!(await patientExists(profileId))) return res.status(404).json({ error: "Patient not found" });
        const rows = await phiDb.select().from(allergiesTable).where(eq(allergiesTable.profileId, profileId)).orderBy(desc(allergiesTable.createdAt));
        res.json({ items: decryptPhiRows("allergiesTable", rows) });
      } catch (error) {
        console.error("[clinician-history:allergies] list error:", error);
        res.status(500).json({ error: "Failed to load allergies" });
      }
    },
  );

  app.post(
    "/api/clinician/patient-history/:profileId/allergies",
    requirePermission("records:write"),
    auditDataAccess("patient_allergies", "create"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        if (!(await patientExists(profileId))) return res.status(404).json({ error: "Patient not found" });
        const parsed = allergySchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid entry", details: parsed.error.flatten() });
        const [row] = await phiDb.insert(allergiesTable).values(encryptPhiRow("allergiesTable", { ...parsed.data, profileId })).returning();
        await audit(req, profileId, "patient_allergies", "write", row.id);
        res.status(201).json({ item: decryptPhiRows("allergiesTable", [row])[0] });
      } catch (error) {
        console.error("[clinician-history:allergies] create error:", error);
        res.status(500).json({ error: "Failed to add allergy" });
      }
    },
  );

  // ─── Social history (incl. smoking / vaping / alcohol status) ─────────
  app.get(
    "/api/clinician/patient-history/:profileId/social-history",
    requirePermission("records:read"),
    auditDataAccess("patient_social_history", "view"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        if (!(await patientExists(profileId))) return res.status(404).json({ error: "Patient not found" });
        const rows = await phiDb.select().from(socialHistoryTable).where(eq(socialHistoryTable.profileId, profileId)).orderBy(desc(socialHistoryTable.createdAt));
        res.json({ items: decryptPhiRows("socialHistoryTable", rows) });
      } catch (error) {
        console.error("[clinician-history:social-history] list error:", error);
        res.status(500).json({ error: "Failed to load social history" });
      }
    },
  );

  app.post(
    "/api/clinician/patient-history/:profileId/social-history",
    requirePermission("records:write"),
    auditDataAccess("patient_social_history", "create"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        if (!(await patientExists(profileId))) return res.status(404).json({ error: "Patient not found" });
        const parsed = socialHistorySchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid entry", details: parsed.error.flatten() });
        const [row] = await phiDb.insert(socialHistoryTable).values(encryptPhiRow("socialHistoryTable", { ...parsed.data, profileId })).returning();
        await audit(req, profileId, "patient_social_history", "write", row.id);
        res.status(201).json({ item: decryptPhiRows("socialHistoryTable", [row])[0] });
      } catch (error) {
        console.error("[clinician-history:social-history] create error:", error);
        res.status(500).json({ error: "Failed to add social history entry" });
      }
    },
  );

  // ─── Screenings (SDOH, opioid risk, AUDIT-C) ───────────────────────────
  app.get(
    "/api/clinician/patient-history/:profileId/screenings",
    requirePermission("records:read"),
    auditDataAccess("patient_screenings", "view"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        if (!(await patientExists(profileId))) return res.status(404).json({ error: "Patient not found" });
        const rows = await phiDb.select().from(sdohTable).where(eq(sdohTable.profileId, profileId)).orderBy(desc(sdohTable.createdAt));
        res.json({ items: decryptPhiRows("sdohTable", rows) });
      } catch (error) {
        console.error("[clinician-history:screenings] list error:", error);
        res.status(500).json({ error: "Failed to load screenings" });
      }
    },
  );

  app.post(
    "/api/clinician/patient-history/:profileId/screenings",
    requirePermission("records:write"),
    auditDataAccess("patient_screenings", "create"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        if (!(await patientExists(profileId))) return res.status(404).json({ error: "Patient not found" });
        // Accept either one item or a batch (a full AUDIT-C or SDOH form
        // submits several rows for the same screeningDate at once).
        const items = Array.isArray(req.body?.items) ? req.body.items : [req.body];
        const parsedItems: z.infer<typeof screeningItemSchema>[] = [];
        for (const item of items) {
          const parsed = screeningItemSchema.safeParse(item);
          if (!parsed.success) return res.status(400).json({ error: "Invalid screening item", details: parsed.error.flatten() });
          parsedItems.push(parsed.data);
        }
        const rows = await phiDb
          .insert(sdohTable)
          .values(parsedItems.map((item) => encryptPhiRow("sdohTable", { ...item, profileId })))
          .returning();
        await audit(req, profileId, "patient_screenings", "write");
        res.status(201).json({ items: decryptPhiRows("sdohTable", rows) });
      } catch (error) {
        console.error("[clinician-history:screenings] create error:", error);
        res.status(500).json({ error: "Failed to record screening" });
      }
    },
  );

  // ─── Pain scale (vital sign, not a PHI_COLUMN_MAP table) ───────────────
  app.get(
    "/api/clinician/patient-history/:profileId/pain-scale",
    requirePermission("records:read"),
    auditDataAccess("patient_pain_scale", "view"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        if (!(await patientExists(profileId))) return res.status(404).json({ error: "Patient not found" });
        const rows = await phiDb
          .select()
          .from(vitalSignsTable)
          .where(and(eq(vitalSignsTable.profileId, profileId), eq(vitalSignsTable.vitalType, "pain_score")))
          .orderBy(desc(vitalSignsTable.recordedAt));
        res.json({ items: decryptPhiRows("vitalSignsTable", rows) });
      } catch (error) {
        console.error("[clinician-history:pain-scale] list error:", error);
        res.status(500).json({ error: "Failed to load pain scale history" });
      }
    },
  );

  app.post(
    "/api/clinician/patient-history/:profileId/pain-scale",
    requirePermission("records:write"),
    auditDataAccess("patient_pain_scale", "create"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        if (!(await patientExists(profileId))) return res.status(404).json({ error: "Patient not found" });
        const parsed = painScaleSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid pain score", details: parsed.error.flatten() });
        const [row] = await phiDb
          .insert(vitalSignsTable)
          .values(
            encryptPhiRow("vitalSignsTable", {
              profileId,
              vitalType: "pain_score",
              value: parsed.data.value,
              unit: "0-10 NRS",
              source: "clinician",
              notes: parsed.data.notes ?? null,
            }),
          )
          .returning();
        await audit(req, profileId, "patient_pain_scale", "write", row.id);
        res.status(201).json({ item: decryptPhiRows("vitalSignsTable", [row])[0] });
      } catch (error) {
        console.error("[clinician-history:pain-scale] create error:", error);
        res.status(500).json({ error: "Failed to record pain score" });
      }
    },
  );

  // ─── Preventive care / immunizations ───────────────────────────────────
  app.get(
    "/api/clinician/patient-history/:profileId/vaccines",
    requirePermission("records:read"),
    auditDataAccess("patient_immunizations", "view"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        if (!(await patientExists(profileId))) return res.status(404).json({ error: "Patient not found" });
        const rows = await phiDb.select().from(vaccinesTable).where(eq(vaccinesTable.profileId, profileId)).orderBy(desc(vaccinesTable.createdAt));
        res.json({ items: decryptPhiRows("vaccinesTable", rows) });
      } catch (error) {
        console.error("[clinician-history:vaccines] list error:", error);
        res.status(500).json({ error: "Failed to load immunization history" });
      }
    },
  );

  app.post(
    "/api/clinician/patient-history/:profileId/vaccines",
    requirePermission("records:write"),
    auditDataAccess("patient_immunizations", "create"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        if (!(await patientExists(profileId))) return res.status(404).json({ error: "Patient not found" });
        const parsed = vaccineSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: "Invalid entry", details: parsed.error.flatten() });
        const [row] = await phiDb.insert(vaccinesTable).values(encryptPhiRow("vaccinesTable", { ...parsed.data, profileId })).returning();
        await audit(req, profileId, "patient_immunizations", "write", row.id);
        res.status(201).json({ item: decryptPhiRows("vaccinesTable", [row])[0] });
      } catch (error) {
        console.error("[clinician-history:vaccines] create error:", error);
        res.status(500).json({ error: "Failed to add immunization" });
      }
    },
  );

  // ─── Aggregated bundle — the "at a glance" load for the whole page ────
  app.get(
    "/api/clinician/patient-history/:profileId",
    requirePermission("records:read"),
    auditDataAccess("patient_history_bundle", "view"),
    async (req: Request, res: Response) => {
      try {
        const { profileId } = req.params;
        if (!(await patientExists(profileId))) return res.status(404).json({ error: "Patient not found" });

        const [conditions, surgeries, allergies, socialHistory, screenings, vaccines, painScale] = await Promise.all([
          phiDb.select().from(medicalHistoryTable).where(eq(medicalHistoryTable.profileId, profileId)).orderBy(desc(medicalHistoryTable.createdAt)),
          phiDb.select().from(surgeriesTable).where(eq(surgeriesTable.profileId, profileId)).orderBy(desc(surgeriesTable.createdAt)),
          phiDb.select().from(allergiesTable).where(eq(allergiesTable.profileId, profileId)).orderBy(desc(allergiesTable.createdAt)),
          phiDb.select().from(socialHistoryTable).where(eq(socialHistoryTable.profileId, profileId)).orderBy(desc(socialHistoryTable.createdAt)),
          phiDb.select().from(sdohTable).where(eq(sdohTable.profileId, profileId)).orderBy(desc(sdohTable.createdAt)),
          phiDb.select().from(vaccinesTable).where(eq(vaccinesTable.profileId, profileId)).orderBy(desc(vaccinesTable.createdAt)),
          phiDb
            .select()
            .from(vitalSignsTable)
            .where(and(eq(vitalSignsTable.profileId, profileId), eq(vitalSignsTable.vitalType, "pain_score")))
            .orderBy(desc(vitalSignsTable.recordedAt)),
        ]);

        await audit(req, profileId, "patient_history_bundle", "read");

        res.json({
          conditions: decryptPhiRows("medicalHistoryTable", conditions),
          surgeries: decryptPhiRows("surgeriesTable", surgeries),
          allergies: decryptPhiRows("allergiesTable", allergies),
          socialHistory: decryptPhiRows("socialHistoryTable", socialHistory),
          screenings: decryptPhiRows("sdohTable", screenings),
          vaccines: decryptPhiRows("vaccinesTable", vaccines),
          painScale: decryptPhiRows("vitalSignsTable", painScale),
        });
      } catch (error) {
        console.error("[clinician-history] bundle error:", error);
        res.status(500).json({ error: "Failed to load patient history" });
      }
    },
  );
}
