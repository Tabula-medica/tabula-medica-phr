import { logPhiAccess } from "../security/hipaa-audit";
import { lookupCVX, normalizeCVXCode, cvxCodesExactMatch, cvxCodesMatchByGroup, resolveCVXFromInput, type CVXEntry } from "./cvx-registry";

export type ReconciliationStatus = "pending" | "auto_verified" | "needs_review" | "resolved" | "rejected";
export type ResolutionType = "accept_local" | "accept_iis" | "merge" | "manual_entry" | "reject";
export type MatchConfidenceLevel = "high" | "medium" | "low" | "no_match";
export type DiscrepancyFieldType = "vaccine_name" | "date" | "lot_number" | "manufacturer" | "dose_number" | "site" | "route";

export interface VaccineNameMapping {
  cvxCode: string;
  standardName: string;
  aliases: string[];
  tradenames: string[];
  abbreviations: string[];
}

export interface LocalImmunizationRecord {
  id: string;
  patientId: string;
  vaccineCode: string;
  vaccineName: string;
  administeredDate: string;
  lotNumber?: string;
  manufacturer?: string;
  doseNumber?: number;
  site?: string;
  route?: string;
  source: "patient_reported" | "ehr_imported" | "clinician_entered" | "iis_verified";
  createdAt: string;
  updatedAt: string;
}

export interface IISImmunizationRecord {
  id: string;
  patientId: string;
  iisSource: string;
  stateCode: string;
  vaccineCode: string;
  vaccineName: string;
  administeredDate: string;
  lotNumber?: string;
  manufacturer?: string;
  doseNumber?: number;
  site?: string;
  route?: string;
  reportingFacility?: string;
  retrievedAt: string;
}

export interface FieldDiscrepancy {
  field: DiscrepancyFieldType;
  localValue: string;
  iisValue: string;
  severity: "critical" | "major" | "minor";
  suggestedResolution: "accept_local" | "accept_iis" | "manual_review";
  confidence: number;
}

