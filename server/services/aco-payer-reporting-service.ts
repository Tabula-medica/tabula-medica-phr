import { logPhiAccess } from "../security/hipaa-audit";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

const NO_CDS_DISCLAIMER = "IMPORTANT: This report is for INFORMATIONAL and ADMINISTRATIVE purposes only. It does NOT constitute medical advice, diagnosis, or clinical decision support. All healthcare decisions must be made by qualified healthcare providers.";

// ================== HEDIS Measure Types ==================

export type HEDISMeasureCategory = 
  | "effectiveness_of_care"
  | "access_availability"
  | "experience_of_care"
  | "utilization"
  | "health_plan_descriptive"
  | "measures_collected_using_ecds";

export type HEDISMeasureCode = 
  | "BCS" | "CCS" | "COL" | "CHL" | "CDC" | "CWP" | "CBP" 
  | "SPR" | "AMM" | "FUH" | "FUM" | "ADD" | "PCR" | "IMA"
  | "W34" | "AWC" | "AAB" | "CIS" | "LSC" | "PPC" | "WCC";

export interface HEDISMeasure {
  code: HEDISMeasureCode;
  name: string;
  description: string;
  category: HEDISMeasureCategory;
  numerator: string;
  denominator: string;
  exclusions: string[];
  targetRate: number;
  nationalBenchmark: number;
  measureYear: number;
}

export interface HEDISResult {
  measureCode: HEDISMeasureCode;
  measureName: string;
  category: HEDISMeasureCategory;
  numerator: number;
  denominator: number;
  rate: number;
  targetRate: number;
  nationalBenchmark: number;
  percentile: number;
  starRating: 1 | 2 | 3 | 4 | 5;
  trend: "improving" | "declining" | "stable";
  gapCount: number;
  gapPatients: string[];
}

// ================== Report Types ==================

export type ReportType = 
  | "quality_metrics"
  | "population_health"
  | "provider_performance"
  | "compliance_audit"
  | "financial_summary"
  | "care_gap_analysis"
  | "risk_stratification"
  | "utilization_review";

export type ExportFormat = "csv" | "pdf" | "json" | "excel";

export type DeliveryMethod = "download" | "email" | "secure_portal" | "sftp";

export type ReportStatus = "pending" | "generating" | "completed" | "failed" | "expired";

export interface ReportFilter {
  dateRange: { start: string; end: string };
  providers?: string[];
  patientPopulation?: string[];
  measureCodes?: HEDISMeasureCode[];
  riskLevels?: ("low" | "moderate" | "high" | "critical")[];
  ageGroups?: string[];
  payerIds?: string[];
  facilityIds?: string[];
  diagnosisCodes?: string[];
}

export interface ReportConfiguration {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  filters: ReportFilter;
  sections: ReportSection[];
  exportFormats: ExportFormat[];
  schedule?: ReportSchedule;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isTemplate: boolean;
  organizationId: string;
}

export interface ReportSection {
  id: string;
  title: string;
  type: "summary" | "chart" | "table" | "metrics" | "narrative" | "compliance_checklist";
  order: number;
  dataSource: string;
  visualizationType?: "bar" | "line" | "pie" | "heatmap" | "table" | "scorecard";
  columns?: string[];
  metrics?: string[];
  includeInExport: boolean;
}

export interface ReportSchedule {
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "annually";
  dayOfWeek?: number;
  dayOfMonth?: number;
  time: string;
  timezone: string;
  recipients: ReportRecipient[];
  isActive: boolean;
}

export interface ReportRecipient {
  id: string;
  email: string;
  name: string;
  role: string;
  deliveryMethod: DeliveryMethod;
  encryptionRequired: boolean;
}

export interface GeneratedReport {
  id: string;
  configurationId: string;
  name: string;
  type: ReportType;
  status: ReportStatus;
  generatedAt: string;
  generatedBy: string;
  expiresAt: string;
  filters: ReportFilter;
  data: ReportData;
  exports: ReportExport[];
  deliveries: ReportDelivery[];
  auditInfo: ReportAuditInfo;
}

export interface ReportData {
  summary: ReportSummary;
  sections: GeneratedSection[];
  metadata: ReportMetadata;
  noCdsDisclaimer: string;
}

export interface ReportSummary {
  title: string;
  period: { start: string; end: string };
  generatedAt: string;
  totalPatients: number;
  totalProviders: number;
  keyMetrics: KeyMetric[];
  highlights: string[];
  alerts: ReportAlert[];
}

export interface KeyMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  target?: number;
  benchmark?: number;
  trend: "up" | "down" | "stable";
  trendPercent: number;
  status: "exceeds" | "meets" | "below" | "critical";
}

export interface ReportAlert {
  severity: "info" | "warning" | "critical";
  message: string;
  affectedCount: number;
  actionRequired: string;
}

export interface GeneratedSection {
  id: string;
  title: string;
  type: string;
  data: any;
  chartConfig?: any;
  tableData?: any[];
  narrative?: string;
}

export interface ReportMetadata {
  version: string;
  dataSourceTimestamp: string;
  patientCount: number;
  providerCount: number;
  facilityCount: number;
  measureYear: number;
  complianceStandards: string[];
}

export interface ReportExport {
  id: string;
  format: ExportFormat;
  fileName: string;
  fileSize: number;
  downloadUrl: string;
  downloadToken: string;
  expiresAt: string;
  createdAt: string;
  downloadCount: number;
  isEncrypted: boolean;
}

export interface ReportDelivery {
  id: string;
  recipientId: string;
  recipientEmail: string;
  method: DeliveryMethod;
  status: "pending" | "sent" | "delivered" | "failed" | "bounced";
  sentAt?: string;
  deliveredAt?: string;
  failureReason?: string;
  trackingId?: string;
}

export interface ReportAuditInfo {
  createdBy: string;
  createdAt: string;
  accessLog: ReportAccessLogEntry[];
  exportLog: ReportExportLogEntry[];
  deliveryLog: ReportDeliveryLogEntry[];
}

export interface ReportAccessLogEntry {
  userId: string;
  userName: string;
  action: "view" | "download" | "share" | "print";
  timestamp: string;
  ipAddress: string;
  userAgent: string;
}

export interface ReportExportLogEntry {
  userId: string;
  format: ExportFormat;
  timestamp: string;
  fileId: string;
}

export interface ReportDeliveryLogEntry {
  recipientId: string;
  method: DeliveryMethod;
  status: string;
  timestamp: string;
  details: string;
}

// ================== Population Health Types ==================

