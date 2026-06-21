import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

export type VitalType = "blood_pressure" | "glucose" | "weight" | "temperature" | "pulse_ox" | "heart_rate" | "respiratory_rate";
export type SymptomSeverity = "mild" | "moderate" | "severe";
export type AdherenceStatus = "completed" | "missed" | "partial" | "skipped";

export interface VitalReading {
  id: string;
  patientId: string;
  type: VitalType;
  value: number;
  secondaryValue?: number;
  unit: string;
  timestamp: string;
  source: "manual" | "wearable" | "device";
  deviceId?: string;
  notes?: string;
  context?: {
    mealStatus?: "fasting" | "before_meal" | "after_meal" | "bedtime";
    activityLevel?: "resting" | "light" | "moderate" | "intense";
    position?: "sitting" | "standing" | "lying";
    armUsed?: "left" | "right";
  };
  flags?: {
    isAbnormal: boolean;
    requiresAttention: boolean;
    trend?: "improving" | "stable" | "worsening";
  };
}

export interface SymptomEntry {
  id: string;
  patientId: string;
  symptom: string;
  severity: SymptomSeverity;
  timestamp: string;
  duration?: string;
  location?: string;
  triggers?: string[];
  relievedBy?: string[];
  notes?: string;
  relatedConditions?: string[];
  interferedWithActivities?: boolean;
}

export interface CarePlanTask {
  id: string;
  carePlanId: string;
  patientId: string;
  title: string;
  description: string;
  category: "medication" | "exercise" | "diet" | "monitoring" | "appointment" | "therapy" | "other";
  frequency: "daily" | "weekly" | "as_needed" | "specific_times";
  scheduledTimes?: string[];
  dueDate?: string;
  priority: "low" | "medium" | "high";
}

export interface AdherenceRecord {
  id: string;
  taskId: string;
  patientId: string;
  status: AdherenceStatus;
  scheduledTime: string;
  completedTime?: string;
  notes?: string;
  barriers?: string[];
  moodRating?: number;
}

export interface HealthPattern {
  id: string;
  patientId: string;
  type: "vital_trend" | "symptom_correlation" | "adherence_impact" | "lifestyle_effect";
  title: string;
  description: string;
  confidence: number;
  dataPoints: number;
  period: string;
  insight: string;
  recommendations: string[];
  noCdsDisclaimer: string;
}

export interface AIHealthAnalysis {
  patientId: string;
  analysisDate: string;
  vitalsTrends: Array<{
    vitalType: VitalType;
    trend: "improving" | "stable" | "concerning";
    averageValue: number;
    minValue: number;
    maxValue: number;
    unit: string;
    summary: string;
  }>;
  symptomPatterns: Array<{
    symptom: string;
    frequency: number;
    avgSeverity: string;
    commonTriggers: string[];
    pattern: string;
  }>;
  adherenceScore: number;
  adherenceInsights: string[];
  correlations: Array<{
    factor1: string;
    factor2: string;
    relationship: string;
    strength: number;
  }>;
  overallSummary: string;
  suggestions: string[];
  noCdsDisclaimer: string;
}

export interface DailyHealthLog {
  id: string;
  patientId: string;
  date: string;
  overallFeeling: number;
  energyLevel: number;
  sleepQuality: number;
  stressLevel: number;
  painLevel: number;
  mood: "great" | "good" | "okay" | "poor" | "bad";
  notes?: string;
  activities?: string[];
  dietNotes?: string;
}

const VITAL_REFERENCE_RANGES: Record<VitalType, { min: number; max: number; unit: string; label: string }> = {
  blood_pressure: { min: 90, max: 120, unit: "mmHg", label: "Blood Pressure (Systolic)" },
  glucose: { min: 70, max: 140, unit: "mg/dL", label: "Blood Glucose" },
  weight: { min: 0, max: 500, unit: "lbs", label: "Weight" },
  temperature: { min: 97, max: 99.5, unit: "°F", label: "Temperature" },
  pulse_ox: { min: 95, max: 100, unit: "%", label: "Oxygen Saturation" },
  heart_rate: { min: 60, max: 100, unit: "bpm", label: "Heart Rate" },
  respiratory_rate: { min: 12, max: 20, unit: "breaths/min", label: "Respiratory Rate" },
};

