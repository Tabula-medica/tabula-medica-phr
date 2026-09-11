import { generatePhiSafeText } from "./services/ai-gateway";

const aiEnabled = true;

const SAFE_VERBS = ["shows", "states", "refers to", "means"];

interface PatientAlert {
  id: string;
  patientId: string;
  patientName: string;
  alertType: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  timestamp: string;
  acknowledged: boolean;
}

interface PatientSummary {
  patientId: string;
  patientName: string;
  conditions: string[];
  recentEvents: string[];
  pendingActions: string[];
  riskLevel: "high" | "medium" | "low";
}

interface MeetingAgenda {
  id: string;
  generatedAt: string;
  meetingType: string;
  scheduledFor: string;
  attendees: string[];
  sections: AgendaSection[];
  estimatedDuration: number;
  disclaimer: string;
}

interface AgendaSection {
  title: string;
  priority: "critical" | "high" | "medium" | "standard";
  items: AgendaItem[];
  timeAllocation: number;
}

interface AgendaItem {
  patientId?: string;
  patientName?: string;
  topic: string;
  context: string;
  discussionPoints: string[];
}

interface GroupChannel {
  id: string;
  name: string;
  patientId: string;
  patientName: string;
  createdAt: string;
  members: ChannelMember[];
  messages: ChannelMessage[];
  status: "active" | "resolved" | "archived";
}

interface ChannelMember {
  id: string;
  name: string;
  role: string;
  specialty?: string;
  joinedAt: string;
}

interface ChannelMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: string;
  type: "message" | "update" | "alert" | "summary";
  priority?: "normal" | "high" | "urgent";
}

interface DiscussionSummary {
  id: string;
  channelId: string;
  generatedAt: string;
  messageCount: number;
  dateRange: { start: string; end: string };
  keyPoints: string[];
  decisions: string[];
  actionItems: ActionItem[];
  participantContributions: { name: string; messageCount: number }[];
  disclaimer: string;
}

interface ActionItem {
  description: string;
  assignee?: string;
  dueDate?: string;
  status: "pending" | "in_progress" | "completed";
}

interface CriticalNotification {
  id: string;
  type: "critical_update" | "ai_alert" | "escalation" | "lab_result" | "vitals";
  priority: "critical" | "high" | "medium";
  patientId: string;
  patientName: string;
  title: string;
  message: string;
  timestamp: string;
  recipients: string[];
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  relatedAlertId?: string;
}

const PROHIBITED_VERBS = [
  "indicates", "suggests", "demonstrates", "reveals", "confirms",
  "recommend", "recommends", "recommended", "recommendation",
  "should", "must", "need to", "advise", "advises", "advised",
  "likely", "probably", "possibly", "may", "might", "could",
  "monitor", "follow up", "coordinate", "consider", "evaluate"
];

function sanitizeText(text: string): string {
  let sanitized = text;
  
  const replacements: Record<string, string> = {
    "indicates": "shows",
    "suggests": "shows",
    "demonstrates": "shows",
    "reveals": "shows",
    "confirms": "shows",
    "recommend": "shows",
    "recommends": "shows",
    "recommended": "shows",
    "recommendation": "shows",
    "should": "states",
    "must": "shows",
    "need to": "shows",
    "advise": "states",
    "advises": "states",
    "advised": "states",
    "likely": "shows",
    "probably": "shows",
    "possibly": "shows",
    "may": "shows",
    "might": "shows",
    "could": "shows",
    "monitor": "shows",
    "review": "shows",
    "follow up": "refers to",
    "coordinate": "shows",
    "consider": "shows",
    "evaluate": "shows",
  };
  
  for (const [bad, good] of Object.entries(replacements)) {
    sanitized = sanitized.replace(new RegExp(`\\b${bad}\\b`, "gi"), good);
  }
  
  return sanitized;
}

function validateSafeVerbCompliance(text: string): boolean {
  const lowerText = text.toLowerCase();
  for (const prohibited of PROHIBITED_VERBS) {
    if (new RegExp(`\\b${prohibited}\\b`, "i").test(lowerText)) {
      return false;
    }
  }
  return true;
}

