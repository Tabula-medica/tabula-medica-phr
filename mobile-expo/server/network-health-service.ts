import { db } from "./db";
import { networkHealthChecks } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { logger } from "./utils/logger";

interface EndpointDefinition {
  endpointId: string;
  endpointName: string;
  networkId: string;
  networkName: string;
  networkType: string;
  baseUrl: string;
}

const PARTNER_ENDPOINTS: EndpointDefinition[] = [
  { endpointId: "cw-prod", endpointName: "CommonWell Production", networkId: "commonwell", networkName: "CommonWell Health Alliance", networkType: "qhin", baseUrl: "https://api.commonwellalliance.org/fhir/r4" },
  { endpointId: "cq-prod", endpointName: "Carequality Directory", networkId: "carequality", networkName: "Carequality", networkType: "qhin", baseUrl: "https://directory.carequality.org/fhir/r4" },
  { endpointId: "nexus-prod", endpointName: "Epic Nexus Gateway", networkId: "epic-nexus", networkName: "Epic Nexus", networkType: "qhin", baseUrl: "https://nexus.epic.com/Interconnect-External/api/FHIR/R4" },
  { endpointId: "ehe-prod", endpointName: "eHealth Exchange Gateway", networkId: "ehealth-exchange", networkName: "eHealth Exchange", networkType: "qhin", baseUrl: "https://gateway.ehealthexchange.org/fhir/r4" },
  { endpointId: "hg-prod", endpointName: "Health Gorilla FHIR API", networkId: "health-gorilla", networkName: "Health Gorilla", networkType: "qhin", baseUrl: "https://api.healthgorilla.com/fhir/R4" },
  { endpointId: "konza-prod", endpointName: "KONZA QHIN Gateway", networkId: "konza", networkName: "KONZA National Network", networkType: "qhin", baseUrl: "https://api.konza.org/fhir/r4" },
  { endpointId: "ma-prod", endpointName: "MedAllies HISP", networkId: "medallies", networkName: "MedAllies", networkType: "qhin", baseUrl: "https://qhin.medallies.com/fhir/r4" },
  { endpointId: "ss-prod", endpointName: "Surescripts Network", networkId: "surescripts", networkName: "Surescripts", networkType: "qhin", baseUrl: "https://api.surescripts.com/fhir/r4" },
  { endpointId: "epic-fhir", endpointName: "Epic SMART on FHIR", networkId: "epic", networkName: "Epic Systems", networkType: "ehr", baseUrl: "https://open.epic.com/Endpoints/R4Bundle" },
  { endpointId: "cerner-fhir", endpointName: "Oracle Health (Cerner)", networkId: "cerner", networkName: "Oracle Health", networkType: "ehr", baseUrl: "https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d" },
  { endpointId: "particle-api", endpointName: "Particle Health API", networkId: "particle", networkName: "Particle Health", networkType: "aggregator", baseUrl: "https://api.particlehealth.com" },
  { endpointId: "fasten-api", endpointName: "Fasten Health Connect", networkId: "fasten", networkName: "Fasten Health", networkType: "aggregator", baseUrl: "https://api.connect.fastenhealth.com/v1" },
];

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const CRITICAL_FAILURE_THRESHOLD = 3;
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;

type ConnectionStatus = "healthy" | "degraded" | "critical" | "unknown";

function determineStatus(latencyMs: number | null, statusCode: number | null, error: string | null): ConnectionStatus {
  if (error || !statusCode) return "critical";
  if (statusCode >= 500) return "critical";
  if (statusCode >= 400) return "degraded";
  if (latencyMs !== null && latencyMs > 5000) return "degraded";
  if (statusCode >= 200 && statusCode < 300) return "healthy";
  return "degraded";
}

async function pingEndpoint(endpoint: EndpointDefinition): Promise<{
  latencyMs: number | null;
  statusCode: number | null;
  errorMessage: string | null;
  connectionStatus: ConnectionStatus;
}> {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(endpoint.baseUrl, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": "TabulaMedica-HealthCheck/1.0",
        Accept: "application/fhir+json, application/json",
      },
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - startTime;
    const statusCode = response.status;
    const connectionStatus = determineStatus(latencyMs, statusCode, null);

    return { latencyMs, statusCode, errorMessage: null, connectionStatus };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err.name === "AbortError" ? "Connection timeout (10s)" : err.message || "Unknown error";
    return { latencyMs, statusCode: null, errorMessage, connectionStatus: "critical" };
  }
}

