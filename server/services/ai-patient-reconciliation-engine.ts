import { randomUUID } from "crypto";
import { createHash } from "crypto";
import OpenAI from "openai";
import { getAuditLogger } from "./integrations/factory";

export interface PatientRecord {
  id: string;
  sourceSystem: string;
  sourceId: string;
  data: PatientData;
  metadata: RecordMetadata;
}

export interface PatientData {
  identifier?: Array<{ system?: string; value: string }>;
  name?: Array<{ family?: string; given?: string[]; use?: string }>;
  gender?: string;
  birthDate?: string;
  address?: Array<{
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
  telecom?: Array<{ system?: string; value?: string; use?: string }>;
  ssn?: string;
  mrn?: string;
  email?: string;
  phone?: string;
}

export interface RecordMetadata {
  receivedAt: string;
  lastUpdated: string;
  confidence: number;
  sourceVersion?: string;
  author?: string;
}

export interface MatchCandidate {
  id: string;
  record1: PatientRecord;
  record2: PatientRecord;
  overallScore: number;
  matchType: "definite" | "probable" | "possible" | "unlikely";
  fieldScores: FieldMatchScore[];
  aiAnalysis?: AIMatchAnalysis;
  status: "pending" | "confirmed" | "rejected" | "auto_merged";
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
}

export interface FieldMatchScore {
  fieldName: string;
  score: number;
  weight: number;
  matchMethod: MatchMethod;
  record1Value?: string;
  record2Value?: string;
  isExact: boolean;
  details?: string;
}

export type MatchMethod = 
  | "exact"
  | "jaro_winkler"
  | "soundex"
  | "metaphone"
  | "date_fuzzy"
  | "address_normalized"
  | "phone_normalized"
  | "email_normalized"
  | "identifier_partial";

export interface AIMatchAnalysis {
  confidence: number;
  reasoning: string;
  recommendedAction: "auto_merge" | "manual_review" | "reject" | "request_more_data";
  riskFactors: string[];
  dataQualityIssues: string[];
  suggestedFieldResolutions: FieldResolution[];
}

export interface FieldResolution {
  fieldName: string;
  suggestedValue: unknown;
  confidence: number;
  reason: string;
  source: string;
}

export interface MergedPatient {
  id: string;
  sourceRecordIds: string[];
  mergedData: PatientData;
  mergeStrategy: MergeStrategy;
  conflicts: MergeConflict[];
  qualityScore: number;
  createdAt: string;
  createdBy: string;
  auditTrail: MergeAuditEntry[];
}

export interface MergeStrategy {
  id: string;
  name: string;
  fieldStrategies: Record<string, FieldMergeStrategy>;
  sourcePriority: string[];
  autoMergeThreshold: number;
}

export type FieldMergeStrategy = 
  | "most_recent"
  | "highest_confidence"
  | "source_priority"
  | "most_complete"
  | "consensus"
  | "ai_suggested";

export interface MergeConflict {
  fieldName: string;
  values: ConflictValue[];
  resolution?: unknown;
  resolutionMethod?: FieldMergeStrategy;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface ConflictValue {
  value: unknown;
  source: string;
  confidence: number;
  lastUpdated: string;
}

export interface MergeAuditEntry {
  action: string;
  timestamp: string;
  userId: string;
  details: Record<string, unknown>;
}

export interface ReconciliationStats {
  totalRecords: number;
  totalCandidates: number;
  definiteMatches: number;
  probableMatches: number;
  possibleMatches: number;
  autoMerged: number;
  pendingReview: number;
  rejected: number;
  qualityIssuesFound: number;
  averageMatchScore: number;
}

interface ReconciliationConfig {
  matchThresholds: {
    definite: number;
    probable: number;
    possible: number;
  };
  fieldWeights: Record<string, number>;
  autoMergeEnabled: boolean;
  autoMergeThreshold: number;
  qualityCheckEnabled: boolean;
}

const MATCH_FIELD_WEIGHTS: Record<string, number> = {
  ssn: 0.30,
  mrn: 0.25,
  identifier: 0.20,
  birthDate: 0.15,
  name: 0.20,
  gender: 0.05,
  address: 0.10,
  phone: 0.10,
  email: 0.10,
};

const DEFAULT_CONFIG: ReconciliationConfig = {
  matchThresholds: {
    definite: 0.95,
    probable: 0.80,
    possible: 0.60,
  },
  fieldWeights: MATCH_FIELD_WEIGHTS,
  autoMergeEnabled: true,
  autoMergeThreshold: 0.95,
  qualityCheckEnabled: true,
};

const patientRecords: Map<string, PatientRecord> = new Map();
const matchCandidates: Map<string, MatchCandidate> = new Map();
const mergedPatients: Map<string, MergedPatient> = new Map();
const mergeStrategies: Map<string, MergeStrategy> = new Map();

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

class AIPatientReconciliationEngine {
  private openai: OpenAI | null = null;
  private config: ReconciliationConfig = DEFAULT_CONFIG;

  constructor() {
    this.initializeOpenAI();
    this.initializeDefaultStrategies();
    this.initializeSampleData();
    console.log("[AIPatientReconciliation] Service initialized");
  }

  private initializeOpenAI(): void {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

    if (apiKey) {
      this.openai = new OpenAI({ apiKey, baseURL });
      console.log("[AIPatientReconciliation] OpenAI client configured");
    }
  }

  private initializeDefaultStrategies(): void {
    const defaultStrategy: MergeStrategy = {
      id: "default-patient-merge",
      name: "Default Patient Merge Strategy",
      fieldStrategies: {
        identifier: "most_complete",
        name: "most_complete",
        birthDate: "highest_confidence",
        gender: "consensus",
        address: "most_recent",
        telecom: "most_complete",
        ssn: "highest_confidence",
        mrn: "source_priority",
      },
      sourcePriority: ["Fasten Health", "local"],
      autoMergeThreshold: 0.95,
    };
    mergeStrategies.set(defaultStrategy.id, defaultStrategy);
  }

