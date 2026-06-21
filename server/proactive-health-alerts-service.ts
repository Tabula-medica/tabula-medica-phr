/**
 * Proactive Health Alerts Service
 * 
 * Monitors incoming health data and generates discussion-focused alerts.
 * All alerts are framed as "Items to discuss with your clinician" - 
 * never providing medical advice or diagnosis.
 */

export interface HealthDataPoint {
  id: string;
  type: "lab" | "vital" | "symptom" | "medication" | "document";
  name: string;
  value: string;
  unit?: string;
  date: string;
  source?: string;
  referenceRange?: {
    low?: number;
    high?: number;
  };
}

export interface ProactiveAlert {
  id: string;
  type: "lab_result" | "vital_change" | "symptom_report" | "medication_update" | "care_gap" | "follow_up";
  title: string;
  description: string;
  discussionPoints: string[];
  whereInRecord: {
    quote: string;
    source: string;
    date: string;
  };
  createdAt: string;
  isRead: boolean;
  isDismissed: boolean;
}

export interface AlertsSummary {
  totalAlerts: number;
  unreadCount: number;
  alerts: ProactiveAlert[];
  lastUpdated: string;
}

/**
 * Generate an alert for any new health data point.
 * Alerts are generated for new records only - no clinical interpretation.
 * If the record includes a reference range, it is quoted directly.
 */
function createAlertFromDataPoint(data: HealthDataPoint): ProactiveAlert {
  // Build the quote from the record data
  let quote = `${data.name}: ${data.value}`;
  if (data.unit) {
    quote += ` ${data.unit}`;
  }
  // If the record explicitly includes a reference range, include it
  if (data.referenceRange) {
    const rangeParts: string[] = [];
    if (data.referenceRange.low !== undefined) rangeParts.push(`${data.referenceRange.low}`);
    if (data.referenceRange.high !== undefined) rangeParts.push(`${data.referenceRange.high}`);
    if (rangeParts.length > 0) {
      quote += ` (Reference: ${rangeParts.join("-")}${data.unit ? ` ${data.unit}` : ""})`;
    }
  }

  return {
    id: `alert-${data.id}-${Date.now()}`,
    type: data.type === "lab" ? "lab_result" : "vital_change",
    title: `New ${data.name} result recorded`,
    description: `In your record, a ${data.name} result appears from ${data.source || "your health record"}.`,
    discussionPoints: [
      `What does this result mean in my situation?`,
      `Is this value expected given my history?`,
      `Should this be rechecked, and if so when?`,
    ],
    whereInRecord: {
      quote,
      source: data.source || "Health Record",
      date: data.date,
    },
    createdAt: new Date().toISOString(),
    isRead: false,
    isDismissed: false,
  };
}

/**
 * Generate alerts from new health data.
 * Alerts are created for all new records - no clinical interpretation or threshold checking.
 */
export async function generateAlertsFromHealthData(
  userId: string,
  newData: HealthDataPoint[]
): Promise<ProactiveAlert[]> {
  const alerts: ProactiveAlert[] = [];
  
  for (const dataPoint of newData) {
    // Create an alert for every new data point - no interpretation
    const alert = createAlertFromDataPoint(dataPoint);
    alerts.push(alert);
  }
  
  return alerts;
}

/**
 * Get all alerts for a patient
 */
