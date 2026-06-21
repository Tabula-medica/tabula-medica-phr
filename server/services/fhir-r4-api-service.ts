import { randomUUID } from "crypto";

export interface FhirR4Resource {
  resourceType: string;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  [key: string]: unknown;
}

export interface FhirR4Bundle {
  resourceType: "Bundle";
  id?: string;
  type: "searchset" | "transaction" | "batch" | "collection" | "document";
  total?: number;
  timestamp?: string;
  entry?: FhirR4BundleEntry[];
  link?: Array<{ relation: string; url: string }>;
}

export interface FhirR4BundleEntry {
  fullUrl?: string;
  resource?: FhirR4Resource;
  request?: { method: string; url: string };
  response?: { status: string; location?: string; outcome?: FhirR4Resource };
}

export interface FhirR4OperationOutcome {
  resourceType: "OperationOutcome";
  issue: Array<{
    severity: "fatal" | "error" | "warning" | "information";
    code: string;
    diagnostics?: string;
    details?: { text?: string };
  }>;
}

export interface FhirApiActivity {
  id: string;
  timestamp: string;
  method: string;
  resourceType: string;
  resourceId?: string;
  operation: string;
  statusCode: number;
  responseTimeMs: number;
  clientId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface FhirApiUsageMetrics {
  totalRequests: number;
  requestsLast24h: number;
  requestsLast7d: number;
  avgResponseTimeMs: number;
  errorRate: number;
  resourceBreakdown: Array<{ resourceType: string; count: number; avgLatencyMs: number }>;
  recentActivity: FhirApiActivity[];
  topOperations: Array<{ operation: string; count: number }>;
  statusCodeBreakdown: Array<{ statusCode: number; count: number }>;
}

const SUPPORTED_RESOURCES = [
  "Patient", "Observation", "Condition", "Procedure",
  "MedicationRequest", "AllergyIntolerance", "Immunization",
  "DocumentReference", "Encounter", "DiagnosticReport",
] as const;

export type SupportedResourceType = typeof SUPPORTED_RESOURCES[number];

class FhirR4ApiService {
  private activityLog: FhirApiActivity[] = [];
  private resourceStore: Map<string, Map<string, FhirR4Resource>> = new Map();

  constructor() {
    for (const rt of SUPPORTED_RESOURCES) {
      this.resourceStore.set(rt, new Map());
    }
    this.seedSampleData();
  }

  isSupportedResource(resourceType: string): resourceType is SupportedResourceType {
    return (SUPPORTED_RESOURCES as readonly string[]).includes(resourceType);
  }

  getSupportedResources(): readonly string[] {
    return SUPPORTED_RESOURCES;
  }

  logActivity(activity: Omit<FhirApiActivity, "id" | "timestamp">) {
    this.activityLog.push({
      ...activity,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    });
    if (this.activityLog.length > 10000) {
      this.activityLog = this.activityLog.slice(-5000);
    }
  }

  getCapabilityStatement(baseUrl: string): FhirR4Resource {
    return {
      resourceType: "CapabilityStatement",
      id: "tabula-medica-fhir-r4",
      status: "active",
      date: new Date().toISOString(),
      kind: "instance",
      fhirVersion: "4.0.1",
      format: ["json", "application/fhir+json"],
      implementation: {
        description: "Tabula Medica FHIR R4 API - USCDI V3 Compliant",
        url: baseUrl,
      },
      rest: [{
        mode: "server",
        security: {
          cors: true,
          service: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/restful-security-service", code: "SMART-on-FHIR" }] }],
          description: "Authentication required via session or Bearer token. Supports OAuth 2.0 with SMART on FHIR scopes.",
        },
        resource: SUPPORTED_RESOURCES.map(rt => ({
          type: rt,
          profile: `http://hl7.org/fhir/us/core/StructureDefinition/us-core-${rt.toLowerCase()}`,
          interaction: [
            { code: "read" },
            { code: "search-type" },
            { code: "create" },
          ],
          searchParam: this.getSearchParams(rt),
          versioning: "versioned",
          readHistory: false,
          updateCreate: false,
          conditionalCreate: false,
        })),
        interaction: [
          { code: "transaction" },
          { code: "batch" },
          { code: "search-system" },
        ],
        operation: [
          { name: "export", definition: "http://hl7.org/fhir/uv/bulkdata/OperationDefinition/export", documentation: "Bulk export via GET /api/fhir/r4-export. Patient-level export via POST /api/fhir/r4-export/patient." },
          { name: "import", documentation: "Bundle import via POST /api/fhir/r4-import/bundle" },
        ],
      }],
    };
  }

