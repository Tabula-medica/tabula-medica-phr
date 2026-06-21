import { logPhiAccess } from "./security/hipaa-audit";

export interface ChangeItem {
  id: string;
  type: "lab" | "medication" | "document" | "condition" | "allergy" | "appointment" | "message";
  title: string;
  description: string;
  source?: string;
  timestamp: Date;
  isNew: boolean;
  isUpdated: boolean;
  priority: "high" | "medium" | "low";
}

export interface DiscrepancyItem {
  id: string;
  type: "medication" | "lab" | "condition" | "allergy";
  title: string;
  description: string;
  sources: string[];
  detectedAt: Date;
}

export interface DeltaSummary {
  newLabs: number;
  newMedications: number;
  newDocuments: number;
  newConditions: number;
  newAllergies: number;
  newAppointments: number;
  newMessages: number;
  discrepanciesDetected: number;
  totalChanges: number;
}

export interface DeltaViewResponse {
  patientId: string;
  lastVisit: Date;
  currentVisit: Date;
  daysSinceLastVisit: number;
  summary: DeltaSummary;
  recentChanges: ChangeItem[];
  discrepancies: DiscrepancyItem[];
  highlights: string[];
}

const userLastVisits = new Map<string, Date>();

function getLastVisit(patientId: string): Date {
  const lastVisit = userLastVisits.get(patientId);
  if (lastVisit) {
    return lastVisit;
  }
  const defaultLastVisit = new Date();
  defaultLastVisit.setDate(defaultLastVisit.getDate() - 7);
  return defaultLastVisit;
}

function updateLastVisit(patientId: string): void {
  userLastVisits.set(patientId, new Date());
}

function generateSampleChanges(patientId: string, lastVisit: Date): {
  changes: ChangeItem[];
  discrepancies: DiscrepancyItem[];
} {
  const now = new Date();
  const daysSince = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
  
  const changes: ChangeItem[] = [];
  const discrepancies: DiscrepancyItem[] = [];

  if (daysSince >= 1) {
    changes.push({
      id: "lab-hba1c-new",
      type: "lab",
      title: "Hemoglobin A1C",
      description: "Result: 6.5% - Within target range",
      source: "Quest Diagnostics",
      timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2),
      isNew: true,
      isUpdated: false,
      priority: "medium",
    });

    changes.push({
      id: "lab-lipid-new",
      type: "lab",
      title: "Lipid Panel",
      description: "Total Cholesterol: 185 mg/dL, LDL: 95 mg/dL",
      source: "Quest Diagnostics",
      timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2),
      isNew: true,
      isUpdated: false,
      priority: "low",
    });

    changes.push({
      id: "lab-cmp-new",
      type: "lab",
      title: "Comprehensive Metabolic Panel",
      description: "14 test results available",
      source: "LabCorp",
      timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
      isNew: true,
      isUpdated: false,
      priority: "low",
    });
  }

  if (daysSince >= 2) {
    changes.push({
      id: "med-metformin-update",
      type: "medication",
      title: "Metformin",
      description: "Dosage updated: 500mg → 1000mg twice daily",
      source: "Dr. Smith via Fasten Health",
      timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3),
      isNew: false,
      isUpdated: true,
      priority: "high",
    });

    discrepancies.push({
      id: "discrepancy-metformin",
      type: "medication",
      title: "Metformin Dosage Discrepancy",
      description: "Provider record shows 1000mg twice daily, pharmacy record shows 500mg twice daily",
      sources: ["Primary Care Provider", "CVS Pharmacy"],
      detectedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
    });
  }

  if (daysSince >= 3) {
    changes.push({
      id: "doc-visit-summary",
      type: "document",
      title: "Visit Summary",
      description: "Primary Care Visit - Dr. Johnson",
      source: "City Medical Center",
      timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 4),
      isNew: true,
      isUpdated: false,
      priority: "medium",
    });

    changes.push({
      id: "doc-radiology",
      type: "document",
      title: "Chest X-Ray Report",
      description: "Routine screening - No acute findings",
      source: "City Medical Center Radiology",
      timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5),
      isNew: true,
      isUpdated: false,
      priority: "low",
    });
  }

  if (daysSince >= 5) {
    changes.push({
      id: "appt-upcoming",
      type: "appointment",
      title: "Upcoming Appointment Scheduled",
      description: "Follow-up with Dr. Smith - Endocrinology",
      source: "Primary Care Provider",
      timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6),
      isNew: true,
      isUpdated: false,
      priority: "medium",
    });

    changes.push({
      id: "msg-provider",
      type: "message",
      title: "New Message from Dr. Johnson",
      description: "Regarding your recent lab results",
      source: "Patient Portal",
      timestamp: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5),
      isNew: true,
      isUpdated: false,
      priority: "high",
    });
  }

  changes.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return { changes, discrepancies };
}

