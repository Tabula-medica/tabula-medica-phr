import { Router, Request, Response } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  generateInitialQuestions,
  generateAdaptiveFollowUpQuestions,
  generateHealthSummary,
  generateEducationContent,
  type AdaptiveQuestionSet,
  type OnboardingHealthSummary,
  type OnboardingEducationContent,
} from "./services/ai-adaptive-onboarding-service";
import type {
  HealthAssessmentQuestion,
  HealthAssessmentResponse,
  PatientOnboardingFormData,
} from "@shared/schema";

const router = Router();

interface AdaptiveOnboardingSession {
  id: string;
  userId: string;
  currentStep: "welcome" | "questionnaire" | "summary" | "education" | "complete";
  allQuestions: HealthAssessmentQuestion[];
  allResponses: HealthAssessmentResponse[];
  currentQuestionSet: AdaptiveQuestionSet | null;
  formData: PatientOnboardingFormData;
  healthSummary: OnboardingHealthSummary | null;
  educationContent: OnboardingEducationContent | null;
  questionnaireComplete: boolean;
  round: number;
  createdAt: string;
  updatedAt: string;
}

const sessions = new Map<string, AdaptiveOnboardingSession>();

router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      userId: z.string().min(1),
      formData: z.any().optional(),
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.message });
    }

    const { userId, formData } = validation.data;

    const session: AdaptiveOnboardingSession = {
      id: randomUUID(),
      userId,
      currentStep: "welcome",
      allQuestions: [],
      allResponses: [],
      currentQuestionSet: null,
      formData: formData || {},
      healthSummary: null,
      educationContent: null,
      questionnaireComplete: false,
      round: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    sessions.set(session.id, session);

    res.status(201).json({ success: true, session });
  } catch (error) {
    console.error("Error creating adaptive onboarding session:", error);
    res.status(500).json({ error: "Failed to create onboarding session" });
  }
});

router.get("/sessions/:id", async (req: Request, res: Response) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json({ success: true, session });
  } catch (error) {
    console.error("Error fetching session:", error);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

router.post("/sessions/:id/start-questionnaire", async (req: Request, res: Response) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const questionSet = await generateInitialQuestions();

    session.currentQuestionSet = questionSet;
    session.allQuestions = [...session.allQuestions, ...questionSet.questions];
    session.currentStep = "questionnaire";
    session.round = 1;
    session.updatedAt = new Date().toISOString();

    res.json({ success: true, questionSet, session });
  } catch (error) {
    console.error("Error starting questionnaire:", error);
    res.status(500).json({ error: "Failed to generate initial questions" });
  }
});

router.post("/sessions/:id/submit-answers", async (req: Request, res: Response) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const schema = z.object({
      responses: z.array(
        z.object({
          questionId: z.string(),
          answer: z.union([
            z.string(),
            z.array(z.string()),
            z.number(),
            z.boolean(),
          ]),
          answeredAt: z.string().optional(),
        })
      ),
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.message });
    }

    const { responses } = validation.data;

    const newResponses: HealthAssessmentResponse[] = responses.map((r) => ({
      questionId: r.questionId,
      answer: r.answer,
      answeredAt: r.answeredAt || new Date().toISOString(),
    }));

    session.allResponses = [...session.allResponses, ...newResponses];
    session.round += 1;
    session.updatedAt = new Date().toISOString();

    if (session.round > 3 || session.currentQuestionSet?.isComplete) {
      session.questionnaireComplete = true;
      session.currentStep = "summary";
      res.json({
        success: true,
        questionnaireComplete: true,
        session,
      });
      return;
    }

    const followUp = await generateAdaptiveFollowUpQuestions(
      session.allQuestions,
      session.allResponses,
      session.round,
      session.formData
    );

    session.currentQuestionSet = followUp;
    session.allQuestions = [...session.allQuestions, ...followUp.questions];

    if (followUp.isComplete) {
      session.questionnaireComplete = true;
      session.currentStep = "summary";
    }

    session.updatedAt = new Date().toISOString();

    res.json({
      success: true,
      questionSet: followUp,
      questionnaireComplete: session.questionnaireComplete,
      session,
    });
  } catch (error) {
    console.error("Error submitting answers:", error);
    res.status(500).json({ error: "Failed to process answers" });
  }
});

router.post("/sessions/:id/generate-summary", async (req: Request, res: Response) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (!session.questionnaireComplete) {
      return res.status(400).json({ error: "Questionnaire not yet complete" });
    }

    const summary = await generateHealthSummary(
      session.allQuestions,
      session.allResponses,
      session.formData
    );

    session.healthSummary = summary;
    session.currentStep = "summary";
    session.updatedAt = new Date().toISOString();

    res.json({ success: true, summary, session });
  } catch (error) {
    console.error("Error generating summary:", error);
    res.status(500).json({ error: "Failed to generate health summary" });
  }
});

router.post("/sessions/:id/generate-education", async (req: Request, res: Response) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (!session.healthSummary) {
      return res.status(400).json({ error: "Health summary not yet generated" });
    }

    const education = await generateEducationContent(
      session.healthSummary,
      session.formData
    );

    session.educationContent = education;
    session.currentStep = "education";
    session.updatedAt = new Date().toISOString();

    res.json({ success: true, education, session });
  } catch (error) {
    console.error("Error generating education content:", error);
    res.status(500).json({ error: "Failed to generate education content" });
  }
});

router.post("/sessions/:id/complete", async (req: Request, res: Response) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    session.currentStep = "complete";
    session.updatedAt = new Date().toISOString();

    res.json({ success: true, session });
  } catch (error) {
    console.error("Error completing onboarding:", error);
    res.status(500).json({ error: "Failed to complete onboarding" });
  }
});

router.patch("/sessions/:id/form-data", async (req: Request, res: Response) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    session.formData = { ...session.formData, ...req.body };
    session.updatedAt = new Date().toISOString();

    res.json({ success: true, session });
  } catch (error) {
    console.error("Error updating form data:", error);
    res.status(500).json({ error: "Failed to update form data" });
  }
});

export default router;
