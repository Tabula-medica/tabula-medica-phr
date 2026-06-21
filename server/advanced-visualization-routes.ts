import type { Express, Request, Response } from "express";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const BENCHMARK_DATA = generateBenchmarkData();
const TREATMENT_DATA = generateTreatmentData();
const GEOSPATIAL_DATA = generateGeospatialData();

function generateBenchmarkData() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const metrics: Record<string, { label: string; unit: string; patientRange: [number, number]; populationMean: number; populationStd: number; normalRange: [number, number] }> = {
    blood_pressure_systolic: { label: "Systolic BP", unit: "mmHg", patientRange: [118, 142], populationMean: 120, populationStd: 12, normalRange: [90, 120] },
    blood_pressure_diastolic: { label: "Diastolic BP", unit: "mmHg", patientRange: [72, 88], populationMean: 80, populationStd: 8, normalRange: [60, 80] },
    hba1c: { label: "HbA1c", unit: "%", patientRange: [5.8, 7.4], populationMean: 5.7, populationStd: 0.6, normalRange: [4.0, 5.7] },
    cholesterol_total: { label: "Total Cholesterol", unit: "mg/dL", patientRange: [180, 240], populationMean: 200, populationStd: 30, normalRange: [125, 200] },
    ldl: { label: "LDL Cholesterol", unit: "mg/dL", patientRange: [90, 160], populationMean: 100, populationStd: 25, normalRange: [0, 100] },
    hdl: { label: "HDL Cholesterol", unit: "mg/dL", patientRange: [38, 65], populationMean: 55, populationStd: 12, normalRange: [40, 60] },
    bmi: { label: "BMI", unit: "kg/m²", patientRange: [24, 32], populationMean: 26.5, populationStd: 4.5, normalRange: [18.5, 25] },
    glucose_fasting: { label: "Fasting Glucose", unit: "mg/dL", patientRange: [85, 130], populationMean: 99, populationStd: 15, normalRange: [70, 100] },
    heart_rate: { label: "Resting Heart Rate", unit: "bpm", patientRange: [62, 82], populationMean: 72, populationStd: 10, normalRange: [60, 100] },
    creatinine: { label: "Creatinine", unit: "mg/dL", patientRange: [0.8, 1.4], populationMean: 1.0, populationStd: 0.2, normalRange: [0.7, 1.3] },
  };

  const result: Record<string, any> = {};
  for (const [key, config] of Object.entries(metrics)) {
    const timeSeries = months.map((month, i) => {
      const progress = i / 11;
      const patientValue = config.patientRange[0] + (config.patientRange[1] - config.patientRange[0]) * (0.8 - 0.5 * progress + 0.15 * Math.sin(i * 0.8));
      return {
        month,
        patientValue: parseFloat(patientValue.toFixed(1)),
        populationMean: config.populationMean,
        populationP25: parseFloat((config.populationMean - config.populationStd * 0.67).toFixed(1)),
        populationP75: parseFloat((config.populationMean + config.populationStd * 0.67).toFixed(1)),
        populationP10: parseFloat((config.populationMean - config.populationStd * 1.28).toFixed(1)),
        populationP90: parseFloat((config.populationMean + config.populationStd * 1.28).toFixed(1)),
        normalLow: config.normalRange[0],
        normalHigh: config.normalRange[1],
      };
    });

    const latestPatient = timeSeries[timeSeries.length - 1].patientValue;
    const percentile = Math.min(99, Math.max(1, Math.round(50 + ((latestPatient - config.populationMean) / config.populationStd) * 25)));

    result[key] = {
      metric: key,
      label: config.label,
      unit: config.unit,
      timeSeries,
      latestValue: latestPatient,
      populationMean: config.populationMean,
      percentile,
      normalRange: config.normalRange,
      trend: latestPatient < timeSeries[6].patientValue ? "improving" : "worsening",
      riskLevel: latestPatient > config.normalRange[1] * 1.15 || latestPatient < config.normalRange[0] * 0.85 ? "high" : latestPatient > config.normalRange[1] || latestPatient < config.normalRange[0] ? "moderate" : "low",
    };
  }
  return result;
}

