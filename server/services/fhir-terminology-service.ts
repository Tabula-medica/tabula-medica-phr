import { randomUUID } from "crypto";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function auditLog(action: string, resourceType: string, resourceId: string, userId: string, details: string): void {
  console.log(`[HIPAA-AUDIT][FHIRTerminology] ${action} - ${resourceType}:${resourceId} User:${userId} - ${details}`);
}

export type CodeSystemStatus = "DRAFT" | "ACTIVE" | "RETIRED" | "UNKNOWN";
export type ConceptRelationship = "IS_A" | "PART_OF" | "SUBSUMES" | "EQUIVALENT" | "BROADER" | "NARROWER";

export interface CodeSystem {
  id: string;
  url: string;
  version: string;
  name: string;
  title: string;
  status: CodeSystemStatus;
  publisher?: string;
  description?: string;
  hierarchyMeaning?: "IS_A" | "PART_OF" | "GROUPED_BY" | "CLASSIFIED_WITH";
  compositional?: boolean;
  conceptCount: number;
  lastUpdated: string;
}

export interface Concept {
  code: string;
  display: string;
  definition?: string;
  designation?: { language: string; use?: string; value: string }[];
  property?: { code: string; value: any }[];
  children?: Concept[];
  isAbstract?: boolean;
}

export interface ValueSet {
  id: string;
  url: string;
  version: string;
  name: string;
  title: string;
  status: CodeSystemStatus;
  description?: string;
  purpose?: string;
  compose: {
    include: {
      system: string;
      version?: string;
      concept?: { code: string; display?: string }[];
      filter?: { property: string; op: string; value: string }[];
    }[];
    exclude?: {
      system: string;
      concept?: { code: string }[];
    }[];
  };
  expansion?: ValueSetExpansion;
  lastUpdated: string;
}

export interface ValueSetExpansion {
  identifier: string;
  timestamp: string;
  total: number;
  offset?: number;
  contains: { system: string; code: string; display?: string; abstract?: boolean }[];
}

export interface ConceptMap {
  id: string;
  url: string;
  version: string;
  name: string;
  title: string;
  status: CodeSystemStatus;
  sourceUri: string;
  targetUri: string;
  description?: string;
  group: ConceptMapGroup[];
  lastUpdated: string;
}

export interface ConceptMapGroup {
  source: string;
  sourceVersion?: string;
  target: string;
  targetVersion?: string;
  element: ConceptMapElement[];
}

export interface ConceptMapElement {
  code: string;
  display?: string;
  target: {
    code: string;
    display?: string;
    equivalence: "equivalent" | "equal" | "wider" | "subsumes" | "narrower" | "specializes" | "inexact" | "unmatched" | "disjoint";
    comment?: string;
  }[];
}

export interface LookupResult {
  name: string;
  version?: string;
  display: string;
  definition?: string;
  designation?: { language: string; use?: string; value: string }[];
  property?: { code: string; value: any; description?: string }[];
}

export interface ValidateCodeResult {
  result: boolean;
  message?: string;
  display?: string;
  code?: string;
  system?: string;
  version?: string;
  codeableConcept?: {
    coding: { system: string; code: string; display?: string }[];
    text?: string;
  };
}

export interface TranslateResult {
  result: boolean;
  message?: string;
  matches: {
    equivalence: string;
    concept: { system: string; code: string; display?: string };
    source?: string;
  }[];
}

const codeSystems = new Map<string, CodeSystem>();
const concepts = new Map<string, Map<string, Concept>>();
const valueSets = new Map<string, ValueSet>();
const conceptMaps = new Map<string, ConceptMap>();

