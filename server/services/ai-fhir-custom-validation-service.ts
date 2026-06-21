import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface StructureDefinitionProfile {
  id: string;
  name: string;
  url: string;
  version: string;
  description: string;
  type: string;
  baseDefinition?: string;
  status: "draft" | "active" | "retired";
  content: Record<string, unknown>;
  uploadedAt: Date;
  uploadMethod: "file" | "url" | "manual";
  elementDefinitions: ElementDefinition[];
}

export interface ElementDefinition {
  path: string;
  min: number;
  max: string;
  type?: string[];
  binding?: {
    strength: string;
    valueSet?: string;
  };
  constraints?: ElementConstraint[];
  mustSupport?: boolean;
  isModifier?: boolean;
}

export interface ElementConstraint {
  key: string;
  severity: "error" | "warning";
  human: string;
  expression?: string;
}

export interface ValidationIssue {
  id: string;
  severity: "error" | "warning" | "information";
  type: "structure" | "cardinality" | "value" | "binding" | "constraint" | "invariant" | "reference";
  path: string;
  message: string;
  details: string;
  element?: string;
  expectedValue?: string;
  actualValue?: string;
  constraintKey?: string;
  suggestion?: string;
}

export interface ValidationReport {
  id: string;
  resourceId: string;
  resourceType: string;
  profileId: string;
  profileName: string;
  validatedAt: Date;
  isValid: boolean;
  overallScore: number;
  summary: string;
  issues: ValidationIssue[];
  statistics: {
    totalElements: number;
    validElements: number;
    errorCount: number;
    warningCount: number;
    informationCount: number;
  };
  aiInsights: {
    criticalFindings: string[];
    recommendations: string[];
    complianceNotes: string[];
  };
}

export interface ProfileCategory {
  id: string;
  name: string;
  description: string;
  profileCount: number;
}

const profileStore = new Map<string, StructureDefinitionProfile>();
const validationReportStore = new Map<string, ValidationReport>();

const builtInProfiles: StructureDefinitionProfile[] = [
  {
    id: "us-core-patient",
    name: "US Core Patient Profile",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
    version: "6.1.0",
    description: "Defines constraints on the Patient resource for US Core data elements",
    type: "Patient",
    baseDefinition: "http://hl7.org/fhir/StructureDefinition/Patient",
    status: "active",
    uploadMethod: "manual",
    uploadedAt: new Date(),
    content: {},
    elementDefinitions: [
      { path: "Patient.identifier", min: 1, max: "*", mustSupport: true },
      { path: "Patient.name", min: 1, max: "*", mustSupport: true },
      { path: "Patient.gender", min: 1, max: "1", mustSupport: true, binding: { strength: "required", valueSet: "http://hl7.org/fhir/ValueSet/administrative-gender" } },
      { path: "Patient.birthDate", min: 0, max: "1", mustSupport: true },
    ],
  },
  {
    id: "carin-bb-coverage",
    name: "CARIN Blue Button Coverage Profile",
    url: "http://hl7.org/fhir/us/carin-bb/StructureDefinition/C4BB-Coverage",
    version: "2.0.0",
    description: "Coverage profile for CARIN Blue Button implementation guide",
    type: "Coverage",
    baseDefinition: "http://hl7.org/fhir/StructureDefinition/Coverage",
    status: "active",
    uploadMethod: "manual",
    uploadedAt: new Date(),
    content: {},
    elementDefinitions: [
      { path: "Coverage.status", min: 1, max: "1", mustSupport: true },
      { path: "Coverage.type", min: 0, max: "1", mustSupport: true },
      { path: "Coverage.subscriber", min: 0, max: "1", mustSupport: true },
      { path: "Coverage.subscriberId", min: 0, max: "1", mustSupport: true },
      { path: "Coverage.beneficiary", min: 1, max: "1", mustSupport: true },
      { path: "Coverage.payor", min: 1, max: "*", mustSupport: true },
    ],
  },
  {
    id: "mcode-cancer-patient",
    name: "mCODE Cancer Patient Profile",
    url: "http://hl7.org/fhir/us/mcode/StructureDefinition/mcode-cancer-patient",
    version: "3.0.0",
    description: "Profile for cancer patients in mCODE implementation guide",
    type: "Patient",
    baseDefinition: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
    status: "active",
    uploadMethod: "manual",
    uploadedAt: new Date(),
    content: {},
    elementDefinitions: [
      { path: "Patient.identifier", min: 1, max: "*", mustSupport: true },
      { path: "Patient.name", min: 1, max: "*", mustSupport: true },
      { path: "Patient.gender", min: 1, max: "1", mustSupport: true },
      { path: "Patient.birthDate", min: 1, max: "1", mustSupport: true },
      { path: "Patient.address", min: 0, max: "*", mustSupport: true },
    ],
  },
  {
    id: "davinci-pdex-member",
    name: "Da Vinci PDex Member Match Profile",
    url: "http://hl7.org/fhir/us/davinci-pdex/StructureDefinition/pdex-member-match-request",
    version: "2.0.0",
    description: "Da Vinci Payer Data Exchange member matching profile",
    type: "Parameters",
    baseDefinition: "http://hl7.org/fhir/StructureDefinition/Parameters",
    status: "active",
    uploadMethod: "manual",
    uploadedAt: new Date(),
    content: {},
    elementDefinitions: [
      { path: "Parameters.parameter", min: 1, max: "*", mustSupport: true },
    ],
  },
];

