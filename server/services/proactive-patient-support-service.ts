// CDS-GATED — this service performs Clinical Decision Support (AI patient risk
// assessment and recommended clinical actions for support/care-gap identification).
// DISABLED by default via the ENABLE_CDS kill-switch pending FDA Non-Device CDS
// determination + counsel review. NOT a NO-CDS claim.
// See _cds-gate.ts, NO-CDS-TRIAGE.md, ventures/tabula-medica/PHR-CDS-COUNSEL-BRIEF.md.
import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";
import { assertCdsEnabled } from "./_cds-gate";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

export interface PatientSupportProfile {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  conditions: string[];
  riskLevel: "low" | "moderate" | "high" | "critical";
  supportScore: number;
  lastVisit?: string;
  nextAppointment?: string;
  communicationHistory: {
    lastContact: string;
    responseRate: number;
    preferredChannel: "email" | "sms" | "phone" | "portal";
  };
  feedbackTrend: "positive" | "neutral" | "declining" | "concerning";
  supportNeeds: SupportNeed[];
  eligiblePrograms: WellnessProgram[];
  outreachHistory: OutreachRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface SupportNeed {
  id: string;
  type: "preventive_care" | "chronic_management" | "mental_health" | "medication_adherence" | "social_support" | "care_gap" | "follow_up" | "wellness";
  priority: "urgent" | "high" | "medium" | "low";
  description: string;
  identifiedDate: string;
  dueDate?: string;
  status: "identified" | "outreach_sent" | "in_progress" | "resolved" | "declined";
  aiReasoning: string;
}

export interface WellnessProgram {
  id: string;
  name: string;
  category: "preventive" | "chronic" | "mental_health" | "nutrition" | "fitness" | "smoking_cessation" | "diabetes_management" | "heart_health" | "weight_management";
  description: string;
  eligibilityCriteria: string[];
  duration: string;
  enrollmentStatus?: "eligible" | "enrolled" | "completed" | "declined";
  matchScore: number;
}

export interface OutreachRecord {
  id: string;
  type: "initial" | "follow_up" | "reminder" | "wellness" | "care_gap" | "adverse_event";
  channel: "email" | "sms" | "phone" | "portal";
  subject: string;
  message: string;
  sentAt: string;
  status: "pending" | "sent" | "delivered" | "opened" | "responded" | "failed";
  responseReceived?: boolean;
  responseDate?: string;
  scheduledFollowUp?: string;
}

export interface OutreachCampaign {
  id: string;
  name: string;
  type: "preventive_care" | "wellness" | "follow_up" | "care_gap" | "seasonal" | "condition_specific";
  targetCriteria: {
    conditions?: string[];
    ageRange?: { min: number; max: number };
    riskLevels?: string[];
    lastVisitDaysAgo?: number;
    supportNeedTypes?: string[];
  };
  messageTemplate: string;
  channel: "email" | "sms" | "portal" | "multi_channel";
  status: "draft" | "scheduled" | "active" | "paused" | "completed";
  scheduledDate?: string;
  targetedPatients: number;
  sentCount: number;
  responseCount: number;
  createdAt: string;
}

export interface ProactiveSupportStats {
  totalPatientsMonitored: number;
  highRiskPatients: number;
  pendingOutreach: number;
  activeFollowUps: number;
  programEnrollments: number;
  responseRate: number;
  careGapsIdentified: number;
  careGapsResolved: number;
  recentAdverseEvents: number;
  outreachSentToday: number;
}

const patientProfileStore = new Map<string, PatientSupportProfile>();
const campaignStore = new Map<string, OutreachCampaign>();
const wellnessProgramStore = new Map<string, WellnessProgram>();

function initializeSampleData() {
  const wellnessPrograms: WellnessProgram[] = [
    {
      id: "prog-1",
      name: "Diabetes Prevention Program",
      category: "diabetes_management",
      description: "12-week lifestyle intervention program to prevent or delay Type 2 diabetes",
      eligibilityCriteria: ["Pre-diabetic", "A1C 5.7-6.4%", "BMI > 25"],
      duration: "12 weeks",
      matchScore: 0.95
    },
    {
      id: "prog-2",
      name: "Heart Healthy Living",
      category: "heart_health",
      description: "Cardiovascular health program with diet, exercise, and stress management",
      eligibilityCriteria: ["Hypertension", "High cholesterol", "Heart disease history"],
      duration: "8 weeks",
      matchScore: 0.88
    },
    {
      id: "prog-3",
      name: "Mindful Wellness",
      category: "mental_health",
      description: "Mental health support program with counseling and mindfulness techniques",
      eligibilityCriteria: ["Anxiety", "Depression", "Stress-related conditions"],
      duration: "Ongoing",
      matchScore: 0.82
    },
    {
      id: "prog-4",
      name: "Smoking Cessation Support",
      category: "smoking_cessation",
      description: "Comprehensive smoking cessation program with counseling and medication support",
      eligibilityCriteria: ["Current smoker", "Tobacco use disorder"],
      duration: "6 months",
      matchScore: 0.90
    },
    {
      id: "prog-5",
      name: "Weight Management Coaching",
      category: "weight_management",
      description: "Personalized weight management with nutrition counseling and fitness planning",
      eligibilityCriteria: ["BMI > 30", "Obesity-related conditions"],
      duration: "16 weeks",
      matchScore: 0.85
    }
  ];

  wellnessPrograms.forEach(prog => wellnessProgramStore.set(prog.id, prog));

  const samplePatients: PatientSupportProfile[] = [
    {
      id: "psp-1",
      patientId: "patient-001",
      patientName: "John Smith",
      age: 58,
      conditions: ["Type 2 Diabetes", "Hypertension", "Obesity"],
      riskLevel: "high",
      supportScore: 0.78,
      lastVisit: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      nextAppointment: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      communicationHistory: {
        lastContact: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        responseRate: 0.65,
        preferredChannel: "email"
      },
      feedbackTrend: "neutral",
      supportNeeds: [
        {
          id: "need-1",
          type: "chronic_management",
          priority: "high",
          description: "Blood glucose levels trending upward, A1C increased from 7.2 to 7.8",
          identifiedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          status: "identified",
          aiReasoning: "Recent lab results show deteriorating glycemic control. Patient may benefit from medication adjustment review and diabetes education reinforcement."
        },
        {
          id: "need-2",
          type: "preventive_care",
          priority: "medium",
          description: "Annual diabetic eye exam overdue by 3 months",
          identifiedDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          dueDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          status: "outreach_sent",
          aiReasoning: "Preventive screening gap identified. Eye exam is critical for diabetes complication prevention."
        }
      ],
      eligiblePrograms: [wellnessPrograms[0], wellnessPrograms[4]],
      outreachHistory: [
        {
          id: "out-1",
          type: "care_gap",
          channel: "email",
          subject: "Schedule Your Annual Eye Exam",
          message: "Dear John, our records show your annual diabetic eye exam is due. This important screening helps protect your vision. Please call us to schedule.",
          sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          status: "delivered"
        }
      ],
      createdAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "psp-2",
      patientId: "patient-002",
      patientName: "Mary Johnson",
      age: 72,
      conditions: ["Chronic Heart Failure", "Atrial Fibrillation", "Chronic Kidney Disease"],
      riskLevel: "critical",
      supportScore: 0.92,
      lastVisit: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      communicationHistory: {
        lastContact: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        responseRate: 0.85,
        preferredChannel: "phone"
      },
      feedbackTrend: "concerning",
      supportNeeds: [
        {
          id: "need-3",
          type: "follow_up",
          priority: "urgent",
          description: "Recent ER visit for fluid overload, needs close monitoring",
          identifiedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: "in_progress",
          aiReasoning: "Post-discharge from ER requires intensive follow-up. High risk for readmission without proactive care coordination."
        },
        {
          id: "need-4",
          type: "medication_adherence",
          priority: "high",
          description: "Diuretic medication refill delayed, potential adherence issue",
          identifiedDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
          status: "identified",
          aiReasoning: "Pharmacy records show delayed refill of critical heart failure medication. Non-adherence risk."
        }
      ],
      eligiblePrograms: [wellnessPrograms[1]],
      outreachHistory: [
        {
          id: "out-2",
          type: "adverse_event",
          channel: "phone",
          subject: "Post-ER Follow-up Call",
          message: "Follow-up call regarding recent ER visit. Reviewed symptoms and medication compliance.",
          sentAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          status: "responded",
          responseReceived: true,
          responseDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          scheduledFollowUp: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
        }
      ],
      createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "psp-3",
      patientId: "patient-003",
      patientName: "Robert Williams",
      age: 45,
      conditions: ["Depression", "Anxiety", "Insomnia"],
      riskLevel: "moderate",
      supportScore: 0.65,
      lastVisit: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      communicationHistory: {
        lastContact: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        responseRate: 0.40,
        preferredChannel: "portal"
      },
      feedbackTrend: "declining",
      supportNeeds: [
        {
          id: "need-5",
          type: "mental_health",
          priority: "high",
          description: "No mental health follow-up in 60 days, declining engagement",
          identifiedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: "identified",
          aiReasoning: "Patient with depression history showing signs of disengagement. Proactive outreach recommended to prevent crisis."
        },
        {
          id: "need-6",
          type: "care_gap",
          priority: "medium",
          description: "Annual wellness visit not completed",
          identifiedDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          status: "identified",
          aiReasoning: "Preventive care opportunity to assess overall health and mental wellness."
        }
      ],
      eligiblePrograms: [wellnessPrograms[2]],
      outreachHistory: [],
      createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "psp-4",
      patientId: "patient-004",
      patientName: "Sarah Davis",
      age: 35,
      conditions: ["Gestational Diabetes History", "Pre-hypertension"],
      riskLevel: "low",
      supportScore: 0.45,
      lastVisit: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      communicationHistory: {
        lastContact: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        responseRate: 0.90,
        preferredChannel: "sms"
      },
      feedbackTrend: "positive",
      supportNeeds: [
        {
          id: "need-7",
          type: "wellness",
          priority: "low",
          description: "Eligible for diabetes prevention program based on GDM history",
          identifiedDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: "identified",
          aiReasoning: "History of gestational diabetes increases lifetime diabetes risk. Prevention program could significantly reduce future risk."
        }
      ],
      eligiblePrograms: [wellnessPrograms[0], wellnessPrograms[4]],
      outreachHistory: [],
      createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  samplePatients.forEach(p => patientProfileStore.set(p.id, p));

  const sampleCampaigns: OutreachCampaign[] = [
    {
      id: "camp-1",
      name: "Flu Vaccination Reminder",
      type: "seasonal",
      targetCriteria: {
        ageRange: { min: 65, max: 100 },
        conditions: ["Diabetes", "Heart Disease", "COPD"]
      },
      messageTemplate: "Dear {patientName}, flu season is here. Patients with chronic conditions benefit greatly from vaccination. Schedule your flu shot today!",
      channel: "multi_channel",
      status: "active",
      targetedPatients: 450,
      sentCount: 380,
      responseCount: 145,
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: "camp-2",
      name: "Diabetes Care Gap Outreach",
      type: "care_gap",
      targetCriteria: {
        conditions: ["Type 2 Diabetes"],
        supportNeedTypes: ["preventive_care", "chronic_management"]
      },
      messageTemplate: "Dear {patientName}, our records show you may be due for important diabetes screenings. Regular monitoring helps prevent complications.",
      channel: "email",
      status: "active",
      targetedPatients: 120,
      sentCount: 85,
      responseCount: 32,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  sampleCampaigns.forEach(c => campaignStore.set(c.id, c));
}

initializeSampleData();

class ProactivePatientSupportService {
  constructor() {
    console.log("[ProactiveSupport] Service initialized with AI-driven patient identification");
    console.log("[ProactiveSupport] Features: Outreach generation, wellness recommendations, automated follow-ups");
  }

  async identifyPatientsNeedingSupport(): Promise<PatientSupportProfile[]> {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "PatientSupportProfile",
      details: "AI identifying patients needing support"
    });

    const allPatients = Array.from(patientProfileStore.values());
    return allPatients
      .filter(p => p.supportNeeds.some(n => n.status === "identified"))
      .sort((a, b) => {
        const riskOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
        return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
      });
  }

  async generatePersonalizedOutreach(
    patientId: string,
    outreachType: OutreachRecord["type"],
    supportNeedId?: string
  ): Promise<OutreachRecord> {
    const patient = Array.from(patientProfileStore.values()).find(p => p.patientId === patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    logPhiAccess({
      userId: "system",
      action: "write",
      resourceType: "OutreachRecord",
      details: `Generating ${outreachType} outreach for patient ${patientId}`
    });

    const supportNeed = supportNeedId 
      ? patient.supportNeeds.find(n => n.id === supportNeedId)
      : patient.supportNeeds.find(n => n.status === "identified");

    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a healthcare communication specialist generating personalized patient outreach messages. 
Create empathetic, clear, and actionable messages that encourage patient engagement.
Keep messages brief, warm, and focused on the patient's wellbeing.
Never include specific medical details or test results in messages.
Return JSON with: subject (string), message (string), callToAction (string).`
          },
          {
            role: "user",
            content: `Generate a ${outreachType} message for:
Patient: ${patient.patientName}
Age: ${patient.age}
Conditions: ${patient.conditions.join(", ")}
Preferred Channel: ${patient.communicationHistory.preferredChannel}
${supportNeed ? `Support Need: ${supportNeed.description}` : ""}
Last Contact: ${new Date(patient.communicationHistory.lastContact).toLocaleDateString()}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 400
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");

      const outreach: OutreachRecord = {
        id: `out-${Date.now()}`,
        type: outreachType,
        channel: patient.communicationHistory.preferredChannel,
        subject: parsed.subject || this.getDefaultSubject(outreachType),
        message: parsed.message || this.getDefaultMessage(outreachType, patient.patientName),
        sentAt: new Date().toISOString(),
        status: "pending"
      };

      patient.outreachHistory.push(outreach);
      if (supportNeed) {
        supportNeed.status = "outreach_sent";
      }
      patientProfileStore.set(patient.id, patient);

      return outreach;
    } catch (error) {
      console.error("[ProactiveSupport] OpenAI error:", error);
      const fallbackOutreach: OutreachRecord = {
        id: `out-${Date.now()}`,
        type: outreachType,
        channel: patient.communicationHistory.preferredChannel,
        subject: this.getDefaultSubject(outreachType),
        message: this.getDefaultMessage(outreachType, patient.patientName),
        sentAt: new Date().toISOString(),
        status: "pending"
      };

      patient.outreachHistory.push(fallbackOutreach);
      patientProfileStore.set(patient.id, patient);
      return fallbackOutreach;
    }
  }

  private getDefaultSubject(type: OutreachRecord["type"]): string {
    const subjects: Record<string, string> = {
      initial: "Checking In On Your Health",
      follow_up: "Following Up On Your Care",
      reminder: "Friendly Reminder From Your Care Team",
      wellness: "Your Wellness Journey Awaits",
      care_gap: "Important Health Screening Reminder",
      adverse_event: "We're Here To Support You"
    };
    return subjects[type] || "Message From Your Care Team";
  }

  private getDefaultMessage(type: OutreachRecord["type"], patientName: string): string {
    const messages: Record<string, string> = {
      initial: `Dear ${patientName}, we hope you're doing well. Your care team is here to support you. If you have any questions or concerns, please don't hesitate to reach out.`,
      follow_up: `Dear ${patientName}, we wanted to follow up on your recent care. Your health and wellbeing are important to us. Please let us know if there's anything we can help with.`,
      reminder: `Dear ${patientName}, this is a friendly reminder from your care team. We want to ensure you have everything you need for your health journey.`,
      wellness: `Dear ${patientName}, we have wellness resources that may benefit you. Taking proactive steps for your health can make a real difference.`,
      care_gap: `Dear ${patientName}, our records show you may be due for an important health screening. Regular check-ups help us keep you healthy.`,
      adverse_event: `Dear ${patientName}, we're thinking of you and want to make sure you're getting the support you need. Your care team is here for you.`
    };
    return messages[type] || `Dear ${patientName}, your care team is reaching out to check on your wellbeing.`;
  }

  async recommendWellnessPrograms(patientId: string): Promise<WellnessProgram[]> {
    const patient = Array.from(patientProfileStore.values()).find(p => p.patientId === patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "WellnessProgram",
      details: `Recommending wellness programs for patient ${patientId}`
    });

    const allPrograms = Array.from(wellnessProgramStore.values());
    
    const matchedPrograms = allPrograms.filter(program => {
      const conditionMatch = program.eligibilityCriteria.some(criteria =>
        patient.conditions.some(condition => 
          condition.toLowerCase().includes(criteria.toLowerCase()) ||
          criteria.toLowerCase().includes(condition.toLowerCase())
        )
      );
      return conditionMatch;
    });

    return matchedPrograms.sort((a, b) => b.matchScore - a.matchScore);
  }

  async scheduleFollowUp(
    patientId: string,
    followUpType: "routine" | "post_visit" | "post_adverse_event" | "medication_check",
    daysFromNow: number
  ): Promise<{ scheduledDate: string; followUpType: string }> {
    const patient = Array.from(patientProfileStore.values()).find(p => p.patientId === patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    logPhiAccess({
      userId: "system",
      action: "write",
      resourceType: "FollowUp",
      details: `Scheduling ${followUpType} follow-up for patient ${patientId}`
    });

    const scheduledDate = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();

    const followUpNeed: SupportNeed = {
      id: `need-${Date.now()}`,
      type: "follow_up",
      priority: followUpType === "post_adverse_event" ? "urgent" : "medium",
      description: `Scheduled ${followUpType.replace("_", " ")} follow-up`,
      identifiedDate: new Date().toISOString(),
      dueDate: scheduledDate,
      status: "identified",
      aiReasoning: `Automated follow-up scheduled based on ${followUpType} protocol.`
    };

    patient.supportNeeds.push(followUpNeed);
    patientProfileStore.set(patient.id, patient);

    return { scheduledDate, followUpType };
  }

  async getPatientSupportProfile(patientId: string): Promise<PatientSupportProfile | undefined> {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "PatientSupportProfile",
      details: `Reading support profile for patient ${patientId}`
    });

    return Array.from(patientProfileStore.values()).find(p => p.patientId === patientId);
  }

  getAllProfiles(): PatientSupportProfile[] {
    return Array.from(patientProfileStore.values()).sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    });
  }

  async getStats(): Promise<ProactiveSupportStats> {
    const allPatients = Array.from(patientProfileStore.values());
    const allCampaigns = Array.from(campaignStore.values());

    const pendingNeeds = allPatients.flatMap(p => p.supportNeeds.filter(n => n.status === "identified"));
    const inProgressNeeds = allPatients.flatMap(p => p.supportNeeds.filter(n => n.status === "in_progress"));
    const resolvedNeeds = allPatients.flatMap(p => p.supportNeeds.filter(n => n.status === "resolved"));

    const allOutreach = allPatients.flatMap(p => p.outreachHistory);
    const respondedOutreach = allOutreach.filter(o => o.responseReceived);
    const todayOutreach = allOutreach.filter(o => {
      const sentDate = new Date(o.sentAt).toDateString();
      return sentDate === new Date().toDateString();
    });

    const adverseEventNeeds = allPatients.flatMap(p => 
      p.supportNeeds.filter(n => n.type === "follow_up" && n.priority === "urgent")
    );

    return {
      totalPatientsMonitored: allPatients.length,
      highRiskPatients: allPatients.filter(p => p.riskLevel === "high" || p.riskLevel === "critical").length,
      pendingOutreach: pendingNeeds.length,
      activeFollowUps: inProgressNeeds.length,
      programEnrollments: allPatients.filter(p => 
        p.eligiblePrograms.some(prog => prog.enrollmentStatus === "enrolled")
      ).length,
      responseRate: allOutreach.length > 0 ? respondedOutreach.length / allOutreach.length : 0,
      careGapsIdentified: pendingNeeds.filter(n => n.type === "care_gap" || n.type === "preventive_care").length,
      careGapsResolved: resolvedNeeds.filter(n => n.type === "care_gap" || n.type === "preventive_care").length,
      recentAdverseEvents: adverseEventNeeds.length,
      outreachSentToday: todayOutreach.length
    };
  }

  getAllCampaigns(): OutreachCampaign[] {
    return Array.from(campaignStore.values());
  }

  getCampaignById(id: string): OutreachCampaign | undefined {
    return campaignStore.get(id);
  }

  getAllWellnessPrograms(): WellnessProgram[] {
    return Array.from(wellnessProgramStore.values());
  }

  async updateSupportNeedStatus(
    patientId: string,
    needId: string,
    status: SupportNeed["status"]
  ): Promise<SupportNeed | undefined> {
    const patient = Array.from(patientProfileStore.values()).find(p => p.patientId === patientId);
    if (!patient) return undefined;

    const need = patient.supportNeeds.find(n => n.id === needId);
    if (!need) return undefined;

    logPhiAccess({
      userId: "system",
      action: "write",
      resourceType: "SupportNeed",
      details: `Updating support need ${needId} status to ${status}`
    });

    need.status = status;
    patientProfileStore.set(patient.id, patient);
    return need;
  }

  async analyzePatientForSupport(patientId: string): Promise<{
    riskAssessment: string;
    recommendedActions: string[];
    urgentNeeds: SupportNeed[];
  }> {
    assertCdsEnabled("proactive-patient-support-service.analyzePatientForSupport");
    const patient = Array.from(patientProfileStore.values()).find(p => p.patientId === patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "PatientSupportProfile",
      details: `AI analyzing patient ${patientId} for support needs`
    });

    try {
      const response = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a healthcare analytics AI identifying patients who may benefit from additional support.
Analyze the patient profile and provide actionable recommendations.
Return JSON with: riskAssessment (string summary), recommendedActions (array of strings).
Focus on preventive care, wellness opportunities, and care coordination.
This is for INFORMATIONAL purposes only, not clinical decision support.`
          },
          {
            role: "user",
            content: `Analyze support needs for:
Patient: ${patient.patientName}, Age: ${patient.age}
Conditions: ${patient.conditions.join(", ")}
Risk Level: ${patient.riskLevel}
Last Visit: ${patient.lastVisit || "Unknown"}
Response Rate: ${(patient.communicationHistory.responseRate * 100).toFixed(0)}%
Feedback Trend: ${patient.feedbackTrend}
Current Support Needs: ${patient.supportNeeds.map(n => n.description).join("; ") || "None identified"}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 500
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");

      return {
        riskAssessment: parsed.riskAssessment || `Patient has ${patient.riskLevel} risk level with ${patient.supportNeeds.length} identified support needs.`,
        recommendedActions: parsed.recommendedActions || ["Review current care plan", "Schedule follow-up appointment"],
        urgentNeeds: patient.supportNeeds.filter(n => n.priority === "urgent")
      };
    } catch (error) {
      console.error("[ProactiveSupport] OpenAI error:", error);
      return {
        riskAssessment: `Patient has ${patient.riskLevel} risk level with ${patient.supportNeeds.length} identified support needs.`,
        recommendedActions: [
          "Review patient's current care plan",
          "Check for outstanding care gaps",
          "Consider wellness program enrollment",
          "Schedule appropriate follow-up"
        ],
        urgentNeeds: patient.supportNeeds.filter(n => n.priority === "urgent")
      };
    }
  }
}

export const proactivePatientSupportService = new ProactivePatientSupportService();
