import { Router, Request, Response } from "express";
import PDFDocument from "pdfkit";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();

const SAMPLE_PATIENT_ID = "patient-default";

const SAMPLE_HEALTH_DATA = {
  patient: {
    id: SAMPLE_PATIENT_ID,
    firstName: "Sarah",
    lastName: "Mitchell",
    dateOfBirth: "1985-03-15",
    memberId: "MEM-2026-001842",
    gender: "Female",
    bloodType: "A+",
  },
  conditions: [
    { name: "Type 2 Diabetes", status: "Active", diagnosedDate: "2020-06-15", provider: "Dr. Sarah Chen, MD" },
    { name: "Hypertension", status: "Active", diagnosedDate: "2019-03-10", provider: "Dr. Sarah Chen, MD" },
    { name: "Seasonal Allergies", status: "Active", diagnosedDate: "2015-04-01", provider: "Dr. Michael Lee, MD" },
  ],
  medications: [
    { name: "Metformin 500mg", dosage: "500mg twice daily", prescriber: "Dr. Sarah Chen", startDate: "2020-06-15", status: "Active" },
    { name: "Lisinopril 10mg", dosage: "10mg once daily", prescriber: "Dr. Sarah Chen", startDate: "2019-03-15", status: "Active" },
    { name: "Cetirizine 10mg", dosage: "10mg as needed", prescriber: "Dr. Michael Lee", startDate: "2015-04-01", status: "Active" },
  ],
  allergies: [
    { allergen: "Penicillin", reaction: "Hives", severity: "Moderate" },
    { allergen: "Shellfish", reaction: "Anaphylaxis", severity: "Severe" },
  ],
  vitals: {
    bloodPressure: "128/82 mmHg",
    heartRate: "72 bpm",
    weight: "154 lbs",
    height: "5'6\"",
    bmi: "24.9",
    lastUpdated: "2026-01-15",
  },
  labResults: [
    { test: "HbA1c", value: "6.8%", date: "2026-01-15", status: "Within target" },
    { test: "Fasting Glucose", value: "118 mg/dL", date: "2026-01-15", status: "Slightly elevated" },
    { test: "Total Cholesterol", value: "195 mg/dL", date: "2026-01-15", status: "Normal" },
    { test: "LDL Cholesterol", value: "112 mg/dL", date: "2026-01-15", status: "Normal" },
    { test: "HDL Cholesterol", value: "58 mg/dL", date: "2026-01-15", status: "Normal" },
  ],
  immunizations: [
    { vaccine: "COVID-19 (Pfizer)", date: "2025-10-15", provider: "CVS Pharmacy" },
    { vaccine: "Influenza", date: "2025-09-20", provider: "Dr. Sarah Chen, MD" },
    { vaccine: "Tdap", date: "2023-05-10", provider: "Dr. Sarah Chen, MD" },
  ],
};

const SAMPLE_AI_INSIGHTS = [
  {
    category: "Health Education",
    title: "Understanding Your HbA1c Results",
    content: "Your HbA1c of 6.8% indicates good blood sugar management over the past 2-3 months. This measurement reflects average blood glucose levels. Ask your doctor about your personal target range.",
    generatedDate: "2026-01-18",
  },
  {
    category: "Medication Information",
    title: "About Metformin",
    content: "Metformin is commonly prescribed to help manage blood sugar levels. It works by reducing glucose production in the liver. Common side effects may include digestive discomfort. Discuss any concerns with your healthcare provider.",
    generatedDate: "2026-01-17",
  },
  {
    category: "Wellness Tips",
    title: "Blood Pressure Management",
    content: "Your blood pressure reading of 128/82 mmHg is in the elevated range. Regular monitoring, a balanced diet low in sodium, regular physical activity, and stress management may support healthy blood pressure. Consult your doctor for personalized guidance.",
    generatedDate: "2026-01-16",
  },
  {
    category: "Preventive Care",
    title: "Immunization Reminders",
    content: "Based on your health record, you're up to date on recommended vaccinations. Annual flu shots and staying current with boosters can help protect your health. Check with your provider about any upcoming recommendations.",
    generatedDate: "2026-01-15",
  },
];

