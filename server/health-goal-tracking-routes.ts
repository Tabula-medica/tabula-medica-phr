import { Express, Request, Response } from "express";
import { healthGoalTrackingService, GoalStatus, PatientHealthContext } from "./services/health-goal-tracking-service";

export function registerHealthGoalTrackingRoutes(app: Express) {
  const routePrefix = "/api/health-goals";

  app.get(`${routePrefix}/goals/:patientId`, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const status = req.query.status as GoalStatus | undefined;
      
      const goals = await healthGoalTrackingService.getGoals(patientId, status);
      res.json(goals);
    } catch (error: any) {
      console.error("[HealthGoals] Error fetching goals:", error);
      res.status(500).json({ error: "Failed to fetch goals", details: error.message });
    }
  });

  app.get(`${routePrefix}/goal/:goalId`, async (req: Request, res: Response) => {
    try {
      const { goalId } = req.params;
      const goal = await healthGoalTrackingService.getGoal(goalId);
      
      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }
      
      res.json(goal);
    } catch (error: any) {
      console.error("[HealthGoals] Error fetching goal:", error);
      res.status(500).json({ error: "Failed to fetch goal", details: error.message });
    }
  });

  app.post(`${routePrefix}/goals`, async (req: Request, res: Response) => {
    try {
      const goalData = req.body;
      
      if (!goalData.patientId || !goalData.title || !goalData.category) {
        return res.status(400).json({ error: "Missing required fields: patientId, title, category" });
      }
      
      const goal = await healthGoalTrackingService.createGoal({
        ...goalData,
        milestones: goalData.milestones || [],
        reminders: goalData.reminders || [],
      });
      
      res.status(201).json(goal);
    } catch (error: any) {
      console.error("[HealthGoals] Error creating goal:", error);
      res.status(500).json({ error: "Failed to create goal", details: error.message });
    }
  });

  app.patch(`${routePrefix}/goal/:goalId`, async (req: Request, res: Response) => {
    try {
      const { goalId } = req.params;
      const updates = req.body;
      
      const goal = await healthGoalTrackingService.updateGoal(goalId, updates);
      
      if (!goal) {
        return res.status(404).json({ error: "Goal not found" });
      }
      
      res.json(goal);
    } catch (error: any) {
      console.error("[HealthGoals] Error updating goal:", error);
      res.status(500).json({ error: "Failed to update goal", details: error.message });
    }
  });

  app.delete(`${routePrefix}/goal/:goalId`, async (req: Request, res: Response) => {
    try {
      const { goalId } = req.params;
      const deleted = await healthGoalTrackingService.deleteGoal(goalId);
      
      if (!deleted) {
        return res.status(404).json({ error: "Goal not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("[HealthGoals] Error deleting goal:", error);
      res.status(500).json({ error: "Failed to delete goal", details: error.message });
    }
  });

  app.post(`${routePrefix}/progress`, async (req: Request, res: Response) => {
    try {
      const { goalId, patientId, value, unit, note, mood, source } = req.body;
      
      if (!goalId || !patientId || value === undefined || !unit) {
        return res.status(400).json({ error: "Missing required fields: goalId, patientId, value, unit" });
      }
      
      const log = await healthGoalTrackingService.logProgress({
        goalId,
        patientId,
        value,
        unit,
        note,
        mood,
        source: source || "manual",
      });
      
      res.status(201).json(log);
    } catch (error: any) {
      console.error("[HealthGoals] Error logging progress:", error);
      res.status(500).json({ error: "Failed to log progress", details: error.message });
    }
  });

  app.get(`${routePrefix}/progress/:goalId`, async (req: Request, res: Response) => {
    try {
      const { goalId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      const logs = await healthGoalTrackingService.getProgressLogs(goalId, limit);
      res.json(logs);
    } catch (error: any) {
      console.error("[HealthGoals] Error fetching progress logs:", error);
      res.status(500).json({ error: "Failed to fetch progress logs", details: error.message });
    }
  });

  app.get(`${routePrefix}/analytics/:goalId`, async (req: Request, res: Response) => {
    try {
      const { goalId } = req.params;
      const analytics = await healthGoalTrackingService.getGoalAnalytics(goalId);
      
      if (!analytics) {
        return res.status(404).json({ error: "Goal not found" });
      }
      
      res.json(analytics);
    } catch (error: any) {
      console.error("[HealthGoals] Error fetching analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics", details: error.message });
    }
  });

  app.post(`${routePrefix}/suggestions/:patientId`, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const healthContext: PatientHealthContext = req.body;
      
      if (!healthContext.conditions || !healthContext.demographics) {
        return res.status(400).json({ error: "Missing required health context" });
      }
      
      const suggestions = await healthGoalTrackingService.generateGoalSuggestions(patientId, healthContext);
      
      res.json({
        suggestions,
        disclaimer: "These suggestions are for informational purposes only and do not constitute medical advice. Always consult with your healthcare provider before starting any new health program.",
      });
    } catch (error: any) {
      console.error("[HealthGoals] Error generating suggestions:", error);
      res.status(500).json({ error: "Failed to generate suggestions", details: error.message });
    }
  });

  app.get(`${routePrefix}/motivation/:patientId`, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const goalId = req.query.goalId as string | undefined;
      
      const feedback = await healthGoalTrackingService.generateMotivationalFeedback(patientId, goalId);
      res.json(feedback);
    } catch (error: any) {
      console.error("[HealthGoals] Error generating motivation:", error);
      res.status(500).json({ error: "Failed to generate motivation", details: error.message });
    }
  });

  app.get(`${routePrefix}/dashboard/:patientId`, async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const summary = await healthGoalTrackingService.getDashboardSummary(patientId);
      res.json(summary);
    } catch (error: any) {
      console.error("[HealthGoals] Error fetching dashboard:", error);
      res.status(500).json({ error: "Failed to fetch dashboard", details: error.message });
    }
  });

  console.log("[Routes] Health Goal Tracking routes registered at /api/health-goals/*");
}
