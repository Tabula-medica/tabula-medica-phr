import type { Express } from "express";
import { fhirAPIExplorerService, FHIRQuery } from "./services/fhir-api-explorer-service";

export function registerFHIRAPIExplorerRoutes(app: Express): void {
  app.get("/api/fhir-explorer/metadata", (_req, res) => {
    res.json(fhirAPIExplorerService.getExplorerMetadata());
  });

  app.get("/api/fhir-explorer/endpoints", (_req, res) => {
    res.json({ endpoints: fhirAPIExplorerService.getEndpoints() });
  });

  app.get("/api/fhir-explorer/endpoints/:id", (req, res) => {
    const endpoint = fhirAPIExplorerService.getEndpoint(req.params.id);
    if (!endpoint) {
      return res.status(404).json({ error: "Endpoint not found" });
    }
    res.json(endpoint);
  });

  app.get("/api/fhir-explorer/endpoints/:id/test", async (req, res) => {
    const result = await fhirAPIExplorerService.testEndpointConnection(req.params.id);
    res.json(result);
  });

  app.get("/api/fhir-explorer/profiles", (_req, res) => {
    res.json({ profiles: fhirAPIExplorerService.getResourceProfiles() });
  });

  app.get("/api/fhir-explorer/profiles/:resourceType", (req, res) => {
    const profile = fhirAPIExplorerService.getResourceProfile(req.params.resourceType);
    if (!profile) {
      return res.status(404).json({ error: "Profile not found" });
    }
    res.json(profile);
  });

  app.get("/api/fhir-explorer/saved-queries", (_req, res) => {
    res.json({ queries: fhirAPIExplorerService.getSavedQueries() });
  });

  app.get("/api/fhir-explorer/saved-queries/:id", (req, res) => {
    const query = fhirAPIExplorerService.getSavedQuery(req.params.id);
    if (!query) {
      return res.status(404).json({ error: "Saved query not found" });
    }
    res.json(query);
  });

  app.post("/api/fhir-explorer/saved-queries", (req, res) => {
    try {
      const { name, description, query, isPublic, tags, createdBy } = req.body;
      if (!name || !query) {
        return res.status(400).json({ error: "Name and query are required" });
      }
      const savedQuery = fhirAPIExplorerService.saveQuery({
        name,
        description: description || "",
        query,
        isPublic: isPublic ?? false,
        tags: tags || [],
        createdBy: createdBy || "user",
      });
      res.status(201).json(savedQuery);
    } catch (error) {
      res.status(500).json({ error: "Failed to save query" });
    }
  });

  app.delete("/api/fhir-explorer/saved-queries/:id", (req, res) => {
    const deleted = fhirAPIExplorerService.deleteQuery(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Query not found" });
    }
    res.json({ success: true });
  });

  app.post("/api/fhir-explorer/execute", async (req, res) => {
    try {
      const { endpointId, query, userId } = req.body;
      if (!endpointId || !query) {
        return res.status(400).json({ error: "Endpoint ID and query are required" });
      }

      const fhirQuery: FHIRQuery = {
        id: `adhoc-${Date.now()}`,
        name: query.name || "Ad-hoc Query",
        description: query.description || "",
        resourceType: query.resourceType,
        method: query.method || "GET",
        endpoint: query.endpoint,
        parameters: query.parameters || {},
        headers: query.headers || { Accept: "application/fhir+json" },
        body: query.body,
        createdAt: new Date().toISOString(),
        createdBy: userId || "anonymous",
      };

      const result = await fhirAPIExplorerService.executeQuery(
        endpointId,
        fhirQuery,
        userId || "anonymous"
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: "Failed to execute query",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.get("/api/fhir-explorer/history", (_req, res) => {
    const history = fhirAPIExplorerService.getQueryHistory();
    res.json({ history, count: history.length });
  });

  app.get("/api/fhir-explorer/results/:id", (req, res) => {
    const result = fhirAPIExplorerService.getQueryResult(req.params.id);
    if (!result) {
      return res.status(404).json({ error: "Result not found" });
    }
    res.json(result);
  });

  console.log("[Routes] FHIR API Explorer routes registered at /api/fhir-explorer/*");
}
