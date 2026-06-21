import OpenAI from "openai";
import { randomUUID } from "crypto";
import { logPhiAccess } from "../security/hipaa-audit";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export type ValidationSeverity = "error" | "warning" | "info";
export type ValidationCategory = "required_field" | "data_type" | "timestamp" | "reference" | "code_system" | "consistency" | "completeness" | "format";
export type IssueStatus = "open" | "in_review" | "corrected" | "ignored" | "escalated";

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  resourceType: string;
  category: ValidationCategory;
  severity: ValidationSeverity;
  fieldPath: string;
  condition: string;
  enabled: boolean;
  createdAt: string;
}

export interface ValidationIssue {
  id: string;
  resourceType: string;
  resourceId: string;
  ruleId: string;
  ruleName: string;
  category: ValidationCategory;
  severity: ValidationSeverity;
  fieldPath: string;
  currentValue: any;
  expectedValue?: string;
  message: string;
  status: IssueStatus;
  aiSuggestion?: AISuggestion;
  correctedValue?: any;
  correctedBy?: string;
  correctedAt?: string;
  notes?: string;
  detectedAt: string;
}

export interface AISuggestion {
  id: string;
  issueId: string;
  suggestedValue: any;
  confidence: number;
  rationale: string;
  sources?: string[];
  generatedAt: string;
  disclaimer: string;
}

export interface ValidationScan {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed";
  resourcesScanned: number;
  issuesFound: number;
  issuesByCategory: Record<ValidationCategory, number>;
  issuesBySeverity: Record<ValidationSeverity, number>;
}

export interface FHIRResource {
  resourceType: string;
  id: string;
  [key: string]: any;
}

const NO_CDS_DISCLAIMER = "DISCLAIMER: AI suggestions are for informational purposes only and do NOT constitute clinical decision support, medical advice, or validated data corrections. All corrections must be reviewed and approved by qualified personnel.";

class FHIRDataQualityService {
  private validationRules: Map<string, ValidationRule> = new Map();
  private validationIssues: Map<string, ValidationIssue> = new Map();
  private validationScans: Map<string, ValidationScan> = new Map();
  private aiSuggestions: Map<string, AISuggestion> = new Map();

