import { Request, Response, NextFunction, RequestHandler } from "express";
import { fhirAuditService, FhirAuditAction, FhirAuditOutcome } from "../services/fhir-audit-service";

interface FhirAuditOptions {
  resourceType?: string;
  action?: FhirAuditAction;
  operationType?: string;
  extractResourceId?: (req: Request) => string | undefined;
  extractPatientId?: (req: Request) => string | undefined;
  extractFhirVersion?: (req: Request) => "R4" | "R5";
  phiAccessed?: boolean;
}

function determineAction(method: string): FhirAuditAction {
  switch (method.toUpperCase()) {
    case "POST":
      return "create";
    case "PUT":
    case "PATCH":
      return "update";
    case "DELETE":
      return "delete";
    case "GET":
    default:
      return "read";
  }
}

function determineResourceType(path: string): string {
  const resourceMatch = path.match(/\/fhir\/([A-Z][a-zA-Z]+)/);
  if (resourceMatch) {
    return resourceMatch[1];
  }
  
  const patterns: Record<string, string> = {
    "/patient": "Patient",
    "/observation": "Observation",
    "/condition": "Condition",
    "/medication": "Medication",
    "/procedure": "Procedure",
    "/encounter": "Encounter",
    "/diagnostic": "DiagnosticReport",
    "/allergyintolerance": "AllergyIntolerance",
    "/immunization": "Immunization",
    "/careplan": "CarePlan",
    "/goal": "Goal",
  };

  const lowerPath = path.toLowerCase();
  for (const [pattern, resourceType] of Object.entries(patterns)) {
    if (lowerPath.includes(pattern)) {
      return resourceType;
    }
  }

  return "Unknown";
}

function extractIdFromPath(path: string): string | undefined {
  const idMatch = path.match(/\/([a-zA-Z0-9-]+)(?:\?|$)/);
  return idMatch?.[1];
}

export function createFhirAuditMiddleware(options: FhirAuditOptions = {}): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    
    const user = req.user as { claims?: { sub?: string; email?: string }; id?: string; role?: string } | undefined;
    const userId = user?.claims?.sub || user?.id || "anonymous";
    const userRole = (req as any).userRole || user?.role || "patient";
    
    const resourceType = options.resourceType || determineResourceType(req.path);
    const action = options.action || determineAction(req.method);
    const resourceId = options.extractResourceId?.(req) || req.params.id || extractIdFromPath(req.path);
    const patientId = options.extractPatientId?.(req) || req.params.patientId || (req.query.patient as string);
    const fhirVersion = options.extractFhirVersion?.(req) || "R4";
    const operationType = options.operationType || `${action}${resourceType}`;
    
    const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || 
                      req.socket?.remoteAddress || 
                      "unknown";
    const userAgent = req.headers["user-agent"] || "unknown";
    const accessReason = req.headers["x-access-reason"] as string | undefined;

    const originalSend = res.send.bind(res);
    let responseSent = false;

    res.send = function(body: any) {
      if (!responseSent) {
        responseSent = true;
        const responseTime = Date.now() - startTime;
        
        let outcome: FhirAuditOutcome = "success";
        if (res.statusCode >= 400 && res.statusCode < 500) {
          outcome = "failure";
        } else if (res.statusCode >= 500) {
          outcome = "failure";
        }

        let errorMessage: string | undefined;
        if (outcome === "failure") {
          try {
            const parsed = typeof body === "string" ? JSON.parse(body) : body;
            errorMessage = parsed?.error || parsed?.message || `HTTP ${res.statusCode}`;
          } catch {
            errorMessage = `HTTP ${res.statusCode}`;
          }
        }

        fhirAuditService.log({
          userId,
          userRole,
          action,
          outcome,
          resourceType,
          resourceId,
          patientId,
          fhirVersion,
          operationType,
          ipAddress,
          userAgent,
          requestPath: req.path,
          requestMethod: req.method,
          queryParameters: req.query as Record<string, string>,
          responseStatus: res.statusCode,
          responseTimeMs: responseTime,
          errorMessage,
          phiAccessed: options.phiAccessed !== false,
          accessReason,
        }).catch((err) => {
          console.error("[FhirAuditMiddleware] Error logging audit:", err);
        });
      }

      return originalSend(body);
    };

    next();
  };
}

export function logFhirOperation(params: {
  userId: string;
  userRole?: string;
  action: FhirAuditAction;
  outcome: FhirAuditOutcome;
  resourceType: string;
  resourceId?: string;
  patientId?: string;
  fhirVersion?: "R4" | "R5";
  operationType: string;
  ipAddress?: string;
  userAgent?: string;
  requestPath?: string;
  requestMethod?: string;
  responseStatus?: number;
  responseTimeMs?: number;
  errorMessage?: string;
  phiAccessed?: boolean;
  accessReason?: string;
  bundleSize?: number;
  affectedResources?: string[];
  sourceSystem?: string;
  targetSystem?: string;
}): void {
  fhirAuditService.log({
    userId: params.userId,
    userRole: params.userRole || "unknown",
    action: params.action,
    outcome: params.outcome,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    patientId: params.patientId,
    fhirVersion: params.fhirVersion || "R4",
    operationType: params.operationType,
    ipAddress: params.ipAddress || "unknown",
    userAgent: params.userAgent || "unknown",
    requestPath: params.requestPath || "",
    requestMethod: params.requestMethod || "",
    responseStatus: params.responseStatus || 200,
    responseTimeMs: params.responseTimeMs || 0,
    errorMessage: params.errorMessage,
    phiAccessed: params.phiAccessed !== false,
    accessReason: params.accessReason,
    bundleSize: params.bundleSize,
    affectedResources: params.affectedResources,
    sourceSystem: params.sourceSystem,
    targetSystem: params.targetSystem,
  }).catch((err) => {
    console.error("[FhirAuditMiddleware] Error logging operation:", err);
  });
}

export const fhirAuditMiddleware = createFhirAuditMiddleware();
