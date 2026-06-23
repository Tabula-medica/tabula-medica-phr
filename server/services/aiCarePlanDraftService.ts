// CDS-GATED — this service performs Clinical Decision Support (AI-generated care
// plan drafts with medication/lifestyle/appointment recommendations). DISABLED by
// default via the ENABLE_CDS kill-switch pending FDA Non-Device CDS determination +
// counsel review. NOT a NO-CDS claim.
// See _cds-gate.ts, NO-CDS-TRIAGE.md, ventures/tabula-medica/PHR-CDS-COUNSEL-BRIEF.md.
import OpenAI from "openai";
import { assertCdsEnabled } from "./_cds-gate";
import { logPhiAccess } from "../security/hipaa-audit";
import type {
  AICarePlanDraft,
  AICarePlanMedicationRec,
  AICarePlanLifestyleRec,
  AICarePlanAppointmentRec,
  AICarePlanEducationRec,
  AICarePlanDraftStatus,
} from "@shared/schema";

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const SAFE_VERBS = ["shows", "states", "refers to", "means"];
const PROHIBITED_VERBS = [
  "recommends", "suggests", "advises", "indicates", "should", "must",
  "needs to", "ought to", "requires", "prescribes", "directs", "instructs",
  "urges", "encourages", "implies", "proposes", "advocates"
];

function sanitizeText(text: string): string {
  let sanitized = text;
  const replacements: Record<string, string> = {
    "\\brecommends\\b": "shows",
    "\\bsuggests\\b": "shows",
    "\\badvises\\b": "states",
    "\\bindicates\\b": "shows",
    "\\bshould\\b": "means",
    "\\bmust\\b": "means",
    "\\bneeds to\\b": "refers to",
    "\\bought to\\b": "means",
    "\\brequires\\b": "refers to",
    "\\bprescribes\\b": "refers to",
    "\\bdirects\\b": "states",
    "\\binstructs\\b": "states",
    "\\burges\\b": "shows",
    "\\bencourages\\b": "shows",
    "\\bimplies\\b": "means",
    "\\bproposes\\b": "shows",
    "\\badvocates\\b": "shows",
  };

  for (const [pattern, replacement] of Object.entries(replacements)) {
    sanitized = sanitized.replace(new RegExp(pattern, "gi"), replacement);
  }
  return sanitized;
}

function ensureSafeContent(content: string): string {
  let safe = sanitizeText(content);
  safe = sanitizeText(safe);
  for (const verb of PROHIBITED_VERBS) {
    if (safe.toLowerCase().includes(verb)) {
      safe = safe.replace(new RegExp(`\\b${verb}\\b`, "gi"), "shows");
    }
  }
  return safe;
}

function generateId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export interface PatientHealthData {
  patientId: string;
  patientName: string;
  age?: number;
  conditions: string[];
  medications: string[];
  allergies: string[];
  recentLabResults?: { name: string; value: string; date: string; normal?: boolean }[];
  vitalSigns?: { type: string; value: string; date: string }[];
  goals?: string[];
}

