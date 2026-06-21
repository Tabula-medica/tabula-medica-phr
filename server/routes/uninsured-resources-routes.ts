import { Router } from "express";

const router = Router();

interface MedicareRate {
  cptCode: string;
  description: string;
  category: string;
  medicareRate: number;
  typicalUninsuredRate: number;
  savings: string;
  year: number;
}

const medicareRates2026: MedicareRate[] = [
  { cptCode: "99211", description: "Office Visit - Minimal (Nurse Visit)", category: "Office Visits", medicareRate: 29, typicalUninsuredRate: 80, savings: "64%", year: 2026 },
  { cptCode: "99212", description: "Office Visit - Straightforward", category: "Office Visits", medicareRate: 59, typicalUninsuredRate: 160, savings: "63%", year: 2026 },
  { cptCode: "99213", description: "Office Visit - Low Complexity", category: "Office Visits", medicareRate: 95, typicalUninsuredRate: 260, savings: "63%", year: 2026 },
  { cptCode: "99214", description: "Office Visit - Moderate Complexity", category: "Office Visits", medicareRate: 134, typicalUninsuredRate: 365, savings: "63%", year: 2026 },
  { cptCode: "99215", description: "Office Visit - High Complexity", category: "Office Visits", medicareRate: 182, typicalUninsuredRate: 520, savings: "65%", year: 2026 },
  { cptCode: "99242", description: "Consultation - Straightforward", category: "Office Visits", medicareRate: 110, typicalUninsuredRate: 300, savings: "63%", year: 2026 },
  { cptCode: "99243", description: "Consultation - Low Complexity", category: "Office Visits", medicareRate: 155, typicalUninsuredRate: 420, savings: "63%", year: 2026 },
  { cptCode: "99244", description: "Consultation - Moderate Complexity", category: "Office Visits", medicareRate: 220, typicalUninsuredRate: 600, savings: "63%", year: 2026 },
  { cptCode: "80053", description: "Comprehensive Metabolic Panel", category: "Laboratory", medicareRate: 15, typicalUninsuredRate: 125, savings: "88%", year: 2026 },
  { cptCode: "85025", description: "Complete Blood Count (CBC)", category: "Laboratory", medicareRate: 11, typicalUninsuredRate: 95, savings: "88%", year: 2026 },
  { cptCode: "80061", description: "Lipid Panel", category: "Laboratory", medicareRate: 19, typicalUninsuredRate: 105, savings: "82%", year: 2026 },
  { cptCode: "84443", description: "Thyroid Stimulating Hormone (TSH)", category: "Laboratory", medicareRate: 24, typicalUninsuredRate: 155, savings: "85%", year: 2026 },
  { cptCode: "81001", description: "Urinalysis with Microscopy", category: "Laboratory", medicareRate: 5, typicalUninsuredRate: 48, savings: "90%", year: 2026 },
  { cptCode: "36415", description: "Venipuncture (Blood Draw)", category: "Laboratory", medicareRate: 3, typicalUninsuredRate: 28, savings: "89%", year: 2026 },
  { cptCode: "83036", description: "Hemoglobin A1c (HbA1c)", category: "Laboratory", medicareRate: 13, typicalUninsuredRate: 90, savings: "86%", year: 2026 },
  { cptCode: "87086", description: "Urine Culture", category: "Laboratory", medicareRate: 10, typicalUninsuredRate: 75, savings: "87%", year: 2026 },
  { cptCode: "82947", description: "Glucose, Blood", category: "Laboratory", medicareRate: 6, typicalUninsuredRate: 35, savings: "83%", year: 2026 },
  { cptCode: "82306", description: "Vitamin D, 25-Hydroxy", category: "Laboratory", medicareRate: 30, typicalUninsuredRate: 180, savings: "83%", year: 2026 },
  { cptCode: "71046", description: "Chest X-Ray (2 views)", category: "Imaging", medicareRate: 32, typicalUninsuredRate: 385, savings: "92%", year: 2026 },
  { cptCode: "74177", description: "CT Abdomen/Pelvis with Contrast", category: "Imaging", medicareRate: 245, typicalUninsuredRate: 2600, savings: "91%", year: 2026 },
  { cptCode: "70553", description: "MRI Brain with/without Contrast", category: "Imaging", medicareRate: 330, typicalUninsuredRate: 3100, savings: "89%", year: 2026 },
  { cptCode: "76856", description: "Ultrasound Pelvic", category: "Imaging", medicareRate: 101, typicalUninsuredRate: 725, savings: "86%", year: 2026 },
  { cptCode: "77067", description: "Screening Mammography", category: "Imaging", medicareRate: 143, typicalUninsuredRate: 520, savings: "72%", year: 2026 },
  { cptCode: "73721", description: "MRI Knee without Contrast", category: "Imaging", medicareRate: 258, typicalUninsuredRate: 2600, savings: "90%", year: 2026 },
  { cptCode: "72148", description: "MRI Lumbar Spine without Contrast", category: "Imaging", medicareRate: 268, typicalUninsuredRate: 2700, savings: "90%", year: 2026 },
  { cptCode: "74178", description: "CT Abdomen/Pelvis without then with Contrast", category: "Imaging", medicareRate: 290, typicalUninsuredRate: 3200, savings: "91%", year: 2026 },
  { cptCode: "70551", description: "MRI Brain without Contrast", category: "Imaging", medicareRate: 245, typicalUninsuredRate: 2500, savings: "90%", year: 2026 },
  { cptCode: "76700", description: "Ultrasound Abdomen Complete", category: "Imaging", medicareRate: 98, typicalUninsuredRate: 650, savings: "85%", year: 2026 },
  { cptCode: "93000", description: "Electrocardiogram (ECG/EKG) 12-Lead", category: "Cardiology", medicareRate: 17, typicalUninsuredRate: 150, savings: "89%", year: 2026 },
  { cptCode: "93306", description: "Echocardiogram Complete", category: "Cardiology", medicareRate: 195, typicalUninsuredRate: 1800, savings: "89%", year: 2026 },
  { cptCode: "93798", description: "Cardiac Rehab (per session)", category: "Cardiology", medicareRate: 85, typicalUninsuredRate: 350, savings: "76%", year: 2026 },
  { cptCode: "93015", description: "Cardiac Stress Test", category: "Cardiology", medicareRate: 120, typicalUninsuredRate: 800, savings: "85%", year: 2026 },
  { cptCode: "99381", description: "Preventive Visit - New Patient (Infant)", category: "Preventive Care", medicareRate: 119, typicalUninsuredRate: 365, savings: "67%", year: 2026 },
  { cptCode: "99395", description: "Preventive Visit - Established (18-39)", category: "Preventive Care", medicareRate: 145, typicalUninsuredRate: 415, savings: "65%", year: 2026 },
  { cptCode: "99396", description: "Preventive Visit - Established (40-64)", category: "Preventive Care", medicareRate: 160, typicalUninsuredRate: 470, savings: "66%", year: 2026 },
  { cptCode: "99397", description: "Preventive Visit - Established (65+)", category: "Preventive Care", medicareRate: 172, typicalUninsuredRate: 500, savings: "66%", year: 2026 },
  { cptCode: "99385", description: "Preventive Visit - New Patient (18-39)", category: "Preventive Care", medicareRate: 165, typicalUninsuredRate: 450, savings: "63%", year: 2026 },
  { cptCode: "10060", description: "Incision & Drainage of Abscess", category: "Procedures", medicareRate: 147, typicalUninsuredRate: 625, savings: "76%", year: 2026 },
  { cptCode: "11102", description: "Skin Biopsy (Tangential)", category: "Procedures", medicareRate: 92, typicalUninsuredRate: 415, savings: "78%", year: 2026 },
  { cptCode: "17000", description: "Destruction of Skin Lesion (First)", category: "Procedures", medicareRate: 70, typicalUninsuredRate: 310, savings: "77%", year: 2026 },
  { cptCode: "90471", description: "Immunization Administration", category: "Procedures", medicareRate: 18, typicalUninsuredRate: 55, savings: "67%", year: 2026 },
  { cptCode: "29881", description: "Knee Arthroscopy with Meniscectomy", category: "Procedures", medicareRate: 680, typicalUninsuredRate: 5500, savings: "88%", year: 2026 },
  { cptCode: "27447", description: "Total Knee Replacement", category: "Procedures", medicareRate: 1420, typicalUninsuredRate: 30000, savings: "95%", year: 2026 },
  { cptCode: "43239", description: "Upper GI Endoscopy with Biopsy", category: "Procedures", medicareRate: 280, typicalUninsuredRate: 2500, savings: "89%", year: 2026 },
  { cptCode: "45380", description: "Colonoscopy with Biopsy", category: "Procedures", medicareRate: 345, typicalUninsuredRate: 3200, savings: "89%", year: 2026 },
  { cptCode: "90834", description: "Psychotherapy (45 minutes)", category: "Mental Health", medicareRate: 95, typicalUninsuredRate: 250, savings: "62%", year: 2026 },
  { cptCode: "90837", description: "Psychotherapy (60 minutes)", category: "Mental Health", medicareRate: 130, typicalUninsuredRate: 300, savings: "57%", year: 2026 },
  { cptCode: "90847", description: "Family Therapy (with patient)", category: "Mental Health", medicareRate: 115, typicalUninsuredRate: 280, savings: "59%", year: 2026 },
  { cptCode: "96372", description: "Therapeutic Injection (IM/SubQ)", category: "Procedures", medicareRate: 22, typicalUninsuredRate: 100, savings: "78%", year: 2026 },
  { cptCode: "99283", description: "ER Visit - Moderate Severity", category: "Emergency", medicareRate: 159, typicalUninsuredRate: 1550, savings: "90%", year: 2026 },
  { cptCode: "99284", description: "ER Visit - High Severity", category: "Emergency", medicareRate: 282, typicalUninsuredRate: 3100, savings: "91%", year: 2026 },
  { cptCode: "99285", description: "ER Visit - Critical", category: "Emergency", medicareRate: 438, typicalUninsuredRate: 5200, savings: "92%", year: 2026 },
  { cptCode: "97110", description: "Physical Therapy - Therapeutic Exercise", category: "Rehabilitation", medicareRate: 35, typicalUninsuredRate: 120, savings: "71%", year: 2026 },
  { cptCode: "97140", description: "Physical Therapy - Manual Therapy", category: "Rehabilitation", medicareRate: 32, typicalUninsuredRate: 110, savings: "71%", year: 2026 },
  { cptCode: "97530", description: "Occupational Therapy - Activities", category: "Rehabilitation", medicareRate: 38, typicalUninsuredRate: 130, savings: "71%", year: 2026 },
  { cptCode: "92014", description: "Eye Exam - Established Patient (Comprehensive)", category: "Vision", medicareRate: 105, typicalUninsuredRate: 300, savings: "65%", year: 2026 },
  { cptCode: "92004", description: "Eye Exam - New Patient (Comprehensive)", category: "Vision", medicareRate: 145, typicalUninsuredRate: 400, savings: "64%", year: 2026 },
  { cptCode: "D0120", description: "Dental Periodic Oral Evaluation", category: "Dental", medicareRate: 42, typicalUninsuredRate: 65, savings: "35%", year: 2026 },
  { cptCode: "D1110", description: "Dental Prophylaxis (Cleaning) - Adult", category: "Dental", medicareRate: 80, typicalUninsuredRate: 130, savings: "38%", year: 2026 },
  { cptCode: "D0274", description: "Dental Bitewing X-Rays (4 films)", category: "Dental", medicareRate: 48, typicalUninsuredRate: 85, savings: "44%", year: 2026 },
];

