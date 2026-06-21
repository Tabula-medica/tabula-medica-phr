import { randomUUID } from "crypto";

export type SortOrder = "asc" | "desc";
export type FilterOperator = 
  | "eq" | "ne" | "gt" | "lt" | "ge" | "le" 
  | "contains" | "starts_with" | "ends_with" 
  | "in" | "not_in" | "between" | "is_null" | "is_not_null";

export interface SearchFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
  valueEnd?: unknown;
}

export interface SearchSort {
  field: string;
  order: SortOrder;
}

export interface SearchQuery {
  resourceTypes: string[];
  filters: SearchFilter[];
  sort: SearchSort[];
  page: number;
  pageSize: number;
  includeTotal: boolean;
  includeReferences?: boolean;
  fullTextQuery?: string;
}

export interface SearchResult {
  id: string;
  resourceType: string;
  resourceId: string;
  data: Record<string, unknown>;
  source: string;
  lastUpdated: string;
  highlights?: Record<string, string[]>;
  score?: number;
}

export interface SearchResponse {
  query: SearchQuery;
  results: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  executionTimeMs: number;
  facets?: Record<string, Array<{ value: string; count: number }>>;
}

export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  query: SearchQuery;
  createdBy: string;
  createdAt: string;
  lastUsed?: string;
  useCount: number;
  isPublic: boolean;
}

