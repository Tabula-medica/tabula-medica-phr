import { Router, Request, Response } from "express";
import { personalizedHealthJourneyService } from "./services/personalized-health-journey-service";

const router = Router();

router.get("/dashboard/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const dashboard = await personalizedHealthJourneyService.getJourneyDashboard(patientId);
    res.json(dashboard);
  } catch (error) {
    console.error("[PersonalizedHealthJourney] Dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

router.get("/condition-types", async (_req: Request, res: Response) => {
  try {
    const conditionTypes = await personalizedHealthJourneyService.getConditionTypes();
    res.json(conditionTypes);
  } catch (error) {
    console.error("[PersonalizedHealthJourney] Condition types error:", error);
    res.status(500).json({ error: "Failed to fetch condition types" });
  }
});

router.get("/journeys/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const journeys = await personalizedHealthJourneyService.getPatientJourneys(patientId);
    res.json(journeys);
  } catch (error) {
    console.error("[PersonalizedHealthJourney] Journeys error:", error);
    res.status(500).json({ error: "Failed to fetch journeys" });
  }
});

router.get("/journey/:journeyId", async (req: Request, res: Response) => {
  try {
    const { journeyId } = req.params;
    const journey = await personalizedHealthJourneyService.getJourneyById(journeyId);
    if (!journey) {
      return res.status(404).json({ error: "Journey not found" });
    }
    res.json(journey);
  } catch (error) {
    console.error("[PersonalizedHealthJourney] Journey error:", error);
    res.status(500).json({ error: "Failed to fetch journey" });
  }
});

router.post("/journeys", async (req: Request, res: Response) => {
  try {
    const journey = await personalizedHealthJourneyService.createJourney(req.body);
    res.status(201).json(journey);
  } catch (error) {
    console.error("[PersonalizedHealthJourney] Create journey error:", error);
    res.status(500).json({ error: "Failed to create journey" });
  }
});

router.get("/modules/:journeyId", async (req: Request, res: Response) => {
  try {
    const { journeyId } = req.params;
    const modules = await personalizedHealthJourneyService.getEducationalModules(journeyId);
    res.json(modules);
  } catch (error) {
    console.error("[PersonalizedHealthJourney] Modules error:", error);
    res.status(500).json({ error: "Failed to fetch modules" });
  }
});

router.get("/module/:moduleId", async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params;
    const module = await personalizedHealthJourneyService.getModuleById(moduleId);
    if (!module) {
      return res.status(404).json({ error: "Module not found" });
    }
    res.json(module);
  } catch (error) {
    console.error("[PersonalizedHealthJourney] Module error:", error);
    res.status(500).json({ error: "Failed to fetch module" });
  }
});

router.post("/module/:moduleId/progress", async (req: Request, res: Response) => {
  try {
    const { moduleId } = req.params;
    const { progress, quizScore } = req.body;
    const module = await personalizedHealthJourneyService.updateModuleProgress(moduleId, progress, quizScore);
    if (!module) {
      return res.status(404).json({ error: "Module not found" });
    }
    res.json(module);
  } catch (error) {
    console.error("[PersonalizedHealthJourney] Module progress error:", error);
    res.status(500).json({ error: "Failed to update module progress" });
  }
});

router.get("/tasks/:journeyId", async (req: Request, res: Response) => {
  try {
    const { journeyId } = req.params;
    const { status, category } = req.query;
    const tasks = await personalizedHealthJourneyService.getCarePlanTasks(journeyId, {
      status: status as string,
      category: category as string
    });
    res.json(tasks);
  } catch (error) {
    console.error("[PersonalizedHealthJourney] Tasks error:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

router.post("/task/:taskId/complete", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const result = await personalizedHealthJourneyService.completeTask(taskId);
    res.json(result);
  } catch (error) {
    console.error("[PersonalizedHealthJourney] Complete task error:", error);
    res.status(500).json({ error: "Failed to complete task" });
  }
});

router.post("/task/:taskId/skip", async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const { reason } = req.body;
    const task = await personalizedHealthJourneyService.skipTask(taskId, reason);
    res.json(task);
  } catch (error) {
    console.error("[PersonalizedHealthJourney] Skip task error:", error);
    res.status(500).json({ error: "Failed to skip task" });
  }
});

router.get("/gamification/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const profile = await personalizedHealthJourneyService.getGamificationProfile(patientId);
    if (!profile) {
      return res.status(404).json({ error: "Gamification profile not found" });
    }
    res.json(profile);
  } catch (error) {
    console.error("[PersonalizedHealthJourney] Gamification error:", error);
    res.status(500).json({ error: "Failed to fetch gamification profile" });
  }
});

router.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const leaderboard = await personalizedHealthJourneyService.getLeaderboard(limit);
    res.json(leaderboard);
  } catch (error) {
    console.error("[PersonalizedHealthJourney] Leaderboard error:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

router.get("/insights/:journeyId", async (req: Request, res: Response) => {
  try {
    const { journeyId } = req.params;
    const insights = await personalizedHealthJourneyService.getJourneyInsights(journeyId);
    res.json(insights);
  } catch (error) {
    console.error("[PersonalizedHealthJourney] Insights error:", error);
    res.status(500).json({ error: "Failed to fetch insights" });
  }
});

router.post("/insights/:insightId/dismiss", async (req: Request, res: Response) => {
  try {
    const { insightId } = req.params;
    const insight = await personalizedHealthJourneyService.dismissInsight(insightId);
    res.json(insight);
  } catch (error) {
    console.error("[PersonalizedHealthJourney] Dismiss insight error:", error);
    res.status(500).json({ error: "Failed to dismiss insight" });
  }
});

router.post("/journey/:journeyId/ai-recommendations", async (req: Request, res: Response) => {
  try {
    const { journeyId } = req.params;
    const recommendations = await personalizedHealthJourneyService.generateAIRecommendations(journeyId);
    res.json(recommendations);
  } catch (error) {
    console.error("[PersonalizedHealthJourney] AI recommendations error:", error);
    res.status(500).json({ error: "Failed to generate AI recommendations" });
  }
});

router.post("/journey/:journeyId/adapt", async (req: Request, res: Response) => {
  try {
    const { journeyId } = req.params;
    const adaptation = await personalizedHealthJourneyService.adaptJourneyBasedOnProgress(journeyId);
    res.json({ adapted: !!adaptation, adaptation });
  } catch (error) {
    console.error("[PersonalizedHealthJourney] Adaptation error:", error);
    res.status(500).json({ error: "Failed to adapt journey" });
  }
});

export default router;