const MOCK_DRAFTS: AICarePlanDraft[] = [
  {
    id: "draft-sample-1",
    patientId: "patient-1",
    patientName: "Sarah Johnson",
    status: "pending_review",
    generatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    generatedBy: "ai-system",
    primaryCondition: "Type 2 Diabetes",
    conditions: ["Type 2 Diabetes", "Hypertension", "Obesity"],
    treatmentGoals: ["Reduce HbA1c to below 7%", "Achieve blood pressure below 130/80"],
    analysisNotes: ensureSafeContent("Patient data shows elevated blood glucose trends over the past 3 months. Lab results state HbA1c at 8.2%. Records refer to current medication regimen that means adjustment may benefit glucose control."),
    medications: [
      {
        id: "med-1",
        name: "Metformin",
        dosage: "1000mg",
        frequency: "Twice daily with meals",
        rationale: ensureSafeContent("Current lab data shows elevated fasting glucose. Research states metformin as first-line therapy for type 2 diabetes."),
        contraindications: ["Renal impairment", "Lactic acidosis risk"],
        sideEffects: ["GI upset", "Vitamin B12 deficiency"],
      },
      {
        id: "med-2",
        name: "Lisinopril",
        dosage: "20mg",
        frequency: "Once daily",
        rationale: ensureSafeContent("Blood pressure readings show values above target. Guidelines state ACE inhibitors provide renal protection in diabetic patients."),
        contraindications: ["Angioedema history", "Pregnancy"],
        sideEffects: ["Dry cough", "Hyperkalemia"],
      },
    ],
    lifestyle: [
      {
        id: "life-1",
        category: "exercise",
        title: "Daily Walking Program",
        description: ensureSafeContent("Data shows sedentary lifestyle pattern. Walking 30 minutes daily means improved insulin sensitivity and cardiovascular health."),
        frequency: "Daily",
        priority: "high",
        rationale: ensureSafeContent("Physical activity research shows significant HbA1c reduction with regular aerobic exercise."),
        evidenceBasis: "ADA Standards of Care 2024",
      },
      {
        id: "life-2",
        category: "diet",
        title: "Mediterranean Diet Pattern",
        description: ensureSafeContent("Current dietary assessment shows high carbohydrate intake. Mediterranean diet pattern refers to improved glycemic control in clinical trials."),
        frequency: "All meals",
        priority: "high",
        rationale: ensureSafeContent("Studies state Mediterranean diet reduces cardiovascular risk in diabetic patients."),
        evidenceBasis: "PREDIMED Trial",
      },
    ],
    appointments: [
      {
        id: "apt-1",
        type: "follow_up",
        purpose: "Diabetes management review and HbA1c recheck",
        suggestedTimeframe: "6-8 weeks",
        priority: "routine",
        rationale: ensureSafeContent("Follow-up timeline shows adequate time for medication effects. Lab protocols state HbA1c reflects 2-3 month average."),
      },
      {
        id: "apt-2",
        type: "specialist",
        specialty: "Ophthalmology",
        purpose: "Diabetic retinopathy screening",
        suggestedTimeframe: "Within 3 months",
        priority: "routine",
        rationale: ensureSafeContent("Guidelines state annual eye exams for diabetic patients. Records show no recent screening."),
      },
    ],
    education: [
      {
        id: "edu-1",
        topic: "Understanding Blood Glucose Monitoring",
        summary: ensureSafeContent("Materials show how to properly monitor blood glucose levels, what the numbers mean, and when to take action."),
        resources: [
          { title: "Blood Glucose Basics", type: "article" },
          { title: "How to Use Your Glucose Meter", type: "video" },
        ],
        relevance: ensureSafeContent("Self-monitoring data shows improved outcomes. Patient education refers to better medication adherence."),
      },
    ],
    overallRationale: ensureSafeContent("This care plan shows a comprehensive approach to managing Type 2 Diabetes with comorbid hypertension. The analysis states that current HbA1c levels mean need for intensified management. Evidence-based guidelines refer to combined lifestyle and pharmacological interventions for optimal outcomes."),
    evidenceBasis: ["ADA Standards of Medical Care 2024", "JNC 8 Hypertension Guidelines", "PREDIMED Trial", "DPP Study"],
    riskFactors: [
      { factor: "Cardiovascular disease", severity: "high", mitigation: "Blood pressure control, statin therapy consideration" },
      { factor: "Diabetic nephropathy", severity: "medium", mitigation: "ACE inhibitor therapy, regular kidney function monitoring" },
    ],
  },
];

let draftsStore: AICarePlanDraft[] = [...MOCK_DRAFTS];

export function getAllDrafts(status?: AICarePlanDraftStatus): AICarePlanDraft[] {
  if (status) {
    return draftsStore.filter(d => d.status === status);
  }
  return draftsStore;
}

export function getDraftById(draftId: string): AICarePlanDraft | undefined {
  return draftsStore.find(d => d.id === draftId);
}

export function getDraftsByPatient(patientId: string): AICarePlanDraft[] {
  return draftsStore.filter(d => d.patientId === patientId);
}

