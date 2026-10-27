import { db } from "./db";
import { healthRecords } from "@shared/schema";
import { eq } from "drizzle-orm";

export const SUPPORTED_STANDARDS = ["FHIR_R4", "FHIR_STU3", "C-CDA", "HL7v2"] as const;
export type SupportedStandard = typeof SUPPORTED_STANDARDS[number];

export const HL7V2_MESSAGE_TYPES = ["ADT", "ORU", "ORM", "MDM", "SIU", "VXU", "RDE"] as const;
export type HL7v2MessageType = typeof HL7V2_MESSAGE_TYPES[number];

export const CCDA_DOCUMENT_TYPES = [
  "CCD",
  "Discharge_Summary",
  "Progress_Note",
  "Procedure_Note",
  "Consultation_Note",
  "History_Physical",
  "Operative_Note",
  "Referral_Note",
] as const;
export type CCDADocumentType = typeof CCDA_DOCUMENT_TYPES[number];

export interface MappingResult {
  success: boolean;
  sourceStandard: SupportedStandard;
  targetStandard: SupportedStandard;
  sourceData: unknown;
  mappedData: unknown;
  mappingDetails: MappingDetail[];
  warnings: string[];
  errors: string[];
  timestamp: Date;
}

export interface MappingDetail {
  sourceField: string;
  targetField: string;
  transformation: string;
  confidence: number;
  notes?: string;
}

export interface FHIRResource {
  resourceType: string;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  [key: string]: unknown;
}

export interface CCDADocument {
  documentType: CCDADocumentType;
  header: CCDAHeader;
  sections: CCDASection[];
}

export interface CCDAHeader {
  id: string;
  title: string;
  effectiveTime: string;
  confidentialityCode: string;
  languageCode: string;
  author?: CCDAAuthor;
  custodian?: string;
  patient: CCDAPatient;
}

export interface CCDAAuthor {
  time: string;
  assignedAuthor: {
    id: string;
    name?: string;
    telecom?: string;
    organization?: string;
  };
}

export interface CCDAPatient {
  id: string;
  name: { given: string; family: string };
  gender: string;
  birthTime: string;
  address?: CCDAAddress;
  telecom?: string[];
}

