import { Router } from "express";

const router = Router();

interface PayerEndpoint {
  id: string;
  payerName: string;
  payerId: string;
  fhirBaseUrl: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  supportedResources: string[];
  complianceRule: string;
  logoUrl: string;
  memberPortalUrl: string;
  patientAccessApiDocs: string;
  category: "commercial" | "medicare" | "medicaid" | "marketplace";
  states: string[];
  status: "live" | "beta" | "coming-soon";
  lastVerified: string;
}

interface ClaimsHistoryEntry {
  id: string;
  claimId: string;
  dateOfService: string;
  provider: string;
  providerNPI: string;
  facilityName: string;
  claimType: "professional" | "institutional" | "pharmacy" | "dental" | "vision";
  status: "paid" | "denied" | "pending" | "in-process" | "adjusted";
  diagnosisCodes: { code: string; description: string }[];
  procedureCodes: { code: string; description: string; modifier?: string }[];
  billedAmount: number;
  allowedAmount: number;
  paidAmount: number;
  patientResponsibility: number;
  coinsurance: number;
  copay: number;
  deductibleApplied: number;
  eobUrl: string;
  payerName: string;
}

interface ProviderDirectoryEntry {
  id: string;
  name: string;
  npi: string;
  specialty: string;
  taxonomyCode: string;
  addresses: { type: string; line: string; city: string; state: string; zip: string; phone: string }[];
  acceptingNewPatients: boolean;
  networkStatus: "in-network" | "out-of-network" | "tier-1" | "tier-2";
  languages: string[];
  gender: string;
  boardCertifications: string[];
  hospitalAffiliations: string[];
  telehealth: boolean;
  lastUpdated: string;
}

interface CoverageInfo {
  id: string;
  payerName: string;
  planName: string;
  planType: string;
  memberId: string;
  groupNumber: string;
  subscriberName: string;
  relationship: string;
  effectiveDate: string;
  terminationDate: string | null;
  status: "active" | "terminated" | "pending";
  benefits: {
    category: string;
    inNetworkCopay: string;
    outOfNetworkCopay: string;
    deductible: string;
    coinsurance: string;
    priorAuthRequired: boolean;
  }[];
  deductibleStatus: {
    individual: { met: number; total: number };
    family: { met: number; total: number };
  };
  outOfPocketStatus: {
    individual: { met: number; total: number };
    family: { met: number; total: number };
  };
}

