import { Router, Request, Response } from "express";
import { z } from "zod";
import { randomBytes, createHash } from "crypto";
import {
  insertProfileSchema,
  insertProfileMemberSchema,
  insertProfileShareLinkSchema,
  insertBreakGlassAccessSchema,
  insertBreakGlassEventSchema,
  insertProfileTagAssociationSchema,
  insertProfileAccessRequestSchema,
  profileMemberRoles,
  profileAccessScopes,
  profileTags,
  profileTypeValues,
  roleScopePermissions,
  type Profile,
  type ProfileMember,
  type ProfileShareLink,
  type BreakGlassAccess,
  type BreakGlassEvent,
  type ProfileTagAssociation,
  type ProfileAccessRequest,
  type ProfileMemberRole,
  type ProfileAccessScope,
  type ExtendedProfile,
  type ProfileMemberSummary,
} from "@shared/schema";

const router = Router();

const profiles: Map<string, Profile> = new Map();
const profileMembers: Map<string, ProfileMember> = new Map();
const profileShareLinks: Map<string, ProfileShareLink> = new Map();
const breakGlassAccess: Map<string, BreakGlassAccess> = new Map();
const breakGlassEvents: Map<string, BreakGlassEvent> = new Map();
const profileTags_: Map<string, ProfileTagAssociation> = new Map();
const accessRequests: Map<string, ProfileAccessRequest> = new Map();
const activeProfiles: Map<string, string> = new Map();

// Rate limiting for break-glass access attempts
interface RateLimitEntry {
  attempts: number;
  lastAttempt: number;
  lockedUntil: number | null;
}
const breakGlassRateLimit: Map<string, RateLimitEntry> = new Map();
const MAX_BREAK_GLASS_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const SYSTEM_USER_ID = "user-123";

function generateId(): string {
  return `profile-${Date.now()}-${randomBytes(4).toString("hex")}`;
}

// Salted PIN hashing with HMAC-SHA256 for improved security
function hashPin(pin: string, salt?: string): string {
  const pinSalt = salt || randomBytes(16).toString("hex");
  const hash = createHash("sha256")
    .update(pinSalt + pin)
    .digest("hex");
  return `${pinSalt}:${hash}`;
}

function verifyPin(pin: string, storedHash: string): boolean {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;
  const actualHash = createHash("sha256")
    .update(salt + pin)
    .digest("hex");
  return actualHash === expectedHash;
}

