import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export interface AutomationMetrics {
  totalJobs: number;
  successfulJobs: number;
  failedJobs: number;
  successRate: number;
  averageProcessingTimeMs: number;
  p50ProcessingTimeMs: number;
  p90ProcessingTimeMs: number;
  p99ProcessingTimeMs: number;
  byType: Record<string, { count: number; successRate: number; avgTimeMs: number }>;
  trends: { date: string; successRate: number; avgTimeMs: number; jobCount: number }[];
}

export interface RiskScoreMetrics {
  averageRiskScore: number;
  highRiskPatients: number;
  mediumRiskPatients: number;
  lowRiskPatients: number;
  criticalRiskPatients: number;
  riskDistribution: { range: string; count: number; percentage: number }[];
  trends: { date: string; avgScore: number; highRiskCount: number; assessmentCount: number }[];
  topRiskFactors: { factor: string; frequency: number; avgImpact: number }[];
}

export interface DataQualityMetrics {
  totalIssues: number;
  resolvedIssues: number;
  pendingIssues: number;
  resolutionRate: number;
  averageResolutionTimeHours: number;
  bySeverity: Record<string, { count: number; resolved: number; avgResolutionHours: number }>;
  byCategory: Record<string, { count: number; resolved: number; resolutionRate: number }>;
  trends: { date: string; newIssues: number; resolved: number; resolutionRate: number }[];
}

export interface SecurityComplianceMetrics {
  overallComplianceScore: number;
  hipaaComplianceScore: number;
  soc2ComplianceScore: number;
  gdprComplianceScore: number;
  totalVulnerabilities: number;
  criticalVulnerabilities: number;
  highVulnerabilities: number;
  remediatedVulnerabilities: number;
  remediationProgress: number;
  byCategory: Record<string, { score: number; issues: number; remediated: number }>;
  trends: { date: string; complianceScore: number; openVulns: number; remediated: number }[];
  upcomingAudits: { name: string; date: string; status: string }[];
}

export interface UserEngagementMetrics {
  totalActiveUsers: number;
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  averageSessionDurationMinutes: number;
  featureUsage: Record<string, { users: number; sessions: number; avgDurationMinutes: number }>;
  topFeatures: { feature: string; usageCount: number; uniqueUsers: number; satisfaction: number }[];
  trends: { date: string; activeUsers: number; sessions: number; avgDuration: number }[];
  patientPortalMetrics: {
    recordViews: number;
    educationModulesCompleted: number;
    medicationRemindersSet: number;
    appointmentsScheduled: number;
    messagesExchanged: number;
  };
}

export interface AnalyticsDashboard {
  generatedAt: string;
  timeRange: { start: string; end: string };
  automation: AutomationMetrics;
  riskScores: RiskScoreMetrics;
  dataQuality: DataQualityMetrics;
  security: SecurityComplianceMetrics;
  engagement: UserEngagementMetrics;
  aiInsights: string[];
  noCdsCompliance: string;
}

function generateAutomationMetrics(): AutomationMetrics {
  const totalJobs = Math.floor(Math.random() * 5000) + 2000;
  const successfulJobs = Math.floor(totalJobs * (0.92 + Math.random() * 0.06));
  const failedJobs = totalJobs - successfulJobs;
  
  const trends = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    trends.push({
      date: date.toISOString().split("T")[0],
      successRate: 0.9 + Math.random() * 0.08,
      avgTimeMs: 150 + Math.random() * 100,
      jobCount: Math.floor(100 + Math.random() * 50)
    });
  }

  return {
    totalJobs,
    successfulJobs,
    failedJobs,
    successRate: successfulJobs / totalJobs,
    averageProcessingTimeMs: 180 + Math.random() * 50,
    p50ProcessingTimeMs: 120 + Math.random() * 30,
    p90ProcessingTimeMs: 280 + Math.random() * 50,
    p99ProcessingTimeMs: 450 + Math.random() * 100,
    byType: {
      fhir_ingestion: { count: Math.floor(totalJobs * 0.3), successRate: 0.96, avgTimeMs: 200 },
      data_harmonization: { count: Math.floor(totalJobs * 0.25), successRate: 0.94, avgTimeMs: 350 },
      risk_assessment: { count: Math.floor(totalJobs * 0.2), successRate: 0.97, avgTimeMs: 180 },
      quality_validation: { count: Math.floor(totalJobs * 0.15), successRate: 0.95, avgTimeMs: 120 },
      security_scan: { count: Math.floor(totalJobs * 0.1), successRate: 0.98, avgTimeMs: 90 }
    },
    trends
  };
}

