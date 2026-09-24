/**
 * Region-specific vaccine schedule packs.
 *
 * Each pack surfaces the national/WHO schedule for a homeRegion:
 *   "us"   → ACIP (handled by the main vaccine-rules-engine-v2)
 *   "in"   → India Universal Immunization Programme (IN-UIP) 2025
 *   "au"   → Australia NHMRC/ATAGI National Immunization Program
 *   "who"  → WHO Expanded Programme on Immunization (EPI) baseline
 *
 * These packs intentionally overlap with (but do not replace) the ACIP rules
 * engine. The region router in vaccine-routes.ts picks the right pack based on
 * the authenticated user's homeRegion claim.
 *
 * Data sources:
 *   IN-UIP: MoHFW India National Immunization Schedule 2024
 *   WHO-EPI: WHO recommended childhood immunization schedule 2025
 */

export interface RegionVaccineEntry {
  vaccineGroup: string;
  shortName: string;
  cvxCodes?: string[];
  doses: RegionDose[];
  region: string;
  programName: string;
  citation: { source: string; documentTitle: string; publicationDate: string; url?: string };
}

export interface RegionDose {
  doseNumber: number;
  ageLabel: string;
  minimumAgeDays: number;
  recommendedAgeDays: number;
  notes?: string;
}

// ─── India — Universal Immunization Programme (IN-UIP) ───────────────────────

