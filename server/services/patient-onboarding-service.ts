import type {
  PatientOnboardingWorkflow,
  PatientOnboardingStep,
  PatientOnboardingStepType,
  PatientOnboardingStatus,
  PatientOnboardingWelcomeMessage,
  PatientOnboardingCareTeamAssignment,
  PatientOnboardingMetrics,
  PatientOnboardingAuditEntry,
  PatientOnboardingDataCollectionForm,
  StartPatientOnboardingInput,
  SubmitPatientOnboardingStepInput,
  AssignPatientOnboardingTaskInput,
  CareTeamRole,
} from "@shared/schema";
import { createTask } from "./careTeamCollaboration";
import { getAuditLogger } from "./integrations/factory";

const onboardingWorkflows: Map<string, PatientOnboardingWorkflow> = new Map();
const welcomeMessages: Map<string, PatientOnboardingWelcomeMessage> = new Map();
const onboardingAuditLog: Map<string, PatientOnboardingAuditEntry> = new Map();

function generateId(): string {
  return `onb-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

const stepDefinitions: Record<PatientOnboardingStepType, { title: string; description: string; isRequired: boolean }> = {
  welcome: { title: "Welcome", description: "Welcome to Tabula Medica! Let's get you set up.", isRequired: true },
  identity_verification: { title: "Identity Verification", description: "Verify your identity for secure access.", isRequired: true },
  demographics: { title: "Demographics", description: "Tell us about yourself.", isRequired: true },
  insurance: { title: "Insurance Information", description: "Add your insurance details.", isRequired: false },
  medical_history: { title: "Medical History", description: "Share your medical background.", isRequired: true },
  ehr_connection: { title: "Connect Health Records", description: "Connect your existing health record sources.", isRequired: false },
  consent: { title: "Consent & Privacy", description: "Review and accept our privacy policies.", isRequired: true },
  emergency_contact: { title: "Emergency Contact", description: "Add an emergency contact.", isRequired: true },
  care_preferences: { title: "Care Preferences", description: "Set your communication and care preferences.", isRequired: false },
  complete: { title: "Complete", description: "Your onboarding is complete!", isRequired: true },
};

const dataCollectionForms: Record<PatientOnboardingStepType, PatientOnboardingDataCollectionForm> = {
  welcome: { stepType: "welcome", fields: [] },
  identity_verification: {
    stepType: "identity_verification",
    fields: [
      { name: "dateOfBirth", label: "Date of Birth", type: "date", required: true, fhirMapping: "Patient.birthDate" },
      { name: "ssn4", label: "Last 4 digits of SSN", type: "text", required: true },
      { name: "driversLicense", label: "Driver's License Number", type: "text", required: false },
    ],
  },
  demographics: {
    stepType: "demographics",
    fields: [
      { name: "firstName", label: "First Name", type: "text", required: true, fhirMapping: "Patient.name.given" },
      { name: "lastName", label: "Last Name", type: "text", required: true, fhirMapping: "Patient.name.family" },
      { name: "gender", label: "Gender", type: "select", required: true, options: ["male", "female", "other", "unknown"], fhirMapping: "Patient.gender" },
      { name: "phone", label: "Phone Number", type: "phone", required: true, fhirMapping: "Patient.telecom" },
      { name: "email", label: "Email Address", type: "email", required: true, fhirMapping: "Patient.telecom" },
      { name: "address", label: "Home Address", type: "address", required: true, fhirMapping: "Patient.address" },
    ],
  },
  insurance: {
    stepType: "insurance",
    fields: [
      { name: "insuranceProvider", label: "Insurance Provider", type: "text", required: false },
      { name: "memberId", label: "Member ID", type: "text", required: false },
      { name: "groupNumber", label: "Group Number", type: "text", required: false },
    ],
  },
  medical_history: {
    stepType: "medical_history",
    fields: [
      { name: "currentConditions", label: "Current Medical Conditions", type: "text", required: true },
      { name: "currentMedications", label: "Current Medications", type: "text", required: true },
      { name: "allergies", label: "Known Allergies", type: "text", required: true },
      { name: "surgeries", label: "Past Surgeries", type: "text", required: false },
      { name: "familyHistory", label: "Family Medical History", type: "text", required: false },
    ],
  },
  ehr_connection: { stepType: "ehr_connection", fields: [] },
  consent: {
    stepType: "consent",
    fields: [
      { name: "privacyPolicyAccepted", label: "I accept the Privacy Policy", type: "checkbox", required: true },
      { name: "termsAccepted", label: "I accept the Terms of Service", type: "checkbox", required: true },
      { name: "dataUseConsent", label: "I consent to data use for care coordination", type: "checkbox", required: true },
    ],
  },
  emergency_contact: {
    stepType: "emergency_contact",
    fields: [
      { name: "ecName", label: "Emergency Contact Name", type: "text", required: true },
      { name: "ecRelationship", label: "Relationship", type: "text", required: true },
      { name: "ecPhone", label: "Emergency Contact Phone", type: "phone", required: true },
    ],
  },
  care_preferences: {
    stepType: "care_preferences",
    fields: [
      { name: "communicationPreference", label: "Preferred Contact Method", type: "select", required: false, options: ["email", "phone", "sms", "in_app"] },
      { name: "languagePreference", label: "Preferred Language", type: "text", required: false },
      { name: "accessibilityNeeds", label: "Accessibility Needs", type: "text", required: false },
    ],
  },
  complete: { stepType: "complete", fields: [] },
};

const stepOrder: PatientOnboardingStepType[] = [
  "welcome",
  "identity_verification",
  "demographics",
  "insurance",
  "medical_history",
  "ehr_connection",
  "consent",
  "emergency_contact",
  "care_preferences",
  "complete",
];

async function logOnboardingAudit(
  workflowId: string,
  patientId: string,
  action: PatientOnboardingAuditEntry["action"],
  actorId: string,
  actorRole: string,
  stepType: PatientOnboardingStepType | undefined,
  metadata: Record<string, unknown>,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  const safeMetadata = { ...metadata };
  const sensitiveFields = ["ssn4", "driversLicense", "dateOfBirth", "phone", "email", "address"];
  for (const field of sensitiveFields) {
    if (safeMetadata[field]) {
      safeMetadata[field] = "[REDACTED]";
    }
  }

  const entry: PatientOnboardingAuditEntry = {
    id: generateId(),
    workflowId,
    patientId: "[REDACTED]",
    action,
    stepType,
    actorId,
    actorRole,
    metadata: safeMetadata,
    timestamp: new Date().toISOString(),
    ipAddress: ipAddress.includes(".") ? "[REDACTED-IP]" : ipAddress,
    userAgent,
  };
  onboardingAuditLog.set(entry.id, entry);

  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: actorId,
      userRole: actorRole,
      action: "create",
      resourceType: "PatientOnboarding",
      resourceId: workflowId,
      patientId: "[REDACTED]",
      ipAddress: ipAddress.includes(".") ? "[REDACTED-IP]" : ipAddress,
      userAgent,
      requestPath: "/api/patient-onboarding",
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: true,
      details: {
        onboardingAction: action,
        stepType: stepType || "none",
        ...safeMetadata,
      },
    });
  } catch (e) {
    console.error("[PatientOnboarding] Audit logging failed:", e);
  }
}

export async function startOnboardingWorkflow(
  input: StartPatientOnboardingInput,
  actorId: string,
  actorRole: string,
  ipAddress: string,
  userAgent: string
): Promise<PatientOnboardingWorkflow> {
  const workflowId = generateId();
  const now = new Date().toISOString();

  const steps: PatientOnboardingStep[] = stepOrder.map((stepType, index) => ({
    id: generateId(),
    workflowId,
    stepType,
    stepOrder: index + 1,
    status: (index === 0 ? "in_progress" : "not_started") as PatientOnboardingStatus,
    title: stepDefinitions[stepType].title,
    description: stepDefinitions[stepType].description,
    isRequired: stepDefinitions[stepType].isRequired,
    startedAt: index === 0 ? now : undefined,
  }));

  const workflow: PatientOnboardingWorkflow = {
    id: workflowId,
    patientId: input.patientId,
    currentStepOrder: 1,
    overallStatus: "in_progress",
    steps,
    welcomeMessagesSent: [],
    careTeamTasksCreated: [],
    startedAt: now,
    lastUpdatedAt: now,
    assignedCareTeamMember: input.assignedCareTeamMember,
    notes: input.notes,
  };

  onboardingWorkflows.set(workflowId, workflow);

  if (input.sendWelcomeMessage !== false) {
    const message = await sendWelcomeMessage(workflowId, input.patientId, "welcome");
    workflow.welcomeMessagesSent.push(message.id);
  }

  await logOnboardingAudit(
    workflowId,
    input.patientId,
    "workflow_started",
    actorId,
    actorRole,
    undefined,
    { assignedTo: input.assignedCareTeamMember },
    ipAddress,
    userAgent
  );

  return workflow;
}

async function sendWelcomeMessage(
  workflowId: string,
  patientId: string,
  type: PatientOnboardingWelcomeMessage["type"]
): Promise<PatientOnboardingWelcomeMessage> {
  const messages: Record<PatientOnboardingWelcomeMessage["type"], { subject: string; body: string }> = {
    welcome: {
      subject: "Welcome to Tabula Medica!",
      body: "We're excited to have you join us. Let's get your health records organized and accessible. Complete your onboarding to unlock all features.",
    },
    reminder: {
      subject: "Complete Your Onboarding",
      body: "You're almost there! Complete your onboarding setup to access all of your health information in one place.",
    },
    completion: {
      subject: "Onboarding Complete!",
      body: "Congratulations! Your onboarding is complete. You now have full access to view and manage your health records.",
    },
  };

  const message: PatientOnboardingWelcomeMessage = {
    id: generateId(),
    patientId,
    type,
    channel: "in_app",
    subject: messages[type].subject,
    body: messages[type].body,
    sentAt: new Date().toISOString(),
    deliveredAt: new Date().toISOString(),
  };

  welcomeMessages.set(message.id, message);
  return message;
}

export async function submitOnboardingStep(
  input: SubmitPatientOnboardingStepInput,
  actorId: string,
  actorRole: string,
  ipAddress: string,
  userAgent: string
): Promise<{ workflow: PatientOnboardingWorkflow; step: PatientOnboardingStep }> {
  const workflow = onboardingWorkflows.get(input.workflowId);
  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const step = workflow.steps.find((s) => s.stepType === input.stepType);
  if (!step) {
    throw new Error("Step not found");
  }

  const now = new Date().toISOString();

  if (input.skip) {
    if (step.isRequired) {
      throw new Error("Cannot skip required step");
    }
    step.status = "skipped";
    step.skipReason = input.skipReason;
  } else {
    step.collectedData = input.data as Record<string, unknown>;
    step.status = "completed";
  }
  step.completedAt = now;

  const nextStepIndex = step.stepOrder;
  if (nextStepIndex < workflow.steps.length) {
    const nextStep = workflow.steps[nextStepIndex];
    nextStep.status = "in_progress";
    nextStep.startedAt = now;
    workflow.currentStepOrder = nextStep.stepOrder;
  }

  if (step.stepType === "complete" || workflow.currentStepOrder === 10) {
    workflow.overallStatus = "completed";
    workflow.completedAt = now;
    await sendWelcomeMessage(input.workflowId, workflow.patientId, "completion");
  }

  workflow.lastUpdatedAt = now;

  await logOnboardingAudit(
    input.workflowId,
    workflow.patientId,
    input.skip ? "step_skipped" : "step_completed",
    actorId,
    actorRole,
    input.stepType,
    { dataFields: Object.keys(input.data || {}) },
    ipAddress,
    userAgent
  );

  return { workflow, step };
}

export async function assignCareTeamTask(
  input: AssignPatientOnboardingTaskInput,
  actorId: string,
  actorRole: string,
  ipAddress: string,
  userAgent: string
): Promise<PatientOnboardingCareTeamAssignment> {
  const workflow = onboardingWorkflows.get(input.workflowId);
  if (!workflow) {
    throw new Error("Workflow not found");
  }

  const taskTitles: Record<AssignPatientOnboardingTaskInput["taskType"], string> = {
    review_demographics: "Review Patient Demographics",
    verify_insurance: "Verify Insurance Information",
    review_medical_history: "Review Medical History",
    initial_assessment: "Complete Initial Patient Assessment",
    schedule_visit: "Schedule Initial Visit",
    follow_up: "Follow Up on Onboarding Progress",
  };

  const task = createTask(
    {
      carePlanId: `onboarding-${input.workflowId}`,
      patientId: workflow.patientId,
      title: taskTitles[input.taskType],
      description: input.notes || `Task assigned during patient onboarding: ${input.taskType}`,
      priority: input.priority || "normal",
      status: "pending",
      assignedTo: input.assignedTo,
      assignedBy: actorId,
      dueDate: input.dueDate,
      category: "documentation",
    },
    "Onboarding System",
    actorRole as CareTeamRole
  );

  workflow.careTeamTasksCreated.push(task.id);
  workflow.lastUpdatedAt = new Date().toISOString();

  const assignment: PatientOnboardingCareTeamAssignment = {
    workflowId: input.workflowId,
    patientId: workflow.patientId,
    taskType: input.taskType,
    assignedTo: input.assignedTo,
    assignedBy: actorId,
    priority: input.priority || "normal",
    dueDate: input.dueDate,
    notes: input.notes,
  };

  await logOnboardingAudit(
    input.workflowId,
    workflow.patientId,
    "task_assigned",
    actorId,
    actorRole,
    undefined,
    { taskType: input.taskType, taskId: task.id, assignedTo: input.assignedTo },
    ipAddress,
    userAgent
  );

  return assignment;
}

export function getOnboardingWorkflow(workflowId: string): PatientOnboardingWorkflow | undefined {
  return onboardingWorkflows.get(workflowId);
}

export function getPatientOnboardingWorkflows(patientId: string): PatientOnboardingWorkflow[] {
  return Array.from(onboardingWorkflows.values()).filter((w) => w.patientId === patientId);
}

export function getAllOnboardingWorkflows(): PatientOnboardingWorkflow[] {
  return Array.from(onboardingWorkflows.values()).sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
}

export function getDataCollectionForm(stepType: PatientOnboardingStepType): PatientOnboardingDataCollectionForm {
  return dataCollectionForms[stepType];
}

export function getOnboardingMetrics(): PatientOnboardingMetrics {
  const workflows = Array.from(onboardingWorkflows.values());
  const completed = workflows.filter((w) => w.overallStatus === "completed");
  const inProgress = workflows.filter((w) => w.overallStatus === "in_progress");

  const stepCompletionRates: Record<PatientOnboardingStepType, number> = {} as Record<PatientOnboardingStepType, number>;
  for (const sType of stepOrder) {
    const total = workflows.length;
    const completedSteps = workflows.filter((w) =>
      w.steps.find((s) => s.stepType === sType && (s.status === "completed" || s.status === "skipped"))
    ).length;
    stepCompletionRates[sType] = total > 0 ? (completedSteps / total) * 100 : 0;
  }

  const completionTimes = completed
    .filter((w) => w.completedAt)
    .map((w) => (new Date(w.completedAt!).getTime() - new Date(w.startedAt).getTime()) / (1000 * 60 * 60));
  const avgTime = completionTimes.length > 0 ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length : 0;

  const taskCounts: Record<string, number> = {};
  for (const workflow of workflows) {
    for (const taskId of workflow.careTeamTasksCreated) {
      taskCounts[taskId] = (taskCounts[taskId] || 0) + 1;
    }
  }

  const abandonedCount = workflows.filter(
    (w) => w.overallStatus === "not_started" && new Date(w.startedAt) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;

  return {
    totalWorkflows: workflows.length,
    completedWorkflows: completed.length,
    inProgressWorkflows: inProgress.length,
    abandonedWorkflows: abandonedCount,
    averageCompletionTimeHours: avgTime,
    stepCompletionRates,
    taskAssignmentCounts: taskCounts,
  };
}

export function getOnboardingAuditLog(workflowId?: string, limit: number = 50): PatientOnboardingAuditEntry[] {
  let entries = Array.from(onboardingAuditLog.values());
  if (workflowId) {
    entries = entries.filter((e) => e.workflowId === workflowId);
  }
  return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
}

console.log("[PatientOnboarding] Service initialized");
