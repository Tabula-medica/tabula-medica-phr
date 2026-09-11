import { generatePhiSafeText } from "./ai-gateway";
import { logPhiAccess } from "../security/hipaa-audit";

export interface StaffingPrediction {
  id: string;
  date: string;
  dayOfWeek: string;
  predictedAppointments: number;
  predictedWalkIns: number;
  totalPatientVolume: number;
  staffingRecommendations: {
    role: string;
    requiredCount: number;
    currentScheduled: number;
    variance: number;
    urgency: "critical" | "warning" | "optimal";
  }[];
  peakHours: { hour: string; volume: number }[];
  confidence: number;
  aiInsights: string;
  createdAt: string;
}

export interface HistoricalAppointmentData {
  id: string;
  date: string;
  dayOfWeek: string;
  scheduledAppointments: number;
  completedAppointments: number;
  noShows: number;
  walkIns: number;
  averageWaitTime: number;
  staffOnDuty: { role: string; count: number }[];
  patientSatisfactionScore: number;
}

export interface CostCategory {
  id: string;
  name: string;
  category: "labor" | "supplies" | "equipment" | "facilities" | "administrative" | "technology" | "other";
  currentMonthSpend: number;
  previousMonthSpend: number;
  budgetedAmount: number;
  variance: number;
  variancePercentage: number;
  trend: "increasing" | "decreasing" | "stable";
  subcategories: {
    name: string;
    spend: number;
    percentage: number;
  }[];
}

export interface CostAnalysis {
  id: string;
  period: string;
  totalOperatingCost: number;
  costPerPatientVisit: number;
  laborCostRatio: number;
  supplyUtilizationRate: number;
  categories: CostCategory[];
  efficiencyOpportunities: EfficiencyOpportunity[];
  benchmarkComparison: {
    metric: string;
    ourValue: number;
    industryAverage: number;
    percentile: number;
  }[];
  aiAnalysis: string;
  generatedAt: string;
}

export interface EfficiencyOpportunity {
  id: string;
  title: string;
  category: string;
  potentialSavings: number;
  implementationEffort: "low" | "medium" | "high";
  timeToRealize: string;
  description: string;
  recommendedActions: string[];
  riskLevel: "low" | "medium" | "high";
  priority: number;
}

export interface ResourceForecast {
  id: string;
  resourceType: "equipment" | "supplies" | "medications" | "ppe" | "technology" | "furniture";
  resourceName: string;
  currentStock: number;
  averageDailyUsage: number;
  daysUntilDepletion: number;
  reorderPoint: number;
  recommendedOrderQuantity: number;
  leadTimeDays: number;
  estimatedCost: number;
  urgency: "critical" | "soon" | "planned" | "optimal";
  demandTrend: "increasing" | "decreasing" | "stable" | "seasonal";
  forecastedDemand: { month: string; quantity: number }[];
}

export interface ResourceForecastSummary {
  id: string;
  generatedAt: string;
  forecastPeriod: string;
  totalResources: number;
  criticalItems: number;
  upcomingOrders: number;
  estimatedSpend: number;
  resources: ResourceForecast[];
  aiRecommendations: string;
  demandPatterns: {
    pattern: string;
    affectedResources: string[];
    recommendation: string;
  }[];
}

export interface OperationsAnalyticsSummary {
  staffingAlerts: number;
  costVarianceAlerts: number;
  resourceAlerts: number;
  efficiencyScore: number;
  predictedPatientVolume7Days: number;
  projectedCostSavings: number;
  upcomingResourceOrders: number;
  lastUpdated: string;
}

const historicalDataStore = new Map<string, HistoricalAppointmentData>();
const staffingPredictionStore = new Map<string, StaffingPrediction>();
const costAnalysisStore = new Map<string, CostAnalysis>();
const resourceForecastStore = new Map<string, ResourceForecastSummary>();

