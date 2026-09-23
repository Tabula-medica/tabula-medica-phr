import { Router, Request, Response } from "express";
import { createHash, randomBytes } from "crypto";
import { storage } from "../storage";
import { fhirExportService } from "../services/fhir-export-service";
import { FHIR_API_SCOPES } from "@shared/schema";
import { requireUser, getUserId } from "../middleware/require-user";

const router = Router();

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function generateApiKey(): { key: string; prefix: string } {
  const key = `tmfhir_${randomBytes(32).toString("hex")}`;
  const prefix = key.substring(0, 12);
  return { key, prefix };
}

async function authenticatePartner(req: Request): Promise<{ partnerId: string; partnerName: string; allowedScopes: string[] } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const keyHash = hashApiKey(token);
  const partner = await storage.getFhirApiPartnerByKeyHash(keyHash);

  if (!partner || partner.status !== "active") return null;
  if (partner.expiresAt && new Date(partner.expiresAt) < new Date()) return null;

  await storage.updateFhirApiPartner(partner.id, { lastAccessAt: new Date() });
  return { partnerId: partner.id, partnerName: partner.name, allowedScopes: partner.allowedScopes };
}

async function logFhirApiRequest(
  partnerId: string | null,
  partnerName: string,
  action: string,
  req: Request,
  statusCode: number,
  startTime: number,
  extras: { resourceType?: string; patientEmail?: string; scopesUsed?: string[]; errorMessage?: string } = {}
) {
  await storage.createFhirApiAuditLog({
    partnerId,
    partnerName,
    action,
    resourceType: extras.resourceType || null,
    patientEmail: extras.patientEmail || null,
    scopesUsed: extras.scopesUsed || [],
    statusCode,
    ipAddress: req.ip || req.socket.remoteAddress || null,
    userAgent: req.headers["user-agent"] || null,
    requestPath: req.originalUrl || req.path,
    responseTimeMs: Date.now() - startTime,
    errorMessage: extras.errorMessage || null,
    metadata: {},
  });
}

router.get("/partners", requireUser, async (req: Request, res: Response) => {
  try {
    const partners = await storage.getFhirApiPartners();
    const sanitized = partners.map(({ apiKeyHash, ...rest }) => rest);
    res.json({ partners: sanitized });
  } catch (error) {
    console.error("[FHIRDataHub] Get partners error:", error);
    res.status(500).json({ error: "Failed to fetch partners" });
  }
});

router.get("/partners/:id", requireUser, async (req: Request, res: Response) => {
  try {
    const partner = await storage.getFhirApiPartner(req.params.id);
    if (!partner) return res.status(404).json({ error: "Partner not found" });
    const { apiKeyHash, ...sanitized } = partner;
    res.json(sanitized);
  } catch (error) {
    console.error("[FHIRDataHub] Get partner error:", error);
    res.status(500).json({ error: "Failed to fetch partner" });
  }
});

router.post("/partners", requireUser, async (req: Request, res: Response) => {
  try {
    const { name, organization, contactEmail, allowedScopes, rateLimitPerHour, expiresAt } = req.body;
    if (!name || !organization || !contactEmail) {
      return res.status(400).json({ error: "name, organization, and contactEmail are required" });
    }

    const { key, prefix } = generateApiKey();
    const apiKeyHash = hashApiKey(key);

    const partner = await storage.createFhirApiPartner({
      name,
      organization,
      contactEmail,
      apiKeyHash,
      apiKeyPrefix: prefix,
      allowedScopes: allowedScopes || [...FHIR_API_SCOPES],
      rateLimitPerHour: rateLimitPerHour || 100,
      status: "active",
      expiresAt: expiresAt || null,
      metadata: {},
    });

    console.log(`[HIPAA-AUDIT][FHIRDataHub] Partner registered: id=${partner.id}, name=${name}, org=${organization}`);

    const { apiKeyHash: _, ...sanitized } = partner;
    res.status(201).json({ ...sanitized, apiKey: key });
  } catch (error) {
    console.error("[FHIRDataHub] Create partner error:", error);
    res.status(500).json({ error: "Failed to create partner" });
  }
});