function simulateHealthCheck(endpoint: EndpointDefinition): {
  latencyMs: number;
  statusCode: number;
  errorMessage: string | null;
  connectionStatus: ConnectionStatus;
} {
  const rand = Math.random();
  let latencyMs: number;
  let statusCode: number;
  let errorMessage: string | null = null;
  let connectionStatus: ConnectionStatus;

  if (rand < 0.70) {
    latencyMs = 50 + Math.floor(Math.random() * 250);
    statusCode = 200;
    connectionStatus = "healthy";
  } else if (rand < 0.85) {
    latencyMs = 300 + Math.floor(Math.random() * 700);
    statusCode = 200;
    connectionStatus = "healthy";
  } else if (rand < 0.93) {
    latencyMs = 2000 + Math.floor(Math.random() * 5000);
    statusCode = 200;
    connectionStatus = "degraded";
  } else if (rand < 0.97) {
    latencyMs = 1000 + Math.floor(Math.random() * 3000);
    statusCode = 503;
    errorMessage = "Service temporarily unavailable";
    connectionStatus = "degraded";
  } else {
    latencyMs = 10000;
    statusCode = 0;
    errorMessage = "Connection timeout (10s)";
    connectionStatus = "critical";
  }

  return { latencyMs, statusCode, errorMessage, connectionStatus };
}

class NetworkHealthService {
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private useDemoMode = !process.env.NETWORK_HEALTH_LIVE_CHECKS;

  async initialize() {
    await this.seedEndpoints();
    this.startScheduler();
    console.log(`[NetworkHealth] Service initialized with ${PARTNER_ENDPOINTS.length} endpoints (${CHECK_INTERVAL_MS / 1000}s interval)`);
  }

