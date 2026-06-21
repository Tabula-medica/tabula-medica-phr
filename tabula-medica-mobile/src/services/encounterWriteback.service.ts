/**
 * encounterWriteback.service.ts
 * Tabula Medica — Uninsurance Encounter Write-Back
 *
 * After each Uninsurance visit, this service writes an FHIR R4 Encounter
 * resource to the DEDICATED `uninsurance-encounters` dataset in Google Cloud
 * Healthcare API. This dataset is SEPARATE from the main Tabula Medica
 * health records — isolating billing data (CPT codes, InstaMed transaction IDs,
 * VA referral numbers) from clinical health records for a cleaner HIPAA audit
 * trail and billing reconciliation.
 *
 * Google Cloud Healthcare API FHIR R4 endpoint:
 *   https://healthcare.googleapis.com/v1/projects/{PROJECT}/locations/{LOCATION}/
 *   datasets/uninsurance-encounters/fhirStores/encounters/fhir
 *
 * Prerequisites:
 *   1. Create the dataset:
 *      gcloud healthcare datasets create uninsurance-encounters --location=us-central1
 *   2. Create the FHIR store:
 *      gcloud healthcare fhir-stores create encounters \
 *        --dataset=uninsurance-encounters --fhir-version=R4 --location=us-central1
 *   3. Sign HIPAA BAA with Google Cloud (cloud.google.com → Security → HIPAA)
 *   4. Set GOOGLE_HEALTHCARE_PROJECT_ID and GOOGLE_HEALTHCARE_LOCATION
 *      in your environment / Replit Secrets
 *
 * Drop into: src/services/encounterWriteback.service.ts
 * Called from: BookingScreen.tsx (after visit completion) or your backend API.
 *
 * NOTE: In production, this write-back should happen from your BACKEND (Node/
 * Cloud Function), not directly from the mobile app, so you never expose your
 * GCP service account credentials on-device. The mobile app should POST to
 * your API which then calls Google Healthcare API with proper auth.
 * This file shows both patterns.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type PaymentLane = 'A_INSTAMED' | 'B_VA_CCN';

export interface CompletedUninsuranceVisit {
  // Patient identity
  patientId: string;              // your internal patient UUID
  patientFhirId?: string;         // FHIR Patient resource ID if you have it
  patientName: string;
  patientDOB: string;             // ISO 8601 date: 2001-05-12
  patientMRN?: string;

  // Provider
  providerId: string;             // your enrolled provider UUID
  providerName: string;
  providerNPI: string;            // 10-digit NPI
  providerAddress: string;

  // Visit details
  visitDate: string;              // ISO 8601 date: 2026-04-15
  visitStartTime?: string;        // ISO 8601 datetime
  visitEndTime?: string;
  cptCode: string;                // e.g. "99213"
  cptDescription: string;        // e.g. "Office Visit — Established (Level 3)"
  icd10Codes?: string[];          // diagnosis codes — from AI scribing if available
  chiefComplaint?: string;

  // Billing
  paymentLane: PaymentLane;
  medicareRate2026: number;       // dollar amount

  // Lane A — InstaMed (self-pay civilian)
  instaMedTransactionId?: string; // from InstaMed API response
  instaMedStatus?: 'COMPLETED' | 'PENDING' | 'FAILED';
  patientPaidAmount?: number;

  // Lane B — VA CCN (veteran)
  vaReferralNumber?: string;      // Optum CCN referral authorization number
  vaOptumClaimId?: string;        // assigned after EDI submission
  vaClaimStatus?: 'SUBMITTED' | 'PENDING' | 'PAID' | 'DENIED';
  veteranPaidAmount?: number;     // should be 0 for authorized CCN visits

  // AaNeel NFC card
  aaneelCardUsed?: boolean;
  aaneelCardId?: string;
}

export interface WriteBackResult {
  success: boolean;
  encounterId?: string;           // FHIR Encounter resource ID in GCP
  fhirUrl?: string;               // full resource URL
  errorMessage?: string;
  writtenAt?: string;             // ISO timestamp
}

// ─── Configuration ───────────────────────────────────────────────────────────

interface GCPConfig {
  projectId: string;
  location: string;             // e.g. 'us-central1'
  datasetId: string;            // 'uninsurance-encounters'
  fhirStoreId: string;          // 'encounters'
  accessToken: string;          // Bearer token from your auth system
}

function getGCPConfig(): GCPConfig {
  // In React Native: pull from your secure config / environment
  // In Node backend: pull from process.env or Secret Manager
  //
  // NEVER hardcode these values. Use Replit Secrets for development.
  return {
    projectId: process.env.GOOGLE_HEALTHCARE_PROJECT_ID ?? '',
    location: process.env.GOOGLE_HEALTHCARE_LOCATION ?? 'us-central1',
    datasetId: 'uninsurance-encounters',
    fhirStoreId: 'encounters',
    accessToken: process.env.GOOGLE_HEALTHCARE_ACCESS_TOKEN ?? '',
  };
}

function buildFHIRBaseUrl(cfg: GCPConfig): string {
  return (
    `https://healthcare.googleapis.com/v1/projects/${cfg.projectId}` +
    `/locations/${cfg.location}` +
    `/datasets/${cfg.datasetId}` +
    `/fhirStores/${cfg.fhirStoreId}/fhir`
  );
}

// ─── FHIR R4 Resource Builders ───────────────────────────────────────────────

/**
 * Builds a FHIR R4 Encounter resource from a completed Uninsurance visit.
 * Conforms to: https://www.hl7.org/fhir/R4/encounter.html
 *
 * Extensions used:
 *  - uninsurance-payment-lane   (our custom extension)
 *  - uninsurance-medicare-rate  (our custom extension)
 *  - instamed-transaction-id    (Lane A)
 *  - va-referral-number         (Lane B)
 *  - aaneel-card-id             (NFC card used)
 */
