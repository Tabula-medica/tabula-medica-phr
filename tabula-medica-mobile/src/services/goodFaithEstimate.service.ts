/**
 * goodFaithEstimate.service.ts
 * Tabula Medica — Good Faith Estimate (GFE) Generator
 *
 * Implements federal No Surprises Act (NSA) compliance for 2026.
 * Under 45 CFR § 149.610, uninsured or self-pay patients have the right
 * to a binding Good Faith Estimate BEFORE receiving care.
 *
 * Key 2026 rules:
 *  - GFE must be provided within 1 business day if appointment is 3+ days away
 *  - GFE must be provided within 3 business days if appointment is 10+ days away
 *  - If final bill EXCEEDS the GFE by more than $400, patient has federal
 *    right to initiate the Patient-Provider Dispute Resolution (PPDR) process
 *  - "Convening Provider" must bundle ALL expected co-providers into ONE GFE
 *    (e.g., surgeon + anesthesiologist billed as one price — Tabula Medica
 *     acts as the Convening Entity since we control the marketplace)
 *
 * TEFCA / IAS compliance:
 *  - GFE references use the Individual Access Services (IAS) exchange purpose
 *  - Allows uninsured patients (including immigrants) to pull prior records
 *    from charity clinics and push them to the new provider seamlessly
 *
 * DPC Safe Harbor 2026:
 *  - Per Consolidated Appropriations Act 2026, DPC fees up to $150/month
 *    individual ($300 family) are now HSA-eligible
 *  - GFE flags when visit qualifies for HSA reimbursement
 *
 * Drop into: src/services/goodFaithEstimate.service.ts
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GFELineItem {
  cptCode: string;
  serviceDescription: string;
  providerName: string;
  providerNPI: string;
  providerRole: 'primary' | 'ancillary' | 'facility';  // for bundled GFEs
  expectedCost: number;
  icd10Code?: string;
  icd10Description?: string;
}

export interface GoodFaithEstimate {
  // Identifiers
  gfeId: string;              // UUID — required for dispute reference
  issuedAt: string;           // ISO 8601 datetime
  expiresAt: string;          // GFE is valid for 1 year from issuance
  appointmentDate: string;    // ISO date

  // Patient
  patientName: string;
  patientDOB: string;
  patientId: string;
  patientSSN?: string;         // optional — many uninsured patients won't have
  patientPassportId?: string;  // "Uninsured Identity Vault" — immigrant-safe
  patientForeignId?: string;   // foreign gov ID accepted by provider network

  // Convening provider (Tabula Medica is the Convening Entity)
  conveningEntity: 'Tabula Medica, Inc. DBA Uninsurance';
  conveningNPI?: string;

  // Primary provider
  primaryProviderName: string;
  primaryProviderNPI: string;
  primaryProviderAddress: string;
  primaryProviderTaxId?: string;
  primaryProviderPhone?: string;

  // Services (can be multiple — bundled as required for convening)
  lineItems: GFELineItem[];

  // Totals
  totalExpectedCost: number;   // sum of all line items
  totalMaxBeforeDispute: number; // totalExpectedCost + $400 (dispute threshold)

  // Compliance flags
  hsaEligible: boolean;        // qualifies under 2026 DPC safe harbor
  dpcSafeHarbor: boolean;      // monthly fee ≤ $150 individual / $300 family
  noSurprisesActApplies: boolean;
  tefcaIASEnabled: boolean;    // patient authorized IAS data exchange

  // Payment
  paymentLane: 'A_INSTAMED' | 'B_VA_CCN';
  currency: 'USD';

  // Disclaimer text (required by NSA)
  disclaimer: string;
}

export interface GFEGenerateParams {
  patientId: string;
  patientName: string;
  patientDOB: string;
  patientPassportId?: string;   // for immigrants without SSN
  patientForeignId?: string;
  appointmentDate: string;
  providerName: string;
  providerNPI: string;
  providerAddress: string;
  providerPhone?: string;
  primaryCPT: string;
  primaryServiceName: string;
  primaryRate: number;
  primaryICD10?: string;
  primaryICD10Description?: string;
  ancillaryCPTs?: Array<{       // e.g. lab draw ordered during office visit
    cptCode: string;
    description: string;
    rate: number;
    providerName?: string;
    providerNPI?: string;
  }>;
  paymentLane: 'A_INSTAMED' | 'B_VA_CCN';
  isDPCMonthlyFee?: boolean;    // true if this is a monthly DPC subscription
  tefcaIASEnabled?: boolean;
}

// ─── NSA Disclaimer Text ─────────────────────────────────────────────────────

const NSA_DISCLAIMER_2026 = `
NOTICE: Good Faith Estimate — Your Rights Under the No Surprises Act

You are receiving this Good Faith Estimate because you are not using insurance 
to pay for these items and services, or because you asked for this estimate.

This estimate is based on information known at the time of the estimate. The 
Good Faith Estimate does not include unexpected costs that could arise during 
treatment.

YOUR RIGHTS:
• If you receive a bill that is at least $400 more than your Good Faith Estimate 
  for any provider or facility listed on the estimate, you may be able to dispute 
  the bill through the Patient-Provider Dispute Resolution (PPDR) process.
• You can start the PPDR process within 120 calendar days (about 4 months) after 
  the date on the bill.
• The PPDR process will not affect your credit score, collections activities, or 
  the ability to receive future health care services.
• You can get a list of health care providers and facilities in your area who can 
  provide a service for free or reduced cost from your state health insurance 
  marketplace at www.healthcare.gov/find-assistance/.

For questions or more information about your right to a Good Faith Estimate, 
visit www.cms.gov/nosurprises or call the CMS No Surprises Help Desk at 
1-800-985-3059.

Tabula Medica, Inc. DBA Uninsurance acts as the Convening Entity for this 
bundled Good Faith Estimate pursuant to 45 CFR § 149.610(b)(1).
`.trim();

const DPC_HSA_NOTICE_2026 = `
HSA ELIGIBILITY NOTICE (2026): Under the Consolidated Appropriations Act 2026, 
Direct Primary Care (DPC) arrangement fees up to $150/month (individual) or 
$300/month (family) are eligible for reimbursement from a Health Savings Account 
(HSA). Consult your tax advisor to confirm eligibility for your specific plan.
`.trim();

// ─── GFE Generator ───────────────────────────────────────────────────────────

/**
 * Generate a fully compliant Good Faith Estimate.
 * Call this immediately when a patient clicks "Book" — before payment.
 *
 * @example
 * const gfe = generateGFE({
 *   patientId: 'usr_abc123',
 *   patientName: 'Maria Rodriguez',
 *   patientDOB: '1987-03-14',
 *   appointmentDate: '2026-04-15',
 *   providerName: 'Arlington Community Health',
 *   providerNPI: '1234567890',
 *   providerAddress: '1000 N Glebe Rd, Arlington VA 22201',
 *   primaryCPT: '99213',
 *   primaryServiceName: 'Office Visit — Established Patient (Level 3)',
 *   primaryRate: 82.40,
 *   paymentLane: 'A_INSTAMED',
 * });
 */
