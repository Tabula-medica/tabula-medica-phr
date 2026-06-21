import OpenAI from "openai";
import { comprehensiveAuditTrailService } from "./comprehensive-audit-trail-service";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface FHIRResource {
  resourceType: string;
  id: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  [key: string]: unknown;
}

export interface GeneratedResource {
  id: string;
  resource: FHIRResource;
  naturalLanguageInput: string;
  generatedAt: string;
  confidence: number;
  warnings: string[];
  linkedResources: ResourceLink[];
  disclaimer: string;
}

export interface ResourceLink {
  id: string;
  sourceResourceType: string;
  sourceResourceId: string;
  targetResourceType: string;
  targetResourceId: string;
  linkType: "reference" | "subject" | "performer" | "encounter" | "author" | "basedOn" | "partOf";
  confidence: number;
  autoLinked: boolean;
  rationale: string;
}

export interface StructureSuggestion {
  id: string;
  resourceType: string;
  useCase: string;
  clinicalGuideline?: string;
  suggestedFields: SuggestedField[];
  requiredExtensions: ExtensionSuggestion[];
  validationRules: string[];
  examples: FHIRResource[];
  confidence: number;
  rationale: string;
}

export interface SuggestedField {
  path: string;
  description: string;
  required: boolean;
  dataType: string;
  example: string;
  clinicalRelevance: "critical" | "high" | "medium" | "low";
}

export interface ExtensionSuggestion {
  url: string;
  description: string;
  valueType: string;
  required: boolean;
}

export interface ResourceMetadata {
  version: string;
  supportedResourceTypes: string[];
  totalGenerated: number;
  totalLinks: number;
  totalSuggestions: number;
  noCdsCompliance: string;
}

const SUPPORTED_RESOURCE_TYPES = [
  "Patient", "Practitioner", "Organization", "Encounter",
  "Observation", "Condition", "Procedure", "MedicationRequest",
  "MedicationStatement", "AllergyIntolerance", "Immunization",
  "DiagnosticReport", "CarePlan", "CareTeam", "Goal",
  "ServiceRequest", "Appointment", "DocumentReference"
];

const generatedResources: Map<string, GeneratedResource> = new Map();
const resourceLinks: Map<string, ResourceLink> = new Map();
const structureSuggestions: Map<string, StructureSuggestion> = new Map();

const NO_CDS_DISCLAIMER = "INFORMATIONAL ONLY: This AI-generated FHIR resource is for DATA MANAGEMENT and INTEROPERABILITY purposes ONLY. It does NOT constitute clinical decision support, medical advice, or treatment recommendations. All generated resources must be reviewed by qualified personnel before use in clinical workflows.";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function isOpenAIConfigured(): boolean {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  return !!(apiKey && !apiKey.includes('DUMMY') && apiKey.length >= 20);
}

async function logAuditEntry(
  userId: string,
  action: string,
  success: boolean,
  metadata: Record<string, unknown>
): Promise<void> {
  await comprehensiveAuditTrailService.logAuditEntry(userId, {
    who: {
      userId,
      userRole: "user",
      sessionId: `session-${Date.now()}`,
    },
    what: {
      category: "ai_prediction",
      action: success ? "create" : "error",
      resourceType: "FHIRResource",
      resourceId: metadata.resourceId as string || "unknown",
      description: `AI FHIR Resource Management: ${action}`,
    },
    why: {
      reason: "FHIR resource management via AI",
      businessJustification: "User-initiated AI resource operation",
      automatedAction: false,
    },
    result: {
      success,
      errorMessage: !success && metadata.error ? String(metadata.error) : undefined,
    },
    context: {
      ipAddress: "internal",
      userAgent: "AI-FHIR-Resource-Management-Service",
      requestId: generateId(),
    },
    severity: success ? "info" : "warning",
    tags: ["ai", "fhir", "resource-management"],
    phiAccessed: true,
    complianceFlags: ["HIPAA", "NO-CDS"],
    metadata,
  });
}

class AIFHIRResourceManagementService {
  constructor() {
    this.initializeSampleData();
    console.log("[AIFHIRResourceManagement] Service initialized");
    console.log("[AIFHIRResourceManagement] Supported resource types:", SUPPORTED_RESOURCE_TYPES.length);
    console.log("[AIFHIRResourceManagement] NO-CDS compliance enabled for all outputs");
  }

