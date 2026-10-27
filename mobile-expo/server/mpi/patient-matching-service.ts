import { db } from "../db";
import { users } from "@shared/schema";
import { eq, and, or, sql, ilike } from "drizzle-orm";
import { EncryptionService } from "../compliance/encryption-service";

export interface PatientIdentifier {
  ssn?: string;
  stateId?: string;
  stateIdState?: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  dateOfBirth: string;
  phoneNumber?: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

export interface MatchResult {
  userId: string;
  matchType: "deterministic" | "probabilistic";
  confidence: number;
  matchedFields: string[];
  details: MatchDetails;
}

export interface MatchDetails {
  ssnMatch?: boolean;
  stateIdMatch?: boolean;
  nameScore?: number;
  dobMatch?: boolean;
  phoneScore?: number;
  emailMatch?: boolean;
  addressScore?: number;
}

export interface DuplicateCandidate {
  userId: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  dateOfBirth?: string;
  matchResult: MatchResult;
}

export const NMN_MARKER = "NMN";

export function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[s1.length][s2.length];
}

export function levenshteinSimilarity(str1: string, str2: string): number {
  if (!str1 && !str2) return 1;
  if (!str1 || !str2) return 0;
  
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  
  if (maxLength === 0) return 1;
  return 1 - distance / maxLength;
}

export function jaroWinklerSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(s1.length, s2.length)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

export function normalizeMiddleName(middleName: string | null | undefined): string {
  if (!middleName || middleName.trim() === "" || middleName.trim().toUpperCase() === NMN_MARKER) {
    return NMN_MARKER;
  }
  return middleName.trim().toUpperCase();
}

export function compareMiddleNames(name1: string | null | undefined, name2: string | null | undefined): boolean {
  const normalized1 = normalizeMiddleName(name1);
  const normalized2 = normalizeMiddleName(name2);

  if (normalized1 === NMN_MARKER || normalized2 === NMN_MARKER) {
    return true;
  }

  if (normalized1.length === 1 || normalized2.length === 1) {
    return normalized1[0] === normalized2[0];
  }

  return normalized1 === normalized2;
}

export function normalizePhoneNumber(phone: string | undefined): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "").slice(-10);
}

export function comparePhoneNumbers(phone1: string | undefined, phone2: string | undefined): number {
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);
  
  if (!normalized1 || !normalized2) return 0;
  if (normalized1 === normalized2) return 1;
  
  return levenshteinSimilarity(normalized1, normalized2);
}

export function normalizeSSN(ssn: string | undefined): string {
  if (!ssn) return "";
  return ssn.replace(/\D/g, "");
}

