import { randomUUID } from "crypto";

export type FertilityGoal = "conceive" | "avoid" | "track_only";
export type CyclePhase = "menstrual" | "follicular" | "ovulatory" | "luteal";
export type HormoneType = "LH" | "E3G" | "PdG" | "FSH";
export type OvulationConfidence = "confirmed" | "likely" | "possible" | "none";
export type ShareStatus = "active" | "revoked" | "expired";

interface HormoneReading {
  id: string;
  profileId: string;
  date: string;
  hormoneType: HormoneType;
  value: number;
  unit: string;
  source: "mira" | "manual" | "lab";
  testTime?: string;
  notes?: string;
  createdAt: string;
}

interface FertilityCycleEntry {
  id: string;
  profileId: string;
  cycleNumber: number;
  startDate: string;
  endDate?: string;
  cycleLength?: number;
  ovulationDay?: number;
  ovulationConfidence: OvulationConfidence;
  lutealPhaseLength?: number;
  hormoneReadings: HormoneReading[];
  bbtReadings: { date: string; temperature: number; unit: "F" | "C" }[];
  cervicalMucus: { date: string; type: "dry" | "sticky" | "creamy" | "watery" | "eggwhite"; notes?: string }[];
  symptoms: { date: string; symptoms: string[]; severity?: number; notes?: string }[];
  intercourseLog: { date: string; protected: boolean; notes?: string }[];
  notes?: string;
  createdAt: string;
}