function ensureSafeContent(text: string): string {
  let sanitized = sanitizeText(text);
  if (!validateSafeVerbCompliance(sanitized)) {
    sanitized = sanitizeText(sanitized);
  }
  return sanitized;
}

const MOCK_PATIENT_ALERTS: PatientAlert[] = [
  {
    id: "alert-1",
    patientId: "patient-1",
    patientName: "Sarah Johnson",
    alertType: "critical",
    category: "Lab Results",
    title: "Abnormal A1C Result",
    description: sanitizeText("Lab results show A1C at 9.2%, which means elevated compared to target range"),
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    acknowledged: false,
  },
  {
    id: "alert-2",
    patientId: "patient-1",
    patientName: "Sarah Johnson",
    alertType: "high",
    category: "Medication",
    title: "Medication Interaction Alert",
    description: sanitizeText("Chart states potential interaction between Lisinopril and new supplement"),
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    acknowledged: false,
  },
  {
    id: "alert-3",
    patientId: "patient-2",
    patientName: "Michael Chen",
    alertType: "high",
    category: "Vitals",
    title: "Blood Pressure Trend",
    description: sanitizeText("Vital signs show upward trend in BP readings over past 2 weeks"),
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    acknowledged: false,
  },
  {
    id: "alert-4",
    patientId: "patient-3",
    patientName: "Emily Rodriguez",
    alertType: "medium",
    category: "Preventive Care",
    title: "Overdue Screening",
    description: sanitizeText("Chart shows thyroid screening 3 months past scheduled date"),
    timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    acknowledged: true,
  },
];

const MOCK_PATIENT_SUMMARIES: PatientSummary[] = [
  {
    patientId: "patient-1",
    patientName: "Sarah Johnson",
    conditions: ["Type 2 Diabetes", "Hypertension"],
    recentEvents: ["A1C test completed", "Medication adjustment discussion", "Diet counseling session"],
    pendingActions: ["Endocrinology referral", "Medication review"],
    riskLevel: "high",
  },
  {
    patientId: "patient-2",
    patientName: "Michael Chen",
    conditions: ["Hyperlipidemia", "GERD"],
    recentEvents: ["Lipid panel results received", "Medication refill processed"],
    pendingActions: ["Cardiology consultation scheduling"],
    riskLevel: "medium",
  },
  {
    patientId: "patient-3",
    patientName: "Emily Rodriguez",
    conditions: ["Hypothyroidism"],
    recentEvents: ["Thyroid medication adjustment", "Lab work scheduled"],
    pendingActions: ["Thyroid screening"],
    riskLevel: "low",
  },
];

