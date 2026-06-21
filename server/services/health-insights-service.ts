import { logPhiAccess } from "../security/hipaa-audit";

export interface HealthInsight {
  id: string;
  patientId: string;
  type: "trend" | "alert" | "milestone" | "recommendation";
  category: "medication" | "condition" | "lab" | "allergy" | "vital" | "general";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  dataPoints?: { date: string; value: number; label?: string }[];
  relatedItems?: string[];
  actionRequired: boolean;
  createdAt: string;
}

export interface LabResult {
  id: string;
  patientId: string;
  testName: string;
  testCode: string;
  value: number;
  unit: string;
  referenceRange: { low: number; high: number };
  status: "normal" | "low" | "high" | "critical";
  collectedAt: string;
  category: string;
  source?: "patient" | "ehr" | "lab" | "wearable";
}

export interface Condition {
  id: string;
  patientId: string;
  name: string;
  code: string;
  status: "active" | "resolved" | "inactive";
  severity: "mild" | "moderate" | "severe";
  onsetDate: string;
  resolvedDate?: string;
  source?: "patient" | "ehr" | "lab" | "wearable";
}

export interface Allergy {
  id: string;
  patientId: string;
  allergen: string;
  type: "food" | "medication" | "environmental" | "other";
  severity: "mild" | "moderate" | "severe" | "life-threatening";
  reaction: string;
  recordedAt: string;
  source?: "patient" | "ehr" | "lab" | "wearable";
}

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  frequency: string;
  status: "active" | "discontinued" | "on-hold";
  startDate: string;
  endDate?: string;
  prescribedFor?: string;
  source?: "patient" | "ehr" | "lab" | "wearable";
}

export interface VitalSign {
  id: string;
  patientId: string;
  type: "blood_pressure" | "heart_rate" | "temperature" | "weight" | "blood_glucose" | "oxygen_saturation";
  value: number;
  secondaryValue?: number;
  unit: string;
  recordedAt: string;
  source?: "patient" | "ehr" | "lab" | "wearable";
}

export interface HealthSummary {
  patientId: string;
  lastUpdated: string;
  overallHealthScore: number;
  activeConditions: number;
  activeMedications: number;
  allergiesCount: number;
  recentLabsCount: number;
  pendingActions: number;
  trends: {
    conditions: "improving" | "stable" | "declining";
    medications: "increasing" | "stable" | "decreasing";
    labs: "improving" | "stable" | "concerning";
  };
}

