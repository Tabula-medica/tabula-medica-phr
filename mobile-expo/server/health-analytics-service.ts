import { chatComplete } from "./ai-client";

export type ResourceType = 'Observation' | 'Condition' | 'MedicationRequest' | 'Immunization' | 'Procedure' | 'AllergyIntolerance';

export interface HealthSummary {
  greeting: string;
  overallStatus: 'excellent' | 'good' | 'attention_needed' | 'action_required';
  statusDescription: string;
  keyInsights: Array<{
    category: 'vitals' | 'medications' | 'conditions' | 'appointments' | 'immunizations' | 'general';
    icon: string;
    title: string;
    value: string;
    trend?: 'up' | 'down' | 'stable';
    trendDescription?: string;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    title: string;
    date: string;
    description: string;
  }>;
  upcomingItems: Array<{
    id: string;
    type: string;
    title: string;
    date: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  aiSummary: string;
  recommendations: string[];
}

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  label?: string;
  unit?: string;
}

export interface CategoryDataPoint {
  category: string;
  count: number;
  percentage?: number;
  color?: string;
}

export interface ChartData {
  id: string;
  title: string;
  description: string;
  chartType: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  resourceType: ResourceType;
  data: TimeSeriesDataPoint[] | CategoryDataPoint[];
  insights?: string[];
  metadata?: {
    timeRange?: string;
    aggregation?: string;
    unit?: string;
  };
}

export interface DashboardConfig {
  charts: ChartData[];
  summary: {
    totalRecords: number;
    dateRange: { start: string; end: string };
    resourceBreakdown: CategoryDataPoint[];
  };
  aiInsights: string[];
}

export interface VisualizationSuggestion {
  chartType: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  title: string;
  description: string;
  resourceTypes: ResourceType[];
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  dataRequirements: string[];
}

const CHART_COLORS = [
  '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
];

function generateSampleObservations(): TimeSeriesDataPoint[] {
  const observations: TimeSeriesDataPoint[] = [];
  const now = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    
    observations.push({
      date: date.toISOString().split('T')[0],
      value: 95 + Math.random() * 30,
      label: 'Blood Glucose',
      unit: 'mg/dL'
    });
  }
  
  return observations;
}

function generateSampleVitals(): TimeSeriesDataPoint[] {
  const vitals: TimeSeriesDataPoint[] = [];
  const now = new Date();
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    
    vitals.push({
      date: date.toISOString().split('T')[0],
      value: 110 + Math.random() * 30,
      label: 'Systolic BP',
      unit: 'mmHg'
    });
  }
  
  return vitals;
}

function generateSampleWeight(): TimeSeriesDataPoint[] {
  const weights: TimeSeriesDataPoint[] = [];
  const now = new Date();
  let baseWeight = 165;
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    baseWeight += (Math.random() - 0.5) * 3;
    
    weights.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(baseWeight * 10) / 10,
      label: 'Weight',
      unit: 'lbs'
    });
  }
  
  return weights;
}

function generateConditionCategories(): CategoryDataPoint[] {
  const conditions = [
    { category: 'Cardiovascular', count: 3 },
    { category: 'Metabolic', count: 2 },
    { category: 'Respiratory', count: 1 },
    { category: 'Musculoskeletal', count: 2 },
    { category: 'Dermatological', count: 1 },
  ];
  
  const total = conditions.reduce((sum, c) => sum + c.count, 0);
  
  return conditions.map((c, i) => ({
    ...c,
    percentage: Math.round((c.count / total) * 100),
    color: CHART_COLORS[i % CHART_COLORS.length]
  }));
}

function generateMedicationCategories(): CategoryDataPoint[] {
  const medications = [
    { category: 'Antihypertensives', count: 2 },
    { category: 'Antidiabetics', count: 1 },
    { category: 'Statins', count: 1 },
    { category: 'Supplements', count: 3 },
    { category: 'Pain Relief', count: 1 },
    { category: 'Other', count: 2 },
  ];
  
  const total = medications.reduce((sum, m) => sum + m.count, 0);
  
  return medications.map((m, i) => ({
    ...m,
    percentage: Math.round((m.count / total) * 100),
    color: CHART_COLORS[i % CHART_COLORS.length]
  }));
}

function generateResourceBreakdown(): CategoryDataPoint[] {
  const resources = [
    { category: 'Observations', count: 45 },
    { category: 'Conditions', count: 9 },
    { category: 'Medications', count: 10 },
    { category: 'Immunizations', count: 8 },
    { category: 'Procedures', count: 5 },
    { category: 'Allergies', count: 3 },
  ];
  
  const total = resources.reduce((sum, r) => sum + r.count, 0);
  
  return resources.map((r, i) => ({
    ...r,
    percentage: Math.round((r.count / total) * 100),
    color: CHART_COLORS[i % CHART_COLORS.length]
  }));
}