function initializeSampleData(): void {
  const now = new Date().toISOString();

  const snomedCt: CodeSystem = {
    id: "snomed-ct",
    url: "http://snomed.info/sct",
    version: "2024-01",
    name: "SNOMED_CT",
    title: "SNOMED Clinical Terms",
    status: "ACTIVE",
    publisher: "SNOMED International",
    description: "SNOMED CT is a systematically organized computer-processable collection of medical terms.",
    hierarchyMeaning: "IS_A",
    compositional: true,
    conceptCount: 350000,
    lastUpdated: now
  };

  const loinc: CodeSystem = {
    id: "loinc",
    url: "http://loinc.org",
    version: "2.77",
    name: "LOINC",
    title: "Logical Observation Identifiers Names and Codes",
    status: "ACTIVE",
    publisher: "Regenstrief Institute",
    description: "LOINC provides a set of universal codes for identifying laboratory and clinical test results.",
    conceptCount: 98000,
    lastUpdated: now
  };

  const icd10: CodeSystem = {
    id: "icd-10-cm",
    url: "http://hl7.org/fhir/sid/icd-10-cm",
    version: "2024",
    name: "ICD10CM",
    title: "International Classification of Diseases, 10th Revision, Clinical Modification",
    status: "ACTIVE",
    publisher: "National Center for Health Statistics",
    description: "ICD-10-CM is the standard transaction code set for diagnostic purposes.",
    hierarchyMeaning: "IS_A",
    conceptCount: 72000,
    lastUpdated: now
  };

  const rxNorm: CodeSystem = {
    id: "rxnorm",
    url: "http://www.nlm.nih.gov/research/umls/rxnorm",
    version: "2024-01",
    name: "RxNorm",
    title: "RxNorm",
    status: "ACTIVE",
    publisher: "National Library of Medicine",
    description: "RxNorm provides normalized names for clinical drugs.",
    conceptCount: 118000,
    lastUpdated: now
  };

  const cpt: CodeSystem = {
    id: "cpt",
    url: "http://www.ama-assn.org/go/cpt",
    version: "2024",
    name: "CPT",
    title: "Current Procedural Terminology",
    status: "ACTIVE",
    publisher: "American Medical Association",
    description: "CPT codes are used to describe medical, surgical, and diagnostic services.",
    conceptCount: 10000,
    lastUpdated: now
  };

  const cvx: CodeSystem = {
    id: "cvx",
    url: "http://hl7.org/fhir/sid/cvx",
    version: "2024-01",
    name: "CVX",
    title: "Vaccines Administered",
    status: "ACTIVE",
    publisher: "CDC National Center for Immunization and Respiratory Diseases",
    description: "CVX codes are used to identify vaccines administered.",
    conceptCount: 200,
    lastUpdated: now
  };

  [snomedCt, loinc, icd10, rxNorm, cpt, cvx].forEach(cs => codeSystems.set(cs.id, cs));

  const snomedConcepts = new Map<string, Concept>();
  snomedConcepts.set("38341003", { code: "38341003", display: "Hypertension", definition: "Disorder characterized by elevated arterial blood pressure" });
  snomedConcepts.set("44054006", { code: "44054006", display: "Type 2 diabetes mellitus", definition: "Diabetes mellitus type 2" });
  snomedConcepts.set("73211009", { code: "73211009", display: "Diabetes mellitus", definition: "A metabolic disorder characterized by high blood sugar" });
  snomedConcepts.set("84114007", { code: "84114007", display: "Heart failure", definition: "Condition in which the heart is unable to pump enough blood" });
  snomedConcepts.set("195967001", { code: "195967001", display: "Asthma", definition: "Chronic inflammatory disease of the airways" });
  snomedConcepts.set("13645005", { code: "13645005", display: "Chronic obstructive pulmonary disease", definition: "COPD - progressive lung disease" });
  snomedConcepts.set("22298006", { code: "22298006", display: "Myocardial infarction", definition: "Heart attack" });
  snomedConcepts.set("40930008", { code: "40930008", display: "Hypothyroidism", definition: "Underactive thyroid condition" });
  concepts.set("snomed-ct", snomedConcepts);

  const loincConcepts = new Map<string, Concept>();
  loincConcepts.set("2339-0", { code: "2339-0", display: "Glucose [Mass/volume] in Blood", definition: "Blood glucose measurement" });
  loincConcepts.set("4548-4", { code: "4548-4", display: "Hemoglobin A1c/Hemoglobin.total in Blood", definition: "HbA1c measurement" });
  loincConcepts.set("2093-3", { code: "2093-3", display: "Cholesterol [Mass/volume] in Serum or Plasma", definition: "Total cholesterol" });
  loincConcepts.set("2571-8", { code: "2571-8", display: "Triglyceride [Mass/volume] in Serum or Plasma", definition: "Triglyceride level" });
  loincConcepts.set("718-7", { code: "718-7", display: "Hemoglobin [Mass/volume] in Blood", definition: "Hemoglobin measurement" });
  loincConcepts.set("8480-6", { code: "8480-6", display: "Systolic blood pressure", definition: "Systolic BP measurement" });
  loincConcepts.set("8462-4", { code: "8462-4", display: "Diastolic blood pressure", definition: "Diastolic BP measurement" });
  loincConcepts.set("29463-7", { code: "29463-7", display: "Body weight", definition: "Patient body weight" });
  loincConcepts.set("8302-2", { code: "8302-2", display: "Body height", definition: "Patient body height" });
  loincConcepts.set("39156-5", { code: "39156-5", display: "Body mass index (BMI) [Ratio]", definition: "BMI calculation" });
  concepts.set("loinc", loincConcepts);

  const icd10Concepts = new Map<string, Concept>();
  icd10Concepts.set("I10", { code: "I10", display: "Essential (primary) hypertension" });
  icd10Concepts.set("E11.9", { code: "E11.9", display: "Type 2 diabetes mellitus without complications" });
  icd10Concepts.set("I50.9", { code: "I50.9", display: "Heart failure, unspecified" });
  icd10Concepts.set("J45.909", { code: "J45.909", display: "Unspecified asthma, uncomplicated" });
  icd10Concepts.set("J44.9", { code: "J44.9", display: "Chronic obstructive pulmonary disease, unspecified" });
  concepts.set("icd-10-cm", icd10Concepts);

  const conditionValueSet: ValueSet = {
    id: "vs-us-core-condition",
    url: "http://hl7.org/fhir/us/core/ValueSet/us-core-condition-code",
    version: "6.1.0",
    name: "USCoreConditionCode",
    title: "US Core Condition Codes",
    status: "ACTIVE",
    description: "This value set includes codes from SNOMED CT and ICD-10-CM for conditions",
    compose: {
      include: [
        { system: "http://snomed.info/sct" },
        { system: "http://hl7.org/fhir/sid/icd-10-cm" }
      ]
    },
    expansion: {
      identifier: generateId("expansion"),
      timestamp: now,
      total: 1000,
      contains: [
        { system: "http://snomed.info/sct", code: "38341003", display: "Hypertension" },
        { system: "http://snomed.info/sct", code: "44054006", display: "Type 2 diabetes mellitus" },
        { system: "http://snomed.info/sct", code: "84114007", display: "Heart failure" },
        { system: "http://hl7.org/fhir/sid/icd-10-cm", code: "I10", display: "Essential hypertension" },
        { system: "http://hl7.org/fhir/sid/icd-10-cm", code: "E11.9", display: "Type 2 diabetes mellitus" }
      ]
    },
    lastUpdated: now
  };

  const observationValueSet: ValueSet = {
    id: "vs-observation-codes",
    url: "http://hl7.org/fhir/ValueSet/observation-codes",
    version: "4.0.1",
    name: "LOINCCodes",
    title: "LOINC Codes",
    status: "ACTIVE",
    description: "This value set includes all LOINC codes for observations",
    compose: {
      include: [{ system: "http://loinc.org" }]
    },
    expansion: {
      identifier: generateId("expansion"),
      timestamp: now,
      total: 98000,
      contains: [
        { system: "http://loinc.org", code: "2339-0", display: "Glucose [Mass/volume] in Blood" },
        { system: "http://loinc.org", code: "4548-4", display: "Hemoglobin A1c" },
        { system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" },
        { system: "http://loinc.org", code: "8462-4", display: "Diastolic blood pressure" }
      ]
    },
    lastUpdated: now
  };

  const vitalSignsValueSet: ValueSet = {
    id: "vs-vital-signs",
    url: "http://hl7.org/fhir/ValueSet/observation-vitalsignresult",
    version: "4.0.1",
    name: "VitalSigns",
    title: "Vital Signs",
    status: "ACTIVE",
    description: "This value set includes vital sign observation codes",
    compose: {
      include: [{
        system: "http://loinc.org",
        concept: [
          { code: "8480-6", display: "Systolic blood pressure" },
          { code: "8462-4", display: "Diastolic blood pressure" },
          { code: "8867-4", display: "Heart rate" },
          { code: "9279-1", display: "Respiratory rate" },
          { code: "8310-5", display: "Body temperature" },
          { code: "29463-7", display: "Body weight" },
          { code: "8302-2", display: "Body height" },
          { code: "39156-5", display: "BMI" }
        ]
      }]
    },
    lastUpdated: now
  };

  [conditionValueSet, observationValueSet, vitalSignsValueSet].forEach(vs => valueSets.set(vs.id, vs));

  const snomedToIcd10Map: ConceptMap = {
    id: "cm-snomed-icd10",
    url: "http://example.org/fhir/ConceptMap/snomed-to-icd10",
    version: "1.0.0",
    name: "SNOMEDToICD10",
    title: "SNOMED CT to ICD-10-CM Map",
    status: "ACTIVE",
    sourceUri: "http://snomed.info/sct",
    targetUri: "http://hl7.org/fhir/sid/icd-10-cm",
    description: "Mapping from SNOMED CT clinical findings to ICD-10-CM diagnosis codes",
    group: [{
      source: "http://snomed.info/sct",
      target: "http://hl7.org/fhir/sid/icd-10-cm",
      element: [
        { code: "38341003", display: "Hypertension", target: [{ code: "I10", display: "Essential hypertension", equivalence: "equivalent" }] },
        { code: "44054006", display: "Type 2 diabetes mellitus", target: [{ code: "E11.9", display: "Type 2 DM", equivalence: "equivalent" }] },
        { code: "84114007", display: "Heart failure", target: [{ code: "I50.9", display: "Heart failure unspecified", equivalence: "wider" }] },
        { code: "195967001", display: "Asthma", target: [{ code: "J45.909", display: "Asthma uncomplicated", equivalence: "wider" }] }
      ]
    }],
    lastUpdated: now
  };

  conceptMaps.set(snomedToIcd10Map.id, snomedToIcd10Map);
}

initializeSampleData();

class FhirTerminologyService {
  lookupCode(params: {
    system: string;
    code: string;
    version?: string;
    displayLanguage?: string;
    userId: string;
  }): LookupResult | null {
    const codeSystemId = this.getCodeSystemIdFromUrl(params.system);
    const systemConcepts = concepts.get(codeSystemId);
    
    if (!systemConcepts) {
      auditLog("LOOKUP_FAILED", "Concept", params.code, params.userId,
        `Code system not found: ${params.system}`);
      return null;
    }

    const concept = systemConcepts.get(params.code);
    if (!concept) {
      auditLog("LOOKUP_FAILED", "Concept", params.code, params.userId,
        `Code not found: ${params.code} in ${params.system}`);
      return null;
    }

    const codeSystem = Array.from(codeSystems.values()).find(cs => cs.url === params.system);

    auditLog("LOOKUP_SUCCESS", "Concept", params.code, params.userId,
      `Found: ${concept.display} in ${params.system}`);

    return {
      name: codeSystem?.name || "Unknown",
      version: params.version || codeSystem?.version,
      display: concept.display,
      definition: concept.definition,
      designation: concept.designation,
      property: concept.property
    };
  }

  validateCode(params: {
    url?: string;
    valueSet?: string;
    code: string;
    system: string;
    display?: string;
    coding?: { system: string; code: string; display?: string }[];
    userId: string;
  }): ValidateCodeResult {
    if (params.valueSet) {
      const valueSet = this.getValueSetByUrl(params.valueSet);
      if (valueSet) {
        const isValid = this.codeInValueSet(params.system, params.code, valueSet);
        
        auditLog("VALIDATE_CODE", "Concept", params.code, params.userId,
          `Validation against ${params.valueSet}: ${isValid ? "VALID" : "INVALID"}`);

        return {
          result: isValid,
          message: isValid ? "Code is valid" : "Code not found in value set",
          code: params.code,
          system: params.system,
          display: params.display
        };
      }
    }

    const lookupResult = this.lookupCode({
      system: params.system,
      code: params.code,
      userId: params.userId
    });

    const isValid = lookupResult !== null;

    return {
      result: isValid,
      message: isValid ? "Code exists in code system" : "Code not found",
      code: params.code,
      system: params.system,
      display: lookupResult?.display || params.display
    };
  }

  translateCode(params: {
    conceptMapUrl?: string;
    code: string;
    system: string;
    targetSystem?: string;
    userId: string;
  }): TranslateResult {
    let targetMap: ConceptMap | undefined;

    if (params.conceptMapUrl) {
      targetMap = Array.from(conceptMaps.values()).find(cm => cm.url === params.conceptMapUrl);
    } else if (params.targetSystem) {
      targetMap = Array.from(conceptMaps.values()).find(cm => 
        cm.sourceUri === params.system && cm.targetUri === params.targetSystem
      );
    }

    if (!targetMap) {
      auditLog("TRANSLATE_FAILED", "Concept", params.code, params.userId,
        `No concept map found for ${params.system} to ${params.targetSystem || "any"}`);
      return { result: false, message: "No suitable concept map found", matches: [] };
    }

    const matches: TranslateResult["matches"] = [];

    for (const group of targetMap.group) {
      if (group.source !== params.system) continue;

      for (const element of group.element) {
        if (element.code === params.code) {
          for (const target of element.target) {
            matches.push({
              equivalence: target.equivalence,
              concept: {
                system: group.target,
                code: target.code,
                display: target.display
              },
              source: targetMap.url
            });
          }
        }
      }
    }

    auditLog("TRANSLATE_SUCCESS", "Concept", params.code, params.userId,
      `Found ${matches.length} translation(s) from ${params.system}`);

    return {
      result: matches.length > 0,
      message: matches.length > 0 ? "Translation found" : "No translation available",
      matches
    };
  }

  expandValueSet(params: {
    valueSetId?: string;
    url?: string;
    filter?: string;
    offset?: number;
    count?: number;
    userId: string;
  }): ValueSetExpansion | null {
    let valueSet: ValueSet | undefined;

    if (params.valueSetId) {
      valueSet = valueSets.get(params.valueSetId);
    } else if (params.url) {
      valueSet = Array.from(valueSets.values()).find(vs => vs.url === params.url);
    }

    if (!valueSet) {
      auditLog("EXPAND_FAILED", "ValueSet", params.valueSetId || params.url || "unknown",
        params.userId, "Value set not found");
      return null;
    }

    let contains = valueSet.expansion?.contains || [];

    if (params.filter) {
      const filterLower = params.filter.toLowerCase();
      contains = contains.filter(c => 
        c.code.toLowerCase().includes(filterLower) ||
        (c.display && c.display.toLowerCase().includes(filterLower))
      );
    }

    const offset = params.offset || 0;
    const count = params.count || 100;
    const paged = contains.slice(offset, offset + count);

    auditLog("EXPAND_SUCCESS", "ValueSet", valueSet.id, params.userId,
      `Expanded ${paged.length} concepts (filter: ${params.filter || "none"})`);

    return {
      identifier: generateId("expansion"),
      timestamp: new Date().toISOString(),
      total: contains.length,
      offset,
      contains: paged
    };
  }

  getCodeSystems(params?: { status?: CodeSystemStatus }): CodeSystem[] {
    let result = Array.from(codeSystems.values());
    
    if (params?.status) {
      result = result.filter(cs => cs.status === params.status);
    }

    return result;
  }

  getCodeSystem(codeSystemId: string): CodeSystem | null {
    return codeSystems.get(codeSystemId) || null;
  }

  searchConcepts(params: {
    system: string;
    filter: string;
    count?: number;
    userId: string;
  }): { code: string; display: string; system: string }[] {
    const codeSystemId = this.getCodeSystemIdFromUrl(params.system);
    const systemConcepts = concepts.get(codeSystemId);
    
    if (!systemConcepts) return [];

    const filterLower = params.filter.toLowerCase();
    const results: { code: string; display: string; system: string }[] = [];

    systemConcepts.forEach((concept, code) => {
      if (results.length >= (params.count || 20)) return;
      
      if (code.toLowerCase().includes(filterLower) ||
          concept.display.toLowerCase().includes(filterLower) ||
          (concept.definition && concept.definition.toLowerCase().includes(filterLower))) {
        results.push({
          code,
          display: concept.display,
          system: params.system
        });
      }
    });

    auditLog("SEARCH_CONCEPTS", "CodeSystem", codeSystemId, params.userId,
      `Found ${results.length} concepts matching "${params.filter}"`);

    return results;
  }

  getValueSets(params?: { status?: CodeSystemStatus }): ValueSet[] {
    let result = Array.from(valueSets.values());
    
    if (params?.status) {
      result = result.filter(vs => vs.status === params.status);
    }

    return result;
  }

  getValueSet(valueSetId: string): ValueSet | null {
    return valueSets.get(valueSetId) || null;
  }

  getConceptMaps(params?: { sourceUri?: string; targetUri?: string }): ConceptMap[] {
    let result = Array.from(conceptMaps.values());

    if (params?.sourceUri) {
      result = result.filter(cm => cm.sourceUri === params.sourceUri);
    }
    if (params?.targetUri) {
      result = result.filter(cm => cm.targetUri === params.targetUri);
    }

    return result;
  }

  getConceptMap(conceptMapId: string): ConceptMap | null {
    return conceptMaps.get(conceptMapId) || null;
  }

  createValueSet(params: Omit<ValueSet, "id" | "lastUpdated">, userId: string): ValueSet {
    const valueSet: ValueSet = {
      ...params,
      id: generateId("vs"),
      lastUpdated: new Date().toISOString()
    };

    valueSets.set(valueSet.id, valueSet);

    auditLog("VALUESET_CREATED", "ValueSet", valueSet.id, userId,
      `Created value set: ${valueSet.name}`);

    return valueSet;
  }

  createConceptMap(params: Omit<ConceptMap, "id" | "lastUpdated">, userId: string): ConceptMap {
    const conceptMap: ConceptMap = {
      ...params,
      id: generateId("cm"),
      lastUpdated: new Date().toISOString()
    };

    conceptMaps.set(conceptMap.id, conceptMap);

    auditLog("CONCEPTMAP_CREATED", "ConceptMap", conceptMap.id, userId,
      `Created concept map: ${conceptMap.name}`);

    return conceptMap;
  }

  getTerminologyStats(): {
    totalCodeSystems: number;
    totalValueSets: number;
    totalConceptMaps: number;
    codeSystemSummary: { name: string; conceptCount: number; status: string }[];
    supportedTerminologies: string[];
  } {
    return {
      totalCodeSystems: codeSystems.size,
      totalValueSets: valueSets.size,
      totalConceptMaps: conceptMaps.size,
      codeSystemSummary: Array.from(codeSystems.values()).map(cs => ({
        name: cs.name,
        conceptCount: cs.conceptCount,
        status: cs.status
      })),
      supportedTerminologies: [
        "SNOMED CT",
        "LOINC",
        "ICD-10-CM",
        "RxNorm",
        "CPT",
        "CVX",
        "NDC",
        "HCPCS"
      ]
    };
  }

  private getCodeSystemIdFromUrl(url: string): string {
    const mapping: Record<string, string> = {
      "http://snomed.info/sct": "snomed-ct",
      "http://loinc.org": "loinc",
      "http://hl7.org/fhir/sid/icd-10-cm": "icd-10-cm",
      "http://www.nlm.nih.gov/research/umls/rxnorm": "rxnorm",
      "http://www.ama-assn.org/go/cpt": "cpt",
      "http://hl7.org/fhir/sid/cvx": "cvx"
    };
    return mapping[url] || url;
  }

  private getValueSetByUrl(url: string): ValueSet | undefined {
    return Array.from(valueSets.values()).find(vs => vs.url === url);
  }

  private codeInValueSet(system: string, code: string, valueSet: ValueSet): boolean {
    if (valueSet.expansion?.contains) {
      return valueSet.expansion.contains.some(c => c.system === system && c.code === code);
    }

    for (const include of valueSet.compose.include) {
      if (include.system === system) {
        if (!include.concept) return true;
        if (include.concept.some(c => c.code === code)) return true;
      }
    }

    return false;
  }
}

export const fhirTerminologyService = new FhirTerminologyService();

console.log("[FHIRTerminology] Service initialized");
console.log("[FHIRTerminology] Code systems loaded:", codeSystems.size);
console.log("[FHIRTerminology] Value sets loaded:", valueSets.size);
console.log("[FHIRTerminology] Concept maps loaded:", conceptMaps.size);
console.log("[FHIRTerminology] Supported: SNOMED CT, LOINC, ICD-10-CM, RxNorm, CPT, CVX");
