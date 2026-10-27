import { db } from "./db";
import { 
  terminologyMappings,
  fhirValueSets,
  type InsertTerminologyMapping,
  type TerminologyMapping,
  TERMINOLOGY_SYSTEMS,
  EQUIVALENCE_TYPES
} from "../shared/schema";
import { eq, and, or, ilike } from "drizzle-orm";

export interface CodeableConcept {
  coding?: Array<{
    system?: string;
    code?: string;
    display?: string;
    version?: string;
  }>;
  text?: string;
}

export interface MappingResult {
  sourceSystem: string;
  sourceCode: string;
  sourceDisplay?: string;
  targetSystem: string;
  targetCode: string;
  targetDisplay?: string;
  equivalenceType: typeof EQUIVALENCE_TYPES[number];
  confidence: number;
  mappingSource: string;
}

export interface HarmonizedCode {
  system: string;
  code: string;
  display?: string;
  original: CodeableConcept;
  mappings: MappingResult[];
}

const COMMON_SNOMED_MAPPINGS: Record<string, { loinc?: string; icd10?: string; display: string }> = {
  "271649006": { loinc: "2093-3", display: "Systolic blood pressure" },
  "271650006": { loinc: "2085-9", display: "Diastolic blood pressure" },
  "27113001": { loinc: "8310-5", display: "Body temperature" },
  "78564009": { loinc: "8867-4", display: "Heart rate" },
  "86290005": { loinc: "9279-1", display: "Respiratory rate" },
  "60621009": { loinc: "3141-9", display: "Body weight" },
  "50373000": { loinc: "8302-2", display: "Body height" },
  "73211009": { icd10: "E11", display: "Diabetes mellitus" },
  "38341003": { icd10: "I10", display: "Hypertension" },
  "195967001": { icd10: "J06.9", display: "Upper respiratory infection" },
  "233604007": { icd10: "I63.9", display: "Cerebral infarction" },
  "22298006": { icd10: "I21.9", display: "Myocardial infarction" },
  "13645005": { icd10: "J45.909", display: "Asthma" },
  "40055000": { icd10: "F32.9", display: "Major depressive disorder" },
  "197480006": { icd10: "M54.5", display: "Low back pain" },
};

const COMMON_LOINC_CATEGORIES: Record<string, string[]> = {
  "vital-signs": ["8867-4", "9279-1", "8310-5", "8480-6", "8462-4", "8302-2", "29463-7", "8287-5", "59408-5"],
  "laboratory": ["2093-3", "2571-8", "2339-0", "2345-7", "6299-2", "789-8", "718-7", "4544-3"],
  "imaging": ["18748-4", "18782-3", "24558-9", "24859-0", "30746-2"],
};

const ICD10_TO_SNOMED: Record<string, { snomed: string; display: string }> = {
  "E11": { snomed: "44054006", display: "Type 2 diabetes mellitus" },
  "E10": { snomed: "46635009", display: "Type 1 diabetes mellitus" },
  "I10": { snomed: "38341003", display: "Hypertensive disorder" },
  "J45": { snomed: "195967001", display: "Asthma" },
  "F32": { snomed: "35489007", display: "Depressive disorder" },
  "M54.5": { snomed: "279039007", display: "Low back pain" },
  "I21": { snomed: "22298006", display: "Myocardial infarction" },
  "I63": { snomed: "230690007", display: "Cerebrovascular accident" },
  "N18": { snomed: "709044004", display: "Chronic kidney disease" },
  "J06.9": { snomed: "54150009", display: "Upper respiratory infection" },
};

export class TerminologyService {
  private mappingCache: Map<string, MappingResult[]> = new Map();

  async translateCode(
    sourceSystem: string,
    sourceCode: string,
    targetSystem: string
  ): Promise<MappingResult | null> {
    const cacheKey = `${sourceSystem}|${sourceCode}|${targetSystem}`;
    const cached = this.mappingCache.get(cacheKey);
    if (cached?.length) {
      return cached[0];
    }

    const [dbMapping] = await db
      .select()
      .from(terminologyMappings)
      .where(and(
        eq(terminologyMappings.sourceSystem, sourceSystem),
        eq(terminologyMappings.sourceCode, sourceCode),
        eq(terminologyMappings.targetSystem, targetSystem)
      ))
      .limit(1);

    if (dbMapping) {
      const result: MappingResult = {
        sourceSystem: dbMapping.sourceSystem,
        sourceCode: dbMapping.sourceCode,
        sourceDisplay: dbMapping.sourceDisplay || undefined,
        targetSystem: dbMapping.targetSystem,
        targetCode: dbMapping.targetCode,
        targetDisplay: dbMapping.targetDisplay || undefined,
        equivalenceType: dbMapping.equivalenceType as typeof EQUIVALENCE_TYPES[number],
        confidence: dbMapping.confidence || 100,
        mappingSource: dbMapping.mappingSource || "database",
      };
      this.mappingCache.set(cacheKey, [result]);
      return result;
    }

    const builtinMapping = this.getBuiltinMapping(sourceSystem, sourceCode, targetSystem);
    if (builtinMapping) {
      this.mappingCache.set(cacheKey, [builtinMapping]);
      return builtinMapping;
    }

    return null;
  }

