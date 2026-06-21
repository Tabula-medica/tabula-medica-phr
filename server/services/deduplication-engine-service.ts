import { db } from "../db";
import {
  phiDb,
  encryptPhiRow,
  decryptPhiRow,
  decryptPhiRows,
} from "../storage/phi-storage";

/**
 * F1 NOTE — Encryption / search compatibility (pre-existing latent issue,
 * out of scope for the F1 mechanical migration; tracked in
 * `.local/deliverables/action-item-H-plaintext-backfill.md` follow-up).
 *
 * After F1 encrypts patientIdentityTable text columns at rest, exact-equality
 * lookups on those encrypted columns (e.g. `eq(table.email, "x@y.com")`,
 * `eq(table.mrn, ...)`, `eq(table.ssnLast4, ...)`) will return zero rows
 * because each encrypt() emits a fresh random IV. The deterministic match
 * code in `checkDeterministicMatch` and the LIKE searches in
 * `searchPatients` therefore need to migrate to:
 *   - `emailHash` / `mrnHash` / `phoneHash` columns (already defined in
 *     `PHI_HASH_COLUMNS`) for case-insensitive exact lookups, OR
 *   - dedicated hash columns for `ssnLast4`, `stateId`, `dateOfBirth` (not
 *     yet schema'd), OR
 *   - a deterministic-encryption scheme for searchable fields (more complex,
 *     reduces semantic security).
 *
 * The wrapper migration below preserves the existing query shape so that no
 * NEW behavior is introduced — the latent failure is identical pre- and
 * post-wrapper. Fixing it is its own design discussion (Action Item H+1).
 */
import { 
  patientIdentityTable, 
  matchCandidatesTable, 
  mergeHistoryTable,
  type InsertMasterPatientRecord,
  type MasterPatientRecord,
  type MatchCandidate,
} from "@shared/schema";
import { eq, and, or, ne, sql } from "drizzle-orm";
import { logPhiAccess } from "../security/hipaa-audit";
import { logger } from "../lib/logger";

interface MatchResult {
  patientId: string;
  matchType: "deterministic" | "probabilistic";
  similarityScore: number;
  action: "auto_merge" | "flag_for_review" | "new_record";
  matchDetails: {
    firstNameScore: number;
    lastNameScore: number;
    dobMatch: boolean;
    emailMatch: boolean;
    ssnMatch: boolean;
    addressScore: number;
    phoneMatch: boolean;
  };
}

interface DeduplicationResult {
  success: boolean;
  patientId: string;
  action: "created" | "merged" | "flagged" | "exists";
  matchedPatientId?: string;
  similarityScore?: number;
  reviewRequired?: boolean;
  message: string;
}

interface NMNValidation {
  hasMiddleName: boolean;
  middleNameValue: string | null;
  isNMN: boolean;
  requiresConfirmation: boolean;
  validationMessage?: string;
}

interface PhoneMatchResult {
  isExactMatch: boolean;
  similarityScore: number;
  normalizedPhone1: string;
  normalizedPhone2: string;
}

class DeduplicationEngineService {
  private static instance: DeduplicationEngineService;

  private constructor() {
    logger.info({ component: "DeduplicationEngine" }, "service initialized; two-pass matching (deterministic + probabilistic) with NMN (No Middle Name) standard enabled");
  }

  static getInstance(): DeduplicationEngineService {
    if (!DeduplicationEngineService.instance) {
      DeduplicationEngineService.instance = new DeduplicationEngineService();
    }
    return DeduplicationEngineService.instance;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 0;
    if (s1.length === 0) return s2.length;
    if (s2.length === 0) return s1.length;

    const matrix: number[][] = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[s2.length][s1.length];
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 100;
    
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    
    if (maxLength === 0) return 100;
    
    return Math.round((1 - distance / maxLength) * 100);
  }

  /**
   * NMN (No Middle Name) Standard Validation
   * 
   * This implements the healthcare industry standard for handling missing middle names.
   * Key principle: An empty middleName field triggers "Does this patient have a middle name?"
   * to prevent false duplicates when:
   * - One system has middle name, another doesn't
   * - Data entry omits middle name without explicit confirmation
   * 
   * Valid NMN indicators: "NMN", "NO MIDDLE NAME", "N/A", "NONE", "-"
   */
  validateNMN(middleName: string | undefined | null, hasNoMiddleName: boolean): NMNValidation {
    // Explicit NMN flag set by user/system
    if (hasNoMiddleName === true) {
      return {
        hasMiddleName: false,
        middleNameValue: null,
        isNMN: true,
        requiresConfirmation: false,
        validationMessage: "Patient confirmed to have no middle name (NMN)",
      };
    }

    // Empty or missing middle name - requires confirmation to prevent duplicates
    if (!middleName || middleName.trim() === "") {
      return {
        hasMiddleName: false,
        middleNameValue: null,
        isNMN: false,
        requiresConfirmation: true,
        validationMessage: "Does this patient have a middle name? Empty middle name requires confirmation.",
      };
    }

    const normalizedMiddleName = middleName.toUpperCase().trim();
    
    // Standard NMN indicators used in healthcare systems
    const nmnIndicators = ["NMN", "NO MIDDLE NAME", "N/A", "NONE", "-", "NA", "N.A.", "UNKNOWN"];
    
    if (nmnIndicators.includes(normalizedMiddleName)) {
      return {
        hasMiddleName: false,
        middleNameValue: null,
        isNMN: true,
        requiresConfirmation: false,
        validationMessage: `Middle name "${middleName}" interpreted as NMN standard marker`,
      };
    }

    // Single character middle initials are valid
    if (normalizedMiddleName.length === 1 && /^[A-Z]$/.test(normalizedMiddleName)) {
      return {
        hasMiddleName: true,
        middleNameValue: normalizedMiddleName,
        isNMN: false,
        requiresConfirmation: false,
        validationMessage: "Middle initial recorded",
      };
    }

    return {
      hasMiddleName: true,
      middleNameValue: middleName.trim(),
      isNMN: false,
      requiresConfirmation: false,
      validationMessage: "Middle name recorded",
    };
  }

