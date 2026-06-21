import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const NO_CDS_DISCLAIMER = "IMPORTANT: This report is for INFORMATIONAL and EDUCATIONAL purposes only. It does NOT constitute medical advice, diagnosis, or clinical decision support. All healthcare decisions must be made by qualified healthcare providers.";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ================== Types ==================

export type DataSourceType = 
  | "patient_demographics"
  | "clinical_events"
  | "lab_results"
  | "medications"
  | "vital_signs"
  | "diagnoses"
  | "procedures"
  | "appointments"
  | "ai_insights"
  | "workflow_metrics"
  | "risk_scores"
  | "care_plans"
  | "immunizations"
  | "allergies";

export type ChartType = "line" | "bar" | "pie" | "area" | "scatter" | "heatmap" | "table";

export type ReportFrequency = "once" | "daily" | "weekly" | "biweekly" | "monthly" | "quarterly";

export type ExportFormat = "pdf" | "csv" | "json" | "excel";

export interface DataPointConfig {
  id: string;
  source: DataSourceType;
  field: string;
  aggregation: "count" | "sum" | "avg" | "min" | "max" | "latest" | "first" | "list";
  label: string;
  filter?: Record<string, any>;
}

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  dataPoints: string[]; // IDs of DataPointConfigs
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
  sortBy?: string;
  limit?: number;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  dataPoints: DataPointConfig[];
  charts: ChartConfig[];
  sections: ReportSection[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  tags: string[];
}

export interface ReportSection {
  id: string;
  title: string;
  type: "summary" | "chart" | "table" | "metrics" | "text" | "ai_analysis";
  chartId?: string;
  dataPointIds?: string[];
  content?: string;
  order: number;
}

export interface ScheduledReport {
  id: string;
  templateId: string;
  name: string;
  frequency: ReportFrequency;
  nextRunAt: string;
  lastRunAt?: string;
  recipients: string[];
  exportFormat: ExportFormat;
  dateRangeType: "last_7_days" | "last_30_days" | "last_90_days" | "last_year" | "custom" | "all_time";
  customStartDate?: string;
  customEndDate?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  filters?: Record<string, any>;
}

export interface GeneratedReport {
  id: string;
  templateId: string;
  scheduledReportId?: string;
  name: string;
  generatedAt: string;
  generatedBy: string;
  dateRange: { start: string; end: string };
  data: ReportData;
  exportFormat: ExportFormat;
  fileUrl?: string;
  status: "pending" | "generating" | "completed" | "failed";
  error?: string;
}

export interface ReportData {
  summary: ReportSummary;
  sections: GeneratedSection[];
  trends: TrendData[];
  forecasts: ForecastData[];
  aiInsights: AIInsight[];
  noCdsDisclaimer: string;
}

export interface ReportSummary {
  totalRecords: number;
  dateRange: { start: string; end: string };
  highlights: { label: string; value: string | number; trend?: "up" | "down" | "stable" }[];
  generatedAt: string;
}

export interface GeneratedSection {
  id: string;
  title: string;
  type: string;
  data: any;
  chartData?: any;
}

export interface TrendData {
  id: string;
  metric: string;
  dataPoints: { date: string; value: number }[];
  changePercent: number;
  trend: "increasing" | "decreasing" | "stable" | "fluctuating";
  periodComparison: {
    current: number;
    previous: number;
    percentChange: number;
  };
}

export interface ForecastData {
  id: string;
  metric: string;
  historicalData: { date: string; value: number }[];
  predictions: { date: string; value: number; confidenceLow: number; confidenceHigh: number }[];
  methodology: string;
  accuracy: number;
  nextPeriodPrediction: {
    value: number;
    confidence: number;
    range: { low: number; high: number };
  };
}

export interface AIInsight {
  id: string;
  title: string;
  content: string;
  category: string;
  severity: "info" | "warning" | "critical";
  recommendations: string[];
  dataSource: string;
  generatedAt: string;
}

export interface AnalyticsDashboard {
  id: string;
  name: string;
  widgets: DashboardWidget[];
  filters: DashboardFilter[];
  dateRange: { start: string; end: string };
  refreshInterval?: number;
  createdBy: string;
  createdAt: string;
  isDefault: boolean;
}

export interface DashboardWidget {
  id: string;
  type: "metric" | "chart" | "table" | "trend" | "forecast" | "ai_summary";
  title: string;
  dataSource: DataSourceType;
  config: Record<string, any>;
  position: { x: number; y: number; w: number; h: number };
}

// ================== Enhanced Visualization Types ==================

export interface InteractiveTrendData {
  id: string;
  metric: string;
  metricLabel: string;
  category: string;
  dataPoints: { date: string; value: number; label?: string }[];
  annotations: { date: string; label: string; type: "event" | "milestone" | "alert" }[];
  statistics: {
    min: number;
    max: number;
    avg: number;
    median: number;
    stdDev: number;
    percentile90: number;
  };
  trendLine: { slope: number; intercept: number; rSquared: number };
  forecast?: { date: string; value: number; confidenceLow: number; confidenceHigh: number }[];
}

export interface HeatmapData {
  id: string;
  title: string;
  description: string;
  xAxisLabel: string;
  yAxisLabel: string;
  xCategories: string[];
  yCategories: string[];
  cells: { x: number; y: number; value: number; label?: string; count?: number }[];
  colorScale: { min: number; max: number; minColor: string; maxColor: string };
  aggregationType: "count" | "average" | "sum" | "percentage";
}

export interface CohortDefinition {
  id: string;
  name: string;
  description: string;
  criteria: CohortCriteria[];
  createdBy: string;
  createdAt: string;
  patientCount: number;
  isActive: boolean;
}

export interface CohortCriteria {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "between" | "in";
  value: string | number | string[] | number[];
  logicalOperator?: "AND" | "OR";
}

export interface CohortAnalysisResult {
  id: string;
  cohorts: {
    cohortId: string;
    cohortName: string;
    patientCount: number;
    metrics: { metric: string; value: number; trend: string }[];
  }[];
  comparisons: {
    metric: string;
    cohortValues: { cohortId: string; value: number; percentile: number }[];
    significanceLevel: number;
    isSignificant: boolean;
  }[];
  timeSeriesComparison: {
    metric: string;
    cohortData: { cohortId: string; dataPoints: { date: string; value: number }[] }[];
  }[];
  aiInsights: string[];
  noCdsDisclaimer: string;
  generatedAt: string;
}

export interface CustomDashboardView {
  id: string;
  name: string;
  description: string;
  stakeholderType: "administrator" | "clinician" | "analyst" | "executive" | "care_coordinator" | "custom";
  layout: DashboardLayout;
  widgets: CustomWidget[];
  filters: SavedFilter[];
  theme: "light" | "dark" | "system";
  refreshInterval: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
  isShared: boolean;
  sharedWith: string[];
}

export interface DashboardLayout {
  columns: number;
  rowHeight: number;
  gap: number;
  responsive: boolean;
}

export interface CustomWidget {
  id: string;
  type: "trend_graph" | "heatmap" | "kpi_card" | "cohort_chart" | "table" | "pie_chart" | "bar_chart" | "area_chart" | "gauge" | "text_box";
  title: string;
  dataSource: string;
  config: Record<string, any>;
  position: { x: number; y: number; width: number; height: number };
  refreshInterval?: number;
  drilldownEnabled: boolean;
}

export interface SavedFilter {
  id: string;
  name: string;
  field: string;
  operator: string;
  value: any;
  isActive: boolean;
}

export interface DashboardFilter {
  id: string;
  field: string;
  label: string;
  type: "date_range" | "select" | "multi_select" | "text" | "number_range";
  options?: string[];
  defaultValue?: any;
}

// ================== Enhanced KPI Types ==================

export interface KPIDefinition {
  id: string;
  name: string;
  description: string;
  category: "clinical" | "operational" | "financial" | "patient_satisfaction" | "resource";
  metric: string;
  unit: string;
  target?: number;
  threshold?: { warning: number; critical: number };
  format: "number" | "percentage" | "currency" | "duration";
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
}

export interface KPIDashboardConfig {
  id: string;
  name: string;
  description: string;
  kpis: string[]; // KPI IDs
  layout: "grid" | "list" | "compact";
  refreshInterval: number;
  dateRange: string;
  createdBy: string;
  createdAt: string;
  isDefault: boolean;
}

export interface KPIValue {
  kpiId: string;
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: "up" | "down" | "stable";
  status: "on_track" | "warning" | "critical";
  lastUpdated: string;
}

// ================== Predictive Analytics Types ==================

export interface RiskStratificationResult {
  patientId: string;
  patientName: string;
  overallRiskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskFactors: {
    factor: string;
    contribution: number;
    description: string;
  }[];
  predictedEvents: {
    event: string;
    probability: number;
    timeframe: string;
    preventable: boolean;
  }[];
  recommendations: string[];
  lastAssessment: string;
  noCdsDisclaimer: string;
}

export interface ResourceForecast {
  id: string;
  resourceType: "staff" | "beds" | "equipment" | "appointments" | "budget";
  resourceName: string;
  currentCapacity: number;
  currentUtilization: number;
  predictions: {
    date: string;
    predictedDemand: number;
    confidenceLow: number;
    confidenceHigh: number;
    utilization: number;
  }[];
  recommendations: string[];
  alertLevel: "normal" | "elevated" | "high";
  noCdsDisclaimer: string;
}

// ================== Performance Report Types ==================

export interface ClinicalOutcomesReport {
  id: string;
  period: { start: string; end: string };
  metrics: {
    readmissionRate: number;
    readmissionTarget: number;
    averageLengthOfStay: number;
    mortalityRate: number;
    infectionRate: number;
    patientFallRate: number;
    medicationErrorRate: number;
    careGapsClosed: number;
    preventiveServicesCompliance: number;
  };
  trends: {
    metric: string;
    values: { date: string; value: number }[];
    trend: "improving" | "worsening" | "stable";
  }[];
  aiInsights: string[];
  noCdsDisclaimer: string;
  generatedAt: string;
}

export interface PatientSatisfactionReport {
  id: string;
  period: { start: string; end: string };
  overallScore: number;
  npsScore: number;
  responseRate: number;
  totalResponses: number;
  categoryScores: {
    category: string;
    score: number;
    previousScore: number;
    trend: "up" | "down" | "stable";
  }[];
  topStrengths: string[];
  areasForImprovement: string[];
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  keyThemes: { theme: string; count: number; sentiment: string }[];
  aiInsights: string[];
  noCdsDisclaimer: string;
  generatedAt: string;
}

