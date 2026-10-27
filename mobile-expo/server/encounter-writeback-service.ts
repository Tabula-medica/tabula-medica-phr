import { Router, Request, Response } from "express";

export type PaymentLane = "A_INSTAMED" | "B_VA_CCN";

export interface CompletedUninsuranceVisit {
  patientId: string;
  patientFhirId?: string;
  patientName: string;
  patientDOB: string;
  patientMRN?: string;
  providerId: string;
  providerName: string;
  providerNPI: string;
  providerAddress: string;
  visitDate: string;
  visitStartTime?: string;
  visitEndTime?: string;
  cptCode: string;
  cptDescription: string;
  icd10Codes?: string[];
  chiefComplaint?: string;
  paymentLane: PaymentLane;
  medicareRate2026: number;
  instaMedTransactionId?: string;
  instaMedStatus?: "COMPLETED" | "PENDING" | "FAILED";
  patientPaidAmount?: number;
  vaReferralNumber?: string;
  vaOptumClaimId?: string;
  vaClaimStatus?: "SUBMITTED" | "PENDING" | "PAID" | "DENIED";
  veteranPaidAmount?: number;
  aaneelCardUsed?: boolean;
  aaneelCardId?: string;
}

export interface WriteBackResult {
  success: boolean;
  encounterId?: string;
  fhirUrl?: string;
  errorMessage?: string;
  writtenAt?: string;
}

interface GCPConfig {
  projectId: string;
  location: string;
  datasetId: string;
  fhirStoreId: string;
  accessToken: string;
}

function getGCPConfig(): GCPConfig {
  return {
    projectId: process.env.GOOGLE_HEALTHCARE_PROJECT_ID ?? "",
    location: process.env.GOOGLE_HEALTHCARE_LOCATION ?? "us-central1",
    datasetId: "uninsurance-encounters",
    fhirStoreId: "encounters",
    accessToken: process.env.GOOGLE_HEALTHCARE_ACCESS_TOKEN ?? "",
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

function buildFHIREncounter(visit: CompletedUninsuranceVisit): object {
  const extensions: object[] = [
    { url: "https://tabulamedica.health/fhir/StructureDefinition/uninsurance-payment-lane", valueCode: visit.paymentLane },
    { url: "https://tabulamedica.health/fhir/StructureDefinition/uninsurance-medicare-rate", valueMoney: { value: visit.medicareRate2026, currency: "USD" } },
  ];

  if (visit.instaMedTransactionId) extensions.push({ url: "https://tabulamedica.health/fhir/StructureDefinition/instamed-transaction-id", valueString: visit.instaMedTransactionId });
  if (visit.instaMedStatus) extensions.push({ url: "https://tabulamedica.health/fhir/StructureDefinition/instamed-status", valueCode: visit.instaMedStatus });
  if (visit.vaReferralNumber) extensions.push({ url: "https://tabulamedica.health/fhir/StructureDefinition/va-referral-number", valueString: visit.vaReferralNumber });
  if (visit.vaOptumClaimId) extensions.push({ url: "https://tabulamedica.health/fhir/StructureDefinition/va-optum-claim-id", valueString: visit.vaOptumClaimId });
  if (visit.vaClaimStatus) extensions.push({ url: "https://tabulamedica.health/fhir/StructureDefinition/va-claim-status", valueCode: visit.vaClaimStatus });
  if (visit.aaneelCardUsed) extensions.push({ url: "https://tabulamedica.health/fhir/StructureDefinition/aaneel-nfc-card", valueBoolean: true });
  if (visit.aaneelCardId) extensions.push({ url: "https://tabulamedica.health/fhir/StructureDefinition/aaneel-card-id", valueString: visit.aaneelCardId });

  const diagnoses: object[] = [];
  if (visit.icd10Codes && visit.icd10Codes.length > 0) {
    visit.icd10Codes.forEach((code, idx) => {
      diagnoses.push({
        condition: { display: code },
        use: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/diagnosis-role", code: idx === 0 ? "AD" : "CM", display: idx === 0 ? "Admission diagnosis" : "Comorbidity diagnosis" }] },
        rank: idx + 1,
      });
    });
  }

  const period: { start?: string; end?: string } = {};
  if (visit.visitStartTime) period.start = visit.visitStartTime;
  else period.start = `${visit.visitDate}T00:00:00Z`;
  if (visit.visitEndTime) period.end = visit.visitEndTime;

  const subject = visit.patientFhirId
    ? { reference: `Patient/${visit.patientFhirId}`, display: visit.patientName }
    : { display: visit.patientName };

  return {
    resourceType: "Encounter",
    meta: {
      profile: ["https://tabulamedica.health/fhir/StructureDefinition/UninsuranceEncounter"],
      tag: [
        { system: "https://tabulamedica.health/fhir/CodeSystem/record-source", code: "uninsurance", display: "Uninsurance Mode Visit" },
        { system: "https://tabulamedica.health/fhir/CodeSystem/payment-lane", code: visit.paymentLane },
      ],
    },
    extension: extensions,
    status: "finished",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "ambulatory" },
    serviceType: { coding: [{ system: "http://snomed.info/sct", code: "394814009", display: "General practice" }] },
    type: [{ coding: [{ system: "http://www.ama-assn.org/go/cpt", code: visit.cptCode, display: visit.cptDescription }], text: visit.cptDescription }],
    subject,
    participant: [{ type: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ParticipationType", code: "PPRF", display: "primary performer" }] }], individual: { identifier: { system: "http://hl7.org/fhir/sid/us-npi", value: visit.providerNPI }, display: visit.providerName } }],
    period,
    ...(visit.chiefComplaint && { reasonCode: [{ text: visit.chiefComplaint }] }),
    ...(diagnoses.length > 0 && { diagnosis: diagnoses }),
    serviceProvider: { display: visit.providerName, identifier: { system: "http://hl7.org/fhir/sid/us-npi", value: visit.providerNPI } },
    identifier: [
      { system: "https://tabulamedica.health/fhir/NamingSystem/uninsurance-visit-id", value: `UV-${visit.patientId}-${visit.visitDate.replace(/-/g, "")}-${visit.cptCode}` },
      ...(visit.instaMedTransactionId ? [{ system: "https://tabulamedica.health/fhir/NamingSystem/instamed-txn", value: visit.instaMedTransactionId }] : []),
      ...(visit.vaReferralNumber ? [{ system: "https://tabulamedica.health/fhir/NamingSystem/va-referral", value: visit.vaReferralNumber }] : []),
    ],
  };
}

export async function writeUninsuranceEncounter(visit: CompletedUninsuranceVisit): Promise<WriteBackResult> {
  const cfg = getGCPConfig();
  if (!cfg.projectId || !cfg.accessToken) {
    console.warn("[encounterWriteback] GCP config missing — skipping write-back in dev mode");
    return { success: false, errorMessage: "GCP credentials not configured. Set GOOGLE_HEALTHCARE_PROJECT_ID and GOOGLE_HEALTHCARE_ACCESS_TOKEN." };
  }

  const fhirResource = buildFHIREncounter(visit);
  const url = `${buildFHIRBaseUrl(cfg)}/Encounter`;

  let resp: globalThis.Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/fhir+json", Authorization: `Bearer ${cfg.accessToken}`, "X-Tabula-Source": "uninsurance-writeback-v1" },
      body: JSON.stringify(fhirResource),
    });
  } catch (err) {
    const msg = `Network error writing encounter: ${(err as Error).message}`;
    console.error("[encounterWriteback]", msg);
    return { success: false, errorMessage: msg };
  }

  if (!resp.ok) {
    let detail = "";
    try { const errBody = await resp.json() as any; detail = errBody?.issue?.[0]?.details?.text ?? errBody?.issue?.[0]?.diagnostics ?? ""; } catch { detail = resp.statusText; }
    const msg = `GCP Healthcare API error ${resp.status}: ${detail}`;
    console.error("[encounterWriteback]", msg);
    return { success: false, errorMessage: msg };
  }

  let created: { id?: string };
  try { created = await resp.json() as any; } catch { return { success: false, errorMessage: "Could not parse FHIR response from GCP." }; }

  const encounterId = created?.id ?? undefined;
  const fhirUrl = encounterId ? `${buildFHIRBaseUrl(cfg)}/Encounter/${encounterId}` : undefined;
  console.log(`[encounterWriteback] Encounter ${encounterId} written to uninsurance-encounters`);
  return { success: true, encounterId, fhirUrl, writtenAt: new Date().toISOString() };
}

