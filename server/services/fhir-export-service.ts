import { randomUUID } from "crypto";
import OpenAI from "openai";

export type ExportFormat = "fhir_json" | "fhir_xml" | "csv" | "hl7v2" | "ndjson";

export type FHIRResourceType =
  | "Patient"
  | "Observation"
  | "Condition"
  | "Medication"
  | "MedicationRequest"
  | "Procedure"
  | "Immunization"
  | "AllergyIntolerance"
  | "DiagnosticReport"
  | "Encounter"
  | "DocumentReference"
  | "CarePlan"
  | "CareTeam"
  | "Goal"
  | "Practitioner"
  | "Organization"
  | "Coverage"
  | "Claim"
  | "ExplanationOfBenefit";

export interface ExportRequest {
  id?: string;
  name: string;
  description?: string;
  resourceTypes: FHIRResourceType[];
  format: ExportFormat;
  filters: ExportFilters;
  options: ExportOptions;
}

export interface ExportFilters {
  patientIds?: string[];
  dateRange?: { start: string; end: string };
  encounterTypes?: string[];
  conditionCodes?: string[];
  includeRelatedResources?: boolean;
}

export interface ExportOptions {
  includeMetadata?: boolean;
  deidentify?: boolean;
  compressOutput?: boolean;
  splitByResourceType?: boolean;
  maxRecordsPerFile?: number;
  customMapping?: Record<string, string>;
}

export interface ExportJob {
  id: string;
  requestId: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  format: ExportFormat;
  resourceTypes: FHIRResourceType[];
  progress: number;
  totalResources: number;
  exportedResources: number;
  startedAt: string;
  completedAt?: string;
  downloadUrl?: string;
  fileSize?: number;
  error?: string;
  metadata: {
    createdBy: string;
    patientCount?: number;
    resourceCounts?: Record<string, number>;
  };
}

export interface ExportSuggestion {
  id: string;
  name: string;
  description: string;
  useCase: string;
  resourceTypes: FHIRResourceType[];
  suggestedFormat: ExportFormat;
  filters: Partial<ExportFilters>;
  priority: "high" | "medium" | "low";
  estimatedRecords: number;
  rationale: string;
}

export interface ExportPreview {
  resourceCounts: Record<string, number>;
  totalRecords: number;
  estimatedFileSize: string;
  sampleData: Record<string, unknown[]>;
  warnings: string[];
}

const samplePatients = [
  { id: "patient-001", name: "John Smith", birthDate: "1965-03-15", gender: "male" },
  { id: "patient-002", name: "Mary Johnson", birthDate: "1978-07-22", gender: "female" },
  { id: "patient-003", name: "Robert Davis", birthDate: "1952-11-08", gender: "male" },
  { id: "patient-004", name: "Sarah Wilson", birthDate: "1990-01-30", gender: "female" },
  { id: "patient-005", name: "Michael Brown", birthDate: "1985-09-12", gender: "male" },
];

const sampleObservations = [
  { id: "obs-001", patientId: "patient-001", code: "8480-6", display: "Systolic BP", value: 142, unit: "mmHg", date: "2026-01-15" },
  { id: "obs-002", patientId: "patient-001", code: "8462-4", display: "Diastolic BP", value: 88, unit: "mmHg", date: "2026-01-15" },
  { id: "obs-003", patientId: "patient-002", code: "4548-4", display: "Hemoglobin A1c", value: 7.2, unit: "%", date: "2026-01-10" },
  { id: "obs-004", patientId: "patient-003", code: "2339-0", display: "Glucose", value: 126, unit: "mg/dL", date: "2026-01-12" },
  { id: "obs-005", patientId: "patient-004", code: "29463-7", display: "Body Weight", value: 68, unit: "kg", date: "2026-01-20" },
];

const sampleConditions = [
  { id: "cond-001", patientId: "patient-001", code: "I10", display: "Essential Hypertension", status: "active", onsetDate: "2020-05-10" },
  { id: "cond-002", patientId: "patient-002", code: "E11.9", display: "Type 2 Diabetes Mellitus", status: "active", onsetDate: "2018-03-22" },
  { id: "cond-003", patientId: "patient-003", code: "J44.9", display: "COPD", status: "active", onsetDate: "2019-08-15" },
  { id: "cond-004", patientId: "patient-001", code: "E78.5", display: "Hyperlipidemia", status: "active", onsetDate: "2021-02-28" },
  { id: "cond-005", patientId: "patient-005", code: "F32.1", display: "Major Depressive Disorder", status: "active", onsetDate: "2023-06-01" },
];

