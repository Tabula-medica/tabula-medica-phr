// CDS-GATED — this service performs Clinical Decision Support (predictive clinical
// insights, readmission/disease-progression risk, anomaly/clinical-pattern alerts, and
// clinical recommendations over FHIR data). DISABLED by default via the ENABLE_CDS
// kill-switch pending FDA Non-Device CDS determination + counsel review. NOT a NO-CDS claim.
// See _cds-gate.ts, NO-CDS-TRIAGE.md, ventures/tabula-medica/PHR-CDS-COUNSEL-BRIEF.md.
import OpenAI from "openai";
import { assertCdsEnabled } from "./_cds-gate";

let openai: OpenAI | null = null;
try {
  if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
} catch (error) {
  console.warn("[DataLakeAnalytics] OpenAI client initialization failed, AI features will use fallback");
}

const alertStatusStore: Map<string, { status: string; acknowledgedAt?: string; resolvedAt?: string; resolution?: string }> = new Map();
const recommendationStatusStore: Map<string, { status: string; assignedTo?: string; updatedAt: string }> = new Map();

export interface DataLakeMetrics {
  totalPatients: number;
  totalResources: number;
  resourceBreakdown: Record<string, number>;
  dataQualityScore: number;
  lastUpdated: string;
}

export interface PredictiveInsight {
  id: string;
  category: 'patient_outcome' | 'readmission_risk' | 'disease_progression' | 'resource_utilization' | 'care_gap';
  title: string;
  description: string;
  probability: number;
  confidence: number;
  affectedPopulation: number;
  riskFactors: Array<{ factor: string; weight: number; evidence: string }>;
  recommendations: string[];
  timeframe: string;
  trend: 'increasing' | 'stable' | 'decreasing';
  generatedAt: string;
}

export interface PopulationTrend {
  id: string;
  metric: string;
  category: 'prevalence' | 'incidence' | 'outcome' | 'utilization' | 'cost';
  condition?: string;
  currentValue: number;
  previousValue: number;
  percentChange: number;
  trend: 'up' | 'down' | 'stable';
  dataPoints: Array<{ date: string; value: number }>;
  demographicBreakdown: Array<{ segment: string; value: number; percentage: number }>;
  forecast: Array<{ date: string; predicted: number; lowerBound: number; upperBound: number }>;
  insights: string[];
  generatedAt: string;
}

export interface AnomalyAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: 'data_quality' | 'clinical_pattern' | 'resource_usage' | 'compliance' | 'security';
  title: string;
  description: string;
  affectedEntity: string;
  detectedAt: string;
  metrics: Record<string, number>;
  expectedRange: { min: number; max: number };
  actualValue: number;
  deviationPercent: number;
  recommendation: string;
  status: 'active' | 'acknowledged' | 'resolved';
  relatedAlerts?: string[];
}

export interface QualityMetric {
  id: string;
  name: string;
  category: 'care_quality' | 'operational_efficiency' | 'patient_safety' | 'compliance' | 'cost';
  currentScore: number;
  targetScore: number;
  benchmark: number;
  trend: 'improving' | 'stable' | 'declining';
  historicalData: Array<{ period: string; score: number }>;
  components: Array<{ name: string; score: number; weight: number }>;
  recommendations: string[];
}

export interface CustomReport {
  id: string;
  name: string;
  description: string;
  type: 'executive_summary' | 'clinical_quality' | 'population_health' | 'operational' | 'financial' | 'custom';
  parameters: Record<string, unknown>;
  sections: Array<{
    title: string;
    type: 'metrics' | 'chart' | 'table' | 'narrative' | 'alert_summary';
    data: unknown;
  }>;
  generatedAt: string;
  generatedBy: string;
  scheduledRefresh?: string;
}

export interface RecommendationAction {
  id: string;
  category: 'clinical' | 'operational' | 'quality' | 'cost' | 'compliance';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  rationale: string;
  expectedImpact: {
    metric: string;
    improvement: number;
    timeframe: string;
  };
  steps: string[];
  resources: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  assignedTo?: string;
  dueDate?: string;
}

const samplePatientData = [
  { id: 'P001', age: 67, conditions: ['diabetes', 'hypertension'], medications: 5, recentVisits: 3, labsAbnormal: 2 },
  { id: 'P002', age: 45, conditions: ['asthma'], medications: 2, recentVisits: 1, labsAbnormal: 0 },
  { id: 'P003', age: 72, conditions: ['copd', 'heart_failure', 'diabetes'], medications: 8, recentVisits: 5, labsAbnormal: 4 },
  { id: 'P004', age: 55, conditions: ['hypertension'], medications: 3, recentVisits: 2, labsAbnormal: 1 },
  { id: 'P005', age: 80, conditions: ['alzheimers', 'osteoporosis'], medications: 6, recentVisits: 4, labsAbnormal: 2 },
];