function checkRateLimit(profileId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = breakGlassRateLimit.get(profileId);
  
  if (!entry) {
    return { allowed: true };
  }
  
  // Check if locked out
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return { allowed: false, retryAfter: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  
  // Reset if outside window
  if (now - entry.lastAttempt > RATE_LIMIT_WINDOW_MS) {
    breakGlassRateLimit.delete(profileId);
    return { allowed: true };
  }
  
  // Check attempt count
  if (entry.attempts >= MAX_BREAK_GLASS_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
    return { allowed: false, retryAfter: Math.ceil(LOCKOUT_DURATION_MS / 1000) };
  }
  
  return { allowed: true };
}

function recordFailedAttempt(profileId: string): void {
  const now = Date.now();
  const entry = breakGlassRateLimit.get(profileId);
  
  if (!entry || now - entry.lastAttempt > RATE_LIMIT_WINDOW_MS) {
    breakGlassRateLimit.set(profileId, { attempts: 1, lastAttempt: now, lockedUntil: null });
  } else {
    entry.attempts++;
    entry.lastAttempt = now;
    if (entry.attempts >= MAX_BREAK_GLASS_ATTEMPTS) {
      entry.lockedUntil = now + LOCKOUT_DURATION_MS;
    }
  }
}

function clearRateLimit(profileId: string): void {
  breakGlassRateLimit.delete(profileId);
}

function generateSecureToken(): string {
  return randomBytes(32).toString("base64url");
}

function initializeSampleProfiles() {
  if (profiles.size > 0) return;

  const now = new Date().toISOString();

  const selfProfile: Profile = {
    id: "profile-self-001",
    userId: SYSTEM_USER_ID,
    firstName: "Sarah",
    lastName: "Johnson",
    dateOfBirth: "1985-03-15",
    gender: "female",
    profileType: "self",
    relationship: "self",
    profileImageUrl: null,
    status: "active",
    isDefault: true,
    unifiedPatientId: "patient-001",
    medicalRecordNumber: "MRN-12345",
    insuranceId: "INS-98765",
    emergencyContact: JSON.stringify({ name: "Michael Johnson", phone: "(555) 123-4567", relationship: "spouse" }),
    notes: null,
    createdAt: now,
    updatedAt: now,
  };

  const childProfile: Profile = {
    id: "profile-child-001",
    userId: SYSTEM_USER_ID,
    firstName: "Emma",
    lastName: "Johnson",
    dateOfBirth: "2015-08-22",
    gender: "female",
    profileType: "child",
    relationship: "child",
    profileImageUrl: null,
    status: "active",
    isDefault: false,
    unifiedPatientId: "patient-002",
    medicalRecordNumber: "MRN-12346",
    insuranceId: "INS-98766",
    emergencyContact: JSON.stringify({ name: "Sarah Johnson", phone: "(555) 234-5678", relationship: "parent" }),
    notes: "Pediatric patient - requires guardian consent",
    createdAt: now,
    updatedAt: now,
  };

  const elderProfile: Profile = {
    id: "profile-elder-001",
    userId: SYSTEM_USER_ID,
    firstName: "Margaret",
    lastName: "Thompson",
    dateOfBirth: "1948-11-05",
    gender: "female",
    profileType: "elder",
    relationship: "parent",
    profileImageUrl: null,
    status: "active",
    isDefault: false,
    unifiedPatientId: "patient-003",
    medicalRecordNumber: "MRN-12347",
    insuranceId: "INS-98767",
    emergencyContact: JSON.stringify({ name: "Sarah Johnson", phone: "(555) 234-5678", relationship: "daughter" }),
    notes: "Primary caregiver: Sarah Johnson",
    createdAt: now,
    updatedAt: now,
  };

  profiles.set(selfProfile.id, selfProfile);
  profiles.set(childProfile.id, childProfile);
  profiles.set(elderProfile.id, elderProfile);

  const ownerMember: ProfileMember = {
    id: "member-001",
    profileId: selfProfile.id,
    userId: SYSTEM_USER_ID,
    role: "owner",
    accessScopes: ["all"],
    invitedBy: null,
    invitedAt: null,
    acceptedAt: now,
    expiresAt: null,
    isActive: true,
    lastAccessAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const childOwnerMember: ProfileMember = {
    id: "member-002",
    profileId: childProfile.id,
    userId: SYSTEM_USER_ID,
    role: "owner",
    accessScopes: ["all"],
    invitedBy: null,
    invitedAt: null,
    acceptedAt: now,
    expiresAt: null,
    isActive: true,
    lastAccessAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const elderOwnerMember: ProfileMember = {
    id: "member-003",
    profileId: elderProfile.id,
    userId: SYSTEM_USER_ID,
    role: "owner",
    accessScopes: ["all"],
    invitedBy: null,
    invitedAt: null,
    acceptedAt: now,
    expiresAt: null,
    isActive: true,
    lastAccessAt: now,
    createdAt: now,
    updatedAt: now,
  };

  profileMembers.set(ownerMember.id, ownerMember);
  profileMembers.set(childOwnerMember.id, childOwnerMember);
  profileMembers.set(elderOwnerMember.id, elderOwnerMember);

  const cancerTag: ProfileTagAssociation = {
    id: "tag-001",
    profileId: elderProfile.id,
    tag: "cancer_survivorship",
    addedBy: SYSTEM_USER_ID,
    addedAt: now,
    notes: "Breast cancer survivor - 5 years in remission",
    isActive: true,
  };
  profileTags_.set(cancerTag.id, cancerTag);

  const breakGlass: BreakGlassAccess = {
    id: "bg-001",
    profileId: selfProfile.id,
    pin: hashPin("1234"),
    isEnabled: true,
    accessDurationMinutes: 30,
    allowedScopes: ["medications", "allergies", "diagnoses", "appointments"],
    createdBy: SYSTEM_USER_ID,
    createdAt: now,
    updatedAt: now,
  };
  breakGlassAccess.set(breakGlass.id, breakGlass);

  activeProfiles.set(SYSTEM_USER_ID, selfProfile.id);
}

initializeSampleProfiles();

router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = SYSTEM_USER_ID;

    const userProfiles = Array.from(profiles.values())
      .filter(p => {
        const isMember = Array.from(profileMembers.values())
          .some(m => m.profileId === p.id && m.userId === userId && m.isActive);
        return p.userId === userId || isMember;
      })
      .map(p => {
        const tags = Array.from(profileTags_.values())
          .filter(t => t.profileId === p.id && t.isActive)
          .map(t => t.tag);
        const memberCount = Array.from(profileMembers.values())
          .filter(m => m.profileId === p.id && m.isActive).length;
        const pendingRequestCount = Array.from(accessRequests.values())
          .filter(r => r.profileId === p.id && r.status === "pending").length;
        const shareLinksCount = Array.from(profileShareLinks.values())
          .filter(l => l.profileId === p.id && l.isActive).length;
        const hasEmergencyAccess = Array.from(breakGlassAccess.values())
          .some(bg => bg.profileId === p.id && bg.isEnabled);

        return {
          ...p,
          tags,
          memberCount,
          pendingRequestCount,
          shareLinksCount,
          hasEmergencyAccess,
        } as ExtendedProfile;
      });

    res.json(userProfiles);
  } catch (error) {
    console.error("[Profiles] Error fetching profiles:", error);
    res.status(500).json({ error: "Failed to fetch profiles" });
  }
});

