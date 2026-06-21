import type {
  IFhirStore,
  FhirResource,
  FhirBundle,
  FhirSearchParams,
  FhirPatient,
  FhirObservation,
  FhirCondition,
  FhirMedication,
  FhirMedicationRequest,
  FhirDiagnosticReport,
  FhirImmunization,
  FhirProcedure,
  FhirCarePlan,
  FhirAllergyIntolerance,
  FhirEncounter,
  FhirMedicationStatement,
  IntegrationConfig,
} from "../integrations/interfaces";

interface AidboxClient {
  getResource(resourceType: string, id: string): Promise<any>;
  createResource(resourceType: string, resource: any): Promise<any>;
  patchResource(resourceType: string, id: string, patch: any): Promise<any>;
  deleteResource(resourceType: string, id: string): Promise<any>;
  searchResources(resourceType: string, params: Record<string, any>): Promise<any>;
}

export class AidboxFhirStore implements IFhirStore {
  readonly providerName = "aidbox";
  private _isConnected = false;
  private client: AidboxClient | null = null;
  private config: IntegrationConfig;

  constructor(config: IntegrationConfig) {
    this.config = config;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(): Promise<void> {
    try {
      if (!this.config.aidbox) {
        throw new Error("Aidbox configuration is required");
      }

      const { url, clientId, clientSecret } = this.config.aidbox;

      this.client = {
        async getResource(resourceType: string, id: string) {
          const response = await fetch(`${url}/fhir/${resourceType}/${id}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/fhir+json",
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
            },
          });
          if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`Aidbox GET failed: ${response.statusText}`);
          }
          return response.json();
        },

        async createResource(resourceType: string, resource: any) {
          const response = await fetch(`${url}/fhir/${resourceType}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/fhir+json",
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
            },
            body: JSON.stringify(resource),
          });
          if (!response.ok) throw new Error(`Aidbox POST failed: ${response.statusText}`);
          return response.json();
        },

        async patchResource(resourceType: string, id: string, patch: any) {
          const response = await fetch(`${url}/fhir/${resourceType}/${id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json-patch+json",
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
            },
            body: JSON.stringify(patch),
          });
          if (!response.ok) throw new Error(`Aidbox PATCH failed: ${response.statusText}`);
          return response.json();
        },

        async deleteResource(resourceType: string, id: string) {
          const response = await fetch(`${url}/fhir/${resourceType}/${id}`, {
            method: "DELETE",
            headers: {
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
            },
          });
          return response.ok;
        },

        async searchResources(resourceType: string, params: Record<string, any>) {
          const searchParams = new URLSearchParams();
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              searchParams.set(key, String(value));
            }
          });

          const response = await fetch(`${url}/fhir/${resourceType}?${searchParams}`, {
            method: "GET",
            headers: {
              "Content-Type": "application/fhir+json",
              Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
            },
          });
          if (!response.ok) throw new Error(`Aidbox search failed: ${response.statusText}`);
          return response.json();
        },
      };

      await this.healthCheck();
      this._isConnected = true;
      console.log(`[Aidbox] Connected to: ${url}`);
    } catch (error) {
      console.error("[Aidbox] Connection failed:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this._isConnected = false;
    console.log("[Aidbox] Disconnected");
  }

  async healthCheck(): Promise<{ status: "healthy" | "unhealthy"; latencyMs: number; message?: string }> {
    const start = Date.now();
    try {
      if (!this.client || !this.config.aidbox) {
        return { status: "unhealthy", latencyMs: 0, message: "Client not initialized" };
      }

      const response = await fetch(`${this.config.aidbox.url}/health`, {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.aidbox.clientId}:${this.config.aidbox.clientSecret}`).toString("base64")}`,
        },
      });

      return {
        status: response.ok ? "healthy" : "unhealthy",
        latencyMs: Date.now() - start,
        message: response.ok ? "Aidbox is accessible" : "Health check failed",
      };
    } catch (error: any) {
      return {
        status: "unhealthy",
        latencyMs: Date.now() - start,
        message: error.message || "Health check failed",
      };
    }
  }

  async createResource<T extends FhirResource>(resourceType: string, resource: T): Promise<T> {
    if (!this.client) throw new Error("Not connected");
    return this.client.createResource(resourceType, resource) as Promise<T>;
  }

  async readResource<T extends FhirResource>(resourceType: string, id: string): Promise<T | null> {
    if (!this.client) throw new Error("Not connected");
    return this.client.getResource(resourceType, id) as Promise<T | null>;
  }

  async updateResource<T extends FhirResource>(resourceType: string, id: string, resource: T): Promise<T> {
    if (!this.client) throw new Error("Not connected");
    return this.client.patchResource(resourceType, id, resource) as Promise<T>;
  }

  async deleteResource(resourceType: string, id: string): Promise<boolean> {
    if (!this.client) throw new Error("Not connected");
    return this.client.deleteResource(resourceType, id);
  }

  async searchResources<T extends FhirResource>(resourceType: string, params: FhirSearchParams): Promise<FhirBundle> {
    if (!this.client) throw new Error("Not connected");
    return this.client.searchResources(resourceType, params) as Promise<FhirBundle>;
  }

  async getPatient(patientId: string): Promise<FhirPatient | null> {
    return this.readResource<FhirPatient>("Patient", patientId);
  }

  async getPatientObservations(patientId: string, category?: string): Promise<FhirObservation[]> {
    const bundle = await this.searchResources<FhirObservation>("Observation", {
      patient: patientId,
      ...(category && { category }),
    });
    return (bundle.entry || []).map((e) => e.resource as FhirObservation);
  }

  async getPatientConditions(patientId: string): Promise<FhirCondition[]> {
    const bundle = await this.searchResources<FhirCondition>("Condition", { patient: patientId });
    return (bundle.entry || []).map((e) => e.resource as FhirCondition);
  }

  async getPatientMedications(patientId: string): Promise<FhirMedication[]> {
    const bundle = await this.searchResources<FhirMedication>("Medication", { patient: patientId });
    return (bundle.entry || []).map((e) => e.resource as FhirMedication);
  }

  async getPatientMedicationRequests(patientId: string): Promise<FhirMedicationRequest[]> {
    const bundle = await this.searchResources<FhirMedicationRequest>("MedicationRequest", { patient: patientId });
    return (bundle.entry || []).map((e) => e.resource as FhirMedicationRequest);
  }

  async getPatientDiagnosticReports(patientId: string): Promise<FhirDiagnosticReport[]> {
    const bundle = await this.searchResources<FhirDiagnosticReport>("DiagnosticReport", { patient: patientId });
    return (bundle.entry || []).map((e) => e.resource as FhirDiagnosticReport);
  }

  async getPatientImmunizations(patientId: string): Promise<FhirImmunization[]> {
    const bundle = await this.searchResources<FhirImmunization>("Immunization", { patient: patientId });
    return (bundle.entry || []).map((e) => e.resource as FhirImmunization);
  }

  async getPatientProcedures(patientId: string): Promise<FhirProcedure[]> {
    const bundle = await this.searchResources<FhirProcedure>("Procedure", { patient: patientId });
    return (bundle.entry || []).map((e) => e.resource as FhirProcedure);
  }

  async getPatientCarePlans(patientId: string): Promise<FhirCarePlan[]> {
    const bundle = await this.searchResources<FhirCarePlan>("CarePlan", { patient: patientId });
    return (bundle.entry || []).map((e) => e.resource as FhirCarePlan);
  }

  async getPatientAllergies(patientId: string): Promise<FhirAllergyIntolerance[]> {
    const bundle = await this.searchResources<FhirAllergyIntolerance>("AllergyIntolerance", { patient: patientId });
    return (bundle.entry || []).map((e) => e.resource as FhirAllergyIntolerance);
  }

  async getPatientEncounters(patientId: string): Promise<FhirEncounter[]> {
    const bundle = await this.searchResources<FhirEncounter>("Encounter", { patient: patientId });
    return (bundle.entry || []).map((e) => e.resource as FhirEncounter);
  }

  async getPatientMedicationStatements(patientId: string): Promise<FhirMedicationStatement[]> {
    const bundle = await this.searchResources<FhirMedicationStatement>("MedicationStatement", { patient: patientId });
    return (bundle.entry || []).map((e) => e.resource as FhirMedicationStatement);
  }

  async getPatientTimeline(patientId: string): Promise<Array<{
    id: string;
    type: "encounter" | "observation" | "medication" | "procedure" | "condition" | "immunization" | "diagnostic_report";
    date: string;
    title: string;
    description?: string;
    category?: string;
    status?: string;
    provider?: string;
    resource: FhirResource;
  }>> {
    const [encounters, observations, medications, procedures, conditions, immunizations, diagnosticReports] = await Promise.all([
      this.getPatientEncounters(patientId),
      this.getPatientObservations(patientId),
      this.getPatientMedicationRequests(patientId),
      this.getPatientProcedures(patientId),
      this.getPatientConditions(patientId),
      this.getPatientImmunizations(patientId),
      this.getPatientDiagnosticReports(patientId),
    ]);

    const timeline: Array<{
      id: string;
      type: "encounter" | "observation" | "medication" | "procedure" | "condition" | "immunization" | "diagnostic_report";
      date: string;
      title: string;
      description?: string;
      category?: string;
      status?: string;
      provider?: string;
      resource: FhirResource;
    }> = [];

    encounters.forEach((e) => {
      timeline.push({
        id: e.id,
        type: "encounter",
        date: e.period?.start || new Date().toISOString(),
        title: e.type?.[0]?.text || e.type?.[0]?.coding?.[0]?.display || "Encounter",
        description: e.reasonCode?.[0]?.text || e.reasonCode?.[0]?.coding?.[0]?.display,
        category: e.class?.display || e.class?.code,
        status: e.status,
        provider: e.serviceProvider?.display,
        resource: e,
      });
    });

    observations.forEach((o) => {
      timeline.push({
        id: o.id,
        type: "observation",
        date: o.effectiveDateTime || new Date().toISOString(),
        title: o.code?.text || o.code?.coding?.[0]?.display || "Observation",
        description: o.valueQuantity ? `${o.valueQuantity.value} ${o.valueQuantity.unit}` : undefined,
        category: o.category?.[0]?.coding?.[0]?.display,
        status: o.status,
        resource: o,
      });
    });

    medications.forEach((m) => {
      timeline.push({
        id: m.id,
        type: "medication",
        date: m.authoredOn || new Date().toISOString(),
        title: m.medicationCodeableConcept?.text || m.medicationCodeableConcept?.coding?.[0]?.display || "Medication",
        description: m.dosageInstruction?.[0]?.text,
        status: m.status,
        resource: m,
      });
    });

    procedures.forEach((p) => {
      timeline.push({
        id: p.id,
        type: "procedure",
        date: p.performedDateTime || p.performedPeriod?.start || new Date().toISOString(),
        title: p.code?.text || p.code?.coding?.[0]?.display || "Procedure",
        status: p.status,
        resource: p,
      });
    });

    conditions.forEach((c) => {
      timeline.push({
        id: c.id,
        type: "condition",
        date: c.onsetDateTime || c.recordedDate || new Date().toISOString(),
        title: c.code?.text || c.code?.coding?.[0]?.display || "Condition",
        status: c.clinicalStatus?.coding?.[0]?.code,
        resource: c,
      });
    });

    immunizations.forEach((i) => {
      timeline.push({
        id: i.id,
        type: "immunization",
        date: i.occurrenceDateTime || new Date().toISOString(),
        title: i.vaccineCode?.text || i.vaccineCode?.coding?.[0]?.display || "Immunization",
        status: i.status,
        resource: i,
      });
    });

    diagnosticReports.forEach((d) => {
      timeline.push({
        id: d.id,
        type: "diagnostic_report",
        date: d.effectiveDateTime || d.issued || new Date().toISOString(),
        title: d.code?.text || d.code?.coding?.[0]?.display || "Diagnostic Report",
        description: d.conclusion,
        status: d.status,
        resource: d,
      });
    });

    return timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}
