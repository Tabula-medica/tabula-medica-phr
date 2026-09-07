/**
 * Provider Directory Store — Postgres-backed search for the provider
 * directory (zip + specialty). This is the persistent counterpart to the
 * in-memory `providerDirectoryService` in ./providerIntegration.ts.
 *
 * Design:
 *   - `searchProvidersDb` returns a `ProviderSearchResult` when the
 *     `healthcare_providers` table has data, or `null` when it is empty so
 *     callers can fall back to the in-memory service (no regression in
 *     dev / un-seeded environments).
 *   - Zip-radius search uses a haversine distance over provider-location
 *     lat/long. The search-zip centroid is resolved from existing seeded
 *     locations in that zip (avg lat/long); when it cannot be resolved we
 *     fall back to exact-zip, then 3-digit-prefix matching. NPPES / a
 *     dedicated zip-geo table can later replace the centroid heuristic.
 */
import { sql } from "drizzle-orm";
import { db } from "../db";
import {
  healthcareProvidersTable,
  providerLocationsTable,
  type ProviderSearchFilters,
  type ProviderSearchResult,
  type HealthcareProvider,
  type ProviderLocation,
} from "@shared/schema";

export interface CreateProviderInput {
  npi: string;
  firstName: string;
  lastName: string;
  credentials?: string[];
  providerType: string;
  specialties: string[];
  primarySpecialty: string;
  languages?: string[];
  acceptingNewPatients?: boolean;
  appointmentModes?: string[];
  bio?: string;
  status?: string; // "active" | "pending" | ...
  location: {
    name: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    zipCode: string;
    phone: string;
    latitude?: number;
    longitude?: number;
    appointmentModes?: string[];
  };
}

/**
 * Insert (or upsert on NPI) a provider + its primary location into the
 * persistent directory. Returns the new provider id. `status` defaults to
 * "pending" so self-onboarded providers are held for admin approval before
 * they surface in search (search filters on status = 'active').
 */
export async function createProvider(input: CreateProviderInput): Promise<string> {
  const [provider] = await db
    .insert(healthcareProvidersTable)
    .values({
      npi: input.npi,
      firstName: input.firstName,
      lastName: input.lastName,
      credentials: input.credentials ?? [],
      providerType: input.providerType,
      specialties: input.specialties,
      primarySpecialty: input.primarySpecialty,
      status: input.status ?? "pending",
      bio: input.bio,
      languages: input.languages ?? ["English"],
      acceptingNewPatients: input.acceptingNewPatients ?? true,
      appointmentModes: input.appointmentModes ?? ["in_person"],
      metadata: { selfOnboarded: true },
    })
    .onConflictDoUpdate({
      target: healthcareProvidersTable.npi,
      set: { updatedAt: sql`now()`, firstName: input.firstName, lastName: input.lastName },
    })
    .returning();

  await db.delete(providerLocationsTable).where(sql`provider_id = ${provider.id}`);
  await db.insert(providerLocationsTable).values({
    providerId: provider.id,
    name: input.location.name,
    addressLine1: input.location.addressLine1,
    addressLine2: input.location.addressLine2,
    city: input.location.city,
    state: input.location.state,
    zipCode: input.location.zipCode,
    phone: input.location.phone,
    isPrimary: true,
    appointmentModes: input.location.appointmentModes ?? ["in_person"],
    latitude: input.location.latitude,
    longitude: input.location.longitude,
  });

  return provider.id;
}

/** Approve (activate) or set status on a provider. */
export async function setProviderStatus(providerId: string, status: string): Promise<void> {
  await db
    .update(healthcareProvidersTable)
    .set({ status, updatedAt: sql`now()` })
    .where(sql`id = ${providerId}`);
}

const EARTH_RADIUS_MILES = 3959;

/** True when the persistent directory has at least one provider. */
export async function hasPersistedProviders(): Promise<boolean> {
  try {
    const rows = await db.select({ id: healthcareProvidersTable.id }).from(healthcareProvidersTable).limit(1);
    return rows.length > 0;
  } catch {
    return false;
  }
}

/** Resolve a centroid (lat/long) for a search zip from seeded locations. */
async function resolveZipCentroid(zip: string): Promise<{ lat: number; lon: number } | null> {
  const res: any = await db.execute(sql`
    SELECT AVG(latitude) AS lat, AVG(longitude) AS lon
    FROM provider_locations
    WHERE zip_code = ${zip} AND latitude IS NOT NULL AND longitude IS NOT NULL
  `);
  const row = res.rows?.[0];
  if (row && row.lat != null && row.lon != null) {
    return { lat: Number(row.lat), lon: Number(row.lon) };
  }
  return null;
}

/**
 * Search persisted providers. Returns null if no providers are seeded,
 * signalling the caller to fall back to the in-memory directory.
 */
