import * as crypto from "crypto";

const DISCLAIMER = "DISCLAIMER: This analysis is for informational and educational purposes only. It does not constitute medical advice, diagnosis, or treatment. Always consult with a qualified healthcare provider before making any medical decisions.";

// ============================================
// Interfaces
// ============================================

export interface TreatmentRecord {
  id: string;
  patientId: string;
  treatmentType: string;
  medicationName: string;
  dosage: string;
  startDate: string;
  endDate: string | null;
  condition: string;
  targetMetric: string;
  baselineValue: number;
  currentValue: number;
  targetValue: number;
  sideEffects: string[];
  adherenceRate: number;
}

export interface EfficacyDataPoint {
  date: string;
  metricValue: number;
  expectedValue: number;
  confidenceInterval: { upper: number; lower: number };
  milestone: string | null;
  note: string | null;
}

export interface TreatmentTimeline {
  treatmentId: string;
  patientId: string;
  condition: string;
  treatmentName: string;
  dataPoints: EfficacyDataPoint[];
  overallEfficacy: number;
  predictedOutcome: string;
  timeToEffect: number;
  recommendation: string;
}

export interface PredictionModel {
  modelType: "linear_regression" | "exponential_decay" | "sigmoid_response" | "plateau";
  parameters: Record<string, number>;
  confidence: number;
  trainingDataSize: number;
}

export interface TreatmentComparison {
  treatments: Array<{
    name: string;
    efficacyScore: number;
    timeToResponse: number;
    sideEffectRate: number;
    adherenceRate: number;
    costEffectiveness: number;
  }>;
}

export interface EfficacyChartData {
  chartType: string;
  labels: string[];
  datasets: {
    actual: number[];
    predicted: number[];
    confidenceBands: { upper: number[]; lower: number[] };
    milestones: Array<{ label: string; index: number; value: number }>;
  };
  annotations: Array<{ type: string; label: string; value: number; position: number }>;
}

// ============================================
// Demo Data & Constants
// ============================================

interface DemoTreatmentConfig {
  treatmentType: string;
  medicationName: string;
  dosage: string;
  condition: string;
  targetMetric: string;
  baselineValue: number;
  targetValue: number;
  timeToEffectWeeks: number;
  modelType: PredictionModel["modelType"];
  sideEffects: string[];
  populationEfficacy: number;
  costPerMonth: number;
}

const DEMO_TREATMENTS: DemoTreatmentConfig[] = [
  {
    treatmentType: "ACE_inhibitor",
    medicationName: "Lisinopril",
    dosage: "10mg daily",
    condition: "Hypertension",
    targetMetric: "Systolic BP (mmHg)",
    baselineValue: 155,
    targetValue: 130,
    timeToEffectWeeks: 6,
    modelType: "exponential_decay",
    sideEffects: ["Dry cough", "Dizziness", "Headache", "Fatigue"],
    populationEfficacy: 72,
    costPerMonth: 15,
  },
  {
    treatmentType: "Biguanide",
    medicationName: "Metformin",
    dosage: "500mg twice daily",
    condition: "Type 2 Diabetes",
    targetMetric: "HbA1c (%)",
    baselineValue: 8.5,
    targetValue: 7.0,
    timeToEffectWeeks: 12,
    modelType: "sigmoid_response",
    sideEffects: ["Nausea", "Diarrhea", "Stomach pain", "Loss of appetite"],
    populationEfficacy: 68,
    costPerMonth: 10,
  },
  {
    treatmentType: "Statin",
    medicationName: "Atorvastatin",
    dosage: "20mg daily",
    condition: "Hyperlipidemia",
    targetMetric: "LDL (mg/dL)",
    baselineValue: 160,
    targetValue: 100,
    timeToEffectWeeks: 8,
    modelType: "exponential_decay",
    sideEffects: ["Muscle pain", "Joint pain", "Nausea", "Headache"],
    populationEfficacy: 78,
    costPerMonth: 20,
  },
  {
    treatmentType: "SSRI",
    medicationName: "Sertraline",
    dosage: "50mg daily",
    condition: "Depression",
    targetMetric: "PHQ-9 Score",
    baselineValue: 18,
    targetValue: 5,
    timeToEffectWeeks: 8,
    modelType: "sigmoid_response",
    sideEffects: ["Nausea", "Insomnia", "Drowsiness", "Sexual dysfunction", "Weight changes"],
    populationEfficacy: 62,
    costPerMonth: 12,
  },
  {
    treatmentType: "Thyroid_hormone",
    medicationName: "Levothyroxine",
    dosage: "50mcg daily",
    condition: "Hypothyroidism",
    targetMetric: "TSH (mIU/L)",
    baselineValue: 8.0,
    targetValue: 2.5,
    timeToEffectWeeks: 6,
    modelType: "exponential_decay",
    sideEffects: ["Heart palpitations", "Insomnia", "Weight loss", "Tremors"],
    populationEfficacy: 85,
    costPerMonth: 8,
  },
];

