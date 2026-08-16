import { generatePhiSafeText } from "./ai-gateway";

const aiEnabled = true;

export interface FHIRResource {
  resourceType: string;
  id?: string;
  [key: string]: any;
}

export interface MappingResult {
  id: string;
  sourceFormat: string;
  targetFormat: string;
  sourceData: any;
  mappedData: any;
  mappingDetails: MappingDetail[];
  validationStatus: "success" | "warning" | "error";
  validationMessages: string[];
  confidence: number;
  timestamp: string;
}

export interface MappingDetail {
  sourceField: string;
  targetField: string;
  transformation: string;
  confidence: number;
  notes?: string;
}

export interface SupportedStandard {
  id: string;
  name: string;
  version: string;
  description: string;
  supportedResourceTypes: string[];
  direction: "from" | "to" | "bidirectional";
}

export interface MappingTemplate {
  id: string;
  name: string;
  sourceFormat: string;
  targetFormat: string;
  description: string;
  mappingRules: MappingRule[];
  createdAt: string;
  updatedAt: string;
}

export interface MappingRule {
  id: string;
  sourcePath: string;
  targetPath: string;
  transformation: "direct" | "code_mapping" | "concatenation" | "split" | "custom";
  transformationConfig?: any;
  required: boolean;
  defaultValue?: any;
}

class FHIRStandardsMappingService {
  private mappingHistory: MappingResult[] = [];
  private mappingTemplates: MappingTemplate[] = [];
  private supportedStandards: SupportedStandard[] = [
    {
      id: "fhir-r4",
      name: "FHIR R4",
      version: "4.0.1",
      description: "HL7 FHIR Release 4 - the current production standard for healthcare interoperability",
      supportedResourceTypes: ["Patient", "Observation", "Condition", "Medication", "MedicationRequest", "Procedure", "AllergyIntolerance", "Immunization", "DiagnosticReport", "Encounter"],
      direction: "bidirectional"
    },
    {
      id: "ccda",
      name: "C-CDA",
      version: "2.1",
      description: "Consolidated Clinical Document Architecture - HL7 CDA implementation guide for clinical documents",
      supportedResourceTypes: ["ContinuityOfCareDocument", "DischargeSum", "ProgressNote", "ConsultNote", "HistoryAndPhysical"],
      direction: "bidirectional"
    },
    {
      id: "hl7v2",
      name: "HL7 v2.x",
      version: "2.5.1",
      description: "HL7 Version 2 messaging - widely used legacy standard for healthcare data exchange",
      supportedResourceTypes: ["ADT", "ORU", "ORM", "MDM", "SIU", "VXU"],
      direction: "bidirectional"
    },
    {
      id: "fhir-stu3",
      name: "FHIR STU3",
      version: "3.0.2",
      description: "HL7 FHIR Release 3 - previous stable FHIR version still in use",
      supportedResourceTypes: ["Patient", "Observation", "Condition", "Medication", "MedicationRequest", "Procedure"],
      direction: "bidirectional"
    },
    {
      id: "x12",
      name: "X12 EDI",
      version: "5010",
      description: "ANSI X12 - Electronic Data Interchange for healthcare claims and eligibility",
      supportedResourceTypes: ["837P", "837I", "835", "270", "271", "276", "277"],
      direction: "from"
    },
    {
      id: "ncpdp",
      name: "NCPDP SCRIPT",
      version: "2017071",
      description: "National Council for Prescription Drug Programs - e-prescribing standard",
      supportedResourceTypes: ["NewRx", "RxRenewal", "RxFill", "CancelRx", "RxTransfer"],
      direction: "bidirectional"
    }
  ];

  constructor() {
    this.initializeSampleTemplates();
    console.log("[FHIRStandardsMapping] Service initialized");
    console.log(`[FHIRStandardsMapping] Supported standards: ${this.supportedStandards.length}`);
    console.log("[FHIRStandardsMapping] NO-CDS compliance enabled for all AI outputs");
  }

