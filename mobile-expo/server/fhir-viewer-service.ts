import PDFDocument from "pdfkit";
import { tefcaClient } from "./tefca-client";

interface FhirCondition {
  id: string;
  code: string;
  displayName: string;
  clinicalStatus: string;
  verificationStatus: string;
  category: string;
  onsetDate: string | null;
  abatementDate: string | null;
  provider: string;
  facility: string;
  severity: string;
}

interface FhirMedication {
  id: string;
  code: string;
  displayName: string;
  status: string;
  dosage: string;
  route: string;
  frequency: string;
  prescriber: string;
  facility: string;
  dateWritten: string | null;
  refills: number;
}

interface FhirObservation {
  id: string;
  code: string;
  displayName: string;
  category: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: string;
  effectiveDate: string | null;
  performer: string;
  interpretation: string;
}

export interface PatientFhirData {
  patientName: string;
  dateOfBirth: string;
  gender: string;
  mrn: string;
  sourceNetwork: string;
  retrievedAt: string;
  conditions: FhirCondition[];
  medications: FhirMedication[];
  observations: FhirObservation[];
}

const CONDITION_CODES: Array<{ code: string; display: string; category: string; severity: string }> = [
  { code: "38341003", display: "Essential Hypertension", category: "Cardiovascular", severity: "Moderate" },
  { code: "44054006", display: "Type 2 Diabetes Mellitus", category: "Endocrine", severity: "Moderate" },
  { code: "195967001", display: "Asthma", category: "Respiratory", severity: "Mild" },
  { code: "73211009", display: "Diabetes Mellitus", category: "Endocrine", severity: "Moderate" },
  { code: "13645005", display: "Chronic Obstructive Pulmonary Disease", category: "Respiratory", severity: "Severe" },
  { code: "49436004", display: "Atrial Fibrillation", category: "Cardiovascular", severity: "Moderate" },
  { code: "40930008", display: "Hypothyroidism", category: "Endocrine", severity: "Mild" },
  { code: "267036007", display: "Dyslipidemia", category: "Metabolic", severity: "Mild" },
  { code: "84229001", display: "Fatigue", category: "General", severity: "Mild" },
  { code: "431855005", display: "Chronic Kidney Disease, Stage 3", category: "Renal", severity: "Moderate" },
];

const MEDICATION_CODES: Array<{ code: string; display: string; dosage: string; route: string; frequency: string }> = [
  { code: "314076", display: "Lisinopril 10mg", dosage: "10 mg", route: "Oral", frequency: "Once daily" },
  { code: "860975", display: "Metformin 500mg", dosage: "500 mg", route: "Oral", frequency: "Twice daily" },
  { code: "197361", display: "Atorvastatin 20mg", dosage: "20 mg", route: "Oral", frequency: "Once daily at bedtime" },
  { code: "310798", display: "Levothyroxine 50mcg", dosage: "50 mcg", route: "Oral", frequency: "Once daily AM" },
  { code: "1049640", display: "Albuterol 90mcg Inhaler", dosage: "90 mcg/actuation", route: "Inhalation", frequency: "As needed" },
  { code: "197381", display: "Amlodipine 5mg", dosage: "5 mg", route: "Oral", frequency: "Once daily" },
  { code: "310429", display: "Omeprazole 20mg", dosage: "20 mg", route: "Oral", frequency: "Once daily before meals" },
  { code: "849727", display: "Aspirin 81mg", dosage: "81 mg", route: "Oral", frequency: "Once daily" },
];