  private getSearchParams(resourceType: string): Array<{ name: string; type: string }> {
    const common = [
      { name: "_id", type: "token" },
      { name: "_lastUpdated", type: "date" },
      { name: "_count", type: "number" },
    ];
    const specific: Record<string, Array<{ name: string; type: string }>> = {
      Patient: [{ name: "name", type: "string" }, { name: "birthdate", type: "date" }, { name: "gender", type: "token" }, { name: "identifier", type: "token" }],
      Observation: [{ name: "patient", type: "reference" }, { name: "category", type: "token" }, { name: "code", type: "token" }, { name: "date", type: "date" }, { name: "status", type: "token" }],
      Condition: [{ name: "patient", type: "reference" }, { name: "clinical-status", type: "token" }, { name: "category", type: "token" }, { name: "code", type: "token" }],
      Procedure: [{ name: "patient", type: "reference" }, { name: "date", type: "date" }, { name: "status", type: "token" }, { name: "code", type: "token" }],
      MedicationRequest: [{ name: "patient", type: "reference" }, { name: "status", type: "token" }, { name: "intent", type: "token" }, { name: "authoredon", type: "date" }],
      AllergyIntolerance: [{ name: "patient", type: "reference" }, { name: "clinical-status", type: "token" }, { name: "type", type: "token" }, { name: "criticality", type: "token" }],
      Immunization: [{ name: "patient", type: "reference" }, { name: "date", type: "date" }, { name: "status", type: "token" }],
      DocumentReference: [{ name: "patient", type: "reference" }, { name: "type", type: "token" }, { name: "date", type: "date" }, { name: "status", type: "token" }],
      Encounter: [{ name: "patient", type: "reference" }, { name: "date", type: "date" }, { name: "status", type: "token" }, { name: "class", type: "token" }],
      DiagnosticReport: [{ name: "patient", type: "reference" }, { name: "date", type: "date" }, { name: "status", type: "token" }, { name: "code", type: "token" }, { name: "category", type: "token" }],
    };
    return [...common, ...(specific[resourceType] || [])];
  }

  readResource(resourceType: string, id: string): FhirR4Resource | null {
    const store = this.resourceStore.get(resourceType);
    return store?.get(id) || null;
  }

  searchResources(resourceType: string, params: Record<string, string>): FhirR4Bundle {
    const store = this.resourceStore.get(resourceType);
    if (!store) {
      return { resourceType: "Bundle", type: "searchset", total: 0, entry: [] };
    }

    let resources = Array.from(store.values());
    const count = Math.min(parseInt(params._count || "50", 10), 200);

    if (params.patient) {
      const patientRef = params.patient.startsWith("Patient/") ? params.patient : `Patient/${params.patient}`;
      resources = resources.filter(r => {
        const subject = (r as any).subject?.reference || (r as any).patient?.reference;
        return subject === patientRef;
      });
    }

    if (params.status) {
      resources = resources.filter(r => (r as any).status === params.status);
    }

    if (params.category) {
      resources = resources.filter(r => {
        const cats = (r as any).category;
        if (!Array.isArray(cats)) return false;
        return cats.some((c: any) =>
          c.coding?.some((cd: any) => cd.code === params.category || cd.display?.toLowerCase().includes(params.category.toLowerCase()))
        );
      });
    }

    if (params.code) {
      resources = resources.filter(r => {
        const code = (r as any).code;
        if (!code) return false;
        return code.coding?.some((c: any) => c.code === params.code) || code.text?.toLowerCase().includes(params.code.toLowerCase());
      });
    }

    if (params["clinical-status"]) {
      resources = resources.filter(r => {
        const cs = (r as any).clinicalStatus;
        return cs?.coding?.some((c: any) => c.code === params["clinical-status"]);
      });
    }

    if (params.name && resourceType === "Patient") {
      const nameSearch = params.name.toLowerCase();
      resources = resources.filter(r => {
        const names = (r as any).name;
        if (!Array.isArray(names)) return false;
        return names.some((n: any) =>
          n.family?.toLowerCase().includes(nameSearch) ||
          n.given?.some((g: string) => g.toLowerCase().includes(nameSearch))
        );
      });
    }

    if (params.gender && resourceType === "Patient") {
      resources = resources.filter(r => (r as any).gender === params.gender);
    }

    if (params._id) {
      resources = resources.filter(r => r.id === params._id);
    }

    const total = resources.length;
    resources = resources.slice(0, count);

    return {
      resourceType: "Bundle",
      type: "searchset",
      total,
      timestamp: new Date().toISOString(),
      entry: resources.map(r => ({
        fullUrl: `urn:uuid:${r.id}`,
        resource: r,
      })),
    };
  }