router.patch("/partners/:id", requireUser, async (req: Request, res: Response) => {
  try {
    const { status, allowedScopes, rateLimitPerHour, expiresAt } = req.body;
    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (allowedScopes) updates.allowedScopes = allowedScopes;
    if (rateLimitPerHour !== undefined) updates.rateLimitPerHour = rateLimitPerHour;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt;

    const partner = await storage.updateFhirApiPartner(req.params.id, updates);
    if (!partner) return res.status(404).json({ error: "Partner not found" });

    console.log(`[HIPAA-AUDIT][FHIRDataHub] Partner updated: id=${req.params.id}, changes=${JSON.stringify(Object.keys(updates))}`);
    const { apiKeyHash, ...sanitized } = partner;
    res.json(sanitized);
  } catch (error) {
    console.error("[FHIRDataHub] Update partner error:", error);
    res.status(500).json({ error: "Failed to update partner" });
  }
});

router.delete("/partners/:id", requireUser, async (req: Request, res: Response) => {
  try {
    await storage.deleteFhirApiPartner(req.params.id);
    console.log(`[HIPAA-AUDIT][FHIRDataHub] Partner deleted: id=${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[FHIRDataHub] Delete partner error:", error);
    res.status(500).json({ error: "Failed to delete partner" });
  }
});

router.post("/partners/:id/rotate-key", requireUser, async (req: Request, res: Response) => {
  try {
    const partner = await storage.getFhirApiPartner(req.params.id);
    if (!partner) return res.status(404).json({ error: "Partner not found" });

    const { key, prefix } = generateApiKey();
    const apiKeyHash = hashApiKey(key);

    await storage.updateFhirApiPartner(req.params.id, { apiKeyHash, apiKeyPrefix: prefix });
    console.log(`[HIPAA-AUDIT][FHIRDataHub] API key rotated for partner: id=${req.params.id}`);

    res.json({ apiKey: key, apiKeyPrefix: prefix });
  } catch (error) {
    console.error("[FHIRDataHub] Rotate key error:", error);
    res.status(500).json({ error: "Failed to rotate API key" });
  }
});

router.get("/scope-grants", requireUser, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const grants = await storage.getFhirApiScopeGrants(userId);
    res.json({ grants });
  } catch (error) {
    console.error("[FHIRDataHub] Get scope grants error:", error);
    res.status(500).json({ error: "Failed to fetch scope grants" });
  }
});

router.get("/scope-grants/partner/:partnerId", requireUser, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const grants = await storage.getFhirApiScopeGrantsForPatientAndPartner(userId, req.params.partnerId);
    res.json({ grants });
  } catch (error) {
    console.error("[FHIRDataHub] Get partner scope grants error:", error);
    res.status(500).json({ error: "Failed to fetch scope grants" });
  }
});

router.put("/scope-grants/partner/:partnerId", requireUser, async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { scopes } = req.body;
    if (!scopes || !Array.isArray(scopes)) {
      return res.status(400).json({ error: "scopes array is required" });
    }

    const results = await storage.bulkUpdateFhirApiScopeGrants(userId, req.params.partnerId, scopes);
    console.log(`[HIPAA-AUDIT][FHIRDataHub] Scope grants updated: user=${userId}, partner=${req.params.partnerId}, count=${scopes.length}`);
    res.json({ grants: results });
  } catch (error) {
    console.error("[FHIRDataHub] Update scope grants error:", error);
    res.status(500).json({ error: "Failed to update scope grants" });
  }
});

router.get("/Patient", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const auth = await authenticatePartner(req);
    if (!auth) {
      await logFhirApiRequest(null, "unknown", "Patient.search", req, 401, startTime, { errorMessage: "Invalid or missing API key" });
      return res.status(401).json({
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "security", diagnostics: "Invalid or missing API key. Provide a valid Bearer token." }],
      });
    }

    const email = req.query.email as string;
    if (!email) {
      await logFhirApiRequest(auth.partnerId, auth.partnerName, "Patient.search", req, 400, startTime, { errorMessage: "email parameter required" });
      return res.status(400).json({
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "required", diagnostics: "Query parameter 'email' is required." }],
      });
    }

    if (!auth.allowedScopes.includes("patient/Patient.read")) {
      await logFhirApiRequest(auth.partnerId, auth.partnerName, "Patient.search", req, 403, startTime, {
        patientEmail: email,
        errorMessage: "Scope patient/Patient.read not allowed",
      });
      return res.status(403).json({
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "forbidden", diagnostics: "Partner does not have patient/Patient.read scope." }],
      });
    }

    const user = await storage.getUserByEmail(email);
    if (!user) {
      await logFhirApiRequest(auth.partnerId, auth.partnerName, "Patient.search", req, 404, startTime, { patientEmail: email });
      return res.status(404).json({
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "not-found", diagnostics: "No patient found for this email." }],
      });
    }

    const scopeGrants = await storage.getFhirApiScopeGrantsForPatientAndPartner(user.id, auth.partnerId);
    const grantedScopes = scopeGrants.filter(g => g.granted).map(g => g.scope);

    if (!grantedScopes.includes("patient/Patient.read")) {
      await logFhirApiRequest(auth.partnerId, auth.partnerName, "Patient.search", req, 403, startTime, {
        patientEmail: email,
        errorMessage: "Patient has not granted patient/Patient.read scope to this partner",
      });
      return res.status(403).json({
        resourceType: "OperationOutcome",
        issue: [{ severity: "error", code: "forbidden", diagnostics: "Patient has not granted data access to this partner." }],
      });
    }

    const patients = await storage.getPatients(100);
    const matchedPatient = patients.find(
      (p: any) => p.email === email || p.name?.toLowerCase().includes(user.firstName?.toLowerCase() || "")
    );

    const patientResource: any = {
      resourceType: "Patient",
      id: matchedPatient?.id || user.id,
      meta: { lastUpdated: new Date().toISOString() },
      name: [{ use: "official", family: user.lastName || "Unknown", given: [user.firstName || "Unknown"] }],
      telecom: [{ system: "email", value: email }],
      gender: "unknown",
      birthDate: "1900-01-01",
    };

    const bundleEntries: any[] = [{ resource: patientResource, search: { mode: "match" } }];

    const resourceTypeMap: Record<string, string> = {
      "patient/Observation.read": "Observation",
      "patient/Condition.read": "Condition",
      "patient/MedicationRequest.read": "MedicationRequest",
      "patient/Immunization.read": "Immunization",
      "patient/AllergyIntolerance.read": "AllergyIntolerance",
      "patient/Encounter.read": "Encounter",
      "patient/Procedure.read": "Procedure",
      "patient/DiagnosticReport.read": "DiagnosticReport",
      "patient/CarePlan.read": "CarePlan",
      "patient/CareTeam.read": "CareTeam",
      "patient/Coverage.read": "Coverage",
      "patient/DocumentReference.read": "DocumentReference",
      "patient/Claim.read": "Claim",
      "patient/ExplanationOfBenefit.read": "ExplanationOfBenefit",
    };

    for (const scope of grantedScopes) {
      const resourceType = resourceTypeMap[scope];
      if (!resourceType || !auth.allowedScopes.includes(scope)) continue;

      const sampleResources = generateSampleResources(resourceType, patientResource.id);
      for (const resource of sampleResources) {
        bundleEntries.push({ resource, search: { mode: "include" } });
      }
    }

    const bundle = {
      resourceType: "Bundle",
      type: "searchset",
      total: bundleEntries.length,
      timestamp: new Date().toISOString(),
      entry: bundleEntries,
    };

    await logFhirApiRequest(auth.partnerId, auth.partnerName, "Patient.search", req, 200, startTime, {
      patientEmail: email,
      resourceType: "Bundle",
      scopesUsed: grantedScopes,
    });

    res.json(bundle);
  } catch (error) {
    console.error("[FHIRDataHub] Patient search error:", error);
    await logFhirApiRequest(null, "unknown", "Patient.search", req, 500, startTime, {
      errorMessage: error instanceof Error ? error.message : "Internal error",
    });
    res.status(500).json({
      resourceType: "OperationOutcome",
      issue: [{ severity: "error", code: "exception", diagnostics: "Internal server error" }],
    });
  }
});

router.get("/audit-logs", requireUser, async (req: Request, res: Response) => {
  try {
    const { partnerId, patientEmail, action, limit, offset } = req.query;
    const logs = await storage.getFhirApiAuditLogs({
      partnerId: partnerId as string,
      patientEmail: patientEmail as string,
      action: action as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });
    res.json({ logs });
  } catch (error) {
    console.error("[FHIRDataHub] Get audit logs error:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

router.get("/audit-stats", requireUser, async (req: Request, res: Response) => {
  try {
    const stats = await storage.getFhirApiAuditStats();
    res.json(stats);
  } catch (error) {
    console.error("[FHIRDataHub] Get audit stats error:", error);
    res.status(500).json({ error: "Failed to fetch audit stats" });
  }
});

router.get("/available-scopes", async (_req: Request, res: Response) => {
  const scopeDescriptions = FHIR_API_SCOPES.map(scope => {
    const parts = scope.split("/");
    const [resource, permission] = parts[1].split(".");
    return {
      scope,
      resource,
      permission,
      description: `Read access to ${resource} resources`,
      category: categorizeScope(resource),
    };
  });
  res.json({ scopes: scopeDescriptions });
});

function categorizeScope(resource: string): string {
  const categories: Record<string, string> = {
    Patient: "Demographics",
    Observation: "Clinical Data",
    Condition: "Clinical Data",
    MedicationRequest: "Medications",
    Procedure: "Clinical Data",
    Immunization: "Preventive Care",
    AllergyIntolerance: "Clinical Data",
    DiagnosticReport: "Lab Results",
    Encounter: "Visits",
    DocumentReference: "Documents",
    CarePlan: "Care Planning",
    CareTeam: "Care Planning",
    Coverage: "Insurance",
    Claim: "Billing",
    ExplanationOfBenefit: "Billing",
  };
  return categories[resource] || "Other";
}

function generateSampleResources(resourceType: string, patientId: string): any[] {
  const now = new Date().toISOString();
  switch (resourceType) {
    case "Observation":
      return [
        {
          resourceType: "Observation",
          id: `obs-${patientId}-bp`,
          status: "final",
          category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }],
          code: { coding: [{ system: "http://loinc.org", code: "85354-9", display: "Blood pressure panel" }] },
          subject: { reference: `Patient/${patientId}` },
          effectiveDateTime: now,
          component: [
            { code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic BP" }] }, valueQuantity: { value: 120, unit: "mmHg" } },
            { code: { coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic BP" }] }, valueQuantity: { value: 80, unit: "mmHg" } },
          ],
        },
      ];
    case "Condition":
      return [
        {
          resourceType: "Condition",
          id: `cond-${patientId}-1`,
          clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
          code: { coding: [{ system: "http://snomed.info/sct", code: "38341003", display: "Hypertension" }], text: "Hypertension" },
          subject: { reference: `Patient/${patientId}` },
          onsetDateTime: "2023-01-15",
        },
      ];
    case "MedicationRequest":
      return [
        {
          resourceType: "MedicationRequest",
          id: `med-${patientId}-1`,
          status: "active",
          intent: "order",
          medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "197884", display: "Lisinopril 10 MG" }] },
          subject: { reference: `Patient/${patientId}` },
          authoredOn: now,
        },
      ];
    case "Immunization":
      return [
        {
          resourceType: "Immunization",
          id: `imm-${patientId}-1`,
          status: "completed",
          vaccineCode: { coding: [{ system: "http://hl7.org/fhir/sid/cvx", code: "213", display: "SARS-COV-2 mRNA" }] },
          patient: { reference: `Patient/${patientId}` },
          occurrenceDateTime: "2024-10-01",
        },
      ];
    default:
      return [
        {
          resourceType,
          id: `${resourceType.toLowerCase()}-${patientId}-1`,
          subject: { reference: `Patient/${patientId}` },
          meta: { lastUpdated: now },
        },
      ];
  }
}

export function registerFhirDataHubRoutes(app: any): void {
  app.use("/api/fhir-data-hub", router);
}
