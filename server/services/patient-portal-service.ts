import { getAuditLogger } from "./integrations/factory";

export interface PatientMedication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  prescriber: string;
  startDate: string;
  status: "active" | "discontinued" | "on-hold";
  instructions?: string;
  refillsRemaining?: number;
}

export interface PatientAllergy {
  id: string;
  allergen: string;
  reaction: string;
  severity: "mild" | "moderate" | "severe";
  verifiedDate?: string;
  notes?: string;
}

export interface PatientCondition {
  id: string;
  name: string;
  status: "active" | "resolved" | "inactive";
  onsetDate: string;
  category: string;
  managedBy?: string;
  notes?: string;
}

export interface PatientSurgery {
  id: string;
  procedure: string;
  date: string;
  surgeon?: string;
  facility?: string;
  outcome?: string;
  complications?: string;
}

export interface FamilyHistoryItem {
  id: string;
  relationship: string;
  condition: string;
  ageAtOnset?: number;
  deceased?: boolean;
  geneticRiskLevel?: "low" | "moderate" | "high";
  notes?: string;
}

export interface CarePlanTemplate {
  id: string;
  title: string;
  status: "draft" | "pending_review" | "approved" | "active";
  createdAt: string;
  updatedAt: string;
  goals: Array<{ id: string; description: string; targetDate: string; status: string }>;
  interventions: Array<{ id: string; description: string; frequency: string; assignedTo: string }>;
  notes?: string;
}

export interface SecureMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderName: string;
  senderRole: "patient" | "provider" | "nurse" | "care_coordinator";
  recipientId: string;
  recipientName: string;
  subject: string;
  content: string;
  sentAt: string;
  readAt?: string;
  isUrgent: boolean;
  attachments?: Array<{ name: string; type: string; size: number }>;
}

export interface MessageThread {
  id: string;
  subject: string;
  participants: Array<{ id: string; name: string; role: string }>;
  lastMessageAt: string;
  messageCount: number;
  unreadCount: number;
  isUrgent: boolean;
}

export interface HealthQuestionnaire {
  id: string;
  title: string;
  description: string;
  category: "symptoms" | "lifestyle" | "medications" | "general" | "pre_visit";
  questions: QuestionnaireQuestion[];
  dueDate?: string;
  completedAt?: string;
  status: "pending" | "in_progress" | "completed";
}

export interface QuestionnaireQuestion {
  id: string;
  text: string;
  type: "text" | "single_choice" | "multiple_choice" | "scale" | "date" | "boolean";
  required: boolean;
  options?: string[];
  scaleMin?: number;
  scaleMax?: number;
  answer?: string | string[] | number | boolean;
}

export interface QuestionnaireResponse {
  questionnaireId: string;
  patientId: string;
  responses: Array<{ questionId: string; answer: string | string[] | number | boolean }>;
  submittedAt: string;
}

export interface PatientDataUpdate {
  id: string;
  patientId: string;
  updateType: "contact" | "pharmacy" | "emergency_contact" | "insurance" | "preferences";
  oldValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
  submittedAt: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
}

