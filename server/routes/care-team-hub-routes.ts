import { Router, Request, Response } from "express";
import { z } from "zod";

const router = Router();

interface CareTeamMember {
  id: string;
  patientId: string;
  userId: string;
  name: string;
  email: string;
  role: "healthcare_provider" | "family_member" | "caregiver";
  providerType?: string;
  specialty?: string;
  relationship?: string;
  permissions: {
    viewHealthRecords: boolean;
    viewMedications: boolean;
    viewLabResults: boolean;
    viewAppointments: boolean;
    addNotes: boolean;
    contributeCarePlan: boolean;
    sendMessages: boolean;
  };
  status: "pending" | "active" | "revoked";
  invitedAt: string;
  acceptedAt?: string;
  invitedBy: string;
  lastAccessAt?: string;
}

interface CareTeamInvitation {
  id: string;
  patientId: string;
  patientName: string;
  inviteeEmail: string;
  inviteeName: string;
  role: "healthcare_provider" | "family_member" | "caregiver";
  providerType?: string;
  relationship?: string;
  permissions: CareTeamMember["permissions"];
  status: "pending" | "accepted" | "declined" | "expired";
  inviteCode: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt?: string;
}

interface CareTeamMessage {
  id: string;
  patientId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  isEncrypted: boolean;
  readBy: Array<{ memberId: string; readAt: string }>;
  createdAt: string;
}

interface CareTeamNote {
  id: string;
  patientId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  title: string;
  content: string;
  category: "general" | "medication" | "care_plan" | "observation" | "recommendation";
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SharedHealthView {
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  recentConditions: Array<{ name: string; diagnosedDate: string; status: string }>;
  activeMedications: Array<{ name: string; dosage: string; frequency: string; prescribedBy: string }>;
  recentLabResults: Array<{ testName: string; value: string; unit: string; date: string; status: string }>;
  upcomingAppointments: Array<{ title: string; date: string; provider: string; location: string }>;
  healthSummary: string;
  lastUpdated: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  patientId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: string;
  ipAddress: string;
  sessionId: string;
}

const auditLogs: AuditLogEntry[] = [];

function logAuditEvent(event: Omit<AuditLogEntry, "id" | "timestamp" | "ipAddress" | "sessionId">) {
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    ipAddress: "127.0.0.1",
    sessionId: `session-${Math.random().toString(36).substr(2, 9)}`,
    ...event
  };
  auditLogs.push(entry);
  console.log(`[HIPAA-AUDIT][CareTeamHub] ${entry.action}: ${entry.details}`);
  return entry;
}

const samplePatientId = "patient-001";
const samplePatientName = "John Smith";

const careTeamMembers: CareTeamMember[] = [
  {
    id: "ctm-001",
    patientId: samplePatientId,
    userId: "dr-sarah-wilson",
    name: "Dr. Sarah Wilson",
    email: "sarah.wilson@hospital.com",
    role: "healthcare_provider",
    providerType: "physician",
    specialty: "Internal Medicine",
    permissions: {
      viewHealthRecords: true,
      viewMedications: true,
      viewLabResults: true,
      viewAppointments: true,
      addNotes: true,
      contributeCarePlan: true,
      sendMessages: true
    },
    status: "active",
    invitedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    acceptedAt: new Date(Date.now() - 89 * 24 * 60 * 60 * 1000).toISOString(),
    invitedBy: samplePatientId,
    lastAccessAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "ctm-002",
    patientId: samplePatientId,
    userId: "nurse-emily",
    name: "Emily Johnson, RN",
    email: "emily.johnson@hospital.com",
    role: "healthcare_provider",
    providerType: "nurse",
    permissions: {
      viewHealthRecords: true,
      viewMedications: true,
      viewLabResults: true,
      viewAppointments: true,
      addNotes: true,
      contributeCarePlan: false,
      sendMessages: true
    },
    status: "active",
    invitedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    acceptedAt: new Date(Date.now() - 59 * 24 * 60 * 60 * 1000).toISOString(),
    invitedBy: samplePatientId,
    lastAccessAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "ctm-003",
    patientId: samplePatientId,
    userId: "family-jane",
    name: "Jane Smith",
    email: "jane.smith@email.com",
    role: "family_member",
    relationship: "Spouse",
    permissions: {
      viewHealthRecords: true,
      viewMedications: true,
      viewLabResults: false,
      viewAppointments: true,
      addNotes: true,
      contributeCarePlan: false,
      sendMessages: true
    },
    status: "active",
    invitedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    acceptedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString(),
    invitedBy: samplePatientId,
    lastAccessAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
  }
];

