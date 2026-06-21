import { Router } from "express";
import {
  insertSurvivorshipProfileSchema,
  insertFollowUpScheduleSchema,
  insertFollowUpCompletionSchema,
  insertLateEffectWatchlistItemSchema,
  SurvivorshipProfile,
  FollowUpSchedule,
  FollowUpCompletion,
  LateEffectWatchlistItem,
  treatmentLateEffectMap,
  SurvivorshipTreatmentType,
  LateEffectType,
  SurvivorshipPhase,
  lateEffectLabels,
  survivorshipTreatmentTypeLabels,
} from "@shared/schema";
import { randomUUID } from "crypto";

// Interface for personalized late effect suggestions
interface LateEffectSuggestion {
  id: string;
  effectType: LateEffectType;
  effectLabel: string;
  relatedTreatments: SurvivorshipTreatmentType[];
  reason: string;
  priority: "high" | "medium" | "low";
  monitoringTips: string[];
  relatedResourceCategories: string[];
  isAlreadyWatching: boolean;
}

interface PersonalizedWatchlistResponse {
  suggestions: LateEffectSuggestion[];
  aiGenerated: boolean;
  disclaimer: string;
  basedOn: {
    treatments: string[];
    cancerType: string;
    yearsSinceTreatment: number;
    reportedSymptoms: string[];
  };
}

const router = Router();

function logPhiAccess(action: string, details: Record<string, unknown>): void {
  console.log(JSON.stringify({
    type: "HIPAA_AUDIT",
    timestamp: new Date().toISOString(),
    component: "Survivorship",
    action,
    details,
  }));
}

const survivorshipProfilesStore: Map<string, SurvivorshipProfile> = new Map();
const followUpSchedulesStore: Map<string, FollowUpSchedule> = new Map();
const followUpCompletionsStore: Map<string, FollowUpCompletion> = new Map();
const lateEffectsWatchlistStore: Map<string, LateEffectWatchlistItem> = new Map();

function calculateNextDueDate(
  frequency: string,
  customIntervalDays?: number,
  fromDate?: string
): string {
  const base = fromDate ? new Date(fromDate) : new Date();
  let daysToAdd = 365;

  switch (frequency) {
    case "monthly":
      daysToAdd = 30;
      break;
    case "quarterly":
      daysToAdd = 90;
      break;
    case "biannually":
      daysToAdd = 180;
      break;
    case "annually":
      daysToAdd = 365;
      break;
    case "custom":
      daysToAdd = customIntervalDays || 365;
      break;
  }

  base.setDate(base.getDate() + daysToAdd);
  return base.toISOString().split("T")[0];
}

