import { logPhiAccess } from "../security/hipaa-audit";

const NO_CDS_DISCLAIMER = "This visualization is for informational purposes only. It does not constitute medical advice or clinical decision support. Always consult your healthcare provider.";

export interface MedicationTimelineData {
  id: string;
  name: string;
  genericName?: string;
  startDate: string;
  endDate?: string;
  status: "active" | "completed" | "stopped" | "on-hold";
  dosage: string;
  frequency: string;
  category: string;
  source: string;
  refillHistory: { date: string; quantity: number }[];
  adherenceRate?: number;
}

export interface ConditionProgressData {
  id: string;
  name: string;
  code: string;
  codeSystem: string;
  category: string;
  clinicalStatus: string;
  verificationStatus: string;
  onsetDate?: string;
  abatementDate?: string;
  severity?: string;
  progression: { date: string; status: string; note?: string }[];
  relatedConditions: string[];
}

export interface EncounterAnalyticsData {
  id: string;
  type: string;
  class: string;
  status: string;
  date: string;
  duration?: number;
  provider?: string;
  facility?: string;
  reason?: string;
  diagnoses: string[];
  procedures: string[];
}

export interface ChartTimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
  metadata?: Record<string, any>;
}

export interface MedicationChartData {
  timeline: MedicationTimelineData[];
  adherenceTrend: ChartTimeSeriesPoint[];
  categoryDistribution: { category: string; count: number; percentage: number }[];
  activeCount: number;
  totalPrescribed: number;
  averageAdherence: number;
  refillsNeeded: number;
}

export interface ConditionChartData {
  conditions: ConditionProgressData[];
  severityDistribution: { severity: string; count: number }[];
  categoryBreakdown: { category: string; active: number; resolved: number }[];
  onsetTimeline: ChartTimeSeriesPoint[];
  activeConditions: number;
  resolvedConditions: number;
  chronicConditions: number;
}

export interface EncounterChartData {
  encounters: EncounterAnalyticsData[];
  frequencyByMonth: ChartTimeSeriesPoint[];
  typeDistribution: { type: string; count: number; percentage: number }[];
  providerBreakdown: { provider: string; encounters: number }[];
  averageDuration: number;
  totalEncounters: number;
  emergencyVisits: number;
  plannedVisits: number;
}

export interface PatientHealthTrendData {
  vitals: {
    bloodPressure: ChartTimeSeriesPoint[];
    heartRate: ChartTimeSeriesPoint[];
    weight: ChartTimeSeriesPoint[];
    temperature: ChartTimeSeriesPoint[];
  };
  labs: {
    glucose: ChartTimeSeriesPoint[];
    a1c: ChartTimeSeriesPoint[];
    cholesterol: ChartTimeSeriesPoint[];
    creatinine: ChartTimeSeriesPoint[];
  };
  timeRange: { start: string; end: string };
}

const sampleMedications: MedicationTimelineData[] = [
  {
    id: "med-001",
    name: "Metformin ER",
    genericName: "Metformin Hydrochloride",
    startDate: "2024-01-15",
    status: "active",
    dosage: "500mg",
    frequency: "Twice daily",
    category: "Antidiabetic",
    source: "Fasten Health",
    refillHistory: [
      { date: "2024-01-15", quantity: 60 },
      { date: "2024-02-15", quantity: 60 },
      { date: "2024-03-15", quantity: 60 },
      { date: "2024-04-15", quantity: 60 },
      { date: "2024-05-15", quantity: 60 },
      { date: "2024-06-15", quantity: 60 },
    ],
    adherenceRate: 92,
  },
  {
    id: "med-002",
    name: "Lisinopril",
    genericName: "Lisinopril",
    startDate: "2023-06-01",
    status: "active",
    dosage: "10mg",
    frequency: "Once daily",
    category: "ACE Inhibitor",
    source: "Hospital Network",
    refillHistory: [
      { date: "2023-06-01", quantity: 30 },
      { date: "2023-07-01", quantity: 30 },
      { date: "2023-08-01", quantity: 30 },
    ],
    adherenceRate: 88,
  },
  {
    id: "med-003",
    name: "Atorvastatin",
    genericName: "Atorvastatin Calcium",
    startDate: "2023-03-10",
    status: "active",
    dosage: "20mg",
    frequency: "Once daily at bedtime",
    category: "Statin",
    source: "Fasten Health",
    refillHistory: [
      { date: "2023-03-10", quantity: 30 },
      { date: "2023-04-10", quantity: 30 },
    ],
    adherenceRate: 95,
  },
  {
    id: "med-004",
    name: "Omeprazole",
    genericName: "Omeprazole",
    startDate: "2024-02-01",
    endDate: "2024-04-01",
    status: "completed",
    dosage: "20mg",
    frequency: "Once daily before breakfast",
    category: "Proton Pump Inhibitor",
    source: "Manual",
    refillHistory: [
      { date: "2024-02-01", quantity: 30 },
      { date: "2024-03-01", quantity: 30 },
    ],
    adherenceRate: 100,
  },
  {
    id: "med-005",
    name: "Aspirin",
    genericName: "Acetylsalicylic Acid",
    startDate: "2022-09-15",
    status: "active",
    dosage: "81mg",
    frequency: "Once daily",
    category: "Antiplatelet",
    source: "Fasten Health",
    refillHistory: [],
    adherenceRate: 85,
  },
];

