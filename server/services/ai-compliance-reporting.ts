import OpenAI from "openai";
import { createHash, randomUUID } from "crypto";
import PDFDocument from "pdfkit";
import { Writable } from "stream";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const NO_CDS_REPORTING_PROMPT = `You are a healthcare compliance reporting specialist focused on data governance and regulatory compliance.

CRITICAL COMPLIANCE REQUIREMENT - NO CLINICAL DECISION SUPPORT:
- You MUST NOT provide any clinical recommendations, diagnoses, or treatment suggestions
- You MUST NOT interpret clinical data or health outcomes
- You MUST NOT assess patient health or risk status
- You MUST NOT provide medical advice of any kind

YOUR ROLE IS STRICTLY LIMITED TO:
- Analyzing compliance metrics and audit data
- Summarizing risk assessment findings from a governance perspective
- Identifying trends in policy violations and remediation effectiveness
- Generating executive-level compliance narratives
- Recommending process and policy improvements

All analysis must focus on DATA GOVERNANCE, REGULATORY COMPLIANCE, and OPERATIONAL RISKS - never clinical interpretation.`;

export type ReportType = "compliance" | "risk_assessment" | "remediation" | "trend_analysis" | "comprehensive";
export type ExportFormat = "json" | "pdf" | "csv";
export type RegulatoryFramework = "HIPAA" | "GDPR" | "SOC2" | "HITECH" | "CCPA" | "NIST" | "PCI_DSS" | "FDA";
export type RiskLevel = "critical" | "high" | "medium" | "low";
export type TrendDirection = "improving" | "stable" | "declining";

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface ComplianceFinding {
  id: string;
  category: string;
  severity: RiskLevel;
  title: string;
  description: string;
  affectedSystems: string[];
  regulatoryReferences: RegulatoryFramework[];
  detectedAt: string;
  status: "open" | "in_progress" | "resolved" | "accepted_risk";
  remediationDeadline?: string;
  assignee?: string;
  evidenceLinks: string[];
}

export interface RiskScoreBreakdown {
  category: string;
  score: number;
  maxScore: number;
  weight: number;
  findings: number;
  trend: TrendDirection;
  details: string;
}

export interface RemediationStatus {
  totalItems: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
  completionRate: number;
  avgResolutionDays: number;
  byPriority: {
    critical: { total: number; completed: number };
    high: { total: number; completed: number };
    medium: { total: number; completed: number };
    low: { total: number; completed: number };
  };
  byCategory: Record<string, { total: number; completed: number; avgDays: number }>;
}

export interface HistoricalTrend {
  period: string;
  overallRiskScore: number;
  complianceScore: number;
  findingsCount: number;
  remediationRate: number;
  incidentCount: number;
}

export interface RegulatoryComplianceStatus {
  framework: RegulatoryFramework;
  complianceScore: number;
  totalControls: number;
  compliantControls: number;
  partialControls: number;
  nonCompliantControls: number;
  keyGaps: string[];
  lastAuditDate?: string;
  nextAuditDue?: string;
}

export interface ComplianceReport {
  id: string;
  title: string;
  reportType: ReportType;
  generatedAt: string;
  generatedBy: string;
  dateRange: DateRange;
  executiveSummary: {
    overview: string;
    keyFindings: string[];
    criticalActions: string[];
    overallRiskLevel: RiskLevel;
    overallComplianceScore: number;
    trendSummary: string;
  };
  riskAssessment: {
    overallRiskScore: number;
    previousRiskScore: number;
    trend: TrendDirection;
    breakdown: RiskScoreBreakdown[];
    topRisks: Array<{
      id: string;
      title: string;
      severity: RiskLevel;
      likelihood: "high" | "medium" | "low";
      impact: "high" | "medium" | "low";
      mitigationStatus: string;
    }>;
  };
  findings: ComplianceFinding[];
  remediationStatus: RemediationStatus;
  regulatoryCompliance: RegulatoryComplianceStatus[];
  historicalTrends: HistoricalTrend[];
  recommendations: Array<{
    id: string;
    priority: "immediate" | "short_term" | "long_term";
    category: string;
    title: string;
    description: string;
    expectedBenefit: string;
    effort: "low" | "medium" | "high";
    deadline?: string;
  }>;
  aiInsights: string[];
  metadata: {
    dataSourceCount: number;
    eventsAnalyzed: number;
    policiesEvaluated: number;
    generationTimeMs: number;
  };
}