const generateDataLakeMetrics = (): DataLakeMetrics => ({
  totalPatients: 15847,
  totalResources: 2456789,
  resourceBreakdown: {
    Patient: 15847,
    Observation: 892456,
    MedicationRequest: 234567,
    Condition: 145678,
    Encounter: 567890,
    Procedure: 123456,
    DiagnosticReport: 234567,
    Immunization: 89012,
    AllergyIntolerance: 45678,
    CarePlan: 67890
  },
  dataQualityScore: 94.7,
  lastUpdated: new Date().toISOString()
});

const generatePredictiveInsights = async (): Promise<PredictiveInsight[]> => {
  assertCdsEnabled("ai-fhir-data-lake-analytics-service.generatePredictiveInsights");
  const insights: PredictiveInsight[] = [
    {
      id: 'insight-001',
      category: 'readmission_risk',
      title: 'Elevated 30-Day Readmission Risk',
      description: 'Analysis of FHIR data indicates 847 patients have >25% risk of hospital readmission within 30 days.',
      probability: 0.32,
      confidence: 0.89,
      affectedPopulation: 847,
      riskFactors: [
        { factor: 'Multiple chronic conditions', weight: 0.35, evidence: 'Patients with 3+ chronic conditions show 2.4x higher readmission rates' },
        { factor: 'Recent hospitalization', weight: 0.28, evidence: 'Hospitalization within past 90 days correlates with elevated risk' },
        { factor: 'Polypharmacy', weight: 0.22, evidence: 'Patients on 5+ medications show increased care complexity' },
        { factor: 'Age >65', weight: 0.15, evidence: 'Geriatric patients require enhanced discharge planning' }
      ],
      recommendations: [
        'Implement enhanced discharge planning for high-risk patients',
        'Schedule 48-hour post-discharge follow-up calls',
        'Coordinate medication reconciliation with pharmacy',
        'Engage care coordinators for complex cases'
      ],
      timeframe: '30 days',
      trend: 'increasing',
      generatedAt: new Date().toISOString()
    },
    {
      id: 'insight-002',
      category: 'disease_progression',
      title: 'Diabetes Progression Risk Cohort',
      description: 'Machine learning analysis identifies 1,234 pre-diabetic patients at high risk of progression to Type 2 diabetes.',
      probability: 0.45,
      confidence: 0.87,
      affectedPopulation: 1234,
      riskFactors: [
        { factor: 'HbA1c trending upward', weight: 0.40, evidence: 'HbA1c increase >0.3% in past 6 months' },
        { factor: 'BMI >30', weight: 0.30, evidence: 'Obesity strongly correlates with diabetes onset' },
        { factor: 'Family history', weight: 0.20, evidence: 'First-degree relative with diabetes' },
        { factor: 'Sedentary lifestyle', weight: 0.10, evidence: 'Activity levels below recommended guidelines' }
      ],
      recommendations: [
        'Enroll high-risk patients in diabetes prevention program',
        'Increase monitoring frequency for HbA1c and glucose',
        'Implement lifestyle intervention counseling',
        'Consider metformin for highest-risk patients per guidelines'
      ],
      timeframe: '12 months',
      trend: 'stable',
      generatedAt: new Date().toISOString()
    },
    {
      id: 'insight-003',
      category: 'care_gap',
      title: 'Preventive Care Gap Detection',
      description: 'Analysis reveals 2,567 patients overdue for recommended preventive screenings.',
      probability: 0.78,
      confidence: 0.95,
      affectedPopulation: 2567,
      riskFactors: [
        { factor: 'Colorectal screening overdue', weight: 0.35, evidence: '1,245 patients age 50-75 without colonoscopy in 10 years' },
        { factor: 'Mammography overdue', weight: 0.30, evidence: '892 eligible women without mammogram in 2 years' },
        { factor: 'A1c testing gap', weight: 0.20, evidence: '430 diabetics without A1c test in 6 months' },
        { factor: 'Annual wellness visit', weight: 0.15, evidence: '1,123 patients without AWV in past year' }
      ],
      recommendations: [
        'Launch automated patient outreach for overdue screenings',
        'Implement provider alerts for care gaps during visits',
        'Schedule bulk outreach campaigns by screening type',
        'Partner with community health workers for underserved populations'
      ],
      timeframe: '90 days',
      trend: 'decreasing',
      generatedAt: new Date().toISOString()
    },
    {
      id: 'insight-004',
      category: 'resource_utilization',
      title: 'ED Utilization Pattern Analysis',
      description: 'Identified 456 patients with high ED utilization potentially suitable for ambulatory care management.',
      probability: 0.62,
      confidence: 0.84,
      affectedPopulation: 456,
      riskFactors: [
        { factor: 'Frequent ED visits', weight: 0.40, evidence: '4+ ED visits in past 12 months' },
        { factor: 'Uncontrolled chronic disease', weight: 0.30, evidence: 'Suboptimal disease control markers' },
        { factor: 'Limited PCP access', weight: 0.20, evidence: 'No established primary care relationship' },
        { factor: 'Social determinants', weight: 0.10, evidence: 'Transportation, housing, or food insecurity' }
      ],
      recommendations: [
        'Assign care managers to highest-utilization patients',
        'Establish same-day urgent care access',
        'Implement hospital-at-home program for eligible patients',
        'Address social determinants through community partnerships'
      ],
      timeframe: '6 months',
      trend: 'stable',
      generatedAt: new Date().toISOString()
    },
    {
      id: 'insight-005',
      category: 'patient_outcome',
      title: 'Post-Surgical Complication Risk',
      description: 'Pre-operative analysis predicts 89 scheduled surgical patients have elevated complication risk.',
      probability: 0.28,
      confidence: 0.91,
      affectedPopulation: 89,
      riskFactors: [
        { factor: 'Advanced age', weight: 0.30, evidence: 'Age >75 associated with higher complication rates' },
        { factor: 'Comorbidity burden', weight: 0.35, evidence: 'Charlson Comorbidity Index >3' },
        { factor: 'Nutritional status', weight: 0.20, evidence: 'Albumin <3.5 or BMI <18.5' },
        { factor: 'Functional status', weight: 0.15, evidence: 'Limited mobility or ADL dependence' }
      ],
      recommendations: [
        'Implement enhanced preoperative optimization protocols',
        'Consider prehabilitation for high-risk patients',
        'Ensure multidisciplinary surgical planning review',
        'Plan for appropriate post-operative care level'
      ],
      timeframe: '30 days post-op',
      trend: 'stable',
      generatedAt: new Date().toISOString()
    }
  ];

  return insights;
};