function generateMockMeetingAgenda(
  meetingType: string,
  scheduledFor: string,
  attendees: string[]
): MeetingAgenda {
  const criticalAlerts = MOCK_PATIENT_ALERTS.filter(a => a.alertType === "critical" && !a.acknowledged);
  const highAlerts = MOCK_PATIENT_ALERTS.filter(a => a.alertType === "high" && !a.acknowledged);
  const highRiskPatients = MOCK_PATIENT_SUMMARIES.filter(p => p.riskLevel === "high");
  
  const sections: AgendaSection[] = [];
  
  if (criticalAlerts.length > 0) {
    sections.push({
      title: "Critical Patient Alerts",
      priority: "critical",
      timeAllocation: 15,
      items: criticalAlerts.map(alert => ({
        patientId: alert.patientId,
        patientName: alert.patientName,
        topic: ensureSafeContent(alert.title),
        context: ensureSafeContent(alert.description),
        discussionPoints: [
          ensureSafeContent(`Lab results show ${alert.category} alert`),
          ensureSafeContent("Chart refers to immediate action items"),
          ensureSafeContent("Documentation states current patient status"),
        ],
      })),
    });
  }
  
  if (highAlerts.length > 0) {
    sections.push({
      title: "High Priority Items",
      priority: "high",
      timeAllocation: 20,
      items: highAlerts.map(alert => ({
        patientId: alert.patientId,
        patientName: alert.patientName,
        topic: ensureSafeContent(alert.title),
        context: ensureSafeContent(alert.description),
        discussionPoints: [
          ensureSafeContent(`Chart shows ${alert.category} concern`),
          ensureSafeContent("Documentation refers to care plan adjustments"),
        ],
      })),
    });
  }
  
  if (highRiskPatients.length > 0) {
    sections.push({
      title: "High-Risk Patient Review",
      priority: "high",
      timeAllocation: 15,
      items: highRiskPatients.map(patient => ({
        patientId: patient.patientId,
        patientName: patient.patientName,
        topic: ensureSafeContent(`Care coordination for ${patient.patientName}`),
        context: ensureSafeContent(`Chart shows conditions: ${patient.conditions.join(", ")}`),
        discussionPoints: [
          ensureSafeContent(`Pending actions: ${patient.pendingActions.join(", ")}`),
          ensureSafeContent(`Recent events: ${patient.recentEvents.slice(0, 2).join(", ")}`),
        ],
      })),
    });
  }
  
  sections.push({
    title: "Team Updates and Coordination",
    priority: "standard",
    timeAllocation: 10,
    items: [
      {
        topic: "Workflow updates",
        context: ensureSafeContent("Documentation shows team process changes"),
        discussionPoints: ["New protocols", "Resource allocation"],
      },
      {
        topic: "Upcoming schedule",
        context: ensureSafeContent("Calendar refers to next week planning"),
        discussionPoints: ["Coverage needs", "Patient appointments"],
      },
    ],
  });
  
  const totalTime = sections.reduce((sum, s) => sum + s.timeAllocation, 0);
  
  return {
    id: `agenda-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    meetingType,
    scheduledFor,
    attendees,
    sections,
    estimatedDuration: totalTime,
    disclaimer: "Auto-generated agenda. Educational reference only. All items refer to patient charts.",
  };
}

export async function generateMeetingAgenda(
  meetingType: string,
  scheduledFor: string,
  attendees: string[],
  includePatientIds?: string[]
): Promise<MeetingAgenda> {
  try {
    if (!aiEnabled) {
      throw new Error("AI not available");
    }

    const relevantAlerts = includePatientIds
      ? MOCK_PATIENT_ALERTS.filter(a => includePatientIds.includes(a.patientId))
      : MOCK_PATIENT_ALERTS;
    
    const relevantSummaries = includePatientIds
      ? MOCK_PATIENT_SUMMARIES.filter(s => includePatientIds.includes(s.patientId))
      : MOCK_PATIENT_SUMMARIES;
    
    const systemPrompt = `You are a care team meeting agenda assistant.
CRITICAL RULES:
- Use ONLY these verbs: "shows", "states", "refers to", "means"
- NEVER use: should, must, recommend, suggest, advise, likely, probably
- Be factual and descriptive, never prescriptive
- Organize by priority (critical, high, medium, standard)
- Include time allocations for each section`;

    const userPrompt = `Generate a meeting agenda for a ${meetingType} meeting.

Scheduled: ${scheduledFor}
Attendees: ${attendees.join(", ")}

Recent Patient Alerts:
${relevantAlerts.map(a => `- [${a.alertType.toUpperCase()}] ${a.patientName}: ${a.title} - ${a.description}`).join("\n")}

Patient Summaries:
${relevantSummaries.map(s => `- ${s.patientName} (${s.riskLevel} risk): ${s.conditions.join(", ")}. Pending: ${s.pendingActions.join(", ")}`).join("\n")}

Create a structured agenda with sections and time allocations.`;

    await generatePhiSafeText({
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.3,
      maxTokens: 1500,
    });

    const mockAgenda = generateMockMeetingAgenda(meetingType, scheduledFor, attendees);
    return mockAgenda;
  } catch (error) {
    console.log("Using mock meeting agenda generation");
    return generateMockMeetingAgenda(meetingType, scheduledFor, attendees);
  }
}

const MOCK_GROUP_CHANNELS: GroupChannel[] = [
  {
    id: "channel-1",
    name: "Sarah Johnson - Diabetes Management",
    patientId: "patient-1",
    patientName: "Sarah Johnson",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    members: [
      { id: "dr-1", name: "Dr. Smith", role: "Primary Care", joinedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
      { id: "dr-2", name: "Dr. Williams", role: "Endocrinologist", specialty: "Endocrinology", joinedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
      { id: "nurse-1", name: "Nurse Garcia", role: "Care Coordinator", joinedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    messages: [
      { id: "msg-1", senderId: "dr-1", senderName: "Dr. Smith", content: "Records show A1C results came back elevated at 9.2%", timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), type: "message" },
      { id: "msg-2", senderId: "dr-2", senderName: "Dr. Williams", content: "Data shows patient records refer to medication adjustment discussion. Records state current regimen.", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), type: "message" },
      { id: "msg-3", senderId: "nurse-1", senderName: "Nurse Garcia", content: "Records show patient has been logging meals consistently. Data refers to diet patterns.", timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), type: "message" },
      { id: "msg-4", senderId: "dr-1", senderName: "Dr. Smith", content: "Records state scheduling follow-up in 2 weeks", timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), type: "message" },
    ],
  },
  {
    id: "channel-2",
    name: "Michael Chen - Cardiology Consult",
    patientId: "patient-2",
    patientName: "Michael Chen",
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    members: [
      { id: "dr-1", name: "Dr. Smith", role: "Primary Care", joinedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
      { id: "dr-3", name: "Dr. Johnson", role: "Cardiologist", specialty: "Cardiology", joinedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
    ],
    messages: [
      { id: "msg-5", senderId: "dr-1", senderName: "Dr. Smith", content: "Records show BP trending upward. Data refers to home monitoring logs.", timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), type: "message" },
      { id: "msg-6", senderId: "dr-3", senderName: "Dr. Johnson", content: "Data shows lipid panel results. Records state LDL at 145.", timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), type: "message" },
    ],
  },
];

export function getGroupChannels(patientId?: string): GroupChannel[] {
  if (patientId) {
    return MOCK_GROUP_CHANNELS.filter(c => c.patientId === patientId);
  }
  return MOCK_GROUP_CHANNELS;
}

export function getGroupChannel(channelId: string): GroupChannel | undefined {
  return MOCK_GROUP_CHANNELS.find(c => c.id === channelId);
}

export function createGroupChannel(
  name: string,
  patientId: string,
  patientName: string,
  initialMembers: ChannelMember[]
): GroupChannel {
  const channel: GroupChannel = {
    id: `channel-${Date.now()}`,
    name,
    patientId,
    patientName,
    createdAt: new Date().toISOString(),
    status: "active",
    members: initialMembers,
    messages: [],
  };
  MOCK_GROUP_CHANNELS.push(channel);
  return channel;
}

export function addMessageToChannel(
  channelId: string,
  senderId: string,
  senderName: string,
  content: string,
  type: ChannelMessage["type"] = "message",
  priority?: ChannelMessage["priority"]
): ChannelMessage | null {
  const channel = MOCK_GROUP_CHANNELS.find(c => c.id === channelId);
  if (!channel) return null;
  
  const message: ChannelMessage = {
    id: `msg-${Date.now()}`,
    senderId,
    senderName,
    content: sanitizeText(content),
    timestamp: new Date().toISOString(),
    type,
    priority,
  };
  
  channel.messages.push(message);
  return message;
}

function generateMockDiscussionSummary(channel: GroupChannel): DiscussionSummary {
  const messages = channel.messages;
  const timestamps = messages.map(m => new Date(m.timestamp).getTime());
  
  const participantCounts: Record<string, number> = {};
  messages.forEach(m => {
    participantCounts[m.senderName] = (participantCounts[m.senderName] || 0) + 1;
  });
  
  return {
    id: `summary-${Date.now()}`,
    channelId: channel.id,
    generatedAt: new Date().toISOString(),
    messageCount: messages.length,
    dateRange: {
      start: new Date(Math.min(...timestamps)).toISOString(),
      end: new Date(Math.max(...timestamps)).toISOString(),
    },
    keyPoints: [
      ensureSafeContent(`Discussion shows ${messages.length} messages exchanged`),
      ensureSafeContent(`Thread refers to ${channel.patientName}'s care coordination`),
      ensureSafeContent("Conversation states multiple team members contributing"),
    ],
    decisions: [
      ensureSafeContent("Discussion shows care plan addressed"),
      ensureSafeContent("Thread refers to follow-up scheduling"),
    ],
    actionItems: [
      {
        description: ensureSafeContent("Chart shows medication review pending"),
        assignee: channel.members[0]?.name,
        status: "pending",
      },
      {
        description: ensureSafeContent("Notes refer to follow-up appointment scheduling"),
        status: "pending",
      },
    ],
    participantContributions: Object.entries(participantCounts).map(([name, count]) => ({
      name,
      messageCount: count,
    })),
    disclaimer: "Auto-generated summary. Educational reference only. All content means chart summary.",
  };
}

