import { randomUUID } from "crypto";

export type LifeStage = "menstruation" | "pregnancy" | "menopause" | "postmenopause";
export type FlowIntensity = "spotting" | "light" | "medium" | "heavy" | "very_heavy";
export type MenstrualSymptom = "cramps" | "bloating" | "headache" | "fatigue" | "mood_changes" | "breast_tenderness" | "acne" | "back_pain" | "nausea" | "insomnia";
export type MenopauseSymptom = "hot_flashes" | "night_sweats" | "mood_changes" | "sleep_disturbance" | "vaginal_dryness" | "weight_gain" | "joint_pain" | "brain_fog" | "low_libido" | "hair_thinning" | "heart_palpitations" | "urinary_changes";
export type PregnancyMilestone = "first_ultrasound" | "anatomy_scan" | "glucose_test" | "group_b_strep" | "tdap_vaccine" | "rh_factor_test" | "genetic_screening" | "fetal_movement" | "birth_plan" | "hospital_tour";

interface CycleEntry {
  id: string;
  profileId: string;
  startDate: string;
  endDate?: string;
  cycleLength?: number;
  periodLength?: number;
  flowIntensity: FlowIntensity;
  symptoms: MenstrualSymptom[];
  notes?: string;
  createdAt: string;
}

interface PregnancyProfile {
  id: string;
  profileId: string;
  dueDate: string;
  lastMenstrualPeriod?: string;
  currentWeek: number;
  trimester: 1 | 2 | 3;
  provider?: string;
  birthPlan?: string;
  complications: string[];
  milestones: { milestone: PregnancyMilestone; completed: boolean; date?: string; notes?: string }[];
  weightEntries: { date: string; weight: number; unit: string }[];
  appointments: { id: string; date: string; type: string; provider?: string; notes?: string; completed: boolean }[];
  createdAt: string;
}

interface MenopauseProfile {
  id: string;
  profileId: string;
  stage: "perimenopause" | "menopause" | "postmenopause";
  lastPeriodDate?: string;
  symptomEntries: { id: string; date: string; symptoms: { symptom: MenopauseSymptom; severity: 1 | 2 | 3 | 4 | 5 }[]; notes?: string }[];
  hrtMedications: { id: string; name: string; dosage: string; startDate: string; endDate?: string; sideEffects?: string[] }[];
  boneHealthScreenings: { id: string; date: string; type: string; result?: string; tScore?: number; notes?: string }[];
  cardiovascularScreenings: { id: string; date: string; type: string; result?: string; notes?: string }[];
  createdAt: string;
}

interface WomensHealthDashboard {
  lifeStage: LifeStage;
  menstruation?: {
    currentCycleDay?: number;
    averageCycleLength: number;
    lastPeriodStart?: string;
    nextPeriodEstimate?: string;
    recentSymptoms: MenstrualSymptom[];
    cycleRegularity: "regular" | "irregular" | "unknown";
    totalCyclesTracked: number;
  };
  pregnancy?: {
    currentWeek: number;
    trimester: 1 | 2 | 3;
    dueDate: string;
    daysUntilDue: number;
    upcomingAppointments: PregnancyProfile["appointments"];
    pendingMilestones: PregnancyProfile["milestones"];
    latestWeight?: { date: string; weight: number; unit: string };
  };
  menopause?: {
    stage: "perimenopause" | "menopause" | "postmenopause";
    daysSinceLastPeriod?: number;
    topSymptoms: { symptom: MenopauseSymptom; avgSeverity: number }[];
    activeHrt: MenopauseProfile["hrtMedications"];
    nextScreeningDue?: { type: string; dueDate: string };
  };
  screenings: { name: string; lastDate?: string; nextDue?: string; status: "up_to_date" | "due_soon" | "overdue" | "not_scheduled" }[];
  disclaimer: string;
}

const cycles: Map<string, CycleEntry[]> = new Map();
const pregnancies: Map<string, PregnancyProfile> = new Map();
const menopauseProfiles: Map<string, MenopauseProfile> = new Map();
const lifeStages: Map<string, LifeStage> = new Map();

const DISCLAIMER = "This information is for personal health tracking and educational purposes only. It does not constitute medical advice. Always consult your healthcare provider for clinical decisions.";

