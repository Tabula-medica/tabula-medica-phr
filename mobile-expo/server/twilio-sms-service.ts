import twilio from "twilio";
import crypto from "crypto";
import { db } from "./db";
import { eq, and, desc, gte } from "drizzle-orm";
import { medicationSchedules, patientProfiles, users } from "@shared/schema";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER || "";

const verificationCodes: Map<
  string,
  { code: string; expiresAt: Date; phone: string; attempts: number }
> = new Map();

const CODE_EXPIRY_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const RATE_LIMIT_MS = 60 * 1000;
const lastCodeSent: Map<string, number> = new Map();

export const twilioSmsService = {
  async sendSms(
    to: string,
    body: string
  ): Promise<{ success: boolean; sid?: string; error?: string }> {
    try {
      if (!TWILIO_PHONE) {
        return { success: false, error: "Twilio phone number not configured" };
      }
      const message = await client.messages.create({
        body,
        from: TWILIO_PHONE,
        to,
      });
      return { success: true, sid: message.sid };
    } catch (err: any) {
      console.error("Twilio SMS send error:", err.message);
      return { success: false, error: err.message };
    }
  },

  async sendVerificationCode(
    userId: string,
    phone: string
  ): Promise<{ success: boolean; error?: string }> {
    const lastSent = lastCodeSent.get(userId);
    if (lastSent && Date.now() - lastSent < RATE_LIMIT_MS) {
      const waitSec = Math.ceil(
        (RATE_LIMIT_MS - (Date.now() - lastSent)) / 1000
      );
      return {
        success: false,
        error: `Please wait ${waitSec} seconds before requesting another code`,
      };
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

    const result = await this.sendSms(
      phone,
      `Your Tabula Medica verification code is: ${code}. It expires in 10 minutes. Do not share this code with anyone.`
    );

    if (!result.success) {
      return result;
    }

    verificationCodes.set(userId, { code, expiresAt, phone, attempts: 0 });
    lastCodeSent.set(userId, Date.now());

    return { success: true };
  },

  verifyCode(
    userId: string,
    code: string
  ): { valid: boolean; error?: string } {
    const stored = verificationCodes.get(userId);
    if (!stored) {
      return { valid: false, error: "No verification code found. Please request a new one." };
    }

    if (new Date() > stored.expiresAt) {
      verificationCodes.delete(userId);
      return { valid: false, error: "Verification code has expired. Please request a new one." };
    }

    if (stored.attempts >= MAX_VERIFY_ATTEMPTS) {
      verificationCodes.delete(userId);
      return {
        valid: false,
        error: "Too many failed attempts. Please request a new code.",
      };
    }

    stored.attempts++;

    if (stored.code !== code) {
      return { valid: false, error: "Invalid verification code" };
    }

    verificationCodes.delete(userId);
    return { valid: true };
  },

  async sendMedicationReminder(
    userId: string,
    medicationName: string,
    dosage: string | null,
    scheduledTime: string
  ): Promise<{ success: boolean; error?: string }> {
    const phone = await this.getUserPhone(userId);
    if (!phone) {
      return { success: false, error: "No phone number on file" };
    }

    let message = `Tabula Medica Reminder: Time to take ${medicationName}`;
    if (dosage) {
      message += ` (${dosage})`;
    }
    message += ` scheduled for ${scheduledTime}. Stay on track with your health!`;
    message +=
      "\n\nThis is an automated reminder. Not medical advice. Reply STOP to unsubscribe.";

    return this.sendSms(phone, message);
  },

  async sendRefillReminder(
    userId: string,
    medicationName: string,
    daysRemaining: number,
    pillsRemaining: number | null
  ): Promise<{ success: boolean; error?: string }> {
    const phone = await this.getUserPhone(userId);
    if (!phone) {
      return { success: false, error: "No phone number on file" };
    }

    let message = `Tabula Medica Refill Alert: ${medicationName} needs a refill`;
    if (daysRemaining <= 0) {
      message += ` (overdue)`;
    } else {
      message += ` in ${daysRemaining} day(s)`;
    }
    if (pillsRemaining !== null && pillsRemaining !== undefined) {
      message += `. ${pillsRemaining} pills remaining`;
    }
    message += `. Contact your pharmacy to refill.`;
    message +=
      "\n\nThis is an automated reminder. Not medical advice. Reply STOP to unsubscribe.";

    return this.sendSms(phone, message);
  },

  async getUserPhone(userId: string): Promise<string | null> {
    try {
      const [profile] = await db
        .select({ mobilePhone: patientProfiles.mobilePhone, phone: patientProfiles.phone })
        .from(patientProfiles)
        .where(eq(patientProfiles.userId, userId))
        .limit(1);

      if (profile) {
        return profile.mobilePhone || profile.phone || null;
      }
      return null;
    } catch {
      return null;
    }
  },

  async getDueMedicationReminders(): Promise<
    Array<{
      userId: string;
      medicationName: string;
      dosage: string | null;
      scheduledTime: string;
    }>
  > {
    try {
      const now = new Date();
      const currentHour = now.getHours().toString().padStart(2, "0");
      const currentMinute = now.getMinutes().toString().padStart(2, "0");
      const currentTime = `${currentHour}:${currentMinute}`;

      const activeMeds = await db
        .select()
        .from(medicationSchedules)
        .where(
          and(
            eq(medicationSchedules.isActive, true),
            eq(medicationSchedules.remindersEnabled, true)
          )
        );

      const due: Array<{
        userId: string;
        medicationName: string;
        dosage: string | null;
        scheduledTime: string;
      }> = [];

      for (const med of activeMeds) {
        const times = (med.scheduledTimes as string[]) || [];
        for (const time of times) {
          const [h, m] = time.split(":");
          const schedMinutes = parseInt(h) * 60 + parseInt(m);
          const reminderMinutes = med.reminderMinutesBefore || 15;
          const nowMinutes =
            parseInt(currentHour) * 60 + parseInt(currentMinute);
          const diff = schedMinutes - reminderMinutes - nowMinutes;
          if (diff >= -2 && diff <= 2) {
            due.push({
              userId: med.userId,
              medicationName: med.medicationName,
              dosage: med.dosage,
              scheduledTime: time,
            });
          }
        }
      }
      return due;
    } catch (err) {
      console.error("Error checking due medication reminders:", err);
      return [];
    }
  },

  async processScheduledReminders(): Promise<{
    sent: number;
    failed: number;
    errors: string[];
  }> {
    const due = await this.getDueMedicationReminders();
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const reminder of due) {
      const result = await this.sendMedicationReminder(
        reminder.userId,
        reminder.medicationName,
        reminder.dosage,
        reminder.scheduledTime
      );
      if (result.success) {
        sent++;
      } else {
        failed++;
        errors.push(
          `${reminder.medicationName} for user ${reminder.userId}: ${result.error}`
        );
      }
    }

    return { sent, failed, errors };
  },
};

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startMedicationReminderScheduler(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
  }
  reminderInterval = setInterval(async () => {
    try {
      const result = await twilioSmsService.processScheduledReminders();
      if (result.sent > 0 || result.failed > 0) {
        console.log(
          `[SMS Reminders] Sent: ${result.sent}, Failed: ${result.failed}`
        );
      }
    } catch (err) {
      console.error("[SMS Reminders] Scheduler error:", err);
    }
  }, 60 * 1000);
  console.log("[SMS Reminders] Medication reminder scheduler started (checks every 60s)");
}

export function stopMedicationReminderScheduler(): void {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}
