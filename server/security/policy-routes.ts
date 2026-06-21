import { Router, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { 
  insertDataAccessPolicySchema, 
  insertBreakTheGlassSchema,
  type UserRole 
} from "@shared/schema";
import { 
  enforcePolicyCompliance, 
  activateBreakTheGlass, 
  seedDefaultPolicies,
  type AccessRequest 
} from "./policy-enforcement";
import { logPhiAccess } from "./hipaa-audit";
import { z } from "zod";

interface AuthSession {
  userId: string;
  userRole: UserRole;
  mfaVerified?: boolean;
}

function getSession(req: Request): AuthSession | null {
  const session = req.session as any;
  if (!session?.userId) return null;
  return {
    userId: session.userId,
    userRole: session.userRole || "patient",
    mfaVerified: session.mfaVerified,
  };
}

const router = Router();

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (session.userRole !== "admin" && session.userRole !== "provider") {
    return res.status(403).json({ error: "Admin or provider access required" });
  }
  next();
};

router.get("/policies", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { isActive, targetRole } = req.query;
    
    const filters: { isActive?: boolean; targetRole?: UserRole } = {};
    if (isActive !== undefined) {
      filters.isActive = isActive === "true";
    }
    if (targetRole && typeof targetRole === "string") {
      filters.targetRole = targetRole as UserRole;
    }
    
    const policies = await storage.getDataAccessPolicies(filters);
    res.json(policies);
  } catch (error) {
    console.error("[PolicyRoutes] Error fetching policies:", error);
    res.status(500).json({ error: "Failed to fetch policies" });
  }
});

router.get("/policies/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const policy = await storage.getDataAccessPolicy(req.params.id);
    if (!policy) {
      return res.status(404).json({ error: "Policy not found" });
    }
    res.json(policy);
  } catch (error) {
    console.error("[PolicyRoutes] Error fetching policy:", error);
    res.status(500).json({ error: "Failed to fetch policy" });
  }
});

router.post("/policies", requireAdmin, async (req: Request, res: Response) => {
  try {
    const session = getSession(req)!;
    const validationResult = insertDataAccessPolicySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid policy data", 
        details: validationResult.error.errors 
      });
    }
    
    const policy = await storage.createDataAccessPolicy({
      ...validationResult.data,
      createdBy: session.userId,
    });
    
    await logPhiAccess({
      userId: session.userId,
      resourceType: "DataAccessPolicy",
      action: "write",
      details: `Created policy: ${policy.name}`,
    });
    
    res.status(201).json(policy);
  } catch (error) {
    console.error("[PolicyRoutes] Error creating policy:", error);
    res.status(500).json({ error: "Failed to create policy" });
  }
});

router.patch("/policies/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const session = getSession(req)!;
    const existingPolicy = await storage.getDataAccessPolicy(req.params.id);
    if (!existingPolicy) {
      return res.status(404).json({ error: "Policy not found" });
    }
    
    if (existingPolicy.isSystemPolicy) {
      return res.status(403).json({ error: "System policies cannot be modified" });
    }
    
    const updated = await storage.updateDataAccessPolicy(req.params.id, {
      ...req.body,
      updatedBy: session.userId,
    });
    
    await logPhiAccess({
      userId: session.userId,
      resourceType: "DataAccessPolicy",
      action: "write",
      details: `Updated policy: ${existingPolicy.name}`,
    });
    
    res.json(updated);
  } catch (error) {
    console.error("[PolicyRoutes] Error updating policy:", error);
    res.status(500).json({ error: "Failed to update policy" });
  }
});

router.delete("/policies/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const session = getSession(req)!;
    const existingPolicy = await storage.getDataAccessPolicy(req.params.id);
    if (!existingPolicy) {
      return res.status(404).json({ error: "Policy not found" });
    }
    
    if (existingPolicy.isSystemPolicy) {
      return res.status(403).json({ error: "System policies cannot be deleted" });
    }
    
    await storage.deleteDataAccessPolicy(req.params.id);
    
    await logPhiAccess({
      userId: session.userId,
      resourceType: "DataAccessPolicy",
      action: "delete",
      details: `Deleted policy: ${existingPolicy.name}`,
    });
    
    res.status(204).send();
  } catch (error) {
    console.error("[PolicyRoutes] Error deleting policy:", error);
    res.status(500).json({ error: "Failed to delete policy" });
  }
});

