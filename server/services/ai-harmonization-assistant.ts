import { randomUUID } from "crypto";
import { createHash } from "crypto";
import OpenAI from "openai";
import { aiFhirHarmonizationEngine } from "./ai-fhir-harmonization-engine";

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

const PHI_PATTERNS = {
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  mrn: /\bMRN[:\s]*\d+\b/gi,
  dob: /\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](19|20)\d{2}\b/g,
};

function sanitizePhi(text: string): string {
  let sanitized = text;
  Object.values(PHI_PATTERNS).forEach(pattern => {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  });
  return sanitized;
}

const NO_CDS_HARMONIZATION_ASSISTANT_PROMPT = `You are an AI assistant specializing in FHIR data harmonization and interoperability.

=== CRITICAL: NO CLINICAL DECISION SUPPORT (NO-CDS) POLICY ===
YOU MUST NEVER:
- Provide medical diagnoses or treatment recommendations
- Offer clinical advice of any kind
- Discuss drug interactions or medication guidance
- Make patient care decisions or suggestions
- Recommend clinical interventions
- Interpret symptoms or provide health assessments

If asked about clinical matters, REFUSE and state: "I cannot provide clinical advice. Please consult a healthcare professional."

YOUR ROLE IS STRICTLY LIMITED TO:
- Analyzing FHIR data mappings and transformations
- Identifying data structure inconsistencies
- Suggesting profile modifications for better interoperability
- Recommending code system harmonization
- Advising on FHIR resource alignment
- Guiding data standardization best practices
=== END NO-CDS POLICY ===

You help users understand and improve data harmonization across different FHIR servers and custom profiles.
Provide clear, actionable guidance for improving data interoperability.`;

export type ProfileType = "us-core" | "hl7-fhir-r4" | "custom" | "c-cda" | "ips" | "mcode";
export type SuggestionStatus = "pending" | "applied" | "rejected" | "partially_applied";
export type SuggestionPriority = "critical" | "high" | "medium" | "low";
export type SuggestionCategory = "mapping" | "profile" | "terminology" | "structure" | "validation" | "transformation";

export interface FHIRProfile {
  id: string;
  name: string;
  type: ProfileType;
  baseUrl: string;
  version: string;
  resourceTypes: string[];
  extensions: ProfileExtension[];
  constraints: ProfileConstraint[];
  terminology: TerminologyBinding[];
  lastUpdated: string;
  sourceSystem?: string;
}

export interface ProfileExtension {
  url: string;
  name: string;
  type: string;
  cardinality: string;
  description: string;
  appliesTo: string[];
}

export interface ProfileConstraint {
  id: string;
  path: string;
  severity: "error" | "warning" | "information";
  human: string;
  expression?: string;
}

export interface TerminologyBinding {
  path: string;
  valueSet: string;
  strength: "required" | "extensible" | "preferred" | "example";
  description?: string;
}

export interface MappingInconsistency {
  id: string;
  sourceProfileId: string;
  targetProfileId?: string;
  type: "semantic" | "structural" | "cardinality" | "terminology" | "extension" | "constraint";
  severity: SuggestionPriority;
  path: string;
  description: string;
  impact: string;
  detectedAt: string;
  relatedSuggestionIds: string[];
}

export interface HarmonizationSuggestion {
  id: string;
  category: SuggestionCategory;
  priority: SuggestionPriority;
  title: string;
  description: string;
  rationale: string;
  affectedProfiles: string[];
  affectedPaths: string[];
  currentState: string;
  suggestedState: string;
  implementationSteps: ImplementationStep[];
  estimatedEffort: "minimal" | "moderate" | "significant";
  interoperabilityImpact: string;
  complianceImpact: string[];
  status: SuggestionStatus;
  createdAt: string;
  appliedAt?: string;
  appliedBy?: string;
  rejectionReason?: string;
}

export interface ImplementationStep {
  order: number;
  action: "add" | "modify" | "remove" | "map" | "transform";
  target: string;
  details: Record<string, any>;
  reversible: boolean;
}

export interface ConversationContext {
  id: string;
  userId: string;
  messages: ConversationMessage[];
  activeProfiles: string[];
  activeMappings: string[];
  lastActivity: string;
  createdAt: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  suggestions?: string[];
  actions?: AssistantAction[];
}

export interface AssistantAction {
  type: "analyze" | "suggest" | "apply" | "compare" | "validate";
  target: string;
  status: "pending" | "completed" | "failed";
  result?: any;
}

