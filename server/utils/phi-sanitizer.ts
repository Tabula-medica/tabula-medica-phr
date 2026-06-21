const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;

const MRN_REGEX = /\b(MRN|Medical Record Number|Patient ID|Account(?:\s*#|\s*Number)?|Member(?:\s*#|\s*ID))\s*:?\s*[A-Z0-9][\w-]{3,20}/gi;

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const PHONE_REGEX = /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g;

const NAME_PREFIX_REGEX = /\b(?:patient|name|mr\.|mrs\.|ms\.|dr\.|subject)\s*:?\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}/gi;

const ADDRESS_REGEX = /\b\d{1,5}\s+[A-Z][a-zA-Z\s]{2,30}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Drive|Dr|Road|Rd|Lane|Ln|Court|Ct|Way|Place|Pl|Circle|Cir|Terrace|Ter|Highway|Hwy)\.?\b/gi;

const CITY_STATE_ZIP_REGEX = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)?,?\s+[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g;

const DOB_REGEX = /\b(?:DOB|Date of Birth|Birth\s*Date|Born)\s*:?\s*[\d\/\-.]+/gi;

const FHIR_PATIENT_ID_REGEX = /\b(?:Patient\/)[a-f0-9-]{8,36}\b/gi;

const INSURANCE_REGEX = /\b(?:Insurance|Policy|Group|Subscriber|Plan)\s*(?:#|ID|Number)\s*:?\s*[A-Z0-9][\w-]{4,20}/gi;

const STANDALONE_SSN_DIGITS = /\b\d{9}\b/g;

const ISO_DOB_LABELED = /\b(?:birthDate|dateOfBirth|dob)\s*["':=]\s*["']?\d{4}-\d{2}-\d{2}(?:T[\d:.Z+-]*)?\b/gi;

export function sanitizeHealthData(text: string): string {
  if (!text) return "";

  let sanitized = text;

  sanitized = sanitized.replace(SSN_REGEX, "[SSN]");
  sanitized = sanitized.replace(MRN_REGEX, "[MRN]");
  sanitized = sanitized.replace(EMAIL_REGEX, "[EMAIL]");
  sanitized = sanitized.replace(PHONE_REGEX, "[PHONE]");
  sanitized = sanitized.replace(DOB_REGEX, "[DOB]");
  sanitized = sanitized.replace(ISO_DOB_LABELED, "[DOB]");
  sanitized = sanitized.replace(NAME_PREFIX_REGEX, "[PATIENT_NAME]");
  sanitized = sanitized.replace(ADDRESS_REGEX, "[ADDRESS]");
  sanitized = sanitized.replace(CITY_STATE_ZIP_REGEX, "[LOCATION]");
  sanitized = sanitized.replace(FHIR_PATIENT_ID_REGEX, "Patient/[REDACTED]");
  sanitized = sanitized.replace(INSURANCE_REGEX, "[INSURANCE_ID]");
  sanitized = sanitized.replace(STANDALONE_SSN_DIGITS, "[ID]");

  return sanitized.trim();
}

export function sanitizeChatMessages(
  messages: Array<{ role: string; content: string | null }>
): Array<{ role: string; content: string | null }> {
  return messages.map((msg) => {
    if (msg.role === "system" || !msg.content) return msg;
    return { ...msg, content: sanitizeHealthData(msg.content) };
  });
}

export function prepareAIRequest(medicalRecord: {
  condition?: string;
  medication?: string;
  notes?: string;
}): string {
  const parts: string[] = [];
  if (medicalRecord.condition) parts.push(`Condition: ${medicalRecord.condition}`);
  if (medicalRecord.medication) parts.push(`Medication: ${medicalRecord.medication}`);
  if (medicalRecord.notes) parts.push(`Notes: ${medicalRecord.notes}`);
  return sanitizeHealthData(parts.join(". "));
}