  async translateCodeableConcept(
    concept: CodeableConcept,
    targetSystems: string[]
  ): Promise<HarmonizedCode[]> {
    const results: HarmonizedCode[] = [];

    if (!concept.coding?.length) {
      return results;
    }

    for (const coding of concept.coding) {
      if (!coding.system || !coding.code) continue;

      const mappings: MappingResult[] = [];

      for (const targetSystem of targetSystems) {
        if (targetSystem === coding.system) continue;

        const mapping = await this.translateCode(coding.system, coding.code, targetSystem);
        if (mapping) {
          mappings.push(mapping);
        }
      }

      results.push({
        system: coding.system,
        code: coding.code,
        display: coding.display,
        original: concept,
        mappings,
      });
    }

    return results;
  }

  private getBuiltinMapping(
    sourceSystem: string,
    sourceCode: string,
    targetSystem: string
  ): MappingResult | null {
    if (sourceSystem === "http://snomed.info/sct") {
      const snomedMap = COMMON_SNOMED_MAPPINGS[sourceCode];
      if (snomedMap) {
        if (targetSystem === "http://loinc.org" && snomedMap.loinc) {
          return {
            sourceSystem,
            sourceCode,
            sourceDisplay: snomedMap.display,
            targetSystem: "http://loinc.org",
            targetCode: snomedMap.loinc,
            targetDisplay: snomedMap.display,
            equivalenceType: "equivalent",
            confidence: 95,
            mappingSource: "builtin-snomed-loinc",
          };
        }
        if (targetSystem.includes("icd-10") && snomedMap.icd10) {
          return {
            sourceSystem,
            sourceCode,
            sourceDisplay: snomedMap.display,
            targetSystem: "http://hl7.org/fhir/sid/icd-10-cm",
            targetCode: snomedMap.icd10,
            targetDisplay: snomedMap.display,
            equivalenceType: "equivalent",
            confidence: 90,
            mappingSource: "builtin-snomed-icd10",
          };
        }
      }
    }

    if (sourceSystem.includes("icd-10")) {
      const normalizedCode = sourceCode.split(".")[0];
      const icdMap = ICD10_TO_SNOMED[normalizedCode] || ICD10_TO_SNOMED[sourceCode];
      if (icdMap && targetSystem === "http://snomed.info/sct") {
        return {
          sourceSystem,
          sourceCode,
          sourceDisplay: icdMap.display,
          targetSystem: "http://snomed.info/sct",
          targetCode: icdMap.snomed,
          targetDisplay: icdMap.display,
          equivalenceType: "equivalent",
          confidence: 85,
          mappingSource: "builtin-icd10-snomed",
        };
      }
    }

    return null;
  }

  async findEquivalentCodes(
    system: string,
    code: string
  ): Promise<MappingResult[]> {
    const cacheKey = `equivalents|${system}|${code}`;
    const cached = this.mappingCache.get(cacheKey);
    if (cached) return cached;

    const dbMappings = await db
      .select()
      .from(terminologyMappings)
      .where(or(
        and(
          eq(terminologyMappings.sourceSystem, system),
          eq(terminologyMappings.sourceCode, code)
        ),
        and(
          eq(terminologyMappings.targetSystem, system),
          eq(terminologyMappings.targetCode, code)
        )
      ));

    const results: MappingResult[] = dbMappings.map(m => ({
      sourceSystem: m.sourceSystem,
      sourceCode: m.sourceCode,
      sourceDisplay: m.sourceDisplay || undefined,
      targetSystem: m.targetSystem,
      targetCode: m.targetCode,
      targetDisplay: m.targetDisplay || undefined,
      equivalenceType: m.equivalenceType as typeof EQUIVALENCE_TYPES[number],
      confidence: m.confidence || 100,
      mappingSource: m.mappingSource || "database",
    }));

    for (const targetSystem of TERMINOLOGY_SYSTEMS) {
      if (targetSystem === system) continue;
      
      const builtinMapping = this.getBuiltinMapping(system, code, targetSystem);
      if (builtinMapping && !results.some(r => 
        r.targetSystem === builtinMapping.targetSystem && 
        r.targetCode === builtinMapping.targetCode
      )) {
        results.push(builtinMapping);
      }
    }

    this.mappingCache.set(cacheKey, results);
    return results;
  }

