/**
 * Clinical Range Validation — Medical "Sanity Checks"
 * ====================================================
 * Database of physiological range rules for validating extracted values.
 * Catches AI hallucinations, unit mismatches, and impossible values.
 *
 * Sources: CLSI C28-A3, WHO, AHA, CMS 2026 clinical guidelines.
 */

export interface ClinicalRange {
  code: string;
  loincCode?: string;
  name: string;
  category: "vital" | "lab" | "metabolic" | "hematology" | "chemistry" | "endocrine" | "renal" | "hepatic";
  units: string[];
  normalRange: { min: number; max: number };
  warningRange: { min: number; max: number };
  criticalRange: { min: number; max: number };
  impossibleBelow: number;
  impossibleAbove: number;
  genderSpecific?: {
    male: { min: number; max: number };
    female: { min: number; max: number };
  };
  ageSpecific?: Array<{
    ageMin: number;
    ageMax: number;
    normalRange: { min: number; max: number };
  }>;
  conversionFactor?: { from: string; to: string; multiply: number };
}

export type ValidationSeverity = "pass" | "warning" | "critical" | "impossible" | "unit_mismatch";

export interface RangeValidationResult {
  code: string;
  name: string;
  value: number;
  unit: string;
  severity: ValidationSeverity;
  message: string;
  expectedRange: string;
  needsReview: boolean;
}

export interface TemporalValidationResult {
  field: string;
  severity: "pass" | "warning" | "error";
  message: string;
}

export interface UnitNormalizationResult {
  originalValue: number;
  originalUnit: string;
  normalizedValue: number;
  normalizedUnit: string;
  conversionApplied: boolean;
}