const SAMPLE_RESOURCES: SearchResult[] = [
  {
    id: randomUUID(),
    resourceType: "Patient",
    resourceId: "patient-001",
    data: {
      name: [{ family: "Doe", given: ["John"] }],
      birthDate: "1985-03-15",
      gender: "male",
      address: [{ city: "Boston", state: "MA", postalCode: "02101" }],
      identifier: [{ system: "MRN", value: "MRN-12345" }],
      telecom: [{ system: "phone", value: "(555) 123-4567" }],
    },
    source: "fastenhealth",
    lastUpdated: "2026-01-15T10:30:00Z",
  },
  {
    id: randomUUID(),
    resourceType: "Patient",
    resourceId: "patient-002",
    data: {
      name: [{ family: "Smith", given: ["Jane", "Marie"] }],
      birthDate: "1990-07-22",
      gender: "female",
      address: [{ city: "Cambridge", state: "MA", postalCode: "02139" }],
      identifier: [{ system: "MRN", value: "MRN-67890" }],
      telecom: [{ system: "email", value: "jane.smith@email.com" }],
    },
    source: "fastenhealth",
    lastUpdated: "2026-01-16T14:45:00Z",
  },
  {
    id: randomUUID(),
    resourceType: "Observation",
    resourceId: "obs-001",
    data: {
      code: { coding: [{ system: "LOINC", code: "8867-4", display: "Heart rate" }] },
      valueQuantity: { value: 72, unit: "beats/minute" },
      effectiveDateTime: "2026-01-17T09:00:00Z",
      status: "final",
      subject: { reference: "Patient/patient-001" },
      category: [{ coding: [{ code: "vital-signs" }] }],
    },
    source: "fastenhealth",
    lastUpdated: "2026-01-17T09:05:00Z",
  },
  {
    id: randomUUID(),
    resourceType: "Observation",
    resourceId: "obs-002",
    data: {
      code: { coding: [{ system: "LOINC", code: "8480-6", display: "Systolic blood pressure" }] },
      valueQuantity: { value: 120, unit: "mmHg" },
      effectiveDateTime: "2026-01-17T09:00:00Z",
      status: "final",
      subject: { reference: "Patient/patient-001" },
      category: [{ coding: [{ code: "vital-signs" }] }],
    },
    source: "fastenhealth",
    lastUpdated: "2026-01-17T09:05:00Z",
  },
  {
    id: randomUUID(),
    resourceType: "Condition",
    resourceId: "cond-001",
    data: {
      code: { coding: [{ system: "ICD-10", code: "I10", display: "Essential hypertension" }] },
      clinicalStatus: { coding: [{ code: "active" }] },
      verificationStatus: { coding: [{ code: "confirmed" }] },
      onsetDateTime: "2020-06-15",
      subject: { reference: "Patient/patient-001" },
      severity: { coding: [{ code: "moderate" }] },
    },
    source: "fastenhealth",
    lastUpdated: "2026-01-10T11:20:00Z",
  },
  {
    id: randomUUID(),
    resourceType: "MedicationRequest",
    resourceId: "med-001",
    data: {
      medicationCodeableConcept: { coding: [{ system: "RxNorm", code: "197361", display: "Lisinopril 10 MG" }] },
      status: "active",
      intent: "order",
      dosageInstruction: [{ text: "Take 1 tablet daily" }],
      subject: { reference: "Patient/patient-001" },
      authoredOn: "2024-06-20",
    },
    source: "provider",
    lastUpdated: "2026-01-05T16:30:00Z",
  },
  {
    id: randomUUID(),
    resourceType: "Encounter",
    resourceId: "enc-001",
    data: {
      class: { code: "AMB", display: "Ambulatory" },
      status: "finished",
      type: [{ coding: [{ display: "Annual wellness visit" }] }],
      period: { start: "2026-01-10T10:00:00Z", end: "2026-01-10T10:45:00Z" },
      subject: { reference: "Patient/patient-001" },
      serviceProvider: { display: "Boston Medical Center" },
    },
    source: "fastenhealth",
    lastUpdated: "2026-01-10T11:00:00Z",
  },
  {
    id: randomUUID(),
    resourceType: "DiagnosticReport",
    resourceId: "diag-001",
    data: {
      code: { coding: [{ system: "LOINC", code: "58410-2", display: "CBC panel" }] },
      status: "final",
      effectiveDateTime: "2026-01-15T08:30:00Z",
      conclusion: "All values within normal limits",
      subject: { reference: "Patient/patient-002" },
      category: [{ coding: [{ code: "LAB" }] }],
    },
    source: "fastenhealth",
    lastUpdated: "2026-01-15T14:00:00Z",
  },
  {
    id: randomUUID(),
    resourceType: "Immunization",
    resourceId: "imm-001",
    data: {
      vaccineCode: { coding: [{ system: "CVX", code: "208", display: "COVID-19 vaccine" }] },
      status: "completed",
      occurrenceDateTime: "2025-09-15",
      patient: { reference: "Patient/patient-001" },
      manufacturer: { display: "Pfizer" },
      lotNumber: "EK9788",
    },
    source: "cms-bluebutton",
    lastUpdated: "2025-09-15T16:00:00Z",
  },
  {
    id: randomUUID(),
    resourceType: "AllergyIntolerance",
    resourceId: "allergy-001",
    data: {
      code: { coding: [{ display: "Penicillin" }] },
      clinicalStatus: { coding: [{ code: "active" }] },
      verificationStatus: { coding: [{ code: "confirmed" }] },
      type: "allergy",
      category: ["medication"],
      criticality: "high",
      patient: { reference: "Patient/patient-001" },
      reaction: [{ manifestation: [{ coding: [{ display: "Anaphylaxis" }] }], severity: "severe" }],
    },
    source: "fastenhealth",
    lastUpdated: "2024-02-10T09:00:00Z",
  },
];

class FhirAdvancedSearchService {
  private resources: SearchResult[] = [...SAMPLE_RESOURCES];
  private savedSearches: Map<string, SavedSearch> = new Map();

  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();

    let results = [...this.resources];

    if (query.resourceTypes.length > 0 && !query.resourceTypes.includes("*")) {
      results = results.filter((r) => query.resourceTypes.includes(r.resourceType));
    }

    if (query.fullTextQuery) {
      const searchTerms = query.fullTextQuery.toLowerCase().split(/\s+/);
      results = results.filter((r) => {
        const jsonStr = JSON.stringify(r.data).toLowerCase();
        return searchTerms.every((term) => jsonStr.includes(term));
      });

      results = results.map((r) => ({
        ...r,
        score: this.calculateRelevanceScore(r, query.fullTextQuery!),
        highlights: this.extractHighlights(r, searchTerms),
      }));
    }

