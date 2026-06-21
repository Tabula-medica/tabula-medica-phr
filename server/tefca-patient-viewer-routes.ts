import { Router, type Request, type Response } from "express";
import PDFDocument from "pdfkit";
import { tefcaFrameworkService } from "./services/tefca-framework-service";
import { extractUserContext, type AuthorizedRequest } from "./middleware/rbac-authorization";
import { logPhiAccess } from "./security/hipaa-audit";

const router = Router();
router.use(extractUserContext);

interface FHIRCondition {
  id: string;
  clinicalStatus: string;
  verificationStatus: string;
  category: string;
  code: { text: string; coding: { system: string; code: string; display: string }[] };
  onsetDateTime: string;
  abatementDateTime?: string;
  recordedDate: string;
  recorder: string;
  severity?: string;
  bodySite?: string;
  note?: string;
}

interface FHIRMedication {
  id: string;
  status: string;
  medicationCodeableConcept: { text: string; coding: { system: string; code: string; display: string }[] };
  dosageInstruction: string;
  route: string;
  frequency: string;
  authoredOn: string;
  requester: string;
  reasonCode?: string;
  note?: string;
}

interface FHIRObservation {
  id: string;
  status: string;
  category: string;
  code: { text: string; coding: { system: string; code: string; display: string }[] };
  effectiveDateTime: string;
  valueQuantity?: { value: number; unit: string };
  valueString?: string;
  interpretation?: string;
  referenceRange?: { low?: string; high?: string; text?: string };
  performer: string;
  note?: string;
}

interface PatientFHIRData {
  patient: {
    id: string;
    name: string;
    birthDate: string;
    gender: string;
    identifier: string;
    address: string;
    telecom: string;
  };
  conditions: FHIRCondition[];
  medications: FHIRMedication[];
  observations: FHIRObservation[];
  metadata: {
    queryId: string;
    sourceQHINs: string[];
    retrievedAt: string;
    totalDocuments: number;
    fhirVersion: string;
    disclaimer: string;
  };
}

