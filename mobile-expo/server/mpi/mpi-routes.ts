import { Request, Response, Router } from "express";
import { 
  patientMatchingService, 
  normalizeMiddleName, 
  NMN_MARKER,
  type PatientIdentifier,
} from "./patient-matching-service";
import { AuditService, AuditAction, ResourceType } from "../compliance/audit-service";
import { storage } from "../storage";

const router = Router();

const MPI_ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

if (MPI_ADMIN_EMAILS.length === 0) {
  console.warn(
    "[MPI] WARNING: ADMIN_EMAILS is not configured. " +
    "POST /api/mpi/match will deny all requests until at least one admin email is set."
  );
}

function getAuthenticatedUserId(req: Request): string {
  return (req as any)._authenticatedUserId || "";
}

async function requireMpiAdmin(req: Request, res: Response): Promise<boolean> {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  const user = await storage.getUser(userId);
  if (!user || !MPI_ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    AuditService.phiAccess(req, AuditAction.VIEW_PHI, ResourceType.USER_ACCOUNT, userId, {
      phiDetails: { accessReason: "MPI match access denied — insufficient privilege" },
    });
    res.status(403).json({ error: "Forbidden: cross-patient identity matching requires administrator access" });
    return false;
  }
  return true;
}

router.post("/match", async (req: Request, res: Response) => {
  try {
    if (!(await requireMpiAdmin(req, res))) return;

    const identifier: PatientIdentifier = req.body;

    if (!identifier.firstName || !identifier.lastName || !identifier.dateOfBirth) {
      return res.status(400).json({ 
        error: "Required fields missing",
        required: ["firstName", "lastName", "dateOfBirth"],
      });
    }

    identifier.middleName = normalizeMiddleName(identifier.middleName);

    const { deterministicMatches, probabilisticMatches } = 
      await patientMatchingService.findAllMatches(identifier);

    const highConfidence = [
      ...deterministicMatches,
      ...probabilisticMatches.filter((m) => patientMatchingService.isHighConfidenceMatch(m)),
    ];

    const mediumConfidence = probabilisticMatches.filter((m) => 
      patientMatchingService.isMediumConfidenceMatch(m)
    );

    AuditService.phiAccess(req, AuditAction.VIEW_PHI, ResourceType.USER_ACCOUNT, undefined, {
      phiDetails: {
        accessReason: "MPI patient matching query",
        recordCount: deterministicMatches.length + probabilisticMatches.length,
      },
    });

    res.json({
      deterministicMatches,
      probabilisticMatches,
      summary: {
        totalMatches: deterministicMatches.length + probabilisticMatches.length,
        highConfidenceCount: highConfidence.length,
        mediumConfidenceCount: mediumConfidence.length,
        hasDeterministicMatch: deterministicMatches.length > 0,
      },
    });
  } catch (error) {
    console.error("Patient matching error:", error);
    res.status(500).json({ error: "Failed to perform patient matching" });
  }
});

router.get("/duplicates/:userId", async (req: Request, res: Response) => {
  try {
    const authenticatedUserId = getAuthenticatedUserId(req);
    const requestedUserId = req.params.userId as string;

    if (requestedUserId !== authenticatedUserId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const candidates = await patientMatchingService.findDuplicateCandidates(authenticatedUserId);

    AuditService.phiAccess(req, AuditAction.VIEW_PHI, ResourceType.USER_ACCOUNT, authenticatedUserId, {
      phiDetails: {
        accessReason: "Duplicate patient detection",
        recordCount: candidates.length,
      },
    });

    res.json({
      userId: authenticatedUserId,
      duplicateCandidates: candidates,
      count: candidates.length,
    });
  } catch (error) {
    console.error("Duplicate detection error:", error);
    res.status(500).json({ error: "Failed to detect duplicates" });
  }
});

router.post("/normalize-name", async (req: Request, res: Response) => {
  try {
    const { firstName, middleName, lastName } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ 
        error: "Required fields missing",
        required: ["firstName", "lastName"],
      });
    }

    const normalizedMiddle = normalizeMiddleName(middleName);

    res.json({
      firstName: firstName.trim(),
      middleName: normalizedMiddle,
      lastName: lastName.trim(),
      hasMiddleName: normalizedMiddle !== NMN_MARKER,
      nmnMarker: NMN_MARKER,
    });
  } catch (error) {
    console.error("Name normalization error:", error);
    res.status(500).json({ error: "Failed to normalize name" });
  }
});

