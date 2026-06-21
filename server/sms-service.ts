import twilio from "twilio";
import { randomUUID } from "crypto";
import type { SmsMessage, SmsStatus, SmsCategory } from "@shared/schema";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

function getTwilioClient() {
  if (!accountSid || !authToken) {
    return null;
  }
  return twilio(accountSid, authToken);
}

const smsHistory = new Map<string, SmsMessage>();

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (!phone.startsWith("+")) return `+${digits}`;
  return phone;
}

export async function sendSms(params: {
  to: string;
  body: string;
  category: SmsCategory;
  patientId?: string;
  sentBy: string;
}): Promise<SmsMessage> {
  const id = randomUUID();
  const to = normalizePhone(params.to);
  const now = new Date().toISOString();

  const record: SmsMessage = {
    id,
    to,
    from: fromNumber || "",
    body: params.body,
    category: params.category,
    status: "queued",
    twilioSid: null,
    errorMessage: null,
    patientId: params.patientId || null,
    sentBy: params.sentBy,
    sentAt: now,
    deliveredAt: null,
  };

  const client = getTwilioClient();
  if (!client || !fromNumber) {
    record.status = "failed";
    record.errorMessage = "Twilio credentials are not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.";
    smsHistory.set(id, record);
    return record;
  }

  try {
    record.status = "sending";
    const message = await client.messages.create({
      to,
      from: fromNumber,
      body: params.body,
    });
    record.twilioSid = message.sid;
    record.status = (message.status as SmsStatus) || "sent";
    record.from = message.from || fromNumber;
  } catch (err: any) {
    record.status = "failed";
    record.errorMessage = err.message || "Failed to send SMS";
  }

  smsHistory.set(id, record);
  return record;
}

export function getSmsHistory(filters?: {
  patientId?: string;
  category?: SmsCategory;
  status?: SmsStatus;
}): SmsMessage[] {
  let results = Array.from(smsHistory.values());

  if (filters?.patientId) {
    results = results.filter((m) => m.patientId === filters.patientId);
  }
  if (filters?.category) {
    results = results.filter((m) => m.category === filters.category);
  }
  if (filters?.status) {
    results = results.filter((m) => m.status === filters.status);
  }

  return results.sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
}

export function getSmsById(id: string): SmsMessage | undefined {
  return smsHistory.get(id);
}

export function getSmsStats() {
  const all = Array.from(smsHistory.values());
  return {
    total: all.length,
    sent: all.filter((m) => m.status === "sent").length,
    delivered: all.filter((m) => m.status === "delivered").length,
    failed: all.filter((m) => m.status === "failed").length,
    queued: all.filter((m) => m.status === "queued").length,
  };
}
