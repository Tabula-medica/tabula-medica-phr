import { Router, Request, Response } from "express";
import { createHmac, randomBytes } from "crypto";
import { isAuthenticated } from "./replit_integrations/auth";
import { requireFeature } from "./middleware/require-feature";

// Family Hub is a Pro-tier feature. The reauth/validate-session/audit
// endpoints stay open (they're auth utilities used to bootstrap the gate
// itself); all data-mutation and member-data endpoints below are gated.
const gateFamilyHub = requireFeature("family_hub");
import { storage } from "./storage";
import { logPhiAccess } from "./security/hipaa-audit";
import { insertProfileSchema } from "@shared/schema";
import { verifyPassword } from "./auth/local-auth";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";

const router = Router();

const SESSION_SECRET = process.env.SESSION_SECRET || randomBytes(32).toString("hex");
const SESSION_TTL_MS = 30 * 60 * 1000;

interface ReauthSession {
  userId: string;
  createdAt: number;
  expiresAt: number;
}

const activeSessions = new Map<string, ReauthSession>();

function signToken(userId: string): string {
  const payload = `${userId}:${Date.now()}:${randomBytes(16).toString("hex")}`;
  const hmac = createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
  return `fam-session-${Buffer.from(payload).toString("base64url")}.${hmac}`;
}

function verifyToken(token: string): ReauthSession | null {
  if (!token || !token.startsWith("fam-session-")) return null;
  const session = activeSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }
  return session;
}

function getUserId(req: Request): string {
  const user = (req as any).user;
  return user?.claims?.sub || user?.id || "";
}

function safeParseNotes(notes: string | null): Record<string, unknown> {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes);
    if (typeof parsed === "object" && parsed !== null) return parsed;
    return { text: notes };
  } catch {
    return { text: notes };
  }
}

const REAUTH_MAX_ATTEMPTS = 5;
const REAUTH_LOCKOUT_MS = 15 * 60 * 1000;
const reAuthAttempts = new Map<string, { count: number; lockedUntil?: number }>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfterSec?: number } {
  const entry = reAuthAttempts.get(userId);
  if (entry?.lockedUntil && entry.lockedUntil > Date.now()) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.lockedUntil - Date.now()) / 1000) };
  }
  if (entry?.lockedUntil && entry.lockedUntil <= Date.now()) {
    reAuthAttempts.delete(userId);
  }
  return { allowed: true };
}

function recordFailedAttempt(userId: string): void {
  const entry = reAuthAttempts.get(userId) || { count: 0 };
  entry.count += 1;
  if (entry.count >= REAUTH_MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + REAUTH_LOCKOUT_MS;
  }
  reAuthAttempts.set(userId, entry);
}

function clearAttempts(userId: string): void {
  reAuthAttempts.delete(userId);
}