router.get("/active", async (req: Request, res: Response) => {
  try {
    const userId = SYSTEM_USER_ID;
    const activeProfileId = activeProfiles.get(userId);

    if (!activeProfileId) {
      return res.status(404).json({ error: "No active profile set" });
    }

    const profile = profiles.get(activeProfileId);
    if (!profile) {
      return res.status(404).json({ error: "Active profile not found" });
    }

    const tags = Array.from(profileTags_.values())
      .filter(t => t.profileId === profile.id && t.isActive)
      .map(t => t.tag);

    const member = Array.from(profileMembers.values())
      .find(m => m.profileId === profile.id && m.userId === userId && m.isActive);

    res.json({
      profile,
      tags,
      role: member?.role || "owner",
      accessScopes: member?.accessScopes || ["all"],
    });
  } catch (error) {
    console.error("[Profiles] Error fetching active profile:", error);
    res.status(500).json({ error: "Failed to fetch active profile" });
  }
});

router.post("/switch/:profileId", async (req: Request, res: Response) => {
  try {
    const userId = SYSTEM_USER_ID;
    const { profileId } = req.params;

    const profile = profiles.get(profileId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const member = Array.from(profileMembers.values())
      .find(m => m.profileId === profileId && m.userId === userId && m.isActive);

    if (!member && profile.userId !== userId) {
      return res.status(403).json({ error: "You do not have access to this profile" });
    }

    activeProfiles.set(userId, profileId);

    if (member) {
      member.lastAccessAt = new Date().toISOString();
    }

    res.json({ 
      success: true, 
      profileId,
      role: member?.role || "owner",
      accessScopes: member?.accessScopes || ["all"],
    });
  } catch (error) {
    console.error("[Profiles] Error switching profile:", error);
    res.status(500).json({ error: "Failed to switch profile" });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = SYSTEM_USER_ID;
    const validated = insertProfileSchema.parse(req.body);
    const now = new Date().toISOString();

    const newProfile: Profile = {
      id: generateId(),
      ...validated,
      userId,
      profileType: validated.profileType || "self",
      dateOfBirth: validated.dateOfBirth || null,
      gender: validated.gender || null,
      profileImageUrl: validated.profileImageUrl || null,
      status: validated.status || "active",
      isDefault: validated.isDefault || false,
      unifiedPatientId: validated.unifiedPatientId || null,
      medicalRecordNumber: validated.medicalRecordNumber || null,
      insuranceId: validated.insuranceId || null,
      emergencyContact: validated.emergencyContact || null,
      notes: validated.notes || null,
      createdAt: now,
      updatedAt: now,
    };

    profiles.set(newProfile.id, newProfile);

    const ownerMember: ProfileMember = {
      id: `member-${Date.now()}`,
      profileId: newProfile.id,
      userId,
      role: "owner",
      accessScopes: ["all"],
      invitedBy: null,
      invitedAt: null,
      acceptedAt: now,
      expiresAt: null,
      isActive: true,
      lastAccessAt: now,
      createdAt: now,
      updatedAt: now,
    };
    profileMembers.set(ownerMember.id, ownerMember);

    res.status(201).json(newProfile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid profile data", details: error.errors });
    }
    console.error("[Profiles] Error creating profile:", error);
    res.status(500).json({ error: "Failed to create profile" });
  }
});

router.put("/:profileId", async (req: Request, res: Response) => {
  try {
    const userId = SYSTEM_USER_ID;
    const { profileId } = req.params;

    const profile = profiles.get(profileId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const member = Array.from(profileMembers.values())
      .find(m => m.profileId === profileId && m.userId === userId && m.isActive);

    if (member?.role !== "owner" && profile.userId !== userId) {
      return res.status(403).json({ error: "Only owners can update profiles" });
    }

    const updateSchema = insertProfileSchema.partial();
    const validated = updateSchema.parse(req.body);

    const updatedProfile: Profile = {
      ...profile,
      ...validated,
      updatedAt: new Date().toISOString(),
    };

    profiles.set(profileId, updatedProfile);
    res.json(updatedProfile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid profile data", details: error.errors });
    }
    console.error("[Profiles] Error updating profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.get("/:profileId/members", async (req: Request, res: Response) => {
  try {
    const userId = SYSTEM_USER_ID;
    const { profileId } = req.params;

    const profile = profiles.get(profileId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const members = Array.from(profileMembers.values())
      .filter(m => m.profileId === profileId)
      .map(m => ({
        id: m.id,
        userId: m.userId,
        userName: m.userId === SYSTEM_USER_ID ? "Sarah Johnson" : `User ${m.userId.slice(0, 8)}`,
        userEmail: m.userId === SYSTEM_USER_ID ? "sarah.johnson@email.com" : null,
        profileImageUrl: null,
        role: m.role,
        accessScopes: m.accessScopes,
        isActive: m.isActive,
        expiresAt: m.expiresAt,
        lastAccessAt: m.lastAccessAt,
      } as ProfileMemberSummary));

    res.json(members);
  } catch (error) {
    console.error("[Profiles] Error fetching members:", error);
    res.status(500).json({ error: "Failed to fetch profile members" });
  }
});

router.post("/:profileId/members", async (req: Request, res: Response) => {
  try {
    const userId = SYSTEM_USER_ID;
    const { profileId } = req.params;

    const profile = profiles.get(profileId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const ownerMember = Array.from(profileMembers.values())
      .find(m => m.profileId === profileId && m.userId === userId && m.role === "owner" && m.isActive);

    if (!ownerMember && profile.userId !== userId) {
      return res.status(403).json({ error: "Only owners can add members" });
    }

    const validated = insertProfileMemberSchema.parse({ ...req.body, profileId });
    const now = new Date().toISOString();

    const newMember: ProfileMember = {
      id: `member-${Date.now()}-${randomBytes(4).toString("hex")}`,
      profileId,
      userId: validated.userId,
      role: validated.role,
      accessScopes: validated.accessScopes || roleScopePermissions[validated.role],
      invitedBy: userId,
      invitedAt: now,
      acceptedAt: null,
      expiresAt: validated.expiresAt || null,
      isActive: true,
      lastAccessAt: null,
      createdAt: now,
      updatedAt: now,
    };

    profileMembers.set(newMember.id, newMember);
    res.status(201).json(newMember);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid member data", details: error.errors });
    }
    console.error("[Profiles] Error adding member:", error);
    res.status(500).json({ error: "Failed to add member" });
  }
});

router.delete("/:profileId/members/:memberId", async (req: Request, res: Response) => {
  try {
    const userId = SYSTEM_USER_ID;
    const { profileId, memberId } = req.params;

    const profile = profiles.get(profileId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const ownerMember = Array.from(profileMembers.values())
      .find(m => m.profileId === profileId && m.userId === userId && m.role === "owner" && m.isActive);

    if (!ownerMember && profile.userId !== userId) {
      return res.status(403).json({ error: "Only owners can remove members" });
    }

    const member = profileMembers.get(memberId);
    if (!member || member.profileId !== profileId) {
      return res.status(404).json({ error: "Member not found" });
    }

    if (member.role === "owner" && member.userId === profile.userId) {
      return res.status(400).json({ error: "Cannot remove the profile owner" });
    }

    member.isActive = false;
    member.updatedAt = new Date().toISOString();

    res.json({ success: true });
  } catch (error) {
    console.error("[Profiles] Error removing member:", error);
    res.status(500).json({ error: "Failed to remove member" });
  }
});

router.post("/:profileId/share-link", async (req: Request, res: Response) => {
  try {
    const userId = SYSTEM_USER_ID;
    const { profileId } = req.params;

    const profile = profiles.get(profileId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const member = Array.from(profileMembers.values())
      .find(m => m.profileId === profileId && m.userId === userId && m.isActive);

    if (!member || (member.role !== "owner" && member.role !== "caregiver_full")) {
      return res.status(403).json({ error: "You do not have permission to create share links" });
    }

    const validated = insertProfileShareLinkSchema.parse({ ...req.body, profileId, createdBy: userId });
    const now = new Date().toISOString();

    const shareLink: ProfileShareLink = {
      id: `share-${Date.now()}-${randomBytes(4).toString("hex")}`,
      profileId,
      createdBy: userId,
      token: generateSecureToken(),
      recipientEmail: validated.recipientEmail || null,
      recipientName: validated.recipientName || null,
      accessScopes: validated.accessScopes || ["all"],
      expiresAt: validated.expiresAt,
      maxViews: validated.maxViews || null,
      viewCount: 0,
      password: validated.password ? hashPin(validated.password) : null,
      isActive: true,
      lastAccessedAt: null,
      createdAt: now,
    };

    profileShareLinks.set(shareLink.id, shareLink);

    res.status(201).json({
      ...shareLink,
      shareUrl: `/shared/${shareLink.token}`,
      password: undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid share link data", details: error.errors });
    }
    console.error("[Profiles] Error creating share link:", error);
    res.status(500).json({ error: "Failed to create share link" });
  }
});

router.get("/:profileId/share-links", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const links = Array.from(profileShareLinks.values())
      .filter(l => l.profileId === profileId)
      .map(l => ({
        ...l,
        shareUrl: `/shared/${l.token}`,
        password: undefined,
      }));

    res.json(links);
  } catch (error) {
    console.error("[Profiles] Error fetching share links:", error);
    res.status(500).json({ error: "Failed to fetch share links" });
  }
});

router.delete("/:profileId/share-links/:linkId", async (req: Request, res: Response) => {
  try {
    const { profileId, linkId } = req.params;

    const link = profileShareLinks.get(linkId);
    if (!link || link.profileId !== profileId) {
      return res.status(404).json({ error: "Share link not found" });
    }

    link.isActive = false;
    res.json({ success: true });
  } catch (error) {
    console.error("[Profiles] Error revoking share link:", error);
    res.status(500).json({ error: "Failed to revoke share link" });
  }
});

router.post("/:profileId/break-glass/setup", async (req: Request, res: Response) => {
  try {
    const userId = SYSTEM_USER_ID;
    const { profileId } = req.params;

    const profile = profiles.get(profileId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const member = Array.from(profileMembers.values())
      .find(m => m.profileId === profileId && m.userId === userId && m.role === "owner" && m.isActive);

    if (!member && profile.userId !== userId) {
      return res.status(403).json({ error: "Only owners can set up emergency access" });
    }

    const validated = insertBreakGlassAccessSchema.parse({ ...req.body, profileId, createdBy: userId });
    const now = new Date().toISOString();

    const existingBg = Array.from(breakGlassAccess.values())
      .find(bg => bg.profileId === profileId);

    if (existingBg) {
      existingBg.pin = hashPin(validated.pin);
      existingBg.accessDurationMinutes = validated.accessDurationMinutes || 30;
      existingBg.allowedScopes = validated.allowedScopes || ["medications", "allergies", "diagnoses"];
      existingBg.isEnabled = true;
      existingBg.updatedAt = now;
      return res.json({ success: true, message: "Emergency access updated" });
    }

    const newBg: BreakGlassAccess = {
      id: `bg-${Date.now()}`,
      profileId,
      pin: hashPin(validated.pin),
      isEnabled: true,
      accessDurationMinutes: validated.accessDurationMinutes || 30,
      allowedScopes: validated.allowedScopes || ["medications", "allergies", "diagnoses"],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    breakGlassAccess.set(newBg.id, newBg);
    res.status(201).json({ success: true, message: "Emergency access configured" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid emergency access data", details: error.errors });
    }
    console.error("[Profiles] Error setting up break-glass:", error);
    res.status(500).json({ error: "Failed to set up emergency access" });
  }
});

router.post("/:profileId/break-glass/access", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { pin, reason, accessorName, accessorRole } = req.body;

    if (!pin || !reason || !accessorName) {
      return res.status(400).json({ error: "PIN, reason, and accessor name are required" });
    }

    // Rate limiting check
    const rateCheck = checkRateLimit(profileId);
    if (!rateCheck.allowed) {
      console.warn(`[BreakGlass] SECURITY: Rate limit exceeded for profile ${profileId}, locked for ${rateCheck.retryAfter}s`);
      return res.status(429).json({ 
        error: "Too many failed attempts. Please try again later.",
        retryAfter: rateCheck.retryAfter
      });
    }

    const profile = profiles.get(profileId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const bgAccess = Array.from(breakGlassAccess.values())
      .find(bg => bg.profileId === profileId && bg.isEnabled);

    if (!bgAccess) {
      return res.status(404).json({ error: "Emergency access not configured for this profile" });
    }

    // Verify PIN with salted hash
    if (!verifyPin(pin, bgAccess.pin)) {
      recordFailedAttempt(profileId);
      const entry = breakGlassRateLimit.get(profileId);
      const remainingAttempts = MAX_BREAK_GLASS_ATTEMPTS - (entry?.attempts || 0);
      console.warn(`[BreakGlass] SECURITY: Invalid PIN attempt for profile ${profileId} (${remainingAttempts} attempts remaining)`);
      return res.status(401).json({ 
        error: "Invalid PIN",
        remainingAttempts: Math.max(0, remainingAttempts)
      });
    }

    // Clear rate limit on successful access
    clearRateLimit(profileId);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + bgAccess.accessDurationMinutes * 60 * 1000);

    const event: BreakGlassEvent = {
      id: `bge-${Date.now()}`,
      profileId,
      accessedBy: `emergency-${Date.now()}`,
      accessedByName: accessorName,
      accessedByRole: accessorRole || "emergency_responder",
      reason,
      ipAddress: req.ip || null,
      userAgent: req.get("User-Agent") || null,
      scopesAccessed: bgAccess.allowedScopes,
      accessGrantedAt: now.toISOString(),
      accessExpiresAt: expiresAt.toISOString(),
      accessRevokedAt: null,
      revokedBy: null,
      revokeReason: null,
    };

    breakGlassEvents.set(event.id, event);

    console.log(`[BreakGlass] AUDIT: Emergency access GRANTED for profile ${profileId} by ${accessorName} (${accessorRole || 'emergency_responder'}) - Reason: ${reason} - IP: ${req.ip} - Expires: ${expiresAt.toISOString()}`);

    res.json({
      success: true,
      accessToken: event.id,
      expiresAt: event.accessExpiresAt,
      allowedScopes: bgAccess.allowedScopes,
      profile: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        dateOfBirth: profile.dateOfBirth,
      },
    });
  } catch (error) {
    console.error("[Profiles] Error processing break-glass access:", error);
    res.status(500).json({ error: "Failed to process emergency access" });
  }
});

router.get("/:profileId/break-glass/events", async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const events = Array.from(breakGlassEvents.values())
      .filter(e => e.profileId === profileId)
      .sort((a, b) => new Date(b.accessGrantedAt).getTime() - new Date(a.accessGrantedAt).getTime());

    res.json(events);
  } catch (error) {
    console.error("[Profiles] Error fetching break-glass events:", error);
    res.status(500).json({ error: "Failed to fetch emergency access events" });
  }
});

router.post("/:profileId/tags", async (req: Request, res: Response) => {
  try {
    const userId = SYSTEM_USER_ID;
    const { profileId } = req.params;

    const profile = profiles.get(profileId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }

    const validated = insertProfileTagAssociationSchema.parse({ ...req.body, profileId, addedBy: userId });
    const now = new Date().toISOString();

    const existingTag = Array.from(profileTags_.values())
      .find(t => t.profileId === profileId && t.tag === validated.tag);

    if (existingTag) {
      if (!existingTag.isActive) {
        existingTag.isActive = true;
        existingTag.addedAt = now;
        existingTag.notes = validated.notes || null;
        return res.json(existingTag);
      }
      return res.status(400).json({ error: "Tag already exists on this profile" });
    }

    const newTag: ProfileTagAssociation = {
      id: `tag-${Date.now()}`,
      profileId,
      tag: validated.tag,
      addedBy: userId,
      addedAt: now,
      notes: validated.notes || null,
      isActive: true,
    };

    profileTags_.set(newTag.id, newTag);
    res.status(201).json(newTag);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid tag data", details: error.errors });
    }
    console.error("[Profiles] Error adding tag:", error);
    res.status(500).json({ error: "Failed to add tag" });
  }
});

router.delete("/:profileId/tags/:tagId", async (req: Request, res: Response) => {
  try {
    const { profileId, tagId } = req.params;

    const tag = profileTags_.get(tagId);
    if (!tag || tag.profileId !== profileId) {
      return res.status(404).json({ error: "Tag not found" });
    }

    tag.isActive = false;
    res.json({ success: true });
  } catch (error) {
    console.error("[Profiles] Error removing tag:", error);
    res.status(500).json({ error: "Failed to remove tag" });
  }
});

router.get("/:profileId/access-check", async (req: Request, res: Response) => {
  try {
    const userId = SYSTEM_USER_ID;
    const { profileId } = req.params;
    const { scope } = req.query;

    const profile = profiles.get(profileId);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found", hasAccess: false });
    }

    const member = Array.from(profileMembers.values())
      .find(m => m.profileId === profileId && m.userId === userId && m.isActive);

    if (!member && profile.userId !== userId) {
      return res.json({ hasAccess: false, reason: "Not a member of this profile" });
    }

    const role = member?.role || "owner";
    const accessScopes = member?.accessScopes || ["all"];

    if (scope) {
      const hasScope = accessScopes.includes("all") || accessScopes.includes(scope as ProfileAccessScope);
      return res.json({
        hasAccess: hasScope,
        role,
        accessScopes,
        reason: hasScope ? undefined : `No access to ${scope}`,
      });
    }

    res.json({
      hasAccess: true,
      role,
      accessScopes,
    });
  } catch (error) {
    console.error("[Profiles] Error checking access:", error);
    res.status(500).json({ error: "Failed to check access" });
  }
});

export default router;

export function registerProfileRoutes(app: any) {
  app.use("/api/profiles", router);
  console.log("[Routes] Multi-Profile Management routes registered at /api/profiles/*");
}
