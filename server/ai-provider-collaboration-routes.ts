import { Express, Request, Response } from "express";
import { aiProviderCollaborationService } from "./services/ai-provider-collaboration-service";

export function registerAIProviderCollaborationRoutes(app: Express): void {
  console.log("[Routes] AI Provider Collaboration routes registered at /api/provider-collaboration/*");

  // Get collaboration dashboard
  app.get("/api/provider-collaboration/dashboard", async (req: Request, res: Response) => {
    try {
      const providerId = req.query.providerId as string || "provider-001";
      const dashboard = await aiProviderCollaborationService.getDashboard(providerId);
      res.json(dashboard);
    } catch (error) {
      console.error("[AIProviderCollaboration] Dashboard error:", error);
      res.status(500).json({ error: "Failed to fetch dashboard" });
    }
  });

  // Generate patient case summary for specialist consultation
  app.post("/api/provider-collaboration/case-summary", async (req: Request, res: Response) => {
    try {
      const {
        patientId,
        consultingSpecialty,
        summaryType,
        requestingProviderId,
        additionalContext
      } = req.body;

      if (!patientId || !consultingSpecialty || !summaryType) {
        return res.status(400).json({ error: "Missing required fields: patientId, consultingSpecialty, summaryType" });
      }

      const summary = await aiProviderCollaborationService.generatePatientCaseSummary(
        patientId,
        consultingSpecialty,
        summaryType,
        requestingProviderId || "provider-001",
        additionalContext
      );

      res.json(summary);
    } catch (error) {
      console.error("[AIProviderCollaboration] Case summary error:", error);
      res.status(500).json({ error: "Failed to generate case summary" });
    }
  });

  // Get all case summaries
  app.get("/api/provider-collaboration/case-summaries", async (req: Request, res: Response) => {
    try {
      const summaries = aiProviderCollaborationService.getAllCaseSummaries();
      res.json({ summaries });
    } catch (error) {
      console.error("[AIProviderCollaboration] Get summaries error:", error);
      res.status(500).json({ error: "Failed to fetch case summaries" });
    }
  });

  // Get specific case summary
  app.get("/api/provider-collaboration/case-summary/:summaryId", async (req: Request, res: Response) => {
    try {
      const { summaryId } = req.params;
      const summary = aiProviderCollaborationService.getCaseSummary(summaryId);
      
      if (!summary) {
        return res.status(404).json({ error: "Case summary not found" });
      }
      
      res.json(summary);
    } catch (error) {
      console.error("[AIProviderCollaboration] Get summary error:", error);
      res.status(500).json({ error: "Failed to fetch case summary" });
    }
  });

  // Suggest research papers for complex case
  app.post("/api/provider-collaboration/research-papers", async (req: Request, res: Response) => {
    try {
      const { patientId, caseContext, clinicalKeywords } = req.body;

      if (!patientId || !caseContext) {
        return res.status(400).json({ error: "Missing required fields: patientId, caseContext" });
      }

      const suggestions = await aiProviderCollaborationService.suggestResearchPapers(
        patientId,
        caseContext,
        clinicalKeywords
      );

      res.json(suggestions);
    } catch (error) {
      console.error("[AIProviderCollaboration] Research papers error:", error);
      res.status(500).json({ error: "Failed to suggest research papers" });
    }
  });

  // Get specific research suggestion
  app.get("/api/provider-collaboration/research-papers/:suggestionId", async (req: Request, res: Response) => {
    try {
      const { suggestionId } = req.params;
      const suggestion = aiProviderCollaborationService.getResearchSuggestion(suggestionId);
      
      if (!suggestion) {
        return res.status(404).json({ error: "Research suggestion not found" });
      }
      
      res.json(suggestion);
    } catch (error) {
      console.error("[AIProviderCollaboration] Get research error:", error);
      res.status(500).json({ error: "Failed to fetch research suggestion" });
    }
  });

  // Draft inter-provider communication
  app.post("/api/provider-collaboration/communication", async (req: Request, res: Response) => {
    try {
      const {
        patientId,
        fromProviderId,
        fromProviderName,
        toProviderId,
        toProviderName,
        toProviderSpecialty,
        communicationType,
        specificRequest
      } = req.body;

      if (!patientId || !toProviderName || !toProviderSpecialty || !communicationType) {
        return res.status(400).json({ 
          error: "Missing required fields: patientId, toProviderName, toProviderSpecialty, communicationType" 
        });
      }

      const communication = await aiProviderCollaborationService.draftInterProviderCommunication(
        patientId,
        fromProviderId || "provider-001",
        fromProviderName || "Current Provider",
        toProviderId || "provider-002",
        toProviderName,
        toProviderSpecialty,
        communicationType,
        specificRequest
      );

      res.json(communication);
    } catch (error) {
      console.error("[AIProviderCollaboration] Communication draft error:", error);
      res.status(500).json({ error: "Failed to draft communication" });
    }
  });

  // Get all communications
  app.get("/api/provider-collaboration/communications", async (req: Request, res: Response) => {
    try {
      const communications = aiProviderCollaborationService.getAllCommunications();
      res.json({ communications });
    } catch (error) {
      console.error("[AIProviderCollaboration] Get communications error:", error);
      res.status(500).json({ error: "Failed to fetch communications" });
    }
  });

  // Get specific communication
  app.get("/api/provider-collaboration/communication/:communicationId", async (req: Request, res: Response) => {
    try {
      const { communicationId } = req.params;
      const communication = aiProviderCollaborationService.getCommunication(communicationId);
      
      if (!communication) {
        return res.status(404).json({ error: "Communication not found" });
      }
      
      res.json(communication);
    } catch (error) {
      console.error("[AIProviderCollaboration] Get communication error:", error);
      res.status(500).json({ error: "Failed to fetch communication" });
    }
  });

  // Update communication section
  app.patch("/api/provider-collaboration/communication/:communicationId", async (req: Request, res: Response) => {
    try {
      const { communicationId } = req.params;
      const { section, newValue } = req.body;

      if (!section || newValue === undefined) {
        return res.status(400).json({ error: "Missing required fields: section, newValue" });
      }

      const communication = await aiProviderCollaborationService.updateCommunication(
        communicationId,
        section,
        newValue
      );

      if (!communication) {
        return res.status(404).json({ error: "Communication not found" });
      }

      res.json(communication);
    } catch (error) {
      console.error("[AIProviderCollaboration] Update communication error:", error);
      res.status(500).json({ error: "Failed to update communication" });
    }
  });

  // Mark communication as reviewed
  app.post("/api/provider-collaboration/communication/:communicationId/review", async (req: Request, res: Response) => {
    try {
      const { communicationId } = req.params;
      const communication = await aiProviderCollaborationService.markCommunicationReviewed(communicationId);

      if (!communication) {
        return res.status(404).json({ error: "Communication not found" });
      }

      res.json(communication);
    } catch (error) {
      console.error("[AIProviderCollaboration] Review communication error:", error);
      res.status(500).json({ error: "Failed to review communication" });
    }
  });

  // Send communication
  app.post("/api/provider-collaboration/communication/:communicationId/send", async (req: Request, res: Response) => {
    try {
      const { communicationId } = req.params;
      const communication = await aiProviderCollaborationService.sendCommunication(communicationId);

      if (!communication) {
        return res.status(404).json({ error: "Communication not found" });
      }

      res.json(communication);
    } catch (error) {
      console.error("[AIProviderCollaboration] Send communication error:", error);
      res.status(500).json({ error: "Failed to send communication" });
    }
  });
}
