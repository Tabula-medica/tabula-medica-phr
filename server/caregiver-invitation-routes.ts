import { Router, Request, Response } from "express";
import { randomUUID, createHash } from "crypto";
import { z } from "zod";

const router = Router();

export interface CaregiverInvitation {
  id: string;
  profileId: string;
  profileName: string;
  invitedEmail: string;
  invitedName: string;
  invitedBy: string;
  invitedByName: string;
  status: "pending" | "accepted" | "declined" | "expired" | "revoked";
  permissions: CaregiverGranularPermissions;
  expiresAt: string | null;
  accessExpiresAt: string | null;
  inviteToken: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  revokedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaregiverGranularPermissions {
  viewMedications: boolean;
  editMedications: boolean;
  viewConditions: boolean;
  editConditions: boolean;
  viewAppointments: boolean;
  editAppointments: boolean;
  viewDocuments: boolean;
  uploadDocuments: boolean;
  downloadDocuments: boolean;
  viewTimeline: boolean;
  editTimeline: boolean;
  viewSideEffects: boolean;
  addSideEffects: boolean;
  viewCancerTrack: boolean;
  editCancerTrack: boolean;
  viewEmergencyInfo: boolean;
  canExportData: boolean;
  canShareWithProviders: boolean;
  receiveNotifications: boolean;
  respondToNotifications: boolean;
}

export interface CaregiverAccessRecord {
  id: string;
  profileId: string;
  profileName: string;
  caregiverId: string;
  caregiverEmail: string;
  caregiverName: string;
  relationshipType: string;
  permissions: CaregiverGranularPermissions;
  accessExpiresAt: string | null;
  grantedBy: string;
  grantedAt: string;
  lastAccessedAt: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const invitationsStore: Map<string, CaregiverInvitation> = new Map();
const caregiverAccessStore: Map<string, CaregiverAccessRecord> = new Map();

const SYSTEM_USER_ID = "user-123";
const SYSTEM_PROFILE_ID = "profile-self-001";

const defaultPermissions: CaregiverGranularPermissions = {
  viewMedications: true,
  editMedications: false,
  viewConditions: true,
  editConditions: false,
  viewAppointments: true,
  editAppointments: false,
  viewDocuments: true,
  uploadDocuments: false,
  downloadDocuments: false,
  viewTimeline: true,
  editTimeline: false,
  viewSideEffects: true,
  addSideEffects: false,
  viewCancerTrack: true,
  editCancerTrack: false,
  viewEmergencyInfo: true,
  canExportData: false,
  canShareWithProviders: false,
  receiveNotifications: true,
  respondToNotifications: false,
};

const fullAccessPermissions: CaregiverGranularPermissions = {
  viewMedications: true,
  editMedications: true,
  viewConditions: true,
  editConditions: true,
  viewAppointments: true,
  editAppointments: true,
  viewDocuments: true,
  uploadDocuments: true,
  downloadDocuments: true,
  viewTimeline: true,
  editTimeline: true,
  viewSideEffects: true,
  addSideEffects: true,
  viewCancerTrack: true,
  editCancerTrack: true,
  viewEmergencyInfo: true,
  canExportData: true,
  canShareWithProviders: true,
  receiveNotifications: true,
  respondToNotifications: true,
};

function initializeSampleData() {
  if (caregiverAccessStore.size > 0) return;

  const now = new Date().toISOString();

  const sampleAccess: CaregiverAccessRecord[] = [
    {
      id: "access-1",
      profileId: SYSTEM_PROFILE_ID,
      profileName: "Sarah Johnson",
      caregiverId: "caregiver-michael-001",
      caregiverEmail: "michael.johnson@email.com",
      caregiverName: "Michael Johnson",
      relationshipType: "spouse",
      permissions: {
        ...fullAccessPermissions,
      },
      accessExpiresAt: null,
      grantedBy: SYSTEM_USER_ID,
      grantedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastAccessedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      notes: "Primary caregiver - spouse with full access",
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: now,
    },
    {
      id: "access-2",
      profileId: SYSTEM_PROFILE_ID,
      profileName: "Sarah Johnson",
      caregiverId: "caregiver-sister-002",
      caregiverEmail: "emily.wilson@email.com",
      caregiverName: "Emily Wilson",
      relationshipType: "sibling",
      permissions: {
        ...defaultPermissions,
        viewDocuments: true,
        downloadDocuments: true,
      },
      accessExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      grantedBy: SYSTEM_USER_ID,
      grantedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      lastAccessedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      isActive: true,
      notes: "Sister - view access with document downloads",
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: now,
    },
  ];

  sampleAccess.forEach(a => caregiverAccessStore.set(a.id, a));

  const pendingInvitation: CaregiverInvitation = {
    id: "inv-pending-1",
    profileId: SYSTEM_PROFILE_ID,
    profileName: "Sarah Johnson",
    invitedEmail: "david.johnson@email.com",
    invitedName: "David Johnson",
    invitedBy: SYSTEM_USER_ID,
    invitedByName: "Sarah Johnson",
    status: "pending",
    permissions: {
      ...defaultPermissions,
      viewAppointments: true,
      receiveNotifications: true,
    },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    accessExpiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    inviteToken: createHash("sha256").update(`inv-pending-1-${Date.now()}`).digest("hex").substring(0, 32),
    acceptedAt: null,
    declinedAt: null,
    revokedAt: null,
    notes: "Brother - limited access for appointment coordination",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: now,
  };

  invitationsStore.set(pendingInvitation.id, pendingInvitation);

  console.log("[CaregiverInvitation] Sample data initialized");
}

initializeSampleData();

const granularPermissionsSchema = z.object({
  viewMedications: z.boolean().default(true),
  editMedications: z.boolean().default(false),
  viewConditions: z.boolean().default(true),
  editConditions: z.boolean().default(false),
  viewAppointments: z.boolean().default(true),
  editAppointments: z.boolean().default(false),
  viewDocuments: z.boolean().default(true),
  uploadDocuments: z.boolean().default(false),
  downloadDocuments: z.boolean().default(false),
  viewTimeline: z.boolean().default(true),
  editTimeline: z.boolean().default(false),
  viewSideEffects: z.boolean().default(true),
  addSideEffects: z.boolean().default(false),
  viewCancerTrack: z.boolean().default(true),
  editCancerTrack: z.boolean().default(false),
  viewEmergencyInfo: z.boolean().default(true),
  canExportData: z.boolean().default(false),
  canShareWithProviders: z.boolean().default(false),
  receiveNotifications: z.boolean().default(true),
  respondToNotifications: z.boolean().default(false),
});

const createInvitationSchema = z.object({
  profileId: z.string().min(1),
  invitedEmail: z.string().email(),
  invitedName: z.string().min(1),
  relationshipType: z.string().min(1),
  permissions: granularPermissionsSchema,
  inviteExpiresInDays: z.number().min(1).max(30).default(7),
  accessExpiresInDays: z.number().min(1).max(365).nullable().optional(),
  notes: z.string().nullable().optional(),
});

router.get("/api/caregiver/invitations", (req: Request, res: Response) => {
  const profileId = (req.query.profileId as string) || SYSTEM_PROFILE_ID;

  const invitations = Array.from(invitationsStore.values())
    .filter(inv => inv.profileId === profileId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ invitations });
});

router.get("/api/caregiver/invitations/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const invitation = invitationsStore.get(id);

  if (!invitation) {
    return res.status(404).json({ error: "Invitation not found" });
  }

  res.json({ invitation });
});

