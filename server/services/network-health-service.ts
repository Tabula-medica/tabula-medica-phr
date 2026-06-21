import { tefcaFrameworkService, type QHINIdentifier, type QHINConnection } from "./tefca-framework-service";
import { logPhiAccess } from "../security/hipaa-audit";

export type TrafficLightStatus = "green" | "yellow" | "red" | "grey";

export interface EndpointHealthRecord {
  partnerId: QHINIdentifier;
  partnerName: string;
  endpointType: "discovery" | "query" | "retrieve";
  url: string;
  status: TrafficLightStatus;
  connectionStatus: "healthy" | "degraded" | "down" | "unknown";
  latencyMs: number;
  lastCheckedAt: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  uptimePercent: number;
  responseCode: number | null;
  checkCount: number;
  successCount: number;
}

export interface HealthAlert {
  id: string;
  partnerId: QHINIdentifier;
  partnerName: string;
  endpointType: string;
  severity: "warning" | "critical" | "resolved";
  message: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  emailSent: boolean;
  resolvedAt: string | null;
}

export interface NetworkHealthSummary {
  totalEndpoints: number;
  healthy: number;
  degraded: number;
  down: number;
  unknown: number;
  overallStatus: TrafficLightStatus;
  lastFullScanAt: string | null;
  nextScanAt: string | null;
  scanIntervalMs: number;
  activeAlerts: number;
  uptimeAverage: number;
  avgLatencyMs: number;
}

interface HealthHistoryEntry {
  timestamp: string;
  partnerId: QHINIdentifier;
  endpointType: string;
  status: TrafficLightStatus;
  latencyMs: number;
  success: boolean;
}

const SCAN_INTERVAL_MS = 5 * 60 * 1000;
const DEGRADED_LATENCY_THRESHOLD_MS = 2000;
const CRITICAL_CONSECUTIVE_FAILURES = 3;
const WARNING_CONSECUTIVE_FAILURES = 1;
const MAX_HISTORY = 1000;
const MAX_ALERTS = 200;

class NetworkHealthService {
  private healthRecords: Map<string, EndpointHealthRecord> = new Map();
  private alerts: HealthAlert[] = [];
  private history: HealthHistoryEntry[] = [];
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private lastFullScanAt: string | null = null;
  private alertCounter = 0;
  private emailRecipients: string[] = [];

  constructor() {
    this.initializeRecords();
    this.seedHistoricalData();
  }

  private recordKey(partnerId: string, endpointType: string): string {
    return `${partnerId}::${endpointType}`;
  }

  private initializeRecords(): void {
    const connections = tefcaFrameworkService.getQHINConnections();
    const endpointTypes: Array<"discovery" | "query" | "retrieve"> = ["discovery", "query", "retrieve"];

    for (const conn of connections) {
      for (const epType of endpointTypes) {
        const key = this.recordKey(conn.qhinId, epType);
        this.healthRecords.set(key, {
          partnerId: conn.qhinId,
          partnerName: conn.name,
          endpointType: epType,
          url: conn.endpoints[epType],
          status: "grey",
          connectionStatus: "unknown",
          latencyMs: 0,
          lastCheckedAt: "",
          lastSuccessAt: null,
          lastFailureAt: null,
          lastError: null,
          consecutiveFailures: 0,
          uptimePercent: 100,
          responseCode: null,
          checkCount: 0,
          successCount: 0,
        });
      }
    }
  }

