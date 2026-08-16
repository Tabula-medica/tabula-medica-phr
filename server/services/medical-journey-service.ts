/**
 * Medical Journey Service
 * Aggregates patient health data into a chronological timeline
 * Provides AI-powered status summaries and health narrative generation
 */

import { generatePhiSafeText } from "./ai-gateway";
import {
  normalizeLoincCode,
  normalizeRxNormCode,
  normalizeSnomedCode,
  NormalizedLabResult,
  NormalizedMedication,
  NormalizedCondition,
  groupLabResultsByCode,
  groupMedicationsByGeneric,
  logNormalizationAccess
} from "./semantic-normalization-service";
import { logPhiAccess } from "../security/hipaa-audit";

export type TimelineEventType = "clinical" | "vital" | "medication" | "lab" | "condition" | "procedure" | "immunization" | "milestone";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: string;
  endDate?: string;
  title: string;
  description?: string;
  category: string;
  severity?: "normal" | "warning" | "critical";
  source: string;
  normalizedCode?: string;
  codeSystem?: string;
  value?: number;
  unit?: string;
  trend?: "improving" | "stable" | "declining";
  metadata?: Record<string, unknown>;
}

export interface VitalTrendData {
  loincCode: string;
  displayName: string;
  dataPoints: Array<{
    date: string;
    value: number;
    unit: string;
    source: string;
    status?: "normal" | "low" | "high" | "critical";
  }>;
  currentValue?: number;
  trend?: "improving" | "stable" | "declining";
  normalRange?: { low: number; high: number };
}

export interface MedicationTimelineEntry {
  rxcui: string;
  displayName: string;
  genericName: string;
  drugClass: string;
  periods: Array<{
    startDate: string;
    endDate?: string;
    status: "active" | "completed" | "stopped";
    dosage?: string;
    frequency?: string;
    source: string;
  }>;
  isActive: boolean;
}

export interface ConditionTimelineEntry {
  snomedCode: string;
  displayName: string;
  category: string;
  onsetDate?: string;
  abatementDate?: string;
  clinicalStatus: string;
  isActive: boolean;
  source: string;
}

export interface JourneyLandmark {
  id: string;
  date: string;
  title: string;
  description: string;
  type: "diagnosis" | "treatment_start" | "surgery" | "er_visit" | "hospitalization" | "milestone" | "improvement";
  significance: "high" | "medium" | "low";
  relatedEvents: string[];
}

export interface EncounterEntry {
  id: string;
  type: string;
  date: string;
  endDate?: string;
  provider?: string;
  location?: string;
  reason?: string;
  source: string;
}

export interface PatientJourneyTimeline {
  patientId: string;
  timeRange: { start: string; end: string };
  summary: JourneySummary;
  events: TimelineEvent[];
  vitalsTracking: VitalTrendData[];
  medicationAdherence: MedicationTimelineEntry[];
  conditions: ConditionTimelineEntry[];
  encounters: EncounterEntry[];
  landmarks: JourneyLandmark[];
  generatedAt: string;
}

export interface JourneySummary {
  statusUpdate: string;
  keyInsights: string[];
  recentChanges: string[];
  healthTrends: Array<{
    metric: string;
    trend: "improving" | "stable" | "declining";
    details: string;
  }>;
  lastCheckup?: {
    date: string;
    provider?: string;
  };
}

interface RawPatientData {
  observations: RawObservation[];
  medications: RawMedication[];
  conditions: RawCondition[];
  encounters: RawEncounter[];
  procedures: RawProcedure[];
  immunizations: RawImmunization[];
}

interface RawObservation {
  id: string;
  code: string;
  display: string;
  value: number;
  unit: string;
  effectiveDate: string;
  source: string;
  category?: string;
}

interface RawMedication {
  id: string;
  code: string;
  display: string;
  startDate: string;
  endDate?: string;
  status: "active" | "completed" | "stopped";
  dosage?: string;
  frequency?: string;
  source: string;
}