const PAYER_ENDPOINTS: PayerEndpoint[] = [
  {
    id: "payer-uhc", payerName: "UnitedHealthcare", payerId: "87726", fhirBaseUrl: "https://fhir.uhc.com/v1/fhir/R4",
    authorizationUrl: "https://member.uhc.com/oauth2/authorize", tokenUrl: "https://member.uhc.com/oauth2/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read", "patient/Patient.read", "patient/Claim.read"],
    supportedResources: ["ExplanationOfBenefit", "Coverage", "Patient", "Practitioner", "Organization", "Location"],
    complianceRule: "CMS-9115-F (Patient Access API)", logoUrl: "", memberPortalUrl: "https://www.uhc.com/member",
    patientAccessApiDocs: "https://www.uhc.com/legal/interoperability-apis", category: "commercial",
    states: ["ALL"], status: "live", lastVerified: "2026-03-15",
  },
  {
    id: "payer-anthem", payerName: "Anthem / Elevance Health", payerId: "00890", fhirBaseUrl: "https://fhir.anthem.com/R4",
    authorizationUrl: "https://patient.anthem.com/oauth2/authorize", tokenUrl: "https://patient.anthem.com/oauth2/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read", "patient/Patient.read"],
    supportedResources: ["ExplanationOfBenefit", "Coverage", "Patient", "Practitioner", "Organization"],
    complianceRule: "CMS-9115-F", logoUrl: "", memberPortalUrl: "https://www.anthem.com/member",
    patientAccessApiDocs: "https://www.anthem.com/microsites/interoperability", category: "commercial",
    states: ["CA", "CO", "CT", "GA", "IN", "KY", "ME", "MO", "NH", "NV", "NY", "OH", "VA", "WI"],
    status: "live", lastVerified: "2026-03-10",
  },
  {
    id: "payer-aetna", payerName: "Aetna (CVS Health)", payerId: "60054", fhirBaseUrl: "https://fhir.aetna.com/fhirR4/v1",
    authorizationUrl: "https://member.aetna.com/appConfig/login/login.fcc", tokenUrl: "https://fhir.aetna.com/oauth2/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read", "patient/Patient.read", "patient/Claim.read"],
    supportedResources: ["ExplanationOfBenefit", "Coverage", "Patient", "Practitioner", "Organization", "Claim"],
    complianceRule: "CMS-9115-F", logoUrl: "", memberPortalUrl: "https://www.aetna.com/individuals-families",
    patientAccessApiDocs: "https://developerportal.aetna.com", category: "commercial",
    states: ["ALL"], status: "live", lastVerified: "2026-03-20",
  },
  {
    id: "payer-cigna", payerName: "Cigna", payerId: "62308", fhirBaseUrl: "https://fhir.cigna.com/PatientAccess/v1-devportal",
    authorizationUrl: "https://my.cigna.com/web/public/guest", tokenUrl: "https://fhir.cigna.com/oauth2/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read", "patient/Patient.read"],
    supportedResources: ["ExplanationOfBenefit", "Coverage", "Patient", "Practitioner"],
    complianceRule: "CMS-9115-F", logoUrl: "", memberPortalUrl: "https://my.cigna.com",
    patientAccessApiDocs: "https://developer.cigna.com/interoperability", category: "commercial",
    states: ["ALL"], status: "live", lastVerified: "2026-02-28",
  },
  {
    id: "payer-humana", payerName: "Humana", payerId: "61101", fhirBaseUrl: "https://fhir.humana.com/api/v1/fhir/R4",
    authorizationUrl: "https://www.humana.com/logon", tokenUrl: "https://fhir.humana.com/oauth2/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read", "patient/Patient.read"],
    supportedResources: ["ExplanationOfBenefit", "Coverage", "Patient", "Practitioner", "Organization"],
    complianceRule: "CMS-9115-F", logoUrl: "", memberPortalUrl: "https://www.humana.com/member",
    patientAccessApiDocs: "https://developers.humana.com", category: "commercial",
    states: ["ALL"], status: "live", lastVerified: "2026-03-05",
  },
  {
    id: "payer-bcbs", payerName: "Blue Cross Blue Shield (Anthem BCBS)", payerId: "BCBS", fhirBaseUrl: "https://fhir.bcbs.com/R4",
    authorizationUrl: "https://member.bcbs.com/oauth2/authorize", tokenUrl: "https://member.bcbs.com/oauth2/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read", "patient/Patient.read"],
    supportedResources: ["ExplanationOfBenefit", "Coverage", "Patient", "Practitioner"],
    complianceRule: "CMS-9115-F", logoUrl: "", memberPortalUrl: "https://www.bcbs.com/member",
    patientAccessApiDocs: "https://www.bcbs.com/interoperability", category: "commercial",
    states: ["ALL"], status: "live", lastVerified: "2026-03-12",
  },
  {
    id: "payer-kaiser", payerName: "Kaiser Permanente", payerId: "91617", fhirBaseUrl: "https://fhir.kp.org/R4",
    authorizationUrl: "https://healthy.kaiserpermanente.org/sign-on", tokenUrl: "https://fhir.kp.org/oauth2/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read", "patient/Patient.read", "patient/Encounter.read"],
    supportedResources: ["ExplanationOfBenefit", "Coverage", "Patient", "Practitioner", "Encounter", "Condition"],
    complianceRule: "CMS-9115-F", logoUrl: "", memberPortalUrl: "https://healthy.kaiserpermanente.org",
    patientAccessApiDocs: "https://developer.kaiserpermanente.org", category: "commercial",
    states: ["CA", "CO", "DC", "GA", "HI", "MD", "OR", "VA", "WA"],
    status: "live", lastVerified: "2026-03-18",
  },
  {
    id: "payer-cms-medicare", payerName: "Medicare (CMS Blue Button 2.0)", payerId: "CMS", fhirBaseUrl: "https://sandbox.bluebutton.cms.gov/v2/fhir",
    authorizationUrl: "https://sandbox.bluebutton.cms.gov/v2/o/authorize", tokenUrl: "https://sandbox.bluebutton.cms.gov/v2/o/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read", "patient/Patient.read"],
    supportedResources: ["ExplanationOfBenefit", "Coverage", "Patient"],
    complianceRule: "CMS Blue Button 2.0 API", logoUrl: "", memberPortalUrl: "https://www.medicare.gov/account/login",
    patientAccessApiDocs: "https://bluebutton.cms.gov/developers/", category: "medicare",
    states: ["ALL"], status: "live", lastVerified: "2026-03-25",
  },
  {
    id: "payer-molina", payerName: "Molina Healthcare", payerId: "20934", fhirBaseUrl: "https://fhir.molinahealthcare.com/R4",
    authorizationUrl: "https://member.molinahealthcare.com/oauth2/authorize", tokenUrl: "https://member.molinahealthcare.com/oauth2/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read", "patient/Patient.read"],
    supportedResources: ["ExplanationOfBenefit", "Coverage", "Patient"],
    complianceRule: "CMS-9115-F", logoUrl: "", memberPortalUrl: "https://member.molinahealthcare.com",
    patientAccessApiDocs: "https://www.molinahealthcare.com/members/common/en-us/interoperability", category: "medicaid",
    states: ["CA", "FL", "IL", "MI", "NY", "OH", "TX", "WA", "WI"],
    status: "live", lastVerified: "2026-02-20",
  },
  {
    id: "payer-centene", payerName: "Centene / Ambetter", payerId: "68398", fhirBaseUrl: "https://fhir.centene.com/R4",
    authorizationUrl: "https://member.ambetterhealth.com/oauth2/authorize", tokenUrl: "https://member.ambetterhealth.com/oauth2/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read", "patient/Patient.read"],
    supportedResources: ["ExplanationOfBenefit", "Coverage", "Patient"],
    complianceRule: "CMS-9115-F", logoUrl: "", memberPortalUrl: "https://member.ambetterhealth.com",
    patientAccessApiDocs: "https://www.centene.com/interoperability.html", category: "marketplace",
    states: ["ALL"], status: "live", lastVerified: "2026-03-08",
  },
];

