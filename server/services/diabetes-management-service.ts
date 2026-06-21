import { logPhiAccess } from "../security/hipaa-audit";

const NO_ADVICE_DISCLAIMER = "IMPORTANT: This information is for tracking and educational purposes only. It does not constitute medical advice. Always consult your healthcare provider before making any changes to your diabetes management plan.";

const ADA_GUIDELINE_VERSION = "ADA Standards of Care in Diabetes—2026";

export type GlucoseContext = "fasting" | "pre_meal" | "post_meal" | "bedtime" | "other";
export type EventType = "hypoglycemia" | "hyperglycemia";
export type EventSeverity = "mild" | "moderate" | "severe";
export type DataSource = "manual" | "fhir" | "cgm" | "apple_health" | "google_fit";
export type ComplicationCategory = "retinopathy" | "nephropathy" | "neuropathy" | "cardiovascular" | "foot";

export interface GlucoseEntry {
  id: string;
  profileId: string;
  value: number;
  unit: "mg/dL" | "mmol/L";
  context: GlucoseContext;
  timestamp: string;
  source: DataSource;
  notes?: string;
  isOutOfRange: boolean;
  configuredRangeLow?: number;
  configuredRangeHigh?: number;
  createdAt: string;
  updatedAt: string;
}

export interface HypoHyperEvent {
  id: string;
  profileId: string;
  eventType: EventType;
  severity: EventSeverity;
  timestamp: string;
  symptoms: string[];
  context?: string;
  actionTaken?: string;
  glucoseValue?: number;
  glucoseUnit?: "mg/dL" | "mmol/L";
  resolved: boolean;
  resolvedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface DiabetesMedication {
  id: string;
  profileId: string;
  name: string;
  genericName?: string;
  category: "insulin" | "non_insulin" | "supply";
  dosage: string;
  frequency: string;
  route?: string;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  prescriber?: string;
  pharmacy?: string;
  refillReminder: boolean;
  refillDate?: string;
  sideEffects: PatientReportedSideEffect[];
  notes?: string;
  source: DataSource;
  createdAt: string;
  updatedAt: string;
}

export interface PatientReportedSideEffect {
  id: string;
  symptom: string;
  severity: "mild" | "moderate" | "severe";
  reportedAt: string;
  notes?: string;
}

export interface MedicationAdherence {
  id: string;
  medicationId: string;
  profileId: string;
  scheduledTime: string;
  status: "taken" | "missed" | "late" | "skipped";
  actualTime?: string;
  notes?: string;
  createdAt: string;
}

export interface DiabetesLabResult {
  id: string;
  profileId: string;
  labType: "a1c" | "egfr" | "urine_albumin" | "ldl" | "hdl" | "triglycerides" | "creatinine" | "bp_systolic" | "bp_diastolic" | "weight";
  value: number;
  unit: string;
  loincCode?: string;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
  collectedAt: string;
  source: DataSource;
  fhirResourceId?: string;
  providerName?: string;
  notes?: string;
  createdAt: string;
}

export interface CareTask {
  id: string;
  profileId: string;
  templateId?: string;
  title: string;
  description: string;
  category: "screening" | "lab" | "appointment" | "self_care" | "medication" | "other";
  cadenceMonths?: number;
  lastCompletedAt?: string;
  nextDueAt?: string;
  isActive: boolean;
  isProviderConfigured: boolean;
  configuredBy?: string;
  priority: "low" | "medium" | "high";
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplicationRecord {
  id: string;
  profileId: string;
  category: ComplicationCategory;
  condition: string;
  diagnosedAt?: string;
  severity?: string;
  lastAssessmentAt?: string;
  nextAssessmentAt?: string;
  notes?: string;
  symptoms: string[];
  photos?: string[];
  source: DataSource;
  createdAt: string;
  updatedAt: string;
}

export interface ScreeningRecord {
  id: string;
  profileId: string;
  screeningType: "eye_exam" | "foot_exam" | "kidney_labs" | "lipid_panel" | "dental" | "flu_vaccine" | "pneumonia_vaccine" | "covid_vaccine";
  completedAt?: string;
  nextDueAt?: string;
  provider?: string;
  result?: string;
  notes?: string;
  cadenceMonths: number;
  source: DataSource;
  createdAt: string;
}

export interface GlucoseTargetRange {
  id: string;
  profileId: string;
  context: GlucoseContext;
  lowThreshold: number;
  highThreshold: number;
  unit: "mg/dL" | "mmol/L";
  setBy: "patient" | "provider";
  providerName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiabetesDashboardSummary {
  lastGlucoseUpdate?: { value: number; unit: string; timestamp: string; context: GlucoseContext };
  medicationsDueToday: { id: string; name: string; dueTime: string; taken: boolean }[];
  careTasksDue: CareTask[];
  glucoseSummary24h: {
    readings: number;
    average?: number;
    timeInRange?: number;
    hypoEvents: number;
    hyperEvents: number;
  };
  hypoHyperEvents7d: { hypo: number; hyper: number };
  keyLabsSnapshot: {
    a1c?: { value: number; date: string };
    egfr?: { value: number; date: string };
    urineAlbumin?: { value: number; date: string };
    ldl?: { value: number; date: string };
  };
  screeningsOverdue: ScreeningRecord[];
  disclaimer: string;
  guidelineVersion: string;
}

export interface VisitPacketOptions {
  timeframeMonths: number;
  includeGlucoseLogs: boolean;
  includeMedications: boolean;
  includeLabs: boolean;
  includeCareTasks: boolean;
  includeComplications: boolean;
  includeSensitiveNotes: boolean;
  packetType: "quick_summary" | "full_record" | "caregiver_copy";
}

export interface VisitPacket {
  id: string;
  profileId: string;
  generatedAt: string;
  options: VisitPacketOptions;
  sections: {
    patientInfo: { name: string; dob: string; diabetesType?: string; diagnosisDate?: string };
    glucoseSummary?: { readings: GlucoseEntry[]; summary: object };
    medications?: DiabetesMedication[];
    labs?: DiabetesLabResult[];
    careTasks?: CareTask[];
    complications?: ComplicationRecord[];
    screenings?: ScreeningRecord[];
  };
  disclaimers: string[];
  dataProvenance: { source: DataSource; lastUpdated: string }[];
}

const guidelineTrackingTemplates = {
  version: "2026.1",
  source: ADA_GUIDELINE_VERSION,
  careTasks: [
    { id: "eye_exam", title: "Schedule eye exam", category: "screening", cadenceMonths: 12, description: "Commonly tracked for diabetes management" },
    { id: "foot_exam", title: "Foot examination", category: "screening", cadenceMonths: 12, description: "Commonly tracked for diabetes management" },
    { id: "kidney_labs", title: "Kidney labs (eGFR, urine albumin)", category: "lab", cadenceMonths: 12, description: "Commonly tracked for diabetes management" },
    { id: "a1c_check", title: "A1c check", category: "lab", cadenceMonths: 3, description: "Commonly tracked for diabetes management" },
    { id: "lipid_panel", title: "Lipid panel", category: "lab", cadenceMonths: 12, description: "Commonly tracked for diabetes management" },
    { id: "bp_check", title: "Blood pressure check", category: "self_care", cadenceMonths: 1, description: "Commonly tracked for diabetes management" },
    { id: "flu_vaccine", title: "Annual flu vaccine", category: "medication", cadenceMonths: 12, description: "Commonly recommended for people with diabetes" },
    { id: "dental_exam", title: "Dental examination", category: "screening", cadenceMonths: 6, description: "Commonly tracked for diabetes management" },
    { id: "upload_cgm", title: "Upload CGM report", category: "self_care", cadenceMonths: 3, description: "Consider bringing to visits" },
    { id: "med_list", title: "Review medication list", category: "medication", cadenceMonths: 3, description: "Consider bringing current list to visits" },
  ],
  screeningCadences: {
    eye_exam: 12,
    foot_exam: 12,
    kidney_labs: 12,
    lipid_panel: 12,
    dental: 6,
    flu_vaccine: 12,
    pneumonia_vaccine: 60,
    covid_vaccine: 12,
  },
  defaultGlucoseRanges: {
    fasting: { low: 80, high: 130, unit: "mg/dL" as const },
    pre_meal: { low: 80, high: 130, unit: "mg/dL" as const },
    post_meal: { low: 80, high: 180, unit: "mg/dL" as const },
    bedtime: { low: 100, high: 140, unit: "mg/dL" as const },
    other: { low: 70, high: 180, unit: "mg/dL" as const },
  },
};

const glucoseEntries: Map<string, GlucoseEntry[]> = new Map();
const hypoHyperEvents: Map<string, HypoHyperEvent[]> = new Map();
const diabetesMedications: Map<string, DiabetesMedication[]> = new Map();
const medicationAdherence: Map<string, MedicationAdherence[]> = new Map();
const diabetesLabs: Map<string, DiabetesLabResult[]> = new Map();
const careTasks: Map<string, CareTask[]> = new Map();
const complications: Map<string, ComplicationRecord[]> = new Map();
const screenings: Map<string, ScreeningRecord[]> = new Map();
const glucoseRanges: Map<string, GlucoseTargetRange[]> = new Map();
const visitPackets: Map<string, VisitPacket[]> = new Map();

function generateId(): string {
  return `dm-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function initializeSampleData(profileId: string): void {
  if (glucoseEntries.has(profileId)) return;

  const now = new Date();
  const entries: GlucoseEntry[] = [];
  const labs: DiabetesLabResult[] = [];
  const meds: DiabetesMedication[] = [];
  const tasks: CareTask[] = [];
  const screens: ScreeningRecord[] = [];

  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    ["fasting", "post_meal", "bedtime"].forEach((context, idx) => {
      const baseValue = context === "fasting" ? 110 : context === "post_meal" ? 145 : 120;
      const variation = Math.floor(Math.random() * 40) - 20;
      const value = baseValue + variation;
      const entryDate = new Date(date);
      entryDate.setHours(context === "fasting" ? 7 : context === "post_meal" ? 13 : 22, 0, 0, 0);
      
      entries.push({
        id: generateId(),
        profileId,
        value,
        unit: "mg/dL",
        context: context as GlucoseContext,
        timestamp: entryDate.toISOString(),
        source: i % 3 === 0 ? "cgm" : "manual",
        isOutOfRange: value < 70 || value > 180,
        configuredRangeLow: 70,
        configuredRangeHigh: 180,
        createdAt: entryDate.toISOString(),
        updatedAt: entryDate.toISOString(),
      });
    });
  }
  glucoseEntries.set(profileId, entries);

  const labsData: Array<{ type: DiabetesLabResult["labType"]; value: number; unit: string; daysAgo: number }> = [
    { type: "a1c", value: 7.2, unit: "%", daysAgo: 45 },
    { type: "egfr", value: 85, unit: "mL/min/1.73m²", daysAgo: 90 },
    { type: "urine_albumin", value: 18, unit: "mg/g Cr", daysAgo: 90 },
    { type: "ldl", value: 95, unit: "mg/dL", daysAgo: 120 },
    { type: "hdl", value: 52, unit: "mg/dL", daysAgo: 120 },
    { type: "triglycerides", value: 140, unit: "mg/dL", daysAgo: 120 },
    { type: "creatinine", value: 0.9, unit: "mg/dL", daysAgo: 90 },
    { type: "a1c", value: 7.5, unit: "%", daysAgo: 135 },
    { type: "a1c", value: 7.8, unit: "%", daysAgo: 225 },
  ];

  labsData.forEach((lab) => {
    const labDate = new Date(now);
    labDate.setDate(labDate.getDate() - lab.daysAgo);
    labs.push({
      id: generateId(),
      profileId,
      labType: lab.type,
      value: lab.value,
      unit: lab.unit,
      collectedAt: labDate.toISOString(),
      source: "fhir",
      providerName: "Primary Care Clinic",
      createdAt: labDate.toISOString(),
    });
  });
  diabetesLabs.set(profileId, labs);

  meds.push(
    {
      id: generateId(),
      profileId,
      name: "Metformin ER",
      genericName: "metformin",
      category: "non_insulin",
      dosage: "1000mg",
      frequency: "twice daily",
      route: "oral",
      startDate: new Date(now.getFullYear() - 2, 3, 15).toISOString(),
      isActive: true,
      prescriber: "Dr. Smith",
      refillReminder: true,
      sideEffects: [],
      source: "fhir",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      profileId,
      name: "Lantus",
      genericName: "insulin glargine",
      category: "insulin",
      dosage: "20 units",
      frequency: "once daily at bedtime",
      route: "subcutaneous",
      startDate: new Date(now.getFullYear() - 1, 6, 1).toISOString(),
      isActive: true,
      prescriber: "Dr. Johnson",
      refillReminder: true,
      sideEffects: [],
      source: "fhir",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      profileId,
      name: "Blood Glucose Test Strips",
      category: "supply",
      dosage: "100 count",
      frequency: "as needed",
      startDate: new Date().toISOString(),
      isActive: true,
      refillReminder: true,
      sideEffects: [],
      source: "manual",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  );
  diabetesMedications.set(profileId, meds);

  guidelineTrackingTemplates.careTasks.forEach((template) => {
    const lastCompleted = new Date(now);
    lastCompleted.setMonth(lastCompleted.getMonth() - Math.floor(Math.random() * template.cadenceMonths));
    const nextDue = new Date(lastCompleted);
    nextDue.setMonth(nextDue.getMonth() + template.cadenceMonths);

    tasks.push({
      id: generateId(),
      profileId,
      templateId: template.id,
      title: template.title,
      description: template.description,
      category: template.category as CareTask["category"],
      cadenceMonths: template.cadenceMonths,
      lastCompletedAt: lastCompleted.toISOString(),
      nextDueAt: nextDue.toISOString(),
      isActive: true,
      isProviderConfigured: false,
      priority: "medium",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
  careTasks.set(profileId, tasks);

  const screeningTypes: ScreeningRecord["screeningType"][] = ["eye_exam", "foot_exam", "kidney_labs", "lipid_panel", "flu_vaccine"];
  screeningTypes.forEach((type) => {
    const cadence = guidelineTrackingTemplates.screeningCadences[type];
    const lastCompleted = new Date(now);
    lastCompleted.setMonth(lastCompleted.getMonth() - Math.floor(Math.random() * cadence));
    const nextDue = new Date(lastCompleted);
    nextDue.setMonth(nextDue.getMonth() + cadence);

    screens.push({
      id: generateId(),
      profileId,
      screeningType: type,
      completedAt: lastCompleted.toISOString(),
      nextDueAt: nextDue.toISOString(),
      cadenceMonths: cadence,
      source: "fhir",
      createdAt: new Date().toISOString(),
    });
  });
  screenings.set(profileId, screens);

  glucoseRanges.set(profileId, Object.entries(guidelineTrackingTemplates.defaultGlucoseRanges).map(([context, range]) => ({
    id: generateId(),
    profileId,
    context: context as GlucoseContext,
    lowThreshold: range.low,
    highThreshold: range.high,
    unit: range.unit,
    setBy: "patient",
    notes: "Default ranges - can be customized by you or your clinician",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })));

  hypoHyperEvents.set(profileId, [
    {
      id: generateId(),
      profileId,
      eventType: "hypoglycemia",
      severity: "mild",
      timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      symptoms: ["shakiness", "sweating"],
      context: "Delayed lunch",
      actionTaken: "Had juice and crackers",
      glucoseValue: 62,
      glucoseUnit: "mg/dL",
      resolved: true,
      resolvedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    },
  ]);

  complications.set(profileId, []);
}

class DiabetesManagementService {
  async getDashboardSummary(profileId: string, userId: string): Promise<DiabetesDashboardSummary> {
    initializeSampleData(profileId);
    
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DiabetesDashboard",
      resourceId: profileId,
      details: "Accessed diabetes management dashboard",
    });

    const entries = glucoseEntries.get(profileId) || [];
    const events = hypoHyperEvents.get(profileId) || [];
    const meds = diabetesMedications.get(profileId) || [];
    const labs = diabetesLabs.get(profileId) || [];
    const tasks = careTasks.get(profileId) || [];
    const screens = screenings.get(profileId) || [];

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const entries24h = entries.filter((e) => new Date(e.timestamp) >= last24h);
    const events7d = events.filter((e) => new Date(e.timestamp) >= last7d);

    const sortedEntries = [...entries].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const lastEntry = sortedEntries[0];

    const average24h = entries24h.length > 0
      ? Math.round(entries24h.reduce((sum, e) => sum + e.value, 0) / entries24h.length)
      : undefined;

    const inRangeCount = entries24h.filter((e) => !e.isOutOfRange).length;
    const timeInRange = entries24h.length > 0 ? Math.round((inRangeCount / entries24h.length) * 100) : undefined;

    const medsDueToday = meds.filter((m) => m.isActive).map((m) => ({
      id: m.id,
      name: m.name,
      dueTime: "As scheduled",
      taken: false,
    }));

    const careTasksDue = tasks.filter((t) => t.isActive && t.nextDueAt && new Date(t.nextDueAt) <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));

    const getLatestLab = (type: DiabetesLabResult["labType"]) => {
      const typeLabs = labs.filter((l) => l.labType === type).sort((a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime());
      return typeLabs[0] ? { value: typeLabs[0].value, date: typeLabs[0].collectedAt } : undefined;
    };

    const screeningsOverdue = screens.filter((s) => s.nextDueAt && new Date(s.nextDueAt) < now);

    return {
      lastGlucoseUpdate: lastEntry ? {
        value: lastEntry.value,
        unit: lastEntry.unit,
        timestamp: lastEntry.timestamp,
        context: lastEntry.context,
      } : undefined,
      medicationsDueToday: medsDueToday,
      careTasksDue,
      glucoseSummary24h: {
        readings: entries24h.length,
        average: average24h,
        timeInRange,
        hypoEvents: events7d.filter((e) => e.eventType === "hypoglycemia").length,
        hyperEvents: events7d.filter((e) => e.eventType === "hyperglycemia").length,
      },
      hypoHyperEvents7d: {
        hypo: events7d.filter((e) => e.eventType === "hypoglycemia").length,
        hyper: events7d.filter((e) => e.eventType === "hyperglycemia").length,
      },
      keyLabsSnapshot: {
        a1c: getLatestLab("a1c"),
        egfr: getLatestLab("egfr"),
        urineAlbumin: getLatestLab("urine_albumin"),
        ldl: getLatestLab("ldl"),
      },
      screeningsOverdue,
      disclaimer: NO_ADVICE_DISCLAIMER,
      guidelineVersion: ADA_GUIDELINE_VERSION,
    };
  }

  async getGlucoseEntries(profileId: string, userId: string, options?: { days?: number; context?: GlucoseContext }): Promise<{ entries: GlucoseEntry[]; disclaimer: string }> {
    initializeSampleData(profileId);
    
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "GlucoseLog",
      resourceId: profileId,
      details: `Retrieved glucose entries${options?.days ? ` for last ${options.days} days` : ""}`,
    });

    let entries = glucoseEntries.get(profileId) || [];
    
    if (options?.days) {
      const cutoff = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000);
      entries = entries.filter((e) => new Date(e.timestamp) >= cutoff);
    }
    
    if (options?.context) {
      entries = entries.filter((e) => e.context === options.context);
    }

    return {
      entries: entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      disclaimer: NO_ADVICE_DISCLAIMER,
    };
  }

  async addGlucoseEntry(profileId: string, userId: string, data: Omit<GlucoseEntry, "id" | "profileId" | "createdAt" | "updatedAt" | "isOutOfRange">): Promise<GlucoseEntry> {
    initializeSampleData(profileId);

    const ranges = glucoseRanges.get(profileId) || [];
    const range = ranges.find((r) => r.context === data.context) || ranges.find((r) => r.context === "other");
    
    const isOutOfRange = range ? (data.value < range.lowThreshold || data.value > range.highThreshold) : false;

    const entry: GlucoseEntry = {
      id: generateId(),
      profileId,
      ...data,
      isOutOfRange,
      configuredRangeLow: range?.lowThreshold,
      configuredRangeHigh: range?.highThreshold,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const entries = glucoseEntries.get(profileId) || [];
    entries.push(entry);
    glucoseEntries.set(profileId, entries);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "GlucoseEntry",
      resourceId: entry.id,
      details: `Added glucose entry: ${data.value} ${data.unit} (${data.context})`,
    });

    return entry;
  }

  async logHypoHyperEvent(profileId: string, userId: string, data: Omit<HypoHyperEvent, "id" | "profileId" | "createdAt">): Promise<HypoHyperEvent> {
    initializeSampleData(profileId);

    const event: HypoHyperEvent = {
      id: generateId(),
      profileId,
      ...data,
      createdAt: new Date().toISOString(),
    };

    const events = hypoHyperEvents.get(profileId) || [];
    events.push(event);
    hypoHyperEvents.set(profileId, events);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "HypoHyperEvent",
      resourceId: event.id,
      details: `Logged ${data.eventType} event (${data.severity})`,
    });

    return event;
  }

  async getHypoHyperEvents(profileId: string, userId: string, days?: number): Promise<{ events: HypoHyperEvent[]; disclaimer: string }> {
    initializeSampleData(profileId);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "HypoHyperEvents",
      resourceId: profileId,
      details: `Retrieved hypo/hyper events${days ? ` for last ${days} days` : ""}`,
    });

    let events = hypoHyperEvents.get(profileId) || [];

    if (days) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      events = events.filter((e) => new Date(e.timestamp) >= cutoff);
    }

    return {
      events: events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
      disclaimer: NO_ADVICE_DISCLAIMER,
    };
  }

  async getMedications(profileId: string, userId: string): Promise<{ medications: DiabetesMedication[]; disclaimer: string }> {
    initializeSampleData(profileId);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DiabetesMedications",
      resourceId: profileId,
      details: "Retrieved diabetes medications list",
    });

    const meds = diabetesMedications.get(profileId) || [];

    return {
      medications: meds.sort((a, b) => {
        const categoryOrder = { insulin: 0, non_insulin: 1, supply: 2 };
        return categoryOrder[a.category] - categoryOrder[b.category];
      }),
      disclaimer: NO_ADVICE_DISCLAIMER,
    };
  }

  async addMedication(profileId: string, userId: string, data: Omit<DiabetesMedication, "id" | "profileId" | "createdAt" | "updatedAt">): Promise<DiabetesMedication> {
    initializeSampleData(profileId);

    const med: DiabetesMedication = {
      id: generateId(),
      profileId,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const meds = diabetesMedications.get(profileId) || [];
    meds.push(med);
    diabetesMedications.set(profileId, meds);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "DiabetesMedication",
      resourceId: med.id,
      details: `Added medication: ${data.name}`,
    });

    return med;
  }

  async logMedicationAdherence(profileId: string, userId: string, data: Omit<MedicationAdherence, "id" | "profileId" | "createdAt">): Promise<MedicationAdherence> {
    const adherence: MedicationAdherence = {
      id: generateId(),
      profileId,
      ...data,
      createdAt: new Date().toISOString(),
    };

    const records = medicationAdherence.get(profileId) || [];
    records.push(adherence);
    medicationAdherence.set(profileId, records);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "MedicationAdherence",
      resourceId: adherence.id,
      details: `Logged medication adherence: ${data.status}`,
    });

    return adherence;
  }

  async getLabResults(profileId: string, userId: string, labType?: DiabetesLabResult["labType"]): Promise<{ labs: DiabetesLabResult[]; disclaimer: string }> {
    initializeSampleData(profileId);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DiabetesLabs",
      resourceId: profileId,
      details: `Retrieved lab results${labType ? ` (${labType})` : ""}`,
    });

    let labs = diabetesLabs.get(profileId) || [];

    if (labType) {
      labs = labs.filter((l) => l.labType === labType);
    }

    return {
      labs: labs.sort((a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime()),
      disclaimer: NO_ADVICE_DISCLAIMER,
    };
  }

  async getCareTasks(profileId: string, userId: string): Promise<{ tasks: CareTask[]; disclaimer: string; guidelineVersion: string }> {
    initializeSampleData(profileId);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DiabetesCareTasks",
      resourceId: profileId,
      details: "Retrieved care tasks checklist",
    });

    const tasks = careTasks.get(profileId) || [];

    return {
      tasks: tasks.sort((a, b) => {
        if (!a.nextDueAt) return 1;
        if (!b.nextDueAt) return -1;
        return new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime();
      }),
      disclaimer: NO_ADVICE_DISCLAIMER,
      guidelineVersion: ADA_GUIDELINE_VERSION,
    };
  }

  async updateCareTask(profileId: string, userId: string, taskId: string, updates: Partial<CareTask>): Promise<CareTask | null> {
    initializeSampleData(profileId);

    const tasks = careTasks.get(profileId) || [];
    const index = tasks.findIndex((t) => t.id === taskId);
    
    if (index === -1) return null;

    tasks[index] = {
      ...tasks[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    careTasks.set(profileId, tasks);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "DiabetesCareTask",
      resourceId: taskId,
      details: "Updated care task",
    });

    return tasks[index];
  }

  async completeTask(profileId: string, userId: string, taskId: string): Promise<CareTask | null> {
    initializeSampleData(profileId);

    const tasks = careTasks.get(profileId) || [];
    const task = tasks.find((t) => t.id === taskId);
    
    if (!task) return null;

    task.lastCompletedAt = new Date().toISOString();
    if (task.cadenceMonths) {
      const nextDue = new Date();
      nextDue.setMonth(nextDue.getMonth() + task.cadenceMonths);
      task.nextDueAt = nextDue.toISOString();
    }
    task.updatedAt = new Date().toISOString();

    careTasks.set(profileId, tasks);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "DiabetesCareTask",
      resourceId: taskId,
      details: "Marked care task as completed",
    });

    return task;
  }

  async getComplications(profileId: string, userId: string): Promise<{ complications: ComplicationRecord[]; disclaimer: string }> {
    initializeSampleData(profileId);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DiabetesComplications",
      resourceId: profileId,
      details: "Retrieved complications tracking data",
    });

    const comps = complications.get(profileId) || [];

    return {
      complications: comps,
      disclaimer: NO_ADVICE_DISCLAIMER,
    };
  }

  async addComplication(profileId: string, userId: string, data: Omit<ComplicationRecord, "id" | "profileId" | "createdAt" | "updatedAt">): Promise<ComplicationRecord> {
    initializeSampleData(profileId);

    const comp: ComplicationRecord = {
      id: generateId(),
      profileId,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const comps = complications.get(profileId) || [];
    comps.push(comp);
    complications.set(profileId, comps);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "DiabetesComplication",
      resourceId: comp.id,
      details: `Added complication record: ${data.category}`,
    });

    return comp;
  }

  async getScreenings(profileId: string, userId: string): Promise<{ screenings: ScreeningRecord[]; disclaimer: string }> {
    initializeSampleData(profileId);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DiabetesScreenings",
      resourceId: profileId,
      details: "Retrieved screening records",
    });

    const screens = screenings.get(profileId) || [];

    return {
      screenings: screens.sort((a, b) => {
        if (!a.nextDueAt) return 1;
        if (!b.nextDueAt) return -1;
        return new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime();
      }),
      disclaimer: NO_ADVICE_DISCLAIMER,
    };
  }

  async getGlucoseRanges(profileId: string, userId: string): Promise<{ ranges: GlucoseTargetRange[]; disclaimer: string }> {
    initializeSampleData(profileId);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "GlucoseTargetRanges",
      resourceId: profileId,
      details: "Retrieved glucose target ranges",
    });

    const ranges = glucoseRanges.get(profileId) || [];

    return {
      ranges,
      disclaimer: "These ranges are set by you or your clinician for tracking purposes. " + NO_ADVICE_DISCLAIMER,
    };
  }

  async updateGlucoseRange(profileId: string, userId: string, rangeId: string, updates: Partial<GlucoseTargetRange>): Promise<GlucoseTargetRange | null> {
    initializeSampleData(profileId);

    const ranges = glucoseRanges.get(profileId) || [];
    const index = ranges.findIndex((r) => r.id === rangeId);
    
    if (index === -1) return null;

    ranges[index] = {
      ...ranges[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    glucoseRanges.set(profileId, ranges);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "GlucoseTargetRange",
      resourceId: rangeId,
      details: `Updated glucose range for ${ranges[index].context}`,
    });

    return ranges[index];
  }

  async generateVisitPacket(profileId: string, userId: string, options: VisitPacketOptions): Promise<VisitPacket> {
    initializeSampleData(profileId);

    logPhiAccess({
      userId,
      action: "export",
      resourceType: "DiabetesVisitPacket",
      resourceId: profileId,
      details: `Generated ${options.packetType} visit packet`,
    });

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - options.timeframeMonths);

    const entries = options.includeGlucoseLogs ? (glucoseEntries.get(profileId) || []).filter((e) => new Date(e.timestamp) >= cutoffDate) : [];
    const meds = options.includeMedications ? diabetesMedications.get(profileId) || [] : [];
    const labs = options.includeLabs ? (diabetesLabs.get(profileId) || []).filter((l) => new Date(l.collectedAt) >= cutoffDate) : [];
    const tasks = options.includeCareTasks ? careTasks.get(profileId) || [] : [];
    const comps = options.includeComplications ? complications.get(profileId) || [] : [];
    const screens = screenings.get(profileId) || [];

    const packet: VisitPacket = {
      id: generateId(),
      profileId,
      generatedAt: new Date().toISOString(),
      options,
      sections: {
        patientInfo: {
          name: "Patient Name",
          dob: "1970-01-01",
          diabetesType: "Type 2",
          diagnosisDate: "2020-01-01",
        },
        glucoseSummary: options.includeGlucoseLogs ? {
          readings: entries,
          summary: {
            count: entries.length,
            average: entries.length > 0 ? Math.round(entries.reduce((s, e) => s + e.value, 0) / entries.length) : null,
          },
        } : undefined,
        medications: options.includeMedications ? meds : undefined,
        labs: options.includeLabs ? labs : undefined,
        careTasks: options.includeCareTasks ? tasks : undefined,
        complications: options.includeComplications ? comps : undefined,
        screenings: screens,
      },
      disclaimers: [
        NO_ADVICE_DISCLAIMER,
        "This packet contains data from multiple sources. Please verify accuracy with original records.",
        `Generated on ${new Date().toLocaleDateString()} based on ${ADA_GUIDELINE_VERSION} tracking templates.`,
      ],
      dataProvenance: [
        { source: "fhir", lastUpdated: new Date().toISOString() },
        { source: "manual", lastUpdated: new Date().toISOString() },
      ],
    };

    const packets = visitPackets.get(profileId) || [];
    packets.push(packet);
    visitPackets.set(profileId, packets);

    return packet;
  }

  async explainLabResult(profileId: string, userId: string, labId: string): Promise<{ explanation: string; questionsToAsk: string[]; disclaimer: string }> {
    initializeSampleData(profileId);

    const labs = diabetesLabs.get(profileId) || [];
    const lab = labs.find((l) => l.id === labId);

    if (!lab) {
      return {
        explanation: "Lab result not found.",
        questionsToAsk: [],
        disclaimer: NO_ADVICE_DISCLAIMER,
      };
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "DiabetesLabExplanation",
      resourceId: labId,
      details: `Requested explanation for ${lab.labType} result`,
    });

    const explanations: Record<string, { text: string; questions: string[] }> = {
      a1c: {
        text: `A1c (Hemoglobin A1c) measures your average blood sugar over the past 2-3 months. Your result is ${lab.value}%. The ADA generally notes that many adults with diabetes aim for an A1c below 7%, though individual targets vary.`,
        questions: ["What A1c target is right for me?", "How often should I have my A1c checked?", "What factors might affect my A1c accuracy?"],
      },
      egfr: {
        text: `eGFR (estimated Glomerular Filtration Rate) indicates how well your kidneys are filtering waste. Your result is ${lab.value} ${lab.unit}. Values above 90 are generally considered normal.`,
        questions: ["What does this mean for my kidney health?", "Should I see a kidney specialist?", "Are there lifestyle changes I should consider?"],
      },
      urine_albumin: {
        text: `Urine albumin measures protein in your urine, which can indicate kidney stress. Your result is ${lab.value} ${lab.unit}.`,
        questions: ["Is this level concerning for my kidneys?", "How often should this be monitored?", "Are there medications that help protect kidneys?"],
      },
      ldl: {
        text: `LDL (Low-Density Lipoprotein) is often called "bad" cholesterol. Your result is ${lab.value} ${lab.unit}. Lower levels are generally associated with reduced cardiovascular risk.`,
        questions: ["What LDL target should I aim for?", "Do I need medication for cholesterol?", "How does diet affect my LDL?"],
      },
    };

    const info = explanations[lab.labType] || {
      text: `Your ${lab.labType} result is ${lab.value} ${lab.unit}.`,
      questions: ["What does this result mean for me?", "Is this within a healthy range?"],
    };

    return {
      explanation: info.text,
      questionsToAsk: info.questions,
      disclaimer: NO_ADVICE_DISCLAIMER,
    };
  }

  getGuidelineTemplates(): { templates: typeof guidelineTrackingTemplates; disclaimer: string } {
    return {
      templates: guidelineTrackingTemplates,
      disclaimer: `These are common tracking items based on ${ADA_GUIDELINE_VERSION}. They should be confirmed or customized by your healthcare provider.`,
    };
  }
}

export const diabetesManagementService = new DiabetesManagementService();