export function compareDates(date1: string | undefined, date2: string | undefined): boolean {
  if (!date1 || !date2) return false;
  
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

export class PatientMatchingService {
  private readonly DETERMINISTIC_CONFIDENCE = 1.0;
  private readonly HIGH_PROBABILISTIC_THRESHOLD = 0.85;
  private readonly MEDIUM_PROBABILISTIC_THRESHOLD = 0.70;
  private readonly NAME_WEIGHT = 0.30;
  private readonly DOB_WEIGHT = 0.25;
  private readonly PHONE_WEIGHT = 0.20;
  private readonly ADDRESS_WEIGHT = 0.15;
  private readonly EMAIL_WEIGHT = 0.10;

  async findDeterministicMatches(identifier: PatientIdentifier): Promise<MatchResult[]> {
    const results: MatchResult[] = [];

    if (identifier.ssn) {
      const normalizedSSN = normalizeSSN(identifier.ssn);
      const allUsers = await db.select().from(users);
      
      for (const user of allUsers) {
        if ((user as any).ssnEncrypted) {
          try {
            const decryptedSSN = EncryptionService.decrypt((user as any).ssnEncrypted);
            if (normalizeSSN(decryptedSSN) === normalizedSSN) {
              results.push({
                userId: user.id,
                matchType: "deterministic",
                confidence: this.DETERMINISTIC_CONFIDENCE,
                matchedFields: ["ssn"],
                details: { ssnMatch: true },
              });
            }
          } catch (e) {
          }
        }
      }
    }

    if (identifier.stateId && identifier.stateIdState) {
      const allUsers = await db.select().from(users);
      
      for (const user of allUsers) {
        if ((user as any).stateIdEncrypted && (user as any).stateIdState) {
          try {
            const decryptedStateId = EncryptionService.decrypt((user as any).stateIdEncrypted);
            if (
              decryptedStateId === identifier.stateId &&
              (user as any).stateIdState === identifier.stateIdState
            ) {
              const existingMatch = results.find((r) => r.userId === user.id);
              if (existingMatch) {
                existingMatch.matchedFields.push("stateId");
                existingMatch.details.stateIdMatch = true;
              } else {
                results.push({
                  userId: user.id,
                  matchType: "deterministic",
                  confidence: this.DETERMINISTIC_CONFIDENCE,
                  matchedFields: ["stateId"],
                  details: { stateIdMatch: true },
                });
              }
            }
          } catch (e) {
          }
        }
      }
    }

    return results;
  }

  async findProbabilisticMatches(
    identifier: PatientIdentifier,
    excludeUserIds: string[] = []
  ): Promise<MatchResult[]> {
    const results: MatchResult[] = [];

    const candidates = await db
      .select()
      .from(users)
      .where(
        and(
          excludeUserIds.length > 0
            ? sql`${users.id} NOT IN (${sql.join(excludeUserIds.map((id) => sql`${id}`), sql`, `)})`
            : sql`1=1`
        )
      );

    for (const candidate of candidates) {
      const matchDetails = this.calculateProbabilisticMatch(identifier, candidate);
      
      if (matchDetails.confidence >= this.MEDIUM_PROBABILISTIC_THRESHOLD) {
        results.push({
          userId: candidate.id,
          matchType: "probabilistic",
          confidence: matchDetails.confidence,
          matchedFields: matchDetails.matchedFields,
          details: matchDetails.details,
        });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  private calculateProbabilisticMatch(
    identifier: PatientIdentifier,
    candidate: any
  ): { confidence: number; matchedFields: string[]; details: MatchDetails } {
    const matchedFields: string[] = [];
    const details: MatchDetails = {};
    let totalScore = 0;
    let totalWeight = 0;

    const firstNameScore = jaroWinklerSimilarity(
      identifier.firstName,
      candidate.firstName || candidate.name?.split(" ")[0] || ""
    );
    const lastNameScore = jaroWinklerSimilarity(
      identifier.lastName,
      candidate.lastName || candidate.name?.split(" ").slice(-1)[0] || ""
    );
    
    let middleNameScore = 1;
    if (identifier.middleName || candidate.middleName) {
      middleNameScore = compareMiddleNames(identifier.middleName, candidate.middleName) ? 1 : 0.5;
    }

    const nameScore = (firstNameScore * 0.4 + lastNameScore * 0.4 + middleNameScore * 0.2);
    details.nameScore = nameScore;
    
    if (nameScore >= 0.8) {
      matchedFields.push("name");
      totalScore += nameScore * this.NAME_WEIGHT;
    }
    totalWeight += this.NAME_WEIGHT;

    if (identifier.dateOfBirth && candidate.dateOfBirth) {
      const dobMatch = compareDates(identifier.dateOfBirth, candidate.dateOfBirth);
      details.dobMatch = dobMatch;
      
      if (dobMatch) {
        matchedFields.push("dateOfBirth");
        totalScore += this.DOB_WEIGHT;
      }
      totalWeight += this.DOB_WEIGHT;
    }

    if (identifier.phoneNumber && candidate.phoneNumber) {
      const phoneScore = comparePhoneNumbers(identifier.phoneNumber, candidate.phoneNumber);
      details.phoneScore = phoneScore;
      
      if (phoneScore >= 0.9) {
        matchedFields.push("phone");
        totalScore += phoneScore * this.PHONE_WEIGHT;
      }
      totalWeight += this.PHONE_WEIGHT;
    }

    if (identifier.email && candidate.email) {
      const emailMatch = identifier.email.toLowerCase() === candidate.email.toLowerCase();
      details.emailMatch = emailMatch;
      
      if (emailMatch) {
        matchedFields.push("email");
        totalScore += this.EMAIL_WEIGHT;
      }
      totalWeight += this.EMAIL_WEIGHT;
    }

    if (identifier.address && candidate.address) {
      const addressScore = this.calculateAddressScore(identifier.address, candidate.address);
      details.addressScore = addressScore;
      
      if (addressScore >= 0.7) {
        matchedFields.push("address");
        totalScore += addressScore * this.ADDRESS_WEIGHT;
      }
      totalWeight += this.ADDRESS_WEIGHT;
    }

    const confidence = totalWeight > 0 ? totalScore / totalWeight : 0;

    return { confidence, matchedFields, details };
  }

  private calculateAddressScore(addr1: any, addr2: any): number {
    if (!addr1 || !addr2) return 0;

    let score = 0;
    let components = 0;

    if (addr1.zipCode && addr2.zipCode) {
      const zip1 = addr1.zipCode.replace(/\D/g, "").slice(0, 5);
      const zip2 = addr2.zipCode.replace(/\D/g, "").slice(0, 5);
      if (zip1 === zip2) score += 0.4;
      components++;
    }

    if (addr1.state && addr2.state) {
      if (addr1.state.toUpperCase() === addr2.state.toUpperCase()) score += 0.1;
      components++;
    }

    if (addr1.city && addr2.city) {
      const citySimilarity = jaroWinklerSimilarity(addr1.city, addr2.city);
      if (citySimilarity >= 0.85) score += 0.2;
      components++;
    }

    if (addr1.street && addr2.street) {
      const streetSimilarity = jaroWinklerSimilarity(addr1.street, addr2.street);
      if (streetSimilarity >= 0.8) score += 0.3;
      components++;
    }

    return components > 0 ? score : 0;
  }

  async findAllMatches(identifier: PatientIdentifier): Promise<{
    deterministicMatches: MatchResult[];
    probabilisticMatches: MatchResult[];
  }> {
    const deterministicMatches = await this.findDeterministicMatches(identifier);
    const deterministicUserIds = deterministicMatches.map((m) => m.userId);

    const probabilisticMatches = await this.findProbabilisticMatches(
      identifier,
      deterministicUserIds
    );

    return {
      deterministicMatches,
      probabilisticMatches,
    };
  }

  async findDuplicateCandidates(userId: string): Promise<DuplicateCandidate[]> {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user.length) {
      throw new Error("User not found");
    }

    const currentUser = user[0];
    const nameParts = (currentUser.name || "").split(" ");
    
    const identifier: PatientIdentifier = {
      firstName: nameParts[0] || "",
      lastName: nameParts.slice(-1)[0] || "",
      middleName: nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : null,
      dateOfBirth: (currentUser as any).dateOfBirth || "",
      phoneNumber: (currentUser as any).phoneNumber,
      email: currentUser.email || undefined,
    };

    const { deterministicMatches, probabilisticMatches } = await this.findAllMatches(identifier);
    const allMatches = [...deterministicMatches, ...probabilisticMatches].filter(
      (m) => m.userId !== userId
    );

    const candidates: DuplicateCandidate[] = [];
    
    for (const match of allMatches) {
      const matchedUser = await db
        .select()
        .from(users)
        .where(eq(users.id, match.userId))
        .limit(1);
      
      if (matchedUser.length) {
        const u = matchedUser[0];
        const parts = (u.name || "").split(" ");
        candidates.push({
          userId: u.id,
          firstName: parts[0] || "",
          lastName: parts.slice(-1)[0] || "",
          middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : null,
          dateOfBirth: (u as any).dateOfBirth,
          matchResult: match,
        });
      }
    }

    return candidates;
  }

  isHighConfidenceMatch(result: MatchResult): boolean {
    return (
      result.matchType === "deterministic" ||
      result.confidence >= this.HIGH_PROBABILISTIC_THRESHOLD
    );
  }

  isMediumConfidenceMatch(result: MatchResult): boolean {
    return (
      result.confidence >= this.MEDIUM_PROBABILISTIC_THRESHOLD &&
      result.confidence < this.HIGH_PROBABILISTIC_THRESHOLD
    );
  }
}

export const patientMatchingService = new PatientMatchingService();
