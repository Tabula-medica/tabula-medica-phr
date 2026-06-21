import { Express, Request, Response } from "express";
import { z } from "zod";
import { publicHealthReportingService, AggregationCriteria, ExportOptions } from "./services/public-health-reporting-service";
import { logPhiAccess } from "./security/hipaa-audit";

const NO_CDS_DISCLAIMER = "IMPORTANT: This report is for public health surveillance and administrative purposes only. It does NOT constitute clinical decision support or medical advice.";

const AggregationCriteriaSchema = z.object({
  vaccineTypes: z.array(z.string()).optional(),
  ageGroups: z.array(z.enum(["0-4", "5-11", "12-17", "18-64", "65+"])).optional(),
  regions: z.array(z.string()).optional(),
  states: z.array(z.string()).optional(),
  counties: z.array(z.string()).optional(),
  statuses: z.array(z.enum(["completed", "entered-in-error", "not-done"])).optional(),
  dateRange: z.object({
    startDate: z.string(),
    endDate: z.string()
  }).optional(),
  facilityIds: z.array(z.string()).optional(),
  reportedToIIS: z.boolean().optional()
});

const GenerateReportSchema = z.object({
  reportType: z.enum(["coverage", "distribution", "compliance", "trend", "comprehensive"]),
  criteria: AggregationCriteriaSchema,
  title: z.string().optional()
});

const ExportOptionsSchema = z.object({
  format: z.enum(["csv", "fhir-bundle", "fhir-ndjson", "hl7v2"]),
  includePatientIdentifiers: z.boolean().default(false),
  deidentify: z.boolean().default(true),
  includeMetadata: z.boolean().default(true),
  dateFormat: z.enum(["iso", "us", "eu"]).default("iso")
});

