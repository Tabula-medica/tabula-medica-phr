import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface SharedPatientCase {
  id: string;
  patientId: string;
  patientName: string;
  sharedBy: string;
  sharedByName: string;
  sharedWith: string[];
  createdAt: string;
  status: "active" | "resolved" | "archived";
  summary: string;
  clinicalContext: string;
  discussionNotes: DiscussionNote[];
  differentialDraft?: DifferentialDraft;
  alerts: CaseAlert[];
}

export interface DiscussionNote {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  isAiGenerated: boolean;
}

export interface DifferentialDraft {
  id: string;
  considerations: DifferentialConsideration[];
  lastUpdated: string;
  contributors: string[];
  aiSuggestions?: string;
}

export interface DifferentialConsideration {
  id: string;
  condition: string;
  supportingEvidence: string[];
  againstEvidence: string[];
  likelihood: "high" | "moderate" | "low" | "ruled_out";
  addedBy: string;
  addedByName: string;
  addedAt: string;
}

export interface CaseAlert {
  id: string;
  type: "critical_lab" | "drug_interaction" | "vital_abnormality" | "pending_result" | "care_gap";
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  createdAt: string;
  reviewedBy: string[];
  status: "pending" | "acknowledged" | "addressed";
  aiAnalysis?: string;
}

