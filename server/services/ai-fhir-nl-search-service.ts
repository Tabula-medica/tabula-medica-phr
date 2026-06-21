import OpenAI from "openai";
import { randomUUID } from "crypto";

const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const openaiBaseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

let openai: OpenAI | null = null;
if (openaiApiKey && openaiBaseURL) {
  openai = new OpenAI({
    apiKey: openaiApiKey,
    baseURL: openaiBaseURL,
  });
  console.log("[AIFHIRNLSearch] OpenAI client initialized for NL query parsing");
}

export interface FHIRSearchParameter {
  resourceType: string;
  parameter: string;
  modifier?: string;
  comparator?: "eq" | "ne" | "gt" | "lt" | "ge" | "le" | "sa" | "eb" | "ap";
  value: string | number | boolean;
  system?: string;
}

export interface ParsedNLQuery {
  id: string;
  originalQuery: string;
  intent: string;
  resourceTypes: string[];
  searchParameters: FHIRSearchParameter[];
  fhirQuery: string;
  confidence: number;
  explanation: string;
  suggestedRefinements: string[];
  parsedAt: string;
}

export interface NLSearchResult {
  id: string;
  resourceType: string;
  resourceId: string;
  display: string;
  summary: string;
  relevanceScore: number;
  matchedCriteria: string[];
  data: Record<string, unknown>;
  source: string;
  lastUpdated: string;
}

export interface NLSearchResponse {
  query: ParsedNLQuery;
  results: NLSearchResult[];
  total: number;
  executionTimeMs: number;
  aiExplanation: string;
  relatedQueries: string[];
}

interface SearchHistoryEntry {
  id: string;
  query: string;
  parsedQuery: ParsedNLQuery;
  resultCount: number;
  userId: string;
  searchedAt: string;
}

const searchHistory: SearchHistoryEntry[] = [];
const savedQueries: Map<string, { id: string; name: string; query: string; userId: string; createdAt: string }> = new Map();

const FHIR_RESOURCE_TYPES = [
  "Patient", "Condition", "Observation", "MedicationRequest", "Medication",
  "AllergyIntolerance", "Procedure", "Immunization", "DiagnosticReport",
  "DocumentReference", "Encounter", "CarePlan", "CareTeam", "Practitioner",
  "Organization", "Coverage", "Claim", "Goal", "ServiceRequest"
];

