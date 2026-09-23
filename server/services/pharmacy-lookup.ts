/**
 * Pharmacy lookup — typeahead search backed by the public NPPES NPI Registry.
 *
 * Powers the "start typing a pharmacy name + city and pick yours" autocomplete.
 * NPPES is the CMS national provider registry: free, no auth, public data
 * (organization names + practice addresses — no PHI). We query organization
 * NPIs (enumeration_type=NPI-2) with a Pharmacy taxonomy and map results to a
 * compact shape the client can drop straight into the pharmacy form.
 *
 * Docs: https://npiregistry.cms.hhs.gov/api-page
 */

export interface PharmacySuggestion {
  npi: string;
  name: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  phone?: string;
}

const NPPES_URL = "https://npiregistry.cms.hhs.gov/api/";

/**
 * Search pharmacies by (partial) name and optional city/state. NPPES requires
 * a trailing wildcard for partial name matches and a minimum of 2 chars.
 */
export async function searchPharmacies(
  name: string,
  city?: string,
  state?: string,
  limit = 10,
): Promise<PharmacySuggestion[]> {
  const trimmed = (name || "").trim();
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    version: "2.1",
    enumeration_type: "NPI-2",
    taxonomy_description: "Pharmacy",
    organization_name: trimmed.endsWith("*") ? trimmed : `${trimmed}*`,
    limit: String(Math.min(20, Math.max(1, limit))),
  });
  if (city && city.trim()) params.set("city", city.trim());
  if (state && state.trim()) params.set("state", state.trim().toUpperCase());

  let json: any;
  try {
    const resp = await fetch(`${NPPES_URL}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      // NPPES is generally fast; cap so a slow upstream can't hang the request.
      signal: AbortSignal.timeout(6000),
    });
    if (!resp.ok) return [];
    json = await resp.json();
  } catch {
    return [];
  }

  const results: any[] = Array.isArray(json?.results) ? json.results : [];
  return results.map(mapResult).filter((p): p is PharmacySuggestion => p !== null);
}

function mapResult(r: any): PharmacySuggestion | null {
  const npi = r?.number ? String(r.number) : "";
  const name = r?.basic?.organization_name || r?.basic?.name;
  if (!npi || !name) return null;

  // Prefer the LOCATION address over the mailing address.
  const addresses: any[] = Array.isArray(r?.addresses) ? r.addresses : [];
  const loc =
    addresses.find((a) => a?.address_purpose === "LOCATION") || addresses[0] || {};

  return {
    npi,
    name,
    addressLine1: loc.address_1 || "",
    city: loc.city || "",
    state: loc.state || "",
    zip: (loc.postal_code || "").slice(0, 5),
    phone: loc.telephone_number || undefined,
  };
}
