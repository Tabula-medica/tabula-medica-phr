import { Router, Request, Response } from "express";

export interface Appointment {
  id: string;
  profileId: string;
  patientName: string;
  patientEmail: string;
  patientPhone?: string;
  providerName: string;
  facilityName: string;
  appointmentType: string;
  scheduledAt: Date;
  duration: number;
  notes?: string;
  status: "scheduled" | "confirmed" | "cancelled" | "completed";
  createdAt: Date;
}

export interface ReminderConfig {
  id: string;
  name: string;
  intervalMinutes: number;
  enabled: boolean;
  channels: ("email" | "sms" | "push")[];
  templateId: string;
}

export interface ReminderTemplate {
  id: string;
  name: string;
  subject: string;
  emailBody: string;
  smsBody: string;
  pushTitle: string;
  pushBody: string;
}

export interface SentReminder {
  id: string;
  appointmentId: string;
  reminderId: string;
  channel: "email" | "sms" | "push";
  sentAt: Date;
  status: "sent" | "delivered" | "failed";
  errorMessage?: string;
}


const appointments: Map<string, Appointment> = new Map();
const reminderConfigs: Map<string, ReminderConfig> = new Map();
const reminderTemplates: Map<string, ReminderTemplate> = new Map();
const sentReminders: Map<string, SentReminder> = new Map();
const reminderQueue: Map<string, { appointmentId: string; configId: string; scheduledFor: Date }> = new Map();

function initializeSampleData() {
  const now = new Date();
  
  const templates: ReminderTemplate[] = [
    {
      id: "tmpl-1",
      name: "Standard Reminder",
      subject: "Appointment Reminder: {{appointmentType}} on {{date}}",
      emailBody: `Dear {{patientName}},

This is a reminder about your upcoming appointment:

Date: {{date}}
Time: {{time}}
Provider: {{providerName}}
Location: {{facilityName}}
Type: {{appointmentType}}

Please arrive 15 minutes early. If you need to reschedule, please call us at least 24 hours in advance.

Thank you,
Tabula Medica`,
      smsBody: "Reminder: {{appointmentType}} with {{providerName}} on {{date}} at {{time}}. Reply C to confirm or R to reschedule.",
      pushTitle: "Appointment Reminder",
      pushBody: "{{appointmentType}} tomorrow at {{time}} with {{providerName}}",
    },
    {
      id: "tmpl-2",
      name: "Day Before Reminder",
      subject: "Tomorrow: Your {{appointmentType}} Appointment",
      emailBody: `Hi {{patientName}},

Just a friendly reminder that you have an appointment tomorrow:

Date: {{date}}
Time: {{time}}
Provider: {{providerName}}
Location: {{facilityName}}

What to bring:
- Photo ID
- Insurance card
- List of current medications

See you tomorrow!`,
      smsBody: "Tomorrow: {{appointmentType}} at {{time}} with {{providerName}}. Don't forget your ID and insurance card!",
      pushTitle: "Appointment Tomorrow",
      pushBody: "Don't forget your {{appointmentType}} at {{time}}",
    },
    {
      id: "tmpl-3",
      name: "Same Day Reminder",
      subject: "Today: Your Appointment at {{time}}",
      emailBody: `Hi {{patientName}},

Your appointment is today!

Time: {{time}}
Provider: {{providerName}}
Location: {{facilityName}}

We look forward to seeing you.`,
      smsBody: "Today: Your appointment at {{time}} with {{providerName}}. See you soon!",
      pushTitle: "Appointment Today",
      pushBody: "Your appointment is at {{time}} today",
    },
  ];

  templates.forEach(t => reminderTemplates.set(t.id, t));

  const configs: ReminderConfig[] = [
    {
      id: "config-1",
      name: "1 Week Before",
      intervalMinutes: 7 * 24 * 60,
      enabled: true,
      channels: ["email"],
      templateId: "tmpl-1",
    },
    {
      id: "config-2",
      name: "3 Days Before",
      intervalMinutes: 3 * 24 * 60,
      enabled: true,
      channels: ["email", "sms"],
      templateId: "tmpl-1",
    },
    {
      id: "config-3",
      name: "1 Day Before",
      intervalMinutes: 24 * 60,
      enabled: true,
      channels: ["email", "sms", "push"],
      templateId: "tmpl-2",
    },
    {
      id: "config-4",
      name: "2 Hours Before",
      intervalMinutes: 120,
      enabled: true,
      channels: ["sms", "push"],
      templateId: "tmpl-3",
    },
  ];

  configs.forEach(c => reminderConfigs.set(c.id, c));

  const sampleAppointments: Appointment[] = [
    {
      id: "apt-1",
      profileId: "profile-1",
      patientName: "John Smith",
      patientEmail: "john.smith@example.com",
      patientPhone: "+1234567890",
      providerName: "Dr. Sarah Johnson",
      facilityName: "City Medical Center",
      appointmentType: "Oncology Follow-up",
      scheduledAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      duration: 30,
      status: "scheduled",
      createdAt: new Date(),
    },
    {
      id: "apt-2",
      profileId: "profile-1",
      patientName: "John Smith",
      patientEmail: "john.smith@example.com",
      patientPhone: "+1234567890",
      providerName: "Dr. Michael Chen",
      facilityName: "Cancer Care Institute",
      appointmentType: "Lab Work",
      scheduledAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      duration: 15,
      status: "scheduled",
      createdAt: new Date(),
    },
    {
      id: "apt-3",
      profileId: "profile-2",
      patientName: "Jane Doe",
      patientEmail: "jane.doe@example.com",
      providerName: "Dr. Emily White",
      facilityName: "Community Health Clinic",
      appointmentType: "Annual Physical",
      scheduledAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      duration: 45,
      status: "confirmed",
      createdAt: new Date(),
    },
  ];

  sampleAppointments.forEach(a => appointments.set(a.id, a));
}