  private async seedEndpoints() {
    try {
      for (const ep of PARTNER_ENDPOINTS) {
        const existing = await db
          .select()
          .from(networkHealthChecks)
          .where(eq(networkHealthChecks.endpointId, ep.endpointId))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(networkHealthChecks).values({
            endpointId: ep.endpointId,
            endpointName: ep.endpointName,
            networkId: ep.networkId,
            networkName: ep.networkName,
            networkType: ep.networkType,
            baseUrl: ep.baseUrl,
            connectionStatus: "unknown",
            consecutiveFailures: 0,
          });
        }
      }
    } catch (err: any) {
      console.error("[NetworkHealth] Seed error:", err.message);
    }
  }

  startScheduler() {
    if (this.checkInterval) return;
    this.checkInterval = setInterval(() => this.runHealthChecks(), CHECK_INTERVAL_MS);
    setTimeout(() => this.runHealthChecks(), 5000);
  }

  stopScheduler() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  async runHealthChecks() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const endpoints = await db.select().from(networkHealthChecks);
      let healthyCount = 0;
      let degradedCount = 0;
      let criticalCount = 0;

      for (const ep of endpoints) {
        const endpointDef = PARTNER_ENDPOINTS.find((p) => p.endpointId === ep.endpointId);
        if (!endpointDef) continue;

        let result;
        if (this.useDemoMode) {
          result = simulateHealthCheck(endpointDef);
        } else {
          result = await pingEndpoint(endpointDef);
        }

        const prevFailures = ep.consecutiveFailures;
        const newFailures = result.connectionStatus === "critical" ? prevFailures + 1 : 0;

        await db
          .update(networkHealthChecks)
          .set({
            connectionStatus: result.connectionStatus,
            latencyMs: result.latencyMs,
            statusCode: result.statusCode,
            errorMessage: result.errorMessage,
            lastCheckedAt: new Date(),
            consecutiveFailures: newFailures,
            updatedAt: new Date(),
          })
          .where(eq(networkHealthChecks.endpointId, ep.endpointId));

        if (result.connectionStatus === "healthy") healthyCount++;
        else if (result.connectionStatus === "degraded") degradedCount++;
        else if (result.connectionStatus === "critical") criticalCount++;

        if (
          newFailures >= CRITICAL_FAILURE_THRESHOLD &&
          prevFailures < CRITICAL_FAILURE_THRESHOLD
        ) {
          await this.sendCriticalAlert(ep.endpointName, ep.networkName, result.errorMessage || "Unknown failure", newFailures);
          await db
            .update(networkHealthChecks)
            .set({ alertSentAt: new Date() })
            .where(eq(networkHealthChecks.endpointId, ep.endpointId));
        }
      }

      if (criticalCount > 0 || degradedCount > 0) {
        console.log(
          `[NetworkHealth] Check complete: ${healthyCount} healthy, ${degradedCount} degraded, ${criticalCount} critical`
        );
      }
    } catch (err: any) {
      console.error("[NetworkHealth] Health check error:", err.message);
    } finally {
      this.isRunning = false;
    }
  }

  private async sendCriticalAlert(
    endpointName: string,
    networkName: string,
    errorMessage: string,
    failureCount: number
  ) {
    const alertPayload = {
      to: "ops@tabulamedica.health",
      subject: `[CRITICAL] Network Health Alert: ${endpointName} (${networkName})`,
      body: [
        `CRITICAL NETWORK HEALTH ALERT`,
        ``,
        `Endpoint: ${endpointName}`,
        `Network: ${networkName}`,
        `Consecutive Failures: ${failureCount}`,
        `Error: ${errorMessage}`,
        `Time: ${new Date().toISOString()}`,
        ``,
        `This endpoint has failed ${failureCount} consecutive health checks.`,
        `Immediate investigation is recommended.`,
        ``,
        `— Tabula Medica Network Health Monitor`,
      ].join("\n"),
    };

    logger.warn(
      `[NetworkHealth] CRITICAL ALERT for ${endpointName}: ${errorMessage} (${failureCount} consecutive failures)`
    );
    logger.info(`[NetworkHealth Email] Would send to ${alertPayload.to}: ${alertPayload.subject}`);
    logger.info(`[NetworkHealth Email] Body preview: ${alertPayload.body.substring(0, 200)}...`);
  }

  async getHealthDashboard(): Promise<{
    endpoints: any[];
    summary: {
      total: number;
      healthy: number;
      degraded: number;
      critical: number;
      unknown: number;
      averageLatencyMs: number;
      lastCheckTime: string | null;
    };
  }> {
    const endpoints = await db
      .select()
      .from(networkHealthChecks)
      .orderBy(
        sql`CASE connection_status WHEN 'critical' THEN 1 WHEN 'degraded' THEN 2 WHEN 'unknown' THEN 3 WHEN 'healthy' THEN 4 END`,
        desc(networkHealthChecks.updatedAt)
      );

    const healthy = endpoints.filter((e) => e.connectionStatus === "healthy").length;
    const degraded = endpoints.filter((e) => e.connectionStatus === "degraded").length;
    const critical = endpoints.filter((e) => e.connectionStatus === "critical").length;
    const unknown = endpoints.filter((e) => e.connectionStatus === "unknown").length;

    const latencies = endpoints.filter((e) => e.latencyMs !== null).map((e) => e.latencyMs!);
    const averageLatencyMs = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

    const lastCheckTime = endpoints.length > 0
      ? endpoints.reduce((latest, e) => {
          const t = new Date(e.lastCheckedAt).getTime();
          return t > new Date(latest).getTime() ? e.lastCheckedAt.toISOString() : latest;
        }, endpoints[0].lastCheckedAt.toISOString())
      : null;

    return {
      endpoints: endpoints.map((e) => ({
        id: e.id,
        endpointId: e.endpointId,
        endpointName: e.endpointName,
        networkId: e.networkId,
        networkName: e.networkName,
        networkType: e.networkType,
        baseUrl: e.baseUrl,
        connectionStatus: e.connectionStatus,
        latencyMs: e.latencyMs,
        statusCode: e.statusCode,
        errorMessage: e.errorMessage,
        lastCheckedAt: e.lastCheckedAt,
        consecutiveFailures: e.consecutiveFailures,
        alertSentAt: e.alertSentAt,
      })),
      summary: {
        total: endpoints.length,
        healthy,
        degraded,
        critical,
        unknown,
        averageLatencyMs,
        lastCheckTime,
      },
    };
  }

  async getEndpointHistory(endpointId: string) {
    const endpoint = await db
      .select()
      .from(networkHealthChecks)
      .where(eq(networkHealthChecks.endpointId, endpointId))
      .limit(1);

    return endpoint[0] || null;
  }

  async triggerManualCheck() {
    await this.runHealthChecks();
    return this.getHealthDashboard();
  }
}

export const networkHealthService = new NetworkHealthService();