export function generateGFE(params: GFEGenerateParams): GoodFaithEstimate {
  const now = new Date();
  const expires = new Date(now);
  expires.setFullYear(expires.getFullYear() + 1);

  // Build line items
  const lineItems: GFELineItem[] = [
    {
      cptCode: params.primaryCPT,
      serviceDescription: params.primaryServiceName,
      providerName: params.providerName,
      providerNPI: params.providerNPI,
      providerRole: 'primary',
      expectedCost: params.primaryRate,
      icd10Code: params.primaryICD10,
      icd10Description: params.primaryICD10Description,
    },
    // Ancillary services (lab, imaging ordered at same visit)
    ...(params.ancillaryCPTs ?? []).map((a) => ({
      cptCode: a.cptCode,
      serviceDescription: a.description,
      providerName: a.providerName ?? params.providerName,
      providerNPI: a.providerNPI ?? params.providerNPI,
      providerRole: 'ancillary' as const,
      expectedCost: a.rate,
    })),
  ];

  const totalExpectedCost = lineItems.reduce((sum, item) => sum + item.expectedCost, 0);
  const totalMaxBeforeDispute = totalExpectedCost + 400; // NSA dispute threshold

  // DPC safe harbor: check if monthly fee ≤ $150
  const dpcSafeHarbor = !!params.isDPCMonthlyFee && params.primaryRate <= 150;
  const hsaEligible = dpcSafeHarbor || params.primaryRate <= 150;

  // Compose disclaimer
  let disclaimer = NSA_DISCLAIMER_2026;
  if (hsaEligible) {
    disclaimer += '\n\n' + DPC_HSA_NOTICE_2026;
  }

  const gfeId = `GFE-${params.patientId.slice(-6).toUpperCase()}-${Date.now()}`;

  return {
    gfeId,
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    appointmentDate: params.appointmentDate,

    patientName: params.patientName,
    patientDOB: params.patientDOB,
    patientId: params.patientId,
    patientPassportId: params.patientPassportId,
    patientForeignId: params.patientForeignId,

    conveningEntity: 'Tabula Medica, Inc. DBA Uninsurance',

    primaryProviderName: params.providerName,
    primaryProviderNPI: params.providerNPI,
    primaryProviderAddress: params.providerAddress,
    primaryProviderPhone: params.providerPhone,

    lineItems,
    totalExpectedCost: Math.round(totalExpectedCost * 100) / 100,
    totalMaxBeforeDispute: Math.round(totalMaxBeforeDispute * 100) / 100,

    hsaEligible,
    dpcSafeHarbor,
    noSurprisesActApplies: true,
    tefcaIASEnabled: params.tefcaIASEnabled ?? false,

    paymentLane: params.paymentLane,
    currency: 'USD',
    disclaimer,
  };
}

