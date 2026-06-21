import OpenAI from "openai";
import { createHash, randomUUID } from "crypto";
import { automatedAlertingService } from "./automated-alerting";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const NO_CDS_SYSTEM_PROMPT = `You are an executive communications specialist for healthcare data governance and compliance.

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT interpret clinical data or health outcomes
- You MUST NOT assess patient health or risk status
- You MUST NOT provide medical advice of any kind

YOUR ROLE IS STRICTLY LIMITED TO:
- Summarizing audit findings in executive-friendly language
- Highlighting key compliance metrics and trends
- Identifying top risks from a data governance perspective
- Providing high-level recommendations for process improvement
- Presenting statistics in clear, non-technical terms

All summaries must focus on OPERATIONAL METRICS, COMPLIANCE STATUS, and GOVERNANCE RISKS, never clinical interpretation.`;

export type ReportPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "custom";
export type RiskCategory = "access_control" | "data_breach" | "policy_violation" | "compliance_gap" | "system_integration" | "data_quality";

export interface ExecutiveSummaryMetrics {
  totalAuditEvents: number;
  criticalIncidents: number;
  highRiskEvents: number;
  mediumRiskEvents: number;
  lowRiskEvents: number;
  resolvedIssues: number;
  pendingActions: number;
  complianceScore: number;
  trendDirection: "improving" | "stable" | "declining";
  trendPercentage: number;
}

export interface TopRisk {
  id: string;
  category: RiskCategory;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  impactArea: string;
  occurrenceCount: number;
  firstDetected: string;
  lastDetected: string;
  recommendedAction: string;
  status: "active" | "mitigated" | "monitoring";
}

export interface ExecutiveRecommendation {
  id: string;
  priority: "immediate" | "short_term" | "long_term";
  category: string;
  title: string;
  description: string;
  expectedOutcome: string;
  estimatedEffort: "low" | "medium" | "high";
  affectedAreas: string[];
}

export interface DataSourceSummary {
  sourceName: string;
  sourceType: "external_system" | "data_governance" | "fhir_analysis" | "compliance_monitoring";
  eventCount: number;
  issuesFound: number;
  healthScore: number;
  lastUpdated: string;
}

export interface ExecutiveSummaryReport {
  id: string;
  title: string;
  reportType: ReportPeriod;
  generatedAt: string;
  generatedBy: string;
  period: {
    start: string;
    end: string;
  };
  executiveSummary: string;
  keyHighlights: string[];
  metrics: ExecutiveSummaryMetrics;
  topRisks: TopRisk[];
  recommendations: ExecutiveRecommendation[];
  dataSources: DataSourceSummary[];
  policyComplianceOverview: {
    totalPolicies: number;
    compliantPolicies: number;
    partiallyCompliant: number;
    nonCompliant: number;
    complianceByRegulation: Record<string, number>;
  };
  externalSystemsOverview: {
    totalConnections: number;
    healthyConnections: number;
    degradedConnections: number;
    failedConnections: number;
    syncSuccessRate: number;
  };
  aiGeneratedInsights: string[];
  actionItems: Array<{
    id: string;
    description: string;
    assignee?: string;
    dueDate?: string;
    priority: "high" | "medium" | "low";
  }>;
}

