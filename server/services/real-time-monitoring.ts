import crypto from "crypto";
import { WebSocket, WebSocketServer } from "ws";

export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
export type AlertCategory = "patient_risk" | "automation_failure" | "security_vulnerability" | "system_health" | "performance" | "compliance";
export type AlertStatus = "active" | "acknowledged" | "resolved" | "escalated" | "snoozed";
export type JobStatus = "running" | "completed" | "failed" | "delayed" | "cancelled" | "pending";
export type HealthStatus = "healthy" | "degraded" | "critical" | "unknown";

export interface RealTimeAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  source: string;
  patientId?: string;
  resourceId?: string;
  timestamp: Date;
  status: AlertStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  escalationLevel: number;
  metadata: Record<string, unknown>;
  actions: AlertAction[];
  noCdsCompliance: string;
}

export interface AlertAction {
  id: string;
  label: string;
  type: "acknowledge" | "resolve" | "escalate" | "snooze" | "investigate" | "notify_team";
  automated: boolean;
}

export interface AutomationJob {
  id: string;
  name: string;
  type: "risk_assessment" | "data_sync" | "validation" | "remediation" | "security_scan" | "compliance_check" | "backup" | "report_generation";
  status: JobStatus;
  progress: number;
  startedAt: Date;
  estimatedCompletion?: Date;
  completedAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  priority: AlertSeverity;
  triggeredBy: string;
  affectedResources: string[];
  metrics: JobMetrics;
}

export interface JobMetrics {
  recordsProcessed: number;
  recordsTotal: number;
  errorsCount: number;
  warningsCount: number;
  duration?: number;
}

export interface SecurityVulnerability {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  category: "access_control" | "encryption" | "authentication" | "data_exposure" | "configuration" | "network" | "compliance";
  cvssScore?: number;
  affectedComponents: string[];
  discoveredAt: Date;
  status: "open" | "in_progress" | "mitigated" | "resolved" | "accepted_risk";
  remediationProgress: number;
  remediationSteps: RemediationStep[];
  assignedTo?: string;
  dueDate?: Date;
  complianceImpact: string[];
}

export interface RemediationStep {
  id: string;
  step: number;
  description: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
  completedAt?: Date;
  notes?: string;
}

export interface SystemHealth {
  overall: HealthStatus;
  components: ComponentHealth[];
  uptime: number;
  lastUpdated: Date;
}

export interface ComponentHealth {
  id: string;
  name: string;
  type: "api" | "database" | "cache" | "queue" | "external_service" | "fhir_endpoint" | "ai_service" | "storage";
  status: HealthStatus;
  responseTime: number;
  errorRate: number;
  throughput: number;
  lastCheck: Date;
  issues: string[];
}

export interface PerformanceMetrics {
  timestamp: Date;
  apiLatency: LatencyMetrics;
  databaseLatency: LatencyMetrics;
  throughput: ThroughputMetrics;
  resources: ResourceMetrics;
  fhirOperations: FHIRMetrics;
}

export interface LatencyMetrics {
  p50: number;
  p90: number;
  p99: number;
  avg: number;
  max: number;
}

export interface ThroughputMetrics {
  requestsPerSecond: number;
  eventsProcessedPerMinute: number;
  alertsGeneratedPerHour: number;
}

export interface ResourceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  activeConnections: number;
}

export interface FHIRMetrics {
  readOperations: number;
  writeOperations: number;
  searchOperations: number;
  validationErrors: number;
  syncOperations: number;
}

export interface MonitoringDashboard {
  alerts: {
    active: RealTimeAlert[];
    recentlyResolved: RealTimeAlert[];
    stats: AlertStats;
  };
  jobs: {
    running: AutomationJob[];
    recent: AutomationJob[];
    stats: JobStats;
  };
  security: {
    vulnerabilities: SecurityVulnerability[];
    stats: SecurityStats;
  };
  health: SystemHealth;
  performance: PerformanceMetrics;
  lastUpdated: Date;
}

