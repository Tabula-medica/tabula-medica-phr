import { getAuditLogger } from "./integrations/factory";

export type QuestionType = "text" | "number" | "boolean" | "choice" | "multi-choice" | "date" | "scale";

export interface QuestionOption {
  value: string;
  label: string;
  alertTrigger?: boolean;
  alertSeverity?: "low" | "medium" | "high" | "critical";
}

export interface QuestionDefinition {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  options?: QuestionOption[];
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: { min: string; max: string };
  alertThreshold?: { operator: "gt" | "lt" | "eq" | "gte" | "lte"; value: number; severity: "low" | "medium" | "high" | "critical" };
}

export interface Questionnaire {
  id: string;
  title: string;
  description: string;
  category: "medication_adherence" | "lifestyle" | "symptom_tracking" | "wellness" | "custom";
  questions: QuestionDefinition[];
  targetPatientConditions?: string[];
  frequency?: "once" | "daily" | "weekly" | "monthly" | "as_needed";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface QuestionnaireResponse {
  id: string;
  questionnaireId: string;
  questionnaireTitle: string;
  patientId: string;
  patientName: string;
  answers: QuestionAnswer[];
  completedAt: string;
  triggeredAlerts: TriggeredAlert[];
  fhirResourceId?: string;
}

export interface QuestionAnswer {
  questionId: string;
  questionText: string;
  value: string | number | boolean | string[];
  displayValue: string;
}

export interface TriggeredAlert {
  questionId: string;
  questionText: string;
  answerValue: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  notifiedCareTeam: boolean;
  notifiedAt?: string;
}

const SAMPLE_QUESTIONNAIRES: Questionnaire[] = [
  {
    id: "quest-001",
    title: "Medication Adherence Check",
    description: "Weekly check-in about your medication routine",
    category: "medication_adherence",
    frequency: "weekly",
    isActive: true,
    createdAt: "2024-01-10T10:00:00Z",
    updatedAt: "2024-01-10T10:00:00Z",
    createdBy: "admin",
    questions: [
      {
        id: "q1",
        text: "How many doses of your prescribed medications did you miss this week?",
        type: "number",
        required: true,
        alertThreshold: { operator: "gte", value: 3, severity: "high" },
      },
      {
        id: "q2",
        text: "Are you experiencing any side effects from your medications?",
        type: "boolean",
        required: true,
      },
      {
        id: "q3",
        text: "If yes, please describe the side effects:",
        type: "text",
        required: false,
      },
      {
        id: "q4",
        text: "How difficult is it for you to take your medications as prescribed?",
        type: "scale",
        required: true,
        scaleMin: 1,
        scaleMax: 10,
        scaleLabels: { min: "Very Easy", max: "Very Difficult" },
        alertThreshold: { operator: "gte", value: 7, severity: "medium" },
      },
    ],
  },
  {
    id: "quest-002",
    title: "Daily Symptom Tracker",
    description: "Track your symptoms daily to help your care team monitor your health",
    category: "symptom_tracking",
    frequency: "daily",
    isActive: true,
    createdAt: "2024-01-12T10:00:00Z",
    updatedAt: "2024-01-12T10:00:00Z",
    createdBy: "admin",
    questions: [
      {
        id: "q1",
        text: "How would you rate your overall pain level today?",
        type: "scale",
        required: true,
        scaleMin: 0,
        scaleMax: 10,
        scaleLabels: { min: "No Pain", max: "Worst Pain" },
        alertThreshold: { operator: "gte", value: 7, severity: "high" },
      },
      {
        id: "q2",
        text: "Which symptoms are you experiencing today?",
        type: "multi-choice",
        required: true,
        options: [
          { value: "fatigue", label: "Fatigue" },
          { value: "headache", label: "Headache" },
          { value: "nausea", label: "Nausea", alertTrigger: true, alertSeverity: "medium" },
          { value: "dizziness", label: "Dizziness", alertTrigger: true, alertSeverity: "medium" },
          { value: "shortness_of_breath", label: "Shortness of Breath", alertTrigger: true, alertSeverity: "high" },
          { value: "chest_pain", label: "Chest Pain", alertTrigger: true, alertSeverity: "critical" },
          { value: "none", label: "None of the above" },
        ],
      },
      {
        id: "q3",
        text: "How would you describe your energy level?",
        type: "choice",
        required: true,
        options: [
          { value: "very_low", label: "Very Low", alertTrigger: true, alertSeverity: "medium" },
          { value: "low", label: "Low" },
          { value: "normal", label: "Normal" },
          { value: "high", label: "High" },
        ],
      },
    ],
  },
  {
    id: "quest-003",
    title: "Lifestyle & Wellness Assessment",
    description: "Monthly assessment of your lifestyle habits",
    category: "lifestyle",
    frequency: "monthly",
    isActive: true,
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:00:00Z",
    createdBy: "admin",
    questions: [
      {
        id: "q1",
        text: "How many hours of sleep did you average per night this month?",
        type: "number",
        required: true,
        alertThreshold: { operator: "lt", value: 5, severity: "medium" },
      },
      {
        id: "q2",
        text: "How many days per week did you engage in physical activity (30+ minutes)?",
        type: "number",
        required: true,
      },
      {
        id: "q3",
        text: "How would you rate your stress level this month?",
        type: "scale",
        required: true,
        scaleMin: 1,
        scaleMax: 10,
        scaleLabels: { min: "Very Low Stress", max: "Extremely Stressed" },
        alertThreshold: { operator: "gte", value: 8, severity: "high" },
      },
      {
        id: "q4",
        text: "Have you made any changes to your diet this month?",
        type: "choice",
        required: true,
        options: [
          { value: "improved", label: "Yes, I improved my diet" },
          { value: "same", label: "No changes" },
          { value: "declined", label: "My diet got worse", alertTrigger: true, alertSeverity: "low" },
        ],
      },
    ],
  },
];

const SAMPLE_RESPONSES: QuestionnaireResponse[] = [
  {
    id: "resp-001",
    questionnaireId: "quest-001",
    questionnaireTitle: "Medication Adherence Check",
    patientId: "patient-001",
    patientName: "John Smith",
    completedAt: "2024-01-20T14:30:00Z",
    fhirResourceId: "QuestionnaireResponse/resp-001",
    answers: [
      { questionId: "q1", questionText: "How many doses did you miss?", value: 2, displayValue: "2 doses" },
      { questionId: "q2", questionText: "Side effects?", value: false, displayValue: "No" },
      { questionId: "q4", questionText: "Difficulty taking meds?", value: 3, displayValue: "3/10" },
    ],
    triggeredAlerts: [],
  },
  {
    id: "resp-002",
    questionnaireId: "quest-002",
    questionnaireTitle: "Daily Symptom Tracker",
    patientId: "patient-002",
    patientName: "Mary Johnson",
    completedAt: "2024-01-21T09:15:00Z",
    fhirResourceId: "QuestionnaireResponse/resp-002",
    answers: [
      { questionId: "q1", questionText: "Pain level", value: 8, displayValue: "8/10" },
      { questionId: "q2", questionText: "Symptoms", value: ["fatigue", "shortness_of_breath"], displayValue: "Fatigue, Shortness of Breath" },
      { questionId: "q3", questionText: "Energy level", value: "very_low", displayValue: "Very Low" },
    ],
    triggeredAlerts: [
      {
        questionId: "q1",
        questionText: "Pain level",
        answerValue: "8/10",
        severity: "high",
        message: "Patient reported high pain level (8/10)",
        notifiedCareTeam: true,
        notifiedAt: "2024-01-21T09:16:00Z",
      },
      {
        questionId: "q2",
        questionText: "Symptoms",
        answerValue: "Shortness of Breath",
        severity: "high",
        message: "Patient experiencing shortness of breath",
        notifiedCareTeam: true,
        notifiedAt: "2024-01-21T09:16:00Z",
      },
    ],
  },
];

const questionnaireStore: Questionnaire[] = [...SAMPLE_QUESTIONNAIRES];
const responseStore: QuestionnaireResponse[] = [...SAMPLE_RESPONSES];

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function getQuestionnaires(activeOnly = false): Questionnaire[] {
  if (activeOnly) {
    return questionnaireStore.filter(q => q.isActive);
  }
  return [...questionnaireStore];
}

export function getQuestionnaireById(id: string): Questionnaire | undefined {
  return questionnaireStore.find(q => q.id === id);
}

export async function createQuestionnaire(
  questionnaire: Omit<Questionnaire, "id" | "createdAt" | "updatedAt">,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<Questionnaire> {
  const newQuestionnaire: Questionnaire = {
    ...questionnaire,
    id: generateId("quest"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  questionnaireStore.push(newQuestionnaire);
  
  await logQuestionnaireActivity("create_questionnaire", {
    questionnaireId: newQuestionnaire.id,
    title: newQuestionnaire.title,
    category: newQuestionnaire.category,
  }, userId, ipAddress, userAgent);
  
  return newQuestionnaire;
}

export async function updateQuestionnaire(
  id: string,
  updates: Partial<Questionnaire>,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<Questionnaire | null> {
  const questionnaire = questionnaireStore.find(q => q.id === id);
  if (!questionnaire) return null;
  
  Object.assign(questionnaire, updates, { updatedAt: new Date().toISOString() });
  
  await logQuestionnaireActivity("update_questionnaire", {
    questionnaireId: id,
    updatedFields: Object.keys(updates),
  }, userId, ipAddress, userAgent);
  
  return questionnaire;
}

export async function deleteQuestionnaire(
  id: string,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<boolean> {
  const index = questionnaireStore.findIndex(q => q.id === id);
  if (index === -1) return false;
  
  questionnaireStore.splice(index, 1);
  
  await logQuestionnaireActivity("delete_questionnaire", {
    questionnaireId: id,
  }, userId, ipAddress, userAgent);
  
  return true;
}

export function getPatientResponses(patientId: string): QuestionnaireResponse[] {
  return responseStore.filter(r => r.patientId === patientId);
}

export function getQuestionnaireResponses(questionnaireId: string): QuestionnaireResponse[] {
  return responseStore.filter(r => r.questionnaireId === questionnaireId);
}

export function getAllResponses(): QuestionnaireResponse[] {
  return [...responseStore];
}

function evaluateAlerts(questionnaire: Questionnaire, answers: QuestionAnswer[]): TriggeredAlert[] {
  const alerts: TriggeredAlert[] = [];
  
  for (const answer of answers) {
    const question = questionnaire.questions.find(q => q.id === answer.questionId);
    if (!question) continue;
    
    if (question.alertThreshold && typeof answer.value === "number") {
      const { operator, value, severity } = question.alertThreshold;
      let triggered = false;
      
      switch (operator) {
        case "gt": triggered = answer.value > value; break;
        case "gte": triggered = answer.value >= value; break;
        case "lt": triggered = answer.value < value; break;
        case "lte": triggered = answer.value <= value; break;
        case "eq": triggered = answer.value === value; break;
      }
      
      if (triggered) {
        alerts.push({
          questionId: question.id,
          questionText: question.text,
          answerValue: answer.displayValue,
          severity,
          message: `Alert: ${question.text} - Patient answered ${answer.displayValue}`,
          notifiedCareTeam: false,
        });
      }
    }
    
    if (question.options) {
      const selectedValues = Array.isArray(answer.value) ? answer.value : [answer.value];
      for (const val of selectedValues) {
        const option = question.options.find(o => o.value === val);
        if (option?.alertTrigger) {
          alerts.push({
            questionId: question.id,
            questionText: question.text,
            answerValue: option.label,
            severity: option.alertSeverity || "medium",
            message: `Alert: Patient selected "${option.label}" for ${question.text}`,
            notifiedCareTeam: false,
          });
        }
      }
    }
  }
  
  return alerts;
}

async function notifyCareTeamOfAlerts(
  patientId: string,
  patientName: string,
  alerts: TriggeredAlert[],
  questionnaireTitle: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  try {
    const { createCareTeamTask } = require("./patient-outreach-service");
    
    for (const alert of alerts) {
      const priority = alert.severity === "critical" ? "urgent" : alert.severity === "high" ? "high" : "normal";
      
      await createCareTeamTask({
        patientId,
        patientName,
        type: "follow_up",
        priority,
        title: `Questionnaire Alert: ${alert.severity.toUpperCase()}`,
        description: `${alert.message}\n\nQuestionnaire: ${questionnaireTitle}\nQuestion: ${alert.questionText}\nAnswer: ${alert.answerValue}`,
        dueDate: new Date(Date.now() + (alert.severity === "critical" ? 3600000 : 86400000)).toISOString(),
        assignedTo: "Care Team",
      }, "system", ipAddress, userAgent);
    }
  } catch (e) {
    console.error("[Questionnaire] Failed to notify care team:", e);
  }
}

export async function submitQuestionnaireResponse(
  questionnaireId: string,
  patientId: string,
  patientName: string,
  answers: QuestionAnswer[],
  ipAddress: string,
  userAgent: string
): Promise<{ response: QuestionnaireResponse; alerts: TriggeredAlert[] }> {
  const questionnaire = getQuestionnaireById(questionnaireId);
  if (!questionnaire) {
    throw new Error("Questionnaire not found");
  }
  
  const triggeredAlerts = evaluateAlerts(questionnaire, answers);
  const now = new Date().toISOString();
  
  for (const alert of triggeredAlerts) {
    alert.notifiedCareTeam = true;
    alert.notifiedAt = now;
  }
  
  const fhirResourceId = `QuestionnaireResponse/${generateId("fhir-qr")}`;
  
  const response: QuestionnaireResponse = {
    id: generateId("resp"),
    questionnaireId,
    questionnaireTitle: questionnaire.title,
    patientId,
    patientName,
    answers,
    completedAt: now,
    triggeredAlerts,
    fhirResourceId,
  };
  
  responseStore.push(response);
  
  await logQuestionnaireActivity("submit_response", {
    responseId: response.id,
    questionnaireId,
    questionnaireTitle: questionnaire.title,
    answersCount: answers.length,
    alertsTriggered: triggeredAlerts.length,
    fhirResourceId,
  }, patientId, ipAddress, userAgent);
  
  if (triggeredAlerts.length > 0) {
    await logQuestionnaireActivity("alerts_triggered", {
      responseId: response.id,
      alertCount: triggeredAlerts.length,
      severities: triggeredAlerts.map(a => a.severity),
    }, "system", ipAddress, userAgent);
    
    await notifyCareTeamOfAlerts(patientId, patientName, triggeredAlerts, questionnaire.title, ipAddress, userAgent);
  }
  
  return { response, alerts: triggeredAlerts };
}

export function getResponseById(id: string): QuestionnaireResponse | undefined {
  return responseStore.find(r => r.id === id);
}

export function getAlertsByPatient(patientId: string): TriggeredAlert[] {
  const responses = getPatientResponses(patientId);
  return responses.flatMap(r => r.triggeredAlerts);
}

export function getRecentAlerts(limit = 20): Array<TriggeredAlert & { patientId: string; patientName: string; responseId: string }> {
  const allAlerts: Array<TriggeredAlert & { patientId: string; patientName: string; responseId: string }> = [];
  
  for (const response of responseStore) {
    for (const alert of response.triggeredAlerts) {
      allAlerts.push({
        ...alert,
        patientId: response.patientId,
        patientName: response.patientName,
        responseId: response.id,
      });
    }
  }
  
  return allAlerts
    .sort((a, b) => new Date(b.notifiedAt || "").getTime() - new Date(a.notifiedAt || "").getTime())
    .slice(0, limit);
}

async function logQuestionnaireActivity(
  action: string,
  details: Record<string, unknown>,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: "[REDACTED]",
      userRole: "user",
      action: action.includes("submit") ? "create" : action.includes("delete") ? "delete" : "update",
      resourceType: "Questionnaire",
      resourceId: "[REDACTED]",
      patientId: "[REDACTED]",
      ipAddress: "[REDACTED-IP]",
      userAgent: "[REDACTED-UA]",
      requestPath: "/api/questionnaires",
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: true,
      details: {
        questionnaireAction: action,
        ...details,
      },
    });
  } catch (e) {
    console.error("[Questionnaire] Audit logging failed:", e);
  }
}
