import { db } from "./db";
import {
  patientProfiles,
  patientIdentifiers,
  duplicateCandidates,
  patientMergeHistory,
  mpiMatchRules,
  deduplicationRuns,
  auditLogs,
  users,
  type PatientProfile,
  type InsertDuplicateCandidate,
  type InsertPatientMergeHistory,
} from "@shared/schema";
import { eq, and, or, ne, sql, desc, asc, isNull, inArray } from "drizzle-orm";
import { transferPatientClinicalRecords } from "./patient-merge-records";

interface MatchResult {
  patientId: string;
  score: number;
  matchType: "deterministic" | "probabilistic";
  matchedFields: Record<string, number>;
}

interface DeduplicationResult {
  autoMerged: number;
  flaggedForReview: number;
  newRecords: number;
  errors: string[];
}

interface FieldMatchConfig {
  field: string;
  weight: number;
  algorithm: "exact" | "levenshtein" | "phonetic" | "date";
  threshold: number;
}

// Default scoring config aligned with USCDI v6 demographic data elements.
// Name fields use "phonetic" (Soundex-based) rather than raw Levenshtein so that
// common spelling variants, transliterations, and diacritic differences (García /
// Garcia, Nguyen / Nguyen, Müller / Muller) score as near-matches instead of
// misses. DOB and identifiers remain exact/date for deterministic-tier quality.
const DEFAULT_MATCH_CONFIG: FieldMatchConfig[] = [
  { field: "firstName", weight: 0.20, algorithm: "phonetic",    threshold: 0.85 },
  { field: "lastName",  weight: 0.25, algorithm: "phonetic",    threshold: 0.85 },
  { field: "middleName",weight: 0.10, algorithm: "phonetic",    threshold: 0.80 },
  { field: "dateOfBirth",weight:0.25, algorithm: "date",        threshold: 1.0  },
  { field: "email",     weight: 0.15, algorithm: "exact",       threshold: 1.0  },
  { field: "phone",     weight: 0.05, algorithm: "exact",       threshold: 1.0  },
];

export class DeduplicationService {
  private static instance: DeduplicationService;

