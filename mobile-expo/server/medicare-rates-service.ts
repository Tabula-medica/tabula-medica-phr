// @ts-nocheck
import { Router, Request, Response } from "express";

export interface MedicareRateLookup {
  cptCode: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  facilityRate: number;
  nonFacilityRate: number;
  tabulaMedicaRate: number;
  nationalAvgRetail: number;
  savingsPercent: number;
  rvu: { work: number; practice: number; malpractice: number; total: number };
  conversionFactor: number;
  effectiveDate: string;
  hsaEligible: boolean;
}

const CONVERSION_FACTOR_2026 = 32.74;

const CPT_DATABASE: Record<string, Omit<MedicareRateLookup, "tabulaMedicaRate" | "savingsPercent" | "conversionFactor" | "effectiveDate" | "hsaEligible">> = {
  "99202": { cptCode: "99202", shortDescription: "New Patient Visit (Level 2)", longDescription: "Office or other outpatient visit for the evaluation and management of a new patient, straightforward MDM", category: "Office Visits", facilityRate: 56.88, nonFacilityRate: 74.62, nationalAvgRetail: 250, rvu: { work: 0.93, practice: 1.21, malpractice: 0.14, total: 2.28 } },
  "99203": { cptCode: "99203", shortDescription: "New Patient Visit (Level 3)", longDescription: "Office or other outpatient visit for the evaluation and management of a new patient, low complexity MDM", category: "Office Visits", facilityRate: 85.32, nonFacilityRate: 112.47, nationalAvgRetail: 350, rvu: { work: 1.60, practice: 1.84, malpractice: 0.20, total: 3.64 } },
  "99204": { cptCode: "99204", shortDescription: "New Patient Visit (Level 4)", longDescription: "Office or other outpatient visit for the evaluation and management of a new patient, moderate complexity MDM", category: "Office Visits", facilityRate: 131.76, nonFacilityRate: 171.98, nationalAvgRetail: 500, rvu: { work: 2.60, practice: 2.65, malpractice: 0.31, total: 5.56 } },
  "99211": { cptCode: "99211", shortDescription: "Established Visit (Level 1)", longDescription: "Office or other outpatient visit, may not require physician presence", category: "Office Visits", facilityRate: 18.28, nonFacilityRate: 23.54, nationalAvgRetail: 75, rvu: { work: 0.18, practice: 0.54, malpractice: 0.02, total: 0.74 } },
  "99212": { cptCode: "99212", shortDescription: "Established Visit (Level 2)", longDescription: "Office or other outpatient visit for the evaluation and management of an established patient, straightforward MDM", category: "Office Visits", facilityRate: 43.56, nonFacilityRate: 57.16, nationalAvgRetail: 175, rvu: { work: 0.70, practice: 1.05, malpractice: 0.10, total: 1.85 } },
  "99213": { cptCode: "99213", shortDescription: "Established Visit (Level 3)", longDescription: "Office or other outpatient visit for the evaluation and management of an established patient, low complexity MDM", category: "Office Visits", facilityRate: 62.82, nonFacilityRate: 82.40, nationalAvgRetail: 250, rvu: { work: 1.30, practice: 1.22, malpractice: 0.15, total: 2.67 } },
  "99214": { cptCode: "99214", shortDescription: "Established Visit (Level 4)", longDescription: "Office or other outpatient visit for the evaluation and management of an established patient, moderate complexity MDM", category: "Office Visits", facilityRate: 92.10, nonFacilityRate: 120.86, nationalAvgRetail: 375, rvu: { work: 1.92, practice: 1.77, malpractice: 0.22, total: 3.91 } },
  "99215": { cptCode: "99215", shortDescription: "Established Visit (Level 5)", longDescription: "Office or other outpatient visit for the evaluation and management of an established patient, high complexity MDM", category: "Office Visits", facilityRate: 122.78, nonFacilityRate: 161.08, nationalAvgRetail: 550, rvu: { work: 2.80, practice: 2.12, malpractice: 0.31, total: 5.23 } },
  "36415": { cptCode: "36415", shortDescription: "Blood Draw (Venipuncture)", longDescription: "Collection of venous blood by venipuncture", category: "Lab & Pathology", facilityRate: 3.00, nonFacilityRate: 8.36, nationalAvgRetail: 35, rvu: { work: 0.0, practice: 0.26, malpractice: 0.01, total: 0.27 } },
  "80053": { cptCode: "80053", shortDescription: "Comprehensive Metabolic Panel", longDescription: "Comprehensive metabolic panel (includes albumin, bilirubin, calcium, carbon dioxide, chloride, creatinine, glucose, phosphatase-alkaline, potassium, protein-total, sodium, transferase-alanine amino, transferase-aspartate amino, urea nitrogen)", category: "Lab & Pathology", facilityRate: 11.47, nonFacilityRate: 11.47, nationalAvgRetail: 80, rvu: { work: 0.0, practice: 0.35, malpractice: 0.0, total: 0.35 } },
  "85025": { cptCode: "85025", shortDescription: "Complete Blood Count (CBC)", longDescription: "Blood count; complete (CBC), automated and automated differential WBC count", category: "Lab & Pathology", facilityRate: 7.77, nonFacilityRate: 7.77, nationalAvgRetail: 50, rvu: { work: 0.0, practice: 0.24, malpractice: 0.0, total: 0.24 } },
  "83036": { cptCode: "83036", shortDescription: "Hemoglobin A1C", longDescription: "Hemoglobin; glycosylated (A1C)", category: "Lab & Pathology", facilityRate: 9.13, nonFacilityRate: 9.13, nationalAvgRetail: 60, rvu: { work: 0.0, practice: 0.28, malpractice: 0.0, total: 0.28 } },
  "80061": { cptCode: "80061", shortDescription: "Lipid Panel", longDescription: "Lipid panel (total cholesterol, HDL, LDL calculated, triglycerides)", category: "Lab & Pathology", facilityRate: 13.39, nonFacilityRate: 13.39, nationalAvgRetail: 75, rvu: { work: 0.0, practice: 0.41, malpractice: 0.0, total: 0.41 } },
  "81001": { cptCode: "81001", shortDescription: "Urinalysis, Automated", longDescription: "Urinalysis, by dip stick or tablet reagent; automated, with microscopy", category: "Lab & Pathology", facilityRate: 3.57, nonFacilityRate: 3.57, nationalAvgRetail: 30, rvu: { work: 0.0, practice: 0.11, malpractice: 0.0, total: 0.11 } },
  "71046": { cptCode: "71046", shortDescription: "Chest X-Ray (2 views)", longDescription: "Radiologic examination, chest; 2 views", category: "Imaging", facilityRate: 22.94, nonFacilityRate: 22.94, nationalAvgRetail: 250, rvu: { work: 0.18, practice: 0.52, malpractice: 0.02, total: 0.72 } },
  "73030": { cptCode: "73030", shortDescription: "Shoulder X-Ray", longDescription: "Radiologic examination, shoulder; complete, minimum of 2 views", category: "Imaging", facilityRate: 22.94, nonFacilityRate: 22.94, nationalAvgRetail: 200, rvu: { work: 0.17, practice: 0.53, malpractice: 0.02, total: 0.72 } },
  "90471": { cptCode: "90471", shortDescription: "Immunization Admin (First)", longDescription: "Immunization administration (includes percutaneous, intradermal, subcutaneous, or intramuscular injections); 1 vaccine", category: "Preventive Care", facilityRate: 18.96, nonFacilityRate: 28.42, nationalAvgRetail: 40, rvu: { work: 0.17, practice: 0.70, malpractice: 0.02, total: 0.89 } },
  "99385": { cptCode: "99385", shortDescription: "Annual Physical (18-39)", longDescription: "Initial comprehensive preventive medicine evaluation, new patient; 18-39 years", category: "Preventive Care", facilityRate: 108.32, nonFacilityRate: 149.24, nationalAvgRetail: 400, rvu: { work: 1.92, practice: 2.64, malpractice: 0.22, total: 4.78 } },
  "99386": { cptCode: "99386", shortDescription: "Annual Physical (40-64)", longDescription: "Initial comprehensive preventive medicine evaluation, new patient; 40-64 years", category: "Preventive Care", facilityRate: 122.78, nonFacilityRate: 168.38, nationalAvgRetail: 450, rvu: { work: 2.33, practice: 2.81, malpractice: 0.26, total: 5.40 } },
  "99395": { cptCode: "99395", shortDescription: "Annual Physical Follow-up (18-39)", longDescription: "Periodic comprehensive preventive medicine reevaluation, established patient; 18-39 years", category: "Preventive Care", facilityRate: 92.10, nonFacilityRate: 127.68, nationalAvgRetail: 350, rvu: { work: 1.50, practice: 2.40, malpractice: 0.18, total: 4.08 } },
  "10060": { cptCode: "10060", shortDescription: "Drainage of Skin Abscess", longDescription: "Incision and drainage of abscess; simple or single", category: "Procedures", facilityRate: 63.50, nonFacilityRate: 108.98, nationalAvgRetail: 500, rvu: { work: 1.22, practice: 2.11, malpractice: 0.14, total: 3.47 } },
  "11102": { cptCode: "11102", shortDescription: "Skin Biopsy (First Lesion)", longDescription: "Tangential biopsy of skin; single lesion", category: "Procedures", facilityRate: 47.48, nonFacilityRate: 82.40, nationalAvgRetail: 350, rvu: { work: 0.56, practice: 1.96, malpractice: 0.06, total: 2.58 } },
  "90837": { cptCode: "90837", shortDescription: "Therapy Session (60 min)", longDescription: "Psychotherapy, 60 minutes with patient", category: "Mental Health", facilityRate: 109.66, nonFacilityRate: 133.12, nationalAvgRetail: 250, rvu: { work: 2.40, practice: 1.67, malpractice: 0.09, total: 4.16 } },
  "90834": { cptCode: "90834", shortDescription: "Therapy Session (45 min)", longDescription: "Psychotherapy, 45 minutes with patient", category: "Mental Health", facilityRate: 82.40, nonFacilityRate: 100.14, nationalAvgRetail: 200, rvu: { work: 1.80, practice: 1.26, malpractice: 0.07, total: 3.13 } },
  "D0120": { cptCode: "D0120", shortDescription: "Periodic Oral Exam", longDescription: "Periodic oral evaluation — established patient", category: "Dental", facilityRate: 35.00, nonFacilityRate: 35.00, nationalAvgRetail: 80, rvu: { work: 0.5, practice: 0.5, malpractice: 0.07, total: 1.07 } },
  "D1110": { cptCode: "D1110", shortDescription: "Dental Cleaning (Adult)", longDescription: "Prophylaxis — adult, dental cleaning", category: "Dental", facilityRate: 75.00, nonFacilityRate: 75.00, nationalAvgRetail: 175, rvu: { work: 0.8, practice: 1.5, malpractice: 0.1, total: 2.4 } },
  "D0274": { cptCode: "D0274", shortDescription: "Bitewing X-Rays (4 films)", longDescription: "Bitewings — four radiographic images", category: "Dental", facilityRate: 45.00, nonFacilityRate: 45.00, nationalAvgRetail: 100, rvu: { work: 0.2, practice: 1.2, malpractice: 0.05, total: 1.45 } },
};