const sampleMedications = [
  { id: "med-001", patientId: "patient-001", code: "197884", display: "Lisinopril 10mg", status: "active", startDate: "2020-05-15" },
  { id: "med-002", patientId: "patient-002", code: "861004", display: "Metformin 500mg", status: "active", startDate: "2018-04-01" },
  { id: "med-003", patientId: "patient-003", code: "746762", display: "Albuterol Inhaler", status: "active", startDate: "2019-08-20" },
  { id: "med-004", patientId: "patient-001", code: "262095", display: "Atorvastatin 20mg", status: "active", startDate: "2021-03-05" },
  { id: "med-005", patientId: "patient-005", code: "312938", display: "Sertraline 50mg", status: "active", startDate: "2023-06-10" },
];

class FHIRExportService {
  private openai: OpenAI | null = null;
  private exportJobs: Map<string, ExportJob> = new Map();
  private exportRequests: Map<string, ExportRequest> = new Map();

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else {
      console.log("[FHIRExport] OpenAI client not configured, using fallback suggestions");
    }
  }

  async createExportRequest(userId: string, request: ExportRequest): Promise<ExportRequest> {
    const id = `export-req-${randomUUID().slice(0, 8)}`;
    const exportRequest: ExportRequest = { ...request, id };
    this.exportRequests.set(id, exportRequest);
    console.log(`[HIPAA-AUDIT][FHIRExport] Export request created: id=${id}, user=${userId}, resources=${request.resourceTypes.join(",")}, format=${request.format}`);
    return exportRequest;
  }

  async startExport(userId: string, requestId: string): Promise<ExportJob> {
    const request = this.exportRequests.get(requestId);
    if (!request) {
      throw new Error(`Export request ${requestId} not found`);
    }

    const jobId = `export-job-${randomUUID().slice(0, 8)}`;
    const job: ExportJob = {
      id: jobId,
      requestId,
      status: "processing",
      format: request.format,
      resourceTypes: request.resourceTypes,
      progress: 0,
      totalResources: 0,
      exportedResources: 0,
      startedAt: new Date().toISOString(),
      metadata: { createdBy: userId, resourceCounts: {} },
    };

    this.exportJobs.set(jobId, job);
    console.log(`[HIPAA-AUDIT][FHIRExport] Export job started: jobId=${jobId}, requestId=${requestId}, user=${userId}`);

    this.processExportJob(jobId, request);

    return job;
  }

  private async processExportJob(jobId: string, request: ExportRequest): Promise<void> {
    const job = this.exportJobs.get(jobId);
    if (!job) return;

    try {
      const resourceCounts: Record<string, number> = {};
      let totalRecords = 0;

      for (const resourceType of request.resourceTypes) {
        const count = this.getResourceCount(resourceType, request.filters);
        resourceCounts[resourceType] = count;
        totalRecords += count;
      }

      job.totalResources = totalRecords;
      job.metadata.resourceCounts = resourceCounts;

      for (let i = 0; i <= 100; i += 20) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        job.progress = i;
        job.exportedResources = Math.floor((totalRecords * i) / 100);
        this.exportJobs.set(jobId, job);
      }

      job.status = "completed";
      job.progress = 100;
      job.exportedResources = totalRecords;
      job.completedAt = new Date().toISOString();
      job.downloadUrl = `/api/fhir-export/download/${jobId}`;
      job.fileSize = this.estimateFileSize(totalRecords, request.format);
      job.metadata.patientCount = this.getPatientCount(request.filters);

      this.exportJobs.set(jobId, job);
      console.log(`[HIPAA-AUDIT][FHIRExport] Export job completed: jobId=${jobId}, records=${totalRecords}`);
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Export failed";
      this.exportJobs.set(jobId, job);
      console.error(`[HIPAA-AUDIT][FHIRExport] Export job failed: jobId=${jobId}, error=${job.error}`);
    }
  }

  private getResourceCount(resourceType: FHIRResourceType, filters: ExportFilters): number {
    const baseCounts: Record<string, number> = {
      Patient: 5,
      Observation: 5,
      Condition: 5,
      MedicationRequest: 5,
      Procedure: 3,
      Immunization: 4,
      AllergyIntolerance: 2,
      DiagnosticReport: 4,
      Encounter: 6,
      DocumentReference: 3,
      CarePlan: 2,
      CareTeam: 2,
      Goal: 3,
      Practitioner: 5,
      Organization: 2,
      Coverage: 3,
      Claim: 4,
      ExplanationOfBenefit: 4,
      Medication: 5,
    };
    let count = baseCounts[resourceType] || 3;
    if (filters.patientIds?.length) {
      count = Math.min(count, filters.patientIds.length * 2);
    }
    return count;
  }

  private getPatientCount(filters: ExportFilters): number {
    return filters.patientIds?.length || 5;
  }

  private estimateFileSize(recordCount: number, format: ExportFormat): number {
    const bytesPerRecord: Record<ExportFormat, number> = {
      fhir_json: 2048,
      fhir_xml: 3072,
      csv: 256,
      hl7v2: 512,
      ndjson: 1024,
    };
    return recordCount * (bytesPerRecord[format] || 1024);
  }

  async getExportJob(jobId: string): Promise<ExportJob | undefined> {
    return this.exportJobs.get(jobId);
  }

  async getExportJobs(userId: string): Promise<ExportJob[]> {
    return Array.from(this.exportJobs.values())
      .filter((job) => job.metadata.createdBy === userId || job.metadata.createdBy === "system")
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async cancelExport(jobId: string, userId: string): Promise<ExportJob | undefined> {
    const job = this.exportJobs.get(jobId);
    if (!job) return undefined;
    if (job.status === "completed" || job.status === "failed") return job;

    job.status = "cancelled";
    job.completedAt = new Date().toISOString();
    this.exportJobs.set(jobId, job);
    console.log(`[HIPAA-AUDIT][FHIRExport] Export job cancelled: jobId=${jobId}, user=${userId}`);
    return job;
  }

  async getExportPreview(request: ExportRequest): Promise<ExportPreview> {
    const resourceCounts: Record<string, number> = {};
    let totalRecords = 0;

    for (const resourceType of request.resourceTypes) {
      const count = this.getResourceCount(resourceType, request.filters);
      resourceCounts[resourceType] = count;
      totalRecords += count;
    }

    const sampleData: Record<string, unknown[]> = {};
    for (const resourceType of request.resourceTypes.slice(0, 3)) {
      sampleData[resourceType] = this.getSampleData(resourceType, 2);
    }

    const fileSize = this.estimateFileSize(totalRecords, request.format);
    const warnings: string[] = [];

    if (totalRecords > 10000) {
      warnings.push("Large export detected. Consider using date range filters to reduce size.");
    }
    if (request.format === "hl7v2" && request.resourceTypes.length > 5) {
      warnings.push("HL7v2 format may have limitations for some resource types.");
    }
    if (!request.options.deidentify && request.resourceTypes.includes("Patient")) {
      warnings.push("Export contains PHI. Ensure proper authorization for data handling.");
    }

    return {
      resourceCounts,
      totalRecords,
      estimatedFileSize: this.formatFileSize(fileSize),
      sampleData,
      warnings,
    };
  }

  private getSampleData(resourceType: FHIRResourceType, limit: number): unknown[] {
    switch (resourceType) {
      case "Patient":
        return samplePatients.slice(0, limit);
      case "Observation":
        return sampleObservations.slice(0, limit);
      case "Condition":
        return sampleConditions.slice(0, limit);
      case "MedicationRequest":
      case "Medication":
        return sampleMedications.slice(0, limit);
      default:
        return [{ id: `${resourceType.toLowerCase()}-001`, resourceType, status: "active" }];
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async generateExportData(jobId: string): Promise<{ data: string; contentType: string; filename: string }> {
    const job = this.exportJobs.get(jobId);
    if (!job || job.status !== "completed") {
      throw new Error("Export not ready for download");
    }

    const request = this.exportRequests.get(job.requestId);
    if (!request) {
      throw new Error("Export request not found");
    }

    const resources: Record<string, unknown[]> = {};
    for (const resourceType of request.resourceTypes) {
      resources[resourceType] = this.getSampleData(resourceType, 10);
    }

    let data: string;
    let contentType: string;
    let filename: string;

    switch (request.format) {
      case "fhir_json":
        data = this.toFHIRBundle(resources);
        contentType = "application/fhir+json";
        filename = `fhir_export_${jobId}.json`;
        break;
      case "fhir_xml":
        data = this.toFHIRXML(resources);
        contentType = "application/fhir+xml";
        filename = `fhir_export_${jobId}.xml`;
        break;
      case "csv":
        data = this.toCSV(resources);
        contentType = "text/csv";
        filename = `fhir_export_${jobId}.csv`;
        break;
      case "hl7v2":
        data = this.toHL7v2(resources);
        contentType = "text/plain";
        filename = `fhir_export_${jobId}.hl7`;
        break;
      case "ndjson":
        data = this.toNDJSON(resources);
        contentType = "application/ndjson";
        filename = `fhir_export_${jobId}.ndjson`;
        break;
      default:
        throw new Error(`Unsupported format: ${request.format}`);
    }

    console.log(`[HIPAA-AUDIT][FHIRExport] Export downloaded: jobId=${jobId}, format=${request.format}`);
    return { data, contentType, filename };
  }

  private toFHIRBundle(resources: Record<string, unknown[]>): string {
    const bundle = {
      resourceType: "Bundle",
      id: randomUUID(),
      type: "collection",
      timestamp: new Date().toISOString(),
      total: Object.values(resources).flat().length,
      entry: Object.entries(resources).flatMap(([type, items]) =>
        items.map((item: any) => ({
          fullUrl: `urn:uuid:${item.id}`,
          resource: {
            resourceType: type,
            id: item.id,
            ...this.mapToFHIR(type, item),
          },
        }))
      ),
    };
    return JSON.stringify(bundle, null, 2);
  }

  private mapToFHIR(resourceType: string, item: any): Record<string, unknown> {
    switch (resourceType) {
      case "Patient":
        return {
          name: [{ family: item.name?.split(" ")[1] || "Unknown", given: [item.name?.split(" ")[0] || "Unknown"] }],
          gender: item.gender,
          birthDate: item.birthDate,
        };
      case "Observation":
        return {
          status: "final",
          code: { coding: [{ system: "http://loinc.org", code: item.code, display: item.display }] },
          subject: { reference: `Patient/${item.patientId}` },
          effectiveDateTime: item.date,
          valueQuantity: { value: item.value, unit: item.unit },
        };
      case "Condition":
        return {
          clinicalStatus: { coding: [{ code: item.status }] },
          code: { coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: item.code, display: item.display }] },
          subject: { reference: `Patient/${item.patientId}` },
          onsetDateTime: item.onsetDate,
        };
      default:
        return item;
    }
  }

  private toFHIRXML(resources: Record<string, unknown[]>): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<Bundle xmlns="http://hl7.org/fhir">\n';
    xml += `  <id value="${randomUUID()}"/>\n`;
    xml += '  <type value="collection"/>\n';
    xml += `  <timestamp value="${new Date().toISOString()}"/>\n`;

    for (const [type, items] of Object.entries(resources)) {
      for (const item of items as any[]) {
        xml += "  <entry>\n";
        xml += `    <fullUrl value="urn:uuid:${item.id}"/>\n`;
        xml += "    <resource>\n";
        xml += `      <${type}>\n`;
        xml += `        <id value="${item.id}"/>\n`;
        if (item.name) xml += `        <name><text value="${item.name}"/></name>\n`;
        if (item.display) xml += `        <code><text value="${item.display}"/></code>\n`;
        xml += `      </${type}>\n`;
        xml += "    </resource>\n";
        xml += "  </entry>\n";
      }
    }
    xml += "</Bundle>";
    return xml;
  }

  private toCSV(resources: Record<string, unknown[]>): string {
    let csv = "";
    for (const [type, items] of Object.entries(resources)) {
      if (items.length === 0) continue;
      csv += `# ${type}\n`;
      const headers = Object.keys(items[0] as any);
      csv += headers.join(",") + "\n";
      for (const item of items as any[]) {
        csv += headers.map((h) => `"${String(item[h] || "").replace(/"/g, '""')}"`).join(",") + "\n";
      }
      csv += "\n";
    }
    return csv;
  }

  private toHL7v2(resources: Record<string, unknown[]>): string {
    let hl7 = "";
    const timestamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 14);
    hl7 += `MSH|^~\\&|TABULA_MEDICA|FACILITY|EXPORT|DEST|${timestamp}||ORU^R01|${randomUUID().slice(0, 8)}|P|2.5.1\n`;

    const patients = (resources["Patient"] as any[]) || [];
    for (const patient of patients) {
      const nameParts = (patient.name || "Unknown Patient").split(" ");
      hl7 += `PID|1||${patient.id}^^^TABULA||${nameParts[1] || "UNKNOWN"}^${nameParts[0] || "UNKNOWN"}||${patient.birthDate?.replace(/-/g, "") || ""}|${patient.gender?.[0]?.toUpperCase() || "U"}\n`;
    }

    const observations = (resources["Observation"] as any[]) || [];
    for (const obs of observations) {
      hl7 += `OBX|1|NM|${obs.code}^${obs.display}^LN||${obs.value}|${obs.unit}|||F|||${obs.date?.replace(/-/g, "")}\n`;
    }

    return hl7;
  }

  private toNDJSON(resources: Record<string, unknown[]>): string {
    const lines: string[] = [];
    for (const [type, items] of Object.entries(resources)) {
      for (const item of items as any[]) {
        lines.push(JSON.stringify({ resourceType: type, ...item }));
      }
    }
    return lines.join("\n");
  }

  async getAIExportSuggestions(userId: string, context?: { recentConditions?: string[]; purpose?: string }): Promise<ExportSuggestion[]> {
    console.log(`[HIPAA-AUDIT][FHIRExport] AI suggestions requested: user=${userId}`);

    if (!this.openai) {
      return this.getDefaultSuggestions();
    }

    try {
      const prompt = `You are a healthcare data expert. Generate 4-5 FHIR data export suggestions for a patient or healthcare organization.
      
${context?.purpose ? `Export purpose: ${context.purpose}` : ""}
${context?.recentConditions?.length ? `Recent conditions: ${context.recentConditions.join(", ")}` : ""}

Return a JSON array of export suggestions. Each suggestion should have:
- name: Short descriptive name
- description: 1-2 sentence description
- useCase: The scenario this export serves (e.g., "care_transition", "insurance_claim", "research", "patient_portal", "provider_referral")
- resourceTypes: Array of FHIR resource types to include (from: Patient, Observation, Condition, MedicationRequest, Procedure, Immunization, AllergyIntolerance, DiagnosticReport, Encounter, DocumentReference, CarePlan, Coverage, Claim)
- suggestedFormat: One of "fhir_json", "csv", "hl7v2", "ndjson"
- priority: "high", "medium", or "low"
- estimatedRecords: Approximate number of records
- rationale: Why this export is useful

Return ONLY valid JSON array, no markdown.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1500,
      });

      const content = response.choices[0]?.message?.content || "[]";
      const cleanContent = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const suggestions = JSON.parse(cleanContent);

      return suggestions.map((s: any, i: number) => ({
        id: `suggestion-${i + 1}`,
        name: s.name,
        description: s.description,
        useCase: s.useCase,
        resourceTypes: s.resourceTypes,
        suggestedFormat: s.suggestedFormat,
        filters: {},
        priority: s.priority,
        estimatedRecords: s.estimatedRecords,
        rationale: s.rationale,
      }));
    } catch (error) {
      console.error("[FHIRExport] AI suggestion error:", error);
      return this.getDefaultSuggestions();
    }
  }

  private getDefaultSuggestions(): ExportSuggestion[] {
    return [
      {
        id: "suggestion-1",
        name: "Complete Health Summary",
        description: "Export all patient data including conditions, medications, and recent observations",
        useCase: "care_transition",
        resourceTypes: ["Patient", "Condition", "MedicationRequest", "Observation", "AllergyIntolerance"],
        suggestedFormat: "fhir_json",
        filters: {},
        priority: "high",
        estimatedRecords: 50,
        rationale: "Essential for care transitions and referrals to new providers",
      },
      {
        id: "suggestion-2",
        name: "Insurance Claims Package",
        description: "Export claims, coverage, and encounter data for insurance purposes",
        useCase: "insurance_claim",
        resourceTypes: ["Coverage", "Claim", "Encounter", "Procedure", "DiagnosticReport"],
        suggestedFormat: "csv",
        filters: {},
        priority: "medium",
        estimatedRecords: 30,
        rationale: "Supports insurance claims processing and coverage verification",
      },
      {
        id: "suggestion-3",
        name: "Lab Results Export",
        description: "Export all diagnostic reports and observations for lab tracking",
        useCase: "patient_portal",
        resourceTypes: ["Observation", "DiagnosticReport"],
        suggestedFormat: "csv",
        filters: {},
        priority: "medium",
        estimatedRecords: 25,
        rationale: "Allows patients to track lab results over time",
      },
      {
        id: "suggestion-4",
        name: "Medication History",
        description: "Complete medication list with prescriptions and allergies",
        useCase: "provider_referral",
        resourceTypes: ["MedicationRequest", "AllergyIntolerance"],
        suggestedFormat: "fhir_json",
        filters: {},
        priority: "high",
        estimatedRecords: 20,
        rationale: "Critical for medication reconciliation and avoiding adverse reactions",
      },
      {
        id: "suggestion-5",
        name: "Research Dataset",
        description: "De-identified observations and conditions for research analysis",
        useCase: "research",
        resourceTypes: ["Observation", "Condition", "Procedure"],
        suggestedFormat: "ndjson",
        filters: {},
        priority: "low",
        estimatedRecords: 100,
        rationale: "Supports population health research with privacy-preserving data",
      },
    ];
  }

  async getSupportedFormats(): Promise<Array<{ format: ExportFormat; name: string; description: string; mimeType: string }>> {
    return [
      { format: "fhir_json", name: "FHIR Bundle (JSON)", description: "Standard FHIR R4 Bundle in JSON format", mimeType: "application/fhir+json" },
      { format: "fhir_xml", name: "FHIR Bundle (XML)", description: "Standard FHIR R4 Bundle in XML format", mimeType: "application/fhir+xml" },
      { format: "csv", name: "CSV (Spreadsheet)", description: "Comma-separated values for spreadsheet applications", mimeType: "text/csv" },
      { format: "hl7v2", name: "HL7 v2.x", description: "Legacy HL7 v2.x message format for older systems", mimeType: "text/plain" },
      { format: "ndjson", name: "NDJSON (Bulk)", description: "Newline-delimited JSON for bulk data processing", mimeType: "application/ndjson" },
    ];
  }

  async getSupportedResourceTypes(): Promise<Array<{ type: FHIRResourceType; displayName: string; category: string }>> {
    return [
      { type: "Patient", displayName: "Patient Demographics", category: "Administrative" },
      { type: "Observation", displayName: "Observations & Vitals", category: "Clinical" },
      { type: "Condition", displayName: "Conditions & Diagnoses", category: "Clinical" },
      { type: "MedicationRequest", displayName: "Medications", category: "Clinical" },
      { type: "Procedure", displayName: "Procedures", category: "Clinical" },
      { type: "Immunization", displayName: "Immunizations", category: "Clinical" },
      { type: "AllergyIntolerance", displayName: "Allergies", category: "Clinical" },
      { type: "DiagnosticReport", displayName: "Lab & Diagnostic Reports", category: "Clinical" },
      { type: "Encounter", displayName: "Encounters & Visits", category: "Clinical" },
      { type: "DocumentReference", displayName: "Documents", category: "Clinical" },
      { type: "CarePlan", displayName: "Care Plans", category: "Care Management" },
      { type: "CareTeam", displayName: "Care Teams", category: "Care Management" },
      { type: "Goal", displayName: "Health Goals", category: "Care Management" },
      { type: "Coverage", displayName: "Insurance Coverage", category: "Financial" },
      { type: "Claim", displayName: "Claims", category: "Financial" },
      { type: "ExplanationOfBenefit", displayName: "Explanation of Benefits", category: "Financial" },
    ];
  }
}

export const fhirExportService = new FHIRExportService();
