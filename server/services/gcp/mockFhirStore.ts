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
} from "../integrations/interfaces";
import { randomUUID } from "crypto";

export class MockFhirStore implements IFhirStore {
  readonly providerName = "mock";
  private _isConnected = false;
  private resources: Map<string, Map<string, FhirResource>> = new Map();

  get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(): Promise<void> {
    this._isConnected = true;
    this.initializeMockData();
    console.log("[MockFhirStore] Connected to mock FHIR store");
  }

  async disconnect(): Promise<void> {
    this._isConnected = false;
    console.log("[MockFhirStore] Disconnected from mock FHIR store");
  }

  async healthCheck(): Promise<{ status: "healthy" | "unhealthy"; latencyMs: number; message?: string }> {
    const start = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 5));
    return {
      status: this._isConnected ? "healthy" : "unhealthy",
      latencyMs: Date.now() - start,
      message: this._isConnected ? "Mock FHIR store is operational" : "Not connected",
    };
  }

  async createResource<T extends FhirResource>(resourceType: string, resource: T): Promise<T> {
    if (!this.resources.has(resourceType)) {
      this.resources.set(resourceType, new Map());
    }
    const id = resource.id || randomUUID();
    const newResource = { ...resource, id } as T;
    this.resources.get(resourceType)!.set(id, newResource);
    return newResource;
  }

  async readResource<T extends FhirResource>(resourceType: string, id: string): Promise<T | null> {
    const typeResources = this.resources.get(resourceType);
    if (!typeResources) return null;
    return (typeResources.get(id) as T) || null;
  }

  async updateResource<T extends FhirResource>(resourceType: string, id: string, resource: T): Promise<T> {
    if (!this.resources.has(resourceType)) {
      this.resources.set(resourceType, new Map());
    }
    const updated = { ...resource, id } as T;
    this.resources.get(resourceType)!.set(id, updated);
    return updated;
  }

  async deleteResource(resourceType: string, id: string): Promise<boolean> {
    const typeResources = this.resources.get(resourceType);
    if (!typeResources) return false;
    return typeResources.delete(id);
  }

  async searchResources<T extends FhirResource>(resourceType: string, params: FhirSearchParams): Promise<FhirBundle> {
    const typeResources = this.resources.get(resourceType);
    if (!typeResources) {
      return { resourceType: "Bundle", type: "searchset", total: 0, entry: [] };
    }

    let resources = Array.from(typeResources.values()) as T[];

    if (params.patient || params.subject) {
      const patientRef = params.patient || params.subject;
      resources = resources.filter((r) => {
        const ref = (r as any).subject?.reference || (r as any).patient?.reference;
        return ref === `Patient/${patientRef}` || ref === patientRef;
      });
    }

    if (params.category) {
      resources = resources.filter((r) => {
        const categories = (r as any).category || [];
        return categories.some((cat: any) =>
          cat.coding?.some((c: any) => c.code === params.category)
        );
      });
    }

    const offset = params._offset || 0;
    const count = params._count || 100;
    const paged = resources.slice(offset, offset + count);

    return {
      resourceType: "Bundle",
      type: "searchset",
      total: resources.length,
      entry: paged.map((resource) => ({
        resource: resource as FhirResource,
        fullUrl: `${resourceType}/${(resource as any).id}`,
      })),
    };
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

  private initializeMockData(): void {
    const patientId = "mock-patient-1";
    
    this.createResource<FhirPatient>("Patient", {
      resourceType: "Patient",
      id: patientId,
      name: [{ family: "Smith", given: ["John", "Michael"], use: "official" }],
      birthDate: "1975-03-15",
      gender: "male",
      telecom: [
        { system: "phone", value: "(555) 123-4567", use: "home" },
        { system: "email", value: "john.smith@email.com", use: "home" },
      ],
      address: [{ line: ["123 Main St"], city: "Springfield", state: "IL", postalCode: "62701" }],
      maritalStatus: { coding: [{ code: "M", display: "Married" }] },
      contact: [{ 
        relationship: [{ coding: [{ code: "C", display: "Emergency Contact" }] }],
        name: { family: "Smith", given: ["Jane"] },
        telecom: [{ system: "phone", value: "(555) 987-6543" }],
      }],
    });

    const patient2Id = "mock-patient-2";
    this.createResource<FhirPatient>("Patient", {
      resourceType: "Patient",
      id: patient2Id,
      name: [{ family: "Johnson", given: ["Emily", "Rose"], use: "official" }],
      birthDate: "1988-07-22",
      gender: "female",
      telecom: [
        { system: "phone", value: "(555) 234-5678", use: "mobile" },
        { system: "email", value: "emily.johnson@email.com", use: "home" },
      ],
      address: [{ line: ["456 Oak Avenue", "Apt 2B"], city: "Chicago", state: "IL", postalCode: "60601" }],
    });

    const patient3Id = "mock-patient-3";
    this.createResource<FhirPatient>("Patient", {
      resourceType: "Patient",
      id: patient3Id,
      name: [{ family: "Garcia", given: ["Carlos"], use: "official" }],
      birthDate: "1962-11-08",
      gender: "male",
      telecom: [
        { system: "phone", value: "(555) 345-6789", use: "home" },
      ],
      address: [{ line: ["789 Elm Street"], city: "Austin", state: "TX", postalCode: "78701" }],
    });

    const patient4Id = "mock-patient-4";
    this.createResource<FhirPatient>("Patient", {
      resourceType: "Patient",
      id: patient4Id,
      name: [{ family: "Patel", given: ["Priya"], use: "official" }],
      birthDate: "1995-02-14",
      gender: "female",
      telecom: [
        { system: "phone", value: "(555) 456-7890", use: "mobile" },
        { system: "email", value: "priya.patel@email.com", use: "work" },
      ],
      address: [{ line: ["321 Pine Road"], city: "San Francisco", state: "CA", postalCode: "94102" }],
    });

    this.createResource<FhirObservation>("Observation", {
      resourceType: "Observation",
      id: "obs-bp-1",
      status: "final",
      code: { coding: [{ system: "http://loinc.org", code: "85354-9", display: "Blood pressure" }] },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: new Date().toISOString(),
      category: [{ coding: [{ code: "vital-signs", display: "Vital Signs" }] }],
    });

    this.createResource<FhirObservation>("Observation", {
      resourceType: "Observation",
      id: "obs-hr-1",
      status: "final",
      code: { coding: [{ system: "http://loinc.org", code: "8867-4", display: "Heart rate" }] },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: new Date().toISOString(),
      valueQuantity: { value: 72, unit: "bpm" },
      category: [{ coding: [{ code: "vital-signs", display: "Vital Signs" }] }],
    });

    this.createResource<FhirCondition>("Condition", {
      resourceType: "Condition",
      id: "cond-htn-1",
      clinicalStatus: { coding: [{ code: "active" }] },
      verificationStatus: { coding: [{ code: "confirmed" }] },
      code: { coding: [{ system: "http://snomed.info/sct", code: "38341003", display: "Hypertension" }], text: "Hypertension" },
      subject: { reference: `Patient/${patientId}` },
      onsetDateTime: "2018-06-15",
    });

    this.createResource<FhirMedicationRequest>("MedicationRequest", {
      resourceType: "MedicationRequest",
      id: "medrq-1",
      status: "active",
      intent: "order",
      medicationCodeableConcept: { coding: [{ code: "310965", display: "Lisinopril 10mg" }], text: "Lisinopril 10mg" },
      subject: { reference: `Patient/${patientId}` },
      authoredOn: "2024-01-15",
      dosageInstruction: [{ text: "Take one tablet daily" }],
    });

    this.createResource<FhirImmunization>("Immunization", {
      resourceType: "Immunization",
      id: "imm-1",
      status: "completed",
      vaccineCode: { coding: [{ system: "http://hl7.org/fhir/sid/cvx", code: "158", display: "Influenza vaccine" }] },
      patient: { reference: `Patient/${patientId}` },
      occurrenceDateTime: "2024-10-01",
    });

    this.createResource<FhirEncounter>("Encounter", {
      resourceType: "Encounter",
      id: "enc-1",
      status: "finished",
      class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "Ambulatory" },
      type: [{ coding: [{ code: "office-visit", display: "Office Visit" }], text: "Annual Wellness Visit" }],
      subject: { reference: `Patient/${patientId}` },
      period: { start: "2024-01-15T09:00:00Z", end: "2024-01-15T09:45:00Z" },
      reasonCode: [{ text: "Annual checkup and blood pressure monitoring" }],
      serviceProvider: { display: "Springfield Family Medicine" },
    });

    this.createResource<FhirEncounter>("Encounter", {
      resourceType: "Encounter",
      id: "enc-2",
      status: "finished",
      class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "EMER", display: "Emergency" },
      type: [{ coding: [{ code: "emergency", display: "Emergency Visit" }], text: "Emergency Department Visit" }],
      subject: { reference: `Patient/${patientId}` },
      period: { start: "2023-11-20T14:30:00Z", end: "2023-11-20T18:00:00Z" },
      reasonCode: [{ text: "Chest pain evaluation" }],
      serviceProvider: { display: "Memorial Hospital Emergency" },
    });

    this.createResource<FhirMedicationStatement>("MedicationStatement", {
      resourceType: "MedicationStatement",
      id: "medstmt-1",
      status: "active",
      medicationCodeableConcept: { coding: [{ code: "310965", display: "Lisinopril 10mg" }], text: "Lisinopril 10mg tablet" },
      subject: { reference: `Patient/${patientId}` },
      effectivePeriod: { start: "2024-01-15" },
      dateAsserted: "2024-01-15",
      dosage: [{ text: "Take one tablet by mouth once daily" }],
    });

    this.createResource<FhirDiagnosticReport>("DiagnosticReport", {
      resourceType: "DiagnosticReport",
      id: "diag-1",
      status: "final",
      code: { coding: [{ code: "58410-2", display: "Complete Blood Count" }], text: "CBC with Differential" },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: "2024-01-15T10:30:00Z",
      issued: "2024-01-15T14:00:00Z",
      conclusion: "All values within normal limits",
    });

    this.createResource<FhirProcedure>("Procedure", {
      resourceType: "Procedure",
      id: "proc-1",
      status: "completed",
      code: { coding: [{ code: "73761001", display: "Colonoscopy" }], text: "Colonoscopy screening" },
      subject: { reference: `Patient/${patientId}` },
      performedDateTime: "2023-06-10T08:00:00Z",
    });

    this.createResource<FhirAllergyIntolerance>("AllergyIntolerance", {
      resourceType: "AllergyIntolerance",
      id: "allergy-1",
      clinicalStatus: { coding: [{ code: "active" }] },
      verificationStatus: { coding: [{ code: "confirmed" }] },
      code: { coding: [{ code: "7980", display: "Penicillin" }], text: "Penicillin" },
      patient: { reference: `Patient/${patientId}` },
      onsetDateTime: "2010-03-01",
      reaction: [{ manifestation: [{ coding: [{ display: "Hives" }] }], severity: "moderate" }],
    });

    this.createResource<FhirObservation>("Observation", {
      resourceType: "Observation",
      id: "obs-glucose-1",
      status: "final",
      code: { coding: [{ system: "http://loinc.org", code: "2345-7", display: "Glucose [Mass/volume] in Serum or Plasma" }], text: "Blood Glucose" },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: "2025-12-15T08:30:00Z",
      valueQuantity: { value: 95, unit: "mg/dL" },
      category: [{ coding: [{ code: "laboratory", display: "Laboratory" }] }],
    });

    this.createResource<FhirObservation>("Observation", {
      resourceType: "Observation",
      id: "obs-cholesterol-1",
      status: "final",
      code: { coding: [{ system: "http://loinc.org", code: "2093-3", display: "Cholesterol [Mass/volume] in Serum or Plasma" }], text: "Total Cholesterol" },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: "2025-12-15T08:30:00Z",
      valueQuantity: { value: 198, unit: "mg/dL" },
      category: [{ coding: [{ code: "laboratory", display: "Laboratory" }] }],
    });

    this.createResource<FhirObservation>("Observation", {
      resourceType: "Observation",
      id: "obs-weight-1",
      status: "final",
      code: { coding: [{ system: "http://loinc.org", code: "29463-7", display: "Body Weight" }] },
      subject: { reference: `Patient/${patientId}` },
      effectiveDateTime: "2026-01-10T09:00:00Z",
      valueQuantity: { value: 185, unit: "lbs" },
      category: [{ coding: [{ code: "vital-signs", display: "Vital Signs" }] }],
    });

    this.createResource<FhirCondition>("Condition", {
      resourceType: "Condition",
      id: "cond-diabetes-2",
      clinicalStatus: { coding: [{ code: "active" }] },
      verificationStatus: { coding: [{ code: "confirmed" }] },
      code: { coding: [{ system: "http://snomed.info/sct", code: "44054006", display: "Type 2 Diabetes Mellitus" }], text: "Type 2 Diabetes" },
      subject: { reference: `Patient/${patient2Id}` },
      onsetDateTime: "2020-03-10",
    });

    this.createResource<FhirMedicationRequest>("MedicationRequest", {
      resourceType: "MedicationRequest",
      id: "medrq-2",
      status: "active",
      intent: "order",
      medicationCodeableConcept: { coding: [{ code: "860975", display: "Metformin 500mg" }], text: "Metformin 500mg tablet" },
      subject: { reference: `Patient/${patient2Id}` },
      authoredOn: "2025-06-01",
      dosageInstruction: [{ text: "Take one tablet twice daily with meals" }],
    });

    this.createResource<FhirObservation>("Observation", {
      resourceType: "Observation",
      id: "obs-a1c-2",
      status: "final",
      code: { coding: [{ system: "http://loinc.org", code: "4548-4", display: "Hemoglobin A1c" }], text: "HbA1c" },
      subject: { reference: `Patient/${patient2Id}` },
      effectiveDateTime: "2025-11-20T10:00:00Z",
      valueQuantity: { value: 6.8, unit: "%" },
      category: [{ coding: [{ code: "laboratory", display: "Laboratory" }] }],
    });

    this.createResource<FhirImmunization>("Immunization", {
      resourceType: "Immunization",
      id: "imm-2",
      status: "completed",
      vaccineCode: { coding: [{ system: "http://hl7.org/fhir/sid/cvx", code: "208", display: "COVID-19 vaccine" }] },
      patient: { reference: `Patient/${patient2Id}` },
      occurrenceDateTime: "2025-09-15",
    });

    this.createResource<FhirEncounter>("Encounter", {
      resourceType: "Encounter",
      id: "enc-3",
      status: "finished",
      class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "Ambulatory" },
      type: [{ coding: [{ code: "diabetes-checkup", display: "Diabetes Management" }], text: "Diabetes Follow-up" }],
      subject: { reference: `Patient/${patient2Id}` },
      period: { start: "2025-11-20T10:00:00Z", end: "2025-11-20T10:30:00Z" },
      reasonCode: [{ text: "Quarterly diabetes management review" }],
      serviceProvider: { display: "Chicago Endocrinology Associates" },
    });

    this.createResource<FhirCondition>("Condition", {
      resourceType: "Condition",
      id: "cond-copd-3",
      clinicalStatus: { coding: [{ code: "active" }] },
      verificationStatus: { coding: [{ code: "confirmed" }] },
      code: { coding: [{ system: "http://snomed.info/sct", code: "13645005", display: "COPD" }], text: "Chronic Obstructive Pulmonary Disease" },
      subject: { reference: `Patient/${patient3Id}` },
      onsetDateTime: "2015-08-20",
    });

    this.createResource<FhirCondition>("Condition", {
      resourceType: "Condition",
      id: "cond-afib-3",
      clinicalStatus: { coding: [{ code: "active" }] },
      verificationStatus: { coding: [{ code: "confirmed" }] },
      code: { coding: [{ system: "http://snomed.info/sct", code: "49436004", display: "Atrial Fibrillation" }], text: "Atrial Fibrillation" },
      subject: { reference: `Patient/${patient3Id}` },
      onsetDateTime: "2019-02-14",
    });

    this.createResource<FhirMedicationRequest>("MedicationRequest", {
      resourceType: "MedicationRequest",
      id: "medrq-3",
      status: "active",
      intent: "order",
      medicationCodeableConcept: { coding: [{ code: "855288", display: "Warfarin 5mg" }], text: "Warfarin 5mg tablet" },
      subject: { reference: `Patient/${patient3Id}` },
      authoredOn: "2025-01-10",
      dosageInstruction: [{ text: "Take one tablet daily at bedtime" }],
    });

    this.createResource<FhirMedicationRequest>("MedicationRequest", {
      resourceType: "MedicationRequest",
      id: "medrq-4",
      status: "active",
      intent: "order",
      medicationCodeableConcept: { coding: [{ code: "866514", display: "Albuterol Inhaler" }], text: "Albuterol 90mcg/actuation inhaler" },
      subject: { reference: `Patient/${patient3Id}` },
      authoredOn: "2025-03-15",
      dosageInstruction: [{ text: "2 puffs every 4-6 hours as needed for shortness of breath" }],
    });

    this.createResource<FhirObservation>("Observation", {
      resourceType: "Observation",
      id: "obs-inr-3",
      status: "final",
      code: { coding: [{ system: "http://loinc.org", code: "5894-1", display: "Prothrombin time (PT) INR" }], text: "INR" },
      subject: { reference: `Patient/${patient3Id}` },
      effectiveDateTime: "2026-01-05T09:00:00Z",
      valueQuantity: { value: 2.4, unit: "INR" },
      category: [{ coding: [{ code: "laboratory", display: "Laboratory" }] }],
    });

    this.createResource<FhirDiagnosticReport>("DiagnosticReport", {
      resourceType: "DiagnosticReport",
      id: "diag-2",
      status: "final",
      code: { coding: [{ code: "24323-8", display: "Comprehensive Metabolic Panel" }], text: "Comprehensive Metabolic Panel" },
      subject: { reference: `Patient/${patient3Id}` },
      effectiveDateTime: "2026-01-05T09:30:00Z",
      issued: "2026-01-05T14:00:00Z",
      conclusion: "Kidney function slightly reduced. Recommend follow-up in 3 months.",
    });

    this.createResource<FhirAllergyIntolerance>("AllergyIntolerance", {
      resourceType: "AllergyIntolerance",
      id: "allergy-2",
      clinicalStatus: { coding: [{ code: "active" }] },
      verificationStatus: { coding: [{ code: "confirmed" }] },
      code: { coding: [{ code: "2670", display: "Codeine" }], text: "Codeine" },
      patient: { reference: `Patient/${patient3Id}` },
      onsetDateTime: "2005-06-15",
      reaction: [{ manifestation: [{ coding: [{ display: "Nausea and vomiting" }] }], severity: "severe" }],
    });

    this.createResource<FhirObservation>("Observation", {
      resourceType: "Observation",
      id: "obs-bp-4",
      status: "final",
      code: { coding: [{ system: "http://loinc.org", code: "85354-9", display: "Blood pressure" }] },
      subject: { reference: `Patient/${patient4Id}` },
      effectiveDateTime: "2026-01-12T14:00:00Z",
      component: [
        { code: { coding: [{ code: "8480-6", display: "Systolic BP" }] }, valueQuantity: { value: 118, unit: "mmHg" } },
        { code: { coding: [{ code: "8462-4", display: "Diastolic BP" }] }, valueQuantity: { value: 76, unit: "mmHg" } },
      ],
      category: [{ coding: [{ code: "vital-signs", display: "Vital Signs" }] }],
    });

    this.createResource<FhirCondition>("Condition", {
      resourceType: "Condition",
      id: "cond-anxiety-4",
      clinicalStatus: { coding: [{ code: "active" }] },
      verificationStatus: { coding: [{ code: "confirmed" }] },
      code: { coding: [{ system: "http://snomed.info/sct", code: "48694002", display: "Generalized Anxiety Disorder" }], text: "Anxiety Disorder" },
      subject: { reference: `Patient/${patient4Id}` },
      onsetDateTime: "2022-09-01",
    });

    this.createResource<FhirMedicationRequest>("MedicationRequest", {
      resourceType: "MedicationRequest",
      id: "medrq-5",
      status: "active",
      intent: "order",
      medicationCodeableConcept: { coding: [{ code: "311354", display: "Sertraline 50mg" }], text: "Sertraline 50mg tablet" },
      subject: { reference: `Patient/${patient4Id}` },
      authoredOn: "2025-10-01",
      dosageInstruction: [{ text: "Take one tablet daily in the morning" }],
    });

    this.createResource<FhirImmunization>("Immunization", {
      resourceType: "Immunization",
      id: "imm-3",
      status: "completed",
      vaccineCode: { coding: [{ system: "http://hl7.org/fhir/sid/cvx", code: "115", display: "Tdap vaccine" }] },
      patient: { reference: `Patient/${patient4Id}` },
      occurrenceDateTime: "2024-05-10",
    });

    this.createResource<FhirEncounter>("Encounter", {
      resourceType: "Encounter",
      id: "enc-4",
      status: "finished",
      class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "Ambulatory" },
      type: [{ coding: [{ code: "annual-exam", display: "Annual Physical" }], text: "Annual Wellness Exam" }],
      subject: { reference: `Patient/${patient4Id}` },
      period: { start: "2025-10-01T09:00:00Z", end: "2025-10-01T09:45:00Z" },
      reasonCode: [{ text: "Annual physical examination and anxiety follow-up" }],
      serviceProvider: { display: "Bay Area Primary Care" },
    });

    this.createResource<FhirProcedure>("Procedure", {
      resourceType: "Procedure",
      id: "proc-2",
      status: "completed",
      code: { coding: [{ code: "241620005", display: "Knee Arthroscopy" }], text: "Left knee arthroscopy" },
      subject: { reference: `Patient/${patient2Id}` },
      performedDateTime: "2024-08-15T10:00:00Z",
    });

    this.createResource<FhirCarePlan>("CarePlan", {
      resourceType: "CarePlan",
      id: "careplan-1",
      status: "active",
      intent: "plan",
      title: "Hypertension Management Plan",
      description: "Comprehensive care plan for managing hypertension including medication, diet, and exercise",
      subject: { reference: `Patient/${patientId}` },
      period: { start: "2025-01-15" },
      category: [{ coding: [{ code: "assess-plan", display: "Assessment and Plan" }] }],
      activity: [
        { detail: { description: "Monitor blood pressure daily", status: "in-progress" } },
        { detail: { description: "Low sodium diet", status: "in-progress" } },
        { detail: { description: "30 minutes moderate exercise 5 days/week", status: "in-progress" } },
      ],
    });

    this.createResource<FhirCarePlan>("CarePlan", {
      resourceType: "CarePlan",
      id: "careplan-2",
      status: "active",
      intent: "plan",
      title: "Diabetes Management Plan",
      description: "Type 2 diabetes management with medication, diet control, and regular monitoring",
      subject: { reference: `Patient/${patient2Id}` },
      period: { start: "2025-06-01" },
      category: [{ coding: [{ code: "assess-plan", display: "Assessment and Plan" }] }],
      activity: [
        { detail: { description: "Check blood glucose before meals", status: "in-progress" } },
        { detail: { description: "Take Metformin as prescribed", status: "in-progress" } },
        { detail: { description: "HbA1c test every 3 months", status: "scheduled" } },
      ],
    });

    console.log("[MockFhirStore] Initialized with comprehensive sample patient data for 4 patients");
  }
}