const sampleConditions: ConditionProgressData[] = [
  {
    id: "cond-001",
    name: "Type 2 Diabetes Mellitus",
    code: "E11.9",
    codeSystem: "ICD-10",
    category: "Endocrine",
    clinicalStatus: "active",
    verificationStatus: "confirmed",
    onsetDate: "2020-03-15",
    severity: "moderate",
    progression: [
      { date: "2020-03-15", status: "diagnosed", note: "Initial diagnosis based on A1c of 7.8%" },
      { date: "2021-06-01", status: "controlled", note: "A1c improved to 7.0% with lifestyle changes" },
      { date: "2022-01-15", status: "medication added", note: "Started Metformin due to rising A1c" },
      { date: "2024-01-01", status: "stable", note: "Well controlled on current regimen" },
    ],
    relatedConditions: ["Hypertension", "Hyperlipidemia"],
  },
  {
    id: "cond-002",
    name: "Essential Hypertension",
    code: "I10",
    codeSystem: "ICD-10",
    category: "Cardiovascular",
    clinicalStatus: "active",
    verificationStatus: "confirmed",
    onsetDate: "2019-08-20",
    severity: "mild",
    progression: [
      { date: "2019-08-20", status: "diagnosed", note: "BP consistently elevated > 140/90" },
      { date: "2020-02-01", status: "medication started", note: "Started Lisinopril" },
      { date: "2023-06-01", status: "controlled", note: "BP now averaging 125/80" },
    ],
    relatedConditions: ["Type 2 Diabetes"],
  },
  {
    id: "cond-003",
    name: "Hyperlipidemia",
    code: "E78.5",
    codeSystem: "ICD-10",
    category: "Metabolic",
    clinicalStatus: "active",
    verificationStatus: "confirmed",
    onsetDate: "2021-02-10",
    severity: "mild",
    progression: [
      { date: "2021-02-10", status: "diagnosed", note: "LDL 165 mg/dL" },
      { date: "2021-03-01", status: "lifestyle changes", note: "Started diet modifications" },
      { date: "2023-03-10", status: "medication started", note: "Started Atorvastatin" },
    ],
    relatedConditions: ["Type 2 Diabetes", "Hypertension"],
  },
  {
    id: "cond-004",
    name: "Acute Sinusitis",
    code: "J01.90",
    codeSystem: "ICD-10",
    category: "Respiratory",
    clinicalStatus: "resolved",
    verificationStatus: "confirmed",
    onsetDate: "2024-01-05",
    abatementDate: "2024-01-19",
    severity: "mild",
    progression: [
      { date: "2024-01-05", status: "diagnosed" },
      { date: "2024-01-19", status: "resolved", note: "Symptoms cleared with treatment" },
    ],
    relatedConditions: [],
  },
  {
    id: "cond-005",
    name: "Chronic Kidney Disease Stage 2",
    code: "N18.2",
    codeSystem: "ICD-10",
    category: "Renal",
    clinicalStatus: "active",
    verificationStatus: "confirmed",
    onsetDate: "2023-05-01",
    severity: "mild",
    progression: [
      { date: "2023-05-01", status: "diagnosed", note: "eGFR 75 mL/min" },
      { date: "2024-01-01", status: "stable", note: "eGFR stable at 72 mL/min" },
    ],
    relatedConditions: ["Type 2 Diabetes", "Hypertension"],
  },
];

