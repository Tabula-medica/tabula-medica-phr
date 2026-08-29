import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface OnboardingQuestion {
  id: string;
  questionText: string;
  questionType: "yes_no" | "text" | "select" | "multi_select" | "location";
  options?: string[];
  helpText?: string;
  category: "hospitalization" | "primary_care" | "specialists" | "imaging" | "labs" | "pharmacy" | "insurance";
  required: boolean;
  followUpQuestions?: string[];
}

export interface PatientResponse {
  questionId: string;
  response: string | string[] | boolean;
  timestamp: string;
}

export interface RecommendedPortal {
  portalId: string;
  portalName: string;
  portalType: "hospital" | "clinic" | "lab" | "imaging" | "pharmacy" | "insurance";
  ehrSystem: string;
  matchConfidence: number;
  matchReason: string;
  connectionUrl: string;
  logoUrl?: string;
  estimatedRecords: string;
  supported: boolean;
}

export interface OnboardingSession {
  sessionId: string;
  patientId: string;
  status: "in_progress" | "completed" | "abandoned";
  currentStep: number;
  totalSteps: number;
  responses: PatientResponse[];
  recommendedPortals: RecommendedPortal[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface HealthProfile {
  hasBeenHospitalized: boolean;
  hospitals: string[];
  hasPrimaryDoctor: boolean;
  primaryDoctorName?: string;
  primaryClinic?: string;
  specialists: Array<{ type: string; name?: string; clinic?: string }>;
  hasImagingHistory: boolean;
  imagingCenters: string[];
  preferredLabs: string[];
  pharmacies: string[];
  insuranceProviders: string[];
  chronicConditions: string[];
  location: { city: string; state: string; zipCode: string };
}

const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: "hospitalization",
    questionText: "Have you ever been hospitalized or had surgery?",
    questionType: "yes_no",
    helpText: "This helps us find records from hospitals you've visited",
    category: "hospitalization",
    required: true,
    followUpQuestions: ["hospital_name"],
  },
  {
    id: "hospital_name",
    questionText: "Which hospital(s) have you visited? Select the ones you recognize.",
    questionType: "multi_select",
    options: [
      "Regional Medical Center",
      "University Hospital",
      "Community Health Center",
      "Children's Hospital",
      "Memorial Hospital",
      "Veterans Affairs (VA) Hospital",
      "Kaiser Permanente",
      "Cleveland Clinic",
      "Mayo Clinic",
      "Other hospital",
      "I don't remember",
    ],
    helpText: "Select all hospitals where you've received care",
    category: "hospitalization",
    required: false,
  },
  {
    id: "primary_doctor",
    questionText: "Do you have a primary care doctor?",
    questionType: "yes_no",
    helpText: "Your primary care provider often has the most complete picture of your health",
    category: "primary_care",
    required: true,
    followUpQuestions: ["primary_clinic"],
  },
  {
    id: "primary_clinic",
    questionText: "What clinic or health system does your primary doctor belong to?",
    questionType: "text",
    helpText: "For example: 'Kaiser Permanente', 'Cleveland Clinic', or the name of your doctor's practice",
    category: "primary_care",
    required: false,
  },
  {
    id: "specialists",
    questionText: "Do you see any specialists? (Select all that apply)",
    questionType: "multi_select",
    options: [
      "Cardiologist (Heart)",
      "Endocrinologist (Diabetes/Hormones)",
      "Dermatologist (Skin)",
      "Orthopedist (Bones/Joints)",
      "Neurologist (Brain/Nerves)",
      "Gastroenterologist (Digestive)",
      "Pulmonologist (Lungs)",
      "Oncologist (Cancer)",
      "Rheumatologist (Arthritis)",
      "Ophthalmologist (Eyes)",
      "Other specialist",
      "None",
    ],
    helpText: "Specialists often have important test results and treatment plans",
    category: "specialists",
    required: true,
  },
  {
    id: "imaging",
    questionText: "Have you had any imaging done (X-rays, CT scans, MRIs, ultrasounds)?",
    questionType: "yes_no",
    helpText: "Imaging records are important for tracking your health over time",
    category: "imaging",
    required: true,
    followUpQuestions: ["imaging_centers"],
  },
  {
    id: "imaging_centers",
    questionText: "Where have you had imaging done?",
    questionType: "multi_select",
    options: [
      "Hospital radiology department",
      "RadNet",
      "SimonMed",
      "Shields Health",
      "Independent imaging center",
      "Don't remember",
    ],
    helpText: "Select all imaging centers you've used",
    category: "imaging",
    required: false,
  },
  {
    id: "labs",
    questionText: "Which labs do you typically use for blood work?",
    questionType: "multi_select",
    options: [
      "Quest Diagnostics",
      "Labcorp",
      "Hospital lab",
      "Doctor's office lab",
      "CVS MinuteClinic",
      "Walgreens",
      "Other",
      "Not sure",
    ],
    helpText: "Lab results are often available through patient portals",
    category: "labs",
    required: true,
  },
  {
    id: "pharmacy",
    questionText: "Which pharmacy do you use most often?",
    questionType: "select",
    options: [
      "CVS Pharmacy",
      "Walgreens",
      "Rite Aid",
      "Walmart Pharmacy",
      "Costco Pharmacy",
      "Kroger Pharmacy",
      "Local independent pharmacy",
      "Mail-order pharmacy",
      "Other",
    ],
    helpText: "Pharmacy records help us track your medication history",
    category: "pharmacy",
    required: false,
  },
  {
    id: "insurance",
    questionText: "Who is your health insurance provider?",
    questionType: "select",
    options: [
      "UnitedHealthcare",
      "Anthem/Blue Cross Blue Shield",
      "Aetna",
      "Cigna",
      "Humana",
      "Kaiser Permanente",
      "Medicare",
      "Medicaid",
      "Military/Tricare",
      "Other",
      "Uninsured",
    ],
    helpText: "Insurance portals often have claims data and explanation of benefits",
    category: "insurance",
    required: false,
  },
  {
    id: "location",
    questionText: "What is your ZIP code? This helps us find nearby healthcare facilities.",
    questionType: "text",
    helpText: "We use this to recommend local hospitals and clinics",
    category: "hospitalization",
    required: true,
  },
];

