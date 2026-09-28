import { patientIdentityTable, matchCandidatesTable, mergeHistoryTable } from "@shared/schema";
import { eq, and, ne, sql, count } from "drizzle-orm";
import { deduplicationEngineService } from "./deduplication-engine-service";
import { phiDb, encryptPhiRow, decryptPhiRows } from "../storage/phi-storage";

// F1 NOTE — see the file-top NOTE in deduplication-engine-service.ts for the
// full explanation. Short version: patientIdentityTable's dateOfBirth is
// encrypted with a random IV per F1, so the `eq(dateOfBirth, ...)` filter
// below cannot match another row with the same plaintext DOB — a
// pre-existing, tracked limitation (Action Item H+1), not introduced or
// fixed by this wrapper migration. The query shape is preserved as-is.

interface BatchDedupResult {
  totalRecords: number;
  duplicatesFound: number;
  autoMerged: number;
  flaggedForReview: number;
  errors: number;
  startedAt: string;
  completedAt: string;
  details: Array<{
    sourceId: string;
    matchedId: string;
    score: number;
    action: string;
  }>;
}

interface DedupStats {
  totalPatients: number;
  uniqueRecords: number;
  autoMerged: number;
  pendingReview: number;
  manuallyMerged: number;
  splitRecords: number;
  pendingMatches: number;
  mergeHistory: number;
}

class DatabaseDedupService {
  private static instance: DatabaseDedupService;
  private isRunning = false;

  private constructor() {
    console.log("[DatabaseDedup] Service initialized");
  }

  static getInstance(): DatabaseDedupService {
    if (!DatabaseDedupService.instance) {
      DatabaseDedupService.instance = new DatabaseDedupService();
    }
    return DatabaseDedupService.instance;
  }

  async getStats(): Promise<DedupStats> {
    const [totalResult] = await phiDb.select({ count: count() }).from(patientIdentityTable);
    const [uniqueResult] = await phiDb.select({ count: count() }).from(patientIdentityTable).where(eq(patientIdentityTable.matchStatus, "unique"));
    const [autoMergedResult] = await phiDb.select({ count: count() }).from(patientIdentityTable).where(eq(patientIdentityTable.matchStatus, "auto_merged"));
    const [pendingResult] = await phiDb.select({ count: count() }).from(patientIdentityTable).where(eq(patientIdentityTable.matchStatus, "pending_review"));
    const [manualResult] = await phiDb.select({ count: count() }).from(patientIdentityTable).where(eq(patientIdentityTable.matchStatus, "manually_merged"));
    const [splitResult] = await phiDb.select({ count: count() }).from(patientIdentityTable).where(eq(patientIdentityTable.matchStatus, "split"));
    const [pendingMatchResult] = await phiDb.select({ count: count() }).from(matchCandidatesTable).where(eq(matchCandidatesTable.status, "pending"));
    const [mergeHistoryResult] = await phiDb.select({ count: count() }).from(mergeHistoryTable);

    return {
      totalPatients: totalResult.count,
      uniqueRecords: uniqueResult.count,
      autoMerged: autoMergedResult.count,
      pendingReview: pendingResult.count,
      manuallyMerged: manualResult.count,
      splitRecords: splitResult.count,
      pendingMatches: pendingMatchResult.count,
      mergeHistory: mergeHistoryResult.count,
    };
  }

