import { Router, type Request, type Response } from "express";
import * as onboardingService from "../services/ai-onboarding-service";

const router = Router();

const PLATFORM_FEATURES = [
  {
    id: "health-records",
    title: "Unified Health Records",
    description: "View all your medical records from different healthcare providers in one place. Lab results, visit notes, and imaging reports are organized and easy to understand.",
    icon: "file-text",
    category: "core",
    learnMoreRoute: "/patient-portal",
  },
  {
    id: "ai-explanations",
    title: "AI Medical Explanations",
    description: "Don't understand a medical term or lab result? Our AI assistant explains complex health information in simple language you can understand.",
    icon: "brain",
    category: "ai",
    learnMoreRoute: "/ai-assistant",
  },
  {
    id: "lab-results",
    title: "Lab Results Tracking",
    description: "Track your lab results over time with easy-to-read charts. Critical results are flagged so you know what needs attention.",
    icon: "activity",
    category: "core",
    learnMoreRoute: "/patient-portal",
  },
  {
    id: "vitals-monitoring",
    title: "Vitals Monitoring",
    description: "Monitor your blood pressure, heart rate, weight, and other vital signs. See trends and share them with your healthcare team.",
    icon: "heart",
    category: "core",
    learnMoreRoute: "/patient-portal",
  },
  {
    id: "secure-messaging",
    title: "Secure Messaging",
    description: "Send secure messages to your care team. Get answers to health questions without needing an in-person visit.",
    icon: "message-square",
    category: "communication",
    learnMoreRoute: "/patient-engagement",
  },
  {
    id: "medication-management",
    title: "Medication Management",
    description: "Keep track of all your medications, dosages, and schedules. Get reminders and check for potential interactions.",
    icon: "pill",
    category: "core",
    learnMoreRoute: "/patient-portal",
  },
  {
    id: "health-sharing",
    title: "Share Health Records",
    description: "Securely share your health records with new doctors, family members, or specialists using Smart Health Links.",
    icon: "share-2",
    category: "sharing",
    learnMoreRoute: "/smart-health-links",
  },
  {
    id: "voice-access",
    title: "Multilingual Voice Access",
    description: "Speak to Tabula Medica in your preferred language. Our AI understands and responds in over 15 languages.",
    icon: "mic",
    category: "ai",
    learnMoreRoute: "/ai-assistant",
  },
];

const INTAKE_STEPS = [
  { id: "demographics", label: "Basic Information", description: "Name, date of birth, contact details, and emergency contacts", icon: "user" },
  { id: "conditions", label: "Medical Conditions", description: "Current and past medical conditions and diagnoses", icon: "heart" },
  { id: "medications", label: "Medications", description: "Current medications, dosages, and prescribers", icon: "pill" },
  { id: "allergies", label: "Allergies", description: "Drug allergies, food allergies, and environmental sensitivities", icon: "alert-triangle" },
  { id: "surgeries", label: "Surgical History", description: "Past surgeries and medical procedures", icon: "stethoscope" },
  { id: "family_history", label: "Family History", description: "Health conditions that run in your family", icon: "users" },
  { id: "social_history", label: "Social & Lifestyle", description: "Lifestyle factors like exercise, diet, and habits", icon: "coffee" },
  { id: "review_of_systems", label: "Symptom Review", description: "A guided review of symptoms across body systems", icon: "clipboard-list" },
];

router.get("/features", (_req: Request, res: Response) => {
  res.json({
    features: PLATFORM_FEATURES,
    total: PLATFORM_FEATURES.length,
  });
});

router.get("/intake-steps", (_req: Request, res: Response) => {
  res.json({
    steps: INTAKE_STEPS,
    total: INTAKE_STEPS.length,
  });
});