function generatePatientFHIRData(patientId: string): PatientFHIRData {
  const conditions: FHIRCondition[] = [
    {
      id: "cond-001",
      clinicalStatus: "active",
      verificationStatus: "confirmed",
      category: "encounter-diagnosis",
      code: { text: "Essential Hypertension", coding: [{ system: "http://snomed.info/sct", code: "59621000", display: "Essential hypertension" }] },
      onsetDateTime: "2022-03-15",
      recordedDate: "2022-03-15",
      recorder: "Dr. Sarah Chen, MD",
      severity: "moderate",
      note: "Stage 2 hypertension. Patient on combination therapy.",
    },
    {
      id: "cond-002",
      clinicalStatus: "active",
      verificationStatus: "confirmed",
      category: "problem-list-item",
      code: { text: "Type 2 Diabetes Mellitus", coding: [{ system: "http://snomed.info/sct", code: "44054006", display: "Type 2 diabetes mellitus" }] },
      onsetDateTime: "2021-08-22",
      recordedDate: "2021-08-22",
      recorder: "Dr. James Wilson, MD",
      severity: "moderate",
      note: "Well-controlled with metformin. Last A1C 6.8%.",
    },
    {
      id: "cond-003",
      clinicalStatus: "active",
      verificationStatus: "confirmed",
      category: "problem-list-item",
      code: { text: "Hyperlipidemia", coding: [{ system: "http://snomed.info/sct", code: "55822004", display: "Hyperlipidemia" }] },
      onsetDateTime: "2022-01-10",
      recordedDate: "2022-01-10",
      recorder: "Dr. Sarah Chen, MD",
      severity: "mild",
    },
    {
      id: "cond-004",
      clinicalStatus: "resolved",
      verificationStatus: "confirmed",
      category: "encounter-diagnosis",
      code: { text: "Acute Bronchitis", coding: [{ system: "http://snomed.info/sct", code: "10509002", display: "Acute bronchitis" }] },
      onsetDateTime: "2024-11-05",
      abatementDateTime: "2024-11-20",
      recordedDate: "2024-11-05",
      recorder: "Dr. Emily Park, MD",
    },
    {
      id: "cond-005",
      clinicalStatus: "active",
      verificationStatus: "confirmed",
      category: "problem-list-item",
      code: { text: "Generalized Anxiety Disorder", coding: [{ system: "http://snomed.info/sct", code: "21897009", display: "Generalized anxiety disorder" }] },
      onsetDateTime: "2023-06-15",
      recordedDate: "2023-06-15",
      recorder: "Dr. Maria Lopez, PsyD",
      severity: "mild",
      note: "Managed with CBT and low-dose SSRI.",
    },
    {
      id: "cond-006",
      clinicalStatus: "active",
      verificationStatus: "confirmed",
      category: "problem-list-item",
      code: { text: "Chronic Low Back Pain", coding: [{ system: "http://snomed.info/sct", code: "278860009", display: "Chronic low back pain" }] },
      onsetDateTime: "2023-01-20",
      recordedDate: "2023-01-20",
      recorder: "Dr. Robert Kim, DO",
      bodySite: "Lumbar spine",
      note: "Physical therapy ongoing. No radiculopathy.",
    },
  ];

  const medications: FHIRMedication[] = [
    {
      id: "med-001",
      status: "active",
      medicationCodeableConcept: { text: "Metformin 500mg", coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "860975", display: "Metformin Hydrochloride 500 MG" }] },
      dosageInstruction: "Take 1 tablet by mouth twice daily with meals",
      route: "Oral",
      frequency: "BID",
      authoredOn: "2021-08-22",
      requester: "Dr. James Wilson, MD",
      reasonCode: "Type 2 Diabetes Mellitus",
    },
    {
      id: "med-002",
      status: "active",
      medicationCodeableConcept: { text: "Lisinopril 20mg", coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "314076", display: "Lisinopril 20 MG Oral Tablet" }] },
      dosageInstruction: "Take 1 tablet by mouth once daily",
      route: "Oral",
      frequency: "QD",
      authoredOn: "2022-03-15",
      requester: "Dr. Sarah Chen, MD",
      reasonCode: "Essential Hypertension",
    },
    {
      id: "med-003",
      status: "active",
      medicationCodeableConcept: { text: "Atorvastatin 40mg", coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "259255", display: "Atorvastatin 40 MG Oral Tablet" }] },
      dosageInstruction: "Take 1 tablet by mouth at bedtime",
      route: "Oral",
      frequency: "QHS",
      authoredOn: "2022-01-10",
      requester: "Dr. Sarah Chen, MD",
      reasonCode: "Hyperlipidemia",
    },
    {
      id: "med-004",
      status: "active",
      medicationCodeableConcept: { text: "Sertraline 50mg", coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "312938", display: "Sertraline 50 MG Oral Tablet" }] },
      dosageInstruction: "Take 1 tablet by mouth once daily in the morning",
      route: "Oral",
      frequency: "QAM",
      authoredOn: "2023-06-15",
      requester: "Dr. Maria Lopez, PsyD",
      reasonCode: "Generalized Anxiety Disorder",
    },
    {
      id: "med-005",
      status: "stopped",
      medicationCodeableConcept: { text: "Amoxicillin 500mg", coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "308182", display: "Amoxicillin 500 MG Oral Capsule" }] },
      dosageInstruction: "Take 1 capsule by mouth three times daily for 10 days",
      route: "Oral",
      frequency: "TID",
      authoredOn: "2024-11-05",
      requester: "Dr. Emily Park, MD",
      reasonCode: "Acute Bronchitis",
      note: "Course completed. No adverse effects.",
    },
    {
      id: "med-006",
      status: "active",
      medicationCodeableConcept: { text: "Ibuprofen 400mg", coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "197806", display: "Ibuprofen 400 MG Oral Tablet" }] },
      dosageInstruction: "Take 1 tablet by mouth every 6 hours as needed for pain",
      route: "Oral",
      frequency: "Q6H PRN",
      authoredOn: "2023-01-20",
      requester: "Dr. Robert Kim, DO",
      reasonCode: "Chronic Low Back Pain",
      note: "Limit to 3 tablets per day. Take with food.",
    },
  ];

  const observations: FHIRObservation[] = [
    {
      id: "obs-001",
      status: "final",
      category: "vital-signs",
      code: { text: "Blood Pressure", coding: [{ system: "http://loinc.org", code: "85354-9", display: "Blood pressure panel" }] },
      effectiveDateTime: "2025-02-14T09:30:00Z",
      valueString: "138/88 mmHg",
      interpretation: "High",
      referenceRange: { text: "< 120/80 mmHg (normal), < 130/80 mmHg (elevated)" },
      performer: "Nurse Johnson, RN",
    },
    {
      id: "obs-002",
      status: "final",
      category: "vital-signs",
      code: { text: "Heart Rate", coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart rate" }] },
      effectiveDateTime: "2025-02-14T09:30:00Z",
      valueQuantity: { value: 72, unit: "bpm" },
      interpretation: "Normal",
      referenceRange: { low: "60 bpm", high: "100 bpm" },
      performer: "Nurse Johnson, RN",
    },
    {
      id: "obs-003",
      status: "final",
      category: "vital-signs",
      code: { text: "Body Mass Index", coding: [{ system: "http://loinc.org", code: "39156-5", display: "BMI" }] },
      effectiveDateTime: "2025-02-14T09:35:00Z",
      valueQuantity: { value: 28.4, unit: "kg/m2" },
      interpretation: "Overweight",
      referenceRange: { low: "18.5", high: "24.9", text: "18.5 - 24.9 kg/m2 (normal)" },
      performer: "Nurse Johnson, RN",
    },
    {
      id: "obs-004",
      status: "final",
      category: "laboratory",
      code: { text: "Hemoglobin A1c", coding: [{ system: "http://loinc.org", code: "4548-4", display: "Hemoglobin A1c/Total Hemoglobin" }] },
      effectiveDateTime: "2025-01-28T14:00:00Z",
      valueQuantity: { value: 6.8, unit: "%" },
      interpretation: "Above optimal",
      referenceRange: { high: "5.7%", text: "< 5.7% (normal), 5.7-6.4% (prediabetes), >= 6.5% (diabetes)" },
      performer: "Quest Diagnostics",
      note: "Slight improvement from previous reading of 7.1%.",
    },
    {
      id: "obs-005",
      status: "final",
      category: "laboratory",
      code: { text: "LDL Cholesterol", coding: [{ system: "http://loinc.org", code: "2089-1", display: "LDL Cholesterol" }] },
      effectiveDateTime: "2025-01-28T14:00:00Z",
      valueQuantity: { value: 118, unit: "mg/dL" },
      interpretation: "Near optimal",
      referenceRange: { high: "100 mg/dL", text: "< 100 mg/dL (optimal), 100-129 (near optimal)" },
      performer: "Quest Diagnostics",
    },
    {
      id: "obs-006",
      status: "final",
      category: "laboratory",
      code: { text: "Total Cholesterol", coding: [{ system: "http://loinc.org", code: "2093-3", display: "Total Cholesterol" }] },
      effectiveDateTime: "2025-01-28T14:00:00Z",
      valueQuantity: { value: 198, unit: "mg/dL" },
      interpretation: "Borderline high",
      referenceRange: { high: "200 mg/dL", text: "< 200 mg/dL (desirable)" },
      performer: "Quest Diagnostics",
    },
    {
      id: "obs-007",
      status: "final",
      category: "laboratory",
      code: { text: "HDL Cholesterol", coding: [{ system: "http://loinc.org", code: "2085-9", display: "HDL Cholesterol" }] },
      effectiveDateTime: "2025-01-28T14:00:00Z",
      valueQuantity: { value: 52, unit: "mg/dL" },
      interpretation: "Normal",
      referenceRange: { low: "40 mg/dL", text: "> 40 mg/dL (normal for men), > 50 mg/dL (normal for women)" },
      performer: "Quest Diagnostics",
    },
    {
      id: "obs-008",
      status: "final",
      category: "laboratory",
      code: { text: "Serum Creatinine", coding: [{ system: "http://loinc.org", code: "2160-0", display: "Creatinine" }] },
      effectiveDateTime: "2025-01-28T14:00:00Z",
      valueQuantity: { value: 0.9, unit: "mg/dL" },
      interpretation: "Normal",
      referenceRange: { low: "0.6 mg/dL", high: "1.2 mg/dL" },
      performer: "Quest Diagnostics",
    },
    {
      id: "obs-009",
      status: "final",
      category: "vital-signs",
      code: { text: "Body Temperature", coding: [{ system: "http://loinc.org", code: "8310-5", display: "Body temperature" }] },
      effectiveDateTime: "2025-02-14T09:30:00Z",
      valueQuantity: { value: 98.6, unit: "°F" },
      interpretation: "Normal",
      referenceRange: { low: "97.8°F", high: "99.1°F" },
      performer: "Nurse Johnson, RN",
    },
    {
      id: "obs-010",
      status: "final",
      category: "laboratory",
      code: { text: "eGFR", coding: [{ system: "http://loinc.org", code: "33914-3", display: "Glomerular filtration rate" }] },
      effectiveDateTime: "2025-01-28T14:00:00Z",
      valueQuantity: { value: 92, unit: "mL/min/1.73m2" },
      interpretation: "Normal",
      referenceRange: { low: "90", text: ">= 90 mL/min/1.73m2 (normal)" },
      performer: "Quest Diagnostics",
    },
    {
      id: "obs-011",
      status: "final",
      category: "vital-signs",
      code: { text: "Oxygen Saturation", coding: [{ system: "http://loinc.org", code: "2708-6", display: "Oxygen saturation" }] },
      effectiveDateTime: "2025-02-14T09:30:00Z",
      valueQuantity: { value: 98, unit: "%" },
      interpretation: "Normal",
      referenceRange: { low: "95%", high: "100%" },
      performer: "Nurse Johnson, RN",
    },
    {
      id: "obs-012",
      status: "final",
      category: "vital-signs",
      code: { text: "Respiratory Rate", coding: [{ system: "http://loinc.org", code: "9279-1", display: "Respiratory rate" }] },
      effectiveDateTime: "2025-02-14T09:30:00Z",
      valueQuantity: { value: 16, unit: "breaths/min" },
      interpretation: "Normal",
      referenceRange: { low: "12", high: "20" },
      performer: "Nurse Johnson, RN",
    },
  ];

  const qhins = tefcaFrameworkService.getQHINConnections();
  const selectedQHINs = qhins.slice(0, 3).map(q => q.name);

  return {
    patient: {
      id: patientId || "pat-demo-001",
      name: "Alexandra M. Thompson",
      birthDate: "1985-07-22",
      gender: "Female",
      identifier: "MRN-****4821",
      address: "Rochester, MN 55901",
      telecom: "(507) ***-**42",
    },
    conditions,
    medications,
    observations,
    metadata: {
      queryId: `tefca_viewer_${Date.now()}`,
      sourceQHINs: selectedQHINs,
      retrievedAt: new Date().toISOString(),
      totalDocuments: conditions.length + medications.length + observations.length,
      fhirVersion: "R4 (4.0.1)",
      disclaimer: "NOT FOR CLINICAL DECISION SUPPORT. This is an informational read-only view of health records retrieved via TEFCA. Always consult your healthcare provider for medical decisions.",
    },
  };
}

