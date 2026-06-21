import type {
  CareTeamTask,
  InsertCareTeamTask,
  CareHandoff,
  InsertCareHandoff,
  CareTeamNote,
  InsertCareTeamNote,
  CareTeamActivity,
  CareTeamMember,
  CareTeamRole,
  CareTeamTaskStatus,
  HandoffStatus,
  CareTeamMemberExtended,
  InsertCareTeamMemberExtended,
  CareProtocolTemplate,
  InsertCareProtocolTemplate,
  EscalationRule,
  InsertEscalationRule,
  EscalationEvent,
  TeamPerformanceMetrics,
  TeamMemberMetrics,
  MemberAvailabilityStatus,
} from "@shared/schema";

const careTeamTasks: Map<string, CareTeamTask> = new Map();
const careHandoffs: Map<string, CareHandoff> = new Map();
const careTeamNotes: Map<string, CareTeamNote> = new Map();
const careTeamActivities: Map<string, CareTeamActivity> = new Map();
const careTeamMembers: Map<string, CareTeamMemberExtended> = new Map();
const careProtocolTemplates: Map<string, CareProtocolTemplate> = new Map();
const escalationRules: Map<string, EscalationRule> = new Map();
const escalationEvents: Map<string, EscalationEvent> = new Map();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function logActivity(
  carePlanId: string,
  patientId: string,
  type: CareTeamActivity["type"],
  actorId: string,
  actorName: string,
  actorRole: CareTeamRole,
  description: string,
  relatedEntityId?: string,
  relatedEntityType?: CareTeamActivity["relatedEntityType"],
  metadata?: Record<string, any>
): CareTeamActivity {
  const activity: CareTeamActivity = {
    id: generateId(),
    carePlanId,
    patientId,
    type,
    actorId,
    actorName,
    actorRole,
    description,
    metadata,
    relatedEntityId,
    relatedEntityType,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  careTeamActivities.set(activity.id, activity);
  return activity;
}

export function createTask(data: InsertCareTeamTask, creatorName: string, creatorRole: CareTeamRole): CareTeamTask {
  const task: CareTeamTask = {
    id: generateId(),
    ...data,
    status: data.status || "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  careTeamTasks.set(task.id, task);

  logActivity(
    data.carePlanId,
    data.patientId,
    "task_created",
    data.assignedBy,
    creatorName,
    creatorRole,
    `Created task: "${task.title}" and assigned to team member`,
    task.id,
    "task",
    { priority: task.priority, category: task.category, assignedTo: task.assignedTo }
  );

  return task;
}

export function getAllTasks(): CareTeamTask[] {
  return Array.from(careTeamTasks.values())
    .sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
}

export function getTasksByCarePlan(carePlanId: string): CareTeamTask[] {
  return Array.from(careTeamTasks.values())
    .filter(t => t.carePlanId === carePlanId)
    .sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
}

export function getTasksByAssignee(assigneeId: string): CareTeamTask[] {
  return Array.from(careTeamTasks.values())
    .filter(t => t.assignedTo === assigneeId && t.status !== "completed" && t.status !== "cancelled")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}

export function getTasksByPatient(patientId: string): CareTeamTask[] {
  return Array.from(careTeamTasks.values())
    .filter(t => t.patientId === patientId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function updateTask(
  taskId: string,
  updates: Partial<CareTeamTask>,
  updaterId: string,
  updaterName: string,
  updaterRole: CareTeamRole
): CareTeamTask | null {
  const task = careTeamTasks.get(taskId);
  if (!task) return null;

  const updatedTask: CareTeamTask = {
    ...task,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  if (updates.status === "completed" && task.status !== "completed") {
    updatedTask.completedAt = new Date().toISOString();
    updatedTask.completedBy = updaterId;

    logActivity(
      task.carePlanId,
      task.patientId,
      "task_completed",
      updaterId,
      updaterName,
      updaterRole,
      `Completed task: "${task.title}"`,
      taskId,
      "task"
    );
  }

  careTeamTasks.set(taskId, updatedTask);
  return updatedTask;
}

export function createHandoff(data: InsertCareHandoff): CareHandoff {
  const handoff: CareHandoff = {
    id: generateId(),
    ...data,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  careHandoffs.set(handoff.id, handoff);

  logActivity(
    data.carePlanId,
    data.patientId,
    "handoff_initiated",
    data.fromMemberId,
    data.fromMemberName,
    "care_coordinator",
    `Initiated care handoff to ${data.toMemberName}: ${data.reason}`,
    handoff.id,
    "handoff",
    { urgency: data.urgency, toMember: data.toMemberName }
  );

  return handoff;
}

export function getHandoffsByCarePlan(carePlanId: string): CareHandoff[] {
  return Array.from(careHandoffs.values())
    .filter(h => h.carePlanId === carePlanId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getHandoffsForMember(memberId: string): CareHandoff[] {
  return Array.from(careHandoffs.values())
    .filter(h => h.toMemberId === memberId && h.status !== "completed" && h.status !== "declined")
    .sort((a, b) => {
      const urgencyOrder = { stat: 0, urgent: 1, routine: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });
}

export function updateHandoff(
  handoffId: string,
  status: HandoffStatus,
  actorId: string,
  actorName: string,
  actorRole: CareTeamRole,
  notes?: string
): CareHandoff | null {
  const handoff = careHandoffs.get(handoffId);
  if (!handoff) return null;

  const now = new Date().toISOString();
  const updatedHandoff: CareHandoff = { ...handoff };

  if (status === "acknowledged") {
    updatedHandoff.acknowledgedAt = now;
  } else if (status === "accepted") {
    updatedHandoff.acceptedAt = now;
    logActivity(
      handoff.carePlanId,
      handoff.patientId,
      "handoff_accepted",
      actorId,
      actorName,
      actorRole,
      `Accepted care handoff from ${handoff.fromMemberName}`,
      handoffId,
      "handoff"
    );
  } else if (status === "completed") {
    updatedHandoff.completedAt = now;
    logActivity(
      handoff.carePlanId,
      handoff.patientId,
      "handoff_completed",
      actorId,
      actorName,
      actorRole,
      `Completed care handoff - ${handoff.reason}`,
      handoffId,
      "handoff"
    );
  }

  if (notes) {
    updatedHandoff.notes = notes;
  }

  updatedHandoff.status = status;
  careHandoffs.set(handoffId, updatedHandoff);
  return updatedHandoff;
}

export function createNote(data: InsertCareTeamNote): CareTeamNote {
  const note: CareTeamNote = {
    id: generateId(),
    ...data,
    visibility: data.visibility || "team",
    mentions: data.mentions || [],
    isUrgent: data.isUrgent || false,
    readBy: [data.authorId],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  careTeamNotes.set(note.id, note);

  logActivity(
    data.carePlanId,
    data.patientId,
    "note_added",
    data.authorId,
    data.authorName,
    data.authorRole,
    data.isUrgent 
      ? `Added urgent team note` 
      : `Added team note`,
    note.id,
    "note",
    { isUrgent: data.isUrgent, visibility: data.visibility }
  );

  return note;
}

export function getNotesByCarePlan(carePlanId: string, viewerRole?: CareTeamRole): CareTeamNote[] {
  return Array.from(careTeamNotes.values())
    .filter(n => {
      if (n.carePlanId !== carePlanId) return false;
      if (n.visibility === "team") return true;
      if (n.visibility === "specific_roles" && viewerRole && n.visibleToRoles?.includes(viewerRole)) return true;
      return false;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function markNoteAsRead(noteId: string, readerId: string): CareTeamNote | null {
  const note = careTeamNotes.get(noteId);
  if (!note) return null;

  if (!note.readBy.includes(readerId)) {
    note.readBy.push(readerId);
    careTeamNotes.set(noteId, note);
  }

  return note;
}

export function getActivitiesByCarePlan(carePlanId: string, limit = 50): CareTeamActivity[] {
  return Array.from(careTeamActivities.values())
    .filter(a => a.carePlanId === carePlanId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export function getActivitiesForMember(memberId: string, limit = 50): CareTeamActivity[] {
  return Array.from(careTeamActivities.values())
    .filter(a => a.actorId === memberId || a.metadata?.assignedTo === memberId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export function markActivityAsRead(activityId: string): CareTeamActivity | null {
  const activity = careTeamActivities.get(activityId);
  if (!activity) return null;

  activity.isRead = true;
  careTeamActivities.set(activityId, activity);
  return activity;
}

export function getCareTeamStats(carePlanId: string): {
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  overdueTasks: number;
  activeHandoffs: number;
  unreadNotes: number;
  recentActivityCount: number;
} {
  const tasks = getTasksByCarePlan(carePlanId);
  const now = new Date();
  
  const overdueTasks = tasks.filter(t => 
    t.status !== "completed" && 
    t.status !== "cancelled" && 
    new Date(t.dueDate) < now
  ).length;

  const activeHandoffs = Array.from(careHandoffs.values())
    .filter(h => h.carePlanId === carePlanId && h.status !== "completed" && h.status !== "declined")
    .length;

  const notes = getNotesByCarePlan(carePlanId);
  const activities = getActivitiesByCarePlan(carePlanId);
  
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentActivityCount = activities.filter(a => new Date(a.createdAt) > oneDayAgo).length;

  return {
    totalTasks: tasks.length,
    pendingTasks: tasks.filter(t => t.status === "pending" || t.status === "in_progress").length,
    completedTasks: tasks.filter(t => t.status === "completed").length,
    overdueTasks,
    activeHandoffs,
    unreadNotes: notes.length,
    recentActivityCount,
  };
}

// ==================== CARE TEAM MEMBER MANAGEMENT ====================

export function addCareTeamMember(data: InsertCareTeamMemberExtended): CareTeamMemberExtended {
  const member: CareTeamMemberExtended = {
    id: generateId(),
    ...data,
    credentials: data.credentials || [],
    skills: data.skills || [],
    certifications: data.certifications || [],
    availabilityStatus: "available",
    workload: {
      activeTasks: 0,
      pendingHandoffs: 0,
      patientsAssigned: 0,
    },
    joinedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  careTeamMembers.set(member.id, member);
  return member;
}

export function getCareTeamMembers(): CareTeamMemberExtended[] {
  return Array.from(careTeamMembers.values())
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getCareTeamMemberById(memberId: string): CareTeamMemberExtended | undefined {
  return careTeamMembers.get(memberId);
}

export function getCareTeamMembersByRole(role: CareTeamRole): CareTeamMemberExtended[] {
  return Array.from(careTeamMembers.values())
    .filter(m => m.role === role)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getAvailableMembers(): CareTeamMemberExtended[] {
  return Array.from(careTeamMembers.values())
    .filter(m => m.availabilityStatus === "available" || m.availabilityStatus === "on_call")
    .sort((a, b) => a.workload.activeTasks - b.workload.activeTasks);
}

export function updateCareTeamMember(
  memberId: string,
  updates: Partial<CareTeamMemberExtended>
): CareTeamMemberExtended | null {
  const member = careTeamMembers.get(memberId);
  if (!member) return null;

  const updatedMember: CareTeamMemberExtended = {
    ...member,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  careTeamMembers.set(memberId, updatedMember);
  return updatedMember;
}

export function updateMemberAvailability(
  memberId: string,
  status: MemberAvailabilityStatus,
  shift?: CareTeamMemberExtended["currentShift"],
  shiftEndTime?: string
): CareTeamMemberExtended | null {
  return updateCareTeamMember(memberId, {
    availabilityStatus: status,
    currentShift: shift,
    shiftEndTime,
    lastActiveAt: new Date().toISOString(),
  });
}

export function removeCareTeamMember(memberId: string): boolean {
  return careTeamMembers.delete(memberId);
}

export function updateMemberWorkload(memberId: string): void {
  const member = careTeamMembers.get(memberId);
  if (!member) return;

  const activeTasks = Array.from(careTeamTasks.values())
    .filter(t => t.assignedTo === memberId && t.status !== "completed" && t.status !== "cancelled")
    .length;

  const pendingHandoffs = Array.from(careHandoffs.values())
    .filter(h => h.toMemberId === memberId && h.status === "pending")
    .length;

  member.workload = {
    ...member.workload,
    activeTasks,
    pendingHandoffs,
  };
  careTeamMembers.set(memberId, member);
}

// ==================== CARE PROTOCOL TEMPLATES ====================

export function createProtocolTemplate(data: InsertCareProtocolTemplate): CareProtocolTemplate {
  const template: CareProtocolTemplate = {
    id: generateId(),
    ...data,
    isActive: data.isActive ?? true,
    triggers: data.triggers || [],
    checklistItems: data.checklistItems || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  careProtocolTemplates.set(template.id, template);
  return template;
}

export function getProtocolTemplates(category?: CareProtocolTemplate["category"]): CareProtocolTemplate[] {
  let templates = Array.from(careProtocolTemplates.values()).filter(t => t.isActive);
  if (category) {
    templates = templates.filter(t => t.category === category);
  }
  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

export function getProtocolTemplateById(templateId: string): CareProtocolTemplate | undefined {
  return careProtocolTemplates.get(templateId);
}

export function updateProtocolTemplate(
  templateId: string,
  updates: Partial<CareProtocolTemplate>
): CareProtocolTemplate | null {
  const template = careProtocolTemplates.get(templateId);
  if (!template) return null;

  const updatedTemplate: CareProtocolTemplate = {
    ...template,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  careProtocolTemplates.set(templateId, updatedTemplate);
  return updatedTemplate;
}

export function applyProtocolToCarePlan(
  templateId: string,
  carePlanId: string,
  patientId: string,
  assignedMembers: Record<CareTeamRole, string>, // role -> memberId mapping
  creatorId: string,
  creatorName: string,
  creatorRole: CareTeamRole
): CareTeamTask[] {
  const template = careProtocolTemplates.get(templateId);
  if (!template) return [];

  const now = new Date();
  const createdTasks: CareTeamTask[] = [];

  for (const taskTemplate of template.tasks) {
    const assignedTo = assignedMembers[taskTemplate.assignToRole] || creatorId;
    const dueDate = new Date(now.getTime() + taskTemplate.dueInHours * 60 * 60 * 1000);

    const task: CareTeamTask = {
      id: generateId(),
      carePlanId,
      patientId,
      title: taskTemplate.title,
      description: taskTemplate.description,
      priority: taskTemplate.priority,
      status: "pending",
      assignedTo,
      assignedBy: creatorId,
      dueDate: dueDate.toISOString(),
      category: taskTemplate.category,
      notes: `Created from protocol: ${template.name}`,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    careTeamTasks.set(task.id, task);
    createdTasks.push(task);
  }

  logActivity(
    carePlanId,
    patientId,
    "task_created",
    creatorId,
    creatorName,
    creatorRole,
    `Applied protocol "${template.name}" - created ${createdTasks.length} tasks`,
    templateId,
    "task",
    { protocolName: template.name, taskCount: createdTasks.length }
  );

  return createdTasks;
}

// ==================== ESCALATION RULES ====================

export function createEscalationRule(data: InsertEscalationRule): EscalationRule {
  const rule: EscalationRule = {
    id: generateId(),
    ...data,
    isActive: data.isActive ?? true,
    carePlanIds: data.carePlanIds || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  escalationRules.set(rule.id, rule);
  return rule;
}

export function getEscalationRules(activeOnly = true): EscalationRule[] {
  let rules = Array.from(escalationRules.values());
  if (activeOnly) {
    rules = rules.filter(r => r.isActive);
  }
  return rules.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

export function getEscalationRuleById(ruleId: string): EscalationRule | undefined {
  return escalationRules.get(ruleId);
}

export function updateEscalationRule(
  ruleId: string,
  updates: Partial<EscalationRule>
): EscalationRule | null {
  const rule = escalationRules.get(ruleId);
  if (!rule) return null;

  const updatedRule: EscalationRule = {
    ...rule,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  escalationRules.set(ruleId, updatedRule);
  return updatedRule;
}

export function checkEscalations(): EscalationEvent[] {
  const now = new Date();
  const triggeredEvents: EscalationEvent[] = [];
  const rules = getEscalationRules(true);

  for (const rule of rules) {
    if (rule.trigger === "task_overdue") {
      const overdueTasks = Array.from(careTeamTasks.values()).filter(task => {
        if (task.status === "completed" || task.status === "cancelled") return false;
        const dueDate = new Date(task.dueDate);
        const overdueHours = (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60);
        
        if (rule.triggerCondition.thresholdHours && overdueHours < rule.triggerCondition.thresholdHours) {
          return false;
        }
        if (rule.triggerCondition.priority && !rule.triggerCondition.priority.includes(task.priority)) {
          return false;
        }
        return overdueHours > 0;
      });

      for (const task of overdueTasks) {
        // Check if already escalated
        const existingEvent = Array.from(escalationEvents.values()).find(
          e => e.ruleId === rule.id && e.taskId === task.id && e.status !== "resolved" && e.status !== "dismissed"
        );
        if (existingEvent) continue;

        const event: EscalationEvent = {
          id: generateId(),
          ruleId: rule.id,
          ruleName: rule.name,
          trigger: rule.trigger,
          severity: rule.severity,
          carePlanId: task.carePlanId,
          patientId: task.patientId,
          taskId: task.id,
          triggeredBy: "system",
          actionsTaken: rule.actions.map(a => ({
            action: a.action,
            target: a.target || "",
          })),
          status: "pending",
          createdAt: now.toISOString(),
        };
        escalationEvents.set(event.id, event);
        triggeredEvents.push(event);
      }
    }

    if (rule.trigger === "handoff_pending") {
      const pendingHandoffs = Array.from(careHandoffs.values()).filter(handoff => {
        if (handoff.status !== "pending") return false;
        const createdAt = new Date(handoff.createdAt);
        const pendingMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);
        
        if (rule.triggerCondition.thresholdMinutes && pendingMinutes < rule.triggerCondition.thresholdMinutes) {
          return false;
        }
        return pendingMinutes > 30; // Default 30 minutes
      });

      for (const handoff of pendingHandoffs) {
        const existingEvent = Array.from(escalationEvents.values()).find(
          e => e.ruleId === rule.id && e.handoffId === handoff.id && e.status !== "resolved" && e.status !== "dismissed"
        );
        if (existingEvent) continue;

        const event: EscalationEvent = {
          id: generateId(),
          ruleId: rule.id,
          ruleName: rule.name,
          trigger: rule.trigger,
          severity: rule.severity,
          carePlanId: handoff.carePlanId,
          patientId: handoff.patientId,
          handoffId: handoff.id,
          triggeredBy: "system",
          actionsTaken: rule.actions.map(a => ({
            action: a.action,
            target: a.target || "",
          })),
          status: "pending",
          createdAt: now.toISOString(),
        };
        escalationEvents.set(event.id, event);
        triggeredEvents.push(event);
      }
    }
  }

  return triggeredEvents;
}

export function getEscalationEvents(status?: EscalationEvent["status"]): EscalationEvent[] {
  let events = Array.from(escalationEvents.values());
  if (status) {
    events = events.filter(e => e.status === status);
  }
  return events.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

export function resolveEscalationEvent(
  eventId: string,
  resolvedBy: string,
  resolutionNotes: string
): EscalationEvent | null {
  const event = escalationEvents.get(eventId);
  if (!event) return null;

  const resolvedEvent: EscalationEvent = {
    ...event,
    status: "resolved",
    resolvedBy,
    resolvedAt: new Date().toISOString(),
    resolutionNotes,
  };
  escalationEvents.set(eventId, resolvedEvent);
  return resolvedEvent;
}

export function dismissEscalationEvent(
  eventId: string,
  dismissedBy: string,
  reason: string
): EscalationEvent | null {
  const event = escalationEvents.get(eventId);
  if (!event) return null;

  const dismissedEvent: EscalationEvent = {
    ...event,
    status: "dismissed",
    resolvedBy: dismissedBy,
    resolvedAt: new Date().toISOString(),
    resolutionNotes: `Dismissed: ${reason}`,
  };
  escalationEvents.set(eventId, dismissedEvent);
  return dismissedEvent;
}

// ==================== TEAM PERFORMANCE METRICS ====================

export function getTeamPerformanceMetrics(
  carePlanId?: string,
  period: "daily" | "weekly" | "monthly" = "weekly"
): TeamPerformanceMetrics {
  const now = new Date();
  let periodStart: Date;
  
  switch (period) {
    case "daily":
      periodStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "weekly":
      periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "monthly":
      periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  // Filter tasks by care plan if specified
  let tasks = Array.from(careTeamTasks.values());
  let handoffs = Array.from(careHandoffs.values());
  let notes = Array.from(careTeamNotes.values());
  let events = Array.from(escalationEvents.values());

  if (carePlanId) {
    tasks = tasks.filter(t => t.carePlanId === carePlanId);
    handoffs = handoffs.filter(h => h.carePlanId === carePlanId);
    notes = notes.filter(n => n.carePlanId === carePlanId);
    events = events.filter(e => e.carePlanId === carePlanId);
  }

  // Filter by period
  tasks = tasks.filter(t => new Date(t.createdAt) >= periodStart);
  handoffs = handoffs.filter(h => new Date(h.createdAt) >= periodStart);
  notes = notes.filter(n => new Date(n.createdAt) >= periodStart);
  events = events.filter(e => new Date(e.createdAt) >= periodStart);

  const completedTasks = tasks.filter(t => t.status === "completed");
  const overdueTasks = tasks.filter(t => 
    t.status !== "completed" && t.status !== "cancelled" && new Date(t.dueDate) < now
  );
  const completedHandoffs = handoffs.filter(h => h.status === "completed");

  // Calculate average completion time
  const completionTimes = completedTasks
    .filter(t => t.completedAt)
    .map(t => {
      const created = new Date(t.createdAt).getTime();
      const completed = new Date(t.completedAt!).getTime();
      return (completed - created) / (1000 * 60 * 60); // hours
    });
  const avgCompletionTime = completionTimes.length > 0 
    ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length 
    : 0;

  // Calculate handoff response time
  const responseTimes = completedHandoffs
    .filter(h => h.acceptedAt)
    .map(h => {
      const created = new Date(h.createdAt).getTime();
      const accepted = new Date(h.acceptedAt!).getTime();
      return (accepted - created) / (1000 * 60); // minutes
    });
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  // Workload distribution
  const memberTaskCounts = new Map<string, { count: number; name: string; role: CareTeamRole }>();
  for (const task of tasks) {
    const existing = memberTaskCounts.get(task.assignedTo) || { count: 0, name: task.assignedTo, role: "other" as CareTeamRole };
    existing.count++;
    memberTaskCounts.set(task.assignedTo, existing);
  }

  const totalTaskCount = tasks.length || 1;
  const workloadDistribution = Array.from(memberTaskCounts.entries()).map(([memberId, data]) => ({
    memberId,
    memberName: data.name,
    role: data.role,
    taskCount: data.count,
    percentage: Math.round((data.count / totalTaskCount) * 100),
  }));

  // Member metrics
  const members = Array.from(careTeamMembers.values());
  const memberMetrics: TeamMemberMetrics[] = members.map(member => {
    const memberTasks = tasks.filter(t => t.assignedTo === member.id);
    const memberCompletedTasks = memberTasks.filter(t => t.status === "completed");
    const memberOverdueTasks = memberTasks.filter(t => 
      t.status !== "completed" && t.status !== "cancelled" && new Date(t.dueDate) < now
    );
    const memberHandoffs = handoffs.filter(h => h.toMemberId === member.id);
    const memberNotes = notes.filter(n => n.authorId === member.id);

    const memberCompletionTimes = memberCompletedTasks
      .filter(t => t.completedAt)
      .map(t => {
        const created = new Date(t.createdAt).getTime();
        const completed = new Date(t.completedAt!).getTime();
        return (completed - created) / (1000 * 60 * 60);
      });

    return {
      memberId: member.id,
      memberName: member.name,
      role: member.role,
      period,
      periodStart: periodStart.toISOString(),
      periodEnd: now.toISOString(),
      tasksAssigned: memberTasks.length,
      tasksCompleted: memberCompletedTasks.length,
      tasksOverdue: memberOverdueTasks.length,
      averageCompletionTimeHours: memberCompletionTimes.length > 0
        ? memberCompletionTimes.reduce((a, b) => a + b, 0) / memberCompletionTimes.length
        : 0,
      handoffsReceived: memberHandoffs.length,
      handoffsCompleted: memberHandoffs.filter(h => h.status === "completed").length,
      averageHandoffResponseMinutes: 30, // simplified
      notesAdded: memberNotes.length,
      patientInteractions: memberTasks.length + memberNotes.length,
      escalationsTriggered: events.filter(e => 
        tasks.find(t => t.id === e.taskId && t.assignedTo === member.id)
      ).length,
      workloadScore: Math.min(100, member.workload.activeTasks * 10 + member.workload.pendingHandoffs * 20),
      responseTimeScore: 80, // simplified
      collaborationScore: Math.min(100, memberNotes.length * 10 + memberHandoffs.length * 15),
    };
  });

  // Trends (simplified - daily counts for the period)
  const trends: { date: string; tasksCompleted: number; tasksCreated: number; escalations: number }[] = [];
  const dayMs = 24 * 60 * 60 * 1000;
  const daysInPeriod = period === "daily" ? 1 : period === "weekly" ? 7 : 30;

  for (let i = 0; i < daysInPeriod; i++) {
    const dayStart = new Date(now.getTime() - (daysInPeriod - i) * dayMs);
    const dayEnd = new Date(dayStart.getTime() + dayMs);

    trends.push({
      date: dayStart.toISOString().split("T")[0],
      tasksCompleted: completedTasks.filter(t => {
        const completed = t.completedAt ? new Date(t.completedAt) : null;
        return completed && completed >= dayStart && completed < dayEnd;
      }).length,
      tasksCreated: tasks.filter(t => {
        const created = new Date(t.createdAt);
        return created >= dayStart && created < dayEnd;
      }).length,
      escalations: events.filter(e => {
        const created = new Date(e.createdAt);
        return created >= dayStart && created < dayEnd;
      }).length,
    });
  }

  return {
    carePlanId,
    period,
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
    overview: {
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      overdueRate: tasks.length > 0 ? Math.round((overdueTasks.length / tasks.length) * 100) : 0,
      averageCompletionTimeHours: Math.round(avgCompletionTime * 10) / 10,
      escalationRate: tasks.length > 0 ? Math.round((events.length / tasks.length) * 100) : 0,
    },
    handoffMetrics: {
      totalHandoffs: handoffs.length,
      completedHandoffs: completedHandoffs.length,
      averageResponseTimeMinutes: Math.round(avgResponseTime),
      declinedHandoffs: handoffs.filter(h => h.status === "declined").length,
    },
    communicationMetrics: {
      totalNotes: notes.length,
      urgentNotes: notes.filter(n => n.isUrgent).length,
      averageNotesPerDay: Math.round((notes.length / daysInPeriod) * 10) / 10,
      teamEngagementScore: Math.min(100, notes.length * 5 + handoffs.length * 10),
    },
    workloadDistribution,
    memberMetrics,
    trends,
  };
}

function initializeSampleData(): void {
  const sampleTasks: CareTeamTask[] = [
    {
      id: "task-1",
      carePlanId: "cp-1",
      patientId: "patient-1",
      title: "Review blood pressure readings",
      description: "Analyze home BP monitoring data from the past week and adjust medication if needed",
      priority: "high",
      status: "pending",
      assignedTo: "dr-smith",
      assignedBy: "nurse-johnson",
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      category: "assessment",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "task-2",
      carePlanId: "cp-1",
      patientId: "patient-1",
      title: "Schedule follow-up appointment",
      description: "Coordinate with patient to schedule 2-week follow-up visit",
      priority: "normal",
      status: "in_progress",
      assignedTo: "care-coord-1",
      assignedBy: "dr-smith",
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      category: "coordination",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "task-3",
      carePlanId: "cp-1",
      patientId: "patient-1",
      title: "Diabetes education session",
      description: "Provide patient education on blood sugar monitoring and dietary changes",
      priority: "normal",
      status: "pending",
      assignedTo: "nurse-johnson",
      assignedBy: "dr-smith",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      category: "patient_education",
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const sampleHandoffs: CareHandoff[] = [
    {
      id: "handoff-1",
      carePlanId: "cp-1",
      patientId: "patient-1",
      fromMemberId: "dr-smith",
      fromMemberName: "Dr. Sarah Smith",
      toMemberId: "dr-jones",
      toMemberName: "Dr. Michael Jones",
      urgency: "routine",
      status: "pending",
      reason: "Weekend coverage handoff",
      summary: "Patient is stable on current medication regimen. Continue monitoring BP and glucose levels.",
      pendingTasks: ["Review blood pressure readings"],
      criticalInfo: ["Patient has penicillin allergy", "Currently on Lisinopril 10mg daily"],
      medications: ["Lisinopril 10mg daily", "Metformin 500mg twice daily"],
      recentChanges: ["Increased Lisinopril from 5mg to 10mg on 01/15"],
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const sampleNotes: CareTeamNote[] = [
    {
      id: "note-1",
      carePlanId: "cp-1",
      patientId: "patient-1",
      authorId: "nurse-johnson",
      authorName: "Nurse Emily Johnson",
      authorRole: "nurse",
      content: "Patient called with questions about medication timing. Advised to take Lisinopril in the morning with breakfast. Patient verbalized understanding.",
      visibility: "team",
      mentions: ["dr-smith"],
      isUrgent: false,
      readBy: ["nurse-johnson"],
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "note-2",
      carePlanId: "cp-1",
      patientId: "patient-1",
      authorId: "dr-smith",
      authorName: "Dr. Sarah Smith",
      authorRole: "primary_physician",
      content: "Lab results show improved A1C (7.2% down from 8.1%). Continue current treatment plan. Schedule nutrition consult to reinforce dietary changes.",
      visibility: "team",
      mentions: [],
      isUrgent: false,
      readBy: ["dr-smith", "nurse-johnson"],
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  sampleTasks.forEach(t => careTeamTasks.set(t.id, t));
  sampleHandoffs.forEach(h => careHandoffs.set(h.id, h));
  sampleNotes.forEach(n => careTeamNotes.set(n.id, n));

  const sampleActivities: CareTeamActivity[] = [
    {
      id: "activity-1",
      carePlanId: "cp-1",
      patientId: "patient-1",
      type: "note_added",
      actorId: "dr-smith",
      actorName: "Dr. Sarah Smith",
      actorRole: "primary_physician",
      description: "Added team note about lab results",
      relatedEntityId: "note-2",
      relatedEntityType: "note",
      isRead: false,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "activity-2",
      carePlanId: "cp-1",
      patientId: "patient-1",
      type: "task_created",
      actorId: "dr-smith",
      actorName: "Dr. Sarah Smith",
      actorRole: "primary_physician",
      description: "Created task: \"Diabetes education session\"",
      relatedEntityId: "task-3",
      relatedEntityType: "task",
      isRead: false,
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "activity-3",
      carePlanId: "cp-1",
      patientId: "patient-1",
      type: "handoff_initiated",
      actorId: "dr-smith",
      actorName: "Dr. Sarah Smith",
      actorRole: "primary_physician",
      description: "Initiated care handoff to Dr. Michael Jones",
      relatedEntityId: "handoff-1",
      relatedEntityType: "handoff",
      isRead: false,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ];

  sampleActivities.forEach(a => careTeamActivities.set(a.id, a));

  // Sample Care Team Members
  const sampleMembers: CareTeamMemberExtended[] = [
    {
      id: "dr-smith",
      userId: "user-dr-smith",
      name: "Dr. Sarah Smith",
      role: "primary_physician",
      specialty: "Internal Medicine",
      credentials: ["MD", "FACP"],
      phone: "(555) 123-4567",
      email: "sarah.smith@hospital.org",
      organization: "City General Hospital",
      department: "Internal Medicine",
      isPrimary: true,
      availabilityStatus: "available",
      currentShift: "day",
      shiftStartTime: "08:00",
      shiftEndTime: "17:00",
      workload: { activeTasks: 5, pendingHandoffs: 1, patientsAssigned: 12 },
      skills: ["Diabetes Management", "Hypertension", "Preventive Care"],
      certifications: ["Board Certified Internal Medicine", "ACLS"],
      preferredContactMethod: "secure_message",
      joinedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "nurse-johnson",
      userId: "user-nurse-johnson",
      name: "Emily Johnson, RN",
      role: "nurse",
      specialty: "Care Coordination",
      credentials: ["RN", "BSN"],
      phone: "(555) 234-5678",
      email: "emily.johnson@hospital.org",
      organization: "City General Hospital",
      department: "Care Management",
      isPrimary: false,
      availabilityStatus: "available",
      currentShift: "day",
      workload: { activeTasks: 8, pendingHandoffs: 0, patientsAssigned: 25 },
      skills: ["Patient Education", "Care Coordination", "Chronic Disease Management"],
      certifications: ["RN License", "Care Coordinator Certification"],
      preferredContactMethod: "phone",
      supervisorId: "dr-smith",
      joinedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "dr-jones",
      userId: "user-dr-jones",
      name: "Dr. Michael Jones",
      role: "specialist",
      specialty: "Endocrinology",
      credentials: ["MD", "PhD"],
      phone: "(555) 345-6789",
      email: "michael.jones@hospital.org",
      organization: "City General Hospital",
      department: "Endocrinology",
      isPrimary: false,
      availabilityStatus: "on_call",
      currentShift: "on_call",
      workload: { activeTasks: 3, pendingHandoffs: 2, patientsAssigned: 8 },
      skills: ["Diabetes", "Thyroid Disorders", "Metabolic Conditions"],
      certifications: ["Board Certified Endocrinology"],
      preferredContactMethod: "email",
      joinedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "care-coord-1",
      userId: "user-care-coord-1",
      name: "Maria Garcia",
      role: "care_coordinator",
      credentials: ["MSW", "CCM"],
      phone: "(555) 456-7890",
      email: "maria.garcia@hospital.org",
      organization: "City General Hospital",
      department: "Care Management",
      isPrimary: false,
      availabilityStatus: "busy",
      currentShift: "day",
      workload: { activeTasks: 12, pendingHandoffs: 3, patientsAssigned: 35 },
      skills: ["Care Transitions", "Resource Coordination", "Patient Advocacy"],
      certifications: ["Certified Case Manager"],
      preferredContactMethod: "secure_message",
      supervisorId: "nurse-johnson",
      joinedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  sampleMembers.forEach(m => careTeamMembers.set(m.id, m));

  // Sample Protocol Templates
  const sampleProtocols: CareProtocolTemplate[] = [
    {
      id: "protocol-discharge",
      name: "Standard Discharge Protocol",
      description: "Comprehensive discharge planning protocol for patients leaving inpatient care",
      category: "discharge",
      isActive: true,
      estimatedDuration: "48 hours",
      tasks: [
        { title: "Medication Reconciliation", description: "Review and reconcile all medications", assignToRole: "pharmacist", priority: "high", category: "medication", dueInHours: 4, isRequired: true },
        { title: "Discharge Instructions", description: "Prepare patient discharge instructions", assignToRole: "nurse", priority: "high", category: "documentation", dueInHours: 8, isRequired: true },
        { title: "Follow-up Appointment", description: "Schedule follow-up appointment within 7 days", assignToRole: "care_coordinator", priority: "normal", category: "coordination", dueInHours: 24, isRequired: true },
        { title: "Patient Education", description: "Provide education on medications and warning signs", assignToRole: "nurse", priority: "normal", category: "patient_education", dueInHours: 12, isRequired: true },
      ],
      checklistItems: ["Verify transportation", "Confirm pharmacy pickup", "Provide emergency contact numbers"],
      requiredRoles: ["nurse", "pharmacist", "care_coordinator"],
      createdBy: "admin",
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "protocol-chronic-dm",
      name: "Diabetes Management Protocol",
      description: "Ongoing care protocol for patients with Type 2 Diabetes",
      category: "chronic_care",
      isActive: true,
      estimatedDuration: "Ongoing",
      tasks: [
        { title: "A1C Review", description: "Review latest A1C results and adjust treatment", assignToRole: "primary_physician", priority: "high", category: "assessment", dueInHours: 24, isRequired: true },
        { title: "Foot Exam", description: "Complete diabetic foot examination", assignToRole: "nurse", priority: "normal", category: "assessment", dueInHours: 48, isRequired: true },
        { title: "Nutrition Consult", description: "Refer to nutritionist for dietary counseling", assignToRole: "care_coordinator", priority: "normal", category: "coordination", dueInHours: 72, isRequired: false },
        { title: "Self-Management Education", description: "Review blood glucose monitoring technique", assignToRole: "nurse", priority: "normal", category: "patient_education", dueInHours: 48, isRequired: true },
      ],
      requiredRoles: ["primary_physician", "nurse"],
      createdBy: "admin",
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "protocol-post-procedure",
      name: "Post-Procedure Follow-up",
      description: "Standard follow-up protocol after minor procedures",
      category: "post_procedure",
      isActive: true,
      estimatedDuration: "7 days",
      tasks: [
        { title: "24-Hour Check-in", description: "Call patient to assess recovery", assignToRole: "nurse", priority: "high", category: "follow_up", dueInHours: 24, isRequired: true },
        { title: "Wound Assessment", description: "Evaluate wound healing if applicable", assignToRole: "nurse", priority: "normal", category: "assessment", dueInHours: 72, isRequired: false },
        { title: "Results Review", description: "Review procedure results with patient", assignToRole: "primary_physician", priority: "normal", category: "documentation", dueInHours: 120, isRequired: true },
      ],
      requiredRoles: ["nurse", "primary_physician"],
      createdBy: "admin",
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  sampleProtocols.forEach(p => careProtocolTemplates.set(p.id, p));

  // Sample Escalation Rules
  const sampleEscalationRules: EscalationRule[] = [
    {
      id: "rule-task-overdue-urgent",
      name: "Urgent Task Overdue",
      description: "Escalate when urgent priority tasks are overdue by more than 2 hours",
      trigger: "task_overdue",
      triggerCondition: {
        thresholdHours: 2,
        priority: ["urgent"],
        excludeWeekends: false,
      },
      actions: [
        { action: "notify_supervisor", message: "Urgent task overdue - immediate attention required" },
        { action: "send_alert", target: "care_coordinator", message: "Please review overdue urgent task" },
      ],
      severity: "critical",
      isActive: true,
      appliesTo: "all",
      notifyPatient: false,
      createdBy: "admin",
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "rule-handoff-pending",
      name: "Handoff Pending Too Long",
      description: "Escalate when care handoffs are not acknowledged within 60 minutes",
      trigger: "handoff_pending",
      triggerCondition: {
        thresholdMinutes: 60,
      },
      actions: [
        { action: "notify_team", message: "Care handoff awaiting acknowledgment" },
        { action: "page_on_call", delayMinutes: 30, message: "Urgent: Unacknowledged care handoff" },
      ],
      severity: "high",
      isActive: true,
      appliesTo: "all",
      notifyPatient: false,
      createdBy: "admin",
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "rule-task-overdue-standard",
      name: "Standard Task Overdue",
      description: "Escalate when normal/high priority tasks are overdue by more than 24 hours",
      trigger: "task_overdue",
      triggerCondition: {
        thresholdHours: 24,
        priority: ["high", "normal"],
        excludeWeekends: true,
      },
      actions: [
        { action: "send_alert", target: "assignee", message: "Task overdue - please complete or request reassignment" },
        { action: "notify_supervisor", delayMinutes: 120, message: "Task remains overdue after 2 hours" },
      ],
      severity: "medium",
      isActive: true,
      appliesTo: "all",
      notifyPatient: false,
      createdBy: "admin",
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  sampleEscalationRules.forEach(r => escalationRules.set(r.id, r));
}

initializeSampleData();

console.log("[CareTeamCollaboration] Service initialized with sample data");
