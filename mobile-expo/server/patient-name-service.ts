import { normalizeName, encryptField, decryptField } from "./said-patient-service";

const getEncryptionKey = (): string => {
  const key = process.env.PHI_ENCRYPTION_KEY;
  if (!key) throw new Error("PHI_ENCRYPTION_KEY is required for patient name encryption");
  return key;
};

export interface RawPatientName {
  nameFirst: string;
  nameMiddle?: string | null;
  nameLast: string;
}

export interface EncryptedPatientNameFields {
  nameFirstEnc: string;
  nameMiddleEnc: string;
  nameLastEnc: string;
  hasNoMiddleName: boolean;
}

export interface LabOrderNameResult {
  hl7: string;
  display: string;
  fhir: {
    family: string;
    given: string[];
  };
}

export function encryptPatientName(raw: RawPatientName): EncryptedPatientNameFields {
  const { nameFirst, nameMiddle, nameLast, isNMN } = normalizeName(
    raw.nameFirst,
    raw.nameMiddle,
    raw.nameLast
  );
  const key = getEncryptionKey();

  return {
    nameFirstEnc: encryptField(nameFirst, key),
    nameMiddleEnc: encryptField(nameMiddle, key),
    nameLastEnc: encryptField(nameLast, key),
    hasNoMiddleName: isNMN,
  };
}

export interface PatientRecord {
  nameFirstEnc: string;
  nameMiddleEnc: string;
  nameLastEnc: string;
  hasNoMiddleName?: boolean;
}

export function formatDisplayName(patient: PatientRecord): string {
  const key = getEncryptionKey();
  const first = decryptField(patient.nameFirstEnc, key);
  const middle = decryptField(patient.nameMiddleEnc, key);
  const last = decryptField(patient.nameLastEnc, key);

  return `${first} ${middle} ${last}`;
}

export function labOrderName(patient: PatientRecord): LabOrderNameResult {
  const key = getEncryptionKey();
  const first = decryptField(patient.nameFirstEnc, key);
  const middle = decryptField(patient.nameMiddleEnc, key);
  const last = decryptField(patient.nameLastEnc, key);

  return {
    hl7: `${last}^${first}^${middle}`,
    display: `${first} ${middle} ${last}`,
    fhir: {
      family: last,
      given: [first, middle],
    },
  };
}

export function decryptPatientName(patient: PatientRecord): {
  first: string;
  middle: string;
  last: string;
  isNMN: boolean;
} {
  const key = getEncryptionKey();
  const first = decryptField(patient.nameFirstEnc, key);
  const middle = decryptField(patient.nameMiddleEnc, key);
  const last = decryptField(patient.nameLastEnc, key);

  return {
    first,
    middle,
    last,
    isNMN: middle === "NMN" || patient.hasNoMiddleName === true,
  };
}
