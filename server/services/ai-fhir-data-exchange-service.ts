// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import { randomUUID } from "crypto";
import OpenAI from "openai";

const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const openaiBaseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

let openai: OpenAI | null = null;
if (openaiApiKey && openaiBaseURL) {
  openai = new OpenAI({
    apiKey: openaiApiKey,
    baseURL: openaiBaseURL,
  });
}

export type FHIRVersion = "DSTU2" | "STU3" | "R4" | "R4B" | "R5";

export interface FHIRProfile {
  id: string;
  name: string;
  url: string;
  version: FHIRVersion;
  resourceType: string;
  description: string;
  constraints: ProfileConstraint[];
}

export interface ProfileConstraint {
  path: string;
  requirement: "required" | "optional" | "prohibited";
  cardinality: string;
  valueSet?: string;
  fixedValue?: unknown;
  pattern?: unknown;
}

export interface MappingRule {
  id: string;
  sourceVersion: FHIRVersion;
  targetVersion: FHIRVersion;
  sourcePath: string;
  targetPath: string;
  transformation?: string;
  notes?: string;
  aiSuggested: boolean;
}

export interface VersionMapping {
  id: string;
  name: string;
  sourceVersion: FHIRVersion;
  targetVersion: FHIRVersion;
  resourceType: string;
  rules: MappingRule[];
  createdAt: string;
  status: "draft" | "validated" | "active";
}

export interface TransformationRecommendation {
  id: string;
  type: "structural" | "semantic" | "terminology" | "extension";
  priority: "required" | "recommended" | "optional";
  description: string;
  sourcePath: string;
  targetPath: string;
  suggestedTransformation: string;
  codeExample?: string;
  rationale: string;
}

export interface ValidationResult {
  id: string;
  resourceId: string;
  resourceType: string;
  profile: string;
  valid: boolean;
  issues: ValidationIssue[];
  validatedAt: string;
}

export interface ValidationIssue {
  severity: "error" | "warning" | "information";
  code: string;
  path: string;
  message: string;
  details?: string;
}

const FHIR_VERSION_CHANGES: Record<string, { from: FHIRVersion; to: FHIRVersion; changes: string[] }[]> = {
  "Patient": [
    {
      from: "STU3",
      to: "R4",
      changes: [
        "Patient.animal removed (use Extension)",
        "Patient.link.other renamed to Patient.link.otherPatient",
        "Patient.managingOrganization binding changed"
      ]
    },
    {
      from: "R4",
      to: "R5",
      changes: [
        "Patient.deceasedDateTime/deceasedBoolean consolidated",
        "Patient.communication.preferred binding strengthened"
      ]
    }
  ],
  "Observation": [
    {
      from: "STU3",
      to: "R4",
      changes: [
        "Observation.context renamed to Observation.encounter",
        "Observation.related removed (use hasMember/derivedFrom)",
        "Observation.component structure unchanged",
        "Observation.interpretation now 0..*"
      ]
    },
    {
      from: "R4",
      to: "R5",
      changes: [
        "Observation.triggeredBy added",
        "Observation.bodyStructure added as Reference"
      ]
    }
  ],
  "Condition": [
    {
      from: "STU3",
      to: "R4",
      changes: [
        "Condition.context renamed to Condition.encounter",
        "Condition.abatement types expanded",
        "Condition.stage.summary/assessment restructured"
      ]
    }
  ],
  "MedicationRequest": [
    {
      from: "STU3",
      to: "R4",
      changes: [
        "MedicationRequest.context renamed to encounter",
        "MedicationRequest.requester flattened",
        "MedicationRequest.dosageInstruction enhanced"
      ]
    }
  ]
};

const COMMON_PROFILES: FHIRProfile[] = [
  {
    id: "us-core-patient",
    name: "US Core Patient Profile",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
    version: "R4",
    resourceType: "Patient",
    description: "US Core Patient profile for meaningful use",
    constraints: [
      { path: "Patient.identifier", requirement: "required", cardinality: "1..*" },
      { path: "Patient.name", requirement: "required", cardinality: "1..*" },
      { path: "Patient.gender", requirement: "required", cardinality: "1..1" },
      { path: "Patient.birthDate", requirement: "optional", cardinality: "0..1" },
      { path: "Patient.race", requirement: "required", cardinality: "0..1" },
      { path: "Patient.ethnicity", requirement: "required", cardinality: "0..1" }
    ]
  },
  {
    id: "us-core-observation-lab",
    name: "US Core Laboratory Result Observation",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab",
    version: "R4",
    resourceType: "Observation",
    description: "US Core profile for laboratory results",
    constraints: [
      { path: "Observation.status", requirement: "required", cardinality: "1..1" },
      { path: "Observation.category", requirement: "required", cardinality: "1..*" },
      { path: "Observation.code", requirement: "required", cardinality: "1..1" },
      { path: "Observation.subject", requirement: "required", cardinality: "1..1" },
      { path: "Observation.effectiveDateTime", requirement: "required", cardinality: "0..1" },
      { path: "Observation.value[x]", requirement: "required", cardinality: "0..1" }
    ]
  },
  {
    id: "ips-patient",
    name: "International Patient Summary - Patient",
    url: "http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips",
    version: "R4",
    resourceType: "Patient",
    description: "IPS Patient profile for cross-border exchange",
    constraints: [
      { path: "Patient.identifier", requirement: "required", cardinality: "1..*" },
      { path: "Patient.name", requirement: "required", cardinality: "1..1" },
      { path: "Patient.birthDate", requirement: "required", cardinality: "1..1" }
    ]
  }
];

