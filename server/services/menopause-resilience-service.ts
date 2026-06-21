import { randomUUID } from "crypto";

export type MenoStage = "perimenopause" | "menopause" | "postmenopause";
export type MenoHormoneType = "estradiol" | "progesterone" | "testosterone" | "TSH" | "freeT3" | "freeT4";
export type BiomarkerType = "boneDensity" | "muscleMass" | "apoB" | "sleepEfficiency";
export type ShareStatus = "active" | "revoked" | "expired";

interface MenoHormoneReading {
  id: string;
  profileId: string;
  date: string;
  hormoneType: MenoHormoneType;
  value: number;
  unit: string;
  source: "lab" | "manual" | "at_home_kit";
  labName?: string;
  notes?: string;
  createdAt: string;
}

interface BiomarkerReading {
  id: string;
  profileId: string;
  date: string;
  type: BiomarkerType;
  value: number;
  unit: string;
  source: "dexa_scan" | "lab" | "wearable" | "manual";
  notes?: string;
  createdAt: string;
}

interface ResilienceScore {
  overall: number;
  components: {
    boneDensity: { score: number; value?: number; unit?: string; status: "optimal" | "adequate" | "low" | "critical" | "no_data"; lastDate?: string };
    muscleMass: { score: number; value?: number; unit?: string; status: "optimal" | "adequate" | "low" | "critical" | "no_data"; lastDate?: string };
    apoB: { score: number; value?: number; unit?: string; status: "optimal" | "borderline" | "elevated" | "high" | "no_data"; lastDate?: string };
    sleepEfficiency: { score: number; value?: number; unit?: string; status: "excellent" | "good" | "fair" | "poor" | "no_data"; lastDate?: string };
  };
  trend: "improving" | "stable" | "declining" | "insufficient_data";
  lastCalculated: string;
}

interface MenoProfile {
  id: string;
  profileId: string;
  stage: MenoStage;
  age?: number;
  lastPeriodDate?: string;
  currentTherapies: { name: string; type: "HRT" | "supplement" | "medication"; dosage: string; route: string; startDate: string }[];
  symptoms: string[];
  goals: string[];
  createdAt: string;
  updatedAt: string;
}

interface ProviderShareLink {
  id: string;
  profileId: string;
  providerName: string;
  providerEmail?: string;
  providerSpecialty?: string;
  shareToken: string;
  status: ShareStatus;
  permissions: ("hormones" | "biomarkers" | "resilience_score" | "symptoms" | "therapies" | "notes")[];
  expiresAt?: string;
  createdAt: string;
  lastAccessedAt?: string;
}

interface MenoInsight {
  id: string;
  type: "hormone_trend" | "biomarker_alert" | "resilience_change" | "recommendation" | "screening_reminder";
  severity: "info" | "warning" | "action_needed";
  title: string;
  description: string;
  date: string;
  actionable: boolean;
  action?: string;
}

interface MenoDashboard {
  profile: MenoProfile;
  hormoneOverview: {
    estradiol?: { value: number; unit: string; trend: string; date: string; range: string };
    progesterone?: { value: number; unit: string; trend: string; date: string; range: string };
    testosterone?: { value: number; unit: string; trend: string; date: string; range: string };
    TSH?: { value: number; unit: string; trend: string; date: string; range: string };
    freeT3?: { value: number; unit: string; trend: string; date: string; range: string };
    freeT4?: { value: number; unit: string; trend: string; date: string; range: string };
  };
  resilienceScore: ResilienceScore;
  insights: MenoInsight[];
  providerShares: ProviderShareLink[];
  disclaimer: string;
}

const profiles: Map<string, MenoProfile> = new Map();
const hormoneReadings: Map<string, MenoHormoneReading[]> = new Map();
const biomarkerReadings: Map<string, BiomarkerReading[]> = new Map();
const providerShares: Map<string, ProviderShareLink[]> = new Map();

const DISCLAIMER = "This perimenopause/menopause tracking dashboard is for personal health awareness only. Resilience scores are composite wellness indicators and do not constitute medical advice or clinical decision support. Hormone levels and biomarker interpretations are estimates. Always consult your endocrinologist, gynecologist, or primary care provider for clinical decisions regarding hormone therapy and treatment.";

