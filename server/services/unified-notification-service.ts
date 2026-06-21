import { logPhiAccess } from "../security/hipaa-audit";

export type NotificationCategory = "message" | "alert" | "health_update" | "reminder" | "appointment" | "medication" | "caregiver" | "system";
export type NotificationPriority = "low" | "normal" | "high" | "urgent";
export type NotificationChannel = "in_app" | "email" | "sms" | "push";

export interface UnifiedNotification {
  id: string;
  userId: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  icon?: string;
  actionUrl?: string;
  actionLabel?: string;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
  readAt?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
  groupId?: string;
  sourceType?: string;
  sourceId?: string;
}

export interface NotificationPreferences {
  userId: string;
  enabledCategories: NotificationCategory[];
  channels: {
    in_app: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };
  emailDigest: "realtime" | "daily" | "weekly" | "none";
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  showPreview: boolean;
  priorityFilter: NotificationPriority[];
  updatedAt: string;
}

const notifications: Map<string, UnifiedNotification[]> = new Map();
const preferences: Map<string, NotificationPreferences> = new Map();
const subscribers: Map<string, ((notification: UnifiedNotification) => void)[]> = new Map();

function generateId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function hashUserId(userId: string): string {
  return Buffer.from(userId).toString("base64").substring(0, 8);
}