  private initializeSampleData(): void {
    const sampleRecords: Omit<PatientRecord, "id">[] = [
      {
        sourceSystem: "Fasten Health",
        sourceId: "epic-pat-001",
        data: {
          identifier: [{ system: "urn:oid:2.16.840.1.113883.4.1", value: "123-45-6789" }],
          name: [{ family: "Smith", given: ["John", "Robert"], use: "official" }],
          gender: "male",
          birthDate: "1985-03-15",
          address: [{ line: ["123 Main St"], city: "Boston", state: "MA", postalCode: "02101" }],
          telecom: [{ system: "phone", value: "617-555-0100", use: "home" }],
          mrn: "MRN-001",
        },
        metadata: {
          receivedAt: "2024-01-15T10:00:00Z",
          lastUpdated: "2024-06-01T14:30:00Z",
          confidence: 0.95,
        },
      },
      {
        sourceSystem: "Hospital Network",
        sourceId: "cerner-pat-001",
        data: {
          identifier: [{ system: "urn:oid:2.16.840.1.113883.4.1", value: "123-45-6789" }],
          name: [{ family: "Smith", given: ["John", "R"], use: "official" }],
          gender: "male",
          birthDate: "1985-03-15",
          address: [{ line: ["123 Main Street"], city: "Boston", state: "MA", postalCode: "02101-1234" }],
          telecom: [{ system: "phone", value: "(617) 555-0100", use: "home" }],
          mrn: "CRN-0001",
        },
        metadata: {
          receivedAt: "2024-02-20T08:00:00Z",
          lastUpdated: "2024-07-15T09:45:00Z",
          confidence: 0.90,
        },
      },
      {
        sourceSystem: "fastenhealth",
        sourceId: "athena-pat-002",
        data: {
          name: [{ family: "Johnson", given: ["Sarah", "Marie"], use: "official" }],
          gender: "female",
          birthDate: "1992-08-22",
          address: [{ line: ["456 Oak Ave", "Apt 2B"], city: "Cambridge", state: "MA", postalCode: "02139" }],
          telecom: [
            { system: "phone", value: "857-555-0200", use: "mobile" },
            { system: "email", value: "sjohnson@email.com", use: "home" },
          ],
          email: "sjohnson@email.com",
        },
        metadata: {
          receivedAt: "2024-03-10T12:00:00Z",
          lastUpdated: "2024-05-20T16:00:00Z",
          confidence: 0.85,
        },
      },
    ];

    for (const record of sampleRecords) {
      const id = randomUUID();
      patientRecords.set(id, { id, ...record });
    }
  }

  async addPatientRecord(record: Omit<PatientRecord, "id">): Promise<PatientRecord> {
    const id = randomUUID();
    const newRecord: PatientRecord = { id, ...record };
    patientRecords.set(id, newRecord);

    await this.logActivity("record_added", id, "system", {
      sourceSystem: record.sourceSystem,
      sourceId: hashIdentifier(record.sourceId),
    });

    return newRecord;
  }

  getPatientRecords(filters?: {
    sourceSystem?: string;
    hasMatches?: boolean;
  }): PatientRecord[] {
    let records = Array.from(patientRecords.values());

    if (filters?.sourceSystem) {
      records = records.filter((r) => r.sourceSystem === filters.sourceSystem);
    }

    if (filters?.hasMatches !== undefined) {
      const recordsWithMatches = new Set<string>();
      for (const candidate of Array.from(matchCandidates.values())) {
        recordsWithMatches.add(candidate.record1.id);
        recordsWithMatches.add(candidate.record2.id);
      }
      
      if (filters.hasMatches) {
        records = records.filter((r) => recordsWithMatches.has(r.id));
      } else {
        records = records.filter((r) => !recordsWithMatches.has(r.id));
      }
    }

    return records;
  }

  async findDuplicates(recordId?: string): Promise<MatchCandidate[]> {
    const records = Array.from(patientRecords.values());
    const candidates: MatchCandidate[] = [];

    const recordsToCheck = recordId
      ? records.filter((r) => r.id === recordId)
      : records;

    for (const record1 of recordsToCheck) {
      for (const record2 of records) {
        if (record1.id >= record2.id) continue;
        if (record1.sourceSystem === record2.sourceSystem && record1.sourceId === record2.sourceId) continue;

        const existingMatch = Array.from(matchCandidates.values()).find(
          (m) =>
            (m.record1.id === record1.id && m.record2.id === record2.id) ||
            (m.record1.id === record2.id && m.record2.id === record1.id)
        );
        if (existingMatch) continue;

        const matchResult = this.calculateMatchScore(record1, record2);
        
        if (matchResult.overallScore >= this.config.matchThresholds.possible) {
          const candidate: MatchCandidate = {
            id: randomUUID(),
            record1,
            record2,
            overallScore: matchResult.overallScore,
            matchType: this.determineMatchType(matchResult.overallScore),
            fieldScores: matchResult.fieldScores,
            status: "pending",
            createdAt: new Date().toISOString(),
          };

          matchCandidates.set(candidate.id, candidate);
          candidates.push(candidate);

          await this.logActivity("duplicate_identified", candidate.id, "system", {
            record1Hash: hashIdentifier(record1.id),
            record2Hash: hashIdentifier(record2.id),
            matchScore: matchResult.overallScore,
            matchType: candidate.matchType,
          });
        }
      }
    }

    return candidates;
  }

