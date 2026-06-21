import type { Express, Request, Response, NextFunction } from "express";
import { fhirR4ApiService } from "./services/fhir-r4-api-service";
import { isAuthenticated } from "./replit_integrations/auth";

function fhirHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Content-Type", "application/fhir+json; charset=utf-8");
  res.setHeader("X-FHIR-Version", "4.0.1");
  next();
}

function trackRequest(req: Request, res: Response, resourceType: string, operation: string) {
  const start = Date.now();
  res.on("finish", () => {
    fhirR4ApiService.logActivity({
      method: req.method,
      resourceType,
      resourceId: req.params.id,
      operation,
      statusCode: res.statusCode,
      responseTimeMs: Date.now() - start,
      clientId: req.headers["x-client-id"] as string,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
  });
}

function validateFhirResource(body: any): string | null {
  if (!body || typeof body !== "object") return "Request body must be a valid JSON object";
  if (!body.resourceType || typeof body.resourceType !== "string") return "Missing or invalid resourceType field";
  if (body.id && typeof body.id !== "string") return "Invalid id field - must be a string";
  return null;
}

function getAuthSubject(req: Request): string | null {
  const user = req.user as { claims?: { sub?: string } } | undefined;
  return user?.claims?.sub || null;
}

function resourceBelongsToSubject(resource: any, resourceType: string, subject: string): boolean {
  if (resourceType === "Patient") {
    return resource.id === subject;
  }
  const ref = resource?.subject?.reference || resource?.patient?.reference;
  return ref === `Patient/${subject}`;
}

export function registerFhirR4ApiRoutes(app: Express) {
  app.get("/api/fhir/r4/metadata", fhirHeaders, (req: Request, res: Response) => {
    trackRequest(req, res, "CapabilityStatement", "metadata");
    const baseUrl = `${req.protocol}://${req.get("host")}/api/fhir/r4`;
    res.json(fhirR4ApiService.getCapabilityStatement(baseUrl));
  });

  app.get("/api/fhir/r4-api/usage", isAuthenticated, (_req: Request, res: Response) => {
    return res.status(403).json(
      fhirR4ApiService.createOperationOutcome("error", "forbidden", "Global usage telemetry is not available to individual users")
    );
  });

  app.get("/api/fhir/r4-api/resources", isAuthenticated, (_req: Request, res: Response) => {
    const supported = fhirR4ApiService.getSupportedResources();
    res.json({ supported });
  });

  app.get("/api/fhir/r4-export", isAuthenticated, fhirHeaders, (req: Request, res: Response) => {
    trackRequest(req, res, "Bundle", "export");

    const subject = getAuthSubject(req);
    if (!subject) {
      return res.status(401).json(
        fhirR4ApiService.createOperationOutcome("error", "security", "Authentication required")
      );
    }

    const resourceTypes = req.query._type
      ? (req.query._type as string).split(",").map(t => t.trim())
      : undefined;

    const bundle = fhirR4ApiService.exportResources(resourceTypes, subject);
    res.json(bundle);
  });

  app.post("/api/fhir/r4-export/patient", isAuthenticated, fhirHeaders, (req: Request, res: Response) => {
    trackRequest(req, res, "Patient", "export");

    const subject = getAuthSubject(req);
    if (!subject) {
      return res.status(401).json(
        fhirR4ApiService.createOperationOutcome("error", "security", "Authentication required")
      );
    }

    const bundle = fhirR4ApiService.exportResources(undefined, subject);
    res.json(bundle);
  });

  app.post("/api/fhir/r4-import/bundle", isAuthenticated, fhirHeaders, (req: Request, res: Response) => {
    trackRequest(req, res, "Bundle", "import");

    const subject = getAuthSubject(req);
    if (!subject) {
      return res.status(401).json(
        fhirR4ApiService.createOperationOutcome("error", "security", "Authentication required")
      );
    }

    const body = req.body;
    if (!body || body.resourceType !== "Bundle") {
      return res.status(400).json(
        fhirR4ApiService.createOperationOutcome("error", "invalid", "Request body must be a FHIR Bundle with resourceType 'Bundle'")
      );
    }

    if (!Array.isArray(body.entry)) {
      return res.status(400).json(
        fhirR4ApiService.createOperationOutcome("error", "invalid", "Bundle must contain an 'entry' array")
      );
    }

    const scopedBody = {
      ...body,
      entry: (body.entry as any[]).map((entry: any) => {
        if (!entry?.resource) return entry;
        const rt = entry.resource.resourceType;
        if (!rt) return entry;
        if (rt === "Patient") {
          return {
            ...entry,
            resource: { ...entry.resource, id: subject },
          };
        }
        return {
          ...entry,
          resource: { ...entry.resource, subject: { reference: `Patient/${subject}` } },
        };
      }),
    };

    const result = fhirR4ApiService.processBundle(scopedBody);
    res.json(result);
  });

  app.get("/api/fhir/r4/:resourceType", isAuthenticated, fhirHeaders, (req: Request, res: Response) => {
    const { resourceType } = req.params;
    trackRequest(req, res, resourceType, "search");

    const subject = getAuthSubject(req);
    if (!subject) {
      return res.status(401).json(
        fhirR4ApiService.createOperationOutcome("error", "security", "Authentication required")
      );
    }

    if (!fhirR4ApiService.isSupportedResource(resourceType)) {
      return res.status(404).json(
        fhirR4ApiService.createOperationOutcome("error", "not-found", `Resource type '${resourceType}' is not supported. Supported types: ${fhirR4ApiService.getSupportedResources().join(", ")}`)
      );
    }

    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== "patient" && key !== "_id" && typeof value === "string") params[key] = value;
    }

    if (resourceType === "Patient") {
      params._id = subject;
    } else {
      params.patient = subject;
    }

    const bundle = fhirR4ApiService.searchResources(resourceType, params);
    res.json(bundle);
  });

  app.get("/api/fhir/r4/:resourceType/:id", isAuthenticated, fhirHeaders, (req: Request, res: Response) => {
    const { resourceType, id } = req.params;
    trackRequest(req, res, resourceType, "read");

    const subject = getAuthSubject(req);
    if (!subject) {
      return res.status(401).json(
        fhirR4ApiService.createOperationOutcome("error", "security", "Authentication required")
      );
    }

    if (!fhirR4ApiService.isSupportedResource(resourceType)) {
      return res.status(404).json(
        fhirR4ApiService.createOperationOutcome("error", "not-found", `Resource type '${resourceType}' is not supported`)
      );
    }

    const resource = fhirR4ApiService.readResource(resourceType, id);
    if (!resource) {
      return res.status(404).json(
        fhirR4ApiService.createOperationOutcome("error", "not-found", `${resourceType}/${id} not found`)
      );
    }

    if (!resourceBelongsToSubject(resource, resourceType, subject)) {
      return res.status(404).json(
        fhirR4ApiService.createOperationOutcome("error", "not-found", `${resourceType}/${id} not found`)
      );
    }

    res.json(resource);
  });

  app.post("/api/fhir/r4/:resourceType", isAuthenticated, fhirHeaders, (req: Request, res: Response) => {
    const { resourceType } = req.params;
    trackRequest(req, res, resourceType, "create");

    const subject = getAuthSubject(req);
    if (!subject) {
      return res.status(401).json(
        fhirR4ApiService.createOperationOutcome("error", "security", "Authentication required")
      );
    }

    if (!fhirR4ApiService.isSupportedResource(resourceType)) {
      return res.status(404).json(
        fhirR4ApiService.createOperationOutcome("error", "not-found", `Resource type '${resourceType}' is not supported`)
      );
    }

    const validationError = validateFhirResource(req.body);
    if (validationError) {
      return res.status(400).json(
        fhirR4ApiService.createOperationOutcome("error", "invalid", validationError)
      );
    }

    if (req.body.resourceType !== resourceType) {
      return res.status(400).json(
        fhirR4ApiService.createOperationOutcome("error", "invalid", `Resource type in body (${req.body.resourceType}) does not match URL (${resourceType})`)
      );
    }

    let resourceBody = { ...req.body };
    if (resourceType === "Patient") {
      resourceBody.id = subject;
    } else {
      resourceBody.subject = { reference: `Patient/${subject}` };
    }

    try {
      const created = fhirR4ApiService.createResource(resourceType, resourceBody);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json(
        fhirR4ApiService.createOperationOutcome("error", "exception", err.message)
      );
    }
  });

  console.log("[FHIR R4 API] Routes registered - USCDI V3 compliant endpoints ready");
}