export async function getPatientAlerts(userId: string): Promise<AlertsSummary> {
  // Mock alerts - in production would fetch from database
  const alerts: ProactiveAlert[] = [
    {
      id: "alert-1",
      type: "lab_result",
      title: "New A1C result recorded",
      description: "In your record, a Hemoglobin A1C result appears from Quest Diagnostics.",
      discussionPoints: [
        "What does this result mean in my situation?",
        "Is this value expected given my history?",
        "Should this be rechecked, and if so when?",
      ],
      whereInRecord: {
        quote: "Hemoglobin A1C: 6.8% (Reference: 4.0-5.6%)",
        source: "Quest Diagnostics - Lab Report",
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      },
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      isRead: false,
      isDismissed: false,
    },
    {
      id: "alert-2",
      type: "vital_change",
      title: "Blood pressure reading recorded",
      description: "In your record, a blood pressure reading appears from your home monitoring device.",
      discussionPoints: [
        "What does this result mean in my situation?",
        "Is this value expected given my history?",
        "Should this be rechecked, and if so when?",
      ],
      whereInRecord: {
        quote: "Blood Pressure: 148/94 mmHg",
        source: "Home Monitoring Device",
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      },
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      isRead: true,
      isDismissed: false,
    },
    {
      id: "alert-3",
      type: "lab_result",
      title: "LDL Cholesterol result recorded",
      description: "In your record, an LDL Cholesterol result appears from LabCorp.",
      discussionPoints: [
        "What does this result mean in my situation?",
        "Is this value expected given my history?",
        "Should this be rechecked, and if so when?",
      ],
      whereInRecord: {
        quote: "LDL Cholesterol: 128 mg/dL (Reference: <100 mg/dL)",
        source: "LabCorp - Lipid Panel",
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      },
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      isRead: false,
      isDismissed: false,
    },
    {
      id: "alert-4",
      type: "care_gap",
      title: "Annual physical exam noted",
      description: "In your record, your last annual physical exam appears from January 2023.",
      discussionPoints: [
        "Can you confirm when my last annual physical was?",
        "What does an annual exam typically include?",
        "What information would be helpful to bring to a visit?",
      ],
      whereInRecord: {
        quote: "Last Annual Physical: January 15, 2023",
        source: "Tabula Medica - Visit History",
        date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      },
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      isRead: true,
      isDismissed: false,
    },
    {
      id: "alert-5",
      type: "medication_update",
      title: "New medication recorded",
      description: "In your record, a new medication entry appears from Dr. Martinez.",
      discussionPoints: [
        "Can you confirm my current medication list?",
        "What does this medication mean for my treatment?",
        "Is this value expected given my history?",
      ],
      whereInRecord: {
        quote: "Lisinopril 10mg - Started",
        source: "Dr. Martinez - Prescription",
        date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      },
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      isRead: false,
      isDismissed: false,
    },
  ];

  const activeAlerts = alerts.filter(a => !a.isDismissed);
  const unreadCount = activeAlerts.filter(a => !a.isRead).length;

  return {
    totalAlerts: activeAlerts.length,
    unreadCount,
    alerts: activeAlerts,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Mark an alert as read
 */
export async function markAlertRead(userId: string, alertId: string): Promise<boolean> {
  // In production, update database
  console.log(`[Alerts] Marked alert ${alertId} as read for user ${userId}`);
  return true;
}

/**
 * Dismiss an alert
 */
export async function dismissAlert(userId: string, alertId: string): Promise<boolean> {
  // In production, update database
  console.log(`[Alerts] Dismissed alert ${alertId} for user ${userId}`);
  return true;
}

/**
 * Process incoming health data and generate alerts
 * This would be called when new data arrives (lab results, vitals, etc.)
 */
export async function processIncomingHealthData(
  userId: string,
  dataType: string,
  data: any
): Promise<ProactiveAlert[]> {
  // Convert incoming data to HealthDataPoint format
  const healthData: HealthDataPoint[] = [];
  
  if (dataType === "lab_results") {
    for (const result of data.results || []) {
      healthData.push({
        id: result.id || `lab-${Date.now()}`,
        type: "lab",
        name: result.name,
        value: result.value,
        unit: result.unit,
        date: result.date || new Date().toISOString(),
        source: result.source,
        referenceRange: result.referenceRange,
      });
    }
  } else if (dataType === "vitals") {
    for (const vital of data.vitals || []) {
      healthData.push({
        id: vital.id || `vital-${Date.now()}`,
        type: "vital",
        name: vital.name,
        value: vital.value,
        unit: vital.unit,
        date: vital.date || new Date().toISOString(),
        source: vital.source,
      });
    }
  }
  
  // Generate alerts from the health data
  return generateAlertsFromHealthData(userId, healthData);
}