  static getInstance(): DeduplicationService {
    if (!DeduplicationService.instance) {
      DeduplicationService.instance = new DeduplicationService();
    }
    return DeduplicationService.instance;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * Returns the number of single-character edits needed to transform a into b
   */
  private levenshteinDistance(a: string, b: string): number {
    if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);
    
    const aLower = a.toLowerCase().trim();
    const bLower = b.toLowerCase().trim();
    
    if (aLower === bLower) return 0;
    if (aLower.length === 0) return bLower.length;
    if (bLower.length === 0) return aLower.length;

    const matrix: number[][] = [];

    for (let i = 0; i <= bLower.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= aLower.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= bLower.length; i++) {
      for (let j = 1; j <= aLower.length; j++) {
        if (bLower.charAt(i - 1) === aLower.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[bLower.length][aLower.length];
  }

  /**
   * Calculate normalized similarity score using Levenshtein distance
   * S = (1 - L(a,b) / max(len(a), len(b))) * 100
   */
  calculateSimilarity(a: string, b: string): number {
    if (!a && !b) return 1.0;
    if (!a || !b) return 0;
    
    const distance = this.levenshteinDistance(a, b);
    const maxLen = Math.max(a.length, b.length);
    
    if (maxLen === 0) return 1.0;
    
    return 1 - (distance / maxLen);
  }

  /**
   * Exact match comparison
   */
  private exactMatch(a: string | null | undefined, b: string | null | undefined): number {
    if (!a && !b) return 1.0;
    if (!a || !b) return 0;
    return a.toLowerCase().trim() === b.toLowerCase().trim() ? 1.0 : 0;
  }

  /**
   * Date match comparison - compares date portions only
   */
  private dateMatch(a: Date | string | null | undefined, b: Date | string | null | undefined): number {
    if (!a && !b) return 1.0;
    if (!a || !b) return 0;
    
    const dateA = new Date(a);
    const dateB = new Date(b);
    
    if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
    
    return dateA.toISOString().split('T')[0] === dateB.toISOString().split('T')[0] ? 1.0 : 0;
  }

  /**
   * Soundex phonetic encoding (American Soundex, NIST standard).
   * Maps a name to a 4-character code (letter + 3 digits) so that names
   * with similar pronunciation share the same code regardless of spelling
   * variation (e.g. "Smith" and "Smyth" → S530; "García" and "Garcia" → G620).
   *
   * The algorithm is locale-aware: it strips diacritics via Unicode
   * normalization before encoding, making it suitable for the multilingual
   * name corpus this app handles (50+ languages, per replit.md).
   */
  private soundex(name: string): string {
    if (!name || name.trim().length === 0) return "0000";

    // Normalize: strip diacritics, lowercase, keep only ASCII letters
    const normalized = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");

    if (normalized.length === 0) return "0000";

    const TABLE: Record<string, string> = {
      b: "1", f: "1", p: "1", v: "1",
      c: "2", g: "2", j: "2", k: "2", q: "2", s: "2", x: "2", z: "2",
      d: "3", t: "3",
      l: "4",
      m: "5", n: "5",
      r: "6",
    };

    const first = normalized[0].toUpperCase();
    let code = first;
    let prev = TABLE[normalized[0]] ?? "0";

    for (let i = 1; i < normalized.length && code.length < 4; i++) {
      const ch = normalized[i];
      const digit = TABLE[ch] ?? "0";
      if (digit !== "0" && digit !== prev) {
        code += digit;
      }
      prev = digit;
    }

    return code.padEnd(4, "0");
  }

  /**
   * Phonetic similarity: 1.0 if both values share a Soundex code,
   * with a Levenshtein fallback weighted at 0.5 for near-misses.
   * This is stricter than pure Levenshtein for names — "Garcia" and
   * "Garsia" would phonetically match but "Garcia" and "Baker" would not.
   */
  private phoneticMatch(a: string, b: string): number {
    if (!a && !b) return 1.0;
    if (!a || !b) return 0;

    const sa = this.soundex(a);
    const sb = this.soundex(b);

    if (sa === sb) return 1.0;

    // Partial credit: first letter matches AND codes differ by only 1 digit
    if (sa[0] === sb[0]) {
      const digitDiffs = Array.from(sa.slice(1)).filter(
        (c, i) => c !== sb[i + 1]
      ).length;
      if (digitDiffs <= 1) return 0.85;
    }

    // Levenshtein fallback with reduced weight
    return this.calculateSimilarity(a, b) * 0.5;
  }

  /**
   * Calculate field similarity based on algorithm type
   */
  private calculateFieldSimilarity(
    value1: unknown,
    value2: unknown,
    algorithm: "exact" | "levenshtein" | "phonetic" | "date"
  ): number {
    switch (algorithm) {
      case "exact":
        return this.exactMatch(value1 as string, value2 as string);
      case "levenshtein":
        return this.calculateSimilarity(String(value1 || ""), String(value2 || ""));
      case "date":
        return this.dateMatch(value1 as Date, value2 as Date);
      case "phonetic":
        return this.phoneticMatch(String(value1 || ""), String(value2 || ""));
      default:
        return 0;
    }
  }

  /**
   * PASS 1: Deterministic Matching
   * Check for exact matches on high-confidence identifiers
   */
  async findDeterministicMatches(patientData: {
    email?: string | null;
    dateOfBirth?: Date | string | null;
    identifiers?: { type: string; value: string }[];
  }): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];

    // Check identifier matches (SSN last 4, MRN, State ID)
    if (patientData.identifiers && patientData.identifiers.length > 0) {
      for (const identifier of patientData.identifiers) {
        const identifierMatches = await db
          .select({
            patientId: patientIdentifiers.patientId,
          })
          .from(patientIdentifiers)
          .where(
            and(
              eq(patientIdentifiers.identifierType, identifier.type),
              eq(patientIdentifiers.identifierValue, identifier.value),
              eq(patientIdentifiers.isActive, true)
            )
          );

        for (const match of identifierMatches) {
          matches.push({
            patientId: match.patientId,
            score: 1.0,
            matchType: "deterministic",
            matchedFields: { [identifier.type]: 1.0 },
          });
        }
      }
    }

    // Check Email + DOB match
    if (patientData.email && patientData.dateOfBirth) {
      const emailDobMatches = await db
        .select()
        .from(patientProfiles)
        .where(
          and(
            eq(sql`LOWER(${patientProfiles.email})`, patientData.email.toLowerCase()),
            sql`DATE(${patientProfiles.dateOfBirth}) = DATE(${new Date(patientData.dateOfBirth).toISOString()})`
          )
        );

      for (const match of emailDobMatches) {
        if (!matches.some(m => m.patientId === match.id)) {
          matches.push({
            patientId: match.id,
            score: 1.0,
            matchType: "deterministic",
            matchedFields: { email: 1.0, dateOfBirth: 1.0 },
          });
        }
      }
    }

    return matches;
  }

  /**
   * PASS 2: Probabilistic Matching using Levenshtein Distance
   * Calculate weighted similarity scores across multiple fields
   */
  async findProbabilisticMatches(
    patientData: Partial<PatientProfile>,
    excludePatientIds: string[] = [],
    config: FieldMatchConfig[] = DEFAULT_MATCH_CONFIG
  ): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];