  private initializeSampleTemplates(): void {
    this.mappingTemplates = [
      {
        id: "tmpl-1",
        name: "FHIR Patient to C-CDA recordTarget",
        sourceFormat: "fhir-r4",
        targetFormat: "ccda",
        description: "Maps FHIR Patient resource to C-CDA recordTarget section",
        mappingRules: [
          { id: "r1", sourcePath: "Patient.id", targetPath: "recordTarget.patientRole.id", transformation: "direct", required: true },
          { id: "r2", sourcePath: "Patient.name", targetPath: "recordTarget.patientRole.patient.name", transformation: "direct", required: true },
          { id: "r3", sourcePath: "Patient.birthDate", targetPath: "recordTarget.patientRole.patient.birthTime", transformation: "direct", required: true },
          { id: "r4", sourcePath: "Patient.gender", targetPath: "recordTarget.patientRole.patient.administrativeGenderCode", transformation: "code_mapping", required: true },
          { id: "r5", sourcePath: "Patient.address", targetPath: "recordTarget.patientRole.addr", transformation: "direct", required: false },
          { id: "r6", sourcePath: "Patient.telecom", targetPath: "recordTarget.patientRole.telecom", transformation: "direct", required: false }
        ],
        createdAt: "2024-01-15T10:00:00Z",
        updatedAt: "2024-01-20T14:30:00Z"
      },
      {
        id: "tmpl-2",
        name: "HL7v2 ADT to FHIR Patient/Encounter",
        sourceFormat: "hl7v2",
        targetFormat: "fhir-r4",
        description: "Maps HL7v2 ADT message to FHIR Patient and Encounter resources",
        mappingRules: [
          { id: "r1", sourcePath: "PID.3", targetPath: "Patient.identifier", transformation: "direct", required: true },
          { id: "r2", sourcePath: "PID.5", targetPath: "Patient.name", transformation: "custom", required: true },
          { id: "r3", sourcePath: "PID.7", targetPath: "Patient.birthDate", transformation: "direct", required: true },
          { id: "r4", sourcePath: "PID.8", targetPath: "Patient.gender", transformation: "code_mapping", required: true },
          { id: "r5", sourcePath: "PV1.2", targetPath: "Encounter.class", transformation: "code_mapping", required: true },
          { id: "r6", sourcePath: "PV1.44", targetPath: "Encounter.period.start", transformation: "direct", required: true }
        ],
        createdAt: "2024-01-18T09:00:00Z",
        updatedAt: "2024-01-22T11:15:00Z"
      },
      {
        id: "tmpl-3",
        name: "FHIR Observation to C-CDA Result",
        sourceFormat: "fhir-r4",
        targetFormat: "ccda",
        description: "Maps FHIR Observation to C-CDA Results section entry",
        mappingRules: [
          { id: "r1", sourcePath: "Observation.code", targetPath: "observation.code", transformation: "direct", required: true },
          { id: "r2", sourcePath: "Observation.valueQuantity", targetPath: "observation.value", transformation: "custom", required: true },
          { id: "r3", sourcePath: "Observation.effectiveDateTime", targetPath: "observation.effectiveTime", transformation: "direct", required: true },
          { id: "r4", sourcePath: "Observation.status", targetPath: "observation.statusCode", transformation: "code_mapping", required: true },
          { id: "r5", sourcePath: "Observation.interpretation", targetPath: "observation.interpretationCode", transformation: "code_mapping", required: false }
        ],
        createdAt: "2024-01-20T15:00:00Z",
        updatedAt: "2024-01-25T10:45:00Z"
      }
    ];
  }