  async runBatchDeduplication(): Promise<BatchDedupResult> {
    if (this.isRunning) {
      throw new Error("Batch deduplication is already running");
    }

    this.isRunning = true;
    const startedAt = new Date().toISOString();
    const result: BatchDedupResult = {
      totalRecords: 0,
      duplicatesFound: 0,
      autoMerged: 0,
      flaggedForReview: 0,
      errors: 0,
      startedAt,
      completedAt: "",
      details: [],
    };

    try {
      console.log("[DatabaseDedup] Starting batch deduplication scan...");

      const allRecords = decryptPhiRows("patientIdentityTable", await phiDb
        .select()
        .from(patientIdentityTable)
        .where(eq(patientIdentityTable.matchStatus, "unique")));

      result.totalRecords = allRecords.length;
      console.log(`[DatabaseDedup] Scanning ${allRecords.length} unique records for duplicates`);

      for (let i = 0; i < allRecords.length; i++) {
        const record = allRecords[i];
        try {
          const otherRecords = decryptPhiRows("patientIdentityTable", await phiDb
            .select()
            .from(patientIdentityTable)
            .where(
              and(
                ne(patientIdentityTable.id, record.id),
                eq(patientIdentityTable.matchStatus, "unique"),
                eq(patientIdentityTable.dateOfBirth, record.dateOfBirth)
              )
            ));

          for (const candidate of otherRecords) {
            const existingMatch = await phiDb
              .select()
              .from(matchCandidatesTable)
              .where(
                and(
                  eq(matchCandidatesTable.sourcePatientId, record.id),
                  eq(matchCandidatesTable.candidatePatientId, candidate.id)
                )
              )
              .limit(1);

            if (existingMatch.length > 0) continue;

            const reverseMatch = await phiDb
              .select()
              .from(matchCandidatesTable)
              .where(
                and(
                  eq(matchCandidatesTable.sourcePatientId, candidate.id),
                  eq(matchCandidatesTable.candidatePatientId, record.id)
                )
              )
              .limit(1);

            if (reverseMatch.length > 0) continue;

            const score = this.calculateMatchScore(record, candidate);

            if (score >= 80) {
              result.duplicatesFound++;
              const action = score >= 95 ? "auto_merge" : "flag_for_review";

              await phiDb.insert(matchCandidatesTable).values(encryptPhiRow("matchCandidatesTable", {
                sourcePatientId: record.id,
                candidatePatientId: candidate.id,
                similarityScore: score,
                matchType: "probabilistic",
                matchDetails: {
                  firstNameScore: this.similarity(record.firstName, candidate.firstName),
                  lastNameScore: this.similarity(record.lastName, candidate.lastName),
                  dobMatch: record.dateOfBirth === candidate.dateOfBirth,
                  emailMatch: !!(record.email && candidate.email && record.email.toLowerCase() === candidate.email.toLowerCase()),
                  ssnMatch: !!(record.ssnLast4 && candidate.ssnLast4 && record.ssnLast4 === candidate.ssnLast4),
                  addressScore: this.similarity(record.addressLine1 || "", candidate.addressLine1 || ""),
                  phoneMatch: record.phoneNumber === candidate.phoneNumber,
                },
                status: action === "auto_merge" ? "auto_merged" : "pending",
              }));

              if (action === "auto_merge") {
                result.autoMerged++;
                await this.performAutoMerge(record.id, candidate.id, score);
              } else {
                result.flaggedForReview++;
              }

              result.details.push({
                sourceId: record.id,
                matchedId: candidate.id,
                score,
                action,
              });

              // PHI-safe: log record ids only, never patient names.
              console.log(`[DatabaseDedup] ${action}: ${record.id} <-> ${candidate.id} (${score}%)`);
            }
          }
        } catch (err: any) {
          result.errors++;
          console.error(`[DatabaseDedup] Error processing record ${record.id}:`, err.message);
        }
      }

      result.completedAt = new Date().toISOString();
      console.log(`[DatabaseDedup] Batch complete: ${result.duplicatesFound} duplicates found, ${result.autoMerged} auto-merged, ${result.flaggedForReview} flagged`);
      console.log(`[HIPAA-AUDIT][DatabaseDedup] Batch deduplication completed: total=${result.totalRecords}, duplicates=${result.duplicatesFound}`);

      return result;
    } finally {
      this.isRunning = false;
    }
  }

  private async performAutoMerge(survivingId: string, retiredId: string, score: number): Promise<void> {
    // Read the raw (still-encrypted) retired row so premergeData snapshots
    // CIPHERTEXT, not plaintext — same defense-in-depth reasoning as
    // deduplication-engine-service.ts's recordMerge(): encryptPhiRow below
    // wraps the whole snapshot as a second {__enc} envelope.
    const [retired] = await phiDb
      .select()
      .from(patientIdentityTable)
      .where(eq(patientIdentityTable.id, retiredId))
      .limit(1);

    if (!retired) return;

    await phiDb.insert(mergeHistoryTable).values(encryptPhiRow("mergeHistoryTable", {
      survivingPatientId: survivingId,
      retiredPatientId: retiredId,
      mergeType: "auto",
      mergeReason: `Automatic merge: ${score}% match confidence`,
      matchScore: score,
      premergeData: retired as any,
      canUnmerge: true,
    }));

    await phiDb
      .update(patientIdentityTable)
      .set(encryptPhiRow("patientIdentityTable", {
        matchStatus: "auto_merged",
        masterPatientId: survivingId,
        updatedAt: new Date(),
      }))
      .where(eq(patientIdentityTable.id, retiredId));

    console.log(`[HIPAA-AUDIT][DatabaseDedup] Auto-merged: ${retiredId} -> ${survivingId} (${score}%)`);
  }

  private similarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    if (s1 === s2) return 100;
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 100;
    let dist = 0;
    const matrix: number[][] = [];
    for (let i = 0; i <= s2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2[i - 1] === s1[j - 1]) matrix[i][j] = matrix[i - 1][j - 1];
        else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
    dist = matrix[s2.length][s1.length];
    return Math.round((1 - dist / maxLen) * 100);
  }

  private calculateMatchScore(record1: any, record2: any): number {
    let score = 0;
    score += this.similarity(record1.firstName, record2.firstName) * 0.20;
    score += this.similarity(record1.lastName, record2.lastName) * 0.25;
    if (record1.dateOfBirth === record2.dateOfBirth) score += 20;
    if (record1.phoneNumber && record2.phoneNumber) {
      score += (record1.phoneNumber === record2.phoneNumber ? 100 : this.similarity(record1.phoneNumber, record2.phoneNumber)) * 0.15;
    }
    if (record1.middleName && record2.middleName) {
      score += this.similarity(record1.middleName, record2.middleName) * 0.10;
    } else if (record1.hasNoMiddleName && record2.hasNoMiddleName) {
      score += 10;
    }
    score += this.similarity(record1.addressLine1 || "", record2.addressLine1 || "") * 0.05;
    if (record1.email && record2.email && record1.email.toLowerCase() === record2.email.toLowerCase()) {
      score += 5;
    }
    if (record1.ssnLast4 && record2.ssnLast4 && record1.ssnLast4 === record2.ssnLast4) {
      score += 10;
    }
    return Math.round(Math.min(100, Math.max(0, score)));
  }

  isDeduplicationRunning(): boolean {
    return this.isRunning;
  }
}

export const databaseDedupService = DatabaseDedupService.getInstance();
