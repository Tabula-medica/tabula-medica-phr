import { db } from "../db";
import { phiDb } from "../storage/phi-storage";
import { eq, and, desc, asc, gte, lte, sql, or } from "drizzle-orm";
import { createHash } from "crypto";
import {
  engagementMessageThreadsTable,
  engagementMessagesTable,
  engagementAppointmentsTable,
  engagementAppointmentRemindersTable,
  engagementRewardsTable,
  engagementStreaksTable,
  engagementPointsLedgerTable,
  profiles,
  healthGoalsTable,
  medicationAdherenceLogsTable,
  InsertEngagementMessageThread,
  InsertEngagementMessage,
  InsertEngagementAppointment,
  InsertEngagementReminder,
  InsertEngagementReward,
  EngagementRewardCategory,
  MessageThreadCategory,
  AppointmentScheduleStatus,
} from "@shared/schema";

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function logHipaaAudit(action: string, details: Record<string, any>) {
  const timestamp = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][PatientEngagement] ${timestamp} - ${action} -`, JSON.stringify(details));
}

const POINTS_CONFIG = {
  MESSAGE_SENT: 5,
  APPOINTMENT_SCHEDULED: 10,
  APPOINTMENT_CONFIRMED: 5,
  APPOINTMENT_ATTENDED: 25,
  GOAL_PROGRESS: 10,
  GOAL_ACHIEVED: 50,
  MEDICATION_TAKEN: 5,
  MEDICATION_STREAK_7: 100,
  MEDICATION_STREAK_30: 500,
  DAILY_LOGIN: 2,
  HEALTH_LOG: 5,
};

const BADGE_DEFINITIONS = [
  { id: "first_message", name: "First Contact", description: "Sent your first message", icon: "MessageSquare", color: "blue", points: 10, category: "messaging" as const },
  { id: "appointment_keeper", name: "Appointment Keeper", description: "Attended 5 appointments", icon: "Calendar", color: "green", points: 50, category: "appointment_attendance" as const },
  { id: "med_adherence_7", name: "Week Warrior", description: "7-day medication adherence streak", icon: "Pill", color: "purple", points: 100, category: "medication_adherence" as const },
  { id: "med_adherence_30", name: "Monthly Master", description: "30-day medication adherence streak", icon: "Award", color: "gold", points: 500, category: "medication_adherence" as const },
  { id: "goal_getter", name: "Goal Getter", description: "Achieved your first health goal", icon: "Target", color: "green", points: 50, category: "goal_achievement" as const },
  { id: "health_tracker", name: "Health Tracker", description: "Logged vitals for 7 consecutive days", icon: "Activity", color: "red", points: 75, category: "health_tracking" as const },
  { id: "active_learner", name: "Active Learner", description: "Completed 5 education modules", icon: "BookOpen", color: "teal", points: 60, category: "education" as const },
];

export class PatientEngagementService {
  async createMessageThread(data: InsertEngagementMessageThread): Promise<any> {
    const [thread] = await phiDb.insert(engagementMessageThreadsTable).values({
      ...data,
      status: "active",
      patientUnreadCount: 0,
      providerUnreadCount: 1,
      isEncrypted: true,
    }).returning();

    logHipaaAudit("MESSAGE_THREAD_CREATED", {
      threadId: hashIdentifier(thread.id),
      patientProfile: hashIdentifier(data.patientProfileId),
      category: data.category,
    });

    return thread;
  }

  async getMessageThreads(profileId: string, role: "patient" | "provider"): Promise<any[]> {
    logHipaaAudit("MESSAGE_THREADS_ACCESS", {
      profile: hashIdentifier(profileId),
      role,
    });

    const threads = await phiDb.select().from(engagementMessageThreadsTable)
      .where(eq(engagementMessageThreadsTable.patientProfileId, profileId))
      .orderBy(desc(engagementMessageThreadsTable.lastMessageAt));

    return threads;
  }

  async getProviderThreads(providerUserId: string): Promise<any[]> {
    logHipaaAudit("PROVIDER_THREADS_ACCESS", {
      provider: hashIdentifier(providerUserId),
    });

    const threads = await phiDb.select({
      thread: engagementMessageThreadsTable,
      patientName: profiles.fullName,
    })
      .from(engagementMessageThreadsTable)
      .leftJoin(profiles, eq(engagementMessageThreadsTable.patientProfileId, profiles.id))
      .where(eq(engagementMessageThreadsTable.providerUserId, providerUserId))
      .orderBy(desc(engagementMessageThreadsTable.lastMessageAt));

    return threads.map(t => ({
      ...t.thread,
      patientName: t.patientName,
    }));
  }

  async sendMessage(data: InsertEngagementMessage): Promise<any> {
    const [message] = await phiDb.insert(engagementMessagesTable).values({
      ...data,
      isRead: false,
    }).returning();

    const isPatient = data.senderType === "patient";
    await phiDb.update(engagementMessageThreadsTable)
      .set({
        lastMessageAt: new Date(),
        providerUnreadCount: isPatient ? sql`${engagementMessageThreadsTable.providerUnreadCount} + 1` : engagementMessageThreadsTable.providerUnreadCount,
        patientUnreadCount: !isPatient ? sql`${engagementMessageThreadsTable.patientUnreadCount} + 1` : engagementMessageThreadsTable.patientUnreadCount,
        updatedAt: new Date(),
      })
      .where(eq(engagementMessageThreadsTable.id, data.threadId));

    logHipaaAudit("MESSAGE_SENT", {
      threadId: hashIdentifier(data.threadId),
      sender: hashIdentifier(data.senderId),
      senderType: data.senderType,
    });

    if (data.senderType === "patient") {
      const [thread] = await phiDb.select().from(engagementMessageThreadsTable)
        .where(eq(engagementMessageThreadsTable.id, data.threadId));
      if (thread) {
        await this.awardPointsForAction(thread.patientProfileId, "messaging", "MESSAGE_SENT", POINTS_CONFIG.MESSAGE_SENT, message.id);
      }
    }

    return message;
  }

  async getMessages(threadId: string, userId: string, role: "patient" | "provider"): Promise<any[]> {
    logHipaaAudit("MESSAGES_ACCESS", {
      threadId: hashIdentifier(threadId),
      user: hashIdentifier(userId),
      role,
    });

    const messages = await phiDb.select().from(engagementMessagesTable)
      .where(eq(engagementMessagesTable.threadId, threadId))
      .orderBy(asc(engagementMessagesTable.createdAt));

    return messages;
  }

  async markMessagesRead(threadId: string, role: "patient" | "provider"): Promise<void> {
    const senderTypeToMark = role === "patient" ? "provider" : "patient";
    
    await phiDb.update(engagementMessagesTable)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(engagementMessagesTable.threadId, threadId),
        eq(engagementMessagesTable.senderType, senderTypeToMark),
        eq(engagementMessagesTable.isRead, false)
      ));

    const updateField = role === "patient" 
      ? { patientUnreadCount: 0 } 
      : { providerUnreadCount: 0 };
    
    await phiDb.update(engagementMessageThreadsTable)
      .set({ ...updateField, updatedAt: new Date() })
      .where(eq(engagementMessageThreadsTable.id, threadId));
  }

  async scheduleAppointment(data: InsertEngagementAppointment): Promise<any> {
    const scheduledDate = new Date(data.scheduledDate);
    const scheduledEndDate = data.scheduledEndDate 
      ? new Date(data.scheduledEndDate)
      : new Date(scheduledDate.getTime() + (data.durationMinutes || 30) * 60000);

    const [appointment] = await phiDb.insert(engagementAppointmentsTable).values({
      ...data,
      scheduledDate,
      scheduledEndDate,
      status: "pending",
    }).returning();

    const reminderTimes = [
      { type: "24_hours" as const, offset: 24 * 60 * 60 * 1000 },
      { type: "2_hours" as const, offset: 2 * 60 * 60 * 1000 },
    ];

    for (const reminder of reminderTimes) {
      const reminderTime = new Date(scheduledDate.getTime() - reminder.offset);
      if (reminderTime > new Date()) {
        await phiDb.insert(engagementAppointmentRemindersTable).values({
          appointmentId: appointment.id,
          patientProfileId: data.patientProfileId,
          reminderType: reminder.type,
          scheduledFor: reminderTime,
          channel: "in_app",
          isSent: false,
        });
      }
    }

    logHipaaAudit("APPOINTMENT_SCHEDULED", {
      appointmentId: hashIdentifier(appointment.id),
      patient: hashIdentifier(data.patientProfileId),
      type: data.appointmentType,
      date: scheduledDate.toISOString(),
    });

    await this.awardPointsForAction(
      data.patientProfileId,
      "appointment_attendance",
      "APPOINTMENT_SCHEDULED",
      POINTS_CONFIG.APPOINTMENT_SCHEDULED,
      appointment.id
    );

    return appointment;
  }

  async getPatientAppointments(profileId: string, options?: { 
    status?: AppointmentScheduleStatus; 
    upcoming?: boolean;
    limit?: number;
  }): Promise<any[]> {
    logHipaaAudit("APPOINTMENTS_ACCESS", {
      patient: hashIdentifier(profileId),
    });

    const conditions: any[] = [eq(engagementAppointmentsTable.patientProfileId, profileId)];

    if (options?.status) {
      conditions.push(eq(engagementAppointmentsTable.status, options.status));
    }

    if (options?.upcoming) {
      conditions.push(gte(engagementAppointmentsTable.scheduledDate, new Date()));
    }

    const appointments = await phiDb.select().from(engagementAppointmentsTable)
      .where(and(...conditions))
      .orderBy(asc(engagementAppointmentsTable.scheduledDate))
      .limit(options?.limit || 50);

    return appointments;
  }

  async updateAppointmentStatus(appointmentId: string, status: AppointmentScheduleStatus, userId: string, notes?: string): Promise<any> {
    const updateData: any = { status, updatedAt: new Date() };

    if (status === "cancelled") {
      updateData.cancelledAt = new Date();
      updateData.cancelledBy = userId;
      updateData.cancellationReason = notes;
    } else if (status === "checked_in") {
      updateData.checkedInAt = new Date();
    } else if (status === "completed") {
      updateData.completedAt = new Date();
    }

    const [appointment] = await phiDb.update(engagementAppointmentsTable)
      .set(updateData)
      .where(eq(engagementAppointmentsTable.id, appointmentId))
      .returning();

    logHipaaAudit("APPOINTMENT_STATUS_UPDATED", {
      appointmentId: hashIdentifier(appointmentId),
      newStatus: status,
      updatedBy: hashIdentifier(userId),
    });

    if (status === "completed" && appointment) {
      await this.awardPointsForAction(
        appointment.patientProfileId,
        "appointment_attendance",
        "APPOINTMENT_ATTENDED",
        POINTS_CONFIG.APPOINTMENT_ATTENDED,
        appointmentId
      );
      await this.checkAndAwardBadge(appointment.patientProfileId, "appointment_attendance");
    }

    return appointment;
  }

  async getUpcomingReminders(profileId: string): Promise<any[]> {
    const now = new Date();
    const reminders = await phiDb.select({
      reminder: engagementAppointmentRemindersTable,
      appointment: engagementAppointmentsTable,
    })
      .from(engagementAppointmentRemindersTable)
      .innerJoin(engagementAppointmentsTable, eq(engagementAppointmentRemindersTable.appointmentId, engagementAppointmentsTable.id))
      .where(and(
        eq(engagementAppointmentRemindersTable.patientProfileId, profileId),
        eq(engagementAppointmentRemindersTable.isSent, false),
        lte(engagementAppointmentRemindersTable.scheduledFor, new Date(now.getTime() + 24 * 60 * 60 * 1000))
      ))
      .orderBy(asc(engagementAppointmentRemindersTable.scheduledFor));

    return reminders;
  }

  async awardPointsForAction(
    profileId: string,
    category: EngagementRewardCategory,
    action: string,
    points: number,
    sourceId?: string
  ): Promise<void> {
    const [currentBalance] = await db.select({
      total: sql<number>`COALESCE(SUM(CASE WHEN ${engagementPointsLedgerTable.transactionType} = 'earned' OR ${engagementPointsLedgerTable.transactionType} = 'bonus' THEN ${engagementPointsLedgerTable.amount} ELSE -${engagementPointsLedgerTable.amount} END), 0)`
    }).from(engagementPointsLedgerTable)
      .where(eq(engagementPointsLedgerTable.patientProfileId, profileId));

    const newBalance = Number(currentBalance?.total || 0) + points;

    await db.insert(engagementPointsLedgerTable).values({
      patientProfileId: profileId,
      transactionType: "earned",
      amount: points,
      balance: newBalance,
      source: action,
      sourceId: sourceId || null,
      description: `Earned ${points} points for ${action.toLowerCase().replace(/_/g, " ")}`,
    });

    await db.insert(engagementRewardsTable).values({
      patientProfileId: profileId,
      rewardType: "points",
      category,
      name: `${points} Points Earned`,
      description: `Earned for ${action.toLowerCase().replace(/_/g, " ")}`,
      pointsEarned: points,
      triggerAction: action,
      triggerEntityId: sourceId,
    });

    logHipaaAudit("POINTS_AWARDED", {
      profile: hashIdentifier(profileId),
      points,
      action,
      newBalance,
    });

    await this.updateStreak(profileId, category);
  }

  async updateStreak(profileId: string, category: EngagementRewardCategory): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [existingStreak] = await db.select().from(engagementStreaksTable)
      .where(and(
        eq(engagementStreaksTable.patientProfileId, profileId),
        eq(engagementStreaksTable.category, category)
      ));

    if (existingStreak) {
      const lastActivity = existingStreak.lastActivityDate ? new Date(existingStreak.lastActivityDate) : null;
      if (lastActivity) {
        lastActivity.setHours(0, 0, 0, 0);
      }

      const daysDiff = lastActivity 
        ? Math.floor((today.getTime() - lastActivity.getTime()) / (24 * 60 * 60 * 1000))
        : 999;

      if (daysDiff === 0) {
        return;
      } else if (daysDiff === 1) {
        const newStreak = (existingStreak.currentStreak || 0) + 1;
        const longestStreak = Math.max(newStreak, existingStreak.longestStreak || 0);
        
        await db.update(engagementStreaksTable)
          .set({
            currentStreak: newStreak,
            longestStreak,
            lastActivityDate: today,
            totalActiveDays: (existingStreak.totalActiveDays || 0) + 1,
            updatedAt: new Date(),
          })
          .where(eq(engagementStreaksTable.id, existingStreak.id));

        if (newStreak === 7 && category === "medication_adherence") {
          await this.awardStreakBadge(profileId, "med_adherence_7", 7, POINTS_CONFIG.MEDICATION_STREAK_7);
        } else if (newStreak === 30 && category === "medication_adherence") {
          await this.awardStreakBadge(profileId, "med_adherence_30", 30, POINTS_CONFIG.MEDICATION_STREAK_30);
        }
      } else {
        await db.update(engagementStreaksTable)
          .set({
            currentStreak: 1,
            streakStartDate: today,
            lastActivityDate: today,
            totalActiveDays: (existingStreak.totalActiveDays || 0) + 1,
            updatedAt: new Date(),
          })
          .where(eq(engagementStreaksTable.id, existingStreak.id));
      }
    } else {
      await db.insert(engagementStreaksTable).values({
        patientProfileId: profileId,
        category,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: today,
        streakStartDate: today,
        totalActiveDays: 1,
      });
    }
  }

  async awardStreakBadge(profileId: string, badgeId: string, streakDays: number, bonusPoints: number): Promise<void> {
    const badge = BADGE_DEFINITIONS.find(b => b.id === badgeId);
    if (!badge) return;

    const [existing] = await db.select().from(engagementRewardsTable)
      .where(and(
        eq(engagementRewardsTable.patientProfileId, profileId),
        eq(engagementRewardsTable.badgeId, badgeId)
      ));

    if (existing) return;

    await db.insert(engagementRewardsTable).values({
      patientProfileId: profileId,
      rewardType: "badge",
      category: badge.category,
      name: badge.name,
      description: badge.description,
      pointsEarned: bonusPoints,
      badgeId: badge.id,
      badgeIcon: badge.icon,
      badgeColor: badge.color,
      streakDays,
      triggerAction: "STREAK_ACHIEVED",
    });

    await this.awardPointsForAction(profileId, badge.category, "STREAK_BONUS", bonusPoints, badgeId);

    logHipaaAudit("BADGE_AWARDED", {
      profile: hashIdentifier(profileId),
      badgeId,
      streakDays,
      bonusPoints,
    });
  }

  async checkAndAwardBadge(profileId: string, category: EngagementRewardCategory): Promise<void> {
    if (category === "appointment_attendance") {
      const [count] = await phiDb.select({
        total: sql<number>`count(*)`
      }).from(engagementAppointmentsTable)
        .where(and(
          eq(engagementAppointmentsTable.patientProfileId, profileId),
          eq(engagementAppointmentsTable.status, "completed")
        ));

      if (Number(count?.total || 0) >= 5) {
        await this.awardStreakBadge(profileId, "appointment_keeper", 5, 50);
      }
    } else if (category === "messaging") {
      const [count] = await phiDb.select({
        total: sql<number>`count(*)`
      }).from(engagementMessagesTable)
        .innerJoin(engagementMessageThreadsTable, eq(engagementMessagesTable.threadId, engagementMessageThreadsTable.id))
        .where(and(
          eq(engagementMessageThreadsTable.patientProfileId, profileId),
          eq(engagementMessagesTable.senderType, "patient")
        ));

      if (Number(count?.total || 0) === 1) {
        await this.awardStreakBadge(profileId, "first_message", 1, 10);
      }
    }
  }

  async getPatientRewards(profileId: string): Promise<any> {
    logHipaaAudit("REWARDS_ACCESS", {
      profile: hashIdentifier(profileId),
    });

    const rewards = await db.select().from(engagementRewardsTable)
      .where(eq(engagementRewardsTable.patientProfileId, profileId))
      .orderBy(desc(engagementRewardsTable.earnedAt));

    const badges = rewards.filter(r => r.rewardType === "badge");

    const [pointsTotal] = await db.select({
      total: sql<number>`COALESCE(SUM(CASE WHEN ${engagementPointsLedgerTable.transactionType} IN ('earned', 'bonus') THEN ${engagementPointsLedgerTable.amount} ELSE -${engagementPointsLedgerTable.amount} END), 0)`
    }).from(engagementPointsLedgerTable)
      .where(eq(engagementPointsLedgerTable.patientProfileId, profileId));

    const streaks = await db.select().from(engagementStreaksTable)
      .where(eq(engagementStreaksTable.patientProfileId, profileId));

    const totalPoints = Number(pointsTotal?.total || 0);
    const level = this.calculateLevel(totalPoints);

    return {
      totalPoints,
      level,
      badges,
      recentRewards: rewards.slice(0, 10),
      streaks: streaks.map(s => ({
        category: s.category,
        currentStreak: s.currentStreak,
        longestStreak: s.longestStreak,
        totalActiveDays: s.totalActiveDays,
      })),
      availableBadges: BADGE_DEFINITIONS.map(badge => ({
        ...badge,
        earned: badges.some(b => b.badgeId === badge.id),
      })),
    };
  }

  calculateLevel(points: number): { level: number; name: string; pointsToNext: number; progress: number } {
    const levels = [
      { level: 1, name: "Health Starter", minPoints: 0 },
      { level: 2, name: "Health Explorer", minPoints: 100 },
      { level: 3, name: "Health Achiever", minPoints: 300 },
      { level: 4, name: "Health Champion", minPoints: 600 },
      { level: 5, name: "Health Master", minPoints: 1000 },
      { level: 6, name: "Health Expert", minPoints: 1500 },
      { level: 7, name: "Health Hero", minPoints: 2500 },
      { level: 8, name: "Health Legend", minPoints: 4000 },
      { level: 9, name: "Health Titan", minPoints: 6000 },
      { level: 10, name: "Ultimate Wellness", minPoints: 10000 },
    ];

    let current = levels[0];
    let next = levels[1] || levels[0];

    for (let i = 0; i < levels.length; i++) {
      if (points >= levels[i].minPoints) {
        current = levels[i];
        next = levels[i + 1] || levels[i];
      }
    }

    const pointsInLevel = points - current.minPoints;
    const pointsForLevel = next.minPoints - current.minPoints;
    const progress = pointsForLevel > 0 ? Math.min((pointsInLevel / pointsForLevel) * 100, 100) : 100;

    return {
      level: current.level,
      name: current.name,
      pointsToNext: Math.max(0, next.minPoints - points),
      progress,
    };
  }

  async getEngagementSummary(profileId: string): Promise<any> {
    const [unreadMessages] = await phiDb.select({
      count: sql<number>`COALESCE(SUM(${engagementMessageThreadsTable.patientUnreadCount}), 0)`
    }).from(engagementMessageThreadsTable)
      .where(eq(engagementMessageThreadsTable.patientProfileId, profileId));

    const [upcomingAppointments] = await phiDb.select({
      count: sql<number>`count(*)`
    }).from(engagementAppointmentsTable)
      .where(and(
        eq(engagementAppointmentsTable.patientProfileId, profileId),
        gte(engagementAppointmentsTable.scheduledDate, new Date()),
        or(
          eq(engagementAppointmentsTable.status, "pending"),
          eq(engagementAppointmentsTable.status, "confirmed")
        )
      ));

    const rewards = await this.getPatientRewards(profileId);

    return {
      unreadMessages: Number(unreadMessages?.count || 0),
      upcomingAppointments: Number(upcomingAppointments?.count || 0),
      totalPoints: rewards.totalPoints,
      level: rewards.level,
      currentStreaks: rewards.streaks,
      badgeCount: rewards.badges.length,
    };
  }
}

export const patientEngagementService = new PatientEngagementService();
