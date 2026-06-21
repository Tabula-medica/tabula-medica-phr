import { createHash, randomBytes } from "crypto";
import { storage } from "./storage";
import type {
  Patient,
  Medication,
  LabResult,
  Allergy,
  Problem,
  MedicalRecord,
  Appointment,
  VitalSign,
  DataCategory,
  DeidentificationMethod,
  PhiIdentifier,
  DeidentifiedDataset,
  InsertDeidentifiedDataset,
  InsertDeidentificationAuditLog,
} from "@shared/schema";

interface DeidentificationOptions {
  method: DeidentificationMethod;
  dateShiftDays?: number;
  ageThreshold?: number;
  zipCodeTruncation?: number;
  hashSalt: string;
}

interface DeidentifiedRecord {
  pseudoId: string;
  recordType: string;
  data: Record<string, unknown>;
  fieldsRemoved: PhiIdentifier[];
}

const AGE_FIELD_PATTERN = /^(age|patientAge|currentAge|ageAtVisit|ageAtDiagnosis|ageYears|ageInYears)$/i;

const PHI_PATTERNS: Record<PhiIdentifier, RegExp> = {
  names: /^(name|firstName|lastName|givenName|familyName|patientName|providerName|caregiverName|doctorName|fullName|displayName)$/i,
  geographic_subdivisions: /^(address|street|streetAddress|city|zipCode|zip|postalCode|county|apartment|suite|unit|addressLine|locality)$/i,
  dates: /^(birthDate|dateOfBirth|dob|admissionDate|dischargeDate|deathDate|createdAt|updatedAt|scheduledAt|performedAt|orderDate|serviceDate|encounterDate|age|patientAge|currentAge|ageAtVisit|ageAtDiagnosis|ageYears|ageInYears)$/i,
  phone_numbers: /^(phone|phoneNumber|phone_number|telephone|mobile|cell|homePhone|workPhone|emergencyPhone)$/i,
  fax_numbers: /^(fax|faxNumber|fax_number)$/i,
  email_addresses: /^(email|emailAddress|email_address|contactEmail)$/i,
  ssn: /^(ssn|socialSecurityNumber|social_security|taxId|tin)$/i,
  mrn: /^(mrn|medicalRecordNumber|medical_record_number|patientId|recordId|healthRecordId|chartNumber)$/i,
  health_plan_beneficiary: /^(beneficiaryId|memberId|subscriberId|insuranceId|planId|policyNumber|groupNumber)$/i,
  account_numbers: /^(accountNumber|account_number|bankAccount|creditCard|cardNumber|routingNumber)$/i,
  certificate_license_numbers: /^(licenseNumber|license_number|certificateNumber|certificate_number|npi|dea|upin|providerLicense)$/i,
  vehicle_identifiers: /^(vin|vehicleId|vehicle_id|licensePlate|plateNumber)$/i,
  device_identifiers: /^(deviceId|device_id|serialNumber|deviceSerial|imei|macAddress|udi|deviceIdentifier)$/i,
  web_urls: /^(url|website|webUrl|profileUrl|websiteUrl|homepage)$/i,
  ip_addresses: /^(ipAddress|ip_address|clientIp|serverIp|remoteIp)$/i,
  biometric_identifiers: /^(fingerprint|voicePrint|retinalScan|facialScan|biometricId|irisPattern|palmPrint)$/i,
  full_face_photos: /^(photo|photograph|image|picture|avatar|profilePicture|faceImage|headshot)$/i,
  unique_identifying_codes: /^(uniqueId|uniqueCode|trackingNumber|referenceNumber|caseNumber|claimNumber)$/i,
};

function hashValue(value: string, salt: string): string {
  return createHash("sha256")
    .update(value + salt)
    .digest("hex")
    .substring(0, 16);
}

function shiftDate(dateStr: string, shiftDays: number): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  date.setDate(date.getDate() + shiftDays);
  return date.toISOString().split("T")[0];
}

function extractYear(dateStr: string): string | null {
  const match = dateStr.match(/\d{4}/);
  return match ? match[0] : null;
}

function truncateZipCode(zip: string, digits: number): string {
  if (!zip || digits <= 0) return "00000";
  const numericZip = zip.replace(/\D/g, "");
  return numericZip.substring(0, digits).padEnd(5, "0");
}

function generalizeAge(birthDate: string, threshold: number): string {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  if (age >= threshold) {
    return `${threshold}+`;
  }
  return age.toString();
}

function identifyPhiField(fieldName: string): PhiIdentifier | null {
  for (const [identifier, pattern] of Object.entries(PHI_PATTERNS)) {
    if (pattern.test(fieldName)) {
      return identifier as PhiIdentifier;
    }
  }
  return null;
}