  createResource(resourceType: string, resource: FhirR4Resource): FhirR4Resource {
    const store = this.resourceStore.get(resourceType);
    if (!store) throw new Error(`Unsupported resource type: ${resourceType}`);

    const id = resource.id || randomUUID();
    const saved: FhirR4Resource = {
      ...resource,
      id,
      resourceType,
      meta: {
        versionId: "1",
        lastUpdated: new Date().toISOString(),
        ...(resource.meta || {}),
      },
    };

    store.set(id, saved);
    return saved;
  }

  processBundle(bundle: FhirR4Bundle): FhirR4Bundle {
    const results: FhirR4BundleEntry[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const entry of bundle.entry || []) {
      if (!entry.resource) {
        results.push({
          response: {
            status: "400 Bad Request",
            outcome: this.createOperationOutcome("error", "invalid", "Bundle entry missing resource"),
          },
        });
        errorCount++;
        continue;
      }

      const rt = entry.resource.resourceType;
      if (!this.isSupportedResource(rt)) {
        results.push({
          response: {
            status: "422 Unprocessable Entity",
            outcome: this.createOperationOutcome("error", "not-supported", `Unsupported resource type: ${rt}`),
          },
        });
        errorCount++;
        continue;
      }

      try {
        const created = this.createResource(rt, entry.resource);
        results.push({
          resource: created,
          response: {
            status: "201 Created",
            location: `${rt}/${created.id}`,
          },
        });
        successCount++;
      } catch (err: any) {
        results.push({
          response: {
            status: "400 Bad Request",
            outcome: this.createOperationOutcome("error", "exception", err.message),
          },
        });
        errorCount++;
      }
    }

    return {
      resourceType: "Bundle",
      type: "transaction" as any,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      total: results.length,
      entry: results,
    };
  }

  exportResources(resourceTypes?: string[], patientId?: string): FhirR4Bundle {
    const types = resourceTypes?.length
      ? resourceTypes.filter(t => this.isSupportedResource(t))
      : [...SUPPORTED_RESOURCES];

    const entries: FhirR4BundleEntry[] = [];

    for (const rt of types) {
      const store = this.resourceStore.get(rt);
      if (!store) continue;
      for (const resource of store.values()) {
        if (patientId) {
          const subject = (resource as any).subject?.reference || (resource as any).patient?.reference;
          const isPatient = rt === "Patient" && resource.id === patientId;
          if (!isPatient && subject !== `Patient/${patientId}`) continue;
        }
        entries.push({
          fullUrl: `urn:uuid:${resource.id}`,
          resource,
        });
      }
    }

    return {
      resourceType: "Bundle",
      type: "collection",
      id: randomUUID(),
      total: entries.length,
      timestamp: new Date().toISOString(),
      entry: entries,
    };
  }

  createOperationOutcome(severity: "fatal" | "error" | "warning" | "information", code: string, diagnostics: string): FhirR4OperationOutcome {
    return {
      resourceType: "OperationOutcome",
      issue: [{ severity, code, diagnostics }],
    };
  }

