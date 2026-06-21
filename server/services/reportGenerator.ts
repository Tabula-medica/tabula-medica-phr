import PDFDocument from "pdfkit";
import { storage } from "../storage";
import type { 
  AnalyticsReport, 
  ReportSection,
  AnalyticsDashboardData,
  PatientCohort,
  TreatmentEfficacy,
  PopulationHealthTrend,
  AtRiskPatient,
} from "@shared/schema";

export type ReportFormat = "pdf" | "csv" | "json";

export interface ReportGenerationOptions {
  name: string;
  type: "population_health" | "cohort_analysis" | "treatment_efficacy" | "at_risk_patients" | "comprehensive";
  description?: string;
  dateRange: { start: string; end: string };
  cohortIds?: string[];
  conditions?: string[];
  medications?: string[];
  demographics?: string[];
  metrics?: string[];
  format: ReportFormat;
  generatedBy: string;
}

export interface GeneratedReport {
  id: string;
  name: string;
  type: string;
  format: ReportFormat;
  data: Buffer | string;
  mimeType: string;
  filename: string;
  generatedAt: string;
}

export async function generateReport(options: ReportGenerationOptions): Promise<GeneratedReport> {
  const reportId = `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const generatedAt = new Date().toISOString();
  
  const reportData = await gatherReportData(options);
  
  let data: Buffer | string;
  let mimeType: string;
  let filename: string;

  switch (options.format) {
    case "pdf":
      data = await generatePDFReport(options, reportData, reportId);
      mimeType = "application/pdf";
      filename = `${sanitizeFilename(options.name)}_${formatDate(generatedAt)}.pdf`;
      break;
    case "csv":
      data = generateCSVReport(options, reportData);
      mimeType = "text/csv";
      filename = `${sanitizeFilename(options.name)}_${formatDate(generatedAt)}.csv`;
      break;
    case "json":
    default:
      data = JSON.stringify(reportData, null, 2);
      mimeType = "application/json";
      filename = `${sanitizeFilename(options.name)}_${formatDate(generatedAt)}.json`;
      break;
  }

  await storage.createAnalyticsReport({
    name: options.name,
    type: options.type,
    description: options.description || "",
    parameters: {
      dateRange: options.dateRange,
      cohortIds: options.cohortIds,
      conditions: options.conditions,
      medications: options.medications,
      demographics: options.demographics as any,
      metrics: options.metrics,
    },
    generatedBy: options.generatedBy,
  });

  return {
    id: reportId,
    name: options.name,
    type: options.type,
    format: options.format,
    data,
    mimeType,
    filename,
    generatedAt,
  };
}

interface ReportDataBundle {
  dashboard?: AnalyticsDashboardData;
  cohorts?: PatientCohort[];
  populationHealth?: PopulationHealthTrend[];
  treatmentEfficacy?: TreatmentEfficacy[];
  atRiskPatients?: AtRiskPatient[];
  summary: {
    totalPatients: number;
    activePatients: number;
    atRiskCount: number;
    avgRiskScore: number;
    dateRange: { start: string; end: string };
  };
}

async function gatherReportData(options: ReportGenerationOptions): Promise<ReportDataBundle> {
  const dashboard = await storage.getAnalyticsDashboardData();
  const cohorts = options.cohortIds?.length 
    ? await Promise.all(options.cohortIds.map(id => storage.getPatientCohort(id)))
    : await storage.getPatientCohorts();
  const populationHealth = await storage.getPopulationHealthTrends();
  const treatmentEfficacy = await storage.getTreatmentEfficacyData();
  const atRiskPatients = await storage.getAtRiskPatients();

  const filteredCohorts = cohorts.filter((c): c is PatientCohort => c !== undefined);

  const startDate = new Date(options.dateRange.start);
  const endDate = new Date(options.dateRange.end);
  endDate.setHours(23, 59, 59, 999);

  const filteredCohortsByDate = filteredCohorts.filter(c => {
    if (!c.createdAt) return true;
    const createdAt = new Date(c.createdAt);
    return createdAt >= startDate && createdAt <= endDate;
  });

  const filteredTreatmentEfficacy = treatmentEfficacy.filter(t => {
    if (!t.periodStart || !t.periodEnd) return true;
    const treatmentStart = new Date(t.periodStart);
    const treatmentEnd = new Date(t.periodEnd);
    return (treatmentStart >= startDate && treatmentStart <= endDate) ||
           (treatmentEnd >= startDate && treatmentEnd <= endDate) ||
           (treatmentStart <= startDate && treatmentEnd >= endDate);
  });

  const filteredPopulationHealth = populationHealth.filter(p => {
    if (!p.detectedAt) return true;
    const detectedAt = new Date(p.detectedAt);
    return detectedAt >= startDate && detectedAt <= endDate;
  });

  let filteredAtRisk = atRiskPatients.filter(p => {
    if (!p.lastVisit) return true;
    const lastVisit = new Date(p.lastVisit);
    return lastVisit >= startDate && lastVisit <= endDate;
  });
  
  if (options.conditions?.length) {
    filteredAtRisk = filteredAtRisk.filter(p => 
      p.primaryConditions.some(c => options.conditions!.includes(c))
    );
  }

  if (options.medications?.length) {
    filteredAtRisk = filteredAtRisk.filter(p => {
      return true;
    });
  }

  return {
    dashboard,
    cohorts: filteredCohortsByDate,
    populationHealth: filteredPopulationHealth,
    treatmentEfficacy: filteredTreatmentEfficacy,
    atRiskPatients: filteredAtRisk,
    summary: {
      totalPatients: dashboard?.overview?.totalPatients || 0,
      activePatients: dashboard?.overview?.activePatients || 0,
      atRiskCount: filteredAtRisk.length,
      avgRiskScore: dashboard?.overview?.avgRiskScore || 0,
      dateRange: options.dateRange,
    },
  };
}

async function generatePDFReport(
  options: ReportGenerationOptions, 
  data: ReportDataBundle,
  reportId: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ 
      size: "A4", 
      margin: 50,
      info: {
        Title: options.name,
        Author: "Tabula Medica Analytics",
        Subject: `${options.type} Report`,
        CreationDate: new Date(),
      }
    });

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(24).font("Helvetica-Bold").text("Tabula Medica", { align: "center" });
    doc.fontSize(18).font("Helvetica").text("Population Health Analytics Report", { align: "center" });
    doc.moveDown();
    
    doc.fontSize(14).font("Helvetica-Bold").text(options.name);
    doc.fontSize(10).font("Helvetica").fillColor("#666666");
    doc.text(`Report ID: ${reportId}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.text(`Date Range: ${options.dateRange.start} to ${options.dateRange.end}`);
    doc.text(`Report Type: ${formatReportType(options.type)}`);
    doc.moveDown();
    doc.fillColor("#000000");

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown();

    doc.fontSize(16).font("Helvetica-Bold").text("Executive Summary");
    doc.moveDown(0.5);
    doc.fontSize(10).font("Helvetica");
    
    const summary = data.summary;
    doc.text(`Total Patients: ${summary.totalPatients.toLocaleString()}`);
    doc.text(`Active Patients: ${summary.activePatients.toLocaleString()}`);
    doc.text(`At-Risk Patients: ${summary.atRiskCount.toLocaleString()}`);
    doc.text(`Average Risk Score: ${(summary.avgRiskScore * 100).toFixed(1)}%`);
    doc.moveDown();

    if (options.type === "population_health" || options.type === "comprehensive") {
      addPopulationHealthSection(doc, data);
    }

    if (options.type === "cohort_analysis" || options.type === "comprehensive") {
      addCohortAnalysisSection(doc, data);
    }

    if (options.type === "treatment_efficacy" || options.type === "comprehensive") {
      addTreatmentEfficacySection(doc, data);
    }

    if (options.type === "at_risk_patients" || options.type === "comprehensive") {
      addAtRiskPatientsSection(doc, data);
    }

    addFooter(doc, options);

    doc.end();
  });
}