export interface ProfileAnalysisResult {
  profileId: string;
  profileName: string;
  analysisId: string;
  overallScore: number;
  categoryScores: {
    structuralCompliance: number;
    terminologyAlignment: number;
    extensionUsage: number;
    constraintCoverage: number;
    interoperability: number;
  };
  inconsistencies: MappingInconsistency[];
  suggestions: HarmonizationSuggestion[];
  comparisonWithStandard?: {
    standardProfile: ProfileType;
    deviations: string[];
    alignmentPercentage: number;
  };
  analyzedAt: string;
}

export interface ApplicationResult {
  suggestionId: string;
  success: boolean;
  appliedSteps: number;
  totalSteps: number;
  changes: AppliedChange[];
  rollbackAvailable: boolean;
  error?: string;
}

export interface AppliedChange {
  stepOrder: number;
  action: string;
  target: string;
  previousValue?: any;
  newValue?: any;
  timestamp: string;
}

const profileStore = new Map<string, FHIRProfile>();
const inconsistencyStore = new Map<string, MappingInconsistency>();
const suggestionStore = new Map<string, HarmonizationSuggestion>();
const conversationStore = new Map<string, ConversationContext>();
const analysisStore = new Map<string, ProfileAnalysisResult>();
const changeHistoryStore = new Map<string, AppliedChange[]>();

let openai: OpenAI | null = null;

function initializeOpenAI(): void {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

  if (apiKey) {
    openai = new OpenAI({
      apiKey,
      baseURL: baseURL || undefined,
    });
    console.log("[AIHarmonizationAssistant] OpenAI client configured");
  } else {
    console.log("[AIHarmonizationAssistant] OpenAI not configured, using rule-based analysis");
  }
}