const SAMPLE_PATIENT_PORTAL_DATA: Record<string, {
  medications: PatientMedication[];
  allergies: PatientAllergy[];
  conditions: PatientCondition[];
  surgeries: PatientSurgery[];
  familyHistory: FamilyHistoryItem[];
  carePlans: CarePlanTemplate[];
  messageThreads: MessageThread[];
  messages: SecureMessage[];
  questionnaires: HealthQuestionnaire[];
}> = {
  "patient-001": {
    medications: [
      { id: "med-1", name: "Metformin", dosage: "1000mg", frequency: "Twice daily with meals", prescriber: "Dr. Johnson", startDate: "2018-06-15", status: "active", instructions: "Take with food to reduce stomach upset", refillsRemaining: 3 },
      { id: "med-2", name: "Lisinopril", dosage: "20mg", frequency: "Once daily in the morning", prescriber: "Dr. Johnson", startDate: "2016-03-01", status: "active", refillsRemaining: 2 },
      { id: "med-3", name: "Atorvastatin", dosage: "40mg", frequency: "Once daily at bedtime", prescriber: "Dr. Johnson", startDate: "2017-08-10", status: "active", refillsRemaining: 5 },
      { id: "med-4", name: "Aspirin", dosage: "81mg", frequency: "Once daily", prescriber: "Dr. Johnson", startDate: "2019-01-05", status: "active", refillsRemaining: 6 },
    ],
    allergies: [
      { id: "allergy-1", allergen: "Penicillin", reaction: "Skin rash and hives", severity: "moderate", verifiedDate: "2015-03-20", notes: "Confirmed by allergist" },
      { id: "allergy-2", allergen: "Sulfa drugs", reaction: "Anaphylaxis - difficulty breathing, swelling", severity: "severe", verifiedDate: "2010-08-15", notes: "Carry epinephrine auto-injector" },
    ],
    conditions: [
      { id: "cond-1", name: "Type 2 Diabetes Mellitus", status: "active", onsetDate: "2018-06-10", category: "Metabolic", managedBy: "Dr. Johnson - Primary Care", notes: "Well-controlled with medication and diet" },
      { id: "cond-2", name: "Essential Hypertension", status: "active", onsetDate: "2016-02-20", category: "Cardiovascular", managedBy: "Dr. Johnson - Primary Care" },
      { id: "cond-3", name: "Hyperlipidemia", status: "active", onsetDate: "2017-08-05", category: "Metabolic", managedBy: "Dr. Johnson - Primary Care" },
      { id: "cond-4", name: "Chronic Kidney Disease Stage 3", status: "active", onsetDate: "2022-01-15", category: "Renal", managedBy: "Dr. Patel - Nephrology", notes: "Monitoring every 3 months" },
    ],
    surgeries: [
      { id: "surg-1", procedure: "Appendectomy", date: "1995-07-20", surgeon: "Dr. Williams", facility: "City General Hospital", outcome: "Successful, no complications" },
      { id: "surg-2", procedure: "Right Knee Arthroscopy", date: "2015-11-10", surgeon: "Dr. Chen", facility: "Orthopedic Surgical Center", outcome: "Successful, full recovery", complications: "None" },
    ],
    familyHistory: [
      { id: "fh-1", relationship: "Father", condition: "Type 2 Diabetes", ageAtOnset: 55, deceased: true, geneticRiskLevel: "moderate", notes: "Died at 72 from heart disease" },
      { id: "fh-2", relationship: "Mother", condition: "Breast Cancer", ageAtOnset: 62, deceased: false, geneticRiskLevel: "high", notes: "Successfully treated, in remission" },
      { id: "fh-3", relationship: "Brother", condition: "Hypertension", ageAtOnset: 45, deceased: false, geneticRiskLevel: "moderate" },
      { id: "fh-4", relationship: "Paternal Grandfather", condition: "Coronary Artery Disease", ageAtOnset: 58, deceased: true, geneticRiskLevel: "high", notes: "Had bypass surgery at 60" },
      { id: "fh-5", relationship: "Maternal Grandmother", condition: "Colon Cancer", ageAtOnset: 68, deceased: true, geneticRiskLevel: "moderate", notes: "Consider colonoscopy screening" },
    ],
    carePlans: [
      {
        id: "cp-1",
        title: "Diabetes Management Plan",
        status: "active",
        createdAt: "2024-01-15",
        updatedAt: "2026-01-10",
        goals: [
          { id: "g-1", description: "Maintain HbA1c below 7%", targetDate: "2026-06-01", status: "in-progress" },
          { id: "g-2", description: "Blood glucose 80-130 mg/dL before meals", targetDate: "2026-03-01", status: "in-progress" },
          { id: "g-3", description: "Lose 10 pounds through diet and exercise", targetDate: "2026-06-01", status: "in-progress" },
        ],
        interventions: [
          { id: "i-1", description: "Daily blood glucose monitoring", frequency: "Twice daily", assignedTo: "Patient" },
          { id: "i-2", description: "HbA1c lab test", frequency: "Every 3 months", assignedTo: "Lab" },
          { id: "i-3", description: "Nutrition counseling", frequency: "Monthly", assignedTo: "Dietitian" },
        ],
        notes: "Patient is motivated and engaged in self-management"
      },
      {
        id: "cp-2",
        title: "Cardiovascular Risk Reduction",
        status: "pending_review",
        createdAt: "2026-01-05",
        updatedAt: "2026-01-15",
        goals: [
          { id: "g-4", description: "Blood pressure consistently <140/90", targetDate: "2026-03-01", status: "in-progress" },
          { id: "g-5", description: "LDL cholesterol <100 mg/dL", targetDate: "2026-06-01", status: "in-progress" },
        ],
        interventions: [
          { id: "i-4", description: "Home blood pressure monitoring", frequency: "Daily", assignedTo: "Patient" },
          { id: "i-5", description: "Lipid panel", frequency: "Every 6 months", assignedTo: "Lab" },
        ],
      },
    ],
    messageThreads: [
      { id: "thread-1", subject: "Question about medication timing", participants: [{ id: "patient-001", name: "John Smith", role: "patient" }, { id: "nurse-1", name: "Nurse Sarah", role: "nurse" }], lastMessageAt: "2026-01-17T14:30:00Z", messageCount: 3, unreadCount: 1, isUrgent: false },
      { id: "thread-2", subject: "Lab results follow-up", participants: [{ id: "patient-001", name: "John Smith", role: "patient" }, { id: "dr-johnson", name: "Dr. Johnson", role: "provider" }], lastMessageAt: "2026-01-15T10:00:00Z", messageCount: 2, unreadCount: 0, isUrgent: false },
    ],
    messages: [
      { id: "msg-1", threadId: "thread-1", senderId: "patient-001", senderName: "John Smith", senderRole: "patient", recipientId: "nurse-1", recipientName: "Nurse Sarah", subject: "Question about medication timing", content: "Hi, I have a question about when to take my Metformin. Should I take it before or after breakfast?", sentAt: "2026-01-17T09:00:00Z", readAt: "2026-01-17T09:30:00Z", isUrgent: false },
      { id: "msg-2", threadId: "thread-1", senderId: "nurse-1", senderName: "Nurse Sarah", senderRole: "nurse", recipientId: "patient-001", recipientName: "John Smith", subject: "Re: Question about medication timing", content: "Hi John, it's best to take Metformin with meals to minimize stomach upset. Taking it at the start of your meal works well for most patients.", sentAt: "2026-01-17T10:15:00Z", readAt: "2026-01-17T11:00:00Z", isUrgent: false },
      { id: "msg-3", threadId: "thread-1", senderId: "nurse-1", senderName: "Nurse Sarah", senderRole: "nurse", recipientId: "patient-001", recipientName: "John Smith", subject: "Re: Question about medication timing", content: "Also, make sure to take your second dose with dinner. Let me know if you have any other questions!", sentAt: "2026-01-17T14:30:00Z", isUrgent: false },
      { id: "msg-4", threadId: "thread-2", senderId: "dr-johnson", senderName: "Dr. Johnson", senderRole: "provider", recipientId: "patient-001", recipientName: "John Smith", subject: "Lab results follow-up", content: "John, your recent lab results look good. Your HbA1c has improved to 7.8%. Keep up the good work with your diet and exercise!", sentAt: "2026-01-15T09:00:00Z", readAt: "2026-01-15T10:00:00Z", isUrgent: false },
      { id: "msg-5", threadId: "thread-2", senderId: "patient-001", senderName: "John Smith", senderRole: "patient", recipientId: "dr-johnson", recipientName: "Dr. Johnson", subject: "Re: Lab results follow-up", content: "Thank you Dr. Johnson! I've been working hard on my diet. Should I schedule a follow-up appointment?", sentAt: "2026-01-15T10:00:00Z", readAt: "2026-01-15T11:30:00Z", isUrgent: false },
    ],
    questionnaires: [
      {
        id: "q-1",
        title: "Pre-Visit Health Check",
        description: "Please complete this questionnaire before your upcoming appointment",
        category: "pre_visit",
        dueDate: "2026-01-25",
        status: "pending",
        questions: [
          { id: "q1-1", text: "How would you rate your overall health in the past week?", type: "scale", required: true, scaleMin: 1, scaleMax: 10 },
          { id: "q1-2", text: "Have you experienced any new symptoms since your last visit?", type: "boolean", required: true },
          { id: "q1-3", text: "If yes, please describe your symptoms", type: "text", required: false },
          { id: "q1-4", text: "Are you taking all your medications as prescribed?", type: "single_choice", required: true, options: ["Yes, all of them", "Most of them", "Some of them", "No"] },
          { id: "q1-5", text: "What topics would you like to discuss at your appointment?", type: "multiple_choice", required: false, options: ["Medication questions", "Diet/nutrition", "Exercise", "Lab results", "Symptoms", "Other"] },
        ],
      },
      {
        id: "q-2",
        title: "Diabetes Self-Management",
        description: "Help us understand how you're managing your diabetes",
        category: "lifestyle",
        status: "pending",
        questions: [
          { id: "q2-1", text: "How many times per week do you check your blood glucose?", type: "single_choice", required: true, options: ["Daily", "4-6 times/week", "2-3 times/week", "Once a week", "Less than once a week"] },
          { id: "q2-2", text: "On average, what is your fasting blood glucose?", type: "text", required: true },
          { id: "q2-3", text: "How confident do you feel managing your diabetes?", type: "scale", required: true, scaleMin: 1, scaleMax: 10 },
          { id: "q2-4", text: "What challenges do you face with diabetes management?", type: "multiple_choice", required: false, options: ["Remembering medications", "Diet choices", "Exercise", "Understanding results", "Cost of care", "None"] },
        ],
      },
    ],
  },
  "patient-002": {
    medications: [
      { id: "med-1", name: "Fluticasone/Salmeterol", dosage: "250/50mcg", frequency: "Twice daily", prescriber: "Dr. Williams", startDate: "2020-02-01", status: "active", instructions: "Rinse mouth after use", refillsRemaining: 2 },
      { id: "med-2", name: "Albuterol Inhaler", dosage: "90mcg", frequency: "As needed for breathing difficulty", prescriber: "Dr. Williams", startDate: "2005-04-15", status: "active", refillsRemaining: 4 },
      { id: "med-3", name: "Sertraline", dosage: "100mg", frequency: "Once daily in the morning", prescriber: "Dr. Garcia", startDate: "2019-10-01", status: "active", refillsRemaining: 3 },
      { id: "med-4", name: "Sumatriptan", dosage: "50mg", frequency: "As needed for migraine", prescriber: "Dr. Williams", startDate: "2015-07-01", status: "active", instructions: "Do not exceed 2 tablets in 24 hours", refillsRemaining: 5 },
    ],
    allergies: [
      { id: "allergy-1", allergen: "NSAIDs (Ibuprofen, Naproxen)", reaction: "Stomach upset and GI bleeding risk", severity: "moderate", verifiedDate: "2018-05-10", notes: "Use acetaminophen instead" },
    ],
    conditions: [
      { id: "cond-1", name: "Asthma", status: "active", onsetDate: "2005-04-10", category: "Respiratory", managedBy: "Dr. Williams - Primary Care", notes: "Well-controlled with maintenance inhaler" },
      { id: "cond-2", name: "Generalized Anxiety Disorder", status: "active", onsetDate: "2019-09-15", category: "Mental Health", managedBy: "Dr. Garcia - Psychiatry" },
      { id: "cond-3", name: "Migraine without aura", status: "active", onsetDate: "2015-06-20", category: "Neurological", managedBy: "Dr. Williams - Primary Care", notes: "2-3 episodes per month" },
    ],
    surgeries: [],
    familyHistory: [
      { id: "fh-1", relationship: "Mother", condition: "Asthma", ageAtOnset: 25, deceased: false, geneticRiskLevel: "moderate" },
      { id: "fh-2", relationship: "Father", condition: "Anxiety Disorder", ageAtOnset: 40, deceased: false, geneticRiskLevel: "moderate" },
    ],
    carePlans: [
      {
        id: "cp-1",
        title: "Asthma Action Plan",
        status: "active",
        createdAt: "2025-06-01",
        updatedAt: "2026-01-12",
        goals: [
          { id: "g-1", description: "Reduce rescue inhaler use to <2x/week", targetDate: "2026-01-01", status: "achieved" },
          { id: "g-2", description: "Peak flow consistently >400 L/min", targetDate: "2026-03-01", status: "in-progress" },
        ],
        interventions: [
          { id: "i-1", description: "Daily maintenance inhaler use", frequency: "Twice daily", assignedTo: "Patient" },
          { id: "i-2", description: "Peak flow monitoring", frequency: "Daily", assignedTo: "Patient" },
          { id: "i-3", description: "Spirometry testing", frequency: "Every 6 months", assignedTo: "Pulmonary Lab" },
        ],
      },
    ],
    messageThreads: [
      { id: "thread-1", subject: "Refill request for Sertraline", participants: [{ id: "patient-002", name: "Mary Johnson", role: "patient" }, { id: "nurse-2", name: "Nurse Mike", role: "nurse" }], lastMessageAt: "2026-01-16T16:00:00Z", messageCount: 2, unreadCount: 0, isUrgent: false },
    ],
    messages: [
      { id: "msg-1", threadId: "thread-1", senderId: "patient-002", senderName: "Mary Johnson", senderRole: "patient", recipientId: "nurse-2", recipientName: "Nurse Mike", subject: "Refill request for Sertraline", content: "Hi, I need a refill for my Sertraline. I have about a week's supply left.", sentAt: "2026-01-16T14:00:00Z", readAt: "2026-01-16T15:00:00Z", isUrgent: false },
      { id: "msg-2", threadId: "thread-1", senderId: "nurse-2", senderName: "Nurse Mike", senderRole: "nurse", recipientId: "patient-002", recipientName: "Mary Johnson", subject: "Re: Refill request for Sertraline", content: "Hi Mary, I've sent the refill request to your pharmacy. It should be ready for pickup tomorrow. Let us know if you have any questions!", sentAt: "2026-01-16T16:00:00Z", readAt: "2026-01-16T16:30:00Z", isUrgent: false },
    ],
    questionnaires: [
      {
        id: "q-1",
        title: "Mental Health Check-In",
        description: "Regular check-in about your mental health",
        category: "symptoms",
        status: "completed",
        completedAt: "2026-01-05T10:00:00Z",
        questions: [
          { id: "q1-1", text: "Over the past 2 weeks, how often have you felt down, depressed, or hopeless?", type: "single_choice", required: true, options: ["Not at all", "Several days", "More than half the days", "Nearly every day"], answer: "Several days" },
          { id: "q1-2", text: "Over the past 2 weeks, how often have you had trouble falling or staying asleep?", type: "single_choice", required: true, options: ["Not at all", "Several days", "More than half the days", "Nearly every day"], answer: "Not at all" },
          { id: "q1-3", text: "Is there anything you'd like to discuss with your care team?", type: "text", required: false, answer: "Feeling better overall, the medication seems to be working well." },
        ],
      },
    ],
  },
};