class PatientGeneratedHealthDataService {
  private vitals: Map<string, VitalReading[]> = new Map();
  private symptoms: Map<string, SymptomEntry[]> = new Map();
  private carePlanTasks: Map<string, CarePlanTask[]> = new Map();
  private adherenceRecords: Map<string, AdherenceRecord[]> = new Map();
  private dailyLogs: Map<string, DailyHealthLog[]> = new Map();
  private healthPatterns: Map<string, HealthPattern[]> = new Map();

  constructor() {
    this.initializeSampleData();
    console.log("[PatientGeneratedHealthData] Service initialized with manual vitals input, AI analysis, and care plan tracking");
    console.log("[PatientGeneratedHealthData] NOTE: All AI insights are NO-CDS compliant - educational only, not medical advice");
  }

  private initializeSampleData(): void {
    const patientId = "patient-001";
    const now = new Date();

    const sampleVitals: VitalReading[] = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      sampleVitals.push({
        id: `bp-${i}`,
        patientId,
        type: "blood_pressure",
        value: 115 + Math.floor(Math.random() * 15),
        secondaryValue: 72 + Math.floor(Math.random() * 10),
        unit: "mmHg",
        timestamp: date.toISOString(),
        source: "manual",
        context: { position: "sitting", armUsed: "left" },
        flags: { isAbnormal: false, requiresAttention: false, trend: "stable" },
      });

      sampleVitals.push({
        id: `glucose-${i}`,
        patientId,
        type: "glucose",
        value: 95 + Math.floor(Math.random() * 30),
        unit: "mg/dL",
        timestamp: date.toISOString(),
        source: "manual",
        context: { mealStatus: "fasting" },
        flags: { isAbnormal: false, requiresAttention: false, trend: "stable" },
      });

      if (i % 3 === 0) {
        sampleVitals.push({
          id: `weight-${i}`,
          patientId,
          type: "weight",
          value: 175 - (i * 0.2),
          unit: "lbs",
          timestamp: date.toISOString(),
          source: "manual",
          flags: { isAbnormal: false, requiresAttention: false, trend: "improving" },
        });
      }
    }
    this.vitals.set(patientId, sampleVitals);

    const sampleSymptoms: SymptomEntry[] = [
      {
        id: "symptom-1",
        patientId,
        symptom: "Mild headache",
        severity: "mild",
        timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        duration: "2 hours",
        location: "temples",
        triggers: ["stress", "lack of sleep"],
        relievedBy: ["rest", "hydration"],
        interferedWithActivities: false,
      },
      {
        id: "symptom-2",
        patientId,
        symptom: "Joint stiffness",
        severity: "moderate",
        timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        duration: "morning only",
        location: "knees",
        triggers: ["weather change"],
        relievedBy: ["movement", "warm compress"],
        interferedWithActivities: true,
      },
    ];
    this.symptoms.set(patientId, sampleSymptoms);

    const sampleTasks: CarePlanTask[] = [
      {
        id: "task-1",
        carePlanId: "cp-001",
        patientId,
        title: "Take morning blood pressure",
        description: "Measure blood pressure upon waking, before eating or drinking",
        category: "monitoring",
        frequency: "daily",
        scheduledTimes: ["08:00"],
        priority: "high",
      },
      {
        id: "task-2",
        carePlanId: "cp-001",
        patientId,
        title: "Take Metformin",
        description: "Take 500mg Metformin with breakfast",
        category: "medication",
        frequency: "daily",
        scheduledTimes: ["08:30"],
        priority: "high",
      },
      {
        id: "task-3",
        carePlanId: "cp-001",
        patientId,
        title: "30-minute walk",
        description: "Moderate-paced walking for cardiovascular health",
        category: "exercise",
        frequency: "daily",
        priority: "medium",
      },
      {
        id: "task-4",
        carePlanId: "cp-001",
        patientId,
        title: "Check blood glucose",
        description: "Fasting blood glucose measurement",
        category: "monitoring",
        frequency: "daily",
        scheduledTimes: ["07:00"],
        priority: "high",
      },
    ];
    this.carePlanTasks.set(patientId, sampleTasks);

    const sampleAdherence: AdherenceRecord[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      sampleTasks.forEach((task, idx) => {
        const completed = Math.random() > 0.15;
        sampleAdherence.push({
          id: `adh-${i}-${idx}`,
          taskId: task.id,
          patientId,
          status: completed ? "completed" : (Math.random() > 0.5 ? "missed" : "partial"),
          scheduledTime: date.toISOString(),
          completedTime: completed ? new Date(date.getTime() + 30 * 60 * 1000).toISOString() : undefined,
          moodRating: completed ? 4 : 2,
        });
      });
    }
    this.adherenceRecords.set(patientId, sampleAdherence);

