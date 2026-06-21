/**
 * Compliance Routes
 * API endpoints for compliance status and configuration
 */

import type { Express, Request, Response } from "express";
import { 
  getComplianceStatus, 
  logComplianceEvent,
  CDSFeatures,
  blockCDSEndpoint,
  enforceSecurityHeaders 
} from "./compliance-enforcement";
import { generateComplianceStatusReport, defaultComplianceConfig } from "@shared/compliance-controls";

export function registerComplianceRoutes(app: Express) {
  console.log("[Routes] Compliance routes registered at /api/compliance");

  // Apply security headers to all routes
  app.use(enforceSecurityHeaders);

  // Get compliance configuration status
  app.get("/api/compliance/status", async (req: Request, res: Response) => {
    try {
      const status = getComplianceStatus();
      const report = generateComplianceStatusReport();
      
      await logComplianceEvent("compliance_status_viewed", { viewedBy: "api" }, req);
      
      res.json({
        status,
        report,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Compliance] Status error:", error);
      res.status(500).json({ error: "Failed to get compliance status" });
    }
  });

  // Get FHIR R4 standardization info
  app.get("/api/compliance/fhir-standard", async (req: Request, res: Response) => {
    try {
      res.json({
        fhirVersion: "R4",
        fhirVersionNumber: "4.0.1",
        supportedResources: [
          "Patient",
          "Condition",
          "Observation",
          "MedicationRequest",
          "AllergyIntolerance",
          "DiagnosticReport",
          "Immunization",
          "Procedure",
          "CarePlan",
          "Provenance",
          "Bundle",
        ],
        supportedCodeSystems: [
          { name: "SNOMED CT", uri: "http://snomed.info/sct", description: "Clinical terminology" },
          { name: "LOINC", uri: "http://loinc.org", description: "Laboratory and clinical observations" },
          { name: "ICD-10-CM", uri: "http://hl7.org/fhir/sid/icd-10-cm", description: "Diagnosis codes" },
          { name: "RxNorm", uri: "http://www.nlm.nih.gov/research/umls/rxnorm", description: "Medication terminology" },
          { name: "CPT", uri: "http://www.ama-assn.org/go/cpt", description: "Procedure codes" },
          { name: "NDC", uri: "http://hl7.org/fhir/sid/ndc", description: "Drug codes" },
          { name: "CVX", uri: "http://hl7.org/fhir/sid/cvx", description: "Vaccine codes" },
          { name: "UCUM", uri: "http://unitsofmeasure.org", description: "Units of measure" },
        ],
        deduplication: {
          enabled: true,
          matchingAlgorithm: "code-system-aware",
          version: "1.0.0",
          description: "Deduplication uses FHIR identifiers and code systems for accurate record matching",
        },
      });
    } catch (error) {
      console.error("[Compliance] FHIR standard error:", error);
      res.status(500).json({ error: "Failed to get FHIR standard info" });
    }
  });

  // Get CDS disabled features list
  app.get("/api/compliance/cds-status", async (req: Request, res: Response) => {
    try {
      const config = defaultComplianceConfig;
      
      res.json({
        cdsEnabled: config.clinicalDecisionSupport.enabled,
        disabledFeatures: config.clinicalDecisionSupport.disabledFeatures.map(feature => ({
          id: feature,
          name: feature.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
          reason: "Clinical decision support features are disabled in compliance with regulatory requirements",
        })),
        alternativeGuidance: "This platform provides health record management and data aggregation. For clinical decisions, please consult your healthcare provider.",
      });
    } catch (error) {
      console.error("[Compliance] CDS status error:", error);
      res.status(500).json({ error: "Failed to get CDS status" });
    }
  });

  // In-memory store for data access requests (production would use database)
  const dataAccessRequests: Array<{
    id: string;
    name: string;
    email: string;
    requestType: string;
    description: string;
    status: string;
    submittedAt: string;
    slaDeadline: string;
    completedAt: string | null;
  }> = [];

  // Submit a data access request (ONC HTI-1 compliance)
  app.post("/api/compliance/data-access-request", async (req: Request, res: Response) => {
    try {
      const { name, email, requestType, description } = req.body;
      if (!name || !email || !requestType || !description) {
        return res.status(400).json({ error: "All fields are required: name, email, requestType, description" });
      }

      const submittedAt = new Date();
      const slaDeadline = new Date(submittedAt);
      slaDeadline.setDate(slaDeadline.getDate() + 15);

      const request = {
        id: `DAR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
        name,
        email,
        requestType,
        description,
        status: "received",
        submittedAt: submittedAt.toISOString(),
        slaDeadline: slaDeadline.toISOString(),
        completedAt: null,
      };

      dataAccessRequests.push(request);

      await logComplianceEvent("data_access_request_submitted", {
        requestId: request.id,
        requestType,
        slaDeadline: request.slaDeadline,
      }, req);

      console.log(`[Compliance] Data access request ${request.id} submitted. SLA deadline: ${request.slaDeadline}`);

      res.status(201).json({
        requestId: request.id,
        status: request.status,
        submittedAt: request.submittedAt,
        slaDeadline: request.slaDeadline,
        estimatedCompletion: "Within 15 calendar days per ONC HTI-1 requirements",
        message: "Your data access request has been received and logged. You will receive confirmation at the provided email address.",
      });
    } catch (error) {
      console.error("[Compliance] Data access request error:", error);
      res.status(500).json({ error: "Failed to submit data access request" });
    }
  });

  // Get data access request status
  app.get("/api/compliance/data-access-request/:requestId", async (req: Request, res: Response) => {
    try {
      const { requestId } = req.params;
      const request = dataAccessRequests.find(r => r.id === requestId);
      
      if (!request) {
        return res.status(404).json({ error: "Request not found" });
      }

      const now = new Date();
      const deadline = new Date(request.slaDeadline);
      const daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const slaCompliant = request.completedAt 
        ? new Date(request.completedAt) <= deadline 
        : now <= deadline;

      res.json({
        ...request,
        daysRemaining,
        slaCompliant,
      });
    } catch (error) {
      console.error("[Compliance] Request lookup error:", error);
      res.status(500).json({ error: "Failed to lookup request" });
    }
  });

  // Get all data access requests (admin/audit)
  app.get("/api/compliance/data-access-requests", async (req: Request, res: Response) => {
    try {
      const now = new Date();
      const requestsWithSla = dataAccessRequests.map(r => {
        const deadline = new Date(r.slaDeadline);
        const daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        const slaCompliant = r.completedAt 
          ? new Date(r.completedAt) <= deadline 
          : now <= deadline;
        return { ...r, daysRemaining, slaCompliant };
      });

      res.json({
        requests: requestsWithSla,
        totalCount: requestsWithSla.length,
        pendingCount: requestsWithSla.filter(r => r.status !== "completed").length,
        slaBreaches: requestsWithSla.filter(r => !r.slaCompliant).length,
      });
    } catch (error) {
      console.error("[Compliance] Requests listing error:", error);
      res.status(500).json({ error: "Failed to list requests" });
    }
  });

  // Register CDS blocking middleware for specific routes
  // These routes will return 403 when accessed
  const cdsRouteBlocks = [
    { path: "/api/symptoms", feature: CDSFeatures.SYMPTOM_TRIAGE },
    { path: "/api/differential-diagnosis", feature: CDSFeatures.DIFFERENTIAL_DIAGNOSIS },
    { path: "/api/drug-interactions", feature: CDSFeatures.DRUG_INTERACTION_ALERTS },
    { path: "/api/medication-safety", feature: CDSFeatures.MEDICATION_SAFETY_ALERTS },
    { path: "/api/predictive-health", feature: CDSFeatures.PREDICTIVE_HEALTH },
    { path: "/api/risk-stratification/clinical", feature: CDSFeatures.RISK_STRATIFICATION_CLINICAL },
    { path: "/api/care-gap-analysis", feature: CDSFeatures.CARE_GAP_ANALYSIS },
    { path: "/api/ai-care-plan/generate", feature: CDSFeatures.AI_CARE_PLAN_AUTOMATION },
    { path: "/api/ai-care-plan/suggest-interventions", feature: CDSFeatures.AI_CARE_PLAN_AUTOMATION },
    { path: "/api/medical-assistant/diagnose", feature: CDSFeatures.MEDICAL_ASSISTANT },
    { path: "/api/proactive-health-alerts", feature: CDSFeatures.PROACTIVE_HEALTH_ALERTS },
    { path: "/api/health-insights/recommendations", feature: CDSFeatures.PREDICTIVE_HEALTH },
  ];

  for (const block of cdsRouteBlocks) {
    app.all(`${block.path}*`, blockCDSEndpoint(block.feature), (req, res, next) => {
      next();
    });
  }
}
