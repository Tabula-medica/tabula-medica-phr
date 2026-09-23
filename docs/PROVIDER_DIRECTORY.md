# Provider Directory — Persistent zip + specialty search

## What this is
A Postgres-backed provider directory that powers zip-radius + specialty search,
replacing the in-memory `providerDirectoryService` for production while keeping it
as a seedless-dev fallback.

## Components
- **Schema** (`shared/schema.ts`): `healthcare_providers` + `provider_locations` tables
  (indexed on `primary_specialty`, `status`, `zip_code`, `provider_id`).
- **Store** (`server/services/providerDirectoryStore.ts`): `searchProvidersDb(filters)`
  returns a `ProviderSearchResult`, or `null` when the table is empty (caller falls back
  to in-memory). Zip-radius uses haversine over location lat/long; the search-zip centroid
  is resolved from seeded locations in that zip, falling back to exact-zip then 3-digit prefix.
- **Route** (`server/routes.ts`): `GET /api/provider-integration/providers` now prefers the
  persisted store, falling back to in-memory.
- **Seed** (`scripts/seed-provider-directory.ts`, `npm run seed:provider-directory`):
  8 synthetic NoVA/DC providers with lat/long. SYNTHETIC only — no PHI.

## Activation (deploy-time)
1. Create tables: `npm run db:push` (drizzle-kit) against the target DB.
2. Seed sample data (optional, for demo/first render): `npm run seed:provider-directory`.
3. Real data: load from NPPES (`npi_search`) + a geocoder for lat/long, or onboard providers
   via the provider admin flow. Once ≥1 provider exists, the search route serves from Postgres.

## Search API
`GET /api/provider-integration/providers?specialty=cardiology&zipCode=22314&radiusMiles=25&sortBy=distance`
Filters: `specialty`, `providerType`, `name`, `zipCode`, `radiusMiles`, `acceptingNewPatients`,
`appointmentMode`, `language`, `minRating`, `sortBy` (distance|rating|name), `page`, `pageSize`.

## Follow-ups (not in this change)
- Replace the centroid heuristic with a proper zip→lat/long geo table.
- Provider self-onboarding wizard + admin approval writing into `healthcare_providers`.
- Insurance-network + availability joins (types already exist in the in-memory service).
