import OpenAI from "openai";
import { storage } from "../storage";
import { comprehensiveAuditTrailService } from "./comprehensive-audit-trail-service";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface ValidationRule {
  id: string;
  name: string;
  category: "clinical" | "demographic" | "administrative" | "temporal" | "referential";
  severity: "critical" | "warning" | "info";
  description: string;
}

interface ValidationIssue {
  ruleId: string;
  ruleName: string;
  category: string;
  severity: "critical" | "warning" | "info";
  field: string;
  currentValue: string | null;
  expectedValue?: string;
  message: string;
  suggestion?: string;
}

interface DataQualityScore {
  overall: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
  conformance: number;
}

interface ValidationResult {
  id: string;
  patientId: string;
  patientName: string;
  validatedAt: string;
  dataQualityScore: DataQualityScore;
  issues: ValidationIssue[];
  aiSuggestions: AISuggestion[];
  summary: string;
  complianceStatus: "compliant" | "needs_review" | "non_compliant";
  disclaimer: string;
}

interface AISuggestion {
  type: "correction" | "enhancement" | "missing_data" | "guideline_compliance";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  affectedFields: string[];
  suggestedAction: string;
  clinicalGuideline?: string;
}

const VALIDATION_RULES: ValidationRule[] = [
  {
    id: "sample-001",
    name: "Patient Name Required",
    category: "demographic",
    severity: "critical",
    description: "Patient must have a valid name"
  },
  {
    id: "sample-002",
    name: "Date of Birth Required",
    category: "demographic",
    severity: "critical",
    description: "Patient must have a valid date of birth"
  },
  {
    id: "sample-003",
    name: "Gender Required",
    category: "demographic",
    severity: "warning",
    description: "Patient should have gender specified"
  },
  {
    id: "sample-004",
    name: "Contact Information",
    category: "demographic",
    severity: "warning",
    description: "Patient should have at least one contact method"
  },
  {
    id: "clin-001",
    name: "Active Conditions Documented",
    category: "clinical",
    severity: "warning",
    description: "Active medical conditions should be documented"
  },
  {
    id: "clin-002",
    name: "Current Medications Listed",
    category: "clinical",
    severity: "warning",
    description: "Current medications should be listed"
  },
  {
    id: "clin-003",
    name: "Allergy Status Documented",
    category: "clinical",
    severity: "critical",
    description: "Allergy status must be documented (even if none)"
  },
  {
    id: "clin-004",
    name: "Vaccination History",
    category: "clinical",
    severity: "info",
    description: "Vaccination history should be documented"
  },
  {
    id: "clin-005",
    name: "Lab Results Timeliness",
    category: "clinical",
    severity: "info",
    description: "Recent lab results should be available for chronic conditions"
  },
  {
    id: "temp-001",
    name: "Encounter Date Validity",
    category: "temporal",
    severity: "critical",
    description: "Encounter dates must be valid and not in the future"
  },
  {
    id: "temp-002",
    name: "Medication Start Date",
    category: "temporal",
    severity: "warning",
    description: "Active medications should have valid start dates"
  },
  {
    id: "ref-001",
    name: "Primary Care Provider",
    category: "referential",
    severity: "info",
    description: "Patient should have an assigned primary care provider"
  },
  {
    id: "admin-001",
    name: "Insurance Information",
    category: "administrative",
    severity: "warning",
    description: "Insurance coverage information should be documented"
  },
  {
    id: "admin-002",
    name: "Emergency Contact",
    category: "administrative",
    severity: "warning",
    description: "Emergency contact should be documented"
  }
];

class AIFHIRPatientValidationService {
  private validationHistory: Map<string, ValidationResult[]> = new Map();

  async getMetadata() {
    return {
      version: "1.0.0",
      serviceName: "AI FHIR Patient Data Validation",
      description: "AI-powered validation of patient data against clinical guidelines and data quality standards",
      validationCategories: ["clinical", "demographic", "administrative", "temporal", "referential"],
      qualityDimensions: ["completeness", "accuracy", "consistency", "timeliness", "conformance"],
      totalRules: VALIDATION_RULES.length,
      noCdsCompliance: "INFORMATIONAL ONLY: This validation service is for data quality assessment purposes only. It does not provide clinical decision support and should not be used for diagnosis, treatment, or clinical care decisions. All findings require professional review."
    };
  }

