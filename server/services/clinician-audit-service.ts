import { logPhiAccess } from "../security/hipaa-audit";

export type ClinicianAction = 
  | "patient_record_view"
  | "patient_record_edit"
  | "medication_prescribe"
  | "medication_modify"
  | "lab_order"
  | "lab_review"
  | "diagnosis_add"
  | "diagnosis_update"
  | "note_create"
  | "note_sign"
  | "referral_create"
  | "order_place"
  | "consent_obtain"
  | "document_upload"
  | "document_view"
  | "emergency_access"
  | "break_glass"
  | "proxy_access"
  | "export_data"
  | "print_record";

export interface ClinicianAuditEntry {
  id: string;
  timestamp: string;
  clinicianId: string;
  clinicianName: string;
  clinicianRole: string;
  department?: string;
  patientId: string;
  patientName: string;
  patientMrn?: string;
  action: ClinicianAction;
  actionDescription: string;
  resourceType: string;
  resourceId?: string;
  accessContext: {
    reason: string;
    emergencyAccess: boolean;
    breakGlass: boolean;
    proxyAccess: boolean;
    scheduledAppointment?: boolean;
    careTeamMember?: boolean;
  };
  hipaaCompliance: {
    minimumNecessary: boolean;
    appropriateAccess: boolean;
    consentVerified: boolean;
    auditedBy?: string;
    flagged: boolean;
    flagReason?: string;
  };
  sessionInfo: {
    ipAddress: string;
    deviceType: string;
    location?: string;
    sessionId: string;
  };
  duration?: number;
  outcome: "success" | "denied" | "partial" | "error";
  outcomeDetails?: string;
}

export interface ClinicianAuditSummary {
  clinicianId: string;
  clinicianName: string;
  role: string;
  department: string;
  totalAccesses: number;
  uniquePatients: number;
  emergencyAccesses: number;
  breakGlassEvents: number;
  flaggedAccesses: number;
  lastActivity: string;
  complianceScore: number;
  accessByType: { action: ClinicianAction; count: number }[];
  recentActivity: ClinicianAuditEntry[];
}

export interface ClinicianAuditDashboard {
  overview: {
    totalAuditEvents: number;
    totalClinicians: number;
    totalPatientsAccessed: number;
    emergencyAccessCount: number;
    breakGlassCount: number;
    flaggedEvents: number;
    complianceRate: number;
  };
  recentEvents: ClinicianAuditEntry[];
  topAccessors: {
    clinicianId: string;
    clinicianName: string;
    accessCount: number;
    uniquePatients: number;
  }[];
  accessTrends: {
    date: string;
    accessCount: number;
    flaggedCount: number;
  }[];
  departmentBreakdown: {
    department: string;
    accessCount: number;
    clinicianCount: number;
  }[];
  complianceAlerts: {
    id: string;
    severity: "low" | "medium" | "high" | "critical";
    type: string;
    description: string;
    clinicianId: string;
    clinicianName: string;
    timestamp: string;
    resolved: boolean;
  }[];
}

const auditEntries: Map<string, ClinicianAuditEntry> = new Map();

