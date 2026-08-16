import { Router, Request, Response } from "express";
import { createCipheriv, randomBytes, createHash } from "crypto";
import PDFDocument from "pdfkit";
import { tefcaFrameworkService, type QHINIdentifier } from "./services/tefca-framework-service";
import { comprehensiveAuditTrailService, type AuditLogFilter } from "./services/comprehensive-audit-trail-service";
import { extractUserContext, requireRole, type AuthorizedRequest } from "./middleware/rbac-authorization";
import { logPhiAccess } from "./security/hipaa-audit";
import { requireUser, getUserId } from "./middleware/require-user";

const router = Router();
router.use(requireUser);
router.use(extractUserContext);

function deriveKey(password: string): Buffer {
  return createHash("sha256").update(password).digest();
}

function encryptBuffer(data: Buffer, password: string): { encrypted: Buffer; iv: string } {
  const key = deriveKey(password);
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return { encrypted, iv: iv.toString("hex") };
}

function maskPHI(value: string | undefined | null, visibleChars = 4): string {
  if (!value) return "N/A";
  if (value.length <= visibleChars) return "***";
  return "***" + value.slice(-visibleChars);
}

function sanitizeForCSV(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateTefcaCSV(logs: any[]): string {
  const headers = [
    "Timestamp", "Operation", "Partner", "Purpose of Use", "Status",
    "Response Time (ms)", "Documents", "Patient Matches", "Initiated By",
    "Data Elements", "Error"
  ];

  const rows = logs.map(log => [
    sanitizeForCSV(log.timestamp),
    sanitizeForCSV(log.operationType),
    sanitizeForCSV(log.partnerName),
    sanitizeForCSV(log.purposeOfUse),
    sanitizeForCSV(log.status),
    sanitizeForCSV(log.responseTimeMs),
    sanitizeForCSV(log.documentsCount),
    sanitizeForCSV(log.patientMatchCount),
    sanitizeForCSV(log.initiatedBy),
    sanitizeForCSV(Array.isArray(log.dataElements) ? log.dataElements.join("; ") : ""),
    sanitizeForCSV(log.errorMessage || "")
  ]);

  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}

function generateAuditCSV(entries: any[]): string {
  const headers = [
    "Timestamp", "User ID", "User Role", "Category", "Action",
    "Resource Type", "Resource ID", "Description", "Severity",
    "Success", "PHI Accessed", "Tags", "Duration (ms)"
  ];

  const rows = entries.map(entry => [
    sanitizeForCSV(entry.when?.timestamp || entry.timestamp),
    sanitizeForCSV(maskPHI(entry.who?.userId || entry.userId)),
    sanitizeForCSV(entry.who?.userRole || entry.userRole || ""),
    sanitizeForCSV(entry.what?.category || entry.category || ""),
    sanitizeForCSV(entry.what?.action || entry.action || ""),
    sanitizeForCSV(entry.what?.resourceType || entry.resourceType || ""),
    sanitizeForCSV(maskPHI(entry.what?.resourceId || entry.resourceId)),
    sanitizeForCSV(entry.what?.description || entry.description || ""),
    sanitizeForCSV(entry.severity || ""),
    sanitizeForCSV(entry.result?.success !== undefined ? entry.result.success : ""),
    sanitizeForCSV(entry.phiAccessed ? "Yes" : "No"),
    sanitizeForCSV(Array.isArray(entry.tags) ? entry.tags.join("; ") : ""),
    sanitizeForCSV(entry.result?.duration_ms || "")
  ]);

  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}

async function generateTefcaPDF(logs: any[], stats: any, dateRange: { from?: string; to?: string }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).font("Helvetica-Bold").text("TEFCA Exchange Compliance Report", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica").fillColor("#666666")
      .text("CONFIDENTIAL — Contains Protected Health Information (PHI)", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(9).text(`Generated: ${new Date().toISOString()}`, { align: "center" });
    if (dateRange.from || dateRange.to) {
      doc.text(`Date Range: ${dateRange.from || "Start"} to ${dateRange.to || "Present"}`, { align: "center" });
    }
    doc.moveDown(0.5);

    doc.fillColor("#000000").fontSize(8).font("Helvetica")
      .text("NOTICE: This document contains PHI subject to HIPAA Privacy Rule (45 CFR § 164.502). "
        + "Unauthorized disclosure is prohibited. Patient identifiers have been masked per Minimum Necessary Standard. "
        + "Handle, store, and dispose of this document according to your organization's information security policies.", {
        align: "left", width: 500
      });
    doc.moveDown(1);

    doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke("#cccccc");
    doc.moveDown(0.5);

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a1a1a").text("Exchange Summary");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").fillColor("#333333");
    doc.text(`Total Operations: ${stats.totalOperations || logs.length}`);
    doc.text(`Success Rate: ${stats.successRate || 0}%`);
    doc.text(`Average Response Time: ${stats.avgResponseTimeMs || 0}ms`);
    doc.text(`Active QHIN Partners: ${stats.activePartners || 0}`);
    doc.moveDown(1);

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a1a1a").text("Exchange Log Details");
    doc.moveDown(0.5);

    const maxEntries = Math.min(logs.length, 100);
    for (let i = 0; i < maxEntries; i++) {
      const log = logs[i];
      if (doc.y > 680) {
        doc.addPage();
        doc.fontSize(8).font("Helvetica").fillColor("#999999")
          .text("TEFCA Exchange Compliance Report (continued)", { align: "center" });
        doc.moveDown(0.5);
      }

      const statusColor = log.status === "success" ? "#16a34a" : log.status === "error" ? "#dc2626" : "#ca8a04";
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#1a1a1a")
        .text(`#${i + 1} — ${log.operationType?.toUpperCase() || "UNKNOWN"} via ${log.partnerName || "Unknown Partner"}`, { continued: true });
      doc.font("Helvetica").fillColor(statusColor).text(`  [${(log.status || "unknown").toUpperCase()}]`);

      doc.fontSize(8).font("Helvetica").fillColor("#555555");
      doc.text(`  Time: ${log.timestamp || "N/A"}  |  Response: ${log.responseTimeMs || 0}ms  |  Docs: ${log.documentsCount || 0}  |  Matches: ${log.patientMatchCount || 0}`);
      doc.text(`  Purpose: ${log.purposeOfUse || "N/A"}  |  Initiated by: ${log.initiatedBy || "N/A"}`);
      if (log.dataElements?.length) {
        doc.text(`  Data Elements: ${log.dataElements.join(", ")}`);
      }
      if (log.errorMessage) {
        doc.fillColor("#dc2626").text(`  Error: ${log.errorMessage}`);
      }
      doc.moveDown(0.4);
    }

    if (logs.length > maxEntries) {
      doc.fontSize(9).font("Helvetica").fillColor("#666666")
        .text(`... and ${logs.length - maxEntries} additional entries (truncated for report size)`);
    }

    doc.addPage();
    doc.fontSize(8).font("Helvetica").fillColor("#999999")
      .text(`Report ID: RPT-${randomBytes(8).toString("hex").toUpperCase()}`, { align: "center" });
    doc.text("End of TEFCA Compliance Report", { align: "center" });

    doc.end();
  });
}

