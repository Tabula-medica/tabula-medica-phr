import { Router, Request, Response } from "express";

const HRSA_BASE_URL = "https://findahealthcenter.hrsa.gov/api/v1";
const DEFAULT_RADIUS_MILES = 25;
const REQUEST_TIMEOUT_MS = 12000;

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
  acceptsUninsured: boolean;
  acceptsMedicaid: boolean;
  acceptsMedicare: boolean;
  services: string[];
  languages: string[];
  clinicType: HRSAClinicType;
  hoursNote: string | null;
}

export type HRSAClinicType =
  | "FQHC"
  | "FQHC_LOOK_ALIKE"
  | "RURAL_HEALTH"
  | "FREE_CLINIC"
  | "OTHER";

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

function parseClinicType(raw: string | undefined): HRSAClinicType {
  if (!raw) return "OTHER";
  const u = raw.toUpperCase();
  if (u.includes("LOOK") || u.includes("LOOKALIKE")) return "FQHC_LOOK_ALIKE";
  if (u.includes("FQHC") || u.includes("HEALTH CENTER")) return "FQHC";
  if (u.includes("RURAL")) return "RURAL_HEALTH";
  if (u.includes("FREE")) return "FREE_CLINIC";
  return "FQHC";
}

function parseBool(v: boolean | string | undefined): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v.toLowerCase() === "true" || v === "1" || v.toLowerCase() === "yes";
  return true;
}

function parseFloat2(v: string | number | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? null : Math.round(n * 10) / 10;
}