function addPopulationHealthSection(doc: PDFKit.PDFDocument, data: ReportDataBundle): void {
  doc.addPage();
  doc.fontSize(16).font("Helvetica-Bold").text("Population Health Trends");
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica");

  if (data.dashboard?.conditionPrevalence?.length) {
    doc.fontSize(12).font("Helvetica-Bold").text("Condition Prevalence");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica");
    
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 250;
    const col3 = 350;

    doc.font("Helvetica-Bold");
    doc.text("Condition", col1, tableTop);
    doc.text("Patient Count", col2, tableTop);
    doc.text("Trend", col3, tableTop);
    doc.moveDown();
    
    doc.font("Helvetica");
    data.dashboard.conditionPrevalence.slice(0, 10).forEach((item) => {
      const y = doc.y;
      doc.text(item.condition, col1, y);
      doc.text(item.count.toString(), col2, y);
      const trendText = item.trend > 0 ? `+${item.trend}%` : `${item.trend}%`;
      doc.text(trendText, col3, y);
      doc.moveDown(0.5);
    });
  }

  doc.moveDown();

  if (data.dashboard?.topMedications?.length) {
    doc.fontSize(12).font("Helvetica-Bold").text("Top Medications");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica");
    
    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 250;
    const col3 = 350;

    doc.font("Helvetica-Bold");
    doc.text("Medication", col1, tableTop);
    doc.text("Patients", col2, tableTop);
    doc.text("Adherence Rate", col3, tableTop);
    doc.moveDown();
    
    doc.font("Helvetica");
    data.dashboard.topMedications.slice(0, 10).forEach((item) => {
      const y = doc.y;
      doc.text(item.medication, col1, y);
      doc.text(item.patientCount.toString(), col2, y);
      doc.text(`${(item.adherenceRate * 100).toFixed(1)}%`, col3, y);
      doc.moveDown(0.5);
    });
  }

  if (data.dashboard?.demographicBreakdown?.length) {
    doc.moveDown();
    doc.fontSize(12).font("Helvetica-Bold").text("Demographic Breakdown");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica");
    
    data.dashboard.demographicBreakdown.forEach((category) => {
      doc.font("Helvetica-Bold").text(`${category.category}:`);
      doc.font("Helvetica");
      category.data.forEach((item) => {
        doc.text(`  ${item.value}: ${item.count} patients`);
      });
      doc.moveDown(0.3);
    });
  }
}

