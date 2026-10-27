import { chatComplete } from "./ai-client";

export interface ProviderDiscoveryQuestion {
  id: string;
  question: string;
  type: "boolean" | "text" | "select" | "multiselect";
  options?: string[];
  followUp?: {
    condition: string | boolean;
    questionId: string;
  };
  required: boolean;
  category: "hospitalization" | "hospitals" | "primary_care" | "specialists" | "imaging" | "labs" | "pharmacy" | "insurance";
}

export interface ProviderDiscoveryAnswer {
  questionId: string;
  answer: string | boolean | string[];
}

export interface HealthcareProvider {
  id: string;
  name: string;
  type: "hospital" | "clinic" | "primary_care" | "specialist" | "imaging_center" | "lab" | "pharmacy" | "urgent_care";
  specialty?: string;
  ehrSystem?: string;
  patientPortalUrl?: string;
  patientPortalName?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  phone?: string;
  confidence: number;
  connectionMethod: "particle_health" | "direct_fhir" | "patient_portal" | "manual";
  dataAvailable: string[];
}

export interface PortalRecommendation {
  id: string;
  portalName: string;
  portalUrl: string;
  ehrSystem: string;
  providers: HealthcareProvider[];
  confidence: number;
  priority: number;
  reason: string;
  setupInstructions: string[];
  estimatedRecords: {
    type: string;
    count: string;
  }[];
}

export interface DiscoverySession {
  id: string;
  userId: string;
  startedAt: Date;
  completedAt?: Date;
  answers: ProviderDiscoveryAnswer[];
  recommendations: PortalRecommendation[];
  status: "in_progress" | "completed" | "abandoned";
}

const DISCOVERY_QUESTIONS: ProviderDiscoveryQuestion[] = [
  {
    id: "hospitalized",
    question: "Have you ever been hospitalized or had an overnight stay at a hospital?",
    type: "boolean",
    required: true,
    category: "hospitalization"
  },
  {
    id: "hospital_names",
    question: "Which hospitals have you stayed at? (List as many as you remember)",
    type: "text",
    required: false,
    category: "hospitals",
    followUp: {
      condition: true,
      questionId: "hospitalized"
    }
  },
  {
    id: "largest_hospital_nearby",
    question: "What is the largest hospital or health system near you?",
    type: "text",
    required: true,
    category: "hospitals"
  },
  {
    id: "has_primary_doctor",
    question: "Do you have a primary care doctor or family physician?",
    type: "boolean",
    required: true,
    category: "primary_care"
  },
  {
    id: "primary_doctor_practice",
    question: "What clinic or health system is your primary doctor part of?",
    type: "text",
    required: false,
    category: "primary_care",
    followUp: {
      condition: true,
      questionId: "has_primary_doctor"
    }
  },
  {
    id: "has_specialists",
    question: "Do you see any specialists regularly? (e.g., cardiologist, endocrinologist, dermatologist)",
    type: "boolean",
    required: true,
    category: "specialists"
  },
  {
    id: "specialist_types",
    question: "What types of specialists do you see?",
    type: "multiselect",
    options: [
      "Cardiologist (Heart)",
      "Endocrinologist (Diabetes/Hormones)",
      "Dermatologist (Skin)",
      "Neurologist (Brain/Nerves)",
      "Orthopedist (Bones/Joints)",
      "Gastroenterologist (Digestive)",
      "Pulmonologist (Lungs)",
      "Rheumatologist (Arthritis/Autoimmune)",
      "Oncologist (Cancer)",
      "Psychiatrist (Mental Health)",
      "OB-GYN (Women's Health)",
      "Urologist",
      "Ophthalmologist (Eyes)",
      "ENT (Ear/Nose/Throat)",
      "Other"
    ],
    required: false,
    category: "specialists",
    followUp: {
      condition: true,
      questionId: "has_specialists"
    }
  },
  {
    id: "has_imaging",
    question: "Have you had any imaging done? (X-rays, MRI, CT scans, ultrasounds)",
    type: "boolean",
    required: true,
    category: "imaging"
  },
  {
    id: "imaging_locations",
    question: "Where did you have your imaging done?",
    type: "multiselect",
    options: [
      "At the hospital",
      "RadNet",
      "SimonMed Imaging",
      "Shields Health Care",
      "Akumin",
      "American Health Imaging",
      "Independent imaging center",
      "At my doctor's office",
      "Other"
    ],
    required: false,
    category: "imaging",
    followUp: {
      condition: true,
      questionId: "has_imaging"
    }
  },
  {
    id: "lab_providers",
    question: "Where do you typically get blood work or lab tests done?",
    type: "multiselect",
    options: [
      "Quest Diagnostics",
      "LabCorp",
      "At the hospital",
      "At my doctor's office",
      "Sonora Quest",
      "BioReference",
      "Other local lab"
    ],
    required: true,
    category: "labs"
  },
  {
    id: "pharmacy",
    question: "Which pharmacy do you use most often?",
    type: "select",
    options: [
      "CVS Pharmacy",
      "Walgreens",
      "Walmart Pharmacy",
      "Rite Aid",
      "Kroger Pharmacy",
      "Publix Pharmacy",
      "Costco Pharmacy",
      "Amazon Pharmacy",
      "Express Scripts",
      "OptumRx",
      "Other"
    ],
    required: false,
    category: "pharmacy"
  },
  {
    id: "insurance_provider",
    question: "Who is your health insurance provider?",
    type: "select",
    options: [
      "Blue Cross Blue Shield",
      "UnitedHealthcare",
      "Aetna",
      "Cigna",
      "Humana",
      "Kaiser Permanente",
      "Anthem",
      "Medicare",
      "Medicaid",
      "TRICARE",
      "Other",
      "I don't have insurance"
    ],
    required: true,
    category: "insurance"
  }
];

