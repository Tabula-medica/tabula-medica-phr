import { Router } from "express";
import { dualModeEcosystemService } from "../services/dual-mode-ecosystem-service";

const router = Router();

router.get("/care-gaps/:saidPatientId", async (req, res) => {
  try {
    const { saidPatientId } = req.params;
    const gaps = await dualModeEcosystemService.detectCareGaps(saidPatientId);
    res.json({
      saidPatientId,
      totalGaps: gaps.length,
      overdue: gaps.filter(g => g.urgency === "overdue").length,
      dueSoon: gaps.filter(g => g.urgency === "due-soon").length,
      recommended: gaps.filter(g => g.urgency === "recommended").length,
      potentialSavings: gaps.reduce((s, g) => s + g.savings, 0),
      gaps,
    });
  } catch (error) {
    console.error("[DualMode] Care gaps error:", error);
    res.status(500).json({ error: "Failed to detect care gaps" });
  }
});

router.post("/fix-this", async (req, res) => {
  try {
    const { saidPatientId, gapId } = req.body;
    if (!saidPatientId || !gapId) {
      return res.status(400).json({ error: "Missing saidPatientId or gapId" });
    }

    const handoff = await dualModeEcosystemService.generateFixThisHandoff(saidPatientId, gapId);
    res.json(handoff);
  } catch (error: any) {
    console.error("[DualMode] Fix This error:", error);
    res.status(error.message?.includes("not found") ? 404 : 500).json({ error: error.message || "Handoff failed" });
  }
});

router.post("/result-loopback", async (req, res) => {
  try {
    const { saidPatientId, orderId } = req.body;
    if (!saidPatientId || !orderId) {
      return res.status(400).json({ error: "Missing saidPatientId or orderId" });
    }

    const result = await dualModeEcosystemService.simulateResultLoopback(saidPatientId, orderId);
    res.json(result);
  } catch (error: any) {
    console.error("[DualMode] Result loopback error:", error);
    res.status(error.message?.includes("not found") ? 404 : 500).json({ error: error.message || "Loopback failed" });
  }
});

router.get("/gcs-cross-talk", async (_req, res) => {
  try {
    const status = await dualModeEcosystemService.getGCSCrossTalkStatus();
    res.json(status);
  } catch (error) {
    console.error("[DualMode] GCS cross-talk error:", error);
    res.status(500).json({ error: "Failed to get GCS status" });
  }
});

router.get("/financial-health/:saidPatientId", async (req, res) => {
  try {
    const { saidPatientId } = req.params;
    const summary = await dualModeEcosystemService.getFinancialHealthSummary(saidPatientId);
    res.json(summary);
  } catch (error) {
    console.error("[DualMode] Financial health error:", error);
    res.status(500).json({ error: "Failed to generate financial summary" });
  }
});

router.get("/order-history/:saidPatientId", async (req, res) => {
  try {
    const { saidPatientId } = req.params;
    const orders = await dualModeEcosystemService.getOrderHistory(saidPatientId);
    res.json({
      saidPatientId,
      totalOrders: orders.length,
      completed: orders.filter(o => o.status === "completed").length,
      pending: orders.filter(o => o.status === "pending").length,
      orders,
    });
  } catch (error) {
    console.error("[DualMode] Order history error:", error);
    res.status(500).json({ error: "Failed to get order history" });
  }
});

router.get("/overview/:saidPatientId", async (req, res) => {
  try {
    const { saidPatientId } = req.params;
    const overview = await dualModeEcosystemService.getEcosystemOverview(saidPatientId);
    res.json(overview);
  } catch (error) {
    console.error("[DualMode] Overview error:", error);
    res.status(500).json({ error: "Failed to get ecosystem overview" });
  }
});

router.get("/architecture", (_req, res) => {
  res.json({
    name: "Dual-Mode Ecosystem",
    description: "The glue components that make Tabula Medica and Uninsurance work together seamlessly.",
    sharedIdentity: {
      primaryKey: "SAID™ Patient ID",
      format: "SAID-YY-STATE-7DIGITS-CHECK (Luhn)",
      tabulaRole: "Holds the patient's complete health history (FHIR R4)",
      uninsuranceRole: "Holds the active orders, invoices, and payment records",
    },
    handoffWorkflow: {
      steps: [
        "1. Tabula Medica detects a care gap (e.g., 'You are overdue for a Vitamin D test')",
        "2. User clicks 'Fix This' → JWT xtoken deep link to Uninsurance (HMAC-SHA256, 15-min TTL)",
        "3. Uninsurance shows Medicare vs Quest retail rates, processes payment",
        "4. Quest completes the test → result auto-pulled back into Tabula Medica via Fasten API",
      ],
      tokenSpec: "JWT xtoken: iss=tabulamedica.health, aud=uninsurance.care, payload={saidPatientId, hint:{cptCode, specialty}}",
    },
    gcsCrossTalk: {
      bucketA: {
        name: process.env.GCS_VAULT_BUCKET || "tabula-medica-vault",
        purpose: "Read/Write for Health Records",
        iam: "tabula-medica-sa — roles/storage.objectAdmin",
        encryption: "AES-256-GCM (CMEK via Cloud KMS)",
      },
      bucketB: {
        name: process.env.GCS_UNINSURANCE_BUCKET || "uninsurance-orders",
        purpose: "Read/Write for Invoices and Order Receipts",
        iam: "uninsurance-sa — roles/storage.objectAdmin",
        encryption: "AES-256-GCM (CMEK via Cloud KMS)",
      },
      vpcServiceControls: "Enabled — PHI perimeter restricts storage.googleapis.com",
      crossBucketPolicy: "Vertex AI service account has read-only on both buckets for Financial Health analysis",
    },
    aiLayer: {
      engine: "Vertex AI + GPT-4o",
      purpose: "Cross-bucket Financial Health summaries (e.g., 'You saved $400 this year by using Medicare-rate labs')",
      inputs: ["Bucket A (Tabula): FHIR clinical records + care gap history", "Bucket B (Uninsurance): Order receipts + payment records"],
      outputs: ["Total savings vs retail", "Per-category breakdown", "Projected annual savings", "Cost optimization insights"],
    },
    endpoints: {
      careGaps: "/api/dual-mode/care-gaps/:saidPatientId",
      fixThis: "/api/dual-mode/fix-this (POST: {saidPatientId, gapId})",
      resultLoopback: "/api/dual-mode/result-loopback (POST: {saidPatientId, orderId})",
      gcsCrossTalk: "/api/dual-mode/gcs-cross-talk",
      financialHealth: "/api/dual-mode/financial-health/:saidPatientId",
      orderHistory: "/api/dual-mode/order-history/:saidPatientId",
      overview: "/api/dual-mode/overview/:saidPatientId",
      architecture: "/api/dual-mode/architecture",
    },
  });
});

export default router;
