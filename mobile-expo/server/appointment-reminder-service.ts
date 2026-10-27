import { db } from "./db";
import { eq, and, lte, sql } from "drizzle-orm";
import {
  appointmentReminders,
  appointmentReminderPreferences,
  telehealthVisits,
} from "@shared/schema";
import { twilioSmsService } from "./twilio-sms-service";

function formatMinutes(minutes: number, style: "short" | "human" = "short"): string {
  if (style === "human") {
    if (minutes >= 1440) {
      const days = Math.floor(minutes / 1440);
      return days === 1 ? "in 1 day" : `in ${days} days`;
    }
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      return hours === 1 ? "in 1 hour" : `in ${hours} hours`;
    }
    return `in ${minutes} minutes`;
  }

  if (minutes >= 1440) return `${Math.floor(minutes / 1440)}d`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h`;
  return `${minutes}min`;
}

export const appointmentReminderService = {
  async getPreferences(userId: string) {
    const [prefs] = await db
      .select()
      .from(appointmentReminderPreferences)
      .where(eq(appointmentReminderPreferences.userId, userId))
      .limit(1);

    if (!prefs) {
      return {
        id: null,
        userId,
        enabled: true,
        reminderTimes: [1440, 60],
        channels: ["in_app"],
        quietHoursStart: null,
        quietHoursEnd: null,
      };
    }

    return prefs;
  },

  async upsertPreferences(
    userId: string,
    data: {
      enabled?: boolean;
      reminderTimes?: number[];
      channels?: string[];
      quietHoursStart?: string | null;
      quietHoursEnd?: string | null;
    }
  ) {
    const existing = await db
      .select()
      .from(appointmentReminderPreferences)
      .where(eq(appointmentReminderPreferences.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(appointmentReminderPreferences)
        .set({
          ...(data.enabled !== undefined && { enabled: data.enabled }),
          ...(data.reminderTimes && { reminderTimes: data.reminderTimes }),
          ...(data.channels && { channels: data.channels }),
          ...(data.quietHoursStart !== undefined && {
            quietHoursStart: data.quietHoursStart,
          }),
          ...(data.quietHoursEnd !== undefined && {
            quietHoursEnd: data.quietHoursEnd,
          }),
          updatedAt: new Date(),
        })
        .where(eq(appointmentReminderPreferences.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(appointmentReminderPreferences)
      .values({
        userId,
        enabled: data.enabled ?? true,
        reminderTimes: data.reminderTimes || [1440, 60],
        channels: data.channels || ["in_app"],
        quietHoursStart: data.quietHoursStart || null,
        quietHoursEnd: data.quietHoursEnd || null,
      })
      .returning();
    return created;
  },

  async scheduleRemindersForVisit(visitId: string) {
    const [visit] = await db
      .select()
      .from(telehealthVisits)
      .where(eq(telehealthVisits.id, visitId))
      .limit(1);

    if (!visit || visit.status === "cancelled" || visit.status === "completed") {
      return [];
    }

    const scheduledAt = new Date(visit.scheduledAt);
    if (scheduledAt <= new Date()) return [];

    const patientId = visit.patientId;
    const prefs = await this.getPreferences(patientId);
    if (!prefs.enabled) return [];

    const reminderTimes = (prefs.reminderTimes as number[]) || [1440, 60];
    const channels = (prefs.channels as string[]) || ["in_app"];

    await db
      .delete(appointmentReminders)
      .where(
        and(
          eq(appointmentReminders.visitId, visitId),
          eq(appointmentReminders.userId, patientId),
          eq(appointmentReminders.status, "scheduled")
        )
      );

    const reminders = [];
    for (const minutesBefore of reminderTimes) {
      const scheduledFor = new Date(
        scheduledAt.getTime() - minutesBefore * 60 * 1000
      );
      if (scheduledFor <= new Date()) continue;

      for (const channel of channels) {
        const [reminder] = await db
          .insert(appointmentReminders)
          .values({
            visitId,
            userId: patientId,
            reminderType: formatMinutes(minutesBefore),
            minutesBefore,
            channel,
            status: "scheduled",
            scheduledFor,
          })
          .returning();
        reminders.push(reminder);
      }
    }

    if (visit.providerId) {
      for (const minutesBefore of [60, 15]) {
        const scheduledFor = new Date(
          scheduledAt.getTime() - minutesBefore * 60 * 1000
        );
        if (scheduledFor <= new Date()) continue;

        const [reminder] = await db
          .insert(appointmentReminders)
          .values({
            visitId,
            userId: visit.providerId,
            reminderType: formatMinutes(minutesBefore),
            minutesBefore,
            channel: "in_app",
            status: "scheduled",
            scheduledFor,
            metadata: { role: "provider" },
          })
          .returning();
        reminders.push(reminder);
      }
    }

    return reminders;
  },

  async processReminders() {
    const now = new Date();

    const dueReminders = await db
      .select()
      .from(appointmentReminders)
      .where(
        and(
          eq(appointmentReminders.status, "scheduled"),
          lte(appointmentReminders.scheduledFor, now)
        )
      );

    const results = [];
    for (const reminder of dueReminders) {
      try {
        const [visit] = await db
          .select()
          .from(telehealthVisits)
          .where(eq(telehealthVisits.id, reminder.visitId))
          .limit(1);

        if (!visit || visit.status === "cancelled") {
          await db
            .update(appointmentReminders)
            .set({ status: "cancelled" })
            .where(eq(appointmentReminders.id, reminder.id));
          continue;
        }

        const delivered = await this.deliverReminder(reminder, visit);

        await db
          .update(appointmentReminders)
          .set({
            status: delivered.success ? "sent" : "failed",
            sentAt: delivered.success ? now : null,
            failureReason: delivered.error || null,
          })
          .where(eq(appointmentReminders.id, reminder.id));

        results.push({
          id: reminder.id,
          status: delivered.success ? "sent" : "failed",
        });
      } catch (err: any) {
        await db
          .update(appointmentReminders)
          .set({
            status: "failed",
            failureReason: err.message,
          })
          .where(eq(appointmentReminders.id, reminder.id));
        results.push({ id: reminder.id, status: "failed", error: err.message });
      }
    }

    return results;
  },

  async deliverReminder(
    reminder: any,
    visit: any
  ): Promise<{ success: boolean; error?: string }> {
    const timeLabel = formatMinutes(reminder.minutesBefore, "human");
    const visitTime = new Date(visit.scheduledAt).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const message = `Reminder: Your telehealth appointment "${visit.title}" is ${timeLabel}. Scheduled for ${visitTime}.`;

    if (reminder.channel === "sms") {
      try {
        const phone = await twilioSmsService.getUserPhone(reminder.userId);
        if (!phone) {
          return { success: false, error: "No phone number on file" };
        }

        const result = await twilioSmsService.sendSms(phone, message);
        return result;
      } catch (err: any) {
        return { success: false, error: `SMS delivery failed: ${err.message}` };
      }
    }

    if (reminder.channel === "in_app") {
      await db
        .update(appointmentReminders)
        .set({
          metadata: {
            ...(reminder.metadata || {}),
            notificationTitle: "Appointment Reminder",
            notificationBody: message,
            visitId: visit.id,
            visitTitle: visit.title,
            scheduledAt: visit.scheduledAt,
          },
        })
        .where(eq(appointmentReminders.id, reminder.id));
      return { success: true };
    }

    if (reminder.channel === "email") {
      return {
        success: false,
        error: "Email delivery not yet configured",
      };
    }

    return { success: false, error: `Unknown channel: ${reminder.channel}` };
  },

  async getRemindersForVisit(visitId: string) {
    return db
      .select()
      .from(appointmentReminders)
      .where(eq(appointmentReminders.visitId, visitId));
  },

  async getRemindersForUser(userId: string) {
    return db
      .select({
        reminder: appointmentReminders,
        visit: {
          id: telehealthVisits.id,
          title: telehealthVisits.title,
          scheduledAt: telehealthVisits.scheduledAt,
          visitType: telehealthVisits.visitType,
          status: telehealthVisits.status,
          providerName: telehealthVisits.providerName,
        },
      })
      .from(appointmentReminders)
      .innerJoin(
        telehealthVisits,
        eq(appointmentReminders.visitId, telehealthVisits.id)
      )
      .where(eq(appointmentReminders.userId, userId));
  },

  async getUnreadNotifications(userId: string) {
    return db
      .select({
        reminder: appointmentReminders,
        visit: {
          id: telehealthVisits.id,
          title: telehealthVisits.title,
          scheduledAt: telehealthVisits.scheduledAt,
          visitType: telehealthVisits.visitType,
          providerName: telehealthVisits.providerName,
        },
      })
      .from(appointmentReminders)
      .innerJoin(
        telehealthVisits,
        eq(appointmentReminders.visitId, telehealthVisits.id)
      )
      .where(
        and(
          eq(appointmentReminders.userId, userId),
          eq(appointmentReminders.status, "sent"),
          eq(appointmentReminders.channel, "in_app")
        )
      );
  },

  async markReminderRead(reminderId: string) {
    const [updated] = await db
      .update(appointmentReminders)
      .set({
        metadata: sql`COALESCE(metadata, '{}'::jsonb) || '{"read": true}'::jsonb`,
      })
      .where(eq(appointmentReminders.id, reminderId))
      .returning();
    return updated;
  },

  async cancelRemindersForVisit(visitId: string) {
    await db
      .update(appointmentReminders)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(appointmentReminders.visitId, visitId),
          eq(appointmentReminders.status, "scheduled")
        )
      );
  },
};