const CLINICAL_CONCEPTS: Record<string, { resourceType: string; code?: string; system?: string; parameter: string; value?: string }[]> = {
  "diabetes": [
    { resourceType: "Condition", code: "73211009", system: "http://snomed.info/sct", parameter: "code" }
  ],
  "type 1 diabetes": [
    { resourceType: "Condition", code: "E10", system: "http://hl7.org/fhir/sid/icd-10-cm", parameter: "code" },
    { resourceType: "Condition", code: "46635009", system: "http://snomed.info/sct", parameter: "code" }
  ],
  "type 2 diabetes": [
    { resourceType: "Condition", code: "E11", system: "http://hl7.org/fhir/sid/icd-10-cm", parameter: "code" },
    { resourceType: "Condition", code: "44054006", system: "http://snomed.info/sct", parameter: "code" }
  ],
  "hypertension": [
    { resourceType: "Condition", code: "I10", system: "http://hl7.org/fhir/sid/icd-10-cm", parameter: "code" },
    { resourceType: "Condition", code: "38341003", system: "http://snomed.info/sct", parameter: "code" }
  ],
  "hba1c": [
    { resourceType: "Observation", code: "4548-4", system: "http://loinc.org", parameter: "code" }
  ],
  "hemoglobin a1c": [
    { resourceType: "Observation", code: "4548-4", system: "http://loinc.org", parameter: "code" }
  ],
  "blood pressure": [
    { resourceType: "Observation", code: "85354-9", system: "http://loinc.org", parameter: "code" }
  ],
  "systolic blood pressure": [
    { resourceType: "Observation", code: "8480-6", system: "http://loinc.org", parameter: "code" }
  ],
  "diastolic blood pressure": [
    { resourceType: "Observation", code: "8462-4", system: "http://loinc.org", parameter: "code" }
  ],
  "cholesterol": [
    { resourceType: "Observation", code: "2093-3", system: "http://loinc.org", parameter: "code" }
  ],
  "total cholesterol": [
    { resourceType: "Observation", code: "2093-3", system: "http://loinc.org", parameter: "code" }
  ],
  "ldl": [
    { resourceType: "Observation", code: "13457-7", system: "http://loinc.org", parameter: "code" }
  ],
  "ldl cholesterol": [
    { resourceType: "Observation", code: "13457-7", system: "http://loinc.org", parameter: "code" }
  ],
  "hdl": [
    { resourceType: "Observation", code: "2085-9", system: "http://loinc.org", parameter: "code" }
  ],
  "hdl cholesterol": [
    { resourceType: "Observation", code: "2085-9", system: "http://loinc.org", parameter: "code" }
  ],
  "creatinine": [
    { resourceType: "Observation", code: "2160-0", system: "http://loinc.org", parameter: "code" }
  ],
  "egfr": [
    { resourceType: "Observation", code: "33914-3", system: "http://loinc.org", parameter: "code" }
  ],
  "kidney function": [
    { resourceType: "Observation", code: "33914-3", system: "http://loinc.org", parameter: "code" }
  ],
  "glucose": [
    { resourceType: "Observation", code: "2345-7", system: "http://loinc.org", parameter: "code" }
  ],
  "fasting glucose": [
    { resourceType: "Observation", code: "1558-6", system: "http://loinc.org", parameter: "code" }
  ],
  "metformin": [
    { resourceType: "MedicationRequest", code: "6809", system: "http://www.nlm.nih.gov/research/umls/rxnorm", parameter: "medication.code" }
  ],
  "insulin": [
    { resourceType: "MedicationRequest", code: "253182", system: "http://www.nlm.nih.gov/research/umls/rxnorm", parameter: "medication.code" }
  ],
  "lisinopril": [
    { resourceType: "MedicationRequest", code: "29046", system: "http://www.nlm.nih.gov/research/umls/rxnorm", parameter: "medication.code" }
  ],
  "statin": [
    { resourceType: "MedicationRequest", code: "36567", system: "http://www.nlm.nih.gov/research/umls/rxnorm", parameter: "medication.code" }
  ],
  "atorvastatin": [
    { resourceType: "MedicationRequest", code: "83367", system: "http://www.nlm.nih.gov/research/umls/rxnorm", parameter: "medication.code" }
  ],
  "penicillin allergy": [
    { resourceType: "AllergyIntolerance", code: "764146007", system: "http://snomed.info/sct", parameter: "code" }
  ],
  "allergy": [
    { resourceType: "AllergyIntolerance", parameter: "clinical-status", value: "active" }
  ],
  "covid": [
    { resourceType: "Condition", code: "U07.1", system: "http://hl7.org/fhir/sid/icd-10-cm", parameter: "code" }
  ],
  "covid vaccine": [
    { resourceType: "Immunization", code: "207", system: "http://hl7.org/fhir/sid/cvx", parameter: "vaccine-code" }
  ],
  "asthma": [
    { resourceType: "Condition", code: "195967001", system: "http://snomed.info/sct", parameter: "code" },
    { resourceType: "Condition", code: "J45", system: "http://hl7.org/fhir/sid/icd-10-cm", parameter: "code" }
  ],
  "copd": [
    { resourceType: "Condition", code: "13645005", system: "http://snomed.info/sct", parameter: "code" },
    { resourceType: "Condition", code: "J44", system: "http://hl7.org/fhir/sid/icd-10-cm", parameter: "code" }
  ],
  "heart failure": [
    { resourceType: "Condition", code: "84114007", system: "http://snomed.info/sct", parameter: "code" },
    { resourceType: "Condition", code: "I50", system: "http://hl7.org/fhir/sid/icd-10-cm", parameter: "code" }
  ]
};

