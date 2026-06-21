import type { Express, Request, Response, RequestHandler } from "express";
import { randomUUID } from "crypto";
import { tefcaFrameworkService, type QHINIdentifier } from "./services/tefca-framework-service";

const VALID_USCDI_VERSIONS = ["R4", "R4B", "R5", "USCDI v1", "USCDI v2", "USCDI v3"];
const VALID_CAPABILITIES = ["treatment", "individual_access", "payment", "healthcare_operations", "public_health", "government_benefits"];

interface TefcaAuditLog {
  id: string;
  timestamp: string;
  operationType: "query" | "push" | "subscribe";
  partnerId: string;
  partnerName: string;
  dataElements: string[];
  status: "success" | "error" | "timeout" | "partial";
  requestId: string;
  responseTimeMs: number;
  documentsCount: number;
  patientMatchCount: number;
  errorMessage?: string;
  initiatedBy: string;
  purposeOfUse: string;
}

let auditLogs: TefcaAuditLog[] = [];

function generateAuditLogs(): void {
  if (auditLogs.length > 0) return;

  const operationTypes: TefcaAuditLog["operationType"][] = ["query", "push", "subscribe"];
  const statuses: TefcaAuditLog["status"][] = ["success", "error", "timeout", "partial"];
  const statusWeights = [0.7, 0.1, 0.05, 0.15];
  const purposes = ["Treatment", "Individual Access", "Payment", "Healthcare Operations", "Public Health", "Government Benefits"];
  const initiators = ["Dr. Sarah Chen", "Dr. James Wilson", "System Scheduler", "Dr. Maria Lopez", "Admin Portal", "Dr. Robert Kim", "Nurse Johnson", "Dr. Emily Park"];
  const dataElementSets = [
    ["Patient Demographics", "Allergies", "Medications"],
    ["Lab Results", "Vital Signs"],
    ["Clinical Notes", "Discharge Summary", "Progress Notes"],
    ["Immunization Records"],
    ["Insurance Information", "Claims Data"],
    ["Radiology Reports", "Imaging Studies"],
    ["Care Plans", "Goals"],
    ["Procedures", "Surgical History"],
    ["Problem List", "Conditions", "Diagnoses"],
    ["Social History", "Family History"],
  ];
  const errorMessages = [
    "Connection timeout exceeded 5000ms",
    "Authentication token expired",
    "Rate limit exceeded for partner endpoint",
    "Invalid patient demographics format",
    "Service temporarily unavailable",
    "Certificate validation failed",
    "FHIR resource validation error",
    "Network connectivity issue",
  ];

  const partners = tefcaFrameworkService.getQHINConnections();

  for (let i = 0; i < 60; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const hoursAgo = Math.floor(Math.random() * 24);
    const minutesAgo = Math.floor(Math.random() * 60);
    const timestamp = new Date(Date.now() - daysAgo * 86400000 - hoursAgo * 3600000 - minutesAgo * 60000);

    const partner = partners[Math.floor(Math.random() * partners.length)];
    const opType = operationTypes[Math.floor(Math.random() * operationTypes.length)];

    const rand = Math.random();
    let cumulative = 0;
    let statusIdx = 0;
    for (let s = 0; s < statusWeights.length; s++) {
      cumulative += statusWeights[s];
      if (rand <= cumulative) { statusIdx = s; break; }
    }
    const status = statuses[statusIdx];

    const responseTime = status === "timeout"
      ? 5000 + Math.floor(Math.random() * 3000)
      : 50 + Math.floor(Math.random() * 450);

    const docsCount = status === "error" ? 0 : status === "timeout" ? 0 : 1 + Math.floor(Math.random() * 12);
    const matchCount = status === "error" ? 0 : status === "timeout" ? 0 : 1 + Math.floor(Math.random() * 3);

    const entry: TefcaAuditLog = {
      id: randomUUID(),
      timestamp: timestamp.toISOString(),
      operationType: opType,
      partnerId: partner.qhinId,
      partnerName: partner.name,
      dataElements: dataElementSets[Math.floor(Math.random() * dataElementSets.length)],
      status,
      requestId: `req_${randomUUID().substring(0, 8)}`,
      responseTimeMs: responseTime,
      documentsCount: docsCount,
      patientMatchCount: matchCount,
      errorMessage: status === "error" || status === "timeout"
        ? errorMessages[Math.floor(Math.random() * errorMessages.length)]
        : undefined,
      initiatedBy: initiators[Math.floor(Math.random() * initiators.length)],
      purposeOfUse: purposes[Math.floor(Math.random() * purposes.length)],
    };

    auditLogs.push(entry);
  }

  auditLogs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function registerTefcaRoutes(app: Express) {
  tefcaFrameworkService.seedSampleExchangeHistory();
  generateAuditLogs();

  app.get("/api/tefca/partners", ((req: Request, res: Response) => {
    const metrics = tefcaFrameworkService.getPartnerMetrics();
    return res.json(metrics);
  }) as RequestHandler);

  app.post("/api/tefca/partners", ((req: Request, res: Response) => {
    try {
      const { partnerId, name, endpointUrl, supportedUscdiVersions, capabilities } = req.body;

      if (!partnerId || !name || !endpointUrl || !supportedUscdiVersions?.length) {
        return res.status(400).json({
          error: "Missing required fields: partnerId, name, endpointUrl, supportedUscdiVersions",
        });
      }

      if (!/^[a-z0-9_]+$/.test(partnerId)) {
        return res.status(400).json({
          error: "Partner ID must contain only lowercase letters, numbers, and underscores",
        });
      }

      try {
        const parsed = new URL(endpointUrl);
        if (!["https:", "http:"].includes(parsed.protocol)) {
          return res.status(400).json({ error: "Only HTTP/HTTPS URLs are allowed" });
        }
      } catch {
        return res.status(400).json({ error: "Invalid endpoint URL format" });
      }

      const invalidVersions = supportedUscdiVersions.filter((v: string) => !VALID_USCDI_VERSIONS.includes(v));
      if (invalidVersions.length > 0) {
        return res.status(400).json({ error: `Invalid USCDI versions: ${invalidVersions.join(", ")}. Valid: ${VALID_USCDI_VERSIONS.join(", ")}` });
      }

      if (capabilities && Array.isArray(capabilities)) {
        const invalidCaps = capabilities.filter((c: string) => !VALID_CAPABILITIES.includes(c));
        if (invalidCaps.length > 0) {
          return res.status(400).json({ error: `Invalid capabilities: ${invalidCaps.join(", ")}. Valid: ${VALID_CAPABILITIES.join(", ")}` });
        }
      }

      const connection = tefcaFrameworkService.registerPartner({
        partnerId,
        name,
        endpointUrl,
        supportedUscdiVersions,
        capabilities,
      });

      return res.status(201).json(connection);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      return res.status(409).json({ error: message });
    }
  }) as RequestHandler);

  app.post("/api/tefca/partners/:partnerId/test", (async (req: Request, res: Response) => {
    try {
      const result = await tefcaFrameworkService.testPartnerConnection(req.params.partnerId);
      return res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Test failed";
      return res.status(404).json({ error: message });
    }
  }) as RequestHandler);

  app.patch("/api/tefca/partners/:partnerId/toggle", ((req: Request, res: Response) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "Field 'enabled' (boolean) is required" });
      }
      const connection = tefcaFrameworkService.togglePartnerStatus(req.params.partnerId, enabled);
      return res.json(connection);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Toggle failed";
      return res.status(404).json({ error: message });
    }
  }) as RequestHandler);

  app.delete("/api/tefca/partners/:partnerId", ((req: Request, res: Response) => {
    try {
      tefcaFrameworkService.deletePartner(req.params.partnerId);
      return res.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      return res.status(404).json({ error: message });
    }
  }) as RequestHandler);

  app.get("/api/tefca/partners/:qhinId/logs", ((req: Request, res: Response) => {
    const { qhinId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = tefcaFrameworkService.getPartnerExchangeLogs(qhinId as QHINIdentifier);
    return res.json(logs.slice(0, limit));
  }) as RequestHandler);

  app.get("/api/tefca/exchange-logs", ((req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 100;
    const logs = tefcaFrameworkService.getPartnerExchangeLogs();
    return res.json(logs.slice(0, limit));
  }) as RequestHandler);

  app.get("/api/tefca/errors/summary", ((req: Request, res: Response) => {
    const analytics = tefcaFrameworkService.getErrorAnalytics();
    return res.json(analytics);
  }) as RequestHandler);

  app.get("/api/tefca/statistics", ((req: Request, res: Response) => {
    const stats = tefcaFrameworkService.getTEFCAStatistics();
    return res.json(stats);
  }) as RequestHandler);

  app.get("/api/tefca/audit-logs/stats", ((req: Request, res: Response) => {
    const total = auditLogs.length;
    const successCount = auditLogs.filter(l => l.status === "success").length;
    const successRate = total > 0 ? (successCount / total) * 100 : 0;
    const avgResponseTime = total > 0
      ? Math.round(auditLogs.reduce((sum, l) => sum + l.responseTimeMs, 0) / total)
      : 0;
    const uniquePartners = new Set(auditLogs.map(l => l.partnerId)).size;

    return res.json({
      totalOperations: total,
      successRate: Math.round(successRate * 10) / 10,
      avgResponseTimeMs: avgResponseTime,
      activePartners: uniquePartners,
    });
  }) as RequestHandler);

  app.get("/api/tefca/audit-logs", ((req: Request, res: Response) => {
    const { from, to, partner, status, operation } = req.query;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    let filtered = [...auditLogs];

    if (from) {
      const fromDate = new Date(from as string);
      if (!isNaN(fromDate.getTime())) {
        filtered = filtered.filter(l => new Date(l.timestamp) >= fromDate);
      }
    }
    if (to) {
      const toDate = new Date(to as string);
      if (!isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        filtered = filtered.filter(l => new Date(l.timestamp) <= toDate);
      }
    }
    if (partner && partner !== "all") {
      filtered = filtered.filter(l => l.partnerId === partner);
    }
    if (status && status !== "all") {
      filtered = filtered.filter(l => l.status === status);
    }
    if (operation && operation !== "all") {
      filtered = filtered.filter(l => l.operationType === operation);
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return res.json({
      logs: paginated,
      total,
      limit,
      offset,
    });
  }) as RequestHandler);

  console.log("[Routes] TEFCA Hub routes registered at /api/tefca/*");
}