function hashIdentifier(id: string): string {
  return createHash("sha256").update(id).digest("hex").substring(0, 16);
}

function sanitizePhi(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, "[EMAIL_REDACTED]")
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE_REDACTED]")
    .replace(/\b[A-Z]{2}\d{6,10}\b/g, "[MRN_REDACTED]")
    .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, "[CC_REDACTED]")
    .replace(/\b(19|20)\d{2}[-/](0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])\b/g, "[DOB_REDACTED]")
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      (match) => `[ID:${hashIdentifier(match)}]`
    );
}

function logHipaaAudit(action: string, resource: string, userId: string, details: Record<string, unknown>): void {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizePhi(value);
    } else {
      sanitized[key] = value;
    }
  }
  console.log(`[HIPAA_AUDIT] ${JSON.stringify({
    timestamp: new Date().toISOString(),
    action,
    resource,
    userId: hashIdentifier(userId),
    component: "ComplianceReportingService",
    details: sanitized
  })}`);
}

const reportStore = new Map<string, ComplianceReport>();

class AIComplianceReportingService {
  private generateMockFindings(dateRange: DateRange): ComplianceFinding[] {
    const categories = [
      "access_control", "data_encryption", "audit_logging", "policy_violation",
      "data_retention", "consent_management", "identity_verification", "network_security"
    ];
    const severities: RiskLevel[] = ["critical", "high", "medium", "low"];
    const frameworks: RegulatoryFramework[] = ["HIPAA", "GDPR", "SOC2", "HITECH"];
    
    const findingsCount = Math.floor(Math.random() * 20) + 10;
    const findings: ComplianceFinding[] = [];
    
    for (let i = 0; i < findingsCount; i++) {
      const severity = severities[Math.floor(Math.random() * severities.length)];
      const category = categories[Math.floor(Math.random() * categories.length)];
      
      findings.push({
        id: `finding-${randomUUID().slice(0, 8)}`,
        category,
        severity,
        title: this.generateFindingTitle(category, severity),
        description: this.generateFindingDescription(category),
        affectedSystems: this.generateAffectedSystems(),
        regulatoryReferences: [frameworks[Math.floor(Math.random() * frameworks.length)]],
        detectedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: ["open", "in_progress", "resolved", "accepted_risk"][Math.floor(Math.random() * 4)] as any,
        remediationDeadline: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        assignee: `analyst-${Math.floor(Math.random() * 5) + 1}`,
        evidenceLinks: [`/audit/evidence/${randomUUID().slice(0, 8)}`]
      });
    }
    
    return findings.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private generateFindingTitle(category: string, severity: RiskLevel): string {
    const titles: Record<string, Record<RiskLevel, string>> = {
      access_control: {
        critical: "Privileged access without MFA enforcement",
        high: "Excessive permissions for service accounts",
        medium: "Inactive user accounts with active access",
        low: "Access review documentation gaps"
      },
      data_encryption: {
        critical: "PHI transmitted without TLS encryption",
        high: "Encryption keys approaching rotation deadline",
        medium: "Non-compliant encryption algorithm in use",
        low: "Encryption status monitoring gaps"
      },
      audit_logging: {
        critical: "Critical system actions not being logged",
        high: "Audit log retention below regulatory minimum",
        medium: "Incomplete audit trail for PHI access",
        low: "Log aggregation latency exceeds threshold"
      },
      policy_violation: {
        critical: "Repeated HIPAA Minimum Necessary violations",
        high: "Data sharing without proper BAA documentation",
        medium: "Policy acknowledgment not current",
        low: "Minor policy documentation inconsistencies"
      },
      data_retention: {
        critical: "PHI retained beyond legal maximum period",
        high: "Deletion verification process failures",
        medium: "Retention schedule documentation outdated",
        low: "Archive access procedures need update"
      },
      consent_management: {
        critical: "Processing without valid consent records",
        high: "Consent withdrawal not properly propagated",
        medium: "Consent version tracking inconsistencies",
        low: "Consent UI accessibility improvements needed"
      },
      identity_verification: {
        critical: "Identity verification bypass detected",
        high: "Weak authentication for administrative access",
        medium: "Identity proofing documentation incomplete",
        low: "Identity verification timeout settings"
      },
      network_security: {
        critical: "Unpatched critical vulnerability in production",
        high: "Network segmentation gaps for PHI systems",
        medium: "Firewall rules need review",
        low: "Network monitoring coverage gaps"
      }
    };
    
    return titles[category]?.[severity] || `${severity.toUpperCase()}: ${category} finding`;
  }

  private generateFindingDescription(category: string): string {
    const descriptions: Record<string, string> = {
      access_control: "Analysis of access patterns revealed potential control weaknesses requiring attention to maintain compliance with access management requirements.",
      data_encryption: "Encryption configuration review identified areas where data protection controls could be strengthened to meet regulatory standards.",
      audit_logging: "Audit log analysis identified gaps in event capture or retention that may impact compliance verification capabilities.",
      policy_violation: "Policy compliance monitoring detected deviations from established data governance policies requiring corrective action.",
      data_retention: "Data lifecycle review identified retention practices that may not align with regulatory requirements or organizational policies.",
      consent_management: "Consent record analysis revealed inconsistencies in consent tracking or enforcement mechanisms.",
      identity_verification: "Identity and authentication review identified opportunities to strengthen verification controls.",
      network_security: "Network security assessment identified configuration or monitoring improvements needed for PHI protection."
    };
    
    return descriptions[category] || "Compliance finding requiring review and potential remediation.";
  }

  private generateAffectedSystems(): string[] {
    const systems = ["EHR Integration", "FHIR Gateway", "Patient Portal", "Analytics Platform", "Audit System", "Identity Service", "Data Warehouse"];
    const count = Math.floor(Math.random() * 3) + 1;
    const selected: string[] = [];
    for (let i = 0; i < count; i++) {
      const system = systems[Math.floor(Math.random() * systems.length)];
      if (!selected.includes(system)) selected.push(system);
    }
    return selected;
  }

  private generateRiskBreakdown(): RiskScoreBreakdown[] {
    const categories = [
      { name: "Access Control", weight: 0.20 },
      { name: "Data Protection", weight: 0.20 },
      { name: "Audit & Monitoring", weight: 0.15 },
      { name: "Policy Compliance", weight: 0.15 },
      { name: "Incident Response", weight: 0.10 },
      { name: "Vendor Management", weight: 0.10 },
      { name: "Business Continuity", weight: 0.10 }
    ];
    
    const trends: TrendDirection[] = ["improving", "stable", "declining"];
    
    return categories.map(cat => {
      const score = Math.floor(Math.random() * 30) + 70;
      return {
        category: cat.name,
        score,
        maxScore: 100,
        weight: cat.weight,
        findings: Math.floor(Math.random() * 10),
        trend: trends[Math.floor(Math.random() * trends.length)],
        details: `${cat.name} controls are ${score >= 85 ? "strong" : score >= 70 ? "adequate" : "need improvement"}`
      };
    });
  }

  private generateRemediationStatus(): RemediationStatus {
    const total = Math.floor(Math.random() * 50) + 20;
    const completed = Math.floor(total * (0.4 + Math.random() * 0.3));
    const inProgress = Math.floor((total - completed) * 0.5);
    const pending = total - completed - inProgress;
    const overdue = Math.floor(Math.random() * 5);
    
    return {
      totalItems: total,
      completed,
      inProgress,
      pending,
      overdue,
      completionRate: Math.round((completed / total) * 100),
      avgResolutionDays: Math.floor(Math.random() * 10) + 3,
      byPriority: {
        critical: { total: Math.floor(total * 0.1), completed: Math.floor(completed * 0.15) },
        high: { total: Math.floor(total * 0.25), completed: Math.floor(completed * 0.25) },
        medium: { total: Math.floor(total * 0.4), completed: Math.floor(completed * 0.35) },
        low: { total: Math.floor(total * 0.25), completed: Math.floor(completed * 0.25) }
      },
      byCategory: {
        "Access Control": { total: 8, completed: 5, avgDays: 4 },
        "Data Protection": { total: 10, completed: 6, avgDays: 6 },
        "Policy Updates": { total: 7, completed: 4, avgDays: 3 },
        "Training": { total: 5, completed: 4, avgDays: 2 }
      }
    };
  }

  private generateRegulatoryCompliance(): RegulatoryComplianceStatus[] {
    const frameworks: RegulatoryFramework[] = ["HIPAA", "SOC2", "GDPR", "HITECH"];
    
    return frameworks.map(framework => {
      const totalControls = Math.floor(Math.random() * 50) + 30;
      const complianceScore = Math.floor(Math.random() * 20) + 75;
      const compliantControls = Math.floor(totalControls * (complianceScore / 100));
      const partialControls = Math.floor((totalControls - compliantControls) * 0.6);
      const nonCompliantControls = totalControls - compliantControls - partialControls;
      
      const gapsByFramework: Record<RegulatoryFramework, string[]> = {
        HIPAA: ["Access control documentation", "Encryption key management", "Audit log retention"],
        SOC2: ["Change management process", "Vendor risk assessments", "Incident response testing"],
        GDPR: ["Data subject request processing", "Cross-border transfer documentation", "Privacy impact assessments"],
        HITECH: ["Breach notification procedures", "EHR certification compliance", "Meaningful use attestation"],
        CCPA: ["Consumer data inventory", "Opt-out mechanism verification", "Service provider agreements"],
        NIST: ["Risk assessment updates", "Continuous monitoring", "Supply chain risk management"],
        PCI_DSS: ["Cardholder data environment scope", "Penetration testing", "Security awareness training"],
        FDA: ["Electronic record controls", "Audit trail integrity", "System validation documentation"]
      };
      
      return {
        framework,
        complianceScore,
        totalControls,
        compliantControls,
        partialControls,
        nonCompliantControls,
        keyGaps: gapsByFramework[framework]?.slice(0, 3) || [],
        lastAuditDate: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        nextAuditDue: new Date(Date.now() + Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      };
    });
  }

  private generateHistoricalTrends(dateRange: DateRange): HistoricalTrend[] {
    const trends: HistoricalTrend[] = [];
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const periodDays = daysDiff > 90 ? 30 : daysDiff > 30 ? 7 : 1;
    const periods = Math.ceil(daysDiff / periodDays);
    
    let baseRiskScore = 25 + Math.random() * 10;
    let baseComplianceScore = 75 + Math.random() * 10;
    
    for (let i = 0; i < Math.min(periods, 12); i++) {
      const periodStart = new Date(startDate.getTime() + i * periodDays * 24 * 60 * 60 * 1000);
      
      baseRiskScore = Math.max(10, Math.min(50, baseRiskScore + (Math.random() - 0.5) * 5));
      baseComplianceScore = Math.max(60, Math.min(98, baseComplianceScore + (Math.random() - 0.3) * 3));
      
      trends.push({
        period: periodStart.toISOString().split("T")[0],
        overallRiskScore: Math.round(baseRiskScore),
        complianceScore: Math.round(baseComplianceScore),
        findingsCount: Math.floor(Math.random() * 15) + 5,
        remediationRate: Math.floor(Math.random() * 30) + 60,
        incidentCount: Math.floor(Math.random() * 5)
      });
    }
    
    return trends;
  }

  async generateComplianceReport(
    reportType: ReportType,
    dateRange: DateRange,
    userId: string,
    options?: {
      includeRemediation?: boolean;
      includeHistorical?: boolean;
      frameworks?: RegulatoryFramework[];
    }
  ): Promise<ComplianceReport> {
    const startTime = Date.now();
    
    logHipaaAudit("GENERATE_COMPLIANCE_REPORT", "compliance_report", userId, {
      reportType,
      dateRange,
      options
    });

    const findings = this.generateMockFindings(dateRange);
    const riskBreakdown = this.generateRiskBreakdown();
    const remediationStatus = this.generateRemediationStatus();
    const regulatoryCompliance = this.generateRegulatoryCompliance();
    const historicalTrends = this.generateHistoricalTrends(dateRange);

    const overallRiskScore = Math.round(
      riskBreakdown.reduce((sum, cat) => sum + (100 - cat.score) * cat.weight, 0)
    );
    const previousRiskScore = overallRiskScore + (Math.random() - 0.5) * 10;
    const overallComplianceScore = Math.round(
      regulatoryCompliance.reduce((sum, rc) => sum + rc.complianceScore, 0) / regulatoryCompliance.length
    );

    const criticalFindings = findings.filter(f => f.severity === "critical");
    const highFindings = findings.filter(f => f.severity === "high");

    let overallRiskLevel: RiskLevel = "low";
    if (criticalFindings.length > 0 || overallRiskScore > 40) overallRiskLevel = "critical";
    else if (highFindings.length > 3 || overallRiskScore > 30) overallRiskLevel = "high";
    else if (highFindings.length > 0 || overallRiskScore > 20) overallRiskLevel = "medium";

    const trend: TrendDirection = previousRiskScore > overallRiskScore + 2 ? "improving" : 
                                   previousRiskScore < overallRiskScore - 2 ? "declining" : "stable";

    let aiInsights: string[] = [];
    let executiveOverview = "";

    if (process.env.OPENAI_API_KEY && openai) {
      try {
        const context = sanitizePhi(JSON.stringify({
          reportType,
          dateRange,
          findingsSummary: {
            total: findings.length,
            critical: criticalFindings.length,
            high: highFindings.length,
            openCount: findings.filter(f => f.status === "open").length
          },
          overallRiskScore,
          overallComplianceScore,
          remediationRate: remediationStatus.completionRate,
          riskBreakdown: riskBreakdown.map(r => ({ category: r.category, score: r.score, trend: r.trend })),
          regulatoryStatus: regulatoryCompliance.map(r => ({ framework: r.framework, score: r.complianceScore }))
        }));

        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: NO_CDS_REPORTING_PROMPT },
            {
              role: "user",
              content: `Generate an executive summary and 4-5 key insights for this compliance report data. Format as JSON with "overview" (2-3 sentences) and "insights" (array of strings):\n\n${context}`
            }
          ],
          max_tokens: 600,
          temperature: 0.5
        });

        const content = response.choices[0]?.message?.content || "";
        try {
          const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ""));
          executiveOverview = parsed.overview || "";
          aiInsights = parsed.insights || [];
        } catch {
          executiveOverview = content.slice(0, 300);
          aiInsights = content.split(/\d+\.\s+/).filter(s => s.trim().length > 20).slice(0, 5);
        }
      } catch (error) {
        console.error("[ComplianceReporting] AI generation error:", error);
      }
    }

    if (!executiveOverview) {
      executiveOverview = `This ${reportType} report covers the period from ${dateRange.startDate} to ${dateRange.endDate}. The organization's overall risk score is ${overallRiskScore}% with ${findings.length} findings identified, including ${criticalFindings.length} critical issues requiring immediate attention. Compliance across regulatory frameworks averages ${overallComplianceScore}%.`;
    }

    if (aiInsights.length === 0) {
      aiInsights = [
        `Risk posture is ${trend} with ${Math.abs(Math.round(overallRiskScore - previousRiskScore))}% change from previous period`,
        `${criticalFindings.length} critical findings require immediate executive attention`,
        `Remediation completion rate of ${remediationStatus.completionRate}% indicates ${remediationStatus.completionRate > 70 ? "strong" : "needs improvement in"} issue resolution`,
        `${riskBreakdown.filter(r => r.trend === "declining").length} risk categories showing declining trends`,
        `Average compliance score of ${overallComplianceScore}% across ${regulatoryCompliance.length} regulatory frameworks`
      ];
    }

    const keyFindings = [
      ...criticalFindings.slice(0, 3).map(f => f.title),
      ...highFindings.slice(0, 2).map(f => f.title)
    ];

    const criticalActions = criticalFindings.map(f => `Address: ${f.title}`).slice(0, 5);
    if (remediationStatus.overdue > 0) {
      criticalActions.push(`Resolve ${remediationStatus.overdue} overdue remediation items`);
    }

    const recommendations = [
      {
        id: randomUUID().slice(0, 8),
        priority: "immediate" as const,
        category: "Risk Mitigation",
        title: "Address Critical Findings",
        description: `Remediate ${criticalFindings.length} critical findings to reduce organizational risk exposure`,
        expectedBenefit: "Reduce critical risk by 40-60%",
        effort: "high" as const,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
      },
      {
        id: randomUUID().slice(0, 8),
        priority: "short_term" as const,
        category: "Process Improvement",
        title: "Enhance Remediation Tracking",
        description: "Implement automated tracking for remediation deadlines and escalations",
        expectedBenefit: "Improve remediation rate by 20%",
        effort: "medium" as const
      },
      {
        id: randomUUID().slice(0, 8),
        priority: "long_term" as const,
        category: "Governance",
        title: "Quarterly Compliance Reviews",
        description: "Establish regular compliance review cadence with stakeholder reporting",
        expectedBenefit: "Sustained compliance improvement",
        effort: "low" as const
      }
    ];

    const report: ComplianceReport = {
      id: `report-${randomUUID()}`,
      title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1).replace("_", " ")} Report`,
      reportType,
      generatedAt: new Date().toISOString(),
      generatedBy: userId,
      dateRange,
      executiveSummary: {
        overview: executiveOverview,
        keyFindings,
        criticalActions,
        overallRiskLevel,
        overallComplianceScore,
        trendSummary: `Risk posture is ${trend} compared to previous period`
      },
      riskAssessment: {
        overallRiskScore,
        previousRiskScore: Math.round(previousRiskScore),
        trend,
        breakdown: riskBreakdown,
        topRisks: criticalFindings.concat(highFindings).slice(0, 5).map(f => ({
          id: f.id,
          title: f.title,
          severity: f.severity,
          likelihood: ["high", "medium", "low"][Math.floor(Math.random() * 3)] as any,
          impact: ["high", "medium", "low"][Math.floor(Math.random() * 3)] as any,
          mitigationStatus: f.status
        }))
      },
      findings,
      remediationStatus,
      regulatoryCompliance: options?.frameworks 
        ? regulatoryCompliance.filter(rc => options.frameworks!.includes(rc.framework))
        : regulatoryCompliance,
      historicalTrends: options?.includeHistorical !== false ? historicalTrends : [],
      recommendations,
      aiInsights,
      metadata: {
        dataSourceCount: 6,
        eventsAnalyzed: Math.floor(Math.random() * 5000) + 1000,
        policiesEvaluated: Math.floor(Math.random() * 30) + 15,
        generationTimeMs: Date.now() - startTime
      }
    };

    reportStore.set(report.id, report);
    
    logHipaaAudit("COMPLIANCE_REPORT_GENERATED", "compliance_report", userId, {
      reportId: report.id,
      findingsCount: findings.length,
      overallRiskScore,
      overallComplianceScore
    });

    return report;
  }

  getReport(reportId: string): ComplianceReport | undefined {
    return reportStore.get(reportId);
  }

  listReports(filters?: { 
    reportType?: ReportType; 
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): ComplianceReport[] {
    let reports = Array.from(reportStore.values());
    
    if (filters?.reportType) {
      reports = reports.filter(r => r.reportType === filters.reportType);
    }
    if (filters?.startDate) {
      reports = reports.filter(r => r.generatedAt >= filters.startDate!);
    }
    if (filters?.endDate) {
      reports = reports.filter(r => r.generatedAt <= filters.endDate!);
    }
    
    reports.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    
    return reports.slice(0, filters?.limit || 50);
  }

  async exportToPDF(reportId: string, userId: string): Promise<Buffer> {
    const report = reportStore.get(reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    logHipaaAudit("EXPORT_REPORT_PDF", "compliance_report", userId, { reportId });

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50, size: "LETTER" });

      const stream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        }
      });

      doc.pipe(stream);

      doc.fontSize(20).font("Helvetica-Bold").text(report.title, { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica").text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, { align: "center" });
      doc.text(`Period: ${report.dateRange.startDate} to ${report.dateRange.endDate}`, { align: "center" });
      doc.moveDown(1);

      doc.fontSize(14).font("Helvetica-Bold").text("Executive Summary");
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica").text(report.executiveSummary.overview);
      doc.moveDown(0.5);

      const riskColors: Record<RiskLevel, string> = {
        critical: "#dc2626",
        high: "#ea580c",
        medium: "#ca8a04",
        low: "#16a34a"
      };

      doc.fontSize(11).font("Helvetica-Bold").text("Key Metrics:");
      doc.fontSize(10).font("Helvetica");
      doc.text(`Overall Risk Level: ${report.executiveSummary.overallRiskLevel.toUpperCase()}`);
      doc.text(`Compliance Score: ${report.executiveSummary.overallComplianceScore}%`);
      doc.text(`Risk Score: ${report.riskAssessment.overallRiskScore}% (${report.riskAssessment.trend})`);
      doc.text(`Total Findings: ${report.findings.length}`);
      doc.moveDown(1);

      doc.fontSize(14).font("Helvetica-Bold").text("Key Findings");
      doc.moveDown(0.3);
      report.executiveSummary.keyFindings.forEach((finding, i) => {
        doc.fontSize(10).font("Helvetica").text(`${i + 1}. ${finding}`);
      });
      doc.moveDown(1);

      if (report.executiveSummary.criticalActions.length > 0) {
        doc.fontSize(14).font("Helvetica-Bold").text("Critical Actions Required");
        doc.moveDown(0.3);
        report.executiveSummary.criticalActions.forEach((action, i) => {
          doc.fontSize(10).font("Helvetica").text(`${i + 1}. ${action}`);
        });
        doc.moveDown(1);
      }

      doc.addPage();
      doc.fontSize(14).font("Helvetica-Bold").text("Risk Assessment Breakdown");
      doc.moveDown(0.5);

      report.riskAssessment.breakdown.forEach(category => {
        doc.fontSize(10).font("Helvetica-Bold").text(`${category.category}: ${category.score}%`);
        doc.fontSize(9).font("Helvetica").text(`  Trend: ${category.trend} | Findings: ${category.findings} | Weight: ${(category.weight * 100).toFixed(0)}%`);
        doc.moveDown(0.3);
      });
      doc.moveDown(1);

      doc.fontSize(14).font("Helvetica-Bold").text("Regulatory Compliance Status");
      doc.moveDown(0.5);

      report.regulatoryCompliance.forEach(reg => {
        doc.fontSize(10).font("Helvetica-Bold").text(`${reg.framework}: ${reg.complianceScore}%`);
        doc.fontSize(9).font("Helvetica").text(`  Controls: ${reg.compliantControls}/${reg.totalControls} compliant`);
        if (reg.keyGaps.length > 0) {
          doc.text(`  Key Gaps: ${reg.keyGaps.join(", ")}`);
        }
        doc.moveDown(0.3);
      });
      doc.moveDown(1);

      doc.addPage();
      doc.fontSize(14).font("Helvetica-Bold").text("Remediation Status");
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica");
      doc.text(`Total Items: ${report.remediationStatus.totalItems}`);
      doc.text(`Completed: ${report.remediationStatus.completed} (${report.remediationStatus.completionRate}%)`);
      doc.text(`In Progress: ${report.remediationStatus.inProgress}`);
      doc.text(`Pending: ${report.remediationStatus.pending}`);
      doc.text(`Overdue: ${report.remediationStatus.overdue}`);
      doc.text(`Average Resolution Time: ${report.remediationStatus.avgResolutionDays} days`);
      doc.moveDown(1);

      doc.fontSize(14).font("Helvetica-Bold").text("Recommendations");
      doc.moveDown(0.5);

      report.recommendations.forEach((rec, i) => {
        doc.fontSize(10).font("Helvetica-Bold").text(`${i + 1}. ${rec.title} [${rec.priority.toUpperCase()}]`);
        doc.fontSize(9).font("Helvetica").text(`   ${rec.description}`);
        doc.text(`   Expected Benefit: ${rec.expectedBenefit} | Effort: ${rec.effort}`);
        doc.moveDown(0.3);
      });
      doc.moveDown(1);

      if (report.aiInsights.length > 0) {
        doc.fontSize(14).font("Helvetica-Bold").text("AI-Generated Insights");
        doc.moveDown(0.3);
        report.aiInsights.forEach((insight, i) => {
          doc.fontSize(10).font("Helvetica").text(`${i + 1}. ${insight}`);
        });
      }

      doc.moveDown(2);
      doc.fontSize(8).font("Helvetica").text(
        "This report was generated by Tabula Medica Compliance Reporting System. " +
        "All data has been sanitized to protect PHI. This report does not contain clinical decision support. " +
        `Report ID: ${report.id}`,
        { align: "center" }
      );

      doc.end();

      stream.on("finish", () => {
        resolve(Buffer.concat(chunks));
      });

      stream.on("error", reject);
    });
  }

  exportToCSV(reportId: string, userId: string, section: "findings" | "remediation" | "regulatory" | "risks"): string {
    const report = reportStore.get(reportId);
    if (!report) {
      throw new Error("Report not found");
    }

    logHipaaAudit("EXPORT_REPORT_CSV", "compliance_report", userId, { reportId, section });

    let csv = "";

    switch (section) {
      case "findings":
        csv = "ID,Category,Severity,Title,Status,Detected At,Affected Systems,Regulatory References\n";
        report.findings.forEach(f => {
          csv += `"${f.id}","${f.category}","${f.severity}","${f.title.replace(/"/g, '""')}","${f.status}","${f.detectedAt}","${f.affectedSystems.join("; ")}","${f.regulatoryReferences.join("; ")}"\n`;
        });
        break;

      case "remediation":
        csv = "Category,Total,Completed,Completion Rate,Avg Days\n";
        Object.entries(report.remediationStatus.byCategory).forEach(([cat, data]) => {
          csv += `"${cat}",${data.total},${data.completed},${Math.round((data.completed / data.total) * 100)}%,${data.avgDays}\n`;
        });
        csv += `\nPriority,Total,Completed\n`;
        Object.entries(report.remediationStatus.byPriority).forEach(([priority, data]) => {
          csv += `"${priority}",${data.total},${data.completed}\n`;
        });
        break;

      case "regulatory":
        csv = "Framework,Compliance Score,Total Controls,Compliant,Partial,Non-Compliant,Key Gaps\n";
        report.regulatoryCompliance.forEach(r => {
          csv += `"${r.framework}",${r.complianceScore}%,${r.totalControls},${r.compliantControls},${r.partialControls},${r.nonCompliantControls},"${r.keyGaps.join("; ")}"\n`;
        });
        break;

      case "risks":
        csv = "Category,Score,Max Score,Weight,Findings Count,Trend\n";
        report.riskAssessment.breakdown.forEach(r => {
          csv += `"${r.category}",${r.score},${r.maxScore},${(r.weight * 100).toFixed(0)}%,${r.findings},"${r.trend}"\n`;
        });
        break;
    }

    return csv;
  }

  deleteReport(reportId: string, userId: string): boolean {
    const report = reportStore.get(reportId);
    if (!report) return false;

    logHipaaAudit("DELETE_COMPLIANCE_REPORT", "compliance_report", userId, { reportId });
    return reportStore.delete(reportId);
  }
}

export const aiComplianceReportingService = new AIComplianceReportingService();