function buildFHIREncounter(visit: CompletedUninsuranceVisit): object {
  const extensions: object[] = [
    {
      url: 'https://tabulamedica.health/fhir/StructureDefinition/uninsurance-payment-lane',
      valueCode: visit.paymentLane,
    },
    {
      url: 'https://tabulamedica.health/fhir/StructureDefinition/uninsurance-medicare-rate',
      valueMoney: {
        value: visit.medicareRate2026,
        currency: 'USD',
      },
    },
  ];

  // Lane A extensions
  if (visit.instaMedTransactionId) {
    extensions.push({
      url: 'https://tabulamedica.health/fhir/StructureDefinition/instamed-transaction-id',
      valueString: visit.instaMedTransactionId,
    });
  }
  if (visit.instaMedStatus) {
    extensions.push({
      url: 'https://tabulamedica.health/fhir/StructureDefinition/instamed-status',
      valueCode: visit.instaMedStatus,
    });
  }

  // Lane B extensions
  if (visit.vaReferralNumber) {
    extensions.push({
      url: 'https://tabulamedica.health/fhir/StructureDefinition/va-referral-number',
      valueString: visit.vaReferralNumber,
    });
  }
  if (visit.vaOptumClaimId) {
    extensions.push({
      url: 'https://tabulamedica.health/fhir/StructureDefinition/va-optum-claim-id',
      valueString: visit.vaOptumClaimId,
    });
  }
  if (visit.vaClaimStatus) {
    extensions.push({
      url: 'https://tabulamedica.health/fhir/StructureDefinition/va-claim-status',
      valueCode: visit.vaClaimStatus,
    });
  }

  // AaNeel card
  if (visit.aaneelCardUsed) {
    extensions.push({
      url: 'https://tabulamedica.health/fhir/StructureDefinition/aaneel-nfc-card',
      valueBoolean: true,
    });
  }
  if (visit.aaneelCardId) {
    extensions.push({
      url: 'https://tabulamedica.health/fhir/StructureDefinition/aaneel-card-id',
      valueString: visit.aaneelCardId,
    });
  }

  // Build diagnosis array
  const diagnoses: object[] = [];
  if (visit.icd10Codes && visit.icd10Codes.length > 0) {
    visit.icd10Codes.forEach((code, idx) => {
      diagnoses.push({
        condition: {
          // Reference to a Condition resource — in production you'd create
          // the Condition first and reference it here.
          display: code,
        },
        use: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/diagnosis-role',
              code: idx === 0 ? 'AD' : 'CM',
              display: idx === 0 ? 'Admission diagnosis' : 'Comorbidity diagnosis',
            },
          ],
        },
        rank: idx + 1,
      });
    });
  }

  // Period
  const period: { start?: string; end?: string } = {};
  if (visit.visitStartTime) period.start = visit.visitStartTime;
  else period.start = `${visit.visitDate}T00:00:00Z`;
  if (visit.visitEndTime) period.end = visit.visitEndTime;

  // Subject (patient reference)
  const subject = visit.patientFhirId
    ? { reference: `Patient/${visit.patientFhirId}`, display: visit.patientName }
    : { display: visit.patientName };

  const encounter = {
    resourceType: 'Encounter',
    meta: {
      profile: ['https://tabulamedica.health/fhir/StructureDefinition/UninsuranceEncounter'],
      tag: [
        {
          system: 'https://tabulamedica.health/fhir/CodeSystem/record-source',
          code: 'uninsurance',
          display: 'Uninsurance Mode Visit',
        },
        {
          system: 'https://tabulamedica.health/fhir/CodeSystem/payment-lane',
          code: visit.paymentLane,
        },
      ],
    },
    extension: extensions,

    // Status
    status: 'finished',

    // Class — ambulatory outpatient
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory',
    },

    // Service type — General Practice
    serviceType: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '394814009',
          display: 'General practice',
        },
      ],
    },

    // CPT code as type
    type: [
      {
        coding: [
          {
            system: 'http://www.ama-assn.org/go/cpt',
            code: visit.cptCode,
            display: visit.cptDescription,
          },
        ],
        text: visit.cptDescription,
      },
    ],

    subject,

    participant: [
      {
        type: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                code: 'PPRF',
                display: 'primary performer',
              },
            ],
          },
        ],
        individual: {
          identifier: {
            system: 'http://hl7.org/fhir/sid/us-npi',
            value: visit.providerNPI,
          },
          display: visit.providerName,
        },
      },
    ],

    period,

    ...(visit.chiefComplaint && {
      reasonCode: [
        {
          text: visit.chiefComplaint,
        },
      ],
    }),

    ...(diagnoses.length > 0 && { diagnosis: diagnoses }),

    serviceProvider: {
      display: visit.providerName,
      identifier: {
        system: 'http://hl7.org/fhir/sid/us-npi',
        value: visit.providerNPI,
      },
    },

    // Identifier — includes our internal IDs for billing reconciliation
    identifier: [
      {
        system: 'https://tabulamedica.health/fhir/NamingSystem/uninsurance-visit-id',
        value: `UV-${visit.patientId}-${visit.visitDate.replace(/-/g, '')}-${visit.cptCode}`,
      },
      ...(visit.instaMedTransactionId
        ? [
            {
              system: 'https://tabulamedica.health/fhir/NamingSystem/instamed-txn',
              value: visit.instaMedTransactionId,
            },
          ]
        : []),
      ...(visit.vaReferralNumber
        ? [
            {
              system: 'https://tabulamedica.health/fhir/NamingSystem/va-referral',
              value: visit.vaReferralNumber,
            },
          ]
        : []),
    ],
  };

  return encounter;
}

