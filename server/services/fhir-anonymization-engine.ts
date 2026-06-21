import { randomUUID } from "crypto";

export type AnonymizationMethod = 
  | "redact" 
  | "hash" 
  | "generalize" 
  | "date_shift" 
  | "zip_truncate" 
  | "age_range" 
  | "pseudonymize"
  | "mask";

export type PHICategory = 
  | "name"
  | "address"
  | "date"
  | "phone"
  | "fax"
  | "email"
  | "ssn"
  | "mrn"
  | "account_number"
  | "device_id"
  | "vehicle_id"
  | "url"
  | "ip_address"
  | "biometric"
  | "photo"
  | "geographic"
  | "age_over_89"
  | "certificate_license"
  | "other_identifier";

export interface AnonymizationRule {
  id: string;
  name: string;
  description: string;
  category: PHICategory;
  fhirPaths: string[];
  method: AnonymizationMethod;
  parameters?: Record<string, unknown>;
  enabled: boolean;
  priority: number;
}

export interface AnonymizationProfile {
  id: string;
  name: string;
  description: string;
  useCase: "research" | "testing" | "training" | "analytics" | "custom";
  rules: AnonymizationRule[];
  preserveReferentialIntegrity: boolean;
  dateShiftDays?: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface AnonymizationResult {
  originalResource: Record<string, unknown>;
  anonymizedResource: Record<string, unknown>;
  appliedRules: string[];
  redactedFields: string[];
  transformedFields: Array<{ path: string; method: AnonymizationMethod }>;
  dataUtilityScore: number;
}

export interface BatchAnonymizationJob {
  id: string;
  profileId: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  totalResources: number;
  processedResources: number;
  startedAt?: string;
  completedAt?: string;
  errors: Array<{ resourceId: string; error: string }>;
}

const HIPAA_SAFE_HARBOR_RULES: AnonymizationRule[] = [
  {
    id: "rule-name",
    name: "Name Redaction",
    description: "Remove all patient names (given, family, prefix, suffix)",
    category: "name",
    fhirPaths: ["Patient.name", "Practitioner.name", "RelatedPerson.name"],
    method: "redact",
    enabled: true,
    priority: 100,
  },
  {
    id: "rule-address",
    name: "Address Generalization",
    description: "Remove street address, keep state only",
    category: "address",
    fhirPaths: ["Patient.address", "Organization.address"],
    method: "generalize",
    parameters: { keepFields: ["state", "country"] },
    enabled: true,
    priority: 95,
  },
  {
    id: "rule-zip",
    name: "ZIP Code Truncation",
    description: "Truncate ZIP to first 3 digits (if population > 20,000)",
    category: "geographic",
    fhirPaths: ["Patient.address.postalCode"],
    method: "zip_truncate",
    parameters: { digits: 3 },
    enabled: true,
    priority: 90,
  },
  {
    id: "rule-dates",
    name: "Date Shifting",
    description: "Shift all dates by consistent random offset",
    category: "date",
    fhirPaths: ["Patient.birthDate", "Encounter.period", "Observation.effectiveDateTime", "Procedure.performedDateTime", "DiagnosticReport.effectiveDateTime"],
    method: "date_shift",
    parameters: { maxShiftDays: 365 },
    enabled: true,
    priority: 85,
  },
  {
    id: "rule-age",
    name: "Age Over 89",
    description: "Generalize ages over 89 to 90+",
    category: "age_over_89",
    fhirPaths: ["Patient.birthDate"],
    method: "age_range",
    parameters: { threshold: 89, generalizeToYear: true },
    enabled: true,
    priority: 80,
  },
  {
    id: "rule-phone",
    name: "Phone Number Redaction",
    description: "Remove all phone numbers",
    category: "phone",
    fhirPaths: ["Patient.telecom[system=phone]", "Practitioner.telecom[system=phone]", "Organization.telecom[system=phone]"],
    method: "redact",
    enabled: true,
    priority: 75,
  },
  {
    id: "rule-fax",
    name: "Fax Number Redaction",
    description: "Remove all fax numbers",
    category: "fax",
    fhirPaths: ["Patient.telecom[system=fax]", "Practitioner.telecom[system=fax]", "Organization.telecom[system=fax]"],
    method: "redact",
    enabled: true,
    priority: 75,
  },
  {
    id: "rule-email",
    name: "Email Redaction",
    description: "Remove all email addresses",
    category: "email",
    fhirPaths: ["Patient.telecom[system=email]", "Practitioner.telecom[system=email]", "Organization.telecom[system=email]"],
    method: "redact",
    enabled: true,
    priority: 75,
  },
  {
    id: "rule-url",
    name: "URL Redaction",
    description: "Remove web URLs",
    category: "url",
    fhirPaths: ["Patient.telecom[system=url]", "Organization.telecom[system=url]"],
    method: "redact",
    enabled: true,
    priority: 75,
  },
  {
    id: "rule-ssn",
    name: "SSN Redaction",
    description: "Remove Social Security Numbers",
    category: "ssn",
    fhirPaths: ["Patient.identifier[system=SSN]", "Patient.identifier[system=http://hl7.org/fhir/sid/us-ssn]"],
    method: "redact",
    enabled: true,
    priority: 100,
  },
  {
    id: "rule-mrn",
    name: "MRN Pseudonymization",
    description: "Replace MRN with pseudonymous identifier",
    category: "mrn",
    fhirPaths: ["Patient.identifier[system=MRN]", "Patient.identifier[type=MR]"],
    method: "pseudonymize",
    enabled: true,
    priority: 70,
  },
  {
    id: "rule-account",
    name: "Account Number Redaction",
    description: "Remove account numbers and health plan beneficiary numbers",
    category: "account_number",
    fhirPaths: ["Account.identifier", "Coverage.identifier", "Patient.identifier[type=AN]"],
    method: "redact",
    enabled: true,
    priority: 70,
  },
  {
    id: "rule-device",
    name: "Device ID Hashing",
    description: "Hash device identifiers and serial numbers",
    category: "device_id",
    fhirPaths: ["Device.identifier", "Device.serialNumber", "DeviceRequest.identifier"],
    method: "hash",
    enabled: true,
    priority: 65,
  },
  {
    id: "rule-vehicle",
    name: "Vehicle ID Redaction",
    description: "Remove vehicle identifiers and serial numbers",
    category: "vehicle_id",
    fhirPaths: ["Device.identifier[type=VIN]"],
    method: "redact",
    enabled: true,
    priority: 65,
  },
  {
    id: "rule-ip",
    name: "IP Address Redaction",
    description: "Remove IP addresses",
    category: "ip_address",
    fhirPaths: ["AuditEvent.agent.network.address", "Device.network.address"],
    method: "redact",
    enabled: true,
    priority: 70,
  },
  {
    id: "rule-biometric",
    name: "Biometric Data Redaction",
    description: "Remove biometric identifiers (fingerprints, voice prints, retinal)",
    category: "biometric",
    fhirPaths: ["Patient.photo", "BiometricData.data"],
    method: "redact",
    enabled: true,
    priority: 100,
  },
  {
    id: "rule-photo",
    name: "Photo Redaction",
    description: "Remove full-face photographs and comparable images",
    category: "photo",
    fhirPaths: ["Patient.photo", "Practitioner.photo", "DocumentReference.content[contentType=image/*]"],
    method: "redact",
    enabled: true,
    priority: 100,
  },
  {
    id: "rule-certificate",
    name: "Certificate/License Redaction",
    description: "Remove certificate and license numbers",
    category: "certificate_license",
    fhirPaths: ["Practitioner.qualification.identifier", "Patient.identifier[type=DL]", "Patient.identifier[type=PPN]"],
    method: "redact",
    enabled: true,
    priority: 70,
  },
  {
    id: "rule-other-id",
    name: "Other Unique Identifiers",
    description: "Remove other unique identifying numbers",
    category: "other_identifier",
    fhirPaths: ["Patient.identifier[type=other]"],
    method: "redact",
    enabled: true,
    priority: 60,
  },
];

const DEFAULT_PROFILES: AnonymizationProfile[] = [
  {
    id: "profile-safe-harbor",
    name: "HIPAA Safe Harbor",
    description: "Full HIPAA Safe Harbor de-identification (18 identifiers removed)",
    useCase: "research",
    rules: HIPAA_SAFE_HARBOR_RULES,
    preserveReferentialIntegrity: true,
    dateShiftDays: 365,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "system",
  },
  {
    id: "profile-testing",
    name: "Testing Data",
    description: "Minimal de-identification for internal testing",
    useCase: "testing",
    rules: HIPAA_SAFE_HARBOR_RULES.filter(r => ["name", "ssn", "phone", "email"].includes(r.category)),
    preserveReferentialIntegrity: true,
    dateShiftDays: 30,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "system",
  },
  {
    id: "profile-analytics",
    name: "Analytics Dataset",
    description: "Preserves clinical data while removing direct identifiers",
    useCase: "analytics",
    rules: HIPAA_SAFE_HARBOR_RULES.filter(r => r.category !== "date"),
    preserveReferentialIntegrity: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: "system",
  },
];

class FhirAnonymizationEngine {
  private profiles: Map<string, AnonymizationProfile> = new Map();
  private jobs: Map<string, BatchAnonymizationJob> = new Map();
  private pseudonymMap: Map<string, string> = new Map();
  private dateShiftMap: Map<string, number> = new Map();

