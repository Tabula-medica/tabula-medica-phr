import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

const router = Router();

interface ErrorReport {
  id: string;
  patientId?: string;
  summaryType: string;
  description: string;
  generatedAt: string;
  citations: string[];
  reportedAt: string;
  status: "pending" | "reviewed" | "resolved";
  resolution?: string;
}

interface FeedbackRecord {
  id: string;
  summaryId: string;
  type: "helpful" | "not_helpful" | "error";
  timestamp: string;
}

// In-memory store
const errorReports: Map<string, ErrorReport> = new Map();
const feedbackRecords: FeedbackRecord[] = [];

router.post("/report-error", (req: Request, res: Response) => {
  try {
    const { patientId, summaryType, description, generatedAt, citations } = req.body;
    
    if (!description) {
      return res.status(400).json({ success: false, error: "Description is required" });
    }
    
    const report: ErrorReport = {
      id: uuidv4(),
      patientId,
      summaryType,
      description,
      generatedAt,
      citations: citations || [],
      reportedAt: new Date().toISOString(),
      status: "pending",
    };
    
    errorReports.set(report.id, report);
    
    console.log(`[AIFeedback] Error report submitted: ${report.id}`);
    console.log(`[AIFeedback] Summary type: ${summaryType}, Description: ${description.substring(0, 100)}...`);
    
    res.json({ 
      success: true, 
      message: "Error report submitted for review",
      reportId: report.id,
    });
  } catch (error: any) {
    console.error("[AIFeedback] Error submitting report:", error);
    res.status(500).json({ success: false, error: "Failed to submit error report" });
  }
});

router.post("/feedback", (req: Request, res: Response) => {
  try {
    const { summaryId, type } = req.body;
    
    if (!summaryId || !type) {
      return res.status(400).json({ success: false, error: "summaryId and type are required" });
    }
    
    const feedback: FeedbackRecord = {
      id: uuidv4(),
      summaryId,
      type,
      timestamp: new Date().toISOString(),
    };
    
    feedbackRecords.push(feedback);
    
    console.log(`[AIFeedback] Feedback recorded: ${type} for summary ${summaryId}`);
    
    res.json({ success: true, message: "Feedback recorded" });
  } catch (error: any) {
    console.error("[AIFeedback] Error recording feedback:", error);
    res.status(500).json({ success: false, error: "Failed to record feedback" });
  }
});

router.get("/reports", (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    
    let reports = Array.from(errorReports.values());
    
    if (status) {
      reports = reports.filter(r => r.status === status);
    }
    
    res.json({ 
      success: true, 
      reports,
      stats: {
        total: errorReports.size,
        pending: reports.filter(r => r.status === "pending").length,
        reviewed: reports.filter(r => r.status === "reviewed").length,
        resolved: reports.filter(r => r.status === "resolved").length,
      },
    });
  } catch (error: any) {
    console.error("[AIFeedback] Error fetching reports:", error);
    res.status(500).json({ success: false, error: "Failed to fetch reports" });
  }
});

router.get("/stats", (req: Request, res: Response) => {
  try {
    const helpful = feedbackRecords.filter(f => f.type === "helpful").length;
    const notHelpful = feedbackRecords.filter(f => f.type === "not_helpful").length;
    const errors = feedbackRecords.filter(f => f.type === "error").length;
    
    res.json({
      success: true,
      stats: {
        totalFeedback: feedbackRecords.length,
        helpful,
        notHelpful,
        errors,
        helpfulRate: feedbackRecords.length > 0 
          ? (helpful / (helpful + notHelpful) * 100).toFixed(1) 
          : 0,
        errorReports: errorReports.size,
        pendingReports: Array.from(errorReports.values()).filter(r => r.status === "pending").length,
      },
    });
  } catch (error: any) {
    console.error("[AIFeedback] Error fetching stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

export default router;
