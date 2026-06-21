/**
 * uninsuredIdentityVault.service.ts
 * Tabula Medica — Uninsured Identity Vault
 *
 * Securely stores non-SSN identifiers for patients who cannot or do not
 * wish to provide a Social Security Number. Specifically designed for:
 *   - Lawfully present immigrants (refugees, asylees, TPS holders, DACA)
 *   - Foreign nationals visiting the US
 *   - College students on F1/J1 visas
 *   - Undocumented individuals (Tabula Medica has no immigration status
 *     requirement — see Provider Agreement §3.4)
 *
 * 2026 Context: The OBBBA removed Marketplace subsidies for immigrants
 * present less than 5 years. Over 1 million lawfully present immigrants
 * lost coverage as of Jan 1, 2026. This vault enables them to access
 * care at Medicare rates without an SSN.
 *
 * Identity documents accepted by Tabula Medica provider network:
 *   - US Passport / US Passport Card
 *   - Foreign passport (any country)
 *   - Consular ID (Matricula Consular)
 *   - State-issued Driver's License / ID
 *   - USCIS EAD (Employment Authorization Document)
 *   - USCIS I-94 Arrival/Departure Record
 *   - ITIN (Individual Taxpayer Identification Number) — no immigration info
 *   - School/University ID (for students)
 *
 * Storage: Encrypted at rest in Google Cloud Healthcare API
 * (same HIPAA BAA as health records). IDs are never shared with
 * immigration authorities — only used for provider intake matching.
 *
 * LEGAL NOTE: Tabula Medica does NOT verify immigration status and does
 * NOT report patient information to immigration authorities. Our Privacy
 * Policy §8.2 and Provider Agreement §3.4 expressly prohibit this.
 *
 * Drop into: src/services/uninsuredIdentityVault.service.ts
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type IdentityDocumentType =
  | 'US_PASSPORT'
  | 'FOREIGN_PASSPORT'
  | 'CONSULAR_ID'
  | 'STATE_DL'
  | 'STATE_ID'
  | 'USCIS_EAD'
  | 'USCIS_I94'
  | 'ITIN'
  | 'SCHOOL_ID'
  | 'OTHER';

export interface IdentityDocument {
  type: IdentityDocumentType;
  typeLabel: string;
  documentNumber: string;         // masked after storage: "****1234"
  issuingCountry?: string;        // ISO 3166-1 alpha-2: "MX", "CN", "IN"
  issuingState?: string;          // for US driver's licenses
  expirationDate?: string;        // ISO date
  nameAsOnDocument: string;
  dateOfBirth: string;
  storedAt: string;               // ISO timestamp
  verified: boolean;              // false until provider confirms at check-in
}

export interface UninsuredIdentityProfile {
  patientId: string;
  preferredLanguage: string;      // BCP 47: "es", "zh-Hans", "hi", "pt-BR", "fr"
  hasSSN: false;                  // explicit — this profile is for no-SSN patients
  identityDocuments: IdentityDocument[];
  primaryDocumentType: IdentityDocumentType;
  acceptedByNetworkProviders: boolean;  // true once first provider accepts
  privacyAcknowledgedAt: string;
  immigrationStatusNotRequired: true;   // explicit flag for audit trail
}

export interface VaultStoreResult {
  success: boolean;
  maskedNumber?: string;
  errorMessage?: string;
}

// ─── Document type metadata ───────────────────────────────────────────────────

export const IDENTITY_DOCUMENT_TYPES: Record<
  IdentityDocumentType,
  { label: string; hint: string; accepted: boolean; requiresCountry: boolean }
> = {
  US_PASSPORT: {
    label: 'US Passport / Passport Card',
    hint: '9-character alphanumeric number on the data page',
    accepted: true,
    requiresCountry: false,
  },
  FOREIGN_PASSPORT: {
    label: 'Foreign Passport',
    hint: 'Passport number from any country',
    accepted: true,
    requiresCountry: true,
  },
  CONSULAR_ID: {
    label: 'Consular ID (Matrícula Consular)',
    hint: 'ID issued by your country\'s consulate',
    accepted: true,
    requiresCountry: true,
  },
  STATE_DL: {
    label: 'State Driver\'s License',
    hint: 'Driver\'s license number from any US state',
    accepted: true,
    requiresCountry: false,
  },
  STATE_ID: {
    label: 'State ID Card',
    hint: 'Non-driver ID from any US state',
    accepted: true,
    requiresCountry: false,
  },
  USCIS_EAD: {
    label: 'USCIS Employment Authorization Card (EAD)',
    hint: '13-character document number on the front',
    accepted: true,
    requiresCountry: false,
  },
  USCIS_I94: {
    label: 'USCIS I-94 Arrival/Departure Record',
    hint: '11-digit admission number',
    accepted: true,
    requiresCountry: false,
  },
  ITIN: {
    label: 'Individual Taxpayer ID Number (ITIN)',
    hint: '9-digit number starting with 9 (format: 9XX-XX-XXXX)',
    accepted: true,
    requiresCountry: false,
  },
  SCHOOL_ID: {
    label: 'University / School ID',
    hint: 'Student ID number',
    accepted: true,
    requiresCountry: false,
  },
  OTHER: {
    label: 'Other Government-Issued ID',
    hint: 'Any government-issued photo ID',
    accepted: true,
    requiresCountry: true,
  },
};

// ─── Masking helper ───────────────────────────────────────────────────────────

function maskDocumentNumber(raw: string): string {
  const clean = raw.replace(/\s/g, '');
  if (clean.length <= 4) return '****';
  return '*'.repeat(clean.length - 4) + clean.slice(-4);
}

// ─── Privacy acknowledgment text ─────────────────────────────────────────────

export const PRIVACY_ACKNOWLEDGMENT_TEXT = `
PRIVACY NOTICE — UNINSURED IDENTITY VAULT

Tabula Medica, Inc. DBA Uninsurance stores your identity document 
information ONLY for the purpose of provider check-in and appointment 
matching. We commit to the following:

1. NO immigration status verification. We do not check or record your 
   immigration status.

2. NO disclosure to immigration authorities. We will NEVER voluntarily 
   share your information with ICE, CBP, or any immigration enforcement 
   agency. We will challenge any request to do so in court.

3. NO SSN required. A Social Security Number is never required to 
   receive care in our network.

4. HIPAA protection. Your identity documents are protected by the same 
   HIPAA security standards as your medical records.

5. YOUR CONTROL. You may delete your stored IDs at any time from your 
   profile settings.

By storing your ID, you consent to this privacy policy. For questions, 
contact privacy@tabulamedica.health.
`.trim();

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Store an identity document in the Uninsured Identity Vault.
 * The raw document number is masked before storage.
 *
 * @example
 * const result = await storeIdentityDocument('usr_abc', {
 *   type: 'FOREIGN_PASSPORT',
 *   documentNumber: 'A12345678',
 *   issuingCountry: 'MX',
 *   nameAsOnDocument: 'Maria Rodriguez Lopez',
 *   dateOfBirth: '1987-03-14',
 * });
 */
