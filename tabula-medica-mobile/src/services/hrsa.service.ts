/**
 * hrsa.service.ts
 * Tabula Medica — HRSA Federally Qualified Health Center (FQHC) Finder
 *
 * Wraps the HRSA findahealthcenter.hrsa.gov public API.
 * Free, open, no API key required.
 * Returns 1,400+ FQHCs and rural health clinics nationwide by ZIP.
 *
 * FQHCs are legally required under 42 U.S.C. § 254b to see ALL patients
 * regardless of ability to pay, on a sliding fee scale.
 * They are the backbone of the Uninsurance provider network.
 *
 * Drop into: src/services/hrsa.service.ts
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const HRSA_BASE_URL = 'https://findahealthcenter.hrsa.gov/api/v1';

// Default search radius in miles
const DEFAULT_RADIUS_MILES = 25;

// Request timeout (ms) — HRSA API can be slow on mobile networks
const REQUEST_TIMEOUT_MS = 12000;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HRSAClinic {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMiles: number | null;
  acceptsUninsured: boolean;   // sliding fee scale
  acceptsMedicaid: boolean;
  acceptsMedicare: boolean;
  services: string[];
  languages: string[];
  clinicType: HRSAClinciType;
  hoursNote: string | null;
}

export type HRSAClinciType =
  | 'FQHC'               // Federally Qualified Health Center
  | 'FQHC_LOOK_ALIKE'    // FQHC Look-Alike (same sliding fee obligation)
  | 'RURAL_HEALTH'       // Rural Health Clinic
  | 'FREE_CLINIC'        // Free / charitable clinic
  | 'OTHER';

export interface HRSASearchParams {
  zip: string;
  radiusMiles?: number;
  type?: HRSAClinciType | 'ALL';
  serviceFilter?: string;   // e.g. 'dental', 'mental_health', 'pharmacy'
}

export interface HRSASearchResult {
  clinics: HRSAClinic[];
  totalFound: number;
  searchedZip: string;
  radiusMiles: number;
  source: 'api' | 'fallback';
}

// ─── Raw API response types ───────────────────────────────────────────────────

interface HRSARawItem {
  id?: string;
  attributes?: {
    site_name?: string;
    site_address?: string;
    site_city?: string;
    site_state?: string;
    site_zipcode?: string;
    site_telephone_number?: string;
    site_web_address?: string;
    latitude?: string | number;
    longitude?: string | number;
    distance?: string | number;
    sliding_fee_scale?: boolean | string;
    accepts_medicaid?: boolean | string;
    accepts_medicare?: boolean | string;
    site_services?: string[];
    languages_spoken?: string[];
    site_type?: string;
    clinic_type?: string;
    hours_of_operation?: string;
  };
}

interface HRSARawResponse {
  data?: HRSARawItem[];
  meta?: {
    total_count?: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseClinicType(raw: string | undefined): HRSAClinciType {
  if (!raw) return 'OTHER';
  const u = raw.toUpperCase();
  if (u.includes('LOOK') || u.includes('LOOKALIKE')) return 'FQHC_LOOK_ALIKE';
  if (u.includes('FQHC') || u.includes('HEALTH CENTER')) return 'FQHC';
  if (u.includes('RURAL')) return 'RURAL_HEALTH';
  if (u.includes('FREE')) return 'FREE_CLINIC';
  return 'FQHC'; // default assumption — if in HRSA DB, likely FQHC
}

function parseBool(v: boolean | string | undefined): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1' || v.toLowerCase() === 'yes';
  return true; // default to true — all HRSA clinics have sliding fee obligation
}

function parseFloat2(v: string | number | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return isNaN(n) ? null : Math.round(n * 10) / 10;
}

function normalizeClinic(raw: HRSARawItem): HRSAClinic {
  const a = raw.attributes ?? {};
  const address = [a.site_address, a.site_city, a.site_state].filter(Boolean).join(', ');

  return {
    id: raw.id ?? String(Math.random()),
    name: a.site_name ?? 'Health Center',
    address: address || 'Address on file',
    city: a.site_city ?? '',
    state: a.site_state ?? '',
    zip: a.site_zipcode ?? '',
    phone: a.site_telephone_number ?? null,
    website: a.site_web_address ?? null,
    latitude: parseFloat2(a.latitude),
    longitude: parseFloat2(a.longitude),
    distanceMiles: parseFloat2(a.distance),
    acceptsUninsured: parseBool(a.sliding_fee_scale),
    acceptsMedicaid: parseBool(a.accepts_medicaid),
    acceptsMedicare: parseBool(a.accepts_medicare),
    services: Array.isArray(a.site_services) ? a.site_services : [],
    languages: Array.isArray(a.languages_spoken) ? a.languages_spoken : [],
    clinicType: parseClinicType(a.clinic_type ?? a.site_type),
    hoursNote: a.hours_of_operation ?? null,
  };
}

// Fetch with timeout helper
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return resp;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Find HRSA-registered clinics near a ZIP code.
 *
 * @example
 * const result = await findClinics('22301', 20);
 * // result.clinics → HRSAClinic[]
 * // result.totalFound → number
 */
