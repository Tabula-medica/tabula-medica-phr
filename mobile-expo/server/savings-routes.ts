import { Router, Request, Response } from "express";

const router = Router();

interface DrugCouponProgram {
  id: string;
  drugName: string;
  genericName: string | null;
  manufacturer: string;
  category: string;
  description: string;
  savingsDescription: string;
  couponUrl: string;
  type: "manufacturer_copay" | "patient_assistance" | "discount_program" | "savings_card";
}

interface ImagingType {
  name: string;
  description: string;
  typicalSavingsRange: string;
  commonUses: string[];
}

const DRUG_COUPON_PROGRAMS: DrugCouponProgram[] = [
  {
    id: "humira",
    drugName: "Humira",
    genericName: "adalimumab",
    manufacturer: "AbbVie",
    category: "autoimmune",
    description: "Biologic for rheumatoid arthritis, Crohn's disease, psoriasis, and other autoimmune conditions.",
    savingsDescription: "HUMIRA Complete savings card — eligible commercially insured patients may pay as little as $5/month.",
    couponUrl: "https://www.humira.com/humira-complete/cost-and-copay",
    type: "manufacturer_copay",
  },
  {
    id: "eliquis",
    drugName: "Eliquis",
    genericName: "apixaban",
    manufacturer: "Bristol-Myers Squibb / Pfizer",
    category: "cardiovascular",
    description: "Blood thinner used to reduce risk of stroke and blood clots in patients with atrial fibrillation.",
    savingsDescription: "Eliquis co-pay card — eligible patients may pay as little as $10/month.",
    couponUrl: "https://www.eliquis.bmscustomerconnect.com/eliquis-free-trial-offer",
    type: "manufacturer_copay",
  },
  {
    id: "jardiance",
    drugName: "Jardiance",
    genericName: "empagliflozin",
    manufacturer: "Boehringer Ingelheim / Eli Lilly",
    category: "diabetes",
    description: "SGLT2 inhibitor for type 2 diabetes and heart failure.",
    savingsDescription: "Jardiance savings card — eligible patients may pay as little as $10/month.",
    couponUrl: "https://www.jardiance.com/savings/",
    type: "manufacturer_copay",
  },
  {
    id: "ozempic",
    drugName: "Ozempic",
    genericName: "semaglutide",
    manufacturer: "Novo Nordisk",
    category: "diabetes",
    description: "GLP-1 receptor agonist for type 2 diabetes management.",
    savingsDescription: "Ozempic savings card — eligible commercially insured patients may pay as little as $25 for a 1-, 2-, or 3-month prescription.",
    couponUrl: "https://www.ozempic.com/savings-and-resources/save-on-ozempic.html",
    type: "manufacturer_copay",
  },
  {
    id: "dupixent",
    drugName: "Dupixent",
    genericName: "dupilumab",
    manufacturer: "Regeneron / Sanofi",
    category: "autoimmune",
    description: "Biologic for eczema (atopic dermatitis), asthma, and nasal polyps.",
    savingsDescription: "Dupixent MyWay copay card — eligible patients may pay as little as $0 per fill.",
    couponUrl: "https://www.dupixent.com/support-savings/copay-card",
    type: "manufacturer_copay",
  },
  {
    id: "entresto",
    drugName: "Entresto",
    genericName: "sacubitril/valsartan",
    manufacturer: "Novartis",
    category: "cardiovascular",
    description: "Heart failure medication to reduce risk of cardiovascular death and hospitalization.",
    savingsDescription: "Entresto savings card — eligible patients may pay as little as $10 for each 30-day supply.",
    couponUrl: "https://www.entresto.com/heart-failure/paying-for-entresto",
    type: "manufacturer_copay",
  },
  {
    id: "keytruda",
    drugName: "Keytruda",
    genericName: "pembrolizumab",
    manufacturer: "Merck",
    category: "oncology",
    description: "Immunotherapy for various cancers including melanoma, lung cancer, and more.",
    savingsDescription: "Merck Patient Assistance Program — may provide Keytruda at no cost to eligible patients.",
    couponUrl: "https://www.merckhelps.com/keytruda",
    type: "patient_assistance",
  },
  {
    id: "xarelto",
    drugName: "Xarelto",
    genericName: "rivaroxaban",
    manufacturer: "Janssen (Johnson & Johnson)",
    category: "cardiovascular",
    description: "Blood thinner for DVT/PE treatment and stroke prevention in atrial fibrillation.",
    savingsDescription: "Xarelto savings program — eligible patients may pay as little as $10/month.",
    couponUrl: "https://www.xarelto-us.com/xarelto-cost",
    type: "manufacturer_copay",
  },
  {
    id: "trulicity",
    drugName: "Trulicity",
    genericName: "dulaglutide",
    manufacturer: "Eli Lilly",
    category: "diabetes",
    description: "GLP-1 receptor agonist for type 2 diabetes.",
    savingsDescription: "Trulicity savings card — eligible patients may pay as little as $25/month.",
    couponUrl: "https://www.trulicity.com/savings-resources",
    type: "manufacturer_copay",
  },
  {
    id: "skyrizi",
    drugName: "Skyrizi",
    genericName: "risankizumab",
    manufacturer: "AbbVie",
    category: "autoimmune",
    description: "Biologic for moderate to severe plaque psoriasis and psoriatic arthritis.",
    savingsDescription: "Skyrizi Complete savings program — eligible patients may pay as little as $5/month.",
    couponUrl: "https://www.skyrizi.com/skyrizi-complete/cost-and-financial-assistance",
    type: "manufacturer_copay",
  },
  {
    id: "rinvoq",
    drugName: "Rinvoq",
    genericName: "upadacitinib",
    manufacturer: "AbbVie",
    category: "autoimmune",
    description: "JAK inhibitor for rheumatoid arthritis, psoriatic arthritis, atopic dermatitis, and ulcerative colitis.",
    savingsDescription: "Rinvoq Complete savings card — eligible patients may pay as little as $5/month.",
    couponUrl: "https://www.rinvoq.com/rinvoq-complete/cost-savings",
    type: "manufacturer_copay",
  },
  {
    id: "otezla",
    drugName: "Otezla",
    genericName: "apremilast",
    manufacturer: "Amgen",
    category: "autoimmune",
    description: "PDE4 inhibitor for psoriatic arthritis, plaque psoriasis, and oral ulcers in Behcet's disease.",
    savingsDescription: "Otezla savings program — eligible patients may pay as little as $0/month.",
    couponUrl: "https://www.otezla.com/cost-and-copay",
    type: "manufacturer_copay",
  },
  {
    id: "farxiga",
    drugName: "Farxiga",
    genericName: "dapagliflozin",
    manufacturer: "AstraZeneca",
    category: "diabetes",
    description: "SGLT2 inhibitor for type 2 diabetes, heart failure, and chronic kidney disease.",
    savingsDescription: "Farxiga savings card — eligible patients may pay as little as $0/month.",
    couponUrl: "https://www.farxiga.com/savings-and-support",
    type: "manufacturer_copay",
  },
  {
    id: "rybelsus",
    drugName: "Rybelsus",
    genericName: "semaglutide (oral)",
    manufacturer: "Novo Nordisk",
    category: "diabetes",
    description: "Oral GLP-1 receptor agonist for type 2 diabetes.",
    savingsDescription: "Rybelsus savings offer — eligible commercially insured patients may pay as little as $10/month.",
    couponUrl: "https://www.rybelsus.com/savings-and-support/save-on-rybelsus.html",
    type: "manufacturer_copay",
  },
  {
    id: "wegovy",
    drugName: "Wegovy",
    genericName: "semaglutide (injection)",
    manufacturer: "Novo Nordisk",
    category: "weight_management",
    description: "GLP-1 receptor agonist approved for chronic weight management.",
    savingsDescription: "Wegovy savings offer — check eligibility for manufacturer savings programs.",
    couponUrl: "https://www.wegovy.com/coverage-and-cost/savings-offer.html",
    type: "manufacturer_copay",
  },
  {
    id: "mounjaro",
    drugName: "Mounjaro",
    genericName: "tirzepatide",
    manufacturer: "Eli Lilly",
    category: "diabetes",
    description: "Dual GIP/GLP-1 receptor agonist for type 2 diabetes.",
    savingsDescription: "Mounjaro savings card — eligible commercially insured patients may pay as little as $25/month.",
    couponUrl: "https://www.mounjaro.com/savings-resources",
    type: "manufacturer_copay",
  },
  {
    id: "stelara",
    drugName: "Stelara",
    genericName: "ustekinumab",
    manufacturer: "Janssen (Johnson & Johnson)",
    category: "autoimmune",
    description: "Biologic for psoriasis, psoriatic arthritis, Crohn's disease, and ulcerative colitis.",
    savingsDescription: "Stelara Janssen CarePath savings — eligible patients may pay $5 per infusion or injection.",
    couponUrl: "https://www.stelarainfo.com/crohns-disease/cost-and-insurance",
    type: "manufacturer_copay",
  },
  {
    id: "cosentyx",
    drugName: "Cosentyx",
    genericName: "secukinumab",
    manufacturer: "Novartis",
    category: "autoimmune",
    description: "Biologic for psoriasis, psoriatic arthritis, and ankylosing spondylitis.",
    savingsDescription: "Cosentyx Connect co-pay card — eligible patients may pay as little as $0/month.",
    couponUrl: "https://www.cosentyx.com/cost-support",
    type: "manufacturer_copay",
  },
  {
    id: "enbrel",
    drugName: "Enbrel",
    genericName: "etanercept",
    manufacturer: "Amgen",
    category: "autoimmune",
    description: "Biologic for rheumatoid arthritis, psoriatic arthritis, plaque psoriasis, and ankylosing spondylitis.",
    savingsDescription: "Enbrel Support co-pay card — eligible patients may pay as little as $5/month.",
    couponUrl: "https://www.enbrel.com/support/enbrel-support-card",
    type: "manufacturer_copay",
  },
  {
    id: "januvia",
    drugName: "Januvia",
    genericName: "sitagliptin",
    manufacturer: "Merck",
    category: "diabetes",
    description: "DPP-4 inhibitor for type 2 diabetes.",
    savingsDescription: "Januvia savings offer — eligible patients may save on their prescription.",
    couponUrl: "https://www.januvia.com/savings/",
    type: "manufacturer_copay",
  },
  {
    id: "goodrx",
    drugName: "GoodRx (Multi-Drug)",
    genericName: null,
    manufacturer: "GoodRx",
    category: "discount_platform",
    description: "Free prescription discount platform comparing prices across pharmacies for thousands of medications.",
    savingsDescription: "Free coupons for up to 80% off prescription drugs at over 70,000 pharmacies.",
    couponUrl: "https://www.goodrx.com",
    type: "discount_program",
  },
  {
    id: "rxassist",
    drugName: "RxAssist (Multi-Drug)",
    genericName: null,
    manufacturer: "RxAssist",
    category: "discount_platform",
    description: "Comprehensive database of patient assistance programs for prescription medications.",
    savingsDescription: "Free directory to find manufacturer assistance programs, state programs, discount cards, and copay help.",
    couponUrl: "https://www.rxassist.org",
    type: "patient_assistance",
  },
  {
    id: "needymeds",
    drugName: "NeedyMeds (Multi-Drug)",
    genericName: null,
    manufacturer: "NeedyMeds",
    category: "discount_platform",
    description: "Non-profit information resource for patient assistance programs, free/low-cost clinics, and drug discount cards.",
    savingsDescription: "Free drug discount card saving up to 80% on prescriptions, plus database of over 5,000 assistance programs.",
    couponUrl: "https://www.needymeds.org",
    type: "patient_assistance",
  },
  {
    id: "costplusdrugs",
    drugName: "Mark Cuban Cost Plus Drugs",
    genericName: null,
    manufacturer: "Cost Plus Drugs",
    category: "discount_platform",
    description: "Online pharmacy offering medications at manufacturer cost plus a flat 15% markup and dispensing fee.",
    savingsDescription: "Transparent pricing: manufacturer cost + 15% markup + $5 dispensing fee + $5 shipping.",
    couponUrl: "https://costplusdrugs.com",
    type: "discount_program",
  },
  {
    id: "lipitor",
    drugName: "Lipitor",
    genericName: "atorvastatin",
    manufacturer: "Pfizer (via Viatris)",
    category: "cardiovascular",
    description: "Statin for high cholesterol and cardiovascular risk reduction.",
    savingsDescription: "Generic atorvastatin widely available — check GoodRx for pharmacy price comparisons.",
    couponUrl: "https://www.goodrx.com/atorvastatin",
    type: "discount_program",
  },
  {
    id: "symbicort",
    drugName: "Symbicort",
    genericName: "budesonide/formoterol",
    manufacturer: "AstraZeneca",
    category: "respiratory",
    description: "Inhaler for asthma and COPD maintenance treatment.",
    savingsDescription: "Symbicort savings card — eligible patients may pay as little as $0 per prescription.",
    couponUrl: "https://www.symbicort.com/savings.html",
    type: "manufacturer_copay",
  },
  {
    id: "advair",
    drugName: "Advair Diskus",
    genericName: "fluticasone/salmeterol",
    manufacturer: "GSK",
    category: "respiratory",
    description: "Inhaler for asthma and COPD maintenance treatment.",
    savingsDescription: "GSK savings offers for Advair — eligible patients may save on prescriptions.",
    couponUrl: "https://www.gsksource.com/pharma/content/gsk/source/us/en/brands/advair.html",
    type: "manufacturer_copay",
  },
  {
    id: "trelegy",
    drugName: "Trelegy Ellipta",
    genericName: "fluticasone/umeclidinium/vilanterol",
    manufacturer: "GSK",
    category: "respiratory",
    description: "Triple therapy inhaler for COPD and asthma.",
    savingsDescription: "Trelegy savings offer — eligible patients may pay as little as $0/month.",
    couponUrl: "https://www.trelegy.com/savings-and-coupons/",
    type: "manufacturer_copay",
  },
  {
    id: "breo",
    drugName: "Breo Ellipta",
    genericName: "fluticasone/vilanterol",
    manufacturer: "GSK",
    category: "respiratory",
    description: "Inhaler for asthma and COPD.",
    savingsDescription: "GSK savings program — eligible patients may receive savings on Breo prescriptions.",
    couponUrl: "https://www.mybreo.com/savings-and-support/savings-offers/",
    type: "manufacturer_copay",
  },
  {
    id: "tremfya",
    drugName: "Tremfya",
    genericName: "guselkumab",
    manufacturer: "Janssen (Johnson & Johnson)",
    category: "autoimmune",
    description: "Biologic for moderate to severe plaque psoriasis and psoriatic arthritis.",
    savingsDescription: "Tremfya Janssen CarePath savings program — eligible patients may pay $5/injection.",
    couponUrl: "https://www.tremfya.com/cost-and-financial-support",
    type: "manufacturer_copay",
  },
  {
    id: "vraylar",
    drugName: "Vraylar",
    genericName: "cariprazine",
    manufacturer: "AbbVie",
    category: "mental_health",
    description: "Atypical antipsychotic for schizophrenia and bipolar disorder.",
    savingsDescription: "Vraylar savings program — eligible patients may pay as little as $15/month.",
    couponUrl: "https://www.vraylar.com/savings",
    type: "manufacturer_copay",
  },
  {
    id: "latuda",
    drugName: "Latuda",
    genericName: "lurasidone",
    manufacturer: "Sunovion (Sumitomo)",
    category: "mental_health",
    description: "Atypical antipsychotic for schizophrenia and bipolar depression.",
    savingsDescription: "Latuda savings program — check for available manufacturer copay assistance.",
    couponUrl: "https://www.latuda.com/savings-and-support",
    type: "manufacturer_copay",
  },
];

