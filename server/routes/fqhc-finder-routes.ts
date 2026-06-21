import { Router } from "express";

const router = Router();

interface FQHCCenter {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  distance: number;
  services: string[];
  hours: string;
  languages: string[];
  slidingFeeScale: boolean;
  website: string;
  lat: number;
  lng: number;
}

const fqhcCache = new Map<string, { data: FQHCCenter[]; expiry: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function generateFQHCData(zip: string, radius: number, serviceFilter?: string): FQHCCenter[] {
  const centers: FQHCCenter[] = [
    {
      id: "fqhc-1",
      name: "Community Health Center of Greater Springfield",
      address: "1200 Main Street",
      city: "Springfield",
      state: "IL",
      zip: zip,
      phone: "(217) 555-0101",
      distance: 1.2,
      services: ["primary_care", "dental", "mental_health", "pharmacy", "prenatal"],
      hours: "Mon-Fri 8AM-6PM, Sat 9AM-1PM",
      languages: ["English", "Spanish", "Arabic"],
      slidingFeeScale: true,
      website: "https://example-chc.org",
      lat: 39.7817,
      lng: -89.6501,
    },
    {
      id: "fqhc-2",
      name: "Neighborhood Family Health Center",
      address: "450 Oak Avenue",
      city: "Springfield",
      state: "IL",
      zip: zip,
      phone: "(217) 555-0202",
      distance: 2.8,
      services: ["primary_care", "dental", "pharmacy", "pediatrics"],
      hours: "Mon-Fri 7AM-7PM",
      languages: ["English", "Spanish", "Vietnamese"],
      slidingFeeScale: true,
      website: "https://example-nfhc.org",
      lat: 39.7900,
      lng: -89.6400,
    },
    {
      id: "fqhc-3",
      name: "Unity Health Alliance",
      address: "789 Elm Boulevard",
      city: "Springfield",
      state: "IL",
      zip: zip,
      phone: "(217) 555-0303",
      distance: 4.5,
      services: ["primary_care", "mental_health", "substance_abuse", "prenatal"],
      hours: "Mon-Sat 8AM-8PM",
      languages: ["English", "Spanish", "Mandarin", "Tagalog"],
      slidingFeeScale: true,
      website: "https://example-uha.org",
      lat: 39.7700,
      lng: -89.6300,
    },
    {
      id: "fqhc-4",
      name: "Healthy Start Community Clinic",
      address: "2100 Riverside Drive",
      city: "Springfield",
      state: "IL",
      zip: zip,
      phone: "(217) 555-0404",
      distance: 5.1,
      services: ["primary_care", "dental", "pharmacy", "prenatal", "pediatrics"],
      hours: "Mon-Fri 8AM-5PM",
      languages: ["English", "Spanish"],
      slidingFeeScale: true,
      website: "https://example-hscc.org",
      lat: 39.7600,
      lng: -89.6200,
    },
    {
      id: "fqhc-5",
      name: "Metro Dental & Health Services",
      address: "567 Washington Street",
      city: "Springfield",
      state: "IL",
      zip: zip,
      phone: "(217) 555-0505",
      distance: 6.3,
      services: ["dental", "primary_care", "pharmacy"],
      hours: "Mon-Thu 9AM-6PM, Fri 9AM-3PM",
      languages: ["English", "Spanish", "Somali"],
      slidingFeeScale: true,
      website: "https://example-mdhs.org",
      lat: 39.7500,
      lng: -89.6100,
    },
    {
      id: "fqhc-6",
      name: "Hope Behavioral Health Center",
      address: "321 Pine Street",
      city: "Springfield",
      state: "IL",
      zip: zip,
      phone: "(217) 555-0606",
      distance: 7.8,
      services: ["mental_health", "substance_abuse", "primary_care"],
      hours: "Mon-Fri 8AM-8PM, Sat 10AM-4PM",
      languages: ["English", "Spanish", "French", "Haitian Creole"],
      slidingFeeScale: true,
      website: "https://example-hbhc.org",
      lat: 39.7400,
      lng: -89.6000,
    },
  ];

  let filtered = centers.filter((c) => c.distance <= radius);

  if (serviceFilter && serviceFilter !== "all") {
    const services = serviceFilter.split(",");
    filtered = filtered.filter((c) =>
      services.some((s) => c.services.includes(s.trim()))
    );
  }

  return filtered.sort((a, b) => a.distance - b.distance);
}

router.get("/search", (req, res) => {
  try {
    const zip = (req.query.zip as string) || "62701";
    const radius = parseInt(req.query.radius as string) || 25;
    const services = req.query.services as string | undefined;

    if (!/^\d{5}$/.test(zip)) {
      return res.status(400).json({ error: "Invalid ZIP code format. Must be 5 digits." });
    }

    const cacheKey = `${zip}-${radius}-${services || "all"}`;
    const cached = fqhcCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      console.log(`[FQHC] Cache hit for ${cacheKey}`);
      return res.json({ centers: cached.data, cached: true, total: cached.data.length });
    }

    console.log(`[FQHC] Searching: zip=${zip}, radius=${radius}mi, services=${services || "all"}`);

    const centers = generateFQHCData(zip, radius, services);

    fqhcCache.set(cacheKey, { data: centers, expiry: Date.now() + CACHE_TTL });

    res.json({
      centers,
      cached: false,
      total: centers.length,
      searchParams: { zip, radius, services: services || "all" },
      hrsaApiUrl: `https://findahealthcenter.hrsa.gov/api/json/?zip=${zip}&radius=${radius}${services ? `&services=${services}` : ""}`,
    });
  } catch (error) {
    console.error("[FQHC] Search error:", error);
    res.status(500).json({ error: "Failed to search FQHC centers" });
  }
});

router.get("/services", (_req, res) => {
  res.json({
    services: [
      { id: "all", label: "All Services", icon: "🏥" },
      { id: "dental", label: "Dental", icon: "🦷" },
      { id: "mental_health", label: "Mental Health", icon: "🧠" },
      { id: "pharmacy", label: "Pharmacy", icon: "💊" },
      { id: "prenatal", label: "Prenatal", icon: "🤰" },
      { id: "primary_care", label: "Primary Care", icon: "👩‍⚕️" },
      { id: "pediatrics", label: "Pediatrics", icon: "👶" },
      { id: "substance_abuse", label: "Substance Use", icon: "🫂" },
    ],
  });
});

router.get("/stats", (_req, res) => {
  res.json({
    totalCenters: 1400,
    statesServed: 50,
    patientsServed: "30M+",
    noAuthRequired: true,
    noCostToPatient: true,
    noImmigrationCheck: true,
    slidingFeeScale: true,
    description: "HRSA-funded Federally Qualified Health Centers (FQHCs) are required to see all patients regardless of ability to pay, insurance status, or immigration status.",
  });
});

export default router;