const careTeamInvitations: CareTeamInvitation[] = [
  {
    id: "inv-001",
    patientId: samplePatientId,
    patientName: samplePatientName,
    inviteeEmail: "dr.michael.chen@cardiology.com",
    inviteeName: "Dr. Michael Chen",
    role: "healthcare_provider",
    providerType: "specialist",
    permissions: {
      viewHealthRecords: true,
      viewMedications: true,
      viewLabResults: true,
      viewAppointments: true,
      addNotes: true,
      contributeCarePlan: true,
      sendMessages: true
    },
    status: "pending",
    inviteCode: "CARE-" + Math.random().toString(36).substr(2, 8).toUpperCase(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const careTeamMessages: CareTeamMessage[] = [
  {
    id: "msg-001",
    patientId: samplePatientId,
    conversationId: "conv-main",
    senderId: "dr-sarah-wilson",
    senderName: "Dr. Sarah Wilson",
    senderRole: "healthcare_provider",
    content: "I've reviewed the latest lab results. Blood glucose levels are well controlled. Let's continue with the current medication regimen.",
    isEncrypted: true,
    readBy: [
      { memberId: "nurse-emily", readAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString() },
      { memberId: "family-jane", readAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() }
    ],
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "msg-002",
    patientId: samplePatientId,
    conversationId: "conv-main",
    senderId: "family-jane",
    senderName: "Jane Smith",
    senderRole: "family_member",
    content: "Thank you, Dr. Wilson. John has been following the diet plan closely. Are there any activities he should avoid?",
    isEncrypted: true,
    readBy: [
      { memberId: "dr-sarah-wilson", readAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() }
    ],
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "msg-003",
    patientId: samplePatientId,
    conversationId: "conv-main",
    senderId: "dr-sarah-wilson",
    senderName: "Dr. Sarah Wilson",
    senderRole: "healthcare_provider",
    content: "Light to moderate exercise is encouraged - walking, swimming are great. Just avoid high-intensity activities without prior clearance. I'll note this in the care plan.",
    isEncrypted: true,
    readBy: [],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  }
];

const careTeamNotes: CareTeamNote[] = [
  {
    id: "note-001",
    patientId: samplePatientId,
    authorId: "dr-sarah-wilson",
    authorName: "Dr. Sarah Wilson",
    authorRole: "healthcare_provider",
    title: "Quarterly Care Plan Review",
    content: "Patient is responding well to current treatment plan. HbA1c levels have improved from 7.8% to 6.9%. Blood pressure is well controlled at 128/82. Recommend continuing current medications and lifestyle modifications. Next review in 3 months.",
    category: "care_plan",
    isPrivate: false,
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "note-002",
    patientId: samplePatientId,
    authorId: "nurse-emily",
    authorName: "Emily Johnson, RN",
    authorRole: "healthcare_provider",
    title: "Patient Education Session Completed",
    content: "Completed 30-minute education session on diabetes self-management. Covered blood glucose monitoring, medication timing, and recognizing hypoglycemia symptoms. Patient demonstrated good understanding. Provided written materials for home reference.",
    category: "observation",
    isPrivate: false,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "note-003",
    patientId: samplePatientId,
    authorId: "family-jane",
    authorName: "Jane Smith",
    authorRole: "family_member",
    title: "Home Observation - Diet Compliance",
    content: "John has been following the recommended diet closely for the past 2 weeks. He's enjoying the new meal plan and has lost 3 pounds. Energy levels seem improved. Minor complaint of occasional dizziness in the morning - usually resolves after breakfast.",
    category: "observation",
    isPrivate: false,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  }
];

const sharedHealthView: SharedHealthView = {
  patientId: samplePatientId,
  patientName: samplePatientName,
  dateOfBirth: "1965-03-15",
  recentConditions: [
    { name: "Type 2 Diabetes Mellitus", diagnosedDate: "2020-06-15", status: "active" },
    { name: "Essential Hypertension", diagnosedDate: "2018-03-22", status: "active" },
    { name: "Hyperlipidemia", diagnosedDate: "2019-11-10", status: "active" }
  ],
  activeMedications: [
    { name: "Metformin", dosage: "1000mg", frequency: "Twice daily", prescribedBy: "Dr. Sarah Wilson" },
    { name: "Lisinopril", dosage: "20mg", frequency: "Once daily", prescribedBy: "Dr. Sarah Wilson" },
    { name: "Atorvastatin", dosage: "40mg", frequency: "Once daily at bedtime", prescribedBy: "Dr. Sarah Wilson" }
  ],
  recentLabResults: [
    { testName: "HbA1c", value: "6.9", unit: "%", date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), status: "normal" },
    { testName: "Fasting Glucose", value: "118", unit: "mg/dL", date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), status: "borderline" },
    { testName: "Total Cholesterol", value: "185", unit: "mg/dL", date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), status: "normal" },
    { testName: "Blood Pressure", value: "128/82", unit: "mmHg", date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), status: "normal" }
  ],
  upcomingAppointments: [
    { title: "Quarterly Diabetes Check-up", date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), provider: "Dr. Sarah Wilson", location: "Primary Care Clinic" },
    { title: "Ophthalmology Screening", date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), provider: "Dr. Michael Chen", location: "Eye Care Center" }
  ],
  healthSummary: "Patient is managing Type 2 Diabetes, Hypertension, and Hyperlipidemia. Recent improvements in blood glucose control with HbA1c at 6.9%. Blood pressure well controlled. Currently on stable medication regimen with good compliance. Lifestyle modifications including diet and exercise being followed consistently.",
  lastUpdated: new Date().toISOString()
};

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    logAuditEvent({
      patientId: samplePatientId,
      actorId: "current-user",
      actorName: "Current User",
      actorRole: "patient",
      action: "VIEW_DASHBOARD",
      resourceType: "CareTeamDashboard",
      resourceId: samplePatientId,
      details: "Accessed care team hub dashboard"
    });

    const activeMembers = careTeamMembers.filter(m => m.status === "active");
    const pendingInvites = careTeamInvitations.filter(i => i.status === "pending");
    const unreadMessages = careTeamMessages.filter(m => 
      !m.readBy.some(r => r.memberId === samplePatientId)
    );
    const recentNotes = careTeamNotes.slice(0, 5);

    res.json({
      success: true,
      dashboard: {
        teamMembers: {
          total: activeMembers.length,
          providers: activeMembers.filter(m => m.role === "healthcare_provider").length,
          family: activeMembers.filter(m => m.role === "family_member" || m.role === "caregiver").length,
          pendingInvites: pendingInvites.length
        },
        messaging: {
          unreadCount: unreadMessages.length,
          totalMessages: careTeamMessages.length,
          lastMessageAt: careTeamMessages[careTeamMessages.length - 1]?.createdAt
        },
        notes: {
          totalNotes: careTeamNotes.length,
          recentNotesCount: recentNotes.length
        },
        recentActivity: [
          ...careTeamMessages.slice(-3).map(m => ({
            type: "message",
            title: `Message from ${m.senderName}`,
            timestamp: m.createdAt,
            description: m.content.substring(0, 80) + (m.content.length > 80 ? "..." : "")
          })),
          ...careTeamNotes.slice(-2).map(n => ({
            type: "note",
            title: n.title,
            timestamp: n.createdAt,
            description: `Added by ${n.authorName}`
          }))
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5)
      }
    });
  } catch (error: any) {
    console.error("[CareTeamHub] Dashboard error:", error);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

router.get("/team-members", async (req: Request, res: Response) => {
  try {
    logAuditEvent({
      patientId: samplePatientId,
      actorId: "current-user",
      actorName: "Current User",
      actorRole: "patient",
      action: "VIEW_TEAM_MEMBERS",
      resourceType: "CareTeamMember",
      resourceId: samplePatientId,
      details: `Retrieved ${careTeamMembers.length} team members`
    });

    res.json({
      success: true,
      members: careTeamMembers,
      summary: {
        total: careTeamMembers.length,
        active: careTeamMembers.filter(m => m.status === "active").length,
        pending: careTeamMembers.filter(m => m.status === "pending").length,
        revoked: careTeamMembers.filter(m => m.status === "revoked").length
      }
    });
  } catch (error: any) {
    console.error("[CareTeamHub] Team members error:", error);
    res.status(500).json({ error: "Failed to load team members" });
  }
});

router.get("/invitations", async (req: Request, res: Response) => {
  try {
    logAuditEvent({
      patientId: samplePatientId,
      actorId: "current-user",
      actorName: "Current User",
      actorRole: "patient",
      action: "VIEW_INVITATIONS",
      resourceType: "CareTeamInvitation",
      resourceId: samplePatientId,
      details: `Retrieved ${careTeamInvitations.length} invitations`
    });

    res.json({
      success: true,
      invitations: careTeamInvitations
    });
  } catch (error: any) {
    console.error("[CareTeamHub] Invitations error:", error);
    res.status(500).json({ error: "Failed to load invitations" });
  }
});

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["healthcare_provider", "family_member", "caregiver"]),
  providerType: z.string().optional(),
  specialty: z.string().optional(),
  relationship: z.string().optional(),
  permissions: z.object({
    viewHealthRecords: z.boolean(),
    viewMedications: z.boolean(),
    viewLabResults: z.boolean(),
    viewAppointments: z.boolean(),
    addNotes: z.boolean(),
    contributeCarePlan: z.boolean(),
    sendMessages: z.boolean()
  })
});