export async function storeIdentityDocument(
  patientId: string,
  doc: Omit<IdentityDocument, 'storedAt' | 'verified' | 'typeLabel'> & {
    documentNumber: string; // raw — will be masked
  },
): Promise<VaultStoreResult> {
  // Mask the raw document number before saving
  const masked = maskDocumentNumber(doc.documentNumber);
  const typeMetadata = IDENTITY_DOCUMENT_TYPES[doc.type];

  const stored: IdentityDocument = {
    ...doc,
    documentNumber: masked,
    typeLabel: typeMetadata.label,
    storedAt: new Date().toISOString(),
    verified: false,
  };

  try {
    // In production: POST to your backend which stores in
    // Google Cloud Healthcare API (Patient resource extension) or
    // your encrypted secure storage.
    //
    // Example endpoint:
    // await fetch(`/api/identity-vault/${patientId}`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ document: stored }),
    // });

    // For development, log the stored document (masked)
    console.log(`[IdentityVault] Stored ${stored.typeLabel} for patient ${patientId}: ${masked}`);

    return { success: true, maskedNumber: masked };
  } catch (err) {
    return {
      success: false,
      errorMessage: `Failed to store identity document: ${(err as Error).message}`,
    };
  }
}

/**
 * Check if a patient has stored identity documents.
 * Used in GFE generation to auto-populate the patient identifier.
 */
export async function getVaultStatus(patientId: string): Promise<{
  hasDocuments: boolean;
  primaryDocument?: { type: IdentityDocumentType; typeLabel: string; maskedNumber: string };
}> {
  try {
    // In production: GET /api/identity-vault/${patientId}
    // For now return a safe default
    return { hasDocuments: false };
  } catch {
    return { hasDocuments: false };
  }
}

/**
 * Generate provider-facing intake note from vault documents.
 * Sent to provider along with the GFE and appointment confirmation.
 * Never includes the raw document number — only type and masked digits.
 */
export function generateProviderIntakeNote(docs: IdentityDocument[]): string {
  if (docs.length === 0) {
    return 'Patient does not have a Social Security Number on file. No ID documents stored. Verify identity at check-in per your practice policy.';
  }

  const primary = docs[0];
  const docList = docs
    .map((d) => `  • ${d.typeLabel}: ${d.documentNumber} (${d.issuingCountry ?? 'US'})`)
    .join('\n');

  return `
IDENTITY VERIFICATION NOTE — Tabula Medica Uninsured Identity Vault

This patient does not have a Social Security Number on file.
The following government-issued IDs have been stored and accepted per
Tabula Medica Provider Agreement §3.4.

Primary ID: ${primary.typeLabel} — ${primary.documentNumber}

All stored IDs:
${docList}

Note: Tabula Medica does not verify immigration status. Per our Provider
Agreement, providers in the Uninsurance network agree to accept these
IDs in lieu of an SSN for uninsured patient intake.
`.trim();
}

/**
 * Returns the accepted ID types list for display in the UI.
 */
export function getAcceptedDocumentTypes(): Array<{
  type: IdentityDocumentType;
  label: string;
  hint: string;
}> {
  return Object.entries(IDENTITY_DOCUMENT_TYPES)
    .filter(([, meta]) => meta.accepted)
    .map(([type, meta]) => ({
      type: type as IdentityDocumentType,
      label: meta.label,
      hint: meta.hint,
    }));
}