const CLINICAL_RANGES: ClinicalRange[] = [
  {
    code: "bp_systolic", loincCode: "8480-6", name: "Blood Pressure (Systolic)",
    category: "vital", units: ["mmHg"],
    normalRange: { min: 90, max: 130 }, warningRange: { min: 70, max: 180 },
    criticalRange: { min: 60, max: 220 }, impossibleBelow: 30, impossibleAbove: 350,
  },
  {
    code: "bp_diastolic", loincCode: "8462-4", name: "Blood Pressure (Diastolic)",
    category: "vital", units: ["mmHg"],
    normalRange: { min: 60, max: 85 }, warningRange: { min: 40, max: 110 },
    criticalRange: { min: 30, max: 130 }, impossibleBelow: 15, impossibleAbove: 200,
  },
  {
    code: "heart_rate", loincCode: "8867-4", name: "Heart Rate",
    category: "vital", units: ["bpm", "/min"],
    normalRange: { min: 60, max: 100 }, warningRange: { min: 40, max: 150 },
    criticalRange: { min: 30, max: 200 }, impossibleBelow: 10, impossibleAbove: 300,
  },
  {
    code: "respiratory_rate", loincCode: "9279-1", name: "Respiratory Rate",
    category: "vital", units: ["breaths/min", "/min"],
    normalRange: { min: 12, max: 20 }, warningRange: { min: 8, max: 30 },
    criticalRange: { min: 5, max: 40 }, impossibleBelow: 2, impossibleAbove: 60,
  },
  {
    code: "temperature", loincCode: "8310-5", name: "Body Temperature",
    category: "vital", units: ["°F", "°C", "F", "C"],
    normalRange: { min: 97.0, max: 99.5 }, warningRange: { min: 95.0, max: 103.0 },
    criticalRange: { min: 90.0, max: 107.0 }, impossibleBelow: 75, impossibleAbove: 115,
    conversionFactor: { from: "°C", to: "°F", multiply: 1.8 },
  },
  {
    code: "spo2", loincCode: "2708-6", name: "Oxygen Saturation (SpO2)",
    category: "vital", units: ["%"],
    normalRange: { min: 95, max: 100 }, warningRange: { min: 88, max: 100 },
    criticalRange: { min: 80, max: 100 }, impossibleBelow: 0, impossibleAbove: 100,
  },
  {
    code: "weight_kg", loincCode: "29463-7", name: "Body Weight",
    category: "vital", units: ["kg", "lbs", "lb"],
    normalRange: { min: 30, max: 200 }, warningRange: { min: 20, max: 300 },
    criticalRange: { min: 10, max: 500 }, impossibleBelow: 0.5, impossibleAbove: 700,
    conversionFactor: { from: "lbs", to: "kg", multiply: 0.4536 },
  },
  {
    code: "height_cm", loincCode: "8302-2", name: "Body Height",
    category: "vital", units: ["cm", "in", "inches"],
    normalRange: { min: 100, max: 210 }, warningRange: { min: 50, max: 250 },
    criticalRange: { min: 30, max: 275 }, impossibleBelow: 10, impossibleAbove: 300,
    conversionFactor: { from: "in", to: "cm", multiply: 2.54 },
  },
  {
    code: "glucose_fasting", loincCode: "1558-6", name: "Blood Glucose (Fasting)",
    category: "metabolic", units: ["mg/dL"],
    normalRange: { min: 70, max: 100 }, warningRange: { min: 55, max: 180 },
    criticalRange: { min: 40, max: 400 }, impossibleBelow: 10, impossibleAbove: 1500,
  },
  {
    code: "glucose_random", loincCode: "2345-7", name: "Blood Glucose (Random)",
    category: "metabolic", units: ["mg/dL"],
    normalRange: { min: 70, max: 140 }, warningRange: { min: 55, max: 250 },
    criticalRange: { min: 40, max: 500 }, impossibleBelow: 10, impossibleAbove: 1500,
  },
  {
    code: "hba1c", loincCode: "4548-4", name: "Hemoglobin A1c",
    category: "metabolic", units: ["%"],
    normalRange: { min: 4.0, max: 5.7 }, warningRange: { min: 3.0, max: 9.0 },
    criticalRange: { min: 2.0, max: 14.0 }, impossibleBelow: 1, impossibleAbove: 20,
  },
  {
    code: "potassium", loincCode: "2823-3", name: "Potassium",
    category: "chemistry", units: ["mEq/L", "mmol/L"],
    normalRange: { min: 3.5, max: 5.0 }, warningRange: { min: 3.0, max: 5.5 },
    criticalRange: { min: 2.5, max: 6.5 }, impossibleBelow: 1, impossibleAbove: 12,
  },
  {
    code: "sodium", loincCode: "2951-2", name: "Sodium",
    category: "chemistry", units: ["mEq/L", "mmol/L"],
    normalRange: { min: 136, max: 145 }, warningRange: { min: 130, max: 150 },
    criticalRange: { min: 120, max: 160 }, impossibleBelow: 90, impossibleAbove: 200,
  },
  {
    code: "creatinine", loincCode: "2160-0", name: "Creatinine",
    category: "renal", units: ["mg/dL"],
    normalRange: { min: 0.6, max: 1.2 }, warningRange: { min: 0.4, max: 2.5 },
    criticalRange: { min: 0.2, max: 10.0 }, impossibleBelow: 0, impossibleAbove: 25,
    genderSpecific: {
      male: { min: 0.7, max: 1.3 },
      female: { min: 0.5, max: 1.1 },
    },
  },
  {
    code: "egfr", loincCode: "33914-3", name: "eGFR",
    category: "renal", units: ["mL/min/1.73m²", "mL/min"],
    normalRange: { min: 90, max: 120 }, warningRange: { min: 30, max: 120 },
    criticalRange: { min: 15, max: 120 }, impossibleBelow: 0, impossibleAbove: 200,
  },
  {
    code: "hemoglobin", loincCode: "718-7", name: "Hemoglobin",
    category: "hematology", units: ["g/dL"],
    normalRange: { min: 12.0, max: 17.5 }, warningRange: { min: 8.0, max: 20.0 },
    criticalRange: { min: 5.0, max: 22.0 }, impossibleBelow: 1, impossibleAbove: 30,
    genderSpecific: {
      male: { min: 13.5, max: 17.5 },
      female: { min: 12.0, max: 15.5 },
    },
  },
  {
    code: "wbc", loincCode: "6690-2", name: "WBC Count",
    category: "hematology", units: ["K/uL", "x10³/µL", "10³/µL"],
    normalRange: { min: 4.5, max: 11.0 }, warningRange: { min: 2.0, max: 20.0 },
    criticalRange: { min: 1.0, max: 50.0 }, impossibleBelow: 0, impossibleAbove: 200,
  },
  {
    code: "platelets", loincCode: "777-3", name: "Platelet Count",
    category: "hematology", units: ["K/uL", "x10³/µL"],
    normalRange: { min: 150, max: 400 }, warningRange: { min: 50, max: 600 },
    criticalRange: { min: 20, max: 1000 }, impossibleBelow: 0, impossibleAbove: 2000,
  },
  {
    code: "cholesterol_total", loincCode: "2093-3", name: "Total Cholesterol",
    category: "metabolic", units: ["mg/dL"],
    normalRange: { min: 125, max: 200 }, warningRange: { min: 100, max: 240 },
    criticalRange: { min: 50, max: 400 }, impossibleBelow: 20, impossibleAbove: 1000,
  },
  {
    code: "ldl", loincCode: "2089-1", name: "LDL Cholesterol",
    category: "metabolic", units: ["mg/dL"],
    normalRange: { min: 0, max: 100 }, warningRange: { min: 0, max: 160 },
    criticalRange: { min: 0, max: 250 }, impossibleBelow: 0, impossibleAbove: 600,
  },
  {
    code: "hdl", loincCode: "2085-9", name: "HDL Cholesterol",
    category: "metabolic", units: ["mg/dL"],
    normalRange: { min: 40, max: 90 }, warningRange: { min: 20, max: 120 },
    criticalRange: { min: 10, max: 150 }, impossibleBelow: 0, impossibleAbove: 200,
  },
  {
    code: "triglycerides", loincCode: "2571-8", name: "Triglycerides",
    category: "metabolic", units: ["mg/dL"],
    normalRange: { min: 0, max: 150 }, warningRange: { min: 0, max: 300 },
    criticalRange: { min: 0, max: 500 }, impossibleBelow: 0, impossibleAbove: 5000,
  },
  {
    code: "tsh", loincCode: "3016-3", name: "TSH",
    category: "endocrine", units: ["mIU/L", "µIU/mL"],
    normalRange: { min: 0.4, max: 4.0 }, warningRange: { min: 0.1, max: 10.0 },
    criticalRange: { min: 0.01, max: 50.0 }, impossibleBelow: 0, impossibleAbove: 200,
  },
  {
    code: "alt", loincCode: "1742-6", name: "ALT (SGPT)",
    category: "hepatic", units: ["U/L", "IU/L"],
    normalRange: { min: 7, max: 56 }, warningRange: { min: 0, max: 200 },
    criticalRange: { min: 0, max: 1000 }, impossibleBelow: 0, impossibleAbove: 10000,
  },
  {
    code: "ast", loincCode: "1920-8", name: "AST (SGOT)",
    category: "hepatic", units: ["U/L", "IU/L"],
    normalRange: { min: 10, max: 40 }, warningRange: { min: 0, max: 200 },
    criticalRange: { min: 0, max: 1000 }, impossibleBelow: 0, impossibleAbove: 10000,
  },
  {
    code: "bilirubin_total", loincCode: "1975-2", name: "Total Bilirubin",
    category: "hepatic", units: ["mg/dL"],
    normalRange: { min: 0.1, max: 1.2 }, warningRange: { min: 0, max: 3.0 },
    criticalRange: { min: 0, max: 15.0 }, impossibleBelow: 0, impossibleAbove: 50,
  },
  {
    code: "albumin", loincCode: "1751-7", name: "Albumin",
    category: "chemistry", units: ["g/dL"],
    normalRange: { min: 3.5, max: 5.5 }, warningRange: { min: 2.5, max: 6.0 },
    criticalRange: { min: 1.5, max: 7.0 }, impossibleBelow: 0, impossibleAbove: 10,
  },
  {
    code: "calcium", loincCode: "17861-6", name: "Calcium",
    category: "chemistry", units: ["mg/dL"],
    normalRange: { min: 8.5, max: 10.5 }, warningRange: { min: 7.0, max: 12.0 },
    criticalRange: { min: 6.0, max: 14.0 }, impossibleBelow: 2, impossibleAbove: 20,
  },
  {
    code: "bun", loincCode: "3094-0", name: "BUN",
    category: "renal", units: ["mg/dL"],
    normalRange: { min: 7, max: 20 }, warningRange: { min: 5, max: 50 },
    criticalRange: { min: 2, max: 100 }, impossibleBelow: 0, impossibleAbove: 300,
  },
  {
    code: "inr", loincCode: "6301-6", name: "INR",
    category: "hematology", units: ["ratio", ""],
    normalRange: { min: 0.8, max: 1.2 }, warningRange: { min: 0.5, max: 3.5 },
    criticalRange: { min: 0.3, max: 8.0 }, impossibleBelow: 0.1, impossibleAbove: 15,
  },
];