function generateClaimsHistory(payerId: string): ClaimsHistoryEntry[] {
  const payer = PAYER_ENDPOINTS.find(p => p.id === payerId);
  const payerName = payer?.payerName || "Unknown Payer";

  return [
    {
      id: "eob-001", claimId: "CLM-2026-001847", dateOfService: "2026-02-15",
      provider: "Dr. Sarah Chen, MD", providerNPI: "1234567890", facilityName: "Primary Care Associates",
      claimType: "professional", status: "paid",
      diagnosisCodes: [{ code: "Z00.00", description: "Encounter for general adult medical examination without abnormal findings" }],
      procedureCodes: [{ code: "99395", description: "Preventive visit, established patient, 18-39 years" }],
      billedAmount: 350, allowedAmount: 225, paidAmount: 180, patientResponsibility: 45,
      coinsurance: 0, copay: 30, deductibleApplied: 15,
      eobUrl: "#", payerName,
    },
    {
      id: "eob-002", claimId: "CLM-2026-002193", dateOfService: "2026-01-28",
      provider: "Quest Diagnostics", providerNPI: "9876543210", facilityName: "Quest Diagnostics Lab",
      claimType: "professional", status: "paid",
      diagnosisCodes: [{ code: "Z13.220", description: "Encounter for screening for lipoid disorders" }],
      procedureCodes: [
        { code: "80061", description: "Lipid panel" },
        { code: "85025", description: "Complete blood count (CBC) with differential" },
        { code: "80053", description: "Comprehensive metabolic panel" },
      ],
      billedAmount: 425, allowedAmount: 85, paidAmount: 68, patientResponsibility: 17,
      coinsurance: 17, copay: 0, deductibleApplied: 0,
      eobUrl: "#", payerName,
    },
    {
      id: "eob-003", claimId: "CLM-2025-018742", dateOfService: "2025-11-12",
      provider: "Dr. James Wilson, DDS", providerNPI: "5678901234", facilityName: "Family Dental Care",
      claimType: "dental", status: "paid",
      diagnosisCodes: [{ code: "K02.9", description: "Dental caries, unspecified" }],
      procedureCodes: [
        { code: "D0120", description: "Periodic oral evaluation" },
        { code: "D1110", description: "Prophylaxis - adult" },
        { code: "D0274", description: "Bitewing radiographs - four films" },
      ],
      billedAmount: 380, allowedAmount: 275, paidAmount: 220, patientResponsibility: 55,
      coinsurance: 25, copay: 30, deductibleApplied: 0,
      eobUrl: "#", payerName,
    },
    {
      id: "eob-004", claimId: "CLM-2025-016329", dateOfService: "2025-10-05",
      provider: "Dr. Priya Patel, MD", providerNPI: "3456789012", facilityName: "Behavioral Health Center",
      claimType: "professional", status: "paid",
      diagnosisCodes: [{ code: "F41.1", description: "Generalized anxiety disorder" }],
      procedureCodes: [{ code: "90834", description: "Individual psychotherapy, 45 minutes" }],
      billedAmount: 250, allowedAmount: 175, paidAmount: 122.50, patientResponsibility: 52.50,
      coinsurance: 22.50, copay: 30, deductibleApplied: 0,
      eobUrl: "#", payerName,
    },
    {
      id: "eob-005", claimId: "CLM-2025-014881", dateOfService: "2025-09-18",
      provider: "Dr. Marcus Johnson, DO", providerNPI: "2345678901", facilityName: "Urgent Care Plus",
      claimType: "professional", status: "paid",
      diagnosisCodes: [
        { code: "J06.9", description: "Acute upper respiratory infection, unspecified" },
        { code: "R05.9", description: "Cough, unspecified" },
      ],
      procedureCodes: [
        { code: "99213", description: "Office visit, established patient, low complexity" },
        { code: "87880", description: "Strep A test, rapid" },
      ],
      billedAmount: 285, allowedAmount: 165, paidAmount: 115.50, patientResponsibility: 49.50,
      coinsurance: 19.50, copay: 30, deductibleApplied: 0,
      eobUrl: "#", payerName,
    },
    {
      id: "eob-006", claimId: "CLM-2025-012347", dateOfService: "2025-08-22",
      provider: "CVS Pharmacy #4521", providerNPI: "7890123456", facilityName: "CVS Pharmacy",
      claimType: "pharmacy", status: "paid",
      diagnosisCodes: [{ code: "E11.9", description: "Type 2 diabetes mellitus without complications" }],
      procedureCodes: [{ code: "NDC-00093-7214", description: "Metformin HCl 500mg, 90-day supply" }],
      billedAmount: 45, allowedAmount: 15, paidAmount: 5, patientResponsibility: 10,
      coinsurance: 0, copay: 10, deductibleApplied: 0,
      eobUrl: "#", payerName,
    },
    {
      id: "eob-007", claimId: "CLM-2025-009834", dateOfService: "2025-07-10",
      provider: "Regional Medical Center", providerNPI: "6789012345", facilityName: "Regional Medical Center - Radiology",
      claimType: "institutional", status: "paid",
      diagnosisCodes: [{ code: "M54.5", description: "Low back pain" }],
      procedureCodes: [{ code: "72148", description: "MRI lumbar spine without contrast" }],
      billedAmount: 2800, allowedAmount: 650, paidAmount: 520, patientResponsibility: 130,
      coinsurance: 130, copay: 0, deductibleApplied: 0,
      eobUrl: "#", payerName,
    },
    {
      id: "eob-008", claimId: "CLM-2025-007291", dateOfService: "2025-06-03",
      provider: "Dr. Emily Ross, OD", providerNPI: "4567890123", facilityName: "Clear Vision Optometry",
      claimType: "vision", status: "paid",
      diagnosisCodes: [{ code: "H52.13", description: "Myopia, bilateral" }],
      procedureCodes: [
        { code: "92004", description: "Comprehensive eye exam, new patient" },
        { code: "92310", description: "Contact lens fitting" },
      ],
      billedAmount: 275, allowedAmount: 185, paidAmount: 148, patientResponsibility: 37,
      coinsurance: 37, copay: 0, deductibleApplied: 0,
      eobUrl: "#", payerName,
    },
  ];
}