function initializeSampleData() {
  const now = new Date();
  const clinicians = [
    { id: "clin-1", name: "Dr. Sarah Johnson", role: "Physician", department: "Oncology" },
    { id: "clin-2", name: "Dr. Michael Chen", role: "Physician", department: "Internal Medicine" },
    { id: "clin-3", name: "Nurse Emily Davis", role: "Registered Nurse", department: "Emergency" },
    { id: "clin-4", name: "Dr. Robert Wilson", role: "Specialist", department: "Cardiology" },
    { id: "clin-5", name: "PA Jennifer Brown", role: "Physician Assistant", department: "Primary Care" }
  ];
  
  const patients = [
    { id: "pat-1", name: "John Smith", mrn: "MRN-001234" },
    { id: "pat-2", name: "Jane Doe", mrn: "MRN-001235" },
    { id: "pat-3", name: "Robert Johnson", mrn: "MRN-001236" },
    { id: "pat-4", name: "Maria Garcia", mrn: "MRN-001237" }
  ];
  
  const actions: { action: ClinicianAction; description: string; resource: string }[] = [
    { action: "patient_record_view", description: "Viewed patient medical record", resource: "MedicalRecord" },
    { action: "lab_review", description: "Reviewed laboratory results", resource: "LabResult" },
    { action: "medication_prescribe", description: "Prescribed new medication", resource: "Prescription" },
    { action: "note_create", description: "Created clinical note", resource: "ClinicalNote" },
    { action: "diagnosis_add", description: "Added new diagnosis", resource: "Diagnosis" },
    { action: "document_view", description: "Viewed clinical document", resource: "Document" },
    { action: "lab_order", description: "Ordered laboratory tests", resource: "LabOrder" },
    { action: "referral_create", description: "Created specialist referral", resource: "Referral" }
  ];
  
  for (let i = 0; i < 50; i++) {
    const clinician = clinicians[Math.floor(Math.random() * clinicians.length)];
    const patient = patients[Math.floor(Math.random() * patients.length)];
    const actionInfo = actions[Math.floor(Math.random() * actions.length)];
    const hoursAgo = Math.floor(Math.random() * 168);
    const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    
    const isEmergency = Math.random() < 0.05;
    const isBreakGlass = Math.random() < 0.02;
    const isFlagged = Math.random() < 0.08;
    
    const entry: ClinicianAuditEntry = {
      id: `audit-${i + 1}`,
      timestamp: timestamp.toISOString(),
      clinicianId: clinician.id,
      clinicianName: clinician.name,
      clinicianRole: clinician.role,
      department: clinician.department,
      patientId: patient.id,
      patientName: patient.name,
      patientMrn: patient.mrn,
      action: actionInfo.action,
      actionDescription: actionInfo.description,
      resourceType: actionInfo.resource,
      resourceId: `res-${Math.random().toString(36).substr(2, 8)}`,
      accessContext: {
        reason: isEmergency ? "Emergency care" : "Scheduled appointment",
        emergencyAccess: isEmergency,
        breakGlass: isBreakGlass,
        proxyAccess: false,
        scheduledAppointment: !isEmergency,
        careTeamMember: Math.random() > 0.2
      },
      hipaaCompliance: {
        minimumNecessary: Math.random() > 0.1,
        appropriateAccess: Math.random() > 0.05,
        consentVerified: true,
        flagged: isFlagged,
        flagReason: isFlagged ? "Access pattern deviation detected" : undefined
      },
      sessionInfo: {
        ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        deviceType: ["Desktop", "Tablet", "Mobile"][Math.floor(Math.random() * 3)],
        location: clinician.department,
        sessionId: `sess-${Math.random().toString(36).substr(2, 12)}`
      },
      duration: Math.floor(Math.random() * 300) + 10,
      outcome: "success",
      outcomeDetails: undefined
    };
    
    auditEntries.set(entry.id, entry);
  }
  
  const breakGlassEntry: ClinicianAuditEntry = {
    id: "audit-bg-1",
    timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    clinicianId: "clin-3",
    clinicianName: "Nurse Emily Davis",
    clinicianRole: "Registered Nurse",
    department: "Emergency",
    patientId: "pat-5",
    patientName: "Emergency Patient",
    patientMrn: "MRN-999999",
    action: "break_glass",
    actionDescription: "Emergency break-glass access to patient record",
    resourceType: "MedicalRecord",
    resourceId: "rec-emergency",
    accessContext: {
      reason: "Life-threatening emergency - patient unresponsive",
      emergencyAccess: true,
      breakGlass: true,
      proxyAccess: false,
      scheduledAppointment: false,
      careTeamMember: false
    },
    hipaaCompliance: {
      minimumNecessary: true,
      appropriateAccess: true,
      consentVerified: false,
      flagged: true,
      flagReason: "Break-glass access requires review"
    },
    sessionInfo: {
      ipAddress: "192.168.1.100",
      deviceType: "Desktop",
      location: "Emergency Department",
      sessionId: "sess-emergency-001"
    },
    duration: 45,
    outcome: "success",
    outcomeDetails: "Emergency access granted - patient stabilized"
  };
  auditEntries.set(breakGlassEntry.id, breakGlassEntry);
}