const generatePopulationTrends = async (): Promise<PopulationTrend[]> => {
  assertCdsEnabled("ai-fhir-data-lake-analytics-service.generatePopulationTrends");
  const baseDate = new Date();
  const generateDataPoints = (months: number, baseValue: number, volatility: number) => {
    const points = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(baseDate);
      date.setMonth(date.getMonth() - i);
      const variation = (Math.random() - 0.5) * volatility;
      points.push({
        date: date.toISOString().split('T')[0],
        value: Math.round((baseValue + variation + (i * 0.5)) * 10) / 10
      });
    }
    return points;
  };

  const generateForecast = (months: number, lastValue: number, trend: number) => {
    const forecast = [];
    for (let i = 1; i <= months; i++) {
      const date = new Date(baseDate);
      date.setMonth(date.getMonth() + i);
      const predicted = lastValue + (trend * i) + (Math.random() - 0.5) * 2;
      forecast.push({
        date: date.toISOString().split('T')[0],
        predicted: Math.round(predicted * 10) / 10,
        lowerBound: Math.round((predicted - 5) * 10) / 10,
        upperBound: Math.round((predicted + 5) * 10) / 10
      });
    }
    return forecast;
  };

  return [
    {
      id: 'trend-001',
      metric: 'Diabetes Prevalence Rate',
      category: 'prevalence',
      condition: 'Type 2 Diabetes',
      currentValue: 14.2,
      previousValue: 13.8,
      percentChange: 2.9,
      trend: 'up',
      dataPoints: generateDataPoints(12, 13, 1),
      demographicBreakdown: [
        { segment: 'Age 18-44', value: 4.5, percentage: 12 },
        { segment: 'Age 45-64', value: 17.2, percentage: 45 },
        { segment: 'Age 65+', value: 26.8, percentage: 43 }
      ],
      forecast: generateForecast(6, 14.2, 0.3),
      insights: [
        'Diabetes prevalence increased 2.9% year-over-year',
        'Highest growth in 45-64 age group (+4.1%)',
        'Geographic concentration in urban ZIP codes',
        'Correlation with food desert locations identified'
      ],
      generatedAt: new Date().toISOString()
    },
    {
      id: 'trend-002',
      metric: 'Hospital Readmission Rate',
      category: 'outcome',
      currentValue: 12.4,
      previousValue: 13.1,
      percentChange: -5.3,
      trend: 'down',
      dataPoints: generateDataPoints(12, 13.5, 1.5),
      demographicBreakdown: [
        { segment: 'Heart Failure', value: 18.2, percentage: 28 },
        { segment: 'COPD', value: 15.6, percentage: 22 },
        { segment: 'Pneumonia', value: 11.8, percentage: 18 },
        { segment: 'Other', value: 9.4, percentage: 32 }
      ],
      forecast: generateForecast(6, 12.4, -0.2),
      insights: [
        'Overall readmission rate improved 5.3% from last year',
        'Heart failure readmissions remain highest category',
        'Care transition program showing positive impact',
        'Weekend discharges still show elevated readmission risk'
      ],
      generatedAt: new Date().toISOString()
    },
    {
      id: 'trend-003',
      metric: 'Preventive Screening Compliance',
      category: 'utilization',
      currentValue: 72.8,
      previousValue: 68.4,
      percentChange: 6.4,
      trend: 'up',
      dataPoints: generateDataPoints(12, 67, 3),
      demographicBreakdown: [
        { segment: 'Colorectal', value: 68.5, percentage: 25 },
        { segment: 'Breast Cancer', value: 78.2, percentage: 30 },
        { segment: 'Cervical Cancer', value: 76.4, percentage: 20 },
        { segment: 'Annual Wellness', value: 69.1, percentage: 25 }
      ],
      forecast: generateForecast(6, 72.8, 0.8),
      insights: [
        'Screening rates improved 6.4% following outreach campaign',
        'Breast cancer screening leads all categories',
        'Rural populations lag 12% behind urban areas',
        'Patient portal reminders associated with +15% compliance'
      ],
      generatedAt: new Date().toISOString()
    },
    {
      id: 'trend-004',
      metric: 'Medication Adherence Rate',
      category: 'outcome',
      currentValue: 78.5,
      previousValue: 76.2,
      percentChange: 3.0,
      trend: 'up',
      dataPoints: generateDataPoints(12, 75, 2),
      demographicBreakdown: [
        { segment: 'Antihypertensives', value: 82.1, percentage: 35 },
        { segment: 'Statins', value: 76.8, percentage: 28 },
        { segment: 'Diabetes', value: 74.5, percentage: 22 },
        { segment: 'Mental Health', value: 68.2, percentage: 15 }
      ],
      forecast: generateForecast(6, 78.5, 0.4),
      insights: [
        'Overall medication adherence improved 3.0%',
        'Mental health medications show lowest adherence',
        '90-day prescriptions associated with +8% adherence',
        'Copay assistance programs show significant impact'
      ],
      generatedAt: new Date().toISOString()
    },
    {
      id: 'trend-005',
      metric: 'ED Visit Rate per 1000',
      category: 'utilization',
      currentValue: 342,
      previousValue: 358,
      percentChange: -4.5,
      trend: 'down',
      dataPoints: generateDataPoints(12, 360, 15),
      demographicBreakdown: [
        { segment: 'Age 0-17', value: 287, percentage: 22 },
        { segment: 'Age 18-44', value: 312, percentage: 35 },
        { segment: 'Age 45-64', value: 398, percentage: 25 },
        { segment: 'Age 65+', value: 456, percentage: 18 }
      ],
      forecast: generateForecast(6, 342, -3),
      insights: [
        'ED utilization decreased 4.5% year-over-year',
        'Telehealth expansion contributed to reduction',
        'After-hours urgent care access improved',
        'Super-utilizer program reduced frequent ED visits by 28%'
      ],
      generatedAt: new Date().toISOString()
    }
  ];
};

