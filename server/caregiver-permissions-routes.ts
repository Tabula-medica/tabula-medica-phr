import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import {
  insertCaregiverSectionConsentSchema,
  insertCaregiverNotificationSchema,
  insertCaregiverNotificationPreferencesSchema,
  CaregiverSectionConsent,
  CaregiverNotification,
  CaregiverNotificationPreferences,
  CaregiverActivityEntry,
  CaregiverPermissionLevel,
  CaregiverNotificationType,
} from "@shared/schema";

const router = Router();

const sectionConsentsStore: Map<string, CaregiverSectionConsent> = new Map();
const notificationsStore: Map<string, CaregiverNotification> = new Map();
const notificationPreferencesStore: Map<string, CaregiverNotificationPreferences> = new Map();
const activityLogStore: Map<string, CaregiverActivityEntry> = new Map();

const SYSTEM_USER_ID = "user-123";
const SYSTEM_CAREGIVER_ID = "caregiver-michael-001";

function initializeSampleData() {
  if (sectionConsentsStore.size > 0) return;

  const now = new Date().toISOString();

  const sampleConsents: CaregiverSectionConsent[] = [
    {
      id: "consent-1",
      profileId: "profile-self-001",
      caregiverId: SYSTEM_CAREGIVER_ID,
      caregiverName: "Michael Johnson",
      section: "cancer_track",
      permissionLevel: "add_entries",
      grantedBy: SYSTEM_USER_ID,
      grantedAt: now,
      expiresAt: null,
      isActive: true,
      notes: "Primary caregiver - can add timeline entries and notes",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "consent-2",
      profileId: "profile-self-001",
      caregiverId: SYSTEM_CAREGIVER_ID,
      caregiverName: "Michael Johnson",
      section: "side_effects_journal",
      permissionLevel: "add_entries",
      grantedBy: SYSTEM_USER_ID,
      grantedAt: now,
      expiresAt: null,
      isActive: true,
      notes: "Can log symptoms on behalf of patient",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "consent-3",
      profileId: "profile-self-001",
      caregiverId: "caregiver-sister-002",
      caregiverName: "Emily Johnson",
      section: "cancer_track",
      permissionLevel: "view_only",
      grantedBy: SYSTEM_USER_ID,
      grantedAt: now,
      expiresAt: null,
      isActive: true,
      notes: "View-only access for sister",
      createdAt: now,
      updatedAt: now,
    },
  ];

  sampleConsents.forEach(c => sectionConsentsStore.set(c.id, c));

  const sampleNotifications: CaregiverNotification[] = [
    {
      id: "notif-1",
      caregiverId: SYSTEM_CAREGIVER_ID,
      profileId: "profile-self-001",
      profileName: "Sarah Johnson",
      type: "appointment_reminder",
      priority: "normal",
      title: "Upcoming Oncology Appointment",
      message: "Sarah has an oncology follow-up appointment tomorrow at 10:00 AM with Dr. Sarah Johnson at City Cancer Center.",
      actionUrl: "/appointments",
      relatedEntityId: "apt-123",
      relatedEntityType: "appointment",
      isRead: false,
      readAt: null,
      isDismissed: false,
      dismissedAt: null,
      expiresAt: null,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "notif-2",
      caregiverId: SYSTEM_CAREGIVER_ID,
      profileId: "profile-self-001",
      profileName: "Sarah Johnson",
      type: "side_effect_reported",
      priority: "normal",
      title: "New Side Effect Logged",
      message: "Sarah reported a new side effect: mild fatigue while taking Tamoxifen.",
      actionUrl: "/side-effects",
      relatedEntityId: "sym-new",
      relatedEntityType: "symptom_entry",
      isRead: false,
      readAt: null,
      isDismissed: false,
      dismissedAt: null,
      expiresAt: null,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: "notif-3",
      caregiverId: SYSTEM_CAREGIVER_ID,
      profileId: "profile-self-001",
      profileName: "Sarah Johnson",
      type: "cancer_track_update",
      priority: "normal",
      title: "Treatment Timeline Updated",
      message: "A new entry was added to Sarah's cancer treatment timeline: Lab results received.",
      actionUrl: "/cancer-track",
      relatedEntityId: "timeline-new",
      relatedEntityType: "timeline_entry",
      isRead: true,
      readAt: new Date(Date.now() - 86400000).toISOString(),
      isDismissed: false,
      dismissedAt: null,
      expiresAt: null,
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: "notif-4",
      caregiverId: SYSTEM_CAREGIVER_ID,
      profileId: "profile-self-001",
      profileName: "Sarah Johnson",
      type: "medication_added",
      priority: "high",
      title: "New Medication Started",
      message: "Sarah started a new medication: Gabapentin 300mg for neuropathy management.",
      actionUrl: "/medications",
      relatedEntityId: "med-3",
      relatedEntityType: "medication",
      isRead: true,
      readAt: new Date(Date.now() - 259200000).toISOString(),
      isDismissed: false,
      dismissedAt: null,
      expiresAt: null,
      createdAt: new Date(Date.now() - 604800000).toISOString(),
    },
  ];

  sampleNotifications.forEach(n => notificationsStore.set(n.id, n));

  const samplePreferences: CaregiverNotificationPreferences = {
    id: "prefs-1",
    caregiverId: SYSTEM_CAREGIVER_ID,
    profileId: "profile-self-001",
    enabledTypes: [
      "appointment_reminder",
      "appointment_scheduled",
      "appointment_changed",
      "medication_added",
      "medication_changed",
      "side_effect_reported",
      "side_effect_severe",
      "cancer_track_update",
      "emergency_alert",
    ],
    emailNotifications: true,
    pushNotifications: true,
    smsNotifications: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    urgentOverrideQuietHours: true,
    createdAt: now,
    updatedAt: now,
  };

  notificationPreferencesStore.set(samplePreferences.id, samplePreferences);

  const sampleActivity: CaregiverActivityEntry[] = [
    {
      id: "activity-1",
      caregiverId: SYSTEM_CAREGIVER_ID,
      caregiverName: "Michael Johnson",
      profileId: "profile-self-001",
      section: "side_effects_journal",
      action: "add",
      entityType: "symptom_entry",
      entityId: "sym-caregiver-1",
      description: "Added symptom entry: fatigue (mild) while taking Tamoxifen",
      timestamp: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "activity-2",
      caregiverId: SYSTEM_CAREGIVER_ID,
      caregiverName: "Michael Johnson",
      profileId: "profile-self-001",
      section: "cancer_track",
      action: "view",
      entityType: "timeline",
      entityId: "cancer-1",
      description: "Viewed cancer treatment timeline",
      timestamp: new Date(Date.now() - 172800000).toISOString(),
    },
  ];

  sampleActivity.forEach(a => activityLogStore.set(a.id, a));
}

