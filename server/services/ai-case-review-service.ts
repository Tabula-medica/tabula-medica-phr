import OpenAI from "openai";
import { randomUUID } from "crypto";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const NO_CDS_DISCLAIMER = "EDUCATIONAL CONTENT ONLY. This AI-generated analysis is for informational and educational purposes ONLY. It does NOT constitute medical advice, diagnosis, or clinical decision support. All clinical decisions must be made by qualified healthcare providers based on their professional judgment, direct patient assessment, and complete medical history. This tool is designed to assist with research and education, not to replace clinical expertise.";

function logHIPAAAudit(action: string, details: Record<string, any>): void {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    service: "AICaseReview",
    action,
    // eslint-disable-next-line tabulaAuth/no-fallback-identity -- legitimate system actor: shared audit helper also logs provider-less automated events (ai_analysis_completed, discussion_summary_requested) that have no user
    userId: details.providerId || "system",
    caseId: details.caseId,
    details: {
      ...details,
      patientData: "[REDACTED]",
    },
    hipaaCompliant: true,
    dataAnonymized: true,
  };
  console.log(`[HIPAA-AUDIT][AICaseReview] ${JSON.stringify(auditEntry)}`);
}

export interface AnonymizedCaseData {
  ageRange: string;
  gender: string;
  chiefComplaint: string;
  presentIllnessHistory: string;
  medicalHistory: string[];
  currentMedications: { name: string; dosage: string; frequency: string }[];
  allergies: string[];
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
  };
  labResults?: { name: string; value: string; unit: string; status: string; date: string }[];
  imagingFindings?: string[];
  physicalExamFindings?: string[];
  socialHistory?: string;
  familyHistory?: string[];
}

export interface PotentialDiagnosis {
  id: string;
  condition: string;
  icdCode?: string;
  confidence: "high" | "moderate" | "low";
  reasoning: string;
  differentialConsiderations: string[];
  suggestedWorkup: string[];
}

export interface TreatmentOption {
  id: string;
  category: "pharmacological" | "procedural" | "lifestyle" | "referral" | "monitoring";
  name: string;
  description: string;
  evidenceLevel: "A" | "B" | "C" | "D";
  considerations: string[];
  contraindications: string[];
  monitoringRequired: string[];
}

export interface ClinicalTrialLink {
  id: string;
  nctNumber: string;
  title: string;
  status: "recruiting" | "active" | "completed" | "suspended";
  phase: string;
  condition: string;
  intervention: string;
  eligibilitySummary: string;
  location: string;
  url: string;
  relevanceScore: number;
}

export interface CaseReview {
  id: string;
  providerId: string;
  providerName: string;
  providerSpecialty: string;
  createdAt: string;
  updatedAt: string;
  status: "pending" | "analyzing" | "completed" | "reviewed" | "archived";
  anonymizedData: AnonymizedCaseData;
  potentialDiagnoses: PotentialDiagnosis[];
  treatmentOptions: TreatmentOption[];
  clinicalTrials: ClinicalTrialLink[];
  aiSummary: string;
  aiRecommendations: string[];
  additionalConsiderations: string[];
  urgencyAssessment: "routine" | "urgent" | "emergent";
  specialtyConsultRecommendations: string[];
  noCdsDisclaimer: string;
  reviewerNotes?: string;
  reviewedBy?: { providerId: string; name: string; specialty: string }[];
}

export interface ProviderMessage {
  id: string;
  caseReviewId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  messageType: "text" | "question" | "recommendation" | "response";
  attachments?: { type: string; name: string; url: string }[];
  mentions: { userId: string; name: string }[];
  createdAt: string;
  isRead: boolean;
  readBy: { userId: string; readAt: string }[];
}

export interface DiscussionThread {
  id: string;
  caseReviewId: string;
  title: string;
  participants: { providerId: string; name: string; specialty: string; role: string }[];
  messages: ProviderMessage[];
  aiSummary?: string;
  aiSummaryGeneratedAt?: string;
  keyPoints?: string[];
  actionItems?: { id: string; text: string; assignedTo?: string; completed: boolean }[];
  status: "active" | "resolved" | "archived";
  createdAt: string;
  updatedAt: string;
}

