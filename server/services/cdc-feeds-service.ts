import { generatePhiSafeText } from "./ai-gateway";
import { logPhiAccess } from "../security/hipaa-audit";

const NO_CDS_DISCLAIMER = "DISCLAIMER: CDC data feeds are for INFORMATIONAL AND PUBLIC HEALTH AWARENESS PURPOSES ONLY. This data does NOT constitute medical advice, clinical decision support, or treatment recommendations. All health decisions must be made in consultation with qualified healthcare professionals.";

const CDC_BASE_URL = "https://data.cdc.gov/resource";

export interface CDCDataset {
  id: string;
  name: string;
  description: string;
  category: "covid" | "flu" | "vaccination" | "disease" | "environmental" | "chronic" | "injury";
  datasetId: string;
  lastUpdated: string;
  recordCount?: number;
}

export interface CDCFeedItem {
  id: string;
  datasetId: string;
  datasetName: string;
  category: string;
  title: string;
  summary: string;
  data: Record<string, any>;
  location?: {
    state?: string;
    county?: string;
    region?: string;
  };
  date: string;
  severity?: "low" | "moderate" | "high" | "critical";
  aiInsights?: string[];
  noCdsDisclaimer: string;
}

export interface CDCOutbreakAlert {
  id: string;
  disease: string;
  location: string;
  caseCount: number;
  dateReported: string;
  status: "active" | "monitoring" | "resolved";
  severity: "low" | "moderate" | "high" | "critical";
  affectedPopulation: string;
  preventionMeasures: string[];
  cdcUrl?: string;
  aiAnalysis?: string;
  noCdsDisclaimer: string;
}

export interface CDCVaccinationData {
  id: string;
  vaccineType: string;
  ageGroup: string;
  location: string;
  coverageRate: number;
  targetRate: number;
  trend: "increasing" | "stable" | "decreasing";
  reportingPeriod: string;
  lastUpdated: string;
  noCdsDisclaimer: string;
}

export interface CDCFluData {
  id: string;
  region: string;
  week: string;
  season: string;
  activityLevel: "minimal" | "low" | "moderate" | "high" | "very_high";
  iliRate: number;
  positivityRate: number;
  predominantStrain: string;
  hospitalizations: number;
  trend: "increasing" | "stable" | "decreasing" | "peaking";
  noCdsDisclaimer: string;
}

export interface CDCFeedsDashboard {
  lastRefreshed: string;
  availableDatasets: CDCDataset[];
  recentAlerts: CDCOutbreakAlert[];
  fluSummary: CDCFluData[];
  vaccinationHighlights: CDCVaccinationData[];
  aiSummary?: string;
  noCdsDisclaimer: string;
}

const AVAILABLE_DATASETS: CDCDataset[] = [
  {
    id: "covid-surveillance",
    name: "COVID-19 Case Surveillance",
    description: "Public use data on COVID-19 cases reported to CDC",
    category: "covid",
    datasetId: "vbim-akqf",
    lastUpdated: new Date().toISOString()
  },
  {
    id: "covid-variants",
    name: "SARS-CoV-2 Variant Proportions",
    description: "Weekly variant proportion estimates",
    category: "covid",
    datasetId: "jr58-6ysp",
    lastUpdated: new Date().toISOString()
  },
  {
    id: "flu-surveillance",
    name: "ILINet Flu Surveillance",
    description: "Influenza-like illness surveillance data",
    category: "flu",
    datasetId: "ks6g-5s3j",
    lastUpdated: new Date().toISOString()
  },
  {
    id: "vaccination-coverage",
    name: "Vaccination Coverage",
    description: "National and state-level vaccination rates",
    category: "vaccination",
    datasetId: "unsk-b7fc",
    lastUpdated: new Date().toISOString()
  },
  {
    id: "nndss-weekly",
    name: "NNDSS Weekly Tables",
    description: "Nationally notifiable disease surveillance",
    category: "disease",
    datasetId: "x9gk-5huc",
    lastUpdated: new Date().toISOString()
  },
  {
    id: "environmental-health",
    name: "Environmental Health Tracking",
    description: "Environmental public health indicators",
    category: "environmental",
    datasetId: "cjae-szjv",
    lastUpdated: new Date().toISOString()
  },
  {
    id: "chronic-disease",
    name: "Chronic Disease Indicators",
    description: "State-level chronic disease data",
    category: "chronic",
    datasetId: "g4ie-h725",
    lastUpdated: new Date().toISOString()
  }
];

