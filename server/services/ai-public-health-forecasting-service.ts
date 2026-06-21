import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";

const NO_CDS_DISCLAIMER = "INFORMATIONAL ONLY: This AI-generated analysis is for public health surveillance and planning purposes only. It does NOT constitute medical advice, clinical decision support, or treatment recommendations. All public health decisions must be made by qualified healthcare officials based on comprehensive assessment of local conditions.";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "dummy-key",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface DiseaseOutbreakForecast {
  id: string;
  diseaseType: string;
  diseaseName: string;
  region: string;
  currentCases: number;
  predictedCases: {
    week1: number;
    week2: number;
    week4: number;
    week8: number;
  };
  riskLevel: "low" | "moderate" | "elevated" | "high" | "critical";
  confidenceScore: number;
  contributingFactors: string[];
  seasonalTrends: string;
  transmissionRate: number;
  predictedPeakDate: string;
  predictedPeakCases: number;
  modelType: string;
  aiInsights: string[];
  lastUpdated: string;
  noCdsDisclaimer: string;
}

export interface MedicationShortage {
  id: string;
  medicationName: string;
  ndcCode: string;
  therapeuticClass: string;
  currentInventoryLevel: "adequate" | "low" | "critical" | "stockout";
  daysOfSupplyRemaining: number;
  affectedRegions: string[];
  affectedFacilities: number;
  supplyChainStatus: {
    manufacturerStatus: string;
    distributorStatus: string;
    lastShipmentDate: string;
    nextExpectedShipment: string;
    leadTimeDays: number;
  };
  demandForecast: {
    currentDemand: number;
    projectedDemand: number;
    demandTrend: "stable" | "increasing" | "decreasing" | "spike";
  };
  alternativeMedications: {
    name: string;
    availability: "available" | "limited" | "unavailable";
    substitutionNotes: string;
  }[];
  aiPrediction: {
    predictedShortageDate: string;
    predictedRecoveryDate: string;
    riskScore: number;
    confidenceLevel: number;
    keyDrivers: string[];
  };
  recommendedActions: string[];
  lastUpdated: string;
  noCdsDisclaimer: string;
}

export interface PublicHealthIntervention {
  id: string;
  interventionType: "vaccination_campaign" | "screening_program" | "health_education" | "resource_allocation" | "surveillance_enhancement" | "outbreak_response";
  title: string;
  description: string;
  targetPopulation: {
    ageGroups: string[];
    riskFactors: string[];
    regions: string[];
    estimatedSize: number;
  };
  priority: "routine" | "elevated" | "urgent" | "emergency";
  rationale: string[];
  expectedImpact: {
    livesProtected: number;
    casesAverted: number;
    costSavings: number;
    roiPercentage: number;
  };
  resourceRequirements: {
    personnel: number;
    budget: number;
    timeframeDays: number;
    materials: string[];
  };
  implementationSteps: string[];
  successMetrics: string[];
  barriers: string[];
  aiConfidenceScore: number;
  evidenceBasis: string[];
  generatedAt: string;
  noCdsDisclaimer: string;
}

export interface TrendAnalysis {
  id: string;
  analysisType: "disease_trend" | "vaccination_coverage" | "health_disparity" | "seasonal_pattern" | "emerging_threat";
  title: string;
  timeframe: string;
  keyFindings: string[];
  trendDirection: "improving" | "stable" | "worsening" | "uncertain";
  statisticalSignificance: number;
  dataPoints: {
    date: string;
    value: number;
    predicted?: boolean;
  }[];
  correlations: {
    factor: string;
    correlationStrength: number;
    relationship: "positive" | "negative";
  }[];
  aiInterpretation: string;
  actionableInsights: string[];
  lastUpdated: string;
  noCdsDisclaimer: string;
}

export interface ForecastingDashboard {
  lastUpdated: string;
  activeOutbreakForecasts: number;
  criticalShortages: number;
  pendingInterventions: number;
  overallHealthRiskIndex: number;
  topThreats: {
    threat: string;
    riskLevel: string;
    trend: string;
  }[];
  recentAlerts: {
    type: string;
    message: string;
    severity: string;
    timestamp: string;
  }[];
  noCdsDisclaimer: string;
}