  getUsageMetrics(): FhirApiUsageMetrics {
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const last7d = now - 7 * 24 * 60 * 60 * 1000;

    const recent24h = this.activityLog.filter(a => new Date(a.timestamp).getTime() > last24h);
    const recent7d = this.activityLog.filter(a => new Date(a.timestamp).getTime() > last7d);

    const allTimes = this.activityLog.map(a => a.responseTimeMs);
    const avgResponseTime = allTimes.length > 0 ? Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length) : 0;
    const errors = this.activityLog.filter(a => a.statusCode >= 400);

    const resourceCounts: Record<string, { count: number; totalLatency: number }> = {};
    for (const a of this.activityLog) {
      if (!resourceCounts[a.resourceType]) {
        resourceCounts[a.resourceType] = { count: 0, totalLatency: 0 };
      }
      resourceCounts[a.resourceType].count++;
      resourceCounts[a.resourceType].totalLatency += a.responseTimeMs;
    }

    const opCounts: Record<string, number> = {};
    for (const a of this.activityLog) {
      opCounts[a.operation] = (opCounts[a.operation] || 0) + 1;
    }

    const statusCounts: Record<number, number> = {};
    for (const a of this.activityLog) {
      statusCounts[a.statusCode] = (statusCounts[a.statusCode] || 0) + 1;
    }