function deidentifyValue(
  value: unknown,
  fieldName: string,
  phiType: PhiIdentifier,
  options: DeidentificationOptions
): unknown {
  if (value === null || value === undefined) return value;
  const strValue = String(value);
  const { method, hashSalt, dateShiftDays, zipCodeTruncation } = options;

  switch (phiType) {
    case "names":
      if (method === "safe_harbor") return "[REDACTED]";
      if (method === "limited_dataset") return "[REDACTED]";
      return hashValue(strValue, hashSalt);
    
    case "email_addresses":
      return "[EMAIL_REMOVED]";
    
    case "phone_numbers":
      return "[PHONE_REMOVED]";
    
    case "fax_numbers":
      return "[FAX_REMOVED]";
    
    case "ssn":
      return "[SSN_REMOVED]";
    
    case "mrn":
      return hashValue(strValue, hashSalt);
    
    case "geographic_subdivisions":
      if (method === "limited_dataset") {
        if (fieldName.toLowerCase().includes("zip") || fieldName.toLowerCase().includes("postal")) {
          return truncateZipCode(strValue, zipCodeTruncation || 3);
        }
        if (fieldName.toLowerCase().includes("state")) {
          return strValue;
        }
        if (fieldName.toLowerCase().includes("city") || fieldName.toLowerCase().includes("county")) {
          return strValue;
        }
        return "[LOCATION_REMOVED]";
      }
      if (fieldName.toLowerCase().includes("state")) {
        return strValue;
      }
      if (fieldName.toLowerCase().includes("zip") || fieldName.toLowerCase().includes("postal")) {
        return truncateZipCode(strValue, zipCodeTruncation || 3);
      }
      return "[LOCATION_REMOVED]";
    
    case "dates":
      if (AGE_FIELD_PATTERN.test(fieldName)) {
        const ageNum = parseInt(strValue, 10);
        if (!isNaN(ageNum)) {
          const threshold = options.ageThreshold || 89;
          if (ageNum >= threshold) {
            return `${threshold}+`;
          }
          return ageNum.toString();
        }
        return "[AGE_REMOVED]";
      }
      if (method === "limited_dataset") {
        if (dateShiftDays && dateShiftDays > 0) {
          return shiftDate(strValue, dateShiftDays);
        }
        return strValue;
      }
      if (method === "expert_determination") {
        if (dateShiftDays && dateShiftDays > 0) {
          return shiftDate(strValue, dateShiftDays);
        }
        return strValue;
      }
      if (fieldName.toLowerCase().includes("birth")) {
        const age = generalizeAge(strValue, options.ageThreshold || 89);
        if (age.endsWith("+")) {
          return "[AGE_89_PLUS]";
        }
        const year = extractYear(strValue);
        return year ? `${year}-01-01` : "[DATE_REMOVED]";
      }
      return extractYear(strValue) || "[DATE_REMOVED]";
    
    case "account_numbers":
      return "[ACCOUNT_REMOVED]";
    
    case "health_plan_beneficiary":
      return "[BENEFICIARY_ID_REMOVED]";
    
    case "certificate_license_numbers":
      return "[LICENSE_REMOVED]";
    
    case "vehicle_identifiers":
      return "[VEHICLE_ID_REMOVED]";
    
    case "device_identifiers":
      return "[DEVICE_ID_REMOVED]";
    
    case "ip_addresses":
      return "[IP_REMOVED]";
    
    case "web_urls":
      return "[URL_REMOVED]";
    
    case "biometric_identifiers":
      return "[BIOMETRIC_REMOVED]";
    
    case "full_face_photos":
      return "[PHOTO_REMOVED]";
    
    case "unique_identifying_codes":
      return hashValue(strValue, hashSalt);
    
    default:
      return value;
  }
}

const FREETEXT_FIELDS = /^(notes|description|comments|narrative|text|summary|remarks|freeText|clinicalNotes|assessment|plan|hpi|chiefComplaint|history|impressions|findings|recommendations|reason|instruction|instructions|directions|sig|additionalInfo|details|memo|message|content|body|explanation|rationale|observation|observationText|encounterNotes|progressNotes|dischargeInstructions|patientInstructions|followUpInstructions)$/i;

const SAFE_HARBOR_ALLOWLIST = /^(recordType|category|status|type|code|codeSystem|system|unit|units|isActive|isCurrent|severity|criticality|verificationStatus|clinicalStatus|method|route|frequency|dosage|dose|doseUnit|refills|quantity|resourceType|referenceRange|interpretation|format|mimeType|version|priority|classification|confidentiality|recordCount|datasetId|configId|expiresAt|createdAt)$/i;

function hashForSafeHarbor(value: unknown, salt: string): string {
  if (value === null || value === undefined) return "[REMOVED]";
  return createHash("sha256")
    .update(String(value) + salt)
    .digest("hex")
    .substring(0, 16);
}

