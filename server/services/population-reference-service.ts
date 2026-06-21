/**
 * Population Reference Service
 * Provides healthy ranges and population averages for comparative analytics
 * HIPAA Compliant - All data is anonymized population statistics
 */

export interface ReferenceRange {
  min: number;
  max: number;
  unit: string;
  optimalMin?: number;
  optimalMax?: number;
}

export interface PopulationStats {
  mean: number;
  median: number;
  standardDeviation: number;
  percentile25: number;
  percentile75: number;
  percentile5: number;
  percentile95: number;
}

export interface LabReference {
  code: string;
  name: string;
  ranges: {
    adult: ReferenceRange;
    male?: ReferenceRange;
    female?: ReferenceRange;
    pediatric?: ReferenceRange;
    geriatric?: ReferenceRange;
  };
  populationStats: PopulationStats;
  description: string;
  criticalLow?: number;
  criticalHigh?: number;
}

export interface VitalReference {
  type: string;
  name: string;
  ranges: {
    normal: ReferenceRange;
    optimal?: ReferenceRange;
    elevated?: ReferenceRange;
    high?: ReferenceRange;
  };
  populationStats: PopulationStats;
  ageAdjusted?: Record<string, ReferenceRange>;
}

export interface ConditionPrevalence {
  condition: string;
  icd10Code: string;
  prevalencePercent: number;
  ageGroupPrevalence: Record<string, number>;
  riskFactors: string[];
  commonComorbidities: string[];
}

export interface AllergyPrevalence {
  allergen: string;
  category: string;
  prevalencePercent: number;
  severityDistribution: {
    mild: number;
    moderate: number;
    severe: number;
  };
  crossReactivities: string[];
}

class PopulationReferenceService {
  private labReferences: Map<string, LabReference> = new Map();
  private vitalReferences: Map<string, VitalReference> = new Map();
  private conditionPrevalence: Map<string, ConditionPrevalence> = new Map();
  private allergyPrevalence: Map<string, AllergyPrevalence> = new Map();

  constructor() {
    this.initializeLabReferences();
    this.initializeVitalReferences();
    this.initializeConditionPrevalence();
    this.initializeAllergyPrevalence();
  }