router.post("/api/family-hub/reauth", isAuthenticated, async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: `Too many failed attempts. Please wait ${rateCheck.retryAfterSec} seconds.`,
    });
  }

  const { password, ssoReauth } = req.body;
  if (!password && !ssoReauth) {
    return res.status(400).json({ error: "Password or SSO re-authentication is required" });
  }

  const user = await storage.getUser(userId);
  if (!user) {
    logPhiAccess({
      userId,
      resourceType: "FamilyHub",
      action: "write",
      details: "Re-authentication failed: user not found",
    });
    return res.status(401).json({ error: "User not found" });
  }

  if (ssoReauth) {
    const authTime = (req as any).user?.claims?.auth_time;
    const iat = (req as any).user?.claims?.iat;
    const tokenTimestamp = authTime || iat;

    if (!tokenTimestamp) {
      return res.status(400).json({
        error: "Unable to verify SSO session freshness. Please log out and log back in.",
      });
    }

    const tokenAgeMs = Date.now() - (tokenTimestamp * 1000);
    const MAX_SSO_AGE_MS = 5 * 60 * 1000;

    if (tokenAgeMs > MAX_SSO_AGE_MS) {
      logPhiAccess({
        userId,
        resourceType: "FamilyHub",
        action: "write",
        details: "SSO re-authentication failed: session too old, user must log out and log back in",
      });

      return res.status(401).json({
        error: "Your login session is not recent enough. Please log out and log back in to verify your identity.",
        requiresFreshLogin: true,
      });
    }

    logPhiAccess({
      userId,
      resourceType: "FamilyHub",
      action: "write",
      details: "SSO re-authentication verified via fresh session timestamp",
    });
  } else if (password) {
    if (!user.passwordHash) {
      return res.status(400).json({
        error: "Password not available for this account. Please log out and log back in to verify your identity.",
        requiresSsoReauth: true,
      });
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      recordFailedAttempt(userId);

      logPhiAccess({
        userId,
        resourceType: "FamilyHub",
        action: "write",
        details: "Re-authentication failed: invalid password",
      });

      await storage.createSecurityAuditLog({
        userId,
        eventType: "auth_failure",
        action: "family_hub_reauth_failed",
        resourceType: "FamilyHub",
        ipAddress: req.ip || "unknown",
        userAgent: req.headers["user-agent"] || "unknown",
        details: "Password verification failed during family hub re-authentication",
      });

      return res.status(401).json({ error: "Invalid password" });
    }
  }

  clearAttempts(userId);

  const token = signToken(userId);
  const now = Date.now();
  activeSessions.set(token, {
    userId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });

  logPhiAccess({
    userId,
    resourceType: "FamilyHub",
    action: "write",
    details: "User re-authenticated successfully for family member management",
  });

  await storage.createSecurityAuditLog({
    userId,
    eventType: "auth_success",
    action: "family_hub_reauth_success",
    resourceType: "FamilyHub",
    ipAddress: req.ip || "unknown",
    userAgent: req.headers["user-agent"] || "unknown",
    details: "Re-authentication successful for family hub access",
  });

  res.json({
    success: true,
    sessionToken: token,
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  });
});

router.post("/api/family-hub/validate-session", isAuthenticated, (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { sessionToken } = req.body;

  const session = verifyToken(sessionToken);
  if (!session || session.userId !== userId) {
    return res.status(401).json({ error: "Invalid or expired session", valid: false });
  }

  res.json({ valid: true, expiresAt: new Date(session.expiresAt).toISOString() });
});

router.post("/api/family-hub/audit", isAuthenticated, (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { action, resourceType, resourceId, details } = req.body;

  logPhiAccess({
    userId,
    resourceType: resourceType || "FamilyHub",
    resourceId: resourceId || undefined,
    action: action || "read",
    details: details || "Family hub action",
  });

  res.json({ logged: true });
});

router.post("/api/family-hub/upload-verification-doc", isAuthenticated, gateFamilyHub, async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { sessionToken, fileName, fileSize, contentType } = req.body;

  const session = verifyToken(sessionToken);
  if (!session || session.userId !== userId) {
    return res.status(401).json({ error: "Re-authentication required" });
  }

  if (!fileName || !fileSize || !contentType) {
    return res.status(400).json({ error: "File metadata (fileName, fileSize, contentType) required" });
  }

  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/jpg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (!allowedTypes.includes(contentType)) {
    return res.status(400).json({ error: "Invalid file type. Allowed: PDF, JPG, PNG, DOC, DOCX" });
  }

  const maxSize = 10 * 1024 * 1024;
  if (fileSize > maxSize) {
    return res.status(400).json({ error: "File too large. Maximum size: 10MB" });
  }

  try {
    const objectStorage = new ObjectStorageService();
    const uploadURL = await objectStorage.getObjectEntityUploadURL();

    logPhiAccess({
      userId,
      resourceType: "FamilyVerificationDoc",
      action: "write",
      details: `Upload URL generated for verification document: ${fileName} (${contentType}, ${fileSize} bytes)`,
    });

    const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);

    res.json({
      uploadURL,
      objectPath,
      fileName,
      contentType,
    });
  } catch (err: any) {
    console.error("[FamilyHub] Failed to generate upload URL:", err);
    res.status(500).json({ error: "Failed to generate upload URL. Object storage may not be configured." });
  }
});