const checkAccessSchema = z.object({
  patientId: z.string(),
  resourceType: z.string(),
  resourceId: z.string().optional(),
  action: z.enum(["read", "write", "delete", "export", "share", "print"]),
  accessContext: z.enum([
    "treatment", "payment", "healthcare_ops", "emergency", "patient_request",
    "legal", "research", "audit", "public_health", "quality_review", 
    "care_coordination", "caregiver_access"
  ]),
  dataClassification: z.enum([
    "PHI", "PII", "SENSITIVE", "RESTRICTED", "FINANCIAL", 
    "GENETIC", "MINORS", "RESEARCH", "EMERGENCY", "STANDARD"
  ]).optional(),
  justification: z.string().optional(),
});

router.post("/check-access", requireAuth, async (req: Request, res: Response) => {
  try {
    const session = getSession(req)!;
    const validationResult = checkAccessSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid request", 
        details: validationResult.error.errors 
      });
    }
    
    const { patientId, resourceType, resourceId, action, accessContext, dataClassification, justification } = validationResult.data;
    
    const accessRequest: AccessRequest = {
      userId: session.userId,
      userRole: session.userRole,
      patientId,
      resourceType: resourceType as any,
      resourceId,
      action,
      accessContext,
      dataClassification,
      justification,
      clientIp: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "unknown",
      sessionId: req.sessionID,
      mfaVerified: session.mfaVerified || false,
    };
    
    const decision = await enforcePolicyCompliance(accessRequest);
    res.json(decision);
  } catch (error) {
    console.error("[PolicyRoutes] Error checking access:", error);
    res.status(500).json({ error: "Failed to check access" });
  }
});

router.get("/violations", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, policyId, startDate, endDate } = req.query;
    
    const filters: { userId?: string; policyId?: string; startDate?: string; endDate?: string } = {};
    if (userId && typeof userId === "string") filters.userId = userId;
    if (policyId && typeof policyId === "string") filters.policyId = policyId;
    if (startDate && typeof startDate === "string") filters.startDate = startDate;
    if (endDate && typeof endDate === "string") filters.endDate = endDate;
    
    const violations = await storage.getPolicyViolations(filters);
    res.json(violations);
  } catch (error) {
    console.error("[PolicyRoutes] Error fetching violations:", error);
    res.status(500).json({ error: "Failed to fetch violations" });
  }
});

const breakTheGlassRequestSchema = z.object({
  patientId: z.string(),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  resourceTypes: z.array(z.string()).optional(),
  durationMinutes: z.number().min(15).max(240).default(60),
});

router.post("/break-the-glass", requireAuth, async (req: Request, res: Response) => {
  try {
    const session = getSession(req)!;
    if (session.userRole !== "provider" && session.userRole !== "admin") {
      return res.status(403).json({ error: "Only providers and admins can activate break-the-glass" });
    }
    
    const validationResult = breakTheGlassRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid request", 
        details: validationResult.error.errors 
      });
    }
    
    const { patientId, reason, resourceTypes, durationMinutes } = validationResult.data;
    
    const existingActive = await storage.getActiveBreakTheGlass(session.userId, patientId);
    if (existingActive) {
      return res.status(409).json({ 
        error: "Active break-the-glass already exists for this patient",
        existingRecord: existingActive,
      });
    }
    
    const record = await activateBreakTheGlass({
      userId: session.userId,
      userRole: session.userRole,
      patientId,
      reason,
      resourceTypes: resourceTypes as any[],
      durationMinutes,
    });
    
    res.status(201).json(record);
  } catch (error) {
    console.error("[PolicyRoutes] Error activating break-the-glass:", error);
    res.status(500).json({ error: "Failed to activate break-the-glass" });
  }
});