const messageStore: SecureMessage[] = [];
const questionnaireResponses: QuestionnaireResponse[] = [];
const dataUpdates: PatientDataUpdate[] = [];

export function getPatientMedications(patientId: string): PatientMedication[] {
  return SAMPLE_PATIENT_PORTAL_DATA[patientId]?.medications || [];
}

export function getPatientAllergies(patientId: string): PatientAllergy[] {
  return SAMPLE_PATIENT_PORTAL_DATA[patientId]?.allergies || [];
}

export function getPatientConditions(patientId: string): PatientCondition[] {
  return SAMPLE_PATIENT_PORTAL_DATA[patientId]?.conditions || [];
}

export function getPatientSurgeries(patientId: string): PatientSurgery[] {
  return SAMPLE_PATIENT_PORTAL_DATA[patientId]?.surgeries || [];
}

export function getPatientFamilyHistory(patientId: string): FamilyHistoryItem[] {
  return SAMPLE_PATIENT_PORTAL_DATA[patientId]?.familyHistory || [];
}

export function getPatientCarePlans(patientId: string): CarePlanTemplate[] {
  return SAMPLE_PATIENT_PORTAL_DATA[patientId]?.carePlans || [];
}

export function getMessageThreads(patientId: string): MessageThread[] {
  return SAMPLE_PATIENT_PORTAL_DATA[patientId]?.messageThreads || [];
}

