import { Router, Request, Response } from "express";
import { verifySummaryAccuracy, getAccuracyChecklist } from "../services/summary-accuracy-service";

const router = Router();

router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { summaryText, patientId, summaryType } = req.body;

    if (!summaryText || typeof summaryText !== "string") {
      return res.status(400).json({ error: "summaryText is required" });
    }

    if (!patientId || typeof patientId !== "string") {
      return res.status(400).json({ error: "patientId is required" });
    }

    if (summaryText.length > 10000) {
      return res.status(400).json({ error: "summaryText must be under 10000 characters" });
    }

    const report = await verifySummaryAccuracy({ summaryText, patientId, summaryType });
    res.json(report);
  } catch (error: any) {
    console.error("[SummaryAccuracy] Verification error:", error?.message);
    res.status(500).json({ error: "Failed to verify summary accuracy" });
  }
});

router.get("/checklist", async (_req: Request, res: Response) => {
  try {
    const checklist = getAccuracyChecklist();
    const allChecks = checklist.flatMap((c) => c.checks);
    const activeCount = allChecks.filter((c) => c.status === "active").length;

    res.json({
      categories: checklist,
      summary: {
        totalChecks: allChecks.length,
        activeChecks: activeCount,
        coverage: Math.round((activeCount / allChecks.length) * 100),
      },
    });
  } catch (error: any) {
    console.error("[SummaryAccuracy] Checklist error:", error?.message);
    res.status(500).json({ error: "Failed to get accuracy checklist" });
  }
});

export default router;