  private seedHistoricalData(): void {
    const connections = tefcaFrameworkService.getQHINConnections();
    const endpointTypes: Array<"discovery" | "query" | "retrieve"> = ["discovery", "query", "retrieve"];
    const now = Date.now();

    for (const conn of connections) {
      for (const epType of endpointTypes) {
        const key = this.recordKey(conn.qhinId, epType);
        const record = this.healthRecords.get(key)!;

        const isProblematic = conn.qhinId === "carin_alliance" && epType === "query";
        const isSlowPartner = conn.qhinId === "direct_trust";

        let totalChecks = 0;
        let successChecks = 0;

        for (let i = 59; i >= 0; i--) {
          const checkTime = new Date(now - i * SCAN_INTERVAL_MS).toISOString();
          const failRoll = Math.random();
          let success: boolean;
          let latency: number;

          if (isProblematic) {
            success = failRoll > 0.25;
            latency = success ? 800 + Math.random() * 2500 : 0;
          } else if (isSlowPartner) {
            success = failRoll > 0.05;
            latency = success ? 1200 + Math.random() * 1800 : 0;
          } else {
            success = failRoll > 0.03;
            latency = success ? 50 + Math.random() * 400 : 0;
          }

          totalChecks++;
          if (success) successChecks++;

          this.history.push({
            timestamp: checkTime,
            partnerId: conn.qhinId,
            endpointType: epType,
            status: success ? (latency > DEGRADED_LATENCY_THRESHOLD_MS ? "yellow" : "green") : "red",
            latencyMs: Math.round(latency),
            success,
          });
        }

        const recentHistory = this.history
          .filter(h => h.partnerId === conn.qhinId && h.endpointType === epType)
          .slice(-5);

        const lastEntry = recentHistory[recentHistory.length - 1];
        let consecutiveFailures = 0;
        for (let j = recentHistory.length - 1; j >= 0; j--) {
          if (!recentHistory[j].success) consecutiveFailures++;
          else break;
        }

        const latency = lastEntry?.latencyMs || 0;
        let status: TrafficLightStatus;
        let connectionStatus: EndpointHealthRecord["connectionStatus"];

        if (consecutiveFailures >= CRITICAL_CONSECUTIVE_FAILURES) {
          status = "red";
          connectionStatus = "down";
        } else if (consecutiveFailures >= WARNING_CONSECUTIVE_FAILURES || latency > DEGRADED_LATENCY_THRESHOLD_MS) {
          status = "yellow";
          connectionStatus = "degraded";
        } else {
          status = "green";
          connectionStatus = "healthy";
        }

        record.status = status;
        record.connectionStatus = connectionStatus;
        record.latencyMs = latency;
        record.lastCheckedAt = lastEntry?.timestamp || new Date().toISOString();
        record.lastSuccessAt = recentHistory.filter(h => h.success).pop()?.timestamp || null;
        record.lastFailureAt = recentHistory.filter(h => !h.success).pop()?.timestamp || null;
        record.consecutiveFailures = consecutiveFailures;
        record.uptimePercent = totalChecks > 0 ? Math.round((successChecks / totalChecks) * 1000) / 10 : 100;
        record.checkCount = totalChecks;
        record.successCount = successChecks;
        record.responseCode = lastEntry?.success ? 200 : null;

        if (status === "red") {
          this.createAlert(record, "critical", `Endpoint DOWN: ${conn.name} ${epType} — ${consecutiveFailures} consecutive failures`);
        } else if (status === "yellow") {
          this.createAlert(record, "warning", `Endpoint DEGRADED: ${conn.name} ${epType} — latency ${latency}ms`);
        }
      }
    }

    this.lastFullScanAt = new Date().toISOString();
    this.trimHistory();
  }

  startScheduledScans(): void {
    if (this.scanInterval) return;

    console.log(`[NetworkHealth] Starting scheduled endpoint health scans every ${SCAN_INTERVAL_MS / 1000}s`);
    this.scanInterval = setInterval(() => {
      this.runFullScan().catch(err => {
        console.error("[NetworkHealth] Scheduled scan failed:", err);
      });
    }, SCAN_INTERVAL_MS);

    this.runFullScan().catch(err => {
      console.error("[NetworkHealth] Initial scan failed:", err);
    });
  }

