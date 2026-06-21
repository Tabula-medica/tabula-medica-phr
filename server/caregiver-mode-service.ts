import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export type PermissionLevel = "full" | "read_only" | "emergency_only";
export type PermissionCategory = "records" | "medications" | "appointments" | "documents" | "messaging" | "care_plans";

export interface CaregiverPermission {
  category: PermissionCategory;
  level: PermissionLevel;
  canShare: boolean;
}

export interface Dependent {
  id: string;
  name: string;
  relationship: string;
  dateOfBirth: string;
  photoUrl: string | null;
  primaryConditions: string[];
  lastAccessed: string | null;
}

export interface CaregiverProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  isVerified: boolean;
  createdAt: string;
  dependents: CaregiverDependent[];
}

export interface CaregiverDependent {
  dependent: Dependent;
  permissions: CaregiverPermission[];
  permissionExpiresAt: string | null;
  grantedBy: string;
  grantedAt: string;
  isActive: boolean;
  accessCode: string | null;
}

export interface CaregiverAuditEntry {
  id: string;
  caregiverId: string;
  caregiverName: string;
  dependentId: string;
  dependentName: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: string;
  ipAddress: string | null;
  timestamp: string;
}

export interface SharedSnapshot {
  id: string;
  dependentId: string;
  dependentName: string;
  caregiverId: string;
  caregiverName: string;
  snapshotType: "clinical" | "medications" | "appointments" | "full";
  title: string;
  createdAt: string;
  expiresAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  isRevoked: boolean;
}