  private initializeLabReferences(): void {
    const labRefs: LabReference[] = [
      {
        code: "HBA1C",
        name: "Hemoglobin A1C",
        ranges: {
          adult: { min: 4.0, max: 5.6, unit: "%", optimalMin: 4.0, optimalMax: 5.4 },
        },
        populationStats: { mean: 5.5, median: 5.4, standardDeviation: 0.8, percentile25: 5.0, percentile75: 5.9, percentile5: 4.5, percentile95: 7.2 },
        description: "Measures average blood sugar over past 2-3 months",
        criticalHigh: 10.0,
      },
      {
        code: "GLUC",
        name: "Fasting Glucose",
        ranges: {
          adult: { min: 70, max: 100, unit: "mg/dL", optimalMin: 70, optimalMax: 90 },
        },
        populationStats: { mean: 95, median: 92, standardDeviation: 15, percentile25: 85, percentile75: 105, percentile5: 72, percentile95: 125 },
        description: "Blood sugar level after fasting",
        criticalLow: 40,
        criticalHigh: 400,
      },
      {
        code: "CHOL",
        name: "Total Cholesterol",
        ranges: {
          adult: { min: 125, max: 200, unit: "mg/dL", optimalMin: 125, optimalMax: 180 },
        },
        populationStats: { mean: 195, median: 190, standardDeviation: 38, percentile25: 168, percentile75: 220, percentile5: 140, percentile95: 265 },
        description: "Total cholesterol in blood",
        criticalHigh: 300,
      },
      {
        code: "LDL",
        name: "LDL Cholesterol",
        ranges: {
          adult: { min: 0, max: 100, unit: "mg/dL", optimalMin: 0, optimalMax: 70 },
        },
        populationStats: { mean: 115, median: 110, standardDeviation: 35, percentile25: 90, percentile75: 140, percentile5: 60, percentile95: 180 },
        description: "Low-density lipoprotein (bad cholesterol)",
        criticalHigh: 190,
      },
      {
        code: "HDL",
        name: "HDL Cholesterol",
        ranges: {
          adult: { min: 40, max: 200, unit: "mg/dL", optimalMin: 60, optimalMax: 200 },
          male: { min: 40, max: 200, unit: "mg/dL", optimalMin: 50, optimalMax: 200 },
          female: { min: 50, max: 200, unit: "mg/dL", optimalMin: 60, optimalMax: 200 },
        },
        populationStats: { mean: 54, median: 52, standardDeviation: 15, percentile25: 44, percentile75: 64, percentile5: 35, percentile95: 85 },
        description: "High-density lipoprotein (good cholesterol)",
        criticalLow: 20,
      },
      {
        code: "TRIG",
        name: "Triglycerides",
        ranges: {
          adult: { min: 0, max: 150, unit: "mg/dL", optimalMin: 0, optimalMax: 100 },
        },
        populationStats: { mean: 140, median: 120, standardDeviation: 75, percentile25: 85, percentile75: 180, percentile5: 50, percentile95: 300 },
        description: "Type of fat in blood",
        criticalHigh: 500,
      },
      {
        code: "CREAT",
        name: "Creatinine",
        ranges: {
          adult: { min: 0.6, max: 1.2, unit: "mg/dL" },
          male: { min: 0.7, max: 1.3, unit: "mg/dL" },
          female: { min: 0.5, max: 1.1, unit: "mg/dL" },
        },
        populationStats: { mean: 0.95, median: 0.9, standardDeviation: 0.25, percentile25: 0.8, percentile75: 1.1, percentile5: 0.6, percentile95: 1.4 },
        description: "Kidney function marker",
        criticalHigh: 4.0,
      },
      {
        code: "BUN",
        name: "Blood Urea Nitrogen",
        ranges: {
          adult: { min: 7, max: 20, unit: "mg/dL" },
        },
        populationStats: { mean: 14, median: 13, standardDeviation: 5, percentile25: 10, percentile75: 18, percentile5: 7, percentile95: 25 },
        description: "Kidney function and hydration marker",
        criticalHigh: 50,
      },
      {
        code: "TSH",
        name: "Thyroid Stimulating Hormone",
        ranges: {
          adult: { min: 0.4, max: 4.0, unit: "mIU/L", optimalMin: 0.5, optimalMax: 2.5 },
        },
        populationStats: { mean: 1.8, median: 1.6, standardDeviation: 1.2, percentile25: 1.0, percentile75: 2.5, percentile5: 0.5, percentile95: 4.5 },
        description: "Thyroid function marker",
        criticalLow: 0.1,
        criticalHigh: 10.0,
      },
      {
        code: "WBC",
        name: "White Blood Cell Count",
        ranges: {
          adult: { min: 4.5, max: 11.0, unit: "K/uL" },
        },
        populationStats: { mean: 7.0, median: 6.8, standardDeviation: 2.0, percentile25: 5.5, percentile75: 8.5, percentile5: 4.0, percentile95: 11.5 },
        description: "Immune system cells",
        criticalLow: 2.0,
        criticalHigh: 30.0,
      },
      {
        code: "HGB",
        name: "Hemoglobin",
        ranges: {
          adult: { min: 12.0, max: 17.5, unit: "g/dL" },
          male: { min: 13.5, max: 17.5, unit: "g/dL" },
          female: { min: 12.0, max: 16.0, unit: "g/dL" },
        },
        populationStats: { mean: 14.5, median: 14.3, standardDeviation: 1.5, percentile25: 13.5, percentile75: 15.5, percentile5: 12.0, percentile95: 17.0 },
        description: "Oxygen-carrying protein in blood",
        criticalLow: 7.0,
        criticalHigh: 20.0,
      },
      {
        code: "PLT",
        name: "Platelet Count",
        ranges: {
          adult: { min: 150, max: 400, unit: "K/uL" },
        },
        populationStats: { mean: 250, median: 245, standardDeviation: 60, percentile25: 205, percentile75: 295, percentile5: 160, percentile95: 370 },
        description: "Blood clotting cells",
        criticalLow: 50,
        criticalHigh: 1000,
      },
    ];

    labRefs.forEach(ref => this.labReferences.set(ref.code, ref));
  }