const SAMPLE_CLINICAL_DATA: NLSearchResult[] = [
  {
    id: randomUUID(),
    resourceType: "Patient",
    resourceId: "patient-diabetic-001",
    display: "John Smith",
    summary: "65-year-old male with Type 2 Diabetes, recent HbA1c 8.5%",
    relevanceScore: 0.95,
    matchedCriteria: ["diabetes", "HbA1c > 8%"],
    data: {
      name: [{ family: "Smith", given: ["John"] }],
      birthDate: "1960-05-15",
      gender: "male",
      conditions: ["Type 2 Diabetes Mellitus", "Hypertension"],
      lastHbA1c: { value: 8.5, date: "2026-01-10" }
    },
    source: "fastenhealth",
    lastUpdated: "2026-01-20T10:30:00Z"
  },
  {
    id: randomUUID(),
    resourceType: "Patient",
    resourceId: "patient-diabetic-002",
    display: "Sarah Johnson",
    summary: "58-year-old female with Type 2 Diabetes, HbA1c 9.2%, on insulin",
    relevanceScore: 0.92,
    matchedCriteria: ["diabetes", "HbA1c > 8%", "insulin"],
    data: {
      name: [{ family: "Johnson", given: ["Sarah"] }],
      birthDate: "1967-11-22",
      gender: "female",
      conditions: ["Type 2 Diabetes Mellitus", "Diabetic Nephropathy"],
      lastHbA1c: { value: 9.2, date: "2026-01-05" },
      medications: ["Insulin Glargine", "Metformin"]
    },
    source: "fastenhealth",
    lastUpdated: "2026-01-18T14:45:00Z"
  },
  {
    id: randomUUID(),
    resourceType: "Patient",
    resourceId: "patient-diabetic-003",
    display: "Robert Williams",
    summary: "72-year-old male with Type 2 Diabetes, HbA1c 8.1%, cardiovascular history",
    relevanceScore: 0.88,
    matchedCriteria: ["diabetes", "HbA1c > 8%"],
    data: {
      name: [{ family: "Williams", given: ["Robert"] }],
      birthDate: "1953-08-03",
      gender: "male",
      conditions: ["Type 2 Diabetes Mellitus", "Coronary Artery Disease", "Atrial Fibrillation"],
      lastHbA1c: { value: 8.1, date: "2026-01-15" }
    },
    source: "provider",
    lastUpdated: "2026-01-22T09:15:00Z"
  },
  {
    id: randomUUID(),
    resourceType: "Observation",
    resourceId: "obs-hba1c-001",
    display: "HbA1c Result",
    summary: "HbA1c 8.5% for John Smith",
    relevanceScore: 0.90,
    matchedCriteria: ["HbA1c", "value > 8%"],
    data: {
      code: { coding: [{ system: "http://loinc.org", code: "4548-4", display: "Hemoglobin A1c" }] },
      valueQuantity: { value: 8.5, unit: "%", system: "http://unitsofmeasure.org" },
      effectiveDateTime: "2026-01-10T09:00:00Z",
      status: "final",
      subject: { reference: "Patient/patient-diabetic-001", display: "John Smith" }
    },
    source: "fastenhealth",
    lastUpdated: "2026-01-10T10:30:00Z"
  },
  {
    id: randomUUID(),
    resourceType: "Observation",
    resourceId: "obs-hba1c-002",
    display: "HbA1c Result",
    summary: "HbA1c 9.2% for Sarah Johnson",
    relevanceScore: 0.90,
    matchedCriteria: ["HbA1c", "value > 8%"],
    data: {
      code: { coding: [{ system: "http://loinc.org", code: "4548-4", display: "Hemoglobin A1c" }] },
      valueQuantity: { value: 9.2, unit: "%", system: "http://unitsofmeasure.org" },
      effectiveDateTime: "2026-01-05T11:00:00Z",
      status: "final",
      subject: { reference: "Patient/patient-diabetic-002", display: "Sarah Johnson" }
    },
    source: "fastenhealth",
    lastUpdated: "2026-01-05T12:00:00Z"
  },
  {
    id: randomUUID(),
    resourceType: "Condition",
    resourceId: "cond-diabetes-001",
    display: "Type 2 Diabetes Mellitus",
    summary: "Active diabetes diagnosis for John Smith",
    relevanceScore: 0.85,
    matchedCriteria: ["diabetes", "active condition"],
    data: {
      code: { coding: [{ system: "http://snomed.info/sct", code: "44054006", display: "Type 2 diabetes mellitus" }] },
      clinicalStatus: { coding: [{ code: "active", display: "Active" }] },
      verificationStatus: { coding: [{ code: "confirmed", display: "Confirmed" }] },
      subject: { reference: "Patient/patient-diabetic-001", display: "John Smith" },
      onsetDateTime: "2015-03-10"
    },
    source: "fastenhealth",
    lastUpdated: "2026-01-15T08:00:00Z"
  },
  {
    id: randomUUID(),
    resourceType: "Patient",
    resourceId: "patient-hypertension-001",
    display: "Emily Davis",
    summary: "55-year-old female with uncontrolled hypertension, BP 165/95",
    relevanceScore: 0.88,
    matchedCriteria: ["hypertension", "high blood pressure"],
    data: {
      name: [{ family: "Davis", given: ["Emily"] }],
      birthDate: "1970-09-18",
      gender: "female",
      conditions: ["Essential Hypertension", "Obesity"],
      lastBP: { systolic: 165, diastolic: 95, date: "2026-01-12" }
    },
    source: "fastenhealth",
    lastUpdated: "2026-01-12T16:30:00Z"
  },
  {
    id: randomUUID(),
    resourceType: "MedicationRequest",
    resourceId: "medrx-metformin-001",
    display: "Metformin 1000mg",
    summary: "Metformin prescription for John Smith",
    relevanceScore: 0.80,
    matchedCriteria: ["diabetes medication", "metformin"],
    data: {
      medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "6809", display: "Metformin" }] },
      dosageInstruction: [{ text: "Take 1000mg twice daily with meals" }],
      status: "active",
      intent: "order",
      subject: { reference: "Patient/patient-diabetic-001", display: "John Smith" }
    },
    source: "fastenhealth",
    lastUpdated: "2026-01-10T10:00:00Z"
  }
];

