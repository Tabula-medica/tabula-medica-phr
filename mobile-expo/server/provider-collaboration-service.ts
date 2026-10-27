// @ts-nocheck
import { db } from "./db";
import { eq, and, or, desc, sql, gte, lte, inArray, isNull, lt } from "drizzle-orm";
import { chatComplete } from "./ai-client";
import {
  careTeams,
  careTeamMembers,
  sharedPatientAccess,
  collaborationTasks,
  taskComments,
  sharedCarePlans,
  patientSummaries,
  collaborationAuditLogs,
  providerMessageThreads,
  providerMessages,
  providerProfiles,
  carePlans,
  healthRecords,
  users,
  teamInvitations,
  carePlanNotes,
  messagingThreads,
  secureMessages,
  careTeamMessageParticipants,
  InsertCareTeam,
  InsertCareTeamMember,
  InsertSharedPatientAccess,
  InsertCollaborationTask,
  InsertTaskComment,
  InsertSharedCarePlan,
  InsertPatientSummary,
  InsertCollaborationAuditLog,
  InsertTeamInvitation,
  InsertCarePlanNote,
  InsertCareTeamMessageParticipant,
  CareTeam,
  CareTeamMember,
  SharedPatientAccess,
  CollaborationTask,
  PatientSummary,
  TeamInvitation,
  CarePlanNote,
  CareTeamMessageParticipant,
  InsertProviderMessageThread,
  InsertProviderMessage,
} from "@shared/schema";
import crypto from "crypto";

export class ProviderCollaborationService {
  async logCollaborationAction(log: InsertCollaborationAuditLog): Promise<void> {
    await db.insert(collaborationAuditLogs).values(log);
  }