interface ImagingService {
  id: string;
  name: string;
  radiologyAssistPrice: string;
  typicalHospitalPrice: string;
  savings: string;
}

const imagingServices: ImagingService[] = [
  { id: "mri-brain", name: "MRI Brain", radiologyAssistPrice: "$250 - $500", typicalHospitalPrice: "$2,500 - $5,000+", savings: "Up to 90%" },
  { id: "mri-knee", name: "MRI Knee/Joint", radiologyAssistPrice: "$250 - $450", typicalHospitalPrice: "$2,000 - $4,500+", savings: "Up to 89%" },
  { id: "mri-spine", name: "MRI Spine", radiologyAssistPrice: "$300 - $550", typicalHospitalPrice: "$2,500 - $5,500+", savings: "Up to 90%" },
  { id: "ct-abdomen", name: "CT Abdomen/Pelvis", radiologyAssistPrice: "$200 - $450", typicalHospitalPrice: "$2,000 - $4,000+", savings: "Up to 89%" },
  { id: "ct-head", name: "CT Head/Brain", radiologyAssistPrice: "$150 - $400", typicalHospitalPrice: "$1,500 - $3,500+", savings: "Up to 89%" },
  { id: "xray-chest", name: "Chest X-Ray", radiologyAssistPrice: "$40 - $100", typicalHospitalPrice: "$300 - $1,000+", savings: "Up to 90%" },
  { id: "ultrasound-abdomen", name: "Ultrasound Abdomen", radiologyAssistPrice: "$100 - $250", typicalHospitalPrice: "$500 - $1,500+", savings: "Up to 83%" },
  { id: "mammogram", name: "Mammogram", radiologyAssistPrice: "$100 - $250", typicalHospitalPrice: "$400 - $1,200+", savings: "Up to 79%" },
  { id: "dexa-scan", name: "DEXA Bone Density Scan", radiologyAssistPrice: "$75 - $200", typicalHospitalPrice: "$300 - $900+", savings: "Up to 78%" },
];