const NO_CDS_DISCLAIMER = "EDUCATIONAL INFORMATION ONLY: The AI insights in this document are for educational and informational purposes only. They do NOT constitute medical advice, diagnosis, or treatment recommendations. Always consult your healthcare provider for medical decisions.";

router.get("/formats", async (req: Request, res: Response) => {
  res.json({
    success: true,
    formats: [
      { id: "pdf", name: "PDF Document", description: "Complete health record in PDF format", icon: "FileText" },
      { id: "csv", name: "CSV Spreadsheet", description: "Health data in spreadsheet format", icon: "Table" },
    ],
    dataTypes: [
      { id: "health-summary", name: "Health Summary", description: "Conditions, medications, allergies, vitals" },
      { id: "lab-results", name: "Lab Results", description: "Recent laboratory test results" },
      { id: "immunizations", name: "Immunizations", description: "Vaccination history" },
      { id: "ai-insights", name: "AI Educational Insights", description: "AI-generated health education content" },
      { id: "all", name: "Complete Record", description: "All health data and AI insights" },
    ],
  });
});

router.post("/generate", async (req: Request, res: Response) => {
  const { format, dataTypes, patientId } = req.body;
  const userId = req.query.userId as string || "patient";
  
  if (!format || !dataTypes || !Array.isArray(dataTypes) || dataTypes.length === 0) {
    return res.status(400).json({ success: false, error: "Format and at least one data type required" });
  }

  const exportAuditId = `export-${format}-${Date.now()}`;
  const effectivePatientId = patientId || SAMPLE_PATIENT_ID;

  await logPhiAccess({
    userId,
    patientId: effectivePatientId,
    action: "export",
    resourceType: "patient-health-record",
    resourceId: exportAuditId,
    details: `PHI Export: ${format.toUpperCase()} format - Data types: ${dataTypes.join(", ")} - Patient: ${effectivePatientId}`,
  });
  
  const setSecurityHeaders = () => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    res.setHeader("X-Export-Audit-Id", exportAuditId);
    res.setHeader("X-PHI-Export", "true");
  };

  const exportTimestamp = new Date().toISOString();

  try {
    if (format === "pdf") {
      const pdfBuffer = await generatePDF(dataTypes, exportAuditId, exportTimestamp);
      const filename = `health-record-${exportTimestamp.split("T")[0]}.pdf`;
      
      setSecurityHeaders();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } else if (format === "csv") {
      const csvContent = generateCSV(dataTypes, exportAuditId, exportTimestamp);
      const filename = `health-data-${exportTimestamp.split("T")[0]}.csv`;
      
      setSecurityHeaders();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csvContent);
    } else {
      return res.status(400).json({ success: false, error: "Unsupported format" });
    }
  } catch (error) {
    console.error("Export generation error:", error);
    res.status(500).json({ success: false, error: "Failed to generate export" });
  }
});