async function generateAuditPDF(entries: any[], dateRange: { from?: string; to?: string }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).font("Helvetica-Bold").text("System Audit Log Compliance Report", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica").fillColor("#666666")
      .text("CONFIDENTIAL — Contains Protected Health Information (PHI)", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(9).text(`Generated: ${new Date().toISOString()}`, { align: "center" });
    if (dateRange.from || dateRange.to) {
      doc.text(`Date Range: ${dateRange.from || "Start"} to ${dateRange.to || "Present"}`, { align: "center" });
    }
    doc.moveDown(0.5);

    doc.fillColor("#000000").fontSize(8).font("Helvetica")
      .text("NOTICE: This document contains PHI subject to HIPAA Privacy Rule (45 CFR § 164.502). "
        + "User identifiers have been masked per Minimum Necessary Standard. "
        + "This audit trail is maintained per HIPAA § 164.312(b) and SOC 2 CC7.2 requirements.", {
        align: "left", width: 500
      });
    doc.moveDown(1);

    doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke("#cccccc");
    doc.moveDown(0.5);

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a1a1a").text("Audit Summary");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica").fillColor("#333333");
    doc.text(`Total Log Entries: ${entries.length}`);
    const phiCount = entries.filter(e => e.phiAccessed).length;
    doc.text(`PHI Access Events: ${phiCount}`);
    const errorCount = entries.filter(e => e.severity === "error" || e.severity === "critical").length;
    doc.text(`Error/Critical Events: ${errorCount}`);
    const uniqueUsers = new Set(entries.map(e => e.who?.userId || e.userId || "unknown")).size;
    doc.text(`Unique Users: ${uniqueUsers}`);
    doc.moveDown(1);

    const severityCounts: Record<string, number> = {};
    entries.forEach(e => {
      const s = e.severity || "info";
      severityCounts[s] = (severityCounts[s] || 0) + 1;
    });
    doc.fontSize(12).font("Helvetica-Bold").fillColor("#1a1a1a").text("Severity Breakdown");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#333333");
    Object.entries(severityCounts).forEach(([sev, count]) => {
      doc.text(`  ${sev.charAt(0).toUpperCase() + sev.slice(1)}: ${count}`);
    });
    doc.moveDown(1);

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a1a1a").text("Audit Log Details");
    doc.moveDown(0.5);

    const maxEntries = Math.min(entries.length, 150);
    for (let i = 0; i < maxEntries; i++) {
      const entry = entries[i];
      if (doc.y > 680) {
        doc.addPage();
        doc.fontSize(8).font("Helvetica").fillColor("#999999")
          .text("System Audit Log Compliance Report (continued)", { align: "center" });
        doc.moveDown(0.5);
      }

      const sev = entry.severity || "info";
      const sevColor = sev === "critical" ? "#991b1b" : sev === "error" ? "#dc2626" : sev === "warning" ? "#ca8a04" : "#333333";
      const category = entry.what?.category || entry.category || "system_event";
      const action = entry.what?.action || entry.action || "unknown";

      doc.fontSize(9).font("Helvetica-Bold").fillColor("#1a1a1a")
        .text(`#${i + 1} — [${sev.toUpperCase()}] ${category}/${action}`, { continued: true });
      doc.font("Helvetica").fillColor(sevColor)
        .text(entry.result?.success === false ? "  FAILED" : "");

      doc.fontSize(8).font("Helvetica").fillColor("#555555");
      const ts = entry.when?.timestamp || entry.timestamp || "N/A";
      doc.text(`  Time: ${ts}  |  User: ${maskPHI(entry.who?.userId || entry.userId)}  |  Role: ${entry.who?.userRole || "N/A"}`);

      const desc = entry.what?.description || entry.description || "";
      if (desc) doc.text(`  Description: ${desc}`);
      const resType = entry.what?.resourceType || entry.resourceType || "";
      if (resType) doc.text(`  Resource: ${resType} / ${maskPHI(entry.what?.resourceId || entry.resourceId)}`);
      if (entry.phiAccessed) doc.fillColor("#b45309").text("  ⚠ PHI Accessed");
      if (entry.result?.errorMessage) doc.fillColor("#dc2626").text(`  Error: ${entry.result.errorMessage}`);
      doc.moveDown(0.4);
    }

    if (entries.length > maxEntries) {
      doc.fontSize(9).font("Helvetica").fillColor("#666666")
        .text(`... and ${entries.length - maxEntries} additional entries (truncated for report size)`);
    }

    doc.addPage();
    doc.fontSize(8).font("Helvetica").fillColor("#999999")
      .text(`Report ID: RPT-${randomBytes(8).toString("hex").toUpperCase()}`, { align: "center" });
    doc.text("End of System Audit Compliance Report", { align: "center" });

    doc.end();
  });
}