const EHR_SYSTEM_MAPPING: Record<string, { name: string; portalUrl: string; portalName: string }> = {
  epic: {
    name: "Epic",
    portalUrl: "https://www.mychart.com",
    portalName: "MyChart"
  },
  cerner: {
    name: "Oracle Health (Cerner)",
    portalUrl: "https://www.cerner.com/patient-portal",
    portalName: "Cerner Patient Portal"
  },
  athena: {
    name: "athenahealth",
    portalUrl: "https://www.athenahealth.com/patient-portal",
    portalName: "athenahealth Patient Portal"
  },
  eclinicalworks: {
    name: "eClinicalWorks",
    portalUrl: "https://my.healow.com",
    portalName: "healow"
  },
  allscripts: {
    name: "Allscripts",
    portalUrl: "https://www.followmyhealth.com",
    portalName: "FollowMyHealth"
  },
  meditech: {
    name: "MEDITECH",
    portalUrl: "",
    portalName: "MEDITECH Patient Portal"
  },
  nextgen: {
    name: "NextGen Healthcare",
    portalUrl: "",
    portalName: "NextGen Patient Portal"
  }
};

const MAJOR_HEALTH_SYSTEMS: Record<string, { ehrSystem: string; states: string[]; portalUrl: string }> = {
  "Kaiser Permanente": { ehrSystem: "epic", states: ["CA", "CO", "GA", "HI", "MD", "OR", "VA", "WA", "DC"], portalUrl: "https://healthy.kaiserpermanente.org" },
  "Cleveland Clinic": { ehrSystem: "epic", states: ["OH", "FL", "NV"], portalUrl: "https://my.clevelandclinic.org" },
  "Mayo Clinic": { ehrSystem: "epic", states: ["MN", "AZ", "FL"], portalUrl: "https://patientportal.mayoclinic.org" },
  "Johns Hopkins": { ehrSystem: "epic", states: ["MD", "DC", "FL"], portalUrl: "https://www.hopkinsmedicine.org/patient_care/patient-resources/mychart" },
  "Mass General Brigham": { ehrSystem: "epic", states: ["MA"], portalUrl: "https://www.massgeneral.org/patient-gateway" },
  "NYU Langone": { ehrSystem: "epic", states: ["NY"], portalUrl: "https://mychart.nyulangone.org" },
  "UCLA Health": { ehrSystem: "epic", states: ["CA"], portalUrl: "https://www.uclahealth.org/mychart" },
  "Stanford Health Care": { ehrSystem: "epic", states: ["CA"], portalUrl: "https://mystanfordchart.stanfordhealthcare.org" },
  "Duke Health": { ehrSystem: "epic", states: ["NC"], portalUrl: "https://www.dukehealth.org/mychart" },
  "Mount Sinai": { ehrSystem: "epic", states: ["NY"], portalUrl: "https://mychart.mountsinai.org" },
  "Cedars-Sinai": { ehrSystem: "epic", states: ["CA"], portalUrl: "https://www.cedars-sinai.org/patients-visitors/mychart.html" },
  "Northwestern Medicine": { ehrSystem: "epic", states: ["IL"], portalUrl: "https://www.nm.org/patients-and-visitors/mychart" },
  "Penn Medicine": { ehrSystem: "epic", states: ["PA", "NJ"], portalUrl: "https://www.pennmedicine.org/for-patients-and-visitors/penn-medicine-mypennchart" },
  "UCSF Health": { ehrSystem: "epic", states: ["CA"], portalUrl: "https://www.ucsfhealth.org/mychart" },
  "Intermountain Healthcare": { ehrSystem: "cerner", states: ["UT", "ID", "NV"], portalUrl: "https://intermountainhealthcare.org/patient-tools/my-health" },
  "Ascension": { ehrSystem: "epic", states: ["Multiple"], portalUrl: "https://www.ascension.org/patient-portals" },
  "CommonSpirit Health": { ehrSystem: "cerner", states: ["Multiple"], portalUrl: "https://www.commonspirit.org/patient-portal" },
  "HCA Healthcare": { ehrSystem: "meditech", states: ["Multiple"], portalUrl: "" },
  "Tenet Healthcare": { ehrSystem: "cerner", states: ["Multiple"], portalUrl: "" },
  "Community Health Systems": { ehrSystem: "cerner", states: ["Multiple"], portalUrl: "" }
};

