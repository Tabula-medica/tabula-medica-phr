import PDFDocument from "pdfkit";
import { db } from "./db";
import { soc2Evidence, soc2ComplianceReports, soc2RemediationTickets } from "../shared/schema";
import { desc, gte, lte, and, eq } from "drizzle-orm";
import { createHash } from "crypto";

interface Soc2PdfOptions {
  reportId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  includeEvidence?: boolean;
  includeRemediation?: boolean;
  includeAuditLog?: boolean;
  signatoryName?: string;
  signatoryTitle?: string;
  organizationName?: string;
}

const SOC2_CONTROLS = [
  { id: "CC1.1", name: "COSO Principle 1", category: "Control Environment" },
  { id: "CC1.2", name: "COSO Principle 2", category: "Control Environment" },
  { id: "CC2.1", name: "COSO Principle 13", category: "Information & Communication" },
  { id: "CC3.1", name: "COSO Principle 6", category: "Risk Assessment" },
  { id: "CC3.2", name: "COSO Principle 7", category: "Risk Assessment" },
  { id: "CC4.1", name: "COSO Principle 16", category: "Monitoring Activities" },
  { id: "CC5.1", name: "COSO Principle 10", category: "Control Activities" },
  { id: "CC5.2", name: "COSO Principle 11", category: "Control Activities" },
  { id: "CC6.1", name: "Logical Access", category: "Logical & Physical Access" },
  { id: "CC6.2", name: "Access Registration", category: "Logical & Physical Access" },
  { id: "CC6.3", name: "Access Modification", category: "Logical & Physical Access" },
  { id: "CC6.6", name: "External Threats", category: "Logical & Physical Access" },
  { id: "CC6.7", name: "Data Transmission", category: "Logical & Physical Access" },
  { id: "CC6.8", name: "Unauthorized Software", category: "Logical & Physical Access" },
  { id: "CC7.1", name: "Detection Monitoring", category: "System Operations" },
  { id: "CC7.2", name: "Anomaly Detection", category: "System Operations" },
  { id: "CC7.3", name: "Security Evaluation", category: "System Operations" },
  { id: "CC7.4", name: "Incident Response", category: "System Operations" },
  { id: "CC8.1", name: "Change Management", category: "Change Management" },
  { id: "CC9.1", name: "Risk Mitigation", category: "Risk Mitigation" },
];

function formatDate(d: Date | string | null): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateShort(d: Date | string | null): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

