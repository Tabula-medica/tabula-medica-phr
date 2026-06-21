import OpenAI from "openai";
import { logPhiAccess } from "../security/hipaa-audit";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  console.log("[AIFHIRDataHarmonization] OpenAI client initialized for AI harmonization");
}

console.log("[AIFHIRDataHarmonization] Service initialized with NO-CDS compliance");
console.log("[AIFHIRDataHarmonization] Features: Concept Mapping, Data Cleansing, Profile Suggestions");
console.log("[AIFHIRDataHarmonization] Supported terminologies: SNOMED CT, LOINC, ICD-10, RxNorm, CPT, NDC, HCPCS, CVX");

const NO_CDS_DISCLAIMER = "IMPORTANT: This harmonization analysis is for INFORMATIONAL and DATA QUALITY purposes only. It does NOT constitute medical advice, diagnosis, or clinical decision support. All healthcare decisions must be made by qualified healthcare providers.";

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============== Types ==============

export type TerminologySystem = "snomed_ct" | "loinc" | "icd10" | "rxnorm" | "cpt" | "ndc" | "hcpcs" | "cvx" | "custom";
export type FHIRVersion = "R2" | "R3" | "R4" | "R5";
export type MappingConfidence = "high" | "medium" | "low" | "uncertain";
export type CleansingAction = "normalize" | "standardize" | "correct" | "enrich" | "deduplicate" | "validate";

export interface ConceptMapping {
  id: string;
  sourceCode: string;
  sourceSystem: TerminologySystem;
  sourceDisplay: string;
  targetCode: string;
  targetSystem: TerminologySystem;
  targetDisplay: string;
  equivalence: "equivalent" | "wider" | "narrower" | "related" | "unmatched";
  confidence: MappingConfidence;
  confidenceScore: number;
  rationale: string;
  alternativeMappings?: {
    code: string;
    system: TerminologySystem;
    display: string;
    confidence: number;
  }[];
  validatedBy?: string;
  validatedAt?: string;
  createdAt: string;
}

export interface DataCleansingResult {
  id: string;
  resourceType: string;
  resourceId: string;
  originalValue: any;
  cleanedValue: any;
  fieldPath: string;
  action: CleansingAction;
  issueType: string;
  description: string;
  confidence: number;
  applied: boolean;
  appliedAt?: string;
  createdAt: string;
}

export interface ProfileSuggestion {
  id: string;
  resourceType: string;
  suggestedProfile: string;
  profileUrl: string;
  profileVersion: string;
  rationale: string;
  compatibilityScore: number;
  requiredTransformations: {
    fieldPath: string;
    transformation: string;
    complexity: "simple" | "moderate" | "complex";
  }[];
  alternatives: {
    profile: string;
    url: string;
    score: number;
  }[];
  createdAt: string;
}

export interface HarmonizationSession {
  id: string;
  name: string;
  description: string;
  status: "pending" | "analyzing" | "completed" | "failed";
  sourceFHIRVersion: FHIRVersion;
  targetFHIRVersion: FHIRVersion;
  resourceCount: number;
  conceptMappings: ConceptMapping[];
  cleansingResults: DataCleansingResult[];
  profileSuggestions: ProfileSuggestion[];
  summary: HarmonizationSummary;
  createdAt: string;
  completedAt?: string;
}

export interface HarmonizationSummary {
  totalResources: number;
  conceptsMapped: number;
  conceptsUnmapped: number;
  issuesCleansed: number;
  profilesRecommended: number;
  overallQualityScore: number;
  aiInsights: string[];
  recommendations: string[];
  disclaimer: string;
}

// ============== Sample Data ==============

const terminologyMappings: Map<string, ConceptMapping[]> = new Map([
  ["snomed_to_icd10", [
    {
      id: generateId("map"),
      sourceCode: "73211009",
      sourceSystem: "snomed_ct",
      sourceDisplay: "Diabetes mellitus",
      targetCode: "E11",
      targetSystem: "icd10",
      targetDisplay: "Type 2 diabetes mellitus",
      equivalence: "narrower",
      confidence: "high",
      confidenceScore: 0.92,
      rationale: "SNOMED CT concept maps to specific ICD-10 diabetes type",
      createdAt: new Date().toISOString()
    },
    {
      id: generateId("map"),
      sourceCode: "38341003",
      sourceSystem: "snomed_ct",
      sourceDisplay: "Hypertensive disorder",
      targetCode: "I10",
      targetSystem: "icd10",
      targetDisplay: "Essential (primary) hypertension",
      equivalence: "equivalent",
      confidence: "high",
      confidenceScore: 0.95,
      rationale: "Direct mapping between hypertension concepts",
      createdAt: new Date().toISOString()
    }
  ]],
  ["loinc_standardization", [
    {
      id: generateId("map"),
      sourceCode: "2339-0",
      sourceSystem: "loinc",
      sourceDisplay: "Glucose [Mass/volume] in Blood",
      targetCode: "2339-0",
      targetSystem: "loinc",
      targetDisplay: "Glucose [Mass/volume] in Blood",
      equivalence: "equivalent",
      confidence: "high",
      confidenceScore: 1.0,
      rationale: "Canonical LOINC code for blood glucose",
      createdAt: new Date().toISOString()
    }
  ]]
]);

