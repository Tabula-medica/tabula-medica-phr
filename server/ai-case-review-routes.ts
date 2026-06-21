import { Router, Request, Response } from "express";
import { aiCaseReviewService, type AnonymizedCaseData } from "./services/ai-case-review-service";
import { isAuthenticated } from "./replit_integrations/auth";

const router = Router();

router.get("/dashboard", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const metrics = aiCaseReviewService.getDashboardMetrics();
    const recentCases = aiCaseReviewService.getAllCaseReviews()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    res.json({
      success: true,
      metrics,
      recentCases: recentCases.map(c => ({
        id: c.id,
        providerName: c.providerName,
        providerSpecialty: c.providerSpecialty,
        chiefComplaint: c.anonymizedData.chiefComplaint,
        ageRange: c.anonymizedData.ageRange,
        gender: c.anonymizedData.gender,
        status: c.status,
        urgencyAssessment: c.urgencyAssessment,
        diagnosesCount: c.potentialDiagnoses.length,
        treatmentOptionsCount: c.treatmentOptions.length,
        clinicalTrialsCount: c.clinicalTrials.length,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      noCdsDisclaimer: "This dashboard is for educational and coordination purposes only. Not clinical decision support.",
    });
  } catch (error) {
    console.error("[AICaseReview] Dashboard error:", error);
    res.status(500).json({ success: false, error: "Failed to load dashboard" });
  }
});

router.get("/cases", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const providerId = req.query.providerId as string;
    const status = req.query.status as string;

    let cases = providerId
      ? aiCaseReviewService.getCaseReviewsByProvider(providerId)
      : aiCaseReviewService.getAllCaseReviews();

    if (status) {
      cases = cases.filter(c => c.status === status);
    }

    res.json({
      success: true,
      cases: cases.map(c => ({
        id: c.id,
        providerName: c.providerName,
        providerSpecialty: c.providerSpecialty,
        chiefComplaint: c.anonymizedData.chiefComplaint,
        ageRange: c.anonymizedData.ageRange,
        gender: c.anonymizedData.gender,
        status: c.status,
        urgencyAssessment: c.urgencyAssessment,
        diagnosesCount: c.potentialDiagnoses.length,
        treatmentOptionsCount: c.treatmentOptions.length,
        clinicalTrialsCount: c.clinicalTrials.length,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      total: cases.length,
    });
  } catch (error) {
    console.error("[AICaseReview] List cases error:", error);
    res.status(500).json({ success: false, error: "Failed to list cases" });
  }
});

router.get("/cases/:caseId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const caseReview = aiCaseReviewService.getCaseReview(caseId);

    if (!caseReview) {
      return res.status(404).json({ success: false, error: "Case not found" });
    }

    res.json({
      success: true,
      case: caseReview,
    });
  } catch (error) {
    console.error("[AICaseReview] Get case error:", error);
    res.status(500).json({ success: false, error: "Failed to get case" });
  }
});

router.post("/cases", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user?.claims?.sub || "unknown";
    const userName = `${user?.claims?.first_name || ""} ${user?.claims?.last_name || ""}`.trim() || "Unknown Provider";
    const { providerSpecialty, anonymizedData } = req.body;

    if (!anonymizedData || !anonymizedData.chiefComplaint) {
      return res.status(400).json({
        success: false,
        error: "Anonymized case data with chief complaint is required",
      });
    }

    const requiredFields: (keyof AnonymizedCaseData)[] = [
      "ageRange",
      "gender",
      "chiefComplaint",
      "presentIllnessHistory",
      "medicalHistory",
      "currentMedications",
      "allergies",
    ];

    for (const field of requiredFields) {
      if (!anonymizedData[field]) {
        return res.status(400).json({
          success: false,
          error: `Missing required field: ${field}`,
        });
      }
    }

    const caseReview = await aiCaseReviewService.createCaseReview(
      userId,
      userName,
      providerSpecialty || "General Practice",
      anonymizedData
    );

    res.status(201).json({
      success: true,
      case: caseReview,
      message: "Case created successfully. Call /analyze to start AI analysis.",
    });
  } catch (error) {
    console.error("[AICaseReview] Create case error:", error);
    res.status(500).json({ success: false, error: "Failed to create case" });
  }
});

router.post("/cases/:caseId/analyze", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;

    const existingCase = aiCaseReviewService.getCaseReview(caseId);
    if (!existingCase) {
      return res.status(404).json({ success: false, error: "Case not found" });
    }

    const analyzedCase = await aiCaseReviewService.analyzeCaseWithAI(caseId);

    res.json({
      success: true,
      case: analyzedCase,
      message: "AI analysis completed",
    });
  } catch (error) {
    console.error("[AICaseReview] Analyze case error:", error);
    res.status(500).json({ success: false, error: "Failed to analyze case" });
  }
});