function isFreeTextField(fieldName: string): boolean {
  return FREETEXT_FIELDS.test(fieldName);
}

function isSafeHarborAllowed(fieldName: string): boolean {
  return SAFE_HARBOR_ALLOWLIST.test(fieldName);
}

function deidentifyObject(
  obj: Record<string, unknown>,
  options: DeidentificationOptions
): { data: Record<string, unknown>; fieldsRemoved: PhiIdentifier[] } {
  const result: Record<string, unknown> = {};
  const fieldsRemoved: PhiIdentifier[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (options.method === "safe_harbor") {
      if (isFreeTextField(key)) {
        result[key] = "[NARRATIVE_REMOVED_FOR_SAFE_HARBOR]";
        continue;
      }
      
      if (/^(id|.*Id|.*_id)$/i.test(key)) {
        result[key] = hashForSafeHarbor(value, options.hashSalt);
        continue;
      }
      
      if (/^(value|result|displayValue|.*Value)$/i.test(key) && typeof value === "string") {
        result[key] = hashForSafeHarbor(value, options.hashSalt);
        continue;
      }
    }
    
    const phiType = identifyPhiField(key);
    
    if (phiType) {
      if (options.method === "safe_harbor") {
        result[key] = deidentifyValue(value, key, phiType, options);
        if (!fieldsRemoved.includes(phiType)) {
          fieldsRemoved.push(phiType);
        }
      } else if (options.method === "limited_dataset") {
        if (["dates", "geographic_subdivisions"].includes(phiType)) {
          result[key] = deidentifyValue(value, key, phiType, options);
        } else {
          result[key] = deidentifyValue(value, key, phiType, options);
          if (!fieldsRemoved.includes(phiType)) {
            fieldsRemoved.push(phiType);
          }
        }
      } else {
        result[key] = deidentifyValue(value, key, phiType, options);
        if (!fieldsRemoved.includes(phiType)) {
          fieldsRemoved.push(phiType);
        }
      }
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const nested = deidentifyObject(value as Record<string, unknown>, options);
      result[key] = nested.data;
      fieldsRemoved.push(...nested.fieldsRemoved.filter(f => !fieldsRemoved.includes(f)));
    } else if (options.method === "safe_harbor" && typeof value === "string" && !isSafeHarborAllowed(key)) {
      result[key] = "[STRING_REMOVED_FOR_SAFE_HARBOR]";
    } else {
      result[key] = value;
    }
  }

  return { data: result, fieldsRemoved };
}

async function findPatientForUser(userId: string): Promise<Patient | null> {
  const user = await storage.getUser(userId);
  if (!user?.email) {
    const patients = await storage.getPatients();
    return patients.length > 0 ? patients[0] : null;
  }
  
  const patients = await storage.getPatients();
  const matchingPatient = patients.find(p => 
    p.email?.toLowerCase() === user.email?.toLowerCase()
  );
  
  return matchingPatient || (patients.length > 0 ? patients[0] : null);
}