const mockDependents: Dependent[] = [
  {
    id: "dep-1",
    name: "Margaret Johnson",
    relationship: "Mother",
    dateOfBirth: "1945-03-15",
    photoUrl: null,
    primaryConditions: ["Type 2 Diabetes", "Hypertension", "Osteoarthritis"],
    lastAccessed: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "dep-2",
    name: "Robert Johnson",
    relationship: "Father",
    dateOfBirth: "1942-08-22",
    photoUrl: null,
    primaryConditions: ["COPD", "Atrial Fibrillation"],
    lastAccessed: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const mockCaregiverProfiles: CaregiverProfile[] = [
  {
    id: "cg-1",
    userId: "patient-default",
    name: "Jane Doe",
    email: "jane.doe@example.com",
    phone: "+1-555-123-4567",
    isVerified: true,
    createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    dependents: [
      {
        dependent: mockDependents[0],
        permissions: [
          { category: "records", level: "full", canShare: true },
          { category: "medications", level: "full", canShare: true },
          { category: "appointments", level: "full", canShare: false },
          { category: "documents", level: "read_only", canShare: false },
          { category: "messaging", level: "read_only", canShare: false },
          { category: "care_plans", level: "full", canShare: true },
        ],
        permissionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        grantedBy: "Margaret Johnson",
        grantedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        accessCode: "MJ-2024-CARE",
      },
      {
        dependent: mockDependents[1],
        permissions: [
          { category: "records", level: "read_only", canShare: false },
          { category: "medications", level: "read_only", canShare: false },
          { category: "appointments", level: "full", canShare: false },
          { category: "documents", level: "read_only", canShare: false },
          { category: "messaging", level: "emergency_only", canShare: false },
          { category: "care_plans", level: "read_only", canShare: false },
        ],
        permissionExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        grantedBy: "Robert Johnson",
        grantedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
        accessCode: "RJ-2024-CARE",
      },
    ],
  },
];

const mockAuditTrail: CaregiverAuditEntry[] = [
  {
    id: "audit-1",
    caregiverId: "cg-1",
    caregiverName: "Jane Doe",
    dependentId: "dep-1",
    dependentName: "Margaret Johnson",
    action: "view",
    resourceType: "LabResult",
    resourceId: "lab-123",
    details: "Viewed HbA1c lab result from 01/10/2026",
    ipAddress: "192.168.1.100",
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "audit-2",
    caregiverId: "cg-1",
    caregiverName: "Jane Doe",
    dependentId: "dep-1",
    dependentName: "Margaret Johnson",
    action: "share",
    resourceType: "ClinicalSnapshot",
    resourceId: "snap-456",
    details: "Shared clinical snapshot with Dr. Chen via secure link",
    ipAddress: "192.168.1.100",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "audit-3",
    caregiverId: "cg-1",
    caregiverName: "Jane Doe",
    dependentId: "dep-1",
    dependentName: "Margaret Johnson",
    action: "update",
    resourceType: "Medication",
    resourceId: "med-789",
    details: "Updated medication schedule for Metformin",
    ipAddress: "192.168.1.100",
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "audit-4",
    caregiverId: "cg-1",
    caregiverName: "Jane Doe",
    dependentId: "dep-2",
    dependentName: "Robert Johnson",
    action: "view",
    resourceType: "Appointment",
    resourceId: "appt-101",
    details: "Viewed upcoming cardiology appointment",
    ipAddress: "192.168.1.100",
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const mockSharedSnapshots: SharedSnapshot[] = [
  {
    id: "share-1",
    dependentId: "dep-1",
    dependentName: "Margaret Johnson",
    caregiverId: "cg-1",
    caregiverName: "Jane Doe",
    snapshotType: "clinical",
    title: "Diabetes Management Summary - January 2026",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000).toISOString(),
    accessCount: 2,
    lastAccessedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    isRevoked: false,
  },
  {
    id: "share-2",
    dependentId: "dep-1",
    dependentName: "Margaret Johnson",
    caregiverId: "cg-1",
    caregiverName: "Jane Doe",
    snapshotType: "medications",
    title: "Current Medications List",
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString(),
    accessCount: 5,
    lastAccessedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    isRevoked: false,
  },
];

let caregiverProfiles = [...mockCaregiverProfiles];
let auditTrail = [...mockAuditTrail];
let sharedSnapshots = [...mockSharedSnapshots];

export async function getCaregiverProfile(userId: string): Promise<CaregiverProfile | null> {
  return caregiverProfiles.find(cp => cp.userId === userId) || null;
}

export async function getDependents(userId: string): Promise<CaregiverDependent[]> {
  const profile = await getCaregiverProfile(userId);
  if (!profile) return [];
  return profile.dependents.filter(d => d.isActive);
}

export async function getDependentById(
  userId: string,
  dependentId: string
): Promise<CaregiverDependent | null> {
  const profile = await getCaregiverProfile(userId);
  if (!profile) return null;
  return profile.dependents.find(d => d.dependent.id === dependentId && d.isActive) || null;
}

export async function updateDependentAccess(
  userId: string,
  dependentId: string
): Promise<void> {
  const profileIndex = caregiverProfiles.findIndex(cp => cp.userId === userId);
  if (profileIndex === -1) return;

  const depIndex = caregiverProfiles[profileIndex].dependents.findIndex(
    d => d.dependent.id === dependentId
  );
  if (depIndex === -1) return;

  caregiverProfiles[profileIndex].dependents[depIndex].dependent.lastAccessed = 
    new Date().toISOString();
}

export async function getAuditTrail(
  userId: string,
  dependentId?: string,
  limit: number = 50
): Promise<CaregiverAuditEntry[]> {
  const profile = await getCaregiverProfile(userId);
  if (!profile) return [];

  let entries = auditTrail.filter(a => a.caregiverId === profile.id);
  
  if (dependentId) {
    entries = entries.filter(a => a.dependentId === dependentId);
  }

  return entries
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export async function logCaregiverAction(
  userId: string,
  dependentId: string,
  action: string,
  resourceType: string,
  resourceId: string | null,
  details: string,
  ipAddress?: string
): Promise<void> {
  const profile = await getCaregiverProfile(userId);
  if (!profile) return;

  const dependent = await getDependentById(userId, dependentId);
  if (!dependent) return;

  const entry: CaregiverAuditEntry = {
    id: `audit-${Date.now()}`,
    caregiverId: profile.id,
    caregiverName: profile.name,
    dependentId,
    dependentName: dependent.dependent.name,
    action,
    resourceType,
    resourceId,
    details,
    ipAddress: ipAddress || null,
    timestamp: new Date().toISOString(),
  };

  auditTrail.push(entry);
}

export async function getSharedSnapshots(
  userId: string,
  dependentId?: string
): Promise<SharedSnapshot[]> {
  const profile = await getCaregiverProfile(userId);
  if (!profile) return [];

  let snapshots = sharedSnapshots.filter(s => s.caregiverId === profile.id && !s.isRevoked);

  if (dependentId) {
    snapshots = snapshots.filter(s => s.dependentId === dependentId);
  }

  return snapshots.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function createSharedSnapshot(
  userId: string,
  dependentId: string,
  snapshotType: "clinical" | "medications" | "appointments" | "full",
  title: string,
  expiresInDays: number = 30
): Promise<SharedSnapshot | null> {
  const profile = await getCaregiverProfile(userId);
  if (!profile) return null;

  const dependent = await getDependentById(userId, dependentId);
  if (!dependent) return null;

  const categoryMap: Record<string, PermissionCategory> = {
    clinical: "records",
    medications: "medications",
    appointments: "appointments",
    full: "records",
  };

  const permission = dependent.permissions.find(p => p.category === categoryMap[snapshotType]);
  if (!permission || !permission.canShare) {
    return null;
  }

  const snapshot: SharedSnapshot = {
    id: `share-${Date.now()}`,
    dependentId,
    dependentName: dependent.dependent.name,
    caregiverId: profile.id,
    caregiverName: profile.name,
    snapshotType,
    title,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
    accessCount: 0,
    lastAccessedAt: null,
    isRevoked: false,
  };

  sharedSnapshots.push(snapshot);

  await logCaregiverAction(
    userId,
    dependentId,
    "share",
    "Snapshot",
    snapshot.id,
    `Created ${snapshotType} snapshot: ${title}`
  );

  return snapshot;
}

export async function revokeSharedSnapshot(
  userId: string,
  snapshotId: string
): Promise<boolean> {
  const profile = await getCaregiverProfile(userId);
  if (!profile) return false;

  const index = sharedSnapshots.findIndex(
    s => s.id === snapshotId && s.caregiverId === profile.id
  );
  if (index === -1) return false;

  sharedSnapshots[index].isRevoked = true;

  await logCaregiverAction(
    userId,
    sharedSnapshots[index].dependentId,
    "revoke",
    "Snapshot",
    snapshotId,
    `Revoked snapshot: ${sharedSnapshots[index].title}`
  );

  return true;
}

export async function checkPermissionExpiry(userId: string): Promise<{
  expiringSoon: CaregiverDependent[];
  expired: CaregiverDependent[];
}> {
  const dependents = await getDependents(userId);
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  const expiringSoon: CaregiverDependent[] = [];
  const expired: CaregiverDependent[] = [];

  for (const dep of dependents) {
    if (dep.permissionExpiresAt) {
      const expiryTime = new Date(dep.permissionExpiresAt).getTime();
      if (expiryTime < now) {
        expired.push(dep);
      } else if (expiryTime - now < thirtyDays) {
        expiringSoon.push(dep);
      }
    }
  }

  return { expiringSoon, expired };
}

export async function getCaregiverStats(userId: string): Promise<{
  totalDependents: number;
  activeDependents: number;
  sharedSnapshotsCount: number;
  recentActionsCount: number;
  permissionsExpiringSoon: number;
}> {
  const profile = await getCaregiverProfile(userId);
  if (!profile) {
    return {
      totalDependents: 0,
      activeDependents: 0,
      sharedSnapshotsCount: 0,
      recentActionsCount: 0,
      permissionsExpiringSoon: 0,
    };
  }

  const activeDeps = profile.dependents.filter(d => d.isActive);
  const snapshots = await getSharedSnapshots(userId);
  const recentAudit = await getAuditTrail(userId, undefined, 30);
  const { expiringSoon } = await checkPermissionExpiry(userId);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentActions = recentAudit.filter(
    a => new Date(a.timestamp).getTime() > sevenDaysAgo
  );

  return {
    totalDependents: profile.dependents.length,
    activeDependents: activeDeps.length,
    sharedSnapshotsCount: snapshots.length,
    recentActionsCount: recentActions.length,
    permissionsExpiringSoon: expiringSoon.length,
  };
}

export interface DependentTimeline {
  events: Array<{
    id: string;
    type: "lab" | "appointment" | "medication" | "document" | "vitals" | "procedure";
    title: string;
    description: string;
    date: string;
    provider: string | null;
    status: "normal" | "attention" | "critical";
  }>;
}

export async function getDependentTimeline(
  userId: string,
  dependentId: string
): Promise<DependentTimeline> {
  const dependent = await getDependentById(userId, dependentId);
  if (!dependent) return { events: [] };

  await updateDependentAccess(userId, dependentId);

  const events = [
    {
      id: "evt-1",
      type: "lab" as const,
      title: "HbA1c Test",
      description: "Result: 7.2% (slightly elevated)",
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      provider: "Quest Diagnostics",
      status: "attention" as const,
    },
    {
      id: "evt-2",
      type: "appointment" as const,
      title: "Primary Care Visit",
      description: "Annual wellness exam with Dr. Chen",
      date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      provider: "Dr. Sarah Chen",
      status: "normal" as const,
    },
    {
      id: "evt-3",
      type: "medication" as const,
      title: "Metformin Refill",
      description: "90-day supply dispensed",
      date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      provider: "CVS Pharmacy",
      status: "normal" as const,
    },
    {
      id: "evt-4",
      type: "vitals" as const,
      title: "Blood Pressure Reading",
      description: "138/85 mmHg (slightly elevated)",
      date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      provider: null,
      status: "attention" as const,
    },
    {
      id: "evt-5",
      type: "document" as const,
      title: "Care Plan Updated",
      description: "Diabetes management plan revised",
      date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      provider: "Dr. Sarah Chen",
      status: "normal" as const,
    },
  ];

  await logCaregiverAction(
    userId,
    dependentId,
    "view",
    "Timeline",
    null,
    `Viewed health timeline for ${dependent.dependent.name}`
  );

  return { events };
}

export async function searchDependentRecords(
  userId: string,
  dependentId: string,
  query: string
): Promise<Array<{
  id: string;
  type: string;
  title: string;
  date: string;
  relevance: number;
}>> {
  const dependent = await getDependentById(userId, dependentId);
  if (!dependent) return [];

  const permission = dependent.permissions.find(p => p.category === "records");
  if (!permission || permission.level === "emergency_only") return [];

  await logCaregiverAction(
    userId,
    dependentId,
    "search",
    "Records",
    null,
    `Searched records: "${query}"`
  );

  const mockResults = [
    { id: "rec-1", type: "LabResult", title: "Complete Blood Count (CBC)", date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), relevance: 0.95 },
    { id: "rec-2", type: "Medication", title: "Metformin 1000mg", date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), relevance: 0.88 },
    { id: "rec-3", type: "Document", title: "Discharge Summary", date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), relevance: 0.75 },
  ];

  return mockResults;
}
