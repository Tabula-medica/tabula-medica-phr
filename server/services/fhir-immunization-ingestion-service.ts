import { logPhiAccess } from "../security/hipaa-audit";
import { vaccineScheduleEngine, type ImmunizationEvent, type CVXCode, type ConfidenceLevel } from "./vaccine-schedule-engine";

const NO_CDS_DISCLAIMER = "IMPORTANT: This information is based on CDC/ACIP published schedules and your recorded history. This is NOT medical advice. Always confirm with your clinician or pharmacist before receiving any vaccine.";

export interface FHIRImmunization {
  resourceType: "Immunization";
  id: string;
  status: "completed" | "entered-in-error" | "not-done";
  statusReason?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
  };
  vaccineCode: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  patient: { reference: string };
  encounter?: { reference: string };
  occurrenceDateTime?: string;
  occurrenceString?: string;
  recorded?: string;
  primarySource?: boolean;
  reportOrigin?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  };
  location?: { reference?: string; display?: string };
  manufacturer?: { reference?: string; display?: string };
  lotNumber?: string;
  expirationDate?: string;
  site?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  };
  route?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  };
  doseQuantity?: { value?: number; unit?: string; system?: string; code?: string };
  performer?: Array<{
    function?: {
      coding?: Array<{ system?: string; code?: string; display?: string }>;
    };
    actor: { reference?: string; display?: string };
  }>;
  note?: Array<{ text: string }>;
  reasonCode?: Array<{
    coding?: Array<{ system?: string; code?: string; display?: string }>;
    text?: string;
  }>;
  isSubpotent?: boolean;
  subpotentReason?: Array<{
    coding?: Array<{ system?: string; code?: string; display?: string }>;
  }>;
  education?: Array<{
    documentType?: string;
    reference?: string;
    publicationDate?: string;
    presentationDate?: string;
  }>;
  programEligibility?: Array<{
    coding?: Array<{ system?: string; code?: string; display?: string }>;
  }>;
  fundingSource?: {
    coding?: Array<{ system?: string; code?: string; display?: string }>;
  };
  reaction?: Array<{
    date?: string;
    detail?: { reference: string };
    reported?: boolean;
  }>;
  protocolApplied?: Array<{
    series?: string;
    authority?: { reference: string };
    targetDisease?: Array<{
      coding?: Array<{ system?: string; code?: string; display?: string }>;
    }>;
    doseNumberPositiveInt?: number;
    doseNumberString?: string;
    seriesDosesPositiveInt?: number;
    seriesDosesString?: string;
  }>;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    source?: string;
    profile?: string[];
  };
}

export interface FHIRBundle {
  resourceType: "Bundle";
  type: string;
  total?: number;
  link?: Array<{ relation: string; url: string }>;
  entry?: Array<{
    fullUrl?: string;
    resource: FHIRImmunization;
    search?: { mode?: string; score?: number };
  }>;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  duplicates: number;
  errors: number;
  events: ImmunizationEvent[];
  conflicts: ImportConflict[];
  errorDetails: string[];
  disclaimer: string;
}

export interface ImportConflict {
  id: string;
  fhirResourceId: string;
  existingEventId: string;
  conflictType: "duplicate" | "date_mismatch" | "code_mismatch" | "partial_match";
  fhirData: Partial<ImmunizationEvent>;
  existingData: Partial<ImmunizationEvent>;
  resolution: "skip" | "merge" | "override" | "pending";
  resolvedAt?: string;
}

interface CVXMapping {
  cvxCode: string;
  vaccineGroup: string;
  vaccineName: string;
}

const CVX_CODE_SYSTEM = "http://hl7.org/fhir/sid/cvx";
const NDC_CODE_SYSTEM = "http://hl7.org/fhir/sid/ndc";
const SNOMED_SYSTEM = "http://snomed.info/sct";