export interface AlertStats {
  totalActive: number;
  bySeverity: Record<AlertSeverity, number>;
  byCategory: Record<AlertCategory, number>;
  avgResolutionTime: number;
  escalationRate: number;
}

export interface JobStats {
  totalRunning: number;
  totalCompleted24h: number;
  totalFailed24h: number;
  successRate: number;
  avgDuration: number;
}

export interface SecurityStats {
  totalOpen: number;
  critical: number;
  high: number;
  avgRemediationTime: number;
  complianceScore: number;
}

const alerts = new Map<string, RealTimeAlert>();
const jobs = new Map<string, AutomationJob>();
const vulnerabilities = new Map<string, SecurityVulnerability>();
const connectedClients = new Set<WebSocket>();
const metricsHistory: PerformanceMetrics[] = [];

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function initializeSampleData() {
  const now = new Date();

  const alert1: RealTimeAlert = {
    id: generateId("alert"),
    category: "patient_risk",
    severity: "critical",
    title: "High-Risk Patient Alert",
    message: "Patient P-001 has multiple medication data conflicts requiring immediate care coordination review",
    source: "AI Risk Assessment Engine",
    patientId: "patient-001",
    timestamp: new Date(now.getTime() - 300000),
    status: "active",
    escalationLevel: 1,
    metadata: { riskScore: 85, triggerType: "medication_conflict" },
    actions: [
      { id: "a1", label: "Acknowledge", type: "acknowledge", automated: false },
      { id: "a2", label: "Notify Care Team", type: "notify_team", automated: true },
      { id: "a3", label: "Escalate", type: "escalate", automated: false }
    ],
    noCdsCompliance: "Risk alert for care coordination. NOT clinical advice."
  };

  const alert2: RealTimeAlert = {
    id: generateId("alert"),
    category: "automation_failure",
    severity: "high",
    title: "Data Sync Job Failed",
    message: "FHIR sync with Fasten Health failed after 3 retries. Last error: Connection timeout",
    source: "FHIR Sync Service",
    timestamp: new Date(now.getTime() - 600000),
    status: "active",
    escalationLevel: 0,
    metadata: { jobId: "sync-epic-001", errorCode: "CONN_TIMEOUT", retries: 3 },
    actions: [
      { id: "a1", label: "Retry Now", type: "investigate", automated: true },
      { id: "a2", label: "Acknowledge", type: "acknowledge", automated: false }
    ],
    noCdsCompliance: "System alert for operational monitoring."
  };

  const alert3: RealTimeAlert = {
    id: generateId("alert"),
    category: "security_vulnerability",
    severity: "critical",
    title: "Unencrypted PHI Detected",
    message: "PHI data found in unencrypted log files. Immediate remediation required.",
    source: "Security Scanner",
    timestamp: new Date(now.getTime() - 1200000),
    status: "acknowledged",
    acknowledgedBy: "security-team",
    acknowledgedAt: new Date(now.getTime() - 900000),
    escalationLevel: 2,
    metadata: { affectedLogs: 3, complianceRisk: "HIPAA_VIOLATION" },
    actions: [
      { id: "a1", label: "View Details", type: "investigate", automated: false },
      { id: "a2", label: "Mark Resolved", type: "resolve", automated: false }
    ],
    noCdsCompliance: "Security alert for compliance monitoring."
  };

  const alert4: RealTimeAlert = {
    id: generateId("alert"),
    category: "system_health",
    severity: "medium",
    title: "Database Response Time Degraded",
    message: "PostgreSQL response time increased by 40% in the last 15 minutes",
    source: "Health Monitor",
    timestamp: new Date(now.getTime() - 180000),
    status: "active",
    escalationLevel: 0,
    metadata: { currentLatency: 450, normalLatency: 320, threshold: 400 },
    actions: [
      { id: "a1", label: "Investigate", type: "investigate", automated: false },
      { id: "a2", label: "Snooze 1hr", type: "snooze", automated: false }
    ],
    noCdsCompliance: "System performance alert."
  };

  alerts.set(alert1.id, alert1);
  alerts.set(alert2.id, alert2);
  alerts.set(alert3.id, alert3);
  alerts.set(alert4.id, alert4);

  const job1: AutomationJob = {
    id: generateId("job"),
    name: "Patient Risk Assessment Batch",
    type: "risk_assessment",
    status: "running",
    progress: 65,
    startedAt: new Date(now.getTime() - 1800000),
    estimatedCompletion: new Date(now.getTime() + 900000),
    retryCount: 0,
    maxRetries: 3,
    priority: "high",
    triggeredBy: "scheduler",
    affectedResources: ["patient-batch-001"],
    metrics: { recordsProcessed: 325, recordsTotal: 500, errorsCount: 2, warningsCount: 8 }
  };

  const job2: AutomationJob = {
    id: generateId("job"),
    name: "FHIR Data Validation",
    type: "validation",
    status: "running",
    progress: 42,
    startedAt: new Date(now.getTime() - 600000),
    estimatedCompletion: new Date(now.getTime() + 1200000),
    retryCount: 0,
    maxRetries: 3,
    priority: "medium",
    triggeredBy: "fhir-import",
    affectedResources: ["fhir-batch-002"],
    metrics: { recordsProcessed: 210, recordsTotal: 500, errorsCount: 5, warningsCount: 12 }
  };

  const job3: AutomationJob = {
    id: generateId("job"),
    name: "Security Compliance Scan",
    type: "security_scan",
    status: "completed",
    progress: 100,
    startedAt: new Date(now.getTime() - 7200000),
    completedAt: new Date(now.getTime() - 3600000),
    retryCount: 0,
    maxRetries: 3,
    priority: "high",
    triggeredBy: "scheduler",
    affectedResources: ["all-systems"],
    metrics: { recordsProcessed: 1250, recordsTotal: 1250, errorsCount: 0, warningsCount: 3, duration: 3600000 }
  };

  const job4: AutomationJob = {
    id: generateId("job"),
    name: "Fasten Health Sync",
    type: "data_sync",
    status: "failed",
    progress: 23,
    startedAt: new Date(now.getTime() - 2400000),
    completedAt: new Date(now.getTime() - 2100000),
    failureReason: "Connection timeout after 3 retries",
    retryCount: 3,
    maxRetries: 3,
    priority: "high",
    triggeredBy: "scheduler",
    affectedResources: ["epic-connection"],
    metrics: { recordsProcessed: 115, recordsTotal: 500, errorsCount: 1, warningsCount: 0, duration: 300000 }
  };

  jobs.set(job1.id, job1);
  jobs.set(job2.id, job2);
  jobs.set(job3.id, job3);
  jobs.set(job4.id, job4);

  const vuln1: SecurityVulnerability = {
    id: generateId("vuln"),
    title: "PHI Exposure in Application Logs",
    description: "Sensitive patient health information is being logged without proper redaction",
    severity: "critical",
    category: "data_exposure",
    cvssScore: 8.5,
    affectedComponents: ["logging-service", "api-gateway"],
    discoveredAt: new Date(now.getTime() - 86400000),
    status: "in_progress",
    remediationProgress: 60,
    remediationSteps: [
      { id: "s1", step: 1, description: "Identify all affected log files", status: "completed", completedAt: new Date(now.getTime() - 72000000) },
      { id: "s2", step: 2, description: "Implement PHI redaction filter", status: "completed", completedAt: new Date(now.getTime() - 43200000) },
      { id: "s3", step: 3, description: "Deploy updated logging configuration", status: "in_progress" },
      { id: "s4", step: 4, description: "Verify no PHI in new logs", status: "pending" },
      { id: "s5", step: 5, description: "Purge affected historical logs", status: "pending" }
    ],
    assignedTo: "security-team",
    dueDate: new Date(now.getTime() + 172800000),
    complianceImpact: ["HIPAA 164.312", "SOC2 CC6.1"]
  };

  const vuln2: SecurityVulnerability = {
    id: generateId("vuln"),
    title: "Weak Session Timeout Configuration",
    description: "User sessions remain active for 2 hours, exceeding HIPAA recommended 15 minutes",
    severity: "high",
    category: "authentication",
    cvssScore: 6.5,
    affectedComponents: ["session-manager", "auth-service"],
    discoveredAt: new Date(now.getTime() - 172800000),
    status: "open",
    remediationProgress: 0,
    remediationSteps: [
      { id: "s1", step: 1, description: "Update session timeout to 15 minutes", status: "pending" },
      { id: "s2", step: 2, description: "Add session warning before expiry", status: "pending" },
      { id: "s3", step: 3, description: "Test user experience", status: "pending" }
    ],
    assignedTo: "platform-team",
    dueDate: new Date(now.getTime() + 259200000),
    complianceImpact: ["HIPAA 164.312(a)(2)(iii)"]
  };

  const vuln3: SecurityVulnerability = {
    id: generateId("vuln"),
    title: "Missing Encryption at Rest for Backup Files",
    description: "Database backup files are stored without encryption",
    severity: "high",
    category: "encryption",
    cvssScore: 7.2,
    affectedComponents: ["backup-service", "storage"],
    discoveredAt: new Date(now.getTime() - 259200000),
    status: "mitigated",
    remediationProgress: 100,
    remediationSteps: [
      { id: "s1", step: 1, description: "Enable AES-256 encryption for backups", status: "completed", completedAt: new Date(now.getTime() - 86400000) },
      { id: "s2", step: 2, description: "Re-encrypt existing backups", status: "completed", completedAt: new Date(now.getTime() - 43200000) },
      { id: "s3", step: 3, description: "Verify encryption in all environments", status: "completed", completedAt: new Date(now.getTime() - 21600000) }
    ],
    complianceImpact: ["HIPAA 164.312(a)(2)(iv)", "SOC2 CC6.7"]
  };

  vulnerabilities.set(vuln1.id, vuln1);
  vulnerabilities.set(vuln2.id, vuln2);
  vulnerabilities.set(vuln3.id, vuln3);

  const metrics: PerformanceMetrics = {
    timestamp: now,
    apiLatency: { p50: 45, p90: 120, p99: 350, avg: 78, max: 890 },
    databaseLatency: { p50: 12, p90: 45, p99: 180, avg: 28, max: 450 },
    throughput: { requestsPerSecond: 125, eventsProcessedPerMinute: 450, alertsGeneratedPerHour: 23 },
    resources: { cpuUsage: 42, memoryUsage: 68, diskUsage: 55, activeConnections: 89 },
    fhirOperations: { readOperations: 1250, writeOperations: 320, searchOperations: 890, validationErrors: 12, syncOperations: 45 }
  };

  metricsHistory.push(metrics);
}