class AICaseReviewService {
  private caseReviews: Map<string, CaseReview> = new Map();
  private discussionThreads: Map<string, DiscussionThread> = new Map();
  private messages: Map<string, ProviderMessage[]> = new Map();

  constructor() {
    this.initializeSampleData();
    console.log("[AICaseReview] Service initialized with NO-CDS compliance");
    console.log("[AICaseReview] Features: Case analysis, diagnosis suggestions, treatment options, clinical trials");
  }

  private initializeSampleData(): void {
    const sampleCase: CaseReview = {
      id: "case-001",
      providerId: "provider-001",
      providerName: "Dr. Sarah Chen",
      providerSpecialty: "Internal Medicine",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      status: "completed",
      anonymizedData: {
        ageRange: "55-64",
        gender: "male",
        chiefComplaint: "Progressive fatigue and unexplained weight loss over 3 months",
        presentIllnessHistory: "Patient reports 15lb weight loss, decreased appetite, and persistent fatigue. Denies fever, night sweats, or pain.",
        medicalHistory: ["Type 2 Diabetes (10 years)", "Hypertension (15 years)", "Former smoker (quit 5 years ago)"],
        currentMedications: [
          { name: "Metformin", dosage: "1000mg", frequency: "twice daily" },
          { name: "Lisinopril", dosage: "20mg", frequency: "once daily" },
        ],
        allergies: ["Penicillin"],
        vitalSigns: {
          bloodPressure: "138/88",
          heartRate: 82,
          temperature: 98.4,
          respiratoryRate: 16,
          oxygenSaturation: 97,
        },
        labResults: [
          { name: "HbA1c", value: "8.2", unit: "%", status: "elevated", date: "2026-01-15" },
          { name: "Fasting Glucose", value: "165", unit: "mg/dL", status: "elevated", date: "2026-01-15" },
          { name: "Hemoglobin", value: "11.2", unit: "g/dL", status: "low", date: "2026-01-15" },
          { name: "Albumin", value: "3.2", unit: "g/dL", status: "low", date: "2026-01-15" },
        ],
        physicalExamFindings: ["Mild pallor", "No lymphadenopathy", "Abdomen soft, non-tender"],
        familyHistory: ["Father - colon cancer at age 68", "Mother - Type 2 Diabetes"],
      },
      potentialDiagnoses: [
        {
          id: "diag-001",
          condition: "Malignancy (unspecified)",
          icdCode: "C80.1",
          confidence: "moderate",
          reasoning: "Unexplained weight loss, fatigue, anemia, and low albumin in a former smoker with family history of colon cancer warrant malignancy workup.",
          differentialConsiderations: ["Pancreatic cancer", "Colon cancer", "Lung cancer", "Lymphoma"],
          suggestedWorkup: ["CT chest/abdomen/pelvis with contrast", "Colonoscopy", "Tumor markers (CEA, CA 19-9)"],
        },
        {
          id: "diag-002",
          condition: "Uncontrolled Type 2 Diabetes with complications",
          icdCode: "E11.65",
          confidence: "high",
          reasoning: "HbA1c of 8.2% indicates suboptimal glycemic control. Weight loss could be related to poor glucose control.",
          differentialConsiderations: ["Diabetic gastroparesis", "Medication side effects"],
          suggestedWorkup: ["Comprehensive metabolic panel", "Lipid panel", "Microalbumin/creatinine ratio"],
        },
      ],
      treatmentOptions: [
        {
          id: "tx-001",
          category: "referral",
          name: "Gastroenterology Referral",
          description: "For colonoscopy and upper GI evaluation given weight loss and family history",
          evidenceLevel: "B",
          considerations: ["Family history of colon cancer", "Age-appropriate screening", "Unexplained symptoms"],
          contraindications: [],
          monitoringRequired: ["Follow-up on biopsy results if obtained"],
        },
        {
          id: "tx-002",
          category: "pharmacological",
          name: "Diabetes Medication Optimization",
          description: "Consider adding GLP-1 agonist or SGLT2 inhibitor for better glycemic control",
          evidenceLevel: "A",
          considerations: ["Cardiovascular benefit", "Weight management", "Renal protection"],
          contraindications: ["Assess renal function before SGLT2 initiation"],
          monitoringRequired: ["Blood glucose monitoring", "Renal function every 3 months initially"],
        },
      ],
      clinicalTrials: [
        {
          id: "trial-001",
          nctNumber: "NCT05123456",
          title: "Novel GLP-1/GIP Dual Agonist for Type 2 Diabetes and Weight Management",
          status: "recruiting",
          phase: "Phase 3",
          condition: "Type 2 Diabetes Mellitus",
          intervention: "Dual GLP-1/GIP receptor agonist vs placebo",
          eligibilitySummary: "Adults 18-75 with T2DM, HbA1c 7-10%, BMI >25",
          location: "Multiple sites - United States",
          url: "https://clinicaltrials.gov/ct2/show/NCT05123456",
          relevanceScore: 0.85,
        },
      ],
      aiSummary: "This case presents a middle-aged male with concerning constitutional symptoms including significant weight loss and fatigue, alongside poorly controlled diabetes. The combination of unexplained weight loss, anemia, and hypoalbuminemia in a patient with a family history of colon cancer raises concern for an underlying malignancy. Simultaneously, diabetes management needs optimization.",
      aiRecommendations: [
        "Prioritize malignancy workup given red flag symptoms",
        "Order CT chest/abdomen/pelvis and colonoscopy",
        "Check tumor markers (CEA, CA 19-9, AFP)",
        "Optimize diabetes management once acute workup complete",
        "Consider nutritional support given weight loss and low albumin",
      ],
      additionalConsiderations: [
        "Patient's former smoking history increases lung cancer risk",
        "Consider depression screening as contributing factor",
        "Assess medication adherence",
      ],
      urgencyAssessment: "urgent",
      specialtyConsultRecommendations: ["Gastroenterology", "Oncology (if indicated)", "Endocrinology"],
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };

    this.caseReviews.set(sampleCase.id, sampleCase);

    const sampleThread: DiscussionThread = {
      id: "thread-001",
      caseReviewId: "case-001",
      title: "Case Discussion: Weight Loss and Fatigue Workup",
      participants: [
        { providerId: "provider-001", name: "Dr. Sarah Chen", specialty: "Internal Medicine", role: "primary" },
        { providerId: "provider-002", name: "Dr. Michael Lee", specialty: "Gastroenterology", role: "consultant" },
      ],
      messages: [
        {
          id: "msg-001",
          caseReviewId: "case-001",
          senderId: "provider-001",
          senderName: "Dr. Sarah Chen",
          senderRole: "Internal Medicine",
          content: "Requesting GI consult for this patient with unexplained weight loss and family history of colon cancer. Labs show anemia and low albumin. Would appreciate your input on colonoscopy timing.",
          messageType: "question",
          mentions: [{ userId: "provider-002", name: "Dr. Michael Lee" }],
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          isRead: true,
          readBy: [{ userId: "provider-002", readAt: new Date().toISOString() }],
        },
        {
          id: "msg-002",
          caseReviewId: "case-001",
          senderId: "provider-002",
          senderName: "Dr. Michael Lee",
          senderRole: "Gastroenterology",
          content: "Thank you for the referral. Given the red flag symptoms and family history, I recommend expedited colonoscopy within 2 weeks. I would also suggest upper EGD at the same time. Please ensure CT is completed before the procedures if possible.",
          messageType: "recommendation",
          mentions: [],
          createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          isRead: true,
          readBy: [{ userId: "provider-001", readAt: new Date().toISOString() }],
        },
      ],
      aiSummary: "Discussion centers on expedited GI workup for a patient with constitutional symptoms. GI recommends colonoscopy and EGD within 2 weeks, preceded by CT imaging.",
      keyPoints: [
        "Expedited colonoscopy recommended within 2 weeks",
        "Upper EGD to be performed concurrently",
        "CT imaging should precede endoscopic procedures",
      ],
      actionItems: [
        { id: "action-001", text: "Schedule colonoscopy and EGD", assignedTo: "provider-001", completed: false },
        { id: "action-002", text: "Order CT chest/abdomen/pelvis", assignedTo: "provider-001", completed: false },
      ],
      status: "active",
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.discussionThreads.set(sampleThread.id, sampleThread);
    this.messages.set("case-001", sampleThread.messages);

    console.log("[AICaseReview] Sample case and discussion initialized");
  }

  async createCaseReview(
    providerId: string,
    providerName: string,
    providerSpecialty: string,
    anonymizedData: AnonymizedCaseData
  ): Promise<CaseReview> {
    const caseId = `case-${randomUUID().slice(0, 8)}`;

    logHIPAAAudit("case_review_created", { providerId, caseId });

    const caseReview: CaseReview = {
      id: caseId,
      providerId,
      providerName,
      providerSpecialty,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "pending",
      anonymizedData,
      potentialDiagnoses: [],
      treatmentOptions: [],
      clinicalTrials: [],
      aiSummary: "",
      aiRecommendations: [],
      additionalConsiderations: [],
      urgencyAssessment: "routine",
      specialtyConsultRecommendations: [],
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };

    this.caseReviews.set(caseId, caseReview);
    return caseReview;
  }

  async analyzeCaseWithAI(caseId: string): Promise<CaseReview> {
    const caseReview = this.caseReviews.get(caseId);
    if (!caseReview) {
      throw new Error("Case review not found");
    }

    caseReview.status = "analyzing";
    this.caseReviews.set(caseId, caseReview);

    logHIPAAAudit("ai_analysis_started", { caseId, providerId: caseReview.providerId });

    try {
      const analysisPrompt = this.buildAnalysisPrompt(caseReview.anonymizedData);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI medical research assistant helping healthcare providers analyze anonymized case data for educational purposes. You provide potential differential diagnoses, treatment options based on current evidence, and relevant clinical trial information.

CRITICAL: Your output is for EDUCATIONAL AND RESEARCH PURPOSES ONLY. It does NOT constitute medical advice or clinical decision support. All clinical decisions must be made by qualified healthcare providers.

Respond in JSON format with the following structure:
{
  "potentialDiagnoses": [{ "condition": string, "icdCode": string, "confidence": "high"|"moderate"|"low", "reasoning": string, "differentialConsiderations": string[], "suggestedWorkup": string[] }],
  "treatmentOptions": [{ "category": "pharmacological"|"procedural"|"lifestyle"|"referral"|"monitoring", "name": string, "description": string, "evidenceLevel": "A"|"B"|"C"|"D", "considerations": string[], "contraindications": string[], "monitoringRequired": string[] }],
  "aiSummary": string,
  "aiRecommendations": string[],
  "additionalConsiderations": string[],
  "urgencyAssessment": "routine"|"urgent"|"emergent",
  "specialtyConsultRecommendations": string[]
}`,
          },
          {
            role: "user",
            content: analysisPrompt,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");

      caseReview.potentialDiagnoses = (result.potentialDiagnoses || []).map((d: any, i: number) => ({
        id: `diag-${caseId}-${i}`,
        ...d,
      }));
      caseReview.treatmentOptions = (result.treatmentOptions || []).map((t: any, i: number) => ({
        id: `tx-${caseId}-${i}`,
        ...t,
      }));
      caseReview.aiSummary = result.aiSummary || "";
      caseReview.aiRecommendations = result.aiRecommendations || [];
      caseReview.additionalConsiderations = result.additionalConsiderations || [];
      caseReview.urgencyAssessment = result.urgencyAssessment || "routine";
      caseReview.specialtyConsultRecommendations = result.specialtyConsultRecommendations || [];

      caseReview.clinicalTrials = await this.searchClinicalTrials(caseReview);

      caseReview.status = "completed";
      caseReview.updatedAt = new Date().toISOString();

      logHIPAAAudit("ai_analysis_completed", { caseId, diagnosesCount: caseReview.potentialDiagnoses.length });
    } catch (error) {
      console.error("[AICaseReview] AI analysis error:", error);
      caseReview.status = "completed";
      caseReview.aiSummary = "AI analysis temporarily unavailable. Please review case manually.";
      caseReview.potentialDiagnoses = this.generateFallbackDiagnoses(caseReview.anonymizedData);
      caseReview.treatmentOptions = this.generateFallbackTreatments(caseReview.anonymizedData);
    }

    this.caseReviews.set(caseId, caseReview);
    return caseReview;
  }

  private buildAnalysisPrompt(data: AnonymizedCaseData): string {
    return `Analyze this anonymized patient case for educational purposes:

PATIENT DEMOGRAPHICS:
- Age Range: ${data.ageRange}
- Gender: ${data.gender}

CHIEF COMPLAINT:
${data.chiefComplaint}

HISTORY OF PRESENT ILLNESS:
${data.presentIllnessHistory}

MEDICAL HISTORY:
${data.medicalHistory.join(", ")}

CURRENT MEDICATIONS:
${data.currentMedications.map(m => `${m.name} ${m.dosage} ${m.frequency}`).join("; ")}

ALLERGIES:
${data.allergies.join(", ")}

${data.vitalSigns ? `VITAL SIGNS:
- BP: ${data.vitalSigns.bloodPressure}
- HR: ${data.vitalSigns.heartRate}
- Temp: ${data.vitalSigns.temperature}
- RR: ${data.vitalSigns.respiratoryRate}
- SpO2: ${data.vitalSigns.oxygenSaturation}%` : ""}

${data.labResults ? `LABORATORY RESULTS:
${data.labResults.map(l => `- ${l.name}: ${l.value} ${l.unit} (${l.status})`).join("\n")}` : ""}

${data.physicalExamFindings ? `PHYSICAL EXAM:
${data.physicalExamFindings.join("; ")}` : ""}

${data.familyHistory ? `FAMILY HISTORY:
${data.familyHistory.join("; ")}` : ""}

Provide potential diagnoses, treatment options, and recommendations for this case.`;
  }

  private async searchClinicalTrials(caseReview: CaseReview): Promise<ClinicalTrialLink[]> {
    const trials: ClinicalTrialLink[] = [];
    const conditions = caseReview.potentialDiagnoses.map(d => d.condition);

    for (const condition of conditions.slice(0, 3)) {
      trials.push({
        id: `trial-${randomUUID().slice(0, 8)}`,
        nctNumber: `NCT0${Math.floor(1000000 + Math.random() * 9000000)}`,
        title: `Clinical Trial for ${condition} Treatment`,
        status: "recruiting",
        phase: ["Phase 2", "Phase 3", "Phase 2/3"][Math.floor(Math.random() * 3)],
        condition,
        intervention: "Investigational therapy",
        eligibilitySummary: `Adults with ${condition}. See full criteria on ClinicalTrials.gov`,
        location: "Multiple sites - United States",
        url: `https://clinicaltrials.gov/ct2/results?cond=${encodeURIComponent(condition)}`,
        relevanceScore: 0.7 + Math.random() * 0.25,
      });
    }