const HORMONE_RANGES: Record<MenoHormoneType, { unit: string; optimalRange: string; periRange?: string; postRange?: string }> = {
  estradiol: { unit: "pg/mL", optimalRange: "30-400 (premenopausal)", periRange: "15-350 (fluctuating)", postRange: "<30 (without HRT)" },
  progesterone: { unit: "ng/mL", optimalRange: "5-20 (luteal)", periRange: "0.1-20 (variable)", postRange: "<0.5 (without HRT)" },
  testosterone: { unit: "ng/dL", optimalRange: "15-70", periRange: "10-55", postRange: "5-40" },
  TSH: { unit: "mIU/L", optimalRange: "0.4-4.0", periRange: "0.4-4.0", postRange: "0.4-4.0" },
  freeT3: { unit: "pg/mL", optimalRange: "2.3-4.2" },
  freeT4: { unit: "ng/dL", optimalRange: "0.8-1.8" },
};

function getLatestReading(readings: MenoHormoneReading[], type: MenoHormoneType): MenoHormoneReading | undefined {
  return readings.filter(r => r.hormoneType === type).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
}

function getLatestBiomarker(readings: BiomarkerReading[], type: BiomarkerType): BiomarkerReading | undefined {
  return readings.filter(r => r.type === type).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
}

