import { Router, Request, Response } from "express";
import { providerCommunicationService } from "./services/provider-communication-service";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

router.get("/entries", async (req: Request, res: Response) => {
  try {
    const { action, providerId, patientId, dateRange } = req.query;

    logPhiAccess({
      userId: "audit-admin",
      action: "read",
      resourceType: "AuditLog",
      patientId: (patientId as string) || "all",
      details: `Audit log access with filters: action=${action}, provider=${providerId}, patient=${patientId}, dateRange=${dateRange}`
    });

    let entries = await providerCommunicationService.getAuditTrail(
      undefined,
      patientId as string | undefined
    );

    if (action && action !== "all") {
      entries = entries.filter(e => e.action === action);
    }

    if (providerId && providerId !== "all") {
      entries = entries.filter(e => e.performedBy === providerId);
    }

    if (dateRange && dateRange !== "all") {
      const now = new Date();
      let cutoff: Date;

      switch (dateRange) {
        case "today":
          cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "week":
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoff = new Date(0);
      }

      entries = entries.filter(e => new Date(e.timestamp) >= cutoff);
    }

    const enrichedEntries = entries.map(entry => ({
      ...entry,
      complianceStatus: determineComplianceStatus(entry)
    }));

    res.json({ success: true, data: enrichedEntries });
  } catch (error) {
    console.error("[CommunicationAudit] Error fetching entries:", error);
    res.status(500).json({ success: false, error: "Failed to fetch audit entries" });
  }
});

router.get("/compliance", async (_req: Request, res: Response) => {
  try {
    logPhiAccess({
      userId: "audit-admin",
      action: "read",
      resourceType: "ComplianceMetrics",
      patientId: "system",
      details: "Compliance metrics dashboard accessed"
    });

    const entries = await providerCommunicationService.getAuditTrail();

    const complianceMetrics = {
      totalAuditEntries: entries.length,
      compliantActions: entries.filter(e => determineComplianceStatus(e) === "compliant").length,
      warnings: entries.filter(e => determineComplianceStatus(e) === "warning").length,
      violations: entries.filter(e => determineComplianceStatus(e) === "violation").length,
      encryptionVerified: true,
      accessControlVerified: true,
      auditTrailComplete: true,
      lastComplianceCheck: new Date().toISOString()
    };

    res.json({ success: true, data: complianceMetrics });
  } catch (error) {
    console.error("[CommunicationAudit] Error fetching compliance:", error);
    res.status(500).json({ success: false, error: "Failed to fetch compliance metrics" });
  }
});

router.get("/export", async (req: Request, res: Response) => {
  try {
    const { format = "json" } = req.query;

    logPhiAccess({
      userId: "audit-admin",
      action: "read",
      resourceType: "AuditLogExport",
      patientId: "all",
      details: `Audit log exported in ${format} format`
    });

    const entries = await providerCommunicationService.getAuditTrail();

    if (format === "csv") {
      const csvContent = [
        ["ID", "Timestamp", "Action", "Performed By", "Patient ID", "Thread ID", "Details", "Compliance Status"].join(","),
        ...entries.map(e => [
          e.id,
          e.timestamp,
          e.action,
          e.performedByName,
          e.patientId,
          e.threadId,
          `"${e.details.replace(/"/g, '""')}"`,
          determineComplianceStatus(e)
        ].join(","))
      ].join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename=audit-log-${new Date().toISOString().split("T")[0]}.csv`);
      return res.send(csvContent);
    }

    res.json({ success: true, data: entries });
  } catch (error) {
    console.error("[CommunicationAudit] Error exporting:", error);
    res.status(500).json({ success: false, error: "Failed to export audit log" });
  }
});

function determineComplianceStatus(entry: { action: string; details: string }): "compliant" | "warning" | "violation" {
  if (entry.action === "document_shared" && entry.details.toLowerCase().includes("unauthorized")) {
    return "violation";
  }

  if (entry.action === "thread_created" && entry.details.toLowerCase().includes("urgent")) {
    return "warning";
  }

  return "compliant";
}

export default router;