export function getThreadMessages(patientId: string, threadId: string): SecureMessage[] {
  const patientData = SAMPLE_PATIENT_PORTAL_DATA[patientId];
  if (!patientData) return [];
  
  const storedMessages = messageStore.filter((m) => m.threadId === threadId);
  const sampleMessages = patientData.messages.filter((m) => m.threadId === threadId);
  
  return [...sampleMessages, ...storedMessages].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
  );
}

export async function sendMessage(
  patientId: string,
  threadId: string,
  content: string,
  recipientId: string,
  recipientName: string,
  subject: string,
  isUrgent: boolean,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<SecureMessage> {
  const patientData = SAMPLE_PATIENT_PORTAL_DATA[patientId];
  if (!patientData) {
    throw new Error("Patient not found");
  }

  const message: SecureMessage = {
    id: `msg-${Date.now()}`,
    threadId,
    senderId: patientId,
    senderName: patientId === "patient-001" ? "John Smith" : "Mary Johnson",
    senderRole: "patient",
    recipientId,
    recipientName,
    subject,
    content,
    sentAt: new Date().toISOString(),
    isUrgent,
  };

  messageStore.push(message);

  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: userId || "[REDACTED]",
      userRole: "patient",
      action: "create",
      resourceType: "SecureMessage",
      resourceId: "[REDACTED]",
      patientId: "[REDACTED]",
      ipAddress: "[REDACTED-IP]",
      userAgent: "[REDACTED-UA]",
      requestPath: "/api/patient-portal/messages",
      requestMethod: "POST",
      responseStatus: 201,
      responseTimeMs: 0,
      phiAccessed: true,
      details: {
        action: "patient_sent_message",
        threadId: "[REDACTED]",
        isUrgent,
      },
    });
  } catch (e) {
    console.error("[PatientPortal] Audit logging failed:", e);
  }

  return message;
}