router.post("/api/caregiver/invitations", (req: Request, res: Response) => {
  try {
    const validated = createInvitationSchema.parse(req.body);
    const now = new Date();

    const existingInvitation = Array.from(invitationsStore.values()).find(
      inv => inv.profileId === validated.profileId && 
             inv.invitedEmail.toLowerCase() === validated.invitedEmail.toLowerCase() &&
             inv.status === "pending"
    );

    if (existingInvitation) {
      return res.status(409).json({ 
        error: "A pending invitation already exists for this email",
        existingInvitationId: existingInvitation.id 
      });
    }

    const existingAccess = Array.from(caregiverAccessStore.values()).find(
      a => a.profileId === validated.profileId && 
           a.caregiverEmail.toLowerCase() === validated.invitedEmail.toLowerCase() &&
           a.isActive
    );

    if (existingAccess) {
      return res.status(409).json({ 
        error: "This person already has active caregiver access",
        existingAccessId: existingAccess.id 
      });
    }

    const inviteToken = createHash("sha256")
      .update(`${randomUUID()}-${Date.now()}`)
      .digest("hex")
      .substring(0, 32);

    const invitation: CaregiverInvitation = {
      id: `inv-${randomUUID()}`,
      profileId: validated.profileId,
      profileName: "Sarah Johnson",
      invitedEmail: validated.invitedEmail,
      invitedName: validated.invitedName,
      invitedBy: SYSTEM_USER_ID,
      invitedByName: "Sarah Johnson",
      status: "pending",
      permissions: validated.permissions,
      expiresAt: new Date(now.getTime() + validated.inviteExpiresInDays * 24 * 60 * 60 * 1000).toISOString(),
      accessExpiresAt: validated.accessExpiresInDays 
        ? new Date(now.getTime() + validated.accessExpiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null,
      inviteToken,
      acceptedAt: null,
      declinedAt: null,
      revokedAt: null,
      notes: validated.notes || null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    invitationsStore.set(invitation.id, invitation);

    console.log(`[CaregiverInvitation] Created invitation ${invitation.id} for ${invitation.invitedEmail}`);

    res.status(201).json({
      success: true,
      invitation: {
        ...invitation,
        inviteToken: undefined,
      },
      inviteLink: `/caregiver/accept-invite?token=${inviteToken}`,
      message: `Invitation sent to ${validated.invitedName}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create invitation" });
  }
});

router.post("/api/caregiver/invitations/:id/resend", (req: Request, res: Response) => {
  const { id } = req.params;
  const invitation = invitationsStore.get(id);

  if (!invitation) {
    return res.status(404).json({ error: "Invitation not found" });
  }

  if (invitation.status !== "pending") {
    return res.status(400).json({ error: "Can only resend pending invitations" });
  }

  const now = new Date();
  const newToken = createHash("sha256")
    .update(`${randomUUID()}-${Date.now()}`)
    .digest("hex")
    .substring(0, 32);

  invitation.inviteToken = newToken;
  invitation.expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  invitation.updatedAt = now.toISOString();

  invitationsStore.set(id, invitation);

  console.log(`[CaregiverInvitation] Resent invitation ${id}`);

  res.json({
    success: true,
    message: `Invitation resent to ${invitation.invitedName}`,
    newExpiresAt: invitation.expiresAt,
  });
});

router.post("/api/caregiver/invitations/:id/revoke", (req: Request, res: Response) => {
  const { id } = req.params;
  const invitation = invitationsStore.get(id);

  if (!invitation) {
    return res.status(404).json({ error: "Invitation not found" });
  }

  if (invitation.status !== "pending") {
    return res.status(400).json({ error: "Can only revoke pending invitations" });
  }

  const now = new Date().toISOString();
  invitation.status = "revoked";
  invitation.revokedAt = now;
  invitation.updatedAt = now;

  invitationsStore.set(id, invitation);

  console.log(`[CaregiverInvitation] Revoked invitation ${id}`);

  res.json({
    success: true,
    message: "Invitation revoked successfully",
  });
});

router.post("/api/caregiver/invitations/accept", (req: Request, res: Response) => {
  const { token, caregiverId, caregiverName, caregiverEmail } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Invitation token is required" });
  }

  const invitation = Array.from(invitationsStore.values()).find(inv => inv.inviteToken === token);

  if (!invitation) {
    return res.status(404).json({ error: "Invalid or expired invitation" });
  }

  if (invitation.status !== "pending") {
    return res.status(400).json({ error: `Invitation has already been ${invitation.status}` });
  }

  if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
    invitation.status = "expired";
    invitation.updatedAt = new Date().toISOString();
    invitationsStore.set(invitation.id, invitation);
    return res.status(400).json({ error: "Invitation has expired" });
  }

  const now = new Date().toISOString();
  const cId = caregiverId || `caregiver-${randomUUID()}`;

  const accessRecord: CaregiverAccessRecord = {
    id: `access-${randomUUID()}`,
    profileId: invitation.profileId,
    profileName: invitation.profileName,
    caregiverId: cId,
    caregiverEmail: caregiverEmail || invitation.invitedEmail,
    caregiverName: caregiverName || invitation.invitedName,
    relationshipType: "family",
    permissions: invitation.permissions,
    accessExpiresAt: invitation.accessExpiresAt,
    grantedBy: invitation.invitedBy,
    grantedAt: now,
    lastAccessedAt: null,
    isActive: true,
    notes: invitation.notes,
    createdAt: now,
    updatedAt: now,
  };

  caregiverAccessStore.set(accessRecord.id, accessRecord);

  invitation.status = "accepted";
  invitation.acceptedAt = now;
  invitation.updatedAt = now;
  invitationsStore.set(invitation.id, invitation);

  console.log(`[CaregiverInvitation] Invitation ${invitation.id} accepted, created access ${accessRecord.id}`);

  res.json({
    success: true,
    accessRecord,
    message: `You now have caregiver access to ${invitation.profileName}'s health records`,
  });
});

router.get("/api/caregiver/access", (req: Request, res: Response) => {
  const profileId = (req.query.profileId as string) || SYSTEM_PROFILE_ID;

  const accessList = Array.from(caregiverAccessStore.values())
    .filter(a => a.profileId === profileId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ caregivers: accessList });
});

router.get("/api/caregiver/access/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const access = caregiverAccessStore.get(id);

  if (!access) {
    return res.status(404).json({ error: "Caregiver access record not found" });
  }

  res.json({ access });
});

router.patch("/api/caregiver/access/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const access = caregiverAccessStore.get(id);

  if (!access) {
    return res.status(404).json({ error: "Caregiver access record not found" });
  }

  const { permissions, accessExpiresAt, notes, isActive } = req.body;

  if (permissions) {
    try {
      const validatedPermissions = granularPermissionsSchema.parse(permissions);
      access.permissions = validatedPermissions;
    } catch (error) {
      return res.status(400).json({ error: "Invalid permissions format" });
    }
  }

  if (accessExpiresAt !== undefined) {
    access.accessExpiresAt = accessExpiresAt;
  }

  if (notes !== undefined) {
    access.notes = notes;
  }

  if (isActive !== undefined) {
    access.isActive = isActive;
  }

  access.updatedAt = new Date().toISOString();
  caregiverAccessStore.set(id, access);

  console.log(`[CaregiverAccess] Updated access ${id}`);

  res.json({
    success: true,
    access,
    message: `Updated permissions for ${access.caregiverName}`,
  });
});

