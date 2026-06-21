import { Router, Request, Response } from "express";
import PDFDocument from "pdfkit";
import { storage } from "../storage";
import { insertComplianceEvidenceSchema, insertComplianceWeeklyReportSchema, complianceEvidenceCategories, soc2TrustServiceCategories } from "@shared/schema";
import type { ComplianceEvidenceCategory, SOC2TrustServiceCategory } from "@shared/schema";

const router = Router();

router.get("/evidence", async (req: Request, res: Response) => {
  try {
    const filters: {
      category?: ComplianceEvidenceCategory;
      soc2Category?: SOC2TrustServiceCategory;
      status?: string;
      limit?: number;
      offset?: number;
    } = {};
    if (req.query.category && complianceEvidenceCategories.includes(req.query.category as any)) {
      filters.category = req.query.category as ComplianceEvidenceCategory;
    }
    if (req.query.soc2Category && soc2TrustServiceCategories.includes(req.query.soc2Category as any)) {
      filters.soc2Category = req.query.soc2Category as SOC2TrustServiceCategory;
    }
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.limit) filters.limit = parseInt(req.query.limit as string);
    if (req.query.offset) filters.offset = parseInt(req.query.offset as string);

    const evidence = await storage.getComplianceEvidence(filters);
    const stats = await storage.getComplianceEvidenceStats();
    res.json({ evidence, stats });
  } catch (error: any) {
    console.error("[SOC2] Evidence fetch error:", error?.message);
    res.status(500).json({ error: "Failed to fetch compliance evidence" });
  }
});

router.get("/evidence/:id", async (req: Request, res: Response) => {
  try {
    const evidence = await storage.getComplianceEvidenceById(req.params.id);
    if (!evidence) return res.status(404).json({ error: "Evidence not found" });
    res.json(evidence);
  } catch (error: any) {
    console.error("[SOC2] Evidence fetch error:", error?.message);
    res.status(500).json({ error: "Failed to fetch evidence" });
  }
});

router.post("/evidence", async (req: Request, res: Response) => {
  try {
    const parsed = insertComplianceEvidenceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid evidence data", details: parsed.error.flatten() });
    }
    const evidence = await storage.createComplianceEvidence(parsed.data);
    res.status(201).json(evidence);
  } catch (error: any) {
    console.error("[SOC2] Evidence create error:", error?.message);
    res.status(500).json({ error: "Failed to create compliance evidence" });
  }
});

router.patch("/evidence/:id", async (req: Request, res: Response) => {
  try {
    const updated = await storage.updateComplianceEvidence(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Evidence not found" });
    res.json(updated);
  } catch (error: any) {
    console.error("[SOC2] Evidence update error:", error?.message);
    res.status(500).json({ error: "Failed to update evidence" });
  }
});

router.delete("/evidence/:id", async (req: Request, res: Response) => {
  try {
    await storage.deleteComplianceEvidence(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[SOC2] Evidence delete error:", error?.message);
    res.status(500).json({ error: "Failed to delete evidence" });
  }
});

router.get("/evidence-stats", async (_req: Request, res: Response) => {
  try {
    const stats = await storage.getComplianceEvidenceStats();
    res.json(stats);
  } catch (error: any) {
    console.error("[SOC2] Stats error:", error?.message);
    res.status(500).json({ error: "Failed to fetch evidence stats" });
  }
});

router.get("/weekly-reports", async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const reports = await storage.getComplianceWeeklyReports(limit);
    res.json(reports);
  } catch (error: any) {
    console.error("[SOC2] Reports fetch error:", error?.message);
    res.status(500).json({ error: "Failed to fetch weekly reports" });
  }
});

router.get("/weekly-reports/latest", async (_req: Request, res: Response) => {
  try {
    const report = await storage.getLatestComplianceWeeklyReport();
    if (!report) return res.status(404).json({ error: "No reports found" });
    res.json(report);
  } catch (error: any) {
    console.error("[SOC2] Latest report error:", error?.message);
    res.status(500).json({ error: "Failed to fetch latest report" });
  }
});

router.get("/weekly-reports/:id", async (req: Request, res: Response) => {
  try {
    const report = await storage.getComplianceWeeklyReportById(req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });
    res.json(report);
  } catch (error: any) {
    console.error("[SOC2] Report fetch error:", error?.message);
    res.status(500).json({ error: "Failed to fetch report" });
  }
});