// ============================================
// Mathematical Prediction Functions
// ============================================

function gaussianNoise(stddev: number): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return stddev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function linearModel(baseline: number, target: number, t: number, timeToEffect: number): number {
  const progress = Math.min(t / timeToEffect, 1.0);
  return baseline + (target - baseline) * progress;
}

function exponentialDecayModel(baseline: number, target: number, t: number, timeToEffect: number): number {
  const k = 3.0 / timeToEffect;
  return target + (baseline - target) * Math.exp(-k * t);
}

function sigmoidModel(baseline: number, target: number, t: number, timeToEffect: number): number {
  const midpoint = timeToEffect * 0.5;
  const k = 6.0 / timeToEffect;
  return target + (baseline - target) / (1 + Math.exp(k * (t - midpoint)));
}

function plateauModel(baseline: number, target: number, t: number, timeToEffect: number): number {
  if (t >= timeToEffect) return target;
  const progress = t / timeToEffect;
  const plateauProgress = 1 - Math.pow(1 - progress, 2);
  return baseline + (target - baseline) * plateauProgress;
}

function applyModel(
  modelType: PredictionModel["modelType"],
  baseline: number,
  target: number,
  t: number,
  timeToEffect: number
): number {
  switch (modelType) {
    case "linear_regression":
      return linearModel(baseline, target, t, timeToEffect);
    case "exponential_decay":
      return exponentialDecayModel(baseline, target, t, timeToEffect);
    case "sigmoid_response":
      return sigmoidModel(baseline, target, t, timeToEffect);
    case "plateau":
      return plateauModel(baseline, target, t, timeToEffect);
    default:
      return linearModel(baseline, target, t, timeToEffect);
  }
}

// ============================================
// TreatmentEfficacyService
// ============================================

export class TreatmentEfficacyService {
  private treatments: Map<string, TreatmentRecord> = new Map();
  private patientTreatments: Map<string, string[]> = new Map();
  private initialized = false;
  private queriesProcessed = 0;
  private predictionsGenerated = 0;

  constructor() {
    console.log("[TreatmentEfficacy] Service instance created");
  }

  initialize(): void {
    if (this.initialized) {
      console.log("[TreatmentEfficacy] Already initialized, skipping");
      return;
    }
    console.log("[TreatmentEfficacy] Initializing with demo treatment data...");
    this.seedDemoData();
    this.initialized = true;
    console.log(`[TreatmentEfficacy] Initialized with ${this.treatments.size} treatment records`);
  }

  private seedDemoData(): void {
    const demoPatients = ["patient-001", "patient-002", "patient-003", "patient-004", "patient-005"];

    for (const config of DEMO_TREATMENTS) {
      for (let i = 0; i < demoPatients.length; i++) {
        const patientId = demoPatients[i];
        const treatmentId = crypto.randomUUID();
        const weeksAgo = config.timeToEffectWeeks + Math.floor(Math.random() * 4) + 2;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - weeksAgo * 7);

        const progressWeeks = weeksAgo;
        const progressDays = progressWeeks * 7;
        const timeToEffectDays = config.timeToEffectWeeks * 7;
        const varianceFactor = 0.8 + Math.random() * 0.4;
        const adjustedBaseline = config.baselineValue * (0.9 + Math.random() * 0.2);
        const adjustedTarget = config.targetValue * varianceFactor;
        const currentExpected = applyModel(config.modelType, adjustedBaseline, adjustedTarget, progressDays, timeToEffectDays);
        const currentValue = currentExpected + gaussianNoise(Math.abs(config.baselineValue - config.targetValue) * 0.05);

        const treatment: TreatmentRecord = {
          id: treatmentId,
          patientId,
          treatmentType: config.treatmentType,
          medicationName: config.medicationName,
          dosage: config.dosage,
          startDate: startDate.toISOString(),
          endDate: null,
          condition: config.condition,
          targetMetric: config.targetMetric,
          baselineValue: Math.round(adjustedBaseline * 100) / 100,
          currentValue: Math.round(currentValue * 100) / 100,
          targetValue: Math.round(adjustedTarget * 100) / 100,
          sideEffects: config.sideEffects.filter(() => Math.random() > 0.5),
          adherenceRate: Math.round((75 + Math.random() * 25) * 10) / 10,
        };

        this.treatments.set(treatmentId, treatment);
        const existing = this.patientTreatments.get(patientId) || [];
        existing.push(treatmentId);
        this.patientTreatments.set(patientId, existing);
      }
    }