router.get("/break-the-glass", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, patientId, reviewStatus } = req.query;
    
    const filters: { userId?: string; patientId?: string; reviewStatus?: string } = {};
    if (userId && typeof userId === "string") filters.userId = userId;
    if (patientId && typeof patientId === "string") filters.patientId = patientId;
    if (reviewStatus && typeof reviewStatus === "string") filters.reviewStatus = reviewStatus;
    
    const records = await storage.getBreakTheGlassRecords(filters);
    res.json(records);
  } catch (error) {
    console.error("[PolicyRoutes] Error fetching break-the-glass records:", error);
    res.status(500).json({ error: "Failed to fetch break-the-glass records" });
  }
});

router.post("/break-the-glass/:id/deactivate", requireAuth, async (req: Request, res: Response) => {
  try {
    const session = getSession(req)!;
    const record = await storage.getBreakTheGlassRecord(req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Record not found" });
    }
    
    if (record.userId !== session.userId && session.userRole !== "admin") {
      return res.status(403).json({ error: "Not authorized to deactivate this record" });
    }
    
    const updated = await storage.deactivateBreakTheGlass(req.params.id, session.userId);
    
    await logPhiAccess({
      userId: session.userId,
      patientId: record.patientId,
      resourceType: "BreakTheGlass",
      action: "write",
      details: `Deactivated break-the-glass: ${req.params.id}`,
    });
    
    res.json(updated);
  } catch (error) {
    console.error("[PolicyRoutes] Error deactivating break-the-glass:", error);
    res.status(500).json({ error: "Failed to deactivate break-the-glass" });
  }
});

const reviewBreakTheGlassSchema = z.object({
  status: z.enum(["approved", "flagged", "investigated"]),
  notes: z.string().optional(),
});

router.post("/break-the-glass/:id/review", requireAdmin, async (req: Request, res: Response) => {
  try {
    const session = getSession(req)!;
    const record = await storage.getBreakTheGlassRecord(req.params.id);
    if (!record) {
      return res.status(404).json({ error: "Record not found" });
    }
    
    const validationResult = reviewBreakTheGlassSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid request", 
        details: validationResult.error.errors 
      });
    }
    
    const { status, notes } = validationResult.data;
    
    const updated = await storage.reviewBreakTheGlass(
      req.params.id, 
      session.userId, 
      status, 
      notes
    );
    
    await logPhiAccess({
      userId: session.userId,
      patientId: record.patientId,
      resourceType: "BreakTheGlass",
      action: "write",
      details: `Reviewed break-the-glass: ${req.params.id}, status: ${status}`,
    });
    
    res.json(updated);
  } catch (error) {
    console.error("[PolicyRoutes] Error reviewing break-the-glass:", error);
    res.status(500).json({ error: "Failed to review break-the-glass" });
  }
});

router.get("/access-grants", requireAuth, async (req: Request, res: Response) => {
  try {
    const session = getSession(req)!;
    const { patientId, isActive } = req.query;
    
    const filters: { userId?: string; patientId?: string; isActive?: boolean } = {
      userId: session.userId,
    };
    if (patientId && typeof patientId === "string") filters.patientId = patientId;
    if (isActive !== undefined) filters.isActive = isActive === "true";
    
    const grants = await storage.getAccessGrants(filters);
    res.json(grants);
  } catch (error) {
    console.error("[PolicyRoutes] Error fetching access grants:", error);
    res.status(500).json({ error: "Failed to fetch access grants" });
  }
});

router.post("/seed-default-policies", requireAdmin, async (req: Request, res: Response) => {
  try {
    const session = getSession(req)!;
    await seedDefaultPolicies();
    
    await logPhiAccess({
      userId: session.userId,
      resourceType: "DataAccessPolicy",
      action: "write",
      details: "Seeded default system policies",
    });
    
    res.json({ message: "Default policies seeded successfully" });
  } catch (error) {
    console.error("[PolicyRoutes] Error seeding policies:", error);
    res.status(500).json({ error: "Failed to seed policies" });
  }
});

export function registerPolicyRoutes(app: Router) {
  app.use("/api/data-access", router);
  console.log("[Routes] Data Access Policy routes registered at /api/data-access/*");
}

export default router;