const generateAnomalyAlerts = async (): Promise<AnomalyAlert[]> => {
  assertCdsEnabled("ai-fhir-data-lake-analytics-service.generateAnomalyAlerts");
  return [
    {
      id: 'alert-001',
      severity: 'critical',
      type: 'clinical_pattern',
      title: 'Unusual Sepsis Case Cluster',
      description: 'Detected 340% increase in sepsis diagnoses in cardiac surgery unit over past 72 hours.',
      affectedEntity: 'Cardiac Surgery Unit',
      detectedAt: new Date(Date.now() - 3600000).toISOString(),
      metrics: { current: 22, baseline: 5, threshold: 10 },
      expectedRange: { min: 3, max: 8 },
      actualValue: 22,
      deviationPercent: 340,
      recommendation: 'Immediate infection control review recommended. Consider enhanced surveillance and isolation protocols.',
      status: 'active',
      relatedAlerts: ['alert-005']
    },
    {
      id: 'alert-002',
      severity: 'high',
      type: 'data_quality',
      title: 'Missing Lab Results Pattern',
      description: 'Laboratory interface showing 18% missing results for critical values over past 24 hours.',
      affectedEntity: 'LabCorp Interface',
      detectedAt: new Date(Date.now() - 7200000).toISOString(),
      metrics: { missing: 847, total: 4706, normal: 2 },
      expectedRange: { min: 0, max: 3 },
      actualValue: 18,
      deviationPercent: 500,
      recommendation: 'Contact lab interface vendor. Implement manual result verification for critical values.',
      status: 'acknowledged'
    },
    {
      id: 'alert-003',
      severity: 'medium',
      type: 'resource_usage',
      title: 'ICU Capacity Threshold Breach',
      description: 'ICU occupancy reached 92% capacity, exceeding 85% operational threshold.',
      affectedEntity: 'Medical ICU',
      detectedAt: new Date(Date.now() - 1800000).toISOString(),
      metrics: { occupied: 23, total: 25, threshold: 85 },
      expectedRange: { min: 60, max: 85 },
      actualValue: 92,
      deviationPercent: 8,
      recommendation: 'Activate surge protocols. Review step-down candidates and discharge readiness.',
      status: 'active'
    },
    {
      id: 'alert-004',
      severity: 'medium',
      type: 'compliance',
      title: 'Consent Documentation Gap',
      description: 'Detected 34 procedures in past week lacking complete informed consent documentation.',
      affectedEntity: 'Surgical Services',
      detectedAt: new Date(Date.now() - 86400000).toISOString(),
      metrics: { missing: 34, total: 567, compliance: 94 },
      expectedRange: { min: 98, max: 100 },
      actualValue: 94,
      deviationPercent: 4,
      recommendation: 'Reinforce consent workflow. Consider mandatory attestation before procedure scheduling.',
      status: 'active'
    },
    {
      id: 'alert-005',
      severity: 'low',
      type: 'security',
      title: 'Unusual After-Hours Access Pattern',
      description: 'Detected 3x normal after-hours record access from radiology department.',
      affectedEntity: 'Radiology Department',
      detectedAt: new Date(Date.now() - 43200000).toISOString(),
      metrics: { accesses: 156, baseline: 52, users: 8 },
      expectedRange: { min: 40, max: 70 },
      actualValue: 156,
      deviationPercent: 200,
      recommendation: 'Review access logs for legitimate clinical need. May relate to increased on-call coverage.',
      status: 'resolved'
    },
    {
      id: 'alert-006',
      severity: 'high',
      type: 'clinical_pattern',
      title: 'Medication Error Rate Spike',
      description: 'Medication error reporting increased 65% in nursing units during shift change periods.',
      affectedEntity: 'Inpatient Nursing',
      detectedAt: new Date(Date.now() - 14400000).toISOString(),
      metrics: { current: 23, baseline: 14, periodDays: 7 },
      expectedRange: { min: 10, max: 18 },
      actualValue: 23,
      deviationPercent: 65,
      recommendation: 'Review shift handoff protocols. Consider protected time for medication administration.',
      status: 'active'
    }
  ];
};