    // Get all existing patients to compare against
    const existingPatients = excludePatientIds.length > 0
      ? await db.select().from(patientProfiles).where(sql`${patientProfiles.id} NOT IN (${sql.join(excludePatientIds.map(id => sql`${id}`), sql`, `)})`)
      : await db.select().from(patientProfiles);

    for (const existingPatient of existingPatients) {
      let totalWeight = 0;
      let weightedScore = 0;
      const matchedFields: Record<string, number> = {};

      for (const fieldConfig of config) {
        const newValue = patientData[fieldConfig.field as keyof PatientProfile];
        const existingValue = existingPatient[fieldConfig.field as keyof PatientProfile];

        // Skip if both values are empty/null
        if (!newValue && !existingValue) continue;

        // Handle NMN (No Middle Name) logic
        if (fieldConfig.field === "middleName") {
          const newNmnStatus = patientData.middleNameStatus;
          const existingNmnStatus = existingPatient.middleNameStatus;

          // If both have NMN status set to no_middle_name, consider it a match
          if (newNmnStatus === "no_middle_name" && existingNmnStatus === "no_middle_name") {
            matchedFields[fieldConfig.field] = 1.0;
            weightedScore += fieldConfig.weight * 1.0;
            totalWeight += fieldConfig.weight;
            continue;
          }

          // If one is NMN and other has a value, it might still be same person
          if (
            (newNmnStatus === "no_middle_name" && !existingValue) ||
            (existingNmnStatus === "no_middle_name" && !newValue)
          ) {
            matchedFields[fieldConfig.field] = 0.9;
            weightedScore += fieldConfig.weight * 0.9;
            totalWeight += fieldConfig.weight;
            continue;
          }
        }

        const similarity = this.calculateFieldSimilarity(
          newValue,
          existingValue,
          fieldConfig.algorithm
        );

        if (similarity >= fieldConfig.threshold || similarity > 0.5) {
          matchedFields[fieldConfig.field] = similarity;
          weightedScore += fieldConfig.weight * similarity;
          totalWeight += fieldConfig.weight;
        }
      }

      if (totalWeight > 0) {
        const normalizedScore = weightedScore / totalWeight;

        // Only include matches above 80% threshold
        if (normalizedScore >= 0.8) {
          matches.push({
            patientId: existingPatient.id,
            score: normalizedScore,
            matchType: "probabilistic",
            matchedFields,
          });
        }
      }
    }

