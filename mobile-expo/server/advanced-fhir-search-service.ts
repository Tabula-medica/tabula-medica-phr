import { chatComplete } from "./ai-client";

export type SearchOperator = 
  | "eq" | "ne" | "gt" | "lt" | "ge" | "le" 
  | "contains" | "exact" | "starts-with" 
  | "above" | "below" | "in" | "not-in"
  | "missing";

export type DatePrecision = "year" | "month" | "day" | "time";

export interface SearchParameter {
  id: string;
  name: string;
  path: string;
  type: "string" | "token" | "date" | "number" | "reference" | "quantity" | "uri" | "composite";
  operator: SearchOperator;
  value: string;
  modifier?: string;
  dateRange?: { start?: string; end?: string };
  fuzzyEnabled?: boolean;
}

export interface SearchFilter {
  parameters: SearchParameter[];
  combineWith: "AND" | "OR";
  includeRelated?: string[];
  revInclude?: string[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  count?: number;
  offset?: number;
}

export interface FHIRResourceDefinition {
  resourceType: string;
  displayName: string;
  description: string;
  commonSearchParams: SearchParameterDefinition[];
  relationships: ResourceRelationship[];
}

export interface SearchParameterDefinition {
  name: string;
  path: string;
  type: "string" | "token" | "date" | "number" | "reference" | "quantity" | "uri" | "composite";
  description: string;
  supportsFuzzy: boolean;
  supportsRange: boolean;
  commonValues?: string[];
  modifiers?: string[];
}

export interface ResourceRelationship {
  targetResource: string;
  searchParam: string;
  description: string;
  direction: "forward" | "reverse";
}

export interface AISearchSuggestion {
  suggestedParameters: SearchParameter[];
  queryDescription: string;
  reasoning: string;
  commonPatterns: string[];
  tips: string[];
}

const FHIR_RESOURCE_DEFINITIONS: FHIRResourceDefinition[] = [
  {
    resourceType: "Patient",
    displayName: "Patient",
    description: "Demographics and administrative information about a patient",
    commonSearchParams: [
      { name: "name", path: "Patient.name", type: "string", description: "Search by patient name (family, given, or full)", supportsFuzzy: true, supportsRange: false, modifiers: ["exact", "contains"] },
      { name: "family", path: "Patient.name.family", type: "string", description: "Search by family/last name", supportsFuzzy: true, supportsRange: false },
      { name: "given", path: "Patient.name.given", type: "string", description: "Search by given/first name", supportsFuzzy: true, supportsRange: false },
      { name: "birthdate", path: "Patient.birthDate", type: "date", description: "Search by date of birth", supportsFuzzy: false, supportsRange: true },
      { name: "gender", path: "Patient.gender", type: "token", description: "Search by gender", supportsFuzzy: false, supportsRange: false, commonValues: ["male", "female", "other", "unknown"] },
      { name: "identifier", path: "Patient.identifier", type: "token", description: "Search by patient identifier (MRN, SSN)", supportsFuzzy: false, supportsRange: false },
      { name: "phone", path: "Patient.telecom.where(system='phone')", type: "token", description: "Search by phone number", supportsFuzzy: false, supportsRange: false },
      { name: "email", path: "Patient.telecom.where(system='email')", type: "token", description: "Search by email address", supportsFuzzy: false, supportsRange: false },
      { name: "address", path: "Patient.address", type: "string", description: "Search by address components", supportsFuzzy: true, supportsRange: false },
      { name: "address-city", path: "Patient.address.city", type: "string", description: "Search by city", supportsFuzzy: true, supportsRange: false },
      { name: "address-state", path: "Patient.address.state", type: "string", description: "Search by state", supportsFuzzy: false, supportsRange: false },
      { name: "address-postalcode", path: "Patient.address.postalCode", type: "string", description: "Search by postal code", supportsFuzzy: false, supportsRange: false },
      { name: "deceased", path: "Patient.deceased", type: "token", description: "Search by deceased status", supportsFuzzy: false, supportsRange: false, commonValues: ["true", "false"] },
      { name: "death-date", path: "Patient.deceasedDateTime", type: "date", description: "Search by date of death", supportsFuzzy: false, supportsRange: true },
      { name: "active", path: "Patient.active", type: "token", description: "Search by active status", supportsFuzzy: false, supportsRange: false, commonValues: ["true", "false"] },
    ],
    relationships: [
      { targetResource: "Observation", searchParam: "patient", description: "Observations for this patient", direction: "reverse" },
      { targetResource: "Condition", searchParam: "patient", description: "Conditions for this patient", direction: "reverse" },
      { targetResource: "MedicationRequest", searchParam: "patient", description: "Medication requests for this patient", direction: "reverse" },
      { targetResource: "Encounter", searchParam: "patient", description: "Encounters for this patient", direction: "reverse" },
    ],
  },
  {
    resourceType: "Observation",
    displayName: "Observation",
    description: "Measurements, vital signs, lab results, and other clinical observations",
    commonSearchParams: [
      { name: "code", path: "Observation.code", type: "token", description: "Observation type (LOINC, SNOMED)", supportsFuzzy: false, supportsRange: false },
      { name: "category", path: "Observation.category", type: "token", description: "Category of observation", supportsFuzzy: false, supportsRange: false, commonValues: ["vital-signs", "laboratory", "social-history", "imaging"] },
      { name: "date", path: "Observation.effectiveDateTime", type: "date", description: "Observation date/time", supportsFuzzy: false, supportsRange: true },
      { name: "patient", path: "Observation.subject", type: "reference", description: "The patient reference", supportsFuzzy: false, supportsRange: false },
      { name: "status", path: "Observation.status", type: "token", description: "Observation status", supportsFuzzy: false, supportsRange: false, commonValues: ["registered", "preliminary", "final", "amended", "cancelled"] },
      { name: "value-quantity", path: "Observation.valueQuantity", type: "quantity", description: "Numeric observation value", supportsFuzzy: false, supportsRange: true },
      { name: "value-string", path: "Observation.valueString", type: "string", description: "Text observation value", supportsFuzzy: true, supportsRange: false },
      { name: "component-code", path: "Observation.component.code", type: "token", description: "Component observation code", supportsFuzzy: false, supportsRange: false },
      { name: "performer", path: "Observation.performer", type: "reference", description: "Who performed the observation", supportsFuzzy: false, supportsRange: false },
    ],
    relationships: [
      { targetResource: "Patient", searchParam: "subject", description: "Patient being observed", direction: "forward" },
      { targetResource: "Encounter", searchParam: "encounter", description: "Encounter during observation", direction: "forward" },
      { targetResource: "Practitioner", searchParam: "performer", description: "Practitioner who made observation", direction: "forward" },
    ],
  },
  {
    resourceType: "Condition",
    displayName: "Condition",
    description: "Clinical conditions, problems, or diagnoses",
    commonSearchParams: [
      { name: "code", path: "Condition.code", type: "token", description: "Condition code (ICD-10, SNOMED)", supportsFuzzy: false, supportsRange: false },
      { name: "clinical-status", path: "Condition.clinicalStatus", type: "token", description: "Clinical status", supportsFuzzy: false, supportsRange: false, commonValues: ["active", "recurrence", "relapse", "inactive", "remission", "resolved"] },
      { name: "verification-status", path: "Condition.verificationStatus", type: "token", description: "Verification status", supportsFuzzy: false, supportsRange: false, commonValues: ["unconfirmed", "provisional", "differential", "confirmed", "refuted", "entered-in-error"] },
      { name: "category", path: "Condition.category", type: "token", description: "Condition category", supportsFuzzy: false, supportsRange: false, commonValues: ["problem-list-item", "encounter-diagnosis", "health-concern"] },
      { name: "severity", path: "Condition.severity", type: "token", description: "Condition severity", supportsFuzzy: false, supportsRange: false, commonValues: ["mild", "moderate", "severe"] },
      { name: "onset-date", path: "Condition.onsetDateTime", type: "date", description: "Date condition started", supportsFuzzy: false, supportsRange: true },
      { name: "abatement-date", path: "Condition.abatementDateTime", type: "date", description: "Date condition resolved", supportsFuzzy: false, supportsRange: true },
      { name: "patient", path: "Condition.subject", type: "reference", description: "Patient reference", supportsFuzzy: false, supportsRange: false },
      { name: "recorded-date", path: "Condition.recordedDate", type: "date", description: "When condition was recorded", supportsFuzzy: false, supportsRange: true },
    ],
    relationships: [
      { targetResource: "Patient", searchParam: "subject", description: "Patient with condition", direction: "forward" },
      { targetResource: "Encounter", searchParam: "encounter", description: "Encounter where diagnosed", direction: "forward" },
      { targetResource: "Practitioner", searchParam: "asserter", description: "Who asserted condition", direction: "forward" },
    ],
  },
  {
    resourceType: "MedicationRequest",
    displayName: "Medication Request",
    description: "Prescriptions and medication orders",
    commonSearchParams: [
      { name: "code", path: "MedicationRequest.medicationCodeableConcept", type: "token", description: "Medication code (RxNorm, NDC)", supportsFuzzy: false, supportsRange: false },
      { name: "status", path: "MedicationRequest.status", type: "token", description: "Prescription status", supportsFuzzy: false, supportsRange: false, commonValues: ["active", "on-hold", "cancelled", "completed", "stopped", "draft"] },
      { name: "intent", path: "MedicationRequest.intent", type: "token", description: "Order intent", supportsFuzzy: false, supportsRange: false, commonValues: ["proposal", "plan", "order", "original-order", "reflex-order", "filler-order", "instance-order", "option"] },
      { name: "authoredon", path: "MedicationRequest.authoredOn", type: "date", description: "Date prescription written", supportsFuzzy: false, supportsRange: true },
      { name: "patient", path: "MedicationRequest.subject", type: "reference", description: "Patient reference", supportsFuzzy: false, supportsRange: false },
      { name: "requester", path: "MedicationRequest.requester", type: "reference", description: "Prescribing provider", supportsFuzzy: false, supportsRange: false },
      { name: "category", path: "MedicationRequest.category", type: "token", description: "Medication category", supportsFuzzy: false, supportsRange: false, commonValues: ["inpatient", "outpatient", "community", "discharge"] },
    ],
    relationships: [
      { targetResource: "Patient", searchParam: "subject", description: "Patient taking medication", direction: "forward" },
      { targetResource: "Practitioner", searchParam: "requester", description: "Prescribing provider", direction: "forward" },
      { targetResource: "Encounter", searchParam: "encounter", description: "Related encounter", direction: "forward" },
    ],
  },
  {
    resourceType: "Encounter",
    displayName: "Encounter",
    description: "Healthcare visits, admissions, and other patient interactions",
    commonSearchParams: [
      { name: "class", path: "Encounter.class", type: "token", description: "Encounter class", supportsFuzzy: false, supportsRange: false, commonValues: ["inpatient", "outpatient", "ambulatory", "emergency", "home", "virtual"] },
      { name: "status", path: "Encounter.status", type: "token", description: "Encounter status", supportsFuzzy: false, supportsRange: false, commonValues: ["planned", "arrived", "triaged", "in-progress", "onleave", "finished", "cancelled"] },
      { name: "type", path: "Encounter.type", type: "token", description: "Encounter type", supportsFuzzy: false, supportsRange: false },
      { name: "date", path: "Encounter.period", type: "date", description: "Encounter date/time", supportsFuzzy: false, supportsRange: true },
      { name: "patient", path: "Encounter.subject", type: "reference", description: "Patient reference", supportsFuzzy: false, supportsRange: false },
      { name: "participant", path: "Encounter.participant.individual", type: "reference", description: "Participating provider", supportsFuzzy: false, supportsRange: false },
      { name: "location", path: "Encounter.location.location", type: "reference", description: "Encounter location", supportsFuzzy: false, supportsRange: false },
      { name: "length", path: "Encounter.length", type: "quantity", description: "Duration of encounter", supportsFuzzy: false, supportsRange: true },
      { name: "reason-code", path: "Encounter.reasonCode", type: "token", description: "Reason for encounter", supportsFuzzy: false, supportsRange: false },
    ],
    relationships: [
      { targetResource: "Patient", searchParam: "subject", description: "Patient seen", direction: "forward" },
      { targetResource: "Practitioner", searchParam: "participant", description: "Participating providers", direction: "forward" },
      { targetResource: "Location", searchParam: "location", description: "Where encounter occurred", direction: "forward" },
      { targetResource: "Observation", searchParam: "encounter", description: "Observations during encounter", direction: "reverse" },
      { targetResource: "Condition", searchParam: "encounter", description: "Conditions diagnosed", direction: "reverse" },
    ],
  },
  {
    resourceType: "AllergyIntolerance",
    displayName: "Allergy/Intolerance",
    description: "Patient allergies and intolerances",
    commonSearchParams: [
      { name: "code", path: "AllergyIntolerance.code", type: "token", description: "Allergy code", supportsFuzzy: false, supportsRange: false },
      { name: "clinical-status", path: "AllergyIntolerance.clinicalStatus", type: "token", description: "Clinical status", supportsFuzzy: false, supportsRange: false, commonValues: ["active", "inactive", "resolved"] },
      { name: "verification-status", path: "AllergyIntolerance.verificationStatus", type: "token", description: "Verification status", supportsFuzzy: false, supportsRange: false, commonValues: ["unconfirmed", "confirmed", "refuted", "entered-in-error"] },
      { name: "type", path: "AllergyIntolerance.type", type: "token", description: "Allergy or intolerance", supportsFuzzy: false, supportsRange: false, commonValues: ["allergy", "intolerance"] },
      { name: "category", path: "AllergyIntolerance.category", type: "token", description: "Category of allergen", supportsFuzzy: false, supportsRange: false, commonValues: ["food", "medication", "environment", "biologic"] },
      { name: "criticality", path: "AllergyIntolerance.criticality", type: "token", description: "Risk level", supportsFuzzy: false, supportsRange: false, commonValues: ["low", "high", "unable-to-assess"] },
      { name: "onset", path: "AllergyIntolerance.onsetDateTime", type: "date", description: "When allergy identified", supportsFuzzy: false, supportsRange: true },
      { name: "patient", path: "AllergyIntolerance.patient", type: "reference", description: "Patient reference", supportsFuzzy: false, supportsRange: false },
    ],
    relationships: [
      { targetResource: "Patient", searchParam: "patient", description: "Patient with allergy", direction: "forward" },
      { targetResource: "Practitioner", searchParam: "recorder", description: "Who recorded allergy", direction: "forward" },
    ],
  },
  {
    resourceType: "Immunization",
    displayName: "Immunization",
    description: "Vaccination records",
    commonSearchParams: [
      { name: "vaccine-code", path: "Immunization.vaccineCode", type: "token", description: "Vaccine administered (CVX)", supportsFuzzy: false, supportsRange: false },
      { name: "status", path: "Immunization.status", type: "token", description: "Immunization status", supportsFuzzy: false, supportsRange: false, commonValues: ["completed", "entered-in-error", "not-done"] },
      { name: "date", path: "Immunization.occurrenceDateTime", type: "date", description: "Vaccination date", supportsFuzzy: false, supportsRange: true },
      { name: "patient", path: "Immunization.patient", type: "reference", description: "Patient reference", supportsFuzzy: false, supportsRange: false },
      { name: "location", path: "Immunization.location", type: "reference", description: "Where administered", supportsFuzzy: false, supportsRange: false },
      { name: "lot-number", path: "Immunization.lotNumber", type: "string", description: "Vaccine lot number", supportsFuzzy: false, supportsRange: false },
      { name: "performer", path: "Immunization.performer.actor", type: "reference", description: "Who administered", supportsFuzzy: false, supportsRange: false },
    ],
    relationships: [
      { targetResource: "Patient", searchParam: "patient", description: "Immunized patient", direction: "forward" },
      { targetResource: "Location", searchParam: "location", description: "Administration location", direction: "forward" },
      { targetResource: "Practitioner", searchParam: "performer", description: "Administering provider", direction: "forward" },
    ],
  },
  {
    resourceType: "Procedure",
    displayName: "Procedure",
    description: "Surgical and diagnostic procedures performed",
    commonSearchParams: [
      { name: "code", path: "Procedure.code", type: "token", description: "Procedure code (CPT, SNOMED)", supportsFuzzy: false, supportsRange: false },
      { name: "status", path: "Procedure.status", type: "token", description: "Procedure status", supportsFuzzy: false, supportsRange: false, commonValues: ["preparation", "in-progress", "not-done", "on-hold", "stopped", "completed", "entered-in-error", "unknown"] },
      { name: "date", path: "Procedure.performedDateTime", type: "date", description: "Procedure date", supportsFuzzy: false, supportsRange: true },
      { name: "patient", path: "Procedure.subject", type: "reference", description: "Patient reference", supportsFuzzy: false, supportsRange: false },
      { name: "performer", path: "Procedure.performer.actor", type: "reference", description: "Performing provider", supportsFuzzy: false, supportsRange: false },
      { name: "category", path: "Procedure.category", type: "token", description: "Procedure category", supportsFuzzy: false, supportsRange: false },
      { name: "location", path: "Procedure.location", type: "reference", description: "Where performed", supportsFuzzy: false, supportsRange: false },
      { name: "outcome", path: "Procedure.outcome", type: "token", description: "Procedure outcome", supportsFuzzy: false, supportsRange: false },
    ],
    relationships: [
      { targetResource: "Patient", searchParam: "subject", description: "Patient who had procedure", direction: "forward" },
      { targetResource: "Encounter", searchParam: "encounter", description: "Related encounter", direction: "forward" },
      { targetResource: "Practitioner", searchParam: "performer", description: "Performing provider", direction: "forward" },
    ],
  },
  {
    resourceType: "DiagnosticReport",
    displayName: "Diagnostic Report",
    description: "Lab reports, imaging studies, and other diagnostic test results",
    commonSearchParams: [
      { name: "code", path: "DiagnosticReport.code", type: "token", description: "Report type code (LOINC)", supportsFuzzy: false, supportsRange: false },
      { name: "category", path: "DiagnosticReport.category", type: "token", description: "Report category", supportsFuzzy: false, supportsRange: false, commonValues: ["LAB", "RAD", "PAT", "MB", "CUS"] },
      { name: "status", path: "DiagnosticReport.status", type: "token", description: "Report status", supportsFuzzy: false, supportsRange: false, commonValues: ["registered", "partial", "preliminary", "final", "amended", "corrected", "appended", "cancelled", "entered-in-error"] },
      { name: "date", path: "DiagnosticReport.effectiveDateTime", type: "date", description: "Report date", supportsFuzzy: false, supportsRange: true },
      { name: "issued", path: "DiagnosticReport.issued", type: "date", description: "When report was issued", supportsFuzzy: false, supportsRange: true },
      { name: "patient", path: "DiagnosticReport.subject", type: "reference", description: "Patient reference", supportsFuzzy: false, supportsRange: false },
      { name: "performer", path: "DiagnosticReport.performer", type: "reference", description: "Report performer", supportsFuzzy: false, supportsRange: false },
      { name: "conclusion", path: "DiagnosticReport.conclusion", type: "string", description: "Report conclusion text", supportsFuzzy: true, supportsRange: false },
    ],
    relationships: [
      { targetResource: "Patient", searchParam: "subject", description: "Report subject", direction: "forward" },
      { targetResource: "Observation", searchParam: "result", description: "Result observations", direction: "forward" },
      { targetResource: "Practitioner", searchParam: "performer", description: "Report performer", direction: "forward" },
    ],
  },
];

export function getResourceDefinitions(): FHIRResourceDefinition[] {
  return FHIR_RESOURCE_DEFINITIONS;
}

export function getResourceDefinition(resourceType: string): FHIRResourceDefinition | undefined {
  return FHIR_RESOURCE_DEFINITIONS.find(r => r.resourceType === resourceType);
}

export function getSearchParametersForResource(resourceType: string): SearchParameterDefinition[] {
  const def = getResourceDefinition(resourceType);
  return def?.commonSearchParams || [];
}

export function buildFHIRSearchQuery(filter: SearchFilter): Record<string, string> {
  const params: Record<string, string> = {};
  
  for (const param of filter.parameters) {
    let key = param.name;
    let value = param.value;
    
    if (param.modifier) {
      key = `${key}:${param.modifier}`;
    }
    
    switch (param.operator) {
      case "eq":
        break;
      case "ne":
        value = `ne${value}`;
        break;
      case "gt":
        value = `gt${value}`;
        break;
      case "lt":
        value = `lt${value}`;
        break;
      case "ge":
        value = `ge${value}`;
        break;
      case "le":
        value = `le${value}`;
        break;
      case "contains":
        key = `${param.name}:contains`;
        break;
      case "exact":
        key = `${param.name}:exact`;
        break;
      case "starts-with":
        value = `${value}%`;
        break;
      case "missing":
        key = `${param.name}:missing`;
        value = param.value;
        break;
    }
    
    if (param.type === "date" && param.dateRange) {
      if (param.dateRange.start && param.dateRange.end) {
        params[`${param.name}`] = `ge${param.dateRange.start}`;
        params[`${param.name}`] = `le${param.dateRange.end}`;
      } else if (param.dateRange.start) {
        params[key] = `ge${param.dateRange.start}`;
        continue;
      } else if (param.dateRange.end) {
        params[key] = `le${param.dateRange.end}`;
        continue;
      }
    }
    
    if (param.fuzzyEnabled && param.type === "string") {
      key = `${param.name}:contains`;
    }
    
    if (params[key]) {
      params[key] = `${params[key]},${value}`;
    } else {
      params[key] = value;
    }
  }
  
  if (filter.includeRelated && filter.includeRelated.length > 0) {
    params["_include"] = filter.includeRelated.join(",");
  }
  
  if (filter.revInclude && filter.revInclude.length > 0) {
    params["_revinclude"] = filter.revInclude.join(",");
  }
  
  if (filter.sortBy) {
    params["_sort"] = filter.sortOrder === "desc" ? `-${filter.sortBy}` : filter.sortBy;
  }
  
  if (filter.count) {
    params["_count"] = String(filter.count);
  }
  
  if (filter.offset) {
    params["_offset"] = String(filter.offset);
  }
  
  return params;
}

export function parseNaturalLanguageQuery(query: string, resourceType: string): SearchParameter[] {
  const parameters: SearchParameter[] = [];
  const definition = getResourceDefinition(resourceType);
  if (!definition) return parameters;
  
  const patterns = [
    { regex: /name\s+(?:is|=|contains?|like)\s+"?([^"]+)"?/i, param: "name", type: "string" as const },
    { regex: /date\s+(?:from|after|>=?)\s+(\d{4}-\d{2}-\d{2})/i, param: "date", type: "date" as const, op: "ge" as SearchOperator },
    { regex: /date\s+(?:to|before|<=?)\s+(\d{4}-\d{2}-\d{2})/i, param: "date", type: "date" as const, op: "le" as SearchOperator },
    { regex: /status\s+(?:is|=)\s+"?(\w+)"?/i, param: "status", type: "token" as const },
    { regex: /gender\s+(?:is|=)\s+"?(\w+)"?/i, param: "gender", type: "token" as const },
    { regex: /category\s+(?:is|=)\s+"?([^"]+)"?/i, param: "category", type: "token" as const },
    { regex: /code\s+(?:is|=)\s+"?([^"]+)"?/i, param: "code", type: "token" as const },
    { regex: /birthdate\s+(\d{4}-\d{2}-\d{2})/i, param: "birthdate", type: "date" as const },
  ];
  
  for (const pattern of patterns) {
    const match = query.match(pattern.regex);
    if (match && definition.commonSearchParams.find(p => p.name === pattern.param)) {
      parameters.push({
        id: `param-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: pattern.param,
        path: "",
        type: pattern.type,
        operator: pattern.op || "eq",
        value: match[1],
      });
    }
  }
  
  return parameters;
}

export async function getAISearchSuggestions(
  resourceType: string,
  currentParameters: SearchParameter[],
  userIntent?: string
): Promise<AISearchSuggestion> {
  const definition = getResourceDefinition(resourceType);
  if (!definition) {
    return {
      suggestedParameters: [],
      queryDescription: "Unknown resource type",
      reasoning: "The specified resource type is not recognized",
      commonPatterns: [],
      tips: [],
    };
  }

  const systemPrompt = `You are a FHIR search expert. Analyze the user's search intent and suggest optimal search parameters for ${resourceType} resources.

Available search parameters for ${resourceType}:
${definition.commonSearchParams.map(p => `- ${p.name} (${p.type}): ${p.description}`).join("\n")}

Related resources:
${definition.relationships.map(r => `- ${r.targetResource}: ${r.description}`).join("\n")}

Current search parameters:
${currentParameters.length > 0 ? currentParameters.map(p => `- ${p.name} = ${p.value}`).join("\n") : "None specified"}

User intent: ${userIntent || "General search"}

Respond with a JSON object containing:
{
  "suggestedParameters": [
    {
      "name": "parameter name",
      "type": "parameter type",
      "operator": "eq|ne|gt|lt|ge|le|contains|exact",
      "value": "suggested value or placeholder",
      "reasoning": "why this parameter is helpful"
    }
  ],
  "queryDescription": "Human-readable description of the suggested query",
  "reasoning": "Overall reasoning for suggestions",
  "commonPatterns": ["List of common search patterns for this resource"],
  "tips": ["Helpful tips for searching this resource type"]
}`;

  try {
    const response = await chatComplete({
      model: "deep",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Suggest search parameters for: ${userIntent || "finding relevant " + resourceType + " resources"}` },
      ],
      jsonMode: true,
      temperature: 0.7,
      maxOutputTokens: 1000,
      dataCategories: ["demographics","conditions"],
      purpose: "data_exchange",
      callerService: "advanced-fhir-search-service",
      callerMethod: "buildSearchQuery"});

    const content = response.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const result = JSON.parse(content);
    
    return {
      suggestedParameters: (result.suggestedParameters || []).map((p: any) => ({
        id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: p.name,
        path: definition.commonSearchParams.find(sp => sp.name === p.name)?.path || "",
        type: p.type || "string",
        operator: p.operator || "eq",
        value: p.value || "",
        fuzzyEnabled: p.type === "string",
      })),
      queryDescription: result.queryDescription || "",
      reasoning: result.reasoning || "",
      commonPatterns: result.commonPatterns || [],
      tips: result.tips || [],
    };
  } catch (error) {
    console.error("AI search suggestions error:", error);
    
    const defaultParams = definition.commonSearchParams.slice(0, 3);
    return {
      suggestedParameters: defaultParams.map(p => ({
        id: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: p.name,
        path: p.path,
        type: p.type,
        operator: "eq" as SearchOperator,
        value: "",
        fuzzyEnabled: p.supportsFuzzy,
      })),
      queryDescription: `Search ${resourceType} resources using common parameters`,
      reasoning: "Using default common search parameters for this resource type",
      commonPatterns: [
        `Search by ${defaultParams[0]?.name || "code"}`,
        `Filter by date range`,
        `Find by patient reference`,
      ],
      tips: [
        "Use fuzzy matching for text fields to find partial matches",
        "Combine multiple parameters for more precise results",
        "Use date ranges to narrow down results by time period",
      ],
    };
  }
}