interface FertilityProfile {
  id: string;
  profileId: string;
  goal: FertilityGoal;
  age?: number;
  partnerAge?: number;
  monthsTrying?: number;
  knownConditions: string[];
  medications: string[];
  supplements: string[];
  miraDeviceConnected: boolean;
  miraDeviceId?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProviderShareLink {
  id: string;
  profileId: string;
  providerName: string;
  providerEmail?: string;
  shareToken: string;
  status: ShareStatus;
  permissions: ("cycle_data" | "hormone_data" | "symptoms" | "intercourse_log" | "notes")[];
  expiresAt?: string;
  createdAt: string;
  lastAccessedAt?: string;
}

interface FertilityInsight {
  id: string;
  type: "ovulation_prediction" | "fertile_window" | "cycle_pattern" | "hormone_trend" | "recommendation";
  title: string;
  description: string;
  confidence: number;
  date: string;
  actionable: boolean;
  action?: string;
}

interface CycleDashboard {
  profile: FertilityProfile;
  currentCycle: {
    cycleDay: number;
    phase: CyclePhase;
    phaseDay: number;
    fertileWindow: { start: string; end: string; isActive: boolean };
    ovulationEstimate?: string;
    ovulationConfidence: OvulationConfidence;
    daysUntilNextPeriod?: number;
  } | null;
  cycleStats: {
    totalCyclesTracked: number;
    averageCycleLength: number;
    averageLutealPhase: number;
    cycleRegularity: "regular" | "irregular" | "insufficient_data";
    shortestCycle: number;
    longestCycle: number;
    averageOvulationDay: number;
  };
  hormoneOverview: {
    latestLH?: { value: number; trend: "rising" | "peak" | "falling" | "baseline"; date: string };
    latestE3G?: { value: number; trend: "rising" | "peak" | "falling" | "baseline"; date: string };
    latestPdG?: { value: number; trend: "rising" | "peak" | "falling" | "baseline"; date: string };
    ovulationConfirmedByPdG: boolean;
  };
  insights: FertilityInsight[];
  providerShares: ProviderShareLink[];
  disclaimer: string;
}

const profiles: Map<string, FertilityProfile> = new Map();
const cycles: Map<string, FertilityCycleEntry[]> = new Map();
const hormoneReadings: Map<string, HormoneReading[]> = new Map();
const providerShares: Map<string, ProviderShareLink[]> = new Map();

const DISCLAIMER = "This fertility and cycle tracking information is for personal health awareness only. It does not constitute medical advice or a clinical decision support tool. Hormone interpretations are estimates and should not replace professional fertility evaluation. Always consult your reproductive endocrinologist or OB-GYN for clinical decisions.";

function getPhaseForDay(cycleDay: number, ovulationDay: number, cycleLength: number): { phase: CyclePhase; phaseDay: number } {
  if (cycleDay <= 5) return { phase: "menstrual", phaseDay: cycleDay };
  if (cycleDay < ovulationDay - 1) return { phase: "follicular", phaseDay: cycleDay - 5 };
  if (cycleDay <= ovulationDay + 1) return { phase: "ovulatory", phaseDay: cycleDay - (ovulationDay - 1) };
  return { phase: "luteal", phaseDay: cycleDay - ovulationDay - 1 };
}

function calculateFertileWindow(cycleStartDate: string, ovulationDay: number): { start: string; end: string } {
  const start = new Date(cycleStartDate);
  start.setDate(start.getDate() + ovulationDay - 5);
  const end = new Date(cycleStartDate);
  end.setDate(end.getDate() + ovulationDay + 1);
  return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
}

function determineTrend(readings: HormoneReading[]): "rising" | "peak" | "falling" | "baseline" {
  if (readings.length < 2) return "baseline";
  const sorted = [...readings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const last = sorted[sorted.length - 1].value;
  const prev = sorted[sorted.length - 2].value;
  const max = Math.max(...sorted.map(r => r.value));
  if (last === max && last > prev * 1.3) return "peak";
  if (last > prev * 1.1) return "rising";
  if (last < prev * 0.9) return "falling";
  return "baseline";
}

function generateInsights(profile: FertilityProfile, cycleEntries: FertilityCycleEntry[], readings: HormoneReading[]): FertilityInsight[] {
  const insights: FertilityInsight[] = [];
  const today = new Date().toISOString().split("T")[0];

  if (cycleEntries.length >= 3) {
    const lengths = cycleEntries.filter(c => c.cycleLength).map(c => c.cycleLength!);
    const variance = Math.max(...lengths) - Math.min(...lengths);
    if (variance <= 3) {
      insights.push({
        id: randomUUID(), type: "cycle_pattern", title: "Regular Cycle Pattern",
        description: `Your cycles are very consistent (${Math.min(...lengths)}-${Math.max(...lengths)} days). This regularity suggests healthy ovulatory function.`,
        confidence: 0.9, date: today, actionable: false,
      });
    } else if (variance > 7) {
      insights.push({
        id: randomUUID(), type: "cycle_pattern", title: "Variable Cycle Length",
        description: `Your cycle lengths vary by ${variance} days. Consider discussing this pattern with your provider for evaluation.`,
        confidence: 0.8, date: today, actionable: true, action: "Share report with provider",
      });
    }
  }

  const recentLH = readings.filter(r => r.hormoneType === "LH").sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (recentLH.length >= 2 && recentLH[0].value > recentLH[1].value * 1.5) {
    insights.push({
      id: randomUUID(), type: "ovulation_prediction", title: "LH Surge Detected",
      description: "Your LH levels show a significant rise, suggesting ovulation may occur within 24-36 hours. This is your peak fertility window.",
      confidence: 0.85, date: today, actionable: true, action: "Peak fertility — optimal timing for conception",
    });
  }

  const recentPdG = readings.filter(r => r.hormoneType === "PdG").sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (recentPdG.length > 0 && recentPdG[0].value > 5) {
    insights.push({
      id: randomUUID(), type: "hormone_trend", title: "Ovulation Confirmed via PdG",
      description: "Elevated PdG (progesterone metabolite) confirms that ovulation has occurred this cycle. This is a positive indicator of ovulatory function.",
      confidence: 0.92, date: today, actionable: false,
    });
  }

  if (profile.goal === "conceive" && profile.monthsTrying && profile.monthsTrying >= 6) {
    insights.push({
      id: randomUUID(), type: "recommendation", title: "Consider Provider Consultation",
      description: `You've been trying to conceive for ${profile.monthsTrying} months. Sharing your MIRA hormone data with a fertility specialist can help identify optimization opportunities.`,
      confidence: 0.7, date: today, actionable: true, action: "Generate provider report",
    });
  }

  if (profile.miraDeviceConnected && readings.length === 0) {
    insights.push({
      id: randomUUID(), type: "recommendation", title: "Start Tracking Hormones",
      description: "Your MIRA device is connected but no hormone readings have been recorded yet. Begin testing with your first morning urine for the most accurate results.",
      confidence: 1.0, date: today, actionable: true, action: "Log first reading",
    });
  }

  return insights;
}

export const fertilityCycleService = {
  getProfile(profileId: string): FertilityProfile {
    if (!profiles.has(profileId)) {
      const newProfile: FertilityProfile = {
        id: randomUUID(), profileId, goal: "track_only", knownConditions: [],
        medications: [], supplements: [], miraDeviceConnected: false,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      profiles.set(profileId, newProfile);
    }
    return profiles.get(profileId)!;
  },

  updateProfile(profileId: string, updates: Partial<Omit<FertilityProfile, "id" | "profileId" | "createdAt">>): FertilityProfile {
    const profile = this.getProfile(profileId);
    Object.assign(profile, updates, { updatedAt: new Date().toISOString() });
    profiles.set(profileId, profile);
    return profile;
  },

  connectMiraDevice(profileId: string, deviceId: string): FertilityProfile {
    return this.updateProfile(profileId, { miraDeviceConnected: true, miraDeviceId: deviceId });
  },

  disconnectMiraDevice(profileId: string): FertilityProfile {
    return this.updateProfile(profileId, { miraDeviceConnected: false, miraDeviceId: undefined });
  },

  getCycles(profileId: string): FertilityCycleEntry[] {
    return cycles.get(profileId) || [];
  },

  addCycle(profileId: string, data: Omit<FertilityCycleEntry, "id" | "profileId" | "createdAt" | "hormoneReadings">): FertilityCycleEntry {
    const entry: FertilityCycleEntry = {
      ...data, id: randomUUID(), profileId,
      hormoneReadings: [], createdAt: new Date().toISOString(),
    };
    const existing = cycles.get(profileId) || [];
    existing.push(entry);
    cycles.set(profileId, existing);
    return entry;
  },

  updateCycle(profileId: string, cycleId: string, updates: Partial<FertilityCycleEntry>): FertilityCycleEntry | null {
    const existing = cycles.get(profileId) || [];
    const idx = existing.findIndex(c => c.id === cycleId);
    if (idx === -1) return null;
    Object.assign(existing[idx], updates);
    return existing[idx];
  },

  addHormoneReading(profileId: string, data: Omit<HormoneReading, "id" | "profileId" | "createdAt">): HormoneReading {
    const reading: HormoneReading = { ...data, id: randomUUID(), profileId, createdAt: new Date().toISOString() };
    const existing = hormoneReadings.get(profileId) || [];
    existing.push(reading);
    hormoneReadings.set(profileId, existing);
    return reading;
  },

  getHormoneReadings(profileId: string, hormoneType?: HormoneType, startDate?: string, endDate?: string): HormoneReading[] {
    let readings = hormoneReadings.get(profileId) || [];
    if (hormoneType) readings = readings.filter(r => r.hormoneType === hormoneType);
    if (startDate) readings = readings.filter(r => r.date >= startDate);
    if (endDate) readings = readings.filter(r => r.date <= endDate);
    return readings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },

  createProviderShare(profileId: string, data: { providerName: string; providerEmail?: string; permissions: ProviderShareLink["permissions"]; expiresInDays?: number }): ProviderShareLink {
    const share: ProviderShareLink = {
      id: randomUUID(), profileId, providerName: data.providerName,
      providerEmail: data.providerEmail, shareToken: randomUUID().replace(/-/g, ""),
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

  getSharedData(shareToken: string): { profile: FertilityProfile; cycles: FertilityCycleEntry[]; hormoneReadings: HormoneReading[]; stats: CycleDashboard["cycleStats"] } | null {
    for (const [profileId, shares] of providerShares.entries()) {
      const share = shares.find(s => s.shareToken === shareToken && s.status === "active");
      if (!share) continue;
      if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
        share.status = "expired";
        continue;
      }
      share.lastAccessedAt = new Date().toISOString();
      const profile = this.getProfile(profileId);
      const cycleData = share.permissions.includes("cycle_data") ? this.getCycles(profileId) : [];
      const hormoneData = share.permissions.includes("hormone_data") ? this.getHormoneReadings(profileId) : [];
      const filteredCycles = cycleData.map(c => ({
        ...c,
        intercourseLog: share.permissions.includes("intercourse_log") ? c.intercourseLog : [],
        notes: share.permissions.includes("notes") ? c.notes : undefined,
        symptoms: share.permissions.includes("symptoms") ? c.symptoms : [],
      }));
      return { profile, cycles: filteredCycles, hormoneReadings: hormoneData, stats: this.computeStats(profileId) };
    }
    return null;
  },

  computeStats(profileId: string): CycleDashboard["cycleStats"] {
    const cycleEntries = this.getCycles(profileId);
    const completedCycles = cycleEntries.filter(c => c.cycleLength);
    if (completedCycles.length === 0) {
      return { totalCyclesTracked: cycleEntries.length, averageCycleLength: 28, averageLutealPhase: 14, cycleRegularity: "insufficient_data", shortestCycle: 0, longestCycle: 0, averageOvulationDay: 14 };
    }
    const lengths = completedCycles.map(c => c.cycleLength!);
    const lutealLengths = completedCycles.filter(c => c.lutealPhaseLength).map(c => c.lutealPhaseLength!);
    const ovDays = completedCycles.filter(c => c.ovulationDay).map(c => c.ovulationDay!);
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const variance = Math.max(...lengths) - Math.min(...lengths);
    return {
      totalCyclesTracked: cycleEntries.length,
      averageCycleLength: avg(lengths),
      averageLutealPhase: lutealLengths.length ? avg(lutealLengths) : 14,
      cycleRegularity: completedCycles.length < 3 ? "insufficient_data" : variance <= 3 ? "regular" : "irregular",
      shortestCycle: Math.min(...lengths),
      longestCycle: Math.max(...lengths),
      averageOvulationDay: ovDays.length ? avg(ovDays) : 14,
    };
  },

  getDashboard(profileId: string): CycleDashboard {
    const profile = this.getProfile(profileId);
    const cycleEntries = this.getCycles(profileId);
    const readings = this.getHormoneReadings(profileId);
    const stats = this.computeStats(profileId);
    const shares = this.getProviderShares(profileId);

    let currentCycle: CycleDashboard["currentCycle"] = null;
    const activeCycle = cycleEntries.find(c => !c.endDate);
    if (activeCycle) {
      const today = new Date();
      const cycleStart = new Date(activeCycle.startDate);
      const cycleDay = Math.floor((today.getTime() - cycleStart.getTime()) / 86400000) + 1;
      const ovDay = activeCycle.ovulationDay || stats.averageOvulationDay || 14;
      const phaseInfo = getPhaseForDay(cycleDay, ovDay, stats.averageCycleLength || 28);
      const fertileWindow = calculateFertileWindow(activeCycle.startDate, ovDay);
      const todayStr = today.toISOString().split("T")[0];
      currentCycle = {
        cycleDay, phase: phaseInfo.phase, phaseDay: phaseInfo.phaseDay,
        fertileWindow: { ...fertileWindow, isActive: todayStr >= fertileWindow.start && todayStr <= fertileWindow.end },
        ovulationEstimate: new Date(new Date(activeCycle.startDate).getTime() + (ovDay - 1) * 86400000).toISOString().split("T")[0],
        ovulationConfidence: activeCycle.ovulationConfidence,
        daysUntilNextPeriod: Math.max(0, (stats.averageCycleLength || 28) - cycleDay),
      };
    }

    const lhReadings = readings.filter(r => r.hormoneType === "LH");
    const e3gReadings = readings.filter(r => r.hormoneType === "E3G");
    const pdgReadings = readings.filter(r => r.hormoneType === "PdG");

    const hormoneOverview: CycleDashboard["hormoneOverview"] = {
      latestLH: lhReadings.length ? { value: lhReadings[lhReadings.length - 1].value, trend: determineTrend(lhReadings), date: lhReadings[lhReadings.length - 1].date } : undefined,
      latestE3G: e3gReadings.length ? { value: e3gReadings[e3gReadings.length - 1].value, trend: determineTrend(e3gReadings), date: e3gReadings[e3gReadings.length - 1].date } : undefined,
      latestPdG: pdgReadings.length ? { value: pdgReadings[pdgReadings.length - 1].value, trend: determineTrend(pdgReadings), date: pdgReadings[pdgReadings.length - 1].date } : undefined,
      ovulationConfirmedByPdG: pdgReadings.length > 0 && pdgReadings[pdgReadings.length - 1].value > 5,
    };

    const insights = generateInsights(profile, cycleEntries, readings);

    return { profile, currentCycle, cycleStats: stats, hormoneOverview, insights, providerShares: shares, disclaimer: DISCLAIMER };
  },
};