async function generatePDF(dataTypes: string[], exportAuditId: string, exportTimestamp: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const formattedDate = new Date(exportTimestamp).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    doc.fontSize(24).font("Helvetica-Bold").text("Personal Health Record", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).font("Helvetica").fillColor("#666666")
      .text(`Generated: ${formattedDate}`, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor("#999999")
      .text("CONFIDENTIAL - Protected Health Information", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(8).fillColor("#999999")
      .text(`Export ID: ${exportAuditId}`, { align: "center" });
    doc.moveDown(1.5);

    doc.fillColor("#333333");
    doc.fontSize(14).font("Helvetica-Bold").text("Patient Information");
    doc.moveDown(0.3);
    doc.fontSize(11).font("Helvetica");
    doc.text(`Name: ${SAMPLE_HEALTH_DATA.patient.firstName} ${SAMPLE_HEALTH_DATA.patient.lastName}`);
    doc.text(`Date of Birth: ${SAMPLE_HEALTH_DATA.patient.dateOfBirth}`);
    doc.text(`Member ID: ${SAMPLE_HEALTH_DATA.patient.memberId}`);
    doc.text(`Blood Type: ${SAMPLE_HEALTH_DATA.patient.bloodType}`);
    doc.moveDown(1);

    const includeAll = dataTypes.includes("all");

    if (includeAll || dataTypes.includes("health-summary")) {
      doc.fontSize(14).font("Helvetica-Bold").text("Active Conditions");
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica");
      SAMPLE_HEALTH_DATA.conditions.forEach((c) => {
        doc.text(`• ${c.name} - Diagnosed: ${c.diagnosedDate} (${c.provider})`);
      });
      doc.moveDown(0.8);

      doc.fontSize(14).font("Helvetica-Bold").text("Current Medications");
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica");
      SAMPLE_HEALTH_DATA.medications.forEach((m) => {
        doc.text(`• ${m.name} - ${m.dosage} (Prescribed by ${m.prescriber})`);
      });
      doc.moveDown(0.8);

      doc.fontSize(14).font("Helvetica-Bold").text("Allergies");
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica");
      SAMPLE_HEALTH_DATA.allergies.forEach((a) => {
        doc.text(`• ${a.allergen} - ${a.reaction} (Severity: ${a.severity})`);
      });
      doc.moveDown(0.8);

      doc.fontSize(14).font("Helvetica-Bold").text("Recent Vitals");
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica");
      doc.text(`Blood Pressure: ${SAMPLE_HEALTH_DATA.vitals.bloodPressure}`);
      doc.text(`Heart Rate: ${SAMPLE_HEALTH_DATA.vitals.heartRate}`);
      doc.text(`Weight: ${SAMPLE_HEALTH_DATA.vitals.weight} | Height: ${SAMPLE_HEALTH_DATA.vitals.height} | BMI: ${SAMPLE_HEALTH_DATA.vitals.bmi}`);
      doc.text(`Last Updated: ${SAMPLE_HEALTH_DATA.vitals.lastUpdated}`);
      doc.moveDown(1);
    }

    if (includeAll || dataTypes.includes("lab-results")) {
      doc.fontSize(14).font("Helvetica-Bold").text("Laboratory Results");
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica");
      SAMPLE_HEALTH_DATA.labResults.forEach((l) => {
        doc.text(`• ${l.test}: ${l.value} - ${l.status} (${l.date})`);
      });
      doc.moveDown(1);
    }

    if (includeAll || dataTypes.includes("immunizations")) {
      doc.fontSize(14).font("Helvetica-Bold").text("Immunization History");
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica");
      SAMPLE_HEALTH_DATA.immunizations.forEach((i) => {
        doc.text(`• ${i.vaccine} - ${i.date} (${i.provider})`);
      });
      doc.moveDown(1);
    }

    if (includeAll || dataTypes.includes("ai-insights")) {
      doc.addPage();
      doc.fontSize(14).font("Helvetica-Bold").text("AI Educational Insights");
      doc.moveDown(0.3);
      doc.fontSize(9).font("Helvetica-Oblique").fillColor("#cc6600")
        .text(NO_CDS_DISCLAIMER);
      doc.moveDown(0.8);
      doc.fillColor("#333333");

      SAMPLE_AI_INSIGHTS.forEach((insight) => {
        doc.fontSize(12).font("Helvetica-Bold").text(`${insight.title}`);
        doc.fontSize(9).font("Helvetica").fillColor("#666666")
          .text(`Category: ${insight.category} | Generated: ${insight.generatedDate}`);
        doc.moveDown(0.2);
        doc.fontSize(10).font("Helvetica").fillColor("#333333")
          .text(insight.content);
        doc.moveDown(0.8);
      });
    }

    doc.addPage();
    doc.fontSize(10).font("Helvetica-Bold").text("Data Privacy Notice");
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica");
    doc.text("This document contains Protected Health Information (PHI) and is intended solely for the patient and authorized recipients. Unauthorized disclosure, copying, or distribution is prohibited under HIPAA regulations.");
    doc.moveDown(0.5);
    doc.text(`Export ID: ${exportAuditId}`);
    doc.text(`Export Timestamp: ${exportTimestamp}`);
    doc.text("This export has been logged in accordance with HIPAA audit requirements.");

    doc.end();
  });
}

