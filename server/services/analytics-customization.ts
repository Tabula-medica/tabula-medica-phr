import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export interface CustomReport {
  id: string;
  userId: string;
  name: string;
  description: string;
  type: "chart" | "table" | "summary" | "comparison";
  metrics: string[];
  filters: Record<string, any>;
  visualization: {
    chartType?: "line" | "bar" | "pie" | "area" | "scatter";
    colors?: string[];
    showLegend?: boolean;
    showGrid?: boolean;
  };
  schedule?: {
    frequency: "daily" | "weekly" | "monthly";
    recipients: string[];
    format: "pdf" | "csv" | "both";
  };
  createdAt: string;
  updatedAt: string;
}

export interface AlertThreshold {
  id: string;
  userId: string;
  name: string;
  metric: string;
  condition: "above" | "below" | "equals" | "between";
  value: number;
  value2?: number;
  severity: "info" | "warning" | "critical";
  enabled: boolean;
  notifications: {
    email: boolean;
    inApp: boolean;
    sms: boolean;
  };
  cooldownMinutes: number;
  lastTriggered?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomKPI {
  id: string;
  userId: string;
  name: string;
  description: string;
  formula: string;
  unit: string;
  category: string;
  targetValue?: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  dataSource: string;
  aggregation: "sum" | "avg" | "min" | "max" | "count";
  timeframe: "hourly" | "daily" | "weekly" | "monthly";
  currentValue?: number;
  trend?: "up" | "down" | "stable";
  history: { date: string; value: number }[];
  createdAt: string;
  updatedAt: string;
}

export interface ExportRequest {
  id: string;
  userId: string;
  format: "csv" | "pdf";
  dataType: "dashboard" | "report" | "kpis" | "alerts";
  filters?: Record<string, any>;
  dateRange?: { start: string; end: string };
  status: "pending" | "processing" | "completed" | "failed";
  downloadUrl?: string;
  createdAt: string;
  completedAt?: string;
}

const customReports: Map<string, CustomReport> = new Map();
const alertThresholds: Map<string, AlertThreshold> = new Map();
const customKPIs: Map<string, CustomKPI> = new Map();
const exportRequests: Map<string, ExportRequest> = new Map();

function initializeSampleData() {
  const sampleReport: CustomReport = {
    id: generateId("report"),
    userId: "user-001",
    name: "Weekly Automation Performance",
    description: "Track automation success rates and processing times",
    type: "chart",
    metrics: ["automation_success_rate", "avg_processing_time", "job_count"],
    filters: { timeframe: "7d" },
    visualization: {
      chartType: "line",
      colors: ["#3b82f6", "#10b981", "#f59e0b"],
      showLegend: true,
      showGrid: true
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  customReports.set(sampleReport.id, sampleReport);

  const sampleThreshold: AlertThreshold = {
    id: generateId("threshold"),
    userId: "user-001",
    name: "High Risk Patient Alert",
    metric: "critical_risk_patients",
    condition: "above",
    value: 10,
    severity: "critical",
    enabled: true,
    notifications: { email: true, inApp: true, sms: false },
    cooldownMinutes: 60,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  alertThresholds.set(sampleThreshold.id, sampleThreshold);

  const sampleKPI: CustomKPI = {
    id: generateId("kpi"),
    userId: "user-001",
    name: "Data Quality Index",
    description: "Combined score of data completeness, accuracy, and timeliness",
    formula: "(completeness * 0.4) + (accuracy * 0.4) + (timeliness * 0.2)",
    unit: "%",
    category: "Data Quality",
    targetValue: 95,
    warningThreshold: 85,
    criticalThreshold: 70,
    dataSource: "data_quality_metrics",
    aggregation: "avg",
    timeframe: "daily",
    currentValue: 92.5,
    trend: "up",
    history: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      value: 85 + Math.random() * 10
    })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  customKPIs.set(sampleKPI.id, sampleKPI);
}

initializeSampleData();

class AnalyticsCustomizationService {
  // Custom Reports
  async getReports(userId: string): Promise<CustomReport[]> {
    return Array.from(customReports.values()).filter(r => r.userId === userId || r.userId === "user-001");
  }

  async createReport(userId: string, data: Omit<CustomReport, "id" | "userId" | "createdAt" | "updatedAt">): Promise<CustomReport> {
    const report: CustomReport = {
      ...data,
      id: generateId("report"),
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    customReports.set(report.id, report);
    return report;
  }

  async updateReport(id: string, data: Partial<CustomReport>): Promise<CustomReport | null> {
    const report = customReports.get(id);
    if (!report) return null;
    const updated = { ...report, ...data, updatedAt: new Date().toISOString() };
    customReports.set(id, updated);
    return updated;
  }

  async deleteReport(id: string): Promise<boolean> {
    return customReports.delete(id);
  }

  // Alert Thresholds
  async getThresholds(userId: string): Promise<AlertThreshold[]> {
    return Array.from(alertThresholds.values()).filter(t => t.userId === userId || t.userId === "user-001");
  }

  async createThreshold(userId: string, data: Omit<AlertThreshold, "id" | "userId" | "createdAt" | "updatedAt">): Promise<AlertThreshold> {
    const threshold: AlertThreshold = {
      ...data,
      id: generateId("threshold"),
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    alertThresholds.set(threshold.id, threshold);
    return threshold;
  }

  async updateThreshold(id: string, data: Partial<AlertThreshold>): Promise<AlertThreshold | null> {
    const threshold = alertThresholds.get(id);
    if (!threshold) return null;
    const updated = { ...threshold, ...data, updatedAt: new Date().toISOString() };
    alertThresholds.set(id, updated);
    return updated;
  }

  async deleteThreshold(id: string): Promise<boolean> {
    return alertThresholds.delete(id);
  }

  // Custom KPIs
  async getKPIs(userId: string): Promise<CustomKPI[]> {
    return Array.from(customKPIs.values()).filter(k => k.userId === userId || k.userId === "user-001");
  }

  async createKPI(userId: string, data: Omit<CustomKPI, "id" | "userId" | "createdAt" | "updatedAt" | "history" | "currentValue" | "trend">): Promise<CustomKPI> {
    const kpi: CustomKPI = {
      ...data,
      id: generateId("kpi"),
      userId,
      currentValue: Math.random() * 100,
      trend: ["up", "down", "stable"][Math.floor(Math.random() * 3)] as "up" | "down" | "stable",
      history: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        value: 50 + Math.random() * 50
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    customKPIs.set(kpi.id, kpi);
    return kpi;
  }

  async updateKPI(id: string, data: Partial<CustomKPI>): Promise<CustomKPI | null> {
    const kpi = customKPIs.get(id);
    if (!kpi) return null;
    const updated = { ...kpi, ...data, updatedAt: new Date().toISOString() };
    customKPIs.set(id, updated);
    return updated;
  }

  async deleteKPI(id: string): Promise<boolean> {
    return customKPIs.delete(id);
  }

  // Export
  async requestExport(userId: string, format: "csv" | "pdf", dataType: string, filters?: Record<string, any>): Promise<ExportRequest> {
    const request: ExportRequest = {
      id: generateId("export"),
      userId,
      format,
      dataType: dataType as ExportRequest["dataType"],
      filters,
      status: "pending",
      createdAt: new Date().toISOString()
    };
    exportRequests.set(request.id, request);

    // Simulate async export processing
    setTimeout(() => {
      const updated = exportRequests.get(request.id);
      if (updated) {
        updated.status = "completed";
        updated.completedAt = new Date().toISOString();
        updated.downloadUrl = `/api/kpi-analytics/exports/${request.id}/download`;
        exportRequests.set(request.id, updated);
      }
    }, 2000);

    return request;
  }

  async getExportStatus(id: string): Promise<ExportRequest | null> {
    return exportRequests.get(id) || null;
  }

  async getExports(userId: string): Promise<ExportRequest[]> {
    return Array.from(exportRequests.values())
      .filter(e => e.userId === userId || e.userId === "user-001")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  generateCSV(data: any[], columns: string[]): string {
    const header = columns.join(",");
    const rows = data.map(row => 
      columns.map(col => {
        const val = row[col];
        if (typeof val === "string" && val.includes(",")) {
          return `"${val}"`;
        }
        return val ?? "";
      }).join(",")
    );
    return [header, ...rows].join("\n");
  }

  generatePDFContent(title: string, data: any): string {
    return `
Healthcare KPI Analytics Report
================================
Generated: ${new Date().toISOString()}
Report: ${title}

NO-CDS COMPLIANCE NOTICE:
This report contains operational analytics only.
NOT intended for clinical decision support.

Data Summary:
${JSON.stringify(data, null, 2)}
    `.trim();
  }

  // Available metrics for custom reports
  getAvailableMetrics(): { id: string; name: string; category: string; description: string }[] {
    return [
      { id: "automation_success_rate", name: "Automation Success Rate", category: "Automation", description: "Percentage of successful automation jobs" },
      { id: "avg_processing_time", name: "Avg Processing Time", category: "Automation", description: "Average job processing time in milliseconds" },
      { id: "job_count", name: "Job Count", category: "Automation", description: "Total number of automation jobs" },
      { id: "failed_jobs", name: "Failed Jobs", category: "Automation", description: "Number of failed automation jobs" },
      { id: "critical_risk_patients", name: "Critical Risk Patients", category: "Risk", description: "Number of patients with critical risk scores" },
      { id: "high_risk_patients", name: "High Risk Patients", category: "Risk", description: "Number of patients with high risk scores" },
      { id: "avg_risk_score", name: "Average Risk Score", category: "Risk", description: "Average patient risk score" },
      { id: "data_quality_score", name: "Data Quality Score", category: "Quality", description: "Overall data quality score" },
      { id: "resolution_rate", name: "Issue Resolution Rate", category: "Quality", description: "Percentage of resolved data quality issues" },
      { id: "pending_issues", name: "Pending Issues", category: "Quality", description: "Number of unresolved data quality issues" },
      { id: "compliance_score", name: "Compliance Score", category: "Security", description: "Overall compliance score" },
      { id: "hipaa_score", name: "HIPAA Score", category: "Security", description: "HIPAA compliance score" },
      { id: "soc2_score", name: "SOC2 Score", category: "Security", description: "SOC2 compliance score" },
      { id: "open_vulnerabilities", name: "Open Vulnerabilities", category: "Security", description: "Number of open security vulnerabilities" },
      { id: "daily_active_users", name: "Daily Active Users", category: "Engagement", description: "Number of daily active users" },
      { id: "session_duration", name: "Avg Session Duration", category: "Engagement", description: "Average session duration in minutes" },
      { id: "feature_usage", name: "Feature Usage", category: "Engagement", description: "Feature usage count" }
    ];
  }
}

export const analyticsCustomizationService = new AnalyticsCustomizationService();
