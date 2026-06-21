import { Router, Request, Response } from "express";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { logPhiAccess } from "./security/hipaa-audit";
import {
  insertReportScheduleSchema,
  insertGeneratedReportSchema,
  reportFrequencies,
  reportDataTypes,
  reportExportFormats,
  type ReportSchedule,
  type GeneratedReport,
  type ReportDataType,
  type ReportExportFormat,
} from "@shared/schema";

const router = Router();

const reportSchedules = new Map<string, ReportSchedule>();
const generatedReports = new Map<string, GeneratedReport>();

const NO_CDS_DISCLAIMER = "EDUCATIONAL INFORMATION ONLY: This report is for educational and informational purposes only. It does NOT constitute medical advice, diagnosis, or treatment recommendations. Always consult your healthcare provider for medical decisions.";

const SAMPLE_HEALTH_DATA = {
  vitals: [
    { date: "2026-01-20", type: "Blood Pressure", value: "128/82 mmHg", status: "Elevated" },
    { date: "2026-01-20", type: "Heart Rate", value: "72 bpm", status: "Normal" },
    { date: "2026-01-19", type: "Weight", value: "154 lbs", status: "Normal" },
    { date: "2026-01-18", type: "Temperature", value: "98.6°F", status: "Normal" },
  ],
  medications: [
    { name: "Metformin 500mg", dosage: "500mg twice daily", prescriber: "Dr. Sarah Chen", startDate: "2020-06-15", status: "Active" },
    { name: "Lisinopril 10mg", dosage: "10mg once daily", prescriber: "Dr. Sarah Chen", startDate: "2019-03-15", status: "Active" },
    { name: "Cetirizine 10mg", dosage: "10mg as needed", prescriber: "Dr. Michael Lee", startDate: "2015-04-01", status: "Active" },
  ],
  lab_results: [
    { test: "HbA1c", value: "6.8%", date: "2026-01-15", status: "Within target", reference: "< 7.0%" },
    { test: "Fasting Glucose", value: "118 mg/dL", date: "2026-01-15", status: "Slightly elevated", reference: "70-100 mg/dL" },
    { test: "Total Cholesterol", value: "195 mg/dL", date: "2026-01-15", status: "Normal", reference: "< 200 mg/dL" },
    { test: "LDL Cholesterol", value: "112 mg/dL", date: "2026-01-15", status: "Normal", reference: "< 130 mg/dL" },
  ],
  appointments: [
    { date: "2026-01-25", time: "10:00 AM", provider: "Dr. Sarah Chen", type: "Follow-up", location: "Main Clinic" },
    { date: "2026-02-15", time: "2:30 PM", provider: "Dr. Michael Lee", type: "Annual Physical", location: "Main Clinic" },
  ],
  conditions: [
    { name: "Type 2 Diabetes", status: "Active", diagnosedDate: "2020-06-15", provider: "Dr. Sarah Chen" },
    { name: "Hypertension", status: "Active", diagnosedDate: "2019-03-10", provider: "Dr. Sarah Chen" },
    { name: "Seasonal Allergies", status: "Active", diagnosedDate: "2015-04-01", provider: "Dr. Michael Lee" },
  ],
  allergies: [
    { allergen: "Penicillin", reaction: "Hives", severity: "Moderate" },
    { allergen: "Shellfish", reaction: "Anaphylaxis", severity: "Severe" },
  ],
  immunizations: [
    { vaccine: "COVID-19 (Pfizer)", date: "2025-10-15", provider: "CVS Pharmacy" },
    { vaccine: "Influenza", date: "2025-09-20", provider: "Dr. Sarah Chen, MD" },
    { vaccine: "Tdap", date: "2023-05-10", provider: "Dr. Sarah Chen, MD" },
  ],
  documents: [
    { name: "Lab Results - January 2026", type: "Lab Report", date: "2026-01-15", provider: "Quest Diagnostics" },
    { name: "Annual Physical Summary", type: "Visit Summary", date: "2025-12-10", provider: "Dr. Sarah Chen" },
  ],
  ai_insights: [
    { title: "Understanding Your HbA1c Results", content: "Your HbA1c of 6.8% indicates good blood sugar management. Ask your doctor about your personal target range.", date: "2026-01-18" },
    { title: "Blood Pressure Management Tips", content: "Regular monitoring, balanced diet, and physical activity may support healthy blood pressure.", date: "2026-01-16" },
  ],
  wearable_data: [
    { date: "2026-01-20", steps: 8542, activeMinutes: 45, sleepHours: 7.2, heartRateAvg: 68 },
    { date: "2026-01-19", steps: 10234, activeMinutes: 62, sleepHours: 6.8, heartRateAvg: 71 },
    { date: "2026-01-18", steps: 6891, activeMinutes: 38, sleepHours: 7.5, heartRateAvg: 69 },
  ],
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function calculateNextRunDate(frequency: string, fromDate: Date = new Date()): string {
  const next = new Date(fromDate);
  switch (frequency) {
    case "daily": next.setDate(next.getDate() + 1); break;
    case "weekly": next.setDate(next.getDate() + 7); break;
    case "biweekly": next.setDate(next.getDate() + 14); break;
    case "monthly": next.setMonth(next.getMonth() + 1); break;
  }
  return next.toISOString();
}

router.get("/api/report-schedules/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ success: false, error: "patientId is required" });
    }

    const schedules = Array.from(reportSchedules.values()).filter(s => s.patientId === patientId);

    await logPhiAccess({
      action: "read",
      resourceType: "ReportSchedule",
      patientId,
      userId: patientId,
      details: `Retrieved ${schedules.length} report schedules`,
    });

    res.json({ success: true, data: schedules });
  } catch (error) {
    console.error("Error fetching report schedules:", error);
    res.status(500).json({ success: false, error: "Failed to fetch report schedules" });
  }
});