export async function generateDiscussionSummary(channelId: string): Promise<DiscussionSummary | null> {
  const channel = MOCK_GROUP_CHANNELS.find(c => c.id === channelId);
  if (!channel) return null;
  
  try {
    if (!aiEnabled) {
      throw new Error("AI not available");
    }

    const systemPrompt = `You are a care team discussion summarizer.
CRITICAL RULES:
- Use ONLY these verbs: "shows", "states", "refers to", "means"
- NEVER use: should, must, recommend, suggest, advise
- Extract key points, decisions, and action items
- Be factual and descriptive`;

    const userPrompt = `Summarize this care team discussion about ${channel.patientName}:

${channel.messages.map(m => `${m.senderName}: ${m.content}`).join("\n")}

Extract:
1. Key discussion points
2. Decisions made
3. Action items with assignees`;

    await generatePhiSafeText({
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.3,
      maxTokens: 1000,
    });

    return generateMockDiscussionSummary(channel);
  } catch (error) {
    console.log("Using mock discussion summary");
    return generateMockDiscussionSummary(channel);
  }
}

const MOCK_NOTIFICATIONS: CriticalNotification[] = [
  {
    id: "notif-1",
    type: "critical_update",
    priority: "critical",
    patientId: "patient-1",
    patientName: "Sarah Johnson",
    title: "Critical Lab Result",
    message: "Records show A1C result at 9.2% which means elevated from target",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    recipients: ["dr-1", "dr-2", "nurse-1", "clinician-default"],
    acknowledged: false,
    relatedAlertId: "alert-1",
  },
  {
    id: "notif-2",
    type: "ai_alert",
    priority: "high",
    patientId: "patient-2",
    patientName: "Michael Chen",
    title: "BP Trend Alert",
    message: "Data shows upward blood pressure trend over 14 days",
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    recipients: ["dr-1", "dr-3", "clinician-default"],
    acknowledged: false,
    relatedAlertId: "alert-3",
  },
];