export interface PopulationHealthSummary {
  id: string;
  organizationId: string;
  reportPeriod: { start: string; end: string };
  totalPopulation: number;
  demographics: PopulationDemographics;
  riskStratification: RiskStratification;
  chronicConditions: ChronicConditionSummary[];
  careGaps: CareGapSummary[];
  utilizationMetrics: UtilizationMetrics;
  costMetrics: CostMetrics;
  qualityScores: QualityScorecard;
}

export interface PopulationDemographics {
  ageDistribution: { range: string; count: number; percent: number }[];
  genderDistribution: { gender: string; count: number; percent: number }[];
  ethnicityDistribution: { ethnicity: string; count: number; percent: number }[];
  geographicDistribution: { region: string; count: number; percent: number }[];
  insuranceDistribution: { type: string; count: number; percent: number }[];
}

export interface RiskStratification {
  lowRisk: { count: number; percent: number; avgCost: number };
  moderateRisk: { count: number; percent: number; avgCost: number };
  highRisk: { count: number; percent: number; avgCost: number };
  criticalRisk: { count: number; percent: number; avgCost: number };
  risingRisk: { count: number; percent: number; predictedCost: number };
}

export interface ChronicConditionSummary {
  condition: string;
  icdCode: string;
  prevalence: number;
  patientCount: number;
  avgCostPerPatient: number;
  managementRate: number;
  complicationRate: number;
}

export interface CareGapSummary {
  measureCode: string;
  measureName: string;
  gapCount: number;
  closedCount: number;
  closureRate: number;
  estimatedImpact: number;
  priorityLevel: "low" | "medium" | "high" | "critical";
}

export interface UtilizationMetrics {
  edVisits: { total: number; per1000: number; avoidable: number; trend: number };
  inpatientAdmissions: { total: number; per1000: number; readmissions: number; avgLos: number };
  outpatientVisits: { total: number; per1000: number; preventive: number };
  specialistReferrals: { total: number; per1000: number; avgWaitDays: number };
  prescriptions: { total: number; genericRate: number; adherenceRate: number };
}

export interface CostMetrics {
  totalCost: number;
  pmpm: number;
  costByCategory: { category: string; amount: number; percent: number }[];
  costTrend: { month: string; amount: number }[];
  savingsOpportunities: { area: string; estimatedSavings: number; confidence: number }[];
}

export interface QualityScorecard {
  overallScore: number;
  starRating: 1 | 2 | 3 | 4 | 5;
  categoryScores: { category: string; score: number; weight: number }[];
  hedisScores: { measure: string; score: number; benchmark: number }[];
  trendsVsPriorYear: { measure: string; currentScore: number; priorScore: number; change: number }[];
}

// ================== Provider Performance Types ==================

export interface ProviderPerformanceReport {
  id: string;
  providerId: string;
  providerName: string;
  providerNpi: string;
  specialty: string;
  reportPeriod: { start: string; end: string };
  patientPanel: ProviderPatientPanel;
  qualityMetrics: ProviderQualityMetrics;
  efficiencyMetrics: ProviderEfficiencyMetrics;
  patientExperience: PatientExperienceMetrics;
  complianceMetrics: ProviderComplianceMetrics;
  peerComparison: PeerComparison;
  incentiveEligibility: IncentiveEligibility;
}

export interface ProviderPatientPanel {
  totalPatients: number;
  newPatients: number;
  attributedPatients: number;
  riskAdjustedPanel: number;
  avgRiskScore: number;
  chronicConditionBreakdown: { condition: string; count: number }[];
}

export interface ProviderQualityMetrics {
  overallScore: number;
  hedisCompliance: { measure: string; numerator: number; denominator: number; rate: number; target: number }[];
  preventiveCareRate: number;
  chronicCareManagementRate: number;
  medicationAdherenceRate: number;
  careGapClosureRate: number;
}

export interface ProviderEfficiencyMetrics {
  costPerPatient: number;
  costVsBenchmark: number;
  utilizationRates: { category: string; rate: number; benchmark: number }[];
  referralPatterns: { specialty: string; count: number; appropriateness: number }[];
  genericPrescribingRate: number;
  avoidableEdRate: number;
  readmissionRate: number;
}

export interface PatientExperienceMetrics {
  overallSatisfaction: number;
  accessScore: number;
  communicationScore: number;
  careCoordinationScore: number;
  surveyResponseRate: number;
  complaintsCount: number;
  commendationsCount: number;
}

export interface ProviderComplianceMetrics {
  documentationCompleteness: number;
  codingAccuracy: number;
  timelySubmission: number;
  credentialingStatus: "current" | "expiring" | "expired";
  trainingCompleteness: number;
  auditFindings: number;
}

export interface PeerComparison {
  overallRanking: number;
  totalPeers: number;
  percentile: number;
  categoryRankings: { category: string; ranking: number; percentile: number }[];
  strengthAreas: string[];
  improvementAreas: string[];
}

export interface IncentiveEligibility {
  qualityBonus: { eligible: boolean; amount: number; criteria: string[] };
  efficiencyBonus: { eligible: boolean; amount: number; criteria: string[] };
  patientExperienceBonus: { eligible: boolean; amount: number; criteria: string[] };
  totalEligibleAmount: number;
  paymentDate: string;
}

// ================== Compliance Audit Types ==================

export interface ComplianceAuditReport {
  id: string;
  organizationId: string;
  auditPeriod: { start: string; end: string };
  auditType: "hipaa" | "regulatory" | "quality" | "financial" | "comprehensive";
  overallCompliance: number;
  riskLevel: "low" | "moderate" | "high" | "critical";
  findings: ComplianceFinding[];
  controls: ControlAssessment[];
  recommendations: ComplianceRecommendation[];
  attestations: ComplianceAttestation[];
  remediation: RemediationTracker;
}

export interface ComplianceFinding {
  id: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  evidence: string;
  regulation: string;
  impact: string;
  status: "open" | "in_progress" | "resolved" | "accepted_risk";
  dueDate: string;
  assignedTo: string;
}

export interface ControlAssessment {
  controlId: string;
  controlName: string;
  category: string;
  status: "effective" | "partially_effective" | "ineffective" | "not_applicable";
  testingDate: string;
  testingMethod: string;
  testingResult: string;
  evidence: string[];
  gaps: string[];
}

export interface ComplianceRecommendation {
  id: string;
  priority: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  expectedOutcome: string;
  estimatedEffort: string;
  estimatedCost: number;
  responsibleParty: string;
  targetDate: string;
}