  private calculateMatchScore(
    record1: PatientRecord,
    record2: PatientRecord
  ): { overallScore: number; fieldScores: FieldMatchScore[] } {
    const fieldScores: FieldMatchScore[] = [];
    let totalWeight = 0;
    let weightedScore = 0;

    const ssnScore = this.matchSSN(record1.data, record2.data);
    if (ssnScore !== null) {
      fieldScores.push(ssnScore);
      weightedScore += ssnScore.score * ssnScore.weight;
      totalWeight += ssnScore.weight;
    }

    const mrnScore = this.matchMRN(record1.data, record2.data);
    if (mrnScore !== null) {
      fieldScores.push(mrnScore);
      weightedScore += mrnScore.score * mrnScore.weight;
      totalWeight += mrnScore.weight;
    }

    const identifierScore = this.matchIdentifiers(record1.data, record2.data);
    if (identifierScore !== null) {
      fieldScores.push(identifierScore);
      weightedScore += identifierScore.score * identifierScore.weight;
      totalWeight += identifierScore.weight;
    }

    const birthDateScore = this.matchBirthDate(record1.data, record2.data);
    if (birthDateScore !== null) {
      fieldScores.push(birthDateScore);
      weightedScore += birthDateScore.score * birthDateScore.weight;
      totalWeight += birthDateScore.weight;
    }

    const nameScore = this.matchName(record1.data, record2.data);
    if (nameScore !== null) {
      fieldScores.push(nameScore);
      weightedScore += nameScore.score * nameScore.weight;
      totalWeight += nameScore.weight;
    }

    const genderScore = this.matchGender(record1.data, record2.data);
    if (genderScore !== null) {
      fieldScores.push(genderScore);
      weightedScore += genderScore.score * genderScore.weight;
      totalWeight += genderScore.weight;
    }

    const addressScore = this.matchAddress(record1.data, record2.data);
    if (addressScore !== null) {
      fieldScores.push(addressScore);
      weightedScore += addressScore.score * addressScore.weight;
      totalWeight += addressScore.weight;
    }

    const phoneScore = this.matchPhone(record1.data, record2.data);
    if (phoneScore !== null) {
      fieldScores.push(phoneScore);
      weightedScore += phoneScore.score * phoneScore.weight;
      totalWeight += phoneScore.weight;
    }

    const emailScore = this.matchEmail(record1.data, record2.data);
    if (emailScore !== null) {
      fieldScores.push(emailScore);
      weightedScore += emailScore.score * emailScore.weight;
      totalWeight += emailScore.weight;
    }

    const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

    return { overallScore, fieldScores };
  }

  private matchSSN(data1: PatientData, data2: PatientData): FieldMatchScore | null {
    const ssn1 = data1.ssn || this.extractSSN(data1.identifier);
    const ssn2 = data2.ssn || this.extractSSN(data2.identifier);

    if (!ssn1 || !ssn2) return null;

    const normalized1 = ssn1.replace(/\D/g, "");
    const normalized2 = ssn2.replace(/\D/g, "");

    const isExact = normalized1 === normalized2;
    const score = isExact ? 1.0 : 0.0;

    return {
      fieldName: "ssn",
      score,
      weight: this.config.fieldWeights.ssn,
      matchMethod: "exact",
      record1Value: `***-**-${normalized1.slice(-4)}`,
      record2Value: `***-**-${normalized2.slice(-4)}`,
      isExact,
      details: isExact ? "SSN exact match" : "SSN mismatch",
    };
  }

  private extractSSN(identifiers?: Array<{ system?: string; value: string }>): string | null {
    if (!identifiers) return null;
    const ssnId = identifiers.find((id) => 
      id.system?.includes("2.16.840.1.113883.4.1") || id.system?.includes("ssn")
    );
    return ssnId?.value || null;
  }

  private matchMRN(data1: PatientData, data2: PatientData): FieldMatchScore | null {
    const mrn1 = data1.mrn;
    const mrn2 = data2.mrn;

    if (!mrn1 || !mrn2) return null;

    const normalized1 = mrn1.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const normalized2 = mrn2.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

    const isExact = normalized1 === normalized2;
    const score = isExact ? 1.0 : this.jaroWinkler(normalized1, normalized2);

    return {
      fieldName: "mrn",
      score,
      weight: this.config.fieldWeights.mrn,
      matchMethod: isExact ? "exact" : "jaro_winkler",
      record1Value: mrn1,
      record2Value: mrn2,
      isExact,
      details: isExact ? "MRN exact match" : `MRN similarity: ${(score * 100).toFixed(1)}%`,
    };
  }

  private matchIdentifiers(data1: PatientData, data2: PatientData): FieldMatchScore | null {
    const ids1 = data1.identifier || [];
    const ids2 = data2.identifier || [];

    if (ids1.length === 0 || ids2.length === 0) return null;

    let bestScore = 0;
    let matchDetails = "";

    for (const id1 of ids1) {
      for (const id2 of ids2) {
        if (id1.system === id2.system) {
          const normalized1 = id1.value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
          const normalized2 = id2.value.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
          
          if (normalized1 === normalized2) {
            bestScore = 1.0;
            matchDetails = `Identifier match on system ${id1.system}`;
            break;
          }
          
          const similarity = this.jaroWinkler(normalized1, normalized2);
          if (similarity > bestScore) {
            bestScore = similarity;
            matchDetails = `Partial identifier match: ${(similarity * 100).toFixed(1)}%`;
          }
        }
      }
      if (bestScore === 1.0) break;
    }

    return {
      fieldName: "identifier",
      score: bestScore,
      weight: this.config.fieldWeights.identifier,
      matchMethod: bestScore === 1.0 ? "exact" : "identifier_partial",
      record1Value: ids1.map((i) => i.value).join(", "),
      record2Value: ids2.map((i) => i.value).join(", "),
      isExact: bestScore === 1.0,
      details: matchDetails || "No matching identifiers",
    };
  }

  private matchBirthDate(data1: PatientData, data2: PatientData): FieldMatchScore | null {
    const bd1 = data1.birthDate;
    const bd2 = data2.birthDate;

    if (!bd1 || !bd2) return null;

    const date1 = new Date(bd1);
    const date2 = new Date(bd2);

    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return null;

    const isExact = bd1 === bd2;
    let score = isExact ? 1.0 : 0;

    if (!isExact) {
      const daysDiff = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff <= 1) {
        score = 0.9;
      } else if (daysDiff <= 30) {
        score = 0.5;
      } else if (daysDiff <= 365) {
        score = 0.2;
      }
    }