async function parseQueryWithAI(query: string): Promise<ParsedNLQuery> {
  const queryId = randomUUID();
  
  if (!openai) {
    return parseQueryWithRules(query, queryId);
  }

  try {
    const systemPrompt = `You are a FHIR healthcare data search assistant. Parse natural language queries into structured FHIR search parameters.

Available FHIR Resource Types: ${FHIR_RESOURCE_TYPES.join(", ")}

Common clinical codes:
- HbA1c: LOINC 4548-4
- Blood Pressure: LOINC 85354-9
- Type 2 Diabetes: SNOMED 44054006, ICD-10 E11
- Hypertension: SNOMED 38341003, ICD-10 I10
- Glucose: LOINC 2345-7
- Creatinine: LOINC 2160-0
- eGFR: LOINC 33914-3
- LDL: LOINC 13457-7
- HDL: LOINC 2085-9

FHIR search parameter comparators: eq (equal), ne (not equal), gt (greater than), lt (less than), ge (greater or equal), le (less or equal)

Return a JSON object with:
{
  "intent": "Brief description of what user is searching for",
  "resourceTypes": ["Primary resource types to search"],
  "searchParameters": [
    {
      "resourceType": "FHIR resource type",
      "parameter": "FHIR search parameter name",
      "comparator": "eq|ne|gt|lt|ge|le (if numeric comparison)",
      "value": "search value",
      "system": "code system URL if applicable"
    }
  ],
  "fhirQuery": "Constructed FHIR query string",
  "confidence": 0.0-1.0,
  "explanation": "Explanation of how the query was interpreted",
  "suggestedRefinements": ["Alternative or more specific queries"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Parse this clinical query: "${query}"` }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    
    return {
      id: queryId,
      originalQuery: query,
      intent: parsed.intent || "Clinical data search",
      resourceTypes: parsed.resourceTypes || ["Patient"],
      searchParameters: parsed.searchParameters || [],
      fhirQuery: parsed.fhirQuery || "",
      confidence: parsed.confidence || 0.7,
      explanation: parsed.explanation || "Query parsed using AI",
      suggestedRefinements: parsed.suggestedRefinements || [],
      parsedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error("[AIFHIRNLSearch] AI parsing error:", error);
    return parseQueryWithRules(query, queryId);
  }
}

