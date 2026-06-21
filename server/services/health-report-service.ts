import { logPhiAccess } from "../security/hipaa-audit";
import { wearableIntegrationService, type WearableSummary, type DailySteps, type SleepData, type HealthCorrelation } from "./wearable-integration-service";

export type ReportPeriod = "weekly" | "monthly";

export interface DataSource {
  type: "wearable" | "health_record" | "translated_document" | "lab_result" | "medication";
  name: string;
  date: string;
  provider?: string;
  id?: string;
}

export interface HealthTrend {
  id: string;
  metric: string;
  category: "activity" | "sleep" | "vitals" | "nutrition" | "medication" | "mental_health";
  currentValue: number;
  previousValue: number;
  unit: string;
  changePercent: number;
  trend: "improving" | "declining" | "stable";
  dataPoints: Array<{ date: string; value: number }>;
  insight: string;
  sources: DataSource[];
}

export interface HealthGoal {
  id: string;
  name: string;
  category: string;
  target: number;
  current: number;
  unit: string;
  progressPercent: number;
  status: "on_track" | "behind" | "exceeded" | "not_started";
  deadline?: string;
  createdAt: string;
  sources: DataSource[];
}

export interface ReportCorrelation {
  id: string;
  factorA: { metric: string; trend: "up" | "down" | "stable" };
  factorB: { metric: string; trend: "up" | "down" | "stable" };
  strength: number;
  relationship: "positive" | "negative" | "unclear";
  observation: string;
  sources: DataSource[];
  noCdsDisclaimer: string;
}

export interface ReportHighlight {
  id: string;
  type: "achievement" | "concern" | "milestone" | "observation";
  title: string;
  description: string;
  importance: "high" | "medium" | "low";
  sources: DataSource[];
  date: string;
}

export interface HealthReport {
  id: string;
  patientId: string;
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  generatedAt: string;
  summary: string;
  trends: HealthTrend[];
  goals: HealthGoal[];
  correlations: ReportCorrelation[];
  highlights: ReportHighlight[];
  wearableSummary: WearableSummary | null;
  allSources: DataSource[];
  disclaimer: string;
  localizedDisclaimer: string;
  language: string;
}

const LOCALIZED_DISCLAIMERS: Record<string, string> = {
  en: "This report is for informational purposes only and does not constitute medical advice. Please consult your healthcare provider for personalized medical guidance.",
  es: "Este informe es solo para fines informativos y no constituye consejo médico. Consulte a su proveedor de atención médica para orientación médica personalizada.",
  zh: "本报告仅供参考，不构成医疗建议。请咨询您的医疗保健提供者以获取个性化的医疗指导。",
  "zh-CN": "本报告仅供参考，不构成医疗建议。请咨询您的医疗保健提供者以获取个性化的医疗指导。",
  vi: "Báo cáo này chỉ mang tính chất thông tin và không cấu thành lời khuyên y tế. Vui lòng tham khảo ý kiến bác sĩ để được hướng dẫn y tế cá nhân.",
  ar: "هذا التقرير لأغراض إعلامية فقط ولا يشكل نصيحة طبية. يرجى استشارة مقدم الرعاية الصحية الخاص بك للحصول على إرشادات طبية شخصية.",
  fr: "Ce rapport est fourni à titre informatif uniquement et ne constitue pas un avis médical. Veuillez consulter votre professionnel de santé pour des conseils médicaux personnalisés.",
  hi: "यह रिपोर्ट केवल सूचनात्मक उद्देश्यों के लिए है और चिकित्सा सलाह नहीं है। व्यक्तिगत चिकित्सा मार्गदर्शन के लिए कृपया अपने स्वास्थ्य सेवा प्रदाता से परामर्श करें।",
  ko: "이 보고서는 정보 제공 목적으로만 제공되며 의료 조언을 구성하지 않습니다. 개인 맞춤 의료 안내를 받으려면 담당 의료 제공자와 상담하세요.",
  pt: "Este relatório é apenas para fins informativos e não constitui aconselhamento médico. Consulte seu profissional de saúde para orientação médica personalizada.",
  ru: "Этот отчёт предназначен только для информационных целей и не является медицинской консультацией. Пожалуйста, обратитесь к своему врачу за персональными медицинскими рекомендациями.",
  tl: "Ang ulat na ito ay para sa mga layuning pang-impormasyon lamang at hindi bumubuo ng medikal na payo. Mangyaring kumonsulta sa iyong tagapagbigay ng pangangalagang pangkalusugan para sa personalized na gabay sa medisina."
};

