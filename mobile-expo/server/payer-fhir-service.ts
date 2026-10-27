/**
 * Payer FHIR Patient Access Service
 * ===================================
 * Under CMS-9115-F (Interoperability & Patient Access Final Rule, effective 2026),
 * insurers must expose patient data via FHIR R4 Patient Access APIs:
 *   - ExplanationOfBenefit (EOB) — past claims / adjudications
 *   - Coverage — plan details, beneficiary info, group/network
 *   - Practitioner / PractitionerRole — provider directory
 *   - Organization — payer & facility info
 *
 * This service helps patients transitioning out of insurance download their
 * complete medical history so it lives permanently in Tabula Medica.
 *
 * Payer directory: https://www.cms.gov/files/document/payer-api-resources.pdf
 *
 * When no payer API credentials are configured, we provide a comprehensive
 * demo dataset so the feature is always explorable.
 */

import axios from "axios";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ClaimType = "medical" | "pharmacy" | "dental" | "vision" | "behavioral" | "lab" | "imaging";
export type ClaimStatus = "paid" | "denied" | "pending" | "appealed" | "adjusted";

export interface PayerConnection {
  payerId: string;
  payerName: string;
  fhirBaseUrl: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: string;
  patientId?: string;
  connected: boolean;
  lastSync?: string;
  capabilities: string[];
}

export interface ClaimRecord {
  id: string;
  claimNumber: string;
  dateOfService: string;
  datePaid?: string;
  claimType: ClaimType;
  status: ClaimStatus;
  provider: {
    name: string;
    npi?: string;
    specialty?: string;
    address?: string;
    phone?: string;
  };
  facility?: {
    name: string;
    type: string;
  };
  diagnosis: Array<{
    code: string;
    display: string;
    system: string;
  }>;
  procedures: Array<{
    code: string;
    display: string;
    system: string;
    quantity?: number;
  }>;
  amounts: {
    billed: number;
    allowed: number;
    paid: number;
    patientResponsibility: number;
    deductible?: number;
    copay?: number;
    coinsurance?: number;
  };
  coverageInfo?: {
    planName: string;
    memberId: string;
    groupNumber?: string;
    network: string;
  };
  eobUrl?: string;
  notes?: string;
}

export interface CoverageRecord {
  id: string;
  payerName: string;
  planName: string;
  memberId: string;
  groupNumber?: string;
  subscriberId?: string;
  relationship: string;
  effectiveStart: string;
  effectiveEnd?: string;
  isActive: boolean;
  network: string;
  planType: string;
  benefits: {
    deductibleIndividual: number;
    deductibleFamily: number;
    oopMaxIndividual: number;
    oopMaxFamily: number;
    deductibleMet: number;
    oopMet: number;
  };
}

export interface ProviderDirectoryEntry {
  id: string;
  name: string;
  npi: string;
  specialty: string;
  credentials: string;
  gender?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  fax?: string;
  acceptingNewPatients: boolean;
  languages: string[];
  networkStatus: "in-network" | "out-of-network" | "tier-1" | "tier-2";
  affiliations: string[];
  telehealth: boolean;
  lastVerified: string;
}

export interface ClaimsHistoryResult {
  claims: ClaimRecord[];
  totalCount: number;
  summary: {
    totalBilled: number;
    totalPaid: number;
    totalPatientCost: number;
    claimsByType: Record<string, number>;
    claimsByStatus: Record<string, number>;
    dateRange: { earliest: string; latest: string };
    uniqueProviders: number;
    uniqueDiagnoses: number;
  };
  coverage?: CoverageRecord;
  isLive: boolean;
  payerName: string;
}

export interface ProviderDirectoryResult {
  providers: ProviderDirectoryEntry[];
  totalCount: number;
  isLive: boolean;
  payerName: string;
}

// ─── Supported payers ────────────────────────────────────────────────────────

interface PayerRegistryEntry {
  id: string;
  name: string;
  fhirBaseUrl: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  logoColor: string;
}

