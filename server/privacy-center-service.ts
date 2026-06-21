export type SourceType = "ehr" | "pharmacy" | "lab" | "insurance" | "wearable" | "manual";
export type SourceStatus = "connected" | "disconnected" | "error" | "syncing";

export interface ConnectedSource {
  id: string;
  name: string;
  type: SourceType;
  status: SourceStatus;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  recordsImported: number;
  connectedAt: string;
  permissions: string[];
  logoUrl: string | null;
}

export interface DataExportRequest {
  id: string;
  userId: string;
  format: "json" | "pdf" | "fhir";
  status: "pending" | "processing" | "completed" | "failed";
  requestedAt: string;
  completedAt: string | null;
  downloadUrl: string | null;
  expiresAt: string | null;
  includeCategories: string[];
}

export interface PrivacyStats {
  connectedSources: number;
  totalRecords: number;
  lastActivity: string | null;
  pendingExports: number;
  dataCategories: Array<{
    name: string;
    count: number;
  }>;
}

export interface AccessLog {
  id: string;
  action: string;
  details: string;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: string;
}

const mockConnectedSources: ConnectedSource[] = [
  {
    id: "src-1",
    name: "Primary Care Provider",
    type: "ehr",
    status: "connected",
    lastSyncAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    nextSyncAt: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
    recordsImported: 156,
    connectedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
    permissions: ["Demographics", "Conditions", "Medications", "Labs", "Immunizations", "Allergies"],
    logoUrl: null,
  },
  {
    id: "src-2",
    name: "CVS Pharmacy",
    type: "pharmacy",
    status: "connected",
    lastSyncAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    nextSyncAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    recordsImported: 42,
    connectedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    permissions: ["Prescriptions", "Refill History"],
    logoUrl: null,
  },
  {
    id: "src-3",
    name: "Quest Diagnostics",
    type: "lab",
    status: "connected",
    lastSyncAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    nextSyncAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    recordsImported: 28,
    connectedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    permissions: ["Lab Results", "Test Orders"],
    logoUrl: null,
  },
  {
    id: "src-4",
    name: "Blue Cross Blue Shield",
    type: "insurance",
    status: "connected",
    lastSyncAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    nextSyncAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    recordsImported: 89,
    connectedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
    permissions: ["Claims", "Coverage", "Explanations of Benefits"],
    logoUrl: null,
  },
  {
    id: "src-5",
    name: "Apple Health",
    type: "wearable",
    status: "syncing",
    lastSyncAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    nextSyncAt: null,
    recordsImported: 1247,
    connectedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    permissions: ["Heart Rate", "Steps", "Sleep", "Blood Pressure", "Weight"],
    logoUrl: null,
  },
];

const mockExportRequests: DataExportRequest[] = [
  {
    id: "exp-1",
    userId: "patient-default",
    format: "pdf",
    status: "completed",
    requestedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
    downloadUrl: "/api/privacy/exports/exp-1/download",
    expiresAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    includeCategories: ["All Records"],
  },
];

