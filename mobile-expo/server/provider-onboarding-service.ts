/**
 * Provider / Lab / Hospital Onboarding Hub — Service Layer (Task #296)
 *
 * Personas: provider | lab | radiology | hospital | dpc
 *
 * • Sessions persisted to `provider_onboarding_sessions` DB table via Drizzle
 *   (falls back to in-memory Map if DB unavailable — e.g. during cold-start).
 * • Webhook secrets: crypto.randomBytes(32) → encryptPHI for storage; only
 *   the plaintext is returned once at provision time.
 * • FHIR metadata pings use safeFetch (SSRF-safe).
 */

import crypto from "crypto";
import { safeFetch } from "./utils/safe-fetch";
import { encryptPHI, decryptPHI } from "./compliance/encryption-service";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProviderPersona =
  | "provider"
  | "lab"
  | "radiology"
  | "hospital"
  | "dpc";

export type OnboardingStepId =
  | "org_info"
  | "ehr_selection"
  | "fhir_test"
  | "team_invites"
  | "golive_checklist"
  | "result_delivery"
  | "webhook_provision"
  | "test_result_send"
  | "dicom_endpoint"
  | "bulk_fhir_consent"
  | "tefca_participation"
  | "baa_upload"
  | "panel_size"
  | "patient_import"
  | "revenuecat_link"
  | "complete";

export type StepStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface OnboardingStepState {
  stepId: OnboardingStepId;
  label: string;
  status: StepStatus;
  data?: Record<string, unknown>;
  completedAt?: string;
}

export interface ProviderOnboardingSession {
  sessionId: string;
  userId: string;
  persona: ProviderPersona;
  orgName: string;
  contactEmail: string;
  npiNumber?: string;
  taxonomyCode?: string;
  steps: OnboardingStepState[];
  overallStatus: "in_progress" | "completed" | "abandoned";
  webhookEndpointUrl?: string;
  fhirBaseUrl?: string;
  fhirTestResult?: FhirTestResult;
  createdAt: string;
  updatedAt: string;
}

export interface FhirTestResult {
  ok: boolean;
  statusCode?: number;
  fhirVersion?: string;
  softwareName?: string;
  error?: string;
  testedAt: string;
}

export interface WebhookProvisionResult {
  endpointUrl: string;
  secretPlaintext: string;
  algorithm: "hmac-sha256";
  headerName: "X-Tabula-Signature";
}

// ─── Per-persona step definitions ────────────────────────────────────────────

type StepDef = { stepId: OnboardingStepId; label: string; optional?: boolean };

const PERSONA_STEPS: Record<ProviderPersona, StepDef[]> = {
  provider: [
    { stepId: "org_info",        label: "Practice Information" },
    { stepId: "ehr_selection",   label: "EHR Selection" },
    { stepId: "fhir_test",       label: "FHIR Endpoint Test", optional: true },
    { stepId: "team_invites",    label: "Team Invites",        optional: true },
    { stepId: "golive_checklist",label: "Go-Live Checklist" },
  ],
  lab: [
    { stepId: "org_info",         label: "Lab Information" },
    { stepId: "result_delivery",  label: "Result Delivery Method" },
    { stepId: "webhook_provision",label: "Webhook Provisioning" },
    { stepId: "test_result_send", label: "Send Test Result" },
  ],
  radiology: [
    { stepId: "org_info",       label: "Facility Information" },
    { stepId: "dicom_endpoint", label: "DICOM / FHIR Endpoint" },
    { stepId: "fhir_test",      label: "Connection Test" },
  ],
  hospital: [
    { stepId: "org_info",          label: "Organization Information" },
    { stepId: "bulk_fhir_consent", label: "Bulk FHIR Consent Scope" },
    { stepId: "tefca_participation",label: "TEFCA Participation" },
    { stepId: "baa_upload",        label: "BAA Signature" },
  ],
  dpc: [
    { stepId: "org_info",       label: "Practice Information" },
    { stepId: "panel_size",     label: "Panel Size & Subscription" },
    { stepId: "patient_import", label: "Patient Import",   optional: true },
    { stepId: "revenuecat_link",label: "Billing Setup" },
  ],
};

// ─── In-memory fallback (used when DB unavailable) ────────────────────────────

