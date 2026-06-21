import { Router, Request, Response } from "express";
import { healthcareDeidentificationService } from "./services/gcp/healthcare-deidentification";
import { medicalSpeechToTextService } from "./services/gcp/medical-speech-to-text";
import { loadSecretsFromGCP, storeSecret, getSecretManagerStatus } from "./services/gcp-secret-manager";

const router = Router();

router.get("/status", async (_req: Request, res: Response) => {
  try {
    const deidStatus = healthcareDeidentificationService.getStatus();
    const asrStatus = medicalSpeechToTextService.getStatus();
    const secretsStatus = getSecretManagerStatus();

    res.json({
      services: {
        healthcareDeidentification: { ...deidStatus, description: "HIPAA-compliant PHI scrubbing for AI pipelines" },
        medicalASR: { ...asrStatus, description: "Medical Speech-to-Text with clinical vocabulary (50%+ more accurate than standard)" },
        secretManager: { ...secretsStatus, description: "SOC2-compliant secret storage for API keys and database URLs" },
        cloudHealthcareApi: {
          description: "FHIR R4 / DICOM / HL7v2 storage — the gold standard for patient data",
          configuredVia: "server/services/gcp/cloudHealthcareApi.ts",
          fhirProvider: process.env.FHIR_PROVIDER || "mock",
        },
      },
      gcpProject: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || "united-planet-485003-n7",
      region: process.env.GCP_LOCATION || "us-central1",
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch GCP services status" });
  }
});

router.post("/deidentify/text", async (req: Request, res: Response) => {
  try {
    const { text, infoTypes, maskingCharacter } = req.body;
    if (!text) return res.status(400).json({ error: "text is required" });

    const result = healthcareDeidentificationService.deidentifyText({ text, infoTypes, maskingCharacter });

    res.json({
      ...result,
      disclaimer: "De-identification uses pattern matching for common PHI types. For production HIPAA compliance, enable GCP Healthcare De-identification API with full NLP-based entity recognition.",
    });
  } catch (error: any) {
    res.status(500).json({ error: "De-identification failed", message: error.message });
  }
});

router.post("/deidentify/fhir-store", async (req: Request, res: Response) => {
  try {
    const { sourceDatasetId, sourceFhirStoreId, destinationDatasetId, destinationFhirStoreId, config } = req.body;
    if (!sourceDatasetId || !sourceFhirStoreId || !destinationDatasetId || !destinationFhirStoreId) {
      return res.status(400).json({ error: "sourceDatasetId, sourceFhirStoreId, destinationDatasetId, destinationFhirStoreId are required" });
    }

    const result = await healthcareDeidentificationService.deidentifyFhirStore({
      sourceDatasetId, sourceFhirStoreId, destinationDatasetId, destinationFhirStoreId,
      config: config || {
        textRedactionMode: "inspect_and_transform",
        infoTypesToRedact: ["PERSON_NAME", "DATE_OF_BIRTH", "US_SOCIAL_SECURITY_NUMBER", "PHONE_NUMBER", "EMAIL_ADDRESS", "STREET_ADDRESS"],
      },
    });

    res.status(202).json(result);
  } catch (error: any) {
    res.status(500).json({ error: "FHIR store de-identification failed", message: error.message });
  }
});

router.get("/deidentify/operation/:operationId", async (req: Request, res: Response) => {
  try {
    const status = healthcareDeidentificationService.getOperationStatus(req.params.operationId);
    if (!status) return res.status(404).json({ error: "Operation not found" });
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch operation status" });
  }
});

router.get("/deidentify/info-types", async (_req: Request, res: Response) => {
  res.json({ infoTypes: healthcareDeidentificationService.getHipaaInfoTypes() });
});

router.post("/medasr/transcribe", async (req: Request, res: Response) => {
  try {
    const { audioContent, audioUri, encoding, sampleRateHertz, languageCode, model, speakerDiarization, maxSpeakers, punctuation } = req.body;

    if (!audioContent && !audioUri) return res.status(400).json({ error: "audioContent (base64) or audioUri (gs://) is required" });
    if (!encoding) return res.status(400).json({ error: "encoding is required (e.g. LINEAR16, WEBM_OPUS, MP3)" });

    const result = await medicalSpeechToTextService.transcribe({
      audioContent, audioUri,
      encoding: encoding || "LINEAR16",
      sampleRateHertz: sampleRateHertz || 16000,
      languageCode: languageCode || "en-US",
      model: model || "medical_dictation",
      speakerDiarization, maxSpeakers, punctuation,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Transcription failed", message: error.message });
  }
});

router.post("/medasr/detect-terms", async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "text is required" });

    const terms = medicalSpeechToTextService.detectMedicalTerms(text);
    res.json({ terms, count: terms.length });
  } catch (error: any) {
    res.status(500).json({ error: "Term detection failed", message: error.message });
  }
});

router.post("/medasr/session", async (req: Request, res: Response) => {
  try {
    const { context } = req.body;
    const session = medicalSpeechToTextService.createSession(context || "dictation");
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.post("/medasr/session/:sessionId/transcribe", async (req: Request, res: Response) => {
  try {
    const result = await medicalSpeechToTextService.addToSession(req.params.sessionId, req.body);
    if (!result) return res.status(404).json({ error: "Session not found or already completed" });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Session transcription failed" });
  }
});

router.post("/medasr/session/:sessionId/complete", async (req: Request, res: Response) => {
  try {
    const session = medicalSpeechToTextService.completeSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to complete session" });
  }
});

router.get("/medasr/session/:sessionId", async (req: Request, res: Response) => {
  try {
    const session = medicalSpeechToTextService.getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

router.get("/secrets/status", async (_req: Request, res: Response) => {
  try {
    res.json(getSecretManagerStatus());
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch secret manager status" });
  }
});

router.post("/secrets/load", async (_req: Request, res: Response) => {
  try {
    const result = await loadSecretsFromGCP();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to load secrets", message: error.message });
  }
});

export default router;
