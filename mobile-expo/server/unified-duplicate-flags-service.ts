import { db } from "./db";
import {
  healthRecords,
  complianceAlerts,
  auditLogs,
  users,
} from "@shared/schema";
import { eq, and, gte, sql, desc, isNull } from "drizzle-orm";
import { createHash } from "crypto";

type DuplicateFlagType =
  | "identical_vital_entries"
  | "overlapping_medication_logs"
  | "duplicate_lab_results"
  | "redundant_ai_audit_findings"
  | "double_entitlement"
  | "multi_device_abuse"
  | "restoration_conflict"
  | "mhmda_consent_gap"
  | "ccpa_request_anomaly"
  | "identity_document_expiry"
  | "identity_cross_reference_mismatch";

type FlagCategory = "clinical_data" | "subscription" | "regulatory";

interface DuplicateFlag {
  alertType: DuplicateFlagType;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  category: FlagCategory;
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  metadata: Record<string, unknown>;
}

interface FlagSummary {
  totalActive: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  lastScanAt: string | null;
  scanStatus: "idle" | "running" | "completed" | "error";
}

const BRAND_GENERIC_MAP: Record<string, string[]> = {
  atorvastatin: ["lipitor", "atorvastatin"],
  simvastatin: ["zocor", "simvastatin"],
  metformin: ["glucophage", "metformin", "fortamet", "riomet"],
  lisinopril: ["prinivil", "zestril", "lisinopril"],
  amlodipine: ["norvasc", "amlodipine"],
  omeprazole: ["prilosec", "omeprazole"],
  losartan: ["cozaar", "losartan"],
  gabapentin: ["neurontin", "gabapentin", "gralise"],
  hydrochlorothiazide: ["microzide", "hydrochlorothiazide", "hctz"],
  metoprolol: ["lopressor", "toprol-xl", "metoprolol"],
  levothyroxine: ["synthroid", "levoxyl", "levothyroxine", "tirosint"],
  acetaminophen: ["tylenol", "acetaminophen"],
  ibuprofen: ["advil", "motrin", "ibuprofen"],
  sertraline: ["zoloft", "sertraline"],
  fluoxetine: ["prozac", "fluoxetine", "sarafem"],
  escitalopram: ["lexapro", "escitalopram"],
  duloxetine: ["cymbalta", "duloxetine"],
  montelukast: ["singulair", "montelukast"],
  rosuvastatin: ["crestor", "rosuvastatin"],
  pantoprazole: ["protonix", "pantoprazole"],
  clopidogrel: ["plavix", "clopidogrel"],
  warfarin: ["coumadin", "jantoven", "warfarin"],
  albuterol: ["proventil", "ventolin", "proair", "albuterol"],
};