    // Sort by score descending
    return matches.sort((a, b) => b.score - a.score);
  }

  /**
   * Main deduplication check - combines both passes
   * Returns match action: auto_merge, flag_for_review, or create_new
   */
  async checkForDuplicates(
    patientData: Partial<PatientProfile> & {
      identifiers?: { type: string; value: string }[];
    },
    excludePatientIds: string[] = []
  ): Promise<{
    action: "auto_merge" | "flag_for_review" | "create_new";
    matches: MatchResult[];
    bestMatch?: MatchResult;
  }> {
    // Existing profiles must never match themselves or records already handled
    // by a batch scan. Apply the same exclusions to both matching passes.
    const excludedIds = [...new Set([
      ...excludePatientIds,
      ...(patientData.id ? [patientData.id] : []),
    ])];
    // Pass 1: Deterministic matching
    const deterministicMatches = (await this.findDeterministicMatches({
      email: patientData.email,
      dateOfBirth: patientData.dateOfBirth,
      identifiers: patientData.identifiers,
    })).filter(match => !excludedIds.includes(match.patientId));

    if (deterministicMatches.length > 0) {
      return {
        action: "auto_merge",
        matches: deterministicMatches,
        bestMatch: deterministicMatches[0],
      };
    }

    // Pass 2: Probabilistic matching
    const probabilisticMatches = await this.findProbabilisticMatches(
      patientData,
      excludedIds
    );

    if (probabilisticMatches.length === 0) {
      return {
        action: "create_new",
        matches: [],
      };
    }

    const bestMatch = probabilisticMatches[0];

    // >= 95% = Auto-merge
    if (bestMatch.score >= 0.95) {
      return {
        action: "auto_merge",
        matches: probabilisticMatches,
        bestMatch,
      };
    }

    // 80-95% = Flag for review
    if (bestMatch.score >= 0.80) {
      return {
        action: "flag_for_review",
        matches: probabilisticMatches,
        bestMatch,
      };
    }

    // < 80% = New record
    return {
      action: "create_new",
      matches: probabilisticMatches,
    };
  }

  /**
   * Create a duplicate candidate record for manual review
   */
  async flagForReview(
    primaryPatientId: string,
    duplicatePatientId: string,
    score: number,
    matchedFields: Record<string, number>,
    sourceSystem?: string
  ): Promise<void> {
    // Check if already flagged
    const existing = await db
      .select()
      .from(duplicateCandidates)
      .where(
        and(
          or(
            and(
              eq(duplicateCandidates.primaryPatientId, primaryPatientId),
              eq(duplicateCandidates.duplicatePatientId, duplicatePatientId)
            ),
            and(
              eq(duplicateCandidates.primaryPatientId, duplicatePatientId),
              eq(duplicateCandidates.duplicatePatientId, primaryPatientId)
            )
          ),
          eq(duplicateCandidates.status, "pending")
        )
      );

    if (existing.length > 0) return;

    await db.insert(duplicateCandidates).values({
      primaryPatientId,
      duplicatePatientId,
      similarityScore: score,
      matchType: "probabilistic",
      matchedFields,
      status: "pending",
      autoMergeEligible: score >= 0.95,
      sourceSystem,
    });
  }

  /**
   * Merge two patient records
   * The survivor record keeps the most complete data
   */
  async mergePatients(
    survivorId: string,
    mergedId: string,
    userId?: string,
    mergeType: "auto_merge" | "manual_merge" = "manual_merge",
    score?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (survivorId === mergedId) {
        return { success: false, error: "Cannot merge a patient into itself" };
      }
      return await db.transaction(async tx => {
      // Stable lock ordering serializes overlapping merges without deadlocks.
      const profiles = await tx.select().from(patientProfiles)
        .where(inArray(patientProfiles.id, [survivorId, mergedId]))
        .orderBy(asc(patientProfiles.id)).for("update");
      const survivor = profiles.find(profile => profile.id === survivorId);
      const merged = profiles.find(profile => profile.id === mergedId);

      if (!survivor || !merged) {
        return { success: false, error: "One or both patient records not found" };
      }

      const previousMerges = await tx.select({ id: patientMergeHistory.id })
        .from(patientMergeHistory).where(and(
          inArray(patientMergeHistory.mergedPatientId, [survivorId, mergedId]),
          eq(patientMergeHistory.isUndone, false),
        ));
      if (previousMerges.length) {
        return { success: false, error: "Patient already merged; use the surviving patient record" };
      }

      // Clinical FKs point at users, not patient_profiles. Block concurrent FK
      // inserts during the ownership change; never modify either login account.
      await tx.select({ id: users.id }).from(users)
        .where(inArray(users.id, [survivor.userId, merged.userId]))
        .orderBy(asc(users.id)).for("update");

      // Snapshot merged data for audit
      const clinicalTransfer = await transferPatientClinicalRecords(
        tx, merged.userId, survivor.userId,
      );
      const mergedDataSnapshot = { ...merged, clinicalTransfer };

      // Determine field resolutions - prefer non-null values
      const fieldResolutions: Record<string, { survivor: unknown; merged: unknown; chosen: string }> = {};
      const updatedFields: Partial<PatientProfile> = {};

      const fieldsToMerge = [
        "firstName", "lastName", "middleName", "middleNameStatus", "dateOfBirth",
        "gender", "phone", "mobilePhone", "email", "addressLine1", "addressLine2",
        "city", "state", "zipCode", "bloodType", "primaryPhysician"
      ];

      for (const field of fieldsToMerge) {
        const survivorValue = survivor[field as keyof PatientProfile];
        const mergedValue = merged[field as keyof PatientProfile];

        if (!survivorValue && mergedValue) {
          updatedFields[field as keyof PatientProfile] = mergedValue as never;
          fieldResolutions[field] = {
            survivor: survivorValue,
            merged: mergedValue,
            chosen: "merged"
          };
        } else if (survivorValue) {
          fieldResolutions[field] = {
            survivor: survivorValue,
            merged: mergedValue,
            chosen: "survivor"
          };
        }
      }

      // Update survivor with merged data
      if (Object.keys(updatedFields).length > 0) {
        await tx
          .update(patientProfiles)
          .set({ ...updatedFields, updatedAt: new Date() })
          .where(eq(patientProfiles.id, survivorId));
      }

      // Transfer identifiers from merged to survivor
      const movedIdentifiers = await tx
        .update(patientIdentifiers)
        .set({ patientId: survivorId, updatedAt: new Date() })
        .where(eq(patientIdentifiers.patientId, mergedId))
        .returning({ id: patientIdentifiers.id });

      // Create merge history record
      await tx.insert(patientMergeHistory).values({
        survivorPatientId: survivorId,
        mergedPatientId: mergedId,
        mergeType,
        similarityScore: score,
        matchDetails: {
          mergedFrom: mergedId, mergedTo: survivorId,
          transferredIdentifierIds: movedIdentifiers.map(row => row.id),
        },
        mergedData: mergedDataSnapshot,
        fieldResolutions,
        mergedBy: userId,
      });

      // Update any duplicate candidates
      await tx
        .update(duplicateCandidates)
        .set({
          status: mergeType === "auto_merge" ? "auto_merged" : "confirmed_duplicate",
          reviewedBy: userId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          or(
            and(
              eq(duplicateCandidates.primaryPatientId, survivorId),
              eq(duplicateCandidates.duplicatePatientId, mergedId)
            ),
            and(
              eq(duplicateCandidates.primaryPatientId, mergedId),
              eq(duplicateCandidates.duplicatePatientId, survivorId)
            )
          )
        );

      // Create audit log
      await tx.insert(auditLogs).values({
        userId: userId || null,
        action: "patient_merge",
        resourceType: "patient_profile",
        resourceId: survivorId,
        metadata: {
          survivorId,
          mergedId,
          mergeType,
          score,
          fieldResolutions,
          clinicalTransferCounts: Object.fromEntries(
            Object.entries(clinicalTransfer.tables).map(([table, transfer]) => [table, transfer.rowIds.length]),
          ),
        },
        ipAddress: "system",
        userAgent: "deduplication-service",
      });

      return { success: true };
      });
    } catch (error) {
      // Drizzle errors include bound SQL parameters (the demographic snapshot).
      // Never send that PHI to logs or to callers on a failed merge.
      const code = (error as { cause?: { code?: string } })?.cause?.code;
      console.error("Patient merge transaction failed", {
        code: typeof code === "string" && /^[A-Z0-9]{5}$/.test(code) ? code : "unknown",
      });
      return { success: false, error: "Patient merge failed; no changes were saved" };
    }
  }

  /**
   * Resolve a duplicate candidate - confirm as duplicate or unique
   */
  async resolveDuplicate(
    candidateId: string,
    resolution: "confirmed_duplicate" | "confirmed_unique",
    reviewerId: string,
    notes?: string,
    mergeIfDuplicate: boolean = true
  ): Promise<{ success: boolean; error?: string }> {
    const candidate = await db
      .select()
      .from(duplicateCandidates)
      .where(eq(duplicateCandidates.id, candidateId))
      .then(r => r[0]);

    if (!candidate) {
      return { success: false, error: "Candidate not found" };
    }

    if (resolution === "confirmed_duplicate" && mergeIfDuplicate) {
      const mergeResult = await this.mergePatients(
        candidate.primaryPatientId,
        candidate.duplicatePatientId,
        reviewerId,
        "manual_merge",
        candidate.similarityScore
      );

      if (!mergeResult.success) {
        return mergeResult;
      }
    }

    await db
      .update(duplicateCandidates)
      .set({
        status: resolution,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(duplicateCandidates.id, candidateId));

    return { success: true };
  }

  /**
   * Get pending duplicate candidates for review
   */
  async getPendingDuplicates(limit: number = 50): Promise<{
    id: string;
    primaryPatient: PatientProfile;
    duplicatePatient: PatientProfile;
    similarityScore: number;
    matchedFields: Record<string, number>;
    autoMergeEligible: boolean;
    createdAt: Date;
  }[]> {
    const candidates = await db
      .select()
      .from(duplicateCandidates)
      .where(eq(duplicateCandidates.status, "pending"))
      .orderBy(desc(duplicateCandidates.similarityScore))
      .limit(limit);

    const results = [];

    for (const candidate of candidates) {
      const [primary, duplicate] = await Promise.all([
        db.select().from(patientProfiles).where(eq(patientProfiles.id, candidate.primaryPatientId)).then(r => r[0]),
        db.select().from(patientProfiles).where(eq(patientProfiles.id, candidate.duplicatePatientId)).then(r => r[0]),
      ]);

      if (primary && duplicate) {
        results.push({
          id: candidate.id,
          primaryPatient: primary,
          duplicatePatient: duplicate,
          similarityScore: candidate.similarityScore,
          matchedFields: candidate.matchedFields as Record<string, number>,
          autoMergeEligible: candidate.autoMergeEligible || false,
          createdAt: candidate.createdAt,
        });
      }
    }

    return results;
  }

  /**
   * Get deduplication statistics
   */
  async getDeduplicationStats(): Promise<{
    totalPatients: number;
    pendingDuplicates: number;
    autoMerged: number;
    manuallyResolved: number;
    confirmedUnique: number;
  }> {
    const [totalPatients] = await db
      .select({ count: sql<number>`count(*)` })
      .from(patientProfiles);

    const [pendingDuplicates] = await db
      .select({ count: sql<number>`count(*)` })
      .from(duplicateCandidates)
      .where(eq(duplicateCandidates.status, "pending"));

    const [autoMerged] = await db
      .select({ count: sql<number>`count(*)` })
      .from(duplicateCandidates)
      .where(eq(duplicateCandidates.status, "auto_merged"));

    const [manuallyResolved] = await db
      .select({ count: sql<number>`count(*)` })
      .from(duplicateCandidates)
      .where(eq(duplicateCandidates.status, "confirmed_duplicate"));

    const [confirmedUnique] = await db
      .select({ count: sql<number>`count(*)` })
      .from(duplicateCandidates)
      .where(eq(duplicateCandidates.status, "confirmed_unique"));

    return {
      totalPatients: Number(totalPatients?.count || 0),
      pendingDuplicates: Number(pendingDuplicates?.count || 0),
      autoMerged: Number(autoMerged?.count || 0),
      manuallyResolved: Number(manuallyResolved?.count || 0),
      confirmedUnique: Number(confirmedUnique?.count || 0),
    };
  }

  /**
   * Run a full deduplication scan across all patients
   */
  async runFullScan(triggeredBy?: string): Promise<DeduplicationResult> {
    const result: DeduplicationResult = {
      autoMerged: 0,
      flaggedForReview: 0,
      newRecords: 0,
      errors: [],
    };

    // Create run record
    const [run] = await db.insert(deduplicationRuns).values({
      runType: "full_scan",
      status: "running",
      triggeredBy,
      configuration: { matchConfig: DEFAULT_MATCH_CONFIG },
    }).returning();

    try {
      const patients = await db.select().from(patientProfiles).orderBy(asc(patientProfiles.createdAt));
      const processedIds: string[] = [];

      for (const patient of patients) {
        if (processedIds.includes(patient.id)) continue;

        const { action, matches, bestMatch } = await this.checkForDuplicates(
          patient,
          processedIds
        );

        if (action === "auto_merge" && bestMatch) {
          const mergeResult = await this.mergePatients(
            bestMatch.patientId,
            patient.id,
            triggeredBy,
            "auto_merge",
            bestMatch.score
          );

          if (mergeResult.success) {
            result.autoMerged++;
            processedIds.push(patient.id);
          } else {
            result.errors.push(`Failed to merge ${patient.id}: ${mergeResult.error}`);
          }
        } else if (action === "flag_for_review" && bestMatch) {
          await this.flagForReview(
            bestMatch.patientId,
            patient.id,
            bestMatch.score,
            bestMatch.matchedFields,
            "full_scan"
          );
          result.flaggedForReview++;
        } else {
          result.newRecords++;
        }

        processedIds.push(patient.id);
      }

      // Update run record
      await db
        .update(deduplicationRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
          totalRecordsScanned: patients.length,
          duplicatesFound: result.autoMerged + result.flaggedForReview,
          autoMerged: result.autoMerged,
          flaggedForReview: result.flaggedForReview,
          errors: result.errors.length,
          errorDetails: result.errors.length > 0 ? { errors: result.errors } : null,
        })
        .where(eq(deduplicationRuns.id, run.id));

    } catch (error) {
      await db
        .update(deduplicationRuns)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorDetails: { error: String(error) },
        })
        .where(eq(deduplicationRuns.id, run.id));

      result.errors.push(String(error));
    }

    return result;
  }

  /**
   * Validate NMN (No Middle Name) status
   * Returns prompt message if validation needed
   */
  validateMiddleName(middleName: string | null | undefined): {
    needsValidation: boolean;
    message?: string;
    suggestedStatus: "has_middle_name" | "no_middle_name" | "unknown";
  } {
    if (middleName && middleName.trim().length > 0) {
      return {
        needsValidation: false,
        suggestedStatus: "has_middle_name",
      };
    }

    return {
      needsValidation: true,
      message: "Does this patient have a middle name?",
      suggestedStatus: "unknown",
    };
  }

  /**
   * Add a patient identifier
   */
  async addIdentifier(
    patientId: string,
    identifierType: string,
    identifierValue: string,
    issuingAuthority?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check for existing identifier
      const existing = await db
        .select()
        .from(patientIdentifiers)
        .where(
          and(
            eq(patientIdentifiers.identifierType, identifierType),
            eq(patientIdentifiers.identifierValue, identifierValue),
            eq(patientIdentifiers.isActive, true)
          )
        );

      if (existing.length > 0) {
        if (existing[0].patientId !== patientId) {
          return { 
            success: false, 
            error: `This ${identifierType} is already associated with another patient` 
          };
        }
        return { success: true };
      }

      await db.insert(patientIdentifiers).values({
        patientId,
        identifierType,
        identifierValue,
        issuingAuthority,
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * Get patient identifiers
   */
  async getPatientIdentifiers(patientId: string) {
    return db
      .select()
      .from(patientIdentifiers)
      .where(
        and(
          eq(patientIdentifiers.patientId, patientId),
          eq(patientIdentifiers.isActive, true)
        )
      );
  }

  /**
   * Get merge history for a patient
   */
  async getMergeHistory(patientId: string) {
    return db
      .select()
      .from(patientMergeHistory)
      .where(eq(patientMergeHistory.survivorPatientId, patientId))
      .orderBy(desc(patientMergeHistory.createdAt));
  }
}

export const deduplicationService = DeduplicationService.getInstance();