  private initializeVitalReferences(): void {
    const vitalRefs: VitalReference[] = [
      {
        type: "blood_pressure_systolic",
        name: "Systolic Blood Pressure",
        ranges: {
          normal: { min: 90, max: 120, unit: "mmHg" },
          optimal: { min: 90, max: 110, unit: "mmHg" },
          elevated: { min: 120, max: 129, unit: "mmHg" },
          high: { min: 130, max: 180, unit: "mmHg" },
        },
        populationStats: { mean: 122, median: 120, standardDeviation: 15, percentile25: 112, percentile75: 132, percentile5: 100, percentile95: 150 },
        ageAdjusted: {
          "18-39": { min: 90, max: 120, unit: "mmHg" },
          "40-59": { min: 90, max: 125, unit: "mmHg" },
          "60+": { min: 90, max: 130, unit: "mmHg" },
        },
      },
      {
        type: "blood_pressure_diastolic",
        name: "Diastolic Blood Pressure",
        ranges: {
          normal: { min: 60, max: 80, unit: "mmHg" },
          optimal: { min: 60, max: 75, unit: "mmHg" },
          elevated: { min: 80, max: 84, unit: "mmHg" },
          high: { min: 85, max: 120, unit: "mmHg" },
        },
        populationStats: { mean: 78, median: 76, standardDeviation: 10, percentile25: 70, percentile75: 85, percentile5: 62, percentile95: 95 },
      },
      {
        type: "heart_rate",
        name: "Heart Rate",
        ranges: {
          normal: { min: 60, max: 100, unit: "bpm" },
          optimal: { min: 60, max: 80, unit: "bpm" },
        },
        populationStats: { mean: 75, median: 74, standardDeviation: 12, percentile25: 66, percentile75: 84, percentile5: 55, percentile95: 98 },
      },
      {
        type: "temperature",
        name: "Body Temperature",
        ranges: {
          normal: { min: 97.0, max: 99.0, unit: "°F" },
          optimal: { min: 97.8, max: 98.8, unit: "°F" },
        },
        populationStats: { mean: 98.2, median: 98.2, standardDeviation: 0.7, percentile25: 97.7, percentile75: 98.7, percentile5: 97.0, percentile95: 99.4 },
      },
      {
        type: "respiratory_rate",
        name: "Respiratory Rate",
        ranges: {
          normal: { min: 12, max: 20, unit: "breaths/min" },
          optimal: { min: 12, max: 16, unit: "breaths/min" },
        },
        populationStats: { mean: 15, median: 14, standardDeviation: 3, percentile25: 13, percentile75: 17, percentile5: 11, percentile95: 21 },
      },
      {
        type: "oxygen_saturation",
        name: "Oxygen Saturation",
        ranges: {
          normal: { min: 95, max: 100, unit: "%" },
          optimal: { min: 97, max: 100, unit: "%" },
        },
        populationStats: { mean: 97.5, median: 98, standardDeviation: 1.5, percentile25: 96.5, percentile75: 98.5, percentile5: 95, percentile95: 99.5 },
      },
      {
        type: "weight",
        name: "Weight",
        ranges: {
          normal: { min: 100, max: 250, unit: "lbs" },
        },
        populationStats: { mean: 181, median: 175, standardDeviation: 45, percentile25: 150, percentile75: 210, percentile5: 115, percentile95: 275 },
      },
      {
        type: "bmi",
        name: "Body Mass Index",
        ranges: {
          normal: { min: 18.5, max: 24.9, unit: "kg/m²" },
          optimal: { min: 20, max: 23, unit: "kg/m²" },
        },
        populationStats: { mean: 28.5, median: 27.8, standardDeviation: 6, percentile25: 24, percentile75: 32, percentile5: 19, percentile95: 40 },
      },
    ];

    vitalRefs.forEach(ref => this.vitalReferences.set(ref.type, ref));
  }

