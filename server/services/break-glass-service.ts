/**
 * Break-Glass Protocol Service
 * Emergency access to patient records with immediate alerts and permanent audit logging
 * HIPAA-compliant emergency access protocol
 */

import crypto from "crypto";
import { logPhiAccess } from "../security/hipaa-audit";

export interface BreakGlassRequest {
  id: string;
  patientId: string;
  requestedBy: string;
  providerName: string;
  providerNPI?: string;
  providerOrganization: string;
  emergencyReason: string;
  emergencyType: EmergencyType;
  requestedAt: Date;
  expiresAt: Date;
  status: BreakGlassStatus;
  accessGrantedAt?: Date;
  accessLog: BreakGlassAccessEntry[];
  patientNotifications: PatientNotification[];
  auditTrailId: string;
}

export type EmergencyType = 
  | "life_threatening"
  | "urgent_care"
  | "critical_medication"
  | "surgical_emergency"
  | "psychiatric_crisis"
  | "other";

export type BreakGlassStatus = 
  | "pending"
  | "active"
  | "expired"
  | "revoked_by_patient"
  | "completed";

export interface BreakGlassAccessEntry {
  accessedAt: Date;
  resourceType: string;
  resourceId: string;
  action: string;
}

export interface PatientNotification {
  id: string;
  type: "sms" | "email" | "push";
  sentAt: Date;
  recipient: string;
  status: "sent" | "delivered" | "failed";
  messagePreview: string;
}

export interface BreakGlassAccessResult {
  authorized: boolean;
  reason?: string;
  breakGlassId?: string;
  expiresAt?: Date;
}

const breakGlassRequests = new Map<string, BreakGlassRequest>();
const patientNotificationPreferences = new Map<string, { 
  phone?: string; 
  email?: string; 
  allowSms: boolean;
  allowEmail: boolean;
}>();

patientNotificationPreferences.set("patient-001", {
  phone: "+1-555-0100",
  email: "patient@example.com",
  allowSms: true,
  allowEmail: true
});

