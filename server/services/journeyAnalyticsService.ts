import {
  getAllJourneysForAnalytics,
  getAllTemplates,
} from "./healthJourneyService";
import type {
  AdminAnalyticsDashboard,
  JourneyAnalyticsSummary,
  JourneyTemplateMetrics,
  JourneyEngagementMetrics,
  AnalyticsTrends,
  JourneyFeedbackSummary,
  DataQualityMetrics,
  TrendDataPoint,
  AnalyticsFilter,
  HealthJourneyInstance,
} from "@shared/schema";
import { subDays, format, differenceInDays, parseISO } from "date-fns";

class JourneyAnalyticsService {
  private getDateRangeFromFilter(timeRange: string): { start: Date; end: Date } {
    const end = new Date();
    let start: Date;

    switch (timeRange) {
      case "7d":
        start = subDays(end, 7);
        break;
      case "14d":
        start = subDays(end, 14);
        break;
      case "30d":
        start = subDays(end, 30);
        break;
      case "90d":
        start = subDays(end, 90);
        break;
      case "180d":
        start = subDays(end, 180);
        break;
      case "365d":
        start = subDays(end, 365);
        break;
      case "all":
      default:
        start = subDays(end, 365 * 3);
        break;
    }

    return { start, end };
  }

  private filterJourneys(
    journeys: HealthJourneyInstance[],
    filter: AnalyticsFilter,
    dateRange: { start: Date; end: Date }
  ): HealthJourneyInstance[] {
    return journeys.filter((journey) => {
      const startedAt = parseISO(journey.startedAt);
      if (startedAt < dateRange.start || startedAt > dateRange.end) {
        return false;
      }

      if (filter.templateIds?.length && !filter.templateIds.includes(journey.templateId)) {
        return false;
      }

      if (filter.journeyStatuses?.length && !filter.journeyStatuses.includes(journey.status)) {
        return false;
      }

      return true;
    });
  }

  async getJourneySummary(filter: AnalyticsFilter): Promise<JourneyAnalyticsSummary> {
    const dateRange = this.getDateRangeFromFilter(filter.timeRange || "30d");
    const allJourneys = getAllJourneysForAnalytics();
    const journeys = this.filterJourneys(allJourneys, filter, dateRange);

    const completed = journeys.filter((j) => j.status === "completed");
    const active = journeys.filter((j) => j.status === "active");
    const abandoned = journeys.filter((j) => j.status === "abandoned");

    const completionDays = completed
      .filter((j) => j.completedAt)
      .map((j) => differenceInDays(parseISO(j.completedAt!), parseISO(j.startedAt)));

    const avgCompletionDays =
      completionDays.length > 0
        ? completionDays.reduce((a, b) => a + b, 0) / completionDays.length
        : 0;

    const avgEngagement =
      journeys.length > 0
        ? journeys.reduce((sum, j) => sum + j.progressPercent, 0) / journeys.length
        : 0;

    return {
      totalJourneysStarted: journeys.length,
      totalJourneysCompleted: completed.length,
      totalJourneysActive: active.length,
      totalJourneysAbandoned: abandoned.length,
      completionRate: journeys.length > 0 ? (completed.length / journeys.length) * 100 : 0,
      averageCompletionDays: Math.round(avgCompletionDays * 10) / 10,
      averageEngagementScore: Math.round(avgEngagement * 10) / 10,
    };
  }

  async getTemplateMetrics(filter: AnalyticsFilter): Promise<JourneyTemplateMetrics[]> {
    const dateRange = this.getDateRangeFromFilter(filter.timeRange || "30d");
    const allJourneys = getAllJourneysForAnalytics();
    const templates = getAllTemplates();
    const journeys = this.filterJourneys(allJourneys, filter, dateRange);

    const templateFilter = filter.templateIds || [];
    const categoryFilter = filter.categories || [];

    return templates
      .filter((t) => {
        if (templateFilter.length && !templateFilter.includes(t.id)) return false;
        if (categoryFilter.length && !categoryFilter.includes(t.category)) return false;
        return true;
      })
      .map((template) => {
        const templateJourneys = journeys.filter((j) => j.templateId === template.id);
        const completed = templateJourneys.filter((j) => j.status === "completed");
        const active = templateJourneys.filter((j) => j.status === "active");
        const abandoned = templateJourneys.filter((j) => j.status === "abandoned");

        const completionDays = completed
          .filter((j) => j.completedAt)
          .map((j) => differenceInDays(parseISO(j.completedAt!), parseISO(j.startedAt)));

        const avgCompletionDays =
          completionDays.length > 0
            ? completionDays.reduce((a, b) => a + b, 0) / completionDays.length
            : 0;

        const avgProgress =
          templateJourneys.length > 0
            ? templateJourneys.reduce((sum, j) => sum + j.progressPercent, 0) /
              templateJourneys.length
            : 0;

        const totalDataPoints = templateJourneys.reduce((sum, j) => {
          return (
            sum +
            j.steps.filter((s) => s.collectedData && Object.keys(s.collectedData).length > 0).length
          );
        }, 0);

        return {
          templateId: template.id,
          templateName: template.name,
          category: template.category,
          totalStarted: templateJourneys.length,
          totalCompleted: completed.length,
          totalActive: active.length,
          totalAbandoned: abandoned.length,
          completionRate:
            templateJourneys.length > 0
              ? (completed.length / templateJourneys.length) * 100
              : 0,
          averageProgressPercent: Math.round(avgProgress * 10) / 10,
          averageCompletionDays: Math.round(avgCompletionDays * 10) / 10,
          totalDataPointsCollected: totalDataPoints,
        };
      });
  }

