// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import OpenAI from "openai";
import { getAuditLogger } from "./integrations/factory";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export type OutreachType = 
  | "medication_reminder"
  | "appointment_followup"
  | "care_plan_check"
  | "wellness_check"
  | "lab_results"
  | "preventive_care"
  | "custom";

export type OutreachPriority = "low" | "medium" | "high" | "critical";
export type OutreachStatus = "pending" | "sent" | "delivered" | "read" | "responded" | "failed";
export type CampaignStatus = "draft" | "active" | "paused" | "completed";

export interface OutreachCriteria {
  id: string;
  name: string;
  description: string;
  type: "overdue_tasks" | "critical_flags" | "inactive_patients" | "care_gaps" | "custom";
  conditions: CriteriaCondition[];
  enabled: boolean;
}

export interface CriteriaCondition {
  field: string;
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "days_since";
  value: string | number | boolean;
}

export interface OutreachCampaign {
  id: string;
  name: string;
  description: string;
  type: OutreachType;
  criteria: OutreachCriteria;
  messageTemplate: string;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  patientsReached: number;
  responsesReceived: number;
}

export interface PatientOutreachMessage {
  id: string;
  campaignId: string;
  patientId: string;
  patientName: string;
  type: OutreachType;
  subject: string;
  content: string;
  personalizedContent?: string;
  priority: OutreachPriority;
  status: OutreachStatus;
  scheduledAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  respondedAt?: string;
  responseContent?: string;
  failureReason?: string;
}

export interface CareTeamTask {
  id: string;
  patientId: string;
  patientName: string;
  assignedTo: string;
  assignedToName: string;
  type: string;
  description: string;
  priority: OutreachPriority;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  dueDate: string;
  createdAt: string;
  completedAt?: string;
  notes?: string;
  relatedOutreachId?: string;
}

export interface IdentifiedPatient {
  patientId: string;
  patientName: string;
  reason: string;
  priority: OutreachPriority;
  suggestedOutreachType: OutreachType;
  dataPoints: Array<{ label: string; value: string; flag?: "warning" | "critical" }>;
  aiRecommendation?: string;
}

export interface OutreachAnalytics {
  totalCampaigns: number;
  activeCampaigns: number;
  messagesSent: number;
  messagesDelivered: number;
  responsesReceived: number;
  responseRate: number;
  tasksCreated: number;
  tasksCompleted: number;
}

const SAMPLE_CRITERIA: OutreachCriteria[] = [
  {
    id: "criteria-001",
    name: "Overdue Medication Refills",
    description: "Patients whose medication refills are overdue by 7+ days",
    type: "overdue_tasks",
    conditions: [
      { field: "medication.refillDueDate", operator: "days_since", value: 7 },
      { field: "medication.status", operator: "equals", value: "active" },
    ],
    enabled: true,
  },
  {
    id: "criteria-002",
    name: "Critical Lab Results",
    description: "Patients with critical lab results in the past 48 hours",
    type: "critical_flags",
    conditions: [
      { field: "labResult.interpretation", operator: "equals", value: "critical" },
      { field: "labResult.date", operator: "days_since", value: -2 },
    ],
    enabled: true,
  },
  {
    id: "criteria-003",
    name: "Inactive Patients",
    description: "Patients with no visits or communications in 90+ days",
    type: "inactive_patients",
    conditions: [
      { field: "lastContact", operator: "days_since", value: 90 },
    ],
    enabled: true,
  },
  {
    id: "criteria-004",
    name: "Care Gap - Diabetes A1C",
    description: "Diabetic patients overdue for A1C testing",
    type: "care_gaps",
    conditions: [
      { field: "condition.name", operator: "contains", value: "diabetes" },
      { field: "labResult.type", operator: "equals", value: "A1C" },
      { field: "labResult.date", operator: "days_since", value: 90 },
    ],
    enabled: true,
  },
];