const outbreakForecasts = new Map<string, DiseaseOutbreakForecast>();
const medicationShortages = new Map<string, MedicationShortage>();
const interventions = new Map<string, PublicHealthIntervention>();
const trendAnalyses = new Map<string, TrendAnalysis>();

function initializeSampleData() {
  const forecast1: DiseaseOutbreakForecast = {
    id: "forecast-001",
    diseaseType: "respiratory",
    diseaseName: "Influenza A (H3N2)",
    region: "Northeast US",
    currentCases: 12500,
    predictedCases: {
      week1: 15800,
      week2: 19200,
      week4: 24500,
      week8: 18000,
    },
    riskLevel: "elevated",
    confidenceScore: 0.85,
    contributingFactors: [
      "Below-average vaccination rates in target population",
      "Early onset of cold weather",
      "Increased indoor gatherings during holiday season",
      "New strain variant with higher transmissibility",
    ],
    seasonalTrends: "Currently entering peak flu season. Historical data indicates peak typically occurs in late January to early February.",
    transmissionRate: 1.4,
    predictedPeakDate: "2026-02-05",
    predictedPeakCases: 28000,
    modelType: "SEIR with machine learning enhancement",
    aiInsights: [
      "Current trajectory suggests 26% increase from baseline seasonal expectations",
      "School-age children showing highest transmission rates",
      "Hospital capacity may be stressed in 3-4 weeks without intervention",
    ],
    lastUpdated: new Date().toISOString(),
    noCdsDisclaimer: NO_CDS_DISCLAIMER,
  };

  const forecast2: DiseaseOutbreakForecast = {
    id: "forecast-002",
    diseaseType: "gastrointestinal",
    diseaseName: "Norovirus GII.4",
    region: "Pacific Northwest",
    currentCases: 3200,
    predictedCases: {
      week1: 4100,
      week2: 5800,
      week4: 4200,
      week8: 2100,
    },
    riskLevel: "moderate",
    confidenceScore: 0.78,
    contributingFactors: [
      "Cluster outbreaks in long-term care facilities",
      "Winter season peak period",
      "Limited hand hygiene compliance in affected areas",
    ],
    seasonalTrends: "Norovirus peaks typically occur November through April with highest incidence in January-February.",
    transmissionRate: 1.8,
    predictedPeakDate: "2026-01-30",
    predictedPeakCases: 6500,
    modelType: "Agent-based simulation",
    aiInsights: [
      "Outbreak concentration in nursing homes requires targeted intervention",
      "Enhanced infection control measures recommended",
      "Early warning indicators suggest possible spread to schools",
    ],
    lastUpdated: new Date().toISOString(),
    noCdsDisclaimer: NO_CDS_DISCLAIMER,
  };

  outbreakForecasts.set(forecast1.id, forecast1);
  outbreakForecasts.set(forecast2.id, forecast2);

  const shortage1: MedicationShortage = {
    id: "shortage-001",
    medicationName: "Amoxicillin Oral Suspension",
    ndcCode: "0093-4150-73",
    therapeuticClass: "Antibiotics - Penicillins",
    currentInventoryLevel: "critical",
    daysOfSupplyRemaining: 12,
    affectedRegions: ["Southeast US", "Mid-Atlantic", "Midwest"],
    affectedFacilities: 847,
    supplyChainStatus: {
      manufacturerStatus: "Production at 60% capacity due to raw material shortage",
      distributorStatus: "Rationing supplies to healthcare facilities",
      lastShipmentDate: "2026-01-15",
      nextExpectedShipment: "2026-02-01",
      leadTimeDays: 9,
    },
    demandForecast: {
      currentDemand: 125000,
      projectedDemand: 180000,
      demandTrend: "increasing",
    },
    alternativeMedications: [
      {
        name: "Amoxicillin Chewable Tablets",
        availability: "limited",
        substitutionNotes: "Suitable for children who can chew; dosing adjustment may be needed",
      },
      {
        name: "Augmentin Oral Suspension",
        availability: "available",
        substitutionNotes: "Broader spectrum; consider for appropriate indications only",
      },
    ],
    aiPrediction: {
      predictedShortageDate: "2026-01-28",
      predictedRecoveryDate: "2026-02-20",
      riskScore: 0.82,
      confidenceLevel: 0.75,
      keyDrivers: [
        "Increased respiratory infections driving demand",
        "Global API supply constraints",
        "Pediatric formulation manufacturing complexity",
      ],
    },
    recommendedActions: [
      "Implement therapeutic substitution protocols",
      "Coordinate with regional pharmacy networks for redistribution",
      "Activate emergency stockpile allocation procedures",
      "Communicate with prescribers about alternative options",
    ],
    lastUpdated: new Date().toISOString(),
    noCdsDisclaimer: NO_CDS_DISCLAIMER,
  };

  const shortage2: MedicationShortage = {
    id: "shortage-002",
    medicationName: "Albuterol Metered Dose Inhaler",
    ndcCode: "0173-0682-20",
    therapeuticClass: "Bronchodilators",
    currentInventoryLevel: "low",
    daysOfSupplyRemaining: 28,
    affectedRegions: ["Southwest US", "Mountain Region"],
    affectedFacilities: 423,
    supplyChainStatus: {
      manufacturerStatus: "Normal production with logistics delays",
      distributorStatus: "Prioritizing hospital and emergency allocations",
      lastShipmentDate: "2026-01-18",
      nextExpectedShipment: "2026-01-26",
      leadTimeDays: 4,
    },
    demandForecast: {
      currentDemand: 85000,
      projectedDemand: 110000,
      demandTrend: "spike",
    },
    alternativeMedications: [
      {
        name: "Levalbuterol MDI",
        availability: "available",
        substitutionNotes: "Equivalent efficacy; higher cost may affect patient adherence",
      },
      {
        name: "Albuterol Nebulizer Solution",
        availability: "available",
        substitutionNotes: "Requires nebulizer equipment; suitable for home and clinical use",
      },
    ],
    aiPrediction: {
      predictedShortageDate: "2026-02-05",
      predictedRecoveryDate: "2026-02-15",
      riskScore: 0.65,
      confidenceLevel: 0.82,
      keyDrivers: [
        "Seasonal respiratory disease burden",
        "Propellant supply chain issues",
        "Regional distribution imbalances",
      ],
    },
    recommendedActions: [
      "Pre-position inventory in high-demand areas",
      "Educate patients on nebulizer alternatives",
      "Monitor asthma-related ED visits for early warning",
    ],
    lastUpdated: new Date().toISOString(),
    noCdsDisclaimer: NO_CDS_DISCLAIMER,
  };

  medicationShortages.set(shortage1.id, shortage1);
  medicationShortages.set(shortage2.id, shortage2);

  const intervention1: PublicHealthIntervention = {
    id: "intervention-001",
    interventionType: "vaccination_campaign",
    title: "Accelerated Influenza Vaccination Drive for High-Risk Populations",
    description: "Targeted vaccination campaign focusing on seniors, immunocompromised individuals, and healthcare workers in the Northeast region to mitigate predicted influenza surge.",
    targetPopulation: {
      ageGroups: ["65+", "50-64 with comorbidities"],
      riskFactors: ["Chronic lung disease", "Diabetes", "Heart disease", "Immunocompromised"],
      regions: ["Northeast US"],
      estimatedSize: 2400000,
    },
    priority: "urgent",
    rationale: [
      "AI forecast predicts 26% above-normal influenza activity",
      "Current vaccination coverage 15% below target in 65+ age group",
      "Hospital capacity concerns if outbreak peaks without intervention",
      "Window of opportunity before predicted peak in 4-6 weeks",
    ],
    expectedImpact: {
      livesProtected: 850,
      casesAverted: 42000,
      costSavings: 18500000,
      roiPercentage: 340,
    },
    resourceRequirements: {
      personnel: 450,
      budget: 4200000,
      timeframeDays: 21,
      materials: ["Influenza vaccines (180,000 doses)", "Syringes", "PPE", "Mobile vaccination units"],
    },
    implementationSteps: [
      "Activate mobile vaccination units in underserved areas",
      "Partner with senior centers and assisted living facilities",
      "Deploy community health workers for outreach",
      "Implement extended clinic hours at public health sites",
      "Launch targeted media campaign for high-risk groups",
    ],
    successMetrics: [
      "Vaccination coverage increase of 20% in target population",
      "Reduction in influenza-related hospitalizations vs. forecast",
      "Achievement of herd immunity threshold in target regions",
    ],
    barriers: [
      "Vaccine hesitancy in some communities",
      "Transportation access for elderly patients",
      "Limited cold chain capacity in rural areas",
    ],
    aiConfidenceScore: 0.88,
    evidenceBasis: [
      "Historical vaccination campaign effectiveness data",
      "CDC influenza surveillance reports",
      "Predictive modeling of outbreak trajectory",
    ],
    generatedAt: new Date().toISOString(),
    noCdsDisclaimer: NO_CDS_DISCLAIMER,
  };

  interventions.set(intervention1.id, intervention1);

  const trend1: TrendAnalysis = {
    id: "trend-001",
    analysisType: "disease_trend",
    title: "Respiratory Syncytial Virus (RSV) Hospitalization Trends",
    timeframe: "October 2025 - January 2026",
    keyFindings: [
      "RSV hospitalizations 35% higher than 5-year average",
      "Peak occurring 3 weeks earlier than historical norms",
      "Pediatric ICU utilization at 92% capacity in affected regions",
      "Adult RSV cases showing unusual increase in 50-64 age group",
    ],
    trendDirection: "worsening",
    statisticalSignificance: 0.95,
    dataPoints: [
      { date: "2025-10-01", value: 450 },
      { date: "2025-10-15", value: 680 },
      { date: "2025-11-01", value: 1200 },
      { date: "2025-11-15", value: 1850 },
      { date: "2025-12-01", value: 2400 },
      { date: "2025-12-15", value: 2900 },
      { date: "2026-01-01", value: 3200 },
      { date: "2026-01-15", value: 3450 },
      { date: "2026-01-22", value: 3600 },
      { date: "2026-02-01", value: 3300, predicted: true },
      { date: "2026-02-15", value: 2800, predicted: true },
    ],
    correlations: [
      { factor: "Temperature drop", correlationStrength: 0.72, relationship: "negative" },
      { factor: "School attendance", correlationStrength: 0.68, relationship: "positive" },
      { factor: "Mask-wearing prevalence", correlationStrength: 0.45, relationship: "negative" },
    ],
    aiInterpretation: "The current RSV surge appears to be driven by a combination of post-pandemic immunity gap and early-season cold weather. The pattern suggests peak may occur within the next 2 weeks, followed by gradual decline. The increase in adult cases warrants monitoring for potential expansion of vaccination recommendations.",
    actionableInsights: [
      "Consider expanding RSV immunization eligibility",
      "Pre-position pediatric respiratory support equipment",
      "Activate surge staffing protocols in high-volume pediatric centers",
      "Enhance public health messaging about hand hygiene and respiratory etiquette",
    ],
    lastUpdated: new Date().toISOString(),
    noCdsDisclaimer: NO_CDS_DISCLAIMER,
  };

  trendAnalyses.set(trend1.id, trend1);
}