router.post("/validate-identifier", async (req: Request, res: Response) => {
  try {
    const { ssn, stateId, stateIdState, phoneNumber, dateOfBirth } = req.body;

    const validation: Record<string, any> = {};

    if (ssn) {
      const cleanSSN = ssn.replace(/\D/g, "");
      validation.ssn = {
        isValid: cleanSSN.length === 9,
        normalized: cleanSSN.length === 9 ? cleanSSN : null,
        format: cleanSSN.length === 9 
          ? `${cleanSSN.slice(0, 3)}-${cleanSSN.slice(3, 5)}-${cleanSSN.slice(5)}`
          : null,
      };
    }

    if (stateId) {
      validation.stateId = {
        isValid: stateId.trim().length > 0 && !!stateIdState,
        normalized: stateId.trim().toUpperCase(),
        state: stateIdState?.toUpperCase() || null,
        error: !stateIdState ? "State is required with state ID" : null,
      };
    }

    if (phoneNumber) {
      const cleanPhone = phoneNumber.replace(/\D/g, "");
      const normalized = cleanPhone.slice(-10);
      validation.phoneNumber = {
        isValid: normalized.length === 10,
        normalized: normalized.length === 10 ? normalized : null,
        format: normalized.length === 10
          ? `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`
          : null,
      };
    }

    if (dateOfBirth) {
      const date = new Date(dateOfBirth);
      const isValidDate = !isNaN(date.getTime());
      const isFutureDate = isValidDate && date > new Date();
      const isTooOld = isValidDate && date < new Date("1900-01-01");
      
      validation.dateOfBirth = {
        isValid: isValidDate && !isFutureDate && !isTooOld,
        normalized: isValidDate ? date.toISOString().split("T")[0] : null,
        error: !isValidDate 
          ? "Invalid date format" 
          : isFutureDate 
            ? "Date cannot be in the future" 
            : isTooOld 
              ? "Date is too far in the past" 
              : null,
      };
    }

    res.json({
      validation,
      allValid: Object.values(validation).every((v: any) => v.isValid),
    });
  } catch (error) {
    console.error("Identifier validation error:", error);
    res.status(500).json({ error: "Failed to validate identifiers" });
  }
});

router.get("/matching-thresholds", async (_req: Request, res: Response) => {
  try {
    res.json({
      deterministicConfidence: 1.0,
      highProbabilisticThreshold: 0.85,
      mediumProbabilisticThreshold: 0.70,
      fieldWeights: {
        name: 0.30,
        dateOfBirth: 0.25,
        phone: 0.20,
        address: 0.15,
        email: 0.10,
      },
      matchingAlgorithms: {
        name: "Jaro-Winkler similarity",
        phone: "Levenshtein distance after normalization",
        address: "Component-wise matching with Jaro-Winkler",
        dateOfBirth: "Exact date comparison",
        ssn: "Exact match (deterministic)",
        stateId: "Exact match with state (deterministic)",
      },
      nmnStandard: {
        marker: NMN_MARKER,
        description: "No Middle Name - prevents duplicate records when middle name is missing in one system",
        behavior: "When comparing names, NMN matches any middle name value",
      },
    });
  } catch (error) {
    console.error("Get thresholds error:", error);
    res.status(500).json({ error: "Failed to get matching thresholds" });
  }
});

export default router;