const PORTAL_DATABASE: RecommendedPortal[] = [
  { portalId: "fastenhealth", portalName: "Fasten Health", portalType: "aggregator", ehrSystem: "Fasten Health", matchConfidence: 0, matchReason: "", connectionUrl: "https://api.connect.fastenhealth.com", estimatedRecords: "Comprehensive", supported: true },
  { portalId: "quest_myquest", portalName: "MyQuest (Quest Diagnostics)", portalType: "lab", ehrSystem: "Quest", matchConfidence: 0, matchReason: "", connectionUrl: "https://myquest.questdiagnostics.com", estimatedRecords: "Lab results", supported: true },
  { portalId: "labcorp_patient", portalName: "Labcorp Patient Portal", portalType: "lab", ehrSystem: "Labcorp", matchConfidence: 0, matchReason: "", connectionUrl: "https://patient.labcorp.com", estimatedRecords: "Lab results", supported: true },
  { portalId: "cvs_pharmacy", portalName: "CVS Pharmacy", portalType: "pharmacy", ehrSystem: "CVS", matchConfidence: 0, matchReason: "", connectionUrl: "https://www.cvs.com/account/", estimatedRecords: "Prescriptions", supported: true },
  { portalId: "walgreens", portalName: "Walgreens", portalType: "pharmacy", ehrSystem: "Walgreens", matchConfidence: 0, matchReason: "", connectionUrl: "https://www.walgreens.com/account", estimatedRecords: "Prescriptions", supported: true },
  { portalId: "medicare_blue_button", portalName: "Medicare Blue Button", portalType: "insurance", ehrSystem: "CMS", matchConfidence: 0, matchReason: "", connectionUrl: "https://www.medicare.gov/manage-your-health", estimatedRecords: "Claims data", supported: true },
];

class AIGuidedRecallService {
  private sessions: Map<string, OnboardingSession> = new Map();
  private auditLog: Array<{ timestamp: string; action: string; sessionId?: string; patientId?: string; details: any }> = [];

  getOnboardingQuestions(): OnboardingQuestion[] {
    return ONBOARDING_QUESTIONS;
  }