router.post("/api/report-schedules", async (req: Request, res: Response) => {
  try {
    const validationResult = insertReportScheduleSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: validationResult.error.issues });
    }

    const data = validationResult.data;
    const now = new Date().toISOString();
    const schedule: ReportSchedule = {
      id: generateId(),
      patientId: data.patientId,
      profileId: data.profileId,
      name: data.name,
      frequency: data.frequency,
      dataTypes: data.dataTypes,
      exportFormat: data.exportFormat,
      dateRangeType: data.dateRangeType,
      customStartDate: data.customStartDate,
      customEndDate: data.customEndDate,
      emailRecipients: data.emailRecipients,
      isActive: data.isActive ?? true,
      nextRunAt: calculateNextRunDate(data.frequency),
      createdAt: now,
      updatedAt: now,
    };

    reportSchedules.set(schedule.id, schedule);

    await logPhiAccess({
      action: "write",
      resourceType: "ReportSchedule",
      patientId: data.patientId,
      userId: data.patientId,
      details: `Created report schedule: ${data.name}`,
    });

    res.json({ success: true, data: schedule });
  } catch (error) {
    console.error("Error creating report schedule:", error);
    res.status(500).json({ success: false, error: "Failed to create report schedule" });
  }
});

router.patch("/api/report-schedules/:scheduleId", async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const schedule = reportSchedules.get(scheduleId);

    if (!schedule) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }

    const updates = req.body;
    const updated: ReportSchedule = {
      ...schedule,
      ...updates,
      id: schedule.id,
      patientId: schedule.patientId,
      createdAt: schedule.createdAt,
      updatedAt: new Date().toISOString(),
    };

    if (updates.frequency && updates.frequency !== schedule.frequency) {
      updated.nextRunAt = calculateNextRunDate(updates.frequency);
    }

    reportSchedules.set(scheduleId, updated);

    await logPhiAccess({
      action: "write",
      resourceType: "ReportSchedule",
      patientId: schedule.patientId,
      userId: schedule.patientId,
      details: `Updated report schedule: ${updated.name}`,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating report schedule:", error);
    res.status(500).json({ success: false, error: "Failed to update report schedule" });
  }
});