function generateRiskScoreMetrics(): RiskScoreMetrics {
  const totalPatients = Math.floor(Math.random() * 2000) + 500;
  const criticalRiskPatients = Math.floor(totalPatients * 0.05);
  const highRiskPatients = Math.floor(totalPatients * 0.15);
  const mediumRiskPatients = Math.floor(totalPatients * 0.35);
  const lowRiskPatients = totalPatients - criticalRiskPatients - highRiskPatients - mediumRiskPatients;

  const trends = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    trends.push({
      date: date.toISOString().split("T")[0],
      avgScore: 35 + Math.random() * 15,
      highRiskCount: Math.floor(20 + Math.random() * 30),
      assessmentCount: Math.floor(50 + Math.random() * 100)
    });
  }

  return {
    averageRiskScore: 42 + Math.random() * 10,
    highRiskPatients,
    mediumRiskPatients,
    lowRiskPatients,
    criticalRiskPatients,
    riskDistribution: [
      { range: "0-20 (Low)", count: lowRiskPatients, percentage: (lowRiskPatients / totalPatients) * 100 },
      { range: "21-40 (Moderate)", count: Math.floor(mediumRiskPatients * 0.6), percentage: (Math.floor(mediumRiskPatients * 0.6) / totalPatients) * 100 },
      { range: "41-60 (Medium)", count: Math.floor(mediumRiskPatients * 0.4), percentage: (Math.floor(mediumRiskPatients * 0.4) / totalPatients) * 100 },
      { range: "61-80 (High)", count: highRiskPatients, percentage: (highRiskPatients / totalPatients) * 100 },
      { range: "81-100 (Critical)", count: criticalRiskPatients, percentage: (criticalRiskPatients / totalPatients) * 100 }
    ],
    trends,
    topRiskFactors: [
      { factor: "Multiple chronic conditions", frequency: 245, avgImpact: 18.5 },
      { factor: "Medication non-adherence", frequency: 189, avgImpact: 15.2 },
      { factor: "Recent hospitalization", frequency: 156, avgImpact: 22.1 },
      { factor: "Age over 65", frequency: 312, avgImpact: 12.8 },
      { factor: "Social determinants", frequency: 98, avgImpact: 14.3 }
    ]
  };
}

function generateDataQualityMetrics(): DataQualityMetrics {
  const totalIssues = Math.floor(Math.random() * 500) + 200;
  const resolvedIssues = Math.floor(totalIssues * (0.7 + Math.random() * 0.2));
  const pendingIssues = totalIssues - resolvedIssues;

  const trends = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const newIssues = Math.floor(5 + Math.random() * 15);
    const resolved = Math.floor(newIssues * (0.7 + Math.random() * 0.25));
    trends.push({
      date: date.toISOString().split("T")[0],
      newIssues,
      resolved,
      resolutionRate: resolved / Math.max(newIssues, 1)
    });
  }

  return {
    totalIssues,
    resolvedIssues,
    pendingIssues,
    resolutionRate: resolvedIssues / totalIssues,
    averageResolutionTimeHours: 4 + Math.random() * 8,
    bySeverity: {
      critical: { count: Math.floor(totalIssues * 0.1), resolved: Math.floor(totalIssues * 0.09), avgResolutionHours: 2 },
      high: { count: Math.floor(totalIssues * 0.2), resolved: Math.floor(totalIssues * 0.18), avgResolutionHours: 4 },
      medium: { count: Math.floor(totalIssues * 0.35), resolved: Math.floor(totalIssues * 0.3), avgResolutionHours: 8 },
      low: { count: Math.floor(totalIssues * 0.35), resolved: Math.floor(totalIssues * 0.28), avgResolutionHours: 24 }
    },
    byCategory: {
      missing_data: { count: Math.floor(totalIssues * 0.25), resolved: Math.floor(totalIssues * 0.22), resolutionRate: 0.88 },
      invalid_format: { count: Math.floor(totalIssues * 0.2), resolved: Math.floor(totalIssues * 0.19), resolutionRate: 0.95 },
      duplicate_records: { count: Math.floor(totalIssues * 0.15), resolved: Math.floor(totalIssues * 0.12), resolutionRate: 0.8 },
      inconsistent_data: { count: Math.floor(totalIssues * 0.25), resolved: Math.floor(totalIssues * 0.2), resolutionRate: 0.8 },
      terminology_mismatch: { count: Math.floor(totalIssues * 0.15), resolved: Math.floor(totalIssues * 0.1), resolutionRate: 0.67 }
    },
    trends
  };
}

