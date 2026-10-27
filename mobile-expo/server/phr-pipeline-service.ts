// @ts-nocheck
import { logger } from "./utils/logger";
import { db } from "./db";
import { healthRecords } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface PipelineStep {
  step: string;
  status: "success" | "error" | "skipped";
  detail?: string;
  durationMs?: number;
}

export interface PipelineResult {
  userId: string;
  status: "complete" | "partial" | "failed";
  steps: PipelineStep[];
  totalRecords: number;
  duplicatesFound: number;
  duplicatesMerged: number;
  gcsUploaded: number;
  fhirStoreUpserted: number;
  startedAt: Date;
  completedAt: Date;
}

export async function runPostImportPipeline(userId: string): Promise<PipelineResult> {
  const startedAt = new Date();
  const steps: PipelineStep[] = [];
  let totalRecords = 0;
  let duplicatesFound = 0;
  let duplicatesMerged = 0;
  let gcsUploaded = 0;
  let fhirStoreUpserted = 0;

  logger.info("[PHR Pipeline] Starting post-import pipeline", {
    category: "pipeline",
    userId,
  });

  let userRecords: any[] = [];
  let stepStart = Date.now();
  try {
    userRecords = await db.select().from(healthRecords).where(eq(healthRecords.userId, userId));
    totalRecords = userRecords.length;
    steps.push({ step: "fetch_records", status: "success", detail: `${totalRecords} records`, durationMs: Date.now() - stepStart });
  } catch (err: any) {
    steps.push({ step: "fetch_records", status: "error", detail: err.message, durationMs: Date.now() - stepStart });
    return { userId, status: "failed", steps, totalRecords: 0, duplicatesFound: 0, duplicatesMerged: 0, gcsUploaded: 0, fhirStoreUpserted: 0, startedAt, completedAt: new Date() };
  }

  if (totalRecords === 0) {
    steps.push({ step: "deduplication", status: "skipped", detail: "No records to deduplicate" });
    steps.push({ step: "gcs_upload", status: "skipped", detail: "No records to upload" });
    steps.push({ step: "fhir_store_upsert", status: "skipped", detail: "No records to upsert" });
    return { userId, status: "complete", steps, totalRecords: 0, duplicatesFound: 0, duplicatesMerged: 0, gcsUploaded: 0, fhirStoreUpserted: 0, startedAt, completedAt: new Date() };
  }

  stepStart = Date.now();
  try {
    const { deduplicateFhirBundle } = await import("./vertex-deduplication-service");
    const fhirResources = userRecords.map((r: any) => ({
      resourceType: r.fhirResourceType || r.type || "Observation",
      id: r.id,
      meta: { lastUpdated: r.updatedAt || r.createdAt },
      code: r.type === "lab" || r.type === "lab_result"
        ? { coding: [{ system: "http://loinc.org", code: r.title, display: r.title }] }
        : undefined,
      effectiveDateTime: r.date,
      ...(typeof r.rawFhirJson === "object" && r.rawFhirJson ? r.rawFhirJson : {}),
      ...(typeof r.details === "object" && r.details ? r.details : {}),
    }));
    const dedupResult = await deduplicateFhirBundle(fhirResources);
    duplicatesFound = dedupResult.duplicatesFound;
    duplicatesMerged = dedupResult.mergedRecords;
    steps.push({
      step: "deduplication",
      status: "success",
      detail: `${dedupResult.duplicatesFound} duplicates found, ${dedupResult.mergedRecords} merged (provider: ${dedupResult.provider})`,
      durationMs: Date.now() - stepStart,
    });
  } catch (dedupErr: any) {
    steps.push({ step: "deduplication", status: "error", detail: dedupErr.message, durationMs: Date.now() - stepStart });
  }

  stepStart = Date.now();
  try {
    const { gcsHIPAAStorage } = await import("./gcs-hipaa-storage");
    if (!gcsHIPAAStorage.isConfigured()) {
      steps.push({ step: "gcs_upload", status: "skipped", detail: "GCS credentials not configured" });
    } else {
      for (const record of userRecords) {
        try {
          const data = Buffer.from(JSON.stringify(record));
          const docType = mapRecordTypeToDocType(record.type);
          await gcsHIPAAStorage.uploadDocument(userId, record.id?.toString() || "unknown", docType, data, { contentType: "application/fhir+json" });
          gcsUploaded++;
        } catch (_) {}
      }
      steps.push({
        step: "gcs_upload",
        status: "success",
        detail: `${gcsUploaded}/${totalRecords} records uploaded to GCS`,
        durationMs: Date.now() - stepStart,
      });
    }
  } catch (gcsErr: any) {
    steps.push({ step: "gcs_upload", status: "skipped", detail: gcsErr.message || "GCS upload failed", durationMs: Date.now() - stepStart });
  }

  stepStart = Date.now();
  try {
    const gcpConfigured = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GCP_SERVICE_ACCOUNT_KEY || process.env.GCP_KEY);
    const projectId = process.env.GCP_PROJECT_ID;
    const datasetId = process.env.GCP_HEALTHCARE_DATASET_ID;
    const fhirStoreId = process.env.GCP_FHIR_STORE_ID;
    const location = process.env.GCP_LOCATION || "us-central1";

    if (!gcpConfigured || !projectId || !datasetId || !fhirStoreId) {
      steps.push({ step: "fhir_store_upsert", status: "skipped", detail: "Cloud Healthcare API not configured" });
    } else {
      const { updateFhirResource, createFhirResource } = await import("./gcp-healthcare-client");
      const credentialsRaw = process.env.GCP_SERVICE_ACCOUNT_KEY
        ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
        : JSON.parse(await import("fs").then(fs => fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS!, "utf8")));

      const config = { projectId, location, datasetId, fhirStoreId };
      let fhirErrors = 0;

      for (const record of userRecords) {
        try {
          const fhirResource = typeof record.rawFhirJson === "object" && record.rawFhirJson
            ? record.rawFhirJson
            : {
                resourceType: record.fhirResourceType || "Observation",
                id: record.fhirResourceId || `local-${record.id}`,
                status: "final",
                code: { text: record.title },
                effectiveDateTime: record.date,
              };

          if (!fhirResource.resourceType) continue;

          if (fhirResource.id) {
            await updateFhirResource(credentialsRaw, config, fhirResource);
          } else {
            await createFhirResource(credentialsRaw, config, fhirResource);
          }
          fhirStoreUpserted++;
        } catch (resourceErr: any) {
          fhirErrors++;
          logger.debug(`[PHR Pipeline] FHIR upsert failed for record ${record.id}: ${resourceErr.message}`);
        }
      }
      const fhirStatus = fhirErrors > 0 && fhirStoreUpserted === 0 ? "error" : "success";
      steps.push({
        step: "fhir_store_upsert",
        status: fhirStatus,
        detail: `${fhirStoreUpserted}/${totalRecords} upserted, ${fhirErrors} errors`,
        durationMs: Date.now() - stepStart,
      });
    }
  } catch (fhirErr: any) {
    steps.push({ step: "fhir_store_upsert", status: "skipped", detail: fhirErr.message || "FHIR store upsert failed", durationMs: Date.now() - stepStart });
  }

  const completedAt = new Date();
  const allFailed = steps.every(s => s.status === "error");
  const anyFailed = steps.some(s => s.status === "error");
  const finalStatus = allFailed ? "failed" : anyFailed ? "partial" : "complete";

  logger.info("[PHR Pipeline] Post-import pipeline completed", {
    category: "pipeline",
    userId,
    totalRecords,
    duplicatesFound,
    duplicatesMerged,
    gcsUploaded,
    fhirStoreUpserted,
    durationMs: completedAt.getTime() - startedAt.getTime(),
  });

  return {
    userId,
    status: finalStatus,
    steps,
    totalRecords,
    duplicatesFound,
    duplicatesMerged,
    gcsUploaded,
    fhirStoreUpserted,
    startedAt,
    completedAt,
  };
}

function mapRecordTypeToDocType(type: string): string {
  const mapping: Record<string, string> = {
    lab_result: "lab_result",
    lab: "lab_result",
    imaging: "imaging",
    clinical_note: "clinical_note",
    discharge_summary: "discharge_summary",
    medication: "prescription",
    insurance: "insurance_card",
  };
  return mapping[type] || "historical_data";
}