interface CommunityResource {
  id: string;
  name: string;
  description: string;
  url: string;
  category: string;
}

const communityResources: CommunityResource[] = [
  { id: "hrsa", name: "HRSA Health Centers", description: "Federally Qualified Health Centers (FQHCs) provide care on a sliding fee scale based on your ability to pay. Over 1,400 centers nationwide.", url: "https://findahealthcenter.hrsa.gov/", category: "Community Health Centers" },
  { id: "nafcc", name: "National Association of Free & Charitable Clinics", description: "Find free and charitable clinics in your area that provide healthcare at no cost.", url: "https://www.nafcclinics.org/find-clinic", category: "Free Clinics" },
  { id: "needymeds", name: "NeedyMeds", description: "Comprehensive database of patient assistance programs, free/low-cost clinics, and drug discount programs.", url: "https://www.needymeds.org/", category: "Assistance Programs" },
  { id: "rxassist", name: "RxAssist", description: "Patient assistance program center offering a comprehensive database of pharmaceutical manufacturer programs.", url: "https://www.rxassist.org/", category: "Medication Assistance" },
  { id: "340b", name: "340B Drug Pricing Program", description: "Federal program requiring drug manufacturers to provide outpatient drugs at reduced prices to eligible healthcare organizations.", url: "https://www.hrsa.gov/opa", category: "Pharmacy Programs" },
  { id: "goodrx", name: "GoodRx", description: "Compare prescription drug prices and find coupons at pharmacies near you.", url: "https://www.goodrx.com/", category: "Medication Savings" },
  { id: "rxsaver", name: "RxSaver", description: "Free prescription discount card and price comparison tool for medications.", url: "https://www.rxsaver.com/", category: "Medication Savings" },
  { id: "hillburton", name: "Hill-Burton Free Care Program", description: "Certain hospitals and healthcare facilities must provide free or reduced-cost care to patients who cannot afford to pay.", url: "https://www.hrsa.gov/get-health-care/affordable/hill-burton", category: "Hospital Programs" },
  { id: "medicaid", name: "Medicaid/CHIP", description: "Check eligibility for Medicaid or the Children's Health Insurance Program for low-cost or free health coverage.", url: "https://www.healthcare.gov/medicaid-chip/", category: "Government Programs" },
  { id: "marketplace", name: "Healthcare.gov Marketplace", description: "Find health insurance plans, check for premium subsidies, and enroll in coverage during open enrollment.", url: "https://www.healthcare.gov/", category: "Government Programs" },
  { id: "aca-navigator", name: "ACA Navigator Programs", description: "Free in-person help applying for health insurance through the Marketplace.", url: "https://localhelp.healthcare.gov/", category: "Government Programs" },
  { id: "sliding-scale", name: "Sliding Scale Providers", description: "Many private practitioners offer sliding scale fees based on income. Ask providers about reduced-rate options.", url: "https://www.psychologytoday.com/us/therapists/sliding-scale", category: "Sliding Scale" },
];