const IMAGING_TYPES: ImagingType[] = [
  {
    name: "MRI (Magnetic Resonance Imaging)",
    description: "Detailed imaging of soft tissues, joints, brain, and spine without radiation.",
    typicalSavingsRange: "$250 - $600 (vs. $1,000 - $5,000 at hospitals)",
    commonUses: ["Brain/head", "Spine (cervical, thoracic, lumbar)", "Knee/shoulder/hip joints", "Abdominal organs"],
  },
  {
    name: "CT Scan (Computed Tomography)",
    description: "Cross-sectional X-ray imaging for detailed views of bones, organs, and blood vessels.",
    typicalSavingsRange: "$150 - $400 (vs. $500 - $3,000 at hospitals)",
    commonUses: ["Chest CT", "Abdominal/pelvic CT", "Head CT", "Calcium scoring"],
  },
  {
    name: "X-Ray",
    description: "Basic imaging for bones, chest, and dental structures.",
    typicalSavingsRange: "$40 - $150 (vs. $100 - $1,000 at hospitals)",
    commonUses: ["Chest X-ray", "Bone fractures", "Spine alignment", "Dental panoramic"],
  },
  {
    name: "Ultrasound",
    description: "Sound wave imaging for soft tissues, organs, and pregnancy monitoring.",
    typicalSavingsRange: "$100 - $300 (vs. $200 - $1,500 at hospitals)",
    commonUses: ["Abdominal organs", "Thyroid", "Pelvic/OB", "Vascular (carotid, venous)"],
  },
  {
    name: "DEXA Scan (Bone Density)",
    description: "Low-dose X-ray scan measuring bone mineral density for osteoporosis screening.",
    typicalSavingsRange: "$75 - $200 (vs. $150 - $500 at hospitals)",
    commonUses: ["Osteoporosis screening", "Fracture risk assessment", "Bone health monitoring"],
  },
  {
    name: "Mammogram",
    description: "Breast imaging for cancer screening and diagnostic evaluation.",
    typicalSavingsRange: "$100 - $300 (vs. $200 - $1,000 at hospitals)",
    commonUses: ["Annual screening", "Diagnostic follow-up", "3D tomosynthesis"],
  },
  {
    name: "PET Scan",
    description: "Nuclear imaging showing metabolic activity, commonly used in cancer staging.",
    typicalSavingsRange: "$800 - $2,000 (vs. $3,000 - $12,000 at hospitals)",
    commonUses: ["Cancer staging", "Treatment monitoring", "Cardiac viability"],
  },
  {
    name: "Echocardiogram",
    description: "Ultrasound of the heart to evaluate structure and function.",
    typicalSavingsRange: "$150 - $400 (vs. $500 - $2,500 at hospitals)",
    commonUses: ["Heart valve assessment", "Heart failure evaluation", "Cardiac function"],
  },
];

