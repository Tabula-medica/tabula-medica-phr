/**
 * NPPES provider search, scoped by specialty and ZIP proximity.
 *
 * NPPES is the CMS registry of US healthcare providers. It is public, needs no
 * key, and is authoritative for NPI, name, practice address, and taxonomy.
 *
 * Two properties of the data drive the design here, and both are documented by
 * CMS rather than discovered by us:
 *
 *   - An NPI proves *enumeration*, not licensure, credentialing, or that the
 *     provider is currently practising at the listed address. NPPES records go
 *     stale; providers move and do not always update. Results are therefore
 *     labelled as directory information to be confirmed, never as a verified
 *     referral target.
 *   - The API caps results at 200 per request. Broad specialty searches across
 *     several ZIP prefixes exceed that, so this client queries per prefix and
 *     merges, rather than issuing one wide query and silently truncating.
 *
 * US-only by construction: NPPES contains no international providers. The
 * `.world` deployment should not surface this feature — see the region gating
 * in `server/routes.ts`.
 */

import {
  buildZipNeighborhood,
  normalizeZip,
  proximityLabel,
  zipProximityScore,
  type Zip5,
} from "./zip-proximity";
import { getSpecialty, type SpecialtyDefinition } from "./specialty-taxonomy";

const NPPES_ENDPOINT = "https://npiregistry.cms.hhs.gov/api/";
const NPPES_VERSION = "2.1";
/** CMS caps a single response at 200. */
const NPPES_MAX_LIMIT = 200;

export interface ProviderResult {
  npi: string;
  name: string;
  /** "individual" | "organization", from the NPPES enumeration type. */
  kind: "individual" | "organization";
  credential?: string;
  specialty: string;
  /** Practice location. */
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: Zip5 | string;
  };
  phone?: string;
  /** Lower is nearer. See zip-proximity — postal, not geodesic. */
  proximityScore: number;
  /** Word-form proximity, because miles cannot be computed here. */
  proximityLabel: string;
}

export interface ProviderSearchInput {
  specialtyId: string;
  zip: string;
  /** How many SCF rings outward to search. 0 = seed SCF only. */
  rings?: number;
  /** Maximum providers to return after merging and ranking. */
  limit?: number;
  /** Injected for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

export interface ProviderSearchOutput {
  providers: ProviderResult[];
  specialty: SpecialtyDefinition;
  seedZip: Zip5;
  /** ZIP prefixes actually queried, nearest first. */
  searchedPrefixes: string[];
  /** Non-fatal problems (a prefix query failed, etc.). */
  warnings: string[];
  /**
   * Always present. NPPES enumeration is not verification, and a referral UI
   * that omits this invites the user to treat a stale address as confirmed.
   */
  disclaimer: string;
}

const DISCLAIMER =
  "Directory information from the CMS NPPES registry. An NPI confirms enrolment, not current licensure, credentialing, network participation, or that the provider still practises at this address. Confirm before referring.";

interface NppesAddress {
  address_purpose?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  telephone_number?: string;
}

interface NppesTaxonomy {
  desc?: string;
  primary?: boolean;
}

interface NppesRecord {
  number?: string | number;
  enumeration_type?: string;
  basic?: {
    first_name?: string;
    last_name?: string;
    organization_name?: string;
    credential?: string;
  };
  addresses?: NppesAddress[];
  taxonomies?: NppesTaxonomy[];
}

/** NPPES returns ZIP+4 without the dash; take the first five digits. */
function zipFromNppes(postal?: string): string {
  if (!postal) return "";
  const digits = postal.replace(/\D/g, "");
  return digits.slice(0, 5);
}

function mapRecord(record: NppesRecord, seed: Zip5): ProviderResult | null {
  const npi = String(record.number ?? "").trim();
  if (!npi) return null;

  const basic = record.basic ?? {};
  const isOrg = record.enumeration_type === "NPI-2";
  const name = isOrg
    ? (basic.organization_name ?? "").trim()
    : `${basic.first_name ?? ""} ${basic.last_name ?? ""}`.trim();
  if (!name) return null;

  const address =
    record.addresses?.find((a) => a.address_purpose === "LOCATION") ??
    record.addresses?.[0] ??
    {};

  const taxonomy =
    record.taxonomies?.find((t) => t.primary) ?? record.taxonomies?.[0] ?? {};

  const zip = zipFromNppes(address.postal_code);

  return {
    npi,
    name,
    kind: isOrg ? "organization" : "individual",
    credential: basic.credential?.trim() || undefined,
    specialty: taxonomy.desc ?? "Not specified",
    address: {
      line1: address.address_1 ?? "",
      line2: address.address_2 || undefined,
      city: address.city ?? "",
      state: address.state ?? "",
      zip,
    },
    phone: address.telephone_number || undefined,
    proximityScore: zipProximityScore(seed, zip),
    proximityLabel: proximityLabel(seed, zip),
  };
}