const labResults = new Map<string, LabResult>();
const conditions = new Map<string, Condition>();
const allergies = new Map<string, Allergy>();
const medications = new Map<string, Medication>();
const vitalSigns = new Map<string, VitalSign>();
const insights = new Map<string, HealthInsight>();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export class HealthInsightsService {
  async getHealthSummary(patientId: string, userId: string): Promise<HealthSummary> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "HealthSummary",
      patientId,
      details: "Retrieved health summary dashboard",
    });

    const patientConditions = Array.from(conditions.values()).filter(c => c.patientId === patientId);
    const patientMedications = Array.from(medications.values()).filter(m => m.patientId === patientId);
    const patientAllergies = Array.from(allergies.values()).filter(a => a.patientId === patientId);
    const patientLabs = Array.from(labResults.values()).filter(l => l.patientId === patientId);
    const patientInsights = Array.from(insights.values()).filter(i => i.patientId === patientId);

    const activeConditions = patientConditions.filter(c => c.status === "active").length;
    const activeMedications = patientMedications.filter(m => m.status === "active").length;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentLabs = patientLabs.filter(l => l.collectedAt >= thirtyDaysAgo).length;
    const pendingActions = patientInsights.filter(i => i.actionRequired).length;

    const abnormalLabs = patientLabs.filter(l => l.status !== "normal").length;
    const severeConditions = patientConditions.filter(c => c.severity === "severe" && c.status === "active").length;

    let healthScore = 100;
    healthScore -= severeConditions * 15;
    healthScore -= abnormalLabs * 5;
    healthScore -= patientAllergies.filter(a => a.severity === "life-threatening").length * 10;
    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      patientId,
      lastUpdated: new Date().toISOString(),
      overallHealthScore: healthScore,
      activeConditions,
      activeMedications,
      allergiesCount: patientAllergies.length,
      recentLabsCount: recentLabs,
      pendingActions,
      trends: {
        conditions: severeConditions > 0 ? "declining" : activeConditions > 3 ? "stable" : "improving",
        medications: activeMedications > 5 ? "increasing" : "stable",
        labs: abnormalLabs > 2 ? "concerning" : "stable",
      },
    };
  }

  async getLabResults(patientId: string, userId: string, options?: { 
    category?: string; 
    startDate?: string;
    limit?: number;
  }): Promise<LabResult[]> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "LabResult",
      patientId,
      details: `Retrieved lab results${options?.category ? ` for ${options.category}` : ""}`,
    });

    let results = Array.from(labResults.values()).filter(l => l.patientId === patientId);

    if (options?.category) {
      results = results.filter(l => l.category === options.category);
    }

    if (options?.startDate) {
      results = results.filter(l => l.collectedAt >= options.startDate!);
    }

    results.sort((a, b) => new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime());

    if (options?.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async getLabTrends(patientId: string, userId: string, testCode: string, days: number = 90): Promise<{ date: string; value: number; status: string }[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const results = await this.getLabResults(patientId, userId, { startDate });

    return results
      .filter(r => r.testCode === testCode)
      .map(r => ({
        date: r.collectedAt,
        value: r.value,
        status: r.status,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async getConditions(patientId: string, userId: string, status?: string): Promise<Condition[]> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "Condition",
      patientId,
      details: `Retrieved conditions${status ? ` with status ${status}` : ""}`,
    });

    let results = Array.from(conditions.values()).filter(c => c.patientId === patientId);

    if (status) {
      results = results.filter(c => c.status === status);
    }

    return results.sort((a, b) => new Date(b.onsetDate).getTime() - new Date(a.onsetDate).getTime());
  }

  async getAllergies(patientId: string, userId: string): Promise<Allergy[]> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "Allergy",
      patientId,
      details: "Retrieved allergies list",
    });

    return Array.from(allergies.values())
      .filter(a => a.patientId === patientId)
      .sort((a, b) => {
        const severityOrder = { "life-threatening": 0, severe: 1, moderate: 2, mild: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });
  }

  async getMedications(patientId: string, userId: string, status?: string): Promise<Medication[]> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "Medication",
      patientId,
      details: `Retrieved medications${status ? ` with status ${status}` : ""}`,
    });

    let results = Array.from(medications.values()).filter(m => m.patientId === patientId);

    if (status) {
      results = results.filter(m => m.status === status);
    }

    return results.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }

  async getVitalSigns(patientId: string, userId: string, type?: string, days: number = 30): Promise<VitalSign[]> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "VitalSign",
      patientId,
      details: `Retrieved vital signs${type ? ` for ${type}` : ""}`,
    });

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    let results = Array.from(vitalSigns.values())
      .filter(v => v.patientId === patientId && v.recordedAt >= startDate);

    if (type) {
      results = results.filter(v => v.type === type);
    }

    return results.sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  }

  async getInsights(patientId: string, userId: string, options?: {
    type?: string;
    category?: string;
    severity?: string;
  }): Promise<HealthInsight[]> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "HealthInsight",
      patientId,
      details: "Retrieved health insights",
    });

    let results = Array.from(insights.values()).filter(i => i.patientId === patientId);

    if (options?.type) {
      results = results.filter(i => i.type === options.type);
    }

    if (options?.category) {
      results = results.filter(i => i.category === options.category);
    }

    if (options?.severity) {
      results = results.filter(i => i.severity === options.severity);
    }

    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async generateInsights(patientId: string, userId: string): Promise<HealthInsight[]> {
    const generatedInsights: HealthInsight[] = [];

    const patientLabs = await this.getLabResults(patientId, userId, { limit: 50 });
    const patientConditions = await this.getConditions(patientId, userId);
    const patientMedications = await this.getMedications(patientId, userId);

    const criticalLabs = patientLabs.filter(l => l.status === "critical");
    for (const lab of criticalLabs) {
      const insight: HealthInsight = {
        id: `insight-${generateId()}`,
        patientId,
        type: "alert",
        category: "lab",
        severity: "critical",
        title: `Critical ${lab.testName} Result`,
        description: `Your ${lab.testName} is ${lab.value} ${lab.unit}, which is outside the safe range (${lab.referenceRange.low}-${lab.referenceRange.high} ${lab.unit}).`,
        actionRequired: true,
        createdAt: new Date().toISOString(),
      };
      insights.set(insight.id, insight);
      generatedInsights.push(insight);
    }

    const labsByTest = new Map<string, LabResult[]>();
    for (const lab of patientLabs) {
      const existing = labsByTest.get(lab.testCode) || [];
      existing.push(lab);
      labsByTest.set(lab.testCode, existing);
    }

    for (const [_testCode, results] of Array.from(labsByTest.entries())) {
      if (results.length >= 3) {
        const sorted = results.sort((a: LabResult, b: LabResult) => new Date(a.collectedAt).getTime() - new Date(b.collectedAt).getTime());
        const recent = sorted.slice(-3);
        const trend = recent[2].value > recent[1].value && recent[1].value > recent[0].value ? "increasing" :
                     recent[2].value < recent[1].value && recent[1].value < recent[0].value ? "decreasing" : null;

        if (trend && results[0].status !== "normal") {
          const insight: HealthInsight = {
            id: `insight-${generateId()}`,
            patientId,
            type: "trend",
            category: "lab",
            severity: trend === "increasing" && results[0].status === "high" ? "warning" : "info",
            title: `${results[0].testName} Trend Detected`,
            description: `Your ${results[0].testName} levels have been ${trend} over the past readings.`,
            dataPoints: recent.map((r: LabResult) => ({ date: r.collectedAt, value: r.value })),
            actionRequired: false,
            createdAt: new Date().toISOString(),
          };
          insights.set(insight.id, insight);
          generatedInsights.push(insight);
        }
      }
    }

    const activeCount = patientMedications.filter(m => m.status === "active").length;
    if (activeCount >= 5) {
      const insight: HealthInsight = {
        id: `insight-${generateId()}`,
        patientId,
        type: "recommendation",
        category: "medication",
        severity: activeCount >= 8 ? "warning" : "info",
        title: "Multiple Active Medications",
        description: `You are currently taking ${activeCount} medications. Consider discussing your medication list with your provider to ensure optimal management.`,
        actionRequired: false,
        createdAt: new Date().toISOString(),
      };
      insights.set(insight.id, insight);
      generatedInsights.push(insight);
    }

    const activeConditions = patientConditions.filter(c => c.status === "active");
    const chronicConditions = activeConditions.filter(c => {
      const onset = new Date(c.onsetDate);
      const now = new Date();
      return (now.getTime() - onset.getTime()) > 365 * 24 * 60 * 60 * 1000;
    });

    if (chronicConditions.length > 0) {
      const insight: HealthInsight = {
        id: `insight-${generateId()}`,
        patientId,
        type: "milestone",
        category: "condition",
        severity: "info",
        title: "Managing Chronic Conditions",
        description: `You've been actively managing ${chronicConditions.length} chronic condition(s) for over a year. Keep up with your treatment plan!`,
        relatedItems: chronicConditions.map(c => c.name),
        actionRequired: false,
        createdAt: new Date().toISOString(),
      };
      insights.set(insight.id, insight);
      generatedInsights.push(insight);
    }

    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "HealthInsight",
      patientId,
      details: `Generated ${generatedInsights.length} health insights`,
    });

    return generatedInsights;
  }

  async getTimelineData(patientId: string, userId: string, days: number = 90): Promise<{
    date: string;
    events: { type: string; title: string; severity?: string }[];
  }[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    const labs = await this.getLabResults(patientId, userId, { startDate });
    const conds = await this.getConditions(patientId, userId);
    const meds = await this.getMedications(patientId, userId);

    const timelineMap = new Map<string, { type: string; title: string; severity?: string }[]>();

    for (const lab of labs) {
      const dateKey = lab.collectedAt.split("T")[0];
      const events = timelineMap.get(dateKey) || [];
      events.push({
        type: "lab",
        title: `${lab.testName}: ${lab.value} ${lab.unit}`,
        severity: lab.status === "critical" ? "critical" : lab.status === "normal" ? "normal" : "warning",
      });
      timelineMap.set(dateKey, events);
    }

    for (const cond of conds.filter(c => c.onsetDate >= startDate)) {
      const dateKey = cond.onsetDate.split("T")[0];
      const events = timelineMap.get(dateKey) || [];
      events.push({
        type: "condition",
        title: `${cond.status === "resolved" ? "Resolved" : "Diagnosed"}: ${cond.name}`,
        severity: cond.severity,
      });
      timelineMap.set(dateKey, events);
    }

    for (const med of meds.filter(m => m.startDate >= startDate)) {
      const dateKey = med.startDate.split("T")[0];
      const events = timelineMap.get(dateKey) || [];
      events.push({
        type: "medication",
        title: `Started: ${med.name} ${med.dosage}`,
      });
      timelineMap.set(dateKey, events);
    }

    return Array.from(timelineMap.entries())
      .map(([date, events]) => ({ date, events }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async initializeSampleData(patientId: string): Promise<void> {
    await logPhiAccess({
      userId: "system",
      action: "write",
      resourceType: "HealthData",
      patientId,
      details: "Initialized sample health data for samplenstration",
    });

    const now = new Date();

    const sampleMedications: Omit<Medication, "id">[] = [
      { patientId, name: "Lisinopril", dosage: "10mg", frequency: "Once daily", status: "active", startDate: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(), prescribedFor: "Hypertension", source: "ehr" },
      { patientId, name: "Metformin", dosage: "500mg", frequency: "Twice daily", status: "active", startDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(), prescribedFor: "Type 2 Diabetes", source: "ehr" },
      { patientId, name: "Atorvastatin", dosage: "20mg", frequency: "Once daily at bedtime", status: "active", startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(), prescribedFor: "High Cholesterol", source: "ehr" },
      { patientId, name: "Aspirin", dosage: "81mg", frequency: "Once daily", status: "active", startDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(), prescribedFor: "Heart Health", source: "patient" },
      { patientId, name: "Omeprazole", dosage: "20mg", frequency: "Once daily before breakfast", status: "active", startDate: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(), prescribedFor: "GERD", source: "patient" },
    ];

    for (const med of sampleMedications) {
      const id = `med-${generateId()}`;
      medications.set(id, { ...med, id });
    }

    const sampleConditions: Omit<Condition, "id">[] = [
      { patientId, name: "Type 2 Diabetes Mellitus", code: "E11.9", status: "active", severity: "moderate", onsetDate: new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000).toISOString(), source: "ehr" },
      { patientId, name: "Essential Hypertension", code: "I10", status: "active", severity: "mild", onsetDate: new Date(now.getTime() - 545 * 24 * 60 * 60 * 1000).toISOString(), source: "ehr" },
      { patientId, name: "Hyperlipidemia", code: "E78.5", status: "active", severity: "mild", onsetDate: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(), source: "ehr" },
      { patientId, name: "Seasonal Allergic Rhinitis", code: "J30.2", status: "active", severity: "mild", onsetDate: new Date(now.getTime() - 1095 * 24 * 60 * 60 * 1000).toISOString(), source: "patient" },
    ];

    for (const cond of sampleConditions) {
      const id = `cond-${generateId()}`;
      conditions.set(id, { ...cond, id });
    }

    const sampleAllergies: Omit<Allergy, "id">[] = [
      { patientId, allergen: "Penicillin", type: "medication", severity: "severe", reaction: "Hives, difficulty breathing", recordedAt: new Date(now.getTime() - 1825 * 24 * 60 * 60 * 1000).toISOString(), source: "ehr" },
      { patientId, allergen: "Shellfish", type: "food", severity: "moderate", reaction: "Swelling, itching", recordedAt: new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000).toISOString(), source: "patient" },
      { patientId, allergen: "Pollen", type: "environmental", severity: "mild", reaction: "Sneezing, runny nose", recordedAt: new Date(now.getTime() - 1095 * 24 * 60 * 60 * 1000).toISOString(), source: "patient" },
    ];

    for (const allergy of sampleAllergies) {
      const id = `allergy-${generateId()}`;
      allergies.set(id, { ...allergy, id });
    }

    const labTests = [
      { name: "Hemoglobin A1C", code: "HBA1C", unit: "%", range: { low: 4.0, high: 5.6 }, category: "Diabetes" },
      { name: "Fasting Glucose", code: "GLU", unit: "mg/dL", range: { low: 70, high: 100 }, category: "Diabetes" },
      { name: "Total Cholesterol", code: "CHOL", unit: "mg/dL", range: { low: 0, high: 200 }, category: "Lipids" },
      { name: "LDL Cholesterol", code: "LDL", unit: "mg/dL", range: { low: 0, high: 100 }, category: "Lipids" },
      { name: "HDL Cholesterol", code: "HDL", unit: "mg/dL", range: { low: 40, high: 200 }, category: "Lipids" },
      { name: "Creatinine", code: "CREAT", unit: "mg/dL", range: { low: 0.7, high: 1.3 }, category: "Kidney" },
      { name: "Blood Pressure Systolic", code: "BPS", unit: "mmHg", range: { low: 90, high: 120 }, category: "Cardiac" },
    ];

    for (let i = 0; i < 90; i += 7) {
      const labDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      
      for (const test of labTests) {
        if (Math.random() > 0.3) continue;

        let value: number;
        let status: LabResult["status"];

        if (test.code === "HBA1C") {
          value = 5.5 + Math.random() * 2.5;
        } else if (test.code === "GLU") {
          value = 90 + Math.random() * 60;
        } else if (test.code === "CHOL") {
          value = 170 + Math.random() * 80;
        } else if (test.code === "LDL") {
          value = 80 + Math.random() * 60;
        } else if (test.code === "HDL") {
          value = 35 + Math.random() * 35;
        } else if (test.code === "CREAT") {
          value = 0.8 + Math.random() * 0.6;
        } else {
          value = 115 + Math.random() * 30;
        }

        if (value < test.range.low) {
          status = value < test.range.low * 0.8 ? "critical" : "low";
        } else if (value > test.range.high) {
          status = value > test.range.high * 1.3 ? "critical" : "high";
        } else {
          status = "normal";
        }

        const id = `lab-${generateId()}`;
        labResults.set(id, {
          id,
          patientId,
          testName: test.name,
          testCode: test.code,
          value: Math.round(value * 10) / 10,
          unit: test.unit,
          referenceRange: test.range,
          status,
          collectedAt: labDate.toISOString(),
          category: test.category,
          source: test.code === "GLU" || test.code === "BPS" ? (Math.random() > 0.5 ? "patient" : "lab") : "lab",
        });
      }
    }

    for (let i = 0; i < 30; i++) {
      const vitalDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);

      vitalSigns.set(`vital-bp-${i}`, {
        id: `vital-bp-${i}`,
        patientId,
        type: "blood_pressure",
        value: 115 + Math.random() * 20,
        secondaryValue: 70 + Math.random() * 15,
        unit: "mmHg",
        recordedAt: vitalDate.toISOString(),
        source: i % 3 === 0 ? "patient" : i % 3 === 1 ? "ehr" : "wearable",
      });

      vitalSigns.set(`vital-hr-${i}`, {
        id: `vital-hr-${i}`,
        patientId,
        type: "heart_rate",
        value: Math.round(65 + Math.random() * 25),
        unit: "bpm",
        recordedAt: vitalDate.toISOString(),
        source: i % 2 === 0 ? "wearable" : "ehr",
      });

      vitalSigns.set(`vital-weight-${i}`, {
        id: `vital-weight-${i}`,
        patientId,
        type: "weight",
        value: Math.round((175 + Math.random() * 5) * 10) / 10,
        unit: "lbs",
        recordedAt: vitalDate.toISOString(),
        source: i % 2 === 0 ? "patient" : "wearable",
      });
    }
  }
}

export const healthInsightsService = new HealthInsightsService();