router.post("/api/family-hub/add-member", isAuthenticated, gateFamilyHub, async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { sessionToken, member } = req.body;

  const session = verifyToken(sessionToken);
  if (!session || session.userId !== userId) {
    return res.status(401).json({ error: "Re-authentication required. Session invalid or expired." });
  }

  if (!member?.firstName || !member?.lastName || !member?.relationship) {
    return res.status(400).json({ error: "First name, last name, and relationship are required" });
  }

  const requiresVerification = member.relationship !== "self";
  if (requiresVerification) {
    if (!member.verificationDoc?.type || !member.verificationDoc?.name) {
      return res.status(400).json({
        error: "Legal verification document is required when adding non-self family members",
      });
    }
    if (!member.verificationDoc?.objectPath || typeof member.verificationDoc.objectPath !== "string" || !member.verificationDoc.objectPath.trim()) {
      return res.status(400).json({
        error: "Verification document must be successfully uploaded before adding a family member. Please upload the document and try again.",
      });
    }
    if (!member.attestation) {
      return res.status(400).json({
        error: "Legal attestation is required when adding non-self family members",
      });
    }
  }

  const healthData: Record<string, unknown> = {};
  if (member.healthData?.conditions?.length) healthData.conditions = member.healthData.conditions;
  if (member.healthData?.medications?.length) healthData.medications = member.healthData.medications;
  if (member.healthData?.allergies?.length) healthData.allergies = member.healthData.allergies;
  if (member.healthData?.appointments?.length) healthData.appointments = member.healthData.appointments;

  const notesObj: Record<string, unknown> = {};
  if (member.notes) notesObj.text = member.notes;
  if (Object.keys(healthData).length > 0) notesObj.healthData = healthData;
  if (member.verificationDoc) {
    notesObj.verificationDoc = {
      type: member.verificationDoc.type,
      name: member.verificationDoc.name,
      objectPath: member.verificationDoc.objectPath,
      uploadedAt: new Date().toISOString(),
    };
  }

  const profileData = {
    userId,
    firstName: member.firstName.trim(),
    lastName: member.lastName.trim(),
    dateOfBirth: member.dateOfBirth || null,
    gender: member.gender || null,
    profileType: member.profileType || "child",
    relationship: member.relationship,
    status: "active" as const,
    isDefault: false,
    medicalRecordNumber: member.medicalRecordNumber || null,
    insuranceId: member.insuranceId || null,
    emergencyContact: member.emergencyContact || null,
    notes: Object.keys(notesObj).length > 0 ? JSON.stringify(notesObj) : null,
  };

  const parseResult = insertProfileSchema.safeParse(profileData);
  if (!parseResult.success) {
    return res.status(400).json({ error: "Invalid profile data", details: parseResult.error.flatten() });
  }

  try {
    const createdProfile = await storage.createProfile(parseResult.data);

    logPhiAccess({
      userId,
      resourceType: "FamilyMember",
      resourceId: createdProfile.id,
      action: "write",
      details: `Created family member profile: ${member.firstName} ${member.lastName} (${member.profileType || "child"}, relationship: ${member.relationship})`,
    });

    if (member.verificationDoc) {
      logPhiAccess({
        userId,
        resourceType: "FamilyVerification",
        resourceId: createdProfile.id,
        action: "write",
        details: `Verification document submitted (${member.verificationDoc.type}) for ${member.firstName} ${member.lastName} [uploaded to storage: ${member.verificationDoc.objectPath}]`,
      });
    }

    if (Object.keys(healthData).length > 0) {
      const condCount = (healthData.conditions as string[])?.length || 0;
      const medCount = (healthData.medications as string[])?.length || 0;
      const allergyCount = (healthData.allergies as string[])?.length || 0;
      logPhiAccess({
        userId,
        resourceType: "FamilyMemberHealth",
        resourceId: createdProfile.id,
        action: "write",
        details: `Health profile data added for ${member.firstName} ${member.lastName}: ${condCount} conditions, ${medCount} medications, ${allergyCount} allergies`,
      });
    }

    res.status(201).json({ profile: createdProfile });
  } catch (err: any) {
    console.error("[FamilyHub] Failed to create member:", err);
    res.status(500).json({ error: "Failed to create family member profile" });
  }
});