const mappings: Map<string, VersionMapping> = new Map();
const validationHistory: ValidationResult[] = [];

async function generateAIMappingRules(
  resourceType: string,
  sourceVersion: FHIRVersion,
  targetVersion: FHIRVersion
): Promise<MappingRule[]> {
  const knownChanges = FHIR_VERSION_CHANGES[resourceType]?.find(
    c => c.from === sourceVersion && c.to === targetVersion
  );

  if (!openai) {
    return knownChanges?.changes.map((change, i) => ({
      id: randomUUID(),
      sourceVersion,
      targetVersion,
      sourcePath: `${resourceType}.field${i + 1}`,
      targetPath: `${resourceType}.field${i + 1}`,
      transformation: change,
      aiSuggested: false
    })) || [];
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a FHIR interoperability expert. Generate mapping rules for converting ${resourceType} resources from FHIR ${sourceVersion} to ${targetVersion}.

Return a JSON object with a "rules" array:
{
  "rules": [
    {
      "sourcePath": "path.in.source",
      "targetPath": "path.in.target",
      "transformation": "description of transformation",
      "notes": "additional notes"
    }
  ]
}

Focus on structural changes between versions. Include 3-8 most important mappings.`
        },
        {
          role: "user",
          content: `Generate mapping rules for ${resourceType} from ${sourceVersion} to ${targetVersion}.${knownChanges ? `\nKnown changes:\n${knownChanges.changes.join("\n")}` : ""}`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 600,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No AI response");

    const parsed = JSON.parse(content);
    const rules = parsed.rules || parsed.mappings || parsed;
    
    if (!Array.isArray(rules)) {
      throw new Error("Invalid response format");
    }

    return rules.map((rule: Record<string, string>) => ({
      id: randomUUID(),
      sourceVersion,
      targetVersion,
      sourcePath: rule.sourcePath || "",
      targetPath: rule.targetPath || "",
      transformation: rule.transformation,
      notes: rule.notes,
      aiSuggested: true
    }));
  } catch (error) {
    console.error("[FHIRDataExchange] AI mapping generation error:", error);
    return [];
  }
}

export async function createVersionMapping(
  name: string,
  resourceType: string,
  sourceVersion: FHIRVersion,
  targetVersion: FHIRVersion
): Promise<VersionMapping> {
  const rules = await generateAIMappingRules(resourceType, sourceVersion, targetVersion);

  const mapping: VersionMapping = {
    id: randomUUID(),
    name,
    sourceVersion,
    targetVersion,
    resourceType,
    rules,
    createdAt: new Date().toISOString(),
    status: "draft"
  };

  mappings.set(mapping.id, mapping);
  return mapping;
}

export function getMapping(mappingId: string): VersionMapping | null {
  return mappings.get(mappingId) || null;
}

export function getAllMappings(): VersionMapping[] {
  return Array.from(mappings.values());
}

export async function getTransformationRecommendations(
  resourceType: string,
  sourceVersion: FHIRVersion,
  targetVersion: FHIRVersion
): Promise<TransformationRecommendation[]> {
  const recommendations: TransformationRecommendation[] = [];

  const knownChanges = FHIR_VERSION_CHANGES[resourceType]?.find(
    c => c.from === sourceVersion && c.to === targetVersion
  );

  if (knownChanges) {
    knownChanges.changes.forEach((change, i) => {
      recommendations.push({
        id: randomUUID(),
        type: "structural",
        priority: "required",
        description: change,
        sourcePath: `${resourceType}.*`,
        targetPath: `${resourceType}.*`,
        suggestedTransformation: `Update field according to ${targetVersion} specification`,
        rationale: `Required for ${sourceVersion} to ${targetVersion} compatibility`
      });
    });
  }

  if (!openai) {
    return recommendations;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a FHIR transformation expert. Provide intelligent recommendations for transforming ${resourceType} resources from ${sourceVersion} to ${targetVersion}.

Return JSON with recommendations array:
{
  "recommendations": [{
    "type": "structural|semantic|terminology|extension",
    "priority": "required|recommended|optional",
    "description": "brief description",
    "sourcePath": "source.path",
    "targetPath": "target.path",
    "suggestedTransformation": "how to transform",
    "rationale": "why this is needed"
  }]
}

Include 3-5 practical recommendations.`
        },
        {
          role: "user",
          content: `Recommend transformations for ${resourceType} from ${sourceVersion} to ${targetVersion}`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 600,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return recommendations;

    const parsed = JSON.parse(content);
    const aiRecs = parsed.recommendations || [];

    aiRecs.forEach((rec: Record<string, string>) => {
      recommendations.push({
        id: randomUUID(),
        type: (rec.type as TransformationRecommendation["type"]) || "structural",
        priority: (rec.priority as TransformationRecommendation["priority"]) || "recommended",
        description: rec.description || "",
        sourcePath: rec.sourcePath || "",
        targetPath: rec.targetPath || "",
        suggestedTransformation: rec.suggestedTransformation || "",
        rationale: rec.rationale || ""
      });
    });
  } catch (error) {
    console.error("[FHIRDataExchange] AI recommendations error:", error);
  }

  return recommendations;
}