router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const { patientId, language, languageName } = req.body;
    if (!patientId || !language) {
      return res.status(400).json({ error: "patientId and language are required" });
    }

    const session = onboardingService.createSession(
      patientId,
      language,
      languageName || "English"
    );

    res.json({
      session: {
        id: session.id,
        messages: session.messages,
        currentStep: session.currentStep,
        language: session.language,
        languageName: session.languageName,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/sessions/:sessionId/progress", (req: Request, res: Response) => {
  try {
    const progress = onboardingService.getSessionProgress(req.params.sessionId);
    if (!progress) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json({ progress });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/sessions/:sessionId/messages", async (req: Request, res: Response) => {
  try {
    const { message, advanceStep } = req.body;
    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    const result = await onboardingService.processMessage(
      req.params.sessionId,
      message,
      advanceStep || false
    );

    const progress = onboardingService.getSessionProgress(req.params.sessionId);

    res.json({
      message: result.message,
      currentStep: result.session.currentStep,
      completedSteps: result.session.completedSteps,
      progress,
    });
  } catch (error: any) {
    if (error.message === "Session not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post("/sessions/:sessionId/advance", (req: Request, res: Response) => {
  try {
    const session = onboardingService.advanceSessionStep(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    const progress = onboardingService.getSessionProgress(req.params.sessionId);
    res.json({
      currentStep: session.currentStep,
      completedSteps: session.completedSteps,
      progress,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/sessions/:sessionId/complete", (req: Request, res: Response) => {
  try {
    const session = onboardingService.completeSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json({
      status: "completed",
      summary: onboardingService.getSessionSummary(req.params.sessionId),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/sessions/:sessionId/summary", (req: Request, res: Response) => {
  try {
    const summary = onboardingService.getSessionSummary(req.params.sessionId);
    if (!summary) {
      return res.status(404).json({ error: "Session not found" });
    }
    res.json({ summary });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/sessions/:sessionId/context", (req: Request, res: Response) => {
  try {
    const progress = onboardingService.getSessionProgress(req.params.sessionId);
    if (!progress) {
      return res.status(404).json({ error: "Session not found" });
    }
    const step = progress.currentStep as any;
    const quickReplies = onboardingService.getQuickReplies(step);
    const tips = onboardingService.getContextualTips(step);
    const remainingMinutes = onboardingService.getRemainingTime(req.params.sessionId);

    res.json({
      quickReplies,
      tips,
      remainingMinutes,
      currentStep: progress.currentStep,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/sessions/:sessionId/section", (req: Request, res: Response) => {
  try {
    const { section, data } = req.body;
    if (!section || !data) {
      return res.status(400).json({ error: "section and data are required" });
    }
    const result = onboardingService.updateSessionSection(req.params.sessionId, section, data);
    if (!result.success) {
      return res.status(result.message === "Session not found" ? 404 : 400).json({ error: result.message });
    }
    const progress = onboardingService.getSessionProgress(req.params.sessionId);
    res.json({ ...result, progress });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/sample-patients", (_req: Request, res: Response) => {
  const patients = onboardingService.getSamplePatients();
  res.json({ patients, total: patients.length });
});

router.post("/sessions/with-patient", async (req: Request, res: Response) => {
  try {
    const { patientId, language, languageName } = req.body;
    if (!patientId || !language) {
      return res.status(400).json({ error: "patientId and language are required" });
    }
    const session = onboardingService.createSessionWithPatientData(
      patientId,
      language,
      languageName || "English"
    );
    res.json({
      session: {
        id: session.id,
        messages: session.messages,
        currentStep: session.currentStep,
        language: session.language,
        languageName: session.languageName,
        hasPrepopulatedData: true,
      },
    });
  } catch (error: any) {
    const msg = error.message || "Failed to create session";
    if (msg.includes("not found") || msg.includes("Unknown patient")) {
      return res.status(404).json({ error: `Patient not found: ${patientId}` });
    }
    res.status(500).json({ error: msg });
  }
});

router.get("/time-estimates", (_req: Request, res: Response) => {
  const estimates = onboardingService.getTimeEstimates();
  res.json(estimates);
});

export default router;
