import { generatePhiSafeText } from "./ai-gateway";
import { logPhiAccess } from "../security/hipaa-audit";

const NO_CDS_DISCLAIMER = "DISCLAIMER: AI-generated summaries are for INFORMATIONAL purposes only. They do NOT constitute clinical decision support or medical advice. All clinical decisions must be made by qualified healthcare professionals who have reviewed the complete medical record.";

export interface ExtractedDiagnosis {
  code?: string;
  description: string;
  status: "active" | "resolved" | "historical";
  dateIdentified?: string;
  source: string;
}

export interface ExtractedMedication {
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  status: "active" | "discontinued" | "as-needed";
  prescriber?: string;
  startDate?: string;
  source: string;
}

export interface ExtractedAllergy {
  allergen: string;
  reaction?: string;
  severity: "mild" | "moderate" | "severe" | "life-threatening" | "unknown";
  source: string;
}

export interface ClinicalNoteSection {
  sectionType: string;
  content: string;
  keyPoints: string[];
}

export interface PatientRecordSummary {
  id: string;
  patientId: string;
  patientName: string;
  generatedAt: string;
  recordCount: number;
  dateRange: { from: string; to: string };
  quickOverview: string;
  diagnoses: ExtractedDiagnosis[];
  medications: ExtractedMedication[];
  allergies: ExtractedAllergy[];
  clinicalNoteSummaries: {
    noteId: string;
    noteType: string;
    date: string;
    provider: string;
    summary: string;
    keyFindings: string[];
  }[];
  recentVisits: {
    date: string;
    type: string;
    provider: string;
    reason: string;
    outcome: string;
  }[];
  labTrends: {
    testName: string;
    recentValue: string;
    trend: "improving" | "stable" | "worsening" | "new";
    normalRange?: string;
  }[];
  searchableContent: string;
  disclaimer: string;
}

export interface SearchResult {
  recordId: string;
  patientId: string;
  matchType: "diagnosis" | "medication" | "allergy" | "note" | "visit" | "lab";
  matchedTerm: string;
  context: string;
  date?: string;
  relevanceScore: number;
}

const patientRecordStore = new Map<string, PatientRecordSummary>();
const clinicalNotesStore = new Map<string, any[]>();