function initializeSampleData() {
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  for (let i = 30; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dayOfWeek = daysOfWeek[date.getDay()];
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    
    const baseAppointments = isWeekend ? 45 : 120;
    const variation = Math.floor(Math.random() * 30) - 15;
    
    const data: HistoricalAppointmentData = {
      id: `hist-${i}`,
      date: date.toISOString().split("T")[0],
      dayOfWeek,
      scheduledAppointments: baseAppointments + variation,
      completedAppointments: Math.floor((baseAppointments + variation) * 0.88),
      noShows: Math.floor((baseAppointments + variation) * 0.08),
      walkIns: Math.floor(Math.random() * 15) + 5,
      averageWaitTime: 12 + Math.floor(Math.random() * 10),
      staffOnDuty: [
        { role: "Physician", count: isWeekend ? 3 : 8 },
        { role: "Nurse", count: isWeekend ? 6 : 15 },
        { role: "Medical Assistant", count: isWeekend ? 4 : 12 },
        { role: "Front Desk", count: isWeekend ? 2 : 5 },
        { role: "Lab Technician", count: isWeekend ? 1 : 4 }
      ],
      patientSatisfactionScore: 3.8 + Math.random() * 1.2
    };
    historicalDataStore.set(data.id, data);
  }

  for (let i = 0; i < 7; i++) {
    const date = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
    const dayOfWeek = daysOfWeek[date.getDay()];
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    
    const baseVolume = isWeekend ? 50 : 125;
    const walkIns = isWeekend ? 8 : 18;
    
    const prediction: StaffingPrediction = {
      id: `pred-${i}`,
      date: date.toISOString().split("T")[0],
      dayOfWeek,
      predictedAppointments: baseVolume,
      predictedWalkIns: walkIns,
      totalPatientVolume: baseVolume + walkIns,
      staffingRecommendations: [
        { 
          role: "Physician", 
          requiredCount: isWeekend ? 4 : 9, 
          currentScheduled: isWeekend ? 3 : 8,
          variance: isWeekend ? -1 : -1,
          urgency: "warning"
        },
        { 
          role: "Nurse", 
          requiredCount: isWeekend ? 7 : 16, 
          currentScheduled: isWeekend ? 6 : 15,
          variance: isWeekend ? -1 : -1,
          urgency: "warning"
        },
        { 
          role: "Medical Assistant", 
          requiredCount: isWeekend ? 5 : 12, 
          currentScheduled: isWeekend ? 4 : 12,
          variance: isWeekend ? -1 : 0,
          urgency: isWeekend ? "warning" : "optimal"
        },
        { 
          role: "Front Desk", 
          requiredCount: isWeekend ? 2 : 5, 
          currentScheduled: isWeekend ? 2 : 5,
          variance: 0,
          urgency: "optimal"
        },
        { 
          role: "Lab Technician", 
          requiredCount: isWeekend ? 2 : 4, 
          currentScheduled: isWeekend ? 1 : 4,
          variance: isWeekend ? -1 : 0,
          urgency: isWeekend ? "critical" : "optimal"
        }
      ],
      peakHours: [
        { hour: "8:00 AM", volume: Math.floor(baseVolume * 0.12) },
        { hour: "9:00 AM", volume: Math.floor(baseVolume * 0.15) },
        { hour: "10:00 AM", volume: Math.floor(baseVolume * 0.14) },
        { hour: "11:00 AM", volume: Math.floor(baseVolume * 0.12) },
        { hour: "12:00 PM", volume: Math.floor(baseVolume * 0.08) },
        { hour: "1:00 PM", volume: Math.floor(baseVolume * 0.10) },
        { hour: "2:00 PM", volume: Math.floor(baseVolume * 0.13) },
        { hour: "3:00 PM", volume: Math.floor(baseVolume * 0.10) },
        { hour: "4:00 PM", volume: Math.floor(baseVolume * 0.06) }
      ],
      confidence: 0.85 + Math.random() * 0.1,
      aiInsights: `Based on historical patterns, ${dayOfWeek}s typically see ${isWeekend ? "lower" : "moderate to high"} patient volume. Consider ${isWeekend ? "minimal staffing with on-call backup" : "full staffing with additional support during morning peak hours"}.`,
      createdAt: new Date().toISOString()
    };
    staffingPredictionStore.set(prediction.id, prediction);
  }

  const costAnalysis: CostAnalysis = {
    id: "cost-current",
    period: "January 2026",
    totalOperatingCost: 2850000,
    costPerPatientVisit: 285,
    laborCostRatio: 0.58,
    supplyUtilizationRate: 0.82,
    categories: [
      {
        id: "cat-1",
        name: "Labor & Staffing",
        category: "labor",
        currentMonthSpend: 1653000,
        previousMonthSpend: 1620000,
        budgetedAmount: 1700000,
        variance: -47000,
        variancePercentage: -2.8,
        trend: "stable",
        subcategories: [
          { name: "Physicians", spend: 680000, percentage: 41.1 },
          { name: "Nursing Staff", spend: 520000, percentage: 31.5 },
          { name: "Support Staff", spend: 320000, percentage: 19.4 },
          { name: "Administrative", spend: 133000, percentage: 8.0 }
        ]
      },
      {
        id: "cat-2",
        name: "Medical Supplies",
        category: "supplies",
        currentMonthSpend: 456000,
        previousMonthSpend: 425000,
        budgetedAmount: 440000,
        variance: 16000,
        variancePercentage: 3.6,
        trend: "increasing",
        subcategories: [
          { name: "Consumables", spend: 210000, percentage: 46.1 },
          { name: "Pharmaceuticals", spend: 156000, percentage: 34.2 },
          { name: "Laboratory Supplies", spend: 90000, percentage: 19.7 }
        ]
      },
      {
        id: "cat-3",
        name: "Equipment",
        category: "equipment",
        currentMonthSpend: 285000,
        previousMonthSpend: 310000,
        budgetedAmount: 300000,
        variance: -15000,
        variancePercentage: -5.0,
        trend: "decreasing",
        subcategories: [
          { name: "Maintenance", spend: 145000, percentage: 50.9 },
          { name: "Leasing", spend: 95000, percentage: 33.3 },
          { name: "New Purchases", spend: 45000, percentage: 15.8 }
        ]
      },
      {
        id: "cat-4",
        name: "Facilities",
        category: "facilities",
        currentMonthSpend: 228000,
        previousMonthSpend: 225000,
        budgetedAmount: 230000,
        variance: -2000,
        variancePercentage: -0.9,
        trend: "stable",
        subcategories: [
          { name: "Utilities", spend: 85000, percentage: 37.3 },
          { name: "Maintenance", spend: 78000, percentage: 34.2 },
          { name: "Cleaning & Sanitation", spend: 65000, percentage: 28.5 }
        ]
      },
      {
        id: "cat-5",
        name: "Technology",
        category: "technology",
        currentMonthSpend: 142000,
        previousMonthSpend: 138000,
        budgetedAmount: 145000,
        variance: -3000,
        variancePercentage: -2.1,
        trend: "stable",
        subcategories: [
          { name: "EHR Systems", spend: 65000, percentage: 45.8 },
          { name: "Infrastructure", spend: 42000, percentage: 29.6 },
          { name: "Software Licenses", spend: 35000, percentage: 24.6 }
        ]
      },
      {
        id: "cat-6",
        name: "Administrative",
        category: "administrative",
        currentMonthSpend: 86000,
        previousMonthSpend: 82000,
        budgetedAmount: 85000,
        variance: 1000,
        variancePercentage: 1.2,
        trend: "stable",
        subcategories: [
          { name: "Insurance & Compliance", spend: 45000, percentage: 52.3 },
          { name: "Professional Services", spend: 25000, percentage: 29.1 },
          { name: "Office Supplies", spend: 16000, percentage: 18.6 }
        ]
      }
    ],
    efficiencyOpportunities: [
      {
        id: "eff-1",
        title: "Optimize Staff Scheduling with AI",
        category: "Labor",
        potentialSavings: 85000,
        implementationEffort: "medium",
        timeToRealize: "3-6 months",
        description: "Implement AI-driven staff scheduling to reduce overtime and improve coverage during peak hours.",
        recommendedActions: [
          "Deploy predictive scheduling algorithm",
          "Train managers on new scheduling system",
          "Monitor overtime reduction metrics"
        ],
        riskLevel: "low",
        priority: 1
      },
      {
        id: "eff-2",
        title: "Consolidate Medical Supply Vendors",
        category: "Supplies",
        potentialSavings: 45000,
        implementationEffort: "low",
        timeToRealize: "1-3 months",
        description: "Reduce supply costs by consolidating vendors and negotiating bulk pricing agreements.",
        recommendedActions: [
          "Audit current vendor contracts",
          "Identify consolidation opportunities",
          "Negotiate new bulk pricing agreements"
        ],
        riskLevel: "low",
        priority: 2
      },
      {
        id: "eff-3",
        title: "Implement Preventive Equipment Maintenance",
        category: "Equipment",
        potentialSavings: 32000,
        implementationEffort: "medium",
        timeToRealize: "6-12 months",
        description: "Shift from reactive to preventive maintenance to reduce equipment downtime and emergency repairs.",
        recommendedActions: [
          "Create maintenance schedule for all equipment",
          "Train staff on basic maintenance procedures",
          "Track equipment performance metrics"
        ],
        riskLevel: "low",
        priority: 3
      },
      {
        id: "eff-4",
        title: "Reduce Paper-Based Processes",
        category: "Administrative",
        potentialSavings: 18000,
        implementationEffort: "medium",
        timeToRealize: "3-6 months",
        description: "Digitize remaining paper processes to reduce printing, storage, and administrative labor costs.",
        recommendedActions: [
          "Identify remaining paper-based workflows",
          "Implement digital alternatives",
          "Train staff on paperless procedures"
        ],
        riskLevel: "low",
        priority: 4
      },
      {
        id: "eff-5",
        title: "Optimize Energy Usage",
        category: "Facilities",
        potentialSavings: 22000,
        implementationEffort: "low",
        timeToRealize: "1-3 months",
        description: "Implement smart energy management to reduce utility costs during off-peak hours.",
        recommendedActions: [
          "Install smart thermostats and lighting controls",
          "Adjust HVAC schedules for occupancy patterns",
          "Monitor energy consumption dashboards"
        ],
        riskLevel: "low",
        priority: 5
      }
    ],
    benchmarkComparison: [
      { metric: "Cost per Patient Visit", ourValue: 285, industryAverage: 310, percentile: 72 },
      { metric: "Labor Cost Ratio", ourValue: 58, industryAverage: 55, percentile: 45 },
      { metric: "Supply Utilization", ourValue: 82, industryAverage: 78, percentile: 68 },
      { metric: "Equipment Downtime %", ourValue: 3.2, industryAverage: 4.5, percentile: 75 },
      { metric: "Admin Cost Ratio", ourValue: 3.0, industryAverage: 3.5, percentile: 70 }
    ],
    aiAnalysis: "Overall operational efficiency is strong with cost per patient visit 8% below industry average. Key areas for improvement include labor cost ratio (3% above benchmark) and supply cost management (trending upward). Recommended focus: implement AI scheduling to optimize staffing levels and negotiate consolidated vendor contracts for supplies.",
    generatedAt: new Date().toISOString()
  };
  costAnalysisStore.set(costAnalysis.id, costAnalysis);

  const resourceForecast: ResourceForecastSummary = {
    id: "forecast-current",
    generatedAt: new Date().toISOString(),
    forecastPeriod: "Next 90 Days",
    totalResources: 48,
    criticalItems: 3,
    upcomingOrders: 8,
    estimatedSpend: 127500,
    resources: [
      {
        id: "res-1",
        resourceType: "supplies",
        resourceName: "Examination Gloves (Box of 100)",
        currentStock: 450,
        averageDailyUsage: 28,
        daysUntilDepletion: 16,
        reorderPoint: 500,
        recommendedOrderQuantity: 2000,
        leadTimeDays: 5,
        estimatedCost: 4800,
        urgency: "critical",
        demandTrend: "stable",
        forecastedDemand: [
          { month: "Feb 2026", quantity: 840 },
          { month: "Mar 2026", quantity: 868 },
          { month: "Apr 2026", quantity: 840 }
        ]
      },
      {
        id: "res-2",
        resourceType: "supplies",
        resourceName: "Surgical Masks (Box of 50)",
        currentStock: 280,
        averageDailyUsage: 22,
        daysUntilDepletion: 13,
        reorderPoint: 400,
        recommendedOrderQuantity: 1500,
        leadTimeDays: 7,
        estimatedCost: 3750,
        urgency: "critical",
        demandTrend: "increasing",
        forecastedDemand: [
          { month: "Feb 2026", quantity: 660 },
          { month: "Mar 2026", quantity: 715 },
          { month: "Apr 2026", quantity: 748 }
        ]
      },
      {
        id: "res-3",
        resourceType: "medications",
        resourceName: "Insulin Vials (10mL)",
        currentStock: 85,
        averageDailyUsage: 6,
        daysUntilDepletion: 14,
        reorderPoint: 100,
        recommendedOrderQuantity: 200,
        leadTimeDays: 10,
        estimatedCost: 8500,
        urgency: "critical",
        demandTrend: "stable",
        forecastedDemand: [
          { month: "Feb 2026", quantity: 180 },
          { month: "Mar 2026", quantity: 186 },
          { month: "Apr 2026", quantity: 180 }
        ]
      },
      {
        id: "res-4",
        resourceType: "supplies",
        resourceName: "Blood Collection Tubes",
        currentStock: 1200,
        averageDailyUsage: 35,
        daysUntilDepletion: 34,
        reorderPoint: 800,
        recommendedOrderQuantity: 3000,
        leadTimeDays: 5,
        estimatedCost: 2100,
        urgency: "soon",
        demandTrend: "stable",
        forecastedDemand: [
          { month: "Feb 2026", quantity: 1050 },
          { month: "Mar 2026", quantity: 1085 },
          { month: "Apr 2026", quantity: 1050 }
        ]
      },
      {
        id: "res-5",
        resourceType: "equipment",
        resourceName: "Portable Vital Signs Monitor",
        currentStock: 8,
        averageDailyUsage: 0.02,
        daysUntilDepletion: 365,
        reorderPoint: 6,
        recommendedOrderQuantity: 2,
        leadTimeDays: 30,
        estimatedCost: 12000,
        urgency: "planned",
        demandTrend: "stable",
        forecastedDemand: [
          { month: "Feb 2026", quantity: 0 },
          { month: "Mar 2026", quantity: 1 },
          { month: "Apr 2026", quantity: 0 }
        ]
      },
      {
        id: "res-6",
        resourceType: "ppe",
        resourceName: "Isolation Gowns",
        currentStock: 520,
        averageDailyUsage: 15,
        daysUntilDepletion: 35,
        reorderPoint: 400,
        recommendedOrderQuantity: 1000,
        leadTimeDays: 7,
        estimatedCost: 3200,
        urgency: "soon",
        demandTrend: "seasonal",
        forecastedDemand: [
          { month: "Feb 2026", quantity: 480 },
          { month: "Mar 2026", quantity: 420 },
          { month: "Apr 2026", quantity: 390 }
        ]
      },
      {
        id: "res-7",
        resourceType: "supplies",
        resourceName: "IV Catheters (22G)",
        currentStock: 850,
        averageDailyUsage: 18,
        daysUntilDepletion: 47,
        reorderPoint: 500,
        recommendedOrderQuantity: 1500,
        leadTimeDays: 5,
        estimatedCost: 1875,
        urgency: "planned",
        demandTrend: "stable",
        forecastedDemand: [
          { month: "Feb 2026", quantity: 540 },
          { month: "Mar 2026", quantity: 558 },
          { month: "Apr 2026", quantity: 540 }
        ]
      },
      {
        id: "res-8",
        resourceType: "technology",
        resourceName: "Tablet Devices (Patient Check-in)",
        currentStock: 12,
        averageDailyUsage: 0.01,
        daysUntilDepletion: 730,
        reorderPoint: 8,
        recommendedOrderQuantity: 4,
        leadTimeDays: 14,
        estimatedCost: 2400,
        urgency: "optimal",
        demandTrend: "stable",
        forecastedDemand: [
          { month: "Feb 2026", quantity: 0 },
          { month: "Mar 2026", quantity: 0 },
          { month: "Apr 2026", quantity: 2 }
        ]
      }
    ],
    aiRecommendations: "Immediate attention required for examination gloves, surgical masks, and insulin vials - all below reorder point with lead time considerations. Consider establishing automatic reorder triggers for high-turnover supplies. Seasonal demand increase expected for PPE items during flu season (Feb-Mar). Recommend bulk ordering for Q2 to capture volume discounts.",
    demandPatterns: [
      {
        pattern: "Flu Season Surge",
        affectedResources: ["Surgical Masks", "Isolation Gowns", "Hand Sanitizer"],
        recommendation: "Increase safety stock by 25% for Feb-Mar period"
      },
      {
        pattern: "Monday Peak Demand",
        affectedResources: ["Blood Collection Tubes", "IV Catheters", "Examination Gloves"],
        recommendation: "Ensure weekend restocking to meet Monday demand"
      },
      {
        pattern: "Chronic Care Supplies",
        affectedResources: ["Insulin Vials", "Blood Glucose Test Strips", "Syringes"],
        recommendation: "Maintain consistent stock levels with 14-day buffer"
      }
    ]
  };
  resourceForecastStore.set(resourceForecast.id, resourceForecast);
}

