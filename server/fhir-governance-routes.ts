import { Express, Request, Response } from "express";
import { fhirProfileValidationService } from "./services/fhir-profile-validation-service";
import { fhirTerminologyService } from "./services/fhir-terminology-service";

export function registerFhirGovernanceRoutes(app: Express): void {
  const validationPrefix = "/api/fhir-validation";
  const terminologyPrefix = "/api/fhir-terminology";

  app.get(`${validationPrefix}/profiles`, async (req: Request, res: Response) => {
    try {
      const profiles = fhirProfileValidationService.getProfiles({
        type: req.query.type as any,
        resourceType: req.query.resourceType as string,
        activeOnly: req.query.activeOnly === "true"
      });
      res.json(profiles);
    } catch (error: any) {
      console.error("[FHIRValidation] Error listing profiles:", error);
      res.status(500).json({ error: "Failed to list profiles" });
    }
  });

  app.get(`${validationPrefix}/profiles/:profileId`, async (req: Request, res: Response) => {
    try {
      const profile = fhirProfileValidationService.getProfile(req.params.profileId);
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error: any) {
      console.error("[FHIRValidation] Error fetching profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.post(`${validationPrefix}/profiles`, async (req: Request, res: Response) => {
    try {
      const profile = fhirProfileValidationService.createProfile(
        req.body,
        (req as any).user?.id || "api-user"
      );
      res.status(201).json(profile);
    } catch (error: any) {
      console.error("[FHIRValidation] Error creating profile:", error);
      res.status(500).json({ error: "Failed to create profile" });
    }
  });

  app.put(`${validationPrefix}/profiles/:profileId`, async (req: Request, res: Response) => {
    try {
      const profile = fhirProfileValidationService.updateProfile(
        req.params.profileId,
        req.body,
        (req as any).user?.id || "api-user"
      );
      if (!profile) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json(profile);
    } catch (error: any) {
      console.error("[FHIRValidation] Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.delete(`${validationPrefix}/profiles/:profileId`, async (req: Request, res: Response) => {
    try {
      const success = fhirProfileValidationService.deleteProfile(
        req.params.profileId,
        (req as any).user?.id || "api-user"
      );
      if (!success) {
        return res.status(404).json({ error: "Profile not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("[FHIRValidation] Error deleting profile:", error);
      res.status(500).json({ error: "Failed to delete profile" });
    }
  });

  app.post(`${validationPrefix}/validate`, async (req: Request, res: Response) => {
    try {
      const { resource, profileIds } = req.body;
      if (!resource) {
        return res.status(400).json({ error: "Resource is required" });
      }

      const report = fhirProfileValidationService.validateResource(
        resource,
        profileIds,
        (req as any).user?.id || "api-user"
      );
      res.json(report);
    } catch (error: any) {
      console.error("[FHIRValidation] Error validating resource:", error);
      res.status(500).json({ error: "Failed to validate resource" });
    }
  });

  app.post(`${validationPrefix}/validate/batch`, async (req: Request, res: Response) => {
    try {
      const { resources, profileIds } = req.body;
      if (!resources || !Array.isArray(resources)) {
        return res.status(400).json({ error: "Resources array is required" });
      }

      const result = fhirProfileValidationService.batchValidate(
        resources,
        profileIds,
        (req as any).user?.id || "api-user"
      );
      res.json(result);
    } catch (error: any) {
      console.error("[FHIRValidation] Error batch validating:", error);
      res.status(500).json({ error: "Failed to batch validate resources" });
    }
  });

  app.get(`${validationPrefix}/reports`, async (req: Request, res: Response) => {
    try {
      const reports = fhirProfileValidationService.getValidationReports({
        resourceType: req.query.resourceType as string,
        result: req.query.result as any,
        fromDate: req.query.fromDate as string,
        limit: parseInt(req.query.limit as string) || 100
      });
      res.json({ reports });
    } catch (error: any) {
      console.error("[FHIRValidation] Error listing reports:", error);
      res.status(500).json({ error: "Failed to list reports" });
    }
  });

  app.get(`${validationPrefix}/reports/:reportId`, async (req: Request, res: Response) => {
    try {
      const report = fhirProfileValidationService.getValidationReport(req.params.reportId);
      if (!report) {
        return res.status(404).json({ error: "Report not found" });
      }
      res.json(report);
    } catch (error: any) {
      console.error("[FHIRValidation] Error fetching report:", error);
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  app.get(`${validationPrefix}/configs`, async (_req: Request, res: Response) => {
    try {
      const configs = fhirProfileValidationService.getValidationConfigs();
      res.json({ configurations: configs });
    } catch (error: any) {
      console.error("[FHIRValidation] Error listing configs:", error);
      res.status(500).json({ error: "Failed to list configurations" });
    }
  });

  app.post(`${validationPrefix}/configs`, async (req: Request, res: Response) => {
    try {
      const config = fhirProfileValidationService.createValidationConfig(
        req.body,
        (req as any).user?.id || "api-user"
      );
      res.status(201).json(config);
    } catch (error: any) {
      console.error("[FHIRValidation] Error creating config:", error);
      res.status(500).json({ error: "Failed to create configuration" });
    }
  });

  app.get(`${validationPrefix}/stats`, async (_req: Request, res: Response) => {
    try {
      const stats = fhirProfileValidationService.getValidationStats();
      res.json(stats);
    } catch (error: any) {
      console.error("[FHIRValidation] Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  app.get(`${terminologyPrefix}/code-systems`, async (req: Request, res: Response) => {
    try {
      const codeSystems = fhirTerminologyService.getCodeSystems({
        status: req.query.status as any
      });
      res.json({ codeSystems });
    } catch (error: any) {
      console.error("[FHIRTerminology] Error listing code systems:", error);
      res.status(500).json({ error: "Failed to list code systems" });
    }
  });

  app.get(`${terminologyPrefix}/code-systems/:codeSystemId`, async (req: Request, res: Response) => {
    try {
      const codeSystem = fhirTerminologyService.getCodeSystem(req.params.codeSystemId);
      if (!codeSystem) {
        return res.status(404).json({ error: "Code system not found" });
      }
      res.json(codeSystem);
    } catch (error: any) {
      console.error("[FHIRTerminology] Error fetching code system:", error);
      res.status(500).json({ error: "Failed to fetch code system" });
    }
  });

  app.post(`${terminologyPrefix}/lookup`, async (req: Request, res: Response) => {
    try {
      const { system, code, version, displayLanguage } = req.body;
      if (!system || !code) {
        return res.status(400).json({ error: "System and code are required" });
      }

      const result = fhirTerminologyService.lookupCode({
        system,
        code,
        version,
        displayLanguage,
        userId: (req as any).user?.id || "api-user"
      });

      if (!result) {
        return res.status(404).json({ error: "Code not found" });
      }
      res.json(result);
    } catch (error: any) {
      console.error("[FHIRTerminology] Error looking up code:", error);
      res.status(500).json({ error: "Failed to lookup code" });
    }
  });

  app.post(`${terminologyPrefix}/validate-code`, async (req: Request, res: Response) => {
    try {
      const { url, valueSet, code, system, display, coding } = req.body;
      if (!code || !system) {
        return res.status(400).json({ error: "Code and system are required" });
      }

      const result = fhirTerminologyService.validateCode({
        url,
        valueSet,
        code,
        system,
        display,
        coding,
        userId: (req as any).user?.id || "api-user"
      });
      res.json(result);
    } catch (error: any) {
      console.error("[FHIRTerminology] Error validating code:", error);
      res.status(500).json({ error: "Failed to validate code" });
    }
  });

  app.post(`${terminologyPrefix}/translate`, async (req: Request, res: Response) => {
    try {
      const { conceptMapUrl, code, system, targetSystem } = req.body;
      if (!code || !system) {
        return res.status(400).json({ error: "Code and system are required" });
      }

      const result = fhirTerminologyService.translateCode({
        conceptMapUrl,
        code,
        system,
        targetSystem,
        userId: (req as any).user?.id || "api-user"
      });
      res.json(result);
    } catch (error: any) {
      console.error("[FHIRTerminology] Error translating code:", error);
      res.status(500).json({ error: "Failed to translate code" });
    }
  });

  app.get(`${terminologyPrefix}/search`, async (req: Request, res: Response) => {
    try {
      const { system, filter, count } = req.query;
      if (!system || !filter) {
        return res.status(400).json({ error: "System and filter are required" });
      }

      const results = fhirTerminologyService.searchConcepts({
        system: system as string,
        filter: filter as string,
        count: count ? parseInt(count as string) : 20,
        userId: (req as any).user?.id || "api-user"
      });
      res.json({ results });
    } catch (error: any) {
      console.error("[FHIRTerminology] Error searching concepts:", error);
      res.status(500).json({ error: "Failed to search concepts" });
    }
  });

  app.get(`${terminologyPrefix}/value-sets`, async (req: Request, res: Response) => {
    try {
      const valueSets = fhirTerminologyService.getValueSets({
        status: req.query.status as any
      });
      res.json({ valueSets });
    } catch (error: any) {
      console.error("[FHIRTerminology] Error listing value sets:", error);
      res.status(500).json({ error: "Failed to list value sets" });
    }
  });

  app.get(`${terminologyPrefix}/value-sets/:valueSetId`, async (req: Request, res: Response) => {
    try {
      const valueSet = fhirTerminologyService.getValueSet(req.params.valueSetId);
      if (!valueSet) {
        return res.status(404).json({ error: "Value set not found" });
      }
      res.json(valueSet);
    } catch (error: any) {
      console.error("[FHIRTerminology] Error fetching value set:", error);
      res.status(500).json({ error: "Failed to fetch value set" });
    }
  });

  app.post(`${terminologyPrefix}/value-sets`, async (req: Request, res: Response) => {
    try {
      const valueSet = fhirTerminologyService.createValueSet(
        req.body,
        (req as any).user?.id || "api-user"
      );
      res.status(201).json(valueSet);
    } catch (error: any) {
      console.error("[FHIRTerminology] Error creating value set:", error);
      res.status(500).json({ error: "Failed to create value set" });
    }
  });

  app.post(`${terminologyPrefix}/value-sets/:valueSetId/expand`, async (req: Request, res: Response) => {
    try {
      const { filter, offset, count } = req.body;

      const expansion = fhirTerminologyService.expandValueSet({
        valueSetId: req.params.valueSetId,
        filter,
        offset,
        count,
        userId: (req as any).user?.id || "api-user"
      });

      if (!expansion) {
        return res.status(404).json({ error: "Value set not found" });
      }
      res.json(expansion);
    } catch (error: any) {
      console.error("[FHIRTerminology] Error expanding value set:", error);
      res.status(500).json({ error: "Failed to expand value set" });
    }
  });

  app.get(`${terminologyPrefix}/concept-maps`, async (req: Request, res: Response) => {
    try {
      const conceptMaps = fhirTerminologyService.getConceptMaps({
        sourceUri: req.query.sourceUri as string,
        targetUri: req.query.targetUri as string
      });
      res.json({ conceptMaps });
    } catch (error: any) {
      console.error("[FHIRTerminology] Error listing concept maps:", error);
      res.status(500).json({ error: "Failed to list concept maps" });
    }
  });

  app.get(`${terminologyPrefix}/concept-maps/:conceptMapId`, async (req: Request, res: Response) => {
    try {
      const conceptMap = fhirTerminologyService.getConceptMap(req.params.conceptMapId);
      if (!conceptMap) {
        return res.status(404).json({ error: "Concept map not found" });
      }
      res.json(conceptMap);
    } catch (error: any) {
      console.error("[FHIRTerminology] Error fetching concept map:", error);
      res.status(500).json({ error: "Failed to fetch concept map" });
    }
  });

  app.post(`${terminologyPrefix}/concept-maps`, async (req: Request, res: Response) => {
    try {
      const conceptMap = fhirTerminologyService.createConceptMap(
        req.body,
        (req as any).user?.id || "api-user"
      );
      res.status(201).json(conceptMap);
    } catch (error: any) {
      console.error("[FHIRTerminology] Error creating concept map:", error);
      res.status(500).json({ error: "Failed to create concept map" });
    }
  });

  app.get(`${terminologyPrefix}/stats`, async (_req: Request, res: Response) => {
    try {
      const stats = fhirTerminologyService.getTerminologyStats();
      res.json(stats);
    } catch (error: any) {
      console.error("[FHIRTerminology] Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  console.log("[HIPAA-AUDIT][FHIRGovernance] Profile Validation routes registered at", validationPrefix);
  console.log("[HIPAA-AUDIT][FHIRGovernance] Terminology Service routes registered at", terminologyPrefix);
}
