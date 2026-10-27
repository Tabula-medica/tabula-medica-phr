// @ts-nocheck
import { Router, Request, Response } from "express";

export type IdentityDocumentType =
  | "US_PASSPORT"
  | "FOREIGN_PASSPORT"
  | "CONSULAR_ID"
  | "STATE_DL"
  | "STATE_ID"
  | "USCIS_EAD"
  | "USCIS_I94"
  | "ITIN"
  | "SCHOOL_ID"
  | "OTHER";

export interface IdentityDocument {
  type: IdentityDocumentType;
  typeLabel: string;
  documentNumber: string;
  issuingCountry?: string;
  issuingState?: string;
  expirationDate?: string;
  nameAsOnDocument: string;
  dateOfBirth: string;
  storedAt: string;
  verified: boolean;
}

export interface UninsuredIdentityProfile {
  patientId: string;
  preferredLanguage: string;
  hasSSN: false;
  identityDocuments: IdentityDocument[];
  primaryDocumentType: IdentityDocumentType;
  acceptedByNetworkProviders: boolean;
  privacyAcknowledgedAt: string;
  immigrationStatusNotRequired: true;
}

export const IDENTITY_DOCUMENT_TYPES: Record<
  IdentityDocumentType,
  { label: string; hint: string; accepted: boolean; requiresCountry: boolean }
> = {
  US_PASSPORT: {
    label: "US Passport / Passport Card",
    hint: "9-character alphanumeric number on the data page",
    accepted: true,
    requiresCountry: false,
  },
  FOREIGN_PASSPORT: {
    label: "Foreign Passport",
    hint: "Passport number from any country",
    accepted: true,
    requiresCountry: true,
  },
  CONSULAR_ID: {
    label: "Consular ID (Matrícula Consular)",
    hint: "ID issued by your country's consulate",
    accepted: true,
    requiresCountry: true,
  },
  STATE_DL: {
    label: "State Driver's License",
    hint: "Driver's license number from any US state",
    accepted: true,
    requiresCountry: false,
  },
  STATE_ID: {
    label: "State ID Card",
    hint: "Non-driver ID from any US state",
    accepted: true,
    requiresCountry: false,
  },
  USCIS_EAD: {
    label: "USCIS Employment Authorization Card (EAD)",
    hint: "13-character document number on the front",
    accepted: true,
    requiresCountry: false,
  },
  USCIS_I94: {
    label: "USCIS I-94 Arrival/Departure Record",
    hint: "11-digit admission number",
    accepted: true,
    requiresCountry: false,
  },
  ITIN: {
    label: "Individual Taxpayer ID Number (ITIN)",
    hint: "9-digit number starting with 9 (format: 9XX-XX-XXXX)",
    accepted: true,
    requiresCountry: false,
  },
  SCHOOL_ID: {
    label: "University / School ID",
    hint: "Student ID number",
    accepted: true,
    requiresCountry: false,
  },
  OTHER: {
    label: "Other Government-Issued ID",
    hint: "Any government-issued photo ID",
    accepted: true,
    requiresCountry: true,
  },
};

function maskDocumentNumber(raw: string): string {
  const clean = raw.replace(/\s/g, "");
  if (clean.length <= 4) return "****";
  return "*".repeat(clean.length - 4) + clean.slice(-4);
}

export const PRIVACY_ACKNOWLEDGMENT_TEXT = `PRIVACY NOTICE — UNINSURED IDENTITY VAULT

Tabula Medica, Inc. DBA Uninsurance stores your identity document information ONLY for the purpose of provider check-in and appointment matching. We commit to the following:

1. NO immigration status verification. We do not check or record your immigration status.

2. NO disclosure to immigration authorities. We will NEVER voluntarily share your information with ICE, CBP, or any immigration enforcement agency. We will challenge any request to do so in court.

3. NO SSN required. A Social Security Number is never required to receive care in our network.

4. HIPAA protection. Your identity documents are protected by the same HIPAA security standards as your medical records.

5. YOUR CONTROL. You may delete your stored IDs at any time from your profile settings.

By storing your ID, you consent to this privacy policy. For questions, contact privacy@tabulamedica.health.`;

const vaultStore = new Map<string, UninsuredIdentityProfile>();

function getOrCreateProfile(patientId: string): UninsuredIdentityProfile {
  if (!vaultStore.has(patientId)) {
    vaultStore.set(patientId, {
      patientId,
      preferredLanguage: "en",
      hasSSN: false,
      identityDocuments: [],
      primaryDocumentType: "OTHER",
      acceptedByNetworkProviders: false,
      privacyAcknowledgedAt: "",
      immigrationStatusNotRequired: true,
    });
  }
  return vaultStore.get(patientId)!;
}