export interface ReconciliationMatch {
  id: string;
  localRecordId: string;
  iisRecordId: string;
  patientId: string;
  matchConfidence: number;
  confidenceLevel: MatchConfidenceLevel;
  matchingFactors: MatchingFactor[];
  discrepancies: FieldDiscrepancy[];
  status: ReconciliationStatus;
  resolution?: ReconciliationResolution;
  autoVerified: boolean;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface MatchingFactor {
  factor: string;
  score: number;
  weight: number;
  details: string;
}

export interface ReconciliationResolution {
  type: ResolutionType;
  resolvedBy: string;
  resolvedAt: string;
  notes?: string;
  finalValues: Record<string, string>;
}

export interface ReconciliationAuditLog {
  id: string;
  matchId: string;
  action: "created" | "auto_verified" | "flagged_for_review" | "resolved" | "rejected" | "reopened";
  userId: string;
  userRole: string;
  previousStatus?: ReconciliationStatus;
  newStatus: ReconciliationStatus;
  details: string;
  timestamp: string;
}

export interface ReconciliationStats {
  totalMatches: number;
  pendingReview: number;
  autoVerified: number;
  manuallyResolved: number;
  rejected: number;
  averageConfidence: number;
  matchesByConfidenceLevel: Record<MatchConfidenceLevel, number>;
  commonDiscrepancies: { field: DiscrepancyFieldType; count: number }[];
  processingStats: {
    totalProcessed24h: number;
    autoVerified24h: number;
    flaggedForReview24h: number;
  };
}

export interface ReconciliationConfig {
  autoVerifyThreshold: number;
  reviewThreshold: number;
  dateToleranceDays: number;
  enableFuzzyMatching: boolean;
  weights: {
    vaccineCode: number;
    vaccineName: number;
    date: number;
    lotNumber: number;
    manufacturer: number;
    doseNumber: number;
  };
}

const VACCINE_NAME_MAPPINGS: VaccineNameMapping[] = [
  {
    cvxCode: "208",
    standardName: "Pfizer-BioNTech COVID-19",
    aliases: ["Pfizer COVID", "Pfizer COVID-19", "Pfizer-BioNTech", "Comirnaty", "BNT162b2"],
    tradenames: ["Comirnaty"],
    abbreviations: ["PFR", "PFIZER"]
  },
  {
    cvxCode: "207",
    standardName: "Moderna COVID-19",
    aliases: ["Moderna COVID", "Moderna COVID-19", "Spikevax", "mRNA-1273"],
    tradenames: ["Spikevax"],
    abbreviations: ["MOD", "MODERNA"]
  },
  {
    cvxCode: "212",
    standardName: "Janssen COVID-19",
    aliases: ["Johnson & Johnson COVID", "J&J COVID", "Janssen", "Ad26.COV2.S"],
    tradenames: ["Janssen"],
    abbreviations: ["JNJ", "J&J", "JANSSEN"]
  },
  {
    cvxCode: "140",
    standardName: "Influenza, seasonal, injectable, preservative free",
    aliases: ["Flu Shot", "Seasonal Flu", "Influenza Vaccine", "Flu Vaccine"],
    tradenames: ["Fluzone", "Fluarix", "Flucelvax", "Afluria"],
    abbreviations: ["FLU", "IIV"]
  },
  {
    cvxCode: "141",
    standardName: "Influenza, seasonal, injectable",
    aliases: ["Flu Shot", "Seasonal Flu", "Influenza"],
    tradenames: ["Fluzone", "Fluarix"],
    abbreviations: ["FLU"]
  },
  {
    cvxCode: "03",
    standardName: "MMR",
    aliases: ["Measles, Mumps, Rubella", "MMR Vaccine", "M-M-R II"],
    tradenames: ["M-M-R II", "Priorix"],
    abbreviations: ["MMR"]
  },
  {
    cvxCode: "94",
    standardName: "MMRV",
    aliases: ["Measles, Mumps, Rubella, Varicella", "MMRV Vaccine"],
    tradenames: ["ProQuad"],
    abbreviations: ["MMRV"]
  },
  {
    cvxCode: "115",
    standardName: "Tdap",
    aliases: ["Tetanus, Diphtheria, Pertussis", "Tdap Vaccine"],
    tradenames: ["Adacel", "Boostrix"],
    abbreviations: ["TDAP"]
  },
  {
    cvxCode: "113",
    standardName: "Td",
    aliases: ["Tetanus, Diphtheria", "Td Vaccine", "Tetanus Booster"],
    tradenames: ["Tenivac", "Tdvax"],
    abbreviations: ["TD"]
  },
  {
    cvxCode: "62",
    standardName: "HPV, quadrivalent",
    aliases: ["HPV Vaccine", "Human Papillomavirus", "Gardasil"],
    tradenames: ["Gardasil", "Gardasil 9"],
    abbreviations: ["HPV", "HPV4"]
  },
  {
    cvxCode: "165",
    standardName: "HPV9",
    aliases: ["HPV Vaccine", "Human Papillomavirus 9-valent", "Gardasil 9"],
    tradenames: ["Gardasil 9"],
    abbreviations: ["HPV9"]
  },
  {
    cvxCode: "33",
    standardName: "Pneumococcal polysaccharide PPV23",
    aliases: ["Pneumonia Vaccine", "Pneumococcal Vaccine", "PPSV23"],
    tradenames: ["Pneumovax 23"],
    abbreviations: ["PPSV23", "PPV23"]
  },
  {
    cvxCode: "152",
    standardName: "Pneumococcal Conjugate PCV13",
    aliases: ["Prevnar", "Pneumococcal Conjugate", "PCV13"],
    tradenames: ["Prevnar 13"],
    abbreviations: ["PCV13"]
  },
  {
    cvxCode: "21",
    standardName: "Varicella",
    aliases: ["Chickenpox Vaccine", "Varicella Vaccine", "VZV"],
    tradenames: ["Varivax"],
    abbreviations: ["VAR", "VZV"]
  },
  {
    cvxCode: "121",
    standardName: "Zoster",
    aliases: ["Shingles Vaccine", "Herpes Zoster", "Shingrix", "Zostavax"],
    tradenames: ["Shingrix", "Zostavax"],
    abbreviations: ["ZOS", "HZV"]
  },
  {
    cvxCode: "45",
    standardName: "Hepatitis B",
    aliases: ["Hep B", "HBV Vaccine", "Hepatitis B Vaccine"],
    tradenames: ["Engerix-B", "Recombivax HB", "Heplisav-B"],
    abbreviations: ["HEPB", "HBV"]
  },
  {
    cvxCode: "52",
    standardName: "Hepatitis A",
    aliases: ["Hep A", "HAV Vaccine", "Hepatitis A Vaccine"],
    tradenames: ["Havrix", "Vaqta"],
    abbreviations: ["HEPA", "HAV"]
  }
];

const localRecords = new Map<string, LocalImmunizationRecord>();
const iisRecords = new Map<string, IISImmunizationRecord>();
const reconciliationMatches = new Map<string, ReconciliationMatch>();
const auditLogs: ReconciliationAuditLog[] = [];

const defaultConfig: ReconciliationConfig = {
  autoVerifyThreshold: 0.95,
  reviewThreshold: 0.60,
  dateToleranceDays: 3,
  enableFuzzyMatching: true,
  weights: {
    vaccineCode: 0.40,
    vaccineName: 0.10,
    date: 0.25,
    lotNumber: 0.10,
    manufacturer: 0.10,
    doseNumber: 0.05
  }
};

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
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
  return matrix[b.length][a.length];
}

function stringSimilarity(a: string, b: string): number {
  const normalizedA = normalizeString(a);
  const normalizedB = normalizeString(b);
  
  if (normalizedA === normalizedB) return 1.0;
  if (normalizedA.length === 0 || normalizedB.length === 0) return 0.0;
  
  const maxLength = Math.max(normalizedA.length, normalizedB.length);
  const distance = levenshteinDistance(normalizedA, normalizedB);
  return 1 - (distance / maxLength);
}