router.patch("/weekly-reports/:id", async (req: Request, res: Response) => {
  try {
    const updated = await storage.updateComplianceWeeklyReport(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Report not found" });
    res.json(updated);
  } catch (error: any) {
    console.error("[SOC2] Report update error:", error?.message);
    res.status(500).json({ error: "Failed to update report" });
  }
});

router.post("/generate-nightly-summary", async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const allEvidence = await storage.getComplianceEvidence({ limit: 1000 });
    const weekEvidence = allEvidence.filter(e => {
      const created = new Date(e.createdAt);
      return created >= weekStart && created <= weekEnd;
    });

    const criticalItems = weekEvidence.filter(e => e.severity === "critical" || e.severity === "high");
    const resolvedItems = weekEvidence.filter(e => e.status === "archived");

    const eventBreakdown: Record<string, number> = {};
    for (const ev of weekEvidence) {
      eventBreakdown[ev.category] = (eventBreakdown[ev.category] || 0) + 1;
    }

    const soc2Breakdown: Record<string, number> = {};
    for (const ev of weekEvidence) {
      soc2Breakdown[ev.soc2Category] = (soc2Breakdown[ev.soc2Category] || 0) + 1;
    }

    const totalActive = allEvidence.filter(e => e.status === "active").length;
    const totalCritical = allEvidence.filter(e => e.severity === "critical" && e.status === "active").length;
    const baseScore = 100;
    const criticalPenalty = totalCritical * 10;
    const highPenalty = allEvidence.filter(e => e.severity === "high" && e.status === "active").length * 5;
    const overallScore = Math.max(0, baseScore - criticalPenalty - highPenalty);

    const soc2Scores: Record<string, number> = {
      security: 100,
      availability: 100,
      processing_integrity: 100,
      confidentiality: 100,
      privacy: 100,
    };

    for (const cat of Object.keys(soc2Scores)) {
      const catCritical = allEvidence.filter(e => e.soc2Category === cat && e.severity === "critical" && e.status === "active").length;
      const catHigh = allEvidence.filter(e => e.soc2Category === cat && e.severity === "high" && e.status === "active").length;
      soc2Scores[cat] = Math.max(0, 100 - catCritical * 15 - catHigh * 7);
    }

    const recommendations: string[] = [];
    if (totalCritical > 0) recommendations.push(`Address ${totalCritical} critical finding(s) immediately`);
    if (resolvedItems.length === 0 && criticalItems.length > 0) recommendations.push("No findings resolved this week — prioritize remediation");
    if (weekEvidence.length === 0) recommendations.push("No new evidence collected this week — ensure automated collection is active");
    const pendingReview = allEvidence.filter(e => e.status === "pending_review").length;
    if (pendingReview > 0) recommendations.push(`${pendingReview} evidence item(s) pending review`);

    const criticalEvents = criticalItems.map(e => ({
      type: e.category,
      count: 1,
      description: e.title,
    }));

    const report = await storage.createComplianceWeeklyReport({
      weekStartDate: weekStart.toISOString().split("T")[0],
      weekEndDate: weekEnd.toISOString().split("T")[0],
      totalAuditEvents: weekEvidence.length,
      totalEvidenceCollected: weekEvidence.length,
      newFindings: criticalItems.length,
      resolvedFindings: resolvedItems.length,
      overallComplianceScore: overallScore,
      soc2Scores: soc2Scores as any,
      eventBreakdown,
      criticalEvents,
      recommendations,
      status: "draft",
      generatedBy: "nightly-aggregation",
      metadata: {
        generatedAt: now.toISOString(),
        totalActiveEvidence: totalActive,
        weekEvidenceCount: weekEvidence.length,
        soc2Breakdown,
      },
    });

    res.json({
      success: true,
      report,
      summary: {
        weekRange: `${weekStart.toISOString().split("T")[0]} to ${weekEnd.toISOString().split("T")[0]}`,
        totalEventsProcessed: weekEvidence.length,
        criticalFindings: criticalItems.length,
        overallScore,
      },
    });
  } catch (error: any) {
    console.error("[SOC2] Nightly summary generation error:", error?.message);
    res.status(500).json({ error: "Failed to generate nightly summary" });
  }
});