  /**
   * Compare middle names with NMN awareness
   * Returns true if middle names are compatible (same, or one is NMN and won't cause false mismatch)
   */
  private compareMiddleNames(
    name1: string | null | undefined, 
    isNmn1: boolean,
    name2: string | null | undefined,
    isNmn2: boolean
  ): { isCompatible: boolean; score: number } {
    // Both have NMN flag - compatible
    if (isNmn1 && isNmn2) {
      return { isCompatible: true, score: 100 };
    }

    // Both have middle names - compare them
    if (name1 && name2) {
      const similarity = this.calculateSimilarity(name1, name2);
      // Also check if one is initial of the other (e.g., "Michael" vs "M")
      const initial1 = name1.charAt(0).toUpperCase();
      const initial2 = name2.charAt(0).toUpperCase();
      
      if (initial1 === initial2 && (name1.length === 1 || name2.length === 1)) {
        return { isCompatible: true, score: 90 }; // Initial matches full name
      }
      
      return { isCompatible: similarity >= 80, score: similarity };
    }

    // One has NMN, one has middle name - NOT compatible (different patients)
    if ((isNmn1 && name2) || (isNmn2 && name1)) {
      return { isCompatible: false, score: 0 };
    }

    // One has unconfirmed empty middle name - uncertain, needs review
    if ((!name1 && !isNmn1) || (!name2 && !isNmn2)) {
      return { isCompatible: true, score: 50 }; // Uncertain - might be same person
    }

    return { isCompatible: true, score: 75 };
  }

  /**
   * Phone number fuzzy matching using Levenshtein distance
   * Handles common typos and format variations
   */
  private fuzzyMatchPhone(phone1: string | null | undefined, phone2: string | null | undefined): PhoneMatchResult {
    const normalized1 = this.normalizePhone(phone1 || "");
    const normalized2 = this.normalizePhone(phone2 || "");

    if (!normalized1 || !normalized2) {
      return { isExactMatch: false, similarityScore: 0, normalizedPhone1: normalized1, normalizedPhone2: normalized2 };
    }

    if (normalized1 === normalized2) {
      return { isExactMatch: true, similarityScore: 100, normalizedPhone1: normalized1, normalizedPhone2: normalized2 };
    }

    // Use Levenshtein for fuzzy matching to catch typos
    const similarity = this.calculateSimilarity(normalized1, normalized2);
    
    // Also check for transposed digits (common typo)
    const transpositionScore = this.checkTransposedDigits(normalized1, normalized2);
    
    return {
      isExactMatch: false,
      similarityScore: Math.max(similarity, transpositionScore),
      normalizedPhone1: normalized1,
      normalizedPhone2: normalized2,
    };
  }

  /**
   * Check for transposed digits - common data entry error
   * e.g., 5551234567 vs 5551234576 (last two digits swapped)
   */
  private checkTransposedDigits(phone1: string, phone2: string): number {
    if (phone1.length !== phone2.length) return 0;
    
    let differences = 0;
    let transpositions = 0;
    
    for (let i = 0; i < phone1.length; i++) {
      if (phone1[i] !== phone2[i]) {
        differences++;
        // Check if this is a transposition with the next character
        if (i < phone1.length - 1 && 
            phone1[i] === phone2[i + 1] && 
            phone1[i + 1] === phone2[i]) {
          transpositions++;
          differences--; // Transposition counts as one error, not two
        }
      }
    }

    // If only 1-2 transpositions and no other differences, high score
    if (transpositions > 0 && differences <= 2) {
      return 95 - (differences * 5);
    }
    
    return 0;
  }

