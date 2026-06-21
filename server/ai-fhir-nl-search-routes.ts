import { Express, Request, Response } from "express";
import { z } from "zod";
import {
  searchWithNaturalLanguage,
  getSearchHistory,
  saveQuery,
  getSavedQueries,
  deleteSavedQuery,
  getSuggestedQueries,
  getSearchMetadata
} from "./services/ai-fhir-nl-search-service";
import { randomUUID } from "crypto";

const nlSearchSchema = z.object({
  query: z.string().min(3, "Query must be at least 3 characters").max(500, "Query too long"),
});

const saveQuerySchema = z.object({
  name: z.string().min(1, "Name required").max(100, "Name too long"),
  query: z.string().min(3, "Query must be at least 3 characters"),
});

export function registerAIFHIRNLSearchRoutes(app: Express): void {
  app.get("/api/fhir-nl-search/metadata", async (_req: Request, res: Response) => {
    try {
      const metadata = getSearchMetadata();
      res.json(metadata);
    } catch (error) {
      console.error("[AIFHIRNLSearch] Metadata error:", error);
      res.status(500).json({ error: "Failed to get metadata" });
    }
  });

  app.post("/api/fhir-nl-search", async (req: Request, res: Response) => {
    try {
      const validation = nlSearchSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Invalid query",
          details: validation.error.errors,
        });
        return;
      }

      const { query } = validation.data;
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub || "anonymous";

      console.log(`[AIFHIRNLSearch] Processing query: "${query}" for user: ${userId}`);
      const response = await searchWithNaturalLanguage(query, userId);
      
      console.log(`[AIFHIRNLSearch] Found ${response.total} results in ${response.executionTimeMs}ms`);
      res.json(response);
    } catch (error) {
      console.error("[AIFHIRNLSearch] Search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.get("/api/fhir-nl-search/suggestions", async (_req: Request, res: Response) => {
    try {
      const suggestions = getSuggestedQueries();
      res.json({ suggestions });
    } catch (error) {
      console.error("[AIFHIRNLSearch] Suggestions error:", error);
      res.status(500).json({ error: "Failed to get suggestions" });
    }
  });

  app.get("/api/fhir-nl-search/history", async (req: Request, res: Response) => {
    try {
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const history = getSearchHistory(userId, limit);
      res.json({ history });
    } catch (error) {
      console.error("[AIFHIRNLSearch] History error:", error);
      res.status(500).json({ error: "Failed to get history" });
    }
  });

  app.post("/api/fhir-nl-search/saved", async (req: Request, res: Response) => {
    try {
      const validation = saveQuerySchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Invalid saved query",
          details: validation.error.errors,
        });
        return;
      }

      const { name, query } = validation.data;
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub || "anonymous";
      const id = randomUUID();

      const saved = saveQuery(id, name, query, userId);
      res.status(201).json(saved);
    } catch (error) {
      console.error("[AIFHIRNLSearch] Save query error:", error);
      res.status(500).json({ error: "Failed to save query" });
    }
  });

  app.get("/api/fhir-nl-search/saved", async (req: Request, res: Response) => {
    try {
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub;
      
      const savedQueries = getSavedQueries(userId);
      res.json({ savedQueries });
    } catch (error) {
      console.error("[AIFHIRNLSearch] Get saved queries error:", error);
      res.status(500).json({ error: "Failed to get saved queries" });
    }
  });

  app.delete("/api/fhir-nl-search/saved/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = deleteSavedQuery(id);
      
      if (!deleted) {
        res.status(404).json({ error: "Saved query not found" });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[AIFHIRNLSearch] Delete saved query error:", error);
      res.status(500).json({ error: "Failed to delete saved query" });
    }
  });

  console.log("[Routes] AI FHIR Natural Language Search routes registered at /api/fhir-nl-search/*");
}