/**
 * Search NPPES for providers of a specialty near a ZIP.
 *
 * Queries each ZIP prefix separately (nearest ring first) and each of the
 * specialty's taxonomy fragments within it, merges by NPI, and ranks by postal
 * proximity. A failed query degrades to a warning rather than failing the whole
 * search — partial results beat no results when someone is trying to place a
 * referral.
 */
export async function searchProviders(
  input: ProviderSearchInput,
): Promise<ProviderSearchOutput> {
  const specialty = getSpecialty(input.specialtyId);
  if (!specialty) {
    throw new Error(`Unknown specialty: ${input.specialtyId}`);
  }

  const seed = normalizeZip(input.zip);
  if (!seed) {
    throw new Error(
      `"${input.zip}" is not a valid 5-digit US ZIP code. NPPES covers US providers only.`,
    );
  }

  const neighborhood = buildZipNeighborhood(seed, input.rings ?? 1);
  // buildZipNeighborhood only returns null for an invalid ZIP, already handled.
  const prefixes = neighborhood?.scfRings ?? [seed.slice(0, 3)];

  const doFetch = input.fetchImpl ?? fetch;
  const limit = input.limit ?? 25;
  const warnings: string[] = [];
  const byNpi = new Map<string, ProviderResult>();

  for (const prefix of prefixes) {
    // Every taxonomy fragment for the specialty is queried, not just the first.
    // A specialty maps onto more than one NUCC string — a primary-care search
    // that only asked for "Family Medicine" would silently return no
    // internists — and querying one fragment hides the rest of the specialty.
    // Fragments are ordered most specific first, and the first record for an
    // NPI wins, so a provider matched by the specific fragment keeps that
    // taxonomy label.
    for (const fragment of specialty.taxonomyFragments) {
      const params = new URLSearchParams({
        version: NPPES_VERSION,
        limit: String(NPPES_MAX_LIMIT),
        country_code: "US",
        postal_code: `${prefix}*`,
        taxonomy_description: `${fragment}*`,
      });

      try {
        const response = await doFetch(`${NPPES_ENDPOINT}?${params.toString()}`);
        if (!response.ok) {
          warnings.push(
            `ZIP prefix ${prefix} (${fragment}): NPPES returned ${response.status}.`,
          );
          continue;
        }

        const payload = (await response.json()) as {
          results?: NppesRecord[];
          Errors?: Array<{ description?: string }>;
        };

        if (payload.Errors?.length) {
          warnings.push(
            `ZIP prefix ${prefix} (${fragment}): ${payload.Errors[0]?.description ?? "NPPES error"}.`,
          );
          continue;
        }

        const records = payload.results ?? [];
        if (records.length === NPPES_MAX_LIMIT) {
          warnings.push(
            `ZIP prefix ${prefix} (${fragment}): hit the NPPES 200-result cap, so some providers in this area are not listed. Narrow the search to see them.`,
          );
        }

        for (const record of records) {
          const mapped = mapRecord(record, seed);
          // First occurrence wins: prefixes are ordered nearest-first, so an
          // earlier ring already holds the closer copy of a duplicate NPI.
          if (mapped && !byNpi.has(mapped.npi)) byNpi.set(mapped.npi, mapped);
        }
      } catch (error) {
        warnings.push(
          `ZIP prefix ${prefix} (${fragment}): lookup failed (${(error as Error).message}).`,
        );
      }
    }
  }

  const providers = Array.from(byNpi.values())
    .sort((a, b) =>
      a.proximityScore !== b.proximityScore
        ? a.proximityScore - b.proximityScore
        : a.name.localeCompare(b.name),
    )
    .slice(0, limit);

  return {
    providers,
    specialty,
    seedZip: seed,
    searchedPrefixes: prefixes,
    warnings,
    disclaimer: DISCLAIMER,
  };
}
