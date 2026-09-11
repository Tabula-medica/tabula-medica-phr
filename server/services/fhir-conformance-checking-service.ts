import { generatePhiSafeText } from "./ai-gateway";

export interface ConformanceProfile {
  id: string;
  name: string;
  url: string;
  resourceType: string;
  category: "us-core" | "carin" | "mcode" | "davinci" | "custom";
  requiredElements: string[];
  mustSupportElements: string[];
  isActive: boolean;
}

export interface StoredResource {
  id: string;
  resourceType: string;
  patientId?: string;
  data: Record<string, unknown>;
  source: string;
  lastUpdated: Date;
  declaredProfiles: string[];
}

export interface ConformanceIssue {
  id: string;
  resourceId: string;
  resourceType: string;
  profileId: string;
  profileName: string;
  severity: "error" | "warning" | "info";
  category: "missing-required" | "cardinality" | "invalid-value" | "missing-must-support" | "binding" | "reference" | "format";
  element: string;
  message: string;
  actualValue?: string;
  expectedValue?: string;
  suggestion?: string;
  autoFixable: boolean;
  autoFixAction?: AutoFixAction;
  detectedAt: Date;
  status: "open" | "fixed" | "ignored" | "pending-review";
}

export interface AutoFixAction {
  type: "add-element" | "update-value" | "add-coding" | "add-identifier" | "format-date" | "add-reference";
  targetPath: string;
  suggestedValue: unknown;
  confidence: number;
  explanation: string;
}

export interface ConformanceReport {
  id: string;
  resourceId: string;
  resourceType: string;
  profiles: string[];
  validatedAt: Date;
  overallScore: number;
  isConformant: boolean;
  issueCount: { errors: number; warnings: number; info: number };
  issues: ConformanceIssue[];
}

export interface ConformanceScanResult {
  scanId: string;
  startedAt: Date;
  completedAt?: Date;
  status: "running" | "completed" | "failed";
  resourcesScanned: number;
  resourcesPassed: number;
  resourcesFailed: number;
  totalIssues: number;
  criticalIssues: number;
  autoFixableIssues: number;
  profileBreakdown: Record<string, { passed: number; failed: number }>;
}

export interface ConformanceDashboardStats {
  totalResources: number;
  conformantResources: number;
  nonConformantResources: number;
  conformanceRate: number;
  openIssues: number;
  criticalIssues: number;
  autoFixableIssues: number;
  recentScans: ConformanceScanResult[];
  issuesByProfile: Record<string, number>;
  issuesByCategory: Record<string, number>;
  trendData: { date: string; conformanceRate: number; issues: number }[];
  topFailingResources: { resourceId: string; resourceType: string; issueCount: number }[];
}

const conformanceProfiles: ConformanceProfile[] = [
  {
    id: "us-core-patient",
    name: "US Core Patient",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient",
    resourceType: "Patient",
    category: "us-core",
    requiredElements: ["identifier", "name", "gender"],
    mustSupportElements: ["birthDate", "address", "telecom", "communication"],
    isActive: true,
  },
  {
    id: "us-core-condition",
    name: "US Core Condition",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition",
    resourceType: "Condition",
    category: "us-core",
    requiredElements: ["clinicalStatus", "code", "subject"],
    mustSupportElements: ["verificationStatus", "category", "severity", "onset[x]", "abatement[x]"],
    isActive: true,
  },
  {
    id: "us-core-observation",
    name: "US Core Observation",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation",
    resourceType: "Observation",
    category: "us-core",
    requiredElements: ["status", "category", "code", "subject"],
    mustSupportElements: ["effectiveDateTime", "value[x]", "interpretation", "referenceRange"],
    isActive: true,
  },
  {
    id: "us-core-medication-request",
    name: "US Core MedicationRequest",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest",
    resourceType: "MedicationRequest",
    category: "us-core",
    requiredElements: ["status", "intent", "medication[x]", "subject"],
    mustSupportElements: ["authoredOn", "requester", "dosageInstruction", "dispenseRequest"],
    isActive: true,
  },
  {
    id: "us-core-allergy",
    name: "US Core AllergyIntolerance",
    url: "http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance",
    resourceType: "AllergyIntolerance",
    category: "us-core",
    requiredElements: ["clinicalStatus", "code", "patient"],
    mustSupportElements: ["verificationStatus", "category", "criticality", "reaction"],
    isActive: true,
  },
  {
    id: "carin-coverage",
    name: "CARIN Coverage",
    url: "http://hl7.org/fhir/us/carin-bb/StructureDefinition/C4BB-Coverage",
    resourceType: "Coverage",
    category: "carin",
    requiredElements: ["status", "beneficiary", "payor"],
    mustSupportElements: ["type", "subscriber", "subscriberId", "relationship", "period"],
    isActive: true,
  },
  {
    id: "mcode-cancer-patient",
    name: "mCODE Cancer Patient",
    url: "http://hl7.org/fhir/us/mcode/StructureDefinition/mcode-cancer-patient",
    resourceType: "Patient",
    category: "mcode",
    requiredElements: ["identifier", "name", "gender", "birthDate"],
    mustSupportElements: ["address", "telecom", "communication", "race", "ethnicity"],
    isActive: true,
  },
];