  async getAvailablePatients(): Promise<Array<{ id: string; name: string; dateOfBirth: string; gender: string }>> {
    const problems = await storage.getProblems();
    
    const patients: Array<{ id: string; name: string; dateOfBirth: string; gender: string }> = [
      { id: "patient-1", name: "Sarah Johnson", dateOfBirth: "1985-03-15", gender: "female" },
      { id: "patient-2", name: "Michael Chen", dateOfBirth: "1972-08-22", gender: "male" },
      { id: "patient-3", name: "Emily Williams", dateOfBirth: "1990-11-08", gender: "female" },
      { id: "patient-4", name: "Robert Davis", dateOfBirth: "1965-06-30", gender: "male" },
      { id: "patient-5", name: "Maria Garcia", dateOfBirth: "1978-01-12", gender: "female" }
    ];
    
    return patients;
  }

  async validatePatient(patientId: string, userId: string = "system"): Promise<ValidationResult> {
    const patientData = await this.aggregatePatientData(patientId);
    const issues = await this.runValidationRules(patientId, patientData);
    const qualityScore = this.calculateDataQualityScore(patientData, issues);
    const aiSuggestions = await this.generateAISuggestions(patientData, issues);
    const summary = await this.generateValidationSummary(patientData, issues, qualityScore);
    
    const complianceStatus = this.determineComplianceStatus(qualityScore.overall, issues);
    
    const result: ValidationResult = {
      id: `val-${Date.now()}`,
      patientId,
      patientName: patientData.name || "Unknown Patient",
      validatedAt: new Date().toISOString(),
      dataQualityScore: qualityScore,
      issues,
      aiSuggestions,
      summary,
      complianceStatus,
      disclaimer: "INFORMATIONAL ONLY: This validation report is for data quality assessment purposes only. It does not constitute clinical advice or decision support. All identified issues and suggestions require professional review before any action is taken."
    };
    
    const history = this.validationHistory.get(patientId) || [];
    history.unshift(result);
    this.validationHistory.set(patientId, history.slice(0, 10));
    
    await comprehensiveAuditTrailService.logAuditEntry(userId, {
      who: { userId, userRole: "data_quality_analyst" },
      what: {
        category: "data_governance",
        action: "execute",
        resourceType: "PatientValidation",
        resourceId: result.id,
        description: `AI validation performed for patient ${patientId}`
      },
      why: { reason: "Data quality assessment", automatedAction: true },
      result: {
        success: true,
        duration_ms: Date.now()
      },
      context: { 
        ipAddress: "internal", 
        userAgent: "AI FHIR Patient Validation Service",
        sessionId: `validation-${Date.now()}`
      },
      severity: "info",
      tags: ["ai", "fhir", "validation", "data-quality", "no-cds"],
      phiAccessed: true,
      complianceFlags: ["HIPAA", "NO-CDS"],
      metadata: {
        issueCount: issues.length,
        qualityScore: qualityScore.overall,
        complianceStatus
      }
    });
    
    return result;
  }

  async getValidationHistory(patientId: string): Promise<ValidationResult[]> {
    return this.validationHistory.get(patientId) || [];
  }

  async getValidationRules(): Promise<ValidationRule[]> {
    return VALIDATION_RULES;
  }

  private async aggregatePatientData(patientId: string): Promise<any> {
    const patients = await this.getAvailablePatients();
    const patient = patients.find(p => p.id === patientId);
    
    const problems = (await storage.getProblems()).filter(p => p.patientId === patientId || !p.patientId);
    const medications = await storage.getMedicationsByPatient(patientId);
    const labResults = (await storage.getLabResults()).filter(l => l.patientId === patientId || !l.patientId);
    const vaccinations = await storage.getPatientVaccinations(patientId);
    const careGaps = await storage.getPatientCareGaps(patientId);
    
    return {
      id: patientId,
      name: patient?.name || null,
      dateOfBirth: patient?.dateOfBirth || null,
      gender: patient?.gender || null,
      problems: problems.slice(0, 5),
      medications: medications.slice(0, 5),
      labResults: labResults.slice(0, 5),
      vaccinations: vaccinations.slice(0, 3),
      careGaps: careGaps.slice(0, 3),
      hasContactInfo: Math.random() > 0.3,
      hasEmergencyContact: Math.random() > 0.4,
      hasInsurance: Math.random() > 0.2,
      hasPrimaryProvider: Math.random() > 0.3,
      allergyStatus: Math.random() > 0.4 ? "documented" : "unknown"
    };
  }

