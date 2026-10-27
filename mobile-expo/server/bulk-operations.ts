import { storage } from "./storage";
import { mapFhirToHealthRecord } from "./fhir-client";
import type { InsertHealthRecord, InsertBulkImportJob, BulkImportJob } from "@shared/schema";

interface NdjsonResource {
  resourceType: string;
  id?: string;
  [key: string]: any;
}

interface FhirBundle {
  resourceType: "Bundle";
  type: string;
  entry?: Array<{
    resource: any;
    fullUrl?: string;
  }>;
}

interface ImportResult {
  success: boolean;
  totalResources: number;
  processedResources: number;
  failedResources: number;
  errors: Array<{ index: number; error: string }>;
}

interface ExportOptions {
  format: "ndjson" | "fhir_bundle";
  resourceTypes?: string[];
  startDate?: Date;
  endDate?: Date;
}

export class BulkOperations {
  async importNdjson(
    userId: string,
    sourceId: string,
    ndjsonContent: string
  ): Promise<ImportResult> {
    const job = await storage.createBulkImportJob({
      userId,
      format: "ndjson",
      status: "processing",
      startedAt: new Date(),
    });

    const lines = ndjsonContent.split("\n").filter(line => line.trim());
    const errors: Array<{ index: number; error: string }> = [];
    let processedCount = 0;
    let failedCount = 0;

    await storage.updateBulkImportJob(job.id, {
      totalResources: lines.length,
    });

    for (let i = 0; i < lines.length; i++) {
      try {
        const resource: NdjsonResource = JSON.parse(lines[i]);
        
        if (!resource.resourceType) {
          throw new Error("Missing resourceType");
        }

        const record = mapFhirToHealthRecord(resource, userId, sourceId);
        
        if (record) {
          const existing = await this.findExistingRecord(userId, resource);
          
          if (existing) {
            await this.createVersion(existing.id, resource, "update");
            await storage.updateHealthRecord(existing.id, {
              ...record,
              lastSyncedAt: new Date(),
            });
          } else {
            const created = await storage.createHealthRecord(record);
            await this.createVersion(created.id, resource, "create");
          }
          
          processedCount++;
        } else {
          failedCount++;
          errors.push({ index: i, error: `Unsupported resource type: ${resource.resourceType}` });
        }
      } catch (error) {
        failedCount++;
        errors.push({ index: i, error: error instanceof Error ? error.message : "Unknown error" });
      }

      if ((i + 1) % 100 === 0) {
        await storage.updateBulkImportJob(job.id, {
          processedResources: processedCount,
          failedResources: failedCount,
        });
      }
    }

    await storage.updateBulkImportJob(job.id, {
      status: failedCount === lines.length ? "failed" : "completed",
      processedResources: processedCount,
      failedResources: failedCount,
      errors,
      completedAt: new Date(),
    });

    return {
      success: failedCount < lines.length,
      totalResources: lines.length,
      processedResources: processedCount,
      failedResources: failedCount,
      errors,
    };
  }

  async importFhirBundle(
    userId: string,
    sourceId: string,
    bundle: FhirBundle
  ): Promise<ImportResult> {
    const job = await storage.createBulkImportJob({
      userId,
      format: "fhir_bundle",
      status: "processing",
      startedAt: new Date(),
    });

    const entries = bundle.entry || [];
    const errors: Array<{ index: number; error: string }> = [];
    let processedCount = 0;
    let failedCount = 0;

    await storage.updateBulkImportJob(job.id, {
      totalResources: entries.length,
    });

    for (let i = 0; i < entries.length; i++) {
      try {
        const resource = entries[i].resource;
        
        if (!resource || !resource.resourceType) {
          throw new Error("Invalid entry: missing resource or resourceType");
        }

        const record = mapFhirToHealthRecord(resource, userId, sourceId);
        
        if (record) {
          const existing = await this.findExistingRecord(userId, resource);
          
          if (existing) {
            await this.createVersion(existing.id, resource, "update");
            await storage.updateHealthRecord(existing.id, {
              ...record,
              lastSyncedAt: new Date(),
            });
          } else {
            const created = await storage.createHealthRecord(record);
            await this.createVersion(created.id, resource, "create");
          }
          
          processedCount++;
        } else {
          failedCount++;
          errors.push({ index: i, error: `Unsupported resource type: ${resource.resourceType}` });
        }
      } catch (error) {
        failedCount++;
        errors.push({ index: i, error: error instanceof Error ? error.message : "Unknown error" });
      }
    }

    await storage.updateBulkImportJob(job.id, {
      status: failedCount === entries.length ? "failed" : "completed",
      processedResources: processedCount,
      failedResources: failedCount,
      errors,
      completedAt: new Date(),
    });

    return {
      success: failedCount < entries.length,
      totalResources: entries.length,
      processedResources: processedCount,
      failedResources: failedCount,
      errors,
    };
  }