async function fetchCDCData(datasetId: string, limit: number = 100, query?: string): Promise<any[]> {
  try {
    let url = `${CDC_BASE_URL}/${datasetId}.json?$limit=${limit}`;
    if (query) {
      url += `&${query}`;
    }
    
    const response = await fetch(url, {
      headers: {
        "Accept": "application/json"
      }
    });
    
    if (!response.ok) {
      console.error(`[CDC Feeds] Failed to fetch dataset ${datasetId}: ${response.status}`);
      return [];
    }
    
    return await response.json();
  } catch (error) {
    console.error(`[CDC Feeds] Error fetching dataset ${datasetId}:`, error);
    return [];
  }
}

function generateSampleFluData(): CDCFluData[] {
  const regions = ["Region 1", "Region 2", "Region 3", "Region 4", "Region 5", "Region 6", "Region 7", "Region 8", "Region 9", "Region 10"];
  const currentDate = new Date();
  const week = Math.ceil((currentDate.getTime() - new Date(currentDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
  
  return regions.map((region, idx) => ({
    id: `flu-${idx + 1}`,
    region,
    week: `Week ${week}`,
    season: `${currentDate.getFullYear()}-${currentDate.getFullYear() + 1}`,
    activityLevel: ["minimal", "low", "moderate", "high", "very_high"][Math.floor(Math.random() * 5)] as any,
    iliRate: Number((Math.random() * 5 + 1).toFixed(2)),
    positivityRate: Number((Math.random() * 30 + 5).toFixed(1)),
    predominantStrain: ["H1N1", "H3N2", "B/Victoria", "B/Yamagata"][Math.floor(Math.random() * 4)],
    hospitalizations: Math.floor(Math.random() * 500 + 50),
    trend: ["increasing", "stable", "decreasing", "peaking"][Math.floor(Math.random() * 4)] as any,
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  }));
}

function generateSampleOutbreakAlerts(): CDCOutbreakAlert[] {
  return [
    {
      id: "alert-1",
      disease: "Measles",
      location: "Multiple States",
      caseCount: 47,
      dateReported: new Date().toISOString(),
      status: "active",
      severity: "high",
      affectedPopulation: "Unvaccinated children and adults",
      preventionMeasures: [
        "Ensure MMR vaccination is up to date",
        "Isolate suspected cases",
        "Contact tracing for exposed individuals"
      ],
      cdcUrl: "https://www.cdc.gov/measles/cases-outbreaks.html",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    },
    {
      id: "alert-2",
      disease: "Salmonella",
      location: "Nationwide",
      caseCount: 156,
      dateReported: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      status: "active",
      severity: "moderate",
      affectedPopulation: "General population",
      preventionMeasures: [
        "Practice safe food handling",
        "Cook foods to proper temperatures",
        "Wash hands frequently"
      ],
      cdcUrl: "https://www.cdc.gov/salmonella/outbreaks.html",
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    },
    {
      id: "alert-3",
      disease: "RSV",
      location: "Southern States",
      caseCount: 2340,
      dateReported: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: "monitoring",
      severity: "moderate",
      affectedPopulation: "Infants and elderly",
      preventionMeasures: [
        "Wash hands frequently",
        "Avoid close contact with sick individuals",
        "Clean and disinfect surfaces",
        "Consider RSV vaccine for eligible adults"
      ],
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    }
  ];
}

function generateSampleVaccinationData(): CDCVaccinationData[] {
  return [
    {
      id: "vax-1",
      vaccineType: "Influenza",
      ageGroup: "Adults 18-64",
      location: "National",
      coverageRate: 38.2,
      targetRate: 70,
      trend: "increasing",
      reportingPeriod: "2024-2025 Season",
      lastUpdated: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    },
    {
      id: "vax-2",
      vaccineType: "COVID-19 Updated",
      ageGroup: "Adults 65+",
      location: "National",
      coverageRate: 42.5,
      targetRate: 80,
      trend: "stable",
      reportingPeriod: "Fall 2024",
      lastUpdated: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    },
    {
      id: "vax-3",
      vaccineType: "RSV",
      ageGroup: "Adults 60+",
      location: "National",
      coverageRate: 24.1,
      targetRate: 60,
      trend: "increasing",
      reportingPeriod: "2024-2025",
      lastUpdated: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    },
    {
      id: "vax-4",
      vaccineType: "Childhood (DTaP)",
      ageGroup: "Children 19-35 months",
      location: "National",
      coverageRate: 92.4,
      targetRate: 95,
      trend: "stable",
      reportingPeriod: "2024",
      lastUpdated: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER
    }
  ];
}

async function generateAISummary(data: {
  alerts: CDCOutbreakAlert[];
  fluData: CDCFluData[];
  vaccinationData: CDCVaccinationData[];
}): Promise<string> {
  try {
    const content = await generatePhiSafeText({
      system: `You are a public health data analyst. Summarize CDC data concisely for healthcare providers.
Focus on actionable insights. Keep response under 150 words.
${NO_CDS_DISCLAIMER}`,
      user: `Summarize this CDC public health data:

Active Outbreak Alerts:
${data.alerts.map(a => `- ${a.disease} (${a.location}): ${a.caseCount} cases, ${a.severity} severity`).join('\n')}

Flu Activity:
${data.fluData.slice(0, 5).map(f => `- ${f.region}: ${f.activityLevel} activity, ${f.trend} trend`).join('\n')}

Vaccination Coverage:
${data.vaccinationData.map(v => `- ${v.vaccineType} (${v.ageGroup}): ${v.coverageRate}% coverage`).join('\n')}

Provide a brief summary highlighting key public health concerns and trends.`,
      maxTokens: 300,
      temperature: 0.3,
    });

    return content || "Summary generation failed.";
  } catch (error) {
    console.error("[CDC Feeds] AI summary error:", error);
    return "AI summary temporarily unavailable.";
  }
}

export async function getCDCDashboard(userId: string): Promise<CDCFeedsDashboard> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "CDCFeeds",
    details: "View CDC feeds dashboard"
  });
  
  const alerts = generateSampleOutbreakAlerts();
  const fluData = generateSampleFluData();
  const vaccinationData = generateSampleVaccinationData();
  
  const aiSummary = await generateAISummary({ alerts, fluData, vaccinationData });
  
  return {
    lastRefreshed: new Date().toISOString(),
    availableDatasets: AVAILABLE_DATASETS,
    recentAlerts: alerts,
    fluSummary: fluData,
    vaccinationHighlights: vaccinationData,
    aiSummary,
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  };
}

