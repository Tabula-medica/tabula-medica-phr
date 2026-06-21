import { Router, type Request } from "express";
import { randomUUID } from "crypto";
import { storage } from "../storage";

const router = Router();

interface Bill {
  id: string;
  type: "Medical Bill" | "EOB" | "Pharmacy" | "Lab" | "Imaging";
  provider: string;
  amount: number;
  date: string;
  status: "Pending Review" | "Processed" | "Disputed" | "Paid";
  imageUrl: string;
  notes: string;
  createdAt: string;
}

interface PlanEnrollment {
  enrolled: boolean;
  enrolledAt: string | null;
  planFee: number;
  planName: string;
}

interface ElectronicEobEnrollment {
  enrolled: boolean;
  enrolledAt: string | null;
  medicareBeneficiaryId: string | null;
}

interface MedicareRate {
  cptCode: string;
  description: string;
  category: string;
  medicareRate: number;
  typicalUninsuredRate: number;
  insuranceNegotiatedRate: number;
  savings: string;
}

const bills: Bill[] = [];

let planEnrollment: PlanEnrollment = {
  enrolled: false,
  enrolledAt: null,
  planFee: 100,
  planName: "Tabula Medica Uninsured Plan",
};

let electronicEobEnrollment: ElectronicEobEnrollment = {
  enrolled: false,
  enrolledAt: null,
  medicareBeneficiaryId: null,
};