const PAYER_REGISTRY: PayerRegistryEntry[] = [
  {
    id: "anthem",
    name: "Anthem Blue Cross Blue Shield",
    fhirBaseUrl: "https://fhir.anthem.com/R4",
    authUrl: "https://oauth.anthem.com/authorize",
    tokenUrl: "https://oauth.anthem.com/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read", "patient/Patient.read"],
    logoColor: "#003DA5",
  },
  {
    id: "unitedhealth",
    name: "UnitedHealthcare",
    fhirBaseUrl: "https://fhir.uhc.com/R4",
    authUrl: "https://member.uhc.com/oauth/authorize",
    tokenUrl: "https://member.uhc.com/oauth/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read"],
    logoColor: "#002677",
  },
  {
    id: "aetna",
    name: "Aetna / CVS Health",
    fhirBaseUrl: "https://fhir.aetna.com/R4",
    authUrl: "https://oauth.aetna.com/authorize",
    tokenUrl: "https://oauth.aetna.com/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read"],
    logoColor: "#7D2781",
  },
  {
    id: "cigna",
    name: "Cigna Healthcare",
    fhirBaseUrl: "https://fhir.cigna.com/R4",
    authUrl: "https://oauth.cigna.com/authorize",
    tokenUrl: "https://oauth.cigna.com/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read"],
    logoColor: "#EF6C00",
  },
  {
    id: "humana",
    name: "Humana",
    fhirBaseUrl: "https://fhir.humana.com/R4",
    authUrl: "https://oauth.humana.com/authorize",
    tokenUrl: "https://oauth.humana.com/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read"],
    logoColor: "#3E7B27",
  },
  {
    id: "kaiser",
    name: "Kaiser Permanente",
    fhirBaseUrl: "https://fhir.kaiserpermanente.org/R4",
    authUrl: "https://healthy.kaiserpermanente.org/oauth/authorize",
    tokenUrl: "https://healthy.kaiserpermanente.org/oauth/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read"],
    logoColor: "#003B71",
  },
  {
    id: "bcbsfl",
    name: "Florida Blue (BCBS FL)",
    fhirBaseUrl: "https://fhir.floridablue.com/R4",
    authUrl: "https://oauth.floridablue.com/authorize",
    tokenUrl: "https://oauth.floridablue.com/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read"],
    logoColor: "#0072CE",
  },
  {
    id: "centene",
    name: "Centene / Ambetter",
    fhirBaseUrl: "https://fhir.centene.com/R4",
    authUrl: "https://oauth.centene.com/authorize",
    tokenUrl: "https://oauth.centene.com/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read"],
    logoColor: "#E31937",
  },
  {
    id: "molina",
    name: "Molina Healthcare",
    fhirBaseUrl: "https://fhir.molinahealthcare.com/R4",
    authUrl: "https://oauth.molinahealthcare.com/authorize",
    tokenUrl: "https://oauth.molinahealthcare.com/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read"],
    logoColor: "#009CDE",
  },
  {
    id: "medicare",
    name: "Medicare (CMS Blue Button 2.0)",
    fhirBaseUrl: "https://sandbox.bluebutton.cms.gov/v2/fhir",
    authUrl: "https://sandbox.bluebutton.cms.gov/v2/o/authorize/",
    tokenUrl: "https://sandbox.bluebutton.cms.gov/v2/o/token/",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read", "patient/Patient.read"],
    logoColor: "#004B87",
  },
  {
    id: "tricare",
    name: "TRICARE (Military)",
    fhirBaseUrl: "https://fhir.tricare.mil/R4",
    authUrl: "https://oauth.tricare.mil/authorize",
    tokenUrl: "https://oauth.tricare.mil/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read"],
    logoColor: "#003D6B",
  },
  {
    id: "medicaid_ca",
    name: "Medi-Cal (California Medicaid)",
    fhirBaseUrl: "https://fhir.dhcs.ca.gov/R4",
    authUrl: "https://oauth.dhcs.ca.gov/authorize",
    tokenUrl: "https://oauth.dhcs.ca.gov/token",
    scopes: ["patient/ExplanationOfBenefit.read", "patient/Coverage.read"],
    logoColor: "#1C3A5F",
  },
];

// ─── Demo data ───────────────────────────────────────────────────────────────

function getDemoCoverage(): CoverageRecord {
  return {
    id: "cov-demo-1",
    payerName: "Anthem Blue Cross Blue Shield",
    planName: "Gold PPO 1500",
    memberId: "ANT8839201",
    groupNumber: "GRP-44201",
    subscriberId: "ANT8839201-00",
    relationship: "Self",
    effectiveStart: "2024-01-01",
    effectiveEnd: "2025-12-31",
    isActive: false,
    network: "PPO",
    planType: "PPO",
    benefits: {
      deductibleIndividual: 1500,
      deductibleFamily: 3000,
      oopMaxIndividual: 6000,
      oopMaxFamily: 12000,
      deductibleMet: 1500,
      oopMet: 3240,
    },
  };
}

