import { Router } from "express";
import {
  generateSaidPatientId,
  validateSaidPatientId,
  normalizeName,
  encryptField,
  hashDocumentId,
} from "../services/said-patient-id-service";
import {
  generateCrossAppToken,
  verifyCrossAppToken,
  buildDeepLinkUrl,
} from "../services/cross-app-link-service";
import { blockchainAuditAnchorService } from "../services/blockchain-audit-anchor-service";

const router = Router();

router.post("/said/generate", (req, res) => {
  try {
    const { state, firstName, middleName, lastName, dob, idDocType, idDocNumber } = req.body;

    if (!state || !firstName || !lastName || !idDocType || !idDocNumber) {
      return res.status(400).json({
        error: "Missing required fields: state, firstName, lastName, idDocType, idDocNumber",
      });
    }

    const saidId = generateSaidPatientId(state);
    const normalized = normalizeName(firstName, middleName, lastName);

    const encrypted = {
      nameFirstEnc: encryptField(normalized.nameFirst),
      nameMiddleEnc: encryptField(normalized.nameMiddle),
      nameLastEnc: encryptField(normalized.nameLast),
      dobEnc: dob ? encryptField(dob) : null,
      idDocHash: hashDocumentId(idDocNumber),
    };

    console.log(`[SAID] Generated: ${saidId} for state=${state}`);

    res.json({
      saidPatientId: saidId,
      normalized,
      encrypted,
      idDocType,
      residencyState: state.toUpperCase(),
    });
  } catch (error) {
    console.error("[SAID] Generation error:", error);
    res.status(500).json({ error: "SAID ID generation failed" });
  }
});

router.post("/said/validate", (req, res) => {
  try {
    const { saidPatientId } = req.body;
    if (!saidPatientId) {
      return res.status(400).json({ error: "Missing saidPatientId" });
    }

    const valid = validateSaidPatientId(saidPatientId);
    res.json({ saidPatientId, valid });
  } catch (error) {
    res.status(500).json({ error: "Validation failed" });
  }
});

router.get("/said/format", (_req, res) => {
  res.json({
    format: "SAID-{YY}-{STATE}-{7-digit-seq}-{Luhn check}",
    example: "SAID-26-VA-0047291-C",
    idDocTypes: [
      "PASSPORT", "DRIVERS_LICENSE", "STATE_ID", "CONSULAR_ID",
      "ITIN_CARD", "SCHOOL_ID", "MILITARY_ID", "VA_CARD",
    ],
    encryptionMethod: "AES-256-GCM",
    hashMethod: "SHA-256 (document number only)",
    nameNormalization: "UPPERCASE, NMN for no middle name",
  });
});

router.post("/cross-app/generate-link", (req, res) => {
  try {
    const { saidPatientId, cptCode, specialty } = req.body;

    if (!saidPatientId || !cptCode || !specialty) {
      return res.status(400).json({
        error: "Missing required fields: saidPatientId, cptCode, specialty",
      });
    }

    const url = buildDeepLinkUrl({ saidPatientId, cptCode, specialty });
    const xtoken = generateCrossAppToken({ saidPatientId, cptCode, specialty });

    console.log(`[CrossApp] Deep link generated for ${saidPatientId}: CPT ${cptCode}`);

    res.json({
      url,
      xtoken,
      expiresInSeconds: 900,
      targetApp: "uninsurance.care",
    });
  } catch (error) {
    console.error("[CrossApp] Link generation error:", error);
    res.status(500).json({ error: "Link generation failed" });
  }
});

router.post("/cross-app/verify-token", (req, res) => {
  try {
    const { xtoken } = req.body;
    if (!xtoken) {
      return res.status(400).json({ error: "Missing xtoken" });
    }

    const payload = verifyCrossAppToken(xtoken);
    if (!payload) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    res.json({
      valid: true,
      saidPatientId: payload.saidPatientId,
      hint: payload.hint,
      issuer: payload.iss,
      audience: payload.aud,
    });
  } catch (error) {
    res.status(500).json({ error: "Token verification failed" });
  }
});

router.get("/audit/chain-status", (_req, res) => {
  try {
    const status = blockchainAuditAnchorService.getChainStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: "Failed to get chain status" });
  }
});

router.post("/audit/log", (req, res) => {
  try {
    const { action, saidPatientId, appSource, requestId } = req.body;

    if (!action || !appSource) {
      return res.status(400).json({ error: "Missing required fields: action, appSource" });
    }

    const entry = {
      id: crypto.randomUUID(),
      action,
      saidPatientId: saidPatientId || "",
      appSource,
      requestId: requestId || crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    const anchor = blockchainAuditAnchorService.addEntry(entry);

    res.json({
      logged: true,
      entryId: entry.id,
      anchorCreated: !!anchor,
      anchor: anchor || null,
    });
  } catch (error) {
    console.error("[Audit] Log error:", error);
    res.status(500).json({ error: "Audit log failed" });
  }
});

router.get("/auth0/post-login-action", (_req, res) => {
  res.json({
    actionName: "embed-said-in-jwt",
    trigger: "post-login",
    code: `exports.onExecutePostLogin = async (event, api) => {
  const { rows } = await db.query(
    "SELECT said_patient_id FROM patients WHERE user_id=$1",
    [event.user.user_id]
  );
  const said = rows[0]?.said_patient_id;
  if (said) {
    api.accessToken.setCustomClaim("https://tabulamedica.health/said", said);
    api.idToken.setCustomClaim("https://tabulamedica.health/said", said);
  }
};`,
    readSaidFrom: 'req.auth["https://tabulamedica.health/said"]',
    description: "Auth0 Post-Login Action that embeds the SAID Patient ID into both the access token and ID token as a custom claim. Both Tabula Medica and Uninsurance read this claim at runtime.",
  });
});

export default router;
