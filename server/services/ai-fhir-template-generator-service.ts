// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export type FHIRResourceType =
  | "Patient"
  | "Observation"
  | "Condition"
  | "MedicationRequest"
  | "MedicationStatement"
  | "AllergyIntolerance"
  | "Immunization"
  | "Procedure"
  | "DiagnosticReport"
  | "Encounter"
  | "CarePlan"
  | "Goal"
  | "CareTeam"
  | "Practitioner"
  | "Organization"
  | "Location"
  | "Device"
  | "DocumentReference"
  | "Consent"
  | "Coverage"
  | "Claim"
  | "ExplanationOfBenefit"
  | "ServiceRequest"
  | "Appointment"
  | "QuestionnaireResponse";

export type FHIRProfile =
  | "us-core"
  | "hl7-base"
  | "carin-bb"
  | "da-vinci"
  | "mcode"
  | "custom";

export interface TemplateGenerationRequest {
  resourceType: FHIRResourceType;
  profile: FHIRProfile;
  customProfileUrl?: string;
  context: {
    patientContext?: {
      name?: string;
      age?: number;
      gender?: string;
      conditions?: string[];
    };
    specificDetails?: string;
    useCase?: string;
    includeExtensions?: boolean;
    includeNarrativeText?: boolean;
    dateRange?: {
      start?: string;
      end?: string;
    };
  };
}

export interface GeneratedTemplate {
  id: string;
  resourceType: FHIRResourceType;
  profile: FHIRProfile;
  fhirVersion: "R4" | "R5";
  resource: Record<string, unknown>;
  validationNotes: string[];
  usageGuidance: string;
  relatedResources?: string[];
  generatedAt: string;
}

export interface TemplateHistory {
  id: string;
  request: TemplateGenerationRequest;
  template: GeneratedTemplate;
  createdAt: string;
  userId?: string;
}

const templateHistory: TemplateHistory[] = [];

const PROFILE_URLS: Record<FHIRProfile, string> = {
  "us-core": "http://hl7.org/fhir/us/core/StructureDefinition",
  "hl7-base": "http://hl7.org/fhir/StructureDefinition",
  "carin-bb": "http://hl7.org/fhir/us/carin-bb/StructureDefinition",
  "da-vinci": "http://hl7.org/fhir/us/davinci-pdex/StructureDefinition",
  "mcode": "http://hl7.org/fhir/us/mcode/StructureDefinition",
  "custom": "",
};

const RESOURCE_DESCRIPTIONS: Record<FHIRResourceType, string> = {
  Patient: "Demographics and administrative information about an individual receiving care",
  Observation: "Measurements and simple assertions made about a patient",
  Condition: "Clinical condition, problem, diagnosis, or other event",
  MedicationRequest: "Order or request for medication supply and administration instructions",
  MedicationStatement: "Record of medication being taken by a patient",
  AllergyIntolerance: "Risk of harmful or undesirable physiological response to a substance",
  Immunization: "Immunization event information",
  Procedure: "Action performed on or for a patient",
  DiagnosticReport: "Findings and interpretation of diagnostic tests",
  Encounter: "An interaction during which services are provided to the patient",
  CarePlan: "Describes the intention of how care is intended to be delivered",
  Goal: "Describes desired health state objectives for a patient",
  CareTeam: "Participants involved in providing care",
  Practitioner: "Healthcare practitioner demographics and qualifications",
  Organization: "Formally established group of people or entities",
  Location: "Physical place where services are provided",
  Device: "Medical device or health-related equipment",
  DocumentReference: "Reference to a document",
  Consent: "Record of a healthcare consumer's choices regarding policies",
  Coverage: "Insurance or payment responsibility",
  Claim: "Claim for compensation for healthcare services",
  ExplanationOfBenefit: "Explanation of benefit resource combining claim and adjudication",
  ServiceRequest: "Request for a procedure, diagnostic, or other service",
  Appointment: "Booking of a healthcare event",
  QuestionnaireResponse: "Structured set of answers to a questionnaire",
};