function generateProviderDirectory(payerId: string): ProviderDirectoryEntry[] {
  return [
    {
      id: "prov-001", name: "Dr. Sarah Chen, MD", npi: "1234567890", specialty: "Internal Medicine",
      taxonomyCode: "207R00000X",
      addresses: [{ type: "practice", line: "100 Medical Plaza, Suite 200", city: "New York", state: "NY", zip: "10001", phone: "(212) 555-0100" }],
      acceptingNewPatients: true, networkStatus: "in-network", languages: ["English", "Mandarin"],
      gender: "Female", boardCertifications: ["Internal Medicine"], hospitalAffiliations: ["Mount Sinai Hospital"],
      telehealth: true, lastUpdated: "2026-03-01",
    },
    {
      id: "prov-002", name: "Dr. Marcus Johnson, DO", npi: "2345678901", specialty: "Family Medicine",
      taxonomyCode: "207Q00000X",
      addresses: [{ type: "practice", line: "200 Wellness Drive", city: "Brooklyn", state: "NY", zip: "11201", phone: "(718) 555-0200" }],
      acceptingNewPatients: true, networkStatus: "in-network", languages: ["English", "Spanish"],
      gender: "Male", boardCertifications: ["Family Medicine"], hospitalAffiliations: ["NYU Langone"],
      telehealth: true, lastUpdated: "2026-02-15",
    },
    {
      id: "prov-003", name: "Dr. Priya Patel, MD", npi: "3456789012", specialty: "Psychiatry",
      taxonomyCode: "2084P0800X",
      addresses: [{ type: "practice", line: "300 Behavioral Health Center", city: "Manhattan", state: "NY", zip: "10016", phone: "(212) 555-0300" }],
      acceptingNewPatients: false, networkStatus: "in-network", languages: ["English", "Hindi", "Gujarati"],
      gender: "Female", boardCertifications: ["Psychiatry", "Addiction Medicine"], hospitalAffiliations: ["Bellevue Hospital"],
      telehealth: true, lastUpdated: "2026-03-10",
    },
    {
      id: "prov-004", name: "Dr. James Wilson, DDS", npi: "5678901234", specialty: "General Dentistry",
      taxonomyCode: "1223G0001X",
      addresses: [{ type: "practice", line: "500 Dental Way", city: "Queens", state: "NY", zip: "11375", phone: "(718) 555-0500" }],
      acceptingNewPatients: true, networkStatus: "in-network", languages: ["English"],
      gender: "Male", boardCertifications: ["General Dentistry"], hospitalAffiliations: [],
      telehealth: false, lastUpdated: "2026-01-20",
    },
    {
      id: "prov-005", name: "Dr. Emily Ross, OD", npi: "4567890123", specialty: "Optometry",
      taxonomyCode: "152W00000X",
      addresses: [{ type: "practice", line: "600 Vision Blvd", city: "Bronx", state: "NY", zip: "10451", phone: "(718) 555-0600" }],
      acceptingNewPatients: true, networkStatus: "tier-1", languages: ["English", "Spanish"],
      gender: "Female", boardCertifications: ["Optometry"], hospitalAffiliations: [],
      telehealth: true, lastUpdated: "2026-02-28",
    },
    {
      id: "prov-006", name: "Regional Medical Center", npi: "6789012345", specialty: "Hospital / Facility",
      taxonomyCode: "282N00000X",
      addresses: [{ type: "facility", line: "700 Hospital Road", city: "New York", state: "NY", zip: "10029", phone: "(212) 555-0700" }],
      acceptingNewPatients: true, networkStatus: "in-network", languages: ["English", "Spanish", "Mandarin", "Korean"],
      gender: "N/A", boardCertifications: [], hospitalAffiliations: [],
      telehealth: false, lastUpdated: "2026-03-15",
    },
  ];
}