export interface CCDAAddress {
  streetAddressLine?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface CCDASection {
  templateId: string;
  code: string;
  title: string;
  text?: string;
  entries: CCDAEntry[];
}

export interface CCDAEntry {
  templateId: string;
  id: string;
  code: {
    code: string;
    displayName: string;
    codeSystem: string;
    codeSystemName: string;
  };
  effectiveTime?: string;
  value?: unknown;
  statusCode?: string;
}

export interface HL7v2Message {
  messageType: HL7v2MessageType;
  messageControlId: string;
  sendingApplication: string;
  sendingFacility: string;
  receivingApplication: string;
  receivingFacility: string;
  dateTimeOfMessage: string;
  segments: HL7v2Segment[];
}

export interface HL7v2Segment {
  segmentId: string;
  fields: HL7v2Field[];
}

export interface HL7v2Field {
  position: number;
  value: string;
  components?: string[];
  subcomponents?: string[][];
}

const FHIR_TO_CCDA_SECTION_MAP: Record<string, { templateId: string; code: string; title: string }> = {
  AllergyIntolerance: {
    templateId: "2.16.840.1.113883.10.20.22.2.6.1",
    code: "48765-2",
    title: "Allergies and Adverse Reactions",
  },
  Condition: {
    templateId: "2.16.840.1.113883.10.20.22.2.5.1",
    code: "11450-4",
    title: "Problem List",
  },
  MedicationStatement: {
    templateId: "2.16.840.1.113883.10.20.22.2.1.1",
    code: "10160-0",
    title: "Medications",
  },
  MedicationRequest: {
    templateId: "2.16.840.1.113883.10.20.22.2.1.1",
    code: "10160-0",
    title: "Medications",
  },
  Procedure: {
    templateId: "2.16.840.1.113883.10.20.22.2.7.1",
    code: "47519-4",
    title: "Procedures",
  },
  Observation: {
    templateId: "2.16.840.1.113883.10.20.22.2.3.1",
    code: "30954-2",
    title: "Results",
  },
  Immunization: {
    templateId: "2.16.840.1.113883.10.20.22.2.2.1",
    code: "11369-6",
    title: "Immunizations",
  },
  Encounter: {
    templateId: "2.16.840.1.113883.10.20.22.2.22.1",
    code: "46240-8",
    title: "Encounters",
  },
  DiagnosticReport: {
    templateId: "2.16.840.1.113883.10.20.22.2.3.1",
    code: "30954-2",
    title: "Results",
  },
};

const FHIR_TO_HL7V2_SEGMENT_MAP: Record<string, string> = {
  Patient: "PID",
  Encounter: "PV1",
  Observation: "OBX",
  DiagnosticReport: "OBR",
  AllergyIntolerance: "AL1",
  MedicationRequest: "RXO",
  MedicationStatement: "RXA",
  Immunization: "RXA",
  Procedure: "PR1",
  Condition: "DG1",
};

const FHIR_GENDER_TO_HL7: Record<string, string> = {
  male: "M",
  female: "F",
  other: "O",
  unknown: "U",
};

const HL7_GENDER_TO_FHIR: Record<string, string> = {
  M: "male",
  F: "female",
  O: "other",
  U: "unknown",
};

export class StandardsMappingService {
  async mapResource(
    sourceData: unknown,
    sourceStandard: SupportedStandard,
    targetStandard: SupportedStandard
  ): Promise<MappingResult> {
    const result: MappingResult = {
      success: false,
      sourceStandard,
      targetStandard,
      sourceData,
      mappedData: null,
      mappingDetails: [],
      warnings: [],
      errors: [],
      timestamp: new Date(),
    };

    try {
      if (sourceStandard === targetStandard) {
        result.mappedData = sourceData;
        result.success = true;
        result.warnings.push("Source and target standards are the same; no mapping performed");
        return result;
      }

      if (sourceStandard === "FHIR_R4" && targetStandard === "C-CDA") {
        return this.mapFHIRToCCDA(sourceData as FHIRResource, result);
      }

      if (sourceStandard === "FHIR_R4" && targetStandard === "HL7v2") {
        return this.mapFHIRToHL7v2(sourceData as FHIRResource, result);
      }

      if (sourceStandard === "C-CDA" && targetStandard === "FHIR_R4") {
        return this.mapCCDAToFHIR(sourceData as CCDADocument, result);
      }

      if (sourceStandard === "HL7v2" && targetStandard === "FHIR_R4") {
        return this.mapHL7v2ToFHIR(sourceData as HL7v2Message, result);
      }

      if (sourceStandard === "FHIR_STU3" && targetStandard === "FHIR_R4") {
        return this.mapFHIRSTU3ToR4(sourceData as FHIRResource, result);
      }

      if (sourceStandard === "FHIR_R4" && targetStandard === "FHIR_STU3") {
        return this.mapFHIRR4ToSTU3(sourceData as FHIRResource, result);
      }

      result.errors.push(`Unsupported mapping: ${sourceStandard} to ${targetStandard}`);
      return result;
    } catch (error) {
      result.errors.push(`Mapping failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      return result;
    }
  }

  private mapFHIRToCCDA(resource: FHIRResource, result: MappingResult): MappingResult {
    const sectionMapping = FHIR_TO_CCDA_SECTION_MAP[resource.resourceType];
    
    if (!sectionMapping) {
      result.errors.push(`No C-CDA mapping available for FHIR resource type: ${resource.resourceType}`);
      return result;
    }

    const entry = this.createCCDAEntry(resource, sectionMapping);
    
    const ccdaSection: CCDASection = {
      templateId: sectionMapping.templateId,
      code: sectionMapping.code,
      title: sectionMapping.title,
      entries: [entry],
    };

    result.mappedData = ccdaSection;
    result.success = true;

    result.mappingDetails.push({
      sourceField: "resourceType",
      targetField: "templateId",
      transformation: `${resource.resourceType} -> ${sectionMapping.templateId}`,
      confidence: 0.95,
    });

    return result;
  }

  private createCCDAEntry(resource: FHIRResource, sectionMapping: { templateId: string; code: string; title: string }): CCDAEntry {
    const coding = this.extractPrimaryCoding(resource);
    
    return {
      templateId: sectionMapping.templateId,
      id: resource.id || this.generateId(),
      code: {
        code: coding?.code || "unknown",
        displayName: coding?.display || resource.resourceType,
        codeSystem: this.mapCodeSystemToOID(coding?.system || ""),
        codeSystemName: this.getCodeSystemName(coding?.system || ""),
      },
      effectiveTime: this.extractEffectiveTime(resource),
      statusCode: this.extractStatus(resource),
    };
  }

  private mapFHIRToHL7v2(resource: FHIRResource, result: MappingResult): MappingResult {
    const segmentType = FHIR_TO_HL7V2_SEGMENT_MAP[resource.resourceType];
    
    if (!segmentType) {
      result.errors.push(`No HL7v2 mapping available for FHIR resource type: ${resource.resourceType}`);
      return result;
    }

    const segment = this.createHL7v2Segment(resource, segmentType);
    
    const message: HL7v2Message = {
      messageType: this.determineHL7MessageType(resource.resourceType),
      messageControlId: this.generateId(),
      sendingApplication: "TABULA_MEDICA",
      sendingFacility: "FHIR_GATEWAY",
      receivingApplication: "",
      receivingFacility: "",
      dateTimeOfMessage: new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14),
      segments: [this.createMSHSegment(), segment],
    };

    result.mappedData = message;
    result.success = true;

    result.mappingDetails.push({
      sourceField: "resourceType",
      targetField: "segment",
      transformation: `${resource.resourceType} -> ${segmentType}`,
      confidence: 0.9,
    });

    return result;
  }

  private createMSHSegment(): HL7v2Segment {
    return {
      segmentId: "MSH",
      fields: [
        { position: 1, value: "|" },
        { position: 2, value: "^~\\&" },
        { position: 3, value: "TABULA_MEDICA" },
        { position: 4, value: "FHIR_GATEWAY" },
        { position: 5, value: "" },
        { position: 6, value: "" },
        { position: 7, value: new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14) },
        { position: 8, value: "" },
        { position: 9, value: "ORU^R01" },
        { position: 10, value: this.generateId() },
        { position: 11, value: "P" },
        { position: 12, value: "2.5.1" },
      ],
    };
  }

  private createHL7v2Segment(resource: FHIRResource, segmentType: string): HL7v2Segment {
    const fields: HL7v2Field[] = [];

    switch (segmentType) {
      case "PID":
        fields.push(...this.mapPatientToPID(resource));
        break;
      case "OBX":
        fields.push(...this.mapObservationToOBX(resource));
        break;
      case "AL1":
        fields.push(...this.mapAllergyToAL1(resource));
        break;
      case "DG1":
        fields.push(...this.mapConditionToDG1(resource));
        break;
      case "RXA":
        fields.push(...this.mapMedicationToRXA(resource));
        break;
      default:
        fields.push({ position: 1, value: resource.id || "" });
    }

    return { segmentId: segmentType, fields };
  }

  private mapPatientToPID(resource: FHIRResource): HL7v2Field[] {
    const patient = resource as FHIRResource & {
      identifier?: Array<{ value: string; system?: string }>;
      name?: Array<{ family?: string; given?: string[] }>;
      gender?: string;
      birthDate?: string;
      address?: Array<{ line?: string[]; city?: string; state?: string; postalCode?: string }>;
      telecom?: Array<{ value?: string; system?: string }>;
    };

    return [
      { position: 1, value: "1" },
      { position: 2, value: "" },
      { position: 3, value: patient.identifier?.[0]?.value || patient.id || "" },
      { position: 4, value: "" },
      { 
        position: 5, 
        value: `${patient.name?.[0]?.family || ""}^${patient.name?.[0]?.given?.join(" ") || ""}`,
        components: [patient.name?.[0]?.family || "", patient.name?.[0]?.given?.join(" ") || ""],
      },
      { position: 6, value: "" },
      { position: 7, value: patient.birthDate?.replace(/-/g, "") || "" },
      { position: 8, value: FHIR_GENDER_TO_HL7[patient.gender || ""] || "U" },
    ];
  }

  private mapObservationToOBX(resource: FHIRResource): HL7v2Field[] {
    const observation = resource as FHIRResource & {
      code?: { coding?: Array<{ code?: string; display?: string; system?: string }> };
      valueQuantity?: { value?: number; unit?: string };
      valueString?: string;
      effectiveDateTime?: string;
      status?: string;
    };

    const coding = observation.code?.coding?.[0];
    const value = observation.valueQuantity 
      ? `${observation.valueQuantity.value}^${observation.valueQuantity.unit}`
      : observation.valueString || "";

    return [
      { position: 1, value: "1" },
      { position: 2, value: "NM" },
      { position: 3, value: `${coding?.code || ""}^${coding?.display || ""}^${this.mapCodeSystemToHL7(coding?.system || "")}` },
      { position: 4, value: "" },
      { position: 5, value: value },
      { position: 6, value: observation.valueQuantity?.unit || "" },
      { position: 11, value: this.mapFHIRStatusToHL7(observation.status || "") },
      { position: 14, value: observation.effectiveDateTime?.replace(/[-:T.Z]/g, "").slice(0, 14) || "" },
    ];
  }

  private mapAllergyToAL1(resource: FHIRResource): HL7v2Field[] {
    const allergy = resource as FHIRResource & {
      code?: { coding?: Array<{ code?: string; display?: string }> };
      type?: string;
      criticality?: string;
      reaction?: Array<{ manifestation?: Array<{ coding?: Array<{ display?: string }> }> }>;
    };

    const coding = allergy.code?.coding?.[0];

    return [
      { position: 1, value: "1" },
      { position: 2, value: allergy.type === "allergy" ? "DA" : "MA" },
      { position: 3, value: `${coding?.code || ""}^${coding?.display || ""}` },
      { position: 4, value: allergy.criticality === "high" ? "SV" : "MO" },
      { position: 5, value: allergy.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display || "" },
    ];
  }

  private mapConditionToDG1(resource: FHIRResource): HL7v2Field[] {
    const condition = resource as FHIRResource & {
      code?: { coding?: Array<{ code?: string; display?: string; system?: string }> };
      onsetDateTime?: string;
      clinicalStatus?: { coding?: Array<{ code?: string }> };
    };

    const coding = condition.code?.coding?.[0];

    return [
      { position: 1, value: "1" },
      { position: 2, value: "" },
      { position: 3, value: `${coding?.code || ""}^${coding?.display || ""}^${this.mapCodeSystemToHL7(coding?.system || "")}` },
      { position: 4, value: coding?.display || "" },
      { position: 5, value: condition.onsetDateTime?.replace(/[-:T.Z]/g, "").slice(0, 14) || "" },
      { position: 6, value: "F" },
    ];
  }

  private mapMedicationToRXA(resource: FHIRResource): HL7v2Field[] {
    const medication = resource as FHIRResource & {
      medicationCodeableConcept?: { coding?: Array<{ code?: string; display?: string }> };
      effectiveDateTime?: string;
      dosage?: Array<{ doseAndRate?: Array<{ doseQuantity?: { value?: number; unit?: string } }> }>;
    };

    const coding = medication.medicationCodeableConcept?.coding?.[0];
    const dose = medication.dosage?.[0]?.doseAndRate?.[0]?.doseQuantity;

    return [
      { position: 1, value: "0" },
      { position: 2, value: "1" },
      { position: 3, value: medication.effectiveDateTime?.replace(/[-:T.Z]/g, "").slice(0, 14) || "" },
      { position: 4, value: medication.effectiveDateTime?.replace(/[-:T.Z]/g, "").slice(0, 14) || "" },
      { position: 5, value: `${coding?.code || ""}^${coding?.display || ""}` },
      { position: 6, value: dose ? `${dose.value}` : "" },
      { position: 7, value: dose?.unit || "" },
    ];
  }

  private mapCCDAToFHIR(document: CCDADocument, result: MappingResult): MappingResult {
    const bundle: FHIRResource = {
      resourceType: "Bundle",
      id: this.generateId(),
      type: "document",
      timestamp: new Date().toISOString(),
      entry: [] as Array<{ resource: FHIRResource }>,
    };

    const patient = this.mapCCDAPatientToFHIR(document.header.patient);
    (bundle.entry as Array<{ resource: FHIRResource }>).push({ resource: patient });

    result.mappingDetails.push({
      sourceField: "header.patient",
      targetField: "Patient",
      transformation: "C-CDA patient demographics -> FHIR Patient",
      confidence: 0.95,
    });

    for (const section of document.sections) {
      const resources = this.mapCCDASectionToFHIR(section, patient.id as string);
      for (const resource of resources) {
        (bundle.entry as Array<{ resource: FHIRResource }>).push({ resource });
        
        result.mappingDetails.push({
          sourceField: `section.${section.code}`,
          targetField: resource.resourceType,
          transformation: `${section.title} -> ${resource.resourceType}`,
          confidence: 0.85,
        });
      }
    }

    result.mappedData = bundle;
    result.success = true;
    return result;
  }

  private mapCCDAPatientToFHIR(ccdaPatient: CCDAPatient): FHIRResource {
    return {
      resourceType: "Patient",
      id: ccdaPatient.id || this.generateId(),
      name: [
        {
          family: ccdaPatient.name.family,
          given: [ccdaPatient.name.given],
        },
      ],
      gender: this.mapCCDAGenderToFHIR(ccdaPatient.gender),
      birthDate: this.formatHL7DateToFHIR(ccdaPatient.birthTime),
      address: ccdaPatient.address ? [
        {
          line: ccdaPatient.address.streetAddressLine ? [ccdaPatient.address.streetAddressLine] : undefined,
          city: ccdaPatient.address.city,
          state: ccdaPatient.address.state,
          postalCode: ccdaPatient.address.postalCode,
          country: ccdaPatient.address.country,
        },
      ] : undefined,
      telecom: ccdaPatient.telecom?.map(t => ({ value: t, system: "phone" })),
    };
  }

  private mapCCDASectionToFHIR(section: CCDASection, patientId: string): FHIRResource[] {
    const resources: FHIRResource[] = [];

    for (const entry of section.entries) {
      const resource = this.mapCCDAEntryToFHIR(entry, section.code, patientId);
      if (resource) {
        resources.push(resource);
      }
    }

    return resources;
  }

  private mapCCDAEntryToFHIR(entry: CCDAEntry, sectionCode: string, patientId: string): FHIRResource | null {
    const baseResource = {
      id: entry.id || this.generateId(),
      subject: { reference: `Patient/${patientId}` },
      code: {
        coding: [
          {
            system: this.mapOIDToCodeSystem(entry.code.codeSystem),
            code: entry.code.code,
            display: entry.code.displayName,
          },
        ],
      },
    };

    switch (sectionCode) {
      case "48765-2":
        return {
          resourceType: "AllergyIntolerance",
          ...baseResource,
          patient: { reference: `Patient/${patientId}` },
          clinicalStatus: {
            coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }],
          },
        };

      case "11450-4":
        return {
          resourceType: "Condition",
          ...baseResource,
          clinicalStatus: {
            coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: entry.statusCode === "completed" ? "resolved" : "active" }],
          },
          onsetDateTime: entry.effectiveTime ? this.formatHL7DateToFHIR(entry.effectiveTime) : undefined,
        };

      case "10160-0":
        return {
          resourceType: "MedicationStatement",
          ...baseResource,
          medicationCodeableConcept: baseResource.code,
          status: entry.statusCode === "completed" ? "completed" : "active",
          effectiveDateTime: entry.effectiveTime ? this.formatHL7DateToFHIR(entry.effectiveTime) : undefined,
        };

      case "30954-2":
        return {
          resourceType: "Observation",
          ...baseResource,
          status: "final",
          effectiveDateTime: entry.effectiveTime ? this.formatHL7DateToFHIR(entry.effectiveTime) : undefined,
        };

      case "11369-6":
        return {
          resourceType: "Immunization",
          ...baseResource,
          vaccineCode: baseResource.code,
          status: "completed",
          occurrenceDateTime: entry.effectiveTime ? this.formatHL7DateToFHIR(entry.effectiveTime) : undefined,
          patient: { reference: `Patient/${patientId}` },
        };

      default:
        return null;
    }
  }

  private mapHL7v2ToFHIR(message: HL7v2Message, result: MappingResult): MappingResult {
    const bundle: FHIRResource = {
      resourceType: "Bundle",
      id: this.generateId(),
      type: "message",
      timestamp: new Date().toISOString(),
      entry: [] as Array<{ resource: FHIRResource }>,
    };

    let patientId = "";

    for (const segment of message.segments) {
      const resource = this.mapHL7v2SegmentToFHIR(segment, patientId);
      if (resource) {
        if (resource.resourceType === "Patient") {
          patientId = resource.id as string;
        }
        (bundle.entry as Array<{ resource: FHIRResource }>).push({ resource });

        result.mappingDetails.push({
          sourceField: segment.segmentId,
          targetField: resource.resourceType,
          transformation: `${segment.segmentId} segment -> ${resource.resourceType}`,
          confidence: 0.85,
        });
      }
    }

    result.mappedData = bundle;
    result.success = true;
    return result;
  }

  private mapHL7v2SegmentToFHIR(segment: HL7v2Segment, patientId: string): FHIRResource | null {
    switch (segment.segmentId) {
      case "PID":
        return this.mapPIDToPatient(segment);
      case "OBX":
        return this.mapOBXToObservation(segment, patientId);
      case "AL1":
        return this.mapAL1ToAllergyIntolerance(segment, patientId);
      case "DG1":
        return this.mapDG1ToCondition(segment, patientId);
      case "RXA":
        return this.mapRXAToImmunization(segment, patientId);
      default:
        return null;
    }
  }

  private mapPIDToPatient(segment: HL7v2Segment): FHIRResource {
    const getField = (pos: number) => segment.fields.find(f => f.position === pos)?.value || "";
    const nameField = segment.fields.find(f => f.position === 5);
    const nameParts = nameField?.components || nameField?.value.split("^") || ["", ""];

    return {
      resourceType: "Patient",
      id: this.generateId(),
      identifier: [
        {
          value: getField(3),
          system: "http://hospital.local/patient-id",
        },
      ],
      name: [
        {
          family: nameParts[0],
          given: nameParts[1] ? [nameParts[1]] : undefined,
        },
      ],
      gender: HL7_GENDER_TO_FHIR[getField(8)] || "unknown",
      birthDate: this.formatHL7DateToFHIR(getField(7)),
    };
  }

  private mapOBXToObservation(segment: HL7v2Segment, patientId: string): FHIRResource {
    const getField = (pos: number) => segment.fields.find(f => f.position === pos)?.value || "";
    const codeField = getField(3).split("^");
    const valueField = getField(5).split("^");

    return {
      resourceType: "Observation",
      id: this.generateId(),
      status: this.mapHL7StatusToFHIR(getField(11)),
      code: {
        coding: [
          {
            code: codeField[0],
            display: codeField[1],
            system: this.mapHL7ToCodeSystem(codeField[2]),
          },
        ],
      },
      subject: patientId ? { reference: `Patient/${patientId}` } : undefined,
      valueQuantity: valueField[0] ? {
        value: parseFloat(valueField[0]),
        unit: valueField[1] || getField(6),
      } : undefined,
      effectiveDateTime: getField(14) ? this.formatHL7DateToFHIR(getField(14)) : undefined,
    };
  }

  private mapAL1ToAllergyIntolerance(segment: HL7v2Segment, patientId: string): FHIRResource {
    const getField = (pos: number) => segment.fields.find(f => f.position === pos)?.value || "";
    const allergenField = getField(3).split("^");

    return {
      resourceType: "AllergyIntolerance",
      id: this.generateId(),
      clinicalStatus: {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active" }],
      },
      type: getField(2) === "DA" ? "allergy" : "intolerance",
      criticality: getField(4) === "SV" ? "high" : "low",
      code: {
        coding: [
          {
            code: allergenField[0],
            display: allergenField[1],
          },
        ],
      },
      patient: patientId ? { reference: `Patient/${patientId}` } : undefined,
      reaction: getField(5) ? [
        {
          manifestation: [
            {
              coding: [{ display: getField(5) }],
            },
          ],
        },
      ] : undefined,
    };
  }

  private mapDG1ToCondition(segment: HL7v2Segment, patientId: string): FHIRResource {
    const getField = (pos: number) => segment.fields.find(f => f.position === pos)?.value || "";
    const diagnosisField = getField(3).split("^");

    return {
      resourceType: "Condition",
      id: this.generateId(),
      clinicalStatus: {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }],
      },
      code: {
        coding: [
          {
            code: diagnosisField[0],
            display: diagnosisField[1] || getField(4),
            system: this.mapHL7ToCodeSystem(diagnosisField[2]),
          },
        ],
      },
      subject: patientId ? { reference: `Patient/${patientId}` } : undefined,
      onsetDateTime: getField(5) ? this.formatHL7DateToFHIR(getField(5)) : undefined,
    };
  }

  private mapRXAToImmunization(segment: HL7v2Segment, patientId: string): FHIRResource {
    const getField = (pos: number) => segment.fields.find(f => f.position === pos)?.value || "";
    const vaccineField = getField(5).split("^");

    return {
      resourceType: "Immunization",
      id: this.generateId(),
      status: "completed",
      vaccineCode: {
        coding: [
          {
            code: vaccineField[0],
            display: vaccineField[1],
          },
        ],
      },
      patient: patientId ? { reference: `Patient/${patientId}` } : undefined,
      occurrenceDateTime: getField(3) ? this.formatHL7DateToFHIR(getField(3)) : undefined,
      doseQuantity: getField(6) ? {
        value: parseFloat(getField(6)),
        unit: getField(7),
      } : undefined,
    };
  }

  private mapFHIRSTU3ToR4(resource: FHIRResource, result: MappingResult): MappingResult {
    const r4Resource = { ...resource };

    if (resource.resourceType === "MedicationRequest") {
      const mr = resource as FHIRResource & { authoredOn?: string; requester?: { agent?: unknown } };
      if (mr.requester && (mr.requester as { agent?: unknown }).agent) {
        (r4Resource as FHIRResource & { requester?: unknown }).requester = (mr.requester as { agent?: unknown }).agent;
        result.mappingDetails.push({
          sourceField: "requester.agent",
          targetField: "requester",
          transformation: "Flatten requester.agent to requester (R4 change)",
          confidence: 1.0,
        });
      }
    }

    if (resource.resourceType === "Observation") {
      const obs = resource as FHIRResource & { effectivePeriod?: { start?: string }; effectiveDateTime?: string };
      if (obs.effectivePeriod && !obs.effectiveDateTime) {
        result.warnings.push("effectivePeriod preserved in R4 (both period and dateTime supported)");
      }
    }

    if (resource.meta?.profile) {
      r4Resource.meta = {
        ...resource.meta,
        profile: resource.meta.profile.map((p: string) => p.replace("/StructureDefinition/", "/StructureDefinition/")),
      };
    }

    result.mappedData = r4Resource;
    result.success = true;
    result.mappingDetails.push({
      sourceField: "meta.profile",
      targetField: "meta.profile",
      transformation: "FHIR STU3 -> R4 profile URL migration",
      confidence: 0.9,
    });

    return result;
  }

  private mapFHIRR4ToSTU3(resource: FHIRResource, result: MappingResult): MappingResult {
    const stu3Resource = { ...resource };

    if (resource.resourceType === "MedicationRequest") {
      const mr = resource as FHIRResource & { requester?: unknown };
      if (mr.requester && typeof mr.requester === "object") {
        (stu3Resource as FHIRResource & { requester?: { agent?: unknown } }).requester = { agent: mr.requester };
        result.mappingDetails.push({
          sourceField: "requester",
          targetField: "requester.agent",
          transformation: "Wrap requester in agent object (STU3 format)",
          confidence: 1.0,
        });
      }
    }

    result.mappedData = stu3Resource;
    result.success = true;
    result.warnings.push("Some R4 features may not have STU3 equivalents");

    return result;
  }

  private extractPrimaryCoding(resource: FHIRResource): { code?: string; display?: string; system?: string } | undefined {
    const codeableFields = ["code", "medicationCodeableConcept", "vaccineCode", "type"];
    
    for (const field of codeableFields) {
      const codeable = resource[field] as { coding?: Array<{ code?: string; display?: string; system?: string }> };
      if (codeable?.coding?.[0]) {
        return codeable.coding[0];
      }
    }
    
    return undefined;
  }

  private extractEffectiveTime(resource: FHIRResource): string | undefined {
    const dateFields = ["effectiveDateTime", "effectivePeriod.start", "occurrenceDateTime", "recordedDate", "onsetDateTime"];
    
    for (const field of dateFields) {
      const parts = field.split(".");
      let value: unknown = resource;
      for (const part of parts) {
        value = (value as Record<string, unknown>)?.[part];
      }
      if (typeof value === "string") {
        return value.replace(/[-:T.Z]/g, "").slice(0, 14);
      }
    }
    
    return undefined;
  }

  private extractStatus(resource: FHIRResource): string | undefined {
    const status = resource.status as string | undefined;
    const clinicalStatus = (resource.clinicalStatus as { coding?: Array<{ code?: string }> })?.coding?.[0]?.code;
    return status || clinicalStatus;
  }

  private mapCodeSystemToOID(system: string): string {
    const systemMap: Record<string, string> = {
      "http://snomed.info/sct": "2.16.840.1.113883.6.96",
      "http://loinc.org": "2.16.840.1.113883.6.1",
      "http://www.nlm.nih.gov/research/umls/rxnorm": "2.16.840.1.113883.6.88",
      "http://hl7.org/fhir/sid/icd-10": "2.16.840.1.113883.6.3",
      "http://hl7.org/fhir/sid/icd-10-cm": "2.16.840.1.113883.6.90",
      "http://hl7.org/fhir/sid/cvx": "2.16.840.1.113883.12.292",
      "http://www.ama-assn.org/go/cpt": "2.16.840.1.113883.6.12",
    };
    return systemMap[system] || "2.16.840.1.113883.6.1";
  }

  private mapOIDToCodeSystem(oid: string): string {
    const oidMap: Record<string, string> = {
      "2.16.840.1.113883.6.96": "http://snomed.info/sct",
      "2.16.840.1.113883.6.1": "http://loinc.org",
      "2.16.840.1.113883.6.88": "http://www.nlm.nih.gov/research/umls/rxnorm",
      "2.16.840.1.113883.6.3": "http://hl7.org/fhir/sid/icd-10",
      "2.16.840.1.113883.6.90": "http://hl7.org/fhir/sid/icd-10-cm",
      "2.16.840.1.113883.12.292": "http://hl7.org/fhir/sid/cvx",
      "2.16.840.1.113883.6.12": "http://www.ama-assn.org/go/cpt",
    };
    return oidMap[oid] || "http://terminology.hl7.org/CodeSystem/unknown";
  }

  private getCodeSystemName(system: string): string {
    const nameMap: Record<string, string> = {
      "http://snomed.info/sct": "SNOMED CT",
      "http://loinc.org": "LOINC",
      "http://www.nlm.nih.gov/research/umls/rxnorm": "RxNorm",
      "http://hl7.org/fhir/sid/icd-10": "ICD-10",
      "http://hl7.org/fhir/sid/icd-10-cm": "ICD-10-CM",
      "http://hl7.org/fhir/sid/cvx": "CVX",
      "http://www.ama-assn.org/go/cpt": "CPT",
    };
    return nameMap[system] || "Unknown";
  }

  private mapCodeSystemToHL7(system: string): string {
    const hl7Map: Record<string, string> = {
      "http://snomed.info/sct": "SCT",
      "http://loinc.org": "LN",
      "http://www.nlm.nih.gov/research/umls/rxnorm": "RXN",
      "http://hl7.org/fhir/sid/icd-10": "I10",
      "http://hl7.org/fhir/sid/icd-10-cm": "I10C",
      "http://hl7.org/fhir/sid/cvx": "CVX",
      "http://www.ama-assn.org/go/cpt": "C4",
    };
    return hl7Map[system] || "99ZZZ";
  }

  private mapHL7ToCodeSystem(hl7Code: string): string {
    const codeMap: Record<string, string> = {
      SCT: "http://snomed.info/sct",
      LN: "http://loinc.org",
      RXN: "http://www.nlm.nih.gov/research/umls/rxnorm",
      I10: "http://hl7.org/fhir/sid/icd-10",
      I10C: "http://hl7.org/fhir/sid/icd-10-cm",
      CVX: "http://hl7.org/fhir/sid/cvx",
      C4: "http://www.ama-assn.org/go/cpt",
    };
    return codeMap[hl7Code] || "http://terminology.hl7.org/CodeSystem/unknown";
  }

  private mapCCDAGenderToFHIR(gender: string): string {
    const genderMap: Record<string, string> = {
      M: "male",
      F: "female",
      UN: "unknown",
    };
    return genderMap[gender] || "unknown";
  }

  private formatHL7DateToFHIR(hl7Date: string): string {
    if (!hl7Date) return "";
    const cleanDate = hl7Date.replace(/\D/g, "");
    if (cleanDate.length >= 8) {
      return `${cleanDate.slice(0, 4)}-${cleanDate.slice(4, 6)}-${cleanDate.slice(6, 8)}`;
    }
    return "";
  }

  private mapFHIRStatusToHL7(status: string): string {
    const statusMap: Record<string, string> = {
      registered: "R",
      preliminary: "P",
      final: "F",
      amended: "C",
      corrected: "C",
      cancelled: "X",
      "entered-in-error": "D",
    };
    return statusMap[status] || "F";
  }

  private mapHL7StatusToFHIR(status: string): string {
    const statusMap: Record<string, string> = {
      R: "registered",
      P: "preliminary",
      F: "final",
      C: "corrected",
      X: "cancelled",
      D: "entered-in-error",
    };
    return statusMap[status] || "final";
  }

  private determineHL7MessageType(resourceType: string): HL7v2MessageType {
    const typeMap: Record<string, HL7v2MessageType> = {
      Patient: "ADT",
      Encounter: "ADT",
      Observation: "ORU",
      DiagnosticReport: "ORU",
      MedicationRequest: "RDE",
      MedicationStatement: "RDE",
      Immunization: "VXU",
      Procedure: "ORU",
      Condition: "ADT",
      AllergyIntolerance: "ADT",
    };
    return typeMap[resourceType] || "ORU";
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async getSupportedMappings(): Promise<{
    standards: typeof SUPPORTED_STANDARDS;
    fhirResourceTypes: string[];
    ccdaDocumentTypes: typeof CCDA_DOCUMENT_TYPES;
    hl7v2MessageTypes: typeof HL7V2_MESSAGE_TYPES;
    supportedPaths: Array<{ from: SupportedStandard; to: SupportedStandard }>;
  }> {
    return {
      standards: SUPPORTED_STANDARDS,
      fhirResourceTypes: Object.keys(FHIR_TO_CCDA_SECTION_MAP),
      ccdaDocumentTypes: CCDA_DOCUMENT_TYPES,
      hl7v2MessageTypes: HL7V2_MESSAGE_TYPES,
      supportedPaths: [
        { from: "FHIR_R4", to: "C-CDA" },
        { from: "FHIR_R4", to: "HL7v2" },
        { from: "C-CDA", to: "FHIR_R4" },
        { from: "HL7v2", to: "FHIR_R4" },
        { from: "FHIR_STU3", to: "FHIR_R4" },
        { from: "FHIR_R4", to: "FHIR_STU3" },
      ],
    };
  }

  async batchMap(
    resources: unknown[],
    sourceStandard: SupportedStandard,
    targetStandard: SupportedStandard
  ): Promise<{
    results: MappingResult[];
    summary: {
      total: number;
      successful: number;
      failed: number;
      warnings: number;
    };
  }> {
    const results: MappingResult[] = [];
    let successful = 0;
    let failed = 0;
    let warnings = 0;

    for (const resource of resources) {
      const result = await this.mapResource(resource, sourceStandard, targetStandard);
      results.push(result);
      
      if (result.success) {
        successful++;
        if (result.warnings.length > 0) {
          warnings++;
        }
      } else {
        failed++;
      }
    }

    return {
      results,
      summary: {
        total: resources.length,
        successful,
        failed,
        warnings,
      },
    };
  }
}

export const standardsMappingService = new StandardsMappingService();