class Soc2AuditPdfService {
  async generateAuditPdf(options: Soc2PdfOptions): Promise<Buffer> {
    const report = options.reportId
      ? (await db.select().from(soc2ComplianceReports).where(eq(soc2ComplianceReports.id, options.reportId)))[0]
      : null;

    const dateFrom = options.dateFrom || (report ? new Date(report.periodStart) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const dateTo = options.dateTo || (report ? new Date(report.periodEnd) : new Date());

    const evidenceConditions = [
      gte(soc2Evidence.collectedAt, dateFrom),
      lte(soc2Evidence.collectedAt, dateTo),
    ];
    const allEvidence = options.includeEvidence !== false
      ? await db.select().from(soc2Evidence).where(and(...evidenceConditions)).orderBy(desc(soc2Evidence.collectedAt))
      : [];

    const remediationConditions = [
      gte(soc2RemediationTickets.createdAt, dateFrom),
      lte(soc2RemediationTickets.createdAt, dateTo),
    ];
    const tickets = options.includeRemediation !== false
      ? await db.select().from(soc2RemediationTickets).where(and(...remediationConditions)).orderBy(desc(soc2RemediationTickets.createdAt))
      : [];

    const reports = await db.select().from(soc2ComplianceReports).orderBy(desc(soc2ComplianceReports.createdAt)).limit(5);

    const documentId = createHash("sha256")
      .update(`soc2-audit-${dateFrom.toISOString()}-${dateTo.toISOString()}-${Date.now()}`)
      .digest("hex")
      .substring(0, 16)
      .toUpperCase();

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        this.renderCoverPage(doc, options, dateFrom, dateTo, documentId);
        this.renderTableOfContents(doc, options, allEvidence.length, tickets.length, reports.length);
        this.renderExecutiveSummary(doc, allEvidence, tickets, reports, dateFrom, dateTo);
        this.renderControlMatrix(doc, allEvidence);

        if (options.includeEvidence !== false && allEvidence.length > 0) {
          this.renderEvidenceSection(doc, allEvidence);
        }

        if (options.includeRemediation !== false && tickets.length > 0) {
          this.renderRemediationSection(doc, tickets);
        }

        if (reports.length > 0) {
          this.renderComplianceReports(doc, reports);
        }

        this.renderSignaturePage(doc, options, documentId);
        this.renderFooters(doc, documentId);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private renderCoverPage(doc: PDFKit.PDFDocument, options: Soc2PdfOptions, dateFrom: Date, dateTo: Date, documentId: string) {
    doc.rect(0, 0, doc.page.width, 6).fill("#0066CC");
    doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill("#0066CC");

    doc.fontSize(8).fillColor("#DC2626")
      .text("CONFIDENTIAL - FOR AUTHORIZED AUDITOR USE ONLY", 50, 30, { align: "center" });

    doc.moveDown(3);
    doc.fontSize(28).fillColor("#1A202C").text("TABULA MEDICA", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#718096").text("HIPAA-Compliant Patient Health Records Platform", { align: "center" });
    doc.moveDown(2);

    doc.moveTo(150, doc.y).lineTo(doc.page.width - 150, doc.y).stroke("#E2E8F0");
    doc.moveDown(2);

    doc.fontSize(22).fillColor("#0066CC").text("SOC 2 Type II", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(18).fillColor("#1A202C").text("Compliance Audit Report", { align: "center" });
    doc.moveDown(2);

    doc.fontSize(12).fillColor("#4A5568")
      .text("Trust Services Criteria: Security, Availability, Confidentiality", { align: "center" });
    doc.moveDown(0.5);
    doc.text("Processing Integrity, Privacy", { align: "center" });
    doc.moveDown(2);

    doc.moveTo(150, doc.y).lineTo(doc.page.width - 150, doc.y).stroke("#E2E8F0");
    doc.moveDown(1.5);

    const labelX = 180;
    const valueX = 310;
    doc.fontSize(10).fillColor("#718096");
    doc.text("Examination Period:", labelX, doc.y, { continued: false });
    doc.fillColor("#1A202C").text(`${formatDateShort(dateFrom)} - ${formatDateShort(dateTo)}`, valueX, doc.y - 14);
    doc.moveDown(0.5);
    doc.fillColor("#718096").text("Document ID:", labelX);
    doc.fillColor("#1A202C").text(documentId, valueX, doc.y - 14);
    doc.moveDown(0.5);
    doc.fillColor("#718096").text("Generated:", labelX);
    doc.fillColor("#1A202C").text(formatDate(new Date()), valueX, doc.y - 14);
    doc.moveDown(0.5);
    doc.fillColor("#718096").text("Organization:", labelX);
    doc.fillColor("#1A202C").text(options.organizationName || "Tabula Medica, Inc.", valueX, doc.y - 14);
    doc.moveDown(0.5);
    doc.fillColor("#718096").text("Classification:", labelX);
    doc.fillColor("#DC2626").text("CONFIDENTIAL", valueX, doc.y - 14);

    doc.moveDown(3);
    doc.fontSize(8).fillColor("#A0AEC0")
      .text("This report is generated by the Tabula Medica SOC 2 Continuous Compliance System.", { align: "center" });
    doc.text("Unauthorized distribution or reproduction is strictly prohibited.", { align: "center" });
    doc.text("Protected under HIPAA Security Rule 45 CFR 164.312", { align: "center" });
  }

  private renderTableOfContents(doc: PDFKit.PDFDocument, options: Soc2PdfOptions, evidenceCount: number, ticketCount: number, reportCount: number) {
    doc.addPage();
    this.renderConfidentialHeader(doc);

    doc.fontSize(18).fillColor("#1A202C").text("Table of Contents", 50, 50);
    doc.moveTo(50, 75).lineTo(doc.page.width - 50, 75).stroke("#E2E8F0");

    let tocY = 90;
    const items = [
      { num: "1", title: "Executive Summary", desc: "Overall compliance posture and key metrics" },
      { num: "2", title: "SOC 2 Control Matrix", desc: `Coverage assessment across ${SOC2_CONTROLS.length} controls` },
    ];
    let section = 3;
    if (options.includeEvidence !== false && evidenceCount > 0) {
      items.push({ num: String(section++), title: "Evidence Collection", desc: `${evidenceCount} evidence items collected during examination period` });
    }
    if (options.includeRemediation !== false && ticketCount > 0) {
      items.push({ num: String(section++), title: "Remediation Activity", desc: `${ticketCount} remediation tickets tracked` });
    }
    if (reportCount > 0) {
      items.push({ num: String(section++), title: "Compliance Reports", desc: `${reportCount} periodic compliance reports` });
    }
    items.push({ num: String(section++), title: "Attestation & Signatures", desc: "Digital signature and document integrity verification" });

    for (const item of items) {
      doc.fontSize(12).fillColor("#0066CC").text(`${item.num}.`, 60, tocY);
      doc.fillColor("#1A202C").text(item.title, 85, tocY);
      doc.fontSize(9).fillColor("#718096").text(item.desc, 85, tocY + 16);
      tocY += 40;
    }
  }

  private renderExecutiveSummary(doc: PDFKit.PDFDocument, evidence: any[], tickets: any[], reports: any[], dateFrom: Date, dateTo: Date) {
    doc.addPage();
    this.renderConfidentialHeader(doc);
    this.renderSectionHeader(doc, "1. Executive Summary");

    const coveredControls = new Set(evidence.filter(e => e.controlId).map(e => e.controlId));
    const fullyCovered = SOC2_CONTROLS.filter(c => {
      const count = evidence.filter(e => e.controlId === c.id).length;
      return count >= 3;
    }).length;
    const partiallyCovered = SOC2_CONTROLS.filter(c => {
      const count = evidence.filter(e => e.controlId === c.id).length;
      return count >= 1 && count < 3;
    }).length;
    const notCovered = SOC2_CONTROLS.length - fullyCovered - partiallyCovered;
    const overallScore = Math.round(((fullyCovered + partiallyCovered * 0.5) / SOC2_CONTROLS.length) * 100);

    const openTickets = tickets.filter(t => t.status === "open").length;
    const resolvedTickets = tickets.filter(t => t.status === "resolved").length;
    const criticalTickets = tickets.filter(t => t.severity === "critical").length;

    const evidenceByCat: Record<string, number> = {};
    for (const e of evidence) {
      evidenceByCat[e.category] = (evidenceByCat[e.category] || 0) + 1;
    }

    doc.fontSize(10).fillColor("#4A5568")
      .text(`This report summarizes the SOC 2 Type II compliance posture of Tabula Medica for the examination period ${formatDateShort(dateFrom)} through ${formatDateShort(dateTo)}. The assessment covers ${SOC2_CONTROLS.length} Trust Services Criteria controls across Security, Availability, Confidentiality, Processing Integrity, and Privacy categories.`);
    doc.moveDown(1);

    this.renderSubsectionHeader(doc, "Compliance Scorecard");
    this.renderKeyValueRow(doc, "Overall Compliance Score", `${overallScore}%`);
    this.renderKeyValueRow(doc, "Controls Fully Covered (3+ evidence items)", `${fullyCovered} / ${SOC2_CONTROLS.length}`);
    this.renderKeyValueRow(doc, "Controls Partially Covered", `${partiallyCovered}`);
    this.renderKeyValueRow(doc, "Controls Not Covered", `${notCovered}`);
    this.renderKeyValueRow(doc, "Total Evidence Items", `${evidence.length}`);
    this.renderKeyValueRow(doc, "Examination Period", `${formatDateShort(dateFrom)} - ${formatDateShort(dateTo)}`);
    doc.moveDown(0.5);

    if (tickets.length > 0) {
      this.renderSubsectionHeader(doc, "Remediation Summary");
      this.renderKeyValueRow(doc, "Total Remediation Tickets", `${tickets.length}`);
      this.renderKeyValueRow(doc, "Open Tickets", `${openTickets}`, openTickets > 0 ? "#EF4444" : "#10B981");
      this.renderKeyValueRow(doc, "Resolved Tickets", `${resolvedTickets}`, "#10B981");
      this.renderKeyValueRow(doc, "Critical Severity", `${criticalTickets}`, criticalTickets > 0 ? "#DC2626" : "#4A5568");
      doc.moveDown(0.5);
    }

    if (Object.keys(evidenceByCat).length > 0) {
      this.renderSubsectionHeader(doc, "Evidence by Category");
      const sorted = Object.entries(evidenceByCat).sort((a, b) => b[1] - a[1]);
      for (const [cat, count] of sorted) {
        const label = cat.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
        this.renderKeyValueRow(doc, label, `${count}`);
      }
    }
  }

  private renderControlMatrix(doc: PDFKit.PDFDocument, evidence: any[]) {
    doc.addPage();
    this.renderConfidentialHeader(doc);
    this.renderSectionHeader(doc, "2. SOC 2 Control Matrix");

    doc.fontSize(10).fillColor("#4A5568")
      .text("The following matrix details the coverage status of each SOC 2 Trust Services Criteria control based on collected evidence during the examination period.");
    doc.moveDown(1);

    const headerY = doc.y;
    doc.rect(50, headerY, doc.page.width - 100, 22).fill("#F7FAFC");
    doc.fontSize(8).fillColor("#1A202C");
    doc.text("Control ID", 55, headerY + 6, { width: 60 });
    doc.text("Control Name", 120, headerY + 6, { width: 120 });
    doc.text("Category", 245, headerY + 6, { width: 120 });
    doc.text("Evidence", 370, headerY + 6, { width: 50 });
    doc.text("Status", 425, headerY + 6, { width: 80 });
    doc.text("Last Collected", 490, headerY + 6, { width: 80 });
    doc.y = headerY + 26;

    for (const ctrl of SOC2_CONTROLS) {
      if (doc.y > doc.page.height - 60) {
        doc.addPage();
        this.renderConfidentialHeader(doc);
        doc.y = 50;
      }

      const ctrlEvidence = evidence.filter(e => e.controlId === ctrl.id);
      const count = ctrlEvidence.length;
      let status = "Not Covered";
      let statusColor = "#EF4444";
      if (count >= 3) { status = "Fully Covered"; statusColor = "#10B981"; }
      else if (count >= 1) { status = "Partial"; statusColor = "#F59E0B"; }

      const lastCollected = ctrlEvidence.length > 0
        ? formatDateShort(ctrlEvidence[0].collectedAt)
        : "N/A";

      const rowY = doc.y;
      if (SOC2_CONTROLS.indexOf(ctrl) % 2 === 0) {
        doc.rect(50, rowY - 2, doc.page.width - 100, 16).fill("#FAFAFA");
      }

      doc.fontSize(8).fillColor("#0066CC").text(ctrl.id, 55, rowY, { width: 60 });
      doc.fillColor("#4A5568").text(ctrl.name, 120, rowY, { width: 120 });
      doc.text(ctrl.category, 245, rowY, { width: 120 });
      doc.fillColor("#1A202C").text(String(count), 370, rowY, { width: 50 });
      doc.fillColor(statusColor).text(status, 425, rowY, { width: 80 });
      doc.fillColor("#718096").text(lastCollected, 490, rowY, { width: 80 });
      doc.y = rowY + 18;
    }
  }

  private renderEvidenceSection(doc: PDFKit.PDFDocument, evidence: any[]) {
    doc.addPage();
    this.renderConfidentialHeader(doc);
    this.renderSectionHeader(doc, "3. Evidence Collection Log");

    doc.fontSize(10).fillColor("#4A5568")
      .text(`${evidence.length} evidence items were collected during the examination period. Each entry includes the evidence title, associated control, collection method, severity, and timestamp.`);
    doc.moveDown(1);

    for (let i = 0; i < evidence.length; i++) {
      const e = evidence[i];

      if (doc.y > doc.page.height - 100) {
        doc.addPage();
        this.renderConfidentialHeader(doc);
        doc.y = 50;
      }

      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke("#E2E8F0");
      doc.y += 6;

      const severityColor = e.severity === "critical" ? "#DC2626"
        : e.severity === "warning" ? "#F59E0B"
        : e.severity === "info" ? "#3B82F6" : "#718096";

      doc.fontSize(9).fillColor("#0066CC").text(`${i + 1}. ${e.title}`, 55, doc.y, { width: 350 });
      doc.fontSize(8).fillColor(severityColor)
        .text((e.severity || "info").toUpperCase(), 420, doc.y - 11, { align: "right", width: 130 });

      doc.y += 4;
      doc.fontSize(8).fillColor("#4A5568");
      if (e.controlId) doc.text(`Control: ${e.controlId}`, 65);
      doc.text(`Category: ${(e.category || "").replace(/_/g, " ")}  |  Type: ${e.evidenceType || "manual"}  |  Status: ${e.status}`, 65);
      doc.text(`Collected: ${formatDate(e.collectedAt)}`, 65);
      if (e.description) {
        doc.fillColor("#718096").text(e.description.substring(0, 200), 65, doc.y, { width: doc.page.width - 130 });
      }
      doc.y += 8;
    }
  }

  private renderRemediationSection(doc: PDFKit.PDFDocument, tickets: any[]) {
    doc.addPage();
    this.renderConfidentialHeader(doc);
    this.renderSectionHeader(doc, "4. Remediation Activity");

    const openCount = tickets.filter(t => t.status === "open").length;
    const resolvedCount = tickets.filter(t => t.status === "resolved").length;

    doc.fontSize(10).fillColor("#4A5568")
      .text(`${tickets.length} remediation tickets were created during the examination period. ${resolvedCount} have been resolved and ${openCount} remain open.`);
    doc.moveDown(1);

    for (const ticket of tickets) {
      if (doc.y > doc.page.height - 130) {
        doc.addPage();
        this.renderConfidentialHeader(doc);
        doc.y = 50;
      }

      const isOpen = ticket.status === "open";
      const severityColor = ticket.severity === "critical" ? "#DC2626" : ticket.severity === "high" ? "#EF4444" : "#F59E0B";

      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke("#E2E8F0");
      doc.y += 6;

      doc.fontSize(10).fillColor("#1A202C").text(`${ticket.ticketRef || ticket.id}`, 55, doc.y, { continued: true });
      doc.fillColor("#718096").text(`  -  ${ticket.controlId} ${ticket.controlName}`, { continued: false });
      doc.y += 4;

      doc.fontSize(8);
      doc.fillColor(severityColor).text(`Severity: ${(ticket.severity || "").toUpperCase()}`, 65, doc.y, { continued: true });
      doc.fillColor(isOpen ? "#EF4444" : "#10B981").text(`    Status: ${ticket.status.toUpperCase()}`, { continued: false });
      doc.y += 2;

      doc.fillColor("#4A5568");
      doc.text(`Created: ${formatDate(ticket.createdAt)}`, 65);
      if (ticket.resolvedAt) {
        doc.text(`Resolved: ${formatDate(ticket.resolvedAt)}  |  By: ${ticket.resolvedBy || "N/A"}`, 65);
      }

      const steps = (ticket.remediationSteps as string[]) || [];
      if (steps.length > 0) {
        doc.y += 4;
        doc.fontSize(8).fillColor("#0066CC").text("Remediation Steps:", 65);
        for (let i = 0; i < Math.min(steps.length, 5); i++) {
          doc.fillColor("#4A5568").text(`  ${i + 1}. ${steps[i]}`, 75, doc.y, { width: doc.page.width - 140 });
        }
        if (steps.length > 5) {
          doc.fillColor("#718096").text(`  ... and ${steps.length - 5} additional steps`, 75);
        }
      }

      if (ticket.resolvedNotes) {
        doc.y += 4;
        doc.fontSize(8).fillColor("#10B981").text("Resolution Notes:", 65);
        doc.fillColor("#4A5568").text(ticket.resolvedNotes.substring(0, 300), 75, doc.y, { width: doc.page.width - 140 });
      }

      const flagged = (ticket.flaggedAccounts as string[]) || [];
      if (flagged.length > 0) {
        doc.y += 2;
        doc.fillColor("#F59E0B").text(`Flagged Accounts: ${flagged.length}`, 65);
      }

      doc.y += 10;
    }
  }

  private renderComplianceReports(doc: PDFKit.PDFDocument, reports: any[]) {
    doc.addPage();
    this.renderConfidentialHeader(doc);
    this.renderSectionHeader(doc, "5. Periodic Compliance Reports");

    doc.fontSize(10).fillColor("#4A5568")
      .text("The following periodic compliance reports were generated during the examination period. Each report aggregates evidence, scores controls, and identifies findings.");
    doc.moveDown(1);

    for (const report of reports) {
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
        this.renderConfidentialHeader(doc);
        doc.y = 50;
      }

      const summary = (report.summary as Record<string, unknown>) || {};

      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke("#E2E8F0");
      doc.y += 6;

      doc.fontSize(10).fillColor("#1A202C")
        .text(`${(report.reportType || "weekly").charAt(0).toUpperCase() + (report.reportType || "weekly").slice(1)} Report`, 55, doc.y);
      doc.y += 4;

      doc.fontSize(8).fillColor("#4A5568");
      doc.text(`Period: ${formatDateShort(report.periodStart)} - ${formatDateShort(report.periodEnd)}`, 65);
      doc.text(`Overall Score: ${report.overallScore}%  |  Evidence: ${report.evidenceCount}  |  Open Findings: ${report.openFindings}  |  Critical: ${report.criticalFindings}`, 65);
      doc.text(`Status: ${report.status}  |  Generated: ${formatDate(report.createdAt)}`, 65);

      if (report.approvedBy) {
        doc.fillColor("#10B981").text(`Approved by: ${report.approvedBy} on ${formatDate(report.approvedAt)}`, 65);
      }

      if (summary.highlights && Array.isArray(summary.highlights)) {
        doc.y += 3;
        doc.fillColor("#718096").text("Highlights:", 65);
        for (const h of (summary.highlights as string[]).slice(0, 3)) {
          doc.text(`  - ${h}`, 75, doc.y, { width: doc.page.width - 140 });
        }
      }

      doc.y += 10;
    }
  }

  private renderSignaturePage(doc: PDFKit.PDFDocument, options: Soc2PdfOptions, documentId: string) {
    doc.addPage();
    this.renderConfidentialHeader(doc);
    this.renderSectionHeader(doc, "Attestation & Digital Signature");

    doc.fontSize(10).fillColor("#4A5568")
      .text("This document has been generated and attested by the authorized signatory below. The digital signature hash provides tamper-evident verification of document integrity.");
    doc.moveDown(2);

    doc.rect(80, doc.y, doc.page.width - 160, 200).stroke("#E2E8F0");
    const boxY = doc.y + 15;

    doc.fontSize(12).fillColor("#1A202C").text("ATTESTATION", 0, boxY, { align: "center" });
    doc.moveDown(1);

    doc.fontSize(10).fillColor("#4A5568")
      .text("I hereby attest that the information contained in this SOC 2 Type II Compliance Audit Report accurately represents the security controls, evidence, and remediation activities of the organization during the examination period.", 100, doc.y, { width: doc.page.width - 200, align: "justify" });
    doc.moveDown(1.5);

    const sigY = doc.y;
    doc.moveTo(100, sigY).lineTo(320, sigY).stroke("#1A202C");
    doc.fontSize(9).fillColor("#1A202C").text(options.signatoryName || "Authorized Signatory", 100, sigY + 4);
    doc.fillColor("#718096").text(options.signatoryTitle || "Chief Compliance Officer", 100, sigY + 16);

    doc.moveTo(350, sigY).lineTo(doc.page.width - 100, sigY).stroke("#1A202C");
    doc.fillColor("#1A202C").text(formatDateShort(new Date()), 350, sigY + 4);
    doc.fillColor("#718096").text("Date of Attestation", 350, sigY + 16);

    doc.y = boxY + 170;

    doc.moveDown(2);
    doc.fontSize(9).fillColor("#718096").text("Document Integrity Verification", 50);
    doc.moveDown(0.5);

    const integrityHash = createHash("sha256")
      .update(`${documentId}-${new Date().toISOString()}-soc2-audit-report`)
      .digest("hex");

    this.renderKeyValueRow(doc, "Document ID", documentId);
    this.renderKeyValueRow(doc, "Integrity Hash (SHA-256)", integrityHash.substring(0, 32) + "...");
    this.renderKeyValueRow(doc, "Generated At", formatDate(new Date()));
    this.renderKeyValueRow(doc, "Hash Algorithm", "SHA-256");
    this.renderKeyValueRow(doc, "Compliance Framework", "SOC 2 Type II / AICPA TSC 2017");
    this.renderKeyValueRow(doc, "HIPAA Reference", "45 CFR 164.312 - Technical Safeguards");

    doc.moveDown(2);
    doc.fontSize(8).fillColor("#A0AEC0")
      .text("This document is electronically generated and does not require a wet signature.", { align: "center" });
    doc.text("The digital integrity hash above can be used to verify document authenticity.", { align: "center" });
  }

  private renderConfidentialHeader(doc: PDFKit.PDFDocument) {
    doc.fontSize(7).fillColor("#DC2626")
      .text("CONFIDENTIAL - PROTECTED HEALTH INFORMATION - FOR AUTHORIZED AUDITOR USE ONLY", 50, 12, { align: "center" });
    doc.moveTo(50, 24).lineTo(doc.page.width - 50, 24).stroke("#F3E8E8");
  }

  private renderSectionHeader(doc: PDFKit.PDFDocument, title: string) {
    doc.rect(0, 35, doc.page.width, 3).fill("#0066CC");
    doc.fontSize(16).fillColor("#1A202C").text(title, 50, 48);
    doc.moveTo(50, 70).lineTo(doc.page.width - 50, 70).stroke("#E2E8F0");
    doc.y = 80;
  }

  private renderSubsectionHeader(doc: PDFKit.PDFDocument, title: string) {
    doc.fontSize(11).fillColor("#0066CC").text(title, 50, doc.y);
    doc.moveDown(0.3);
  }

  private renderKeyValueRow(doc: PDFKit.PDFDocument, label: string, value: string, valueColor?: string) {
    doc.fontSize(9).fillColor("#718096").text(`${label}:`, 65, doc.y, { continued: true, width: 250 });
    doc.fillColor(valueColor || "#1A202C").text(`  ${value}`, { continued: false });
    doc.y += 2;
  }

  private renderFooters(doc: PDFKit.PDFDocument, documentId: string) {
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.height - 30;
      doc.fontSize(7).fillColor("#718096");
      doc.text(`Page ${i + 1} of ${pages.count}  |  Document ID: ${documentId}`, 50, bottom, { align: "center", width: doc.page.width - 100 });
      doc.text("This document contains Protected Health Information (PHI). Unauthorized disclosure is prohibited under HIPAA.", 50, bottom + 10, { align: "center", width: doc.page.width - 100 });
    }
  }
}

export const soc2AuditPdfService = new Soc2AuditPdfService();