initializeSampleData();

router.get("/api/caregiver/consents", (req: Request, res: Response) => {
  const { profileId, caregiverId, section } = req.query;

  let consents = Array.from(sectionConsentsStore.values()).filter(c => c.isActive);

  if (profileId) {
    consents = consents.filter(c => c.profileId === profileId);
  }

  if (caregiverId) {
    consents = consents.filter(c => c.caregiverId === caregiverId);
  }

  if (section) {
    consents = consents.filter(c => c.section === section);
  }

  res.json(consents);
});

router.get("/api/caregiver/consents/:id", (req: Request, res: Response) => {
  const consent = sectionConsentsStore.get(req.params.id);
  if (!consent) {
    return res.status(404).json({ error: "Consent not found" });
  }
  res.json(consent);
});

router.post("/api/caregiver/consents", (req: Request, res: Response) => {
  const parseResult = insertCaregiverSectionConsentSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.errors });
  }

  const now = new Date().toISOString();
  const consent: CaregiverSectionConsent = {
    id: `consent-${randomUUID()}`,
    ...parseResult.data,
    grantedAt: now,
    expiresAt: parseResult.data.expiresAt || null,
    isActive: true,
    notes: parseResult.data.notes || null,
    createdAt: now,
    updatedAt: now,
  };

  sectionConsentsStore.set(consent.id, consent);

  createNotification({
    caregiverId: consent.caregiverId,
    profileId: consent.profileId,
    profileName: "Patient",
    type: "profile_access_change",
    priority: "normal",
    title: "Access Permission Granted",
    message: `You have been granted ${consent.permissionLevel} access to ${consent.section === "cancer_track" ? "Cancer Track" : "Side Effects Journal"}.`,
    actionUrl: `/${consent.section === "cancer_track" ? "cancer-track" : "side-effects"}`,
  });

  res.status(201).json(consent);
});

router.patch("/api/caregiver/consents/:id", (req: Request, res: Response) => {
  const consent = sectionConsentsStore.get(req.params.id);
  if (!consent) {
    return res.status(404).json({ error: "Consent not found" });
  }

  const { permissionLevel, isActive, notes, expiresAt } = req.body;

  const updated: CaregiverSectionConsent = {
    ...consent,
    permissionLevel: permissionLevel ?? consent.permissionLevel,
    isActive: isActive ?? consent.isActive,
    notes: notes ?? consent.notes,
    expiresAt: expiresAt ?? consent.expiresAt,
    updatedAt: new Date().toISOString(),
  };

  sectionConsentsStore.set(updated.id, updated);

  if (permissionLevel && permissionLevel !== consent.permissionLevel) {
    createNotification({
      caregiverId: updated.caregiverId,
      profileId: updated.profileId,
      profileName: "Patient",
      type: "profile_access_change",
      priority: "normal",
      title: "Access Permission Updated",
      message: `Your access to ${updated.section === "cancer_track" ? "Cancer Track" : "Side Effects Journal"} has been changed to ${permissionLevel}.`,
      actionUrl: `/${updated.section === "cancer_track" ? "cancer-track" : "side-effects"}`,
    });
  }

  res.json(updated);
});