function generateCoverageInfo(payerId: string): CoverageInfo {
  const payer = PAYER_ENDPOINTS.find(p => p.id === payerId);
  return {
    id: "cov-001", payerName: payer?.payerName || "Unknown",
    planName: "Gold PPO 1500", planType: "PPO",
    memberId: "XYZ123456789", groupNumber: "GRP-88421",
    subscriberName: "Patient User", relationship: "self",
    effectiveDate: "2025-01-01", terminationDate: null, status: "active",
    benefits: [
      { category: "Primary Care", inNetworkCopay: "$30", outOfNetworkCopay: "$60", deductible: "N/A", coinsurance: "0%", priorAuthRequired: false },
      { category: "Specialist", inNetworkCopay: "$50", outOfNetworkCopay: "$100", deductible: "N/A", coinsurance: "20%", priorAuthRequired: false },
      { category: "Emergency Room", inNetworkCopay: "$250", outOfNetworkCopay: "$250", deductible: "After deductible", coinsurance: "20%", priorAuthRequired: false },
      { category: "Prescription (Generic)", inNetworkCopay: "$10", outOfNetworkCopay: "$25", deductible: "N/A", coinsurance: "0%", priorAuthRequired: false },
      { category: "Prescription (Brand)", inNetworkCopay: "$35", outOfNetworkCopay: "$70", deductible: "N/A", coinsurance: "20%", priorAuthRequired: false },
      { category: "Lab Work", inNetworkCopay: "$0", outOfNetworkCopay: "$50", deductible: "After deductible", coinsurance: "20%", priorAuthRequired: false },
      { category: "Imaging (MRI/CT)", inNetworkCopay: "20%", outOfNetworkCopay: "40%", deductible: "After deductible", coinsurance: "20%", priorAuthRequired: true },
      { category: "Mental Health", inNetworkCopay: "$30", outOfNetworkCopay: "$60", deductible: "N/A", coinsurance: "0%", priorAuthRequired: false },
      { category: "Dental (Preventive)", inNetworkCopay: "$0", outOfNetworkCopay: "50%", deductible: "N/A", coinsurance: "0%", priorAuthRequired: false },
      { category: "Vision (Exam)", inNetworkCopay: "$10", outOfNetworkCopay: "$40", deductible: "N/A", coinsurance: "0%", priorAuthRequired: false },
    ],
    deductibleStatus: {
      individual: { met: 875, total: 1500 },
      family: { met: 1200, total: 3000 },
    },
    outOfPocketStatus: {
      individual: { met: 2150, total: 6500 },
      family: { met: 3400, total: 13000 },
    },
  };
}