function parseQueryWithRules(query: string, queryId: string): ParsedNLQuery {
  const lowerQuery = query.toLowerCase();
  const resourceTypes: string[] = [];
  const searchParameters: FHIRSearchParameter[] = [];
  const matchedConcepts: string[] = [];
  
  for (const [concept, mappings] of Object.entries(CLINICAL_CONCEPTS)) {
    if (lowerQuery.includes(concept)) {
      matchedConcepts.push(concept);
      for (const mapping of mappings) {
        if (!resourceTypes.includes(mapping.resourceType)) {
          resourceTypes.push(mapping.resourceType);
        }
        if (mapping.code) {
          searchParameters.push({
            resourceType: mapping.resourceType,
            parameter: mapping.parameter,
            value: mapping.code,
            system: mapping.system
          });
        }
      }
    }
  }

  const numericPatterns = [
    { pattern: /hba1c\s*(?:above|>|greater than|over)\s*(\d+(?:\.\d+)?)/i, resourceType: "Observation", param: "value-quantity", comparator: "gt" as const },
    { pattern: /hba1c\s*(?:below|<|less than|under)\s*(\d+(?:\.\d+)?)/i, resourceType: "Observation", param: "value-quantity", comparator: "lt" as const },
    { pattern: /systolic\s*(?:blood pressure)?\s*(?:above|>|over)\s*(\d+)/i, resourceType: "Observation", param: "combo-value-quantity", comparator: "gt" as const, code: "8480-6" },
    { pattern: /diastolic\s*(?:blood pressure)?\s*(?:above|>|over)\s*(\d+)/i, resourceType: "Observation", param: "combo-value-quantity", comparator: "gt" as const, code: "8462-4" },
    { pattern: /blood pressure\s*(?:above|>|over)\s*(\d+)/i, resourceType: "Observation", param: "combo-value-quantity", comparator: "gt" as const, code: "8480-6" },
    { pattern: /glucose\s*(?:above|>|over)\s*(\d+)/i, resourceType: "Observation", param: "value-quantity", comparator: "gt" as const },
    { pattern: /glucose\s*(?:below|<|under)\s*(\d+)/i, resourceType: "Observation", param: "value-quantity", comparator: "lt" as const },
    { pattern: /egfr\s*(?:below|<|under)\s*(\d+)/i, resourceType: "Observation", param: "value-quantity", comparator: "lt" as const },
    { pattern: /egfr\s*(?:above|>|over)\s*(\d+)/i, resourceType: "Observation", param: "value-quantity", comparator: "gt" as const },
    { pattern: /cholesterol\s*(?:above|>|over)\s*(\d+)/i, resourceType: "Observation", param: "value-quantity", comparator: "gt" as const },
    { pattern: /ldl\s*(?:above|>|over)\s*(\d+)/i, resourceType: "Observation", param: "value-quantity", comparator: "gt" as const },
    { pattern: /hdl\s*(?:below|<|under)\s*(\d+)/i, resourceType: "Observation", param: "value-quantity", comparator: "lt" as const }
  ];

  const agePattern = query.match(/(?:age|older than|over)\s*(\d+)\s*(?:years?|y\.?o\.?)?/i);
  if (agePattern) {
    const age = parseInt(agePattern[1]);
    const birthYear = new Date().getFullYear() - age;
    if (!resourceTypes.includes("Patient")) {
      resourceTypes.push("Patient");
    }
    searchParameters.push({
      resourceType: "Patient",
      parameter: "birthdate",
      comparator: "le",
      value: `${birthYear}-01-01`
    });
  }

  const youngerPattern = query.match(/(?:younger than|under|age below)\s*(\d+)\s*(?:years?|y\.?o\.?)?/i);
  if (youngerPattern) {
    const age = parseInt(youngerPattern[1]);
    const birthYear = new Date().getFullYear() - age;
    if (!resourceTypes.includes("Patient")) {
      resourceTypes.push("Patient");
    }
    searchParameters.push({
      resourceType: "Patient",
      parameter: "birthdate",
      comparator: "ge",
      value: `${birthYear}-01-01`
    });
  }

  for (const { pattern, resourceType, param, comparator } of numericPatterns) {
    const match = query.match(pattern);
    if (match) {
      if (!resourceTypes.includes(resourceType)) {
        resourceTypes.push(resourceType);
      }
      searchParameters.push({
        resourceType,
        parameter: param,
        comparator,
        value: parseFloat(match[1])
      });
    }
  }

  if (lowerQuery.includes("patient")) {
    if (!resourceTypes.includes("Patient")) {
      resourceTypes.push("Patient");
    }
  }

  if (lowerQuery.includes("uncontrolled") || lowerQuery.includes("poorly controlled")) {
    searchParameters.push({
      resourceType: "Condition",
      parameter: "clinical-status",
      value: "active"
    });
  }

  if (lowerQuery.includes("recent") || lowerQuery.includes("last")) {
    const dateParam: FHIRSearchParameter = {
      resourceType: resourceTypes[0] || "Observation",
      parameter: "date",
      comparator: "ge",
      value: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };
    searchParameters.push(dateParam);
  }

  if (resourceTypes.length === 0) {
    resourceTypes.push("Patient");
  }

  const fhirQueryParts = searchParameters.map(p => {
    const prefix = p.comparator || "";
    const systemPrefix = p.system ? `${p.system}|` : "";
    return `${p.parameter}=${prefix}${systemPrefix}${p.value}`;
  });

  return {
    id: queryId,
    originalQuery: query,
    intent: `Search for ${matchedConcepts.length > 0 ? matchedConcepts.join(", ") : "clinical data"}`,
    resourceTypes,
    searchParameters,
    fhirQuery: `/${resourceTypes[0]}?${fhirQueryParts.join("&")}`,
    confidence: matchedConcepts.length > 0 ? 0.75 : 0.5,
    explanation: matchedConcepts.length > 0 
      ? `Found clinical concepts: ${matchedConcepts.join(", ")}. Applied FHIR search parameters.`
      : "General search applied. Consider being more specific.",
    suggestedRefinements: generateSuggestions(query, matchedConcepts),
    parsedAt: new Date().toISOString()
  };
}