router.delete("/api/caregiver/consents/:id", (req: Request, res: Response) => {
  const consent = sectionConsentsStore.get(req.params.id);
  if (!consent) {
    return res.status(404).json({ error: "Consent not found" });
  }

  consent.isActive = false;
  consent.updatedAt = new Date().toISOString();
  sectionConsentsStore.set(consent.id, consent);

  createNotification({
    caregiverId: consent.caregiverId,
    profileId: consent.profileId,
    profileName: "Patient",
    type: "profile_access_change",
    priority: "normal",
    title: "Access Permission Revoked",
    message: `Your access to ${consent.section === "cancer_track" ? "Cancer Track" : "Side Effects Journal"} has been revoked.`,
    actionUrl: null,
  });

  res.json({ success: true });
});

router.get("/api/caregiver/check-permission", (req: Request, res: Response) => {
  const { profileId, caregiverId, section, action } = req.query;

  if (!profileId || !caregiverId || !section) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const consent = Array.from(sectionConsentsStore.values()).find(
    c => c.profileId === profileId &&
         c.caregiverId === caregiverId &&
         c.section === section &&
         c.isActive &&
         (!c.expiresAt || new Date(c.expiresAt) > new Date())
  );

  if (!consent) {
    return res.json({ allowed: false, permissionLevel: "none" });
  }

  const actionMap: Record<string, CaregiverPermissionLevel[]> = {
    view: ["view_only", "add_entries", "full"],
    add: ["add_entries", "full"],
    edit: ["full"],
    delete: ["full"],
  };

  const allowedLevels = actionMap[action as string] || [];
  const allowed = allowedLevels.includes(consent.permissionLevel);

  res.json({
    allowed,
    permissionLevel: consent.permissionLevel,
    consent,
  });
});

router.get("/api/caregiver/notifications", (req: Request, res: Response) => {
  const { caregiverId, profileId, unreadOnly, limit } = req.query;

  let notifications = Array.from(notificationsStore.values())
    .filter(n => !n.isDismissed)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (caregiverId) {
    notifications = notifications.filter(n => n.caregiverId === caregiverId);
  }

  if (profileId) {
    notifications = notifications.filter(n => n.profileId === profileId);
  }

  if (unreadOnly === "true") {
    notifications = notifications.filter(n => !n.isRead);
  }

  if (limit) {
    notifications = notifications.slice(0, parseInt(limit as string));
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  res.json({
    notifications,
    unreadCount,
    total: notifications.length,
  });
});

router.patch("/api/caregiver/notifications/:id/read", (req: Request, res: Response) => {
  const notification = notificationsStore.get(req.params.id);
  if (!notification) {
    return res.status(404).json({ error: "Notification not found" });
  }

  notification.isRead = true;
  notification.readAt = new Date().toISOString();
  notificationsStore.set(notification.id, notification);

  res.json(notification);
});

router.patch("/api/caregiver/notifications/:id/dismiss", (req: Request, res: Response) => {
  const notification = notificationsStore.get(req.params.id);
  if (!notification) {
    return res.status(404).json({ error: "Notification not found" });
  }

  notification.isDismissed = true;
  notification.dismissedAt = new Date().toISOString();
  notificationsStore.set(notification.id, notification);

  res.json(notification);
});

router.post("/api/caregiver/notifications/mark-all-read", (req: Request, res: Response) => {
  const { caregiverId, profileId } = req.body;

  let updated = 0;
  notificationsStore.forEach((notification, id) => {
    if (
      (!caregiverId || notification.caregiverId === caregiverId) &&
      (!profileId || notification.profileId === profileId) &&
      !notification.isRead
    ) {
      notification.isRead = true;
      notification.readAt = new Date().toISOString();
      notificationsStore.set(id, notification);
      updated++;
    }
  });

  res.json({ success: true, updated });
});

router.get("/api/caregiver/notification-preferences", (req: Request, res: Response) => {
  const { caregiverId, profileId } = req.query;

  let preferences = Array.from(notificationPreferencesStore.values());

  if (caregiverId) {
    preferences = preferences.filter(p => p.caregiverId === caregiverId);
  }

  if (profileId) {
    preferences = preferences.filter(p => p.profileId === profileId);
  }

  res.json(preferences.length === 1 ? preferences[0] : preferences);
});

router.post("/api/caregiver/notification-preferences", (req: Request, res: Response) => {
  const parseResult = insertCaregiverNotificationPreferencesSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: parseResult.error.errors });
  }

  const now = new Date().toISOString();
  const prefs: CaregiverNotificationPreferences = {
    id: `prefs-${randomUUID()}`,
    ...parseResult.data,
    enabledTypes: parseResult.data.enabledTypes as CaregiverNotificationType[],
    quietHoursStart: parseResult.data.quietHoursStart || null,
    quietHoursEnd: parseResult.data.quietHoursEnd || null,
    createdAt: now,
    updatedAt: now,
  };

  notificationPreferencesStore.set(prefs.id, prefs);
  res.status(201).json(prefs);
});

