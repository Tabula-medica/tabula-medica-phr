import { Router, Request, Response } from "express";
import PDFDocument from "pdfkit";

const router = Router();

interface PatientData {
  name: string;
  dateOfBirth: string;
  gender?: string;
  bloodType?: string;
  allergies: string[];
  medications: { name: string; dosage: string; frequency: string }[];
  conditions: string[];
  emergencyContacts: { name: string; phone: string; relationship: string }[];
  caregiverContacts?: { name: string; phone: string; role: string }[];
}

interface CancerData extends PatientData {
  cancerType: string;
  diagnosisDate: string;
  stage?: string;
  treatments: { type: string; startDate: string; endDate?: string; notes?: string }[];
  followUps: { date: string; type: string; provider?: string }[];
  sideEffects?: { symptom: string; severity: string; date: string }[];
  imagingResults?: { date: string; type: string; findings: string }[];
  labResults?: { date: string; test: string; result: string; status: string }[];
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function calculateAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

router.post("/api/pdf/emergency-packet", async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const data: PatientData = req.body;
    
    if (!data.name) {
      return res.status(400).json({ error: "Patient name is required" });
    }
    
    const doc = new PDFDocument({
      size: "LETTER",
      margin: 40,
      info: {
        Title: `Emergency Packet - ${data.name}`,
        Author: "Tabula Medica",
        Subject: "Emergency Health Information",
      },
    });
    
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });
    
    const primaryColor = "#1e40af";
    const warningColor = "#dc2626";
    
    doc.rect(0, 0, doc.page.width, 60).fill(primaryColor);
    doc.fillColor("white")
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("EMERGENCY HEALTH PACKET", 40, 20, { align: "center" });
    
    doc.fillColor("#374151")
      .fontSize(9)
      .font("Helvetica")
      .text(`Generated: ${new Date().toLocaleString()} | NOT MEDICAL ADVICE - FOR INFORMATIONAL PURPOSES ONLY`, 40, 45, { align: "center" });
    
    let y = 75;
    
    doc.fillColor("#1f2937")
      .fontSize(14)
      .font("Helvetica-Bold")
      .text(data.name, 40, y);
    
    y += 18;
    const age = data.dateOfBirth ? calculateAge(data.dateOfBirth) : "Unknown";
    doc.fontSize(10)
      .font("Helvetica")
      .fillColor("#4b5563")
      .text(`DOB: ${data.dateOfBirth ? formatDate(data.dateOfBirth) : "Not provided"} | Age: ${age} | Blood Type: ${data.bloodType || "Unknown"}`, 40, y);
    
    y += 30;
    
    if (data.allergies && data.allergies.length > 0) {
      doc.rect(40, y, doc.page.width - 80, 45).fill("#fef2f2").stroke("#fecaca");
      doc.fillColor(warningColor)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("ALLERGIES", 50, y + 8);
      doc.fillColor("#7f1d1d")
        .fontSize(10)
        .font("Helvetica")
        .text(data.allergies.join(" | "), 50, y + 24, { width: doc.page.width - 100 });
      y += 55;
    }
    
    const colWidth = (doc.page.width - 90) / 2;
    
    if (data.medications && data.medications.length > 0) {
      doc.fillColor(primaryColor)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("CURRENT MEDICATIONS", 40, y);
      y += 15;
      
      data.medications.slice(0, 8).forEach((med) => {
        doc.fillColor("#1f2937")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(`• ${med.name}`, 45, y);
        doc.font("Helvetica")
          .fillColor("#4b5563")
          .text(`  ${med.dosage} - ${med.frequency}`, 55, y + 10);
        y += 22;
      });
      
      if (data.medications.length > 8) {
        doc.fillColor("#6b7280")
          .fontSize(8)
          .text(`+${data.medications.length - 8} more medications`, 45, y);
        y += 12;
      }
    }
    
    y += 10;
    
    if (data.conditions && data.conditions.length > 0) {
      doc.fillColor(primaryColor)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("KEY DIAGNOSES", 40, y);
      y += 15;
      
      data.conditions.slice(0, 6).forEach((condition) => {
        doc.fillColor("#1f2937")
          .fontSize(9)
          .font("Helvetica")
          .text(`• ${condition}`, 45, y);
        y += 12;
      });
    }
    
    y += 20;
    
    if (data.emergencyContacts && data.emergencyContacts.length > 0) {
      doc.fillColor(primaryColor)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("EMERGENCY CONTACTS", 40, y);
      y += 15;
      
      data.emergencyContacts.slice(0, 3).forEach((contact) => {
        doc.fillColor("#1f2937")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(`${contact.name} (${contact.relationship})`, 45, y);
        doc.font("Helvetica")
          .fillColor("#4b5563")
          .text(contact.phone, 45, y + 10);
        y += 24;
      });
    }
    
    if (data.caregiverContacts && data.caregiverContacts.length > 0) {
      y += 10;
      doc.fillColor(primaryColor)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("CAREGIVER CONTACTS", 40, y);
      y += 15;
      
      data.caregiverContacts.slice(0, 2).forEach((caregiver) => {
        doc.fillColor("#1f2937")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(`${caregiver.name} (${caregiver.role})`, 45, y);
        doc.font("Helvetica")
          .fillColor("#4b5563")
          .text(caregiver.phone, 45, y + 10);
        y += 24;
      });
    }
    
    doc.rect(0, doc.page.height - 35, doc.page.width, 35).fill("#f3f4f6");
    doc.fillColor("#6b7280")
      .fontSize(7)
      .font("Helvetica")
      .text(
        "DISCLAIMER: This document is for informational purposes only and does NOT constitute medical advice. Always consult healthcare providers for medical decisions.",
        40,
        doc.page.height - 28,
        { align: "center", width: doc.page.width - 80 }
      );
    
    doc.end();
    
    const pdfBuffer = await pdfPromise;
    const exportTime = Date.now() - startTime;
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="emergency-packet-${data.name.replace(/\s+/g, "-")}.pdf"`);
    res.setHeader("X-Export-Time-Ms", exportTime.toString());
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

router.post("/api/pdf/cancer-packet", async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const data: CancerData = req.body;
    
    if (!data.name || !data.cancerType) {
      return res.status(400).json({ error: "Patient name and cancer type are required" });
    }
    
    const doc = new PDFDocument({
      size: "LETTER",
      margin: 40,
      bufferPages: true,
      info: {
        Title: `Cancer Care Packet - ${data.name}`,
        Author: "Tabula Medica",
        Subject: "Cancer Treatment Summary",
      },
    });
    
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });
    
    const primaryColor = "#7c3aed";
    const accentColor = "#ec4899";
    void accentColor;
    
    const addHeader = (title: string, subtitle?: string) => {
      doc.rect(0, 0, doc.page.width, 70).fill(primaryColor);
      doc.fillColor("white")
        .fontSize(22)
        .font("Helvetica-Bold")
        .text(title, 40, 18, { align: "center" });
      if (subtitle) {
        doc.fontSize(11)
          .font("Helvetica")
          .text(subtitle, 40, 45, { align: "center" });
      }
    };
    
    const addFooter = () => {
      const pageNum = doc.bufferedPageRange().count;
      doc.fillColor("#9ca3af")
        .fontSize(8)
        .font("Helvetica")
        .text(
          `Page ${pageNum} | FOR INFORMATIONAL PURPOSES ONLY - NOT MEDICAL ADVICE | Generated: ${new Date().toLocaleDateString()}`,
          40,
          doc.page.height - 30,
          { align: "center", width: doc.page.width - 80 }
        );
    };
    
    const addSectionTitle = (title: string, y: number, _icon?: string): number => {
      doc.rect(40, y, doc.page.width - 80, 24).fill("#f5f3ff");
      doc.fillColor(primaryColor)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(title, 50, y + 6);
      return y + 34;
    };
    
    addHeader("CANCER CARE PACKET", `${data.name} | ${data.cancerType}`);
    
    let y = 85;
    
    y = addSectionTitle("PATIENT INFORMATION", y);
    
    const age = data.dateOfBirth ? calculateAge(data.dateOfBirth) : "Unknown";
    doc.fillColor("#374151").fontSize(10).font("Helvetica");
    doc.text(`Name: ${data.name}`, 50, y);
    doc.text(`Date of Birth: ${data.dateOfBirth ? formatDate(data.dateOfBirth) : "Not provided"} (Age: ${age})`, 50, y + 14);
    doc.text(`Blood Type: ${data.bloodType || "Unknown"}`, 50, y + 28);
    y += 50;
    
    y = addSectionTitle("CANCER BASICS", y);
    
    doc.fillColor("#374151").fontSize(10).font("Helvetica");
    doc.text(`Diagnosis: ${data.cancerType}`, 50, y);
    doc.text(`Date of Diagnosis: ${formatDate(data.diagnosisDate)}`, 50, y + 14);
    if (data.stage) {
      doc.text(`Stage: ${data.stage}`, 50, y + 28);
      y += 42;
    } else {
      y += 28;
    }
    y += 15;
    
    if (data.allergies && data.allergies.length > 0) {
      doc.rect(40, y, doc.page.width - 80, 30).fill("#fef2f2").stroke("#fecaca");
      doc.fillColor("#dc2626")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("ALLERGIES: ", 50, y + 10, { continued: true })
        .font("Helvetica")
        .fillColor("#7f1d1d")
        .text(data.allergies.join(", "));
      y += 45;
    }
    
    if (data.medications && data.medications.length > 0) {
      y = addSectionTitle("CURRENT MEDICATIONS", y);
      
      data.medications.forEach((med) => {
        if (y > doc.page.height - 100) {
          addFooter();
          doc.addPage();
          addHeader("CANCER CARE PACKET", `${data.name} | Medications (continued)`);
          y = 85;
        }
        
        doc.fillColor("#1f2937")
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(`• ${med.name}`, 50, y);
        doc.font("Helvetica")
          .fillColor("#6b7280")
          .text(`  ${med.dosage} - ${med.frequency}`, 60, y + 12);
        y += 28;
      });
      y += 10;
    }
    
    if (data.treatments && data.treatments.length > 0) {
      if (y > doc.page.height - 150) {
        addFooter();
        doc.addPage();
        addHeader("CANCER CARE PACKET", `${data.name} | Treatment Timeline`);
        y = 85;
      }
      
      y = addSectionTitle("TREATMENT TIMELINE", y);
      
      data.treatments.forEach((treatment, idx) => {
        if (y > doc.page.height - 80) {
          addFooter();
          doc.addPage();
          addHeader("CANCER CARE PACKET", `${data.name} | Treatment Timeline (continued)`);
          y = 85;
        }
        
        doc.circle(55, y + 8, 6).fill(idx === 0 ? accentColor : "#d1d5db");
        if (idx < data.treatments.length - 1) {
          doc.moveTo(55, y + 14).lineTo(55, y + 50).stroke("#d1d5db");
        }
        
        doc.fillColor("#1f2937")
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(treatment.type, 70, y);
        doc.font("Helvetica")
          .fillColor("#6b7280")
          .fontSize(9)
          .text(`${formatDate(treatment.startDate)}${treatment.endDate ? ` - ${formatDate(treatment.endDate)}` : " - Ongoing"}`, 70, y + 12);
        if (treatment.notes) {
          doc.text(treatment.notes, 70, y + 24, { width: doc.page.width - 150 });
        }
        y += 55;
      });
      y += 10;
    }
    
    if (data.followUps && data.followUps.length > 0) {
      if (y > doc.page.height - 150) {
        addFooter();
        doc.addPage();
        addHeader("CANCER CARE PACKET", `${data.name} | Follow-up Schedule`);
        y = 85;
      }
      
      y = addSectionTitle("FOLLOW-UP SCHEDULE", y);
      
      data.followUps.forEach((followUp) => {
        if (y > doc.page.height - 60) {
          addFooter();
          doc.addPage();
          addHeader("CANCER CARE PACKET", `${data.name} | Follow-up Schedule (continued)`);
          y = 85;
        }
        
        doc.fillColor("#374151")
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(`• ${formatDate(followUp.date)}`, 50, y);
        doc.font("Helvetica")
          .fillColor("#6b7280")
          .text(`  ${followUp.type}${followUp.provider ? ` with ${followUp.provider}` : ""}`, 60, y + 12);
        y += 30;
      });
      y += 10;
    }
    
    if (data.sideEffects && data.sideEffects.length > 0) {
      if (y > doc.page.height - 150) {
        addFooter();
        doc.addPage();
        addHeader("CANCER CARE PACKET", `${data.name} | Side Effects Summary`);
        y = 85;
      }
      
      y = addSectionTitle("SIDE EFFECTS SUMMARY", y);
      
      data.sideEffects.slice(0, 10).forEach((effect) => {
        if (y > doc.page.height - 60) {
          addFooter();
          doc.addPage();
          y = 85;
        }
        
        const severityColor = effect.severity === "severe" ? "#dc2626" : effect.severity === "moderate" ? "#f59e0b" : "#22c55e";
        
        doc.fillColor("#374151")
          .fontSize(10)
          .font("Helvetica")
          .text(`• ${effect.symptom}`, 50, y);
        doc.fillColor(severityColor)
          .text(` (${effect.severity})`, 50 + doc.widthOfString(`• ${effect.symptom} `), y);
        doc.fillColor("#9ca3af")
          .fontSize(8)
          .text(formatDate(effect.date), 50, y + 12);
        y += 28;
      });
    }
    
    if (data.emergencyContacts && data.emergencyContacts.length > 0) {
      if (y > doc.page.height - 120) {
        addFooter();
        doc.addPage();
        addHeader("CANCER CARE PACKET", `${data.name} | Contacts`);
        y = 85;
      }
      
      y = addSectionTitle("EMERGENCY & CAREGIVER CONTACTS", y);
      
      data.emergencyContacts.forEach((contact) => {
        doc.fillColor("#1f2937")
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(`${contact.name} (${contact.relationship})`, 50, y);
        doc.font("Helvetica")
          .fillColor("#6b7280")
          .text(contact.phone, 50, y + 12);
        y += 28;
      });
    }
    
    addFooter();
    doc.end();
    
    const pdfBuffer = await pdfPromise;
    const exportTime = Date.now() - startTime;
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="cancer-packet-${data.name.replace(/\s+/g, "-")}.pdf"`);
    res.setHeader("X-Export-Time-Ms", exportTime.toString());
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

export default router;