  private initializeSampleData(): void {
    const samplePatient: GeneratedResource = {
      id: "gen-patient-1",
      resource: {
        resourceType: "Patient",
        id: "patient-john-doe",
        meta: {
          versionId: "1",
          lastUpdated: new Date().toISOString(),
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"]
        },
        identifier: [{
          system: "http://hospital.example.org/mrn",
          value: "MRN-12345"
        }],
        name: [{
          use: "official",
          family: "Doe",
          given: ["John", "Michael"]
        }],
        gender: "male",
        birthDate: "1985-03-15",
        address: [{
          use: "home",
          line: ["123 Main Street"],
          city: "Boston",
          state: "MA",
          postalCode: "02101"
        }],
        telecom: [{
          system: "phone",
          value: "555-123-4567",
          use: "mobile"
        }]
      },
      naturalLanguageInput: "Create a patient record for John Michael Doe, male, born March 15, 1985, living at 123 Main Street, Boston, MA 02101, phone 555-123-4567",
      generatedAt: new Date().toISOString(),
      confidence: 0.95,
      warnings: [],
      linkedResources: [],
      disclaimer: NO_CDS_DISCLAIMER
    };

    const sampleObservation: GeneratedResource = {
      id: "gen-obs-1",
      resource: {
        resourceType: "Observation",
        id: "obs-bp-1",
        meta: {
          versionId: "1",
          lastUpdated: new Date().toISOString(),
          profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-blood-pressure"]
        },
        status: "final",
        category: [{
          coding: [{
            system: "http://terminology.hl7.org/CodeSystem/observation-category",
            code: "vital-signs",
            display: "Vital Signs"
          }]
        }],
        code: {
          coding: [{
            system: "http://loinc.org",
            code: "85354-9",
            display: "Blood pressure panel"
          }]
        },
        subject: {
          reference: "Patient/patient-john-doe"
        },
        effectiveDateTime: new Date().toISOString(),
        component: [
          {
            code: {
              coding: [{
                system: "http://loinc.org",
                code: "8480-6",
                display: "Systolic blood pressure"
              }]
            },
            valueQuantity: {
              value: 120,
              unit: "mmHg",
              system: "http://unitsofmeasure.org",
              code: "mm[Hg]"
            }
          },
          {
            code: {
              coding: [{
                system: "http://loinc.org",
                code: "8462-4",
                display: "Diastolic blood pressure"
              }]
            },
            valueQuantity: {
              value: 80,
              unit: "mmHg",
              system: "http://unitsofmeasure.org",
              code: "mm[Hg]"
            }
          }
        ]
      },
      naturalLanguageInput: "Record blood pressure 120/80 mmHg for patient John Doe",
      generatedAt: new Date().toISOString(),
      confidence: 0.92,
      warnings: [],
      linkedResources: [],
      disclaimer: NO_CDS_DISCLAIMER
    };

    generatedResources.set(samplePatient.id, samplePatient);
    generatedResources.set(sampleObservation.id, sampleObservation);

    const link1: ResourceLink = {
      id: "link-1",
      sourceResourceType: "Observation",
      sourceResourceId: "obs-bp-1",
      targetResourceType: "Patient",
      targetResourceId: "patient-john-doe",
      linkType: "subject",
      confidence: 0.98,
      autoLinked: true,
      rationale: "Blood pressure observation automatically linked to patient John Doe based on natural language context"
    };
    resourceLinks.set(link1.id, link1);

    const suggestion1: StructureSuggestion = {
      id: "suggest-1",
      resourceType: "Observation",
      useCase: "Vital Signs Recording",
      clinicalGuideline: "HL7 US Core Vital Signs Profile",
      suggestedFields: [
        { path: "status", description: "Observation status (registered, preliminary, final, amended)", required: true, dataType: "code", example: "final", clinicalRelevance: "critical" },
        { path: "category", description: "Classification of observation type", required: true, dataType: "CodeableConcept", example: "vital-signs", clinicalRelevance: "high" },
        { path: "code", description: "Type of observation (LOINC code)", required: true, dataType: "CodeableConcept", example: "85354-9", clinicalRelevance: "critical" },
        { path: "subject", description: "Who the observation is about", required: true, dataType: "Reference(Patient)", example: "Patient/123", clinicalRelevance: "critical" },
        { path: "effectiveDateTime", description: "When the observation was made", required: true, dataType: "dateTime", example: "2026-01-15T10:30:00Z", clinicalRelevance: "high" },
        { path: "performer", description: "Who performed the observation", required: false, dataType: "Reference(Practitioner)", example: "Practitioner/456", clinicalRelevance: "medium" }
      ],
      requiredExtensions: [],
      validationRules: [
        "Status must be one of: registered, preliminary, final, amended, corrected, cancelled, entered-in-error, unknown",
        "Category should include vital-signs for vital sign observations",
        "Code must be a valid LOINC code for the observation type",
        "Subject reference must point to a valid Patient resource"
      ],
      examples: [],
      confidence: 0.95,
      rationale: "Based on HL7 US Core Implementation Guide for vital signs observations"
    };
    structureSuggestions.set(suggestion1.id, suggestion1);

    console.log("[AIFHIRResourceManagement] Sample data initialized");
    console.log(`[AIFHIRResourceManagement] Generated resources: ${generatedResources.size}`);
    console.log(`[AIFHIRResourceManagement] Resource links: ${resourceLinks.size}`);
    console.log(`[AIFHIRResourceManagement] Structure suggestions: ${structureSuggestions.size}`);
  }