const OBSERVATION_CODES: Array<{ code: string; display: string; category: string; unit: string; range: string; genValue: () => string; genInterpretation: (v: string) => string }> = [
  { code: "8480-6", display: "Systolic Blood Pressure", category: "vital-signs", unit: "mmHg", range: "90-120", genValue: () => String(100 + Math.floor(Math.random() * 50)), genInterpretation: (v) => Number(v) > 140 ? "High" : Number(v) < 90 ? "Low" : "Normal" },
  { code: "8462-4", display: "Diastolic Blood Pressure", category: "vital-signs", unit: "mmHg", range: "60-80", genValue: () => String(60 + Math.floor(Math.random() * 35)), genInterpretation: (v) => Number(v) > 90 ? "High" : Number(v) < 60 ? "Low" : "Normal" },
  { code: "8867-4", display: "Heart Rate", category: "vital-signs", unit: "bpm", range: "60-100", genValue: () => String(60 + Math.floor(Math.random() * 40)), genInterpretation: (v) => Number(v) > 100 ? "Tachycardia" : Number(v) < 60 ? "Bradycardia" : "Normal" },
  { code: "8310-5", display: "Body Temperature", category: "vital-signs", unit: "°F", range: "97.0-99.0", genValue: () => (97 + Math.random() * 3).toFixed(1), genInterpretation: (v) => Number(v) > 100.4 ? "Fever" : "Normal" },
  { code: "29463-7", display: "Body Weight", category: "vital-signs", unit: "kg", range: "50-100", genValue: () => (60 + Math.random() * 40).toFixed(1), genInterpretation: () => "Normal" },
  { code: "4548-4", display: "Hemoglobin A1c", category: "laboratory", unit: "%", range: "4.0-5.6", genValue: () => (5.0 + Math.random() * 3.5).toFixed(1), genInterpretation: (v) => Number(v) > 6.5 ? "High" : Number(v) > 5.7 ? "Pre-diabetes" : "Normal" },
  { code: "2093-3", display: "Total Cholesterol", category: "laboratory", unit: "mg/dL", range: "<200", genValue: () => String(140 + Math.floor(Math.random() * 100)), genInterpretation: (v) => Number(v) > 240 ? "High" : Number(v) > 200 ? "Borderline" : "Desirable" },
  { code: "2085-9", display: "HDL Cholesterol", category: "laboratory", unit: "mg/dL", range: ">40", genValue: () => String(35 + Math.floor(Math.random() * 40)), genInterpretation: (v) => Number(v) < 40 ? "Low" : Number(v) > 60 ? "Optimal" : "Normal" },
  { code: "33914-3", display: "eGFR", category: "laboratory", unit: "mL/min/1.73m2", range: ">60", genValue: () => String(45 + Math.floor(Math.random() * 75)), genInterpretation: (v) => Number(v) < 30 ? "Severely decreased" : Number(v) < 60 ? "Moderately decreased" : "Normal" },
  { code: "2339-0", display: "Blood Glucose", category: "laboratory", unit: "mg/dL", range: "70-100", genValue: () => String(70 + Math.floor(Math.random() * 80)), genInterpretation: (v) => Number(v) > 126 ? "High" : Number(v) < 70 ? "Low" : "Normal" },
  { code: "2160-0", display: "Creatinine", category: "laboratory", unit: "mg/dL", range: "0.7-1.3", genValue: () => (0.6 + Math.random() * 1.2).toFixed(1), genInterpretation: (v) => Number(v) > 1.3 ? "Elevated" : "Normal" },
  { code: "59260-0", display: "Hemoglobin", category: "laboratory", unit: "g/dL", range: "12.0-17.5", genValue: () => (11 + Math.random() * 7).toFixed(1), genInterpretation: (v) => Number(v) < 12 ? "Low (Anemia)" : Number(v) > 17.5 ? "High" : "Normal" },
];

const PROVIDERS = ["Dr. Sarah Chen", "Dr. James Wilson", "Dr. Maria Rodriguez", "Dr. Michael Park", "Dr. Emily Thompson"];
const FACILITIES = ["CommonWell Medical Center", "Carequality Regional Hospital", "Epic Nexus Health System", "eHealth Exchange Clinic", "Health Gorilla Primary Care"];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(daysBack: number): string {
  return new Date(Date.now() - Math.random() * daysBack * 24 * 60 * 60 * 1000).toISOString();
}