export const IN_UIP_SCHEDULE: RegionVaccineEntry[] = [
  {
    vaccineGroup: "BCG",
    shortName: "BCG",
    cvxCodes: ["19"],
    region: "in",
    programName: "India UIP",
    citation: {
      source: "MoHFW",
      documentTitle: "India National Immunization Schedule 2024",
      publicationDate: "2024-04-01",
      url: "https://mohfw.gov.in",
    },
    doses: [
      { doseNumber: 1, ageLabel: "At birth", minimumAgeDays: 0, recommendedAgeDays: 0, notes: "Administer as soon as possible after birth, preferably within 24 hours" },
    ],
  },
  {
    vaccineGroup: "HepB-Birth",
    shortName: "HepB (Birth)",
    cvxCodes: ["08", "44", "45"],
    region: "in",
    programName: "India UIP",
    citation: {
      source: "MoHFW",
      documentTitle: "India National Immunization Schedule 2024",
      publicationDate: "2024-04-01",
    },
    doses: [
      { doseNumber: 1, ageLabel: "At birth", minimumAgeDays: 0, recommendedAgeDays: 0, notes: "Within 24 hours of birth" },
    ],
  },
  {
    vaccineGroup: "OPV",
    shortName: "OPV (Oral Polio)",
    cvxCodes: ["02"],
    region: "in",
    programName: "India UIP",
    citation: {
      source: "MoHFW",
      documentTitle: "India National Immunization Schedule 2024",
      publicationDate: "2024-04-01",
    },
    doses: [
      { doseNumber: 0, ageLabel: "At birth (OPV0)", minimumAgeDays: 0, recommendedAgeDays: 0, notes: "Zero dose" },
      { doseNumber: 1, ageLabel: "6 weeks", minimumAgeDays: 42, recommendedAgeDays: 42 },
      { doseNumber: 2, ageLabel: "10 weeks", minimumAgeDays: 70, recommendedAgeDays: 70 },
      { doseNumber: 3, ageLabel: "14 weeks", minimumAgeDays: 98, recommendedAgeDays: 98 },
      { doseNumber: 4, ageLabel: "9 months", minimumAgeDays: 270, recommendedAgeDays: 274, notes: "Supplementary 1 (with MR1)" },
      { doseNumber: 5, ageLabel: "16-24 months", minimumAgeDays: 487, recommendedAgeDays: 548, notes: "Supplementary 2 (Booster with MR2)" },
    ],
  },
  {
    vaccineGroup: "fIPV",
    shortName: "fIPV (Fractional IPV)",
    cvxCodes: ["10", "89"],
    region: "in",
    programName: "India UIP",
    citation: {
      source: "MoHFW",
      documentTitle: "India National Immunization Schedule 2024",
      publicationDate: "2024-04-01",
    },
    doses: [
      { doseNumber: 1, ageLabel: "6 weeks", minimumAgeDays: 42, recommendedAgeDays: 42, notes: "ID fractional dose 0.1 mL" },
      { doseNumber: 2, ageLabel: "14 weeks", minimumAgeDays: 98, recommendedAgeDays: 98, notes: "ID fractional dose 0.1 mL" },
    ],
  },
  {
    vaccineGroup: "Pentavalent",
    shortName: "Penta (DTP-HepB-Hib)",
    cvxCodes: ["120", "132"],
    region: "in",
    programName: "India UIP",
    citation: {
      source: "MoHFW",
      documentTitle: "India National Immunization Schedule 2024",
      publicationDate: "2024-04-01",
    },
    doses: [
      { doseNumber: 1, ageLabel: "6 weeks", minimumAgeDays: 42, recommendedAgeDays: 42 },
      { doseNumber: 2, ageLabel: "10 weeks", minimumAgeDays: 70, recommendedAgeDays: 70 },
      { doseNumber: 3, ageLabel: "14 weeks", minimumAgeDays: 98, recommendedAgeDays: 98 },
    ],
  },
  {
    vaccineGroup: "PCV-IN",
    shortName: "PCV13 (UIP)",
    cvxCodes: ["133", "152"],
    region: "in",
    programName: "India UIP",
    citation: {
      source: "MoHFW",
      documentTitle: "India National Immunization Schedule 2024",
      publicationDate: "2024-04-01",
    },
    doses: [
      { doseNumber: 1, ageLabel: "6 weeks", minimumAgeDays: 42, recommendedAgeDays: 42 },
      { doseNumber: 2, ageLabel: "14 weeks", minimumAgeDays: 98, recommendedAgeDays: 98 },
      { doseNumber: 3, ageLabel: "9 months", minimumAgeDays: 270, recommendedAgeDays: 274, notes: "Booster dose" },
    ],
  },
  {
    vaccineGroup: "MR",
    shortName: "MR (Measles-Rubella)",
    cvxCodes: ["04", "38"],
    region: "in",
    programName: "India UIP",
    citation: {
      source: "MoHFW",
      documentTitle: "India National Immunization Schedule 2024",
      publicationDate: "2024-04-01",
    },
    doses: [
      { doseNumber: 1, ageLabel: "9-12 months", minimumAgeDays: 274, recommendedAgeDays: 274 },
      { doseNumber: 2, ageLabel: "16-24 months", minimumAgeDays: 487, recommendedAgeDays: 548 },
    ],
  },
  {
    vaccineGroup: "JE",
    shortName: "JE (Japanese Encephalitis)",
    cvxCodes: ["134"],
    region: "in",
    programName: "India UIP (endemic states)",
    citation: {
      source: "MoHFW",
      documentTitle: "India National Immunization Schedule 2024",
      publicationDate: "2024-04-01",
    },
    doses: [
      { doseNumber: 1, ageLabel: "9-12 months", minimumAgeDays: 274, recommendedAgeDays: 274, notes: "Endemic states only" },
      { doseNumber: 2, ageLabel: "16-24 months", minimumAgeDays: 487, recommendedAgeDays: 548, notes: "Endemic states only" },
    ],
  },
  {
    vaccineGroup: "Rotavirus-IN",
    shortName: "Rotavirus (Rotavac)",
    cvxCodes: ["116", "119", "122"],
    region: "in",
    programName: "India UIP",
    citation: {
      source: "MoHFW",
      documentTitle: "India National Immunization Schedule 2024",
      publicationDate: "2024-04-01",
    },
    doses: [
      { doseNumber: 1, ageLabel: "6 weeks", minimumAgeDays: 42, recommendedAgeDays: 42 },
      { doseNumber: 2, ageLabel: "10 weeks", minimumAgeDays: 70, recommendedAgeDays: 70 },
      { doseNumber: 3, ageLabel: "14 weeks", minimumAgeDays: 98, recommendedAgeDays: 98 },
    ],
  },
  {
    vaccineGroup: "Vitamin-A",
    shortName: "Vitamin A",
    cvxCodes: [],
    region: "in",
    programName: "India UIP",
    citation: {
      source: "MoHFW",
      documentTitle: "India National Immunization Schedule 2024",
      publicationDate: "2024-04-01",
    },
    doses: [
      { doseNumber: 1, ageLabel: "9 months", minimumAgeDays: 274, recommendedAgeDays: 274, notes: "1 lakh IU with MR1" },
      { doseNumber: 2, ageLabel: "16-18 months", minimumAgeDays: 487, recommendedAgeDays: 548, notes: "2 lakh IU" },
      { doseNumber: 3, ageLabel: "24 months", minimumAgeDays: 730, recommendedAgeDays: 730, notes: "2 lakh IU — biannual through 5y" },
    ],
  },
];