const US_CORE_PROFILES: Partial<Record<FHIRResourceType, string>> = {
  Patient: "us-core-patient",
  Observation: "us-core-observation-lab",
  Condition: "us-core-condition-encounter-diagnosis",
  MedicationRequest: "us-core-medicationrequest",
  AllergyIntolerance: "us-core-allergyintolerance",
  Immunization: "us-core-immunization",
  Procedure: "us-core-procedure",
  DiagnosticReport: "us-core-diagnosticreport-lab",
  Encounter: "us-core-encounter",
  CarePlan: "us-core-careplan",
  Goal: "us-core-goal",
  CareTeam: "us-core-careteam",
  Practitioner: "us-core-practitioner",
  Organization: "us-core-organization",
  Location: "us-core-location",
  DocumentReference: "us-core-documentreference",
};

function generateSystemPrompt(request: TemplateGenerationRequest): string {
  const profileUrl = request.profile === "custom" && request.customProfileUrl
    ? request.customProfileUrl
    : PROFILE_URLS[request.profile];
  
  const usCoreSuffix = request.profile === "us-core" && US_CORE_PROFILES[request.resourceType]
    ? `/${US_CORE_PROFILES[request.resourceType]}`
    : "";

  return `You are an expert FHIR (Fast Healthcare Interoperability Resources) resource generator specializing in creating compliant, realistic healthcare data.

IMPORTANT GUIDELINES:
1. Generate a valid FHIR R4 ${request.resourceType} resource that conforms to the ${request.profile.toUpperCase()} profile
2. Profile URL: ${profileUrl}${usCoreSuffix}
3. Include the "meta.profile" element with the appropriate profile URL
4. Use realistic but clearly example/test data (not real patient data)
5. Follow proper FHIR data types and cardinality constraints
6. Include all required elements for the specified profile
7. Use appropriate code systems (LOINC, SNOMED-CT, ICD-10, RxNorm, CVX, CPT as applicable)
8. Generate valid identifiers with appropriate system URIs
9. Use ISO 8601 date/time formats

RESOURCE TYPE: ${request.resourceType}
DESCRIPTION: ${RESOURCE_DESCRIPTIONS[request.resourceType]}

RESPONSE FORMAT:
Return a JSON object with the following structure:
{
  "resource": <the complete FHIR resource as a JSON object>,
  "validationNotes": [<array of notes about compliance, required elements, or potential issues>],
  "usageGuidance": "<guidance on how to use this template and what fields typically need customization>",
  "relatedResources": [<array of related resource types that might be needed>]
}

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanation text outside the JSON.`;
}

function generateUserPrompt(request: TemplateGenerationRequest): string {
  const parts: string[] = [];
  
  parts.push(`Generate a ${request.resourceType} FHIR resource conforming to ${request.profile.toUpperCase()} profile.`);
  
  if (request.context.patientContext) {
    const pc = request.context.patientContext;
    const patientDetails: string[] = [];
    if (pc.name) patientDetails.push(`Patient name: ${pc.name}`);
    if (pc.age) patientDetails.push(`Age: ${pc.age}`);
    if (pc.gender) patientDetails.push(`Gender: ${pc.gender}`);
    if (pc.conditions?.length) patientDetails.push(`Known conditions: ${pc.conditions.join(", ")}`);
    if (patientDetails.length > 0) {
      parts.push(`\nPatient Context:\n${patientDetails.join("\n")}`);
    }
  }
  
  if (request.context.specificDetails) {
    parts.push(`\nSpecific Details: ${request.context.specificDetails}`);
  }
  
  if (request.context.useCase) {
    parts.push(`\nUse Case: ${request.context.useCase}`);
  }
  
  if (request.context.dateRange) {
    const dr = request.context.dateRange;
    if (dr.start) parts.push(`\nDate range start: ${dr.start}`);
    if (dr.end) parts.push(`\nDate range end: ${dr.end}`);
  }
  
  if (request.context.includeExtensions) {
    parts.push("\nInclude relevant profile extensions where applicable.");
  }
  
  if (request.context.includeNarrativeText) {
    parts.push("\nInclude a human-readable narrative (text.div) element.");
  }
  
  return parts.join("\n");
}

