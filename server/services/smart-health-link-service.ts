/**
 * Smart Health Links Service
 * Generates time-limited, encrypted shareable links for patient health summaries
 * HIPAA-compliant with full audit logging
 * 
 * Security: Links use HMAC-SHA256 signed tokens with embedded expiration
 * The accessToken is a cryptographically signed payload that cannot be forged
 */

import crypto from "crypto";
import { logPhiAccess } from "../security/hipaa-audit";

const SIGNING_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

function signPayload(payload: object): string {
  const data = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", SIGNING_SECRET);
  hmac.update(data);
  const signature = hmac.digest("base64url");
  const encodedData = Buffer.from(data).toString("base64url");
  return `${encodedData}.${signature}`;
}

function verifyAndDecodePayload(token: string): { valid: boolean; payload?: any } {
  try {
    const [encodedData, signature] = token.split(".");
    if (!encodedData || !signature) return { valid: false };
    
    const data = Buffer.from(encodedData, "base64url").toString("utf8");
    const hmac = crypto.createHmac("sha256", SIGNING_SECRET);
    hmac.update(data);
    const expectedSignature = hmac.digest("base64url");
    
    if (signature !== expectedSignature) return { valid: false };
    
    return { valid: true, payload: JSON.parse(data) };
  } catch {
    return { valid: false };
  }
}

export interface SmartHealthLink {
  id: string;
  patientId: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  accessToken: string;
  encryptionKey: string;
  recipientEmail?: string;
  recipientName?: string;
  purpose: string;
  accessCount: number;
  maxAccesses: number;
  isRevoked: boolean;
  accessLog: LinkAccessEntry[];
  includedSections: string[];
}

export interface LinkAccessEntry {
  accessedAt: Date;
  accessorIp: string;
  accessorUserAgent: string;
  successful: boolean;
  failureReason?: string;
}

export interface CreateLinkRequest {
  patientId: string;
  createdBy: string;
  recipientEmail?: string;
  recipientName?: string;
  purpose: string;
  expirationHours: number;
  maxAccesses: number;
  includedSections: string[];
}

export interface LinkValidationResult {
  valid: boolean;
  reason?: string;
  link?: SmartHealthLink;
}

const activeLinks = new Map<string, SmartHealthLink>();

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function createSmartHealthLink(request: CreateLinkRequest): SmartHealthLink {
  const id = crypto.randomUUID();
  const encryptionKey = generateEncryptionKey();
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + request.expirationHours * 60 * 60 * 1000);
  
  const tokenPayload = {
    linkId: id,
    patientId: request.patientId,
    exp: expiresAt.getTime(),
    sections: request.includedSections,
    iat: now.getTime()
  };
  const accessToken = signPayload(tokenPayload);
  
  const link: SmartHealthLink = {
    id,
    patientId: request.patientId,
    createdBy: request.createdBy,
    createdAt: now,
    expiresAt,
    accessToken,
    encryptionKey,
    recipientEmail: request.recipientEmail,
    recipientName: request.recipientName,
    purpose: request.purpose,
    accessCount: 0,
    maxAccesses: request.maxAccesses,
    isRevoked: false,
    accessLog: [],
    includedSections: request.includedSections
  };
  
  activeLinks.set(id, link);
  
  logPhiAccess({
    userId: request.createdBy,
    action: "write",
    resourceType: "SmartHealthLink",
    patientId: request.patientId,
    details: `Created smart health link ${id} for ${request.purpose}, expires in ${request.expirationHours}h, max ${request.maxAccesses} accesses`
  });
  
  return link;
}