function addCohortAnalysisSection(doc: PDFKit.PDFDocument, data: ReportDataBundle): void {
  doc.addPage();
  doc.fontSize(16).font("Helvetica-Bold").text("Cohort Analysis");
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica");

  if (!data.cohorts?.length) {
    doc.text("No cohorts available for analysis.");
    return;
  }

  data.cohorts.forEach((cohort, index) => {
    if (index > 0) doc.moveDown();
    
    doc.fontSize(12).font("Helvetica-Bold").text(cohort.name);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Description: ${cohort.description || "N/A"}`);
    doc.text(`Type: ${cohort.type}`);
    doc.text(`Patient Count: ${cohort.patientCount}`);
    doc.text(`Created: ${new Date(cohort.createdAt).toLocaleDateString()}`);
    
    if (cohort.criteria) {
      doc.text(`Criteria: ${JSON.stringify(cohort.criteria)}`);
    }
    
    doc.moveDown(0.5);
  });
}

function addTreatmentEfficacySection(doc: PDFKit.PDFDocument, data: ReportDataBundle): void {
  doc.addPage();
  doc.fontSize(16).font("Helvetica-Bold").text("Treatment Efficacy Analysis");
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica");

  if (!data.treatmentEfficacy?.length) {
    doc.text("No treatment efficacy data available.");
    return;
  }

  data.treatmentEfficacy.forEach((treatment, index) => {
    if (index > 0) doc.moveDown();
    
    doc.fontSize(12).font("Helvetica-Bold").text(treatment.treatmentName);
    doc.fontSize(10).font("Helvetica");
    doc.text(`Type: ${treatment.treatmentType}`);
    doc.text(`Target Condition: ${treatment.targetCondition}`);
    doc.text(`Sample Size: ${treatment.sampleSize} patients`);
    doc.text(`Time to Effect: ${treatment.timeToEffect} days`);
    doc.text(`Side Effect Rate: ${(treatment.sideEffectRate * 100).toFixed(1)}%`);
    doc.text(`Adherence Rate: ${(treatment.adherenceRate * 100).toFixed(1)}%`);
    
    if (treatment.nntTreat) {
      doc.text(`Number Needed to Treat: ${treatment.nntTreat}`);
    }

    if (treatment.outcomes?.length) {
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").text("Outcomes:");
      doc.font("Helvetica");
      treatment.outcomes.forEach((outcome) => {
        const improvement = outcome.improvement > 0 ? `+${outcome.improvement.toFixed(1)}%` : `${outcome.improvement.toFixed(1)}%`;
        doc.text(`  ${outcome.metric}: Baseline ${outcome.baseline.toFixed(1)} -> Current ${outcome.current.toFixed(1)} (${improvement})`);
      });
    }
    
    doc.moveDown(0.5);
  });
}

function addAtRiskPatientsSection(doc: PDFKit.PDFDocument, data: ReportDataBundle): void {
  doc.addPage();
  doc.fontSize(16).font("Helvetica-Bold").text("At-Risk Patients");
  doc.moveDown(0.5);
  doc.fontSize(10).font("Helvetica");

  if (!data.atRiskPatients?.length) {
    doc.text("No at-risk patients identified.");
    return;
  }

  doc.text(`Total At-Risk Patients: ${data.atRiskPatients.length}`);
  doc.moveDown();

  const riskLevelCounts = {
    critical: data.atRiskPatients.filter(p => p.overallRiskLevel === "critical").length,
    high: data.atRiskPatients.filter(p => p.overallRiskLevel === "high").length,
    moderate: data.atRiskPatients.filter(p => p.overallRiskLevel === "moderate").length,
    low: data.atRiskPatients.filter(p => p.overallRiskLevel === "low").length,
  };

  doc.fontSize(12).font("Helvetica-Bold").text("Risk Level Distribution");
  doc.fontSize(10).font("Helvetica");
  doc.text(`  Critical: ${riskLevelCounts.critical}`);
  doc.text(`  High: ${riskLevelCounts.high}`);
  doc.text(`  Moderate: ${riskLevelCounts.moderate}`);
  doc.text(`  Low: ${riskLevelCounts.low}`);
  doc.moveDown();

  doc.fontSize(12).font("Helvetica-Bold").text("High Priority Patients (Top 20)");
  doc.moveDown(0.3);
  
  const highPriority = data.atRiskPatients
    .filter(p => p.overallRiskLevel === "critical" || p.overallRiskLevel === "high")
    .slice(0, 20);

  if (highPriority.length === 0) {
    doc.fontSize(10).font("Helvetica").text("No high priority patients at this time.");
    return;
  }

  highPriority.forEach((patient, index) => {
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text(`${index + 1}. ${patient.patientName} (ID: ${patient.patientId})`);
    doc.font("Helvetica");
    doc.text(`   Age: ${patient.age}, Gender: ${patient.gender}`);
    doc.text(`   Risk Level: ${patient.overallRiskLevel.toUpperCase()}`);
    doc.text(`   Primary Conditions: ${patient.primaryConditions.join(", ") || "None listed"}`);
    doc.text(`   Open Alerts: ${patient.openAlerts}`);
    if (patient.interventionRecommendations?.length) {
      doc.text(`   Recommendations: ${patient.interventionRecommendations.join("; ")}`);
    }
    doc.moveDown(0.3);
  });
}

function addFooter(doc: PDFKit.PDFDocument, options: ReportGenerationOptions): void {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    
    doc.fontSize(8).fillColor("#999999");
    doc.text(
      `Tabula Medica - Confidential Health Analytics Report | Page ${i + 1} of ${pages.count}`,
      50,
      doc.page.height - 50,
      { align: "center", width: doc.page.width - 100 }
    );
    doc.text(
      `Generated by ${options.generatedBy} on ${new Date().toLocaleString()}`,
      50,
      doc.page.height - 40,
      { align: "center", width: doc.page.width - 100 }
    );
  }
}

function generateCSVReport(options: ReportGenerationOptions, data: ReportDataBundle): string {
  const lines: string[] = [];
  
  lines.push(`# Tabula Medica Analytics Report`);
  lines.push(`# Report: ${options.name}`);
  lines.push(`# Type: ${formatReportType(options.type)}`);
  lines.push(`# Date Range: ${options.dateRange.start} to ${options.dateRange.end}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push("");

  lines.push("# EXECUTIVE SUMMARY");
  lines.push("Metric,Value");
  lines.push(`Total Patients,${data.summary.totalPatients}`);
  lines.push(`Active Patients,${data.summary.activePatients}`);
  lines.push(`At-Risk Patients,${data.summary.atRiskCount}`);
  lines.push(`Average Risk Score,${(data.summary.avgRiskScore * 100).toFixed(1)}%`);
  lines.push("");

  if ((options.type === "population_health" || options.type === "comprehensive") && data.dashboard) {
    if (data.dashboard.conditionPrevalence?.length) {
      lines.push("# CONDITION PREVALENCE");
      lines.push("Condition,Patient Count,Trend (%)");
      data.dashboard.conditionPrevalence.forEach((item) => {
        lines.push(`"${escapeCSV(item.condition)}",${item.count},${item.trend}`);
      });
      lines.push("");
    }

    if (data.dashboard.topMedications?.length) {
      lines.push("# TOP MEDICATIONS");
      lines.push("Medication,Patient Count,Adherence Rate (%)");
      data.dashboard.topMedications.forEach((item) => {
        lines.push(`"${escapeCSV(item.medication)}",${item.patientCount},${(item.adherenceRate * 100).toFixed(1)}`);
      });
      lines.push("");
    }

    if (data.dashboard.riskDistribution?.length) {
      lines.push("# RISK DISTRIBUTION");
      lines.push("Risk Level,Count,Percentage (%)");
      data.dashboard.riskDistribution.forEach((item) => {
        lines.push(`${item.level},${item.count},${item.percentage.toFixed(1)}`);
      });
      lines.push("");
    }
  }

  if ((options.type === "cohort_analysis" || options.type === "comprehensive") && data.cohorts?.length) {
    lines.push("# PATIENT COHORTS");
    lines.push("Cohort Name,Type,Patient Count,Description,Created Date");
    data.cohorts.forEach((cohort) => {
      lines.push(`"${escapeCSV(cohort.name)}","${cohort.type}",${cohort.patientCount},"${escapeCSV(cohort.description || "")}","${cohort.createdAt}"`);
    });
    lines.push("");
  }

  if ((options.type === "treatment_efficacy" || options.type === "comprehensive") && data.treatmentEfficacy?.length) {
    lines.push("# TREATMENT EFFICACY");
    lines.push("Treatment Name,Type,Target Condition,Sample Size,Time to Effect (days),Side Effect Rate (%),Adherence Rate (%)");
    data.treatmentEfficacy.forEach((t) => {
      lines.push(`"${escapeCSV(t.treatmentName)}","${t.treatmentType}","${escapeCSV(t.targetCondition)}",${t.sampleSize},${t.timeToEffect},${(t.sideEffectRate * 100).toFixed(1)},${(t.adherenceRate * 100).toFixed(1)}`);
    });
    lines.push("");
  }

  if ((options.type === "at_risk_patients" || options.type === "comprehensive") && data.atRiskPatients?.length) {
    lines.push("# AT-RISK PATIENTS");
    lines.push("Patient ID,Patient Name,Age,Gender,Risk Level,Primary Conditions,Open Alerts,Intervention Recommendations");
    data.atRiskPatients.forEach((p) => {
      lines.push(`"${p.patientId}","${escapeCSV(p.patientName)}",${p.age},"${p.gender}","${p.overallRiskLevel}","${escapeCSV(p.primaryConditions.join("; "))}",${p.openAlerts},"${escapeCSV(p.interventionRecommendations?.join("; ") || "")}"`);
    });
    lines.push("");
  }

  return lines.join("\n");
}

function escapeCSV(str: string): string {
  if (!str) return "";
  return str.replace(/"/g, '""').replace(/\n/g, " ");
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase()
    .slice(0, 50);
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}${date.getDate().toString().padStart(2, "0")}`;
}

function formatReportType(type: string): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function getReportHistory(): Promise<AnalyticsReport[]> {
  return storage.getAnalyticsReports();
}

export async function getReportById(id: string): Promise<AnalyticsReport | undefined> {
  return storage.getAnalyticsReport(id);
}