function generateHighlights(summary: DeltaSummary, daysSince: number): string[] {
  const highlights: string[] = [];

  if (summary.newLabs > 0) {
    highlights.push(`${summary.newLabs} new lab result${summary.newLabs > 1 ? "s" : ""} available`);
  }

  if (summary.newMedications > 0) {
    highlights.push(`${summary.newMedications} medication${summary.newMedications > 1 ? "s" : ""} updated`);
  }

  if (summary.newDocuments > 0) {
    highlights.push(`${summary.newDocuments} new document${summary.newDocuments > 1 ? "s" : ""} added`);
  }

  if (summary.discrepanciesDetected > 0) {
    highlights.push(`${summary.discrepanciesDetected} discrepanc${summary.discrepanciesDetected > 1 ? "ies" : "y"} detected`);
  }

  if (summary.newAppointments > 0) {
    highlights.push(`${summary.newAppointments} appointment${summary.newAppointments > 1 ? "s" : ""} scheduled`);
  }

  if (summary.newMessages > 0) {
    highlights.push(`${summary.newMessages} new message${summary.newMessages > 1 ? "s" : ""} from your care team`);
  }

  if (highlights.length === 0) {
    highlights.push("No new updates since your last visit");
  }

  return highlights;
}

export async function getDeltaView(patientId: string): Promise<DeltaViewResponse> {
  logPhiAccess({
    action: "read",
    resourceType: "DeltaView",
    userId: patientId,
    patientId,
    details: "Retrieved delta view of changes since last visit",
  });

  const lastVisit = getLastVisit(patientId);
  const currentVisit = new Date();
  const daysSinceLastVisit = Math.floor(
    (currentVisit.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24)
  );

  const { changes, discrepancies } = generateSampleChanges(patientId, lastVisit);

  const summary: DeltaSummary = {
    newLabs: changes.filter((c) => c.type === "lab" && c.isNew).length,
    newMedications: changes.filter((c) => c.type === "medication").length,
    newDocuments: changes.filter((c) => c.type === "document" && c.isNew).length,
    newConditions: changes.filter((c) => c.type === "condition" && c.isNew).length,
    newAllergies: changes.filter((c) => c.type === "allergy" && c.isNew).length,
    newAppointments: changes.filter((c) => c.type === "appointment" && c.isNew).length,
    newMessages: changes.filter((c) => c.type === "message" && c.isNew).length,
    discrepanciesDetected: discrepancies.length,
    totalChanges: changes.length,
  };

  const highlights = generateHighlights(summary, daysSinceLastVisit);

  updateLastVisit(patientId);

  return {
    patientId,
    lastVisit,
    currentVisit,
    daysSinceLastVisit,
    summary,
    recentChanges: changes,
    discrepancies,
    highlights,
  };
}

export async function markVisit(patientId: string): Promise<void> {
  logPhiAccess({
    action: "write",
    resourceType: "UserVisit",
    userId: patientId,
    patientId,
    details: "Updated last visit timestamp",
  });

  updateLastVisit(patientId);
}
