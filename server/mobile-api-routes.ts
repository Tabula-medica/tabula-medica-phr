import type { Express, Request, Response, RequestHandler } from "express";
import { randomBytes, createHash, scryptSync, timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";
import { logger } from "./utils/logger";
import { authStorage } from "./replit_integrations/auth/storage";
import { storage } from "./storage";
import { db } from "./db";
import { phiDb, decryptPhiRows } from "./storage/phi-storage";
import {
  mobileOnboardingProgress,
  profiles,
  medicationsTable,
  allergiesTable,
  medicalHistoryTable,
  vaccinesTable,
  surgeriesTable,
  vitalSignsTable,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { verifyAndResolveGcip } from "./auth/gcip";
import { recordLoginAndNotify } from "./replit_integrations/auth/replitAuth";

const JWT_ISSUER = "tabula-medica";
const JWT_AUDIENCE = "tabula-medica-mobile";

// HIPAA compliance: we have NO BAA with Auth0, so the mobile auth surface
// is GCIP-only. The previous Auth0 JWKS fetcher, Auth0 token verifier,
// `/api/mobile/auth/config` Auth0-config disclosure endpoint, and
// `/api/mobile/auth/auth0` token-exchange endpoint have all been removed.
// Mobile clients authenticate via Firebase/GCIP and exchange the resulting
// ID token at POST /api/mobile/auth/gcip/session.

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  sessionId?: string;
}

const NO_CDS_COMPLIANCE = {
  disclaimer: "This information is for reference only and does not constitute medical advice.",
  notForClinicalDecisionMaking: true,
  generatedAt: new Date().toISOString(),
};

function getJwtSecret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("[MobileAPI] SESSION_SECRET must be set in production. Refusing to sign tokens with a hardcoded fallback key.");
  }
  return "tabula-medica-jwt-secret-dev-only";
}

function createJWT(payload: { id: string; email: string; name: string; role: string }, expiresInHours = 24): string {
  return jwt.sign(
    { id: payload.id, email: payload.email, name: payload.name, role: payload.role },
    getJwtSecret(),
    { algorithm: "HS256", expiresIn: `${expiresInHours}h`, issuer: JWT_ISSUER, audience: JWT_AUDIENCE, notBefore: 0 }
  );
}

function verifyJWT(token: string): { valid: boolean; payload?: jwt.JwtPayload } {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as jwt.JwtPayload;
    return { valid: true, payload: decoded };
  } catch {
    return { valid: false };
  }
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  const hash = scryptSync(password, salt, 64);
  const storedBuffer = Buffer.from(storedHash, "hex");
  if (hash.length !== storedBuffer.length) return false;
  return timingSafeEqual(hash, storedBuffer);
}


async function authMiddleware(req: AuthenticatedRequest, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized", message: "Missing or invalid token" });
  }
  
  const token = authHeader.slice(7);
  
  const localResult = verifyJWT(token);
  if (localResult.valid && localResult.payload) {
    req.user = {
      id: localResult.payload.id as string,
      email: localResult.payload.email as string,
      name: localResult.payload.name as string,
      role: localResult.payload.role as string,
    };
    return next();
  }

  // GCIP path: verifies the Firebase ID token, then either auto-links an
  // existing user by verified email or transactionally provisions a new
  // one. This is the only remote-IdP path on the mobile auth surface;
  // Auth0 has been removed (no BAA, HIPAA).
  const gcipUser = await verifyAndResolveGcip(token);
  if (gcipUser) {
    req.user = {
      id: gcipUser.id,
      email: gcipUser.email || "",
      name:
        [gcipUser.firstName, gcipUser.lastName].filter(Boolean).join(" ") ||
        gcipUser.email ||
        "",
      role: "patient",
    };
    console.log(`[MobileAuth] verified provider=gcip user=${gcipUser.id}`);
    return next();
  }

  return res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
}

// Legacy auth middleware kept for backward compatibility
function legacyAuthCheck(req: AuthenticatedRequest, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized", message: "Missing or invalid token" });
  }
  
  const token = authHeader.slice(7);
  const result = verifyJWT(token);
  
  if (!result.valid || !result.payload) {
    return res.status(401).json({ error: "Unauthorized", message: "Invalid or expired token" });
  }
  
  req.user = {
    id: result.payload.id as string,
    email: result.payload.email as string,
    name: result.payload.name as string,
    role: result.payload.role as string,
  };
  next();
}

// In-memory stores for MVP (replace with database in production)
const packetJobs = new Map<string, {
  id: string;
  userId: string;
  status: "pending" | "processing" | "completed" | "failed";
  options: Record<string, boolean>;
  pdfUrl?: string;
  createdAt: Date;
  completedAt?: Date;
}>();

const shareLinks = new Map<string, {
  id: string;
  userId: string;
  url: string;
  accessCode?: string;
  expiresAt: Date;
  includeConditions: boolean;
  includeMedications: boolean;
  includeLabResults: boolean;
  createdAt: Date;
  revokedAt?: Date;
}>();

function logAudit(userId: string, action: string, resourceType: string, resourceId: string) {
  logger.audit(action, { userId, resourceType, resourceId, outcome: "success" });
}

// Resolve the caller's PHR profile id from their account (GCIP user) id. Records
// live in the phr_* tables keyed by profileId; the account owns the profile.
// Mirrors getProfileId() in patient-health-record-routes.ts. Returns null when
// the user has no profile yet (brand-new account).
async function resolveProfileId(userId: string): Promise<string | null> {
  const rows = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.accountId, userId)).limit(1);
  return rows.length ? rows[0].id : null;
}

