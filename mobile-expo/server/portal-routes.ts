// @ts-nocheck
import express, { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { eq, desc, sql, count, and, or, ilike, gte, inArray } from "drizzle-orm";
import { chatComplete } from "./ai-client";
import {
  portalProviders,
  portalSessions,
  portalTasks,
  tenants,
  tenantUsers,
  users,
  healthRecords,
  appointments,
  patientProfiles,
  auditLogs,
  userRoles,
  rolePermissions,
  healthPredictions,
  dataSources,
  medicationSchedules,
  adherenceLogs,
  healthJournalEntries,
} from "@shared/schema";
import { clinicalDecisionSupportService } from "./clinical-decision-support-service";


declare global {
  namespace Express {
    interface Request {
      portalProvider?: any;
    }
  }
}

const BCRYPT_ROUNDS = 12;

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

function verifyPassword(password: string, stored: string): boolean {
  // Support legacy SHA-256 hashes (salt:hex format) to allow migration on next login.
  // Legacy format contains exactly one colon separating a 32-char hex salt from a 64-char hex hash.
  if (/^[0-9a-f]{32}:[0-9a-f]{64}$/.test(stored)) {
    const { createHash } = require("crypto");
    const [salt, hash] = stored.split(":");
    const testHash = createHash("sha256").update(salt + password).digest("hex");
    return hash === testHash;
  }
  return bcrypt.compareSync(password, stored);
}

async function requirePortalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.substring(7);
    const [session] = await db
      .select()
      .from(portalSessions)
      .where(eq(portalSessions.token, token))
      .limit(1);

    if (!session || new Date(session.expiresAt) < new Date()) {
      return res.status(401).json({ error: "Session expired or invalid" });
    }

    const [provider] = await db
      .select()
      .from(portalProviders)
      .where(eq(portalProviders.id, session.providerId))
      .limit(1);

    if (!provider || !provider.isActive) {
      return res.status(401).json({ error: "Provider account inactive" });
    }

    req.portalProvider = provider;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Authentication failed" });
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.portalProvider || req.portalProvider.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}


async function getOrgPatientIds(tenantId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: tenantUsers.userId })
    .from(tenantUsers)
    .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.isActive, true)));
  return rows.map(r => r.userId);
}

async function getRequestTenantId(req: Request, res: Response): Promise<string | null> {
  const provider = req.portalProvider;
  if (!provider) {
    res.status(403).json({ error: "Provider account has no organization configured" });
    return null;
  }
  if (provider.tenantId) {
    return provider.tenantId;
  }
  // tenantId must be set at provider creation/approval time or by the boot migration.
  // If still null the record is incomplete — fail closed to prevent slug-collision fallback.
  res.status(403).json({ error: "Provider account is not bound to an organization. Contact your portal administrator." });
  return null;
}

function getAdminOrg(req: Request, res: Response): string | null {
  const org = req.portalProvider?.organization;
  if (!org) {
    res.status(403).json({ error: "Admin account has no organization configured" });
    return null;
  }
  return org;
}

async function seedDemoAdmin() {
  // Only seed the demo admin account in local development.
  // In production/staging environments this function is a no-op to prevent
  // known credentials from existing in the database.
  if (process.env.NODE_ENV !== "development") {
    console.log("[Portal] Skipping demo admin seed — not in development mode");
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(portalProviders)
      .where(eq(portalProviders.email, "admin@tabulamedica.com"))
      .limit(1);

    if (!existing) {
      await db.insert(portalProviders).values({
        email: "admin@tabulamedica.com",
        passwordHash: hashPassword("admin123"),
        name: "System Administrator",
        role: "admin",
        specialty: "Administration",
        organization: "Tabula Medica",
      });
      console.log("[Portal] Dev demo admin account created: admin@tabulamedica.com (development only)");
    }
  } catch (error) {
    console.error("[Portal] Error seeding demo admin:", error);
  }
}