export interface OperationalCostsReport {
  id: string;
  period: { start: string; end: string };
  totalCosts: number;
  budgetVariance: number;
  costBreakdown: {
    category: string;
    amount: number;
    percentOfTotal: number;
    budgeted: number;
    variance: number;
  }[];
  costPerPatient: number;
  costPerVisit: number;
  revenueRecovery: number;
  efficiencyMetrics: {
    metric: string;
    value: number;
    benchmark: number;
    status: "above" | "at" | "below";
  }[];
  savingsOpportunities: {
    area: string;
    potentialSavings: number;
    difficulty: "easy" | "medium" | "hard";
    recommendation: string;
  }[];
  aiInsights: string[];
  noCdsDisclaimer: string;
  generatedAt: string;
}

// ================== Export Types ==================

export interface ExportJob {
  id: string;
  type: "report" | "dashboard" | "raw_data" | "analytics";
  format: ExportFormat;
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  sourceId: string;
  sourceName: string;
  filters?: Record<string, any>;
  dateRange?: { start: string; end: string };
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
  fileSize?: number;
  error?: string;
}

// ================== Storage ==================

const reportTemplates = new Map<string, ReportTemplate>();
const scheduledReports = new Map<string, ScheduledReport>();
const generatedReports = new Map<string, GeneratedReport>();
const analyticsDashboards = new Map<string, AnalyticsDashboard>();
const kpiDefinitions = new Map<string, KPIDefinition>();
const kpiDashboardConfigs = new Map<string, KPIDashboardConfig>();
const exportJobs = new Map<string, ExportJob>();
const cohortDefinitions = new Map<string, CohortDefinition>();
const customDashboardViews = new Map<string, CustomDashboardView>();

// ================== Sample Data ==================

const SAMPLE_PATIENT_DEMOGRAPHICS = [
  { id: "p1", name: "John Smith", age: 62, gender: "male", conditions: ["diabetes", "hypertension"], riskLevel: "high" },
  { id: "p2", name: "Mary Johnson", age: 45, gender: "female", conditions: ["asthma"], riskLevel: "low" },
  { id: "p3", name: "Robert Davis", age: 78, gender: "male", conditions: ["heart_disease", "diabetes"], riskLevel: "critical" },
  { id: "p4", name: "Sarah Wilson", age: 55, gender: "female", conditions: ["hypertension"], riskLevel: "medium" },
  { id: "p5", name: "James Brown", age: 34, gender: "male", conditions: [], riskLevel: "low" },
];

const SAMPLE_CLINICAL_EVENTS = [
  { id: "e1", patientId: "p1", type: "lab_result", date: "2026-01-20", description: "HbA1c test", value: 7.2 },
  { id: "e2", patientId: "p1", type: "visit", date: "2026-01-18", description: "Follow-up appointment" },
  { id: "e3", patientId: "p3", type: "alert", date: "2026-01-22", description: "High risk flag triggered" },
  { id: "e4", patientId: "p2", type: "prescription", date: "2026-01-15", description: "Inhaler refill" },
  { id: "e5", patientId: "p4", type: "lab_result", date: "2026-01-19", description: "Blood pressure reading", value: 145 },
];

const SAMPLE_WORKFLOW_METRICS = {
  totalWorkflows: 156,
  activeWorkflows: 23,
  completedToday: 12,
  averageCompletionTime: 4.5,
  tasksByPriority: { critical: 5, high: 12, medium: 28, low: 15 },
  completionRate: 0.87,
};

function initializeSampleData() {
  // Sample Report Template: Patient Demographics Overview
  const demographicsTemplate: ReportTemplate = {
    id: "template_demographics_1",
    name: "Patient Demographics Overview",
    description: "Comprehensive view of patient population demographics and risk distribution",
    category: "Population Health",
    dataPoints: [
      { id: "dp_1", source: "patient_demographics", field: "total_patients", aggregation: "count", label: "Total Patients" },
      { id: "dp_2", source: "patient_demographics", field: "age", aggregation: "avg", label: "Average Age" },
      { id: "dp_3", source: "risk_scores", field: "risk_level", aggregation: "count", label: "Risk Distribution" },
      { id: "dp_4", source: "diagnoses", field: "condition", aggregation: "count", label: "Top Conditions" },
    ],
    charts: [
      { id: "chart_1", type: "pie", title: "Risk Level Distribution", dataPoints: ["dp_3"], groupBy: "risk_level" },
      { id: "chart_2", type: "bar", title: "Age Distribution", dataPoints: ["dp_2"], groupBy: "age_group" },
      { id: "chart_3", type: "bar", title: "Top Conditions", dataPoints: ["dp_4"], sortBy: "count", limit: 10 },
    ],
    sections: [
      { id: "sec_1", title: "Executive Summary", type: "summary", dataPointIds: ["dp_1", "dp_2"], order: 1 },
      { id: "sec_2", title: "Risk Distribution", type: "chart", chartId: "chart_1", order: 2 },
      { id: "sec_3", title: "Demographics Analysis", type: "chart", chartId: "chart_2", order: 3 },
      { id: "sec_4", title: "Condition Prevalence", type: "chart", chartId: "chart_3", order: 4 },
      { id: "sec_5", title: "AI-Generated Insights", type: "ai_analysis", order: 5 },
    ],
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPublic: true,
    tags: ["demographics", "population", "risk"],
  };
  reportTemplates.set(demographicsTemplate.id, demographicsTemplate);

  // Sample Report Template: Clinical Workflow Analytics
  const workflowTemplate: ReportTemplate = {
    id: "template_workflow_1",
    name: "Clinical Workflow Analytics",
    description: "Analysis of workflow performance, task completion, and operational efficiency",
    category: "Operations",
    dataPoints: [
      { id: "dp_w1", source: "workflow_metrics", field: "total_workflows", aggregation: "count", label: "Total Workflows" },
      { id: "dp_w2", source: "workflow_metrics", field: "completion_time", aggregation: "avg", label: "Avg Completion Time" },
      { id: "dp_w3", source: "workflow_metrics", field: "completion_rate", aggregation: "avg", label: "Completion Rate" },
      { id: "dp_w4", source: "workflow_metrics", field: "tasks_by_priority", aggregation: "count", label: "Tasks by Priority" },
    ],
    charts: [
      { id: "chart_w1", type: "line", title: "Workflow Volume Over Time", dataPoints: ["dp_w1"], xAxis: "date" },
      { id: "chart_w2", type: "bar", title: "Tasks by Priority", dataPoints: ["dp_w4"], groupBy: "priority" },
      { id: "chart_w3", type: "area", title: "Completion Rate Trend", dataPoints: ["dp_w3"], xAxis: "date" },
    ],
    sections: [
      { id: "sec_w1", title: "Performance Summary", type: "metrics", dataPointIds: ["dp_w1", "dp_w2", "dp_w3"], order: 1 },
      { id: "sec_w2", title: "Volume Trends", type: "chart", chartId: "chart_w1", order: 2 },
      { id: "sec_w3", title: "Priority Distribution", type: "chart", chartId: "chart_w2", order: 3 },
      { id: "sec_w4", title: "Efficiency Analysis", type: "ai_analysis", order: 4 },
    ],
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPublic: true,
    tags: ["workflow", "operations", "efficiency"],
  };
  reportTemplates.set(workflowTemplate.id, workflowTemplate);

  // Sample Report Template: AI Insights Summary
  const aiInsightsTemplate: ReportTemplate = {
    id: "template_ai_insights_1",
    name: "AI Insights and Predictions",
    description: "Summary of AI-generated patient insights, risk predictions, and recommendations",
    category: "AI Analytics",
    dataPoints: [
      { id: "dp_ai1", source: "ai_insights", field: "total_insights", aggregation: "count", label: "Total Insights Generated" },
      { id: "dp_ai2", source: "risk_scores", field: "predictions", aggregation: "count", label: "Risk Predictions" },
      { id: "dp_ai3", source: "care_plans", field: "recommendations", aggregation: "count", label: "Care Recommendations" },
    ],
    charts: [
      { id: "chart_ai1", type: "line", title: "Insights Generated Over Time", dataPoints: ["dp_ai1"], xAxis: "date" },
      { id: "chart_ai2", type: "pie", title: "Insight Categories", dataPoints: ["dp_ai1"], groupBy: "category" },
    ],
    sections: [
      { id: "sec_ai1", title: "AI Activity Overview", type: "summary", dataPointIds: ["dp_ai1", "dp_ai2", "dp_ai3"], order: 1 },
      { id: "sec_ai2", title: "Insight Trends", type: "chart", chartId: "chart_ai1", order: 2 },
      { id: "sec_ai3", title: "Key Findings", type: "ai_analysis", order: 3 },
    ],
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPublic: true,
    tags: ["ai", "insights", "predictions"],
  };
  reportTemplates.set(aiInsightsTemplate.id, aiInsightsTemplate);

  // Sample Scheduled Report
  const scheduledReport: ScheduledReport = {
    id: "sched_1",
    templateId: "template_demographics_1",
    name: "Weekly Demographics Report",
    frequency: "weekly",
    nextRunAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    recipients: ["admin@tabulamedica.health", "reports@tabulamedica.health"],
    exportFormat: "pdf",
    dateRangeType: "last_7_days",
    isActive: true,
    createdBy: "system",
    createdAt: new Date().toISOString(),
  };
  scheduledReports.set(scheduledReport.id, scheduledReport);

  // Sample Default Dashboard
  const defaultDashboard: AnalyticsDashboard = {
    id: "dashboard_default",
    name: "Executive Overview",
    widgets: [
      { id: "w1", type: "metric", title: "Total Patients", dataSource: "patient_demographics", config: { metric: "count" }, position: { x: 0, y: 0, w: 3, h: 1 } },
      { id: "w2", type: "metric", title: "High Risk Patients", dataSource: "risk_scores", config: { metric: "high_risk_count" }, position: { x: 3, y: 0, w: 3, h: 1 } },
      { id: "w3", type: "metric", title: "Active Workflows", dataSource: "workflow_metrics", config: { metric: "active_count" }, position: { x: 6, y: 0, w: 3, h: 1 } },
      { id: "w4", type: "metric", title: "AI Insights Today", dataSource: "ai_insights", config: { metric: "today_count" }, position: { x: 9, y: 0, w: 3, h: 1 } },
      { id: "w5", type: "chart", title: "Patient Risk Distribution", dataSource: "risk_scores", config: { chartType: "pie", groupBy: "risk_level" }, position: { x: 0, y: 1, w: 6, h: 3 } },
      { id: "w6", type: "trend", title: "Clinical Events Trend", dataSource: "clinical_events", config: { period: "30_days" }, position: { x: 6, y: 1, w: 6, h: 3 } },
      { id: "w7", type: "forecast", title: "Workload Forecast", dataSource: "workflow_metrics", config: { forecastDays: 14 }, position: { x: 0, y: 4, w: 6, h: 3 } },
      { id: "w8", type: "ai_summary", title: "AI Analysis Summary", dataSource: "ai_insights", config: { limit: 5 }, position: { x: 6, y: 4, w: 6, h: 3 } },
    ],
    filters: [
      { id: "f1", field: "date_range", label: "Date Range", type: "date_range", defaultValue: "last_30_days" },
      { id: "f2", field: "risk_level", label: "Risk Level", type: "multi_select", options: ["low", "medium", "high", "critical"] },
      { id: "f3", field: "department", label: "Department", type: "select", options: ["All", "Cardiology", "Endocrinology", "Primary Care", "Oncology"] },
    ],
    dateRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), end: new Date().toISOString() },
    refreshInterval: 300000,
    createdBy: "system",
    createdAt: new Date().toISOString(),
    isDefault: true,
  };
  analyticsDashboards.set(defaultDashboard.id, defaultDashboard);

  // Sample KPI Definitions
  const sampleKPIs: KPIDefinition[] = [
    { id: "kpi_readmission", name: "30-Day Readmission Rate", description: "Percentage of patients readmitted within 30 days", category: "clinical", metric: "readmission_rate", unit: "%", target: 12, threshold: { warning: 15, critical: 20 }, format: "percentage", isActive: true, displayOrder: 1, createdAt: new Date().toISOString() },
    { id: "kpi_los", name: "Average Length of Stay", description: "Average days per patient admission", category: "clinical", metric: "avg_los", unit: "days", target: 4.5, threshold: { warning: 5.5, critical: 7 }, format: "number", isActive: true, displayOrder: 2, createdAt: new Date().toISOString() },
    { id: "kpi_satisfaction", name: "Patient Satisfaction Score", description: "Overall patient satisfaction rating", category: "patient_satisfaction", metric: "satisfaction_score", unit: "/5", target: 4.5, threshold: { warning: 3.5, critical: 3.0 }, format: "number", isActive: true, displayOrder: 3, createdAt: new Date().toISOString() },
    { id: "kpi_nps", name: "Net Promoter Score", description: "Patient likelihood to recommend", category: "patient_satisfaction", metric: "nps", unit: "pts", target: 50, threshold: { warning: 30, critical: 0 }, format: "number", isActive: true, displayOrder: 4, createdAt: new Date().toISOString() },
    { id: "kpi_wait_time", name: "Average Wait Time", description: "Average patient wait time in minutes", category: "operational", metric: "avg_wait_time", unit: "min", target: 15, threshold: { warning: 25, critical: 45 }, format: "duration", isActive: true, displayOrder: 5, createdAt: new Date().toISOString() },
    { id: "kpi_bed_utilization", name: "Bed Utilization Rate", description: "Percentage of beds occupied", category: "resource", metric: "bed_utilization", unit: "%", target: 85, threshold: { warning: 95, critical: 100 }, format: "percentage", isActive: true, displayOrder: 6, createdAt: new Date().toISOString() },
    { id: "kpi_staff_ratio", name: "Staff-to-Patient Ratio", description: "Number of patients per staff member", category: "resource", metric: "staff_ratio", unit: ":1", target: 4, threshold: { warning: 6, critical: 8 }, format: "number", isActive: true, displayOrder: 7, createdAt: new Date().toISOString() },
    { id: "kpi_cost_per_patient", name: "Cost Per Patient", description: "Average cost per patient visit", category: "financial", metric: "cost_per_patient", unit: "$", target: 850, threshold: { warning: 1000, critical: 1200 }, format: "currency", isActive: true, displayOrder: 8, createdAt: new Date().toISOString() },
    { id: "kpi_revenue_cycle", name: "Revenue Cycle Days", description: "Days to collect payment", category: "financial", metric: "revenue_cycle_days", unit: "days", target: 35, threshold: { warning: 45, critical: 60 }, format: "number", isActive: true, displayOrder: 9, createdAt: new Date().toISOString() },
    { id: "kpi_appointment_fill", name: "Appointment Fill Rate", description: "Percentage of available appointments filled", category: "operational", metric: "appointment_fill_rate", unit: "%", target: 90, threshold: { warning: 75, critical: 60 }, format: "percentage", isActive: true, displayOrder: 10, createdAt: new Date().toISOString() },
  ];
  sampleKPIs.forEach(kpi => kpiDefinitions.set(kpi.id, kpi));

  // Sample KPI Dashboard Config
  const defaultKPIDashboard: KPIDashboardConfig = {
    id: "kpi_dash_default",
    name: "Executive KPI Dashboard",
    description: "Key performance indicators for executive overview",
    kpis: ["kpi_readmission", "kpi_satisfaction", "kpi_nps", "kpi_wait_time", "kpi_bed_utilization", "kpi_cost_per_patient"],
    layout: "grid",
    refreshInterval: 300000,
    dateRange: "last_30_days",
    createdBy: "system",
    createdAt: new Date().toISOString(),
    isDefault: true,
  };
  kpiDashboardConfigs.set(defaultKPIDashboard.id, defaultKPIDashboard);

  console.log("[AdvancedReporting] Sample data initialized");
  console.log("[AdvancedReporting] KPIs initialized:", kpiDefinitions.size);
  console.log("[AdvancedReporting] Features: Customizable KPIs, Predictive Analytics, Performance Reports, Data Export");
}

