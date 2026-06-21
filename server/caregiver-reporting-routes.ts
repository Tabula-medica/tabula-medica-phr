import { Router, Request, Response } from "express";
import PDFDocument from "pdfkit";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

// In-memory storage for reports and configurations
const reportConfigurationsStore = new Map<string, ReportConfiguration>();
const savedReportsStore = new Map<string, SavedReport>();
const scheduledReportsStore = new Map<string, ScheduledReport>();

// Types
interface ReportConfiguration {
  id: string;
  caregiverId: string;
  name: string;
  description: string;
  reportType: "patient_status" | "adherence_trends" | "critical_alerts" | "comprehensive" | "custom";
  dateRange: {
    type: "last_7_days" | "last_30_days" | "last_90_days" | "custom";
    startDate?: string;
    endDate?: string;
  };
  metrics: string[];
  filters: {
    patientIds?: string[];
    alertSeverities?: string[];
    medicationCategories?: string[];
  };
  visualization: {
    chartTypes: string[];
    showTables: boolean;
    showSummary: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface SavedReport {
  id: string;
  configurationId: string;
  caregiverId: string;
  name: string;
  generatedAt: string;
  dateRangeStart: string;
  dateRangeEnd: string;
  data: ReportData;
  exportFormats: string[];
}

interface ScheduledReport {
  id: string;
  configurationId: string;
  caregiverId: string;
  frequency: "daily" | "weekly" | "monthly";
  nextRunAt: string;
  recipients: string[];
  format: "pdf" | "csv" | "both";
  enabled: boolean;
}

interface ReportData {
  summary: {
    totalPatients: number;
    overallAdherenceRate: number;
    criticalAlertsCount: number;
    resolvedAlertsCount: number;
    averageHealthScore: number;
    trendsDirection: "improving" | "stable" | "declining";
  };
  patientStatus: PatientStatusData[];
  adherenceTrends: AdherenceTrendData[];
  criticalAlerts: CriticalAlertData[];
  vitalsTrends: VitalsTrendData[];
  appointmentMetrics: AppointmentMetricData;
}

interface PatientStatusData {
  patientId: string;
  patientName: string;
  currentStatus: "stable" | "attention_needed" | "critical";
  healthScore: number;
  lastUpdated: string;
  activeMedications: number;
  adherenceRate: number;
  pendingAlerts: number;
}

interface AdherenceTrendData {
  date: string;
  overallRate: number;
  byCategory: Record<string, number>;
  missedDoses: number;
  takenDoses: number;
}

interface CriticalAlertData {
  id: string;
  patientId: string;
  patientName: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  status: "active" | "acknowledged" | "resolved";
}

interface VitalsTrendData {
  date: string;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  heartRate: number;
  weight: number;
  bloodGlucose: number;
}

interface AppointmentMetricData {
  totalScheduled: number;
  attended: number;
  missed: number;
  cancelled: number;
  attendanceRate: number;
  byMonth: { month: string; attended: number; missed: number; total: number }[];
}

// Helper function to generate sample report data
function generateSampleReportData(
  dateRangeStart: string,
  dateRangeEnd: string,
  patientIds?: string[]
): ReportData {
  const patients = patientIds?.length ? patientIds : ["patient-1", "patient-2", "patient-3"];
  
  // Generate date range array
  const startDate = new Date(dateRangeStart);
  const endDate = new Date(dateRangeEnd);
  const dateRange: string[] = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dateRange.push(d.toISOString().split("T")[0]);
  }

  // Sample patient status data
  const allPatients: PatientStatusData[] = [
    {
      patientId: "patient-1",
      patientName: "John Smith",
      currentStatus: "stable" as const,
      healthScore: 82,
      lastUpdated: new Date().toISOString(),
      activeMedications: 5,
      adherenceRate: 94,
      pendingAlerts: 0,
    },
    {
      patientId: "patient-2",
      patientName: "Mary Johnson",
      currentStatus: "attention_needed" as const,
      healthScore: 68,
      lastUpdated: new Date().toISOString(),
      activeMedications: 8,
      adherenceRate: 76,
      pendingAlerts: 2,
    },
    {
      patientId: "patient-3",
      patientName: "Robert Williams",
      currentStatus: "critical" as const,
      healthScore: 45,
      lastUpdated: new Date().toISOString(),
      activeMedications: 12,
      adherenceRate: 58,
      pendingAlerts: 5,
    },
  ];
  const patientStatus = allPatients.filter((p) => patients.includes(p.patientId));

  // Sample adherence trends
  const adherenceTrends: AdherenceTrendData[] = dateRange.slice(-30).map((date, index) => ({
    date,
    overallRate: 75 + Math.random() * 20,
    byCategory: {
      cardiovascular: 80 + Math.random() * 15,
      diabetes: 70 + Math.random() * 20,
      supplements: 85 + Math.random() * 10,
    },
    missedDoses: Math.floor(Math.random() * 3),
    takenDoses: 10 + Math.floor(Math.random() * 5),
  }));

  // Sample critical alerts
  const allAlerts: CriticalAlertData[] = [
    {
      id: "alert-1",
      patientId: "patient-3",
      patientName: "Robert Williams",
      type: "vital_sign_abnormal",
      severity: "critical" as const,
      message: "Blood pressure reading 180/110 mmHg - significantly elevated",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      status: "active" as const,
    },
    {
      id: "alert-2",
      patientId: "patient-3",
      patientName: "Robert Williams",
      type: "medication_missed",
      severity: "high" as const,
      message: "Multiple doses of Metformin missed in the past 48 hours",
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      status: "active" as const,
    },
    {
      id: "alert-3",
      patientId: "patient-2",
      patientName: "Mary Johnson",
      type: "appointment_missed",
      severity: "medium" as const,
      message: "Missed scheduled appointment with Dr. Chen",
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      acknowledgedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
      status: "acknowledged" as const,
    },
    {
      id: "alert-4",
      patientId: "patient-1",
      patientName: "John Smith",
      type: "refill_needed",
      severity: "low" as const,
      message: "Lisinopril prescription needs refill in 5 days",
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      status: "resolved" as const,
    },
  ];
  const criticalAlerts = allAlerts.filter((a) => patients.includes(a.patientId));

  // Sample vitals trends
  const vitalsTrends: VitalsTrendData[] = dateRange.slice(-14).map((date) => ({
    date,
    bloodPressureSystolic: 115 + Math.floor(Math.random() * 25),
    bloodPressureDiastolic: 70 + Math.floor(Math.random() * 15),
    heartRate: 65 + Math.floor(Math.random() * 20),
    weight: 175 + Math.random() * 5,
    bloodGlucose: 95 + Math.floor(Math.random() * 30),
  }));

  // Sample appointment metrics
  const appointmentMetrics: AppointmentMetricData = {
    totalScheduled: 24,
    attended: 20,
    missed: 2,
    cancelled: 2,
    attendanceRate: 83.3,
    byMonth: [
      { month: "Oct 2025", attended: 6, missed: 1, total: 7 },
      { month: "Nov 2025", attended: 7, missed: 0, total: 7 },
      { month: "Dec 2025", attended: 5, missed: 1, total: 6 },
      { month: "Jan 2026", attended: 2, missed: 0, total: 4 },
    ],
  };

  const averageAdherence = adherenceTrends.reduce((sum, t) => sum + t.overallRate, 0) / adherenceTrends.length;
  const averageHealthScore = patientStatus.reduce((sum, p) => sum + p.healthScore, 0) / patientStatus.length;
  
  // Determine trend direction
  const recentAdherence = adherenceTrends.slice(-7).reduce((sum, t) => sum + t.overallRate, 0) / 7;
  const olderAdherence = adherenceTrends.slice(0, 7).reduce((sum, t) => sum + t.overallRate, 0) / 7;
  const trendsDirection = recentAdherence > olderAdherence + 2 ? "improving" : 
                          recentAdherence < olderAdherence - 2 ? "declining" : "stable";

  return {
    summary: {
      totalPatients: patientStatus.length,
      overallAdherenceRate: Math.round(averageAdherence * 10) / 10,
      criticalAlertsCount: criticalAlerts.filter((a) => a.status === "active").length,
      resolvedAlertsCount: criticalAlerts.filter((a) => a.status === "resolved").length,
      averageHealthScore: Math.round(averageHealthScore),
      trendsDirection,
    },
    patientStatus,
    adherenceTrends,
    criticalAlerts,
    vitalsTrends,
    appointmentMetrics,
  };
}

// Calculate date range based on type
function getDateRange(dateRange: ReportConfiguration["dateRange"]): { startDate: string; endDate: string } {
  const endDate = new Date();
  let startDate = new Date();

  switch (dateRange.type) {
    case "last_7_days":
      startDate.setDate(endDate.getDate() - 7);
      break;
    case "last_30_days":
      startDate.setDate(endDate.getDate() - 30);
      break;
    case "last_90_days":
      startDate.setDate(endDate.getDate() - 90);
      break;
    case "custom":
      if (dateRange.startDate && dateRange.endDate) {
        return { startDate: dateRange.startDate, endDate: dateRange.endDate };
      }
      startDate.setDate(endDate.getDate() - 30);
      break;
  }

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
}

// Generate CSV from report data
function generateCSV(data: ReportData, reportName: string): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`# ${reportName}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push("");

  // Summary section
  lines.push("## Summary");
  lines.push("Metric,Value");
  lines.push(`Total Patients,${data.summary.totalPatients}`);
  lines.push(`Overall Adherence Rate,${data.summary.overallAdherenceRate}%`);
  lines.push(`Critical Alerts,${data.summary.criticalAlertsCount}`);
  lines.push(`Resolved Alerts,${data.summary.resolvedAlertsCount}`);
  lines.push(`Average Health Score,${data.summary.averageHealthScore}`);
  lines.push(`Trends Direction,${data.summary.trendsDirection}`);
  lines.push("");

  // Patient Status section
  lines.push("## Patient Status");
  lines.push("Patient Name,Status,Health Score,Active Medications,Adherence Rate,Pending Alerts");
  data.patientStatus.forEach((p) => {
    lines.push(`${p.patientName},${p.currentStatus},${p.healthScore},${p.activeMedications},${p.adherenceRate}%,${p.pendingAlerts}`);
  });
  lines.push("");

  // Adherence Trends section
  lines.push("## Adherence Trends");
  lines.push("Date,Overall Rate,Missed Doses,Taken Doses");
  data.adherenceTrends.forEach((t) => {
    lines.push(`${t.date},${t.overallRate.toFixed(1)}%,${t.missedDoses},${t.takenDoses}`);
  });
  lines.push("");

  // Critical Alerts section
  lines.push("## Critical Alerts");
  lines.push("Patient,Type,Severity,Message,Status,Created At");
  data.criticalAlerts.forEach((a) => {
    lines.push(`${a.patientName},${a.type},${a.severity},"${a.message}",${a.status},${a.createdAt}`);
  });
  lines.push("");

  // Appointment Metrics section
  lines.push("## Appointment Metrics");
  lines.push("Metric,Value");
  lines.push(`Total Scheduled,${data.appointmentMetrics.totalScheduled}`);
  lines.push(`Attended,${data.appointmentMetrics.attended}`);
  lines.push(`Missed,${data.appointmentMetrics.missed}`);
  lines.push(`Cancelled,${data.appointmentMetrics.cancelled}`);
  lines.push(`Attendance Rate,${data.appointmentMetrics.attendanceRate}%`);

  return lines.join("\n");
}

// Get available report templates
router.get("/api/caregiver/reports/templates", (req: Request, res: Response) => {
  const caregiverId = (req as any).user?.id || "caregiver-default";

  logPhiAccess({
    userId: caregiverId,
    action: "read",
    resourceType: "report_templates",
    resourceId: "all",
    details: "Retrieved available report templates",
  });

  const templates = [
    {
      id: "patient_status",
      name: "Patient Status Report",
      description: "Overview of all patients' current health status, including health scores, medication counts, and pending alerts",
      metrics: ["health_score", "medication_count", "adherence_rate", "pending_alerts", "status_breakdown"],
      recommendedCharts: ["bar", "pie"],
    },
    {
      id: "adherence_trends",
      name: "Medication Adherence Trends",
      description: "Track medication adherence over time with category breakdowns and missed dose analysis",
      metrics: ["overall_adherence", "category_adherence", "missed_doses", "taken_doses", "trend_analysis"],
      recommendedCharts: ["line", "area"],
    },
    {
      id: "critical_alerts",
      name: "Critical Alerts Report",
      description: "Comprehensive view of all alerts by severity, type, and resolution status",
      metrics: ["alert_count", "severity_distribution", "resolution_time", "alert_types"],
      recommendedCharts: ["bar", "pie", "timeline"],
    },
    {
      id: "comprehensive",
      name: "Comprehensive Health Report",
      description: "Complete health overview including vitals, medications, appointments, and alerts",
      metrics: ["all"],
      recommendedCharts: ["line", "bar", "pie", "area"],
    },
    {
      id: "custom",
      name: "Custom Report",
      description: "Build your own report with selected metrics and visualizations",
      metrics: [],
      recommendedCharts: [],
    },
  ];

  res.json({ templates });
});

// Get saved report configurations
router.get("/api/caregiver/reports/configurations", (req: Request, res: Response) => {
  const caregiverId = (req as any).user?.id || "caregiver-default";

  logPhiAccess({
    userId: caregiverId,
    action: "read",
    resourceType: "report_configurations",
    resourceId: "all",
    details: "Retrieved saved report configurations",
  });

  const configurations = Array.from(reportConfigurationsStore.values())
    .filter((config) => config.caregiverId === caregiverId);

  res.json({ configurations });
});

// Create or update report configuration
router.post("/api/caregiver/reports/configurations", (req: Request, res: Response) => {
  const caregiverId = (req as any).user?.id || "caregiver-default";
  const { id, name, description, reportType, dateRange, metrics, filters, visualization } = req.body;

  if (!name || !reportType) {
    return res.status(400).json({ error: "Name and report type are required" });
  }

  const configId = id || `config-${Date.now()}`;
  const now = new Date().toISOString();

  const configuration: ReportConfiguration = {
    id: configId,
    caregiverId,
    name,
    description: description || "",
    reportType,
    dateRange: dateRange || { type: "last_30_days" },
    metrics: metrics || [],
    filters: filters || {},
    visualization: visualization || { chartTypes: ["line", "bar"], showTables: true, showSummary: true },
    createdAt: reportConfigurationsStore.get(configId)?.createdAt || now,
    updatedAt: now,
  };

  reportConfigurationsStore.set(configId, configuration);

  logPhiAccess({
    userId: caregiverId,
    action: "write",
    resourceType: "report_configuration",
    resourceId: configId,
    details: `${id ? "Updated" : "Created"} report configuration: ${name}`,
  });

  res.json({ configuration, message: `Report configuration ${id ? "updated" : "created"} successfully` });
});

// Delete report configuration
router.delete("/api/caregiver/reports/configurations/:configId", (req: Request, res: Response) => {
  const caregiverId = (req as any).user?.id || "caregiver-default";
  const { configId } = req.params;

  const config = reportConfigurationsStore.get(configId);
  if (!config || config.caregiverId !== caregiverId) {
    return res.status(404).json({ error: "Configuration not found" });
  }

  reportConfigurationsStore.delete(configId);

  logPhiAccess({
    userId: caregiverId,
    action: "delete",
    resourceType: "report_configuration",
    resourceId: configId,
    details: `Deleted report configuration: ${config.name}`,
  });

  res.json({ message: "Configuration deleted successfully" });
});

// Generate report data
router.post("/api/caregiver/reports/generate", (req: Request, res: Response) => {
  const caregiverId = (req as any).user?.id || "caregiver-default";
  const { configurationId, reportType, dateRange, filters } = req.body;

  let config: ReportConfiguration | undefined;

  if (configurationId) {
    config = reportConfigurationsStore.get(configurationId);
    if (!config || config.caregiverId !== caregiverId) {
      return res.status(404).json({ error: "Configuration not found" });
    }
  }

  const effectiveDateRange = config?.dateRange || dateRange || { type: "last_30_days" };
  const effectiveFilters = config?.filters || filters || {};

  const { startDate, endDate } = getDateRange(effectiveDateRange);
  const reportData = generateSampleReportData(startDate, endDate, effectiveFilters.patientIds);

  logPhiAccess({
    userId: caregiverId,
    action: "read",
    resourceType: "report_data",
    resourceId: configurationId || "ad-hoc",
    details: `Generated report data for ${startDate} to ${endDate}`,
  });

  res.json({
    reportData,
    metadata: {
      generatedAt: new Date().toISOString(),
      dateRangeStart: startDate,
      dateRangeEnd: endDate,
      reportType: config?.reportType || reportType || "comprehensive",
      patientCount: reportData.patientStatus.length,
    },
  });
});

// Export report as CSV
router.post("/api/caregiver/reports/export/csv", (req: Request, res: Response) => {
  const caregiverId = (req as any).user?.id || "caregiver-default";
  const { reportData, reportName } = req.body;

  if (!reportData) {
    return res.status(400).json({ error: "Report data is required" });
  }

  const csvContent = generateCSV(reportData, reportName || "Caregiver Report");

  logPhiAccess({
    userId: caregiverId,
    action: "export",
    resourceType: "report",
    resourceId: "csv-export",
    details: `Exported report as CSV: ${reportName || "Unnamed Report"}`,
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${reportName || "report"}-${Date.now()}.csv"`);
  res.send(csvContent);
});

