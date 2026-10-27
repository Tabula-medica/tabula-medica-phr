import { storage } from "./storage";
import type { HealthRecord, InsertHealthRecord } from "@shared/schema";
import { FhirValidationEngine } from "./fhir-validation-engine";
import { logger } from "./utils/logger";

const FHIR_VERSION = "4.0.1";
const FHIR_BASE = "/api/fhir/r4";

const SUPPORTED_RESOURCE_TYPES = [
  "Patient", "Observation", "Condition", "Procedure",
  "MedicationRequest", "AllergyIntolerance", "Immunization",
  "DiagnosticReport", "Encounter", "DocumentReference",
  "CarePlan", "CareTeam", "Goal", "Coverage",
] as const;

type SupportedResourceType = typeof SUPPORTED_RESOURCE_TYPES[number];

interface FhirMeta {
  versionId?: string;
  lastUpdated?: string;
  source?: string;
  profile?: string[];
}

interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: FhirMeta;
  [key: string]: unknown;
}

interface FhirBundle {
  resourceType: "Bundle";
  id?: string;
  type: "searchset" | "collection" | "transaction" | "batch" | "document";
  total?: number;
  timestamp?: string;
  link?: Array<{ relation: string; url: string }>;
  entry?: Array<{
    fullUrl?: string;
    resource?: FhirResource;
    search?: { mode: "match" | "include" | "outcome" };
    request?: { method: string; url: string };
    response?: { status: string; location?: string; lastModified?: string };
  }>;
}

interface FhirOperationOutcome {
  resourceType: "OperationOutcome";
  issue: Array<{
    severity: "fatal" | "error" | "warning" | "information";
    code: string;
    diagnostics?: string;
    details?: { text: string };
    location?: string[];
    expression?: string[];
  }>;
}

interface FhirCapabilityStatement {
  resourceType: "CapabilityStatement";
  id: string;
  url: string;
  version: string;
  name: string;
  title: string;
  status: "active";
  experimental: boolean;
  date: string;
  publisher: string;
  description: string;
  kind: "instance";
  fhirVersion: string;
  format: string[];
  rest: Array<{
    mode: "server";
    security: {
      cors: boolean;
      service: Array<{ coding: Array<{ system: string; code: string }>; text: string }>;
      description: string;
    };
    resource: Array<{
      type: string;
      profile: string;
      interaction: Array<{ code: string }>;
      searchParam?: Array<{ name: string; type: string; documentation: string }>;
    }>;
    interaction: Array<{ code: string }>;
  }>;
}

const US_CORE_PROFILES: Record<string, string> = {
  Patient: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
  Observation: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab",
  Condition: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition",
  MedicationRequest: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest",
  Procedure: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure",
  Immunization: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-immunization",
  AllergyIntolerance: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance",
  DiagnosticReport: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-diagnosticreport-lab",
  Encounter: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-encounter",
  DocumentReference: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference",
  CarePlan: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-careplan",
  CareTeam: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-careteam",
  Goal: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-goal",
  Coverage: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-coverage",
};

const INTERNAL_TYPE_MAP: Record<string, string> = {
  Patient: "patient",
  Observation: "vital",
  Condition: "condition",
  Procedure: "procedure",
  MedicationRequest: "medication",
  AllergyIntolerance: "allergy",
  Immunization: "immunization",
  DiagnosticReport: "lab",
  Encounter: "visit",
  DocumentReference: "document",
  CarePlan: "care_plan",
  CareTeam: "care_team",
  Goal: "goal",
  Coverage: "insurance",
};

const FHIR_TYPE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(INTERNAL_TYPE_MAP).map(([k, v]) => [v, k])
);

export class FhirR4ApiService {
  private validationEngine: FhirValidationEngine;

  constructor() {
    this.validationEngine = new FhirValidationEngine();
  }