router.get("/drug-coupons", (_req: Request, res: Response) => {
  const categories = [...new Set(DRUG_COUPON_PROGRAMS.map((p) => p.category))].sort();

  const grouped: Record<string, DrugCouponProgram[]> = {};
  for (const program of DRUG_COUPON_PROGRAMS) {
    if (!grouped[program.category]) {
      grouped[program.category] = [];
    }
    grouped[program.category].push(program);
  }

  res.json({
    programs: DRUG_COUPON_PROGRAMS,
    categories,
    grouped,
    totalPrograms: DRUG_COUPON_PROGRAMS.length,
    disclaimer:
      "Savings amounts and eligibility vary. These links are provided for informational purposes only. Always verify current offers directly with the manufacturer or program website. Tabula Medica is not affiliated with any pharmaceutical manufacturer.",
  });
});

router.get("/drug-coupons/search", (req: Request, res: Response) => {
  const drug = (req.query.drug as string || "").toLowerCase().trim();

  if (!drug) {
    return res.status(400).json({ error: "Search query 'drug' parameter is required" });
  }

  const results = DRUG_COUPON_PROGRAMS.filter(
    (p) =>
      p.drugName.toLowerCase().includes(drug) ||
      (p.genericName && p.genericName.toLowerCase().includes(drug)) ||
      p.manufacturer.toLowerCase().includes(drug) ||
      p.category.toLowerCase().includes(drug) ||
      p.description.toLowerCase().includes(drug)
  );

  res.json({
    query: drug,
    results,
    totalResults: results.length,
    disclaimer:
      "Savings amounts and eligibility vary. Always verify current offers directly with the manufacturer or program website.",
  });
});

