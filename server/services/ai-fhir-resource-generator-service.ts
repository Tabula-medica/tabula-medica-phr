// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import OpenAI from "openai";

const openai = process.env.AI_INTEGRATIONS_OPENAI_API_KEY 
  ? new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    })
  : null;

interface GeneratedResource {
  id: string;
  resourceType: string;
  resource: any;
  originalPrompt: string;
  validation: ValidationResult;
  suggestions: string[];
  generatedAt: Date;
  status: 'draft' | 'validated' | 'committed';
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  profile: string;
  score: number;
}

interface ValidationError {
  path: string;
  message: string;
  code: string;
}

interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}

interface GenerationTemplate {
  id: string;
  name: string;
  resourceType: string;
  description: string;
  examplePrompts: string[];
  requiredFields: string[];
  optionalFields: string[];
  usageCount: number;
}

interface GenerationSession {
  id: string;
  name: string;
  resources: GeneratedResource[];
  status: 'active' | 'completed';
  createdAt: Date;
}

const generatedResources: Map<string, GeneratedResource> = new Map();
const generationSessions: Map<string, GenerationSession> = new Map();
const templates: Map<string, GenerationTemplate> = new Map();

const SUPPORTED_RESOURCE_TYPES = [
  'Patient', 'Practitioner', 'Organization', 'Observation', 'Condition',
  'MedicationRequest', 'Procedure', 'Encounter', 'DiagnosticReport',
  'Immunization', 'AllergyIntolerance', 'CarePlan', 'Goal', 'Appointment',
  'DocumentReference', 'ServiceRequest', 'Specimen', 'Coverage'
];