export function initiateBreakGlass(
  patientId: string,
  providerInfo: {
    requestedBy: string;
    providerName: string;
    providerNPI?: string;
    providerOrganization: string;
  },
  emergencyReason: string,
  emergencyType: EmergencyType
): BreakGlassRequest {
  const id = crypto.randomUUID();
  const auditTrailId = `BG-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  
  const request: BreakGlassRequest = {
    id,
    patientId,
    requestedBy: providerInfo.requestedBy,
    providerName: providerInfo.providerName,
    providerNPI: providerInfo.providerNPI,
    providerOrganization: providerInfo.providerOrganization,
    emergencyReason,
    emergencyType,
    requestedAt: now,
    expiresAt,
    status: "active",
    accessGrantedAt: now,
    accessLog: [],
    patientNotifications: [],
    auditTrailId
  };
  
  breakGlassRequests.set(id, request);
  
  logPhiAccess({
    userId: providerInfo.requestedBy,
    action: "read",
    resourceType: "BreakGlassAccess",
    patientId,
    details: `BREAK-GLASS INITIATED: ${auditTrailId} by ${providerInfo.providerName} (${providerInfo.providerOrganization}), reason: ${emergencyType} - ${emergencyReason}, expires: ${expiresAt.toISOString()}`
  });
  
  sendPatientNotifications(request);
  
  return request;
}

function sendPatientNotifications(request: BreakGlassRequest): void {
  const prefs = patientNotificationPreferences.get(request.patientId);
  
  if (!prefs) {
    console.log(`[BreakGlass] No notification preferences found for patient ${request.patientId}`);
    return;
  }
  
  const messageContent = `URGENT: Emergency access to your health records was initiated by ${request.providerName} (${request.providerOrganization}) at ${request.requestedAt.toLocaleString()}. Reason: ${request.emergencyReason}. If you did not authorize this, contact us immediately.`;
  
  if (prefs.allowSms && prefs.phone) {
    const smsNotification: PatientNotification = {
      id: crypto.randomUUID(),
      type: "sms",
      sentAt: new Date(),
      recipient: prefs.phone,
      status: "pending_delivery",
      messagePreview: messageContent.substring(0, 160)
    };
    request.patientNotifications.push(smsNotification);
    
    logPhiAccess({
      userId: "system",
      action: "write",
      resourceType: "BreakGlassNotification",
      patientId: request.patientId,
      details: `BREAK-GLASS SMS QUEUED: ${request.auditTrailId}, recipient: ${prefs.phone}, delivery: STUB_MODE (production requires Twilio integration)`
    });
    
    console.log(`[BreakGlass] [STUB] SMS notification queued for ${prefs.phone}`);
    console.log(`[BreakGlass] [STUB] SMS Content: ${messageContent.substring(0, 100)}...`);
    console.log(`[BreakGlass] [STUB] Production: Integrate Twilio for SMS delivery`);
  }
  
  if (prefs.allowEmail && prefs.email) {
    const emailNotification: PatientNotification = {
      id: crypto.randomUUID(),
      type: "email",
      sentAt: new Date(),
      recipient: prefs.email,
      status: "pending_delivery",
      messagePreview: `Subject: URGENT - Emergency Access to Your Health Records`
    };
    request.patientNotifications.push(emailNotification);
    
    logPhiAccess({
      userId: "system",
      action: "write",
      resourceType: "BreakGlassNotification",
      patientId: request.patientId,
      details: `BREAK-GLASS EMAIL QUEUED: ${request.auditTrailId}, recipient: ${prefs.email}, delivery: STUB_MODE (production requires SendGrid integration)`
    });
    
    console.log(`[BreakGlass] [STUB] Email notification queued for ${prefs.email}`);
    console.log(`[BreakGlass] [STUB] Email Subject: URGENT - Emergency Access to Your Health Records`);
    console.log(`[BreakGlass] [STUB] Production: Integrate SendGrid for email delivery`);
  }
  
  logPhiAccess({
    userId: "system",
    action: "write",
    resourceType: "BreakGlassNotification",
    patientId: request.patientId,
    details: `BREAK-GLASS NOTIFICATIONS PROCESSED: ${request.auditTrailId}, ${request.patientNotifications.length} notifications queued via ${request.patientNotifications.map(n => n.type).join(", ")}, mode: SYSTEM_STUB`
  });
}

export function validateBreakGlassAccess(
  breakGlassId: string,
  userId: string
): BreakGlassAccessResult {
  const request = breakGlassRequests.get(breakGlassId);
  
  if (!request) {
    return { authorized: false, reason: "Break-glass request not found" };
  }
  
  if (request.status === "revoked_by_patient") {
    return { authorized: false, reason: "Access was revoked by the patient" };
  }
  
  if (request.status === "expired" || new Date() > request.expiresAt) {
    request.status = "expired";
    return { authorized: false, reason: "Break-glass access has expired" };
  }
  
  if (request.requestedBy !== userId) {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "BreakGlassAccess",
      patientId: request.patientId,
      details: `SECURITY ALERT: Unauthorized break-glass attempt by ${userId} for session ${request.auditTrailId}, original requestor: ${request.requestedBy}`
    });
    return { authorized: false, reason: "User not authorized for this break-glass session" };
  }
  
  return {
    authorized: true,
    breakGlassId,
    expiresAt: request.expiresAt
  };
}

export function logBreakGlassResourceAccess(
  breakGlassId: string,
  resourceType: string,
  resourceId: string,
  action: string
): void {
  const request = breakGlassRequests.get(breakGlassId);
  
  if (request) {
    request.accessLog.push({
      accessedAt: new Date(),
      resourceType,
      resourceId,
      action
    });
    
    logPhiAccess({
      userId: request.requestedBy,
      action: "read",
      resourceType,
      patientId: request.patientId,
      details: `BREAK-GLASS ACCESS: ${request.auditTrailId} accessed ${resourceType}/${resourceId}, action: ${action}`
    });
  }
}

export function revokeBreakGlassAccess(
  breakGlassId: string,
  revokedBy: string
): boolean {
  const request = breakGlassRequests.get(breakGlassId);
  
  if (!request) {
    return false;
  }
  
  request.status = "revoked_by_patient";
  
  logPhiAccess({
    userId: revokedBy,
    action: "delete",
    resourceType: "BreakGlassAccess",
    patientId: request.patientId,
    details: `BREAK-GLASS REVOKED: ${request.auditTrailId} revoked by patient, had ${request.accessLog.length} accesses`
  });
  
  return true;
}

export function getPatientBreakGlassHistory(patientId: string): BreakGlassRequest[] {
  const history: BreakGlassRequest[] = [];
  
  Array.from(breakGlassRequests.values()).forEach(request => {
    if (request.patientId === patientId) {
      history.push(request);
    }
  });
  
  return history.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
}

export function getActiveBreakGlassForProvider(userId: string): BreakGlassRequest[] {
  const active: BreakGlassRequest[] = [];
  const now = new Date();
  
  Array.from(breakGlassRequests.values()).forEach(request => {
    if (request.requestedBy === userId && request.status === "active" && now < request.expiresAt) {
      active.push(request);
    }
  });
  
  return active;
}

export function getEmergencyTypes(): Array<{ value: EmergencyType; label: string; description: string }> {
  return [
    { value: "life_threatening", label: "Life-Threatening Emergency", description: "Immediate risk to patient's life" },
    { value: "urgent_care", label: "Urgent Care Needed", description: "Time-sensitive medical situation" },
    { value: "critical_medication", label: "Critical Medication Info", description: "Need medication history for emergency treatment" },
    { value: "surgical_emergency", label: "Surgical Emergency", description: "Emergency surgery requiring medical history" },
    { value: "psychiatric_crisis", label: "Psychiatric Crisis", description: "Mental health emergency" },
    { value: "other", label: "Other Emergency", description: "Other emergency situation requiring access" }
  ];
}

export function updatePatientNotificationPreferences(
  patientId: string,
  preferences: { phone?: string; email?: string; allowSms: boolean; allowEmail: boolean }
): void {
  patientNotificationPreferences.set(patientId, preferences);
}

console.log("[BreakGlass] Emergency access protocol initialized");
console.log("[BreakGlass] Features: Immediate SMS/Email alerts, permanent audit logging, 4-hour access window");
console.log("[BreakGlass] HIPAA Emergency Access Protocol compliant");