initializeSampleData();

class AIPublicHealthForecastingService {
  async getDashboard(userId: string): Promise<ForecastingDashboard> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PublicHealthForecastingDashboard",
      resourceId: "dashboard",
      details: "get_forecasting_dashboard",
    });

    const forecasts = Array.from(outbreakForecasts.values());
    const shortages = Array.from(medicationShortages.values());
    const pendingInterventionsList = Array.from(interventions.values());

    const criticalShortages = shortages.filter(
      (s) => s.currentInventoryLevel === "critical" || s.currentInventoryLevel === "stockout"
    ).length;

    const urgentInterventions = pendingInterventionsList.filter(
      (i) => i.priority === "urgent" || i.priority === "emergency"
    ).length;

    const elevatedForecasts = forecasts.filter(
      (f) => f.riskLevel === "elevated" || f.riskLevel === "high" || f.riskLevel === "critical"
    );

    const riskIndex = Math.min(
      100,
      (elevatedForecasts.length * 15) + (criticalShortages * 20) + (urgentInterventions * 10)
    );

    return {
      lastUpdated: new Date().toISOString(),
      activeOutbreakForecasts: forecasts.length,
      criticalShortages,
      pendingInterventions: pendingInterventionsList.length,
      overallHealthRiskIndex: riskIndex,
      topThreats: forecasts.slice(0, 3).map((f) => ({
        threat: f.diseaseName,
        riskLevel: f.riskLevel,
        trend: f.predictedCases.week2 > f.currentCases ? "increasing" : "decreasing",
      })),
      recentAlerts: [
        {
          type: "outbreak",
          message: "Influenza A activity elevated in Northeast - 26% above seasonal baseline",
          severity: "warning",
          timestamp: new Date().toISOString(),
        },
        {
          type: "shortage",
          message: "Amoxicillin suspension critical shortage affecting 847 facilities",
          severity: "critical",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          type: "intervention",
          message: "Vaccination campaign recommended for high-risk populations",
          severity: "info",
          timestamp: new Date(Date.now() - 7200000).toISOString(),
        },
      ],
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async getOutbreakForecasts(userId: string): Promise<DiseaseOutbreakForecast[]> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "OutbreakForecast",
      resourceId: "all",
      details: "get_outbreak_forecasts",
    });

    return Array.from(outbreakForecasts.values());
  }

  async getOutbreakForecast(userId: string, forecastId: string): Promise<DiseaseOutbreakForecast | null> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "OutbreakForecast",
      resourceId: forecastId,
      details: "get_outbreak_forecast_detail",
    });

    return outbreakForecasts.get(forecastId) || null;
  }

  async generateAIOutbreakForecast(
    userId: string,
    diseaseType: string,
    region: string,
    historicalData: { date: string; cases: number }[]
  ): Promise<DiseaseOutbreakForecast> {
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "OutbreakForecast",
      resourceId: "new",
      details: `ai_generate_outbreak_forecast:${diseaseType}:${region}`,
    });

    const prompt = `You are a public health epidemiologist AI assistant. Analyze the following disease outbreak data and provide a forecast.

Disease Type: ${diseaseType}
Region: ${region}
Historical Data (last 12 weeks):
${historicalData.map((d) => `${d.date}: ${d.cases} cases`).join("\n")}

Based on epidemiological modeling principles, provide:
1. Predicted case counts for weeks 1, 2, 4, and 8
2. Risk level assessment (low/moderate/elevated/high/critical)
3. Confidence score (0-1)
4. Contributing factors (list 3-5)
5. Transmission rate estimate (R0)
6. Predicted peak date and peak cases
7. AI insights (3-5 key observations)

IMPORTANT: This is for informational and planning purposes only. NOT clinical decision support.

Respond in JSON format:
{
  "predictedCases": { "week1": number, "week2": number, "week4": number, "week8": number },
  "riskLevel": "string",
  "confidenceScore": number,
  "contributingFactors": ["string"],
  "transmissionRate": number,
  "predictedPeakDate": "YYYY-MM-DD",
  "predictedPeakCases": number,
  "aiInsights": ["string"],
  "seasonalTrends": "string"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 1000,
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");
      const currentCases = historicalData[historicalData.length - 1]?.cases || 0;

      const forecast: DiseaseOutbreakForecast = {
        id: `forecast-${Date.now()}`,
        diseaseType,
        diseaseName: diseaseType,
        region,
        currentCases,
        predictedCases: result.predictedCases || { week1: 0, week2: 0, week4: 0, week8: 0 },
        riskLevel: result.riskLevel || "moderate",
        confidenceScore: result.confidenceScore || 0.7,
        contributingFactors: result.contributingFactors || [],
        seasonalTrends: result.seasonalTrends || "Analysis pending",
        transmissionRate: result.transmissionRate || 1.0,
        predictedPeakDate: result.predictedPeakDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        predictedPeakCases: result.predictedPeakCases || currentCases * 1.5,
        modelType: "AI-enhanced SEIR model",
        aiInsights: result.aiInsights || [],
        lastUpdated: new Date().toISOString(),
        noCdsDisclaimer: NO_CDS_DISCLAIMER,
      };

      outbreakForecasts.set(forecast.id, forecast);
      return forecast;
    } catch (error) {
      console.error("[AIPublicHealthForecasting] Error generating forecast:", error);
      throw new Error("Failed to generate AI outbreak forecast");
    }
  }

  async getMedicationShortages(userId: string): Promise<MedicationShortage[]> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "MedicationShortage",
      resourceId: "all",
      details: "get_medication_shortages",
    });

    return Array.from(medicationShortages.values());
  }

  async getMedicationShortage(userId: string, shortageId: string): Promise<MedicationShortage | null> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "MedicationShortage",
      resourceId: shortageId,
      details: "get_medication_shortage_detail",
    });

    return medicationShortages.get(shortageId) || null;
  }

  async analyzeSupplyChainRisk(
    userId: string,
    medicationName: string,
    supplyData: {
      currentInventory: number;
      dailyUsage: number;
      leadTimeDays: number;
      manufacturerCapacity: number;
    }
  ): Promise<MedicationShortage> {
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "MedicationShortage",
      resourceId: "new",
      details: `ai_analyze_supply_chain:${medicationName}`,
    });

    const prompt = `You are a pharmaceutical supply chain analyst AI. Analyze the following medication supply data and predict shortage risks.