  private initializeConditionPrevalence(): void {
    const conditions: ConditionPrevalence[] = [
      {
        condition: "Essential Hypertension",
        icd10Code: "I10",
        prevalencePercent: 47.3,
        ageGroupPrevalence: { "18-39": 22.4, "40-59": 54.5, "60+": 74.5 },
        riskFactors: ["Obesity", "High sodium diet", "Lack of exercise", "Family history", "Stress"],
        commonComorbidities: ["Type 2 Diabetes", "Heart Disease", "Chronic Kidney Disease"],
      },
      {
        condition: "Type 2 Diabetes",
        icd10Code: "E11",
        prevalencePercent: 11.3,
        ageGroupPrevalence: { "18-39": 3.0, "40-59": 13.5, "60+": 26.8 },
        riskFactors: ["Obesity", "Sedentary lifestyle", "Family history", "Prediabetes", "Age"],
        commonComorbidities: ["Essential Hypertension", "Hyperlipidemia", "Obesity"],
      },
      {
        condition: "Hyperlipidemia",
        icd10Code: "E78",
        prevalencePercent: 38.1,
        ageGroupPrevalence: { "18-39": 20.5, "40-59": 51.2, "60+": 54.8 },
        riskFactors: ["Poor diet", "Obesity", "Lack of exercise", "Family history", "Smoking"],
        commonComorbidities: ["Essential Hypertension", "Type 2 Diabetes", "Heart Disease"],
      },
      {
        condition: "Obesity",
        icd10Code: "E66",
        prevalencePercent: 41.9,
        ageGroupPrevalence: { "18-39": 36.5, "40-59": 44.8, "60+": 42.8 },
        riskFactors: ["Poor diet", "Sedentary lifestyle", "Genetics", "Medications", "Sleep issues"],
        commonComorbidities: ["Type 2 Diabetes", "Essential Hypertension", "Sleep Apnea"],
      },
      {
        condition: "Asthma",
        icd10Code: "J45",
        prevalencePercent: 7.8,
        ageGroupPrevalence: { "0-17": 8.0, "18-39": 8.5, "40-59": 7.5, "60+": 6.8 },
        riskFactors: ["Allergies", "Family history", "Respiratory infections", "Environmental factors"],
        commonComorbidities: ["Allergic Rhinitis", "GERD", "Anxiety"],
      },
      {
        condition: "Depression",
        icd10Code: "F32",
        prevalencePercent: 8.4,
        ageGroupPrevalence: { "18-25": 17.0, "26-49": 8.1, "50+": 5.4 },
        riskFactors: ["Genetics", "Trauma", "Chronic illness", "Substance abuse", "Social isolation"],
        commonComorbidities: ["Anxiety", "Chronic Pain", "Insomnia"],
      },
      {
        condition: "Anxiety Disorder",
        icd10Code: "F41",
        prevalencePercent: 19.1,
        ageGroupPrevalence: { "18-25": 25.5, "26-49": 19.8, "50+": 13.8 },
        riskFactors: ["Genetics", "Trauma", "Stress", "Other mental health conditions"],
        commonComorbidities: ["Depression", "Panic Disorder", "PTSD"],
      },
    ];

    conditions.forEach(c => this.conditionPrevalence.set(c.condition.toLowerCase(), c));
  }

  private initializeAllergyPrevalence(): void {
    const allergies: AllergyPrevalence[] = [
      {
        allergen: "Penicillin",
        category: "Medication",
        prevalencePercent: 10.0,
        severityDistribution: { mild: 60, moderate: 30, severe: 10 },
        crossReactivities: ["Amoxicillin", "Ampicillin", "Cephalosporins"],
      },
      {
        allergen: "Sulfa Drugs",
        category: "Medication",
        prevalencePercent: 3.0,
        severityDistribution: { mild: 50, moderate: 35, severe: 15 },
        crossReactivities: ["Sulfamethoxazole", "Sulfasalazine"],
      },
      {
        allergen: "Peanuts",
        category: "Food",
        prevalencePercent: 2.5,
        severityDistribution: { mild: 30, moderate: 40, severe: 30 },
        crossReactivities: ["Tree nuts", "Legumes"],
      },
      {
        allergen: "Tree Nuts",
        category: "Food",
        prevalencePercent: 1.1,
        severityDistribution: { mild: 35, moderate: 40, severe: 25 },
        crossReactivities: ["Peanuts", "Coconut"],
      },
      {
        allergen: "Shellfish",
        category: "Food",
        prevalencePercent: 2.0,
        severityDistribution: { mild: 40, moderate: 35, severe: 25 },
        crossReactivities: ["Dust mites", "Cockroaches"],
      },
      {
        allergen: "Eggs",
        category: "Food",
        prevalencePercent: 1.3,
        severityDistribution: { mild: 50, moderate: 35, severe: 15 },
        crossReactivities: ["Chicken"],
      },
      {
        allergen: "Milk",
        category: "Food",
        prevalencePercent: 1.9,
        severityDistribution: { mild: 55, moderate: 35, severe: 10 },
        crossReactivities: ["Beef", "Goat milk"],
      },
      {
        allergen: "Dust Mites",
        category: "Environmental",
        prevalencePercent: 20.0,
        severityDistribution: { mild: 60, moderate: 35, severe: 5 },
        crossReactivities: ["Shellfish", "Cockroaches"],
      },
      {
        allergen: "Pollen",
        category: "Environmental",
        prevalencePercent: 25.0,
        severityDistribution: { mild: 65, moderate: 30, severe: 5 },
        crossReactivities: ["Certain fruits", "Vegetables"],
      },
      {
        allergen: "Pet Dander",
        category: "Environmental",
        prevalencePercent: 15.0,
        severityDistribution: { mild: 70, moderate: 25, severe: 5 },
        crossReactivities: [],
      },
      {
        allergen: "Latex",
        category: "Environmental",
        prevalencePercent: 1.0,
        severityDistribution: { mild: 45, moderate: 35, severe: 20 },
        crossReactivities: ["Bananas", "Avocados", "Kiwi", "Chestnuts"],
      },
    ];

    allergies.forEach(a => this.allergyPrevalence.set(a.allergen.toLowerCase(), a));
  }

