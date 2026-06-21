import type { Express, Request, Response } from "express";
import {
  getProviderStatus,
  setDefaultProvider,
  setFeatureProvider,
  type AIProvider,
} from "./services/ai-provider";

export function registerAIProviderRoutes(app: Express): void {
  app.get("/api/ai-provider/status", async (_req: Request, res: Response) => {
    try {
      const status = getProviderStatus();
      res.json({
        ...status,
        availableProviders: ["openai", "vertex"] as AIProvider[],
        availableFeatures: [
          "patient-summary",
          "patient-chat",
          "soap-documentation",
          "document-generation",
          "workflow-triggers",
          "medical-term-explanation",
        ],
      });
    } catch (error) {
      console.error("AI provider status error:", error);
      res.status(500).json({ error: "Failed to get provider status" });
    }
  });

  app.post("/api/ai-provider/configure", async (req: Request, res: Response) => {
    try {
      const { defaultProvider, featureOverrides } = req.body;

      if (defaultProvider && (defaultProvider === "openai" || defaultProvider === "vertex")) {
        setDefaultProvider(defaultProvider);
      }

      if (featureOverrides && typeof featureOverrides === "object") {
        for (const [feature, provider] of Object.entries(featureOverrides)) {
          if (provider === "openai" || provider === "vertex") {
            setFeatureProvider(feature, provider as AIProvider);
          }
        }
      }

      const status = getProviderStatus();
      res.json({ message: "AI provider configuration updated", ...status });
    } catch (error) {
      console.error("AI provider configure error:", error);
      res.status(500).json({ error: "Failed to configure provider" });
    }
  });

  console.log("[Routes] AI Provider Management routes registered at /api/ai-provider/*");
}