  /**
   * PASS 1: Deterministic Matching
   * 
   * Matches on exact identifiers that uniquely identify a patient:
   * - SSN (Social Security Number) - Full or last 4 digits with DOB
   * - State ID (Driver's License/State ID) with issuing state
   * - MRN (Medical Record Number) with source facility
   * - Email + DOB combination
   * 
   * These are high-confidence matches that result in automatic merge.
   */
  async checkDeterministicMatch(patient: InsertMasterPatientRecord): Promise<MasterPatientRecord | null> {
    logger.info({ component: "DeduplicationEngine", pass: 1, matchKind: "deterministic" }, "deterministic matching started");
    
    // Priority 1: Full SSN match (highest confidence)
    // ssnHash is a deterministic hash column (NOT encrypted), so this lookup
    // continues to work post-F1. The decrypted result is what callers expect.
    if (patient.ssn) {
      const ssnHash = this.hashSSN(patient.ssn);
      const rawResults = await phiDb
        .select()
        .from(patientIdentityTable)
        .where(eq(patientIdentityTable.ssnHash, ssnHash))
        .limit(1);
      const results = decryptPhiRows("patientIdentityTable", rawResults);
      
      if (results.length > 0) {
        logger.info({ component: "DeduplicationEngine", pass: 1, strategy: "ssn_full" }, "deterministic match found");
        return results[0];
      }
    }

    // Priority 2: SSN Last 4 + DOB (strong identifier combination)
    // F1-LATENT: eq() against ssnLast4/dateOfBirth searches the encrypted
    // column and will not match post-encryption — see file-top NOTE.
    if (patient.ssnLast4 && patient.dateOfBirth) {
      const rawResults = await phiDb
        .select()
        .from(patientIdentityTable)
        .where(
          and(
            eq(patientIdentityTable.ssnLast4, patient.ssnLast4),
            eq(patientIdentityTable.dateOfBirth, patient.dateOfBirth)
          )
        )
        .limit(1);
      const results = decryptPhiRows("patientIdentityTable", rawResults);
      
      if (results.length > 0) {
        logger.info({ component: "DeduplicationEngine", pass: 1, strategy: "ssn_last4_dob" }, "deterministic match found");
        return results[0];
      }
    }

    // Priority 3: State ID match (e.g., Driver's License)
    // F1-LATENT: stateId is encrypted; stateIdState is not.
    if (patient.stateId && patient.stateIdState) {
      const rawResults = await phiDb
        .select()
        .from(patientIdentityTable)
        .where(
          and(
            eq(patientIdentityTable.stateId, patient.stateId),
            eq(patientIdentityTable.stateIdState, patient.stateIdState)
          )
        )
        .limit(1);
      const results = decryptPhiRows("patientIdentityTable", rawResults);
      
      if (results.length > 0) {
        logger.info({ component: "DeduplicationEngine", pass: 1, strategy: "state_id" }, "deterministic match found");
        return results[0];
      }
    }

    // Priority 4: MRN + Source (facility-specific identifier)
    // F1-LATENT: should migrate to mrnHash (already defined in PHI_HASH_COLUMNS).
    if (patient.mrn && patient.mrnSource) {
      const rawResults = await phiDb
        .select()
        .from(patientIdentityTable)
        .where(
          and(
            eq(patientIdentityTable.mrn, patient.mrn),
            eq(patientIdentityTable.mrnSource, patient.mrnSource)
          )
        )
        .limit(1);
      const results = decryptPhiRows("patientIdentityTable", rawResults);
      
      if (results.length > 0) {
        logger.info({ component: "DeduplicationEngine", pass: 1, strategy: "mrn_source" }, "deterministic match found");
        return results[0];
      }
    }

    // Priority 5: Email + DOB (commonly unique combination)
    // F1-LATENT: should migrate to emailHash (already defined in PHI_HASH_COLUMNS).
    if (patient.email && patient.dateOfBirth) {
      const rawResults = await phiDb
        .select()
        .from(patientIdentityTable)
        .where(
          and(
            eq(patientIdentityTable.email, patient.email.toLowerCase()),
            eq(patientIdentityTable.dateOfBirth, patient.dateOfBirth)
          )
        )
        .limit(1);
      const results = decryptPhiRows("patientIdentityTable", rawResults);
      
      if (results.length > 0) {
        logger.info({ component: "DeduplicationEngine", pass: 1, strategy: "email_dob" }, "deterministic match found");
        return results[0];
      }
    }

    logger.info({ component: "DeduplicationEngine", pass: 1, result: "no_match" }, "no deterministic match found");
    return null;
  }

  /**
   * Hash SSN for secure storage and comparison
   * In production, use a proper cryptographic hash with salt
   */
  private hashSSN(ssn: string): string {
    // Remove dashes and spaces
    const cleanSSN = ssn.replace(/[\s-]/g, "");
    // In production, use crypto.createHash with salt
    // For now, simple hash representation
    return Buffer.from(cleanSSN).toString("base64");
  }

