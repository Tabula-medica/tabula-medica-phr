const PHI_PATTERNS: Array<{ pattern: RegExp; replacement: string; name: string }> = [
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN-REDACTED]", name: "SSN" },
  { pattern: /\b\d{9}\b/g, replacement: "[SSN-REDACTED]", name: "SSN-no-dash" },
  
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "[EMAIL-REDACTED]", name: "email" },
  
  { pattern: /\b\d{10}\b/g, replacement: "[PHONE-REDACTED]", name: "phone-10digit" },
  { pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: "[PHONE-REDACTED]", name: "phone-formatted" },
  { pattern: /\+1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: "[PHONE-REDACTED]", name: "phone-intl" },
  
  { pattern: /\b(MRN|mrn)[:\s#]?\d{6,12}\b/gi, replacement: "[MRN-REDACTED]", name: "MRN" },
  { pattern: /\bpatient[-_]?id[:\s#]?[a-zA-Z0-9-]{8,}\b/gi, replacement: "[PATIENT-ID-REDACTED]", name: "patient-id" },
  
  { pattern: /\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/g, replacement: "[DATE-REDACTED]", name: "date-iso" },
  { pattern: /\b\d{1,2}[-/]\d{1,2}[-/]\d{4}\b/g, replacement: "[DATE-REDACTED]", name: "date-us" },
  
  { pattern: /\b[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, replacement: "[NAME-REDACTED]", name: "full-name" },
  
  { pattern: /\b\d{1,5}\s+\w+\s+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|court|ct|boulevard|blvd)\b/gi, replacement: "[ADDRESS-REDACTED]", name: "street-address" },
  { pattern: /\b\d{5}(-\d{4})?\b/g, replacement: "[ZIP-REDACTED]", name: "zip-code" },
  
  { pattern: /\b(?:drug|medication|rx|prescription):\s*\w+/gi, replacement: "[MEDICATION-REDACTED]", name: "medication-label" },
  { pattern: /\b(?:diagnosis|dx|condition):\s*[\w\s]+/gi, replacement: "[DIAGNOSIS-REDACTED]", name: "diagnosis-label" },
  
  { pattern: /"resourceType"\s*:\s*"(Patient|Observation|Condition|MedicationRequest|DiagnosticReport|Immunization|Procedure|AllergyIntolerance|CarePlan|CareTeam|Encounter|DocumentReference)"[^}]*}/gi, replacement: "[FHIR-RESOURCE-REDACTED]", name: "fhir-resource" },
  { pattern: /"entry"\s*:\s*\[[^\]]*\]/gi, replacement: '"entry": [FHIR-BUNDLE-ENTRIES-REDACTED]', name: "fhir-bundle-entries" },
  { pattern: /"valueQuantity"\s*:\s*\{[^}]*\}/gi, replacement: '"valueQuantity": [LAB-VALUE-REDACTED]', name: "lab-value-quantity" },
  { pattern: /"valueString"\s*:\s*"[^"]*"/gi, replacement: '"valueString": "[VALUE-REDACTED]"', name: "value-string" },
  { pattern: /"text"\s*:\s*\{[^}]*"div"\s*:\s*"[^"]*"[^}]*\}/gi, replacement: '"text": [NARRATIVE-REDACTED]', name: "fhir-narrative" },
  { pattern: /"note"\s*:\s*\[[^\]]*\]/gi, replacement: '"note": [CLINICAL-NOTES-REDACTED]', name: "clinical-notes" },
];

const PHI_FIELD_NAMES = new Set([
  "ssn", "socialSecurityNumber", "social_security",
  "dateOfBirth", "dob", "birthDate", "birth_date", "birthdate",
  "email", "emailAddress", "email_address",
  "phone", "phoneNumber", "phone_number", "mobile", "cell", "telephone", "fax",
  "name", "firstName", "lastName", "first_name", "last_name", "patientName", "patient_name",
  "fullName", "full_name", "givenName", "familyName", "given", "family", "humanName",
  "address", "streetAddress", "street_address", "city", "state", "zipCode", "zip_code", "zip", "postalCode",
  "line", "district", "country",
  "mrn", "medicalRecordNumber", "medical_record_number", "patientId", "patient_id",
  "insuranceId", "insurance_id", "memberId", "member_id", "policyNumber", "policy_number",
  "diagnosis", "condition", "medication", "prescription", "drug", "rx",
  "notes", "clinicalNotes", "clinical_notes", "narrative", "text", "div",
  "valueQuantity", "valueString", "valueCodeableConcept", "valueRange", "valueRatio",
  "result", "observation", "labValue", "lab_value", "labResult", "lab_result",
  "interpretation", "referenceRange", "component",
  "entry", "resource", "bundle", "contained", "extension",
  "photo", "attachment", "binary", "data", "content", "contentString",
  "allergen", "allergy", "reaction", "manifestation",
  "dosage", "dosageInstruction", "medicationCodeableConcept",
  "procedure", "bodySite", "performedPeriod",
  "immunization", "vaccine", "vaccineCode",
  "document", "documentText", "document_text",
]);