export async function findClinics(
  zip: string,
  radiusMiles: number = DEFAULT_RADIUS_MILES,
): Promise<HRSAClinic[]> {
  const cleanZip = zip.trim().replace(/\D/g, '').slice(0, 5);
  if (cleanZip.length !== 5) {
    throw new Error(`Invalid ZIP code: "${zip}"`);
  }

  const url =
    `${HRSA_BASE_URL}/health-centers` +
    `?zip=${encodeURIComponent(cleanZip)}` +
    `&radius=${radiusMiles}` +
    `&filter[sliding_fee_scale]=true` +
    `&page[size]=20` +
    `&sort=distance`;

  let resp: Response;
  try {
    resp = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('HRSA search timed out. Please check your connection and try again.');
    }
    throw new Error(`HRSA API unreachable: ${(err as Error).message}`);
  }

  if (!resp.ok) {
    throw new Error(`HRSA API error ${resp.status}: ${resp.statusText}`);
  }

  let json: HRSARawResponse;
  try {
    json = await resp.json();
  } catch {
    throw new Error('HRSA returned an unexpected response format.');
  }

  const items = json.data ?? [];
  return items
    .map(normalizeClinic)
    .sort((a, b) => (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99));
}

/**
 * Full search — returns metadata alongside results.
 */
export async function searchClinics(params: HRSASearchParams): Promise<HRSASearchResult> {
  const radius = params.radiusMiles ?? DEFAULT_RADIUS_MILES;
  const clinics = await findClinics(params.zip, radius);

  const filtered =
    params.type && params.type !== 'ALL'
      ? clinics.filter((c) => c.clinicType === params.type)
      : clinics;

  return {
    clinics: filtered,
    totalFound: filtered.length,
    searchedZip: params.zip,
    radiusMiles: radius,
    source: 'api',
  };
}

/**
 * Get a single clinic by HRSA ID.
 * Useful for the booking confirmation screen.
 */
export async function getClinicById(id: string): Promise<HRSAClinic | null> {
  const url = `${HRSA_BASE_URL}/health-centers/${encodeURIComponent(id)}`;
  try {
    const resp = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
    if (!resp.ok) return null;
    const json = await resp.json();
    return json.data ? normalizeClinic(json.data) : null;
  } catch {
    return null;
  }
}

// ─── Medicare Rate table ──────────────────────────────────────────────────────
// Kept in this file for convenience — move to medicareRates.service.ts if preferred.

export interface MedicareRate {
  cptCode: string;
  serviceName: string;
  medicareRate2026: number;
  typicalMarket: number;      // rough chargemaster midpoint for savings display
  category: 'office' | 'lab' | 'imaging' | 'pharmacy' | 'mental_health' | 'other';
  requiresOrder: boolean;     // whether provider order is needed
}

export const MEDICARE_RATES: MedicareRate[] = [
  { cptCode: '99213', serviceName: 'Office Visit — Established (Level 3)', medicareRate2026: 82.40, typicalMarket: 350, category: 'office', requiresOrder: false },
  { cptCode: '99203', serviceName: 'Office Visit — New Patient (Level 3)', medicareRate2026: 136.44, typicalMarket: 450, category: 'office', requiresOrder: false },
  { cptCode: '99204', serviceName: 'Office Visit — New Patient (Level 4)', medicareRate2026: 170.00, typicalMarket: 600, category: 'office', requiresOrder: false },
  { cptCode: '99213-GT', serviceName: 'Telehealth Visit — Established', medicareRate2026: 75.00, typicalMarket: 200, category: 'office', requiresOrder: false },
  { cptCode: 'G0439', serviceName: 'Annual Wellness Visit', medicareRate2026: 118.00, typicalMarket: 500, category: 'office', requiresOrder: false },
  { cptCode: '90834', serviceName: 'Mental Health — 45 min Therapy', medicareRate2026: 77.00, typicalMarket: 250, category: 'mental_health', requiresOrder: false },
  { cptCode: '80053', serviceName: 'Comprehensive Metabolic Panel (CMP)', medicareRate2026: 12.50, typicalMarket: 250, category: 'lab', requiresOrder: true },
  { cptCode: '85025', serviceName: 'CBC with Differential', medicareRate2026: 11.00, typicalMarket: 180, category: 'lab', requiresOrder: true },
  { cptCode: '83036', serviceName: 'HbA1c — Diabetes Management', medicareRate2026: 12.00, typicalMarket: 120, category: 'lab', requiresOrder: true },
  { cptCode: '80061', serviceName: 'Lipid Panel', medicareRate2026: 17.00, typicalMarket: 150, category: 'lab', requiresOrder: true },
  { cptCode: '84443', serviceName: 'TSH — Thyroid', medicareRate2026: 19.00, typicalMarket: 160, category: 'lab', requiresOrder: true },
  { cptCode: '71046', serviceName: 'Chest X-Ray — 2 Views', medicareRate2026: 42.00, typicalMarket: 500, category: 'imaging', requiresOrder: true },
  { cptCode: '70553', serviceName: 'MRI Brain with & without Contrast', medicareRate2026: 280.00, typicalMarket: 4000, category: 'imaging', requiresOrder: true },
  { cptCode: '93000', serviceName: 'EKG with Interpretation', medicareRate2026: 22.00, typicalMarket: 200, category: 'other', requiresOrder: true },
];

export function getMedicareRate(cptCode: string): MedicareRate | undefined {
  return MEDICARE_RATES.find((r) => r.cptCode === cptCode);
}