function initializeSampleData() {
  const sampleTemplates: GenerationTemplate[] = [
    {
      id: "template-patient",
      name: "Patient Resource",
      resourceType: "Patient",
      description: "Create a FHIR R4 Patient resource from natural language description",
      examplePrompts: [
        "Create a patient named John Smith, male, born on 1985-03-15, living at 123 Main St, Boston, MA",
        "New patient: Maria Garcia, female, DOB 1992-07-22, phone 555-0123",
        "Register patient James Wilson, 45 years old male with email jwilson@email.com"
      ],
      requiredFields: ["name", "birthDate", "gender"],
      optionalFields: ["address", "telecom", "identifier", "maritalStatus", "contact"],
      usageCount: 847
    },
    {
      id: "template-observation",
      name: "Observation Resource",
      resourceType: "Observation",
      description: "Create a FHIR R4 Observation resource for clinical measurements",
      examplePrompts: [
        "Blood pressure reading: systolic 120, diastolic 80 for patient-001",
        "HbA1c result of 6.5% for diabetic patient",
        "Body temperature 98.6F taken today"
      ],
      requiredFields: ["status", "code", "subject"],
      optionalFields: ["value[x]", "effectiveDateTime", "interpretation", "referenceRange"],
      usageCount: 1256
    },
    {
      id: "template-condition",
      name: "Condition Resource",
      resourceType: "Condition",
      description: "Create a FHIR R4 Condition resource for diagnoses",
      examplePrompts: [
        "Diagnosis: Type 2 Diabetes Mellitus, confirmed, onset 2020",
        "New condition: Essential Hypertension, active since last month",
        "Add allergy condition: Penicillin allergy, severe reaction"
      ],
      requiredFields: ["clinicalStatus", "code", "subject"],
      optionalFields: ["verificationStatus", "category", "severity", "onsetDateTime", "note"],
      usageCount: 923
    },
    {
      id: "template-medication",
      name: "MedicationRequest Resource",
      resourceType: "MedicationRequest",
      description: "Create a FHIR R4 MedicationRequest for prescriptions",
      examplePrompts: [
        "Prescribe Metformin 500mg twice daily for 90 days",
        "New prescription: Lisinopril 10mg once daily",
        "Order Atorvastatin 20mg at bedtime, 30 day supply"
      ],
      requiredFields: ["status", "intent", "medicationCodeableConcept", "subject"],
      optionalFields: ["dosageInstruction", "dispenseRequest", "substitution", "requester"],
      usageCount: 678
    }
  ];

  sampleTemplates.forEach(t => templates.set(t.id, t));

  const sampleResources: GeneratedResource[] = [
    {
      id: "gen-1",
      resourceType: "Patient",
      resource: {
        resourceType: "Patient",
        id: "patient-generated-001",
        name: [{ family: "Johnson", given: ["Emily", "Rose"] }],
        gender: "female",
        birthDate: "1988-11-20",
        address: [{ line: ["456 Oak Avenue"], city: "Seattle", state: "WA", postalCode: "98101" }],
        telecom: [{ system: "phone", value: "555-0199" }]
      },
      originalPrompt: "Create patient Emily Rose Johnson, female, born November 20 1988, Seattle WA address",
      validation: {
        isValid: true,
        errors: [],
        warnings: [{ path: "identifier", message: "No identifier provided", suggestion: "Add MRN or SSN identifier" }],
        profile: "http://hl7.org/fhir/R4/StructureDefinition/Patient",
        score: 0.92
      },
      suggestions: ["Consider adding patient identifier (MRN)", "Emergency contact information recommended"],
      generatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      status: 'validated'
    },
    {
      id: "gen-2",
      resourceType: "Observation",
      resource: {
        resourceType: "Observation",
        id: "obs-generated-001",
        status: "final",
        code: {
          coding: [{ system: "http://loinc.org", code: "85354-9", display: "Blood pressure panel" }]
        },
        subject: { reference: "Patient/patient-001" },
        effectiveDateTime: new Date().toISOString(),
        component: [
          { code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic BP" }] }, valueQuantity: { value: 118, unit: "mmHg" } },
          { code: { coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic BP" }] }, valueQuantity: { value: 76, unit: "mmHg" } }
        ]
      },
      originalPrompt: "Blood pressure 118/76 for patient-001",
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
        profile: "http://hl7.org/fhir/R4/StructureDefinition/bp",
        score: 0.98
      },
      suggestions: ["Consider adding performer reference", "Add interpretation code if abnormal"],
      generatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      status: 'committed'
    }
  ];

  sampleResources.forEach(r => generatedResources.set(r.id, r));
}

initializeSampleData();

export class AIFHIRResourceGeneratorService {
  async generateFromNaturalLanguage(prompt: string, resourceType?: string): Promise<GeneratedResource> {
    console.log("[HIPAA-AUDIT] Generating FHIR resource from natural language");

    let resource: any;
    let detectedType = resourceType;
    let suggestions: string[] = [];
    let validation: ValidationResult;

    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5.1",
          messages: [
            {
              role: "system",
              content: `You are a FHIR R4 expert. Generate valid FHIR R4 resources from natural language descriptions. Always return properly structured, valid FHIR JSON. Include appropriate coding systems (LOINC, SNOMED CT, RxNorm, ICD-10) where applicable.

If no resource type is specified, detect the most appropriate type from the description.

Return JSON format: { "resourceType": "...", "resource": {...}, "suggestions": [...] }`
            },
            {
              role: "user",
              content: resourceType 
                ? `Generate a FHIR R4 ${resourceType} resource from: "${prompt}"`
                : `Generate an appropriate FHIR R4 resource from: "${prompt}"`
            }
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 4096
        });

        const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
        resource = parsed.resource || {};
        detectedType = parsed.resourceType || resource.resourceType || resourceType || "Unknown";
        suggestions = parsed.suggestions || [];

        resource.resourceType = detectedType;
        resource.id = resource.id || `${(detectedType || "unknown").toLowerCase()}-gen-${Date.now()}`;
        resource.meta = {
          ...resource.meta,
          profile: [`http://hl7.org/fhir/R4/StructureDefinition/${detectedType}`],
          lastUpdated: new Date().toISOString()
        };

        validation = this.validateResource(resource);
      } catch (error) {
        console.error("OpenAI generation error:", error);
        resource = this.createFallbackResource(prompt, resourceType);
        detectedType = resourceType || "Unknown";
        suggestions = ["AI generation failed - created template resource"];
        validation = { isValid: false, errors: [{ path: "", message: "AI generation unavailable", code: "AI_UNAVAILABLE" }], warnings: [], profile: "", score: 0 };
      }
    } else {
      resource = this.createFallbackResource(prompt, resourceType);
      detectedType = resourceType || "Unknown";
      suggestions = ["AI unavailable - template resource created. Please fill in required fields."];
      validation = { isValid: false, errors: [], warnings: [{ path: "", message: "AI generation unavailable" }], profile: "", score: 0.5 };
    }

    const generated: GeneratedResource = {
      id: `gen-${Date.now()}`,
      resourceType: detectedType!,
      resource,
      originalPrompt: prompt,
      validation,
      suggestions,
      generatedAt: new Date(),
      status: 'draft'
    };

    generatedResources.set(generated.id, generated);
    return generated;
  }

  async generateBatch(prompts: { prompt: string; resourceType?: string }[]): Promise<GeneratedResource[]> {
    console.log("[HIPAA-AUDIT] Batch generating FHIR resources, count:", prompts.length);
    
    const results: GeneratedResource[] = [];
    for (const item of prompts) {
      const result = await this.generateFromNaturalLanguage(item.prompt, item.resourceType);
      results.push(result);
    }
    return results;
  }

  async refineResource(resourceId: string, feedback: string): Promise<GeneratedResource> {
    console.log("[HIPAA-AUDIT] Refining generated resource:", resourceId);
    
    const existing = generatedResources.get(resourceId);
    if (!existing) {
      throw new Error("Resource not found");
    }

    if (openai) {
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-5.1",
          messages: [
            {
              role: "system",
              content: "You are a FHIR R4 expert. Refine the given FHIR resource based on user feedback. Maintain valid FHIR structure."
            },
            {
              role: "user",
              content: `Refine this FHIR resource:\n${JSON.stringify(existing.resource, null, 2)}\n\nFeedback: ${feedback}\n\nReturn JSON: { "resource": {...}, "changes": [...] }`
            }
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 4096
        });

        const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
        existing.resource = parsed.resource || existing.resource;
        existing.resource.meta.lastUpdated = new Date().toISOString();
        existing.validation = this.validateResource(existing.resource);
        existing.suggestions = parsed.changes || [];
        existing.status = 'draft';
      } catch (error) {
        console.error("OpenAI refinement error:", error);
        existing.suggestions = ["AI refinement failed - please edit manually"];
      }
    }

    return existing;
  }

  async validateAndCommit(resourceId: string): Promise<{ success: boolean; resource: GeneratedResource; message: string }> {
    console.log("[HIPAA-AUDIT] Validating and committing resource:", resourceId);
    
    const resource = generatedResources.get(resourceId);
    if (!resource) {
      return { success: false, resource: null as any, message: "Resource not found" };
    }

    const validation = this.validateResource(resource.resource);
    resource.validation = validation;

    if (validation.isValid) {
      resource.status = 'committed';
      return { success: true, resource, message: "Resource validated and committed successfully" };
    }

    return { success: false, resource, message: `Validation failed with ${validation.errors.length} errors` };
  }

  async getTemplates(): Promise<GenerationTemplate[]> {
    return Array.from(templates.values());
  }

  async getTemplate(resourceType: string): Promise<GenerationTemplate | null> {
    return Array.from(templates.values()).find(t => t.resourceType === resourceType) || null;
  }

  async getGeneratedResources(): Promise<GeneratedResource[]> {
    return Array.from(generatedResources.values())
      .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
  }

  async getGeneratedResource(id: string): Promise<GeneratedResource | null> {
    return generatedResources.get(id) || null;
  }

  async deleteGeneratedResource(id: string): Promise<boolean> {
    console.log("[HIPAA-AUDIT] Deleting generated resource:", id);
    return generatedResources.delete(id);
  }

  async getSupportedResourceTypes(): Promise<string[]> {
    return SUPPORTED_RESOURCE_TYPES;
  }

  async getStats(): Promise<{
    totalGenerated: number;
    byResourceType: Record<string, number>;
    byStatus: Record<string, number>;
    avgValidationScore: number;
    popularTemplates: GenerationTemplate[];
  }> {
    const resources = Array.from(generatedResources.values());
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    resources.forEach(r => {
      byType[r.resourceType] = (byType[r.resourceType] || 0) + 1;
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });

    return {
      totalGenerated: resources.length,
      byResourceType: byType,
      byStatus: byStatus,
      avgValidationScore: resources.length > 0 
        ? resources.reduce((sum, r) => sum + r.validation.score, 0) / resources.length 
        : 0,
      popularTemplates: Array.from(templates.values())
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, 5)
    };
  }

  private validateResource(resource: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!resource.resourceType) {
      errors.push({ path: "resourceType", message: "Missing resourceType", code: "REQUIRED_FIELD" });
    }

    if (!SUPPORTED_RESOURCE_TYPES.includes(resource.resourceType)) {
      warnings.push({ path: "resourceType", message: `Unknown resource type: ${resource.resourceType}` });
    }

    switch (resource.resourceType) {
      case 'Patient':
        if (!resource.name || resource.name.length === 0) {
          errors.push({ path: "name", message: "Patient name is required", code: "REQUIRED_FIELD" });
        }
        if (!resource.gender) {
          warnings.push({ path: "gender", message: "Gender not specified", suggestion: "Add gender for complete demographics" });
        }
        if (!resource.birthDate) {
          warnings.push({ path: "birthDate", message: "Birth date not specified", suggestion: "Add birthDate" });
        }
        break;

      case 'Observation':
        if (!resource.status) {
          errors.push({ path: "status", message: "Observation status is required", code: "REQUIRED_FIELD" });
        }
        if (!resource.code) {
          errors.push({ path: "code", message: "Observation code is required", code: "REQUIRED_FIELD" });
        }
        if (!resource.subject) {
          errors.push({ path: "subject", message: "Subject reference is required", code: "REQUIRED_FIELD" });
        }
        break;

      case 'Condition':
        if (!resource.clinicalStatus) {
          errors.push({ path: "clinicalStatus", message: "Clinical status is required", code: "REQUIRED_FIELD" });
        }
        if (!resource.code) {
          errors.push({ path: "code", message: "Condition code is required", code: "REQUIRED_FIELD" });
        }
        break;

      case 'MedicationRequest':
        if (!resource.status) {
          errors.push({ path: "status", message: "Status is required", code: "REQUIRED_FIELD" });
        }
        if (!resource.intent) {
          errors.push({ path: "intent", message: "Intent is required", code: "REQUIRED_FIELD" });
        }
        if (!resource.medicationCodeableConcept && !resource.medicationReference) {
          errors.push({ path: "medication[x]", message: "Medication is required", code: "REQUIRED_FIELD" });
        }
        break;
    }

    const score = Math.max(0, 1 - (errors.length * 0.2) - (warnings.length * 0.05));

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      profile: `http://hl7.org/fhir/R4/StructureDefinition/${resource.resourceType || 'Unknown'}`,
      score
    };
  }

  private createFallbackResource(prompt: string, resourceType?: string): any {
    const type = resourceType || "Patient";
    
    const baseResource: any = {
      resourceType: type,
      id: `${type.toLowerCase()}-template-${Date.now()}`,
      meta: {
        profile: [`http://hl7.org/fhir/R4/StructureDefinition/${type}`],
        lastUpdated: new Date().toISOString()
      }
    };

    switch (type) {
      case 'Patient':
        return { ...baseResource, name: [{ family: "Unknown", given: ["Template"] }], gender: "unknown" };
      case 'Observation':
        return { ...baseResource, status: "preliminary", code: { text: prompt } };
      case 'Condition':
        return { ...baseResource, clinicalStatus: { coding: [{ code: "active" }] }, code: { text: prompt } };
      default:
        return baseResource;
    }
  }
}

export const aiFHIRResourceGeneratorService = new AIFHIRResourceGeneratorService();