export class UnifiedNotificationService {
  createNotification(
    userId: string,
    data: Omit<UnifiedNotification, "id" | "userId" | "read" | "dismissed" | "createdAt">
  ): UnifiedNotification {
    const notification: UnifiedNotification = {
      id: generateId(),
      userId,
      read: false,
      dismissed: false,
      createdAt: new Date().toISOString(),
      ...data,
    };

    const userNotifs = notifications.get(userId) || [];
    userNotifs.unshift(notification);
    if (userNotifs.length > 500) {
      userNotifs.splice(500);
    }
    notifications.set(userId, userNotifs);

    logPhiAccess({
      userId: hashUserId(userId),
      action: "write",
      resourceType: "Notification",
      resourceId: notification.id,
      details: "notification_delivery",
    });

    const userSubscribers = subscribers.get(userId) || [];
    userSubscribers.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        console.error("[UnifiedNotification] Subscriber callback error:", error);
      }
    });

    return notification;
  }

  getNotifications(
    userId: string,
    options: {
      category?: NotificationCategory;
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
      includeExpired?: boolean;
    } = {}
  ): { notifications: UnifiedNotification[]; total: number; unreadCount: number } {
    const userNotifs = notifications.get(userId) || [];
    const now = new Date();

    let filtered = userNotifs.filter(n => {
      if (n.dismissed) return false;
      if (!options.includeExpired && n.expiresAt && new Date(n.expiresAt) < now) return false;
      if (options.category && n.category !== options.category) return false;
      if (options.unreadOnly && n.read) return false;
      return true;
    });

    const total = filtered.length;
    const unreadCount = filtered.filter(n => !n.read).length;

    if (options.offset) {
      filtered = filtered.slice(options.offset);
    }
    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    logPhiAccess({
      userId: hashUserId(userId),
      action: "read",
      resourceType: "NotificationList",
      resourceId: userId,
      details: "notification_retrieval",
    });

    return { notifications: filtered, total, unreadCount };
  }

  getNotificationStats(userId: string): {
    total: number;
    unread: number;
    byCategory: Record<NotificationCategory, { total: number; unread: number }>;
    byPriority: Record<NotificationPriority, number>;
  } {
    const userNotifs = notifications.get(userId) || [];
    const now = new Date();
    const active = userNotifs.filter(n => !n.dismissed && (!n.expiresAt || new Date(n.expiresAt) >= now));

    const byCategory: Record<NotificationCategory, { total: number; unread: number }> = {
      message: { total: 0, unread: 0 },
      alert: { total: 0, unread: 0 },
      health_update: { total: 0, unread: 0 },
      reminder: { total: 0, unread: 0 },
      appointment: { total: 0, unread: 0 },
      medication: { total: 0, unread: 0 },
      caregiver: { total: 0, unread: 0 },
      system: { total: 0, unread: 0 },
    };

    const byPriority: Record<NotificationPriority, number> = {
      low: 0,
      normal: 0,
      high: 0,
      urgent: 0,
    };

    active.forEach(n => {
      byCategory[n.category].total++;
      if (!n.read) byCategory[n.category].unread++;
      if (!n.read) byPriority[n.priority]++;
    });

    return {
      total: active.length,
      unread: active.filter(n => !n.read).length,
      byCategory,
      byPriority,
    };
  }

  markAsRead(userId: string, notificationId: string): boolean {
    const userNotifs = notifications.get(userId);
    if (!userNotifs) return false;

    const notification = userNotifs.find(n => n.id === notificationId);
    if (!notification) return false;

    notification.read = true;
    notification.readAt = new Date().toISOString();

    logPhiAccess({
      userId: hashUserId(userId),
      action: "write",
      resourceType: "Notification",
      resourceId: notificationId,
      details: "notification_read",
    });

    return true;
  }

  markAllAsRead(userId: string, category?: NotificationCategory): number {
    const userNotifs = notifications.get(userId);
    if (!userNotifs) return 0;

    let count = 0;
    const now = new Date().toISOString();

    userNotifs.forEach(n => {
      if (!n.read && !n.dismissed) {
        if (!category || n.category === category) {
          n.read = true;
          n.readAt = now;
          count++;
        }
      }
    });

    logPhiAccess({
      userId: hashUserId(userId),
      action: "write",
      resourceType: "NotificationBatch",
      resourceId: userId,
      details: "notification_mark_all_read",
    });

    return count;
  }

  dismissNotification(userId: string, notificationId: string): boolean {
    const userNotifs = notifications.get(userId);
    if (!userNotifs) return false;

    const notification = userNotifs.find(n => n.id === notificationId);
    if (!notification) return false;

    notification.dismissed = true;

    logPhiAccess({
      userId: hashUserId(userId),
      action: "write",
      resourceType: "Notification",
      resourceId: notificationId,
      details: "notification_dismiss",
    });

    return true;
  }

  dismissAllByCategory(userId: string, category: NotificationCategory): number {
    const userNotifs = notifications.get(userId);
    if (!userNotifs) return 0;

    let count = 0;
    userNotifs.forEach(n => {
      if (n.category === category && !n.dismissed) {
        n.dismissed = true;
        count++;
      }
    });

    return count;
  }

  getPreferences(userId: string): NotificationPreferences {
    let prefs = preferences.get(userId);
    if (!prefs) {
      prefs = this.createDefaultPreferences(userId);
      preferences.set(userId, prefs);
    }
    return prefs;
  }

  updatePreferences(userId: string, updates: Partial<NotificationPreferences>): NotificationPreferences {
    const current = this.getPreferences(userId);
    const updated: NotificationPreferences = {
      ...current,
      ...updates,
      userId,
      updatedAt: new Date().toISOString(),
    };
    preferences.set(userId, updated);

    logPhiAccess({
      userId: hashUserId(userId),
      action: "write",
      resourceType: "NotificationPreferences",
      resourceId: userId,
      details: "preference_update",
    });

    return updated;
  }

  private createDefaultPreferences(userId: string): NotificationPreferences {
    return {
      userId,
      enabledCategories: ["message", "alert", "health_update", "reminder", "appointment", "medication", "caregiver", "system"],
      channels: {
        in_app: true,
        email: true,
        sms: false,
        push: true,
      },
      quietHours: {
        enabled: false,
        start: "22:00",
        end: "07:00",
        timezone: "America/New_York",
      },
      emailDigest: "daily",
      soundEnabled: true,
      vibrationEnabled: true,
      showPreview: true,
      priorityFilter: ["low", "normal", "high", "urgent"],
      updatedAt: new Date().toISOString(),
    };
  }

  subscribe(userId: string, callback: (notification: UnifiedNotification) => void): () => void {
    const userSubs = subscribers.get(userId) || [];
    userSubs.push(callback);
    subscribers.set(userId, userSubs);

    return () => {
      const subs = subscribers.get(userId) || [];
      const index = subs.indexOf(callback);
      if (index > -1) {
        subs.splice(index, 1);
      }
    };
  }

  sendTestNotification(userId: string): UnifiedNotification {
    return this.createNotification(userId, {
      category: "system",
      priority: "normal",
      title: "Test Notification",
      message: "This is a test notification to verify your notification settings are working correctly.",
      icon: "bell",
      actionUrl: "/settings/notifications",
      actionLabel: "View Settings",
    });
  }

  createHealthUpdateNotification(userId: string, data: {
    title: string;
    message: string;
    priority?: NotificationPriority;
    actionUrl?: string;
  }): UnifiedNotification {
    return this.createNotification(userId, {
      category: "health_update",
      priority: data.priority || "normal",
      title: data.title,
      message: data.message,
      icon: "heart",
      actionUrl: data.actionUrl,
    });
  }

  createAppointmentReminder(userId: string, data: {
    appointmentId: string;
    providerName: string;
    dateTime: string;
    location?: string;
  }): UnifiedNotification {
    return this.createNotification(userId, {
      category: "appointment",
      priority: "high",
      title: "Upcoming Appointment",
      message: `Reminder: Appointment with ${data.providerName} on ${data.dateTime}${data.location ? ` at ${data.location}` : ""}`,
      icon: "calendar",
      actionUrl: `/appointments/${data.appointmentId}`,
      actionLabel: "View Details",
      metadata: { appointmentId: data.appointmentId },
      sourceType: "appointment",
      sourceId: data.appointmentId,
    });
  }

  createMedicationReminder(userId: string, data: {
    medicationName: string;
    dosage: string;
    scheduleTime: string;
  }): UnifiedNotification {
    return this.createNotification(userId, {
      category: "medication",
      priority: "high",
      title: "Medication Reminder",
      message: `Time to take ${data.medicationName} (${data.dosage})`,
      icon: "pill",
      actionUrl: "/medications",
      actionLabel: "Log Dose",
    });
  }

  createCaregiverNotification(userId: string, data: {
    caregiverName: string;
    action: string;
    patientName?: string;
  }): UnifiedNotification {
    return this.createNotification(userId, {
      category: "caregiver",
      priority: "normal",
      title: "Caregiver Update",
      message: `${data.caregiverName} ${data.action}${data.patientName ? ` for ${data.patientName}` : ""}`,
      icon: "users",
      actionUrl: "/caregivers",
    });
  }

  getGroupedNotifications(userId: string): Record<string, UnifiedNotification[]> {
    const { notifications } = this.getNotifications(userId, { limit: 100 });
    const grouped: Record<string, UnifiedNotification[]> = {};

    notifications.forEach(n => {
      const key = n.groupId || n.category;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(n);
    });

    return grouped;
  }

  initializeSampleData(userId: string): void {
    const sampleNotifications = [
      {
        category: "message" as NotificationCategory,
        priority: "normal" as NotificationPriority,
        title: "New Message from Dr. Smith",
        message: "Your recent lab results are ready for review. Please log in to view them.",
        icon: "message-square",
        actionUrl: "/messages",
      },
      {
        category: "health_update" as NotificationCategory,
        priority: "high" as NotificationPriority,
        title: "Blood Pressure Alert",
        message: "Your recent blood pressure reading was higher than your target range.",
        icon: "heart",
        actionUrl: "/health-metrics",
      },
      {
        category: "appointment" as NotificationCategory,
        priority: "high" as NotificationPriority,
        title: "Upcoming Appointment Tomorrow",
        message: "Reminder: Annual checkup with Dr. Johnson at 10:00 AM",
        icon: "calendar",
        actionUrl: "/appointments",
      },
      {
        category: "medication" as NotificationCategory,
        priority: "normal" as NotificationPriority,
        title: "Refill Ready",
        message: "Your prescription for Metformin is ready for pickup at Main Street Pharmacy.",
        icon: "pill",
        actionUrl: "/medications",
      },
      {
        category: "alert" as NotificationCategory,
        priority: "urgent" as NotificationPriority,
        title: "New Health Record Available",
        message: "A new diagnostic report has been added to your health records from City Hospital.",
        icon: "file-text",
        actionUrl: "/health-records",
      },
      {
        category: "reminder" as NotificationCategory,
        priority: "low" as NotificationPriority,
        title: "Complete Your Health Profile",
        message: "Add your family health history to receive personalized health insights.",
        icon: "user-check",
        actionUrl: "/profile",
      },
      {
        category: "caregiver" as NotificationCategory,
        priority: "normal" as NotificationPriority,
        title: "Caregiver Update",
        message: "Sarah (caregiver) logged medication intake for Mom at 8:00 AM.",
        icon: "users",
        actionUrl: "/caregivers",
      },
    ];

    sampleNotifications.forEach((n, index) => {
      const createdAt = new Date();
      createdAt.setHours(createdAt.getHours() - index * 2);
      
      this.createNotification(userId, {
        ...n,
        metadata: { sample: true },
      });
    });
  }
}

export const unifiedNotificationService = new UnifiedNotificationService();
console.log("[UnifiedNotification] Service initialized with multi-category support");