export interface ComplianceAttestation {
  id: string;
  type: string;
  attestedBy: string;
  attestedDate: string;
  expirationDate: string;
  scope: string;
  status: "valid" | "expiring" | "expired";
  documentUrl: string;
}

export interface RemediationTracker {
  totalFindings: number;
  openFindings: number;
  inProgressFindings: number;
  resolvedFindings: number;
  overdueFindings: number;
  avgResolutionDays: number;
  trendByMonth: { month: string; opened: number; closed: number }[];
}

// ================== In-Memory Storage ==================

const hedisDefinitions: Map<HEDISMeasureCode, HEDISMeasure> = new Map();
const reportConfigurations: Map<string, ReportConfiguration> = new Map();
const generatedReports: Map<string, GeneratedReport> = new Map();
const reportExports: Map<string, ReportExport> = new Map();
const secureDownloadTokens: Map<string, { reportId: string; exportId: string; expiresAt: string; usageCount: number }> = new Map();

// Initialize HEDIS measure definitions
function initializeHEDISMeasures() {
  const measures: HEDISMeasure[] = [
    {
      code: "BCS",
      name: "Breast Cancer Screening",
      description: "Women 50-74 who had a mammogram to screen for breast cancer",
      category: "effectiveness_of_care",
      numerator: "Women with mammogram during measurement period",
      denominator: "Women 50-74 years of age",
      exclusions: ["Bilateral mastectomy", "Two unilateral mastectomies"],
      targetRate: 75,
      nationalBenchmark: 77.4,
      measureYear: 2024
    },
    {
      code: "CCS",
      name: "Cervical Cancer Screening",
      description: "Women 21-64 who were screened for cervical cancer",
      category: "effectiveness_of_care",
      numerator: "Women with cervical cytology or hrHPV test",
      denominator: "Women 21-64 years of age",
      exclusions: ["Hysterectomy with no residual cervix"],
      targetRate: 80,
      nationalBenchmark: 81.2,
      measureYear: 2024
    },
    {
      code: "COL",
      name: "Colorectal Cancer Screening",
      description: "Adults 45-75 who had appropriate screening for colorectal cancer",
      category: "effectiveness_of_care",
      numerator: "Members with colorectal cancer screening",
      denominator: "Members 45-75 years of age",
      exclusions: ["Colorectal cancer", "Total colectomy"],
      targetRate: 72,
      nationalBenchmark: 72.1,
      measureYear: 2024
    },
    {
      code: "CDC",
      name: "Comprehensive Diabetes Care",
      description: "Adults 18-75 with diabetes and hemoglobin A1c testing",
      category: "effectiveness_of_care",
      numerator: "Members with HbA1c testing and control",
      denominator: "Members 18-75 with diabetes",
      exclusions: ["ESRD", "Dialysis", "Kidney transplant"],
      targetRate: 85,
      nationalBenchmark: 84.5,
      measureYear: 2024
    },
    {
      code: "CBP",
      name: "Controlling High Blood Pressure",
      description: "Adults 18-85 with diagnosed hypertension with adequate BP control",
      category: "effectiveness_of_care",
      numerator: "Members with BP <140/90 mmHg",
      denominator: "Members 18-85 with hypertension",
      exclusions: ["ESRD", "Dialysis", "Kidney transplant", "Pregnancy"],
      targetRate: 70,
      nationalBenchmark: 68.9,
      measureYear: 2024
    },
    {
      code: "AMM",
      name: "Antidepressant Medication Management",
      description: "Adults with new episode of major depression treated with antidepressant",
      category: "effectiveness_of_care",
      numerator: "Members on antidepressant medication for acute and continuation phases",
      denominator: "Members 18+ with new episode of major depression",
      exclusions: [],
      targetRate: 65,
      nationalBenchmark: 63.2,
      measureYear: 2024
    },
    {
      code: "FUH",
      name: "Follow-Up After Hospitalization for Mental Illness",
      description: "Follow-up with mental health provider within 7 and 30 days of discharge",
      category: "effectiveness_of_care",
      numerator: "Members with follow-up visit after discharge",
      denominator: "Members 6+ discharged from mental health hospitalization",
      exclusions: ["Readmission within timeframe"],
      targetRate: 60,
      nationalBenchmark: 58.7,
      measureYear: 2024
    },
    {
      code: "PCR",
      name: "Plan All-Cause Readmissions",
      description: "Adults 18+ with acute inpatient stay and unplanned readmission within 30 days",
      category: "utilization",
      numerator: "Index admissions with readmission within 30 days",
      denominator: "Index admissions for members 18-64",
      exclusions: ["Planned readmissions", "Specific diagnoses"],
      targetRate: 10,
      nationalBenchmark: 11.2,
      measureYear: 2024
    },
    {
      code: "IMA",
      name: "Immunizations for Adolescents",
      description: "Adolescents 13 years old with recommended immunizations",
      category: "effectiveness_of_care",
      numerator: "Members with complete immunization series",
      denominator: "Members who turned 13 during measurement year",
      exclusions: ["Contraindications"],
      targetRate: 80,
      nationalBenchmark: 78.5,
      measureYear: 2024
    },
    {
      code: "W34",
      name: "Well-Child Visits in First 30 Months",
      description: "Children with well-child visits in first 30 months of life",
      category: "access_availability",
      numerator: "Children with appropriate number of well-child visits",
      denominator: "Children who turned 30 months during measurement year",
      exclusions: [],
      targetRate: 75,
      nationalBenchmark: 74.2,
      measureYear: 2024
    },
    {
      code: "AWC",
      name: "Adolescent Well-Care Visits",
      description: "Adolescents 12-21 with at least one comprehensive well-care visit",
      category: "access_availability",
      numerator: "Members with well-care visit during measurement period",
      denominator: "Members 12-21 years of age",
      exclusions: [],
      targetRate: 65,
      nationalBenchmark: 63.8,
      measureYear: 2024
    },
    {
      code: "AAB",
      name: "Avoidance of Antibiotic Treatment for Acute Bronchitis",
      description: "Adults with acute bronchitis who were not dispensed antibiotics",
      category: "effectiveness_of_care",
      numerator: "Members without antibiotic dispensing",
      denominator: "Members 18+ with acute bronchitis diagnosis",
      exclusions: ["Competing diagnoses", "Hospice"],
      targetRate: 50,
      nationalBenchmark: 48.3,
      measureYear: 2024
    }
  ];

  measures.forEach(m => hedisDefinitions.set(m.code, m));
}

initializeHEDISMeasures();