builtInProfiles.forEach((profile) => profileStore.set(profile.id, profile));

class AIFHIRCustomValidationService {
  async getProfiles(): Promise<StructureDefinitionProfile[]> {
    return Array.from(profileStore.values());
  }

  async getProfile(id: string): Promise<StructureDefinitionProfile | undefined> {
    return profileStore.get(id);
  }

  async uploadProfileFromFile(
    fileContent: string,
    fileName: string
  ): Promise<StructureDefinitionProfile> {
    try {
      const parsed = JSON.parse(fileContent);
      
      if (parsed.resourceType !== "StructureDefinition") {
        throw new Error("File must contain a valid FHIR StructureDefinition resource");
      }

      const profile: StructureDefinitionProfile = {
        id: parsed.id || `custom-${Date.now()}`,
        name: parsed.name || fileName.replace(".json", ""),
        url: parsed.url || `urn:custom:${parsed.id || Date.now()}`,
        version: parsed.version || "1.0.0",
        description: parsed.description || "Custom uploaded profile",
        type: parsed.type || "Unknown",
        baseDefinition: parsed.baseDefinition,
        status: parsed.status || "draft",
        content: parsed,
        uploadedAt: new Date(),
        uploadMethod: "file",
        elementDefinitions: this.extractElementDefinitions(parsed),
      };

      profileStore.set(profile.id, profile);
      console.log(`[AIFHIRCustomValidation] Profile uploaded: ${profile.name}`);
      return profile;
    } catch (error) {
      console.error("[AIFHIRCustomValidation] Error parsing profile:", error);
      throw new Error(`Failed to parse StructureDefinition: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async uploadProfileFromUrl(url: string): Promise<StructureDefinitionProfile> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch profile from URL: ${response.statusText}`);
      }
      
      const parsed = await response.json();
      
      if (parsed.resourceType !== "StructureDefinition") {
        throw new Error("URL must point to a valid FHIR StructureDefinition resource");
      }

      const profile: StructureDefinitionProfile = {
        id: parsed.id || `url-${Date.now()}`,
        name: parsed.name || "URL Loaded Profile",
        url: parsed.url || url,
        version: parsed.version || "1.0.0",
        description: parsed.description || `Profile loaded from ${url}`,
        type: parsed.type || "Unknown",
        baseDefinition: parsed.baseDefinition,
        status: parsed.status || "draft",
        content: parsed,
        uploadedAt: new Date(),
        uploadMethod: "url",
        elementDefinitions: this.extractElementDefinitions(parsed),
      };

      profileStore.set(profile.id, profile);
      console.log(`[AIFHIRCustomValidation] Profile loaded from URL: ${profile.name}`);
      return profile;
    } catch (error) {
      console.error("[AIFHIRCustomValidation] Error loading profile from URL:", error);
      throw new Error(`Failed to load profile from URL: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  private extractElementDefinitions(structureDefinition: Record<string, unknown>): ElementDefinition[] {
    const elements: ElementDefinition[] = [];
    const snapshot = structureDefinition.snapshot as { element?: Array<Record<string, unknown>> } | undefined;
    const differential = structureDefinition.differential as { element?: Array<Record<string, unknown>> } | undefined;
    
    const elementList = snapshot?.element || differential?.element || [];
    
    for (const elem of elementList) {
      const path = elem.path as string;
      if (!path) continue;
      
      elements.push({
        path,
        min: (elem.min as number) || 0,
        max: (elem.max as string) || "*",
        type: (elem.type as Array<{ code: string }>)?.map((t) => t.code),
        mustSupport: elem.mustSupport as boolean,
        isModifier: elem.isModifier as boolean,
        binding: elem.binding as { strength: string; valueSet?: string },
        constraints: (elem.constraint as Array<Record<string, unknown>>)?.map((c) => ({
          key: c.key as string,
          severity: (c.severity as "error" | "warning") || "warning",
          human: c.human as string,
          expression: c.expression as string,
        })),
      });
    }
    
    return elements;
  }

  async deleteProfile(id: string): Promise<boolean> {
    const profile = profileStore.get(id);
    if (!profile) return false;
    
    if (builtInProfiles.some((p) => p.id === id)) {
      throw new Error("Cannot delete built-in profiles");
    }
    
    profileStore.delete(id);
    console.log(`[AIFHIRCustomValidation] Profile deleted: ${id}`);
    return true;
  }

  async validateResource(
    resource: Record<string, unknown>,
    profileId: string
  ): Promise<ValidationReport> {
    const profile = profileStore.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    const resourceType = resource.resourceType as string;
    const resourceId = (resource.id as string) || `temp-${Date.now()}`;

    console.log(`[AIFHIRCustomValidation] Validating ${resourceType}/${resourceId} against ${profile.name}`);

    const issues: ValidationIssue[] = [];
    let validElements = 0;
    const totalElements = profile.elementDefinitions.length;

    for (const element of profile.elementDefinitions) {
      const elementIssues = this.validateElement(resource, element, resourceType);
      if (elementIssues.length === 0) {
        validElements++;
      }
      issues.push(...elementIssues);
    }

    const aiInsights = await this.generateAIInsights(resource, profile, issues);

    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    const informationCount = issues.filter((i) => i.severity === "information").length;

    const overallScore = totalElements > 0 
      ? Math.round((validElements / totalElements) * 100) 
      : 100;

    const report: ValidationReport = {
      id: `report-${Date.now()}`,
      resourceId,
      resourceType,
      profileId,
      profileName: profile.name,
      validatedAt: new Date(),
      isValid: errorCount === 0,
      overallScore,
      summary: this.generateSummary(errorCount, warningCount, resourceType, profile.name),
      issues,
      statistics: {
        totalElements,
        validElements,
        errorCount,
        warningCount,
        informationCount,
      },
      aiInsights,
    };

    validationReportStore.set(report.id, report);
    return report;
  }

  private validateElement(
    resource: Record<string, unknown>,
    element: ElementDefinition,
    resourceType: string
  ): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const pathParts = element.path.split(".");
    
    if (pathParts[0] !== resourceType) return issues;
    
    const fieldPath = pathParts.slice(1);
    const value = this.getNestedValue(resource, fieldPath);

    if (element.min > 0 && (value === undefined || value === null)) {
      issues.push({
        id: `issue-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        severity: "error",
        type: "cardinality",
        path: element.path,
        message: `Required element missing: ${element.path}`,
        details: `This element is required (min: ${element.min}) but was not found in the resource.`,
        element: fieldPath.join("."),
        suggestion: `Add the required ${fieldPath.join(".")} element to the resource.`,
      });
    }

    if (value !== undefined && element.max === "1" && Array.isArray(value) && value.length > 1) {
      issues.push({
        id: `issue-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        severity: "error",
        type: "cardinality",
        path: element.path,
        message: `Cardinality exceeded: ${element.path}`,
        details: `This element allows maximum 1 value but ${value.length} were provided.`,
        element: fieldPath.join("."),
        expectedValue: "1",
        actualValue: String(value.length),
        suggestion: `Reduce to a single value for ${fieldPath.join(".")}.`,
      });
    }

    if (value !== undefined && element.binding?.strength === "required") {
      issues.push({
        id: `issue-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        severity: "information",
        type: "binding",
        path: element.path,
        message: `Value set binding: ${element.path}`,
        details: `This element has a required binding to ${element.binding.valueSet || "a value set"}. Verify the value is valid.`,
        element: fieldPath.join("."),
      });
    }

    if (element.mustSupport && value === undefined) {
      issues.push({
        id: `issue-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        severity: "warning",
        type: "structure",
        path: element.path,
        message: `Must-support element not populated: ${element.path}`,
        details: `This element is marked as must-support. While not required, it should be included when available.`,
        element: fieldPath.join("."),
        suggestion: `Consider populating ${fieldPath.join(".")} if data is available.`,
      });
    }

    return issues;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
    let current: unknown = obj;
    for (const key of path) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[key];
    }
    return current;
  }

  private generateSummary(errorCount: number, warningCount: number, resourceType: string, profileName: string): string {
    if (errorCount === 0 && warningCount === 0) {
      return `${resourceType} resource fully conforms to ${profileName}. No issues detected.`;
    } else if (errorCount === 0) {
      return `${resourceType} resource is valid against ${profileName} with ${warningCount} warning(s) to review.`;
    } else {
      return `${resourceType} resource has ${errorCount} error(s) and ${warningCount} warning(s) against ${profileName}. Corrections required.`;
    }
  }

  private async generateAIInsights(
    resource: Record<string, unknown>,
    profile: StructureDefinitionProfile,
    issues: ValidationIssue[]
  ): Promise<ValidationReport["aiInsights"]> {
    const fallbackInsights = {
      criticalFindings: issues.filter((i) => i.severity === "error").slice(0, 3).map((i) => i.message),
      recommendations: [
        "Review all error-level issues for required elements",
        "Check value set bindings for coded elements",
        "Ensure all must-support elements are populated when data is available",
      ],
      complianceNotes: [
        `Validated against ${profile.name} (${profile.version})`,
        `Profile type: ${profile.type}`,
        profile.baseDefinition ? `Base profile: ${profile.baseDefinition}` : "No base profile specified",
      ],
    };

    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      return fallbackInsights;
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert FHIR validator providing insights on resource validation results.
Analyze the validation issues and provide:
1. Critical findings that need immediate attention
2. Recommendations for fixing issues
3. Compliance notes about the validation

Respond in JSON format:
{
  "criticalFindings": ["finding1", "finding2"],
  "recommendations": ["rec1", "rec2", "rec3"],
  "complianceNotes": ["note1", "note2"]
}

NO-CDS COMPLIANCE: These are informational insights only, not clinical decision support or medical advice.`,
          },
          {
            role: "user",
            content: `Analyze this FHIR validation result:

Resource Type: ${resource.resourceType}
Profile: ${profile.name} (${profile.url})
Profile Version: ${profile.version}

Validation Issues (${issues.length} total):
${issues.slice(0, 10).map((i) => `- [${i.severity.toUpperCase()}] ${i.message}`).join("\n")}

Provide insights for addressing these validation issues.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      return fallbackInsights;
    } catch (error) {
      console.error("[AIFHIRCustomValidation] AI insights generation failed:", error);
      return fallbackInsights;
    }
  }

  async generateValidationSuggestions(
    resource: Record<string, unknown>,
    profileId: string
  ): Promise<{ fixes: Array<{ path: string; currentValue: unknown; suggestedValue: unknown; reason: string }> }> {
    const profile = profileStore.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    const fallbackSuggestions = {
      fixes: [
        {
          path: "identifier",
          currentValue: null,
          suggestedValue: [{ system: "http://example.org/fhir/identifier", value: "example-123" }],
          reason: "Required element for most profiles",
        },
      ],
    };

    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      return fallbackSuggestions;
    }

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert FHIR resource validator. Analyze the resource and suggest fixes to make it conform to the specified profile.

Respond in JSON format:
{
  "fixes": [
    {
      "path": "element.path",
      "currentValue": null,
      "suggestedValue": {"example": "value"},
      "reason": "Why this fix is needed"
    }
  ]
}

Only suggest fixes for actual issues. Provide realistic FHIR-compliant values.`,
          },
          {
            role: "user",
            content: `Analyze this ${resource.resourceType} resource against the ${profile.name} profile:

Resource:
${JSON.stringify(resource, null, 2)}

Profile Requirements:
${profile.elementDefinitions.map((e) => `- ${e.path}: min=${e.min}, max=${e.max}${e.mustSupport ? ", must-support" : ""}`).join("\n")}

Suggest fixes to make this resource conformant.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }
      return fallbackSuggestions;
    } catch (error) {
      console.error("[AIFHIRCustomValidation] AI suggestions generation failed:", error);
      return fallbackSuggestions;
    }
  }

  async getValidationReports(limit = 50): Promise<ValidationReport[]> {
    return Array.from(validationReportStore.values())
      .sort((a, b) => b.validatedAt.getTime() - a.validatedAt.getTime())
      .slice(0, limit);
  }

  async getValidationReport(id: string): Promise<ValidationReport | undefined> {
    return validationReportStore.get(id);
  }

  getProfileCategories(): ProfileCategory[] {
    const profiles = Array.from(profileStore.values());
    const categories: Record<string, ProfileCategory> = {};

    for (const profile of profiles) {
      const categoryId = profile.type.toLowerCase();
      if (!categories[categoryId]) {
        categories[categoryId] = {
          id: categoryId,
          name: `${profile.type} Profiles`,
          description: `Profiles for ${profile.type} resources`,
          profileCount: 0,
        };
      }
      categories[categoryId].profileCount++;
    }

    return Object.values(categories);
  }

  getStatistics(): {
    totalProfiles: number;
    customProfiles: number;
    builtInProfiles: number;
    totalValidations: number;
    validResources: number;
    invalidResources: number;
  } {
    const profiles = Array.from(profileStore.values());
    const reports = Array.from(validationReportStore.values());

    return {
      totalProfiles: profiles.length,
      customProfiles: profiles.filter((p) => p.uploadMethod !== "manual" || !builtInProfiles.some((b) => b.id === p.id)).length,
      builtInProfiles: builtInProfiles.length,
      totalValidations: reports.length,
      validResources: reports.filter((r) => r.isValid).length,
      invalidResources: reports.filter((r) => !r.isValid).length,
    };
  }
}

export const aiFHIRCustomValidationService = new AIFHIRCustomValidationService();
console.log("[AIFHIRCustomValidation] Service initialized with custom profile support");
console.log("[AIFHIRCustomValidation] Built-in profiles:", builtInProfiles.length);
console.log("[AIFHIRCustomValidation] Features: file upload, URL import, AI validation insights");
