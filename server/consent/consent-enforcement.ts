import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { logPhiAccess } from "../security/hipaa-audit";

function getUser(req: Request): { id: string; role?: string } | undefined {
  const user = (req as any).user;
  if (user?.id) {
    return { id: user.id, role: user.role || "patient" };
  }
  const session = (req as any).session;
  if (session?.userId) {
    return { id: session.userId, role: session.userRole || "patient" };
  }
  return undefined;
}

export async function requireConsents(req: Request, res: Response, next: NextFunction) {
  const user = getUser(req);
  
  if (!user?.id) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  try {
    const result = await storage.checkRequiredConsents(user.id);
    
    if (!result.allAccepted) {
      await logPhiAccess({
        userId: user.id,
        resourceType: "EHRConnection",
        action: "read",
        details: `Access denied - missing required consents: ${result.missing.join(", ")}`,
      });
      
      return res.status(403).json({
        error: "Required consents not accepted",
        code: "CONSENT_REQUIRED",
        message: "You must accept all required consent documents before connecting health data sources.",
        missingConsents: result.missing,
        redirectTo: "/consent",
      });
    }
    
    next();
  } catch (error) {
    console.error("[ConsentEnforcement] Error checking consents:", error);
    return res.status(500).json({ error: "Failed to verify consent status" });
  }
}

export async function requireSpecificConsent(
  consentType: string
): Promise<(req: Request, res: Response, next: NextFunction) => Promise<void | Response>> {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = getUser(req);
    
    if (!user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    try {
      const status = await storage.getUserConsentStatus(user.id);
      const consentStatus = status.allConsents.find(
        (doc) => doc.documentType === consentType && doc.status === "accepted"
      );
      
      if (!consentStatus) {
        await logPhiAccess({
          userId: user.id,
          resourceType: "DataAccess",
          action: "read",
          details: `Access denied - missing consent: ${consentType}`,
        });
        
        return res.status(403).json({
          error: "Consent not accepted",
          code: "SPECIFIC_CONSENT_REQUIRED",
          message: `You must accept the ${consentType} consent to access this feature.`,
          requiredConsent: consentType,
          redirectTo: "/consent",
        });
      }
      
      next();
    } catch (error) {
      console.error("[ConsentEnforcement] Error checking specific consent:", error);
      return res.status(500).json({ error: "Failed to verify consent status" });
    }
  };
}

export async function checkConsentMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = getUser(req);
  
  if (!user?.id) {
    return next();
  }
  
  try {
    const result = await storage.checkRequiredConsents(user.id);
    (req as any).consentStatus = result;
    next();
  } catch (error) {
    console.error("[ConsentEnforcement] Error checking consents:", error);
    next();
  }
}
