import type { Express, Request, Response } from "express";
import { aiGuidedRecallService } from "./services/ai-guided-recall-service";
import { healthcareDataAggregatorService } from "./services/healthcare-data-aggregator-service";
import { googleCloudSecurityService } from "./services/google-cloud-security-service";

export function registerAIGuidedRecallRoutes(app: Express): void {
  app.get("/api/guided-recall/questions", (req: Request, res: Response) => {
    try {
      const questions = aiGuidedRecallService.getOnboardingQuestions();
      res.json({ questions });
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ error: "Failed to fetch onboarding questions" });
    }
  });

  app.post("/api/guided-recall/sessions", async (req: Request, res: Response) => {
    try {
      const { patientId } = req.body;
      const authenticatedPatientId = patientId || "patient_001";

      const session = await aiGuidedRecallService.startOnboardingSession(authenticatedPatientId);

      console.log(`[HIPAA-AUDIT][GuidedRecall] SESSION_CREATED`, {
        timestamp: new Date().toISOString(),
        sessionId: session.sessionId,
        patientId: authenticatedPatientId,
        action: "START_ONBOARDING",
      });

      res.json({ session });
    } catch (error) {
      console.error("Error starting session:", error);
      res.status(500).json({ error: "Failed to start onboarding session" });
    }
  });

  app.get("/api/guided-recall/sessions/:sessionId", (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = aiGuidedRecallService.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      res.json({ session });
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  app.post("/api/guided-recall/sessions/:sessionId/responses", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { questionId, response } = req.body;

      if (!questionId || response === undefined) {
        return res.status(400).json({ error: "Question ID and response are required" });
      }

      const result = await aiGuidedRecallService.submitResponse(sessionId, questionId, response);

      if (!result.success) {
        return res.status(404).json({ error: "Session not found or invalid" });
      }

      console.log(`[HIPAA-AUDIT][GuidedRecall] RESPONSE_SUBMITTED`, {
        timestamp: new Date().toISOString(),
        sessionId,
        questionId,
        action: "SUBMIT_RESPONSE",
      });

      res.json(result);
    } catch (error) {
      console.error("Error submitting response:", error);
      res.status(500).json({ error: "Failed to submit response" });
    }
  });

  app.get("/api/guided-recall/sessions/:sessionId/recommendations", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = aiGuidedRecallService.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.status !== "completed") {
        return res.status(400).json({ error: "Session not yet completed" });
      }

      const summary = await aiGuidedRecallService.getAIRecommendationSummary(sessionId);

      res.json({
        portals: session.recommendedPortals,
        summary,
      });
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ error: "Failed to fetch recommendations" });
    }
  });

  app.get("/api/guided-recall/nearby-hospitals", async (req: Request, res: Response) => {
    try {
      const { zipCode } = req.query as { zipCode?: string };

      if (!zipCode) {
        return res.status(400).json({ error: "ZIP code is required" });
      }

      const hospitals = await aiGuidedRecallService.findNearbyHospitals(zipCode);

      res.json({ hospitals });
    } catch (error) {
      console.error("Error finding hospitals:", error);
      res.status(500).json({ error: "Failed to find nearby hospitals" });
    }
  });

  app.get("/api/healthcare-integrations/vendors", async (req: Request, res: Response) => {
    try {
      const vendors = await healthcareDataAggregatorService.getVendorConfigs();
      res.json({ vendors });
    } catch (error) {
      console.error("Error fetching vendors:", error);
      res.status(500).json({ error: "Failed to fetch vendor configurations" });
    }
  });

  app.get("/api/healthcare-integrations/compliance", async (req: Request, res: Response) => {
    try {
      const { vendorId } = req.query as { vendorId?: string };
      const compliance = await healthcareDataAggregatorService.getBAAComplianceStatus(vendorId);
      res.json({ compliance });
    } catch (error) {
      console.error("Error fetching compliance:", error);
      res.status(500).json({ error: "Failed to fetch compliance status" });
    }
  });

  app.post("/api/healthcare-integrations/test-connection", async (req: Request, res: Response) => {
    try {
      const { vendorId } = req.body;

      if (!vendorId) {
        return res.status(400).json({ error: "Vendor ID is required" });
      }

      const result = await healthcareDataAggregatorService.testVendorConnection(vendorId);

      console.log(`[HIPAA-AUDIT][HealthcareIntegration] CONNECTION_TEST`, {
        timestamp: new Date().toISOString(),
        vendorId,
        success: result.success,
      });

      res.json(result);
    } catch (error) {
      console.error("Error testing connection:", error);
      res.status(500).json({ error: "Failed to test connection" });
    }
  });

  app.get("/api/security/config", (req: Request, res: Response) => {
    try {
      const config = googleCloudSecurityService.getSecurityConfig();
      const gcpFeatures = googleCloudSecurityService.getGCPSecurityFeatures();
      const vantaStatus = googleCloudSecurityService.getVantaComplianceStatus();

      res.json({
        config,
        gcpFeatures,
        vantaStatus,
      });
    } catch (error) {
      console.error("Error fetching security config:", error);
      res.status(500).json({ error: "Failed to fetch security configuration" });
    }
  });

  app.post("/api/security/mfa/initiate", async (req: Request, res: Response) => {
    try {
      const { userId, method } = req.body;

      if (!userId || !method) {
        return res.status(400).json({ error: "User ID and method are required" });
      }

      const challenge = await googleCloudSecurityService.initiateMFA(userId, method);

      console.log(`[HIPAA-AUDIT][Security] MFA_INITIATED`, {
        timestamp: new Date().toISOString(),
        userId,
        method,
        challengeId: challenge.challengeId,
      });

      res.json({ challenge });
    } catch (error) {
      console.error("Error initiating MFA:", error);
      res.status(500).json({ error: "Failed to initiate MFA" });
    }
  });

  app.post("/api/security/mfa/verify", async (req: Request, res: Response) => {
    try {
      const { challengeId, code } = req.body;

      if (!challengeId || !code) {
        return res.status(400).json({ error: "Challenge ID and code are required" });
      }

      const result = await googleCloudSecurityService.verifyMFA(challengeId, code);

      console.log(`[HIPAA-AUDIT][Security] MFA_VERIFICATION`, {
        timestamp: new Date().toISOString(),
        challengeId,
        success: result.success,
      });

      res.json(result);
    } catch (error) {
      console.error("Error verifying MFA:", error);
      res.status(500).json({ error: "Failed to verify MFA" });
    }
  });

  app.post("/api/security/devices/register", async (req: Request, res: Response) => {
    try {
      const { userId, deviceData } = req.body;

      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }

      const device = await googleCloudSecurityService.registerDevice(userId, {
        ...deviceData,
        ipAddress: req.ip || "unknown",
      });

      res.json({ device });
    } catch (error) {
      console.error("Error registering device:", error);
      res.status(500).json({ error: "Failed to register device" });
    }
  });

  app.get("/api/security/anomalies", async (req: Request, res: Response) => {
    try {
      const { userId, includeResolved } = req.query as { userId?: string; includeResolved?: string };
      
      const alerts = await googleCloudSecurityService.getAnomalyAlerts(
        userId,
        includeResolved === "true"
      );

      res.json({ alerts });
    } catch (error) {
      console.error("Error fetching anomalies:", error);
      res.status(500).json({ error: "Failed to fetch anomaly alerts" });
    }
  });

  console.log("[Routes] AI Guided Recall routes registered at /api/guided-recall/*");
  console.log("[Routes] Healthcare Integrations routes registered at /api/healthcare-integrations/*");
  console.log("[Routes] Security routes registered at /api/security/*");
}