const SAMPLE_CAMPAIGNS: OutreachCampaign[] = [
  {
    id: "campaign-001",
    name: "Medication Refill Reminders",
    description: "Automated reminders for patients with overdue medication refills",
    type: "medication_reminder",
    criteria: SAMPLE_CRITERIA[0],
    messageTemplate: "Hello {patientName}, this is a reminder that your {medicationName} prescription may need a refill. Please contact your pharmacy or provider to ensure you don't run out of your medication.",
    status: "active",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-20T14:30:00Z",
    lastRunAt: "2024-01-25T08:00:00Z",
    patientsReached: 45,
    responsesReceived: 12,
  },
  {
    id: "campaign-002",
    name: "Post-Visit Follow-up",
    description: "Follow-up messages after appointments",
    type: "appointment_followup",
    criteria: SAMPLE_CRITERIA[2],
    messageTemplate: "Hello {patientName}, we hope you're doing well after your recent visit with {providerName}. If you have any questions about your care plan or need to schedule a follow-up, please let us know.",
    status: "active",
    createdAt: "2024-01-10T09:00:00Z",
    updatedAt: "2024-01-18T11:00:00Z",
    lastRunAt: "2024-01-24T09:00:00Z",
    patientsReached: 78,
    responsesReceived: 23,
  },
  {
    id: "campaign-003",
    name: "Wellness Check-In",
    description: "Proactive wellness check for inactive patients",
    type: "wellness_check",
    criteria: SAMPLE_CRITERIA[2],
    messageTemplate: "Hello {patientName}, we noticed it's been a while since your last visit. We wanted to check in and see how you're doing. Please reach out if you'd like to schedule an appointment.",
    status: "paused",
    createdAt: "2024-01-05T08:00:00Z",
    updatedAt: "2024-01-22T16:00:00Z",
    patientsReached: 120,
    responsesReceived: 35,
  },
];

const SAMPLE_MESSAGES: PatientOutreachMessage[] = [
  {
    id: "msg-001",
    campaignId: "campaign-001",
    patientId: "patient-001",
    patientName: "John Smith",
    type: "medication_reminder",
    subject: "Medication Refill Reminder",
    content: "Hello John, this is a reminder that your Metformin prescription may need a refill.",
    priority: "medium",
    status: "delivered",
    scheduledAt: "2024-01-25T08:00:00Z",
    sentAt: "2024-01-25T08:01:00Z",
    deliveredAt: "2024-01-25T08:02:00Z",
  },
  {
    id: "msg-002",
    campaignId: "campaign-002",
    patientId: "patient-002",
    patientName: "Mary Johnson",
    type: "appointment_followup",
    subject: "How Are You Doing After Your Visit?",
    content: "Hello Mary, we hope you're doing well after your recent visit with Dr. Garcia.",
    priority: "low",
    status: "read",
    scheduledAt: "2024-01-24T09:00:00Z",
    sentAt: "2024-01-24T09:01:00Z",
    deliveredAt: "2024-01-24T09:02:00Z",
    readAt: "2024-01-24T10:30:00Z",
  },
  {
    id: "msg-003",
    campaignId: "campaign-001",
    patientId: "patient-003",
    patientName: "Robert Davis",
    type: "medication_reminder",
    subject: "Important: Medication Refill Needed",
    content: "Hello Robert, this is an important reminder that your Lisinopril prescription needs a refill.",
    priority: "high",
    status: "responded",
    scheduledAt: "2024-01-25T08:00:00Z",
    sentAt: "2024-01-25T08:01:00Z",
    deliveredAt: "2024-01-25T08:02:00Z",
    readAt: "2024-01-25T08:30:00Z",
    respondedAt: "2024-01-25T09:00:00Z",
    responseContent: "Thank you for the reminder. I called my pharmacy and they're processing the refill.",
  },
];

const SAMPLE_TASKS: CareTeamTask[] = [
  {
    id: "task-001",
    patientId: "patient-001",
    patientName: "John Smith",
    assignedTo: "nurse-1",
    assignedToName: "Nurse Sarah",
    type: "phone_call",
    description: "Follow up on medication adherence concerns",
    priority: "high",
    status: "pending",
    dueDate: "2024-01-26T17:00:00Z",
    createdAt: "2024-01-25T10:00:00Z",
    relatedOutreachId: "msg-001",
  },
  {
    id: "task-002",
    patientId: "patient-004",
    patientName: "Sarah Wilson",
    assignedTo: "cc-1",
    assignedToName: "Care Coordinator Amy",
    type: "care_coordination",
    description: "Schedule specialist referral follow-up",
    priority: "medium",
    status: "in_progress",
    dueDate: "2024-01-27T12:00:00Z",
    createdAt: "2024-01-24T14:00:00Z",
    notes: "Patient expressed interest in seeing endocrinologist",
  },
];

