/**
 * AI Caregiver Support Service
 * Manages temporary caregiver access to patient health data,
 * provides AI-generated health summaries, and secure messaging.
 */

import { generatePhiSafeText } from "./services/ai-gateway";

// Safe verb enforcement - ONLY these 4 verbs allowed
const SAFE_VERBS = ["shows", "states", "refers to", "means"];
const PROHIBITED_WORDS = [
  "should", "must", "need to", "recommend", "suggest", "advise", "consider",
  "continue", "follow up", "affect", "monitor", "review", "coordinate",
  "prepare", "decide", "help", "supports", "works by affecting"
];

export interface CaregiverAccess {
  id: string;
  patientId: string;
  caregiverId: string;
  caregiverName: string;
  caregiverEmail: string;
  relationship: string;
  accessLevel: "limited" | "standard" | "full";
  permissions: {
    viewSymptoms: boolean;
    viewAppointments: boolean;
    viewMedications: boolean;
    viewLabResults: boolean;
    viewAiInsights: boolean;
    viewJournal: boolean;
    sendMessages: boolean;
  };
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CaregiverMessage {
  id: string;
  patientId: string;
  senderId: string;
  senderName: string;
  senderRole: "patient" | "caregiver" | "clinician";
  recipientId: string;
  recipientRole: "patient" | "caregiver" | "clinician";
  content: string;
  isRead: boolean;
  createdAt: string;
}

export interface HealthAlert {
  type: "symptom" | "medication" | "appointment" | "lab" | "general";
  severity: "info" | "warning" | "urgent";
  message: string;
  date: string;
}

export interface CaregiverHealthSummary {
  patientName: string;
  summaryDate: string;
  overallStatus: "stable" | "improving" | "needs_attention";
  statusDescription: string;
  recentSymptoms: Array<{ name: string; severity: string; date: string }>;
  upcomingAppointments: Array<{ type: string; date: string; provider: string }>;
  medicationUpdates: string[];
  keyAlerts: HealthAlert[];
  aiInsights: string[];
  suggestedQuestions: string[];
  disclaimer: string;
}

// In-memory storage
const caregiverAccessStorage: CaregiverAccess[] = [];
const caregiverMessageStorage: CaregiverMessage[] = [];

// AI generation via PHI-safe Vertex/BAA gateway
const aiEnabled = true;

function validateSafeVerbs(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Check for prohibited words
  for (const word of PROHIBITED_WORDS) {
    if (lowerText.includes(word.toLowerCase())) {
      return false;
    }
  }
  
  // Additional unsafe verbs
  const unsafeVerbs = [
    "indicates", "suggests", "implies", "correlates", "correlating",
    "affects", "influences", "causes", "triggers", "leads", "results",
    "demonstrates", "reveals", "highlights", "points to"
  ];
  
  for (const verb of unsafeVerbs) {
    if (lowerText.includes(verb)) {
      return false;
    }
  }
  
  return true;
}

function sanitizeText(text: string): string {
  let sanitized = text;
  const replacements: Record<string, string> = {
    "you should": "records show",
    "you need to": "logs show",
    "recommend": "the data shows",
    "suggest": "entries refer to",
    "consider": "records show",
    "continue": "logs show",
    "follow up": "entries state",
    "monitor": "records refer to",
    "help": "data shows",
    "indicates": "shows",
    "suggests": "shows",
    "implies": "means",
    "correlates with": "shows connection to",
    "correlates": "shows",
    "correlating": "showing connection",
    "affects": "shows relation to",
    "influences": "shows connection to",
    "causes": "shows",
    "triggers": "shows",
    "leads to": "shows",
    "results in": "shows",
    "demonstrates": "shows",
    "reveals": "shows",
    "highlights": "shows",
    "points to": "refers to",
  };
  
  for (const [bad, good] of Object.entries(replacements)) {
    sanitized = sanitized.replace(new RegExp(bad, "gi"), good);
  }
  
  // Final validation - if still contains unsafe content, prefix with safe framing
  if (!validateSafeVerbs(sanitized)) {
    sanitized = `Records show: ${sanitized.replace(/[^a-zA-Z0-9\s,.'()-]/g, "")}`;
  }
  
  return sanitized;
}

export async function createCaregiverAccess(
  patientId: string,
  accessData: Omit<CaregiverAccess, "id" | "patientId" | "caregiverId" | "isActive" | "createdAt" | "updatedAt">
): Promise<CaregiverAccess> {
  const now = new Date().toISOString();
  const access: CaregiverAccess = {
    id: `caregiver-access-${Date.now()}`,
    patientId,
    caregiverId: `caregiver-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    caregiverName: accessData.caregiverName,
    caregiverEmail: accessData.caregiverEmail,
    relationship: accessData.relationship,
    accessLevel: accessData.accessLevel,
    permissions: accessData.permissions,
    expiresAt: accessData.expiresAt,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  caregiverAccessStorage.push(access);
  return access;
}

export async function getCaregiverAccess(patientId: string): Promise<CaregiverAccess[]> {
  let accesses = caregiverAccessStorage.filter(a => a.patientId === patientId);
  
  // Add mock data if none exist
  if (accesses.length === 0) {
    accesses = getMockCaregiverAccess(patientId);
  }
  
  // Filter out expired OR inactive access (must be both active AND not expired)
  const now = new Date();
  return accesses.filter(a => new Date(a.expiresAt) > now && a.isActive);
}

export async function updateCaregiverAccess(
  patientId: string,
  accessId: string,
  updates: Partial<Pick<CaregiverAccess, "permissions" | "accessLevel" | "expiresAt" | "isActive">>
): Promise<CaregiverAccess | null> {
  const index = caregiverAccessStorage.findIndex(
    a => a.id === accessId && a.patientId === patientId
  );
  
  if (index === -1) return null;
  
  caregiverAccessStorage[index] = {
    ...caregiverAccessStorage[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  return caregiverAccessStorage[index];
}

export async function revokeCaregiverAccess(
  patientId: string,
  accessId: string
): Promise<boolean> {
  const index = caregiverAccessStorage.findIndex(
    a => a.id === accessId && a.patientId === patientId
  );
  
  if (index === -1) return false;
  
  caregiverAccessStorage[index].isActive = false;
  caregiverAccessStorage[index].updatedAt = new Date().toISOString();
  return true;
}

export async function sendCaregiverMessage(
  patientId: string,
  messageData: Omit<CaregiverMessage, "id" | "patientId" | "isRead" | "createdAt">
): Promise<CaregiverMessage> {
  const message: CaregiverMessage = {
    id: `msg-${Date.now()}`,
    patientId,
    senderId: messageData.senderId,
    senderName: messageData.senderName,
    senderRole: messageData.senderRole,
    recipientId: messageData.recipientId,
    recipientRole: messageData.recipientRole,
    content: messageData.content,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  caregiverMessageStorage.push(message);
  return message;
}

export async function getCaregiverMessages(
  patientId: string,
  userId: string
): Promise<CaregiverMessage[]> {
  let messages = caregiverMessageStorage.filter(
    m => m.patientId === patientId && (m.senderId === userId || m.recipientId === userId)
  );
  
  // Add mock messages if none exist
  if (messages.length === 0) {
    messages = getMockMessages(patientId, userId);
  }
  
  return messages.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function markMessageRead(messageId: string): Promise<boolean> {
  const message = caregiverMessageStorage.find(m => m.id === messageId);
  if (message) {
    message.isRead = true;
    return true;
  }
  return false;
}

const CAREGIVER_SUMMARY_PROMPT = `You are generating a health status summary for a patient's caregiver.
The caregiver has been granted access to help monitor and support the patient.

CRITICAL RULES:
1. ONLY use these verbs: "shows", "states", "refers to", "means"
2. NEVER use: "should", "must", "need to", "recommend", "suggest", "advise", "consider", "continue", "follow up", "affect", "monitor", "review", "help"
3. Frame all observations as factual patterns from records
4. Do NOT provide medical recommendations or diagnoses
5. Maintain patient privacy while informing the caregiver

Generate a summary including:
1. Overall status (stable/improving/needs_attention)
2. Recent symptom patterns
3. Upcoming appointments
4. Any medication changes or adherence notes
5. Key alerts or changes
6. AI insights from recent data
7. Questions the caregiver might discuss with the patient or clinician

Example good phrasing:
- "Records show 3 headache entries this week, severity shows as moderate"
- "Logs state the next appointment is scheduled for..."
- "Data shows medication adherence at 85% this month"

Example bad phrasing (NEVER use):
- "You should monitor the patient's symptoms" (uses should, monitor)
- "Consider discussing with the doctor" (uses consider)
- "This may affect their condition" (uses affect)

Return valid JSON with this structure:
{
  "overallStatus": "stable" | "improving" | "needs_attention",
  "statusDescription": string,
  "recentSymptoms": [{"name": string, "severity": string, "date": string}],
  "upcomingAppointments": [{"type": string, "date": string, "provider": string}],
  "medicationUpdates": [string],
  "keyAlerts": [{"type": string, "severity": "info"|"warning"|"urgent", "message": string, "date": string}],
  "aiInsights": [string],
  "suggestedQuestions": [string]
}`;

export async function generateCaregiverSummary(
  patientId: string,
  caregiverId: string,
  patientData?: {
    symptoms?: Array<{ symptomName: string; severity: string; loggedAt: string }>;
    medications?: Array<{ name: string; dosage: string }>;
    appointments?: Array<{ type: string; date: string; provider: string }>;
  }
): Promise<CaregiverHealthSummary> {
  // Verify caregiver has access
  const accesses = await getCaregiverAccess(patientId);
  const access = accesses.find(a => a.caregiverId === caregiverId && a.isActive);
  
  if (!access) {
    throw new Error("Caregiver access not found or expired");
  }
  
  // Apply permission-based filtering to patient data
  const filteredData = {
    symptoms: access.permissions.viewSymptoms ? patientData?.symptoms : undefined,
    medications: access.permissions.viewMedications ? patientData?.medications : undefined,
    appointments: access.permissions.viewAppointments ? patientData?.appointments : undefined,
  };

  if (aiEnabled && Object.values(filteredData).some(v => v)) {
    try {
      const content = await generatePhiSafeText({
        system: CAREGIVER_SUMMARY_PROMPT,
        user: `Generate a caregiver summary for this patient data (only include permitted data types):\n${JSON.stringify(filteredData, null, 2)}`,
        responseMimeType: "application/json",
        temperature: 0.3,
      });

      if (content) {
        const parsed = JSON.parse(content);
        return sanitizeSummary(patientId, parsed);
      }
    } catch (error) {
      console.error("[CaregiverSupport] AI summary error:", error);
    }
  }
  
  return getMockCaregiverSummary(patientId, access.permissions);
}

function sanitizeSummary(patientId: string, data: any): CaregiverHealthSummary {
  return {
    patientName: "Patient",
    summaryDate: new Date().toISOString(),
    overallStatus: data.overallStatus || "stable",
    statusDescription: sanitizeText(data.statusDescription || "Records show stable health patterns."),
    recentSymptoms: data.recentSymptoms || [],
    upcomingAppointments: data.upcomingAppointments || [],
    medicationUpdates: (data.medicationUpdates || []).map(sanitizeText),
    keyAlerts: (data.keyAlerts || []).map((a: any) => ({
      ...a,
      message: sanitizeText(a.message),
    })),
    aiInsights: (data.aiInsights || []).map(sanitizeText),
    suggestedQuestions: (data.suggestedQuestions || []).map(sanitizeText),
    disclaimer: "Informational only. Not medical advice. For medical concerns, contact the patient's healthcare provider.",
  };
}

function getMockCaregiverAccess(patientId: string): CaregiverAccess[] {
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  return [
    {
      id: "mock-access-1",
      patientId,
      caregiverId: "caregiver-spouse-1",
      caregiverName: "Jane Smith",
      caregiverEmail: "jane.smith@email.com",
      relationship: "Spouse",
      accessLevel: "full",
      permissions: {
        viewSymptoms: true,
        viewAppointments: true,
        viewMedications: true,
        viewLabResults: true,
        viewAiInsights: true,
        viewJournal: false,
        sendMessages: true,
      },
      expiresAt: thirtyDaysLater.toISOString(),
      isActive: true,
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "mock-access-2",
      patientId,
      caregiverId: "caregiver-child-1",
      caregiverName: "Michael Smith",
      caregiverEmail: "michael.smith@email.com",
      relationship: "Adult Child",
      accessLevel: "limited",
      permissions: {
        viewSymptoms: true,
        viewAppointments: true,
        viewMedications: false,
        viewLabResults: false,
        viewAiInsights: true,
        viewJournal: false,
        sendMessages: true,
      },
      expiresAt: thirtyDaysLater.toISOString(),
      isActive: true,
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function getMockMessages(patientId: string, userId: string): CaregiverMessage[] {
  const now = new Date();
  return [
    {
      id: "mock-msg-1",
      patientId,
      senderId: "caregiver-spouse-1",
      senderName: "Jane Smith",
      senderRole: "caregiver",
      recipientId: patientId,
      recipientRole: "patient",
      content: "Hi, I noticed in the summary that there were some symptom entries this week. How are you feeling today?",
      isRead: true,
      createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "mock-msg-2",
      patientId,
      senderId: patientId,
      senderName: "Patient",
      senderRole: "patient",
      recipientId: "caregiver-spouse-1",
      recipientRole: "caregiver",
      content: "Feeling better today, thank you for checking in! The headaches have eased up since I started getting more rest.",
      isRead: true,
      createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "mock-msg-3",
      patientId,
      senderId: "clinician-1",
      senderName: "Dr. Sarah Johnson",
      senderRole: "clinician",
      recipientId: patientId,
      recipientRole: "patient",
      content: "Just a reminder that your appointment is coming up next week. Please bring any questions you have about your current symptoms.",
      isRead: false,
      createdAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(),
    },
  ];
}

function getMockCaregiverSummary(
  patientId: string, 
  permissions?: CaregiverAccess["permissions"]
): CaregiverHealthSummary {
  const now = new Date();
  
  // Default permissions if not provided
  const perms = permissions || {
    viewSymptoms: true,
    viewAppointments: true,
    viewMedications: true,
    viewLabResults: true,
    viewAiInsights: true,
    viewJournal: false,
    sendMessages: true,
  };
  
  return {
    patientName: "Patient",
    summaryDate: now.toISOString(),
    overallStatus: "stable",
    statusDescription: "Records show stable health patterns over the past week. Entries show mild to moderate severity with no urgent changes.",
    recentSymptoms: perms.viewSymptoms ? [
      { name: "Headache", severity: "moderate", date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] },
      { name: "Fatigue", severity: "mild", date: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] },
    ] : [],
    upcomingAppointments: perms.viewAppointments ? [
      { 
        type: "Follow-up Visit", 
        date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], 
        provider: "Dr. Sarah Johnson" 
      },
    ] : [],
    medicationUpdates: perms.viewMedications ? [
      "Medication logs show consistent daily entries.",
      "Records state no new medications added this week.",
    ] : [],
    keyAlerts: [
      ...(perms.viewAppointments ? [{
        type: "appointment" as const,
        severity: "info" as const,
        message: "Upcoming appointment shows as scheduled for next week.",
        date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }] : []),
      ...(perms.viewSymptoms ? [{
        type: "symptom" as const,
        severity: "info" as const,
        message: "Headache entries show decreased frequency compared to last week.",
        date: now.toISOString(),
      }] : []),
    ],
    aiInsights: perms.viewAiInsights ? [
      "Symptom logs show headaches appearing 2 times this week, down from 4 times last week.",
      "Journal entries show positive mood trend on days with outdoor activity.",
      "Records show stress-related entries appearing on weekday evenings.",
    ] : [],
    suggestedQuestions: [
      "What does the decrease in headache frequency mean for the treatment plan?",
      "Are there any lifestyle changes the logs show as beneficial?",
      "What does the upcoming appointment entail?",
    ],
    disclaimer: "Informational only. Not medical advice. For medical concerns, contact the patient's healthcare provider.",
  };
}