router.get("/radiology", (_req: Request, res: Response) => {
  res.json({
    provider: {
      name: "RadiologyAssist",
      description:
        "RadiologyAssist.com connects patients with affordable, high-quality imaging centers offering transparent out-of-pocket pricing. Save significantly compared to hospital-based imaging — often 50-80% less.",
      websiteUrl: "https://www.radiologyassist.com",
      highlights: [
        "Transparent, upfront pricing with no surprise bills",
        "Same high-quality equipment as hospital imaging centers",
        "Board-certified radiologists reading all exams",
        "Results typically available within 24-48 hours",
        "No referral required for most exams",
        "Convenient online scheduling",
      ],
    },
    imagingTypes: IMAGING_TYPES,
    savingsTips: [
      "Always ask for cash-pay or self-pay pricing — it's often lower than insurance-negotiated rates.",
      "Compare prices between freestanding imaging centers and hospital-based facilities.",
      "Request an order from your doctor specifying the exact exam needed before shopping for prices.",
      "Check if your insurance plan has an out-of-network exception for significant cost savings.",
      "Ask about package deals if you need multiple imaging studies.",
    ],
    disclaimer:
      "Price ranges are approximate and vary by location, facility, and specific exam ordered. Always confirm pricing directly with the imaging center. Tabula Medica is not affiliated with RadiologyAssist.com.",
  });
});