router.post("/invite", async (req: Request, res: Response) => {
  try {
    const validation = inviteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.issues });
    }

    const { email, name, role, providerType, specialty, relationship, permissions } = validation.data;

    const existingMember = careTeamMembers.find(m => m.email === email && m.status === "active");
    if (existingMember) {
      return res.status(400).json({ error: "This person is already a member of your care team" });
    }

    const existingInvite = careTeamInvitations.find(i => i.inviteeEmail === email && i.status === "pending");
    if (existingInvite) {
      return res.status(400).json({ error: "An invitation is already pending for this email" });
    }

    const invitation: CareTeamInvitation = {
      id: `inv-${Date.now()}`,
      patientId: samplePatientId,
      patientName: samplePatientName,
      inviteeEmail: email,
      inviteeName: name,
      role,
      providerType,
      permissions,
      status: "pending",
      inviteCode: "CARE-" + Math.random().toString(36).substr(2, 8).toUpperCase(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString()
    };

    careTeamInvitations.push(invitation);

    logAuditEvent({
      patientId: samplePatientId,
      actorId: "current-user",
      actorName: samplePatientName,
      actorRole: "patient",
      action: "SEND_INVITATION",
      resourceType: "CareTeamInvitation",
      resourceId: invitation.id,
      details: `Sent care team invitation to ${name} (${email}) as ${role}`
    });

    res.json({
      success: true,
      invitation,
      message: `Invitation sent to ${name} at ${email}`
    });
  } catch (error: any) {
    console.error("[CareTeamHub] Invite error:", error);
    res.status(500).json({ error: "Failed to send invitation" });
  }
});

