import { Router, Request, Response } from "express";
import { healthReportService, type ReportPeriod } from "./services/health-report-service";

const router = Router();

router.get("/generate/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const period = (req.query.period as ReportPeriod) || "weekly";
    const language = (req.query.language as string) || "en";

    if (!["weekly", "monthly"].includes(period)) {
      return res.status(400).json({
        success: false,
        error: "Invalid period. Must be 'weekly' or 'monthly'"
      });
    }

    const report = await healthReportService.generateReport(patientId, period, language);

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error("[HealthReport] Error generating report:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate health report"
    });
  }
});

router.get("/history/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const reports = await healthReportService.getReportHistory(patientId);

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error("[HealthReport] Error fetching report history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch report history"
    });
  }
});

router.get("/goals/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const goals = await healthReportService.getGoals(patientId);

    res.json({
      success: true,
      data: goals
    });
  } catch (error) {
    console.error("[HealthReport] Error fetching goals:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch health goals"
    });
  }
});

router.post("/goals/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const { name, category, target, current, unit, deadline } = req.body;

    if (!name || !category || !target || !unit) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: name, category, target, unit"
      });
    }

    const goal = await healthReportService.setGoal(patientId, {
      name,
      category,
      target: Number(target),
      current: Number(current) || 0,
      unit,
      deadline
    });

    res.json({
      success: true,
      data: goal
    });
  } catch (error) {
    console.error("[HealthReport] Error creating goal:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create health goal"
    });
  }
});

router.get("/disclaimer/:language", (req: Request, res: Response) => {
  const { language } = req.params;
  const disclaimer = healthReportService.getLocalizedDisclaimer(language);

  res.json({
    success: true,
    data: {
      language,
      disclaimer
    }
  });
});

export default router;