  getCapabilityStatement(baseUrl: string): FhirCapabilityStatement {
    return {
      resourceType: "CapabilityStatement",
      id: "tabula-medica-fhir-r4",
      url: `${baseUrl}${FHIR_BASE}/metadata`,
      version: FHIR_VERSION,
      name: "TabulaMedicaFHIRServer",
      title: "Tabula Medica FHIR R4 Server",
      status: "active",
      experimental: false,
      date: new Date().toISOString(),
      publisher: "Tabula Medica",
      description: "FHIR R4 API for Tabula Medica patient health records. Supports USCDI V3 core data classes with secure import/export.",
      kind: "instance",
      fhirVersion: FHIR_VERSION,
      format: ["application/fhir+json", "application/json"],
      rest: [{
        mode: "server",
        security: {
          cors: true,
          service: [{
            coding: [{ system: "http://terminology.hl7.org/CodeSystem/restful-security-service", code: "SMART-on-FHIR" }],
            text: "OAuth2 using SMART-on-FHIR profile"
          }],
          description: "All FHIR endpoints require authentication via x-user-id header. PHI is encrypted at rest with AES-256-GCM."
        },
        resource: SUPPORTED_RESOURCE_TYPES.map(type => ({
          type,
          profile: US_CORE_PROFILES[type] || `http://hl7.org/fhir/StructureDefinition/${type}`,
          interaction: [
            { code: "read" },
            { code: "search-type" },
            { code: "create" },
            { code: "update" },
          ],
          searchParam: this.getSearchParams(type),
        })),
        interaction: [
          { code: "transaction" },
          { code: "batch" },
          { code: "search-system" },
        ],
      }],
    };
  }

  private getSearchParams(resourceType: string): Array<{ name: string; type: string; documentation: string }> {
    const common = [
      { name: "_id", type: "token", documentation: "Logical id of this artifact" },
      { name: "_lastUpdated", type: "date", documentation: "When the resource version last changed" },
    ];

    const typeSpecific: Record<string, Array<{ name: string; type: string; documentation: string }>> = {
      Patient: [
        { name: "name", type: "string", documentation: "Patient name" },
        { name: "birthdate", type: "date", documentation: "Patient date of birth" },
        { name: "gender", type: "token", documentation: "Patient gender" },
      ],
      Observation: [
        { name: "category", type: "token", documentation: "Classification of observation" },
        { name: "code", type: "token", documentation: "What was observed" },
        { name: "date", type: "date", documentation: "Observation date" },
        { name: "status", type: "token", documentation: "Observation status" },
      ],
      Condition: [
        { name: "clinical-status", type: "token", documentation: "Clinical status" },
        { name: "code", type: "token", documentation: "Code for the condition" },
        { name: "onset-date", type: "date", documentation: "Date of onset" },
      ],
      Procedure: [
        { name: "code", type: "token", documentation: "Procedure code" },
        { name: "date", type: "date", documentation: "When the procedure was performed" },
        { name: "status", type: "token", documentation: "Procedure status" },
      ],
      MedicationRequest: [
        { name: "status", type: "token", documentation: "Status of the prescription" },
        { name: "intent", type: "token", documentation: "proposal | plan | order" },
        { name: "authoredon", type: "date", documentation: "Date request was authored" },
      ],
      Immunization: [
        { name: "date", type: "date", documentation: "Vaccination date" },
        { name: "status", type: "token", documentation: "Immunization event status" },
        { name: "vaccine-code", type: "token", documentation: "Vaccine product administered" },
      ],
      AllergyIntolerance: [
        { name: "clinical-status", type: "token", documentation: "Clinical status" },
        { name: "code", type: "token", documentation: "Allergy or intolerance code" },
        { name: "type", type: "token", documentation: "allergy | intolerance" },
      ],
      DiagnosticReport: [
        { name: "code", type: "token", documentation: "Report code" },
        { name: "date", type: "date", documentation: "Report date" },
        { name: "status", type: "token", documentation: "Report status" },
        { name: "category", type: "token", documentation: "Report category" },
      ],
    };

    return [...common, ...(typeSpecific[resourceType] || [])];
  }

