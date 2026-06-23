// CDS-GATED — this service performs Clinical Decision Support (AI analysis of FHIR
// health data producing clinical insights/recommendations on what needs attention).
// DISABLED by default via the ENABLE_CDS kill-switch pending FDA Non-Device CDS
// determination + counsel review. NOT a NO-CDS claim.
// See _cds-gate.ts, NO-CDS-TRIAGE.md, ventures/tabula-medica/PHR-CDS-COUNSEL-BRIEF.md.
import OpenAI from "openai";
import { assertCdsEnabled } from "./_cds-gate";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (openaiClient) return openaiClient;
  
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  
  if (!apiKey || !baseURL) {
    console.log("[FHIRVisualization] OpenAI not configured, using mock data");
    return null;
  }
  
  openaiClient = new OpenAI({ apiKey, baseURL });
  return openaiClient;
}

export interface ChartRecommendation {
  id: string;
  chartType: "line" | "bar" | "pie" | "area" | "scatter" | "radar" | "gauge";
  title: string;
  description: string;
  dataSource: string;
  metrics: string[];
  priority: "high" | "medium" | "low";
  insight: string;
  reasoning: string;
}

export interface ObservationTrend {
  date: string;
  value: number;
  unit: string;
  status: "normal" | "low" | "high" | "critical";
  referenceRange?: { low: number; high: number };
}

export interface ConditionSummary {
  id: string;
  name: string;
  code: string;
  category: string;
  status: "active" | "resolved" | "inactive";
  onsetDate: string;
  severity: "mild" | "moderate" | "severe";
  relatedObservations: number;
}

export interface MedicationSummary {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  status: "active" | "completed" | "stopped";
  startDate: string;
  endDate?: string;
  adherenceRate: number;
  refillsRemaining: number;
}

export interface VisualizationData {
  observations: {
    byCategory: { category: string; count: number; trend: string }[];
    vitalsTrend: { date: string; bloodPressureSystolic: number; bloodPressureDiastolic: number; heartRate: number; temperature: number; weight: number }[];
    labResults: { name: string; value: number; unit: string; status: string; date: string }[];
  };
  conditions: {
    byStatus: { status: string; count: number }[];
    byCategory: { category: string; count: number }[];
    timeline: { date: string; newConditions: number; resolvedConditions: number }[];
    list: ConditionSummary[];
  };
  medications: {
    byStatus: { status: string; count: number }[];
    adherence: { month: string; rate: number }[];
    interactions: { medication1: string; medication2: string; severity: string; description: string }[];
    list: MedicationSummary[];
  };
  summary: {
    totalObservations: number;
    totalConditions: number;
    totalMedications: number;
    healthScore: number;
    riskLevel: "low" | "moderate" | "high";
    lastUpdated: string;
  };
}

