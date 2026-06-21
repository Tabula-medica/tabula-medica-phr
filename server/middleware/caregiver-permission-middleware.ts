import { Request, Response, NextFunction } from "express";
import * as caregiverService from "../services/enhanced-caregiver-access-service";
import crypto from "crypto";
import { or, eq, isNotNull, and } from "drizzle-orm";
import { db } from "../db";
import { profiles, type ProfileTransitionStatus } from "@shared/schema";

/**
 * Look up whether the patient identified by `patientId` has any profile that
 * has entered the age-of-majority transition flow. We accept either a profile
 * UUID or an account UUID since the in-memory caregiverService.patientId field
 * is loosely typed across legacy callers.
 *
 * Returns the transitionStatus of the first matching frozen profile, or null
 * if no transition is active for this patient.
 *
 * Both `pending` (sweep just flagged DOB+18 reached) and `complete` (the new
 * adult has claimed their account) freeze caregiver/guardian access — at
 * `pending` the adult hasn't yet asserted control, but the legal basis for
 * guardian access has lapsed; at `complete` the adult is in control and any
 * prior guardian access must be re-granted by them, never auto-continued.
 */
async function getPatientTransitionStatus(
  patientId: string,
): Promise<ProfileTransitionStatus | null> {
  if (!patientId) return null;
  try {
    const rows = await db
      .select({
        transitionStatus: profiles.transitionStatus,
      })
      .from(profiles)
      .where(
        and(
          or(eq(profiles.id, patientId), eq(profiles.accountId, patientId)),
          isNotNull(profiles.transitionStatus),
        ),
      )
      .limit(1);
    return rows[0]?.transitionStatus ?? null;
  } catch (err) {
    console.error(
      "[CaregiverMiddleware] transitionStatus lookup failed:",
      err,
    );
    // Fail open on lookup error: don't lock guardians out due to a transient
    // DB blip. The age-of-majority sweep runs daily so legitimate transitions
    // will be re-detected on the next access attempt after recovery.
    return null;
  }
}

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, caregiverId: string, patientId: string, details: string) {
  console.log(`[HIPAA-AUDIT][CaregiverMiddleware] ${action} - Caregiver:${hashIdentifier(caregiverId)} - Patient:${hashIdentifier(patientId)} - ${details}`);
}

export interface CaregiverAuthenticatedRequest extends Request {
  caregiverAccess?: {
    accessId: string;
    caregiverId: string;
    patientId: string;
    role: string;
    accessLevel: string;
  };
}

export function requireCaregiverAccess(
  requiredCategory?: string,
  requiredAction: "view" | "add" | "edit" | "delete" | "export" = "view"
) {
  return async (req: CaregiverAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const accessId = req.headers["x-caregiver-access-id"] as string;
      const caregiverId = req.headers["x-caregiver-id"] as string;
      const patientId = req.params.patientId || req.body?.patientId;

      if (!accessId || !caregiverId) {
        logHipaaAudit("ACCESS_DENIED", caregiverId || "unknown", patientId || "unknown", "Missing caregiver credentials");
        return res.status(401).json({
          success: false,
          error: "Caregiver authentication required",
        });
      }

      const access = caregiverService.getCaregiverAccess(accessId);

      if (!access) {
        logHipaaAudit("ACCESS_DENIED", caregiverId, patientId || "unknown", "Invalid access ID");
        return res.status(403).json({
          success: false,
          error: "Invalid caregiver access",
        });
      }

      if (!access.isActive) {
        logHipaaAudit("ACCESS_DENIED", caregiverId, access.patientId, "Access is inactive");
        return res.status(403).json({
          success: false,
          error: "Caregiver access has been revoked or is inactive",
        });
      }

      if (access.caregiverId !== caregiverId) {
        logHipaaAudit("ACCESS_DENIED", caregiverId, access.patientId, "Caregiver ID mismatch");
        return res.status(403).json({
          success: false,
          error: "Caregiver ID does not match access record",
        });
      }

      if (access.consentExpiresAt && new Date(access.consentExpiresAt) < new Date()) {
        logHipaaAudit("ACCESS_DENIED", caregiverId, access.patientId, "Access has expired");
        return res.status(403).json({
          success: false,
          error: "Caregiver access has expired",
        });
      }

      // Age-of-majority freeze: if the patient profile has entered transition
      // (sweep flagged DOB + 18 reached, or new adult has claimed their account)
      // every guardian access must be denied. The new adult re-grants access
      // explicitly via the post-claim caregiver invitation flow.
      const transitionStatus = await getPatientTransitionStatus(access.patientId);
      if (transitionStatus) {
        logHipaaAudit(
          "ACCESS_DENIED",
          caregiverId,
          access.patientId,
          `Minor reached age of majority (transitionStatus=${transitionStatus})`,
        );
        return res.status(403).json({
          success: false,
          error:
            transitionStatus === "pending"
              ? "This patient has reached the age of majority. Guardian access is paused until they claim their own account."
              : "This patient now manages their own account. Please ask them to re-invite you as a caregiver if continued access is needed.",
          code: "MINOR_REACHED_MAJORITY",
          transitionStatus,
        });
      }

      if (requiredCategory) {
        const hasPermission = caregiverService.checkPermission(
          accessId,
          requiredCategory as any,
          requiredAction
        );

        if (!hasPermission) {
          logHipaaAudit("ACCESS_DENIED", caregiverId, access.patientId, `Insufficient permissions for ${requiredAction} on ${requiredCategory}`);
          return res.status(403).json({
            success: false,
            error: `Insufficient permissions to ${requiredAction} ${requiredCategory}`,
          });
        }
      }

      req.caregiverAccess = {
        accessId,
        caregiverId,
        patientId: access.patientId,
        role: access.role,
        accessLevel: access.accessLevel,
      };

      caregiverService.logCaregiverAction(
        accessId,
        "access",
        `Accessed ${req.method} ${req.path}`,
        requiredCategory,
        patientId
      );

      logHipaaAudit("ACCESS_GRANTED", caregiverId, access.patientId, `${requiredAction} on ${requiredCategory || "general"}`);
      next();
    } catch (error) {
      console.error("[CaregiverMiddleware] Error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to verify caregiver access",
      });
    }
  };
}

export function optionalCaregiverAccess() {
  return async (req: CaregiverAuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const accessId = req.headers["x-caregiver-access-id"] as string;
      const caregiverId = req.headers["x-caregiver-id"] as string;

      if (accessId && caregiverId) {
        const access = caregiverService.getCaregiverAccess(accessId);

        if (access && access.isActive && access.caregiverId === caregiverId) {
          req.caregiverAccess = {
            accessId,
            caregiverId,
            patientId: access.patientId,
            role: access.role,
            accessLevel: access.accessLevel,
          };
        }
      }

      next();
    } catch (error) {
      next();
    }
  };
}

export function logCaregiverDataAccess(resourceType: string) {
  return async (req: CaregiverAuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.caregiverAccess) {
      caregiverService.logCaregiverAction(
        req.caregiverAccess.accessId,
        "access",
        `Accessed ${resourceType} data via ${req.method} ${req.path}`,
        resourceType,
        req.params.id || req.body?.id
      );
    }
    next();
  };
}

console.log("[CaregiverMiddleware] Permission enforcement middleware initialized");