function formatDate(d: string | null): string {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

class FhirViewerService {
  generateDemoPatientData(patientName?: string): PatientFhirData {
    const name = patientName || "Jane A. Doe";
    const numConditions = 4 + Math.floor(Math.random() * 4);
    const numMedications = 3 + Math.floor(Math.random() * 4);
    const numObservations = 6 + Math.floor(Math.random() * 5);

    const usedConditions = new Set<number>();
    const conditions: FhirCondition[] = [];
    for (let i = 0; i < numConditions; i++) {
      let idx: number;
      do { idx = Math.floor(Math.random() * CONDITION_CODES.length); } while (usedConditions.has(idx));
      usedConditions.add(idx);
      const c = CONDITION_CODES[idx];
      conditions.push({
        id: `cond-${idx}-${Date.now()}`,
        code: c.code,
        displayName: c.display,
        clinicalStatus: Math.random() > 0.2 ? "active" : "resolved",
        verificationStatus: "confirmed",
        category: c.category,
        onsetDate: randomDate(1825),
        abatementDate: Math.random() > 0.7 ? randomDate(180) : null,
        provider: randomPick(PROVIDERS),
        facility: randomPick(FACILITIES),
        severity: c.severity,
      });
    }

    const usedMeds = new Set<number>();
    const medications: FhirMedication[] = [];
    for (let i = 0; i < numMedications; i++) {
      let idx: number;
      do { idx = Math.floor(Math.random() * MEDICATION_CODES.length); } while (usedMeds.has(idx));
      usedMeds.add(idx);
      const m = MEDICATION_CODES[idx];
      medications.push({
        id: `med-${idx}-${Date.now()}`,
        code: m.code,
        displayName: m.display,
        status: Math.random() > 0.15 ? "active" : "stopped",
        dosage: m.dosage,
        route: m.route,
        frequency: m.frequency,
        prescriber: randomPick(PROVIDERS),
        facility: randomPick(FACILITIES),
        dateWritten: randomDate(365),
        refills: Math.floor(Math.random() * 6),
      });
    }

    const usedObs = new Set<number>();
    const observations: FhirObservation[] = [];
    for (let i = 0; i < numObservations; i++) {
      let idx: number;
      do { idx = Math.floor(Math.random() * OBSERVATION_CODES.length); } while (usedObs.has(idx));
      usedObs.add(idx);
      const o = OBSERVATION_CODES[idx];
      const val = o.genValue();
      observations.push({
        id: `obs-${idx}-${Date.now()}`,
        code: o.code,
        displayName: o.display,
        category: o.category,
        value: val,
        unit: o.unit,
        referenceRange: o.range,
        status: "final",
        effectiveDate: randomDate(90),
        performer: randomPick(PROVIDERS),
        interpretation: o.genInterpretation(val),
      });
    }

    return {
      patientName: name,
      dateOfBirth: "1975-08-15",
      gender: "Female",
      mrn: `MRN-${Math.floor(100000 + Math.random() * 900000)}`,
      sourceNetwork: "TEFCA / CommonWell Health Alliance",
      retrievedAt: new Date().toISOString(),
      conditions: conditions.sort((a, b) => (a.clinicalStatus === "active" ? -1 : 1) - (b.clinicalStatus === "active" ? -1 : 1)),
      medications: medications.sort((a, b) => (a.status === "active" ? -1 : 1) - (b.status === "active" ? -1 : 1)),
      observations: observations.sort((a, b) => new Date(b.effectiveDate || 0).getTime() - new Date(a.effectiveDate || 0).getTime()),
    };
  }

  generatePatientPDF(data: PatientFhirData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: "LETTER", margin: 50, bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on("data", (c: Buffer) => chunks.push(c));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        doc.rect(0, 0, doc.page.width, 4).fill("#0066CC");
        doc.fontSize(8).fillColor("#EF4444").text("CONFIDENTIAL - PROTECTED HEALTH INFORMATION", 50, 15, { align: "center" });
        doc.moveTo(50, 28).lineTo(doc.page.width - 50, 28).stroke("#E2E8F0");

        doc.fontSize(20).fillColor("#1A202C").text("TABULA MEDICA", 50, 40);
        doc.fontSize(14).fillColor("#4A5568").text("Patient Health Record - FHIR R4 via TEFCA", 50, 65);

        doc.fontSize(10).fillColor("#718096");
        doc.text(`Patient: ${data.patientName}`, 50, 95);
        doc.text(`DOB: ${data.dateOfBirth} | Gender: ${data.gender} | MRN: ${data.mrn}`, 50, 110);
        doc.text(`Source: ${data.sourceNetwork}`, 50, 125);
        doc.text(`Retrieved: ${formatDate(data.retrievedAt)}`, 50, 140);
        doc.moveTo(50, 160).lineTo(doc.page.width - 50, 160).stroke("#E2E8F0");

        doc.fontSize(10).fillColor("#4A5568");
        doc.text(`Conditions: ${data.conditions.length} | Medications: ${data.medications.length} | Observations: ${data.observations.length}`, 50, 170);
        doc.y = 195;

        this.renderConditionsPDF(doc, data.conditions);
        this.renderMedicationsPDF(doc, data.medications);
        this.renderObservationsPDF(doc, data.observations);

        const pages = doc.bufferedPageRange();
        for (let i = pages.start; i < pages.start + pages.count; i++) {
          doc.switchToPage(i);
          const bottom = doc.page.height - 30;
          doc.fontSize(7).fillColor("#718096");
          doc.text(`Page ${i + 1} of ${pages.count}`, 50, bottom, { align: "center", width: doc.page.width - 100 });
          doc.text("Contains PHI. Unauthorized disclosure prohibited.", 50, bottom + 10, { align: "center", width: doc.page.width - 100 });
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private addPageIfNeeded(doc: PDFKit.PDFDocument) {
    if (doc.y > doc.page.height - 100) {
      doc.addPage();
      doc.fontSize(8).fillColor("#EF4444").text("CONFIDENTIAL - PROTECTED HEALTH INFORMATION", 50, 15, { align: "center" });
      doc.y = 40;
    }
  }

  private renderConditionsPDF(doc: PDFKit.PDFDocument, conditions: FhirCondition[]) {
    doc.fontSize(14).fillColor("#3B82F6").text("Conditions", 50, doc.y);
    doc.y += 8;

    for (const c of conditions) {
      this.addPageIfNeeded(doc);
      const statusColor = c.clinicalStatus === "active" ? "#22C55E" : "#6B7280";
      doc.rect(50, doc.y, doc.page.width - 100, 1).fill("#E2E8F0");
      doc.y += 6;
      doc.fontSize(10).fillColor("#1A202C").text(c.displayName, 50, doc.y);
      doc.fontSize(8).fillColor(statusColor).text(c.clinicalStatus.toUpperCase(), 400, doc.y, { align: "right", width: 112 });
      doc.y += 4;
      doc.fontSize(8).fillColor("#718096");
      doc.text(`Category: ${c.category} | Severity: ${c.severity}`, 60);
      doc.text(`Onset: ${formatDate(c.onsetDate)}${c.abatementDate ? ` | Resolved: ${formatDate(c.abatementDate)}` : ""}`, 60);
      doc.text(`Provider: ${c.provider} | ${c.facility}`, 60);
      doc.y += 8;
    }
    doc.y += 10;
  }

  private renderMedicationsPDF(doc: PDFKit.PDFDocument, medications: FhirMedication[]) {
    this.addPageIfNeeded(doc);
    doc.fontSize(14).fillColor("#10B981").text("Medications", 50, doc.y);
    doc.y += 8;

    for (const m of medications) {
      this.addPageIfNeeded(doc);
      const statusColor = m.status === "active" ? "#22C55E" : "#6B7280";
      doc.rect(50, doc.y, doc.page.width - 100, 1).fill("#E2E8F0");
      doc.y += 6;
      doc.fontSize(10).fillColor("#1A202C").text(m.displayName, 50, doc.y);
      doc.fontSize(8).fillColor(statusColor).text(m.status.toUpperCase(), 400, doc.y, { align: "right", width: 112 });
      doc.y += 4;
      doc.fontSize(8).fillColor("#718096");
      doc.text(`Dosage: ${m.dosage} | Route: ${m.route} | ${m.frequency}`, 60);
      doc.text(`Prescribed: ${formatDate(m.dateWritten)} | Refills: ${m.refills}`, 60);
      doc.text(`Prescriber: ${m.prescriber} | ${m.facility}`, 60);
      doc.y += 8;
    }
    doc.y += 10;
  }

  private renderObservationsPDF(doc: PDFKit.PDFDocument, observations: FhirObservation[]) {
    this.addPageIfNeeded(doc);
    doc.fontSize(14).fillColor("#6366F1").text("Observations & Lab Results", 50, doc.y);
    doc.y += 8;

    for (const o of observations) {
      this.addPageIfNeeded(doc);
      const interpColor = o.interpretation === "Normal" || o.interpretation === "Optimal" || o.interpretation === "Desirable" ? "#22C55E" : o.interpretation === "High" || o.interpretation === "Low" || o.interpretation === "Elevated" ? "#EF4444" : "#F59E0B";
      doc.rect(50, doc.y, doc.page.width - 100, 1).fill("#E2E8F0");
      doc.y += 6;
      doc.fontSize(10).fillColor("#1A202C").text(o.displayName, 50, doc.y);
      doc.fontSize(9).fillColor(interpColor).text(`${o.value} ${o.unit}`, 350, doc.y, { align: "right", width: 162 });
      doc.y += 4;
      doc.fontSize(8).fillColor("#718096");
      doc.text(`Category: ${o.category === "vital-signs" ? "Vital Signs" : "Laboratory"} | Ref: ${o.referenceRange} | ${o.interpretation}`, 60);
      doc.text(`Date: ${formatDate(o.effectiveDate)} | Performer: ${o.performer}`, 60);
      doc.y += 8;
    }
  }
}

export const fhirViewerService = new FhirViewerService();
