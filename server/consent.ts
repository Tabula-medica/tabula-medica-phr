import { storage } from "./storage";
import type { DataCategory, AccessLevel } from "@shared/schema";

export interface ConsentCheckResult {
  hasAccess: boolean;
  accessLevel: AccessLevel;
  recipientId?: string;
  expiresAt?: string;
  reason?: string;
}

export async function checkDataConsent(
  patientUserId: string,
  requestingUserId: string,
  category: DataCategory
): Promise<ConsentCheckResult> {
  try {
    const accessLevel = await storage.checkConsent(patientUserId, requestingUserId, category);
    
    if (accessLevel === "none") {
      return {
        hasAccess: false,
        accessLevel: "none",
        reason: "No consent granted for this data category",
      };
    }
    
    return {
      hasAccess: true,
      accessLevel,
    };
  } catch (error) {
    console.error("Error checking consent:", error);
    return {
      hasAccess: false,
      accessLevel: "none",
      reason: "Error checking consent",
    };
  }
}

export async function filterDataByConsent<T extends { patientId?: string }>(
  data: T[],
  requestingUserId: string,
  category: DataCategory,
  patientUserIdResolver: (item: T) => string | undefined
): Promise<T[]> {
  const filteredData: T[] = [];
  
  for (const item of data) {
    const patientUserId = patientUserIdResolver(item);
    if (!patientUserId) {
      continue;
    }
    
    const consent = await checkDataConsent(patientUserId, requestingUserId, category);
    if (consent.hasAccess) {
      filteredData.push(item);
    }
  }
  
  return filteredData;
}

export async function logDataAccess(
  patientUserId: string,
  recipientId: string,
  category: DataCategory,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await storage.createConsentAuditLog({
      patientUserId,
      recipientId,
      action: "access",
      dataCategory: category,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error("Error logging data access:", error);
  }
}

export const categoryMappings: Record<string, DataCategory> = {
  medications: "medications",
  conditions: "conditions",
  allergies: "allergies",
  lab_results: "lab_results",
  labResults: "lab_results",
  labs: "lab_results",
  vital_signs: "vital_signs",
  vitals: "vital_signs",
  documents: "documents",
  appointments: "appointments",
  immunizations: "immunizations",
  procedures: "procedures",
  imaging: "imaging",
  notes: "notes",
  demographics: "demographics",
  insurance: "insurance",
};

export function resolveCategory(rawCategory: string): DataCategory | undefined {
  return categoryMappings[rawCategory.toLowerCase()];
}