function matchVaccineNames(localName: string, iisName: string, localCode?: string, iisCode?: string): { score: number; details: string; resolvedLocalCVX?: string; resolvedIISCVX?: string } {
  const localCVX = localCode ? lookupCVX(localCode) : resolveCVXFromInput(localName);
  const iisCVX = iisCode ? lookupCVX(iisCode) : resolveCVXFromInput(iisName);
  const resolvedLocalCVX = localCVX?.code;
  const resolvedIISCVX = iisCVX?.code;

  if (localCVX && iisCVX) {
    if (localCVX.code === iisCVX.code) {
      return { score: 1.0, details: `Exact CVX code match: ${localCVX.code} (${localCVX.shortName})`, resolvedLocalCVX, resolvedIISCVX };
    }

    if (localCVX.vaccineGroup === iisCVX.vaccineGroup) {
      return {
        score: 0.95,
        details: `Same vaccine group "${localCVX.vaccineGroup}" via CVX codes: local=${localCVX.code} (${localCVX.shortName}), IIS=${iisCVX.code} (${iisCVX.shortName})`,
        resolvedLocalCVX,
        resolvedIISCVX,
      };
    }

    return {
      score: 0.15,
      details: `Different vaccine groups: local="${localCVX.vaccineGroup}" (CVX ${localCVX.code}), IIS="${iisCVX.vaccineGroup}" (CVX ${iisCVX.code})`,
      resolvedLocalCVX,
      resolvedIISCVX,
    };
  }

  if (localCVX && !iisCVX) {
    const normalizedIIS = normalizeString(iisName);
    const iisAliases = [
      localCVX.shortName, localCVX.fullName,
      ...(localCVX.tradenames || []), ...(localCVX.aliases || []), ...(localCVX.abbreviations || []),
    ].map(normalizeString);
    if (iisAliases.some(n => n === normalizedIIS || normalizedIIS.includes(n) || n.includes(normalizedIIS))) {
      return { score: 0.90, details: `Local CVX ${localCVX.code} matched IIS name "${iisName}" via alias`, resolvedLocalCVX, resolvedIISCVX };
    }
  }

  if (!localCVX && iisCVX) {
    const normalizedLocal = normalizeString(localName);
    const localAliases = [
      iisCVX.shortName, iisCVX.fullName,
      ...(iisCVX.tradenames || []), ...(iisCVX.aliases || []), ...(iisCVX.abbreviations || []),
    ].map(normalizeString);
    if (localAliases.some(n => n === normalizedLocal || normalizedLocal.includes(n) || n.includes(normalizedLocal))) {
      return { score: 0.90, details: `IIS CVX ${iisCVX.code} matched local name "${localName}" via alias`, resolvedLocalCVX, resolvedIISCVX };
    }
  }

  for (const mapping of VACCINE_NAME_MAPPINGS) {
    const allNames = [
      mapping.standardName, ...mapping.aliases, ...mapping.tradenames, ...mapping.abbreviations,
    ].map(normalizeString);
    const normalizedLocal = normalizeString(localName);
    const normalizedIIS = normalizeString(iisName);
    const localMatches = allNames.some(n => n === normalizedLocal || normalizedLocal.includes(n) || n.includes(normalizedLocal));
    const iisMatches = allNames.some(n => n === normalizedIIS || normalizedIIS.includes(n) || n.includes(normalizedIIS));
    if (localMatches && iisMatches) {
      return { score: 0.90, details: `Both matched to ${mapping.standardName} (CVX: ${mapping.cvxCode}) via name alias`, resolvedLocalCVX, resolvedIISCVX };
    }
  }

  const normalizedLocal = normalizeString(localName);
  const normalizedIIS = normalizeString(iisName);
  if (normalizedLocal === normalizedIIS) {
    return { score: 0.85, details: "Exact name match after normalization (no CVX resolution)", resolvedLocalCVX, resolvedIISCVX };
  }

  const similarity = stringSimilarity(localName, iisName);
  if (similarity >= 0.8) {
    return { score: similarity * 0.9, details: `Fuzzy name match: ${(similarity * 100).toFixed(1)}% similarity (no CVX confirmation)`, resolvedLocalCVX, resolvedIISCVX };
  }

  const localWords = normalizedLocal.split(/\s+/).filter(w => w.length > 2);
  const iisWords = normalizedIIS.split(/\s+/).filter(w => w.length > 2);
  const commonWords = localWords.filter(w => iisWords.includes(w));
  if (commonWords.length > 0) {
    const wordScore = commonWords.length / Math.max(localWords.length, iisWords.length);
    return { score: Math.min(0.65, wordScore * 0.8), details: `Common keywords: ${commonWords.join(", ")}`, resolvedLocalCVX, resolvedIISCVX };
  }

  return { score: similarity, details: `Low similarity: ${(similarity * 100).toFixed(1)}%`, resolvedLocalCVX, resolvedIISCVX };
}

function matchDates(localDate: string, iisDate: string, toleranceDays: number): { score: number; daysDiff: number; details: string } {
  const local = new Date(localDate);
  const iis = new Date(iisDate);
  
  if (isNaN(local.getTime()) || isNaN(iis.getTime())) {
    return { score: 0, daysDiff: -1, details: "Invalid date format" };
  }
  
  const diffMs = Math.abs(local.getTime() - iis.getTime());
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return { score: 1.0, daysDiff: 0, details: "Exact date match" };
  }
  
  if (diffDays <= toleranceDays) {
    const score = 1 - (diffDays / (toleranceDays * 2));
    return { 
      score: Math.max(0.7, score), 
      daysDiff: diffDays, 
      details: `${diffDays} day(s) difference (within tolerance)` 
    };
  }
  
  if (diffDays <= 30) {
    const score = Math.max(0.3, 0.7 - ((diffDays - toleranceDays) * 0.02));
    return { 
      score, 
      daysDiff: diffDays, 
      details: `${diffDays} day(s) difference (outside tolerance)` 
    };
  }
  
  return { score: 0.1, daysDiff: diffDays, details: `${diffDays} day(s) difference (significant)` };
}