function generateTreatmentData() {
  const treatments = [
    {
      id: "tx-metformin",
      name: "Metformin 500mg",
      condition: "Type 2 Diabetes",
      startDate: "2025-03-15",
      metric: "HbA1c",
      unit: "%",
      targetValue: 6.5,
      data: Array.from({ length: 18 }, (_, i) => ({
        week: i * 2,
        date: new Date(2025, 2, 15 + i * 14).toISOString().slice(0, 10),
        value: parseFloat((8.2 - 1.2 * (1 - Math.exp(-i * 0.15)) + 0.15 * Math.sin(i * 0.5)).toFixed(1)),
        adherence: Math.min(100, Math.max(70, 92 - Math.floor(Math.random() * 15))),
      })),
    },
    {
      id: "tx-lisinopril",
      name: "Lisinopril 10mg",
      condition: "Hypertension",
      startDate: "2025-01-10",
      metric: "Systolic BP",
      unit: "mmHg",
      targetValue: 120,
      data: Array.from({ length: 24 }, (_, i) => ({
        week: i * 2,
        date: new Date(2025, 0, 10 + i * 14).toISOString().slice(0, 10),
        value: Math.round(148 - 22 * (1 - Math.exp(-i * 0.12)) + 4 * Math.sin(i * 0.6)),
        adherence: Math.min(100, Math.max(75, 95 - Math.floor(Math.random() * 12))),
      })),
    },
    {
      id: "tx-atorvastatin",
      name: "Atorvastatin 20mg",
      condition: "Hyperlipidemia",
      startDate: "2025-06-01",
      metric: "LDL Cholesterol",
      unit: "mg/dL",
      targetValue: 100,
      data: Array.from({ length: 12 }, (_, i) => ({
        week: i * 4,
        date: new Date(2025, 5, 1 + i * 28).toISOString().slice(0, 10),
        value: Math.round(165 - 55 * (1 - Math.exp(-i * 0.2)) + 5 * Math.sin(i * 0.4)),
        adherence: Math.min(100, Math.max(80, 88 - Math.floor(Math.random() * 10))),
      })),
    },
    {
      id: "tx-physical-therapy",
      name: "Physical Therapy Program",
      condition: "Chronic Back Pain",
      startDate: "2025-08-01",
      metric: "Pain Score (VAS)",
      unit: "/10",
      targetValue: 3,
      data: Array.from({ length: 10 }, (_, i) => ({
        week: i * 2,
        date: new Date(2025, 7, 1 + i * 14).toISOString().slice(0, 10),
        value: parseFloat((7.5 - 3.5 * (1 - Math.exp(-i * 0.18)) + 0.5 * Math.sin(i * 0.7)).toFixed(1)),
        adherence: Math.min(100, Math.max(60, 85 - Math.floor(Math.random() * 20))),
      })),
    },
  ];

  return treatments;
}