class HealthReportService {
  private reports: Map<string, HealthReport[]> = new Map();
  private goals: Map<string, HealthGoal[]> = new Map();

  constructor() {
    this.initializeSampleGoals();
    console.log("[HealthReport] Service initialized");
  }

  private initializeSampleGoals(): void {
    const patientId = "patient-001";
    this.goals.set(patientId, [
      {
        id: "goal-001",
        name: "Daily Steps",
        category: "activity",
        target: 10000,
        current: 8500,
        unit: "steps",
        progressPercent: 85,
        status: "on_track",
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        sources: [{ type: "wearable", name: "Fitbit Sense 2", date: new Date().toISOString(), provider: "Fitbit" }]
      },
      {
        id: "goal-002",
        name: "Sleep Duration",
        category: "sleep",
        target: 8,
        current: 7.2,
        unit: "hours",
        progressPercent: 90,
        status: "on_track",
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        sources: [{ type: "wearable", name: "Fitbit Sense 2", date: new Date().toISOString(), provider: "Fitbit" }]
      },
      {
        id: "goal-003",
        name: "Weekly Active Minutes",
        category: "activity",
        target: 150,
        current: 125,
        unit: "minutes",
        progressPercent: 83,
        status: "on_track",
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        sources: [{ type: "wearable", name: "Activity Tracker", date: new Date().toISOString(), provider: "Fitbit" }]
      },
      {
        id: "goal-004",
        name: "Resting Heart Rate",
        category: "vitals",
        target: 60,
        current: 68,
        unit: "bpm",
        progressPercent: 60,
        status: "behind",
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        sources: [{ type: "wearable", name: "Heart Rate Monitor", date: new Date().toISOString(), provider: "Apple Health" }]
      }
    ]);
  }

  async generateReport(
    patientId: string,
    period: ReportPeriod,
    language: string = "en"
  ): Promise<HealthReport> {
    logPhiAccess({
      userId: "system",
      action: "write",
      resourceType: "HealthReport",
      patientId,
      details: `Generated ${period} health report in ${language}`
    });

    const now = new Date();
    const daysBack = period === "weekly" ? 7 : 30;
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    const wearableSummary = await wearableIntegrationService.getSummary(patientId);
    const stepsData = await wearableIntegrationService.getStepsData(patientId, daysBack);
    const sleepData = await wearableIntegrationService.getSleepData(patientId, daysBack);
    const correlations = await wearableIntegrationService.getHealthCorrelations(patientId);

    const trends = this.analyzeTrends(stepsData, sleepData, period);
    const goals = this.goals.get(patientId) || [];
    const reportCorrelations = this.transformCorrelations(correlations);
    const highlights = this.generateHighlights(trends, goals, wearableSummary);
    const allSources = this.collectSources(trends, reportCorrelations, highlights);

    const summary = this.generateSummary(trends, goals, highlights, period);

    const report: HealthReport = {
      id: `report-${Date.now()}`,
      patientId,
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      generatedAt: now.toISOString(),
      summary,
      trends,
      goals: this.updateGoalProgress(goals, wearableSummary),
      correlations: reportCorrelations,
      highlights,
      wearableSummary,
      allSources,
      disclaimer: LOCALIZED_DISCLAIMERS.en,
      localizedDisclaimer: LOCALIZED_DISCLAIMERS[language] || LOCALIZED_DISCLAIMERS.en,
      language
    };

    const existing = this.reports.get(patientId) || [];
    existing.unshift(report);
    this.reports.set(patientId, existing.slice(0, 20));

    return report;
  }