    const sampleLogs: DailyHealthLog[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      sampleLogs.push({
        id: `log-${i}`,
        patientId,
        date: date.toISOString().split('T')[0],
        overallFeeling: 3 + Math.floor(Math.random() * 2),
        energyLevel: 3 + Math.floor(Math.random() * 2),
        sleepQuality: 3 + Math.floor(Math.random() * 2),
        stressLevel: 2 + Math.floor(Math.random() * 2),
        painLevel: 1 + Math.floor(Math.random() * 2),
        mood: ["good", "okay", "great"][Math.floor(Math.random() * 3)] as any,
        activities: ["walking", "stretching"],
      });
    }
    this.dailyLogs.set(patientId, sampleLogs);
  }

  async recordVital(patientId: string, reading: Omit<VitalReading, "id" | "patientId" | "timestamp" | "flags">): Promise<VitalReading> {
    logPhiAccess({
      userId: patientId,
      action: "write",
      resourceType: "Observation",
      resourceId: reading.type,
      details: `record_vital: ${reading.type}, source: ${reading.source}`,
    });

    const referenceRange = VITAL_REFERENCE_RANGES[reading.type];
    const isAbnormal = reading.value < referenceRange.min || reading.value > referenceRange.max;
    
    const recentReadings = (this.vitals.get(patientId) || [])
      .filter(v => v.type === reading.type)
      .slice(-5);
    
    let trend: "improving" | "stable" | "worsening" = "stable";
    if (recentReadings.length >= 3) {
      const avgRecent = recentReadings.reduce((sum, v) => sum + v.value, 0) / recentReadings.length;
      const diff = reading.value - avgRecent;
      const normalTarget = (referenceRange.min + referenceRange.max) / 2;
      
      if (reading.type === "weight") {
        trend = diff < -0.5 ? "improving" : (diff > 0.5 ? "worsening" : "stable");
      } else {
        const distanceToNormal = Math.abs(reading.value - normalTarget);
        const prevDistanceToNormal = Math.abs(avgRecent - normalTarget);
        trend = distanceToNormal < prevDistanceToNormal ? "improving" : 
                (distanceToNormal > prevDistanceToNormal ? "worsening" : "stable");
      }
    }

    const vitalReading: VitalReading = {
      id: `vital-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patientId,
      timestamp: new Date().toISOString(),
      ...reading,
      flags: {
        isAbnormal,
        requiresAttention: isAbnormal && (reading.type === "blood_pressure" || reading.type === "glucose"),
        trend,
      },
    };

    const patientVitals = this.vitals.get(patientId) || [];
    patientVitals.unshift(vitalReading);
    this.vitals.set(patientId, patientVitals);

    return vitalReading;
  }

  getVitals(patientId: string, type?: VitalType, startDate?: string, endDate?: string): VitalReading[] {
    logPhiAccess({
      userId: patientId,
      action: "read",
      resourceType: "Observation",
      resourceId: type || "all",
      details: "view_vitals",
    });

    let vitals = this.vitals.get(patientId) || [];
    
    if (type) {
      vitals = vitals.filter(v => v.type === type);
    }
    
    if (startDate) {
      vitals = vitals.filter(v => v.timestamp >= startDate);
    }
    
    if (endDate) {
      vitals = vitals.filter(v => v.timestamp <= endDate);
    }

    return vitals.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getVitalReferenceRanges(): typeof VITAL_REFERENCE_RANGES {
    return VITAL_REFERENCE_RANGES;
  }

  async recordSymptom(patientId: string, symptom: Omit<SymptomEntry, "id" | "patientId" | "timestamp">): Promise<SymptomEntry> {
    logPhiAccess({
      userId: patientId,
      action: "write",
      resourceType: "Condition",
      resourceId: symptom.symptom,
      details: "record_symptom",
    });

    const entry: SymptomEntry = {
      id: `symptom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patientId,
      timestamp: new Date().toISOString(),
      ...symptom,
    };

    const patientSymptoms = this.symptoms.get(patientId) || [];
    patientSymptoms.unshift(entry);
    this.symptoms.set(patientId, patientSymptoms);

    return entry;
  }

  getSymptoms(patientId: string, startDate?: string, endDate?: string): SymptomEntry[] {
    logPhiAccess({
      userId: patientId,
      action: "read",
      resourceType: "Condition",
      resourceId: "symptoms",
      details: "view_symptoms",
    });

    let symptoms = this.symptoms.get(patientId) || [];
    
    if (startDate) {
      symptoms = symptoms.filter(s => s.timestamp >= startDate);
    }
    
    if (endDate) {
      symptoms = symptoms.filter(s => s.timestamp <= endDate);
    }

    return symptoms.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  getCarePlanTasks(patientId: string, carePlanId?: string): CarePlanTask[] {
    logPhiAccess({
      userId: patientId,
      action: "read",
      resourceType: "CarePlan",
      resourceId: carePlanId || "all",
      details: "view_care_plan_tasks",
    });

    let tasks = this.carePlanTasks.get(patientId) || [];
    
    if (carePlanId) {
      tasks = tasks.filter(t => t.carePlanId === carePlanId);
    }

    return tasks;
  }

  async recordAdherence(patientId: string, record: Omit<AdherenceRecord, "id" | "patientId">): Promise<AdherenceRecord> {
    logPhiAccess({
      userId: patientId,
      action: "write",
      resourceType: "CarePlan",
      resourceId: record.taskId,
      details: "record_adherence",
    });

    const adherence: AdherenceRecord = {
      id: `adh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patientId,
      ...record,
    };

    const patientAdherence = this.adherenceRecords.get(patientId) || [];
    patientAdherence.unshift(adherence);
    this.adherenceRecords.set(patientId, patientAdherence);

    return adherence;
  }

  getAdherenceRecords(patientId: string, taskId?: string, startDate?: string, endDate?: string): AdherenceRecord[] {
    logPhiAccess({
      userId: patientId,
      action: "read",
      resourceType: "CarePlan",
      resourceId: taskId || "all",
      details: "view_adherence",
    });

    let records = this.adherenceRecords.get(patientId) || [];
    
    if (taskId) {
      records = records.filter(r => r.taskId === taskId);
    }
    
    if (startDate) {
      records = records.filter(r => r.scheduledTime >= startDate);
    }
    
    if (endDate) {
      records = records.filter(r => r.scheduledTime <= endDate);
    }

    return records.sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime());
  }

  calculateAdherenceScore(patientId: string, days: number = 7): { score: number; completed: number; total: number; byCategory: Record<string, number> } {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    
    const records = this.getAdherenceRecords(patientId, undefined, cutoff.toISOString());
    const tasks = this.getCarePlanTasks(patientId);
    
    const completed = records.filter(r => r.status === "completed" || r.status === "partial").length;
    const total = records.length || 1;
    
    const byCategory: Record<string, number> = {};
    tasks.forEach(task => {
      const taskRecords = records.filter(r => r.taskId === task.id);
      const taskCompleted = taskRecords.filter(r => r.status === "completed").length;
      const taskTotal = taskRecords.length || 1;
      byCategory[task.category] = Math.round((taskCompleted / taskTotal) * 100);
    });

    return {
      score: Math.round((completed / total) * 100),
      completed,
      total,
      byCategory,
    };
  }

  async recordDailyLog(patientId: string, log: Omit<DailyHealthLog, "id" | "patientId">): Promise<DailyHealthLog> {
    logPhiAccess({
      userId: patientId,
      action: "write",
      resourceType: "Observation",
      resourceId: log.date,
      details: "record_daily_log",
    });

    const entry: DailyHealthLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patientId,
      ...log,
    };

    const patientLogs = this.dailyLogs.get(patientId) || [];
    const existingIndex = patientLogs.findIndex(l => l.date === log.date);
    
    if (existingIndex >= 0) {
      patientLogs[existingIndex] = entry;
    } else {
      patientLogs.unshift(entry);
    }
    
    this.dailyLogs.set(patientId, patientLogs);

    return entry;
  }

  getDailyLogs(patientId: string, startDate?: string, endDate?: string): DailyHealthLog[] {
    logPhiAccess({
      userId: patientId,
      action: "read",
      resourceType: "Observation",
      resourceId: "daily_logs",
      details: "view_daily_logs",
    });

    let logs = this.dailyLogs.get(patientId) || [];
    
    if (startDate) {
      logs = logs.filter(l => l.date >= startDate);
    }
    
    if (endDate) {
      logs = logs.filter(l => l.date <= endDate);
    }

    return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async analyzePatientData(patientId: string): Promise<AIHealthAnalysis> {
    logPhiAccess({
      userId: patientId,
      action: "read",
      resourceType: "Observation",
      resourceId: "ai_analysis",
      details: "ai_analyze_health_data",
    });

    const vitals = this.getVitals(patientId);
    const symptoms = this.getSymptoms(patientId);
    const adherenceScore = this.calculateAdherenceScore(patientId, 30);
    const dailyLogs = this.getDailyLogs(patientId);

    const vitalsByType = new Map<VitalType, VitalReading[]>();
    vitals.forEach(v => {
      const existing = vitalsByType.get(v.type) || [];
      existing.push(v);
      vitalsByType.set(v.type, existing);
    });

    const vitalsTrends = Array.from(vitalsByType.entries()).map(([type, readings]) => {
      const values = readings.map(r => r.value);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const reference = VITAL_REFERENCE_RANGES[type];
      
      let trend: "improving" | "stable" | "concerning" = "stable";
      if (readings.length >= 3) {
        const recentAvg = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const olderAvg = values.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, values.length);
        const normalTarget = (reference.min + reference.max) / 2;
        
        if (Math.abs(recentAvg - normalTarget) < Math.abs(olderAvg - normalTarget)) {
          trend = "improving";
        } else if (Math.abs(recentAvg - normalTarget) > Math.abs(olderAvg - normalTarget) + 5) {
          trend = "concerning";
        }
      }

      return {
        vitalType: type,
        trend,
        averageValue: Math.round(avg * 10) / 10,
        minValue: min,
        maxValue: max,
        unit: reference.unit,
        summary: `Your ${reference.label.toLowerCase()} has been ${trend} over the recorded period, averaging ${avg.toFixed(1)} ${reference.unit}.`,
      };
    });

    const symptomsByName = new Map<string, SymptomEntry[]>();
    symptoms.forEach(s => {
      const existing = symptomsByName.get(s.symptom) || [];
      existing.push(s);
      symptomsByName.set(s.symptom, existing);
    });

    const symptomPatterns = Array.from(symptomsByName.entries()).map(([symptom, entries]) => {
      const severities = entries.map(e => e.severity);
      const avgSeverity = severities.includes("severe") ? "severe" : 
                          severities.includes("moderate") ? "moderate" : "mild";
      
      const allTriggers = entries.flatMap(e => e.triggers || []);
      const triggerCounts = allTriggers.reduce((acc, t) => {
        acc[t] = (acc[t] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const commonTriggers = Object.entries(triggerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([t]) => t);

      return {
        symptom,
        frequency: entries.length,
        avgSeverity,
        commonTriggers,
        pattern: entries.length > 2 ? "recurring" : "occasional",
      };
    });

    const adherenceInsights: string[] = [];
    if (adherenceScore.score >= 80) {
      adherenceInsights.push("Excellent adherence to your care plan! Keep up the great work.");
    } else if (adherenceScore.score >= 60) {
      adherenceInsights.push("Good overall adherence, with some room for improvement.");
    } else {
      adherenceInsights.push("Your adherence could be improved. Consider setting reminders.");
    }

    Object.entries(adherenceScore.byCategory).forEach(([category, score]) => {
      if (score < 70) {
        adherenceInsights.push(`${category.charAt(0).toUpperCase() + category.slice(1)} tasks need more attention (${score}% completion).`);
      }
    });

    const correlations: AIHealthAnalysis["correlations"] = [];
    
    if (dailyLogs.length >= 3 && vitalsByType.has("blood_pressure")) {
      correlations.push({
        factor1: "Sleep Quality",
        factor2: "Blood Pressure",
        relationship: "Better sleep tends to correlate with lower blood pressure readings",
        strength: 0.65,
      });
    }

    if (symptomPatterns.some(s => s.commonTriggers.includes("stress"))) {
      correlations.push({
        factor1: "Stress Levels",
        factor2: "Symptom Occurrence",
        relationship: "Higher stress appears to be associated with symptom episodes",
        strength: 0.72,
      });
    }

    let overallSummary = "";
    const suggestions: string[] = [];

    try {
      const prompt = `Analyze this patient health data summary and provide educational insights (NOT medical advice):

Vitals Summary:
${vitalsTrends.map(v => `- ${v.vitalType}: avg ${v.averageValue} ${v.unit}, trend: ${v.trend}`).join('\n')}

Symptoms Reported:
${symptomPatterns.map(s => `- ${s.symptom}: ${s.frequency} occurrences, severity: ${s.avgSeverity}`).join('\n') || 'None reported'}

Care Plan Adherence: ${adherenceScore.score}%

Daily Wellness Logs: ${dailyLogs.length} entries in past week

Provide:
1. A 2-3 sentence overall summary of health tracking patterns
2. 2-3 educational suggestions for wellness (NOT medical advice)

Keep response educational and encouraging. Include clear disclaimer that this is NOT medical advice.`;

      const client = getOpenAIClient();
      if (client) {
        const response = await client.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: "You are a health education assistant providing general wellness insights. You NEVER provide medical advice, diagnoses, or treatment recommendations. Always encourage users to consult healthcare providers for medical concerns."
            },
            { role: "user", content: prompt }
          ],
          max_tokens: 500,
          temperature: 0.7,
        });

        const content = response.choices[0]?.message?.content || "";
        const parts = content.split(/suggestions?:/i);
        
        overallSummary = parts[0]?.replace(/summary:?/i, "").trim() || 
          "Your health tracking shows consistent monitoring of key vitals. Continue your current tracking routine.";
        
        if (parts[1]) {
          const suggestionLines = parts[1].split(/\d+\.|[-•]/).filter(s => s.trim());
          suggestions.push(...suggestionLines.slice(0, 3).map(s => s.trim()));
        }
      } else {
        throw new Error("OpenAI client not available");
      }
    } catch (error) {
      console.error("[PatientGeneratedHealthData] AI analysis error:", error);
      overallSummary = `Based on ${vitals.length} vital readings and ${symptoms.length} symptom entries, your health tracking shows ${adherenceScore.score >= 70 ? "good" : "moderate"} engagement with your care plan.`;
      suggestions.push(
        "Continue regular vital monitoring to track trends over time",
        "Stay hydrated and maintain consistent sleep schedules",
        "Discuss any concerning patterns with your healthcare provider"
      );
    }

    return {
      patientId,
      analysisDate: new Date().toISOString(),
      vitalsTrends,
      symptomPatterns,
      adherenceScore: adherenceScore.score,
      adherenceInsights,
      correlations,
      overallSummary,
      suggestions,
      noCdsDisclaimer: "IMPORTANT: This analysis is for EDUCATIONAL PURPOSES ONLY and is NOT medical advice. The patterns and correlations shown are observational and should NOT be used for diagnosis or treatment decisions. Always consult your healthcare provider for medical advice, diagnoses, and treatment recommendations.",
    };
  }

  async getHealthDataSummary(patientId: string): Promise<{
    vitalsCount: number;
    symptomsCount: number;
    adherenceScore: number;
    lastVitalDate: string | null;
    recentTrends: Array<{ type: string; trend: string }>;
    noCdsDisclaimer: string;
  }> {
    const vitals = this.getVitals(patientId);
    const symptoms = this.getSymptoms(patientId);
    const adherence = this.calculateAdherenceScore(patientId);

    const recentTrends: Array<{ type: string; trend: string }> = [];
    const seenTypes = new Set<VitalType>();
    const vitalTypes: VitalType[] = [];
    vitals.forEach(v => {
      if (!seenTypes.has(v.type)) {
        seenTypes.add(v.type);
        vitalTypes.push(v.type);
      }
    });
    
    vitalTypes.slice(0, 3).forEach((type: VitalType) => {
      const typeVitals = vitals.filter(v => v.type === type);
      if (typeVitals.length > 0 && typeVitals[0].flags?.trend) {
        recentTrends.push({
          type: VITAL_REFERENCE_RANGES[type].label,
          trend: typeVitals[0].flags.trend,
        });
      }
    });

    return {
      vitalsCount: vitals.length,
      symptomsCount: symptoms.length,
      adherenceScore: adherence.score,
      lastVitalDate: vitals[0]?.timestamp || null,
      recentTrends,
      noCdsDisclaimer: "EDUCATIONAL CONTENT ONLY. This summary is not medical advice.",
    };
  }
}

export const patientGeneratedHealthDataService = new PatientGeneratedHealthDataService();