const mockAccessLogs: AccessLog[] = [
  {
    id: "log-1",
    action: "login",
    details: "Successful login via password",
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "log-2",
    action: "view_records",
    details: "Viewed lab results",
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "log-3",
    action: "export_data",
    details: "Requested full data export (PDF)",
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "log-4",
    action: "share_records",
    details: "Shared clinical snapshot with Dr. Chen",
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "log-5",
    action: "connect_source",
    details: "Connected Apple Health",
    ipAddress: "192.168.1.100",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)",
    timestamp: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

let connectedSources = [...mockConnectedSources];
let exportRequests = [...mockExportRequests];
let accessLogs = [...mockAccessLogs];

export async function getConnectedSources(userId: string): Promise<ConnectedSource[]> {
  return connectedSources;
}

export async function getSourceById(userId: string, sourceId: string): Promise<ConnectedSource | null> {
  return connectedSources.find(s => s.id === sourceId) || null;
}

export async function revokeSourceAccess(userId: string, sourceId: string): Promise<boolean> {
  const index = connectedSources.findIndex(s => s.id === sourceId);
  if (index === -1) return false;

  connectedSources[index].status = "disconnected";
  connectedSources[index].lastSyncAt = null;
  connectedSources[index].nextSyncAt = null;

  accessLogs.push({
    id: `log-${Date.now()}`,
    action: "revoke_access",
    details: `Revoked access for ${connectedSources[index].name}`,
    ipAddress: null,
    userAgent: null,
    timestamp: new Date().toISOString(),
  });

  return true;
}

export async function reconnectSource(userId: string, sourceId: string): Promise<boolean> {
  const index = connectedSources.findIndex(s => s.id === sourceId);
  if (index === -1) return false;

  connectedSources[index].status = "syncing";

  setTimeout(() => {
    const idx = connectedSources.findIndex(s => s.id === sourceId);
    if (idx !== -1) {
      connectedSources[idx].status = "connected";
      connectedSources[idx].lastSyncAt = new Date().toISOString();
    }
  }, 3000);

  accessLogs.push({
    id: `log-${Date.now()}`,
    action: "reconnect_source",
    details: `Reconnected ${connectedSources[index].name}`,
    ipAddress: null,
    userAgent: null,
    timestamp: new Date().toISOString(),
  });

  return true;
}

export async function getPrivacyStats(userId: string): Promise<PrivacyStats> {
  const sources = await getConnectedSources(userId);
  const connected = sources.filter(s => s.status === "connected" || s.status === "syncing");
  const totalRecords = sources.reduce((sum, s) => sum + s.recordsImported, 0);
  const lastSync = sources
    .filter(s => s.lastSyncAt)
    .sort((a, b) => new Date(b.lastSyncAt!).getTime() - new Date(a.lastSyncAt!).getTime())[0];

  const pendingExports = exportRequests.filter(
    e => e.userId === userId && (e.status === "pending" || e.status === "processing")
  ).length;

  return {
    connectedSources: connected.length,
    totalRecords,
    lastActivity: lastSync?.lastSyncAt || null,
    pendingExports,
    dataCategories: [
      { name: "Lab Results", count: 45 },
      { name: "Medications", count: 23 },
      { name: "Conditions", count: 8 },
      { name: "Appointments", count: 34 },
      { name: "Documents", count: 12 },
      { name: "Vitals", count: 1247 },
    ],
  };
}

export async function getExportRequests(userId: string): Promise<DataExportRequest[]> {
  return exportRequests.filter(e => e.userId === userId);
}

export async function requestDataExport(
  userId: string,
  format: "json" | "pdf" | "fhir",
  categories: string[]
): Promise<DataExportRequest> {
  const request: DataExportRequest = {
    id: `exp-${Date.now()}`,
    userId,
    format,
    status: "processing",
    requestedAt: new Date().toISOString(),
    completedAt: null,
    downloadUrl: null,
    expiresAt: null,
    includeCategories: categories,
  };

  exportRequests.push(request);

  accessLogs.push({
    id: `log-${Date.now()}`,
    action: "export_data",
    details: `Requested ${format.toUpperCase()} data export`,
    ipAddress: null,
    userAgent: null,
    timestamp: new Date().toISOString(),
  });

  setTimeout(() => {
    const idx = exportRequests.findIndex(e => e.id === request.id);
    if (idx !== -1) {
      exportRequests[idx].status = "completed";
      exportRequests[idx].completedAt = new Date().toISOString();
      exportRequests[idx].downloadUrl = `/api/privacy/exports/${request.id}/download`;
      exportRequests[idx].expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  }, 5000);

  return request;
}

export async function getAccessLogs(userId: string, limit: number = 50): Promise<AccessLog[]> {
  return accessLogs
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export async function requestAccountDeletion(userId: string): Promise<{
  confirmationToken: string;
  expiresAt: string;
}> {
  accessLogs.push({
    id: `log-${Date.now()}`,
    action: "delete_request",
    details: "Requested account deletion - confirmation pending",
    ipAddress: null,
    userAgent: null,
    timestamp: new Date().toISOString(),
  });

  return {
    confirmationToken: `del-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export async function getDataSummary(userId: string): Promise<{
  categories: Array<{
    name: string;
    description: string;
    itemCount: number;
    lastUpdated: string | null;
  }>;
}> {
  return {
    categories: [
      {
        name: "Personal Information",
        description: "Name, contact details, emergency contacts",
        itemCount: 1,
        lastUpdated: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        name: "Medical Records",
        description: "Diagnoses, procedures, clinical notes",
        itemCount: 67,
        lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        name: "Medications",
        description: "Current and past prescriptions",
        itemCount: 23,
        lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        name: "Lab Results",
        description: "Blood work, urinalysis, pathology",
        itemCount: 45,
        lastUpdated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        name: "Imaging",
        description: "X-rays, MRIs, CT scans",
        itemCount: 8,
        lastUpdated: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        name: "Vitals & Wearables",
        description: "Heart rate, steps, sleep, blood pressure",
        itemCount: 1247,
        lastUpdated: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      {
        name: "Insurance & Billing",
        description: "Claims, coverage, EOBs",
        itemCount: 89,
        lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };
}