export async function searchProvidersDb(
  filters: ProviderSearchFilters,
): Promise<ProviderSearchResult | null> {
  if (!(await hasPersistedProviders())) return null;

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const offset = (page - 1) * pageSize;

  const conditions: ReturnType<typeof sql>[] = [sql`p.status = 'active'`];

  if (filters.specialty) {
    conditions.push(sql`p.specialties @> ${JSON.stringify([filters.specialty])}::jsonb`);
  }
  if (filters.providerType) {
    conditions.push(sql`p.provider_type = ${filters.providerType}`);
  }
  if (typeof filters.acceptingNewPatients === "boolean") {
    conditions.push(sql`p.accepting_new_patients = ${filters.acceptingNewPatients}`);
  }
  if (filters.name) {
    conditions.push(sql`(p.first_name || ' ' || p.last_name) ILIKE ${"%" + filters.name + "%"}`);
  }
  if (typeof filters.minRating === "number") {
    conditions.push(sql`COALESCE(p.average_rating, 0) >= ${filters.minRating}`);
  }
  if (filters.language) {
    conditions.push(sql`p.languages @> ${JSON.stringify([filters.language])}::jsonb`);
  }
  if (filters.appointmentMode) {
    conditions.push(sql`l.appointment_modes @> ${JSON.stringify([filters.appointmentMode])}::jsonb`);
  }

  // Zip / radius handling.
  let distanceExpr = sql`NULL::float`;
  if (filters.zipCode) {
    const radius = filters.radiusMiles;
    let centroid: { lat: number; lon: number } | null = null;
    if (radius && radius > 0) centroid = await resolveZipCentroid(filters.zipCode);

    if (centroid) {
      distanceExpr = sql`(${EARTH_RADIUS_MILES} * acos(
        LEAST(1.0, cos(radians(${centroid.lat})) * cos(radians(l.latitude)) *
        cos(radians(l.longitude) - radians(${centroid.lon})) +
        sin(radians(${centroid.lat})) * sin(radians(l.latitude)))
      ))`;
      conditions.push(sql`l.latitude IS NOT NULL AND l.longitude IS NOT NULL`);
      conditions.push(sql`${distanceExpr} <= ${radius}`);
    } else if (radius && radius > 0) {
      // Centroid unknown: approximate radius by 3-digit zip prefix.
      conditions.push(sql`LEFT(l.zip_code, 3) = ${filters.zipCode.slice(0, 3)}`);
    } else {
      conditions.push(sql`l.zip_code = ${filters.zipCode}`);
    }
  }

  const whereClause = sql.join(conditions, sql` AND `);

  const orderClause =
    filters.sortBy === "rating"
      ? sql`p.average_rating DESC NULLS LAST`
      : filters.sortBy === "name"
        ? sql`p.last_name ASC, p.first_name ASC`
        : filters.zipCode
          ? sql`distance_miles ASC NULLS LAST`
          : sql`p.average_rating DESC NULLS LAST`;

  const res: any = await db.execute(sql`
    SELECT
      p.*,
      ${distanceExpr} AS distance_miles,
      l.id AS loc_id, l.name AS loc_name, l.address_line1, l.address_line2,
      l.city, l.state, l.zip_code, l.country, l.phone, l.fax, l.email AS loc_email,
      l.is_primary, l.appointment_modes AS loc_appointment_modes, l.office_hours,
      l.handicap_accessible, l.parking_available, l.public_transit_access,
      l.latitude, l.longitude,
      COUNT(*) OVER() AS total_count
    FROM healthcare_providers p
    JOIN LATERAL (
      SELECT * FROM provider_locations pl
      WHERE pl.provider_id = p.id
      ORDER BY pl.is_primary DESC
      LIMIT 1
    ) l ON true
    WHERE ${whereClause}
    ORDER BY ${orderClause}
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  const rows: any[] = res.rows ?? [];
  const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;

  const providers = rows.map((r) => {
    const provider: HealthcareProvider = {
      id: r.id,
      npi: r.npi,
      firstName: r.first_name,
      lastName: r.last_name,
      credentials: r.credentials ?? [],
      providerType: r.provider_type,
      specialties: r.specialties ?? [],
      primarySpecialty: r.primary_specialty,
      status: r.status,
      bio: r.bio ?? undefined,
      photoUrl: r.photo_url ?? undefined,
      languages: r.languages ?? [],
      acceptingNewPatients: r.accepting_new_patients,
      appointmentModes: r.appointment_modes ?? [],
      averageRating: r.average_rating ?? undefined,
      reviewCount: r.review_count ?? 0,
      yearsExperience: r.years_experience ?? undefined,
      boardCertifications: r.board_certifications ?? [],
      hospitalAffiliations: r.hospital_affiliations ?? [],
      groupPractice: r.group_practice ?? undefined,
      metadata: r.metadata ?? {},
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
    const primaryLocation: ProviderLocation = {
      id: r.loc_id,
      providerId: r.id,
      name: r.loc_name,
      addressLine1: r.address_line1,
      addressLine2: r.address_line2 ?? undefined,
      city: r.city,
      state: r.state,
      zipCode: r.zip_code,
      country: r.country,
      phone: r.phone,
      fax: r.fax ?? undefined,
      email: r.loc_email ?? undefined,
      isPrimary: r.is_primary,
      appointmentModes: r.loc_appointment_modes ?? [],
      officeHours: r.office_hours ?? [],
      handicapAccessible: r.handicap_accessible,
      parkingAvailable: r.parking_available,
      publicTransitAccess: r.public_transit_access,
      latitude: r.latitude ?? undefined,
      longitude: r.longitude ?? undefined,
      distanceMiles: r.distance_miles != null ? Number(r.distance_miles) : undefined,
      createdAt: r.created_at,
    };
    return { ...provider, primaryLocation };
  });

  return {
    providers,
    totalCount,
    page,
    pageSize,
    hasMore: offset + providers.length < totalCount,
  };
}