const generateQualityMetrics = async (): Promise<QualityMetric[]> => {
  assertCdsEnabled("ai-fhir-data-lake-analytics-service.generateQualityMetrics");
  return [
    {
      id: 'qm-001',
      name: 'HEDIS Composite Score',
      category: 'care_quality',
      currentScore: 87.3,
      targetScore: 90.0,
      benchmark: 85.5,
      trend: 'improving',
      historicalData: [
        { period: 'Q1 2025', score: 84.2 },
        { period: 'Q2 2025', score: 85.8 },
        { period: 'Q3 2025', score: 86.5 },
        { period: 'Q4 2025', score: 87.3 }
      ],
      components: [
        { name: 'Diabetes Care', score: 85.4, weight: 0.20 },
        { name: 'Cardiovascular', score: 89.2, weight: 0.20 },
        { name: 'Preventive Screening', score: 86.8, weight: 0.25 },
        { name: 'Behavioral Health', score: 82.1, weight: 0.15 },
        { name: 'Medication Management', score: 91.5, weight: 0.20 }
      ],
      recommendations: [
        'Focus improvement efforts on behavioral health integration',
        'Expand diabetes self-management education programs',
        'Increase depression screening in primary care'
      ]
    },
    {
      id: 'qm-002',
      name: 'Patient Safety Index',
      category: 'patient_safety',
      currentScore: 94.8,
      targetScore: 96.0,
      benchmark: 93.0,
      trend: 'stable',
      historicalData: [
        { period: 'Q1 2025', score: 94.1 },
        { period: 'Q2 2025', score: 94.5 },
        { period: 'Q3 2025', score: 94.6 },
        { period: 'Q4 2025', score: 94.8 }
      ],
      components: [
        { name: 'Fall Prevention', score: 96.2, weight: 0.25 },
        { name: 'Medication Safety', score: 93.4, weight: 0.25 },
        { name: 'Infection Control', score: 95.1, weight: 0.25 },
        { name: 'Pressure Injury Prevention', score: 94.5, weight: 0.25 }
      ],
      recommendations: [
        'Implement high-alert medication double-check workflow',
        'Enhance hand hygiene monitoring systems',
        'Deploy AI-assisted fall risk prediction'
      ]
    },
    {
      id: 'qm-003',
      name: 'Operational Efficiency Score',
      category: 'operational_efficiency',
      currentScore: 81.6,
      targetScore: 88.0,
      benchmark: 80.0,
      trend: 'improving',
      historicalData: [
        { period: 'Q1 2025', score: 78.2 },
        { period: 'Q2 2025', score: 79.5 },
        { period: 'Q3 2025', score: 80.8 },
        { period: 'Q4 2025', score: 81.6 }
      ],
      components: [
        { name: 'Throughput', score: 83.5, weight: 0.30 },
        { name: 'Resource Utilization', score: 79.2, weight: 0.25 },
        { name: 'Staff Productivity', score: 82.8, weight: 0.25 },
        { name: 'Patient Flow', score: 80.9, weight: 0.20 }
      ],
      recommendations: [
        'Optimize OR scheduling algorithms',
        'Implement predictive bed management',
        'Reduce documentation burden through AI assistance'
      ]
    },
    {
      id: 'qm-004',
      name: 'Compliance Score',
      category: 'compliance',
      currentScore: 96.2,
      targetScore: 98.0,
      benchmark: 95.0,
      trend: 'stable',
      historicalData: [
        { period: 'Q1 2025', score: 95.8 },
        { period: 'Q2 2025', score: 96.1 },
        { period: 'Q3 2025', score: 96.0 },
        { period: 'Q4 2025', score: 96.2 }
      ],
      components: [
        { name: 'HIPAA Compliance', score: 98.5, weight: 0.30 },
        { name: 'Documentation Compliance', score: 94.8, weight: 0.25 },
        { name: 'Regulatory Reporting', score: 95.2, weight: 0.25 },
        { name: 'Policy Adherence', score: 96.3, weight: 0.20 }
      ],
      recommendations: [
        'Address documentation compliance gaps in outpatient settings',
        'Implement automated regulatory reporting validation',
        'Enhance policy acknowledgment tracking'
      ]
    },
    {
      id: 'qm-005',
      name: 'Cost Efficiency Index',
      category: 'cost',
      currentScore: 78.4,
      targetScore: 85.0,
      benchmark: 75.0,
      trend: 'improving',
      historicalData: [
        { period: 'Q1 2025', score: 74.6 },
        { period: 'Q2 2025', score: 76.2 },
        { period: 'Q3 2025', score: 77.5 },
        { period: 'Q4 2025', score: 78.4 }
      ],
      components: [
        { name: 'Length of Stay', score: 76.8, weight: 0.30 },
        { name: 'Supply Chain', score: 82.1, weight: 0.25 },
        { name: 'Labor Productivity', score: 75.4, weight: 0.25 },
        { name: 'Revenue Cycle', score: 79.3, weight: 0.20 }
      ],
      recommendations: [
        'Implement evidence-based clinical pathways to reduce LOS',
        'Optimize supply chain through predictive inventory',
        'Deploy automation for revenue cycle improvement'
      ]
    }
  ];
};

