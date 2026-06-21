import { Router } from "express";
import * as unifiedOnboarding from "./services/unified-ai-onboarding-service";
import crypto from "crypto";

const router = Router();

function hashIdentifier(id: string): string {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 16);
}

function logHipaaAudit(action: string, userId: string, resourceType: string, resourceId: string, details: string) {
  console.log(`[HIPAA-AUDIT][UnifiedOnboardingRoutes] ${action} - ${resourceType}/${resourceId} by ${hashIdentifier(userId)}: ${details}`);
}

router.get("/api/unified-onboarding/languages", async (req, res) => {
  try {
    const languages = unifiedOnboarding.getSupportedLanguagesList();
    res.json({ success: true, data: languages });
  } catch (error) {
    console.error("[UnifiedOnboarding] Get languages error:", error);
    res.status(500).json({ success: false, error: "Failed to get supported languages" });
  }
});

router.post("/api/unified-onboarding/start", async (req, res) => {
  try {
    const { patientId, patientName, populationType, languagePreference } = req.body;

    if (!patientId || !populationType || !languagePreference) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required fields: patientId, populationType, languagePreference" 
      });
    }

    logHipaaAudit("START_ONBOARDING", patientId, "OnboardingWorkflow", "new", `Starting ${populationType} onboarding`);

    const result = await unifiedOnboarding.startOnboarding(
      patientId,
      patientName || "",
      populationType,
      languagePreference
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[UnifiedOnboarding] Start onboarding error:", error);
    res.status(500).json({ success: false, error: "Failed to start onboarding" });
  }
});

router.get("/api/unified-onboarding/workflow/:workflowId", async (req, res) => {
  try {
    const workflow = unifiedOnboarding.getOnboardingWorkflow(req.params.workflowId);
    if (!workflow) {
      return res.status(404).json({ success: false, error: "Workflow not found" });
    }

    logHipaaAudit("VIEW_WORKFLOW", workflow.patientId, "OnboardingWorkflow", workflow.id, "Viewed workflow");
    res.json({ success: true, data: workflow });
  } catch (error) {
    console.error("[UnifiedOnboarding] Get workflow error:", error);
    res.status(500).json({ success: false, error: "Failed to get workflow" });
  }
});

router.get("/api/unified-onboarding/patient/:patientId/workflow", async (req, res) => {
  try {
    const workflow = unifiedOnboarding.getWorkflowByPatientId(req.params.patientId);
    if (!workflow) {
      return res.status(404).json({ success: false, error: "No active workflow found for patient" });
    }

    logHipaaAudit("VIEW_WORKFLOW", req.params.patientId, "OnboardingWorkflow", workflow.id, "Viewed patient workflow");
    res.json({ success: true, data: workflow });
  } catch (error) {
    console.error("[UnifiedOnboarding] Get patient workflow error:", error);
    res.status(500).json({ success: false, error: "Failed to get patient workflow" });
  }
});

router.post("/api/unified-onboarding/workflow/:workflowId/step/:stepId/complete", async (req, res) => {
  try {
    const { workflowId, stepId } = req.params;
    const { stepData } = req.body;

    const workflow = await unifiedOnboarding.completeOnboardingStep(workflowId, stepId, stepData);

    logHipaaAudit("COMPLETE_STEP", workflow.patientId, "OnboardingStep", stepId, "Step completed");

    res.json({ success: true, data: workflow });
  } catch (error: any) {
    console.error("[UnifiedOnboarding] Complete step error:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to complete step" });
  }
});

router.post("/api/unified-onboarding/workflow/:workflowId/step/:stepId/skip", async (req, res) => {
  try {
    const { workflowId, stepId } = req.params;

    const workflow = unifiedOnboarding.skipOnboardingStep(workflowId, stepId);

    logHipaaAudit("SKIP_STEP", workflow.patientId, "OnboardingStep", stepId, "Step skipped");

    res.json({ success: true, data: workflow });
  } catch (error: any) {
    console.error("[UnifiedOnboarding] Skip step error:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to skip step" });
  }
});

router.get("/api/unified-onboarding/profile/:profileId", async (req, res) => {
  try {
    const profile = unifiedOnboarding.getPatientProfile(req.params.profileId);
    if (!profile) {
      return res.status(404).json({ success: false, error: "Profile not found" });
    }

    logHipaaAudit("VIEW_PROFILE", profile.userId, "PatientProfile", profile.id, "Viewed profile");
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error("[UnifiedOnboarding] Get profile error:", error);
    res.status(500).json({ success: false, error: "Failed to get profile" });
  }
});

router.patch("/api/unified-onboarding/profile/:profileId", async (req, res) => {
  try {
    const profile = unifiedOnboarding.updatePatientProfile(req.params.profileId, req.body);

    logHipaaAudit("UPDATE_PROFILE", profile.userId, "PatientProfile", profile.id, "Profile updated");

    res.json({ success: true, data: profile });
  } catch (error: any) {
    console.error("[UnifiedOnboarding] Update profile error:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to update profile" });
  }
});

router.get("/api/unified-onboarding/tutorials", async (req, res) => {
  try {
    const tutorials = unifiedOnboarding.getAllTutorials();
    res.json({ success: true, data: tutorials });
  } catch (error) {
    console.error("[UnifiedOnboarding] Get tutorials error:", error);
    res.status(500).json({ success: false, error: "Failed to get tutorials" });
  }
});

router.get("/api/unified-onboarding/tutorials/:tutorialId", async (req, res) => {
  try {
    const { language } = req.query;
    const tutorial = unifiedOnboarding.getTutorial(
      req.params.tutorialId, 
      (language as unifiedOnboarding.SupportedLanguage) || "en"
    );
    if (!tutorial) {
      return res.status(404).json({ success: false, error: "Tutorial not found" });
    }

    res.json({ success: true, data: tutorial });
  } catch (error) {
    console.error("[UnifiedOnboarding] Get tutorial error:", error);
    res.status(500).json({ success: false, error: "Failed to get tutorial" });
  }
});

router.get("/api/unified-onboarding/workflow/:workflowId/reminders", async (req, res) => {
  try {
    const reminders = unifiedOnboarding.getPendingReminders(req.params.workflowId);
    res.json({ success: true, data: reminders });
  } catch (error) {
    console.error("[UnifiedOnboarding] Get reminders error:", error);
    res.status(500).json({ success: false, error: "Failed to get reminders" });
  }
});

router.post("/api/unified-onboarding/reminders/:reminderId/sent", async (req, res) => {
  try {
    unifiedOnboarding.markReminderSent(req.params.reminderId);
    res.json({ success: true, message: "Reminder marked as sent" });
  } catch (error) {
    console.error("[UnifiedOnboarding] Mark reminder sent error:", error);
    res.status(500).json({ success: false, error: "Failed to mark reminder sent" });
  }
});

router.get("/api/unified-onboarding/analytics", async (req, res) => {
  try {
    const analytics = unifiedOnboarding.getOnboardingAnalytics();
    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error("[UnifiedOnboarding] Get analytics error:", error);
    res.status(500).json({ success: false, error: "Failed to get analytics" });
  }
});

export function registerUnifiedOnboardingRoutes(app: any) {
  app.use(router);
  console.log("[Routes] Unified AI Onboarding routes registered at /api/unified-onboarding/*");
}

export default router;