initializeSampleData();

export async function getClinicianAuditDashboard(userId: string): Promise<ClinicianAuditDashboard> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "ClinicianAudit",
    details: "View clinician audit dashboard"
  });
  
  const entries = Array.from(auditEntries.values());
  const sortedEntries = entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  const uniqueClinicians = new Set(entries.map(e => e.clinicianId));
  const uniquePatients = new Set(entries.map(e => e.patientId));
  const emergencyCount = entries.filter(e => e.accessContext.emergencyAccess).length;
  const breakGlassCount = entries.filter(e => e.accessContext.breakGlass).length;
  const flaggedCount = entries.filter(e => e.hipaaCompliance.flagged).length;
  
  const clinicianAccess: Map<string, { name: string; count: number; patients: Set<string> }> = new Map();
  entries.forEach(e => {
    if (!clinicianAccess.has(e.clinicianId)) {
      clinicianAccess.set(e.clinicianId, { name: e.clinicianName, count: 0, patients: new Set() });
    }
    const clin = clinicianAccess.get(e.clinicianId)!;
    clin.count++;
    clin.patients.add(e.patientId);
  });
  
  const topAccessors = Array.from(clinicianAccess.entries())
    .map(([id, data]) => ({
      clinicianId: id,
      clinicianName: data.name,
      accessCount: data.count,
      uniquePatients: data.patients.size
    }))
    .sort((a, b) => b.accessCount - a.accessCount)
    .slice(0, 5);
  
  const departmentMap: Map<string, { count: number; clinicians: Set<string> }> = new Map();
  entries.forEach(e => {
    const dept = e.department || "Unknown";
    if (!departmentMap.has(dept)) {
      departmentMap.set(dept, { count: 0, clinicians: new Set() });
    }
    const d = departmentMap.get(dept)!;
    d.count++;
    d.clinicians.add(e.clinicianId);
  });
  
  const departmentBreakdown = Array.from(departmentMap.entries())
    .map(([dept, data]) => ({
      department: dept,
      accessCount: data.count,
      clinicianCount: data.clinicians.size
    }))
    .sort((a, b) => b.accessCount - a.accessCount);
  
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayEntries = entries.filter(e => e.timestamp.startsWith(dateStr));
    last7Days.push({
      date: dateStr,
      accessCount: dayEntries.length,
      flaggedCount: dayEntries.filter(e => e.hipaaCompliance.flagged).length
    });
  }
  
  const complianceAlerts = entries
    .filter(e => e.hipaaCompliance.flagged || e.accessContext.breakGlass)
    .slice(0, 10)
    .map(e => ({
      id: `alert-${e.id}`,
      severity: e.accessContext.breakGlass ? "high" as const : "medium" as const,
      type: e.accessContext.breakGlass ? "Break-Glass Access" : "Flagged Access",
      description: e.hipaaCompliance.flagReason || "Requires compliance review",
      clinicianId: e.clinicianId,
      clinicianName: e.clinicianName,
      timestamp: e.timestamp,
      resolved: Math.random() > 0.6
    }));
  
  return {
    overview: {
      totalAuditEvents: entries.length,
      totalClinicians: uniqueClinicians.size,
      totalPatientsAccessed: uniquePatients.size,
      emergencyAccessCount: emergencyCount,
      breakGlassCount,
      flaggedEvents: flaggedCount,
      complianceRate: ((entries.length - flaggedCount) / entries.length) * 100
    },
    recentEvents: sortedEntries.slice(0, 20),
    topAccessors,
    accessTrends: last7Days,
    departmentBreakdown,
    complianceAlerts
  };
}