function generateGeospatialData() {
  const stateData: Record<string, { name: string; population: number; metrics: Record<string, number> }> = {
    AL: { name: "Alabama", population: 5024279, metrics: { diabetes_prevalence: 14.2, obesity_rate: 36.3, flu_incidence: 28.5, vaccination_rate: 52.1, heart_disease_mortality: 245.6 } },
    AK: { name: "Alaska", population: 733391, metrics: { diabetes_prevalence: 8.1, obesity_rate: 29.8, flu_incidence: 19.2, vaccination_rate: 58.3, heart_disease_mortality: 178.2 } },
    AZ: { name: "Arizona", population: 7151502, metrics: { diabetes_prevalence: 10.5, obesity_rate: 29.5, flu_incidence: 22.1, vaccination_rate: 60.2, heart_disease_mortality: 168.4 } },
    AR: { name: "Arkansas", population: 3011524, metrics: { diabetes_prevalence: 13.6, obesity_rate: 37.4, flu_incidence: 30.1, vaccination_rate: 48.7, heart_disease_mortality: 258.3 } },
    CA: { name: "California", population: 39538223, metrics: { diabetes_prevalence: 9.2, obesity_rate: 25.1, flu_incidence: 18.4, vaccination_rate: 72.1, heart_disease_mortality: 152.3 } },
    CO: { name: "Colorado", population: 5773714, metrics: { diabetes_prevalence: 7.2, obesity_rate: 22.6, flu_incidence: 16.8, vaccination_rate: 70.5, heart_disease_mortality: 138.5 } },
    CT: { name: "Connecticut", population: 3605944, metrics: { diabetes_prevalence: 8.8, obesity_rate: 26.9, flu_incidence: 20.5, vaccination_rate: 74.2, heart_disease_mortality: 155.1 } },
    DE: { name: "Delaware", population: 989948, metrics: { diabetes_prevalence: 11.2, obesity_rate: 31.8, flu_incidence: 24.3, vaccination_rate: 62.8, heart_disease_mortality: 192.4 } },
    FL: { name: "Florida", population: 21538187, metrics: { diabetes_prevalence: 11.8, obesity_rate: 28.4, flu_incidence: 25.6, vaccination_rate: 58.9, heart_disease_mortality: 175.8 } },
    GA: { name: "Georgia", population: 10711908, metrics: { diabetes_prevalence: 12.5, obesity_rate: 33.2, flu_incidence: 27.8, vaccination_rate: 53.4, heart_disease_mortality: 218.5 } },
    HI: { name: "Hawaii", population: 1455271, metrics: { diabetes_prevalence: 9.5, obesity_rate: 23.8, flu_incidence: 14.2, vaccination_rate: 76.8, heart_disease_mortality: 128.6 } },
    ID: { name: "Idaho", population: 1839106, metrics: { diabetes_prevalence: 8.8, obesity_rate: 28.5, flu_incidence: 20.1, vaccination_rate: 48.2, heart_disease_mortality: 165.2 } },
    IL: { name: "Illinois", population: 12812508, metrics: { diabetes_prevalence: 10.1, obesity_rate: 31.1, flu_incidence: 23.4, vaccination_rate: 62.5, heart_disease_mortality: 185.4 } },
    IN: { name: "Indiana", population: 6732219, metrics: { diabetes_prevalence: 11.8, obesity_rate: 34.1, flu_incidence: 26.2, vaccination_rate: 52.8, heart_disease_mortality: 215.3 } },
    IA: { name: "Iowa", population: 3190369, metrics: { diabetes_prevalence: 9.5, obesity_rate: 32.8, flu_incidence: 22.8, vaccination_rate: 59.1, heart_disease_mortality: 188.2 } },
    KS: { name: "Kansas", population: 2937880, metrics: { diabetes_prevalence: 10.2, obesity_rate: 32.4, flu_incidence: 24.1, vaccination_rate: 55.6, heart_disease_mortality: 195.8 } },
    KY: { name: "Kentucky", population: 4505836, metrics: { diabetes_prevalence: 13.8, obesity_rate: 36.5, flu_incidence: 29.4, vaccination_rate: 50.2, heart_disease_mortality: 242.1 } },
    LA: { name: "Louisiana", population: 4657757, metrics: { diabetes_prevalence: 14.1, obesity_rate: 36.8, flu_incidence: 31.2, vaccination_rate: 47.5, heart_disease_mortality: 258.7 } },
    ME: { name: "Maine", population: 1362359, metrics: { diabetes_prevalence: 9.2, obesity_rate: 29.4, flu_incidence: 18.5, vaccination_rate: 72.8, heart_disease_mortality: 168.4 } },
    MD: { name: "Maryland", population: 6177224, metrics: { diabetes_prevalence: 10.8, obesity_rate: 30.5, flu_incidence: 22.8, vaccination_rate: 68.4, heart_disease_mortality: 188.5 } },
    MA: { name: "Massachusetts", population: 7029917, metrics: { diabetes_prevalence: 8.5, obesity_rate: 25.2, flu_incidence: 19.1, vaccination_rate: 78.5, heart_disease_mortality: 142.8 } },
    MI: { name: "Michigan", population: 10077331, metrics: { diabetes_prevalence: 11.2, obesity_rate: 33.5, flu_incidence: 25.8, vaccination_rate: 57.2, heart_disease_mortality: 212.4 } },
    MN: { name: "Minnesota", population: 5706494, metrics: { diabetes_prevalence: 8.1, obesity_rate: 28.4, flu_incidence: 19.5, vaccination_rate: 68.8, heart_disease_mortality: 148.5 } },
    MS: { name: "Mississippi", population: 2961279, metrics: { diabetes_prevalence: 15.2, obesity_rate: 39.7, flu_incidence: 33.5, vaccination_rate: 42.8, heart_disease_mortality: 282.4 } },
    MO: { name: "Missouri", population: 6154913, metrics: { diabetes_prevalence: 11.5, obesity_rate: 33.8, flu_incidence: 26.5, vaccination_rate: 53.2, heart_disease_mortality: 222.1 } },
    MT: { name: "Montana", population: 1084225, metrics: { diabetes_prevalence: 8.5, obesity_rate: 26.8, flu_incidence: 17.2, vaccination_rate: 55.8, heart_disease_mortality: 162.5 } },
    NE: { name: "Nebraska", population: 1961504, metrics: { diabetes_prevalence: 9.2, obesity_rate: 32.1, flu_incidence: 21.8, vaccination_rate: 58.5, heart_disease_mortality: 175.2 } },
    NV: { name: "Nevada", population: 3104614, metrics: { diabetes_prevalence: 10.8, obesity_rate: 28.2, flu_incidence: 21.5, vaccination_rate: 55.1, heart_disease_mortality: 185.4 } },
    NH: { name: "New Hampshire", population: 1377529, metrics: { diabetes_prevalence: 8.2, obesity_rate: 27.5, flu_incidence: 17.8, vaccination_rate: 72.5, heart_disease_mortality: 152.8 } },
    NJ: { name: "New Jersey", population: 9288994, metrics: { diabetes_prevalence: 9.8, obesity_rate: 27.1, flu_incidence: 21.2, vaccination_rate: 72.8, heart_disease_mortality: 172.5 } },
    NM: { name: "New Mexico", population: 2117522, metrics: { diabetes_prevalence: 11.5, obesity_rate: 28.8, flu_incidence: 22.5, vaccination_rate: 58.2, heart_disease_mortality: 178.5 } },
    NY: { name: "New York", population: 20201249, metrics: { diabetes_prevalence: 10.5, obesity_rate: 27.5, flu_incidence: 22.8, vaccination_rate: 72.1, heart_disease_mortality: 182.5 } },
    NC: { name: "North Carolina", population: 10439388, metrics: { diabetes_prevalence: 11.8, obesity_rate: 32.1, flu_incidence: 25.2, vaccination_rate: 57.8, heart_disease_mortality: 198.5 } },
    ND: { name: "North Dakota", population: 779094, metrics: { diabetes_prevalence: 8.8, obesity_rate: 31.5, flu_incidence: 20.2, vaccination_rate: 52.5, heart_disease_mortality: 172.8 } },
    OH: { name: "Ohio", population: 11799448, metrics: { diabetes_prevalence: 11.5, obesity_rate: 34.8, flu_incidence: 26.1, vaccination_rate: 55.2, heart_disease_mortality: 218.5 } },
    OK: { name: "Oklahoma", population: 3959353, metrics: { diabetes_prevalence: 13.2, obesity_rate: 36.5, flu_incidence: 28.8, vaccination_rate: 48.5, heart_disease_mortality: 258.2 } },
    OR: { name: "Oregon", population: 4237256, metrics: { diabetes_prevalence: 8.8, obesity_rate: 28.8, flu_incidence: 18.2, vaccination_rate: 68.2, heart_disease_mortality: 155.8 } },
    PA: { name: "Pennsylvania", population: 13002700, metrics: { diabetes_prevalence: 10.2, obesity_rate: 31.2, flu_incidence: 23.5, vaccination_rate: 64.8, heart_disease_mortality: 195.2 } },
    RI: { name: "Rhode Island", population: 1097379, metrics: { diabetes_prevalence: 9.1, obesity_rate: 27.8, flu_incidence: 19.8, vaccination_rate: 76.2, heart_disease_mortality: 158.5 } },
    SC: { name: "South Carolina", population: 5118425, metrics: { diabetes_prevalence: 12.8, obesity_rate: 34.2, flu_incidence: 27.5, vaccination_rate: 52.5, heart_disease_mortality: 228.5 } },
    SD: { name: "South Dakota", population: 886667, metrics: { diabetes_prevalence: 9.5, obesity_rate: 30.5, flu_incidence: 21.5, vaccination_rate: 52.8, heart_disease_mortality: 178.5 } },
    TN: { name: "Tennessee", population: 6910840, metrics: { diabetes_prevalence: 13.5, obesity_rate: 35.8, flu_incidence: 28.2, vaccination_rate: 50.8, heart_disease_mortality: 238.5 } },
    TX: { name: "Texas", population: 29145505, metrics: { diabetes_prevalence: 12.1, obesity_rate: 34.8, flu_incidence: 26.5, vaccination_rate: 54.2, heart_disease_mortality: 195.8 } },
    UT: { name: "Utah", population: 3271616, metrics: { diabetes_prevalence: 7.8, obesity_rate: 25.2, flu_incidence: 16.5, vaccination_rate: 58.2, heart_disease_mortality: 142.5 } },
    VT: { name: "Vermont", population: 643077, metrics: { diabetes_prevalence: 8.2, obesity_rate: 27.2, flu_incidence: 17.5, vaccination_rate: 75.8, heart_disease_mortality: 155.2 } },
    VA: { name: "Virginia", population: 8631393, metrics: { diabetes_prevalence: 10.2, obesity_rate: 30.2, flu_incidence: 22.1, vaccination_rate: 65.8, heart_disease_mortality: 175.2 } },
    WA: { name: "Washington", population: 7614893, metrics: { diabetes_prevalence: 8.5, obesity_rate: 27.8, flu_incidence: 17.8, vaccination_rate: 70.5, heart_disease_mortality: 148.2 } },
    WV: { name: "West Virginia", population: 1793716, metrics: { diabetes_prevalence: 15.8, obesity_rate: 39.5, flu_incidence: 32.1, vaccination_rate: 45.2, heart_disease_mortality: 278.5 } },
    WI: { name: "Wisconsin", population: 5893718, metrics: { diabetes_prevalence: 9.2, obesity_rate: 31.2, flu_incidence: 22.5, vaccination_rate: 60.5, heart_disease_mortality: 178.5 } },
    WY: { name: "Wyoming", population: 576851, metrics: { diabetes_prevalence: 8.5, obesity_rate: 27.5, flu_incidence: 18.2, vaccination_rate: 48.5, heart_disease_mortality: 162.8 } },
    DC: { name: "District of Columbia", population: 689545, metrics: { diabetes_prevalence: 9.8, obesity_rate: 24.5, flu_incidence: 20.5, vaccination_rate: 78.8, heart_disease_mortality: 202.5 } },
  };

  return stateData;
}