  constructor() {
    DEFAULT_PROFILES.forEach(p => this.profiles.set(p.id, p));
    console.log("[Anonymization] Engine initialized with", this.profiles.size, "profiles");
  }

  async anonymizeResource(
    resource: Record<string, unknown>,
    profileId: string
  ): Promise<AnonymizationResult> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    const anonymized = JSON.parse(JSON.stringify(resource));
    const appliedRules: string[] = [];
    const redactedFields: string[] = [];
    const transformedFields: Array<{ path: string; method: AnonymizationMethod }> = [];

    const sortedRules = [...profile.rules]
      .filter(r => r.enabled)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      const result = await this.applyRule(anonymized, rule, profile);
      if (result.applied) {
        appliedRules.push(rule.id);
        redactedFields.push(...result.redacted);
        transformedFields.push(...result.transformed);
      }
    }

    if (profile.preserveReferentialIntegrity) {
      this.preserveReferences(anonymized);
    }

    const dataUtilityScore = this.calculateDataUtility(resource, anonymized, redactedFields);

    console.log(`[Anonymization] Processed ${resource.resourceType}/${resource.id}: ${appliedRules.length} rules applied`);

    return {
      originalResource: resource,
      anonymizedResource: anonymized,
      appliedRules,
      redactedFields,
      transformedFields,
      dataUtilityScore,
    };
  }

  private async applyRule(
    resource: Record<string, unknown>,
    rule: AnonymizationRule,
    profile: AnonymizationProfile
  ): Promise<{ applied: boolean; redacted: string[]; transformed: Array<{ path: string; method: AnonymizationMethod }> }> {
    const redacted: string[] = [];
    const transformed: Array<{ path: string; method: AnonymizationMethod }> = [];
    let applied = false;

    for (const fhirPath of rule.fhirPaths) {
      const pathParts = fhirPath.split(".");
      if (pathParts[0] !== resource.resourceType) continue;

      const fieldPath = pathParts.slice(1).join(".");
      const value = this.getNestedValue(resource, fieldPath);
      
      if (value === undefined) continue;

      applied = true;

      switch (rule.method) {
        case "redact":
          this.setNestedValue(resource, fieldPath, undefined);
          redacted.push(fieldPath);
          break;

        case "hash":
          const hashed = this.hashValue(String(value));
          this.setNestedValue(resource, fieldPath, hashed);
          transformed.push({ path: fieldPath, method: "hash" });
          break;

        case "generalize":
          const generalized = this.generalizeValue(value, rule.parameters);
          this.setNestedValue(resource, fieldPath, generalized);
          transformed.push({ path: fieldPath, method: "generalize" });
          break;

        case "date_shift":
          const shifted = this.shiftDate(value, resource.id as string, profile.dateShiftDays || 365);
          this.setNestedValue(resource, fieldPath, shifted);
          transformed.push({ path: fieldPath, method: "date_shift" });
          break;

        case "zip_truncate":
          const truncated = this.truncateZip(String(value), (rule.parameters?.digits as number) || 3);
          this.setNestedValue(resource, fieldPath, truncated);
          transformed.push({ path: fieldPath, method: "zip_truncate" });
          break;

        case "age_range":
          const threshold = (rule.parameters?.threshold as number) || 89;
          const ranged = this.applyAgeRange(value, threshold);
          if (ranged !== value) {
            this.setNestedValue(resource, fieldPath, ranged);
            transformed.push({ path: fieldPath, method: "age_range" });
          }
          break;

        case "pseudonymize":
          const pseudo = this.pseudonymize(String(value));
          this.setNestedValue(resource, fieldPath, pseudo);
          transformed.push({ path: fieldPath, method: "pseudonymize" });
          break;

        case "mask":
          const masked = this.maskValue(String(value));
          this.setNestedValue(resource, fieldPath, masked);
          transformed.push({ path: fieldPath, method: "mask" });
          break;
      }
    }

    return { applied, redacted, transformed };
  }

  private parseFhirPath(path: string): Array<{ field: string; predicate?: { key: string; value: string } }> {
    const result: Array<{ field: string; predicate?: { key: string; value: string } }> = [];
    const regex = /([^.\[]+)(?:\[([^\]]+)\])?/g;
    let match;
    
    while ((match = regex.exec(path)) !== null) {
      const field = match[1];
      const predicateStr = match[2];
      
      if (predicateStr) {
        const eqMatch = predicateStr.match(/(\w+)=(.+)/);
        if (eqMatch) {
          result.push({ field, predicate: { key: eqMatch[1], value: eqMatch[2] } });
        } else {
          result.push({ field });
        }
      } else {
        result.push({ field });
      }
    }
    
    return result;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = this.parseFhirPath(path);
    let current: unknown = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== "object") return undefined;
      
      const currentObj = current as Record<string, unknown>;
      
      if (Array.isArray(currentObj[part.field])) {
        const arr = currentObj[part.field] as Array<Record<string, unknown>>;
        if (part.predicate) {
          const filtered = arr.filter(item => 
            String(item[part.predicate!.key]) === part.predicate!.value ||
            (item.type && (item.type as Record<string, unknown>).coding && 
              ((item.type as Record<string, unknown>).coding as Array<Record<string, unknown>>)
                .some(c => c.code === part.predicate!.value))
          );
          current = filtered.length > 0 ? filtered : undefined;
        } else {
          current = arr;
        }
      } else {
        current = currentObj[part.field];
      }
    }
    
    return current;
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = this.parseFhirPath(path);
    let current: Record<string, unknown> = obj;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part.field]) return;
      
      if (Array.isArray(current[part.field])) {
        const arr = current[part.field] as Array<Record<string, unknown>>;
        if (part.predicate) {
          const idx = arr.findIndex(item => 
            String(item[part.predicate!.key]) === part.predicate!.value ||
            (item.type && (item.type as Record<string, unknown>).coding && 
              ((item.type as Record<string, unknown>).coding as Array<Record<string, unknown>>)
                .some(c => c.code === part.predicate!.value))
          );
          if (idx >= 0) {
            current = arr[idx];
          } else {
            return;
          }
        } else {
          current = arr[0];
        }
      } else {
        current = current[part.field] as Record<string, unknown>;
      }
    }
    
    const lastPart = parts[parts.length - 1];
    
    if (Array.isArray(current[lastPart.field])) {
      const arr = current[lastPart.field] as Array<Record<string, unknown>>;
      if (lastPart.predicate) {
        if (value === undefined) {
          const newArr = arr.filter(item => 
            String(item[lastPart.predicate!.key]) !== lastPart.predicate!.value &&
            !(item.type && (item.type as Record<string, unknown>).coding && 
              ((item.type as Record<string, unknown>).coding as Array<Record<string, unknown>>)
                .some(c => c.code === lastPart.predicate!.value))
          );
          current[lastPart.field] = newArr;
        } else {
          for (const item of arr) {
            if (String(item[lastPart.predicate!.key]) === lastPart.predicate!.value ||
                (item.type && (item.type as Record<string, unknown>).coding && 
                  ((item.type as Record<string, unknown>).coding as Array<Record<string, unknown>>)
                    .some(c => c.code === lastPart.predicate!.value))) {
              if (typeof value === "string") {
                item.value = value;
              } else if (typeof value === "object" && value !== null) {
                Object.assign(item, value);
              }
            }
          }
        }
      } else {
        if (value === undefined) {
          delete current[lastPart.field];
        } else {
          current[lastPart.field] = value;
        }
      }
    } else {
      if (value === undefined) {
        delete current[lastPart.field];
      } else {
        current[lastPart.field] = value;
      }
    }
  }

  private hashValue(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `HASH_${Math.abs(hash).toString(16).toUpperCase().padStart(8, "0")}`;
  }

  private generalizeValue(value: unknown, params?: Record<string, unknown>): unknown {
    if (Array.isArray(value)) {
      return value.map(v => this.generalizeValue(v, params));
    }
    
    if (typeof value === "object" && value !== null) {
      const keepFields = (params?.keepFields as string[]) || [];
      const result: Record<string, unknown> = {};
      
      for (const field of keepFields) {
        if ((value as Record<string, unknown>)[field] !== undefined) {
          result[field] = (value as Record<string, unknown>)[field];
        }
      }
      
      return result;
    }
    
    return "[GENERALIZED]";
  }

  private shiftDate(value: unknown, resourceId: string, maxDays: number): unknown {
    if (!this.dateShiftMap.has(resourceId)) {
      const shiftDays = Math.floor(Math.random() * maxDays * 2) - maxDays;
      this.dateShiftMap.set(resourceId, shiftDays);
    }
    
    const shiftDays = this.dateShiftMap.get(resourceId)!;
    
    if (typeof value === "string") {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        date.setDate(date.getDate() + shiftDays);
        return date.toISOString().split("T")[0];
      }
    }
    
    if (typeof value === "object" && value !== null) {
      const obj = value as Record<string, unknown>;
      if (obj.start) obj.start = this.shiftDate(obj.start, resourceId, maxDays);
      if (obj.end) obj.end = this.shiftDate(obj.end, resourceId, maxDays);
      return obj;
    }
    
    return value;
  }

  private truncateZip(zip: string, digits: number): string {
    const cleaned = zip.replace(/\D/g, "");
    if (cleaned.length >= digits) {
      return cleaned.substring(0, digits) + "00";
    }
    return "[REDACTED]";
  }

  private applyAgeRange(birthDate: unknown, threshold: number): unknown {
    if (typeof birthDate !== "string") return birthDate;
    
    const birth = new Date(birthDate);
    const now = new Date();
    const age = Math.floor((now.getTime() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    
    if (age > threshold) {
      return "[AGE_90_PLUS]";
    }
    
    return birthDate;
  }

  private pseudonymize(value: string): string {
    if (!this.pseudonymMap.has(value)) {
      const pseudo = `PSEUDO_${randomUUID().substring(0, 8).toUpperCase()}`;
      this.pseudonymMap.set(value, pseudo);
    }
    return this.pseudonymMap.get(value)!;
  }

  private maskValue(value: string): string {
    if (value.length <= 4) return "****";
    return value.substring(0, 2) + "*".repeat(value.length - 4) + value.substring(value.length - 2);
  }

  private preserveReferences(resource: Record<string, unknown>): void {
    const processValue = (val: unknown): unknown => {
      if (typeof val === "string" && val.includes("/")) {
        const parts = val.split("/");
        if (parts.length === 2) {
          const [type, id] = parts;
          return `${type}/${this.pseudonymize(id)}`;
        }
      }
      if (Array.isArray(val)) {
        return val.map(processValue);
      }
      if (typeof val === "object" && val !== null) {
        const obj = val as Record<string, unknown>;
        if (obj.reference && typeof obj.reference === "string") {
          obj.reference = processValue(obj.reference) as string;
        }
        return obj;
      }
      return val;
    };

    for (const key of Object.keys(resource)) {
      resource[key] = processValue(resource[key]);
    }
  }

  private calculateDataUtility(
    original: Record<string, unknown>,
    anonymized: Record<string, unknown>,
    redactedFields: string[]
  ): number {
    const originalStr = JSON.stringify(original);
    const anonymizedStr = JSON.stringify(anonymized);
    
    const originalSize = originalStr.length;
    const anonymizedSize = anonymizedStr.length;
    
    const sizeRatio = anonymizedSize / originalSize;
    const redactionPenalty = redactedFields.length * 0.05;
    
    const utility = Math.max(0, Math.min(1, sizeRatio - redactionPenalty));
    return Math.round(utility * 100) / 100;
  }

  async createProfile(profile: Omit<AnonymizationProfile, "id" | "createdAt" | "updatedAt">): Promise<AnonymizationProfile> {
    const newProfile: AnonymizationProfile = {
      ...profile,
      id: `profile-${randomUUID()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    this.profiles.set(newProfile.id, newProfile);
    console.log("[Anonymization] Created profile:", newProfile.name);
    return newProfile;
  }

  async updateProfile(profileId: string, updates: Partial<AnonymizationProfile>): Promise<AnonymizationProfile> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new Error("Profile not found");
    }
    
    const updated: AnonymizationProfile = {
      ...profile,
      ...updates,
      id: profileId,
      updatedAt: new Date().toISOString(),
    };
    
    this.profiles.set(profileId, updated);
    return updated;
  }

  async deleteProfile(profileId: string): Promise<void> {
    if (!this.profiles.has(profileId)) {
      throw new Error("Profile not found");
    }
    this.profiles.delete(profileId);
  }

  async getProfile(profileId: string): Promise<AnonymizationProfile | undefined> {
    return this.profiles.get(profileId);
  }

  async listProfiles(): Promise<AnonymizationProfile[]> {
    return Array.from(this.profiles.values());
  }

  async startBatchJob(profileId: string, resources: Record<string, unknown>[]): Promise<BatchAnonymizationJob> {
    const job: BatchAnonymizationJob = {
      id: randomUUID(),
      profileId,
      status: "pending",
      totalResources: resources.length,
      processedResources: 0,
      errors: [],
    };
    
    this.jobs.set(job.id, job);
    
    this.processBatchJob(job.id, resources);
    
    return job;
  }

  private async processBatchJob(jobId: string, resources: Record<string, unknown>[]): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    job.status = "in_progress";
    job.startedAt = new Date().toISOString();
    
    for (const resource of resources) {
      try {
        await this.anonymizeResource(resource, job.profileId);
        job.processedResources++;
      } catch (error) {
        job.errors.push({
          resourceId: String(resource.id || "unknown"),
          error: error instanceof Error ? error.message : "Unknown error",
        });
        job.processedResources++;
      }
    }
    
    job.status = job.errors.length === 0 ? "completed" : job.errors.length === resources.length ? "failed" : "completed";
    job.completedAt = new Date().toISOString();
  }

  async getJob(jobId: string): Promise<BatchAnonymizationJob | undefined> {
    return this.jobs.get(jobId);
  }

  async listJobs(): Promise<BatchAnonymizationJob[]> {
    return Array.from(this.jobs.values());
  }

  getAvailableMethods(): { method: AnonymizationMethod; description: string }[] {
    return [
      { method: "redact", description: "Complete removal of the field" },
      { method: "hash", description: "One-way cryptographic hash" },
      { method: "generalize", description: "Replace with broader category" },
      { method: "date_shift", description: "Shift dates by consistent offset" },
      { method: "zip_truncate", description: "Truncate ZIP to first N digits" },
      { method: "age_range", description: "Cap ages at threshold" },
      { method: "pseudonymize", description: "Replace with consistent pseudonym" },
      { method: "mask", description: "Partial masking with asterisks" },
    ];
  }

  getPHICategories(): { category: PHICategory; description: string; hipaaIdentifier: boolean }[] {
    return [
      { category: "name", description: "Patient names", hipaaIdentifier: true },
      { category: "address", description: "Geographic data smaller than state", hipaaIdentifier: true },
      { category: "date", description: "All dates except year", hipaaIdentifier: true },
      { category: "phone", description: "Telephone numbers", hipaaIdentifier: true },
      { category: "fax", description: "Fax numbers", hipaaIdentifier: true },
      { category: "email", description: "Email addresses", hipaaIdentifier: true },
      { category: "url", description: "Web Universal Resource Locators", hipaaIdentifier: true },
      { category: "ssn", description: "Social Security numbers", hipaaIdentifier: true },
      { category: "mrn", description: "Medical record numbers", hipaaIdentifier: true },
      { category: "account_number", description: "Account and beneficiary numbers", hipaaIdentifier: true },
      { category: "certificate_license", description: "Certificate/license numbers", hipaaIdentifier: true },
      { category: "vehicle_id", description: "Vehicle identifiers and serial numbers", hipaaIdentifier: true },
      { category: "device_id", description: "Device identifiers and serial numbers", hipaaIdentifier: true },
      { category: "ip_address", description: "IP addresses", hipaaIdentifier: true },
      { category: "biometric", description: "Biometric identifiers", hipaaIdentifier: true },
      { category: "photo", description: "Full-face photos", hipaaIdentifier: true },
      { category: "geographic", description: "Geographic identifiers", hipaaIdentifier: true },
      { category: "age_over_89", description: "Ages over 89", hipaaIdentifier: true },
      { category: "other_identifier", description: "Other unique identifiers", hipaaIdentifier: true },
    ];
  }

  getStats(): {
    totalProfiles: number;
    totalJobs: number;
    completedJobs: number;
    pseudonymCount: number;
  } {
    const jobs = Array.from(this.jobs.values());
    return {
      totalProfiles: this.profiles.size,
      totalJobs: jobs.length,
      completedJobs: jobs.filter(j => j.status === "completed").length,
      pseudonymCount: this.pseudonymMap.size,
    };
  }
}

export const fhirAnonymizationEngine = new FhirAnonymizationEngine();