initializeSampleData();

class OperationsAnalyticsService {
  constructor() {
    console.log("[OperationsAnalytics] Service initialized with AI-driven analytics");
    console.log("[OperationsAnalytics] Features: Staffing prediction, cost analysis, resource forecasting");
  }

  async getStaffingPredictions(): Promise<StaffingPrediction[]> {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "StaffingPrediction",
      details: "Retrieving staffing predictions"
    });

    return Array.from(staffingPredictionStore.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  async getStaffingPredictionByDate(date: string): Promise<StaffingPrediction | undefined> {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "StaffingPrediction",
      details: `Retrieving staffing prediction for ${date}`
    });

    return Array.from(staffingPredictionStore.values()).find(p => p.date === date);
  }

  async generateStaffingPrediction(targetDate: string): Promise<StaffingPrediction> {
    logPhiAccess({
      userId: "system",
      action: "write",
      resourceType: "StaffingPrediction",
      details: `Generating AI staffing prediction for ${targetDate}`
    });

    const historicalData = Array.from(historicalDataStore.values());
    const date = new Date(targetDate);
    const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    const sameDayData = historicalData.filter(d => d.dayOfWeek === dayOfWeek);
    const avgAppointments = sameDayData.reduce((sum, d) => sum + d.scheduledAppointments, 0) / Math.max(sameDayData.length, 1);
    const avgWalkIns = sameDayData.reduce((sum, d) => sum + d.walkIns, 0) / Math.max(sameDayData.length, 1);

    try {
      const responseText = await generatePhiSafeText({
        system: `You are a healthcare operations analyst providing staffing predictions.
Based on historical data, provide staffing recommendations.
Return JSON with: insights (string with 2-3 sentences of analysis).
This is for INFORMATIONAL purposes only, not clinical decision support.`,
        user: `Analyze staffing needs for ${dayOfWeek}, ${targetDate}:
Historical average appointments: ${Math.round(avgAppointments)}
Historical average walk-ins: ${Math.round(avgWalkIns)}
Day type: ${isWeekend ? "Weekend" : "Weekday"}

Provide insights on staffing optimization.`,
        responseMimeType: "application/json",
        maxTokens: 300
      });

      const parsed = JSON.parse(responseText || "{}");

      const prediction: StaffingPrediction = {
        id: `pred-${Date.now()}`,
        date: targetDate,
        dayOfWeek,
        predictedAppointments: Math.round(avgAppointments),
        predictedWalkIns: Math.round(avgWalkIns),
        totalPatientVolume: Math.round(avgAppointments + avgWalkIns),
        staffingRecommendations: this.calculateStaffingRecommendations(avgAppointments + avgWalkIns, isWeekend),
        peakHours: this.generatePeakHours(avgAppointments),
        confidence: 0.85 + Math.random() * 0.1,
        aiInsights: parsed.insights || `Based on historical patterns for ${dayOfWeek}s, expected patient volume is ${Math.round(avgAppointments + avgWalkIns)}. Staffing recommendations adjusted accordingly.`,
        createdAt: new Date().toISOString()
      };

      staffingPredictionStore.set(prediction.id, prediction);
      return prediction;
    } catch (error) {
      console.error("[OperationsAnalytics] OpenAI error:", error);
      
      const prediction: StaffingPrediction = {
        id: `pred-${Date.now()}`,
        date: targetDate,
        dayOfWeek,
        predictedAppointments: Math.round(avgAppointments),
        predictedWalkIns: Math.round(avgWalkIns),
        totalPatientVolume: Math.round(avgAppointments + avgWalkIns),
        staffingRecommendations: this.calculateStaffingRecommendations(avgAppointments + avgWalkIns, isWeekend),
        peakHours: this.generatePeakHours(avgAppointments),
        confidence: 0.80,
        aiInsights: `Based on historical patterns for ${dayOfWeek}s, expected patient volume is ${Math.round(avgAppointments + avgWalkIns)}. ${isWeekend ? "Weekend staffing levels recommended." : "Full staffing with morning peak coverage recommended."}`,
        createdAt: new Date().toISOString()
      };

      staffingPredictionStore.set(prediction.id, prediction);
      return prediction;
    }
  }

  private calculateStaffingRecommendations(volume: number, isWeekend: boolean): StaffingPrediction["staffingRecommendations"] {
    const baseMultiplier = isWeekend ? 0.4 : 1.0;
    return [
      {
        role: "Physician",
        requiredCount: Math.ceil(volume / 15 * baseMultiplier),
        currentScheduled: Math.floor(volume / 15 * baseMultiplier * 0.9),
        variance: -1,
        urgency: "warning"
      },
      {
        role: "Nurse",
        requiredCount: Math.ceil(volume / 8 * baseMultiplier),
        currentScheduled: Math.floor(volume / 8 * baseMultiplier),
        variance: 0,
        urgency: "optimal"
      },
      {
        role: "Medical Assistant",
        requiredCount: Math.ceil(volume / 10 * baseMultiplier),
        currentScheduled: Math.floor(volume / 10 * baseMultiplier),
        variance: 0,
        urgency: "optimal"
      },
      {
        role: "Front Desk",
        requiredCount: Math.ceil(volume / 25 * baseMultiplier),
        currentScheduled: Math.floor(volume / 25 * baseMultiplier),
        variance: 0,
        urgency: "optimal"
      },
      {
        role: "Lab Technician",
        requiredCount: Math.ceil(volume / 30 * baseMultiplier),
        currentScheduled: Math.floor(volume / 30 * baseMultiplier * 0.8),
        variance: -1,
        urgency: isWeekend ? "critical" : "warning"
      }
    ];
  }

  private generatePeakHours(avgAppointments: number): { hour: string; volume: number }[] {
    const distribution = [0.12, 0.15, 0.14, 0.12, 0.08, 0.10, 0.13, 0.10, 0.06];
    const hours = ["8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM"];
    return hours.map((hour, i) => ({
      hour,
      volume: Math.floor(avgAppointments * distribution[i])
    }));
  }

  async getCostAnalysis(): Promise<CostAnalysis | undefined> {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "CostAnalysis",
      details: "Retrieving cost analysis"
    });

    return costAnalysisStore.get("cost-current");
  }

  async analyzeOperationalCosts(): Promise<{
    analysis: string;
    topOpportunities: EfficiencyOpportunity[];
    totalPotentialSavings: number;
  }> {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "CostAnalysis",
      details: "AI analyzing operational costs"
    });

    const costData = costAnalysisStore.get("cost-current");
    if (!costData) {
      throw new Error("Cost analysis data not available");
    }

    try {
      const responseText = await generatePhiSafeText({
        system: `You are a healthcare financial analyst identifying cost efficiency opportunities.
Analyze the cost data and provide actionable recommendations.
Return JSON with: analysis (string with 3-4 sentences), focusAreas (array of 3 strings).
This is for INFORMATIONAL purposes only, not financial advice.`,
        user: `Analyze operational costs:
Total Operating Cost: $${costData.totalOperatingCost.toLocaleString()}
Cost Per Patient Visit: $${costData.costPerPatientVisit}
Labor Cost Ratio: ${(costData.laborCostRatio * 100).toFixed(1)}%
Supply Utilization: ${(costData.supplyUtilizationRate * 100).toFixed(1)}%

Categories with variance:
${costData.categories.filter(c => Math.abs(c.variancePercentage) > 2).map(c =>
  `- ${c.name}: ${c.variancePercentage > 0 ? '+' : ''}${c.variancePercentage.toFixed(1)}% vs budget`
).join('\n')}`,
        responseMimeType: "application/json",
        maxTokens: 400
      });

      const parsed = JSON.parse(responseText || "{}");
      const topOpportunities = costData.efficiencyOpportunities.slice(0, 3);
      const totalSavings = topOpportunities.reduce((sum, o) => sum + o.potentialSavings, 0);

      return {
        analysis: parsed.analysis || costData.aiAnalysis,
        topOpportunities,
        totalPotentialSavings: totalSavings
      };
    } catch (error) {
      console.error("[OperationsAnalytics] OpenAI error:", error);
      const topOpportunities = costData.efficiencyOpportunities.slice(0, 3);
      return {
        analysis: costData.aiAnalysis,
        topOpportunities,
        totalPotentialSavings: topOpportunities.reduce((sum, o) => sum + o.potentialSavings, 0)
      };
    }
  }

  async getResourceForecast(): Promise<ResourceForecastSummary | undefined> {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "ResourceForecast",
      details: "Retrieving resource forecast"
    });

    return resourceForecastStore.get("forecast-current");
  }

  async forecastResourceNeeds(resourceType?: string): Promise<ResourceForecast[]> {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "ResourceForecast",
      details: `Forecasting resource needs for ${resourceType || "all resources"}`
    });

    const forecast = resourceForecastStore.get("forecast-current");
    if (!forecast) return [];

    if (resourceType) {
      return forecast.resources.filter(r => r.resourceType === resourceType);
    }
    return forecast.resources;
  }

  async getAnalyticsSummary(): Promise<OperationsAnalyticsSummary> {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "OperationsAnalytics",
      details: "Retrieving analytics summary"
    });

    const predictions = Array.from(staffingPredictionStore.values());
    const costData = costAnalysisStore.get("cost-current");
    const resourceData = resourceForecastStore.get("forecast-current");

    const staffingAlerts = predictions.flatMap(p => 
      p.staffingRecommendations.filter(r => r.urgency === "critical" || r.urgency === "warning")
    ).length;

    const costAlerts = costData?.categories.filter(c => Math.abs(c.variancePercentage) > 5).length || 0;
    const resourceAlerts = resourceData?.criticalItems || 0;

    const totalVolume7Days = predictions.reduce((sum, p) => sum + p.totalPatientVolume, 0);
    const potentialSavings = costData?.efficiencyOpportunities.reduce((sum, o) => sum + o.potentialSavings, 0) || 0;

    return {
      staffingAlerts,
      costVarianceAlerts: costAlerts,
      resourceAlerts,
      efficiencyScore: 78,
      predictedPatientVolume7Days: totalVolume7Days,
      projectedCostSavings: potentialSavings,
      upcomingResourceOrders: resourceData?.upcomingOrders || 0,
      lastUpdated: new Date().toISOString()
    };
  }

  getHistoricalData(): HistoricalAppointmentData[] {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "HistoricalAppointmentData",
      details: "Retrieving historical appointment data"
    });

    return Array.from(historicalDataStore.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }
}

export const operationsAnalyticsService = new OperationsAnalyticsService();