function generateSuggestions(query: string, matchedConcepts: string[]): string[] {
  const suggestions: string[] = [];
  const lowerQuery = query.toLowerCase();

  if (!lowerQuery.includes("above") && !lowerQuery.includes("below") && 
      (matchedConcepts.includes("hba1c") || matchedConcepts.includes("glucose"))) {
    suggestions.push("Try adding a threshold like 'HbA1c above 7%' or 'glucose above 200'");
  }

  if (!lowerQuery.includes("recent") && !lowerQuery.includes("last")) {
    suggestions.push("Add 'recent' or 'in the last 3 months' to filter by date");
  }

  if (matchedConcepts.includes("diabetes") && !matchedConcepts.includes("hba1c")) {
    suggestions.push("Add 'with HbA1c above 8%' to find uncontrolled diabetes");
  }

  if (matchedConcepts.includes("hypertension") && !lowerQuery.includes("blood pressure")) {
    suggestions.push("Add 'blood pressure above 140/90' for specific criteria");
  }

  return suggestions.slice(0, 3);
}

function executeSearch(parsedQuery: ParsedNLQuery): NLSearchResult[] {
  const lowerQuery = parsedQuery.originalQuery.toLowerCase();
  
  return SAMPLE_CLINICAL_DATA.filter(result => {
    if (parsedQuery.resourceTypes.length > 0 && 
        !parsedQuery.resourceTypes.includes(result.resourceType)) {
      return false;
    }

    if (lowerQuery.includes("diabetes")) {
      const hasDiabetes = result.summary.toLowerCase().includes("diabetes") ||
        result.matchedCriteria.some(c => c.toLowerCase().includes("diabetes"));
      if (!hasDiabetes) return false;
    }

    if (lowerQuery.includes("hba1c") && lowerQuery.includes("above")) {
      const thresholdMatch = lowerQuery.match(/above\s*(\d+(?:\.\d+)?)/);
      if (thresholdMatch) {
        const threshold = parseFloat(thresholdMatch[1]);
        const data = result.data as Record<string, unknown>;
        
        if (result.resourceType === "Observation") {
          const valueQuantity = data.valueQuantity as { value: number } | undefined;
          if (valueQuantity && valueQuantity.value <= threshold) return false;
        }
        
        if (result.resourceType === "Patient") {
          const lastHbA1c = data.lastHbA1c as { value: number } | undefined;
          if (lastHbA1c && lastHbA1c.value <= threshold) return false;
        }
      }
    }

    if (lowerQuery.includes("hypertension") || lowerQuery.includes("blood pressure")) {
      const hasHypertension = result.summary.toLowerCase().includes("hypertension") ||
        result.summary.toLowerCase().includes("blood pressure") ||
        result.matchedCriteria.some(c => c.toLowerCase().includes("hypertension") || c.toLowerCase().includes("blood pressure"));
      if (!hasHypertension) return false;
    }

    if (lowerQuery.includes("metformin")) {
      const hasMetformin = result.summary.toLowerCase().includes("metformin") ||
        result.display.toLowerCase().includes("metformin");
      if (!hasMetformin) return false;
    }

    if (lowerQuery.includes("insulin")) {
      const hasInsulin = result.summary.toLowerCase().includes("insulin") ||
        (result.data as Record<string, unknown>).medications?.toString().toLowerCase().includes("insulin");
      if (!hasInsulin) return false;
    }

    return true;
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

async function generateAIExplanation(parsedQuery: ParsedNLQuery, results: NLSearchResult[]): Promise<string> {
  if (!openai) {
    return `Found ${results.length} result(s) matching "${parsedQuery.intent}". ` +
      `Searched across ${parsedQuery.resourceTypes.join(", ")} resources. ` +
      (results.length > 0 
        ? `Top result: ${results[0].display} - ${results[0].summary}.`
        : "No matching records found. Try broadening your search criteria.");
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are a clinical data assistant. Provide a brief, professional summary of search results. Keep it under 100 words. Do not provide medical advice - only describe the data found." 
        },
        { 
          role: "user", 
          content: `Query: "${parsedQuery.originalQuery}"\nResults found: ${results.length}\nResource types: ${parsedQuery.resourceTypes.join(", ")}\nTop results: ${results.slice(0, 3).map(r => `${r.display}: ${r.summary}`).join("; ")}\n\nProvide a brief summary of what was found.` 
        }
      ],
      max_completion_tokens: 150,
    });

    return response.choices[0]?.message?.content || "Search completed successfully.";
  } catch {
    return `Found ${results.length} result(s) for your query about ${parsedQuery.intent}.`;
  }
}