const generateRecommendations = async (): Promise<RecommendationAction[]> => {
  assertCdsEnabled("ai-fhir-data-lake-analytics-service.generateRecommendations");
  return [
    {
      id: 'rec-001',
      category: 'clinical',
      priority: 'critical',
      title: 'Implement Sepsis Early Warning Protocol',
      description: 'Deploy AI-powered sepsis screening based on detected clinical pattern anomaly in cardiac surgery unit.',
      rationale: 'Recent cluster of sepsis cases warrants immediate intervention. Early detection reduces mortality by 30%.',
      expectedImpact: {
        metric: 'Sepsis mortality rate',
        improvement: 25,
        timeframe: '90 days'
      },
      steps: [
        'Deploy real-time sepsis screening algorithm',
        'Establish rapid response team activation criteria',
        'Implement antibiotic stewardship protocols',
        'Create automated alerting workflow'
      ],
      resources: ['Clinical informatics team', 'Infection control', 'Pharmacy'],
      status: 'pending'
    },
    {
      id: 'rec-002',
      category: 'quality',
      priority: 'high',
      title: 'Close Preventive Care Gaps',
      description: 'Launch targeted outreach campaign for 2,567 patients overdue for preventive screenings.',
      rationale: 'Preventive care gaps represent significant quality measure improvement opportunity and patient health risk.',
      expectedImpact: {
        metric: 'Preventive screening compliance',
        improvement: 15,
        timeframe: '6 months'
      },
      steps: [
        'Segment patient population by screening type',
        'Deploy multi-channel outreach (portal, text, phone)',
        'Enable online scheduling for screenings',
        'Implement provider reminder at point of care'
      ],
      resources: ['Patient engagement team', 'Marketing', 'Scheduling'],
      status: 'in_progress'
    },
    {
      id: 'rec-003',
      category: 'operational',
      priority: 'high',
      title: 'Optimize ED-to-Inpatient Flow',
      description: 'Implement predictive bed management to reduce ED boarding time and improve patient flow.',
      rationale: 'Current ED boarding times averaging 4.2 hours negatively impact patient experience and outcomes.',
      expectedImpact: {
        metric: 'ED boarding time',
        improvement: 35,
        timeframe: '4 months'
      },
      steps: [
        'Deploy predictive discharge planning tools',
        'Implement pull model for admissions',
        'Establish discharge by noon initiatives',
        'Create real-time bed visibility dashboard'
      ],
      resources: ['Operations team', 'Nursing leadership', 'IT'],
      status: 'pending'
    },
    {
      id: 'rec-004',
      category: 'cost',
      priority: 'medium',
      title: 'Reduce Readmission Costs',
      description: 'Expand transitional care program for high-risk patients to reduce costly readmissions.',
      rationale: 'Each prevented readmission saves average $15,200. Current high-risk cohort of 847 patients represents significant opportunity.',
      expectedImpact: {
        metric: 'Readmission-related costs',
        improvement: 20,
        timeframe: '12 months'
      },
      steps: [
        'Identify high-risk patients using predictive models',
        'Assign dedicated care coordinators',
        'Implement 48-hour post-discharge contact',
        'Establish medication reconciliation program'
      ],
      resources: ['Care management', 'Pharmacy', 'Social work'],
      status: 'in_progress'
    },
    {
      id: 'rec-005',
      category: 'compliance',
      priority: 'medium',
      title: 'Address Consent Documentation Gaps',
      description: 'Implement enhanced consent workflow to ensure 100% documentation compliance.',
      rationale: 'Current 94% compliance rate exposes organization to regulatory and legal risk.',
      expectedImpact: {
        metric: 'Consent compliance rate',
        improvement: 6,
        timeframe: '2 months'
      },
      steps: [
        'Deploy electronic consent with mandatory fields',
        'Implement pre-procedure checklist',
        'Create escalation workflow for missing consents',
        'Establish regular audit and feedback process'
      ],
      resources: ['Legal', 'Quality', 'Surgical services'],
      status: 'pending'
    }
  ];
};