const medicareRates: MedicareRate[] = [
  { cptCode: "99211", description: "Office Visit - Minimal (Nurse Visit)", category: "Office Visits", medicareRate: 28, typicalUninsuredRate: 75, insuranceNegotiatedRate: 45, savings: "63%" },
  { cptCode: "99212", description: "Office Visit - Straightforward", category: "Office Visits", medicareRate: 57, typicalUninsuredRate: 150, insuranceNegotiatedRate: 95, savings: "62%" },
  { cptCode: "99213", description: "Office Visit - Low Complexity", category: "Office Visits", medicareRate: 92, typicalUninsuredRate: 250, insuranceNegotiatedRate: 160, savings: "63%" },
  { cptCode: "99214", description: "Office Visit - Moderate Complexity", category: "Office Visits", medicareRate: 130, typicalUninsuredRate: 350, insuranceNegotiatedRate: 220, savings: "63%" },
  { cptCode: "99215", description: "Office Visit - High Complexity", category: "Office Visits", medicareRate: 176, typicalUninsuredRate: 500, insuranceNegotiatedRate: 310, savings: "65%" },
  { cptCode: "80053", description: "Comprehensive Metabolic Panel", category: "Laboratory", medicareRate: 14, typicalUninsuredRate: 120, insuranceNegotiatedRate: 35, savings: "88%" },
  { cptCode: "85025", description: "Complete Blood Count (CBC)", category: "Laboratory", medicareRate: 11, typicalUninsuredRate: 90, insuranceNegotiatedRate: 28, savings: "88%" },
  { cptCode: "80061", description: "Lipid Panel", category: "Laboratory", medicareRate: 18, typicalUninsuredRate: 100, insuranceNegotiatedRate: 32, savings: "82%" },
  { cptCode: "84443", description: "Thyroid Stimulating Hormone (TSH)", category: "Laboratory", medicareRate: 23, typicalUninsuredRate: 150, insuranceNegotiatedRate: 45, savings: "85%" },
  { cptCode: "81001", description: "Urinalysis with Microscopy", category: "Laboratory", medicareRate: 5, typicalUninsuredRate: 45, insuranceNegotiatedRate: 15, savings: "89%" },
  { cptCode: "36415", description: "Venipuncture (Blood Draw)", category: "Laboratory", medicareRate: 3, typicalUninsuredRate: 25, insuranceNegotiatedRate: 10, savings: "88%" },
  { cptCode: "71046", description: "Chest X-Ray (2 views)", category: "Imaging", medicareRate: 31, typicalUninsuredRate: 370, insuranceNegotiatedRate: 120, savings: "92%" },
  { cptCode: "74177", description: "CT Abdomen/Pelvis with Contrast", category: "Imaging", medicareRate: 238, typicalUninsuredRate: 2500, insuranceNegotiatedRate: 800, savings: "90%" },
  { cptCode: "70553", description: "MRI Brain with/without Contrast", category: "Imaging", medicareRate: 320, typicalUninsuredRate: 3000, insuranceNegotiatedRate: 950, savings: "89%" },
  { cptCode: "76856", description: "Ultrasound Pelvic", category: "Imaging", medicareRate: 98, typicalUninsuredRate: 700, insuranceNegotiatedRate: 250, savings: "86%" },
  { cptCode: "77067", description: "Screening Mammography", category: "Imaging", medicareRate: 139, typicalUninsuredRate: 500, insuranceNegotiatedRate: 200, savings: "72%" },
  { cptCode: "73721", description: "MRI Knee without Contrast", category: "Imaging", medicareRate: 250, typicalUninsuredRate: 2500, insuranceNegotiatedRate: 780, savings: "90%" },
  { cptCode: "99381", description: "Preventive Visit - New Patient (Infant)", category: "Preventive Care", medicareRate: 115, typicalUninsuredRate: 350, insuranceNegotiatedRate: 180, savings: "67%" },
  { cptCode: "99395", description: "Preventive Visit - Established (18-39)", category: "Preventive Care", medicareRate: 140, typicalUninsuredRate: 400, insuranceNegotiatedRate: 200, savings: "65%" },
  { cptCode: "99396", description: "Preventive Visit - Established (40-64)", category: "Preventive Care", medicareRate: 155, typicalUninsuredRate: 450, insuranceNegotiatedRate: 225, savings: "66%" },
  { cptCode: "10060", description: "Incision & Drainage of Abscess", category: "Procedures", medicareRate: 142, typicalUninsuredRate: 600, insuranceNegotiatedRate: 280, savings: "76%" },
  { cptCode: "11102", description: "Skin Biopsy (Tangential)", category: "Procedures", medicareRate: 89, typicalUninsuredRate: 400, insuranceNegotiatedRate: 180, savings: "78%" },
  { cptCode: "17000", description: "Destruction of Skin Lesion (First)", category: "Procedures", medicareRate: 68, typicalUninsuredRate: 300, insuranceNegotiatedRate: 140, savings: "77%" },
  { cptCode: "90471", description: "Immunization Administration", category: "Procedures", medicareRate: 17, typicalUninsuredRate: 50, insuranceNegotiatedRate: 30, savings: "66%" },
  { cptCode: "99283", description: "ER Visit - Moderate Severity", category: "Emergency", medicareRate: 154, typicalUninsuredRate: 1500, insuranceNegotiatedRate: 600, savings: "90%" },
  { cptCode: "99284", description: "ER Visit - High Severity", category: "Emergency", medicareRate: 273, typicalUninsuredRate: 3000, insuranceNegotiatedRate: 1100, savings: "91%" },
  { cptCode: "99285", description: "ER Visit - Critical", category: "Emergency", medicareRate: 424, typicalUninsuredRate: 5000, insuranceNegotiatedRate: 1800, savings: "92%" },
  { cptCode: "27447", description: "Total Knee Replacement", category: "Surgery", medicareRate: 1450, typicalUninsuredRate: 50000, insuranceNegotiatedRate: 18000, savings: "97%" },
  { cptCode: "27130", description: "Total Hip Replacement", category: "Surgery", medicareRate: 1500, typicalUninsuredRate: 55000, insuranceNegotiatedRate: 20000, savings: "97%" },
  { cptCode: "43239", description: "Upper GI Endoscopy with Biopsy", category: "Procedures", medicareRate: 265, typicalUninsuredRate: 3500, insuranceNegotiatedRate: 1200, savings: "92%" },
  { cptCode: "45380", description: "Colonoscopy with Biopsy", category: "Procedures", medicareRate: 350, typicalUninsuredRate: 4000, insuranceNegotiatedRate: 1500, savings: "91%" },
  { cptCode: "93000", description: "Electrocardiogram (ECG/EKG)", category: "Cardiology", medicareRate: 17, typicalUninsuredRate: 200, insuranceNegotiatedRate: 75, savings: "92%" },
  { cptCode: "93306", description: "Echocardiogram Complete", category: "Cardiology", medicareRate: 188, typicalUninsuredRate: 2000, insuranceNegotiatedRate: 650, savings: "91%" },
  { cptCode: "92014", description: "Comprehensive Eye Exam (Established)", category: "Ophthalmology", medicareRate: 105, typicalUninsuredRate: 300, insuranceNegotiatedRate: 180, savings: "65%" },
  { cptCode: "97110", description: "Physical Therapy - Therapeutic Exercises", category: "Physical Therapy", medicareRate: 33, typicalUninsuredRate: 150, insuranceNegotiatedRate: 75, savings: "78%" },
];