// ─── WHO — Expanded Programme on Immunization (EPI) ─────────────────────────

export const WHO_EPI_SCHEDULE: RegionVaccineEntry[] = [
  {
    vaccineGroup: "BCG",
    shortName: "BCG",
    cvxCodes: ["19"],
    region: "who",
    programName: "WHO EPI",
    citation: {
      source: "WHO",
      documentTitle: "WHO Immunization Schedule 2025",
      publicationDate: "2025-01-01",
      url: "https://www.who.int/teams/immunization-vaccines-and-biologicals/policies/who-recommendations-for-routine-immunization",
    },
    doses: [
      { doseNumber: 1, ageLabel: "Birth", minimumAgeDays: 0, recommendedAgeDays: 0 },
    ],
  },
  {
    vaccineGroup: "HepB-Birth",
    shortName: "HepB (Birth)",
    cvxCodes: ["08", "44", "45"],
    region: "who",
    programName: "WHO EPI",
    citation: {
      source: "WHO",
      documentTitle: "WHO Immunization Schedule 2025",
      publicationDate: "2025-01-01",
    },
    doses: [
      { doseNumber: 1, ageLabel: "Birth (<24 h)", minimumAgeDays: 0, recommendedAgeDays: 0 },
    ],
  },
  {
    vaccineGroup: "DTP-HepB-Hib",
    shortName: "DTP-HepB-Hib",
    cvxCodes: ["120", "132"],
    region: "who",
    programName: "WHO EPI",
    citation: {
      source: "WHO",
      documentTitle: "WHO Immunization Schedule 2025",
      publicationDate: "2025-01-01",
    },
    doses: [
      { doseNumber: 1, ageLabel: "6 weeks", minimumAgeDays: 42, recommendedAgeDays: 42 },
      { doseNumber: 2, ageLabel: "10 weeks", minimumAgeDays: 70, recommendedAgeDays: 70 },
      { doseNumber: 3, ageLabel: "14 weeks", minimumAgeDays: 98, recommendedAgeDays: 98 },
    ],
  },
  {
    vaccineGroup: "OPV",
    shortName: "OPV",
    cvxCodes: ["02"],
    region: "who",
    programName: "WHO EPI",
    citation: {
      source: "WHO",
      documentTitle: "WHO Immunization Schedule 2025",
      publicationDate: "2025-01-01",
    },
    doses: [
      { doseNumber: 0, ageLabel: "Birth (bOPV0)", minimumAgeDays: 0, recommendedAgeDays: 0 },
      { doseNumber: 1, ageLabel: "6 weeks", minimumAgeDays: 42, recommendedAgeDays: 42 },
      { doseNumber: 2, ageLabel: "10 weeks", minimumAgeDays: 70, recommendedAgeDays: 70 },
      { doseNumber: 3, ageLabel: "14 weeks", minimumAgeDays: 98, recommendedAgeDays: 98 },
    ],
  },
  {
    vaccineGroup: "IPV",
    shortName: "IPV",
    cvxCodes: ["10", "89"],
    region: "who",
    programName: "WHO EPI",
    citation: {
      source: "WHO",
      documentTitle: "WHO Immunization Schedule 2025",
      publicationDate: "2025-01-01",
    },
    doses: [
      { doseNumber: 1, ageLabel: "14 weeks", minimumAgeDays: 98, recommendedAgeDays: 98 },
    ],
  },
  {
    vaccineGroup: "Measles-Rubella",
    shortName: "MCV1/MCV2",
    cvxCodes: ["03", "04", "94"],
    region: "who",
    programName: "WHO EPI",
    citation: {
      source: "WHO",
      documentTitle: "WHO Immunization Schedule 2025",
      publicationDate: "2025-01-01",
    },
    doses: [
      { doseNumber: 1, ageLabel: "9 months (high-burden) / 12 months (low-burden)", minimumAgeDays: 274, recommendedAgeDays: 274, notes: "MCV1: 9 months where measles is endemic" },
      { doseNumber: 2, ageLabel: "15-18 months", minimumAgeDays: 457, recommendedAgeDays: 487 },
    ],
  },
  {
    vaccineGroup: "PCV-WHO",
    shortName: "PCV",
    cvxCodes: ["133", "152", "215", "216"],
    region: "who",
    programName: "WHO EPI",
    citation: {
      source: "WHO",
      documentTitle: "WHO Immunization Schedule 2025",
      publicationDate: "2025-01-01",
    },
    doses: [
      { doseNumber: 1, ageLabel: "6 weeks", minimumAgeDays: 42, recommendedAgeDays: 42 },
      { doseNumber: 2, ageLabel: "10 weeks", minimumAgeDays: 70, recommendedAgeDays: 70 },
      { doseNumber: 3, ageLabel: "9-15 months (booster)", minimumAgeDays: 274, recommendedAgeDays: 365, notes: "Or 14 weeks for 3-dose primary without booster" },
    ],
  },
  {
    vaccineGroup: "Rotavirus-WHO",
    shortName: "Rotavirus",
    cvxCodes: ["116", "119", "122"],
    region: "who",
    programName: "WHO EPI",
    citation: {
      source: "WHO",
      documentTitle: "WHO Immunization Schedule 2025",
      publicationDate: "2025-01-01",
    },
    doses: [
      { doseNumber: 1, ageLabel: "6 weeks", minimumAgeDays: 42, recommendedAgeDays: 42 },
      { doseNumber: 2, ageLabel: "10 weeks", minimumAgeDays: 70, recommendedAgeDays: 70 },
    ],
  },
  {
    vaccineGroup: "HPV-WHO",
    shortName: "HPV",
    cvxCodes: ["62", "137", "165"],
    region: "who",
    programName: "WHO EPI",
    citation: {
      source: "WHO",
      documentTitle: "WHO Immunization Schedule 2025",
      publicationDate: "2025-01-01",
    },
    doses: [
      { doseNumber: 1, ageLabel: "9-14 years (primary target)", minimumAgeDays: 3285, recommendedAgeDays: 3650, notes: "1- or 2-dose schedule per WHO SAGE 2022" },
    ],
  },
];

// ─── Router ──────────────────────────────────────────────────────────────────

export type VaccineRegion = "us" | "in" | "au" | "who";

/** Returns the region pack for the given homeRegion. "us" uses the main ACIP engine. */
export function getRegionPack(region: string): RegionVaccineEntry[] {
  switch (region) {
    case "in": return IN_UIP_SCHEDULE;
    case "who": return WHO_EPI_SCHEDULE;
    // "au" handled by au-region-routes + HL7 AU FHIR profile; falls back to WHO baseline
    case "au": return WHO_EPI_SCHEDULE;
    // "us" is the main ACIP engine (vaccine-rules-engine-v2); no pack here
    default: return [];
  }
}

export function getSupportedRegions(): VaccineRegion[] {
  return ["us", "in", "au", "who"];
}
