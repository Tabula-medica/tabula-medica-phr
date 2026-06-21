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
import { healthcare } from "@googleapis/healthcare";
import { GoogleAuth } from "google-auth-library";

export class CloudHealthcareApiFhirStore implements IFhirStore {
  readonly providerName = "cloud_healthcare_api";
  private _isConnected = false;
  private healthcareClient: any = null;
  private auth: GoogleAuth | null = null;
  private fhirStorePath: string = "";
  private config: IntegrationConfig;

  constructor(config: IntegrationConfig) {
    this.config = config;
    if (config.gcp) {
      const { projectId, location, datasetId, fhirStoreId } = config.gcp;
      this.fhirStorePath = `projects/${projectId}/locations/${location}/datasets/${datasetId}/fhirStores/${fhirStoreId}`;
    }
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(): Promise<void> {
    try {
      this.auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
        ...(this.config.gcp?.credentialsPath && {
          keyFile: this.config.gcp.credentialsPath,
        }),
      });

      this.healthcareClient = healthcare({
        version: "v1",
        auth: this.auth,
      });

      await this.healthCheck();
      this._isConnected = true;
      console.log(`[CloudHealthcareApi] Connected to FHIR store: ${this.fhirStorePath}`);
    } catch (error) {
      console.error("[CloudHealthcareApi] Connection failed:", error);
      throw new Error(`Failed to connect to Cloud Healthcare API: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    this.healthcareClient = null;
    this.auth = null;
    this._isConnected = false;
    console.log("[CloudHealthcareApi] Disconnected from FHIR store");
  }

  async healthCheck(): Promise<{ status: "healthy" | "unhealthy"; latencyMs: number; message?: string }> {
    const start = Date.now();
    try {
      if (!this.healthcareClient) {
        return { status: "unhealthy", latencyMs: 0, message: "Client not initialized" };
      }

      await this.healthcareClient.projects.locations.datasets.fhirStores.get({
        name: this.fhirStorePath,
      });

      return {
        status: "healthy",
        latencyMs: Date.now() - start,
        message: "Cloud Healthcare API FHIR store is accessible",
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
    if (!this.healthcareClient) throw new Error("Not connected");

    const response = await this.healthcareClient.projects.locations.datasets.fhirStores.fhir.create({
      parent: this.fhirStorePath,
      type: resourceType,
      requestBody: resource as any,
    });

    return response.data as T;
  }

  async readResource<T extends FhirResource>(resourceType: string, id: string): Promise<T | null> {
    if (!this.healthcareClient) throw new Error("Not connected");

    try {
      const response = await this.healthcareClient.projects.locations.datasets.fhirStores.fhir.read({
        name: `${this.fhirStorePath}/fhir/${resourceType}/${id}`,
      });
      return response.data as T;
    } catch (error: any) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async updateResource<T extends FhirResource>(resourceType: string, id: string, resource: T): Promise<T> {
    if (!this.healthcareClient) throw new Error("Not connected");

    const response = await this.healthcareClient.projects.locations.datasets.fhirStores.fhir.update({
      name: `${this.fhirStorePath}/fhir/${resourceType}/${id}`,
      requestBody: { ...resource, id } as any,
    });

    return response.data as T;
  }

  async deleteResource(resourceType: string, id: string): Promise<boolean> {
    if (!this.healthcareClient) throw new Error("Not connected");

    try {
      await this.healthcareClient.projects.locations.datasets.fhirStores.fhir.delete({
        name: `${this.fhirStorePath}/fhir/${resourceType}/${id}`,
      });
      return true;
    } catch (error: any) {
      if (error.code === 404) return false;
      throw error;
    }
  }

  async searchResources<T extends FhirResource>(resourceType: string, params: FhirSearchParams): Promise<FhirBundle> {
    if (!this.healthcareClient) throw new Error("Not connected");

    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach((v) => searchParams.append(key, String(v)));
        } else {
          searchParams.set(key, String(value));
        }
      }
    });

    const response = await this.healthcareClient.projects.locations.datasets.fhirStores.fhir.search({
      parent: this.fhirStorePath,
      resourceType,
      requestBody: {},
    });

    return response.data as FhirBundle;
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

  async exportToBigQuery(datasetId: string, tablePrefix: string): Promise<{ jobId: string; status: string }> {
    if (!this.healthcareClient || !this.config.gcp) {
      throw new Error("Not connected or GCP config missing");
    }

    const response = await this.healthcareClient.projects.locations.datasets.fhirStores.export({
      name: this.fhirStorePath,
      requestBody: {
        bigqueryDestination: {
          datasetUri: `bq://${this.config.gcp.projectId}.${datasetId}`,
          schemaConfig: {
            schemaType: "ANALYTICS",
          },
        },
      },
    });

    return {
      jobId: response.data.name || "unknown",
      status: "started",
    };
  }
}