const canonicalProfiles: Map<string, ProfileSuggestion[]> = new Map([
  ["Patient", [
    {
      id: generateId("profile"),
      resourceType: "Patient",
      suggestedProfile: "US Core Patient Profile",
      profileUrl: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
      profileVersion: "6.1.0",
      rationale: "US Core Patient is the standard profile for patient data in US healthcare systems",
      compatibilityScore: 0.95,
      requiredTransformations: [
        { fieldPath: "identifier", transformation: "Add MRN identifier type", complexity: "simple" },
        { fieldPath: "name", transformation: "Ensure at least one name with family", complexity: "simple" }
      ],
      alternatives: [
        { profile: "IPS Patient", url: "http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips", score: 0.88 }
      ],
      createdAt: new Date().toISOString()
    }
  ]],
  ["Observation", [
    {
      id: generateId("profile"),
      resourceType: "Observation",
      suggestedProfile: "US Core Vital Signs Profile",
      profileUrl: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-vital-signs",
      profileVersion: "6.1.0",
      rationale: "Standardizes vital sign observations for interoperability",
      compatibilityScore: 0.92,
      requiredTransformations: [
        { fieldPath: "code", transformation: "Map to standard LOINC vital signs codes", complexity: "moderate" },
        { fieldPath: "category", transformation: "Add vital-signs category", complexity: "simple" }
      ],
      alternatives: [
        { profile: "US Core Laboratory Result", url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab", score: 0.85 }
      ],
      createdAt: new Date().toISOString()
    }
  ]],
  ["Condition", [
    {
      id: generateId("profile"),
      resourceType: "Condition",
      suggestedProfile: "US Core Condition Profile",
      profileUrl: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition",
      profileVersion: "6.1.0",
      rationale: "Standard profile for encoding patient conditions and diagnoses",
      compatibilityScore: 0.93,
      requiredTransformations: [
        { fieldPath: "code", transformation: "Ensure SNOMED CT or ICD-10 coding", complexity: "moderate" },
        { fieldPath: "category", transformation: "Add problem-list-item or encounter-diagnosis", complexity: "simple" }
      ],
      alternatives: [
        { profile: "IPS Condition", url: "http://hl7.org/fhir/uv/ips/StructureDefinition/Condition-uv-ips", score: 0.87 }
      ],
      createdAt: new Date().toISOString()
    }
  ]],
  ["Medication", [
    {
      id: generateId("profile"),
      resourceType: "Medication",
      suggestedProfile: "US Core Medication Profile",
      profileUrl: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medication",
      profileVersion: "6.1.0",
      rationale: "Standard profile for medication resources with RxNorm coding",
      compatibilityScore: 0.91,
      requiredTransformations: [
        { fieldPath: "code", transformation: "Map to RxNorm or NDC codes", complexity: "moderate" }
      ],
      alternatives: [
        { profile: "IPS Medication", url: "http://hl7.org/fhir/uv/ips/StructureDefinition/Medication-uv-ips", score: 0.86 }
      ],
      createdAt: new Date().toISOString()
    }
  ]]
]);

// In-memory storage
const harmonizationSessions: Map<string, HarmonizationSession> = new Map();
const conceptMappingCache: Map<string, ConceptMapping> = new Map();

// ============== AI Functions ==============

async function generateConceptMappingWithAI(
  sourceCode: string,
  sourceSystem: TerminologySystem,
  sourceDisplay: string,
  targetSystem: TerminologySystem
): Promise<ConceptMapping> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a medical terminology expert specializing in FHIR data harmonization.
Map concepts between healthcare terminologies (SNOMED CT, LOINC, ICD-10, RxNorm, CPT).
Provide accurate mappings with confidence scores and rationale.
NEVER provide clinical advice - focus only on terminology mapping.`
        },
        {
          role: "user",
          content: `Map the following concept to ${targetSystem}:
Source System: ${sourceSystem}
Source Code: ${sourceCode}
Source Display: ${sourceDisplay}

Provide the best matching concept in ${targetSystem} with:
1. Target code and display name
2. Equivalence type (equivalent, wider, narrower, related, unmatched)
3. Confidence score (0-1)
4. Brief rationale for the mapping
5. Up to 2 alternative mappings if applicable

Format as JSON.`
        }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      id: generateId("map"),
      sourceCode,
      sourceSystem,
      sourceDisplay,
      targetCode: result.targetCode || "unknown",
      targetSystem,
      targetDisplay: result.targetDisplay || "Unknown mapping",
      equivalence: result.equivalence || "unmatched",
      confidence: result.confidenceScore > 0.8 ? "high" : result.confidenceScore > 0.5 ? "medium" : "low",
      confidenceScore: result.confidenceScore || 0.5,
      rationale: result.rationale || "AI-generated mapping",
      alternativeMappings: result.alternatives || [],
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error("[AIFHIRDataHarmonization] AI mapping error:", error);
    return {
      id: generateId("map"),
      sourceCode,
      sourceSystem,
      sourceDisplay,
      targetCode: "unmatched",
      targetSystem,
      targetDisplay: "Unable to map",
      equivalence: "unmatched",
      confidence: "uncertain",
      confidenceScore: 0,
      rationale: "AI mapping failed - manual review required",
      createdAt: new Date().toISOString()
    };
  }
}

async function analyzeDataCleansingWithAI(
  resource: any,
  resourceType: string
): Promise<DataCleansingResult[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a FHIR data quality expert. Analyze FHIR resources for data quality issues.
Identify issues such as:
- Missing required fields
- Invalid formats (dates, codes, identifiers)
- Inconsistent naming conventions
- Non-standard terminology usage
- Duplicate or redundant data
- Unit inconsistencies

Suggest corrections with high confidence. NEVER provide clinical interpretation.`
        },
        {
          role: "user",
          content: `Analyze this ${resourceType} FHIR resource for data quality issues:
${JSON.stringify(resource, null, 2)}

Identify up to 5 data quality issues with:
1. Field path
2. Issue type
3. Original value
4. Suggested cleaned value
5. Cleansing action (normalize, standardize, correct, enrich, deduplicate, validate)
6. Confidence score (0-1)
7. Brief description

Format as JSON array of issues.`
        }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    const issues = result.issues || [];

    return issues.map((issue: any) => ({
      id: generateId("clean"),
      resourceType,
      resourceId: resource.id || "unknown",
      originalValue: issue.originalValue,
      cleanedValue: issue.cleanedValue,
      fieldPath: issue.fieldPath || "unknown",
      action: issue.action || "validate",
      issueType: issue.issueType || "unknown",
      description: issue.description || "Data quality issue detected",
      confidence: issue.confidence || 0.7,
      applied: false,
      createdAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error("[AIFHIRDataHarmonization] AI cleansing analysis error:", error);
    return [];
  }
}

async function suggestProfileWithAI(
  resource: any,
  resourceType: string
): Promise<ProfileSuggestion> {
  const cachedSuggestions = canonicalProfiles.get(resourceType);
  if (cachedSuggestions && cachedSuggestions.length > 0) {
    return { ...cachedSuggestions[0], id: generateId("profile") };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a FHIR implementation expert. Recommend the most appropriate FHIR profile for a given resource.
Consider US Core, IPS (International Patient Summary), and other standard profiles.
Provide specific profile URLs, versions, and required transformations.`
        },
        {
          role: "user",
          content: `Recommend the best FHIR profile for this ${resourceType} resource:
${JSON.stringify(resource, null, 2)}

Provide:
1. Recommended profile name and URL
2. Profile version
3. Compatibility score (0-1)
4. Rationale for recommendation
5. Required transformations with complexity (simple, moderate, complex)
6. Up to 2 alternative profiles

Format as JSON.`
        }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    return {
      id: generateId("profile"),
      resourceType,
      suggestedProfile: result.profileName || `${resourceType} Base Profile`,
      profileUrl: result.profileUrl || `http://hl7.org/fhir/StructureDefinition/${resourceType}`,
      profileVersion: result.version || "4.0.1",
      rationale: result.rationale || "AI-recommended profile",
      compatibilityScore: result.compatibilityScore || 0.8,
      requiredTransformations: result.transformations || [],
      alternatives: result.alternatives || [],
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error("[AIFHIRDataHarmonization] AI profile suggestion error:", error);
    return {
      id: generateId("profile"),
      resourceType,
      suggestedProfile: `${resourceType} Base Profile`,
      profileUrl: `http://hl7.org/fhir/StructureDefinition/${resourceType}`,
      profileVersion: "4.0.1",
      rationale: "Default FHIR base profile",
      compatibilityScore: 0.7,
      requiredTransformations: [],
      alternatives: [],
      createdAt: new Date().toISOString()
    };
  }
}

async function generateHarmonizationInsightsWithAI(
  session: HarmonizationSession
): Promise<{ insights: string[]; recommendations: string[] }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a healthcare data harmonization analyst. Provide insights and recommendations for FHIR data harmonization.
Focus on data quality, interoperability, and standardization. NEVER provide clinical advice.`
        },
        {
          role: "user",
          content: `Analyze this harmonization session and provide insights:
- Total resources: ${session.resourceCount}
- Concepts mapped: ${session.conceptMappings.length}
- Issues found: ${session.cleansingResults.length}
- Profile suggestions: ${session.profileSuggestions.length}
- Source FHIR version: ${session.sourceFHIRVersion}
- Target FHIR version: ${session.targetFHIRVersion}

Provide:
1. 3-5 key insights about the data quality and harmonization status
2. 3-5 actionable recommendations for improving data standardization

Format as JSON with "insights" and "recommendations" arrays.`
        }
      ],
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      insights: result.insights || ["Harmonization analysis completed"],
      recommendations: result.recommendations || ["Review unmapped concepts manually"]
    };
  } catch (error) {
    console.error("[AIFHIRDataHarmonization] AI insights error:", error);
    return {
      insights: ["Harmonization session completed", "Manual review recommended for complex mappings"],
      recommendations: ["Validate concept mappings with domain experts", "Apply data cleansing suggestions incrementally"]
    };
  }
}

// ============== Service Functions ==============

export async function createHarmonizationSession(
  name: string,
  description: string,
  fhirResources: any[],
  sourceFHIRVersion: FHIRVersion = "R4",
  targetFHIRVersion: FHIRVersion = "R4",
  userId?: string
): Promise<HarmonizationSession> {
  const sessionId = generateId("session");
  
  const session: HarmonizationSession = {
    id: sessionId,
    name,
    description,
    status: "analyzing",
    sourceFHIRVersion,
    targetFHIRVersion,
    resourceCount: fhirResources.length,
    conceptMappings: [],
    cleansingResults: [],
    profileSuggestions: [],
    summary: {
      totalResources: fhirResources.length,
      conceptsMapped: 0,
      conceptsUnmapped: 0,
      issuesCleansed: 0,
      profilesRecommended: 0,
      overallQualityScore: 0,
      aiInsights: [],
      recommendations: [],
      disclaimer: NO_CDS_DISCLAIMER
    },
    createdAt: new Date().toISOString()
  };

  harmonizationSessions.set(sessionId, session);

  // Log PHI access
  logPhiAccess({
    userId: userId || "system",
    action: "read",
    resourceType: "HarmonizationSession",
    resourceId: sessionId,
    details: `Harmonization session created with ${fhirResources.length} resources`
  });

  // Process resources asynchronously
  processHarmonizationSession(sessionId, fhirResources).catch(console.error);

  return session;
}

async function processHarmonizationSession(sessionId: string, fhirResources: any[]): Promise<void> {
  const session = harmonizationSessions.get(sessionId);
  if (!session) return;

  try {
    // 1. Analyze each resource for concept mapping, cleansing, and profile suggestions
    for (const resource of fhirResources) {
      const resourceType = resource.resourceType || "Unknown";

      // Extract coded concepts for mapping
      const codedElements = extractCodedElements(resource);
      for (const coded of codedElements) {
        if (coded.system && coded.code) {
          const mapping = await mapConcept(coded.code, coded.system as TerminologySystem, coded.display || "");
          if (mapping) {
            session.conceptMappings.push(mapping);
          }
        }
      }

      // Analyze for data cleansing issues
      const cleansingResults = await analyzeDataCleansingWithAI(resource, resourceType);
      session.cleansingResults.push(...cleansingResults);

      // Get profile suggestion
      const profileSuggestion = await suggestProfileWithAI(resource, resourceType);
      
      // Avoid duplicate profile suggestions
      if (!session.profileSuggestions.find(p => p.resourceType === resourceType)) {
        session.profileSuggestions.push(profileSuggestion);
      }
    }

    // 2. Generate AI insights
    const { insights, recommendations } = await generateHarmonizationInsightsWithAI(session);

    // 3. Calculate summary
    const mappedCount = session.conceptMappings.filter(m => m.equivalence !== "unmatched").length;
    const unmappedCount = session.conceptMappings.filter(m => m.equivalence === "unmatched").length;
    
    session.summary = {
      totalResources: session.resourceCount,
      conceptsMapped: mappedCount,
      conceptsUnmapped: unmappedCount,
      issuesCleansed: session.cleansingResults.length,
      profilesRecommended: session.profileSuggestions.length,
      overallQualityScore: calculateQualityScore(session),
      aiInsights: insights,
      recommendations: recommendations,
      disclaimer: NO_CDS_DISCLAIMER
    };

    session.status = "completed";
    session.completedAt = new Date().toISOString();
    harmonizationSessions.set(sessionId, session);

  } catch (error) {
    console.error("[AIFHIRDataHarmonization] Session processing error:", error);
    session.status = "failed";
    harmonizationSessions.set(sessionId, session);
  }
}

function extractCodedElements(resource: any): { code: string; system: string; display?: string }[] {
  const coded: { code: string; system: string; display?: string }[] = [];
  
  function extractFromObject(obj: any, path: string) {
    if (!obj || typeof obj !== "object") return;
    
    // Check for coding array
    if (obj.coding && Array.isArray(obj.coding)) {
      for (const c of obj.coding) {
        if (c.code && c.system) {
          coded.push({ code: c.code, system: normalizeSystem(c.system), display: c.display });
        }
      }
    }
    
    // Check for code directly
    if (obj.code && obj.system) {
      coded.push({ code: obj.code, system: normalizeSystem(obj.system), display: obj.display });
    }
    
    // Recurse into nested objects
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === "object") {
        extractFromObject(obj[key], `${path}.${key}`);
      }
    }
  }
  
  extractFromObject(resource, "");
  return coded;
}

function normalizeSystem(system: string): TerminologySystem {
  const lower = system.toLowerCase();
  if (lower.includes("snomed")) return "snomed_ct";
  if (lower.includes("loinc")) return "loinc";
  if (lower.includes("icd-10") || lower.includes("icd10")) return "icd10";
  if (lower.includes("rxnorm")) return "rxnorm";
  if (lower.includes("cpt")) return "cpt";
  if (lower.includes("ndc")) return "ndc";
  if (lower.includes("hcpcs")) return "hcpcs";
  if (lower.includes("cvx")) return "cvx";
  return "custom";
}

async function mapConcept(code: string, system: TerminologySystem, display: string): Promise<ConceptMapping | null> {
  const cacheKey = `${system}:${code}`;
  if (conceptMappingCache.has(cacheKey)) {
    return conceptMappingCache.get(cacheKey)!;
  }

  // Check pre-defined mappings
  for (const [_, mappings] of Array.from(terminologyMappings.entries())) {
    const found = mappings.find((m: ConceptMapping) => m.sourceCode === code && m.sourceSystem === system);
    if (found) {
      conceptMappingCache.set(cacheKey, found);
      return found;
    }
  }

  // Generate AI mapping for common cross-terminology scenarios
  if (system === "snomed_ct") {
    const mapping = await generateConceptMappingWithAI(code, system, display, "icd10");
    conceptMappingCache.set(cacheKey, mapping);
    return mapping;
  }

  return null;
}

function calculateQualityScore(session: HarmonizationSession): number {
  const mappingScore = session.conceptMappings.length > 0
    ? session.conceptMappings.filter(m => m.confidenceScore > 0.7).length / session.conceptMappings.length
    : 1;
  
  const cleansingScore = session.cleansingResults.length > 0
    ? 1 - (session.cleansingResults.filter(c => c.action !== "validate").length / (session.resourceCount * 5))
    : 1;
  
  const profileScore = session.profileSuggestions.length > 0
    ? session.profileSuggestions.reduce((sum, p) => sum + p.compatibilityScore, 0) / session.profileSuggestions.length
    : 0.8;

  return Math.min(1, Math.max(0, (mappingScore * 0.4 + cleansingScore * 0.3 + profileScore * 0.3)));
}

export function getHarmonizationSession(sessionId: string): HarmonizationSession | undefined {
  return harmonizationSessions.get(sessionId);
}

export function getAllHarmonizationSessions(): HarmonizationSession[] {
  return Array.from(harmonizationSessions.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function mapConceptBetweenSystems(
  sourceCode: string,
  sourceSystem: TerminologySystem,
  sourceDisplay: string,
  targetSystem: TerminologySystem
): Promise<ConceptMapping> {
  return generateConceptMappingWithAI(sourceCode, sourceSystem, sourceDisplay, targetSystem);
}

export async function analyzeResourceForCleansing(resource: any): Promise<DataCleansingResult[]> {
  const resourceType = resource.resourceType || "Unknown";
  return analyzeDataCleansingWithAI(resource, resourceType);
}

export async function getProfileSuggestion(resource: any): Promise<ProfileSuggestion> {
  const resourceType = resource.resourceType || "Unknown";
  return suggestProfileWithAI(resource, resourceType);
}

export function applyCleansingResult(resultId: string, sessionId: string): boolean {
  const session = harmonizationSessions.get(sessionId);
  if (!session) return false;

  const result = session.cleansingResults.find(r => r.id === resultId);
  if (!result) return false;

  result.applied = true;
  result.appliedAt = new Date().toISOString();
  harmonizationSessions.set(sessionId, session);
  return true;
}

export function validateConceptMapping(mappingId: string, sessionId: string, validatedBy: string): boolean {
  const session = harmonizationSessions.get(sessionId);
  if (!session) return false;

  const mapping = session.conceptMappings.find(m => m.id === mappingId);
  if (!mapping) return false;

  mapping.validatedBy = validatedBy;
  mapping.validatedAt = new Date().toISOString();
  harmonizationSessions.set(sessionId, session);
  return true;
}

export function getTerminologyStats(): {
  supportedSystems: TerminologySystem[];
  cachedMappings: number;
  predefinedMappings: number;
} {
  let predefinedCount = 0;
  for (const [_, mappings] of Array.from(terminologyMappings.entries())) {
    predefinedCount += mappings.length;
  }

  return {
    supportedSystems: ["snomed_ct", "loinc", "icd10", "rxnorm", "cpt", "ndc", "hcpcs", "cvx"],
    cachedMappings: conceptMappingCache.size,
    predefinedMappings: predefinedCount
  };
}

export function getCanonicalProfiles(resourceType?: string): ProfileSuggestion[] {
  if (resourceType) {
    return canonicalProfiles.get(resourceType) || [];
  }
  
  const all: ProfileSuggestion[] = [];
  for (const [_, profiles] of Array.from(canonicalProfiles.entries())) {
    all.push(...profiles);
  }
  return all;
}

export function generateSampleFHIRData(): any[] {
  return [
    {
      resourceType: "Patient",
      id: "patient-sample-1",
      identifier: [{ system: "http://hospital.org/mrn", value: "12345" }],
      name: [{ family: "smith", given: ["john", "james"] }],
      birthDate: "1985-03-15",
      gender: "male",
      address: [{ city: "boston", state: "MA", postalCode: "02101" }]
    },
    {
      resourceType: "Condition",
      id: "condition-sample-1",
      subject: { reference: "Patient/patient-sample-1" },
      code: {
        coding: [
          { system: "http://snomed.info/sct", code: "73211009", display: "Diabetes mellitus" }
        ]
      },
      clinicalStatus: { coding: [{ code: "active" }] },
      onsetDateTime: "2020-01-15"
    },
    {
      resourceType: "Observation",
      id: "observation-sample-1",
      status: "final",
      category: [{ coding: [{ code: "vital-signs" }] }],
      code: {
        coding: [
          { system: "http://loinc.org", code: "2339-0", display: "Glucose" }
        ]
      },
      subject: { reference: "Patient/patient-sample-1" },
      valueQuantity: { value: 120, unit: "mg/dL" },
      effectiveDateTime: "2024-01-15T10:30:00Z"
    },
    {
      resourceType: "MedicationRequest",
      id: "medrq-sample-1",
      status: "active",
      intent: "order",
      medicationCodeableConcept: {
        coding: [
          { system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "860975", display: "Metformin 500 MG" }
        ]
      },
      subject: { reference: "Patient/patient-sample-1" },
      dosageInstruction: [{ text: "Take 1 tablet twice daily" }]
    }
  ];
}