const memStore = new Map<string, ProviderOnboardingSession>();

// ─── DB persistence helpers ───────────────────────────────────────────────────

async function getDb() {
  try {
    const { db } = await import("./db");
    return db;
  } catch {
    return null;
  }
}

async function persistSession(session: ProviderOnboardingSession): Promise<void> {
  const db = await getDb();
  if (!db) { memStore.set(session.sessionId, session); return; }
  try {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`
      INSERT INTO provider_onboarding_sessions
        (id, user_id, persona, org_name, contact_email, npi_number, taxonomy_code,
         steps_json, overall_status, fhir_base_url, fhir_test_result,
         webhook_endpoint_url, webhook_secret_enc, created_at, updated_at)
      VALUES (
        ${session.sessionId}, ${session.userId}, ${session.persona},
        ${session.orgName}, ${session.contactEmail},
        ${session.npiNumber ?? null}, ${session.taxonomyCode ?? null},
        ${JSON.stringify(session.steps)}::jsonb,
        ${session.overallStatus},
        ${session.fhirBaseUrl ?? null},
        ${session.fhirTestResult ? JSON.stringify(session.fhirTestResult) : null}::jsonb,
        ${session.webhookEndpointUrl ?? null},
        ${null},
        ${session.createdAt}::timestamp, ${session.updatedAt}::timestamp
      )
      ON CONFLICT (id) DO UPDATE SET
        steps_json           = EXCLUDED.steps_json,
        overall_status       = EXCLUDED.overall_status,
        fhir_base_url        = EXCLUDED.fhir_base_url,
        fhir_test_result     = EXCLUDED.fhir_test_result,
        webhook_endpoint_url = EXCLUDED.webhook_endpoint_url,
        updated_at           = EXCLUDED.updated_at
    `);
  } catch {
    memStore.set(session.sessionId, session);
  }
}

