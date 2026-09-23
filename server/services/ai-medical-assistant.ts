import { generatePhiSafeText } from "./ai-gateway";

export interface PatientHistorySummary {
  overview: string;
  conditions: {
    name: string;
    status: string;
    onsetDate?: string;
    notes?: string;
  }[];
  medications: {
    name: string;
    dosage: string;
    frequency: string;
    purpose?: string;
  }[];
  recentLabHighlights: {
    test: string;
    value: string;
    status: "normal" | "abnormal" | "critical";
    interpretation?: string;
  }[];
  keyVitals: {
    type: string;
    value: string;
    trend?: string;
  }[];
  allergies: string[];
  riskFactors: string[];
  careGaps: string[];
  noCdsDisclaimer: string;
}

export interface ConsultationSummary {
  consultationId: string;
  date: string;
  provider: string;
  specialty: string;
  chiefComplaint: string;
  summary: string;
  findings: string[];
  recommendations: string[];
  followUpNeeded: boolean;
  followUpDetails?: string;
  noCdsDisclaimer: string;
}

export interface PatientData {
  patientId: string;
  name: string;
  dateOfBirth: string;
  gender: string;
  conditions: Array<{ name: string; status: string; onsetDate?: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string }>;
  allergies: string[];
  labResults: Array<{ test: string; value: string; unit: string; date: string; referenceRange?: string }>;
  vitals: Array<{ type: string; value: string; unit: string; date: string }>;
  consultations: Array<{
    id: string;
    date: string;
    provider: string;
    specialty: string;
    chiefComplaint: string;
    notes: string;
  }>;
}

const NO_CDS_DISCLAIMER = "NO-CDS COMPLIANCE: This summary is for informational and educational purposes only. It does not constitute medical advice, clinical decision support, diagnosis, or treatment recommendations. Always consult with qualified healthcare providers for clinical decisions.";