function getSurvivorshipPhase(treatmentEndDate: string): SurvivorshipPhase {
  const endDate = new Date(treatmentEndDate);
  const now = new Date();
  const yearsSinceEnd =
    (now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

  if (yearsSinceEnd <= 1) return "high_intensity";
  if (yearsSinceEnd <= 5) return "medium_intensity";
  return "low_intensity";
}

function getYearsSinceTreatment(treatmentEndDate: string): number {
  const endDate = new Date(treatmentEndDate);
  const now = new Date();
  return Math.floor(
    (now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
  );
}

function initializeSampleData() {
  const sampleProfileId = "profile-default";

  if (survivorshipProfilesStore.size === 0) {
    const survivorshipProfile: SurvivorshipProfile = {
      id: "surv-1",
      profileId: sampleProfileId,
      diagnosisDate: "2021-03-15",
      cancerType: "Breast Cancer",
      stage: "Stage II",
      treatmentEndDate: "2022-01-20",
      treatments: ["chemotherapy", "surgery", "radiation", "hormone_therapy"],
      notes: "Completed 6 cycles of chemotherapy, bilateral mastectomy, and radiation. Currently on hormone therapy.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    survivorshipProfilesStore.set(survivorshipProfile.id, survivorshipProfile);

    const followUps: FollowUpSchedule[] = [
      {
        id: "fu-1",
        profileId: sampleProfileId,
        survivorshipProfileId: "surv-1",
        title: "Annual Oncology Follow-up",
        category: "oncology",
        frequency: "annually",
        startDate: "2022-01-20",
        nextDueDate: "2026-01-20",
        lastCompletedDate: "2025-01-15",
        notes: "Annual check with oncologist",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "fu-2",
        profileId: sampleProfileId,
        survivorshipProfileId: "surv-1",
        title: "Mammogram",
        category: "imaging",
        frequency: "annually",
        startDate: "2022-06-01",
        nextDueDate: "2026-06-01",
        lastCompletedDate: "2025-06-10",
        notes: "Annual screening mammogram",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "fu-3",
        profileId: sampleProfileId,
        survivorshipProfileId: "surv-1",
        title: "Cardio-Oncology Check",
        category: "cardiac",
        frequency: "annually",
        startDate: "2022-03-01",
        nextDueDate: "2026-03-15",
        lastCompletedDate: "2025-03-10",
        notes: "Echo and cardiology review - anthracycline exposure",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "fu-4",
        profileId: sampleProfileId,
        survivorshipProfileId: "surv-1",
        title: "DEXA Bone Density Scan",
        category: "bone_health",
        frequency: "biannually",
        startDate: "2022-06-01",
        nextDueDate: "2026-06-01",
        lastCompletedDate: "2025-01-05",
        notes: "Bone density monitoring due to hormone therapy",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "fu-5",
        profileId: sampleProfileId,
        survivorshipProfileId: "surv-1",
        title: "Thyroid Function Labs",
        category: "lab_work",
        frequency: "annually",
        startDate: "2022-06-01",
        nextDueDate: "2026-02-01",
        lastCompletedDate: "2025-02-01",
        notes: "TSH monitoring post-radiation",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "fu-6",
        profileId: sampleProfileId,
        survivorshipProfileId: "surv-1",
        title: "Skin Check",
        category: "skin",
        frequency: "annually",
        startDate: "2022-09-01",
        nextDueDate: "2026-09-01",
        lastCompletedDate: "2025-09-15",
        notes: "Full body skin exam with dermatologist",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "fu-7",
        profileId: sampleProfileId,
        survivorshipProfileId: "surv-1",
        title: "Flu Vaccine",
        category: "vaccination",
        frequency: "annually",
        startDate: "2022-10-01",
        nextDueDate: "2026-10-01",
        lastCompletedDate: "2025-10-05",
        notes: "Annual flu shot - important post-chemo",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    followUps.forEach((fu) => followUpSchedulesStore.set(fu.id, fu));

    const lateEffects: LateEffectWatchlistItem[] = [
      {
        id: "le-1",
        profileId: sampleProfileId,
        survivorshipProfileId: "surv-1",
        effectType: "neuropathy",
        relatedTreatment: "chemotherapy",
        severity: "mild",
        status: "detected",
        notes: "Mild tingling in fingertips, stable",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "le-2",
        profileId: sampleProfileId,
        survivorshipProfileId: "surv-1",
        effectType: "cardiomyopathy",
        relatedTreatment: "chemotherapy",
        status: "watching",
        notes: "Monitoring due to anthracycline exposure",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "le-3",
        profileId: sampleProfileId,
        survivorshipProfileId: "surv-1",
        effectType: "cognitive_changes",
        relatedTreatment: "chemotherapy",
        severity: "mild",
        status: "detected",
        notes: "Occasional word-finding difficulties",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "le-4",
        profileId: sampleProfileId,
        survivorshipProfileId: "surv-1",
        effectType: "lymphedema",
        relatedTreatment: "surgery",
        status: "watching",
        notes: "No current symptoms, wearing compression during flights",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "le-5",
        profileId: sampleProfileId,
        survivorshipProfileId: "surv-1",
        effectType: "osteoporosis",
        relatedTreatment: "hormone_therapy",
        status: "watching",
        notes: "Baseline DEXA normal, continuing monitoring",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "le-6",
        profileId: sampleProfileId,
        survivorshipProfileId: "surv-1",
        effectType: "hypothyroidism",
        relatedTreatment: "radiation",
        status: "watching",
        notes: "TSH normal on last labs",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "le-7",
        profileId: sampleProfileId,
        survivorshipProfileId: "surv-1",
        effectType: "secondary_malignancy",
        relatedTreatment: "radiation",
        status: "watching",
        notes: "Ongoing screening per guidelines",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    lateEffects.forEach((le) => lateEffectsWatchlistStore.set(le.id, le));
  }
}

initializeSampleData();

router.get("/api/survivorship/profiles", (req, res) => {
  const { profileId } = req.query;
  let profiles = Array.from(survivorshipProfilesStore.values());

  if (profileId) {
    profiles = profiles.filter((p) => p.profileId === profileId);
  }

  res.json(profiles);
});

router.get("/api/survivorship/profiles/:survivorshipId", (req, res) => {
  const { survivorshipId } = req.params;
  const profile = survivorshipProfilesStore.get(survivorshipId);
  if (!profile) {
    return res.status(404).json({ error: "Survivorship profile not found" });
  }

  const phase = profile.treatmentEndDate
    ? getSurvivorshipPhase(profile.treatmentEndDate)
    : "high_intensity";
  const yearsSinceTreatment = profile.treatmentEndDate
    ? getYearsSinceTreatment(profile.treatmentEndDate)
    : 0;

  res.json({
    ...profile,
    currentPhase: phase,
    yearsSinceTreatment,
  });
});

router.post("/api/survivorship/profiles", (req, res) => {
  const parseResult = insertSurvivorshipProfileSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parseResult.error.errors });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const profile: SurvivorshipProfile = {
    ...parseResult.data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  survivorshipProfilesStore.set(id, profile);

  if (parseResult.data.treatments && parseResult.data.treatments.length > 0) {
    const allEffects = new Set<LateEffectType>();
    parseResult.data.treatments.forEach((treatment) => {
      const effects = treatmentLateEffectMap[treatment as SurvivorshipTreatmentType] || [];
      effects.forEach((effect) => allEffects.add(effect));
    });

    allEffects.forEach((effectType) => {
      const leId = randomUUID();
      const treatment = parseResult.data.treatments?.find((t) =>
        (treatmentLateEffectMap[t as SurvivorshipTreatmentType] || []).includes(effectType)
      );
      const lateEffect: LateEffectWatchlistItem = {
        id: leId,
        profileId: parseResult.data.profileId,
        survivorshipProfileId: id,
        effectType,
        relatedTreatment: treatment as SurvivorshipTreatmentType,
        status: "watching",
        createdAt: now,
        updatedAt: now,
      };
      lateEffectsWatchlistStore.set(leId, lateEffect);
    });
  }

  res.status(201).json(profile);
});

router.patch("/api/survivorship/profiles/:survivorshipId", (req, res) => {
  const { survivorshipId } = req.params;
  const existing = survivorshipProfilesStore.get(survivorshipId);
  if (!existing) {
    return res.status(404).json({ error: "Survivorship profile not found" });
  }

  const updated: SurvivorshipProfile = {
    ...existing,
    ...req.body,
    id: survivorshipId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  survivorshipProfilesStore.set(survivorshipId, updated);
  res.json(updated);
});

router.get("/api/survivorship/timeline/:survivorshipId", (req, res) => {
  const { survivorshipId } = req.params;
  const profile = survivorshipProfilesStore.get(survivorshipId);
  if (!profile) {
    return res.status(404).json({ error: "Survivorship profile not found" });
  }

  const treatmentEndDate = profile.treatmentEndDate || profile.diagnosisDate;
  const endDate = new Date(treatmentEndDate);
  const now = new Date();
  const yearsSinceTreatment = getYearsSinceTreatment(treatmentEndDate);

  const phases = [
    {
      phase: "high_intensity" as SurvivorshipPhase,
      label: "High Intensity",
      description: "Year 0-1: Frequent monitoring, recovery focus",
      years: "0-1",
      startYear: 0,
      endYear: 1,
      isCurrent: yearsSinceTreatment >= 0 && yearsSinceTreatment < 1,
      isPast: yearsSinceTreatment >= 1,
    },
    {
      phase: "medium_intensity" as SurvivorshipPhase,
      label: "Medium Intensity",
      description: "Years 2-5: Regular follow-ups, late effect monitoring",
      years: "2-5",
      startYear: 1,
      endYear: 5,
      isCurrent: yearsSinceTreatment >= 1 && yearsSinceTreatment < 5,
      isPast: yearsSinceTreatment >= 5,
    },
    {
      phase: "low_intensity" as SurvivorshipPhase,
      label: "Low Intensity",
      description: "Years 5-10+: Annual monitoring, long-term survivorship",
      years: "5-10+",
      startYear: 5,
      endYear: 15,
      isCurrent: yearsSinceTreatment >= 5,
      isPast: false,
    },
  ];

  const milestones = [];

  const diagnosisDate = new Date(profile.diagnosisDate);
  milestones.push({
    date: profile.diagnosisDate,
    label: "Diagnosis",
    type: "diagnosis",
    yearsFromEnd: Math.floor(
      (endDate.getTime() - diagnosisDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
    ) * -1,
  });

  if (profile.treatmentEndDate) {
    milestones.push({
      date: profile.treatmentEndDate,
      label: "Treatment Completed",
      type: "treatment_end",
      yearsFromEnd: 0,
    });
  }

  [1, 2, 3, 5, 10].forEach((year) => {
    const anniversaryDate = new Date(endDate);
    anniversaryDate.setFullYear(anniversaryDate.getFullYear() + year);
    if (anniversaryDate <= now) {
      milestones.push({
        date: anniversaryDate.toISOString().split("T")[0],
        label: `${year} Year Anniversary`,
        type: "anniversary",
        yearsFromEnd: year,
      });
    } else if (year <= yearsSinceTreatment + 2) {
      milestones.push({
        date: anniversaryDate.toISOString().split("T")[0],
        label: `${year} Year Anniversary (Upcoming)`,
        type: "upcoming_anniversary",
        yearsFromEnd: year,
      });
    }
  });

  res.json({
    profile: {
      ...profile,
      currentPhase: getSurvivorshipPhase(treatmentEndDate),
      yearsSinceTreatment,
    },
    phases,
    milestones: milestones.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    ),
  });
});

router.get("/api/survivorship/follow-ups", (req, res) => {
  const { profileId, survivorshipProfileId, overdue, category } = req.query;
  let followUps = Array.from(followUpSchedulesStore.values());

  if (profileId) {
    followUps = followUps.filter((f) => f.profileId === profileId);
  }

  if (survivorshipProfileId) {
    followUps = followUps.filter(
      (f) => f.survivorshipProfileId === survivorshipProfileId
    );
  }

  if (category) {
    followUps = followUps.filter((f) => f.category === category);
  }

  const now = new Date();
  followUps = followUps.map((f) => ({
    ...f,
    isOverdue: new Date(f.nextDueDate) < now,
    daysUntilDue: Math.ceil(
      (new Date(f.nextDueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));

  if (overdue === "true") {
    followUps = followUps.filter((f: any) => f.isOverdue);
  }

  followUps.sort(
    (a, b) =>
      new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
  );

  res.json(followUps);
});

router.post("/api/survivorship/follow-ups", (req, res) => {
  const parseResult = insertFollowUpScheduleSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parseResult.error.errors });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const followUp: FollowUpSchedule = {
    ...parseResult.data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  followUpSchedulesStore.set(id, followUp);
  res.status(201).json(followUp);
});

router.patch("/api/survivorship/follow-ups/:followUpId", (req, res) => {
  const { followUpId } = req.params;
  const existing = followUpSchedulesStore.get(followUpId);
  if (!existing) {
    return res.status(404).json({ error: "Follow-up schedule not found" });
  }

  const updated: FollowUpSchedule = {
    ...existing,
    ...req.body,
    id: followUpId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  followUpSchedulesStore.set(followUpId, updated);
  res.json(updated);
});

router.delete("/api/survivorship/follow-ups/:followUpId", (req, res) => {
  const { followUpId } = req.params;
  if (!followUpSchedulesStore.has(followUpId)) {
    return res.status(404).json({ error: "Follow-up schedule not found" });
  }
  followUpSchedulesStore.delete(followUpId);
  res.status(204).send();
});

router.post("/api/survivorship/follow-ups/:followUpId/complete", (req, res) => {
  const { followUpId } = req.params;
  const followUp = followUpSchedulesStore.get(followUpId);
  if (!followUp) {
    return res.status(404).json({ error: "Follow-up schedule not found" });
  }

  const completedDate =
    req.body.completedDate || new Date().toISOString().split("T")[0];
  const now = new Date().toISOString();

  const completion: FollowUpCompletion = {
    id: randomUUID(),
    profileId: followUp.profileId,
    followUpScheduleId: followUpId,
    completedDate,
    notes: req.body.notes,
    results: req.body.results,
    createdAt: now,
  };

  followUpCompletionsStore.set(completion.id, completion);

  const nextDue = calculateNextDueDate(
    followUp.frequency,
    followUp.customIntervalDays,
    completedDate
  );

  const updatedFollowUp: FollowUpSchedule = {
    ...followUp,
    lastCompletedDate: completedDate,
    nextDueDate: nextDue,
    updatedAt: now,
  };

  followUpSchedulesStore.set(followUpId, updatedFollowUp);

  res.json({ completion, followUp: updatedFollowUp });
});

router.get("/api/survivorship/follow-ups/:followUpId/history", (req, res) => {
  const { followUpId } = req.params;
  const completions = Array.from(followUpCompletionsStore.values())
    .filter((c) => c.followUpScheduleId === followUpId)
    .sort(
      (a, b) =>
        new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime()
    );
  res.json(completions);
});

router.get("/api/survivorship/late-effects", (req, res) => {
  const { profileId, survivorshipProfileId, status } = req.query;
  let effects = Array.from(lateEffectsWatchlistStore.values());

  if (profileId) {
    effects = effects.filter((e) => e.profileId === profileId);
  }

  if (survivorshipProfileId) {
    effects = effects.filter(
      (e) => e.survivorshipProfileId === survivorshipProfileId
    );
  }

  if (status) {
    effects = effects.filter((e) => e.status === status);
  }

  res.json(effects);
});

router.post("/api/survivorship/late-effects", (req, res) => {
  const parseResult = insertLateEffectWatchlistItemSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parseResult.error.errors });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const effect: LateEffectWatchlistItem = {
    ...parseResult.data,
    id,
    createdAt: now,
    updatedAt: now,
  };

  lateEffectsWatchlistStore.set(id, effect);
  res.status(201).json(effect);
});

router.patch("/api/survivorship/late-effects/:effectId", (req, res) => {
  const { effectId } = req.params;
  const existing = lateEffectsWatchlistStore.get(effectId);
  if (!existing) {
    return res.status(404).json({ error: "Late effect not found" });
  }

  const updated: LateEffectWatchlistItem = {
    ...existing,
    ...req.body,
    id: effectId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };

  lateEffectsWatchlistStore.set(effectId, updated);
  res.json(updated);
});

router.delete("/api/survivorship/late-effects/:effectId", (req, res) => {
  const { effectId } = req.params;
  if (!lateEffectsWatchlistStore.has(effectId)) {
    return res.status(404).json({ error: "Late effect not found" });
  }
  lateEffectsWatchlistStore.delete(effectId);
  res.status(204).send();
});

router.get("/api/survivorship/dashboard", (req, res) => {
  const { profileId } = req.query;

  const profiles = Array.from(survivorshipProfilesStore.values()).filter(
    (p) => !profileId || p.profileId === profileId
  );

  if (profiles.length === 0) {
    return res.json({
      hasProfile: false,
      message: "No survivorship profile found",
    });
  }

  const profile = profiles[0];
  const treatmentEndDate = profile.treatmentEndDate || profile.diagnosisDate;

  const followUps = Array.from(followUpSchedulesStore.values())
    .filter((f) => f.survivorshipProfileId === profile.id && f.isActive)
    .map((f) => {
      const now = new Date();
      const dueDate = new Date(f.nextDueDate);
      return {
        ...f,
        isOverdue: dueDate < now,
        daysUntilDue: Math.ceil(
          (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        ),
      };
    });

  const overdueFollowUps = followUps.filter((f) => f.isOverdue);
  const upcomingFollowUps = followUps
    .filter((f) => !f.isOverdue && f.daysUntilDue <= 90)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const lateEffects = Array.from(lateEffectsWatchlistStore.values()).filter(
    (e) => e.survivorshipProfileId === profile.id
  );

  const watchingEffects = lateEffects.filter((e) => e.status === "watching");
  const detectedEffects = lateEffects.filter((e) => e.status === "detected");

  res.json({
    hasProfile: true,
    profile: {
      ...profile,
      currentPhase: getSurvivorshipPhase(treatmentEndDate),
      yearsSinceTreatment: getYearsSinceTreatment(treatmentEndDate),
    },
    summary: {
      totalFollowUps: followUps.length,
      overdueCount: overdueFollowUps.length,
      upcomingCount: upcomingFollowUps.length,
      watchingEffectsCount: watchingEffects.length,
      detectedEffectsCount: detectedEffects.length,
    },
    overdueFollowUps: overdueFollowUps.slice(0, 5),
    upcomingFollowUps: upcomingFollowUps.slice(0, 5),
    detectedEffects: detectedEffects.slice(0, 5),
  });
});

// ============================================
// AI-POWERED PERSONALIZED LATE EFFECTS WATCHLIST
// ============================================

// Late effect to support resource category mapping
const lateEffectResourceMap: Record<LateEffectType, string[]> = {
  neuropathy: ["educational_materials", "mental_health"],
  cardiomyopathy: ["educational_materials", "clinical_trials"],
  cognitive_changes: ["mental_health", "educational_materials", "caregiver_support"],
  lymphedema: ["educational_materials", "community_forums"],
  osteoporosis: ["educational_materials", "nutritional_support"],
  hypothyroidism: ["educational_materials"],
  infertility: ["mental_health", "advocacy_groups", "community_forums"],
  secondary_malignancy: ["clinical_trials", "advocacy_groups", "educational_materials"],
  fatigue: ["mental_health", "nutritional_support", "community_forums"],
  hearing_loss: ["educational_materials", "advocacy_groups"],
  pulmonary: ["educational_materials", "clinical_trials"],
  dental: ["educational_materials"],
  vision: ["educational_materials"],
  other: ["educational_materials", "community_forums"],
};

// Priority based on treatment combinations and time since treatment
function calculateEffectPriority(
  effect: LateEffectType,
  treatments: string[],
  yearsSinceTreatment: number
): "high" | "medium" | "low" {
  const highPriorityEffects: LateEffectType[] = ["cardiomyopathy", "secondary_malignancy", "pulmonary"];
  const earlyOnsetEffects: LateEffectType[] = ["neuropathy", "fatigue", "cognitive_changes"];
  
  if (highPriorityEffects.includes(effect)) return "high";
  if (yearsSinceTreatment <= 2 && earlyOnsetEffects.includes(effect)) return "high";
  if (yearsSinceTreatment <= 5) return "medium";
  return "low";
}

// Get monitoring tips for each effect type (educational, NO-CDS compliant)
function getMonitoringTips(effect: LateEffectType): string[] {
  const tips: Record<LateEffectType, string[]> = {
    neuropathy: [
      "Track any numbness or tingling sensations in hands/feet",
      "Note changes in balance or coordination",
      "Document when symptoms occur and their duration",
    ],
    cardiomyopathy: [
      "Monitor for shortness of breath during normal activities",
      "Track any unusual fatigue or swelling",
      "Keep records of blood pressure and heart rate if measured",
    ],
    cognitive_changes: [
      "Note memory or concentration difficulties",
      "Track word-finding challenges or mental fog episodes",
      "Document strategies that help (lists, reminders)",
    ],
    lymphedema: [
      "Watch for swelling in affected limbs",
      "Note any heaviness or tightness sensations",
      "Track triggers like travel or heat exposure",
    ],
    osteoporosis: [
      "Document any bone pain or discomfort",
      "Track calcium and vitamin D intake",
      "Note any falls or balance issues",
    ],
    hypothyroidism: [
      "Track energy levels and fatigue patterns",
      "Note weight changes or temperature sensitivity",
      "Document any mood changes",
    ],
    infertility: [
      "Keep records of menstrual cycle changes (if applicable)",
      "Document discussions with reproductive specialists",
      "Track any fertility preservation steps taken",
    ],
    secondary_malignancy: [
      "Stay current with recommended screening schedules",
      "Note any new lumps, bumps, or skin changes",
      "Track any unexplained symptoms",
    ],
    fatigue: [
      "Rate daily energy levels on a 1-10 scale",
      "Track sleep quality and duration",
      "Note activities that improve or worsen fatigue",
    ],
    hearing_loss: [
      "Note difficulty hearing in specific environments",
      "Track ringing in ears (tinnitus) episodes",
      "Document any hearing test results",
    ],
    pulmonary: [
      "Track shortness of breath or coughing",
      "Note breathing difficulties during exercise",
      "Document any respiratory infections",
    ],
    dental: [
      "Track dry mouth episodes",
      "Note any tooth sensitivity or decay",
      "Document dental visits and findings",
    ],
    vision: [
      "Note any vision changes or blurriness",
      "Track dry eye symptoms",
      "Document eye exam results",
    ],
    other: [
      "Document any new or unusual symptoms",
      "Track when symptoms occur and their severity",
      "Note what helps relieve symptoms",
    ],
  };
  return tips[effect] || tips.other;
}

router.post("/api/survivorship/personalized-watchlist", async (req, res) => {
  const { survivorshipProfileId, reportedSymptoms = [] } = req.body;

  if (!survivorshipProfileId) {
    return res.status(400).json({ error: "survivorshipProfileId is required" });
  }

  const profile = survivorshipProfilesStore.get(survivorshipProfileId);
  if (!profile) {
    return res.status(404).json({ error: "Survivorship profile not found" });
  }

  const existingEffects = Array.from(lateEffectsWatchlistStore.values()).filter(
    (le) => le.survivorshipProfileId === survivorshipProfileId
  );
  const existingEffectTypes = new Set(existingEffects.map((le) => le.effectType));

  const treatments = profile.treatments || [];
  const yearsSinceTreatment = profile.treatmentEndDate
    ? getYearsSinceTreatment(profile.treatmentEndDate)
    : 0;

  // Collect all potential effects from treatment history
  const potentialEffects = new Set<LateEffectType>();
  treatments.forEach((treatment) => {
    const effects = treatmentLateEffectMap[treatment as SurvivorshipTreatmentType] || [];
    effects.forEach((effect) => potentialEffects.add(effect));
  });

  // Generate suggestions
  const suggestions: LateEffectSuggestion[] = [];

  potentialEffects.forEach((effectType) => {
    const relatedTreatments = treatments.filter((t) =>
      (treatmentLateEffectMap[t as SurvivorshipTreatmentType] || []).includes(effectType)
    ) as SurvivorshipTreatmentType[];

    const priority = calculateEffectPriority(effectType, treatments, yearsSinceTreatment);
    const isAlreadyWatching = existingEffectTypes.has(effectType);

    // Build reason based on treatments (NO-CDS compliant - factual, not advisory)
    const treatmentNames = relatedTreatments.map(
      (t) => survivorshipTreatmentTypeLabels[t] || t
    );
    const reason = `Associated with ${treatmentNames.join(" and ")} treatments in your treatment history.`;

    suggestions.push({
      id: `suggestion-${effectType}`,
      effectType,
      effectLabel: lateEffectLabels[effectType] || effectType,
      relatedTreatments,
      reason,
      priority,
      monitoringTips: getMonitoringTips(effectType),
      relatedResourceCategories: lateEffectResourceMap[effectType] || ["educational_materials"],
      isAlreadyWatching,
    });
  });

  // Sort by priority and whether already watching
  suggestions.sort((a, b) => {
    if (a.isAlreadyWatching !== b.isAlreadyWatching) {
      return a.isAlreadyWatching ? 1 : -1; // Not watching first
    }
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Try AI enhancement if OpenAI is available
  let aiGenerated = false;
  try {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });

    if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && suggestions.length > 0) {
      const prompt = `You are an educational health information assistant. Given a cancer survivor's treatment history and current symptom reports, provide FACTUAL educational context about the late effects they may want to discuss with their healthcare provider.

CRITICAL COMPLIANCE RULES - You MUST follow these:
1. This is NOT medical advice - only educational information
2. Do NOT recommend, suggest, or advise any specific actions
3. Do NOT evaluate the patient's health status
4. Do NOT use phrases like "you should", "we recommend", "it's important to"
5. Only provide factual associations between treatments and known late effects
6. Frame everything as "information to discuss with your healthcare provider"

Patient Context:
- Cancer Type: ${profile.cancerType}
- Stage: ${profile.stage || "Not specified"}
- Treatments: ${treatments.join(", ")}
- Years Since Treatment: ${yearsSinceTreatment}
- Reported Symptoms: ${reportedSymptoms.length > 0 ? reportedSymptoms.join(", ") : "None reported"}

Current watchlist suggestions based on treatment history:
${suggestions.slice(0, 5).map((s) => `- ${s.effectLabel}: ${s.reason}`).join("\n")}

Provide a brief educational context (2-3 sentences max) for why tracking late effects may be valuable. Remember: NO medical advice, NO recommendations, only factual educational information.`;

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
        max_completion_tokens: 200,
      });

      const aiContext = response.choices[0]?.message?.content;
      if (aiContext) {
        aiGenerated = true;
        console.log("[Survivorship] AI context generated for personalized watchlist");
      }
    }
  } catch (error) {
    console.log("[Survivorship] AI enhancement skipped:", error);
  }

  const response: PersonalizedWatchlistResponse = {
    suggestions,
    aiGenerated,
    disclaimer:
      "NOT medical advice. This watchlist is based on your documented treatment history and shows late effects that are commonly associated with those treatments. This is educational information only. Always discuss any concerns with your healthcare provider.",
    basedOn: {
      treatments,
      cancerType: profile.cancerType,
      yearsSinceTreatment,
      reportedSymptoms,
    },
  };

  res.json(response);
});

// Add late effect to watchlist from suggestion
router.post("/api/survivorship/late-effects/add-from-suggestion", (req, res) => {
  const { survivorshipProfileId, effectType, relatedTreatment, notes } = req.body;

  if (!survivorshipProfileId || !effectType) {
    return res.status(400).json({ error: "survivorshipProfileId and effectType are required" });
  }

  const profile = survivorshipProfilesStore.get(survivorshipProfileId);
  if (!profile) {
    return res.status(404).json({ error: "Survivorship profile not found" });
  }

  // Check if already exists
  const existing = Array.from(lateEffectsWatchlistStore.values()).find(
    (le) => le.survivorshipProfileId === survivorshipProfileId && le.effectType === effectType
  );

  if (existing) {
    return res.status(409).json({ error: "This effect is already on your watchlist", existing });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const lateEffect: LateEffectWatchlistItem = {
    id,
    profileId: profile.profileId,
    survivorshipProfileId,
    effectType,
    relatedTreatment,
    status: "watching",
    notes: notes || `Added from personalized watchlist suggestions`,
    createdAt: now,
    updatedAt: now,
  };

  lateEffectsWatchlistStore.set(id, lateEffect);
  res.status(201).json(lateEffect);
});

// ==================== AI Survivorship Care Features ====================
import {
  generateSurvivorshipCarePlan,
  generateFollowUpSummary,
  analyzeLateEffects,
} from "./services/aiSurvivorshipService";

// Generate personalized AI survivorship care plan
router.post("/:profileId/ai-care-plan", async (req, res) => {
  try {
    const { profileId } = req.params;
    
    const profile = Array.from(survivorshipProfilesStore.values()).find(
      (p) => p.profileId === profileId
    );
    
    if (!profile) {
      return res.status(404).json({ error: "Survivorship profile not found" });
    }
    
    const yearsSinceTreatment = getYearsSinceTreatment(profile.treatmentEndDate || new Date().toISOString());
    const carePlan = await generateSurvivorshipCarePlan(profile, yearsSinceTreatment);
    
    res.json(carePlan);
  } catch (error) {
    console.error("[AI Survivorship] Error generating care plan:", error);
    res.status(500).json({ error: "Failed to generate care plan" });
  }
});

// Generate AI follow-up care summary with screening recommendations
router.post("/:profileId/ai-followup-summary", async (req, res) => {
  try {
    const { profileId } = req.params;
    
    const profile = Array.from(survivorshipProfilesStore.values()).find(
      (p) => p.profileId === profileId
    );
    
    if (!profile) {
      return res.status(404).json({ error: "Survivorship profile not found" });
    }
    
    const followUps = Array.from(followUpSchedulesStore.values()).filter(
      (fu) => fu.survivorshipProfileId === profile.id
    );
    
    const yearsSinceTreatment = getYearsSinceTreatment(profile.treatmentEndDate || new Date().toISOString());
    const summary = await generateFollowUpSummary(profile, followUps, yearsSinceTreatment);
    
    res.json(summary);
  } catch (error) {
    console.error("[AI Survivorship] Error generating follow-up summary:", error);
    res.status(500).json({ error: "Failed to generate follow-up summary" });
  }
});

// Analyze potential late effects based on treatment history
router.post("/:profileId/ai-late-effects", async (req, res) => {
  try {
    const { profileId } = req.params;
    const { reportedSymptoms = [] } = req.body;
    
    const profile = Array.from(survivorshipProfilesStore.values()).find(
      (p) => p.profileId === profileId
    );
    
    if (!profile) {
      return res.status(404).json({ error: "Survivorship profile not found" });
    }
    
    const watchlistItems = Array.from(lateEffectsWatchlistStore.values()).filter(
      (item) => item.survivorshipProfileId === profile.id
    );
    
    const yearsSinceTreatment = getYearsSinceTreatment(profile.treatmentEndDate || new Date().toISOString());
    const analysis = await analyzeLateEffects(profile, watchlistItems, reportedSymptoms, yearsSinceTreatment);
    
    res.json(analysis);
  } catch (error) {
    console.error("[AI Survivorship] Error analyzing late effects:", error);
    res.status(500).json({ error: "Failed to analyze late effects" });
  }
});

// Get all AI insights in one call
router.post("/:profileId/ai-insights", async (req, res) => {
  try {
    const { profileId } = req.params;
    const { reportedSymptoms = [] } = req.body;
    
    const profile = Array.from(survivorshipProfilesStore.values()).find(
      (p) => p.profileId === profileId
    );
    
    if (!profile) {
      return res.status(404).json({ error: "Survivorship profile not found" });
    }
    
    const followUps = Array.from(followUpSchedulesStore.values()).filter(
      (fu) => fu.survivorshipProfileId === profile.id
    );
    
    const watchlistItems = Array.from(lateEffectsWatchlistStore.values()).filter(
      (item) => item.survivorshipProfileId === profile.id
    );
    
    const yearsSinceTreatment = getYearsSinceTreatment(profile.treatmentEndDate || new Date().toISOString());
    
    const [carePlan, followUpSummary, lateEffectAnalysis] = await Promise.all([
      generateSurvivorshipCarePlan(profile, yearsSinceTreatment),
      generateFollowUpSummary(profile, followUps, yearsSinceTreatment),
      analyzeLateEffects(profile, watchlistItems, reportedSymptoms, yearsSinceTreatment),
    ]);
    
    res.json({
      carePlan,
      followUpSummary,
      lateEffectAnalysis,
      generatedAt: new Date().toISOString(),
      disclaimer: "This AI-generated information is for educational purposes only and does NOT constitute medical advice. Always consult your healthcare provider.",
    });
  } catch (error) {
    console.error("[AI Survivorship] Error generating insights:", error);
    res.status(500).json({ error: "Failed to generate AI insights" });
  }
});

console.log("[Survivorship] AI-powered survivorship care routes registered");

// ==================== EXPANDED SURVIVORSHIP ENGINE ====================

// Wellness Tracking Store
interface WellnessEntry {
  id: string;
  profileId: string;
  date: string;
  physicalScore: number;
  emotionalScore: number;
  socialScore: number;
  sleepQuality: number;
  energyLevel: number;
  painLevel: number;
  anxietyLevel: number;
  notes?: string;
  createdAt: string;
}

interface QoLAssessment {
  id: string;
  profileId: string;
  date: string;
  overallScore: number;
  domains: {
    physical: number;
    emotional: number;
    social: number;
    functional: number;
    cognitive: number;
    spiritual: number;
  };
  responses: Record<string, number>;
  interpretations: string[];
  createdAt: string;
}

interface ReturnToWorkEntry {
  id: string;
  profileId: string;
  status: "not_started" | "planning" | "partial_return" | "full_return" | "not_applicable";
  targetDate?: string;
  actualReturnDate?: string;
  hoursPerWeek?: number;
  accommodations: string[];
  challenges: string[];
  supportNeeded: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface FinancialAssistance {
  id: string;
  profileId: string;
  category: "insurance" | "copay_assistance" | "transportation" | "housing" | "nutrition" | "disability" | "other";
  programName: string;
  status: "applied" | "approved" | "denied" | "pending" | "expired";
  applicationDate?: string;
  approvalDate?: string;
  amount?: number;
  notes?: string;
  contactInfo?: string;
  createdAt: string;
}

interface PeerSupportConnection {
  id: string;
  profileId: string;
  type: "support_group" | "mentor" | "online_community" | "counseling" | "other";
  name: string;
  description?: string;
  meetingSchedule?: string;
  contactInfo?: string;
  isActive: boolean;
  rating?: number;
  notes?: string;
  createdAt: string;
}

const wellnessStore: Map<string, WellnessEntry> = new Map();
const qolAssessmentsStore: Map<string, QoLAssessment> = new Map();
const returnToWorkStore: Map<string, ReturnToWorkEntry> = new Map();
const financialAssistanceStore: Map<string, FinancialAssistance> = new Map();
const peerSupportStore: Map<string, PeerSupportConnection> = new Map();

// Initialize expanded sample data
function initializeExpandedSampleData() {
  const sampleProfileId = "profile-default";
  
  // Sample wellness entries
  const wellnessEntries: WellnessEntry[] = [
    {
      id: "well-1",
      profileId: sampleProfileId,
      date: "2025-01-20",
      physicalScore: 7,
      emotionalScore: 8,
      socialScore: 6,
      sleepQuality: 7,
      energyLevel: 6,
      painLevel: 2,
      anxietyLevel: 3,
      notes: "Feeling stronger this week",
      createdAt: new Date().toISOString(),
    },
    {
      id: "well-2",
      profileId: sampleProfileId,
      date: "2025-01-13",
      physicalScore: 6,
      emotionalScore: 7,
      socialScore: 5,
      sleepQuality: 6,
      energyLevel: 5,
      painLevel: 3,
      anxietyLevel: 4,
      notes: "Some fatigue but improving",
      createdAt: new Date().toISOString(),
    },
    {
      id: "well-3",
      profileId: sampleProfileId,
      date: "2025-01-06",
      physicalScore: 5,
      emotionalScore: 6,
      socialScore: 5,
      sleepQuality: 5,
      energyLevel: 4,
      painLevel: 4,
      anxietyLevel: 5,
      createdAt: new Date().toISOString(),
    },
  ];
  wellnessEntries.forEach(e => wellnessStore.set(e.id, e));

  // Sample QoL assessment
  const qolAssessment: QoLAssessment = {
    id: "qol-1",
    profileId: sampleProfileId,
    date: "2025-01-15",
    overallScore: 72,
    domains: {
      physical: 68,
      emotional: 75,
      social: 65,
      functional: 78,
      cognitive: 80,
      spiritual: 70,
    },
    responses: {},
    interpretations: [
      "Physical well-being is improving with exercise",
      "Emotional health shows positive coping strategies",
      "Social connections could benefit from more engagement",
      "Functional ability is good for daily activities",
      "Cognitive function is within normal range",
    ],
    createdAt: new Date().toISOString(),
  };
  qolAssessmentsStore.set(qolAssessment.id, qolAssessment);

  // Sample return to work
  const rtwEntry: ReturnToWorkEntry = {
    id: "rtw-1",
    profileId: sampleProfileId,
    status: "partial_return",
    targetDate: "2025-04-01",
    hoursPerWeek: 20,
    accommodations: ["Flexible schedule", "Remote work options", "Regular breaks"],
    challenges: ["Fatigue management", "Concentration difficulties"],
    supportNeeded: ["Gradual hour increase", "Ergonomic workspace"],
    notes: "Working with HR on transition plan",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  returnToWorkStore.set(rtwEntry.id, rtwEntry);

  // Sample financial assistance
  const financialItems: FinancialAssistance[] = [
    {
      id: "fin-1",
      profileId: sampleProfileId,
      category: "copay_assistance",
      programName: "Patient Advocate Foundation Co-Pay Relief",
      status: "approved",
      applicationDate: "2024-06-01",
      approvalDate: "2024-06-15",
      amount: 5000,
      notes: "Covers hormone therapy copays",
      createdAt: new Date().toISOString(),
    },
    {
      id: "fin-2",
      profileId: sampleProfileId,
      category: "transportation",
      programName: "American Cancer Society Road To Recovery",
      status: "approved",
      applicationDate: "2024-04-01",
      notes: "Free rides to treatment appointments",
      createdAt: new Date().toISOString(),
    },
  ];
  financialItems.forEach(f => financialAssistanceStore.set(f.id, f));

  // Sample peer support
  const peerConnections: PeerSupportConnection[] = [
    {
      id: "peer-1",
      profileId: sampleProfileId,
      type: "support_group",
      name: "Breast Cancer Survivors Circle",
      description: "Weekly peer support group for breast cancer survivors",
      meetingSchedule: "Tuesdays 7pm",
      isActive: true,
      rating: 5,
      createdAt: new Date().toISOString(),
    },
    {
      id: "peer-2",
      profileId: sampleProfileId,
      type: "online_community",
      name: "Cancer Support Community",
      description: "Online forum and virtual support groups",
      contactInfo: "https://cancersupportcommunity.org",
      isActive: true,
      rating: 4,
      createdAt: new Date().toISOString(),
    },
  ];
  peerConnections.forEach(p => peerSupportStore.set(p.id, p));
}

initializeExpandedSampleData();

// ==================== WELLNESS TRACKING ROUTES ====================

router.get("/api/survivorship/wellness", (req, res) => {
  const profileId = (req.query.profileId as string) || "profile-default";
  const entries = Array.from(wellnessStore.values())
    .filter(e => e.profileId === profileId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  logPhiAccess("VIEW_WELLNESS_ENTRIES", { profileId, entriesCount: entries.length });
  const trends = calculateWellnessTrends(entries);
  res.json({ entries, trends });
});

router.post("/api/survivorship/wellness", (req, res) => {
  const entry: WellnessEntry = {
    id: randomUUID(),
    profileId: req.body.profileId || "profile-default",
    date: req.body.date || new Date().toISOString().split("T")[0],
    physicalScore: req.body.physicalScore,
    emotionalScore: req.body.emotionalScore,
    socialScore: req.body.socialScore,
    sleepQuality: req.body.sleepQuality,
    energyLevel: req.body.energyLevel,
    painLevel: req.body.painLevel,
    anxietyLevel: req.body.anxietyLevel,
    notes: req.body.notes,
    createdAt: new Date().toISOString(),
  };
  wellnessStore.set(entry.id, entry);
  logPhiAccess("CREATE_WELLNESS_ENTRY", { entryId: entry.id });
  res.status(201).json(entry);
});

function calculateWellnessTrends(entries: WellnessEntry[]) {
  if (entries.length < 2) return null;
  
  const recent = entries.slice(0, 4);
  const older = entries.slice(4, 8);
  
  if (older.length === 0) return null;
  
  const avgRecent = {
    physical: recent.reduce((sum, e) => sum + e.physicalScore, 0) / recent.length,
    emotional: recent.reduce((sum, e) => sum + e.emotionalScore, 0) / recent.length,
    energy: recent.reduce((sum, e) => sum + e.energyLevel, 0) / recent.length,
  };
  
  const avgOlder = {
    physical: older.reduce((sum, e) => sum + e.physicalScore, 0) / older.length,
    emotional: older.reduce((sum, e) => sum + e.emotionalScore, 0) / older.length,
    energy: older.reduce((sum, e) => sum + e.energyLevel, 0) / older.length,
  };
  
  return {
    physical: { current: avgRecent.physical, previous: avgOlder.physical, trend: avgRecent.physical > avgOlder.physical ? "improving" : avgRecent.physical < avgOlder.physical ? "declining" : "stable" },
    emotional: { current: avgRecent.emotional, previous: avgOlder.emotional, trend: avgRecent.emotional > avgOlder.emotional ? "improving" : avgRecent.emotional < avgOlder.emotional ? "declining" : "stable" },
    energy: { current: avgRecent.energy, previous: avgOlder.energy, trend: avgRecent.energy > avgOlder.energy ? "improving" : avgRecent.energy < avgOlder.energy ? "declining" : "stable" },
  };
}

// ==================== QUALITY OF LIFE ROUTES ====================

router.get("/api/survivorship/qol", (req, res) => {
  const profileId = (req.query.profileId as string) || "profile-default";
  const assessments = Array.from(qolAssessmentsStore.values())
    .filter(a => a.profileId === profileId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  logPhiAccess("VIEW_QOL_ASSESSMENTS", { profileId, assessmentsCount: assessments.length });
  res.json(assessments);
});

router.post("/api/survivorship/qol", (req, res) => {
  const domains = req.body.domains;
  const overallScore = Math.round(
    (domains.physical + domains.emotional + domains.social + domains.functional + domains.cognitive + domains.spiritual) / 6
  );
  
  const assessment: QoLAssessment = {
    id: randomUUID(),
    profileId: req.body.profileId || "profile-default",
    date: new Date().toISOString().split("T")[0],
    overallScore,
    domains,
    responses: req.body.responses || {},
    interpretations: generateQoLInterpretations(domains),
    createdAt: new Date().toISOString(),
  };
  qolAssessmentsStore.set(assessment.id, assessment);
  logPhiAccess("CREATE_QOL_ASSESSMENT", { assessmentId: assessment.id });
  res.status(201).json(assessment);
});

function generateQoLInterpretations(domains: QoLAssessment["domains"]): string[] {
  const interpretations: string[] = [];
  
  if (domains.physical >= 70) interpretations.push("Physical well-being is in a healthy range");
  else if (domains.physical >= 50) interpretations.push("Physical well-being has room for improvement");
  else interpretations.push("Physical well-being needs attention - consider discussing with your care team");
  
  if (domains.emotional >= 70) interpretations.push("Emotional health shows positive coping");
  else if (domains.emotional >= 50) interpretations.push("Emotional health could benefit from additional support");
  else interpretations.push("Emotional well-being needs support - consider counseling resources");
  
  if (domains.social < 60) interpretations.push("Social connections could benefit from more engagement");
  if (domains.cognitive < 60) interpretations.push("Cognitive function may need evaluation");
  
  return interpretations;
}

// ==================== RETURN TO WORK ROUTES ====================

router.get("/api/survivorship/return-to-work", (req, res) => {
  const profileId = (req.query.profileId as string) || "profile-default";
  const entry = Array.from(returnToWorkStore.values()).find(e => e.profileId === profileId);
  res.json(entry || null);
});

router.post("/api/survivorship/return-to-work", (req, res) => {
  const profileId = req.body.profileId || "profile-default";
  const existing = Array.from(returnToWorkStore.values()).find(e => e.profileId === profileId);
  
  const entry: ReturnToWorkEntry = {
    id: existing?.id || randomUUID(),
    profileId,
    status: req.body.status,
    targetDate: req.body.targetDate,
    actualReturnDate: req.body.actualReturnDate,
    hoursPerWeek: req.body.hoursPerWeek,
    accommodations: req.body.accommodations || [],
    challenges: req.body.challenges || [],
    supportNeeded: req.body.supportNeeded || [],
    notes: req.body.notes,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  returnToWorkStore.set(entry.id, entry);
  logPhiAccess("UPDATE_RETURN_TO_WORK", { entryId: entry.id });
  res.json(entry);
});

// ==================== FINANCIAL ASSISTANCE ROUTES ====================

router.get("/api/survivorship/financial-assistance", (req, res) => {
  const profileId = (req.query.profileId as string) || "profile-default";
  const items = Array.from(financialAssistanceStore.values())
    .filter(f => f.profileId === profileId);
  res.json(items);
});

router.post("/api/survivorship/financial-assistance", (req, res) => {
  const item: FinancialAssistance = {
    id: randomUUID(),
    profileId: req.body.profileId || "profile-default",
    category: req.body.category,
    programName: req.body.programName,
    status: req.body.status,
    applicationDate: req.body.applicationDate,
    approvalDate: req.body.approvalDate,
    amount: req.body.amount,
    notes: req.body.notes,
    contactInfo: req.body.contactInfo,
    createdAt: new Date().toISOString(),
  };
  financialAssistanceStore.set(item.id, item);
  logPhiAccess("CREATE_FINANCIAL_ASSISTANCE", { itemId: item.id });
  res.status(201).json(item);
});

router.delete("/api/survivorship/financial-assistance/:id", (req, res) => {
  const deleted = financialAssistanceStore.delete(req.params.id);
  if (deleted) {
    logPhiAccess("DELETE_FINANCIAL_ASSISTANCE", { itemId: req.params.id });
    res.status(204).send();
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

// ==================== PEER SUPPORT ROUTES ====================

router.get("/api/survivorship/peer-support", (req, res) => {
  const profileId = (req.query.profileId as string) || "profile-default";
  const connections = Array.from(peerSupportStore.values())
    .filter(p => p.profileId === profileId);
  res.json(connections);
});

router.post("/api/survivorship/peer-support", (req, res) => {
  const connection: PeerSupportConnection = {
    id: randomUUID(),
    profileId: req.body.profileId || "profile-default",
    type: req.body.type,
    name: req.body.name,
    description: req.body.description,
    meetingSchedule: req.body.meetingSchedule,
    contactInfo: req.body.contactInfo,
    isActive: true,
    rating: req.body.rating,
    notes: req.body.notes,
    createdAt: new Date().toISOString(),
  };
  peerSupportStore.set(connection.id, connection);
  logPhiAccess("CREATE_PEER_SUPPORT", { connectionId: connection.id });
  res.status(201).json(connection);
});

router.delete("/api/survivorship/peer-support/:id", (req, res) => {
  const deleted = peerSupportStore.delete(req.params.id);
  if (deleted) {
    logPhiAccess("DELETE_PEER_SUPPORT", { connectionId: req.params.id });
    res.status(204).send();
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

// ==================== AI WELLNESS RECOMMENDATIONS ====================

router.post("/api/survivorship/ai-wellness-recommendations", async (req, res) => {
  try {
    const profileId = req.body.profileId || "profile-default";
    
    const wellnessEntries = Array.from(wellnessStore.values())
      .filter(e => e.profileId === profileId)
      .slice(0, 5);
    
    const qolAssessments = Array.from(qolAssessmentsStore.values())
      .filter(a => a.profileId === profileId)
      .slice(0, 1);
    
    const profile = Array.from(survivorshipProfilesStore.values())
      .find(p => p.profileId === profileId);
    
    logPhiAccess("AI_WELLNESS_RECOMMENDATIONS", { profileId });
    
    // Generate personalized recommendations based on data
    const recommendations = generateWellnessRecommendations(wellnessEntries, qolAssessments[0], profile);
    
    res.json({
      recommendations,
      basedOn: {
        wellnessEntriesCount: wellnessEntries.length,
        hasQoLAssessment: qolAssessments.length > 0,
        treatmentTypes: profile?.treatments || [],
      },
      disclaimer: "These recommendations are for educational purposes only. Always consult your healthcare team before making changes to your wellness routine.",
    });
  } catch (error) {
    console.error("[AI Wellness] Error:", error);
    res.status(500).json({ error: "Failed to generate recommendations" });
  }
});

function generateWellnessRecommendations(
  wellnessEntries: WellnessEntry[],
  qolAssessment: QoLAssessment | undefined,
  profile: SurvivorshipProfile | undefined
) {
  const recommendations: Array<{
    category: string;
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    resources: string[];
  }> = [];
  
  const latestWellness = wellnessEntries[0];
  
  if (latestWellness) {
    if (latestWellness.sleepQuality < 6) {
      recommendations.push({
        category: "Sleep",
        title: "Improve Sleep Quality",
        description: "Your recent sleep quality scores suggest room for improvement. Good sleep is crucial for recovery and overall well-being.",
        priority: "high",
        resources: ["Sleep hygiene tips", "Relaxation techniques", "Consider discussing with care team"],
      });
    }
    
    if (latestWellness.energyLevel < 5) {
      recommendations.push({
        category: "Energy",
        title: "Address Fatigue",
        description: "Cancer-related fatigue is common. Gentle exercise, good nutrition, and pacing activities can help manage energy levels.",
        priority: "high",
        resources: ["Fatigue management strategies", "Gentle exercise programs", "Nutrition counseling"],
      });
    }
    
    if (latestWellness.anxietyLevel > 5) {
      recommendations.push({
        category: "Mental Health",
        title: "Anxiety Support",
        description: "Higher anxiety levels are common among cancer survivors. Consider connecting with mental health resources.",
        priority: "high",
        resources: ["Counseling services", "Support groups", "Mindfulness apps", "Stress reduction techniques"],
      });
    }
    
    if (latestWellness.socialScore < 6) {
      recommendations.push({
        category: "Social",
        title: "Strengthen Social Connections",
        description: "Social support is vital for survivorship. Consider joining support groups or reconnecting with friends and family.",
        priority: "medium",
        resources: ["Survivor support groups", "Online communities", "Family counseling"],
      });
    }
  }
  
  if (qolAssessment) {
    if (qolAssessment.domains.cognitive < 60) {
      recommendations.push({
        category: "Cognitive",
        title: "Address Cognitive Concerns",
        description: "Some survivors experience cognitive changes. Brain exercises and discussing with your care team may help.",
        priority: "medium",
        resources: ["Cognitive rehabilitation", "Brain training exercises", "Neuropsychological evaluation"],
      });
    }
  }
  
  // Default wellness recommendations
  recommendations.push({
    category: "Physical Activity",
    title: "Stay Active",
    description: "Regular physical activity helps with recovery, fatigue management, and overall well-being.",
    priority: "medium",
    resources: ["Cancer survivor exercise programs", "Physical therapy", "Yoga for survivors"],
  });
  
  recommendations.push({
    category: "Nutrition",
    title: "Healthy Eating",
    description: "A balanced diet supports healing and long-term health. Consider meeting with a dietitian.",
    priority: "low",
    resources: ["Nutrition counseling", "Anti-inflammatory diet", "Healthy cooking resources"],
  });
  
  return recommendations;
}

// ==================== COMPREHENSIVE SURVIVORSHIP DASHBOARD ====================

router.get("/api/survivorship/comprehensive-dashboard", (req, res) => {
  const profileId = (req.query.profileId as string) || "profile-default";
  
  const profile = Array.from(survivorshipProfilesStore.values())
    .find(p => p.profileId === profileId);
  
  const wellnessEntries = Array.from(wellnessStore.values())
    .filter(e => e.profileId === profileId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const qolAssessments = Array.from(qolAssessmentsStore.values())
    .filter(a => a.profileId === profileId);
  
  const returnToWork = Array.from(returnToWorkStore.values())
    .find(r => r.profileId === profileId);
  
  const financialItems = Array.from(financialAssistanceStore.values())
    .filter(f => f.profileId === profileId);
  
  const peerConnections = Array.from(peerSupportStore.values())
    .filter(p => p.profileId === profileId);
  
  const followUps = Array.from(followUpSchedulesStore.values())
    .filter(fu => fu.profileId === profileId);
  
  const lateEffects = Array.from(lateEffectsWatchlistStore.values())
    .filter(le => le.profileId === profileId);
  
  logPhiAccess("VIEW_COMPREHENSIVE_DASHBOARD", { profileId });
  
  res.json({
    profile: profile ? {
      ...profile,
      currentPhase: getSurvivorshipPhase(profile.treatmentEndDate || new Date().toISOString()),
      yearsSinceTreatment: getYearsSinceTreatment(profile.treatmentEndDate || new Date().toISOString()),
    } : null,
    wellness: {
      latestEntry: wellnessEntries[0] || null,
      trends: calculateWellnessTrends(wellnessEntries),
      entriesCount: wellnessEntries.length,
    },
    qualityOfLife: {
      latestAssessment: qolAssessments[0] || null,
      assessmentsCount: qolAssessments.length,
    },
    returnToWork,
    financialAssistance: {
      items: financialItems,
      approvedTotal: financialItems.filter(f => f.status === "approved").reduce((sum, f) => sum + (f.amount || 0), 0),
    },
    peerSupport: {
      connections: peerConnections,
      activeCount: peerConnections.filter(p => p.isActive).length,
    },
    followUps: {
      total: followUps.length,
      overdue: followUps.filter(fu => new Date(fu.nextDueDate) < new Date()).length,
      upcoming: followUps.filter(fu => {
        const due = new Date(fu.nextDueDate);
        const now = new Date();
        const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        return due >= now && due <= thirtyDays;
      }).length,
    },
    lateEffects: {
      watching: lateEffects.filter(le => le.status === "watching").length,
      detected: lateEffects.filter(le => le.status === "detected").length,
    },
  });
});

// ==================== TREATMENT SUMMARY GENERATION ====================

router.get("/api/survivorship/treatment-summary/:profileId", (req, res) => {
  const { profileId } = req.params;
  
  const profile = Array.from(survivorshipProfilesStore.values())
    .find(p => p.profileId === profileId || p.id === profileId);
  
  if (!profile) {
    return res.status(404).json({ error: "Survivorship profile not found" });
  }
  
  const followUps = Array.from(followUpSchedulesStore.values())
    .filter(fu => fu.profileId === profileId || fu.survivorshipProfileId === profile.id);
  
  const lateEffects = Array.from(lateEffectsWatchlistStore.values())
    .filter(le => le.profileId === profileId || le.survivorshipProfileId === profile.id);
  
  const completions = Array.from(followUpCompletionsStore.values())
    .filter(c => c.profileId === profileId);
  
  logPhiAccess("GENERATE_TREATMENT_SUMMARY", { profileId });
  
  const yearsSinceTreatment = profile.treatmentEndDate 
    ? getYearsSinceTreatment(profile.treatmentEndDate) 
    : 0;
  
  const currentPhase = profile.treatmentEndDate 
    ? getSurvivorshipPhase(profile.treatmentEndDate) 
    : "high_intensity";
  
  const summary = {
    generatedAt: new Date().toISOString(),
    disclaimer: "This Treatment Summary is for informational purposes only and does NOT constitute medical advice. Always consult your healthcare provider for medical guidance.",
    
    patientInfo: {
      profileId: profile.profileId,
      cancerType: profile.cancerType,
      stage: profile.stage || "Not specified",
      diagnosisDate: profile.diagnosisDate,
      treatmentEndDate: profile.treatmentEndDate,
      yearsSinceTreatment,
      currentPhase,
    },
    
    treatmentHistory: {
      treatments: profile.treatments.map(t => ({
        type: t,
        label: survivorshipTreatmentTypeLabels[t as SurvivorshipTreatmentType] || t,
      })),
      notes: profile.notes,
    },
    
    followUpCare: {
      scheduled: followUps.map(fu => ({
        title: fu.title,
        category: fu.category,
        frequency: fu.frequency,
        nextDue: fu.nextDueDate,
        lastCompleted: fu.lastCompletedDate,
      })),
      overdue: followUps.filter(fu => new Date(fu.nextDueDate) < new Date()).length,
      upcoming: followUps.filter(fu => {
        const due = new Date(fu.nextDueDate);
        const now = new Date();
        const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        return due >= now && due <= thirtyDays;
      }).length,
    },
    
    lateEffectsMonitoring: {
      watching: lateEffects.filter(le => le.status === "watching").map(le => ({
        effect: lateEffectLabels[le.effectType] || le.effectType,
        relatedTreatment: le.relatedTreatment,
        notes: le.notes,
      })),
      detected: lateEffects.filter(le => le.status === "detected").map(le => ({
        effect: lateEffectLabels[le.effectType] || le.effectType,
        severity: le.severity,
        relatedTreatment: le.relatedTreatment,
        notes: le.notes,
      })),
    },
    
    completedFollowUps: completions.slice(0, 10).map(c => ({
      date: c.completedDate,
      notes: c.notes,
      results: c.results,
    })),
    
    recommendations: {
      general: [
        "Continue regular follow-up appointments as scheduled",
        "Report any new or worsening symptoms to your healthcare team",
        "Maintain a healthy lifestyle with regular exercise and balanced nutrition",
        "Stay connected with support resources and peer groups",
      ],
      screenings: followUps.filter(fu => fu.category === "imaging" || fu.category === "lab_work").map(fu => ({
        title: fu.title,
        frequency: fu.frequency,
        nextDue: fu.nextDueDate,
      })),
    },
  };
  
  res.json(summary);
});

// ==================== ENHANCED WELLNESS TRACKING (7 DAILY METRICS) ====================

interface DailyWellnessEntry {
  id: string;
  profileId: string;
  date: string;
  sleep: number; // 0-10 quality
  fatigue: number; // 0-10 (0=none, 10=severe)
  pain: number; // 0-10
  mood: number; // 0-10 (0=very low, 10=excellent)
  appetite: number; // 0-10
  exercise: number; // 0-10 (0=none, 10=very active)
  hydration: number; // 0-10 (0=poor, 10=excellent)
  notes?: string;
  createdAt: string;
}

const dailyWellnessStore: Map<string, DailyWellnessEntry> = new Map();

// Initialize enhanced wellness sample data
function initializeEnhancedWellnessData() {
  const sampleProfileId = "profile-default";
  const entries: DailyWellnessEntry[] = [];
  
  for (let i = 0; i < 14; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    entries.push({
      id: `daily-well-${i}`,
      profileId: sampleProfileId,
      date: date.toISOString().split("T")[0],
      sleep: Math.max(4, Math.min(10, 7 + Math.floor(Math.random() * 3) - 1)),
      fatigue: Math.max(1, Math.min(6, 3 + Math.floor(Math.random() * 3) - 1)),
      pain: Math.max(0, Math.min(5, 2 + Math.floor(Math.random() * 3) - 1)),
      mood: Math.max(5, Math.min(10, 7 + Math.floor(Math.random() * 3) - 1)),
      appetite: Math.max(5, Math.min(9, 7 + Math.floor(Math.random() * 2) - 1)),
      exercise: Math.max(3, Math.min(8, 5 + Math.floor(Math.random() * 3) - 1)),
      hydration: Math.max(5, Math.min(9, 7 + Math.floor(Math.random() * 2) - 1)),
      createdAt: date.toISOString(),
    });
  }
  entries.forEach(e => dailyWellnessStore.set(e.id, e));
}

initializeEnhancedWellnessData();

router.get("/api/survivorship/daily-wellness", (req, res) => {
  const profileId = (req.query.profileId as string) || "profile-default";
  const limit = parseInt(req.query.limit as string) || 30;
  
  const entries = Array.from(dailyWellnessStore.values())
    .filter(e => e.profileId === profileId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
  
  logPhiAccess("VIEW_DAILY_WELLNESS", { profileId, entriesCount: entries.length });
  
  const trends = calculateDailyWellnessTrends(entries);
  const weeklyAverages = calculateWeeklyAverages(entries);
  
  res.json({
    entries,
    trends,
    weeklyAverages,
    disclaimer: "Wellness tracking is for personal awareness only. This is NOT medical advice.",
  });
});

router.post("/api/survivorship/daily-wellness", (req, res) => {
  const entry: DailyWellnessEntry = {
    id: randomUUID(),
    profileId: req.body.profileId || "profile-default",
    date: req.body.date || new Date().toISOString().split("T")[0],
    sleep: Math.min(10, Math.max(0, req.body.sleep || 5)),
    fatigue: Math.min(10, Math.max(0, req.body.fatigue || 5)),
    pain: Math.min(10, Math.max(0, req.body.pain || 0)),
    mood: Math.min(10, Math.max(0, req.body.mood || 5)),
    appetite: Math.min(10, Math.max(0, req.body.appetite || 5)),
    exercise: Math.min(10, Math.max(0, req.body.exercise || 5)),
    hydration: Math.min(10, Math.max(0, req.body.hydration || 5)),
    notes: req.body.notes,
    createdAt: new Date().toISOString(),
  };
  
  dailyWellnessStore.set(entry.id, entry);
  logPhiAccess("CREATE_DAILY_WELLNESS", { entryId: entry.id, profileId: entry.profileId });
  
  res.status(201).json({
    ...entry,
    disclaimer: "Wellness tracking is for personal awareness only. This is NOT medical advice.",
  });
});

function calculateDailyWellnessTrends(entries: DailyWellnessEntry[]) {
  if (entries.length < 7) return null;
  
  const recent = entries.slice(0, 7);
  const previous = entries.slice(7, 14);
  
  if (previous.length < 3) return null;
  
  const metrics = ["sleep", "fatigue", "pain", "mood", "appetite", "exercise", "hydration"] as const;
  const trends: Record<string, { current: number; previous: number; trend: string; change: number }> = {};
  
  metrics.forEach(metric => {
    const recentAvg = recent.reduce((sum, e) => sum + e[metric], 0) / recent.length;
    const prevAvg = previous.reduce((sum, e) => sum + e[metric], 0) / previous.length;
    const change = recentAvg - prevAvg;
    
    let trend = "stable";
    if (metric === "fatigue" || metric === "pain") {
      trend = change < -0.5 ? "improving" : change > 0.5 ? "worsening" : "stable";
    } else {
      trend = change > 0.5 ? "improving" : change < -0.5 ? "worsening" : "stable";
    }
    
    trends[metric] = {
      current: Math.round(recentAvg * 10) / 10,
      previous: Math.round(prevAvg * 10) / 10,
      trend,
      change: Math.round(change * 10) / 10,
    };
  });
  
  return trends;
}

function calculateWeeklyAverages(entries: DailyWellnessEntry[]) {
  if (entries.length === 0) return [];
  
  const weeks: Map<string, DailyWellnessEntry[]> = new Map();
  entries.forEach(e => {
    const date = new Date(e.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split("T")[0];
    if (!weeks.has(weekKey)) weeks.set(weekKey, []);
    weeks.get(weekKey)!.push(e);
  });
  
  return Array.from(weeks.entries()).map(([weekStart, weekEntries]) => ({
    weekStart,
    sleep: Math.round(weekEntries.reduce((s, e) => s + e.sleep, 0) / weekEntries.length * 10) / 10,
    fatigue: Math.round(weekEntries.reduce((s, e) => s + e.fatigue, 0) / weekEntries.length * 10) / 10,
    pain: Math.round(weekEntries.reduce((s, e) => s + e.pain, 0) / weekEntries.length * 10) / 10,
    mood: Math.round(weekEntries.reduce((s, e) => s + e.mood, 0) / weekEntries.length * 10) / 10,
    appetite: Math.round(weekEntries.reduce((s, e) => s + e.appetite, 0) / weekEntries.length * 10) / 10,
    exercise: Math.round(weekEntries.reduce((s, e) => s + e.exercise, 0) / weekEntries.length * 10) / 10,
    hydration: Math.round(weekEntries.reduce((s, e) => s + e.hydration, 0) / weekEntries.length * 10) / 10,
    entriesCount: weekEntries.length,
  })).slice(0, 8);
}

// ==================== ENHANCED SYMPTOM JOURNAL ====================

interface SymptomJournalEntry {
  id: string;
  profileId: string;
  date: string;
  time?: string;
  symptomType: string;
  severity: number; // 1-10
  duration: string;
  triggers: string[];
  reliefMethods: string[];
  reliefEffectiveness?: number; // 0-10
  location?: string;
  affectedDailyActivities: boolean;
  affectedActivitiesList?: string[];
  associatedSymptoms?: string[];
  notes?: string;
  createdAt: string;
}

interface SymptomPattern {
  symptomType: string;
  frequency: number;
  averageSeverity: number;
  commonTriggers: string[];
  effectiveReliefMethods: string[];
  trend: "improving" | "worsening" | "stable";
  peakTimes?: string[];
}

const symptomJournalStore: Map<string, SymptomJournalEntry> = new Map();

// Initialize symptom journal sample data
function initializeSymptomJournalData() {
  const sampleProfileId = "profile-default";
  const symptoms: SymptomJournalEntry[] = [
    {
      id: "sym-1",
      profileId: sampleProfileId,
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      time: "14:00",
      symptomType: "fatigue",
      severity: 5,
      duration: "2-4 hours",
      triggers: ["afternoon", "after lunch"],
      reliefMethods: ["rest", "short nap"],
      reliefEffectiveness: 7,
      affectedDailyActivities: true,
      affectedActivitiesList: ["work tasks"],
      notes: "Typical afternoon fatigue pattern",
      createdAt: new Date().toISOString(),
    },
    {
      id: "sym-2",
      profileId: sampleProfileId,
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      time: "09:00",
      symptomType: "neuropathy",
      severity: 3,
      duration: "1-2 hours",
      triggers: ["cold weather", "morning"],
      reliefMethods: ["warm compress", "stretching"],
      reliefEffectiveness: 6,
      location: "fingertips",
      affectedDailyActivities: false,
      notes: "Mild tingling, improved with warmth",
      createdAt: new Date().toISOString(),
    },
    {
      id: "sym-3",
      profileId: sampleProfileId,
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      symptomType: "joint_pain",
      severity: 4,
      duration: "several hours",
      triggers: ["exercise", "weather change"],
      reliefMethods: ["gentle stretching", "heat therapy"],
      reliefEffectiveness: 5,
      location: "knees",
      affectedDailyActivities: true,
      affectedActivitiesList: ["walking", "stairs"],
      createdAt: new Date().toISOString(),
    },
    {
      id: "sym-4",
      profileId: sampleProfileId,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      symptomType: "fatigue",
      severity: 6,
      duration: "4-6 hours",
      triggers: ["poor sleep", "stress"],
      reliefMethods: ["rest", "hydration"],
      reliefEffectiveness: 5,
      affectedDailyActivities: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "sym-5",
      profileId: sampleProfileId,
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      symptomType: "cognitive_changes",
      severity: 4,
      duration: "1-2 hours",
      triggers: ["multitasking", "stress"],
      reliefMethods: ["taking breaks", "writing lists"],
      reliefEffectiveness: 7,
      affectedDailyActivities: true,
      affectedActivitiesList: ["work concentration"],
      notes: "Word-finding difficulty during meeting",
      createdAt: new Date().toISOString(),
    },
  ];
  symptoms.forEach(s => symptomJournalStore.set(s.id, s));
}

initializeSymptomJournalData();

router.get("/api/survivorship/symptom-journal", (req, res) => {
  const profileId = (req.query.profileId as string) || "profile-default";
  const limit = parseInt(req.query.limit as string) || 50;
  const symptomType = req.query.symptomType as string;
  
  let entries = Array.from(symptomJournalStore.values())
    .filter(e => e.profileId === profileId);
  
  if (symptomType) {
    entries = entries.filter(e => e.symptomType === symptomType);
  }
  
  entries = entries
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
  
  logPhiAccess("VIEW_SYMPTOM_JOURNAL", { profileId, entriesCount: entries.length });
  
  res.json({
    entries,
    totalCount: entries.length,
    disclaimer: "Symptom tracking is for personal awareness only. Report concerning symptoms to your healthcare provider.",
  });
});

router.post("/api/survivorship/symptom-journal", (req, res) => {
  const profileId = req.body.profileId || "profile-default";
  const symptomEntry: SymptomJournalEntry = {
    id: randomUUID(),
    profileId,
    date: req.body.date || new Date().toISOString().split("T")[0],
    time: req.body.time,
    symptomType: req.body.symptomType,
    severity: Math.min(10, Math.max(1, req.body.severity || 5)),
    duration: req.body.duration || "unknown",
    triggers: req.body.triggers || [],
    reliefMethods: req.body.reliefMethods || [],
    reliefEffectiveness: req.body.reliefEffectiveness,
    location: req.body.location,
    affectedDailyActivities: req.body.affectedDailyActivities || false,
    affectedActivitiesList: req.body.affectedActivitiesList,
    associatedSymptoms: req.body.associatedSymptoms,
    notes: req.body.notes,
    createdAt: new Date().toISOString(),
  };
  
  symptomJournalStore.set(symptomEntry.id, symptomEntry);
  logPhiAccess("CREATE_SYMPTOM_JOURNAL_ENTRY", { entryId: symptomEntry.id, profileId });
  
  res.status(201).json({
    ...symptomEntry,
    disclaimer: "Symptom tracking is for personal awareness only. Report concerning symptoms to your healthcare provider.",
  });
});

router.delete("/api/survivorship/symptom-journal/:id", (req, res) => {
  const deleted = symptomJournalStore.delete(req.params.id);
  if (deleted) {
    logPhiAccess("DELETE_SYMPTOM_JOURNAL_ENTRY", { entryId: req.params.id });
    res.status(204).send();
  } else {
    res.status(404).json({ error: "Symptom journal entry not found" });
  }
});

// ==================== AI SYMPTOM PATTERN ANALYSIS ====================

router.post("/api/survivorship/symptom-patterns", async (req, res) => {
  const profileId = (req.body.profileId as string) || "profile-default";
  
  const entries = Array.from(symptomJournalStore.values())
    .filter(e => e.profileId === profileId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  if (entries.length < 3) {
    return res.json({
      patterns: [],
      insights: [],
      disclaimer: "Track at least 3 symptoms to see patterns. This is educational information only.",
      entriesAnalyzed: entries.length,
    });
  }
  
  logPhiAccess("ANALYZE_SYMPTOM_PATTERNS", { profileId, entriesCount: entries.length });
  
  // Group by symptom type
  const symptomGroups: Map<string, SymptomJournalEntry[]> = new Map();
  entries.forEach(e => {
    if (!symptomGroups.has(e.symptomType)) symptomGroups.set(e.symptomType, []);
    symptomGroups.get(e.symptomType)!.push(e);
  });
  
  const patterns: SymptomPattern[] = [];
  
  symptomGroups.forEach((group, symptomType) => {
    if (group.length < 2) return;
    
    const avgSeverity = group.reduce((s, e) => s + e.severity, 0) / group.length;
    
    // Find common triggers
    const triggerCounts: Map<string, number> = new Map();
    group.forEach(e => e.triggers.forEach(t => triggerCounts.set(t, (triggerCounts.get(t) || 0) + 1)));
    const commonTriggers = Array.from(triggerCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([trigger]) => trigger);
    
    // Find effective relief methods
    const reliefScores: Map<string, { total: number; count: number }> = new Map();
    group.forEach(e => {
      if (e.reliefEffectiveness && e.reliefEffectiveness >= 5) {
        e.reliefMethods.forEach(m => {
          if (!reliefScores.has(m)) reliefScores.set(m, { total: 0, count: 0 });
          reliefScores.get(m)!.total += e.reliefEffectiveness!;
          reliefScores.get(m)!.count += 1;
        });
      }
    });
    const effectiveReliefMethods = Array.from(reliefScores.entries())
      .filter(([, { count }]) => count >= 1)
      .sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))
      .slice(0, 3)
      .map(([method]) => method);
    
    // Determine trend (compare recent vs older entries)
    const recentEntries = group.slice(0, Math.ceil(group.length / 2));
    const olderEntries = group.slice(Math.ceil(group.length / 2));
    const recentAvg = recentEntries.reduce((s, e) => s + e.severity, 0) / recentEntries.length;
    const olderAvg = olderEntries.length > 0 ? olderEntries.reduce((s, e) => s + e.severity, 0) / olderEntries.length : recentAvg;
    
    let trend: "improving" | "worsening" | "stable" = "stable";
    if (recentAvg < olderAvg - 0.5) trend = "improving";
    else if (recentAvg > olderAvg + 0.5) trend = "worsening";
    
    // Find peak times
    const timeCounts: Map<string, number> = new Map();
    group.forEach(e => {
      if (e.time) {
        const hour = parseInt(e.time.split(":")[0]);
        const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
        timeCounts.set(period, (timeCounts.get(period) || 0) + 1);
      }
    });
    const peakTimes = Array.from(timeCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([period]) => period);
    
    patterns.push({
      symptomType,
      frequency: group.length,
      averageSeverity: Math.round(avgSeverity * 10) / 10,
      commonTriggers,
      effectiveReliefMethods,
      trend,
      peakTimes: peakTimes.length > 0 ? peakTimes : undefined,
    });
  });
  
  // Generate AI insights
  let aiInsights: string[] = [];
  
  try {
    const openai = new (await import("openai")).default({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
    
    if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      const prompt = `Analyze these cancer survivor symptom patterns and provide 3-5 brief educational observations. 
DO NOT provide medical advice. Only educational pattern observations.

Patterns:
${patterns.map(p => `- ${p.symptomType}: ${p.frequency} occurrences, avg severity ${p.averageSeverity}/10, trend: ${p.trend}, triggers: ${p.commonTriggers.join(", ") || "unknown"}`).join("\n")}

Provide ONLY factual observations about patterns, NOT medical advice. Keep each observation to 1-2 sentences.
Format as JSON array of strings.`;
      
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 500,
      });
      
      const content = JSON.parse(response.choices[0]?.message?.content || "{}");
      aiInsights = content.insights || content.observations || [];
    }
  } catch (error) {
    console.log("[Survivorship] AI pattern analysis unavailable, using basic insights");
  }
  
  // Fallback insights if AI not available
  if (aiInsights.length === 0) {
    patterns.forEach(p => {
      if (p.trend === "improving") {
        aiInsights.push(`${p.symptomType} severity has been trending downward, which may indicate positive progress.`);
      } else if (p.trend === "worsening") {
        aiInsights.push(`${p.symptomType} has increased in frequency or severity recently. Consider discussing with your healthcare team.`);
      }
      if (p.commonTriggers.length > 0) {
        aiInsights.push(`Common triggers for ${p.symptomType} include: ${p.commonTriggers.join(", ")}.`);
      }
      if (p.effectiveReliefMethods.length > 0) {
        aiInsights.push(`Relief methods that have worked for ${p.symptomType}: ${p.effectiveReliefMethods.join(", ")}.`);
      }
    });
    aiInsights = aiInsights.slice(0, 5);
  }
  
  res.json({
    patterns: patterns.sort((a, b) => b.frequency - a.frequency),
    insights: aiInsights,
    entriesAnalyzed: entries.length,
    dateRange: entries.length > 0 ? {
      from: entries[entries.length - 1].date,
      to: entries[0].date,
    } : null,
    disclaimer: "This pattern analysis is for educational awareness only. It does NOT constitute medical advice. Always discuss symptoms with your healthcare provider.",
  });
});

// ==================== AI DAILY WELLNESS ANALYSIS ====================

router.post("/api/survivorship/ai-wellness-analysis", async (req, res) => {
  const profileId = (req.body.profileId as string) || "profile-default";
  
  const entries = Array.from(dailyWellnessStore.values())
    .filter(e => e.profileId === profileId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 14);
  
  if (entries.length < 5) {
    return res.json({
      analysis: null,
      message: "Track at least 5 days of wellness data for AI analysis.",
      disclaimer: "This is educational information only, NOT medical advice.",
    });
  }
  
  logPhiAccess("AI_WELLNESS_ANALYSIS", { profileId, entriesCount: entries.length });
  
  const trends = calculateDailyWellnessTrends(entries);
  const weeklyAvgs = calculateWeeklyAverages(entries);
  
  let aiAnalysis: { summary: string; recommendations: string[]; concerns: string[] } | null = null;
  
  try {
    const openai = new (await import("openai")).default({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
    
    if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      const prompt = `Analyze this cancer survivor's 7-metric daily wellness data and provide educational insights.
DO NOT provide medical advice. Only educational observations and general wellness suggestions.

Recent trends (comparing last 7 days to previous 7 days):
${trends ? Object.entries(trends).map(([m, t]) => `- ${m}: ${t.current}/10 (${t.trend}, change: ${t.change > 0 ? "+" : ""}${t.change})`).join("\n") : "Insufficient data"}

Metrics tracked: sleep quality, fatigue level, pain level, mood, appetite, exercise, hydration (all 0-10 scale).
Note: For fatigue and pain, lower is better. For others, higher is better.

Provide JSON with:
{
  "summary": "2-3 sentence overall wellness summary",
  "recommendations": ["2-4 general wellness suggestions based on the data"],
  "concerns": ["Any concerning patterns that should be discussed with healthcare team, or empty array if none"]
}

Remember: NO medical advice. Educational observations only.`;
      
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_completion_tokens: 600,
      });
      
      aiAnalysis = JSON.parse(response.choices[0]?.message?.content || "null");
    }
  } catch (error) {
    console.log("[Survivorship] AI wellness analysis unavailable");
  }
  
  // Fallback analysis
  if (!aiAnalysis && trends) {
    const concerns: string[] = [];
    const recommendations: string[] = [];
    
    if (trends.fatigue && trends.fatigue.current > 6) {
      concerns.push("Fatigue levels have been elevated. Consider discussing with your care team.");
    }
    if (trends.pain && trends.pain.current > 5) {
      concerns.push("Pain levels warrant attention. Track what might be contributing.");
    }
    if (trends.sleep && trends.sleep.current < 5) {
      recommendations.push("Sleep quality could be improved. Consider sleep hygiene practices.");
    }
    if (trends.exercise && trends.exercise.current < 4) {
      recommendations.push("Gentle physical activity can help with energy and mood.");
    }
    if (trends.hydration && trends.hydration.current < 5) {
      recommendations.push("Staying well-hydrated supports overall wellness.");
    }
    
    aiAnalysis = {
      summary: `Based on ${entries.length} days of tracking, your wellness metrics show ${
        Object.values(trends).filter(t => t.trend === "improving").length > Object.values(trends).filter(t => t.trend === "worsening").length
          ? "overall positive trends"
          : Object.values(trends).filter(t => t.trend === "worsening").length > 2
          ? "some areas needing attention"
          : "relatively stable patterns"
      }.`,
      recommendations: recommendations.length > 0 ? recommendations : ["Continue tracking daily to identify patterns.", "Share your wellness data with your healthcare team."],
      concerns,
    };
  }
  
  res.json({
    analysis: aiAnalysis,
    trends,
    weeklyAverages: weeklyAvgs,
    entriesAnalyzed: entries.length,
    disclaimer: "This wellness analysis is for educational purposes only and does NOT constitute medical advice. Always consult your healthcare provider for personalized guidance.",
  });
});

console.log("[Survivorship] Expanded survivorship engine routes registered with enhanced wellness tracking, symptom journal, and AI pattern analysis");

export default router;
