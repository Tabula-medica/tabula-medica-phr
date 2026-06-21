import { Router } from "express";
import { phrOrchestrationService } from "../services/phr-orchestration-service";

const router = Router();

router.get("/status", async (req, res) => {
  try {
    const userId = (req as any).user?.id || "demo-user";
    const status = await phrOrchestrationService.getPipelineStatus(userId);
    res.json(status);
  } catch (error) {
    console.error("[PHR Pipeline] Status error:", error);
    res.status(500).json({ error: "Failed to get pipeline status" });
  }
});

router.post("/run", async (req, res) => {
  try {
    const userId = (req as any).user?.id || "demo-user";
    const { connectionIds } = req.body;
    const result = await phrOrchestrationService.runFullPipeline(userId, connectionIds);
    res.json(result);
  } catch (error) {
    console.error("[PHR Pipeline] Run error:", error);
    res.status(500).json({ error: "Pipeline execution failed" });
  }
});

router.post("/voice-query", async (req, res) => {
  try {
    const userId = (req as any).user?.id || "demo-user";
    const { query } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Missing or invalid query" });
    }

    const result = await phrOrchestrationService.voiceToRecord(userId, query);
    res.json(result);
  } catch (error) {
    console.error("[PHR Pipeline] Voice query error:", error);
    res.status(500).json({ error: "Voice query failed" });
  }
});

router.post("/background-sync/start", async (req, res) => {
  try {
    const userId = (req as any).user?.id || "demo-user";
    const { intervalMinutes } = req.body;
    phrOrchestrationService.startBackgroundSync(userId, intervalMinutes || 60);
    res.json({
      started: true,
      userId,
      intervalMinutes: intervalMinutes || 60,
      message: `Background sync started for user ${userId} — Fasten Health will pull data every ${intervalMinutes || 60} minutes`,
    });
  } catch (error) {
    console.error("[PHR Pipeline] Background sync start error:", error);
    res.status(500).json({ error: "Failed to start background sync" });
  }
});

router.post("/background-sync/stop", async (req, res) => {
  try {
    const userId = (req as any).user?.id || "demo-user";
    phrOrchestrationService.stopBackgroundSync(userId);
    res.json({ stopped: true, userId });
  } catch (error) {
    console.error("[PHR Pipeline] Background sync stop error:", error);
    res.status(500).json({ error: "Failed to stop background sync" });
  }
});

router.get("/run-history", async (req, res) => {
  try {
    const userId = (req as any).user?.id || "demo-user";
    const history = phrOrchestrationService.getRunHistory(userId);
    res.json({
      userId,
      totalRuns: history.length,
      runs: history.slice(-20).reverse(),
    });
  } catch (error) {
    console.error("[PHR Pipeline] Run history error:", error);
    res.status(500).json({ error: "Failed to get run history" });
  }
});