export async function createNewThread(
  patientId: string,
  recipientId: string,
  recipientName: string,
  recipientRole: string,
  subject: string,
  content: string,
  isUrgent: boolean,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<{ thread: MessageThread; message: SecureMessage }> {
  const patientData = SAMPLE_PATIENT_PORTAL_DATA[patientId];
  if (!patientData) {
    throw new Error("Patient not found");
  }

  const threadId = `thread-${Date.now()}`;
  const patientName = patientId === "patient-001" ? "John Smith" : "Mary Johnson";

  const thread: MessageThread = {
    id: threadId,
    subject,
    participants: [
      { id: patientId, name: patientName, role: "patient" },
      { id: recipientId, name: recipientName, role: recipientRole },
    ],
    lastMessageAt: new Date().toISOString(),
    messageCount: 1,
    unreadCount: 0,
    isUrgent,
  };

  const message: SecureMessage = {
    id: `msg-${Date.now()}`,
    threadId,
    senderId: patientId,
    senderName: patientName,
    senderRole: "patient",
    recipientId,
    recipientName,
    subject,
    content,
    sentAt: new Date().toISOString(),
    isUrgent,
  };

  patientData.messageThreads.push(thread);
  messageStore.push(message);

  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: userId || "[REDACTED]",
      userRole: "patient",
      action: "create",
      resourceType: "MessageThread",
      resourceId: "[REDACTED]",
      patientId: "[REDACTED]",
      ipAddress: "[REDACTED-IP]",
      userAgent: "[REDACTED-UA]",
      requestPath: "/api/patient-portal/threads",
      requestMethod: "POST",
      responseStatus: 201,
      responseTimeMs: 0,
      phiAccessed: true,
      details: {
        action: "patient_created_thread",
        isUrgent,
      },
    });
  } catch (e) {
    console.error("[PatientPortal] Audit logging failed:", e);
  }

  return { thread, message };
}