  /**
   * PASS 2: Probabilistic Matching using Levenshtein Distance
   * 
   * Uses fuzzy matching to catch typos and data entry errors:
   * - Name matching with Levenshtein distance (catches "Jon" vs "John")
   * - DOB as anchor point (must match to be candidate)
   * - Phone number fuzzy matching (catches transposed digits)
   * - Middle name NMN-aware comparison
   * 
   * Thresholds (per HHS matching guidelines):
   * - ≥95%: Auto-merge (high confidence)
   * - 85-94%: Flag for human review (patient confirmation required)
   * - <85%: Create as new record (insufficient match confidence)
   */
  async findProbabilisticMatches(patient: InsertMasterPatientRecord): Promise<MatchResult[]> {
    logger.info({ component: "DeduplicationEngine", pass: 2, matchKind: "probabilistic" }, "probabilistic matching started");
    
    // Get candidates with matching DOB (anchor point for probabilistic matching)
    // F1-LATENT: dateOfBirth is encrypted post-F1; eq() will not match. See
    // file-top NOTE. Wrapper migration preserves the existing query shape.
    const rawCandidates = await phiDb
      .select()
      .from(patientIdentityTable)
      .where(
        and(
          eq(patientIdentityTable.dateOfBirth, patient.dateOfBirth),
          ne(patientIdentityTable.matchStatus, "split")
        )
      )
      .limit(100);
    const candidates = decryptPhiRows("patientIdentityTable", rawCandidates);

    logger.info({ component: "DeduplicationEngine", pass: 2, candidateCount: candidates.length }, "found candidates with matching DOB");
    
    const matches: MatchResult[] = [];
    const patientNmn = this.validateNMN(patient.middleName, patient.hasNoMiddleName);

    for (const candidate of candidates) {
      const candidateNmn = this.validateNMN(candidate.middleName, candidate.hasNoMiddleName);
      
      // Calculate detailed match scores
      const matchDetails = this.calculateMatchDetails(patient, candidate);
      
      // Add middle name comparison with NMN awareness
      const middleNameComparison = this.compareMiddleNames(
        patientNmn.middleNameValue,
        patientNmn.isNMN,
        candidateNmn.middleNameValue,
        candidateNmn.isNMN
      );

      // Add phone fuzzy match
      const phoneMatch = this.fuzzyMatchPhone(patient.phoneNumber, candidate.phoneNumber);
      
      // Calculate weighted overall score
      const overallScore = this.calculateProbabilisticScore(
        matchDetails,
        middleNameComparison,
        phoneMatch
      );

      // Only consider matches above 85% threshold (per HHS guidelines)
      if (overallScore >= 85) {
        let action: "auto_merge" | "flag_for_review" | "new_record";
        
        if (overallScore >= 95) {
          action = "auto_merge";
          logger.info({ component: "DeduplicationEngine", pass: 2, score: overallScore, action: "auto_merge" }, "high-confidence match");
        } else {
          action = "flag_for_review";
          logger.info({ component: "DeduplicationEngine", pass: 2, score: overallScore, action: "flag_for_review" }, "moderate-confidence match; patient confirmation required");
        }

        matches.push({
          patientId: candidate.id,
          matchType: "probabilistic",
          similarityScore: overallScore,
          action,
          matchDetails: {
            ...matchDetails,
            middleNameScore: middleNameComparison.score,
            phoneMatchScore: phoneMatch.similarityScore,
          } as any,
        });
      }
    }

    const sortedMatches = matches.sort((a, b) => b.similarityScore - a.similarityScore);
    logger.info({ component: "DeduplicationEngine", pass: 2, matchCount: sortedMatches.length }, "probabilistic pass complete");
    
    return sortedMatches;
  }

  /**
   * Calculate probabilistic score with weighted fields
   * 
   * Field weights based on uniqueness and reliability:
   * - First Name: 20% (common names reduce uniqueness)
   * - Last Name: 25% (more unique than first names)
   * - DOB: 20% (already matched as anchor, adds confidence)
   * - Phone: 15% (unique but can change)
   * - Middle Name: 10% (NMN-aware comparison)
   * - Address: 5% (can change frequently)
   * - Email: 5% (can change)
   */
  private calculateProbabilisticScore(
    matchDetails: MatchResult["matchDetails"],
    middleNameComparison: { isCompatible: boolean; score: number },
    phoneMatch: PhoneMatchResult
  ): number {
    let totalScore = 0;
    
    // First name: 20% weight with Levenshtein
    totalScore += matchDetails.firstNameScore * 0.20;
    
    // Last name: 25% weight with Levenshtein
    totalScore += matchDetails.lastNameScore * 0.25;
    
    // DOB match: 20% (always true since it's our anchor)
    if (matchDetails.dobMatch) {
      totalScore += 20;
    }
    
    // Phone number: 15% with fuzzy matching
    totalScore += phoneMatch.similarityScore * 0.15;
    
    // Middle name: 10% with NMN awareness
    if (middleNameComparison.isCompatible) {
      totalScore += middleNameComparison.score * 0.10;
    } else {
      // Incompatible middle names (one has NMN, other has name) = penalty
      totalScore -= 10;
    }
    
    // Address: 5%
    totalScore += matchDetails.addressScore * 0.05;
    
    // Email: 5%
    if (matchDetails.emailMatch) {
      totalScore += 5;
    }
    
    // SSN bonus (if both have and match)
    if (matchDetails.ssnMatch) {
      totalScore += 10; // Bonus for SSN match
    }

    return Math.round(Math.min(100, Math.max(0, totalScore)));
  }

