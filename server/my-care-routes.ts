/**
 * /api/my/care-summary — authenticated patient-facing personalized care endpoint.
 * Uses the caller's own GCIP session to look up their profiles, problems, and
 * medications, then evaluates USPSTF care gaps (NO CDS — informational only).
 */
import { Router } from "express";
import { requireRole } from "./rbac";
import { storage } from "./storage";
import { careGapsService, type CareGapPatientInput } from "./care-gaps-service";

const router = Router();

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const ms = Date.now() - new Date(dob).getTime();
  return Math.floor(ms / (365.25 * 24 * 3600 * 1000));
}

router.get(
  "/care-summary",
  requireRole("patient", "provider", "admin"),
  async (req: any, res) => {
    try {
      const userId: string = req.user.claims.sub;

      const profiles = await storage.getProfiles(userId);
      const profile = profiles.find((p) => p.isDefault) ?? profiles[0];

      if (!profile) {
        return res.json({
          profile: null,
          careGaps: null,
          problems: [],
          medications: [],
          disclaimer:
            "No profile found. Create a profile to see your personalised care summary.",
        });
      }

      const [problems, medications] = await Promise.all([
        storage.getProblemsByPatient(profile.id).catch(() => []),
        storage.getMedicationsByPatient(profile.id).catch(() => []),
      ]);

      const age = ageFromDob(profile.dateOfBirth);
      const activeProblems = problems.filter(
        (p) => p.status !== "resolved" && p.status !== "inactive",
      );
      const activeMeds = medications.filter((m) => m.status === "active");

      let careGaps = null;
      if (age !== null) {
        const sex = profile.gender === "male" ? "male" : "female";
        const input: CareGapPatientInput = {
          age,
          biologicalSex: sex,
          conditions: activeProblems.map((p) => p.icdCode ?? p.name).filter(Boolean),
          medications: activeMeds.map((m) => m.name).filter(Boolean),
        };
        careGaps = careGapsService.evaluate(input);
      }

      return res.json({
        profile: {
          name: `${profile.firstName} ${profile.lastName}`.trim(),
          age,
          gender: profile.gender,
          dateOfBirth: profile.dateOfBirth,
        },
        careGaps,
        problems: activeProblems.slice(0, 15),
        medications: activeMeds.slice(0, 15),
        disclaimer:
          "This summary is informational only. It does not constitute clinical advice. " +
          "Consult your healthcare provider for medical decisions.",
      });
    } catch (err) {
      console.error("[MyCare] care-summary error:", err);
      return res.status(500).json({ error: "Failed to load care summary." });
    }
  },
);

export default router;