  async startOnboardingSession(patientId: string): Promise<OnboardingSession> {
    const sessionId = `onb_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = new Date().toISOString();

    const session: OnboardingSession = {
      sessionId,
      patientId,
      status: "in_progress",
      currentStep: 0,
      totalSteps: ONBOARDING_QUESTIONS.length,
      responses: [],
      recommendedPortals: [],
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(sessionId, session);
    this.logAudit("ONBOARDING_SESSION_STARTED", sessionId, patientId, { totalSteps: session.totalSteps });

    return session;
  }

  async submitResponse(sessionId: string, questionId: string, response: string | string[] | boolean): Promise<{ 
    success: boolean; 
    nextQuestion?: OnboardingQuestion; 
    isComplete: boolean;
    aiFollowUp?: string;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, isComplete: false };
    }

    const patientResponse: PatientResponse = {
      questionId,
      response,
      timestamp: new Date().toISOString(),
    };

    session.responses.push(patientResponse);
    session.currentStep++;
    session.updatedAt = new Date().toISOString();

    this.logAudit("RESPONSE_SUBMITTED", sessionId, session.patientId, { questionId, responseType: typeof response });

    const currentQuestion = ONBOARDING_QUESTIONS.find(q => q.id === questionId);
    let aiFollowUp: string | undefined;

    if (currentQuestion?.followUpQuestions && response === true) {
      aiFollowUp = await this.generateAIFollowUp(currentQuestion, response);
    }

    const isComplete = session.currentStep >= ONBOARDING_QUESTIONS.length;

    if (isComplete) {
      session.status = "completed";
      session.completedAt = new Date().toISOString();
      session.recommendedPortals = await this.generatePortalRecommendations(session);
      this.logAudit("ONBOARDING_COMPLETED", sessionId, session.patientId, { 
        recommendedPortals: session.recommendedPortals.length 
      });
    }

    this.sessions.set(sessionId, session);

    const nextQuestion = isComplete ? undefined : ONBOARDING_QUESTIONS[session.currentStep];

    return {
      success: true,
      nextQuestion,
      isComplete,
      aiFollowUp,
    };
  }

  async generateAIFollowUp(question: OnboardingQuestion, response: any): Promise<string> {
    try {
      const prompt = `The patient answered "${response}" to the question: "${question.questionText}"
      
Based on this response, generate a brief, helpful follow-up message (1-2 sentences) that:
1. Acknowledges their response positively
2. Explains why this information is helpful for finding their health records
3. Transitions naturally to the next question

Keep the tone warm and supportive. Do not ask any new questions - just provide a brief acknowledgment.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: "You are a friendly health record onboarding assistant. Keep responses brief and supportive." },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 100,
      });

      return completion.choices[0]?.message?.content || "";
    } catch (error) {
      console.error("AI follow-up generation error:", error);
      return "";
    }
  }

  async generatePortalRecommendations(session: OnboardingSession): Promise<RecommendedPortal[]> {
    const recommendations: RecommendedPortal[] = [];
    const responses = session.responses;

    const getResponse = (questionId: string) => responses.find(r => r.questionId === questionId)?.response;

    const hospitalized = getResponse("hospitalization");
    if (hospitalized === true) {
      const fastenPortal = { ...PORTAL_DATABASE.find(p => p.portalId === "fastenhealth")! };
      fastenPortal.matchConfidence = 0.95;
      fastenPortal.matchReason = "Fasten Health connects to 25,000+ US healthcare providers including major hospital systems";
      recommendations.push(fastenPortal);
    }

    const hasPrimaryDoctor = getResponse("primary_doctor");
    if (hasPrimaryDoctor === true && !recommendations.find(r => r.portalId === "fastenhealth")) {
      const fastenPortal = { ...PORTAL_DATABASE.find(p => p.portalId === "fastenhealth")! };
      fastenPortal.matchConfidence = 0.9;
      fastenPortal.matchReason = "Fasten Health connects to most primary care practice EHR systems";
      recommendations.push(fastenPortal);
    }

    const labs = getResponse("labs") as string[] | undefined;
    if (labs?.includes("Quest Diagnostics")) {
      const questPortal = { ...PORTAL_DATABASE.find(p => p.portalId === "quest_myquest")! };
      questPortal.matchConfidence = 0.95;
      questPortal.matchReason = "You indicated you use Quest Diagnostics for lab work";
      recommendations.push(questPortal);
    }
    if (labs?.includes("Labcorp")) {
      const labcorpPortal = { ...PORTAL_DATABASE.find(p => p.portalId === "labcorp_patient")! };
      labcorpPortal.matchConfidence = 0.95;
      labcorpPortal.matchReason = "You indicated you use Labcorp for lab work";
      recommendations.push(labcorpPortal);
    }

    const pharmacy = getResponse("pharmacy") as string | undefined;
    if (pharmacy === "CVS Pharmacy") {
      const cvsPortal = { ...PORTAL_DATABASE.find(p => p.portalId === "cvs_pharmacy")! };
      cvsPortal.matchConfidence = 0.95;
      cvsPortal.matchReason = "You indicated CVS is your pharmacy";
      recommendations.push(cvsPortal);
    }
    if (pharmacy === "Walgreens") {
      const walgreensPortal = { ...PORTAL_DATABASE.find(p => p.portalId === "walgreens")! };
      walgreensPortal.matchConfidence = 0.95;
      walgreensPortal.matchReason = "You indicated Walgreens is your pharmacy";
      recommendations.push(walgreensPortal);
    }

    const insurance = getResponse("insurance") as string | undefined;
    if (insurance === "Medicare") {
      const medicarePortal = { ...PORTAL_DATABASE.find(p => p.portalId === "medicare_blue_button")! };
      medicarePortal.matchConfidence = 0.95;
      medicarePortal.matchReason = "Medicare Blue Button provides access to your claims history";
      recommendations.push(medicarePortal);
    }
    if (insurance === "UnitedHealthcare") {
      const uhcPortal = { ...PORTAL_DATABASE.find(p => p.portalId === "uhc_myuhc")! };
      uhcPortal.matchConfidence = 0.95;
      uhcPortal.matchReason = "You indicated UnitedHealthcare is your insurance provider";
      recommendations.push(uhcPortal);
    }
    if (insurance?.includes("Anthem") || insurance?.includes("Blue Cross")) {
      const anthemPortal = { ...PORTAL_DATABASE.find(p => p.portalId === "anthem_sydney")! };
      anthemPortal.matchConfidence = 0.95;
      anthemPortal.matchReason = "You indicated Anthem/BCBS is your insurance provider";
      recommendations.push(anthemPortal);
    }

    return recommendations.sort((a, b) => b.matchConfidence - a.matchConfidence);
  }

  async getAIRecommendationSummary(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "completed") {
      return "Please complete the onboarding questions first.";
    }

    try {
      const prompt = `Based on the patient's onboarding responses, we recommend connecting to ${session.recommendedPortals.length} patient portals.

Portals recommended:
${session.recommendedPortals.map(p => `- ${p.portalName}: ${p.matchReason}`).join("\n")}

Generate a brief, encouraging summary (2-3 sentences) that:
1. Celebrates their completion of onboarding
2. Highlights how many potential records sources we found
3. Encourages them to connect their portals

Keep the tone warm and supportive. This is for patient education only, not medical advice.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [
          { role: "system", content: "You are a friendly health record onboarding assistant. Keep responses brief, encouraging, and supportive." },
          { role: "user", content: prompt },
        ],
        max_completion_tokens: 150,
      });

      return completion.choices[0]?.message?.content || "Great job completing your health profile! We've identified several portals that may have your health records.";
    } catch (error) {
      console.error("AI summary generation error:", error);
      return "Great job completing your health profile! We've identified several portals that may have your health records.";
    }
  }

  async findNearbyHospitals(zipCode: string): Promise<Array<{ name: string; distance: string; hasEpic: boolean; hasCerner: boolean }>> {
    this.logAudit("NEARBY_HOSPITALS_SEARCH", undefined, undefined, { zipCode });

    return [
      { name: "Regional Medical Center", distance: "2.3 miles", hasEpic: true, hasCerner: false },
      { name: "University Hospital", distance: "4.1 miles", hasEpic: true, hasCerner: false },
      { name: "Community Health Center", distance: "5.8 miles", hasEpic: false, hasCerner: true },
      { name: "Children's Hospital", distance: "6.2 miles", hasEpic: true, hasCerner: false },
      { name: "Memorial Hospital", distance: "8.5 miles", hasEpic: false, hasCerner: true },
    ];
  }

  getSession(sessionId: string): OnboardingSession | null {
    return this.sessions.get(sessionId) || null;
  }

  private logAudit(action: string, sessionId?: string, patientId?: string, details?: any): void {
    const entry = { timestamp: new Date().toISOString(), action, sessionId, patientId, details };
    this.auditLog.push(entry);
    console.log(`[HIPAA-AUDIT][AIGuidedRecall] ${action}`, JSON.stringify(entry));
  }

  getAuditLog(): typeof this.auditLog {
    return [...this.auditLog];
  }
}

export const aiGuidedRecallService = new AIGuidedRecallService();