router.get("/bills", (_req, res) => {
  res.json({ bills });
});

router.get("/bills/:id", (req, res) => {
  const bill = bills.find((b) => b.id === req.params.id);
  if (!bill) return res.status(404).json({ error: "Bill not found" });
  res.json({ bill });
});

router.post("/bills", (req, res) => {
  const bill: Bill = {
    id: randomUUID(),
    type: req.body.type || "Medical Bill",
    provider: req.body.provider || "",
    amount: req.body.amount || 0,
    date: req.body.date || new Date().toISOString().split("T")[0],
    status: req.body.status || "Pending Review",
    imageUrl: req.body.imageUrl || "",
    notes: req.body.notes || "",
    createdAt: new Date().toISOString(),
  };
  bills.push(bill);
  res.status(201).json({ bill });
});

router.patch("/bills/:id", (req, res) => {
  const idx = bills.findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Bill not found" });
  const allowedBillFields: (keyof Bill)[] = ["type", "provider", "amount", "date", "status", "imageUrl", "notes"];
  for (const field of allowedBillFields) {
    if (req.body[field] !== undefined) {
      bills[idx][field] = req.body[field] as never;
    }
  }
  res.json({ bill: bills[idx] });
});

router.delete("/bills/:id", (req, res) => {
  const idx = bills.findIndex((b) => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Bill not found" });
  bills.splice(idx, 1);
  res.json({ success: true });
});

router.get("/plan", (_req, res) => {
  res.json({
    plan: {
      name: planEnrollment.planName,
      fee: planEnrollment.planFee,
      description: "No middlemen, no actuaries, no adjusters. Pay Medicare rates directly at time of service.",
      features: [
        "Pay $100/month flat plan fee",
        "Access Medicare rates for all CPT-coded services",
        "Pay at time of service - no surprise bills",
        "No deductibles, no co-insurance, no claim denials",
        "Works at any provider who accepts Medicare rates",
        "Average savings of 60-90% compared to uninsured prices",
      ],
      howItWorks: [
        { step: 1, title: "Enroll", description: "Sign up for $100/month. Cancel anytime." },
        { step: 2, title: "Find a Provider", description: "Use our directory or visit any provider who accepts Medicare rates." },
        { step: 3, title: "Show Your Card", description: "Present your Tabula Medica plan card at the time of service." },
        { step: 4, title: "Pay Medicare Rate", description: "Pay the Medicare-approved amount directly. No middlemen." },
      ],
    },
    enrollment: {
      enrolled: planEnrollment.enrolled,
      enrolledAt: planEnrollment.enrolledAt,
    },
  });
});

router.post("/plan/enroll", (_req, res) => {
  if (planEnrollment.enrolled) {
    return res.status(400).json({ error: "Already enrolled in the Tabula Medica Uninsured Plan." });
  }
  planEnrollment.enrolled = true;
  planEnrollment.enrolledAt = new Date().toISOString();
  res.json({
    success: true,
    message: "Successfully enrolled in the Tabula Medica Uninsured Plan.",
    enrollment: {
      enrolled: planEnrollment.enrolled,
      enrolledAt: planEnrollment.enrolledAt,
      planFee: planEnrollment.planFee,
    },
  });
});

router.get("/plan/rates", (req, res) => {
  const query = (req.query.q as string || "").toLowerCase();
  const category = req.query.category as string || "";

  let filtered = medicareRates;
  if (query) {
    filtered = filtered.filter(
      (r) =>
        r.cptCode.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query)
    );
  }
  if (category) {
    filtered = filtered.filter((r) => r.category === category);
  }

  const categories = Array.from(new Set(medicareRates.map((r) => r.category)));
  res.json({ rates: filtered, total: filtered.length, categories });
});