function generateCSV(dataTypes: string[], exportAuditId: string, exportTimestamp: string): string {
  const lines: string[] = [];
  const includeAll = dataTypes.includes("all");

  lines.push("# Personal Health Record Export");
  lines.push(`# Generated: ${exportTimestamp}`);
  lines.push(`# Export ID: ${exportAuditId}`);
  lines.push(`# Patient: ${SAMPLE_HEALTH_DATA.patient.firstName} ${SAMPLE_HEALTH_DATA.patient.lastName}`);
  lines.push(`# Member ID: ${SAMPLE_HEALTH_DATA.patient.memberId}`);
  lines.push("");

  if (includeAll || dataTypes.includes("health-summary")) {
    lines.push("## CONDITIONS");
    lines.push("Condition,Status,Diagnosed Date,Provider");
    SAMPLE_HEALTH_DATA.conditions.forEach((c) => {
      lines.push(`"${c.name}","${c.status}","${c.diagnosedDate}","${c.provider}"`);
    });
    lines.push("");

    lines.push("## MEDICATIONS");
    lines.push("Medication,Dosage,Prescriber,Start Date,Status");
    SAMPLE_HEALTH_DATA.medications.forEach((m) => {
      lines.push(`"${m.name}","${m.dosage}","${m.prescriber}","${m.startDate}","${m.status}"`);
    });
    lines.push("");

    lines.push("## ALLERGIES");
    lines.push("Allergen,Reaction,Severity");
    SAMPLE_HEALTH_DATA.allergies.forEach((a) => {
      lines.push(`"${a.allergen}","${a.reaction}","${a.severity}"`);
    });
    lines.push("");

    lines.push("## VITALS");
    lines.push("Measurement,Value,Last Updated");
    lines.push(`"Blood Pressure","${SAMPLE_HEALTH_DATA.vitals.bloodPressure}","${SAMPLE_HEALTH_DATA.vitals.lastUpdated}"`);
    lines.push(`"Heart Rate","${SAMPLE_HEALTH_DATA.vitals.heartRate}","${SAMPLE_HEALTH_DATA.vitals.lastUpdated}"`);
    lines.push(`"Weight","${SAMPLE_HEALTH_DATA.vitals.weight}","${SAMPLE_HEALTH_DATA.vitals.lastUpdated}"`);
    lines.push(`"Height","${SAMPLE_HEALTH_DATA.vitals.height}","${SAMPLE_HEALTH_DATA.vitals.lastUpdated}"`);
    lines.push(`"BMI","${SAMPLE_HEALTH_DATA.vitals.bmi}","${SAMPLE_HEALTH_DATA.vitals.lastUpdated}"`);
    lines.push("");
  }

  if (includeAll || dataTypes.includes("lab-results")) {
    lines.push("## LAB RESULTS");
    lines.push("Test,Value,Status,Date");
    SAMPLE_HEALTH_DATA.labResults.forEach((l) => {
      lines.push(`"${l.test}","${l.value}","${l.status}","${l.date}"`);
    });
    lines.push("");
  }

  if (includeAll || dataTypes.includes("immunizations")) {
    lines.push("## IMMUNIZATIONS");
    lines.push("Vaccine,Date,Provider");
    SAMPLE_HEALTH_DATA.immunizations.forEach((i) => {
      lines.push(`"${i.vaccine}","${i.date}","${i.provider}"`);
    });
    lines.push("");
  }

  if (includeAll || dataTypes.includes("ai-insights")) {
    lines.push("## AI EDUCATIONAL INSIGHTS");
    lines.push(`# ${NO_CDS_DISCLAIMER}`);
    lines.push("Category,Title,Content,Generated Date");
    SAMPLE_AI_INSIGHTS.forEach((insight) => {
      const escapedContent = insight.content.replace(/"/g, '""');
      lines.push(`"${insight.category}","${insight.title}","${escapedContent}","${insight.generatedDate}"`);
    });
    lines.push("");
  }

  lines.push("## EXPORT METADATA");
  lines.push(`Export ID,${exportAuditId}`);
  lines.push(`Export Timestamp,${exportTimestamp}`);
  lines.push("Privacy Notice,This export contains PHI and is logged per HIPAA requirements");

  return lines.join("\n");
}

export default router;
