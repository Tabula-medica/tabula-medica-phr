import { Router, Request, Response } from "express";
import { fhirAdvancedSearchService } from "./services/fhir-advanced-search-service";

const router = Router();

router.get("/resource-types", (_req: Request, res: Response) => {
  try {
    const resourceTypes = fhirAdvancedSearchService.getSupportedResourceTypes();
    res.json({ resourceTypes });
  } catch (error) {
    console.error("[FHIRSearch] Get resource types error:", error);
    res.status(500).json({ error: "Failed to retrieve resource types" });
  }
});

router.get("/parameters/:resourceType", (req: Request, res: Response) => {
  try {
    const { resourceType } = req.params;
    const parameters = fhirAdvancedSearchService.getSearchParameters(resourceType);
    res.json({ parameters });
  } catch (error) {
    console.error("[FHIRSearch] Get parameters error:", error);
    res.status(500).json({ error: "Failed to retrieve search parameters" });
  }
});

router.get("/parameters", (_req: Request, res: Response) => {
  try {
    const allParameters = fhirAdvancedSearchService.getAllSearchParameters();
    res.json({ parameters: allParameters });
  } catch (error) {
    console.error("[FHIRSearch] Get all parameters error:", error);
    res.status(500).json({ error: "Failed to retrieve search parameters" });
  }
});

router.get("/operators/:type", (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const operators = fhirAdvancedSearchService.getOperatorsForType(type);
    res.json({ operators });
  } catch (error) {
    console.error("[FHIRSearch] Get operators error:", error);
    res.status(500).json({ error: "Failed to retrieve operators" });
  }
});

router.post("/execute", async (req: Request, res: Response) => {
  try {
    const query = req.body;
    if (!query.resourceType || !query.conditions) {
      return res.status(400).json({ error: "resourceType and conditions are required" });
    }
    const results = await fhirAdvancedSearchService.executeSearch(query);
    res.json(results);
  } catch (error) {
    console.error("[FHIRSearch] Execute search error:", error);
    res.status(500).json({ error: "Failed to execute search" });
  }
});

router.post("/ai-suggestions", async (req: Request, res: Response) => {
  try {
    const { resourceType, conditions } = req.body;
    if (!resourceType) {
      return res.status(400).json({ error: "resourceType is required" });
    }
    const suggestions = await fhirAdvancedSearchService.getAISearchSuggestions(resourceType, conditions || []);
    res.json({ suggestions });
  } catch (error) {
    console.error("[FHIRSearch] AI suggestions error:", error);
    res.status(500).json({ error: "Failed to generate suggestions" });
  }
});

router.get("/saved-queries", (_req: Request, res: Response) => {
  try {
    const queries = fhirAdvancedSearchService.getSavedQueries();
    res.json({ queries });
  } catch (error) {
    console.error("[FHIRSearch] Get saved queries error:", error);
    res.status(500).json({ error: "Failed to retrieve saved queries" });
  }
});

router.post("/saved-queries", (req: Request, res: Response) => {
  try {
    const { name, description, query, isPublic } = req.body;
    if (!name || !query) {
      return res.status(400).json({ error: "name and query are required" });
    }
    const savedQuery = fhirAdvancedSearchService.saveQuery(name, description || "", query, "user", isPublic || false);
    res.status(201).json(savedQuery);
  } catch (error) {
    console.error("[FHIRSearch] Save query error:", error);
    res.status(500).json({ error: "Failed to save query" });
  }
});

router.delete("/saved-queries/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = fhirAdvancedSearchService.deleteSavedQuery(id);
    if (!success) {
      return res.status(404).json({ error: "Query not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("[FHIRSearch] Delete query error:", error);
    res.status(500).json({ error: "Failed to delete query" });
  }
});

export default router;