  async mapResource(
    sourceData: any,
    sourceFormat: string,
    targetFormat: string,
    templateId?: string
  ): Promise<MappingResult> {
    const mappingId = `map-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    let mappedData: any;
    let mappingDetails: MappingDetail[] = [];
    let validationStatus: "success" | "warning" | "error" = "success";
    let validationMessages: string[] = [];
    let confidence = 0.95;

    try {
      if (sourceFormat === "fhir-r4" && targetFormat === "ccda") {
        const result = await this.mapFHIRToCCDA(sourceData);
        mappedData = result.data;
        mappingDetails = result.details;
        validationMessages = result.messages;
      } else if (sourceFormat === "fhir-r4" && targetFormat === "hl7v2") {
        const result = await this.mapFHIRToHL7v2(sourceData);
        mappedData = result.data;
        mappingDetails = result.details;
        validationMessages = result.messages;
      } else if (sourceFormat === "hl7v2" && targetFormat === "fhir-r4") {
        const result = await this.mapHL7v2ToFHIR(sourceData);
        mappedData = result.data;
        mappingDetails = result.details;
        validationMessages = result.messages;
      } else if (sourceFormat === "ccda" && targetFormat === "fhir-r4") {
        const result = await this.mapCCDAToFHIR(sourceData);
        mappedData = result.data;
        mappingDetails = result.details;
        validationMessages = result.messages;
      } else {
        const result = await this.aiAssistedMapping(sourceData, sourceFormat, targetFormat);
        mappedData = result.data;
        mappingDetails = result.details;
        validationMessages = result.messages;
        confidence = result.confidence;
      }

      if (validationMessages.some(m => m.includes("error"))) {
        validationStatus = "error";
      } else if (validationMessages.some(m => m.includes("warning"))) {
        validationStatus = "warning";
      }
    } catch (error: any) {
      validationStatus = "error";
      validationMessages.push(`Mapping error: ${error.message}`);
      mappedData = null;
      confidence = 0;
    }

    const result: MappingResult = {
      id: mappingId,
      sourceFormat,
      targetFormat,
      sourceData,
      mappedData,
      mappingDetails,
      validationStatus,
      validationMessages,
      confidence,
      timestamp: new Date().toISOString()
    };

    this.mappingHistory.unshift(result);
    if (this.mappingHistory.length > 100) {
      this.mappingHistory.pop();
    }

    return result;
  }

  private async mapFHIRToCCDA(fhirResource: FHIRResource): Promise<{ data: any; details: MappingDetail[]; messages: string[] }> {
    const resourceType = fhirResource.resourceType;
    const details: MappingDetail[] = [];
    const messages: string[] = [];

    let ccdaData: any = {
      "@xmlns": "urn:hl7-org:v3",
      "@xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      templateId: { root: "2.16.840.1.113883.10.20.22.1.1" },
      typeId: { root: "2.16.840.1.113883.1.3", extension: "POCD_HD000040" },
      id: { root: fhirResource.id || crypto.randomUUID() }
    };

    if (resourceType === "Patient") {
      ccdaData.recordTarget = {
        patientRole: {
          id: { root: fhirResource.identifier?.[0]?.system || "2.16.840.1.113883.4.1", extension: fhirResource.identifier?.[0]?.value || fhirResource.id },
          patient: {
            name: this.mapFHIRNameToCCDA(fhirResource.name?.[0]),
            administrativeGenderCode: { code: this.mapGenderCode(fhirResource.gender), codeSystem: "2.16.840.1.113883.5.1" },
            birthTime: { value: fhirResource.birthDate?.replace(/-/g, "") }
          }
        }
      };

      details.push(
        { sourceField: "Patient.id", targetField: "recordTarget.patientRole.id", transformation: "Direct mapping", confidence: 1.0 },
        { sourceField: "Patient.name", targetField: "recordTarget.patientRole.patient.name", transformation: "Name structure conversion", confidence: 0.95 },
        { sourceField: "Patient.gender", targetField: "administrativeGenderCode", transformation: "Code mapping (FHIR to HL7)", confidence: 1.0 },
        { sourceField: "Patient.birthDate", targetField: "birthTime", transformation: "Date format conversion (YYYY-MM-DD to YYYYMMDD)", confidence: 1.0 }
      );

      if (fhirResource.address?.[0]) {
        ccdaData.recordTarget.patientRole.addr = this.mapFHIRAddressToCCDA(fhirResource.address[0]);
        details.push({ sourceField: "Patient.address", targetField: "recordTarget.patientRole.addr", transformation: "Address structure conversion", confidence: 0.9 });
      }

      messages.push("Successfully mapped FHIR Patient to C-CDA recordTarget");
    } else if (resourceType === "Observation") {
      ccdaData = {
        observation: {
          "@classCode": "OBS",
          "@moodCode": "EVN",
          templateId: { root: "2.16.840.1.113883.10.20.22.4.2" },
          code: this.mapFHIRCodeToCCDA(fhirResource.code),
          statusCode: { code: this.mapObservationStatus(fhirResource.status) },
          effectiveTime: { value: fhirResource.effectiveDateTime?.replace(/[-:T]/g, "").substring(0, 14) },
          value: this.mapFHIRValueToCCDA(fhirResource.valueQuantity || fhirResource.valueCodeableConcept)
        }
      };

      details.push(
        { sourceField: "Observation.code", targetField: "observation.code", transformation: "Code system mapping", confidence: 0.95 },
        { sourceField: "Observation.status", targetField: "observation.statusCode", transformation: "Status code mapping", confidence: 1.0 },
        { sourceField: "Observation.effectiveDateTime", targetField: "observation.effectiveTime", transformation: "DateTime format conversion", confidence: 1.0 },
        { sourceField: "Observation.value", targetField: "observation.value", transformation: "Value type conversion", confidence: 0.9 }
      );

      messages.push("Successfully mapped FHIR Observation to C-CDA observation entry");
    }

    return { data: ccdaData, details, messages };
  }

  private async mapFHIRToHL7v2(fhirResource: FHIRResource): Promise<{ data: any; details: MappingDetail[]; messages: string[] }> {
    const resourceType = fhirResource.resourceType;
    const details: MappingDetail[] = [];
    const messages: string[] = [];
    let hl7Message = "";

    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").substring(0, 14);
    const controlId = `MSG${Date.now()}`;

    if (resourceType === "Patient") {
      hl7Message = `MSH|^~\\&|TABULA_MEDICA|HOSPITAL|RECEIVING|FACILITY|${timestamp}||ADT^A01|${controlId}|P|2.5.1|||AL|NE\r`;
      hl7Message += `EVN|A01|${timestamp}\r`;

      const pid = this.buildPIDSegment(fhirResource);
      hl7Message += pid + "\r";

      details.push(
        { sourceField: "Patient.identifier", targetField: "PID-3", transformation: "Identifier mapping", confidence: 0.95 },
        { sourceField: "Patient.name", targetField: "PID-5", transformation: "Name format conversion (XPN)", confidence: 0.95 },
        { sourceField: "Patient.birthDate", targetField: "PID-7", transformation: "Date format (YYYYMMDD)", confidence: 1.0 },
        { sourceField: "Patient.gender", targetField: "PID-8", transformation: "Gender code mapping", confidence: 1.0 },
        { sourceField: "Patient.address", targetField: "PID-11", transformation: "Address format (XAD)", confidence: 0.9 }
      );

      messages.push("Successfully mapped FHIR Patient to HL7v2 ADT^A01 message");
    } else if (resourceType === "Observation") {
      hl7Message = `MSH|^~\\&|TABULA_MEDICA|LAB|RECEIVING|FACILITY|${timestamp}||ORU^R01|${controlId}|P|2.5.1|||AL|NE\r`;

      const obx = this.buildOBXSegment(fhirResource);
      hl7Message += `PID|1\r`;
      hl7Message += obx + "\r";

      details.push(
        { sourceField: "Observation.code", targetField: "OBX-3", transformation: "Code mapping (CWE)", confidence: 0.95 },
        { sourceField: "Observation.value", targetField: "OBX-5", transformation: "Value type detection", confidence: 0.9 },
        { sourceField: "Observation.status", targetField: "OBX-11", transformation: "Status code mapping", confidence: 1.0 },
        { sourceField: "Observation.effectiveDateTime", targetField: "OBX-14", transformation: "DateTime format", confidence: 1.0 }
      );

      messages.push("Successfully mapped FHIR Observation to HL7v2 ORU^R01 message");
    }

    return { data: hl7Message, details, messages };
  }

  private async mapHL7v2ToFHIR(hl7Message: string): Promise<{ data: any; details: MappingDetail[]; messages: string[] }> {
    const details: MappingDetail[] = [];
    const messages: string[] = [];
    const resources: FHIRResource[] = [];

    const segments = hl7Message.split(/[\r\n]+/).filter(s => s.trim());
    let messageType = "";

    for (const segment of segments) {
      const fields = segment.split("|");
      const segmentType = fields[0];

      if (segmentType === "MSH") {
        const msgTypeField = fields[8] || "";
        messageType = msgTypeField.split("^")[0];
      } else if (segmentType === "PID") {
        const patient = this.parsePIDToFHIR(fields);
        resources.push(patient);
        
        details.push(
          { sourceField: "PID-3", targetField: "Patient.identifier", transformation: "CX to Identifier", confidence: 0.95 },
          { sourceField: "PID-5", targetField: "Patient.name", transformation: "XPN to HumanName", confidence: 0.95 },
          { sourceField: "PID-7", targetField: "Patient.birthDate", transformation: "TS to date", confidence: 1.0 },
          { sourceField: "PID-8", targetField: "Patient.gender", transformation: "IS to code", confidence: 1.0 }
        );
      } else if (segmentType === "OBX") {
        const observation = this.parseOBXToFHIR(fields);
        resources.push(observation);
        
        details.push(
          { sourceField: "OBX-3", targetField: "Observation.code", transformation: "CWE to CodeableConcept", confidence: 0.95 },
          { sourceField: "OBX-5", targetField: "Observation.value", transformation: "Value type mapping", confidence: 0.9 },
          { sourceField: "OBX-11", targetField: "Observation.status", transformation: "ID to status code", confidence: 1.0 }
        );
      }
    }

    const bundle: FHIRResource = {
      resourceType: "Bundle",
      type: "collection",
      entry: resources.map(r => ({ resource: r }))
    };

    messages.push(`Successfully parsed HL7v2 ${messageType} message`);
    messages.push(`Created ${resources.length} FHIR resource(s)`);

    return { data: bundle, details, messages };
  }

  private async mapCCDAToFHIR(ccdaData: any): Promise<{ data: any; details: MappingDetail[]; messages: string[] }> {
    const details: MappingDetail[] = [];
    const messages: string[] = [];
    const resources: FHIRResource[] = [];

    if (ccdaData.recordTarget?.patientRole) {
      const patientRole = ccdaData.recordTarget.patientRole;
      const patient: FHIRResource = {
        resourceType: "Patient",
        id: patientRole.id?.extension || crypto.randomUUID(),
        identifier: [{
          system: patientRole.id?.root || "urn:oid:2.16.840.1.113883.4.1",
          value: patientRole.id?.extension
        }]
      };

      if (patientRole.patient?.name) {
        patient.name = [this.mapCCDANameToFHIR(patientRole.patient.name)];
        details.push({ sourceField: "patientRole.patient.name", targetField: "Patient.name", transformation: "PN to HumanName", confidence: 0.95 });
      }

      if (patientRole.patient?.administrativeGenderCode) {
        patient.gender = this.mapCCDAGenderToFHIR(patientRole.patient.administrativeGenderCode.code);
        details.push({ sourceField: "administrativeGenderCode", targetField: "Patient.gender", transformation: "Code mapping", confidence: 1.0 });
      }

      if (patientRole.patient?.birthTime) {
        patient.birthDate = this.formatCCDADateToFHIR(patientRole.patient.birthTime.value);
        details.push({ sourceField: "birthTime", targetField: "Patient.birthDate", transformation: "TS to date", confidence: 1.0 });
      }

      resources.push(patient);
    }

    const bundle: FHIRResource = {
      resourceType: "Bundle",
      type: "collection",
      entry: resources.map(r => ({ resource: r }))
    };

    messages.push("Successfully parsed C-CDA document");
    messages.push(`Created ${resources.length} FHIR resource(s)`);

    return { data: bundle, details, messages };
  }

  private async aiAssistedMapping(
    sourceData: any,
    sourceFormat: string,
    targetFormat: string
  ): Promise<{ data: any; details: MappingDetail[]; messages: string[]; confidence: number }> {
    const details: MappingDetail[] = [];
    const messages: string[] = [];

    if (!aiEnabled) {
      messages.push("warning: AI-assisted mapping unavailable, using rule-based fallback");
      return {
        data: { note: "AI mapping not available", sourceData },
        details: [{ sourceField: "source", targetField: "target", transformation: "Passthrough (AI unavailable)", confidence: 0.5 }],
        messages,
        confidence: 0.5
      };
    }

    try {
      const responseText = await generatePhiSafeText({
        system: `You are a healthcare data interoperability expert. Map the provided ${sourceFormat} data to ${targetFormat} format.

IMPORTANT: This is for informational purposes only. Do NOT provide clinical decision support or medical advice.
Always add the disclaimer: "This mapping is for data transformation only. Verify accuracy before clinical use."

Return a JSON object with:
- mappedData: The converted data structure
- fieldMappings: Array of {sourceField, targetField, transformation, confidence}
- notes: Array of any warnings or notes about the mapping`,
        user: `Map this ${sourceFormat} data to ${targetFormat}:\n\n${JSON.stringify(sourceData, null, 2)}`,
        responseMimeType: "application/json",
        maxTokens: 2000
      });

      const result = JSON.parse(responseText || "{}");
      
      if (result.fieldMappings) {
        for (const fm of result.fieldMappings) {
          details.push({
            sourceField: fm.sourceField,
            targetField: fm.targetField,
            transformation: fm.transformation,
            confidence: fm.confidence || 0.8,
            notes: "AI-assisted mapping"
          });
        }
      }

      messages.push("AI-assisted mapping completed");
      messages.push("Disclaimer: This mapping is for data transformation only. Verify accuracy before clinical use.");
      if (result.notes) {
        messages.push(...result.notes);
      }

      return {
        data: result.mappedData || sourceData,
        details,
        messages,
        confidence: 0.85
      };
    } catch (error: any) {
      messages.push(`warning: AI mapping failed: ${error.message}`);
      return {
        data: sourceData,
        details: [{ sourceField: "source", targetField: "target", transformation: "Passthrough (error)", confidence: 0.3 }],
        messages,
        confidence: 0.3
      };
    }
  }

  private performRuleBasedMapping(
    sourceData: any,
    sourceFormat: string,
    targetFormat: string
  ): { data: any; details: MappingDetail[]; messages: string[]; confidence: number } {
    const details: MappingDetail[] = [];
    const messages: string[] = ["Using rule-based mapping (AI unavailable)"];
    
    let mappedData: any = {};
    
    if (sourceFormat === "fhir-r4" && targetFormat === "c-cda") {
      if (sourceData.resourceType === "Patient") {
        mappedData = {
          templateId: "2.16.840.1.113883.10.20.22.1.1",
          recordTarget: {
            patientRole: {
              patient: {
                name: this.mapFHIRNameToCCDA(sourceData.name?.[0]),
                administrativeGenderCode: sourceData.gender?.charAt(0).toUpperCase(),
                birthTime: { value: sourceData.birthDate?.replace(/-/g, "") }
              }
            }
          }
        };
        details.push({ sourceField: "name", targetField: "recordTarget.patientRole.patient.name", transformation: "FHIR name to C-CDA name", confidence: 0.8 });
        details.push({ sourceField: "gender", targetField: "administrativeGenderCode", transformation: "Gender code mapping", confidence: 0.9 });
        details.push({ sourceField: "birthDate", targetField: "birthTime.value", transformation: "Date format conversion", confidence: 0.95 });
      }
    } else if (sourceFormat === "hl7v2" && targetFormat === "fhir-r4") {
      if (sourceData.PID) {
        const nameParts = (sourceData.PID.patientName || "").split("^");
        mappedData = {
          resourceType: "Patient",
          id: `patient-${Date.now()}`,
          name: [{ family: nameParts[0] || "", given: nameParts.slice(1) }],
          gender: this.mapHL7GenderToFHIR(sourceData.PID.sex),
          birthDate: this.formatHL7DateToFHIR(sourceData.PID.dateOfBirth)
        };
        details.push({ sourceField: "PID.patientName", targetField: "name", transformation: "HL7v2 XPN to FHIR HumanName", confidence: 0.85 });
        details.push({ sourceField: "PID.sex", targetField: "gender", transformation: "HL7v2 gender code to FHIR", confidence: 0.9 });
        details.push({ sourceField: "PID.dateOfBirth", targetField: "birthDate", transformation: "Date format conversion", confidence: 0.95 });
      }
    } else {
      mappedData = { ...sourceData, _mappingNote: `Passthrough from ${sourceFormat} to ${targetFormat}` };
      details.push({ sourceField: "source", targetField: "target", transformation: "Passthrough (no specific rules)", confidence: 0.5 });
      messages.push("No specific mapping rules found for this format combination");
    }

    return {
      data: mappedData,
      details,
      messages,
      confidence: details.length > 0 ? details.reduce((sum, d) => sum + d.confidence, 0) / details.length : 0.5
    };
  }

  private mapHL7GenderToFHIR(hl7Gender: string): string {
    const genderMap: Record<string, string> = { M: "male", F: "female", O: "other", U: "unknown" };
    return genderMap[hl7Gender?.toUpperCase()] || "unknown";
  }

  private formatHL7DateToFHIR(hl7Date: string): string {
    if (!hl7Date || hl7Date.length < 8) return "";
    return `${hl7Date.substring(0, 4)}-${hl7Date.substring(4, 6)}-${hl7Date.substring(6, 8)}`;
  }

  private mapFHIRNameToCCDA(name: any): any {
    if (!name) return null;
    return {
      given: name.given?.join(" "),
      family: name.family
    };
  }

  private mapFHIRAddressToCCDA(address: any): any {
    if (!address) return null;
    return {
      streetAddressLine: address.line?.join(", "),
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country
    };
  }

  private mapFHIRCodeToCCDA(code: any): any {
    if (!code) return null;
    const coding = code.coding?.[0];
    return {
      code: coding?.code,
      codeSystem: this.mapCodeSystemToOID(coding?.system),
      displayName: coding?.display
    };
  }

  private mapFHIRValueToCCDA(value: any): any {
    if (!value) return null;
    if (value.value !== undefined) {
      return {
        "@xsi:type": "PQ",
        "@value": value.value,
        "@unit": value.unit
      };
    }
    return value;
  }

  private mapCodeSystemToOID(system: string | undefined): string {
    const oidMap: Record<string, string> = {
      "http://loinc.org": "2.16.840.1.113883.6.1",
      "http://snomed.info/sct": "2.16.840.1.113883.6.96",
      "http://www.nlm.nih.gov/research/umls/rxnorm": "2.16.840.1.113883.6.88",
      "http://hl7.org/fhir/sid/icd-10-cm": "2.16.840.1.113883.6.90"
    };
    return oidMap[system || ""] || "2.16.840.1.113883.6.1";
  }

  private mapGenderCode(gender: string | undefined): string {
    const genderMap: Record<string, string> = {
      "male": "M",
      "female": "F",
      "other": "UN",
      "unknown": "UN"
    };
    return genderMap[gender || "unknown"] || "UN";
  }

  private mapObservationStatus(status: string | undefined): string {
    const statusMap: Record<string, string> = {
      "registered": "new",
      "preliminary": "active",
      "final": "completed",
      "amended": "completed",
      "cancelled": "cancelled"
    };
    return statusMap[status || "final"] || "completed";
  }

  private buildPIDSegment(patient: FHIRResource): string {
    const id = patient.identifier?.[0]?.value || patient.id || "";
    const name = patient.name?.[0];
    const familyName = name?.family || "";
    const givenName = name?.given?.join(" ") || "";
    const birthDate = patient.birthDate?.replace(/-/g, "") || "";
    const gender = this.mapGenderCode(patient.gender);
    const address = patient.address?.[0];
    const addressStr = address ? `${address.line?.join("^") || ""}^^${address.city || ""}^${address.state || ""}^${address.postalCode || ""}` : "";

    return `PID|1||${id}||${familyName}^${givenName}||${birthDate}|${gender}|||${addressStr}`;
  }

  private buildOBXSegment(observation: FHIRResource): string {
    const code = observation.code?.coding?.[0];
    const codeStr = `${code?.code || ""}^${code?.display || ""}^${code?.system === "http://loinc.org" ? "LN" : "99LOC"}`;
    const valueType = observation.valueQuantity ? "NM" : observation.valueString ? "ST" : "TX";
    const value = observation.valueQuantity?.value || observation.valueString || observation.valueCodeableConcept?.text || "";
    const units = observation.valueQuantity?.unit || "";
    const status = observation.status === "final" ? "F" : "P";
    const dateTime = observation.effectiveDateTime?.replace(/[-:T.Z]/g, "").substring(0, 14) || "";

    return `OBX|1|${valueType}|${codeStr}||${value}|${units}||||${status}|||${dateTime}`;
  }

  private parsePIDToFHIR(fields: string[]): FHIRResource {
    const patient: FHIRResource = {
      resourceType: "Patient",
      id: crypto.randomUUID()
    };

    if (fields[3]) {
      patient.identifier = [{ value: fields[3].split("^")[0] }];
    }

    if (fields[5]) {
      const nameParts = fields[5].split("^");
      patient.name = [{
        family: nameParts[0] || "",
        given: nameParts.slice(1).filter(Boolean)
      }];
    }

    if (fields[7]) {
      patient.birthDate = `${fields[7].substring(0, 4)}-${fields[7].substring(4, 6)}-${fields[7].substring(6, 8)}`;
    }

    if (fields[8]) {
      const genderMap: Record<string, string> = { "M": "male", "F": "female", "U": "unknown", "O": "other" };
      patient.gender = genderMap[fields[8]] || "unknown";
    }

    return patient;
  }

  private parseOBXToFHIR(fields: string[]): FHIRResource {
    const observation: FHIRResource = {
      resourceType: "Observation",
      id: crypto.randomUUID(),
      status: fields[11] === "F" ? "final" : "preliminary"
    };

    if (fields[3]) {
      const codeParts = fields[3].split("^");
      observation.code = {
        coding: [{
          code: codeParts[0],
          display: codeParts[1] || "",
          system: codeParts[2] === "LN" ? "http://loinc.org" : undefined
        }]
      };
    }

    if (fields[5]) {
      if (fields[2] === "NM") {
        observation.valueQuantity = {
          value: parseFloat(fields[5]),
          unit: fields[6] || ""
        };
      } else {
        observation.valueString = fields[5];
      }
    }

    return observation;
  }

  private mapCCDANameToFHIR(ccdaName: any): any {
    return {
      family: ccdaName?.family || "",
      given: ccdaName?.given ? [ccdaName.given] : []
    };
  }

  private mapCCDAGenderToFHIR(code: string): string {
    const genderMap: Record<string, string> = { "M": "male", "F": "female", "UN": "unknown" };
    return genderMap[code] || "unknown";
  }

  private formatCCDADateToFHIR(ccdaDate: string): string {
    if (!ccdaDate || ccdaDate.length < 8) return "";
    return `${ccdaDate.substring(0, 4)}-${ccdaDate.substring(4, 6)}-${ccdaDate.substring(6, 8)}`;
  }

  getSupportedStandards(): SupportedStandard[] {
    return this.supportedStandards;
  }

  getMappingTemplates(): MappingTemplate[] {
    return this.mappingTemplates;
  }

  getMappingHistory(): MappingResult[] {
    return this.mappingHistory;
  }

  getMappingById(id: string): MappingResult | undefined {
    return this.mappingHistory.find(m => m.id === id);
  }

  getStatistics(): {
    totalMappings: number;
    successfulMappings: number;
    failedMappings: number;
    averageConfidence: number;
    mappingsByFormat: Record<string, number>;
  } {
    const successful = this.mappingHistory.filter(m => m.validationStatus === "success").length;
    const failed = this.mappingHistory.filter(m => m.validationStatus === "error").length;
    const avgConfidence = this.mappingHistory.length > 0
      ? this.mappingHistory.reduce((sum, m) => sum + m.confidence, 0) / this.mappingHistory.length
      : 0;

    const mappingsByFormat: Record<string, number> = {};
    for (const m of this.mappingHistory) {
      const key = `${m.sourceFormat} -> ${m.targetFormat}`;
      mappingsByFormat[key] = (mappingsByFormat[key] || 0) + 1;
    }

    return {
      totalMappings: this.mappingHistory.length,
      successfulMappings: successful,
      failedMappings: failed,
      averageConfidence: avgConfidence,
      mappingsByFormat
    };
  }
}

export const fhirStandardsMappingService = new FHIRStandardsMappingService();
