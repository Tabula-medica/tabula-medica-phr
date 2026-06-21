import { Router, Request, Response } from "express";

const router = Router();

interface ProfileData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  timezone: string;
  preferredLanguage: string;
}

interface FamilyMember {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string;
  dateOfBirth: string;
}

interface HealthGoal {
  id: string;
  category: string;
  name: string;
  target: string;
  isSelected: boolean;
}

interface Preferences {
  notifications: {
    appointments: boolean;
    medications: boolean;
    results: boolean;
    goals: boolean;
  };
  accessibility: {
    largeText: boolean;
    highContrast: boolean;
    simplifiedView: boolean;
  };
}

interface DocumentAction {
  type: string;
  provider?: string;
}

interface OnboardingData {
  profile: ProfileData;
  familyMembers: FamilyMember[];
  documentActions: DocumentAction[];
  goals: HealthGoal[];
  preferences: Preferences;
}

// In-memory storage for onboarding data
const onboardingStorage = new Map<string, OnboardingData>();

// Complete guided onboarding
router.post("/complete", async (req: Request, res: Response) => {
  try {
    const data = req.body as OnboardingData;
    
    // Validate required fields
    if (!data.profile?.firstName || !data.profile?.lastName || !data.profile?.dateOfBirth) {
      return res.status(400).json({ 
        error: "Missing required profile fields",
        required: ["firstName", "lastName", "dateOfBirth"]
      });
    }

    // Generate a unique ID for this onboarding session
    const onboardingId = `onboarding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Store the onboarding data
    onboardingStorage.set(onboardingId, data);

    // Log completion for audit purposes
    console.log(`[Guided Onboarding] Completed for ${data.profile.firstName} ${data.profile.lastName}`);
    console.log(`  - Family members: ${data.familyMembers?.length || 0}`);
    console.log(`  - Document actions: ${data.documentActions?.length || 0}`);
    console.log(`  - Health goals: ${data.goals?.length || 0}`);

    res.json({
      success: true,
      onboardingId,
      message: "Onboarding completed successfully",
      summary: {
        profileName: `${data.profile.firstName} ${data.profile.lastName}`,
        familyMemberCount: data.familyMembers?.length || 0,
        documentActionCount: data.documentActions?.length || 0,
        goalCount: data.goals?.length || 0,
        notificationsEnabled: Object.values(data.preferences?.notifications || {}).filter(Boolean).length,
        accessibilityEnabled: Object.values(data.preferences?.accessibility || {}).filter(Boolean).length,
      }
    });
  } catch (error) {
    console.error("[Guided Onboarding] Error:", error);
    res.status(500).json({ error: "Failed to complete onboarding" });
  }
});

// Get onboarding status
router.get("/status", async (req: Request, res: Response) => {
  try {
    // Check if user has completed onboarding
    const hasCompleted = onboardingStorage.size > 0;
    
    res.json({
      completed: hasCompleted,
      completedCount: onboardingStorage.size,
    });
  } catch (error) {
    console.error("[Guided Onboarding] Error:", error);
    res.status(500).json({ error: "Failed to get onboarding status" });
  }
});

// Get onboarding data by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = onboardingStorage.get(id);
    
    if (!data) {
      return res.status(404).json({ error: "Onboarding data not found" });
    }

    res.json(data);
  } catch (error) {
    console.error("[Guided Onboarding] Error:", error);
    res.status(500).json({ error: "Failed to get onboarding data" });
  }
});

export default router;