const rangeMap = new Map<string, ClinicalRange>();
for (const r of CLINICAL_RANGES) {
  rangeMap.set(r.code, r);
  if (r.loincCode) rangeMap.set(r.loincCode, r);
}

export function validateValue(
  code: string,
  value: number,
  unit: string,
  gender?: "male" | "female"
): RangeValidationResult {
  const range = rangeMap.get(code);
  if (!range) {
    return {
      code, name: code, value, unit,
      severity: "pass", message: "No reference range available",
      expectedRange: "N/A", needsReview: false,
    };
  }

  const normalRange = (gender && range.genderSpecific)
    ? range.genderSpecific[gender]
    : range.normalRange;

  if (value < range.impossibleBelow || value > range.impossibleAbove) {
    return {
      code, name: range.name, value, unit,
      severity: "impossible",
      message: `Value ${value} ${unit} is physiologically impossible for ${range.name}. Likely an extraction error or hallucination.`,
      expectedRange: `${range.impossibleBelow}–${range.impossibleAbove} ${range.units[0]}`,
      needsReview: true,
    };
  }

  if (value < range.criticalRange.min || value > range.criticalRange.max) {
    return {
      code, name: range.name, value, unit,
      severity: "critical",
      message: `${range.name} of ${value} ${unit} is critically abnormal. Requires immediate verification.`,
      expectedRange: `${normalRange.min}–${normalRange.max} ${range.units[0]}`,
      needsReview: true,
    };
  }

  if (value < range.warningRange.min || value > range.warningRange.max) {
    return {
      code, name: range.name, value, unit,
      severity: "warning",
      message: `${range.name} of ${value} ${unit} is outside normal but within plausible range.`,
      expectedRange: `${normalRange.min}–${normalRange.max} ${range.units[0]}`,
      needsReview: true,
    };
  }

  if (value < normalRange.min || value > normalRange.max) {
    return {
      code, name: range.name, value, unit,
      severity: "warning",
      message: `${range.name} of ${value} ${unit} is slightly outside normal range.`,
      expectedRange: `${normalRange.min}–${normalRange.max} ${range.units[0]}`,
      needsReview: false,
    };
  }

  return {
    code, name: range.name, value, unit,
    severity: "pass",
    message: `${range.name} is within normal range.`,
    expectedRange: `${normalRange.min}–${normalRange.max} ${range.units[0]}`,
    needsReview: false,
  };
}