// ================== Core Service Functions ==================

function generateTrendData(metric: string, days: number = 30): TrendData {
  const dataPoints: { date: string; value: number }[] = [];
  let baseValue = Math.floor(Math.random() * 100) + 50;
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    baseValue += (Math.random() - 0.5) * 10;
    dataPoints.push({
      date: date.toISOString().split("T")[0],
      value: Math.max(0, Math.round(baseValue)),
    });
  }

  const midpoint = Math.floor(dataPoints.length / 2);
  const firstHalf = dataPoints.slice(0, midpoint).reduce((sum, dp) => sum + dp.value, 0) / midpoint;
  const secondHalf = dataPoints.slice(midpoint).reduce((sum, dp) => sum + dp.value, 0) / (dataPoints.length - midpoint);
  const changePercent = ((secondHalf - firstHalf) / firstHalf) * 100;

  let trend: TrendData["trend"] = "stable";
  if (changePercent > 5) trend = "increasing";
  else if (changePercent < -5) trend = "decreasing";
  else if (Math.abs(changePercent) > 2) trend = "fluctuating";

  return {
    id: generateId("trend"),
    metric,
    dataPoints,
    changePercent: Math.round(changePercent * 10) / 10,
    trend,
    periodComparison: {
      current: Math.round(secondHalf),
      previous: Math.round(firstHalf),
      percentChange: Math.round(changePercent * 10) / 10,
    },
  };
}

function generateForecastData(metric: string, historicalDays: number = 30, forecastDays: number = 14): ForecastData {
  const historicalData: { date: string; value: number }[] = [];
  let baseValue = Math.floor(Math.random() * 100) + 50;
  
  for (let i = historicalDays - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    baseValue += (Math.random() - 0.3) * 8;
    historicalData.push({
      date: date.toISOString().split("T")[0],
      value: Math.max(0, Math.round(baseValue)),
    });
  }

  // Simple linear regression for forecast
  const n = historicalData.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = historicalData.reduce((sum, dp) => sum + dp.value, 0);
  const sumXY = historicalData.reduce((sum, dp, i) => sum + i * dp.value, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const predictions: { date: string; value: number; confidenceLow: number; confidenceHigh: number }[] = [];
  const lastValue = historicalData[historicalData.length - 1].value;
  
  for (let i = 1; i <= forecastDays; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const predictedValue = Math.max(0, Math.round(intercept + slope * (n + i - 1)));
    const uncertainty = i * 2;
    predictions.push({
      date: date.toISOString().split("T")[0],
      value: predictedValue,
      confidenceLow: Math.max(0, predictedValue - uncertainty),
      confidenceHigh: predictedValue + uncertainty,
    });
  }

  const nextPrediction = predictions[0];
  return {
    id: generateId("forecast"),
    metric,
    historicalData,
    predictions,
    methodology: "Linear regression with confidence intervals",
    accuracy: 0.85 + Math.random() * 0.1,
    nextPeriodPrediction: {
      value: nextPrediction.value,
      confidence: 0.9,
      range: { low: nextPrediction.confidenceLow, high: nextPrediction.confidenceHigh },
    },
  };
}

async function generateAIInsights(userId: string, reportData: any): Promise<AIInsight[]> {
  const insights: AIInsight[] = [];

  try {
    const prompt = `Analyze this healthcare analytics data and provide 3-5 actionable insights. Focus on trends, anomalies, and recommendations.

Data Summary:
- Total Patients: ${SAMPLE_PATIENT_DEMOGRAPHICS.length}
- High Risk Patients: ${SAMPLE_PATIENT_DEMOGRAPHICS.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical').length}
- Recent Clinical Events: ${SAMPLE_CLINICAL_EVENTS.length}
- Active Workflows: ${SAMPLE_WORKFLOW_METRICS.activeWorkflows}
- Workflow Completion Rate: ${(SAMPLE_WORKFLOW_METRICS.completionRate * 100).toFixed(1)}%

Provide insights in JSON format:
[
  {
    "title": "Brief insight title",
    "content": "Detailed explanation",
    "category": "risk_management|operations|patient_care|efficiency",
    "severity": "info|warning|critical",
    "recommendations": ["recommendation 1", "recommendation 2"]
  }
]

IMPORTANT: These insights are for informational purposes only and do not constitute clinical decision support.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a healthcare analytics expert providing operational insights. Always include NO-CDS disclaimers." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      const insightsArray = parsed.insights || parsed;
      
      if (Array.isArray(insightsArray)) {
        for (const insight of insightsArray) {
          insights.push({
            id: generateId("insight"),
            title: insight.title,
            content: insight.content + " " + NO_CDS_DISCLAIMER,
            category: insight.category,
            severity: insight.severity,
            recommendations: insight.recommendations,
            dataSource: "ai_analysis",
            generatedAt: new Date().toISOString(),
          });
        }
      }
    }
  } catch (error) {
    console.error("[AdvancedReporting] AI insights error:", error);
    // Fallback insights
    insights.push({
      id: generateId("insight"),
      title: "High Risk Patient Monitoring",
      content: `${SAMPLE_PATIENT_DEMOGRAPHICS.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical').length} patients are flagged as high or critical risk. Regular monitoring and proactive interventions are recommended. ${NO_CDS_DISCLAIMER}`,
      category: "risk_management",
      severity: "warning",
      recommendations: ["Review high-risk patient care plans", "Schedule follow-up appointments", "Ensure medication adherence tracking"],
      dataSource: "analytics",
      generatedAt: new Date().toISOString(),
    });
    insights.push({
      id: generateId("insight"),
      title: "Workflow Efficiency Opportunity",
      content: `Current workflow completion rate is ${(SAMPLE_WORKFLOW_METRICS.completionRate * 100).toFixed(1)}%. There may be opportunities to improve task prioritization and resource allocation. ${NO_CDS_DISCLAIMER}`,
      category: "operations",
      severity: "info",
      recommendations: ["Analyze bottlenecks in workflow pipeline", "Consider task redistribution", "Review automation opportunities"],
      dataSource: "analytics",
      generatedAt: new Date().toISOString(),
    });
  }

  await logPhiAccess({
    userId,
    action: "read",
    resourceType: "AIInsights",
    patientId: "aggregate",
    details: `Generated ${insights.length} AI insights for analytics report`,
  });

  return insights;
}