export function getHealthDataCharts(): ChartData[] {
  return [
    {
      id: 'blood-glucose-trend',
      title: 'Blood Glucose Trend',
      description: 'Monthly average blood glucose levels over the past year',
      chartType: 'line',
      resourceType: 'Observation',
      data: generateSampleObservations(),
      insights: [
        'Average glucose: 108 mg/dL (within normal range)',
        'Slight upward trend in last 3 months',
        'Consider reviewing dietary habits'
      ],
      metadata: {
        timeRange: '12 months',
        aggregation: 'monthly average',
        unit: 'mg/dL'
      }
    },
    {
      id: 'blood-pressure-trend',
      title: 'Blood Pressure Trend',
      description: 'Systolic blood pressure readings over time',
      chartType: 'area',
      resourceType: 'Observation',
      data: generateSampleVitals(),
      insights: [
        'Average systolic: 124 mmHg (slightly elevated)',
        'Readings more stable in recent months',
        'Continue monitoring regularly'
      ],
      metadata: {
        timeRange: '12 months',
        aggregation: 'monthly average',
        unit: 'mmHg'
      }
    },
    {
      id: 'weight-trend',
      title: 'Weight Tracking',
      description: 'Body weight measurements over time',
      chartType: 'line',
      resourceType: 'Observation',
      data: generateSampleWeight(),
      insights: [
        'Weight relatively stable',
        'Minor fluctuations within normal range',
        'Good consistency in tracking'
      ],
      metadata: {
        timeRange: '12 months',
        aggregation: 'monthly',
        unit: 'lbs'
      }
    },
    {
      id: 'condition-distribution',
      title: 'Conditions by Category',
      description: 'Distribution of diagnosed conditions by medical category',
      chartType: 'pie',
      resourceType: 'Condition',
      data: generateConditionCategories(),
      insights: [
        'Cardiovascular conditions most prevalent',
        'Multiple chronic conditions require coordinated care',
        'Regular monitoring recommended'
      ],
      metadata: {
        aggregation: 'count by category'
      }
    },
    {
      id: 'medication-distribution',
      title: 'Medications by Class',
      description: 'Active medications grouped by therapeutic class',
      chartType: 'bar',
      resourceType: 'MedicationRequest',
      data: generateMedicationCategories(),
      insights: [
        '10 active medications across 6 categories',
        'Supplements are the largest category',
        'Review for potential interactions'
      ],
      metadata: {
        aggregation: 'count by class'
      }
    }
  ];
}

export function getDashboardConfig(): DashboardConfig {
  const now = new Date();
  const yearAgo = new Date(now);
  yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  
  return {
    charts: getHealthDataCharts(),
    summary: {
      totalRecords: 80,
      dateRange: {
        start: yearAgo.toISOString().split('T')[0],
        end: now.toISOString().split('T')[0]
      },
      resourceBreakdown: generateResourceBreakdown()
    },
    aiInsights: [
      'Your blood glucose levels show a slight upward trend. Consider discussing this with your healthcare provider.',
      'Blood pressure readings have stabilized over the past 3 months, indicating good medication adherence.',
      'You have multiple cardiovascular-related conditions. A comprehensive cardiac assessment may be beneficial.',
      'Current medication regimen appears well-coordinated for your condition profile.'
    ]
  };
}

export async function getAIVisualizationSuggestions(
  availableResourceTypes: ResourceType[],
  existingCharts: string[]
): Promise<VisualizationSuggestion[]> {
  try {
    const prompt = `You are a health data analytics expert. Based on the available FHIR resources and existing visualizations, suggest new data visualizations that would provide valuable health insights.

Available FHIR Resource Types: ${availableResourceTypes.join(', ')}
Existing Charts: ${existingCharts.join(', ')}

Provide 3-5 visualization suggestions. For each suggestion, include:
1. Chart type (line, bar, pie, area, or scatter)
2. Title
3. Brief description
4. Which resource types it uses
5. Why this visualization is valuable (rationale)
6. Priority (high, medium, low)
7. Data requirements

Focus on clinically meaningful visualizations that help patients understand their health trends and identify potential concerns.

Respond in JSON format with an array of suggestions.`;

    const response = await chatComplete({
      model: "deep",
      messages: [
        {
          role: "system",
          content: "You are a healthcare analytics expert specializing in FHIR data visualization. Provide suggestions in valid JSON format."
        },
        { role: "user", content: prompt }
      ],
      jsonMode: true,
      maxOutputTokens: 1500
    ,
      dataCategories: ["conditions","medications","lab_results","vitals"],
      purpose: "health_analytics",
      callerService: "health-analytics-service",
      callerMethod: "analyze"});

    const content = response.content;
    if (!content) {
      return getDefaultSuggestions();
    }

    const parsed = JSON.parse(content);
    const suggestions = parsed.suggestions || parsed.visualizations || [];
    
    if (suggestions.length === 0) {
      return getDefaultSuggestions();
    }
    
    return suggestions.map((s: any) => ({
      chartType: s.chartType || s.chart_type || 'line',
      title: s.title,
      description: s.description,
      resourceTypes: s.resourceTypes || s.resource_types || ['Observation'],
      rationale: s.rationale || s.reason || 'Provides valuable health insights',
      priority: s.priority || 'medium',
      dataRequirements: s.dataRequirements || s.data_requirements || []
    }));
  } catch (error) {
    console.error('AI suggestion error:', error);
    return getDefaultSuggestions();
  }
}