router.post("/invitations/:invitationId/resend", async (req: Request, res: Response) => {
  try {
    const { invitationId } = req.params;
    const invitation = careTeamInvitations.find(i => i.id === invitationId);

    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    invitation.inviteCode = "CARE-" + Math.random().toString(36).substr(2, 8).toUpperCase();

    logAuditEvent({
      patientId: samplePatientId,
      actorId: "current-user",
      actorName: samplePatientName,
      actorRole: "patient",
      action: "RESEND_INVITATION",
      resourceType: "CareTeamInvitation",
      resourceId: invitation.id,
      details: `Resent invitation to ${invitation.inviteeName}`
    });

    res.json({
      success: true,
      invitation,
      message: `Invitation resent to ${invitation.inviteeName}`
    });
  } catch (error: any) {
    console.error("[CareTeamHub] Resend invite error:", error);
    res.status(500).json({ error: "Failed to resend invitation" });
  }
});

router.delete("/invitations/:invitationId", async (req: Request, res: Response) => {
  try {
    const { invitationId } = req.params;
    const index = careTeamInvitations.findIndex(i => i.id === invitationId);

    if (index === -1) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    const invitation = careTeamInvitations[index];
    careTeamInvitations.splice(index, 1);

    logAuditEvent({
      patientId: samplePatientId,
      actorId: "current-user",
      actorName: samplePatientName,
      actorRole: "patient",
      action: "CANCEL_INVITATION",
      resourceType: "CareTeamInvitation",
      resourceId: invitationId,
      details: `Cancelled invitation to ${invitation.inviteeName}`
    });

    res.json({
      success: true,
      message: "Invitation cancelled"
    });
  } catch (error: any) {
    console.error("[CareTeamHub] Cancel invite error:", error);
    res.status(500).json({ error: "Failed to cancel invitation" });
  }
});