const CVX_TO_GROUP_MAP: Record<string, CVXMapping> = {
  "03": { cvxCode: "03", vaccineGroup: "MMR", vaccineName: "MMR (Measles, Mumps, Rubella)" },
  "94": { cvxCode: "94", vaccineGroup: "MMR", vaccineName: "MMRV" },
  "05": { cvxCode: "05", vaccineGroup: "MMR", vaccineName: "Measles" },
  "06": { cvxCode: "06", vaccineGroup: "MMR", vaccineName: "Rubella" },
  "07": { cvxCode: "07", vaccineGroup: "MMR", vaccineName: "Mumps" },
  "115": { cvxCode: "115", vaccineGroup: "Tdap", vaccineName: "Tdap" },
  "138": { cvxCode: "138", vaccineGroup: "Tdap", vaccineName: "Td (adult)" },
  "139": { cvxCode: "139", vaccineGroup: "Tdap", vaccineName: "Td (adult, preservative-free)" },
  "09": { cvxCode: "09", vaccineGroup: "Tdap", vaccineName: "Td (pediatric)" },
  "113": { cvxCode: "113", vaccineGroup: "Tdap", vaccineName: "Td (adult, no thimerosal)" },
  "165": { cvxCode: "165", vaccineGroup: "HPV", vaccineName: "HPV9 (Gardasil 9)" },
  "62": { cvxCode: "62", vaccineGroup: "HPV", vaccineName: "HPV4 (Gardasil)" },
  "118": { cvxCode: "118", vaccineGroup: "HPV", vaccineName: "HPV2 (Cervarix)" },
  "137": { cvxCode: "137", vaccineGroup: "HPV", vaccineName: "HPV, unspecified" },
  "141": { cvxCode: "141", vaccineGroup: "Influenza", vaccineName: "Influenza, seasonal, injectable" },
  "140": { cvxCode: "140", vaccineGroup: "Influenza", vaccineName: "Influenza, seasonal, HD" },
  "155": { cvxCode: "155", vaccineGroup: "Influenza", vaccineName: "Influenza, recombinant" },
  "158": { cvxCode: "158", vaccineGroup: "Influenza", vaccineName: "Influenza, cell-based" },
  "171": { cvxCode: "171", vaccineGroup: "Influenza", vaccineName: "Influenza, adjuvanted" },
  "185": { cvxCode: "185", vaccineGroup: "Influenza", vaccineName: "Influenza, recombinant, HD" },
  "197": { cvxCode: "197", vaccineGroup: "Influenza", vaccineName: "Influenza, HD, adjuvanted" },
  "88": { cvxCode: "88", vaccineGroup: "Influenza", vaccineName: "Influenza, unspecified" },
  "208": { cvxCode: "208", vaccineGroup: "COVID-19", vaccineName: "Pfizer-BioNTech COVID-19" },
  "207": { cvxCode: "207", vaccineGroup: "COVID-19", vaccineName: "Moderna COVID-19" },
  "212": { cvxCode: "212", vaccineGroup: "COVID-19", vaccineName: "Janssen COVID-19" },
  "213": { cvxCode: "213", vaccineGroup: "COVID-19", vaccineName: "COVID-19, unspecified" },
  "217": { cvxCode: "217", vaccineGroup: "COVID-19", vaccineName: "Pfizer-BioNTech COVID-19, pediatric" },
  "218": { cvxCode: "218", vaccineGroup: "COVID-19", vaccineName: "Pfizer-BioNTech COVID-19, ages 5-11" },
  "219": { cvxCode: "219", vaccineGroup: "COVID-19", vaccineName: "Pfizer-BioNTech COVID-19 booster" },
  "221": { cvxCode: "221", vaccineGroup: "COVID-19", vaccineName: "Moderna COVID-19, pediatric" },
  "227": { cvxCode: "227", vaccineGroup: "COVID-19", vaccineName: "Pfizer-BioNTech COVID-19, bivalent" },
  "228": { cvxCode: "228", vaccineGroup: "COVID-19", vaccineName: "Moderna COVID-19, bivalent" },
  "229": { cvxCode: "229", vaccineGroup: "COVID-19", vaccineName: "Pfizer-BioNTech COVID-19, monovalent" },
  "230": { cvxCode: "230", vaccineGroup: "COVID-19", vaccineName: "Moderna COVID-19, monovalent" },
  "121": { cvxCode: "121", vaccineGroup: "Shingles", vaccineName: "Zoster (shingles), live" },
  "187": { cvxCode: "187", vaccineGroup: "Shingles", vaccineName: "Zoster (shingles), recombinant" },
  "188": { cvxCode: "188", vaccineGroup: "Shingles", vaccineName: "Zoster (shingles), unspecified" },
  "33": { cvxCode: "33", vaccineGroup: "Pneumococcal", vaccineName: "PPSV23 (Pneumovax)" },
  "152": { cvxCode: "152", vaccineGroup: "Pneumococcal", vaccineName: "PCV13 (Prevnar 13)" },
  "215": { cvxCode: "215", vaccineGroup: "Pneumococcal", vaccineName: "PCV15 (Vaxneuvance)" },
  "216": { cvxCode: "216", vaccineGroup: "Pneumococcal", vaccineName: "PCV20 (Prevnar 20)" },
  "109": { cvxCode: "109", vaccineGroup: "Pneumococcal", vaccineName: "Pneumococcal, unspecified" },
  "45": { cvxCode: "45", vaccineGroup: "HepB", vaccineName: "Hepatitis B, unspecified" },
  "08": { cvxCode: "08", vaccineGroup: "HepB", vaccineName: "Hepatitis B, pediatric" },
  "44": { cvxCode: "44", vaccineGroup: "HepB", vaccineName: "Hepatitis B, dialysis" },
  "43": { cvxCode: "43", vaccineGroup: "HepB", vaccineName: "Hepatitis B, adult" },
  "189": { cvxCode: "189", vaccineGroup: "HepB", vaccineName: "Hepatitis B, CpG-adjuvanted" },
  "83": { cvxCode: "83", vaccineGroup: "HepA", vaccineName: "Hepatitis A, pediatric" },
  "52": { cvxCode: "52", vaccineGroup: "HepA", vaccineName: "Hepatitis A, adult" },
  "85": { cvxCode: "85", vaccineGroup: "HepA", vaccineName: "Hepatitis A, unspecified" },
  "104": { cvxCode: "104", vaccineGroup: "HepA/HepB", vaccineName: "Hepatitis A & B (Twinrix)" },
  "114": { cvxCode: "114", vaccineGroup: "Meningococcal", vaccineName: "MenACWY-D (Menactra)" },
  "136": { cvxCode: "136", vaccineGroup: "Meningococcal", vaccineName: "MenACWY-CRM (Menveo)" },
  "203": { cvxCode: "203", vaccineGroup: "Meningococcal", vaccineName: "MenACWY-TT (MenQuadfi)" },
  "162": { cvxCode: "162", vaccineGroup: "Meningococcal", vaccineName: "MenB-4C (Bexsero)" },
  "163": { cvxCode: "163", vaccineGroup: "Meningococcal", vaccineName: "MenB-FHbp (Trumenba)" },
  "164": { cvxCode: "164", vaccineGroup: "Meningococcal", vaccineName: "MenB, unspecified" },
  "108": { cvxCode: "108", vaccineGroup: "Meningococcal", vaccineName: "Meningococcal, unspecified" },
  "10": { cvxCode: "10", vaccineGroup: "Polio", vaccineName: "IPV (Polio)" },
  "02": { cvxCode: "02", vaccineGroup: "Polio", vaccineName: "OPV (Polio)" },
  "89": { cvxCode: "89", vaccineGroup: "Polio", vaccineName: "Polio, unspecified" },
  "21": { cvxCode: "21", vaccineGroup: "Varicella", vaccineName: "Varicella (Chickenpox)" },
  "36": { cvxCode: "36", vaccineGroup: "Varicella", vaccineName: "VZIG" },
  "17": { cvxCode: "17", vaccineGroup: "Hib", vaccineName: "Hib, unspecified" },
  "48": { cvxCode: "48", vaccineGroup: "Hib", vaccineName: "Hib-PRP-T" },
  "49": { cvxCode: "49", vaccineGroup: "Hib", vaccineName: "Hib-PRP-OMP" },
  "20": { cvxCode: "20", vaccineGroup: "DTaP", vaccineName: "DTaP" },
  "106": { cvxCode: "106", vaccineGroup: "DTaP", vaccineName: "DTaP, 5th dose" },
  "107": { cvxCode: "107", vaccineGroup: "DTaP", vaccineName: "DTaP, 4th dose" },
  "110": { cvxCode: "110", vaccineGroup: "DTaP/HepB/IPV", vaccineName: "DTaP-HepB-IPV (Pediarix)" },
  "120": { cvxCode: "120", vaccineGroup: "DTaP/Hib/IPV", vaccineName: "DTaP-IPV-Hib (Pentacel)" },
  "146": { cvxCode: "146", vaccineGroup: "DTaP/IPV", vaccineName: "DTaP-IPV (Kinrix, Quadracel)" },
  "50": { cvxCode: "50", vaccineGroup: "DTaP/Hib", vaccineName: "DTaP-Hib" },
  "130": { cvxCode: "130", vaccineGroup: "DTaP/IPV", vaccineName: "DTaP-IPV" },
  "01": { cvxCode: "01", vaccineGroup: "DTP", vaccineName: "DTP" },
  "22": { cvxCode: "22", vaccineGroup: "DTP/Hib", vaccineName: "DTP-Hib" },
  "19": { cvxCode: "19", vaccineGroup: "BCG", vaccineName: "BCG" },
  "26": { cvxCode: "26", vaccineGroup: "Cholera", vaccineName: "Cholera, live" },
  "172": { cvxCode: "172", vaccineGroup: "Cholera", vaccineName: "Cholera, WC-rBS" },
  "25": { cvxCode: "25", vaccineGroup: "Typhoid", vaccineName: "Typhoid, oral" },
  "41": { cvxCode: "41", vaccineGroup: "Typhoid", vaccineName: "Typhoid, parenteral" },
  "53": { cvxCode: "53", vaccineGroup: "Typhoid", vaccineName: "Typhoid, ViCPs" },
  "91": { cvxCode: "91", vaccineGroup: "Typhoid", vaccineName: "Typhoid, unspecified" },
  "18": { cvxCode: "18", vaccineGroup: "Rabies", vaccineName: "Rabies, IM" },
  "40": { cvxCode: "40", vaccineGroup: "Rabies", vaccineName: "Rabies, ID" },
  "90": { cvxCode: "90", vaccineGroup: "Rabies", vaccineName: "Rabies, unspecified" },
  "37": { cvxCode: "37", vaccineGroup: "Yellow Fever", vaccineName: "Yellow Fever" },
  "183": { cvxCode: "183", vaccineGroup: "Yellow Fever", vaccineName: "Yellow Fever, unspecified" },
  "24": { cvxCode: "24", vaccineGroup: "Anthrax", vaccineName: "Anthrax" },
  "75": { cvxCode: "75", vaccineGroup: "Smallpox/Mpox", vaccineName: "Smallpox (Vaccinia)" },
  "206": { cvxCode: "206", vaccineGroup: "Smallpox/Mpox", vaccineName: "Smallpox monkeypox (Jynneos)" },
  "79": { cvxCode: "79", vaccineGroup: "Vaccinia (Dryvax)", vaccineName: "Vaccinia immune globulin" },
  "27": { cvxCode: "27", vaccineGroup: "Botulism", vaccineName: "Botulinum antitoxin" },
  "29": { cvxCode: "29", vaccineGroup: "CMV", vaccineName: "CMVIG" },
  "30": { cvxCode: "30", vaccineGroup: "HBIG", vaccineName: "HBIG" },
  "34": { cvxCode: "34", vaccineGroup: "RIG", vaccineName: "RIG" },
  "35": { cvxCode: "35", vaccineGroup: "Tetanus", vaccineName: "Tetanus Toxoid (TT)" },
  "112": { cvxCode: "112", vaccineGroup: "Tetanus", vaccineName: "Tetanus Toxoid, adsorbed" },
  "142": { cvxCode: "142", vaccineGroup: "Tetanus", vaccineName: "Tetanus Toxoid, unspecified" },
  "55": { cvxCode: "55", vaccineGroup: "TIG", vaccineName: "TIG" },
  "38": { cvxCode: "38", vaccineGroup: "RSV", vaccineName: "RIG" },
  "93": { cvxCode: "93", vaccineGroup: "RSV", vaccineName: "RSV-Mab (Synagis)" },
  "201": { cvxCode: "201", vaccineGroup: "RSV", vaccineName: "RSV, unspecified" },
  "202": { cvxCode: "202", vaccineGroup: "RSV", vaccineName: "RSVPreF (Abrysvo)" },
  "122": { cvxCode: "122", vaccineGroup: "Rotavirus", vaccineName: "Rotavirus, monovalent" },
  "119": { cvxCode: "119", vaccineGroup: "Rotavirus", vaccineName: "Rotavirus, pentavalent" },
  "116": { cvxCode: "116", vaccineGroup: "Rotavirus", vaccineName: "Rotavirus, unspecified" },
  "111": { cvxCode: "111", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, live, intranasal" },
  "149": { cvxCode: "149", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, live, quadrivalent" },
  "150": { cvxCode: "150", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, injectable, quadrivalent" },
  "153": { cvxCode: "153", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, injectable, MDCK" },
  "161": { cvxCode: "161", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, injectable, QIV" },
  "166": { cvxCode: "166", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, intradermal, QIV" },
  "168": { cvxCode: "168", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, trivalent, adjuvanted" },
  "15": { cvxCode: "15", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, split" },
  "16": { cvxCode: "16", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, whole" },
  "135": { cvxCode: "135", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, HD" },
  "144": { cvxCode: "144", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, intradermal" },
  "151": { cvxCode: "151", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, nasal, unspecified" },
  "186": { cvxCode: "186", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, injectable, MDCK, preservative-free" },
  "191": { cvxCode: "191", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, HD, preservative-free" },
  "192": { cvxCode: "192", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, HD, quadrivalent" },
  "193": { cvxCode: "193", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, RIV, quadrivalent" },
  "194": { cvxCode: "194", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, southern hemisphere" },
  "195": { cvxCode: "195", vaccineGroup: "Flu/Influenza", vaccineName: "DT (pediatric) adsorbed" },
  "196": { cvxCode: "196", vaccineGroup: "Flu/Influenza", vaccineName: "Td, adsorbed" },
  "198": { cvxCode: "198", vaccineGroup: "Flu/Influenza", vaccineName: "DTP-IPV-Hib-HepB" },
  "200": { cvxCode: "200", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, southern hemisphere, quadrivalent" },
  "205": { cvxCode: "205", vaccineGroup: "Flu/Influenza", vaccineName: "Influenza, QIV, adjuvanted" },
};

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function extractCVXCode(vaccineCode: FHIRImmunization["vaccineCode"]): CVXMapping | null {
  if (!vaccineCode.coding) {
    return null;
  }

  for (const coding of vaccineCode.coding) {
    if (coding.system === CVX_CODE_SYSTEM && coding.code) {
      const mapping = CVX_TO_GROUP_MAP[coding.code];
      if (mapping) {
        return mapping;
      }
      return {
        cvxCode: coding.code,
        vaccineGroup: "Unknown",
        vaccineName: coding.display || `CVX ${coding.code}`,
      };
    }
  }

  if (vaccineCode.text) {
    return {
      cvxCode: "999",
      vaccineGroup: "Unknown",
      vaccineName: vaccineCode.text,
    };
  }

  return null;
}

function extractDate(fhirImmunization: FHIRImmunization): string | null {
  if (fhirImmunization.occurrenceDateTime) {
    return fhirImmunization.occurrenceDateTime.split("T")[0];
  }
  if (fhirImmunization.occurrenceString) {
    const parsed = new Date(fhirImmunization.occurrenceString);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  }
  return null;
}

function extractPerformer(fhirImmunization: FHIRImmunization): { name?: string; type?: "physician" | "pharmacist" | "nurse" | "other" } {
  if (!fhirImmunization.performer || fhirImmunization.performer.length === 0) {
    return {};
  }

  const primary = fhirImmunization.performer[0];
  const name = primary.actor?.display;
  
  let type: "physician" | "pharmacist" | "nurse" | "other" | undefined;
  if (primary.function?.coding) {
    for (const coding of primary.function.coding) {
      const code = coding.code?.toLowerCase();
      if (code === "ap" || code === "op" || code?.includes("physician")) {
        type = "physician";
      } else if (code?.includes("pharm")) {
        type = "pharmacist";
      } else if (code?.includes("nurse") || code === "rn" || code === "lpn") {
        type = "nurse";
      }
    }
  }

  return { name, type: type || "other" };
}

function determineConfidence(fhirImmunization: FHIRImmunization): ConfidenceLevel {
  if (fhirImmunization.primarySource === true) {
    return "high";
  }
  if (fhirImmunization.primarySource === false) {
    if (fhirImmunization.reportOrigin?.coding?.some(c => 
      c.code === "provider" || c.code === "record"
    )) {
      return "medium";
    }
    return "low";
  }
  if (fhirImmunization.meta?.source) {
    return "high";
  }
  return "medium";
}

function generateDuplicateKey(event: Partial<ImmunizationEvent>): string {
  const parts = [
    event.patientId,
    event.profileId,
    event.vaccineCode || event.vaccineGroup,
    event.dateAdministered,
  ].filter(Boolean);
  return parts.join("|").toLowerCase();
}

async function findExistingDuplicates(
  patientId: string,
  profileId: string,
  events: Partial<ImmunizationEvent>[]
): Promise<Map<string, ImmunizationEvent>> {
  const existingEvents = await vaccineScheduleEngine.getImmunizationEvents(patientId, profileId, "system");
  const duplicateMap = new Map<string, ImmunizationEvent>();
  
  for (const existing of existingEvents) {
    const key = generateDuplicateKey(existing);
    duplicateMap.set(key, existing);
  }
  
  return duplicateMap;
}

function detectConflict(
  fhirEvent: Partial<ImmunizationEvent>,
  existingEvent: ImmunizationEvent
): ImportConflict["conflictType"] | null {
  const fhirKey = generateDuplicateKey(fhirEvent);
  const existingKey = generateDuplicateKey(existingEvent);
  
  if (fhirKey === existingKey) {
    return "duplicate";
  }

  if (fhirEvent.vaccineGroup === existingEvent.vaccineGroup) {
    const fhirDate = new Date(fhirEvent.dateAdministered || "");
    const existingDate = new Date(existingEvent.dateAdministered);
    const daysDiff = Math.abs(fhirDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff <= 7) {
      if (fhirEvent.vaccineCode !== existingEvent.vaccineCode) {
        return "code_mismatch";
      }
      return "partial_match";
    }
    
    if (daysDiff <= 30 && fhirEvent.lotNumber && existingEvent.lotNumber && 
        fhirEvent.lotNumber === existingEvent.lotNumber) {
      return "date_mismatch";
    }
  }

  return null;
}

export const fhirImmunizationIngestionService = {
  mapFHIRToInternal(
    fhirImmunization: FHIRImmunization,
    patientId: string,
    profileId: string,
    sourceEhrName: string
  ): Partial<ImmunizationEvent> | null {
    if (fhirImmunization.status === "entered-in-error" || fhirImmunization.status === "not-done") {
      return null;
    }

    const cvxMapping = extractCVXCode(fhirImmunization.vaccineCode);
    if (!cvxMapping) {
      return null;
    }

    const dateAdministered = extractDate(fhirImmunization);
    if (!dateAdministered) {
      return null;
    }

    const performer = extractPerformer(fhirImmunization);
    const confidence = determineConfidence(fhirImmunization);

    return {
      patientId,
      profileId,
      vaccineCode: cvxMapping.cvxCode,
      vaccineName: cvxMapping.vaccineName,
      vaccineGroup: cvxMapping.vaccineGroup,
      dateAdministered,
      lotNumber: fhirImmunization.lotNumber,
      expirationDate: fhirImmunization.expirationDate,
      performer: performer.name,
      performerType: performer.type,
      location: fhirImmunization.location?.display,
      source: "fhir",
      confidence,
      verified: true,
      verifiedBy: `FHIR Import from ${sourceEhrName}`,
      verifiedAt: new Date().toISOString(),
      notes: fhirImmunization.note?.map(n => n.text).join("; "),
      evidenceFileIds: [],
    };
  },

  async importFromBundle(
    bundle: FHIRBundle,
    patientId: string,
    profileId: string,
    sourceEhrName: string,
    userId: string,
    options: {
      skipDuplicates?: boolean;
      autoResolveConflicts?: boolean;
      overrideExisting?: boolean;
    } = {}
  ): Promise<ImportResult> {
    const { skipDuplicates = true, autoResolveConflicts = false, overrideExisting = false } = options;

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "ImmunizationFHIRImport",
      resourceId: `${patientId}/${profileId}`,
      details: `FHIR immunization import from ${sourceEhrName}`,
    });

    const result: ImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      duplicates: 0,
      errors: 0,
      events: [],
      conflicts: [],
      errorDetails: [],
      disclaimer: NO_CDS_DISCLAIMER,
    };

    if (!bundle.entry || bundle.entry.length === 0) {
      return result;
    }

    const mappedEvents: Array<{
      fhirId: string;
      mapped: Partial<ImmunizationEvent>;
    }> = [];

    for (const entry of bundle.entry) {
      if (entry.resource?.resourceType !== "Immunization") {
        continue;
      }

      try {
        const mapped = this.mapFHIRToInternal(
          entry.resource,
          patientId,
          profileId,
          sourceEhrName
        );

        if (mapped) {
          mappedEvents.push({
            fhirId: entry.resource.id,
            mapped,
          });
        } else {
          result.skipped++;
        }
      } catch (error) {
        result.errors++;
        result.errorDetails.push(
          `Error mapping FHIR resource ${entry.resource.id}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    const existingDuplicates = await findExistingDuplicates(
      patientId,
      profileId,
      mappedEvents.map(e => e.mapped)
    );

    for (const { fhirId, mapped } of mappedEvents) {
      const key = generateDuplicateKey(mapped);
      const existing = existingDuplicates.get(key);

      if (existing) {
        const conflictType = detectConflict(mapped, existing);
        
        if (conflictType === "duplicate" && skipDuplicates) {
          result.duplicates++;
          continue;
        }

        if (conflictType && !autoResolveConflicts) {
          result.conflicts.push({
            id: generateId("conflict"),
            fhirResourceId: fhirId,
            existingEventId: existing.id,
            conflictType,
            fhirData: mapped,
            existingData: {
              vaccineCode: existing.vaccineCode,
              vaccineName: existing.vaccineName,
              dateAdministered: existing.dateAdministered,
              lotNumber: existing.lotNumber,
              source: existing.source,
            },
            resolution: "pending",
          });
          continue;
        }

        if (overrideExisting && existing) {
          continue;
        }
      }

      try {
        const newEvent = await vaccineScheduleEngine.addImmunizationEvent(
          {
            patientId: mapped.patientId!,
            profileId: mapped.profileId!,
            vaccineCode: mapped.vaccineCode!,
            vaccineName: mapped.vaccineName!,
            vaccineGroup: mapped.vaccineGroup!,
            dateAdministered: mapped.dateAdministered!,
            lotNumber: mapped.lotNumber,
            expirationDate: mapped.expirationDate,
            performer: mapped.performer,
            performerType: mapped.performerType,
            location: mapped.location,
            source: "fhir",
            confidence: mapped.confidence!,
            verified: true,
            verifiedBy: mapped.verifiedBy,
            verifiedAt: mapped.verifiedAt,
            notes: mapped.notes,
            evidenceFileIds: [],
          },
          userId
        );

        result.imported++;
        result.events.push(newEvent);
      } catch (error) {
        result.errors++;
        result.errorDetails.push(
          `Error saving immunization: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    result.success = result.errors === 0;

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "ImmunizationFHIRImportComplete",
      resourceId: `${patientId}/${profileId}`,
      details: `FHIR import complete: ${result.imported} imported, ${result.duplicates} duplicates, ${result.conflicts.length} conflicts, ${result.errors} errors`,
    });

    return result;
  },

  async resolveConflict(
    conflict: ImportConflict,
    resolution: "skip" | "merge" | "override",
    userId: string
  ): Promise<{ success: boolean; event?: ImmunizationEvent; message: string }> {
    logPhiAccess({
      userId,
      action: "write",
      resourceType: "ImmunizationConflictResolution",
      resourceId: conflict.id,
      details: `Conflict resolution: ${resolution}`,
    });

    if (resolution === "skip") {
      return {
        success: true,
        message: "Conflict skipped - existing record retained",
      };
    }

    if (resolution === "merge") {
      try {
        const fhirData = conflict.fhirData;
        const existingData = conflict.existingData;
        
        const mergedEvent = await vaccineScheduleEngine.addImmunizationEvent(
          {
            patientId: fhirData.patientId!,
            profileId: fhirData.profileId!,
            vaccineCode: fhirData.vaccineCode || existingData.vaccineCode || "unknown",
            vaccineName: fhirData.vaccineName || existingData.vaccineName || "Unknown Vaccine",
            vaccineGroup: fhirData.vaccineGroup || existingData.vaccineGroup || "Unknown",
            dateAdministered: fhirData.dateAdministered || existingData.dateAdministered || new Date().toISOString().split("T")[0],
            lotNumber: fhirData.lotNumber || existingData.lotNumber,
            expirationDate: fhirData.expirationDate,
            performer: fhirData.performer || existingData.performer,
            performerType: fhirData.performerType,
            location: fhirData.location || existingData.location,
            source: "fhir",
            confidence: fhirData.confidence || "medium",
            verified: true,
            verifiedBy: `Merged from FHIR and existing record (${conflict.existingEventId})`,
            verifiedAt: new Date().toISOString(),
            notes: `Merged record: FHIR data combined with existing record ${conflict.existingEventId}. ${fhirData.notes || ""}`,
            evidenceFileIds: [],
          },
          userId
        );

        return {
          success: true,
          event: mergedEvent,
          message: "Records merged successfully - FHIR data combined with existing record",
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to merge: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    }

    if (resolution === "override") {
      try {
        const data = conflict.fhirData;
        const newEvent = await vaccineScheduleEngine.addImmunizationEvent(
          {
            patientId: data.patientId!,
            profileId: data.profileId!,
            vaccineCode: data.vaccineCode!,
            vaccineName: data.vaccineName!,
            vaccineGroup: data.vaccineGroup!,
            dateAdministered: data.dateAdministered!,
            lotNumber: data.lotNumber,
            expirationDate: data.expirationDate,
            performer: data.performer,
            performerType: data.performerType,
            location: data.location,
            source: "fhir",
            confidence: data.confidence!,
            verified: true,
            verifiedBy: data.verifiedBy,
            verifiedAt: data.verifiedAt,
            notes: `Imported via conflict resolution (replaced ${conflict.existingEventId}). ${data.notes || ""}`,
            evidenceFileIds: [],
          },
          userId
        );

        return {
          success: true,
          event: newEvent,
          message: "FHIR record imported, original record retained for audit",
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to import: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    }

    return {
      success: false,
      message: "Invalid resolution type",
    };
  },

  async fetchAndImportFromEHR(
    connectionId: string,
    patientId: string,
    profileId: string,
    patientFhirId: string,
    accessToken: string,
    fhirServerUrl: string,
    ehrName: string,
    userId: string
  ): Promise<ImportResult> {
    logPhiAccess({
      userId,
      action: "read",
      resourceType: "ImmunizationFHIRFetch",
      resourceId: `${connectionId}/${patientFhirId}`,
      details: `Fetching immunizations from ${ehrName}`,
    });

    try {
      const immunizationUrl = `${fhirServerUrl}/Immunization?patient=${patientFhirId}&_count=100`;
      
      const response = await fetch(immunizationUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/fhir+json",
        },
      });

      if (!response.ok) {
        throw new Error(`FHIR request failed: ${response.status} ${response.statusText}`);
      }

      const bundle = await response.json() as FHIRBundle;

      return await this.importFromBundle(
        bundle,
        patientId,
        profileId,
        ehrName,
        userId,
        { skipDuplicates: true }
      );
    } catch (error) {
      logPhiAccess({
        userId,
        action: "read",
        resourceType: "ImmunizationFHIRFetchError",
        resourceId: connectionId,
        details: `FHIR fetch error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });

      return {
        success: false,
        imported: 0,
        skipped: 0,
        duplicates: 0,
        errors: 1,
        events: [],
        conflicts: [],
        errorDetails: [error instanceof Error ? error.message : "Unknown error"],
        disclaimer: NO_CDS_DISCLAIMER,
      };
    }
  },

  getDisclamer(): string {
    return NO_CDS_DISCLAIMER;
  },
};