export function generateProviderIntakeNote(docs: IdentityDocument[]): string {
  if (docs.length === 0) {
    return "Patient does not have a Social Security Number on file. No ID documents stored. Verify identity at check-in per your practice policy.";
  }
  const primary = docs[0];
  const docList = docs
    .map((d) => `  - ${d.typeLabel}: ${d.documentNumber} (${d.issuingCountry ?? "US"})`)
    .join("\n");

  return `IDENTITY VERIFICATION NOTE — Tabula Medica Uninsured Identity Vault

This patient does not have a Social Security Number on file.
The following government-issued IDs have been stored and accepted per
Tabula Medica Provider Agreement §3.4.

Primary ID: ${primary.typeLabel} — ${primary.documentNumber}

All stored IDs:
${docList}

Note: Tabula Medica does not verify immigration status. Per our Provider
Agreement, providers in the Uninsurance network agree to accept these
IDs in lieu of an SSN for uninsured patient intake.`;
}

export function createIdentityVaultRouter(): Router {
  const router = Router();

  router.get("/document-types", (_req: Request, res: Response) => {
    const types = Object.entries(IDENTITY_DOCUMENT_TYPES)
      .filter(([, meta]) => meta.accepted)
      .map(([type, meta]) => ({
        type,
        label: meta.label,
        hint: meta.hint,
        requiresCountry: meta.requiresCountry,
      }));
    res.json({ documentTypes: types });
  });

  router.get("/privacy-notice", (_req: Request, res: Response) => {
    res.json({
      privacyNotice: PRIVACY_ACKNOWLEDGMENT_TEXT,
      keyCommitments: [
        "No immigration status verification",
        "No disclosure to immigration authorities",
        "No SSN required",
        "HIPAA-protected storage",
        "Patient-controlled deletion",
      ],
      legalReferences: [
        "Provider Agreement §3.4",
        "Privacy Policy §8.2",
        "HIPAA 45 CFR Parts 160 & 164",
      ],
    });
  });

  router.get("/:patientId", (req: Request, res: Response) => {
    const profile = vaultStore.get(req.params.patientId);
    if (!profile) {
      return res.json({
        hasDocuments: false,
        documentCount: 0,
        profile: null,
      });
    }
    res.json({
      hasDocuments: profile.identityDocuments.length > 0,
      documentCount: profile.identityDocuments.length,
      profile: {
        ...profile,
        identityDocuments: profile.identityDocuments.map((d) => ({
          ...d,
          documentNumber: d.documentNumber,
        })),
      },
    });
  });

  router.post("/:patientId/store", (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const { type, documentNumber, issuingCountry, issuingState, expirationDate, nameAsOnDocument, dateOfBirth } = req.body;

      if (!type || !documentNumber || !nameAsOnDocument || !dateOfBirth) {
        return res.status(400).json({ error: "Missing required fields: type, documentNumber, nameAsOnDocument, dateOfBirth" });
      }

      const typeMetadata = IDENTITY_DOCUMENT_TYPES[type as IdentityDocumentType];
      if (!typeMetadata) {
        return res.status(400).json({ error: "Invalid document type" });
      }

      if (typeMetadata.requiresCountry && !issuingCountry) {
        return res.status(400).json({ error: `Issuing country required for ${typeMetadata.label}` });
      }

      const masked = maskDocumentNumber(documentNumber);
      const profile = getOrCreateProfile(patientId);

      const doc: IdentityDocument = {
        type: type as IdentityDocumentType,
        typeLabel: typeMetadata.label,
        documentNumber: masked,
        issuingCountry,
        issuingState,
        expirationDate,
        nameAsOnDocument,
        dateOfBirth,
        storedAt: new Date().toISOString(),
        verified: false,
      };

      profile.identityDocuments.push(doc);
      if (profile.identityDocuments.length === 1) {
        profile.primaryDocumentType = doc.type;
      }

      console.log(`[IdentityVault] Stored ${doc.typeLabel} for patient ${patientId}: ${masked}`);

      res.json({
        success: true,
        maskedNumber: masked,
        documentCount: profile.identityDocuments.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to store identity document", detail: err.message });
    }
  });

  router.post("/:patientId/acknowledge-privacy", (req: Request, res: Response) => {
    const profile = getOrCreateProfile(req.params.patientId);
    profile.privacyAcknowledgedAt = new Date().toISOString();
    res.json({ acknowledged: true, acknowledgedAt: profile.privacyAcknowledgedAt });
  });

  router.delete("/:patientId/documents/:index", (req: Request, res: Response) => {
    const profile = vaultStore.get(req.params.patientId);
    if (!profile) return res.status(404).json({ error: "Profile not found" });

    const idx = parseInt(req.params.index, 10);
    if (isNaN(idx) || idx < 0 || idx >= profile.identityDocuments.length) {
      return res.status(400).json({ error: "Invalid document index" });
    }

    const removed = profile.identityDocuments.splice(idx, 1)[0];
    console.log(`[IdentityVault] Removed ${removed.typeLabel} for patient ${req.params.patientId}`);

    res.json({ success: true, remainingCount: profile.identityDocuments.length });
  });

  router.get("/:patientId/intake-note", (req: Request, res: Response) => {
    const profile = vaultStore.get(req.params.patientId);
    if (!profile || profile.identityDocuments.length === 0) {
      return res.json({ note: generateProviderIntakeNote([]) });
    }
    res.json({ note: generateProviderIntakeNote(profile.identityDocuments) });
  });

  return router;
}