function generateMockVisualizationData(patientId: string): VisualizationData {
  const now = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  
  return {
    observations: {
      byCategory: [
        { category: "Vital Signs", count: 45, trend: "stable" },
        { category: "Laboratory", count: 28, trend: "increasing" },
        { category: "Imaging", count: 12, trend: "stable" },
        { category: "Social History", count: 8, trend: "stable" },
        { category: "Physical Exam", count: 15, trend: "decreasing" },
      ],
      vitalsTrend: months.map((month, i) => ({
        date: month,
        bloodPressureSystolic: 115 + Math.floor(Math.random() * 20),
        bloodPressureDiastolic: 72 + Math.floor(Math.random() * 15),
        heartRate: 68 + Math.floor(Math.random() * 20),
        temperature: 98.2 + (Math.random() * 0.8 - 0.4),
        weight: 155 + Math.floor(Math.random() * 5),
      })),
      labResults: [
        { name: "Glucose", value: 95, unit: "mg/dL", status: "normal", date: "2024-01-15" },
        { name: "Hemoglobin A1c", value: 5.7, unit: "%", status: "normal", date: "2024-01-15" },
        { name: "Total Cholesterol", value: 195, unit: "mg/dL", status: "borderline", date: "2024-01-10" },
        { name: "LDL Cholesterol", value: 118, unit: "mg/dL", status: "borderline", date: "2024-01-10" },
        { name: "HDL Cholesterol", value: 58, unit: "mg/dL", status: "normal", date: "2024-01-10" },
        { name: "Triglycerides", value: 142, unit: "mg/dL", status: "normal", date: "2024-01-10" },
        { name: "Creatinine", value: 0.95, unit: "mg/dL", status: "normal", date: "2024-01-08" },
        { name: "eGFR", value: 92, unit: "mL/min", status: "normal", date: "2024-01-08" },
      ],
    },
    conditions: {
      byStatus: [
        { status: "Active", count: 4 },
        { status: "Resolved", count: 8 },
        { status: "Inactive", count: 2 },
      ],
      byCategory: [
        { category: "Cardiovascular", count: 3 },
        { category: "Metabolic", count: 2 },
        { category: "Respiratory", count: 1 },
        { category: "Musculoskeletal", count: 4 },
        { category: "Dermatological", count: 2 },
        { category: "Other", count: 2 },
      ],
      timeline: months.map((month, i) => ({
        date: month,
        newConditions: Math.floor(Math.random() * 3),
        resolvedConditions: Math.floor(Math.random() * 2),
      })),
      list: [
        { id: "cond-1", name: "Essential Hypertension", code: "I10", category: "Cardiovascular", status: "active", onsetDate: "2022-03-15", severity: "moderate", relatedObservations: 24 },
        { id: "cond-2", name: "Type 2 Diabetes Mellitus", code: "E11.9", category: "Metabolic", status: "active", onsetDate: "2021-08-20", severity: "mild", relatedObservations: 18 },
        { id: "cond-3", name: "Hyperlipidemia", code: "E78.5", category: "Metabolic", status: "active", onsetDate: "2023-01-10", severity: "mild", relatedObservations: 8 },
        { id: "cond-4", name: "Osteoarthritis", code: "M19.90", category: "Musculoskeletal", status: "active", onsetDate: "2020-11-05", severity: "moderate", relatedObservations: 12 },
      ],
    },
    medications: {
      byStatus: [
        { status: "Active", count: 5 },
        { status: "Completed", count: 12 },
        { status: "Stopped", count: 3 },
      ],
      adherence: months.map((month) => ({
        month,
        rate: 75 + Math.floor(Math.random() * 25),
      })),
      interactions: [
        { medication1: "Lisinopril", medication2: "Potassium Supplements", severity: "moderate", description: "May increase potassium levels" },
        { medication1: "Metformin", medication2: "Alcohol", severity: "high", description: "Increased risk of lactic acidosis" },
      ],
      list: [
        { id: "med-1", name: "Lisinopril", dosage: "10mg", frequency: "Once daily", status: "active", startDate: "2022-03-20", adherenceRate: 92, refillsRemaining: 3 },
        { id: "med-2", name: "Metformin", dosage: "500mg", frequency: "Twice daily", status: "active", startDate: "2021-08-25", adherenceRate: 88, refillsRemaining: 2 },
        { id: "med-3", name: "Atorvastatin", dosage: "20mg", frequency: "Once daily at bedtime", status: "active", startDate: "2023-01-15", adherenceRate: 95, refillsRemaining: 5 },
        { id: "med-4", name: "Aspirin", dosage: "81mg", frequency: "Once daily", status: "active", startDate: "2022-04-01", adherenceRate: 90, refillsRemaining: 6 },
        { id: "med-5", name: "Omeprazole", dosage: "20mg", frequency: "Once daily before breakfast", status: "active", startDate: "2023-06-10", adherenceRate: 85, refillsRemaining: 4 },
      ],
    },
    summary: {
      totalObservations: 108,
      totalConditions: 14,
      totalMedications: 20,
      healthScore: 78,
      riskLevel: "moderate",
      lastUpdated: now.toISOString(),
    },
  };
}