interface RawCondition {
  id: string;
  code: string;
  display: string;
  onsetDate?: string;
  abatementDate?: string;
  clinicalStatus: string;
  source: string;
}

interface RawEncounter {
  id: string;
  type: string;
  startDate: string;
  endDate?: string;
  provider?: string;
  location?: string;
  reason?: string;
  source: string;
}

interface RawProcedure {
  id: string;
  code: string;
  display: string;
  performedDate: string;
  provider?: string;
  location?: string;
  source: string;
}

interface RawImmunization {
  id: string;
  code: string;
  display: string;
  date: string;
  status: string;
  source: string;
}

function generateMockPatientData(patientId: string): RawPatientData {
  const now = new Date();
  const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
  
  const generateDates = (count: number, startDate: Date, endDate: Date): string[] => {
    const dates: string[] = [];
    const range = endDate.getTime() - startDate.getTime();
    for (let i = 0; i < count; i++) {
      const randomOffset = Math.random() * range;
      dates.push(new Date(startDate.getTime() + randomOffset).toISOString().split("T")[0]);
    }
    return dates.sort();
  };
  
  const observationDates = generateDates(24, twoYearsAgo, now);
  
  return {
    observations: [
      ...observationDates.slice(0, 8).map((date, i) => ({
        id: `obs-glucose-${i}`,
        code: "2339-0",
        display: i % 2 === 0 ? "Blood Glucose" : "Serum Glucose",
        value: 95 + Math.floor(Math.random() * 40),
        unit: "mg/dL",
        effectiveDate: date,
        source: i % 2 === 0 ? "Primary Care Provider" : "Quest Diagnostics",
        category: "laboratory"
      })),
      ...observationDates.slice(8, 16).map((date, i) => ({
        id: `obs-a1c-${i}`,
        code: "4548-4",
        display: i % 2 === 0 ? "HbA1c" : "Hemoglobin A1c",
        value: 6.2 + Math.random() * 1.5,
        unit: "%",
        effectiveDate: date,
        source: "LabCorp",
        category: "laboratory"
      })),
      ...observationDates.slice(0, 12).map((date, i) => ({
        id: `obs-sbp-${i}`,
        code: "8480-6",
        display: "Systolic BP",
        value: 118 + Math.floor(Math.random() * 20),
        unit: "mmHg",
        effectiveDate: date,
        source: "Clinic Visit",
        category: "vital-signs"
      })),
      ...observationDates.slice(0, 12).map((date, i) => ({
        id: `obs-dbp-${i}`,
        code: "8462-4",
        display: "Diastolic BP",
        value: 72 + Math.floor(Math.random() * 15),
        unit: "mmHg",
        effectiveDate: date,
        source: "Clinic Visit",
        category: "vital-signs"
      })),
      ...observationDates.slice(0, 12).map((date, i) => ({
        id: `obs-hr-${i}`,
        code: "8867-4",
        display: "Heart Rate",
        value: 68 + Math.floor(Math.random() * 20),
        unit: "beats/min",
        effectiveDate: date,
        source: "Clinic Visit",
        category: "vital-signs"
      })),
      ...observationDates.slice(16, 20).map((date, i) => ({
        id: `obs-ldl-${i}`,
        code: "2089-1",
        display: "LDL Cholesterol",
        value: 95 + Math.floor(Math.random() * 40),
        unit: "mg/dL",
        effectiveDate: date,
        source: "LabCorp",
        category: "laboratory"
      })),
      ...observationDates.slice(16, 20).map((date, i) => ({
        id: `obs-hdl-${i}`,
        code: "2085-9",
        display: "HDL Cholesterol",
        value: 45 + Math.floor(Math.random() * 25),
        unit: "mg/dL",
        effectiveDate: date,
        source: "LabCorp",
        category: "laboratory"
      }))
    ],
    medications: [
      {
        id: "med-1",
        code: "6809",
        display: "Metformin",
        startDate: new Date(twoYearsAgo.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "active" as const,
        dosage: "500mg",
        frequency: "twice daily",
        source: "Primary Care Provider"
      },
      {
        id: "med-2",
        code: "29046",
        display: "Lisinopril",
        startDate: new Date(twoYearsAgo.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "active" as const,
        dosage: "10mg",
        frequency: "once daily",
        source: "Hospital Network"
      },
      {
        id: "med-3",
        code: "2403",
        display: "Lipitor",
        startDate: new Date(twoYearsAgo.getTime() + 200 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "active" as const,
        dosage: "20mg",
        frequency: "once daily at bedtime",
        source: "Primary Care Provider"
      },
      {
        id: "med-4",
        code: "161",
        display: "Tylenol",
        startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        endDate: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "completed" as const,
        dosage: "500mg",
        frequency: "as needed",
        source: "Self-reported"
      }
    ],
    conditions: [
      {
        id: "cond-1",
        code: "44054006",
        display: "Type 2 Diabetes",
        onsetDate: new Date(twoYearsAgo.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        clinicalStatus: "active",
        source: "Primary Care Provider"
      },
      {
        id: "cond-2",
        code: "38341003",
        display: "Hypertension",
        onsetDate: new Date(twoYearsAgo.getTime() + 150 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        clinicalStatus: "active",
        source: "Hospital Network"
      },
      {
        id: "cond-3",
        code: "55822004",
        display: "High Cholesterol",
        onsetDate: new Date(twoYearsAgo.getTime() + 190 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        clinicalStatus: "active",
        source: "Primary Care Provider"
      }
    ],
    encounters: [
      {
        id: "enc-1",
        type: "Annual Physical",
        startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        provider: "Dr. Sarah Smith",
        location: "Primary Care Clinic",
        reason: "Annual wellness exam",
        source: "Primary Care Provider"
      },
      {
        id: "enc-2",
        type: "Follow-up Visit",
        startDate: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        provider: "Dr. Sarah Smith",
        location: "Primary Care Clinic",
        reason: "Diabetes management",
        source: "Primary Care Provider"
      },
      {
        id: "enc-3",
        type: "Specialist Consultation",
        startDate: new Date(now.getTime() - 270 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        provider: "Dr. John Chen",
        location: "Cardiology Associates",
        reason: "Cardiovascular risk assessment",
        source: "Hospital Network"
      },
      {
        id: "enc-4",
        type: "Emergency Room Visit",
        startDate: new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        endDate: new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        provider: "ER Staff",
        location: "General Hospital ED",
        reason: "Chest pain (ruled out MI)",
        source: "Hospital System"
      }
    ],
    procedures: [
      {
        id: "proc-1",
        code: "71275",
        display: "CT Coronary Angiography",
        performedDate: new Date(now.getTime() - 395 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        provider: "Dr. Michael Brown",
        location: "Imaging Center",
        source: "Hospital System"
      }
    ],
    immunizations: [
      {
        id: "imm-1",
        code: "197",
        display: "Influenza Vaccine",
        date: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "completed",
        source: "Pharmacy"
      },
      {
        id: "imm-2",
        code: "208",
        display: "COVID-19 Vaccine (Bivalent Booster)",
        date: new Date(now.getTime() - 150 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "completed",
        source: "Primary Care Provider"
      }
    ]
  };
}

function normalizeAndStructureData(rawData: RawPatientData): {
  normalizedLabs: NormalizedLabResult[];
  normalizedMeds: NormalizedMedication[];
  normalizedConditions: NormalizedCondition[];
  encounters: RawEncounter[];
  procedures: RawProcedure[];
  immunizations: RawImmunization[];
} {
  const normalizedLabs: NormalizedLabResult[] = [];
  const normalizedMeds: NormalizedMedication[] = [];
  const normalizedConditions: NormalizedCondition[] = [];
  
  for (const obs of rawData.observations) {
    const mapping = normalizeLoincCode(obs.display);
    if (mapping) {
      normalizedLabs.push({
        loincCode: mapping.loincCode,
        displayName: mapping.displayName,
        category: mapping.category,
        value: obs.value,
        unit: obs.unit,
        normalizedUnit: mapping.unit || obs.unit,
        effectiveDate: obs.effectiveDate,
        source: obs.source,
        originalDisplay: obs.display
      });
    }
  }
  
  for (const med of rawData.medications) {
    const mapping = normalizeRxNormCode(med.display);
    if (mapping) {
      normalizedMeds.push({
        rxcui: mapping.rxcui,
        displayName: mapping.displayName,
        genericName: mapping.genericNames[0] || mapping.displayName,
        drugClass: mapping.drugClass || "Unknown",
        startDate: med.startDate,
        endDate: med.endDate,
        status: med.status,
        source: med.source,
        dosage: med.dosage,
        frequency: med.frequency,
        originalDisplay: med.display
      });
    }
  }
  
  for (const cond of rawData.conditions) {
    const mapping = normalizeSnomedCode(cond.display);
    if (mapping) {
      normalizedConditions.push({
        snomedCode: mapping.snomedCode,
        displayName: mapping.displayName,
        category: mapping.category,
        onsetDate: cond.onsetDate,
        abatementDate: cond.abatementDate,
        clinicalStatus: cond.clinicalStatus,
        source: cond.source,
        originalDisplay: cond.display
      });
    }
  }
  
  return {
    normalizedLabs,
    normalizedMeds,
    normalizedConditions,
    encounters: rawData.encounters,
    procedures: rawData.procedures,
    immunizations: rawData.immunizations
  };
}

function buildTimelineEvents(data: ReturnType<typeof normalizeAndStructureData>): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  
  for (const lab of data.normalizedLabs) {
    events.push({
      id: `lab-${lab.loincCode}-${lab.effectiveDate}`,
      type: "lab",
      date: lab.effectiveDate,
      title: lab.displayName,
      description: `${lab.value} ${lab.unit}`,
      category: lab.category,
      source: lab.source,
      normalizedCode: lab.loincCode,
      codeSystem: "LOINC",
      value: lab.value,
      unit: lab.unit
    });
  }
  
  for (const med of data.normalizedMeds) {
    events.push({
      id: `med-${med.rxcui}-${med.startDate}`,
      type: "medication",
      date: med.startDate,
      endDate: med.endDate,
      title: `${med.displayName} ${med.status === "active" ? "Started" : med.status === "completed" ? "Completed" : "Stopped"}`,
      description: `${med.dosage || ""} ${med.frequency || ""}`.trim(),
      category: med.drugClass,
      source: med.source,
      normalizedCode: med.rxcui,
      codeSystem: "RxNorm"
    });
  }
  
  for (const cond of data.normalizedConditions) {
    if (cond.onsetDate) {
      events.push({
        id: `cond-${cond.snomedCode}-${cond.onsetDate}`,
        type: "condition",
        date: cond.onsetDate,
        title: `${cond.displayName} Diagnosed`,
        category: cond.category,
        source: cond.source,
        normalizedCode: cond.snomedCode,
        codeSystem: "SNOMED-CT",
        severity: cond.clinicalStatus === "active" ? "warning" : "normal"
      });
    }
  }
  
  for (const enc of data.encounters) {
    events.push({
      id: enc.id,
      type: "clinical",
      date: enc.startDate,
      endDate: enc.endDate,
      title: enc.type,
      description: enc.reason,
      category: enc.type.includes("Emergency") ? "Emergency" : "Outpatient",
      source: enc.source,
      severity: enc.type.includes("Emergency") ? "critical" : "normal",
      metadata: { provider: enc.provider, location: enc.location }
    });
  }
  
  for (const proc of data.procedures) {
    events.push({
      id: proc.id,
      type: "procedure",
      date: proc.performedDate,
      title: proc.display,
      category: "Procedure",
      source: proc.source,
      metadata: { provider: proc.provider, location: proc.location }
    });
  }
  
  for (const imm of data.immunizations) {
    events.push({
      id: imm.id,
      type: "immunization",
      date: imm.date,
      title: imm.display,
      category: "Immunization",
      source: imm.source
    });
  }
  
  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function buildVitalsTracking(normalizedLabs: NormalizedLabResult[]): VitalTrendData[] {
  const groupedLabs = groupLabResultsByCode(normalizedLabs);
  const vitalsData: VitalTrendData[] = [];
  
  const vitalCodes = ["8480-6", "8462-4", "8867-4", "2339-0", "4548-4"];
  
  const normalRanges: Record<string, { low: number; high: number }> = {
    "8480-6": { low: 90, high: 120 },
    "8462-4": { low: 60, high: 80 },
    "8867-4": { low: 60, high: 100 },
    "2339-0": { low: 70, high: 100 },
    "4548-4": { low: 4.0, high: 5.7 }
  };
  
  groupedLabs.forEach((results: NormalizedLabResult[], loincCode: string) => {
    if (!vitalCodes.includes(loincCode) || results.length === 0) return;
    
    const dataPoints = results.map((r: NormalizedLabResult) => {
      const range = normalRanges[loincCode];
      let status: "normal" | "low" | "high" | "critical" = "normal";
      if (range) {
        if (r.value < range.low * 0.8) status = "critical";
        else if (r.value < range.low) status = "low";
        else if (r.value > range.high * 1.3) status = "critical";
        else if (r.value > range.high) status = "high";
      }
      return {
        date: r.effectiveDate,
        value: r.value,
        unit: r.unit,
        source: r.source,
        status
      };
    });
    
    const recentValues = dataPoints.slice(-4);
    let trend: "improving" | "stable" | "declining" = "stable";
    if (recentValues.length >= 2) {
      const first = recentValues[0].value;
      const last = recentValues[recentValues.length - 1].value;
      const range = normalRanges[loincCode];
      if (range) {
        const firstDistance = Math.abs(first - (range.low + range.high) / 2);
        const lastDistance = Math.abs(last - (range.low + range.high) / 2);
        if (lastDistance < firstDistance * 0.9) trend = "improving";
        else if (lastDistance > firstDistance * 1.1) trend = "declining";
      }
    }
    
    vitalsData.push({
      loincCode,
      displayName: results[0].displayName,
      dataPoints,
      currentValue: dataPoints[dataPoints.length - 1]?.value,
      trend,
      normalRange: normalRanges[loincCode]
    });
  });
  
  return vitalsData;
}

function buildMedicationTimeline(normalizedMeds: NormalizedMedication[]): MedicationTimelineEntry[] {
  const groupedMeds = groupMedicationsByGeneric(normalizedMeds);
  const medicationTimeline: MedicationTimelineEntry[] = [];
  
  groupedMeds.forEach((meds: NormalizedMedication[], rxcui: string) => {
    if (meds.length === 0) return;
    
    const firstMed = meds[0];
    const isActive = meds.some((m: NormalizedMedication) => m.status === "active");
    
    medicationTimeline.push({
      rxcui,
      displayName: firstMed.displayName,
      genericName: firstMed.genericName,
      drugClass: firstMed.drugClass,
      periods: meds.map((m: NormalizedMedication) => ({
        startDate: m.startDate,
        endDate: m.endDate,
        status: m.status,
        dosage: m.dosage,
        frequency: m.frequency,
        source: m.source
      })),
      isActive
    });
  });
  
  return medicationTimeline;
}

function buildConditionTimeline(normalizedConditions: NormalizedCondition[]): ConditionTimelineEntry[] {
  return normalizedConditions.map(cond => ({
    snomedCode: cond.snomedCode,
    displayName: cond.displayName,
    category: cond.category,
    onsetDate: cond.onsetDate,
    abatementDate: cond.abatementDate,
    clinicalStatus: cond.clinicalStatus,
    isActive: cond.clinicalStatus === "active",
    source: cond.source
  }));
}

function identifyLandmarks(
  events: TimelineEvent[],
  conditions: ConditionTimelineEntry[],
  medications: MedicationTimelineEntry[]
): JourneyLandmark[] {
  const landmarks: JourneyLandmark[] = [];
  
  for (const cond of conditions) {
    if (cond.onsetDate) {
      landmarks.push({
        id: `landmark-dx-${cond.snomedCode}`,
        date: cond.onsetDate,
        title: `${cond.displayName} Diagnosis`,
        description: `Initial diagnosis of ${cond.displayName}`,
        type: "diagnosis",
        significance: "high",
        relatedEvents: events
          .filter(e => e.normalizedCode === cond.snomedCode)
          .map(e => e.id)
      });
    }
  }
  
  for (const med of medications) {
    if (med.periods.length > 0) {
      landmarks.push({
        id: `landmark-tx-${med.rxcui}`,
        date: med.periods[0].startDate,
        title: `Started ${med.displayName}`,
        description: `Began treatment with ${med.displayName} (${med.drugClass})`,
        type: "treatment_start",
        significance: "medium",
        relatedEvents: events
          .filter(e => e.normalizedCode === med.rxcui)
          .map(e => e.id)
      });
    }
  }
  
  const erVisits = events.filter(e => e.category === "Emergency");
  for (const er of erVisits) {
    landmarks.push({
      id: `landmark-er-${er.id}`,
      date: er.date,
      title: er.title,
      description: er.description || "Emergency department visit",
      type: "er_visit",
      significance: "high",
      relatedEvents: [er.id]
    });
  }
  
  return landmarks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

async function generateAISummary(
  conditions: ConditionTimelineEntry[],
  medications: MedicationTimelineEntry[],
  vitals: VitalTrendData[],
  landmarks: JourneyLandmark[],
  lastEncounter?: { date: string; provider?: string }
): Promise<JourneySummary> {
  const activeConditions = conditions.filter(c => c.isActive);
  const activeMedications = medications.filter(m => m.isActive);
  
  const prompt = `You are a medical summarization AI. Generate a patient-friendly health summary based on this data.

Active Conditions:
${activeConditions.map(c => `- ${c.displayName} (since ${c.onsetDate || "unknown"})`).join("\n") || "None"}

Active Medications:
${activeMedications.map(m => `- ${m.displayName} (${m.genericName}): ${m.periods[0]?.dosage || ""} ${m.periods[0]?.frequency || ""}`).join("\n") || "None"}

Recent Vital Trends:
${vitals.map(v => `- ${v.displayName}: ${v.currentValue} ${v.dataPoints[0]?.unit || ""} (Trend: ${v.trend})`).join("\n") || "No recent vitals"}

Key Health Events:
${landmarks.slice(-5).map(l => `- ${l.date}: ${l.title}`).join("\n") || "No major events"}

Last Checkup: ${lastEncounter?.date || "Unknown"} with ${lastEncounter?.provider || "healthcare provider"}

Generate a JSON response with:
1. "statusUpdate": A 3-sentence summary (patient-friendly, no medical jargon)
2. "keyInsights": Array of 3-4 important health insights
3. "recentChanges": Array of notable recent changes
4. "healthTrends": Array of {metric, trend, details} for key health metrics

IMPORTANT: This is for INFORMATIONAL PURPOSES ONLY and is NOT clinical decision support.`;

  try {
    const content = await generatePhiSafeText({
      system: "You are a HIPAA-compliant medical summarization AI. Provide patient-friendly summaries. Always include NO-CDS disclaimer.",
      user: prompt,
      responseMimeType: "application/json",
      maxTokens: 1000
    });

    if (!content) {
      return generateFallbackSummary(activeConditions, activeMedications, vitals, lastEncounter);
    }

    const parsed = JSON.parse(content);
    return {
      statusUpdate: parsed.statusUpdate || "Health summary not available.",
      keyInsights: parsed.keyInsights || [],
      recentChanges: parsed.recentChanges || [],
      healthTrends: parsed.healthTrends || [],
      lastCheckup: lastEncounter
    };
  } catch (error) {
    console.error("AI summary generation error:", error);
    return generateFallbackSummary(activeConditions, activeMedications, vitals, lastEncounter);
  }
}

function generateFallbackSummary(
  conditions: ConditionTimelineEntry[],
  medications: MedicationTimelineEntry[],
  vitals: VitalTrendData[],
  lastEncounter?: { date: string; provider?: string }
): JourneySummary {
  const conditionNames = conditions.map(c => c.displayName).join(", ");
  const medicationCount = medications.length;
  
  const improvingVitals = vitals.filter(v => v.trend === "improving");
  const decliningVitals = vitals.filter(v => v.trend === "declining");
  
  let statusUpdate = "";
  if (conditions.length > 0) {
    statusUpdate = `Managing ${conditionNames} with ${medicationCount} active medication${medicationCount !== 1 ? "s" : ""}. `;
  }
  if (improvingVitals.length > 0) {
    statusUpdate += `Showing improvement in ${improvingVitals.map(v => v.displayName).join(" and ")}. `;
  }
  if (lastEncounter) {
    statusUpdate += `Last checkup was ${lastEncounter.date}${lastEncounter.provider ? ` with ${lastEncounter.provider}` : ""}.`;
  }
  
  return {
    statusUpdate: statusUpdate || "Health record summary available.",
    keyInsights: conditions.map(c => `Active condition: ${c.displayName}`),
    recentChanges: medications.filter(m => m.isActive).map(m => `Taking ${m.displayName}`),
    healthTrends: vitals.map(v => ({
      metric: v.displayName,
      trend: v.trend || "stable",
      details: `Current: ${v.currentValue} ${v.dataPoints[0]?.unit || ""}`
    })),
    lastCheckup: lastEncounter
  };
}

export async function getPatientJourneyTimeline(
  patientId: string,
  userId: string,
  timeRange?: { start: string; end: string }
): Promise<PatientJourneyTimeline> {
  logPhiAccess({
    userId,
    patientId,
    action: "read",
    resourceType: "PatientJourney",
    details: "Accessed longitudinal medical journey timeline"
  });
  
  logNormalizationAccess(patientId, userId, ["observations", "medications", "conditions"]);
  
  const rawData = generateMockPatientData(patientId);
  const normalizedData = normalizeAndStructureData(rawData);
  
  const events = buildTimelineEvents(normalizedData);
  const vitalsTracking = buildVitalsTracking(normalizedData.normalizedLabs);
  const medicationAdherence = buildMedicationTimeline(normalizedData.normalizedMeds);
  const conditions = buildConditionTimeline(normalizedData.normalizedConditions);
  const landmarks = identifyLandmarks(events, conditions, medicationAdherence);
  
  const lastEncounter = normalizedData.encounters.length > 0
    ? {
        date: normalizedData.encounters[0].startDate,
        provider: normalizedData.encounters[0].provider
      }
    : undefined;
  
  const summary = await generateAISummary(conditions, medicationAdherence, vitalsTracking, landmarks, lastEncounter);
  
  const now = new Date();
  const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
  
  const encounters = normalizedData.encounters.map(enc => ({
    id: enc.id,
    type: enc.type,
    date: enc.startDate,
    endDate: enc.endDate,
    provider: enc.provider,
    location: enc.location,
    reason: enc.reason,
    source: enc.source
  }));
  
  return {
    patientId,
    timeRange: timeRange || {
      start: twoYearsAgo.toISOString().split("T")[0],
      end: now.toISOString().split("T")[0]
    },
    summary,
    events,
    vitalsTracking,
    medicationAdherence,
    conditions,
    encounters,
    landmarks,
    generatedAt: new Date().toISOString()
  };
}

export async function regenerateJourneySummary(
  patientId: string,
  userId: string
): Promise<JourneySummary> {
  logPhiAccess({
    userId,
    patientId,
    action: "read",
    resourceType: "PatientJourney",
    details: "Regenerated AI journey summary"
  });
  
  const timeline = await getPatientJourneyTimeline(patientId, userId);
  return timeline.summary;
}