export function registerPortalRoutes(app: express.Application) {
  const router = express.Router();

  // ============================================
  // Auth Routes (no auth required)
  // ============================================

  router.post("/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const [provider] = await db
        .select()
        .from(portalProviders)
        .where(eq(portalProviders.email, email))
        .limit(1);

      if (!provider || !verifyPassword(password, provider.passwordHash)) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (!provider.isActive) {
        return res.status(403).json({ error: "Account is pending admin approval or has been deactivated. Please contact your administrator." });
      }

      // Migrate legacy SHA-256 hash to bcrypt on successful login.
      const isLegacyHash = /^[0-9a-f]{32}:[0-9a-f]{64}$/.test(provider.passwordHash);
      const providerUpdates: any = { lastLoginAt: new Date() };
      if (isLegacyHash) {
        providerUpdates.passwordHash = hashPassword(password);
      }

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.insert(portalSessions).values({
        providerId: provider.id,
        token,
        expiresAt,
      });

      await db
        .update(portalProviders)
        .set(providerUpdates)
        .where(eq(portalProviders.id, provider.id));

      const { passwordHash, ...providerInfo } = provider;
      res.json({ token, provider: providerInfo, expiresAt });
    } catch (error) {
      console.error("[Portal] Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  router.post("/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name, specialty, organization, phone, npiNumber } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Email, password, and name are required" });
      }

      const [existing] = await db
        .select()
        .from(portalProviders)
        .where(eq(portalProviders.email, email))
        .limit(1);

      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }

      // Role is always "provider" for self-registration — never trust caller-supplied role.
      // New accounts are inactive until an admin approves them.
      const [provider] = await db
        .insert(portalProviders)
        .values({
          email,
          passwordHash: hashPassword(password),
          name,
          role: "provider",
          isActive: false,
          specialty: specialty || null,
          organization: organization || null,
          phone: phone || null,
          npiNumber: npiNumber || null,
        })
        .returning();

      const { passwordHash, ...providerInfo } = provider;
      res.status(201).json({
        provider: providerInfo,
        message: "Registration submitted. Your account is pending administrator approval before you can log in.",
      });
    } catch (error) {
      console.error("[Portal] Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  router.post("/auth/logout", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        await db.delete(portalSessions).where(eq(portalSessions.token, token));
      }
      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("[Portal] Logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // ============================================
  // Dashboard Routes (auth required)
  // ============================================

  router.get("/dashboard/stats", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;

      const orgPatientIds = await getOrgPatientIds(tenantId);

      const patientCountVal = orgPatientIds.length;

      const [recordCount] = orgPatientIds.length > 0
        ? await db.select({ value: count() }).from(healthRecords).where(inArray(healthRecords.userId, orgPatientIds))
        : [{ value: 0 }];

      const [appointmentCount] = orgPatientIds.length > 0
        ? await db.select({ value: count() }).from(appointments).where(inArray(appointments.userId, orgPatientIds))
        : [{ value: 0 }];

      const [activeProviderCount] = await db
        .select({ value: count() })
        .from(portalProviders)
        .where(and(eq(portalProviders.isActive, true), eq(portalProviders.tenantId, tenantId)));

      const recentActivity = orgPatientIds.length > 0
        ? await db
            .select()
            .from(auditLogs)
            .where(inArray(auditLogs.userId, orgPatientIds))
            .orderBy(desc(auditLogs.createdAt))
            .limit(10)
        : [];

      const appointmentStats = orgPatientIds.length > 0
        ? await db
            .select({ status: appointments.status, count: count() })
            .from(appointments)
            .where(inArray(appointments.userId, orgPatientIds))
            .groupBy(appointments.status)
        : [];

      const recordDistribution = orgPatientIds.length > 0
        ? await db
            .select({ type: healthRecords.type, count: count() })
            .from(healthRecords)
            .where(inArray(healthRecords.userId, orgPatientIds))
            .groupBy(healthRecords.type)
        : [];

      res.json({
        totalPatients: patientCountVal,
        totalRecords: recordCount.value,
        totalAppointments: appointmentCount.value,
        activeProviders: activeProviderCount.value,
        recentActivity,
        appointmentStats,
        recordDistribution,
      });
    } catch (error) {
      console.error("[Portal] Dashboard stats error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // ============================================
  // Patient Routes (auth required)
  // ============================================

  router.get("/patients", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;

      const orgPatientIds = await getOrgPatientIds(tenantId);
      if (orgPatientIds.length === 0) {
        return res.json([]);
      }

      const search = req.query.search as string | undefined;

      let conditions: any[] = [inArray(users.id, orgPatientIds)];
      if (search) {
        conditions.push(
          or(
            ilike(users.name, `%${search}%`),
            ilike(users.email, `%${search}%`)
          )
        );
      }

      const patientList = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
          createdAt: users.createdAt,
          firstName: patientProfiles.firstName,
          lastName: patientProfiles.lastName,
          dateOfBirth: patientProfiles.dateOfBirth,
          gender: patientProfiles.gender,
          phone: patientProfiles.phone,
        })
        .from(users)
        .leftJoin(patientProfiles, eq(users.id, patientProfiles.userId))
        .where(and(...conditions))
        .orderBy(desc(users.createdAt));

      const patientsWithCounts = await Promise.all(
        patientList.map(async (patient) => {
          const [rc] = await db
            .select({ value: count() })
            .from(healthRecords)
            .where(eq(healthRecords.userId, patient.id));
          return { ...patient, recordCount: rc.value };
        })
      );

      res.json(patientsWithCounts);
    } catch (error) {
      console.error("[Portal] Patients list error:", error);
      res.status(500).json({ error: "Failed to fetch patients" });
    }
  });

  router.get("/patients/:id", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;

      const orgPatientIds = await getOrgPatientIds(tenantId);
      if (!orgPatientIds.includes(id)) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const [patient] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const [profile] = await db
        .select()
        .from(patientProfiles)
        .where(eq(patientProfiles.userId, id))
        .limit(1);

      const recordCountsByType = await db
        .select({
          type: healthRecords.type,
          count: count(),
        })
        .from(healthRecords)
        .where(eq(healthRecords.userId, id))
        .groupBy(healthRecords.type);

      const recentRecords = await db
        .select()
        .from(healthRecords)
        .where(eq(healthRecords.userId, id))
        .orderBy(desc(healthRecords.date))
        .limit(10);

      const [totalRecords] = await db
        .select({ value: count() })
        .from(healthRecords)
        .where(eq(healthRecords.userId, id));

      const sources = await db
        .select({
          id: dataSources.id,
          name: dataSources.name,
          type: dataSources.type,
          fhirEndpoint: dataSources.fhirEndpoint,
          isConnected: dataSources.isConnected,
          lastSyncAt: dataSources.lastSyncAt,
          recordCount: dataSources.recordCount,
          createdAt: dataSources.createdAt,
          updatedAt: dataSources.updatedAt,
        })
        .from(dataSources)
        .where(eq(dataSources.userId, id));

      res.json({
        patient,
        profile: profile || null,
        recordCountsByType,
        totalRecords: totalRecords.value,
        recentRecords,
        dataSources: sources,
      });
    } catch (error) {
      console.error("[Portal] Patient detail error:", error);
      res.status(500).json({ error: "Failed to fetch patient details" });
    }
  });

  router.get("/patients/:id/records", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;
      const orgPatientIds = await getOrgPatientIds(tenantId);
      if (!orgPatientIds.includes(id)) {
        return res.status(404).json({ error: "Patient not found" });
      }
      const type = req.query.type as string | undefined;

      let conditions = [eq(healthRecords.userId, id)];
      if (type) {
        conditions.push(eq(healthRecords.type, type));
      }

      const records = await db
        .select()
        .from(healthRecords)
        .where(and(...conditions))
        .orderBy(desc(healthRecords.date));

      res.json(records);
    } catch (error) {
      console.error("[Portal] Patient records error:", error);
      res.status(500).json({ error: "Failed to fetch patient records" });
    }
  });

  router.get("/patients/:id/intake", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;
      const orgPatientIds = await getOrgPatientIds(tenantId);
      if (!orgPatientIds.includes(id)) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const intakeRecords = await db
        .select()
        .from(healthRecords)
        .where(and(eq(healthRecords.userId, id), eq(healthRecords.type, "intake")))
        .orderBy(desc(healthRecords.date));

      res.json(intakeRecords);
    } catch (error) {
      console.error("[Portal] Patient intake error:", error);
      res.status(500).json({ error: "Failed to fetch intake history" });
    }
  });

  // ============================================
  // ============================================
  // Patient Enrollment (explicit admin action)
  // ============================================

  router.post("/patients/:id/enroll", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id: patientId } = req.params;

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;

      const [patientUser] = await db.select({ id: users.id }).from(users).where(eq(users.id, patientId)).limit(1);
      if (!patientUser) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const existingMemberships = await db
        .select({ tenantId: tenantUsers.tenantId })
        .from(tenantUsers)
        .where(and(eq(tenantUsers.userId, patientId), eq(tenantUsers.isActive, true)));

      const alreadyInThisOrg = existingMemberships.some(m => m.tenantId === tenantId);
      if (alreadyInThisOrg) {
        return res.json({ message: "Patient already enrolled in this organization", patientId });
      }

      const conflictingOrg = existingMemberships.find(m => m.tenantId !== tenantId);
      if (conflictingOrg) {
        return res.status(403).json({ error: "Patient is already enrolled with another organization" });
      }

      await db.insert(tenantUsers).values({
        tenantId,
        userId: patientId,
        role: "patient",
        isActive: true,
      });

      res.status(201).json({ message: "Patient enrolled successfully", patientId });
    } catch (error) {
      console.error("[Portal] Patient enrollment error:", error);
      res.status(500).json({ error: "Failed to enroll patient" });
    }
  });

  router.delete("/patients/:id/enroll", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id: patientId } = req.params;

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;

      const [deleted] = await db
        .delete(tenantUsers)
        .where(and(eq(tenantUsers.userId, patientId), eq(tenantUsers.tenantId, tenantId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: "Enrollment not found" });
      }

      res.json({ message: "Patient unenrolled successfully" });
    } catch (error) {
      console.error("[Portal] Patient unenrollment error:", error);
      res.status(500).json({ error: "Failed to unenroll patient" });
    }
  });

  // Appointment Routes (auth required)
  // ============================================

  router.get("/appointments", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;

      const orgPatientIds = await getOrgPatientIds(tenantId);
      if (orgPatientIds.length === 0) {
        return res.json([]);
      }

      const status = req.query.status as string | undefined;
      const date = req.query.date as string | undefined;
      const patientId = req.query.patientId as string | undefined;

      let conditions: any[] = [inArray(appointments.userId, orgPatientIds)];
      if (status) {
        conditions.push(eq(appointments.status, status));
      }
      if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        conditions.push(
          and(
            gte(appointments.scheduledAt, startOfDay),
            sql`${appointments.scheduledAt} <= ${endOfDay}`
          )
        );
      }
      if (patientId) {
        conditions.push(eq(appointments.userId, patientId));
      }

      const appointmentList = await db
        .select({
          id: appointments.id,
          userId: appointments.userId,
          title: appointments.title,
          description: appointments.description,
          appointmentType: appointments.appointmentType,
          providerName: appointments.providerName,
          facilityName: appointments.facilityName,
          scheduledAt: appointments.scheduledAt,
          duration: appointments.duration,
          status: appointments.status,
          notes: appointments.notes,
          createdAt: appointments.createdAt,
          updatedAt: appointments.updatedAt,
          patientName: users.name,
          patientEmail: users.email,
        })
        .from(appointments)
        .leftJoin(users, eq(appointments.userId, users.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(appointments.scheduledAt));

      res.json(appointmentList);
    } catch (error) {
      console.error("[Portal] Appointments list error:", error);
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  router.post("/appointments", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, title, appointmentType, providerName, facilityName, scheduledAt, duration, notes, description } = req.body;

      if (!userId || !title || !appointmentType || !scheduledAt) {
        return res.status(400).json({ error: "userId, title, appointmentType, and scheduledAt are required" });
      }

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;
      const orgPatientIds = await getOrgPatientIds(tenantId);
      if (!orgPatientIds.includes(userId)) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const [appointment] = await db
        .insert(appointments)
        .values({
          userId,
          title,
          description: description || null,
          appointmentType,
          providerName: providerName || null,
          facilityName: facilityName || null,
          scheduledAt: new Date(scheduledAt),
          duration: duration || 30,
          notes: notes || null,
          status: "scheduled",
        })
        .returning();

      res.status(201).json(appointment);
    } catch (error) {
      console.error("[Portal] Create appointment error:", error);
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  router.put("/appointments/:id", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;
      const orgPatientIds = await getOrgPatientIds(tenantId);

      const [existing] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
      if (!existing || !orgPatientIds.includes(existing.userId)) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      const updates: any = { updatedAt: new Date() };

      if (req.body.status !== undefined) updates.status = req.body.status;
      if (req.body.scheduledAt !== undefined) updates.scheduledAt = new Date(req.body.scheduledAt);
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.providerName !== undefined) updates.providerName = req.body.providerName;
      if (req.body.facilityName !== undefined) updates.facilityName = req.body.facilityName;
      if (req.body.duration !== undefined) updates.duration = req.body.duration;

      const [updated] = await db
        .update(appointments)
        .set(updates)
        .where(eq(appointments.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("[Portal] Update appointment error:", error);
      res.status(500).json({ error: "Failed to update appointment" });
    }
  });

  router.delete("/appointments/:id", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;
      const orgPatientIds = await getOrgPatientIds(tenantId);

      const [existing] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
      if (!existing || !orgPatientIds.includes(existing.userId)) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      const [updated] = await db
        .update(appointments)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(appointments.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("[Portal] Cancel appointment error:", error);
      res.status(500).json({ error: "Failed to cancel appointment" });
    }
  });

  // ============================================
  // AI Insights Routes (auth required)
  // ============================================

  router.get("/insights/patients/:id", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;
      const orgPatientIds = await getOrgPatientIds(tenantId);
      if (!orgPatientIds.includes(id)) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const predictions = await db
        .select()
        .from(healthPredictions)
        .where(eq(healthPredictions.userId, id))
        .orderBy(desc(healthPredictions.createdAt))
        .limit(20);

      const riskFactors = predictions.filter((p) => p.riskLevel === "high" || p.riskLevel === "critical");

      res.json({
        predictions,
        riskFactors,
        totalPredictions: predictions.length,
        highRiskCount: riskFactors.length,
      });
    } catch (error) {
      console.error("[Portal] Patient insights error:", error);
      res.status(500).json({ error: "Failed to fetch patient insights" });
    }
  });

  router.get("/insights/summary", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;
      const orgPatientIds = await getOrgPatientIds(tenantId);

      const orgFilter = orgPatientIds.length > 0
        ? inArray(healthPredictions.userId, orgPatientIds)
        : sql`FALSE`;

      const [totalPredictions] = await db
        .select({ value: count() })
        .from(healthPredictions)
        .where(orgFilter);

      const riskDistribution = orgPatientIds.length > 0
        ? await db
            .select({ riskLevel: healthPredictions.riskLevel, count: count() })
            .from(healthPredictions)
            .where(orgFilter)
            .groupBy(healthPredictions.riskLevel)
        : [];

      const predictionTypes = orgPatientIds.length > 0
        ? await db
            .select({ type: healthPredictions.predictionType, count: count() })
            .from(healthPredictions)
            .where(orgFilter)
            .groupBy(healthPredictions.predictionType)
        : [];

      const recentPredictions = orgPatientIds.length > 0
        ? await db
            .select()
            .from(healthPredictions)
            .where(orgFilter)
            .orderBy(desc(healthPredictions.createdAt))
            .limit(10)
        : [];

      res.json({
        totalPredictions: totalPredictions.value,
        riskDistribution,
        predictionTypes,
        recentPredictions,
      });
    } catch (error) {
      console.error("[Portal] Insights summary error:", error);
      res.status(500).json({ error: "Failed to fetch insights summary" });
    }
  });

  // ============================================
  // Admin Routes (admin only)
  // ============================================

  router.get("/admin/providers", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const adminOrg = getAdminOrg(req, res);
      if (!adminOrg) return;

      const providers = await db
        .select({
          id: portalProviders.id,
          email: portalProviders.email,
          name: portalProviders.name,
          role: portalProviders.role,
          specialty: portalProviders.specialty,
          npiNumber: portalProviders.npiNumber,
          organization: portalProviders.organization,
          phone: portalProviders.phone,
          isActive: portalProviders.isActive,
          lastLoginAt: portalProviders.lastLoginAt,
          createdAt: portalProviders.createdAt,
          updatedAt: portalProviders.updatedAt,
        })
        .from(portalProviders)
        .where(eq(portalProviders.organization, adminOrg))
        .orderBy(desc(portalProviders.createdAt));

      res.json(providers);
    } catch (error) {
      console.error("[Portal] List providers error:", error);
      res.status(500).json({ error: "Failed to fetch providers" });
    }
  });

  router.post("/admin/providers", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const adminOrg = getAdminOrg(req, res);
      if (!adminOrg) return;

      const adminTenantId = await getRequestTenantId(req, res);
      if (!adminTenantId) return;

      const { email, password, name, role, specialty, phone, npiNumber } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Email, password, and name are required" });
      }

      const [existing] = await db
        .select()
        .from(portalProviders)
        .where(eq(portalProviders.email, email))
        .limit(1);

      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const [provider] = await db
        .insert(portalProviders)
        .values({
          email,
          passwordHash: hashPassword(password),
          name,
          role: role || "provider",
          specialty: specialty || null,
          organization: adminOrg,
          tenantId: adminTenantId,
          phone: phone || null,
          npiNumber: npiNumber || null,
        })
        .returning();

      const { passwordHash, ...providerInfo } = provider;
      res.status(201).json(providerInfo);
    } catch (error) {
      console.error("[Portal] Create provider error:", error);
      res.status(500).json({ error: "Failed to create provider" });
    }
  });

  router.put("/admin/providers/:id", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const adminOrg = getAdminOrg(req, res);
      if (!adminOrg) return;

      const adminTenantId = await getRequestTenantId(req, res);
      if (!adminTenantId) return;

      const [target] = await db.select().from(portalProviders).where(eq(portalProviders.id, id)).limit(1);
      if (!target || target.organization !== adminOrg) {
        return res.status(404).json({ error: "Provider not found" });
      }

      const updates: any = { updatedAt: new Date() };

      if (req.body.role !== undefined) updates.role = req.body.role;
      if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
      if (req.body.name !== undefined) updates.name = req.body.name;
      if (req.body.specialty !== undefined) updates.specialty = req.body.specialty;
      if (req.body.phone !== undefined) updates.phone = req.body.phone;
      if (req.body.npiNumber !== undefined) updates.npiNumber = req.body.npiNumber;
      if (req.body.password) updates.passwordHash = hashPassword(req.body.password);
      if (!target.tenantId) updates.tenantId = adminTenantId;

      const [updated] = await db
        .update(portalProviders)
        .set(updates)
        .where(and(eq(portalProviders.id, id), eq(portalProviders.organization, adminOrg)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Provider not found" });
      }

      const { passwordHash, ...providerInfo } = updated;
      res.json(providerInfo);
    } catch (error) {
      console.error("[Portal] Update provider error:", error);
      res.status(500).json({ error: "Failed to update provider" });
    }
  });

  router.delete("/admin/providers/:id", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const adminOrg = getAdminOrg(req, res);
      if (!adminOrg) return;

      const [target] = await db.select().from(portalProviders).where(eq(portalProviders.id, id)).limit(1);
      if (!target || target.organization !== adminOrg) {
        return res.status(404).json({ error: "Provider not found" });
      }

      const [updated] = await db
        .update(portalProviders)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(portalProviders.id, id), eq(portalProviders.organization, adminOrg)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Provider not found" });
      }

      const { passwordHash, ...providerInfo } = updated;
      res.json(providerInfo);
    } catch (error) {
      console.error("[Portal] Deactivate provider error:", error);
      res.status(500).json({ error: "Failed to deactivate provider" });
    }
  });

  // Reserved system role names that portal admins must never be able to create or rename roles to.
  // This list mirrors the built-in roles seeded by access-control-service.ts.
  const SYSTEM_ROLE_NAMES = new Set([
    "patient", "caregiver", "provider", "admin",
    "researcher", "read_only", "data_manager",
    "auditor", "data_analyst", "emergency_responder",
  ]);

  router.get("/admin/roles", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const orgName = req.portalProvider.organization || "";
      // Only expose portal-created roles belonging to this organization.
      // isSystem=false ensures global system roles are never exposed here,
      // and portalOrganization = orgName ensures cross-tenant isolation.
      const roles = await db
        .select()
        .from(userRoles)
        .where(and(
          eq(userRoles.isSystem, false),
          eq(userRoles.portalOrganization, orgName),
        ))
        .orderBy(desc(userRoles.priority));

      res.json(roles);
    } catch (error) {
      console.error("[Portal] List roles error:", error);
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  router.post("/admin/roles", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { name, displayName, description, priority } = req.body;
      if (!name || !displayName) {
        return res.status(400).json({ error: "Name and displayName are required" });
      }

      // Block creation of roles whose names collide with any reserved system role.
      // Allowing this would let a portal admin create a role named "admin" and,
      // once assigned to users, grant them platform-wide admin access.
      if (SYSTEM_ROLE_NAMES.has(String(name).toLowerCase())) {
        return res.status(403).json({ error: "Role name is reserved and cannot be used" });
      }

      const orgName = req.portalProvider.organization || "";
      const [role] = await db
        .insert(userRoles)
        .values({
          name,
          displayName,
          description: description || null,
          priority: priority || 0,
          isSystem: false, // Portal-created roles are never system roles
          portalOrganization: orgName, // Scoped to this portal organization only
        })
        .returning();

      res.status(201).json(role);
    } catch (error) {
      console.error("[Portal] Create role error:", error);
      res.status(500).json({ error: "Failed to create role" });
    }
  });

  router.put("/admin/roles/:id", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const orgName = req.portalProvider.organization || "";

      // Fetch the role and enforce all ownership constraints before accepting updates.
      const [existing] = await db
        .select()
        .from(userRoles)
        .where(eq(userRoles.id, id))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Role not found" });
      }

      // System roles are global and must never be modified by portal admins.
      if (existing.isSystem) {
        return res.status(403).json({ error: "System roles cannot be modified" });
      }

      // Cross-tenant isolation: a portal admin can only edit roles that belong
      // to their own organization. Attempting to edit another org's role ID
      // returns 404 to avoid leaking the existence of other orgs' roles.
      if (existing.portalOrganization !== orgName) {
        return res.status(404).json({ error: "Role not found" });
      }

      // Explicitly typed to prevent accidental inclusion of security-sensitive
      // fields (isSystem, portalOrganization) via future drift.
      const updates: {
        updatedAt: Date;
        name?: string;
        displayName?: string;
        description?: string | null;
        priority?: number;
      } = { updatedAt: new Date() };

      if (req.body.name !== undefined) {
        // Block renaming to a reserved system role name — this is the core exploit path
        // (renaming "patient" to "admin" would silently promote all existing holders).
        if (SYSTEM_ROLE_NAMES.has(String(req.body.name).toLowerCase())) {
          return res.status(403).json({ error: "Role name is reserved and cannot be used" });
        }
        updates.name = String(req.body.name);
      }
      if (req.body.displayName !== undefined) updates.displayName = String(req.body.displayName);
      if (req.body.description !== undefined) updates.description = req.body.description ?? null;
      if (req.body.priority !== undefined) updates.priority = Number(req.body.priority);
      // isSystem and portalOrganization are intentionally absent from updates type

      const [updated] = await db
        .update(userRoles)
        .set(updates)
        .where(and(eq(userRoles.id, id), eq(userRoles.isSystem, false)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Role not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("[Portal] Update role error:", error);
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  router.get("/admin/audit-log", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;

      const orgPatientIds = await getOrgPatientIds(tenantId);

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;

      const orgFilter = orgPatientIds.length > 0
        ? inArray(auditLogs.userId, orgPatientIds)
        : sql`FALSE`;

      const [totalCount] = await db
        .select({ value: count() })
        .from(auditLogs)
        .where(orgFilter);

      const logs = await db
        .select()
        .from(auditLogs)
        .where(orgFilter)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset);

      res.json({
        logs,
        pagination: {
          page,
          limit,
          total: totalCount.value,
          totalPages: Math.ceil(totalCount.value / limit),
        },
      });
    } catch (error) {
      console.error("[Portal] Audit log error:", error);
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });

  // ============================================
  // Tasks Routes (auth required)
  // ============================================

  router.get("/tasks", requirePortalAuth, async (req: Request, res: Response) => {
    try {
      const tasks = await db
        .select()
        .from(portalTasks)
        .where(eq(portalTasks.providerId, req.portalProvider.id))
        .orderBy(desc(portalTasks.createdAt));

      res.json(tasks);
    } catch (error) {
      console.error("[Portal] Tasks list error:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  router.post("/tasks", requirePortalAuth, async (req: Request, res: Response) => {
    try {
      const { patientId, title, description, taskType, priority, dueDate } = req.body;

      if (!title || !taskType) {
        return res.status(400).json({ error: "Title and taskType are required" });
      }

      let resolvedPatientId: string | null = null;
      if (patientId) {
        const tenantId = await getRequestTenantId(req, res);
        if (!tenantId) return;
        const orgPatientIds = await getOrgPatientIds(tenantId);
        if (!orgPatientIds.includes(patientId)) {
          return res.status(400).json({ error: "Invalid patientId: patient not found" });
        }
        resolvedPatientId = patientId;
      }

      const [task] = await db
        .insert(portalTasks)
        .values({
          providerId: req.portalProvider.id,
          patientId: resolvedPatientId,
          title,
          description: description || null,
          taskType,
          priority: priority || "normal",
          status: "pending",
          dueDate: dueDate ? new Date(dueDate) : null,
        })
        .returning();

      res.status(201).json(task);
    } catch (error) {
      console.error("[Portal] Create task error:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  });

  router.put("/tasks/:id", requirePortalAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates: any = { updatedAt: new Date() };

      if (req.body.status !== undefined) {
        updates.status = req.body.status;
        if (req.body.status === "completed") {
          updates.completedAt = new Date();
        }
      }
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.priority !== undefined) updates.priority = req.body.priority;
      if (req.body.dueDate !== undefined) updates.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;

      const [updated] = await db
        .update(portalTasks)
        .set(updates)
        .where(and(eq(portalTasks.id, id), eq(portalTasks.providerId, req.portalProvider.id)))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Task not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error("[Portal] Update task error:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  });

  // ============================================
  // AI Assistant - Proactive Patient Review
  // ============================================

  router.get("/ai-assistant/patient-review/:id", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;
      const orgPatientIds = await getOrgPatientIds(tenantId);
      if (!orgPatientIds.includes(id)) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const [patient] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const records = await db.select().from(healthRecords).where(eq(healthRecords.userId, id)).orderBy(desc(healthRecords.date)).limit(50);

      const medSchedules = await db.select().from(medicationSchedules).where(and(eq(medicationSchedules.userId, id), eq(medicationSchedules.isActive, true)));

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
      const scheduleIds = medSchedules.map(s => s.id);
      const patientLogs = scheduleIds.length > 0
        ? await db.select().from(adherenceLogs).where(and(gte(adherenceLogs.takenAt, thirtyDaysAgo), inArray(adherenceLogs.scheduleId, scheduleIds))).limit(200)
        : [];

      const journalEntries = await db.select().from(healthJournalEntries).where(eq(healthJournalEntries.userId, id)).orderBy(desc(healthJournalEntries.createdAt)).limit(20);

      const alerts: any[] = [];

      const vitals = records.filter(r => r.type === "vital");
      const labs = records.filter(r => r.type === "lab_result" || r.type === "lab");

      vitals.forEach(v => {
        try {
          const data = typeof v.data === "string" ? JSON.parse(v.data) : v.data;
          if (data) {
            const value = parseFloat(data.value || data.result || "0");
            const title = (v.title || "").toLowerCase();
            if (title.includes("blood pressure") || title.includes("systolic")) {
              if (value > 140) alerts.push({ type: "critical", category: "vitals", message: `High blood pressure detected: ${value} mmHg`, recordId: v.id, date: v.date });
              else if (value > 130) alerts.push({ type: "warning", category: "vitals", message: `Elevated blood pressure: ${value} mmHg`, recordId: v.id, date: v.date });
            }
            if (title.includes("heart rate") || title.includes("pulse")) {
              if (value > 100) alerts.push({ type: "warning", category: "vitals", message: `Elevated heart rate: ${value} bpm`, recordId: v.id, date: v.date });
              if (value < 50) alerts.push({ type: "warning", category: "vitals", message: `Low heart rate: ${value} bpm`, recordId: v.id, date: v.date });
            }
            if (title.includes("temperature")) {
              if (value > 100.4) alerts.push({ type: "critical", category: "vitals", message: `Fever detected: ${value}°F`, recordId: v.id, date: v.date });
            }
            if (title.includes("oxygen") || title.includes("spo2")) {
              if (value < 95) alerts.push({ type: "critical", category: "vitals", message: `Low oxygen saturation: ${value}%`, recordId: v.id, date: v.date });
            }
          }
        } catch {}
      });

      labs.forEach(l => {
        try {
          const data = typeof l.data === "string" ? JSON.parse(l.data) : l.data;
          if (data) {
            const value = parseFloat(data.value || data.result || "0");
            const title = (l.title || "").toLowerCase();
            if (title.includes("glucose") || title.includes("a1c")) {
              if (title.includes("a1c") && value > 6.5) alerts.push({ type: "critical", category: "labs", message: `Elevated HbA1c: ${value}% (diabetic range)`, recordId: l.id, date: l.date });
              else if (title.includes("glucose") && value > 126) alerts.push({ type: "warning", category: "labs", message: `Elevated fasting glucose: ${value} mg/dL`, recordId: l.id, date: l.date });
            }
            if (title.includes("cholesterol") && value > 240) alerts.push({ type: "warning", category: "labs", message: `High total cholesterol: ${value} mg/dL`, recordId: l.id, date: l.date });
            if (title.includes("ldl") && value > 160) alerts.push({ type: "warning", category: "labs", message: `High LDL cholesterol: ${value} mg/dL`, recordId: l.id, date: l.date });
            if (title.includes("creatinine") && value > 1.3) alerts.push({ type: "warning", category: "labs", message: `Elevated creatinine: ${value} mg/dL`, recordId: l.id, date: l.date });
          }
        } catch {}
      });

      const totalDoses = patientLogs.length;
      const takenDoses = patientLogs.filter(l => l.status === "taken").length;
      const adherenceRate = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : null;

      if (adherenceRate !== null && adherenceRate < 70) {
        alerts.push({ type: "warning", category: "adherence", message: `Low medication adherence rate: ${adherenceRate}% (30-day)`, date: new Date().toISOString() });
      }
      if (adherenceRate !== null && adherenceRate < 50) {
        alerts.push({ type: "critical", category: "adherence", message: `Critical medication non-adherence: ${adherenceRate}% - Immediate follow-up recommended`, date: new Date().toISOString() });
      }

      const missedDoses = patientLogs.filter(l => l.status === "missed").length;
      if (missedDoses > 5) {
        alerts.push({ type: "warning", category: "adherence", message: `${missedDoses} missed doses in the last 30 days`, date: new Date().toISOString() });
      }

      const recentPainEntries = journalEntries.filter(e => e.painLevel !== null && (e.painLevel as number) >= 7);
      if (recentPainEntries.length >= 3) {
        alerts.push({ type: "warning", category: "symptoms", message: `Patient reported high pain (7+/10) on ${recentPainEntries.length} occasions recently`, date: new Date().toISOString() });
      }

      const lowMoodEntries = journalEntries.filter(e => e.mood !== null && (e.mood as number) <= 1);
      if (lowMoodEntries.length >= 2) {
        alerts.push({ type: "warning", category: "mental_health", message: `Patient reported consistently low mood - possible depression screening needed`, date: new Date().toISOString() });
      }

      const symptomCounts: Record<string, number> = {};
      journalEntries.forEach(e => {
        if (e.symptoms && Array.isArray(e.symptoms)) {
          (e.symptoms as string[]).forEach(s => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });
        }
      });
      Object.entries(symptomCounts).forEach(([symptom, cnt]) => {
        if (cnt >= 3) {
          alerts.push({ type: "info", category: "symptoms", message: `Recurring symptom: "${symptom}" reported ${cnt} times recently`, date: new Date().toISOString() });
        }
      });

      const suggestions: any[] = [];

      if (adherenceRate !== null && adherenceRate < 80) {
        suggestions.push({ action: "Schedule medication counseling session", priority: "high", reason: `Adherence rate is ${adherenceRate}%` });
      }
      if (recentPainEntries.length > 0) {
        suggestions.push({ action: "Review pain management plan", priority: "medium", reason: `${recentPainEntries.length} high pain reports` });
      }
      if (lowMoodEntries.length > 0) {
        suggestions.push({ action: "Consider PHQ-9 depression screening", priority: "high", reason: "Consistently low mood reported" });
      }
      if (alerts.some(a => a.category === "vitals" && a.type === "critical")) {
        suggestions.push({ action: "Schedule urgent vitals follow-up", priority: "urgent", reason: "Critical vital signs detected" });
      }
      if (alerts.some(a => a.category === "labs")) {
        suggestions.push({ action: "Review lab results and consider re-ordering", priority: "medium", reason: "Abnormal lab values detected" });
      }

      const upcomingAppts = await db.select().from(appointments).where(and(eq(appointments.userId, id), gte(appointments.date, new Date()))).limit(5);
      if (upcomingAppts.length === 0 && alerts.length > 0) {
        suggestions.push({ action: "Schedule follow-up appointment", priority: "high", reason: "Active alerts with no upcoming appointments" });
      }

      res.json({
        patient: { id: patient.id, name: patient.name, email: patient.email },
        alerts: alerts.sort((a, b) => {
          const priority: Record<string, number> = { critical: 0, warning: 1, info: 2 };
          return (priority[a.type] ?? 3) - (priority[b.type] ?? 3);
        }),
        adherenceStats: {
          rate: adherenceRate,
          totalDoses,
          takenDoses,
          missedDoses,
          activeMedications: medSchedules.length,
        },
        journalSummary: {
          totalEntries: journalEntries.length,
          recentPainAvg: journalEntries.filter(e => e.painLevel !== null).length > 0
            ? Math.round(journalEntries.filter(e => e.painLevel !== null).reduce((sum, e) => sum + (e.painLevel as number), 0) / journalEntries.filter(e => e.painLevel !== null).length * 10) / 10
            : null,
          recentMoodAvg: journalEntries.filter(e => e.mood !== null).length > 0
            ? Math.round(journalEntries.filter(e => e.mood !== null).reduce((sum, e) => sum + (e.mood as number), 0) / journalEntries.filter(e => e.mood !== null).length * 10) / 10
            : null,
          frequentSymptoms: Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
        },
        suggestions,
        recordsSummary: {
          total: records.length,
          vitals: vitals.length,
          labs: labs.length,
          conditions: records.filter(r => r.type === "condition" || r.type === "visit").length,
          medications: records.filter(r => r.type === "medication").length,
        },
      });
    } catch (error) {
      console.error("[Portal] AI patient review error:", error);
      res.status(500).json({ error: "Failed to generate patient review" });
    }
  });

  // ============================================
  // AI Predictive Risk Analysis
  // ============================================

  router.post("/ai-assistant/predict-risks/:id", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;
      const orgPatientIds = await getOrgPatientIds(tenantId);
      if (!orgPatientIds.includes(id)) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const [patient] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const records = await db.select().from(healthRecords).where(eq(healthRecords.userId, id)).orderBy(desc(healthRecords.date)).limit(100);
      const medSchedules = await db.select().from(medicationSchedules).where(eq(medicationSchedules.userId, id));
      const journalEntries = await db.select().from(healthJournalEntries).where(eq(healthJournalEntries.userId, id)).orderBy(desc(healthJournalEntries.createdAt)).limit(30);

      const recordSummary = records.map(r => ({
        type: r.type,
        title: r.title,
        date: r.date,
        summary: r.summary,
      }));

      const journalSummary = journalEntries.map(e => ({
        type: e.entryType,
        mood: e.mood,
        painLevel: e.painLevel,
        energyLevel: e.energyLevel,
        symptoms: e.symptoms,
        date: e.entryDate,
      }));

      try {
        const completion = await chatComplete({
          model: "deep",
          messages: [
            {
              role: "system",
              content: `You are a clinical decision support AI assistant for healthcare providers. Analyze patient data to identify potential future health risks. You must NOT diagnose. Instead, flag patterns, trends, and risk factors that warrant clinical attention. This is for clinical decision support only, not a definitive diagnosis or medical advice.

Respond in JSON format with this structure:
{
  "riskPredictions": [
    {
      "riskArea": "string (e.g., Cardiovascular, Metabolic, Mental Health, Medication Safety)",
      "riskLevel": "low|medium|high|critical",
      "confidence": 0.0-1.0,
      "description": "string explaining the risk pattern",
      "supportingFactors": ["string array of data points supporting this prediction"],
      "recommendedActions": ["string array of clinical follow-up suggestions"],
      "timeframe": "string (e.g., 3-6 months, 1 year)"
    }
  ],
  "trendAnalysis": {
    "improving": ["string array of improving health areas"],
    "declining": ["string array of declining health areas"],
    "stable": ["string array of stable health areas"]
  },
  "prioritySummary": "string - brief executive summary for the provider"
}`
            },
            {
              role: "user",
              content: `Analyze this patient's data for potential future health risks:

Patient: ${patient.name}
Health Records (${records.length} total): ${JSON.stringify(recordSummary.slice(0, 30))}
Medications: ${JSON.stringify(medSchedules.map(m => ({ name: m.medicationName, dosage: m.dosage, frequency: m.frequency })))}
Recent Journal (${journalEntries.length} entries): ${JSON.stringify(journalSummary.slice(0, 15))}`
            },
          ],
          maxOutputTokens: 1500,
          temperature: 0.3,
          jsonMode: true,
      dataCategories: ["conditions","medications","lab_results","vitals","clinical_notes"],
      purpose: "clinical_decision_support",
      callerService: "portal-routes",
      callerMethod: "portalAi"});

        const analysis = JSON.parse(completion.content || "{}");

        if (analysis.riskPredictions && Array.isArray(analysis.riskPredictions)) {
          for (const pred of analysis.riskPredictions) {
            try {
              await db.insert(healthPredictions).values({
                userId: id,
                predictionType: pred.riskArea || "general",
                riskLevel: pred.riskLevel || "low",
                confidence: pred.confidence || 0.5,
                description: pred.description || "",
                factors: pred.supportingFactors || [],
                recommendations: pred.recommendedActions || [],
              });
            } catch {}
          }
        }

        res.json({
          patient: { id: patient.id, name: patient.name },
          analysis,
          generatedAt: new Date().toISOString(),
          dataPoints: {
            healthRecords: records.length,
            medications: medSchedules.length,
            journalEntries: journalEntries.length,
          },
          disclaimer: "AI-generated risk predictions for clinical decision support only. These predictions do not constitute a diagnosis. Clinical correlation and professional judgment are required.",
        });
      } catch (aiError: any) {
        const riskPredictions = [];
        const conditions = records.filter(r => r.type === "condition" || r.type === "visit");
        const medications = records.filter(r => r.type === "medication");
        const labs = records.filter(r => r.type === "lab_result" || r.type === "lab");

        if (conditions.length > 5) {
          riskPredictions.push({
            riskArea: "Multi-Morbidity",
            riskLevel: "medium",
            confidence: 0.6,
            description: `Patient has ${conditions.length} documented conditions, which may increase risk of drug interactions and care complexity.`,
            supportingFactors: [`${conditions.length} active conditions`, `${medications.length} medication records`],
            recommendedActions: ["Comprehensive medication review", "Care coordination assessment"],
            timeframe: "Ongoing",
          });
        }

        if (medSchedules.length > 4) {
          riskPredictions.push({
            riskArea: "Polypharmacy",
            riskLevel: "medium",
            confidence: 0.7,
            description: `Patient is on ${medSchedules.length} active medications. Consider reviewing for potential interactions.`,
            supportingFactors: medSchedules.map(m => m.medicationName),
            recommendedActions: ["Medication reconciliation", "Check for drug-drug interactions"],
            timeframe: "Next visit",
          });
        }

        const highPainEntries = journalEntries.filter(e => e.painLevel !== null && (e.painLevel as number) >= 6);
        if (highPainEntries.length >= 3) {
          riskPredictions.push({
            riskArea: "Chronic Pain",
            riskLevel: "medium",
            confidence: 0.65,
            description: `Patient has reported high pain levels (6+/10) on ${highPainEntries.length} occasions. May indicate inadequate pain management.`,
            supportingFactors: [`${highPainEntries.length} high pain journal entries`],
            recommendedActions: ["Pain management evaluation", "Consider referral to pain specialist"],
            timeframe: "1-3 months",
          });
        }

        res.json({
          patient: { id: patient.id, name: patient.name },
          analysis: {
            riskPredictions,
            trendAnalysis: { improving: [], declining: [], stable: ["Insufficient data for comprehensive trend analysis"] },
            prioritySummary: "Analysis generated using rule-based assessment. AI-powered analysis requires OpenAI configuration.",
          },
          generatedAt: new Date().toISOString(),
          dataPoints: { healthRecords: records.length, medications: medSchedules.length, journalEntries: journalEntries.length },
          note: "Rule-based analysis (AI unavailable)",
          disclaimer: "AI-generated risk predictions for clinical decision support only. These predictions do not constitute a diagnosis. Clinical correlation and professional judgment are required.",
        });
      }
    } catch (error) {
      console.error("[Portal] Predict risks error:", error);
      res.status(500).json({ error: "Failed to predict risks" });
    }
  });

  // ============================================
  // AI Assistant - System-Wide Alerts
  // ============================================

  router.get("/ai-assistant/alerts", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;
      const orgPatientIds = await getOrgPatientIds(tenantId);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
      const allAlerts: any[] = [];

      const highRiskPredictions = orgPatientIds.length > 0
        ? await db.select({
            id: healthPredictions.id,
            userId: healthPredictions.userId,
            type: healthPredictions.predictionType,
            riskLevel: healthPredictions.riskLevel,
            description: healthPredictions.description,
            confidence: healthPredictions.confidence,
            createdAt: healthPredictions.createdAt,
          }).from(healthPredictions)
            .where(and(
              or(eq(healthPredictions.riskLevel, "high"), eq(healthPredictions.riskLevel, "critical")),
              inArray(healthPredictions.userId, orgPatientIds)
            ))
            .orderBy(desc(healthPredictions.createdAt))
            .limit(20)
        : [];

      for (const pred of highRiskPredictions) {
        const [patient] = await db.select({ name: users.name }).from(users).where(eq(users.id, pred.userId)).limit(1);
        allAlerts.push({
          id: pred.id,
          type: pred.riskLevel === "critical" ? "critical" : "warning",
          category: "risk_prediction",
          patientId: pred.userId,
          patientName: patient?.name || "Unknown",
          message: pred.description,
          predictionType: pred.type,
          confidence: pred.confidence,
          date: pred.createdAt,
        });
      }

      const painEntries = orgPatientIds.length > 0
        ? await db.select().from(healthJournalEntries)
            .where(and(
              gte(healthJournalEntries.createdAt, thirtyDaysAgo),
              inArray(healthJournalEntries.userId, orgPatientIds)
            ))
            .orderBy(desc(healthJournalEntries.createdAt))
            .limit(100)
        : [];

      const painByPatient: Record<string, number> = {};
      const lowMoodByPatient: Record<string, number> = {};
      painEntries.forEach(e => {
        if (e.painLevel !== null && (e.painLevel as number) >= 7) {
          painByPatient[e.userId] = (painByPatient[e.userId] || 0) + 1;
        }
        if (e.mood !== null && (e.mood as number) <= 1) {
          lowMoodByPatient[e.userId] = (lowMoodByPatient[e.userId] || 0) + 1;
        }
      });

      for (const [userId, cnt] of Object.entries(painByPatient)) {
        if (cnt >= 3) {
          const [patient] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
          allAlerts.push({
            type: "warning",
            category: "pain_monitoring",
            patientId: userId,
            patientName: patient?.name || "Unknown",
            message: `Patient reported severe pain (7+/10) on ${cnt} occasions in the last 30 days`,
            date: new Date().toISOString(),
          });
        }
      }

      for (const [userId, cnt] of Object.entries(lowMoodByPatient)) {
        if (cnt >= 2) {
          const [patient] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
          allAlerts.push({
            type: "warning",
            category: "mental_health",
            patientId: userId,
            patientName: patient?.name || "Unknown",
            message: `Patient reported consistently low mood - depression screening recommended`,
            date: new Date().toISOString(),
          });
        }
      }

      res.json({
        alerts: allAlerts.sort((a, b) => {
          const priority: Record<string, number> = { critical: 0, warning: 1, info: 2 };
          return (priority[a.type] ?? 3) - (priority[b.type] ?? 3);
        }),
        totalAlerts: allAlerts.length,
        criticalCount: allAlerts.filter(a => a.type === "critical").length,
        warningCount: allAlerts.filter(a => a.type === "warning").length,
      });
    } catch (error) {
      console.error("[Portal] AI alerts error:", error);
      res.status(500).json({ error: "Failed to fetch AI alerts" });
    }
  });

  // ============================================
  // MEDICATION MANAGEMENT - PROVIDER ROUTES
  // ============================================

  router.get("/medications/provider/patient-summary/:patientId", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;
      const orgPatientIds = await getOrgPatientIds(tenantId);
      if (!orgPatientIds.includes(patientId)) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const meds = await db.select().from(medicationSchedules)
        .where(eq(medicationSchedules.userId, patientId));

      const since90 = new Date();
      since90.setDate(since90.getDate() - 90);
      const logs = await db.select().from(adherenceLogs)
        .where(and(eq(adherenceLogs.userId, patientId), gte(adherenceLogs.createdAt, since90)));

      const activeMeds = meds.filter(m => m.isActive);
      const inactiveMeds = meds.filter(m => !m.isActive);

      const medAdherence: any[] = [];
      for (const med of activeMeds) {
        const medLogs = logs.filter(l => l.scheduleId === med.id);
        const taken = medLogs.filter(l => l.status === "taken").length;
        const total = medLogs.length;
        const rate = total > 0 ? Math.round((taken / total) * 100) : 0;
        const missed = medLogs.filter(l => l.status === "missed").length;
        const skipped = medLogs.filter(l => l.status === "skipped").length;

        const last7 = new Date();
        last7.setDate(last7.getDate() - 7);
        const recentLogs = medLogs.filter(l => new Date(l.createdAt) >= last7);
        const recentTaken = recentLogs.filter(l => l.status === "taken").length;
        const recentTotal = recentLogs.length;
        const recentRate = recentTotal > 0 ? Math.round((recentTaken / recentTotal) * 100) : 0;

        let trend = "stable";
        if (recentRate > rate + 10) trend = "improving";
        else if (recentRate < rate - 10) trend = "declining";

        medAdherence.push({
          medicationId: med.id,
          medicationName: med.medicationName,
          dosage: med.dosage,
          frequency: med.frequency,
          startDate: med.startDate,
          adherenceRate90Day: rate,
          adherenceRate7Day: recentRate,
          trend,
          totalLogs: total,
          taken,
          missed,
          skipped,
          prescribedBy: med.prescribedBy,
        });
      }

      const overallTaken = logs.filter(l => l.status === "taken").length;
      const overallTotal = logs.length;
      const overallRate = overallTotal > 0 ? Math.round((overallTaken / overallTotal) * 100) : 0;

      const KNOWN_INTERACTIONS: Record<string, { interactsWith: string[]; severity: string; description: string }[]> = {
        "warfarin": [{ interactsWith: ["aspirin", "ibuprofen", "naproxen"], severity: "high", description: "Increased bleeding risk with NSAIDs and anticoagulants." }],
        "metformin": [{ interactsWith: ["alcohol"], severity: "high", description: "Increased lactic acidosis risk." }],
        "lisinopril": [{ interactsWith: ["potassium supplements", "spironolactone"], severity: "high", description: "Risk of dangerous hyperkalemia." }],
        "atorvastatin": [{ interactsWith: ["clarithromycin", "erythromycin", "gemfibrozil"], severity: "high", description: "Increased risk of rhabdomyolysis." }],
        "sertraline": [{ interactsWith: ["tramadol", "fentanyl"], severity: "high", description: "Risk of serotonin syndrome." }],
        "metoprolol": [{ interactsWith: ["verapamil", "diltiazem"], severity: "high", description: "Risk of severe bradycardia." }],
      };

      const medNames = activeMeds.map(m => m.medicationName.toLowerCase().trim());
      const interactions: any[] = [];
      for (let i = 0; i < medNames.length; i++) {
        const knownI = KNOWN_INTERACTIONS[medNames[i]];
        if (knownI) {
          for (const interaction of knownI) {
            for (let j = 0; j < medNames.length; j++) {
              if (i === j) continue;
              if (interaction.interactsWith.some(d => medNames[j].includes(d) || d.includes(medNames[j]))) {
                interactions.push({
                  drug1: activeMeds[i].medicationName,
                  drug2: activeMeds[j].medicationName,
                  severity: interaction.severity,
                  description: interaction.description,
                });
              }
            }
          }
        }
      }

      res.json({
        patientId,
        activeMedications: medAdherence,
        discontinuedMedications: inactiveMeds.map(m => ({
          medicationName: m.medicationName,
          dosage: m.dosage,
          startDate: m.startDate,
          endDate: m.endDate,
        })),
        overallAdherence: { rate: overallRate, totalLogs: overallTotal, period: "90 days" },
        drugInteractions: interactions,
        medicationCount: activeMeds.length,
        polypharmacyRisk: activeMeds.length >= 5 ? "high" : activeMeds.length >= 3 ? "moderate" : "low",
      });
    } catch (error) {
      console.error("[Portal] Medication summary error:", error);
      res.status(500).json({ error: "Failed to generate medication summary" });
    }
  });

  router.post("/medications/provider/ai-recommendations/:patientId", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;
      const orgPatientIds = await getOrgPatientIds(tenantId);
      if (!orgPatientIds.includes(patientId)) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const meds = await db.select().from(medicationSchedules)
        .where(and(eq(medicationSchedules.userId, patientId), eq(medicationSchedules.isActive, true)));

      const since90 = new Date();
      since90.setDate(since90.getDate() - 90);
      const logs = await db.select().from(adherenceLogs)
        .where(and(eq(adherenceLogs.userId, patientId), gte(adherenceLogs.createdAt, since90)));

      const healthRecs = await db.select().from(healthRecords)
        .where(eq(healthRecords.userId, patientId))
        .orderBy(desc(healthRecords.date))
        .limit(20);

      const journalEntries = await db.select().from(healthJournalEntries)
        .where(and(eq(healthJournalEntries.userId, patientId), gte(healthJournalEntries.createdAt, since90)))
        .orderBy(desc(healthJournalEntries.createdAt))
        .limit(15);

      const medDetails = meds.map(m => {
        const medLogs = logs.filter(l => l.scheduleId === m.id);
        const taken = medLogs.filter(l => l.status === "taken").length;
        const total = medLogs.length;
        return {
          name: m.medicationName,
          dosage: m.dosage,
          frequency: m.frequency,
          adherenceRate: total > 0 ? Math.round((taken / total) * 100) : 0,
          missedDoses: medLogs.filter(l => l.status === "missed").length,
        };
      });

      const conditions = healthRecs.filter(r => r.recordType === "condition").map(r => r.title);
      const symptoms = journalEntries.filter(e => e.symptoms).flatMap(e => (e.symptoms as string[]) || []);

      let recommendations: any;
      try {
        const response = await chatComplete({
          model: "deep",
          maxOutputTokens: 1200,
          messages: [
            { role: "system", content: "You are a clinical decision support system. Analyze medication data and generate evidence-based recommendations in JSON. Include adherence strategies, regimen adjustments, and monitoring suggestions. This is decision support only." },
            { role: "user", content: JSON.stringify({
              medications: medDetails,
              conditions: [...new Set(conditions)],
              symptoms: [...new Set(symptoms)].slice(0, 10),
              format: {
                effectivenessAssessment: "array of {medication, assessment, confidence, reasoning}",
                adherenceStrategies: "array of strategy strings",
                regimenSuggestions: "array of {suggestion, rationale, priority}",
                monitoringRecommendations: "array of recommendation strings",
                concerns: "array of concern strings",
                overallAssessment: "brief overall assessment string",
              }
            })},
          ],
          jsonMode: true,
      dataCategories: ["conditions","medications","lab_results","vitals","clinical_notes"],
      purpose: "clinical_decision_support",
      callerService: "portal-routes",
      callerMethod: "portalAi"});
        recommendations = JSON.parse(response.content || "{}");
      } catch {
        const lowAdherenceMeds = medDetails.filter(m => m.adherenceRate < 80);
        recommendations = {
          effectivenessAssessment: medDetails.map(m => ({
            medication: m.name,
            assessment: m.adherenceRate >= 80 ? "Adequate adherence supports effectiveness" : "Low adherence may impair benefit",
            confidence: "low",
            reasoning: "AI unavailable. Based on adherence data only.",
          })),
          adherenceStrategies: lowAdherenceMeds.length > 0
            ? [`Focus on: ${lowAdherenceMeds.map(m => m.name).join(", ")}`, "Consider simplifying regimen", "Explore barriers via motivational interviewing"]
            : ["Current adherence is adequate."],
          regimenSuggestions: meds.length >= 5 ? [{ suggestion: "Review for deprescribing", rationale: "Polypharmacy (5+ meds)", priority: "medium" }] : [],
          monitoringRecommendations: ["Review medication list at each visit", "Monitor for drug interactions"],
          concerns: lowAdherenceMeds.length > 0 ? [`${lowAdherenceMeds.length} med(s) below 80% adherence`] : [],
          overallAssessment: `Patient on ${meds.length} active medications. AI detailed analysis unavailable.`,
        };
      }

      res.json({
        patientId,
        generatedAt: new Date().toISOString(),
        recommendations,
        dataUsed: { medicationCount: meds.length, adherenceLogCount: logs.length, healthRecordCount: healthRecs.length, journalEntryCount: journalEntries.length, periodDays: 90 },
      });
    } catch (error) {
      console.error("[Portal] AI recommendations error:", error);
      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });

  router.post("/medications/check-interaction", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { newMedication } = req.body;
      const patientId = req.query.patientId as string;
      if (!newMedication || !patientId) {
        return res.status(400).json({ error: "newMedication and patientId required" });
      }

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;
      const orgPatientIds = await getOrgPatientIds(tenantId);
      if (!orgPatientIds.includes(patientId)) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const currentMeds = await db.select().from(medicationSchedules)
        .where(and(eq(medicationSchedules.userId, patientId), eq(medicationSchedules.isActive, true)));

      const KNOWN_INTERACTIONS: Record<string, { interactsWith: string[]; severity: string; description: string }[]> = {
        "warfarin": [
          { interactsWith: ["aspirin", "ibuprofen", "naproxen"], severity: "high", description: "Increased bleeding risk. NSAIDs + anticoagulants raise GI bleeding chance." },
          { interactsWith: ["amiodarone"], severity: "high", description: "Amiodarone inhibits warfarin metabolism, potentially dangerously elevating INR." },
        ],
        "metformin": [{ interactsWith: ["alcohol"], severity: "high", description: "Lactic acidosis risk with alcohol + metformin." }],
        "lisinopril": [
          { interactsWith: ["potassium supplements", "spironolactone"], severity: "high", description: "Hyperkalemia risk with ACE inhibitors + potassium agents." },
          { interactsWith: ["ibuprofen", "naproxen"], severity: "moderate", description: "NSAIDs reduce ACE inhibitor effectiveness." },
        ],
        "atorvastatin": [
          { interactsWith: ["clarithromycin", "erythromycin"], severity: "high", description: "Antibiotics inhibit statin metabolism, rhabdomyolysis risk." },
          { interactsWith: ["gemfibrozil"], severity: "high", description: "Fibrate + statin = increased rhabdomyolysis risk." },
        ],
        "sertraline": [
          { interactsWith: ["tramadol", "fentanyl"], severity: "high", description: "SSRI + opioid = serotonin syndrome risk." },
          { interactsWith: ["ibuprofen", "aspirin", "naproxen"], severity: "moderate", description: "SSRI + NSAID = increased bleeding risk." },
        ],
        "omeprazole": [{ interactsWith: ["clopidogrel"], severity: "high", description: "Omeprazole reduces clopidogrel effectiveness." }],
        "levothyroxine": [{ interactsWith: ["calcium supplements", "iron supplements"], severity: "moderate", description: "Reduce levothyroxine absorption. Separate by 4+ hours." }],
        "metoprolol": [{ interactsWith: ["verapamil", "diltiazem"], severity: "high", description: "Beta-blocker + calcium channel blocker = severe bradycardia risk." }],
      };

      const KNOWN_SIDE_EFFECTS: Record<string, { common: string[]; serious: string[]; watchFor: string[] }> = {
        "metformin": { common: ["Nausea", "Diarrhea", "Stomach upset"], serious: ["Lactic acidosis"], watchFor: ["Muscle pain", "Difficulty breathing"] },
        "lisinopril": { common: ["Dry cough", "Dizziness"], serious: ["Angioedema", "Hyperkalemia"], watchFor: ["Face swelling", "Difficulty breathing"] },
        "atorvastatin": { common: ["Muscle aches", "Headache"], serious: ["Rhabdomyolysis", "Liver damage"], watchFor: ["Dark urine", "Muscle weakness"] },
        "sertraline": { common: ["Nausea", "Insomnia", "Dry mouth"], serious: ["Serotonin syndrome"], watchFor: ["Agitation", "Rapid heartbeat"] },
        "warfarin": { common: ["Easy bruising"], serious: ["Major bleeding"], watchFor: ["Blood in urine/stool", "Severe headache"] },
        "omeprazole": { common: ["Headache", "Nausea"], serious: ["C. difficile infection"], watchFor: ["Severe diarrhea", "Bone pain"] },
        "metoprolol": { common: ["Fatigue", "Dizziness"], serious: ["Severe bradycardia"], watchFor: ["Slow pulse", "Shortness of breath"] },
        "amlodipine": { common: ["Ankle swelling", "Flushing"], serious: ["Severe hypotension"], watchFor: ["Severe swelling", "Chest pain"] },
        "levothyroxine": { common: ["Hair loss", "Headache"], serious: ["Heart palpitations"], watchFor: ["Rapid heartbeat", "Chest pain"] },
      };

      const newMedLower = newMedication.toLowerCase().trim();
      const interactions: any[] = [];

      const newMedInteractions = KNOWN_INTERACTIONS[newMedLower];
      if (newMedInteractions) {
        for (const existing of currentMeds) {
          const existingLower = existing.medicationName.toLowerCase().trim();
          for (const interaction of newMedInteractions) {
            if (interaction.interactsWith.some(d => existingLower.includes(d) || d.includes(existingLower))) {
              interactions.push({ existingMedication: existing.medicationName, newMedication, severity: interaction.severity, description: interaction.description });
            }
          }
        }
      }

      for (const existing of currentMeds) {
        const existingLower = existing.medicationName.toLowerCase().trim();
        const existingInteractions = KNOWN_INTERACTIONS[existingLower];
        if (existingInteractions) {
          for (const interaction of existingInteractions) {
            if (interaction.interactsWith.some(d => newMedLower.includes(d) || d.includes(newMedLower))) {
              const alreadyFound = interactions.some(i => i.existingMedication === existing.medicationName && i.description === interaction.description);
              if (!alreadyFound) {
                interactions.push({ existingMedication: existing.medicationName, newMedication, severity: interaction.severity, description: interaction.description });
              }
            }
          }
        }
      }

      res.json({
        newMedication,
        hasInteractions: interactions.length > 0,
        interactions,
        sideEffects: KNOWN_SIDE_EFFECTS[newMedLower] || null,
        currentMedicationCount: currentMeds.length,
      });
    } catch (error) {
      console.error("[Portal] Check interaction error:", error);
      res.status(500).json({ error: "Failed to check interactions" });
    }
  });

  // ============================================
  // ENHANCED AI ASSISTANT - Record Summary, Referral Letters, Differential Diagnosis
  // ============================================

  router.post("/ai-assistant/summarize-patient/:id", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;
      const orgPatientIds = await getOrgPatientIds(tenantId);
      if (!orgPatientIds.includes(id)) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const [patient] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!patient) return res.status(404).json({ error: "Patient not found" });

      const records = await db.select().from(healthRecords).where(eq(healthRecords.userId, id)).orderBy(desc(healthRecords.date)).limit(100);
      const meds = await db.select().from(medicationSchedules).where(and(eq(medicationSchedules.userId, id), eq(medicationSchedules.isActive, true)));
      const profile = await db.select().from(patientProfiles).where(eq(patientProfiles.userId, id)).limit(1);
      const predictions = await db.select().from(healthPredictions).where(eq(healthPredictions.userId, id)).orderBy(desc(healthPredictions.createdAt)).limit(10);
      const appts = await db.select().from(appointments).where(eq(appointments.userId, id)).orderBy(desc(appointments.scheduledAt)).limit(10);
      const journalEntries = await db.select().from(healthJournalEntries).where(eq(healthJournalEntries.userId, id)).orderBy(desc(healthJournalEntries.createdAt)).limit(15);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
      const scheduleIds = meds.map(s => s.id);
      const patientLogs = scheduleIds.length > 0
        ? await db.select().from(adherenceLogs).where(and(gte(adherenceLogs.createdAt, thirtyDaysAgo), inArray(adherenceLogs.scheduleId, scheduleIds))).limit(500)
        : [];
      const takenDoses = patientLogs.filter(l => l.status === "taken").length;
      const adherenceRate = patientLogs.length > 0 ? Math.round((takenDoses / patientLogs.length) * 100) : null;

      const conditions = records.filter(r => r.type === "condition" || r.type === "diagnosis");
      const vitals = records.filter(r => r.type === "vital");
      const labs = records.filter(r => r.type === "lab_result" || r.type === "lab");
      const medications = records.filter(r => r.type === "medication");
      const procedures = records.filter(r => r.type === "procedure");

      const patientDataSummary = {
        demographics: { name: patient.name, email: patient.email, profile: profile[0] || null },
        conditions: conditions.map(c => ({ title: c.title, date: c.date, source: c.source })),
        vitals: vitals.slice(0, 15).map(v => {
          let parsed: any = {};
          try { parsed = typeof v.data === "string" ? JSON.parse(v.data) : v.data || {}; } catch {}
          return { title: v.title, value: parsed.value || parsed.result, unit: parsed.unit, date: v.date };
        }),
        labs: labs.slice(0, 15).map(l => {
          let parsed: any = {};
          try { parsed = typeof l.data === "string" ? JSON.parse(l.data) : l.data || {}; } catch {}
          return { title: l.title, value: parsed.value || parsed.result, unit: parsed.unit, referenceRange: parsed.referenceRange, date: l.date };
        }),
        activeMedications: meds.map(m => ({ name: m.medicationName, dosage: m.dosage, frequency: m.frequency })),
        procedures: procedures.map(p => ({ title: p.title, date: p.date })),
        predictions: predictions.map(p => ({ title: p.title, riskLevel: p.riskLevel, confidence: p.confidence })),
        adherenceRate,
        recentAppointments: appts.map(a => ({ type: a.appointmentType, date: a.scheduledAt, status: a.status, provider: a.providerName })),
        journalHighlights: journalEntries.slice(0, 5).map(j => ({
          date: j.createdAt,
          painLevel: j.painLevel,
          mood: j.mood,
          symptoms: j.symptoms,
          notes: j.notes ? (j.notes as string).substring(0, 100) : null,
        })),
      };

      let aiSummary: any = null;
      try {
        const response = await chatComplete({
          model: "deep",
          maxOutputTokens: 2500,
          messages: [
            { role: "system", content: "You are a clinical documentation AI assistant for healthcare providers. Generate a comprehensive yet concise patient record summary suitable for a busy clinician. Include: demographics, active problem list, current medications with adherence info, recent vitals/labs with any concerning trends, recent procedures, risk predictions, and key journal/symptom highlights. Use clear clinical language. This is for clinical decision support only, not a definitive diagnosis or medical advice. Return valid JSON only." },
            { role: "user", content: `Generate a comprehensive patient summary for clinical use.\n\nPatient Data:\n${JSON.stringify(patientDataSummary, null, 1)}\n\nReturn JSON with keys: patientOverview (string - 1-2 sentence overview), activeProblemList (array of strings), medicationSummary (string with adherence info), vitalsSummary (string with trends), labsSummary (string with abnormalities), riskAssessment (string), recentActivity (string), clinicalConcerns (array of {concern, urgency, recommendation}), recommendedActions (array of strings).` },
          ],
          jsonMode: true,
      dataCategories: ["conditions","medications","lab_results","vitals","clinical_notes"],
      purpose: "clinical_decision_support",
      callerService: "portal-routes",
      callerMethod: "portalAi"});
        aiSummary = JSON.parse(response.content || "{}");
      } catch (aiErr) {
        aiSummary = {
          patientOverview: `${patient.name} has ${conditions.length} documented condition(s), ${meds.length} active medication(s), and ${records.length} health records on file.`,
          activeProblemList: conditions.map(c => c.title),
          medicationSummary: `${meds.length} active medications. ${adherenceRate !== null ? `30-day adherence rate: ${adherenceRate}%` : "No adherence data available."}`,
          vitalsSummary: vitals.length > 0 ? `${vitals.length} vital readings on record. Most recent: ${vitals[0]?.title} on ${vitals[0]?.date}` : "No recent vitals.",
          labsSummary: labs.length > 0 ? `${labs.length} lab results on record.` : "No recent labs.",
          riskAssessment: predictions.length > 0 ? `${predictions.filter(p => p.riskLevel === "high" || p.riskLevel === "critical").length} high/critical risk predictions identified.` : "No active risk predictions.",
          recentActivity: `${appts.length} recent appointments. ${journalEntries.length} journal entries.`,
          clinicalConcerns: [],
          recommendedActions: [],
          note: "AI analysis unavailable - structured summary provided.",
        };
      }

      res.json({
        patient: { id: patient.id, name: patient.name, email: patient.email },
        summary: aiSummary,
        dataPoints: {
          totalRecords: records.length,
          conditions: conditions.length,
          vitals: vitals.length,
          labs: labs.length,
          activeMedications: meds.length,
          procedures: procedures.length,
          predictions: predictions.length,
          appointments: appts.length,
          journalEntries: journalEntries.length,
        },
        generatedAt: new Date().toISOString(),
        disclaimer: "AI-generated clinical summary for decision support only. This does not constitute medical advice, diagnosis, or treatment. Review all data and apply professional clinical judgment.",
      });
    } catch (error) {
      console.error("[Portal] AI patient summary error:", error);
      res.status(500).json({ error: "Failed to generate patient summary" });
    }
  });

  router.post("/ai-assistant/draft-referral/:id", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { referralReason, specialtyTarget, urgency, additionalNotes } = req.body;

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;
      const orgPatientIds = await getOrgPatientIds(tenantId);
      if (!orgPatientIds.includes(id)) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const [patient] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!patient) return res.status(404).json({ error: "Patient not found" });

      const records = await db.select().from(healthRecords).where(eq(healthRecords.userId, id)).orderBy(desc(healthRecords.date)).limit(50);
      const meds = await db.select().from(medicationSchedules).where(and(eq(medicationSchedules.userId, id), eq(medicationSchedules.isActive, true)));
      const profile = await db.select().from(patientProfiles).where(eq(patientProfiles.userId, id)).limit(1);

      const conditions = records.filter(r => r.type === "condition" || r.type === "diagnosis");
      const labs = records.filter(r => r.type === "lab_result" || r.type === "lab");
      const vitals = records.filter(r => r.type === "vital");
      const procedures = records.filter(r => r.type === "procedure");

      const patientInfo = {
        name: patient.name,
        email: patient.email,
        profile: profile[0] || null,
        conditions: conditions.map(c => ({ title: c.title, date: c.date })),
        recentLabs: labs.slice(0, 10).map(l => {
          let parsed: any = {};
          try { parsed = typeof l.data === "string" ? JSON.parse(l.data) : l.data || {}; } catch {}
          return { title: l.title, value: parsed.value || parsed.result, unit: parsed.unit, date: l.date };
        }),
        recentVitals: vitals.slice(0, 5).map(v => {
          let parsed: any = {};
          try { parsed = typeof v.data === "string" ? JSON.parse(v.data) : v.data || {}; } catch {}
          return { title: v.title, value: parsed.value || parsed.result, unit: parsed.unit, date: v.date };
        }),
        activeMedications: meds.map(m => ({ name: m.medicationName, dosage: m.dosage, frequency: m.frequency })),
        procedures: procedures.map(p => ({ title: p.title, date: p.date })),
      };

      const providerReq = req as any;
      const referringProvider = providerReq.portalProvider?.name || "Provider";

      let referralLetter: any = null;
      try {
        const response = await chatComplete({
          model: "deep",
          maxOutputTokens: 2500,
          messages: [
            { role: "system", content: "You are a clinical documentation AI assistant for healthcare providers. Generate professional referral letters in standard medical format. The letter should be formal, comprehensive, and include all relevant clinical details. This is for clinical decision support only, not a definitive diagnosis or medical advice. Return valid JSON only." },
            { role: "user", content: `Draft a referral letter for the following patient.\n\nReferring Provider: ${referringProvider}\nReferral Reason: ${referralReason || "General consultation"}\nTarget Specialty: ${specialtyTarget || "Specialist"}\nUrgency: ${urgency || "routine"}\nAdditional Notes: ${additionalNotes || "None"}\n\nPatient Data:\n${JSON.stringify(patientInfo, null, 1)}\n\nReturn JSON with keys: letterText (full referral letter as a string with proper formatting and line breaks), summary (1-2 sentence summary of reason for referral), keyFindings (array of relevant clinical findings to highlight), urgencyJustification (string explaining urgency level), recommendedTests (array of any tests to be performed before or during specialist visit).` },
          ],
          jsonMode: true,
      dataCategories: ["conditions","medications","lab_results","vitals","clinical_notes"],
      purpose: "clinical_decision_support",
      callerService: "portal-routes",
      callerMethod: "portalAi"});
        referralLetter = JSON.parse(response.content || "{}");
      } catch (aiErr) {
        const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        referralLetter = {
          letterText: `Date: ${today}\n\nTo: ${specialtyTarget || "Specialist"}\nFrom: ${referringProvider}\nRe: Referral for ${patient.name}\n\nDear Colleague,\n\nI am writing to refer ${patient.name} for evaluation and management of ${referralReason || "the conditions detailed below"}.\n\nActive Conditions:\n${conditions.map(c => `- ${c.title} (${c.date})`).join("\n") || "- None documented"}\n\nCurrent Medications:\n${meds.map(m => `- ${m.medicationName} ${m.dosage} ${m.frequency}`).join("\n") || "- None documented"}\n\n${additionalNotes ? `Additional Notes: ${additionalNotes}\n\n` : ""}Thank you for your attention to this patient. Please do not hesitate to contact me if you need additional information.\n\nSincerely,\n${referringProvider}`,
          summary: `Referral to ${specialtyTarget || "specialist"} for ${referralReason || "evaluation"}.`,
          keyFindings: conditions.map(c => c.title),
          urgencyJustification: urgency === "urgent" ? "Patient requires prompt evaluation." : "Routine referral.",
          recommendedTests: [],
          note: "AI formatting unavailable - template letter provided.",
        };
      }

      res.json({
        patient: { id: patient.id, name: patient.name },
        referral: referralLetter,
        parameters: { referralReason, specialtyTarget, urgency, additionalNotes },
        generatedAt: new Date().toISOString(),
        disclaimer: "AI-drafted referral letter for clinical decision support. Review, verify all clinical details, and apply professional judgment before sending.",
      });
    } catch (error) {
      console.error("[Portal] AI referral draft error:", error);
      res.status(500).json({ error: "Failed to draft referral letter" });
    }
  });

  router.post("/ai-assistant/differential-diagnosis", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { patientId, symptoms, duration, severity, additionalContext } = req.body;
      if (!symptoms || symptoms.length === 0) {
        return res.status(400).json({ error: "At least one symptom is required" });
      }

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;

      let patientContext: any = null;
      if (patientId) {
        const orgPatientIds = await getOrgPatientIds(tenantId);
        if (!orgPatientIds.includes(patientId)) {
          return res.status(404).json({ error: "Patient not found" });
        }
        const [patient] = await db.select().from(users).where(eq(users.id, patientId)).limit(1);
        if (patient) {
          const records = await db.select().from(healthRecords).where(eq(healthRecords.userId, patientId)).orderBy(desc(healthRecords.date)).limit(30);
          const meds = await db.select().from(medicationSchedules).where(and(eq(medicationSchedules.userId, patientId), eq(medicationSchedules.isActive, true)));
          const profile = await db.select().from(patientProfiles).where(eq(patientProfiles.userId, patientId)).limit(1);

          const conditions = records.filter(r => r.type === "condition" || r.type === "diagnosis");
          const vitals = records.filter(r => r.type === "vital").slice(0, 5);
          const labs = records.filter(r => r.type === "lab_result" || r.type === "lab").slice(0, 10);

          patientContext = {
            name: patient.name,
            existingConditions: conditions.map(c => c.title),
            currentMedications: meds.map(m => ({ name: m.medicationName, dosage: m.dosage })),
            recentVitals: vitals.map(v => {
              let parsed: any = {};
              try { parsed = typeof v.data === "string" ? JSON.parse(v.data) : v.data || {}; } catch {}
              return { title: v.title, value: parsed.value || parsed.result, unit: parsed.unit };
            }),
            recentLabs: labs.map(l => {
              let parsed: any = {};
              try { parsed = typeof l.data === "string" ? JSON.parse(l.data) : l.data || {}; } catch {}
              return { title: l.title, value: parsed.value || parsed.result, unit: parsed.unit, referenceRange: parsed.referenceRange };
            }),
            profile: profile[0] ? { allergies: (profile[0] as any).allergies, familyHistory: (profile[0] as any).familyHistory } : null,
          };
        }
      }

      let differentialResult: any = null;
      try {
        const response = await chatComplete({
          model: "deep",
          maxOutputTokens: 3000,
          messages: [
            { role: "system", content: "You are a clinical decision support AI for healthcare providers. When given symptoms and patient context, provide a differential diagnosis list ranked by likelihood. This is ONLY for clinical decision support — not a definitive diagnosis. Always emphasize the need for clinical judgment and proper diagnostic workup. Return valid JSON only." },
            { role: "user", content: `Generate a differential diagnosis based on the following:\n\nPresenting Symptoms: ${symptoms.join(", ")}\nDuration: ${duration || "Not specified"}\nSeverity: ${severity || "Not specified"}\nAdditional Context: ${additionalContext || "None"}\n${patientContext ? `\nPatient History:\n- Existing conditions: ${patientContext.existingConditions.join(", ") || "None"}\n- Current medications: ${patientContext.currentMedications.map((m: any) => m.name).join(", ") || "None"}\n- Recent vitals: ${JSON.stringify(patientContext.recentVitals)}\n- Recent labs: ${JSON.stringify(patientContext.recentLabs)}` : ""}\n\nReturn JSON with keys: differentialDiagnoses (array of {diagnosis, likelihood ('high'|'moderate'|'low'), reasoning, keyFeatures (array), redFlags (array), icd10 (string)}), recommendedWorkup (array of {test, rationale, priority ('immediate'|'routine'|'if_indicated')}), criticalConsiderations (array of strings — urgent conditions to rule out), clinicalPearls (array of strings — practical clinical tips), emergencyFlags (array of strings — symptoms requiring immediate action).` },
          ],
          jsonMode: true,
      dataCategories: ["conditions","medications","lab_results","vitals","clinical_notes"],
      purpose: "clinical_decision_support",
      callerService: "portal-routes",
      callerMethod: "portalAi"});
        differentialResult = JSON.parse(response.content || "{}");
      } catch (aiErr) {
        differentialResult = {
          differentialDiagnoses: [],
          recommendedWorkup: [{ test: "Complete Blood Count (CBC)", rationale: "Baseline screening", priority: "routine" }, { test: "Basic Metabolic Panel (BMP)", rationale: "Assess metabolic status", priority: "routine" }],
          criticalConsiderations: ["Consider urgent conditions requiring immediate evaluation based on symptom severity."],
          clinicalPearls: ["AI analysis unavailable. Clinical correlation with presenting symptoms and patient history is essential."],
          emergencyFlags: severity === "severe" ? ["Severe symptoms reported — consider emergency evaluation if clinically warranted."] : [],
          note: "AI differential diagnosis unavailable — please perform manual clinical assessment.",
        };
      }

      res.json({
        symptoms,
        duration,
        severity,
        patientContext: patientContext ? { name: patientContext.name, existingConditions: patientContext.existingConditions, medicationCount: patientContext.currentMedications.length } : null,
        differential: differentialResult,
        generatedAt: new Date().toISOString(),
        disclaimer: "This differential diagnosis is generated by AI for clinical decision support only. It does not replace clinical judgment, physical examination, or definitive diagnostic testing. Always use professional medical judgment.",
      });
    } catch (error) {
      console.error("[Portal] AI differential diagnosis error:", error);
      res.status(500).json({ error: "Failed to generate differential diagnosis" });
    }
  });

  // ============================================
  // AI REPORTING ENGINE
  // ============================================

  const REPORT_TYPES = [
    { id: "high-risk-patients", label: "High-Risk Patient Identification", description: "Identify patients at elevated risk for specific conditions based on health records, predictions, and vital trends." },
    { id: "adherence-trends", label: "Clinic-Wide Adherence Trends", description: "Analyze medication adherence patterns across the patient population with trend analysis and outlier detection." },
    { id: "proactive-outreach", label: "Proactive Outreach Candidates", description: "Identify patients who may benefit from proactive care outreach based on gaps in care, missed appointments, and declining metrics." },
    { id: "condition-prevalence", label: "Condition Prevalence Analysis", description: "Break down the prevalence of conditions across the patient population with demographic correlations." },
    { id: "medication-utilization", label: "Medication Utilization Report", description: "Analyze medication prescribing patterns, polypharmacy rates, and drug interaction prevalence across the clinic." },
    { id: "appointment-analytics", label: "Appointment Analytics", description: "Review appointment completion rates, no-show patterns, and scheduling efficiency across providers and time periods." },
    { id: "custom", label: "Custom AI Report", description: "Generate a custom report by describing what you need in natural language. AI will query and analyze relevant data." },
  ];

  router.get("/reports/types", requirePortalAuth, (_req: Request, res: Response) => {
    res.json(REPORT_TYPES);
  });

  router.post("/reports/generate", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { reportType, parameters } = req.body;
      if (!reportType) {
        return res.status(400).json({ error: "reportType is required" });
      }

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;

      const orgPatientIds = await getOrgPatientIds(tenantId);

      const timeRange = parameters?.timeRange || 90;
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - timeRange);
      const condition = parameters?.condition || null;
      const customPrompt = parameters?.customPrompt || null;

      const allUsers = orgPatientIds.length > 0
        ? await db.select({
            id: users.id,
            name: users.name,
            email: users.email,
            createdAt: users.createdAt,
          }).from(users).where(inArray(users.id, orgPatientIds))
        : [];

      let reportData: any = {};
      let aiPrompt = "";

      switch (reportType) {
        case "high-risk-patients": {
          const orgFilter = orgPatientIds.length > 0;
          const records = orgFilter ? await db.select().from(healthRecords).where(and(gte(healthRecords.createdAt, sinceDate), inArray(healthRecords.userId, orgPatientIds))) : [];
          const predictions = orgFilter ? await db.select().from(healthPredictions).where(and(gte(healthPredictions.createdAt, sinceDate), inArray(healthPredictions.userId, orgPatientIds))) : [];
          const meds = orgFilter ? await db.select().from(medicationSchedules).where(inArray(medicationSchedules.userId, orgPatientIds)) : [];

          const patientRiskMap: Record<string, { name: string; riskFactors: string[]; conditions: string[]; medCount: number; predictions: any[] }> = {};

          for (const user of allUsers) {
            patientRiskMap[user.id] = { name: user.name, riskFactors: [], conditions: [], medCount: 0, predictions: [] };
          }

          for (const record of records) {
            if (patientRiskMap[record.userId]) {
              if (record.type === "condition") {
                patientRiskMap[record.userId].conditions.push(record.title);
                if (condition && record.title.toLowerCase().includes(condition.toLowerCase())) {
                  patientRiskMap[record.userId].riskFactors.push(`Diagnosed: ${record.title}`);
                }
              }
            }
          }

          for (const pred of predictions) {
            if (patientRiskMap[pred.userId] && (pred.riskLevel === "high" || pred.riskLevel === "critical")) {
              patientRiskMap[pred.userId].predictions.push({ title: pred.title, risk: pred.riskLevel, confidence: pred.confidence });
              patientRiskMap[pred.userId].riskFactors.push(`${pred.riskLevel} risk: ${pred.title}`);
            }
          }

          for (const med of meds) {
            if (patientRiskMap[med.userId]) {
              patientRiskMap[med.userId].medCount++;
              if (patientRiskMap[med.userId].medCount >= 5) {
                if (!patientRiskMap[med.userId].riskFactors.includes("Polypharmacy (5+ medications)")) {
                  patientRiskMap[med.userId].riskFactors.push("Polypharmacy (5+ medications)");
                }
              }
            }
          }

          const highRiskPatients = Object.entries(patientRiskMap)
            .filter(([, v]) => v.riskFactors.length > 0)
            .sort((a, b) => b[1].riskFactors.length - a[1].riskFactors.length)
            .slice(0, 50)
            .map(([id, v]) => ({ patientId: id, ...v }));

          reportData = {
            totalPatients: allUsers.length,
            highRiskCount: highRiskPatients.length,
            filterCondition: condition || "All conditions",
            timeRangeDays: timeRange,
            patients: highRiskPatients,
          };

          aiPrompt = `Analyze this high-risk patient data and generate a clinical summary report. ${condition ? `Focus on patients at risk for: ${condition}.` : ""}\n\nData:\n- Total patients: ${allUsers.length}\n- High-risk identified: ${highRiskPatients.length}\n- Time range: ${timeRange} days\n- Top risk factors: ${highRiskPatients.slice(0, 10).map(p => `${p.name}: ${p.riskFactors.join(", ")}`).join("; ")}\n\nProvide: 1) Executive summary 2) Key findings 3) Risk distribution analysis 4) Recommended interventions 5) Follow-up priorities. Format as structured JSON with keys: executiveSummary, keyFindings (array), riskDistribution (object), interventions (array of {target, action, priority}), followUpPriorities (array).`;
          break;
        }

        case "adherence-trends": {
          const orgFilter2 = orgPatientIds.length > 0;
          const logs = orgFilter2 ? await db.select().from(adherenceLogs).where(and(gte(adherenceLogs.createdAt, sinceDate), inArray(adherenceLogs.userId, orgPatientIds))) : [];
          const schedules = orgFilter2 ? await db.select().from(medicationSchedules).where(and(eq(medicationSchedules.isActive, true), inArray(medicationSchedules.userId, orgPatientIds))) : [];

          const totalLogs = logs.length;
          const taken = logs.filter(l => l.status === "taken").length;
          const missed = logs.filter(l => l.status === "missed").length;
          const skipped = logs.filter(l => l.status === "skipped").length;
          const overallRate = totalLogs > 0 ? Math.round((taken / totalLogs) * 100) : 0;

          const weeklyBreakdown: Record<string, { taken: number; missed: number; skipped: number; total: number }> = {};
          for (const log of logs) {
            const week = new Date(log.createdAt);
            const weekStart = new Date(week.setDate(week.getDate() - week.getDay()));
            const key = weekStart.toISOString().split("T")[0];
            if (!weeklyBreakdown[key]) weeklyBreakdown[key] = { taken: 0, missed: 0, skipped: 0, total: 0 };
            weeklyBreakdown[key].total++;
            if (log.status === "taken") weeklyBreakdown[key].taken++;
            else if (log.status === "missed") weeklyBreakdown[key].missed++;
            else if (log.status === "skipped") weeklyBreakdown[key].skipped++;
          }

          const patientAdherence: Record<string, { name: string; taken: number; total: number; rate: number }> = {};
          for (const log of logs) {
            if (!patientAdherence[log.userId]) {
              const user = allUsers.find(u => u.id === log.userId);
              patientAdherence[log.userId] = { name: user?.name || "Unknown", taken: 0, total: 0, rate: 0 };
            }
            patientAdherence[log.userId].total++;
            if (log.status === "taken") patientAdherence[log.userId].taken++;
          }
          Object.values(patientAdherence).forEach(p => { p.rate = p.total > 0 ? Math.round((p.taken / p.total) * 100) : 0; });

          const lowAdherence = Object.entries(patientAdherence).filter(([, v]) => v.rate < 80).sort((a, b) => a[1].rate - b[1].rate);

          const medAdherence: Record<string, { name: string; taken: number; total: number }> = {};
          for (const log of logs) {
            const sched = schedules.find(s => s.id === log.scheduleId);
            if (sched) {
              if (!medAdherence[sched.medicationName]) medAdherence[sched.medicationName] = { name: sched.medicationName, taken: 0, total: 0 };
              medAdherence[sched.medicationName].total++;
              if (log.status === "taken") medAdherence[sched.medicationName].taken++;
            }
          }

          reportData = {
            timeRangeDays: timeRange,
            overallAdherenceRate: overallRate,
            totalLogs,
            taken,
            missed,
            skipped,
            activeMedicationCount: schedules.length,
            patientsTracked: Object.keys(patientAdherence).length,
            weeklyTrend: Object.entries(weeklyBreakdown).sort((a, b) => a[0].localeCompare(b[0])).map(([week, data]) => ({ week, ...data, rate: data.total > 0 ? Math.round((data.taken / data.total) * 100) : 0 })),
            lowAdherencePatients: lowAdherence.slice(0, 20).map(([id, v]) => ({ patientId: id, ...v })),
            medicationBreakdown: Object.values(medAdherence).map(m => ({ ...m, rate: m.total > 0 ? Math.round((m.taken / m.total) * 100) : 0 })).sort((a, b) => a.rate - b.rate),
          };

          aiPrompt = `Analyze clinic-wide medication adherence data and produce a trend report.\n\nData:\n- Overall adherence: ${overallRate}%\n- Total logs: ${totalLogs} (taken: ${taken}, missed: ${missed}, skipped: ${skipped})\n- Patients tracked: ${Object.keys(patientAdherence).length}\n- Low adherence patients (<80%): ${lowAdherence.length}\n- Weekly trend: ${JSON.stringify(reportData.weeklyTrend.slice(-8))}\n\nProvide: 1) Executive summary 2) Trend analysis 3) At-risk patients summary 4) Medication-specific insights 5) Improvement recommendations. Format as structured JSON with keys: executiveSummary, trendAnalysis, atRiskSummary, medicationInsights (array), improvements (array of {recommendation, impact, effort}).`;
          break;
        }

        case "proactive-outreach": {
          const orgFilter3 = orgPatientIds.length > 0;
          const recentAppointments = orgFilter3 ? await db.select().from(appointments).where(and(gte(appointments.scheduledAt, sinceDate), inArray(appointments.userId, orgPatientIds))) : [];
          const logs = orgFilter3 ? await db.select().from(adherenceLogs).where(and(gte(adherenceLogs.createdAt, sinceDate), inArray(adherenceLogs.userId, orgPatientIds))) : [];
          const records = orgFilter3 ? await db.select().from(healthRecords).where(and(gte(healthRecords.createdAt, sinceDate), inArray(healthRecords.userId, orgPatientIds))) : [];
          const meds = orgFilter3 ? await db.select().from(medicationSchedules).where(and(eq(medicationSchedules.isActive, true), inArray(medicationSchedules.userId, orgPatientIds))) : [];

          const outreachCandidates: any[] = [];

          for (const user of allUsers) {
            const reasons: string[] = [];
            let urgency = "low";

            const userAppts = recentAppointments.filter(a => a.userId === user.id);
            const noShows = userAppts.filter(a => a.status === "no_show");
            const cancelled = userAppts.filter(a => a.status === "cancelled");
            if (noShows.length >= 2) { reasons.push(`${noShows.length} no-show appointments`); urgency = "high"; }
            else if (noShows.length === 1) { reasons.push("1 missed appointment"); urgency = "moderate"; }
            if (cancelled.length >= 3) reasons.push(`${cancelled.length} cancelled appointments`);

            const userLogs = logs.filter(l => l.userId === user.id);
            const userTaken = userLogs.filter(l => l.status === "taken").length;
            const userTotal = userLogs.length;
            const adherenceRate = userTotal > 0 ? Math.round((userTaken / userTotal) * 100) : -1;
            if (adherenceRate >= 0 && adherenceRate < 60) { reasons.push(`Very low adherence: ${adherenceRate}%`); urgency = "high"; }
            else if (adherenceRate >= 60 && adherenceRate < 80) { reasons.push(`Below-target adherence: ${adherenceRate}%`); if (urgency === "low") urgency = "moderate"; }

            const userMeds = meds.filter(m => m.userId === user.id);
            if (userMeds.length >= 5) reasons.push(`Polypharmacy: ${userMeds.length} active medications`);

            const overdue = userMeds.filter(m => m.refillDate && new Date(m.refillDate) < new Date());
            if (overdue.length > 0) reasons.push(`${overdue.length} overdue refill(s)`);

            const userRecords = records.filter(r => r.userId === user.id);
            const recentConditions = userRecords.filter(r => r.type === "condition");
            if (recentConditions.length === 0 && userRecords.length === 0 && userAppts.length === 0) {
              reasons.push("No recent clinical activity");
              if (urgency === "low") urgency = "moderate";
            }

            if (reasons.length > 0) {
              outreachCandidates.push({
                patientId: user.id,
                name: user.name,
                urgency,
                reasons,
                adherenceRate: adherenceRate >= 0 ? adherenceRate : null,
                appointmentHistory: { total: userAppts.length, noShows: noShows.length, cancelled: cancelled.length },
                activeMedications: userMeds.length,
              });
            }
          }

          outreachCandidates.sort((a, b) => {
            const urgencyOrder: Record<string, number> = { high: 0, moderate: 1, low: 2 };
            return (urgencyOrder[a.urgency] || 2) - (urgencyOrder[b.urgency] || 2);
          });

          reportData = {
            totalPatients: allUsers.length,
            outreachCount: outreachCandidates.length,
            highUrgency: outreachCandidates.filter(c => c.urgency === "high").length,
            moderateUrgency: outreachCandidates.filter(c => c.urgency === "moderate").length,
            lowUrgency: outreachCandidates.filter(c => c.urgency === "low").length,
            timeRangeDays: timeRange,
            candidates: outreachCandidates.slice(0, 50),
          };

          aiPrompt = `Analyze proactive outreach candidate data and generate an outreach strategy report.\n\nData:\n- Total patients: ${allUsers.length}\n- Outreach candidates: ${outreachCandidates.length}\n- High urgency: ${reportData.highUrgency}, Moderate: ${reportData.moderateUrgency}, Low: ${reportData.lowUrgency}\n- Top candidates: ${JSON.stringify(outreachCandidates.slice(0, 10).map(c => ({ name: c.name, urgency: c.urgency, reasons: c.reasons })))}\n\nProvide: 1) Executive summary 2) Urgency breakdown 3) Outreach strategies by urgency tier 4) Specific patient action items 5) Expected outcomes. Format as structured JSON with keys: executiveSummary, urgencyBreakdown (object), strategies (array of {tier, approach, timeline}), actionItems (array of {patient, action, priority}), expectedOutcomes (array).`;
          break;
        }

        case "condition-prevalence": {
          const records = orgPatientIds.length > 0
            ? await db.select().from(healthRecords).where(and(eq(healthRecords.type, "condition"), inArray(healthRecords.userId, orgPatientIds)))
            : [];

          const conditionCounts: Record<string, { count: number; patients: Set<string> }> = {};
          for (const r of records) {
            const key = r.title.toLowerCase().trim();
            if (!conditionCounts[key]) conditionCounts[key] = { count: 0, patients: new Set() };
            conditionCounts[key].count++;
            conditionCounts[key].patients.add(r.userId);
          }

          const conditions = Object.entries(conditionCounts)
            .map(([name, data]) => ({ condition: name, recordCount: data.count, patientCount: data.patients.size, prevalenceRate: allUsers.length > 0 ? Math.round((data.patients.size / allUsers.length) * 100) : 0 }))
            .sort((a, b) => b.patientCount - a.patientCount)
            .slice(0, 50);

          reportData = {
            totalPatients: allUsers.length,
            totalConditionRecords: records.length,
            uniqueConditions: Object.keys(conditionCounts).length,
            topConditions: conditions,
          };

          aiPrompt = `Analyze condition prevalence data and generate a population health report.\n\nData:\n- Total patients: ${allUsers.length}\n- Unique conditions: ${Object.keys(conditionCounts).length}\n- Top conditions: ${JSON.stringify(conditions.slice(0, 15))}\n\nProvide: 1) Executive summary 2) Prevalence analysis 3) Comorbidity insights 4) Population health recommendations 5) Resource planning suggestions. Format as structured JSON with keys: executiveSummary, prevalenceAnalysis, comorbidityInsights (array), recommendations (array of {recommendation, rationale, priority}), resourcePlanning (array).`;
          break;
        }

        case "medication-utilization": {
          const orgFilter4 = orgPatientIds.length > 0;
          const allMeds = orgFilter4 ? await db.select().from(medicationSchedules).where(inArray(medicationSchedules.userId, orgPatientIds)) : [];
          const logs = orgFilter4 ? await db.select().from(adherenceLogs).where(and(gte(adherenceLogs.createdAt, sinceDate), inArray(adherenceLogs.userId, orgPatientIds))) : [];

          const medCounts: Record<string, { count: number; patients: Set<string>; active: number }> = {};
          for (const med of allMeds) {
            const key = med.medicationName.toLowerCase().trim();
            if (!medCounts[key]) medCounts[key] = { count: 0, patients: new Set(), active: 0 };
            medCounts[key].count++;
            medCounts[key].patients.add(med.userId);
            if (med.isActive) medCounts[key].active++;
          }

          const patientMedCounts: Record<string, number> = {};
          for (const med of allMeds.filter(m => m.isActive)) {
            patientMedCounts[med.userId] = (patientMedCounts[med.userId] || 0) + 1;
          }
          const polypharmacyCount = Object.values(patientMedCounts).filter(c => c >= 5).length;
          const avgMedsPerPatient = Object.keys(patientMedCounts).length > 0 ? (Object.values(patientMedCounts).reduce((a, b) => a + b, 0) / Object.keys(patientMedCounts).length).toFixed(1) : "0";

          reportData = {
            totalPrescriptions: allMeds.length,
            activePrescriptions: allMeds.filter(m => m.isActive).length,
            uniqueMedications: Object.keys(medCounts).length,
            patientsOnMedication: Object.keys(patientMedCounts).length,
            polypharmacyPatients: polypharmacyCount,
            averageMedsPerPatient: parseFloat(avgMedsPerPatient),
            timeRangeDays: timeRange,
            totalAdherenceLogs: logs.length,
            topMedications: Object.entries(medCounts).map(([name, data]) => ({ medication: name, totalPrescriptions: data.count, uniquePatients: data.patients.size, activePrescriptions: data.active })).sort((a, b) => b.uniquePatients - a.uniquePatients).slice(0, 30),
          };

          aiPrompt = `Analyze medication utilization data and generate a pharmacy report.\n\nData:\n- Total prescriptions: ${allMeds.length} (active: ${reportData.activePrescriptions})\n- Unique medications: ${reportData.uniqueMedications}\n- Polypharmacy patients: ${polypharmacyCount}\n- Avg meds/patient: ${avgMedsPerPatient}\n- Top meds: ${JSON.stringify(reportData.topMedications.slice(0, 10))}\n\nProvide: 1) Executive summary 2) Prescribing pattern analysis 3) Polypharmacy assessment 4) Formulary optimization suggestions 5) Cost-saving opportunities. Format as structured JSON with keys: executiveSummary, prescribingPatterns, polypharmacyAssessment, formularyOptimization (array of {suggestion, rationale}), costSavings (array).`;
          break;
        }

        case "appointment-analytics": {
          const appts = orgPatientIds.length > 0
            ? await db.select().from(appointments).where(and(gte(appointments.scheduledAt, sinceDate), inArray(appointments.userId, orgPatientIds)))
            : [];

          const total = appts.length;
          const completed = appts.filter(a => a.status === "completed").length;
          const noShows = appts.filter(a => a.status === "no_show").length;
          const cancelled = appts.filter(a => a.status === "cancelled").length;
          const scheduled = appts.filter(a => a.status === "scheduled" || a.status === "confirmed").length;

          const byType: Record<string, number> = {};
          for (const a of appts) { byType[a.appointmentType] = (byType[a.appointmentType] || 0) + 1; }

          const byProvider: Record<string, { total: number; completed: number; noShows: number }> = {};
          for (const a of appts) {
            const prov = a.providerName || "Unassigned";
            if (!byProvider[prov]) byProvider[prov] = { total: 0, completed: 0, noShows: 0 };
            byProvider[prov].total++;
            if (a.status === "completed") byProvider[prov].completed++;
            if (a.status === "no_show") byProvider[prov].noShows++;
          }

          reportData = {
            totalAppointments: total,
            completed,
            noShows,
            cancelled,
            upcoming: scheduled,
            completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
            noShowRate: total > 0 ? Math.round((noShows / total) * 100) : 0,
            cancellationRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
            timeRangeDays: timeRange,
            byType: Object.entries(byType).map(([type, ct]) => ({ type, count: ct })).sort((a, b) => b.count - a.count),
            byProvider: Object.entries(byProvider).map(([provider, data]) => ({ provider, ...data, completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0 })),
          };

          aiPrompt = `Analyze appointment data and generate a scheduling efficiency report.\n\nData:\n- Total: ${total}, Completed: ${completed}, No-shows: ${noShows}, Cancelled: ${cancelled}\n- Completion rate: ${reportData.completionRate}%, No-show rate: ${reportData.noShowRate}%\n- Types: ${JSON.stringify(reportData.byType)}\n- Providers: ${JSON.stringify(reportData.byProvider)}\n\nProvide: 1) Executive summary 2) Scheduling efficiency analysis 3) No-show pattern insights 4) Provider utilization 5) Improvement recommendations. Format as structured JSON with keys: executiveSummary, efficiencyAnalysis, noShowInsights, providerUtilization (array), improvements (array of {recommendation, expectedImpact}).`;
          break;
        }

        case "custom": {
          if (!customPrompt) {
            return res.status(400).json({ error: "customPrompt is required for custom reports" });
          }

          const orgFilter5 = orgPatientIds.length > 0;
          const records = orgFilter5 ? await db.select().from(healthRecords).where(and(gte(healthRecords.createdAt, sinceDate), inArray(healthRecords.userId, orgPatientIds))) : [];
          const appts = orgFilter5 ? await db.select().from(appointments).where(and(gte(appointments.scheduledAt, sinceDate), inArray(appointments.userId, orgPatientIds))) : [];
          const meds = orgFilter5 ? await db.select().from(medicationSchedules).where(inArray(medicationSchedules.userId, orgPatientIds)) : [];
          const logs = orgFilter5 ? await db.select().from(adherenceLogs).where(and(gte(adherenceLogs.createdAt, sinceDate), inArray(adherenceLogs.userId, orgPatientIds))) : [];

          const conditionTypes: Record<string, number> = {};
          const recordTypes: Record<string, number> = {};
          for (const r of records) {
            recordTypes[r.type] = (recordTypes[r.type] || 0) + 1;
            if (r.type === "condition") conditionTypes[r.title] = (conditionTypes[r.title] || 0) + 1;
          }

          reportData = {
            totalPatients: allUsers.length,
            timeRangeDays: timeRange,
            healthRecords: { total: records.length, byType: recordTypes },
            appointments: { total: appts.length, completed: appts.filter(a => a.status === "completed").length, noShows: appts.filter(a => a.status === "no_show").length },
            medications: { total: meds.length, active: meds.filter(m => m.isActive).length },
            adherence: { totalLogs: logs.length, taken: logs.filter(l => l.status === "taken").length },
            topConditions: Object.entries(conditionTypes).sort((a, b) => b[1] - a[1]).slice(0, 10),
          };

          aiPrompt = `You are a healthcare data analyst. The provider has requested a custom report:\n\n"${customPrompt}"\n\nAvailable data summary (last ${timeRange} days):\n- ${allUsers.length} patients\n- ${records.length} health records (types: ${JSON.stringify(recordTypes)})\n- ${appts.length} appointments (${appts.filter(a => a.status === "completed").length} completed, ${appts.filter(a => a.status === "no_show").length} no-shows)\n- ${meds.length} medications (${meds.filter(m => m.isActive).length} active)\n- ${logs.length} adherence logs (${logs.filter(l => l.status === "taken").length} taken)\n- Top conditions: ${JSON.stringify(Object.entries(conditionTypes).sort((a, b) => b[1] - a[1]).slice(0, 10))}\n\nGenerate a comprehensive report addressing the provider's request. Format as structured JSON with keys: executiveSummary, findings (array of {finding, detail, significance}), analysis, recommendations (array of {recommendation, rationale, priority}), limitations (array).`;
          break;
        }

        default:
          return res.status(400).json({ error: "Invalid report type" });
      }

      let aiAnalysis: any = null;
      try {
        const response = await chatComplete({
          model: "deep",
          maxOutputTokens: 2000,
          messages: [
            { role: "system", content: "You are a healthcare analytics AI assistant generating clinical and operational reports for healthcare providers. Always produce actionable, evidence-informed insights. This is for clinical decision support only, not direct patient care. Return valid JSON only." },
            { role: "user", content: aiPrompt },
          ],
          jsonMode: true,
      dataCategories: ["conditions","medications","lab_results","vitals","clinical_notes"],
      purpose: "clinical_decision_support",
      callerService: "portal-routes",
      callerMethod: "portalAi"});
        aiAnalysis = JSON.parse(response.content || "{}");
      } catch (aiError) {
        aiAnalysis = {
          executiveSummary: "AI analysis temporarily unavailable. Raw data has been compiled for manual review.",
          error: "AI service could not generate analysis. Please review the raw data below.",
        };
      }

      res.json({
        reportType,
        generatedAt: new Date().toISOString(),
        parameters: { timeRange, condition, customPrompt },
        data: reportData,
        aiAnalysis,
      });
    } catch (error) {
      console.error("[Portal] Report generation error:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  // ============================================
  // Clinical Decision Support Routes
  // ============================================

  router.post("/cds/analyze", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { patientId, symptoms, medications, conditions, labResults, visitType, chiefComplaint, context } = req.body;
      if (!patientId) {
        return res.status(400).json({ error: "patientId is required" });
      }

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;
      const orgPatientIds = await getOrgPatientIds(tenantId);
      if (!orgPatientIds.includes(patientId)) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const result = await clinicalDecisionSupportService.analyzePatient({
        patientId,
        symptoms,
        medications,
        conditions,
        labResults,
        visitType,
        chiefComplaint,
        context: context || "general",
      });
      res.json(result);
    } catch (error) {
      console.error("[CDS] Analysis error:", error);
      res.status(500).json({ error: "Clinical decision support analysis failed" });
    }
  });

  router.post("/cds/drug-interactions", requirePortalAuth, async (req: Request, res: Response) => {
    try {
      const { medications } = req.body;
      if (!medications || !Array.isArray(medications) || medications.length < 2) {
        return res.status(400).json({ error: "At least 2 medications are required for interaction checking" });
      }
      const result = await clinicalDecisionSupportService.quickDrugCheck(medications);
      res.json(result);
    } catch (error) {
      console.error("[CDS] Drug interaction check error:", error);
      res.status(500).json({ error: "Drug interaction check failed" });
    }
  });

  router.get("/cds/preventive-care/:patientId", requirePortalAuth, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;

      const tenantId = await getRequestTenantId(req, res);
      if (!tenantId) return;
      const orgPatientIds = await getOrgPatientIds(tenantId);
      if (!orgPatientIds.includes(patientId)) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const gaps = await clinicalDecisionSupportService.getPreventiveCareRecommendations(patientId);
      res.json({ patientId, gaps });
    } catch (error) {
      console.error("[CDS] Preventive care error:", error);
      res.status(500).json({ error: "Failed to get preventive care recommendations" });
    }
  });

  app.use("/api/portal", router);

  if (process.env.NODE_ENV !== "production") {
    seedDemoAdmin();
  }
}