initializeSampleData();

export class RealTimeMonitoringService {
  private wsServer: WebSocketServer | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private alertCheckInterval: NodeJS.Timeout | null = null;

  initializeWebSocket(wss: WebSocketServer) {
    this.wsServer = wss;
    console.log("[RealTimeMonitoring] WebSocket server initialized");

    wss.on("connection", (ws: WebSocket) => {
      connectedClients.add(ws);
      console.log(`[RealTimeMonitoring] Client connected. Total: ${connectedClients.size}`);

      ws.send(JSON.stringify({
        type: "connection_established",
        message: "Connected to real-time monitoring",
        timestamp: new Date().toISOString()
      }));

      ws.on("close", () => {
        connectedClients.delete(ws);
        console.log(`[RealTimeMonitoring] Client disconnected. Total: ${connectedClients.size}`);
      });

      ws.on("message", (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error("[RealTimeMonitoring] Invalid message:", error);
        }
      });
    });

    this.startMetricsUpdates();
    this.startAlertChecks();
  }

  private startMetricsUpdates() {
    this.metricsInterval = setInterval(() => {
      const metrics = this.generateCurrentMetrics();
      metricsHistory.push(metrics);
      if (metricsHistory.length > 60) metricsHistory.shift();

      this.broadcast({
        type: "metrics_update",
        data: metrics,
        timestamp: new Date().toISOString()
      });
    }, 10000);
  }

  private startAlertChecks() {
    this.alertCheckInterval = setInterval(() => {
      this.checkForNewAlerts();
      this.checkDelayedJobs();
    }, 5000);
  }

  private generateCurrentMetrics(): PerformanceMetrics {
    const base = metricsHistory[metricsHistory.length - 1] || {
      apiLatency: { p50: 45, p90: 120, p99: 350, avg: 78, max: 890 },
      databaseLatency: { p50: 12, p90: 45, p99: 180, avg: 28, max: 450 },
      throughput: { requestsPerSecond: 125, eventsProcessedPerMinute: 450, alertsGeneratedPerHour: 23 },
      resources: { cpuUsage: 42, memoryUsage: 68, diskUsage: 55, activeConnections: 89 },
      fhirOperations: { readOperations: 1250, writeOperations: 320, searchOperations: 890, validationErrors: 12, syncOperations: 45 }
    };

    const vary = (val: number, range: number) => Math.max(0, val + (Math.random() - 0.5) * range);

    return {
      timestamp: new Date(),
      apiLatency: {
        p50: vary(base.apiLatency.p50, 10),
        p90: vary(base.apiLatency.p90, 20),
        p99: vary(base.apiLatency.p99, 50),
        avg: vary(base.apiLatency.avg, 15),
        max: vary(base.apiLatency.max, 100)
      },
      databaseLatency: {
        p50: vary(base.databaseLatency.p50, 5),
        p90: vary(base.databaseLatency.p90, 10),
        p99: vary(base.databaseLatency.p99, 30),
        avg: vary(base.databaseLatency.avg, 8),
        max: vary(base.databaseLatency.max, 50)
      },
      throughput: {
        requestsPerSecond: Math.round(vary(base.throughput.requestsPerSecond, 30)),
        eventsProcessedPerMinute: Math.round(vary(base.throughput.eventsProcessedPerMinute, 50)),
        alertsGeneratedPerHour: Math.round(vary(base.throughput.alertsGeneratedPerHour, 5))
      },
      resources: {
        cpuUsage: Math.min(100, Math.max(0, vary(base.resources.cpuUsage, 10))),
        memoryUsage: Math.min(100, Math.max(0, vary(base.resources.memoryUsage, 5))),
        diskUsage: Math.min(100, Math.max(0, vary(base.resources.diskUsage, 1))),
        activeConnections: Math.max(0, Math.round(vary(base.resources.activeConnections, 15)))
      },
      fhirOperations: {
        readOperations: Math.round(vary(base.fhirOperations.readOperations, 100)),
        writeOperations: Math.round(vary(base.fhirOperations.writeOperations, 30)),
        searchOperations: Math.round(vary(base.fhirOperations.searchOperations, 80)),
        validationErrors: Math.max(0, Math.round(vary(base.fhirOperations.validationErrors, 3))),
        syncOperations: Math.round(vary(base.fhirOperations.syncOperations, 10))
      }
    };
  }

  private checkForNewAlerts() {
    if (Math.random() > 0.95) {
      const categories: AlertCategory[] = ["patient_risk", "automation_failure", "system_health", "performance"];
      const severities: AlertSeverity[] = ["critical", "high", "medium", "low"];
      
      const newAlert: RealTimeAlert = {
        id: generateId("alert"),
        category: categories[Math.floor(Math.random() * categories.length)],
        severity: severities[Math.floor(Math.random() * severities.length)],
        title: "Auto-generated Alert",
        message: `Automated monitoring detected an issue at ${new Date().toLocaleTimeString()}`,
        source: "Real-time Monitor",
        timestamp: new Date(),
        status: "active",
        escalationLevel: 0,
        metadata: {},
        actions: [
          { id: "a1", label: "Acknowledge", type: "acknowledge", automated: false }
        ],
        noCdsCompliance: "System monitoring alert. NOT clinical advice."
      };

      alerts.set(newAlert.id, newAlert);
      
      this.broadcast({
        type: "new_alert",
        data: newAlert,
        timestamp: new Date().toISOString()
      });
    }
  }

  private checkDelayedJobs() {
    const now = new Date();
    for (const job of Array.from(jobs.values())) {
      if (job.status === "running" && job.estimatedCompletion && now > job.estimatedCompletion) {
        const existingAlert = Array.from(alerts.values()).find(
          a => a.category === "automation_failure" && a.metadata.jobId === job.id && a.status === "active"
        );
        
        if (!existingAlert) {
          const delayAlert: RealTimeAlert = {
            id: generateId("alert"),
            category: "automation_failure",
            severity: "medium",
            title: `Job Delayed: ${job.name}`,
            message: `Job ${job.name} exceeded estimated completion time`,
            source: "Job Monitor",
            timestamp: now,
            status: "active",
            escalationLevel: 0,
            metadata: { jobId: job.id, estimatedCompletion: job.estimatedCompletion },
            actions: [
              { id: "a1", label: "View Job", type: "investigate", automated: false },
              { id: "a2", label: "Acknowledge", type: "acknowledge", automated: false }
            ],
            noCdsCompliance: "Job delay alert for operational monitoring."
          };
          
          alerts.set(delayAlert.id, delayAlert);
          this.broadcast({
            type: "new_alert",
            data: delayAlert,
            timestamp: now.toISOString()
          });
        }
      }
    }
  }

  private handleClientMessage(ws: WebSocket, message: any) {
    switch (message.type) {
      case "subscribe":
        ws.send(JSON.stringify({ type: "subscribed", channels: message.channels }));
        break;
      case "acknowledge_alert":
        this.acknowledgeAlert(message.alertId, message.userId);
        break;
      case "resolve_alert":
        this.resolveAlert(message.alertId);
        break;
      default:
        console.log("[RealTimeMonitoring] Unknown message type:", message.type);
    }
  }

  broadcast(message: any) {
    const data = JSON.stringify(message);
    for (const client of Array.from(connectedClients)) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  createPatientRiskAlert(patientId: string, riskScore: number, reason: string): RealTimeAlert {
    const severity: AlertSeverity = riskScore >= 80 ? "critical" : riskScore >= 60 ? "high" : riskScore >= 40 ? "medium" : "low";
    
    const alert: RealTimeAlert = {
      id: generateId("alert"),
      category: "patient_risk",
      severity,
      title: `Patient Risk Alert: ${severity.toUpperCase()}`,
      message: reason,
      source: "AI Risk Assessment",
      patientId,
      timestamp: new Date(),
      status: "active",
      escalationLevel: severity === "critical" ? 1 : 0,
      metadata: { riskScore },
      actions: [
        { id: "a1", label: "Acknowledge", type: "acknowledge", automated: false },
        { id: "a2", label: "Notify Care Team", type: "notify_team", automated: severity === "critical" },
        { id: "a3", label: "View Details", type: "investigate", automated: false }
      ],
      noCdsCompliance: "Risk alert for care coordination. NOT clinical decision support."
    };

    alerts.set(alert.id, alert);
    this.broadcast({ type: "new_alert", data: alert, timestamp: new Date().toISOString() });
    
    return alert;
  }

  createJobFailureAlert(job: AutomationJob): RealTimeAlert {
    const alert: RealTimeAlert = {
      id: generateId("alert"),
      category: "automation_failure",
      severity: job.priority,
      title: `Job Failed: ${job.name}`,
      message: job.failureReason || "Unknown failure",
      source: "Job Executor",
      timestamp: new Date(),
      status: "active",
      escalationLevel: 0,
      metadata: { jobId: job.id, type: job.type, retries: job.retryCount },
      actions: [
        { id: "a1", label: "Retry", type: "investigate", automated: job.retryCount < job.maxRetries },
        { id: "a2", label: "Acknowledge", type: "acknowledge", automated: false }
      ],
      noCdsCompliance: "Job failure alert for operational monitoring."
    };

    alerts.set(alert.id, alert);
    this.broadcast({ type: "new_alert", data: alert, timestamp: new Date().toISOString() });
    
    return alert;
  }

  acknowledgeAlert(alertId: string, userId: string): boolean {
    const alert = alerts.get(alertId);
    if (alert && alert.status === "active") {
      alert.status = "acknowledged";
      alert.acknowledgedBy = userId;
      alert.acknowledgedAt = new Date();
      alerts.set(alertId, alert);
      
      this.broadcast({
        type: "alert_updated",
        data: alert,
        timestamp: new Date().toISOString()
      });
      return true;
    }
    return false;
  }

  resolveAlert(alertId: string): boolean {
    const alert = alerts.get(alertId);
    if (alert && alert.status !== "resolved") {
      alert.status = "resolved";
      alert.resolvedAt = new Date();
      alerts.set(alertId, alert);
      
      this.broadcast({
        type: "alert_resolved",
        data: alert,
        timestamp: new Date().toISOString()
      });
      return true;
    }
    return false;
  }

  escalateAlert(alertId: string): boolean {
    const alert = alerts.get(alertId);
    if (alert && alert.status === "active") {
      alert.escalationLevel += 1;
      alert.status = "escalated";
      alerts.set(alertId, alert);
      
      this.broadcast({
        type: "alert_escalated",
        data: alert,
        timestamp: new Date().toISOString()
      });
      return true;
    }
    return false;
  }

  updateVulnerabilityStatus(vulnId: string, status: SecurityVulnerability["status"], progress?: number): boolean {
    const vuln = vulnerabilities.get(vulnId);
    if (vuln) {
      vuln.status = status;
      if (progress !== undefined) vuln.remediationProgress = progress;
      vulnerabilities.set(vulnId, vuln);
      
      this.broadcast({
        type: "vulnerability_updated",
        data: vuln,
        timestamp: new Date().toISOString()
      });
      return true;
    }
    return false;
  }

  getDashboard(): MonitoringDashboard {
    const now = new Date();
    const allAlerts = Array.from(alerts.values());
    const allJobs = Array.from(jobs.values());
    const allVulns = Array.from(vulnerabilities.values());

    const activeAlerts = allAlerts.filter(a => a.status === "active" || a.status === "acknowledged" || a.status === "escalated");
    const resolvedAlerts = allAlerts.filter(a => a.status === "resolved").slice(-10);

    const alertStats: AlertStats = {
      totalActive: activeAlerts.length,
      bySeverity: {
        critical: activeAlerts.filter(a => a.severity === "critical").length,
        high: activeAlerts.filter(a => a.severity === "high").length,
        medium: activeAlerts.filter(a => a.severity === "medium").length,
        low: activeAlerts.filter(a => a.severity === "low").length,
        info: activeAlerts.filter(a => a.severity === "info").length
      },
      byCategory: {
        patient_risk: activeAlerts.filter(a => a.category === "patient_risk").length,
        automation_failure: activeAlerts.filter(a => a.category === "automation_failure").length,
        security_vulnerability: activeAlerts.filter(a => a.category === "security_vulnerability").length,
        system_health: activeAlerts.filter(a => a.category === "system_health").length,
        performance: activeAlerts.filter(a => a.category === "performance").length,
        compliance: activeAlerts.filter(a => a.category === "compliance").length
      },
      avgResolutionTime: 45,
      escalationRate: 0.12
    };

    const runningJobs = allJobs.filter(j => j.status === "running");
    const completedJobs = allJobs.filter(j => j.status === "completed");
    const failedJobs = allJobs.filter(j => j.status === "failed");

    const jobStats: JobStats = {
      totalRunning: runningJobs.length,
      totalCompleted24h: completedJobs.length,
      totalFailed24h: failedJobs.length,
      successRate: completedJobs.length / Math.max(1, completedJobs.length + failedJobs.length),
      avgDuration: 1800000
    };

    const openVulns = allVulns.filter(v => v.status === "open" || v.status === "in_progress");
    const securityStats: SecurityStats = {
      totalOpen: openVulns.length,
      critical: openVulns.filter(v => v.severity === "critical").length,
      high: openVulns.filter(v => v.severity === "high").length,
      avgRemediationTime: 72,
      complianceScore: 85
    };

    const components: ComponentHealth[] = [
      { id: "api", name: "API Gateway", type: "api", status: "healthy", responseTime: 45, errorRate: 0.1, throughput: 125, lastCheck: now, issues: [] },
      { id: "db", name: "PostgreSQL", type: "database", status: "healthy", responseTime: 28, errorRate: 0, throughput: 450, lastCheck: now, issues: [] },
      { id: "fhir", name: "FHIR Server", type: "fhir_endpoint", status: "healthy", responseTime: 120, errorRate: 0.5, throughput: 89, lastCheck: now, issues: [] },
      { id: "ai", name: "AI Services", type: "ai_service", status: "healthy", responseTime: 350, errorRate: 0.2, throughput: 45, lastCheck: now, issues: [] },
      { id: "cache", name: "Redis Cache", type: "cache", status: "healthy", responseTime: 5, errorRate: 0, throughput: 890, lastCheck: now, issues: [] },
      { id: "storage", name: "Object Storage", type: "storage", status: "healthy", responseTime: 85, errorRate: 0.1, throughput: 23, lastCheck: now, issues: [] }
    ];

    const health: SystemHealth = {
      overall: components.every(c => c.status === "healthy") ? "healthy" : components.some(c => c.status === "critical") ? "critical" : "degraded",
      components,
      uptime: 99.95,
      lastUpdated: now
    };

    const latestMetrics = metricsHistory[metricsHistory.length - 1] || this.generateCurrentMetrics();

    return {
      alerts: { active: activeAlerts, recentlyResolved: resolvedAlerts, stats: alertStats },
      jobs: { running: runningJobs, recent: allJobs.slice(-10), stats: jobStats },
      security: { vulnerabilities: allVulns, stats: securityStats },
      health,
      performance: latestMetrics,
      lastUpdated: now
    };
  }

  getAlerts(status?: AlertStatus, category?: AlertCategory): RealTimeAlert[] {
    let result = Array.from(alerts.values());
    if (status) result = result.filter(a => a.status === status);
    if (category) result = result.filter(a => a.category === category);
    return result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getJobs(status?: JobStatus): AutomationJob[] {
    let result = Array.from(jobs.values());
    if (status) result = result.filter(j => j.status === status);
    return result.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  getVulnerabilities(status?: SecurityVulnerability["status"]): SecurityVulnerability[] {
    let result = Array.from(vulnerabilities.values());
    if (status) result = result.filter(v => v.status === status);
    return result.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  getMetricsHistory(): PerformanceMetrics[] {
    return [...metricsHistory];
  }
}

export const realTimeMonitoringService = new RealTimeMonitoringService();