const campaignStore: OutreachCampaign[] = [...SAMPLE_CAMPAIGNS];
const messageStore: PatientOutreachMessage[] = [...SAMPLE_MESSAGES];
const taskStore: CareTeamTask[] = [...SAMPLE_TASKS];
const criteriaStore: OutreachCriteria[] = [...SAMPLE_CRITERIA];

export function getCampaigns(): OutreachCampaign[] {
  return campaignStore;
}

export function getCampaignById(id: string): OutreachCampaign | undefined {
  return campaignStore.find((c) => c.id === id);
}

export async function createCampaign(
  campaign: Omit<OutreachCampaign, "id" | "createdAt" | "updatedAt" | "patientsReached" | "responsesReceived">,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<OutreachCampaign> {
  const newCampaign: OutreachCampaign = {
    ...campaign,
    id: `campaign-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    patientsReached: 0,
    responsesReceived: 0,
  };

  campaignStore.push(newCampaign);

  await logOutreachActivity(
    "create_campaign",
    { campaignId: newCampaign.id, campaignName: newCampaign.name },
    userId,
    ipAddress,
    userAgent
  );

  return newCampaign;
}

export async function updateCampaignStatus(
  campaignId: string,
  status: CampaignStatus,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<OutreachCampaign | null> {
  const campaign = campaignStore.find((c) => c.id === campaignId);
  if (!campaign) return null;

  const oldStatus = campaign.status;
  campaign.status = status;
  campaign.updatedAt = new Date().toISOString();

  await logOutreachActivity(
    "update_campaign_status",
    { campaignId, oldStatus, newStatus: status },
    userId,
    ipAddress,
    userAgent
  );

  return campaign;
}

export function getOutreachMessages(filters?: {
  campaignId?: string;
  patientId?: string;
  status?: OutreachStatus;
}): PatientOutreachMessage[] {
  let messages = messageStore;

  if (filters?.campaignId) {
    messages = messages.filter((m) => m.campaignId === filters.campaignId);
  }
  if (filters?.patientId) {
    messages = messages.filter((m) => m.patientId === filters.patientId);
  }
  if (filters?.status) {
    messages = messages.filter((m) => m.status === filters.status);
  }

  return messages.sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());
}

export async function sendOutreachMessage(
  message: Omit<PatientOutreachMessage, "id" | "sentAt" | "deliveredAt" | "status">,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<PatientOutreachMessage> {
  const newMessage: PatientOutreachMessage = {
    ...message,
    id: `msg-${Date.now()}`,
    status: "sent",
    sentAt: new Date().toISOString(),
  };

  messageStore.push(newMessage);

  const campaign = campaignStore.find((c) => c.id === message.campaignId);
  if (campaign) {
    campaign.patientsReached++;
    campaign.lastRunAt = new Date().toISOString();
  }

  await logOutreachActivity(
    "send_message",
    { 
      messageId: newMessage.id, 
      campaignId: message.campaignId,
      patientId: "[REDACTED]",
      type: message.type,
      priority: message.priority,
    },
    userId,
    ipAddress,
    userAgent
  );

  return newMessage;
}

export function getCareTeamTasks(filters?: {
  assignedTo?: string;
  status?: string;
  patientId?: string;
}): CareTeamTask[] {
  let tasks = taskStore;

  if (filters?.assignedTo) {
    tasks = tasks.filter((t) => t.assignedTo === filters.assignedTo);
  }
  if (filters?.status) {
    tasks = tasks.filter((t) => t.status === filters.status);
  }
  if (filters?.patientId) {
    tasks = tasks.filter((t) => t.patientId === filters.patientId);
  }

  return tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}

export async function createCareTeamTask(
  task: Omit<CareTeamTask, "id" | "createdAt" | "status">,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<CareTeamTask> {
  const newTask: CareTeamTask = {
    ...task,
    id: `task-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  taskStore.push(newTask);

  await logOutreachActivity(
    "create_task",
    { 
      taskId: newTask.id,
      patientId: "[REDACTED]",
      assignedTo: task.assignedTo,
      type: task.type,
      priority: task.priority,
    },
    userId,
    ipAddress,
    userAgent
  );

  return newTask;
}

export async function updateTaskStatus(
  taskId: string,
  status: CareTeamTask["status"],
  notes: string | undefined,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<CareTeamTask | null> {
  const task = taskStore.find((t) => t.id === taskId);
  if (!task) return null;

  const oldStatus = task.status;
  task.status = status;
  if (notes) task.notes = notes;
  if (status === "completed") task.completedAt = new Date().toISOString();

  await logOutreachActivity(
    "update_task_status",
    { taskId, oldStatus, newStatus: status },
    userId,
    ipAddress,
    userAgent
  );

  return task;
}

export function getOutreachCriteria(): OutreachCriteria[] {
  return criteriaStore;
}

export async function identifyPatientsForOutreach(
  criteriaId?: string,
  userId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<IdentifiedPatient[]> {
  const patients: IdentifiedPatient[] = [
    {
      patientId: "patient-001",
      patientName: "John Smith",
      reason: "Medication refill overdue by 10 days",
      priority: "high",
      suggestedOutreachType: "medication_reminder",
      dataPoints: [
        { label: "Medication", value: "Metformin 500mg" },
        { label: "Last Refill", value: "Dec 15, 2023", flag: "warning" },
        { label: "Days Overdue", value: "10", flag: "critical" },
      ],
    },
    {
      patientId: "patient-004",
      patientName: "Sarah Wilson",
      reason: "No contact in 95 days",
      priority: "medium",
      suggestedOutreachType: "wellness_check",
      dataPoints: [
        { label: "Last Visit", value: "Oct 22, 2023" },
        { label: "Last Message", value: "Oct 25, 2023", flag: "warning" },
        { label: "Days Inactive", value: "95", flag: "warning" },
      ],
    },
    {
      patientId: "patient-005",
      patientName: "Michael Brown",
      reason: "Critical lab result: High glucose",
      priority: "critical",
      suggestedOutreachType: "lab_results",
      dataPoints: [
        { label: "Test", value: "Fasting Glucose" },
        { label: "Result", value: "285 mg/dL", flag: "critical" },
        { label: "Reference Range", value: "70-100 mg/dL" },
        { label: "Test Date", value: "Jan 24, 2024" },
      ],
    },
    {
      patientId: "patient-006",
      patientName: "Jennifer Martinez",
      reason: "A1C test overdue (last: 4 months ago)",
      priority: "medium",
      suggestedOutreachType: "preventive_care",
      dataPoints: [
        { label: "Condition", value: "Type 2 Diabetes" },
        { label: "Last A1C", value: "Sep 20, 2023", flag: "warning" },
        { label: "Last A1C Result", value: "7.2%" },
        { label: "Recommended Interval", value: "3 months" },
      ],
    },
  ];

  if (criteriaId) {
    const criteria = criteriaStore.find((c) => c.id === criteriaId);
    if (criteria) {
      return patients.filter((p) => {
        switch (criteria.type) {
          case "overdue_tasks":
            return p.suggestedOutreachType === "medication_reminder";
          case "critical_flags":
            return p.priority === "critical";
          case "inactive_patients":
            return p.suggestedOutreachType === "wellness_check";
          case "care_gaps":
            return p.suggestedOutreachType === "preventive_care";
          default:
            return true;
        }
      });
    }
  }

  if (userId && ipAddress && userAgent) {
    await logOutreachActivity(
      "identify_patients",
      { criteriaId: criteriaId || "all", patientsFound: patients.length },
      userId,
      ipAddress,
      userAgent
    );
  }

  return patients;
}

export async function generatePersonalizedMessage(
  patientId: string,
  patientName: string,
  outreachType: OutreachType,
  context: Record<string, string>,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<{ subject: string; content: string }> {
  const systemPrompt = `You are a compassionate healthcare communication assistant. Generate personalized patient outreach messages that are:
- Warm and professional in tone
- Clear and easy to understand
- Actionable with specific next steps
- HIPAA-compliant (no detailed PHI in the message)
- Brief (under 100 words)

IMPORTANT: You are generating communication messages ONLY. Do NOT provide:
- Medical advice or recommendations
- Diagnosis suggestions
- Treatment recommendations
- Drug interaction warnings
- Clinical interpretations

Simply create a caring, professional message that encourages the patient to contact their care team.`;

  const contextString = Object.entries(context)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const userPrompt = `Generate a ${outreachType.replace("_", " ")} message for patient "${patientName}".

Context:
${contextString}

Return a JSON object with "subject" and "content" fields.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0]?.message?.content || "{}");

    await logOutreachActivity(
      "generate_message",
      { 
        patientId: "[REDACTED]",
        outreachType,
        aiGenerated: true,
      },
      userId,
      ipAddress,
      userAgent
    );

    return {
      subject: result.subject || `${outreachType.replace("_", " ")} - Action Needed`,
      content: result.content || `Hello ${patientName}, please contact your care team at your earliest convenience.`,
    };
  } catch (error) {
    console.error("[PatientOutreach] AI message generation failed:", error);
    return {
      subject: `${outreachType.replace("_", " ")} - Action Needed`,
      content: `Hello ${patientName}, please contact your care team at your earliest convenience regarding your ${outreachType.replace("_", " ")}.`,
    };
  }
}

export async function runCampaign(
  campaignId: string,
  userId: string,
  ipAddress: string,
  userAgent: string
): Promise<{ messagesGenerated: number; tasksCreated: number }> {
  const campaign = campaignStore.find((c) => c.id === campaignId);
  if (!campaign || campaign.status !== "active") {
    throw new Error("Campaign not found or not active");
  }

  const patients = await identifyPatientsForOutreach(campaign.criteria.id);
  let messagesGenerated = 0;
  let tasksCreated = 0;

  for (const patient of patients) {
    const context: Record<string, string> = {};
    patient.dataPoints.forEach((dp) => {
      context[dp.label] = dp.value;
    });

    const { subject, content } = await generatePersonalizedMessage(
      patient.patientId,
      patient.patientName,
      campaign.type,
      context,
      userId,
      ipAddress,
      userAgent
    );

    await sendOutreachMessage(
      {
        campaignId,
        patientId: patient.patientId,
        patientName: patient.patientName,
        type: campaign.type,
        subject,
        content,
        personalizedContent: content,
        priority: patient.priority,
        scheduledAt: new Date().toISOString(),
      },
      userId,
      ipAddress,
      userAgent
    );
    messagesGenerated++;

    if (patient.priority === "critical" || patient.priority === "high") {
      await createCareTeamTask(
        {
          patientId: patient.patientId,
          patientName: patient.patientName,
          assignedTo: "nurse-1",
          assignedToName: "Nurse Sarah",
          type: "follow_up",
          description: `Follow up on ${campaign.type.replace("_", " ")} for ${patient.patientName}: ${patient.reason}`,
          priority: patient.priority,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          relatedOutreachId: `msg-${Date.now()}`,
        },
        userId,
        ipAddress,
        userAgent
      );
      tasksCreated++;
    }
  }

  campaign.lastRunAt = new Date().toISOString();
  campaign.patientsReached += messagesGenerated;

  await logOutreachActivity(
    "run_campaign",
    { 
      campaignId,
      campaignName: campaign.name,
      messagesGenerated,
      tasksCreated,
    },
    userId,
    ipAddress,
    userAgent
  );

  return { messagesGenerated, tasksCreated };
}

export function getOutreachAnalytics(): OutreachAnalytics {
  const totalCampaigns = campaignStore.length;
  const activeCampaigns = campaignStore.filter((c) => c.status === "active").length;
  const messagesSent = messageStore.filter((m) => m.status !== "pending").length;
  const messagesDelivered = messageStore.filter((m) => 
    ["delivered", "read", "responded"].includes(m.status)
  ).length;
  const responsesReceived = messageStore.filter((m) => m.status === "responded").length;
  const responseRate = messagesSent > 0 ? (responsesReceived / messagesSent) * 100 : 0;
  const tasksCreated = taskStore.length;
  const tasksCompleted = taskStore.filter((t) => t.status === "completed").length;

  return {
    totalCampaigns,
    activeCampaigns,
    messagesSent,
    messagesDelivered,
    responsesReceived,
    responseRate: Math.round(responseRate * 10) / 10,
    tasksCreated,
    tasksCompleted,
  };
}

async function logOutreachActivity(
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
      userRole: "system",
      action: "create",
      resourceType: "PatientOutreach",
      resourceId: "[REDACTED]",
      patientId: "[REDACTED]",
      ipAddress: "[REDACTED-IP]",
      userAgent: "[REDACTED-UA]",
      requestPath: "/api/patient-outreach",
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: false,
      details: {
        outreachAction: action,
        ...details,
      },
    });
  } catch (e) {
    console.error("[PatientOutreach] Audit logging failed:", e);
  }
}

console.log("[PatientOutreach] Service initialized");