const sampleEncounters: EncounterAnalyticsData[] = [
  {
    id: "enc-001",
    type: "Primary Care Visit",
    class: "ambulatory",
    status: "finished",
    date: "2026-01-15",
    duration: 30,
    provider: "Dr. Sarah Johnson",
    facility: "City Medical Center",
    reason: "Annual Physical",
    diagnoses: ["Type 2 Diabetes", "Hypertension"],
    procedures: ["Blood pressure check", "A1c test"],
  },
  {
    id: "enc-002",
    type: "Specialist Consultation",
    class: "ambulatory",
    status: "finished",
    date: "2025-12-10",
    duration: 45,
    provider: "Dr. Michael Chen",
    facility: "Cardiology Associates",
    reason: "Cardiovascular Assessment",
    diagnoses: ["Hypertension"],
    procedures: ["EKG", "Stress test"],
  },
  {
    id: "enc-003",
    type: "Lab Visit",
    class: "ambulatory",
    status: "finished",
    date: "2025-11-20",
    duration: 15,
    provider: "Quest Diagnostics",
    facility: "Quest Diagnostics Lab",
    reason: "Routine Labs",
    diagnoses: [],
    procedures: ["Complete Blood Count", "Comprehensive Metabolic Panel", "Lipid Panel"],
  },
  {
    id: "enc-004",
    type: "Emergency Visit",
    class: "emergency",
    status: "finished",
    date: "2025-08-05",
    duration: 180,
    provider: "Dr. Emily Roberts",
    facility: "City General Hospital ER",
    reason: "Chest Pain Evaluation",
    diagnoses: ["Chest pain, unspecified"],
    procedures: ["Chest X-ray", "EKG", "Troponin test"],
  },
  {
    id: "enc-005",
    type: "Telehealth Visit",
    class: "virtual",
    status: "finished",
    date: "2025-10-01",
    duration: 20,
    provider: "Dr. Sarah Johnson",
    facility: "City Medical Center",
    reason: "Medication Review",
    diagnoses: ["Type 2 Diabetes"],
    procedures: [],
  },
  {
    id: "enc-006",
    type: "Primary Care Visit",
    class: "ambulatory",
    status: "finished",
    date: "2025-07-15",
    duration: 25,
    provider: "Dr. Sarah Johnson",
    facility: "City Medical Center",
    reason: "Follow-up Visit",
    diagnoses: ["Type 2 Diabetes", "Hyperlipidemia"],
    procedures: ["A1c test"],
  },
  {
    id: "enc-007",
    type: "Specialist Consultation",
    class: "ambulatory",
    status: "finished",
    date: "2025-05-20",
    duration: 40,
    provider: "Dr. Lisa Wong",
    facility: "Nephrology Center",
    reason: "Kidney Function Evaluation",
    diagnoses: ["CKD Stage 2"],
    procedures: ["Urinalysis", "Kidney ultrasound"],
  },
  {
    id: "enc-008",
    type: "Primary Care Visit",
    class: "ambulatory",
    status: "planned",
    date: "2026-02-15",
    duration: 30,
    provider: "Dr. Sarah Johnson",
    facility: "City Medical Center",
    reason: "Quarterly Diabetes Check",
    diagnoses: [],
    procedures: [],
  },
];

function generateVitalsData(): PatientHealthTrendData {
  const now = new Date();
  const bloodPressure: ChartTimeSeriesPoint[] = [];
  const heartRate: ChartTimeSeriesPoint[] = [];
  const weight: ChartTimeSeriesPoint[] = [];
  const temperature: ChartTimeSeriesPoint[] = [];
  const glucose: ChartTimeSeriesPoint[] = [];
  const a1c: ChartTimeSeriesPoint[] = [];
  const cholesterol: ChartTimeSeriesPoint[] = [];
  const creatinine: ChartTimeSeriesPoint[] = [];

  for (let i = 11; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    const dateStr = date.toISOString().split("T")[0];

    bloodPressure.push({
      date: dateStr,
      value: 120 + Math.floor(Math.random() * 20) - 10,
      label: "Systolic",
      metadata: { diastolic: 75 + Math.floor(Math.random() * 15) - 5 },
    });

    heartRate.push({
      date: dateStr,
      value: 68 + Math.floor(Math.random() * 12) - 6,
      label: "Heart Rate",
    });

    weight.push({
      date: dateStr,
      value: 180 + Math.floor(Math.random() * 6) - 3,
      label: "Weight (lbs)",
    });
  }

  for (let i = 3; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i * 3);
    const dateStr = date.toISOString().split("T")[0];

    temperature.push({
      date: dateStr,
      value: 98.4 + Math.random() * 0.4,
      label: "Temperature",
    });

    glucose.push({
      date: dateStr,
      value: 110 + Math.floor(Math.random() * 30),
      label: "Fasting Glucose",
    });

    a1c.push({
      date: dateStr,
      value: 6.8 + Math.random() * 0.8,
      label: "A1c %",
    });

    cholesterol.push({
      date: dateStr,
      value: 180 + Math.floor(Math.random() * 40) - 20,
      label: "Total Cholesterol",
    });

    creatinine.push({
      date: dateStr,
      value: 1.0 + Math.random() * 0.3,
      label: "Creatinine",
    });
  }

  return {
    vitals: { bloodPressure, heartRate, weight, temperature },
    labs: { glucose, a1c, cholesterol, creatinine },
    timeRange: {
      start: new Date(now.setMonth(now.getMonth() - 12)).toISOString(),
      end: new Date().toISOString(),
    },
  };
}