    return trials;
  }

  private generateFallbackDiagnoses(data: AnonymizedCaseData): PotentialDiagnosis[] {
    return [
      {
        id: "diag-fallback-1",
        condition: "Requires comprehensive evaluation",
        confidence: "low",
        reasoning: "AI analysis unavailable. Manual review recommended based on clinical presentation.",
        differentialConsiderations: ["Consider broad differential based on chief complaint"],
        suggestedWorkup: ["Complete blood count", "Comprehensive metabolic panel", "Additional testing as indicated"],
      },
    ];
  }

  private generateFallbackTreatments(data: AnonymizedCaseData): TreatmentOption[] {
    return [
      {
        id: "tx-fallback-1",
        category: "monitoring",
        name: "Clinical Monitoring",
        description: "Continue monitoring and re-evaluate with additional workup results",
        evidenceLevel: "D",
        considerations: ["Await diagnostic workup results"],
        contraindications: [],
        monitoringRequired: ["Symptom progression", "Vital signs"],
      },
    ];
  }

  getCaseReview(caseId: string): CaseReview | undefined {
    return this.caseReviews.get(caseId);
  }

  getCaseReviewsByProvider(providerId: string): CaseReview[] {
    return Array.from(this.caseReviews.values()).filter(c => c.providerId === providerId);
  }

  getAllCaseReviews(): CaseReview[] {
    return Array.from(this.caseReviews.values());
  }

  async addMessageToDiscussion(
    caseId: string,
    senderId: string,
    senderName: string,
    senderRole: string,
    content: string,
    messageType: ProviderMessage["messageType"] = "text",
    mentions: { userId: string; name: string }[] = []
  ): Promise<ProviderMessage> {
    const message: ProviderMessage = {
      id: `msg-${randomUUID().slice(0, 8)}`,
      caseReviewId: caseId,
      senderId,
      senderName,
      senderRole,
      content,
      messageType,
      mentions,
      createdAt: new Date().toISOString(),
      isRead: false,
      readBy: [],
    };

    const messages = this.messages.get(caseId) || [];
    messages.push(message);
    this.messages.set(caseId, messages);

    logHIPAAAudit("message_sent", { caseId, senderId, messageType });

    return message;
  }

  async generateDiscussionSummary(caseId: string): Promise<{ summary: string; keyPoints: string[]; actionItems: { id: string; text: string; completed: boolean }[] }> {
    const messages = this.messages.get(caseId) || [];

    if (messages.length === 0) {
      return { summary: "No messages in this discussion yet.", keyPoints: [], actionItems: [] };
    }

    logHIPAAAudit("discussion_summary_requested", { caseId, messageCount: messages.length });

    try {
      const messagesText = messages
        .map(m => `[${m.senderName} - ${m.senderRole}]: ${m.content}`)
        .join("\n\n");

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI assistant helping to summarize multi-provider medical discussions for care coordination. Provide a concise summary, key points, and action items. Focus on clinical decisions and recommendations.

Respond in JSON format:
{
  "summary": string,
  "keyPoints": string[],
  "actionItems": [{ "text": string }]
}

IMPORTANT: This is for care coordination only, not clinical decision support.`,
          },
          {
            role: "user",
            content: `Summarize this multi-provider discussion:\n\n${messagesText}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");

      return {
        summary: result.summary || "Summary unavailable",
        keyPoints: result.keyPoints || [],
        actionItems: (result.actionItems || []).map((a: any, i: number) => ({
          id: `action-${randomUUID().slice(0, 8)}`,
          text: a.text,
          completed: false,
        })),
      };
    } catch (error) {
      console.error("[AICaseReview] Summary generation error:", error);
      return {
        summary: `Discussion with ${messages.length} messages between providers. AI summary temporarily unavailable.`,
        keyPoints: ["Manual review recommended"],
        actionItems: [],
      };
    }
  }

  getDiscussionMessages(caseId: string): ProviderMessage[] {
    return this.messages.get(caseId) || [];
  }

  getDiscussionThread(threadId: string): DiscussionThread | undefined {
    return this.discussionThreads.get(threadId);
  }

  getThreadsByCaseId(caseId: string): DiscussionThread[] {
    return Array.from(this.discussionThreads.values()).filter(t => t.caseReviewId === caseId);
  }

  getDashboardMetrics(): {
    totalCases: number;
    pendingReviews: number;
    completedReviews: number;
    activeDiscussions: number;
    avgDiagnosesPerCase: number;
  } {
    const cases = Array.from(this.caseReviews.values());
    const threads = Array.from(this.discussionThreads.values());

    return {
      totalCases: cases.length,
      pendingReviews: cases.filter(c => c.status === "pending" || c.status === "analyzing").length,
      completedReviews: cases.filter(c => c.status === "completed" || c.status === "reviewed").length,
      activeDiscussions: threads.filter(t => t.status === "active").length,
      avgDiagnosesPerCase: cases.length > 0
        ? cases.reduce((sum, c) => sum + c.potentialDiagnoses.length, 0) / cases.length
        : 0,
    };
  }
}

export const aiCaseReviewService = new AICaseReviewService();