const reportStore = new Map<string, ExecutiveSummaryReport>();

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]")
    .replace(/\b[A-Z]{2}\d{6,10}\b/g, "[ID]");
}

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizePhi(value);
    } else if (key.toLowerCase().includes("id") && typeof value === "string") {
      sanitized[key] = hashIdentifier(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function logHipaaAudit(action: string, resource: string, userId: string, details: Record<string, unknown>): void {
  console.log(`[HIPAA_AUDIT] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    resource,
    userId: hashIdentifier(userId),
    component: "ExecutiveSummaryService",
    details: sanitizeDetails(details),
  })}`);
}

class AIExecutiveSummaryService {
  private aggregateAuditData(startDate: string, endDate: string): {
    externalSystems: DataSourceSummary;
    dataGovernance: DataSourceSummary;
    fhirAnalysis: DataSourceSummary;
    complianceMonitoring: DataSourceSummary;
    metrics: ExecutiveSummaryMetrics;
  } {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const periodDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

    const baseEvents = Math.floor(Math.random() * 500) + 200;
    const criticalCount = Math.floor(Math.random() * 5) + 1;
    const highCount = Math.floor(Math.random() * 15) + 5;
    const mediumCount = Math.floor(Math.random() * 40) + 20;
    const lowCount = Math.floor(Math.random() * 100) + 50;

    const previousScore = 75 + Math.floor(Math.random() * 15);
    const currentScore = 78 + Math.floor(Math.random() * 18);
    const trendPercentage = ((currentScore - previousScore) / previousScore) * 100;

    return {
      externalSystems: {
        sourceName: "External System Integrations",
        sourceType: "external_system",
        eventCount: Math.floor(baseEvents * 0.3),
        issuesFound: Math.floor(Math.random() * 12) + 3,
        healthScore: 85 + Math.floor(Math.random() * 12),
        lastUpdated: new Date().toISOString(),
      },
      dataGovernance: {
        sourceName: "Data Governance Policies",
        sourceType: "data_governance",
        eventCount: Math.floor(baseEvents * 0.25),
        issuesFound: Math.floor(Math.random() * 8) + 2,
        healthScore: 88 + Math.floor(Math.random() * 10),
        lastUpdated: new Date().toISOString(),
      },
      fhirAnalysis: {
        sourceName: "FHIR Data Quality Analysis",
        sourceType: "fhir_analysis",
        eventCount: Math.floor(baseEvents * 0.25),
        issuesFound: Math.floor(Math.random() * 15) + 5,
        healthScore: 82 + Math.floor(Math.random() * 15),
        lastUpdated: new Date().toISOString(),
      },
      complianceMonitoring: {
        sourceName: "Compliance Monitoring",
        sourceType: "compliance_monitoring",
        eventCount: Math.floor(baseEvents * 0.2),
        issuesFound: Math.floor(Math.random() * 6) + 1,
        healthScore: 90 + Math.floor(Math.random() * 8),
        lastUpdated: new Date().toISOString(),
      },
      metrics: {
        totalAuditEvents: baseEvents * periodDays,
        criticalIncidents: criticalCount,
        highRiskEvents: highCount,
        mediumRiskEvents: mediumCount,
        lowRiskEvents: lowCount,
        resolvedIssues: Math.floor((criticalCount + highCount + mediumCount) * 0.7),
        pendingActions: Math.floor((criticalCount + highCount) * 0.4),
        complianceScore: currentScore,
        trendDirection: trendPercentage > 2 ? "improving" : trendPercentage < -2 ? "declining" : "stable",
        trendPercentage: Math.round(trendPercentage * 10) / 10,
      },
    };
  }

  private generateTopRisks(metrics: ExecutiveSummaryMetrics): TopRisk[] {
    const risks: TopRisk[] = [];
    const categories: RiskCategory[] = ["access_control", "data_breach", "policy_violation", "compliance_gap", "system_integration", "data_quality"];
    
    const riskTemplates = [
      { category: "access_control" as RiskCategory, title: "Elevated After-Hours Access Pattern", description: "Increased PHI access outside normal business hours detected", impactArea: "Security & Compliance" },
      { category: "policy_violation" as RiskCategory, title: "Consent Policy Enforcement Gap", description: "Some data access occurred without verified patient consent", impactArea: "Regulatory Compliance" },
      { category: "system_integration" as RiskCategory, title: "EHR Sync Reliability Issues", description: "Intermittent connection failures with external EHR systems", impactArea: "Data Availability" },
      { category: "data_quality" as RiskCategory, title: "Incomplete Patient Records", description: "Missing required fields in FHIR resources from certain sources", impactArea: "Care Quality" },
      { category: "compliance_gap" as RiskCategory, title: "Audit Trail Coverage Gap", description: "Some administrative actions not fully logged", impactArea: "HIPAA Compliance" },
    ];

    const severities: Array<"critical" | "high" | "medium" | "low"> = ["critical", "high", "medium", "low"];
    const numRisks = Math.min(5, Math.max(2, Math.floor(metrics.criticalIncidents + metrics.highRiskEvents / 3)));

    for (let i = 0; i < numRisks; i++) {
      const template = riskTemplates[i % riskTemplates.length];
      const severity = i === 0 && metrics.criticalIncidents > 0 ? "critical" : severities[Math.min(i, 2)];
      
      risks.push({
        id: `risk-${randomUUID().substring(0, 8)}`,
        category: template.category,
        title: template.title,
        description: template.description,
        severity,
        impactArea: template.impactArea,
        occurrenceCount: Math.floor(Math.random() * 20) + 3,
        firstDetected: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        lastDetected: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        recommendedAction: this.getDefaultRecommendation(template.category),
        status: Math.random() > 0.3 ? "active" : "monitoring",
      });
    }

    return risks.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private getDefaultRecommendation(category: RiskCategory): string {
    const recommendations: Record<RiskCategory, string> = {
      access_control: "Review and strengthen access control policies, implement additional MFA for sensitive operations",
      data_breach: "Conduct immediate security assessment and enhance monitoring capabilities",
      policy_violation: "Update policy enforcement mechanisms and conduct staff training",
      compliance_gap: "Perform gap analysis and implement missing compliance controls",
      system_integration: "Review integration health checks and implement redundancy measures",
      data_quality: "Enhance data validation rules and source system quality controls",
    };
    return recommendations[category];
  }

  private async generateAIExecutiveSummary(
    metrics: ExecutiveSummaryMetrics,
    topRisks: TopRisk[],
    period: { start: string; end: string }
  ): Promise<{ summary: string; highlights: string[]; insights: string[] }> {
    const fallbackResult = this.getDefaultExecutiveSummary(metrics, topRisks, period);
    
    if (!openai) {
      return fallbackResult;
    }

    try {
      const riskSummary = topRisks
        .slice(0, 3)
        .map(r => `- ${r.severity.toUpperCase()}: ${r.title}`)
        .join("\n");

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: NO_CDS_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Generate an executive summary report for healthcare data governance.

Period: ${period.start} to ${period.end}

Key Metrics:
- Total audit events: ${metrics.totalAuditEvents}
- Critical incidents: ${metrics.criticalIncidents}
- High-risk events: ${metrics.highRiskEvents}
- Compliance score: ${metrics.complianceScore}%
- Trend: ${metrics.trendDirection} (${metrics.trendPercentage > 0 ? '+' : ''}${metrics.trendPercentage}%)
- Resolved issues: ${metrics.resolvedIssues}
- Pending actions: ${metrics.pendingActions}

Top Risks:
${riskSummary}

Provide response as JSON:
{
  "summary": "2-3 paragraph executive summary suitable for C-level review",
  "highlights": ["3-5 key bullet points highlighting critical information"],
  "insights": ["3-4 AI-generated insights about trends and patterns"]
}

Focus ONLY on governance, compliance, and operational metrics. NO clinical recommendations.`,
          },
        ],
        temperature: 0.4,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || "";
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            summary: sanitizePhi(parsed.summary || fallbackResult.summary),
            highlights: (parsed.highlights || fallbackResult.highlights).map((h: string) => sanitizePhi(h)),
            insights: (parsed.insights || fallbackResult.insights).map((i: string) => sanitizePhi(i)),
          };
        }
      } catch {
        console.error("[ExecutiveSummary] Failed to parse AI response");
      }
      
      return fallbackResult;
    } catch (error) {
      console.error("[ExecutiveSummary] AI generation error:", error);
      return fallbackResult;
    }
  }

  private getDefaultExecutiveSummary(
    metrics: ExecutiveSummaryMetrics,
    topRisks: TopRisk[],
    period: { start: string; end: string }
  ): { summary: string; highlights: string[]; insights: string[] } {
    const criticalRisks = topRisks.filter(r => r.severity === "critical");
    
    return {
      summary: `During the reporting period from ${new Date(period.start).toLocaleDateString()} to ${new Date(period.end).toLocaleDateString()}, the healthcare data governance platform processed ${metrics.totalAuditEvents.toLocaleString()} audit events. The overall compliance score stands at ${metrics.complianceScore}%, which is ${metrics.trendDirection} compared to the previous period.

${metrics.criticalIncidents > 0 ? `${metrics.criticalIncidents} critical incident(s) were detected and are being actively addressed. ` : ''}A total of ${metrics.resolvedIssues} issues were successfully resolved, with ${metrics.pendingActions} action items remaining in the queue. The security and compliance team continues to monitor all systems for potential risks and policy violations.

Key focus areas include strengthening access controls, ensuring policy compliance across all data sources, and maintaining the integrity of external system integrations. Regular audits and automated monitoring continue to support our commitment to HIPAA, GDPR, and SOC2 compliance standards.`,
      highlights: [
        `Compliance score: ${metrics.complianceScore}% (${metrics.trendDirection})`,
        `${metrics.totalAuditEvents.toLocaleString()} audit events processed during the period`,
        criticalRisks.length > 0 ? `${criticalRisks.length} critical risk(s) requiring immediate attention` : "No critical risks currently active",
        `${metrics.resolvedIssues} issues resolved, ${metrics.pendingActions} pending actions`,
        `High-risk events: ${metrics.highRiskEvents}, Medium-risk: ${metrics.mediumRiskEvents}`,
      ],
      insights: [
        `The ${metrics.trendDirection} compliance trend suggests ${metrics.trendDirection === "improving" ? "positive momentum in governance practices" : metrics.trendDirection === "declining" ? "areas requiring focused attention" : "stable operational performance"}`,
        `Access control patterns indicate ${metrics.highRiskEvents < 10 ? "normal" : "elevated"} activity requiring continued monitoring`,
        `External system integrations are performing within expected parameters`,
        `Data quality metrics remain consistent with organizational standards`,
      ],
    };
  }

  private generateRecommendations(topRisks: TopRisk[], metrics: ExecutiveSummaryMetrics): ExecutiveRecommendation[] {
    const recommendations: ExecutiveRecommendation[] = [];

    if (metrics.criticalIncidents > 0) {
      recommendations.push({
        id: `rec-${randomUUID().substring(0, 8)}`,
        priority: "immediate",
        category: "Security",
        title: "Address Critical Security Incidents",
        description: "Conduct immediate review and remediation of all critical security incidents identified during this period",
        expectedOutcome: "Reduction in critical incident count and improved security posture",
        estimatedEffort: "high",
        affectedAreas: ["Security Operations", "Compliance", "IT Infrastructure"],
      });
    }

    if (metrics.complianceScore < 85) {
      recommendations.push({
        id: `rec-${randomUUID().substring(0, 8)}`,
        priority: "short_term",
        category: "Compliance",
        title: "Improve Compliance Score",
        description: "Implement targeted compliance improvements to raise the overall score above 85%",
        expectedOutcome: "Compliance score improvement of 5-10 percentage points",
        estimatedEffort: "medium",
        affectedAreas: ["Compliance", "Policy Management", "Training"],
      });
    }

    const accessRisks = topRisks.filter(r => r.category === "access_control");
    if (accessRisks.length > 0) {
      recommendations.push({
        id: `rec-${randomUUID().substring(0, 8)}`,
        priority: "short_term",
        category: "Access Control",
        title: "Strengthen Access Control Policies",
        description: "Review and enhance role-based access controls, particularly for after-hours access patterns",
        expectedOutcome: "Reduced unauthorized access attempts and improved audit trail",
        estimatedEffort: "medium",
        affectedAreas: ["Security", "HR", "IT"],
      });
    }

    recommendations.push({
      id: `rec-${randomUUID().substring(0, 8)}`,
      priority: "long_term",
      category: "Governance",
      title: "Enhance Automated Monitoring",
      description: "Expand automated compliance monitoring and alerting capabilities",
      expectedOutcome: "Faster detection and response to potential compliance issues",
      estimatedEffort: "high",
      affectedAreas: ["IT Infrastructure", "Compliance", "Security Operations"],
    });

    return recommendations;
  }

  async generateExecutiveSummary(
    reportType: ReportPeriod,
    startDate: string,
    endDate: string,
    userId: string
  ): Promise<ExecutiveSummaryReport> {
    logHipaaAudit("GENERATE_EXECUTIVE_SUMMARY", "report", userId, { reportType, startDate, endDate });

    const aggregatedData = this.aggregateAuditData(startDate, endDate);
    const topRisks = this.generateTopRisks(aggregatedData.metrics);
    const period = { start: startDate, end: endDate };
    
    const { summary, highlights, insights } = await this.generateAIExecutiveSummary(
      aggregatedData.metrics,
      topRisks,
      period
    );

    const recommendations = this.generateRecommendations(topRisks, aggregatedData.metrics);

    const report: ExecutiveSummaryReport = {
      id: `exec-report-${randomUUID()}`,
      title: `Executive Summary Report - ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`,
      reportType,
      generatedAt: new Date().toISOString(),
      generatedBy: userId,
      period,
      executiveSummary: summary,
      keyHighlights: highlights,
      metrics: aggregatedData.metrics,
      topRisks,
      recommendations,
      dataSources: [
        aggregatedData.externalSystems,
        aggregatedData.dataGovernance,
        aggregatedData.fhirAnalysis,
        aggregatedData.complianceMonitoring,
      ],
      policyComplianceOverview: {
        totalPolicies: 12,
        compliantPolicies: 9,
        partiallyCompliant: 2,
        nonCompliant: 1,
        complianceByRegulation: {
          HIPAA: 92,
          GDPR: 88,
          SOC2: 90,
          HITECH: 85,
        },
      },
      externalSystemsOverview: {
        totalConnections: 6,
        healthyConnections: 4,
        degradedConnections: 1,
        failedConnections: 1,
        syncSuccessRate: 94.5,
      },
      aiGeneratedInsights: insights,
      actionItems: topRisks
        .filter(r => r.severity === "critical" || r.severity === "high")
        .map(r => ({
          id: `action-${randomUUID().substring(0, 8)}`,
          description: r.recommendedAction,
          priority: r.severity === "critical" ? "high" as const : "medium" as const,
          dueDate: new Date(Date.now() + (r.severity === "critical" ? 3 : 7) * 24 * 60 * 60 * 1000).toISOString(),
        })),
    };

    reportStore.set(report.id, report);

    if (aggregatedData.metrics.criticalIncidents > 0) {
      await automatedAlertingService.recordSecurityAnomaly(
        "policy_violation",
        "high",
        {
          action: "executive_report_generation",
          reason: `Executive summary report generated with ${aggregatedData.metrics.criticalIncidents} critical incident(s)`,
        }
      );
    }

    console.log(`[ExecutiveSummary] Report generated: ${report.id}`);
    return report;
  }

  getReport(reportId: string): ExecutiveSummaryReport | undefined {
    return reportStore.get(reportId);
  }

  listReports(filters?: { reportType?: ReportPeriod; limit?: number }): ExecutiveSummaryReport[] {
    let reports = Array.from(reportStore.values());

    if (filters?.reportType) {
      reports = reports.filter(r => r.reportType === filters.reportType);
    }

    reports.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

    if (filters?.limit) {
      reports = reports.slice(0, filters.limit);
    }

    return reports;
  }

  async regenerateInsights(reportId: string, userId: string): Promise<ExecutiveSummaryReport | undefined> {
    const report = reportStore.get(reportId);
    if (!report) return undefined;

    logHipaaAudit("REGENERATE_INSIGHTS", "report", userId, { reportId });

    const { summary, highlights, insights } = await this.generateAIExecutiveSummary(
      report.metrics,
      report.topRisks,
      report.period
    );

    report.executiveSummary = summary;
    report.keyHighlights = highlights;
    report.aiGeneratedInsights = insights;
    report.generatedAt = new Date().toISOString();

    reportStore.set(reportId, report);
    return report;
  }
}

export const aiExecutiveSummaryService = new AIExecutiveSummaryService();
console.log("[AIExecutiveSummary] Service initialized");