class FhirChartAnalyticsService {
  async getMedicationChartData(patientId: string, userId: string): Promise<MedicationChartData & { disclaimer: string }> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "MedicationChartAnalytics",
      resourceId: patientId,
      details: "Retrieved medication chart analytics data",
    });

    const medications = sampleMedications;
    const activeCount = medications.filter((m) => m.status === "active").length;
    const totalPrescribed = medications.length;

    const adherenceTrend: ChartTimeSeriesPoint[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      adherenceTrend.push({
        date: date.toISOString().split("T")[0],
        value: 85 + Math.floor(Math.random() * 15),
        label: "Adherence %",
      });
    }

    const categoryMap = new Map<string, number>();
    medications.forEach((m) => {
      categoryMap.set(m.category, (categoryMap.get(m.category) || 0) + 1);
    });

    const categoryDistribution = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
      percentage: Math.round((count / totalPrescribed) * 100),
    }));

    const averageAdherence = medications.reduce((sum, m) => sum + (m.adherenceRate || 0), 0) / medications.length;
    const refillsNeeded = medications.filter((m) => m.status === "active" && m.refillHistory.length > 0).length;

    return {
      timeline: medications,
      adherenceTrend,
      categoryDistribution,
      activeCount,
      totalPrescribed,
      averageAdherence: Math.round(averageAdherence),
      refillsNeeded,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async getConditionChartData(patientId: string, userId: string): Promise<ConditionChartData & { disclaimer: string }> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ConditionChartAnalytics",
      resourceId: patientId,
      details: "Retrieved condition chart analytics data",
    });

    const conditions = sampleConditions;
    const activeConditions = conditions.filter((c) => c.clinicalStatus === "active").length;
    const resolvedConditions = conditions.filter((c) => c.clinicalStatus === "resolved").length;
    const chronicConditions = conditions.filter((c) => c.clinicalStatus === "active" && !c.abatementDate).length;

    const severityMap = new Map<string, number>();
    conditions.forEach((c) => {
      if (c.severity) {
        severityMap.set(c.severity, (severityMap.get(c.severity) || 0) + 1);
      }
    });

    const severityDistribution = Array.from(severityMap.entries()).map(([severity, count]) => ({
      severity,
      count,
    }));

    const categoryMap = new Map<string, { active: number; resolved: number }>();
    conditions.forEach((c) => {
      const current = categoryMap.get(c.category) || { active: 0, resolved: 0 };
      if (c.clinicalStatus === "active") {
        current.active++;
      } else {
        current.resolved++;
      }
      categoryMap.set(c.category, current);
    });

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, counts]) => ({
      category,
      ...counts,
    }));

    const onsetTimeline: ChartTimeSeriesPoint[] = conditions
      .filter((c) => c.onsetDate)
      .sort((a, b) => new Date(a.onsetDate!).getTime() - new Date(b.onsetDate!).getTime())
      .map((c) => ({
        date: c.onsetDate!,
        value: 1,
        label: c.name,
      }));

    return {
      conditions,
      severityDistribution,
      categoryBreakdown,
      onsetTimeline,
      activeConditions,
      resolvedConditions,
      chronicConditions,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async getEncounterChartData(patientId: string, userId: string): Promise<EncounterChartData & { disclaimer: string }> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "EncounterChartAnalytics",
      resourceId: patientId,
      details: "Retrieved encounter chart analytics data",
    });

    const encounters = sampleEncounters;
    const totalEncounters = encounters.length;
    const emergencyVisits = encounters.filter((e) => e.class === "emergency").length;
    const plannedVisits = encounters.filter((e) => e.status === "planned").length;

    const frequencyByMonth: ChartTimeSeriesPoint[] = [];
    const monthMap = new Map<string, number>();
    encounters.forEach((e) => {
      const month = e.date.substring(0, 7);
      monthMap.set(month, (monthMap.get(month) || 0) + 1);
    });

    const sortedMonths = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    sortedMonths.forEach(([month, count]) => {
      frequencyByMonth.push({
        date: month + "-01",
        value: count,
        label: "Encounters",
      });
    });

    const typeMap = new Map<string, number>();
    encounters.forEach((e) => {
      typeMap.set(e.type, (typeMap.get(e.type) || 0) + 1);
    });

    const typeDistribution = Array.from(typeMap.entries()).map(([type, count]) => ({
      type,
      count,
      percentage: Math.round((count / totalEncounters) * 100),
    }));

    const providerMap = new Map<string, number>();
    encounters.forEach((e) => {
      if (e.provider) {
        providerMap.set(e.provider, (providerMap.get(e.provider) || 0) + 1);
      }
    });

    const providerBreakdown = Array.from(providerMap.entries())
      .map(([provider, encounters]) => ({ provider, encounters }))
      .sort((a, b) => b.encounters - a.encounters);

    const completedEncounters = encounters.filter((e) => e.status === "finished" && e.duration);
    const averageDuration = completedEncounters.length > 0
      ? Math.round(completedEncounters.reduce((sum, e) => sum + (e.duration || 0), 0) / completedEncounters.length)
      : 0;

    return {
      encounters,
      frequencyByMonth,
      typeDistribution,
      providerBreakdown,
      averageDuration,
      totalEncounters,
      emergencyVisits,
      plannedVisits,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async getPatientHealthTrends(patientId: string, userId: string): Promise<PatientHealthTrendData & { disclaimer: string }> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PatientHealthTrends",
      resourceId: patientId,
      details: "Retrieved patient health trend data for visualization",
    });

    const trends = generateVitalsData();

    return {
      ...trends,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async getProviderDashboardData(patientId: string, userId: string): Promise<{
    medications: MedicationChartData;
    conditions: ConditionChartData;
    encounters: EncounterChartData;
    healthTrends: PatientHealthTrendData;
    disclaimer: string;
  }> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ProviderDashboard",
      resourceId: patientId,
      details: "Retrieved comprehensive provider dashboard data",
    });

    const [medications, conditions, encounters, healthTrends] = await Promise.all([
      this.getMedicationChartData(patientId, userId),
      this.getConditionChartData(patientId, userId),
      this.getEncounterChartData(patientId, userId),
      this.getPatientHealthTrends(patientId, userId),
    ]);

    return {
      medications,
      conditions,
      encounters,
      healthTrends,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async getPatientDashboardData(patientId: string, userId: string): Promise<{
    medicationSummary: {
      activeCount: number;
      adherenceRate: number;
      nextRefills: { name: string; date: string }[];
    };
    conditionSummary: {
      activeConditions: string[];
      chronicCount: number;
    };
    recentEncounters: {
      type: string;
      date: string;
      provider: string;
    }[];
    upcomingAppointments: {
      type: string;
      date: string;
      provider: string;
    }[];
    healthTrends: PatientHealthTrendData;
    disclaimer: string;
  }> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PatientDashboard",
      resourceId: patientId,
      details: "Retrieved patient-facing dashboard data",
    });

    const medications = sampleMedications;
    const conditions = sampleConditions;
    const encounters = sampleEncounters;
    const healthTrends = generateVitalsData();

    const activeMeds = medications.filter((m) => m.status === "active");
    const adherenceRate = Math.round(
      activeMeds.reduce((sum, m) => sum + (m.adherenceRate || 0), 0) / activeMeds.length
    );

    const activeConditions = conditions
      .filter((c) => c.clinicalStatus === "active")
      .map((c) => c.name);

    const recentEncounters = encounters
      .filter((e) => e.status === "finished")
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3)
      .map((e) => ({
        type: e.type,
        date: e.date,
        provider: e.provider || "Unknown",
      }));

    const upcomingAppointments = encounters
      .filter((e) => e.status === "planned")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3)
      .map((e) => ({
        type: e.type,
        date: e.date,
        provider: e.provider || "Unknown",
      }));

    return {
      medicationSummary: {
        activeCount: activeMeds.length,
        adherenceRate,
        nextRefills: activeMeds.slice(0, 3).map((m) => ({
          name: m.name,
          date: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        })),
      },
      conditionSummary: {
        activeConditions,
        chronicCount: conditions.filter((c) => c.clinicalStatus === "active" && !c.abatementDate).length,
      },
      recentEncounters,
      upcomingAppointments,
      healthTrends,
      disclaimer: NO_CDS_DISCLAIMER,
    };
  }
}

export const fhirChartAnalyticsService = new FhirChartAnalyticsService();
console.log("[FHIRChartAnalytics] Service initialized with longitudinal visualization support");