const sampleSharedCases: SharedPatientCase[] = [
  {
    id: "case-001",
    patientId: "patient-001",
    patientName: "John Smith",
    sharedBy: "clinician-001",
    sharedByName: "Dr. Sarah Chen",
    sharedWith: ["clinician-002", "clinician-003"],
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    summary: "68-year-old male with poorly controlled Type 2 Diabetes, presenting with fatigue and polyuria despite current medication regimen.",
    clinicalContext: "Patient has history of T2DM (6 years), HTN (9 years), and hyperlipidemia. Current HbA1c 9.2%, up from 7.8% three months ago. Recent medication adherence concerns.",
    discussionNotes: [
      {
        id: "note-001",
        authorId: "clinician-001",
        authorName: "Dr. Sarah Chen",
        content: "Requesting input on medication adjustment. Current regimen includes Metformin 1000mg BID, Lisinopril 20mg QD. Considering adding SGLT2 inhibitor given cardiovascular history.",
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        isAiGenerated: false,
      },
      {
        id: "note-002",
        authorId: "clinician-002",
        authorName: "Dr. Michael Roberts",
        content: "Reviewed renal function - eGFR 58, which is borderline for some SGLT2 inhibitors. Recommend verifying current kidney function before proceeding.",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        isAiGenerated: false,
      },
    ],
    differentialDraft: {
      id: "diff-001",
      considerations: [
        {
          id: "consid-001",
          condition: "Poor medication adherence",
          supportingEvidence: ["Patient reported missing doses", "HbA1c increase despite stable regimen"],
          againstEvidence: ["Pharmacy refill records show regular pickup"],
          likelihood: "moderate",
          addedBy: "clinician-001",
          addedByName: "Dr. Sarah Chen",
          addedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "consid-002",
          condition: "Disease progression requiring therapy intensification",
          supportingEvidence: ["Duration of diabetes (6 years)", "Progressive beta-cell decline typical in T2DM"],
          againstEvidence: [],
          likelihood: "high",
          addedBy: "clinician-002",
          addedByName: "Dr. Michael Roberts",
          addedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      contributors: ["clinician-001", "clinician-002"],
    },
    alerts: [
      {
        id: "alert-001",
        type: "critical_lab",
        severity: "warning",
        title: "Elevated HbA1c",
        description: "HbA1c 9.2% (target <7.0%) - significant increase from prior value",
        createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedBy: ["clinician-001"],
        status: "acknowledged",
      },
      {
        id: "alert-002",
        type: "care_gap",
        severity: "info",
        title: "Diabetic retinopathy screening overdue",
        description: "Last ophthalmology exam was 18 months ago. Annual screening recommended.",
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedBy: [],
        status: "pending",
      },
    ],
  },
  {
    id: "case-002",
    patientId: "patient-002",
    patientName: "Maria Garcia",
    sharedBy: "clinician-002",
    sharedByName: "Dr. Michael Roberts",
    sharedWith: ["clinician-001"],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    summary: "34-year-old female with asthma exacerbation and increased anxiety symptoms. Seeking input on integrated management approach.",
    clinicalContext: "History of moderate persistent asthma and generalized anxiety disorder. Recent stressful life events may be contributing to both conditions.",
    discussionNotes: [
      {
        id: "note-003",
        authorId: "clinician-002",
        authorName: "Dr. Michael Roberts",
        content: "Patient reports increased rescue inhaler use (4-5x/week up from 1-2x/week). Also notes worsening anxiety symptoms with sleep disturbance.",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        isAiGenerated: false,
      },
    ],
    alerts: [
      {
        id: "alert-003",
        type: "vital_abnormality",
        severity: "warning",
        title: "Increased rescue inhaler use",
        description: "Rescue inhaler frequency increased from 1-2x to 4-5x per week over past month",
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        reviewedBy: [],
        status: "pending",
      },
    ],
  },
];

const sampleClinicians = [
  { id: "clinician-001", name: "Dr. Sarah Chen", specialty: "Internal Medicine" },
  { id: "clinician-002", name: "Dr. Michael Roberts", specialty: "Family Medicine" },
  { id: "clinician-003", name: "Dr. Emily Watson", specialty: "Endocrinology" },
];

export async function getSharedCases(clinicianId: string): Promise<SharedPatientCase[]> {
  return sampleSharedCases.filter(
    (c) => c.sharedBy === clinicianId || c.sharedWith.includes(clinicianId)
  );
}

export async function getCaseById(caseId: string): Promise<SharedPatientCase | null> {
  return sampleSharedCases.find((c) => c.id === caseId) || null;
}

export async function getAvailableClinicians(): Promise<typeof sampleClinicians> {
  return sampleClinicians;
}

export async function generateAICaseSummary(
  patientContext: string,
  discussionHistory: DiscussionNote[]
): Promise<string> {
  const NO_CDS_INSTRUCTION = `CRITICAL: You are a clinical documentation assistant. You must NOT provide:
- Medical diagnoses or diagnostic suggestions
- Treatment recommendations
- Clinical decision support
- Predictions about patient outcomes

You may ONLY provide:
- Objective summaries of documented clinical information
- Organization of discussion points for documentation purposes
- Identification of information gaps that clinicians have noted

Begin your response with: "DOCUMENTATION SUMMARY (NOT CLINICAL ADVICE):"`;

  const discussionText = discussionHistory
    .map((n) => `${n.authorName}: ${n.content}`)
    .join("\n");

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: NO_CDS_INSTRUCTION },
        {
          role: "user",
          content: `Summarize the following clinical discussion for documentation purposes. Do NOT provide any clinical recommendations.

Patient Context:
${patientContext}

Discussion History:
${discussionText}

Provide a structured summary organizing the key points discussed by the clinical team.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    const summary = response.choices[0]?.message?.content;
    if (!summary) {
      return "Unable to generate summary. Please review the discussion notes directly.";
    }

    return summary + "\n\n[This summary is for documentation purposes only and does not constitute clinical decision support or medical advice.]";
  } catch (error) {
    console.error("Error generating AI case summary:", error);
    return "Unable to generate AI summary at this time. Please review the discussion notes directly.";
  }
}

export async function generateAlertAnalysis(
  alert: CaseAlert,
  patientContext: string
): Promise<string> {
  const NO_CDS_INSTRUCTION = `CRITICAL: You are a clinical documentation assistant analyzing an alert. You must NOT provide:
- Medical diagnoses
- Treatment recommendations
- Clinical decision support
- Actions the clinician should take

You may ONLY provide:
- Objective context about the alert type
- General educational information about the clinical finding
- Documentation of what the alert indicates

This is NOT clinical advice - it is educational context only.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: NO_CDS_INSTRUCTION },
        {
          role: "user",
          content: `Provide educational context about this clinical alert for documentation purposes. Do NOT provide recommendations.

Alert Type: ${alert.type}
Alert Title: ${alert.title}
Alert Description: ${alert.description}
Severity: ${alert.severity}

Patient Context:
${patientContext}

Explain what this alert means in general educational terms without recommending any actions.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 400,
    });

    const analysis = response.choices[0]?.message?.content;
    if (!analysis) {
      return "Unable to generate alert analysis.";
    }

    return analysis + "\n\n[DISCLAIMER: This is educational information only, not clinical decision support. Clinical judgment should guide all patient care decisions.]";
  } catch (error) {
    console.error("Error generating alert analysis:", error);
    return "Unable to generate AI analysis for this alert.";
  }
}

export async function addDiscussionNote(
  caseId: string,
  authorId: string,
  authorName: string,
  content: string
): Promise<DiscussionNote> {
  const note: DiscussionNote = {
    id: `note-${Date.now()}`,
    authorId,
    authorName,
    content,
    createdAt: new Date().toISOString(),
    isAiGenerated: false,
  };

  const caseToUpdate = sampleSharedCases.find((c) => c.id === caseId);
  if (caseToUpdate) {
    caseToUpdate.discussionNotes.push(note);
  }

  return note;
}

export async function addDifferentialConsideration(
  caseId: string,
  consideration: Omit<DifferentialConsideration, "id" | "addedAt">
): Promise<DifferentialConsideration | null> {
  const caseToUpdate = sampleSharedCases.find((c) => c.id === caseId);
  if (!caseToUpdate) return null;

  const newConsideration: DifferentialConsideration = {
    ...consideration,
    id: `consid-${Date.now()}`,
    addedAt: new Date().toISOString(),
  };

  if (!caseToUpdate.differentialDraft) {
    caseToUpdate.differentialDraft = {
      id: `diff-${Date.now()}`,
      considerations: [],
      lastUpdated: new Date().toISOString(),
      contributors: [],
    };
  }

  caseToUpdate.differentialDraft.considerations.push(newConsideration);
  caseToUpdate.differentialDraft.lastUpdated = new Date().toISOString();
  if (!caseToUpdate.differentialDraft.contributors.includes(consideration.addedBy)) {
    caseToUpdate.differentialDraft.contributors.push(consideration.addedBy);
  }

  return newConsideration;
}

export async function acknowledgeAlert(
  caseId: string,
  alertId: string,
  clinicianId: string
): Promise<CaseAlert | null> {
  const caseToUpdate = sampleSharedCases.find((c) => c.id === caseId);
  if (!caseToUpdate) return null;

  const alert = caseToUpdate.alerts.find((a) => a.id === alertId);
  if (!alert) return null;

  if (!alert.reviewedBy.includes(clinicianId)) {
    alert.reviewedBy.push(clinicianId);
  }
  alert.status = "acknowledged";

  return alert;
}

export async function createSharedCase(
  patientId: string,
  patientName: string,
  sharedBy: string,
  sharedByName: string,
  sharedWith: string[],
  summary: string,
  clinicalContext: string
): Promise<SharedPatientCase> {
  const newCase: SharedPatientCase = {
    id: `case-${Date.now()}`,
    patientId,
    patientName,
    sharedBy,
    sharedByName,
    sharedWith,
    createdAt: new Date().toISOString(),
    status: "active",
    summary,
    clinicalContext,
    discussionNotes: [],
    alerts: [],
  };

  sampleSharedCases.push(newCase);
  return newCase;
}