Medication: ${medicationName}
Current Inventory: ${supplyData.currentInventory} units
Daily Usage: ${supplyData.dailyUsage} units/day
Lead Time: ${supplyData.leadTimeDays} days
Manufacturer Capacity: ${supplyData.manufacturerCapacity}%

Provide analysis including:
1. Days of supply remaining
2. Inventory level assessment (adequate/low/critical/stockout)
3. Risk score (0-1)
4. Key drivers of shortage risk
5. Recommended actions (3-5)
6. Predicted shortage date (if applicable)
7. Predicted recovery date (if applicable)

IMPORTANT: This is for supply chain planning only. NOT clinical decision support.

Respond in JSON format:
{
  "daysOfSupplyRemaining": number,
  "inventoryLevel": "string",
  "riskScore": number,
  "keyDrivers": ["string"],
  "recommendedActions": ["string"],
  "predictedShortageDate": "YYYY-MM-DD or null",
  "predictedRecoveryDate": "YYYY-MM-DD or null",
  "demandTrend": "stable/increasing/decreasing/spike"
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 800,
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");

      const shortage: MedicationShortage = {
        id: `shortage-${Date.now()}`,
        medicationName,
        ndcCode: "AI-ANALYZED",
        therapeuticClass: "Unknown",
        currentInventoryLevel: result.inventoryLevel || "low",
        daysOfSupplyRemaining: result.daysOfSupplyRemaining || Math.floor(supplyData.currentInventory / supplyData.dailyUsage),
        affectedRegions: ["Analysis Region"],
        affectedFacilities: 1,
        supplyChainStatus: {
          manufacturerStatus: `Operating at ${supplyData.manufacturerCapacity}% capacity`,
          distributorStatus: "Under analysis",
          lastShipmentDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          nextExpectedShipment: new Date(Date.now() + supplyData.leadTimeDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          leadTimeDays: supplyData.leadTimeDays,
        },
        demandForecast: {
          currentDemand: supplyData.dailyUsage,
          projectedDemand: supplyData.dailyUsage * 1.1,
          demandTrend: result.demandTrend || "stable",
        },
        alternativeMedications: [],
        aiPrediction: {
          predictedShortageDate: result.predictedShortageDate || "",
          predictedRecoveryDate: result.predictedRecoveryDate || "",
          riskScore: result.riskScore || 0.5,
          confidenceLevel: 0.75,
          keyDrivers: result.keyDrivers || [],
        },
        recommendedActions: result.recommendedActions || [],
        lastUpdated: new Date().toISOString(),
        noCdsDisclaimer: NO_CDS_DISCLAIMER,
      };

      medicationShortages.set(shortage.id, shortage);
      return shortage;
    } catch (error) {
      console.error("[AIPublicHealthForecasting] Error analyzing supply chain:", error);
      throw new Error("Failed to analyze supply chain risk");
    }
  }

  async getInterventions(userId: string): Promise<PublicHealthIntervention[]> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PublicHealthIntervention",
      resourceId: "all",
      details: "get_interventions",
    });

    return Array.from(interventions.values());
  }

  async getIntervention(userId: string, interventionId: string): Promise<PublicHealthIntervention | null> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "PublicHealthIntervention",
      resourceId: interventionId,
      details: "get_intervention_detail",
    });

    return interventions.get(interventionId) || null;
  }

  async generateAIIntervention(
    userId: string,
    context: {
      threatType: string;
      region: string;
      population: number;
      currentMetrics: Record<string, number>;
    }
  ): Promise<PublicHealthIntervention> {
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "PublicHealthIntervention",
      resourceId: "new",
      details: `ai_generate_intervention:${context.threatType}:${context.region}`,
    });

    const prompt = `You are a public health policy AI assistant. Based on the following context, recommend a targeted public health intervention.

Threat Type: ${context.threatType}
Region: ${context.region}
Affected Population: ${context.population}
Current Metrics: ${JSON.stringify(context.currentMetrics)}

Provide a detailed intervention recommendation including:
1. Intervention type (vaccination_campaign/screening_program/health_education/resource_allocation/surveillance_enhancement/outbreak_response)
2. Title and description
3. Target population (age groups, risk factors, regions, estimated size)
4. Priority level (routine/elevated/urgent/emergency)
5. Rationale (3-5 points)
6. Expected impact (lives protected, cases averted, cost savings, ROI)
7. Resource requirements (personnel, budget, timeframe, materials)
8. Implementation steps (5-8 steps)
9. Success metrics (3-5 metrics)
10. Potential barriers (2-4)
11. Confidence score (0-1)

IMPORTANT: This is for public health planning only. NOT clinical decision support or medical advice.

Respond in JSON format with all the above fields.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 1500,
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");

      const intervention: PublicHealthIntervention = {
        id: `intervention-${Date.now()}`,
        interventionType: result.interventionType || "health_education",
        title: result.title || `${context.threatType} Response Intervention`,
        description: result.description || "AI-generated intervention recommendation",
        targetPopulation: result.targetPopulation || {
          ageGroups: ["All ages"],
          riskFactors: [],
          regions: [context.region],
          estimatedSize: context.population,
        },
        priority: result.priority || "elevated",
        rationale: result.rationale || [],
        expectedImpact: result.expectedImpact || {
          livesProtected: 0,
          casesAverted: 0,
          costSavings: 0,
          roiPercentage: 0,
        },
        resourceRequirements: result.resourceRequirements || {
          personnel: 0,
          budget: 0,
          timeframeDays: 30,
          materials: [],
        },
        implementationSteps: result.implementationSteps || [],
        successMetrics: result.successMetrics || [],
        barriers: result.barriers || [],
        aiConfidenceScore: result.confidenceScore || 0.7,
        evidenceBasis: ["AI-generated based on current outbreak data and historical intervention effectiveness"],
        generatedAt: new Date().toISOString(),
        noCdsDisclaimer: NO_CDS_DISCLAIMER,
      };

      interventions.set(intervention.id, intervention);
      return intervention;
    } catch (error) {
      console.error("[AIPublicHealthForecasting] Error generating intervention:", error);
      throw new Error("Failed to generate AI intervention recommendation");
    }
  }

  async getTrendAnalyses(userId: string): Promise<TrendAnalysis[]> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "TrendAnalysis",
      resourceId: "all",
      details: "get_trend_analyses",
    });

    return Array.from(trendAnalyses.values());
  }

  async getTrendAnalysis(userId: string, analysisId: string): Promise<TrendAnalysis | null> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "TrendAnalysis",
      resourceId: analysisId,
      details: "get_trend_analysis_detail",
    });

    return trendAnalyses.get(analysisId) || null;
  }

  async generateAITrendAnalysis(
    userId: string,
    analysisType: string,
    dataPoints: { date: string; value: number }[],
    context: string
  ): Promise<TrendAnalysis> {
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "TrendAnalysis",
      resourceId: "new",
      details: `ai_generate_trend_analysis:${analysisType}`,
    });

    const prompt = `You are a public health data analyst AI. Analyze the following trend data and provide insights.

