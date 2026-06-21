import { Express } from "express";
import { fhirAccessControlService } from "./services/fhir-access-control-service";

export function registerFHIRAccessControlRoutes(app: Express): void {
  const BASE_PATH = "/api/fhir-access-control";

  app.get(`${BASE_PATH}/policies`, async (req, res) => {
    try {
      const policies = await fhirAccessControlService.getPolicies();
      res.json({ policies });
    } catch (error) {
      console.error("[FHIRAccessControl] Get policies error:", error);
      res.status(500).json({ error: "Failed to fetch policies" });
    }
  });

  app.get(`${BASE_PATH}/policies/:policyId`, async (req, res) => {
    try {
      const policy = await fhirAccessControlService.getPolicy(req.params.policyId);
      if (!policy) {
        return res.status(404).json({ error: "Policy not found" });
      }
      res.json(policy);
    } catch (error) {
      console.error("[FHIRAccessControl] Get policy error:", error);
      res.status(500).json({ error: "Failed to fetch policy" });
    }
  });

  app.post(`${BASE_PATH}/policies`, async (req, res) => {
    try {
      const policy = await fhirAccessControlService.createPolicy(req.body);
      res.status(201).json(policy);
    } catch (error) {
      console.error("[FHIRAccessControl] Create policy error:", error);
      res.status(500).json({ error: "Failed to create policy" });
    }
  });

  app.patch(`${BASE_PATH}/policies/:policyId`, async (req, res) => {
    try {
      const policy = await fhirAccessControlService.updatePolicy(req.params.policyId, req.body);
      if (!policy) {
        return res.status(404).json({ error: "Policy not found" });
      }
      res.json(policy);
    } catch (error) {
      console.error("[FHIRAccessControl] Update policy error:", error);
      res.status(500).json({ error: "Failed to update policy" });
    }
  });

  app.delete(`${BASE_PATH}/policies/:policyId`, async (req, res) => {
    try {
      const deleted = await fhirAccessControlService.deletePolicy(req.params.policyId);
      if (!deleted) {
        return res.status(404).json({ error: "Policy not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("[FHIRAccessControl] Delete policy error:", error);
      res.status(500).json({ error: "Failed to delete policy" });
    }
  });

  app.get(`${BASE_PATH}/roles`, async (req, res) => {
    try {
      const roles = await fhirAccessControlService.getRoles();
      res.json({ roles });
    } catch (error) {
      console.error("[FHIRAccessControl] Get roles error:", error);
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  });

  app.get(`${BASE_PATH}/roles/:role`, async (req, res) => {
    try {
      const role = await fhirAccessControlService.getRole(req.params.role as any);
      if (!role) {
        return res.status(404).json({ error: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      console.error("[FHIRAccessControl] Get role error:", error);
      res.status(500).json({ error: "Failed to fetch role" });
    }
  });

  app.get(`${BASE_PATH}/smart-scopes`, async (req, res) => {
    try {
      const scopes = await fhirAccessControlService.getSMARTScopes();
      res.json({ scopes });
    } catch (error) {
      console.error("[FHIRAccessControl] Get scopes error:", error);
      res.status(500).json({ error: "Failed to fetch SMART scopes" });
    }
  });

  app.post(`${BASE_PATH}/evaluate`, async (req, res) => {
    try {
      const { userId, userRole, appId, appScopes, resourceType, resourceId, action, patientContext, requestContext } = req.body;
      
      if (!userId || !userRole || !resourceType || !action) {
        return res.status(400).json({ error: "userId, userRole, resourceType, and action are required" });
      }

      const result = await fhirAccessControlService.evaluateAccess({
        userId,
        userRole,
        appId,
        appScopes,
        resourceType,
        resourceId,
        action,
        patientContext,
        requestContext: requestContext || { timestamp: new Date().toISOString() },
      });
      res.json(result);
    } catch (error) {
      console.error("[FHIRAccessControl] Evaluate access error:", error);
      res.status(500).json({ error: "Failed to evaluate access" });
    }
  });

  app.get(`${BASE_PATH}/consents`, async (req, res) => {
    try {
      const { patientId } = req.query;
      let consents;
      if (patientId) {
        consents = await fhirAccessControlService.getPatientConsents(patientId as string);
      } else {
        consents = await fhirAccessControlService.getAllConsents();
      }
      res.json({ consents });
    } catch (error) {
      console.error("[FHIRAccessControl] Get consents error:", error);
      res.status(500).json({ error: "Failed to fetch consents" });
    }
  });

  app.get(`${BASE_PATH}/consents/:consentId`, async (req, res) => {
    try {
      const consent = await fhirAccessControlService.getConsent(req.params.consentId);
      if (!consent) {
        return res.status(404).json({ error: "Consent not found" });
      }
      res.json(consent);
    } catch (error) {
      console.error("[FHIRAccessControl] Get consent error:", error);
      res.status(500).json({ error: "Failed to fetch consent" });
    }
  });

  app.post(`${BASE_PATH}/consents`, async (req, res) => {
    try {
      const { request, decision } = req.body;
      if (!request || !decision) {
        return res.status(400).json({ error: "request and decision are required" });
      }
      const consent = await fhirAccessControlService.createConsent(request, decision);
      res.status(201).json(consent);
    } catch (error) {
      console.error("[FHIRAccessControl] Create consent error:", error);
      res.status(500).json({ error: "Failed to create consent" });
    }
  });

  app.post(`${BASE_PATH}/consents/:consentId/revoke`, async (req, res) => {
    try {
      const userId = (req as any).user?.id || "system";
      const consent = await fhirAccessControlService.revokeConsent(req.params.consentId, userId);
      if (!consent) {
        return res.status(404).json({ error: "Consent not found" });
      }
      res.json(consent);
    } catch (error) {
      console.error("[FHIRAccessControl] Revoke consent error:", error);
      res.status(500).json({ error: "Failed to revoke consent" });
    }
  });

  app.patch(`${BASE_PATH}/consents/:consentId/permissions`, async (req, res) => {
    try {
      const { resourcePermissions } = req.body;
      if (!resourcePermissions) {
        return res.status(400).json({ error: "resourcePermissions is required" });
      }
      const consent = await fhirAccessControlService.updateConsentPermissions(req.params.consentId, resourcePermissions);
      if (!consent) {
        return res.status(404).json({ error: "Consent not found" });
      }
      res.json(consent);
    } catch (error) {
      console.error("[FHIRAccessControl] Update consent permissions error:", error);
      res.status(500).json({ error: "Failed to update consent permissions" });
    }
  });

  app.get(`${BASE_PATH}/access-log`, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const log = await fhirAccessControlService.getAccessLog(limit);
      res.json({ log });
    } catch (error) {
      console.error("[FHIRAccessControl] Get access log error:", error);
      res.status(500).json({ error: "Failed to fetch access log" });
    }
  });

  app.get(`${BASE_PATH}/stats`, async (req, res) => {
    try {
      const stats = await fhirAccessControlService.getAccessStats();
      res.json(stats);
    } catch (error) {
      console.error("[FHIRAccessControl] Get stats error:", error);
      res.status(500).json({ error: "Failed to fetch access stats" });
    }
  });

  console.log("[FHIRAccessControl] Routes registered at /api/fhir-access-control/*");
  console.log("[FHIRAccessControl] Endpoints: /policies, /roles, /smart-scopes, /evaluate, /consents, /access-log, /stats");
}