    return {
      fieldName: "birthDate",
      score,
      weight: this.config.fieldWeights.birthDate,
      matchMethod: isExact ? "exact" : "date_fuzzy",
      record1Value: bd1,
      record2Value: bd2,
      isExact,
      details: isExact ? "Birth date exact match" : `Birth date difference: ${Math.round(Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24))} days`,
    };
  }

  private matchName(data1: PatientData, data2: PatientData): FieldMatchScore | null {
    const names1 = data1.name || [];
    const names2 = data2.name || [];

    if (names1.length === 0 || names2.length === 0) return null;

    let bestScore = 0;

    for (const name1 of names1) {
      for (const name2 of names2) {
        const family1 = (name1.family || "").toLowerCase().trim();
        const family2 = (name2.family || "").toLowerCase().trim();
        const given1 = (name1.given || []).map((g) => g.toLowerCase().trim());
        const given2 = (name2.given || []).map((g) => g.toLowerCase().trim());

        let familyScore = 0;
        if (family1 && family2) {
          if (family1 === family2) {
            familyScore = 1.0;
          } else {
            familyScore = Math.max(
              this.jaroWinkler(family1, family2),
              this.soundexMatch(family1, family2) ? 0.8 : 0
            );
          }
        }

        let givenScore = 0;
        if (given1.length > 0 && given2.length > 0) {
          const firstName1 = given1[0];
          const firstName2 = given2[0];
          
          if (firstName1 === firstName2) {
            givenScore = 1.0;
          } else if (firstName1.charAt(0) === firstName2.charAt(0)) {
            givenScore = Math.max(0.5, this.jaroWinkler(firstName1, firstName2));
          } else {
            givenScore = this.jaroWinkler(firstName1, firstName2);
          }
        }

        const nameScore = familyScore * 0.6 + givenScore * 0.4;
        if (nameScore > bestScore) {
          bestScore = nameScore;
        }
      }
    }

    const name1Str = names1.map((n) => `${(n.given || []).join(" ")} ${n.family || ""}`).join("; ");
    const name2Str = names2.map((n) => `${(n.given || []).join(" ")} ${n.family || ""}`).join("; ");

    return {
      fieldName: "name",
      score: bestScore,
      weight: this.config.fieldWeights.name,
      matchMethod: bestScore === 1.0 ? "exact" : "jaro_winkler",
      record1Value: name1Str,
      record2Value: name2Str,
      isExact: bestScore === 1.0,
      details: `Name similarity: ${(bestScore * 100).toFixed(1)}%`,
    };
  }

  private matchGender(data1: PatientData, data2: PatientData): FieldMatchScore | null {
    const gender1 = data1.gender?.toLowerCase();
    const gender2 = data2.gender?.toLowerCase();

    if (!gender1 || !gender2) return null;

    const isExact = gender1 === gender2;

    return {
      fieldName: "gender",
      score: isExact ? 1.0 : 0.0,
      weight: this.config.fieldWeights.gender,
      matchMethod: "exact",
      record1Value: gender1,
      record2Value: gender2,
      isExact,
      details: isExact ? "Gender match" : "Gender mismatch",
    };
  }

  private matchAddress(data1: PatientData, data2: PatientData): FieldMatchScore | null {
    const addresses1 = data1.address || [];
    const addresses2 = data2.address || [];

    if (addresses1.length === 0 || addresses2.length === 0) return null;

    let bestScore = 0;

    for (const addr1 of addresses1) {
      for (const addr2 of addresses2) {
        const normalized1 = this.normalizeAddress(addr1);
        const normalized2 = this.normalizeAddress(addr2);

        const postalMatch = (addr1.postalCode?.replace(/\D/g, "").slice(0, 5) || "") ===
                           (addr2.postalCode?.replace(/\D/g, "").slice(0, 5) || "");
        
        const cityMatch = (addr1.city?.toLowerCase() || "") === (addr2.city?.toLowerCase() || "");
        const stateMatch = (addr1.state?.toLowerCase() || "") === (addr2.state?.toLowerCase() || "");

        let score = 0;
        if (normalized1 === normalized2) {
          score = 1.0;
        } else {
          score = this.jaroWinkler(normalized1, normalized2) * 0.5;
          if (postalMatch) score += 0.25;
          if (cityMatch) score += 0.15;
          if (stateMatch) score += 0.10;
        }

        if (score > bestScore) {
          bestScore = score;
        }
      }
    }

    return {
      fieldName: "address",
      score: bestScore,
      weight: this.config.fieldWeights.address,
      matchMethod: "address_normalized",
      record1Value: this.formatAddress(addresses1[0]),
      record2Value: this.formatAddress(addresses2[0]),
      isExact: bestScore === 1.0,
      details: `Address similarity: ${(bestScore * 100).toFixed(1)}%`,
    };
  }

  private matchPhone(data1: PatientData, data2: PatientData): FieldMatchScore | null {
    const phones1 = this.extractPhones(data1);
    const phones2 = this.extractPhones(data2);

    if (phones1.length === 0 || phones2.length === 0) return null;

    let bestScore = 0;

    for (const phone1 of phones1) {
      for (const phone2 of phones2) {
        const normalized1 = phone1.replace(/\D/g, "");
        const normalized2 = phone2.replace(/\D/g, "");

        if (normalized1 === normalized2) {
          bestScore = 1.0;
          break;
        }

        if (normalized1.length >= 10 && normalized2.length >= 10) {
          const last10_1 = normalized1.slice(-10);
          const last10_2 = normalized2.slice(-10);
          if (last10_1 === last10_2) {
            bestScore = Math.max(bestScore, 0.95);
          }
        }
      }
      if (bestScore === 1.0) break;
    }

    return {
      fieldName: "phone",
      score: bestScore,
      weight: this.config.fieldWeights.phone,
      matchMethod: "phone_normalized",
      record1Value: phones1[0] || "",
      record2Value: phones2[0] || "",
      isExact: bestScore === 1.0,
      details: bestScore > 0 ? "Phone number match" : "Phone numbers differ",
    };
  }

