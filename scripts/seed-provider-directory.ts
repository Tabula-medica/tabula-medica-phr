/**
 * Seed script for the persisted provider directory (zip + specialty search).
 *
 * Usage:
 *   tsx scripts/seed-provider-directory.ts
 *   (or, add npm alias `npm run seed:provider-directory`)
 *
 * All data is SYNTHETIC (fictional NPIs / names). No real PHI. Idempotent:
 * re-running upserts on NPI. Real data should be loaded from NPPES (npi_search)
 * + a geocoder for lat/long; this seed exists so zip-radius + specialty search
 * is exercisable end-to-end and so the directory renders before onboarding
 * real providers.
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { healthcareProvidersTable, providerLocationsTable } from "@shared/schema";

type Seed = {
  npi: string;
  firstName: string;
  lastName: string;
  credentials: string[];
  providerType: string;
  specialties: string[];
  primarySpecialty: string;
  languages: string[];
  averageRating: number;
  reviewCount: number;
  loc: {
    name: string;
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
    phone: string;
    latitude: number;
    longitude: number;
  };
};

const SEEDS: Seed[] = [
  {
    npi: "1000000001", firstName: "Aisha", lastName: "Rahman", credentials: ["MD"],
    providerType: "physician", specialties: ["family_medicine"], primarySpecialty: "family_medicine",
    languages: ["English", "Urdu"], averageRating: 4.8, reviewCount: 132,
    loc: { name: "Riverside Family Care", addressLine1: "220 King St", city: "Alexandria", state: "VA", zipCode: "22314", phone: "7035550101", latitude: 38.8048, longitude: -77.0469 },
  },
  {
    npi: "1000000002", firstName: "David", lastName: "Okafor", credentials: ["MD", "FACC"],
    providerType: "physician", specialties: ["cardiology", "internal_medicine"], primarySpecialty: "cardiology",
    languages: ["English"], averageRating: 4.7, reviewCount: 89,
    loc: { name: "Potomac Heart Institute", addressLine1: "1500 Duke St", city: "Alexandria", state: "VA", zipCode: "22314", phone: "7035550102", latitude: 38.8062, longitude: -77.0555 },
  },
  {
    npi: "1000000003", firstName: "Mei", lastName: "Chen", credentials: ["MD"],
    providerType: "physician", specialties: ["dermatology"], primarySpecialty: "dermatology",
    languages: ["English", "Mandarin"], averageRating: 4.9, reviewCount: 201,
    loc: { name: "Capital Dermatology", addressLine1: "1101 15th St NW", city: "Washington", state: "DC", zipCode: "20005", phone: "2025550103", latitude: 38.9048, longitude: -77.0342 },
  },
  {
    npi: "1000000004", firstName: "Carlos", lastName: "Mendez", credentials: ["MD"],
    providerType: "physician", specialties: ["pediatrics"], primarySpecialty: "pediatrics",
    languages: ["English", "Spanish"], averageRating: 4.6, reviewCount: 74,
    loc: { name: "Little Steps Pediatrics", addressLine1: "8200 Greensboro Dr", city: "McLean", state: "VA", zipCode: "22102", phone: "7035550104", latitude: 38.9268, longitude: -77.2176 },
  },
  {
    npi: "1000000005", firstName: "Sarah", lastName: "Goldberg", credentials: ["MD", "PhD"],
    providerType: "physician", specialties: ["neurology"], primarySpecialty: "neurology",
    languages: ["English"], averageRating: 4.5, reviewCount: 58,
    loc: { name: "NeuroHealth Associates", addressLine1: "2296 Opitz Blvd", city: "Woodbridge", state: "VA", zipCode: "22191", phone: "7035550105", latitude: 38.6404, longitude: -77.2733 },
  },
  {
    npi: "1000000006", firstName: "Priya", lastName: "Nair", credentials: ["MD"],
    providerType: "physician", specialties: ["radiology"], primarySpecialty: "radiology",
    languages: ["English", "Hindi"], averageRating: 4.8, reviewCount: 96,
    loc: { name: "Insight Imaging Center", addressLine1: "3020 Hamaker Ct", city: "Fairfax", state: "VA", zipCode: "22031", phone: "7035550106", latitude: 38.8623, longitude: -77.2296 },
  },
  {
    npi: "1000000007", firstName: "James", lastName: "Whitfield", credentials: ["DO"],
    providerType: "physician", specialties: ["internal_medicine"], primarySpecialty: "internal_medicine",
    languages: ["English"], averageRating: 4.4, reviewCount: 41,
    loc: { name: "Beltway Internal Medicine", addressLine1: "6355 Walker Ln", city: "Alexandria", state: "VA", zipCode: "22310", phone: "7035550107", latitude: 38.7746, longitude: -77.1044 },
  },
  {
    npi: "1000000008", firstName: "Fatima", lastName: "Al-Sayed", credentials: ["MD"],
    providerType: "physician", specialties: ["obstetrics_gynecology"], primarySpecialty: "obstetrics_gynecology",
    languages: ["English", "Arabic"], averageRating: 4.9, reviewCount: 148,
    loc: { name: "Capital Women's Health", addressLine1: "106 Irving St NW", city: "Washington", state: "DC", zipCode: "20010", phone: "2025550108", latitude: 38.9289, longitude: -77.0186 },
  },
];

async function main() {
  console.log(`[seed:provider-directory] Seeding ${SEEDS.length} synthetic providers...`);
  for (const s of SEEDS) {
    const [provider] = await db
      .insert(healthcareProvidersTable)
      .values({
        npi: s.npi,
        firstName: s.firstName,
        lastName: s.lastName,
        credentials: s.credentials,
        providerType: s.providerType,
        specialties: s.specialties,
        primarySpecialty: s.primarySpecialty,
        status: "active",
        languages: s.languages,
        acceptingNewPatients: true,
        appointmentModes: ["in_person", "telehealth"],
        averageRating: s.averageRating,
        reviewCount: s.reviewCount,
        metadata: { synthetic: true },
      })
      .onConflictDoUpdate({
        target: healthcareProvidersTable.npi,
        set: { updatedAt: sql`now()`, averageRating: s.averageRating, reviewCount: s.reviewCount },
      })
      .returning();

    // Reset locations for idempotency, then insert the primary location.
    await db.delete(providerLocationsTable).where(sql`provider_id = ${provider.id}`);
    await db.insert(providerLocationsTable).values({
      providerId: provider.id,
      name: s.loc.name,
      addressLine1: s.loc.addressLine1,
      city: s.loc.city,
      state: s.loc.state,
      zipCode: s.loc.zipCode,
      country: "USA",
      phone: s.loc.phone,
      isPrimary: true,
      appointmentModes: ["in_person", "telehealth"],
      officeHours: [],
      latitude: s.loc.latitude,
      longitude: s.loc.longitude,
    });
    console.log(`  ✓ ${s.firstName} ${s.lastName} (${s.primarySpecialty}) @ ${s.loc.city}, ${s.loc.state} ${s.loc.zipCode}`);
  }
  console.log("[seed:provider-directory] Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed:provider-directory] Failed:", err);
  process.exit(1);
});