function initializeSampleData() {
  const samplePatient1: PatientRecordSummary = {
    id: "summary-001",
    patientId: "patient-001",
    patientName: "John Smith",
    generatedAt: new Date().toISOString(),
    recordCount: 47,
    dateRange: { from: "2020-01-15", to: "2026-01-24" },
    quickOverview: "58-year-old male with Type 2 Diabetes, Hypertension, and Obesity. Recent A1C shows increasing trend (7.8%). Currently on Metformin 1000mg BID and Lisinopril 20mg daily. Last visit 6 weeks ago for routine diabetes management. Due for annual eye exam.",
    diagnoses: [
      { code: "E11.9", description: "Type 2 Diabetes Mellitus", status: "active", dateIdentified: "2018-03-15", source: "Primary Care Visit 2018" },
      { code: "I10", description: "Essential Hypertension", status: "active", dateIdentified: "2019-06-22", source: "Annual Physical 2019" },
      { code: "E66.9", description: "Obesity, unspecified", status: "active", dateIdentified: "2018-03-15", source: "Primary Care Visit 2018" },
      { code: "K21.0", description: "GERD with esophagitis", status: "active", dateIdentified: "2022-08-10", source: "GI Consultation 2022" },
      { code: "M54.5", description: "Low back pain", status: "historical", dateIdentified: "2021-04-05", source: "Urgent Care Visit 2021" }
    ],
    medications: [
      { name: "Metformin", dosage: "1000mg", frequency: "Twice daily", route: "Oral", status: "active", prescriber: "Dr. Sarah Chen", startDate: "2018-04-01", source: "Current Medication List" },
      { name: "Lisinopril", dosage: "20mg", frequency: "Once daily", route: "Oral", status: "active", prescriber: "Dr. Sarah Chen", startDate: "2019-07-15", source: "Current Medication List" },
      { name: "Omeprazole", dosage: "20mg", frequency: "Once daily", route: "Oral", status: "active", prescriber: "Dr. Michael Ross", startDate: "2022-08-15", source: "GI Consultation" },
      { name: "Atorvastatin", dosage: "40mg", frequency: "Once daily", route: "Oral", status: "active", prescriber: "Dr. Sarah Chen", startDate: "2020-02-10", source: "Current Medication List" },
      { name: "Ibuprofen", dosage: "400mg", frequency: "As needed", route: "Oral", status: "as-needed", prescriber: "Dr. James Wilson", startDate: "2021-04-05", source: "Urgent Care Visit" }
    ],
    allergies: [
      { allergen: "Penicillin", reaction: "Hives, facial swelling", severity: "moderate", source: "Patient Reported 2018" },
      { allergen: "Sulfa drugs", reaction: "Rash", severity: "mild", source: "Patient Reported 2018" },
      { allergen: "Shellfish", reaction: "Anaphylaxis", severity: "life-threatening", source: "ER Visit 2015" }
    ],
    clinicalNoteSummaries: [
      {
        noteId: "note-1",
        noteType: "Progress Note",
        date: "2025-12-10",
        provider: "Dr. Sarah Chen",
        summary: "Routine diabetes follow-up. Patient reports good medication adherence. Experiencing occasional fatigue. Blood pressure slightly elevated at 142/88.",
        keyFindings: ["A1C increased to 7.8% from 7.2%", "BP elevated - continue monitoring", "Weight stable at 210 lbs", "Foot exam normal - no neuropathy signs"]
      },
      {
        noteId: "note-2",
        noteType: "Lab Results Review",
        date: "2025-12-08",
        provider: "Dr. Sarah Chen",
        summary: "Reviewed comprehensive metabolic panel and lipid panel. Kidney function stable. Cholesterol well controlled on statin therapy.",
        keyFindings: ["eGFR 78 mL/min (stable)", "LDL 92 mg/dL (at goal)", "A1C 7.8% (above target)", "Urine microalbumin normal"]
      },
      {
        noteId: "note-3",
        noteType: "GI Consultation",
        date: "2022-08-10",
        provider: "Dr. Michael Ross",
        summary: "Evaluated for persistent heartburn. Upper endoscopy showed mild esophagitis. Started on PPI therapy with good response.",
        keyFindings: ["LA Grade A esophagitis on EGD", "No Barrett's esophagus", "H. pylori negative", "Omeprazole 20mg prescribed"]
      }
    ],
    recentVisits: [
      { date: "2025-12-10", type: "Office Visit", provider: "Dr. Sarah Chen", reason: "Diabetes follow-up", outcome: "Medication adjustments discussed, labs ordered" },
      { date: "2025-09-15", type: "Annual Physical", provider: "Dr. Sarah Chen", reason: "Preventive care", outcome: "Vaccines updated, screenings ordered" },
      { date: "2025-06-20", type: "Telehealth", provider: "Dr. Sarah Chen", reason: "Medication refill", outcome: "Medications renewed for 90 days" }
    ],
    labTrends: [
      { testName: "A1C", recentValue: "7.8%", trend: "worsening", normalRange: "<7.0%" },
      { testName: "LDL Cholesterol", recentValue: "92 mg/dL", trend: "improving", normalRange: "<100 mg/dL" },
      { testName: "eGFR", recentValue: "78 mL/min", trend: "stable", normalRange: ">60 mL/min" },
      { testName: "Blood Pressure", recentValue: "142/88 mmHg", trend: "worsening", normalRange: "<130/80 mmHg" }
    ],
    searchableContent: "Type 2 Diabetes Mellitus Hypertension Obesity GERD esophagitis Low back pain Metformin Lisinopril Omeprazole Atorvastatin Penicillin allergy Sulfa allergy Shellfish anaphylaxis A1C glucose blood pressure cholesterol kidney function Dr. Sarah Chen Dr. Michael Ross diabetes management foot exam neuropathy heartburn endoscopy",
    disclaimer: NO_CDS_DISCLAIMER
  };

  const samplePatient2: PatientRecordSummary = {
    id: "summary-002",
    patientId: "patient-002",
    patientName: "Mary Johnson",
    generatedAt: new Date().toISOString(),
    recordCount: 89,
    dateRange: { from: "2015-03-20", to: "2026-01-24" },
    quickOverview: "72-year-old female with complex cardiac history including CHF, Afib, and CKD Stage 3. Recent ER visit for fluid overload. Currently on diuretic therapy with close monitoring. High risk for readmission.",
    diagnoses: [
      { code: "I50.9", description: "Heart Failure, unspecified", status: "active", dateIdentified: "2019-11-10", source: "Cardiology Consultation 2019" },
      { code: "I48.91", description: "Atrial Fibrillation", status: "active", dateIdentified: "2020-02-14", source: "ER Visit 2020" },
      { code: "N18.3", description: "Chronic Kidney Disease Stage 3", status: "active", dateIdentified: "2021-05-20", source: "Nephrology Consultation 2021" },
      { code: "E78.5", description: "Hyperlipidemia", status: "active", dateIdentified: "2015-06-01", source: "Primary Care 2015" },
      { code: "Z95.0", description: "Presence of cardiac pacemaker", status: "active", dateIdentified: "2022-09-15", source: "Cardiology Procedure Note" }
    ],
    medications: [
      { name: "Furosemide", dosage: "40mg", frequency: "Twice daily", route: "Oral", status: "active", prescriber: "Dr. Robert Kim", startDate: "2019-11-15", source: "Current Medication List" },
      { name: "Metoprolol Succinate", dosage: "50mg", frequency: "Once daily", route: "Oral", status: "active", prescriber: "Dr. Robert Kim", startDate: "2020-03-01", source: "Cardiology" },
      { name: "Warfarin", dosage: "5mg", frequency: "Once daily", route: "Oral", status: "active", prescriber: "Dr. Robert Kim", startDate: "2020-02-20", source: "Anticoagulation Clinic" },
      { name: "Lisinopril", dosage: "10mg", frequency: "Once daily", route: "Oral", status: "active", prescriber: "Dr. Robert Kim", startDate: "2019-11-15", source: "Cardiology" },
      { name: "Potassium Chloride", dosage: "20mEq", frequency: "Once daily", route: "Oral", status: "active", prescriber: "Dr. Robert Kim", startDate: "2019-11-20", source: "Current Medication List" }
    ],
    allergies: [
      { allergen: "ACE Inhibitors (Captopril)", reaction: "Angioedema", severity: "severe", source: "Documented 2018" },
      { allergen: "Aspirin", reaction: "GI bleeding", severity: "moderate", source: "Patient Reported 2019" }
    ],
    clinicalNoteSummaries: [
      {
        noteId: "note-4",
        noteType: "ER Discharge Summary",
        date: "2026-01-10",
        provider: "Dr. Emily Watson",
        summary: "Presented with shortness of breath and lower extremity edema. Diagnosed with acute on chronic heart failure exacerbation. Treated with IV diuretics with good response.",
        keyFindings: ["BNP elevated at 1250 pg/mL", "Weight gain of 8 lbs over 2 weeks", "Chest X-ray showed pulmonary congestion", "Discharged on increased Lasix dose"]
      },
      {
        noteId: "note-5",
        noteType: "Cardiology Follow-up",
        date: "2025-11-20",
        provider: "Dr. Robert Kim",
        summary: "Routine CHF management. Euvolemic on exam. Echo showed stable EF of 35%. Discussed importance of daily weights and low-sodium diet.",
        keyFindings: ["EF stable at 35%", "No pacemaker malfunction", "INR therapeutic at 2.4", "Continue current regimen"]
      }
    ],
    recentVisits: [
      { date: "2026-01-10", type: "Emergency Room", provider: "Dr. Emily Watson", reason: "Shortness of breath, edema", outcome: "Admitted for CHF exacerbation, discharged after 3 days" },
      { date: "2025-11-20", type: "Cardiology Office", provider: "Dr. Robert Kim", reason: "CHF follow-up", outcome: "Stable, continue current management" },
      { date: "2025-10-05", type: "Anticoagulation Clinic", provider: "PharmD Lisa Brown", reason: "INR check", outcome: "INR therapeutic, continue Warfarin 5mg" }
    ],
    labTrends: [
      { testName: "BNP", recentValue: "1250 pg/mL", trend: "worsening", normalRange: "<100 pg/mL" },
      { testName: "Creatinine", recentValue: "1.8 mg/dL", trend: "stable", normalRange: "0.6-1.2 mg/dL" },
      { testName: "INR", recentValue: "2.4", trend: "stable", normalRange: "2.0-3.0" },
      { testName: "Potassium", recentValue: "4.2 mEq/L", trend: "stable", normalRange: "3.5-5.0 mEq/L" }
    ],
    searchableContent: "Heart Failure CHF Atrial Fibrillation Afib CKD Chronic Kidney Disease Hyperlipidemia pacemaker Furosemide Lasix Metoprolol Warfarin Coumadin anticoagulation INR Lisinopril Potassium ACE Inhibitor angioedema Aspirin GI bleeding shortness of breath dyspnea edema BNP Echo ejection fraction Dr. Robert Kim cardiology ER emergency fluid overload diuretics",
    disclaimer: NO_CDS_DISCLAIMER
  };

  patientRecordStore.set("patient-001", samplePatient1);
  patientRecordStore.set("patient-002", samplePatient2);

  clinicalNotesStore.set("patient-001", [
    {
      id: "cn-1",
      date: "2025-12-10",
      type: "Progress Note",
      provider: "Dr. Sarah Chen",
      content: `SUBJECTIVE: 58 yo male with T2DM, HTN, obesity presents for diabetes follow-up. Reports good medication adherence. Occasional fatigue, especially in afternoons. Denies polyuria, polydipsia, or visual changes. Diet has been challenging with holiday season.

OBJECTIVE:
Vitals: BP 142/88, HR 76, Weight 210 lbs (stable)
General: Well-appearing, no acute distress
CV: RRR, no murmurs
Ext: No edema, feet - monofilament testing normal bilaterally, no ulcers

ASSESSMENT/PLAN:
1. Type 2 Diabetes - A1C up to 7.8%. Will reinforce diet counseling. Consider adding GLP-1 agonist if not improved in 3 months.
2. Hypertension - BP slightly elevated. Continue Lisinopril 20mg. Reinforce low sodium diet.
3. Preventive care - Eye exam overdue by 3 months. Will send referral.
4. Follow-up in 3 months with A1C.`
    },
    {
      id: "cn-2",
      date: "2025-09-15",
      type: "Annual Physical",
      provider: "Dr. Sarah Chen",
      content: `ANNUAL WELLNESS VISIT

Chief Complaint: Annual physical exam

Review of Systems: Generally feels well. Intermittent heartburn controlled with Omeprazole. Occasional low back discomfort with prolonged sitting - not limiting activities.

Physical Exam: Within normal limits except obesity (BMI 32)

Health Maintenance:
- Colonoscopy: Due (last 2017, high risk)
- PSA: Will order
- Influenza vaccine: Administered today
- COVID booster: Administered today

Assessment: Overall stable chronic conditions. Due for colonoscopy and diabetic eye exam.`
    }
  ]);

  clinicalNotesStore.set("patient-002", [
    {
      id: "cn-3",
      date: "2026-01-10",
      type: "Emergency Room Note",
      provider: "Dr. Emily Watson",
      content: `CHIEF COMPLAINT: Shortness of breath x 3 days, worsening leg swelling

HPI: 72 yo female with known CHF (EF 35%), Afib on Warfarin, CKD3, presents with progressive dyspnea and bilateral lower extremity edema. Weight up 8 lbs at home over 2 weeks. Has been eating more salt due to holidays. Denies chest pain, palpitations, fever.

VITALS: BP 158/92, HR 88 irregular, O2 sat 91% RA
EXAM: JVD to angle of jaw, bibasilar crackles, 2+ pitting edema to knees bilaterally

LABS:
- BNP: 1250 (baseline 400)
- Creatinine: 1.9 (baseline 1.7)
- INR: 2.1

IMAGING: CXR shows pulmonary vascular congestion, small bilateral pleural effusions

ASSESSMENT: Acute on chronic systolic heart failure exacerbation, likely dietary indiscretion

PLAN:
- Admit to telemetry
- IV Furosemide 80mg x 2
- Strict I&O, daily weights
- Nephrology consult for AKI on CKD
- Continue anticoagulation`
    }
  ]);
}