async function getAIChartRecommendations(data: VisualizationData): Promise<ChartRecommendation[]> {
  const client = getOpenAIClient();
  
  if (!client) {
    return getDefaultRecommendations(data);
  }
  
  try {
    const response = await client.chat.completions.create({
      model: "gpt-5.1",
      messages: [
        {
          role: "system",
          content: `You are a healthcare data visualization expert. Analyze patient health data and recommend the most effective chart types to visualize trends and insights. 
          
Focus on:
1. Identifying meaningful patterns in observations, conditions, and medications
2. Suggesting appropriate chart types (line, bar, pie, area, scatter, radar, gauge)
3. Prioritizing visualizations that provide actionable health insights
4. Considering data relationships and temporal trends

IMPORTANT: This is for data visualization purposes only. Do not provide medical advice or diagnoses.

Return a JSON array of recommendations with this structure:
{
  "recommendations": [
    {
      "id": "rec-1",
      "chartType": "line|bar|pie|area|scatter|radar|gauge",
      "title": "Chart title",
      "description": "Brief description",
      "dataSource": "observations|conditions|medications",
      "metrics": ["metric1", "metric2"],
      "priority": "high|medium|low",
      "insight": "Key insight this visualization reveals",
      "reasoning": "Why this chart type is recommended"
    }
  ]
}`
        },
        {
          role: "user",
          content: `Analyze this patient health data and recommend 5-7 visualizations:

Summary:
- Total Observations: ${data.summary.totalObservations}
- Total Conditions: ${data.summary.totalConditions}
- Total Medications: ${data.summary.totalMedications}
- Health Score: ${data.summary.healthScore}/100
- Risk Level: ${data.summary.riskLevel}

Observations by Category: ${JSON.stringify(data.observations.byCategory)}
Active Conditions: ${data.conditions.list.map(c => c.name).join(", ")}
Active Medications: ${data.medications.list.filter(m => m.status === "active").map(m => m.name).join(", ")}
Medication Adherence Trend: ${JSON.stringify(data.medications.adherence)}
Lab Results: ${data.observations.labResults.map(l => `${l.name}: ${l.value} ${l.unit} (${l.status})`).join(", ")}`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2000,
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      return getDefaultRecommendations(data);
    }
    
    const parsed = JSON.parse(content);
    return parsed.recommendations || getDefaultRecommendations(data);
  } catch (error) {
    console.error("[FHIRVisualization] AI recommendation error:", error);
    return getDefaultRecommendations(data);
  }
}

function getDefaultRecommendations(data: VisualizationData): ChartRecommendation[] {
  return [
    {
      id: "rec-1",
      chartType: "line",
      title: "Vital Signs Trend",
      description: "Track blood pressure, heart rate, and weight over time",
      dataSource: "observations",
      metrics: ["bloodPressure", "heartRate", "weight"],
      priority: "high",
      insight: "Monitor cardiovascular health indicators for early detection of changes",
      reasoning: "Line charts effectively show temporal patterns in continuous measurements",
    },
    {
      id: "rec-2",
      chartType: "bar",
      title: "Lab Results Comparison",
      description: "Compare current lab values against reference ranges",
      dataSource: "observations",
      metrics: ["labValues", "referenceRanges"],
      priority: "high",
      insight: "Quickly identify out-of-range lab values requiring attention",
      reasoning: "Bar charts with reference lines clearly show values relative to normal ranges",
    },
    {
      id: "rec-3",
      chartType: "pie",
      title: "Conditions by Category",
      description: "Distribution of health conditions by medical category",
      dataSource: "conditions",
      metrics: ["conditionCategories"],
      priority: "medium",
      insight: "Understand the primary health focus areas",
      reasoning: "Pie charts show proportional distribution of categorical data",
    },
    {
      id: "rec-4",
      chartType: "area",
      title: "Medication Adherence",
      description: "Track medication compliance over time",
      dataSource: "medications",
      metrics: ["adherenceRate"],
      priority: "high",
      insight: "Identify patterns in medication compliance for intervention",
      reasoning: "Area charts emphasize cumulative trends and changes in adherence",
    },
    {
      id: "rec-5",
      chartType: "gauge",
      title: "Overall Health Score",
      description: "Visual indicator of current health status",
      dataSource: "observations",
      metrics: ["healthScore"],
      priority: "medium",
      insight: `Current health score: ${data.summary.healthScore}/100`,
      reasoning: "Gauge charts provide instant visual feedback on a single key metric",
    },
    {
      id: "rec-6",
      chartType: "scatter",
      title: "Condition-Observation Correlation",
      description: "Relationship between conditions and related observations",
      dataSource: "conditions",
      metrics: ["conditions", "observations"],
      priority: "low",
      insight: "Discover correlations between health conditions and test results",
      reasoning: "Scatter plots reveal relationships between two variables",
    },
  ];
}

export const fhirVisualizationService = {
  getVisualizationData(patientId: string): VisualizationData {
    console.log(`[HIPAA-AUDIT][FHIRVisualization] Fetching visualization data for patient: ${patientId}`);
    return generateMockVisualizationData(patientId);
  },
  
  async getChartRecommendations(patientId: string): Promise<ChartRecommendation[]> {
    assertCdsEnabled("fhir-visualization-service.getChartRecommendations");
    console.log(`[HIPAA-AUDIT][FHIRVisualization] Generating AI chart recommendations for patient: ${patientId}`);
    const data = this.getVisualizationData(patientId);
    return await getAIChartRecommendations(data);
  },
  
  getObservationTrends(patientId: string, observationType: string): ObservationTrend[] {
    console.log(`[HIPAA-AUDIT][FHIRVisualization] Fetching ${observationType} trends for patient: ${patientId}`);
    
    const baseValues: Record<string, { base: number; unit: string; range: { low: number; high: number } }> = {
      "blood-pressure-systolic": { base: 120, unit: "mmHg", range: { low: 90, high: 140 } },
      "blood-pressure-diastolic": { base: 80, unit: "mmHg", range: { low: 60, high: 90 } },
      "heart-rate": { base: 72, unit: "bpm", range: { low: 60, high: 100 } },
      "glucose": { base: 95, unit: "mg/dL", range: { low: 70, high: 100 } },
      "weight": { base: 155, unit: "lbs", range: { low: 130, high: 180 } },
      "temperature": { base: 98.6, unit: "°F", range: { low: 97, high: 99 } },
    };
    
    const config = baseValues[observationType] || { base: 100, unit: "units", range: { low: 80, high: 120 } };
    const trends: ObservationTrend[] = [];
    
    for (let i = 30; i >= 0; i -= 5) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const variance = (Math.random() - 0.5) * 20;
      const value = Math.round((config.base + variance) * 10) / 10;
      
      let status: ObservationTrend["status"] = "normal";
      if (value < config.range.low * 0.9 || value > config.range.high * 1.1) {
        status = "critical";
      } else if (value < config.range.low || value > config.range.high) {
        status = value < config.range.low ? "low" : "high";
      }
      
      trends.push({
        date: date.toISOString().split("T")[0],
        value,
        unit: config.unit,
        status,
        referenceRange: config.range,
      });
    }
    
    return trends;
  },
  
  getConditionSummaries(patientId: string): ConditionSummary[] {
    console.log(`[HIPAA-AUDIT][FHIRVisualization] Fetching condition summaries for patient: ${patientId}`);
    const data = this.getVisualizationData(patientId);
    return data.conditions.list;
  },
  
  getMedicationSummaries(patientId: string): MedicationSummary[] {
    console.log(`[HIPAA-AUDIT][FHIRVisualization] Fetching medication summaries for patient: ${patientId}`);
    const data = this.getVisualizationData(patientId);
    return data.medications.list;
  },
};