router.get("/payers", (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const search = (req.query.search as string || "").toLowerCase();

    let payers = [...PAYER_ENDPOINTS];
    if (category && category !== "all") {
      payers = payers.filter(p => p.category === category);
    }
    if (search) {
      payers = payers.filter(p => p.payerName.toLowerCase().includes(search));
    }

    res.json({
      payers,
      totalPayers: payers.length,
      categories: [
        { id: "commercial", label: "Commercial Insurance", count: PAYER_ENDPOINTS.filter(p => p.category === "commercial").length },
        { id: "medicare", label: "Medicare", count: PAYER_ENDPOINTS.filter(p => p.category === "medicare").length },
        { id: "medicaid", label: "Medicaid / Managed Care", count: PAYER_ENDPOINTS.filter(p => p.category === "medicaid").length },
        { id: "marketplace", label: "ACA Marketplace", count: PAYER_ENDPOINTS.filter(p => p.category === "marketplace").length },
      ],
      complianceInfo: {
        rule: "CMS Interoperability and Patient Access Final Rule (CMS-9115-F)",
        effectiveDate: "2021-07-01 (Phase 1), 2026-01-01 (Phase 3 — expanded)",
        description: "All CMS-regulated payers (Medicare Advantage, Medicaid, CHIP, and QHP issuers on the Exchanges) must provide Patient Access APIs using FHIR R4. As of 2026, this extends to most commercial insurers under the Transparency in Coverage rule.",
        patientRights: [
          "Access your claims and encounter data via FHIR API",
          "Download your Explanation of Benefits (EOBs) digitally",
          "View your provider directory in machine-readable format",
          "Access your coverage and benefits information",
          "Transfer your data to any third-party app you authorize",
          "Payers must respond within 1 business day of data availability",
        ],
      },
    });
  } catch (error) {
    console.error("[PayerFHIR] Payers error:", error);
    res.status(500).json({ error: "Failed to fetch payer list" });
  }
});

router.get("/claims/:payerId", (req, res) => {
  try {
    const { payerId } = req.params;
    const claimType = req.query.type as string | undefined;

    let claims = generateClaimsHistory(payerId);
    if (claimType && claimType !== "all") {
      claims = claims.filter(c => c.claimType === claimType);
    }

    const totalBilled = claims.reduce((sum, c) => sum + c.billedAmount, 0);
    const totalPaid = claims.reduce((sum, c) => sum + c.paidAmount, 0);
    const totalPatientResp = claims.reduce((sum, c) => sum + c.patientResponsibility, 0);
    const totalSavings = totalBilled - totalPaid - totalPatientResp;

    res.json({
      payerId,
      claims,
      totalClaims: claims.length,
      summary: {
        totalBilled,
        totalAllowed: claims.reduce((sum, c) => sum + c.allowedAmount, 0),
        totalPaidByInsurer: totalPaid,
        totalPatientResponsibility: totalPatientResp,
        networkSavings: totalSavings,
        claimsByType: {
          professional: claims.filter(c => c.claimType === "professional").length,
          institutional: claims.filter(c => c.claimType === "institutional").length,
          pharmacy: claims.filter(c => c.claimType === "pharmacy").length,
          dental: claims.filter(c => c.claimType === "dental").length,
          vision: claims.filter(c => c.claimType === "vision").length,
        },
      },
      exportFormats: ["FHIR R4 Bundle (JSON)", "PDF EOB Package", "CSV Spreadsheet"],
      dataRetentionNotice: "Under federal law, your payer must retain and provide access to at least 5 years of claims data. Download your records before your coverage terminates.",
    });
  } catch (error) {
    console.error("[PayerFHIR] Claims error:", error);
    res.status(500).json({ error: "Failed to fetch claims" });
  }
});