router.get("/electronic-eob/status", (_req, res) => {
  res.json({
    enrolled: electronicEobEnrollment.enrolled,
    enrolledAt: electronicEobEnrollment.enrolledAt,
    medicareBeneficiaryId: electronicEobEnrollment.medicareBeneficiaryId,
    benefits: [
      "Save paper and reduce clutter",
      "Instant access to your EOBs online",
      "Searchable and organized by date",
      "Never lose a document again",
      "Secure and HIPAA-compliant storage",
      "Easy sharing with your healthcare team",
    ],
  });
});

router.post("/electronic-eob/enroll", (req, res) => {
  if (electronicEobEnrollment.enrolled) {
    return res.status(400).json({ error: "Already enrolled in electronic EOBs." });
  }
  const medicareBeneficiaryId = req.body.medicareBeneficiaryId;
  if (!medicareBeneficiaryId) {
    return res.status(400).json({ error: "Medicare Beneficiary ID is required." });
  }
  electronicEobEnrollment.enrolled = true;
  electronicEobEnrollment.enrolledAt = new Date().toISOString();
  electronicEobEnrollment.medicareBeneficiaryId = medicareBeneficiaryId;
  res.json({
    success: true,
    message: "Successfully enrolled in electronic Medicare EOBs.",
    enrollment: {
      enrolled: electronicEobEnrollment.enrolled,
      enrolledAt: electronicEobEnrollment.enrolledAt,
    },
  });
});

const MAX_DIAGNOSIS_CODES = 12;
const MAX_LINE_ITEMS = 6;

interface ClaimLineItem {
  id: string;
  dateOfService: string;
  placeOfService: string;
  cptCode: string;
  cptDescription: string;
  modifiers: string[];
  diagnosisPointers: string[];
  charges: number;
  units: number;
}

interface DiagnosisCode {
  code: string;
  description: string;
}

interface ClaimFormData {
  id: string;
  userId: string;
  status: "draft" | "submitted" | "processing" | "approved" | "denied" | "appealed";
  createdAt: string;
  updatedAt: string;
  insuranceType: string;
  insuredIdNumber: string;
  patientName: string;
  patientDob: string;
  patientSex: string;
  insuredName: string;
  patientAddress: string;
  patientCity: string;
  patientState: string;
  patientZip: string;
  patientPhone: string;
  patientRelationshipToInsured: string;
  insuredAddress: string;
  insuredCity: string;
  insuredState: string;
  insuredZip: string;
  insuredPhone: string;
  insuredPolicyGroup: string;
  insuredDob: string;
  insuredSex: string;
  insuredEmployer: string;
  insuredPlanName: string;
  otherInsuredName: string;
  otherInsuredPolicy: string;
  otherInsuredDob: string;
  otherInsuredSex: string;
  otherInsuredEmployer: string;
  otherInsuredPlanName: string;
  conditionRelatedToEmployment: boolean;
  conditionRelatedToAutoAccident: boolean;
  conditionRelatedToOtherAccident: boolean;
  autoAccidentState: string;
  diagnosisCodes: DiagnosisCode[];
  referringProviderName: string;
  referringProviderNpi: string;
  hospitalizationFromDate: string;
  hospitalizationToDate: string;
  additionalClaimInfo: string;
  outsideLab: boolean;
  outsideLabCharges: number;
  lineItems: ClaimLineItem[];
  federalTaxId: string;
  federalTaxIdType: string;
  patientAccountNumber: string;
  acceptAssignment: boolean;
  totalCharge: number;
  amountPaid: number;
  balanceDue: number;
  billingProviderName: string;
  billingProviderAddress: string;
  billingProviderCity: string;
  billingProviderState: string;
  billingProviderZip: string;
  billingProviderPhone: string;
  billingProviderNpi: string;
  renderingProviderName: string;
  renderingProviderNpi: string;
  claimNumber: string;
  linkedBillId?: string;
}