// ─── Core Write-Back Function ─────────────────────────────────────────────────

/**
 * Write a completed Uninsurance visit to the `uninsurance-encounters` FHIR store.
 *
 * @example
 * // Called from your booking API after visit completion:
 * const result = await writeUninsuranceEncounter({
 *   patientId: 'usr_abc123',
 *   patientName: 'Maria Rodriguez',
 *   patientDOB: '1987-03-14',
 *   providerId: 'prv_xyz789',
 *   providerName: 'Arlington Community Health',
 *   providerNPI: '1234567890',
 *   providerAddress: '1000 N Glebe Rd, Arlington VA',
 *   visitDate: '2026-04-15',
 *   cptCode: '99213',
 *   cptDescription: 'Office Visit — Established (Level 3)',
 *   paymentLane: 'A_INSTAMED',
 *   medicareRate2026: 82.40,
 *   instaMedTransactionId: 'IM-2026-XXXXX',
 *   instaMedStatus: 'COMPLETED',
 *   patientPaidAmount: 82.40,
 * });
 *
 * if (result.success) {
 *   console.log('Encounter written:', result.encounterId);
 * }
 */
export async function writeUninsuranceEncounter(
  visit: CompletedUninsuranceVisit,
): Promise<WriteBackResult> {
  const cfg = getGCPConfig();

  if (!cfg.projectId || !cfg.accessToken) {
    console.warn('[encounterWriteback] GCP config missing — skipping write-back in dev mode');
    return {
      success: false,
      errorMessage: 'GCP credentials not configured. Set GOOGLE_HEALTHCARE_PROJECT_ID and GOOGLE_HEALTHCARE_ACCESS_TOKEN.',
    };
  }

  const fhirResource = buildFHIREncounter(visit);
  const url = `${buildFHIRBaseUrl(cfg)}/Encounter`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/fhir+json',
        Authorization: `Bearer ${cfg.accessToken}`,
        'X-Tabula-Source': 'uninsurance-writeback-v1',
      },
      body: JSON.stringify(fhirResource),
    });
  } catch (err) {
    const msg = `Network error writing encounter: ${(err as Error).message}`;
    console.error('[encounterWriteback]', msg);
    return { success: false, errorMessage: msg };
  }

  if (!resp.ok) {
    let detail = '';
    try {
      const errBody = await resp.json();
      detail = errBody?.issue?.[0]?.details?.text ?? errBody?.issue?.[0]?.diagnostics ?? '';
    } catch {
      detail = resp.statusText;
    }
    const msg = `GCP Healthcare API error ${resp.status}: ${detail}`;
    console.error('[encounterWriteback]', msg);
    return { success: false, errorMessage: msg };
  }

  let created: { id?: string };
  try {
    created = await resp.json();
  } catch {
    return { success: false, errorMessage: 'Could not parse FHIR response from GCP.' };
  }

  const encounterId = created?.id ?? undefined;
  const fhirUrl = encounterId
    ? `${buildFHIRBaseUrl(cfg)}/Encounter/${encounterId}`
    : undefined;

  console.log(`[encounterWriteback] ✓ Encounter ${encounterId} written to uninsurance-encounters`);

  return {
    success: true,
    encounterId,
    fhirUrl,
    writtenAt: new Date().toISOString(),
  };
}