router.get("/provider-directory/:payerId", (req, res) => {
  try {
    const { payerId } = req.params;
    const specialty = req.query.specialty as string | undefined;
    let providers = generateProviderDirectory(payerId);
    if (specialty && specialty !== "all") {
      providers = providers.filter(p => p.specialty.toLowerCase().includes(specialty.toLowerCase()));
    }
    res.json({ payerId, providers, totalProviders: providers.length });
  } catch (error) {
    console.error("[PayerFHIR] Directory error:", error);
    res.status(500).json({ error: "Failed to fetch provider directory" });
  }
});

router.get("/coverage/:payerId", (req, res) => {
  try {
    const { payerId } = req.params;
    const coverage = generateCoverageInfo(payerId);
    res.json(coverage);
  } catch (error) {
    console.error("[PayerFHIR] Coverage error:", error);
    res.status(500).json({ error: "Failed to fetch coverage info" });
  }
});

router.get("/transition-checklist", (_req, res) => {
  res.json({
    title: "Insurance Transition Checklist",
    description: "Steps to preserve your medical history and prepare for life without traditional insurance.",
    steps: [
      { id: 1, title: "Download All Claims & EOBs", description: "Export your complete claims history from your insurer's Patient Access API. You have a legal right to this data under CMS-9115-F.", priority: "critical", timeframe: "Before coverage ends" },
      { id: 2, title: "Save Your Provider Directory", description: "Download your in-network provider list. Even without insurance, knowing who accepted your plan helps when negotiating self-pay rates.", priority: "high", timeframe: "Before coverage ends" },
      { id: 3, title: "Export Coverage & Benefits Summary", description: "Save your deductible status, out-of-pocket maximums, and benefits schedule. Useful for comparing with DPC memberships or short-term plans.", priority: "high", timeframe: "Before coverage ends" },
      { id: 4, title: "Request Medical Records from Providers", description: "Contact each provider separately to request your full medical records (labs, imaging, notes). This is separate from insurance claims data.", priority: "critical", timeframe: "30 days before coverage ends" },
      { id: 5, title: "Fill Prescriptions & Get Refills", description: "Fill all current prescriptions while still insured. Ask your doctor for 90-day supplies. Get the generic drug names for GoodRx savings later.", priority: "critical", timeframe: "Before coverage ends" },
      { id: 6, title: "Complete Pending Procedures", description: "Finish any approved treatments, imaging, or procedures while still covered. Prior authorizations expire with your coverage.", priority: "high", timeframe: "Before coverage ends" },
      { id: 7, title: "Explore COBRA or Continuation Coverage", description: "You may be eligible for 18-36 months of COBRA continuation (at full premium cost). Consider this for ongoing treatments.", priority: "medium", timeframe: "Within 60 days of coverage loss" },
      { id: 8, title: "Set Up Direct Primary Care (DPC)", description: "Enroll in a DPC membership for unlimited primary care at a flat monthly rate. Pair with a catastrophic plan for major events.", priority: "medium", timeframe: "Before or at coverage end" },
      { id: 9, title: "Apply for ACA Special Enrollment", description: "Loss of coverage triggers a 60-day Special Enrollment Period on Healthcare.gov. Even if you plan to go uninsured, know your options.", priority: "medium", timeframe: "Within 60 days of coverage loss" },
      { id: 10, title: "Store Records in Tabula Medica", description: "Import your FHIR data, upload EOBs, and centralize everything in your Tabula Medica health record for permanent access.", priority: "high", timeframe: "Ongoing" },
    ],
  });
});

export default router;