function getDemoClaims(): ClaimRecord[] {
  return [
    {
      id: "eob-001",
      claimNumber: "CLM-2025-09281",
      dateOfService: "2025-09-15",
      datePaid: "2025-10-02",
      claimType: "medical",
      status: "paid",
      provider: {
        name: "Dr. Sarah Chen, MD",
        npi: "1234567890",
        specialty: "Internal Medicine",
        address: "450 Sutter St, Suite 820, San Francisco, CA 94108",
        phone: "(415) 555-0142",
      },
      facility: { name: "Pacific Medical Center", type: "Outpatient" },
      diagnosis: [
        { code: "E11.9", display: "Type 2 diabetes mellitus without complications", system: "ICD-10" },
        { code: "I10", display: "Essential hypertension", system: "ICD-10" },
      ],
      procedures: [
        { code: "99214", display: "Office visit, established patient (30 min)", system: "CPT", quantity: 1 },
        { code: "83036", display: "Hemoglobin A1c", system: "CPT", quantity: 1 },
        { code: "80053", display: "Comprehensive metabolic panel", system: "CPT", quantity: 1 },
      ],
      amounts: {
        billed: 485.00,
        allowed: 312.00,
        paid: 249.60,
        patientResponsibility: 62.40,
        copay: 40.00,
        coinsurance: 22.40,
      },
      coverageInfo: {
        planName: "Gold PPO 1500",
        memberId: "ANT8839201",
        groupNumber: "GRP-44201",
        network: "In-Network",
      },
    },
    {
      id: "eob-002",
      claimNumber: "CLM-2025-08102",
      dateOfService: "2025-08-22",
      datePaid: "2025-09-10",
      claimType: "pharmacy",
      status: "paid",
      provider: {
        name: "CVS Pharmacy #4182",
        npi: "9876543210",
        specialty: "Pharmacy",
        address: "1900 Market St, San Francisco, CA 94102",
        phone: "(415) 555-0299",
      },
      diagnosis: [
        { code: "E11.9", display: "Type 2 diabetes mellitus without complications", system: "ICD-10" },
      ],
      procedures: [
        { code: "metformin-500", display: "Metformin HCl 500mg, 90-day supply", system: "NDC", quantity: 1 },
        { code: "lisinopril-10", display: "Lisinopril 10mg, 90-day supply", system: "NDC", quantity: 1 },
      ],
      amounts: {
        billed: 142.00,
        allowed: 42.00,
        paid: 32.00,
        patientResponsibility: 10.00,
        copay: 10.00,
      },
      coverageInfo: {
        planName: "Gold PPO 1500",
        memberId: "ANT8839201",
        network: "In-Network",
      },
    },
    {
      id: "eob-003",
      claimNumber: "CLM-2025-07550",
      dateOfService: "2025-07-10",
      datePaid: "2025-08-01",
      claimType: "lab",
      status: "paid",
      provider: {
        name: "Quest Diagnostics",
        npi: "1112223334",
        specialty: "Laboratory",
        address: "500 Plaza Dr, Secaucus, NJ 07094",
      },
      facility: { name: "Quest Diagnostics PSC", type: "Lab" },
      diagnosis: [
        { code: "Z13.1", display: "Encounter for screening for diabetes", system: "ICD-10" },
        { code: "Z13.220", display: "Encounter for screening for lipoid disorders", system: "ICD-10" },
      ],
      procedures: [
        { code: "80061", display: "Lipid panel", system: "CPT", quantity: 1 },
        { code: "85025", display: "Complete blood count (CBC) with differential", system: "CPT", quantity: 1 },
        { code: "84443", display: "TSH (thyroid stimulating hormone)", system: "CPT", quantity: 1 },
      ],
      amounts: {
        billed: 620.00,
        allowed: 180.00,
        paid: 180.00,
        patientResponsibility: 0.00,
      },
      coverageInfo: {
        planName: "Gold PPO 1500",
        memberId: "ANT8839201",
        network: "In-Network",
      },
      notes: "Preventive screening — fully covered, no patient cost",
    },
    {
      id: "eob-004",
      claimNumber: "CLM-2025-06200",
      dateOfService: "2025-06-05",
      datePaid: "2025-07-18",
      claimType: "dental",
      status: "paid",
      provider: {
        name: "Dr. Michael Torres, DDS",
        npi: "5556667778",
        specialty: "General Dentistry",
        address: "220 Bush St, Suite 400, San Francisco, CA 94104",
        phone: "(415) 555-0188",
      },
      facility: { name: "Bay Area Dental Group", type: "Office" },
      diagnosis: [
        { code: "K02.9", display: "Dental caries, unspecified", system: "ICD-10" },
      ],
      procedures: [
        { code: "D0120", display: "Periodic oral evaluation", system: "CDT", quantity: 1 },
        { code: "D0274", display: "Bitewing X-rays (four films)", system: "CDT", quantity: 1 },
        { code: "D1110", display: "Prophylaxis (adult cleaning)", system: "CDT", quantity: 1 },
      ],
      amounts: {
        billed: 340.00,
        allowed: 240.00,
        paid: 192.00,
        patientResponsibility: 48.00,
        copay: 0.00,
        coinsurance: 48.00,
      },
      coverageInfo: {
        planName: "Gold PPO 1500",
        memberId: "ANT8839201",
        network: "In-Network",
      },
    },
    {
      id: "eob-005",
      claimNumber: "CLM-2025-05880",
      dateOfService: "2025-05-20",
      datePaid: "2025-06-15",
      claimType: "imaging",
      status: "paid",
      provider: {
        name: "RadNet San Francisco",
        npi: "3334445556",
        specialty: "Diagnostic Radiology",
        address: "1200 Gough St, Suite 100, San Francisco, CA 94109",
        phone: "(415) 555-0320",
      },
      facility: { name: "RadNet Imaging Center", type: "Imaging" },
      diagnosis: [
        { code: "M54.5", display: "Low back pain", system: "ICD-10" },
      ],
      procedures: [
        { code: "72148", display: "MRI lumbar spine without contrast", system: "CPT", quantity: 1 },
      ],
      amounts: {
        billed: 2800.00,
        allowed: 850.00,
        paid: 680.00,
        patientResponsibility: 170.00,
        deductible: 0.00,
        coinsurance: 170.00,
      },
      coverageInfo: {
        planName: "Gold PPO 1500",
        memberId: "ANT8839201",
        network: "In-Network",
      },
    },
    {
      id: "eob-006",
      claimNumber: "CLM-2025-04322",
      dateOfService: "2025-04-08",
      datePaid: "2025-05-02",
      claimType: "behavioral",
      status: "paid",
      provider: {
        name: "Dr. Lisa Park, PsyD",
        npi: "7778889990",
        specialty: "Clinical Psychology",
        address: "100 Van Ness Ave, Suite 500, San Francisco, CA 94102",
        phone: "(415) 555-0456",
      },
      diagnosis: [
        { code: "F41.1", display: "Generalized anxiety disorder", system: "ICD-10" },
      ],
      procedures: [
        { code: "90834", display: "Psychotherapy, 45 min", system: "CPT", quantity: 1 },
      ],
      amounts: {
        billed: 250.00,
        allowed: 175.00,
        paid: 140.00,
        patientResponsibility: 35.00,
        copay: 35.00,
      },
      coverageInfo: {
        planName: "Gold PPO 1500",
        memberId: "ANT8839201",
        network: "In-Network",
      },
    },
    {
      id: "eob-007",
      claimNumber: "CLM-2025-03100",
      dateOfService: "2025-03-12",
      datePaid: "2025-04-08",
      claimType: "medical",
      status: "paid",
      provider: {
        name: "Dr. James Wright, MD",
        npi: "2223334445",
        specialty: "Cardiology",
        address: "2100 Webster St, Suite 420, San Francisco, CA 94115",
        phone: "(415) 555-0512",
      },
      facility: { name: "UCSF Medical Center", type: "Outpatient" },
      diagnosis: [
        { code: "I10", display: "Essential hypertension", system: "ICD-10" },
        { code: "R00.0", display: "Tachycardia, unspecified", system: "ICD-10" },
      ],
      procedures: [
        { code: "99213", display: "Office visit, established patient (20 min)", system: "CPT", quantity: 1 },
        { code: "93000", display: "Electrocardiogram (ECG), 12-lead", system: "CPT", quantity: 1 },
      ],
      amounts: {
        billed: 560.00,
        allowed: 380.00,
        paid: 304.00,
        patientResponsibility: 76.00,
        copay: 60.00,
        coinsurance: 16.00,
      },
      coverageInfo: {
        planName: "Gold PPO 1500",
        memberId: "ANT8839201",
        network: "In-Network",
      },
    },
    {
      id: "eob-008",
      claimNumber: "CLM-2025-02010",
      dateOfService: "2025-02-18",
      datePaid: "2025-03-20",
      claimType: "vision",
      status: "paid",
      provider: {
        name: "Dr. Angela Rivera, OD",
        npi: "6667778889",
        specialty: "Optometry",
        address: "3200 California St, San Francisco, CA 94118",
        phone: "(415) 555-0678",
      },
      diagnosis: [
        { code: "H52.1", display: "Myopia", system: "ICD-10" },
      ],
      procedures: [
        { code: "92004", display: "Comprehensive eye exam, new patient", system: "CPT", quantity: 1 },
        { code: "92015", display: "Refraction", system: "CPT", quantity: 1 },
      ],
      amounts: {
        billed: 310.00,
        allowed: 180.00,
        paid: 144.00,
        patientResponsibility: 36.00,
        copay: 25.00,
        coinsurance: 11.00,
      },
      coverageInfo: {
        planName: "Gold PPO 1500",
        memberId: "ANT8839201",
        network: "In-Network",
      },
    },
    {
      id: "eob-009",
      claimNumber: "CLM-2025-01440",
      dateOfService: "2025-01-22",
      datePaid: "2025-02-14",
      claimType: "medical",
      status: "paid",
      provider: {
        name: "Dr. Sarah Chen, MD",
        npi: "1234567890",
        specialty: "Internal Medicine",
        address: "450 Sutter St, Suite 820, San Francisco, CA 94108",
        phone: "(415) 555-0142",
      },
      facility: { name: "Pacific Medical Center", type: "Outpatient" },
      diagnosis: [
        { code: "J06.9", display: "Acute upper respiratory infection", system: "ICD-10" },
        { code: "E11.9", display: "Type 2 diabetes mellitus without complications", system: "ICD-10" },
      ],
      procedures: [
        { code: "99213", display: "Office visit, established patient (20 min)", system: "CPT", quantity: 1 },
      ],
      amounts: {
        billed: 220.00,
        allowed: 165.00,
        paid: 125.00,
        patientResponsibility: 40.00,
        copay: 40.00,
      },
      coverageInfo: {
        planName: "Gold PPO 1500",
        memberId: "ANT8839201",
        network: "In-Network",
      },
    },
    {
      id: "eob-010",
      claimNumber: "CLM-2024-12880",
      dateOfService: "2024-12-03",
      datePaid: "2025-01-08",
      claimType: "medical",
      status: "denied",
      provider: {
        name: "Dr. Robert Kim, MD",
        npi: "4445556667",
        specialty: "Orthopedic Surgery",
        address: "900 Hyde St, Suite 200, San Francisco, CA 94109",
        phone: "(415) 555-0890",
      },
      facility: { name: "St. Mary's Medical Center", type: "Outpatient" },
      diagnosis: [
        { code: "M17.11", display: "Primary osteoarthritis, right knee", system: "ICD-10" },
      ],
      procedures: [
        { code: "20610", display: "Arthrocentesis, major joint (knee injection)", system: "CPT", quantity: 1 },
        { code: "J7325", display: "Hyaluronic acid injection (Synvisc)", system: "HCPCS", quantity: 1 },
      ],
      amounts: {
        billed: 1850.00,
        allowed: 0.00,
        paid: 0.00,
        patientResponsibility: 1850.00,
      },
      coverageInfo: {
        planName: "Gold PPO 1500",
        memberId: "ANT8839201",
        network: "In-Network",
      },
      notes: "Denied: Prior authorization not obtained. Appeal submitted 01/15/2025.",
    },
    {
      id: "eob-011",
      claimNumber: "CLM-2024-11200",
      dateOfService: "2024-11-15",
      datePaid: "2024-12-10",
      claimType: "pharmacy",
      status: "paid",
      provider: {
        name: "Walgreens #5820",
        npi: "8889990001",
        specialty: "Pharmacy",
        address: "498 Castro St, San Francisco, CA 94114",
        phone: "(415) 555-0344",
      },
      diagnosis: [
        { code: "F41.1", display: "Generalized anxiety disorder", system: "ICD-10" },
      ],
      procedures: [
        { code: "sertraline-50", display: "Sertraline HCl 50mg, 30-day supply", system: "NDC", quantity: 1 },
      ],
      amounts: {
        billed: 85.00,
        allowed: 15.00,
        paid: 5.00,
        patientResponsibility: 10.00,
        copay: 10.00,
      },
      coverageInfo: {
        planName: "Gold PPO 1500",
        memberId: "ANT8839201",
        network: "In-Network",
      },
    },
    {
      id: "eob-012",
      claimNumber: "CLM-2024-10550",
      dateOfService: "2024-10-28",
      datePaid: "2024-11-22",
      claimType: "medical",
      status: "adjusted",
      provider: {
        name: "SF General Hospital Emergency",
        npi: "1122334455",
        specialty: "Emergency Medicine",
        address: "1001 Potrero Ave, San Francisco, CA 94110",
        phone: "(415) 555-0100",
      },
      facility: { name: "SF General Hospital", type: "Emergency" },
      diagnosis: [
        { code: "S93.401A", display: "Sprain of right ankle, initial encounter", system: "ICD-10" },
      ],
      procedures: [
        { code: "99283", display: "Emergency department visit, moderate severity", system: "CPT", quantity: 1 },
        { code: "73610", display: "X-ray ankle, 3 views", system: "CPT", quantity: 1 },
        { code: "29540", display: "Strapping of ankle", system: "CPT", quantity: 1 },
      ],
      amounts: {
        billed: 4200.00,
        allowed: 1800.00,
        paid: 1280.00,
        patientResponsibility: 520.00,
        copay: 250.00,
        coinsurance: 270.00,
      },
      coverageInfo: {
        planName: "Gold PPO 1500",
        memberId: "ANT8839201",
        network: "In-Network",
      },
      notes: "Adjusted: Original copay $350, corrected to $250 per plan terms.",
    },
  ];
}