function generateRelatedQueries(parsedQuery: ParsedNLQuery): string[] {
  const related: string[] = [];
  const lowerQuery = parsedQuery.originalQuery.toLowerCase();

  if (lowerQuery.includes("diabetes")) {
    related.push("Patients with diabetes and recent eye exam");
    related.push("Diabetes patients on metformin with kidney function");
    related.push("Diabetic patients with foot ulcer history");
  }

  if (lowerQuery.includes("hba1c")) {
    related.push("HbA1c trends over the past year");
    related.push("Patients with improving HbA1c levels");
    related.push("Compare HbA1c before and after medication changes");
  }

  if (lowerQuery.includes("hypertension")) {
    related.push("Hypertensive patients with recent cardiac events");
    related.push("Blood pressure readings in the last 6 months");
    related.push("Hypertension patients not on ACE inhibitors");
  }

  if (related.length === 0) {
    related.push("Show all active conditions");
    related.push("Recent lab results");
    related.push("Current medications");
  }

  return related.slice(0, 5);
}

export async function searchWithNaturalLanguage(
  query: string,
  userId: string = "anonymous"
): Promise<NLSearchResponse> {
  const startTime = Date.now();

  const parsedQuery = await parseQueryWithAI(query);
  const results = executeSearch(parsedQuery);
  const aiExplanation = await generateAIExplanation(parsedQuery, results);
  const relatedQueries = generateRelatedQueries(parsedQuery);

  searchHistory.push({
    id: randomUUID(),
    query,
    parsedQuery,
    resultCount: results.length,
    userId,
    searchedAt: new Date().toISOString()
  });

  if (searchHistory.length > 100) {
    searchHistory.shift();
  }

  return {
    query: parsedQuery,
    results,
    total: results.length,
    executionTimeMs: Date.now() - startTime,
    aiExplanation,
    relatedQueries
  };
}