  private sampleFHIRResources: FHIRResource[] = [
    {
      resourceType: "Patient",
      id: "patient-1",
      identifier: [{ system: "http://hospital.example/mrn", value: "12345" }],
      name: [{ family: "Doe", given: ["John"] }],
      gender: "male",
      birthDate: "1985-03-15",
      address: [{ city: "Boston", state: "MA", postalCode: "02101" }],
      telecom: [{ system: "phone", value: "555-123-4567" }],
      active: true
    },
    {
      resourceType: "Patient",
      id: "patient-2",
      identifier: [{ system: "http://hospital.example/mrn", value: "67890" }],
      name: [{ family: "Smith" }],
      birthDate: "2030-01-01",
      address: [{ city: "Cambridge" }],
      active: true
    },
    {
      resourceType: "Patient",
      id: "patient-3",
      name: [{ family: "Johnson", given: ["Mary"] }],
      gender: "female",
      birthDate: "1970-07-22",
      deceasedDateTime: "1960-01-01",
      active: true
    },
    {
      resourceType: "Condition",
      id: "condition-1",
      subject: { reference: "Patient/patient-1" },
      code: { coding: [{ system: "http://snomed.info/sct", code: "73211009", display: "Diabetes mellitus" }] },
      clinicalStatus: { coding: [{ code: "active" }] },
      onsetDateTime: "2020-01-15",
      recordedDate: "2020-01-15"
    },
    {
      resourceType: "Condition",
      id: "condition-2",
      subject: { reference: "Patient/patient-1" },
      clinicalStatus: { coding: [{ code: "active" }] },
      onsetDateTime: "2025-06-01",
      recordedDate: "2019-01-01"
    },
    {
      resourceType: "Condition",
      id: "condition-3",
      subject: { reference: "Patient/patient-999" },
      code: { coding: [{ system: "http://snomed.info/sct", code: "38341003", display: "Hypertension" }] },
      clinicalStatus: { coding: [{ code: "resolved" }] }
    },
    {
      resourceType: "MedicationRequest",
      id: "med-1",
      subject: { reference: "Patient/patient-1" },
      medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "860975", display: "Metformin 500mg" }] },
      status: "active",
      intent: "order",
      dosageInstruction: [{ text: "Take 1 tablet twice daily" }],
      authoredOn: "2024-01-15"
    },
    {
      resourceType: "MedicationRequest",
      id: "med-2",
      subject: { reference: "Patient/patient-1" },
      status: "active",
      intent: "order",
      authoredOn: "2024-02-20"
    },
    {
      resourceType: "Observation",
      id: "obs-1",
      subject: { reference: "Patient/patient-1" },
      code: { coding: [{ system: "http://loinc.org", code: "4548-4", display: "Hemoglobin A1c" }] },
      status: "final",
      effectiveDateTime: "2024-06-15",
      valueQuantity: { value: 7.2, unit: "%", system: "http://unitsofmeasure.org", code: "%" }
    },
    {
      resourceType: "Observation",
      id: "obs-2",
      subject: { reference: "Patient/patient-1" },
      code: { coding: [{ system: "http://loinc.org", code: "2339-0", display: "Glucose" }] },
      status: "final",
      effectiveDateTime: "2024-06-15",
      valueQuantity: { value: -50, unit: "mg/dL" }
    },
    {
      resourceType: "Observation",
      id: "obs-3",
      subject: { reference: "Patient/patient-2" },
      status: "preliminary",
      effectiveDateTime: "2024-06-16"
    }
  ];

  constructor() {
    this.initializeValidationRules();
    this.runInitialValidation();
    console.log("[FHIRDataQuality] Service initialized");
    console.log(`[FHIRDataQuality] Validation rules: ${this.validationRules.size}`);
    console.log("[FHIRDataQuality] NO-CDS compliance enabled for all AI suggestions");
  }

  private initializeValidationRules(): void {
    const rules: ValidationRule[] = [
      {
        id: "rule-patient-name",
        name: "Patient Name Required",
        description: "Patient resources must have at least one name",
        resourceType: "Patient",
        category: "required_field",
        severity: "error",
        fieldPath: "name",
        condition: "name must be present and non-empty",
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "rule-patient-gender",
        name: "Patient Gender Required",
        description: "Patient resources should have gender specified",
        resourceType: "Patient",
        category: "required_field",
        severity: "warning",
        fieldPath: "gender",
        condition: "gender should be one of: male, female, other, unknown",
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "rule-patient-birthdate-valid",
        name: "Valid Birth Date",
        description: "Patient birth date must be in the past",
        resourceType: "Patient",
        category: "timestamp",
        severity: "error",
        fieldPath: "birthDate",
        condition: "birthDate must be before current date",
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "rule-patient-deceased-after-birth",
        name: "Deceased After Birth",
        description: "Deceased date must be after birth date",
        resourceType: "Patient",
        category: "consistency",
        severity: "error",
        fieldPath: "deceasedDateTime",
        condition: "deceasedDateTime must be after birthDate",
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "rule-patient-given-name",
        name: "Patient Given Name Recommended",
        description: "Patient should have given name for identification",
        resourceType: "Patient",
        category: "completeness",
        severity: "warning",
        fieldPath: "name[0].given",
        condition: "given name should be present",
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "rule-patient-identifier",
        name: "Patient Identifier Required",
        description: "Patient should have at least one identifier (MRN)",
        resourceType: "Patient",
        category: "required_field",
        severity: "warning",
        fieldPath: "identifier",
        condition: "identifier array should be non-empty",
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "rule-condition-code",
        name: "Condition Code Required",
        description: "Condition resources must have a diagnosis code",
        resourceType: "Condition",
        category: "required_field",
        severity: "error",
        fieldPath: "code",
        condition: "code must be present with coding",
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "rule-condition-subject",
        name: "Condition Subject Valid Reference",
        description: "Condition must reference an existing patient",
        resourceType: "Condition",
        category: "reference",
        severity: "error",
        fieldPath: "subject.reference",
        condition: "referenced Patient must exist",
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "rule-condition-onset-recorded",
        name: "Onset Before Recorded Date",
        description: "Condition onset date should be before or equal to recorded date",
        resourceType: "Condition",
        category: "consistency",
        severity: "warning",
        fieldPath: "onsetDateTime",
        condition: "onsetDateTime should be <= recordedDate",
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "rule-medication-code",
        name: "Medication Code Required",
        description: "MedicationRequest must specify the medication",
        resourceType: "MedicationRequest",
        category: "required_field",
        severity: "error",
        fieldPath: "medicationCodeableConcept",
        condition: "medication must be specified",
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "rule-medication-dosage",
        name: "Medication Dosage Recommended",
        description: "MedicationRequest should have dosage instructions",
        resourceType: "MedicationRequest",
        category: "completeness",
        severity: "warning",
        fieldPath: "dosageInstruction",
        condition: "dosageInstruction should be present",
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "rule-observation-code",
        name: "Observation Code Required",
        description: "Observation must have a code identifying the measurement",
        resourceType: "Observation",
        category: "required_field",
        severity: "error",
        fieldPath: "code",
        condition: "code must be present",
        enabled: true,
        createdAt: new Date().toISOString()
      },
      {
        id: "rule-observation-value-positive",
        name: "Observation Value Positive",
        description: "Numeric observation values should be non-negative",
        resourceType: "Observation",
        category: "data_type",
        severity: "error",
        fieldPath: "valueQuantity.value",
        condition: "value should be >= 0 for most measurements",
        enabled: true,
        createdAt: new Date().toISOString()
      }
    ];

    rules.forEach(rule => this.validationRules.set(rule.id, rule));
  }

  private runInitialValidation(): void {
    const scan = this.startValidationScan();
    this.sampleFHIRResources.forEach(resource => {
      this.validateResource(resource, scan.id);
    });
    this.completeValidationScan(scan.id);
  }

  private startValidationScan(): ValidationScan {
    const scan: ValidationScan = {
      id: `scan-${randomUUID().slice(0, 8)}`,
      startedAt: new Date().toISOString(),
      status: "running",
      resourcesScanned: 0,
      issuesFound: 0,
      issuesByCategory: {
        required_field: 0,
        data_type: 0,
        timestamp: 0,
        reference: 0,
        code_system: 0,
        consistency: 0,
        completeness: 0,
        format: 0
      },
      issuesBySeverity: {
        error: 0,
        warning: 0,
        info: 0
      }
    };
    this.validationScans.set(scan.id, scan);
    return scan;
  }

  private completeValidationScan(scanId: string): void {
    const scan = this.validationScans.get(scanId);
    if (scan) {
      scan.status = "completed";
      scan.completedAt = new Date().toISOString();
    }
  }

  private validateResource(resource: FHIRResource, scanId: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const scan = this.validationScans.get(scanId);
    if (scan) scan.resourcesScanned++;

    switch (resource.resourceType) {
      case "Patient":
        issues.push(...this.validatePatient(resource, scanId));
        break;
      case "Condition":
        issues.push(...this.validateCondition(resource, scanId));
        break;
      case "MedicationRequest":
        issues.push(...this.validateMedicationRequest(resource, scanId));
        break;
      case "Observation":
        issues.push(...this.validateObservation(resource, scanId));
        break;
    }

    return issues;
  }

  private createIssue(
    resource: FHIRResource,
    rule: ValidationRule,
    currentValue: any,
    message: string,
    scanId: string,
    expectedValue?: string
  ): ValidationIssue {
    const issue: ValidationIssue = {
      id: `issue-${randomUUID().slice(0, 8)}`,
      resourceType: resource.resourceType,
      resourceId: resource.id,
      ruleId: rule.id,
      ruleName: rule.name,
      category: rule.category,
      severity: rule.severity,
      fieldPath: rule.fieldPath,
      currentValue,
      expectedValue,
      message,
      status: "open",
      detectedAt: new Date().toISOString()
    };

    this.validationIssues.set(issue.id, issue);

    const scan = this.validationScans.get(scanId);
    if (scan) {
      scan.issuesFound++;
      scan.issuesByCategory[rule.category]++;
      scan.issuesBySeverity[rule.severity]++;
    }

    return issue;
  }

  private validatePatient(patient: FHIRResource, scanId: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const nameRule = this.validationRules.get("rule-patient-name");
    if (nameRule?.enabled && (!patient.name || patient.name.length === 0)) {
      issues.push(this.createIssue(patient, nameRule, patient.name, "Patient is missing name", scanId, "At least one name entry"));
    }

    const givenNameRule = this.validationRules.get("rule-patient-given-name");
    if (givenNameRule?.enabled && patient.name?.[0] && (!patient.name[0].given || patient.name[0].given.length === 0)) {
      issues.push(this.createIssue(patient, givenNameRule, patient.name[0], "Patient is missing given name", scanId, "Given name for better identification"));
    }

    const genderRule = this.validationRules.get("rule-patient-gender");
    if (genderRule?.enabled && !patient.gender) {
      issues.push(this.createIssue(patient, genderRule, patient.gender, "Patient gender is not specified", scanId, "male, female, other, or unknown"));
    }

    const identifierRule = this.validationRules.get("rule-patient-identifier");
    if (identifierRule?.enabled && (!patient.identifier || patient.identifier.length === 0)) {
      issues.push(this.createIssue(patient, identifierRule, patient.identifier, "Patient has no identifier (MRN)", scanId, "At least one identifier"));
    }

    const birthDateRule = this.validationRules.get("rule-patient-birthdate-valid");
    if (birthDateRule?.enabled && patient.birthDate) {
      const birthDate = new Date(patient.birthDate);
      if (birthDate > new Date()) {
        issues.push(this.createIssue(patient, birthDateRule, patient.birthDate, "Birth date is in the future", scanId, "Date in the past"));
      }
    }

    const deceasedRule = this.validationRules.get("rule-patient-deceased-after-birth");
    if (deceasedRule?.enabled && patient.birthDate && patient.deceasedDateTime) {
      const birthDate = new Date(patient.birthDate);
      const deceasedDate = new Date(patient.deceasedDateTime);
      if (deceasedDate < birthDate) {
        issues.push(this.createIssue(patient, deceasedRule, patient.deceasedDateTime, "Deceased date is before birth date", scanId, "Date after birth date"));
      }
    }

    return issues;
  }

  private validateCondition(condition: FHIRResource, scanId: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const codeRule = this.validationRules.get("rule-condition-code");
    if (codeRule?.enabled && (!condition.code || !condition.code.coding || condition.code.coding.length === 0)) {
      issues.push(this.createIssue(condition, codeRule, condition.code, "Condition is missing diagnosis code", scanId, "ICD-10 or SNOMED CT code"));
    }

    const subjectRule = this.validationRules.get("rule-condition-subject");
    if (subjectRule?.enabled && condition.subject?.reference) {
      const patientId = condition.subject.reference.replace("Patient/", "");
      const patientExists = this.sampleFHIRResources.some(r => r.resourceType === "Patient" && r.id === patientId);
      if (!patientExists) {
        issues.push(this.createIssue(condition, subjectRule, condition.subject.reference, "Referenced patient does not exist", scanId, "Valid patient reference"));
      }
    }

    const onsetRecordedRule = this.validationRules.get("rule-condition-onset-recorded");
    if (onsetRecordedRule?.enabled && condition.onsetDateTime && condition.recordedDate) {
      const onsetDate = new Date(condition.onsetDateTime);
      const recordedDate = new Date(condition.recordedDate);
      if (onsetDate > recordedDate) {
        issues.push(this.createIssue(condition, onsetRecordedRule, { onset: condition.onsetDateTime, recorded: condition.recordedDate }, "Onset date is after recorded date", scanId, "Onset <= Recorded"));
      }
    }

    return issues;
  }

  private validateMedicationRequest(medication: FHIRResource, scanId: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const codeRule = this.validationRules.get("rule-medication-code");
    if (codeRule?.enabled && !medication.medicationCodeableConcept && !medication.medicationReference) {
      issues.push(this.createIssue(medication, codeRule, null, "Medication is not specified", scanId, "RxNorm or NDC code"));
    }

    const dosageRule = this.validationRules.get("rule-medication-dosage");
    if (dosageRule?.enabled && (!medication.dosageInstruction || medication.dosageInstruction.length === 0)) {
      issues.push(this.createIssue(medication, dosageRule, medication.dosageInstruction, "Dosage instructions are missing", scanId, "Dosage text or structured instructions"));
    }

    return issues;
  }

  private validateObservation(observation: FHIRResource, scanId: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const codeRule = this.validationRules.get("rule-observation-code");
    if (codeRule?.enabled && (!observation.code || !observation.code.coding || observation.code.coding.length === 0)) {
      issues.push(this.createIssue(observation, codeRule, observation.code, "Observation is missing measurement code", scanId, "LOINC code"));
    }

    const valueRule = this.validationRules.get("rule-observation-value-positive");
    if (valueRule?.enabled && observation.valueQuantity?.value !== undefined && observation.valueQuantity.value < 0) {
      issues.push(this.createIssue(observation, valueRule, observation.valueQuantity.value, "Observation has negative value", scanId, "Non-negative value"));
    }

    return issues;
  }

  async generateAISuggestion(issueId: string, userId: string): Promise<AISuggestion | null> {
    const issue = this.validationIssues.get(issueId);
    if (!issue) return null;

    logPhiAccess({
      action: "ai_suggestion_generate",
      resourceType: issue.resourceType,
      resourceId: issue.resourceId,
      userId,
      phiFields: ["validation_issue", "current_value"],
      accessReason: "AI data correction suggestion"
    });

    const resource = this.sampleFHIRResources.find(r => r.id === issue.resourceId);

    if (!openai) {
      console.log("[FHIRDataQuality] OpenAI not configured, using fallback suggestions");
      return this.generateFallbackSuggestion(issue, resource);
    }

    const prompt = `You are a FHIR R4 data quality expert. Analyze this validation issue and provide a correction suggestion.

IMPORTANT: This is for data quality purposes only, NOT clinical decision support.

Resource Type: ${issue.resourceType}
Resource ID: ${issue.resourceId}
Issue: ${issue.message}
Field Path: ${issue.fieldPath}
Current Value: ${JSON.stringify(issue.currentValue)}
Expected: ${issue.expectedValue || "Valid value per FHIR R4 spec"}
Category: ${issue.category}

Full Resource Context:
${JSON.stringify(resource, null, 2)}

Provide a JSON response with:
{
  "suggestedValue": <the corrected value in appropriate format>,
  "confidence": <0-1 confidence score>,
  "rationale": "<brief explanation of the correction>",
  "sources": ["<any relevant FHIR specs or guidelines referenced>"]
}

Return ONLY valid JSON, no markdown.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 500
      });

      const content = response.choices[0]?.message?.content?.trim() || "{}";
      const cleanContent = content.replace(/```json\n?|```\n?/g, "").trim();
      const parsed = JSON.parse(cleanContent);

      const suggestion: AISuggestion = {
        id: `suggestion-${randomUUID().slice(0, 8)}`,
        issueId,
        suggestedValue: parsed.suggestedValue,
        confidence: parsed.confidence || 0.7,
        rationale: parsed.rationale || "AI-generated suggestion based on FHIR R4 specifications",
        sources: parsed.sources || ["FHIR R4 Specification"],
        generatedAt: new Date().toISOString(),
        disclaimer: NO_CDS_DISCLAIMER
      };

      this.aiSuggestions.set(suggestion.id, suggestion);
      issue.aiSuggestion = suggestion;

      return suggestion;
    } catch (error) {
      console.error("[FHIRDataQuality] AI suggestion error:", error);
      return this.generateFallbackSuggestion(issue, resource);
    }
  }

  private generateFallbackSuggestion(issue: ValidationIssue, resource?: FHIRResource): AISuggestion {
    let suggestedValue: any;
    let rationale: string;
    let confidence = 0.6;

    switch (issue.category) {
      case "required_field":
        if (issue.fieldPath === "name") {
          suggestedValue = [{ family: "Unknown", given: ["Unknown"] }];
          rationale = "Default placeholder name for missing patient name";
        } else if (issue.fieldPath === "gender") {
          suggestedValue = "unknown";
          rationale = "FHIR allows 'unknown' when gender is not specified";
        } else if (issue.fieldPath === "code") {
          suggestedValue = { coding: [{ system: "http://terminology.hl7.org/CodeSystem/data-absent-reason", code: "unknown", display: "Unknown" }] };
          rationale = "Data absent reason code for missing clinical code";
        } else if (issue.fieldPath === "identifier") {
          suggestedValue = [{ system: "http://hospital.example/temp-id", value: `TEMP-${randomUUID().slice(0, 8)}` }];
          rationale = "Temporary identifier pending proper MRN assignment";
          confidence = 0.5;
        } else {
          suggestedValue = null;
          rationale = "Unable to suggest a specific value; manual review required";
          confidence = 0.3;
        }
        break;

      case "timestamp":
        if (issue.fieldPath === "birthDate") {
          suggestedValue = "1900-01-01";
          rationale = "Placeholder date when actual birth date is unknown or invalid";
          confidence = 0.4;
        } else {
          suggestedValue = new Date().toISOString().split("T")[0];
          rationale = "Current date as placeholder; verify with source records";
          confidence = 0.4;
        }
        break;

      case "consistency":
        if (issue.fieldPath === "deceasedDateTime" && resource?.birthDate) {
          const birthYear = new Date(resource.birthDate).getFullYear();
          suggestedValue = `${birthYear + 80}-01-01`;
          rationale = "Placeholder deceased date; verify against actual records";
          confidence = 0.3;
        } else if (issue.fieldPath === "onsetDateTime") {
          suggestedValue = resource?.recordedDate || new Date().toISOString();
          rationale = "Set onset to match recorded date; may need adjustment";
          confidence = 0.5;
        } else {
          suggestedValue = null;
          rationale = "Consistency issue requires manual review of related data";
          confidence = 0.2;
        }
        break;

      case "data_type":
        if (issue.fieldPath.includes("value") && typeof issue.currentValue === "number") {
          suggestedValue = Math.abs(issue.currentValue);
          rationale = "Converted negative value to positive; verify measurement";
          confidence = 0.6;
        } else {
          suggestedValue = null;
          rationale = "Data type issue requires manual correction";
          confidence = 0.3;
        }
        break;

      case "reference":
        suggestedValue = null;
        rationale = "Invalid reference requires manual resolution - patient may need to be created or reference corrected";
        confidence = 0.2;
        break;

      case "completeness":
        if (issue.fieldPath.includes("given")) {
          suggestedValue = ["Unknown"];
          rationale = "Placeholder given name; update when actual name is available";
          confidence = 0.5;
        } else if (issue.fieldPath.includes("dosage")) {
          suggestedValue = [{ text: "See prescriber for dosage instructions" }];
          rationale = "Placeholder dosage instruction; requires clinical input";
          confidence = 0.4;
        } else {
          suggestedValue = null;
          rationale = "Incomplete data requires source verification";
          confidence = 0.3;
        }
        break;

      default:
        suggestedValue = null;
        rationale = "Manual review required for this issue type";
        confidence = 0.2;
    }

    const suggestion: AISuggestion = {
      id: `suggestion-${randomUUID().slice(0, 8)}`,
      issueId: issue.id,
      suggestedValue,
      confidence,
      rationale,
      sources: ["FHIR R4 Specification", "HL7 Data Quality Guidelines"],
      generatedAt: new Date().toISOString(),
      disclaimer: NO_CDS_DISCLAIMER
    };

    this.aiSuggestions.set(suggestion.id, suggestion);
    issue.aiSuggestion = suggestion;

    return suggestion;
  }

  getMetadata() {
    return {
      name: "FHIR Data Quality & Validation Service",
      version: "1.0.0",
      description: "Automated validation and quality checks for FHIR R4 resources with AI-driven correction suggestions",
      features: [
        "Required field validation",
        "Data type validation",
        "Timestamp consistency checks",
        "Cross-resource reference validation",
        "AI-powered correction suggestions",
        "Manual review workflow",
        "HIPAA-compliant audit logging"
      ],
      supportedResources: ["Patient", "Condition", "MedicationRequest", "Observation"],
      rulesCount: this.validationRules.size,
      activeIssues: Array.from(this.validationIssues.values()).filter(i => i.status === "open").length,
      disclaimer: NO_CDS_DISCLAIMER
    };
  }

  getDashboard(userId: string) {
    logPhiAccess({
      action: "validation_dashboard_view",
      resourceType: "ValidationDashboard",
      userId,
      phiFields: ["issue_summary"],
      accessReason: "View validation dashboard"
    });

    const issues = Array.from(this.validationIssues.values());
    const scans = Array.from(this.validationScans.values());
    const latestScan = scans[scans.length - 1];

    const issuesByStatus = {
      open: issues.filter(i => i.status === "open").length,
      in_review: issues.filter(i => i.status === "in_review").length,
      corrected: issues.filter(i => i.status === "corrected").length,
      ignored: issues.filter(i => i.status === "ignored").length,
      escalated: issues.filter(i => i.status === "escalated").length
    };

    const issuesBySeverity = {
      error: issues.filter(i => i.severity === "error").length,
      warning: issues.filter(i => i.severity === "warning").length,
      info: issues.filter(i => i.severity === "info").length
    };

    const issuesByCategory = issues.reduce((acc, issue) => {
      acc[issue.category] = (acc[issue.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const issuesByResource = issues.reduce((acc, issue) => {
      acc[issue.resourceType] = (acc[issue.resourceType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      summary: {
        totalIssues: issues.length,
        openIssues: issuesByStatus.open,
        criticalIssues: issues.filter(i => i.severity === "error" && i.status === "open").length,
        aiSuggestionsAvailable: issues.filter(i => i.aiSuggestion).length,
        resourcesWithIssues: new Set(issues.map(i => i.resourceId)).size
      },
      issuesByStatus,
      issuesBySeverity,
      issuesByCategory,
      issuesByResource,
      latestScan,
      recentIssues: issues.slice(-10).reverse(),
      rules: Array.from(this.validationRules.values()),
      disclaimer: NO_CDS_DISCLAIMER
    };
  }

  getIssues(filters: { status?: IssueStatus; severity?: ValidationSeverity; resourceType?: string; category?: ValidationCategory }, userId: string) {
    logPhiAccess({
      action: "validation_issues_list",
      resourceType: "ValidationIssue",
      userId,
      phiFields: ["issues"],
      accessReason: "List validation issues"
    });

    let issues = Array.from(this.validationIssues.values());

    if (filters.status) {
      issues = issues.filter(i => i.status === filters.status);
    }
    if (filters.severity) {
      issues = issues.filter(i => i.severity === filters.severity);
    }
    if (filters.resourceType) {
      issues = issues.filter(i => i.resourceType === filters.resourceType);
    }
    if (filters.category) {
      issues = issues.filter(i => i.category === filters.category);
    }

    return {
      issues,
      total: issues.length,
      disclaimer: NO_CDS_DISCLAIMER
    };
  }

  getIssue(issueId: string, userId: string) {
    const issue = this.validationIssues.get(issueId);
    if (!issue) return null;

    logPhiAccess({
      action: "validation_issue_view",
      resourceType: issue.resourceType,
      resourceId: issue.resourceId,
      userId,
      phiFields: ["issue_detail", "current_value"],
      accessReason: "View validation issue detail"
    });

    const resource = this.sampleFHIRResources.find(r => r.id === issue.resourceId);
    const rule = this.validationRules.get(issue.ruleId);

    return {
      issue,
      resource,
      rule,
      disclaimer: NO_CDS_DISCLAIMER
    };
  }

  updateIssueStatus(issueId: string, status: IssueStatus, userId: string, notes?: string): ValidationIssue | null {
    const issue = this.validationIssues.get(issueId);
    if (!issue) return null;

    logPhiAccess({
      action: "validation_issue_status_update",
      resourceType: issue.resourceType,
      resourceId: issue.resourceId,
      userId,
      phiFields: ["issue_status"],
      accessReason: `Update issue status to ${status}`
    });

    issue.status = status;
    if (notes) issue.notes = notes;

    return issue;
  }

  applyCorrection(issueId: string, correctedValue: any, userId: string): ValidationIssue | null {
    const issue = this.validationIssues.get(issueId);
    if (!issue) return null;

    logPhiAccess({
      action: "validation_correction_apply",
      resourceType: issue.resourceType,
      resourceId: issue.resourceId,
      userId,
      phiFields: ["corrected_value"],
      accessReason: "Apply data correction"
    });

    const resourceIndex = this.sampleFHIRResources.findIndex(r => r.id === issue.resourceId);
    if (resourceIndex !== -1) {
      const pathParts = issue.fieldPath.replace(/\[(\d+)\]/g, ".$1").split(".");
      let current: any = this.sampleFHIRResources[resourceIndex];
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (current[pathParts[i]] === undefined) {
          current[pathParts[i]] = {};
        }
        current = current[pathParts[i]];
      }
      current[pathParts[pathParts.length - 1]] = correctedValue;
    }

    issue.status = "corrected";
    issue.correctedValue = correctedValue;
    issue.correctedBy = userId;
    issue.correctedAt = new Date().toISOString();

    return issue;
  }

  getRules() {
    return {
      rules: Array.from(this.validationRules.values()),
      total: this.validationRules.size
    };
  }

  toggleRule(ruleId: string, enabled: boolean, userId: string): ValidationRule | null {
    const rule = this.validationRules.get(ruleId);
    if (!rule) return null;

    logPhiAccess({
      action: "validation_rule_toggle",
      resourceType: "ValidationRule",
      resourceId: ruleId,
      userId,
      phiFields: [],
      accessReason: `${enabled ? "Enable" : "Disable"} validation rule`
    });

    rule.enabled = enabled;
    return rule;
  }

  runValidationScan(userId: string): ValidationScan {
    logPhiAccess({
      action: "validation_scan_run",
      resourceType: "ValidationScan",
      userId,
      phiFields: ["all_resources"],
      accessReason: "Run full validation scan"
    });

    this.validationIssues.clear();

    const scan = this.startValidationScan();
    this.sampleFHIRResources.forEach(resource => {
      this.validateResource(resource, scan.id);
    });
    this.completeValidationScan(scan.id);

    return scan;
  }

  getScans() {
    return Array.from(this.validationScans.values()).reverse();
  }
}

export const fhirDataQualityService = new FHIRDataQualityService();