    for (const filter of query.filters) {
      results = results.filter((r) => this.applyFilter(r, filter));
    }

    const total = results.length;

    if (query.sort.length > 0) {
      results.sort((a, b) => {
        for (const sortItem of query.sort) {
          const comparison = this.compareValues(
            this.getNestedValue(a.data, sortItem.field),
            this.getNestedValue(b.data, sortItem.field),
            sortItem.order
          );
          if (comparison !== 0) return comparison;
        }
        return 0;
      });
    } else if (query.fullTextQuery) {
      results.sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    const startIndex = (query.page - 1) * query.pageSize;
    const paginatedResults = results.slice(startIndex, startIndex + query.pageSize);

    const facets = this.calculateFacets(results);

    return {
      query,
      results: paginatedResults,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
      executionTimeMs: Date.now() - startTime,
      facets,
    };
  }

  private applyFilter(resource: SearchResult, filter: SearchFilter): boolean {
    const value = this.getNestedValue(resource.data, filter.field) ?? 
                  this.getNestedValue(resource, filter.field);

    switch (filter.operator) {
      case "eq":
        return value === filter.value;
      case "ne":
        return value !== filter.value;
      case "gt":
        return Number(value) > Number(filter.value);
      case "lt":
        return Number(value) < Number(filter.value);
      case "ge":
        return Number(value) >= Number(filter.value);
      case "le":
        return Number(value) <= Number(filter.value);
      case "contains":
        return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
      case "starts_with":
        return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
      case "ends_with":
        return String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
      case "in":
        return Array.isArray(filter.value) && filter.value.includes(value);
      case "not_in":
        return Array.isArray(filter.value) && !filter.value.includes(value);
      case "between":
        return Number(value) >= Number(filter.value) && Number(value) <= Number(filter.valueEnd);
      case "is_null":
        return value === null || value === undefined;
      case "is_not_null":
        return value !== null && value !== undefined;
      default:
        return true;
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce((current: unknown, key) => {
      if (current && typeof current === "object") {
        const record = current as Record<string, unknown>;
        if (Array.isArray(record) && !isNaN(Number(key))) {
          return record[Number(key)];
        }
        return record[key];
      }
      return undefined;
    }, obj);
  }

  private compareValues(a: unknown, b: unknown, order: SortOrder): number {
    if (a === b) return 0;
    if (a === null || a === undefined) return order === "asc" ? 1 : -1;
    if (b === null || b === undefined) return order === "asc" ? -1 : 1;

    let comparison = 0;
    if (typeof a === "string" && typeof b === "string") {
      comparison = a.localeCompare(b);
    } else if (typeof a === "number" && typeof b === "number") {
      comparison = a - b;
    } else {
      comparison = String(a).localeCompare(String(b));
    }

    return order === "asc" ? comparison : -comparison;
  }

  private calculateRelevanceScore(resource: SearchResult, query: string): number {
    const jsonStr = JSON.stringify(resource.data).toLowerCase();
    const terms = query.toLowerCase().split(/\s+/);
    
    let score = 0;
    for (const term of terms) {
      const matches = (jsonStr.match(new RegExp(term, "g")) || []).length;
      score += matches * 10;
      
      if (JSON.stringify(resource.data.name || {}).toLowerCase().includes(term)) {
        score += 50;
      }
      if (JSON.stringify(resource.data.code || {}).toLowerCase().includes(term)) {
        score += 30;
      }
    }

    return score;
  }

  private extractHighlights(resource: SearchResult, terms: string[]): Record<string, string[]> {
    const highlights: Record<string, string[]> = {};
    
    const checkField = (fieldName: string, value: unknown) => {
      const str = JSON.stringify(value).toLowerCase();
      for (const term of terms) {
        if (str.includes(term)) {
          if (!highlights[fieldName]) highlights[fieldName] = [];
          highlights[fieldName].push(String(value));
        }
      }
    };

    Object.entries(resource.data as Record<string, unknown>).forEach(([key, value]) => {
      checkField(key, value);
    });

    return highlights;
  }

  private calculateFacets(results: SearchResult[]): Record<string, Array<{ value: string; count: number }>> {
    const resourceTypeFacet: Record<string, number> = {};
    const sourceFacet: Record<string, number> = {};
    const statusFacet: Record<string, number> = {};

    for (const result of results) {
      resourceTypeFacet[result.resourceType] = (resourceTypeFacet[result.resourceType] || 0) + 1;
      sourceFacet[result.source] = (sourceFacet[result.source] || 0) + 1;
      
      const clinicalStatus = result.data.clinicalStatus as { coding?: Array<{ code?: string }> } | undefined;
      const status = (result.data.status as string) || clinicalStatus?.coding?.[0]?.code;
      if (status) {
        statusFacet[String(status)] = (statusFacet[String(status)] || 0) + 1;
      }
    }

    return {
      resourceType: Object.entries(resourceTypeFacet).map(([value, count]) => ({ value, count })),
      source: Object.entries(sourceFacet).map(([value, count]) => ({ value, count })),
      status: Object.entries(statusFacet).map(([value, count]) => ({ value, count })),
    };
  }

  async saveSearch(params: {
    name: string;
    description?: string;
    query: SearchQuery;
    userId: string;
    isPublic?: boolean;
  }): Promise<SavedSearch> {
    const savedSearch: SavedSearch = {
      id: randomUUID(),
      name: params.name,
      description: params.description,
      query: params.query,
      createdBy: params.userId,
      createdAt: new Date().toISOString(),
      useCount: 0,
      isPublic: params.isPublic || false,
    };

    this.savedSearches.set(savedSearch.id, savedSearch);
    return savedSearch;
  }

  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    return Array.from(this.savedSearches.values())
      .filter((s) => s.createdBy === userId || s.isPublic)
      .sort((a, b) => b.useCount - a.useCount);
  }

