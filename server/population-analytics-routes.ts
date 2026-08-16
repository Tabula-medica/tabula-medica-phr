import { Router, Request, Response } from "express";
import {
  getPopulationAnalyticsDashboard,
  getReadmissionRiskAnalysis,
  getTreatmentEfficacyByDemographics,
  getResourceAllocationOptimization,
  getAIPopulationInsights,
} from "./services/ai-population-analytics-service";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();
router.use(requireUser);

const NO_CDS_DISCLAIMER = "IMPORTANT: This is NOT clinical decision support. All content is for operational analytics, resource planning, and quality improvement purposes only. All clinical decisions must be made by qualified healthcare professionals based on their clinical judgment.";

function logHipaaAudit(action: string, userId: string, details: string) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][PopulationAnalytics] ${timestamp} | Action: ${action} | User: ${userId} | Details: ${details}`);
}

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    logHipaaAudit("DASHBOARD_ACCESS", userId, "Fetching population analytics dashboard - aggregate data only, no individual PHI");

    const dashboard = await getPopulationAnalyticsDashboard(userId);

    logHipaaAudit("DASHBOARD_ACCESS_SUCCESS", userId, `Dashboard retrieved with ${dashboard.populationSize} patients (de-identified aggregate data)`);

    res.json({
      success: true,
      ...dashboard,
    });
  } catch (error) {
    const userId = getUserId(req);
    logHipaaAudit("DASHBOARD_ACCESS_ERROR", userId, `Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    console.error("[PopulationAnalytics] Error fetching dashboard:", error);
    res.status(500).json({ 
      error: "Failed to fetch population analytics dashboard",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/readmission-risk", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const ageGroup = req.query.ageGroup as string | undefined;
    const riskLevel = req.query.riskLevel as string | undefined;

    logHipaaAudit("READMISSION_ANALYSIS", userId, `Analyzing readmission risk - Filters: ageGroup=${ageGroup || "all"}, riskLevel=${riskLevel || "all"}`);

    const analysis = await getReadmissionRiskAnalysis(userId, { ageGroup, riskLevel });

    logHipaaAudit("READMISSION_ANALYSIS_SUCCESS", userId, `Retrieved ${analysis.predictions?.length || 0} patient risk assessments`);

    res.json({
      success: true,
      ...analysis,
    });
  } catch (error) {
    const userId = getUserId(req);
    logHipaaAudit("READMISSION_ANALYSIS_ERROR", userId, `Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    console.error("[PopulationAnalytics] Error analyzing readmission risk:", error);
    res.status(500).json({ 
      error: "Failed to analyze readmission risk",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/treatment-efficacy", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const treatmentId = req.query.treatmentId as string | undefined;
    const demographic = req.query.demographic as string | undefined;

    logHipaaAudit("TREATMENT_EFFICACY", userId, `Analyzing treatment efficacy - Treatment: ${treatmentId || "all"}, Demographic: ${demographic || "all"}`);

    const efficacy = await getTreatmentEfficacyByDemographics(userId, treatmentId, demographic);

    logHipaaAudit("TREATMENT_EFFICACY_SUCCESS", userId, `Retrieved ${efficacy.analyses?.length || 0} treatment efficacy analyses`);

    res.json({
      success: true,
      ...efficacy,
    });
  } catch (error) {
    const userId = getUserId(req);
    logHipaaAudit("TREATMENT_EFFICACY_ERROR", userId, `Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    console.error("[PopulationAnalytics] Error analyzing treatment efficacy:", error);
    res.status(500).json({ 
      error: "Failed to analyze treatment efficacy",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.get("/resource-optimization", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    logHipaaAudit("RESOURCE_OPTIMIZATION", userId, "Generating resource allocation optimization recommendations");

    const optimization = await getResourceAllocationOptimization(userId);

    logHipaaAudit("RESOURCE_OPTIMIZATION_SUCCESS", userId, `Generated ${optimization.insights?.length || 0} resource optimization insights`);

    res.json({
      success: true,
      ...optimization,
    });
  } catch (error) {
    const userId = getUserId(req);
    logHipaaAudit("RESOURCE_OPTIMIZATION_ERROR", userId, `Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    console.error("[PopulationAnalytics] Error optimizing resources:", error);
    res.status(500).json({ 
      error: "Failed to generate resource optimization",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

router.post("/ai-insights", async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    const userId = getUserId(req);

    if (!query) {
      logHipaaAudit("AI_INSIGHTS_VALIDATION_ERROR", userId, "Missing required query parameter");
      return res.status(400).json({ 
        error: "Query is required",
        disclaimer: NO_CDS_DISCLAIMER,
      });
    }

    logHipaaAudit("AI_INSIGHTS", userId, `Generating AI insights for query: ${query.slice(0, 100)}${query.length > 100 ? "..." : ""}`);

    const insights = await getAIPopulationInsights(userId, query);

    logHipaaAudit("AI_INSIGHTS_SUCCESS", userId, `Generated ${insights.insights?.length || 0} insights and ${insights.recommendations?.length || 0} recommendations`);

    res.json({
      success: true,
      ...insights,
    });
  } catch (error) {
    const userId = getUserId(req);
    logHipaaAudit("AI_INSIGHTS_ERROR", userId, `Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    console.error("[PopulationAnalytics] Error generating AI insights:", error);
    res.status(500).json({ 
      error: "Failed to generate AI insights",
      disclaimer: NO_CDS_DISCLAIMER,
    });
  }
});

export default router;
