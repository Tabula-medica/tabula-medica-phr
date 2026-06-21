import type { Express, Request, Response } from "express";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface OnboardingSession {
  id: string;
  currentStep: number;
  completedSteps: number[];
  data: Record<string, any>;
  fastenConnected: boolean;
  fastenData: any | null;
  aiPrefillApplied: boolean;
  startedAt: string;
  updatedAt: string;
}

const sessions = new Map<string, OnboardingSession>();

export function registerComprehensiveOnboardingRoutes(app: Express) {
  app.post("/api/comprehensive-onboarding/session", (_req: Request, res: Response) => {
    const id = `onb-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const session: OnboardingSession = {
      id,
      currentStep: 0,
      completedSteps: [],
      data: {},
      fastenConnected: false,
      fastenData: null,
      aiPrefillApplied: false,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sessions.set(id, session);
    res.json({ success: true, session });
  });

  app.get("/api/comprehensive-onboarding/session/:id", (req: Request, res: Response) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      return res.status(404).json({ success: false, error: "Session not found" });
    }
    res.json({ success: true, session });
  });

  app.post("/api/comprehensive-onboarding/save-step", (req: Request, res: Response) => {
    const { sessionId, stepIndex, stepName, stepData } = req.body;
    let session = sessions.get(sessionId);
    if (!session) {
      const id = sessionId || `onb-${Date.now()}`;
      session = {
        id,
        currentStep: stepIndex,
        completedSteps: [],
        data: {},
        fastenConnected: false,
        fastenData: null,
        aiPrefillApplied: false,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      sessions.set(id, session);
    }

    session.data[stepName] = stepData;
    if (!session.completedSteps.includes(stepIndex)) {
      session.completedSteps.push(stepIndex);
    }
    session.currentStep = stepIndex;
    session.updatedAt = new Date().toISOString();
    res.json({ success: true });
  });

  app.post("/api/comprehensive-onboarding/ai-prefill", async (req: Request, res: Response) => {
    const { sessionId, fastenData } = req.body;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a medical data extraction assistant. Given raw health record data from Fasten Health (FHIR format), extract and organize patient information into a structured format. Only extract what is clearly present in the data. Do not invent or assume information.

Return JSON with these sections (omit sections with no data):
{
  "demographics": {
    "firstName": "", "middleName": "", "lastName": "", "dateOfBirth": "",
    "gender": "", "sexAtBirth": "", "phone": "", "email": "",
    "address": { "street": "", "city": "", "state": "", "zipCode": "" },
    "race": [], "ethnicity": "", "preferredLanguage": ""
  },
  "conditions": [{ "name": "", "status": "active|resolved|managed", "diagnosedDate": "", "treatedBy": "" }],
  "medications": [{ "name": "", "dose": "", "frequency": "", "status": "active", "startDate": "", "purpose": "" }],
  "allergies": [{ "allergen": "", "reaction": "", "severity": "mild|moderate|severe" }],
  "surgeries": [{ "procedureName": "", "date": "", "facility": "", "outcome": "" }],
  "vaccinations": [{ "name": "", "date": "", "provider": "" }],
  "familyHistory": [{ "condition": "", "relationship": "" }],
  "socialHistory": { "smokingStatus": "", "alcoholUse": "", "exerciseFrequency": "" },
  "insurance": { "provider": "", "policyNumber": "", "groupNumber": "" },
  "emergencyContacts": [{ "name": "", "relationship": "", "phone": "" }]
}`,
          },
          {
            role: "user",
            content: `Extract patient data from these health records:\n${JSON.stringify(fastenData || {})}`,
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || "{}";
      const extracted = JSON.parse(content);

      const session = sessions.get(sessionId);
      if (session) {
        session.fastenData = extracted;
        session.fastenConnected = true;
        session.aiPrefillApplied = true;
      }

      res.json({ success: true, prefillData: extracted, source: "Fasten Health" });
    } catch (error: any) {
      console.error("AI prefill error:", error);
      res.json({ success: false, error: "Could not process health records", prefillData: null });
    }
  });

  app.post("/api/comprehensive-onboarding/ai-review", async (req: Request, res: Response) => {
    const { allData } = req.body;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a health data review assistant. Review the patient's onboarding data for completeness and provide helpful observations. This is NOT medical advice - only data quality feedback.

Return JSON:
{
  "completenessScore": 0-100,
  "missingFields": ["list of important fields that are empty"],
  "observations": ["helpful observations about their health profile for their awareness"],
  "suggestedActions": ["recommended next steps in the app"],
  "summary": "A 2-3 sentence summary of their health profile"
}`,
          },
          {
            role: "user",
            content: JSON.stringify(allData),
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 800,
      });

      const content = response.choices[0]?.message?.content || "{}";
      const review = JSON.parse(content);
      res.json({ success: true, review });
    } catch (error: any) {
      console.error("AI review error:", error);
      res.json({
        success: true,
        review: {
          completenessScore: 70,
          missingFields: [],
          observations: ["Profile looks good! Consider connecting your health records for a more complete picture."],
          suggestedActions: ["Explore your dashboard", "Connect health records via Fasten Health"],
          summary: "Your health profile has been set up. You can continue adding information at any time.",
        },
      });
    }
  });

  app.post("/api/comprehensive-onboarding/ai-suggest-conditions", async (req: Request, res: Response) => {
    const { description, age, gender } = req.body;

    if (!description?.trim()) {
      return res.json({ success: true, suggestions: [] });
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a medical documentation assistant helping a patient organize their health history. Based on the patient's description, suggest possible conditions they might want to document. These are NOT diagnoses - just suggestions for what they might want to add to their records.

Return JSON:
{
  "suggestions": [
    { "name": "Condition Name", "icdHint": "ICD-10 code if obvious", "reason": "Why this might be relevant based on their description" }
  ]
}

Maximum 5 suggestions. Only suggest conditions clearly implied by the patient's own description.`,
          },
          {
            role: "user",
            content: `Patient description: "${description}"\nAge: ${age || "unknown"}\nGender: ${gender || "unknown"}`,
          },
        ],
        response_format: { type: "json_object" },
        max_completion_tokens: 500,
      });

      const content = response.choices[0]?.message?.content || '{"suggestions":[]}';
      const parsed = JSON.parse(content);
      res.json({ success: true, suggestions: parsed.suggestions || [] });
    } catch (error: any) {
      console.error("AI condition suggestion error:", error);
      res.json({ success: true, suggestions: [] });
    }
  });

  app.post("/api/comprehensive-onboarding/complete", (req: Request, res: Response) => {
    const { sessionId, allData } = req.body;
    const session = sessions.get(sessionId);
    if (session) {
      session.data = allData;
      session.currentStep = 99;
      session.updatedAt = new Date().toISOString();
    }
    res.json({ success: true, message: "Onboarding completed successfully" });
  });
}