  async exportToNdjson(userId: string, options?: Partial<ExportOptions>): Promise<string> {
    const { records } = await storage.searchHealthRecords(userId, {
      fhirResourceTypes: options?.resourceTypes,
      startDate: options?.startDate,
      endDate: options?.endDate,
      limit: 10000,
    });

    const lines: string[] = [];
    
    for (const record of records) {
      if (record.rawFhirJson) {
        lines.push(JSON.stringify(record.rawFhirJson));
      } else {
        const fhirResource = this.recordToFhir(record);
        lines.push(JSON.stringify(fhirResource));
      }
    }

    return lines.join("\n");
  }

  async exportToBundle(userId: string, options?: Partial<ExportOptions>): Promise<FhirBundle> {
    const { records } = await storage.searchHealthRecords(userId, {
      fhirResourceTypes: options?.resourceTypes,
      startDate: options?.startDate,
      endDate: options?.endDate,
      limit: 10000,
    });

    const entries = records.map((record: any) => {
      const resource = record.rawFhirJson || this.recordToFhir(record);
      return {
        fullUrl: `urn:uuid:${record.id}`,
        resource,
      };
    });

    return {
      resourceType: "Bundle",
      type: "collection",
      entry: entries,
    };
  }

  private async findExistingRecord(userId: string, resource: any): Promise<any | null> {
    if (!resource.id) return null;
    
    const records = await storage.getHealthRecords(userId);
    return records.find(r => 
      r.fhirResourceId === resource.id && 
      r.fhirResourceType === resource.resourceType
    ) || null;
  }

  private async createVersion(recordId: string, rawData: any, changeType: string): Promise<void> {
    const existingVersions = await storage.getResourceVersions(recordId);
    const versionNumber = existingVersions.length + 1;
    
    await storage.createResourceVersion({
      recordId,
      versionNumber,
      fhirVersion: this.detectFhirVersion(rawData),
      rawData,
      changeType,
      changedBy: "bulk_import",
    });
  }

  private detectFhirVersion(resource: any): string {
    if (resource.meta?.profile) {
      for (const profile of resource.meta.profile) {
        if (profile.includes("/4.0")) return "R4";
        if (profile.includes("/3.0")) return "STU3";
      }
    }
    return "R4";
  }

  private recordToFhir(record: any): any {
    const base = {
      resourceType: record.fhirResourceType || this.inferResourceType(record.type),
      id: record.fhirResourceId || record.id,
      meta: {
        lastUpdated: record.updatedAt?.toISOString() || new Date().toISOString(),
      },
    };

    switch (record.type) {
      case "medication":
        return {
          ...base,
          resourceType: "MedicationRequest",
          status: "active",
          intent: "order",
          medicationCodeableConcept: {
            text: record.title,
          },
          authoredOn: record.date?.toISOString(),
          dosageInstruction: record.summary ? [{ text: record.summary }] : undefined,
        };
      
      case "condition":
        return {
          ...base,
          resourceType: "Condition",
          code: { text: record.title },
          clinicalStatus: {
            coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }],
          },
          onsetDateTime: record.date?.toISOString(),
        };
      
      case "lab":
      case "vital":
        return {
          ...base,
          resourceType: "Observation",
          status: "final",
          code: { text: record.title },
          effectiveDateTime: record.date?.toISOString(),
          valueString: record.summary,
        };
      
      default:
        return {
          ...base,
          resourceType: "Basic",
          code: { text: record.type },
          subject: { display: record.title },
          created: record.date?.toISOString(),
        };
    }
  }

  private inferResourceType(type: string): string {
    const mapping: Record<string, string> = {
      medication: "MedicationRequest",
      condition: "Condition",
      lab: "Observation",
      vital: "Observation",
      allergy: "AllergyIntolerance",
      immunization: "Immunization",
      procedure: "Procedure",
      visit: "Encounter",
      imaging: "DiagnosticReport",
    };
    return mapping[type] || "Basic";
  }

  async getImportJobs(userId: string): Promise<BulkImportJob[]> {
    return storage.getBulkImportJobs(userId);
  }

  async validateFhirResource(resource: any): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!resource.resourceType) {
      errors.push("Missing required field: resourceType");
    }

    if (resource.resourceType && !this.isValidResourceType(resource.resourceType)) {
      errors.push(`Unknown resource type: ${resource.resourceType}`);
    }

    if (resource.id && typeof resource.id !== "string") {
      errors.push("Invalid id: must be a string");
    }

    if (resource.meta) {
      if (resource.meta.lastUpdated && isNaN(Date.parse(resource.meta.lastUpdated))) {
        errors.push("Invalid meta.lastUpdated: must be a valid datetime");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private isValidResourceType(type: string): boolean {
    const validTypes = [
      "Patient", "Observation", "Condition", "MedicationRequest", "MedicationStatement",
      "Immunization", "Encounter", "Procedure", "AllergyIntolerance", "DiagnosticReport",
      "DocumentReference", "CarePlan", "CareTeam", "Goal", "Practitioner", "Organization",
    ];
    return validTypes.includes(type);
  }
}

export const bulkOperations = new BulkOperations();