function getClaimUserId(req: Request): string | null {
  const session = req.session as Record<string, unknown> | undefined;
  if (session && typeof session === "object" && "userId" in session && typeof session.userId === "string") {
    return session.userId;
  }
  const user = (req as Record<string, unknown>).user as Record<string, unknown> | undefined;
  if (user && typeof user === "object" && "id" in user && typeof user.id === "string") {
    return user.id;
  }
  return null;
}

function requireClaimAuth(req: Request, res: import("express").Response): string | null {
  const userId = getClaimUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required to access claims." });
    return null;
  }
  return userId;
}

function computeLineItemTotal(lineItems: ClaimLineItem[]): number {
  return lineItems.reduce((sum: number, item: ClaimLineItem) => sum + (parseFloat(String(item.charges)) || 0), 0);
}

const claims: ClaimFormData[] = [];

router.get("/claims", (req, res) => {
  const userId = requireClaimAuth(req, res);
  if (!userId) return;
  const userClaims = claims.filter((c) => c.userId === userId);
  res.json({ claims: userClaims });
});

router.get("/claims/:id", (req, res) => {
  const userId = requireClaimAuth(req, res);
  if (!userId) return;
  const claim = claims.find((c) => c.id === req.params.id && c.userId === userId);
  if (!claim) return res.status(404).json({ error: "Claim not found" });
  res.json({ claim });
});