router.delete("/api/report-schedules/:scheduleId", async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const schedule = reportSchedules.get(scheduleId);

    if (!schedule) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }

    reportSchedules.delete(scheduleId);

    await logPhiAccess({
      action: "delete",
      resourceType: "ReportSchedule",
      patientId: schedule.patientId,
      userId: schedule.patientId,
      details: `Deleted report schedule: ${schedule.name}`,
    });

    res.json({ success: true, message: "Schedule deleted" });
  } catch (error) {
    console.error("Error deleting report schedule:", error);
    res.status(500).json({ success: false, error: "Failed to delete report schedule" });
  }
});

router.get("/api/generated-reports/:patientId", async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    const reports = Array.from(generatedReports.values())
      .filter(r => r.patientId === patientId)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

    await logPhiAccess({
      action: "read",
      resourceType: "GeneratedReport",
      patientId,
      userId: patientId,
      details: `Retrieved ${reports.length} generated reports`,
    });

    res.json({ success: true, data: reports });
  } catch (error) {
    console.error("Error fetching generated reports:", error);
    res.status(500).json({ success: false, error: "Failed to fetch generated reports" });
  }
});

const generateReportRequestSchema = z.object({
  patientId: z.string().min(1),
  profileId: z.string().optional(),
  name: z.string().optional(),
  dataTypes: z.array(z.enum(reportDataTypes)).min(1),
  exportFormat: z.enum(reportExportFormats),
  dateRangeStart: z.string(),
  dateRangeEnd: z.string(),
});

router.post("/api/generated-reports/generate", async (req: Request, res: Response) => {
  try {
    const validationResult = generateReportRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ success: false, error: validationResult.error.issues });
    }

    const data = validationResult.data;
    const now = new Date().toISOString();
    const reportId = generateId();

    const report: GeneratedReport = {
      id: reportId,
      patientId: data.patientId,
      profileId: data.profileId,
      name: data.name || `Health Report - ${new Date().toLocaleDateString()}`,
      dataTypes: data.dataTypes,
      exportFormat: data.exportFormat,
      dateRangeStart: data.dateRangeStart,
      dateRangeEnd: data.dateRangeEnd,
      generatedAt: now,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      downloadCount: 0,
      status: "completed",
    };

    generatedReports.set(reportId, report);

    await logPhiAccess({
      action: "export",
      resourceType: "GeneratedReport",
      patientId: data.patientId,
      userId: data.patientId,
      details: `Generated ${data.exportFormat.toUpperCase()} report with data types: ${data.dataTypes.join(", ")}`,
    });

    res.json({ 
      success: true, 
      data: report,
      disclaimer: NO_CDS_DISCLAIMER,
    });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({ success: false, error: "Failed to generate report" });
  }
});

router.get("/api/generated-reports/:reportId/download", async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const patientId = req.query.patientId as string;

    if (!patientId) {
      return res.status(400).json({ success: false, error: "patientId query parameter is required" });
    }

    const report = generatedReports.get(reportId);
    if (!report) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }

    if (report.patientId !== patientId) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    report.downloadCount++;
    generatedReports.set(reportId, report);

    await logPhiAccess({
      action: "export",
      resourceType: "GeneratedReport",
      patientId,
      userId: patientId,
      resourceId: reportId,
      details: `Downloaded ${report.exportFormat.toUpperCase()} report: ${report.name}`,
    });

    const exportTimestamp = new Date().toISOString();

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-PHI-Export", "true");

    if (report.exportFormat === "pdf") {
      const pdfBuffer = await generatePDFReport(report, patientId);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="health-report-${exportTimestamp.split("T")[0]}.pdf"`);
      res.send(pdfBuffer);
    } else {
      const csvContent = generateCSVReport(report, patientId);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="health-data-${exportTimestamp.split("T")[0]}.csv"`);
      res.send(csvContent);
    }
  } catch (error) {
    console.error("Error downloading report:", error);
    res.status(500).json({ success: false, error: "Failed to download report" });
  }
});