function matchLotNumbers(localLot: string | undefined, iisLot: string | undefined): { score: number; details: string } {
  if (!localLot && !iisLot) {
    return { score: 1.0, details: "Both lot numbers missing (acceptable)" };
  }
  
  if (!localLot || !iisLot) {
    return { score: 0.5, details: "One lot number missing" };
  }
  
  const normalizedLocal = normalizeString(localLot);
  const normalizedIIS = normalizeString(iisLot);
  
  if (normalizedLocal === normalizedIIS) {
    return { score: 1.0, details: "Exact lot number match" };
  }
  
  if (normalizedLocal.includes(normalizedIIS) || normalizedIIS.includes(normalizedLocal)) {
    return { score: 0.9, details: "Partial lot number match" };
  }
  
  const similarity = stringSimilarity(localLot, iisLot);
  if (similarity >= 0.85) {
    return { score: similarity, details: `Similar lot numbers: ${(similarity * 100).toFixed(1)}%` };
  }
  
  return { score: 0.2, details: "Lot numbers do not match" };
}

function matchManufacturers(localMfr: string | undefined, iisMfr: string | undefined): { score: number; details: string } {
  if (!localMfr && !iisMfr) {
    return { score: 1.0, details: "Both manufacturers missing" };
  }
  
  if (!localMfr || !iisMfr) {
    return { score: 0.5, details: "One manufacturer missing" };
  }
  
  const normalizedLocal = normalizeString(localMfr);
  const normalizedIIS = normalizeString(iisMfr);
  
  if (normalizedLocal === normalizedIIS) {
    return { score: 1.0, details: "Exact manufacturer match" };
  }
  
  const manufacturerAliases: Record<string, string[]> = {
    "pfizer": ["pfizerinc", "pfizerbiontechcovid19vaccine", "biontech"],
    "moderna": ["modernainc", "modernatxinc", "spikevax"],
    "janssen": ["janssenpharmaceuticals", "johnsonandjohnson", "jnj"],
    "merck": ["merckinc", "mercksharp", "mercksharpanddohme", "msd"],
    "gsk": ["glaxosmithkline", "smithklinebeecham"],
    "sanofi": ["sanofipasteur", "sanofiaventisuslc"],
    "seqirus": ["seqirusinc", "csl", "cslseqirus"]
  };
  
  for (const [canonical, aliases] of Object.entries(manufacturerAliases)) {
    const allNames = [canonical, ...aliases];
    const localMatches = allNames.some(n => normalizedLocal.includes(n) || n.includes(normalizedLocal));
    const iisMatches = allNames.some(n => normalizedIIS.includes(n) || n.includes(normalizedIIS));
    
    if (localMatches && iisMatches) {
      return { score: 0.95, details: `Both mapped to ${canonical}` };
    }
  }
  
  const similarity = stringSimilarity(localMfr, iisMfr);
  return { score: similarity, details: `Similarity: ${(similarity * 100).toFixed(1)}%` };
}