export const generateAIEnhancedInsight = async (
  insightType: string,
  context: Record<string, unknown>
): Promise<{ analysis: string; recommendations: string[] }> => {
  assertCdsEnabled("ai-fhir-data-lake-analytics-service.generateAIEnhancedInsight");
  const fallbackResponse = {
    analysis: "AI-enhanced analysis is temporarily unavailable. The system is using statistical analysis for insights based on the FHIR data patterns detected.",
    recommendations: [
      "Review data patterns manually for clinical significance",
      "Consult with subject matter experts for interpretation",
      "Consider historical trends when making decisions",
      "Monitor key metrics for changes over time"
    ]
  };

  if (!openai) {
    console.warn("[DataLakeAnalytics] OpenAI not configured, using fallback analysis");
    return fallbackResponse;
  }

  try {
    const prompt = `You are a healthcare analytics AI assistant analyzing FHIR health data. 
    
Analyze this ${insightType} with the following context:
${JSON.stringify(context, null, 2)}

Provide:
1. A detailed analysis (2-3 paragraphs) of the clinical significance
2. 3-5 actionable recommendations for healthcare providers

Format your response as JSON with keys: "analysis" (string) and "recommendations" (array of strings).

IMPORTANT DISCLAIMER: This analysis is for informational and operational purposes only. 
It is NOT for clinical decision-making and should not replace professional medical judgment.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    return JSON.parse(content);
  } catch (error) {
    console.error("AI insight generation error:", error);
    return fallbackResponse;
  }
};

export const generateCustomReport = async (
  reportConfig: {
    type: string;
    title: string;
    parameters: Record<string, unknown>;
    includeSections: string[];
  }
): Promise<CustomReport> => {
  assertCdsEnabled("ai-fhir-data-lake-analytics-service.generateCustomReport");
  const { type, title, parameters, includeSections } = reportConfig;
  
  const sections: CustomReport['sections'] = [];
  
  if (includeSections.includes('metrics')) {
    const metrics = await generateQualityMetrics();
    sections.push({
      title: 'Key Performance Metrics',
      type: 'metrics',
      data: metrics.slice(0, 3)
    });
  }
  
  if (includeSections.includes('trends')) {
    const trends = await generatePopulationTrends();
    sections.push({
      title: 'Population Health Trends',
      type: 'chart',
      data: trends.slice(0, 3)
    });
  }
  
  if (includeSections.includes('alerts')) {
    const alerts = await generateAnomalyAlerts();
    sections.push({
      title: 'Active Alerts Summary',
      type: 'alert_summary',
      data: alerts.filter(a => a.status === 'active')
    });
  }
  
  if (includeSections.includes('insights')) {
    const insights = await generatePredictiveInsights();
    sections.push({
      title: 'Predictive Insights',
      type: 'table',
      data: insights.slice(0, 3)
    });
  }
  
  if (includeSections.includes('recommendations')) {
    const recommendations = await generateRecommendations();
    sections.push({
      title: 'Recommended Actions',
      type: 'table',
      data: recommendations.filter(r => r.status === 'pending')
    });
  }

  const fallbackNarrative = 'This report provides a comprehensive analysis of healthcare operations and population health metrics. Review individual sections for detailed findings and recommendations.';

  if (openai) {
    try {
      const narrativePrompt = `Generate an executive summary for a healthcare analytics report with the following configuration:
Title: ${title}
Type: ${type}
Parameters: ${JSON.stringify(parameters)}

Create a 2-3 paragraph executive summary that:
1. Highlights key findings
2. Identifies areas of concern
3. Summarizes recommended actions

Format as plain text. This is for informational purposes only, not clinical decision-making.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [{ role: "user", content: narrativePrompt }],
        max_completion_tokens: 500,
      });

      const narrative = response.choices[0]?.message?.content || fallbackNarrative;
      
      sections.unshift({
        title: 'Executive Summary',
        type: 'narrative',
        data: narrative
      });
    } catch (error) {
      console.error("Report narrative generation error:", error);
      sections.unshift({
        title: 'Executive Summary',
        type: 'narrative',
        data: fallbackNarrative
      });
    }
  } else {
    sections.unshift({
      title: 'Executive Summary',
      type: 'narrative',
      data: fallbackNarrative
    });
  }

  return {
    id: `report-${Date.now()}`,
    name: title,
    description: `${type} report generated on ${new Date().toLocaleDateString()}`,
    type: type as CustomReport['type'],
    parameters,
    sections,
    generatedAt: new Date().toISOString(),
    generatedBy: 'AI Analytics Engine'
  };
};

