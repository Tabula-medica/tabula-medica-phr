import { randomUUID } from "crypto";
import { logPhiAccess } from "../security/hipaa-audit";
import { getAuditLogger } from "./integrations/factory";

export type AuthenticationType = "oauth2" | "mtls" | "api_key" | "smart_on_fhir" | "basic";
export type SyncDirection = "inbound" | "outbound" | "bidirectional";
export type ConnectionStatus = "connected" | "disconnected" | "error" | "pending";
export type MessageFormat = "fhir_r4" | "hl7_v2" | "ccd" | "ccda" | "custom";

export interface ExternalConnection {
  id: string;
  name: string;
  type: "ehr" | "hie" | "lab" | "pharmacy" | "payer" | "registry" | "legacy";
  endpoint: string;
  authType: AuthenticationType;
  status: ConnectionStatus;
  syncDirection: SyncDirection;
  supportedFormats: MessageFormat[];
  supportedResources: string[];
  lastSyncAt?: string;
  lastHeartbeatAt?: string;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  credentials: ConnectionCredentials;
  rateLimits: RateLimitConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionCredentials {
  clientId?: string;
  clientSecret?: string;
  tokenEndpoint?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  apiKey?: string;
  mtlsCertPath?: string;
  mtlsKeyPath?: string;
  mtlsCaPath?: string;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
  burstLimit: number;
  currentMinuteCount: number;
  currentHourCount: number;
  lastResetMinute: string;
  lastResetHour: string;
}

export interface SyncEvent {
  id: string;
  connectionId: string;
  direction: SyncDirection;
  resourceType: string;
  resourceId: string;
  action: "create" | "update" | "delete" | "read";
  status: "pending" | "success" | "failed" | "conflict";
  sourceData?: unknown;
  transformedData?: unknown;
  errorMessage?: string;
  conflictDetails?: ConflictDetails;
  timestamp: string;
  processingTimeMs: number;
}

export interface ConflictDetails {
  type: "duplicate" | "version_mismatch" | "schema_mismatch" | "validation_error";
  localVersion?: unknown;
  remoteVersion?: unknown;
  resolution?: "local_wins" | "remote_wins" | "manual_merge" | "pending";
}

export interface WebhookSubscription {
  id: string;
  connectionId: string;
  eventTypes: string[];
  callbackUrl: string;
  secret: string;
  status: "active" | "paused" | "failed";
  retryPolicy: RetryPolicy;
  lastDeliveryAt?: string;
  lastDeliveryStatus?: "success" | "failed";
  failureCount: number;
  createdAt: string;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

export interface DataTransformRule {
  id: string;
  name: string;
  sourceFormat: MessageFormat;
  targetFormat: MessageFormat;
  resourceType: string;
  mappings: FieldMapping[];
  validations: ValidationRule[];
  isActive: boolean;
  createdAt: string;
}

export interface FieldMapping {
  sourcePath: string;
  targetPath: string;
  transform?: "uppercase" | "lowercase" | "date_format" | "code_translate" | "custom";
  defaultValue?: unknown;
  required: boolean;
}

export interface ValidationRule {
  field: string;
  rule: "required" | "regex" | "range" | "enum" | "custom";
  value?: unknown;
  errorMessage: string;
}

export interface ReconciliationResult {
  id: string;
  sourceRecords: SourceRecord[];
  matchScore: number;
  matchType: "exact" | "probable" | "possible" | "no_match";
  mergedRecord?: unknown;
  conflicts: ReconciliationConflict[];
  status: "pending" | "auto_merged" | "manual_review" | "resolved";
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface SourceRecord {
  connectionId: string;
  connectionName: string;
  resourceType: string;
  resourceId: string;
  data: unknown;
  receivedAt: string;
  confidence: number;
}

export interface ReconciliationConflict {
  field: string;
  values: Array<{ source: string; value: unknown }>;
  suggestedResolution?: unknown;
  resolutionReason?: string;
}

const connections: Map<string, ExternalConnection> = new Map();
const syncEvents: Map<string, SyncEvent> = new Map();
const webhookSubscriptions: Map<string, WebhookSubscription> = new Map();
const transformRules: Map<string, DataTransformRule> = new Map();
const reconciliationResults: Map<string, ReconciliationResult> = new Map();

function hashIdentifier(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `H${Math.abs(hash).toString(16).substring(0, 8)}`;
}

async function logIntegrationActivity(
  action: string,
  connectionId: string,
  userId: string,
  details: Record<string, unknown>,
  ipAddress: string = "internal"
): Promise<void> {
  try {
    const auditLogger = getAuditLogger();
    await auditLogger.log({
      userId: hashIdentifier(userId),
      userRole: "system",
      action: "create" as const,
      resourceType: "ExternalIntegration",
      resourceId: connectionId,
      patientId: hashIdentifier("system"),
      ipAddress: hashIdentifier(ipAddress),
      userAgent: "integration-hub",
      requestPath: "/api/external-integration",
      requestMethod: "POST",
      responseStatus: 200,
      responseTimeMs: 0,
      phiAccessed: true,
      details: {
        integrationAction: action,
        connectionIdHash: hashIdentifier(connectionId),
        ...details,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error("[ExternalIntegrationHub] Audit logging failed:", e);
  }
}

initializeSampleConnections();

function initializeSampleConnections() {
  const sampleConnections: Omit<ExternalConnection, "id" | "createdAt" | "updatedAt">[] = [
    {
      name: "Primary Care Provider",
      type: "ehr",
      endpoint: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4",
      authType: "oauth2",
      status: "connected",
      syncDirection: "bidirectional",
      supportedFormats: ["fhir_r4"],
      supportedResources: ["Patient", "Condition", "MedicationRequest", "Observation", "AllergyIntolerance"],
      metadata: { vendor: "Fasten Health", version: "November 2023" },
      credentials: {},
      rateLimits: {
        requestsPerMinute: 100,
        requestsPerHour: 1000,
        burstLimit: 20,
        currentMinuteCount: 0,
        currentHourCount: 0,
        lastResetMinute: new Date().toISOString(),
        lastResetHour: new Date().toISOString(),
      },
    },
    {
      name: "Hospital Network",
      type: "ehr",
      endpoint: "https://fhir-myrecord.cerner.com/r4/tenant-id",
      authType: "smart_on_fhir",
      status: "connected",
      syncDirection: "bidirectional",
      supportedFormats: ["fhir_r4", "hl7_v2"],
      supportedResources: ["Patient", "Condition", "MedicationRequest", "Observation", "Encounter"],
      metadata: { vendor: "Hospital Network", version: "2024.1" },
      credentials: {},
      rateLimits: {
        requestsPerMinute: 60,
        requestsPerHour: 600,
        burstLimit: 15,
        currentMinuteCount: 0,
        currentHourCount: 0,
        lastResetMinute: new Date().toISOString(),
        lastResetHour: new Date().toISOString(),
      },
    },
    {
      name: "Legacy Lab System",
      type: "legacy",
      endpoint: "mllp://lab.hospital.local:2575",
      authType: "mtls",
      status: "connected",
      syncDirection: "inbound",
      supportedFormats: ["hl7_v2"],
      supportedResources: ["DiagnosticReport", "Observation", "Specimen"],
      metadata: { protocol: "MLLP", hl7Version: "2.5.1" },
      credentials: {},
      rateLimits: {
        requestsPerMinute: 200,
        requestsPerHour: 5000,
        burstLimit: 50,
        currentMinuteCount: 0,
        currentHourCount: 0,
        lastResetMinute: new Date().toISOString(),
        lastResetHour: new Date().toISOString(),
      },
    },
  ];

  sampleConnections.forEach((conn) => {
    const id = randomUUID();
    connections.set(id, {
      ...conn,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });
}

export function getConnections(): ExternalConnection[] {
  return Array.from(connections.values());
}

export function getConnection(id: string): ExternalConnection | undefined {
  return connections.get(id);
}

export async function createConnection(
  data: Omit<ExternalConnection, "id" | "createdAt" | "updatedAt" | "status">,
  userId: string,
  ipAddress: string
): Promise<ExternalConnection> {
  const id = randomUUID();
  const now = new Date().toISOString();
  
  const connection: ExternalConnection = {
    ...data,
    id,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  
  connections.set(id, connection);
  
  await logIntegrationActivity("create_connection", id, userId, {
    connectionName: data.name,
    connectionType: data.type,
    authType: data.authType,
  }, ipAddress);
  
  return connection;
}

export async function updateConnection(
  id: string,
  updates: Partial<ExternalConnection>,
  userId: string,
  ipAddress: string
): Promise<ExternalConnection | null> {
  const connection = connections.get(id);
  if (!connection) return null;
  
  const updated = {
    ...connection,
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };
  
  connections.set(id, updated);
  
  await logIntegrationActivity("update_connection", id, userId, {
    updatedFields: Object.keys(updates),
  }, ipAddress);
  
  return updated;
}

export async function deleteConnection(
  id: string,
  userId: string,
  ipAddress: string
): Promise<boolean> {
  const connection = connections.get(id);
  if (!connection) return false;
  
  connections.delete(id);
  
  await logIntegrationActivity("delete_connection", id, userId, {
    connectionName: connection.name,
  }, ipAddress);
  
  return true;
}

export async function testConnection(
  id: string,
  userId: string,
  ipAddress: string
): Promise<{ success: boolean; latencyMs: number; message: string }> {
  const connection = connections.get(id);
  if (!connection) {
    return { success: false, latencyMs: 0, message: "Connection not found" };
  }
  
  const startTime = Date.now();
  
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 500 + 100));
  
  const latencyMs = Date.now() - startTime;
  const success = Math.random() > 0.1;
  
  connection.status = success ? "connected" : "error";
  connection.lastHeartbeatAt = new Date().toISOString();
  if (!success) {
    connection.errorMessage = "Connection timeout or authentication failed";
  }
  connections.set(id, connection);
  
  await logIntegrationActivity("test_connection", id, userId, {
    success,
    latencyMs,
  }, ipAddress);
  
  return {
    success,
    latencyMs,
    message: success ? "Connection successful" : "Connection failed - check credentials",
  };
}

export function getWebhookSubscriptions(connectionId?: string): WebhookSubscription[] {
  const subs = Array.from(webhookSubscriptions.values());
  return connectionId ? subs.filter((s) => s.connectionId === connectionId) : subs;
}

export async function createWebhookSubscription(
  data: Omit<WebhookSubscription, "id" | "createdAt" | "failureCount">,
  userId: string,
  ipAddress: string
): Promise<WebhookSubscription> {
  const id = randomUUID();
  
  const subscription: WebhookSubscription = {
    ...data,
    id,
    failureCount: 0,
    createdAt: new Date().toISOString(),
  };
  
  webhookSubscriptions.set(id, subscription);
  
  await logIntegrationActivity("create_webhook", id, userId, {
    connectionId: data.connectionId,
    eventTypes: data.eventTypes,
  }, ipAddress);
  
  return subscription;
}

export async function deleteWebhookSubscription(
  id: string,
  userId: string,
  ipAddress: string
): Promise<boolean> {
  const sub = webhookSubscriptions.get(id);
  if (!sub) return false;
  
  webhookSubscriptions.delete(id);
  
  await logIntegrationActivity("delete_webhook", id, userId, {
    connectionId: sub.connectionId,
  }, ipAddress);
  
  return true;
}

export async function triggerWebhook(
  subscriptionId: string,
  eventType: string,
  payload: unknown,
  userId: string,
  ipAddress: string
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const subscription = webhookSubscriptions.get(subscriptionId);
  if (!subscription) {
    return { success: false, error: "Subscription not found" };
  }
  
  if (!subscription.eventTypes.includes(eventType)) {
    return { success: false, error: "Event type not subscribed" };
  }
  
  const success = Math.random() > 0.1;
  const statusCode = success ? 200 : 500;
  
  subscription.lastDeliveryAt = new Date().toISOString();
  subscription.lastDeliveryStatus = success ? "success" : "failed";
  if (!success) {
    subscription.failureCount += 1;
    if (subscription.failureCount >= 5) {
      subscription.status = "failed";
    }
  } else {
    subscription.failureCount = 0;
  }
  webhookSubscriptions.set(subscriptionId, subscription);
  
  await logIntegrationActivity("trigger_webhook", subscriptionId, userId, {
    eventType,
    success,
    statusCode,
  }, ipAddress);
  
  return { success, statusCode };
}

export function getTransformRules(format?: MessageFormat): DataTransformRule[] {
  const rules = Array.from(transformRules.values());
  return format ? rules.filter((r) => r.sourceFormat === format || r.targetFormat === format) : rules;
}

export async function createTransformRule(
  data: Omit<DataTransformRule, "id" | "createdAt">,
  userId: string,
  ipAddress: string
): Promise<DataTransformRule> {
  const id = randomUUID();
  
  const rule: DataTransformRule = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
  };
  
  transformRules.set(id, rule);
  
  await logIntegrationActivity("create_transform_rule", id, userId, {
    name: data.name,
    sourceFormat: data.sourceFormat,
    targetFormat: data.targetFormat,
  }, ipAddress);
  
  return rule;
}

export function getSyncEvents(connectionId?: string, limit: number = 100): SyncEvent[] {
  const events = Array.from(syncEvents.values());
  const filtered = connectionId ? events.filter((e) => e.connectionId === connectionId) : events;
  return filtered
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export async function recordSyncEvent(
  event: Omit<SyncEvent, "id" | "timestamp">,
  userId: string,
  ipAddress: string
): Promise<SyncEvent> {
  const id = randomUUID();
  
  const syncEvent: SyncEvent = {
    ...event,
    id,
    timestamp: new Date().toISOString(),
  };
  
  syncEvents.set(id, syncEvent);
  
  await logIntegrationActivity("sync_event", id, userId, {
    connectionId: event.connectionId,
    direction: event.direction,
    resourceType: event.resourceType,
    action: event.action,
    status: event.status,
  }, ipAddress);
  
  return syncEvent;
}

export function getReconciliationResults(status?: string): ReconciliationResult[] {
  const results = Array.from(reconciliationResults.values());
  return status ? results.filter((r) => r.status === status) : results;
}

export async function createReconciliationResult(
  data: Omit<ReconciliationResult, "id" | "createdAt">,
  userId: string,
  ipAddress: string
): Promise<ReconciliationResult> {
  const id = randomUUID();
  
  const result: ReconciliationResult = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
  };
  
  reconciliationResults.set(id, result);
  
  await logIntegrationActivity("create_reconciliation", id, userId, {
    matchType: data.matchType,
    matchScore: data.matchScore,
    sourceCount: data.sourceRecords.length,
    conflictCount: data.conflicts.length,
  }, ipAddress);
  
  return result;
}

export async function resolveReconciliation(
  id: string,
  resolution: "local_wins" | "remote_wins" | "manual_merge",
  mergedRecord: unknown,
  userId: string,
  ipAddress: string
): Promise<ReconciliationResult | null> {
  const result = reconciliationResults.get(id);
  if (!result) return null;
  
  result.status = "resolved";
  result.mergedRecord = mergedRecord;
  result.resolvedBy = userId;
  result.resolvedAt = new Date().toISOString();
  result.conflicts.forEach((c) => {
    c.resolutionReason = resolution;
  });
  
  reconciliationResults.set(id, result);
  
  await logIntegrationActivity("resolve_reconciliation", id, userId, {
    resolution,
    conflictCount: result.conflicts.length,
  }, ipAddress);
  
  return result;
}

export function getIntegrationStats(): {
  totalConnections: number;
  activeConnections: number;
  totalSyncEvents: number;
  successfulSyncs: number;
  failedSyncs: number;
  pendingReconciliations: number;
  webhookSubscriptions: number;
} {
  const conns = Array.from(connections.values());
  const events = Array.from(syncEvents.values());
  const recons = Array.from(reconciliationResults.values());
  
  return {
    totalConnections: conns.length,
    activeConnections: conns.filter((c) => c.status === "connected").length,
    totalSyncEvents: events.length,
    successfulSyncs: events.filter((e) => e.status === "success").length,
    failedSyncs: events.filter((e) => e.status === "failed").length,
    pendingReconciliations: recons.filter((r) => r.status === "pending" || r.status === "manual_review").length,
    webhookSubscriptions: webhookSubscriptions.size,
  };
}

console.log("[ExternalIntegrationHub] Service initialized with", connections.size, "connections");