  async searchConcepts(
    query: string,
    system?: string,
    limit: number = 20
  ): Promise<Array<{ system: string; code: string; display: string }>> {
    const results: Array<{ system: string; code: string; display: string }> = [];

    const mappings = await db
      .select()
      .from(terminologyMappings)
      .where(
        system
          ? and(
              eq(terminologyMappings.sourceSystem, system),
              or(
                ilike(terminologyMappings.sourceDisplay, `%${query}%`),
                ilike(terminologyMappings.sourceCode, `%${query}%`)
              )
            )
          : or(
              ilike(terminologyMappings.sourceDisplay, `%${query}%`),
              ilike(terminologyMappings.sourceCode, `%${query}%`)
            )
      )
      .limit(limit);

    for (const mapping of mappings) {
      if (!results.some(r => r.system === mapping.sourceSystem && r.code === mapping.sourceCode)) {
        results.push({
          system: mapping.sourceSystem,
          code: mapping.sourceCode,
          display: mapping.sourceDisplay || mapping.sourceCode,
        });
      }
    }

    for (const [snomedCode, mapping] of Object.entries(COMMON_SNOMED_MAPPINGS)) {
      if (mapping.display.toLowerCase().includes(query.toLowerCase()) || snomedCode.includes(query)) {
        if (!system || system === "http://snomed.info/sct") {
          if (!results.some(r => r.code === snomedCode)) {
            results.push({
              system: "http://snomed.info/sct",
              code: snomedCode,
              display: mapping.display,
            });
          }
        }
      }
    }

    return results.slice(0, limit);
  }

  async addMapping(mapping: InsertTerminologyMapping): Promise<TerminologyMapping> {
    const [result] = await db
      .insert(terminologyMappings)
      .values(mapping)
      .returning();

    const cacheKey = `${mapping.sourceSystem}|${mapping.sourceCode}|${mapping.targetSystem}`;
    this.mappingCache.delete(cacheKey);
    this.mappingCache.delete(`equivalents|${mapping.sourceSystem}|${mapping.sourceCode}`);

    return result;
  }

  async getMappingStatistics(): Promise<{
    totalMappings: number;
    bySourceSystem: Record<string, number>;
    byTargetSystem: Record<string, number>;
    byEquivalenceType: Record<string, number>;
    verifiedCount: number;
  }> {
    const allMappings = await db.select().from(terminologyMappings);

    const stats = {
      totalMappings: allMappings.length,
      bySourceSystem: {} as Record<string, number>,
      byTargetSystem: {} as Record<string, number>,
      byEquivalenceType: {} as Record<string, number>,
      verifiedCount: 0,
    };

    for (const mapping of allMappings) {
      stats.bySourceSystem[mapping.sourceSystem] = (stats.bySourceSystem[mapping.sourceSystem] || 0) + 1;
      stats.byTargetSystem[mapping.targetSystem] = (stats.byTargetSystem[mapping.targetSystem] || 0) + 1;
      stats.byEquivalenceType[mapping.equivalenceType] = (stats.byEquivalenceType[mapping.equivalenceType] || 0) + 1;
      if (mapping.isVerified) stats.verifiedCount++;
    }

    return stats;
  }

  normalizeCodeSystem(system: string): string {
    const systemNormalization: Record<string, string> = {
      "SNOMED": "http://snomed.info/sct",
      "SNOMED-CT": "http://snomed.info/sct",
      "sct": "http://snomed.info/sct",
      "LOINC": "http://loinc.org",
      "ICD-10": "http://hl7.org/fhir/sid/icd-10",
      "ICD-10-CM": "http://hl7.org/fhir/sid/icd-10-cm",
      "ICD10": "http://hl7.org/fhir/sid/icd-10",
      "RxNorm": "http://www.nlm.nih.gov/research/umls/rxnorm",
      "RXNORM": "http://www.nlm.nih.gov/research/umls/rxnorm",
      "CVX": "http://hl7.org/fhir/sid/cvx",
      "NDC": "http://hl7.org/fhir/sid/ndc",
    };

    return systemNormalization[system] || systemNormalization[system.toUpperCase()] || system;
  }