interface DiscountProvider {
  id: string;
  name: string;
  type: string;
  specialties: string[];
  location: string;
  state: string;
  acceptsMedicareRates: boolean;
  discountPercent: number;
  phone: string;
  website: string;
  acceptingNewPatients: boolean;
}

const discountProviders: DiscountProvider[] = [
  { id: "dp-001", name: "CareFirst Community Clinic", type: "Primary Care", specialties: ["Family Medicine", "Internal Medicine", "Pediatrics"], location: "Austin, TX", state: "TX", acceptsMedicareRates: true, discountPercent: 60, phone: "(512) 555-0101", website: "https://carefirstcommunity.org", acceptingNewPatients: true },
  { id: "dp-002", name: "Metro Imaging Center", type: "Imaging", specialties: ["MRI", "CT Scan", "X-Ray", "Ultrasound"], location: "Houston, TX", state: "TX", acceptsMedicareRates: true, discountPercent: 85, phone: "(713) 555-0202", website: "https://metroimaging.com", acceptingNewPatients: true },
  { id: "dp-003", name: "Valley Lab Services", type: "Laboratory", specialties: ["Blood Work", "Pathology", "Urinalysis"], location: "Phoenix, AZ", state: "AZ", acceptsMedicareRates: true, discountPercent: 88, phone: "(602) 555-0303", website: "https://valleylabservices.com", acceptingNewPatients: true },
  { id: "dp-004", name: "Sunrise Mental Health Associates", type: "Mental Health", specialties: ["Psychiatry", "Psychotherapy", "Family Counseling"], location: "Denver, CO", state: "CO", acceptsMedicareRates: true, discountPercent: 55, phone: "(303) 555-0404", website: "https://sunrisemh.com", acceptingNewPatients: true },
  { id: "dp-005", name: "Pacific Orthopedics Group", type: "Orthopedics", specialties: ["Joint Replacement", "Sports Medicine", "Spine Surgery"], location: "Los Angeles, CA", state: "CA", acceptsMedicareRates: true, discountPercent: 75, phone: "(310) 555-0505", website: "https://pacificortho.com", acceptingNewPatients: true },
  { id: "dp-006", name: "Heartland Cardiology Center", type: "Cardiology", specialties: ["ECG", "Echocardiogram", "Stress Testing", "Cardiac Rehab"], location: "Chicago, IL", state: "IL", acceptsMedicareRates: true, discountPercent: 70, phone: "(312) 555-0606", website: "https://heartlandcardio.com", acceptingNewPatients: true },
  { id: "dp-007", name: "Clearview Eye Care", type: "Vision", specialties: ["Comprehensive Eye Exams", "Glaucoma", "Retinal Screening"], location: "Atlanta, GA", state: "GA", acceptsMedicareRates: true, discountPercent: 60, phone: "(404) 555-0707", website: "https://clearvieweye.com", acceptingNewPatients: true },
  { id: "dp-008", name: "Restore Physical Therapy", type: "Rehabilitation", specialties: ["Physical Therapy", "Occupational Therapy", "Sports Rehab"], location: "Miami, FL", state: "FL", acceptsMedicareRates: true, discountPercent: 65, phone: "(305) 555-0808", website: "https://restorept.com", acceptingNewPatients: false },
];