router.post("/tefca", requireRole("administrator", "auditor", "compliance_officer"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const { format, password, dateFrom, dateTo, partner, status, operation } = req.body;

    if (!format || !["pdf", "csv"].includes(format)) {
      return res.status(400).json({ error: "Format must be 'pdf' or 'csv'" });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Encryption password must be at least 8 characters" });
    }

    logPhiAccess({
      action: "export",
      userId: getUserId(req),
      resourceType: "TEFCAExchangeData",
      details: `COMPLIANCE_EXPORT_TEFCA format=${format} dateFrom=${dateFrom || "all"} dateTo=${dateTo || "all"}`,
    });

    let logs = tefcaFrameworkService.getPartnerExchangeLogs();

    if (dateFrom) {
      const from = new Date(dateFrom);
      if (!isNaN(from.getTime())) {
        logs = logs.filter(l => new Date(l.timestamp) >= from);
      }
    }
    if (dateTo) {
      const to = new Date(dateTo);
      if (!isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        logs = logs.filter(l => new Date(l.timestamp) <= to);
      }
    }
    if (partner && partner !== "all") {
      logs = logs.filter(l => l.qhinId === partner);
    }
    if (status && status !== "all") {
      logs = logs.filter(l => l.status === status);
    }

    const stats = tefcaFrameworkService.getTEFCAStatistics();

    let rawBuffer: Buffer;
    let mimeBase: string;
    let fileExt: string;

    if (format === "pdf") {
      rawBuffer = await generateTefcaPDF(logs, stats, { from: dateFrom, to: dateTo });
      mimeBase = "application/pdf";
      fileExt = "pdf";
    } else {
      rawBuffer = Buffer.from(generateTefcaCSV(logs), "utf-8");
      mimeBase = "text/csv";
      fileExt = "csv";
    }

    const { encrypted, iv } = encryptBuffer(rawBuffer, password);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `tefca-compliance-export-${timestamp}.${fileExt}.enc`;

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Encryption-Algorithm", "AES-256-CBC");
    res.setHeader("X-Encryption-IV", iv);
    res.setHeader("X-Original-Content-Type", mimeBase);
    res.setHeader("X-Original-Extension", fileExt);
    res.setHeader("X-Record-Count", String(logs.length));
    res.send(encrypted);
  } catch (error) {
    console.error("[ComplianceExport] TEFCA export error:", error);
    res.status(500).json({ error: "Failed to generate TEFCA compliance export" });
  }
});