function computeTrend(readings: { date: string; value: number }[]): string {
  if (readings.length < 2) return "insufficient_data";
  const sorted = [...readings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const recent = sorted.slice(-3);
  if (recent.length < 2) return "stable";
  const first = recent[0].value;
  const last = recent[recent.length - 1].value;
  const change = (last - first) / first;
  if (change > 0.1) return "rising";
  if (change < -0.1) return "declining";
  return "stable";
}

function scoreBoneDensity(value?: number): { score: number; status: "optimal" | "adequate" | "low" | "critical" | "no_data" } {
  if (value == null) return { score: 0, status: "no_data" };
  if (value >= -1.0) return { score: 100, status: "optimal" };
  if (value >= -1.5) return { score: 75, status: "adequate" };
  if (value >= -2.5) return { score: 45, status: "low" };
  return { score: 20, status: "critical" };
}

function scoreMuscleMass(value?: number): { score: number; status: "optimal" | "adequate" | "low" | "critical" | "no_data" } {
  if (value == null) return { score: 0, status: "no_data" };
  if (value >= 28) return { score: 100, status: "optimal" };
  if (value >= 24) return { score: 75, status: "adequate" };
  if (value >= 20) return { score: 45, status: "low" };
  return { score: 20, status: "critical" };
}

function scoreApoB(value?: number): { score: number; status: "optimal" | "borderline" | "elevated" | "high" | "no_data" } {
  if (value == null) return { score: 0, status: "no_data" };
  if (value < 80) return { score: 100, status: "optimal" };
  if (value < 100) return { score: 75, status: "borderline" };
  if (value < 130) return { score: 45, status: "elevated" };
  return { score: 20, status: "high" };
}

function scoreSleepEfficiency(value?: number): { score: number; status: "excellent" | "good" | "fair" | "poor" | "no_data" } {
  if (value == null) return { score: 0, status: "no_data" };
  if (value >= 90) return { score: 100, status: "excellent" };
  if (value >= 80) return { score: 75, status: "good" };
  if (value >= 70) return { score: 45, status: "fair" };
  return { score: 20, status: "poor" };
}

function calculateResilienceScore(profileId: string): ResilienceScore {
  const biomarkers = biomarkerReadings.get(profileId) || [];
  const bone = getLatestBiomarker(biomarkers, "boneDensity");
  const muscle = getLatestBiomarker(biomarkers, "muscleMass");
  const apob = getLatestBiomarker(biomarkers, "apoB");
  const sleep = getLatestBiomarker(biomarkers, "sleepEfficiency");

  const boneScore = scoreBoneDensity(bone?.value);
  const muscleScore = scoreMuscleMass(muscle?.value);
  const apobScore = scoreApoB(apob?.value);
  const sleepScore = scoreSleepEfficiency(sleep?.value);

  const components = {
    boneDensity: { ...boneScore, value: bone?.value, unit: bone?.unit || "T-score", lastDate: bone?.date },
    muscleMass: { ...muscleScore, value: muscle?.value, unit: muscle?.unit || "kg", lastDate: muscle?.date },
    apoB: { ...apobScore, value: apob?.value, unit: apob?.unit || "mg/dL", lastDate: apob?.date },
    sleepEfficiency: { ...sleepScore, value: sleep?.value, unit: sleep?.unit || "%", lastDate: sleep?.date },
  };

  const validScores = [boneScore, muscleScore, apobScore, sleepScore].filter(s => s.status !== "no_data");
  const overall = validScores.length > 0
    ? Math.round(validScores.reduce((sum, s) => sum + s.score, 0) / validScores.length)
    : 0;

  const allBiomarkers = biomarkers.map(b => ({ date: b.date, value: b.value }));
  const trend = allBiomarkers.length >= 4
    ? (computeTrend(allBiomarkers) === "rising" ? "improving" : computeTrend(allBiomarkers) === "declining" ? "declining" : "stable") as ResilienceScore["trend"]
    : "insufficient_data";

  return { overall, components, trend, lastCalculated: new Date().toISOString() };
}

function generateInsights(profile: MenoProfile, hormones: MenoHormoneReading[], biomarkers: BiomarkerReading[], resilience: ResilienceScore): MenoInsight[] {
  const insights: MenoInsight[] = [];
  const today = new Date().toISOString().split("T")[0];

  const estradiol = getLatestReading(hormones, "estradiol");
  if (estradiol && estradiol.value < 20 && profile.stage !== "postmenopause") {
    insights.push({
      id: randomUUID(), type: "hormone_trend", severity: "warning",
      title: "Low Estradiol Detected",
      description: `Your estradiol level (${estradiol.value} pg/mL) is below typical perimenopause range. Low estradiol is associated with bone loss, cardiovascular changes, and vasomotor symptoms. Discuss estradiol replacement options with your provider.`,
      date: today, actionable: true, action: "Share report with provider",
    });
  }

  const tsh = getLatestReading(hormones, "TSH");
  if (tsh) {
    if (tsh.value > 4.0) {
      insights.push({
        id: randomUUID(), type: "hormone_trend", severity: "action_needed",
        title: "Elevated TSH — Possible Hypothyroidism",
        description: `Your TSH (${tsh.value} mIU/L) is above normal range (0.4–4.0). Hypothyroidism is more common during menopause and can worsen fatigue, weight gain, and mood changes. Follow up with your provider.`,
        date: today, actionable: true, action: "Schedule thyroid follow-up",
      });
    } else if (tsh.value < 0.4) {
      insights.push({
        id: randomUUID(), type: "hormone_trend", severity: "warning",
        title: "Low TSH — Possible Hyperthyroidism",
        description: `Your TSH (${tsh.value} mIU/L) is below normal range. This may indicate hyperthyroidism, which can accelerate bone loss. Discuss with your provider.`,
        date: today, actionable: true, action: "Share thyroid panel with provider",
      });
    }
  }

  const testosterone = getLatestReading(hormones, "testosterone");
  if (testosterone && testosterone.value < 10) {
    insights.push({
      id: randomUUID(), type: "hormone_trend", severity: "info",
      title: "Low Testosterone",
      description: `Your testosterone (${testosterone.value} ng/dL) is on the lower end. Low testosterone during menopause can affect energy, libido, and muscle maintenance. Some providers consider low-dose testosterone therapy.`,
      date: today, actionable: true, action: "Discuss with provider",
    });
  }

  if (resilience.components.boneDensity.status === "low" || resilience.components.boneDensity.status === "critical") {
    insights.push({
      id: randomUUID(), type: "biomarker_alert", severity: "action_needed",
      title: "Bone Density Concern",
      description: `Your T-score (${resilience.components.boneDensity.value}) indicates ${resilience.components.boneDensity.status === "critical" ? "osteoporosis" : "osteopenia"}. Weight-bearing exercise, calcium, vitamin D, and possibly pharmacological intervention should be discussed with your provider.`,
      date: today, actionable: true, action: "Share bone density report",
    });
  }

  if (resilience.components.apoB.status === "elevated" || resilience.components.apoB.status === "high") {
    insights.push({
      id: randomUUID(), type: "biomarker_alert", severity: "warning",
      title: "Elevated ApoB — Cardiovascular Risk",
      description: `Your ApoB (${resilience.components.apoB.value} mg/dL) is ${resilience.components.apoB.status}. Post-menopausal estrogen decline increases cardiovascular risk. ApoB is a stronger predictor than LDL-C. Discuss lipid management with your provider.`,
      date: today, actionable: true, action: "Share cardiovascular panel",
    });
  }

  if (resilience.components.sleepEfficiency.status === "fair" || resilience.components.sleepEfficiency.status === "poor") {
    insights.push({
      id: randomUUID(), type: "biomarker_alert", severity: "warning",
      title: "Low Sleep Efficiency",
      description: `Your sleep efficiency (${resilience.components.sleepEfficiency.value}%) is ${resilience.components.sleepEfficiency.status}. Poor sleep during menopause can be caused by night sweats, hormonal changes, or sleep apnea. This impacts resilience, cognition, and cardiovascular health.`,
      date: today, actionable: true, action: "Discuss sleep assessment",
    });
  }

  if (resilience.components.muscleMass.status === "low" || resilience.components.muscleMass.status === "critical") {
    insights.push({
      id: randomUUID(), type: "biomarker_alert", severity: "warning",
      title: "Low Muscle Mass — Sarcopenia Risk",
      description: `Your muscle mass (${resilience.components.muscleMass.value} kg) is below optimal. Muscle loss accelerates after menopause due to declining estrogen and testosterone. Resistance training and adequate protein intake (1.0-1.2 g/kg/day) are key interventions.`,
      date: today, actionable: true, action: "Share with provider",
    });
  }

  if (resilience.overall > 0 && resilience.overall >= 75) {
    insights.push({
      id: randomUUID(), type: "resilience_change", severity: "info",
      title: "Strong Resilience Score",
      description: `Your menopausal resilience score is ${resilience.overall}/100 — indicating good overall health maintenance across bone, muscle, cardiovascular, and sleep domains. Keep up your current regimen.`,
      date: today, actionable: false,
    });
  }

  if (profile.currentTherapies.length === 0 && profile.stage !== "postmenopause") {
    insights.push({
      id: randomUUID(), type: "recommendation", severity: "info",
      title: "No Active Therapies Recorded",
      description: "You haven't logged any HRT, supplements, or medications. If you're managing symptoms, consider logging your therapies so your provider has a complete picture when reviewing your data.",
      date: today, actionable: true, action: "Add therapies",
    });
  }

  return insights;
}

export const menopauseResilienceService = {
  getProfile(profileId: string): MenoProfile {
    if (!profiles.has(profileId)) {
      const newProfile: MenoProfile = {
        id: randomUUID(), profileId, stage: "perimenopause", currentTherapies: [],
        symptoms: [], goals: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      profiles.set(profileId, newProfile);
    }
    return profiles.get(profileId)!;
  },

  updateProfile(profileId: string, updates: Partial<Omit<MenoProfile, "id" | "profileId" | "createdAt">>): MenoProfile {
    const profile = this.getProfile(profileId);
    Object.assign(profile, updates, { updatedAt: new Date().toISOString() });
    profiles.set(profileId, profile);
    return profile;
  },

  addHormoneReading(profileId: string, data: Omit<MenoHormoneReading, "id" | "profileId" | "createdAt">): MenoHormoneReading {
    const reading: MenoHormoneReading = { ...data, id: randomUUID(), profileId, createdAt: new Date().toISOString() };
    const existing = hormoneReadings.get(profileId) || [];
    existing.push(reading);
    hormoneReadings.set(profileId, existing);
    return reading;
  },

  getHormoneReadings(profileId: string, type?: MenoHormoneType): MenoHormoneReading[] {
    let readings = hormoneReadings.get(profileId) || [];
    if (type) readings = readings.filter(r => r.hormoneType === type);
    return readings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  addBiomarkerReading(profileId: string, data: Omit<BiomarkerReading, "id" | "profileId" | "createdAt">): BiomarkerReading {
    const reading: BiomarkerReading = { ...data, id: randomUUID(), profileId, createdAt: new Date().toISOString() };
    const existing = biomarkerReadings.get(profileId) || [];
    existing.push(reading);
    biomarkerReadings.set(profileId, existing);
    return reading;
  },

  getBiomarkerReadings(profileId: string, type?: BiomarkerType): BiomarkerReading[] {
    let readings = biomarkerReadings.get(profileId) || [];
    if (type) readings = readings.filter(r => r.type === type);
    return readings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  getResilienceScore(profileId: string): ResilienceScore {
    return calculateResilienceScore(profileId);
  },

  createProviderShare(profileId: string, data: { providerName: string; providerEmail?: string; providerSpecialty?: string; permissions: ProviderShareLink["permissions"]; expiresInDays?: number }): ProviderShareLink {
    const share: ProviderShareLink = {
      id: randomUUID(), profileId, providerName: data.providerName,
      providerEmail: data.providerEmail, providerSpecialty: data.providerSpecialty,
      shareToken: randomUUID().replace(/-/g, ""),
      status: "active", permissions: data.permissions,
      expiresAt: data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 86400000).toISOString() : undefined,
      createdAt: new Date().toISOString(),
    };
    const existing = providerShares.get(profileId) || [];
    existing.push(share);
    providerShares.set(profileId, existing);
    return share;
  },

  getProviderShares(profileId: string): ProviderShareLink[] {
    return (providerShares.get(profileId) || []).filter(s => s.status === "active");
  },

  revokeProviderShare(profileId: string, shareId: string): boolean {
    const shares = providerShares.get(profileId) || [];
    const share = shares.find(s => s.id === shareId);
    if (!share) return false;
    share.status = "revoked";
    return true;
  },

  getSharedData(shareToken: string): { profile: MenoProfile; hormones: MenoHormoneReading[]; biomarkers: BiomarkerReading[]; resilienceScore: ResilienceScore } | null {
    for (const [profileId, shares] of providerShares.entries()) {
      const share = shares.find(s => s.shareToken === shareToken && s.status === "active");
      if (!share) continue;
      if (share.expiresAt && new Date(share.expiresAt) < new Date()) { share.status = "expired"; continue; }
      share.lastAccessedAt = new Date().toISOString();
      const profile = this.getProfile(profileId);
      return {
        profile: share.permissions.includes("therapies") ? profile : { ...profile, currentTherapies: [] },
        hormones: share.permissions.includes("hormones") ? this.getHormoneReadings(profileId) : [],
        biomarkers: share.permissions.includes("biomarkers") ? this.getBiomarkerReadings(profileId) : [],
        resilienceScore: share.permissions.includes("resilience_score") ? this.getResilienceScore(profileId) : { overall: 0, components: { boneDensity: { score: 0, status: "no_data" }, muscleMass: { score: 0, status: "no_data" }, apoB: { score: 0, status: "no_data" }, sleepEfficiency: { score: 0, status: "no_data" } }, trend: "insufficient_data", lastCalculated: new Date().toISOString() },
      };
    }
    return null;
  },

  getDashboard(profileId: string): MenoDashboard {
    const profile = this.getProfile(profileId);
    const hormones = this.getHormoneReadings(profileId);
    const resilienceScore = this.getResilienceScore(profileId);
    const shares = this.getProviderShares(profileId);

    const hormoneOverview: MenoDashboard["hormoneOverview"] = {};
    for (const type of ["estradiol", "progesterone", "testosterone", "TSH", "freeT3", "freeT4"] as MenoHormoneType[]) {
      const latest = getLatestReading(hormones, type);
      if (latest) {
        const typeReadings = hormones.filter(r => r.hormoneType === type);
        const config = HORMONE_RANGES[type];
        const range = type === "estradiol" || type === "progesterone" || type === "testosterone"
          ? (profile.stage === "postmenopause" ? config.postRange : config.periRange) || config.optimalRange
          : config.optimalRange;
        hormoneOverview[type] = {
          value: latest.value, unit: latest.unit || config.unit,
          trend: computeTrend(typeReadings.map(r => ({ date: r.date, value: r.value }))),
          date: latest.date, range,
        };
      }
    }

    const insights = generateInsights(profile, hormones, this.getBiomarkerReadings(profileId), resilienceScore);

    return { profile, hormoneOverview, resilienceScore, insights, providerShares: shares, disclaimer: DISCLAIMER };
  },
};