router.get("/architecture", (_req, res) => {
  res.json({
    name: "Tabula Medica PHR Pipeline",
    description: "Free Data Utility layer — the source of truth for patient health records. Does NOT handle payments.",
    stages: [
      {
        id: "fasten-ingest",
        name: "Fasten Health Ingest",
        description: "Background service pulling data from 29,000+ healthcare endpoints via Fasten Connect API. Patients log in to their existing portals (Epic, Cerner, etc.) once and everything is aggregated.",
        technology: "Fasten Health Connect + SMART on FHIR + PKCE",
        capabilities: [
          "OAuth2/SMART on FHIR authentication to patient portals (Epic MyChart, Cerner, athenahealth, MEDITECH, eClinicalWorks)",
          "Support for 29,000+ healthcare endpoints via Fasten Connect",
          "Background sync service with configurable intervals (default: 60 min)",
          "FHIR R4 resource extraction (17 resource types)",
          "Real-time webhook integration for instant data updates",
          "Connection status tracking in fasten_connections DB table",
          "HIPAA audit trail for every connection and sync event",
        ],
      },
      {
        id: "vertex-ai-dedup",
        name: "Vertex AI Deduplication",
        description: "Send raw FHIR JSON bundles to Vertex AI Entity Resolution to identify duplicates. Example: 'Lipid Panel' from Jan 1st at Hospital A is the same as 'Lipid Panel' from Jan 1st at Hospital B.",
        technology: "Vertex AI Entity Resolution + DedupTriggerService + Custom NLP",
        capabilities: [
          "Deterministic matching (SSN, MRN, exact identifiers)",
          "Probabilistic matching (Levenshtein, Jaro-Winkler weighted scoring)",
          "AI-assisted resolution for ambiguous matches",
          "Code-system aware: LOINC, SNOMED CT, ICD-10, CPT, CVX, RxNorm",
          "De-identification before AI processing (strips Patient.name, birthDate, address per HIPAA)",
          "Duplicates patched as 'entered-in-error' status",
          "NMN (No Middle Name) standard compliance",
          "Per-resource-type thresholds (Patient: 0.85, Observation: 0.92, etc.)",
        ],
      },
      {
        id: "gcs-vault",
        name: "GCS Storage (The Vault)",
        description: "Store the cleaned, deduplicated FHIR JSON bundles in Google Cloud Storage buckets with HIPAA-grade encryption.",
        technology: "Google Cloud Storage + Cloud KMS (CMEK)",
        capabilities: [
          "AES-256-GCM encryption at rest with Customer-Managed Encryption Keys",
          "7-year retention policy per HIPAA requirements",
          "Bucket-level IAM and VPC Service Controls",
          "Object versioning for complete audit trail",
          "FHIR Bundle format (application/fhir+json)",
          "Per-patient directory structure: patients/{userId}/fhir/",
          "Signed URL generation for secure client-side access",
        ],
      },
      {
        id: "fhir-store-index",
        name: "Cloud Healthcare API FHIR Store",
        description: "Instead of just raw GCS files, store data in a hosted FHIR store — making it instantly searchable for the patient.",
        technology: "Google Cloud Healthcare API (FHIR R4)",
        capabilities: [
          "FHIR R4 compliant resource storage and retrieval (CRUD + Search)",
          "Full-text search across all patient records",
          "FHIR $everything operation for complete patient bundles",
          "BigQuery export for analytics and population health",
          "De-identification API for research data sharing",
          "USCDI v3 compliant data elements",
          "SMART on FHIR authorization for third-party apps",
        ],
      },
      {
        id: "voice-to-record",
        name: "Voice-to-Record (508 Compliance)",
        description: "A patient can say 'When was my last Tetanus shot?' and the AI queries the FHIR records to answer instantly. Uses OpenAI GPT-4o with FHIR context grounding, falling back to pattern matching.",
        technology: "OpenAI GPT-4o + Web Speech API + FHIR Search",
        capabilities: [
          'Natural language queries: "When was my last Tetanus shot?"',
          "Speech-to-text via Web Speech API and OpenAI Whisper",
          "AI translates natural language to FHIR search with source grounding",
          "Every answer cites specific FHIR resources (ResourceType, ID, Date)",
          "Section 508 compliant with screen reader announcements and ARIA live regions",
          "Keyboard shortcut activation (Alt+V)",
          "Graceful fallback to pattern matching when AI unavailable",
        ],
      },
    ],
    infrastructure: {
      gcpProject: process.env.GCP_PROJECT_ID || "united-planet-485003-n7",
      fhirStoreId: process.env.GCP_FHIR_STORE_ID || "tabula-medica-fhir-store",
      gcsVaultBucket: process.env.GCS_VAULT_BUCKET || "tabula-medica-vault",
      datasetId: process.env.GCP_HEALTHCARE_DATASET_ID || "tabula-medica-dataset",
      location: process.env.GCP_HEALTHCARE_LOCATION || "us-central1",
    },
    endpoints: {
      fastenConnect: "/api/fasten-connect/config",
      fastenCallback: "/api/fasten-connect/callback",
      fastenWebhook: "/api/fasten-connect/webhook",
      pipelineRun: "/api/phr-pipeline/run",
      pipelineStatus: "/api/phr-pipeline/status",
      voiceQuery: "/api/phr-pipeline/voice-query",
      backgroundSyncStart: "/api/phr-pipeline/background-sync/start",
      backgroundSyncStop: "/api/phr-pipeline/background-sync/stop",
      runHistory: "/api/phr-pipeline/run-history",
      deduplication: "/api/deduplication/dashboard",
      fhirStore: "/api/fhir/*",
    },
    noPaymentsHandled: true,
    layer: "Free Data Utility",
  });
});

export default router;