router.get("/uninsured/rates", (_req: Request, res: Response) => {
  const rates = [
    { cptCode: "99213", description: "Office Visit (Level 3) — Established patient, low complexity MDM", category: "Office Visits", medicareRate: 82.40, discountedRate: 82.40, typicalRetailRate: 250, savingsPercent: 67 },
    { cptCode: "99214", description: "Office Visit (Level 4) — Established patient, moderate complexity MDM", category: "Office Visits", medicareRate: 120.86, discountedRate: 120.86, typicalRetailRate: 375, savingsPercent: 68 },
    { cptCode: "99203", description: "New Patient Visit (Level 3) — Low complexity MDM", category: "Office Visits", medicareRate: 112.47, discountedRate: 112.47, typicalRetailRate: 350, savingsPercent: 68 },
    { cptCode: "99204", description: "New Patient Visit (Level 4) — Moderate complexity MDM", category: "Office Visits", medicareRate: 171.98, discountedRate: 171.98, typicalRetailRate: 500, savingsPercent: 66 },
    { cptCode: "99215", description: "Office Visit (Level 5) — Established patient, high complexity MDM", category: "Office Visits", medicareRate: 161.08, discountedRate: 161.08, typicalRetailRate: 550, savingsPercent: 71 },
    { cptCode: "99385", description: "Annual Physical (18-39) — Comprehensive preventive evaluation", category: "Preventive Care", medicareRate: 149.24, discountedRate: 149.24, typicalRetailRate: 400, savingsPercent: 63 },
    { cptCode: "99386", description: "Annual Physical (40-64) — Comprehensive preventive evaluation", category: "Preventive Care", medicareRate: 168.38, discountedRate: 168.38, typicalRetailRate: 450, savingsPercent: 63 },
    { cptCode: "90471", description: "Immunization Administration — First vaccine injection", category: "Preventive Care", medicareRate: 28.42, discountedRate: 28.42, typicalRetailRate: 40, savingsPercent: 29 },
    { cptCode: "36415", description: "Blood Draw (Venipuncture)", category: "Lab Work", medicareRate: 8.36, discountedRate: 8.36, typicalRetailRate: 35, savingsPercent: 76 },
    { cptCode: "80053", description: "Comprehensive Metabolic Panel (CMP)", category: "Lab Work", medicareRate: 11.47, discountedRate: 11.47, typicalRetailRate: 80, savingsPercent: 86 },
    { cptCode: "85025", description: "Complete Blood Count (CBC) with Differential", category: "Lab Work", medicareRate: 7.77, discountedRate: 7.77, typicalRetailRate: 50, savingsPercent: 84 },
    { cptCode: "83036", description: "Hemoglobin A1C — Glycosylated hemoglobin test", category: "Lab Work", medicareRate: 9.13, discountedRate: 9.13, typicalRetailRate: 60, savingsPercent: 85 },
    { cptCode: "80061", description: "Lipid Panel — Cholesterol, HDL, LDL, Triglycerides", category: "Lab Work", medicareRate: 13.39, discountedRate: 13.39, typicalRetailRate: 75, savingsPercent: 82 },
    { cptCode: "81001", description: "Urinalysis — Automated with microscopy", category: "Lab Work", medicareRate: 3.57, discountedRate: 3.57, typicalRetailRate: 30, savingsPercent: 88 },
    { cptCode: "71046", description: "Chest X-Ray (2 views)", category: "Imaging", medicareRate: 22.94, discountedRate: 22.94, typicalRetailRate: 250, savingsPercent: 91 },
    { cptCode: "73030", description: "Shoulder X-Ray — Complete, minimum 2 views", category: "Imaging", medicareRate: 22.94, discountedRate: 22.94, typicalRetailRate: 200, savingsPercent: 89 },
    { cptCode: "90837", description: "Therapy Session (60 min) — Psychotherapy", category: "Mental Health", medicareRate: 133.12, discountedRate: 133.12, typicalRetailRate: 250, savingsPercent: 47 },
    { cptCode: "90834", description: "Therapy Session (45 min) — Psychotherapy", category: "Mental Health", medicareRate: 100.14, discountedRate: 100.14, typicalRetailRate: 200, savingsPercent: 50 },
    { cptCode: "10060", description: "Drainage of Skin Abscess — Simple or single", category: "Surgery", medicareRate: 108.98, discountedRate: 108.98, typicalRetailRate: 500, savingsPercent: 78 },
    { cptCode: "11102", description: "Skin Biopsy — First lesion, tangential", category: "Surgery", medicareRate: 82.40, discountedRate: 82.40, typicalRetailRate: 350, savingsPercent: 76 },
    { cptCode: "D0120", description: "Periodic Oral Exam — Established patient", category: "Dental", medicareRate: 35.00, discountedRate: 35.00, typicalRetailRate: 80, savingsPercent: 56 },
    { cptCode: "D1110", description: "Adult Dental Cleaning — Prophylaxis", category: "Dental", medicareRate: 75.00, discountedRate: 75.00, typicalRetailRate: 175, savingsPercent: 57 },
    { cptCode: "D0274", description: "Bitewing X-Rays (4 films)", category: "Dental", medicareRate: 45.00, discountedRate: 45.00, typicalRetailRate: 100, savingsPercent: 55 },
  ];

  const categories = [...new Set(rates.map(r => r.category))];

  res.json({
    rates,
    categories,
    totalRates: rates.length,
    disclaimer: "Rates based on 2026 CMS Physician Fee Schedule (conversion factor $32.74). Actual prices may vary by locality. This is not a bill or guarantee of coverage.",
    lastUpdated: "2026-01-01",
    source: "CMS Physician Fee Schedule 2026",
  });
});