  private matchEmail(data1: PatientData, data2: PatientData): FieldMatchScore | null {
    const emails1 = this.extractEmails(data1);
    const emails2 = this.extractEmails(data2);

    if (emails1.length === 0 || emails2.length === 0) return null;

    let bestScore = 0;

    for (const email1 of emails1) {
      for (const email2 of emails2) {
        const normalized1 = email1.toLowerCase().trim();
        const normalized2 = email2.toLowerCase().trim();

        if (normalized1 === normalized2) {
          bestScore = 1.0;
          break;
        }

        const similarity = this.jaroWinkler(normalized1, normalized2);
        if (similarity > bestScore) {
          bestScore = similarity;
        }
      }
      if (bestScore === 1.0) break;
    }

    return {
      fieldName: "email",
      score: bestScore,
      weight: this.config.fieldWeights.email,
      matchMethod: "email_normalized",
      record1Value: emails1[0] || "",
      record2Value: emails2[0] || "",
      isExact: bestScore === 1.0,
      details: bestScore === 1.0 ? "Email exact match" : `Email similarity: ${(bestScore * 100).toFixed(1)}%`,
    };
  }

  private extractPhones(data: PatientData): string[] {
    const phones: string[] = [];
    if (data.phone) phones.push(data.phone);
    if (data.telecom) {
      for (const t of data.telecom) {
        if (t.system === "phone" && t.value) {
          phones.push(t.value);
        }
      }
    }
    return phones;
  }

  private extractEmails(data: PatientData): string[] {
    const emails: string[] = [];
    if (data.email) emails.push(data.email);
    if (data.telecom) {
      for (const t of data.telecom) {
        if (t.system === "email" && t.value) {
          emails.push(t.value);
        }
      }
    }
    return emails;
  }

  private normalizeAddress(address: NonNullable<PatientData["address"]>[0]): string {
    const parts = [
      ...(address.line || []),
      address.city,
      address.state,
      address.postalCode?.replace(/\D/g, "").slice(0, 5),
    ]
      .filter(Boolean)
      .map((p) => 
        p!.toLowerCase()
          .replace(/street/gi, "st")
          .replace(/avenue/gi, "ave")
          .replace(/boulevard/gi, "blvd")
          .replace(/drive/gi, "dr")
          .replace(/road/gi, "rd")
          .replace(/apartment/gi, "apt")
          .replace(/suite/gi, "ste")
          .replace(/[^a-z0-9\s]/gi, "")
          .trim()
      );
    return parts.join(" ");
  }

  private formatAddress(address?: NonNullable<PatientData["address"]>[0]): string {
    if (!address) return "";
    return [
      ...(address.line || []),
      address.city,
      address.state,
      address.postalCode,
    ]
      .filter(Boolean)
      .join(", ");
  }