  getSystemDisplayName(system: string): string {
    const displayNames: Record<string, string> = {
      "http://snomed.info/sct": "SNOMED CT",
      "http://loinc.org": "LOINC",
      "http://hl7.org/fhir/sid/icd-10": "ICD-10",
      "http://hl7.org/fhir/sid/icd-10-cm": "ICD-10-CM",
      "http://www.nlm.nih.gov/research/umls/rxnorm": "RxNorm",
      "http://hl7.org/fhir/sid/cvx": "CVX",
      "http://hl7.org/fhir/sid/ndc": "NDC",
    };

    return displayNames[system] || system;
  }

  async seedCommonMappings(): Promise<number> {
    let count = 0;

    for (const [snomedCode, mapping] of Object.entries(COMMON_SNOMED_MAPPINGS)) {
      if (mapping.loinc) {
        try {
          await this.addMapping({
            sourceSystem: "http://snomed.info/sct",
            sourceCode: snomedCode,
            sourceDisplay: mapping.display,
            targetSystem: "http://loinc.org",
            targetCode: mapping.loinc,
            targetDisplay: mapping.display,
            equivalenceType: "equivalent",
            confidence: 95,
            mappingSource: "builtin-seed",
            isVerified: true,
          });
          count++;
        } catch {
        }
      }

      if (mapping.icd10) {
        try {
          await this.addMapping({
            sourceSystem: "http://snomed.info/sct",
            sourceCode: snomedCode,
            sourceDisplay: mapping.display,
            targetSystem: "http://hl7.org/fhir/sid/icd-10-cm",
            targetCode: mapping.icd10,
            targetDisplay: mapping.display,
            equivalenceType: "equivalent",
            confidence: 90,
            mappingSource: "builtin-seed",
            isVerified: true,
          });
          count++;
        } catch {
        }
      }
    }

    for (const [icd10Code, mapping] of Object.entries(ICD10_TO_SNOMED)) {
      try {
        await this.addMapping({
          sourceSystem: "http://hl7.org/fhir/sid/icd-10-cm",
          sourceCode: icd10Code,
          sourceDisplay: mapping.display,
          targetSystem: "http://snomed.info/sct",
          targetCode: mapping.snomed,
          targetDisplay: mapping.display,
          equivalenceType: "equivalent",
          confidence: 85,
          mappingSource: "builtin-seed",
          isVerified: true,
        });
        count++;
      } catch {
      }
    }

    return count;
  }

  async validateCode(
    system: string,
    code: string,
    valueSetUrl?: string
  ): Promise<{
    valid: boolean;
    display?: string;
    message?: string;
  }> {
    if (valueSetUrl) {
      const [valueSet] = await db
        .select()
        .from(fhirValueSets)
        .where(eq(fhirValueSets.url, valueSetUrl))
        .limit(1);

      if (valueSet) {
        const expansion = (valueSet.expansion as any) || {};
        const contains = expansion.contains || [];
        const found = contains.find((c: any) => c.system === system && c.code === code);
        
        if (found) {
          return { valid: true, display: found.display };
        }

        const include = expansion.include || [];
        for (const inc of include) {
          if (inc.system === system) {
            if (!inc.concept || inc.concept.find((c: any) => c.code === code)) {
              return { valid: true, message: "Code allowed by include" };
            }
          }
        }

        return { valid: false, message: `Code ${code} not found in value set ${valueSetUrl}` };
      }
    }

    const dbMappings = await db
      .select()
      .from(terminologyMappings)
      .where(and(
        eq(terminologyMappings.sourceSystem, system),
        eq(terminologyMappings.sourceCode, code)
      ))
      .limit(1);

    if (dbMappings.length > 0) {
      return { valid: true, display: dbMappings[0].sourceDisplay || undefined };
    }

    if (system === "http://snomed.info/sct" && COMMON_SNOMED_MAPPINGS[code]) {
      return { valid: true, display: COMMON_SNOMED_MAPPINGS[code].display };
    }

    return { valid: true, message: "Code not found in local registry but may still be valid" };
  }

  async getValueSet(url: string): Promise<{
    url: string;
    name: string;
    codeSystem: string;
    version?: string;
    isActive: boolean;
    concepts: Array<{ system: string; code: string; display?: string }>;
  } | null> {
    const [valueSet] = await db
      .select()
      .from(fhirValueSets)
      .where(eq(fhirValueSets.url, url))
      .limit(1);

    if (!valueSet) return null;

    const concepts: Array<{ system: string; code: string; display?: string }> = [];
    
    const expansion = (valueSet.expansion as any) || {};
    const contains = expansion.contains || [];
    for (const concept of contains) {
      concepts.push({
        system: concept.system || valueSet.codeSystem,
        code: concept.code,
        display: concept.display,
      });
    }

    const include = expansion.include || [];
    if (concepts.length === 0) {
      for (const inc of include) {
        if (inc.concept) {
          for (const concept of inc.concept) {
            concepts.push({
              system: inc.system || valueSet.codeSystem,
              code: concept.code,
              display: concept.display,
            });
          }
        }
      }
    }

    return {
      url: valueSet.url,
      name: valueSet.name,
      codeSystem: valueSet.codeSystem,
      version: valueSet.version || undefined,
      isActive: valueSet.isActive ?? true,
      concepts,
    };
  }