class AIProviderDiscoveryService {
  private sessions: Map<string, DiscoverySession> = new Map();

  getDiscoveryQuestions(): ProviderDiscoveryQuestion[] {
    return DISCOVERY_QUESTIONS;
  }

  startDiscoverySession(userId: string): DiscoverySession {
    const session: DiscoverySession = {
      id: crypto.randomUUID(),
      userId,
      startedAt: new Date(),
      answers: [],
      recommendations: [],
      status: "in_progress"
    };

    this.sessions.set(session.id, session);
    return session;
  }

  getSession(sessionId: string): DiscoverySession | null {
    return this.sessions.get(sessionId) || null;
  }

  addAnswer(sessionId: string, answer: ProviderDiscoveryAnswer): ProviderDiscoveryQuestion | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const existingIndex = session.answers.findIndex(a => a.questionId === answer.questionId);
    if (existingIndex >= 0) {
      session.answers[existingIndex] = answer;
    } else {
      session.answers.push(answer);
    }

    const currentQuestion = DISCOVERY_QUESTIONS.find(q => q.id === answer.questionId);
    if (!currentQuestion) return null;

    const currentIndex = DISCOVERY_QUESTIONS.indexOf(currentQuestion);
    
    for (let i = currentIndex + 1; i < DISCOVERY_QUESTIONS.length; i++) {
      const nextQuestion = DISCOVERY_QUESTIONS[i];
      
      if (nextQuestion.followUp) {
        const prerequisiteAnswer = session.answers.find(a => a.questionId === nextQuestion.followUp!.questionId);
        if (prerequisiteAnswer && prerequisiteAnswer.answer === nextQuestion.followUp.condition) {
          return nextQuestion;
        }
      } else {
        return nextQuestion;
      }
    }