router.patch("/api/caregiver/notification-preferences/:id", (req: Request, res: Response) => {
  const prefs = notificationPreferencesStore.get(req.params.id);
  if (!prefs) {
    return res.status(404).json({ error: "Preferences not found" });
  }

  const updated: CaregiverNotificationPreferences = {
    ...prefs,
    ...req.body,
    updatedAt: new Date().toISOString(),
  };

  notificationPreferencesStore.set(updated.id, updated);
  res.json(updated);
});

router.get("/api/caregiver/activity-log", (req: Request, res: Response) => {
  const { caregiverId, profileId, section, limit } = req.query;

  let activities = Array.from(activityLogStore.values())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (caregiverId) {
    activities = activities.filter(a => a.caregiverId === caregiverId);
  }

  if (profileId) {
    activities = activities.filter(a => a.profileId === profileId);
  }

  if (section) {
    activities = activities.filter(a => a.section === section);
  }

  if (limit) {
    activities = activities.slice(0, parseInt(limit as string));
  }

  res.json(activities);
});

router.post("/api/caregiver/activity-log", (req: Request, res: Response) => {
  const { caregiverId, caregiverName, profileId, section, action, entityType, entityId, description } = req.body;

  const activity: CaregiverActivityEntry = {
    id: `activity-${randomUUID()}`,
    caregiverId,
    caregiverName,
    profileId,
    section,
    action,
    entityType,
    entityId,
    description,
    timestamp: new Date().toISOString(),
  };

  activityLogStore.set(activity.id, activity);
  res.status(201).json(activity);
});

function createNotification(data: {
  caregiverId: string;
  profileId: string;
  profileName: string;
  type: CaregiverNotificationType;
  priority?: "low" | "normal" | "high" | "urgent";
  title: string;
  message: string;
  actionUrl?: string | null;
  relatedEntityId?: string | null;
  relatedEntityType?: string | null;
}): CaregiverNotification {
  const notification: CaregiverNotification = {
    id: `notif-${randomUUID()}`,
    caregiverId: data.caregiverId,
    profileId: data.profileId,
    profileName: data.profileName,
    type: data.type,
    priority: data.priority || "normal",
    title: data.title,
    message: data.message,
    actionUrl: data.actionUrl || null,
    relatedEntityId: data.relatedEntityId || null,
    relatedEntityType: data.relatedEntityType || null,
    isRead: false,
    readAt: null,
    isDismissed: false,
    dismissedAt: null,
    expiresAt: null,
    createdAt: new Date().toISOString(),
  };

  notificationsStore.set(notification.id, notification);
  return notification;
}

function verifyCaregiverConsent(
  caregiverId: string,
  profileId: string,
  section: "cancer_track" | "side_effects_journal",
  requiredLevel: CaregiverPermissionLevel
): { hasPermission: boolean; consent: CaregiverSectionConsent | null; message: string } {
  initializeSampleData();
  
  const consents = Array.from(sectionConsentsStore.values()).filter(
    (c) => c.caregiverId === caregiverId && 
           c.profileId === profileId && 
           c.section === section && 
           c.isActive
  );

  if (consents.length === 0) {
    return { 
      hasPermission: false, 
      consent: null, 
      message: `No active consent found for caregiver in ${section.replace("_", " ")} for this profile` 
    };
  }

  const consent = consents.sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0];
  
  if (consent.expiresAt && new Date(consent.expiresAt) < new Date()) {
    return { 
      hasPermission: false, 
      consent, 
      message: "Caregiver consent has expired" 
    };
  }

  const permissionHierarchy: CaregiverPermissionLevel[] = ["none", "view_only", "add_entries", "full"];
  const requiredIndex = permissionHierarchy.indexOf(requiredLevel);
  const currentIndex = permissionHierarchy.indexOf(consent.permissionLevel);

  if (currentIndex >= requiredIndex) {
    return { 
      hasPermission: true, 
      consent, 
      message: "Caregiver has required permission" 
    };
  }

  return { 
    hasPermission: false, 
    consent, 
    message: `Caregiver has ${consent.permissionLevel} permission but requires ${requiredLevel}` 
  };
}

export { router as caregiverPermissionsRoutes, createNotification, verifyCaregiverConsent };