function normalizeForComparison(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function areMedicationsEquivalent(med1: string, med2: string): boolean {
  const norm1 = normalizeForComparison(med1);
  const norm2 = normalizeForComparison(med2);
  if (norm1 === norm2) return false;
  for (const [, equivalents] of Object.entries(BRAND_GENERIC_MAP)) {
    const matches1 = equivalents.some((eq) => norm1.includes(normalizeForComparison(eq)));
    const matches2 = equivalents.some((eq) => norm2.includes(normalizeForComparison(eq)));
    if (matches1 && matches2) return true;
  }
  return false;
}

function computeRecordFingerprint(record: {
  type: string;
  title: string;
  date: Date;
  provider?: string | null;
  details?: unknown;
}): string {
  const hash = createHash("sha256");
  hash.update(`${record.type}|${record.title}|${record.date.toISOString().slice(0, 10)}|${record.provider || ""}`);
  if (record.details && typeof record.details === "object") {
    const d = record.details as Record<string, unknown>;
    if (d.loincCode) hash.update(`|loinc:${d.loincCode}`);
    if (d.cptCode) hash.update(`|cpt:${d.cptCode}`);
    if (d.value !== undefined) hash.update(`|val:${d.value}`);
  }
  return hash.digest("hex");
}

class UnifiedDuplicateFlagsService {
  private scanStatus: "idle" | "running" | "completed" | "error" = "idle";
  private lastScanAt: string | null = null;
  private schedulerHandle: ReturnType<typeof setInterval> | null = null;

  async runFullScan(): Promise<DuplicateFlag[]> {
    if (this.scanStatus === "running") {
      return [];
    }
    this.scanStatus = "running";
    const allFlags: DuplicateFlag[] = [];
    try {
      const [clinicalFlags, subscriptionFlags, regulatoryFlags] = await Promise.all([
        this.scanClinicalDuplicates(),
        this.scanSubscriptionFlags(),
        this.scanRegulatoryFlags(),
      ]);
      allFlags.push(...clinicalFlags, ...subscriptionFlags, ...regulatoryFlags);

      for (const flag of allFlags) {
        await this.persistFlag(flag);
      }

      this.scanStatus = "completed";
      this.lastScanAt = new Date().toISOString();
      console.log(`[DuplicateFlags] Full scan complete: ${allFlags.length} flags (clinical=${clinicalFlags.length}, subscription=${subscriptionFlags.length}, regulatory=${regulatoryFlags.length})`);
    } catch (error) {
      this.scanStatus = "error";
      console.error("[DuplicateFlags] Scan error:", error);
    }
    return allFlags;
  }

  async scanClinicalDuplicates(): Promise<DuplicateFlag[]> {
    const flags: DuplicateFlag[] = [];
    try {
      const lookback = new Date();
      lookback.setDate(lookback.getDate() - 30);

      const records = await db
        .select()
        .from(healthRecords)
        .where(gte(healthRecords.createdAt, lookback))
        .orderBy(desc(healthRecords.createdAt))
        .limit(2000);

      const byUser = new Map<string, typeof records>();
      for (const r of records) {
        const arr = byUser.get(r.userId) || [];
        arr.push(r);
        byUser.set(r.userId, arr);
      }

      for (const [userId, userRecords] of byUser) {
        flags.push(...this.detectIdenticalVitals(userId, userRecords));
        flags.push(...this.detectOverlappingMedications(userId, userRecords));
        flags.push(...this.detectDuplicateLabs(userId, userRecords));
      }

      flags.push(...(await this.detectRedundantAiFindings()));
    } catch (error) {
      console.error("[DuplicateFlags] Clinical scan error:", error);
    }
    return flags;
  }

  private detectIdenticalVitals(
    userId: string,
    records: Array<{ id: string; type: string; title: string; date: Date; details: unknown; provider: string | null }>
  ): DuplicateFlag[] {
    const flags: DuplicateFlag[] = [];
    const vitals = records.filter((r) =>
      r.type === "vital_signs" || r.type === "vitals" || r.type === "observation" ||
      (r.title && /blood pressure|heart rate|pulse|temperature|weight|bmi|spo2|respiratory/i.test(r.title))
    );

    const seen = new Map<string, typeof vitals[0]>();
    for (const v of vitals) {
      const d = (v.details || {}) as Record<string, unknown>;
      const key = `${v.type}|${v.title}|${v.date.toISOString()}|${d.value || ""}|${d.systolic || ""}|${d.diastolic || ""}|${v.provider || ""}`;
      const existing = seen.get(key);
      if (existing) {
        flags.push({
          alertType: "identical_vital_entries",
          severity: "medium",
          title: "Identical Vital Entry Detected",
          description: `Duplicate ${v.title || v.type} reading with identical timestamp, value, and source for patient. Record IDs: ${existing.id}, ${v.id}`,
          category: "clinical_data",
          userId,
          resourceType: "health_record",
          resourceId: v.id,
          metadata: {
            duplicateRecordId: existing.id,
            originalRecordId: v.id,
            vitalType: v.title || v.type,
            timestamp: v.date.toISOString(),
            value: d.value,
          },
        });
      } else {
        seen.set(key, v);
      }
    }
    return flags;
  }

  private detectOverlappingMedications(
    userId: string,
    records: Array<{ id: string; type: string; title: string; date: Date; details: unknown }>
  ): DuplicateFlag[] {
    const flags: DuplicateFlag[] = [];
    const meds = records.filter(
      (r) => r.type === "medication" || r.type === "medication_request" || r.type === "prescription"
    );

    for (let i = 0; i < meds.length; i++) {
      for (let j = i + 1; j < meds.length; j++) {
        const med1 = meds[i];
        const med2 = meds[j];
        const name1 = med1.title || "";
        const name2 = med2.title || "";

        if (areMedicationsEquivalent(name1, name2)) {
          const timeDiffDays = Math.abs(med1.date.getTime() - med2.date.getTime()) / (1000 * 60 * 60 * 24);
          if (timeDiffDays <= 90) {
            flags.push({
              alertType: "overlapping_medication_logs",
              severity: "high",
              title: "Overlapping Medication Prescription",
              description: `Patient prescribed "${name1}" and "${name2}" which are brand/generic equivalents, within ${Math.round(timeDiffDays)} days of each other. This may indicate therapeutic duplication.`,
              category: "clinical_data",
              userId,
              resourceType: "health_record",
              resourceId: med1.id,
              metadata: {
                medication1: { id: med1.id, name: name1, date: med1.date.toISOString() },
                medication2: { id: med2.id, name: name2, date: med2.date.toISOString() },
                daysBetween: Math.round(timeDiffDays),
              },
            });
          }
        }
      }
    }
    return flags;
  }

  private detectDuplicateLabs(
    userId: string,
    records: Array<{ id: string; type: string; title: string; date: Date; provider: string | null; details: unknown }>
  ): DuplicateFlag[] {
    const flags: DuplicateFlag[] = [];
    const labs = records.filter(
      (r) => r.type === "lab_result" || r.type === "laboratory" || r.type === "diagnostic_report"
    );

    const fingerprints = new Map<string, typeof labs[0]>();
    for (const lab of labs) {
      const fp = computeRecordFingerprint(lab);
      const existing = fingerprints.get(fp);
      if (existing) {
        flags.push({
          alertType: "duplicate_lab_results",
          severity: "medium",
          title: "Duplicate Lab Result Detected",
          description: `Lab report "${lab.title}" appears to be uploaded multiple times. Fingerprint match between records ${existing.id} and ${lab.id}. This may have come through different portals or PDF imports.`,
          category: "clinical_data",
          userId,
          resourceType: "health_record",
          resourceId: lab.id,
          metadata: {
            originalRecordId: existing.id,
            duplicateRecordId: lab.id,
            labName: lab.title,
            fingerprint: fp.slice(0, 16),
            originalSource: existing.provider || "unknown",
            duplicateSource: lab.provider || "unknown",
          },
        });
      } else {
        fingerprints.set(fp, lab);
      }
    }
    return flags;
  }

  private async detectRedundantAiFindings(): Promise<DuplicateFlag[]> {
    const flags: DuplicateFlag[] = [];
    try {
      const lookback = new Date();
      lookback.setDate(lookback.getDate() - 14);

      const aiAudits = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, "ai_clinical_audit"),
            gte(auditLogs.createdAt, lookback)
          )
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(500);

      const findingsByUser = new Map<string, Array<{ id: string; metadata: unknown; createdAt: Date }>>();
      for (const audit of aiAudits) {
        const uid = audit.userId || "system";
        const arr = findingsByUser.get(uid) || [];
        arr.push({ id: audit.id, metadata: audit.metadata, createdAt: audit.createdAt });
        findingsByUser.set(uid, arr);
      }

      for (const [userId, findings] of findingsByUser) {
        for (let i = 0; i < findings.length; i++) {
          for (let j = i + 1; j < findings.length; j++) {
            const f1 = findings[i];
            const f2 = findings[j];
            const m1 = (f1.metadata || {}) as Record<string, unknown>;
            const m2 = (f2.metadata || {}) as Record<string, unknown>;

            const findingText1 = JSON.stringify(m1.finding || m1.discrepancy || m1.issue || "");
            const findingText2 = JSON.stringify(m2.finding || m2.discrepancy || m2.issue || "");

            if (findingText1.length > 10 && findingText1 === findingText2) {
              flags.push({
                alertType: "redundant_ai_audit_findings",
                severity: "low",
                title: "Redundant AI Audit Finding",
                description: `The Clinical AI Audit identified the same discrepancy across two different versions of a synced record. Audit IDs: ${f1.id}, ${f2.id}`,
                category: "clinical_data",
                userId,
                resourceType: "audit_log",
                resourceId: f1.id,
                metadata: {
                  auditId1: f1.id,
                  auditId2: f2.id,
                  findingPreview: findingText1.slice(0, 200),
                },
              });
            }
          }
        }
      }
    } catch (error) {
      console.error("[DuplicateFlags] AI findings scan error:", error);
    }
    return flags;
  }

  async scanSubscriptionFlags(): Promise<DuplicateFlag[]> {
    const flags: DuplicateFlag[] = [];
    try {
      const allUsers = await db.select().from(users).limit(1000);

      for (const user of allUsers) {
        const meta = (user as Record<string, unknown>);
        const subscriptionTier = (meta.subscriptionTier as string) || "basic";
        const revenuecatId = (meta.revenuecatCustomerId as string) || null;
        const deviceIds = (meta.deviceIds as string[]) || [];
        const entitlements = (meta.entitlements as Record<string, unknown>) || {};

        if (
          subscriptionTier !== "basic" &&
          Object.keys(entitlements).length > 0 &&
          entitlements.free === true &&
          entitlements.pro === true
        ) {
          flags.push({
            alertType: "double_entitlement",
            severity: "high",
            title: "Double Entitlement Detected",
            description: `User account ${user.id} appears to have both Free Tier and Pro Tier entitlements active simultaneously. This may indicate a billing conflict.`,
            category: "subscription",
            userId: user.id,
            resourceType: "user",
            resourceId: user.id,
            metadata: {
              currentTier: subscriptionTier,
              entitlements,
              revenuecatCustomerId: revenuecatId,
            },
          });
        }

        const MAX_DEVICES = 5;
        if (deviceIds.length > MAX_DEVICES) {
          flags.push({
            alertType: "multi_device_abuse",
            severity: "medium",
            title: "Excessive Device Logins Detected",
            description: `User ${user.id} has ${deviceIds.length} device logins (limit: ${MAX_DEVICES}). The same account may be shared to bypass subscription limits.`,
            category: "subscription",
            userId: user.id,
            resourceType: "user",
            resourceId: user.id,
            metadata: {
              deviceCount: deviceIds.length,
              maxAllowed: MAX_DEVICES,
              revenuecatCustomerId: revenuecatId,
            },
          });
        }
      }

      const lookback = new Date();
      lookback.setDate(lookback.getDate() - 7);
      const restoreAttempts = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.action, "subscription_restore"),
            gte(auditLogs.createdAt, lookback)
          )
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(200);

      const restoresByUser = new Map<string, number>();
      for (const attempt of restoreAttempts) {
        const uid = attempt.userId || "unknown";
        restoresByUser.set(uid, (restoresByUser.get(uid) || 0) + 1);
      }

      for (const [userId, count] of restoresByUser) {
        if (count >= 3) {
          flags.push({
            alertType: "restoration_conflict",
            severity: "medium",
            title: "Subscription Restoration Conflict",
            description: `User ${userId} made ${count} restore purchase attempts in the last 7 days. This may indicate a conflict between different subscription tiers or billing issues.`,
            category: "subscription",
            userId,
            resourceType: "subscription",
            resourceId: userId,
            metadata: {
              restoreAttempts: count,
              timeWindowDays: 7,
            },
          });
        }
      }
    } catch (error) {
      console.error("[DuplicateFlags] Subscription scan error:", error);
    }
    return flags;
  }

  async scanRegulatoryFlags(): Promise<DuplicateFlag[]> {
    const flags: DuplicateFlag[] = [];
    try {
      flags.push(...(await this.detectMhmdaConsentGaps()));
      flags.push(...(await this.detectCcpaRequestAnomalies()));
      flags.push(...(await this.detectIdentityDocumentExpiry()));
      flags.push(...(await this.detectIdentityCrossRefMismatches()));
    } catch (error) {
      console.error("[DuplicateFlags] Regulatory scan error:", error);
    }
    return flags;
  }

  private async detectMhmdaConsentGaps(): Promise<DuplicateFlag[]> {
    const flags: DuplicateFlag[] = [];
    try {
      const lookback = new Date();
      lookback.setDate(lookback.getDate() - 90);

      const consentActions = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            sql`${auditLogs.action} IN ('consent_granted', 'consent_revoked', 'data_shared', 'phi_accessed')`,
            gte(auditLogs.createdAt, lookback)
          )
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(1000);

      const dataSharingByUser = new Map<string, { shared: number; consented: number }>();
      for (const log of consentActions) {
        const uid = log.userId || "unknown";
        const entry = dataSharingByUser.get(uid) || { shared: 0, consented: 0 };
        if (log.action === "data_shared" || log.action === "phi_accessed") {
          entry.shared++;
        }
        if (log.action === "consent_granted") {
          entry.consented++;
        }
        dataSharingByUser.set(uid, entry);
      }

      for (const [userId, counts] of dataSharingByUser) {
        if (counts.shared > 0 && counts.consented === 0) {
          flags.push({
            alertType: "mhmda_consent_gap",
            severity: "critical",
            title: "MHMDA Consent Gap: Data Shared Without Consent Record",
            description: `${counts.shared} data sharing events found for user ${userId} in the last 90 days with no corresponding consent record. Under MHMDA (Mental Health and Medi-Cal Data Act) and CCPA, sharing health data requires explicit, documented patient consent.`,
            category: "regulatory",
            userId,
            resourceType: "consent",
            resourceId: userId,
            metadata: {
              sharingEvents: counts.shared,
              consentRecords: counts.consented,
              complianceFrameworks: ["MHMDA", "CCPA", "HIPAA"],
              timeWindowDays: 90,
            },
          });
        }
      }
    } catch (error) {
      console.error("[DuplicateFlags] MHMDA scan error:", error);
    }
    return flags;
  }

  private async detectCcpaRequestAnomalies(): Promise<DuplicateFlag[]> {
    const flags: DuplicateFlag[] = [];
    try {
      const lookback = new Date();
      lookback.setDate(lookback.getDate() - 30);

      const dsrActions = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            sql`${auditLogs.action} IN ('ccpa_access_request', 'ccpa_deletion_request', 'ccpa_opt_out', 'data_export_request', 'right_to_erasure')`,
            gte(auditLogs.createdAt, lookback)
          )
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(500);

      const requestsByUser = new Map<string, { count: number; types: Set<string> }>();
      for (const log of dsrActions) {
        const uid = log.userId || "unknown";
        const entry = requestsByUser.get(uid) || { count: 0, types: new Set<string>() };
        entry.count++;
        entry.types.add(log.action);
        requestsByUser.set(uid, entry);
      }

      for (const [userId, data] of requestsByUser) {
        if (data.count >= 10) {
          flags.push({
            alertType: "ccpa_request_anomaly",
            severity: "high",
            title: "Unusual CCPA/DSR Request Volume",
            description: `User ${userId} submitted ${data.count} data subject requests in 30 days (types: ${[...data.types].join(", ")}). This volume is unusual and may indicate automated abuse or a compromised account.`,
            category: "regulatory",
            userId,
            resourceType: "data_subject_request",
            resourceId: userId,
            metadata: {
              requestCount: data.count,
              requestTypes: [...data.types],
              timeWindowDays: 30,
              complianceFrameworks: ["CCPA", "MHMDA"],
            },
          });
        }
      }
    } catch (error) {
      console.error("[DuplicateFlags] CCPA anomaly scan error:", error);
    }
    return flags;
  }

  private async detectIdentityDocumentExpiry(): Promise<DuplicateFlag[]> {
    const flags: DuplicateFlag[] = [];
    try {
      const identityDocs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.action, "identity_document_verified"))
        .orderBy(desc(auditLogs.createdAt))
        .limit(500);

      const now = new Date();
      const warningDays = 60;

      for (const doc of identityDocs) {
        const meta = (doc.metadata || {}) as Record<string, unknown>;
        const expiryStr = meta.expiryDate as string;
        if (expiryStr) {
          const expiry = new Date(expiryStr);
          const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilExpiry <= 0) {
            flags.push({
              alertType: "identity_document_expiry",
              severity: "high",
              title: "Expired Identity Document",
              description: `Identity document for user ${doc.userId || "unknown"} (type: ${meta.documentType || "unknown"}) expired ${Math.abs(daysUntilExpiry)} days ago. Document re-verification may be required for continued access.`,
              category: "regulatory",
              userId: doc.userId || undefined,
              resourceType: "identity_document",
              resourceId: doc.id,
              metadata: {
                documentType: meta.documentType,
                expiryDate: expiryStr,
                daysExpired: Math.abs(daysUntilExpiry),
              },
            });
          } else if (daysUntilExpiry <= warningDays) {
            flags.push({
              alertType: "identity_document_expiry",
              severity: "medium",
              title: "Identity Document Expiring Soon",
              description: `Identity document for user ${doc.userId || "unknown"} (type: ${meta.documentType || "unknown"}) expires in ${daysUntilExpiry} days. Proactive renewal recommended.`,
              category: "regulatory",
              userId: doc.userId || undefined,
              resourceType: "identity_document",
              resourceId: doc.id,
              metadata: {
                documentType: meta.documentType,
                expiryDate: expiryStr,
                daysUntilExpiry,
              },
            });
          }
        }
      }
    } catch (error) {
      console.error("[DuplicateFlags] Identity expiry scan error:", error);
    }
    return flags;
  }

  private async detectIdentityCrossRefMismatches(): Promise<DuplicateFlag[]> {
    const flags: DuplicateFlag[] = [];
    try {
      const lookback = new Date();
      lookback.setDate(lookback.getDate() - 30);

      const identityEvents = await db
        .select()
        .from(auditLogs)
        .where(
          and(
            sql`${auditLogs.action} IN ('identity_verified', 'identity_document_verified', 'identity_cross_reference')`,
            gte(auditLogs.createdAt, lookback)
          )
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(500);

      const verificationsByUser = new Map<string, Array<{ id: string; metadata: unknown; createdAt: Date }>>();
      for (const ev of identityEvents) {
        const uid = ev.userId || "unknown";
        const arr = verificationsByUser.get(uid) || [];
        arr.push({ id: ev.id, metadata: ev.metadata, createdAt: ev.createdAt });
        verificationsByUser.set(uid, arr);
      }

      for (const [userId, verifications] of verificationsByUser) {
        const names = new Set<string>();
        const dobs = new Set<string>();
        for (const v of verifications) {
          const m = (v.metadata || {}) as Record<string, unknown>;
          if (m.fullName) names.add(normalizeForComparison(m.fullName as string));
          if (m.dateOfBirth) dobs.add(m.dateOfBirth as string);
        }

        if (names.size > 1 || dobs.size > 1) {
          flags.push({
            alertType: "identity_cross_reference_mismatch",
            severity: "high",
            title: "Identity Cross-Reference Mismatch",
            description: `User ${userId} has ${names.size > 1 ? "multiple different names" : ""}${names.size > 1 && dobs.size > 1 ? " and " : ""}${dobs.size > 1 ? "multiple dates of birth" : ""} across identity verification events. This may indicate identity fraud or a data entry error requiring manual review.`,
            category: "regulatory",
            userId,
            resourceType: "identity_verification",
            resourceId: userId,
            metadata: {
              distinctNames: names.size,
              distinctDOBs: dobs.size,
              verificationCount: verifications.length,
            },
          });
        }
      }
    } catch (error) {
      console.error("[DuplicateFlags] Identity cross-ref scan error:", error);
    }
    return flags;
  }

  private async persistFlag(flag: DuplicateFlag): Promise<void> {
    try {
      const existing = await db
        .select({ id: complianceAlerts.id })
        .from(complianceAlerts)
        .where(
          and(
            eq(complianceAlerts.alertType, flag.alertType),
            eq(complianceAlerts.status, "open"),
            flag.userId ? eq(complianceAlerts.userId, flag.userId) : isNull(complianceAlerts.userId),
            flag.resourceId ? eq(complianceAlerts.resourceId, flag.resourceId) : isNull(complianceAlerts.resourceId)
          )
        )
        .limit(1);

      if (existing.length > 0) return;

      await db.insert(complianceAlerts).values({
        alertType: flag.alertType,
        severity: flag.severity,
        title: flag.title,
        description: flag.description,
        category: flag.category,
        userId: flag.userId || null,
        resourceType: flag.resourceType || null,
        resourceId: flag.resourceId || null,
        metadata: flag.metadata,
        status: "open",
      });
    } catch (error) {
      console.error(`[DuplicateFlags] Failed to persist flag ${flag.alertType}:`, error);
    }
  }

  async getSummary(userId?: string): Promise<FlagSummary> {
    const flagTypes: DuplicateFlagType[] = [
      "identical_vital_entries",
      "overlapping_medication_logs",
      "duplicate_lab_results",
      "redundant_ai_audit_findings",
      "double_entitlement",
      "multi_device_abuse",
      "restoration_conflict",
      "mhmda_consent_gap",
      "ccpa_request_anomaly",
      "identity_document_expiry",
      "identity_cross_reference_mismatch",
    ];

    const conditions = [
      sql`${complianceAlerts.alertType} IN (${sql.join(flagTypes.map((t) => sql`${t}`), sql`, `)})`,
      sql`${complianceAlerts.status} IN ('open', 'acknowledged', 'investigating')`,
    ];
    if (userId) {
      conditions.push(eq(complianceAlerts.userId, userId));
    }

    const activeFlags = await db
      .select()
      .from(complianceAlerts)
      .where(and(...conditions));

    const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byCategory: Record<string, number> = { clinical_data: 0, subscription: 0, regulatory: 0 };
    const byType: Record<string, number> = {};

    for (const flag of activeFlags) {
      bySeverity[flag.severity] = (bySeverity[flag.severity] || 0) + 1;
      byCategory[flag.category] = (byCategory[flag.category] || 0) + 1;
      byType[flag.alertType] = (byType[flag.alertType] || 0) + 1;
    }

    return {
      totalActive: activeFlags.length,
      bySeverity,
      byCategory,
      byType,
      lastScanAt: this.lastScanAt,
      scanStatus: this.scanStatus,
    };
  }

  async getFlags(options?: {
    category?: string;
    severity?: string;
    status?: string;
    limit?: number;
    userId?: string;
  }): Promise<Array<Record<string, unknown>>> {
    const flagTypes: DuplicateFlagType[] = [
      "identical_vital_entries",
      "overlapping_medication_logs",
      "duplicate_lab_results",
      "redundant_ai_audit_findings",
      "double_entitlement",
      "multi_device_abuse",
      "restoration_conflict",
      "mhmda_consent_gap",
      "ccpa_request_anomaly",
      "identity_document_expiry",
      "identity_cross_reference_mismatch",
    ];

    const conditions = [
      sql`${complianceAlerts.alertType} IN (${sql.join(flagTypes.map((t) => sql`${t}`), sql`, `)})`,
    ];

    if (options?.userId) {
      conditions.push(eq(complianceAlerts.userId, options.userId));
    }

    if (options?.category) {
      conditions.push(eq(complianceAlerts.category, options.category));
    }
    if (options?.severity) {
      conditions.push(eq(complianceAlerts.severity, options.severity));
    }
    if (options?.status) {
      conditions.push(eq(complianceAlerts.status, options.status));
    }

    const results = await db
      .select()
      .from(complianceAlerts)
      .where(and(...conditions))
      .orderBy(desc(complianceAlerts.createdAt))
      .limit(options?.limit || 100);

    return results;
  }

  async resolveFlag(flagId: string, userId: string, resolution: string): Promise<boolean> {
    try {
      await db
        .update(complianceAlerts)
        .set({
          status: "resolved",
          resolvedAt: new Date(),
          resolvedBy: userId,
          resolution,
          updatedAt: new Date(),
        })
        .where(eq(complianceAlerts.id, flagId));
      return true;
    } catch (error) {
      console.error("[DuplicateFlags] Failed to resolve flag:", error);
      return false;
    }
  }

  async dismissFlag(flagId: string, userId: string, reason: string): Promise<boolean> {
    try {
      await db
        .update(complianceAlerts)
        .set({
          status: "dismissed",
          resolvedAt: new Date(),
          resolvedBy: userId,
          resolution: `Dismissed: ${reason}`,
          updatedAt: new Date(),
        })
        .where(eq(complianceAlerts.id, flagId));
      return true;
    } catch (error) {
      console.error("[DuplicateFlags] Failed to dismiss flag:", error);
      return false;
    }
  }

  startScheduler(intervalMs: number = 6 * 60 * 60 * 1000): void {
    if (this.schedulerHandle) return;
    console.log(`[DuplicateFlags] Scheduler started (interval=${intervalMs / 1000}s)`);
    this.schedulerHandle = setInterval(async () => {
      await this.runFullScan();
    }, intervalMs);
  }

  stopScheduler(): void {
    if (this.schedulerHandle) {
      clearInterval(this.schedulerHandle);
      this.schedulerHandle = null;
    }
  }
}

export const unifiedDuplicateFlagsService = new UnifiedDuplicateFlagsService();
