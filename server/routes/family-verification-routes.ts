import { Router } from "express";
import { randomUUID } from "crypto";

const router = Router();

interface FamilyVerification {
  id: string;
  userId: string;
  verificationType: string;
  relationshipType: string;
  patientName: string;
  requesterName: string;
  requesterEmail: string;
  documentFileName: string;
  documentUploadDate: string;
  attestationText: string;
  digitalSignature: string;
  status: "pending" | "verified" | "expired" | "revoked";
  submittedAt: string;
  verifiedAt: string | null;
  expiresAt: string | null;
  notes: string;
}

const verifications: FamilyVerification[] = [];

router.get("/api/family-verification", (req, res) => {
  const userId = (req.query.userId as string) || "default-user";
  const userVerifications = verifications.filter((v) => v.userId === userId);
  res.json({ verifications: userVerifications });
});

router.get("/api/family-verification/:id", (req, res) => {
  const verification = verifications.find((v) => v.id === req.params.id);
  if (!verification) {
    return res.status(404).json({ error: "Verification not found" });
  }
  res.json({ verification });
});

router.post("/api/family-verification", (req, res) => {
  const {
    userId,
    verificationType,
    relationshipType,
    patientName,
    requesterName,
    requesterEmail,
    documentFileName,
    attestationText,
    digitalSignature,
    notes,
  } = req.body;

  if (!verificationType || !relationshipType || !requesterName || !digitalSignature) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const now = new Date().toISOString();
  const verification: FamilyVerification = {
    id: randomUUID(),
    userId: userId || "default-user",
    verificationType,
    relationshipType,
    patientName: patientName || "",
    requesterName,
    requesterEmail: requesterEmail || "",
    documentFileName: documentFileName || "",
    documentUploadDate: now,
    attestationText: attestationText || "",
    digitalSignature,
    status: "pending",
    submittedAt: now,
    verifiedAt: null,
    expiresAt: null,
    notes: notes || "",
  };

  verifications.push(verification);
  res.status(201).json({ verification });
});

router.patch("/api/family-verification/:id/status", (req, res) => {
  const { status } = req.body;
  const verification = verifications.find((v) => v.id === req.params.id);
  if (!verification) {
    return res.status(404).json({ error: "Verification not found" });
  }

  if (!["pending", "verified", "expired", "revoked"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  verification.status = status;
  if (status === "verified") {
    verification.verifiedAt = new Date().toISOString();
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);
    verification.expiresAt = expiry.toISOString();
  }

  res.json({ verification });
});

router.delete("/api/family-verification/:id", (req, res) => {
  const index = verifications.findIndex((v) => v.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: "Verification not found" });
  }
  verifications.splice(index, 1);
  res.json({ success: true });
});

export default router;