router.get("/dashboard-overview", async (_req: Request, res: Response) => {
  try {
    const stats = await storage.getComplianceEvidenceStats();
    const latestReport = await storage.getLatestComplianceWeeklyReport();
    const recentEvidence = await storage.getComplianceEvidence({ limit: 10 });
    const recentReports = await storage.getComplianceWeeklyReports(5);

    res.json({
      evidenceStats: stats,
      latestReport,
      recentEvidence,
      recentReports,
      overallHealth: {
        score: latestReport?.overallComplianceScore ?? 100,
        soc2Scores: latestReport?.soc2Scores ?? {
          security: 100,
          availability: 100,
          processing_integrity: 100,
          confidentiality: 100,
          privacy: 100,
        },
        recommendations: latestReport?.recommendations ?? [],
      },
    });
  } catch (error: any) {
    console.error("[SOC2] Dashboard overview error:", error?.message);
    res.status(500).json({ error: "Failed to fetch dashboard overview" });
  }
});

router.get("/export-pdf", async (req: Request, res: Response) => {
  try {
    const reportId = req.query.reportId as string | undefined;
    const signedBy = (req.query.signedBy as string) || "Compliance Officer";
    const signedTitle = (req.query.signedTitle as string) || "Chief Information Security Officer";
    const includeEvidence = req.query.includeEvidence !== "false";
    const includeRemediation = req.query.includeRemediation !== "false";

    const allEvidence = await storage.getComplianceEvidence({ limit: 500 });
    const stats = await storage.getComplianceEvidenceStats();
    const latestReport = reportId
      ? await storage.getComplianceWeeklyReportById(reportId)
      : await storage.getLatestComplianceWeeklyReport();
    const recentReports = await storage.getComplianceWeeklyReports(5);

    let remediationWorkflows: any[] = [];
    let remediationStats: any = null;
    if (includeRemediation) {
      try {
        remediationWorkflows = await storage.getRemediationWorkflows({ limit: 50 });
        remediationStats = await storage.getRemediationStats();
      } catch {
        // remediation may not be available
      }
    }

    const now = new Date();
    const docId = `SOC2-RPT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Date.now().toString(36).toUpperCase()}`;

    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 60, bottom: 60, left: 55, right: 55 },
      bufferPages: true,
      info: {
        Title: `SOC 2 Compliance Report — ${docId}`,
        Author: "Tabula Medica Compliance Engine",
        Subject: "SOC 2 Trust Service Criteria Compliance Summary",
        Keywords: "SOC 2, compliance, HIPAA, audit, healthcare",
        Creator: "Tabula Medica Automated Compliance System",
      },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="SOC2-Compliance-Report-${docId}.pdf"`);
    res.setHeader("Cache-Control", "no-store");
    doc.pipe(res);

    const NAVY = "#0f2a5e";
    const TEAL = "#0891b2";
    const DARK = "#1e293b";
    const MUTED = "#64748b";
    const RED = "#dc2626";
    const AMBER = "#d97706";
    const GREEN = "#16a34a";
    const LIGHT_BG = "#f8fafc";
    const PAGE_W = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    function drawPageFooter(pageDoc: PDFKit.PDFDocument) {
      const y = pageDoc.page.height - 40;
      pageDoc
        .save()
        .moveTo(pageDoc.page.margins.left, y - 8)
        .lineTo(pageDoc.page.width - pageDoc.page.margins.right, y - 8)
        .strokeColor("#e2e8f0")
        .lineWidth(0.5)
        .stroke()
        .fontSize(7)
        .fillColor(MUTED)
        .text("CONFIDENTIAL — FOR AUTHORIZED AUDITOR USE ONLY", pageDoc.page.margins.left, y, { align: "left", width: PAGE_W / 2 })
        .text(`Document: ${docId}`, pageDoc.page.margins.left + PAGE_W / 2, y, { align: "right", width: PAGE_W / 2 })
        .restore();
    }

    function sectionHeading(title: string, yPos?: number) {
      const y = yPos ?? doc.y;
      if (y > doc.page.height - 120) {
        doc.addPage();
      }
      doc
        .save()
        .rect(doc.page.margins.left, doc.y, PAGE_W, 26)
        .fill(NAVY)
        .fontSize(11)
        .fillColor("#ffffff")
        .text(title.toUpperCase(), doc.page.margins.left + 10, doc.y - 19, { width: PAGE_W - 20 })
        .restore()
        .moveDown(0.8);
    }

    function labelValue(label: string, value: string, indent = 0) {
      if (doc.y > doc.page.height - 80) doc.addPage();
      doc
        .fontSize(8.5)
        .fillColor(MUTED)
        .text(label, doc.page.margins.left + indent, doc.y, { continued: true, width: 140 })
        .fillColor(DARK)
        .text(`  ${value}`, { width: PAGE_W - 140 - indent })
        .moveDown(0.15);
    }

    function severityColor(severity: string): string {
      return severity === "critical" ? RED : severity === "high" ? AMBER : severity === "medium" ? "#b45309" : TEAL;
    }

    // ═══════════════ COVER PAGE ═══════════════
    doc.rect(0, 0, doc.page.width, 220).fill(NAVY);
    doc
      .fontSize(28)
      .fillColor("#ffffff")
      .text("SOC 2", doc.page.margins.left, 65, { width: PAGE_W })
      .fontSize(16)
      .text("Type II Compliance Report", doc.page.margins.left, 100, { width: PAGE_W })
      .fontSize(10)
      .fillColor("#94a3b8")
      .text("Trust Service Criteria Assessment", doc.page.margins.left, 130, { width: PAGE_W });

    doc
      .rect(doc.page.margins.left, 170, PAGE_W, 1)
      .fill("#334155");

    doc
      .fontSize(9)
      .fillColor("#cbd5e1")
      .text(`Report Period: ${latestReport?.weekStartDate ?? now.toISOString().split("T")[0]} — ${latestReport?.weekEndDate ?? now.toISOString().split("T")[0]}`, doc.page.margins.left, 180, { width: PAGE_W });

    doc
      .fontSize(11)
      .fillColor(DARK)
      .text("Tabula Medica", doc.page.margins.left, 250, { width: PAGE_W })
      .fontSize(9)
      .fillColor(MUTED)
      .text("Patient-Centric Health Record Platform", doc.page.margins.left, 268)
      .moveDown(2);

    const metaY = 310;
    doc.fontSize(8.5).fillColor(MUTED);
    const metaLabels = [
      ["Document ID:", docId],
      ["Generated:", now.toISOString()],
      ["Classification:", "CONFIDENTIAL — HIPAA / SOC 2"],
      ["Prepared For:", "External Auditor Review"],
      ["Prepared By:", "Tabula Medica Automated Compliance Engine"],
    ];
    metaLabels.forEach(([l, v], i) => {
      doc
        .fillColor(MUTED).text(l!, doc.page.margins.left, metaY + i * 16, { continued: true, width: 120 })
        .fillColor(DARK).text(` ${v}`, { width: PAGE_W - 120 });
    });

    doc
      .rect(doc.page.margins.left, metaY + metaLabels.length * 16 + 15, PAGE_W, 1)
      .fill("#e2e8f0");

    doc
      .fontSize(7.5)
      .fillColor(MUTED)
      .text(
        "This document contains Protected Health Information (PHI) metadata and security compliance data. " +
        "It is intended solely for authorized auditors and compliance personnel. Unauthorized disclosure, " +
        "reproduction, or distribution is strictly prohibited under HIPAA 45 CFR §164.502 and applicable regulations.",
        doc.page.margins.left,
        metaY + metaLabels.length * 16 + 25,
        { width: PAGE_W, lineGap: 2 }
      );

    drawPageFooter(doc);

    // ═══════════════ TABLE OF CONTENTS ═══════════════
    doc.addPage();
    sectionHeading("Table of Contents");
    const tocItems = [
      "1. Executive Summary",
      "2. Trust Service Criteria Scores",
      "3. Compliance Evidence Summary",
      "4. Evidence Detail Register",
      "5. Weekly Report History",
      ...(includeRemediation ? ["6. Automated Remediation Activity"] : []),
      `${includeRemediation ? "7" : "6"}. Attestation & Signatures`,
    ];
    tocItems.forEach((item) => {
      doc.fontSize(10).fillColor(DARK).text(item, doc.page.margins.left + 15, doc.y, { width: PAGE_W - 30 }).moveDown(0.4);
    });
    doc.moveDown(1);

    // ═══════════════ 1. EXECUTIVE SUMMARY ═══════════════
    doc.addPage();
    sectionHeading("1. Executive Summary");

    const overallScore = latestReport?.overallComplianceScore ?? 100;
    const scoreColor = overallScore >= 90 ? GREEN : overallScore >= 70 ? AMBER : RED;
    const scoreLabel = overallScore >= 90 ? "PASSING" : overallScore >= 70 ? "NEEDS ATTENTION" : "FAILING";

    doc
      .fontSize(9)
      .fillColor(DARK)
      .text(
        "This report provides a comprehensive summary of Tabula Medica's SOC 2 Type II compliance posture, " +
        "covering Trust Service Criteria (Security, Availability, Processing Integrity, Confidentiality, Privacy), " +
        "collected evidence, findings, remediation activity, and management recommendations.",
        { width: PAGE_W, lineGap: 2 }
      )
      .moveDown(0.8);

    doc
      .rect(doc.page.margins.left, doc.y, PAGE_W, 50)
      .fill(LIGHT_BG)
      .stroke("#e2e8f0");
    const boxY = doc.y - 50;
    doc
      .fontSize(22)
      .fillColor(scoreColor)
      .text(`${overallScore}%`, doc.page.margins.left + 15, boxY + 8)
      .fontSize(10)
      .fillColor(DARK)
      .text(`Overall Compliance Score — ${scoreLabel}`, doc.page.margins.left + 80, boxY + 14)
      .fontSize(8)
      .fillColor(MUTED)
      .text(`Based on ${stats.total} evidence items across ${Object.keys(stats.bySoc2Category).length} Trust Service Categories`, doc.page.margins.left + 80, boxY + 30);

    doc.moveDown(1);

    const summaryMetrics = [
      ["Total Evidence Items:", String(stats.total)],
      ["Active Findings:", String(stats.byStatus?.active ?? 0)],
      ["Pending Review:", String(stats.byStatus?.pending_review ?? 0)],
      ["Critical Severity:", String(allEvidence.filter(e => e.severity === "critical").length)],
      ["High Severity:", String(allEvidence.filter(e => e.severity === "high").length)],
    ];
    summaryMetrics.forEach(([l, v]) => labelValue(l!, v!));
    doc.moveDown(0.5);

    if (latestReport?.recommendations && latestReport.recommendations.length > 0) {
      doc.fontSize(9).fillColor(DARK).text("Key Recommendations:", { underline: true }).moveDown(0.3);
      latestReport.recommendations.forEach((rec) => {
        if (doc.y > doc.page.height - 80) doc.addPage();
        doc.fontSize(8.5).fillColor(DARK).text(`  •  ${rec}`, { width: PAGE_W - 20, lineGap: 1 }).moveDown(0.2);
      });
    }

    drawPageFooter(doc);

    // ═══════════════ 2. TRUST SERVICE CRITERIA SCORES ═══════════════
    doc.addPage();
    sectionHeading("2. Trust Service Criteria Scores");

    const soc2Scores: Record<string, number> = latestReport?.soc2Scores ?? {
      security: 100, availability: 100, processing_integrity: 100, confidentiality: 100, privacy: 100,
    };

    const tscLabels: Record<string, string> = {
      security: "Security (Common Criteria)",
      availability: "Availability",
      processing_integrity: "Processing Integrity",
      confidentiality: "Confidentiality",
      privacy: "Privacy",
    };

    Object.entries(soc2Scores).forEach(([cat, score]) => {
      if (doc.y > doc.page.height - 80) doc.addPage();
      const barY = doc.y;
      const barW = PAGE_W - 180;
      const fillW = (score / 100) * barW;
      const barColor = score >= 90 ? GREEN : score >= 70 ? AMBER : RED;

      doc
        .fontSize(9)
        .fillColor(DARK)
        .text(tscLabels[cat] || cat, doc.page.margins.left, barY, { width: 160 });

      doc
        .rect(doc.page.margins.left + 170, barY + 2, barW, 12)
        .fill("#e2e8f0")
        .rect(doc.page.margins.left + 170, barY + 2, fillW, 12)
        .fill(barColor);

      doc
        .fontSize(8.5)
        .fillColor(score >= 90 ? GREEN : DARK)
        .text(`${score}%`, doc.page.margins.left + 175 + barW, barY + 1);

      doc.y = barY + 22;
    });

    doc.moveDown(1);

    const categoryEvidence: Record<string, number> = {};
    allEvidence.forEach(e => {
      categoryEvidence[e.soc2Category] = (categoryEvidence[e.soc2Category] || 0) + 1;
    });

    doc.fontSize(9).fillColor(DARK).text("Evidence Distribution by Category:", { underline: true }).moveDown(0.3);
    Object.entries(categoryEvidence).forEach(([cat, count]) => {
      labelValue(tscLabels[cat] || cat, `${count} items`);
    });

    drawPageFooter(doc);

    // ═══════════════ 3. COMPLIANCE EVIDENCE SUMMARY ═══════════════
    doc.addPage();
    sectionHeading("3. Compliance Evidence Summary");

    doc.fontSize(9).fillColor(DARK).text("Evidence by Category:", { underline: true }).moveDown(0.3);
    Object.entries(stats.byCategory).forEach(([cat, count]) => {
      labelValue(cat.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), String(count));
    });
    doc.moveDown(0.5);

    doc.fontSize(9).fillColor(DARK).text("Evidence by Status:", { underline: true }).moveDown(0.3);
    Object.entries(stats.byStatus).forEach(([status, count]) => {
      labelValue(status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), String(count));
    });
    doc.moveDown(0.5);

    doc.fontSize(9).fillColor(DARK).text("Severity Breakdown:", { underline: true }).moveDown(0.3);
    const bySeverity: Record<string, number> = {};
    allEvidence.forEach(e => { bySeverity[e.severity] = (bySeverity[e.severity] || 0) + 1; });
    ["critical", "high", "medium", "low", "info"].forEach(sev => {
      if (bySeverity[sev]) {
        doc
          .fontSize(8.5)
          .fillColor(severityColor(sev))
          .text(`  ● ${sev.toUpperCase()}: ${bySeverity[sev]}`, { width: PAGE_W })
          .moveDown(0.15);
      }
    });

    drawPageFooter(doc);

    // ═══════════════ 4. EVIDENCE DETAIL REGISTER ═══════════════
    if (includeEvidence) {
      doc.addPage();
      sectionHeading("4. Evidence Detail Register");

      const headers = ["ID", "Title", "Category", "SOC 2", "Severity", "Status", "Date"];
      const colWidths = [35, 140, 75, 65, 50, 55, 60];
      const tableX = doc.page.margins.left;

      function drawTableHeader(y: number) {
        doc.rect(tableX, y, PAGE_W, 16).fill(NAVY);
        let x = tableX + 3;
        headers.forEach((h, i) => {
          doc.fontSize(7).fillColor("#ffffff").text(h, x, y + 4, { width: colWidths[i] });
          x += colWidths[i] + 4;
        });
        return y + 18;
      }

      let rowY = drawTableHeader(doc.y);
      const evidenceToShow = allEvidence.slice(0, 100);

      evidenceToShow.forEach((ev, idx) => {
        if (rowY > doc.page.height - 80) {
          drawPageFooter(doc);
          doc.addPage();
          rowY = drawTableHeader(doc.y);
        }

        if (idx % 2 === 0) {
          doc.rect(tableX, rowY, PAGE_W, 14).fill(LIGHT_BG);
        }

        let x = tableX + 3;
        const cells = [
          ev.id.substring(0, 8),
          ev.title.substring(0, 35),
          ev.category.replace(/_/g, " "),
          ev.soc2Category.replace(/_/g, " "),
          ev.severity,
          ev.status.replace(/_/g, " "),
          new Date(ev.createdAt).toLocaleDateString(),
        ];

        cells.forEach((cell, i) => {
          const color = i === 4 ? severityColor(ev.severity) : DARK;
          doc.fontSize(6.5).fillColor(color).text(cell, x, rowY + 3, { width: colWidths[i] });
          x += colWidths[i] + 4;
        });

        rowY += 14;
      });

      if (allEvidence.length > 100) {
        doc.moveDown(0.5).fontSize(8).fillColor(MUTED)
          .text(`Showing 100 of ${allEvidence.length} evidence items. Full register available upon request.`);
      }
    }

    drawPageFooter(doc);

    // ═══════════════ 5. WEEKLY REPORT HISTORY ═══════════════
    doc.addPage();
    sectionHeading("5. Weekly Report History");

    if (recentReports.length === 0) {
      doc.fontSize(9).fillColor(MUTED).text("No weekly reports have been generated yet.").moveDown(1);
    } else {
      recentReports.forEach((report) => {
        if (doc.y > doc.page.height - 130) {
          drawPageFooter(doc);
          doc.addPage();
        }

        doc
          .rect(doc.page.margins.left, doc.y, PAGE_W, 1)
          .fill("#e2e8f0");
        doc.moveDown(0.3);

        doc.fontSize(9.5).fillColor(DARK)
          .text(`Week: ${report.weekStartDate} — ${report.weekEndDate}`, { width: PAGE_W })
          .moveDown(0.15);

        labelValue("Overall Score:", `${report.overallComplianceScore}%`);
        labelValue("Status:", report.status.replace(/_/g, " ").toUpperCase());
        labelValue("Evidence Collected:", String(report.totalEvidenceCollected));
        labelValue("New Findings:", String(report.newFindings));
        labelValue("Resolved Findings:", String(report.resolvedFindings));
        labelValue("Generated By:", report.generatedBy);
        if (report.approvedBy) {
          labelValue("Approved By:", report.approvedBy);
        }

        if (report.criticalEvents && report.criticalEvents.length > 0) {
          doc.fontSize(8).fillColor(RED).text("  Critical Events:").moveDown(0.1);
          report.criticalEvents.forEach((evt) => {
            doc.fontSize(7.5).fillColor(DARK).text(`    • [${evt.type}] ${evt.description}`, { width: PAGE_W - 40 }).moveDown(0.1);
          });
        }

        doc.moveDown(0.6);
      });
    }

    drawPageFooter(doc);

    // ═══════════════ 6. AUTOMATED REMEDIATION ACTIVITY ═══════════════
    if (includeRemediation && remediationWorkflows.length > 0) {
      doc.addPage();
      sectionHeading("6. Automated Remediation Activity");

      if (remediationStats) {
        labelValue("Total Incidents:", String(remediationStats.total));
        labelValue("Active:", String(remediationStats.activeCount));
        labelValue("Resolved:", String(remediationStats.resolvedCount));
        doc.moveDown(0.3);

        if (Object.keys(remediationStats.bySeverity).length > 0) {
          doc.fontSize(8.5).fillColor(DARK).text("By Severity:").moveDown(0.15);
          Object.entries(remediationStats.bySeverity).forEach(([sev, count]) => {
            doc.fontSize(8).fillColor(severityColor(sev)).text(`  ● ${sev.toUpperCase()}: ${count}`).moveDown(0.1);
          });
          doc.moveDown(0.3);
        }
      }

      remediationWorkflows.slice(0, 20).forEach((wf: any) => {
        if (doc.y > doc.page.height - 140) {
          drawPageFooter(doc);
          doc.addPage();
        }

        doc.rect(doc.page.margins.left, doc.y, PAGE_W, 1).fill("#e2e8f0");
        doc.moveDown(0.3);

        doc.fontSize(9).fillColor(DARK).text(wf.title, { width: PAGE_W }).moveDown(0.1);
        labelValue("Trigger:", wf.triggerType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()));
        labelValue("Severity:", wf.severity.toUpperCase());
        labelValue("SOC 2 Control:", `${wf.soc2Category} / ${wf.controlId}`);
        labelValue("Status:", wf.status.replace(/_/g, " ").toUpperCase());
        labelValue("Ticket:", wf.ticketId || "N/A");
        labelValue("Account Flagged:", wf.accountFlagged ? `Yes (${wf.affectedUserEmail || "N/A"})` : "No");
        labelValue("Alert Channel:", wf.alertChannel);
        labelValue("Alert Recipients:", (wf.alertRecipients || []).join(", ") || "N/A");
        labelValue("Created:", new Date(wf.createdAt).toISOString());
        if (wf.resolvedBy) {
          labelValue("Resolved By:", wf.resolvedBy);
          labelValue("Resolution Notes:", wf.resolutionNotes || "—");
        }

        if (wf.incidentLogs && wf.incidentLogs.length > 0) {
          doc.moveDown(0.2).fontSize(7.5).fillColor(MUTED).text("  Incident Log Entries:").moveDown(0.1);
          wf.incidentLogs.slice(0, 8).forEach((log: any) => {
            if (doc.y > doc.page.height - 60) { drawPageFooter(doc); doc.addPage(); }
            const lvlColor = log.level === "CRITICAL" ? RED : log.level === "ERROR" ? AMBER : log.level === "WARN" ? "#b45309" : TEAL;
            doc
              .fontSize(6.5)
              .fillColor(MUTED).text(`    ${new Date(log.timestamp).toISOString().replace("T", " ").substring(0, 19)}`, { continued: true, width: 140 })
              .fillColor(lvlColor).text(` [${log.level}]`, { continued: true, width: 65 })
              .fillColor(DARK).text(` [${log.source}] ${log.message}`, { width: PAGE_W - 210 })
              .moveDown(0.05);
          });
        }

        doc.moveDown(0.6);
      });

      if (remediationWorkflows.length > 20) {
        doc.fontSize(8).fillColor(MUTED)
          .text(`Showing 20 of ${remediationWorkflows.length} remediation workflows. Full log available upon request.`);
      }
    }

    drawPageFooter(doc);

    // ═══════════════ ATTESTATION & SIGNATURES ═══════════════
    doc.addPage();
    const attestNum = includeRemediation && remediationWorkflows.length > 0 ? "7" : "6";
    sectionHeading(`${attestNum}. Attestation & Signatures`);

    doc
      .fontSize(9)
      .fillColor(DARK)
      .text(
        "I hereby attest that the information contained in this SOC 2 compliance report is accurate and complete " +
        "to the best of my knowledge. All evidence referenced herein has been collected through automated and manual " +
        "processes in accordance with AICPA Trust Service Criteria and HIPAA Security Rule (45 CFR Part 164, Subpart C).",
        { width: PAGE_W, lineGap: 3 }
      )
      .moveDown(1);

    doc
      .fontSize(9)
      .fillColor(DARK)
      .text(
        "This report has been generated by the Tabula Medica Automated Compliance Engine and reviewed for accuracy. " +
        "All timestamps are in UTC. PHI identifiers have been excluded from this document in compliance with the " +
        "HIPAA Minimum Necessary Standard (45 CFR §164.502(b)).",
        { width: PAGE_W, lineGap: 3 }
      )
      .moveDown(2);

    const sigY = doc.y;
    doc
      .moveTo(doc.page.margins.left, sigY)
      .lineTo(doc.page.margins.left + 250, sigY)
      .strokeColor(DARK)
      .lineWidth(0.8)
      .stroke();
    doc
      .fontSize(10)
      .fillColor(DARK)
      .text(signedBy, doc.page.margins.left, sigY + 6)
      .fontSize(8.5)
      .fillColor(MUTED)
      .text(signedTitle)
      .text(`Date: ${now.toISOString().split("T")[0]}`)
      .text(`Time: ${now.toISOString().split("T")[1].substring(0, 8)} UTC`);

    doc.moveDown(2.5);
    const sig2Y = doc.y;
    doc
      .moveTo(doc.page.margins.left, sig2Y)
      .lineTo(doc.page.margins.left + 250, sig2Y)
      .strokeColor(DARK)
      .lineWidth(0.8)
      .stroke();
    doc
      .fontSize(10)
      .fillColor(DARK)
      .text("External Auditor", doc.page.margins.left, sig2Y + 6)
      .fontSize(8.5)
      .fillColor(MUTED)
      .text("Signature & Date: _______________________________")
      .text("Firm: _______________________________");

    doc.moveDown(2);
    doc
      .rect(doc.page.margins.left, doc.y, PAGE_W, 50)
      .fill(LIGHT_BG);
    const disclaimerY = doc.y - 50;
    doc
      .fontSize(7)
      .fillColor(MUTED)
      .text(
        "HIPAA NOTICE: This document may contain references to security controls protecting electronic Protected Health Information (ePHI). " +
        "No individual patient data, PHI, or PII is included in this report. This document is classified as CONFIDENTIAL and must be " +
        "handled in accordance with your organization's information security policies. Unauthorized access, copying, or distribution " +
        "is prohibited. Retention period: 7 years per SOC 2 and HIPAA requirements.",
        doc.page.margins.left + 8,
        disclaimerY + 8,
        { width: PAGE_W - 16, lineGap: 2 }
      );

    drawPageFooter(doc);

    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(7)
        .fillColor(MUTED)
        .text(
          `Page ${i + 1} of ${totalPages}`,
          doc.page.margins.left,
          doc.page.height - 28,
          { align: "center", width: PAGE_W }
        );
    }

    doc.end();
    console.log(`[SOC2] PDF report generated: ${docId} (${totalPages} pages)`);
  } catch (error: any) {
    console.error("[SOC2] PDF export error:", error?.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate PDF report" });
    }
  }
});

export default router;