  private jaroWinkler(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0.0;

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

    if (matches === 0) return 0.0;

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

  private soundexMatch(s1: string, s2: string): boolean {
    return this.soundex(s1) === this.soundex(s2);
  }

  private soundex(s: string): string {
    const a = s.toLowerCase().split("");
    const firstLetter = a[0];
    const codes: Record<string, string> = {
      b: "1", f: "1", p: "1", v: "1",
      c: "2", g: "2", j: "2", k: "2", q: "2", s: "2", x: "2", z: "2",
      d: "3", t: "3",
      l: "4",
      m: "5", n: "5",
      r: "6",
    };

    const coded = a
      .map((char) => codes[char] || "")
      .join("")
      .replace(/(\d)\1+/g, "$1")
      .replace(/^/, firstLetter.toUpperCase())
      .replace(/[aeiouyhw]/gi, "")
      .padEnd(4, "0")
      .slice(0, 4);

    return coded;
  }

  private determineMatchType(score: number): MatchCandidate["matchType"] {
    if (score >= this.config.matchThresholds.definite) return "definite";
    if (score >= this.config.matchThresholds.probable) return "probable";
    if (score >= this.config.matchThresholds.possible) return "possible";
    return "unlikely";
  }

  async getAIMatchAnalysis(candidateId: string): Promise<AIMatchAnalysis | null> {
    const candidate = matchCandidates.get(candidateId);
    if (!candidate) return null;

    if (!this.openai) {
      return this.generateFallbackAnalysis(candidate);
    }

    try {
      const redactedCandidate = this.redactPHI(candidate);

      const prompt = `You are a patient data reconciliation expert. Analyze this potential patient duplicate match and provide recommendations.

IMPORTANT: This is NOT clinical decision support. You are ONLY analyzing data quality and matching confidence, NOT providing medical advice.

Match Details:
- Overall Match Score: ${(candidate.overallScore * 100).toFixed(1)}%
- Match Type: ${candidate.matchType}
- Source Systems: ${candidate.record1.sourceSystem} vs ${candidate.record2.sourceSystem}

Field-by-Field Comparison:
${candidate.fieldScores.map((fs) => 
  `- ${fs.fieldName}: ${(fs.score * 100).toFixed(1)}% match (${fs.matchMethod})`
).join("\n")}

Analyze this match and provide:
1. Your confidence level (0-1) that these are the same patient
2. Brief reasoning for your assessment
3. Recommended action: "auto_merge", "manual_review", "reject", or "request_more_data"
4. Any risk factors that should be considered
5. Data quality issues detected
6. Suggested field resolutions for any conflicts

Respond in JSON format:
{
  "confidence": number,
  "reasoning": "string",
  "recommendedAction": "string",
  "riskFactors": ["string"],
  "dataQualityIssues": ["string"],
  "suggestedFieldResolutions": [{"fieldName": "string", "reason": "string", "source": "string"}]
}`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a patient data quality expert analyzing duplicate patient records for reconciliation.

CRITICAL NO-CDS POLICY (STRICTLY ENFORCED):
- You MUST NEVER provide clinical decision support, medical advice, or treatment recommendations
- You MUST NEVER suggest diagnoses, symptom assessments, or health risk predictions
- You MUST ONLY analyze data quality, matching confidence, and record reconciliation
- If asked about clinical matters, respond: "I cannot provide clinical advice. I only analyze data quality."
- Focus exclusively on: data matching algorithms, field consistency, source reliability, merge strategies

Your role is LIMITED to data quality analysis for HIPAA-compliant patient record reconciliation.`,
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return this.generateFallbackAnalysis(candidate);
      }

      const analysis = JSON.parse(content) as AIMatchAnalysis;
      
      candidate.aiAnalysis = analysis;
      matchCandidates.set(candidateId, candidate);

      await this.logActivity("ai_analysis_generated", candidateId, "system", {
        confidence: analysis.confidence,
        recommendedAction: analysis.recommendedAction,
      });

      return analysis;
    } catch (error) {
      console.error("[AIPatientReconciliation] AI analysis error:", error);
      return this.generateFallbackAnalysis(candidate);
    }
  }

  private generateFallbackAnalysis(candidate: MatchCandidate): AIMatchAnalysis {
    const exactMatches = candidate.fieldScores.filter((f) => f.isExact);
    const highScoreFields = candidate.fieldScores.filter((f) => f.score >= 0.9);
    const lowScoreFields = candidate.fieldScores.filter((f) => f.score < 0.5 && f.score > 0);

    let recommendedAction: AIMatchAnalysis["recommendedAction"] = "manual_review";
    if (candidate.overallScore >= 0.95 && exactMatches.length >= 3) {
      recommendedAction = "auto_merge";
    } else if (candidate.overallScore < 0.65) {
      recommendedAction = "reject";
    } else if (candidate.fieldScores.length < 3) {
      recommendedAction = "request_more_data";
    }

    const riskFactors: string[] = [];
    if (lowScoreFields.length > 0) {
      riskFactors.push(`Low match scores in: ${lowScoreFields.map((f) => f.fieldName).join(", ")}`);
    }
    if (candidate.record1.sourceSystem === candidate.record2.sourceSystem) {
      riskFactors.push("Records from same source system - may be data entry variations");
    }

    const dataQualityIssues: string[] = [];
    for (const fs of candidate.fieldScores) {
      if (fs.score < 0.5 && fs.score > 0) {
        dataQualityIssues.push(`Potential data inconsistency in ${fs.fieldName}`);
      }
    }

    const suggestedFieldResolutions: FieldResolution[] = [];
    for (const fs of candidate.fieldScores) {
      if (!fs.isExact && fs.score > 0) {
        suggestedFieldResolutions.push({
          fieldName: fs.fieldName,
          suggestedValue: candidate.record1.metadata.confidence >= candidate.record2.metadata.confidence
            ? fs.record1Value
            : fs.record2Value,
          confidence: Math.max(candidate.record1.metadata.confidence, candidate.record2.metadata.confidence),
          reason: "Selected based on source confidence",
          source: candidate.record1.metadata.confidence >= candidate.record2.metadata.confidence
            ? candidate.record1.sourceSystem
            : candidate.record2.sourceSystem,
        });
      }
    }

    return {
      confidence: candidate.overallScore,
      reasoning: `Match based on ${exactMatches.length} exact field matches and ${highScoreFields.length - exactMatches.length} high-similarity matches. Overall probabilistic score: ${(candidate.overallScore * 100).toFixed(1)}%.`,
      recommendedAction,
      riskFactors,
      dataQualityIssues,
      suggestedFieldResolutions,
    };
  }

  private redactPHI(candidate: MatchCandidate): Record<string, unknown> {
    return {
      id: candidate.id,
      overallScore: candidate.overallScore,
      matchType: candidate.matchType,
      sourceSystems: [candidate.record1.sourceSystem, candidate.record2.sourceSystem],
      fieldScores: candidate.fieldScores.map((fs) => ({
        fieldName: fs.fieldName,
        score: fs.score,
        matchMethod: fs.matchMethod,
        isExact: fs.isExact,
      })),
    };
  }

  private maskFieldValue(fieldName: string, value?: string): string {
    if (!value) return "[not provided]";
    
    const fieldLower = fieldName.toLowerCase();
    
    if (fieldLower === "ssn") {
      return value;
    }
    if (fieldLower === "email") {
      const [local, domain] = value.split("@");
      if (local && domain) {
        return `${local.charAt(0)}***@${domain}`;
      }
      return "***@***";
    }
    if (fieldLower === "phone") {
      const digits = value.replace(/\D/g, "");
      if (digits.length >= 4) {
        return `***-***-${digits.slice(-4)}`;
      }
      return "***";
    }
    if (fieldLower === "mrn" || fieldLower === "identifier") {
      if (value.length > 4) {
        return `${value.slice(0, 2)}***${value.slice(-2)}`;
      }
      return "***";
    }
    if (fieldLower === "name") {
      const names = value.split(" ");
      if (names.length > 0) {
        const lastName = names[names.length - 1];
        const initials = names.slice(0, -1).map((n) => n.charAt(0) + ".").join(" ");
        return initials ? `${initials} ${lastName}` : lastName;
      }
      return value;
    }
    if (fieldLower === "birthdate") {
      const parts = value.split("-");
      if (parts.length === 3) {
        return `${parts[0]}-**-**`;
      }
      return "****-**-**";
    }
    if (fieldLower === "address") {
      if (value.includes(",")) {
        const parts = value.split(",");
        const cityState = parts.slice(-2).join(",").trim();
        return `*** ${cityState}`;
      }
      return "*** (address)";
    }
    
    return value;
  }

  getMaskedFieldScores(candidateId: string): FieldMatchScore[] | null {
    const candidate = matchCandidates.get(candidateId);
    if (!candidate) return null;
    
    return candidate.fieldScores.map((fs) => ({
      ...fs,
      record1Value: this.maskFieldValue(fs.fieldName, fs.record1Value),
      record2Value: this.maskFieldValue(fs.fieldName, fs.record2Value),
    }));
  }

  getMaskedCandidate(id: string): {
    id: string;
    overallScore: number;
    matchType: MatchCandidate["matchType"];
    status: MatchCandidate["status"];
    createdAt: string;
    reviewedAt?: string;
    reviewedBy?: string;
    reviewNotes?: string;
    aiAnalysis?: AIMatchAnalysis;
    record1Summary: { id: string; sourceSystem: string; confidence: number };
    record2Summary: { id: string; sourceSystem: string; confidence: number };
    maskedFieldScores: FieldMatchScore[];
  } | null {
    const candidate = matchCandidates.get(id);
    if (!candidate) return null;
    
    return {
      id: candidate.id,
      overallScore: candidate.overallScore,
      matchType: candidate.matchType,
      status: candidate.status,
      createdAt: candidate.createdAt,
      reviewedAt: candidate.reviewedAt,
      reviewedBy: candidate.reviewedBy,
      reviewNotes: candidate.reviewNotes,
      aiAnalysis: candidate.aiAnalysis,
      record1Summary: {
        id: hashIdentifier(candidate.record1.id),
        sourceSystem: candidate.record1.sourceSystem,
        confidence: candidate.record1.metadata.confidence,
      },
      record2Summary: {
        id: hashIdentifier(candidate.record2.id),
        sourceSystem: candidate.record2.sourceSystem,
        confidence: candidate.record2.metadata.confidence,
      },
      maskedFieldScores: candidate.fieldScores.map((fs) => ({
        ...fs,
        record1Value: this.maskFieldValue(fs.fieldName, fs.record1Value),
        record2Value: this.maskFieldValue(fs.fieldName, fs.record2Value),
      })),
    };
  }

  async mergePatients(
    candidateId: string,
    userId: string,
    strategyId?: string,
    manualResolutions?: Record<string, unknown>
  ): Promise<MergedPatient | null> {
    const candidate = matchCandidates.get(candidateId);
    if (!candidate) return null;

    const strategy = strategyId
      ? mergeStrategies.get(strategyId)
      : mergeStrategies.get("default-patient-merge");
    
    if (!strategy) return null;

    const conflicts: MergeConflict[] = [];
    const mergedData: PatientData = {};

    for (const fs of candidate.fieldScores) {
      if (!fs.isExact && fs.score < 1.0) {
        const conflict: MergeConflict = {
          fieldName: fs.fieldName,
          values: [
            {
              value: fs.record1Value,
              source: candidate.record1.sourceSystem,
              confidence: candidate.record1.metadata.confidence,
              lastUpdated: candidate.record1.metadata.lastUpdated,
            },
            {
              value: fs.record2Value,
              source: candidate.record2.sourceSystem,
              confidence: candidate.record2.metadata.confidence,
              lastUpdated: candidate.record2.metadata.lastUpdated,
            },
          ],
          resolved: false,
        };

        if (manualResolutions && manualResolutions[fs.fieldName] !== undefined) {
          conflict.resolution = manualResolutions[fs.fieldName];
          conflict.resolutionMethod = "manual" as FieldMergeStrategy;
          conflict.resolved = true;
          conflict.resolvedBy = userId;
          conflict.resolvedAt = new Date().toISOString();
        } else {
          const fieldStrategy = strategy.fieldStrategies[fs.fieldName] || "highest_confidence";
          conflict.resolution = this.resolveConflict(conflict, fieldStrategy, strategy.sourcePriority);
          conflict.resolutionMethod = fieldStrategy;
          conflict.resolved = true;
        }

        conflicts.push(conflict);
        (mergedData as Record<string, unknown>)[fs.fieldName] = conflict.resolution;
      } else {
        (mergedData as Record<string, unknown>)[fs.fieldName] = 
          (candidate.record1.data as Record<string, unknown>)[fs.fieldName] ||
          (candidate.record2.data as Record<string, unknown>)[fs.fieldName];
      }
    }

    for (const key of Object.keys(candidate.record1.data)) {
      if (!(key in mergedData)) {
        (mergedData as Record<string, unknown>)[key] = (candidate.record1.data as Record<string, unknown>)[key];
      }
    }
    for (const key of Object.keys(candidate.record2.data)) {
      if (!(key in mergedData)) {
        (mergedData as Record<string, unknown>)[key] = (candidate.record2.data as Record<string, unknown>)[key];
      }
    }

    let qualityScore = 100;
    if (this.config.qualityCheckEnabled) {
      const qualityIssues = await this.runQualityCheck(mergedData);
      qualityScore = Math.max(0, 100 - qualityIssues.length * 10);
    }

    const mergedPatient: MergedPatient = {
      id: randomUUID(),
      sourceRecordIds: [candidate.record1.id, candidate.record2.id],
      mergedData,
      mergeStrategy: strategy,
      conflicts,
      qualityScore,
      createdAt: new Date().toISOString(),
      createdBy: hashIdentifier(userId),
      auditTrail: [
        {
          action: "merge_created",
          timestamp: new Date().toISOString(),
          userId: hashIdentifier(userId),
          details: {
            candidateId,
            strategyId: strategy.id,
            conflictCount: conflicts.length,
          },
        },
      ],
    };

    mergedPatients.set(mergedPatient.id, mergedPatient);

    candidate.status = "auto_merged";
    candidate.reviewedAt = new Date().toISOString();
    candidate.reviewedBy = hashIdentifier(userId);
    matchCandidates.set(candidateId, candidate);

    await this.logActivity("patients_merged", mergedPatient.id, userId, {
      sourceRecords: [hashIdentifier(candidate.record1.id), hashIdentifier(candidate.record2.id)],
      conflictCount: conflicts.length,
      qualityScore,
    });

    return mergedPatient;
  }

  private resolveConflict(
    conflict: MergeConflict,
    strategy: FieldMergeStrategy,
    sourcePriority: string[]
  ): unknown {
    const values = conflict.values;

    switch (strategy) {
      case "most_recent": {
        const sorted = [...values].sort(
          (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
        );
        return sorted[0].value;
      }
      case "highest_confidence": {
        const sorted = [...values].sort((a, b) => b.confidence - a.confidence);
        return sorted[0].value;
      }
      case "source_priority": {
        for (const source of sourcePriority) {
          const match = values.find((v) => v.source === source);
          if (match) return match.value;
        }
        return values[0].value;
      }
      case "most_complete": {
        const sorted = [...values].sort((a, b) => {
          const lenA = JSON.stringify(a.value || "").length;
          const lenB = JSON.stringify(b.value || "").length;
          return lenB - lenA;
        });
        return sorted[0].value;
      }
      case "consensus": {
        const valueCounts = new Map<string, number>();
        for (const v of values) {
          const key = JSON.stringify(v.value);
          valueCounts.set(key, (valueCounts.get(key) || 0) + 1);
        }
        let maxCount = 0;
        let consensusValue = values[0].value;
        for (const [key, count] of Array.from(valueCounts.entries())) {
          if (count > maxCount) {
            maxCount = count;
            consensusValue = JSON.parse(key);
          }
        }
        return consensusValue;
      }
      default:
        return values[0].value;
    }
  }

  private async runQualityCheck(data: PatientData): Promise<string[]> {
    const issues: string[] = [];

    if (!data.name || data.name.length === 0) {
      issues.push("Missing patient name");
    }
    if (!data.birthDate) {
      issues.push("Missing birth date");
    }
    if (!data.gender) {
      issues.push("Missing gender");
    }
    if (!data.identifier || data.identifier.length === 0) {
      issues.push("Missing patient identifiers");
    }

    if (data.birthDate) {
      const bd = new Date(data.birthDate);
      const now = new Date();
      if (bd > now) {
        issues.push("Birth date is in the future");
      }
      const age = (now.getTime() - bd.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (age > 130) {
        issues.push("Birth date indicates age over 130 years");
      }
    }

    return issues;
  }

  getMatchCandidates(filters?: {
    status?: MatchCandidate["status"];
    matchType?: MatchCandidate["matchType"];
    minScore?: number;
  }): MatchCandidate[] {
    let candidates = Array.from(matchCandidates.values());

    if (filters?.status) {
      candidates = candidates.filter((c) => c.status === filters.status);
    }
    if (filters?.matchType) {
      candidates = candidates.filter((c) => c.matchType === filters.matchType);
    }
    if (filters?.minScore !== undefined) {
      const minScore = filters.minScore;
      candidates = candidates.filter((c) => c.overallScore >= minScore);
    }

    return candidates.sort((a, b) => b.overallScore - a.overallScore);
  }

  getMatchCandidate(id: string): MatchCandidate | undefined {
    return matchCandidates.get(id);
  }

  async updateCandidateStatus(
    candidateId: string,
    status: MatchCandidate["status"],
    userId: string,
    notes?: string
  ): Promise<MatchCandidate | null> {
    const candidate = matchCandidates.get(candidateId);
    if (!candidate) return null;

    candidate.status = status;
    candidate.reviewedAt = new Date().toISOString();
    candidate.reviewedBy = hashIdentifier(userId);
    if (notes) candidate.reviewNotes = notes;

    matchCandidates.set(candidateId, candidate);

    await this.logActivity("candidate_status_updated", candidateId, userId, {
      newStatus: status,
      hasNotes: !!notes,
    });

    return candidate;
  }

  getMergedPatients(): MergedPatient[] {
    return Array.from(mergedPatients.values());
  }

  getMergedPatient(id: string): MergedPatient | undefined {
    return mergedPatients.get(id);
  }

  getReconciliationStats(): ReconciliationStats {
    const candidates = Array.from(matchCandidates.values());
    const records = Array.from(patientRecords.values());

    const definiteMatches = candidates.filter((c) => c.matchType === "definite").length;
    const probableMatches = candidates.filter((c) => c.matchType === "probable").length;
    const possibleMatches = candidates.filter((c) => c.matchType === "possible").length;
    const autoMerged = candidates.filter((c) => c.status === "auto_merged").length;
    const pendingReview = candidates.filter((c) => c.status === "pending").length;
    const rejected = candidates.filter((c) => c.status === "rejected").length;

    const qualityIssuesFound = candidates.reduce((count, c) => {
      return count + (c.aiAnalysis?.dataQualityIssues?.length || 0);
    }, 0);

    const avgScore = candidates.length > 0
      ? candidates.reduce((sum, c) => sum + c.overallScore, 0) / candidates.length
      : 0;

    return {
      totalRecords: records.length,
      totalCandidates: candidates.length,
      definiteMatches,
      probableMatches,
      possibleMatches,
      autoMerged,
      pendingReview,
      rejected,
      qualityIssuesFound,
      averageMatchScore: avgScore,
    };
  }

  getMergeStrategies(): MergeStrategy[] {
    return Array.from(mergeStrategies.values());
  }

  addMergeStrategy(strategy: Omit<MergeStrategy, "id">): MergeStrategy {
    const id = randomUUID();
    const newStrategy: MergeStrategy = { id, ...strategy };
    mergeStrategies.set(id, newStrategy);
    return newStrategy;
  }

  updateConfig(newConfig: Partial<ReconciliationConfig>): ReconciliationConfig {
    this.config = { ...this.config, ...newConfig };
    return this.config;
  }

  getConfig(): ReconciliationConfig {
    return { ...this.config };
  }

  private async logActivity(
    action: string,
    resourceId: string,
    userId: string,
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      const auditLogger = getAuditLogger();
      await auditLogger.log({
        userId: hashIdentifier(userId),
        userRole: "system",
        action: "create" as const,
        resourceType: "PatientReconciliation",
        resourceId: hashIdentifier(resourceId),
        patientId: hashIdentifier("reconciliation"),
        ipAddress: hashIdentifier("internal"),
        userAgent: "ai-reconciliation-engine",
        requestPath: "/api/patient-reconciliation",
        requestMethod: "POST",
        responseStatus: 200,
        responseTimeMs: 0,
        phiAccessed: true,
        details: {
          reconciliationAction: action,
          ...details,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (e) {
      console.error("[AIPatientReconciliation] Audit logging failed:", e);
    }
  }
}

export const aiPatientReconciliationEngine = new AIPatientReconciliationEngine();
