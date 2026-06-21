import crypto from "crypto";
import type { SupportedLanguage } from "./unified-ai-onboarding-service";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, patientId: string, details: string) {
  console.log(`[HIPAA-AUDIT][CaregiverAccess] ${action} - Caregiver:${hashIdentifier(userId)} - Patient:${hashIdentifier(patientId)} - ${details}`);
}

export type CaregiverRole = "family_caregiver" | "professional_caregiver" | "healthcare_proxy" | "guardian" | "parent" | "child_of_patient" | "spouse" | "sibling" | "other";
export type AccessLevel = "full" | "limited" | "view_only" | "emergency_only";
export type DataCategory = "demographics" | "conditions" | "medications" | "allergies" | "labs" | "vitals" | "encounters" | "documents" | "immunizations" | "procedures" | "imaging" | "billing" | "messages" | "appointments" | "care_plans";

export interface CaregiverAccess {
  id: string;
  caregiverId: string;
  caregiverName: string;
  caregiverEmail: string;
  caregiverPhone?: string;
  patientId: string;
  patientName: string;
  role: CaregiverRole;
  accessLevel: AccessLevel;
  permissions: GranularPermissions;
  consentDocumentId?: string;
  consentGrantedAt: string;
  consentExpiresAt?: string;
  consentRevokedAt?: string;
  isActive: boolean;
  isPrimary: boolean;
  notificationsEnabled: boolean;
  notificationPreferences: NotificationPreferences;
  restrictions: AccessRestrictions;
  auditLog: CaregiverAuditEntry[];
  lastAccessAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GranularPermissions {
  dataCategories: Record<DataCategory, CategoryPermission>;
  canScheduleAppointments: boolean;
  canSendMessages: boolean;
  canViewMessages: boolean;
  canManageMedications: boolean;
  canAccessEmergencyInfo: boolean;
  canExportData: boolean;
  canShareWithProviders: boolean;
  canUpdateDemographics: boolean;
  canManageConsents: boolean;
  canViewBilling: boolean;
  canPayBills: boolean;
  canRequestRecords: boolean;
  canAddCareNotes: boolean;
  timeRestrictions?: TimeRestrictions;
}

export interface CategoryPermission {
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  requiresApproval: boolean;
}

export interface NotificationPreferences {
  appointmentReminders: boolean;
  medicationReminders: boolean;
  labResults: boolean;
  messages: boolean;
  emergencyAlerts: boolean;
  careTeamUpdates: boolean;
  billingNotifications: boolean;
  channels: ("email" | "sms" | "push" | "in_app")[];
}

export interface AccessRestrictions {
  validFrom?: string;
  validUntil?: string;
  allowedTimeWindows?: TimeWindow[];
  blockedDates?: string[];
  geographicRestrictions?: string[];
  ipRestrictions?: string[];
  requiresMFA: boolean;
  maxSessionDuration: number;
}

export interface TimeRestrictions {
  allowedDays: number[];
  allowedHoursStart: number;
  allowedHoursEnd: number;
  timezone: string;
}

export interface TimeWindow {
  dayOfWeek: number;
  startHour: number;
  endHour: number;
}

export interface CaregiverAuditEntry {
  id: string;
  action: "grant" | "revoke" | "modify" | "access" | "export" | "share" | "message" | "appointment" | "care_note";
  timestamp: string;
  caregiverId: string;
  patientId: string;
  resourceType?: string;
  resourceId?: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  approved?: boolean;
  approvedBy?: string;
}

export interface CaregiverInvitation {
  id: string;
  patientId: string;
  patientName: string;
  inviteeEmail: string;
  inviteeName: string;
  role: CaregiverRole;
  accessLevel: AccessLevel;
  permissions: GranularPermissions;
  invitationCode: string;
  expiresAt: string;
  status: "pending" | "accepted" | "declined" | "expired";
  createdAt: string;
  acceptedAt?: string;
}

export interface CareNote {
  id: string;
  caregiverId: string;
  patientId: string;
  noteType: "observation" | "concern" | "medication_given" | "symptom" | "behavior" | "nutrition" | "activity" | "general";
  content: string;
  severity?: "normal" | "concerning" | "urgent";
  sharedWithCareTeam: boolean;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
}

const caregiverAccess: Map<string, CaregiverAccess> = new Map();
const invitations: Map<string, CaregiverInvitation> = new Map();
const careNotes: Map<string, CareNote> = new Map();

function getDefaultPermissions(accessLevel: AccessLevel): GranularPermissions {
  const viewOnly: CategoryPermission = { canView: true, canAdd: false, canEdit: false, canDelete: false, canExport: false, requiresApproval: true };
  const limited: CategoryPermission = { canView: true, canAdd: true, canEdit: false, canDelete: false, canExport: false, requiresApproval: true };
  const full: CategoryPermission = { canView: true, canAdd: true, canEdit: true, canDelete: false, canExport: true, requiresApproval: false };
  const none: CategoryPermission = { canView: false, canAdd: false, canEdit: false, canDelete: false, canExport: false, requiresApproval: true };

  const categories: DataCategory[] = ["demographics", "conditions", "medications", "allergies", "labs", "vitals", "encounters", "documents", "immunizations", "procedures", "imaging", "billing", "messages", "appointments", "care_plans"];
  
  const dataCategories: Record<DataCategory, CategoryPermission> = {} as any;

  for (const cat of categories) {
    if (accessLevel === "full") {
      dataCategories[cat] = full;
    } else if (accessLevel === "limited") {
      dataCategories[cat] = cat === "billing" ? none : limited;
    } else if (accessLevel === "view_only") {
      dataCategories[cat] = cat === "billing" ? none : viewOnly;
    } else {
      dataCategories[cat] = cat === "medications" || cat === "allergies" || cat === "conditions" ? viewOnly : none;
    }
  }

  return {
    dataCategories,
    canScheduleAppointments: accessLevel === "full" || accessLevel === "limited",
    canSendMessages: accessLevel === "full" || accessLevel === "limited",
    canViewMessages: accessLevel !== "emergency_only",
    canManageMedications: accessLevel === "full",
    canAccessEmergencyInfo: true,
    canExportData: accessLevel === "full",
    canShareWithProviders: accessLevel === "full" || accessLevel === "limited",
    canUpdateDemographics: accessLevel === "full",
    canManageConsents: false,
    canViewBilling: accessLevel === "full",
    canPayBills: false,
    canRequestRecords: accessLevel === "full" || accessLevel === "limited",
    canAddCareNotes: accessLevel !== "emergency_only",
  };
}

export async function grantCaregiverAccess(
  patientId: string,
  patientName: string,
  caregiver: {
    caregiverId: string;
    caregiverName: string;
    caregiverEmail: string;
    caregiverPhone?: string;
  },
  role: CaregiverRole,
  accessLevel: AccessLevel,
  customPermissions?: Partial<GranularPermissions>,
  expiresAt?: string
): Promise<CaregiverAccess> {
  const id = generateId("cga");
  const basePermissions = getDefaultPermissions(accessLevel);
  const permissions = customPermissions ? { ...basePermissions, ...customPermissions } : basePermissions;

  const access: CaregiverAccess = {
    id,
    caregiverId: caregiver.caregiverId,
    caregiverName: caregiver.caregiverName,
    caregiverEmail: caregiver.caregiverEmail,
    caregiverPhone: caregiver.caregiverPhone,
    patientId,
    patientName,
    role,
    accessLevel,
    permissions,
    consentGrantedAt: new Date().toISOString(),
    consentExpiresAt: expiresAt,
    isActive: true,
    isPrimary: false,
    notificationsEnabled: true,
    notificationPreferences: {
      appointmentReminders: true,
      medicationReminders: true,
      labResults: true,
      messages: true,
      emergencyAlerts: true,
      careTeamUpdates: true,
      billingNotifications: false,
      channels: ["email", "push"],
    },
    restrictions: {
      requiresMFA: accessLevel === "full",
      maxSessionDuration: 3600,
    },
    auditLog: [{
      id: generateId("audit"),
      action: "grant",
      timestamp: new Date().toISOString(),
      caregiverId: caregiver.caregiverId,
      patientId,
      details: `Access granted with ${accessLevel} level and ${role} role`,
    }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  caregiverAccess.set(id, access);
  logHipaaAudit("GRANT_ACCESS", caregiver.caregiverId, patientId, `Granted ${accessLevel} access with role ${role}`);

  return access;
}

export function getCaregiverAccess(accessId: string): CaregiverAccess | undefined {
  return caregiverAccess.get(accessId);
}

export function getPatientCaregivers(patientId: string): CaregiverAccess[] {
  const allAccess = Array.from(caregiverAccess.values());
  return allAccess.filter(a => a.patientId === patientId && a.isActive);
}

export function getCaregiverPatients(caregiverId: string): CaregiverAccess[] {
  const allAccess = Array.from(caregiverAccess.values());
  return allAccess.filter(a => a.caregiverId === caregiverId && a.isActive);
}

export function updateCaregiverPermissions(
  accessId: string,
  caregiverId: string,
  updates: Partial<GranularPermissions>
): CaregiverAccess | undefined {
  const access = caregiverAccess.get(accessId);
  if (!access) return undefined;

  access.permissions = { ...access.permissions, ...updates };
  access.updatedAt = new Date().toISOString();

  access.auditLog.push({
    id: generateId("audit"),
    action: "modify",
    timestamp: new Date().toISOString(),
    caregiverId,
    patientId: access.patientId,
    details: `Permissions updated: ${Object.keys(updates).join(", ")}`,
  });

  logHipaaAudit("UPDATE_PERMISSIONS", caregiverId, access.patientId, `Updated permissions`);
  return access;
}

export function revokeCaregiverAccess(
  accessId: string,
  revokedBy: string,
  reason?: string
): boolean {
  const access = caregiverAccess.get(accessId);
  if (!access) return false;

  access.isActive = false;
  access.consentRevokedAt = new Date().toISOString();
  access.updatedAt = new Date().toISOString();

  access.auditLog.push({
    id: generateId("audit"),
    action: "revoke",
    timestamp: new Date().toISOString(),
    caregiverId: access.caregiverId,
    patientId: access.patientId,
    details: `Access revoked by ${revokedBy}${reason ? `: ${reason}` : ""}`,
  });

  logHipaaAudit("REVOKE_ACCESS", access.caregiverId, access.patientId, `Access revoked: ${reason || "No reason"}`);
  return true;
}

export async function createInvitation(
  patientId: string,
  patientName: string,
  inviteeEmail: string,
  inviteeName: string,
  role: CaregiverRole,
  accessLevel: AccessLevel
): Promise<CaregiverInvitation> {
  const id = generateId("inv");
  const invitationCode = crypto.randomBytes(16).toString("hex");

  const invitation: CaregiverInvitation = {
    id,
    patientId,
    patientName,
    inviteeEmail,
    inviteeName,
    role,
    accessLevel,
    permissions: getDefaultPermissions(accessLevel),
    invitationCode,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  invitations.set(id, invitation);
  logHipaaAudit("CREATE_INVITATION", patientId, patientId, `Invitation created for ${inviteeEmail}`);

  return invitation;
}

export function getInvitation(invitationId: string): CaregiverInvitation | undefined {
  return invitations.get(invitationId);
}

export function getInvitationByCode(code: string): CaregiverInvitation | undefined {
  const allInvitations = Array.from(invitations.values());
  return allInvitations.find(i => i.invitationCode === code && i.status === "pending");
}

export async function acceptInvitation(
  invitationCode: string,
  caregiverId: string
): Promise<CaregiverAccess | undefined> {
  const invitation = getInvitationByCode(invitationCode);
  if (!invitation) return undefined;

  if (new Date(invitation.expiresAt) < new Date()) {
    invitation.status = "expired";
    return undefined;
  }

  invitation.status = "accepted";
  invitation.acceptedAt = new Date().toISOString();

  const access = await grantCaregiverAccess(
    invitation.patientId,
    invitation.patientName,
    {
      caregiverId,
      caregiverName: invitation.inviteeName,
      caregiverEmail: invitation.inviteeEmail,
    },
    invitation.role,
    invitation.accessLevel,
    undefined,
    undefined
  );

  return access;
}

export async function addCareNote(
  caregiverId: string,
  patientId: string,
  noteType: CareNote["noteType"],
  content: string,
  severity?: CareNote["severity"],
  sharedWithCareTeam: boolean = false
): Promise<CareNote> {
  const id = generateId("note");

  const note: CareNote = {
    id,
    caregiverId,
    patientId,
    noteType,
    content,
    severity,
    sharedWithCareTeam,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  careNotes.set(id, note);
  logHipaaAudit("ADD_CARE_NOTE", caregiverId, patientId, `Added ${noteType} note${severity === "urgent" ? " (URGENT)" : ""}`);

  return note;
}

export function getPatientCareNotes(patientId: string, caregiverId?: string): CareNote[] {
  const allNotes = Array.from(careNotes.values());
  let notes = allNotes.filter(n => n.patientId === patientId);
  if (caregiverId) {
    notes = notes.filter(n => n.caregiverId === caregiverId);
  }
  return notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function logCaregiverAction(
  accessId: string,
  action: CaregiverAuditEntry["action"],
  details: string,
  resourceType?: string,
  resourceId?: string
): void {
  const access = caregiverAccess.get(accessId);
  if (!access) return;

  access.lastAccessAt = new Date().toISOString();
  access.auditLog.push({
    id: generateId("audit"),
    action,
    timestamp: new Date().toISOString(),
    caregiverId: access.caregiverId,
    patientId: access.patientId,
    resourceType,
    resourceId,
    details,
  });

  logHipaaAudit(action.toUpperCase(), access.caregiverId, access.patientId, details);
}

export function getCaregiverAuditLog(accessId: string): CaregiverAuditEntry[] {
  const access = caregiverAccess.get(accessId);
  return access?.auditLog || [];
}

export function checkPermission(
  accessId: string,
  category: DataCategory,
  action: "view" | "add" | "edit" | "delete" | "export"
): boolean {
  const access = caregiverAccess.get(accessId);
  if (!access || !access.isActive) return false;

  if (access.consentExpiresAt && new Date(access.consentExpiresAt) < new Date()) return false;

  const categoryPermission = access.permissions.dataCategories[category];
  if (!categoryPermission) return false;

  switch (action) {
    case "view": return categoryPermission.canView;
    case "add": return categoryPermission.canAdd;
    case "edit": return categoryPermission.canEdit;
    case "delete": return categoryPermission.canDelete;
    case "export": return categoryPermission.canExport;
    default: return false;
  }
}

export function getSupportedRoles(): Record<CaregiverRole, { name: string; description: string }> {
  return {
    family_caregiver: { name: "Family Caregiver", description: "Family member providing care" },
    professional_caregiver: { name: "Professional Caregiver", description: "Hired caregiver or aide" },
    healthcare_proxy: { name: "Healthcare Proxy", description: "Designated healthcare decision maker" },
    guardian: { name: "Legal Guardian", description: "Court-appointed guardian" },
    parent: { name: "Parent", description: "Parent of minor child" },
    child_of_patient: { name: "Child of Patient", description: "Adult child of patient" },
    spouse: { name: "Spouse/Partner", description: "Spouse or domestic partner" },
    sibling: { name: "Sibling", description: "Brother or sister" },
    other: { name: "Other", description: "Other relationship" },
  };
}

export function getSupportedAccessLevels(): Record<AccessLevel, { name: string; description: string }> {
  return {
    full: { name: "Full Access", description: "Complete access to all health records and actions" },
    limited: { name: "Limited Access", description: "View and add records, schedule appointments, send messages" },
    view_only: { name: "View Only", description: "View health records without modification abilities" },
    emergency_only: { name: "Emergency Only", description: "Access to critical information only (medications, allergies, conditions)" },
  };
}

console.log("[EnhancedCaregiverAccess] Service initialized with granular permissions, invitations, and care notes");