export async function getCDCOutbreakAlerts(userId: string): Promise<CDCOutbreakAlert[]> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "CDCOutbreakAlerts",
    details: "View CDC outbreak alerts"
  });
  
  return generateSampleOutbreakAlerts();
}

export async function getCDCFluData(userId: string, region?: string): Promise<CDCFluData[]> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "CDCFluData",
    details: `View flu surveillance data${region ? ` for ${region}` : ""}`
  });
  
  const data = generateSampleFluData();
  if (region) {
    return data.filter(d => d.region.toLowerCase().includes(region.toLowerCase()));
  }
  return data;
}

export async function getCDCVaccinationData(userId: string, vaccineType?: string): Promise<CDCVaccinationData[]> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "CDCVaccinationData",
    details: `View vaccination coverage data${vaccineType ? ` for ${vaccineType}` : ""}`
  });
  
  const data = generateSampleVaccinationData();
  if (vaccineType) {
    return data.filter(d => d.vaccineType.toLowerCase().includes(vaccineType.toLowerCase()));
  }
  return data;
}

export async function fetchLiveCDCData(userId: string, datasetId: string, limit: number = 50): Promise<CDCFeedItem[]> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "CDCLiveData",
    details: `Fetch live CDC data from dataset ${datasetId}`
  });
  
  const dataset = AVAILABLE_DATASETS.find(d => d.id === datasetId || d.datasetId === datasetId);
  if (!dataset) {
    return [];
  }
  
  const rawData = await fetchCDCData(dataset.datasetId, limit);
  
  return rawData.map((item, idx) => ({
    id: `${datasetId}-${idx}`,
    datasetId: dataset.datasetId,
    datasetName: dataset.name,
    category: dataset.category,
    title: `${dataset.name} Record`,
    summary: JSON.stringify(item).substring(0, 200) + "...",
    data: item,
    date: new Date().toISOString(),
    noCdsDisclaimer: NO_CDS_DISCLAIMER
  }));
}

export async function getAIInsightsForData(userId: string, data: any[], context: string): Promise<string[]> {
  logPhiAccess({
    userId,
    action: "read",
    resourceType: "CDCAIInsights",
    details: `Generate AI insights for ${context}`
  });
  
  try {
    const content = await generatePhiSafeText({
      system: `You are a public health data analyst. Provide 3-5 brief, actionable insights based on CDC data.
Each insight should be one sentence. Focus on trends, concerns, and recommendations.
${NO_CDS_DISCLAIMER}`,
      user: `Context: ${context}\n\nData sample:\n${JSON.stringify(data.slice(0, 10), null, 2)}\n\nProvide key insights.`,
      maxTokens: 300,
      temperature: 0.3,
    });

    return (content || "").split('\n').filter(line => line.trim().length > 0).slice(0, 5);
  } catch (error) {
    console.error("[CDC Feeds] AI insights error:", error);
    return ["AI analysis temporarily unavailable."];
  }
}

export function getAvailableDatasets(): CDCDataset[] {
  return AVAILABLE_DATASETS;
}

export { NO_CDS_DISCLAIMER };