  async createCareTeam(
    data: InsertCareTeam,
    actorId: string,
    actorName: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<CareTeam> {
    const [team] = await db.insert(careTeams).values(data).returning();
    
    await this.logCollaborationAction({
      actorId,
      actorType: "provider",
      actorName,
      action: "team_created",
      resourceType: "care_team",
      resourceId: team.id,
      patientId: data.patientId || undefined,
      careTeamId: team.id,
      details: { teamName: data.name, teamType: data.teamType },
      ipAddress,
      userAgent,
      phiAccessed: false,
    });

    return team;
  }

  async getCareTeams(providerId: string): Promise<CareTeam[]> {
    const memberTeams = await db
      .select({ careTeamId: careTeamMembers.careTeamId })
      .from(careTeamMembers)
      .where(and(eq(careTeamMembers.providerId, providerId), eq(careTeamMembers.isActive, true)));

    if (memberTeams.length === 0) {
      return [];
    }

    const teamIds = memberTeams.map((m) => m.careTeamId);
    return db.select().from(careTeams).where(inArray(careTeams.id, teamIds));
  }

  async getCareTeam(teamId: string): Promise<CareTeam | undefined> {
    const [team] = await db.select().from(careTeams).where(eq(careTeams.id, teamId));
    return team;
  }

  async getSharedAccessById(accessId: string): Promise<typeof sharedPatientAccess.$inferSelect | null> {
    const [access] = await db
      .select()
      .from(sharedPatientAccess)
      .where(eq(sharedPatientAccess.id, accessId));
    return access || null;
  }

  async hasUserAccessToCareTeam(teamId: string, userId: string): Promise<boolean> {
    const [team] = await db
      .select({ patientId: careTeams.patientId, createdById: careTeams.createdById })
      .from(careTeams)
      .where(eq(careTeams.id, teamId));
    if (!team) return false;
    if (team.patientId === userId || team.createdById === userId) return true;
    const [providerProfile] = await db
      .select({ id: providerProfiles.id })
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId));
    if (!providerProfile) return false;
    const [membership] = await db
      .select({ id: careTeamMembers.id })
      .from(careTeamMembers)
      .where(
        and(
          eq(careTeamMembers.careTeamId, teamId),
          eq(careTeamMembers.providerId, providerProfile.id),
          eq(careTeamMembers.isActive, true)
        )
      )
      .limit(1);
    return !!membership;
  }

  async getCareTeamMembers(teamId: string): Promise<(CareTeamMember & { provider: typeof providerProfiles.$inferSelect })[]> {
    const members = await db
      .select({
        member: careTeamMembers,
        provider: providerProfiles,
      })
      .from(careTeamMembers)
      .innerJoin(providerProfiles, eq(careTeamMembers.providerId, providerProfiles.id))
      .where(and(eq(careTeamMembers.careTeamId, teamId), eq(careTeamMembers.isActive, true)));

    return members.map((m) => ({ ...m.member, provider: m.provider }));
  }

  async addCareTeamMember(
    data: InsertCareTeamMember,
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<CareTeamMember> {
    const [member] = await db.insert(careTeamMembers).values(data).returning();
    
    const [provider] = await db
      .select()
      .from(providerProfiles)
      .where(eq(providerProfiles.id, data.providerId));

    await this.logCollaborationAction({
      actorId,
      actorType: "provider",
      actorName,
      action: "team_member_added",
      resourceType: "care_team",
      resourceId: data.careTeamId,
      careTeamId: data.careTeamId,
      details: { memberName: provider?.name, role: data.role },
      ipAddress,
      phiAccessed: false,
    });

    return member;
  }

  async removeCareTeamMember(
    teamId: string,
    memberId: string,
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<boolean> {
    const [member] = await db
      .select()
      .from(careTeamMembers)
      .innerJoin(providerProfiles, eq(careTeamMembers.providerId, providerProfiles.id))
      .where(
        and(
          eq(careTeamMembers.id, memberId),
          eq(careTeamMembers.careTeamId, teamId),
          eq(careTeamMembers.isActive, true)
        )
      );

    if (!member) {
      throw Object.assign(new Error("Care team member not found"), { statusCode: 404 });
    }

    await db
      .update(careTeamMembers)
      .set({ isActive: false })
      .where(
        and(
          eq(careTeamMembers.id, memberId),
          eq(careTeamMembers.careTeamId, teamId)
        )
      );

    await this.logCollaborationAction({
      actorId,
      actorType: "provider",
      actorName,
      action: "team_member_removed",
      resourceType: "care_team",
      resourceId: teamId,
      careTeamId: teamId,
      details: { removedMemberId: memberId },
      ipAddress,
      phiAccessed: false,
    });

    return true;
  }

  async grantPatientAccess(
    data: InsertSharedPatientAccess,
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<SharedPatientAccess> {
    const [access] = await db.insert(sharedPatientAccess).values(data).returning();

    await this.logCollaborationAction({
      actorId,
      actorType: "patient",
      actorName,
      action: "access_granted",
      resourceType: "shared_access",
      resourceId: access.id,
      patientId: data.patientId,
      details: {
        grantedToType: data.grantedToType,
        accessLevel: data.accessLevel,
        purposeOfUse: data.purposeOfUse,
        expiresAt: data.expiresAt,
      },
      ipAddress,
      phiAccessed: false,
      sensitivityLevel: "sensitive",
    });

    return access;
  }

  async revokePatientAccess(
    accessId: string,
    revokedBy: string,
    reason: string,
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<void> {
    const [access] = await db
      .select()
      .from(sharedPatientAccess)
      .where(eq(sharedPatientAccess.id, accessId));

    await db
      .update(sharedPatientAccess)
      .set({
        isActive: false,
        revokedAt: new Date(),
        revokedBy,
        revokeReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(sharedPatientAccess.id, accessId));

    await this.logCollaborationAction({
      actorId,
      actorType: access?.grantedToType === "provider" ? "provider" : "patient",
      actorName,
      action: "access_revoked",
      resourceType: "shared_access",
      resourceId: accessId,
      patientId: access?.patientId,
      details: { reason, accessLevel: access?.accessLevel },
      ipAddress,
      phiAccessed: false,
      sensitivityLevel: "sensitive",
    });
  }

  async getPatientAccessList(patientId: string): Promise<SharedPatientAccess[]> {
    return db
      .select()
      .from(sharedPatientAccess)
      .where(and(eq(sharedPatientAccess.patientId, patientId), eq(sharedPatientAccess.isActive, true)));
  }

  async checkProviderAccess(
    providerId: string,
    patientId: string
  ): Promise<{ hasAccess: boolean; accessLevel: string | null; allowedTypes: string[] | null }> {
    const directAccess = await db
      .select()
      .from(sharedPatientAccess)
      .where(
        and(
          eq(sharedPatientAccess.patientId, patientId),
          eq(sharedPatientAccess.grantedToId, providerId),
          eq(sharedPatientAccess.grantedToType, "provider"),
          eq(sharedPatientAccess.isActive, true),
          or(isNull(sharedPatientAccess.expiresAt), gte(sharedPatientAccess.expiresAt, new Date()))
        )
      );

    if (directAccess.length > 0) {
      return {
        hasAccess: true,
        accessLevel: directAccess[0].accessLevel,
        allowedTypes: directAccess[0].allowedRecordTypes as string[] | null,
      };
    }

    const teamMemberships = await db
      .select({ careTeamId: careTeamMembers.careTeamId })
      .from(careTeamMembers)
      .where(and(eq(careTeamMembers.providerId, providerId), eq(careTeamMembers.isActive, true)));

    if (teamMemberships.length > 0) {
      const teamIds = teamMemberships.map((m) => m.careTeamId);
      const teamAccess = await db
        .select()
        .from(sharedPatientAccess)
        .where(
          and(
            eq(sharedPatientAccess.patientId, patientId),
            inArray(sharedPatientAccess.grantedToId, teamIds),
            eq(sharedPatientAccess.grantedToType, "care_team"),
            eq(sharedPatientAccess.isActive, true),
            or(isNull(sharedPatientAccess.expiresAt), gte(sharedPatientAccess.expiresAt, new Date()))
          )
        );

      if (teamAccess.length > 0) {
        return {
          hasAccess: true,
          accessLevel: teamAccess[0].accessLevel,
          allowedTypes: teamAccess[0].allowedRecordTypes as string[] | null,
        };
      }
    }

    return { hasAccess: false, accessLevel: null, allowedTypes: null };
  }

  async createTask(
    data: InsertCollaborationTask,
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<CollaborationTask> {
    const [task] = await db.insert(collaborationTasks).values(data).returning();

    await this.logCollaborationAction({
      actorId,
      actorType: "provider",
      actorName,
      action: "task_created",
      resourceType: "task",
      resourceId: task.id,
      patientId: data.patientId,
      careTeamId: data.careTeamId || undefined,
      details: { title: data.title, taskType: data.taskType, priority: data.priority },
      ipAddress,
      phiAccessed: true,
    });

    return task;
  }

  async getTasks(
    patientId?: string,
    careTeamId?: string,
    assignedToId?: string
  ): Promise<CollaborationTask[]> {
    let query = db.select().from(collaborationTasks);
    const conditions = [];

    if (patientId) conditions.push(eq(collaborationTasks.patientId, patientId));
    if (careTeamId) conditions.push(eq(collaborationTasks.careTeamId, careTeamId));
    if (assignedToId) conditions.push(eq(collaborationTasks.assignedToId, assignedToId));

    if (conditions.length > 0) {
      return db
        .select()
        .from(collaborationTasks)
        .where(and(...conditions))
        .orderBy(desc(collaborationTasks.createdAt));
    }

    return db.select().from(collaborationTasks).orderBy(desc(collaborationTasks.createdAt));
  }

  async updateTask(
    taskId: string,
    updates: Partial<CollaborationTask>,
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<CollaborationTask | undefined> {
    const [existing] = await db.select().from(collaborationTasks).where(eq(collaborationTasks.id, taskId));
    
    const [task] = await db
      .update(collaborationTasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(collaborationTasks.id, taskId))
      .returning();

    let action = "task_updated";
    if (updates.status === "completed") action = "task_completed";
    if (updates.status === "cancelled") action = "task_cancelled";
    if (updates.assignedToId && updates.assignedToId !== existing?.assignedToId) action = "task_assigned";

    await this.logCollaborationAction({
      actorId,
      actorType: "provider",
      actorName,
      action,
      resourceType: "task",
      resourceId: taskId,
      patientId: task?.patientId,
      careTeamId: task?.careTeamId || undefined,
      details: { updates, previousStatus: existing?.status },
      ipAddress,
      phiAccessed: true,
    });

    return task;
  }

  async addTaskComment(
    data: InsertTaskComment,
    actorId: string,
    actorName: string
  ): Promise<typeof taskComments.$inferSelect> {
    const [comment] = await db.insert(taskComments).values(data).returning();
    return comment;
  }

  async getTaskComments(taskId: string): Promise<(typeof taskComments.$inferSelect)[]> {
    return db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(taskComments.createdAt);
  }

  async createMessageThread(
    data: InsertProviderMessageThread,
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<typeof providerMessageThreads.$inferSelect> {
    const [thread] = await db.insert(providerMessageThreads).values(data).returning();

    await this.logCollaborationAction({
      actorId,
      actorType: "provider",
      actorName,
      action: "message_sent",
      resourceType: "message_thread",
      resourceId: thread.id,
      patientId: data.patientId || undefined,
      details: { subject: data.subject, threadType: data.threadType },
      ipAddress,
      phiAccessed: !!data.patientId,
    });

    return thread;
  }

  async getMessageThreads(providerId: string): Promise<(typeof providerMessageThreads.$inferSelect)[]> {
    const threads = await db
      .select()
      .from(providerMessageThreads)
      .where(sql`${providerMessageThreads.participants}::jsonb @> ${JSON.stringify([providerId])}::jsonb`)
      .orderBy(desc(providerMessageThreads.lastMessageAt));

    return threads;
  }

  async getThreadMessages(threadId: string): Promise<(typeof providerMessages.$inferSelect)[]> {
    return db
      .select()
      .from(providerMessages)
      .where(eq(providerMessages.threadId, threadId))
      .orderBy(providerMessages.createdAt);
  }

  async sendMessage(
    data: InsertProviderMessage,
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<typeof providerMessages.$inferSelect> {
    const [message] = await db.insert(providerMessages).values(data).returning();

    await db
      .update(providerMessageThreads)
      .set({
        lastMessageAt: new Date(),
        messageCount: sql`${providerMessageThreads.messageCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(providerMessageThreads.id, data.threadId));

    const [thread] = await db
      .select()
      .from(providerMessageThreads)
      .where(eq(providerMessageThreads.id, data.threadId));

    await this.logCollaborationAction({
      actorId,
      actorType: "provider",
      actorName,
      action: "message_sent",
      resourceType: "message_thread",
      resourceId: data.threadId,
      patientId: thread?.patientId || undefined,
      details: { messageType: data.messageType, isUrgent: data.isUrgent },
      ipAddress,
      phiAccessed: !!thread?.patientId,
    });

    return message;
  }

  async markMessageRead(
    messageId: string,
    readerId: string,
    actorId: string,
    actorName: string
  ): Promise<void> {
    const [message] = await db.select().from(providerMessages).where(eq(providerMessages.id, messageId));
    
    const currentReadBy = (message?.readBy as string[]) || [];
    if (!currentReadBy.includes(readerId)) {
      await db
        .update(providerMessages)
        .set({ readBy: [...currentReadBy, readerId] })
        .where(eq(providerMessages.id, messageId));

      const [thread] = await db
        .select()
        .from(providerMessageThreads)
        .where(eq(providerMessageThreads.id, message?.threadId || ""));

      await this.logCollaborationAction({
        actorId,
        actorType: "provider",
        actorName,
        action: "message_read",
        resourceType: "message_thread",
        resourceId: message?.threadId || "",
        patientId: thread?.patientId || undefined,
        details: { messageId },
        phiAccessed: !!thread?.patientId,
      });
    }
  }

  async summarizeThread(threadId: string): Promise<{ summary: string; keyPoints: string[]; actionItems: string[] }> {
    const messages = await this.getThreadMessages(threadId);
    
    if (messages.length === 0) {
      return { summary: "No messages in this thread.", keyPoints: [], actionItems: [] };
    }

    const messageContent = messages
      .map((m) => `[${m.senderName} - ${m.senderRole || "Provider"}]: ${m.content}`)
      .join("\n");

    try {
      const response = await chatComplete({
        model: "deep",
        messages: [
          {
            role: "system",
            content: `You are a clinical documentation assistant. Summarize provider-to-provider communications concisely. Focus on clinical decisions, action items, and key discussion points. Return JSON with format: { "summary": string, "keyPoints": string[], "actionItems": string[] }`,
          },
          {
            role: "user",
            content: `Summarize this provider conversation:\n\n${messageContent}`,
          },
        ],
        jsonMode: true,
        temperature: 0.3,
      dataCategories: ["conditions","medications","clinical_notes"],
      purpose: "care_coordination",
      callerService: "provider-collaboration-service",
      callerMethod: "collaborate"});

      const result = JSON.parse(response.content || "{}");
      
      await db
        .update(providerMessageThreads)
        .set({
          aiSummary: result.summary,
          aiKeyPoints: result.keyPoints,
          aiActionItems: result.actionItems,
          aiSummaryUpdatedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(providerMessageThreads.id, threadId));

      return result;
    } catch (error) {
      console.error("Error summarizing thread:", error);
      return { summary: "Unable to generate summary.", keyPoints: [], actionItems: [] };
    }
  }

  async generatePatientSummary(
    patientId: string,
    summaryType: string,
    requestedById: string,
    actorName: string,
    dateRangeStart?: Date,
    dateRangeEnd?: Date,
    ipAddress?: string
  ): Promise<PatientSummary> {
    let recordsQuery = db
      .select()
      .from(healthRecords)
      .where(eq(healthRecords.userId, patientId));

    if (dateRangeStart && dateRangeEnd) {
      recordsQuery = db
        .select()
        .from(healthRecords)
        .where(
          and(
            eq(healthRecords.userId, patientId),
            gte(healthRecords.date, dateRangeStart),
            lte(healthRecords.date, dateRangeEnd)
          )
        );
    }

    const records = await recordsQuery.orderBy(desc(healthRecords.date)).limit(100);
    const [patient] = await db.select().from(users).where(eq(users.id, patientId));

    const recordSummary = records.map((r) => ({
      type: r.type,
      title: r.title,
      date: r.date,
      provider: r.provider,
      summary: r.summary,
    }));

    try {
      const response = await chatComplete({
        model: "deep",
        messages: [
          {
            role: "system",
            content: `You are a clinical documentation assistant generating ${summaryType} patient summaries for provider collaboration. Create a structured, comprehensive summary suitable for care handoffs and provider coordination. Include relevant clinical information, recent developments, and care priorities. Return JSON with format: { "content": string, "structuredData": { "conditions": [], "medications": [], "allergies": [], "recentLabs": [], "keyFindings": [], "carePriorities": [] } }`,
          },
          {
            role: "user",
            content: `Generate a ${summaryType} summary for patient ${patient?.name || "Unknown"} based on these records:\n\n${JSON.stringify(recordSummary)}`,
          },
        ],
        jsonMode: true,
        temperature: 0.3,
      dataCategories: ["conditions","medications","clinical_notes"],
      purpose: "care_coordination",
      callerService: "provider-collaboration-service",
      callerMethod: "collaborate"});

      const result = JSON.parse(response.content || "{}");

      const [summary] = await db
        .insert(patientSummaries)
        .values({
          patientId,
          summaryType,
          title: `${summaryType.charAt(0).toUpperCase() + summaryType.slice(1)} Summary - ${new Date().toLocaleDateString()}`,
          content: result.content || "Summary generated",
          structuredData: result.structuredData,
          dateRangeStart,
          dateRangeEnd,
          generatedBy: "ai",
          aiModel: "gpt-4o",
          aiConfidenceScore: 85,
          includedRecordIds: records.map((r) => r.id),
          requestedById,
        })
        .returning();

      await this.logCollaborationAction({
        actorId: requestedById,
        actorType: "provider",
        actorName,
        action: "summary_generated",
        resourceType: "patient_summary",
        resourceId: summary.id,
        patientId,
        details: { summaryType, recordCount: records.length },
        ipAddress,
        phiAccessed: true,
        sensitivityLevel: "highly_sensitive",
      });

      return summary;
    } catch (error) {
      console.error("Error generating patient summary:", error);
      throw new Error("Failed to generate patient summary");
    }
  }

  async getPatientSummaries(patientId: string): Promise<PatientSummary[]> {
    return db
      .select()
      .from(patientSummaries)
      .where(eq(patientSummaries.patientId, patientId))
      .orderBy(desc(patientSummaries.createdAt));
  }

  async shareCarePlan(
    data: InsertSharedCarePlan,
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<typeof sharedCarePlans.$inferSelect> {
    const [shared] = await db.insert(sharedCarePlans).values(data).returning();

    const [carePlan] = await db.select().from(carePlans).where(eq(carePlans.id, data.carePlanId));

    await this.logCollaborationAction({
      actorId,
      actorType: "provider",
      actorName,
      action: "care_plan_shared",
      resourceType: "care_plan",
      resourceId: data.carePlanId,
      patientId: carePlan?.userId,
      careTeamId: data.careTeamId,
      details: { carePlanTitle: carePlan?.title },
      ipAddress,
      phiAccessed: true,
    });

    return shared;
  }

  async getSharedCarePlans(careTeamId: string): Promise<(typeof sharedCarePlans.$inferSelect & { carePlan: typeof carePlans.$inferSelect })[]> {
    const shared = await db
      .select({
        shared: sharedCarePlans,
        carePlan: carePlans,
      })
      .from(sharedCarePlans)
      .innerJoin(carePlans, eq(sharedCarePlans.carePlanId, carePlans.id))
      .where(eq(sharedCarePlans.careTeamId, careTeamId));

    return shared.map((s) => ({ ...s.shared, carePlan: s.carePlan }));
  }

  async getCollaborationAuditLogs(
    patientId?: string,
    careTeamId?: string,
    actorId?: string,
    limit = 100
  ): Promise<(typeof collaborationAuditLogs.$inferSelect)[]> {
    const conditions = [];

    if (patientId) conditions.push(eq(collaborationAuditLogs.patientId, patientId));
    if (careTeamId) conditions.push(eq(collaborationAuditLogs.careTeamId, careTeamId));
    if (actorId) conditions.push(eq(collaborationAuditLogs.actorId, actorId));

    // Require at least one scoping condition to prevent unbounded cross-tenant data exposure
    if (conditions.length === 0) {
      return [];
    }

    return db
      .select()
      .from(collaborationAuditLogs)
      .where(and(...conditions))
      .orderBy(desc(collaborationAuditLogs.createdAt))
      .limit(limit);
  }

  // ============================================
  // TEAM INVITATIONS
  // ============================================

  private generateInvitationToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  async createTeamInvitation(
    data: Omit<InsertTeamInvitation, "invitationToken">,
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<TeamInvitation> {
    const token = this.generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiration

    const [invitation] = await db.insert(teamInvitations).values({
      ...data,
      invitationToken: token,
      expiresAt: data.expiresAt || expiresAt,
    }).returning();

    await this.logCollaborationAction({
      actorId,
      actorType: "patient",
      actorName,
      action: "team_member_added",
      resourceType: "team_invitation",
      resourceId: invitation.id,
      patientId: data.patientId,
      careTeamId: data.careTeamId || undefined,
      details: {
        inviteeEmail: data.inviteeEmail,
        inviteeName: data.inviteeName,
        inviteeRole: data.inviteeRole,
        accessLevel: data.accessLevel,
      },
      ipAddress,
      phiAccessed: false,
      sensitivityLevel: "sensitive",
    });

    return invitation;
  }

  async getPatientInvitations(patientId: string): Promise<TeamInvitation[]> {
    return db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.patientId, patientId))
      .orderBy(desc(teamInvitations.createdAt));
  }

  async getPendingInvitationsByEmail(email: string): Promise<TeamInvitation[]> {
    const now = new Date();
    return db
      .select()
      .from(teamInvitations)
      .where(and(
        eq(teamInvitations.inviteeEmail, email.toLowerCase()),
        eq(teamInvitations.status, "pending"),
        or(
          isNull(teamInvitations.expiresAt),
          gte(teamInvitations.expiresAt, now)
        )
      ))
      .orderBy(desc(teamInvitations.createdAt));
  }

  async getInvitationByToken(token: string): Promise<TeamInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.invitationToken, token));
    return invitation;
  }

  async acceptInvitation(
    token: string,
    acceptingUserId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<{ success: boolean; invitation?: TeamInvitation; error?: string }> {
    const invitation = await this.getInvitationByToken(token);
    
    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    if (invitation.status !== "pending") {
      return { success: false, error: `Invitation has already been ${invitation.status}` };
    }

    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      await db
        .update(teamInvitations)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(teamInvitations.id, invitation.id));
      return { success: false, error: "Invitation has expired" };
    }

    // Update invitation status
    const [updated] = await db
      .update(teamInvitations)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByUserId: acceptingUserId,
        updatedAt: new Date(),
      })
      .where(eq(teamInvitations.id, invitation.id))
      .returning();

    // Grant shared patient access
    await db.insert(sharedPatientAccess).values({
      patientId: invitation.patientId,
      grantedToId: acceptingUserId,
      grantedToType: invitation.inviteeRole === "provider" ? "provider" : "family_member",
      accessLevel: invitation.accessLevel || "read",
      purposeOfUse: invitation.purposeOfUse || "treatment",
      grantedById: invitation.patientId,
      consentVerified: true,
      consentDate: new Date(),
      isActive: true,
    });

    await this.logCollaborationAction({
      actorId: acceptingUserId,
      actorType: invitation.inviteeRole === "provider" ? "provider" : "family_member",
      actorName,
      action: "access_granted",
      resourceType: "team_invitation",
      resourceId: invitation.id,
      patientId: invitation.patientId,
      careTeamId: invitation.careTeamId || undefined,
      details: {
        inviteAccepted: true,
        inviteeRole: invitation.inviteeRole,
        accessLevel: invitation.accessLevel,
      },
      ipAddress,
      phiAccessed: false,
      sensitivityLevel: "sensitive",
    });

    return { success: true, invitation: updated };
  }

  async declineInvitation(
    token: string,
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<{ success: boolean; error?: string }> {
    const invitation = await this.getInvitationByToken(token);
    
    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    if (invitation.status !== "pending") {
      return { success: false, error: `Invitation has already been ${invitation.status}` };
    }

    await db
      .update(teamInvitations)
      .set({ status: "declined", updatedAt: new Date() })
      .where(eq(teamInvitations.id, invitation.id));

    await this.logCollaborationAction({
      actorId,
      actorType: "external",
      actorName,
      action: "access_revoked",
      resourceType: "team_invitation",
      resourceId: invitation.id,
      patientId: invitation.patientId,
      details: { inviteDeclined: true },
      ipAddress,
      phiAccessed: false,
    });

    return { success: true };
  }

  async revokeInvitation(
    invitationId: string,
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<{ success: boolean; error?: string }> {
    const [invitation] = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.id, invitationId));

    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    if (invitation.patientId !== actorId) {
      return { success: false, error: "Only the patient can revoke their invitations" };
    }

    await db
      .update(teamInvitations)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(teamInvitations.id, invitationId));

    await this.logCollaborationAction({
      actorId,
      actorType: "patient",
      actorName,
      action: "access_revoked",
      resourceType: "team_invitation",
      resourceId: invitationId,
      patientId: invitation.patientId,
      details: { inviteRevoked: true, inviteeEmail: invitation.inviteeEmail },
      ipAddress,
      phiAccessed: false,
    });

    return { success: true };
  }

  async resendInvitation(
    invitationId: string,
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<{ success: boolean; invitation?: TeamInvitation; error?: string }> {
    const [invitation] = await db
      .select()
      .from(teamInvitations)
      .where(eq(teamInvitations.id, invitationId));

    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }

    if (invitation.status !== "pending") {
      return { success: false, error: "Can only resend pending invitations" };
    }

    const newExpiration = new Date();
    newExpiration.setDate(newExpiration.getDate() + 7);

    const [updated] = await db
      .update(teamInvitations)
      .set({
        expiresAt: newExpiration,
        lastReminderAt: new Date(),
        reminderCount: (invitation.reminderCount || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(teamInvitations.id, invitationId))
      .returning();

    await this.logCollaborationAction({
      actorId,
      actorType: "patient",
      actorName,
      action: "message_sent",
      resourceType: "team_invitation",
      resourceId: invitationId,
      patientId: invitation.patientId,
      details: { inviteResent: true, reminderCount: updated.reminderCount },
      ipAddress,
      phiAccessed: false,
    });

    return { success: true, invitation: updated };
  }

  // ============================================
  // CARE PLAN NOTES
  // ============================================

  async createCarePlanNote(
    data: InsertCarePlanNote,
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<CarePlanNote> {
    const [note] = await db.insert(carePlanNotes).values(data).returning();

    await this.logCollaborationAction({
      actorId,
      actorType: data.authorRole === "patient" ? "patient" : data.authorRole === "provider" ? "provider" : "family_member",
      actorName,
      action: "care_plan_updated",
      resourceType: "care_plan_note",
      resourceId: note.id,
      patientId: data.patientId,
      details: {
        noteType: data.noteType,
        title: data.title,
        carePlanId: data.carePlanId,
        priority: data.priority,
      },
      ipAddress,
      phiAccessed: true,
      sensitivityLevel: data.isPrivate ? "sensitive" : "standard",
    });

    return note;
  }

  async getCarePlanNotes(
    carePlanId: string,
    viewerId: string,
    viewerRole: string
  ): Promise<CarePlanNote[]> {
    const notes = await db
      .select()
      .from(carePlanNotes)
      .where(and(
        eq(carePlanNotes.carePlanId, carePlanId),
        eq(carePlanNotes.isArchived, false)
      ))
      .orderBy(desc(carePlanNotes.createdAt));

    // Filter out private notes for non-providers
    if (viewerRole !== "provider") {
      return notes.filter(note => !note.isPrivate);
    }

    return notes;
  }

  async getPatientCarePlanNotes(
    patientId: string,
    viewerId: string,
    viewerRole: string
  ): Promise<CarePlanNote[]> {
    const notes = await db
      .select()
      .from(carePlanNotes)
      .where(and(
        eq(carePlanNotes.patientId, patientId),
        eq(carePlanNotes.isArchived, false)
      ))
      .orderBy(desc(carePlanNotes.createdAt));

    if (viewerRole !== "provider") {
      return notes.filter(note => !note.isPrivate);
    }

    return notes;
  }

  async updateCarePlanNote(
    noteId: string,
    updates: Partial<Pick<CarePlanNote, "title" | "content" | "priority" | "noteType">>,
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<CarePlanNote | undefined> {
    const [note] = await db
      .select()
      .from(carePlanNotes)
      .where(eq(carePlanNotes.id, noteId));

    if (!note || note.authorId !== actorId) {
      return undefined;
    }

    const [updated] = await db
      .update(carePlanNotes)
      .set({
        ...updates,
        isEdited: true,
        editedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(carePlanNotes.id, noteId))
      .returning();

    await this.logCollaborationAction({
      actorId,
      actorType: note.authorRole === "patient" ? "patient" : note.authorRole === "provider" ? "provider" : "family_member",
      actorName,
      action: "care_plan_updated",
      resourceType: "care_plan_note",
      resourceId: noteId,
      patientId: note.patientId,
      details: { noteUpdated: true, changes: Object.keys(updates) },
      ipAddress,
      phiAccessed: true,
    });

    return updated;
  }

  async archiveCarePlanNote(
    noteId: string,
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<boolean> {
    const [note] = await db
      .select()
      .from(carePlanNotes)
      .where(eq(carePlanNotes.id, noteId));

    if (!note || note.authorId !== actorId) {
      return false;
    }

    await db
      .update(carePlanNotes)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(eq(carePlanNotes.id, noteId));

    await this.logCollaborationAction({
      actorId,
      actorType: note.authorRole === "patient" ? "patient" : "provider",
      actorName,
      action: "care_plan_updated",
      resourceType: "care_plan_note",
      resourceId: noteId,
      patientId: note.patientId,
      details: { noteArchived: true },
      ipAddress,
      phiAccessed: false,
    });

    return true;
  }

  // ============================================
  // SECURE MESSAGING (uses existing messagingThreads and secureMessages tables)
  // ============================================

  async createMessageThread(
    patientId: string,
    recipientId: string | null,
    subject: string,
    senderType: string,
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<typeof messagingThreads.$inferSelect> {
    const [thread] = await db.insert(messagingThreads).values({
      patientId,
      providerId: recipientId,
      subject,
      status: "open",
      category: "general",
      priority: "normal",
    }).returning();

    // Add sender as participant
    await db.insert(careTeamMessageParticipants).values({
      threadId: thread.id,
      userId: actorId,
      userName: actorName,
      userRole: senderType,
      lastReadAt: new Date(),
      unreadCount: 0,
    });

    // Add recipient as participant if specified
    if (recipientId) {
      const [recipient] = await db
        .select()
        .from(users)
        .where(eq(users.id, recipientId));

      if (recipient) {
        await db.insert(careTeamMessageParticipants).values({
          threadId: thread.id,
          userId: recipientId,
          userName: recipient.firstName && recipient.lastName 
            ? `${recipient.firstName} ${recipient.lastName}` 
            : recipient.email || "Unknown",
          userRole: "patient",
          unreadCount: 0,
        });
      }
    }

    await this.logCollaborationAction({
      actorId,
      actorType: senderType === "patient" ? "patient" : "provider",
      actorName,
      action: "message_sent",
      resourceType: "message_thread",
      resourceId: thread.id,
      patientId,
      details: { subject, threadCreated: true },
      ipAddress,
      phiAccessed: true,
    });

    return thread;
  }

  async sendSecureMessage(
    threadId: string,
    senderId: string,
    senderType: string,
    content: string,
    messageType: string = "text",
    actorId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<typeof secureMessages.$inferSelect> {
    const [message] = await db.insert(secureMessages).values({
      threadId,
      senderId,
      senderType,
      messageType,
      content,
    }).returning();

    // Update thread's last message timestamp
    await db
      .update(messagingThreads)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(messagingThreads.id, threadId));

    // Increment unread count for other participants
    await db
      .update(careTeamMessageParticipants)
      .set({ 
        unreadCount: sql`${careTeamMessageParticipants.unreadCount} + 1` 
      })
      .where(and(
        eq(careTeamMessageParticipants.threadId, threadId),
        sql`${careTeamMessageParticipants.userId} != ${senderId}`
      ));

    await this.logCollaborationAction({
      actorId,
      actorType: senderType === "patient" ? "patient" : "provider",
      actorName,
      action: "message_sent",
      resourceType: "secure_message",
      resourceId: message.id,
      details: { threadId, messageType },
      ipAddress,
      phiAccessed: true,
    });

    return message;
  }

  async getMessageThreads(userId: string): Promise<{
    thread: typeof messagingThreads.$inferSelect;
    lastMessage: typeof secureMessages.$inferSelect | null;
    participants: CareTeamMessageParticipant[];
    unreadCount: number;
  }[]> {
    // Get threads where user is a participant
    const userParticipants = await db
      .select()
      .from(careTeamMessageParticipants)
      .where(and(
        eq(careTeamMessageParticipants.userId, userId),
        eq(careTeamMessageParticipants.isActive, true)
      ));

    if (userParticipants.length === 0) {
      return [];
    }

    const threadIds = userParticipants.map(p => p.threadId);
    
    const results = await Promise.all(threadIds.map(async (threadId) => {
      const [thread] = await db
        .select()
        .from(messagingThreads)
        .where(eq(messagingThreads.id, threadId));

      const [lastMessage] = await db
        .select()
        .from(secureMessages)
        .where(eq(secureMessages.threadId, threadId))
        .orderBy(desc(secureMessages.createdAt))
        .limit(1);

      const participants = await db
        .select()
        .from(careTeamMessageParticipants)
        .where(eq(careTeamMessageParticipants.threadId, threadId));

      const userParticipant = userParticipants.find(p => p.threadId === threadId);

      return {
        thread,
        lastMessage: lastMessage || null,
        participants,
        unreadCount: userParticipant?.unreadCount || 0,
      };
    }));

    return results
      .filter(r => r.thread)
      .sort((a, b) => {
        const aTime = a.lastMessage?.createdAt || a.thread.createdAt;
        const bTime = b.lastMessage?.createdAt || b.thread.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
  }

  async getThreadMessages(threadId: string, userId: string): Promise<(typeof secureMessages.$inferSelect)[]> {
    // Verify user is a participant
    const [participant] = await db
      .select()
      .from(careTeamMessageParticipants)
      .where(and(
        eq(careTeamMessageParticipants.threadId, threadId),
        eq(careTeamMessageParticipants.userId, userId)
      ));

    if (!participant) {
      return [];
    }

    const messages = await db
      .select()
      .from(secureMessages)
      .where(eq(secureMessages.threadId, threadId))
      .orderBy(secureMessages.createdAt);

    return messages;
  }

  async markMessagesAsRead(
    threadId: string,
    userId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<void> {
    // Update participant's last read timestamp and reset unread count
    await db
      .update(careTeamMessageParticipants)
      .set({
        lastReadAt: new Date(),
        unreadCount: 0,
      })
      .where(and(
        eq(careTeamMessageParticipants.threadId, threadId),
        eq(careTeamMessageParticipants.userId, userId)
      ));

    // Mark individual messages as read
    await db
      .update(secureMessages)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(secureMessages.threadId, threadId),
        eq(secureMessages.isRead, false)
      ));

    await this.logCollaborationAction({
      actorId: userId,
      actorType: "patient",
      actorName,
      action: "message_read",
      resourceType: "secure_message_thread",
      resourceId: threadId,
      details: { threadId },
      ipAddress,
      phiAccessed: true,
    });
  }

  async getUnreadMessageCount(userId: string): Promise<number> {
    const participants = await db
      .select()
      .from(careTeamMessageParticipants)
      .where(and(
        eq(careTeamMessageParticipants.userId, userId),
        eq(careTeamMessageParticipants.isActive, true)
      ));

    return participants.reduce((sum, p) => sum + (p.unreadCount || 0), 0);
  }

  async archiveThread(
    threadId: string,
    userId: string,
    actorName: string,
    ipAddress?: string
  ): Promise<boolean> {
    await db
      .update(careTeamMessageParticipants)
      .set({ isActive: false })
      .where(and(
        eq(careTeamMessageParticipants.threadId, threadId),
        eq(careTeamMessageParticipants.userId, userId)
      ));

    await this.logCollaborationAction({
      actorId: userId,
      actorType: "patient",
      actorName,
      action: "message_read",
      resourceType: "secure_message_thread",
      resourceId: threadId,
      details: { threadArchived: true },
      ipAddress,
      phiAccessed: false,
    });

    return true;
  }

  // ============================================
  // AUTHORIZATION HELPERS
  // ============================================

  async isProviderTeamMember(providerProfileId: string, careTeamId: string): Promise<boolean> {
    const [member] = await db
      .select({ id: careTeamMembers.id })
      .from(careTeamMembers)
      .where(and(
        eq(careTeamMembers.providerId, providerProfileId),
        eq(careTeamMembers.careTeamId, careTeamId),
        eq(careTeamMembers.isActive, true)
      ));
    return !!member;
  }

  async isThreadParticipant(userId: string, threadId: string): Promise<boolean> {
    const [thread] = await db
      .select({ participants: providerMessageThreads.participants })
      .from(providerMessageThreads)
      .where(eq(providerMessageThreads.id, threadId));
    if (!thread) return false;
    const participants = (thread.participants as string[]) || [];
    return participants.includes(userId);
  }

  async hasPatientCollaborationAccess(userId: string, patientId: string): Promise<boolean> {
    if (userId === patientId) return true;
    // Collaboration access is keyed on provider profile IDs, not raw user IDs.
    // Look up the caller's provider profile, then delegate to the existing
    // checkProviderAccess which handles direct grants, care-team grants, and expiry.
    const [providerProfile] = await db
      .select({ id: providerProfiles.id })
      .from(providerProfiles)
      .where(eq(providerProfiles.userId, userId));
    if (!providerProfile) return false;
    const { hasAccess } = await this.checkProviderAccess(providerProfile.id, patientId);
    return hasAccess;
  }

  async getTaskById(taskId: string): Promise<CollaborationTask | undefined> {
    const [task] = await db.select().from(collaborationTasks).where(eq(collaborationTasks.id, taskId));
    return task;
  }

  /**
   * Centralized task access guard used by read, update, and comment routes.
   * A caller is authorized when they:
   *   1. Created the task, OR
   *   2. Have patient-collaboration access to the task's patient (covers the
   *      patient themselves, direct provider grants, and care-team grants via
   *      checkProviderAccess), OR
   *   3. Are an active member of the task's care team, OR
   *   4. Are the individual provider assigned to the task.
   */
  async canAccessTask(userId: string, task: CollaborationTask): Promise<boolean> {
    if (task.createdById === userId) return true;
    // Patient-level access check (includes self + provider/care-team grants)
    if (await this.hasPatientCollaborationAccess(userId, task.patientId)) return true;
    // Team membership check (requires provider profile lookup)
    if (task.careTeamId || task.assignedToId) {
      const [providerProfile] = await db
        .select({ id: providerProfiles.id })
        .from(providerProfiles)
        .where(eq(providerProfiles.userId, userId));
      if (providerProfile) {
        if (task.careTeamId && await this.isProviderTeamMember(providerProfile.id, task.careTeamId)) return true;
        if (task.assignedToId === providerProfile.id) return true;
      }
    }
    return false;
  }

  async getMessageThreadIdForMessage(messageId: string): Promise<string | null> {
    const [message] = await db
      .select({ threadId: providerMessages.threadId })
      .from(providerMessages)
      .where(eq(providerMessages.id, messageId));
    return message?.threadId ?? null;
  }

  async getCarePlanOwnerId(carePlanId: string): Promise<string | null> {
    const [plan] = await db
      .select({ userId: carePlans.userId })
      .from(carePlans)
      .where(eq(carePlans.id, carePlanId));
    return plan?.userId ?? null;
  }

  async getTasksForCaller(
    callerProviderProfileId: string | null,
    callerUserId: string,
    callerTeamIds: string[],
    patientId?: string,
    careTeamId?: string,
    assignedToId?: string
  ): Promise<CollaborationTask[]> {
    // Build an OR clause expressing all ownership paths the caller qualifies for
    const ownershipClauses = [eq(collaborationTasks.createdById, callerUserId)];
    if (callerTeamIds.length > 0) {
      ownershipClauses.push(inArray(collaborationTasks.careTeamId, callerTeamIds));
    }
    if (callerProviderProfileId) {
      ownershipClauses.push(eq(collaborationTasks.assignedToId, callerProviderProfileId));
    }

    // Ownership is mandatory; additional query filters narrow within that scope
    const filterClauses = [or(...ownershipClauses)];
    if (patientId) filterClauses.push(eq(collaborationTasks.patientId, patientId));
    if (careTeamId) filterClauses.push(eq(collaborationTasks.careTeamId, careTeamId));
    if (assignedToId) filterClauses.push(eq(collaborationTasks.assignedToId, assignedToId));

    return db
      .select()
      .from(collaborationTasks)
      .where(and(...filterClauses))
      .orderBy(desc(collaborationTasks.createdAt));
  }

  // ============================================
  // SHARED ACCESS HELPERS
  // ============================================

  async getCareTeamMembersByPatient(patientId: string): Promise<{
    id: string;
    userId: string;
    userName: string;
    role: string;
    accessLevel: string;
  }[]> {
    const accessRecords = await db
      .select({
        access: sharedPatientAccess,
        user: users,
      })
      .from(sharedPatientAccess)
      .innerJoin(users, eq(sharedPatientAccess.grantedToId, users.id))
      .where(and(
        eq(sharedPatientAccess.patientId, patientId),
        eq(sharedPatientAccess.isActive, true)
      ));

    return accessRecords.map(r => ({
      id: r.access.id,
      userId: r.user.id,
      userName: r.user.firstName && r.user.lastName 
        ? `${r.user.firstName} ${r.user.lastName}`
        : r.user.email || "Unknown",
      role: r.access.grantedToType || "family_member",
      accessLevel: r.access.accessLevel || "read",
    }));
  }
}

export const providerCollaborationService = new ProviderCollaborationService();
