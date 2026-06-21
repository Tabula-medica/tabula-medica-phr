import { randomUUID } from "crypto";

const NO_CDS_DISCLAIMER = "DISCLAIMER: This collaboration feature is for care coordination purposes only. It does not constitute clinical decision support and should not replace clinical judgment.";

function logHipaaAudit(action: string, userId: string, details: string) {
  console.log(`[HIPAA-AUDIT][CareTeamCollaboration] ${action} by ${userId}: ${details}`);
}

export interface CareTeamChatMessage {
  id: string;
  patientId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  messageType: "text" | "task_update" | "report_comment" | "handoff" | "alert";
  attachmentUrl?: string;
  attachmentType?: string;
  replyToId?: string;
  mentionedUserIds: string[];
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CareTeamConversation {
  id: string;
  patientId: string;
  patientName: string;
  teamId: string;
  participants: Array<{
    userId: string;
    name: string;
    role: string;
    joinedAt: string;
    lastReadAt: string;
  }>;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCounts: Record<string, number>;
  isActive: boolean;
  createdAt: string;
}

export interface CareTeamSharedTask {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  description: string;
  taskType: "medication_review" | "follow_up" | "care_gap" | "assessment" | "documentation" | "coordination" | "custom";
  priority: "urgent" | "high" | "normal" | "low";
  status: "pending" | "in_progress" | "completed" | "on_hold" | "cancelled";
  assignedTo: Array<{
    userId: string;
    name: string;
    role: string;
    assignedAt: string;
  }>;
  createdBy: {
    userId: string;
    name: string;
    role: string;
  };
  dueDate: string;
  completedAt?: string;
  completedBy?: {
    userId: string;
    name: string;
  };
  comments: Array<{
    id: string;
    userId: string;
    userName: string;
    content: string;
    createdAt: string;
  }>;
  checklistItems: Array<{
    id: string;
    title: string;
    isCompleted: boolean;
    completedBy?: string;
    completedAt?: string;
  }>;
  linkedReportId?: string;
  linkedMessageId?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CollaborativeReportReview {
  id: string;
  patientId: string;
  patientName: string;
  reportId: string;
  reportType: "ai_summary" | "care_gap" | "progress" | "risk_assessment" | "treatment_plan";
  reportTitle: string;
  reportContent: any;
  generatedAt: string;
  status: "draft" | "under_review" | "approved" | "requires_changes" | "finalized";
  reviewers: Array<{
    userId: string;
    name: string;
    role: string;
    status: "pending" | "reviewed" | "approved" | "rejected";
    reviewedAt?: string;
    comments?: string;
  }>;
  annotations: Array<{
    id: string;
    userId: string;
    userName: string;
    userRole: string;
    sectionId: string;
    sectionTitle: string;
    highlightText?: string;
    comment: string;
    annotationType: "comment" | "suggestion" | "correction" | "approval" | "concern";
    status: "open" | "resolved" | "dismissed";
    resolvedBy?: string;
    resolvedAt?: string;
    createdAt: string;
  }>;
  changelog: Array<{
    id: string;
    userId: string;
    userName: string;
    action: string;
    details: string;
    timestamp: string;
  }>;
  finalApprover?: {
    userId: string;
    name: string;
    approvedAt: string;
  };
  disclaimer: string;
  createdAt: string;
  updatedAt: string;
}

const chatMessages = new Map<string, CareTeamChatMessage>();
const conversations = new Map<string, CareTeamConversation>();
const sharedTasks = new Map<string, CareTeamSharedTask>();
const reportReviews = new Map<string, CollaborativeReportReview>();

function initializeSampleData() {
  if (conversations.size > 0) return;

  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const conv1: CareTeamConversation = {
    id: "ctc-001",
    patientId: "patient-001",
    patientName: "John Smith",
    teamId: "team-001",
    participants: [
      { userId: "dr-wilson", name: "Dr. Sarah Wilson", role: "primary_physician", joinedAt: yesterday, lastReadAt: now },
      { userId: "nurse-rodriguez", name: "Maria Rodriguez, RN", role: "nurse", joinedAt: yesterday, lastReadAt: now },
      { userId: "coord-chen", name: "David Chen", role: "care_coordinator", joinedAt: yesterday, lastReadAt: now },
      { userId: "pharm-patel", name: "Dr. Raj Patel", role: "pharmacist", joinedAt: yesterday, lastReadAt: now },
    ],
    lastMessageAt: now,
    lastMessagePreview: "Lab results came back - HbA1c is 7.2%",
    unreadCounts: { "dr-wilson": 0, "nurse-rodriguez": 2, "coord-chen": 0, "pharm-patel": 1 },
    isActive: true,
    createdAt: yesterday,
  };
  conversations.set(conv1.id, conv1);

  const msg1: CareTeamChatMessage = {
    id: "msg-001",
    patientId: "patient-001",
    conversationId: "ctc-001",
    senderId: "nurse-rodriguez",
    senderName: "Maria Rodriguez, RN",
    senderRole: "nurse",
    content: "Good morning team! Patient completed morning vitals - BP 128/82, HR 72, all within normal range.",
    messageType: "text",
    mentionedUserIds: [],
    isEdited: false,
    isDeleted: false,
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  };
  chatMessages.set(msg1.id, msg1);

  const msg2: CareTeamChatMessage = {
    id: "msg-002",
    patientId: "patient-001",
    conversationId: "ctc-001",
    senderId: "dr-wilson",
    senderName: "Dr. Sarah Wilson",
    senderRole: "primary_physician",
    content: "Thanks Maria! @dr-patel - can you review the current metformin dosage? Considering adjustment based on latest HbA1c.",
    messageType: "text",
    mentionedUserIds: ["pharm-patel"],
    isEdited: false,
    isDeleted: false,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  };
  chatMessages.set(msg2.id, msg2);

  const msg3: CareTeamChatMessage = {
    id: "msg-003",
    patientId: "patient-001",
    conversationId: "ctc-001",
    senderId: "pharm-patel",
    senderName: "Dr. Raj Patel",
    senderRole: "pharmacist",
    content: "Lab results came back - HbA1c is 7.2%. Current dose is 1000mg twice daily. Given the improvement from 8.1%, I'd suggest maintaining current regimen for another 3 months before considering changes.",
    messageType: "text",
    mentionedUserIds: [],
    isEdited: false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };
  chatMessages.set(msg3.id, msg3);

  const task1: CareTeamSharedTask = {
    id: "task-001",
    patientId: "patient-001",
    patientName: "John Smith",
    title: "Complete Diabetes Care Plan Review",
    description: "Review and update comprehensive diabetes care plan based on latest lab results and patient progress",
    taskType: "care_gap",
    priority: "high",
    status: "in_progress",
    assignedTo: [
      { userId: "dr-wilson", name: "Dr. Sarah Wilson", role: "primary_physician", assignedAt: yesterday },
      { userId: "nurse-rodriguez", name: "Maria Rodriguez, RN", role: "nurse", assignedAt: yesterday },
    ],
    createdBy: { userId: "coord-chen", name: "David Chen", role: "care_coordinator" },
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    comments: [
      { id: "c1", userId: "dr-wilson", userName: "Dr. Sarah Wilson", content: "Started review - waiting on pharmacy consult", createdAt: yesterday },
    ],
    checklistItems: [
      { id: "cl1", title: "Review latest HbA1c results", isCompleted: true, completedBy: "dr-wilson", completedAt: now },
      { id: "cl2", title: "Assess current medication regimen", isCompleted: true, completedBy: "pharm-patel", completedAt: now },
      { id: "cl3", title: "Update care plan documentation", isCompleted: false },
      { id: "cl4", title: "Schedule follow-up appointment", isCompleted: false },
    ],
    tags: ["diabetes", "care-plan", "review"],
    createdAt: yesterday,
    updatedAt: now,
  };
  sharedTasks.set(task1.id, task1);

  const task2: CareTeamSharedTask = {
    id: "task-002",
    patientId: "patient-001",
    patientName: "John Smith",
    title: "Medication Reconciliation",
    description: "Complete medication reconciliation following recent hospitalization",
    taskType: "medication_review",
    priority: "urgent",
    status: "pending",
    assignedTo: [
      { userId: "pharm-patel", name: "Dr. Raj Patel", role: "pharmacist", assignedAt: now },
    ],
    createdBy: { userId: "dr-wilson", name: "Dr. Sarah Wilson", role: "primary_physician" },
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    comments: [],
    checklistItems: [
      { id: "cl5", title: "Verify current medications list", isCompleted: false },
      { id: "cl6", title: "Check for drug interactions", isCompleted: false },
      { id: "cl7", title: "Document changes from hospitalization", isCompleted: false },
    ],
    tags: ["medication", "urgent", "reconciliation"],
    createdAt: now,
    updatedAt: now,
  };
  sharedTasks.set(task2.id, task2);

  const review1: CollaborativeReportReview = {
    id: "review-001",
    patientId: "patient-001",
    patientName: "John Smith",
    reportId: "ai-report-001",
    reportType: "ai_summary",
    reportTitle: "AI-Generated Quarterly Health Summary - Q4 2025",
    reportContent: {
      overview: "Patient demonstrates improved glycemic control with HbA1c reduction from 8.1% to 7.2% over 3 months.",
      keyFindings: [
        "Diabetes management improving with current medication regimen",
        "Blood pressure well-controlled",
        "Kidney function stable (eGFR 72 mL/min)",
        "Lipid panel within target ranges",
      ],
      recommendations: [
        "Continue current metformin dosage",
        "Maintain quarterly HbA1c monitoring",
        "Annual diabetic eye exam due in 2 months",
        "Consider referral to diabetes educator for lifestyle optimization",
      ],
      riskFactors: ["Family history of cardiovascular disease", "Mild obesity (BMI 29.4)"],
    },
    generatedAt: yesterday,
    status: "under_review",
    reviewers: [
      { userId: "dr-wilson", name: "Dr. Sarah Wilson", role: "primary_physician", status: "approved", reviewedAt: now, comments: "Accurate summary. Agree with recommendations." },
      { userId: "nurse-rodriguez", name: "Maria Rodriguez, RN", role: "nurse", status: "reviewed", reviewedAt: now },
      { userId: "pharm-patel", name: "Dr. Raj Patel", role: "pharmacist", status: "pending" },
    ],
    annotations: [
      {
        id: "ann-001",
        userId: "dr-wilson",
        userName: "Dr. Sarah Wilson",
        userRole: "primary_physician",
        sectionId: "recommendations",
        sectionTitle: "Recommendations",
        highlightText: "diabetes educator",
        comment: "Good suggestion - patient has expressed interest in nutrition counseling.",
        annotationType: "approval",
        status: "open",
        createdAt: now,
      },
      {
        id: "ann-002",
        userId: "nurse-rodriguez",
        userName: "Maria Rodriguez, RN",
        userRole: "nurse",
        sectionId: "recommendations",
        sectionTitle: "Recommendations",
        highlightText: "Annual diabetic eye exam",
        comment: "I can help schedule this during next visit. Should we add as a task?",
        annotationType: "suggestion",
        status: "open",
        createdAt: now,
      },
    ],
    changelog: [
      { id: "log-1", userId: "system", userName: "AI System", action: "generated", details: "AI summary generated from patient data", timestamp: yesterday },
      { id: "log-2", userId: "coord-chen", userName: "David Chen", action: "submitted_for_review", details: "Submitted to care team for collaborative review", timestamp: yesterday },
      { id: "log-3", userId: "dr-wilson", userName: "Dr. Sarah Wilson", action: "approved", details: "Primary physician approval with comments", timestamp: now },
    ],
    disclaimer: NO_CDS_DISCLAIMER,
    createdAt: yesterday,
    updatedAt: now,
  };
  reportReviews.set(review1.id, review1);
}

initializeSampleData();

export function getPatientConversations(patientId: string): CareTeamConversation[] {
  return Array.from(conversations.values()).filter(c => c.patientId === patientId && c.isActive);
}

export function getConversation(conversationId: string): CareTeamConversation | undefined {
  return conversations.get(conversationId);
}

export function getConversationMessages(conversationId: string, limit = 50, before?: string): CareTeamChatMessage[] {
  const msgs = Array.from(chatMessages.values())
    .filter(m => m.conversationId === conversationId && !m.isDeleted)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  if (before) {
    const idx = msgs.findIndex(m => m.id === before);
    return msgs.slice(idx + 1, idx + 1 + limit);
  }
  return msgs.slice(0, limit).reverse();
}

export function createConversation(
  patientId: string,
  patientName: string,
  teamId: string,
  participants: Array<{ userId: string; name: string; role: string }>,
  creatorId: string
): CareTeamConversation {
  const now = new Date().toISOString();
  const conv: CareTeamConversation = {
    id: `ctc-${randomUUID()}`,
    patientId,
    patientName,
    teamId,
    participants: participants.map(p => ({
      ...p,
      joinedAt: now,
      lastReadAt: now,
    })),
    lastMessageAt: now,
    lastMessagePreview: "Conversation started",
    unreadCounts: Object.fromEntries(participants.map(p => [p.userId, 0])),
    isActive: true,
    createdAt: now,
  };
  conversations.set(conv.id, conv);
  
  logHipaaAudit("CONVERSATION_CREATED", creatorId, `Created care team conversation for patient ${patientId}`);
  
  return conv;
}

export function sendChatMessage(
  conversationId: string,
  senderId: string,
  senderName: string,
  senderRole: string,
  content: string,
  messageType: CareTeamChatMessage["messageType"] = "text",
  mentionedUserIds: string[] = [],
  replyToId?: string
): CareTeamChatMessage {
  const now = new Date().toISOString();
  const conv = conversations.get(conversationId);
  
  const msg: CareTeamChatMessage = {
    id: `msg-${randomUUID()}`,
    patientId: conv?.patientId || "",
    conversationId,
    senderId,
    senderName,
    senderRole,
    content,
    messageType,
    mentionedUserIds,
    replyToId,
    isEdited: false,
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
  };
  chatMessages.set(msg.id, msg);

  if (conv) {
    conv.lastMessageAt = now;
    conv.lastMessagePreview = content.substring(0, 100);
    conv.participants.forEach(p => {
      if (p.userId !== senderId) {
        conv.unreadCounts[p.userId] = (conv.unreadCounts[p.userId] || 0) + 1;
      }
    });
    conversations.set(conversationId, conv);
  }

  logHipaaAudit("MESSAGE_SENT", senderId, `Sent message in conversation ${conversationId}`);
  
  return msg;
}

export function markMessagesRead(conversationId: string, userId: string): void {
  const conv = conversations.get(conversationId);
  if (conv) {
    const participant = conv.participants.find(p => p.userId === userId);
    if (participant) {
      participant.lastReadAt = new Date().toISOString();
      conv.unreadCounts[userId] = 0;
      conversations.set(conversationId, conv);
    }
  }
}

export function getPatientTasks(patientId: string): CareTeamSharedTask[] {
  return Array.from(sharedTasks.values())
    .filter(t => t.patientId === patientId)
    .sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}

export function getTask(taskId: string): CareTeamSharedTask | undefined {
  return sharedTasks.get(taskId);
}

export function createTask(
  patientId: string,
  patientName: string,
  title: string,
  description: string,
  taskType: CareTeamSharedTask["taskType"],
  priority: CareTeamSharedTask["priority"],
  assignedTo: Array<{ userId: string; name: string; role: string }>,
  createdBy: { userId: string; name: string; role: string },
  dueDate: string,
  checklistItems: string[] = [],
  tags: string[] = []
): CareTeamSharedTask {
  const now = new Date().toISOString();
  const task: CareTeamSharedTask = {
    id: `task-${randomUUID()}`,
    patientId,
    patientName,
    title,
    description,
    taskType,
    priority,
    status: "pending",
    assignedTo: assignedTo.map(a => ({ ...a, assignedAt: now })),
    createdBy,
    dueDate,
    comments: [],
    checklistItems: checklistItems.map(title => ({
      id: `cl-${randomUUID()}`,
      title,
      isCompleted: false,
    })),
    tags,
    createdAt: now,
    updatedAt: now,
  };
  sharedTasks.set(task.id, task);
  
  logHipaaAudit("TASK_CREATED", createdBy.userId, `Created task "${title}" for patient ${patientId}`);
  
  return task;
}

export function updateTaskStatus(
  taskId: string,
  status: CareTeamSharedTask["status"],
  userId: string,
  userName: string
): CareTeamSharedTask | undefined {
  const task = sharedTasks.get(taskId);
  if (!task) return undefined;
  
  task.status = status;
  task.updatedAt = new Date().toISOString();
  
  if (status === "completed") {
    task.completedAt = task.updatedAt;
    task.completedBy = { userId, name: userName };
  }
  
  sharedTasks.set(taskId, task);
  logHipaaAudit("TASK_STATUS_UPDATED", userId, `Updated task ${taskId} status to ${status}`);
  
  return task;
}

export function addTaskComment(
  taskId: string,
  userId: string,
  userName: string,
  content: string
): CareTeamSharedTask | undefined {
  const task = sharedTasks.get(taskId);
  if (!task) return undefined;
  
  task.comments.push({
    id: `c-${randomUUID()}`,
    userId,
    userName,
    content,
    createdAt: new Date().toISOString(),
  });
  task.updatedAt = new Date().toISOString();
  sharedTasks.set(taskId, task);
  
  logHipaaAudit("TASK_COMMENT_ADDED", userId, `Added comment to task ${taskId}`);
  
  return task;
}

export function updateChecklistItem(
  taskId: string,
  checklistItemId: string,
  isCompleted: boolean,
  userId: string
): CareTeamSharedTask | undefined {
  const task = sharedTasks.get(taskId);
  if (!task) return undefined;
  
  const item = task.checklistItems.find(i => i.id === checklistItemId);
  if (item) {
    item.isCompleted = isCompleted;
    if (isCompleted) {
      item.completedBy = userId;
      item.completedAt = new Date().toISOString();
    } else {
      item.completedBy = undefined;
      item.completedAt = undefined;
    }
    task.updatedAt = new Date().toISOString();
    sharedTasks.set(taskId, task);
    
    logHipaaAudit("CHECKLIST_UPDATED", userId, `Updated checklist item in task ${taskId}`);
  }
  
  return task;
}

export function getPatientReportReviews(patientId: string): CollaborativeReportReview[] {
  return Array.from(reportReviews.values())
    .filter(r => r.patientId === patientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getReportReview(reviewId: string): CollaborativeReportReview | undefined {
  return reportReviews.get(reviewId);
}

export function createReportReview(
  patientId: string,
  patientName: string,
  reportType: CollaborativeReportReview["reportType"],
  reportTitle: string,
  reportContent: any,
  reviewers: Array<{ userId: string; name: string; role: string }>,
  creatorId: string,
  creatorName: string
): CollaborativeReportReview {
  const now = new Date().toISOString();
  const review: CollaborativeReportReview = {
    id: `review-${randomUUID()}`,
    patientId,
    patientName,
    reportId: `ai-report-${randomUUID()}`,
    reportType,
    reportTitle,
    reportContent,
    generatedAt: now,
    status: "draft",
    reviewers: reviewers.map(r => ({ ...r, status: "pending" as const })),
    annotations: [],
    changelog: [{
      id: `log-${randomUUID()}`,
      userId: creatorId,
      userName: creatorName,
      action: "created",
      details: "Report submitted for collaborative review",
      timestamp: now,
    }],
    disclaimer: NO_CDS_DISCLAIMER,
    createdAt: now,
    updatedAt: now,
  };
  reportReviews.set(review.id, review);
  
  logHipaaAudit("REPORT_REVIEW_CREATED", creatorId, `Created report review for patient ${patientId}`);
  
  return review;
}

export function addReportAnnotation(
  reviewId: string,
  userId: string,
  userName: string,
  userRole: string,
  sectionId: string,
  sectionTitle: string,
  comment: string,
  annotationType: "comment" | "suggestion" | "correction" | "approval" | "concern",
  highlightText?: string
): CollaborativeReportReview | undefined {
  const review = reportReviews.get(reviewId);
  if (!review) return undefined;
  
  const now = new Date().toISOString();
  review.annotations.push({
    id: `ann-${randomUUID()}`,
    userId,
    userName,
    userRole,
    sectionId,
    sectionTitle,
    highlightText,
    comment,
    annotationType,
    status: "open",
    createdAt: now,
  });
  
  review.changelog.push({
    id: `log-${randomUUID()}`,
    userId,
    userName,
    action: "annotation_added",
    details: `Added ${annotationType} on ${sectionTitle}`,
    timestamp: now,
  });
  
  review.updatedAt = now;
  reportReviews.set(reviewId, review);
  
  logHipaaAudit("ANNOTATION_ADDED", userId, `Added annotation to report review ${reviewId}`);
  
  return review;
}

export function updateReviewerStatus(
  reviewId: string,
  userId: string,
  status: "reviewed" | "approved" | "rejected",
  comments?: string
): CollaborativeReportReview | undefined {
  const review = reportReviews.get(reviewId);
  if (!review) return undefined;
  
  const reviewer = review.reviewers.find(r => r.userId === userId);
  if (!reviewer) return undefined;
  
  const now = new Date().toISOString();
  reviewer.status = status;
  reviewer.reviewedAt = now;
  if (comments) reviewer.comments = comments;
  
  review.changelog.push({
    id: `log-${randomUUID()}`,
    userId,
    userName: reviewer.name,
    action: status,
    details: comments || `Reviewer ${status} the report`,
    timestamp: now,
  });

  const allApproved = review.reviewers.every(r => r.status === "approved" || r.status === "reviewed");
  if (allApproved && review.status === "under_review") {
    review.status = "approved";
  }
  
  review.updatedAt = now;
  reportReviews.set(reviewId, review);
  
  logHipaaAudit("REVIEWER_STATUS_UPDATED", userId, `Updated review status to ${status} for report ${reviewId}`);
  
  return review;
}

export function resolveAnnotation(
  reviewId: string,
  annotationId: string,
  userId: string,
  resolution: "resolved" | "dismissed"
): CollaborativeReportReview | undefined {
  const review = reportReviews.get(reviewId);
  if (!review) return undefined;
  
  const annotation = review.annotations.find(a => a.id === annotationId);
  if (!annotation) return undefined;
  
  const now = new Date().toISOString();
  annotation.status = resolution;
  annotation.resolvedBy = userId;
  annotation.resolvedAt = now;
  
  review.updatedAt = now;
  reportReviews.set(reviewId, review);
  
  logHipaaAudit("ANNOTATION_RESOLVED", userId, `Resolved annotation ${annotationId} in report ${reviewId}`);
  
  return review;
}

export function finalizeReport(
  reviewId: string,
  userId: string,
  userName: string
): CollaborativeReportReview | undefined {
  const review = reportReviews.get(reviewId);
  if (!review) return undefined;
  
  const now = new Date().toISOString();
  review.status = "finalized";
  review.finalApprover = { userId, name: userName, approvedAt: now };
  
  review.changelog.push({
    id: `log-${randomUUID()}`,
    userId,
    userName,
    action: "finalized",
    details: "Report finalized and approved for patient record",
    timestamp: now,
  });
  
  review.updatedAt = now;
  reportReviews.set(reviewId, review);
  
  logHipaaAudit("REPORT_FINALIZED", userId, `Finalized report review ${reviewId}`);
  
  return review;
}

export function getAllConversations(): CareTeamConversation[] {
  return Array.from(conversations.values()).filter(c => c.isActive);
}

export function getAllTasks(): CareTeamSharedTask[] {
  return Array.from(sharedTasks.values())
    .sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}

export function getAllReportReviews(): CollaborativeReportReview[] {
  return Array.from(reportReviews.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export { NO_CDS_DISCLAIMER };
