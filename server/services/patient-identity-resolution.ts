import { storage } from "../storage";
import type { EhrPatientSource, EhrPlatform } from "@shared/schema";
import {
  computeIdentityMatch,
  shouldMerge,
  weakerConfidence,
  type IdentityCandidate,
  type MatchConfidence,
} from "./patient-identity-matching";
import { logger } from "../utils/logger";

export interface NewPatientSource extends IdentityCandidate {
  ehrConnectionId: string;
  platform: EhrPlatform;
  facilityName: string;
  mrn: string;
  patientId: string;
}

export interface PatientIdentityResolution {
  unifiedPatientId: string;
  matchConfidence: MatchConfidence;
}

/**
 * Resolve which UnifiedPatient a newly-pulled EHR Patient record belongs to,
 * for a given account. Compares the new record's identity fields against
 * every OTHER EHR connection already linked to this account; if one matches
 * confidently enough (see patient-identity-matching), the new source is
 * folded into that person's existing UnifiedPatient instead of creating a
 * duplicate identity. Otherwise a fresh UnifiedPatient is created.
 *
 * Call this BEFORE storage.createPatient() and set the returned
 * unifiedPatientId on the InsertPatient.
 */
export async function resolvePatientIdentityForUser(
  userId: string,
  candidate: NewPatientSource,
): Promise<PatientIdentityResolution> {
  const connections = await storage.getEhrConnections(userId);
  const otherConnections = connections.filter(c => c.id !== candidate.ehrConnectionId);

  let best: { unifiedPatientId: string; confidence: MatchConfidence } | null = null;

  for (const connection of otherConnections) {
    const existingPatients = await storage.getPatientsByConnection(connection.id);
    for (const existing of existingPatients) {
      if (!existing.unifiedPatientId) continue;
      const { confidence } = computeIdentityMatch(candidate, existing);
      if (!shouldMerge(confidence)) continue;
      if (!best || CONFIDENCE_RANK(confidence) > CONFIDENCE_RANK(best.confidence)) {
        best = { unifiedPatientId: existing.unifiedPatientId, confidence };
      }
    }
  }

  if (best) {
    const unified = await storage.getUnifiedPatient(best.unifiedPatientId);
    if (unified) {
      const newSource: EhrPatientSource = {
        ehrConnectionId: candidate.ehrConnectionId,
        platform: candidate.platform,
        facilityName: candidate.facilityName,
        mrn: candidate.mrn,
        patientId: candidate.patientId,
        lastSync: new Date().toISOString(),
      };
      const alreadyLinked = unified.ehrSources.some(s => s.ehrConnectionId === candidate.ehrConnectionId);
      const ehrSources = alreadyLinked
        ? unified.ehrSources.map(s => (s.ehrConnectionId === candidate.ehrConnectionId ? newSource : s))
        : [...unified.ehrSources, newSource];
      // best.confidence is always "high" | "medium" here (shouldMerge() already
      // filtered out weaker matches before `best` could be set), and
      // unified.matchConfidence is never "none" per the UnifiedPatient type, so
      // the weaker of the two is always a valid UnifiedPatient confidence.
      const matchConfidence = weakerConfidence(unified.matchConfidence, best.confidence) as "high" | "medium" | "low";

      await storage.updateUnifiedPatient(unified.id, { ehrSources, matchConfidence });
      logger.info(
        `[PatientIdentity] linked connection ${candidate.ehrConnectionId} to existing unified patient ${unified.id} (confidence=${best.confidence}, aggregate=${matchConfidence})`,
      );
      return { unifiedPatientId: unified.id, matchConfidence };
    }
  }

  const newUnified = await storage.createUnifiedPatient({
    firstName: candidate.firstName,
    middleName: "UNK",
    lastName: candidate.lastName,
    dateOfBirth: candidate.dateOfBirth,
    gender: "other",
    email: candidate.email ?? "",
    phone: candidate.phone ?? "",
    address: "",
    ehrSources: [
      {
        ehrConnectionId: candidate.ehrConnectionId,
        platform: candidate.platform,
        facilityName: candidate.facilityName,
        mrn: candidate.mrn,
        patientId: candidate.patientId,
        lastSync: new Date().toISOString(),
      },
    ],
    // A brand-new identity with exactly one linked source has nothing to
    // corroborate or contradict it yet, so it starts at "high" — the same
    // convention used when no cross-source matching is even attempted.
    matchConfidence: "high",
  });
  logger.info(
    `[PatientIdentity] created new unified patient ${newUnified.id} for connection ${candidate.ehrConnectionId}`,
  );
  return { unifiedPatientId: newUnified.id, matchConfidence: "high" };
}

function CONFIDENCE_RANK(c: MatchConfidence): number {
  return { high: 3, medium: 2, low: 1, none: 0 }[c];
}