function getDefaultScreenings(stage: LifeStage): WomensHealthDashboard["screenings"] {
  const base = [
    { name: "Mammogram", lastDate: undefined, nextDue: undefined, status: "not_scheduled" as const },
    { name: "Pap Smear / HPV Test", lastDate: undefined, nextDue: undefined, status: "not_scheduled" as const },
    { name: "Pelvic Exam", lastDate: undefined, nextDue: undefined, status: "not_scheduled" as const },
  ];
  if (stage === "menopause" || stage === "postmenopause") {
    base.push(
      { name: "Bone Density (DEXA) Scan", lastDate: undefined, nextDue: undefined, status: "not_scheduled" as const },
      { name: "Lipid Panel", lastDate: undefined, nextDue: undefined, status: "not_scheduled" as const },
      { name: "Thyroid Function Test", lastDate: undefined, nextDue: undefined, status: "not_scheduled" as const },
    );
  }
  if (stage === "pregnancy") {
    base.push(
      { name: "Glucose Tolerance Test", lastDate: undefined, nextDue: undefined, status: "not_scheduled" as const },
      { name: "Group B Strep Test", lastDate: undefined, nextDue: undefined, status: "not_scheduled" as const },
    );
  }
  return base;
}

function calculateTrimester(weekNumber: number): 1 | 2 | 3 {
  if (weekNumber <= 13) return 1;
  if (weekNumber <= 27) return 2;
  return 3;
}

function calculateCurrentWeek(dueDate: string): number {
  const due = new Date(dueDate);
  const now = new Date();
  const conceptionApprox = new Date(due.getTime() - 280 * 24 * 60 * 60 * 1000);
  const diffMs = now.getTime() - conceptionApprox.getTime();
  const weeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, Math.min(42, weeks));
}

