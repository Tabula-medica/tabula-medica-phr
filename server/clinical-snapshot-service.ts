import PDFDocument from "pdfkit";

export interface ClinicalSnapshotData {
  patient: {
    name: string;
    dob: string;
    mrn: string;
    phone?: string;
    email?: string;
  };
  medications: Array<{
    name: string;
    dose: string;
    frequency: string;
    status: "confirmed" | "unconfirmed";
  }>;
  allergies: Array<{
    allergen: string;
    reaction: string;
    severity: string;
  }>;
  problems: Array<{
    condition: string;
    onsetDate: string;
    status: string;
  }>;
  recentLabs: Array<{
    name: string;
    value: string;
    date: string;
    status: "normal" | "abnormal" | "critical";
  }>;
  imaging: Array<{
    study: string;
    date: string;
    facility: string;
  }>;
  keyDates: Array<{
    event: string;
    date: string;
  }>;
  generatedAt: string;
}

const mockSnapshotData: ClinicalSnapshotData = {
  patient: {
    name: "Jane Doe",
    dob: "1985-03-15",
    mrn: "MRN-123456",
    phone: "(555) 123-4567",
    email: "jane.doe@email.com",
  },
  medications: [
    { name: "Metformin", dose: "500mg", frequency: "Twice daily", status: "confirmed" },
    { name: "Lisinopril", dose: "10mg", frequency: "Once daily", status: "confirmed" },
    { name: "Atorvastatin", dose: "40mg", frequency: "Once daily at bedtime", status: "confirmed" },
    { name: "Vitamin D3", dose: "2000 IU", frequency: "Once daily", status: "unconfirmed" },
  ],
  allergies: [
    { allergen: "Penicillin", reaction: "Rash, hives", severity: "Moderate" },
    { allergen: "Sulfa drugs", reaction: "Difficulty breathing", severity: "Severe" },
  ],
  problems: [
    { condition: "Type 2 Diabetes Mellitus", onsetDate: "2023-05-15", status: "Active" },
    { condition: "Essential Hypertension", onsetDate: "2022-08-20", status: "Active" },
    { condition: "Hyperlipidemia", onsetDate: "2022-08-20", status: "Active" },
    { condition: "Vitamin D Deficiency", onsetDate: "2024-01-10", status: "Active" },
  ],
  recentLabs: [
    { name: "Hemoglobin A1C", value: "6.2%", date: "2025-01-08", status: "normal" },
    { name: "LDL Cholesterol", value: "128 mg/dL", date: "2025-01-10", status: "abnormal" },
    { name: "Creatinine", value: "0.9 mg/dL", date: "2025-01-15", status: "normal" },
    { name: "TSH", value: "2.1 mIU/L", date: "2024-12-20", status: "normal" },
    { name: "Fasting Glucose", value: "95 mg/dL", date: "2025-01-15", status: "normal" },
  ],
  imaging: [
    { study: "CT Abdomen and Pelvis", date: "2024-11-05", facility: "Radiology Associates" },
    { study: "Chest X-Ray", date: "2024-10-20", facility: "Hospital Radiology" },
    { study: "Echocardiogram", date: "2024-07-10", facility: "Cardiology Associates" },
  ],
  keyDates: [
    { event: "Last Physical Exam", date: "2025-01-05" },
    { event: "Last Eye Exam", date: "2024-09-15" },
    { event: "Last Colonoscopy", date: "2024-09-10" },
    { event: "Next Appointment", date: "2025-01-22" },
    { event: "Next Lab Work Due", date: "2025-04-08" },
  ],
  generatedAt: new Date().toISOString(),
};

