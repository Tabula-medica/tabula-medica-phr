/**
 * Payer-Compliant Audit Events Service
 * 
 * This service provides an append-only audit trail that meets
 * SOC2, HIPAA, and payer auditability requirements.
 * 
 * Key features:
 * - Privacy-preserving IP and user agent hashing
 * - Chain integrity via record hashing
 * - Immutable records (no updates or deletes)
 * - Comprehensive event categorization
 */

import { createHash } from "crypto";
import { randomUUID } from "crypto";
import type { 
  AuditEvent, 
  InsertAuditEvent, 
  AuditEventAction, 
  AuditResourceType, 
  AuditEventResult 
} from "@shared/schema";

// In-memory storage for audit events (production would use database)
const auditEvents: Map<string, AuditEvent> = new Map();
let lastRecordHash: string | null = null;

/**
 * Hash a value for privacy-preserving storage
 */
function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Create a hash of the audit record for tamper detection
 */
function createRecordHash(record: Omit<AuditEvent, "recordHash">): string {
  const data = JSON.stringify({
    id: record.id,
    actorId: record.actorId,
    actorType: record.actorType,
    userId: record.userId,
    action: record.action,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    result: record.result,
    timestamp: record.timestamp,
    previousHash: record.previousHash,
  });
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Create an audit event
 * This is the only write operation - no updates or deletes allowed
 */
export async function createAuditEvent(
  data: InsertAuditEvent
): Promise<AuditEvent> {
  const id = randomUUID();
  const now = new Date().toISOString();
  
  const recordWithoutHash: Omit<AuditEvent, "recordHash"> = {
    id,
    actorId: data.actorId,
    actorType: data.actorType,
    userId: data.userId ?? null,
    profileId: data.profileId ?? null,
    action: data.action,
    resourceType: data.resourceType,
    resourceId: data.resourceId ?? null,
    result: data.result,
    resultReason: data.resultReason ?? null,
    ipHash: data.ipHash,
    userAgentHash: data.userAgentHash,
    requestId: data.requestId ?? null,
    sessionId: data.sessionId ?? null,
    metadata: data.metadata ?? null,
    timestamp: data.timestamp ?? now,
    createdAt: now,
    previousHash: lastRecordHash,
  };
  
  const recordHash = createRecordHash(recordWithoutHash);
  const record: AuditEvent = { ...recordWithoutHash, recordHash };
  
  auditEvents.set(id, record);
  lastRecordHash = recordHash;
  
  return record;
}

/**
 * Query audit events with filters
 */
export async function queryAuditEvents(filters: {
  userId?: string;
  actorId?: string;
  action?: AuditEventAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  result?: AuditEventResult;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<{ events: AuditEvent[]; total: number }> {
  let events = Array.from(auditEvents.values());
  
  if (filters.userId) {
    events = events.filter(e => e.userId === filters.userId);
  }
  if (filters.actorId) {
    events = events.filter(e => e.actorId === filters.actorId);
  }
  if (filters.action) {
    events = events.filter(e => e.action === filters.action);
  }
  if (filters.resourceType) {
    events = events.filter(e => e.resourceType === filters.resourceType);
  }
  if (filters.resourceId) {
    events = events.filter(e => e.resourceId === filters.resourceId);
  }
  if (filters.result) {
    events = events.filter(e => e.result === filters.result);
  }
  if (filters.startDate) {
    events = events.filter(e => e.timestamp >= filters.startDate!);
  }
  if (filters.endDate) {
    events = events.filter(e => e.timestamp <= filters.endDate!);
  }
  
  // Sort by timestamp descending (most recent first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  const total = events.length;
  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? 100;
  
  events = events.slice(offset, offset + limit);
  
  return { events, total };
}

/**
 * Get audit events for a specific resource
 */
export async function getResourceAuditTrail(
  resourceType: AuditResourceType,
  resourceId: string
): Promise<AuditEvent[]> {
  const { events } = await queryAuditEvents({ resourceType, resourceId, limit: 1000 });
  return events;
}

/**
 * Get audit events for a specific user
 */
export async function getUserAuditTrail(userId: string): Promise<AuditEvent[]> {
  const { events } = await queryAuditEvents({ userId, limit: 1000 });
  return events;
}

/**
 * Verify chain integrity of audit records
 */
export async function verifyAuditChainIntegrity(): Promise<{
  valid: boolean;
  brokenAt?: string;
  totalRecords: number;
}> {
  const events = Array.from(auditEvents.values())
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  let expectedPreviousHash: string | null = null;
  
  for (const event of events) {
    if (event.previousHash !== expectedPreviousHash) {
      return { valid: false, brokenAt: event.id, totalRecords: events.length };
    }
    
    const { recordHash, ...rest } = event;
    const calculatedHash = createRecordHash(rest);
    
    if (calculatedHash !== recordHash) {
      return { valid: false, brokenAt: event.id, totalRecords: events.length };
    }
    
    expectedPreviousHash = recordHash;
  }
  
  return { valid: true, totalRecords: events.length };
}

/**
 * Helper to create audit event from HTTP request context
 */
export function createAuditEventFromRequest(
  req: { ip?: string; get: (name: string) => string | undefined; user?: any },
  action: AuditEventAction,
  resourceType: AuditResourceType,
  resourceId: string | null,
  result: AuditEventResult,
  options?: {
    resultReason?: string;
    metadata?: Record<string, unknown>;
    requestId?: string;
    sessionId?: string;
  }
): Promise<AuditEvent> {
  const user = req.user as any;
  const userId = user?.claims?.sub;
  
  const ip = (req.get?.("x-forwarded-for") as string)?.split(",")[0]?.trim() || 
             req.ip || 
             "unknown";
  const userAgent = req.get?.("user-agent") || "unknown";
  
  return createAuditEvent({
    actorId: userId || "anonymous",
    actorType: userId ? "user" : "system",
    userId: userId || null,
    profileId: null,
    action,
    resourceType,
    resourceId,
    result,
    resultReason: options?.resultReason,
    ipHash: hashValue(ip),
    userAgentHash: hashValue(userAgent),
    requestId: options?.requestId,
    sessionId: options?.sessionId,
    metadata: options?.metadata,
  });
}

/**
 * Get audit statistics for compliance reporting
 */
export async function getAuditStatistics(startDate: string, endDate: string): Promise<{
  totalEvents: number;
  eventsByAction: Record<string, number>;
  eventsByResult: Record<string, number>;
  eventsByResourceType: Record<string, number>;
  uniqueActors: number;
  uniqueResources: number;
}> {
  const { events } = await queryAuditEvents({ startDate, endDate, limit: 100000 });
  
  const eventsByAction: Record<string, number> = {};
  const eventsByResult: Record<string, number> = {};
  const eventsByResourceType: Record<string, number> = {};
  const uniqueActorIds = new Set<string>();
  const uniqueResourceIds = new Set<string>();
  
  for (const event of events) {
    eventsByAction[event.action] = (eventsByAction[event.action] || 0) + 1;
    eventsByResult[event.result] = (eventsByResult[event.result] || 0) + 1;
    eventsByResourceType[event.resourceType] = (eventsByResourceType[event.resourceType] || 0) + 1;
    uniqueActorIds.add(event.actorId);
    if (event.resourceId) uniqueResourceIds.add(event.resourceId);
  }
  
  return {
    totalEvents: events.length,
    eventsByAction,
    eventsByResult,
    eventsByResourceType,
    uniqueActors: uniqueActorIds.size,
    uniqueResources: uniqueResourceIds.size,
  };
}

console.log("[AuditEvents] Payer-compliant audit service initialized");