export const womensHealthService = {
  getLifeStage(profileId: string): LifeStage {
    return lifeStages.get(profileId) || "menstruation";
  },

  setLifeStage(profileId: string, stage: LifeStage): LifeStage {
    lifeStages.set(profileId, stage);
    return stage;
  },

  getDashboard(profileId: string): WomensHealthDashboard {
    const stage = this.getLifeStage(profileId);
    const dashboard: WomensHealthDashboard = {
      lifeStage: stage,
      screenings: getDefaultScreenings(stage),
      disclaimer: DISCLAIMER,
    };

    if (stage === "menstruation") {
      const entries = cycles.get(profileId) || [];
      const sorted = [...entries].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      const cycleLengths = sorted.slice(0, 6).map(e => e.cycleLength).filter((v): v is number => v !== undefined);
      const avgCycleLength = cycleLengths.length > 0 ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length) : 28;
      const lastPeriod = sorted[0];
      let currentCycleDay: number | undefined;
      let nextPeriodEstimate: string | undefined;
      if (lastPeriod) {
        const daysSinceStart = Math.floor((Date.now() - new Date(lastPeriod.startDate).getTime()) / (24 * 60 * 60 * 1000));
        currentCycleDay = daysSinceStart + 1;
        const nextDate = new Date(new Date(lastPeriod.startDate).getTime() + avgCycleLength * 24 * 60 * 60 * 1000);
        nextPeriodEstimate = nextDate.toISOString().split("T")[0];
      }
      const recentSymptoms = sorted.slice(0, 3).flatMap(e => e.symptoms);
      const uniqueSymptoms = [...new Set(recentSymptoms)];
      const stdDev = cycleLengths.length >= 3 ? Math.sqrt(cycleLengths.map(x => Math.pow(x - avgCycleLength, 2)).reduce((a, b) => a + b, 0) / cycleLengths.length) : -1;

      dashboard.menstruation = {
        currentCycleDay,
        averageCycleLength: avgCycleLength,
        lastPeriodStart: lastPeriod?.startDate,
        nextPeriodEstimate,
        recentSymptoms: uniqueSymptoms.slice(0, 5) as MenstrualSymptom[],
        cycleRegularity: stdDev < 0 ? "unknown" : stdDev <= 3 ? "regular" : "irregular",
        totalCyclesTracked: entries.length,
      };
    }

    if (stage === "pregnancy") {
      const preg = pregnancies.get(profileId);
      if (preg) {
        const week = calculateCurrentWeek(preg.dueDate);
        const daysUntilDue = Math.max(0, Math.floor((new Date(preg.dueDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
        dashboard.pregnancy = {
          currentWeek: week,
          trimester: calculateTrimester(week),
          dueDate: preg.dueDate,
          daysUntilDue,
          upcomingAppointments: preg.appointments.filter(a => !a.completed).slice(0, 3),
          pendingMilestones: preg.milestones.filter(m => !m.completed),
          latestWeight: preg.weightEntries.length > 0 ? preg.weightEntries[preg.weightEntries.length - 1] : undefined,
        };
      }
    }

    if (stage === "menopause" || stage === "postmenopause") {
      const profile = menopauseProfiles.get(profileId);
      if (profile) {
        const daysSinceLastPeriod = profile.lastPeriodDate
          ? Math.floor((Date.now() - new Date(profile.lastPeriodDate).getTime()) / (24 * 60 * 60 * 1000))
          : undefined;

        const recentEntries = profile.symptomEntries.slice(-14);
        const symptomMap = new Map<MenopauseSymptom, number[]>();
        for (const entry of recentEntries) {
          for (const s of entry.symptoms) {
            if (!symptomMap.has(s.symptom)) symptomMap.set(s.symptom, []);
            symptomMap.get(s.symptom)!.push(s.severity);
          }
        }
        const topSymptoms = Array.from(symptomMap.entries())
          .map(([symptom, severities]) => ({
            symptom,
            avgSeverity: Math.round((severities.reduce((a, b) => a + b, 0) / severities.length) * 10) / 10,
          }))
          .sort((a, b) => b.avgSeverity - a.avgSeverity)
          .slice(0, 5);

        dashboard.menopause = {
          stage: profile.stage,
          daysSinceLastPeriod,
          topSymptoms,
          activeHrt: profile.hrtMedications.filter(m => !m.endDate),
          nextScreeningDue: undefined,
        };
      } else {
        dashboard.menopause = {
          stage: stage === "postmenopause" ? "postmenopause" : "perimenopause",
          topSymptoms: [],
          activeHrt: [],
        };
      }
    }

    return dashboard;
  },

  getCycles(profileId: string): CycleEntry[] {
    return (cycles.get(profileId) || []).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  },

  addCycle(profileId: string, data: { startDate: string; endDate?: string; flowIntensity: FlowIntensity; symptoms: MenstrualSymptom[]; notes?: string }): CycleEntry {
    const existing = cycles.get(profileId) || [];
    const sorted = [...existing].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    const previousCycle = sorted[0];
    let cycleLength: number | undefined;
    if (previousCycle) {
      cycleLength = Math.floor((new Date(data.startDate).getTime() - new Date(previousCycle.startDate).getTime()) / (24 * 60 * 60 * 1000));
      if (cycleLength < 10 || cycleLength > 90) cycleLength = undefined;
    }
    let periodLength: number | undefined;
    if (data.endDate) {
      periodLength = Math.floor((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (24 * 60 * 60 * 1000)) + 1;
    }
    const entry: CycleEntry = {
      id: randomUUID(),
      profileId,
      startDate: data.startDate,
      endDate: data.endDate,
      cycleLength,
      periodLength,
      flowIntensity: data.flowIntensity,
      symptoms: data.symptoms,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };
    existing.push(entry);
    cycles.set(profileId, existing);
    return entry;
  },

  deleteCycle(profileId: string, cycleId: string): boolean {
    const existing = cycles.get(profileId) || [];
    const filtered = existing.filter(c => c.id !== cycleId);
    if (filtered.length === existing.length) return false;
    cycles.set(profileId, filtered);
    return true;
  },

  getPregnancy(profileId: string): PregnancyProfile | null {
    const preg = pregnancies.get(profileId);
    if (!preg) return null;
    const week = calculateCurrentWeek(preg.dueDate);
    return { ...preg, currentWeek: week, trimester: calculateTrimester(week) };
  },

  createPregnancy(profileId: string, data: { dueDate: string; lastMenstrualPeriod?: string; provider?: string }): PregnancyProfile {
    const week = calculateCurrentWeek(data.dueDate);
    const profile: PregnancyProfile = {
      id: randomUUID(),
      profileId,
      dueDate: data.dueDate,
      lastMenstrualPeriod: data.lastMenstrualPeriod,
      currentWeek: week,
      trimester: calculateTrimester(week),
      provider: data.provider,
      complications: [],
      milestones: [
        { milestone: "first_ultrasound", completed: false },
        { milestone: "genetic_screening", completed: false },
        { milestone: "anatomy_scan", completed: false },
        { milestone: "glucose_test", completed: false },
        { milestone: "tdap_vaccine", completed: false },
        { milestone: "rh_factor_test", completed: false },
        { milestone: "fetal_movement", completed: false },
        { milestone: "group_b_strep", completed: false },
        { milestone: "birth_plan", completed: false },
        { milestone: "hospital_tour", completed: false },
      ],
      weightEntries: [],
      appointments: [],
      createdAt: new Date().toISOString(),
    };
    pregnancies.set(profileId, profile);
    this.setLifeStage(profileId, "pregnancy");
    return profile;
  },

  updatePregnancy(profileId: string, updates: Partial<Pick<PregnancyProfile, "dueDate" | "provider" | "birthPlan" | "complications">>): PregnancyProfile | null {
    const preg = pregnancies.get(profileId);
    if (!preg) return null;
    Object.assign(preg, updates);
    if (updates.dueDate) {
      preg.currentWeek = calculateCurrentWeek(updates.dueDate);
      preg.trimester = calculateTrimester(preg.currentWeek);
    }
    pregnancies.set(profileId, preg);
    return preg;
  },

  addPregnancyWeight(profileId: string, data: { date: string; weight: number; unit: string }): PregnancyProfile | null {
    const preg = pregnancies.get(profileId);
    if (!preg) return null;
    preg.weightEntries.push(data);
    pregnancies.set(profileId, preg);
    return preg;
  },

  addPregnancyAppointment(profileId: string, data: { date: string; type: string; provider?: string; notes?: string }): PregnancyProfile | null {
    const preg = pregnancies.get(profileId);
    if (!preg) return null;
    preg.appointments.push({ id: randomUUID(), ...data, completed: false });
    pregnancies.set(profileId, preg);
    return preg;
  },

  toggleMilestone(profileId: string, milestone: PregnancyMilestone, completed: boolean, date?: string): PregnancyProfile | null {
    const preg = pregnancies.get(profileId);
    if (!preg) return null;
    const m = preg.milestones.find(x => x.milestone === milestone);
    if (m) {
      m.completed = completed;
      m.date = date || (completed ? new Date().toISOString().split("T")[0] : undefined);
    }
    pregnancies.set(profileId, preg);
    return preg;
  },

  getMenopauseProfile(profileId: string): MenopauseProfile | null {
    return menopauseProfiles.get(profileId) || null;
  },

  createMenopauseProfile(profileId: string, data: { stage: "perimenopause" | "menopause" | "postmenopause"; lastPeriodDate?: string }): MenopauseProfile {
    const profile: MenopauseProfile = {
      id: randomUUID(),
      profileId,
      stage: data.stage,
      lastPeriodDate: data.lastPeriodDate,
      symptomEntries: [],
      hrtMedications: [],
      boneHealthScreenings: [],
      cardiovascularScreenings: [],
      createdAt: new Date().toISOString(),
    };
    menopauseProfiles.set(profileId, profile);
    this.setLifeStage(profileId, data.stage === "postmenopause" ? "postmenopause" : "menopause");
    return profile;
  },

  addMenopauseSymptoms(profileId: string, data: { date: string; symptoms: { symptom: MenopauseSymptom; severity: 1 | 2 | 3 | 4 | 5 }[]; notes?: string }): MenopauseProfile | null {
    const profile = menopauseProfiles.get(profileId);
    if (!profile) return null;
    profile.symptomEntries.push({ id: randomUUID(), ...data });
    menopauseProfiles.set(profileId, profile);
    return profile;
  },

  addHrtMedication(profileId: string, data: { name: string; dosage: string; startDate: string; sideEffects?: string[] }): MenopauseProfile | null {
    const profile = menopauseProfiles.get(profileId);
    if (!profile) return null;
    profile.hrtMedications.push({ id: randomUUID(), ...data });
    menopauseProfiles.set(profileId, profile);
    return profile;
  },

  addBoneHealthScreening(profileId: string, data: { date: string; type: string; result?: string; tScore?: number; notes?: string }): MenopauseProfile | null {
    const profile = menopauseProfiles.get(profileId);
    if (!profile) return null;
    profile.boneHealthScreenings.push({ id: randomUUID(), ...data });
    menopauseProfiles.set(profileId, profile);
    return profile;
  },

  addCardiovascularScreening(profileId: string, data: { date: string; type: string; result?: string; notes?: string }): MenopauseProfile | null {
    const profile = menopauseProfiles.get(profileId);
    if (!profile) return null;
    profile.cardiovascularScreenings.push({ id: randomUUID(), ...data });
    menopauseProfiles.set(profileId, profile);
    return profile;
  },

  getEducationalContent(stage: LifeStage): { title: string; summary: string; category: string }[] {
    const content: Record<LifeStage, { title: string; summary: string; category: string }[]> = {
      menstruation: [
        { title: "Understanding Your Cycle", summary: "The menstrual cycle typically lasts 21-35 days. Tracking your cycle helps you understand your body's patterns and identify irregularities early.", category: "Basics" },
        { title: "Managing Period Pain", summary: "Dysmenorrhea affects up to 90% of menstruating individuals. Heat therapy, gentle exercise, and over-the-counter pain relief can help manage symptoms.", category: "Symptom Management" },
        { title: "When to See Your Doctor", summary: "Cycles shorter than 21 days, longer than 35 days, very heavy bleeding, or severe pain warrant a conversation with your healthcare provider.", category: "When to Seek Care" },
        { title: "Nutrition & Your Cycle", summary: "Iron-rich foods can help replace iron lost during menstruation. Calcium, magnesium, and omega-3 fatty acids may help reduce PMS symptoms.", category: "Nutrition" },
      ],
      pregnancy: [
        { title: "First Trimester Guide", summary: "Weeks 1-13: Key developments include organ formation and early screening tests. Nausea, fatigue, and breast tenderness are common.", category: "Trimester Guide" },
        { title: "Second Trimester Guide", summary: "Weeks 14-27: Often called the 'golden period.' The anatomy scan occurs around week 20. You may start feeling fetal movement.", category: "Trimester Guide" },
        { title: "Third Trimester Guide", summary: "Weeks 28-40: Baby gains weight rapidly. Prepare your birth plan, take childbirth classes, and watch for signs of preeclampsia.", category: "Trimester Guide" },
        { title: "Prenatal Nutrition", summary: "Folate, iron, calcium, DHA, and vitamin D are essential during pregnancy. Your provider may recommend specific supplements.", category: "Nutrition" },
        { title: "Warning Signs to Know", summary: "Contact your provider immediately for heavy bleeding, severe headaches, vision changes, sudden swelling, reduced fetal movement, or contractions before 37 weeks.", category: "When to Seek Care" },
      ],
      menopause: [
        { title: "Understanding Perimenopause", summary: "Perimenopause can begin 4-8 years before menopause. Hormonal fluctuations cause irregular periods, hot flashes, and mood changes.", category: "Basics" },
        { title: "Hormone Replacement Therapy", summary: "HRT can effectively manage menopause symptoms. Discuss risks, benefits, and whether it's appropriate for you with your healthcare provider.", category: "Treatment Options" },
        { title: "Bone Health & Osteoporosis", summary: "Estrogen decline accelerates bone loss. Weight-bearing exercise, calcium, and vitamin D are important. DEXA scans assess bone density.", category: "Bone Health" },
        { title: "Heart Health After Menopause", summary: "Cardiovascular disease risk increases after menopause. Regular exercise, heart-healthy diet, and lipid screening are recommended.", category: "Heart Health" },
      ],
      postmenopause: [
        { title: "Staying Healthy Post-Menopause", summary: "Continue regular screenings including mammograms, bone density tests, and cardiovascular assessments. Stay active and maintain a balanced diet.", category: "Preventive Care" },
        { title: "Managing Ongoing Symptoms", summary: "Some symptoms like vaginal dryness and urinary changes may persist. Discuss management options with your healthcare provider.", category: "Symptom Management" },
        { title: "Osteoporosis Prevention", summary: "Post-menopausal individuals lose up to 20% of bone density in the 5-7 years after menopause. Regular screening and preventive measures are key.", category: "Bone Health" },
        { title: "Cognitive Health", summary: "Stay mentally active, maintain social connections, exercise regularly, and manage cardiovascular risk factors to support brain health.", category: "Cognitive Health" },
      ],
    };
    return content[stage] || [];
  },
};