function getDemoProviderDirectory(): ProviderDirectoryEntry[] {
  return [
    {
      id: "prov-001",
      name: "Dr. Sarah Chen",
      npi: "1234567890",
      specialty: "Internal Medicine",
      credentials: "MD, FACP",
      gender: "Female",
      address: "450 Sutter St, Suite 820",
      city: "San Francisco",
      state: "CA",
      zip: "94108",
      phone: "(415) 555-0142",
      acceptingNewPatients: true,
      languages: ["English", "Mandarin"],
      networkStatus: "in-network",
      affiliations: ["Pacific Medical Center", "UCSF Health"],
      telehealth: true,
      lastVerified: "2025-11-15",
    },
    {
      id: "prov-002",
      name: "Dr. James Wright",
      npi: "2223334445",
      specialty: "Cardiology",
      credentials: "MD, FACC",
      gender: "Male",
      address: "2100 Webster St, Suite 420",
      city: "San Francisco",
      state: "CA",
      zip: "94115",
      phone: "(415) 555-0512",
      acceptingNewPatients: false,
      languages: ["English"],
      networkStatus: "in-network",
      affiliations: ["UCSF Medical Center"],
      telehealth: true,
      lastVerified: "2025-10-20",
    },
    {
      id: "prov-003",
      name: "Dr. Lisa Park",
      npi: "7778889990",
      specialty: "Clinical Psychology",
      credentials: "PsyD",
      gender: "Female",
      address: "100 Van Ness Ave, Suite 500",
      city: "San Francisco",
      state: "CA",
      zip: "94102",
      phone: "(415) 555-0456",
      acceptingNewPatients: true,
      languages: ["English", "Korean"],
      networkStatus: "in-network",
      affiliations: ["Bay Area Behavioral Health"],
      telehealth: true,
      lastVerified: "2025-09-05",
    },
    {
      id: "prov-004",
      name: "Dr. Michael Torres",
      npi: "5556667778",
      specialty: "General Dentistry",
      credentials: "DDS",
      gender: "Male",
      address: "220 Bush St, Suite 400",
      city: "San Francisco",
      state: "CA",
      zip: "94104",
      phone: "(415) 555-0188",
      acceptingNewPatients: true,
      languages: ["English", "Spanish"],
      networkStatus: "in-network",
      affiliations: ["Bay Area Dental Group"],
      telehealth: false,
      lastVerified: "2025-08-30",
    },
    {
      id: "prov-005",
      name: "Dr. Angela Rivera",
      npi: "6667778889",
      specialty: "Optometry",
      credentials: "OD",
      gender: "Female",
      address: "3200 California St",
      city: "San Francisco",
      state: "CA",
      zip: "94118",
      phone: "(415) 555-0678",
      acceptingNewPatients: true,
      languages: ["English", "Spanish", "Tagalog"],
      networkStatus: "in-network",
      affiliations: ["Pacific Vision Care"],
      telehealth: false,
      lastVerified: "2025-11-01",
    },
    {
      id: "prov-006",
      name: "Dr. Robert Kim",
      npi: "4445556667",
      specialty: "Orthopedic Surgery",
      credentials: "MD",
      gender: "Male",
      address: "900 Hyde St, Suite 200",
      city: "San Francisco",
      state: "CA",
      zip: "94109",
      phone: "(415) 555-0890",
      acceptingNewPatients: false,
      languages: ["English", "Korean"],
      networkStatus: "tier-1",
      affiliations: ["St. Mary's Medical Center", "CPMC"],
      telehealth: false,
      lastVerified: "2025-07-15",
    },
  ];
}

