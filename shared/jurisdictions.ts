/**
 * World EHR — jurisdiction registry.
 *
 * Tabula Medica's clinical surface was built US-first: NPI for providers,
 * ICD-10-CM for problems, CVX for immunisations, TEFCA for exchange. The
 * international (`tabulamedica.world`) deployment runs the same image with
 * `TEFCA_ENABLED=false`, which removes the US network but puts nothing in its
 * place — an international patient has no national identifier, no local
 * terminology, and no lawful basis recorded for processing their data.
 *
 * This registry is the country-agnostic replacement. It describes, per
 * jurisdiction, the facts the rest of the World EHR stack needs:
 *
 *   - which national health identifier applies, and how to validate it
 *   - the FHIR `Identifier.system` URI that identifier must be published under
 *   - which privacy regime governs the record (for the consent receipt)
 *   - which problem-code system is authoritative locally
 *
 * Everything here is deliberately free of PHI and free of I/O so it can be
 * imported by the client, the server, and the mobile bundle alike.
 *
 * ADDING A JURISDICTION: append an entry to `JURISDICTIONS`. Do not add
 * country-specific branching anywhere else — callers must read this table.
 */

/** ISO 3166-1 alpha-2 country code, uppercase. */
export type JurisdictionCode = string;

/** Privacy regime governing a record, used on the consent receipt. */
export type PrivacyRegime =
  | "HIPAA"
  | "GDPR"
  | "UK-GDPR"
  | "DPDP-2023"
  | "PIPEDA"
  | "Privacy-Act-1988"
  | "LGPD"
  | "POPIA"
  | "PDPA"
  | "None-Declared";

/**
 * A national/regional health identifier scheme.
 *
 * `system` is the FHIR `Identifier.system` URI. Where the jurisdiction (or
 * HL7) publishes an official naming system we use it verbatim; otherwise we
 * mint a stable URN under `urn:tabula-medica:id:` so the value is still
 * unambiguous on the wire and can be swapped for an official URI later
 * without changing the identifier's meaning.
 */
export interface HealthIdScheme {
  /** Short key, e.g. "abha", "nhs-number". */
  readonly key: string;
  /** Human label shown in the UI, e.g. "ABHA Number". */
  readonly label: string;
  /** FHIR Identifier.system URI. */
  readonly system: string;
  /**
   * Canonical digits/characters only, after `normalize()`. Used for a cheap
   * structural check — NOT proof the identifier is real or belongs to the
   * holder. Real verification requires the national authority's API.
   */
  readonly pattern: RegExp;
  /** Strip formatting (spaces, dashes) before matching `pattern`. */
  readonly normalize: (raw: string) => string;
  /**
   * Optional check-digit / checksum validator run after `pattern` matches.
   * Returning false means the identifier is structurally well-formed but
   * fails its own integrity check (i.e. it is a typo, not a valid ID).
   */
  readonly checksum?: (normalized: string) => boolean;
  /** Displayed back to the user, e.g. "14 digits, e.g. 12-3456-7890-1234". */
  readonly hint: string;
}

export interface Jurisdiction {
  readonly code: JurisdictionCode;
  readonly name: string;
  readonly privacyRegime: PrivacyRegime;
  /** Primary national health ID, if the country operates one. */
  readonly healthId?: HealthIdScheme;
  /**
   * Problem-code system considered authoritative locally, as a FHIR system
   * URI. IPS itself requires SNOMED CT, so this is the *additional* local
   * coding a receiving system in-country expects to see.
   */
  readonly localProblemCodeSystem?: string;
  /**
   * True when the jurisdiction operates a national health-data exchange that
   * the record can be pushed to or pulled from. Used to decide whether to
   * offer network features at all, instead of assuming TEFCA.
   */
  readonly hasNationalExchange: boolean;
  /** Name of that exchange, when `hasNationalExchange` is true. */
  readonly exchangeName?: string;
}

// ── Identifier helpers ──────────────────────────────────────────────────────

/** Remove every character that is not a digit. */
const digitsOnly = (raw: string): string => raw.replace(/\D/g, "");