export async function generateFHIRTemplate(
  request: TemplateGenerationRequest
): Promise<GeneratedTemplate> {
  const systemPrompt = generateSystemPrompt(request);
  const userPrompt = generateUserPrompt(request);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 4096,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI model");
  }

  let parsed: {
    resource: Record<string, unknown>;
    validationNotes: string[];
    usageGuidance: string;
    relatedResources?: string[];
  };

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Failed to parse AI response as JSON");
  }

  const template: GeneratedTemplate = {
    id: `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    resourceType: request.resourceType,
    profile: request.profile,
    fhirVersion: "R4",
    resource: parsed.resource,
    validationNotes: parsed.validationNotes || [],
    usageGuidance: parsed.usageGuidance || "",
    relatedResources: parsed.relatedResources,
    generatedAt: new Date().toISOString(),
  };

  templateHistory.push({
    id: template.id,
    request,
    template,
    createdAt: template.generatedAt,
  });

  return template;
}

export function getTemplateHistory(): TemplateHistory[] {
  return [...templateHistory].reverse();
}

export function getTemplateById(id: string): TemplateHistory | undefined {
  return templateHistory.find(t => t.id === id);
}

export function clearTemplateHistory(): void {
  templateHistory.length = 0;
}

export function getSupportedResourceTypes(): Array<{
  type: FHIRResourceType;
  description: string;
  hasUSCoreProfile: boolean;
}> {
  return (Object.keys(RESOURCE_DESCRIPTIONS) as FHIRResourceType[]).map(type => ({
    type,
    description: RESOURCE_DESCRIPTIONS[type],
    hasUSCoreProfile: type in US_CORE_PROFILES,
  }));
}

export function getSupportedProfiles(): Array<{
  id: FHIRProfile;
  name: string;
  description: string;
  baseUrl: string;
}> {
  return [
    {
      id: "us-core",
      name: "US Core",
      description: "United States Core Data for Interoperability (USCDI) profiles",
      baseUrl: PROFILE_URLS["us-core"],
    },
    {
      id: "hl7-base",
      name: "HL7 Base FHIR",
      description: "Base FHIR R4 resource definitions without additional constraints",
      baseUrl: PROFILE_URLS["hl7-base"],
    },
    {
      id: "carin-bb",
      name: "CARIN Blue Button",
      description: "Consumer-directed payer data exchange profiles",
      baseUrl: PROFILE_URLS["carin-bb"],
    },
    {
      id: "da-vinci",
      name: "Da Vinci",
      description: "Value-based care data exchange profiles",
      baseUrl: PROFILE_URLS["da-vinci"],
    },
    {
      id: "mcode",
      name: "mCODE",
      description: "Minimal Common Oncology Data Elements for cancer care",
      baseUrl: PROFILE_URLS["mcode"],
    },
    {
      id: "custom",
      name: "Custom Profile",
      description: "Specify a custom profile URL",
      baseUrl: "",
    },
  ];
}

export async function validateGeneratedResource(
  resource: Record<string, unknown>,
  resourceType: FHIRResourceType,
  profile: FHIRProfile
): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!resource.resourceType) {
    errors.push("Missing required 'resourceType' field");
  } else if (resource.resourceType !== resourceType) {
    errors.push(`Resource type mismatch: expected ${resourceType}, got ${resource.resourceType}`);
  }

  if (!resource.id) {
    warnings.push("Resource has no 'id' field - one will be assigned on server");
  }

  if (!resource.meta) {
    warnings.push("Missing 'meta' element");
  } else {
    const meta = resource.meta as Record<string, unknown>;
    if (!meta.profile || !Array.isArray(meta.profile) || meta.profile.length === 0) {
      warnings.push("Missing profile declaration in meta.profile");
    }
  }

  if (resourceType === "Patient") {
    if (!resource.name) {
      errors.push("US Core Patient requires at least one name");
    }
    if (!resource.gender) {
      errors.push("US Core Patient requires gender");
    }
    if (!resource.identifier) {
      warnings.push("Patient should have at least one identifier");
    }
  }

  if (resourceType === "Observation") {
    if (!resource.status) {
      errors.push("Observation requires status");
    }
    if (!resource.code) {
      errors.push("Observation requires code");
    }
    if (!resource.subject) {
      errors.push("Clinical observations require a subject reference");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