function generateSecurityComplianceMetrics(): SecurityComplianceMetrics {
  const totalVulnerabilities = Math.floor(Math.random() * 50) + 20;
  const remediatedVulnerabilities = Math.floor(totalVulnerabilities * (0.6 + Math.random() * 0.3));

  const trends = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    trends.push({
      date: date.toISOString().split("T")[0],
      complianceScore: 85 + Math.random() * 10,
      openVulns: Math.floor(5 + Math.random() * 15),
      remediated: Math.floor(3 + Math.random() * 10)
    });
  }

  return {
    overallComplianceScore: 92 + Math.random() * 6,
    hipaaComplianceScore: 94 + Math.random() * 5,
    soc2ComplianceScore: 91 + Math.random() * 7,
    gdprComplianceScore: 89 + Math.random() * 8,
    totalVulnerabilities,
    criticalVulnerabilities: Math.floor(totalVulnerabilities * 0.1),
    highVulnerabilities: Math.floor(totalVulnerabilities * 0.2),
    remediatedVulnerabilities,
    remediationProgress: (remediatedVulnerabilities / totalVulnerabilities) * 100,
    byCategory: {
      access_control: { score: 94, issues: 5, remediated: 4 },
      encryption: { score: 98, issues: 2, remediated: 2 },
      audit_logging: { score: 96, issues: 3, remediated: 3 },
      data_protection: { score: 92, issues: 8, remediated: 6 },
      network_security: { score: 90, issues: 6, remediated: 4 }
    },
    trends,
    upcomingAudits: [
      { name: "HIPAA Annual Review", date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], status: "scheduled" },
      { name: "SOC2 Type II", date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], status: "preparing" },
      { name: "Penetration Testing", date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], status: "in_progress" }
    ]
  };
}

function generateUserEngagementMetrics(): UserEngagementMetrics {
  const monthlyActiveUsers = Math.floor(Math.random() * 5000) + 2000;
  const weeklyActiveUsers = Math.floor(monthlyActiveUsers * 0.6);
  const dailyActiveUsers = Math.floor(weeklyActiveUsers * 0.4);

  const trends = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    trends.push({
      date: date.toISOString().split("T")[0],
      activeUsers: Math.floor(dailyActiveUsers * (0.8 + Math.random() * 0.4)),
      sessions: Math.floor(dailyActiveUsers * 1.5 * (0.8 + Math.random() * 0.4)),
      avgDuration: 8 + Math.random() * 10
    });
  }

  return {
    totalActiveUsers: monthlyActiveUsers,
    dailyActiveUsers,
    weeklyActiveUsers,
    monthlyActiveUsers,
    averageSessionDurationMinutes: 12 + Math.random() * 8,
    featureUsage: {
      health_records: { users: Math.floor(monthlyActiveUsers * 0.85), sessions: 15000, avgDurationMinutes: 8 },
      education_hub: { users: Math.floor(monthlyActiveUsers * 0.45), sessions: 5500, avgDurationMinutes: 15 },
      medication_tracking: { users: Math.floor(monthlyActiveUsers * 0.6), sessions: 8000, avgDurationMinutes: 5 },
      ai_assistant: { users: Math.floor(monthlyActiveUsers * 0.35), sessions: 4200, avgDurationMinutes: 12 },
      appointments: { users: Math.floor(monthlyActiveUsers * 0.5), sessions: 6000, avgDurationMinutes: 6 }
    },
    topFeatures: [
      { feature: "Health Records View", usageCount: 45000, uniqueUsers: 3200, satisfaction: 4.5 },
      { feature: "Medication Reminders", usageCount: 28000, uniqueUsers: 2100, satisfaction: 4.7 },
      { feature: "AI Health Assistant", usageCount: 18000, uniqueUsers: 1500, satisfaction: 4.3 },
      { feature: "Education Modules", usageCount: 12000, uniqueUsers: 1800, satisfaction: 4.6 },
      { feature: "Care Team Messaging", usageCount: 9500, uniqueUsers: 1200, satisfaction: 4.4 }
    ],
    trends,
    patientPortalMetrics: {
      recordViews: 45000 + Math.floor(Math.random() * 10000),
      educationModulesCompleted: 3500 + Math.floor(Math.random() * 1000),
      medicationRemindersSet: 8200 + Math.floor(Math.random() * 2000),
      appointmentsScheduled: 2100 + Math.floor(Math.random() * 500),
      messagesExchanged: 15000 + Math.floor(Math.random() * 5000)
    }
  };
}