export function registerMobileApiRoutes(app: Express) {
  // GET /api/mobile/auth/config and POST /api/mobile/auth/auth0 were
  // removed: mobile no longer supports Auth0 SSO (no BAA with Auth0,
  // HIPAA). The mobile client must use Firebase/GCIP sign-in and call
  // POST /api/mobile/auth/gcip/session to mint a local session.
  //
  // Any older app build that still hits these paths will get a 410 from
  // the express default 404 handler; that is acceptable — the app will
  // be force-upgraded via the store before reviewers / patients can use
  // it on production.

  // ============================================
  // POST /api/mobile/auth/login — REMOVED. The hard-coded reviewer demo
  // credentials backdoor was retired as part of the GCIP-only cutover.
  // All mobile sign-ins (including App Store reviewers) must now go
  // through /api/mobile/auth/gcip/session with a real Firebase/GCIP ID
  // token. Provide reviewer access via a dedicated GCIP account, not a
  // shared password.
  // ============================================

  // ============================================
  // POST /api/mobile/auth/gcip/session - Mobile equivalent of the web's
  // /api/auth/gcip/session handoff. Verifies a Firebase/GCIP ID token
  // (Authorization: Bearer <token>), records the login for security audit,
  // and returns the internal user + onboarding status. Mobile does NOT
  // need a session cookie — subsequent API calls continue to authenticate
  // via the same bearer token through the GCIP branch of authMiddleware,
  // so the client only needs to call this once right after a successful
  // Firebase sign-in (Google, Apple, or email/password).
  // ============================================
  app.post("/api/mobile/auth/gcip/session", (async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized", message: "Missing bearer token" });
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ error: "Unauthorized", message: "Missing bearer token" });
    }

    try {
      const internalUser = await verifyAndResolveGcip(token);
      if (!internalUser) {
        return res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
      }

      try {
        await recordLoginAndNotify(internalUser.id, req, {
          platform: "mobile",
          provider: "gcip",
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[MobileAuth] Failed to record GCIP login:", msg);
      }

      // Default to `null` (unknown) on lookup failure so the client can decide
      // whether to retry or fall back, instead of silently sending the user to
      // the dashboard and skipping onboarding on transient storage errors.
      let needsOnboarding: boolean | null = null;
      try {
        const onboardingStatus = await storage.getOnboardingStatus(internalUser.id);
        needsOnboarding = !onboardingStatus?.hasCompletedOnboarding;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[MobileAuth] Failed to read onboarding status:", msg);
      }

      const name =
        [internalUser.firstName, internalUser.lastName].filter(Boolean).join(" ") ||
        internalUser.email ||
        "Patient";

      console.log(
        `[HIPAA-AUDIT][MobileAuth] GCIP_SESSION userId=${internalUser.id} platform=mobile`
      );

      return res.json({
        user: {
          id: internalUser.id,
          email: internalUser.email || "",
          name,
          role: "patient",
        },
        needsOnboarding,
      });
    } catch (err: any) {
      console.error("[MobileAuth] GCIP session exchange error:", err?.message);
      return res.status(500).json({ error: "Session exchange failed" });
    }
  }) as RequestHandler);

  // ============================================
  // POST /api/mobile/auth/logout - Mobile logout
  // ============================================
  app.post("/api/mobile/auth/logout", authMiddleware as RequestHandler, ((req: AuthenticatedRequest, res: Response) => {
    logAudit(req.user?.id || "unknown", "LOGOUT", "auth", req.user?.id || "unknown");
    return res.json({ success: true, message: "Logged out successfully" });
  }) as RequestHandler);

  // ============================================
  // GET /api/me - Get current user profile
  // ============================================
  app.get("/api/me", authMiddleware as RequestHandler, ((req: AuthenticatedRequest, res: Response) => {
    logAudit(req.user!.id, "VIEW_PROFILE", "user", req.user!.id);

    return res.json({
      id: req.user!.id,
      email: req.user!.email,
      name: req.user!.name,
      role: req.user!.role,
      noCdsCompliance: NO_CDS_COMPLIANCE,
    });
  }) as RequestHandler);

  // ============================================
  // GET /api/records/summary - Health records summary
  // ============================================
  // Representative fallback used when an account has no records yet (new users
  // and the App Review demo account) so the mobile screen is never empty.
  // Real accounts with data get their own records computed below.
  const SAMPLE_SUMMARY = () => ({
    conditions: { total: 5, active: 3, resolved: 2 },
    medications: { total: 8, active: 6, stopped: 2 },
    labResults: { total: 24, recent: 5, abnormal: 2 },
    vitals: { lastRecorded: new Date().toISOString(), recentCount: 12 },
    immunizations: { total: 15, upToDate: true },
    appointments: { upcoming: 2, past: 18 },
    lastUpdated: new Date().toISOString(),
  });
  const SAMPLE_TIMELINE = () => ([
    { id: "event-1", type: "encounter", title: "Annual Physical Exam", description: "Routine wellness check", date: new Date(Date.now() - 7 * 864e5).toISOString(), provider: "Dr. Sarah Johnson" },
    { id: "event-2", type: "observation", title: "Blood Pressure Reading", description: "120/80 mmHg - Normal", date: new Date(Date.now() - 7 * 864e5).toISOString(), provider: "Dr. Sarah Johnson" },
    { id: "event-3", type: "medication", title: "Lisinopril 10mg Started", description: "For blood pressure management", date: new Date(Date.now() - 30 * 864e5).toISOString(), provider: "Dr. Michael Chen" },
    { id: "event-4", type: "condition", title: "Hypertension Diagnosed", description: "Stage 1 Essential Hypertension", date: new Date(Date.now() - 30 * 864e5).toISOString(), provider: "Dr. Michael Chen" },
    { id: "event-5", type: "procedure", title: "Complete Blood Count", description: "Routine lab work", date: new Date(Date.now() - 45 * 864e5).toISOString(), provider: "Quest Diagnostics" },
  ]);

  app.get("/api/records/summary", authMiddleware as RequestHandler, (async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user!.id;
    logAudit(uid, "VIEW_RECORDS_SUMMARY", "patient_summary", uid);
    try {
      const profileId = await resolveProfileId(uid);
      if (!profileId) return res.json({ ...SAMPLE_SUMMARY(), isSample: true, noCdsCompliance: NO_CDS_COMPLIANCE });
      const [meds, allergies, conditions, vaccines, surgeries, vitals] = await Promise.all([
        decryptPhiRows("medicationsTable", await phiDb.select().from(medicationsTable).where(eq(medicationsTable.profileId, profileId))),
        decryptPhiRows("allergiesTable", await phiDb.select().from(allergiesTable).where(eq(allergiesTable.profileId, profileId))),
        decryptPhiRows("medicalHistoryTable", await phiDb.select().from(medicalHistoryTable).where(eq(medicalHistoryTable.profileId, profileId))),
        decryptPhiRows("vaccinesTable", await phiDb.select().from(vaccinesTable).where(eq(vaccinesTable.profileId, profileId))),
        decryptPhiRows("surgeriesTable", await phiDb.select().from(surgeriesTable).where(eq(surgeriesTable.profileId, profileId))),
        phiDb.select().from(vitalSignsTable).where(eq(vitalSignsTable.profileId, profileId)).orderBy(desc(vitalSignsTable.recordedAt)),
      ]);
      const total = meds.length + allergies.length + conditions.length + vaccines.length + surgeries.length + vitals.length;
      // No real records yet -> representative preview (keeps the screen populated).
      if (!total) return res.json({ ...SAMPLE_SUMMARY(), isSample: true, noCdsCompliance: NO_CDS_COMPLIANCE });
      const activeMeds = meds.filter((m: any) => m.status === "active");
      const activeConds = conditions.filter((c: any) => (c.status || "active") === "active");
      const summary = {
        conditions: { total: conditions.length, active: activeConds.length, resolved: conditions.filter((c: any) => c.status === "resolved").length },
        medications: { total: meds.length, active: activeMeds.length, stopped: meds.length - activeMeds.length },
        labResults: { total: 0, recent: 0, abnormal: 0 },
        vitals: { lastRecorded: (vitals[0] as any)?.recordedAt ?? null, recentCount: vitals.length },
        immunizations: { total: vaccines.length, upToDate: true },
        allergies: { total: allergies.length },
        appointments: { upcoming: 0, past: 0 },
        lastUpdated: new Date().toISOString(),
      };
      return res.json({ ...summary, isSample: false, noCdsCompliance: NO_CDS_COMPLIANCE });
    } catch (err) {
      logger.error("[MobileAPI] records/summary failed", { err: (err as Error).message });
      return res.json({ ...SAMPLE_SUMMARY(), isSample: true, noCdsCompliance: NO_CDS_COMPLIANCE });
    }
  }) as RequestHandler);

  // ============================================
  // GET /api/records/timeline - Health timeline
  // ============================================
  app.get("/api/records/timeline", authMiddleware as RequestHandler, (async (req: AuthenticatedRequest, res: Response) => {
    const uid = req.user!.id;
    const limit = Number((req.query.limit as string) || "50");
    const offset = Number((req.query.offset as string) || "0");
    logAudit(uid, "VIEW_TIMELINE", "timeline", uid);
    let events: Array<{ id: string; type: string; title: string; description: string; date: any; provider: string }> = [];
    try {
      const profileId = await resolveProfileId(uid);
      if (profileId) {
        const [meds, conditions, vaccines, surgeries, vitals] = await Promise.all([
          decryptPhiRows("medicationsTable", await phiDb.select().from(medicationsTable).where(eq(medicationsTable.profileId, profileId))),
          decryptPhiRows("medicalHistoryTable", await phiDb.select().from(medicalHistoryTable).where(eq(medicalHistoryTable.profileId, profileId))),
          decryptPhiRows("vaccinesTable", await phiDb.select().from(vaccinesTable).where(eq(vaccinesTable.profileId, profileId))),
          decryptPhiRows("surgeriesTable", await phiDb.select().from(surgeriesTable).where(eq(surgeriesTable.profileId, profileId))),
          phiDb.select().from(vitalSignsTable).where(eq(vitalSignsTable.profileId, profileId)).orderBy(desc(vitalSignsTable.recordedAt)),
        ]);
        for (const m of meds as any[]) events.push({ id: "med-" + m.id, type: "medication", title: [m.name, m.dose].filter(Boolean).join(" "), description: m.frequency || "", date: m.startDate || m.createdAt, provider: "" });
        for (const c of conditions as any[]) events.push({ id: "cond-" + c.id, type: "condition", title: c.condition, description: c.notes || "", date: c.diagnosedDate || c.createdAt, provider: c.treatedBy || "" });
        for (const v of vaccines as any[]) events.push({ id: "vac-" + v.id, type: "observation", title: v.vaccineName || "Vaccine", description: "Immunization", date: v.dateAdministered || v.createdAt, provider: v.provider || "" });
        for (const s of surgeries as any[]) events.push({ id: "surg-" + s.id, type: "procedure", title: s.procedureName, description: s.facility || "", date: s.surgeryDate || s.createdAt, provider: s.surgeon || "" });
        for (const vt of vitals as any[]) events.push({ id: "vit-" + vt.id, type: "observation", title: `${vt.vitalType}: ${vt.value}${vt.unit ? " " + vt.unit : ""}`, description: "", date: vt.recordedAt, provider: vt.source || "" });
        events = events.filter((e) => e.date).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
    } catch (err) {
      logger.error("[MobileAPI] records/timeline failed", { err: (err as Error).message });
      events = [];
    }
    const isSample = events.length === 0;
    if (isSample) events = SAMPLE_TIMELINE();
    const page = events.slice(offset, offset + limit);
    return res.json({
      events: page,
      total: events.length,
      hasMore: events.length > offset + limit,
      isSample,
      noCdsCompliance: NO_CDS_COMPLIANCE,
    });
  }) as RequestHandler);

  // ============================================
  // POST /api/packets - Create PDF packet job
  // ============================================
  app.post("/api/packets", authMiddleware as RequestHandler, ((req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { includeConditions = true, includeMedications = true, includeLabResults = true, includeVitals = true, includeImmunizations = true, includeProcedures = true } = req.body;

    const jobId = `packet-${randomBytes(12).toString("hex")}`;
    const job = {
      id: jobId,
      userId,
      status: "pending" as const,
      options: { includeConditions, includeMedications, includeLabResults, includeVitals, includeImmunizations, includeProcedures },
      createdAt: new Date(),
    };

    packetJobs.set(jobId, job);

    // Simulate async PDF generation
    setTimeout(() => {
      const existingJob = packetJobs.get(jobId);
      if (existingJob) {
        existingJob.status = "completed";
        existingJob.pdfUrl = `/api/packets/${jobId}/download`;
        existingJob.completedAt = new Date();
      }
    }, 3000);

    logAudit(userId, "CREATE_PACKET", "pdf_packet", jobId);

    return res.status(201).json({ id: jobId, status: "pending", estimatedCompletionTime: "30 seconds", noCdsCompliance: NO_CDS_COMPLIANCE });
  }) as RequestHandler);

  // ============================================
  // GET /api/packets/:id - Get packet job status
  // ============================================
  app.get("/api/packets/:id", authMiddleware as RequestHandler, ((req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const job = packetJobs.get(id);

    if (!job) {
      return res.status(404).json({ error: "Packet job not found" });
    }
    if (job.userId !== req.user!.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json({
      id: job.id,
      status: job.status,
      pdfUrl: job.pdfUrl,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      noCdsCompliance: NO_CDS_COMPLIANCE,
    });
  }) as RequestHandler);

  // ============================================
  // GET /api/packets/:id/download - Download PDF
  // ============================================
  app.get("/api/packets/:id/download", authMiddleware as RequestHandler, ((req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const job = packetJobs.get(id);

    if (!job) {
      return res.status(404).json({ error: "Packet not found" });
    }
    if (job.userId !== req.user!.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (job.status !== "completed") {
      return res.status(400).json({ error: "Packet not ready", status: job.status });
    }

    logAudit(req.user!.id, "DOWNLOAD_PACKET", "pdf_packet", id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="health-records-${id}.pdf"`);
    
    const placeholderPdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
      "3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n" +
      "xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000101 00000 n\n" +
      "trailer<</Size 4/Root 1 0 R>>\nstartxref\n163\n%%EOF"
    );
    
    return res.send(placeholderPdf);
  }) as RequestHandler);

  // ============================================
  // POST /api/share-links - Create share link
  // ============================================
  app.post("/api/share-links", authMiddleware as RequestHandler, ((req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { expiresInHours = 24, includeConditions = true, includeMedications = true, includeLabResults = true } = req.body;

    const linkId = `share-${randomBytes(12).toString("hex")}`;
    const accessCode = randomBytes(3).toString("hex").toUpperCase();
    const token = randomBytes(32).toString("hex");
    
    const shareLink = {
      id: linkId,
      userId,
      url: `${process.env.APP_URL || "https://tabulamedica.digital"}/shared/${token}`,
      accessCode,
      expiresAt: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
      includeConditions,
      includeMedications,
      includeLabResults,
      createdAt: new Date(),
    };

    shareLinks.set(linkId, shareLink);
    logAudit(userId, "CREATE_SHARE_LINK", "share_link", linkId);

    return res.status(201).json({
      id: linkId,
      url: shareLink.url,
      accessCode: shareLink.accessCode,
      expiresAt: shareLink.expiresAt.toISOString(),
      noCdsCompliance: NO_CDS_COMPLIANCE,
    });
  }) as RequestHandler);

  // ============================================
  // GET /api/share-links - List user's share links
  // ============================================
  app.get("/api/share-links", authMiddleware as RequestHandler, ((req: AuthenticatedRequest, res: Response) => {
    const userLinks: Array<{
      id: string;
      url: string;
      accessCode?: string;
      expiresAt: string;
      isExpired: boolean;
      createdAt: string;
    }> = [];

    shareLinks.forEach((link) => {
      if (link.userId === req.user!.id && !link.revokedAt) {
        userLinks.push({
          id: link.id,
          url: link.url,
          accessCode: link.accessCode,
          expiresAt: link.expiresAt.toISOString(),
          isExpired: link.expiresAt < new Date(),
          createdAt: link.createdAt.toISOString(),
        });
      }
    });

    return res.json({ links: userLinks, noCdsCompliance: NO_CDS_COMPLIANCE });
  }) as RequestHandler);

  // ============================================
  // DELETE /api/share-links/:id - Revoke share link
  // ============================================
  app.delete("/api/share-links/:id", authMiddleware as RequestHandler, ((req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const link = shareLinks.get(id);

    if (!link) {
      return res.status(404).json({ error: "Share link not found" });
    }
    if (link.userId !== req.user!.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    link.revokedAt = new Date();
    shareLinks.set(id, link);
    logAudit(req.user!.id, "REVOKE_SHARE_LINK", "share_link", id);

    return res.json({ success: true, message: "Share link revoked", noCdsCompliance: NO_CDS_COMPLIANCE });
  }) as RequestHandler);

  // ============================================
  // GET /api/dashboard - Mobile dashboard data
  // ============================================
  app.get("/api/dashboard", authMiddleware as RequestHandler, ((req: AuthenticatedRequest, res: Response) => {
    const dashboard = {
      upcomingAppointments: 2,
      activeMedications: 6,
      recentConditions: 3,
      unreadMessages: 1,
      recentLabs: 5,
      lastSync: new Date().toISOString(),
    };

    logAudit(req.user!.id, "VIEW_DASHBOARD", "dashboard", req.user!.id);

    return res.json({ ...dashboard, noCdsCompliance: NO_CDS_COMPLIANCE });
  }) as RequestHandler);

  // ============================================
  // GET /api/fhir/timeline - FHIR timeline for mobile
  // ============================================
  app.get("/api/fhir/timeline", authMiddleware as RequestHandler, ((req: AuthenticatedRequest, res: Response) => {
    const events = [
      { id: "fhir-event-1", type: "encounter", title: "Annual Physical Exam", description: "Routine wellness check", date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), provider: "Dr. Sarah Johnson" },
      { id: "fhir-event-2", type: "observation", title: "Blood Pressure", description: "120/80 mmHg", date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), provider: "Dr. Sarah Johnson" },
      { id: "fhir-event-3", type: "medication", title: "Lisinopril 10mg", description: "Started for hypertension", date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), provider: "Dr. Michael Chen" },
    ];

    return res.json(events);
  }) as RequestHandler);

  // ============================================
  // SMART on FHIR Integration Routes
  // ============================================

  const SMART_FHIR_SCOPES = [
    "openid", "fhirUser", "launch/patient",
    "patient/Patient.read", "patient/Observation.read",
    "patient/MedicationRequest.read", "patient/Condition.read",
    "patient/Encounter.read", "patient/Immunization.read",
    "patient/AllergyIntolerance.read", "patient/Procedure.read",
    "patient/DiagnosticReport.read", "patient/DocumentReference.read",
  ];

  const ehrProviders = [
    {
      id: "fastenhealth",
      name: "Fasten Health",
      fhirBaseUrl: "https://api.fastenhealth.com/fhir/R4",
      authorizationEndpoint: "https://api.fastenhealth.com/oauth/authorize",
      tokenEndpoint: "https://api.fastenhealth.com/oauth/token",
      clientId: process.env.FASTEN_HEALTH_CLIENT_ID || "tabula-medica-app",
      scopes: SMART_FHIR_SCOPES,
      icon: "hospital",
      supportsDiscovery: false,
    },
    {
      id: "epic",
      name: "Epic MyChart",
      fhirBaseUrl: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
      authorizationEndpoint: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize",
      tokenEndpoint: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token",
      clientId: process.env.EPIC_CLIENT_ID || "",
      scopes: SMART_FHIR_SCOPES,
      icon: "heart-pulse",
      supportsDiscovery: true,
    },
    {
      id: "ecw",
      name: "eClinicalWorks",
      fhirBaseUrl: "https://fhir4.eclinicalworks.com/fhir/r4/IJCEAI",
      authorizationEndpoint: "https://oauthserver.eclinicalworks.com/oauth/authorize",
      tokenEndpoint: "https://oauthserver.eclinicalworks.com/oauth/token",
      clientId: process.env.ECW_CLIENT_ID || "",
      scopes: SMART_FHIR_SCOPES,
      icon: "clipboard-list",
      supportsDiscovery: true,
    },
    {
      id: "athena",
      name: "athenahealth",
      fhirBaseUrl: "https://api.platform.athenahealth.com/fhir/r4",
      authorizationEndpoint: "https://api.platform.athenahealth.com/oauth2/v1/authorize",
      tokenEndpoint: "https://api.platform.athenahealth.com/oauth2/v1/token",
      clientId: process.env.ATHENA_CLIENT_ID || "",
      scopes: SMART_FHIR_SCOPES,
      icon: "stethoscope",
      supportsDiscovery: true,
    },
    {
      id: "meditech",
      name: "MEDITECH Expanse",
      fhirBaseUrl: "https://fhir.meditech.com/explorer/r4",
      authorizationEndpoint: "https://fhir.meditech.com/oauth/authorize",
      tokenEndpoint: "https://fhir.meditech.com/oauth/token",
      clientId: process.env.MEDITECH_CLIENT_ID || "",
      scopes: SMART_FHIR_SCOPES,
      icon: "building-2",
      supportsDiscovery: true,
    },
    {
      id: "smart-sandbox",
      name: "SMART Health IT Sandbox",
      fhirBaseUrl: "https://launch.smarthealthit.org/v/r4/fhir",
      authorizationEndpoint: "https://launch.smarthealthit.org/v/r4/auth/authorize",
      tokenEndpoint: "https://launch.smarthealthit.org/v/r4/auth/token",
      clientId: "tabula_medica_sandbox",
      scopes: [...SMART_FHIR_SCOPES, "offline_access"],
      icon: "flask",
      supportsDiscovery: false,
    },
  ];

  async function discoverSmartEndpoints(fhirBaseUrl: string): Promise<{ authorizationEndpoint: string; tokenEndpoint: string } | null> {
    try {
      const base = fhirBaseUrl.endsWith("/") ? fhirBaseUrl : fhirBaseUrl + "/";
      const resp = await fetch(`${base}.well-known/smart-configuration`);
      if (!resp.ok) return null;
      const config = await resp.json() as { authorization_endpoint?: string; token_endpoint?: string };
      if (config.authorization_endpoint && config.token_endpoint) {
        return { authorizationEndpoint: config.authorization_endpoint, tokenEndpoint: config.token_endpoint };
      }
      return null;
    } catch {
      return null;
    }
  }

  // In-memory stores for PKCE sessions and imported resources
  const pkceSessions = new Map<string, {
    state: string;
    codeVerifier: string;
    providerId: string;
    userId: string;
    redirectUri: string;
    createdAt: Date;
    expiresAt: Date;
    used: boolean;
  }>();

  const ehrConnections = new Map<string, {
    id: string;
    userId: string;
    providerId: string;
    providerName: string;
    accessToken: string;
    refreshToken?: string;
    patientId?: string;
    expiresAt: Date;
    connectedAt: Date;
    lastSyncAt?: Date;
  }>();

  const importedResources = new Map<string, {
    id: string;
    userId: string;
    connectionId: string;
    resourceType: string;
    fhirId: string;
    data: Record<string, unknown>;
    provenance: {
      source: string;
      importedAt: string;
      sourcePatientId: string;
      sourceVersion?: string;
    };
    createdAt: Date;
    updatedAt: Date;
  }>();

  // PKCE helpers
  function generateCodeVerifier(): string {
    return randomBytes(32).toString("base64url");
  }

  function generateCodeChallenge(verifier: string): string {
    return createHash("sha256").update(verifier).digest("base64url");
  }

  // GET /api/mobile/ehr/providers - List available EHR providers
  app.get("/api/mobile/ehr/providers", authMiddleware as RequestHandler, ((_req: AuthenticatedRequest, res: Response) => {
    const providers = ehrProviders.map(p => ({
      id: p.id,
      name: p.name,
      icon: p.icon,
      hasClientId: !!p.clientId,
      supportsDiscovery: p.supportsDiscovery,
      fhirBaseUrl: p.fhirBaseUrl,
    }));
    return res.json({ providers });
  }) as RequestHandler);

  // POST /api/mobile/ehr/connect - Initiate SMART on FHIR OAuth flow
  app.post("/api/mobile/ehr/connect", authMiddleware as RequestHandler, (async (req: AuthenticatedRequest, res: Response) => {
    const { providerId, redirectUri, aud } = req.body;
    
    const provider = ehrProviders.find(p => p.id === providerId);
    if (!provider) {
      return res.status(400).json({ error: "Unknown EHR provider" });
    }

    if (!redirectUri) {
      return res.status(400).json({ error: "Redirect URI is required" });
    }

    if (!provider.clientId) {
      return res.status(400).json({ error: `No client ID configured for ${provider.name}. Set ${providerId.toUpperCase()}_CLIENT_ID.` });
    }

    let authorizationEndpoint = provider.authorizationEndpoint;
    let tokenEndpoint = provider.tokenEndpoint;
    const fhirBaseUrl = aud || provider.fhirBaseUrl;

    if (aud && provider.supportsDiscovery) {
      const discovered = await discoverSmartEndpoints(aud);
      if (discovered) {
        authorizationEndpoint = discovered.authorizationEndpoint;
        tokenEndpoint = discovered.tokenEndpoint;
        logAudit(req.user!.id, "SMART_DISCOVERY_SUCCESS", "smart_oauth", `${providerId}:${new URL(aud).hostname}`);
      }
    }

    const state = randomBytes(16).toString("hex");
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    pkceSessions.set(state, {
      state,
      codeVerifier,
      providerId,
      userId: req.user!.id,
      redirectUri,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      used: false,
    });

    const params = new URLSearchParams({
      response_type: "code",
      client_id: provider.clientId,
      redirect_uri: redirectUri,
      scope: provider.scopes.join(" "),
      state,
      aud: fhirBaseUrl,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authorizationUrl = `${authorizationEndpoint}?${params.toString()}`;

    logAudit(req.user!.id, "EHR_CONNECT_INITIATED", "smart_oauth", providerId);

    return res.json({
      authorizationUrl,
      state,
      codeVerifier,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
  }) as RequestHandler);

  // POST /api/mobile/ehr/callback - Exchange code for tokens
  app.post("/api/mobile/ehr/callback", authMiddleware as RequestHandler, (async (req: AuthenticatedRequest, res: Response) => {
    const { code, state } = req.body;

    if (!code || !state) {
      return res.status(400).json({ error: "Missing code or state parameter" });
    }

    const pkceSession = pkceSessions.get(state);
    if (!pkceSession) {
      return res.status(400).json({ error: "Invalid or expired state" });
    }

    // One-time use enforcement - prevent replay attacks
    if (pkceSession.used) {
      pkceSessions.delete(state);
      return res.status(400).json({ error: "Authorization code already used" });
    }

    if (pkceSession.expiresAt < new Date()) {
      pkceSessions.delete(state);
      return res.status(400).json({ error: "PKCE session expired" });
    }

    if (pkceSession.userId !== req.user!.id) {
      return res.status(403).json({ error: "State mismatch" });
    }

    const provider = ehrProviders.find(p => p.id === pkceSession.providerId);
    if (!provider) {
      return res.status(400).json({ error: "Provider not found" });
    }

    // Mark session as used before token exchange
    pkceSession.used = true;

    try {
      // Exchange code for tokens using the stored redirectUri for exact match
      const tokenParams = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: pkceSession.redirectUri,
        client_id: provider.clientId,
        code_verifier: pkceSession.codeVerifier,
      });

      const tokenResponse = await fetch(provider.tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: tokenParams.toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        logAudit(req.user!.id, "EHR_TOKEN_EXCHANGE_FAILED", "smart_oauth", pkceSession.providerId);
        return res.status(400).json({ error: "Token exchange failed", details: errorText });
      }

      const tokens = await tokenResponse.json() as {
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token?: string;
        patient?: string;
        scope: string;
      };

      // Clean up PKCE session
      pkceSessions.delete(state);

      // Store connection
      const connectionId = `conn-${randomBytes(8).toString("hex")}`;
      ehrConnections.set(connectionId, {
        id: connectionId,
        userId: req.user!.id,
        providerId: provider.id,
        providerName: provider.name,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        patientId: tokens.patient,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        connectedAt: new Date(),
      });

      logAudit(req.user!.id, "EHR_CONNECTED", "smart_oauth", connectionId);

      return res.json({
        success: true,
        connectionId,
        providerName: provider.name,
        patientId: tokens.patient,
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      });
    } catch (error) {
      logAudit(req.user!.id, "EHR_CONNECT_ERROR", "smart_oauth", pkceSession.providerId);
      return res.status(500).json({ error: "Failed to connect to EHR" });
    }
  }) as RequestHandler);

  // GET /api/mobile/ehr/connections - List user's EHR connections
  app.get("/api/mobile/ehr/connections", authMiddleware as RequestHandler, ((req: AuthenticatedRequest, res: Response) => {
    const userConnections = Array.from(ehrConnections.values())
      .filter(c => c.userId === req.user!.id)
      .map(c => ({
        id: c.id,
        providerName: c.providerName,
        patientId: c.patientId,
        connectedAt: c.connectedAt.toISOString(),
        lastSyncAt: c.lastSyncAt?.toISOString(),
        isActive: c.expiresAt > new Date(),
      }));

    return res.json({ connections: userConnections });
  }) as RequestHandler);

  // Helper to refresh access token using refresh token
  async function refreshAccessToken(connection: typeof ehrConnections extends Map<string, infer V> ? V : never, provider: typeof ehrProviders[number]): Promise<boolean> {
    if (!connection.refreshToken) {
      return false;
    }

    try {
      const tokenParams = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: connection.refreshToken,
        client_id: provider.clientId,
      });

      const response = await fetch(provider.tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: tokenParams.toString(),
      });

      if (!response.ok) {
        return false;
      }

      const tokens = await response.json() as {
        access_token: string;
        expires_in: number;
        refresh_token?: string;
      };

      // Update connection with new tokens
      connection.accessToken = tokens.access_token;
      connection.expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
      if (tokens.refresh_token) {
        connection.refreshToken = tokens.refresh_token;
      }

      return true;
    } catch {
      return false;
    }
  }

  // POST /api/mobile/ehr/sync/:connectionId - Import FHIR resources
  app.post("/api/mobile/ehr/sync/:connectionId", authMiddleware as RequestHandler, (async (req: AuthenticatedRequest, res: Response) => {
    const { connectionId } = req.params;
    
    const connection = ehrConnections.get(connectionId);
    if (!connection || connection.userId !== req.user!.id) {
      return res.status(404).json({ error: "Connection not found" });
    }

    const provider = ehrProviders.find(p => p.id === connection.providerId);
    if (!provider) {
      return res.status(400).json({ error: "Provider not found" });
    }

    // If token expired, try to refresh it
    if (connection.expiresAt < new Date()) {
      const refreshed = await refreshAccessToken(connection, provider);
      if (!refreshed) {
        logAudit(req.user!.id, "EHR_TOKEN_REFRESH_FAILED", "smart_oauth", connectionId);
        return res.status(401).json({ error: "Connection expired and refresh failed, please reconnect" });
      }
      logAudit(req.user!.id, "EHR_TOKEN_REFRESHED", "smart_oauth", connectionId);
    }

    const resourceTypes = ["Patient", "Observation", "MedicationRequest", "Condition", "Encounter", "Immunization"];
    const results: Record<string, { imported: number; errors: number }> = {};
    const importedItems: Array<{
      resourceType: string;
      fhirId: string;
      display: string;
    }> = [];

    try {
      for (const resourceType of resourceTypes) {
        results[resourceType] = { imported: 0, errors: 0 };

        let url = `${provider.fhirBaseUrl}/${resourceType}`;
        if (resourceType !== "Patient" && connection.patientId) {
          url += `?patient=${connection.patientId}`;
        } else if (resourceType === "Patient" && connection.patientId) {
          url = `${provider.fhirBaseUrl}/Patient/${connection.patientId}`;
        }

        try {
          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${connection.accessToken}`,
              Accept: "application/fhir+json",
            },
          });

          if (!response.ok) {
            results[resourceType].errors++;
            continue;
          }

          const data = await response.json();
          const entries = resourceType === "Patient" && !data.entry
            ? [{ resource: data }]
            : data.entry || [];

          for (const entry of entries) {
            const resource = entry.resource;
            if (!resource || resource.resourceType !== resourceType) continue;

            const resourceId = `res-${randomBytes(8).toString("hex")}`;
            
            // Extract display name based on resource type
            let display = resource.id;
            if (resourceType === "Patient") {
              const name = resource.name?.[0];
              display = name ? `${name.given?.[0] || ""} ${name.family || ""}`.trim() : resource.id;
            } else if (resourceType === "Condition") {
              display = resource.code?.coding?.[0]?.display || resource.code?.text || resource.id;
            } else if (resourceType === "MedicationRequest") {
              display = resource.medicationCodeableConcept?.coding?.[0]?.display || 
                        resource.medicationCodeableConcept?.text || resource.id;
            } else if (resourceType === "Observation") {
              display = resource.code?.coding?.[0]?.display || resource.code?.text || resource.id;
            } else if (resourceType === "Encounter") {
              display = resource.type?.[0]?.coding?.[0]?.display || resource.class?.display || resource.id;
            } else if (resourceType === "Immunization") {
              display = resource.vaccineCode?.coding?.[0]?.display || resource.vaccineCode?.text || resource.id;
            }

            importedResources.set(resourceId, {
              id: resourceId,
              userId: req.user!.id,
              connectionId,
              resourceType,
              fhirId: resource.id,
              data: resource,
              provenance: {
                source: connection.providerName,
                importedAt: new Date().toISOString(),
                sourcePatientId: connection.patientId || "unknown",
                sourceVersion: resource.meta?.versionId,
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            importedItems.push({ resourceType, fhirId: resource.id, display });
            results[resourceType].imported++;
          }
        } catch (err) {
          results[resourceType].errors++;
        }
      }

      // Update last sync time
      connection.lastSyncAt = new Date();

      logAudit(req.user!.id, "EHR_SYNC_COMPLETED", "fhir_import", connectionId);

      return res.json({
        success: true,
        results,
        importedCount: importedItems.length,
        importedItems: importedItems.slice(0, 20), // Return first 20 for display
        syncedAt: new Date().toISOString(),
        noCdsCompliance: NO_CDS_COMPLIANCE,
      });
    } catch (error) {
      logAudit(req.user!.id, "EHR_SYNC_FAILED", "fhir_import", connectionId);
      return res.status(500).json({ error: "Sync failed" });
    }
  }) as RequestHandler);

  // GET /api/mobile/ehr/resources - Get imported resources with provenance
  app.get("/api/mobile/ehr/resources", authMiddleware as RequestHandler, ((req: AuthenticatedRequest, res: Response) => {
    const { resourceType, connectionId } = req.query;

    let resources = Array.from(importedResources.values())
      .filter(r => r.userId === req.user!.id);

    if (resourceType) {
      resources = resources.filter(r => r.resourceType === resourceType);
    }

    if (connectionId) {
      resources = resources.filter(r => r.connectionId === connectionId);
    }

    const formattedResources = resources.map(r => ({
      id: r.id,
      resourceType: r.resourceType,
      fhirId: r.fhirId,
      data: r.data,
      provenance: r.provenance,
      createdAt: r.createdAt.toISOString(),
    }));

    return res.json({
      resources: formattedResources,
      total: formattedResources.length,
      noCdsCompliance: NO_CDS_COMPLIANCE,
    });
  }) as RequestHandler);

  // DELETE /api/mobile/ehr/connections/:connectionId - Disconnect EHR
  app.delete("/api/mobile/ehr/connections/:connectionId", authMiddleware as RequestHandler, ((req: AuthenticatedRequest, res: Response) => {
    const { connectionId } = req.params;
    
    const connection = ehrConnections.get(connectionId);
    if (!connection || connection.userId !== req.user!.id) {
      return res.status(404).json({ error: "Connection not found" });
    }

    // Remove connection and associated resources
    ehrConnections.delete(connectionId);
    
    // Remove imported resources for this connection
    for (const [id, resource] of importedResources.entries()) {
      if (resource.connectionId === connectionId) {
        importedResources.delete(id);
      }
    }

    logAudit(req.user!.id, "EHR_DISCONNECTED", "smart_oauth", connectionId);

    return res.json({ success: true, message: "EHR connection removed" });
  }) as RequestHandler);

  // ============================================
  // Provider Connection Routes
  // ============================================

  interface Provider {
    id: string;
    name: string;
    specialty: string;
    organization?: string;
    phone?: string;
    email?: string;
    address?: string;
    npi?: string;
  }

  interface ProviderConnection {
    id: string;
    userId: string;
    providerId: string;
    providerName: string;
    status: 'pending' | 'approved' | 'declined';
    requestedAt: Date;
    approvedAt?: Date;
  }

  // Sample providers data
  const sampleProviders: Provider[] = [
    {
      id: "prov-1",
      name: "Dr. Sarah Chen",
      specialty: "Primary Care",
      organization: "Valley Health Medical Center",
      phone: "(555) 123-4567",
      email: "s.chen@valleyhealth.org",
      address: "123 Medical Plaza, Suite 100, San Jose, CA 95128",
      npi: "1234567890",
    },
    {
      id: "prov-2",
      name: "Dr. Michael Rodriguez",
      specialty: "Cardiology",
      organization: "Heart Care Associates",
      phone: "(555) 234-5678",
      email: "m.rodriguez@heartcare.com",
      address: "456 Cardiac Way, Suite 200, San Jose, CA 95129",
      npi: "2345678901",
    },
    {
      id: "prov-3",
      name: "Dr. Emily Thompson",
      specialty: "Dermatology",
      organization: "Skin Health Clinic",
      phone: "(555) 345-6789",
      email: "e.thompson@skinhealth.com",
      address: "789 Derma Drive, San Jose, CA 95130",
      npi: "3456789012",
    },
    {
      id: "prov-4",
      name: "Dr. James Kim",
      specialty: "Endocrinology",
      organization: "Diabetes & Hormone Center",
      phone: "(555) 456-7890",
      email: "j.kim@endocare.org",
      address: "321 Endocrine Lane, Suite 150, San Jose, CA 95131",
      npi: "4567890123",
    },
    {
      id: "prov-5",
      name: "Dr. Lisa Patel",
      specialty: "Neurology",
      organization: "Brain & Spine Institute",
      phone: "(555) 567-8901",
      email: "l.patel@brainspine.com",
      address: "555 Neuro Street, Suite 300, San Jose, CA 95132",
      npi: "5678901234",
    },
    {
      id: "prov-6",
      name: "Dr. Robert Johnson",
      specialty: "Orthopedics",
      organization: "Sports Medicine Center",
      phone: "(555) 678-9012",
      email: "r.johnson@sportsmed.org",
      address: "666 Ortho Blvd, Suite 400, San Jose, CA 95133",
      npi: "6789012345",
    },
    {
      id: "prov-7",
      name: "Dr. Amanda Lee",
      specialty: "Pediatrics",
      organization: "Children's Wellness Center",
      phone: "(555) 789-0123",
      email: "a.lee@childwellness.com",
      address: "777 Kids Lane, San Jose, CA 95134",
      npi: "7890123456",
    },
    {
      id: "prov-8",
      name: "Dr. David Martinez",
      specialty: "Psychiatry",
      organization: "Mental Health Partners",
      phone: "(555) 890-1234",
      email: "d.martinez@mentalhealth.org",
      address: "888 Mind Street, Suite 500, San Jose, CA 95135",
      npi: "8901234567",
    },
  ];

  // In-memory storage for provider connections
  const providerConnections = new Map<string, ProviderConnection>();

  // GET /api/mobile/providers - Search and list providers
  app.get("/api/mobile/providers", authMiddleware as RequestHandler, ((req: AuthenticatedRequest, res: Response) => {
    const { search, specialty } = req.query as { search?: string; specialty?: string };
    
    let filteredProviders = [...sampleProviders];

    if (search) {
      const searchLower = search.toLowerCase();
      filteredProviders = filteredProviders.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.organization?.toLowerCase().includes(searchLower)
      );
    }

    if (specialty) {
      filteredProviders = filteredProviders.filter(p => 
        p.specialty.toLowerCase() === specialty.toLowerCase()
      );
    }

    // Add connection status to each provider
    const userConnections = Array.from(providerConnections.values())
      .filter(c => c.userId === req.user!.id);

    const providersWithStatus = filteredProviders.map(p => {
      const connection = userConnections.find(c => c.providerId === p.id);
      return {
        ...p,
        isConnected: connection?.status === 'approved',
        connectionStatus: connection?.status,
      };
    });

    return res.json({
      providers: providersWithStatus,
      total: providersWithStatus.length,
    });
  }) as RequestHandler);

  // GET /api/mobile/provider-connections - Get user's provider connections
  app.get("/api/mobile/provider-connections", authMiddleware as RequestHandler, ((req: AuthenticatedRequest, res: Response) => {
    const userConnections = Array.from(providerConnections.values())
      .filter(c => c.userId === req.user!.id)
      .map(c => ({
        id: c.id,
        providerId: c.providerId,
        providerName: c.providerName,
        status: c.status,
        requestedAt: c.requestedAt.toISOString(),
        approvedAt: c.approvedAt?.toISOString(),
      }));

    return res.json({
      connections: userConnections,
      total: userConnections.length,
    });
  }) as RequestHandler);

  // POST /api/mobile/provider-connections - Request connection to provider
  app.post("/api/mobile/provider-connections", authMiddleware as RequestHandler, ((req: AuthenticatedRequest, res: Response) => {
    const { providerId } = req.body;

    if (!providerId) {
      return res.status(400).json({ error: "Provider ID is required" });
    }

    const provider = sampleProviders.find(p => p.id === providerId);
    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    // Check if connection already exists
    const existingConnection = Array.from(providerConnections.values())
      .find(c => c.userId === req.user!.id && c.providerId === providerId);

    if (existingConnection) {
      return res.status(409).json({ error: "Connection request already exists", status: existingConnection.status });
    }

    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const connection: ProviderConnection = {
      id: connectionId,
      userId: req.user!.id,
      providerId: provider.id,
      providerName: provider.name,
      status: 'pending',
      requestedAt: new Date(),
    };

    providerConnections.set(connectionId, connection);
    logAudit(req.user!.id, "PROVIDER_CONNECTION_REQUESTED", "provider", providerId);

    // Simulate auto-approval after 2 seconds (in production, provider would approve)
    setTimeout(() => {
      const conn = providerConnections.get(connectionId);
      if (conn && conn.status === 'pending') {
        conn.status = 'approved';
        conn.approvedAt = new Date();
        logAudit(req.user!.id, "PROVIDER_CONNECTION_APPROVED", "provider", providerId);
      }
    }, 2000);

    return res.status(201).json({
      success: true,
      connection: {
        id: connection.id,
        providerId: connection.providerId,
        providerName: connection.providerName,
        status: connection.status,
        requestedAt: connection.requestedAt.toISOString(),
      },
    });
  }) as RequestHandler);

  // DELETE /api/mobile/provider-connections/:providerId - Disconnect from provider
  app.delete("/api/mobile/provider-connections/:providerId", authMiddleware as RequestHandler, ((req: AuthenticatedRequest, res: Response) => {
    const { providerId } = req.params;

    const connection = Array.from(providerConnections.entries())
      .find(([_, c]) => c.userId === req.user!.id && c.providerId === providerId);

    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }

    providerConnections.delete(connection[0]);
    logAudit(req.user!.id, "PROVIDER_CONNECTION_REMOVED", "provider", providerId);

    return res.json({ success: true, message: "Provider connection removed" });
  }) as RequestHandler);

  // ============================================================
  // Mobile guided onboarding — per-user progress persisted to the
  // database so the first-time setup flow can resume across drop-offs
  // and across server restarts. The final POST /api/onboarding/complete
  // still clears the gate.
  // ============================================================
  function serializeOnboardingProgress(row: typeof mobileOnboardingProgress.$inferSelect) {
    return {
      firstName: row.firstName ?? undefined,
      lastName: row.lastName ?? undefined,
      dateOfBirth: row.dateOfBirth ?? undefined,
      preferredLanguage: row.preferredLanguage ?? undefined,
      connectDoctorChoice: row.connectDoctorChoice ?? undefined,
      currentStep: row.currentStep ?? undefined,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    };
  }

  app.get("/api/mobile/onboarding/progress", authMiddleware as RequestHandler, (async (req: AuthenticatedRequest, res: Response) => {
    try {
      const [row] = await db
        .select()
        .from(mobileOnboardingProgress)
        .where(eq(mobileOnboardingProgress.userId, req.user!.id))
        .limit(1);
      return res.json({ progress: row ? serializeOnboardingProgress(row) : null });
    } catch (err) {
      logger.error("[MobileOnboarding] Failed to load progress", { err: (err as Error).message });
      return res.status(500).json({ error: "Failed to load onboarding progress" });
    }
  }) as RequestHandler);

  app.patch("/api/mobile/onboarding/progress", authMiddleware as RequestHandler, (async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const body = (req.body || {}) as Record<string, unknown>;

    const allowedStrings = ["firstName", "lastName", "dateOfBirth", "preferredLanguage"] as const;
    const allowedSteps = new Set(["profile", "language", "connect", "complete"]);
    const allowedChoices = new Set(["connect", "skip"]);

    const patch: {
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      preferredLanguage?: string;
      connectDoctorChoice?: "connect" | "skip";
      currentStep?: "profile" | "language" | "connect" | "complete";
    } = {};

    for (const key of allowedStrings) {
      const v = body[key];
      if (typeof v === "string") {
        patch[key] = v.trim().slice(0, 200);
      }
    }
    if (typeof body.currentStep === "string" && allowedSteps.has(body.currentStep)) {
      patch.currentStep = body.currentStep as typeof patch.currentStep;
    }
    if (typeof body.connectDoctorChoice === "string" && allowedChoices.has(body.connectDoctorChoice)) {
      patch.connectDoctorChoice = body.connectDoctorChoice as "connect" | "skip";
    }

    try {
      const now = new Date();
      const [row] = await db
        .insert(mobileOnboardingProgress)
        .values({ userId, ...patch, updatedAt: now })
        .onConflictDoUpdate({
          target: mobileOnboardingProgress.userId,
          set: { ...patch, updatedAt: now },
        })
        .returning();

      // Mirror onboarding answers (name, DOB, preferred language) into
      // the shared user profile so they don't stay isolated to the
      // onboarding flow and so the rest of the app can read them from
      // the User record.
      const profileUpdates: Partial<{ firstName: string; lastName: string; dateOfBirth: string; preferredLanguage: string }> = {};
      if (patch.firstName !== undefined) profileUpdates.firstName = patch.firstName;
      if (patch.lastName !== undefined) profileUpdates.lastName = patch.lastName;
      if (patch.dateOfBirth !== undefined) profileUpdates.dateOfBirth = patch.dateOfBirth;
      if (patch.preferredLanguage !== undefined) profileUpdates.preferredLanguage = patch.preferredLanguage;
      if (Object.keys(profileUpdates).length > 0) {
        try {
          await storage.updateUserProfile(userId, profileUpdates);
        } catch (mirrorErr) {
          logger.warn("[MobileOnboarding] Failed to mirror progress to user profile", { err: (mirrorErr as Error).message });
        }
      }

      return res.json({ progress: serializeOnboardingProgress(row) });
    } catch (err) {
      logger.error("[MobileOnboarding] Failed to save progress", { err: (err as Error).message });
      return res.status(500).json({ error: "Failed to save onboarding progress" });
    }
  }) as RequestHandler);

  console.log("Mobile API routes registered successfully");
  console.log("SMART on FHIR mobile routes registered at /api/mobile/ehr/*");
}