function formatTemplate(template: string, appointment: Appointment): string {
  const date = appointment.scheduledAt.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const time = appointment.scheduledAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return template
    .replace(/\{\{patientName\}\}/g, appointment.patientName)
    .replace(/\{\{providerName\}\}/g, appointment.providerName)
    .replace(/\{\{facilityName\}\}/g, appointment.facilityName)
    .replace(/\{\{appointmentType\}\}/g, appointment.appointmentType)
    .replace(/\{\{date\}\}/g, date)
    .replace(/\{\{time\}\}/g, time)
    .replace(/\{\{duration\}\}/g, `${appointment.duration} minutes`);
}

async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  console.log(`[AppointmentReminders] Email to ${to}, Subject: ${subject}`);
  return true;
}

async function sendSms(to: string, body: string): Promise<boolean> {
  console.log(`[AppointmentReminders] SMS to ${to}`);
  return true;
}

async function sendPushNotification(userId: string, title: string, body: string): Promise<boolean> {
  console.log(`[AppointmentReminders] Push to ${userId}, Title: ${title}`);
  return true;
}

async function sendReminder(
  appointment: Appointment,
  config: ReminderConfig,
  channel: "email" | "sms" | "push"
): Promise<SentReminder> {
  const template = reminderTemplates.get(config.templateId);
  if (!template) {
    throw new Error(`Template ${config.templateId} not found`);
  }

  const reminderId = `rem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  let success = false;
  let errorMessage: string | undefined;

  try {
    switch (channel) {
      case "email":
        const subject = formatTemplate(template.subject, appointment);
        const emailBody = formatTemplate(template.emailBody, appointment);
        success = await sendEmail(appointment.patientEmail, subject, emailBody);
        break;
      case "sms":
        if (appointment.patientPhone) {
          const smsBody = formatTemplate(template.smsBody, appointment);
          success = await sendSms(appointment.patientPhone, smsBody);
        } else {
          errorMessage = "No phone number on file";
        }
        break;
      case "push":
        const pushTitle = formatTemplate(template.pushTitle, appointment);
        const pushBody = formatTemplate(template.pushBody, appointment);
        success = await sendPushNotification(appointment.profileId, pushTitle, pushBody);
        break;
    }
  } catch (error: any) {
    errorMessage = error.message;
  }

  const sentReminder: SentReminder = {
    id: reminderId,
    appointmentId: appointment.id,
    reminderId: config.id,
    channel,
    sentAt: new Date(),
    status: success ? "sent" : "failed",
    errorMessage,
  };

  sentReminders.set(reminderId, sentReminder);
  return sentReminder;
}

function scheduleRemindersForAppointment(appointment: Appointment) {
  if (appointment.status === "cancelled" || appointment.status === "completed") {
    return;
  }

  const now = new Date();
  const configs = Array.from(reminderConfigs.values()).filter(c => c.enabled);

  for (const config of configs) {
    const reminderTime = new Date(appointment.scheduledAt.getTime() - config.intervalMinutes * 60 * 1000);
    
    if (reminderTime > now) {
      const queueId = `${appointment.id}-${config.id}`;
      reminderQueue.set(queueId, {
        appointmentId: appointment.id,
        configId: config.id,
        scheduledFor: reminderTime,
      });
    }
  }
}

async function processReminderQueue() {
  const now = new Date();
  const entries = Array.from(reminderQueue.entries());
  
  for (const [queueId, item] of entries) {
    if (item.scheduledFor <= now) {
      const appointment = appointments.get(item.appointmentId);
      const config = reminderConfigs.get(item.configId);

      if (appointment && config && appointment.status !== "cancelled") {
        for (const channel of config.channels) {
          await sendReminder(appointment, config, channel);
        }
      }

      reminderQueue.delete(queueId);
    }
  }
}

let schedulerInterval: NodeJS.Timeout | null = null;

function startScheduler() {
  if (schedulerInterval) return;
  
  schedulerInterval = setInterval(processReminderQueue, 60000);
  console.log("[AppointmentReminders] Scheduler started (1 minute interval)");
}

function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[AppointmentReminders] Scheduler stopped");
  }
}

initializeSampleData();
startScheduler();

const router = Router();

router.get("/api/appointments", (req: Request, res: Response) => {
  const { profileId, status } = req.query;
  let result = Array.from(appointments.values());

  if (profileId) {
    result = result.filter(a => a.profileId === profileId);
  }
  if (status) {
    result = result.filter(a => a.status === status);
  }

  result.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  res.json({ appointments: result });
});

router.get("/api/appointments/:id", (req: Request, res: Response) => {
  const appointment = appointments.get(req.params.id);
  if (!appointment) {
    return res.status(404).json({ error: "Appointment not found" });
  }
  res.json(appointment);
});

router.post("/api/appointments", (req: Request, res: Response) => {
  const {
    profileId,
    patientName,
    patientEmail,
    patientPhone,
    providerName,
    facilityName,
    appointmentType,
    scheduledAt,
    duration,
    notes,
  } = req.body;

  const id = `apt-${Date.now()}`;
  const appointment: Appointment = {
    id,
    profileId,
    patientName,
    patientEmail,
    patientPhone,
    providerName,
    facilityName,
    appointmentType,
    scheduledAt: new Date(scheduledAt),
    duration: duration || 30,
    notes,
    status: "scheduled",
    createdAt: new Date(),
  };

  appointments.set(id, appointment);
  scheduleRemindersForAppointment(appointment);

  res.status(201).json(appointment);
});

router.patch("/api/appointments/:id", (req: Request, res: Response) => {
  const appointment = appointments.get(req.params.id);
  if (!appointment) {
    return res.status(404).json({ error: "Appointment not found" });
  }

  const updates = req.body;
  const updated = { ...appointment, ...updates };
  if (updates.scheduledAt) {
    updated.scheduledAt = new Date(updates.scheduledAt);
  }

  appointments.set(req.params.id, updated);

  const keysToDelete = Array.from(reminderQueue.keys()).filter(k => k.startsWith(req.params.id));
  keysToDelete.forEach(k => reminderQueue.delete(k));
  scheduleRemindersForAppointment(updated);

  res.json(updated);
});

router.delete("/api/appointments/:id", (req: Request, res: Response) => {
  const appointment = appointments.get(req.params.id);
  if (!appointment) {
    return res.status(404).json({ error: "Appointment not found" });
  }

  appointment.status = "cancelled";
  appointments.set(req.params.id, appointment);

  const cancelKeys = Array.from(reminderQueue.keys()).filter(k => k.startsWith(req.params.id));
  cancelKeys.forEach(k => reminderQueue.delete(k));

  res.json({ success: true });
});

router.get("/api/reminder-configs", (_req: Request, res: Response) => {
  res.json({ configs: Array.from(reminderConfigs.values()) });
});

router.get("/api/reminder-configs/:id", (req: Request, res: Response) => {
  const config = reminderConfigs.get(req.params.id);
  if (!config) {
    return res.status(404).json({ error: "Config not found" });
  }
  res.json(config);
});

router.post("/api/reminder-configs", (req: Request, res: Response) => {
  const { name, intervalMinutes, enabled, channels, templateId } = req.body;

  const id = `config-${Date.now()}`;
  const config: ReminderConfig = {
    id,
    name,
    intervalMinutes,
    enabled: enabled !== false,
    channels: channels || ["email"],
    templateId,
  };

  reminderConfigs.set(id, config);
  res.status(201).json(config);
});

router.patch("/api/reminder-configs/:id", (req: Request, res: Response) => {
  const config = reminderConfigs.get(req.params.id);
  if (!config) {
    return res.status(404).json({ error: "Config not found" });
  }

  const updated = { ...config, ...req.body };
  reminderConfigs.set(req.params.id, updated);
  res.json(updated);
});

router.delete("/api/reminder-configs/:id", (req: Request, res: Response) => {
  if (!reminderConfigs.has(req.params.id)) {
    return res.status(404).json({ error: "Config not found" });
  }
  reminderConfigs.delete(req.params.id);
  res.json({ success: true });
});

router.get("/api/reminder-templates", (_req: Request, res: Response) => {
  res.json({ templates: Array.from(reminderTemplates.values()) });
});

router.post("/api/reminder-templates", (req: Request, res: Response) => {
  const { name, subject, emailBody, smsBody, pushTitle, pushBody } = req.body;

  const id = `tmpl-${Date.now()}`;
  const template: ReminderTemplate = {
    id,
    name,
    subject,
    emailBody,
    smsBody,
    pushTitle,
    pushBody,
  };

  reminderTemplates.set(id, template);
  res.status(201).json(template);
});

router.patch("/api/reminder-templates/:id", (req: Request, res: Response) => {
  const template = reminderTemplates.get(req.params.id);
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }

  const updated = { ...template, ...req.body };
  reminderTemplates.set(req.params.id, updated);
  res.json(updated);
});

router.get("/api/reminders/sent", (req: Request, res: Response) => {
  const { appointmentId } = req.query;
  let result = Array.from(sentReminders.values());

  if (appointmentId) {
    result = result.filter(r => r.appointmentId === appointmentId);
  }

  result.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  res.json({ reminders: result });
});

router.get("/api/reminders/queue", (_req: Request, res: Response) => {
  const queue = Array.from(reminderQueue.entries()).map(([id, item]) => ({
    id,
    ...item,
    appointment: appointments.get(item.appointmentId),
    config: reminderConfigs.get(item.configId),
  }));

  queue.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
  res.json({ queue });
});

router.post("/api/reminders/send-now", async (req: Request, res: Response) => {
  const { appointmentId, configId, channels } = req.body;

  const appointment = appointments.get(appointmentId);
  if (!appointment) {
    return res.status(404).json({ error: "Appointment not found" });
  }

  const config = reminderConfigs.get(configId);
  if (!config) {
    return res.status(404).json({ error: "Config not found" });
  }

  const results: SentReminder[] = [];
  const channelsToSend = channels || config.channels;

  for (const channel of channelsToSend) {
    const result = await sendReminder(appointment, config, channel);
    results.push(result);
  }

  res.json({ results });
});

router.get("/api/reminders/stats", (_req: Request, res: Response) => {
  const all = Array.from(sentReminders.values());
  const last24h = all.filter(r => r.sentAt.getTime() > Date.now() - 24 * 60 * 60 * 1000);
  const last7d = all.filter(r => r.sentAt.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000);

  res.json({
    total: all.length,
    last24Hours: last24h.length,
    last7Days: last7d.length,
    byChannel: {
      email: all.filter(r => r.channel === "email").length,
      sms: all.filter(r => r.channel === "sms").length,
      push: all.filter(r => r.channel === "push").length,
    },
    byStatus: {
      sent: all.filter(r => r.status === "sent").length,
      delivered: all.filter(r => r.status === "delivered").length,
      failed: all.filter(r => r.status === "failed").length,
    },
    queuedReminders: reminderQueue.size,
    upcomingAppointments: Array.from(appointments.values()).filter(
      a => a.status === "scheduled" && a.scheduledAt > new Date()
    ).length,
  });
});

console.log("[AppointmentReminders] Service initialized");

export { router as appointmentRemindersRouter };