router.patch("/team-members/:memberId/permissions", async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const { permissions } = req.body;

    const member = careTeamMembers.find(m => m.id === memberId);
    if (!member) {
      return res.status(404).json({ error: "Team member not found" });
    }

    const oldPermissions = { ...member.permissions };
    member.permissions = { ...member.permissions, ...permissions };

    logAuditEvent({
      patientId: samplePatientId,
      actorId: "current-user",
      actorName: samplePatientName,
      actorRole: "patient",
      action: "UPDATE_PERMISSIONS",
      resourceType: "CareTeamMember",
      resourceId: memberId,
      details: `Updated permissions for ${member.name}: ${JSON.stringify(permissions)}`
    });

    res.json({
      success: true,
      member,
      message: `Permissions updated for ${member.name}`
    });
  } catch (error: any) {
    console.error("[CareTeamHub] Update permissions error:", error);
    res.status(500).json({ error: "Failed to update permissions" });
  }
});

router.post("/team-members/:memberId/revoke", async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const member = careTeamMembers.find(m => m.id === memberId);

    if (!member) {
      return res.status(404).json({ error: "Team member not found" });
    }

    member.status = "revoked";

    logAuditEvent({
      patientId: samplePatientId,
      actorId: "current-user",
      actorName: samplePatientName,
      actorRole: "patient",
      action: "REVOKE_ACCESS",
      resourceType: "CareTeamMember",
      resourceId: memberId,
      details: `Revoked access for ${member.name} (${member.email})`
    });

    res.json({
      success: true,
      message: `Access revoked for ${member.name}`
    });
  } catch (error: any) {
    console.error("[CareTeamHub] Revoke access error:", error);
    res.status(500).json({ error: "Failed to revoke access" });
  }
});

router.get("/shared-health-view", async (req: Request, res: Response) => {
  try {
    logAuditEvent({
      patientId: samplePatientId,
      actorId: "current-user",
      actorName: "Current User",
      actorRole: "team_member",
      action: "VIEW_HEALTH_JOURNEY",
      resourceType: "SharedHealthView",
      resourceId: samplePatientId,
      details: "Accessed shared health journey view"
    });

    res.json({
      success: true,
      healthView: sharedHealthView
    });
  } catch (error: any) {
    console.error("[CareTeamHub] Health view error:", error);
    res.status(500).json({ error: "Failed to load health view" });
  }
});