function calculateOverallMatch(
  localRecord: LocalImmunizationRecord,
  iisRecord: IISImmunizationRecord,
  config: ReconciliationConfig
): { confidence: number; factors: MatchingFactor[]; discrepancies: FieldDiscrepancy[] } {
  const factors: MatchingFactor[] = [];
  const discrepancies: FieldDiscrepancy[] = [];
  
  const vaccineMatch = matchVaccineNames(
    localRecord.vaccineName,
    iisRecord.vaccineName,
    localRecord.vaccineCode,
    iisRecord.vaccineCode
  );

  const localCVXDisplay = vaccineMatch.resolvedLocalCVX
    ? `CVX ${vaccineMatch.resolvedLocalCVX}`
    : localRecord.vaccineCode || "no CVX";
  const iisCVXDisplay = vaccineMatch.resolvedIISCVX
    ? `CVX ${vaccineMatch.resolvedIISCVX}`
    : iisRecord.vaccineCode || "no CVX";

  factors.push({
    factor: "CVX Code Match",
    score: vaccineMatch.score,
    weight: config.weights.vaccineCode + config.weights.vaccineName,
    details: vaccineMatch.details
  });

  if (vaccineMatch.score < 0.9) {
    discrepancies.push({
      field: "vaccine_name",
      localValue: `${localRecord.vaccineName} (${localCVXDisplay})`,
      iisValue: `${iisRecord.vaccineName} (${iisCVXDisplay})`,
      severity: vaccineMatch.score < 0.5 ? "critical" : "major",
      suggestedResolution: vaccineMatch.score >= 0.7 ? "accept_iis" : "manual_review",
      confidence: vaccineMatch.score
    });
  }
  
  const dateMatch = matchDates(localRecord.administeredDate, iisRecord.administeredDate, config.dateToleranceDays);
  factors.push({
    factor: "Administration Date",
    score: dateMatch.score,
    weight: config.weights.date,
    details: dateMatch.details
  });
  
  if (dateMatch.daysDiff > 0) {
    discrepancies.push({
      field: "date",
      localValue: localRecord.administeredDate,
      iisValue: iisRecord.administeredDate,
      severity: dateMatch.daysDiff > config.dateToleranceDays ? "major" : "minor",
      suggestedResolution: dateMatch.daysDiff <= 1 ? "accept_iis" : "manual_review",
      confidence: dateMatch.score
    });
  }
  
  const lotMatch = matchLotNumbers(localRecord.lotNumber, iisRecord.lotNumber);
  factors.push({
    factor: "Lot Number",
    score: lotMatch.score,
    weight: config.weights.lotNumber,
    details: lotMatch.details
  });
  
  if (lotMatch.score < 0.9 && (localRecord.lotNumber || iisRecord.lotNumber)) {
    discrepancies.push({
      field: "lot_number",
      localValue: localRecord.lotNumber || "(not recorded)",
      iisValue: iisRecord.lotNumber || "(not recorded)",
      severity: "minor",
      suggestedResolution: iisRecord.lotNumber ? "accept_iis" : "accept_local",
      confidence: lotMatch.score
    });
  }
  
  const mfrMatch = matchManufacturers(localRecord.manufacturer, iisRecord.manufacturer);
  factors.push({
    factor: "Manufacturer",
    score: mfrMatch.score,
    weight: config.weights.manufacturer,
    details: mfrMatch.details
  });
  
  if (mfrMatch.score < 0.9 && (localRecord.manufacturer || iisRecord.manufacturer)) {
    discrepancies.push({
      field: "manufacturer",
      localValue: localRecord.manufacturer || "(not recorded)",
      iisValue: iisRecord.manufacturer || "(not recorded)",
      severity: "minor",
      suggestedResolution: iisRecord.manufacturer ? "accept_iis" : "accept_local",
      confidence: mfrMatch.score
    });
  }
  
  if (localRecord.doseNumber !== undefined || iisRecord.doseNumber !== undefined) {
    const doseMatch = localRecord.doseNumber === iisRecord.doseNumber;
    factors.push({
      factor: "Dose Number",
      score: doseMatch ? 1.0 : (localRecord.doseNumber && iisRecord.doseNumber ? 0.3 : 0.7),
      weight: config.weights.doseNumber,
      details: doseMatch ? "Dose numbers match" : `Local: ${localRecord.doseNumber || "N/A"}, IIS: ${iisRecord.doseNumber || "N/A"}`
    });
    
    if (!doseMatch && localRecord.doseNumber && iisRecord.doseNumber) {
      discrepancies.push({
        field: "dose_number",
        localValue: String(localRecord.doseNumber),
        iisValue: String(iisRecord.doseNumber),
        severity: "major",
        suggestedResolution: "manual_review",
        confidence: 0.5
      });
    }
  }
  
  let totalWeight = 0;
  let weightedScore = 0;
  for (const factor of factors) {
    weightedScore += factor.score * factor.weight;
    totalWeight += factor.weight;
  }
  
  const confidence = totalWeight > 0 ? weightedScore / totalWeight : 0;
  
  return { confidence, factors, discrepancies };
}

function determineConfidenceLevel(confidence: number, config: ReconciliationConfig): MatchConfidenceLevel {
  if (confidence >= config.autoVerifyThreshold) return "high";
  if (confidence >= config.reviewThreshold) return "medium";
  if (confidence >= 0.3) return "low";
  return "no_match";
}

function createAuditLog(
  matchId: string,
  action: ReconciliationAuditLog["action"],
  userId: string,
  userRole: string,
  previousStatus: ReconciliationStatus | undefined,
  newStatus: ReconciliationStatus,
  details: string
): ReconciliationAuditLog {
  const log: ReconciliationAuditLog = {
    id: generateId("recon-audit"),
    matchId,
    action,
    userId,
    userRole,
    previousStatus,
    newStatus,
    details,
    timestamp: new Date().toISOString()
  };
  auditLogs.push(log);
  return log;
}