export function getQuestionnaires(patientId: string): HealthQuestionnaire[] {
  const legacyQuestionnaires = SAMPLE_PATIENT_PORTAL_DATA[patientId]?.questionnaires || [];
  
  const { getQuestionnaires: getActiveQuestionnaires, getPatientResponses } = require("./questionnaire-service");
  const activeQuestionnaires = getActiveQuestionnaires(true);
  const patientResponses = getPatientResponses(patientId);
  
  const enhancedQuestionnaires: HealthQuestionnaire[] = activeQuestionnaires.map((q: any) => {
    const response = patientResponses.find((r: any) => r.questionnaireId === q.id);
    return {
      id: q.id,
      title: q.title,
      description: q.description,
      category: q.category,
      questions: q.questions.map((qn: any) => ({
        id: qn.id,
        text: qn.text,
        type: qn.type === "choice" ? "single_choice" : qn.type === "multi-choice" ? "multiple_choice" : qn.type,
        required: qn.required,
        options: qn.options?.map((o: any) => o.label || o.value),
        scaleMin: qn.scaleMin,
        scaleMax: qn.scaleMax,
      })),
      status: response ? "completed" : "pending",
      completedAt: response?.completedAt,
    };
  });
  
  return [...legacyQuestionnaires, ...enhancedQuestionnaires];
}