  private analyzeTrends(
    stepsData: DailySteps[],
    sleepData: SleepData[],
    period: ReportPeriod
  ): HealthTrend[] {
    const trends: HealthTrend[] = [];
    const midpoint = Math.floor(stepsData.length / 2);

    if (stepsData.length > 1) {
      const recentSteps = stepsData.slice(0, midpoint);
      const olderSteps = stepsData.slice(midpoint);
      const recentAvg = recentSteps.reduce((sum, d) => sum + d.steps, 0) / recentSteps.length || 0;
      const olderAvg = olderSteps.reduce((sum, d) => sum + d.steps, 0) / olderSteps.length || 1;
      const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

      trends.push({
        id: "trend-steps",
        metric: "Daily Steps",
        category: "activity",
        currentValue: Math.round(recentAvg),
        previousValue: Math.round(olderAvg),
        unit: "steps",
        changePercent: Math.round(changePercent),
        trend: changePercent > 5 ? "improving" : changePercent < -5 ? "declining" : "stable",
        dataPoints: stepsData.map(d => ({ date: d.date, value: d.steps })),
        insight: changePercent > 5 
          ? "Your daily step count has increased. Keep up the good work!" 
          : changePercent < -5 
            ? "Your activity has decreased recently. Consider adding more movement to your day."
            : "Your activity level remains consistent.",
        sources: [{
          type: "wearable",
          name: "Fitbit Sense 2",
          date: new Date().toISOString(),
          provider: "Fitbit"
        }]
      });

      const recentCal = recentSteps.reduce((sum, d) => sum + d.caloriesBurned, 0) / recentSteps.length || 0;
      const olderCal = olderSteps.reduce((sum, d) => sum + d.caloriesBurned, 0) / olderSteps.length || 1;
      const calChange = ((recentCal - olderCal) / olderCal) * 100;

      trends.push({
        id: "trend-calories",
        metric: "Calories Burned",
        category: "activity",
        currentValue: Math.round(recentCal),
        previousValue: Math.round(olderCal),
        unit: "kcal",
        changePercent: Math.round(calChange),
        trend: calChange > 5 ? "improving" : calChange < -5 ? "declining" : "stable",
        dataPoints: stepsData.map(d => ({ date: d.date, value: d.caloriesBurned })),
        insight: "Calorie expenditure tracks with your overall activity level.",
        sources: [{
          type: "wearable",
          name: "Fitbit Sense 2",
          date: new Date().toISOString(),
          provider: "Fitbit"
        }]
      });
    }

    if (sleepData.length > 1) {
      const sleepMid = Math.floor(sleepData.length / 2);
      const recentSleep = sleepData.slice(0, sleepMid);
      const olderSleep = sleepData.slice(sleepMid);
      const recentSleepAvg = recentSleep.reduce((sum, d) => sum + d.totalMinutes, 0) / recentSleep.length / 60 || 0;
      const olderSleepAvg = olderSleep.reduce((sum, d) => sum + d.totalMinutes, 0) / olderSleep.length / 60 || 1;
      const sleepChange = ((recentSleepAvg - olderSleepAvg) / olderSleepAvg) * 100;

      trends.push({
        id: "trend-sleep",
        metric: "Sleep Duration",
        category: "sleep",
        currentValue: Math.round(recentSleepAvg * 10) / 10,
        previousValue: Math.round(olderSleepAvg * 10) / 10,
        unit: "hours",
        changePercent: Math.round(sleepChange),
        trend: sleepChange > 5 ? "improving" : sleepChange < -5 ? "declining" : "stable",
        dataPoints: sleepData.map(d => ({ date: d.date, value: d.totalMinutes / 60 })),
        insight: recentSleepAvg >= 7 
          ? "You're getting adequate sleep. Quality rest supports overall health."
          : "Consider prioritizing more sleep for better recovery.",
        sources: [{
          type: "wearable",
          name: "Fitbit Sense 2",
          date: new Date().toISOString(),
          provider: "Fitbit"
        }]
      });

      const recentEfficiency = recentSleep.reduce((sum, d) => sum + d.sleepEfficiency, 0) / recentSleep.length || 0;
      const olderEfficiency = olderSleep.reduce((sum, d) => sum + d.sleepEfficiency, 0) / olderSleep.length || 1;
      const effChange = ((recentEfficiency - olderEfficiency) / olderEfficiency) * 100;

      trends.push({
        id: "trend-sleep-quality",
        metric: "Sleep Efficiency",
        category: "sleep",
        currentValue: Math.round(recentEfficiency),
        previousValue: Math.round(olderEfficiency),
        unit: "%",
        changePercent: Math.round(effChange),
        trend: effChange > 3 ? "improving" : effChange < -3 ? "declining" : "stable",
        dataPoints: sleepData.map(d => ({ date: d.date, value: d.sleepEfficiency })),
        insight: recentEfficiency >= 85 
          ? "Excellent sleep efficiency indicates quality rest."
          : "Sleep quality could be improved with consistent sleep schedule.",
        sources: [{
          type: "wearable",
          name: "Fitbit Sense 2",
          date: new Date().toISOString(),
          provider: "Fitbit"
        }]
      });
    }

    return trends;
  }