router.post("/claims", (req, res) => {
  const userId = requireClaimAuth(req, res);
  if (!userId) return;
  const diagnosisCodes: DiagnosisCode[] = Array.isArray(req.body.diagnosisCodes)
    ? req.body.diagnosisCodes.slice(0, MAX_DIAGNOSIS_CODES)
    : [];
  const lineItems: ClaimLineItem[] = Array.isArray(req.body.lineItems)
    ? req.body.lineItems.slice(0, MAX_LINE_ITEMS)
    : [];

  const id = randomUUID();
  const now = new Date().toISOString();
  const userClaimCount = claims.filter((c) => c.userId === userId).length;
  const claimNumber = `CLM-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(userClaimCount + 1).padStart(3, "0")}`;
  const totalCharge = computeLineItemTotal(lineItems);
  const amountPaid = parseFloat(String(req.body.amountPaid)) || 0;

  const claim: ClaimFormData = {
    id,
    userId,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    claimNumber,
    insuranceType: req.body.insuranceType || "",
    insuredIdNumber: req.body.insuredIdNumber || "",
    patientName: req.body.patientName || "",
    patientDob: req.body.patientDob || "",
    patientSex: req.body.patientSex || "",
    insuredName: req.body.insuredName || "",
    patientAddress: req.body.patientAddress || "",
    patientCity: req.body.patientCity || "",
    patientState: req.body.patientState || "",
    patientZip: req.body.patientZip || "",
    patientPhone: req.body.patientPhone || "",
    patientRelationshipToInsured: req.body.patientRelationshipToInsured || "self",
    insuredAddress: req.body.insuredAddress || "",
    insuredCity: req.body.insuredCity || "",
    insuredState: req.body.insuredState || "",
    insuredZip: req.body.insuredZip || "",
    insuredPhone: req.body.insuredPhone || "",
    insuredPolicyGroup: req.body.insuredPolicyGroup || "",
    insuredDob: req.body.insuredDob || "",
    insuredSex: req.body.insuredSex || "",
    insuredEmployer: req.body.insuredEmployer || "",
    insuredPlanName: req.body.insuredPlanName || "",
    otherInsuredName: req.body.otherInsuredName || "",
    otherInsuredPolicy: req.body.otherInsuredPolicy || "",
    otherInsuredDob: req.body.otherInsuredDob || "",
    otherInsuredSex: req.body.otherInsuredSex || "",
    otherInsuredEmployer: req.body.otherInsuredEmployer || "",
    otherInsuredPlanName: req.body.otherInsuredPlanName || "",
    conditionRelatedToEmployment: req.body.conditionRelatedToEmployment || false,
    conditionRelatedToAutoAccident: req.body.conditionRelatedToAutoAccident || false,
    conditionRelatedToOtherAccident: req.body.conditionRelatedToOtherAccident || false,
    autoAccidentState: req.body.autoAccidentState || "",
    diagnosisCodes,
    referringProviderName: req.body.referringProviderName || "",
    referringProviderNpi: req.body.referringProviderNpi || "",
    hospitalizationFromDate: req.body.hospitalizationFromDate || "",
    hospitalizationToDate: req.body.hospitalizationToDate || "",
    additionalClaimInfo: req.body.additionalClaimInfo || "",
    outsideLab: req.body.outsideLab || false,
    outsideLabCharges: req.body.outsideLabCharges || 0,
    lineItems,
    federalTaxId: req.body.federalTaxId || "",
    federalTaxIdType: req.body.federalTaxIdType || "EIN",
    patientAccountNumber: req.body.patientAccountNumber || "",
    acceptAssignment: req.body.acceptAssignment ?? true,
    totalCharge,
    amountPaid,
    balanceDue: totalCharge - amountPaid,
    billingProviderName: req.body.billingProviderName || "",
    billingProviderAddress: req.body.billingProviderAddress || "",
    billingProviderCity: req.body.billingProviderCity || "",
    billingProviderState: req.body.billingProviderState || "",
    billingProviderZip: req.body.billingProviderZip || "",
    billingProviderPhone: req.body.billingProviderPhone || "",
    billingProviderNpi: req.body.billingProviderNpi || "",
    renderingProviderName: req.body.renderingProviderName || "",
    renderingProviderNpi: req.body.renderingProviderNpi || "",
    linkedBillId: req.body.linkedBillId || undefined,
  };
  claims.push(claim);
  res.status(201).json({ claim });
});

router.patch("/claims/:id", (req, res) => {
  const userId = requireClaimAuth(req, res);
  if (!userId) return;
  const idx = claims.findIndex((c) => c.id === req.params.id && c.userId === userId);
  if (idx === -1) return res.status(404).json({ error: "Claim not found" });

  const allowedFields: (keyof ClaimFormData)[] = [
    "insuranceType", "insuredIdNumber", "patientName", "patientDob", "patientSex",
    "insuredName", "patientAddress", "patientCity", "patientState", "patientZip",
    "patientPhone", "patientRelationshipToInsured", "insuredAddress", "insuredCity",
    "insuredState", "insuredZip", "insuredPhone", "insuredPolicyGroup", "insuredDob",
    "insuredSex", "insuredEmployer", "insuredPlanName", "otherInsuredName",
    "otherInsuredPolicy", "otherInsuredDob", "otherInsuredSex", "otherInsuredEmployer",
    "otherInsuredPlanName", "conditionRelatedToEmployment", "conditionRelatedToAutoAccident",
    "conditionRelatedToOtherAccident", "autoAccidentState", "diagnosisCodes",
    "referringProviderName", "referringProviderNpi", "hospitalizationFromDate",
    "hospitalizationToDate", "additionalClaimInfo", "outsideLab", "outsideLabCharges",
    "lineItems", "federalTaxId", "federalTaxIdType", "patientAccountNumber",
    "acceptAssignment", "amountPaid", "billingProviderName", "billingProviderAddress",
    "billingProviderCity", "billingProviderState", "billingProviderZip",
    "billingProviderPhone", "billingProviderNpi", "renderingProviderName",
    "renderingProviderNpi", "linkedBillId", "status",
  ];

  for (const field of allowedFields) {
    if (field in req.body) {
      if (field === "diagnosisCodes" && Array.isArray(req.body.diagnosisCodes)) {
        claims[idx].diagnosisCodes = req.body.diagnosisCodes.slice(0, MAX_DIAGNOSIS_CODES);
      } else if (field === "lineItems" && Array.isArray(req.body.lineItems)) {
        claims[idx].lineItems = req.body.lineItems.slice(0, MAX_LINE_ITEMS);
      } else {
        claims[idx][field] = req.body[field] as never;
      }
    }
  }

  claims[idx].updatedAt = new Date().toISOString();
  claims[idx].totalCharge = computeLineItemTotal(claims[idx].lineItems);
  claims[idx].balanceDue = claims[idx].totalCharge - claims[idx].amountPaid;
  res.json({ claim: claims[idx] });
});