export async function submitQuestionnaireResponse(
  patientId: string,
  questionnaireId: string,
  responses: Array<{ questionId: string; answer: string | string[] | number | boolean }>,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<QuestionnaireResponse> {
  const patientData = SAMPLE_PATIENT_PORTAL_DATA[patientId];
  const patientName = patientData?.patientName || patientId;
  
  const legacyQuestionnaire = patientData?.questionnaires.find((q) => q.id === questionnaireId);
  
  if (legacyQuestionnaire) {
    const response: QuestionnaireResponse = {
      questionnaireId,
      patientId,
      responses,
      submittedAt: new Date().toISOString(),
    };

    questionnaireResponses.push(response);
    legacyQuestionnaire.status = "completed";
    legacyQuestionnaire.completedAt = response.submittedAt;

    responses.forEach((r) => {
      const question = legacyQuestionnaire.questions.find((q) => q.id === r.questionId);
      if (question) {
        question.answer = r.answer;
      }
    });

    try {
      const auditLogger = getAuditLogger();
      await auditLogger.log({
        userId: userId || "[REDACTED]",
        userRole: "patient",
        action: "create",
        resourceType: "QuestionnaireResponse",
        resourceId: "[REDACTED]",
        patientId: "[REDACTED]",
        ipAddress: "[REDACTED-IP]",
        userAgent: "[REDACTED-UA]",
        requestPath: "/api/patient-portal/questionnaires/submit",
        requestMethod: "POST",
        responseStatus: 201,
        responseTimeMs: 0,
        phiAccessed: true,
        details: {
          action: "patient_submitted_questionnaire",
          questionCount: responses.length,
        },
      });
    } catch (e) {
      console.error("[PatientPortal] Audit logging failed:", e);
    }

    return response;
  }
  
  const { submitQuestionnaireResponse: submitNewResponse, getQuestionnaireById } = require("./questionnaire-service");
  const questionnaire = getQuestionnaireById(questionnaireId);
  
  if (!questionnaire) {
    throw new Error("Questionnaire not found");
  }
  
  const answers = responses.map((r) => {
    const question = questionnaire.questions.find((q: any) => q.id === r.questionId);
    return {
      questionId: r.questionId,
      questionText: question?.text || "",
      value: r.answer,
      displayValue: Array.isArray(r.answer) ? r.answer.join(", ") : String(r.answer),
    };
  });
  
  const result = await submitNewResponse(
    questionnaireId,
    patientId,
    patientName,
    answers,
    ipAddress,
    userAgent
  );
  
  return {
    questionnaireId,
    patientId,
    responses,
    submittedAt: result.response.completedAt,
    alertsTriggered: result.alerts.length,
  };
}

export async function submitDataUpdate(
  patientId: string,
  updateType: PatientDataUpdate["updateType"],
  oldValue: Record<string, unknown>,
  newValue: Record<string, unknown>,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<PatientDataUpdate> {
  const update: PatientDataUpdate = {
    id: `update-${Date.now()}`,
    patientId,
    updateType,
    oldValue,
    newValue,
    submittedAt: new Date().toISOString(),
    status: "pending",
  };

  dataUpdates.push(update);

  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: userId || "[REDACTED]",
      userRole: "patient",
      action: "update",
      resourceType: "PatientDataUpdate",
      resourceId: "[REDACTED]",
      patientId: "[REDACTED]",
      ipAddress: "[REDACTED-IP]",
      userAgent: "[REDACTED-UA]",
      requestPath: "/api/patient-portal/data-updates",
      requestMethod: "POST",
      responseStatus: 201,
      responseTimeMs: 0,
      phiAccessed: true,
      details: {
        action: "patient_submitted_data_update",
        updateType,
      },
    });
  } catch (e) {
    console.error("[PatientPortal] Audit logging failed:", e);
  }

  return update;
}