export function getSearchHistory(userId?: string, limit: number = 20): SearchHistoryEntry[] {
  let history = searchHistory;
  if (userId) {
    history = history.filter(h => h.userId === userId);
  }
  return history.slice(-limit).reverse();
}

export function saveQuery(
  id: string,
  name: string,
  query: string,
  userId: string
): { id: string; name: string; query: string; userId: string; createdAt: string } {
  const saved = {
    id,
    name,
    query,
    userId,
    createdAt: new Date().toISOString()
  };
  savedQueries.set(id, saved);
  return saved;
}

export function getSavedQueries(userId?: string): Array<{ id: string; name: string; query: string; userId: string; createdAt: string }> {
  const queries = Array.from(savedQueries.values());
  if (userId) {
    return queries.filter(q => q.userId === userId);
  }
  return queries;
}

export function deleteSavedQuery(id: string): boolean {
  return savedQueries.delete(id);
}

export function getSuggestedQueries(): string[] {
  return [
    "Find all patients with uncontrolled diabetes and HbA1c above 8%",
    "Show patients with hypertension and recent blood pressure above 140/90",
    "List diabetic patients on insulin therapy",
    "Find patients with eGFR below 60 (kidney function)",
    "Show all patients with active allergies to penicillin",
    "Patients with diabetes and cholesterol above 200",
    "Recent lab results for glucose levels",
    "Find elderly patients (age above 65) with multiple conditions",
    "Patients who missed their last appointment",
    "Show patients due for annual HbA1c screening"
  ];
}

export function getSearchMetadata() {
  return {
    version: "1.0.0",
    supportedResourceTypes: FHIR_RESOURCE_TYPES,
    clinicalConcepts: Object.keys(CLINICAL_CONCEPTS),
    aiEnabled: !!openai,
    features: [
      "Natural language query parsing",
      "AI-powered query translation",
      "FHIR R4 search parameter generation",
      "Clinical concept recognition",
      "Numeric threshold comparisons",
      "Search history tracking",
      "Query suggestions",
      "Related query generation"
    ]
  };
}

console.log("[AIFHIRNLSearch] Service initialized with", openai ? "AI-powered" : "rule-based", "query parsing");