  getMetadata(): ResourceMetadata {
    return {
      version: "1.0.0",
      supportedResourceTypes: SUPPORTED_RESOURCE_TYPES,
      totalGenerated: generatedResources.size,
      totalLinks: resourceLinks.size,
      totalSuggestions: structureSuggestions.size,
      noCdsCompliance: NO_CDS_DISCLAIMER
    };
  }

  getGeneratedResources(): GeneratedResource[] {
    return Array.from(generatedResources.values()).sort(
      (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );
  }

  getResourceLinks(): ResourceLink[] {
    return Array.from(resourceLinks.values());
  }

  getStructureSuggestions(): StructureSuggestion[] {
    return Array.from(structureSuggestions.values());
  }

  async generateResourceFromNaturalLanguage(
    userId: string,
    naturalLanguageInput: string,
    resourceType?: string
  ): Promise<GeneratedResource> {
    const startTime = Date.now();

    try {
      let generatedResource: GeneratedResource;

      if (isOpenAIConfigured()) {
        generatedResource = await this.generateWithAI(naturalLanguageInput, resourceType);
      } else {
        console.log("[AIFHIRResourceManagement] OpenAI not configured, using fallback generation");
        generatedResource = this.generateFallbackResource(naturalLanguageInput, resourceType);
      }

      generatedResources.set(generatedResource.id, generatedResource);

      const autoLinks = await this.autoLinkResource(userId, generatedResource);
      generatedResource.linkedResources = autoLinks;

      await logAuditEntry(userId, "resource_generation", true, {
        resourceId: generatedResource.id,
        resourceType: generatedResource.resource.resourceType,
        confidence: generatedResource.confidence,
        linksCreated: autoLinks.length,
        duration: Date.now() - startTime
      });

      return generatedResource;
    } catch (error) {
      await logAuditEntry(userId, "resource_generation", false, {
        error: error instanceof Error ? error.message : "Unknown error",
        input: naturalLanguageInput.substring(0, 100)
      });
      throw error;
    }
  }

  private async generateWithAI(
    naturalLanguageInput: string,
    resourceType?: string
  ): Promise<GeneratedResource> {
    const prompt = `You are an expert in FHIR R4 resource creation. Generate a valid FHIR R4 resource based on the following natural language description.

Natural Language Input: "${naturalLanguageInput}"
${resourceType ? `Requested Resource Type: ${resourceType}` : "Determine the most appropriate resource type from the description."}

IMPORTANT REQUIREMENTS:
1. Generate a complete, valid FHIR R4 resource in JSON format
2. Use standard terminology systems (LOINC, SNOMED CT, ICD-10, RxNorm) where applicable
3. Include appropriate meta information with profiles if applicable
4. Generate a unique ID for the resource
5. Include all required fields for the resource type
6. Add any relevant optional fields based on the description

Respond with a JSON object containing:
{
  "resourceType": "the FHIR resource type",
  "resource": { the complete FHIR resource object },
  "confidence": 0.0-1.0 confidence score,
  "warnings": ["any warnings or assumptions made"],
  "suggestedLinks": ["descriptions of resources that should be linked"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    const generatedId = generateId();

    return {
      id: `gen-${generatedId}`,
      resource: {
        ...parsed.resource,
        id: parsed.resource.id || `res-${generatedId}`,
        meta: {
          ...parsed.resource.meta,
          versionId: "1",
          lastUpdated: new Date().toISOString()
        }
      },
      naturalLanguageInput,
      generatedAt: new Date().toISOString(),
      confidence: parsed.confidence || 0.85,
      warnings: parsed.warnings || [],
      linkedResources: [],
      disclaimer: NO_CDS_DISCLAIMER
    };
  }

  private generateFallbackResource(
    naturalLanguageInput: string,
    resourceType?: string
  ): GeneratedResource {
    const input = naturalLanguageInput.toLowerCase();
    const generatedId = generateId();

    let detectedType = resourceType || "Observation";
    if (!resourceType) {
      if (input.includes("patient") || input.includes("person") || input.includes("born")) {
        detectedType = "Patient";
      } else if (input.includes("condition") || input.includes("diagnosis") || input.includes("disease")) {
        detectedType = "Condition";
      } else if (input.includes("medication") || input.includes("prescription") || input.includes("drug")) {
        detectedType = "MedicationRequest";
      } else if (input.includes("allergy") || input.includes("allergic")) {
        detectedType = "AllergyIntolerance";
      } else if (input.includes("procedure") || input.includes("surgery")) {
        detectedType = "Procedure";
      } else if (input.includes("immunization") || input.includes("vaccine") || input.includes("vaccination")) {
        detectedType = "Immunization";
      } else if (input.includes("appointment") || input.includes("schedule") || input.includes("visit")) {
        detectedType = "Appointment";
      }
    }

    let resource: FHIRResource;
    switch (detectedType) {
      case "Patient":
        resource = this.generateFallbackPatient(input, generatedId);
        break;
      case "Condition":
        resource = this.generateFallbackCondition(input, generatedId);
        break;
      case "MedicationRequest":
        resource = this.generateFallbackMedicationRequest(input, generatedId);
        break;
      case "AllergyIntolerance":
        resource = this.generateFallbackAllergy(input, generatedId);
        break;
      default:
        resource = this.generateFallbackObservation(input, generatedId);
    }

    return {
      id: `gen-${generatedId}`,
      resource,
      naturalLanguageInput,
      generatedAt: new Date().toISOString(),
      confidence: 0.75,
      warnings: ["Generated using template-based fallback (AI not configured)", "Please review all fields for accuracy"],
      linkedResources: [],
      disclaimer: NO_CDS_DISCLAIMER
    };
  }

  private generateFallbackPatient(input: string, id: string): FHIRResource {
    const nameMatch = input.match(/(?:for|named?)\s+([a-z]+(?:\s+[a-z]+)*)/i);
    const name = nameMatch ? nameMatch[1].split(" ") : ["Unknown"];

    return {
      resourceType: "Patient",
      id: `patient-${id}`,
      meta: {
        versionId: "1",
        lastUpdated: new Date().toISOString(),
        profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"]
      },
      identifier: [{
        system: "http://hospital.example.org/mrn",
        value: `MRN-${Math.floor(Math.random() * 100000)}`
      }],
      name: [{
        use: "official",
        family: name[name.length - 1] || "Unknown",
        given: name.slice(0, -1).length > 0 ? name.slice(0, -1) : ["Unknown"]
      }],
      gender: input.includes("female") || input.includes("woman") || input.includes("girl") ? "female" : 
              input.includes("male") || input.includes("man") || input.includes("boy") ? "male" : "unknown",
      birthDate: "1990-01-01"
    };
  }

  private generateFallbackCondition(input: string, id: string): FHIRResource {
    return {
      resourceType: "Condition",
      id: `condition-${id}`,
      meta: {
        versionId: "1",
        lastUpdated: new Date().toISOString()
      },
      clinicalStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
          code: "active",
          display: "Active"
        }]
      },
      verificationStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          code: "confirmed",
          display: "Confirmed"
        }]
      },
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/condition-category",
          code: "encounter-diagnosis",
          display: "Encounter Diagnosis"
        }]
      }],
      code: {
        text: "Condition extracted from natural language input"
      },
      recordedDate: new Date().toISOString().split('T')[0]
    };
  }

  private generateFallbackMedicationRequest(input: string, id: string): FHIRResource {
    return {
      resourceType: "MedicationRequest",
      id: `medrx-${id}`,
      meta: {
        versionId: "1",
        lastUpdated: new Date().toISOString()
      },
      status: "active",
      intent: "order",
      medicationCodeableConcept: {
        text: "Medication extracted from natural language input"
      },
      authoredOn: new Date().toISOString()
    };
  }

  private generateFallbackAllergy(input: string, id: string): FHIRResource {
    return {
      resourceType: "AllergyIntolerance",
      id: `allergy-${id}`,
      meta: {
        versionId: "1",
        lastUpdated: new Date().toISOString()
      },
      clinicalStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical",
          code: "active",
          display: "Active"
        }]
      },
      verificationStatus: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-verification",
          code: "confirmed",
          display: "Confirmed"
        }]
      },
      type: "allergy",
      category: ["medication"],
      code: {
        text: "Allergy extracted from natural language input"
      },
      recordedDate: new Date().toISOString()
    };
  }

  private generateFallbackObservation(input: string, id: string): FHIRResource {
    return {
      resourceType: "Observation",
      id: `obs-${id}`,
      meta: {
        versionId: "1",
        lastUpdated: new Date().toISOString()
      },
      status: "final",
      category: [{
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/observation-category",
          code: "vital-signs",
          display: "Vital Signs"
        }]
      }],
      code: {
        text: "Observation extracted from natural language input"
      },
      effectiveDateTime: new Date().toISOString()
    };
  }

  async autoLinkResource(
    userId: string,
    generatedResource: GeneratedResource
  ): Promise<ResourceLink[]> {
    const links: ResourceLink[] = [];
    const resource = generatedResource.resource;

    const existingResources = this.getGeneratedResources().filter(
      r => r.id !== generatedResource.id
    );

    if (resource.resourceType !== "Patient") {
      const patients = existingResources.filter(r => r.resource.resourceType === "Patient");
      if (patients.length > 0) {
        const patientLink: ResourceLink = {
          id: `link-${generateId()}`,
          sourceResourceType: resource.resourceType,
          sourceResourceId: resource.id,
          targetResourceType: "Patient",
          targetResourceId: patients[0].resource.id,
          linkType: "subject",
          confidence: 0.85,
          autoLinked: true,
          rationale: "Auto-linked to most recently created Patient resource"
        };
        links.push(patientLink);
        resourceLinks.set(patientLink.id, patientLink);
      }
    }

    if (["Observation", "Procedure", "DiagnosticReport", "MedicationRequest"].includes(resource.resourceType)) {
      const practitioners = existingResources.filter(r => r.resource.resourceType === "Practitioner");
      if (practitioners.length > 0) {
        const practitionerLink: ResourceLink = {
          id: `link-${generateId()}`,
          sourceResourceType: resource.resourceType,
          sourceResourceId: resource.id,
          targetResourceType: "Practitioner",
          targetResourceId: practitioners[0].resource.id,
          linkType: "performer",
          confidence: 0.75,
          autoLinked: true,
          rationale: "Auto-linked to available Practitioner resource as performer"
        };
        links.push(practitionerLink);
        resourceLinks.set(practitionerLink.id, practitionerLink);
      }
    }

    if (links.length > 0) {
      await logAuditEntry(userId, "auto_linking", true, {
        resourceId: generatedResource.id,
        linksCreated: links.length,
        linkTypes: links.map(l => l.linkType)
      });
    }

    return links;
  }

  async createManualLink(
    userId: string,
    sourceResourceId: string,
    targetResourceId: string,
    linkType: ResourceLink["linkType"]
  ): Promise<ResourceLink> {
    const sourceResource = Array.from(generatedResources.values()).find(
      r => r.resource.id === sourceResourceId || r.id === sourceResourceId
    );
    const targetResource = Array.from(generatedResources.values()).find(
      r => r.resource.id === targetResourceId || r.id === targetResourceId
    );

    if (!sourceResource || !targetResource) {
      throw new Error("Source or target resource not found");
    }

    const link: ResourceLink = {
      id: `link-${generateId()}`,
      sourceResourceType: sourceResource.resource.resourceType,
      sourceResourceId: sourceResource.resource.id,
      targetResourceType: targetResource.resource.resourceType,
      targetResourceId: targetResource.resource.id,
      linkType,
      confidence: 1.0,
      autoLinked: false,
      rationale: "Manually created link by user"
    };

    resourceLinks.set(link.id, link);

    await logAuditEntry(userId, "manual_linking", true, {
      linkId: link.id,
      sourceResourceType: link.sourceResourceType,
      targetResourceType: link.targetResourceType,
      linkType
    });

    return link;
  }

  async suggestStructure(
    userId: string,
    resourceType: string,
    useCase: string
  ): Promise<StructureSuggestion> {
    const startTime = Date.now();

    try {
      let suggestion: StructureSuggestion;

      if (isOpenAIConfigured()) {
        suggestion = await this.suggestWithAI(resourceType, useCase);
      } else {
        console.log("[AIFHIRResourceManagement] OpenAI not configured, using fallback suggestions");
        suggestion = this.getFallbackSuggestion(resourceType, useCase);
      }

      structureSuggestions.set(suggestion.id, suggestion);

      await logAuditEntry(userId, "structure_suggestion", true, {
        suggestionId: suggestion.id,
        resourceType,
        useCase,
        fieldsCount: suggestion.suggestedFields.length,
        duration: Date.now() - startTime
      });

      return suggestion;
    } catch (error) {
      await logAuditEntry(userId, "structure_suggestion", false, {
        error: error instanceof Error ? error.message : "Unknown error",
        resourceType,
        useCase
      });
      throw error;
    }
  }

  private async suggestWithAI(
    resourceType: string,
    useCase: string
  ): Promise<StructureSuggestion> {
    const prompt = `You are an expert in FHIR R4 resource modeling and clinical data standards. Suggest the optimal FHIR resource structure for the following use case.

Resource Type: ${resourceType}
Use Case: ${useCase}

Based on FHIR R4 specifications and relevant clinical guidelines (US Core, IHE profiles, etc.), provide:
1. Required and recommended fields for this use case
2. Appropriate terminology bindings (LOINC, SNOMED CT, etc.)
3. Any extensions that may be needed
4. Validation rules to ensure data quality

Respond with a JSON object containing:
{
  "clinicalGuideline": "name of relevant clinical guideline if applicable",
  "suggestedFields": [
    {
      "path": "field path",
      "description": "field description",
      "required": true/false,
      "dataType": "FHIR data type",
      "example": "example value",
      "clinicalRelevance": "critical/high/medium/low"
    }
  ],
  "requiredExtensions": [
    {
      "url": "extension URL",
      "description": "extension description",
      "valueType": "value type",
      "required": true/false
    }
  ],
  "validationRules": ["list of validation rules"],
  "confidence": 0.0-1.0,
  "rationale": "explanation of recommendations"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);

    return {
      id: `suggest-${generateId()}`,
      resourceType,
      useCase,
      clinicalGuideline: parsed.clinicalGuideline,
      suggestedFields: parsed.suggestedFields || [],
      requiredExtensions: parsed.requiredExtensions || [],
      validationRules: parsed.validationRules || [],
      examples: [],
      confidence: parsed.confidence || 0.85,
      rationale: parsed.rationale || "AI-generated structure suggestion"
    };
  }

  private getFallbackSuggestion(
    resourceType: string,
    useCase: string
  ): StructureSuggestion {
    const commonFields: Record<string, SuggestedField[]> = {
      Patient: [
        { path: "identifier", description: "Patient identifiers (MRN, SSN, etc.)", required: true, dataType: "Identifier[]", example: "MRN-12345", clinicalRelevance: "critical" },
        { path: "name", description: "Patient name(s)", required: true, dataType: "HumanName[]", example: "John Doe", clinicalRelevance: "critical" },
        { path: "gender", description: "Administrative gender", required: true, dataType: "code", example: "male", clinicalRelevance: "high" },
        { path: "birthDate", description: "Date of birth", required: true, dataType: "date", example: "1985-03-15", clinicalRelevance: "high" },
        { path: "address", description: "Patient address(es)", required: false, dataType: "Address[]", example: "123 Main St, Boston, MA", clinicalRelevance: "medium" },
        { path: "telecom", description: "Contact information", required: false, dataType: "ContactPoint[]", example: "555-123-4567", clinicalRelevance: "medium" }
      ],
      Observation: [
        { path: "status", description: "Observation status", required: true, dataType: "code", example: "final", clinicalRelevance: "critical" },
        { path: "category", description: "Classification of observation", required: true, dataType: "CodeableConcept[]", example: "vital-signs", clinicalRelevance: "high" },
        { path: "code", description: "Type of observation (LOINC)", required: true, dataType: "CodeableConcept", example: "8867-4 (Heart rate)", clinicalRelevance: "critical" },
        { path: "subject", description: "Who the observation is about", required: true, dataType: "Reference(Patient)", example: "Patient/123", clinicalRelevance: "critical" },
        { path: "effectiveDateTime", description: "Clinically relevant time", required: true, dataType: "dateTime", example: "2026-01-15T10:30:00Z", clinicalRelevance: "high" },
        { path: "value[x]", description: "Actual result", required: false, dataType: "Quantity/CodeableConcept/string", example: "72 bpm", clinicalRelevance: "critical" }
      ],
      Condition: [
        { path: "clinicalStatus", description: "Clinical status of condition", required: true, dataType: "CodeableConcept", example: "active", clinicalRelevance: "critical" },
        { path: "verificationStatus", description: "Verification status", required: true, dataType: "CodeableConcept", example: "confirmed", clinicalRelevance: "high" },
        { path: "category", description: "Category of condition", required: false, dataType: "CodeableConcept[]", example: "encounter-diagnosis", clinicalRelevance: "high" },
        { path: "code", description: "Identification of condition (ICD-10/SNOMED)", required: true, dataType: "CodeableConcept", example: "E11.9 (Type 2 diabetes)", clinicalRelevance: "critical" },
        { path: "subject", description: "Who has the condition", required: true, dataType: "Reference(Patient)", example: "Patient/123", clinicalRelevance: "critical" },
        { path: "onsetDateTime", description: "When condition started", required: false, dataType: "dateTime", example: "2020-05-01", clinicalRelevance: "high" }
      ],
      MedicationRequest: [
        { path: "status", description: "Prescription status", required: true, dataType: "code", example: "active", clinicalRelevance: "critical" },
        { path: "intent", description: "Order vs proposal", required: true, dataType: "code", example: "order", clinicalRelevance: "critical" },
        { path: "medication[x]", description: "Medication being requested (RxNorm)", required: true, dataType: "CodeableConcept/Reference", example: "metformin 500mg", clinicalRelevance: "critical" },
        { path: "subject", description: "Who medication is for", required: true, dataType: "Reference(Patient)", example: "Patient/123", clinicalRelevance: "critical" },
        { path: "dosageInstruction", description: "How medication should be taken", required: false, dataType: "Dosage[]", example: "Take 1 tablet twice daily", clinicalRelevance: "critical" },
        { path: "dispenseRequest", description: "Dispensing information", required: false, dataType: "BackboneElement", example: "30 day supply", clinicalRelevance: "high" }
      ]
    };

    const fields = commonFields[resourceType] || [
      { path: "id", description: "Logical id of resource", required: true, dataType: "string", example: "res-123", clinicalRelevance: "medium" as const },
      { path: "meta", description: "Metadata about the resource", required: false, dataType: "Meta", example: "versionId: 1", clinicalRelevance: "low" as const }
    ];

    return {
      id: `suggest-${generateId()}`,
      resourceType,
      useCase,
      clinicalGuideline: resourceType === "Patient" ? "HL7 US Core Patient Profile" :
                         resourceType === "Observation" ? "HL7 US Core Vital Signs Profile" :
                         resourceType === "Condition" ? "HL7 US Core Condition Profile" :
                         resourceType === "MedicationRequest" ? "HL7 US Core MedicationRequest Profile" :
                         "FHIR R4 Base Resource",
      suggestedFields: fields,
      requiredExtensions: [],
      validationRules: [
        `All required fields for ${resourceType} must be populated`,
        "Use standard terminology codes where applicable",
        "References must point to valid resources",
        "DateTime values must be in ISO 8601 format"
      ],
      examples: [],
      confidence: 0.8,
      rationale: `Template-based structure suggestion for ${resourceType} based on common clinical requirements. AI-powered suggestions available when OpenAI is configured.`
    };
  }

  deleteLink(userId: string, linkId: string): boolean {
    const deleted = resourceLinks.delete(linkId);
    if (deleted) {
      logAuditEntry(userId, "link_deletion", true, { linkId });
    }
    return deleted;
  }

  deleteGeneratedResource(userId: string, resourceId: string): boolean {
    const deleted = generatedResources.delete(resourceId);
    if (deleted) {
      logAuditEntry(userId, "resource_deletion", true, { resourceId });
    }
    return deleted;
  }
}

export const aiFHIRResourceManagementService = new AIFHIRResourceManagementService();