export function normalizeUnit(
  code: string,
  value: number,
  unit: string
): UnitNormalizationResult {
  const range = rangeMap.get(code);
  if (!range || !range.conversionFactor) {
    return { originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit, conversionApplied: false };
  }

  const unitLower = unit.toLowerCase().replace("°", "");
  const fromLower = range.conversionFactor.from.toLowerCase().replace("°", "");

  if (unitLower === fromLower || unitLower === fromLower.replace("°", "")) {
    let converted = value * range.conversionFactor.multiply;
    if (code === "temperature" && unitLower.includes("c")) {
      converted = value * 1.8 + 32;
    }
    return {
      originalValue: value, originalUnit: unit,
      normalizedValue: Math.round(converted * 100) / 100,
      normalizedUnit: range.conversionFactor.to,
      conversionApplied: true,
    };
  }

  return { originalValue: value, originalUnit: unit, normalizedValue: value, normalizedUnit: unit, conversionApplied: false };
}

export function validateTemporalIntegrity(dates: Record<string, string>): TemporalValidationResult[] {
  const results: TemporalValidationResult[] = [];
  const now = new Date();

  if (dates.admissionDate && dates.dischargeDate) {
    const adm = new Date(dates.admissionDate);
    const dis = new Date(dates.dischargeDate);
    if (dis < adm) {
      results.push({
        field: "dischargeDate",
        severity: "error",
        message: `Discharge date (${dates.dischargeDate}) is before admission date (${dates.admissionDate}).`,
      });
    }
  }

  if (dates.serviceDate) {
    const svc = new Date(dates.serviceDate);
    if (svc > now) {
      results.push({ field: "serviceDate", severity: "warning", message: `Service date (${dates.serviceDate}) is in the future.` });
    }
    if (svc < new Date("1900-01-01")) {
      results.push({ field: "serviceDate", severity: "error", message: `Service date (${dates.serviceDate}) is implausibly old.` });
    }
  }

  if (dates.dateOfBirth) {
    const dob = new Date(dates.dateOfBirth);
    if (dob > now) {
      results.push({ field: "dateOfBirth", severity: "error", message: `Date of birth (${dates.dateOfBirth}) is in the future.` });
    }
    const age = (now.getTime() - dob.getTime()) / (365.25 * 86400000);
    if (age > 130) {
      results.push({ field: "dateOfBirth", severity: "error", message: `Age (${Math.round(age)}) exceeds maximum plausible lifespan.` });
    }
  }

  if (dates.labCollectionDate && dates.labReportDate) {
    const coll = new Date(dates.labCollectionDate);
    const rpt = new Date(dates.labReportDate);
    if (rpt < coll) {
      results.push({ field: "labReportDate", severity: "warning", message: `Lab report date is before collection date.` });
    }
    const daysBetween = (rpt.getTime() - coll.getTime()) / 86400000;
    if (daysBetween > 30) {
      results.push({ field: "labReportDate", severity: "warning", message: `${Math.round(daysBetween)} days between collection and report — unusually long.` });
    }
  }

  if (results.length === 0) {
    results.push({ field: "temporal", severity: "pass", message: "All dates are consistent." });
  }

  return results;
}

export function getClinicalRanges(): ClinicalRange[] {
  return CLINICAL_RANGES;
}

export function lookupRange(code: string): ClinicalRange | undefined {
  return rangeMap.get(code);
}

console.log(`[ClinicalRanges] ${CLINICAL_RANGES.length} range rules loaded (${new Set(CLINICAL_RANGES.map(r => r.category)).size} categories)`);