router.post("/audit-logs", requireRole("administrator", "auditor", "compliance_officer"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const { format, password, dateFrom, dateTo, category, severity, userId: filterUserId, phiOnly } = req.body;

    if (!format || !["pdf", "csv"].includes(format)) {
      return res.status(400).json({ error: "Format must be 'pdf' or 'csv'" });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Encryption password must be at least 8 characters" });
    }

    logPhiAccess({
      action: "export",
      userId: getUserId(req),
      resourceType: "SystemAuditLogs",
      details: `COMPLIANCE_EXPORT_AUDIT format=${format} dateFrom=${dateFrom || "all"} dateTo=${dateTo || "all"} severity=${severity || "all"}`,
    });

    const filter: AuditLogFilter = {
      startDate: dateFrom,
      endDate: dateTo,
      category,
      severity,
      userId: filterUserId,
      phiAccessed: phiOnly ? true : undefined,
      limit: 5000,
      sortBy: "timestamp",
      sortOrder: "desc",
    };

    const result = await comprehensiveAuditTrailService.getAuditLogs(getUserId(req), filter);
    const entries = result.logs || [];

    let rawBuffer: Buffer;
    let mimeBase: string;
    let fileExt: string;

    if (format === "pdf") {
      rawBuffer = await generateAuditPDF(entries, { from: dateFrom, to: dateTo });
      mimeBase = "application/pdf";
      fileExt = "pdf";
    } else {
      rawBuffer = Buffer.from(generateAuditCSV(entries), "utf-8");
      mimeBase = "text/csv";
      fileExt = "csv";
    }

    const { encrypted, iv } = encryptBuffer(rawBuffer, password);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `audit-log-compliance-export-${timestamp}.${fileExt}.enc`;

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Encryption-Algorithm", "AES-256-CBC");
    res.setHeader("X-Encryption-IV", iv);
    res.setHeader("X-Original-Content-Type", mimeBase);
    res.setHeader("X-Original-Extension", fileExt);
    res.setHeader("X-Record-Count", String(entries.length));
    res.send(encrypted);
  } catch (error) {
    console.error("[ComplianceExport] Audit log export error:", error);
    res.status(500).json({ error: "Failed to generate audit log compliance export" });
  }
});

router.get("/preview/tefca", requireRole("administrator", "auditor", "compliance_officer"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const logs = tefcaFrameworkService.getPartnerExchangeLogs();
    const stats = tefcaFrameworkService.getTEFCAStatistics();
    const partners = tefcaFrameworkService.getPartnerMetrics();

    res.json({
      recordCount: logs.length,
      dateRange: logs.length > 0
        ? { earliest: logs[logs.length - 1]?.timestamp, latest: logs[0]?.timestamp }
        : null,
      statistics: stats,
      partnerCount: partners.length,
      statusBreakdown: {
        success: logs.filter(l => l.status === "success").length,
        error: logs.filter(l => l.status === "error").length,
        partial: logs.filter(l => l.status === "partial").length,
        timeout: logs.filter(l => l.status === "timeout").length,
      },
    });
  } catch (error) {
    console.error("[ComplianceExport] TEFCA preview error:", error);
    res.status(500).json({ error: "Failed to preview TEFCA data" });
  }
});

router.get("/preview/audit-logs", requireRole("administrator", "auditor", "compliance_officer"), async (req: AuthorizedRequest, res: Response) => {
  try {
    const result = await comprehensiveAuditTrailService.getAuditLogs(getUserId(req), { limit: 5000 });
    const entries = result.logs || [];

    const severityCounts: Record<string, number> = {};
    const categoryCounts: Record<string, number> = {};
    let phiCount = 0;

    entries.forEach(entry => {
      const s = entry.severity || "info";
      severityCounts[s] = (severityCounts[s] || 0) + 1;
      const c = entry.what?.category || "unknown";
      categoryCounts[c] = (categoryCounts[c] || 0) + 1;
      if (entry.phiAccessed) phiCount++;
    });

    res.json({
      recordCount: entries.length,
      totalAvailable: result.total || entries.length,
      dateRange: entries.length > 0
        ? {
            earliest: entries[entries.length - 1]?.when?.timestamp || entries[entries.length - 1]?.timestamp,
            latest: entries[0]?.when?.timestamp || entries[0]?.timestamp,
          }
        : null,
      severityBreakdown: severityCounts,
      categoryBreakdown: categoryCounts,
      phiAccessCount: phiCount,
    });
  } catch (error) {
    console.error("[ComplianceExport] Audit preview error:", error);
    res.status(500).json({ error: "Failed to preview audit data" });
  }
});

export default router;