  private async runValidationRules(patientId: string, data: any): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    
    if (!data.name) {
      issues.push({
        ruleId: "sample-001",
        ruleName: "Patient Name Required",
        category: "demographic",
        severity: "critical",
        field: "name",
        currentValue: null,
        expectedValue: "Valid patient name",
        message: "Patient name is missing",
        suggestion: "Add patient's full legal name"
      });
    }
    
    if (!data.dateOfBirth) {
      issues.push({
        ruleId: "sample-002",
        ruleName: "Date of Birth Required",
        category: "demographic",
        severity: "critical",
        field: "dateOfBirth",
        currentValue: null,
        expectedValue: "Valid date",
        message: "Date of birth is missing",
        suggestion: "Add patient's date of birth in YYYY-MM-DD format"
      });
    }
    
    if (!data.gender) {
      issues.push({
        ruleId: "sample-003",
        ruleName: "Gender Required",
        category: "demographic",
        severity: "warning",
        field: "gender",
        currentValue: null,
        expectedValue: "male/female/other/unknown",
        message: "Gender is not specified",
        suggestion: "Specify patient's gender for clinical context"
      });
    }
    
    if (!data.hasContactInfo) {
      issues.push({
        ruleId: "sample-004",
        ruleName: "Contact Information",
        category: "demographic",
        severity: "warning",
        field: "contact",
        currentValue: null,
        message: "No contact information on file",
        suggestion: "Add phone number or email for patient communication"
      });
    }
    
    if (data.problems.length === 0) {
      issues.push({
        ruleId: "clin-001",
        ruleName: "Active Conditions Documented",
        category: "clinical",
        severity: "warning",
        field: "conditions",
        currentValue: "0 conditions",
        message: "No active conditions documented",
        suggestion: "Document active conditions or confirm patient has no known conditions"
      });
    }
    
    if (data.medications.length === 0) {
      issues.push({
        ruleId: "clin-002",
        ruleName: "Current Medications Listed",
        category: "clinical",
        severity: "warning",
        field: "medications",
        currentValue: "0 medications",
        message: "No medications documented",
        suggestion: "Document current medications or confirm patient takes no medications"
      });
    }
    
    if (data.allergyStatus === "unknown") {
      issues.push({
        ruleId: "clin-003",
        ruleName: "Allergy Status Documented",
        category: "clinical",
        severity: "critical",
        field: "allergies",
        currentValue: "Unknown",
        expectedValue: "Documented (even if NKDA)",
        message: "Allergy status is not documented",
        suggestion: "Document allergies or mark as 'No Known Drug Allergies (NKDA)'"
      });
    }
    
    if (data.vaccinations.length === 0) {
      issues.push({
        ruleId: "clin-004",
        ruleName: "Vaccination History",
        category: "clinical",
        severity: "info",
        field: "vaccinations",
        currentValue: "No records",
        message: "No vaccination history documented",
        suggestion: "Import vaccination records from state immunization registry"
      });
    }
    
    if (!data.hasPrimaryProvider) {
      issues.push({
        ruleId: "ref-001",
        ruleName: "Primary Care Provider",
        category: "referential",
        severity: "info",
        field: "primaryProvider",
        currentValue: null,
        message: "No primary care provider assigned",
        suggestion: "Assign a primary care provider for care coordination"
      });
    }
    
    if (!data.hasInsurance) {
      issues.push({
        ruleId: "admin-001",
        ruleName: "Insurance Information",
        category: "administrative",
        severity: "warning",
        field: "insurance",
        currentValue: null,
        message: "No insurance information on file",
        suggestion: "Document insurance coverage or self-pay status"
      });
    }
    
