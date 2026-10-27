import { storage } from "./storage";
import type { HealthRecord, InsertHarmonizedPatient, InsertDataConflict } from "@shared/schema";

interface PatientDemographics {
  name?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  phone?: string;
  email?: string;
  mrn?: string;
  ssn?: string;
}

interface MatchResult {
  isMatch: boolean;
  confidence: number;
  method: "deterministic" | "probabilistic" | "hybrid";
  matchedFields: string[];
}

interface HarmonizedRecord {
  canonicalId: string;
  matchConfidence: number;
  matchMethod: string;
  linkedRecordIds: string[];
  linkedSourceIds: string[];
  demographics: PatientDemographics;
  inferredInsights: InferredInsights;
}

interface InferredInsights {
  conditionSummary: string[];
  medicationCount: number;
  activeConditions: string[];
  allergies: string[];
  lastVisitDate?: string;
  primaryProvider?: string;
  riskFactors: string[];
}

interface ConflictInfo {
  recordIds: string[];
  field: string;
  values: any[];
  conflictType: string;
}

const FHIR_VERSION_MAP: Record<string, string> = {
  "4.0.1": "R4",
  "4.0.0": "R4",
  "3.0.2": "STU3",
  "3.0.1": "STU3",
  "1.0.2": "DSTU2",
};

export class HarmonizationEngine {
  private readonly MATCH_THRESHOLDS = {
    deterministic: 100,
    high: 90,
    medium: 70,
    low: 50,
  };

  async harmonizePatientRecords(userId: string): Promise<HarmonizedRecord> {
    const records = await storage.getHealthRecords(userId);
    const sources = await storage.getDataSources(userId);
    
    const linkedRecordIds = records.map(r => r.id);
    const linkedSourceIds = sources.map(s => s.id);
    
    const demographics = await this.extractDemographics(records);
    const conflicts = await this.detectConflicts(userId, records);
    
    for (const conflict of conflicts) {
      await storage.createDataConflict({
        userId,
        recordIds: conflict.recordIds,
        conflictType: conflict.conflictType,
        field: conflict.field,
        values: conflict.values,
      });
    }
    
    const inferredInsights = await this.generateInsights(records);
    
    const canonicalId = this.generateCanonicalId(userId, demographics);
    
    const existingPatient = await storage.getHarmonizedPatient(userId);
    
    const harmonizedData: InsertHarmonizedPatient = {
      userId,
      canonicalId,
      matchConfidence: 100,
      matchMethod: "hybrid",
      linkedRecordIds,
      linkedSourceIds,
      demographics,
      inferredInsights,
    };
    
    if (existingPatient) {
      await storage.updateHarmonizedPatient(existingPatient.id, harmonizedData);
    } else {
      await storage.createHarmonizedPatient(harmonizedData);
    }
    
    return {
      canonicalId,
      matchConfidence: 100,
      matchMethod: "hybrid",
      linkedRecordIds,
      linkedSourceIds,
      demographics,
      inferredInsights,
    };
  }

  private generateCanonicalId(userId: string, demographics: PatientDemographics): string {
    const components = [
      userId,
      demographics.name?.toLowerCase().replace(/\s+/g, "_") || "unknown",
      demographics.dateOfBirth || "unknown_dob",
    ];
    return components.join("::");
  }

  private async extractDemographics(records: HealthRecord[]): Promise<PatientDemographics> {
    const demographics: PatientDemographics = {};
    
    for (const record of records) {
      const fhirData = record.rawFhirJson as any;
      if (!fhirData) continue;
      
      if (fhirData.resourceType === "Patient") {
        if (fhirData.name?.[0]) {
          const name = fhirData.name[0];
          demographics.name = [name.given?.join(" "), name.family].filter(Boolean).join(" ");
        }
        if (fhirData.birthDate) {
          demographics.dateOfBirth = fhirData.birthDate;
        }
        if (fhirData.gender) {
          demographics.gender = fhirData.gender;
        }
        if (fhirData.address?.[0]) {
          const addr = fhirData.address[0];
          demographics.address = [addr.line?.join(", "), addr.city, addr.state, addr.postalCode]
            .filter(Boolean).join(", ");
        }
        if (fhirData.telecom) {
          for (const telecom of fhirData.telecom) {
            if (telecom.system === "phone") demographics.phone = telecom.value;
            if (telecom.system === "email") demographics.email = telecom.value;
          }
        }
        if (fhirData.identifier) {
          for (const id of fhirData.identifier) {
            if (id.type?.coding?.[0]?.code === "MR") demographics.mrn = id.value;
            if (id.type?.coding?.[0]?.code === "SS") demographics.ssn = id.value;
          }
        }
      }
    }
    
    return demographics;
  }