/** Remove whitespace and dashes, uppercase the remainder. */
const compact = (raw: string): string =>
  raw.replace(/[\s-]/g, "").toUpperCase();

/**
 * Verhoeff checksum — the algorithm India's UIDAI uses for Aadhaar and which
 * the ABHA (Ayushman Bharat Health Account) number inherits. Unlike Luhn it
 * catches transposition errors, which is why UIDAI selected it.
 *
 * Implemented from the published dihedral-group tables.
 */
const VERHOEFF_D: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const VERHOEFF_P: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffIsValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let c = 0;
  const reversed = digits.split("").reverse();
  for (let i = 0; i < reversed.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][Number(reversed[i])]];
  }
  return c === 0;
}

/**
 * NHS Number check digit (modulus 11). The 10th digit is the check digit;
 * a computed remainder of 10 makes the number invalid by definition.
 */
export function nhsNumberIsValid(digits: string): boolean {
  if (!/^\d{10}$/.test(digits)) return false;
  let total = 0;
  for (let i = 0; i < 9; i++) {
    total += Number(digits[i]) * (10 - i);
  }
  const remainder = total % 11;
  const check = 11 - remainder;
  if (check === 11) return Number(digits[9]) === 0;
  if (check === 10) return false;
  return check === Number(digits[9]);
}

// ── The registry ────────────────────────────────────────────────────────────

const ABHA: HealthIdScheme = {
  key: "abha",
  label: "ABHA Number",
  // ABDM publishes ABHA under this naming system.
  system: "https://healthid.abdm.gov.in/ns/abha-number",
  pattern: /^\d{14}$/,
  normalize: digitsOnly,
  checksum: verhoeffIsValid,
  hint: "14 digits, e.g. 12-3456-7890-1234",
};

const NHS_NUMBER: HealthIdScheme = {
  key: "nhs-number",
  label: "NHS Number",
  system: "https://fhir.nhs.uk/Id/nhs-number",
  pattern: /^\d{10}$/,
  normalize: digitsOnly,
  checksum: nhsNumberIsValid,
  hint: "10 digits, e.g. 943 476 5919",
};

const MEDICARE_AU: HealthIdScheme = {
  key: "ihi",
  label: "Individual Healthcare Identifier (IHI)",
  system: "http://ns.electronichealth.net.au/id/hi/ihi/1.0",
  pattern: /^800360\d{10}$/,
  normalize: digitsOnly,
  hint: "16 digits beginning 800360",
};

const CA_PROVINCIAL: HealthIdScheme = {
  key: "phn",
  label: "Personal Health Number",
  system: "urn:tabula-medica:id:ca-phn",
  pattern: /^[0-9]{7,12}$/,
  normalize: digitsOnly,
  hint: "7–12 digits, format varies by province",
};

const US_MRN: HealthIdScheme = {
  key: "mrn",
  label: "Medical Record Number",
  system: "urn:tabula-medica:id:us-mrn",
  // The US has no national health identifier; MRNs are issuer-scoped and
  // therefore only locally unique. Kept permissive on purpose.
  pattern: /^[A-Z0-9]{1,32}$/,
  normalize: compact,
  hint: "Issued by your provider; format varies",
};

/**
 * Jurisdictions the World EHR knows about. Countries absent from this table
 * are still fully usable — `resolveJurisdiction` returns a safe default with
 * no national identifier and no assumed exchange.
 */