function getAdaptiveDashboardConfig(condition: string, riskLevel: string) {
  const conditionConfigs: Record<string, any> = {
    diabetes: {
      title: "Diabetes Management Dashboard",
      primaryMetric: "HbA1c",
      widgets: [
        { type: "trend_chart", metric: "hba1c", title: "HbA1c Trend", priority: 1, data: generateMetricTrend(8.2, 6.8, 12) },
        { type: "gauge", metric: "glucose_fasting", title: "Fasting Glucose", priority: 2, value: 118, target: 100, max: 200, unit: "mg/dL" },
        { type: "bar_chart", metric: "medication_adherence", title: "Medication Adherence", priority: 3, data: generateAdherenceData() },
        { type: "stat_card", title: "A1c Change (90d)", value: -0.8, unit: "%", trend: "improving" },
        { type: "stat_card", title: "Hypoglycemic Events", value: 2, unit: "this month", trend: "stable" },
        { type: "stat_card", title: "Avg. Daily Glucose", value: 142, unit: "mg/dL", trend: "improving" },
        { type: "risk_factors", title: "Complication Risk", factors: [
          { name: "Retinopathy", risk: riskLevel === "high" ? 0.35 : 0.12, trend: "stable" },
          { name: "Nephropathy", risk: riskLevel === "high" ? 0.28 : 0.08, trend: "improving" },
          { name: "Neuropathy", risk: riskLevel === "high" ? 0.42 : 0.15, trend: "worsening" },
          { name: "Cardiovascular", risk: riskLevel === "high" ? 0.55 : 0.22, trend: "stable" },
        ]},
        { type: "pie_chart", title: "Time in Range", data: [
          { name: "In Range (70-180)", value: riskLevel === "high" ? 55 : 72, color: "#22c55e" },
          { name: "Above Range", value: riskLevel === "high" ? 35 : 20, color: "#f59e0b" },
          { name: "Below Range", value: riskLevel === "high" ? 10 : 8, color: "#ef4444" },
        ]},
      ],
      alerts: riskLevel === "high" ? [
        { severity: "warning", message: "HbA1c above target for 3+ months", action: "Consider medication adjustment" },
        { severity: "critical", message: "Hypoglycemic episode detected", action: "Review insulin dosing" },
      ] : [
        { severity: "info", message: "HbA1c trending toward target", action: "Continue current regimen" },
      ],
    },
    hypertension: {
      title: "Hypertension Management Dashboard",
      primaryMetric: "Blood Pressure",
      widgets: [
        { type: "trend_chart", metric: "blood_pressure", title: "Blood Pressure Trend", priority: 1, data: generateBPTrend(riskLevel) },
        { type: "gauge", metric: "systolic", title: "Latest Systolic", priority: 2, value: riskLevel === "high" ? 152 : 128, target: 120, max: 200, unit: "mmHg" },
        { type: "bar_chart", metric: "medication_adherence", title: "Medication Adherence", priority: 3, data: generateAdherenceData() },
        { type: "stat_card", title: "Avg. BP (30d)", value: riskLevel === "high" ? "148/92" : "126/82", unit: "mmHg", trend: riskLevel === "high" ? "worsening" : "improving" },
        { type: "stat_card", title: "Readings in Range", value: riskLevel === "high" ? 35 : 78, unit: "%", trend: riskLevel === "high" ? "worsening" : "stable" },
        { type: "stat_card", title: "Days Since Spike", value: riskLevel === "high" ? 3 : 28, unit: "days", trend: riskLevel === "high" ? "worsening" : "improving" },
        { type: "risk_factors", title: "Organ Damage Risk", factors: [
          { name: "Stroke", risk: riskLevel === "high" ? 0.45 : 0.12, trend: "stable" },
          { name: "Heart Failure", risk: riskLevel === "high" ? 0.38 : 0.10, trend: "improving" },
          { name: "Kidney Disease", risk: riskLevel === "high" ? 0.32 : 0.08, trend: "stable" },
          { name: "Vision Loss", risk: riskLevel === "high" ? 0.22 : 0.05, trend: "stable" },
        ]},
        { type: "area_chart", title: "Daily BP Distribution", data: generateBPDistribution(riskLevel) },
      ],
      alerts: riskLevel === "high" ? [
        { severity: "critical", message: "BP consistently above 140/90", action: "Urgent medication review needed" },
        { severity: "warning", message: "Missed 3 doses this week", action: "Set up medication reminders" },
      ] : [
        { severity: "info", message: "BP well controlled this month", action: "Continue monitoring" },
      ],
    },
    cardiac: {
      title: "Cardiac Health Dashboard",
      primaryMetric: "Heart Function",
      widgets: [
        { type: "trend_chart", metric: "heart_rate", title: "Resting Heart Rate", priority: 1, data: generateMetricTrend(82, 72, 12) },
        { type: "gauge", metric: "ejection_fraction", title: "Ejection Fraction", priority: 2, value: riskLevel === "high" ? 38 : 55, target: 55, max: 75, unit: "%" },
        { type: "stat_card", title: "Cholesterol (LDL)", value: riskLevel === "high" ? 165 : 95, unit: "mg/dL", trend: riskLevel === "high" ? "worsening" : "improving" },
        { type: "stat_card", title: "Steps/Day (avg)", value: riskLevel === "high" ? 3200 : 7800, unit: "steps", trend: "stable" },
        { type: "stat_card", title: "Exercise Minutes/Wk", value: riskLevel === "high" ? 45 : 150, unit: "min", trend: riskLevel === "high" ? "worsening" : "improving" },
        { type: "risk_factors", title: "Cardiac Risk Assessment", factors: [
          { name: "MI Risk (10yr)", risk: riskLevel === "high" ? 0.32 : 0.08, trend: "stable" },
          { name: "Arrhythmia", risk: riskLevel === "high" ? 0.25 : 0.05, trend: "stable" },
          { name: "Heart Failure", risk: riskLevel === "high" ? 0.42 : 0.12, trend: riskLevel === "high" ? "worsening" : "improving" },
        ]},
        { type: "bar_chart", metric: "exercise", title: "Weekly Exercise", priority: 4, data: generateExerciseData(riskLevel) },
      ],
      alerts: riskLevel === "high" ? [
        { severity: "critical", message: "Ejection fraction below 40%", action: "Cardiology follow-up recommended" },
        { severity: "warning", message: "Exercise goal not met", action: "Cardiac rehab referral" },
      ] : [],
    },
  };

  return conditionConfigs[condition] || conditionConfigs.diabetes;
}

