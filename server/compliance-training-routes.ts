import { Router, Request, Response } from "express";
import { aiComplianceTrainingService } from "./services/ai-compliance-training";

const router = Router();

function logHipaaAudit(action: string, resourceType: string, req: Request, details: Record<string, unknown>): void {
  const userId = (req as any).user?.id || "anonymous";
  console.log(`[HIPAA-AUDIT] ${new Date().toISOString()} | ${action} | ${resourceType} | User: ${userId} | ${JSON.stringify(details)}`);
}

function getUserId(req: Request): string {
  return (req as any).user?.id || "current-user";
}

router.get("/modules", async (req: Request, res: Response) => {
  try {
    const { category, difficulty } = req.query;
    
    logHipaaAudit("LIST_TRAINING_MODULES", "compliance_training", req, { category, difficulty });
    
    const modules = aiComplianceTrainingService.listModules({
      category: category as any,
      difficulty: difficulty as any
    });
    
    res.json(modules);
  } catch (error) {
    console.error("[ComplianceTraining] Error listing modules:", error);
    res.status(500).json({ error: "Failed to list modules" });
  }
});

router.get("/modules/:moduleId", async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params;
    
    logHipaaAudit("VIEW_TRAINING_MODULE", "compliance_training", req, { moduleId });
    
    const module = aiComplianceTrainingService.getModule(moduleId);
    
    if (!module) {
      return res.status(404).json({ error: "Module not found" });
    }
    
    res.json(module);
  } catch (error) {
    console.error("[ComplianceTraining] Error fetching module:", error);
    res.status(500).json({ error: "Failed to fetch module" });
  }
});

router.get("/modules/:moduleId/progress", async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params;
    const userId = getUserId(req);
    
    logHipaaAudit("VIEW_MODULE_PROGRESS", "compliance_training", req, { moduleId, userId });
    
    const progress = aiComplianceTrainingService.getModuleProgress(userId, moduleId);
    
    res.json(progress || { status: "not_started" });
  } catch (error) {
    console.error("[ComplianceTraining] Error fetching progress:", error);
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

router.post("/modules/:moduleId/content/:contentId/complete", async (req: Request, res: Response) => {
  try {
    const { moduleId, contentId } = req.params;
    const userId = getUserId(req);
    
    logHipaaAudit("COMPLETE_CONTENT", "compliance_training", req, { moduleId, contentId, userId });
    
    aiComplianceTrainingService.markContentComplete(userId, moduleId, contentId);
    
    res.json({ success: true });
  } catch (error) {
    console.error("[ComplianceTraining] Error marking content complete:", error);
    res.status(500).json({ error: "Failed to mark content complete" });
  }
});

router.post("/modules/:moduleId/exercises/:exerciseId/submit", async (req: Request, res: Response) => {
  try {
    const { moduleId, exerciseId } = req.params;
    const { answer, timeSpentSeconds } = req.body;
    const userId = getUserId(req);
    
    if (answer === undefined) {
      return res.status(400).json({ error: "Answer is required" });
    }
    
    logHipaaAudit("SUBMIT_EXERCISE", "compliance_training", req, { moduleId, exerciseId, userId });
    
    const feedback = await aiComplianceTrainingService.submitExerciseAnswer(
      userId,
      moduleId,
      exerciseId,
      answer,
      timeSpentSeconds || 0
    );
    
    res.json(feedback);
  } catch (error: any) {
    console.error("[ComplianceTraining] Error submitting exercise:", error);
    res.status(error.message?.includes("not found") ? 404 : 500).json({ 
      error: error.message || "Failed to submit exercise" 
    });
  }
});

router.get("/profile", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    logHipaaAudit("VIEW_TRAINING_PROFILE", "compliance_training", req, { userId });
    
    const profile = await aiComplianceTrainingService.getUserTrainingProfile(userId);
    
    res.json(profile);
  } catch (error) {
    console.error("[ComplianceTraining] Error fetching profile:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.get("/analytics", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    logHipaaAudit("VIEW_TRAINING_ANALYTICS", "compliance_training", req, { userId });
    
    const analytics = aiComplianceTrainingService.getUserAnalytics(userId);
    
    res.json(analytics);
  } catch (error) {
    console.error("[ComplianceTraining] Error fetching analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

router.get("/analyze-weaknesses", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    logHipaaAudit("ANALYZE_WEAKNESSES", "compliance_training", req, { userId });
    
    const weaknesses = await aiComplianceTrainingService.analyzeUserWeaknesses(userId);
    
    res.json(weaknesses);
  } catch (error) {
    console.error("[ComplianceTraining] Error analyzing weaknesses:", error);
    res.status(500).json({ error: "Failed to analyze weaknesses" });
  }
});

router.post("/generate-personalized-module", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { weakness } = req.body;
    
    if (!weakness) {
      return res.status(400).json({ error: "Weakness data is required" });
    }
    
    logHipaaAudit("GENERATE_PERSONALIZED_MODULE", "compliance_training", req, { 
      userId, 
      category: weakness.category 
    });
    
    const module = await aiComplianceTrainingService.generatePersonalizedModule(userId, weakness);
    
    res.json(module);
  } catch (error) {
    console.error("[ComplianceTraining] Error generating personalized module:", error);
    res.status(500).json({ error: "Failed to generate personalized module" });
  }
});

router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    
    logHipaaAudit("VIEW_TRAINING_DASHBOARD", "compliance_training", req, { userId });
    
    await aiComplianceTrainingService.getUserTrainingProfile(userId);
    
    const dashboardData = aiComplianceTrainingService.getDashboardData(userId);
    
    res.json(dashboardData);
  } catch (error) {
    console.error("[ComplianceTraining] Error fetching dashboard:", error);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

export default router;