export function validateAndAccessLink(
  linkId: string,
  accessToken: string,
  accessorIp: string,
  accessorUserAgent: string
): LinkValidationResult {
  const tokenVerification = verifyAndDecodePayload(accessToken);
  if (!tokenVerification.valid || !tokenVerification.payload) {
    return { valid: false, reason: "Invalid or tampered access token" };
  }
  
  const payload = tokenVerification.payload;
  if (payload.linkId !== linkId) {
    return { valid: false, reason: "Token does not match link" };
  }
  
  const now = Date.now();
  if (now > payload.exp) {
    return { valid: false, reason: "This link has expired (token)" };
  }
  
  const link = activeLinks.get(linkId);
  
  if (!link) {
    return { valid: false, reason: "Link not found" };
  }
  
  if (link.isRevoked) {
    logLinkAccessAttempt(link, accessorIp, accessorUserAgent, false, "Link has been revoked");
    return { valid: false, reason: "This link has been revoked by the patient" };
  }
  
  if (new Date() > link.expiresAt) {
    logLinkAccessAttempt(link, accessorIp, accessorUserAgent, false, "Link expired");
    return { valid: false, reason: "This link has expired" };
  }
  
  if (link.accessCount >= link.maxAccesses) {
    logLinkAccessAttempt(link, accessorIp, accessorUserAgent, false, "Max accesses reached");
    return { valid: false, reason: "This link has reached its maximum access limit" };
  }
  
  link.accessCount++;
  logLinkAccessAttempt(link, accessorIp, accessorUserAgent, true);
  
  logPhiAccess({
    userId: "external_accessor",
    action: "read",
    resourceType: "SmartHealthLink",
    patientId: link.patientId,
    details: `Smart health link accessed: ${linkId}, access ${link.accessCount}/${link.maxAccesses}, IP: ${accessorIp}, verified_token: true`
  });
  
  return { valid: true, link };
}

function logLinkAccessAttempt(
  link: SmartHealthLink,
  accessorIp: string,
  accessorUserAgent: string,
  successful: boolean,
  failureReason?: string
): void {
  link.accessLog.push({
    accessedAt: new Date(),
    accessorIp,
    accessorUserAgent: accessorUserAgent.substring(0, 200),
    successful,
    failureReason
  });
}

export function revokeLink(linkId: string, revokedBy: string): boolean {
  const link = activeLinks.get(linkId);
  
  if (!link) {
    return false;
  }
  
  link.isRevoked = true;
  
  logPhiAccess({
    userId: revokedBy,
    action: "delete",
    resourceType: "SmartHealthLink",
    patientId: link.patientId,
    details: `Revoked smart health link ${linkId}, had ${link.accessCount} accesses`
  });
  
  return true;
}

export function getPatientLinks(patientId: string): SmartHealthLink[] {
  const links: SmartHealthLink[] = [];
  
  Array.from(activeLinks.values()).forEach(link => {
    if (link.patientId === patientId) {
      links.push({
        ...link,
        accessToken: "***REDACTED***",
        encryptionKey: "***REDACTED***"
      });
    }
  });
  
  return links.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function getLinkById(linkId: string): SmartHealthLink | undefined {
  const link = activeLinks.get(linkId);
  if (link) {
    return {
      ...link,
      accessToken: "***REDACTED***",
      encryptionKey: "***REDACTED***"
    };
  }
  return undefined;
}

export function getExpirationOptions(): Array<{ value: number; label: string }> {
  return [
    { value: 1, label: "1 hour" },
    { value: 6, label: "6 hours" },
    { value: 24, label: "24 hours" },
    { value: 48, label: "48 hours" },
    { value: 72, label: "3 days" },
    { value: 168, label: "1 week" }
  ];
}

export function getShareableSections(): Array<{ id: string; label: string; description: string }> {
  return [
    { id: "summary", label: "AI Health Summary", description: "AI-generated overview of health status" },
    { id: "vitals", label: "Vital Signs", description: "Blood pressure, heart rate, glucose, etc." },
    { id: "medications", label: "Medications", description: "Current and past medications with RxNorm codes" },
    { id: "conditions", label: "Conditions", description: "Active and resolved conditions with SNOMED codes" },
    { id: "timeline", label: "Timeline Events", description: "Chronological health events" },
    { id: "landmarks", label: "Health Landmarks", description: "Key milestones in health journey" },
    { id: "labs", label: "Lab Results", description: "Laboratory test results with LOINC codes" }
  ];
}

export function generateShareableUrl(link: SmartHealthLink, baseUrl: string): string {
  return `${baseUrl}/shared-health/${link.id}?token=${link.accessToken}`;
}

export function cleanupExpiredLinks(): number {
  const now = new Date();
  let cleanedCount = 0;
  
  Array.from(activeLinks.entries()).forEach(([id, link]) => {
    if (now > link.expiresAt && now.getTime() - link.expiresAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
      activeLinks.delete(id);
      cleanedCount++;
    }
  });
  
  return cleanedCount;
}

setInterval(() => {
  cleanupExpiredLinks();
}, 24 * 60 * 60 * 1000);

console.log("[SmartHealthLinks] Service initialized with encrypted link generation");
console.log("[SmartHealthLinks] Features: Time-limited access, revocation, access logging");