export async function writeEncounterBatch(visits: CompletedUninsuranceVisit[], { continueOnError = true } = {}): Promise<{ results: WriteBackResult[]; allSucceeded: boolean }> {
  const results: WriteBackResult[] = [];
  let allSucceeded = true;
  for (const visit of visits) {
    const r = await writeUninsuranceEncounter(visit);
    results.push(r);
    if (!r.success) { allSucceeded = false; if (!continueOnError) break; }
    await new Promise((res) => setTimeout(res, 150));
  }
  return { results, allSucceeded };
}

export function createEncounterWritebackRouter(): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    try {
      const visit: CompletedUninsuranceVisit = req.body;
      if (!visit.patientId || !visit.cptCode || !visit.paymentLane) {
        res.status(400).json({ error: "Missing required fields: patientId, cptCode, paymentLane" });
        return;
      }
      const result = await writeUninsuranceEncounter(visit);
      res.status(result.success ? 201 : 500).json(result);
    } catch (err) {
      res.status(500).json({ success: false, errorMessage: (err as Error).message });
    }
  });

  router.post("/batch", async (req: Request, res: Response) => {
    try {
      const { visits, continueOnError } = req.body;
      if (!Array.isArray(visits) || visits.length === 0) {
        res.status(400).json({ error: "visits array required" });
        return;
      }
      const result = await writeEncounterBatch(visits, { continueOnError: continueOnError !== false });
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, errorMessage: (err as Error).message });
    }
  });

  router.get("/fhir-preview", (req: Request, res: Response) => {
    const demoVisit: CompletedUninsuranceVisit = {
      patientId: "demo-patient-001",
      patientName: "Maria Rodriguez",
      patientDOB: "1987-03-14",
      providerId: "prv-arlington-fqhc",
      providerName: "Arlington FQHC Community Health",
      providerNPI: "1234567890",
      providerAddress: "1801 N George Mason Dr, Arlington, VA",
      visitDate: "2026-04-15",
      cptCode: "99213",
      cptDescription: "Office Visit - Established (Level 3)",
      paymentLane: "A_INSTAMED",
      medicareRate2026: 82.40,
      instaMedTransactionId: "IM-2026-DEMO-001",
      instaMedStatus: "COMPLETED",
      patientPaidAmount: 82.40,
    };
    res.json({ fhirEncounter: buildFHIREncounter(demoVisit), note: "This is a preview of the FHIR R4 Encounter resource that would be written to Google Cloud Healthcare API" });
  });

  return router;
}