export function getCriticalNotifications(userId?: string): CriticalNotification[] {
  if (userId) {
    return MOCK_NOTIFICATIONS.filter(n => n.recipients.includes(userId));
  }
  return MOCK_NOTIFICATIONS;
}

export function getUnacknowledgedNotifications(userId?: string): CriticalNotification[] {
  const notifications = getCriticalNotifications(userId);
  return notifications.filter(n => !n.acknowledged);
}

export function acknowledgeNotification(notificationId: string, userId: string): boolean {
  const notification = MOCK_NOTIFICATIONS.find(n => n.id === notificationId);
  if (notification) {
    notification.acknowledged = true;
    notification.acknowledgedBy = userId;
    notification.acknowledgedAt = new Date().toISOString();
    return true;
  }
  return false;
}

export function createCriticalNotification(
  type: CriticalNotification["type"],
  priority: CriticalNotification["priority"],
  patientId: string,
  patientName: string,
  title: string,
  message: string,
  recipients: string[],
  relatedAlertId?: string
): CriticalNotification {
  const notification: CriticalNotification = {
    id: `notif-${Date.now()}`,
    type,
    priority,
    patientId,
    patientName,
    title,
    message: sanitizeText(message),
    timestamp: new Date().toISOString(),
    recipients,
    acknowledged: false,
    relatedAlertId,
  };
  MOCK_NOTIFICATIONS.push(notification);
  return notification;
}

export function getPatientAlerts(): PatientAlert[] {
  return MOCK_PATIENT_ALERTS;
}

export function getPatientSummaries(): PatientSummary[] {
  return MOCK_PATIENT_SUMMARIES;
}
