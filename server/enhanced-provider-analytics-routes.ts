import { Router, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { enhancedProviderAnalyticsService } from "./services/enhanced-provider-analytics-service";

const router = Router();

const NO_CDS_DISCLAIMER = "DISCLAIMER: This analytics dashboard is for operational planning, quality improvement, and resource optimization only. It does NOT constitute clinical decision support. All clinical decisions must be made by qualified healthcare professionals based on individual patient assessments.";

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][ProviderAnalyticsRoutes] ${timestamp} - ${action} -`, JSON.stringify(details));
}

function requireProviderAuth(req: Request, res: Response, next: Function) {
  const sessionUserId = (req.session as any)?.userId;
  const isProvider = (req.session as any)?.isProvider || (req.session as any)?.role === "provider";
  
  if (!sessionUserId) {
    logHipaaAudit("UNAUTHORIZED_ACCESS", { path: req.path });
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  
  if (!isProvider) {
    logHipaaAudit("PROVIDER_AUTH_DENIED", { 
      path: req.path, 
      userId: hashIdentifier(sessionUserId), 
      reason: "not_provider_role" 
    });
    return res.status(403).json({ 
      success: false, 
      error: "Provider access required. This analytics dashboard is restricted to healthcare providers." 
    });
  }
  
  (req as any).providerId = sessionUserId;
  next();
}

const customReportSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().default(""),
  kpis: z.array(z.string()).default([]),
  dateRange: z.enum(["7d", "30d", "90d", "1y", "custom"]).default("30d"),
  filters: z.record(z.any()).optional().default({}),
  groupBy: z.string().optional(),
});

router.get("/metadata", (req: Request, res: Response) => {
  res.json({
    version: "1.0.0",
    name: "Enhanced Provider Analytics Dashboard",
    description: "Comprehensive analytics for population health, predictive risk, and customizable KPIs",
    features: [
      "Population health metrics and trends",
      "Health disparity identification",
      "Predictive risk stratification for chronic disease and non-adherence",
      "Customizable KPI dashboards",
      "AI-powered insights",
      "Trend visualization",
      "Custom report generation",
    ],
    categories: ["telehealth", "care_plan", "patient_outcomes", "operational", "quality"],
    disclaimer: NO_CDS_DISCLAIMER,
  });
});

router.get("/dashboard", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    
    logHipaaAudit("DASHBOARD_ACCESS", { 
      userId: hashIdentifier(providerId),
      action: "full_dashboard"
    });
    
    const dashboard = await enhancedProviderAnalyticsService.getPopulationHealthDashboard(providerId);
    
    res.json({
      success: true,
      dashboard,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[ProviderAnalytics] Error fetching dashboard:", error);
    res.status(500).json({ success: false, error: "Failed to fetch analytics dashboard" });
  }
});

router.get("/population-health", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    
    logHipaaAudit("POPULATION_HEALTH_ACCESS", { 
      userId: hashIdentifier(providerId),
      action: "population_health_metrics"
    });
    
    const dashboard = await enhancedProviderAnalyticsService.getPopulationHealthDashboard(providerId);
    
    res.json({
      success: true,
      populationOverview: dashboard.populationOverview,
      populationHealthMetrics: dashboard.populationHealthMetrics,
      trendCharts: dashboard.trendCharts.filter(c => 
        c.title.toLowerCase().includes("chronic") || c.title.toLowerCase().includes("population")
      ),
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[ProviderAnalytics] Error fetching population health:", error);
    res.status(500).json({ success: false, error: "Failed to fetch population health data" });
  }
});

router.get("/health-disparities", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { category } = req.query;
    
    logHipaaAudit("HEALTH_DISPARITIES_ACCESS", { 
      userId: hashIdentifier(providerId),
      category: category || "all"
    });
    
    const dashboard = await enhancedProviderAnalyticsService.getPopulationHealthDashboard(providerId);
    let disparities = dashboard.healthDisparities;
    
    if (category && typeof category === "string") {
      disparities = disparities.filter(d => d.category.toLowerCase().includes(category.toLowerCase()));
    }
    
    res.json({
      success: true,
      disparities,
      aiInsights: dashboard.aiInsights.filter(i => 
        i.toLowerCase().includes("disparity") || i.toLowerCase().includes("gap")
      ),
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[ProviderAnalytics] Error fetching health disparities:", error);
    res.status(500).json({ success: false, error: "Failed to fetch health disparities" });
  }
});

router.get("/predictive-risk", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { riskType, riskLevel } = req.query;
    
    logHipaaAudit("PREDICTIVE_RISK_ACCESS", { 
      userId: hashIdentifier(providerId),
      riskType: riskType || "all",
      riskLevel: riskLevel || "all"
    });
    
    let patients = await enhancedProviderAnalyticsService.getPredictiveRiskPatients(providerId);
    
    if (riskType && typeof riskType === "string") {
      patients = patients.filter(p => p.riskType === riskType);
    }
    
    if (riskLevel && typeof riskLevel === "string") {
      patients = patients.filter(p => p.riskLevel === riskLevel);
    }
    
    const riskDistribution = {
      critical: patients.filter(p => p.riskLevel === "critical").length,
      high: patients.filter(p => p.riskLevel === "high").length,
      medium: patients.filter(p => p.riskLevel === "medium").length,
      low: patients.filter(p => p.riskLevel === "low").length,
    };
    
    res.json({
      success: true,
      patients,
      riskDistribution,
      totalHighRisk: riskDistribution.critical + riskDistribution.high,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[ProviderAnalytics] Error fetching predictive risk:", error);
    res.status(500).json({ success: false, error: "Failed to fetch predictive risk data" });
  }
});

router.get("/predictive-risk/chronic-disease", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { condition } = req.query;
    
    logHipaaAudit("CHRONIC_DISEASE_RISK_ACCESS", { 
      userId: hashIdentifier(providerId),
      condition: condition || "all"
    });
    
    const patients = await enhancedProviderAnalyticsService.getChronicDiseaseRiskPatients(
      providerId, 
      typeof condition === "string" ? condition : undefined
    );
    
    res.json({
      success: true,
      patients,
      totalAtRisk: patients.length,
      riskCategories: Array.from(new Set(patients.map(p => p.riskType))),
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[ProviderAnalytics] Error fetching chronic disease risk:", error);
    res.status(500).json({ success: false, error: "Failed to fetch chronic disease risk data" });
  }
});

router.get("/predictive-risk/non-adherence", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    
    logHipaaAudit("NON_ADHERENCE_RISK_ACCESS", { 
      userId: hashIdentifier(providerId),
      action: "non_adherence_analysis"
    });
    
    const patients = await enhancedProviderAnalyticsService.getNonAdherenceRiskPatients(providerId);
    
    res.json({
      success: true,
      patients,
      totalAtRisk: patients.length,
      commonFactors: [
        { factor: "Complex Medication Regimen", count: 3 },
        { factor: "Social Isolation", count: 2 },
        { factor: "Cost Barriers", count: 2 },
        { factor: "Cognitive Decline", count: 1 },
      ],
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[ProviderAnalytics] Error fetching non-adherence risk:", error);
    res.status(500).json({ success: false, error: "Failed to fetch non-adherence risk data" });
  }
});

router.get("/kpis", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const { category } = req.query;
    
    logHipaaAudit("KPI_ACCESS", { 
      userId: hashIdentifier(providerId),
      category: category || "all"
    });
    
    let kpis = await enhancedProviderAnalyticsService.getKPIMetrics(providerId);
    
    if (category && typeof category === "string") {
      kpis = kpis.filter(k => k.category === category);
    }
    
    const summary = {
      totalKpis: kpis.length,
      onTrack: kpis.filter(k => k.status === "on_track").length,
      atRisk: kpis.filter(k => k.status === "at_risk").length,
      offTrack: kpis.filter(k => k.status === "off_track").length,
      improving: kpis.filter(k => k.trend === "up").length,
      declining: kpis.filter(k => k.trend === "down").length,
    };
    
    const categories = Array.from(new Set(kpis.map(k => k.category)));
    
    res.json({
      success: true,
      kpis,
      summary,
      categories,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[ProviderAnalytics] Error fetching KPIs:", error);
    res.status(500).json({ success: false, error: "Failed to fetch KPIs" });
  }
});

router.get("/kpis/telehealth", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    
    logHipaaAudit("TELEHEALTH_KPI_ACCESS", { 
      userId: hashIdentifier(providerId)
    });
    
    const allKpis = await enhancedProviderAnalyticsService.getKPIMetrics(providerId);
    const telehealthKpis = allKpis.filter(k => k.category === "telehealth");
    
    res.json({
      success: true,
      kpis: telehealthKpis,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[ProviderAnalytics] Error fetching telehealth KPIs:", error);
    res.status(500).json({ success: false, error: "Failed to fetch telehealth KPIs" });
  }
});

router.get("/kpis/care-plans", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    
    logHipaaAudit("CARE_PLAN_KPI_ACCESS", { 
      userId: hashIdentifier(providerId)
    });
    
    const allKpis = await enhancedProviderAnalyticsService.getKPIMetrics(providerId);
    const carePlanKpis = allKpis.filter(k => k.category === "care_plan");
    
    res.json({
      success: true,
      kpis: carePlanKpis,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[ProviderAnalytics] Error fetching care plan KPIs:", error);
    res.status(500).json({ success: false, error: "Failed to fetch care plan KPIs" });
  }
});

router.get("/kpis/outcomes", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    
    logHipaaAudit("OUTCOMES_KPI_ACCESS", { 
      userId: hashIdentifier(providerId)
    });
    
    const allKpis = await enhancedProviderAnalyticsService.getKPIMetrics(providerId);
    const outcomeKpis = allKpis.filter(k => 
      k.category === "patient_outcomes" || k.category === "quality"
    );
    
    res.json({
      success: true,
      kpis: outcomeKpis,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[ProviderAnalytics] Error fetching outcome KPIs:", error);
    res.status(500).json({ success: false, error: "Failed to fetch outcome KPIs" });
  }
});

router.post("/reports/custom", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    const validation = customReportSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid report configuration",
        details: validation.error.errors 
      });
    }
    
    const config = validation.data;
    
    logHipaaAudit("CUSTOM_REPORT_GENERATION", { 
      userId: hashIdentifier(providerId),
      reportName: config.name,
      kpiCount: config.kpis.length
    });
    
    const report = await enhancedProviderAnalyticsService.getCustomReport(providerId, {
      id: `report_${Date.now()}`,
      name: config.name,
      description: config.description,
      kpis: config.kpis,
      dateRange: config.dateRange,
      filters: config.filters,
      groupBy: config.groupBy,
      createdBy: providerId,
      createdAt: new Date().toISOString(),
    });
    
    res.json({
      success: true,
      report,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[ProviderAnalytics] Error generating custom report:", error);
    res.status(500).json({ success: false, error: "Failed to generate custom report" });
  }
});

router.get("/trends", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    
    logHipaaAudit("TRENDS_ACCESS", { 
      userId: hashIdentifier(providerId)
    });
    
    const dashboard = await enhancedProviderAnalyticsService.getPopulationHealthDashboard(providerId);
    
    res.json({
      success: true,
      trendCharts: dashboard.trendCharts,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[ProviderAnalytics] Error fetching trends:", error);
    res.status(500).json({ success: false, error: "Failed to fetch trend data" });
  }
});

router.get("/ai-insights", requireProviderAuth, async (req: Request, res: Response) => {
  try {
    const providerId = (req as any).providerId;
    
    logHipaaAudit("AI_INSIGHTS_ACCESS", { 
      userId: hashIdentifier(providerId)
    });
    
    const dashboard = await enhancedProviderAnalyticsService.getPopulationHealthDashboard(providerId);
    
    res.json({
      success: true,
      insights: dashboard.aiInsights,
      generatedAt: dashboard.generatedAt,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("[ProviderAnalytics] Error fetching AI insights:", error);
    res.status(500).json({ success: false, error: "Failed to fetch AI insights" });
  }
});

export default router;