function generateMetricTrend(startVal: number, endVal: number, points: number) {
  return Array.from({ length: points }, (_, i) => {
    const progress = i / (points - 1);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return {
      month: months[i % 12],
      value: parseFloat((startVal + (endVal - startVal) * progress + 0.2 * Math.sin(i * 0.8)).toFixed(1)),
    };
  });
}

function generateAdherenceData() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map(day => ({
    day,
    morning: Math.random() > 0.1 ? 100 : 0,
    evening: Math.random() > 0.15 ? 100 : 0,
  }));
}

function generateBPTrend(riskLevel: string) {
  return Array.from({ length: 12 }, (_, i) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const baseSystolic = riskLevel === "high" ? 155 : 135;
    const baseDiastolic = riskLevel === "high" ? 95 : 85;
    const improvement = riskLevel === "high" ? 0.3 : 0.8;
    return {
      month: months[i],
      systolic: Math.round(baseSystolic - improvement * i * 2 + 3 * Math.sin(i)),
      diastolic: Math.round(baseDiastolic - improvement * i + 2 * Math.sin(i * 0.7)),
      target_systolic: 120,
      target_diastolic: 80,
    };
  });
}

function generateBPDistribution(riskLevel: string) {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}:00`,
    systolic: Math.round((riskLevel === "high" ? 145 : 125) + 10 * Math.sin((i - 6) * Math.PI / 12) + Math.random() * 5),
    diastolic: Math.round((riskLevel === "high" ? 90 : 78) + 5 * Math.sin((i - 6) * Math.PI / 12) + Math.random() * 3),
  }));
}

function generateExerciseData(riskLevel: string) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map(day => ({
    day,
    minutes: Math.round((riskLevel === "high" ? 8 : 22) + Math.random() * (riskLevel === "high" ? 10 : 15)),
    target: 30,
  }));
}

export function registerAdvancedVisualizationRoutes(app: Express) {
  app.get("/api/benchmarks", (_req: Request, res: Response) => {
    try {
      const metric = _req.query.metric as string | undefined;
      if (metric && BENCHMARK_DATA[metric]) {
        res.json({ success: true, data: BENCHMARK_DATA[metric] });
      } else {
        const summary = Object.entries(BENCHMARK_DATA).map(([key, val]: [string, any]) => ({
          metric: key,
          label: val.label,
          unit: val.unit,
          latestValue: val.latestValue,
          populationMean: val.populationMean,
          percentile: val.percentile,
          trend: val.trend,
          riskLevel: val.riskLevel,
        }));
        res.json({ success: true, data: summary, metrics: Object.keys(BENCHMARK_DATA) });
      }
    } catch (error) {
      console.error("[Benchmarks] Error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch benchmark data" });
    }
  });

  app.get("/api/treatment-efficacy", (_req: Request, res: Response) => {
    try {
      const treatmentId = _req.query.treatmentId as string | undefined;
      if (treatmentId) {
        const treatment = TREATMENT_DATA.find(t => t.id === treatmentId);
        if (!treatment) {
          return res.status(404).json({ success: false, error: "Treatment not found" });
        }
        res.json({ success: true, data: treatment });
      } else {
        res.json({ success: true, data: TREATMENT_DATA });
      }
    } catch (error) {
      console.error("[TreatmentEfficacy] Error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch treatment data" });
    }
  });

  app.post("/api/treatment-efficacy/predict", async (req: Request, res: Response) => {
    try {
      const { treatmentId, weeksAhead = 12 } = req.body;
      const treatment = TREATMENT_DATA.find(t => t.id === treatmentId);
      if (!treatment) {
        return res.status(404).json({ success: false, error: "Treatment not found" });
      }

      const recentData = treatment.data.slice(-6);
      const prompt = `You are a clinical data analyst. Given this treatment data for ${treatment.name} treating ${treatment.condition}, predict the ${treatment.metric} values for the next ${weeksAhead} weeks.

