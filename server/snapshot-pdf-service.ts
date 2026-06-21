import PDFDocument from "pdfkit";
import type { IStorage } from "./storage";

interface SnapshotData {
  patient: {
    name: string;
    dateOfBirth: string;
    generatedAt: string;
  };
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    status: string;
    patientReported?: string;
  }>;
  allergies: Array<{
    allergen: string;
    reaction: string;
    severity: string;
  }>;
  conditions: Array<{
    name: string;
    status: string;
    diagnosedDate?: string;
  }>;
  recentLabs: Array<{
    name: string;
    value: string;
    date: string;
    status: string;
  }>;
  recentImaging: Array<{
    type: string;
    date: string;
    finding: string;
  }>;
}

async function gatherSnapshotData(patientId: string, storage: IStorage): Promise<SnapshotData> {
  const medications = await storage.getMedicationsByPatient(patientId);
  const allergies = await storage.getAllergies();
  const labResults = await storage.getLabResultsByPatient(patientId);
  const conditionsList = await storage.getConditionsList();
  
  return {
    patient: {
      name: "Patient Health Summary",
      dateOfBirth: "",
      generatedAt: new Date().toISOString(),
    },
    medications: medications.slice(0, 15).map(med => ({
      name: med.name,
      dosage: med.dosage,
      frequency: med.frequency,
      status: med.status,
      patientReported: med.patientReported,
    })),
    allergies: allergies.slice(0, 10).map(allergy => ({
      allergen: allergy.name,
      reaction: allergy.reaction || "Unknown",
      severity: allergy.severity,
    })),
    conditions: conditionsList.slice(0, 10).map(conditionName => ({
      name: conditionName,
      status: "active",
      diagnosedDate: undefined,
    })),
    recentLabs: labResults.slice(0, 10).map(lab => ({
      name: lab.testName,
      value: `${lab.value} ${lab.unit || ""}`.trim(),
      date: lab.date,
      status: lab.status || "normal",
    })),
    recentImaging: [],
  };
}

export async function generateSnapshotPdf(patientId: string, storage: IStorage): Promise<Buffer> {
  const data = await gatherSnapshotData(patientId, storage);
  
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: "LETTER",
      margin: 50,
      bufferPages: true,
    });
    
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    
    doc.fontSize(20).font("Helvetica-Bold").text("Health Summary Snapshot", { align: "center" });
    doc.moveDown(0.5);
    
    doc.fontSize(10).font("Helvetica").fillColor("#666666")
      .text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, { align: "center" });
    doc.moveDown(1);
    
    doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke("#cccccc");
    doc.moveDown(0.5);
    
    const sectionTitle = (title: string) => {
      doc.moveDown(0.5);
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#1a1a1a").text(title);
      doc.moveDown(0.3);
    };
    
    const bulletItem = (text: string, subtext?: string) => {
      doc.fontSize(10).font("Helvetica").fillColor("#333333").text(`• ${text}`, { continued: !!subtext });
      if (subtext) {
        doc.font("Helvetica").fillColor("#666666").text(` - ${subtext}`);
      }
    };
    
    sectionTitle("Current Medications");
    if (data.medications.length === 0) {
      doc.fontSize(10).font("Helvetica-Oblique").fillColor("#888888").text("No medications on file");
    } else {
      data.medications.filter(m => m.status === "active").forEach(med => {
        const statusBadge = med.patientReported === "taking" ? " [Confirmed]" : 
                           med.patientReported === "not_taking" ? " [Not Taking]" : "";
        bulletItem(`${med.name} ${med.dosage}`, `${med.frequency}${statusBadge}`);
      });
    }
    
    sectionTitle("Allergies");
    if (data.allergies.length === 0) {
      doc.fontSize(10).font("Helvetica-Oblique").fillColor("#888888").text("No known allergies");
    } else {
      data.allergies.forEach(allergy => {
        const severityLabel = allergy.severity === "life_threatening" ? "SEVERE" : 
                             allergy.severity === "severe" ? "Severe" : 
                             allergy.severity === "moderate" ? "Moderate" : "Mild";
        bulletItem(`${allergy.allergen} (${severityLabel})`, allergy.reaction);
      });
    }
    
    sectionTitle("Active Conditions");
    if (data.conditions.length === 0) {
      doc.fontSize(10).font("Helvetica-Oblique").fillColor("#888888").text("No conditions on file");
    } else {
      data.conditions.filter(c => c.status === "active").forEach(condition => {
        bulletItem(condition.name, condition.diagnosedDate ? `Since ${condition.diagnosedDate}` : undefined);
      });
    }
    
    sectionTitle("Recent Lab Results");
    if (data.recentLabs.length === 0) {
      doc.fontSize(10).font("Helvetica-Oblique").fillColor("#888888").text("No recent labs on file");
    } else {
      data.recentLabs.slice(0, 8).forEach(lab => {
        const statusIndicator = lab.status === "abnormal" ? " ⚠" : 
                               lab.status === "critical" ? " ⚠⚠" : "";
        bulletItem(`${lab.name}: ${lab.value}${statusIndicator}`, lab.date);
      });
    }
    
    sectionTitle("Recent Imaging");
    if (data.recentImaging.length === 0) {
      doc.fontSize(10).font("Helvetica-Oblique").fillColor("#888888").text("No recent imaging on file");
    } else {
      data.recentImaging.slice(0, 5).forEach(img => {
        bulletItem(`${img.type} (${img.date})`, img.finding);
      });
    }
    
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).font("Helvetica").fillColor("#999999")
        .text(
          "INFORMATIONAL ONLY - This summary is for personal reference. Always consult your healthcare provider for medical decisions.",
          50,
          doc.page.height - 50,
          { align: "center", width: doc.page.width - 100 }
        );
    }
    
    doc.end();
  });
}