initializeSampleData();

class AIMedicalRecordReviewService {
  
  async generatePatientSummary(patientId: string, patientName: string): Promise<PatientRecordSummary> {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "MedicalRecordReview",
      resourceId: patientId,
      details: `Generating AI summary for patient ${patientId}`
    });

    const existingSummary = patientRecordStore.get(patientId);
    if (existingSummary) {
      return existingSummary;
    }

    const clinicalNotes = clinicalNotesStore.get(patientId) || [];
    
    try {
      const notesText = clinicalNotes.map(n => `[${n.date}] ${n.type}: ${n.content}`).join("\n\n");

      const aiContent = await generatePhiSafeText({
        temperature: 0.3,
        maxTokens: 2000,
        system: `You are a medical record summarization assistant. Generate a structured summary extracting:
1. Key diagnoses with ICD-10 codes where available
2. Current medications with dosages
3. Known allergies with reactions
4. Summary of recent clinical notes
5. Lab result trends

Use neutral, factual language. Do not provide medical advice or recommendations.
Output in JSON format matching the PatientRecordSummary interface.`,
        user: `Summarize the following clinical notes for patient ${patientName}:\n\n${notesText || "No clinical notes available."}`
      }) || "";

      return this.parseAISummary(patientId, patientName, aiContent, clinicalNotes);
    } catch (error) {
      console.error("[MedicalRecordReview] AI error, using fallback:", error);
      return this.generateFallbackSummary(patientId, patientName, clinicalNotes);
    }
  }

  private parseAISummary(patientId: string, patientName: string, aiContent: string, clinicalNotes: any[]): PatientRecordSummary {
    const summary: PatientRecordSummary = {
      id: `summary-${patientId}`,
      patientId,
      patientName,
      generatedAt: new Date().toISOString(),
      recordCount: clinicalNotes.length,
      dateRange: this.getDateRange(clinicalNotes),
      quickOverview: `AI-generated summary for ${patientName}. Review clinical notes for complete information.`,
      diagnoses: [],
      medications: [],
      allergies: [],
      clinicalNoteSummaries: clinicalNotes.map(n => ({
        noteId: n.id,
        noteType: n.type,
        date: n.date,
        provider: n.provider,
        summary: n.content.substring(0, 200) + "...",
        keyFindings: []
      })),
      recentVisits: [],
      labTrends: [],
      searchableContent: clinicalNotes.map(n => n.content).join(" "),
      disclaimer: NO_CDS_DISCLAIMER
    };

    try {
      const parsed = JSON.parse(aiContent);
      if (parsed.quickOverview) summary.quickOverview = parsed.quickOverview;
      if (parsed.diagnoses) summary.diagnoses = parsed.diagnoses;
      if (parsed.medications) summary.medications = parsed.medications;
      if (parsed.allergies) summary.allergies = parsed.allergies;
    } catch {
      summary.quickOverview = aiContent.substring(0, 500);
    }

    return summary;
  }

  private generateFallbackSummary(patientId: string, patientName: string, clinicalNotes: any[]): PatientRecordSummary {
    return {
      id: `summary-${patientId}`,
      patientId,
      patientName,
      generatedAt: new Date().toISOString(),
      recordCount: clinicalNotes.length,
      dateRange: this.getDateRange(clinicalNotes),
      quickOverview: `Summary for ${patientName}. ${clinicalNotes.length} clinical notes available for review. Please review individual notes for complete information.`,
      diagnoses: [],
      medications: [],
      allergies: [],
      clinicalNoteSummaries: clinicalNotes.map(n => ({
        noteId: n.id,
        noteType: n.type,
        date: n.date,
        provider: n.provider,
        summary: n.content.substring(0, 300) + "...",
        keyFindings: []
      })),
      recentVisits: [],
      labTrends: [],
      searchableContent: clinicalNotes.map(n => n.content).join(" "),
      disclaimer: NO_CDS_DISCLAIMER
    };
  }

  private getDateRange(notes: any[]): { from: string; to: string } {
    if (notes.length === 0) {
      const today = new Date().toISOString().split("T")[0];
      return { from: today, to: today };
    }
    const dates = notes.map(n => n.date).sort();
    return { from: dates[0], to: dates[dates.length - 1] };
  }

  getPatientSummary(patientId: string): PatientRecordSummary | null {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "PatientRecordSummary",
      resourceId: patientId,
      details: "Retrieving patient record summary"
    });
    return patientRecordStore.get(patientId) || null;
  }

  getAllSummaries(): PatientRecordSummary[] {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "PatientRecordSummary",
      details: "Retrieving all patient record summaries"
    });
    return Array.from(patientRecordStore.values());
  }

  getClinicalNotes(patientId: string): any[] {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "ClinicalNotes",
      resourceId: patientId,
      details: "Retrieving clinical notes for patient"
    });
    return clinicalNotesStore.get(patientId) || [];
  }

  async summarizeClinicalNote(noteContent: string, noteType: string): Promise<{
    summary: string;
    keyFindings: string[];
    extractedData: {
      diagnoses: string[];
      medications: string[];
      allergies: string[];
      procedures: string[];
      labs: string[];
    };
    disclaimer: string;
  }> {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "ClinicalNoteSummarization",
      details: "AI summarizing clinical note"
    });

    try {
      const responseText = await generatePhiSafeText({
        responseMimeType: "application/json",
        temperature: 0.3,
        maxTokens: 1000,
        system: `You are a clinical documentation assistant. Summarize the clinical note and extract key information.

Output JSON with:
- summary: 2-3 sentence summary
- keyFindings: array of key clinical points
- extractedData: { diagnoses, medications, allergies, procedures, labs }

Use neutral language. Do not provide recommendations.`,
        user: `Summarize this ${noteType}:\n\n${noteContent}`
      });

      const parsed = JSON.parse(responseText || "{}");
      
      return {
        summary: parsed.summary || "Summary not available.",
        keyFindings: parsed.keyFindings || [],
        extractedData: {
          diagnoses: parsed.extractedData?.diagnoses || [],
          medications: parsed.extractedData?.medications || [],
          allergies: parsed.extractedData?.allergies || [],
          procedures: parsed.extractedData?.procedures || [],
          labs: parsed.extractedData?.labs || []
        },
        disclaimer: NO_CDS_DISCLAIMER
      };
    } catch (error) {
      console.error("[MedicalRecordReview] Note summarization error:", error);
      return {
        summary: "AI summarization unavailable. Please review the full note.",
        keyFindings: [],
        extractedData: { diagnoses: [], medications: [], allergies: [], procedures: [], labs: [] },
        disclaimer: NO_CDS_DISCLAIMER
      };
    }
  }

  searchRecords(query: string, patientId?: string): SearchResult[] {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "MedicalRecordSearch",
      details: `Searching records for: ${query}`
    });

    const results: SearchResult[] = [];
    const searchTerms = query.toLowerCase().split(/\s+/);
    
    const summaries = patientId 
      ? [patientRecordStore.get(patientId)].filter(Boolean) as PatientRecordSummary[]
      : Array.from(patientRecordStore.values());

    for (const summary of summaries) {
      for (const diagnosis of summary.diagnoses) {
        if (this.matchesSearch(diagnosis.description, searchTerms) || 
            (diagnosis.code && this.matchesSearch(diagnosis.code, searchTerms))) {
          results.push({
            recordId: summary.id,
            patientId: summary.patientId,
            matchType: "diagnosis",
            matchedTerm: diagnosis.description,
            context: `${diagnosis.status} - ${diagnosis.source}`,
            date: diagnosis.dateIdentified,
            relevanceScore: this.calculateRelevance(diagnosis.description, searchTerms)
          });
        }
      }

      for (const med of summary.medications) {
        if (this.matchesSearch(med.name, searchTerms)) {
          results.push({
            recordId: summary.id,
            patientId: summary.patientId,
            matchType: "medication",
            matchedTerm: `${med.name} ${med.dosage || ""}`.trim(),
            context: `${med.frequency || ""} - ${med.status}`,
            date: med.startDate,
            relevanceScore: this.calculateRelevance(med.name, searchTerms)
          });
        }
      }

      for (const allergy of summary.allergies) {
        if (this.matchesSearch(allergy.allergen, searchTerms) || 
            (allergy.reaction && this.matchesSearch(allergy.reaction, searchTerms))) {
          results.push({
            recordId: summary.id,
            patientId: summary.patientId,
            matchType: "allergy",
            matchedTerm: allergy.allergen,
            context: `${allergy.reaction || "Unknown reaction"} - ${allergy.severity}`,
            relevanceScore: this.calculateRelevance(allergy.allergen, searchTerms) + 10
          });
        }
      }

      for (const note of summary.clinicalNoteSummaries) {
        if (this.matchesSearch(note.summary, searchTerms)) {
          results.push({
            recordId: note.noteId,
            patientId: summary.patientId,
            matchType: "note",
            matchedTerm: note.noteType,
            context: note.summary.substring(0, 150) + "...",
            date: note.date,
            relevanceScore: this.calculateRelevance(note.summary, searchTerms)
          });
        }
      }

      for (const lab of summary.labTrends) {
        if (this.matchesSearch(lab.testName, searchTerms)) {
          results.push({
            recordId: summary.id,
            patientId: summary.patientId,
            matchType: "lab",
            matchedTerm: lab.testName,
            context: `${lab.recentValue} - ${lab.trend}`,
            relevanceScore: this.calculateRelevance(lab.testName, searchTerms)
          });
        }
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private matchesSearch(text: string, searchTerms: string[]): boolean {
    const lowerText = text.toLowerCase();
    return searchTerms.some(term => lowerText.includes(term));
  }

  private calculateRelevance(text: string, searchTerms: string[]): number {
    const lowerText = text.toLowerCase();
    let score = 0;
    for (const term of searchTerms) {
      if (lowerText.includes(term)) {
        score += 10;
        if (lowerText.startsWith(term)) score += 5;
        if (lowerText === term) score += 10;
      }
    }
    return score;
  }

  getStats(): {
    totalPatients: number;
    totalRecords: number;
    diagnosesExtracted: number;
    medicationsTracked: number;
    allergiesLogged: number;
    noteSummaries: number;
  } {
    const summaries = Array.from(patientRecordStore.values());
    return {
      totalPatients: summaries.length,
      totalRecords: summaries.reduce((sum, s) => sum + s.recordCount, 0),
      diagnosesExtracted: summaries.reduce((sum, s) => sum + s.diagnoses.length, 0),
      medicationsTracked: summaries.reduce((sum, s) => sum + s.medications.length, 0),
      allergiesLogged: summaries.reduce((sum, s) => sum + s.allergies.length, 0),
      noteSummaries: summaries.reduce((sum, s) => sum + s.clinicalNoteSummaries.length, 0)
    };
  }
}

export const aiMedicalRecordReviewService = new AIMedicalRecordReviewService();