  private async detectConflicts(userId: string, records: HealthRecord[]): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];
    
    const recordsByType = new Map<string, HealthRecord[]>();
    for (const record of records) {
      const key = `${record.type}:${record.title?.toLowerCase()}`;
      if (!recordsByType.has(key)) {
        recordsByType.set(key, []);
      }
      recordsByType.get(key)!.push(record);
    }
    
    for (const [key, similarRecords] of recordsByType) {
      if (similarRecords.length < 2) continue;
      
      const summaries = similarRecords.map(r => r.summary).filter(Boolean);
      const uniqueSummaries = [...new Set(summaries)];
      
      if (uniqueSummaries.length > 1) {
        conflicts.push({
          recordIds: similarRecords.map(r => r.id),
          field: "summary",
          values: uniqueSummaries,
          conflictType: "value_mismatch",
        });
      }
      
      const providers = similarRecords.map(r => r.provider).filter(Boolean);
      const uniqueProviders = [...new Set(providers)];
      
      if (uniqueProviders.length > 1) {
        conflicts.push({
          recordIds: similarRecords.map(r => r.id),
          field: "provider",
          values: uniqueProviders,
          conflictType: "value_mismatch",
        });
      }
    }
    
    return conflicts;
  }

  private async generateInsights(records: HealthRecord[]): Promise<InferredInsights> {
    const conditions = records.filter(r => r.type === "condition");
    const medications = records.filter(r => r.type === "medication");
    const allergies = records.filter(r => r.type === "allergy");
    const visits = records.filter(r => r.type === "visit");
    
    const activeConditions = conditions
      .filter(c => {
        const details = c.details as any;
        return details?.clinicalStatus === "active" || !details?.clinicalStatus;
      })
      .map(c => c.title);
    
    const riskFactors: string[] = [];
    
    const hasHighBP = records.some(r => {
      if (r.type !== "vital") return false;
      const details = r.details as any;
      return details?.value && details.value > 140 && r.title.toLowerCase().includes("blood pressure");
    });
    if (hasHighBP) riskFactors.push("Elevated blood pressure");
    
    const hasHighGlucose = records.some(r => {
      if (r.type !== "lab") return false;
      const details = r.details as any;
      return details?.value && details.value > 126 && r.title.toLowerCase().includes("glucose");
    });
    if (hasHighGlucose) riskFactors.push("Elevated glucose levels");
    
    const hasDiabetes = activeConditions.some(c => 
      c.toLowerCase().includes("diabetes") || c.toLowerCase().includes("diabetic")
    );
    if (hasDiabetes) riskFactors.push("Diabetes");
    
    const sortedVisits = visits.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    return {
      conditionSummary: activeConditions.slice(0, 5),
      medicationCount: medications.length,
      activeConditions: activeConditions.slice(0, 10),
      allergies: allergies.map(a => a.title),
      lastVisitDate: sortedVisits[0]?.date.toISOString(),
      primaryProvider: this.findPrimaryProvider(records),
      riskFactors,
    };
  }

  private findPrimaryProvider(records: HealthRecord[]): string | undefined {
    const providerCounts = new Map<string, number>();
    
    for (const record of records) {
      if (record.provider) {
        const count = providerCounts.get(record.provider) || 0;
        providerCounts.set(record.provider, count + 1);
      }
    }
    
    let maxCount = 0;
    let primaryProvider: string | undefined;
    
    for (const [provider, count] of providerCounts) {
      if (count > maxCount) {
        maxCount = count;
        primaryProvider = provider;
      }
    }
    
    return primaryProvider;
  }

  matchPatientRecords(record1: HealthRecord, record2: HealthRecord): MatchResult {
    const matchedFields: string[] = [];
    let totalScore = 0;
    let maxScore = 0;
    
    if (record1.fhirResourceId && record2.fhirResourceId) {
      maxScore += 100;
      if (record1.fhirResourceId === record2.fhirResourceId) {
        totalScore += 100;
        matchedFields.push("fhirResourceId");
        return { isMatch: true, confidence: 100, method: "deterministic", matchedFields };
      }
    }
    
    if (record1.title && record2.title) {
      maxScore += 30;
      if (record1.title.toLowerCase() === record2.title.toLowerCase()) {
        totalScore += 30;
        matchedFields.push("title");
      } else if (this.fuzzyMatch(record1.title, record2.title) > 0.8) {
        totalScore += 20;
        matchedFields.push("title_fuzzy");
      }
    }
    
    if (record1.date && record2.date) {
      maxScore += 25;
      const date1 = new Date(record1.date).toDateString();
      const date2 = new Date(record2.date).toDateString();
      if (date1 === date2) {
        totalScore += 25;
        matchedFields.push("date");
      }
    }
    
    if (record1.provider && record2.provider) {
      maxScore += 20;
      if (record1.provider.toLowerCase() === record2.provider.toLowerCase()) {
        totalScore += 20;
        matchedFields.push("provider");
      } else if (this.fuzzyMatch(record1.provider, record2.provider) > 0.7) {
        totalScore += 10;
        matchedFields.push("provider_fuzzy");
      }
    }
    
    if (record1.type && record2.type) {
      maxScore += 25;
      if (record1.type === record2.type) {
        totalScore += 25;
        matchedFields.push("type");
      }
    }
    
    const confidence = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    
    return {
      isMatch: confidence >= this.MATCH_THRESHOLDS.medium,
      confidence,
      method: matchedFields.includes("fhirResourceId") ? "deterministic" : "probabilistic",
      matchedFields,
    };
  }

  private fuzzyMatch(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1;
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;
    
    const set1 = new Set(s1.split(/\s+/));
    const set2 = new Set(s2.split(/\s+/));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  harmonizeFhirVersion(resource: any, targetVersion: string = "R4"): any {
    const sourceVersion = this.detectFhirVersion(resource);
    
    if (sourceVersion === targetVersion) {
      return resource;
    }
    
    const harmonized = { ...resource };
    
    if (sourceVersion === "STU3" && targetVersion === "R4") {
      harmonized.meta = {
        ...harmonized.meta,
        versionId: harmonized.meta?.versionId || "1",
        source: harmonized.meta?.source || "harmonization-engine",
      };
      
      if (harmonized.resourceType === "MedicationStatement") {
        if (harmonized.taken) {
          harmonized.status = harmonized.taken === "y" ? "active" : 
                             harmonized.taken === "n" ? "not-taken" : harmonized.status;
          delete harmonized.taken;
        }
      }
      
      if (harmonized.resourceType === "Observation") {
        if (harmonized.component) {
          harmonized.component = harmonized.component.map((c: any) => ({
            ...c,
            valueQuantity: c.valueQuantity || c.value,
          }));
        }
      }
    }
    
    harmonized._harmonizedAt = new Date().toISOString();
    harmonized._originalVersion = sourceVersion;
    harmonized._targetVersion = targetVersion;
    
    return harmonized;
  }

  private detectFhirVersion(resource: any): string {
    if (resource.meta?.profile) {
      for (const profile of resource.meta.profile) {
        if (profile.includes("/4.0")) return "R4";
        if (profile.includes("/3.0")) return "STU3";
        if (profile.includes("/1.0")) return "DSTU2";
      }
    }
    
    if (resource.taken !== undefined) return "STU3";
    if (resource.intent !== undefined && resource.resourceType === "MedicationRequest") return "R4";
    
    return "R4";
  }

  async resolveConflict(
    conflictId: string,
    resolution: "latest" | "earliest" | "most_complete" | "manual",
    manualValue?: any,
    resolvedBy: string = "system"
  ): Promise<any> {
    const conflicts = await storage.getDataConflicts("", false);
    const conflict = conflicts.find((c: any) => c.id === conflictId);
    
    if (!conflict) {
      throw new Error("Conflict not found");
    }
    
    let resolvedValue: any;
    
    const values = conflict.values as any[];
    
    switch (resolution) {
      case "latest":
        resolvedValue = values[values.length - 1];
        break;
      case "earliest":
        resolvedValue = values[0];
        break;
      case "most_complete":
        resolvedValue = this.selectMostComplete(values);
        break;
      case "manual":
        resolvedValue = manualValue;
        break;
    }
    
    await storage.resolveDataConflict(conflictId, resolution, resolvedValue, resolvedBy);
    
    return resolvedValue;
  }

  private selectMostComplete(values: any[]): any {
    return values.reduce((best, current) => {
      const bestLength = JSON.stringify(best).length;
      const currentLength = JSON.stringify(current).length;
      return currentLength > bestLength ? current : best;
    });
  }
}

export const harmonizationEngine = new HarmonizationEngine();