  getLabReference(code: string): LabReference | undefined {
    return this.labReferences.get(code.toUpperCase());
  }

  getAllLabReferences(): LabReference[] {
    return Array.from(this.labReferences.values());
  }

  getVitalReference(type: string): VitalReference | undefined {
    return this.vitalReferences.get(type);
  }

  getAllVitalReferences(): VitalReference[] {
    return Array.from(this.vitalReferences.values());
  }

  getConditionPrevalence(condition: string): ConditionPrevalence | undefined {
    return this.conditionPrevalence.get(condition.toLowerCase());
  }

  getAllConditionPrevalence(): ConditionPrevalence[] {
    return Array.from(this.conditionPrevalence.values());
  }

  getAllergyPrevalence(allergen: string): AllergyPrevalence | undefined {
    return this.allergyPrevalence.get(allergen.toLowerCase());
  }

  getAllAllergyPrevalence(): AllergyPrevalence[] {
    return Array.from(this.allergyPrevalence.values());
  }

  calculatePercentile(value: number, stats: PopulationStats): number {
    const zScore = (value - stats.mean) / stats.standardDeviation;
    const percentile = 0.5 * (1 + this.erf(zScore / Math.sqrt(2)));
    return Math.round(percentile * 100);
  }

  private erf(x: number): number {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  getValueStatus(value: number, reference: ReferenceRange): "critical-low" | "low" | "normal" | "optimal" | "high" | "critical-high" {
    if (reference.optimalMin !== undefined && reference.optimalMax !== undefined) {
      if (value >= reference.optimalMin && value <= reference.optimalMax) {
        return "optimal";
      }
    }
    if (value >= reference.min && value <= reference.max) {
      return "normal";
    }
    if (value < reference.min) {
      return "low";
    }
    return "high";
  }

  getLabValueComparison(code: string, value: number): {
    status: string;
    percentile: number;
    reference: LabReference;
    comparisonText: string;
  } | null {
    const reference = this.getLabReference(code);
    if (!reference) return null;

    const percentile = this.calculatePercentile(value, reference.populationStats);
    const status = this.getValueStatus(value, reference.ranges.adult);

    let comparisonText = "";
    if (percentile <= 5) {
      comparisonText = "Much lower than most people";
    } else if (percentile <= 25) {
      comparisonText = "Lower than average";
    } else if (percentile <= 75) {
      comparisonText = "Similar to most people";
    } else if (percentile <= 95) {
      comparisonText = "Higher than average";
    } else {
      comparisonText = "Much higher than most people";
    }

    return { status, percentile, reference, comparisonText };
  }

  getVitalValueComparison(type: string, value: number): {
    status: string;
    percentile: number;
    reference: VitalReference;
    comparisonText: string;
  } | null {
    const reference = this.getVitalReference(type);
    if (!reference) return null;

    const percentile = this.calculatePercentile(value, reference.populationStats);
    const status = this.getValueStatus(value, reference.ranges.normal);

    let comparisonText = "";
    if (percentile <= 5) {
      comparisonText = "Much lower than most people";
    } else if (percentile <= 25) {
      comparisonText = "Lower than average";
    } else if (percentile <= 75) {
      comparisonText = "Similar to most people";
    } else if (percentile <= 95) {
      comparisonText = "Higher than average";
    } else {
      comparisonText = "Much higher than most people";
    }

    return { status, percentile, reference, comparisonText };
  }
}

export const populationReferenceService = new PopulationReferenceService();
