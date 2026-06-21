import type {
  TelehealthReminderPreference,
  TelehealthReminder,
  TelehealthNotification,
  ReminderTiming,
  ReminderChannel,
  VideoAppointment,
  InsertTelehealthReminderPreference,
} from "@shared/schema";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const TIMING_MS: Record<ReminderTiming, number> = {
  "24_hours": 24 * 60 * 60 * 1000,
  "2_hours": 2 * 60 * 60 * 1000,
  "1_hour": 1 * 60 * 60 * 1000,
  "30_minutes": 30 * 60 * 1000,
  "15_minutes": 15 * 60 * 1000,
};

const TIMING_LABELS: Record<ReminderTiming, string> = {
  "24_hours": "24 hours",
  "2_hours": "2 hours",
  "1_hour": "1 hour",
  "30_minutes": "30 minutes",
  "15_minutes": "15 minutes",
};

export class TelehealthReminderService {
  private preferences: TelehealthReminderPreference[] = [];
  private reminders: TelehealthReminder[] = [];
  private notifications: TelehealthNotification[] = [];
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.seedDefaultPreferences();
  }

  private seedDefaultPreferences() {
    this.preferences = [
      {
        id: generateId("pref"),
        userId: "patient-001",
        userRole: "patient",
        channels: ["in_app", "email"],
        timings: ["24_hours", "1_hour"],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: generateId("pref"),
        userId: "clinician-1",
        userRole: "provider",
        channels: ["in_app"],
        timings: ["1_hour", "15_minutes"],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  getPreferences(userId: string): TelehealthReminderPreference | null {
    return this.preferences.find((p) => p.userId === userId) || null;
  }

  upsertPreferences(data: InsertTelehealthReminderPreference): TelehealthReminderPreference {
    const existing = this.preferences.findIndex((p) => p.userId === data.userId);
    const now = new Date().toISOString();

    if (existing >= 0) {
      this.preferences[existing] = {
        ...this.preferences[existing],
        channels: data.channels,
        timings: data.timings,
        enabled: data.enabled ?? true,
        updatedAt: now,
      };
      return this.preferences[existing];
    }

    const pref: TelehealthReminderPreference = {
      id: generateId("pref"),
      userId: data.userId,
      userRole: data.userRole,
      channels: data.channels,
      timings: data.timings,
      enabled: data.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.preferences.push(pref);
    return pref;
  }

  generateRemindersForAppointment(appointment: VideoAppointment): TelehealthReminder[] {
    const generated: TelehealthReminder[] = [];
    const appointmentTime = new Date(appointment.scheduledStartTime).getTime();
    const now = Date.now();

    const recipientConfigs = [
      {
        id: appointment.patientId,
        role: "patient" as const,
        name: appointment.patientName,
      },
      {
        id: appointment.clinicianId,
        role: "provider" as const,
        name: appointment.clinicianName,
      },
    ];

    for (const recipient of recipientConfigs) {
      const prefs = this.getPreferences(recipient.id);
      const timings = prefs?.enabled ? prefs.timings : ["1_hour" as ReminderTiming];
      const channels = prefs?.enabled ? prefs.channels : ["in_app" as ReminderChannel];

      for (const timing of timings) {
        const reminderTime = appointmentTime - TIMING_MS[timing];
        if (reminderTime <= now) continue;

        const alreadyExists = this.reminders.some(
          (r) =>
            r.appointmentId === appointment.id &&
            r.recipientId === recipient.id &&
            r.timing === timing &&
            r.status !== "cancelled"
        );
        if (alreadyExists) continue;

        for (const channel of channels) {
          const message = this.formatMessage(
            recipient.role,
            appointment,
            timing
          );

          const reminder: TelehealthReminder = {
            id: generateId("rem"),
            appointmentId: appointment.id,
            recipientId: recipient.id,
            recipientRole: recipient.role,
            recipientName: recipient.name,
            appointmentTitle: appointment.reason,
            providerName: appointment.clinicianName,
            scheduledTime: appointment.scheduledStartTime,
            reminderTime: new Date(reminderTime).toISOString(),
            timing,
            channel,
            status: "scheduled",
            message,
            createdAt: new Date().toISOString(),
          };

          this.reminders.push(reminder);
          generated.push(reminder);
        }
      }
    }

    return generated;
  }

  private formatMessage(
    role: "patient" | "provider",
    appointment: VideoAppointment,
    timing: ReminderTiming
  ): string {
    const timeLabel = TIMING_LABELS[timing];
    const dt = new Date(appointment.scheduledStartTime);
    const dateStr = dt.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const timeStr = dt.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    if (role === "patient") {
      return `Your telehealth appointment with ${appointment.clinicianName} is in ${timeLabel} (${dateStr} at ${timeStr}). Reason: ${appointment.reason}. Please ensure your camera and microphone are ready.`;
    }
    return `Telehealth session with patient ${appointment.patientName} in ${timeLabel} (${dateStr} at ${timeStr}). Reason: ${appointment.reason}.`;
  }

  processScheduledReminders(): TelehealthReminder[] {
    const now = Date.now();
    const sent: TelehealthReminder[] = [];

    for (const reminder of this.reminders) {
      if (reminder.status !== "scheduled") continue;
      const reminderTime = new Date(reminder.reminderTime).getTime();
      if (reminderTime > now) continue;

      if (reminder.channel === "in_app") {
        this.createNotification(reminder);
        reminder.status = "sent";
        reminder.sentAt = new Date().toISOString();
        sent.push(reminder);
      } else if (reminder.channel === "email") {
        console.log(`[ReminderService] Email reminder queued for ${reminder.recipientName}: ${reminder.message}`);
        reminder.status = "sent";
        reminder.sentAt = new Date().toISOString();
        sent.push(reminder);
      } else {
        reminder.status = "sent";
        reminder.sentAt = new Date().toISOString();
        sent.push(reminder);
      }
    }

    return sent;
  }

  private createNotification(reminder: TelehealthReminder) {
    const notification: TelehealthNotification = {
      id: generateId("notif"),
      userId: reminder.recipientId,
      type: "appointment_reminder",
      title: "Upcoming Appointment",
      message: reminder.message,
      actionUrl: reminder.recipientRole === "patient"
        ? `/telehealth`
        : `/clinician-dashboard`,
      read: false,
      createdAt: new Date().toISOString(),
      expiresAt: reminder.scheduledTime,
    };
    this.notifications.push(notification);
  }

  triggerImmediateReminder(
    appointment: VideoAppointment,
    recipientId: string,
    recipientRole: "patient" | "provider",
    recipientName: string,
    channel: ReminderChannel
  ): TelehealthReminder {
    const message = this.formatMessage(
      recipientRole,
      appointment,
      "15_minutes"
    );

    const reminder: TelehealthReminder = {
      id: generateId("rem"),
      appointmentId: appointment.id,
      recipientId,
      recipientRole,
      recipientName,
      appointmentTitle: appointment.reason,
      providerName: appointment.clinicianName,
      scheduledTime: appointment.scheduledStartTime,
      reminderTime: new Date().toISOString(),
      timing: "15_minutes",
      channel,
      status: "sent",
      message,
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    this.reminders.push(reminder);

    if (channel === "in_app") {
      this.createNotification(reminder);
    }

    return reminder;
  }

  getReminders(filters: {
    appointmentId?: string;
    recipientId?: string;
    status?: string;
  }): TelehealthReminder[] {
    let results = [...this.reminders];
    if (filters.appointmentId) {
      results = results.filter((r) => r.appointmentId === filters.appointmentId);
    }
    if (filters.recipientId) {
      results = results.filter((r) => r.recipientId === filters.recipientId);
    }
    if (filters.status) {
      results = results.filter((r) => r.status === filters.status);
    }
    return results.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  acknowledgeReminder(reminderId: string): TelehealthReminder | null {
    const reminder = this.reminders.find((r) => r.id === reminderId);
    if (!reminder) return null;
    reminder.status = "acknowledged";
    reminder.acknowledgedAt = new Date().toISOString();
    return reminder;
  }

  cancelRemindersForAppointment(appointmentId: string): number {
    let count = 0;
    for (const r of this.reminders) {
      if (r.appointmentId === appointmentId && r.status === "scheduled") {
        r.status = "cancelled";
        count++;
      }
    }
    return count;
  }

  getNotifications(userId: string, unreadOnly = false): TelehealthNotification[] {
    let results = this.notifications.filter((n) => n.userId === userId);
    if (unreadOnly) {
      results = results.filter((n) => !n.read);
    }
    const now = Date.now();
    results = results.filter(
      (n) => !n.expiresAt || new Date(n.expiresAt).getTime() > now
    );
    return results.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  markNotificationRead(notificationId: string): TelehealthNotification | null {
    const notification = this.notifications.find((n) => n.id === notificationId);
    if (!notification) return null;
    notification.read = true;
    return notification;
  }

  markAllNotificationsRead(userId: string): number {
    let count = 0;
    for (const n of this.notifications) {
      if (n.userId === userId && !n.read) {
        n.read = true;
        count++;
      }
    }
    return count;
  }

  addNotification(
    userId: string,
    type: TelehealthNotification["type"],
    title: string,
    message: string,
    actionUrl?: string
  ): TelehealthNotification {
    const notification: TelehealthNotification = {
      id: generateId("notif"),
      userId,
      type,
      title,
      message,
      actionUrl,
      read: false,
      createdAt: new Date().toISOString(),
    };
    this.notifications.push(notification);
    return notification;
  }

  getStats(userId?: string) {
    const userReminders = userId
      ? this.reminders.filter((r) => r.recipientId === userId)
      : this.reminders;

    return {
      total: userReminders.length,
      scheduled: userReminders.filter((r) => r.status === "scheduled").length,
      sent: userReminders.filter((r) => r.status === "sent").length,
      acknowledged: userReminders.filter((r) => r.status === "acknowledged").length,
      failed: userReminders.filter((r) => r.status === "failed").length,
      cancelled: userReminders.filter((r) => r.status === "cancelled").length,
    };
  }

  startScheduler(appointments: VideoAppointment[], intervalMs = 30000) {
    for (const apt of appointments) {
      if (apt.status === "scheduled") {
        this.generateRemindersForAppointment(apt);
      }
    }

    this.checkInterval = setInterval(() => {
      const sent = this.processScheduledReminders();
      if (sent.length > 0) {
        console.log(
          `[ReminderService] Processed ${sent.length} reminders`
        );
      }
    }, intervalMs);

    console.log(
      `[ReminderService] Scheduler started, checking every ${intervalMs / 1000}s`
    );
    console.log(
      `[ReminderService] Generated reminders for ${appointments.filter((a) => a.status === "scheduled").length} appointments`
    );
  }

  stopScheduler() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

export const reminderService = new TelehealthReminderService();