// Export report as PDF
router.post("/api/caregiver/reports/export/pdf", (req: Request, res: Response) => {
  const caregiverId = (req as any).user?.id || "caregiver-default";
  const { reportData, reportName, metadata } = req.body;

  if (!reportData) {
    return res.status(400).json({ error: "Report data is required" });
  }

  logPhiAccess({
    userId: caregiverId,
    action: "export",
    resourceType: "report",
    resourceId: "pdf-export",
    details: `Exported report as PDF: ${reportName || "Unnamed Report"}`,
  });

  try {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(buffers);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${reportName || "report"}-${Date.now()}.pdf"`);
      res.send(pdfBuffer);
    });

    // Title
    doc.fontSize(24).font("Helvetica-Bold").text(reportName || "Caregiver Report", { align: "center" });
    doc.moveDown();
    doc.fontSize(10).font("Helvetica").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
    if (metadata?.dateRangeStart && metadata?.dateRangeEnd) {
      doc.text(`Date Range: ${metadata.dateRangeStart} to ${metadata.dateRangeEnd}`, { align: "center" });
    }
    doc.moveDown(2);

    // HIPAA Compliance Notice
    doc.fontSize(8).fillColor("#666666")
      .text("CONFIDENTIAL - This report contains Protected Health Information (PHI) and is intended solely for the authorized recipient. Unauthorized disclosure is prohibited.", { align: "center" });
    doc.fillColor("#000000");
    doc.moveDown(2);

    // Summary Section
    doc.fontSize(16).font("Helvetica-Bold").text("Executive Summary");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica");
    
    const summary = reportData.summary;
    doc.text(`Total Patients: ${summary.totalPatients}`);
    doc.text(`Overall Adherence Rate: ${summary.overallAdherenceRate}%`);
    doc.text(`Active Critical Alerts: ${summary.criticalAlertsCount}`);
    doc.text(`Resolved Alerts: ${summary.resolvedAlertsCount}`);
    doc.text(`Average Health Score: ${summary.averageHealthScore}/100`);
    doc.text(`Overall Trends: ${summary.trendsDirection.charAt(0).toUpperCase() + summary.trendsDirection.slice(1)}`);
    doc.moveDown(2);

    // Patient Status Section
    doc.fontSize(16).font("Helvetica-Bold").text("Patient Status Overview");
    doc.moveDown(0.5);

    reportData.patientStatus.forEach((patient: PatientStatusData) => {
      const statusColor = patient.currentStatus === "stable" ? "#22c55e" :
                          patient.currentStatus === "attention_needed" ? "#eab308" : "#ef4444";
      
      doc.fontSize(12).font("Helvetica-Bold").text(patient.patientName);
      doc.fontSize(10).font("Helvetica");
      doc.fillColor(statusColor).text(`Status: ${patient.currentStatus.replace("_", " ").toUpperCase()}`);
      doc.fillColor("#000000");
      doc.text(`Health Score: ${patient.healthScore}/100 | Medications: ${patient.activeMedications} | Adherence: ${patient.adherenceRate}%`);
      if (patient.pendingAlerts > 0) {
        doc.fillColor("#ef4444").text(`Pending Alerts: ${patient.pendingAlerts}`);
        doc.fillColor("#000000");
      }
      doc.moveDown();
    });
    doc.moveDown();

    // Critical Alerts Section
    if (reportData.criticalAlerts.length > 0) {
      doc.fontSize(16).font("Helvetica-Bold").text("Critical Alerts");
      doc.moveDown(0.5);

      reportData.criticalAlerts.forEach((alert: CriticalAlertData) => {
        const severityColor = alert.severity === "critical" ? "#ef4444" :
                              alert.severity === "high" ? "#f97316" :
                              alert.severity === "medium" ? "#eab308" : "#22c55e";

        doc.fontSize(11).font("Helvetica-Bold").fillColor(severityColor)
          .text(`[${alert.severity.toUpperCase()}] ${alert.patientName}`);
        doc.fontSize(10).font("Helvetica").fillColor("#000000");
        doc.text(`Type: ${alert.type.replace(/_/g, " ")}`);
        doc.text(`Message: ${alert.message}`);
        doc.text(`Status: ${alert.status} | Created: ${new Date(alert.createdAt).toLocaleString()}`);
        doc.moveDown();
      });
    }
    doc.moveDown();

    // Appointment Metrics Section
    doc.fontSize(16).font("Helvetica-Bold").text("Appointment Metrics");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Total Scheduled: ${reportData.appointmentMetrics.totalScheduled}`);
    doc.text(`Attended: ${reportData.appointmentMetrics.attended} (${reportData.appointmentMetrics.attendanceRate}%)`);
    doc.text(`Missed: ${reportData.appointmentMetrics.missed}`);
    doc.text(`Cancelled: ${reportData.appointmentMetrics.cancelled}`);
    doc.moveDown(2);

    // Footer
    doc.fontSize(8).fillColor("#666666")
      .text("This document is generated by Tabula Medica and is compliant with HIPAA regulations.", { align: "center" });
    doc.text("For questions, please contact your healthcare provider.", { align: "center" });

    doc.end();
  } catch (error) {
    console.error("[CaregiverReporting] PDF generation error:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// Save generated report
router.post("/api/caregiver/reports/save", (req: Request, res: Response) => {
  const caregiverId = (req as any).user?.id || "caregiver-default";
  const { configurationId, name, reportData, dateRangeStart, dateRangeEnd } = req.body;

  if (!reportData || !name) {
    return res.status(400).json({ error: "Report data and name are required" });
  }

  const reportId = `report-${Date.now()}`;
  const savedReport: SavedReport = {
    id: reportId,
    configurationId: configurationId || "",
    caregiverId,
    name,
    generatedAt: new Date().toISOString(),
    dateRangeStart: dateRangeStart || "",
    dateRangeEnd: dateRangeEnd || "",
    data: reportData,
    exportFormats: ["pdf", "csv"],
  };

  savedReportsStore.set(reportId, savedReport);

  logPhiAccess({
    userId: caregiverId,
    action: "write",
    resourceType: "saved_report",
    resourceId: reportId,
    details: `Saved report: ${name}`,
  });

  res.json({ report: savedReport, message: "Report saved successfully" });
});

// Get saved reports
router.get("/api/caregiver/reports/saved", (req: Request, res: Response) => {
  const caregiverId = (req as any).user?.id || "caregiver-default";

  logPhiAccess({
    userId: caregiverId,
    action: "read",
    resourceType: "saved_reports",
    resourceId: "all",
    details: "Retrieved saved reports",
  });

  const reports = Array.from(savedReportsStore.values())
    .filter((report) => report.caregiverId === caregiverId)
    .map((report) => ({
      id: report.id,
      name: report.name,
      generatedAt: report.generatedAt,
      dateRangeStart: report.dateRangeStart,
      dateRangeEnd: report.dateRangeEnd,
      exportFormats: report.exportFormats,
    }));

  res.json({ reports });
});

// Get saved report by ID
router.get("/api/caregiver/reports/saved/:reportId", (req: Request, res: Response) => {
  const caregiverId = (req as any).user?.id || "caregiver-default";
  const { reportId } = req.params;

  const report = savedReportsStore.get(reportId);
  if (!report || report.caregiverId !== caregiverId) {
    return res.status(404).json({ error: "Report not found" });
  }

  logPhiAccess({
    userId: caregiverId,
    action: "read",
    resourceType: "saved_report",
    resourceId: reportId,
    details: `Retrieved saved report: ${report.name}`,
  });

  res.json({ report });
});

// Delete saved report
router.delete("/api/caregiver/reports/saved/:reportId", (req: Request, res: Response) => {
  const caregiverId = (req as any).user?.id || "caregiver-default";
  const { reportId } = req.params;

  const report = savedReportsStore.get(reportId);
  if (!report || report.caregiverId !== caregiverId) {
    return res.status(404).json({ error: "Report not found" });
  }

  savedReportsStore.delete(reportId);

  logPhiAccess({
    userId: caregiverId,
    action: "delete",
    resourceType: "saved_report",
    resourceId: reportId,
    details: `Deleted saved report: ${report.name}`,
  });

  res.json({ message: "Report deleted successfully" });
});

// Schedule report
router.post("/api/caregiver/reports/schedule", (req: Request, res: Response) => {
  const caregiverId = (req as any).user?.id || "caregiver-default";
  const { configurationId, frequency, recipients, format } = req.body;

  if (!configurationId || !frequency) {
    return res.status(400).json({ error: "Configuration ID and frequency are required" });
  }

  const config = reportConfigurationsStore.get(configurationId);
  if (!config || config.caregiverId !== caregiverId) {
    return res.status(404).json({ error: "Configuration not found" });
  }

  const scheduleId = `schedule-${Date.now()}`;
  const now = new Date();
  let nextRun = new Date(now);

  switch (frequency) {
    case "daily":
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(8, 0, 0, 0);
      break;
    case "weekly":
      nextRun.setDate(nextRun.getDate() + (7 - nextRun.getDay() + 1) % 7 + 1);
      nextRun.setHours(8, 0, 0, 0);
      break;
    case "monthly":
      nextRun.setMonth(nextRun.getMonth() + 1, 1);
      nextRun.setHours(8, 0, 0, 0);
      break;
  }

  const scheduledReport: ScheduledReport = {
    id: scheduleId,
    configurationId,
    caregiverId,
    frequency,
    nextRunAt: nextRun.toISOString(),
    recipients: recipients || [],
    format: format || "pdf",
    enabled: true,
  };

  scheduledReportsStore.set(scheduleId, scheduledReport);

  logPhiAccess({
    userId: caregiverId,
    action: "write",
    resourceType: "scheduled_report",
    resourceId: scheduleId,
    details: `Scheduled ${frequency} report for configuration: ${config.name}`,
  });

  res.json({ schedule: scheduledReport, message: "Report scheduled successfully" });
});

// Get scheduled reports
router.get("/api/caregiver/reports/schedules", (req: Request, res: Response) => {
  const caregiverId = (req as any).user?.id || "caregiver-default";

  logPhiAccess({
    userId: caregiverId,
    action: "read",
    resourceType: "scheduled_reports",
    resourceId: "all",
    details: "Retrieved scheduled reports",
  });

  const schedules = Array.from(scheduledReportsStore.values())
    .filter((schedule) => schedule.caregiverId === caregiverId)
    .map((schedule) => {
      const config = reportConfigurationsStore.get(schedule.configurationId);
      return {
        ...schedule,
        configurationName: config?.name || "Unknown",
      };
    });

  res.json({ schedules });
});

// Update scheduled report
router.put("/api/caregiver/reports/schedules/:scheduleId", (req: Request, res: Response) => {
  const caregiverId = (req as any).user?.id || "caregiver-default";
  const { scheduleId } = req.params;
  const { frequency, recipients, format, enabled } = req.body;

  const schedule = scheduledReportsStore.get(scheduleId);
  if (!schedule || schedule.caregiverId !== caregiverId) {
    return res.status(404).json({ error: "Schedule not found" });
  }

  if (frequency) schedule.frequency = frequency;
  if (recipients) schedule.recipients = recipients;
  if (format) schedule.format = format;
  if (enabled !== undefined) schedule.enabled = enabled;

  scheduledReportsStore.set(scheduleId, schedule);

  logPhiAccess({
    userId: caregiverId,
    action: "write",
    resourceType: "scheduled_report",
    resourceId: scheduleId,
    details: `Updated scheduled report`,
  });

  res.json({ schedule, message: "Schedule updated successfully" });
});

// Delete scheduled report
router.delete("/api/caregiver/reports/schedules/:scheduleId", (req: Request, res: Response) => {
  const caregiverId = (req as any).user?.id || "caregiver-default";
  const { scheduleId } = req.params;

  const schedule = scheduledReportsStore.get(scheduleId);
  if (!schedule || schedule.caregiverId !== caregiverId) {
    return res.status(404).json({ error: "Schedule not found" });
  }

  scheduledReportsStore.delete(scheduleId);

  logPhiAccess({
    userId: caregiverId,
    action: "delete",
    resourceType: "scheduled_report",
    resourceId: scheduleId,
    details: `Deleted scheduled report`,
  });

  res.json({ message: "Schedule deleted successfully" });
});

// Dashboard metrics endpoint
router.get("/api/caregiver/reports/dashboard-metrics", (req: Request, res: Response) => {
  const caregiverId = (req as any).user?.id || "caregiver-default";

  logPhiAccess({
    userId: caregiverId,
    action: "read",
    resourceType: "dashboard_metrics",
    resourceId: "summary",
    details: "Retrieved dashboard metrics summary",
  });

  // Generate last 30 days of data for quick metrics
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 30);

  const reportData = generateSampleReportData(
    startDate.toISOString().split("T")[0],
    endDate.toISOString().split("T")[0]
  );

  res.json({
    summary: reportData.summary,
    recentAlerts: reportData.criticalAlerts.slice(0, 5),
    adherenceTrendLast7Days: reportData.adherenceTrends.slice(-7),
    configurations: Array.from(reportConfigurationsStore.values())
      .filter((c) => c.caregiverId === caregiverId).length,
    savedReports: Array.from(savedReportsStore.values())
      .filter((r) => r.caregiverId === caregiverId).length,
    scheduledReports: Array.from(scheduledReportsStore.values())
      .filter((s) => s.caregiverId === caregiverId && s.enabled).length,
  });
});

export function registerCaregiverReportingRoutes(app: any) {
  app.use(router);
  console.log("[CaregiverReporting] Routes registered at /api/caregiver/reports/*");
}

export default router;