function normalizeClinic(raw: HRSARawItem): HRSAClinic {
  const a = raw.attributes ?? {};
  const address = [a.site_address, a.site_city, a.site_state].filter(Boolean).join(", ");
  return {
    id: raw.id ?? String(Math.random()),
    name: a.site_name ?? "Health Center",
    address: address || "Address on file",
    city: a.site_city ?? "",
    state: a.site_state ?? "",
    zip: a.site_zipcode ?? "",
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

async function fetchWithTimeout(url: string, ms: number): Promise<globalThis.Response> {
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

export async function findClinics(zip: string, radiusMiles: number = DEFAULT_RADIUS_MILES): Promise<HRSAClinic[]> {
  const cleanZip = zip.trim().replace(/\D/g, "").slice(0, 5);
  if (cleanZip.length !== 5) throw new Error(`Invalid ZIP code: "${zip}"`);

  const url =
    `${HRSA_BASE_URL}/health-centers` +
    `?zip=${encodeURIComponent(cleanZip)}` +
    `&radius=${radiusMiles}` +
    `&filter[sliding_fee_scale]=true` +
    `&page[size]=20` +
    `&sort=distance`;

  let resp: globalThis.Response;
  try {
    resp = await fetchWithTimeout(url, REQUEST_TIMEOUT_MS);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("HRSA search timed out. Please check your connection and try again.");
    }
    throw new Error(`HRSA API unreachable: ${(err as Error).message}`);
  }

  if (!resp.ok) throw new Error(`HRSA API error ${resp.status}: ${resp.statusText}`);

  let json: { data?: HRSARawItem[]; meta?: { total_count?: number } };
  try {
    json = await resp.json() as any;
  } catch {
    throw new Error("HRSA returned an unexpected response format.");
  }

  return (json.data ?? [])
    .map(normalizeClinic)
    .sort((a, b) => (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99));
}

const DEMO_CLINICS: Record<string, HRSAClinic[]> = {
  "22301": [
    { id: "hrsa-1", name: "Arlington FQHC Community Health", address: "1801 N George Mason Dr, Arlington, VA", city: "Arlington", state: "VA", zip: "22301", phone: "(703) 558-6800", website: "https://arlingtonfreeclinic.org", latitude: 38.88, longitude: -77.10, distanceMiles: 0.8, acceptsUninsured: true, acceptsMedicaid: true, acceptsMedicare: true, services: ["Primary Care", "Dental", "Behavioral Health"], languages: ["English", "Spanish", "Amharic"], clinicType: "FQHC", hoursNote: "Mon-Fri 8am-6pm, Sat 9am-1pm" },
    { id: "hrsa-2", name: "Alexandria Neighborhood Health Services", address: "2204 Mt Vernon Ave, Alexandria, VA", city: "Alexandria", state: "VA", zip: "22301", phone: "(703) 535-5568", website: null, latitude: 38.83, longitude: -77.06, distanceMiles: 2.1, acceptsUninsured: true, acceptsMedicaid: true, acceptsMedicare: true, services: ["Primary Care", "Pediatrics", "Women's Health"], languages: ["English", "Spanish"], clinicType: "FQHC", hoursNote: "Mon-Fri 8am-5pm" },
    { id: "hrsa-3", name: "Virginia Community Healthcare Association", address: "305 S Washington St, Falls Church, VA", city: "Falls Church", state: "VA", zip: "22046", phone: "(703) 248-5700", website: null, latitude: 38.88, longitude: -77.17, distanceMiles: 3.4, acceptsUninsured: true, acceptsMedicaid: true, acceptsMedicare: true, services: ["Primary Care"], languages: ["English", "Korean", "Vietnamese"], clinicType: "RURAL_HEALTH", hoursNote: "Mon-Fri 9am-5pm" },
  ],
  "75201": [
    { id: "hrsa-4", name: "Parkland Community Health Plan", address: "5200 Harry Hines Blvd, Dallas, TX", city: "Dallas", state: "TX", zip: "75235", phone: "(214) 590-8000", website: "https://phhs.org", latitude: 32.81, longitude: -96.84, distanceMiles: 0.7, acceptsUninsured: true, acceptsMedicaid: true, acceptsMedicare: true, services: ["Primary Care", "OB/GYN", "Pediatrics", "Dental"], languages: ["English", "Spanish"], clinicType: "FQHC", hoursNote: "Mon-Fri 7am-7pm, Sat 8am-12pm" },
    { id: "hrsa-5", name: "Los Barrios Unidos Community Clinic", address: "809 Singleton Blvd, Dallas, TX", city: "Dallas", state: "TX", zip: "75212", phone: "(214) 540-0300", website: null, latitude: 32.78, longitude: -96.84, distanceMiles: 1.5, acceptsUninsured: true, acceptsMedicaid: true, acceptsMedicare: true, services: ["Primary Care", "Pharmacy", "Lab"], languages: ["English", "Spanish"], clinicType: "FQHC", hoursNote: "Mon-Fri 8am-5pm" },
  ],
  "10001": [
    { id: "hrsa-6", name: "Community Healthcare Network - Lower East Side", address: "79 Clinton St, New York, NY", city: "New York", state: "NY", zip: "10002", phone: "(212) 432-8000", website: "https://chnnyc.org", latitude: 40.72, longitude: -73.98, distanceMiles: 0.3, acceptsUninsured: true, acceptsMedicaid: true, acceptsMedicare: true, services: ["Primary Care", "Dental", "Behavioral Health", "Pharmacy"], languages: ["English", "Spanish", "Mandarin", "Cantonese"], clinicType: "FQHC", hoursNote: "Mon-Fri 8am-8pm, Sat 9am-5pm" },
    { id: "hrsa-7", name: "Ryan Chelsea-Clinton Community Health Center", address: "645 10th Ave, New York, NY", city: "New York", state: "NY", zip: "10036", phone: "(212) 265-4500", website: null, latitude: 40.76, longitude: -73.99, distanceMiles: 0.8, acceptsUninsured: true, acceptsMedicaid: true, acceptsMedicare: true, services: ["Primary Care", "OB/GYN", "Mental Health"], languages: ["English", "Spanish"], clinicType: "FQHC", hoursNote: "Mon-Fri 8am-6pm" },
  ],
};

function getDemoClinics(zip: string): HRSAClinic[] {
  return DEMO_CLINICS[zip] || [
    { id: `hrsa-gen-1`, name: `Community Health Center (${zip})`, address: `Near ${zip}`, city: "", state: "", zip, phone: null, website: null, latitude: null, longitude: null, distanceMiles: 1.2, acceptsUninsured: true, acceptsMedicaid: true, acceptsMedicare: true, services: ["Primary Care"], languages: ["English", "Spanish"], clinicType: "FQHC", hoursNote: "Mon-Fri 8am-5pm" },
    { id: `hrsa-gen-2`, name: `Free Clinic (${zip})`, address: `Near ${zip}`, city: "", state: "", zip, phone: null, website: null, latitude: null, longitude: null, distanceMiles: 2.5, acceptsUninsured: true, acceptsMedicaid: true, acceptsMedicare: false, services: ["Primary Care", "Lab"], languages: ["English"], clinicType: "FREE_CLINIC", hoursNote: "Mon-Fri 9am-4pm" },
  ];
}

export function createHRSARouter(): Router {
  const router = Router();

  router.get("/search", async (req: Request, res: Response) => {
    const zip = (req.query.zip as string || "").trim();
    const radius = parseInt(req.query.radius as string) || DEFAULT_RADIUS_MILES;

    if (!zip || zip.length !== 5) {
      res.status(400).json({ error: "Valid 5-digit ZIP code required" });
      return;
    }

    try {
      const clinics = await findClinics(zip, radius);
      res.json({
        clinics,
        totalFound: clinics.length,
        searchedZip: zip,
        radiusMiles: radius,
        source: "api" as const,
      });
    } catch (err) {
      console.warn("[HRSA] API error, falling back to demo data:", (err as Error).message);
      const demoClinics = getDemoClinics(zip);
      res.json({
        clinics: demoClinics,
        totalFound: demoClinics.length,
        searchedZip: zip,
        radiusMiles: radius,
        source: "demo" as const,
      });
    }
  });

  return router;
}