export async function getClinicianAuditEntries(
  userId: string,
  filters?: {
    clinicianId?: string;
    patientId?: string;
    action?: ClinicianAction;
    startDate?: string;
    endDate?: string;
    flaggedOnly?: boolean;
    emergencyOnly?: boolean;
  }
): Promise<ClinicianAuditEntry[]> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "ClinicianAuditEntries",
    details: `Query clinician audit entries with filters: ${JSON.stringify(filters || {})}`
  });
  
  let entries = Array.from(auditEntries.values());
  
  if (filters?.clinicianId) {
    entries = entries.filter(e => e.clinicianId === filters.clinicianId);
  }
  
  if (filters?.patientId) {
    entries = entries.filter(e => e.patientId === filters.patientId);
  }
  
  if (filters?.action) {
    entries = entries.filter(e => e.action === filters.action);
  }
  
  if (filters?.startDate) {
    entries = entries.filter(e => e.timestamp >= filters.startDate!);
  }
  
  if (filters?.endDate) {
    entries = entries.filter(e => e.timestamp <= filters.endDate!);
  }
  
  if (filters?.flaggedOnly) {
    entries = entries.filter(e => e.hipaaCompliance.flagged);
  }
  
  if (filters?.emergencyOnly) {
    entries = entries.filter(e => e.accessContext.emergencyAccess);
  }
  
  return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function getClinicianSummary(userId: string, clinicianId: string): Promise<ClinicianAuditSummary | null> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "ClinicianSummary",
    details: `View summary for clinician ${clinicianId}`
  });
  
  const entries = Array.from(auditEntries.values()).filter(e => e.clinicianId === clinicianId);
  
  if (entries.length === 0) return null;
  
  const firstEntry = entries[0];
  const uniquePatients = new Set(entries.map(e => e.patientId));
  const emergencyAccesses = entries.filter(e => e.accessContext.emergencyAccess).length;
  const breakGlassEvents = entries.filter(e => e.accessContext.breakGlass).length;
  const flaggedAccesses = entries.filter(e => e.hipaaCompliance.flagged).length;
  
  const actionCounts: Map<ClinicianAction, number> = new Map();
  entries.forEach(e => {
    actionCounts.set(e.action, (actionCounts.get(e.action) || 0) + 1);
  });
  
  const sortedEntries = entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  return {
    clinicianId,
    clinicianName: firstEntry.clinicianName,
    role: firstEntry.clinicianRole,
    department: firstEntry.department || "Unknown",
    totalAccesses: entries.length,
    uniquePatients: uniquePatients.size,
    emergencyAccesses,
    breakGlassEvents,
    flaggedAccesses,
    lastActivity: sortedEntries[0].timestamp,
    complianceScore: ((entries.length - flaggedAccesses) / entries.length) * 100,
    accessByType: Array.from(actionCounts.entries()).map(([action, count]) => ({ action, count })),
    recentActivity: sortedEntries.slice(0, 10)
  };
}

export async function exportAuditReport(
  userId: string,
  filters?: {
    startDate?: string;
    endDate?: string;
    clinicianId?: string;
    department?: string;
  }
): Promise<{ reportId: string; generatedAt: string; entryCount: number; format: string }> {
  logPhiAccess({
    userId,
    action: "export",
    resourceType: "ClinicianAuditReport",
    details: `Export audit report with filters: ${JSON.stringify(filters || {})}`
  });
  
  let entries = Array.from(auditEntries.values());
  
  if (filters?.startDate) {
    entries = entries.filter(e => e.timestamp >= filters.startDate!);
  }
  if (filters?.endDate) {
    entries = entries.filter(e => e.timestamp <= filters.endDate!);
  }
  if (filters?.clinicianId) {
    entries = entries.filter(e => e.clinicianId === filters.clinicianId);
  }
  if (filters?.department) {
    entries = entries.filter(e => e.department === filters.department);
  }
  
  return {
    reportId: `report-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    entryCount: entries.length,
    format: "CSV"
  };
}