export function getDataUpdates(patientId: string): PatientDataUpdate[] {
  return dataUpdates.filter((u) => u.patientId === patientId);
}

export function getAvailableRecipients(): Array<{ id: string; name: string; role: string; specialty?: string }> {
  return [
    { id: "dr-johnson", name: "Dr. Johnson", role: "provider", specialty: "Primary Care" },
    { id: "dr-patel", name: "Dr. Patel", role: "provider", specialty: "Nephrology" },
    { id: "dr-williams", name: "Dr. Williams", role: "provider", specialty: "Primary Care" },
    { id: "dr-garcia", name: "Dr. Garcia", role: "provider", specialty: "Psychiatry" },
    { id: "nurse-1", name: "Nurse Sarah", role: "nurse" },
    { id: "nurse-2", name: "Nurse Mike", role: "nurse" },
    { id: "cc-1", name: "Care Coordinator Amy", role: "care_coordinator" },
  ];
}

export function getPatientPortalPatients(): Array<{ id: string; name: string }> {
  return Object.keys(SAMPLE_PATIENT_PORTAL_DATA).map((id) => ({
    id,
    name: id === "patient-001" ? "John Smith" : "Mary Johnson",
  }));
}

export async function logPatientPortalAccess(
  patientId: string,
  section: string,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: userId || "[REDACTED]",
      userRole: "patient",
      action: "read",
      resourceType: "PatientPortal",
      resourceId: "[REDACTED]",
      patientId: "[REDACTED]",
      ipAddress: "[REDACTED-IP]",
      userAgent: "[REDACTED-UA]",
      requestPath: `/api/patient-portal/${section}`,
      requestMethod: "GET",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: true,
      details: {
        action: "patient_viewed_portal_section",
        section,
      },
    });
  } catch (e) {
    console.error("[PatientPortal] Audit logging failed:", e);
  }
}

console.log("[PatientPortal] Service initialized");
