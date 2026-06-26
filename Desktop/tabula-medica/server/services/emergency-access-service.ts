/**
 * Emergency ("break-glass") access service.
 *
 * HIPAA model (tiered hybrid, patient-consented):
 *  - BASIC tier  — allergies, conditions, implanted devices, advance directive,
 *    emergency contact, blood type, critical meds. Viewable PIN-less by EMS/ER
 *    within the token's time window (life-safety). Every access audited.
 *  - FULL tier   — health summary, insurance card, pharmacy, PCP, full meds.
 *    Single-use (maxAccesses, default 1) AND gated by PIN or the patient's DOB.
 *
 * Tokens are high-entropy, time-limited, patient-revocable. Nothing here trusts
 * the caller's identity — the token + (for FULL) the PIN/DOB are the gate, and
 * every read is written to emergency_access_logs.
 */
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import {
  emergencyProfilesTable,
  emergencyDevicesTable,
  emergencyShareTokensTable,
  emergencyAccessLogsTable,
  type EmergencyProfile,
  type EmergencyDevice,
} from "@shared/schema";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
// Canonicalize DOB to YYYYMMDD so ISO (1990-01-01) and US (01/01/1990) hash identically.
function normDob(dob: string): string {
  const s = dob.trim();
  let m = s.match(/^(\d{4})\D(\d{1,2})\D(\d{1,2})$/); // ISO YYYY-MM-DD
  if (m) return `${m[1]}${m[2].padStart(2, "0")}${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\D(\d{1,2})\D(\d{4})$/); // US MM/DD/YYYY
  if (m) return `${m[3]}${m[1].padStart(2, "0")}${m[2].padStart(2, "0")}`;
  return s.replace(/[^0-9]/g, ""); // fallback
}

export interface AccessorInfo {
  ipAddress?: string;
  userAgent?: string;
  accessorAgency?: string;
}

export class EmergencyAccessService {
  // db is injectable so tests can run against an embedded PGlite instance.
  constructor(private readonly database: typeof db = db) {}

  // ── Patient-facing: profile + device cards ─────────────────────────────────
  async getProfile(userId: string): Promise<EmergencyProfile | undefined> {
    const [row] = await this.database.select().from(emergencyProfilesTable).where(eq(emergencyProfilesTable.userId, userId));
    return row;
  }

  async upsertProfile(userId: string, data: Partial<EmergencyProfile>): Promise<EmergencyProfile> {
    const now = new Date().toISOString();
    const { userId: _omit, ...fields } = data;
    const values = { userId, ...fields, updatedAt: now };
    const [row] = await this.database
      .insert(emergencyProfilesTable)
      .values(values)
      .onConflictDoUpdate({ target: emergencyProfilesTable.userId, set: { ...fields, updatedAt: now } })
      .returning();
    return row;
  }

  async listDevices(userId: string): Promise<EmergencyDevice[]> {
    return this.database.select().from(emergencyDevicesTable).where(eq(emergencyDevicesTable.userId, userId));
  }

  async addDevice(userId: string, device: Omit<EmergencyDevice, "id" | "userId">): Promise<EmergencyDevice> {
    const [row] = await this.database.insert(emergencyDevicesTable).values({ ...device, userId }).returning();
    return row;
  }

  async deleteDevice(userId: string, id: string): Promise<void> {
    await this.database.delete(emergencyDevicesTable).where(and(eq(emergencyDevicesTable.id, id), eq(emergencyDevicesTable.userId, userId)));
  }

  // ── Token lifecycle ─────────────────────────────────────────────────────────
  async createToken(
    userId: string,
    opts: { expiresInHours?: number; maxFullAccesses?: number; pin?: string; dob?: string; label?: string } = {},
  ): Promise<{ token: string; expiresAt: string }> {
    const token = crypto.randomBytes(32).toString("base64url");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (opts.expiresInHours ?? 720) * 3600_000).toISOString(); // default 30d (wallet card)
    await this.database.insert(emergencyShareTokensTable).values({
      token,
      userId,
      createdAt: now.toISOString(),
      expiresAt,
      maxAccesses: Math.max(1, opts.maxFullAccesses ?? 1), // FULL tier single-use by default
      accessCount: 0,
      revoked: false,
      fullPinHash: opts.pin ? sha256(opts.pin) : null,
      fullDobHash: opts.dob ? sha256(normDob(opts.dob)) : null,
      label: opts.label ?? null,
    });
    return { token, expiresAt };
  }

  async revokeToken(userId: string, token: string): Promise<boolean> {
    const res = await this.database
      .update(emergencyShareTokensTable)
      .set({ revoked: true })
      .where(and(eq(emergencyShareTokensTable.token, token), eq(emergencyShareTokensTable.userId, userId)))
      .returning({ token: emergencyShareTokensTable.token });
    return res.length > 0;
  }

  async listTokens(userId: string) {
    const rows = await this.database
      .select()
      .from(emergencyShareTokensTable)
      .where(eq(emergencyShareTokensTable.userId, userId))
      .orderBy(desc(emergencyShareTokensTable.createdAt));
    // never leak the hashes
    return rows.map(({ fullPinHash, fullDobHash, ...r }) => ({
      ...r,
      fullTierProtected: Boolean(fullPinHash || fullDobHash),
    }));
  }

  async getAccessLogs(userId: string, token?: string) {
    const where = token
      ? and(eq(emergencyAccessLogsTable.userId, userId), eq(emergencyAccessLogsTable.token, token))
      : eq(emergencyAccessLogsTable.userId, userId);
    return this.database.select().from(emergencyAccessLogsTable).where(where).orderBy(desc(emergencyAccessLogsTable.accessedAt));
  }

  // ── Break-glass access (EMS/ER; no authenticated identity) ──────────────────
  private async loadToken(token: string) {
    const [row] = await this.database.select().from(emergencyShareTokensTable).where(eq(emergencyShareTokensTable.token, token));
    return row;
  }

  private async audit(
    token: string,
    userId: string,
    tier: "basic" | "full",
    success: boolean,
    accessor: AccessorInfo,
    detail?: string,
  ) {
    await this.database.insert(emergencyAccessLogsTable).values({
      token,
      userId,
      accessedAt: new Date().toISOString(),
      tier,
      success,
      ipAddress: accessor.ipAddress ?? null,
      userAgent: accessor.userAgent ?? null,
      accessorAgency: accessor.accessorAgency ?? null,
      detail: detail ?? null,
    });
  }

  /** Assemble the BASIC (life-safety) bundle from the patient's records. */
  private async basicBundle(userId: string, profile: EmergencyProfile | undefined) {
    const patientIds = await storage.getUserPatientIds(userId).catch(() => [] as string[]);
    const allergies: any[] = [];
    const conditions: any[] = [];
    const criticalMeds: any[] = [];
    for (const pid of patientIds) {
      allergies.push(...(await storage.getAllergiesByPatient(pid).catch(() => [])));
      const probs = await storage.getProblemsByPatient(pid).catch(() => []);
      conditions.push(...probs.filter((p: any) => p.status === "active"));
      const meds = await storage.getMedicationsByPatient(pid).catch(() => []);
      criticalMeds.push(...meds.filter((m: any) => m.status === "active"));
    }
    const devices = await this.listDevices(userId);
    return {
      bloodType: profile?.bloodType ?? null,
      organDonor: profile?.organDonor ?? null,
      allergies: allergies.map((a) => ({ name: a.name, severity: a.severity, reaction: a.reaction, type: a.type })),
      conditions: conditions.map((c) => ({ name: c.name, icdCode: c.icdCode, severity: c.severity })),
      criticalMedications: criticalMeds.map((m) => ({ name: m.name, dosage: m.dosage, frequency: m.frequency })),
      implantedDevices: devices.map((d) => ({
        deviceType: d.deviceType, name: d.name, manufacturer: d.manufacturer, modelNumber: d.modelNumber,
        serialNumber: d.serialNumber, location: d.location, mriConditional: d.mriConditional, cardImageUrl: d.cardImageUrl,
      })),
      advanceDirective: { status: profile?.advanceDirectiveStatus ?? "none", docUrl: profile?.advanceDirectiveDocUrl ?? null },
      emergencyContact: profile
        ? { name: profile.nextOfKinName, phone: profile.nextOfKinPhone, relationship: profile.nextOfKinRelationship }
        : null,
    };
  }

  /** EMS scans the QR → BASIC tier, PIN-less (within TTL). Always audited. */
  async accessBasic(token: string, accessor: AccessorInfo) {
    const t = await this.loadToken(token);
    if (!t) return { ok: false as const, status: 404, error: "Invalid token" };
    if (t.revoked) { await this.audit(token, t.userId, "basic", false, accessor, "revoked"); return { ok: false as const, status: 410, error: "Token revoked" }; }
    if (new Date(t.expiresAt) < new Date()) { await this.audit(token, t.userId, "basic", false, accessor, "expired"); return { ok: false as const, status: 410, error: "Token expired" }; }
    const profile = await this.getProfile(t.userId);
    if (profile && profile.allowPinlessBasic === false) {
      await this.audit(token, t.userId, "basic", false, accessor, "pinless_basic_disabled");
      return { ok: false as const, status: 403, error: "Patient requires PIN/DOB for emergency access", fullTierProtected: true };
    }
    const basic = await this.basicBundle(t.userId, profile);
    await this.audit(token, t.userId, "basic", true, accessor); // basic does NOT consume the single-use FULL budget
    return { ok: true as const, tier: "basic" as const, data: basic, fullTierAvailable: Boolean(t.fullPinHash || t.fullDobHash) };
  }

  /** FULL tier — single-use, gated by PIN or DOB. Always audited. */
  async accessFull(token: string, creds: { pin?: string; dob?: string }, accessor: AccessorInfo) {
    const t = await this.loadToken(token);
    if (!t) return { ok: false as const, status: 404, error: "Invalid token" };
    if (t.revoked) { await this.audit(token, t.userId, "full", false, accessor, "revoked"); return { ok: false as const, status: 410, error: "Token revoked" }; }
    if (new Date(t.expiresAt) < new Date()) { await this.audit(token, t.userId, "full", false, accessor, "expired"); return { ok: false as const, status: 410, error: "Token expired" }; }
    if (t.accessCount >= t.maxAccesses) { await this.audit(token, t.userId, "full", false, accessor, "max_accesses_reached"); return { ok: false as const, status: 429, error: "Full-tier access already used (single-use)" }; }

    const pinOk = t.fullPinHash && creds.pin ? sha256(creds.pin) === t.fullPinHash : false;
    const dobOk = t.fullDobHash && creds.dob ? sha256(normDob(creds.dob)) === t.fullDobHash : false;
    if (!t.fullPinHash && !t.fullDobHash) { await this.audit(token, t.userId, "full", false, accessor, "no_full_credential_configured"); return { ok: false as const, status: 403, error: "Full tier not enabled for this token" }; }
    if (!pinOk && !dobOk) { await this.audit(token, t.userId, "full", false, accessor, "bad_credential"); return { ok: false as const, status: 401, error: "Incorrect PIN/DOB" }; }

    // consume single-use budget
    await this.database.update(emergencyShareTokensTable).set({ accessCount: t.accessCount + 1 }).where(eq(emergencyShareTokensTable.token, token));
    const profile = await this.getProfile(t.userId);
    const basic = await this.basicBundle(t.userId, profile);
    const full = {
      ...basic,
      healthSummary: profile?.latestHealthSummary ?? null,
      insurance: profile
        ? { provider: profile.insuranceProvider, memberId: profile.insuranceMemberId, cardFrontUrl: profile.insuranceCardFrontUrl, cardBackUrl: profile.insuranceCardBackUrl }
        : null,
      pharmacy: profile ? { name: profile.pharmacyName, phone: profile.pharmacyPhone, address: profile.pharmacyAddress } : null,
      primaryCarePhysician: profile ? { name: profile.pcpName, phone: profile.pcpPhone } : null,
    };
    await this.audit(token, t.userId, "full", true, accessor, pinOk ? "pin" : "dob");
    return { ok: true as const, tier: "full" as const, data: full };
  }
}

export const emergencyAccessService = new EmergencyAccessService();