export async function generateDeidentifiedDataset(
  patientUserId: string,
  configId: string,
  method: DeidentificationMethod,
  purpose: string,
  categories: DataCategory[],
  options: Partial<DeidentificationOptions> = {}
): Promise<DeidentifiedDataset> {
  const patient = await findPatientForUser(patientUserId);
  
  if (!patient) {
    throw new Error("No patient data found");
  }

  const hashSalt = options.hashSalt || randomBytes(32).toString("hex");
  const fullOptions: DeidentificationOptions = {
    method,
    dateShiftDays: options.dateShiftDays || 0,
    ageThreshold: options.ageThreshold || 89,
    zipCodeTruncation: options.zipCodeTruncation || 3,
    hashSalt,
  };

  const deidentifiedRecords: DeidentifiedRecord[] = [];
  const allFieldsRemoved: Set<PhiIdentifier> = new Set();

  if (categories.includes("medications")) {
    const medications = await storage.getMedicationsByPatient(patient.id);
    for (const med of medications) {
      const { data, fieldsRemoved } = deidentifyObject(med as unknown as Record<string, unknown>, fullOptions);
      deidentifiedRecords.push({
        pseudoId: hashValue(med.id, hashSalt),
        recordType: "medication",
        data,
        fieldsRemoved,
      });
      fieldsRemoved.forEach(f => allFieldsRemoved.add(f));
    }
  }

  if (categories.includes("conditions")) {
    const problems = await storage.getProblemsByPatient(patient.id);
    for (const problem of problems) {
      const { data, fieldsRemoved } = deidentifyObject(problem as unknown as Record<string, unknown>, fullOptions);
      deidentifiedRecords.push({
        pseudoId: hashValue(problem.id, hashSalt),
        recordType: "condition",
        data,
        fieldsRemoved,
      });
      fieldsRemoved.forEach(f => allFieldsRemoved.add(f));
    }
  }

  if (categories.includes("allergies")) {
    const allergies = await storage.getAllergiesByPatient(patient.id);
    for (const allergy of allergies) {
      const { data, fieldsRemoved } = deidentifyObject(allergy as unknown as Record<string, unknown>, fullOptions);
      deidentifiedRecords.push({
        pseudoId: hashValue(allergy.id, hashSalt),
        recordType: "allergy",
        data,
        fieldsRemoved,
      });
      fieldsRemoved.forEach(f => allFieldsRemoved.add(f));
    }
  }

  if (categories.includes("lab_results")) {
    const labs = await storage.getLabResultsByPatient(patient.id);
    for (const lab of labs) {
      const { data, fieldsRemoved } = deidentifyObject(lab as unknown as Record<string, unknown>, fullOptions);
      deidentifiedRecords.push({
        pseudoId: hashValue(lab.id, hashSalt),
        recordType: "lab_result",
        data,
        fieldsRemoved,
      });
      fieldsRemoved.forEach(f => allFieldsRemoved.add(f));
    }
  }

  if (categories.includes("vital_signs")) {
    const vitals = await storage.getVitalsByPatient(patient.id);
    for (const vital of vitals) {
      const { data, fieldsRemoved } = deidentifyObject(vital as unknown as Record<string, unknown>, fullOptions);
      deidentifiedRecords.push({
        pseudoId: hashValue(vital.id, hashSalt),
        recordType: "vital_sign",
        data,
        fieldsRemoved,
      });
      fieldsRemoved.forEach(f => allFieldsRemoved.add(f));
    }
  }

  if (categories.includes("appointments")) {
    const appointments = await storage.getAppointments();
    for (const appt of appointments) {
      const { data, fieldsRemoved } = deidentifyObject(appt as unknown as Record<string, unknown>, fullOptions);
      deidentifiedRecords.push({
        pseudoId: hashValue(appt.id, hashSalt),
        recordType: "appointment",
        data,
        fieldsRemoved,
      });
      fieldsRemoved.forEach(f => allFieldsRemoved.add(f));
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90);

  const datasetInput: InsertDeidentifiedDataset = {
    configId,
    patientUserId,
    method,
    purpose: purpose as any,
    status: "completed",
    recordCount: deidentifiedRecords.length,
    dataCategories: categories,
    hashSalt,
    expiresAt: expiresAt.toISOString(),
  };

  const dataset = await storage.createDeidentifiedDataset(datasetInput);

  await storage.createDeidentificationAuditLog({
    datasetId: dataset.id,
    patientUserId,
    action: "complete",
    recordsProcessed: deidentifiedRecords.length,
    fieldsRemoved: Array.from(allFieldsRemoved),
  });

  await storage.setDeidentifiedData(dataset.id, deidentifiedRecords);

  return dataset;
}

export async function getDeidentifiedData(datasetId: string): Promise<DeidentifiedRecord[]> {
  const data = await storage.getDeidentifiedData(datasetId);
  return data as DeidentifiedRecord[];
}

export async function logDatasetDownload(
  datasetId: string,
  patientUserId: string,
  accessorId: string,
  accessorType: "researcher" | "organization" | "api",
  accessorName: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await storage.incrementDatasetDownloadCount(datasetId);
  
  await storage.createDeidentificationAuditLog({
    datasetId,
    patientUserId,
    action: "download",
    accessorId,
    accessorType,
    accessorName,
    ipAddress,
    userAgent,
  });
}

export async function deleteDataset(datasetId: string, patientUserId: string): Promise<void> {
  await storage.createDeidentificationAuditLog({
    datasetId,
    patientUserId,
    action: "delete",
  });
  
  await storage.deleteDeidentifiedDataset(datasetId);
}

export async function getDatasetStats(patientUserId: string): Promise<{
  totalDatasets: number;
  totalRecordsShared: number;
  totalDownloads: number;
  purposeBreakdown: Record<string, number>;
}> {
  const datasets = await storage.getDeidentifiedDatasetsByUser(patientUserId);
  
  const purposeBreakdown: Record<string, number> = {};
  let totalRecords = 0;
  let totalDownloads = 0;
  
  for (const ds of datasets) {
    totalRecords += ds.recordCount;
    totalDownloads += ds.downloadCount;
    purposeBreakdown[ds.purpose] = (purposeBreakdown[ds.purpose] || 0) + 1;
  }
  
  return {
    totalDatasets: datasets.length,
    totalRecordsShared: totalRecords,
    totalDownloads,
    purposeBreakdown,
  };
}