const resourceStore = new Map<string, StoredResource>();
const issueStore = new Map<string, ConformanceIssue>();
const reportStore = new Map<string, ConformanceReport>();
const scanResultStore = new Map<string, ConformanceScanResult>();

const sampleResources: StoredResource[] = [
  {
    id: "patient-001",
    resourceType: "Patient",
    patientId: "patient-001",
    data: {
      resourceType: "Patient",
      id: "patient-001",
      identifier: [{ system: "http://hospital.example.org/mrn", value: "MRN12345" }],
      name: [{ family: "Smith", given: ["John"] }],
      gender: "male",
      birthDate: "1965-04-15",
    },
    source: "Fasten Health",
    lastUpdated: new Date(),
    declaredProfiles: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"],
  },
  {
    id: "patient-002",
    resourceType: "Patient",
    patientId: "patient-002",
    data: {
      resourceType: "Patient",
      id: "patient-002",
      name: [{ family: "Johnson", given: ["Mary"] }],
      birthDate: "1978-08-22",
    },
    source: "provider",
    lastUpdated: new Date(),
    declaredProfiles: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"],
  },
  {
    id: "condition-001",
    resourceType: "Condition",
    patientId: "patient-001",
    data: {
      resourceType: "Condition",
      id: "condition-001",
      clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
      code: { coding: [{ system: "http://snomed.info/sct", code: "73211009", display: "Diabetes mellitus" }] },
      subject: { reference: "Patient/patient-001" },
    },
    source: "Fasten Health",
    lastUpdated: new Date(),
    declaredProfiles: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition"],
  },
  {
    id: "condition-002",
    resourceType: "Condition",
    patientId: "patient-001",
    data: {
      resourceType: "Condition",
      id: "condition-002",
      code: { coding: [{ system: "http://snomed.info/sct", code: "38341003", display: "Hypertension" }] },
      subject: { reference: "Patient/patient-001" },
    },
    source: "Fasten Health",
    lastUpdated: new Date(),
    declaredProfiles: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-condition"],
  },
  {
    id: "observation-001",
    resourceType: "Observation",
    patientId: "patient-001",
    data: {
      resourceType: "Observation",
      id: "observation-001",
      status: "final",
      code: { coding: [{ system: "http://loinc.org", code: "2339-0", display: "Glucose" }] },
      subject: { reference: "Patient/patient-001" },
      valueQuantity: { value: 126, unit: "mg/dL" },
    },
    source: "Quest",
    lastUpdated: new Date(),
    declaredProfiles: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation"],
  },
  {
    id: "medication-001",
    resourceType: "MedicationRequest",
    patientId: "patient-001",
    data: {
      resourceType: "MedicationRequest",
      id: "medication-001",
      status: "active",
      intent: "order",
      medicationCodeableConcept: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "860975", display: "Metformin 500mg" }] },
      subject: { reference: "Patient/patient-001" },
    },
    source: "Fasten Health",
    lastUpdated: new Date(),
    declaredProfiles: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest"],
  },
  {
    id: "allergy-001",
    resourceType: "AllergyIntolerance",
    patientId: "patient-002",
    data: {
      resourceType: "AllergyIntolerance",
      id: "allergy-001",
      code: { coding: [{ system: "http://www.nlm.nih.gov/research/umls/rxnorm", code: "723", display: "Penicillin" }] },
      patient: { reference: "Patient/patient-002" },
    },
    source: "CVS",
    lastUpdated: new Date(),
    declaredProfiles: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance"],
  },
];

