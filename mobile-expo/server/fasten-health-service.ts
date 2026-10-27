import { logger } from "./utils/logger";
import { db } from "./db";
import { healthRecords, dataSources, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { storage } from "./storage";

const FASTEN_API_BASE = "https://api.connect.fastenhealth.com/v2";
const FASTEN_OAUTH_TOKEN_ENDPOINT = `${FASTEN_API_BASE}/oauth/token`;
const FASTEN_EHI_EXPORT_ENDPOINT = `${FASTEN_API_BASE}/bridge/fhir/ehi-export`;

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_INITIAL_DELAY_MS = 1000;

interface FastenConfig {
  publicId: string;
  privateKey: string;
}

function getConfig(): FastenConfig | null {
  const publicId = process.env.FASTEN_PUBLIC_ID;
  const privateKey = process.env.FASTEN_PRIVATE_KEY;
  if (!publicId || !privateKey) return null;
  return { publicId, privateKey };
}

function getAuthHeader(): string | null {
  const config = getConfig();
  if (!config) return null;
  const encoded = Buffer.from(`${config.publicId}:${config.privateKey}`).toString("base64");
  return `Basic ${encoded}`;
}

export function hasFastenConfig(): boolean {
  return getConfig() !== null;
}

export function getFastenPublicId(): string | null {
  return process.env.FASTEN_PUBLIC_ID || null;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = RETRY_MAX_ATTEMPTS,
  initialDelayMs: number = RETRY_INITIAL_DELAY_MS,
  label: string = "operation"
): Promise<T> {
  let lastError: Error = new Error("Unknown error");
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        logger.warn(`Fasten ${label} attempt ${attempt} failed, retrying in ${delayMs}ms`, {
          category: "api",
          attempt,
          maxAttempts,
          error: lastError.message,
        });
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
}

export async function triggerEhiExport(orgConnectionId: string): Promise<{ taskId: string } | null> {
  const auth = getAuthHeader();
  if (!auth) {
    logger.warn("Fasten API keys not configured", { category: "api" });
    return null;
  }

  try {
    const response = await fetch(FASTEN_EHI_EXPORT_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ org_connection_id: orgConnectionId }),
    });

    if (!response.ok) {
      logger.error("Fasten EHI export trigger failed", {
        category: "api",
        status: response.status,
        orgConnectionId,
      });
      return null;
    }

    const data = await response.json() as any;
    logger.info("Fasten EHI export initiated", {
      category: "api",
      taskId: data.task_id,
      orgConnectionId,
    });
    return { taskId: data.task_id };
  } catch (error) {
    logger.error("Fasten EHI export request error", {
      category: "api",
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function exchangeAuthCode(
  code: string,
  state?: string
): Promise<{ orgConnectionId: string; accessToken: string } | null> {
  const config = getConfig();
  if (!config) {
    logger.warn("Fasten API keys not configured for OAuth exchange", { category: "authentication" });
    return null;
  }

  try {
    const redirectUri = process.env.FASTEN_REDIRECT_URI || `${process.env.EXPO_PUBLIC_DOMAIN ? 'https://' + process.env.EXPO_PUBLIC_DOMAIN : ''}/api/fasten/callback`;

    const response = await fetch(FASTEN_OAUTH_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${config.publicId}:${config.privateKey}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        state,
      }),
    });

    if (!response.ok) {
      logger.error("Fasten OAuth token exchange failed", {
        category: "authentication",
        status: response.status,
      });
      return null;
    }

    const data = await response.json() as any;

    logger.info("Fasten OAuth token exchange success", {
      category: "authentication",
      orgConnectionId: data.org_connection_id,
    });

    return {
      orgConnectionId: data.org_connection_id,
      accessToken: data.access_token,
    };
  } catch (error) {
    logger.error("Fasten OAuth token exchange error", {
      category: "authentication",
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function updateDataSourceStatus(
  dataSourceId: string,
  status: { isConnected?: boolean; lastSyncAt?: Date }
): Promise<void> {
  try {
    await db.update(dataSources).set(status).where(eq(dataSources.id, dataSourceId));
  } catch {
  }
}

export async function downloadAndImportFhirData(
  userId: string,
  downloadUrl: string,
  orgConnectionId: string,
  sourceLabel: string
): Promise<{ imported: number; errors: number; terminal: boolean }> {
  const auth = getAuthHeader();
  if (!auth) return { imported: 0, errors: 0, terminal: false };

  let imported = 0;
  let errors = 0;
  let dataSourceId: string | null = null;

  try {
    const existingSources = await db.select().from(dataSources).where(
      and(
        eq(dataSources.userId, userId),
        eq(dataSources.name, `Fasten Connect - ${sourceLabel}`)
      )
    );

    if (existingSources.length > 0) {
      dataSourceId = existingSources[0].id;
    } else {
      const [newSource] = await db.insert(dataSources).values({
        userId,
        name: `Fasten Connect - ${sourceLabel}`,
        type: "fasten_connect",
        isConnected: true,
        lastSyncAt: new Date(),
      }).returning();
      dataSourceId = newSource.id;
    }

    let text: string;
    try {
      text = await withRetry(
        async () => {
          const response = await fetch(downloadUrl, {
            headers: { "Authorization": auth },
            redirect: "follow",
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return response.text();
        },
        RETRY_MAX_ATTEMPTS,
        RETRY_INITIAL_DELAY_MS,
        "FHIR download"
      );
    } catch (downloadErr) {
      logger.error("Fasten FHIR download failed after retries", {
        category: "api",
        orgConnectionId,
        error: downloadErr instanceof Error ? downloadErr.message : String(downloadErr),
      });
      if (dataSourceId) {
        await updateDataSourceStatus(dataSourceId, { isConnected: false });
      }
      return { imported: 0, errors: 1, terminal: true };
    }

    const lines = text.split("\n").filter((l) => l.trim());

    for (const line of lines) {
      try {
        const resource = JSON.parse(line);
        const resourceType = resource.resourceType;
        if (!resourceType || resourceType === "OperationOutcome") continue;

        const recordType = mapFhirResourceToRecordType(resourceType);
        const title = extractTitle(resource, resourceType);
        const date = extractDate(resource) || new Date();
        const provider = extractProvider(resource);
        const facility = extractFacility(resource);
        const summary = extractSummary(resource, resourceType);

        await withRetry(
          async () => db.insert(healthRecords).values({
            userId,
            type: recordType,
            title,
            summary,
            date,
            provider,
            facility,
            details: resource,
            rawFhirJson: resource,
            sourceId: dataSourceId,
            fhirResourceType: resourceType,
            fhirResourceId: resource.id || null,
            importedAt: new Date(),
            lastSyncedAt: new Date(),
            isManual: false,
          }),
          2,
          200,
          "FHIR record insert"
        );
        imported++;
      } catch (insertErr) {
        errors++;
      }
    }

    if (dataSourceId) {
      await updateDataSourceStatus(dataSourceId, { lastSyncAt: new Date(), isConnected: true });
    }

    logger.info("Fasten FHIR data import completed", {
      category: "phi_access",
      userId,
      imported,
      errors,
      orgConnectionId,
    });

    if (imported > 0) {
      import("./phr-pipeline-service").then(({ runPostImportPipeline }) => {
        runPostImportPipeline(userId).then((result) => {
          logger.info("[PHR Pipeline] Post-Fasten import pipeline completed", {
            category: "pipeline",
            userId,
            duplicatesFound: result.duplicatesFound,
            duplicatesMerged: result.duplicatesMerged,
            gcsUploaded: result.gcsUploaded,
            fhirStoreUpserted: result.fhirStoreUpserted,
          });
        }).catch((pipelineErr) => {
          logger.error("[PHR Pipeline] Post-Fasten import pipeline failed", {
            category: "pipeline",
            userId,
            error: pipelineErr instanceof Error ? pipelineErr.message : String(pipelineErr),
          });
        });
      }).catch(() => {});
    }
  } catch (error) {
    logger.error("Fasten FHIR data import error", {
      category: "api",
      error: error instanceof Error ? error.message : String(error),
    });
    errors++;
  }

  return { imported, errors, terminal: false };
}

export function mapFhirResourceToRecordType(resourceType: string): string {
  const mapping: Record<string, string> = {
    Patient: "demographics",
    Condition: "condition",
    MedicationRequest: "medication",
    MedicationStatement: "medication",
    MedicationAdministration: "medication",
    MedicationDispense: "medication",
    Observation: "lab_result",
    DiagnosticReport: "lab_result",
    MolecularSequence: "lab_result",
    Procedure: "procedure",
    Encounter: "visit",
    Immunization: "immunization",
    AllergyIntolerance: "allergy",
    CarePlan: "care_plan",
    DocumentReference: "document",
    Composition: "document",
    Binary: "document",
    CareTeam: "care_team",
    Goal: "goal",
    Device: "device",
    Coverage: "insurance",
    Claim: "claim",
    ExplanationOfBenefit: "eob",
    Provenance: "provenance",
    FamilyMemberHistory: "family_history",
    Appointment: "appointment",
    ServiceRequest: "service_request",
    RelatedPerson: "related_person",
    Organization: "organization",
    Practitioner: "practitioner",
    PractitionerRole: "practitioner",
    Location: "location",
    Questionnaire: "questionnaire",
    QuestionnaireResponse: "questionnaire_response",
    Consent: "consent",
    RiskAssessment: "risk_assessment",
    NutritionOrder: "nutrition_order",
    VisionPrescription: "vision_prescription",
    Communication: "communication",
    Task: "task",
    ImagingStudy: "imaging_study",
    Media: "imaging_study",
    ClinicalImpression: "clinical_impression",
    AdverseEvent: "adverse_event",
    DetectedIssue: "clinical_note",
    ResearchStudy: "research_study",
  };
  return mapping[resourceType] || "other";
}

function extractTitle(resource: any, resourceType: string): string {
  if (resourceType === "Condition" && resource.code?.text) return resource.code.text;
  if (resourceType === "MedicationRequest" && resource.medicationCodeableConcept?.text) return resource.medicationCodeableConcept.text;
  if (resourceType === "MedicationAdministration" && resource.medicationCodeableConcept?.text) return resource.medicationCodeableConcept.text;
  if (resourceType === "MedicationDispense" && resource.medicationCodeableConcept?.text) return resource.medicationCodeableConcept.text;
  if (resourceType === "MedicationStatement" && resource.medicationCodeableConcept?.text) return resource.medicationCodeableConcept.text;
  if (resourceType === "Observation" && resource.code?.text) return resource.code.text;
  if (resourceType === "Procedure" && resource.code?.text) return resource.code.text;
  if (resourceType === "Immunization" && resource.vaccineCode?.text) return resource.vaccineCode.text;
  if (resourceType === "AllergyIntolerance" && resource.code?.text) return resource.code.text;
  if (resourceType === "DiagnosticReport" && resource.code?.text) return resource.code.text;
  if (resourceType === "Encounter" && resource.type?.[0]?.text) return resource.type[0].text;
  if (resourceType === "DocumentReference" && resource.description) return resource.description;
  if (resourceType === "FamilyMemberHistory" && resource.relationship?.text) return `Family History: ${resource.relationship.text}`;
  if (resourceType === "Appointment" && resource.serviceType?.[0]?.text) return resource.serviceType[0].text;
  if (resourceType === "ServiceRequest" && resource.code?.text) return resource.code.text;
  if (resourceType === "RelatedPerson") {
    const name = resource.name?.[0];
    if (name) return `Related Person: ${`${name.given?.join(" ") || ""} ${name.family || ""}`.trim()}`;
  }
  if (resourceType === "Organization" && resource.name) return resource.name;
  if (resourceType === "Practitioner") {
    const name = resource.name?.[0];
    if (name) return `${name.given?.join(" ") || ""} ${name.family || ""}`.trim();
  }
  if (resourceType === "Location" && resource.name) return resource.name;
  if (resourceType === "Consent" && resource.scope?.text) return `Consent: ${resource.scope.text}`;
  if (resourceType === "RiskAssessment" && resource.code?.text) return resource.code.text;
  if (resourceType === "NutritionOrder" && resource.foodPreferenceModifier?.[0]?.text) return `Nutrition Order: ${resource.foodPreferenceModifier[0].text}`;
  if (resourceType === "VisionPrescription") return "Vision Prescription";
  if (resourceType === "Communication" && resource.topic?.text) return `Communication: ${resource.topic.text}`;
  if (resourceType === "ImagingStudy" && resource.description) return resource.description;
  if (resourceType === "AdverseEvent" && resource.event?.text) return resource.event.text;
  if (resourceType === "DetectedIssue" && resource.detail) return resource.detail.substring(0, 100);
  if (resourceType === "ClinicalImpression" && resource.description) return resource.description.substring(0, 100);
  if (resourceType === "Task" && resource.description) return resource.description.substring(0, 100);
  if (resourceType === "Patient") {
    const name = resource.name?.[0];
    if (name) return `${name.given?.join(" ") || ""} ${name.family || ""}`.trim();
  }
  return `${resourceType} Record`;
}

function extractDate(resource: any): Date | null {
  const dateFields = [
    "effectiveDateTime", "issued", "recordedDate", "onsetDateTime",
    "authoredOn", "occurrenceDateTime", "date", "created",
    "period.start", "meta.lastUpdated", "dateAsserted", "start",
    "effectivePeriod.start",
  ];
  for (const field of dateFields) {
    const parts = field.split(".");
    let val = resource;
    for (const p of parts) {
      val = val?.[p];
    }
    if (val) {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  return null;
}

function extractProvider(resource: any): string | null {
  if (resource.performer?.[0]?.display) return resource.performer[0].display;
  if (resource.performer?.[0]?.actor?.display) return resource.performer[0].actor.display;
  if (resource.requester?.display) return resource.requester.display;
  if (resource.recorder?.display) return resource.recorder.display;
  if (resource.asserter?.display) return resource.asserter.display;
  if (resource.participant?.[0]?.individual?.display) return resource.participant[0].individual.display;
  if (resource.author?.[0]?.display) return resource.author[0].display;
  if (resource.prescriber?.display) return resource.prescriber.display;
  return null;
}

function extractFacility(resource: any): string | null {
  if (resource.location?.[0]?.location?.display) return resource.location[0].location.display;
  if (resource.serviceProvider?.display) return resource.serviceProvider.display;
  if (resource.managingOrganization?.display) return resource.managingOrganization.display;
  if (resource.organization?.display) return resource.organization.display;
  if (resource.performer?.[0]?.onBehalfOf?.display) return resource.performer[0].onBehalfOf.display;
  return null;
}

function extractSummary(resource: any, resourceType: string): string | null {
  if (resourceType === "Observation" && resource.valueQuantity) {
    return `${resource.valueQuantity.value} ${resource.valueQuantity.unit || ""}`.trim();
  }
  if (resourceType === "Observation" && resource.valueString) {
    return resource.valueString.substring(0, 200);
  }
  if (resourceType === "Observation" && resource.valueCodeableConcept?.text) {
    return resource.valueCodeableConcept.text;
  }
  if (resourceType === "Condition" && resource.clinicalStatus?.coding?.[0]?.code) {
    return `Status: ${resource.clinicalStatus.coding[0].code}`;
  }
  if (resourceType === "MedicationRequest" && resource.dosageInstruction?.[0]?.text) {
    return resource.dosageInstruction[0].text;
  }
  if (resourceType === "MedicationAdministration" && resource.dosage?.text) {
    return resource.dosage.text;
  }
  if (resourceType === "FamilyMemberHistory" && resource.condition?.[0]?.code?.text) {
    return resource.condition[0].code.text;
  }
  if (resourceType === "RiskAssessment" && resource.prediction?.[0]?.outcome?.text) {
    return resource.prediction[0].outcome.text;
  }
  if (resourceType === "Appointment" && resource.status) {
    return `Status: ${resource.status}`;
  }
  if (resourceType === "AdverseEvent" && resource.seriousness?.text) {
    return resource.seriousness.text;
  }
  if (resource.text?.div) {
    return resource.text.div.replace(/<[^>]*>/g, "").substring(0, 500);
  }
  return null;
}

export interface FastenWebhookPayload {
  api_mode: "test" | "live";
  date?: string;
  created_at?: string;
  id: string;
  type: string;
  livemode?: boolean;
  data: any;
}

export function getWebhookEventTimestamp(payload: FastenWebhookPayload): Date | null {
  const raw = payload.created_at || payload.date;
  if (!raw) return null;
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export async function handleWebhookEvent(payload: FastenWebhookPayload, userId?: string): Promise<{ handled: boolean; message: string }> {
  logger.info("Fasten webhook processing", {
    category: "webhook",
    eventType: payload.type,
    eventId: payload.id,
    apiMode: payload.api_mode,
  });

  switch (payload.type) {
    case "patient.ehi_export_success":
    case "patient.ehi_export_complete": {
      const { download_links, org_connection_id, stats } = payload.data;
      if (!download_links?.length) {
        return { handled: false, message: "No download links in export" };
      }

      if (!userId) {
        logger.warn("No userId for EHI export webhook - data will be queued", {
          category: "webhook",
          orgConnectionId: org_connection_id,
        });
        return { handled: true, message: "Export success received, awaiting user association" };
      }

      const downloadUrl = download_links[0].url;
      const result = await downloadAndImportFhirData(userId, downloadUrl, org_connection_id, org_connection_id);
      if (result.terminal && result.errors > 0) {
        return {
          handled: true,
          message: `Export download failed after retries for org_connection ${org_connection_id}`,
        };
      }
      return {
        handled: true,
        message: `Imported ${result.imported} records (${result.errors} errors) from ${stats?.total_resources || "unknown"} total resources`,
      };
    }

    case "patient.ehi_export_failed": {
      const { failure_reason, org_connection_id } = payload.data;
      logger.error("Fasten EHI export failed", {
        category: "webhook",
        orgConnectionId: org_connection_id,
      });
      return { handled: true, message: `Export failed: ${failure_reason || "unknown reason"}` };
    }

    case "patient.connection_success": {
      const { org_connection_id, connection_status, platform_type } = payload.data;
      logger.info("Patient connected to health system via Fasten", {
        category: "webhook",
        orgConnectionId: org_connection_id,
        status: connection_status,
        platform: platform_type,
      });

      if ((connection_status === "authorized" || connection_status === "connected") && org_connection_id) {
        await triggerEhiExport(org_connection_id);
      }

      return { handled: true, message: `Connection ${connection_status}: ${org_connection_id}` };
    }

    case "patient.connection_refreshed": {
      const { org_connection_id, refresh_status } = payload.data;
      logger.info("Fasten connection refreshed", {
        category: "webhook",
        orgConnectionId: org_connection_id,
        refreshStatus: refresh_status,
      });

      if (refresh_status === "success" && org_connection_id) {
        await triggerEhiExport(org_connection_id);
      }

      return { handled: true, message: `Connection refreshed: ${org_connection_id}` };
    }

    case "patient.token_refreshed": {
      const { org_connection_id } = payload.data;
      logger.info("Fasten patient token refreshed", {
        category: "webhook",
        orgConnectionId: org_connection_id,
      });
      return { handled: true, message: `Token refreshed for: ${org_connection_id}` };
    }

    case "patient.authorization_revoked": {
      const { org_connection_id } = payload.data;
      logger.warn("Patient authorization revoked", {
        category: "webhook",
        orgConnectionId: org_connection_id,
      });
      return { handled: true, message: `Authorization revoked: ${org_connection_id}` };
    }

    case "platform.status_update": {
      const { status, message: statusMsg } = payload.data || {};
      logger.info("Fasten platform status update", {
        category: "webhook",
        status,
      });
      return { handled: true, message: `Platform status: ${status || "unknown"}` };
    }

    case "webhook.test": {
      return { handled: true, message: "Webhook test received" };
    }

    default:
      logger.info("Fasten webhook: unrecognized event type", {
        category: "webhook",
        eventType: payload.type,
      });
      return { handled: false, message: `Unrecognized event type: ${payload.type}` };
  }
}
