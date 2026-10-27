import PDFDocument from "pdfkit";
import { HealthRecord, DataSource } from "../shared/schema";

interface PatientInfo {
  name: string;
  email: string;
  generatedAt: Date;
}

const COLORS = {
  primary: "#0066CC",
  secondary: "#4A5568",
  accent: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  background: "#F7FAFC",
  text: "#1A202C",
  lightText: "#718096",
  border: "#E2E8F0",
};

const RECORD_TYPE_COLORS: Record<string, string> = {
  visit: "#3B82F6",
  lab: "#8B5CF6",
  medication: "#10B981",
  imaging: "#F59E0B",
  procedure: "#EF4444",
  immunization: "#06B6D4",
  allergy: "#EC4899",
  vital: "#6366F1",
};

const RECORD_TYPE_LABELS: Record<string, string> = {
  visit: "Visit",
  lab: "Lab Result",
  medication: "Medication",
  imaging: "Imaging",
  procedure: "Procedure",
  immunization: "Immunization",
  allergy: "Allergy",
  vital: "Vital Sign",
};

function formatDate(date: Date | string | null): string {
  if (!date) return "N/A";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(date: Date | string | null): string {
  if (!date) return "N/A";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function generateHealthRecordsPDF(
  patient: PatientInfo,
  records: HealthRecord[],
  sources: DataSource[]
): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    bufferPages: true,
    info: {
      Title: `Health Records - ${patient.name}`,
      Author: "Tabula Medica",
      Subject: "Patient Health Records Export",
      Creator: "Tabula Medica Health Records App",
    },
  });

  let currentY = 50;

  // Header
  currentY = drawHeader(doc, patient, currentY);

  // Table of Contents
  currentY = drawTableOfContents(doc, records, currentY);

  // Summary Section
  doc.addPage();
  currentY = 50;
  currentY = drawSummarySection(doc, records, sources, currentY);

  // Records by Category
  const recordsByType = groupRecordsByType(records);

  for (const [type, typeRecords] of Object.entries(recordsByType)) {
    if (typeRecords.length === 0) continue;

    doc.addPage();
    currentY = 50;
    currentY = drawCategorySection(doc, type, typeRecords, sources, currentY);
  }

  // Footer on each page
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, i + 1, pages.count, patient.generatedAt);
  }

  // Flush all buffered pages
  doc.flushPages();

  return doc;
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  patient: PatientInfo,
  startY: number
): number {
  let y = startY;

  // Logo/Title
  doc
    .fontSize(28)
    .font("Helvetica-Bold")
    .fillColor(COLORS.primary)
    .text("TABULA MEDICA", 50, y, { align: "center" });

  y += 40;

  doc
    .fontSize(12)
    .font("Helvetica")
    .fillColor(COLORS.secondary)
    .text("Complete Health Records Export", 50, y, { align: "center" });

  y += 40;

  // Divider
  doc
    .strokeColor(COLORS.border)
    .lineWidth(1)
    .moveTo(50, y)
    .lineTo(562, y)
    .stroke();

  y += 30;

  // Patient Info Box
  doc.rect(50, y, 512, 80).fillColor(COLORS.background).fill();

  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .fillColor(COLORS.text)
    .text("Patient Information", 70, y + 15);

  doc
    .fontSize(11)
    .font("Helvetica")
    .fillColor(COLORS.secondary)
    .text(`Name: ${patient.name}`, 70, y + 35)
    .text(`Email: ${patient.email}`, 70, y + 50)
    .text(`Generated: ${formatDateTime(patient.generatedAt)}`, 300, y + 35);

  y += 100;

  // HIPAA Notice
  doc.rect(50, y, 512, 60).fillColor("#FEF3C7").fill();

  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor("#92400E")
    .text("CONFIDENTIAL HEALTH INFORMATION", 70, y + 10);

  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#92400E")
    .text(
      "This document contains Protected Health Information (PHI) under HIPAA. " +
        "Unauthorized disclosure is prohibited. Handle according to your organization's privacy policies.",
      70,
      y + 25,
      { width: 470 }
    );

  y += 80;

  return y;
}

function drawTableOfContents(
  doc: PDFKit.PDFDocument,
  records: HealthRecord[],
  startY: number
): number {
  let y = startY;

  doc
    .fontSize(16)
    .font("Helvetica-Bold")
    .fillColor(COLORS.text)
    .text("Contents", 50, y);

  y += 30;

  const recordsByType = groupRecordsByType(records);
  let pageNum = 3; // Starting page for records

  for (const [type, typeRecords] of Object.entries(recordsByType)) {
    if (typeRecords.length === 0) continue;

    const label = RECORD_TYPE_LABELS[type] || type;
    const color = RECORD_TYPE_COLORS[type] || COLORS.secondary;

    // Color dot
    doc.circle(60, y + 5, 4).fillColor(color).fill();

    // Label and count
    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor(COLORS.text)
      .text(`${label}s`, 75, y);

    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor(COLORS.lightText)
      .text(`${typeRecords.length} record${typeRecords.length > 1 ? "s" : ""}`, 200, y);

    // Dotted line
    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .dash(2, { space: 2 })
      .moveTo(280, y + 6)
      .lineTo(500, y + 6)
      .stroke()
      .undash();

    // Page number
    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor(COLORS.lightText)
      .text(`Page ${pageNum}`, 510, y);

    y += 25;
    pageNum++;
  }

  return y;
}