async function loadSession(sessionId: string): Promise<ProviderOnboardingSession | null> {
  const mem = memStore.get(sessionId);
  if (mem) return mem;
  const db = await getDb();
  if (!db) return null;
  try {
    const { sql } = await import("drizzle-orm");
    const rows = await db.execute(sql`
      SELECT * FROM provider_onboarding_sessions WHERE id = ${sessionId} LIMIT 1
    `);
    const row = (rows as { rows?: unknown[] }).rows?.[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return dbRowToSession(row);
  } catch {
    return null;
  }
}

async function loadSessionByUserId(sessionId: string, userId: string): Promise<ProviderOnboardingSession | null> {
  const s = await loadSession(sessionId);
  if (!s) return null;
  if (s.userId !== userId) return null;
  return s;
}

function dbRowToSession(row: Record<string, unknown>): ProviderOnboardingSession {
  return {
    sessionId: row.id as string,
    userId: row.user_id as string,
    persona: row.persona as ProviderPersona,
    orgName: row.org_name as string,
    contactEmail: row.contact_email as string,
    npiNumber: row.npi_number as string | undefined,
    taxonomyCode: row.taxonomy_code as string | undefined,
    steps: (typeof row.steps_json === "string"
      ? JSON.parse(row.steps_json)
      : row.steps_json) as OnboardingStepState[],
    overallStatus: row.overall_status as ProviderOnboardingSession["overallStatus"],
    fhirBaseUrl: row.fhir_base_url as string | undefined,
    fhirTestResult: row.fhir_test_result
      ? (typeof row.fhir_test_result === "string"
          ? JSON.parse(row.fhir_test_result)
          : row.fhir_test_result) as FhirTestResult
      : undefined,
    webhookEndpointUrl: row.webhook_endpoint_url as string | undefined,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildInitialSteps(persona: ProviderPersona): OnboardingStepState[] {
  const defs = PERSONA_STEPS[persona];
  return defs.map((def, idx) => ({
    stepId: def.stepId,
    label: def.label,
    status: (idx === 0 ? "in_progress" : "pending") as StepStatus,
  }));
}

function nowIso(): string {
  return new Date().toISOString();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function startOnboardingSession(params: {
  userId: string;
  persona: ProviderPersona;
  orgName: string;
  contactEmail: string;
  npiNumber?: string;
  taxonomyCode?: string;
}): Promise<ProviderOnboardingSession> {
  const session: ProviderOnboardingSession = {
    sessionId: crypto.randomUUID(),
    userId: params.userId,
    persona: params.persona,
    orgName: params.orgName.trim(),
    contactEmail: params.contactEmail.trim().toLowerCase(),
    npiNumber: params.npiNumber,
    taxonomyCode: params.taxonomyCode,
    steps: buildInitialSteps(params.persona),
    overallStatus: "in_progress",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await persistSession(session);
  return session;
}

export async function getSession(sessionId: string, userId: string): Promise<ProviderOnboardingSession | null> {
  return loadSessionByUserId(sessionId, userId);
}

/**
 * Returns the most recent in-progress or completed session for a user,
 * enabling cross-device resume.
 */
export async function getLatestSessionForUser(userId: string): Promise<ProviderOnboardingSession | null> {
  // Check in-memory store first (dev / fallback)
  const memSessions = Array.from(memStore.values())
    .filter((s) => s.userId === userId && s.overallStatus !== "abandoned")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (memSessions.length > 0) return memSessions[0];

  const db = await getDb();
  if (!db) return null;
  try {
    const { sql } = await import("drizzle-orm");
    const rows = await db.execute(sql`
      SELECT * FROM provider_onboarding_sessions
      WHERE user_id = ${userId} AND overall_status != 'abandoned'
      ORDER BY updated_at DESC
      LIMIT 1
    `);
    const row = (rows as { rows?: unknown[] }).rows?.[0] as Record<string, unknown> | undefined;
    if (!row) return null;
    return dbRowToSession(row);
  } catch {
    return null;
  }
}

export async function advanceStep(
  sessionId: string,
  userId: string,
  stepId: OnboardingStepId,
  data?: Record<string, unknown>,
  skip = false,
): Promise<ProviderOnboardingSession> {
  const session = await loadSessionByUserId(sessionId, userId);
  if (!session) throw new Error("Session not found or access denied");
  if (session.overallStatus === "completed") throw new Error("Onboarding already completed");

  const stepDefs = PERSONA_STEPS[session.persona];
  const stepDef = stepDefs.find((d) => d.stepId === stepId);
  if (!stepDef) throw new Error(`Step "${stepId}" not valid for persona "${session.persona}"`);

  if (skip && !stepDef.optional) {
    throw new Error(`Step "${stepId}" is required for persona "${session.persona}" and cannot be skipped`);
  }

  const step = session.steps.find((s) => s.stepId === stepId);
  if (!step) throw new Error("Step not found in session");

  if (skip) {
    step.status = "skipped";
  } else {
    step.status = "completed";
    step.completedAt = nowIso();
    if (data) step.data = data;
    if (stepId === "fhir_test" && data?.fhirBaseUrl) {
      session.fhirBaseUrl = data.fhirBaseUrl as string;
    }
    if (stepId === "dicom_endpoint" && data?.fhirBaseUrl) {
      session.fhirBaseUrl = data.fhirBaseUrl as string;
    }
  }

  const nextPending = session.steps.find((s) => s.status === "pending");
  if (nextPending) nextPending.status = "in_progress";

  const allDone = session.steps.every(
    (s) => s.status === "completed" || s.status === "skipped",
  );
  if (allDone) session.overallStatus = "completed";

  session.updatedAt = nowIso();
  await persistSession(session);
  return session;
}

export async function testFhirEndpoint(
  sessionId: string,
  userId: string,
  fhirBaseUrl: string,
): Promise<FhirTestResult> {
  const session = await loadSessionByUserId(sessionId, userId);
  if (!session) throw new Error("Session not found or access denied");

  const testedAt = nowIso();
  let result: FhirTestResult;
  try {
    const metadataUrl = fhirBaseUrl.replace(/\/$/, "") + "/metadata";
    const resp = await safeFetch(metadataUrl, {
      method: "GET",
      headers: { Accept: "application/fhir+json, application/json" },
    });
    if (resp.ok) {
      let fhirVersion: string | undefined;
      let softwareName: string | undefined;
      try {
        const body = await resp.json() as Record<string, unknown>;
        fhirVersion = body.fhirVersion as string | undefined;
        const software = body.software as Record<string, unknown> | undefined;
        softwareName = software?.name as string | undefined;
      } catch { /* non-JSON body still counts as reachable */ }
      result = { ok: true, statusCode: resp.status, fhirVersion, softwareName, testedAt };
    } else {
      result = { ok: false, statusCode: resp.status, error: `HTTP ${resp.status}`, testedAt };
    }
  } catch (err: unknown) {
    result = { ok: false, error: err instanceof Error ? err.message : "Unknown error", testedAt };
  }

  session.fhirBaseUrl = fhirBaseUrl;
  session.fhirTestResult = result;
  session.updatedAt = nowIso();
  await persistSession(session);
  return result;
}

export async function provisionWebhookSecret(
  sessionId: string,
  userId: string,
): Promise<WebhookProvisionResult & { alreadyProvisioned?: boolean }> {
  const session = await loadSessionByUserId(sessionId, userId);
  if (!session) throw new Error("Session not found or access denied");

  // Idempotency: if already provisioned, return existing URL without
  // reissuing a new plaintext secret (secret is shown once, not re-mintable).
  if (session.webhookEndpointUrl) {
    return {
      endpointUrl: session.webhookEndpointUrl,
      secretPlaintext: "",
      algorithm: "hmac-sha256",
      headerName: "X-Tabula-Signature",
      alreadyProvisioned: true,
    };
  }

  const secretBytes = crypto.randomBytes(32);
  const secretPlaintext = secretBytes.toString("hex");

  // Store encrypted (not just hashed) — per HIPAA/spec requirement.
  // Fail fast: if encryption is unavailable the secret must NOT be persisted.
  const secretEnc = encryptPHI(secretPlaintext);

  const endpointUrl = `https://api.tabulamedica.health/webhooks/provider/${sessionId}`;
  session.webhookEndpointUrl = endpointUrl;
  session.updatedAt = nowIso();

  // Persist to DB with encrypted secret in its own column
  const db = await getDb();
  if (db) {
    try {
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`
        UPDATE provider_onboarding_sessions
        SET webhook_endpoint_url = ${endpointUrl},
            webhook_secret_enc   = ${secretEnc},
            updated_at           = ${session.updatedAt}::timestamp
        WHERE id = ${sessionId} AND user_id = ${userId}
      `);
    } catch {
      memStore.set(sessionId, session);
    }
  } else {
    memStore.set(sessionId, session);
  }

  return {
    endpointUrl,
    secretPlaintext,
    algorithm: "hmac-sha256",
    headerName: "X-Tabula-Signature",
  };
}

export async function getSessionMetrics(): Promise<{
  total: number;
  inProgress: number;
  completed: number;
  byPersona: Record<ProviderPersona, number>;
}> {
  const byPersona: Record<ProviderPersona, number> = {
    provider: 0, lab: 0, radiology: 0, hospital: 0, dpc: 0,
  };
  const db = await getDb();
  if (db) {
    try {
      const { sql } = await import("drizzle-orm");
      const rows = await db.execute(sql`
        SELECT persona, overall_status, COUNT(*) as cnt
        FROM provider_onboarding_sessions
        GROUP BY persona, overall_status
      `);
      let total = 0, inProgress = 0, completed = 0;
      for (const row of (rows as { rows?: unknown[] }).rows ?? []) {
        const r = row as Record<string, unknown>;
        const p = r.persona as ProviderPersona;
        const cnt = Number(r.cnt);
        total += cnt;
        if (r.overall_status === "in_progress") inProgress += cnt;
        if (r.overall_status === "completed") completed += cnt;
        if (p in byPersona) byPersona[p] += cnt;
      }
      return { total, inProgress, completed, byPersona };
    } catch { /* fall through to in-memory */ }
  }
  const all = Array.from(memStore.values());
  for (const s of all) byPersona[s.persona]++;
  return {
    total: all.length,
    inProgress: all.filter((s) => s.overallStatus === "in_progress").length,
    completed: all.filter((s) => s.overallStatus === "completed").length,
    byPersona,
  };
}

export function getPersonaStepDefs(persona: ProviderPersona): StepDef[] {
  return PERSONA_STEPS[persona];
}