  private transformCorrelations(correlations: HealthCorrelation[]): ReportCorrelation[] {
    return correlations.map(c => ({
      id: c.id,
      factorA: {
        metric: c.title.split(" vs ")[0] || c.type,
        trend: c.trend === "positive" ? "up" : c.trend === "negative" ? "down" : "stable"
      },
      factorB: {
        metric: c.title.split(" vs ")[1] || "Health Metric",
        trend: c.correlationStrength > 0.5 ? "up" : "stable"
      },
      strength: c.correlationStrength,
      relationship: c.correlationStrength > 0.5 ? "positive" : c.correlationStrength < -0.3 ? "negative" : "unclear",
      observation: c.insight,
      sources: [{
        type: "wearable" as const,
        name: "Wearable Devices",
        date: new Date().toISOString(),
        provider: "Multiple"
      }],
      noCdsDisclaimer: c.noCdsDisclaimer
    }));
  }

  private generateHighlights(
    trends: HealthTrend[],
    goals: HealthGoal[],
    summary: WearableSummary | null
  ): ReportHighlight[] {
    const highlights: ReportHighlight[] = [];
    const now = new Date().toISOString();

    const improvingTrends = trends.filter(t => t.trend === "improving");
    if (improvingTrends.length > 0) {
      highlights.push({
        id: "highlight-improving",
        type: "achievement",
        title: "Positive Progress",
        description: `${improvingTrends.length} health metric${improvingTrends.length > 1 ? "s are" : " is"} showing improvement: ${improvingTrends.map(t => t.metric).join(", ")}.`,
        importance: "high",
        sources: improvingTrends.flatMap(t => t.sources),
        date: now
      });
    }

    const exceededGoals = goals.filter(g => g.status === "exceeded" || g.progressPercent >= 100);
    if (exceededGoals.length > 0) {
      highlights.push({
        id: "highlight-goals-met",
        type: "milestone",
        title: "Goals Achieved",
        description: `Congratulations! You've met ${exceededGoals.length} health goal${exceededGoals.length > 1 ? "s" : ""}: ${exceededGoals.map(g => g.name).join(", ")}.`,
        importance: "high",
        sources: [{
          type: "health_record",
          name: "Health Goals",
          date: now
        }],
        date: now
      });
    }

    if (summary && summary.avgSleepScore >= 80) {
      highlights.push({
        id: "highlight-sleep-quality",
        type: "achievement",
        title: "Excellent Sleep Quality",
        description: `Your average sleep score of ${summary.avgSleepScore} indicates consistent, quality rest.`,
        importance: "medium",
        sources: [{
          type: "wearable",
          name: "Sleep Tracker",
          date: now,
          provider: "Fitbit"
        }],
        date: now
      });
    }

    const decliningTrends = trends.filter(t => t.trend === "declining");
    if (decliningTrends.length > 0) {
      highlights.push({
        id: "highlight-attention",
        type: "concern",
        title: "Areas for Attention",
        description: `Some metrics have declined: ${decliningTrends.map(t => t.metric).join(", ")}. Consider reviewing these areas.`,
        importance: "medium",
        sources: decliningTrends.flatMap(t => t.sources),
        date: now
      });
    }

    if (summary && summary.weeklyActiveMinutes >= 150) {
      highlights.push({
        id: "highlight-activity-goal",
        type: "milestone",
        title: "Weekly Activity Target Met",
        description: `You've achieved ${summary.weeklyActiveMinutes} active minutes this week, meeting the recommended 150 minutes.`,
        importance: "high",
        sources: [{
          type: "wearable",
          name: "Activity Tracker",
          date: now,
          provider: "Fitbit"
        }],
        date: now
      });
    }

    return highlights;
  }