  async getPatientEngagement(filter: AnalyticsFilter): Promise<JourneyEngagementMetrics> {
    const dateRange = this.getDateRangeFromFilter(filter.timeRange || "30d");
    const allJourneys = getAllJourneysForAnalytics();
    const journeys = this.filterJourneys(allJourneys, filter, dateRange);

    const uniquePatients = new Set(journeys.map((j) => j.userId));
    const patientsWithActiveJourneys = new Set(
      journeys.filter((j) => j.status === "active").map((j) => j.userId)
    );

    const daysInRange = differenceInDays(dateRange.end, dateRange.start) || 1;
    const totalStepsCompleted = journeys.reduce(
      (sum, j) => sum + j.steps.filter((s) => s.status === "completed").length,
      0
    );

    const totalDataSteps = journeys.reduce(
      (sum, j) => sum + j.steps.filter((s) => s.type === "data_collection").length,
      0
    );
    const completedDataSteps = journeys.reduce(
      (sum, j) =>
        sum +
        j.steps.filter((s) => s.type === "data_collection" && s.status === "completed").length,
      0
    );

    return {
      totalActivePatients: patientsWithActiveJourneys.size,
      totalPatientsWithJourneys: uniquePatients.size,
      averageJourneysPerPatient:
        uniquePatients.size > 0 ? journeys.length / uniquePatients.size : 0,
      averageStepsCompletedPerDay: Math.round((totalStepsCompleted / daysInRange) * 10) / 10,
      reminderResponseRate: 75,
      dataSubmissionRate: totalDataSteps > 0 ? (completedDataSteps / totalDataSteps) * 100 : 0,
    };
  }

