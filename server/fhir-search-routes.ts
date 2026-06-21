import { Express, Request, Response } from "express";
import { fhirSearchQuerySchema } from "@shared/schema";
import { isAuthenticated } from "./replit_integrations/auth";
import {
  searchFHIRResources,
  getSearchAuditLog,
  getSearchById,
  getCodeSystemInfo,
} from "./services/fhir-search-service";

export function registerFHIRSearchRoutes(app: Express): void {
  app.post("/api/fhir/search", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const ipAddress = req.ip || req.socket.remoteAddress || "unknown";
      const userAgent = req.headers["user-agent"] || "unknown";

      const validation = fhirSearchQuerySchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({
          error: "Invalid search query",
          details: validation.error.errors,
        });
        return;
      }

      const query = validation.data;
      const response = await searchFHIRResources(
        {
          ...query,
          patientId: userId,
          page: query.page || 1,
          pageSize: query.pageSize || 20,
        },
        userId,
        ipAddress,
        userAgent
      );

      res.json(response);
    } catch (error) {
      console.error("[FHIRSearch] Search error:", error);
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.get("/api/fhir/search/code-systems", async (_req: Request, res: Response) => {
    try {
      const codeSystems = getCodeSystemInfo();
      res.json({ codeSystems });
    } catch (error) {
      console.error("[FHIRSearch] Code systems error:", error);
      res.status(500).json({ error: "Failed to get code systems" });
    }
  });

  app.get("/api/fhir/search/resource-types", async (_req: Request, res: Response) => {
    try {
      const resourceTypes = [
        { value: "Condition", label: "Conditions", description: "Medical conditions and diagnoses" },
        { value: "Medication", label: "Medications", description: "Medication records" },
        { value: "MedicationRequest", label: "Prescriptions", description: "Medication prescriptions and orders" },
        { value: "Observation", label: "Observations", description: "Lab results and vital signs" },
        { value: "AllergyIntolerance", label: "Allergies", description: "Allergy and intolerance records" },
        { value: "Procedure", label: "Procedures", description: "Medical procedures" },
        { value: "Immunization", label: "Immunizations", description: "Vaccination records" },
        { value: "DiagnosticReport", label: "Diagnostic Reports", description: "Lab and imaging reports" },
        { value: "DocumentReference", label: "Documents", description: "Clinical documents" },
        { value: "Encounter", label: "Encounters", description: "Healthcare visits and encounters" },
      ];
      res.json({ resourceTypes });
    } catch (error) {
      console.error("[FHIRSearch] Resource types error:", error);
      res.status(500).json({ error: "Failed to get resource types" });
    }
  });

  app.get("/api/fhir/search/audit", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const auditLog = getSearchAuditLog(userId, limit);
      res.json({ auditLog });
    } catch (error) {
      console.error("[FHIRSearch] Audit log error:", error);
      res.status(500).json({ error: "Failed to get audit log" });
    }
  });

  app.get("/api/fhir/search/:searchId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as { claims?: { sub?: string } } | undefined;
      const userId = user?.claims?.sub;
      if (!userId) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const { searchId } = req.params;
      const searchEntry = getSearchById(searchId, userId);
      if (!searchEntry) {
        res.status(404).json({ error: "Search not found" });
        return;
      }
      if (searchEntry.userId !== userId) {
        res.status(404).json({ error: "Search not found" });
        return;
      }
      res.json({ search: searchEntry });
    } catch (error) {
      console.error("[FHIRSearch] Get search error:", error);
      res.status(500).json({ error: "Failed to get search" });
    }
  });

  console.log("[Routes] FHIR Advanced Search routes registered at /api/fhir/search");
}
