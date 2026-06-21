import { randomBytes } from "crypto";

export interface FHIRProviderConfig {
  id: string;
  name: string;
  fhirBaseUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  scopes: string[];
}

export interface ImportedResource {
  id: string;
  userId: string;
  connectionId: string;
  resourceType: string;
  fhirId: string;
  data: Record<string, unknown>;
  provenance: {
    source: string;
    importedAt: string;
    sourcePatientId: string;
    sourceVersion?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportResult {
  resourceType: string;
  imported: number;
  errors: number;
  items: Array<{
    fhirId: string;
    display: string;
  }>;
}

export interface FHIRImportOptions {
  accessToken: string;
  fhirBaseUrl: string;
  patientId?: string;
  providerName: string;
  resourceTypes?: string[];
}

const DEFAULT_RESOURCE_TYPES = [
  "Patient",
  "Observation",
  "MedicationRequest",
  "Condition",
  "Encounter",
  "Immunization",
];

export class FHIRImportService {
  private importedResources: Map<string, ImportedResource> = new Map();

  async importResources(
    userId: string,
    connectionId: string,
    options: FHIRImportOptions
  ): Promise<{
    success: boolean;
    results: Record<string, ImportResult>;
    totalImported: number;
    importedAt: string;
  }> {
    const resourceTypes = options.resourceTypes || DEFAULT_RESOURCE_TYPES;
    const results: Record<string, ImportResult> = {};
    let totalImported = 0;

    for (const resourceType of resourceTypes) {
      const result = await this.importResourceType(
        userId,
        connectionId,
        resourceType,
        options
      );
      results[resourceType] = result;
      totalImported += result.imported;
    }

    return {
      success: true,
      results,
      totalImported,
      importedAt: new Date().toISOString(),
    };
  }

  private async importResourceType(
    userId: string,
    connectionId: string,
    resourceType: string,
    options: FHIRImportOptions
  ): Promise<ImportResult> {
    const result: ImportResult = {
      resourceType,
      imported: 0,
      errors: 0,
      items: [],
    };

    try {
      let url = `${options.fhirBaseUrl}/${resourceType}`;
      if (resourceType !== "Patient" && options.patientId) {
        url += `?patient=${options.patientId}`;
      } else if (resourceType === "Patient" && options.patientId) {
        url = `${options.fhirBaseUrl}/Patient/${options.patientId}`;
      }

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${options.accessToken}`,
          Accept: "application/fhir+json",
        },
      });

      if (!response.ok) {
        result.errors++;
        return result;
      }

      const data = await response.json();
      const entries =
        resourceType === "Patient" && !data.entry
          ? [{ resource: data }]
          : data.entry || [];

      for (const entry of entries) {
        const resource = entry.resource;
        if (!resource || resource.resourceType !== resourceType) continue;

        const resourceId = `res-${randomBytes(8).toString("hex")}`;
        const display = this.extractDisplayName(resourceType, resource);

        const importedResource: ImportedResource = {
          id: resourceId,
          userId,
          connectionId,
          resourceType,
          fhirId: resource.id,
          data: resource,
          provenance: {
            source: options.providerName,
            importedAt: new Date().toISOString(),
            sourcePatientId: options.patientId || "unknown",
            sourceVersion: resource.meta?.versionId,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        this.importedResources.set(resourceId, importedResource);
        result.items.push({ fhirId: resource.id, display });
        result.imported++;
      }
    } catch (error) {
      result.errors++;
    }

    return result;
  }

  private extractDisplayName(
    resourceType: string,
    resource: Record<string, unknown>
  ): string {
    switch (resourceType) {
      case "Patient": {
        const names = resource.name as Array<{
          given?: string[];
          family?: string;
        }>;
        const name = names?.[0];
        return name
          ? `${name.given?.[0] || ""} ${name.family || ""}`.trim()
          : String(resource.id);
      }
      case "Condition": {
        const code = resource.code as {
          coding?: Array<{ display?: string }>;
          text?: string;
        };
        return code?.coding?.[0]?.display || code?.text || String(resource.id);
      }
      case "MedicationRequest": {
        const med = resource.medicationCodeableConcept as {
          coding?: Array<{ display?: string }>;
          text?: string;
        };
        return med?.coding?.[0]?.display || med?.text || String(resource.id);
      }
      case "Observation": {
        const obsCode = resource.code as {
          coding?: Array<{ display?: string }>;
          text?: string;
        };
        return (
          obsCode?.coding?.[0]?.display || obsCode?.text || String(resource.id)
        );
      }
      case "Encounter": {
        const type = resource.type as Array<{
          coding?: Array<{ display?: string }>;
        }>;
        const encClass = resource.class as { display?: string };
        return (
          type?.[0]?.coding?.[0]?.display ||
          encClass?.display ||
          String(resource.id)
        );
      }
      case "Immunization": {
        const vaccine = resource.vaccineCode as {
          coding?: Array<{ display?: string }>;
          text?: string;
        };
        return (
          vaccine?.coding?.[0]?.display || vaccine?.text || String(resource.id)
        );
      }
      default:
        return String(resource.id);
    }
  }

  getResourcesByUser(
    userId: string,
    filters?: { resourceType?: string; connectionId?: string }
  ): ImportedResource[] {
    let resources = Array.from(this.importedResources.values()).filter(
      (r) => r.userId === userId
    );

    if (filters?.resourceType) {
      resources = resources.filter(
        (r) => r.resourceType === filters.resourceType
      );
    }

    if (filters?.connectionId) {
      resources = resources.filter(
        (r) => r.connectionId === filters.connectionId
      );
    }

    return resources;
  }

  getResourceById(resourceId: string): ImportedResource | undefined {
    return this.importedResources.get(resourceId);
  }

  deleteResourcesByConnection(connectionId: string): number {
    let deleted = 0;
    const entries = Array.from(this.importedResources.entries());
    for (const [id, resource] of entries) {
      if (resource.connectionId === connectionId) {
        this.importedResources.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  getResourceCount(userId: string): Record<string, number> {
    const counts: Record<string, number> = {};
    const resources = Array.from(this.importedResources.values());
    for (const resource of resources) {
      if (resource.userId === userId) {
        counts[resource.resourceType] =
          (counts[resource.resourceType] || 0) + 1;
      }
    }
    return counts;
  }
}

export const fhirImportService = new FHIRImportService();