export function registerPublicHealthReportingRoutes(app: Express): void {
  app.get("/api/public-health/dashboard", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string || "system";

      await logPhiAccess({
        userId,
        action: "read",
        resourceType: "ImmunizationDashboard",
        details: "Accessed public health immunization dashboard - Public health surveillance"
      });

      const metrics = await publicHealthReportingService.getDashboardMetrics(userId);

      res.json({
        success: true,
        metrics,
        disclaimer: NO_CDS_DISCLAIMER
      });
    } catch (error) {
      console.error("[PublicHealthReporting] Dashboard error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to load dashboard metrics"
      });
    }
  });

  app.get("/api/public-health/filters", async (req: Request, res: Response) => {
    try {
      const filters = await publicHealthReportingService.getAvailableFilters();
      res.json({
        success: true,
        filters
      });
    } catch (error) {
      console.error("[PublicHealthReporting] Filters error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to load available filters"
      });
    }
  });

  app.post("/api/public-health/reports/generate", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string || "system";
      const parsed = GenerateReportSchema.parse(req.body);

      await logPhiAccess({
        userId,
        action: "read",
        resourceType: "ImmunizationReport",
        details: `Generated ${parsed.reportType} report - Public health reporting`
      });

      const report = await publicHealthReportingService.generateReport(
        userId,
        parsed.reportType,
        parsed.criteria,
        parsed.title
      );

      res.json({
        success: true,
        report,
        disclaimer: NO_CDS_DISCLAIMER
      });
    } catch (error) {
      console.error("[PublicHealthReporting] Generate report error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Invalid request parameters",
          details: error.errors
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to generate report"
        });
      }
    }
  });

  app.get("/api/public-health/reports/:reportId", async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;
      const userId = req.headers["x-user-id"] as string || "system";

      await logPhiAccess({
        userId,
        action: "read",
        resourceType: "ImmunizationReport",
        resourceId: reportId,
        details: `Viewed report ${reportId} - Public health reporting`
      });

      const report = await publicHealthReportingService.getReport(reportId);
      
      if (!report) {
        return res.status(404).json({
          success: false,
          error: "Report not found"
        });
      }

      res.json({
        success: true,
        report,
        disclaimer: NO_CDS_DISCLAIMER
      });
    } catch (error) {
      console.error("[PublicHealthReporting] Get report error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve report"
      });
    }
  });

  app.get("/api/public-health/reports", async (req: Request, res: Response) => {
    try {
      const userId = req.headers["x-user-id"] as string || "system";

      const reports = await publicHealthReportingService.listReports(userId);

      res.json({
        success: true,
        reports: reports.map(r => ({
          id: r.id,
          reportType: r.reportType,
          title: r.title,
          generatedAt: r.generatedAt,
          recordCount: r.records.length,
          summary: r.summary.complianceStatus
        })),
        disclaimer: NO_CDS_DISCLAIMER
      });
    } catch (error) {
      console.error("[PublicHealthReporting] List reports error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to list reports"
      });
    }
  });

  app.post("/api/public-health/reports/:reportId/export", async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;
      const userId = req.headers["x-user-id"] as string || "system";
      const options = ExportOptionsSchema.parse(req.body);

      await logPhiAccess({
        userId,
        action: "export",
        resourceType: "ImmunizationReport",
        resourceId: reportId,
        details: `Exported report ${reportId} in ${options.format} format - Public health data export`
      });

      let exportData: string | object;
      let contentType: string;
      let filename: string;

      switch (options.format) {
        case "csv":
          exportData = await publicHealthReportingService.exportToCSV(reportId, options);
          contentType = "text/csv";
          filename = `public-health-report-${reportId}.csv`;
          break;
        case "fhir-bundle":
          exportData = await publicHealthReportingService.exportToFHIRBundle(reportId, options);
          contentType = "application/fhir+json";
          filename = `public-health-report-${reportId}.json`;
          break;
        case "fhir-ndjson":
          exportData = await publicHealthReportingService.exportToNDJSON(reportId, options);
          contentType = "application/ndjson";
          filename = `public-health-report-${reportId}.ndjson`;
          break;
        default:
          return res.status(400).json({
            success: false,
            error: `Export format ${options.format} not yet supported`
          });
      }

      res.json({
        success: true,
        format: options.format,
        filename,
        contentType,
        data: exportData,
        disclaimer: NO_CDS_DISCLAIMER
      });
    } catch (error) {
      console.error("[PublicHealthReporting] Export error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: "Invalid export options",
          details: error.errors
        });
      } else {
        res.status(500).json({
          success: false,
          error: "Failed to export report"
        });
      }
    }
  });

  app.post("/api/public-health/reports/:reportId/download", async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;
      const userId = req.headers["x-user-id"] as string || "system";
      const options = ExportOptionsSchema.parse(req.body);

      await logPhiAccess({
        userId,
        action: "export",
        resourceType: "ImmunizationReport",
        resourceId: reportId,
        details: `Downloaded report ${reportId} in ${options.format} format - Public health data download`
      });

      let exportData: string | object;
      let contentType: string;
      let filename: string;

      switch (options.format) {
        case "csv":
          exportData = await publicHealthReportingService.exportToCSV(reportId, options);
          contentType = "text/csv";
          filename = `public-health-report-${reportId}.csv`;
          res.setHeader("Content-Type", contentType);
          res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
          return res.send(exportData);
        case "fhir-bundle":
          exportData = await publicHealthReportingService.exportToFHIRBundle(reportId, options);
          contentType = "application/fhir+json";
          filename = `public-health-report-${reportId}.json`;
          res.setHeader("Content-Type", contentType);
          res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
          return res.json(exportData);
        case "fhir-ndjson":
          exportData = await publicHealthReportingService.exportToNDJSON(reportId, options);
          contentType = "application/ndjson";
          filename = `public-health-report-${reportId}.ndjson`;
          res.setHeader("Content-Type", contentType);
          res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
          return res.send(exportData);
        default:
          return res.status(400).json({
            success: false,
            error: `Export format ${options.format} not yet supported`
          });
      }
    } catch (error) {
      console.error("[PublicHealthReporting] Download error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to download report"
      });
    }
  });

  console.log("[PublicHealthReporting] Routes registered at /api/public-health/*");
}