    return {
      totalRequests: this.activityLog.length,
      requestsLast24h: recent24h.length,
      requestsLast7d: recent7d.length,
      avgResponseTimeMs: avgResponseTime,
      errorRate: this.activityLog.length > 0 ? Math.round((errors.length / this.activityLog.length) * 100) : 0,
      resourceBreakdown: Object.entries(resourceCounts)
        .map(([resourceType, data]) => ({
          resourceType,
          count: data.count,
          avgLatencyMs: Math.round(data.totalLatency / data.count),
        }))
        .sort((a, b) => b.count - a.count),
      recentActivity: this.activityLog.slice(-50).reverse(),
      topOperations: Object.entries(opCounts)
        .map(([operation, count]) => ({ operation, count }))
        .sort((a, b) => b.count - a.count),
      statusCodeBreakdown: Object.entries(statusCounts)
        .map(([code, count]) => ({ statusCode: parseInt(code), count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  getResourceCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [rt, store] of this.resourceStore) {
      counts[rt] = store.size;
    }
    return counts;
  }

  private seedSampleData() {
    const patientIds = [randomUUID(), randomUUID(), randomUUID()];
    const patients: FhirR4Resource[] = [
      {
        resourceType: "Patient", id: patientIds[0],
        meta: { versionId: "1", lastUpdated: new Date(Date.now() - 86400000).toISOString(), profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"] },
        identifier: [{ system: "http://hospital.smarthealthit.org", value: "MRN-001" }],
        name: [{ use: "official", family: "Johnson", given: ["Sarah", "Marie"] }],
        gender: "female", birthDate: "1985-03-15",
        telecom: [{ system: "phone", value: "555-0101", use: "home" }, { system: "email", value: "sarah.johnson@example.com" }],
        address: [{ use: "home", line: ["123 Oak Street"], city: "Springfield", state: "IL", postalCode: "62704", country: "US" }],
        communication: [{ language: { coding: [{ system: "urn:ietf:bcp:47", code: "en" }] }, preferred: true }],
      },
      {
        resourceType: "Patient", id: patientIds[1],
        meta: { versionId: "1", lastUpdated: new Date(Date.now() - 172800000).toISOString(), profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"] },
        identifier: [{ system: "http://hospital.smarthealthit.org", value: "MRN-002" }],
        name: [{ use: "official", family: "Chen", given: ["David"] }],
        gender: "male", birthDate: "1972-08-22",
        telecom: [{ system: "phone", value: "555-0202", use: "mobile" }],
        address: [{ use: "home", line: ["456 Maple Ave"], city: "Chicago", state: "IL", postalCode: "60601" }],
      },
      {
        resourceType: "Patient", id: patientIds[2],
        meta: { versionId: "1", lastUpdated: new Date(Date.now() - 259200000).toISOString(), profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"] },
        identifier: [{ system: "http://hospital.smarthealthit.org", value: "MRN-003" }],
        name: [{ use: "official", family: "Williams", given: ["Maria", "Elena"] }],
        gender: "female", birthDate: "1990-12-01",
        telecom: [{ system: "email", value: "maria.w@example.com" }],
        address: [{ use: "home", line: ["789 Pine Rd"], city: "Naperville", state: "IL", postalCode: "60540" }],
      },
    ];

    for (const p of patients) this.createResource("Patient", p);

    const conditions: FhirR4Resource[] = [
      { resourceType: "Condition", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] }, verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed" }] }, category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-category", code: "encounter-diagnosis", display: "Encounter Diagnosis" }] }], code: { coding: [{ system: "http://snomed.info/sct", code: "44054006", display: "Type 2 Diabetes Mellitus" }], text: "Type 2 Diabetes Mellitus" }, subject: { reference: `Patient/${patientIds[0]}` }, onsetDateTime: "2020-06-15", recordedDate: "2020-06-15" },
      { resourceType: "Condition", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] }, verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed" }] }, category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-category", code: "problem-list-item", display: "Problem List Item" }] }], code: { coding: [{ system: "http://snomed.info/sct", code: "38341003", display: "Essential Hypertension" }], text: "Essential Hypertension" }, subject: { reference: `Patient/${patientIds[0]}` }, onsetDateTime: "2018-03-10" },
      { resourceType: "Condition", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "resolved" }] }, verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed" }] }, code: { coding: [{ system: "http://snomed.info/sct", code: "195967001", display: "Asthma" }], text: "Asthma" }, subject: { reference: `Patient/${patientIds[1]}` }, onsetDateTime: "2015-01-20", abatementDateTime: "2023-06-01" },
    ];
    for (const c of conditions) this.createResource("Condition", c);

    const observations: FhirR4Resource[] = [
      { resourceType: "Observation", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "final", category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs", display: "Vital Signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "85354-9", display: "Blood Pressure" }], text: "Blood Pressure" }, subject: { reference: `Patient/${patientIds[0]}` }, effectiveDateTime: new Date(Date.now() - 3600000).toISOString(), component: [{ code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic" }] }, valueQuantity: { value: 128, unit: "mmHg" } }, { code: { coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic" }] }, valueQuantity: { value: 82, unit: "mmHg" } }] },
      { resourceType: "Observation", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "final", category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs", display: "Vital Signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart Rate" }], text: "Heart Rate" }, subject: { reference: `Patient/${patientIds[0]}` }, effectiveDateTime: new Date(Date.now() - 3600000).toISOString(), valueQuantity: { value: 72, unit: "bpm", system: "http://unitsofmeasure.org", code: "/min" } },
      { resourceType: "Observation", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "final", category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory", display: "Laboratory" }] }], code: { coding: [{ system: "http://loinc.org", code: "4548-4", display: "Hemoglobin A1c" }], text: "HbA1c" }, subject: { reference: `Patient/${patientIds[0]}` }, effectiveDateTime: new Date(Date.now() - 604800000).toISOString(), valueQuantity: { value: 7.2, unit: "%", system: "http://unitsofmeasure.org", code: "%" }, referenceRange: [{ low: { value: 4.0, unit: "%" }, high: { value: 5.6, unit: "%" }, text: "Normal: 4.0-5.6%" }] },
      { resourceType: "Observation", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "final", category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory", display: "Laboratory" }] }], code: { coding: [{ system: "http://loinc.org", code: "2345-7", display: "Glucose" }], text: "Blood Glucose" }, subject: { reference: `Patient/${patientIds[1]}` }, effectiveDateTime: new Date(Date.now() - 172800000).toISOString(), valueQuantity: { value: 95, unit: "mg/dL", system: "http://unitsofmeasure.org", code: "mg/dL" } },
      { resourceType: "Observation", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "final", category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs", display: "Vital Signs" }] }], code: { coding: [{ system: "http://loinc.org", code: "29463-7", display: "Body Weight" }], text: "Body Weight" }, subject: { reference: `Patient/${patientIds[2]}` }, effectiveDateTime: new Date(Date.now() - 86400000).toISOString(), valueQuantity: { value: 68.5, unit: "kg", system: "http://unitsofmeasure.org", code: "kg" } },
    ];
    for (const o of observations) this.createResource("Observation", o);

    const medications: FhirR4Resource[] = [
      { resourceType: "MedicationRequest", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "active", intent: "order", medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "860975", display: "Metformin 500 MG" }], text: "Metformin 500mg" }, subject: { reference: `Patient/${patientIds[0]}` }, authoredOn: "2020-07-01", requester: { display: "Dr. Smith" }, dosageInstruction: [{ text: "Take 1 tablet by mouth twice daily with meals", timing: { repeat: { frequency: 2, period: 1, periodUnit: "d" } }, doseAndRate: [{ doseQuantity: { value: 500, unit: "mg" } }] }] },
      { resourceType: "MedicationRequest", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "active", intent: "order", medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "314076", display: "Lisinopril 10 MG" }], text: "Lisinopril 10mg" }, subject: { reference: `Patient/${patientIds[0]}` }, authoredOn: "2018-04-15", requester: { display: "Dr. Smith" }, dosageInstruction: [{ text: "Take 1 tablet by mouth once daily" }] },
      { resourceType: "MedicationRequest", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "stopped", intent: "order", medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "197361", display: "Albuterol Inhaler" }], text: "Albuterol Inhaler" }, subject: { reference: `Patient/${patientIds[1]}` }, authoredOn: "2015-02-01", requester: { display: "Dr. Lee" } },
    ];
    for (const m of medications) this.createResource("MedicationRequest", m);

    const allergies: FhirR4Resource[] = [
      { resourceType: "AllergyIntolerance", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }] }, verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification", code: "confirmed" }] }, type: "allergy", category: ["medication"], criticality: "high", code: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "7980", display: "Penicillin" }], text: "Penicillin" }, patient: { reference: `Patient/${patientIds[0]}` }, recordedDate: "2010-05-15", reaction: [{ manifestation: [{ coding: [{ display: "Anaphylaxis" }] }], severity: "severe" }] },
      { resourceType: "AllergyIntolerance", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }] }, type: "intolerance", category: ["food"], criticality: "low", code: { coding: [{ display: "Shellfish" }], text: "Shellfish" }, patient: { reference: `Patient/${patientIds[1]}` }, recordedDate: "2019-08-20" },
    ];
    for (const a of allergies) this.createResource("AllergyIntolerance", a);

    const immunizations: FhirR4Resource[] = [
      { resourceType: "Immunization", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "completed", vaccineCode: { coding: [{ system: "http://hl7.org/fhir/sid/cvx", code: "213", display: "SARS-COV-2 (COVID-19) vaccine, mRNA, spike protein, LNP" }], text: "COVID-19 mRNA Vaccine" }, patient: { reference: `Patient/${patientIds[0]}` }, occurrenceDateTime: "2024-10-15", location: { display: "Springfield Medical Center" }, performer: [{ actor: { display: "Nurse Davis" } }] },
      { resourceType: "Immunization", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "completed", vaccineCode: { coding: [{ system: "http://hl7.org/fhir/sid/cvx", code: "141", display: "Influenza, seasonal, injectable" }], text: "Flu Vaccine 2025-2026" }, patient: { reference: `Patient/${patientIds[0]}` }, occurrenceDateTime: "2025-09-20" },
      { resourceType: "Immunization", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "completed", vaccineCode: { coding: [{ system: "http://hl7.org/fhir/sid/cvx", code: "113", display: "Td (adult)" }], text: "Tetanus-Diphtheria" }, patient: { reference: `Patient/${patientIds[2]}` }, occurrenceDateTime: "2023-03-10" },
    ];
    for (const i of immunizations) this.createResource("Immunization", i);

    const procedures: FhirR4Resource[] = [
      { resourceType: "Procedure", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "completed", code: { coding: [{ system: "http://snomed.info/sct", code: "80146002", display: "Appendectomy" }], text: "Appendectomy" }, subject: { reference: `Patient/${patientIds[1]}` }, performedDateTime: "2022-11-15", performer: [{ actor: { display: "Dr. Park" } }], location: { display: "Chicago General Hospital" } },
      { resourceType: "Procedure", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "completed", code: { coding: [{ system: "http://snomed.info/sct", code: "274031008", display: "Colonoscopy" }], text: "Screening Colonoscopy" }, subject: { reference: `Patient/${patientIds[0]}` }, performedDateTime: "2025-01-10", performer: [{ actor: { display: "Dr. Rivera" } }] },
    ];
    for (const p of procedures) this.createResource("Procedure", p);

    const encounters: FhirR4Resource[] = [
      { resourceType: "Encounter", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "finished", class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "ambulatory" }, type: [{ coding: [{ system: "http://snomed.info/sct", code: "185349003", display: "Encounter for check up" }], text: "Annual Physical" }], subject: { reference: `Patient/${patientIds[0]}` }, period: { start: "2025-12-15T09:00:00Z", end: "2025-12-15T10:00:00Z" }, participant: [{ individual: { display: "Dr. Smith" } }], location: [{ location: { display: "Springfield Family Practice" } }] },
      { resourceType: "Encounter", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "finished", class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "EMER", display: "emergency" }, type: [{ text: "Emergency Visit" }], subject: { reference: `Patient/${patientIds[1]}` }, period: { start: "2022-11-15T02:30:00Z", end: "2022-11-16T14:00:00Z" } },
    ];
    for (const e of encounters) this.createResource("Encounter", e);

    const diagnosticReports: FhirR4Resource[] = [
      { resourceType: "DiagnosticReport", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "final", category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0074", code: "LAB", display: "Laboratory" }] }], code: { coding: [{ system: "http://loinc.org", code: "58410-2", display: "CBC panel" }], text: "Complete Blood Count" }, subject: { reference: `Patient/${patientIds[0]}` }, effectiveDateTime: new Date(Date.now() - 604800000).toISOString(), issued: new Date(Date.now() - 518400000).toISOString(), performer: [{ display: "Springfield Lab" }], conclusion: "All values within normal limits." },
      { resourceType: "DiagnosticReport", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "final", category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v2-0074", code: "LAB" }] }], code: { coding: [{ system: "http://loinc.org", code: "24323-8", display: "Comprehensive Metabolic Panel" }], text: "Comprehensive Metabolic Panel" }, subject: { reference: `Patient/${patientIds[0]}` }, effectiveDateTime: new Date(Date.now() - 604800000).toISOString(), conclusion: "Glucose slightly elevated. All other values normal." },
    ];
    for (const d of diagnosticReports) this.createResource("DiagnosticReport", d);

    const documents: FhirR4Resource[] = [
      { resourceType: "DocumentReference", id: randomUUID(), meta: { lastUpdated: new Date().toISOString() }, status: "current", type: { coding: [{ system: "http://loinc.org", code: "34133-9", display: "Summarization of Episode Note" }], text: "Clinical Summary" }, subject: { reference: `Patient/${patientIds[0]}` }, date: "2025-12-15", author: [{ display: "Dr. Smith" }], description: "Annual physical exam clinical summary", content: [{ attachment: { contentType: "application/pdf", title: "Annual_Physical_2025.pdf" } }] },
    ];
    for (const d of documents) this.createResource("DocumentReference", d);

    this.seedActivityLog();
  }

  private seedActivityLog() {
    const operations = ["read", "search", "create", "export", "metadata"];
    const resources = [...SUPPORTED_RESOURCES];
    const methods = { read: "GET", search: "GET", create: "POST", export: "GET", metadata: "GET" };

    for (let i = 0; i < 120; i++) {
      const op = operations[Math.floor(Math.random() * operations.length)];
      const rt = op === "metadata" ? "CapabilityStatement" : resources[Math.floor(Math.random() * resources.length)];
      const isError = Math.random() < 0.08;
      const hoursAgo = Math.random() * 168;

      this.activityLog.push({
        id: randomUUID(),
        timestamp: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
        method: methods[op as keyof typeof methods],
        resourceType: rt,
        resourceId: op === "read" ? randomUUID().slice(0, 8) : undefined,
        operation: op,
        statusCode: isError ? (Math.random() > 0.5 ? 404 : 400) : 200,
        responseTimeMs: Math.round(15 + Math.random() * 180),
        clientId: `client-${["epic-prod", "cerner-staging", "athena-prod", "internal-app", "research-api"][Math.floor(Math.random() * 5)]}`,
      });
    }

    this.activityLog.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
}

export const fhirR4ApiService = new FhirR4ApiService();