// ================== HEDIS Calculation Functions ==================

export function getHEDISMeasureDefinition(code: HEDISMeasureCode): HEDISMeasure | undefined {
  return hedisDefinitions.get(code);
}

export function getAllHEDISMeasures(): HEDISMeasure[] {
  return Array.from(hedisDefinitions.values());
}

export function calculateHEDISResults(
  organizationId: string,
  measureCodes: HEDISMeasureCode[],
  filters: ReportFilter
): HEDISResult[] {
  logPhiAccess({
    userId: "system",
    action: "read",
    resourceType: "quality_metrics",
    resourceId: organizationId,
    details: `Calculate HEDIS measures: ${measureCodes.join(", ")}`
  });

  return measureCodes.map(code => {
    const definition = hedisDefinitions.get(code);
    if (!definition) {
      throw new Error(`Unknown HEDIS measure: ${code}`);
    }

    const numerator = Math.floor(Math.random() * 800) + 200;
    const denominator = Math.floor(Math.random() * 300) + numerator;
    const rate = Math.round((numerator / denominator) * 1000) / 10;
    const percentile = Math.min(99, Math.max(1, Math.floor((rate / definition.nationalBenchmark) * 50) + Math.floor(Math.random() * 30)));
    
    let starRating: 1 | 2 | 3 | 4 | 5;
    if (rate >= definition.targetRate * 1.1) starRating = 5;
    else if (rate >= definition.targetRate) starRating = 4;
    else if (rate >= definition.targetRate * 0.9) starRating = 3;
    else if (rate >= definition.targetRate * 0.75) starRating = 2;
    else starRating = 1;

    const priorRate = rate + (Math.random() - 0.5) * 10;
    let trend: "improving" | "declining" | "stable";
    if (rate > priorRate + 2) trend = "improving";
    else if (rate < priorRate - 2) trend = "declining";
    else trend = "stable";

    const gapCount = denominator - numerator;
    const gapPatients = Array.from({ length: Math.min(10, gapCount) }, (_, i) => 
      `patient_${code.toLowerCase()}_gap_${i + 1}`
    );

    return {
      measureCode: code,
      measureName: definition.name,
      category: definition.category,
      numerator,
      denominator,
      rate,
      targetRate: definition.targetRate,
      nationalBenchmark: definition.nationalBenchmark,
      percentile,
      starRating,
      trend,
      gapCount,
      gapPatients
    };
  });
}

// ================== Report Generation Functions ==================