  stopScheduledScans(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
      console.log("[NetworkHealth] Scheduled scans stopped");
    }
  }

  async runFullScan(): Promise<void> {
    const connections = tefcaFrameworkService.getQHINConnections();
    const endpointTypes: Array<"discovery" | "query" | "retrieve"> = ["discovery", "query", "retrieve"];

    console.log(`[NetworkHealth] Running full scan of ${connections.length * endpointTypes.length} endpoints`);

    const promises: Promise<void>[] = [];
    for (const conn of connections) {
      for (const epType of endpointTypes) {
        promises.push(this.checkEndpoint(conn, epType));
      }
    }

    await Promise.allSettled(promises);
    this.lastFullScanAt = new Date().toISOString();

    logPhiAccess({
      action: "read",
      userId: "system-health-monitor",
      resourceType: "NetworkHealthScan",
      details: `NETWORK_HEALTH_SCAN completed for ${connections.length} partners, ${promises.length} endpoints`,
    });

    this.trimHistory();
    console.log(`[NetworkHealth] Scan complete at ${this.lastFullScanAt}`);
  }

  private async checkEndpoint(conn: QHINConnection, endpointType: "discovery" | "query" | "retrieve"): Promise<void> {
    const key = this.recordKey(conn.qhinId, endpointType);
    let record = this.healthRecords.get(key);

    if (!record) {
      record = {
        partnerId: conn.qhinId,
        partnerName: conn.name,
        endpointType,
        url: conn.endpoints[endpointType],
        status: "grey",
        connectionStatus: "unknown",
        latencyMs: 0,
        lastCheckedAt: "",
        lastSuccessAt: null,
        lastFailureAt: null,
        lastError: null,
        consecutiveFailures: 0,
        uptimePercent: 100,
        responseCode: null,
        checkCount: 0,
        successCount: 0,
      };
      this.healthRecords.set(key, record);
    }

    const start = Date.now();
    let success = false;
    let responseCode: number | null = null;
    let error: string | null = null;

    try {
      const url = new URL(conn.endpoints[endpointType]);
      const blockedPatterns = [
        /^localhost$/i, /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./, /^0\./, /^169\.254\./, /^\[::1\]$/, /^metadata\.google\.internal$/i,
      ];
      if (blockedPatterns.some(p => p.test(url.hostname))) {
        throw new Error("Connection to private/internal addresses blocked");
      }

      const resp = await fetch(conn.endpoints[endpointType], {
        method: "HEAD",
        signal: AbortSignal.timeout(10000),
        redirect: "manual",
      });
      responseCode = resp.status;
      success = resp.ok || resp.status === 401 || resp.status === 403 || resp.status === 405;
    } catch (err) {
      error = err instanceof Error ? err.message : "Connection failed";
    }

    const latencyMs = Date.now() - start;
    const now = new Date().toISOString();

    record.checkCount++;
    record.lastCheckedAt = now;
    record.latencyMs = latencyMs;
    record.responseCode = responseCode;

    if (success) {
      record.successCount++;
      record.lastSuccessAt = now;
      record.lastError = null;
      record.consecutiveFailures = 0;
    } else {
      record.lastFailureAt = now;
      record.lastError = error;
      record.consecutiveFailures++;
    }

    record.uptimePercent = record.checkCount > 0
      ? Math.round((record.successCount / record.checkCount) * 1000) / 10
      : 0;

    const prevStatus = record.status;

    if (record.consecutiveFailures >= CRITICAL_CONSECUTIVE_FAILURES) {
      record.status = "red";
      record.connectionStatus = "down";
    } else if (record.consecutiveFailures >= WARNING_CONSECUTIVE_FAILURES || latencyMs > DEGRADED_LATENCY_THRESHOLD_MS) {
      record.status = "yellow";
      record.connectionStatus = "degraded";
    } else if (success) {
      record.status = "green";
      record.connectionStatus = "healthy";
    }

    this.history.push({
      timestamp: now,
      partnerId: conn.qhinId,
      endpointType,
      status: record.status,
      latencyMs,
      success,
    });

    if (record.status === "red" && prevStatus !== "red") {
      const alert = this.createAlert(record, "critical",
        `CRITICAL: ${conn.name} ${endpointType} endpoint is DOWN after ${record.consecutiveFailures} consecutive failures. Last error: ${error || "unknown"}`);
      this.sendEmailAlert(alert);
    } else if (record.status === "yellow" && prevStatus === "green") {
      this.createAlert(record, "warning",
        `WARNING: ${conn.name} ${endpointType} endpoint degraded — latency ${latencyMs}ms`);
    } else if (record.status === "green" && (prevStatus === "red" || prevStatus === "yellow")) {
      const activeAlert = this.alerts.find(a =>
        a.partnerId === conn.qhinId &&
        a.endpointType === endpointType &&
        a.severity !== "resolved" &&
        !a.resolvedAt
      );
      if (activeAlert) {
        activeAlert.severity = "resolved";
        activeAlert.resolvedAt = now;
      }
      this.createAlert(record, "resolved",
        `RESOLVED: ${conn.name} ${endpointType} endpoint recovered — latency ${latencyMs}ms`);
    }
  }

  private createAlert(record: EndpointHealthRecord, severity: HealthAlert["severity"], message: string): HealthAlert {
    const alert: HealthAlert = {
      id: `alert-${++this.alertCounter}-${Date.now()}`,
      partnerId: record.partnerId,
      partnerName: record.partnerName,
      endpointType: record.endpointType,
      severity,
      message,
      timestamp: new Date().toISOString(),
      acknowledged: false,
      acknowledgedBy: null,
      acknowledgedAt: null,
      emailSent: false,
      resolvedAt: severity === "resolved" ? new Date().toISOString() : null,
    };

    this.alerts.push(alert);
    if (this.alerts.length > MAX_ALERTS) {
      this.alerts = this.alerts.slice(-MAX_ALERTS);
    }

    return alert;
  }

  private async sendEmailAlert(alert: HealthAlert): Promise<void> {
    const alertEmail = process.env.NETWORK_ALERT_EMAIL;
    if (!alertEmail) {
      // No recipient configured — silent skip (matches prior behavior).
      return;
    }

    // Preferred path: Resend (HIPAA-eligible, BAA-able). When RESEND_API_KEY
    // is set, route alerts through the shared email-service. The alert body
    // contains operational metadata only — no PHI — so it is safe to send
    // over a transactional email provider.
    if (process.env.RESEND_API_KEY) {
      try {
        const { sendEmail } = await import("./email-service");
        const result = await sendEmail({
          to: alertEmail,
          subject: `[Tabula Medica] ${alert.severity?.toUpperCase?.() || "ALERT"} — ${alert.message}`,
          text: [
            `Severity: ${alert.severity || "unknown"}`,
            `Message: ${alert.message}`,
            `Timestamp: ${new Date().toISOString()}`,
            `Source: NetworkHealth monitor`,
          ].join("\n"),
          tags: [{ name: "channel", value: "network-health" }],
        });
        if (!result.ok) {
          console.warn(`[NetworkHealth] Resend send failed (${result.reason}): ${result.error || ""}`);
        }
        return;
      } catch (err: any) {
        console.warn(`[NetworkHealth] Resend path threw, falling back to SMTP: ${err?.message || err}`);
      }
    }

    // Fallback: legacy SMTP path (kept for environments without Resend).
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost) {
      console.log(`[NetworkHealth] Email alert skipped (no RESEND_API_KEY and SMTP not configured): ${alert.message}`);
      return;
    }

    try {
      let nodemailer: any;
      try {
        nodemailer = await import("nodemailer");
      } catch {
        console.log("[NetworkHealth] nodemailer not installed — email alert logged only");
        return;
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort || "587"),
        secure: smtpPort === "465",
        auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
      });

      await transporter.sendMail({
        from: smtpUser || "noreply@tabulamedica.health",
        to: alertEmail,
        subject: `[${alert.severity.toUpperCase()}] Network Health Alert — ${alert.partnerName}`,
        html: `
          <h2>Network Health Alert</h2>
          <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
          <p><strong>Partner:</strong> ${alert.partnerName} (${alert.partnerId})</p>
          <p><strong>Endpoint:</strong> ${alert.endpointType}</p>
          <p><strong>Message:</strong> ${alert.message}</p>
          <p><strong>Time:</strong> ${alert.timestamp}</p>
          <hr/>
          <p style="color: #666; font-size: 12px;">Tabula Medica Network Health Monitor</p>
        `,
      });

      alert.emailSent = true;
      console.log(`[NetworkHealth] Email alert sent to ${alertEmail}: ${alert.message}`);
    } catch (err) {
      console.error("[NetworkHealth] Failed to send email alert:", err);
    }
  }

  private trimHistory(): void {
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
    }
  }

  getSummary(): NetworkHealthSummary {
    const records = Array.from(this.healthRecords.values());
    const healthy = records.filter(r => r.status === "green").length;
    const degraded = records.filter(r => r.status === "yellow").length;
    const down = records.filter(r => r.status === "red").length;
    const unknown = records.filter(r => r.status === "grey").length;
    const activeAlerts = this.alerts.filter(a => a.severity !== "resolved" && !a.acknowledged).length;

    const checkedRecords = records.filter(r => r.checkCount > 0);
    const uptimeAvg = checkedRecords.length > 0
      ? Math.round(checkedRecords.reduce((sum, r) => sum + r.uptimePercent, 0) / checkedRecords.length * 10) / 10
      : 100;
    const latencyAvg = checkedRecords.length > 0
      ? Math.round(checkedRecords.reduce((sum, r) => sum + r.latencyMs, 0) / checkedRecords.length)
      : 0;

    let overallStatus: TrafficLightStatus = "green";
    if (down > 0) overallStatus = "red";
    else if (degraded > 0) overallStatus = "yellow";
    else if (unknown === records.length) overallStatus = "grey";

    return {
      totalEndpoints: records.length,
      healthy,
      degraded,
      down,
      unknown,
      overallStatus,
      lastFullScanAt: this.lastFullScanAt,
      nextScanAt: this.lastFullScanAt
        ? new Date(new Date(this.lastFullScanAt).getTime() + SCAN_INTERVAL_MS).toISOString()
        : null,
      scanIntervalMs: SCAN_INTERVAL_MS,
      activeAlerts,
      uptimeAverage: uptimeAvg,
      avgLatencyMs: latencyAvg,
    };
  }

  getAllRecords(): EndpointHealthRecord[] {
    return Array.from(this.healthRecords.values());
  }

  getPartnerRecords(partnerId: QHINIdentifier): EndpointHealthRecord[] {
    return Array.from(this.healthRecords.values()).filter(r => r.partnerId === partnerId);
  }

  getAlerts(opts?: { severity?: string; acknowledged?: boolean; partnerId?: string; limit?: number }): HealthAlert[] {
    let filtered = [...this.alerts];

    if (opts?.severity && opts.severity !== "all") {
      filtered = filtered.filter(a => a.severity === opts.severity);
    }
    if (opts?.acknowledged !== undefined) {
      filtered = filtered.filter(a => a.acknowledged === opts.acknowledged);
    }
    if (opts?.partnerId) {
      filtered = filtered.filter(a => a.partnerId === opts.partnerId);
    }

    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (opts?.limit) {
      filtered = filtered.slice(0, opts.limit);
    }

    return filtered;
  }

  acknowledgeAlert(alertId: string, userId: string): HealthAlert | null {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return null;

    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date().toISOString();
    return alert;
  }

  acknowledgeAllAlerts(userId: string): number {
    let count = 0;
    this.alerts.forEach(a => {
      if (!a.acknowledged) {
        a.acknowledged = true;
        a.acknowledgedBy = userId;
        a.acknowledgedAt = new Date().toISOString();
        count++;
      }
    });
    return count;
  }

  getHistory(opts?: { partnerId?: string; endpointType?: string; limit?: number }): HealthHistoryEntry[] {
    let filtered = [...this.history];

    if (opts?.partnerId) {
      filtered = filtered.filter(h => h.partnerId === opts.partnerId);
    }
    if (opts?.endpointType) {
      filtered = filtered.filter(h => h.endpointType === opts.endpointType);
    }

    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (opts?.limit) {
      filtered = filtered.slice(0, opts.limit);
    }

    return filtered;
  }

  getUptimeByPartner(): Array<{ partnerId: string; partnerName: string; uptimePercent: number; avgLatencyMs: number; status: TrafficLightStatus }> {
    const connections = tefcaFrameworkService.getQHINConnections();

    return connections.map(conn => {
      const records = this.getPartnerRecords(conn.qhinId);
      const checked = records.filter(r => r.checkCount > 0);
      const uptime = checked.length > 0
        ? Math.round(checked.reduce((s, r) => s + r.uptimePercent, 0) / checked.length * 10) / 10
        : 100;
      const latency = checked.length > 0
        ? Math.round(checked.reduce((s, r) => s + r.latencyMs, 0) / checked.length)
        : 0;

      let status: TrafficLightStatus = "green";
      if (records.some(r => r.status === "red")) status = "red";
      else if (records.some(r => r.status === "yellow")) status = "yellow";
      else if (records.every(r => r.status === "grey")) status = "grey";

      return { partnerId: conn.qhinId, partnerName: conn.name, uptimePercent: uptime, avgLatencyMs: latency, status };
    });
  }

  setEmailRecipients(emails: string[]): void {
    this.emailRecipients = emails;
  }
}

export const networkHealthService = new NetworkHealthService();