router.delete("/claims/:id", (req, res) => {
  const userId = requireClaimAuth(req, res);
  if (!userId) return;
  const idx = claims.findIndex((c) => c.id === req.params.id && c.userId === userId);
  if (idx === -1) return res.status(404).json({ error: "Claim not found" });
  claims.splice(idx, 1);
  res.json({ success: true });
});

router.post("/claims/:id/submit", (req, res) => {
  const userId = requireClaimAuth(req, res);
  if (!userId) return;
  const idx = claims.findIndex((c) => c.id === req.params.id && c.userId === userId);
  if (idx === -1) return res.status(404).json({ error: "Claim not found" });
  if (claims[idx].status !== "draft") {
    return res.status(400).json({ error: "Only draft claims can be submitted." });
  }
  claims[idx].status = "submitted";
  claims[idx].updatedAt = new Date().toISOString();
  res.json({ claim: claims[idx] });
});

router.get("/patient-profile", async (req, res) => {
  const userId = requireClaimAuth(req, res);
  if (!userId) return;

  const emptyProfile = {
    userId,
    patientName: "",
    patientDob: "",
    patientSex: "",
    patientAddress: "",
    patientCity: "",
    patientState: "",
    patientZip: "",
    patientPhone: "",
    insuredIdNumber: "",
    insuredName: "",
    insuredPolicyGroup: "",
    insuredPlanName: "",
    insuredEmployer: "",
  };

  try {
    const patientIds = await storage.getUserPatientIds(userId);
    if (patientIds.length === 0) {
      return res.json(emptyProfile);
    }

    const connections = await storage.getEhrConnections(userId);
    if (connections.length === 0) {
      return res.json(emptyProfile);
    }

    let foundPatient = null;
    for (const connId of connections.map(c => c.id)) {
      const patients = await storage.getPatientsByConnection(connId);
      if (patients.length > 0) {
        foundPatient = patients[0];
        break;
      }
    }

    if (!foundPatient) {
      return res.json(emptyProfile);
    }

    const addressParts = (foundPatient.address || "").split(",").map(s => s.trim());
    const patientCity = addressParts[1] || "";
    const stateZip = (addressParts[2] || "").split(" ");
    const patientState = stateZip[0] || "";
    const patientZip = stateZip[1] || "";

    res.json({
      userId,
      patientName: `${foundPatient.lastName}, ${foundPatient.firstName}`.trim(),
      patientDob: foundPatient.dateOfBirth || "",
      patientSex: foundPatient.gender || "",
      patientAddress: addressParts[0] || "",
      patientCity,
      patientState,
      patientZip,
      patientPhone: foundPatient.phone || "",
      insuredIdNumber: foundPatient.insuranceId || "",
      insuredName: `${foundPatient.lastName}, ${foundPatient.firstName}`.trim(),
      insuredPolicyGroup: "",
      insuredPlanName: foundPatient.insuranceProvider || "",
      insuredEmployer: "",
    });
  } catch {
    res.json(emptyProfile);
  }
});

export default router;