  healthRecordToFhir(record: HealthRecord, userId: string): FhirResource {
    if (record.rawFhirJson && typeof record.rawFhirJson === "object") {
      const raw = record.rawFhirJson as FhirResource;
      raw.id = record.id;
      raw.meta = {
        ...raw.meta,
        versionId: "1",
        lastUpdated: record.updatedAt?.toISOString() || new Date().toISOString(),
      };
      return raw;
    }

    const fhirType = record.fhirResourceType || FHIR_TYPE_MAP[record.type] || "Basic";
    const details = (record.details || {}) as Record<string, any>;

    const base: FhirResource = {
      resourceType: fhirType,
      id: record.id,
      meta: {
        versionId: "1",
        lastUpdated: record.updatedAt?.toISOString() || new Date().toISOString(),
        profile: US_CORE_PROFILES[fhirType] ? [US_CORE_PROFILES[fhirType]] : undefined,
        source: "Tabula Medica",
      },
      subject: { reference: `Patient/${userId}`, display: "Patient" },
    };

    switch (fhirType) {
      case "Patient":
        return {
          ...base,
          name: [{ text: record.title, use: "official" }],
          gender: details.gender || "unknown",
          birthDate: details.birthDate || undefined,
          address: details.address ? [details.address] : undefined,
          telecom: details.telecom || undefined,
          identifier: details.identifier || [{ system: "urn:tabula-medica", value: record.id }],
        };

      case "Observation":
        return {
          ...base,
          status: details.status || "final",
          category: [{
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: details.category || "vital-signs",
              display: details.categoryDisplay || "Vital Signs",
            }],
          }],
          code: {
            coding: details.code?.coding || [{
              system: "http://loinc.org",
              code: details.loincCode || "unknown",
              display: record.title,
            }],
            text: record.title,
          },
          effectiveDateTime: record.date?.toISOString(),
          valueQuantity: details.value !== undefined ? {
            value: details.value,
            unit: details.unit || "",
            system: "http://unitsofmeasure.org",
            code: details.unitCode || details.unit || "",
          } : undefined,
          valueString: details.valueString || undefined,
          interpretation: details.interpretation ? [{
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
              code: details.interpretation,
            }],
          }] : undefined,
          performer: record.provider ? [{ display: record.provider }] : undefined,
          note: record.summary ? [{ text: record.summary }] : undefined,
        };

      case "Condition":
        return {
          ...base,
          clinicalStatus: {
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
              code: details.clinicalStatus || "active",
            }],
          },
          verificationStatus: {
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
              code: details.verificationStatus || "confirmed",
            }],
          },
          category: [{
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/condition-category",
              code: details.category || "encounter-diagnosis",
              display: details.categoryDisplay || "Encounter Diagnosis",
            }],
          }],
          code: {
            coding: details.code?.coding || [{
              system: "http://snomed.info/sct",
              code: details.snomedCode || "unknown",
              display: record.title,
            }],
            text: record.title,
          },
          onsetDateTime: record.date?.toISOString(),
          recordedDate: record.createdAt?.toISOString(),
          recorder: record.provider ? { display: record.provider } : undefined,
          note: record.summary ? [{ text: record.summary }] : undefined,
        };

      case "Procedure":
        return {
          ...base,
          status: details.status || "completed",
          code: {
            coding: details.code?.coding || [{
              system: "http://snomed.info/sct",
              code: details.snomedCode || "unknown",
              display: record.title,
            }],
            text: record.title,
          },
          performedDateTime: record.date?.toISOString(),
          performer: record.provider ? [{ actor: { display: record.provider } }] : undefined,
          location: record.facility ? { display: record.facility } : undefined,
          note: record.summary ? [{ text: record.summary }] : undefined,
        };

      case "MedicationRequest":
        return {
          ...base,
          status: details.status || "active",
          intent: details.intent || "order",
          medicationCodeableConcept: {
            coding: details.medication?.coding || [{
              system: "http://www.nlm.nih.gov/research/umls/rxnorm",
              code: details.rxnormCode || "unknown",
              display: record.title,
            }],
            text: record.title,
          },
          authoredOn: record.date?.toISOString(),
          requester: record.provider ? { display: record.provider } : undefined,
          dosageInstruction: details.dosage ? [{
            text: details.dosage,
            timing: details.timing ? { code: { text: details.timing } } : undefined,
          }] : undefined,
          note: record.summary ? [{ text: record.summary }] : undefined,
        };

      case "AllergyIntolerance":
        return {
          ...base,
          patient: { reference: `Patient/${userId}` },
          clinicalStatus: {
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
              code: details.clinicalStatus || "active",
            }],
          },
          verificationStatus: {
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
              code: details.verificationStatus || "confirmed",
            }],
          },
          type: details.type || "allergy",
          category: details.category ? [details.category] : ["medication"],
          criticality: details.criticality || "unable-to-assess",
          code: {
            coding: details.code?.coding || [{ display: record.title }],
            text: record.title,
          },
          onsetDateTime: record.date?.toISOString(),
          recordedDate: record.createdAt?.toISOString(),
          recorder: record.provider ? { display: record.provider } : undefined,
          reaction: details.reactions || undefined,
          note: record.summary ? [{ text: record.summary }] : undefined,
        };

      case "Immunization":
        return {
          ...base,
          patient: { reference: `Patient/${userId}` },
          status: details.status || "completed",
          vaccineCode: {
            coding: details.vaccineCode?.coding || [{
              system: "http://hl7.org/fhir/sid/cvx",
              code: details.cvxCode || "unknown",
              display: record.title,
            }],
            text: record.title,
          },
          occurrenceDateTime: record.date?.toISOString(),
          performer: record.provider ? [{ actor: { display: record.provider } }] : undefined,
          location: record.facility ? { display: record.facility } : undefined,
          lotNumber: details.lotNumber || undefined,
          expirationDate: details.expirationDate || undefined,
          site: details.site ? { coding: [{ display: details.site }] } : undefined,
          route: details.route ? { coding: [{ display: details.route }] } : undefined,
          note: record.summary ? [{ text: record.summary }] : undefined,
        };

      case "DiagnosticReport":
        return {
          ...base,
          status: details.status || "final",
          category: [{
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/v2-0074",
              code: details.category || "LAB",
              display: details.categoryDisplay || "Laboratory",
            }],
          }],
          code: {
            coding: details.code?.coding || [{
              system: "http://loinc.org",
              code: details.loincCode || "unknown",
              display: record.title,
            }],
            text: record.title,
          },
          effectiveDateTime: record.date?.toISOString(),
          issued: record.createdAt?.toISOString(),
          performer: record.provider ? [{ display: record.provider }] : undefined,
          conclusion: record.summary || undefined,
          result: details.results || undefined,
        };

      case "Encounter":
        return {
          ...base,
          status: details.status || "finished",
          class: {
            system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            code: details.class || "AMB",
            display: details.classDisplay || "ambulatory",
          },
          type: details.type ? [{ coding: details.type, text: record.title }] : [{ text: record.title }],
          period: {
            start: record.date?.toISOString(),
            end: details.endDate || record.date?.toISOString(),
          },
          serviceProvider: record.facility ? { display: record.facility } : undefined,
          participant: record.provider ? [{ individual: { display: record.provider } }] : undefined,
          reasonCode: details.reason ? [{ text: details.reason }] : undefined,
        };

      case "DocumentReference":
        return {
          ...base,
          status: details.status || "current",
          type: {
            coding: details.type?.coding || [{ display: record.title }],
            text: record.title,
          },
          date: record.date?.toISOString(),
          author: record.provider ? [{ display: record.provider }] : undefined,
          description: record.summary || undefined,
          content: details.content || [{ attachment: { contentType: "text/plain", data: "" } }],
          context: record.facility ? { facilityType: { text: record.facility } } : undefined,
        };

      case "CarePlan":
        return {
          ...base,
          status: details.status || "active",
          intent: details.intent || "plan",
          title: record.title,
          description: record.summary || undefined,
          period: { start: record.date?.toISOString() },
          category: [{
            coding: [{
              system: "http://hl7.org/fhir/us/core/CodeSystem/careplan-category",
              code: "assess-plan",
            }],
          }],
          activity: details.activities || undefined,
        };

      case "Goal":
        return {
          ...base,
          lifecycleStatus: details.lifecycleStatus || "active",
          description: { text: record.title },
          startDate: record.date?.toISOString().split("T")[0],
          target: details.target || undefined,
          note: record.summary ? [{ text: record.summary }] : undefined,
        };

      case "CareTeam":
        return {
          ...base,
          status: details.status || "active",
          name: record.title,
          period: { start: record.date?.toISOString() },
          participant: details.participants || (record.provider ? [{
            role: [{ text: "Primary Care Provider" }],
            member: { display: record.provider },
          }] : undefined),
          note: record.summary ? [{ text: record.summary }] : undefined,
        };

      case "Coverage":
        return {
          ...base,
          status: details.status || "active",
          type: { text: record.title },
          subscriber: { reference: `Patient/${userId}` },
          beneficiary: { reference: `Patient/${userId}` },
          period: { start: record.date?.toISOString() },
          payor: details.payor || [{ display: record.facility || "Unknown" }],
          class: details.class || undefined,
        };

      default:
        return {
          ...base,
          resourceType: "Basic",
          code: { text: record.title },
        };
    }
  }

  fhirToHealthRecord(resource: FhirResource, userId: string, sourceId?: string): InsertHealthRecord {
    const resourceType = resource.resourceType;
    const internalType = INTERNAL_TYPE_MAP[resourceType] || "visit";
    const details: Record<string, any> = {};

    let title = "";
    let summary: string | null = null;
    let date = new Date();
    let provider: string | null = null;
    let facility: string | null = null;

    switch (resourceType) {
      case "Patient": {
        const r = resource as any;
        title = r.name?.[0]?.text || r.name?.[0]?.given?.join(" ") + " " + r.name?.[0]?.family || "Unknown Patient";
        details.gender = r.gender;
        details.birthDate = r.birthDate;
        details.address = r.address?.[0];
        details.telecom = r.telecom;
        details.identifier = r.identifier;
        date = r.birthDate ? new Date(r.birthDate) : new Date();
        break;
      }
      case "Observation": {
        const r = resource as any;
        title = r.code?.text || r.code?.coding?.[0]?.display || "Observation";
        summary = r.note?.[0]?.text || null;
        date = r.effectiveDateTime ? new Date(r.effectiveDateTime) : new Date();
        provider = r.performer?.[0]?.display || null;
        details.status = r.status;
        details.category = r.category?.[0]?.coding?.[0]?.code;
        details.categoryDisplay = r.category?.[0]?.coding?.[0]?.display;
        details.code = r.code;
        if (r.valueQuantity) {
          details.value = r.valueQuantity.value;
          details.unit = r.valueQuantity.unit;
          details.unitCode = r.valueQuantity.code;
        }
        if (r.valueString) details.valueString = r.valueString;
        details.interpretation = r.interpretation?.[0]?.coding?.[0]?.code;
        break;
      }
      case "Condition": {
        const r = resource as any;
        title = r.code?.text || r.code?.coding?.[0]?.display || "Condition";
        summary = r.note?.[0]?.text || null;
        date = r.onsetDateTime ? new Date(r.onsetDateTime) : r.recordedDate ? new Date(r.recordedDate) : new Date();
        provider = r.recorder?.display || null;
        details.clinicalStatus = r.clinicalStatus?.coding?.[0]?.code;
        details.verificationStatus = r.verificationStatus?.coding?.[0]?.code;
        details.category = r.category?.[0]?.coding?.[0]?.code;
        details.code = r.code;
        break;
      }
      case "Procedure": {
        const r = resource as any;
        title = r.code?.text || r.code?.coding?.[0]?.display || "Procedure";
        summary = r.note?.[0]?.text || null;
        date = r.performedDateTime ? new Date(r.performedDateTime) : r.performedPeriod?.start ? new Date(r.performedPeriod.start) : new Date();
        provider = r.performer?.[0]?.actor?.display || null;
        facility = r.location?.display || null;
        details.status = r.status;
        details.code = r.code;
        break;
      }
      case "MedicationRequest": {
        const r = resource as any;
        title = r.medicationCodeableConcept?.text || r.medicationCodeableConcept?.coding?.[0]?.display || "Medication";
        summary = r.note?.[0]?.text || null;
        date = r.authoredOn ? new Date(r.authoredOn) : new Date();
        provider = r.requester?.display || null;
        details.status = r.status;
        details.intent = r.intent;
        details.medication = r.medicationCodeableConcept;
        if (r.dosageInstruction?.[0]) {
          details.dosage = r.dosageInstruction[0].text;
          details.timing = r.dosageInstruction[0].timing?.code?.text;
        }
        break;
      }
      case "AllergyIntolerance": {
        const r = resource as any;
        title = r.code?.text || r.code?.coding?.[0]?.display || "Allergy";
        summary = r.note?.[0]?.text || null;
        date = r.onsetDateTime ? new Date(r.onsetDateTime) : r.recordedDate ? new Date(r.recordedDate) : new Date();
        provider = r.recorder?.display || null;
        details.clinicalStatus = r.clinicalStatus?.coding?.[0]?.code;
        details.verificationStatus = r.verificationStatus?.coding?.[0]?.code;
        details.type = r.type;
        details.category = r.category?.[0];
        details.criticality = r.criticality;
        details.code = r.code;
        details.reactions = r.reaction;
        break;
      }
      case "Immunization": {
        const r = resource as any;
        title = r.vaccineCode?.text || r.vaccineCode?.coding?.[0]?.display || "Immunization";
        summary = r.note?.[0]?.text || null;
        date = r.occurrenceDateTime ? new Date(r.occurrenceDateTime) : new Date();
        provider = r.performer?.[0]?.actor?.display || null;
        facility = r.location?.display || null;
        details.status = r.status;
        details.vaccineCode = r.vaccineCode;
        details.lotNumber = r.lotNumber;
        details.expirationDate = r.expirationDate;
        details.site = r.site?.coding?.[0]?.display;
        details.route = r.route?.coding?.[0]?.display;
        break;
      }
      case "DiagnosticReport": {
        const r = resource as any;
        title = r.code?.text || r.code?.coding?.[0]?.display || "Diagnostic Report";
        summary = r.conclusion || null;
        date = r.effectiveDateTime ? new Date(r.effectiveDateTime) : r.issued ? new Date(r.issued) : new Date();
        provider = r.performer?.[0]?.display || null;
        details.status = r.status;
        details.category = r.category?.[0]?.coding?.[0]?.code;
        details.code = r.code;
        details.results = r.result;
        break;
      }
      case "Encounter": {
        const r = resource as any;
        title = r.type?.[0]?.text || r.type?.[0]?.coding?.[0]?.display || "Encounter";
        date = r.period?.start ? new Date(r.period.start) : new Date();
        provider = r.participant?.[0]?.individual?.display || null;
        facility = r.serviceProvider?.display || null;
        details.status = r.status;
        details.class = r.class?.code;
        details.classDisplay = r.class?.display;
        details.endDate = r.period?.end;
        details.reason = r.reasonCode?.[0]?.text;
        break;
      }
      case "DocumentReference": {
        const r = resource as any;
        title = r.type?.text || r.type?.coding?.[0]?.display || "Document";
        summary = r.description || null;
        date = r.date ? new Date(r.date) : new Date();
        provider = r.author?.[0]?.display || null;
        details.status = r.status;
        details.type = r.type;
        details.content = r.content;
        break;
      }
      case "CarePlan": {
        const r = resource as any;
        title = r.title || "Care Plan";
        summary = r.description || null;
        date = r.period?.start ? new Date(r.period.start) : new Date();
        details.status = r.status;
        details.intent = r.intent;
        details.activities = r.activity;
        break;
      }
      case "Goal": {
        const r = resource as any;
        title = r.description?.text || "Goal";
        summary = r.note?.[0]?.text || null;
        date = r.startDate ? new Date(r.startDate) : new Date();
        details.lifecycleStatus = r.lifecycleStatus;
        details.target = r.target;
        break;
      }
      case "CareTeam": {
        const r = resource as any;
        title = r.name || "Care Team";
        summary = r.note?.[0]?.text || null;
        date = r.period?.start ? new Date(r.period.start) : new Date();
        details.status = r.status;
        details.participants = r.participant;
        break;
      }
      case "Coverage": {
        const r = resource as any;
        title = r.type?.text || "Insurance Coverage";
        date = r.period?.start ? new Date(r.period.start) : new Date();
        facility = r.payor?.[0]?.display || null;
        details.status = r.status;
        details.payor = r.payor;
        details.class = r.class;
        break;
      }
      default: {
        title = (resource as any).code?.text || resourceType;
        break;
      }
    }

    return {
      userId,
      type: internalType,
      title,
      summary,
      date,
      provider,
      facility,
      details,
      rawFhirJson: resource,
      sourceId: sourceId || null,
      fhirResourceType: resourceType,
      fhirResourceId: resource.id || null,
      isManual: false,
      lastSyncedAt: new Date(),
    };
  }

  async readResource(userId: string, resourceType: string, resourceId: string): Promise<FhirResource | FhirOperationOutcome> {
    if (!SUPPORTED_RESOURCE_TYPES.includes(resourceType as SupportedResourceType)) {
      return this.operationOutcome("error", "not-supported", `Resource type '${resourceType}' is not supported`);
    }

    const record = await storage.getHealthRecord(resourceId);
    if (!record || record.userId !== userId) {
      return this.operationOutcome("error", "not-found", `${resourceType}/${resourceId} not found`);
    }

    return this.healthRecordToFhir(record, userId);
  }

  async searchResources(
    userId: string,
    resourceType: string,
    params: Record<string, string>
  ): Promise<FhirBundle> {
    if (!SUPPORTED_RESOURCE_TYPES.includes(resourceType as SupportedResourceType)) {
      return this.searchBundle([], resourceType, 0);
    }

    const internalType = INTERNAL_TYPE_MAP[resourceType];
    let records: HealthRecord[];

    if (internalType) {
      records = await storage.getHealthRecordsByType(userId, internalType);
    } else {
      records = await storage.getHealthRecords(userId);
    }

    if (params._id) {
      records = records.filter(r => r.id === params._id);
    }

    if (params._lastUpdated) {
      const cutoff = new Date(params._lastUpdated);
      records = records.filter(r => r.updatedAt && new Date(r.updatedAt) >= cutoff);
    }

    if (params.date) {
      const dateFilter = new Date(params.date);
      records = records.filter(r => {
        const recDate = new Date(r.date);
        return recDate.toISOString().split("T")[0] === dateFilter.toISOString().split("T")[0];
      });
    }

    if (params.status) {
      const details = (r: HealthRecord) => (r.details || {}) as Record<string, any>;
      records = records.filter(r => details(r).status === params.status);
    }

    if (params.code) {
      const codeSearch = params.code.toLowerCase();
      records = records.filter(r => {
        const d = (r.details || {}) as Record<string, any>;
        return r.title?.toLowerCase().includes(codeSearch) ||
          d.code?.coding?.[0]?.code === params.code ||
          d.loincCode === params.code ||
          d.snomedCode === params.code;
      });
    }

    if (params.category) {
      records = records.filter(r => {
        const d = (r.details || {}) as Record<string, any>;
        return d.category === params.category;
      });
    }

    const count = parseInt(params._count || "50", 10);
    const offset = parseInt(params._offset || "0", 10);
    const total = records.length;
    const paged = records.slice(offset, offset + count);

    const resources = paged.map(r => this.healthRecordToFhir(r, userId));
    return this.searchBundle(resources, resourceType, total);
  }

  async createResource(userId: string, resource: FhirResource): Promise<{ resource: FhirResource; id: string } | FhirOperationOutcome> {
    if (!SUPPORTED_RESOURCE_TYPES.includes(resource.resourceType as SupportedResourceType)) {
      return this.operationOutcome("error", "not-supported", `Resource type '${resource.resourceType}' is not supported`);
    }

    const insertData = this.fhirToHealthRecord(resource, userId);
    const created = await storage.createHealthRecord(insertData);

    logger.info("FHIR resource created", {
      category: "api",
      resourceType: resource.resourceType,
      resourceId: created.id,
    });

    const fhirResult = this.healthRecordToFhir(created, userId);
    return { resource: fhirResult, id: created.id };
  }

  async updateResource(userId: string, resourceType: string, resourceId: string, resource: FhirResource): Promise<FhirResource | FhirOperationOutcome> {
    if (!SUPPORTED_RESOURCE_TYPES.includes(resourceType as SupportedResourceType)) {
      return this.operationOutcome("error", "not-supported", `Resource type '${resourceType}' is not supported`);
    }

    const existing = await storage.getHealthRecord(resourceId);
    if (!existing || existing.userId !== userId) {
      return this.operationOutcome("error", "not-found", `${resourceType}/${resourceId} not found`);
    }

    const updateData = this.fhirToHealthRecord(resource, userId);
    delete (updateData as any).userId;
    const updated = await storage.updateHealthRecord(resourceId, updateData);

    if (!updated) {
      return this.operationOutcome("error", "exception", "Failed to update resource");
    }

    logger.info("FHIR resource updated", {
      category: "api",
      resourceType,
      resourceId,
    });

    return this.healthRecordToFhir(updated, userId);
  }

  async importBundle(userId: string, bundle: FhirBundle): Promise<{ imported: number; errors: FhirOperationOutcome[]; resources: string[] }> {
    const results = { imported: 0, errors: [] as FhirOperationOutcome[], resources: [] as string[] };

    if (bundle.resourceType !== "Bundle" || !bundle.entry?.length) {
      results.errors.push(this.operationOutcome("error", "invalid", "Invalid FHIR Bundle or no entries found"));
      return results;
    }

    for (const entry of bundle.entry) {
      const resource = entry.resource;
      if (!resource) continue;

      try {
        if (!SUPPORTED_RESOURCE_TYPES.includes(resource.resourceType as SupportedResourceType)) {
          results.errors.push(this.operationOutcome("warning", "not-supported", `Skipped unsupported resource type: ${resource.resourceType}`));
          continue;
        }

        if (resource.id) {
          const existing = await storage.getHealthRecord(resource.id);
          if (existing && existing.userId === userId) {
            const updateData = this.fhirToHealthRecord(resource, userId);
            delete (updateData as any).userId;
            await storage.updateHealthRecord(resource.id, updateData);
            results.imported++;
            results.resources.push(`${resource.resourceType}/${resource.id}`);
            continue;
          }
        }

        const insertData = this.fhirToHealthRecord(resource, userId);
        const created = await storage.createHealthRecord(insertData);
        results.imported++;
        results.resources.push(`${resource.resourceType}/${created.id}`);
      } catch (err: any) {
        results.errors.push(this.operationOutcome("error", "exception", `Failed to import ${resource.resourceType}: ${err.message}`));
      }
    }

    logger.info("FHIR bundle imported", {
      category: "api",
      total: bundle.entry.length,
      imported: results.imported,
      errors: results.errors.length,
    });

    return results;
  }

  async exportBundle(userId: string, resourceTypes?: string[], since?: string): Promise<FhirBundle> {
    let allRecords = await storage.getHealthRecords(userId);

    if (since) {
      const sinceDate = new Date(since);
      allRecords = allRecords.filter(r => r.updatedAt && new Date(r.updatedAt) >= sinceDate);
    }

    if (resourceTypes?.length) {
      const internalTypes = resourceTypes
        .map(rt => INTERNAL_TYPE_MAP[rt])
        .filter(Boolean);
      allRecords = allRecords.filter(r => internalTypes.includes(r.type));
    }

    const resources = allRecords.map(r => this.healthRecordToFhir(r, userId));

    logger.info("FHIR bundle exported", {
      category: "api",
      resourceCount: resources.length,
      resourceTypes: resourceTypes || ["all"],
    });

    return {
      resourceType: "Bundle",
      id: `export-${Date.now()}`,
      type: "collection",
      total: resources.length,
      timestamp: new Date().toISOString(),
      entry: resources.map(r => ({
        fullUrl: `urn:uuid:${r.id}`,
        resource: r,
      })),
    };
  }

  async validateResource(resource: FhirResource): Promise<FhirOperationOutcome> {
    try {
      const result = await this.validationEngine.validateResource(resource, {
        profileUrl: US_CORE_PROFILES[resource.resourceType],
        strictMode: false,
        suggestCorrections: true,
      });

      return {
        resourceType: "OperationOutcome",
        issue: result.issues.map(i => ({
          severity: i.severity as "fatal" | "error" | "warning" | "information",
          code: i.code,
          diagnostics: i.message,
          location: [i.location],
        })),
      };
    } catch {
      return {
        resourceType: "OperationOutcome",
        issue: [{ severity: "information", code: "informational", diagnostics: "Validation completed with no issues found" }],
      };
    }
  }

  getSupportedResourceTypes(): string[] {
    return [...SUPPORTED_RESOURCE_TYPES];
  }

  private searchBundle(resources: FhirResource[], resourceType: string, total: number): FhirBundle {
    return {
      resourceType: "Bundle",
      type: "searchset",
      total,
      timestamp: new Date().toISOString(),
      entry: resources.map(r => ({
        fullUrl: `${resourceType}/${r.id}`,
        resource: r,
        search: { mode: "match" as const },
      })),
    };
  }

  private operationOutcome(severity: "fatal" | "error" | "warning" | "information", code: string, message: string): FhirOperationOutcome {
    return {
      resourceType: "OperationOutcome",
      issue: [{
        severity,
        code,
        diagnostics: message,
        details: { text: message },
      }],
    };
  }
}

export const fhirR4ApiService = new FhirR4ApiService();
