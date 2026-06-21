export type AlertSeverity = "info" | "warning" | "error";
export type AlertCategory = "identity" | "medication" | "allergy" | "demographics" | "duplicate" | "missing";

export interface RecordQualityAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  affectedSources: string[];
  detectedAt: string;
  suggestedAction: string;
  resolved: boolean;
}

export interface RecordQualityReport {
  patientId: string;
  alerts: RecordQualityAlert[];
  overallScore: number;
  lastChecked: string;
  summary: {
    total: number;
    byCategory: Record<AlertCategory, number>;
    bySeverity: Record<AlertSeverity, number>;
  };
}

const mockAlerts: RecordQualityAlert[] = [
  {
    id: "alert-1",
    category: "demographics",
    severity: "warning",
    title: "Two different dates of birth found",
    description: "Fasten Health shows DOB as 03/15/1985, but Cerner Health shows 03/16/1985. This discrepancy should be verified with official documentation.",
    affectedSources: ["Primary Care Provider", "Hospital Network"],
    detectedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    suggestedAction: "Verify your correct date of birth and update the incorrect source",
    resolved: false,
  },
  {
    id: "alert-2",
    category: "medication",
    severity: "warning",
    title: "Medication list differs across sources",
    description: "Epic shows 4 active medications, but athenahealth shows only 2. Metformin and Lisinopril are missing from athenahealth records.",
    affectedSources: ["Fasten Health"],
    detectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    suggestedAction: "Review your medication list and confirm which medications you are currently taking",
    resolved: false,
  },
  {
    id: "alert-3",
    category: "allergy",
    severity: "error",
    title: "Missing allergies in one source",
    description: "Penicillin allergy is documented in Fasten Health but NOT in Cerner Health. This data discrepancy means your allergy information is inconsistent across systems.",
    affectedSources: ["Primary Care Provider", "Hospital Network"],
    detectedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    suggestedAction: "Contact your provider to ensure allergies are documented in all connected health systems",
    resolved: false,
  },
  {
    id: "alert-4",
    category: "duplicate",
    severity: "info",
    title: "Possible duplicate patient records",
    description: "Similar patient name and address found with a different MRN in the athenahealth system. This may be a duplicate record that needs merging.",
    affectedSources: ["Fasten Health"],
    detectedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    suggestedAction: "Contact athenahealth support to investigate and merge duplicate records if confirmed",
    resolved: false,
  },
  {
    id: "alert-5",
    category: "missing",
    severity: "info",
    title: "Immunization records incomplete",
    description: "COVID-19 vaccination records found in state registry but not imported to Fasten Health. Consider requesting a records update.",
    affectedSources: ["Primary Care Provider", "State Immunization Registry"],
    detectedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    suggestedAction: "Request your provider import immunization records from the state registry",
    resolved: false,
  },
  {
    id: "alert-6",
    category: "demographics",
    severity: "info",
    title: "Phone number outdated in one source",
    description: "Primary phone number differs between Fasten Health (555-123-4567) and Cerner (555-987-6543). One may be outdated.",
    affectedSources: ["Primary Care Provider", "Hospital Network"],
    detectedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    suggestedAction: "Update your phone number in the system showing the old number",
    resolved: true,
  },
];

export async function getRecordQualityAlerts(patientId: string): Promise<RecordQualityReport> {
  const activeAlerts = mockAlerts.filter(a => !a.resolved);
  
  const byCategory: Record<AlertCategory, number> = {
    identity: 0,
    medication: 0,
    allergy: 0,
    demographics: 0,
    duplicate: 0,
    missing: 0,
  };
  
  const bySeverity: Record<AlertSeverity, number> = {
    info: 0,
    warning: 0,
    error: 0,
  };

  for (const alert of activeAlerts) {
    byCategory[alert.category]++;
    bySeverity[alert.severity]++;
  }

  const errorWeight = bySeverity.error * 20;
  const warningWeight = bySeverity.warning * 10;
  const infoWeight = bySeverity.info * 2;
  const totalWeight = errorWeight + warningWeight + infoWeight;
  const overallScore = Math.max(0, 100 - totalWeight);

  return {
    patientId,
    alerts: mockAlerts,
    overallScore,
    lastChecked: new Date().toISOString(),
    summary: {
      total: activeAlerts.length,
      byCategory,
      bySeverity,
    },
  };
}

export async function dismissAlert(
  alertId: string,
  patientId: string
): Promise<{ success: boolean }> {
  const alert = mockAlerts.find(a => a.id === alertId);
  if (alert) {
    alert.resolved = true;
  }

  return { success: true };
}

export async function runQualityCheck(patientId: string): Promise<RecordQualityReport> {
  return getRecordQualityAlerts(patientId);
}