    console.log(`[TreatmentEfficacy] Seeded ${this.treatments.size} treatment records across ${demoPatients.length} patients`);
  }

  private getTreatmentConfig(treatmentType: string): DemoTreatmentConfig | undefined {
    return DEMO_TREATMENTS.find((t) => t.treatmentType === treatmentType);
  }

  private getTreatment(treatmentId: string): TreatmentRecord | undefined {
    return this.treatments.get(treatmentId);
  }

  private getPatientTreatmentIds(patientId: string): string[] {
    return this.patientTreatments.get(patientId) || [];
  }

  private buildPredictionModel(treatment: TreatmentRecord): PredictionModel {
    const config = this.getTreatmentConfig(treatment.treatmentType);
    const modelType = config?.modelType || "linear_regression";
    const timeToEffectDays = (config?.timeToEffectWeeks || 8) * 7;

    const parameters: Record<string, number> = {
      baseline: treatment.baselineValue,
      target: treatment.targetValue,
      timeToEffect: timeToEffectDays,
    };

    if (modelType === "exponential_decay") {
      parameters.k = 3.0 / timeToEffectDays;
    } else if (modelType === "sigmoid_response") {
      parameters.midpoint = timeToEffectDays * 0.5;
      parameters.k = 6.0 / timeToEffectDays;
    }

    return {
      modelType,
      parameters,
      confidence: 75 + Math.random() * 20,
      trainingDataSize: 500 + Math.floor(Math.random() * 1500),
    };
  }

  private generateDataPoints(
    treatment: TreatmentRecord,
    model: PredictionModel,
    days: number
  ): EfficacyDataPoint[] {
    const config = this.getTreatmentConfig(treatment.treatmentType);
    const timeToEffectDays = (config?.timeToEffectWeeks || 8) * 7;
    const startDate = new Date(treatment.startDate);
    const range = Math.abs(treatment.baselineValue - treatment.targetValue);
    const noiseStd = range * 0.06;
    const points: EfficacyDataPoint[] = [];

    for (let d = 0; d <= days; d += 7) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + d);

      const expectedValue = applyModel(
        model.modelType,
        treatment.baselineValue,
        treatment.targetValue,
        d,
        timeToEffectDays
      );
      const metricValue = expectedValue + gaussianNoise(noiseStd);
      const ciWidth = range * 0.1 * (1 + d / timeToEffectDays * 0.5);

      let milestone: string | null = null;
      const improvement = Math.abs(metricValue - treatment.baselineValue) / range;
      if (Math.abs(improvement - 0.25) < 0.05) milestone = "25% improvement";
      else if (Math.abs(improvement - 0.5) < 0.05) milestone = "50% improvement";
      else if (Math.abs(improvement - 0.75) < 0.05) milestone = "75% improvement";
      else if (improvement >= 0.95) milestone = "Target reached";

      let note: string | null = null;
      if (d === 0) note = "Treatment started";
      if (milestone === "Target reached") note = "Target metric achieved - continue monitoring";

      points.push({
        date: date.toISOString().split("T")[0],
        metricValue: Math.round(metricValue * 100) / 100,
        expectedValue: Math.round(expectedValue * 100) / 100,
        confidenceInterval: {
          upper: Math.round((expectedValue + ciWidth) * 100) / 100,
          lower: Math.round((expectedValue - ciWidth) * 100) / 100,
        },
        milestone,
        note,
      });
    }

    return points;
  }

  analyzeTreatmentEfficacy(patientId: string, treatmentId: string): {
    treatment: TreatmentRecord;
    timeline: TreatmentTimeline;
    model: PredictionModel;
    disclaimer: string;
  } | null {
    this.queriesProcessed++;
    console.log(`[TreatmentEfficacy] Analyzing efficacy for patient=${patientId}, treatment=${treatmentId}`);

    const treatment = this.getTreatment(treatmentId);
    if (!treatment || treatment.patientId !== patientId) {
      console.log(`[TreatmentEfficacy] Treatment not found or patient mismatch`);
      return null;
    }

    const model = this.buildPredictionModel(treatment);
    const startDate = new Date(treatment.startDate);
    const now = new Date();
    const elapsedDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const dataPoints = this.generateDataPoints(treatment, model, elapsedDays);

    const range = Math.abs(treatment.baselineValue - treatment.targetValue);
    const improvement = Math.abs(treatment.currentValue - treatment.baselineValue);
    const efficacy = Math.min(Math.round((improvement / range) * 100), 100);

    const config = this.getTreatmentConfig(treatment.treatmentType);
    const timeToEffectDays = (config?.timeToEffectWeeks || 8) * 7;

    let predictedOutcome: string;
    if (efficacy >= 90) predictedOutcome = "Excellent response - target likely achieved";
    else if (efficacy >= 70) predictedOutcome = "Good response - on track to reach target";
    else if (efficacy >= 40) predictedOutcome = "Moderate response - may need adjustment";
    else predictedOutcome = "Limited response - consider alternative treatment";

    let recommendation: string;
    if (efficacy >= 80) recommendation = "Continue current treatment and monitor";
    else if (efficacy >= 50) recommendation = "Consider dosage adjustment or combination therapy";
    else recommendation = "Discuss alternative treatments with healthcare provider";

    const timeline: TreatmentTimeline = {
      treatmentId,
      patientId,
      condition: treatment.condition,
      treatmentName: `${treatment.medicationName} (${treatment.dosage})`,
      dataPoints,
      overallEfficacy: efficacy,
      predictedOutcome,
      timeToEffect: timeToEffectDays,
      recommendation,
    };

    return { treatment, timeline, model, disclaimer: DISCLAIMER };
  }

  getEfficacyTimeline(patientId: string, treatmentId: string): TreatmentTimeline | null {
    this.queriesProcessed++;
    console.log(`[TreatmentEfficacy] Getting timeline for patient=${patientId}, treatment=${treatmentId}`);

    const result = this.analyzeTreatmentEfficacy(patientId, treatmentId);
    if (!result) return null;
    return result.timeline;
  }

  predictOutcome(
    patientId: string,
    treatmentId: string,
    futureDays: number = 30
  ): {
    currentStatus: { value: number; daysSinceStart: number };
    predictions: EfficacyDataPoint[];
    model: PredictionModel;
    confidence: number;
    disclaimer: string;
  } | null {
    this.queriesProcessed++;
    this.predictionsGenerated++;
    console.log(`[TreatmentEfficacy] Predicting outcome for patient=${patientId}, treatment=${treatmentId}, futureDays=${futureDays}`);

    const treatment = this.getTreatment(treatmentId);
    if (!treatment || treatment.patientId !== patientId) return null;

    const model = this.buildPredictionModel(treatment);
    const config = this.getTreatmentConfig(treatment.treatmentType);
    const timeToEffectDays = (config?.timeToEffectWeeks || 8) * 7;
    const startDate = new Date(treatment.startDate);
    const now = new Date();
    const elapsedDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const range = Math.abs(treatment.baselineValue - treatment.targetValue);
    const noiseStd = range * 0.06;
    const predictions: EfficacyDataPoint[] = [];

    for (let d = 0; d <= futureDays; d += 7) {
      const futureDay = elapsedDays + d;
      const date = new Date(now);
      date.setDate(date.getDate() + d);

      const expectedValue = applyModel(
        model.modelType,
        treatment.baselineValue,
        treatment.targetValue,
        futureDay,
        timeToEffectDays
      );
      const metricValue = expectedValue + gaussianNoise(noiseStd * (1 + d / futureDays * 0.5));
      const ciWidth = range * 0.1 * (1 + futureDay / timeToEffectDays * 0.8);

      const improvement = Math.abs(expectedValue - treatment.baselineValue) / range;
      let milestone: string | null = null;
      if (Math.abs(improvement - 0.5) < 0.06) milestone = "Predicted 50% improvement";
      else if (Math.abs(improvement - 0.75) < 0.06) milestone = "Predicted 75% improvement";
      else if (improvement >= 0.95) milestone = "Predicted target achievement";

      predictions.push({
        date: date.toISOString().split("T")[0],
        metricValue: Math.round(metricValue * 100) / 100,
        expectedValue: Math.round(expectedValue * 100) / 100,
        confidenceInterval: {
          upper: Math.round((expectedValue + ciWidth) * 100) / 100,
          lower: Math.round((expectedValue - ciWidth) * 100) / 100,
        },
        milestone,
        note: d === 0 ? "Prediction start" : null,
      });
    }

    return {
      currentStatus: {
        value: treatment.currentValue,
        daysSinceStart: elapsedDays,
      },
      predictions,
      model,
      confidence: Math.round(model.confidence * 10) / 10,
      disclaimer: DISCLAIMER,
    };
  }

  compareTreatments(patientId: string, treatmentIds: string[]): TreatmentComparison & { disclaimer: string } | null {
    this.queriesProcessed++;
    console.log(`[TreatmentEfficacy] Comparing treatments for patient=${patientId}, count=${treatmentIds.length}`);

    const comparisons: TreatmentComparison["treatments"] = [];

    for (const tid of treatmentIds) {
      const treatment = this.getTreatment(tid);
      if (!treatment || treatment.patientId !== patientId) continue;

      const config = this.getTreatmentConfig(treatment.treatmentType);
      const range = Math.abs(treatment.baselineValue - treatment.targetValue);
      const improvement = Math.abs(treatment.currentValue - treatment.baselineValue);
      const efficacyScore = Math.min(Math.round((improvement / range) * 100), 100);

      comparisons.push({
        name: `${treatment.medicationName} (${treatment.dosage})`,
        efficacyScore,
        timeToResponse: (config?.timeToEffectWeeks || 8) * 7,
        sideEffectRate: Math.round((treatment.sideEffects.length / (config?.sideEffects.length || 4)) * 100),
        adherenceRate: treatment.adherenceRate,
        costEffectiveness: config
          ? Math.round((efficacyScore / (config.costPerMonth || 1)) * 10) / 10
          : 0,
      });
    }

    if (comparisons.length === 0) return null;

    return { treatments: comparisons, disclaimer: DISCLAIMER };
  }

  getConditionTreatments(condition: string): {
    condition: string;
    treatments: Array<{
      treatmentType: string;
      medicationName: string;
      dosage: string;
      populationEfficacy: number;
      timeToEffectWeeks: number;
      commonSideEffects: string[];
      costPerMonth: number;
    }>;
    disclaimer: string;
  } {
    this.queriesProcessed++;
    console.log(`[TreatmentEfficacy] Getting treatments for condition=${condition}`);

    const matching = DEMO_TREATMENTS.filter(
      (t) => t.condition.toLowerCase() === condition.toLowerCase()
    );

    return {
      condition,
      treatments: matching.map((t) => ({
        treatmentType: t.treatmentType,
        medicationName: t.medicationName,
        dosage: t.dosage,
        populationEfficacy: t.populationEfficacy,
        timeToEffectWeeks: t.timeToEffectWeeks,
        commonSideEffects: t.sideEffects,
        costPerMonth: t.costPerMonth,
      })),
      disclaimer: DISCLAIMER,
    };
  }

  getTreatmentResponseCurve(
    treatmentType: string,
    condition: string
  ): {
    treatmentType: string;
    condition: string;
    modelType: PredictionModel["modelType"];
    curve: Array<{ week: number; expectedResponse: number; confidenceLower: number; confidenceUpper: number }>;
    disclaimer: string;
  } | null {
    this.queriesProcessed++;
    console.log(`[TreatmentEfficacy] Getting response curve for type=${treatmentType}, condition=${condition}`);

    const config = DEMO_TREATMENTS.find(
      (t) => t.treatmentType === treatmentType && t.condition.toLowerCase() === condition.toLowerCase()
    );
    if (!config) return null;

    const timeToEffectDays = config.timeToEffectWeeks * 7;
    const totalWeeks = config.timeToEffectWeeks + 4;
    const range = Math.abs(config.baselineValue - config.targetValue);
    const curve: Array<{ week: number; expectedResponse: number; confidenceLower: number; confidenceUpper: number }> = [];

    for (let w = 0; w <= totalWeeks; w++) {
      const d = w * 7;
      const expected = applyModel(config.modelType, config.baselineValue, config.targetValue, d, timeToEffectDays);
      const ciWidth = range * 0.08 * (1 + w / totalWeeks * 0.5);

      curve.push({
        week: w,
        expectedResponse: Math.round(expected * 100) / 100,
        confidenceLower: Math.round((expected - ciWidth) * 100) / 100,
        confidenceUpper: Math.round((expected + ciWidth) * 100) / 100,
      });
    }

    return {
      treatmentType,
      condition,
      modelType: config.modelType,
      curve,
      disclaimer: DISCLAIMER,
    };
  }

  identifyNonResponders(treatmentType: string): {
    treatmentType: string;
    nonResponders: Array<{
      patientId: string;
      treatmentId: string;
      currentValue: number;
      expectedValue: number;
      deviationPercent: number;
      recommendation: string;
    }>;
    totalPatients: number;
    nonResponderRate: number;
    disclaimer: string;
  } {
    this.queriesProcessed++;
    console.log(`[TreatmentEfficacy] Identifying non-responders for type=${treatmentType}`);

    const config = this.getTreatmentConfig(treatmentType);
    const timeToEffectDays = (config?.timeToEffectWeeks || 8) * 7;
    const nonResponders: Array<{
      patientId: string;
      treatmentId: string;
      currentValue: number;
      expectedValue: number;
      deviationPercent: number;
      recommendation: string;
    }> = [];
    let totalPatients = 0;

    const entries = Array.from(this.treatments.entries());
    for (const [treatmentId, treatment] of entries) {
      if (treatment.treatmentType !== treatmentType) continue;
      totalPatients++;

      const startDate = new Date(treatment.startDate);
      const now = new Date();
      const elapsedDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      if (elapsedDays < 14) continue;

      const modelType = config?.modelType || "linear_regression";
      const expectedValue = applyModel(modelType, treatment.baselineValue, treatment.targetValue, elapsedDays, timeToEffectDays);
      const range = Math.abs(treatment.baselineValue - treatment.targetValue);
      const expectedImprovement = Math.abs(expectedValue - treatment.baselineValue);
      const actualImprovement = Math.abs(treatment.currentValue - treatment.baselineValue);
      const deviationPercent = expectedImprovement > 0
        ? Math.round(((expectedImprovement - actualImprovement) / expectedImprovement) * 100)
        : 0;

      if (deviationPercent > 30) {
        let recommendation: string;
        if (deviationPercent > 60) recommendation = "Consider switching to alternative treatment";
        else if (deviationPercent > 45) recommendation = "Consider dosage increase or combination therapy";
        else recommendation = "Monitor closely; may need adjustment in 2-4 weeks";

        nonResponders.push({
          patientId: treatment.patientId,
          treatmentId,
          currentValue: treatment.currentValue,
          expectedValue: Math.round(expectedValue * 100) / 100,
          deviationPercent,
          recommendation,
        });
      }
    }

    return {
      treatmentType,
      nonResponders,
      totalPatients,
      nonResponderRate: totalPatients > 0 ? Math.round((nonResponders.length / totalPatients) * 100) : 0,
      disclaimer: DISCLAIMER,
    };
  }

  getOptimalDosage(patientId: string, treatmentId: string): {
    currentDosage: string;
    suggestedAction: string;
    reasoning: string;
    responseRate: number;
    disclaimer: string;
  } | null {
    this.queriesProcessed++;
    console.log(`[TreatmentEfficacy] Getting optimal dosage for patient=${patientId}, treatment=${treatmentId}`);

    const treatment = this.getTreatment(treatmentId);
    if (!treatment || treatment.patientId !== patientId) return null;

    const config = this.getTreatmentConfig(treatment.treatmentType);
    const timeToEffectDays = (config?.timeToEffectWeeks || 8) * 7;
    const startDate = new Date(treatment.startDate);
    const now = new Date();
    const elapsedDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    const modelType = config?.modelType || "linear_regression";
    const expectedValue = applyModel(modelType, treatment.baselineValue, treatment.targetValue, elapsedDays, timeToEffectDays);
    const range = Math.abs(treatment.baselineValue - treatment.targetValue);
    const expectedImprovement = Math.abs(expectedValue - treatment.baselineValue);
    const actualImprovement = Math.abs(treatment.currentValue - treatment.baselineValue);
    const responseRate = expectedImprovement > 0 ? Math.round((actualImprovement / expectedImprovement) * 100) : 0;

    let suggestedAction: string;
    let reasoning: string;

    if (responseRate >= 90) {
      suggestedAction = "Maintain current dosage";
      reasoning = `Patient is responding well (${responseRate}% of expected improvement). Current ${treatment.dosage} is effective.`;
    } else if (responseRate >= 60) {
      suggestedAction = "Consider slight dosage increase";
      reasoning = `Response is moderate (${responseRate}% of expected). A gradual dosage increase may improve outcomes while monitoring side effects.`;
    } else if (responseRate >= 30) {
      suggestedAction = "Recommend dosage adjustment or combination therapy";
      reasoning = `Below-expected response (${responseRate}%). Consider increasing dosage or adding complementary medication after consulting provider.`;
    } else {
      suggestedAction = "Discuss alternative treatment options";
      reasoning = `Limited response (${responseRate}%). Current treatment may not be optimal. Alternative medications or therapeutic approaches should be discussed.`;
    }

    return {
      currentDosage: treatment.dosage,
      suggestedAction,
      reasoning,
      responseRate,
      disclaimer: DISCLAIMER,
    };
  }

  getMilestoneTracking(patientId: string, treatmentId: string): {
    treatmentName: string;
    condition: string;
    milestones: Array<{
      name: string;
      targetPercent: number;
      expectedWeek: number;
      actualWeek: number | null;
      status: "achieved" | "on_track" | "delayed" | "pending";
      value: number | null;
    }>;
    disclaimer: string;
  } | null {
    this.queriesProcessed++;
    console.log(`[TreatmentEfficacy] Tracking milestones for patient=${patientId}, treatment=${treatmentId}`);

    const treatment = this.getTreatment(treatmentId);
    if (!treatment || treatment.patientId !== patientId) return null;

    const config = this.getTreatmentConfig(treatment.treatmentType);
    const timeToEffectWeeks = config?.timeToEffectWeeks || 8;
    const range = Math.abs(treatment.baselineValue - treatment.targetValue);
    const startDate = new Date(treatment.startDate);
    const now = new Date();
    const elapsedWeeks = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));

    const milestoneTargets = [
      { name: "Initial response", targetPercent: 10, expectedWeek: Math.ceil(timeToEffectWeeks * 0.15) },
      { name: "25% improvement", targetPercent: 25, expectedWeek: Math.ceil(timeToEffectWeeks * 0.3) },
      { name: "50% improvement", targetPercent: 50, expectedWeek: Math.ceil(timeToEffectWeeks * 0.5) },
      { name: "75% improvement", targetPercent: 75, expectedWeek: Math.ceil(timeToEffectWeeks * 0.75) },
      { name: "Target achieved", targetPercent: 100, expectedWeek: timeToEffectWeeks },
    ];

    const actualImprovement = Math.abs(treatment.currentValue - treatment.baselineValue);
    const currentPercent = Math.min(Math.round((actualImprovement / range) * 100), 100);

    const milestones = milestoneTargets.map((m) => {
      const achieved = currentPercent >= m.targetPercent;
      let status: "achieved" | "on_track" | "delayed" | "pending";
      let actualWeek: number | null = null;

      if (achieved) {
        status = "achieved";
        actualWeek = Math.min(Math.ceil(m.expectedWeek * (0.85 + Math.random() * 0.3)), elapsedWeeks);
      } else if (elapsedWeeks >= m.expectedWeek) {
        status = "delayed";
      } else if (elapsedWeeks >= m.expectedWeek - 1) {
        status = "on_track";
      } else {
        status = "pending";
      }

      const milestoneValue = achieved
        ? Math.round((treatment.baselineValue + (treatment.targetValue - treatment.baselineValue) * (m.targetPercent / 100)) * 100) / 100
        : null;

      return {
        name: m.name,
        targetPercent: m.targetPercent,
        expectedWeek: m.expectedWeek,
        actualWeek,
        status,
        value: milestoneValue,
      };
    });

    return {
      treatmentName: `${treatment.medicationName} (${treatment.dosage})`,
      condition: treatment.condition,
      milestones,
      disclaimer: DISCLAIMER,
    };
  }

  getChartData(
    patientId: string,
    treatmentId: string,
    chartType: "line" | "area" | "comparison" | "milestone" = "line"
  ): EfficacyChartData | null {
    this.queriesProcessed++;
    console.log(`[TreatmentEfficacy] Getting chart data for patient=${patientId}, treatment=${treatmentId}, type=${chartType}`);

    const treatment = this.getTreatment(treatmentId);
    if (!treatment || treatment.patientId !== patientId) return null;

    const model = this.buildPredictionModel(treatment);
    const startDate = new Date(treatment.startDate);
    const now = new Date();
    const elapsedDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const dataPoints = this.generateDataPoints(treatment, model, elapsedDays);

    const labels = dataPoints.map((p) => p.date);
    const actual = dataPoints.map((p) => p.metricValue);
    const predicted = dataPoints.map((p) => p.expectedValue);
    const upperBand = dataPoints.map((p) => p.confidenceInterval.upper);
    const lowerBand = dataPoints.map((p) => p.confidenceInterval.lower);

    const milestoneMarkers: Array<{ label: string; index: number; value: number }> = [];
    dataPoints.forEach((p, i) => {
      if (p.milestone) {
        milestoneMarkers.push({ label: p.milestone, index: i, value: p.metricValue });
      }
    });

    const annotations: Array<{ type: string; label: string; value: number; position: number }> = [
      { type: "horizontal_line", label: "Baseline", value: treatment.baselineValue, position: 0 },
      { type: "horizontal_line", label: "Target", value: treatment.targetValue, position: labels.length - 1 },
    ];

    if (chartType === "milestone") {
      const milestoneResult = this.getMilestoneTracking(patientId, treatmentId);
      if (milestoneResult) {
        milestoneResult.milestones.forEach((m) => {
          if (m.value !== null) {
            annotations.push({
              type: "milestone_marker",
              label: m.name,
              value: m.value,
              position: m.actualWeek !== null ? m.actualWeek : m.expectedWeek,
            });
          }
        });
      }
    }

    return {
      chartType,
      labels,
      datasets: {
        actual,
        predicted,
        confidenceBands: { upper: upperBand, lower: lowerBand },
        milestones: milestoneMarkers,
      },
      annotations,
    };
  }

  getStats(): {
    totalTreatments: number;
    totalPatients: number;
    conditionsCovered: string[];
    medicationsTracked: string[];
    queriesProcessed: number;
    predictionsGenerated: number;
    initialized: boolean;
  } {
    const conditions = new Set<string>();
    const medications = new Set<string>();
    const allTreatments = Array.from(this.treatments.values());
    for (const t of allTreatments) {
      conditions.add(t.condition);
      medications.add(t.medicationName);
    }

    return {
      totalTreatments: this.treatments.size,
      totalPatients: this.patientTreatments.size,
      conditionsCovered: Array.from(conditions),
      medicationsTracked: Array.from(medications),
      queriesProcessed: this.queriesProcessed,
      predictionsGenerated: this.predictionsGenerated,
      initialized: this.initialized,
    };
  }
}

// ============================================
// Singleton & Initialization
// ============================================

export const treatmentEfficacyService = new TreatmentEfficacyService();

export function initializeTreatmentEfficacy(): void {
  console.log("[TreatmentEfficacy] Initializing treatment efficacy analytics service...");
  treatmentEfficacyService.initialize();
  const stats = treatmentEfficacyService.getStats();
  console.log(`[TreatmentEfficacy] Service ready - ${stats.totalTreatments} treatments, ${stats.totalPatients} patients, ${stats.conditionsCovered.length} conditions`);
}
