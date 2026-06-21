import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import {
  insertPatientProfileSetupSchema,
  insertDataUsageConsentSchema,
  type PatientProfileSetup,
  type DataUsageConsent,
  type NewPatientOnboarding,
} from "@shared/schema";

const router = Router();

const onboardingSessions = new Map<string, NewPatientOnboarding>();
const patientProfiles = new Map<string, PatientProfileSetup>();
const dataConsents = new Map<string, DataUsageConsent>();

function getUserId(req: Request): string {
  return (req as any).userId || (req as any).user?.id || "anonymous";
}

router.post("/start", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);

    const existing = Array.from(onboardingSessions.values()).find(
      (s) => s.userId === userId && !s.completedAt
    );
    if (existing) {
      return res.json({ session: existing, resumed: true });
    }

    const session: NewPatientOnboarding = {
      id: randomUUID(),
      userId,
      currentStep: "welcome",
      tutorialCompleted: false,
      startedAt: new Date().toISOString(),
    };
    onboardingSessions.set(session.id, session);

    res.json({ session, resumed: false });
  } catch (error) {
    console.error("[NewOnboarding] Start error:", error);
    res.status(500).json({ error: "Failed to start onboarding" });
  }
});

router.get("/session", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const session = Array.from(onboardingSessions.values()).find(
      (s) => s.userId === userId
    );

    if (!session) {
      return res.json({ session: null });
    }

    const profile = session.profileId
      ? patientProfiles.get(session.profileId)
      : undefined;
    const consent = session.consentId
      ? dataConsents.get(session.consentId)
      : undefined;

    res.json({ session, profile: profile || null, consent: consent || null });
  } catch (error) {
    console.error("[NewOnboarding] Get session error:", error);
    res.status(500).json({ error: "Failed to get onboarding session" });
  }
});

router.post("/profile", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const session = Array.from(onboardingSessions.values()).find(
      (s) => s.userId === userId && !s.completedAt
    );

    if (!session) {
      return res.status(404).json({ error: "No active onboarding session" });
    }

    const parsed = insertPatientProfileSetupSchema.safeParse({
      ...req.body,
      userId,
    });
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: parsed.error.issues });
    }

    const now = new Date().toISOString();
    const profile: PatientProfileSetup = {
      id: session.profileId || randomUUID(),
      ...parsed.data,
      createdAt: now,
      updatedAt: now,
    };

    patientProfiles.set(profile.id, profile);

    session.profileId = profile.id;
    session.currentStep = "consent";
    onboardingSessions.set(session.id, session);

    res.json({ profile, session });
  } catch (error) {
    console.error("[NewOnboarding] Save profile error:", error);
    res.status(500).json({ error: "Failed to save profile" });
  }
});

router.post("/consent", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const session = Array.from(onboardingSessions.values()).find(
      (s) => s.userId === userId && !s.completedAt
    );

    if (!session) {
      return res.status(404).json({ error: "No active onboarding session" });
    }

    const parsed = insertDataUsageConsentSchema.safeParse({
      ...req.body,
      userId,
    });
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: parsed.error.issues });
    }

    if (!parsed.data.healthDataSharing) {
      return res.status(400).json({
        error: "Health Data Sharing consent is required to use the platform",
      });
    }

    const consent: DataUsageConsent = {
      id: session.consentId || randomUUID(),
      ...parsed.data,
      consentTimestamp: new Date().toISOString(),
    };

    dataConsents.set(consent.id, consent);

    session.consentId = consent.id;
    session.currentStep = "tutorial";
    onboardingSessions.set(session.id, session);

    res.json({ consent, session });
  } catch (error) {
    console.error("[NewOnboarding] Save consent error:", error);
    res.status(500).json({ error: "Failed to save consent" });
  }
});

router.post("/tutorial-complete", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const session = Array.from(onboardingSessions.values()).find(
      (s) => s.userId === userId && !s.completedAt
    );

    if (!session) {
      return res.status(404).json({ error: "No active onboarding session" });
    }

    session.tutorialCompleted = true;
    session.currentStep = "complete";
    onboardingSessions.set(session.id, session);

    res.json({ session });
  } catch (error) {
    console.error("[NewOnboarding] Tutorial complete error:", error);
    res.status(500).json({ error: "Failed to mark tutorial complete" });
  }
});

router.post("/complete", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const session = Array.from(onboardingSessions.values()).find(
      (s) => s.userId === userId && !s.completedAt
    );

    if (!session) {
      return res.status(404).json({ error: "No active onboarding session" });
    }

    session.completedAt = new Date().toISOString();
    session.currentStep = "complete";
    onboardingSessions.set(session.id, session);

    const profile = session.profileId
      ? patientProfiles.get(session.profileId)
      : null;
    const consent = session.consentId
      ? dataConsents.get(session.consentId)
      : null;

    res.json({
      session,
      profile,
      consent,
      message: "Onboarding completed successfully",
    });
  } catch (error) {
    console.error("[NewOnboarding] Complete error:", error);
    res.status(500).json({ error: "Failed to complete onboarding" });
  }
});

router.get("/profile", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const profile = Array.from(patientProfiles.values()).find(
      (p) => p.userId === userId
    );
    res.json({ profile: profile || null });
  } catch (error) {
    console.error("[NewOnboarding] Get profile error:", error);
    res.status(500).json({ error: "Failed to get profile" });
  }
});

router.get("/consent", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const consent = Array.from(dataConsents.values()).find(
      (c) => c.userId === userId && !c.revokedAt
    );
    res.json({ consent: consent || null });
  } catch (error) {
    console.error("[NewOnboarding] Get consent error:", error);
    res.status(500).json({ error: "Failed to get consent" });
  }
});

export default router;