router.get("/cases/:caseId/diagnoses", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const caseReview = aiCaseReviewService.getCaseReview(caseId);

    if (!caseReview) {
      return res.status(404).json({ success: false, error: "Case not found" });
    }

    res.json({
      success: true,
      diagnoses: caseReview.potentialDiagnoses,
      noCdsDisclaimer: caseReview.noCdsDisclaimer,
    });
  } catch (error) {
    console.error("[AICaseReview] Get diagnoses error:", error);
    res.status(500).json({ success: false, error: "Failed to get diagnoses" });
  }
});

router.get("/cases/:caseId/treatments", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const caseReview = aiCaseReviewService.getCaseReview(caseId);

    if (!caseReview) {
      return res.status(404).json({ success: false, error: "Case not found" });
    }

    res.json({
      success: true,
      treatments: caseReview.treatmentOptions,
      noCdsDisclaimer: caseReview.noCdsDisclaimer,
    });
  } catch (error) {
    console.error("[AICaseReview] Get treatments error:", error);
    res.status(500).json({ success: false, error: "Failed to get treatments" });
  }
});

router.get("/cases/:caseId/clinical-trials", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const caseReview = aiCaseReviewService.getCaseReview(caseId);

    if (!caseReview) {
      return res.status(404).json({ success: false, error: "Case not found" });
    }

    res.json({
      success: true,
      clinicalTrials: caseReview.clinicalTrials,
      searchCriteria: caseReview.potentialDiagnoses.map(d => d.condition),
      noCdsDisclaimer: "Clinical trial information is for research purposes only. Eligibility must be verified directly with trial sponsors.",
    });
  } catch (error) {
    console.error("[AICaseReview] Get clinical trials error:", error);
    res.status(500).json({ success: false, error: "Failed to get clinical trials" });
  }
});

router.get("/cases/:caseId/messages", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const messages = aiCaseReviewService.getDiscussionMessages(caseId);

    res.json({
      success: true,
      messages,
      total: messages.length,
    });
  } catch (error) {
    console.error("[AICaseReview] Get messages error:", error);
    res.status(500).json({ success: false, error: "Failed to get messages" });
  }
});

router.post("/cases/:caseId/messages", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const user = (req as any).user;
    const userId = user?.claims?.sub || "unknown";
    const userName = `${user?.claims?.first_name || ""} ${user?.claims?.last_name || ""}`.trim() || "Unknown Provider";
    const { content, messageType, senderRole, mentions } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, error: "Message content is required" });
    }

    const message = await aiCaseReviewService.addMessageToDiscussion(
      caseId,
      userId,
      userName,
      senderRole || "Provider",
      content,
      messageType || "text",
      mentions || []
    );

    res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("[AICaseReview] Send message error:", error);
    res.status(500).json({ success: false, error: "Failed to send message" });
  }
});

router.post("/cases/:caseId/summarize-discussion", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;

    const summary = await aiCaseReviewService.generateDiscussionSummary(caseId);

    res.json({
      success: true,
      ...summary,
      noCdsDisclaimer: "This summary is for care coordination purposes only. Not clinical decision support.",
    });
  } catch (error) {
    console.error("[AICaseReview] Summarize discussion error:", error);
    res.status(500).json({ success: false, error: "Failed to summarize discussion" });
  }
});

router.post("/cases/:caseId/summarize", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;

    const summary = await aiCaseReviewService.generateDiscussionSummary(caseId);

    res.json({
      success: true,
      summary,
      noCdsDisclaimer: "This summary is for care coordination purposes only. Not clinical decision support.",
    });
  } catch (error) {
    console.error("[AICaseReview] Summarize discussion error:", error);
    res.status(500).json({ success: false, error: "Failed to summarize discussion" });
  }
});

router.get("/cases/:caseId/threads", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const threads = aiCaseReviewService.getThreadsByCaseId(caseId);

    res.json({
      success: true,
      threads: threads.map(t => ({
        id: t.id,
        title: t.title,
        participantCount: t.participants.length,
        messageCount: t.messages.length,
        status: t.status,
        hasAISummary: !!t.aiSummary,
        actionItemsCount: t.actionItems?.length || 0,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (error) {
    console.error("[AICaseReview] Get threads error:", error);
    res.status(500).json({ success: false, error: "Failed to get threads" });
  }
});

router.get("/threads/:threadId", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const thread = aiCaseReviewService.getDiscussionThread(threadId);

    if (!thread) {
      return res.status(404).json({ success: false, error: "Thread not found" });
    }

    res.json({
      success: true,
      thread,
    });
  } catch (error) {
    console.error("[AICaseReview] Get thread error:", error);
    res.status(500).json({ success: false, error: "Failed to get thread" });
  }
});

console.log("[AICaseReviewRoutes] Routes registered at /api/case-review/*");
console.log("[AICaseReviewRoutes] Endpoints: /dashboard, /cases, /cases/:id/analyze, /cases/:id/messages, /cases/:id/summarize-discussion");

export default router;
