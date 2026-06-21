import crypto from "crypto";

export interface SanitizationResult {
  sanitizedData: Record<string, unknown>;
  fieldsRemoved: string[];
  fieldsMasked: string[];
  piiDetected: string[];
  auditHash: string;
}

const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const PHONE_PATTERN = /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const MRN_PATTERN = /\b(MRN|mrn|Medical Record Number)[:\s]*[A-Z0-9-]+\b/gi;
const DATE_OF_BIRTH_PATTERN = /\b(DOB|Date of Birth|Birth Date|born on)[:\s]*\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b/gi;
const ADDRESS_PATTERN = /\b\d{1,5}\s+[\w\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Road|Rd|Way|Court|Ct|Place|Pl)\b\.?/gi;

const PII_FIELDS = new Set([
  "fullName", "name", "patientName", "firstName", "lastName", "middleName",
  "ssn", "socialSecurityNumber", "socialSecurity",
  "dateOfBirth", "dob", "birthDate", "birthdate",
  "address", "streetAddress", "homeAddress", "mailingAddress",
  "email", "emailAddress",
  "phone", "phoneNumber", "cellPhone", "homePhone", "workPhone",
  "mrn", "medicalRecordNumber",
  "insuranceId", "policyNumber", "subscriberId", "memberId",
  "driversLicense", "passport", "nationalId",
]);

const SAFE_TO_PASS_FIELDS = new Set([
  "conditions", "medications", "allergies", "labResults", "vitalSigns",
  "symptoms", "procedures", "diagnoses", "immunizations",
  "labFlags", "medicationCount", "allergyCount", "age", "ageRange",
  "visitType", "chiefComplaint", "assessmentNotes",
]);

function computeAuditHash(data: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 16);
}

