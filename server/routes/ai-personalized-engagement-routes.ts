import { Express, Request, Response, Router } from "express";
import { aiPersonalizedEngagementService } from "../services/ai-personalized-engagement";

const router = Router();

router.get("/metadata", async (_req: Request, res: Response) => {
  res.json({
    service: "AI Personalized Engagement",
    version: "1.0.0",
    features: [
      "personalized-content-recommendations",
      "interactive-quiz-generation",
      "quiz-assessment",
      "smart-nudge-generation",
      "learning-progress-analysis",
    ],
    disclaimer: "AI-generated recommendations are for educational support and do not replace medical advice.",
  });
});

router.post("/recommend-content", async (req: Request, res: Response) => {
  try {
    const { patientProfile, pathwayContext, behaviorPattern, existingContent } = req.body;

    if (!patientProfile || !pathwayContext) {
      return res.status(400).json({ error: "Patient profile and pathway context are required" });
    }

    const recommendations = await aiPersonalizedEngagementService.recommendContent(
      patientProfile,
      pathwayContext,
      behaviorPattern || {
        taskCompletionRate: 70,
        averageEngagementTime: 15,
        preferredTimeOfDay: "morning",
        missedTaskPatterns: [],
        successPatterns: [],
        lastActiveDate: new Date().toISOString(),
        streakDays: 0,
        responseToNudgeTypes: [],
      },
      existingContent || []
    );

    res.json({
      recommendations,
      generatedAt: new Date().toISOString(),
      disclaimer: "Content recommendations are personalized based on your care pathway and learning preferences.",
    });
  } catch (error) {
    console.error("Content recommendation error:", error);
    res.status(500).json({ error: "Failed to generate content recommendations" });
  }
});

router.post("/generate-quiz", async (req: Request, res: Response) => {
  try {
    const { contentId, contentTitle, contentSummary, patientProfile, questionCount } = req.body;

    if (!contentId || !contentTitle || !patientProfile) {
      return res.status(400).json({ error: "Content ID, title, and patient profile are required" });
    }

    const quiz = await aiPersonalizedEngagementService.generateQuiz(
      contentId,
      contentTitle,
      contentSummary || "",
      patientProfile,
      questionCount || 5
    );

    res.json({
      quiz,
      generatedAt: new Date().toISOString(),
      disclaimer: "Quiz questions are generated to assess understanding. Results are for educational purposes only.",
    });
  } catch (error) {
    console.error("Quiz generation error:", error);
    res.status(500).json({ error: "Failed to generate quiz" });
  }
});

router.post("/evaluate-quiz", async (req: Request, res: Response) => {
  try {
    const { quiz, answers, patientProfile } = req.body;

    if (!quiz || !answers || !patientProfile) {
      return res.status(400).json({ error: "Quiz, answers, and patient profile are required" });
    }

    const result = await aiPersonalizedEngagementService.evaluateQuizResults(
      quiz,
      answers,
      patientProfile
    );

    res.json({
      result,
      disclaimer: "Quiz results provide educational feedback and should not be used for clinical decisions.",
    });
  } catch (error) {
    console.error("Quiz evaluation error:", error);
    res.status(500).json({ error: "Failed to evaluate quiz" });
  }
});

router.post("/generate-nudges", async (req: Request, res: Response) => {
  try {
    const { patientProfile, pathwayContext, behaviorPattern, pendingTasks, recentNudges } = req.body;

    if (!patientProfile || !pathwayContext) {
      return res.status(400).json({ error: "Patient profile and pathway context are required" });
    }

    const nudges = await aiPersonalizedEngagementService.generatePersonalizedNudges(
      patientProfile,
      pathwayContext,
      behaviorPattern || {
        taskCompletionRate: 70,
        averageEngagementTime: 15,
        preferredTimeOfDay: "morning",
        missedTaskPatterns: [],
        successPatterns: [],
        lastActiveDate: new Date().toISOString(),
        streakDays: 0,
        responseToNudgeTypes: [],
      },
      pendingTasks || [],
      recentNudges || []
    );

    res.json({
      nudges,
      generatedAt: new Date().toISOString(),
      disclaimer: "Nudges are personalized based on your behavior patterns and goals.",
    });
  } catch (error) {
    console.error("Nudge generation error:", error);
    res.status(500).json({ error: "Failed to generate nudges" });
  }
});

router.post("/analyze-progress", async (req: Request, res: Response) => {
  try {
    const { patientId, completedContent, quizResults, pathwayContext } = req.body;

    if (!patientId || !pathwayContext) {
      return res.status(400).json({ error: "Patient ID and pathway context are required" });
    }

    const analysis = await aiPersonalizedEngagementService.analyzeLearningProgress(
      patientId,
      completedContent || [],
      quizResults || [],
      pathwayContext
    );

    res.json({
      analysis,
      generatedAt: new Date().toISOString(),
      disclaimer: "Learning progress analysis is based on your educational engagement and quiz performance.",
    });
  } catch (error) {
    console.error("Progress analysis error:", error);
    res.status(500).json({ error: "Failed to analyze learning progress" });
  }
});

export function registerAIPersonalizedEngagementRoutes(app: Express) {
  app.use("/api/ai-personalized-engagement", router);
}
