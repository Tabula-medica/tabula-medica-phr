import { EncryptionService } from "../compliance/encryption-service";

export interface PHIField {
  fieldPath: string;
  fieldType: PHIFieldType;
  originalValue: unknown;
  redactedValue: unknown;
}

export type PHIFieldType =
  | "name"
  | "ssn"
  | "mrn"
  | "phone"
  | "email"
  | "address"
  | "date"
  | "age"
  | "ip_address"
  | "device_id"
  | "biometric"
  | "photo"
  | "account_number"
  | "license_number"
  | "vehicle_id"
  | "url"
  | "free_text";

export interface DeidentificationResult {
  success: boolean;
  originalRecord: unknown;
  deidentifiedRecord: unknown;
  redactedFields: PHIField[];
  warnings: string[];
}

export interface DeidentificationConfig {
  preserveDateYear?: boolean;
  preserveStateLevel?: boolean;
  preserveAgeOver89?: boolean;
  hashIdentifiers?: boolean;
  customRedactors?: Record<string, (value: unknown) => unknown>;
}

const DEFAULT_CONFIG: DeidentificationConfig = {
  preserveDateYear: true,
  preserveStateLevel: true,
  preserveAgeOver89: false,
  hashIdentifiers: true,
};

const PHI_PATTERNS: Record<PHIFieldType, RegExp> = {
  ssn: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  phone: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  mrn: /\b(?:MRN|mrn)[-:\s]?\d{4,10}\b/gi,
  ip_address: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  date: /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g,
  name: /(?:^|\s)([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)(?:\s|$)/g,
  address: /\b\d+\s+[A-Za-z]+(?:\s+[A-Za-z]+)*\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Ln|Lane|Way|Ct|Court)\b/gi,
  age: /\b(?:age|aged?)\s*:?\s*(\d{1,3})\b/gi,
  license_number: /\b[A-Z]{1,2}\d{6,8}\b/g,
  account_number: /\b(?:account|acct)[-:\s#]?\d{6,12}\b/gi,
  device_id: /\b[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}\b/gi,
  biometric: /./,
  photo: /./,
  vehicle_id: /\b[A-HJ-NPR-Z0-9]{17}\b/g,
  url: /\bhttps?:\/\/[^\s<>"{}|\\^`[\]]+/gi,
  free_text: /./,
};

const HIPAA_SAFE_HARBOR_FIELDS = [
  "name", "address", "city", "state", "zip", "zipCode", "postalCode",
  "dateOfBirth", "birthDate", "dob", "admissionDate", "dischargeDate",
  "phone", "phoneNumber", "telephone", "fax",
  "email", "emailAddress",
  "ssn", "socialSecurityNumber",
  "mrn", "medicalRecordNumber", "patientId",
  "healthPlanId", "accountNumber",
  "licenseNumber", "driverLicense",
  "vehicleId", "vin",
  "deviceId", "serialNumber",
  "url", "webAddress", "ipAddress",
  "biometricId", "fingerprint", "faceId",
  "photo", "image", "photograph",
];

export class DeidentificationService {
  private config: DeidentificationConfig;

  constructor(config: DeidentificationConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  deidentifyRecord(record: unknown): DeidentificationResult {
    const redactedFields: PHIField[] = [];
    const warnings: string[] = [];

    try {
      const deidentified = this.processValue(record, "", redactedFields, warnings);

      return {
        success: true,
        originalRecord: record,
        deidentifiedRecord: deidentified,
        redactedFields,
        warnings,
      };
    } catch (error) {
      return {
        success: false,
        originalRecord: record,
        deidentifiedRecord: null,
        redactedFields,
        warnings: [`Deidentification failed: ${error}`],
      };
    }
  }

  private processValue(
    value: unknown,
    path: string,
    redactedFields: PHIField[],
    warnings: string[]
  ): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === "string") {
      return this.redactString(value, path, redactedFields, warnings);
    }

    if (typeof value === "number") {
      const fieldName = path.split(".").pop()?.toLowerCase() || "";
      if (fieldName.includes("age")) {
        return this.redactAge(value, path, redactedFields);
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item, index) =>
        this.processValue(item, `${path}[${index}]`, redactedFields, warnings)
      );
    }

    if (typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        const newPath = path ? `${path}.${key}` : key;
        result[key] = this.processValue(val, newPath, redactedFields, warnings);
      }
      return result;
    }

    return value;
  }

  private redactString(
    value: string,
    path: string,
    redactedFields: PHIField[],
    warnings: string[]
  ): string {
    const fieldName = path.split(".").pop()?.toLowerCase() || "";
    let redacted = value;

    if (this.isPHIFieldName(fieldName)) {
      const fieldType = this.determineFieldType(fieldName, value);
      redacted = this.redactByType(value, fieldType);
      
      if (redacted !== value) {
        redactedFields.push({
          fieldPath: path,
          fieldType,
          originalValue: value,
          redactedValue: redacted,
        });
      }
      return redacted;
    }

    for (const [type, pattern] of Object.entries(PHI_PATTERNS)) {
      if (type === "biometric" || type === "photo" || type === "free_text") continue;
      
      const matches = value.match(pattern);
      if (matches) {
        for (const match of matches) {
          const replacement = this.redactByType(match, type as PHIFieldType);
          redacted = redacted.replace(match, replacement);
          
          if (replacement !== match) {
            redactedFields.push({
              fieldPath: path,
              fieldType: type as PHIFieldType,
              originalValue: match,
              redactedValue: replacement,
            });
          }
        }
      }
    }

    return redacted;
  }

  private isPHIFieldName(fieldName: string): boolean {
    return HIPAA_SAFE_HARBOR_FIELDS.some(
      (phi) => fieldName.includes(phi.toLowerCase()) || phi.toLowerCase().includes(fieldName)
    );
  }

  private determineFieldType(fieldName: string, value: string): PHIFieldType {
    if (fieldName.includes("ssn") || fieldName.includes("social")) return "ssn";
    if (fieldName.includes("phone") || fieldName.includes("tel") || fieldName.includes("fax")) return "phone";
    if (fieldName.includes("email")) return "email";
    if (fieldName.includes("mrn") || fieldName.includes("patient") && fieldName.includes("id")) return "mrn";
    if (fieldName.includes("birth") || fieldName.includes("dob") || fieldName.includes("date")) return "date";
    if (fieldName.includes("address") || fieldName.includes("street") || fieldName.includes("line")) return "address";
    if (fieldName.includes("zip") || fieldName.includes("postal")) return "address";
    if (fieldName.includes("name") || fieldName.includes("given") || fieldName.includes("family")) return "name";
    if (fieldName.includes("ip")) return "ip_address";
    if (fieldName.includes("device") || fieldName.includes("serial")) return "device_id";
    if (fieldName.includes("license")) return "license_number";
    if (fieldName.includes("account")) return "account_number";
    if (fieldName.includes("url") || fieldName.includes("web")) return "url";
    return "free_text";
  }

  private redactByType(value: string, fieldType: PHIFieldType): string {
    switch (fieldType) {
      case "ssn":
        return this.config.hashIdentifiers
          ? `SSN-${this.hashValue(value).substring(0, 8)}`
          : "XXX-XX-XXXX";

      case "mrn":
        return this.config.hashIdentifiers
          ? `MRN-${this.hashValue(value).substring(0, 8)}`
          : "MRN-XXXXXX";

      case "phone":
        return "(XXX) XXX-XXXX";

      case "email":
        return this.config.hashIdentifiers
          ? `user-${this.hashValue(value).substring(0, 6)}@redacted.example`
          : "redacted@example.com";

      case "name":
        return this.config.hashIdentifiers
          ? `Person-${this.hashValue(value).substring(0, 6)}`
          : "[REDACTED NAME]";

      case "address":
        if (this.config.preserveStateLevel) {
          const stateMatch = value.match(/\b([A-Z]{2})\b/);
          return stateMatch ? `[REDACTED ADDRESS], ${stateMatch[1]}` : "[REDACTED ADDRESS]";
        }
        return "[REDACTED ADDRESS]";

      case "date":
        if (this.config.preserveDateYear) {
          const yearMatch = value.match(/\d{4}/);
          return yearMatch ? `01/01/${yearMatch[0]}` : "[REDACTED DATE]";
        }
        return "[REDACTED DATE]";

      case "ip_address":
        return "XXX.XXX.XXX.XXX";

      case "device_id":
        return this.config.hashIdentifiers
          ? `DEVICE-${this.hashValue(value).substring(0, 8)}`
          : "[REDACTED DEVICE]";

      case "license_number":
        return "XX-XXXXXX";

      case "account_number":
        return "XXXX-XXXX-XXXX";

      case "vehicle_id":
        return "XXXXXXXXXXXXXXXXX";

      case "url":
        return "[REDACTED URL]";

      case "age":
        return "[REDACTED AGE]";

      case "biometric":
      case "photo":
        return "[REDACTED]";

      case "free_text":
      default:
        return this.scanAndRedactFreeText(value);
    }
  }

  private redactAge(value: number, path: string, redactedFields: PHIField[]): number {
    if (value > 89 && !this.config.preserveAgeOver89) {
      redactedFields.push({
        fieldPath: path,
        fieldType: "age",
        originalValue: value,
        redactedValue: 90,
      });
      return 90;
    }
    return value;
  }

  private scanAndRedactFreeText(text: string): string {
    let result = text;

    result = result.replace(PHI_PATTERNS.ssn, "[REDACTED SSN]");
    result = result.replace(PHI_PATTERNS.phone, "[REDACTED PHONE]");
    result = result.replace(PHI_PATTERNS.email, "[REDACTED EMAIL]");
    result = result.replace(PHI_PATTERNS.mrn, "[REDACTED MRN]");
    result = result.replace(PHI_PATTERNS.ip_address, "[REDACTED IP]");

    return result;
  }

  private hashValue(value: string): string {
    return EncryptionService.hash(value);
  }

  deidentifyBatch(records: unknown[]): {
    results: DeidentificationResult[];
    summary: {
      total: number;
      successful: number;
      failed: number;
      totalFieldsRedacted: number;
    };
  } {
    const results = records.map((record) => this.deidentifyRecord(record));

    return {
      results,
      summary: {
        total: records.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        totalFieldsRedacted: results.reduce((sum, r) => sum + r.redactedFields.length, 0),
      },
    };
  }

  validateDeidentification(record: unknown): {
    isClean: boolean;
    potentialPHI: Array<{ path: string; type: string; sample: string }>;
  } {
    const result = this.deidentifyRecord(record);
    const potentialPHI: Array<{ path: string; type: string; sample: string }> = [];

    const checkValue = (value: unknown, path: string) => {
      if (typeof value === "string") {
        for (const [type, pattern] of Object.entries(PHI_PATTERNS)) {
          if (type === "biometric" || type === "photo" || type === "free_text") continue;
          if (pattern.test(value)) {
            const match = value.match(pattern);
            potentialPHI.push({
              path,
              type,
              sample: match ? match[0].substring(0, 20) + "..." : "[detected]",
            });
          }
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, i) => checkValue(item, `${path}[${i}]`));
      } else if (value && typeof value === "object") {
        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
          checkValue(val, path ? `${path}.${key}` : key);
        }
      }
    };

    checkValue(result.deidentifiedRecord, "");

    return {
      isClean: potentialPHI.length === 0,
      potentialPHI,
    };
  }
}

export const deidentificationService = new DeidentificationService();