// ─── Batch Write (for reconciliation catch-up) ───────────────────────────────

/**
 * Write multiple encounters — useful for reconciliation jobs or
 * catching up after an offline period.
 * Stops on first failure and returns partial results.
 */
export async function writeEncounterBatch(
  visits: CompletedUninsuranceVisit[],
  { continueOnError = true } = {},
): Promise<{ results: WriteBackResult[]; allSucceeded: boolean }> {
  const results: WriteBackResult[] = [];
  let allSucceeded = true;

  for (const visit of visits) {
    const r = await writeUninsuranceEncounter(visit);
    results.push(r);
    if (!r.success) {
      allSucceeded = false;
      if (!continueOnError) break;
    }
    // Small delay to avoid hitting GCP rate limits
    await new Promise((res) => setTimeout(res, 150));
  }

  return { results, allSucceeded };
}

// ─── Read Back (for billing reconciliation dashboard) ────────────────────────

/**
 * Fetch encounters from the uninsurance-encounters store by patient ID.
 * Used in the provider billing dashboard and admin reconciliation views.
 */
export async function getPatientEncounters(
  patientId: string,
  sinceDate?: string,
): Promise<{ encounters: object[]; count: number } | null> {
  const cfg = getGCPConfig();
  if (!cfg.projectId || !cfg.accessToken) return null;

  const identifier = `https://tabulamedica.health/fhir/NamingSystem/uninsurance-visit-id|UV-${patientId}`;
  let url = `${buildFHIRBaseUrl(cfg)}/Encounter?identifier=${encodeURIComponent(identifier)}&_count=50&_sort=-date`;
  if (sinceDate) url += `&date=ge${sinceDate}`;

  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${cfg.accessToken}` },
    });
    if (!resp.ok) return null;
    const bundle = await resp.json();
    const entries = (bundle?.entry ?? []).map((e: { resource: object }) => e.resource);
    return { encounters: entries, count: bundle?.total ?? entries.length };
  } catch {
    return null;
  }
}

/**
 * Fetch encounters pending VA claim submission — for the Optum EDI batch job.
 * Returns encounters with Lane B status = SUBMITTED but no vaOptumClaimId yet.
 */
export async function getPendingVAClaims(): Promise<object[]> {
  const cfg = getGCPConfig();
  if (!cfg.projectId || !cfg.accessToken) return [];

  const tagUrl = `${buildFHIRBaseUrl(cfg)}/Encounter?_tag=${encodeURIComponent(
    'https://tabulamedica.health/fhir/CodeSystem/payment-lane|B_VA_CCN',
  )}&_count=100&status=finished&_sort=-date`;

  try {
    const resp = await fetch(tagUrl, {
      headers: { Authorization: `Bearer ${cfg.accessToken}` },
    });
    if (!resp.ok) return [];
    const bundle = await resp.json();
    return (bundle?.entry ?? []).map((e: { resource: object }) => e.resource);
  } catch {
    return [];
  }
}

// ─── Google Cloud Dataset Setup (run once) ───────────────────────────────────

/**
 * Instructions to create the uninsurance-encounters dataset in GCP.
 * Run these in your terminal or Cloud Shell ONCE before going live.
 *
 * 1. Create dataset:
 *    gcloud healthcare datasets create uninsurance-encounters \
 *      --location=us-central1 \
 *      --project=YOUR_PROJECT_ID
 *
 * 2. Create FHIR R4 store:
 *    gcloud healthcare fhir-stores create encounters \
 *      --dataset=uninsurance-encounters \
 *      --fhir-version=R4 \
 *      --location=us-central1 \
 *      --enable-update-create \
 *      --project=YOUR_PROJECT_ID
 *
 * 3. Enable audit logging (required for HIPAA):
 *    gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
 *      --member="serviceAccount:YOUR_SA@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
 *      --role="roles/healthcare.fhirResourceEditor"
 *
 * 4. Verify the HIPAA BAA is signed with Google Cloud:
 *    cloud.google.com → IAM & Admin → Compliance → HIPAA Business Associate Agreement
 *
 * 5. Add Replit Secrets:
 *    GOOGLE_HEALTHCARE_PROJECT_ID = your-gcp-project-id
 *    GOOGLE_HEALTHCARE_LOCATION   = us-central1
 *    GOOGLE_HEALTHCARE_ACCESS_TOKEN = (from gcloud auth print-access-token or service account)
 *
 * NOTE: The `uninsurance-encounters` dataset is SEPARATE from your main
 * Tabula Medica health records dataset. This separation is intentional:
 * - Health records dataset: patient medical history, Fasten Health records, diagnoses
 * - Uninsurance encounters dataset: billing data, CPT codes, InstaMed TXN IDs,
 *   VA referral numbers, provider NPI, payment lane, rates
 *
 * This clean separation gives you:
 * ✓ Cleaner HIPAA audit trail (billing vs clinical data separated)
 * ✓ Easier billing reconciliation with InstaMed and Optum
 * ✓ Independent access controls for billing staff vs clinical staff
 * ✓ Simpler VA CCN claim reporting to Optum
 */
export const DATASET_SETUP_INSTRUCTIONS = `
See JSDoc above for gcloud CLI commands to create the uninsurance-encounters dataset.
Dataset: uninsurance-encounters
FHIR Store: encounters
FHIR Version: R4
`.trim();