function buildRateLookup(entry: typeof CPT_DATABASE[string]): MedicareRateLookup {
  const tabulaRate = entry.nonFacilityRate;
  const savingsPercent = Math.round(((entry.nationalAvgRetail - tabulaRate) / entry.nationalAvgRetail) * 100);
  return {
    ...entry,
    tabulaMedicaRate: tabulaRate,
    savingsPercent,
    conversionFactor: CONVERSION_FACTOR_2026,
    effectiveDate: "2026-01-01",
    hsaEligible: true,
  };
}

export function createMedicareRatesRouter(): Router {
  const router = Router();

  router.get("/lookup/:cptCode", (req: Request, res: Response) => {
    const entry = CPT_DATABASE[req.params.cptCode.toUpperCase()];
    if (!entry) {
      return res.status(404).json({ error: "CPT code not found", cptCode: req.params.cptCode });
    }
    res.json(buildRateLookup(entry));
  });

  router.post("/lookup/batch", (req: Request, res: Response) => {
    const { cptCodes } = req.body;
    if (!Array.isArray(cptCodes)) {
      return res.status(400).json({ error: "cptCodes must be an array" });
    }
    const results = cptCodes.map((code: string) => {
      const entry = CPT_DATABASE[code.toUpperCase()];
      return entry ? buildRateLookup(entry) : { cptCode: code, error: "not_found" };
    });
    res.json({ rates: results, conversionFactor: CONVERSION_FACTOR_2026, effectiveYear: 2026 });
  });

  router.get("/search", (req: Request, res: Response) => {
    const { q, category } = req.query;
    let results = Object.values(CPT_DATABASE);

    if (q) {
      const query = String(q).toLowerCase();
      results = results.filter(r =>
        r.cptCode.toLowerCase().includes(query) ||
        r.shortDescription.toLowerCase().includes(query) ||
        r.longDescription.toLowerCase().includes(query)
      );
    }

    if (category) {
      results = results.filter(r => r.category === String(category));
    }

    res.json({
      rates: results.map(buildRateLookup),
      totalFound: results.length,
      categories: [...new Set(Object.values(CPT_DATABASE).map(r => r.category))],
      conversionFactor: CONVERSION_FACTOR_2026,
    });
  });

  router.get("/categories", (_req: Request, res: Response) => {
    const categories = [...new Set(Object.values(CPT_DATABASE).map(r => r.category))];
    const counts = categories.map(cat => ({
      category: cat,
      count: Object.values(CPT_DATABASE).filter(r => r.category === cat).length,
    }));
    res.json({ categories: counts });
  });

  router.get("/conversion-factor", (_req: Request, res: Response) => {
    res.json({
      conversionFactor: CONVERSION_FACTOR_2026,
      effectiveYear: 2026,
      source: "CMS Physician Fee Schedule",
      lastUpdated: "2025-11-01",
    });
  });

  return router;
}