router.get("/medicare-rates", (_req, res) => {
  res.json({ rates: medicareRates2026, categories: Array.from(new Set(medicareRates2026.map(r => r.category))), year: 2026 });
});

router.get("/medicare-rates/search", (req, res) => {
  const query = (req.query.q as string || "").toLowerCase();
  const category = req.query.category as string || "";

  let filtered = medicareRates2026;
  if (query) {
    filtered = filtered.filter(r =>
      r.cptCode.toLowerCase().includes(query) ||
      r.description.toLowerCase().includes(query)
    );
  }
  if (category) {
    filtered = filtered.filter(r => r.category === category);
  }

  res.json({ rates: filtered, total: filtered.length });
});

router.get("/imaging-services", (_req, res) => {
  res.json({ services: imagingServices });
});

router.get("/community-resources", (_req, res) => {
  res.json({ resources: communityResources, categories: Array.from(new Set(communityResources.map(r => r.category))) });
});

router.get("/discount-providers", (req, res) => {
  const state = (req.query.state as string || "").toUpperCase();
  const type = req.query.type as string || "";
  const specialty = (req.query.specialty as string || "").toLowerCase();

  let filtered = discountProviders;
  if (state) {
    filtered = filtered.filter(p => p.state === state);
  }
  if (type) {
    filtered = filtered.filter(p => p.type === type);
  }
  if (specialty) {
    filtered = filtered.filter(p => p.specialties.some(s => s.toLowerCase().includes(specialty)));
  }

  const providerTypes = Array.from(new Set(discountProviders.map(p => p.type)));
  const states = Array.from(new Set(discountProviders.map(p => p.state))).sort();

  res.json({ providers: filtered, providerTypes, states });
});