  async deleteSavedSearch(searchId: string, userId: string): Promise<void> {
    const search = this.savedSearches.get(searchId);
    if (!search) {
      throw new Error("Saved search not found");
    }
    if (search.createdBy !== userId) {
      throw new Error("Not authorized to delete this search");
    }
    this.savedSearches.delete(searchId);
  }

  async executeSavedSearch(searchId: string): Promise<SearchResponse> {
    const savedSearch = this.savedSearches.get(searchId);
    if (!savedSearch) {
      throw new Error("Saved search not found");
    }

    savedSearch.useCount++;
    savedSearch.lastUsed = new Date().toISOString();

    return this.search(savedSearch.query);
  }

  getResourceTypes(): string[] {
    const types = new Set<string>();
    this.resources.forEach((r) => types.add(r.resourceType));
    return Array.from(types);
  }

  getSources(): string[] {
    const sources = new Set<string>();
    this.resources.forEach((r) => sources.add(r.source));
    return Array.from(sources);
  }

  getSearchableFields(resourceType: string): string[] {
    const fields = new Set<string>(["resourceType", "resourceId", "source", "lastUpdated"]);
    
    this.resources
      .filter((r) => r.resourceType === resourceType)
      .forEach((r) => {
        const extractFields = (obj: Record<string, unknown>, prefix = "") => {
          Object.keys(obj).forEach((key) => {
            const fullPath = prefix ? `${prefix}.${key}` : key;
            fields.add(fullPath);
            if (obj[key] && typeof obj[key] === "object" && !Array.isArray(obj[key])) {
              extractFields(obj[key] as Record<string, unknown>, fullPath);
            }
          });
        };
        extractFields(r.data);
      });

    return Array.from(fields);
  }
}

export const fhirAdvancedSearch = new FhirAdvancedSearchService();
