// Enriches an NPI with public CMS Provider Data Catalog datasets (no key, no DB):
//   mj5m-pzi6  Doctors and Clinicians National Downloadable File
//   27ea-46a8  Facility Affiliation Data
//   xubh-q36u  Hospital General Information (to name affiliated hospitals)
// data.cms.gov sits behind Akamai, which rejects Node's default User-Agent with
// a 403, so every request sends a browser-style User-Agent.

const CMS_BASE = "https://data.cms.gov/provider-data/api/1/datastore/query";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export const CMS_TIMEOUT_MS = 12_000; // the clinician file is large; CMS often takes 3-10s
const HOSPITAL_TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const MAX_HOSPITAL_LOOKUPS = 3;

export interface CmsLocation {
  facilityName: string;
  groupPacId: string;
  groupMemberCount: number | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  acceptsMedicareAssignment: boolean | null;
}

export interface CmsAffiliation {
  facilityType: string;
  ccn: string;
  name: string | null;
  city: string | null;
  state: string | null;
}

export interface CmsClinicianProfile {
  npi: string;
  available: boolean; // false = CMS unreachable / timed out (graceful fallback)
  medicareEnrolled: boolean; // present in the Medicare clinician file
  enrollmentId: string | null;
  credential: string | null;
  medicalSchool: string | null;
  graduationYear: number | null;
  primarySpecialty: string | null;
  secondarySpecialties: string[];
  telehealth: boolean | null; // null = CMS did not report it
  locations: CmsLocation[];
  affiliations: CmsAffiliation[];
  source: string;
  fetchedAt: string;
}

type Row = Record<string, string | undefined>;

const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const yn = (v: unknown): boolean | null => (s(v) === "Y" ? true : s(v) === "N" ? false : null);

export function cmsQueryUrl(dataset: string, property: string, value: string, limit = 50): string {
  const p = new URLSearchParams({
    "conditions[0][property]": property,
    "conditions[0][value]": value,
    "conditions[0][operator]": "=",
    limit: String(limit),
    count: "false",
    schema: "false",
  });
  return `${CMS_BASE}/${dataset}/0?${p.toString()}`;
}

async function cmsRows(url: string, timeoutMs: number, fetchImpl: typeof fetch): Promise<Row[]> {
  const res = await fetchImpl(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`CMS HTTP ${res.status}`);
  const json = (await res.json()) as { results?: Row[] };
  return Array.isArray(json.results) ? json.results : [];
}

/** Pure mapping from CMS rows to the profile shape (unit-tested). */
export function buildProfile(npi: string, clinicianRows: Row[], affiliationRows: Row[]): CmsClinicianProfile {
  const first = clinicianRows[0];
  const seenLoc = new Set<string>();
  const locations: CmsLocation[] = [];
  for (const r of clinicianRows) {
    const key = s(r.adrs_id) || `${s(r.facility_name)}|${s(r.adr_ln_1)}`;
    if (seenLoc.has(key)) continue;
    seenLoc.add(key);
    const members = parseInt(s(r.num_org_mem), 10);
    locations.push({
      facilityName: s(r.facility_name),
      groupPacId: s(r.org_pac_id),
      groupMemberCount: Number.isFinite(members) ? members : null,
      address: [s(r.adr_ln_1), s(r.adr_ln_2)].filter(Boolean).join(", "),
      city: s(r.citytown),
      state: s(r.state),
      zip: s(r.zip_code).slice(0, 5),
      phone: s(r.telephone_number),
      acceptsMedicareAssignment: yn(r.ind_assgn),
    });
  }
  const seenAff = new Set<string>();
  const affiliations: CmsAffiliation[] = [];
  for (const r of affiliationRows) {
    const ccn = s(r.facility_affiliations_certification_number);
    if (!ccn || seenAff.has(ccn)) continue;
    seenAff.add(ccn);
    affiliations.push({ facilityType: s(r.facility_type), ccn, name: null, city: null, state: null });
  }
  const year = parseInt(s(first?.grd_yr), 10);
  const tele = clinicianRows.map((r) => yn(r.telehlth));
  return {
    npi,
    available: true,
    medicareEnrolled: clinicianRows.length > 0,
    enrollmentId: s(first?.ind_enrl_id) || null,
    credential: s(first?.cred) || null,
    medicalSchool: s(first?.med_sch) && s(first?.med_sch) !== "OTHER" ? s(first?.med_sch) : null,
    graduationYear: Number.isFinite(year) ? year : null,
    primarySpecialty: s(first?.pri_spec) || null,
    secondarySpecialties: s(first?.sec_spec_all) ? s(first?.sec_spec_all).split(",").map((x) => x.trim()).filter(Boolean) : [],
    telehealth: tele.includes(true) ? true : tele.includes(false) ? false : null,
    locations,
    affiliations,
    source: "CMS Provider Data Catalog (Doctors and Clinicians; Facility Affiliations)",
    fetchedAt: new Date().toISOString(),
  };
}

export function unavailableProfile(npi: string): CmsClinicianProfile {
  return {
    npi, available: false, medicareEnrolled: false, enrollmentId: null, credential: null,
    medicalSchool: null, graduationYear: null, primarySpecialty: null, secondarySpecialties: [],
    telehealth: null, locations: [], affiliations: [], source: "CMS Provider Data Catalog",
    fetchedAt: new Date().toISOString(),
  };
}

const cache = new Map<string, { at: number; data: CmsClinicianProfile }>();

export function clearCmsCache() {
  cache.clear();
}

export async function getCmsClinicianProfile(npi: string, fetchImpl: typeof fetch = fetch): Promise<CmsClinicianProfile> {
  const hit = cache.get(npi);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const [clin, aff] = await Promise.allSettled([
    cmsRows(cmsQueryUrl("mj5m-pzi6", "npi", npi), CMS_TIMEOUT_MS, fetchImpl),
    cmsRows(cmsQueryUrl("27ea-46a8", "npi", npi), CMS_TIMEOUT_MS, fetchImpl),
  ]);
  if (clin.status === "rejected") {
    console.warn(`[CMS] clinician lookup failed for NPI ${npi}: ${(clin.reason as Error)?.message}`);
    return unavailableProfile(npi); // not cached, so the next request retries
  }
  const profile = buildProfile(npi, clin.value, aff.status === "fulfilled" ? aff.value : []);

  // Best effort: name up to 3 affiliated hospitals.
  const hospitals = profile.affiliations.filter((a) => /hospital/i.test(a.facilityType)).slice(0, MAX_HOSPITAL_LOOKUPS);
  await Promise.allSettled(
    hospitals.map(async (a) => {
      const rows = await cmsRows(cmsQueryUrl("xubh-q36u", "facility_id", a.ccn, 1), HOSPITAL_TIMEOUT_MS, fetchImpl);
      if (rows[0]) {
        a.name = s(rows[0].facility_name) || null;
        a.city = s(rows[0].citytown) || null;
        a.state = s(rows[0].state) || null;
      }
    }),
  );

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(npi, { at: Date.now(), data: profile });
  return profile;
}