// ================== Service Class ==================

class AdvancedReportingAnalyticsService {
  constructor() {
    initializeSampleData();
    console.log("[AdvancedReporting] Service initialized");
  }

  getMetadata() {
    return {
      version: "1.0.0",
      name: "Advanced Reporting and Analytics Service",
      description: "Custom report builder, scheduled reports, historical analysis, and AI-powered forecasting",
      features: [
        "Custom report builder with multiple data sources",
        "Scheduled automated report generation",
        "Multi-format export (PDF, CSV, JSON, Excel)",
        "Historical trend analysis",
        "AI-powered forecasting",
        "Interactive analytics dashboards",
        "Risk distribution visualization",
        "Workflow performance metrics",
        "HIPAA-compliant audit logging",
      ],
      dataSources: [
        "patient_demographics",
        "clinical_events",
        "lab_results",
        "medications",
        "vital_signs",
        "diagnoses",
        "procedures",
        "appointments",
        "ai_insights",
        "workflow_metrics",
        "risk_scores",
        "care_plans",
        "immunizations",
        "allergies",
      ],
      chartTypes: ["line", "bar", "pie", "area", "scatter", "heatmap", "table"],
      exportFormats: ["pdf", "csv", "json", "excel"],
      scheduleFrequencies: ["once", "daily", "weekly", "biweekly", "monthly", "quarterly"],
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async getDashboard(userId: string): Promise<{
    templates: ReportTemplate[];
    scheduledReports: ScheduledReport[];
    recentReports: GeneratedReport[];
    quickStats: {
      totalTemplates: number;
      activeSchedules: number;
      reportsGenerated: number;
      lastReportDate?: string;
    };
    trendSummary: TrendData[];
    forecastSummary: ForecastData[];
  }> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "AnalyticsDashboard",
      patientId: "aggregate",
      details: "Accessed advanced reporting dashboard",
    });

    const templates = Array.from(reportTemplates.values());
    const schedules = Array.from(scheduledReports.values());
    const reports = Array.from(generatedReports.values()).sort(
      (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );

    return {
      templates,
      scheduledReports: schedules,
      recentReports: reports.slice(0, 10),
      quickStats: {
        totalTemplates: templates.length,
        activeSchedules: schedules.filter(s => s.isActive).length,
        reportsGenerated: reports.length,
        lastReportDate: reports[0]?.generatedAt,
      },
      trendSummary: [
        generateTrendData("patient_volume", 30),
        generateTrendData("clinical_events", 30),
        generateTrendData("workflow_completion", 30),
      ],
      forecastSummary: [
        generateForecastData("patient_admissions", 30, 14),
        generateForecastData("workflow_volume", 30, 14),
      ],
    };
  }

  // ================== Report Templates ==================