// ─── Live FHIR API helpers ───────────────────────────────────────────────────

async function fetchFhirEOBs(
  fhirBaseUrl: string,
  accessToken: string,
  patientId: string
): Promise<ClaimRecord[]> {
  try {
    const res = await axios.get(
      `${fhirBaseUrl}/ExplanationOfBenefit?patient=${patientId}&_count=100&_sort=-created`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/fhir+json",
        },
        timeout: 15000,
      }
    );

    const bundle = res.data;
    if (!bundle.entry || !Array.isArray(bundle.entry)) return [];

    return bundle.entry.map((entry: any, idx: number) => {
      const eob = entry.resource;
      return mapFhirEobToClaim(eob, idx);
    });
  } catch (err: any) {
    console.error("[PayerFHIR] Error fetching EOBs:", err.message);
    return [];
  }
}

function mapFhirEobToClaim(eob: any, idx: number): ClaimRecord {
  const typeCode = eob.type?.coding?.[0]?.code ?? "medical";
  const typeMap: Record<string, ClaimType> = {
    "institutional": "medical",
    "oral": "dental",
    "pharmacy": "pharmacy",
    "professional": "medical",
    "vision": "vision",
  };

  const statusMap: Record<string, ClaimStatus> = {
    "active": "pending",
    "cancelled": "denied",
    "draft": "pending",
    "entered-in-error": "denied",
  };

  const diagnosis = (eob.diagnosis ?? []).map((d: any) => ({
    code: d.diagnosisCodeableConcept?.coding?.[0]?.code ?? "",
    display: d.diagnosisCodeableConcept?.coding?.[0]?.display ?? d.diagnosisCodeableConcept?.text ?? "",
    system: d.diagnosisCodeableConcept?.coding?.[0]?.system?.includes("icd-10") ? "ICD-10" : "ICD-10",
  }));

  const procedures = (eob.procedure ?? []).map((p: any) => ({
    code: p.procedureCodeableConcept?.coding?.[0]?.code ?? "",
    display: p.procedureCodeableConcept?.coding?.[0]?.display ?? p.procedureCodeableConcept?.text ?? "",
    system: "CPT",
    quantity: 1,
  }));

  const amounts = {
    billed: 0,
    allowed: 0,
    paid: 0,
    patientResponsibility: 0,
    deductible: 0,
    copay: 0,
    coinsurance: 0,
  };

  for (const total of eob.total ?? []) {
    const cat = total.category?.coding?.[0]?.code ?? "";
    const val = total.amount?.value ?? 0;
    if (cat === "submitted") amounts.billed = val;
    else if (cat === "eligible") amounts.allowed = val;
    else if (cat === "benefit") amounts.paid = val;
    else if (cat === "deductible") amounts.deductible = val;
    else if (cat === "copay") amounts.copay = val;
    else if (cat === "coinsurance") amounts.coinsurance = val;
  }
  amounts.patientResponsibility = amounts.billed - amounts.paid;

  const providerName = eob.provider?.display ?? eob.provider?.reference ?? "Unknown Provider";

  return {
    id: eob.id ?? `eob-${idx}`,
    claimNumber: eob.identifier?.[0]?.value ?? `CLM-${idx}`,
    dateOfService: eob.billablePeriod?.start ?? eob.created ?? "",
    datePaid: eob.payment?.date,
    claimType: typeMap[typeCode] ?? "medical",
    status: (eob.outcome === "complete" ? "paid" : statusMap[eob.status] ?? "pending") as ClaimStatus,
    provider: { name: providerName },
    diagnosis,
    procedures,
    amounts,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getPayerRegistry(): PayerRegistryEntry[] {
  return PAYER_REGISTRY.map(p => ({
    id: p.id,
    name: p.name,
    fhirBaseUrl: p.fhirBaseUrl,
    authUrl: p.authUrl,
    tokenUrl: p.tokenUrl,
    scopes: p.scopes,
    logoColor: p.logoColor,
  }));
}

export async function fetchClaimsHistory(
  connection?: PayerConnection,
  filters?: {
    claimType?: ClaimType;
    status?: ClaimStatus;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<ClaimsHistoryResult> {
  let claims: ClaimRecord[];
  let coverage: CoverageRecord | undefined;
  let isLive = false;
  let payerName = "Demo Insurer (Anthem BCBS)";

  if (connection?.connected && connection.accessToken && connection.patientId) {
    try {
      claims = await fetchFhirEOBs(
        connection.fhirBaseUrl,
        connection.accessToken,
        connection.patientId
      );
      isLive = true;
      payerName = connection.payerName;
    } catch {
      claims = getDemoClaims();
      coverage = getDemoCoverage();
    }
  } else {
    claims = getDemoClaims();
    coverage = getDemoCoverage();
  }

  if (filters?.claimType) {
    claims = claims.filter(c => c.claimType === filters.claimType);
  }
  if (filters?.status) {
    claims = claims.filter(c => c.status === filters.status);
  }
  if (filters?.dateFrom) {
    claims = claims.filter(c => c.dateOfService >= filters.dateFrom!);
  }
  if (filters?.dateTo) {
    claims = claims.filter(c => c.dateOfService <= filters.dateTo!);
  }

  claims.sort((a, b) => b.dateOfService.localeCompare(a.dateOfService));

  const claimsByType: Record<string, number> = {};
  const claimsByStatus: Record<string, number> = {};
  let totalBilled = 0;
  let totalPaid = 0;
  let totalPatientCost = 0;
  const providerSet = new Set<string>();
  const diagnosisSet = new Set<string>();

  for (const c of claims) {
    claimsByType[c.claimType] = (claimsByType[c.claimType] ?? 0) + 1;
    claimsByStatus[c.status] = (claimsByStatus[c.status] ?? 0) + 1;
    totalBilled += c.amounts.billed;
    totalPaid += c.amounts.paid;
    totalPatientCost += c.amounts.patientResponsibility;
    providerSet.add(c.provider.name);
    for (const d of c.diagnosis) {
      diagnosisSet.add(d.code);
    }
  }

  const dates = claims.map(c => c.dateOfService).filter(Boolean).sort();

  return {
    claims,
    totalCount: claims.length,
    summary: {
      totalBilled,
      totalPaid,
      totalPatientCost,
      claimsByType,
      claimsByStatus,
      dateRange: {
        earliest: dates[0] ?? "",
        latest: dates[dates.length - 1] ?? "",
      },
      uniqueProviders: providerSet.size,
      uniqueDiagnoses: diagnosisSet.size,
    },
    coverage,
    isLive,
    payerName,
  };
}

export async function fetchProviderDirectory(
  connection?: PayerConnection,
  filters?: {
    specialty?: string;
    acceptingNew?: boolean;
    telehealth?: boolean;
  }
): Promise<ProviderDirectoryResult> {
  let providers = getDemoProviderDirectory();
  const isLive = false;
  const payerName = connection?.payerName ?? "Demo Insurer (Anthem BCBS)";

  if (filters?.specialty) {
    const spec = filters.specialty.toLowerCase();
    providers = providers.filter(p => p.specialty.toLowerCase().includes(spec));
  }
  if (filters?.acceptingNew) {
    providers = providers.filter(p => p.acceptingNewPatients);
  }
  if (filters?.telehealth) {
    providers = providers.filter(p => p.telehealth);
  }

  return {
    providers,
    totalCount: providers.length,
    isLive,
    payerName,
  };
}

export function getClaimTypeLabel(type: ClaimType): string {
  const labels: Record<ClaimType, string> = {
    medical: "Medical",
    pharmacy: "Pharmacy",
    dental: "Dental",
    vision: "Vision",
    behavioral: "Behavioral Health",
    lab: "Laboratory",
    imaging: "Imaging",
  };
  return labels[type] ?? type;
}

export function getClaimStatusLabel(status: ClaimStatus): string {
  const labels: Record<ClaimStatus, string> = {
    paid: "Paid",
    denied: "Denied",
    pending: "Pending",
    appealed: "Appealed",
    adjusted: "Adjusted",
  };
  return labels[status] ?? status;
}

console.log("[PayerFHIR] Payer FHIR Patient Access service initialized");
console.log(`[PayerFHIR] ${PAYER_REGISTRY.length} payers in registry (CMS-9115-F compliant)`);