function initializeSampleData(): void {
  const sampleLocalRecords: LocalImmunizationRecord[] = [
    {
      id: "local-1",
      patientId: "patient-1",
      vaccineCode: "208",
      vaccineName: "Pfizer-BioNTech COVID-19 Vaccine",
      administeredDate: "2024-01-15",
      lotNumber: "EL9262",
      manufacturer: "Pfizer Inc",
      doseNumber: 1,
      site: "Left Deltoid",
      route: "Intramuscular",
      source: "clinician_entered",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "local-2",
      patientId: "patient-1",
      vaccineCode: "140",
      vaccineName: "Influenza Vaccine",
      administeredDate: "2024-10-01",
      lotNumber: "U4567F",
      manufacturer: "Sanofi Pasteur",
      source: "patient_reported",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "local-3",
      patientId: "patient-2",
      vaccineCode: "115",
      vaccineName: "Tdap",
      administeredDate: "2023-06-20",
      lotNumber: "AC92B7",
      manufacturer: "GSK",
      doseNumber: 1,
      source: "ehr_imported",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "local-4",
      patientId: "patient-2",
      vaccineCode: "165",
      vaccineName: "HPV Vaccine Gardasil 9",
      administeredDate: "2023-03-15",
      lotNumber: "K9021V",
      manufacturer: "Merck",
      doseNumber: 2,
      source: "clinician_entered",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "local-5",
      patientId: "patient-3",
      vaccineCode: "121",
      vaccineName: "Shingrix",
      administeredDate: "2024-02-28",
      manufacturer: "GlaxoSmithKline",
      doseNumber: 1,
      source: "patient_reported",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  
  const sampleIISRecords: IISImmunizationRecord[] = [
    {
      id: "iis-1",
      patientId: "patient-1",
      iisSource: "CA-CAIR2",
      stateCode: "CA",
      vaccineCode: "208",
      vaccineName: "COVID-19, mRNA, LNP-S, PF, 30 mcg/0.3 mL dose",
      administeredDate: "2024-01-15",
      lotNumber: "EL9262",
      manufacturer: "Pfizer-BioNTech",
      doseNumber: 1,
      site: "LA",
      route: "IM",
      reportingFacility: "Kaiser Permanente Medical Center",
      retrievedAt: new Date().toISOString()
    },
    {
      id: "iis-2",
      patientId: "patient-1",
      iisSource: "CA-CAIR2",
      stateCode: "CA",
      vaccineCode: "140",
      vaccineName: "Influenza, seasonal, injectable, preservative free",
      administeredDate: "2024-10-02",
      lotNumber: "U4567F",
      manufacturer: "Sanofi Pasteur Inc",
      reportingFacility: "CVS Pharmacy #4521",
      retrievedAt: new Date().toISOString()
    },
    {
      id: "iis-3",
      patientId: "patient-2",
      iisSource: "NY-NYSIIS",
      stateCode: "NY",
      vaccineCode: "115",
      vaccineName: "Tdap vaccine",
      administeredDate: "2023-06-20",
      lotNumber: "AC92B7",
      manufacturer: "GlaxoSmithKline",
      doseNumber: 1,
      reportingFacility: "Mount Sinai Hospital",
      retrievedAt: new Date().toISOString()
    },
    {
      id: "iis-4",
      patientId: "patient-2",
      iisSource: "NY-NYSIIS",
      stateCode: "NY",
      vaccineCode: "165",
      vaccineName: "HPV9 (human papillomavirus vaccine, 9-valent)",
      administeredDate: "2023-03-17",
      lotNumber: "K9021V",
      manufacturer: "Merck Sharp & Dohme Corp",
      doseNumber: 2,
      reportingFacility: "Weill Cornell Medicine",
      retrievedAt: new Date().toISOString()
    },
    {
      id: "iis-5",
      patientId: "patient-3",
      iisSource: "FL-FLSHOTS",
      stateCode: "FL",
      vaccineCode: "121",
      vaccineName: "zoster vaccine, recombinant",
      administeredDate: "2024-02-28",
      lotNumber: "7FJS9K",
      manufacturer: "GSK",
      doseNumber: 1,
      reportingFacility: "Walgreens Pharmacy",
      retrievedAt: new Date().toISOString()
    },
    {
      id: "iis-6",
      patientId: "patient-1",
      iisSource: "CA-CAIR2",
      stateCode: "CA",
      vaccineCode: "207",
      vaccineName: "COVID-19, mRNA, LNP-S, PF, 100 mcg/0.5mL dose",
      administeredDate: "2023-09-15",
      lotNumber: "043L20A",
      manufacturer: "Moderna",
      doseNumber: 3,
      reportingFacility: "Rite Aid Pharmacy #2145",
      retrievedAt: new Date().toISOString()
    }
  ];
  
  for (const record of sampleLocalRecords) {
    localRecords.set(record.id, record);
  }
  
  for (const record of sampleIISRecords) {
    iisRecords.set(record.id, record);
  }
  
  console.log(`[IISDataReconciliation] Initialized ${localRecords.size} local records and ${iisRecords.size} IIS records`);
}

initializeSampleData();

export const iisDataReconciliationService = {
  async runReconciliation(
    patientId: string,
    userId: string,
    userRole: string = "clinician",
    config: ReconciliationConfig = defaultConfig
  ): Promise<ReconciliationMatch[]> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ImmunizationReconciliation",
      patientId,
      details: `Started IIS data reconciliation for patient ${patientId}`
    });
    
    const patientLocalRecords = Array.from(localRecords.values()).filter(r => r.patientId === patientId);
    const patientIISRecords = Array.from(iisRecords.values()).filter(r => r.patientId === patientId);
    
    const matches: ReconciliationMatch[] = [];
    const matchedIISIds = new Set<string>();
    
    for (const localRecord of patientLocalRecords) {
      let bestMatch: { iisRecord: IISImmunizationRecord; result: ReturnType<typeof calculateOverallMatch> } | null = null;
      
      for (const iisRecord of patientIISRecords) {
        if (matchedIISIds.has(iisRecord.id)) continue;
        
        const result = calculateOverallMatch(localRecord, iisRecord, config);
        
        if (result.confidence >= config.reviewThreshold) {
          if (!bestMatch || result.confidence > bestMatch.result.confidence) {
            bestMatch = { iisRecord, result };
          }
        }
      }
      
      if (bestMatch) {
        const confidenceLevel = determineConfidenceLevel(bestMatch.result.confidence, config);
        const autoVerify = bestMatch.result.confidence >= config.autoVerifyThreshold && bestMatch.result.discrepancies.length === 0;
        
        const match: ReconciliationMatch = {
          id: generateId("recon-match"),
          localRecordId: localRecord.id,
          iisRecordId: bestMatch.iisRecord.id,
          patientId,
          matchConfidence: bestMatch.result.confidence,
          confidenceLevel,
          matchingFactors: bestMatch.result.factors,
          discrepancies: bestMatch.result.discrepancies,
          status: autoVerify ? "auto_verified" : (confidenceLevel === "high" ? "pending" : "needs_review"),
          autoVerified: autoVerify,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        reconciliationMatches.set(match.id, match);
        matchedIISIds.add(bestMatch.iisRecord.id);
        matches.push(match);
        
        createAuditLog(
          match.id,
          autoVerify ? "auto_verified" : "created",
          userId,
          userRole,
          undefined,
          match.status,
          autoVerify 
            ? `Auto-verified match with ${(match.matchConfidence * 100).toFixed(1)}% confidence`
            : `Created match with ${(match.matchConfidence * 100).toFixed(1)}% confidence, ${match.discrepancies.length} discrepancies`
        );
        
        if (autoVerify) {
          const record = localRecords.get(localRecord.id);
          if (record) {
            record.source = "iis_verified";
            record.updatedAt = new Date().toISOString();
            localRecords.set(record.id, record);
          }
        }
      }
    }
    
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ImmunizationReconciliation",
      patientId,
      details: `Completed reconciliation: ${matches.length} matches found, ${matches.filter(m => m.autoVerified).length} auto-verified`
    });
    
    return matches;
  },

  async getReviewQueue(
    userId: string,
    userRole: string = "clinician",
    filters?: {
      status?: ReconciliationStatus[];
      patientId?: string;
      confidenceLevel?: MatchConfidenceLevel[];
      hasDiscrepancies?: boolean;
    }
  ): Promise<ReconciliationMatch[]> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ReconciliationReviewQueue",
      details: "Accessed reconciliation review queue"
    });
    
    let matches = Array.from(reconciliationMatches.values());
    
    if (filters?.status?.length) {
      matches = matches.filter(m => filters.status!.includes(m.status));
    }
    
    if (filters?.patientId) {
      matches = matches.filter(m => m.patientId === filters.patientId);
    }
    
    if (filters?.confidenceLevel?.length) {
      matches = matches.filter(m => filters.confidenceLevel!.includes(m.confidenceLevel));
    }
    
    if (filters?.hasDiscrepancies !== undefined) {
      matches = matches.filter(m => 
        filters.hasDiscrepancies 
          ? m.discrepancies.length > 0 
          : m.discrepancies.length === 0
      );
    }
    
    return matches.sort((a, b) => {
      if (a.status === "needs_review" && b.status !== "needs_review") return -1;
      if (b.status === "needs_review" && a.status !== "needs_review") return 1;
      return b.matchConfidence - a.matchConfidence;
    });
  },

  async getMatchDetails(
    matchId: string,
    userId: string
  ): Promise<{ match: ReconciliationMatch; localRecord: LocalImmunizationRecord; iisRecord: IISImmunizationRecord } | null> {
    const match = reconciliationMatches.get(matchId);
    if (!match) return null;
    
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ReconciliationMatch",
      resourceId: matchId,
      patientId: match.patientId,
      details: `Viewed reconciliation match details`
    });
    
    const localRecord = localRecords.get(match.localRecordId);
    const iisRecord = iisRecords.get(match.iisRecordId);
    
    if (!localRecord || !iisRecord) return null;
    
    return { match, localRecord, iisRecord };
  },

  async resolveMatch(
    matchId: string,
    resolutionType: ResolutionType,
    userId: string,
    userRole: string = "clinician",
    notes?: string,
    finalValues?: Record<string, string>
  ): Promise<ReconciliationMatch | null> {
    const match = reconciliationMatches.get(matchId);
    if (!match) return null;
    
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ReconciliationMatch",
      resourceId: matchId,
      patientId: match.patientId,
      details: `Resolved match with ${resolutionType}`
    });
    
    const previousStatus = match.status;
    
    match.resolution = {
      type: resolutionType,
      resolvedBy: userId,
      resolvedAt: new Date().toISOString(),
      notes,
      finalValues: finalValues || {}
    };
    
    match.status = resolutionType === "reject" ? "rejected" : "resolved";
    match.reviewedAt = new Date().toISOString();
    match.reviewedBy = userId;
    match.updatedAt = new Date().toISOString();
    
    reconciliationMatches.set(matchId, match);
    
    if (resolutionType !== "reject") {
      const localRecord = localRecords.get(match.localRecordId);
      if (localRecord) {
        localRecord.source = "iis_verified";
        localRecord.updatedAt = new Date().toISOString();
        
        if (resolutionType === "accept_iis" || resolutionType === "merge") {
          const iisRecord = iisRecords.get(match.iisRecordId);
          if (iisRecord && finalValues) {
            if (finalValues.administeredDate) localRecord.administeredDate = finalValues.administeredDate;
            if (finalValues.lotNumber) localRecord.lotNumber = finalValues.lotNumber;
            if (finalValues.manufacturer) localRecord.manufacturer = finalValues.manufacturer;
            if (finalValues.doseNumber) localRecord.doseNumber = parseInt(finalValues.doseNumber);
          }
        }
        
        localRecords.set(localRecord.id, localRecord);
      }
    }
    
    createAuditLog(
      matchId,
      resolutionType === "reject" ? "rejected" : "resolved",
      userId,
      userRole,
      previousStatus,
      match.status,
      `${resolutionType}: ${notes || "No notes provided"}`
    );
    
    return match;
  },

  async getReconciliationStats(userId: string): Promise<ReconciliationStats> {
    await logPhiAccess({
      userId,
      action: "read",
      resourceType: "ReconciliationStats",
      details: "Viewed reconciliation statistics"
    });
    
    const allMatches = Array.from(reconciliationMatches.values());
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    const recentMatches = allMatches.filter(m => new Date(m.createdAt).getTime() >= oneDayAgo);
    
    const discrepancyCounts: Record<DiscrepancyFieldType, number> = {
      vaccine_name: 0,
      date: 0,
      lot_number: 0,
      manufacturer: 0,
      dose_number: 0,
      site: 0,
      route: 0
    };
    
    for (const match of allMatches) {
      for (const discrepancy of match.discrepancies) {
        discrepancyCounts[discrepancy.field]++;
      }
    }
    
    return {
      totalMatches: allMatches.length,
      pendingReview: allMatches.filter(m => m.status === "pending" || m.status === "needs_review").length,
      autoVerified: allMatches.filter(m => m.autoVerified).length,
      manuallyResolved: allMatches.filter(m => m.status === "resolved" && !m.autoVerified).length,
      rejected: allMatches.filter(m => m.status === "rejected").length,
      averageConfidence: allMatches.length > 0 
        ? allMatches.reduce((sum, m) => sum + m.matchConfidence, 0) / allMatches.length 
        : 0,
      matchesByConfidenceLevel: {
        high: allMatches.filter(m => m.confidenceLevel === "high").length,
        medium: allMatches.filter(m => m.confidenceLevel === "medium").length,
        low: allMatches.filter(m => m.confidenceLevel === "low").length,
        no_match: allMatches.filter(m => m.confidenceLevel === "no_match").length
      },
      commonDiscrepancies: Object.entries(discrepancyCounts)
        .map(([field, count]) => ({ field: field as DiscrepancyFieldType, count }))
        .filter(d => d.count > 0)
        .sort((a, b) => b.count - a.count),
      processingStats: {
        totalProcessed24h: recentMatches.length,
        autoVerified24h: recentMatches.filter(m => m.autoVerified).length,
        flaggedForReview24h: recentMatches.filter(m => m.status === "needs_review").length
      }
    };
  },

  async getAuditLogs(
    matchId?: string,
    userId?: string,
    limit: number = 100
  ): Promise<ReconciliationAuditLog[]> {
    let logs = [...auditLogs];
    
    if (matchId) {
      logs = logs.filter(l => l.matchId === matchId);
    }
    
    if (userId) {
      logs = logs.filter(l => l.userId === userId);
    }
    
    return logs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  },

  async bulkAutoVerify(
    userId: string,
    userRole: string = "clinician",
    confidenceThreshold: number = 0.98
  ): Promise<{ verified: number; skipped: number }> {
    await logPhiAccess({
      userId,
      action: "write",
      resourceType: "ReconciliationBulkVerification",
      details: `Bulk auto-verification with threshold ${confidenceThreshold}`
    });
    
    let verified = 0;
    let skipped = 0;
    
    const pendingMatches = Array.from(reconciliationMatches.values())
      .filter(m => m.status === "pending" && m.matchConfidence >= confidenceThreshold && m.discrepancies.length === 0);
    
    for (const match of pendingMatches) {
      const previousStatus = match.status;
      match.status = "auto_verified";
      match.autoVerified = true;
      match.updatedAt = new Date().toISOString();
      
      reconciliationMatches.set(match.id, match);
      
      const localRecord = localRecords.get(match.localRecordId);
      if (localRecord) {
        localRecord.source = "iis_verified";
        localRecord.updatedAt = new Date().toISOString();
        localRecords.set(localRecord.id, localRecord);
      }
      
      createAuditLog(
        match.id,
        "auto_verified",
        userId,
        userRole,
        previousStatus,
        "auto_verified",
        `Bulk auto-verified (confidence: ${(match.matchConfidence * 100).toFixed(1)}%)`
      );
      
      verified++;
    }
    
    skipped = Array.from(reconciliationMatches.values())
      .filter(m => m.status === "pending" && (m.matchConfidence < confidenceThreshold || m.discrepancies.length > 0)).length;
    
    return { verified, skipped };
  },

  getConfig(): ReconciliationConfig {
    return { ...defaultConfig };
  },

  updateConfig(updates: Partial<ReconciliationConfig>): ReconciliationConfig {
    Object.assign(defaultConfig, updates);
    return { ...defaultConfig };
  },

  getLocalRecord(id: string): LocalImmunizationRecord | undefined {
    return localRecords.get(id);
  },

  getIISRecord(id: string): IISImmunizationRecord | undefined {
    return iisRecords.get(id);
  },

  addLocalRecord(record: Omit<LocalImmunizationRecord, "id" | "createdAt" | "updatedAt">): LocalImmunizationRecord {
    const newRecord: LocalImmunizationRecord = {
      ...record,
      id: generateId("local"),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    localRecords.set(newRecord.id, newRecord);
    return newRecord;
  },

  addIISRecord(record: Omit<IISImmunizationRecord, "id" | "retrievedAt">): IISImmunizationRecord {
    const newRecord: IISImmunizationRecord = {
      ...record,
      id: generateId("iis"),
      retrievedAt: new Date().toISOString()
    };
    iisRecords.set(newRecord.id, newRecord);
    return newRecord;
  }
};

console.log("[IISDataReconciliation] Service initialized with fuzzy matching and audit logging");