  async getTemplates(userId: string): Promise<ReportTemplate[]> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ReportTemplate",
      patientId: "system",
      details: "Retrieved report templates",
    });
    return Array.from(reportTemplates.values());
  }

  async getTemplate(userId: string, templateId: string): Promise<ReportTemplate | null> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ReportTemplate",
      patientId: "system",
      details: `Retrieved template ${templateId}`,
    });
    return reportTemplates.get(templateId) || null;
  }

  async createTemplate(userId: string, data: Omit<ReportTemplate, "id" | "createdAt" | "updatedAt" | "createdBy">): Promise<ReportTemplate> {
    const template: ReportTemplate = {
      ...data,
      id: generateId("template"),
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    reportTemplates.set(template.id, template);

    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ReportTemplate",
      patientId: "system",
      details: `Created template: ${template.name}`,
    });

    return template;
  }

  async updateTemplate(userId: string, templateId: string, updates: Partial<ReportTemplate>): Promise<ReportTemplate | null> {
    const template = reportTemplates.get(templateId);
    if (!template) return null;

    const updated = {
      ...template,
      ...updates,
      id: templateId,
      updatedAt: new Date().toISOString(),
    };
    reportTemplates.set(templateId, updated);

    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ReportTemplate",
      patientId: "system",
      details: `Updated template: ${templateId}`,
    });

    return updated;
  }

  async deleteTemplate(userId: string, templateId: string): Promise<boolean> {
    const deleted = reportTemplates.delete(templateId);
    
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ReportTemplate",
      patientId: "system",
      details: `Deleted template: ${templateId}`,
    });

    return deleted;
  }

  // ================== Scheduled Reports ==================

  async getScheduledReports(userId: string): Promise<ScheduledReport[]> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ScheduledReport",
      patientId: "system",
      details: "Retrieved scheduled reports",
    });
    return Array.from(scheduledReports.values());
  }

  async createScheduledReport(userId: string, data: Omit<ScheduledReport, "id" | "createdAt" | "createdBy" | "nextRunAt">): Promise<ScheduledReport> {
    const nextRunAt = this.calculateNextRunDate(data.frequency);
    
    const scheduled: ScheduledReport = {
      ...data,
      id: generateId("sched"),
      createdBy: userId,
      createdAt: new Date().toISOString(),
      nextRunAt,
    };
    scheduledReports.set(scheduled.id, scheduled);

    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ScheduledReport",
      patientId: "system",
      details: `Created scheduled report: ${scheduled.name}`,
    });

    return scheduled;
  }

  async updateScheduledReport(userId: string, scheduleId: string, updates: Partial<ScheduledReport>): Promise<ScheduledReport | null> {
    const scheduled = scheduledReports.get(scheduleId);
    if (!scheduled) return null;

    const updated = {
      ...scheduled,
      ...updates,
      id: scheduleId,
    };
    
    if (updates.frequency) {
      updated.nextRunAt = this.calculateNextRunDate(updates.frequency);
    }
    
    scheduledReports.set(scheduleId, updated);

    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ScheduledReport",
      patientId: "system",
      details: `Updated scheduled report: ${scheduleId}`,
    });

    return updated;
  }

  async deleteScheduledReport(userId: string, scheduleId: string): Promise<boolean> {
    const deleted = scheduledReports.delete(scheduleId);
    
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ScheduledReport",
      patientId: "system",
      details: `Deleted scheduled report: ${scheduleId}`,
    });

    return deleted;
  }

  private calculateNextRunDate(frequency: ReportFrequency): string {
    const next = new Date();
    switch (frequency) {
      case "daily": next.setDate(next.getDate() + 1); break;
      case "weekly": next.setDate(next.getDate() + 7); break;
      case "biweekly": next.setDate(next.getDate() + 14); break;
      case "monthly": next.setMonth(next.getMonth() + 1); break;
      case "quarterly": next.setMonth(next.getMonth() + 3); break;
      case "once": break;
    }
    return next.toISOString();
  }

  // ================== Report Generation ==================

  async generateReport(userId: string, templateId: string, options: {
    dateRangeType?: string;
    customStartDate?: string;
    customEndDate?: string;
    exportFormat?: ExportFormat;
    scheduledReportId?: string;
  } = {}): Promise<GeneratedReport> {
    const template = reportTemplates.get(templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    const now = new Date();
    const dateRange = this.getDateRange(
      options.dateRangeType || "last_30_days",
      options.customStartDate,
      options.customEndDate
    );

    const report: GeneratedReport = {
      id: generateId("report"),
      templateId,
      scheduledReportId: options.scheduledReportId,
      name: `${template.name} - ${now.toLocaleDateString()}`,
      generatedAt: now.toISOString(),
      generatedBy: userId,
      dateRange,
      exportFormat: options.exportFormat || "pdf",
      status: "generating",
      data: {
        summary: {
          totalRecords: 0,
          dateRange,
          highlights: [],
          generatedAt: now.toISOString(),
        },
        sections: [],
        trends: [],
        forecasts: [],
        aiInsights: [],
        noCdsDisclaimer: NO_CDS_DISCLAIMER,
      },
    };

    generatedReports.set(report.id, report);

    // Generate report data
    try {
      const data = await this.buildReportData(userId, template, dateRange);
      report.data = data;
      report.status = "completed";
    } catch (error) {
      report.status = "failed";
      report.error = error instanceof Error ? error.message : "Unknown error";
    }

    generatedReports.set(report.id, report);

    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "GeneratedReport",
      patientId: "aggregate",
      details: `Generated report: ${report.name}`,
    });

    return report;
  }

  private getDateRange(type: string, customStart?: string, customEnd?: string): { start: string; end: string } {
    const end = new Date();
    let start = new Date();

    switch (type) {
      case "last_7_days": start.setDate(start.getDate() - 7); break;
      case "last_30_days": start.setDate(start.getDate() - 30); break;
      case "last_90_days": start.setDate(start.getDate() - 90); break;
      case "last_year": start.setFullYear(start.getFullYear() - 1); break;
      case "all_time": start = new Date("2020-01-01"); break;
      case "custom":
        if (customStart) start = new Date(customStart);
        if (customEnd) return { start: start.toISOString(), end: new Date(customEnd).toISOString() };
        break;
    }

    return { start: start.toISOString(), end: end.toISOString() };
  }

  private async buildReportData(userId: string, template: ReportTemplate, dateRange: { start: string; end: string }): Promise<ReportData> {
    // Generate mock data based on template
    const sections: GeneratedSection[] = [];

    for (const section of template.sections.sort((a, b) => a.order - b.order)) {
      switch (section.type) {
        case "summary":
          sections.push({
            id: section.id,
            title: section.title,
            type: section.type,
            data: {
              totalPatients: SAMPLE_PATIENT_DEMOGRAPHICS.length,
              averageAge: Math.round(SAMPLE_PATIENT_DEMOGRAPHICS.reduce((sum, p) => sum + p.age, 0) / SAMPLE_PATIENT_DEMOGRAPHICS.length),
              riskDistribution: {
                low: SAMPLE_PATIENT_DEMOGRAPHICS.filter(p => p.riskLevel === "low").length,
                medium: SAMPLE_PATIENT_DEMOGRAPHICS.filter(p => p.riskLevel === "medium").length,
                high: SAMPLE_PATIENT_DEMOGRAPHICS.filter(p => p.riskLevel === "high").length,
                critical: SAMPLE_PATIENT_DEMOGRAPHICS.filter(p => p.riskLevel === "critical").length,
              },
            },
          });
          break;
        case "chart":
          const chart = template.charts.find(c => c.id === section.chartId);
          sections.push({
            id: section.id,
            title: section.title,
            type: section.type,
            data: { chartConfig: chart },
            chartData: this.generateChartData(chart),
          });
          break;
        case "metrics":
          sections.push({
            id: section.id,
            title: section.title,
            type: section.type,
            data: {
              metrics: [
                { label: "Total Workflows", value: SAMPLE_WORKFLOW_METRICS.totalWorkflows, trend: "up" },
                { label: "Completion Rate", value: `${(SAMPLE_WORKFLOW_METRICS.completionRate * 100).toFixed(1)}%`, trend: "stable" },
                { label: "Avg Completion Time", value: `${SAMPLE_WORKFLOW_METRICS.averageCompletionTime}h`, trend: "down" },
              ],
            },
          });
          break;
        case "ai_analysis":
          const insights = await generateAIInsights(userId, { template, dateRange });
          sections.push({
            id: section.id,
            title: section.title,
            type: section.type,
            data: { insights },
          });
          break;
        default:
          sections.push({
            id: section.id,
            title: section.title,
            type: section.type,
            data: {},
          });
      }
    }

    const trends = [
      generateTrendData("patient_volume", 30),
      generateTrendData("clinical_events", 30),
      generateTrendData("risk_assessments", 30),
    ];

    const forecasts = [
      generateForecastData("patient_admissions", 30, 14),
      generateForecastData("workflow_volume", 30, 14),
    ];

    const aiInsights = await generateAIInsights(userId, { template, dateRange, trends, forecasts });

    return {
      summary: {
        totalRecords: SAMPLE_PATIENT_DEMOGRAPHICS.length + SAMPLE_CLINICAL_EVENTS.length,
        dateRange,
        highlights: [
          { label: "Total Patients", value: SAMPLE_PATIENT_DEMOGRAPHICS.length, trend: "up" },
          { label: "High Risk", value: SAMPLE_PATIENT_DEMOGRAPHICS.filter(p => p.riskLevel === "high" || p.riskLevel === "critical").length, trend: "stable" },
          { label: "Clinical Events", value: SAMPLE_CLINICAL_EVENTS.length, trend: "up" },
          { label: "Active Workflows", value: SAMPLE_WORKFLOW_METRICS.activeWorkflows },
        ],
        generatedAt: new Date().toISOString(),
      },
      sections,
      trends,
      forecasts,
      aiInsights,
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  }

  private generateChartData(chart?: ChartConfig): any {
    if (!chart) return null;

    switch (chart.type) {
      case "pie":
        return {
          labels: ["Low", "Medium", "High", "Critical"],
          values: [
            SAMPLE_PATIENT_DEMOGRAPHICS.filter(p => p.riskLevel === "low").length,
            SAMPLE_PATIENT_DEMOGRAPHICS.filter(p => p.riskLevel === "medium").length,
            SAMPLE_PATIENT_DEMOGRAPHICS.filter(p => p.riskLevel === "high").length,
            SAMPLE_PATIENT_DEMOGRAPHICS.filter(p => p.riskLevel === "critical").length,
          ],
          colors: ["#22c55e", "#f59e0b", "#ef4444", "#7c3aed"],
        };
      case "bar":
        return {
          labels: ["18-30", "31-45", "46-60", "61-75", "76+"],
          values: [12, 25, 35, 42, 18],
        };
      case "line":
      case "area":
        const data = [];
        for (let i = 29; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          data.push({
            date: date.toISOString().split("T")[0],
            value: Math.floor(Math.random() * 50) + 30,
          });
        }
        return { dataPoints: data };
      default:
        return null;
    }
  }

  async getGeneratedReports(userId: string, limit: number = 20): Promise<GeneratedReport[]> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "GeneratedReport",
      patientId: "aggregate",
      details: `Retrieved ${limit} recent reports`,
    });

    return Array.from(generatedReports.values())
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
      .slice(0, limit);
  }

  async getGeneratedReport(userId: string, reportId: string): Promise<GeneratedReport | null> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "GeneratedReport",
      patientId: "aggregate",
      details: `Retrieved report ${reportId}`,
    });

    return generatedReports.get(reportId) || null;
  }

  // ================== Analytics Dashboard ==================

  async getAnalyticsDashboards(userId: string): Promise<AnalyticsDashboard[]> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "AnalyticsDashboard",
      patientId: "system",
      details: "Retrieved analytics dashboards",
    });
    return Array.from(analyticsDashboards.values());
  }

  async getDefaultDashboard(userId: string): Promise<AnalyticsDashboard | null> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "AnalyticsDashboard",
      patientId: "system",
      details: "Retrieved default dashboard",
    });
    return Array.from(analyticsDashboards.values()).find(d => d.isDefault) || null;
  }

  // ================== Trend Analysis ==================

  async getTrendAnalysis(userId: string, metrics: string[], days: number = 30): Promise<TrendData[]> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "TrendAnalysis",
      patientId: "aggregate",
      details: `Analyzed trends for ${metrics.join(", ")} over ${days} days`,
    });

    return metrics.map(metric => generateTrendData(metric, days));
  }

  // ================== Forecasting ==================

  async getForecast(userId: string, metrics: string[], historicalDays: number = 30, forecastDays: number = 14): Promise<ForecastData[]> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "Forecast",
      patientId: "aggregate",
      details: `Generated forecasts for ${metrics.join(", ")} - ${forecastDays} days ahead`,
    });

    return metrics.map(metric => generateForecastData(metric, historicalDays, forecastDays));
  }

  // ================== Customizable KPI Dashboard ==================

  async getKPIDefinitions(userId: string): Promise<KPIDefinition[]> {
    await logPhiAccess({ userId, action: "read", resourceType: "KPIDefinition", patientId: "system", details: "Retrieved KPI definitions" });
    return Array.from(kpiDefinitions.values()).sort((a, b) => a.displayOrder - b.displayOrder);
  }

  async getKPIDashboardConfigs(userId: string): Promise<KPIDashboardConfig[]> {
    await logPhiAccess({ userId, action: "read", resourceType: "KPIDashboardConfig", patientId: "system", details: "Retrieved KPI dashboard configs" });
    return Array.from(kpiDashboardConfigs.values());
  }

  async getKPIValues(userId: string, kpiIds: string[]): Promise<KPIValue[]> {
    await logPhiAccess({ userId, action: "read", resourceType: "KPIValue", patientId: "aggregate", details: `Retrieved values for ${kpiIds.length} KPIs` });
    
    return kpiIds.map(kpiId => {
      const kpi = kpiDefinitions.get(kpiId);
      const baseValue = Math.random() * 100;
      const previousValue = baseValue * (0.9 + Math.random() * 0.2);
      const change = baseValue - previousValue;
      const changePercent = (change / previousValue) * 100;
      
      let status: KPIValue["status"] = "on_track";
      if (kpi?.threshold) {
        if (baseValue >= kpi.threshold.critical) status = "critical";
        else if (baseValue >= kpi.threshold.warning) status = "warning";
      }
      
      return {
        kpiId,
        value: Math.round(baseValue * 10) / 10,
        previousValue: Math.round(previousValue * 10) / 10,
        change: Math.round(change * 10) / 10,
        changePercent: Math.round(changePercent * 10) / 10,
        trend: changePercent > 2 ? "up" : changePercent < -2 ? "down" : "stable",
        status,
        lastUpdated: new Date().toISOString(),
      };
    });
  }

  async createKPIDashboardConfig(userId: string, config: Omit<KPIDashboardConfig, "id" | "createdAt" | "createdBy">): Promise<KPIDashboardConfig> {
    const newConfig: KPIDashboardConfig = { ...config, id: generateId("kpi_dash"), createdBy: userId, createdAt: new Date().toISOString() };
    kpiDashboardConfigs.set(newConfig.id, newConfig);
    await logPhiAccess({ userId, action: "write", resourceType: "KPIDashboardConfig", patientId: "system", details: `Created KPI dashboard: ${newConfig.name}` });
    return newConfig;
  }

  async updateKPIDashboardConfig(userId: string, configId: string, updates: Partial<KPIDashboardConfig>): Promise<KPIDashboardConfig | null> {
    const config = kpiDashboardConfigs.get(configId);
    if (!config) return null;
    const updated = { ...config, ...updates, id: configId };
    kpiDashboardConfigs.set(configId, updated);
    await logPhiAccess({ userId, action: "write", resourceType: "KPIDashboardConfig", patientId: "system", details: `Updated KPI dashboard: ${configId}` });
    return updated;
  }

  // ================== Predictive Analytics ==================

  async getRiskStratification(userId: string): Promise<RiskStratificationResult[]> {
    await logPhiAccess({ userId, action: "read", resourceType: "RiskStratification", patientId: "aggregate", details: "Retrieved patient risk stratification" });
    
    return SAMPLE_PATIENT_DEMOGRAPHICS.map(patient => ({
      patientId: patient.id,
      patientName: patient.name,
      overallRiskScore: patient.riskLevel === "critical" ? 0.9 : patient.riskLevel === "high" ? 0.7 : patient.riskLevel === "medium" ? 0.45 : 0.2,
      riskLevel: patient.riskLevel as RiskStratificationResult["riskLevel"],
      riskFactors: patient.conditions.map((condition, i) => ({
        factor: condition.replace(/_/g, " "),
        contribution: 0.3 - i * 0.05,
        description: `${condition.replace(/_/g, " ")} contributes to overall health risk`,
      })).concat([{ factor: "Age", contribution: patient.age > 65 ? 0.25 : 0.1, description: `Patient age ${patient.age}` }]),
      predictedEvents: [
        { event: "Hospital Admission", probability: patient.riskLevel === "critical" ? 0.35 : patient.riskLevel === "high" ? 0.2 : 0.08, timeframe: "90 days", preventable: true },
        { event: "Emergency Visit", probability: patient.riskLevel === "critical" ? 0.45 : patient.riskLevel === "high" ? 0.25 : 0.1, timeframe: "90 days", preventable: true },
      ],
      recommendations: ["Continue regular monitoring", "Review medication adherence", "Schedule follow-up appointments"],
      lastAssessment: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    }));
  }

  async getResourceForecasts(userId: string): Promise<ResourceForecast[]> {
    await logPhiAccess({ userId, action: "read", resourceType: "ResourceForecast", patientId: "aggregate", details: "Retrieved resource forecasts" });
    
    const resources: ResourceForecast[] = [
      { id: generateId("rf"), resourceType: "beds", resourceName: "Inpatient Beds", currentCapacity: 120, currentUtilization: 78, predictions: [], recommendations: ["Monitor for seasonal increases", "Consider contingency planning for flu season"], alertLevel: "normal", noCdsDisclaimer: NO_CDS_DISCLAIMER },
      { id: generateId("rf"), resourceType: "staff", resourceName: "Nursing Staff", currentCapacity: 85, currentUtilization: 92, predictions: [], recommendations: ["Consider hiring additional per-diem staff", "Review overtime policies"], alertLevel: "elevated", noCdsDisclaimer: NO_CDS_DISCLAIMER },
      { id: generateId("rf"), resourceType: "appointments", resourceName: "Appointment Slots", currentCapacity: 500, currentUtilization: 87, predictions: [], recommendations: ["Maintain current scheduling efficiency", "Consider telehealth expansion"], alertLevel: "normal", noCdsDisclaimer: NO_CDS_DISCLAIMER },
      { id: generateId("rf"), resourceType: "equipment", resourceName: "MRI Scanner", currentCapacity: 40, currentUtilization: 95, predictions: [], recommendations: ["Evaluate additional equipment acquisition", "Optimize scheduling for peak utilization"], alertLevel: "high", noCdsDisclaimer: NO_CDS_DISCLAIMER },
    ];
    
    resources.forEach(r => {
      for (let i = 1; i <= 14; i++) {
        const date = new Date(); date.setDate(date.getDate() + i);
        const baseDemand = r.currentCapacity * (r.currentUtilization / 100);
        const predictedDemand = baseDemand * (0.95 + Math.random() * 0.15);
        r.predictions.push({
          date: date.toISOString().split("T")[0],
          predictedDemand: Math.round(predictedDemand),
          confidenceLow: Math.round(predictedDemand * 0.9),
          confidenceHigh: Math.round(predictedDemand * 1.1),
          utilization: Math.round((predictedDemand / r.currentCapacity) * 100),
        });
      }
    });
    
    return resources;
  }

  // ================== Performance Reports ==================

  async getClinicalOutcomesReport(userId: string, dateRange?: { start: string; end: string }): Promise<ClinicalOutcomesReport> {
    await logPhiAccess({ userId, action: "read", resourceType: "ClinicalOutcomesReport", patientId: "aggregate", details: "Generated clinical outcomes report" });
    
    const period = dateRange || { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), end: new Date().toISOString() };
    
    return {
      id: generateId("cor"),
      period,
      metrics: {
        readmissionRate: 11.2,
        readmissionTarget: 12.0,
        averageLengthOfStay: 4.3,
        mortalityRate: 1.2,
        infectionRate: 0.8,
        patientFallRate: 0.3,
        medicationErrorRate: 0.05,
        careGapsClosed: 156,
        preventiveServicesCompliance: 87.5,
      },
      trends: [
        { metric: "readmission_rate", values: generateTrendData("readmission_rate", 30).dataPoints, trend: "improving" },
        { metric: "avg_los", values: generateTrendData("avg_los", 30).dataPoints, trend: "stable" },
        { metric: "care_gaps_closed", values: generateTrendData("care_gaps", 30).dataPoints, trend: "improving" },
      ],
      aiInsights: [
        "Readmission rate trending below target, indicating effective post-discharge care.",
        "Preventive services compliance improved 3.2% from previous period.",
        "Care gap closure rate shows positive momentum with 156 gaps addressed.",
      ],
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
      generatedAt: new Date().toISOString(),
    };
  }

  async getPatientSatisfactionReport(userId: string, dateRange?: { start: string; end: string }): Promise<PatientSatisfactionReport> {
    await logPhiAccess({ userId, action: "read", resourceType: "PatientSatisfactionReport", patientId: "aggregate", details: "Generated patient satisfaction report" });
    
    const period = dateRange || { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), end: new Date().toISOString() };
    
    return {
      id: generateId("psr"),
      period,
      overallScore: 4.2,
      npsScore: 42,
      responseRate: 34.5,
      totalResponses: 287,
      categoryScores: [
        { category: "Care Quality", score: 4.5, previousScore: 4.3, trend: "up" },
        { category: "Communication", score: 4.1, previousScore: 4.2, trend: "down" },
        { category: "Wait Times", score: 3.8, previousScore: 3.6, trend: "up" },
        { category: "Facility Cleanliness", score: 4.6, previousScore: 4.5, trend: "up" },
        { category: "Staff Friendliness", score: 4.4, previousScore: 4.4, trend: "stable" },
      ],
      topStrengths: ["Quality of care provided", "Cleanliness and safety of facility", "Staff professionalism"],
      areasForImprovement: ["Wait times in certain departments", "Follow-up communication", "Appointment availability"],
      sentimentDistribution: { positive: 68, neutral: 22, negative: 10 },
      keyThemes: [
        { theme: "Excellent care", count: 89, sentiment: "positive" },
        { theme: "Long wait times", count: 34, sentiment: "negative" },
        { theme: "Friendly staff", count: 67, sentiment: "positive" },
        { theme: "Communication issues", count: 21, sentiment: "negative" },
      ],
      aiInsights: [
        "Overall satisfaction improved 2.4% from previous reporting period.",
        "Wait time satisfaction showing positive momentum with recent improvements.",
        "Communication scores indicate opportunity for process improvement.",
      ],
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
      generatedAt: new Date().toISOString(),
    };
  }

  async getOperationalCostsReport(userId: string, dateRange?: { start: string; end: string }): Promise<OperationalCostsReport> {
    await logPhiAccess({ userId, action: "read", resourceType: "OperationalCostsReport", patientId: "aggregate", details: "Generated operational costs report" });
    
    const period = dateRange || { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), end: new Date().toISOString() };
    
    return {
      id: generateId("ocr"),
      period,
      totalCosts: 2450000,
      budgetVariance: -45000,
      costBreakdown: [
        { category: "Labor & Staffing", amount: 1225000, percentOfTotal: 50, budgeted: 1200000, variance: 25000 },
        { category: "Medical Supplies", amount: 367500, percentOfTotal: 15, budgeted: 380000, variance: -12500 },
        { category: "Pharmaceuticals", amount: 294000, percentOfTotal: 12, budgeted: 300000, variance: -6000 },
        { category: "Equipment & Maintenance", amount: 245000, percentOfTotal: 10, budgeted: 250000, variance: -5000 },
        { category: "Facility Operations", amount: 196000, percentOfTotal: 8, budgeted: 200000, variance: -4000 },
        { category: "Administrative", amount: 122500, percentOfTotal: 5, budgeted: 165000, variance: -42500 },
      ],
      costPerPatient: 823,
      costPerVisit: 245,
      revenueRecovery: 94.2,
      efficiencyMetrics: [
        { metric: "Revenue per FTE", value: 285000, benchmark: 275000, status: "above" },
        { metric: "Days in AR", value: 38, benchmark: 40, status: "above" },
        { metric: "Clean Claim Rate", value: 96.2, benchmark: 95, status: "above" },
        { metric: "Denial Rate", value: 4.8, benchmark: 5, status: "at" },
      ],
      savingsOpportunities: [
        { area: "Supply Chain Optimization", potentialSavings: 45000, difficulty: "medium", recommendation: "Consolidate vendors and negotiate volume discounts" },
        { area: "Telehealth Expansion", potentialSavings: 32000, difficulty: "easy", recommendation: "Increase telehealth utilization for appropriate visits" },
        { area: "Workflow Automation", potentialSavings: 28000, difficulty: "hard", recommendation: "Implement RPA for repetitive administrative tasks" },
      ],
      aiInsights: [
        "Overall spending 1.8% under budget, driven by administrative cost savings.",
        "Labor costs slightly over budget due to overtime; consider staffing optimization.",
        "Revenue cycle performance exceeds benchmarks across all key metrics.",
      ],
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
      generatedAt: new Date().toISOString(),
    };
  }

  // ================== Data Export ==================

  async createExportJob(userId: string, params: {
    type: ExportJob["type"];
    format: ExportFormat;
    sourceId: string;
    sourceName: string;
    filters?: Record<string, any>;
    dateRange?: { start: string; end: string };
  }): Promise<ExportJob> {
    const job: ExportJob = {
      id: generateId("export"),
      type: params.type,
      format: params.format,
      status: "queued",
      progress: 0,
      sourceId: params.sourceId,
      sourceName: params.sourceName,
      filters: params.filters,
      dateRange: params.dateRange,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    exportJobs.set(job.id, job);
    
    // Simulate async processing
    setTimeout(() => {
      job.status = "processing";
      job.progress = 25;
    }, 500);
    
    setTimeout(() => {
      job.progress = 75;
    }, 1500);
    
    setTimeout(() => {
      job.status = "completed";
      job.progress = 100;
      job.completedAt = new Date().toISOString();
      job.downloadUrl = `/api/advanced-reporting/exports/${job.id}/download`;
      job.fileSize = Math.floor(Math.random() * 500000) + 50000;
    }, 2500);
    
    await logPhiAccess({ userId, action: "write", resourceType: "ExportJob", patientId: "aggregate", details: `Created export job: ${params.sourceName} as ${params.format}` });
    return job;
  }

  async getExportJobs(userId: string): Promise<ExportJob[]> {
    await logPhiAccess({ userId, action: "read", resourceType: "ExportJob", patientId: "aggregate", details: "Retrieved export jobs" });
    return Array.from(exportJobs.values()).filter(j => j.createdBy === userId || j.createdBy === "system").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getExportJob(userId: string, jobId: string): Promise<ExportJob | null> {
    await logPhiAccess({ userId, action: "read", resourceType: "ExportJob", patientId: "aggregate", details: `Retrieved export job: ${jobId}` });
    return exportJobs.get(jobId) || null;
  }

  generateExportData(format: ExportFormat, data: any): string {
    switch (format) {
      case "json":
        return JSON.stringify(data, null, 2);
      case "csv":
        if (Array.isArray(data) && data.length > 0) {
          const headers = Object.keys(data[0]).join(",");
          const rows = data.map(row => Object.values(row).map(v => typeof v === "string" ? `"${v}"` : v).join(","));
          return [headers, ...rows].join("\n");
        }
        return "";
      default:
        return JSON.stringify(data);
    }
  }

  // ================== Interactive Trend Graphs ==================

  async getInteractiveTrends(userId: string, metrics?: string[]): Promise<InteractiveTrendData[]> {
    await logPhiAccess({ userId, action: "read", resourceType: "InteractiveTrends", patientId: "aggregate", details: "Retrieved interactive trend data" });
    
    const generateDataPoints = (days: number, baseValue: number, variance: number) => {
      const points: { date: string; value: number }[] = [];
      let value = baseValue;
      for (let i = days; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        value = Math.max(0, value + (Math.random() - 0.5) * variance);
        points.push({ date, value: Math.round(value * 100) / 100 });
      }
      return points;
    };

    const trends: InteractiveTrendData[] = [
      {
        id: "trend_patient_volume",
        metric: "patient_volume",
        metricLabel: "Daily Patient Volume",
        category: "operational",
        dataPoints: generateDataPoints(90, 150, 20),
        annotations: [
          { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], label: "Flu Season Start", type: "event" },
          { date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], label: "Record High", type: "milestone" },
        ],
        statistics: { min: 98, max: 187, avg: 148.5, median: 151, stdDev: 18.3, percentile90: 172 },
        trendLine: { slope: 0.42, intercept: 135, rSquared: 0.78 },
        forecast: generateDataPoints(14, 165, 15).map(p => ({ ...p, confidenceLow: p.value - 20, confidenceHigh: p.value + 20 })),
      },
      {
        id: "trend_readmission_rate",
        metric: "readmission_rate",
        metricLabel: "30-Day Readmission Rate (%)",
        category: "clinical",
        dataPoints: generateDataPoints(90, 11.5, 1.5),
        annotations: [
          { date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], label: "Care Protocol Update", type: "event" },
        ],
        statistics: { min: 8.2, max: 14.8, avg: 11.2, median: 11.0, stdDev: 1.8, percentile90: 13.5 },
        trendLine: { slope: -0.05, intercept: 12.8, rSquared: 0.65 },
      },
      {
        id: "trend_satisfaction",
        metric: "patient_satisfaction",
        metricLabel: "Patient Satisfaction Score",
        category: "satisfaction",
        dataPoints: generateDataPoints(90, 4.2, 0.3),
        annotations: [
          { date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], label: "Staff Training", type: "milestone" },
        ],
        statistics: { min: 3.6, max: 4.7, avg: 4.18, median: 4.2, stdDev: 0.25, percentile90: 4.5 },
        trendLine: { slope: 0.008, intercept: 4.0, rSquared: 0.72 },
      },
      {
        id: "trend_avg_wait_time",
        metric: "avg_wait_time",
        metricLabel: "Average Wait Time (minutes)",
        category: "operational",
        dataPoints: generateDataPoints(90, 22, 5),
        annotations: [
          { date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], label: "Scheduling Update", type: "event" },
        ],
        statistics: { min: 12, max: 35, avg: 21.8, median: 22, stdDev: 5.2, percentile90: 28 },
        trendLine: { slope: -0.12, intercept: 25, rSquared: 0.58 },
      },
    ];

    if (metrics && metrics.length > 0) {
      return trends.filter(t => metrics.includes(t.metric));
    }
    return trends;
  }

  // ================== Heatmaps ==================

  async getHeatmaps(userId: string, type?: string): Promise<HeatmapData[]> {
    await logPhiAccess({ userId, action: "read", resourceType: "Heatmaps", patientId: "aggregate", details: "Retrieved heatmap data" });
    
    const heatmaps: HeatmapData[] = [
      {
        id: "heatmap_age_condition",
        title: "Patient Distribution by Age Group and Condition",
        description: "Shows patient counts across age groups and primary conditions",
        xAxisLabel: "Age Group",
        yAxisLabel: "Primary Condition",
        xCategories: ["18-30", "31-45", "46-60", "61-75", "75+"],
        yCategories: ["Diabetes", "Hypertension", "Heart Disease", "Respiratory", "Cancer", "Other"],
        cells: [
          { x: 0, y: 0, value: 45, count: 45 }, { x: 1, y: 0, value: 89, count: 89 }, { x: 2, y: 0, value: 156, count: 156 }, { x: 3, y: 0, value: 203, count: 203 }, { x: 4, y: 0, value: 178, count: 178 },
          { x: 0, y: 1, value: 23, count: 23 }, { x: 1, y: 1, value: 67, count: 67 }, { x: 2, y: 1, value: 189, count: 189 }, { x: 3, y: 1, value: 245, count: 245 }, { x: 4, y: 1, value: 198, count: 198 },
          { x: 0, y: 2, value: 12, count: 12 }, { x: 1, y: 2, value: 34, count: 34 }, { x: 2, y: 2, value: 98, count: 98 }, { x: 3, y: 2, value: 167, count: 167 }, { x: 4, y: 2, value: 145, count: 145 },
          { x: 0, y: 3, value: 67, count: 67 }, { x: 1, y: 3, value: 45, count: 45 }, { x: 2, y: 3, value: 78, count: 78 }, { x: 3, y: 3, value: 112, count: 112 }, { x: 4, y: 3, value: 134, count: 134 },
          { x: 0, y: 4, value: 8, count: 8 }, { x: 1, y: 4, value: 23, count: 23 }, { x: 2, y: 4, value: 67, count: 67 }, { x: 3, y: 4, value: 89, count: 89 }, { x: 4, y: 4, value: 102, count: 102 },
          { x: 0, y: 5, value: 134, count: 134 }, { x: 1, y: 5, value: 156, count: 156 }, { x: 2, y: 5, value: 189, count: 189 }, { x: 3, y: 5, value: 145, count: 145 }, { x: 4, y: 5, value: 123, count: 123 },
        ],
        colorScale: { min: 0, max: 250, minColor: "#e0f2fe", maxColor: "#0369a1" },
        aggregationType: "count",
      },
      {
        id: "heatmap_day_hour",
        title: "Appointment Volume by Day and Hour",
        description: "Shows appointment distribution across days of week and hours",
        xAxisLabel: "Hour of Day",
        yAxisLabel: "Day of Week",
        xCategories: ["8am", "9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm", "5pm"],
        yCategories: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        cells: [
          { x: 0, y: 0, value: 12 }, { x: 1, y: 0, value: 24 }, { x: 2, y: 0, value: 28 }, { x: 3, y: 0, value: 22 }, { x: 4, y: 0, value: 15 }, { x: 5, y: 0, value: 18 }, { x: 6, y: 0, value: 26 }, { x: 7, y: 0, value: 24 }, { x: 8, y: 0, value: 20 }, { x: 9, y: 0, value: 8 },
          { x: 0, y: 1, value: 14 }, { x: 1, y: 1, value: 26 }, { x: 2, y: 1, value: 30 }, { x: 3, y: 1, value: 25 }, { x: 4, y: 1, value: 12 }, { x: 5, y: 1, value: 20 }, { x: 6, y: 1, value: 28 }, { x: 7, y: 1, value: 22 }, { x: 8, y: 1, value: 18 }, { x: 9, y: 1, value: 10 },
          { x: 0, y: 2, value: 10 }, { x: 1, y: 2, value: 22 }, { x: 2, y: 2, value: 25 }, { x: 3, y: 2, value: 20 }, { x: 4, y: 2, value: 14 }, { x: 5, y: 2, value: 16 }, { x: 6, y: 2, value: 24 }, { x: 7, y: 2, value: 20 }, { x: 8, y: 2, value: 15 }, { x: 9, y: 2, value: 6 },
          { x: 0, y: 3, value: 16 }, { x: 1, y: 3, value: 28 }, { x: 2, y: 3, value: 32 }, { x: 3, y: 3, value: 28 }, { x: 4, y: 3, value: 18 }, { x: 5, y: 3, value: 22 }, { x: 6, y: 3, value: 30 }, { x: 7, y: 3, value: 26 }, { x: 8, y: 3, value: 22 }, { x: 9, y: 3, value: 12 },
          { x: 0, y: 4, value: 8 }, { x: 1, y: 4, value: 18 }, { x: 2, y: 4, value: 20 }, { x: 3, y: 4, value: 16 }, { x: 4, y: 4, value: 10 }, { x: 5, y: 4, value: 12 }, { x: 6, y: 4, value: 18 }, { x: 7, y: 4, value: 14 }, { x: 8, y: 4, value: 10 }, { x: 9, y: 4, value: 4 },
        ],
        colorScale: { min: 0, max: 35, minColor: "#dcfce7", maxColor: "#166534" },
        aggregationType: "count",
      },
      {
        id: "heatmap_satisfaction_dept",
        title: "Satisfaction Scores by Department and Category",
        description: "Shows average satisfaction scores across departments and categories",
        xAxisLabel: "Satisfaction Category",
        yAxisLabel: "Department",
        xCategories: ["Care Quality", "Communication", "Wait Times", "Staff", "Facility"],
        yCategories: ["Primary Care", "Cardiology", "Orthopedics", "Pediatrics", "Emergency", "Oncology"],
        cells: [
          { x: 0, y: 0, value: 4.5 }, { x: 1, y: 0, value: 4.2 }, { x: 2, y: 0, value: 3.8 }, { x: 3, y: 0, value: 4.4 }, { x: 4, y: 0, value: 4.6 },
          { x: 0, y: 1, value: 4.7 }, { x: 1, y: 1, value: 4.3 }, { x: 2, y: 1, value: 3.5 }, { x: 3, y: 1, value: 4.5 }, { x: 4, y: 1, value: 4.4 },
          { x: 0, y: 2, value: 4.4 }, { x: 1, y: 2, value: 4.1 }, { x: 2, y: 2, value: 3.9 }, { x: 3, y: 2, value: 4.3 }, { x: 4, y: 2, value: 4.5 },
          { x: 0, y: 3, value: 4.8 }, { x: 1, y: 3, value: 4.6 }, { x: 2, y: 3, value: 4.0 }, { x: 3, y: 3, value: 4.7 }, { x: 4, y: 3, value: 4.6 },
          { x: 0, y: 4, value: 4.2 }, { x: 1, y: 4, value: 3.8 }, { x: 2, y: 4, value: 2.9 }, { x: 3, y: 4, value: 4.0 }, { x: 4, y: 4, value: 4.1 },
          { x: 0, y: 5, value: 4.9 }, { x: 1, y: 5, value: 4.7 }, { x: 2, y: 5, value: 3.6 }, { x: 3, y: 5, value: 4.8 }, { x: 4, y: 5, value: 4.5 },
        ],
        colorScale: { min: 2.5, max: 5, minColor: "#fef2f2", maxColor: "#dc2626" },
        aggregationType: "average",
      },
    ];

    if (type) {
      return heatmaps.filter(h => h.id.includes(type));
    }
    return heatmaps;
  }

  // ================== Cohort Analysis ==================

  async getCohorts(userId: string): Promise<CohortDefinition[]> {
    await logPhiAccess({ userId, action: "read", resourceType: "Cohorts", patientId: "aggregate", details: "Retrieved cohort definitions" });
    return Array.from(cohortDefinitions.values());
  }

  async createCohort(userId: string, data: Omit<CohortDefinition, "id" | "createdAt" | "createdBy">): Promise<CohortDefinition> {
    const cohort: CohortDefinition = {
      ...data,
      id: generateId("cohort"),
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    cohortDefinitions.set(cohort.id, cohort);
    await logPhiAccess({ userId, action: "write", resourceType: "Cohort", patientId: "aggregate", details: `Created cohort: ${cohort.name}` });
    return cohort;
  }

  async runCohortAnalysis(userId: string, cohortIds: string[], metrics: string[]): Promise<CohortAnalysisResult> {
    await logPhiAccess({ userId, action: "read", resourceType: "CohortAnalysis", patientId: "aggregate", details: `Running cohort analysis for: ${cohortIds.join(", ")}` });
    
    const cohorts = cohortIds.map(id => cohortDefinitions.get(id)).filter(Boolean) as CohortDefinition[];
    
    const generateTimeSeriesData = (baseValue: number, variance: number, trend: number) => {
      const points: { date: string; value: number }[] = [];
      let value = baseValue;
      for (let i = 12; i >= 0; i--) {
        const date = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        value = Math.max(0, value + trend + (Math.random() - 0.5) * variance);
        points.push({ date, value: Math.round(value * 100) / 100 });
      }
      return points;
    };

    const result: CohortAnalysisResult = {
      id: generateId("analysis"),
      cohorts: cohorts.map((c, i) => ({
        cohortId: c.id,
        cohortName: c.name,
        patientCount: c.patientCount,
        metrics: [
          { metric: "readmission_rate", value: 8 + i * 3 + Math.random() * 2, trend: i === 0 ? "down" : "stable" },
          { metric: "avg_los", value: 3.5 + i * 0.8 + Math.random() * 0.5, trend: "stable" },
          { metric: "satisfaction_score", value: 4.5 - i * 0.3 + Math.random() * 0.2, trend: i === 0 ? "up" : "down" },
          { metric: "care_compliance", value: 92 - i * 5 + Math.random() * 3, trend: "up" },
        ],
      })),
      comparisons: [
        {
          metric: "readmission_rate",
          cohortValues: cohorts.map((c, i) => ({ cohortId: c.id, value: 8 + i * 3, percentile: 50 - i * 15 })),
          significanceLevel: 0.02,
          isSignificant: true,
        },
        {
          metric: "satisfaction_score",
          cohortValues: cohorts.map((c, i) => ({ cohortId: c.id, value: 4.5 - i * 0.3, percentile: 85 - i * 10 })),
          significanceLevel: 0.04,
          isSignificant: true,
        },
      ],
      timeSeriesComparison: [
        {
          metric: "readmission_rate",
          cohortData: cohorts.map((c, i) => ({
            cohortId: c.id,
            dataPoints: generateTimeSeriesData(10 + i * 2, 2, -0.1 + i * 0.05),
          })),
        },
        {
          metric: "satisfaction_score",
          cohortData: cohorts.map((c, i) => ({
            cohortId: c.id,
            dataPoints: generateTimeSeriesData(4.2 - i * 0.2, 0.3, 0.02 - i * 0.01),
          })),
        },
      ],
      aiInsights: [
        `Cohort "${cohorts[0]?.name || "Primary"}" shows significantly lower readmission rates compared to other cohorts.`,
        "Satisfaction scores correlate strongly with care compliance across all cohorts.",
        "Younger patient cohorts show faster recovery times and higher engagement.",
        "Consider implementing targeted interventions for cohorts with higher risk profiles.",
      ],
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
      generatedAt: new Date().toISOString(),
    };

    return result;
  }

  // ================== Custom Dashboard Views ==================

  async getCustomDashboards(userId: string): Promise<CustomDashboardView[]> {
    await logPhiAccess({ userId, action: "read", resourceType: "CustomDashboards", patientId: "aggregate", details: "Retrieved custom dashboards" });
    return Array.from(customDashboardViews.values()).filter(d => d.createdBy === userId || d.isShared || d.sharedWith.includes(userId));
  }

  async getCustomDashboard(userId: string, dashboardId: string): Promise<CustomDashboardView | null> {
    const dashboard = customDashboardViews.get(dashboardId);
    if (dashboard && (dashboard.createdBy === userId || dashboard.isShared || dashboard.sharedWith.includes(userId))) {
      await logPhiAccess({ userId, action: "read", resourceType: "CustomDashboard", patientId: "aggregate", details: `Retrieved dashboard: ${dashboardId}` });
      return dashboard;
    }
    return null;
  }

  async createCustomDashboard(userId: string, data: Omit<CustomDashboardView, "id" | "createdAt" | "updatedAt" | "createdBy">): Promise<CustomDashboardView> {
    const dashboard: CustomDashboardView = {
      ...data,
      id: generateId("dashboard"),
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    customDashboardViews.set(dashboard.id, dashboard);
    await logPhiAccess({ userId, action: "write", resourceType: "CustomDashboard", patientId: "aggregate", details: `Created dashboard: ${dashboard.name}` });
    return dashboard;
  }

  async updateCustomDashboard(userId: string, dashboardId: string, updates: Partial<CustomDashboardView>): Promise<CustomDashboardView | null> {
    const existing = customDashboardViews.get(dashboardId);
    if (!existing || existing.createdBy !== userId) {
      return null;
    }
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    customDashboardViews.set(dashboardId, updated);
    await logPhiAccess({ userId, action: "write", resourceType: "CustomDashboard", patientId: "aggregate", details: `Updated dashboard: ${dashboardId}` });
    return updated;
  }

  async deleteCustomDashboard(userId: string, dashboardId: string): Promise<boolean> {
    const existing = customDashboardViews.get(dashboardId);
    if (!existing || existing.createdBy !== userId) {
      return false;
    }
    customDashboardViews.delete(dashboardId);
    await logPhiAccess({ userId, action: "delete", resourceType: "CustomDashboard", patientId: "aggregate", details: `Deleted dashboard: ${dashboardId}` });
    return true;
  }

  getStakeholderPresets(): { type: CustomDashboardView["stakeholderType"]; name: string; description: string; defaultWidgets: string[] }[] {
    return [
      { type: "administrator", name: "Administrator View", description: "High-level operational and financial metrics", defaultWidgets: ["kpi_card", "trend_graph", "heatmap", "table"] },
      { type: "clinician", name: "Clinician View", description: "Patient outcomes and clinical quality metrics", defaultWidgets: ["cohort_chart", "trend_graph", "kpi_card", "table"] },
      { type: "analyst", name: "Analyst View", description: "Detailed analytics with drill-down capabilities", defaultWidgets: ["heatmap", "cohort_chart", "trend_graph", "bar_chart"] },
      { type: "executive", name: "Executive View", description: "Strategic KPIs and trend summaries", defaultWidgets: ["kpi_card", "gauge", "area_chart", "pie_chart"] },
      { type: "care_coordinator", name: "Care Coordinator View", description: "Patient engagement and care plan metrics", defaultWidgets: ["trend_graph", "table", "kpi_card", "cohort_chart"] },
    ];
  }
}

// Initialize sample cohorts
const sampleCohorts: CohortDefinition[] = [
  {
    id: "cohort_chronic_disease",
    name: "Chronic Disease Management",
    description: "Patients with multiple chronic conditions requiring coordinated care",
    criteria: [{ field: "chronic_conditions", operator: "greater_than", value: 2 }],
    createdBy: "system",
    createdAt: new Date().toISOString(),
    patientCount: 1245,
    isActive: true,
  },
  {
    id: "cohort_high_risk",
    name: "High Risk Patients",
    description: "Patients identified as high risk for adverse outcomes",
    criteria: [{ field: "risk_score", operator: "greater_than", value: 0.7 }],
    createdBy: "system",
    createdAt: new Date().toISOString(),
    patientCount: 432,
    isActive: true,
  },
  {
    id: "cohort_pediatric",
    name: "Pediatric Population",
    description: "Patients under 18 years of age",
    criteria: [{ field: "age", operator: "less_than", value: 18 }],
    createdBy: "system",
    createdAt: new Date().toISOString(),
    patientCount: 876,
    isActive: true,
  },
  {
    id: "cohort_geriatric",
    name: "Geriatric Population",
    description: "Patients 65 years and older",
    criteria: [{ field: "age", operator: "greater_than", value: 64 }],
    createdBy: "system",
    createdAt: new Date().toISOString(),
    patientCount: 1567,
    isActive: true,
  },
];

sampleCohorts.forEach(c => cohortDefinitions.set(c.id, c));

// Initialize sample custom dashboards
const sampleDashboards: CustomDashboardView[] = [
  {
    id: "dashboard_admin_default",
    name: "Administrator Dashboard",
    description: "Default view for healthcare administrators",
    stakeholderType: "administrator",
    layout: { columns: 12, rowHeight: 100, gap: 16, responsive: true },
    widgets: [
      { id: "w1", type: "kpi_card", title: "Total Patients", dataSource: "patient_count", config: {}, position: { x: 0, y: 0, width: 3, height: 1 }, drilldownEnabled: true },
      { id: "w2", type: "kpi_card", title: "Readmission Rate", dataSource: "readmission_rate", config: {}, position: { x: 3, y: 0, width: 3, height: 1 }, drilldownEnabled: true },
      { id: "w3", type: "trend_graph", title: "Patient Volume Trends", dataSource: "patient_volume", config: { timeRange: "90d" }, position: { x: 0, y: 1, width: 6, height: 2 }, drilldownEnabled: true },
      { id: "w4", type: "heatmap", title: "Department Activity", dataSource: "department_activity", config: {}, position: { x: 6, y: 1, width: 6, height: 2 }, drilldownEnabled: false },
    ],
    filters: [],
    theme: "system",
    refreshInterval: 300,
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
    isShared: true,
    sharedWith: [],
  },
  {
    id: "dashboard_clinician_default",
    name: "Clinician Dashboard",
    description: "Default view for clinical staff",
    stakeholderType: "clinician",
    layout: { columns: 12, rowHeight: 100, gap: 16, responsive: true },
    widgets: [
      { id: "w1", type: "cohort_chart", title: "Patient Outcomes by Cohort", dataSource: "cohort_outcomes", config: {}, position: { x: 0, y: 0, width: 6, height: 2 }, drilldownEnabled: true },
      { id: "w2", type: "trend_graph", title: "Clinical Quality Metrics", dataSource: "quality_metrics", config: {}, position: { x: 6, y: 0, width: 6, height: 2 }, drilldownEnabled: true },
      { id: "w3", type: "table", title: "High Risk Patients", dataSource: "high_risk_patients", config: {}, position: { x: 0, y: 2, width: 12, height: 2 }, drilldownEnabled: true },
    ],
    filters: [],
    theme: "system",
    refreshInterval: 300,
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDefault: true,
    isShared: true,
    sharedWith: [],
  },
];

sampleDashboards.forEach(d => customDashboardViews.set(d.id, d));

export const advancedReportingAnalytics = new AdvancedReportingAnalyticsService();