export const JURISDICTIONS: readonly Jurisdiction[] = [
  {
    code: "IN",
    name: "India",
    privacyRegime: "DPDP-2023",
    healthId: ABHA,
    // India's NDHM/ABDM programme standardised on ICD-10 while migrating to
    // ICD-11; both are emitted, with SNOMED CT as the IPS-required primary.
    localProblemCodeSystem: "http://id.who.int/icd/release/11/mms",
    hasNationalExchange: true,
    exchangeName: "ABDM (Ayushman Bharat Digital Mission)",
  },
  {
    code: "GB",
    name: "United Kingdom",
    privacyRegime: "UK-GDPR",
    healthId: NHS_NUMBER,
    localProblemCodeSystem: "http://snomed.info/sct",
    hasNationalExchange: true,
    exchangeName: "NHS England (Spine / NRL)",
  },
  {
    code: "AU",
    name: "Australia",
    privacyRegime: "Privacy-Act-1988",
    healthId: MEDICARE_AU,
    localProblemCodeSystem: "http://snomed.info/sct",
    hasNationalExchange: true,
    exchangeName: "My Health Record",
  },
  {
    code: "CA",
    name: "Canada",
    privacyRegime: "PIPEDA",
    healthId: CA_PROVINCIAL,
    localProblemCodeSystem: "http://snomed.info/sct",
    hasNationalExchange: false,
  },
  {
    code: "US",
    name: "United States",
    privacyRegime: "HIPAA",
    healthId: US_MRN,
    localProblemCodeSystem: "http://hl7.org/fhir/sid/icd-10-cm",
    hasNationalExchange: true,
    exchangeName: "TEFCA",
  },
  {
    code: "DE",
    name: "Germany",
    privacyRegime: "GDPR",
    localProblemCodeSystem: "http://fhir.de/CodeSystem/bfarm/icd-10-gm",
    hasNationalExchange: true,
    exchangeName: "gematik Telematikinfrastruktur (ePA)",
  },
  {
    code: "BR",
    name: "Brazil",
    privacyRegime: "LGPD",
    localProblemCodeSystem: "http://id.who.int/icd/release/11/mms",
    hasNationalExchange: true,
    exchangeName: "RNDS (Rede Nacional de Dados em Saúde)",
  },
  {
    code: "ZA",
    name: "South Africa",
    privacyRegime: "POPIA",
    localProblemCodeSystem: "http://id.who.int/icd/release/11/mms",
    hasNationalExchange: false,
  },
  {
    code: "SG",
    name: "Singapore",
    privacyRegime: "PDPA",
    localProblemCodeSystem: "http://snomed.info/sct",
    hasNationalExchange: true,
    exchangeName: "NEHR (National Electronic Health Record)",
  },
];

/** Fallback used for any country not in `JURISDICTIONS`. */
export const UNKNOWN_JURISDICTION: Jurisdiction = {
  code: "ZZ",
  name: "Unspecified",
  privacyRegime: "None-Declared",
  hasNationalExchange: false,
};

const BY_CODE = new Map<string, Jurisdiction>(
  JURISDICTIONS.map((j) => [j.code, j]),
);

/**
 * Look up a jurisdiction by ISO 3166-1 alpha-2 code. Unknown or missing codes
 * resolve to `UNKNOWN_JURISDICTION` rather than throwing — an unrecognised
 * country must never block a patient from holding their own record.
 */
export function resolveJurisdiction(
  code: string | null | undefined,
): Jurisdiction {
  if (!code) return UNKNOWN_JURISDICTION;
  return BY_CODE.get(code.trim().toUpperCase()) ?? UNKNOWN_JURISDICTION;
}

export type HealthIdValidation =
  | { readonly ok: true; readonly normalized: string; readonly system: string }
  | { readonly ok: false; readonly reason: HealthIdRejection };

export type HealthIdRejection =
  | "no-scheme"       // jurisdiction operates no national health ID
  | "empty"
  | "malformed"       // failed the structural pattern
  | "checksum-failed"; // well-formed but fails its own check digit

/**
 * Structurally validate a national health identifier for a jurisdiction.
 *
 * This proves the value is *well-formed*, not that it exists or belongs to
 * the holder. Binding an identifier to a person requires the national
 * authority (for India, an ABDM auth flow) and is deliberately out of scope
 * here — this module stays pure and offline.
 */
export function validateHealthId(
  jurisdiction: Jurisdiction,
  raw: string,
): HealthIdValidation {
  const scheme = jurisdiction.healthId;
  if (!scheme) return { ok: false, reason: "no-scheme" };
  if (!raw || !raw.trim()) return { ok: false, reason: "empty" };

  const normalized = scheme.normalize(raw);
  if (!scheme.pattern.test(normalized)) {
    return { ok: false, reason: "malformed" };
  }
  if (scheme.checksum && !scheme.checksum(normalized)) {
    return { ok: false, reason: "checksum-failed" };
  }
  return { ok: true, normalized, system: scheme.system };
}
