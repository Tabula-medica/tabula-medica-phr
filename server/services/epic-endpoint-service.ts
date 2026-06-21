import crypto from "crypto";

const EPIC_ENDPOINTS_URL = "https://open.epic.com/Endpoints/R4";

interface EpicEndpoint {
  name: string;
  baseUrl: string;
  managingOrganization?: string;
}

interface EndpointCache {
  endpoints: EpicEndpoint[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let endpointCache: EndpointCache | null = null;

function hashId(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 12);
}

function logAudit(action: string, details: string) {
  const ts = new Date().toISOString();
  console.log(`[HIPAA-AUDIT][EpicEndpoints] ${ts} - ${action} - ${details}`);
}

async function fetchEndpoints(): Promise<EpicEndpoint[]> {
  if (endpointCache && Date.now() - endpointCache.fetchedAt < CACHE_TTL_MS) {
    return endpointCache.endpoints;
  }

  logAudit("FETCH_ENDPOINTS", "Fetching Epic R4 endpoint bundle from open.epic.com");

  const response = await fetch(EPIC_ENDPOINTS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Epic endpoints: ${response.status}`);
  }

  const bundle = await response.json();

  const endpoints: EpicEndpoint[] = [];
  if (bundle.entry && Array.isArray(bundle.entry)) {
    for (const entry of bundle.entry) {
      const resource = entry.resource;
      if (resource && resource.address && resource.status === "active") {
        let orgName: string | undefined;
        if (resource.contained && Array.isArray(resource.contained)) {
          const org = resource.contained.find((c: any) => c.resourceType === "Organization");
          if (org?.name) orgName = org.name;
        }

        endpoints.push({
          name: resource.name || orgName || "Unknown Organization",
          baseUrl: resource.address,
          managingOrganization: orgName && orgName !== resource.name ? orgName : undefined,
        });
      }
    }
  }

  endpointCache = { endpoints, fetchedAt: Date.now() };
  logAudit("ENDPOINTS_CACHED", `Cached ${endpoints.length} Epic R4 endpoints`);

  return endpoints;
}

export async function searchEpicEndpoints(
  query: string,
  limit: number = 20
): Promise<EpicEndpoint[]> {
  const endpoints = await fetchEndpoints();
  const q = query.toLowerCase().trim();

  if (!q) return [];

  const scored = endpoints
    .map((ep) => {
      const name = ep.name.toLowerCase();
      let score = 0;
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 60;
      else {
        const words = q.split(/\s+/);
        const matchCount = words.filter((w) => name.includes(w)).length;
        if (matchCount > 0) score = (matchCount / words.length) * 40;
      }
      return { endpoint: ep, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  logAudit("SEARCH_ENDPOINTS", `Query:"${hashId(q)}" Results:${scored.length}`);

  return scored.map((s) => s.endpoint);
}

export async function getEndpointCount(): Promise<number> {
  const endpoints = await fetchEndpoints();
  return endpoints.length;
}

export function clearEndpointCache(): void {
  endpointCache = null;
}
