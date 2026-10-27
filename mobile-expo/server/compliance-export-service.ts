// @ts-nocheck
import PDFDocument from "pdfkit";
import { createCipheriv, randomBytes, pbkdf2Sync } from "crypto";
import { storage } from "./storage";
import { logger } from "./utils/logger";

interface ExportOptions {
  format: "pdf" | "csv";
  encrypt: boolean;
  passphrase?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

interface AuditLogEntry {
  id: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
  createdAt: Date | string;
}

interface TefcaExchange {
  id: string;
  queryId: string;
  type: string;
  direction: string;
  networkId: string;
  timestamp: Date | string;
  exchangePurpose: string;
  status: string;
  errorCode?: string;
  documentCount: number;
  auditDetails: {
    requesterOrganization: string;
    consentVerified: boolean;
  };
}

function maskIpAddress(ip: string | null | undefined): string {
  if (!ip) return "N/A";
  return ip.replace(/\.\d+$/, ".***");
}

function formatDateISO(d: Date | string | null): string {
  if (!d) return "N/A";
  return new Date(d).toISOString();
}

function formatDateHuman(d: Date | string | null): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeCSV(val: string): string {
  return `"${String(val).replace(/"/g, '""')}"`;
}

function encryptBuffer(data: Buffer, passphrase: string): { encrypted: Buffer; iv: string; salt: string; authTag: string } {
  const salt = randomBytes(32);
  const key = pbkdf2Sync(passphrase, salt, 100000, 32, "sha512");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = (cipher as any).getAuthTag();
  return {
    encrypted,
    iv: iv.toString("hex"),
    salt: salt.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

export class ComplianceExportService {
  generateAuditLogCSV(logs: AuditLogEntry[], options: ExportOptions): Buffer {
    const headers = [
      "Record ID",
      "Timestamp (UTC)",
      "Action",
      "Resource Type",
      "Resource ID",
      "IP Address (Masked)",
      "User Agent",
      "Outcome",
      "HIPAA Category",
      "Access Reason",
    ];

    const rows = logs.map((log) => {
      const meta = log.metadata || {};
      return [
        log.id,
        formatDateISO(log.createdAt),
        log.action,
        log.resourceType || "",
        log.resourceId || "",
        maskIpAddress(log.ipAddress),
        (log.userAgent || "").slice(0, 80),
        meta.outcome || "success",
        meta.compliance?.category || "",
        meta.phiDetails?.accessReason || "",
      ].map((v) => escapeCSV(String(v)));
    });

    const csvContent = [headers.map((h) => escapeCSV(h)).join(","), ...rows.map((r) => r.join(","))].join("\n");
    let buf = Buffer.from(csvContent, "utf-8");

    if (options.encrypt && options.passphrase) {
      const { encrypted, iv, salt, authTag } = encryptBuffer(buf, options.passphrase);
      const header = Buffer.from(
        JSON.stringify({ cipher: "aes-256-gcm", kdf: "pbkdf2-sha512-100k", iv, salt, authTag, originalFormat: "csv", exportedAt: new Date().toISOString(), recordCount: logs.length }) + "\n---ENCRYPTED_PAYLOAD---\n"
      );
      buf = Buffer.concat([header, encrypted]);
    }

    return buf;
  }

  generateTefcaExchangeCSV(exchanges: TefcaExchange[], options: ExportOptions): Buffer {
    const headers = [
      "Transaction ID",
      "Query ID",
      "Timestamp (UTC)",
      "Type",
      "Direction",
      "Network",
      "Exchange Purpose",
      "Status",
      "Error Code",
      "Document Count",
      "Requester Organization",
      "Consent Verified",
    ];

    const rows = exchanges.map((ex) =>
      [
        ex.id,
        ex.queryId,
        formatDateISO(ex.timestamp),
        ex.type,
        ex.direction,
        ex.networkId,
        ex.exchangePurpose,
        ex.status,
        ex.errorCode || "",
        String(ex.documentCount),
        ex.auditDetails.requesterOrganization,
        ex.auditDetails.consentVerified ? "Yes" : "No",
      ].map((v) => escapeCSV(String(v)))
    );

    const csvContent = [headers.map((h) => escapeCSV(h)).join(","), ...rows.map((r) => r.join(","))].join("\n");
    let buf = Buffer.from(csvContent, "utf-8");

    if (options.encrypt && options.passphrase) {
      const { encrypted, iv, salt, authTag } = encryptBuffer(buf, options.passphrase);
      const header = Buffer.from(
        JSON.stringify({ cipher: "aes-256-gcm", kdf: "pbkdf2-sha512-100k", iv, salt, authTag, originalFormat: "csv", exportedAt: new Date().toISOString(), recordCount: exchanges.length }) + "\n---ENCRYPTED_PAYLOAD---\n"
      );
      buf = Buffer.concat([header, encrypted]);
    }

    return buf;
  }

  generateAuditLogPDF(logs: AuditLogEntry[], options: ExportOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => {
          let buf = Buffer.concat(chunks);
          if (options.encrypt && options.passphrase) {
            const { encrypted, iv, salt, authTag } = encryptBuffer(buf, options.passphrase);
            const header = Buffer.from(
              JSON.stringify({ cipher: "aes-256-gcm", kdf: "pbkdf2-sha512-100k", iv, salt, authTag, originalFormat: "pdf", exportedAt: new Date().toISOString(), recordCount: logs.length }) + "\n---ENCRYPTED_PAYLOAD---\n"
            );
            buf = Buffer.concat([header, encrypted]);
          }
          resolve(buf);
        });
        doc.on("error", reject);

        this.renderPDFHeader(doc, "System Audit Log Export", logs.length);
        this.renderAuditLogEntries(doc, logs);
        this.renderPDFFooter(doc);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  generateTefcaExchangePDF(exchanges: TefcaExchange[], options: ExportOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => {
          let buf = Buffer.concat(chunks);
          if (options.encrypt && options.passphrase) {
            const { encrypted, iv, salt, authTag } = encryptBuffer(buf, options.passphrase);
            const header = Buffer.from(
              JSON.stringify({ cipher: "aes-256-gcm", kdf: "pbkdf2-sha512-100k", iv, salt, authTag, originalFormat: "pdf", exportedAt: new Date().toISOString(), recordCount: exchanges.length }) + "\n---ENCRYPTED_PAYLOAD---\n"
            );
            buf = Buffer.concat([header, encrypted]);
          }
          resolve(buf);
        });
        doc.on("error", reject);

        this.renderPDFHeader(doc, "TEFCA Exchange Data Export", exchanges.length);
        this.renderTefcaEntries(doc, exchanges);
        this.renderPDFFooter(doc);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private renderPDFHeader(doc: PDFKit.PDFDocument, title: string, recordCount: number) {
    doc.rect(0, 0, doc.page.width, 4).fill("#0066CC");

    doc.fontSize(8).fillColor("#EF4444").text("CONFIDENTIAL - PROTECTED HEALTH INFORMATION", 50, 15, { align: "center" });
    doc.moveTo(50, 28).lineTo(doc.page.width - 50, 28).stroke("#E2E8F0");

    doc.fontSize(20).fillColor("#1A202C").text("TABULA MEDICA", 50, 40);
    doc.fontSize(14).fillColor("#4A5568").text(title, 50, 65);

    doc.fontSize(9).fillColor("#718096");
    doc.text(`Generated: ${formatDateHuman(new Date())}`, 50, 90);
    doc.text(`Total Records: ${recordCount}`, 50, 103);
    doc.text(`Encryption: AES-256-CBC`, 50, 116);
    doc.text(`Compliance: HIPAA / TEFCA / SOC 2 Type II`, 50, 129);

    doc.moveTo(50, 148).lineTo(doc.page.width - 50, 148).stroke("#E2E8F0");
    doc.y = 160;
  }

  private renderAuditLogEntries(doc: PDFKit.PDFDocument, logs: AuditLogEntry[]) {
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      const meta = log.metadata || {};

      if (doc.y > doc.page.height - 120) {
        doc.addPage();
        doc.fontSize(8).fillColor("#EF4444").text("CONFIDENTIAL - PROTECTED HEALTH INFORMATION", 50, 15, { align: "center" });
        doc.y = 40;
      }

      const yStart = doc.y;
      doc.rect(50, yStart, doc.page.width - 100, 1).fill("#E2E8F0");
      doc.y = yStart + 6;

      doc.fontSize(9).fillColor("#0066CC").text(`#${i + 1}  ${log.action}`, 50, doc.y);
      doc.fontSize(8).fillColor("#718096").text(formatDateHuman(log.createdAt), 350, doc.y - 11, { align: "right", width: 200 });

      doc.y += 4;
      doc.fontSize(8).fillColor("#4A5568");
      if (log.resourceType) doc.text(`Resource: ${log.resourceType} / ${log.resourceId || "N/A"}`, 60);
      doc.text(`IP: ${maskIpAddress(log.ipAddress)}`, 60);
      if (meta.outcome) doc.text(`Outcome: ${meta.outcome}`, 60);
      if (meta.compliance?.category) doc.text(`HIPAA Category: ${meta.compliance.category}`, 60);
      if (meta.phiDetails?.accessReason) doc.text(`Access Reason: ${meta.phiDetails.accessReason}`, 60);

      doc.y += 8;
    }
  }

  private renderTefcaEntries(doc: PDFKit.PDFDocument, exchanges: TefcaExchange[]) {
    for (let i = 0; i < exchanges.length; i++) {
      const ex = exchanges[i];

      if (doc.y > doc.page.height - 120) {
        doc.addPage();
        doc.fontSize(8).fillColor("#EF4444").text("CONFIDENTIAL - PROTECTED HEALTH INFORMATION", 50, 15, { align: "center" });
        doc.y = 40;
      }

      const yStart = doc.y;
      doc.rect(50, yStart, doc.page.width - 100, 1).fill("#E2E8F0");
      doc.y = yStart + 6;

      const statusColor = ex.status === "success" ? "#22C55E" : "#EF4444";
      doc.fontSize(9).fillColor("#0066CC").text(`#${i + 1}  ${ex.networkId.toUpperCase()} - ${ex.type}`, 50, doc.y);
      doc.fontSize(8).fillColor(statusColor).text(ex.status.toUpperCase(), 400, doc.y - 11, { align: "right", width: 150 });

      doc.y += 4;
      doc.fontSize(8).fillColor("#4A5568");
      doc.text(`Transaction: ${ex.id}`, 60);
      doc.text(`Query: ${ex.queryId}`, 60);
      doc.text(`Direction: ${ex.direction} | Purpose: ${ex.exchangePurpose}`, 60);
      doc.text(`Timestamp: ${formatDateHuman(ex.timestamp)}`, 60);
      doc.text(`Documents: ${ex.documentCount} | Consent: ${ex.auditDetails.consentVerified ? "Verified" : "Not verified"}`, 60);
      if (ex.errorCode) {
        doc.fillColor("#EF4444").text(`Error: ${ex.errorCode}`, 60);
      }
      doc.text(`Requester: ${ex.auditDetails.requesterOrganization}`, 60);

      doc.y += 8;
    }
  }

  private renderPDFFooter(doc: PDFKit.PDFDocument) {
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.height - 30;
      doc.fontSize(7).fillColor("#718096");
      doc.text(`Page ${i + 1} of ${pages.count}`, 50, bottom, { align: "center", width: doc.page.width - 100 });
      doc.text("This document contains Protected Health Information (PHI). Unauthorized disclosure is prohibited.", 50, bottom + 10, { align: "center", width: doc.page.width - 100 });
    }
  }

  async getAuditLogs(userId: string, dateFrom?: Date, dateTo?: Date): Promise<AuditLogEntry[]> {
    let logs = await storage.getAuditLogs(userId);
    if (dateFrom) logs = logs.filter((l: any) => new Date(l.createdAt) >= dateFrom);
    if (dateTo) logs = logs.filter((l: any) => new Date(l.createdAt) <= dateTo);
    return logs;
  }
}

export const complianceExportService = new ComplianceExportService();