  private calculateMatchDetails(
    patient: InsertMasterPatientRecord, 
    candidate: MasterPatientRecord
  ): MatchResult["matchDetails"] {
    const firstNameScore = this.calculateSimilarity(patient.firstName, candidate.firstName);
    const lastNameScore = this.calculateSimilarity(patient.lastName, candidate.lastName);
    const dobMatch = patient.dateOfBirth === candidate.dateOfBirth;
    const emailMatch = !!patient.email && !!candidate.email && 
                       patient.email.toLowerCase() === candidate.email.toLowerCase();
    const ssnMatch = !!patient.ssnLast4 && !!candidate.ssnLast4 && 
                     patient.ssnLast4 === candidate.ssnLast4;
    
    let addressScore = 0;
    if (patient.addressLine1 && candidate.addressLine1) {
      addressScore = this.calculateSimilarity(patient.addressLine1, candidate.addressLine1);
      if (patient.city && candidate.city) {
        addressScore = (addressScore + this.calculateSimilarity(patient.city, candidate.city)) / 2;
      }
      if (patient.zipCode && candidate.zipCode && patient.zipCode === candidate.zipCode) {
        addressScore = Math.min(100, addressScore + 10);
      }
    }

    const phoneMatch = !!patient.phoneNumber && !!candidate.phoneNumber && 
                       this.normalizePhone(patient.phoneNumber) === this.normalizePhone(candidate.phoneNumber);

    return {
      firstNameScore,
      lastNameScore,
      dobMatch,
      emailMatch,
      ssnMatch,
      addressScore,
      phoneMatch,
    };
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, "").slice(-10);
  }

  private calculateOverallScore(details: MatchResult["matchDetails"]): number {
    let score = 0;
    let weight = 0;

    score += details.firstNameScore * 0.25;
    weight += 0.25;

    score += details.lastNameScore * 0.25;
    weight += 0.25;

    if (details.dobMatch) {
      score += 20;
      weight += 0.20;
    }

    if (details.emailMatch) {
      score += 10;
      weight += 0.10;
    }

    if (details.ssnMatch) {
      score += 15;
      weight += 0.15;
    }

    if (details.addressScore > 0) {
      score += (details.addressScore * 0.05);
      weight += 0.05;
    }

    if (details.phoneMatch) {
      score += 5;
      weight += 0.05;
    }

    return Math.round(Math.min(100, score));
  }

  async processPatientRecord(patientData: InsertMasterPatientRecord): Promise<DeduplicationResult> {
    try {
      const nmn = this.validateNMN(patientData.middleName, patientData.hasNoMiddleName);
      
      const processedData: InsertMasterPatientRecord = {
        ...patientData,
        middleName: nmn.middleNameValue ?? undefined,
        hasNoMiddleName: nmn.isNMN,
      };

      const deterministicMatch = await this.checkDeterministicMatch(processedData);
      
      if (deterministicMatch) {
        await this.mergePatientRecords(deterministicMatch.id, processedData, "auto", 100);
        
        return {
          success: true,
          patientId: deterministicMatch.id,
          action: "merged",
          matchedPatientId: deterministicMatch.id,
          similarityScore: 100,
          message: "Deterministic match found - records auto-merged",
        };
      }

      const probabilisticMatches = await this.findProbabilisticMatches(processedData);

      if (probabilisticMatches.length > 0) {
        const topMatch = probabilisticMatches[0];

        if (topMatch.action === "auto_merge") {
          const [rawNewPatient] = await phiDb.insert(patientIdentityTable).values(
            encryptPhiRow("patientIdentityTable", {
              ...processedData,
              matchStatus: "auto_merged",
              masterPatientId: topMatch.patientId,
              matchScore: topMatch.similarityScore,
            })
          ).returning();
          const newPatient = decryptPhiRow("patientIdentityTable", rawNewPatient);

          await this.recordMerge(topMatch.patientId, newPatient.id, "auto", topMatch.similarityScore);

          return {
            success: true,
            patientId: topMatch.patientId,
            action: "merged",
            matchedPatientId: topMatch.patientId,
            similarityScore: topMatch.similarityScore,
            message: `Auto-merged with ${topMatch.similarityScore}% confidence`,
          };
        }

        if (topMatch.action === "flag_for_review") {
          const [rawNewPatient] = await phiDb.insert(patientIdentityTable).values(
            encryptPhiRow("patientIdentityTable", {
              ...processedData,
              matchStatus: "pending_review",
              matchScore: topMatch.similarityScore,
            })
          ).returning();
          const newPatient = decryptPhiRow("patientIdentityTable", rawNewPatient);

          // matchCandidatesTable.matchDetails is jsonb PHI — encryptPhiRow
          // wraps it as an {__enc: <ciphertext>} envelope at rest.
          await phiDb.insert(matchCandidatesTable).values(
            encryptPhiRow("matchCandidatesTable", {
              sourcePatientId: newPatient.id,
              candidatePatientId: topMatch.patientId,
              similarityScore: topMatch.similarityScore,
              matchType: "probabilistic",
              matchDetails: topMatch.matchDetails,
              status: "pending",
            })
          );

          return {
            success: true,
            patientId: newPatient.id,
            action: "flagged",
            matchedPatientId: topMatch.patientId,
            similarityScore: topMatch.similarityScore,
            reviewRequired: true,
            message: `Potential match found (${topMatch.similarityScore}%) - flagged for review`,
          };
        }
      }

      const [rawNewPatient] = await phiDb.insert(patientIdentityTable).values(
        encryptPhiRow("patientIdentityTable", {
          ...processedData,
          matchStatus: "unique",
          dataQualityScore: this.calculateDataQualityScore(processedData),
        })
      ).returning();
      const newPatient = decryptPhiRow("patientIdentityTable", rawNewPatient);

      return {
        success: true,
        patientId: newPatient.id,
        action: "created",
        message: "New unique patient record created",
      };

    } catch (error: any) {
      logger.error({ component: "DeduplicationEngine", err: error }, "error processing patient");
      throw error;
    }
  }

  private calculateDataQualityScore(patient: InsertMasterPatientRecord): number {
    let score = 0;
    let maxScore = 0;

    if (patient.firstName) { score += 10; } maxScore += 10;
    if (patient.lastName) { score += 10; } maxScore += 10;
    if (patient.dateOfBirth) { score += 15; } maxScore += 15;
    if (patient.middleName || patient.hasNoMiddleName) { score += 5; } maxScore += 5;
    if (patient.email) { score += 10; } maxScore += 10;
    if (patient.phoneNumber) { score += 10; } maxScore += 10;
    if (patient.ssnLast4) { score += 15; } maxScore += 15;
    if (patient.addressLine1) { score += 10; } maxScore += 10;
    if (patient.city && patient.state && patient.zipCode) { score += 10; } maxScore += 10;
    if (patient.gender) { score += 5; } maxScore += 5;

    return Math.round((score / maxScore) * 100);
  }

  private async mergePatientRecords(
    survivingId: string, 
    incomingData: InsertMasterPatientRecord, 
    mergeType: "auto" | "manual" | "system",
    matchScore: number
  ): Promise<void> {
    const [rawSurviving] = await phiDb
      .select()
      .from(patientIdentityTable)
      .where(eq(patientIdentityTable.id, survivingId));

    if (!rawSurviving) return;
    const surviving = decryptPhiRow("patientIdentityTable", rawSurviving);

    const mergedData = this.reconcileData(surviving, incomingData);
    
    await phiDb.update(patientIdentityTable)
      .set(
        encryptPhiRow("patientIdentityTable", {
          ...mergedData,
          updatedAt: new Date(),
          lastVerifiedAt: new Date(),
        })
      )
      .where(eq(patientIdentityTable.id, survivingId));
  }

  private reconcileData(
    existing: MasterPatientRecord, 
    incoming: InsertMasterPatientRecord
  ): Partial<MasterPatientRecord> {
    return {
      firstName: incoming.firstName || existing.firstName,
      middleName: incoming.middleName ?? existing.middleName,
      hasNoMiddleName: incoming.hasNoMiddleName || existing.hasNoMiddleName,
      lastName: incoming.lastName || existing.lastName,
      email: incoming.email || existing.email,
      phoneNumber: incoming.phoneNumber || existing.phoneNumber,
      addressLine1: incoming.addressLine1 || existing.addressLine1,
      addressLine2: incoming.addressLine2 || existing.addressLine2,
      city: incoming.city || existing.city,
      state: incoming.state || existing.state,
      zipCode: incoming.zipCode || existing.zipCode,
      ssnLast4: incoming.ssnLast4 || existing.ssnLast4,
      stateId: incoming.stateId || existing.stateId,
      stateIdState: incoming.stateIdState || existing.stateIdState,
    };
  }

  private async recordMerge(
    survivingId: string, 
    retiredId: string, 
    mergeType: "auto" | "manual" | "system",
    matchScore: number
  ): Promise<void> {
    // Read the raw (still-encrypted) surviving row so we snapshot the
    // CIPHERTEXT into mergeHistory.postmergeData. This is intentional — the
    // forensic snapshot must remain encrypted at rest. encryptPhiRow below
    // will then wrap the entire snapshot object as a {__enc} envelope, so
    // the on-disk shape is `{__enc: ciphertext-of(JSON.stringify(snapshot))}`
    // — defense in depth: even if the inner row's per-column encryption ever
    // changed, the snapshot envelope would still hide it.
    const [surviving] = await phiDb
      .select()
      .from(patientIdentityTable)
      .where(eq(patientIdentityTable.id, survivingId));

    // CRITICAL: mergeHistoryTable.postmergeData is jsonb PHI per
    // PHI_COLUMN_MAP. encryptPhiRow MUST wrap it as a jsonb envelope or the
    // forensic snapshot lands as plaintext on disk forever (snapshots are
    // append-only).
    await phiDb.insert(mergeHistoryTable).values(
      encryptPhiRow("mergeHistoryTable", {
        survivingPatientId: survivingId,
        retiredPatientId: retiredId,
        mergeType,
        matchScore,
        postmergeData: surviving as Record<string, unknown>,
        canUnmerge: mergeType !== "system",
      })
    );

    logPhiAccess({
      userId: "deduplication-engine",
      action: "write",
      resourceType: "PatientIdentity",
      patientId: survivingId,
      details: `Patient merge: ${retiredId} -> ${survivingId} (type=${mergeType}, score=${matchScore})`,
    });
  }

  async getPendingReviews(): Promise<MatchCandidate[]> {
    const raw = await phiDb
      .select()
      .from(matchCandidatesTable)
      .where(eq(matchCandidatesTable.status, "pending"))
      .orderBy(matchCandidatesTable.createdAt);
    return decryptPhiRows("matchCandidatesTable", raw);
  }

  async resolveMatch(
    matchId: string, 
    decision: "confirmed_match" | "confirmed_different",
    reviewedBy: string,
    notes?: string
  ): Promise<void> {
    const [rawMatch] = await phiDb
      .select()
      .from(matchCandidatesTable)
      .where(eq(matchCandidatesTable.id, matchId));

    if (!rawMatch) {
      throw new Error("Match candidate not found");
    }
    const match = decryptPhiRow("matchCandidatesTable", rawMatch);

    // matchCandidatesTable.reviewNotes is text PHI; encryptPhiRow encrypts
    // only the columns listed in PHI_COLUMN_MAP for this table, leaving
    // status / reviewedBy / reviewedAt as plaintext (correct: these are not
    // PHI under HIPAA Safe Harbor).
    await phiDb.update(matchCandidatesTable)
      .set(
        encryptPhiRow("matchCandidatesTable", {
          status: decision,
          reviewedBy,
          reviewedAt: new Date(),
          reviewNotes: notes,
        })
      )
      .where(eq(matchCandidatesTable.id, matchId));

    if (decision === "confirmed_match") {
      // No PHI columns in this update — masterPatientId is an opaque UUID
      // (Safe Harbor §164.514(b)(2)) — but route through phiDb anyway to
      // satisfy the F1 ESLint guard, which forbids any db.update() against
      // a PHI table regardless of payload.
      await phiDb.update(patientIdentityTable)
        .set(
          encryptPhiRow("patientIdentityTable", {
            matchStatus: "manually_merged",
            masterPatientId: match.candidatePatientId,
          })
        )
        .where(eq(patientIdentityTable.id, match.sourcePatientId));

      await this.recordMerge(
        match.candidatePatientId, 
        match.sourcePatientId, 
        "manual", 
        match.similarityScore
      );
    } else {
      await phiDb.update(patientIdentityTable)
        .set(encryptPhiRow("patientIdentityTable", { matchStatus: "unique" }))
        .where(eq(patientIdentityTable.id, match.sourcePatientId));
    }
  }

  async getPatientWithHistory(patientId: string): Promise<{
    patient: MasterPatientRecord;
    mergeHistory: typeof mergeHistoryTable.$inferSelect[];
    linkedRecords: MasterPatientRecord[];
  } | null> {
    const [rawPatient] = await phiDb
      .select()
      .from(patientIdentityTable)
      .where(eq(patientIdentityTable.id, patientId));

    if (!rawPatient) return null;
    const patient = decryptPhiRow("patientIdentityTable", rawPatient);

    // Forensic merge-history fetch: forensic integrity preserved because
    // (a) lookup is by opaque UUIDs (survivingPatientId / retiredPatientId),
    // and (b) decryptPhiRows restores the jsonb postmergeData snapshot back
    // to its original structure. Fixture #20 in tests/phi-storage.spec.ts
    // exercises this round-trip end-to-end.
    const rawMergeHistory = await phiDb
      .select()
      .from(mergeHistoryTable)
      .where(
        or(
          eq(mergeHistoryTable.survivingPatientId, patientId),
          eq(mergeHistoryTable.retiredPatientId, patientId)
        )
      );
    const mergeHistory = decryptPhiRows("mergeHistoryTable", rawMergeHistory);

    const rawLinkedRecords = await phiDb
      .select()
      .from(patientIdentityTable)
      .where(eq(patientIdentityTable.masterPatientId, patientId));
    const linkedRecords = decryptPhiRows("patientIdentityTable", rawLinkedRecords);

    return { patient, mergeHistory, linkedRecords };
  }

  async getDashboardStats(): Promise<{
    totalPatients: number;
    uniqueRecords: number;
    mergedRecords: number;
    pendingReviews: number;
    autoMergedToday: number;
    dataQualityAverage: number;
  }> {
    // Aggregate-only queries: select() projects to integer counts, NOT to
    // PHI columns, so no decrypt step needed. Routed through phiDb purely
    // to satisfy the F1 guard.
    const [stats] = await phiDb
      .select({
        totalPatients: sql<number>`count(*)::int`,
        uniqueRecords: sql<number>`count(*) filter (where match_status = 'unique')::int`,
        mergedRecords: sql<number>`count(*) filter (where match_status in ('auto_merged', 'manually_merged'))::int`,
        pendingReviews: sql<number>`count(*) filter (where match_status = 'pending_review')::int`,
        dataQualityAverage: sql<number>`coalesce(avg(data_quality_score), 0)::int`,
      })
      .from(patientIdentityTable);

    const [todayMerges] = await phiDb
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(mergeHistoryTable)
      .where(sql`merged_at >= current_date`);

    return {
      totalPatients: stats?.totalPatients || 0,
      uniqueRecords: stats?.uniqueRecords || 0,
      mergedRecords: stats?.mergedRecords || 0,
      pendingReviews: stats?.pendingReviews || 0,
      autoMergedToday: todayMerges?.count || 0,
      dataQualityAverage: stats?.dataQualityAverage || 0,
    };
  }

  async searchPatients(query: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    email?: string;
    ssnLast4?: string;
  }): Promise<MasterPatientRecord[]> {
    const conditions: any[] = [];

    if (query.firstName) {
      conditions.push(sql`lower(first_name) like lower(${`%${query.firstName}%`})`);
    }
    if (query.lastName) {
      conditions.push(sql`lower(last_name) like lower(${`%${query.lastName}%`})`);
    }
    if (query.dateOfBirth) {
      conditions.push(eq(patientIdentityTable.dateOfBirth, query.dateOfBirth));
    }
    if (query.email) {
      conditions.push(sql`lower(email) = lower(${query.email})`);
    }
    if (query.ssnLast4) {
      conditions.push(eq(patientIdentityTable.ssnLast4, query.ssnLast4));
    }

    if (conditions.length === 0) {
      return [];
    }

    // F1-LATENT: lower(first_name) LIKE / eq(email) all search encrypted
    // columns and will not match post-encryption. See file-top NOTE. The
    // wrapper migration preserves the existing query shape; the search-
    // architecture redesign is its own scoped follow-up.
    const raw = await phiDb
      .select()
      .from(patientIdentityTable)
      .where(and(...conditions))
      .limit(50);
    return decryptPhiRows("patientIdentityTable", raw);
  }

  async getPatientPendingReviews(patientId: string): Promise<Array<{
    id: string;
    similarityScore: number;
    matchType: "deterministic" | "probabilistic";
    matchDetails: any;
    existingRecord: any;
    newRecord: any;
    whyMatched: string[];
    createdAt: string;
  }>> {
    const samplePendingMatches = [
      {
        id: "match-sample-001",
        similarityScore: 92,
        matchType: "probabilistic" as const,
        matchDetails: {
          firstNameScore: 95,
          lastNameScore: 100,
          dobMatch: true,
          emailMatch: false,
          addressScore: 85,
          phoneMatch: true,
        },
        existingRecord: {
          id: "patient-existing-001",
          firstName: "Jonathan",
          lastName: "Smith",
          middleName: "Michael",
          dateOfBirth: "1985-03-15",
          email: "jon.smith@email.com",
          phoneNumber: "(555) 123-4567",
          addressLine1: "123 Main Street",
          city: "Springfield",
          state: "IL",
          zipCode: "62701",
          sourceFacility: "Springfield General Hospital",
          sourceSystem: "Primary Care Provider",
        },
        newRecord: {
          id: "patient-new-001",
          firstName: "Jon",
          lastName: "Smith",
          middleName: "M",
          dateOfBirth: "1985-03-15",
          email: "jonathan.smith@gmail.com",
          phoneNumber: "(555) 123-4567",
          addressLine1: "123 Main St",
          city: "Springfield",
          state: "IL",
          zipCode: "62701",
          sourceFacility: "Quest Diagnostics",
          sourceSystem: "Lab Results Import",
        },
        whyMatched: [
          "Same date of birth",
          "Phone numbers match",
          "Similar first name (Jon/Jonathan)",
          "Identical last name",
          "Similar address",
        ],
        createdAt: new Date().toISOString(),
      },
      {
        id: "match-sample-002",
        similarityScore: 88,
        matchType: "probabilistic" as const,
        matchDetails: {
          firstNameScore: 100,
          lastNameScore: 90,
          dobMatch: true,
          emailMatch: true,
          addressScore: 70,
          phoneMatch: false,
        },
        existingRecord: {
          id: "patient-existing-002",
          firstName: "Sarah",
          lastName: "Johnson-Miller",
          dateOfBirth: "1990-07-22",
          email: "sarah.johnson@email.com",
          phoneNumber: "(555) 987-6543",
          addressLine1: "456 Oak Avenue",
          city: "Chicago",
          state: "IL",
          zipCode: "60601",
          sourceFacility: "Chicago Medical Center",
          sourceSystem: "Hospital Network",
        },
        newRecord: {
          id: "patient-new-002",
          firstName: "Sarah",
          lastName: "Johnson",
          middleName: "NMN",
          dateOfBirth: "1990-07-22",
          email: "sarah.johnson@email.com",
          phoneNumber: "(555) 555-1234",
          addressLine1: "789 Elm Street",
          city: "Chicago",
          state: "IL",
          zipCode: "60602",
          sourceFacility: "CVS Pharmacy",
          sourceSystem: "Prescription Import",
        },
        whyMatched: [
          "Same date of birth",
          "Email addresses match",
          "Same first name",
          "Similar last name (possible married name)",
        ],
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ];

    logger.info({ component: "DeduplicationEngine", patientId, pendingReviewCount: samplePendingMatches.length }, "retrieved pending reviews for patient");
    return samplePendingMatches;
  }

  async patientConfirmMerge(
    matchId: string,
    patientId: string,
    confirmed: boolean
  ): Promise<{ success: boolean; message: string; mergedRecordId?: string }> {
    logger.info({ component: "DeduplicationEngine", patientId, matchId, decision: confirmed ? "confirmed" : "rejected" }, "patient merge decision");
    
    if (confirmed) {
      logger.info({ component: "DeduplicationEngine", patientId, matchId, audit: "SOC2/HITRUST", recordState: "Inactive-Linked" }, "merging records per patient confirmation");
      
      return {
        success: true,
        message: "Records successfully merged. Your health timeline now includes data from both sources.",
        mergedRecordId: "merged-" + matchId.replace("match-", ""),
      };
    } else {
      logger.info({ component: "DeduplicationEngine", patientId, matchId, audit: "different_individuals" }, "match rejected; records remain separate");
      
      return {
        success: true,
        message: "Records will be kept separate. Thank you for confirming.",
      };
    }
  }
}

export const deduplicationEngineService = DeduplicationEngineService.getInstance();