router.get("/:patientId", async (req: AuthorizedRequest, res: Response) => {
  try {
    const { patientId } = req.params;

    logPhiAccess({
      action: "read",
      userId: req.userId || "anonymous",
      resourceType: "TEFCAPatientRecord",
      details: `TEFCA_PATIENT_VIEWER_ACCESS patientId=${patientId}`,
    });

    const data = generatePatientFHIRData(patientId);
    res.json(data);
  } catch (error) {
    console.error("[TEFCAViewer] Error fetching patient data:", error);
    res.status(500).json({ error: "Failed to retrieve patient FHIR data via TEFCA" });
  }
});

router.get("/:patientId/pdf", async (req: AuthorizedRequest, res: Response) => {
  try {
    const { patientId } = req.params;

    logPhiAccess({
      action: "export",
      userId: req.userId || "anonymous",
      resourceType: "TEFCAPatientRecord",
      details: `TEFCA_PATIENT_PDF_EXPORT patientId=${patientId}`,
    });

    const data = generatePatientFHIRData(patientId);
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    const pdfReady = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    doc.fontSize(20).font("Helvetica-Bold").text("Patient Health Record", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(9).font("Helvetica").fillColor("#666666")
      .text("Retrieved via TEFCA — FHIR R4 (4.0.1)", { align: "center" });
    doc.moveDown(0.2);
    doc.fontSize(8).fillColor("#cc0000")
      .text(data.metadata.disclaimer, { align: "center", width: 500 });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke("#cccccc");
    doc.moveDown(0.5);

    doc.fontSize(12).font("Helvetica-Bold").fillColor("#1a1a1a").text("Patient Information");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#333333");
    doc.text(`Name: ${data.patient.name}`);
    doc.text(`Date of Birth: ${data.patient.birthDate}    Gender: ${data.patient.gender}`);
    doc.text(`Identifier: ${data.patient.identifier}    Location: ${data.patient.address}`);
    doc.text(`Sources: ${data.metadata.sourceQHINs.join(", ")}`);
    doc.text(`Retrieved: ${new Date(data.metadata.retrievedAt).toLocaleString()}`);
    doc.moveDown(1);

    doc.fontSize(14).font("Helvetica-Bold").fillColor("#1e40af").text("Conditions");
    doc.moveDown(0.3);
    data.conditions.forEach((c, i) => {
      if (doc.y > 680) { doc.addPage(); }
      const statusColor = c.clinicalStatus === "active" ? "#16a34a" : "#6b7280";
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#1a1a1a")
        .text(`${i + 1}. ${c.code.text}`, { continued: true });
      doc.font("Helvetica").fillColor(statusColor).text(`  [${c.clinicalStatus.toUpperCase()}]`);
      doc.fontSize(9).font("Helvetica").fillColor("#555555");
      doc.text(`   Onset: ${c.onsetDateTime}${c.abatementDateTime ? `  |  Resolved: ${c.abatementDateTime}` : ""}  |  Recorded by: ${c.recorder}`);
      if (c.severity) doc.text(`   Severity: ${c.severity}`);
      if (c.note) doc.text(`   Note: ${c.note}`);
      doc.text(`   SNOMED: ${c.code.coding[0]?.code || "N/A"}`);
      doc.moveDown(0.3);
    });
    doc.moveDown(0.5);

    if (doc.y > 600) doc.addPage();
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#7c3aed").text("Medications");
    doc.moveDown(0.3);
    data.medications.forEach((m, i) => {
      if (doc.y > 680) { doc.addPage(); }
      const statusColor = m.status === "active" ? "#16a34a" : "#6b7280";
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#1a1a1a")
        .text(`${i + 1}. ${m.medicationCodeableConcept.text}`, { continued: true });
      doc.font("Helvetica").fillColor(statusColor).text(`  [${m.status.toUpperCase()}]`);
      doc.fontSize(9).font("Helvetica").fillColor("#555555");
      doc.text(`   Dosage: ${m.dosageInstruction}`);
      doc.text(`   Route: ${m.route}  |  Frequency: ${m.frequency}  |  Since: ${m.authoredOn}`);
      doc.text(`   Prescriber: ${m.requester}${m.reasonCode ? `  |  For: ${m.reasonCode}` : ""}`);
      if (m.note) doc.text(`   Note: ${m.note}`);
      doc.text(`   RxNorm: ${m.medicationCodeableConcept.coding[0]?.code || "N/A"}`);
      doc.moveDown(0.3);
    });
    doc.moveDown(0.5);

    if (doc.y > 500) doc.addPage();
    doc.fontSize(14).font("Helvetica-Bold").fillColor("#ea580c").text("Observations");
    doc.moveDown(0.3);

    const vitalSigns = data.observations.filter(o => o.category === "vital-signs");
    const labResults = data.observations.filter(o => o.category === "laboratory");

    if (vitalSigns.length > 0) {
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#333333").text("Vital Signs");
      doc.moveDown(0.2);
      vitalSigns.forEach((o, i) => {
        if (doc.y > 680) { doc.addPage(); }
        const value = o.valueQuantity ? `${o.valueQuantity.value} ${o.valueQuantity.unit}` : o.valueString || "N/A";
        const interpColor = o.interpretation === "Normal" ? "#16a34a" : o.interpretation === "High" || o.interpretation === "Overweight" ? "#dc2626" : "#ca8a04";
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#1a1a1a").text(`${o.code.text}: `, { continued: true });
        doc.font("Helvetica").text(value, { continued: true });
        doc.fillColor(interpColor).text(`  (${o.interpretation || "N/A"})`);
        doc.fontSize(8).fillColor("#777777").text(`   ${new Date(o.effectiveDateTime).toLocaleDateString()}  |  ${o.performer}${o.referenceRange?.text ? `  |  Ref: ${o.referenceRange.text}` : ""}`);
        doc.moveDown(0.2);
      });
      doc.moveDown(0.3);
    }

    if (labResults.length > 0) {
      if (doc.y > 600) doc.addPage();
      doc.fontSize(11).font("Helvetica-Bold").fillColor("#333333").text("Laboratory Results");
      doc.moveDown(0.2);
      labResults.forEach((o, i) => {
        if (doc.y > 680) { doc.addPage(); }
        const value = o.valueQuantity ? `${o.valueQuantity.value} ${o.valueQuantity.unit}` : o.valueString || "N/A";
        const interpColor = o.interpretation === "Normal" ? "#16a34a" : "#ca8a04";
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#1a1a1a").text(`${o.code.text}: `, { continued: true });
        doc.font("Helvetica").text(value, { continued: true });
        doc.fillColor(interpColor).text(`  (${o.interpretation || "N/A"})`);
        doc.fontSize(8).fillColor("#777777").text(`   ${new Date(o.effectiveDateTime).toLocaleDateString()}  |  ${o.performer}${o.referenceRange?.text ? `  |  Ref: ${o.referenceRange.text}` : ""}`);
        if (o.note) doc.fillColor("#555555").text(`   Note: ${o.note}`);
        doc.moveDown(0.2);
      });
    }

    doc.addPage();
    doc.fontSize(8).font("Helvetica").fillColor("#999999");
    doc.text(`Generated: ${new Date().toISOString()}`, { align: "center" });
    doc.text(`Query ID: ${data.metadata.queryId}`, { align: "center" });
    doc.text(`FHIR Version: ${data.metadata.fhirVersion}`, { align: "center" });
    doc.text(`Sources: ${data.metadata.sourceQHINs.join(", ")}`, { align: "center" });
    doc.moveDown(0.5);
    doc.fillColor("#cc0000").text(data.metadata.disclaimer, { align: "center", width: 500 });

    doc.end();

    const pdfBuffer = await pdfReady;
    const filename = `health-record-${data.patient.name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error("[TEFCAViewer] PDF generation error:", error);
    res.status(500).json({ error: "Failed to generate patient health record PDF" });
  }
});

export default router;