router.get("/uninsured/providers", (_req: Request, res: Response) => {
  res.json({
    providers: [
      { id: "prov-1", name: "Community Health Partners", specialty: "Primary Care", type: "FQHC", location: "Multiple Locations", acceptingPatients: true, rating: 4.8, description: "Full-service FQHC offering primary care, behavioral health, and dental on a sliding fee scale. Accepts all patients regardless of insurance or ability to pay." },
      { id: "prov-2", name: "Metro Urgent Care Direct", specialty: "Emergency", type: "Urgent Care", location: "Downtown Medical District", acceptingPatients: true, rating: 4.6, description: "Walk-in urgent care accepting Tabula Direct Access pricing. No appointment needed. Lab and imaging on-site." },
      { id: "prov-3", name: "Wellness Family Medicine", specialty: "Primary Care", type: "DPC", location: "Westside Medical Plaza", acceptingPatients: true, rating: 4.9, description: "Direct Primary Care practice offering unlimited visits, same-day appointments, and wholesale lab pricing for Tabula Direct Access members." },
      { id: "prov-4", name: "Mindful Psychiatry Group", specialty: "Mental Health", type: "Specialty", location: "Behavioral Health Center", acceptingPatients: true, rating: 4.7, description: "Outpatient psychiatry and therapy accepting Medicare-based self-pay rates. Specializing in anxiety, depression, PTSD, and substance use disorders." },
      { id: "prov-5", name: "Bright Smiles Dental", specialty: "Dental", type: "Dental", location: "Midtown Dental Center", acceptingPatients: true, rating: 4.5, description: "General and preventive dentistry at transparent Medicare-based pricing. Cleanings, exams, fillings, and emergency dental care." },
    ],
    totalProviders: 5,
    programInfo: {
      name: "Tabula Direct Access",
      tagline: "Quality care at Medicare-based prices",
      description: "Access healthcare at transparent, published rates based on the 2026 Medicare Physician Fee Schedule. No insurance required. No surprise bills.",
      benefits: [
        "Transparent pricing based on 2026 Medicare rates",
        "No surprise bills — No Surprises Act protection",
        "HSA/FSA eligible under 2026 DPC safe harbor rules",
        "Sliding scale available through HRSA-funded centers",
        "VA Community Care accepted ($0 to veteran)",
      ],
      eligibility: "Open to all patients regardless of insurance status, immigration status, or ability to pay.",
    },
  });
});

export default router;