function ageFromDob(dob: string): number {
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return 0;
  return Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function ageRange(age: number): string {
  if (age < 1) return "infant";
  if (age <= 3) return "toddler";
  if (age <= 12) return "child";
  if (age <= 17) return "adolescent";
  if (age <= 25) return "young adult";
  if (age <= 39) return "adult 26-39";
  if (age <= 54) return "adult 40-54";
  if (age <= 64) return "adult 55-64";
  if (age <= 74) return "senior 65-74";
  return "senior 75+";
}

function scrubFreeText(text: string): { cleaned: string; detections: string[] } {
  const detections: string[] = [];
  let cleaned = text;

  const patterns: Array<[RegExp, string, string]> = [
    [/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED-SSN]", "SSN"],
    [/\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[REDACTED-PHONE]", "phone"],
    [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[REDACTED-EMAIL]", "email"],
    [/\b(MRN|mrn|Medical Record Number)[:\s]*[A-Z0-9-]+\b/gi, "[REDACTED-MRN]", "MRN"],
    [/\b(DOB|Date of Birth|Birth Date|born on)[:\s]*\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b/gi, "[REDACTED-DOB]", "DOB-in-text"],
    [/\b\d{1,5}\s+[\w\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Lane|Ln|Road|Rd|Way|Court|Ct|Place|Pl)\b\.?/gi, "[REDACTED-ADDRESS]", "address"],
  ];

  for (const [pattern, replacement, label] of patterns) {
    if (pattern.test(cleaned)) {
      detections.push(label);
      pattern.lastIndex = 0;
      cleaned = cleaned.replace(pattern, replacement);
    }
  }

  return { cleaned, detections };
}

export function sanitizeForAI(
  data: Record<string, unknown>,
  options?: { allowFields?: string[]; convertDobToAge?: boolean }
): SanitizationResult {
  const fieldsRemoved: string[] = [];
  const fieldsMasked: string[] = [];
  const piiDetected: string[] = [];
  const sanitized: Record<string, unknown> = {};
  const convertDob = options?.convertDobToAge !== false;
  const allowSet = options?.allowFields ? new Set(options.allowFields) : null;

  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase();

    if (PII_FIELDS.has(key) || PII_FIELDS.has(keyLower)) {
      if ((keyLower === "dateofbirth" || keyLower === "dob" || keyLower === "birthdate") && convertDob && typeof value === "string") {
        const age = ageFromDob(value);
        if (age > 0) {
          sanitized["age"] = age;
          sanitized["ageRange"] = ageRange(age);
          fieldsMasked.push(key);
          piiDetected.push(`${key} → converted to age/ageRange`);
        } else {
          fieldsRemoved.push(key);
          piiDetected.push(`${key} → removed (invalid date)`);
        }
        continue;
      }

      if (keyLower.includes("name") && typeof value === "string") {
        fieldsRemoved.push(key);
        piiDetected.push(`${key} → removed (name field)`);
        continue;
      }

      fieldsRemoved.push(key);
      piiDetected.push(`${key} → removed (PII field)`);
      continue;
    }

    if (allowSet && !allowSet.has(key) && !SAFE_TO_PASS_FIELDS.has(key)) {
      fieldsRemoved.push(key);
      continue;
    }

    if (typeof value === "string") {
      const { cleaned, detections } = scrubFreeText(value);
      if (detections.length > 0) {
        fieldsMasked.push(key);
        piiDetected.push(...detections.map(d => `${d} found in ${key}`));
      }
      sanitized[key] = cleaned;
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => {
        if (typeof item === "string") {
          return scrubFreeText(item).cleaned;
        }
        if (typeof item === "object" && item !== null) {
          const subResult = sanitizeForAI(item as Record<string, unknown>, { convertDobToAge: convertDob });
          piiDetected.push(...subResult.piiDetected);
          fieldsMasked.push(...subResult.fieldsMasked.map(f => `${key}[].${f}`));
          fieldsRemoved.push(...subResult.fieldsRemoved.map(f => `${key}[].${f}`));
          return subResult.sanitizedData;
        }
        return item;
      });
    } else if (typeof value === "object" && value !== null) {
      const subResult = sanitizeForAI(value as Record<string, unknown>, { convertDobToAge: convertDob });
      sanitized[key] = subResult.sanitizedData;
      piiDetected.push(...subResult.piiDetected);
      fieldsMasked.push(...subResult.fieldsMasked.map(f => `${key}.${f}`));
      fieldsRemoved.push(...subResult.fieldsRemoved.map(f => `${key}.${f}`));
    } else {
      sanitized[key] = value;
    }
  }

  return {
    sanitizedData: sanitized,
    fieldsRemoved,
    fieldsMasked,
    piiDetected,
    auditHash: computeAuditHash(sanitized),
  };
}

export function sanitizePatientForSummary(patient: {
  patientId: string;
  patientName: string;
  dateOfBirth: string;
  conditions: string[];
  medications: string[] | Array<{ name: string; dose?: string; frequency?: string }>;
  allergies: string[];
  recentLabs: Array<{ name: string; value: string; date: string; status?: string }>;
  vitalSigns?: Array<{ type: string; value: string; date: string }>;
}): { sanitized: Record<string, unknown>; audit: SanitizationResult } {
  const medNames = patient.medications.map(m => typeof m === "string" ? m : m.name);
  const rawData: Record<string, unknown> = {
    patientName: patient.patientName,
    dateOfBirth: patient.dateOfBirth,
    conditions: patient.conditions,
    medicationCount: patient.medications.length,
    medicationNames: medNames,
    labFlags: patient.recentLabs
      .filter(l => l.status && l.status !== "normal")
      .map(l => ({ test: l.name, status: l.status })),
    normalLabCount: patient.recentLabs.filter(l => !l.status || l.status === "normal").length,
    abnormalLabCount: patient.recentLabs.filter(l => l.status === "abnormal" || l.status === "critical").length,
    allergyCount: patient.allergies.filter(a => !a.toLowerCase().includes("no known")).length,
    hasKnownAllergies: patient.allergies.some(a => !a.toLowerCase().includes("no known")),
  };

  if (patient.vitalSigns?.length) {
    rawData.recentVitals = patient.vitalSigns.slice(0, 5).map(v => ({
      type: v.type,
      value: v.value,
    }));
  }

  const audit = sanitizeForAI(rawData, { convertDobToAge: true });

  console.log(`[PII-Sanitizer] Patient summary sanitization complete. Fields removed: ${audit.fieldsRemoved.length}, PII detected: ${audit.piiDetected.length}, Hash: ${audit.auditHash}`);

  return { sanitized: audit.sanitizedData, audit };
}