export function validateAgainstProfile(
  resource: Record<string, unknown>,
  profileId: string
): ValidationResult {
  const profile = COMMON_PROFILES.find(p => p.id === profileId);
  const issues: ValidationIssue[] = [];
  
  const resourceType = resource.resourceType as string;
  const resourceId = (resource.id as string) || randomUUID();

  if (!profile) {
    issues.push({
      severity: "error",
      code: "PROFILE_NOT_FOUND",
      path: "",
      message: `Profile ${profileId} not found`
    });
  } else {
    if (profile.resourceType !== resourceType) {
      issues.push({
        severity: "error",
        code: "RESOURCE_TYPE_MISMATCH",
        path: "resourceType",
        message: `Expected ${profile.resourceType}, got ${resourceType}`
      });
    }

    profile.constraints.forEach(constraint => {
      const pathParts = constraint.path.split(".");
      let value: unknown = resource;
      
      for (let i = 1; i < pathParts.length; i++) {
        if (value && typeof value === "object") {
          value = (value as Record<string, unknown>)[pathParts[i]];
        } else {
          value = undefined;
          break;
        }
      }

      if (constraint.requirement === "required" && !value) {
        issues.push({
          severity: "error",
          code: "REQUIRED_ELEMENT_MISSING",
          path: constraint.path,
          message: `Required element ${constraint.path} is missing`,
          details: `Cardinality: ${constraint.cardinality}`
        });
      }

      if (constraint.requirement === "prohibited" && value) {
        issues.push({
          severity: "error",
          code: "PROHIBITED_ELEMENT_PRESENT",
          path: constraint.path,
          message: `Element ${constraint.path} is prohibited in this profile`
        });
      }
    });
  }

  const result: ValidationResult = {
    id: randomUUID(),
    resourceId,
    resourceType,
    profile: profileId,
    valid: issues.filter(i => i.severity === "error").length === 0,
    issues,
    validatedAt: new Date().toISOString()
  };

  validationHistory.push(result);
  if (validationHistory.length > 500) {
    validationHistory.shift();
  }

  return result;
}

export async function validateWithAIAssistance(
  resource: Record<string, unknown>,
  profileId: string
): Promise<ValidationResult & { aiInsights?: string[] }> {
  const baseResult = validateAgainstProfile(resource, profileId);

  if (!openai || baseResult.issues.length === 0) {
    return baseResult;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a FHIR validation expert. Analyze validation issues and provide helpful insights.
Return JSON: { "insights": ["array of helpful suggestions"] }`
        },
        {
          role: "user",
          content: `Profile: ${profileId}\nIssues:\n${JSON.stringify(baseResult.issues, null, 2)}\n\nProvide 2-3 insights on how to fix these issues.`
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 300,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return { ...baseResult, aiInsights: parsed.insights || [] };
    }
  } catch (error) {
    console.error("[FHIRDataExchange] AI validation insights error:", error);
  }

  return baseResult;
}

export function getAvailableProfiles(): FHIRProfile[] {
  return COMMON_PROFILES;
}

export function getValidationHistory(limit: number = 20): ValidationResult[] {
  return validationHistory.slice(-limit).reverse();
}

export function getSupportedVersions(): FHIRVersion[] {
  return ["DSTU2", "STU3", "R4", "R4B", "R5"];
}

export function getVersionChanges(resourceType: string): typeof FHIR_VERSION_CHANGES[string] {
  return FHIR_VERSION_CHANGES[resourceType] || [];
}

export function getServiceMetadata() {
  return {
    version: "1.0.0",
    aiEnabled: !!openai,
    supportedVersions: getSupportedVersions(),
    profileCount: COMMON_PROFILES.length,
    features: [
      "AI-assisted version mapping",
      "Intelligent transformation recommendations",
      "Profile-based validation",
      "AI validation insights",
      "Cross-version compatibility analysis"
    ]
  };
}

console.log("[FHIRDataExchange] Service initialized with", openai ? "AI-powered" : "rule-based", "capabilities");