    return null;
  }

  async generateRecommendations(sessionId: string): Promise<PortalRecommendation[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const recommendations: PortalRecommendation[] = [];

    const hospitalNames = session.answers.find(a => a.questionId === "hospital_names")?.answer as string || "";
    const largestHospital = session.answers.find(a => a.questionId === "largest_hospital_nearby")?.answer as string || "";
    const primaryPractice = session.answers.find(a => a.questionId === "primary_doctor_practice")?.answer as string || "";
    const labProviders = session.answers.find(a => a.questionId === "lab_providers")?.answer as string[] || [];
    const imagingLocations = session.answers.find(a => a.questionId === "imaging_locations")?.answer as string[] || [];
    const insuranceProvider = session.answers.find(a => a.questionId === "insurance_provider")?.answer as string || "";

    const hospitalList = [largestHospital, ...hospitalNames.split(",").map(h => h.trim())].filter(Boolean);
    
    for (const hospital of hospitalList) {
      const matchedSystem = Object.entries(MAJOR_HEALTH_SYSTEMS).find(([name]) => 
        hospital.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(hospital.toLowerCase())
      );

      if (matchedSystem) {
        const [name, info] = matchedSystem;
        const ehrInfo = EHR_SYSTEM_MAPPING[info.ehrSystem];

        recommendations.push({
          id: crypto.randomUUID(),
          portalName: ehrInfo?.portalName || `${name} Patient Portal`,
          portalUrl: info.portalUrl || ehrInfo?.portalUrl || "",
          ehrSystem: info.ehrSystem,
          providers: [{
            id: crypto.randomUUID(),
            name,
            type: "hospital",
            ehrSystem: info.ehrSystem,
            patientPortalUrl: info.portalUrl,
            patientPortalName: ehrInfo?.portalName,
            confidence: 90,
            connectionMethod: "particle_health",
            dataAvailable: ["clinical_notes", "lab_results", "medications", "immunizations", "procedures", "encounters"]
          }],
          confidence: 90,
          priority: 1,
          reason: "Major health system with comprehensive records",
          setupInstructions: [
            `Visit ${info.portalUrl || "the hospital website"}`,
            "Click 'Sign Up' or 'Create Account'",
            "Enter your date of birth and other verification info",
            "Create a username and password",
            "Once registered, connect it to Tabula Medica"
          ],
          estimatedRecords: [
            { type: "Hospital visits", count: "All visits" },
            { type: "Lab results", count: "Complete history" },
            { type: "Medications", count: "All prescriptions" },
            { type: "Procedures", count: "All procedures" }
          ]
        });
      } else {
        recommendations.push({
          id: crypto.randomUUID(),
          portalName: `${hospital} Patient Portal`,
          portalUrl: "",
          ehrSystem: "unknown",
          providers: [{
            id: crypto.randomUUID(),
            name: hospital,
            type: "hospital",
            confidence: 60,
            connectionMethod: "patient_portal",
            dataAvailable: ["clinical_notes", "lab_results", "medications"]
          }],
          confidence: 60,
          priority: 2,
          reason: "Hospital mentioned in your history",
          setupInstructions: [
            `Search for "${hospital} patient portal" online`,
            "Contact the hospital's medical records department for portal access",
            "Complete their registration process"
          ],
          estimatedRecords: [
            { type: "Hospital records", count: "Varies" }
          ]
        });
      }
    }

    for (const labProvider of labProviders) {
      if (labProvider.includes("Quest")) {
        recommendations.push({
          id: crypto.randomUUID(),
          portalName: "MyQuest",
          portalUrl: "https://myquest.questdiagnostics.com",
          ehrSystem: "quest",
          providers: [{
            id: crypto.randomUUID(),
            name: "Quest Diagnostics",
            type: "lab",
            patientPortalUrl: "https://myquest.questdiagnostics.com",
            patientPortalName: "MyQuest",
            confidence: 95,
            connectionMethod: "direct_fhir",
            dataAvailable: ["lab_results"]
          }],
          confidence: 95,
          priority: 1,
          reason: "Direct lab results access",
          setupInstructions: [
            "Visit myquest.questdiagnostics.com",
            "Click 'Create Account'",
            "Verify your identity with date of birth and zip code",
            "Access your complete lab history"
          ],
          estimatedRecords: [
            { type: "Lab results", count: "All results from Quest locations" }
          ]
        });
      }

      if (labProvider.includes("LabCorp")) {
        recommendations.push({
          id: crypto.randomUUID(),
          portalName: "LabCorp Patient Portal",
          portalUrl: "https://patient.labcorp.com",
          ehrSystem: "labcorp",
          providers: [{
            id: crypto.randomUUID(),
            name: "LabCorp",
            type: "lab",
            patientPortalUrl: "https://patient.labcorp.com",
            patientPortalName: "LabCorp Patient Portal",
            confidence: 95,
            connectionMethod: "direct_fhir",
            dataAvailable: ["lab_results"]
          }],
          confidence: 95,
          priority: 1,
          reason: "Direct lab results access",
          setupInstructions: [
            "Visit patient.labcorp.com",
            "Click 'Create Account'",
            "Verify your identity",
            "Access your complete lab history"
          ],
          estimatedRecords: [
            { type: "Lab results", count: "All results from LabCorp locations" }
          ]
        });
      }
    }

    if (insuranceProvider && insuranceProvider !== "I don't have insurance") {
      recommendations.push({
        id: crypto.randomUUID(),
        portalName: `${insuranceProvider} Member Portal`,
        portalUrl: "",
        ehrSystem: "insurance",
        providers: [{
          id: crypto.randomUUID(),
          name: insuranceProvider,
          type: "clinic",
          confidence: 80,
          connectionMethod: "patient_portal",
          dataAvailable: ["claims", "medications", "providers"]
        }],
        confidence: 80,
        priority: 2,
        reason: "Claims data shows your complete care history",
        setupInstructions: [
          `Log into your ${insuranceProvider} member portal`,
          "Navigate to Claims or Health Records section",
          "Connect via Flexpa or download your data"
        ],
        estimatedRecords: [
          { type: "Claims", count: "All submitted claims" },
          { type: "Prescriptions", count: "Filled prescriptions" }
        ]
      });
    }

    recommendations.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.confidence - a.confidence;
    });

    session.recommendations = recommendations;
    session.completedAt = new Date();
    session.status = "completed";

    return recommendations;
  }

  async getAIGuidedRecommendations(sessionId: string): Promise<{
    summary: string;
    recommendations: PortalRecommendation[];
    additionalQuestions?: string[];
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Session not found");
    }

    const recommendations = await this.generateRecommendations(sessionId);

    const answersText = session.answers.map(a => {
      const question = DISCOVERY_QUESTIONS.find(q => q.id === a.questionId);
      return `${question?.question}: ${Array.isArray(a.answer) ? a.answer.join(", ") : a.answer}`;
    }).join("\n");

    try {
      const completion = await chatComplete({
        model: "fast",
        messages: [
          {
            role: "system",
            content: `You are a healthcare data assistant helping patients connect their medical records from various sources. Based on their answers about their healthcare history, provide a friendly summary of what records they likely have available and prioritize which portals to connect first.

Be conversational and helpful. Focus on the practical value of connecting each source. If there are gaps in their information, suggest additional questions that might help identify more record sources.`
          },
          {
            role: "user",
            content: `Patient's healthcare history answers:
${answersText}

Based on this, I've identified ${recommendations.length} potential record sources. Please provide:
1. A friendly summary (2-3 sentences) of what records they likely have available
2. Any additional questions that might help identify more sources
3. Which portals they should prioritize connecting first and why`
          }
        ],
        maxOutputTokens: 500,
        dataCategories: ["conditions"],
        purpose: "care_coordination",
        callerService: "ai-provider-discovery-service",
        callerMethod: "generateAIRecommendations",
      });

      const aiResponse = completion.content || "";

      return {
        summary: aiResponse,
        recommendations,
        additionalQuestions: this.extractAdditionalQuestions(aiResponse)
      };
    } catch (error) {
      console.error("AI recommendations failed:", error);
      
      return {
        summary: `Based on your healthcare history, we've identified ${recommendations.length} potential sources for your medical records. ${recommendations.length > 0 ? `Start by connecting to ${recommendations[0].portalName} for the most comprehensive records.` : ""}`,
        recommendations
      };
    }
  }

  private extractAdditionalQuestions(aiResponse: string): string[] {
    const questions: string[] = [];
    const lines = aiResponse.split("\n");
    
    for (const line of lines) {
      if (line.includes("?") && (line.includes("Have you") || line.includes("Did you") || line.includes("Do you"))) {
        questions.push(line.trim().replace(/^[-•*]\s*/, ""));
      }
    }

    return questions.slice(0, 3);
  }

  getEHRSystemInfo(ehrSystem: string): { name: string; portalUrl: string; portalName: string } | null {
    return EHR_SYSTEM_MAPPING[ehrSystem] || null;
  }

  getMajorHealthSystems(): Record<string, { ehrSystem: string; states: string[]; portalUrl: string }> {
    return MAJOR_HEALTH_SYSTEMS;
  }
}

export const aiProviderDiscoveryService = new AIProviderDiscoveryService();
