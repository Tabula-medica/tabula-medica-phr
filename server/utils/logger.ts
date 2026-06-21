const PII_FIELDS = new Set([
  'name', 'firstname', 'lastname', 'first_name', 'last_name', 'fullname', 'full_name',
  'patientname', 'patient_name', 'givenname', 'familyname', 'given', 'family',
  'email', 'emailaddress', 'email_address',
  'phone', 'phonenumber', 'phone_number', 'mobile', 'cell', 'telephone', 'fax',
  'ssn', 'socialsecuritynumber', 'social_security', 'social_security_number',
  'address', 'streetaddress', 'street_address', 'city', 'state', 'zip', 'zipcode', 'zip_code', 'postalcode',
  'dateofbirth', 'dob', 'birthdate', 'birth_date',
  'mrn', 'medicalrecordnumber', 'medical_record_number',
  'clinical_notes', 'clinicalnotes', 'notes', 'narrative',
  'diagnosis', 'condition', 'medication', 'prescription', 'drug',
  'insuranceid', 'insurance_id', 'memberid', 'member_id', 'policynumber', 'policy_number',
  'password', 'passwordhash', 'password_hash', 'secret', 'token', 'apikey', 'api_key',
]);

export function maskSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') return data;

  const masked: any = Array.isArray(data) ? [] : {};

  for (const [key, value] of Object.entries(data)) {
    if (PII_FIELDS.has(key.toLowerCase())) {
      masked[key] = '[MASKED_FOR_COMPLIANCE]';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

const isProduction = process.env.NODE_ENV === "production";

export const logger = {
  info: (msg: string, meta?: any) => {
    const entry = { level: 'info', timestamp: new Date().toISOString(), msg, ...(meta ? { details: maskSensitiveData(meta) } : {}) };
    console.log(JSON.stringify(entry));
  },
  warn: (msg: string, meta?: any) => {
    const entry = { level: 'warn', timestamp: new Date().toISOString(), msg, ...(meta ? { details: maskSensitiveData(meta) } : {}) };
    console.warn(JSON.stringify(entry));
  },
  error: (msg: string, meta?: any) => {
    const entry = { level: 'error', timestamp: new Date().toISOString(), msg, ...(meta ? { details: maskSensitiveData(meta) } : {}) };
    console.error(JSON.stringify(entry));
  },
  audit: (action: string, meta: { userId?: string; resourceType?: string; resourceId?: string; outcome?: string; [key: string]: any }) => {
    const entry = {
      level: 'audit',
      timestamp: new Date().toISOString(),
      action,
      ...maskSensitiveData(meta),
    };
    console.log(JSON.stringify(entry));
  },
};