export function redactPhi(input: string): string {
  if (!input || typeof input !== "string") return input;
  
  let result = input;
  
  for (const { pattern, replacement } of PHI_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  
  return result;
}

export function redactPhiFromObject(obj: unknown, depth: number = 0): unknown {
  if (depth > 10) return "[NESTED-OBJECT-TRUNCATED]";
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === "string") {
    return redactPhi(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactPhiFromObject(item, depth + 1));
  }
  
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      if (PHI_FIELD_NAMES.has(key) || PHI_FIELD_NAMES.has(lowerKey)) {
        if (typeof value === "string") {
          result[key] = `[${key.toUpperCase()}-REDACTED]`;
        } else if (value !== null && value !== undefined) {
          result[key] = "[PHI-REDACTED]";
        } else {
          result[key] = value;
        }
      } else if (typeof value === "object") {
        result[key] = redactPhiFromObject(value, depth + 1);
      } else if (typeof value === "string") {
        result[key] = redactPhi(value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  return obj;
}

type LogLevel = "debug" | "info" | "warn" | "error";

interface PhiSafeLoggerOptions {
  enablePhiRedaction: boolean;
  logLevel: LogLevel;
  prefix?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class PhiSafeLogger {
  private options: PhiSafeLoggerOptions;
  
  constructor(options: Partial<PhiSafeLoggerOptions> = {}) {
    this.options = {
      enablePhiRedaction: options.enablePhiRedaction ?? true,
      logLevel: options.logLevel ?? "info",
      prefix: options.prefix ?? "[APP]",
    };
  }
  
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.options.logLevel];
  }
  
  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const prefix = this.options.prefix;
    
    let formattedData = "";
    if (data !== undefined) {
      const safeData = this.options.enablePhiRedaction 
        ? redactPhiFromObject(data) 
        : data;
      formattedData = ` :: ${JSON.stringify(safeData)}`;
    }
    
    return `${timestamp} ${prefix}[${level.toUpperCase()}] ${message}${formattedData}`;
  }
  
  debug(message: string, data?: unknown): void {
    if (this.shouldLog("debug")) {
      console.log(this.formatMessage("debug", message, data));
    }
  }
  
  info(message: string, data?: unknown): void {
    if (this.shouldLog("info")) {
      console.log(this.formatMessage("info", message, data));
    }
  }
  
  warn(message: string, data?: unknown): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, data));
    }
  }
  
  error(message: string, data?: unknown): void {
    if (this.shouldLog("error")) {
      console.error(this.formatMessage("error", message, data));
    }
  }
  
  audit(action: string, userId: string, resourceType: string, details?: Record<string, unknown>): void {
    const safeDetails = this.options.enablePhiRedaction && details
      ? redactPhiFromObject(details)
      : details;
    
    const auditEntry = {
      action,
      userId: userId ? `user:${userId.substring(0, 8)}...` : "anonymous",
      resourceType,
      timestamp: new Date().toISOString(),
      ...(safeDetails as Record<string, unknown>),
    };
    
    console.log(`[AUDIT] ${JSON.stringify(auditEntry)}`);
  }
  
  phiAccess(userId: string, patientId: string, resourceType: string, reason?: string): void {
    console.log(
      `[PHI-ACCESS] User:${userId.substring(0, 8)}... accessed ${resourceType} for Patient:${patientId.substring(0, 8)}... Reason: ${reason || "clinical care"}`
    );
  }
}

export const logger = new PhiSafeLogger({
  enablePhiRedaction: process.env.DISABLE_PHI_REDACTION !== "true",
  logLevel: (process.env.LOG_LEVEL as LogLevel) || "info",
  prefix: "[Tabula]",
});

export function createLogger(prefix: string, options?: Partial<PhiSafeLoggerOptions>): PhiSafeLogger {
  return new PhiSafeLogger({
    ...options,
    prefix,
    enablePhiRedaction: options?.enablePhiRedaction ?? true,
  });
}

export function safeStringify(obj: unknown): string {
  return JSON.stringify(redactPhiFromObject(obj));
}

export function minimizeLogData<T extends Record<string, unknown>>(
  data: T,
  allowedFields: (keyof T)[]
): Partial<T> {
  const result: Partial<T> = {};
  
  for (const field of allowedFields) {
    if (field in data) {
      result[field] = data[field];
    }
  }
  
  return result;
}