  private updateGoalProgress(goals: HealthGoal[], summary: WearableSummary | null): HealthGoal[] {
    if (!summary) return goals;

    return goals.map(goal => {
      let current = goal.current;
      let status = goal.status;

      switch (goal.name) {
        case "Daily Steps":
          current = summary.todaySteps;
          break;
        case "Sleep Duration":
          current = summary.lastNightSleep ? summary.lastNightSleep.totalMinutes / 60 : goal.current;
          break;
        case "Weekly Active Minutes":
          current = summary.weeklyActiveMinutes;
          break;
        case "Resting Heart Rate":
          current = summary.restingHeartRate;
          break;
      }

      const progressPercent = Math.min(100, Math.round((current / goal.target) * 100));
      if (progressPercent >= 100) status = "exceeded";
      else if (progressPercent >= 80) status = "on_track";
      else if (progressPercent >= 50) status = "behind";
      else status = "not_started";

      return { ...goal, current, progressPercent, status };
    });
  }

  private generateSummary(
    trends: HealthTrend[],
    goals: HealthGoal[],
    highlights: ReportHighlight[],
    period: ReportPeriod
  ): string {
    const periodText = period === "weekly" ? "This week" : "This month";
    const improvingCount = trends.filter(t => t.trend === "improving").length;
    const goalsOnTrack = goals.filter(g => g.status === "on_track" || g.status === "exceeded").length;
    const achievements = highlights.filter(h => h.type === "achievement" || h.type === "milestone").length;

    let summary = `${periodText}, `;

    if (improvingCount > 0) {
      summary += `${improvingCount} health metric${improvingCount > 1 ? "s" : ""} showed improvement. `;
    }

    if (goalsOnTrack > 0) {
      summary += `You're on track with ${goalsOnTrack} of ${goals.length} health goals. `;
    }

    if (achievements > 0) {
      summary += `Notable achievements include ${achievements} milestone${achievements > 1 ? "s" : ""}. `;
    }

    if (improvingCount === 0 && goalsOnTrack === 0) {
      summary += "Consider focusing on consistent daily activity and sleep habits to see improvements.";
    }

    return summary.trim();
  }

  private collectSources(
    trends: HealthTrend[],
    correlations: ReportCorrelation[],
    highlights: ReportHighlight[]
  ): DataSource[] {
    const sourceMap = new Map<string, DataSource>();

    trends.forEach(t => t.sources.forEach(s => sourceMap.set(`${s.type}-${s.name}`, s)));
    correlations.forEach(c => c.sources.forEach(s => sourceMap.set(`${s.type}-${s.name}`, s)));
    highlights.forEach(h => h.sources.forEach(s => sourceMap.set(`${s.type}-${s.name}`, s)));

    return Array.from(sourceMap.values());
  }

  async getReportHistory(patientId: string): Promise<HealthReport[]> {
    logPhiAccess({
      userId: "system",
      action: "read",
      resourceType: "HealthReport",
      patientId,
      details: "Viewed report history"
    });

    return this.reports.get(patientId) || [];
  }

  async getGoals(patientId: string): Promise<HealthGoal[]> {
    return this.goals.get(patientId) || [];
  }

  async setGoal(patientId: string, goal: Omit<HealthGoal, "id" | "createdAt" | "progressPercent" | "status" | "sources">): Promise<HealthGoal> {
    logPhiAccess({
      userId: "system",
      action: "write",
      resourceType: "HealthGoal",
      patientId,
      details: `Created health goal: ${goal.name}`
    });

    const newGoal: HealthGoal = {
      ...goal,
      id: `goal-${Date.now()}`,
      progressPercent: Math.min(100, Math.round((goal.current / goal.target) * 100)),
      status: goal.current >= goal.target ? "exceeded" : goal.current >= goal.target * 0.8 ? "on_track" : "behind",
      createdAt: new Date().toISOString(),
      sources: [{ type: "health_record", name: "Health Goals", date: new Date().toISOString() }]
    };

    const existing = this.goals.get(patientId) || [];
    existing.push(newGoal);
    this.goals.set(patientId, existing);

    return newGoal;
  }

  getLocalizedDisclaimer(language: string): string {
    return LOCALIZED_DISCLAIMERS[language] || LOCALIZED_DISCLAIMERS.en;
  }
}

export const healthReportService = new HealthReportService();