Analysis Type: ${analysisType}
Context: ${context}
Data Points:
${dataPoints.map((d) => `${d.date}: ${d.value}`).join("\n")}

Provide comprehensive analysis including:
1. Key findings (4-6 observations)
2. Trend direction (improving/stable/worsening/uncertain)
3. Statistical significance (0-1)
4. Correlations with potential factors
5. AI interpretation (2-3 paragraphs)
6. Actionable insights (3-5 recommendations)
7. Projected values for next 2-4 data points

IMPORTANT: This is for surveillance and planning purposes only. NOT clinical decision support.

Respond in JSON format:
{
  "keyFindings": ["string"],
  "trendDirection": "string",
  "statisticalSignificance": number,
  "correlations": [{ "factor": "string", "correlationStrength": number, "relationship": "positive/negative" }],
  "aiInterpretation": "string",
  "actionableInsights": ["string"],
  "projectedDataPoints": [{ "date": "YYYY-MM-DD", "value": number }]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 1200,
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{}");

      const allDataPoints = [
        ...dataPoints.map((d) => ({ ...d, predicted: false })),
        ...(result.projectedDataPoints || []).map((d: any) => ({ ...d, predicted: true })),
      ];

      const analysis: TrendAnalysis = {
        id: `trend-${Date.now()}`,
        analysisType: analysisType as any,
        title: `${analysisType.replace(/_/g, " ")} Analysis`,
        timeframe: `${dataPoints[0]?.date} - ${dataPoints[dataPoints.length - 1]?.date}`,
        keyFindings: result.keyFindings || [],
        trendDirection: result.trendDirection || "uncertain",
        statisticalSignificance: result.statisticalSignificance || 0.5,
        dataPoints: allDataPoints,
        correlations: result.correlations || [],
        aiInterpretation: result.aiInterpretation || "Analysis pending",
        actionableInsights: result.actionableInsights || [],
        lastUpdated: new Date().toISOString(),
        noCdsDisclaimer: NO_CDS_DISCLAIMER,
      };

      trendAnalyses.set(analysis.id, analysis);
      return analysis;
    } catch (error) {
      console.error("[AIPublicHealthForecasting] Error generating trend analysis:", error);
      throw new Error("Failed to generate AI trend analysis");
    }
  }
}

export const aiPublicHealthForecasting = new AIPublicHealthForecastingService();

console.log("[AIPublicHealthForecasting] Sample data initialized");
console.log(`[AIPublicHealthForecasting] Outbreak Forecasts: ${outbreakForecasts.size}`);
console.log(`[AIPublicHealthForecasting] Medication Shortages: ${medicationShortages.size}`);
console.log(`[AIPublicHealthForecasting] Interventions: ${interventions.size}`);
console.log(`[AIPublicHealthForecasting] Trend Analyses: ${trendAnalyses.size}`);
console.log("[AIPublicHealthForecasting] Service initialized with NO-CDS compliance");
console.log("[AIPublicHealthForecasting] Features: outbreak forecasting, shortage prediction, intervention recommendations");