async function generateAIInsights(dashboard: Partial<AnalyticsDashboard>): Promise<string[]> {
  if (!openai) {
    console.log("[AnalyticsDashboard] OpenAI not configured, using default insights");
    return getDefaultInsights(dashboard);
  }
  
  try {
    const prompt = `Analyze these healthcare workflow KPIs and provide 5 brief operational insights (NOT clinical recommendations):

Automation: ${dashboard.automation?.successRate ? (dashboard.automation.successRate * 100).toFixed(1) : 0}% success rate, ${dashboard.automation?.averageProcessingTimeMs?.toFixed(0) || 0}ms avg processing
Risk Assessment: ${dashboard.riskScores?.criticalRiskPatients || 0} critical, ${dashboard.riskScores?.highRiskPatients || 0} high-risk patients
Data Quality: ${dashboard.dataQuality?.resolutionRate ? (dashboard.dataQuality.resolutionRate * 100).toFixed(1) : 0}% resolution rate, ${dashboard.dataQuality?.pendingIssues || 0} pending issues
Security: ${dashboard.security?.overallComplianceScore?.toFixed(1) || 0}% compliance, ${dashboard.security?.criticalVulnerabilities || 0} critical vulns
Engagement: ${dashboard.engagement?.dailyActiveUsers || 0} daily active users, ${dashboard.engagement?.averageSessionDurationMinutes?.toFixed(1) || 0}min avg session

Provide 5 brief insights about operational efficiency, data quality, or system health. Each insight should be 1 sentence. NO clinical advice.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a healthcare operations analyst. Provide brief operational insights only. NO clinical recommendations. Focus on workflow efficiency, data quality, and system performance."
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 400
    });

    const insights = response.choices[0]?.message?.content?.split("\n")
      .filter(line => line.trim().length > 10)
      .slice(0, 5) || [];

    return insights.length > 0 ? insights : getDefaultInsights(dashboard);
  } catch (error) {
    console.error("[AnalyticsDashboard] AI insights error:", error);
    return getDefaultInsights(dashboard);
  }
}

function getDefaultInsights(dashboard: Partial<AnalyticsDashboard>): string[] {
  const insights: string[] = [];
  
  const successRate = dashboard.automation?.successRate || 0;
  if (successRate > 0.95) {
    insights.push("Automation success rate is excellent, indicating stable workflow processing.");
  } else if (successRate < 0.9) {
    insights.push("Automation success rate below target - review failed job logs for patterns.");
  }

  const criticalPatients = dashboard.riskScores?.criticalRiskPatients || 0;
  if (criticalPatients > 50) {
    insights.push(`${criticalPatients} patients require care coordination review (high-risk flagged).`);
  }

  const resolutionRate = dashboard.dataQuality?.resolutionRate || 0;
  if (resolutionRate < 0.8) {
    insights.push("Data quality issue resolution rate below 80% - consider additional resources.");
  }

  const complianceScore = dashboard.security?.overallComplianceScore || 0;
  if (complianceScore >= 95) {
    insights.push("Security compliance posture is strong with all controls meeting requirements.");
  }

  const dau = dashboard.engagement?.dailyActiveUsers || 0;
  const mau = dashboard.engagement?.monthlyActiveUsers || 1;
  const stickinessRatio = dau / mau;
  if (stickinessRatio > 0.3) {
    insights.push("User engagement is high with strong daily active user retention.");
  }

  while (insights.length < 5) {
    insights.push("Continue monitoring KPIs for trend analysis and optimization opportunities.");
  }

  return insights.slice(0, 5);
}

class AnalyticsDashboardService {
  async getDashboard(timeRange?: { start: string; end: string }): Promise<AnalyticsDashboard> {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const range = timeRange || {
      start: thirtyDaysAgo.toISOString(),
      end: now.toISOString()
    };

    const automation = generateAutomationMetrics();
    const riskScores = generateRiskScoreMetrics();
    const dataQuality = generateDataQualityMetrics();
    const security = generateSecurityComplianceMetrics();
    const engagement = generateUserEngagementMetrics();

    const partialDashboard = { automation, riskScores, dataQuality, security, engagement };
    const aiInsights = await generateAIInsights(partialDashboard);

    return {
      generatedAt: now.toISOString(),
      timeRange: range,
      automation,
      riskScores,
      dataQuality,
      security,
      engagement,
      aiInsights,
      noCdsCompliance: "Analytics dashboard for operational insights. NOT clinical decision support."
    };
  }

  getAutomationMetrics(): AutomationMetrics {
    return generateAutomationMetrics();
  }

  getRiskScoreMetrics(): RiskScoreMetrics {
    return generateRiskScoreMetrics();
  }

  getDataQualityMetrics(): DataQualityMetrics {
    return generateDataQualityMetrics();
  }

  getSecurityComplianceMetrics(): SecurityComplianceMetrics {
    return generateSecurityComplianceMetrics();
  }

  getUserEngagementMetrics(): UserEngagementMetrics {
    return generateUserEngagementMetrics();
  }
}

export const analyticsDashboardService = new AnalyticsDashboardService();