function drawSummarySection(
  doc: PDFKit.PDFDocument,
  records: HealthRecord[],
  sources: DataSource[],
  startY: number
): number {
  let y = startY;

  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .fillColor(COLORS.primary)
    .text("Health Summary", 50, y);

  y += 35;

  // Quick Stats
  const recordsByType = groupRecordsByType(records);

  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .fillColor(COLORS.text)
    .text("Record Overview", 50, y);

  y += 25;

  // Stats grid
  const statsPerRow = 4;
  const statWidth = 120;
  let statIndex = 0;

  for (const [type, typeRecords] of Object.entries(recordsByType)) {
    if (typeRecords.length === 0) continue;

    const col = statIndex % statsPerRow;
    const row = Math.floor(statIndex / statsPerRow);
    const x = 50 + col * statWidth;
    const statY = y + row * 50;

    const color = RECORD_TYPE_COLORS[type] || COLORS.secondary;
    const label = RECORD_TYPE_LABELS[type] || type;

    // Stat box
    doc.rect(x, statY, statWidth - 10, 40).fillColor(COLORS.background).fill();

    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor(color)
      .text(typeRecords.length.toString(), x + 10, statY + 8);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(COLORS.secondary)
      .text(label + "s", x + 10, statY + 26);

    statIndex++;
  }

  y += Math.ceil(statIndex / statsPerRow) * 50 + 30;

  // Data Sources
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .fillColor(COLORS.text)
    .text("Connected Data Sources", 50, y);

  y += 25;

  for (const source of sources) {
    doc.rect(50, y, 512, 35).fillColor(COLORS.background).fill();

    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor(COLORS.text)
      .text(source.name, 60, y + 8);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(COLORS.lightText)
      .text(`${source.type} | Last sync: ${formatDate(source.lastSyncAt)}`, 60, y + 22);

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor(COLORS.accent)
      .text(`${source.recordCount || 0} records`, 450, y + 12);

    y += 45;
  }

  return y;
}

function drawCategorySection(
  doc: PDFKit.PDFDocument,
  type: string,
  records: HealthRecord[],
  sources: DataSource[],
  startY: number
): number {
  let y = startY;
  const color = RECORD_TYPE_COLORS[type] || COLORS.secondary;
  const label = RECORD_TYPE_LABELS[type] || type;

  // Category Header
  doc.rect(50, y, 512, 40).fillColor(color).fill();

  doc
    .fontSize(18)
    .font("Helvetica-Bold")
    .fillColor("#FFFFFF")
    .text(`${label}s`, 70, y + 12);

  doc
    .fontSize(11)
    .font("Helvetica")
    .fillColor("#FFFFFF")
    .text(`${records.length} record${records.length > 1 ? "s" : ""}`, 450, y + 14);

  y += 55;

  // Sort records by date (newest first)
  const sortedRecords = [...records].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  // Records
  for (const record of sortedRecords) {
    // Check if we need a new page
    if (y > 680) {
      doc.addPage();
      y = 50;
    }

    const source = sources.find((s) => s.id === record.sourceId);

    // Record card
    doc
      .rect(50, y, 512, 80)
      .fillColor(COLORS.background)
      .fill()
      .strokeColor(COLORS.border)
      .lineWidth(1)
      .stroke();

    // Color accent
    doc.rect(50, y, 4, 80).fillColor(color).fill();

    // Title
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .fillColor(COLORS.text)
      .text(record.title, 65, y + 10, { width: 350 });

    // Date
    doc
      .fontSize(10)
      .font("Helvetica")
      .fillColor(COLORS.lightText)
      .text(formatDate(record.date), 450, y + 10);

    // Summary
    if (record.summary) {
      doc
        .fontSize(10)
        .font("Helvetica")
        .fillColor(COLORS.secondary)
        .text(record.summary.substring(0, 150) + (record.summary.length > 150 ? "..." : ""), 65, y + 30, {
          width: 480,
        });
    }

    // Provider & Source
    const providerText = record.provider ? `Provider: ${record.provider}` : "";
    const sourceText = source ? `Source: ${source.name}` : "";
    const metaText = [providerText, sourceText].filter(Boolean).join(" | ");

    if (metaText) {
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor(COLORS.lightText)
        .text(metaText, 65, y + 60);
    }

    y += 90;
  }

  return y;
}

function drawFooter(
  doc: PDFKit.PDFDocument,
  pageNum: number,
  totalPages: number,
  generatedAt: Date
): void {
  const y = 750;

  doc
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .moveTo(50, y)
    .lineTo(562, y)
    .stroke();

  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor(COLORS.lightText)
    .text("Tabula Medica - Confidential Health Records", 50, y + 10)
    .text(`Page ${pageNum} of ${totalPages}`, 480, y + 10)
    .text(`Generated: ${formatDateTime(generatedAt)}`, 50, y + 22);
}

function groupRecordsByType(records: HealthRecord[]): Record<string, HealthRecord[]> {
  const grouped: Record<string, HealthRecord[]> = {
    visit: [],
    lab: [],
    medication: [],
    imaging: [],
    procedure: [],
    immunization: [],
    allergy: [],
    vital: [],
  };

  for (const record of records) {
    const type = record.type as string;
    if (grouped[type]) {
      grouped[type].push(record);
    }
  }

  return grouped;
}