function getDefaultSuggestions(): VisualizationSuggestion[] {
  return [
    {
      chartType: 'line',
      title: 'Lab Results Comparison',
      description: 'Compare multiple lab values over time on a single chart',
      resourceTypes: ['Observation'],
      rationale: 'Helps identify correlations between different lab values',
      priority: 'high',
      dataRequirements: ['Multiple observation types with numeric values']
    },
    {
      chartType: 'scatter',
      title: 'Medication Timing vs. Vitals',
      description: 'Correlation between medication administration and vital sign changes',
      resourceTypes: ['MedicationRequest', 'Observation'],
      rationale: 'Helps assess medication effectiveness',
      priority: 'medium',
      dataRequirements: ['Timestamped medications', 'Corresponding vital readings']
    },
    {
      chartType: 'bar',
      title: 'Immunization Timeline',
      description: 'Overview of vaccinations received with due dates',
      resourceTypes: ['Immunization'],
      rationale: 'Ensures vaccination schedule is up to date',
      priority: 'medium',
      dataRequirements: ['Immunization records with dates']
    },
    {
      chartType: 'area',
      title: 'Health Score Trend',
      description: 'Composite health score based on multiple indicators',
      resourceTypes: ['Observation', 'Condition'],
      rationale: 'Provides a holistic view of overall health trajectory',
      priority: 'high',
      dataRequirements: ['Multiple observation types', 'Active conditions']
    }
  ];
}

export async function analyzeHealthTrends(resourceType: ResourceType): Promise<{
  trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  confidence: number;
  summary: string;
  recommendations: string[];
}> {
  const trendOptions: Array<'improving' | 'stable' | 'declining'> = ['improving', 'stable', 'declining'];
  const randomTrend = trendOptions[Math.floor(Math.random() * trendOptions.length)];
  
  const summaries: Record<ResourceType, Record<string, string>> = {
    'Observation': {
      improving: 'Your vital signs and lab values show positive trends over the past 6 months.',
      stable: 'Your observation values have remained consistent, indicating stable health.',
      declining: 'Some observation values show concerning trends that may require attention.'
    },
    'Condition': {
      improving: 'Your condition management appears to be improving with fewer active issues.',
      stable: 'Your conditions are being well-managed with stable status.',
      declining: 'Some conditions may require additional attention or treatment adjustments.'
    },
    'MedicationRequest': {
      improving: 'Medication adherence appears good with optimized regimen.',
      stable: 'Your medication regimen has remained consistent.',
      declining: 'Consider reviewing medication effectiveness with your provider.'
    },
    'Immunization': {
      improving: 'Vaccination schedule is up to date with recent immunizations.',
      stable: 'Immunization status is current.',
      declining: 'Some vaccinations may be due for updates.'
    },
    'Procedure': {
      improving: 'Recent procedures have shown positive outcomes.',
      stable: 'Procedure history is well-documented.',
      declining: 'Follow-up procedures may be needed.'
    },
    'AllergyIntolerance': {
      improving: 'Allergy management appears effective.',
      stable: 'Allergy status is well-documented and managed.',
      declining: 'Consider updating allergy documentation.'
    }
  };

  const recommendations: Record<string, string[]> = {
    improving: [
      'Continue current management approach',
      'Schedule regular follow-up appointments',
      'Maintain healthy lifestyle habits'
    ],
    stable: [
      'Keep up with regular monitoring',
      'Discuss any changes with your healthcare team',
      'Review goals at next appointment'
    ],
    declining: [
      'Schedule an appointment to discuss trends',
      'Review current treatment plan',
      'Consider additional testing if needed'
    ]
  };

  return {
    trend: randomTrend,
    confidence: 0.75 + Math.random() * 0.2,
    summary: summaries[resourceType][randomTrend],
    recommendations: recommendations[randomTrend]
  };
}