sampleResources.forEach((r) => resourceStore.set(r.id, r));

let schedulerInterval: NodeJS.Timeout | null = null;
let isSchedulerRunning = false;
let lastScanTime: Date | null = null;

class FHIRConformanceCheckingService {
  getProfiles(): ConformanceProfile[] {
    return conformanceProfiles;
  }

  getActiveProfiles(): ConformanceProfile[] {
    return conformanceProfiles.filter((p) => p.isActive);
  }

  getProfileForResourceType(resourceType: string): ConformanceProfile | undefined {
    return conformanceProfiles.find((p) => p.resourceType === resourceType && p.isActive);
  }

  getStoredResources(): StoredResource[] {
    return Array.from(resourceStore.values());
  }

  getStoredResource(id: string): StoredResource | undefined {
    return resourceStore.get(id);
  }

  addResource(resource: StoredResource): void {
    resourceStore.set(resource.id, resource);
  }

  getIssues(filters?: { status?: string; severity?: string; profileId?: string; resourceType?: string }): ConformanceIssue[] {
    let issues = Array.from(issueStore.values());
    if (filters?.status) {
      issues = issues.filter((i) => i.status === filters.status);
    }
    if (filters?.severity) {
      issues = issues.filter((i) => i.severity === filters.severity);
    }
    if (filters?.profileId) {
      issues = issues.filter((i) => i.profileId === filters.profileId);
    }
    if (filters?.resourceType) {
      issues = issues.filter((i) => i.resourceType === filters.resourceType);
    }
    return issues.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  getIssue(id: string): ConformanceIssue | undefined {
    return issueStore.get(id);
  }

  updateIssueStatus(id: string, status: "open" | "fixed" | "ignored" | "pending-review"): ConformanceIssue | undefined {
    const issue = issueStore.get(id);
    if (issue) {
      issue.status = status;
      issueStore.set(id, issue);
    }
    return issue;
  }

  getReports(): ConformanceReport[] {
    return Array.from(reportStore.values()).sort((a, b) => b.validatedAt.getTime() - a.validatedAt.getTime());
  }

  getReport(id: string): ConformanceReport | undefined {
    return reportStore.get(id);
  }

  getScanResults(): ConformanceScanResult[] {
    return Array.from(scanResultStore.values()).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  async validateResource(resource: StoredResource): Promise<ConformanceReport> {
    const profile = this.getProfileForResourceType(resource.resourceType);
    if (!profile) {
      return {
        id: `report-${Date.now()}`,
        resourceId: resource.id,
        resourceType: resource.resourceType,
        profiles: [],
        validatedAt: new Date(),
        overallScore: 100,
        isConformant: true,
        issueCount: { errors: 0, warnings: 0, info: 0 },
        issues: [],
      };
    }

    const issues: ConformanceIssue[] = [];
    const data = resource.data;

    for (const element of profile.requiredElements) {
      const value = this.getElementValue(data, element);
      if (value === undefined || value === null) {
        const autoFix = this.generateAutoFix(resource.resourceType, element, data);
        issues.push({
          id: `issue-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          resourceId: resource.id,
          resourceType: resource.resourceType,
          profileId: profile.id,
          profileName: profile.name,
          severity: "error",
          category: "missing-required",
          element,
          message: `Required element '${element}' is missing`,
          suggestion: `Add the required ${element} element to conform to ${profile.name}`,
          autoFixable: autoFix !== undefined,
          autoFixAction: autoFix,
          detectedAt: new Date(),
          status: "open",
        });
      }
    }

    for (const element of profile.mustSupportElements) {
      const baseElement = element.replace("[x]", "");
      const value = this.getElementValue(data, baseElement);
      if (value === undefined || value === null) {
        issues.push({
          id: `issue-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          resourceId: resource.id,
          resourceType: resource.resourceType,
          profileId: profile.id,
          profileName: profile.name,
          severity: "warning",
          category: "missing-must-support",
          element,
          message: `Must-support element '${element}' is not populated`,
          suggestion: `Consider populating ${element} for better interoperability`,
          autoFixable: false,
          detectedAt: new Date(),
          status: "open",
        });
      }
    }

    const additionalIssues = this.checkAdditionalConstraints(resource, profile);
    issues.push(...additionalIssues);

    for (const issue of issues) {
      issueStore.set(issue.id, issue);
    }

    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    const infoCount = issues.filter((i) => i.severity === "info").length;

    const totalChecks = profile.requiredElements.length + profile.mustSupportElements.length;
    const passedChecks = totalChecks - issues.length;
    const overallScore = totalChecks > 0 ? Math.max(0, Math.round((passedChecks / totalChecks) * 100)) : 100;

    const report: ConformanceReport = {
      id: `report-${resource.id}-${Date.now()}`,
      resourceId: resource.id,
      resourceType: resource.resourceType,
      profiles: [profile.id],
      validatedAt: new Date(),
      overallScore,
      isConformant: errorCount === 0,
      issueCount: { errors: errorCount, warnings: warningCount, info: infoCount },
      issues,
    };

    reportStore.set(report.id, report);
    return report;
  }

  private getElementValue(data: Record<string, unknown>, element: string): unknown {
    const parts = element.split(".");
    let current: unknown = data;
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === "object") {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return current;
  }

  private generateAutoFix(resourceType: string, element: string, data: Record<string, unknown>): AutoFixAction | undefined {
    if (resourceType === "Patient" && element === "identifier") {
      return {
        type: "add-identifier",
        targetPath: "identifier",
        suggestedValue: [{ system: "http://example.org/fhir/identifier", value: `auto-${Date.now()}` }],
        confidence: 0.6,
        explanation: "Add a placeholder identifier. Update with the correct system and value.",
      };
    }

    if (resourceType === "Patient" && element === "gender") {
      return {
        type: "add-element",
        targetPath: "gender",
        suggestedValue: "unknown",
        confidence: 0.8,
        explanation: "Set gender to 'unknown' as a default. Update when actual value is available.",
      };
    }

    if (resourceType === "Condition" && element === "clinicalStatus") {
      return {
        type: "add-coding",
        targetPath: "clinicalStatus",
        suggestedValue: {
          coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active", display: "Active" }],
        },
        confidence: 0.7,
        explanation: "Add clinical status with 'active' as default. Verify and update if needed.",
      };
    }

    if (resourceType === "AllergyIntolerance" && element === "clinicalStatus") {
      return {
        type: "add-coding",
        targetPath: "clinicalStatus",
        suggestedValue: {
          coding: [{ system: "http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical", code: "active", display: "Active" }],
        },
        confidence: 0.7,
        explanation: "Add clinical status with 'active' as default. Verify and update if needed.",
      };
    }

    if (resourceType === "Observation" && element === "category") {
      return {
        type: "add-coding",
        targetPath: "category",
        suggestedValue: [
          { coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory", display: "Laboratory" }] },
        ],
        confidence: 0.5,
        explanation: "Add category based on the observation type. Review and adjust as needed.",
      };
    }

    return undefined;
  }

  private checkAdditionalConstraints(resource: StoredResource, profile: ConformanceProfile): ConformanceIssue[] {
    const issues: ConformanceIssue[] = [];
    const data = resource.data;

    if (resource.resourceType === "Patient") {
      const name = data.name as Array<{ family?: string; given?: string[] }> | undefined;
      if (name && Array.isArray(name)) {
        for (let i = 0; i < name.length; i++) {
          if (!name[i].family && (!name[i].given || name[i].given?.length === 0)) {
            issues.push({
              id: `issue-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              resourceId: resource.id,
              resourceType: resource.resourceType,
              profileId: profile.id,
              profileName: profile.name,
              severity: "error",
              category: "invalid-value",
              element: `name[${i}]`,
              message: `Name at index ${i} must have at least family or given name`,
              suggestion: "Provide either a family name or given name(s)",
              autoFixable: false,
              detectedAt: new Date(),
              status: "open",
            });
          }
        }
      }
    }

    if (resource.resourceType === "Observation") {
      const coding = (data.code as { coding?: Array<{ system?: string }> })?.coding;
      if (coding && Array.isArray(coding)) {
        const hasStandardSystem = coding.some((c) => c.system?.includes("loinc.org") || c.system?.includes("snomed.info"));
        if (!hasStandardSystem) {
          issues.push({
            id: `issue-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            resourceId: resource.id,
            resourceType: resource.resourceType,
            profileId: profile.id,
            profileName: profile.name,
            severity: "warning",
            category: "binding",
            element: "code.coding",
            message: "Observation code should use a standard terminology (LOINC or SNOMED CT)",
            actualValue: coding[0]?.system,
            expectedValue: "http://loinc.org or http://snomed.info/sct",
            suggestion: "Map local codes to LOINC or SNOMED CT for better interoperability",
            autoFixable: false,
            detectedAt: new Date(),
            status: "open",
          });
        }
      }
    }

    return issues;
  }

  async runFullScan(): Promise<ConformanceScanResult> {
    const scanId = `scan-${Date.now()}`;
    const scan: ConformanceScanResult = {
      scanId,
      startedAt: new Date(),
      status: "running",
      resourcesScanned: 0,
      resourcesPassed: 0,
      resourcesFailed: 0,
      totalIssues: 0,
      criticalIssues: 0,
      autoFixableIssues: 0,
      profileBreakdown: {},
    };
    scanResultStore.set(scanId, scan);

    console.log(`[ConformanceChecker] Starting full scan ${scanId}`);

    const resources = this.getStoredResources();
    for (const resource of resources) {
      try {
        const report = await this.validateResource(resource);
        scan.resourcesScanned++;
        if (report.isConformant) {
          scan.resourcesPassed++;
        } else {
          scan.resourcesFailed++;
        }
        scan.totalIssues += report.issues.length;
        scan.criticalIssues += report.issueCount.errors;
        scan.autoFixableIssues += report.issues.filter((i) => i.autoFixable).length;

        for (const profileId of report.profiles) {
          if (!scan.profileBreakdown[profileId]) {
            scan.profileBreakdown[profileId] = { passed: 0, failed: 0 };
          }
          if (report.isConformant) {
            scan.profileBreakdown[profileId].passed++;
          } else {
            scan.profileBreakdown[profileId].failed++;
          }
        }
      } catch (error) {
        console.error(`[ConformanceChecker] Error validating ${resource.id}:`, error);
      }
    }

    scan.completedAt = new Date();
    scan.status = "completed";
    scanResultStore.set(scanId, scan);
    lastScanTime = new Date();

    console.log(`[ConformanceChecker] Scan ${scanId} completed: ${scan.resourcesPassed}/${scan.resourcesScanned} passed`);
    return scan;
  }

  getDashboardStats(): ConformanceDashboardStats {
    const resources = this.getStoredResources();
    const openIssues = this.getIssues({ status: "open" });
    const scans = this.getScanResults().slice(0, 10);

    const reportsMap = new Map<string, ConformanceReport>();
    for (const report of this.getReports()) {
      const existing = reportsMap.get(report.resourceId);
      if (!existing || report.validatedAt > existing.validatedAt) {
        reportsMap.set(report.resourceId, report);
      }
    }
    const latestReports = Array.from(reportsMap.values());

    const conformantCount = latestReports.filter((r) => r.isConformant).length;
    const nonConformantCount = latestReports.filter((r) => !r.isConformant).length;

    const issuesByProfile: Record<string, number> = {};
    const issuesByCategory: Record<string, number> = {};
    for (const issue of openIssues) {
      issuesByProfile[issue.profileId] = (issuesByProfile[issue.profileId] || 0) + 1;
      issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;
    }

    const resourceIssueCount = new Map<string, number>();
    for (const issue of openIssues) {
      resourceIssueCount.set(issue.resourceId, (resourceIssueCount.get(issue.resourceId) || 0) + 1);
    }
    const topFailingResources = Array.from(resourceIssueCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([resourceId, issueCount]) => {
        const resource = resourceStore.get(resourceId);
        return {
          resourceId,
          resourceType: resource?.resourceType || "Unknown",
          issueCount,
        };
      });

    const trendData = scans.slice(0, 7).reverse().map((scan) => ({
      date: scan.startedAt.toISOString().split("T")[0],
      conformanceRate: scan.resourcesScanned > 0 ? Math.round((scan.resourcesPassed / scan.resourcesScanned) * 100) : 100,
      issues: scan.totalIssues,
    }));

    return {
      totalResources: resources.length,
      conformantResources: conformantCount,
      nonConformantResources: nonConformantCount,
      conformanceRate: resources.length > 0 ? Math.round((conformantCount / resources.length) * 100) : 100,
      openIssues: openIssues.length,
      criticalIssues: openIssues.filter((i) => i.severity === "error").length,
      autoFixableIssues: openIssues.filter((i) => i.autoFixable).length,
      recentScans: scans,
      issuesByProfile,
      issuesByCategory,
      trendData,
      topFailingResources,
    };
  }

  async applyAutoFix(issueId: string): Promise<{ success: boolean; updatedResource?: StoredResource; message: string }> {
    const issue = issueStore.get(issueId);
    if (!issue) {
      return { success: false, message: "Issue not found" };
    }
    if (!issue.autoFixable || !issue.autoFixAction) {
      return { success: false, message: "Issue is not auto-fixable" };
    }

    const resource = resourceStore.get(issue.resourceId);
    if (!resource) {
      return { success: false, message: "Resource not found" };
    }

    const fix = issue.autoFixAction;
    const updatedData = { ...resource.data };
    this.setNestedValue(updatedData, fix.targetPath, fix.suggestedValue);

    const updatedResource: StoredResource = {
      ...resource,
      data: updatedData,
      lastUpdated: new Date(),
    };
    resourceStore.set(resource.id, updatedResource);

    issue.status = "fixed";
    issueStore.set(issueId, issue);

    console.log(`[ConformanceChecker] Applied auto-fix for issue ${issueId}: ${fix.explanation}`);
    return {
      success: true,
      updatedResource,
      message: `Applied fix: ${fix.explanation}`,
    };
  }

  async applyMultipleAutoFixes(issueIds: string[]): Promise<{ successful: number; failed: number; results: Array<{ issueId: string; success: boolean; message: string }> }> {
    const results: Array<{ issueId: string; success: boolean; message: string }> = [];
    let successful = 0;
    let failed = 0;

    for (const issueId of issueIds) {
      const result = await this.applyAutoFix(issueId);
      results.push({ issueId, ...result });
      if (result.success) {
        successful++;
      } else {
        failed++;
      }
    }

    return { successful, failed, results };
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split(".");
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }

  async generateAICorrections(issueIds: string[]): Promise<Array<{ issueId: string; aiSuggestion: string; confidence: number }>> {
    const results: Array<{ issueId: string; aiSuggestion: string; confidence: number }> = [];

    for (const issueId of issueIds) {
      const issue = issueStore.get(issueId);
      if (!issue) continue;

      const resource = resourceStore.get(issue.resourceId);
      if (!resource) continue;

      try {
        const prompt = `You are a FHIR R4 conformance expert. Analyze this conformance issue and provide a specific correction suggestion.

Issue Details:
- Resource Type: ${issue.resourceType}
- Profile: ${issue.profileName}
- Element: ${issue.element}
- Category: ${issue.category}
- Message: ${issue.message}
- Current Value: ${issue.actualValue || "not set"}
- Expected Value: ${issue.expectedValue || "N/A"}

Current Resource Data:
${JSON.stringify(resource.data, null, 2)}

Provide a specific, actionable correction to make this resource conformant. Include the exact value or structure to add/modify.`;

        const suggestion = (await generatePhiSafeText({
          user: prompt,
          maxTokens: 500,
          temperature: 0.3,
        })) || "Unable to generate suggestion";
        results.push({
          issueId,
          aiSuggestion: suggestion,
          confidence: 0.8,
        });
      } catch (error) {
        console.error(`[ConformanceChecker] AI suggestion failed for ${issueId}:`, error);
        results.push({
          issueId,
          aiSuggestion: issue.suggestion || "Review the element and add the required value",
          confidence: 0.5,
        });
      }
    }

    return results;
  }

  startScheduler(intervalMinutes: number = 60): void {
    if (schedulerInterval) {
      this.stopScheduler();
    }

    console.log(`[ConformanceChecker] Starting scheduler with ${intervalMinutes} minute interval`);
    isSchedulerRunning = true;

    this.runFullScan();

    schedulerInterval = setInterval(() => {
      if (isSchedulerRunning) {
        this.runFullScan();
      }
    }, intervalMinutes * 60 * 1000);
  }

  stopScheduler(): void {
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
    }
    isSchedulerRunning = false;
    console.log("[ConformanceChecker] Scheduler stopped");
  }

  isSchedulerActive(): boolean {
    return isSchedulerRunning;
  }

  getLastScanTime(): Date | null {
    return lastScanTime;
  }
}

export const conformanceCheckingService = new FHIRConformanceCheckingService();
