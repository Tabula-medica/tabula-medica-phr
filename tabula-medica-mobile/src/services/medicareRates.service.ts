/**
 * medicareRates.service.ts
 * Tabula Medica — Medicare 2026 Physician Fee Schedule (PFS) Rate Lookup
 *
 * Central rate table for all Uninsurance Mode pricing. Uses CY 2026
 * Medicare PFS national unadjusted rates as the baseline cash price.
 * Providers in the Uninsurance network agree to accept Medicare rates
 * for uninsured patients (per Provider Agreement §2.1).
 *
 * Rate sources:
 *   - CMS CY 2026 PFS Final Rule (Federal Register)
 *   - Clinical Laboratory Fee Schedule (CLFS) 2026
 *   - Hospital Outpatient Prospective Payment System (OPPS) 2026
 *
 * Typical market prices are rough chargemaster midpoints from
 * FAIR Health consumer data — used only for savings display.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MedicareRate {
  cptCode: string;
  serviceName: string;
  medicareRate2026: number;
  typicalMarket: number;
  category: RateCategory;
  requiresOrder: boolean;
  description?: string;
  rvu?: number;
  facilityRate?: number;
}

export type RateCategory =
  | 'office'
  | 'lab'
  | 'imaging'
  | 'pharmacy'
  | 'mental_health'
  | 'preventive'
  | 'dental'
  | 'urgent'
  | 'telehealth'
  | 'other';

export interface RateSearchResult {
  rates: MedicareRate[];
  query: string;
  totalMatches: number;
}

export interface SavingsCalculation {
  cptCode: string;
  serviceName: string;
  marketPrice: number;
  medicarePrice: number;
  savingsAmount: number;
  savingsPercent: number;
}

// ─── Medicare 2026 PFS Rate Table ────────────────────────────────────────────

export const MEDICARE_RATES: MedicareRate[] = [
  // Office visits — E/M codes
  { cptCode: '99213', serviceName: 'Office Visit — Established (Level 3)', medicareRate2026: 82.40, typicalMarket: 350, category: 'office', requiresOrder: false, rvu: 2.25 },
  { cptCode: '99214', serviceName: 'Office Visit — Established (Level 4)', medicareRate2026: 120.82, typicalMarket: 500, category: 'office', requiresOrder: false, rvu: 3.30 },
  { cptCode: '99215', serviceName: 'Office Visit — Established (Level 5)', medicareRate2026: 167.50, typicalMarket: 700, category: 'office', requiresOrder: false, rvu: 4.58 },
  { cptCode: '99203', serviceName: 'Office Visit — New Patient (Level 3)', medicareRate2026: 136.44, typicalMarket: 450, category: 'office', requiresOrder: false, rvu: 3.73 },
  { cptCode: '99204', serviceName: 'Office Visit — New Patient (Level 4)', medicareRate2026: 170.00, typicalMarket: 600, category: 'office', requiresOrder: false, rvu: 4.65 },
  { cptCode: '99205', serviceName: 'Office Visit — New Patient (Level 5)', medicareRate2026: 218.00, typicalMarket: 800, category: 'office', requiresOrder: false, rvu: 5.96 },

  // Telehealth
  { cptCode: '99213-GT', serviceName: 'Telehealth Visit — Established', medicareRate2026: 75.00, typicalMarket: 200, category: 'telehealth', requiresOrder: false },
  { cptCode: '99214-GT', serviceName: 'Telehealth Visit — Established (Level 4)', medicareRate2026: 110.00, typicalMarket: 350, category: 'telehealth', requiresOrder: false },

  // Preventive / wellness
  { cptCode: 'G0439', serviceName: 'Annual Wellness Visit', medicareRate2026: 118.00, typicalMarket: 500, category: 'preventive', requiresOrder: false },
  { cptCode: 'G0438', serviceName: 'Initial Wellness Visit', medicareRate2026: 175.00, typicalMarket: 600, category: 'preventive', requiresOrder: false },
  { cptCode: '99385', serviceName: 'Preventive Visit — 18-39 (New)', medicareRate2026: 150.00, typicalMarket: 500, category: 'preventive', requiresOrder: false },
  { cptCode: '99395', serviceName: 'Preventive Visit — 18-39 (Established)', medicareRate2026: 130.00, typicalMarket: 400, category: 'preventive', requiresOrder: false },

  // Mental health
  { cptCode: '90834', serviceName: 'Mental Health — 45 min Therapy', medicareRate2026: 77.00, typicalMarket: 250, category: 'mental_health', requiresOrder: false },
  { cptCode: '90837', serviceName: 'Mental Health — 60 min Therapy', medicareRate2026: 102.00, typicalMarket: 350, category: 'mental_health', requiresOrder: false },
  { cptCode: '90791', serviceName: 'Psychiatric Diagnostic Evaluation', medicareRate2026: 138.00, typicalMarket: 500, category: 'mental_health', requiresOrder: false },
  { cptCode: '99213-25+90833', serviceName: 'Med Management + 30 min Therapy', medicareRate2026: 132.00, typicalMarket: 450, category: 'mental_health', requiresOrder: false },

  // Lab — Clinical Lab Fee Schedule
  { cptCode: '80053', serviceName: 'Comprehensive Metabolic Panel (CMP)', medicareRate2026: 12.50, typicalMarket: 250, category: 'lab', requiresOrder: true },
  { cptCode: '85025', serviceName: 'CBC with Differential', medicareRate2026: 11.00, typicalMarket: 180, category: 'lab', requiresOrder: true },
  { cptCode: '83036', serviceName: 'HbA1c — Diabetes Management', medicareRate2026: 12.00, typicalMarket: 120, category: 'lab', requiresOrder: true },
  { cptCode: '80061', serviceName: 'Lipid Panel', medicareRate2026: 17.00, typicalMarket: 150, category: 'lab', requiresOrder: true },
  { cptCode: '84443', serviceName: 'TSH — Thyroid', medicareRate2026: 19.00, typicalMarket: 160, category: 'lab', requiresOrder: true },
  { cptCode: '81001', serviceName: 'Urinalysis with Microscopy', medicareRate2026: 4.50, typicalMarket: 80, category: 'lab', requiresOrder: true },
  { cptCode: '87086', serviceName: 'Urine Culture', medicareRate2026: 10.00, typicalMarket: 100, category: 'lab', requiresOrder: true },
  { cptCode: '36415', serviceName: 'Venipuncture (Blood Draw)', medicareRate2026: 3.00, typicalMarket: 50, category: 'lab', requiresOrder: true },
  { cptCode: '25OH-D', serviceName: 'Vitamin D Level', medicareRate2026: 28.00, typicalMarket: 200, category: 'lab', requiresOrder: true },
  { cptCode: '84439', serviceName: 'Free T4 — Thyroid', medicareRate2026: 12.00, typicalMarket: 120, category: 'lab', requiresOrder: true },

  // Imaging
  { cptCode: '71046', serviceName: 'Chest X-Ray — 2 Views', medicareRate2026: 42.00, typicalMarket: 500, category: 'imaging', requiresOrder: true },
  { cptCode: '70553', serviceName: 'MRI Brain with & without Contrast', medicareRate2026: 280.00, typicalMarket: 4000, category: 'imaging', requiresOrder: true },
  { cptCode: '73721', serviceName: 'MRI Knee without Contrast', medicareRate2026: 220.00, typicalMarket: 3000, category: 'imaging', requiresOrder: true },
  { cptCode: '74177', serviceName: 'CT Abdomen/Pelvis with Contrast', medicareRate2026: 195.00, typicalMarket: 3500, category: 'imaging', requiresOrder: true },
  { cptCode: '76856', serviceName: 'Pelvic Ultrasound', medicareRate2026: 85.00, typicalMarket: 800, category: 'imaging', requiresOrder: true },

  // Other / procedures
  { cptCode: '93000', serviceName: 'EKG with Interpretation', medicareRate2026: 22.00, typicalMarket: 200, category: 'other', requiresOrder: true },
  { cptCode: '99283', serviceName: 'ER Visit — Moderate Severity', medicareRate2026: 105.00, typicalMarket: 1800, category: 'urgent', requiresOrder: false },
  { cptCode: '99284', serviceName: 'ER Visit — High Severity', medicareRate2026: 165.00, typicalMarket: 3200, category: 'urgent', requiresOrder: false },
  { cptCode: '10060', serviceName: 'Incision & Drainage — Simple Abscess', medicareRate2026: 120.00, typicalMarket: 800, category: 'other', requiresOrder: false },
  { cptCode: '11102', serviceName: 'Skin Biopsy — Tangential', medicareRate2026: 85.00, typicalMarket: 500, category: 'other', requiresOrder: true },

  // Dental (dental codes used by FQHCs)
  { cptCode: 'D0120', serviceName: 'Periodic Oral Evaluation', medicareRate2026: 35.00, typicalMarket: 80, category: 'dental', requiresOrder: false },
  { cptCode: 'D0274', serviceName: 'Bitewing X-Rays — 4 Films', medicareRate2026: 45.00, typicalMarket: 120, category: 'dental', requiresOrder: false },
  { cptCode: 'D1110', serviceName: 'Adult Prophylaxis (Cleaning)', medicareRate2026: 65.00, typicalMarket: 200, category: 'dental', requiresOrder: false },
  { cptCode: 'D2392', serviceName: 'Composite Filling — 2 Surfaces', medicareRate2026: 120.00, typicalMarket: 350, category: 'dental', requiresOrder: false },
  { cptCode: 'D7140', serviceName: 'Simple Extraction', medicareRate2026: 95.00, typicalMarket: 300, category: 'dental', requiresOrder: false },
];

// ─── Lookup Functions ────────────────────────────────────────────────────────

export function getMedicareRate(cptCode: string): MedicareRate | undefined {
  return MEDICARE_RATES.find((r) => r.cptCode === cptCode);
}

export function getRatesByCategory(category: RateCategory): MedicareRate[] {
  return MEDICARE_RATES.filter((r) => r.category === category);
}

export function searchRates(query: string): RateSearchResult {
  const q = query.toLowerCase().trim();
  if (!q) return { rates: [], query, totalMatches: 0 };

  const matches = MEDICARE_RATES.filter(
    (r) =>
      r.cptCode.toLowerCase().includes(q) ||
      r.serviceName.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q),
  );

  return { rates: matches, query, totalMatches: matches.length };
}

export function calculateSavings(cptCode: string): SavingsCalculation | null {
  const rate = getMedicareRate(cptCode);
  if (!rate) return null;

  const savingsAmount = rate.typicalMarket - rate.medicareRate2026;
  const savingsPercent = Math.round((savingsAmount / rate.typicalMarket) * 100);

  return {
    cptCode: rate.cptCode,
    serviceName: rate.serviceName,
    marketPrice: rate.typicalMarket,
    medicarePrice: rate.medicareRate2026,
    savingsAmount,
    savingsPercent,
  };
}

export function getAllCategories(): RateCategory[] {
  const cats = new Set<RateCategory>();
  MEDICARE_RATES.forEach((r) => cats.add(r.category));
  return Array.from(cats);
}

export function getTopSavings(limit: number = 10): SavingsCalculation[] {
  return MEDICARE_RATES
    .map((r) => calculateSavings(r.cptCode)!)
    .filter(Boolean)
    .sort((a, b) => b.savingsPercent - a.savingsPercent)
    .slice(0, limit);
}