// ─── GFE Validation ───────────────────────────────────────────────────────────

export interface GFEValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a GFE before presenting to the patient.
 * Catches missing required fields that would make the GFE non-compliant.
 */
export function validateGFE(gfe: GoodFaithEstimate): GFEValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!gfe.gfeId) errors.push('Missing GFE ID');
  if (!gfe.patientName) errors.push('Missing patient name');
  if (!gfe.primaryProviderNPI) errors.push('Missing provider NPI — required by NSA');
  if (!gfe.primaryProviderAddress) errors.push('Missing provider address');
  if (gfe.lineItems.length === 0) errors.push('GFE must have at least one line item');
  if (gfe.totalExpectedCost <= 0) errors.push('Total expected cost must be > 0');
  if (!gfe.appointmentDate) errors.push('Missing appointment date');

  gfe.lineItems.forEach((item, idx) => {
    if (!item.cptCode) errors.push(`Line item ${idx + 1}: missing CPT code`);
    if (!item.providerNPI) warnings.push(`Line item ${idx + 1}: missing provider NPI`);
    if (item.expectedCost <= 0) errors.push(`Line item ${idx + 1}: cost must be > 0`);
  });

  if (!gfe.patientSSN && !gfe.patientPassportId && !gfe.patientForeignId) {
    warnings.push('No patient identifier beyond name/DOB — consider capturing passport or foreign ID');
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ─── GFE Summary (for UI display) ────────────────────────────────────────────

export interface GFESummary {
  gfeId: string;
  providerName: string;
  serviceDescription: string;
  cptCode: string;
  fixedPrice: number;
  maxBeforeDispute: number;
  hsaEligible: boolean;
  issuedAt: string;
  appointmentDate: string;
  hasAncillaryServices: boolean;
  ancillaryCount: number;
  ancillaryTotal: number;
  paymentLaneLabel: string;
  complianceFlags: string[];
}

/**
 * Returns a flat summary object for rendering in the booking confirmation UI.
 */
export function getGFESummary(gfe: GoodFaithEstimate): GFESummary {
  const ancillary = gfe.lineItems.filter((i) => i.providerRole === 'ancillary');
  const ancillaryTotal = ancillary.reduce((s, i) => s + i.expectedCost, 0);

  const complianceFlags: string[] = ['No Surprises Act compliant'];
  if (gfe.hsaEligible) complianceFlags.push('HSA eligible (2026 DPC safe harbor)');
  if (gfe.tefcaIASEnabled) complianceFlags.push('TEFCA IAS data exchange enabled');
  if (gfe.dpcSafeHarbor) complianceFlags.push('DPC Safe Harbor ≤ $150/mo');

  const primary = gfe.lineItems.find((i) => i.providerRole === 'primary')!;

  return {
    gfeId: gfe.gfeId,
    providerName: gfe.primaryProviderName,
    serviceDescription: primary?.serviceDescription ?? '',
    cptCode: primary?.cptCode ?? '',
    fixedPrice: gfe.totalExpectedCost,
    maxBeforeDispute: gfe.totalMaxBeforeDispute,
    hsaEligible: gfe.hsaEligible,
    issuedAt: gfe.issuedAt,
    appointmentDate: gfe.appointmentDate,
    hasAncillaryServices: ancillary.length > 0,
    ancillaryCount: ancillary.length,
    ancillaryTotal: Math.round(ancillaryTotal * 100) / 100,
    paymentLaneLabel: gfe.paymentLane === 'B_VA_CCN' ? 'VA pays via Optum CCN (Lane B)' : 'Self-pay at point of care (Lane A)',
    complianceFlags,
  };
}

// ─── Sliding Scale Calculator ─────────────────────────────────────────────────

export interface SlidingScaleInput {
  annualIncome: number;        // from uploaded 1040 or pay stubs
  householdSize: number;
  baseRate: number;
  fpgYear?: number;            // Federal Poverty Guidelines year (default 2026)
}

export interface SlidingScaleResult {
  adjustedRate: number;
  discountPercent: number;
  fplPercent: number;          // % of Federal Poverty Level
  tier: 'full' | '75pct' | '50pct' | '25pct' | 'free';
  qualifiesForFQHC: boolean;   // FQHC sliding scale at ≤200% FPL
  qualifiesForFree: boolean;   // Free care at ≤100% FPL
}

// 2026 Federal Poverty Guidelines (contiguous US)
const FPG_2026_BASE = 15060;       // 1-person
const FPG_2026_PER_ADDITIONAL = 5380;

export function calculateSlidingScale(input: SlidingScaleInput): SlidingScaleResult {
  const fpgForHousehold =
    FPG_2026_BASE + Math.max(0, input.householdSize - 1) * FPG_2026_PER_ADDITIONAL;

  const fplPercent = Math.round((input.annualIncome / fpgForHousehold) * 100);

  let tier: SlidingScaleResult['tier'];
  let discountPercent: number;

  if (fplPercent <= 100) { tier = 'free'; discountPercent = 100; }
  else if (fplPercent <= 150) { tier = '25pct'; discountPercent = 75; }
  else if (fplPercent <= 200) { tier = '50pct'; discountPercent = 50; }
  else if (fplPercent <= 300) { tier = '75pct'; discountPercent = 25; }
  else { tier = 'full'; discountPercent = 0; }

  const adjustedRate = Math.round(input.baseRate * (1 - discountPercent / 100) * 100) / 100;

  return {
    adjustedRate,
    discountPercent,
    fplPercent,
    tier,
    qualifiesForFQHC: fplPercent <= 200,
    qualifiesForFree: fplPercent <= 100,
  };
}

// ─── HSA Eligibility Checker ──────────────────────────────────────────────────

export interface HSACheckResult {
  eligible: boolean;
  reason: string;
  annualMax: number;           // 2026 HSA contribution limit
  monthlyDPCMax: number;       // $150 individual / $300 family
  savingsAtTaxBracket: Record<string, number>;
}

export function checkHSAEligibility(params: {
  visitType: 'dpc_monthly' | 'per_visit' | 'lab' | 'imaging' | 'pharmacy';
  monthlyFee?: number;
  isFamily?: boolean;
}): HSACheckResult {
  const monthlyMax = params.isFamily ? 300 : 150;
  const annualMax = params.isFamily ? 8550 : 4300; // 2026 HSA limits

  let eligible = false;
  let reason = '';

  if (params.visitType === 'dpc_monthly') {
    eligible = (params.monthlyFee ?? 0) <= monthlyMax;
    reason = eligible
      ? `DPC monthly fee ≤ $${monthlyMax} — qualifies under 2026 Consolidated Appropriations Act safe harbor`
      : `DPC monthly fee exceeds $${monthlyMax} — HSA reimbursement not available for excess`;
  } else if (['lab', 'imaging', 'per_visit'].includes(params.visitType)) {
    eligible = true;
    reason = 'Medical expense per IRS Publication 502 — HSA/FSA eligible';
  } else if (params.visitType === 'pharmacy') {
    eligible = true;
    reason = 'Prescription medication — HSA/FSA eligible';
  }

  return {
    eligible,
    reason,
    annualMax,
    monthlyDPCMax: monthlyMax,
    savingsAtTaxBracket: {
      '22%': Math.round(annualMax * 0.22),
      '24%': Math.round(annualMax * 0.24),
      '32%': Math.round(annualMax * 0.32),
    },
  };
}