function initializeSampleData(): void {
  const usCoreProfile: FHIRProfile = {
    id: "profile-us-core-patient",
    name: "US Core Patient Profile",
    type: "us-core",
    baseUrl: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
    version: "6.1.0",
    resourceTypes: ["Patient"],
    extensions: [
      { url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race", name: "US Core Race", type: "complex", cardinality: "0..1", description: "Patient race information", appliesTo: ["Patient"] },
      { url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity", name: "US Core Ethnicity", type: "complex", cardinality: "0..1", description: "Patient ethnicity information", appliesTo: ["Patient"] },
      { url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-birthsex", name: "US Core Birth Sex", type: "code", cardinality: "0..1", description: "Patient birth sex", appliesTo: ["Patient"] },
    ],
    constraints: [
      { id: "us-core-8", path: "Patient.name", severity: "error", human: "Patient.name.given or Patient.name.family or both SHALL be present" },
      { id: "us-core-9", path: "Patient.identifier", severity: "error", human: "At least one identifier SHALL be present" },
    ],
    terminology: [
      { path: "Patient.gender", valueSet: "http://hl7.org/fhir/ValueSet/administrative-gender", strength: "required" },
      { path: "Patient.maritalStatus", valueSet: "http://hl7.org/fhir/ValueSet/marital-status", strength: "extensible" },
    ],
    lastUpdated: new Date().toISOString(),
  };

  const customEHRProfile: FHIRProfile = {
    id: "profile-custom-epic",
    name: "Source Custom Patient Profile",
    type: "custom",
    baseUrl: "urn:epic:custom:patient",
    version: "2024.1",
    resourceTypes: ["Patient"],
    extensions: [
      { url: "urn:epic:extension:preferredPharmacy", name: "Preferred Pharmacy", type: "Reference", cardinality: "0..1", description: "Patient preferred pharmacy", appliesTo: ["Patient"] },
      { url: "urn:epic:extension:primaryCareProvider", name: "Primary Care Provider", type: "Reference", cardinality: "0..*", description: "Patient PCP list", appliesTo: ["Patient"] },
    ],
    constraints: [
      { id: "epic-1", path: "Patient.identifier", severity: "error", human: "MRN identifier is required" },
    ],
    terminology: [
      { path: "Patient.gender", valueSet: "urn:epic:valueset:gender", strength: "required" },
    ],
    lastUpdated: new Date().toISOString(),
    sourceSystem: "Primary Care Provider",
  };

  const customHospitalProfile: FHIRProfile = {
    id: "profile-custom-cerner",
    name: "Hospital Custom Patient Profile",
    type: "custom",
    baseUrl: "urn:cerner:custom:patient",
    version: "2024.2",
    resourceTypes: ["Patient"],
    extensions: [
      { url: "urn:cerner:extension:patientClass", name: "Patient Class", type: "code", cardinality: "0..1", description: "Patient classification", appliesTo: ["Patient"] },
    ],
    constraints: [
      { id: "cerner-1", path: "Patient.name", severity: "error", human: "Patient name is required" },
    ],
    terminology: [
      { path: "Patient.gender", valueSet: "urn:cerner:valueset:sex", strength: "required" },
    ],
    lastUpdated: new Date().toISOString(),
    sourceSystem: "Hospital Network",
  };

  profileStore.set(usCoreProfile.id, usCoreProfile);
  profileStore.set(customEHRProfile.id, customEHRProfile);
  profileStore.set(customHospitalProfile.id, customHospitalProfile);

  const inconsistency1: MappingInconsistency = {
    id: "inc-1",
    sourceProfileId: "profile-custom-epic",
    targetProfileId: "profile-us-core-patient",
    type: "terminology",
    severity: "high",
    path: "Patient.gender",
    description: "Source uses custom gender valueset that differs from US Core required valueset",
    impact: "Data may fail validation when sent to US Core compliant systems",
    detectedAt: new Date().toISOString(),
    relatedSuggestionIds: ["sug-1"],
  };

  const inconsistency2: MappingInconsistency = {
    id: "inc-2",
    sourceProfileId: "profile-custom-epic",
    targetProfileId: "profile-us-core-patient",
    type: "extension",
    severity: "medium",
    path: "Patient",
    description: "Missing US Core required extensions for race and ethnicity",
    impact: "Non-compliant with US Core certification requirements",
    detectedAt: new Date().toISOString(),
    relatedSuggestionIds: ["sug-2"],
  };

  inconsistencyStore.set(inconsistency1.id, inconsistency1);
  inconsistencyStore.set(inconsistency2.id, inconsistency2);

  const suggestion1: HarmonizationSuggestion = {
    id: "sug-1",
    category: "terminology",
    priority: "high",
    title: "Align Gender ValueSet with US Core",
    description: "Map Source custom gender codes to FHIR administrative-gender valueset",
    rationale: "US Core requires the standard FHIR administrative-gender valueset for Patient.gender",
    affectedProfiles: ["profile-custom-epic"],
    affectedPaths: ["Patient.gender"],
    currentState: "Using urn:epic:valueset:gender with codes M, F, U, O",
    suggestedState: "Map to http://hl7.org/fhir/ValueSet/administrative-gender with codes male, female, unknown, other",
    implementationSteps: [
      { order: 1, action: "map", target: "Patient.gender", details: { from: "M", to: "male" }, reversible: true },
      { order: 2, action: "map", target: "Patient.gender", details: { from: "F", to: "female" }, reversible: true },
      { order: 3, action: "map", target: "Patient.gender", details: { from: "U", to: "unknown" }, reversible: true },
      { order: 4, action: "map", target: "Patient.gender", details: { from: "O", to: "other" }, reversible: true },
      { order: 5, action: "modify", target: "terminology.Patient.gender", details: { valueSet: "http://hl7.org/fhir/ValueSet/administrative-gender", strength: "required" }, reversible: true },
    ],
    estimatedEffort: "minimal",
    interoperabilityImpact: "Enables seamless data exchange with US Core compliant systems",
    complianceImpact: ["US Core 6.1.0", "ONC Health IT Certification"],
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const suggestion2: HarmonizationSuggestion = {
    id: "sug-2",
    category: "profile",
    priority: "medium",
    title: "Add US Core Race and Ethnicity Extensions",
    description: "Add support for US Core race and ethnicity extensions to Source profile",
    rationale: "US Core requires support for race and ethnicity extensions for regulatory compliance",
    affectedProfiles: ["profile-custom-epic"],
    affectedPaths: ["Patient"],
    currentState: "No race/ethnicity extensions defined",
    suggestedState: "Add us-core-race and us-core-ethnicity extensions",
    implementationSteps: [
      { order: 1, action: "add", target: "extension", details: { url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race", name: "US Core Race", type: "complex", cardinality: "0..1" }, reversible: true },
      { order: 2, action: "add", target: "extension", details: { url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity", name: "US Core Ethnicity", type: "complex", cardinality: "0..1" }, reversible: true },
      { order: 3, action: "add", target: "mapping", details: { sourcePath: "patient.raceCode", targetPath: "Patient.extension(us-core-race).ombCategory.valueCoding" }, reversible: true },
    ],
    estimatedEffort: "moderate",
    interoperabilityImpact: "Required for US Core certification and CMS interoperability rules",
    complianceImpact: ["US Core 6.1.0", "CMS Interoperability Rule", "ONC Health IT Certification"],
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  suggestionStore.set(suggestion1.id, suggestion1);
  suggestionStore.set(suggestion2.id, suggestion2);

  console.log("[AIHarmonizationAssistant] Initialized sample profiles:", profileStore.size);
  console.log("[AIHarmonizationAssistant] Initialized sample inconsistencies:", inconsistencyStore.size);
  console.log("[AIHarmonizationAssistant] Initialized sample suggestions:", suggestionStore.size);
}

class AIHarmonizationAssistantService {
  constructor() {
    initializeOpenAI();
    initializeSampleData();
    console.log("[AIHarmonizationAssistant] Service initialized");
  }

  getProfiles(type?: ProfileType): FHIRProfile[] {
    const profiles = Array.from(profileStore.values());
    if (type) {
      return profiles.filter(p => p.type === type);
    }
    return profiles;
  }

  getProfile(id: string): FHIRProfile | undefined {
    return profileStore.get(id);
  }

  createProfile(profile: Omit<FHIRProfile, "id" | "lastUpdated">): FHIRProfile {
    const newProfile: FHIRProfile = {
      ...profile,
      id: `profile-${randomUUID().substring(0, 8)}`,
      lastUpdated: new Date().toISOString(),
    };
    profileStore.set(newProfile.id, newProfile);
    return newProfile;
  }

  updateProfile(id: string, updates: Partial<FHIRProfile>): FHIRProfile | undefined {
    const profile = profileStore.get(id);
    if (!profile) return undefined;

    const updated: FHIRProfile = {
      ...profile,
      ...updates,
      id: profile.id,
      lastUpdated: new Date().toISOString(),
    };
    profileStore.set(id, updated);
    return updated;
  }

  getInconsistencies(filters?: { profileId?: string; severity?: SuggestionPriority; type?: string }): MappingInconsistency[] {
    let inconsistencies = Array.from(inconsistencyStore.values());
    
    if (filters?.profileId) {
      inconsistencies = inconsistencies.filter(i => 
        i.sourceProfileId === filters.profileId || i.targetProfileId === filters.profileId
      );
    }
    if (filters?.severity) {
      inconsistencies = inconsistencies.filter(i => i.severity === filters.severity);
    }
    if (filters?.type) {
      inconsistencies = inconsistencies.filter(i => i.type === filters.type);
    }
    
    return inconsistencies;
  }

  getSuggestions(filters?: { status?: SuggestionStatus; priority?: SuggestionPriority; category?: SuggestionCategory }): HarmonizationSuggestion[] {
    let suggestions = Array.from(suggestionStore.values());
    
    if (filters?.status) {
      suggestions = suggestions.filter(s => s.status === filters.status);
    }
    if (filters?.priority) {
      suggestions = suggestions.filter(s => s.priority === filters.priority);
    }
    if (filters?.category) {
      suggestions = suggestions.filter(s => s.category === filters.category);
    }
    
    return suggestions;
  }

  getSuggestion(id: string): HarmonizationSuggestion | undefined {
    return suggestionStore.get(id);
  }

  async analyzeProfile(profileId: string, compareWith?: ProfileType): Promise<ProfileAnalysisResult> {
    const profile = profileStore.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    const analysisId = randomUUID();
    const inconsistencies: MappingInconsistency[] = [];
    const suggestions: HarmonizationSuggestion[] = [];

    const categoryScores = {
      structuralCompliance: 0,
      terminologyAlignment: 0,
      extensionUsage: 0,
      constraintCoverage: 0,
      interoperability: 0,
    };

    if (profile.type === "custom") {
      categoryScores.structuralCompliance = 75;
      categoryScores.terminologyAlignment = 60;
      categoryScores.extensionUsage = 50;
      categoryScores.constraintCoverage = 70;
      categoryScores.interoperability = 55;

      if (compareWith === "us-core" || !compareWith) {
        const usCoreProfile = Array.from(profileStore.values()).find(p => p.type === "us-core");
        
        if (usCoreProfile) {
          for (const requiredExt of usCoreProfile.extensions) {
            const hasExtension = profile.extensions.some(e => e.url === requiredExt.url);
            if (!hasExtension) {
              const incId = randomUUID();
              const sugId = randomUUID();
              
              inconsistencies.push({
                id: incId,
                sourceProfileId: profileId,
                targetProfileId: usCoreProfile.id,
                type: "extension",
                severity: "medium",
                path: requiredExt.appliesTo[0] || "Resource",
                description: `Missing ${requiredExt.name} extension required by US Core`,
                impact: "May not meet US Core certification requirements",
                detectedAt: new Date().toISOString(),
                relatedSuggestionIds: [sugId],
              });

              suggestions.push({
                id: sugId,
                category: "profile",
                priority: "medium",
                title: `Add ${requiredExt.name} Extension`,
                description: `Add support for ${requiredExt.name} extension from US Core`,
                rationale: `US Core requires this extension for ${requiredExt.appliesTo.join(", ")} resources`,
                affectedProfiles: [profileId],
                affectedPaths: requiredExt.appliesTo,
                currentState: "Extension not present",
                suggestedState: `Add extension: ${requiredExt.url}`,
                implementationSteps: [
                  { order: 1, action: "add", target: "extension", details: { url: requiredExt.url, name: requiredExt.name, type: requiredExt.type, cardinality: requiredExt.cardinality }, reversible: true },
                ],
                estimatedEffort: "moderate",
                interoperabilityImpact: "Improves compatibility with US Core systems",
                complianceImpact: ["US Core compliance"],
                status: "pending",
                createdAt: new Date().toISOString(),
              });
            }
          }

          for (const tb of profile.terminology) {
            const standardBinding = usCoreProfile.terminology.find(t => t.path === tb.path);
            if (standardBinding && tb.valueSet !== standardBinding.valueSet) {
              const incId = randomUUID();
              const sugId = randomUUID();

              inconsistencies.push({
                id: incId,
                sourceProfileId: profileId,
                targetProfileId: usCoreProfile.id,
                type: "terminology",
                severity: "high",
                path: tb.path,
                description: `Terminology binding differs from US Core standard`,
                impact: "Data validation may fail in US Core compliant systems",
                detectedAt: new Date().toISOString(),
                relatedSuggestionIds: [sugId],
              });

              suggestions.push({
                id: sugId,
                category: "terminology",
                priority: "high",
                title: `Align ${tb.path} Terminology`,
                description: `Update terminology binding for ${tb.path} to match US Core`,
                rationale: `US Core requires ${standardBinding.valueSet} with strength ${standardBinding.strength}`,
                affectedProfiles: [profileId],
                affectedPaths: [tb.path],
                currentState: `Using ${tb.valueSet}`,
                suggestedState: `Use ${standardBinding.valueSet}`,
                implementationSteps: [
                  { order: 1, action: "modify", target: `terminology.${tb.path}`, details: { valueSet: standardBinding.valueSet, strength: standardBinding.strength }, reversible: true },
                ],
                estimatedEffort: "minimal",
                interoperabilityImpact: "Enables standard terminology exchange",
                complianceImpact: ["US Core terminology compliance"],
                status: "pending",
                createdAt: new Date().toISOString(),
              });
            }
          }
        }
      }
    } else {
      categoryScores.structuralCompliance = 95;
      categoryScores.terminologyAlignment = 90;
      categoryScores.extensionUsage = 85;
      categoryScores.constraintCoverage = 90;
      categoryScores.interoperability = 88;
    }

    const overallScore = Math.round(
      (categoryScores.structuralCompliance +
        categoryScores.terminologyAlignment +
        categoryScores.extensionUsage +
        categoryScores.constraintCoverage +
        categoryScores.interoperability) / 5
    );

    for (const inc of inconsistencies) {
      inconsistencyStore.set(inc.id, inc);
    }
    for (const sug of suggestions) {
      suggestionStore.set(sug.id, sug);
    }

    const result: ProfileAnalysisResult = {
      profileId,
      profileName: profile.name,
      analysisId,
      overallScore,
      categoryScores,
      inconsistencies,
      suggestions,
      comparisonWithStandard: compareWith ? {
        standardProfile: compareWith,
        deviations: inconsistencies.map(i => i.description),
        alignmentPercentage: overallScore,
      } : undefined,
      analyzedAt: new Date().toISOString(),
    };

    analysisStore.set(analysisId, result);
    return result;
  }

  async analyzeMapping(mappingId: string): Promise<{
    mappingId: string;
    analysis: any;
    inconsistencies: MappingInconsistency[];
    suggestions: HarmonizationSuggestion[];
  }> {
    const harmonizationAnalysis = await aiFhirHarmonizationEngine.runHarmonizationAnalysis();
    
    const mappingInconsistencies: MappingInconsistency[] = harmonizationAnalysis.discrepancies.map(d => ({
      id: `inc-${randomUUID().substring(0, 8)}`,
      sourceProfileId: mappingId,
      type: d.type as any,
      severity: d.severity as SuggestionPriority,
      path: d.fieldPath,
      description: d.description,
      impact: d.impact,
      detectedAt: new Date().toISOString(),
      relatedSuggestionIds: [],
    }));

    const mappingSuggestions: HarmonizationSuggestion[] = harmonizationAnalysis.suggestedRules.map(r => ({
      id: `sug-${randomUUID().substring(0, 8)}`,
      category: "mapping" as SuggestionCategory,
      priority: r.sourceSystemRules[0]?.priority === 1 ? "high" : "medium" as SuggestionPriority,
      title: r.name,
      description: r.description,
      rationale: `AI-generated rule with confidence ${r.aiConfidence || 0.8}`,
      affectedProfiles: [mappingId],
      affectedPaths: [r.fieldPath],
      currentState: "Current mapping configuration",
      suggestedState: JSON.stringify(r.targetDefinition),
      implementationSteps: [
        { order: 1, action: "modify", target: "mapping", details: r.targetDefinition, reversible: true },
      ],
      estimatedEffort: "moderate",
      interoperabilityImpact: "Improves data transformation accuracy",
      complianceImpact: ["FHIR R4 compliance", "Data quality improvement"],
      status: "pending",
      createdAt: new Date().toISOString(),
    }));

    for (const inc of mappingInconsistencies) {
      inconsistencyStore.set(inc.id, inc);
    }
    for (const sug of mappingSuggestions) {
      suggestionStore.set(sug.id, sug);
    }

    return {
      mappingId,
      analysis: harmonizationAnalysis,
      inconsistencies: mappingInconsistencies,
      suggestions: mappingSuggestions,
    };
  }

  async applySuggestion(suggestionId: string, userId: string): Promise<ApplicationResult> {
    const suggestion = suggestionStore.get(suggestionId);
    if (!suggestion) {
      throw new Error(`Suggestion not found: ${suggestionId}`);
    }

    if (suggestion.status === "applied") {
      throw new Error("Suggestion has already been applied");
    }

    const changes: AppliedChange[] = [];
    let appliedSteps = 0;

    try {
      for (const step of suggestion.implementationSteps) {
        const change: AppliedChange = {
          stepOrder: step.order,
          action: step.action,
          target: step.target,
          previousValue: this.getCurrentValue(step.target, suggestion.affectedProfiles[0]),
          newValue: step.details,
          timestamp: new Date().toISOString(),
        };

        this.applyStep(step, suggestion.affectedProfiles[0]);
        changes.push(change);
        appliedSteps++;
      }

      suggestion.status = "applied";
      suggestion.appliedAt = new Date().toISOString();
      suggestion.appliedBy = userId;
      suggestionStore.set(suggestionId, suggestion);

      const historyKey = `${suggestionId}-${Date.now()}`;
      changeHistoryStore.set(historyKey, changes);

      return {
        suggestionId,
        success: true,
        appliedSteps,
        totalSteps: suggestion.implementationSteps.length,
        changes,
        rollbackAvailable: true,
      };
    } catch (error: any) {
      return {
        suggestionId,
        success: false,
        appliedSteps,
        totalSteps: suggestion.implementationSteps.length,
        changes,
        rollbackAvailable: appliedSteps > 0,
        error: error.message,
      };
    }
  }

  private getCurrentValue(target: string, profileId: string): any {
    const profile = profileStore.get(profileId);
    if (!profile) return null;

    if (target.startsWith("extension")) {
      return profile.extensions;
    } else if (target.startsWith("terminology")) {
      const path = target.replace("terminology.", "");
      return profile.terminology.find(t => t.path === path);
    } else if (target.startsWith("constraint")) {
      return profile.constraints;
    }
    return null;
  }

  private applyStep(step: ImplementationStep, profileId: string): void {
    const profile = profileStore.get(profileId);
    if (!profile) return;

    switch (step.action) {
      case "add":
        if (step.target === "extension") {
          profile.extensions.push({
            url: step.details.url,
            name: step.details.name,
            type: step.details.type,
            cardinality: step.details.cardinality,
            description: step.details.description || "",
            appliesTo: step.details.appliesTo || profile.resourceTypes,
          });
        }
        break;
      case "modify":
        if (step.target.startsWith("terminology.")) {
          const path = step.target.replace("terminology.", "");
          const binding = profile.terminology.find(t => t.path === path);
          if (binding) {
            binding.valueSet = step.details.valueSet || binding.valueSet;
            binding.strength = step.details.strength || binding.strength;
          } else {
            profile.terminology.push({
              path,
              valueSet: step.details.valueSet,
              strength: step.details.strength,
            });
          }
        }
        break;
      case "map":
        break;
      case "remove":
        if (step.target === "extension") {
          const idx = profile.extensions.findIndex(e => e.url === step.details.url);
          if (idx !== -1) {
            profile.extensions.splice(idx, 1);
          }
        }
        break;
    }

    profile.lastUpdated = new Date().toISOString();
    profileStore.set(profileId, profile);
  }

  async rejectSuggestion(suggestionId: string, userId: string, reason: string): Promise<HarmonizationSuggestion> {
    const suggestion = suggestionStore.get(suggestionId);
    if (!suggestion) {
      throw new Error(`Suggestion not found: ${suggestionId}`);
    }

    suggestion.status = "rejected";
    suggestion.rejectionReason = reason;
    suggestionStore.set(suggestionId, suggestion);

    return suggestion;
  }

  startConversation(userId: string): ConversationContext {
    const context: ConversationContext = {
      id: randomUUID(),
      userId,
      messages: [{
        id: randomUUID(),
        role: "assistant",
        content: "Hello! I'm your FHIR Data Harmonization Assistant. I can help you analyze data mappings, identify inconsistencies between FHIR profiles, and suggest improvements for better interoperability. What would you like to work on today?",
        timestamp: new Date().toISOString(),
      }],
      activeProfiles: [],
      activeMappings: [],
      lastActivity: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    conversationStore.set(context.id, context);
    return context;
  }

  getConversation(conversationId: string): ConversationContext | undefined {
    return conversationStore.get(conversationId);
  }

  async chat(conversationId: string, userMessage: string): Promise<ConversationMessage> {
    const context = conversationStore.get(conversationId);
    if (!context) {
      throw new Error("Conversation not found");
    }

    const userMsg: ConversationMessage = {
      id: randomUUID(),
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    };
    context.messages.push(userMsg);

    let assistantContent: string;
    let suggestions: string[] = [];
    let actions: AssistantAction[] = [];

    if (openai) {
      try {
        const sanitizedMessage = sanitizePhi(userMessage);
        const recentMessages = context.messages.slice(-10).map(m => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.role === "user" ? sanitizePhi(m.content) : m.content,
        }));

        const profiles = this.getProfiles();
        const pendingSuggestions = this.getSuggestions({ status: "pending" });
        const inconsistencies = this.getInconsistencies();

        const contextInfo = `
Available profiles: ${profiles.map(p => `${p.name} (${p.type})`).join(", ")}
Pending suggestions: ${pendingSuggestions.length}
Open inconsistencies: ${inconsistencies.length}
`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_HARMONIZATION_ASSISTANT_PROMPT },
            { role: "system", content: `Current context:\n${contextInfo}` },
            ...recentMessages,
          ],
          temperature: 0.7,
          max_tokens: 1000,
        });

        assistantContent = response.choices[0].message.content || "I understand your question about data harmonization. Let me help you with that.";

        if (sanitizedMessage.toLowerCase().includes("analyze") || sanitizedMessage.toLowerCase().includes("check")) {
          suggestions = ["Run full profile analysis", "Compare with US Core", "View current inconsistencies"];
        } else if (sanitizedMessage.toLowerCase().includes("suggestion") || sanitizedMessage.toLowerCase().includes("fix")) {
          suggestions = ["View pending suggestions", "Apply all high-priority suggestions", "Review suggestion details"];
        }
      } catch (error) {
        console.error("[AIHarmonizationAssistant] Chat error:", error);
        assistantContent = this.getFallbackResponse(userMessage);
      }
    } else {
      assistantContent = this.getFallbackResponse(userMessage);
    }

    const assistantMsg: ConversationMessage = {
      id: randomUUID(),
      role: "assistant",
      content: assistantContent,
      timestamp: new Date().toISOString(),
      suggestions: suggestions.length > 0 ? suggestions : undefined,
      actions: actions.length > 0 ? actions : undefined,
    };

    context.messages.push(assistantMsg);
    context.lastActivity = new Date().toISOString();
    conversationStore.set(conversationId, context);

    return assistantMsg;
  }

  private getFallbackResponse(userMessage: string): string {
    const msg = userMessage.toLowerCase();

    if (msg.includes("profile") && (msg.includes("analyze") || msg.includes("check"))) {
      return "I can analyze your FHIR profiles for inconsistencies and interoperability issues. Would you like me to run an analysis on a specific profile or compare profiles against a standard like US Core?";
    }

    if (msg.includes("mapping") && (msg.includes("analyze") || msg.includes("check"))) {
      return "I can analyze your data mappings to identify semantic discrepancies, missing fields, and transformation issues. Which mapping would you like me to analyze?";
    }

    if (msg.includes("suggestion") || msg.includes("recommend")) {
      const pending = this.getSuggestions({ status: "pending" });
      if (pending.length > 0) {
        return `I found ${pending.length} pending suggestions for improving your data harmonization. Would you like me to show the high-priority ones first, or shall I provide details on all of them?`;
      }
      return "No pending suggestions at the moment. Would you like me to analyze your profiles or mappings to generate new recommendations?";
    }

    if (msg.includes("apply") || msg.includes("implement")) {
      return "I can help you apply harmonization suggestions directly to your profiles. Which suggestion would you like to apply? I'll show you exactly what changes will be made before proceeding.";
    }

    if (msg.includes("inconsisten") || msg.includes("problem") || msg.includes("issue")) {
      const inconsistencies = this.getInconsistencies();
      if (inconsistencies.length > 0) {
        const critical = inconsistencies.filter(i => i.severity === "critical" || i.severity === "high");
        return `I found ${inconsistencies.length} inconsistencies across your profiles, including ${critical.length} high-priority issues. Would you like me to explain the most critical ones and suggest fixes?`;
      }
      return "I haven't detected any significant inconsistencies yet. Would you like me to run a comprehensive analysis of your profiles and mappings?";
    }

    if (msg.includes("compare") || msg.includes("standard")) {
      return "I can compare your custom profiles against standards like US Core, HL7 FHIR R4, or IPS (International Patient Summary). Which standard would you like to compare against?";
    }

    return "I can help you with FHIR data harmonization in several ways:\n\n1. **Analyze profiles** - Check for inconsistencies and compliance issues\n2. **Review mappings** - Identify transformation problems\n3. **Apply suggestions** - Implement recommended improvements\n4. **Compare standards** - Check alignment with US Core or other profiles\n\nWhat would you like to explore?";
  }

  getDashboard(): {
    totalProfiles: number;
    customProfiles: number;
    standardProfiles: number;
    totalInconsistencies: number;
    criticalInconsistencies: number;
    pendingSuggestions: number;
    appliedSuggestions: number;
    overallHarmonizationScore: number;
    recentAnalyses: ProfileAnalysisResult[];
  } {
    const profiles = Array.from(profileStore.values());
    const inconsistencies = Array.from(inconsistencyStore.values());
    const suggestions = Array.from(suggestionStore.values());
    const analyses = Array.from(analysisStore.values());

    const customProfiles = profiles.filter(p => p.type === "custom").length;
    const standardProfiles = profiles.length - customProfiles;
    const criticalInconsistencies = inconsistencies.filter(i => i.severity === "critical" || i.severity === "high").length;
    const pendingSuggestions = suggestions.filter(s => s.status === "pending").length;
    const appliedSuggestions = suggestions.filter(s => s.status === "applied").length;

    const recentAnalyses = analyses
      .sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime())
      .slice(0, 5);

    const avgScore = recentAnalyses.length > 0
      ? Math.round(recentAnalyses.reduce((sum, a) => sum + a.overallScore, 0) / recentAnalyses.length)
      : 70;

    return {
      totalProfiles: profiles.length,
      customProfiles,
      standardProfiles,
      totalInconsistencies: inconsistencies.length,
      criticalInconsistencies,
      pendingSuggestions,
      appliedSuggestions,
      overallHarmonizationScore: avgScore,
      recentAnalyses,
    };
  }
}

export const aiHarmonizationAssistantService = new AIHarmonizationAssistantService();