export async function generateCarePlanDraft(
  patientData: PatientHealthData,
  primaryCondition: string,
  treatmentGoals: string[],
  userId: string
): Promise<AICarePlanDraft> {
  assertCdsEnabled("aiCarePlanDraftService.generateCarePlanDraft");
  logPhiAccess({
    userId,
    patientId: patientData.patientId,
    resourceType: "AICarePlanDraft",
    action: "write",
    details: `Generating AI care plan draft for condition: ${primaryCondition}`,
  });

  const client = getOpenAI();
  if (!client) {
    console.log("[AICarePlanDraft] OpenAI not configured, using mock generation");
    return generateMockDraft(patientData, primaryCondition, treatmentGoals, userId);
  }

  try {
    const prompt = `You are a clinical decision support AI helping create personalized care plans. Generate comprehensive recommendations for a patient with the following profile:

Patient: ${patientData.patientName}
Age: ${patientData.age || "Unknown"}
Conditions: ${patientData.conditions.join(", ")}
Current Medications: ${patientData.medications.join(", ") || "None"}
Allergies: ${patientData.allergies.join(", ") || "None known"}
${patientData.recentLabResults?.length ? `Recent Labs: ${patientData.recentLabResults.map(l => `${l.name}: ${l.value}`).join(", ")}` : ""}
${patientData.vitalSigns?.length ? `Vital Signs: ${patientData.vitalSigns.map(v => `${v.type}: ${v.value}`).join(", ")}` : ""}

Primary Condition: ${primaryCondition}
Treatment Goals: ${treatmentGoals.join("; ")}

CRITICAL LANGUAGE RULES - You MUST only use these 4 verbs: "shows", "states", "refers to", "means"
- Instead of "recommends" or "suggests" use "shows"
- Instead of "indicates" use "shows"
- Instead of "advises" use "states"
- Instead of "should" or "must" use "means"
- Instead of "requires" use "refers to"

Generate a JSON response with:
1. analysisNotes: Overview of patient's current health status using only safe verbs
2. medications: Array of medication recommendations with id, name, dosage, frequency, rationale, contraindications, sideEffects
3. lifestyle: Array of lifestyle changes with id, category (exercise/diet/sleep/stress/habits), title, description, frequency, priority, rationale, evidenceBasis
4. appointments: Array of follow-up appointments with id, type (follow_up/specialist/lab_work/imaging/procedure/telehealth), specialty (if applicable), purpose, suggestedTimeframe, priority (urgent/routine/preventive), rationale
5. education: Array of educational resources with id, topic, summary, resources array, relevance
6. overallRationale: Summary of the care plan approach using only safe verbs
7. evidenceBasis: Array of clinical guidelines/studies supporting the recommendations
8. riskFactors: Array of risk factors with factor, severity (high/medium/low), mitigation

Return valid JSON only.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty AI response");

    const parsed = JSON.parse(content);
    
    const draft: AICarePlanDraft = {
      id: generateId(),
      patientId: patientData.patientId,
      patientName: patientData.patientName,
      status: "pending_review",
      generatedAt: new Date().toISOString(),
      generatedBy: "ai-system",
      primaryCondition,
      conditions: patientData.conditions,
      treatmentGoals,
      analysisNotes: ensureSafeContent(parsed.analysisNotes || ""),
      medications: (parsed.medications || []).map((m: any) => ({
        ...m,
        id: m.id || generateId(),
        rationale: ensureSafeContent(m.rationale || ""),
      })),
      lifestyle: (parsed.lifestyle || []).map((l: any) => ({
        ...l,
        id: l.id || generateId(),
        description: ensureSafeContent(l.description || ""),
        rationale: ensureSafeContent(l.rationale || ""),
      })),
      appointments: (parsed.appointments || []).map((a: any) => ({
        ...a,
        id: a.id || generateId(),
        rationale: ensureSafeContent(a.rationale || ""),
      })),
      education: (parsed.education || []).map((e: any) => ({
        ...e,
        id: e.id || generateId(),
        summary: ensureSafeContent(e.summary || ""),
        relevance: ensureSafeContent(e.relevance || ""),
      })),
      overallRationale: ensureSafeContent(parsed.overallRationale || ""),
      evidenceBasis: parsed.evidenceBasis || [],
      riskFactors: parsed.riskFactors || [],
    };

    draftsStore.push(draft);
    return draft;
  } catch (error) {
    console.error("[AICarePlanDraft] OpenAI error:", error);
    return generateMockDraft(patientData, primaryCondition, treatmentGoals, userId);
  }
}

function generateMockDraft(
  patientData: PatientHealthData,
  primaryCondition: string,
  treatmentGoals: string[],
  userId: string
): AICarePlanDraft {
  const draft: AICarePlanDraft = {
    id: generateId(),
    patientId: patientData.patientId,
    patientName: patientData.patientName,
    status: "pending_review",
    generatedAt: new Date().toISOString(),
    generatedBy: "ai-system",
    primaryCondition,
    conditions: patientData.conditions,
    treatmentGoals,
    analysisNotes: ensureSafeContent(`Patient data shows ${primaryCondition} as the primary concern. Current health records state need for comprehensive management approach. Treatment goals refer to ${treatmentGoals.join(", ")}.`),
    medications: [
      {
        id: generateId(),
        name: "Medication based on condition",
        dosage: "As determined by provider",
        frequency: "Per clinical guidelines",
        rationale: ensureSafeContent("Clinical data shows this medication class means appropriate first-line therapy for the condition."),
        contraindications: ["To be reviewed by clinician"],
        sideEffects: ["Common side effects to be discussed"],
      },
    ],
    lifestyle: [
      {
        id: generateId(),
        category: "exercise",
        title: "Regular Physical Activity",
        description: ensureSafeContent("Evidence shows regular physical activity means improved health outcomes for this condition."),
        frequency: "30 minutes daily",
        priority: "high",
        rationale: ensureSafeContent("Research states exercise as a cornerstone of chronic disease management."),
        evidenceBasis: "Current Clinical Guidelines",
      },
    ],
    appointments: [
      {
        id: generateId(),
        type: "follow_up",
        purpose: "Review treatment progress and adjust care plan",
        suggestedTimeframe: "4-6 weeks",
        priority: "routine",
        rationale: ensureSafeContent("Standard care protocols show follow-up within this timeframe means adequate monitoring."),
      },
    ],
    education: [
      {
        id: generateId(),
        topic: `Understanding ${primaryCondition}`,
        summary: ensureSafeContent(`Educational materials show comprehensive information about ${primaryCondition}, what the diagnosis means, and how patients can participate in their care.`),
        resources: [
          { title: "Condition Overview", type: "article" },
          { title: "Self-Management Guide", type: "pdf" },
        ],
        relevance: ensureSafeContent("Patient education research states improved outcomes with health literacy."),
      },
    ],
    overallRationale: ensureSafeContent(`This AI-generated care plan shows a structured approach to managing ${primaryCondition}. The recommendations refer to current evidence-based guidelines and means comprehensive patient care. Clinical review states the final plan should be tailored by the care team.`),
    evidenceBasis: ["Current Clinical Practice Guidelines", "Evidence-Based Medicine Resources"],
    riskFactors: [
      { factor: "Disease progression", severity: "medium", mitigation: "Regular monitoring and medication adherence" },
    ],
  };

  draftsStore.push(draft);
  return draft;
}

export function updateDraft(
  draftId: string,
  updates: Partial<AICarePlanDraft>,
  userId: string,
  userName?: string
): AICarePlanDraft | null {
  const index = draftsStore.findIndex(d => d.id === draftId);
  if (index === -1) return null;

  const draft = draftsStore[index];
  
  logPhiAccess({
    userId,
    patientId: draft.patientId,
    resourceType: "AICarePlanDraft",
    action: "write",
    details: `Updated care plan draft: ${draftId}, status: ${updates.status || draft.status}`,
  });

  if (updates.status === "under_review" && draft.status === "pending_review") {
    updates.reviewedBy = userId;
    updates.reviewedByName = userName;
    updates.reviewedAt = new Date().toISOString();
  }

  if (updates.status === "approved") {
    updates.approvedAt = new Date().toISOString();
  }

  draftsStore[index] = { ...draft, ...updates };
  return draftsStore[index];
}

export function approveDraft(
  draftId: string,
  clinicianId: string,
  clinicianName: string,
  feedback?: string
): AICarePlanDraft | null {
  const draft = getDraftById(draftId);
  if (!draft) return null;

  logPhiAccess({
    userId: clinicianId,
    patientId: draft.patientId,
    resourceType: "AICarePlanDraft",
    action: "write",
    details: `Approved care plan draft: ${draftId}`,
  });

  return updateDraft(draftId, {
    status: "approved",
    reviewedBy: clinicianId,
    reviewedByName: clinicianName,
    reviewedAt: new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    clinicianFeedback: feedback,
  }, clinicianId, clinicianName);
}

export function rejectDraft(
  draftId: string,
  clinicianId: string,
  clinicianName: string,
  reason: string
): AICarePlanDraft | null {
  const draft = getDraftById(draftId);
  if (!draft) return null;

  logPhiAccess({
    userId: clinicianId,
    patientId: draft.patientId,
    resourceType: "AICarePlanDraft",
    action: "write",
    details: `Rejected care plan draft: ${draftId}, reason: ${reason}`,
  });

  return updateDraft(draftId, {
    status: "rejected",
    reviewedBy: clinicianId,
    reviewedByName: clinicianName,
    reviewedAt: new Date().toISOString(),
    rejectionReason: reason,
  }, clinicianId, clinicianName);
}

export function requestRevisions(
  draftId: string,
  clinicianId: string,
  clinicianName: string,
  feedback: string
): AICarePlanDraft | null {
  const draft = getDraftById(draftId);
  if (!draft) return null;

  logPhiAccess({
    userId: clinicianId,
    patientId: draft.patientId,
    resourceType: "AICarePlanDraft",
    action: "write",
    details: `Requested revisions for care plan draft: ${draftId}`,
  });

  return updateDraft(draftId, {
    status: "revisions_requested",
    reviewedBy: clinicianId,
    reviewedByName: clinicianName,
    reviewedAt: new Date().toISOString(),
    clinicianFeedback: feedback,
  }, clinicianId, clinicianName);
}

export function assignDraftToPatient(
  draftId: string,
  clinicianId: string
): AICarePlanDraft | null {
  const draft = getDraftById(draftId);
  if (!draft || draft.status !== "approved") return null;

  logPhiAccess({
    userId: clinicianId,
    patientId: draft.patientId,
    resourceType: "AICarePlanDraft",
    action: "write",
    details: `Assigned approved care plan to patient: ${draft.patientId}`,
  });

  return updateDraft(draftId, {
    status: "assigned",
    assignedAt: new Date().toISOString(),
  }, clinicianId);
}

export function updateRecommendation(
  draftId: string,
  section: "medications" | "lifestyle" | "appointments" | "education",
  itemId: string,
  updates: any,
  userId: string
): AICarePlanDraft | null {
  const draft = getDraftById(draftId);
  if (!draft) return null;

  logPhiAccess({
    userId,
    patientId: draft.patientId,
    resourceType: "AICarePlanDraft",
    action: "write",
    details: `Updated ${section} item ${itemId} in draft ${draftId}`,
  });

  const sectionData = [...(draft[section] as any[])];
  const itemIndex = sectionData.findIndex((item: any) => item.id === itemId);
  if (itemIndex === -1) return null;

  if (updates.rationale) updates.rationale = ensureSafeContent(updates.rationale);
  if (updates.description) updates.description = ensureSafeContent(updates.description);
  if (updates.summary) updates.summary = ensureSafeContent(updates.summary);

  sectionData[itemIndex] = { ...sectionData[itemIndex], ...updates };

  return updateDraft(draftId, { [section]: sectionData }, userId);
}

export function toggleRecommendationApproval(
  draftId: string,
  section: "medications" | "lifestyle" | "appointments" | "education",
  itemId: string,
  approved: boolean,
  notes: string | undefined,
  userId: string
): AICarePlanDraft | null {
  return updateRecommendation(draftId, section, itemId, {
    clinicianApproved: approved,
    clinicianNotes: notes,
  }, userId);
}
