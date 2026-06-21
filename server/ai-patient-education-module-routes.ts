import { Router, Request, Response } from "express";
import { aiPatientEducationModuleService, EducationTopic, PatientContext } from "./services/ai-patient-education-module-service";
import { healthInsightsService } from "./services/health-insights-service";
import { z } from "zod";

const router = Router();

function logHIPAAAudit(operation: string, details: Record<string, any>, req: Request) {
  console.log(`[HIPAA-AUDIT][PatientEducationModule] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    operation,
    userId: req.headers["x-user-id"] || "anonymous",
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]?.slice(0, 50),
    details,
    noCdsCompliance: "Patient education content only - not clinical decision support."
  })}`);
}

const SearchTopicsSchema = z.object({
  query: z.string().min(1).max(200),
  type: z.enum(["condition", "medication", "procedure"]).optional()
});

router.get("/topics/search", async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const type = req.query.type as "condition" | "medication" | "procedure" | undefined;

    if (!query) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    logHIPAAAudit("SEARCH_TOPICS", { query, type }, req);

    const results = await aiPatientEducationModuleService.searchTopics(query, type);
    res.json({
      results,
      count: results.length,
      noCdsCompliance: "Topic search results for educational purposes only."
    });
  } catch (error) {
    console.error("Error searching topics:", error);
    res.status(500).json({ error: "Failed to search topics" });
  }
});

router.get("/topics/popular", async (req: Request, res: Response) => {
  try {
    logHIPAAAudit("GET_POPULAR_TOPICS", {}, req);

    const topics = aiPatientEducationModuleService.getPopularTopics();
    res.json({
      topics,
      noCdsCompliance: "Popular topics for educational purposes only."
    });
  } catch (error) {
    console.error("Error getting popular topics:", error);
    res.status(500).json({ error: "Failed to get popular topics" });
  }
});

router.get("/topics/:type", async (req: Request, res: Response) => {
  try {
    const type = req.params.type as "condition" | "medication" | "procedure";
    
    if (!["condition", "medication", "procedure"].includes(type)) {
      return res.status(400).json({ error: "Invalid topic type" });
    }

    logHIPAAAudit("GET_TOPICS_BY_TYPE", { type }, req);

    const topics = aiPatientEducationModuleService.getTopicsByType(type);
    res.json({
      topics,
      type,
      noCdsCompliance: "Topic list for educational purposes only."
    });
  } catch (error) {
    console.error("Error getting topics by type:", error);
    res.status(500).json({ error: "Failed to get topics" });
  }
});

const GetExplanationSchema = z.object({
  type: z.enum(["condition", "medication", "procedure"]),
  name: z.string().min(1).max(200),
  code: z.string().optional(),
  codeSystem: z.string().optional(),
  readingLevel: z.enum(["simple", "moderate", "detailed"]).optional()
});

router.post("/explain", async (req: Request, res: Response) => {
  try {
    const validation = GetExplanationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
    }

    const { type, name, code, codeSystem, readingLevel } = validation.data;

    logHIPAAAudit("GET_TOPIC_EXPLANATION", { type, name, readingLevel }, req);

    const topic: EducationTopic = {
      id: `topic-${Date.now()}`,
      type,
      name,
      code,
      codeSystem
    };

    const explanation = await aiPatientEducationModuleService.getTopicExplanation(topic, readingLevel || "moderate");
    
    res.json({
      explanation,
      noCdsCompliance: explanation.disclaimer
    });
  } catch (error) {
    console.error("Error getting topic explanation:", error);
    res.status(500).json({ error: "Failed to get explanation" });
  }
});

const AskQuestionSchema = z.object({
  question: z.string().min(5).max(1000),
  context: z.object({
    conditions: z.array(z.string()).optional(),
    medications: z.array(z.string()).optional(),
    recentProcedures: z.array(z.string()).optional(),
    allergies: z.array(z.string()).optional(),
    age: z.number().optional(),
    healthGoals: z.array(z.string()).optional()
  }).optional()
});

router.post("/ask/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const validation = AskQuestionSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ error: "Invalid request", details: validation.error.errors });
    }

    const { question, context } = validation.data;

    logHIPAAAudit("ASK_QUESTION", { 
      patientId: patientId.slice(0, 8) + "***", 
      questionLength: question.length 
    }, req);

    const answer = await aiPatientEducationModuleService.answerPatientQuestion(patientId, question, context as PatientContext);
    
    res.json({
      answer,
      noCdsCompliance: answer.disclaimer
    });
  } catch (error) {
    console.error("Error answering question:", error);
    res.status(500).json({ error: "Failed to answer question" });
  }
});

router.get("/history/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    logHIPAAAudit("GET_QUESTION_HISTORY", { patientId: patientId.slice(0, 8) + "***" }, req);

    const history = aiPatientEducationModuleService.getQuestionHistory(patientId);
    
    res.json({
      history,
      count: history.length,
      noCdsCompliance: "Question history for educational reference only."
    });
  } catch (error) {
    console.error("Error getting question history:", error);
    res.status(500).json({ error: "Failed to get question history" });
  }
});

router.post("/curate/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const userId = (req.headers["x-user-id"] as string) || "system";

    logHIPAAAudit("CURATE_EDUCATION_PLAN", { patientId: patientId.slice(0, 8) + "***" }, req);

    const [conditions, medications, allergies, labResults, vitalSigns] = await Promise.all([
      healthInsightsService.getConditions(patientId, userId),
      healthInsightsService.getMedications(patientId, userId),
      healthInsightsService.getAllergies(patientId, userId),
      healthInsightsService.getLabResults(patientId, userId, { limit: 20 }),
      healthInsightsService.getVitalSigns(patientId, userId, undefined, 7),
    ]);

    const plan = await aiPatientEducationModuleService.curateEducationPlan(patientId, {
      conditions: conditions.map(c => ({ name: c.name, severity: c.severity, status: c.status })),
      medications: medications.map(m => ({ name: m.name, dosage: m.dosage, frequency: m.frequency, prescribedFor: m.prescribedFor })),
      allergies: allergies.map(a => ({ allergen: a.allergen, severity: a.severity, reaction: a.reaction })),
      labResults: labResults.map(l => ({ testName: l.testName, value: l.value, unit: l.unit, status: l.status, referenceRange: l.referenceRange })),
      vitalSigns: vitalSigns.map(v => ({ type: v.type, value: v.value, unit: v.unit })),
    });

    res.json(plan);
  } catch (error) {
    console.error("Error curating education plan:", error);
    res.status(500).json({ error: "Failed to generate personalized education plan" });
  }
});

export function registerPatientEducationModuleRoutes(app: Router): void {
  app.use("/api/patient-education-module", router);
  console.log("[Routes] AI Patient Education Module routes registered at /api/patient-education-module/*");
}

export default router;