Current data (last 6 readings):
${recentData.map(d => `Week ${d.week}: ${d.value} ${treatment.unit}, adherence: ${d.adherence}%`).join("\n")}

Target: ${treatment.targetValue} ${treatment.unit}

Return a JSON object with:
1. "predictions": array of objects with {week, value, lower_bound, upper_bound, confidence}
2. "summary": brief text summary of the prediction
3. "likelihood_of_target": percentage chance of reaching target
4. "recommended_adjustments": array of strings with recommendations

Return ONLY valid JSON, no markdown.`;

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        });

        const prediction = JSON.parse(completion.choices[0]?.message?.content || "{}");
        res.json({ success: true, data: { treatmentId, treatment: treatment.name, condition: treatment.condition, metric: treatment.metric, unit: treatment.unit, currentData: treatment.data, prediction } });
      } catch (aiError: any) {
        console.warn("[TreatmentEfficacy] AI prediction unavailable, using fallback:", aiError.message);
        const lastValue = recentData[recentData.length - 1].value;
        const trendSlope = (recentData[recentData.length - 1].value - recentData[0].value) / recentData.length;
        const lastWeek = treatment.data[treatment.data.length - 1].week;
        const fallbackPredictions = Array.from({ length: Math.ceil(weeksAhead / 2) }, (_, i) => {
          const week = lastWeek + (i + 1) * 2;
          const projectedValue = parseFloat((lastValue + trendSlope * (i + 1) * 0.8).toFixed(1));
          const uncertainty = 0.1 * (i + 1);
          return {
            week,
            value: projectedValue,
            lower_bound: parseFloat((projectedValue - Math.abs(projectedValue * uncertainty)).toFixed(1)),
            upper_bound: parseFloat((projectedValue + Math.abs(projectedValue * uncertainty)).toFixed(1)),
            confidence: parseFloat((0.95 - 0.05 * i).toFixed(2)),
          };
        });

        res.json({
          success: true,
          data: {
            treatmentId,
            treatment: treatment.name,
            condition: treatment.condition,
            metric: treatment.metric,
            unit: treatment.unit,
            currentData: treatment.data,
            prediction: {
              predictions: fallbackPredictions,
              summary: `Based on current trends, ${treatment.metric} is projected to ${trendSlope < 0 ? "continue improving" : "plateau"} over the next ${weeksAhead} weeks.`,
              likelihood_of_target: trendSlope < 0 ? 72 : 35,
              recommended_adjustments: ["Continue current medication regimen", "Maintain regular monitoring schedule", "Consider lifestyle modifications"],
            },
          },
        });
      }
    } catch (error) {
      console.error("[TreatmentEfficacy] Prediction error:", error);
      res.status(500).json({ success: false, error: "Failed to generate prediction" });
    }
  });

  app.get("/api/adaptive-dashboard", (_req: Request, res: Response) => {
    try {
      const condition = (_req.query.condition as string) || "diabetes";
      const riskLevel = (_req.query.riskLevel as string) || "moderate";
      const config = getAdaptiveDashboardConfig(condition, riskLevel);
      res.json({
        success: true,
        data: {
          ...config,
          condition,
          riskLevel,
          lastUpdated: new Date().toISOString(),
          availableConditions: ["diabetes", "hypertension", "cardiac"],
          availableRiskLevels: ["low", "moderate", "high"],
        },
      });
    } catch (error) {
      console.error("[AdaptiveDashboard] Error:", error);
      res.status(500).json({ success: false, error: "Failed to load adaptive dashboard" });
    }
  });

  app.get("/api/geospatial-insights", (_req: Request, res: Response) => {
    try {
      const metric = (_req.query.metric as string) || "diabetes_prevalence";
      const validMetrics = ["diabetes_prevalence", "obesity_rate", "flu_incidence", "vaccination_rate", "heart_disease_mortality"];
      if (!validMetrics.includes(metric)) {
        return res.status(400).json({ success: false, error: "Invalid metric", validMetrics });
      }

      const values = Object.values(GEOSPATIAL_DATA).map(s => s.metrics[metric]);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const max = Math.max(...values);
      const min = Math.min(...values);

      const stateResults = Object.entries(GEOSPATIAL_DATA).map(([code, data]) => ({
        stateCode: code,
        stateName: data.name,
        population: data.population,
        value: data.metrics[metric],
        allMetrics: data.metrics,
        relativeToNational: parseFloat(((data.metrics[metric] - mean) / mean * 100).toFixed(1)),
      }));

      const topStates = [...stateResults].sort((a, b) => b.value - a.value).slice(0, 10);
      const bottomStates = [...stateResults].sort((a, b) => a.value - b.value).slice(0, 10);

      const metricLabels: Record<string, { label: string; unit: string; description: string }> = {
        diabetes_prevalence: { label: "Diabetes Prevalence", unit: "%", description: "Percentage of adults diagnosed with diabetes" },
        obesity_rate: { label: "Obesity Rate", unit: "%", description: "Percentage of adults with BMI ≥ 30" },
        flu_incidence: { label: "Flu Incidence", unit: "per 1000", description: "Annual influenza cases per 1,000 population" },
        vaccination_rate: { label: "Vaccination Rate", unit: "%", description: "Percentage of population fully vaccinated" },
        heart_disease_mortality: { label: "Heart Disease Mortality", unit: "per 100k", description: "Annual heart disease deaths per 100,000 population" },
      };

      res.json({
        success: true,
        data: {
          metric,
          metricInfo: metricLabels[metric],
          national: { mean: parseFloat(mean.toFixed(1)), max: parseFloat(max.toFixed(1)), min: parseFloat(min.toFixed(1)) },
          states: stateResults,
          topStates,
          bottomStates,
          availableMetrics: validMetrics.map(m => ({ key: m, ...metricLabels[m] })),
          correlations: [
            { metric1: "obesity_rate", metric2: "diabetes_prevalence", correlation: 0.82, description: "Strong positive correlation" },
            { metric1: "vaccination_rate", metric2: "flu_incidence", correlation: -0.68, description: "Moderate negative correlation" },
            { metric1: "obesity_rate", metric2: "heart_disease_mortality", correlation: 0.75, description: "Strong positive correlation" },
          ],
        },
      });
    } catch (error) {
      console.error("[GeospatialInsights] Error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch geospatial data" });
    }
  });

  console.log("[Routes] Advanced Visualization routes registered:");
  console.log("[Routes]   GET  /api/benchmarks");
  console.log("[Routes]   GET  /api/treatment-efficacy");
  console.log("[Routes]   POST /api/treatment-efficacy/predict");
  console.log("[Routes]   GET  /api/adaptive-dashboard");
  console.log("[Routes]   GET  /api/geospatial-insights");
}