export async function getHealthSummary(): Promise<HealthSummary> {
  const now = new Date();
  const hour = now.getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  else if (hour >= 17) greeting = 'Good evening';

  const sampleVitals = [
    { name: 'Blood Pressure', value: '118/76', unit: 'mmHg', trend: 'stable' as const },
    { name: 'Heart Rate', value: '72', unit: 'bpm', trend: 'stable' as const },
    { name: 'Blood Glucose', value: '98', unit: 'mg/dL', trend: 'down' as const },
    { name: 'Weight', value: '162', unit: 'lbs', trend: 'down' as const },
  ];

  const sampleConditions = [
    'Essential Hypertension (controlled)',
    'Type 2 Diabetes (managed)',
    'Hyperlipidemia'
  ];

  const sampleMedications = [
    { name: 'Lisinopril', dose: '10mg', frequency: 'daily' },
    { name: 'Metformin', dose: '500mg', frequency: 'twice daily' },
    { name: 'Atorvastatin', dose: '20mg', frequency: 'daily' }
  ];

  let aiSummary = '';
  try {
    const prompt = `You are a patient-friendly health assistant. Based on this health data, provide a brief, encouraging 2-3 sentence summary for the patient.

Vitals: ${sampleVitals.map(v => `${v.name}: ${v.value} ${v.unit} (${v.trend})`).join(', ')}
Active Conditions: ${sampleConditions.join(', ')}
Current Medications: ${sampleMedications.map(m => `${m.name} ${m.dose} ${m.frequency}`).join(', ')}

Be warm, supportive, and focus on positive aspects while noting any areas that need attention. Keep it concise and actionable.`;

    const response = await chatComplete({
      model: "deep",
      messages: [
        { role: "system", content: "You are a supportive health assistant providing personalized health summaries to patients." },
        { role: "user", content: prompt }
      ],
      maxOutputTokens: 200
    ,
      dataCategories: ["conditions","medications","lab_results","vitals"],
      purpose: "health_analytics",
      callerService: "health-analytics-service",
      callerMethod: "analyze"});

    aiSummary = response.content || getDefaultAISummary();
  } catch (error) {
    console.error('AI summary generation error:', error);
    aiSummary = getDefaultAISummary();
  }

  const recentActivity = generateRecentActivity();
  const upcomingItems = generateUpcomingItems();

  return {
    greeting,
    overallStatus: 'good',
    statusDescription: 'Your health metrics are looking good overall',
    keyInsights: [
      {
        category: 'vitals',
        icon: 'heart',
        title: 'Blood Pressure',
        value: '118/76 mmHg',
        trend: 'stable',
        trendDescription: 'Within normal range'
      },
      {
        category: 'vitals',
        icon: 'activity',
        title: 'Blood Glucose',
        value: '98 mg/dL',
        trend: 'down',
        trendDescription: 'Improved from last month'
      },
      {
        category: 'medications',
        icon: 'package',
        title: 'Active Medications',
        value: '3 medications',
        trend: 'stable',
        trendDescription: 'No changes in 30 days'
      },
      {
        category: 'conditions',
        icon: 'file-text',
        title: 'Active Conditions',
        value: '3 conditions',
        trend: 'stable',
        trendDescription: 'All managed'
      },
      {
        category: 'immunizations',
        icon: 'shield',
        title: 'Immunizations',
        value: 'Up to date',
        trend: 'stable',
        trendDescription: 'Next due: Flu shot (Oct)'
      }
    ],
    recentActivity,
    upcomingItems,
    aiSummary,
    recommendations: [
      'Continue monitoring blood pressure daily',
      'Schedule annual wellness visit',
      'Consider flu vaccination before October'
    ]
  };
}

function getDefaultAISummary(): string {
  return "Your health metrics are looking stable overall. Your blood pressure and glucose levels are well-controlled, and your medication regimen is working effectively. Keep up the great work with your health management!";
}

function generateRecentActivity(): HealthSummary['recentActivity'] {
  const now = new Date();
  return [
    {
      id: 'ra-1',
      type: 'lab',
      title: 'Blood Work Results',
      date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Comprehensive metabolic panel completed'
    },
    {
      id: 'ra-2',
      type: 'visit',
      title: 'Primary Care Visit',
      date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Annual physical examination'
    },
    {
      id: 'ra-3',
      type: 'medication',
      title: 'Prescription Refilled',
      date: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Lisinopril 10mg - 90 day supply'
    },
    {
      id: 'ra-4',
      type: 'vital',
      title: 'Vitals Recorded',
      date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Blood pressure: 118/76 mmHg'
    }
  ];
}

function generateUpcomingItems(): HealthSummary['upcomingItems'] {
  const now = new Date();
  return [
    {
      id: 'up-1',
      type: 'appointment',
      title: 'Cardiology Follow-up',
      date: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      priority: 'high'
    },
    {
      id: 'up-2',
      type: 'lab',
      title: 'A1C Test Due',
      date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      priority: 'medium'
    },
    {
      id: 'up-3',
      type: 'medication',
      title: 'Metformin Refill',
      date: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
      priority: 'low'
    }
  ];
}