  async getTrends(filter: AnalyticsFilter): Promise<AnalyticsTrends> {
    const dateRange = this.getDateRangeFromFilter(filter.timeRange || "30d");
    const allJourneys = getAllJourneysForAnalytics();
    const journeys = this.filterJourneys(allJourneys, filter, dateRange);

    const daysInRange = differenceInDays(dateRange.end, dateRange.start);
    const interval = daysInRange <= 14 ? 1 : daysInRange <= 60 ? 7 : 30;

    const generateTrendData = (
      journeys: HealthJourneyInstance[],
      getValue: (journeys: HealthJourneyInstance[], date: Date) => number
    ): TrendDataPoint[] => {
      const points: TrendDataPoint[] = [];
      for (let i = 0; i <= daysInRange; i += interval) {
        const date = subDays(dateRange.end, daysInRange - i);
        points.push({
          date: format(date, "yyyy-MM-dd"),
          value: getValue(journeys, date),
        });
      }
      return points;
    };

    return {
      journeysStarted: generateTrendData(journeys, (js, date) => {
        return js.filter((j) => {
          const startDate = parseISO(j.startedAt);
          return format(startDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
        }).length;
      }),
      journeysCompleted: generateTrendData(journeys, (js, date) => {
        return js.filter((j) => {
          if (!j.completedAt) return false;
          const completedDate = parseISO(j.completedAt);
          return format(completedDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
        }).length;
      }),
      stepCompletions: generateTrendData(journeys, (js, date) => {
        return js.reduce((sum, j) => {
          return (
            sum +
            j.steps.filter((s) => {
              if (!s.completedAt) return false;
              const completedDate = parseISO(s.completedAt);
              return format(completedDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
            }).length
          );
        }, 0);
      }),
      dataSubmissions: generateTrendData(journeys, (js, date) => {
        return js.reduce((sum, j) => {
          return (
            sum +
            j.steps.filter((s) => {
              if (!s.completedAt || !s.collectedData) return false;
              const completedDate = parseISO(s.completedAt);
              return format(completedDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
            }).length
          );
        }, 0);
      }),
      engagementScores: generateTrendData(journeys, (js, date) => {
        const activeOnDate = js.filter((j) => {
          const startDate = parseISO(j.startedAt);
          const endDate = j.completedAt ? parseISO(j.completedAt) : dateRange.end;
          return date >= startDate && date <= endDate;
        });
        if (activeOnDate.length === 0) return 0;
        return (
          activeOnDate.reduce((sum, j) => sum + j.progressPercent, 0) / activeOnDate.length
        );
      }),
    };
  }

  async getFeedbackSummary(filter: AnalyticsFilter): Promise<JourneyFeedbackSummary> {
    const dateRange = this.getDateRangeFromFilter(filter.timeRange || "30d");
    const allJourneys = getAllJourneysForAnalytics();
    const journeys = this.filterJourneys(allJourneys, filter, dateRange);

    const checkInSteps = journeys.flatMap((j) =>
      j.steps.filter((s) => s.type === "check_in" && s.collectedData)
    );

    const ratings: number[] = [];
    const challenges: string[] = [];
    const questions: string[] = [];

    checkInSteps.forEach((step) => {
      if (step.collectedData) {
        const data = step.collectedData as Record<string, string | number | boolean>;
        if (typeof data.understanding === "string") {
          ratings.push(parseInt(data.understanding, 10) || 0);
        }
        if (typeof data.confidence === "string") {
          ratings.push(parseInt(data.confidence, 10) || 0);
        }
        if (typeof data.challenges === "string" && data.challenges) {
          challenges.push(data.challenges);
        }
        if (typeof data.questions === "string" && data.questions) {
          questions.push(data.questions);
        }
      }
    });

    const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: ratings.filter((r) => r === rating).length,
    }));

    const challengeCounts = challenges.reduce(
      (acc, c) => {
        const key = c.toLowerCase().substring(0, 50);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const questionCounts = questions.reduce(
      (acc, q) => {
        const key = q.toLowerCase().substring(0, 50);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalFeedbackSubmissions: checkInSteps.length,
      averageRating:
        ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
      ratingDistribution,
      commonChallenges: Object.entries(challengeCounts)
        .map(([challenge, count]) => ({ challenge, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      commonQuestions: Object.entries(questionCounts)
        .map(([question, count]) => ({ question, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
  }

  async getDataQualityMetrics(): Promise<DataQualityMetrics> {
    const allJourneys = getAllJourneysForAnalytics();

    const dataSteps = allJourneys.flatMap((j) =>
      j.steps.filter((s) => s.type === "data_collection")
    );

    const completedDataSteps = dataSteps.filter((s) => s.status === "completed");
    const withData = completedDataSteps.filter(
      (s) => s.collectedData && Object.keys(s.collectedData).length > 0
    );

    const completenessScore = dataSteps.length > 0 ? (withData.length / dataSteps.length) * 100 : 100;

    const overdueSteps = dataSteps.filter((s) => {
      if (s.status === "completed") return false;
      if (!s.dueAt) return false;
      return parseISO(s.dueAt) < new Date();
    });

    const timelinessScore =
      dataSteps.length > 0
        ? ((dataSteps.length - overdueSteps.length) / dataSteps.length) * 100
        : 100;

    const issues: { category: string; count: number; severity: string }[] = [];

    if (completenessScore < 80) {
      issues.push({
        category: "Missing Data",
        count: dataSteps.length - withData.length,
        severity: completenessScore < 50 ? "high" : "medium",
      });
    }

    if (overdueSteps.length > 0) {
      issues.push({
        category: "Overdue Steps",
        count: overdueSteps.length,
        severity: overdueSteps.length > 10 ? "high" : "medium",
      });
    }

    const overallScore = (completenessScore + timelinessScore + 95 + 90) / 4;

    return {
      overallScore: Math.round(overallScore * 10) / 10,
      completenessScore: Math.round(completenessScore * 10) / 10,
      accuracyScore: 95,
      timelinessScore: Math.round(timelinessScore * 10) / 10,
      consistencyScore: 90,
      totalRecordsAnalyzed: dataSteps.length,
      issuesDetected: issues.reduce((sum, i) => sum + i.count, 0),
      issuesByCategory: issues,
    };
  }

  async getDashboard(filter: AnalyticsFilter): Promise<AdminAnalyticsDashboard> {
    const dateRange = this.getDateRangeFromFilter(filter.timeRange || "30d");

    const [journeySummary, templateMetrics, patientEngagement, trends, feedbackSummary, dataQuality] =
      await Promise.all([
        this.getJourneySummary(filter),
        this.getTemplateMetrics(filter),
        this.getPatientEngagement(filter),
        this.getTrends(filter),
        this.getFeedbackSummary(filter),
        this.getDataQualityMetrics(),
      ]);

    return {
      generatedAt: new Date().toISOString(),
      dateRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
      },
      journeySummary,
      templateMetrics,
      patientEngagement,
      trends,
      feedbackSummary,
      dataQuality,
    };
  }
}

export const journeyAnalyticsService = new JourneyAnalyticsService();