router.get("/messages", async (req: Request, res: Response) => {
  try {
    logAuditEvent({
      patientId: samplePatientId,
      actorId: "current-user",
      actorName: "Current User",
      actorRole: "team_member",
      action: "VIEW_MESSAGES",
      resourceType: "CareTeamMessage",
      resourceId: "conv-main",
      details: `Retrieved ${careTeamMessages.length} messages`
    });

    res.json({
      success: true,
      messages: careTeamMessages,
      conversationId: "conv-main"
    });
  } catch (error: any) {
    console.error("[CareTeamHub] Messages error:", error);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

const messageSchema = z.object({
  content: z.string().min(1),
  senderId: z.string(),
  senderName: z.string(),
  senderRole: z.string()
});

router.post("/messages", async (req: Request, res: Response) => {
  try {
    const validation = messageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.issues });
    }

    const { content, senderId, senderName, senderRole } = validation.data;

    const message: CareTeamMessage = {
      id: `msg-${Date.now()}`,
      patientId: samplePatientId,
      conversationId: "conv-main",
      senderId,
      senderName,
      senderRole,
      content,
      isEncrypted: true,
      readBy: [],
      createdAt: new Date().toISOString()
    };

    careTeamMessages.push(message);

    logAuditEvent({
      patientId: samplePatientId,
      actorId: senderId,
      actorName: senderName,
      actorRole: senderRole,
      action: "SEND_MESSAGE",
      resourceType: "CareTeamMessage",
      resourceId: message.id,
      details: `Sent message to care team (${content.length} characters)`
    });

    res.json({
      success: true,
      message
    });
  } catch (error: any) {
    console.error("[CareTeamHub] Send message error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.post("/messages/:messageId/read", async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { memberId } = req.body;

    const message = careTeamMessages.find(m => m.id === messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (!message.readBy.some(r => r.memberId === memberId)) {
      message.readBy.push({ memberId, readAt: new Date().toISOString() });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[CareTeamHub] Mark read error:", error);
    res.status(500).json({ error: "Failed to mark message as read" });
  }
});

router.get("/notes", async (req: Request, res: Response) => {
  try {
    logAuditEvent({
      patientId: samplePatientId,
      actorId: "current-user",
      actorName: "Current User",
      actorRole: "team_member",
      action: "VIEW_NOTES",
      resourceType: "CareTeamNote",
      resourceId: samplePatientId,
      details: `Retrieved ${careTeamNotes.length} care plan notes`
    });

    res.json({
      success: true,
      notes: careTeamNotes
    });
  } catch (error: any) {
    console.error("[CareTeamHub] Notes error:", error);
    res.status(500).json({ error: "Failed to load notes" });
  }
});

const noteSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.enum(["general", "medication", "care_plan", "observation", "recommendation"]),
  authorId: z.string(),
  authorName: z.string(),
  authorRole: z.string(),
  isPrivate: z.boolean().optional()
});

router.post("/notes", async (req: Request, res: Response) => {
  try {
    const validation = noteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.issues });
    }

    const { title, content, category, authorId, authorName, authorRole, isPrivate } = validation.data;

    const note: CareTeamNote = {
      id: `note-${Date.now()}`,
      patientId: samplePatientId,
      authorId,
      authorName,
      authorRole,
      title,
      content,
      category,
      isPrivate: isPrivate || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    careTeamNotes.unshift(note);

    logAuditEvent({
      patientId: samplePatientId,
      actorId: authorId,
      actorName: authorName,
      actorRole: authorRole,
      action: "ADD_NOTE",
      resourceType: "CareTeamNote",
      resourceId: note.id,
      details: `Added ${category} note: "${title}"`
    });

    res.json({
      success: true,
      note
    });
  } catch (error: any) {
    console.error("[CareTeamHub] Add note error:", error);
    res.status(500).json({ error: "Failed to add note" });
  }
});

router.patch("/notes/:noteId", async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const { title, content, category } = req.body;

    const note = careTeamNotes.find(n => n.id === noteId);
    if (!note) {
      return res.status(404).json({ error: "Note not found" });
    }

    if (title) note.title = title;
    if (content) note.content = content;
    if (category) note.category = category;
    note.updatedAt = new Date().toISOString();

    logAuditEvent({
      patientId: samplePatientId,
      actorId: note.authorId,
      actorName: note.authorName,
      actorRole: note.authorRole,
      action: "UPDATE_NOTE",
      resourceType: "CareTeamNote",
      resourceId: noteId,
      details: `Updated note: "${note.title}"`
    });

    res.json({
      success: true,
      note
    });
  } catch (error: any) {
    console.error("[CareTeamHub] Update note error:", error);
    res.status(500).json({ error: "Failed to update note" });
  }
});

router.get("/audit-log", async (req: Request, res: Response) => {
  try {
    const patientAuditLogs = auditLogs
      .filter(log => log.patientId === samplePatientId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50);

    res.json({
      success: true,
      auditLogs: patientAuditLogs,
      disclaimer: "This audit log tracks all access and modifications to your health records by care team members. All logs are retained for 7 years per HIPAA requirements."
    });
  } catch (error: any) {
    console.error("[CareTeamHub] Audit log error:", error);
    res.status(500).json({ error: "Failed to load audit log" });
  }
});

console.log("[CareTeamHub] Service initialized");
console.log("[CareTeamHub] Features: Team invitations, Shared health view, Secure messaging, Care plan notes");
console.log("[CareTeamHub] HIPAA audit logging enabled for all PHI access");

export default router;
