import type { Express, Request, Response } from "express";
import { aiOnboardingAgentService } from "./services/ai-onboarding-agent-service";

export function registerAIOnboardingAgentRoutes(app: Express): void {
  app.post("/api/ai-onboarding-agent/chat", async (req: Request, res: Response) => {
    try {
      const { message, currentStep, profileData } = req.body;

      if (!message || !currentStep) {
        return res.status(400).json({ error: "message and currentStep are required" });
      }

      const userId = (req as any).user?.id || "anonymous";

      const reply = await aiOnboardingAgentService.chat(userId, message, {
        currentStep,
        profileData,
      });

      res.json({ reply });
    } catch (error) {
      console.error("[AIOnboardingAgent] Chat error:", error);
      res.status(500).json({ error: "Failed to process chat request" });
    }
  });

  app.post("/api/ai-onboarding-agent/autofill-from-fhir", async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || "anonymous";

      const autofillData = await aiOnboardingAgentService.autoFillFromFhir(userId);

      res.json({ success: true, data: autofillData });
    } catch (error) {
      console.error("[AIOnboardingAgent] Autofill error:", error);
      res.status(500).json({ error: "Failed to fetch autofill data from FHIR" });
    }
  });

  app.post("/api/ai-onboarding-agent/check-interactions", async (req: Request, res: Response) => {
    try {
      const { medications, allergies } = req.body;

      if (!Array.isArray(medications) || !Array.isArray(allergies)) {
        return res.status(400).json({ error: "medications and allergies must be arrays" });
      }

      const warnings = await aiOnboardingAgentService.checkMedicationAllergyInteractions(
        medications,
        allergies
      );

      res.json({ success: true, warnings });
    } catch (error) {
      console.error("[AIOnboardingAgent] Interaction check error:", error);
      res.status(500).json({ error: "Failed to check medication-allergy interactions" });
    }
  });

  console.log("[Routes] AI Onboarding Agent routes registered at /api/ai-onboarding-agent/*");
}