router.post("/patient-signup", (req, res) => {
  const { firstName, lastName, email, phone, zipCode } = req.body;
  if (!firstName || !lastName || !email) {
    return res.status(400).json({ error: "First name, last name, and email are required." });
  }

  res.json({
    success: true,
    memberId: `TM-${Date.now().toString(36).toUpperCase()}`,
    message: "Welcome to the Tabula Medica Discount Platform! Your membership card will be available in your account within 24 hours.",
    benefits: [
      "Access to Medicare-rate pricing at participating providers",
      "No premiums or monthly fees",
      "No deductibles — pay the listed rate at time of service",
      "Searchable provider directory with transparent pricing",
      "Digital membership card accepted at all participating providers",
    ],
  });
});

router.post("/provider-enrollment", (req, res) => {
  const { providerName, npi, specialty, email, phone, address, state } = req.body;
  if (!providerName || !npi || !email) {
    return res.status(400).json({ error: "Provider name, NPI, and email are required." });
  }

  res.json({
    success: true,
    enrollmentId: `PE-${Date.now().toString(36).toUpperCase()}`,
    message: "Thank you for joining the Tabula Medica Provider Network. Our team will review your application and contact you within 3-5 business days.",
    nextSteps: [
      "Application review by our provider relations team",
      "Credential verification via NPI registry",
      "Rate schedule confirmation based on 2026 CMS Medicare Fee Schedule",
      "Digital agreement and onboarding",
      "Listing in our patient-facing provider directory",
    ],
  });
});

router.get("/rate-calculator", (req, res) => {
  const cptCodes = (req.query.codes as string || "").split(",").filter(Boolean);
  if (cptCodes.length === 0) {
    return res.json({ items: [], totalMedicare: 0, totalUninsured: 0, totalSavings: 0 });
  }

  const items = cptCodes.map(code => {
    const rate = medicareRates2026.find(r => r.cptCode === code.trim());
    if (!rate) return null;
    return {
      ...rate,
      savingsAmount: rate.typicalUninsuredRate - rate.medicareRate,
    };
  }).filter(Boolean);

  const totalMedicare = items.reduce((sum, item) => sum + (item?.medicareRate || 0), 0);
  const totalUninsured = items.reduce((sum, item) => sum + (item?.typicalUninsuredRate || 0), 0);

  res.json({
    items,
    totalMedicare,
    totalUninsured,
    totalSavings: totalUninsured - totalMedicare,
    savingsPercent: totalUninsured > 0 ? Math.round(((totalUninsured - totalMedicare) / totalUninsured) * 100) : 0,
  });
});

export default router;