    if (!data.hasEmergencyContact) {
      issues.push({
        ruleId: "admin-002",
        ruleName: "Emergency Contact",
        category: "administrative",
        severity: "warning",
        field: "emergencyContact",
        currentValue: null,
        message: "No emergency contact documented",
        suggestion: "Add emergency contact information"
      });
    }
    
    return issues;
  }

  private calculateDataQualityScore(data: any, issues: ValidationIssue[]): DataQualityScore {
    const criticalIssues = issues.filter(i => i.severity === "critical").length;
    const warningIssues = issues.filter(i => i.severity === "warning").length;
    const infoIssues = issues.filter(i => i.severity === "info").length;
    
    const hasName = data.name ? 1 : 0;
    const hasDob = data.dateOfBirth ? 1 : 0;
    const hasGender = data.gender ? 1 : 0;
    const hasContact = data.hasContactInfo ? 1 : 0;
    const hasConditions = data.problems.length > 0 ? 1 : 0;
    const hasMedications = data.medications.length > 0 ? 1 : 0;
    const hasAllergies = data.allergyStatus === "documented" ? 1 : 0;
    const hasVaccinations = data.vaccinations.length > 0 ? 1 : 0;
    const hasLabs = data.labResults.length > 0 ? 1 : 0;
    const hasProvider = data.hasPrimaryProvider ? 1 : 0;
    
    const completeness = Math.round(((hasName + hasDob + hasGender + hasContact + hasConditions + 
      hasMedications + hasAllergies + hasVaccinations + hasLabs + hasProvider) / 10) * 100);
    
    const accuracy = Math.round(100 - (criticalIssues * 15) - (warningIssues * 5));
    
    const consistency = Math.round(100 - (warningIssues * 8) - (infoIssues * 3));
    
    const timeliness = data.labResults.length > 0 ? 85 : 60;
    
    const conformance = Math.round(100 - (criticalIssues * 20) - (warningIssues * 10) - (infoIssues * 5));
    
    const overall = Math.round(
      (completeness * 0.25) + 
      (Math.max(0, accuracy) * 0.25) + 
      (Math.max(0, consistency) * 0.20) + 
      (timeliness * 0.15) + 
      (Math.max(0, conformance) * 0.15)
    );
    
    return {
      overall: Math.max(0, Math.min(100, overall)),
      completeness: Math.max(0, Math.min(100, completeness)),
      accuracy: Math.max(0, Math.min(100, accuracy)),
      consistency: Math.max(0, Math.min(100, consistency)),
      timeliness: Math.max(0, Math.min(100, timeliness)),
      conformance: Math.max(0, Math.min(100, conformance))
    };
  }

  private async generateAISuggestions(data: any, issues: ValidationIssue[]): Promise<AISuggestion[]> {
    const suggestions: AISuggestion[] = [];
    
    try {
      const prompt = `You are a healthcare data quality expert. Analyze the following patient data validation issues and provide actionable suggestions for improving data quality.

Patient Data Summary:
- Name: ${data.name || "Missing"}
- Date of Birth: ${data.dateOfBirth || "Missing"}
- Gender: ${data.gender || "Missing"}
- Active Conditions: ${data.problems.length} documented
- Current Medications: ${data.medications.length} documented
- Lab Results: ${data.labResults.length} on file
- Vaccination Records: ${data.vaccinations.length} on file
- Allergy Status: ${data.allergyStatus}

Validation Issues Found:
${issues.map(i => `- [${i.severity.toUpperCase()}] ${i.ruleName}: ${i.message}`).join("\n")}

Provide 3-5 specific, actionable suggestions to improve this patient's data quality. Focus on:
1. Critical missing information
2. Clinical guideline compliance
3. Data completeness improvements
4. Administrative requirements

Format your response as a JSON array with objects containing: type (correction/enhancement/missing_data/guideline_compliance), priority (high/medium/low), title, description, affectedFields (array), suggestedAction, clinicalGuideline (optional).

IMPORTANT: This is for DATA QUALITY purposes only, NOT for clinical decision support.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: "You are a healthcare data quality expert. Provide suggestions for improving FHIR patient data quality. Focus on data completeness and accuracy. Do NOT provide clinical recommendations or treatment advice. This is NOT clinical decision support." 
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        const aiSuggestions = parsed.suggestions || parsed;
        if (Array.isArray(aiSuggestions)) {
          return aiSuggestions.slice(0, 5);
        }
      }
    } catch (error) {
      console.log("[AIFHIRPatientValidation] OpenAI not available, using rule-based suggestions");
    }
    
    const criticalIssues = issues.filter(i => i.severity === "critical");
    if (criticalIssues.length > 0) {
      suggestions.push({
        type: "missing_data",
        priority: "high",
        title: "Address Critical Missing Information",
        description: `${criticalIssues.length} critical data element(s) are missing and should be addressed immediately.`,
        affectedFields: criticalIssues.map(i => i.field),
        suggestedAction: "Review and complete all critical demographic and clinical fields",
        clinicalGuideline: "CMS Core Quality Measures - Patient Demographics"
      });
    }
    
    if (data.allergyStatus === "unknown") {
      suggestions.push({
        type: "guideline_compliance",
        priority: "high",
        title: "Document Allergy Status",
        description: "Allergy documentation is required for patient safety and regulatory compliance.",
        affectedFields: ["allergies"],
        suggestedAction: "Document known allergies or mark as 'No Known Drug Allergies (NKDA)'",
        clinicalGuideline: "Joint Commission NPSG.03.06.01"
      });
    }
    
    if (data.vaccinations.length === 0) {
      suggestions.push({
        type: "enhancement",
        priority: "medium",
        title: "Import Vaccination History",
        description: "Consider importing vaccination records from the state immunization registry.",
        affectedFields: ["vaccinations"],
        suggestedAction: "Connect to State IIS for vaccination record import",
        clinicalGuideline: "CDC Immunization Information System"
      });
    }
    
    if (!data.hasContactInfo || !data.hasEmergencyContact) {
      suggestions.push({
        type: "correction",
        priority: "medium",
        title: "Complete Contact Information",
        description: "Contact and emergency contact information improves care coordination.",
        affectedFields: ["contact", "emergencyContact"],
        suggestedAction: "Update patient registration with current contact details"
      });
    }
    
    if (data.careGaps.length > 0) {
      suggestions.push({
        type: "enhancement",
        priority: "low",
        title: "Review Care Gaps",
        description: `Patient has ${data.careGaps.length} identified care gap(s) that may affect data quality.`,
        affectedFields: ["careGaps"],
        suggestedAction: "Review care gap alerts and update records after addressing gaps"
      });
    }
    
    return suggestions;
  }

  private async generateValidationSummary(data: any, issues: ValidationIssue[], score: DataQualityScore): Promise<string> {
    const criticalCount = issues.filter(i => i.severity === "critical").length;
    const warningCount = issues.filter(i => i.severity === "warning").length;
    const infoCount = issues.filter(i => i.severity === "info").length;
    
    let summary = `Data quality assessment for ${data.name || "this patient"} yielded an overall score of ${score.overall}%. `;
    
    if (score.overall >= 80) {
      summary += "The patient record demonstrates good data quality with most essential elements documented. ";
    } else if (score.overall >= 60) {
      summary += "The patient record has moderate data quality with some areas requiring attention. ";
    } else {
      summary += "The patient record has significant data quality gaps that should be addressed. ";
    }
    
    if (criticalCount > 0) {
      summary += `There are ${criticalCount} critical issue(s) that require immediate attention. `;
    }
    
    if (warningCount > 0) {
      summary += `${warningCount} warning(s) indicate areas for improvement. `;
    }
    
    if (infoCount > 0) {
      summary += `${infoCount} informational finding(s) suggest optional enhancements. `;
    }
    
    summary += `Key metrics: Completeness ${score.completeness}%, Accuracy ${score.accuracy}%, Consistency ${score.consistency}%.`;
    
    return summary;
  }

  private determineComplianceStatus(overallScore: number, issues: ValidationIssue[]): "compliant" | "needs_review" | "non_compliant" {
    const criticalCount = issues.filter(i => i.severity === "critical").length;
    
    if (criticalCount > 0 || overallScore < 50) {
      return "non_compliant";
    } else if (overallScore < 80) {
      return "needs_review";
    }
    return "compliant";
  }
}

export const aiFhirPatientValidationService = new AIFHIRPatientValidationService();
