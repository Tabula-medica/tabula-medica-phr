import { randomUUID } from "crypto";
import { logPhiAccess } from "../security/hipaa-audit";

const NO_CDS_DISCLAIMER = "DISCLAIMER: This collaboration feature is for care coordination and informational purposes only. It does NOT constitute clinical decision support and should NOT replace clinical judgment.";

export interface Provider {
  id: string;
  name: string;
  email: string;
  role: "physician" | "nurse" | "specialist" | "care_coordinator" | "pharmacist" | "admin";
  specialty?: string;
  facility?: string;
  npi?: string;
}

export interface ProviderMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientIds: string[];
  patientId?: string;
  patientName?: string;
  subject?: string;
  content: string;
  priority: "normal" | "urgent" | "critical";
  isEncrypted: boolean;
  attachments: {
    id: string;
    name: string;
    type: string;
    size: number;
  }[];
  readBy: {
    providerId: string;
    readAt: string;
  }[];
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageConversation {
  id: string;
  participantIds: string[];
  participants: {
    id: string;
    name: string;
    role: string;
  }[];
  patientId?: string;
  patientName?: string;
  subject: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCounts: Record<string, number>;
  isArchived: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SharedPatientSummary {
  id: string;
  patientId: string;
  patientName: string;
  patientDob?: string;
  sharedById: string;
  sharedByName: string;
  sharedByRole: string;
  sharedWithProviders: {
    providerId: string;
    providerName: string;
    providerRole: string;
    accessLevel: "view" | "comment" | "edit";
    grantedAt: string;
  }[];
  summaryType: "full" | "medications" | "conditions" | "recent_visits" | "lab_results" | "care_plan";
  summaryContent: {
    conditions?: { name: string; status: string; icdCode?: string }[];
    medications?: { name: string; dosage: string; frequency: string; prescriber?: string }[];
    recentVisits?: { date: string; type: string; provider: string; summary: string }[];
    labResults?: { date: string; test: string; value: string; unit: string; status: string }[];
    carePlan?: { goal: string; interventions: string[]; status: string }[];
    notes?: string;
  };
  accessLog: {
    id: string;
    providerId: string;
    providerName: string;
    action: "view" | "comment" | "export" | "edit";
    timestamp: string;
    ipAddress?: string;
  }[];
  expiresAt?: string;
  isRevoked: boolean;
  revokedAt?: string;
  revokedReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SharedCarePlan {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  description: string;
  status: "draft" | "active" | "completed" | "on_hold" | "cancelled";
  priority: "low" | "medium" | "high" | "critical";
  createdById: string;
  createdByName: string;
  createdByRole: string;
  assignedProviders: {
    providerId: string;
    providerName: string;
    providerRole: string;
    accessLevel: "view" | "edit" | "admin";
    assignedAt: string;
  }[];
  goals: CarePlanGoal[];
  tasks: CarePlanTask[];
  notes: CarePlanNote[];
  startDate: string;
  targetEndDate?: string;
  actualEndDate?: string;
  auditLog: CarePlanAuditEntry[];
  version: number;
  lastModifiedById: string;
  lastModifiedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CarePlanGoal {
  id: string;
  carePlanId: string;
  title: string;
  description: string;
  targetDate?: string;
  status: "not_started" | "in_progress" | "achieved" | "not_achieved" | "deferred";
  priority: "low" | "medium" | "high";
  measurableOutcome?: string;
  progress: number;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CarePlanTask {
  id: string;
  carePlanId: string;
  goalId?: string;
  title: string;
  description: string;
  assignedToId: string;
  assignedToName: string;
  assignedToRole: string;
  assignedById: string;
  assignedByName: string;
  status: "pending" | "in_progress" | "completed" | "blocked" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate?: string;
  completedAt?: string;
  completedById?: string;
  completedByName?: string;
  notes?: string;
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CarePlanNote {
  id: string;
  carePlanId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  noteType: "general" | "progress" | "concern" | "recommendation" | "outcome";
  isPrivate: boolean;
  visibleToRoles?: string[];
  mentions: { providerId: string; providerName: string }[];
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
  isDeleted: boolean;
}

export interface CarePlanAuditEntry {
  id: string;
  carePlanId: string;
  action: "created" | "updated" | "task_added" | "task_updated" | "goal_added" | "goal_updated" | 
          "note_added" | "provider_added" | "provider_removed" | "status_changed" | "viewed" | "exported";
  performedById: string;
  performedByName: string;
  performedByRole: string;
  details: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
}

export interface CollaborationAuditEntry {
  id: string;
  entityType: "message" | "patient_summary" | "care_plan" | "task";
  entityId: string;
  action: string;
  performedById: string;
  performedByName: string;
  performedByRole: string;
  patientId?: string;
  patientName?: string;
  details: Record<string, any>;
  ipAddress?: string;
  timestamp: string;
}

const providers: Map<string, Provider> = new Map();
const messages: Map<string, ProviderMessage> = new Map();
const conversations: Map<string, MessageConversation> = new Map();
const sharedSummaries: Map<string, SharedPatientSummary> = new Map();
const carePlans: Map<string, SharedCarePlan> = new Map();
const collaborationAudit: Map<string, CollaborationAuditEntry> = new Map();

function initializeSampleData() {
  const sampleProviders: Provider[] = [
    { id: "prov-001", name: "Dr. Sarah Chen", email: "sarah.chen@hospital.org", role: "physician", specialty: "Internal Medicine", facility: "City General Hospital", npi: "1234567890" },
    { id: "prov-002", name: "Dr. Michael Torres", email: "m.torres@hospital.org", role: "specialist", specialty: "Cardiology", facility: "City General Hospital", npi: "0987654321" },
    { id: "prov-003", name: "Nurse Emily Johnson", email: "e.johnson@hospital.org", role: "nurse", facility: "City General Hospital" },
    { id: "prov-004", name: "Dr. Lisa Park", email: "l.park@hospital.org", role: "specialist", specialty: "Endocrinology", facility: "Downtown Medical Center" },
    { id: "prov-005", name: "James Wilson, PharmD", email: "j.wilson@hospital.org", role: "pharmacist", facility: "City General Hospital" },
  ];

  sampleProviders.forEach(p => providers.set(p.id, p));

  const conv1: MessageConversation = {
    id: "conv-001",
    participantIds: ["prov-001", "prov-002"],
    participants: [
      { id: "prov-001", name: "Dr. Sarah Chen", role: "physician" },
      { id: "prov-002", name: "Dr. Michael Torres", role: "specialist" },
    ],
    patientId: "patient-001",
    patientName: "John Smith",
    subject: "Cardiology Consult Request",
    lastMessageAt: new Date().toISOString(),
    lastMessagePreview: "Patient has been experiencing chest pain. Need cardiology evaluation.",
    unreadCounts: { "prov-002": 1 },
    isArchived: false,
    isPinned: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  };
  conversations.set(conv1.id, conv1);

  const msg1: ProviderMessage = {
    id: "msg-001",
    conversationId: "conv-001",
    senderId: "prov-001",
    senderName: "Dr. Sarah Chen",
    senderRole: "physician",
    recipientIds: ["prov-002"],
    patientId: "patient-001",
    patientName: "John Smith",
    subject: "Cardiology Consult Request",
    content: "Hi Dr. Torres, I have a 58-year-old male patient with chest pain on exertion. ECG shows possible ST changes. Would appreciate your evaluation at your earliest convenience.",
    priority: "urgent",
    isEncrypted: true,
    attachments: [],
    readBy: [{ providerId: "prov-001", readAt: new Date().toISOString() }],
    isDeleted: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  };
  messages.set(msg1.id, msg1);

  const carePlan1: SharedCarePlan = {
    id: "cp-001",
    patientId: "patient-001",
    patientName: "John Smith",
    title: "Cardiac Health Management Plan",
    description: "Comprehensive care plan for managing cardiac symptoms and risk factors",
    status: "active",
    priority: "high",
    createdById: "prov-001",
    createdByName: "Dr. Sarah Chen",
    createdByRole: "physician",
    assignedProviders: [
      { providerId: "prov-001", providerName: "Dr. Sarah Chen", providerRole: "physician", accessLevel: "admin", assignedAt: new Date().toISOString() },
      { providerId: "prov-002", providerName: "Dr. Michael Torres", providerRole: "specialist", accessLevel: "edit", assignedAt: new Date().toISOString() },
      { providerId: "prov-003", providerName: "Nurse Emily Johnson", providerRole: "nurse", accessLevel: "edit", assignedAt: new Date().toISOString() },
    ],
    goals: [
      {
        id: "goal-001",
        carePlanId: "cp-001",
        title: "Reduce cardiac symptoms",
        description: "Patient should be free of chest pain during normal activities",
        targetDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        status: "in_progress",
        priority: "high",
        measurableOutcome: "No chest pain episodes for 2 consecutive weeks",
        progress: 40,
        createdById: "prov-001",
        createdByName: "Dr. Sarah Chen",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    tasks: [
      {
        id: "task-001",
        carePlanId: "cp-001",
        goalId: "goal-001",
        title: "Complete stress test",
        description: "Schedule and complete cardiac stress test",
        assignedToId: "prov-002",
        assignedToName: "Dr. Michael Torres",
        assignedToRole: "specialist",
        assignedById: "prov-001",
        assignedByName: "Dr. Sarah Chen",
        status: "pending",
        priority: "high",
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        dependencies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "task-002",
        carePlanId: "cp-001",
        goalId: "goal-001",
        title: "Daily blood pressure monitoring",
        description: "Patient to record BP twice daily",
        assignedToId: "prov-003",
        assignedToName: "Nurse Emily Johnson",
        assignedToRole: "nurse",
        assignedById: "prov-001",
        assignedByName: "Dr. Sarah Chen",
        status: "in_progress",
        priority: "medium",
        dueDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        dependencies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    notes: [
      {
        id: "note-001",
        carePlanId: "cp-001",
        authorId: "prov-001",
        authorName: "Dr. Sarah Chen",
        authorRole: "physician",
        content: "Patient is motivated and has family support for lifestyle changes. Good prognosis.",
        noteType: "general",
        isPrivate: false,
        mentions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isEdited: false,
        isDeleted: false,
      },
    ],
    auditLog: [],
    version: 1,
    lastModifiedById: "prov-001",
    lastModifiedByName: "Dr. Sarah Chen",
    startDate: new Date().toISOString(),
    targetEndDate: new Date(Date.now() + 90 * 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  carePlans.set(carePlan1.id, carePlan1);

  console.log("[ProviderCareCollaboration] Sample data initialized");
}

initializeSampleData();

function logCollaborationAudit(
  entry: Omit<CollaborationAuditEntry, "id" | "timestamp">
): CollaborationAuditEntry {
  const auditEntry: CollaborationAuditEntry = {
    id: randomUUID(),
    ...entry,
    timestamp: new Date().toISOString(),
  };
  collaborationAudit.set(auditEntry.id, auditEntry);

  if (entry.patientId) {
    logPhiAccess({
      userId: entry.performedById,
      action: "read",
      resourceType: `collaboration_${entry.entityType}`,
      resourceId: entry.entityId,
      patientId: entry.patientId,
      ipAddress: entry.ipAddress || "unknown",
      details: `${entry.action}: ${JSON.stringify(entry.details)}`,
    });
  }

  console.log(`[ProviderCareCollaboration][AUDIT] ${entry.action} on ${entry.entityType} by ${entry.performedByName}`);
  return auditEntry;
}

export function getProviders(): Provider[] {
  return Array.from(providers.values());
}

export function getProviderById(id: string): Provider | undefined {
  return providers.get(id);
}

export function getConversations(providerId: string): MessageConversation[] {
  return Array.from(conversations.values())
    .filter(c => c.participantIds.includes(providerId))
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

export function getConversationMessages(conversationId: string, providerId: string): ProviderMessage[] {
  const conv = conversations.get(conversationId);
  if (!conv || !conv.participantIds.includes(providerId)) {
    return [];
  }

  return Array.from(messages.values())
    .filter(m => m.conversationId === conversationId && !m.isDeleted)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function sendMessage(
  senderId: string,
  recipientIds: string[],
  content: string,
  options: {
    subject?: string;
    patientId?: string;
    patientName?: string;
    priority?: ProviderMessage["priority"];
    conversationId?: string;
  }
): { message: ProviderMessage; conversation: MessageConversation } {
  const sender = providers.get(senderId);
  if (!sender) throw new Error("Sender not found");

  const allParticipants = [senderId, ...recipientIds];
  let conversation: MessageConversation;

  if (options.conversationId && conversations.has(options.conversationId)) {
    conversation = conversations.get(options.conversationId)!;
  } else {
    conversation = {
      id: randomUUID(),
      participantIds: allParticipants,
      participants: allParticipants.map(id => {
        const p = providers.get(id);
        return { id, name: p?.name || "Unknown", role: p?.role || "unknown" };
      }),
      patientId: options.patientId,
      patientName: options.patientName,
      subject: options.subject || "New Conversation",
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: content.substring(0, 100),
      unreadCounts: {},
      isArchived: false,
      isPinned: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    conversations.set(conversation.id, conversation);
  }

  const message: ProviderMessage = {
    id: randomUUID(),
    conversationId: conversation.id,
    senderId,
    senderName: sender.name,
    senderRole: sender.role,
    recipientIds,
    patientId: options.patientId,
    patientName: options.patientName,
    subject: options.subject,
    content,
    priority: options.priority || "normal",
    isEncrypted: true,
    attachments: [],
    readBy: [{ providerId: senderId, readAt: new Date().toISOString() }],
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  messages.set(message.id, message);

  conversation.lastMessageAt = message.createdAt;
  conversation.lastMessagePreview = content.substring(0, 100);
  recipientIds.forEach(rid => {
    conversation.unreadCounts[rid] = (conversation.unreadCounts[rid] || 0) + 1;
  });
  conversation.updatedAt = new Date().toISOString();
  conversations.set(conversation.id, conversation);

  logCollaborationAudit({
    entityType: "message",
    entityId: message.id,
    action: "message_sent",
    performedById: senderId,
    performedByName: sender.name,
    performedByRole: sender.role,
    patientId: options.patientId,
    patientName: options.patientName,
    details: { recipientCount: recipientIds.length, priority: message.priority, hasAttachments: false },
  });

  return { message, conversation };
}

export function markMessagesAsRead(conversationId: string, providerId: string): void {
  const conv = conversations.get(conversationId);
  if (!conv) return;

  Array.from(messages.values())
    .filter(m => m.conversationId === conversationId && !m.readBy.some(r => r.providerId === providerId))
    .forEach(m => {
      m.readBy.push({ providerId, readAt: new Date().toISOString() });
      messages.set(m.id, m);
    });

  conv.unreadCounts[providerId] = 0;
  conversations.set(conv.id, conv);
}

export function getSharedSummaries(providerId: string): SharedPatientSummary[] {
  return Array.from(sharedSummaries.values())
    .filter(s => 
      s.sharedById === providerId || 
      s.sharedWithProviders.some(p => p.providerId === providerId)
    )
    .filter(s => !s.isRevoked && (!s.expiresAt || new Date(s.expiresAt) > new Date()));
}

export function sharePatientSummary(
  sharedById: string,
  patientId: string,
  patientName: string,
  summaryType: SharedPatientSummary["summaryType"],
  sharedWithProviderIds: string[],
  accessLevel: "view" | "comment" | "edit",
  content: SharedPatientSummary["summaryContent"],
  expiresInDays?: number
): SharedPatientSummary {
  const sharer = providers.get(sharedById);
  if (!sharer) throw new Error("Sharing provider not found");

  const summary: SharedPatientSummary = {
    id: randomUUID(),
    patientId,
    patientName,
    sharedById,
    sharedByName: sharer.name,
    sharedByRole: sharer.role,
    sharedWithProviders: sharedWithProviderIds.map(pid => {
      const p = providers.get(pid);
      return {
        providerId: pid,
        providerName: p?.name || "Unknown",
        providerRole: p?.role || "unknown",
        accessLevel,
        grantedAt: new Date().toISOString(),
      };
    }),
    summaryType,
    summaryContent: content,
    accessLog: [],
    expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 86400000).toISOString() : undefined,
    isRevoked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  sharedSummaries.set(summary.id, summary);

  logCollaborationAudit({
    entityType: "patient_summary",
    entityId: summary.id,
    action: "summary_shared",
    performedById: sharedById,
    performedByName: sharer.name,
    performedByRole: sharer.role,
    patientId,
    patientName,
    details: { summaryType, sharedWithCount: sharedWithProviderIds.length, accessLevel },
  });

  return summary;
}

export function accessPatientSummary(
  summaryId: string,
  providerId: string,
  action: "view" | "comment" | "export"
): SharedPatientSummary | null {
  const summary = sharedSummaries.get(summaryId);
  if (!summary || summary.isRevoked) return null;
  if (summary.expiresAt && new Date(summary.expiresAt) < new Date()) return null;

  const accessEntry = summary.sharedWithProviders.find(p => p.providerId === providerId);
  if (!accessEntry && summary.sharedById !== providerId) return null;

  const provider = providers.get(providerId);
  summary.accessLog.push({
    id: randomUUID(),
    providerId,
    providerName: provider?.name || "Unknown",
    action,
    timestamp: new Date().toISOString(),
  });
  summary.updatedAt = new Date().toISOString();
  sharedSummaries.set(summaryId, summary);

  logCollaborationAudit({
    entityType: "patient_summary",
    entityId: summaryId,
    action: `summary_${action}`,
    performedById: providerId,
    performedByName: provider?.name || "Unknown",
    performedByRole: provider?.role || "unknown",
    patientId: summary.patientId,
    patientName: summary.patientName,
    details: { summaryType: summary.summaryType },
  });

  return summary;
}

export function revokePatientSummary(summaryId: string, revokerId: string, reason: string): boolean {
  const summary = sharedSummaries.get(summaryId);
  if (!summary || summary.sharedById !== revokerId) return false;

  summary.isRevoked = true;
  summary.revokedAt = new Date().toISOString();
  summary.revokedReason = reason;
  summary.updatedAt = new Date().toISOString();
  sharedSummaries.set(summaryId, summary);

  const revoker = providers.get(revokerId);
  logCollaborationAudit({
    entityType: "patient_summary",
    entityId: summaryId,
    action: "summary_revoked",
    performedById: revokerId,
    performedByName: revoker?.name || "Unknown",
    performedByRole: revoker?.role || "unknown",
    patientId: summary.patientId,
    patientName: summary.patientName,
    details: { reason },
  });

  return true;
}

export function getCarePlans(providerId: string, patientId?: string): SharedCarePlan[] {
  return Array.from(carePlans.values())
    .filter(cp => 
      cp.assignedProviders.some(p => p.providerId === providerId) &&
      (!patientId || cp.patientId === patientId)
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getCarePlanById(carePlanId: string, providerId: string): SharedCarePlan | null {
  const cp = carePlans.get(carePlanId);
  if (!cp) return null;

  const hasAccess = cp.assignedProviders.some(p => p.providerId === providerId);
  if (!hasAccess) return null;

  const provider = providers.get(providerId);
  cp.auditLog.push({
    id: randomUUID(),
    carePlanId,
    action: "viewed",
    performedById: providerId,
    performedByName: provider?.name || "Unknown",
    performedByRole: provider?.role || "unknown",
    details: {},
    timestamp: new Date().toISOString(),
  });
  carePlans.set(carePlanId, cp);

  logCollaborationAudit({
    entityType: "care_plan",
    entityId: carePlanId,
    action: "care_plan_viewed",
    performedById: providerId,
    performedByName: provider?.name || "Unknown",
    performedByRole: provider?.role || "unknown",
    patientId: cp.patientId,
    patientName: cp.patientName,
    details: { title: cp.title, status: cp.status },
  });

  return cp;
}

export function createCarePlan(
  creatorId: string,
  patientId: string,
  patientName: string,
  title: string,
  description: string,
  assignedProviderIds: string[],
  options?: {
    priority?: SharedCarePlan["priority"];
    targetEndDate?: string;
  }
): SharedCarePlan {
  const creator = providers.get(creatorId);
  if (!creator) throw new Error("Creator not found");

  const carePlan: SharedCarePlan = {
    id: randomUUID(),
    patientId,
    patientName,
    title,
    description,
    status: "draft",
    priority: options?.priority || "medium",
    createdById: creatorId,
    createdByName: creator.name,
    createdByRole: creator.role,
    assignedProviders: [
      { providerId: creatorId, providerName: creator.name, providerRole: creator.role, accessLevel: "admin", assignedAt: new Date().toISOString() },
      ...assignedProviderIds.filter(id => id !== creatorId).map(pid => {
        const p = providers.get(pid);
        return {
          providerId: pid,
          providerName: p?.name || "Unknown",
          providerRole: p?.role || "unknown",
          accessLevel: "edit" as const,
          assignedAt: new Date().toISOString(),
        };
      }),
    ],
    goals: [],
    tasks: [],
    notes: [],
    auditLog: [{
      id: randomUUID(),
      carePlanId: "",
      action: "created",
      performedById: creatorId,
      performedByName: creator.name,
      performedByRole: creator.role,
      details: { title, priority: options?.priority || "medium" },
      timestamp: new Date().toISOString(),
    }],
    version: 1,
    lastModifiedById: creatorId,
    lastModifiedByName: creator.name,
    startDate: new Date().toISOString(),
    targetEndDate: options?.targetEndDate,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  carePlan.auditLog[0].carePlanId = carePlan.id;

  carePlans.set(carePlan.id, carePlan);

  logCollaborationAudit({
    entityType: "care_plan",
    entityId: carePlan.id,
    action: "care_plan_created",
    performedById: creatorId,
    performedByName: creator.name,
    performedByRole: creator.role,
    patientId,
    patientName,
    details: { title, assignedProviderCount: carePlan.assignedProviders.length },
  });

  return carePlan;
}

export function addCarePlanTask(
  carePlanId: string,
  creatorId: string,
  task: {
    title: string;
    description: string;
    assignedToId: string;
    priority: CarePlanTask["priority"];
    dueDate?: string;
    goalId?: string;
  }
): CarePlanTask | null {
  const cp = carePlans.get(carePlanId);
  if (!cp) return null;

  const hasEditAccess = cp.assignedProviders.some(p => 
    p.providerId === creatorId && (p.accessLevel === "edit" || p.accessLevel === "admin")
  );
  if (!hasEditAccess) return null;

  const creator = providers.get(creatorId);
  const assignee = providers.get(task.assignedToId);

  const newTask: CarePlanTask = {
    id: randomUUID(),
    carePlanId,
    goalId: task.goalId,
    title: task.title,
    description: task.description,
    assignedToId: task.assignedToId,
    assignedToName: assignee?.name || "Unknown",
    assignedToRole: assignee?.role || "unknown",
    assignedById: creatorId,
    assignedByName: creator?.name || "Unknown",
    status: "pending",
    priority: task.priority,
    dueDate: task.dueDate,
    dependencies: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  cp.tasks.push(newTask);
  cp.version++;
  cp.lastModifiedById = creatorId;
  cp.lastModifiedByName = creator?.name || "Unknown";
  cp.updatedAt = new Date().toISOString();

  cp.auditLog.push({
    id: randomUUID(),
    carePlanId,
    action: "task_added",
    performedById: creatorId,
    performedByName: creator?.name || "Unknown",
    performedByRole: creator?.role || "unknown",
    details: { taskId: newTask.id, title: newTask.title, assignedTo: assignee?.name },
    timestamp: new Date().toISOString(),
  });

  carePlans.set(carePlanId, cp);

  logCollaborationAudit({
    entityType: "task",
    entityId: newTask.id,
    action: "task_created",
    performedById: creatorId,
    performedByName: creator?.name || "Unknown",
    performedByRole: creator?.role || "unknown",
    patientId: cp.patientId,
    patientName: cp.patientName,
    details: { carePlanId, taskTitle: newTask.title, assignedTo: assignee?.name },
  });

  return newTask;
}

export function updateTaskStatus(
  carePlanId: string,
  taskId: string,
  providerId: string,
  status: CarePlanTask["status"],
  notes?: string
): CarePlanTask | null {
  const cp = carePlans.get(carePlanId);
  if (!cp) return null;

  const hasAccess = cp.assignedProviders.some(p => p.providerId === providerId);
  if (!hasAccess) return null;

  const task = cp.tasks.find(t => t.id === taskId);
  if (!task) return null;

  const provider = providers.get(providerId);
  const oldStatus = task.status;
  task.status = status;
  task.notes = notes || task.notes;
  task.updatedAt = new Date().toISOString();

  if (status === "completed") {
    task.completedAt = new Date().toISOString();
    task.completedById = providerId;
    task.completedByName = provider?.name || "Unknown";
  }

  cp.version++;
  cp.lastModifiedById = providerId;
  cp.lastModifiedByName = provider?.name || "Unknown";
  cp.updatedAt = new Date().toISOString();

  cp.auditLog.push({
    id: randomUUID(),
    carePlanId,
    action: "task_updated",
    performedById: providerId,
    performedByName: provider?.name || "Unknown",
    performedByRole: provider?.role || "unknown",
    details: { taskId, oldStatus, newStatus: status },
    timestamp: new Date().toISOString(),
  });

  carePlans.set(carePlanId, cp);

  logCollaborationAudit({
    entityType: "task",
    entityId: taskId,
    action: "task_status_updated",
    performedById: providerId,
    performedByName: provider?.name || "Unknown",
    performedByRole: provider?.role || "unknown",
    patientId: cp.patientId,
    patientName: cp.patientName,
    details: { carePlanId, oldStatus, newStatus: status },
  });

  return task;
}

export function addCarePlanNote(
  carePlanId: string,
  authorId: string,
  content: string,
  noteType: CarePlanNote["noteType"],
  isPrivate: boolean = false
): CarePlanNote | null {
  const cp = carePlans.get(carePlanId);
  if (!cp) return null;

  const hasAccess = cp.assignedProviders.some(p => p.providerId === authorId);
  if (!hasAccess) return null;

  const author = providers.get(authorId);

  const note: CarePlanNote = {
    id: randomUUID(),
    carePlanId,
    authorId,
    authorName: author?.name || "Unknown",
    authorRole: author?.role || "unknown",
    content,
    noteType,
    isPrivate,
    mentions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isEdited: false,
    isDeleted: false,
  };

  cp.notes.push(note);
  cp.version++;
  cp.lastModifiedById = authorId;
  cp.lastModifiedByName = author?.name || "Unknown";
  cp.updatedAt = new Date().toISOString();

  cp.auditLog.push({
    id: randomUUID(),
    carePlanId,
    action: "note_added",
    performedById: authorId,
    performedByName: author?.name || "Unknown",
    performedByRole: author?.role || "unknown",
    details: { noteId: note.id, noteType },
    timestamp: new Date().toISOString(),
  });

  carePlans.set(carePlanId, cp);

  logCollaborationAudit({
    entityType: "care_plan",
    entityId: carePlanId,
    action: "note_added",
    performedById: authorId,
    performedByName: author?.name || "Unknown",
    performedByRole: author?.role || "unknown",
    patientId: cp.patientId,
    patientName: cp.patientName,
    details: { noteType, isPrivate },
  });

  return note;
}

export function getCollaborationDashboard(providerId: string): {
  unreadMessageCount: number;
  activeCarePlans: number;
  pendingTasks: number;
  recentMessages: ProviderMessage[];
  myTasks: CarePlanTask[];
  sharedSummariesCount: number;
  noCdsDisclaimer: string;
} {
  const convs = getConversations(providerId);
  const unreadCount = convs.reduce((sum, c) => sum + (c.unreadCounts[providerId] || 0), 0);

  const myCarePlans = getCarePlans(providerId);
  const activePlans = myCarePlans.filter(cp => cp.status === "active").length;

  const myTasks = myCarePlans.flatMap(cp => 
    cp.tasks.filter(t => t.assignedToId === providerId && t.status !== "completed" && t.status !== "cancelled")
  );

  const recentMsgs = Array.from(messages.values())
    .filter(m => m.recipientIds.includes(providerId) || m.senderId === providerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const summaries = getSharedSummaries(providerId);

  return {
    unreadMessageCount: unreadCount,
    activeCarePlans: activePlans,
    pendingTasks: myTasks.length,
    recentMessages: recentMsgs,
    myTasks,
    sharedSummariesCount: summaries.length,
    noCdsDisclaimer: NO_CDS_DISCLAIMER,
  };
}

export function getCollaborationAuditLog(
  options?: {
    providerId?: string;
    patientId?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): CollaborationAuditEntry[] {
  let entries = Array.from(collaborationAudit.values());

  if (options?.providerId) {
    entries = entries.filter(e => e.performedById === options.providerId);
  }
  if (options?.patientId) {
    entries = entries.filter(e => e.patientId === options.patientId);
  }
  if (options?.entityType) {
    entries = entries.filter(e => e.entityType === options.entityType);
  }
  if (options?.startDate) {
    entries = entries.filter(e => new Date(e.timestamp) >= new Date(options.startDate!));
  }
  if (options?.endDate) {
    entries = entries.filter(e => new Date(e.timestamp) <= new Date(options.endDate!));
  }

  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (options?.limit) {
    entries = entries.slice(0, options.limit);
  }

  return entries;
}

console.log("[ProviderCareCollaboration] Service initialized");
console.log("[ProviderCareCollaboration] Features: Secure messaging, shared patient summaries, collaborative care plans, task management");
console.log("[ProviderCareCollaboration] Full audit trail logging enabled for HIPAA compliance");