router.delete("/api/caregiver/access/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const access = caregiverAccessStore.get(id);

  if (!access) {
    return res.status(404).json({ error: "Caregiver access record not found" });
  }

  access.isActive = false;
  access.updatedAt = new Date().toISOString();
  caregiverAccessStore.set(id, access);

  console.log(`[CaregiverAccess] Revoked access ${id} for ${access.caregiverName}`);

  res.json({
    success: true,
    message: `Revoked access for ${access.caregiverName}`,
  });
});

router.get("/api/caregiver/permission-presets", (_req: Request, res: Response) => {
  res.json({
    presets: [
      {
        id: "view_only",
        name: "View Only",
        description: "Can view health records but cannot make changes",
        permissions: {
          ...defaultPermissions,
          editMedications: false,
          editConditions: false,
          editAppointments: false,
          uploadDocuments: false,
          editTimeline: false,
          addSideEffects: false,
          editCancerTrack: false,
          canExportData: false,
        },
      },
      {
        id: "limited_access",
        name: "Limited Access",
        description: "Can view and add notes, log symptoms, upload documents",
        permissions: {
          ...defaultPermissions,
          uploadDocuments: true,
          addSideEffects: true,
          respondToNotifications: true,
        },
      },
      {
        id: "medication_manager",
        name: "Medication Manager",
        description: "Can manage medications and log side effects",
        permissions: {
          ...defaultPermissions,
          editMedications: true,
          addSideEffects: true,
          respondToNotifications: true,
        },
      },
      {
        id: "full_access",
        name: "Full Access",
        description: "Complete access to view, edit, and manage all records",
        permissions: fullAccessPermissions,
      },
    ],
    relationshipTypes: [
      { id: "spouse", label: "Spouse/Partner" },
      { id: "parent", label: "Parent" },
      { id: "child", label: "Adult Child" },
      { id: "sibling", label: "Sibling" },
      { id: "relative", label: "Other Relative" },
      { id: "friend", label: "Friend" },
      { id: "professional_caregiver", label: "Professional Caregiver" },
      { id: "healthcare_proxy", label: "Healthcare Proxy" },
    ],
    expiryOptions: [
      { days: 7, label: "1 Week" },
      { days: 30, label: "1 Month" },
      { days: 90, label: "3 Months" },
      { days: 180, label: "6 Months" },
      { days: 365, label: "1 Year" },
      { days: null, label: "No Expiry" },
    ],
  });
});

export default router;