export async function summarizePatientHistory(patientData: PatientData): Promise<PatientHistorySummary> {
  try {
    const prompt = `You are an AI medical assistant helping to summarize patient medical history for healthcare providers. 
    
CRITICAL COMPLIANCE REQUIREMENTS:
- You must NOT provide clinical recommendations, diagnoses, or treatment suggestions
- You must NOT interpret lab results as indicating specific diseases
- You are ONLY summarizing documented information, NOT making clinical judgments
- Focus on organizing and presenting the data clearly

Patient Data:
${JSON.stringify(patientData, null, 2)}

Create a structured summary with:
1. A brief overview paragraph (2-3 sentences summarizing key aspects)
2. Active conditions with their status
3. Current medications with purposes if documented
4. Recent lab highlights (flag abnormal values WITHOUT interpreting their clinical significance)
5. Key vital signs with trends if applicable
6. Known allergies
7. Documented risk factors (from records only, do NOT infer new ones)
8. Any documented care gaps

Respond in JSON format matching this structure:
{
  "overview": "string",
  "conditions": [{"name": "string", "status": "string", "onsetDate": "string", "notes": "string"}],
  "medications": [{"name": "string", "dosage": "string", "frequency": "string", "purpose": "string"}],
  "recentLabHighlights": [{"test": "string", "value": "string", "status": "normal|abnormal|critical", "interpretation": "string"}],
  "keyVitals": [{"type": "string", "value": "string", "trend": "string"}],
  "allergies": ["string"],
  "riskFactors": ["string"],
  "careGaps": ["string"]
}`;

    const content = await generatePhiSafeText({
      user: prompt,
      responseMimeType: "application/json",
      maxTokens: 2000,
    });

    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    return {
      ...parsed,
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  } catch (error) {
    console.error("[AIMedicalAssistant] Error summarizing patient history:", error);
    return getFallbackHistorySummary(patientData);
  }
}

export async function summarizeConsultation(
  consultation: PatientData["consultations"][0],
  patientContext: { name: string; conditions: string[] }
): Promise<ConsultationSummary> {
  try {
    const prompt = `You are an AI medical assistant helping to summarize a clinical consultation.

CRITICAL COMPLIANCE REQUIREMENTS:
- You must NOT provide clinical recommendations or treatment suggestions
- You must NOT make diagnoses or interpret symptoms
- You are ONLY summarizing what was documented in the consultation notes
- Focus on organizing and presenting the documented information clearly

Consultation Details:
${JSON.stringify(consultation, null, 2)}

Patient Context:
- Name: ${patientContext.name}
- Known Conditions: ${patientContext.conditions.join(", ") || "None documented"}

Create a structured summary with:
1. Brief summary paragraph (2-3 sentences)
2. Key findings documented during the visit
3. Recommendations that were documented by the provider
4. Whether follow-up was indicated and details if so

Respond in JSON format:
{
  "summary": "string",
  "findings": ["string"],
  "recommendations": ["string"],
  "followUpNeeded": boolean,
  "followUpDetails": "string"
}`;

    const content = await generatePhiSafeText({
      user: prompt,
      responseMimeType: "application/json",
      maxTokens: 1000,
    });

    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    return {
      consultationId: consultation.id,
      date: consultation.date,
      provider: consultation.provider,
      specialty: consultation.specialty,
      chiefComplaint: consultation.chiefComplaint,
      ...parsed,
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  } catch (error) {
    console.error("[AIMedicalAssistant] Error summarizing consultation:", error);
    return {
      consultationId: consultation.id,
      date: consultation.date,
      provider: consultation.provider,
      specialty: consultation.specialty,
      chiefComplaint: consultation.chiefComplaint,
      summary: `Consultation with ${consultation.provider} (${consultation.specialty}) on ${consultation.date}. Chief complaint: ${consultation.chiefComplaint}.`,
      findings: ["Unable to generate AI summary. Please review original notes."],
      recommendations: [],
      followUpNeeded: false,
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  }
}

export async function summarizeRecentConsultations(
  consultations: PatientData["consultations"],
  patientContext: { name: string; conditions: string[] }
): Promise<{
  summaries: ConsultationSummary[];
  overallPattern: string;
  noCdsDisclaimer: string;
}> {
  const summaries = await Promise.all(
    consultations.map((c) => summarizeConsultation(c, patientContext))
  );

  let overallPattern = "";
  if (consultations.length > 1) {
    try {
      const patternPrompt = `Based on these consultation summaries, provide a brief (2-3 sentences) pattern observation about visit frequency and documented concerns. Do NOT provide clinical interpretations or recommendations.

Consultations:
${summaries.map((s) => `- ${s.date}: ${s.chiefComplaint} - ${s.summary}`).join("\n")}

Respond with just a brief factual observation about the pattern of visits.`;

      overallPattern = await generatePhiSafeText({
        user: patternPrompt,
        maxTokens: 200,
      }) || "";
    } catch (error) {
      console.error("[AIMedicalAssistant] Error generating pattern:", error);
      overallPattern = `${consultations.length} consultations reviewed.`;
    }
  }

  return {
    summaries,
    overallPattern,
    noCdsDisclaimer: NO_CDS_DISCLAIMER,
  };
}

function getFallbackHistorySummary(patientData: PatientData): PatientHistorySummary {
  return {
    overview: `Patient ${patientData.name} has ${patientData.conditions.length} documented condition(s) and is currently on ${patientData.medications.length} medication(s).`,
    conditions: patientData.conditions.map((c) => ({
      name: c.name,
      status: c.status,
      onsetDate: c.onsetDate,
    })),
    medications: patientData.medications.map((m) => ({
      name: m.name,
      dosage: m.dosage,
      frequency: m.frequency,
    })),
    recentLabHighlights: patientData.labResults.slice(0, 5).map((l) => ({
      test: l.test,
      value: `${l.value} ${l.unit}`,
      status: "normal" as const,
    })),
    keyVitals: patientData.vitals.slice(0, 3).map((v) => ({
      type: v.type,
      value: `${v.value} ${v.unit}`,
    })),
    allergies: patientData.allergies,
    riskFactors: [],
    careGaps: [],
    noCdsDisclaimer: NO_CDS_DISCLAIMER,
  };
}

export function getMockPatientData(patientId: string): PatientData {
  const patients: Record<string, PatientData> = {
    "patient-001": {
      patientId: "patient-001",
      name: "John Smith",
      dateOfBirth: "1965-03-15",
      gender: "Male",
      conditions: [
        { name: "Type 2 Diabetes Mellitus", status: "Active", onsetDate: "2018-06-01" },
        { name: "Essential Hypertension", status: "Active", onsetDate: "2015-02-20" },
        { name: "Hyperlipidemia", status: "Controlled", onsetDate: "2017-09-15" },
      ],
      medications: [
        { name: "Metformin", dosage: "1000mg", frequency: "Twice daily" },
        { name: "Lisinopril", dosage: "20mg", frequency: "Once daily" },
        { name: "Atorvastatin", dosage: "40mg", frequency: "Once daily at bedtime" },
        { name: "Aspirin", dosage: "81mg", frequency: "Once daily" },
      ],
      allergies: ["Penicillin", "Sulfa drugs"],
      labResults: [
        { test: "HbA1c", value: "7.2", unit: "%", date: "2026-01-10", referenceRange: "4.0-5.6" },
        { test: "Fasting Glucose", value: "142", unit: "mg/dL", date: "2026-01-10", referenceRange: "70-100" },
        { test: "Total Cholesterol", value: "185", unit: "mg/dL", date: "2026-01-10", referenceRange: "<200" },
        { test: "LDL Cholesterol", value: "98", unit: "mg/dL", date: "2026-01-10", referenceRange: "<100" },
        { test: "Creatinine", value: "1.1", unit: "mg/dL", date: "2026-01-10", referenceRange: "0.7-1.3" },
      ],
      vitals: [
        { type: "Blood Pressure", value: "138/82", unit: "mmHg", date: "2026-01-15" },
        { type: "Heart Rate", value: "72", unit: "bpm", date: "2026-01-15" },
        { type: "Weight", value: "198", unit: "lbs", date: "2026-01-15" },
        { type: "BMI", value: "29.3", unit: "kg/m²", date: "2026-01-15" },
      ],
      consultations: [
        {
          id: "consult-001",
          date: "2026-01-15",
          provider: "Dr. Sarah Johnson",
          specialty: "Internal Medicine",
          chiefComplaint: "Routine diabetes follow-up",
          notes: "Patient reports good adherence to medications. Blood sugar levels have been stable. Discussed importance of continued dietary modifications. Patient walking 30 minutes daily. Weight stable. Continue current regimen. Follow up in 3 months with labs.",
        },
        {
          id: "consult-002",
          date: "2025-11-20",
          provider: "Dr. Michael Chen",
          specialty: "Cardiology",
          chiefComplaint: "Annual cardiac evaluation",
          notes: "Echocardiogram shows preserved ejection fraction at 55%. No significant valvular abnormalities. Blood pressure slightly elevated. Recommended increasing physical activity and reducing sodium intake. Continue current antihypertensive therapy.",
        },
        {
          id: "consult-003",
          date: "2025-09-10",
          provider: "Dr. Lisa Wong",
          specialty: "Ophthalmology",
          chiefComplaint: "Diabetic eye screening",
          notes: "Dilated fundus exam performed. No evidence of diabetic retinopathy. Mild cataracts bilateral. Recommend annual screening.",
        },
      ],
    },
    "patient-002": {
      patientId: "patient-002",
      name: "Maria Garcia",
      dateOfBirth: "1978-07-22",
      gender: "Female",
      conditions: [
        { name: "Asthma", status: "Well-controlled", onsetDate: "2005-04-10" },
        { name: "Generalized Anxiety Disorder", status: "Active", onsetDate: "2019-01-15" },
      ],
      medications: [
        { name: "Albuterol Inhaler", dosage: "90mcg", frequency: "As needed" },
        { name: "Fluticasone Inhaler", dosage: "250mcg", frequency: "Twice daily" },
        { name: "Sertraline", dosage: "50mg", frequency: "Once daily" },
      ],
      allergies: ["Latex", "Shellfish"],
      labResults: [
        { test: "Complete Blood Count", value: "Normal", unit: "", date: "2025-12-05" },
        { test: "Thyroid Panel", value: "Normal", unit: "", date: "2025-12-05" },
      ],
      vitals: [
        { type: "Blood Pressure", value: "118/72", unit: "mmHg", date: "2026-01-08" },
        { type: "Heart Rate", value: "68", unit: "bpm", date: "2026-01-08" },
        { type: "Weight", value: "145", unit: "lbs", date: "2026-01-08" },
        { type: "SpO2", value: "98", unit: "%", date: "2026-01-08" },
      ],
      consultations: [
        {
          id: "consult-004",
          date: "2026-01-08",
          provider: "Dr. Patricia Brown",
          specialty: "Pulmonology",
          chiefComplaint: "Asthma management review",
          notes: "Asthma well-controlled on current regimen. Peak flow measurements stable. Patient reports using rescue inhaler only 1-2 times per month. Continue current therapy. Review action plan for seasonal triggers.",
        },
      ],
    },
  };

  return patients[patientId] || patients["patient-001"];
}