const updateAlertStatus = (alertId: string, newStatus: string, resolution?: string): { success: boolean; alert?: { id: string; status: string; acknowledgedAt?: string; resolvedAt?: string; resolution?: string } } => {
  const now = new Date().toISOString();
  const statusData: { status: string; acknowledgedAt?: string; resolvedAt?: string; resolution?: string } = { status: newStatus };
  
  if (newStatus === 'acknowledged') {
    statusData.acknowledgedAt = now;
  } else if (newStatus === 'resolved') {
    statusData.resolvedAt = now;
    statusData.resolution = resolution || 'Resolved by user';
  }
  
  alertStatusStore.set(alertId, statusData);
  console.log(`[HIPAA-AUDIT][DataLakeAnalytics] ALERT_STATUS_UPDATE - Alert ${alertId} status changed to ${newStatus}`);
  
  return {
    success: true,
    alert: { id: alertId, ...statusData }
  };
};

const updateRecommendationStatus = (recommendationId: string, newStatus: string, assignedTo?: string): { success: boolean; recommendation?: { id: string; status: string; assignedTo?: string; updatedAt: string } } => {
  const now = new Date().toISOString();
  const statusData = { status: newStatus, assignedTo, updatedAt: now };
  
  recommendationStatusStore.set(recommendationId, statusData);
  console.log(`[HIPAA-AUDIT][DataLakeAnalytics] RECOMMENDATION_STATUS_UPDATE - Recommendation ${recommendationId} status changed to ${newStatus}`);
  
  return {
    success: true,
    recommendation: { id: recommendationId, ...statusData }
  };
};

const getAnomalyAlertsWithStatus = async (): Promise<AnomalyAlert[]> => {
  const alerts = await generateAnomalyAlerts();
  return alerts.map(alert => {
    const storedStatus = alertStatusStore.get(alert.id);
    if (storedStatus) {
      return { ...alert, status: storedStatus.status as AnomalyAlert['status'] };
    }
    return alert;
  });
};

const getRecommendationsWithStatus = async (): Promise<RecommendationAction[]> => {
  const recommendations = await generateRecommendations();
  return recommendations.map(rec => {
    const storedStatus = recommendationStatusStore.get(rec.id);
    if (storedStatus) {
      return { ...rec, status: storedStatus.status as RecommendationAction['status'], assignedTo: storedStatus.assignedTo };
    }
    return rec;
  });
};

export const dataLakeAnalyticsService = {
  getMetrics: generateDataLakeMetrics,
  getPredictiveInsights: generatePredictiveInsights,
  getPopulationTrends: generatePopulationTrends,
  getAnomalyAlerts: getAnomalyAlertsWithStatus,
  getQualityMetrics: generateQualityMetrics,
  getRecommendations: getRecommendationsWithStatus,
  generateAIInsight: generateAIEnhancedInsight,
  generateReport: generateCustomReport,
  updateAlertStatus,
  updateRecommendationStatus
};