async function generatePDFReport(report: GeneratedReport, patientId: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("Tabula Medica Health Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    doc.fontSize(10).text(`Report ID: ${report.id}`, { align: "center" });
    doc.moveDown();

    doc.fontSize(10).fillColor("red")
      .text(NO_CDS_DISCLAIMER, { align: "center" });
    doc.fillColor("black").moveDown();

    doc.fontSize(11).text(`Date Range: ${new Date(report.dateRangeStart).toLocaleDateString()} - ${new Date(report.dateRangeEnd).toLocaleDateString()}`);
    doc.text(`Data Types: ${report.dataTypes.join(", ")}`);
    doc.moveDown();

    for (const dataType of report.dataTypes) {
      doc.fontSize(14).text(formatDataTypeTitle(dataType), { underline: true });
      doc.moveDown(0.5);

      const data = SAMPLE_HEALTH_DATA[dataType as keyof typeof SAMPLE_HEALTH_DATA];
      if (Array.isArray(data)) {
        data.forEach((item: Record<string, unknown>) => {
          const itemText = Object.entries(item)
            .map(([k, v]) => `${formatKey(k)}: ${v}`)
            .join(" | ");
          doc.fontSize(10).text(`• ${itemText}`);
        });
      }
      doc.moveDown();
    }

    doc.end();
  });
}

function generateCSVReport(report: GeneratedReport, patientId: string): string {
  const lines: string[] = [];
  
  lines.push("# Tabula Medica Health Report");
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# ${NO_CDS_DISCLAIMER}`);
  lines.push("");

  for (const dataType of report.dataTypes) {
    lines.push(`## ${formatDataTypeTitle(dataType)}`);
    
    const data = SAMPLE_HEALTH_DATA[dataType as keyof typeof SAMPLE_HEALTH_DATA];
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]);
      lines.push(headers.join(","));
      data.forEach((item: Record<string, unknown>) => {
        const values = headers.map(h => `"${String(item[h] || "")}"`);
        lines.push(values.join(","));
      });
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatDataTypeTitle(dataType: string): string {
  return dataType.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function formatKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase()).trim();
}

router.get("/api/report-options", async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      frequencies: reportFrequencies,
      dataTypes: reportDataTypes.map(dt => ({
        id: dt,
        name: formatDataTypeTitle(dt),
        description: getDataTypeDescription(dt),
      })),
      exportFormats: reportExportFormats.map(f => ({
        id: f,
        name: f.toUpperCase(),
        description: f === "pdf" ? "Complete formatted document" : "Spreadsheet format for analysis",
      })),
      dateRangeOptions: [
        { id: "last_7_days", name: "Last 7 Days" },
        { id: "last_30_days", name: "Last 30 Days" },
        { id: "last_90_days", name: "Last 90 Days" },
        { id: "custom", name: "Custom Range" },
      ],
    },
  });
});

function getDataTypeDescription(dataType: string): string {
  const descriptions: Record<string, string> = {
    vitals: "Blood pressure, heart rate, weight, temperature",
    medications: "Current and past medications with dosages",
    lab_results: "Laboratory test results and reference ranges",
    appointments: "Upcoming and past appointments",
    conditions: "Active and resolved health conditions",
    allergies: "Known allergies and reactions",
    immunizations: "Vaccination history",
    documents: "Medical documents and reports",
    ai_insights: "AI-generated educational health insights",
    wearable_data: "Data from connected fitness devices",
  };
  return descriptions[dataType] || dataType;
}

export default router;