export function createReportConfiguration(config: Omit<ReportConfiguration, "id" | "createdAt" | "updatedAt">): ReportConfiguration {
  const reportConfig: ReportConfiguration = {
    ...config,
    id: generateId("rptcfg"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  reportConfigurations.set(reportConfig.id, reportConfig);

  logPhiAccess({
    userId: config.createdBy,
    action: "write",
    resourceType: "report_configuration",
    resourceId: reportConfig.id,
    details: `Created report config: ${config.name} (${config.type})`
  });

  return reportConfig;
}

export function getReportConfiguration(configId: string): ReportConfiguration | undefined {
  return reportConfigurations.get(configId);
}

export function listReportConfigurations(organizationId: string, type?: ReportType): ReportConfiguration[] {
  return Array.from(reportConfigurations.values())
    .filter(c => c.organizationId === organizationId && (!type || c.type === type));
}

export async function generateReport(
  configId: string,
  generatedBy: string,
  overrideFilters?: Partial<ReportFilter>
): Promise<GeneratedReport> {
  const config = reportConfigurations.get(configId);
  if (!config) {
    throw new Error("Report configuration not found");
  }

  const filters = { ...config.filters, ...overrideFilters };
  const reportId = generateId("rpt");

  const report: GeneratedReport = {
    id: reportId,
    configurationId: configId,
    name: config.name,
    type: config.type,
    status: "generating",
    generatedAt: new Date().toISOString(),
    generatedBy,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    filters,
    data: await generateReportData(config, filters),
    exports: [],
    deliveries: [],
    auditInfo: {
      createdBy: generatedBy,
      createdAt: new Date().toISOString(),
      accessLog: [],
      exportLog: [],
      deliveryLog: []
    }
  };

  report.status = "completed";
  generatedReports.set(reportId, report);

  logPhiAccess({
    userId: generatedBy,
    action: "write",
    resourceType: "generated_report",
    resourceId: reportId,
    details: `Generated report: ${config.name} (${config.type})`
  });

  return report;
}

async function generateReportData(config: ReportConfiguration, filters: ReportFilter): Promise<ReportData> {
  const sections: GeneratedSection[] = [];
  const keyMetrics: KeyMetric[] = [];
  const alerts: ReportAlert[] = [];

  switch (config.type) {
    case "quality_metrics":
      const hedisResults = calculateHEDISResults(
        config.organizationId,
        (filters.measureCodes || ["BCS", "CCS", "COL", "CDC", "CBP"]) as HEDISMeasureCode[],
        filters
      );
      
      sections.push({
        id: "hedis_summary",
        title: "HEDIS Quality Measures Summary",
        type: "metrics",
        data: hedisResults,
        tableData: hedisResults.map(r => ({
          measure: r.measureName,
          rate: `${r.rate}%`,
          target: `${r.targetRate}%`,
          benchmark: `${r.nationalBenchmark}%`,
          stars: "★".repeat(r.starRating),
          trend: r.trend,
          gaps: r.gapCount
        }))
      });

      hedisResults.forEach(r => {
        keyMetrics.push({
          id: r.measureCode,
          name: r.measureName,
          value: r.rate,
          unit: "%",
          target: r.targetRate,
          benchmark: r.nationalBenchmark,
          trend: r.trend === "improving" ? "up" : r.trend === "declining" ? "down" : "stable",
          trendPercent: Math.random() * 10 - 5,
          status: r.rate >= r.targetRate ? "meets" : r.rate >= r.targetRate * 0.9 ? "below" : "critical"
        });

        if (r.rate < r.targetRate * 0.9) {
          alerts.push({
            severity: "warning",
            message: `${r.measureName} is below target at ${r.rate}%`,
            affectedCount: r.gapCount,
            actionRequired: "Review care gap patients and implement outreach"
          });
        }
      });
      break;

    case "population_health":
      sections.push(
        {
          id: "demographics",
          title: "Population Demographics",
          type: "chart",
          data: generateDemographicsData(),
          chartConfig: { type: "pie" }
        },
        {
          id: "risk_stratification",
          title: "Risk Stratification",
          type: "chart",
          data: generateRiskStratificationData(),
          chartConfig: { type: "bar" }
        },
        {
          id: "chronic_conditions",
          title: "Chronic Condition Prevalence",
          type: "table",
          data: generateChronicConditionsData(),
          tableData: generateChronicConditionsData()
        },
        {
          id: "care_gaps",
          title: "Care Gap Analysis",
          type: "table",
          data: generateCareGapsData(),
          tableData: generateCareGapsData()
        }
      );

      keyMetrics.push(
        { id: "total_pop", name: "Total Population", value: 45678, unit: "patients", trend: "up", trendPercent: 3.2, status: "meets" },
        { id: "high_risk", name: "High Risk Patients", value: 12.5, unit: "%", target: 10, trend: "down", trendPercent: -1.8, status: "below" },
        { id: "care_gaps", name: "Open Care Gaps", value: 8234, unit: "gaps", target: 5000, trend: "down", trendPercent: -5.2, status: "below" },
        { id: "chronic_mgmt", name: "Chronic Care Management", value: 78.5, unit: "%", target: 80, trend: "up", trendPercent: 2.1, status: "meets" }
      );
      break;

    case "provider_performance":
      sections.push(
        {
          id: "quality_scores",
          title: "Provider Quality Scores",
          type: "table",
          data: generateProviderQualityData(),
          tableData: generateProviderQualityData()
        },
        {
          id: "efficiency",
          title: "Efficiency Metrics",
          type: "chart",
          data: generateProviderEfficiencyData(),
          chartConfig: { type: "bar" }
        },
        {
          id: "patient_experience",
          title: "Patient Experience",
          type: "metrics",
          data: generatePatientExperienceData()
        }
      );

      keyMetrics.push(
        { id: "avg_quality", name: "Average Quality Score", value: 82.5, unit: "pts", target: 85, trend: "up", trendPercent: 3.1, status: "meets" },
        { id: "top_performers", name: "Top Performers", value: 24, unit: "providers", trend: "up", trendPercent: 8.3, status: "exceeds" },
        { id: "improvement_needed", name: "Improvement Needed", value: 8, unit: "providers", trend: "down", trendPercent: -12.5, status: "meets" }
      );
      break;

    case "compliance_audit":
      sections.push(
        {
          id: "compliance_overview",
          title: "Compliance Overview",
          type: "metrics",
          data: generateComplianceOverviewData()
        },
        {
          id: "findings",
          title: "Audit Findings",
          type: "table",
          data: generateAuditFindingsData(),
          tableData: generateAuditFindingsData()
        },
        {
          id: "controls",
          title: "Control Assessments",
          type: "table",
          data: generateControlAssessmentsData(),
          tableData: generateControlAssessmentsData()
        },
        {
          id: "remediation",
          title: "Remediation Status",
          type: "chart",
          data: generateRemediationData(),
          chartConfig: { type: "pie" }
        }
      );

      keyMetrics.push(
        { id: "overall_compliance", name: "Overall Compliance", value: 94.2, unit: "%", target: 95, trend: "up", trendPercent: 1.5, status: "meets" },
        { id: "open_findings", name: "Open Findings", value: 12, unit: "findings", target: 5, trend: "down", trendPercent: -25, status: "below" },
        { id: "hipaa_score", name: "HIPAA Compliance", value: 98.5, unit: "%", target: 100, trend: "stable", trendPercent: 0, status: "meets" },
        { id: "overdue_items", name: "Overdue Remediation", value: 3, unit: "items", target: 0, trend: "down", trendPercent: -40, status: "below" }
      );

      if (keyMetrics.find(m => m.id === "open_findings")!.value > 10) {
        alerts.push({
          severity: "warning",
          message: "Open findings exceed threshold - immediate attention required",
          affectedCount: 12,
          actionRequired: "Assign owners and create remediation plans"
        });
      }
      break;
  }

  return {
    summary: {
      title: config.name,
      period: { start: filters.dateRange.start, end: filters.dateRange.end },
      generatedAt: new Date().toISOString(),
      totalPatients: 45678,
      totalProviders: 156,
      keyMetrics,
      highlights: generateHighlights(config.type),
      alerts
    },
    sections,
    metadata: {
      version: "1.0",
      dataSourceTimestamp: new Date().toISOString(),
      patientCount: 45678,
      providerCount: 156,
      facilityCount: 12,
      measureYear: 2024,
      complianceStandards: ["HIPAA", "HEDIS 2024", "CMS Quality"]
    },
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  };
}

// Helper functions for generating mock data
function generateDemographicsData() {
  return {
    ageDistribution: [
      { range: "0-17", count: 8234, percent: 18 },
      { range: "18-34", count: 9567, percent: 21 },
      { range: "35-49", count: 10234, percent: 22 },
      { range: "50-64", count: 11456, percent: 25 },
      { range: "65+", count: 6187, percent: 14 }
    ],
    genderDistribution: [
      { gender: "Female", count: 24567, percent: 54 },
      { gender: "Male", count: 20890, percent: 46 },
      { gender: "Other", count: 221, percent: 0.5 }
    ]
  };
}

function generateRiskStratificationData() {
  return {
    lowRisk: { count: 25678, percent: 56, avgCost: 2340 },
    moderateRisk: { count: 12456, percent: 27, avgCost: 5670 },
    highRisk: { count: 5678, percent: 12, avgCost: 15890 },
    criticalRisk: { count: 1866, percent: 5, avgCost: 45670 }
  };
}

function generateChronicConditionsData() {
  return [
    { condition: "Diabetes Type 2", icdCode: "E11", prevalence: 12.5, patientCount: 5710, avgCostPerPatient: 8900, managementRate: 78 },
    { condition: "Hypertension", icdCode: "I10", prevalence: 28.4, patientCount: 12972, avgCostPerPatient: 4500, managementRate: 82 },
    { condition: "COPD", icdCode: "J44", prevalence: 6.8, patientCount: 3106, avgCostPerPatient: 12300, managementRate: 71 },
    { condition: "Heart Failure", icdCode: "I50", prevalence: 4.2, patientCount: 1918, avgCostPerPatient: 18500, managementRate: 68 },
    { condition: "Depression", icdCode: "F32", prevalence: 15.3, patientCount: 6989, avgCostPerPatient: 6200, managementRate: 65 }
  ];
}

function generateCareGapsData() {
  return [
    { measureCode: "BCS", measureName: "Breast Cancer Screening", gapCount: 1234, closedCount: 3456, closureRate: 74, priority: "high" },
    { measureCode: "CDC", measureName: "Diabetes Care - HbA1c", gapCount: 876, closedCount: 4567, closureRate: 84, priority: "critical" },
    { measureCode: "CBP", measureName: "Blood Pressure Control", gapCount: 2345, closedCount: 8901, closureRate: 79, priority: "high" },
    { measureCode: "COL", measureName: "Colorectal Screening", gapCount: 1567, closedCount: 2890, closureRate: 65, priority: "medium" }
  ];
}

function generateProviderQualityData() {
  return Array.from({ length: 10 }, (_, i) => ({
    providerId: `prov_${i + 1}`,
    providerName: `Dr. ${["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"][i]}`,
    specialty: ["Family Medicine", "Internal Medicine", "Pediatrics", "Cardiology", "Endocrinology"][i % 5],
    qualityScore: Math.floor(70 + Math.random() * 25),
    hedisCompliance: Math.floor(65 + Math.random() * 30),
    patientSatisfaction: Math.floor(75 + Math.random() * 20),
    panelSize: Math.floor(800 + Math.random() * 700),
    ranking: i + 1
  }));
}

function generateProviderEfficiencyData() {
  return {
    costPerPatient: { value: 4567, benchmark: 5200, variance: -12.2 },
    readmissionRate: { value: 8.5, benchmark: 11.2, variance: -24.1 },
    edUtilization: { value: 145, benchmark: 180, variance: -19.4 },
    genericPrescribing: { value: 89, benchmark: 85, variance: 4.7 }
  };
}

function generatePatientExperienceData() {
  return {
    overallSatisfaction: 4.2,
    accessScore: 4.0,
    communicationScore: 4.4,
    careCoordinationScore: 3.9,
    recommendationRate: 87
  };
}

function generateComplianceOverviewData() {
  return {
    hipaaCompliance: 98.5,
    regulatoryCompliance: 94.2,
    qualityCompliance: 89.7,
    financialCompliance: 96.1,
    lastAuditDate: "2024-11-15",
    nextAuditDate: "2025-02-15"
  };
}

function generateAuditFindingsData() {
  return [
    { id: "F001", category: "HIPAA", severity: "medium", title: "Incomplete access logs", status: "in_progress", dueDate: "2025-02-28" },
    { id: "F002", category: "Quality", severity: "low", title: "Documentation gaps in care plans", status: "open", dueDate: "2025-03-15" },
    { id: "F003", category: "Financial", severity: "high", title: "Coding accuracy below threshold", status: "in_progress", dueDate: "2025-02-15" },
    { id: "F004", category: "HIPAA", severity: "low", title: "Training documentation incomplete", status: "resolved", dueDate: "2025-01-30" }
  ];
}

function generateControlAssessmentsData() {
  return [
    { controlId: "AC-1", controlName: "Access Control Policy", status: "effective", lastTested: "2025-01-15" },
    { controlId: "AC-2", controlName: "Account Management", status: "partially_effective", lastTested: "2025-01-10" },
    { controlId: "AU-1", controlName: "Audit Policy", status: "effective", lastTested: "2025-01-20" },
    { controlId: "SC-1", controlName: "System Protection Policy", status: "effective", lastTested: "2025-01-18" }
  ];
}

function generateRemediationData() {
  return {
    open: 5,
    inProgress: 4,
    resolved: 23,
    overdue: 3,
    avgResolutionDays: 18
  };
}

function generateHighlights(type: ReportType): string[] {
  switch (type) {
    case "quality_metrics":
      return [
        "Overall HEDIS performance improved 3.2% from prior year",
        "Breast Cancer Screening exceeded national benchmark",
        "Diabetes care management shows consistent improvement",
        "8,234 care gap opportunities identified for outreach"
      ];
    case "population_health":
      return [
        "Total attributed population: 45,678 members",
        "High-risk population decreased 1.8% quarter-over-quarter",
        "Chronic disease management rates improving across all conditions",
        "Care gap closure rate at 76%, above target of 70%"
      ];
    case "provider_performance":
      return [
        "24 providers achieved top performer status",
        "Average quality score increased to 82.5 points",
        "Cost efficiency improved 12% vs benchmark",
        "Patient satisfaction scores stable at 4.2/5.0"
      ];
    case "compliance_audit":
      return [
        "Overall compliance score: 94.2%",
        "HIPAA compliance at 98.5%",
        "12 open findings requiring attention",
        "Remediation progress: 75% on schedule"
      ];
    default:
      return [];
  }
}

// ================== Export Functions ==================

export function generateCSVExport(reportId: string, userId: string): ReportExport {
  const report = generatedReports.get(reportId);
  if (!report) {
    throw new Error("Report not found");
  }

  const csvContent = generateCSVContent(report);
  const exportId = generateId("exp");
  const downloadToken = generateId("dlt");
  
  const exportRecord: ReportExport = {
    id: exportId,
    format: "csv",
    fileName: `${report.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.csv`,
    fileSize: csvContent.length,
    downloadUrl: `/api/aco-reporting/download/${exportId}`,
    downloadToken,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    downloadCount: 0,
    isEncrypted: false
  };

  reportExports.set(exportId, exportRecord);
  secureDownloadTokens.set(downloadToken, {
    reportId,
    exportId,
    expiresAt: exportRecord.expiresAt,
    usageCount: 0
  });

  report.exports.push(exportRecord);
  report.auditInfo.exportLog.push({
    userId,
    format: "csv",
    timestamp: new Date().toISOString(),
    fileId: exportId
  });

  logPhiAccess({
    userId,
    action: "export",
    resourceType: "report_export",
    resourceId: exportId,
    details: `Export report CSV: ${exportRecord.fileName}`
  });

  return exportRecord;
}

export function generatePDFExport(reportId: string, userId: string): ReportExport {
  const report = generatedReports.get(reportId);
  if (!report) {
    throw new Error("Report not found");
  }

  const pdfContent = generatePDFContent(report);
  const exportId = generateId("exp");
  const downloadToken = generateId("dlt");
  
  const exportRecord: ReportExport = {
    id: exportId,
    format: "pdf",
    fileName: `${report.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`,
    fileSize: pdfContent.length,
    downloadUrl: `/api/aco-reporting/download/${exportId}`,
    downloadToken,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    downloadCount: 0,
    isEncrypted: true
  };

  reportExports.set(exportId, exportRecord);
  secureDownloadTokens.set(downloadToken, {
    reportId,
    exportId,
    expiresAt: exportRecord.expiresAt,
    usageCount: 0
  });

  report.exports.push(exportRecord);
  report.auditInfo.exportLog.push({
    userId,
    format: "pdf",
    timestamp: new Date().toISOString(),
    fileId: exportId
  });

  logPhiAccess({
    userId,
    action: "export",
    resourceType: "report_export",
    resourceId: exportId,
    details: `Export report PDF: ${exportRecord.fileName}`
  });

  return exportRecord;
}

function generateCSVContent(report: GeneratedReport): string {
  const lines: string[] = [];
  
  lines.push(`"Report: ${report.name}"`);
  lines.push(`"Generated: ${report.generatedAt}"`);
  lines.push(`"Period: ${report.filters.dateRange.start} to ${report.filters.dateRange.end}"`);
  lines.push("");
  
  lines.push(`"${NO_CDS_DISCLAIMER}"`);
  lines.push("");
  
  lines.push('"Key Metrics"');
  lines.push('"Metric","Value","Unit","Target","Status","Trend"');
  report.data.summary.keyMetrics.forEach(m => {
    lines.push(`"${m.name}","${m.value}","${m.unit}","${m.target || "N/A"}","${m.status}","${m.trend}"`);
  });
  lines.push("");
  
  report.data.sections.forEach(section => {
    lines.push(`"${section.title}"`);
    if (section.tableData && Array.isArray(section.tableData)) {
      if (section.tableData.length > 0) {
        const headers = Object.keys(section.tableData[0]);
        lines.push(headers.map(h => `"${h}"`).join(","));
        section.tableData.forEach(row => {
          lines.push(headers.map(h => `"${(row as any)[h]}"`).join(","));
        });
      }
    }
    lines.push("");
  });

  return lines.join("\n");
}

function generatePDFContent(report: GeneratedReport): string {
  const content = {
    title: report.name,
    generatedAt: report.generatedAt,
    period: report.filters.dateRange,
    summary: report.data.summary,
    sections: report.data.sections,
    disclaimer: NO_CDS_DISCLAIMER,
    metadata: report.data.metadata
  };
  
  return JSON.stringify(content, null, 2);
}

// ================== Secure Download Functions ==================

export function validateDownloadToken(token: string): { valid: boolean; exportId?: string; reason?: string } {
  const tokenData = secureDownloadTokens.get(token);
  
  if (!tokenData) {
    return { valid: false, reason: "Invalid or expired token" };
  }
  
  if (new Date(tokenData.expiresAt) < new Date()) {
    secureDownloadTokens.delete(token);
    return { valid: false, reason: "Token expired" };
  }
  
  if (tokenData.usageCount >= 5) {
    return { valid: false, reason: "Download limit exceeded" };
  }
  
  tokenData.usageCount++;
  
  return { valid: true, exportId: tokenData.exportId };
}

export function getExportContent(exportId: string): { content: string; fileName: string; contentType: string } | null {
  const exportRecord = reportExports.get(exportId);
  if (!exportRecord) {
    return null;
  }

  const report = Array.from(generatedReports.values()).find(r => 
    r.exports.some(e => e.id === exportId)
  );
  
  if (!report) {
    return null;
  }

  exportRecord.downloadCount++;

  let content: string;
  let contentType: string;
  
  if (exportRecord.format === "csv") {
    content = generateCSVContent(report);
    contentType = "text/csv";
  } else {
    content = generatePDFContent(report);
    contentType = "application/json";
  }

  return {
    content,
    fileName: exportRecord.fileName,
    contentType
  };
}

// ================== Report Delivery Functions ==================

export function scheduleReportDelivery(
  reportId: string,
  recipients: ReportRecipient[],
  scheduledBy: string
): ReportDelivery[] {
  const report = generatedReports.get(reportId);
  if (!report) {
    throw new Error("Report not found");
  }

  const deliveries: ReportDelivery[] = recipients.map(recipient => {
    const delivery: ReportDelivery = {
      id: generateId("dlv"),
      recipientId: recipient.id,
      recipientEmail: recipient.email,
      method: recipient.deliveryMethod,
      status: "pending",
      trackingId: generateId("trk")
    };

    report.deliveries.push(delivery);
    report.auditInfo.deliveryLog.push({
      recipientId: recipient.id,
      method: recipient.deliveryMethod,
      status: "scheduled",
      timestamp: new Date().toISOString(),
      details: `Scheduled by ${scheduledBy}`
    });

    return delivery;
  });

  logPhiAccess({
    userId: scheduledBy,
    action: "write",
    resourceType: "report_delivery",
    resourceId: reportId,
    details: `Scheduled report delivery to ${recipients.length} recipients`
  });

  return deliveries;
}

export function getReportDeliveryStatus(reportId: string): ReportDelivery[] {
  const report = generatedReports.get(reportId);
  return report?.deliveries || [];
}

// ================== Dashboard Functions ==================

export interface ACODashboardData {
  qualityOverview: {
    overallScore: number;
    starRating: 1 | 2 | 3 | 4 | 5;
    hedisPerformance: { measure: string; rate: number; target: number; status: string }[];
    trendsVsPriorYear: number;
  };
  populationHealth: {
    totalMembers: number;
    riskDistribution: { level: string; count: number; percent: number }[];
    topConditions: { name: string; prevalence: number }[];
    careGapsSummary: { total: number; closed: number; closureRate: number };
  };
  providerPerformance: {
    totalProviders: number;
    topPerformers: number;
    improvementNeeded: number;
    avgQualityScore: number;
  };
  compliance: {
    overallScore: number;
    openFindings: number;
    upcomingDeadlines: { item: string; date: string }[];
  };
  recentReports: { id: string; name: string; type: string; generatedAt: string; status: string }[];
}

export function getACODashboardData(organizationId: string): ACODashboardData {
  logPhiAccess({
    userId: "system",
    action: "read",
    resourceType: "dashboard",
    resourceId: organizationId,
    details: `View ACO dashboard for organization ${organizationId}`
  });

  return {
    qualityOverview: {
      overallScore: 84.2,
      starRating: 4,
      hedisPerformance: [
        { measure: "Breast Cancer Screening", rate: 78.5, target: 75, status: "exceeds" },
        { measure: "Diabetes Care - HbA1c", rate: 82.1, target: 85, status: "below" },
        { measure: "Blood Pressure Control", rate: 71.3, target: 70, status: "meets" },
        { measure: "Colorectal Screening", rate: 68.9, target: 72, status: "below" },
        { measure: "Depression Follow-up", rate: 62.4, target: 60, status: "meets" }
      ],
      trendsVsPriorYear: 3.2
    },
    populationHealth: {
      totalMembers: 45678,
      riskDistribution: [
        { level: "Low", count: 25678, percent: 56 },
        { level: "Moderate", count: 12456, percent: 27 },
        { level: "High", count: 5678, percent: 12 },
        { level: "Critical", count: 1866, percent: 5 }
      ],
      topConditions: [
        { name: "Hypertension", prevalence: 28.4 },
        { name: "Depression", prevalence: 15.3 },
        { name: "Diabetes Type 2", prevalence: 12.5 },
        { name: "COPD", prevalence: 6.8 },
        { name: "Heart Failure", prevalence: 4.2 }
      ],
      careGapsSummary: { total: 8234, closed: 6176, closureRate: 75 }
    },
    providerPerformance: {
      totalProviders: 156,
      topPerformers: 24,
      improvementNeeded: 8,
      avgQualityScore: 82.5
    },
    compliance: {
      overallScore: 94.2,
      openFindings: 12,
      upcomingDeadlines: [
        { item: "HEDIS Submission", date: "2025-03-31" },
        { item: "Quality Review", date: "2025-02-28" },
        { item: "Compliance Training", date: "2025-02-15" }
      ]
    },
    recentReports: Array.from(generatedReports.values())
      .slice(-5)
      .map(r => ({
        id: r.id,
        name: r.name,
        type: r.type,
        generatedAt: r.generatedAt,
        status: r.status
      }))
  };
}

// ================== Template Functions ==================

const reportTemplates: ReportConfiguration[] = [
  {
    id: "tpl_quality_quarterly",
    name: "Quarterly Quality Metrics Report",
    description: "Comprehensive HEDIS measures and quality performance analysis",
    type: "quality_metrics",
    filters: {
      dateRange: { start: "", end: "" },
      measureCodes: ["BCS", "CCS", "COL", "CDC", "CBP", "AMM", "FUH"] as HEDISMeasureCode[]
    },
    sections: [
      { id: "s1", title: "Executive Summary", type: "summary", order: 1, dataSource: "summary", includeInExport: true },
      { id: "s2", title: "HEDIS Performance", type: "table", order: 2, dataSource: "hedis", visualizationType: "table", includeInExport: true },
      { id: "s3", title: "Trends Analysis", type: "chart", order: 3, dataSource: "trends", visualizationType: "line", includeInExport: true },
      { id: "s4", title: "Care Gap Analysis", type: "table", order: 4, dataSource: "gaps", includeInExport: true }
    ],
    exportFormats: ["csv", "pdf"],
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isTemplate: true,
    organizationId: "system"
  },
  {
    id: "tpl_population_monthly",
    name: "Monthly Population Health Summary",
    description: "Population demographics, risk stratification, and health trends",
    type: "population_health",
    filters: { dateRange: { start: "", end: "" } },
    sections: [
      { id: "s1", title: "Population Overview", type: "summary", order: 1, dataSource: "population", includeInExport: true },
      { id: "s2", title: "Demographics", type: "chart", order: 2, dataSource: "demographics", visualizationType: "pie", includeInExport: true },
      { id: "s3", title: "Risk Stratification", type: "chart", order: 3, dataSource: "risk", visualizationType: "bar", includeInExport: true },
      { id: "s4", title: "Chronic Conditions", type: "table", order: 4, dataSource: "conditions", includeInExport: true }
    ],
    exportFormats: ["csv", "pdf"],
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isTemplate: true,
    organizationId: "system"
  },
  {
    id: "tpl_provider_quarterly",
    name: "Quarterly Provider Performance Report",
    description: "Provider quality scores, efficiency metrics, and peer comparisons",
    type: "provider_performance",
    filters: { dateRange: { start: "", end: "" } },
    sections: [
      { id: "s1", title: "Performance Summary", type: "summary", order: 1, dataSource: "summary", includeInExport: true },
      { id: "s2", title: "Quality Scorecard", type: "metrics", order: 2, dataSource: "quality", includeInExport: true },
      { id: "s3", title: "Provider Rankings", type: "table", order: 3, dataSource: "rankings", includeInExport: true },
      { id: "s4", title: "Efficiency Analysis", type: "chart", order: 4, dataSource: "efficiency", visualizationType: "bar", includeInExport: true }
    ],
    exportFormats: ["csv", "pdf"],
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isTemplate: true,
    organizationId: "system"
  },
  {
    id: "tpl_compliance_audit",
    name: "Compliance Audit Report",
    description: "HIPAA compliance, audit findings, and remediation tracking",
    type: "compliance_audit",
    filters: { dateRange: { start: "", end: "" } },
    sections: [
      { id: "s1", title: "Compliance Overview", type: "metrics", order: 1, dataSource: "compliance", includeInExport: true },
      { id: "s2", title: "Audit Findings", type: "table", order: 2, dataSource: "findings", includeInExport: true },
      { id: "s3", title: "Control Assessments", type: "table", order: 3, dataSource: "controls", includeInExport: true },
      { id: "s4", title: "Remediation Status", type: "chart", order: 4, dataSource: "remediation", visualizationType: "pie", includeInExport: true }
    ],
    exportFormats: ["csv", "pdf"],
    createdBy: "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isTemplate: true,
    organizationId: "system"
  }
];

export function getReportTemplates(): ReportConfiguration[] {
  return reportTemplates;
}

export function getReportTemplate(templateId: string): ReportConfiguration | undefined {
  return reportTemplates.find(t => t.id === templateId);
}

export function getGeneratedReport(reportId: string): GeneratedReport | undefined {
  return generatedReports.get(reportId);
}

export function listGeneratedReports(organizationId: string, filters?: { type?: ReportType; status?: ReportStatus }): GeneratedReport[] {
  return Array.from(generatedReports.values())
    .filter(r => {
      if (filters?.type && r.type !== filters.type) return false;
      if (filters?.status && r.status !== filters.status) return false;
      return true;
    })
    .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
}

export function recordReportAccess(reportId: string, userId: string, userName: string, action: "view" | "download" | "share" | "print", ipAddress: string, userAgent: string): void {
  const report = generatedReports.get(reportId);
  if (report) {
    report.auditInfo.accessLog.push({
      userId,
      userName,
      action,
      timestamp: new Date().toISOString(),
      ipAddress,
      userAgent
    });

    logPhiAccess({
      userId,
      action: action === "download" ? "export" : "read",
      resourceType: "generated_report",
      resourceId: reportId,
      details: `Report ${action}: ${report.name} (${report.type})`
    });
  }
}