  async listValueSets(limit: number = 50): Promise<Array<{
    url: string;
    name: string;
    codeSystem: string;
    version?: string;
    isActive: boolean;
    conceptCount: number;
  }>> {
    const valueSets = await db
      .select()
      .from(fhirValueSets)
      .limit(limit);

    return valueSets.map(vs => {
      const expansion = (vs.expansion as any) || {};
      const contains = expansion.contains || [];
      const include = expansion.include || [];
      let conceptCount = vs.conceptCount || contains.length;
      
      if (conceptCount === 0) {
        for (const inc of include) {
          conceptCount += (inc.concept?.length || 0);
        }
      }

      return {
        url: vs.url,
        name: vs.name,
        codeSystem: vs.codeSystem,
        version: vs.version || undefined,
        isActive: vs.isActive ?? true,
        conceptCount,
      };
    });
  }

  async expandValueSet(
    url: string,
    filter?: string,
    limit: number = 100
  ): Promise<Array<{ system: string; code: string; display?: string }>> {
    const valueSet = await this.getValueSet(url);
    if (!valueSet) return [];

    let concepts = valueSet.concepts;

    if (filter) {
      const lowerFilter = filter.toLowerCase();
      concepts = concepts.filter(c => 
        c.code.toLowerCase().includes(lowerFilter) ||
        c.display?.toLowerCase().includes(lowerFilter)
      );
    }

    return concepts.slice(0, limit);
  }

  getCodeSystemInfo(system: string): {
    name: string;
    version?: string;
    description: string;
    url: string;
  } | null {
    const codeSystems: Record<string, { name: string; description: string }> = {
      "http://snomed.info/sct": {
        name: "SNOMED CT",
        description: "Systematized Nomenclature of Medicine Clinical Terms",
      },
      "http://loinc.org": {
        name: "LOINC",
        description: "Logical Observation Identifiers Names and Codes",
      },
      "http://hl7.org/fhir/sid/icd-10-cm": {
        name: "ICD-10-CM",
        description: "International Classification of Diseases, 10th Revision, Clinical Modification",
      },
      "http://hl7.org/fhir/sid/icd-10": {
        name: "ICD-10",
        description: "International Classification of Diseases, 10th Revision",
      },
      "http://www.nlm.nih.gov/research/umls/rxnorm": {
        name: "RxNorm",
        description: "RxNorm - Normalized drug names and identifiers",
      },
      "http://www.ama-assn.org/go/cpt": {
        name: "CPT",
        description: "Current Procedural Terminology",
      },
      "http://hl7.org/fhir/sid/cvx": {
        name: "CVX",
        description: "CDC Vaccine Administered codes",
      },
      "http://hl7.org/fhir/sid/ndc": {
        name: "NDC",
        description: "National Drug Code",
      },
    };

    const info = codeSystems[system];
    if (!info) return null;

    return { ...info, url: system };
  }

  listSupportedCodeSystems(): Array<{
    url: string;
    name: string;
    description: string;
  }> {
    return [
      { url: "http://snomed.info/sct", name: "SNOMED CT", description: "Clinical terminology" },
      { url: "http://loinc.org", name: "LOINC", description: "Lab and clinical observations" },
      { url: "http://hl7.org/fhir/sid/icd-10-cm", name: "ICD-10-CM", description: "US diagnosis codes" },
      { url: "http://hl7.org/fhir/sid/icd-10", name: "ICD-10", description: "International diagnosis codes" },
      { url: "http://www.nlm.nih.gov/research/umls/rxnorm", name: "RxNorm", description: "Drug terminology" },
      { url: "http://www.ama-assn.org/go/cpt", name: "CPT", description: "Procedure codes" },
      { url: "http://hl7.org/fhir/sid/cvx", name: "CVX", description: "Vaccine codes" },
      { url: "http://hl7.org/fhir/sid/ndc", name: "NDC", description: "Drug product codes" },
    ];
  }
}

export const terminologyService = new TerminologyService();