export async function generateClinicalSnapshotPDF(
  patientId: string
): Promise<{ buffer: Buffer; filename: string }> {

  const data = mockSnapshotData;
  const doc = new PDFDocument({ size: "LETTER", margin: 40 });
  const buffers: Buffer[] = [];

  doc.on("data", (chunk) => buffers.push(chunk));

  const primaryColor = "#0066CC";
  const headerBg = "#F0F7FF";
  const textColor = "#333333";
  const mutedColor = "#666666";

  doc.rect(0, 0, 612, 70).fill(primaryColor);
  doc.fontSize(20).fillColor("white").text("Tabula Medica", 40, 20);
  doc.fontSize(10).text("Clinical Snapshot", 40, 45);
  doc.fontSize(8).text(`Generated: ${new Date().toLocaleDateString()}`, 450, 25, { align: "right" });
  doc.text("CONFIDENTIAL - PHI", 450, 40, { align: "right" });

  let y = 85;

  doc.rect(40, y, 532, 55).fill(headerBg);
  doc.fillColor(textColor).fontSize(14).text(data.patient.name, 50, y + 10);
  doc.fontSize(9).fillColor(mutedColor);
  doc.text(`DOB: ${new Date(data.patient.dob).toLocaleDateString()}`, 50, y + 28);
  doc.text(`MRN: ${data.patient.mrn}`, 200, y + 28);
  if (data.patient.phone) doc.text(`Phone: ${data.patient.phone}`, 350, y + 28);
  doc.text("Patient-Confirmed Record Summary", 50, y + 42);

  y += 70;

  const drawSectionHeader = (title: string, yPos: number) => {
    doc.rect(40, yPos, 532, 18).fill(primaryColor);
    doc.fillColor("white").fontSize(10).text(title, 50, yPos + 4);
    return yPos + 22;
  };

  y = drawSectionHeader("ALLERGIES", y);
  doc.fillColor(textColor).fontSize(9);
  if (data.allergies.length === 0) {
    doc.text("No known allergies", 50, y);
    y += 15;
  } else {
    for (const allergy of data.allergies) {
      const severity = allergy.severity === "Severe" ? " [SEVERE]" : "";
      doc.text(`• ${allergy.allergen}${severity} - ${allergy.reaction}`, 50, y);
      y += 12;
    }
  }
  y += 8;

  y = drawSectionHeader("ACTIVE PROBLEMS", y);
  doc.fillColor(textColor).fontSize(9);
  for (const problem of data.problems) {
    doc.text(`• ${problem.condition} (since ${new Date(problem.onsetDate).toLocaleDateString()})`, 50, y);
    y += 12;
  }
  y += 8;

  y = drawSectionHeader("MEDICATIONS (Patient Confirmed)", y);
  doc.fillColor(textColor).fontSize(9);
  const confirmedMeds = data.medications.filter(m => m.status === "confirmed");
  for (const med of confirmedMeds) {
    doc.text(`• ${med.name} ${med.dose} - ${med.frequency}`, 50, y);
    y += 12;
  }
  const unconfirmedMeds = data.medications.filter(m => m.status === "unconfirmed");
  if (unconfirmedMeds.length > 0) {
    doc.fillColor(mutedColor).fontSize(8);
    doc.text("Unconfirmed:", 50, y);
    y += 10;
    for (const med of unconfirmedMeds) {
      doc.text(`  • ${med.name} ${med.dose}`, 50, y);
      y += 10;
    }
  }
  y += 8;

  const leftColX = 40;
  const rightColX = 300;
  const colWidth = 252;
  const savedY = y;

  y = drawSectionHeader("RECENT LABS (Last 90 Days)", y);
  doc.fillColor(textColor).fontSize(8);
  for (const lab of data.recentLabs.slice(0, 6)) {
    const statusIcon = lab.status === "abnormal" ? "*" : lab.status === "critical" ? "**" : "";
    doc.text(`${lab.name}: ${lab.value}${statusIcon}`, 50, y, { width: 200 });
    doc.fillColor(mutedColor).text(new Date(lab.date).toLocaleDateString(), 220, y);
    doc.fillColor(textColor);
    y += 11;
  }
  y += 5;
  doc.fontSize(7).fillColor(mutedColor).text("* Abnormal  ** Critical", 50, y);
  y += 15;

  y = drawSectionHeader("IMAGING STUDIES", y);
  doc.fillColor(textColor).fontSize(8);
  for (const img of data.imaging) {
    doc.text(`• ${img.study}`, 50, y);
    doc.fillColor(mutedColor).text(new Date(img.date).toLocaleDateString(), 220, y);
    doc.fillColor(textColor);
    y += 11;
  }
  y += 8;

  y = drawSectionHeader("KEY DATES", y);
  doc.fillColor(textColor).fontSize(8);
  for (const keyDate of data.keyDates) {
    doc.text(`${keyDate.event}:`, 50, y);
    doc.text(new Date(keyDate.date).toLocaleDateString(), 180, y);
    y += 11;
  }

  const footerY = 750;
  doc.rect(0, footerY, 612, 42).fill("#F5F5F5");
  doc.fillColor(mutedColor).fontSize(7);
  doc.text("DISCLAIMER: This is a record summary only, not a clinical recommendation.", 40, footerY + 8);
  doc.text("This document contains Protected Health Information (PHI). Handle according to HIPAA requirements.", 40, footerY + 18);
  doc.text(`Document ID: SNAP-${Date.now()} | Tabula Medica © ${new Date().getFullYear()}`, 40, footerY + 28);

  doc.end();

  await new Promise<void>((resolve) => doc.on("end", resolve));

  const buffer = Buffer.concat(buffers);
  const filename = `clinical-snapshot-${data.patient.mrn}-${new Date().toISOString().split("T")[0]}.pdf`;

  return { buffer, filename };
}

export async function getClinicalSnapshotData(patientId: string): Promise<ClinicalSnapshotData> {
  return mockSnapshotData;
}