router.get("/api/family-hub/members", isAuthenticated, gateFamilyHub, async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  logPhiAccess({
    userId,
    resourceType: "FamilyHub",
    action: "read",
    details: "Viewed family members dashboard",
  });

  try {
    const profiles = await storage.getProfiles(userId);
    res.json({ members: profiles });
  } catch (err: any) {
    console.error("[FamilyHub] Failed to get members:", err);
    res.status(500).json({ error: "Failed to retrieve family members" });
  }
});

router.post("/api/family-hub/member/:profileId/health-entry", isAuthenticated, gateFamilyHub, async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { profileId } = req.params;
  const { sessionToken, entryType, entries } = req.body;

  const session = verifyToken(sessionToken);
  if (!session || session.userId !== userId) {
    return res.status(401).json({ error: "Re-authentication required" });
  }

  const profile = await storage.getProfile(profileId);
  if (!profile || profile.userId !== userId) {
    return res.status(404).json({ error: "Profile not found or access denied" });
  }

  const validEntryTypes = ["conditions", "medications", "allergies", "appointments"];
  if (!entryType || !validEntryTypes.includes(entryType) || !entries || !Array.isArray(entries)) {
    return res.status(400).json({ error: "Valid entry type (conditions/medications/allergies/appointments) and entries array required" });
  }

  logPhiAccess({
    userId,
    resourceType: "FamilyMemberHealth",
    resourceId: profileId,
    action: "write",
    details: `Added ${entries.length} ${entryType} entries for ${profile.firstName} ${profile.lastName}`,
  });

  try {
    const existingNotes = safeParseNotes(profile.notes);
    const healthData = (existingNotes.healthData as Record<string, unknown>) || {};
    const existing = (healthData[entryType] as string[]) || [];
    const merged = [...new Set([...existing, ...entries])];
    healthData[entryType] = merged;
    existingNotes.healthData = healthData;

    await storage.updateProfile(profileId, {
      notes: JSON.stringify(existingNotes),
    });

    res.json({ success: true, [entryType]: merged });
  } catch (err: any) {
    console.error("[FamilyHub] Failed to add health entry:", err);
    res.status(500).json({ error: "Failed to save health data" });
  }
});

router.get("/api/family-hub/member/:profileId/health", isAuthenticated, gateFamilyHub, async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const { profileId } = req.params;
  const profile = await storage.getProfile(profileId);
  if (!profile || profile.userId !== userId) {
    return res.status(404).json({ error: "Profile not found or access denied" });
  }

  logPhiAccess({
    userId,
    resourceType: "FamilyMemberHealth",
    resourceId: profileId,
    action: "read",
    details: `Viewed health data for ${profile.firstName} ${profile.lastName}`,
  });

  const notes = safeParseNotes(profile.notes);
  const healthData = (notes.healthData as Record<string, unknown>) || {};

  res.json({
    profileId,
    profileName: `${profile.firstName} ${profile.lastName}`,
    conditions: (healthData.conditions as string[]) || [],
    medications: (healthData.medications as string[]) || [],
    allergies: (healthData.allergies as string[]) || [],
    appointments: (healthData.appointments as string[]) || [],
  });
});

export default router;