export function getCommonQueryPatterns(resourceType: string): { name: string; description: string; parameters: Partial<SearchParameter>[] }[] {
  const patterns: Record<string, { name: string; description: string; parameters: Partial<SearchParameter>[] }[]> = {
    Patient: [
      { name: "Active Patients", description: "Find all active patients", parameters: [{ name: "active", value: "true", type: "token", operator: "eq" }] },
      { name: "By Name", description: "Search by patient name", parameters: [{ name: "name", value: "", type: "string", operator: "contains" }] },
      { name: "By DOB Range", description: "Find patients born in date range", parameters: [{ name: "birthdate", value: "", type: "date", operator: "ge" }] },
    ],
    Observation: [
      { name: "Recent Labs", description: "Lab results from last 30 days", parameters: [{ name: "category", value: "laboratory", type: "token", operator: "eq" }, { name: "date", value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], type: "date", operator: "ge" }] },
      { name: "Vital Signs", description: "All vital sign observations", parameters: [{ name: "category", value: "vital-signs", type: "token", operator: "eq" }] },
      { name: "Final Results", description: "Only final/completed observations", parameters: [{ name: "status", value: "final", type: "token", operator: "eq" }] },
    ],
    Condition: [
      { name: "Active Problems", description: "Currently active conditions", parameters: [{ name: "clinical-status", value: "active", type: "token", operator: "eq" }] },
      { name: "Confirmed Diagnoses", description: "Confirmed conditions only", parameters: [{ name: "verification-status", value: "confirmed", type: "token", operator: "eq" }] },
      { name: "Problem List", description: "Items on problem list", parameters: [{ name: "category", value: "problem-list-item", type: "token", operator: "eq" }] },
    ],
    MedicationRequest: [
      { name: "Active Medications", description: "Currently active prescriptions", parameters: [{ name: "status", value: "active", type: "token", operator: "eq" }] },
      { name: "Recent Prescriptions", description: "Medications ordered this month", parameters: [{ name: "authoredon", value: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], type: "date", operator: "ge" }] },
    ],
    Encounter: [
      { name: "Recent Visits", description: "Encounters in last 90 days", parameters: [{ name: "date", value: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], type: "date", operator: "ge" }] },
      { name: "Completed Encounters", description: "Finished encounters only", parameters: [{ name: "status", value: "finished", type: "token", operator: "eq" }] },
      { name: "Emergency Visits", description: "Emergency department encounters", parameters: [{ name: "class", value: "emergency", type: "token", operator: "eq" }] },
    ],
  };
  
  return patterns[resourceType] || [];
}
