import type {
  IFhirStore,
  IAnalyticsStore,
  IRiskModel,
  IAuditLogger,
  IntegrationConfig,
  IntegrationHealthStatus,
} from "./interfaces";
import { getIntegrationConfig, logConfigurationStatus } from "../gcp/config";
import { MockFhirStore } from "../gcp/mockFhirStore";
import { CloudHealthcareApiFhirStore } from "../gcp/cloudHealthcareApi";
import { AidboxFhirStore } from "../gcp/aidboxStore";
import { BigQueryAnalyticsStore, MockAnalyticsStore } from "../gcp/bigQueryAnalytics";
import { VertexAiRiskModel, MockRiskModel } from "../gcp/vertexAiModel";
import { createAuditLogger } from "../gcp/auditLogger";

class IntegrationManager {
  private static instance: IntegrationManager | null = null;
  private config: IntegrationConfig;
  private fhirStore: IFhirStore | null = null;
  private analyticsStore: IAnalyticsStore | null = null;
  private riskModel: IRiskModel | null = null;
  private auditLogger: IAuditLogger | null = null;
  private initialized = false;

  private constructor() {
    this.config = getIntegrationConfig();
  }

  static getInstance(): IntegrationManager {
    if (!IntegrationManager.instance) {
      IntegrationManager.instance = new IntegrationManager();
    }
    return IntegrationManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logConfigurationStatus();

    try {
      this.fhirStore = this.createFhirStore();
      await this.fhirStore.connect();
      console.log(`[IntegrationManager] FHIR store initialized: ${this.fhirStore.providerName}`);
    } catch (error) {
      console.error("[IntegrationManager] FHIR store initialization failed, falling back to mock:", error);
      this.fhirStore = new MockFhirStore();
      await this.fhirStore.connect();
    }

    try {
      this.analyticsStore = this.createAnalyticsStore();
      await this.analyticsStore.connect();
      console.log(`[IntegrationManager] Analytics store initialized: ${this.analyticsStore.providerName}`);
    } catch (error) {
      console.error("[IntegrationManager] Analytics store initialization failed, falling back to mock:", error);
      this.analyticsStore = new MockAnalyticsStore();
      await this.analyticsStore.connect();
    }

    try {
      this.riskModel = this.createRiskModel();
      await this.riskModel.connect();
      console.log(`[IntegrationManager] Risk model initialized: ${this.riskModel.providerName}`);
    } catch (error) {
      console.error("[IntegrationManager] Risk model initialization failed, falling back to mock:", error);
      this.riskModel = new MockRiskModel();
      await this.riskModel.connect();
    }

    this.auditLogger = createAuditLogger(this.config);
    console.log(`[IntegrationManager] Audit logger initialized: ${this.auditLogger.providerName}`);

    this.initialized = true;
    console.log("[IntegrationManager] All integrations initialized successfully");
  }

  private createFhirStore(): IFhirStore {
    switch (this.config.fhirProvider) {
      case "cloud_healthcare_api":
        return new CloudHealthcareApiFhirStore(this.config);
      case "aidbox":
        return new AidboxFhirStore(this.config);
      case "mock":
      default:
        return new MockFhirStore();
    }
  }

  private createAnalyticsStore(): IAnalyticsStore {
    switch (this.config.analyticsProvider) {
      case "bigquery":
        return new BigQueryAnalyticsStore(this.config);
      case "mock":
      default:
        return new MockAnalyticsStore();
    }
  }

  private createRiskModel(): IRiskModel {
    switch (this.config.riskModelProvider) {
      case "vertex_ai":
        return new VertexAiRiskModel(this.config);
      case "mock":
      default:
        return new MockRiskModel();
    }
  }

  getFhirStore(): IFhirStore {
    if (!this.fhirStore) {
      throw new Error("Integration manager not initialized");
    }
    return this.fhirStore;
  }

  getAnalyticsStore(): IAnalyticsStore {
    if (!this.analyticsStore) {
      throw new Error("Integration manager not initialized");
    }
    return this.analyticsStore;
  }

  getRiskModel(): IRiskModel {
    if (!this.riskModel) {
      throw new Error("Integration manager not initialized");
    }
    return this.riskModel;
  }

  getAuditLogger(): IAuditLogger {
    if (!this.auditLogger) {
      throw new Error("Integration manager not initialized");
    }
    return this.auditLogger;
  }

  getConfig(): IntegrationConfig {
    return this.config;
  }

  async getHealthStatus(): Promise<IntegrationHealthStatus> {
    const [fhirHealth, analyticsHealth, riskHealth] = await Promise.all([
      this.fhirStore?.healthCheck() || { status: "unhealthy" as const, latencyMs: 0 },
      this.analyticsStore?.healthCheck() || { status: "unhealthy" as const, latencyMs: 0 },
      this.riskModel?.healthCheck() || { status: "unhealthy" as const, latencyMs: 0 },
    ]);

    const allHealthy =
      fhirHealth.status === "healthy" &&
      analyticsHealth.status === "healthy" &&
      riskHealth.status === "healthy";

    const anyHealthy =
      fhirHealth.status === "healthy" ||
      analyticsHealth.status === "healthy" ||
      riskHealth.status === "healthy";

    return {
      overall: allHealthy ? "healthy" : anyHealthy ? "degraded" : "unhealthy",
      fhirStore: {
        status: fhirHealth.status,
        latencyMs: fhirHealth.latencyMs,
        provider: this.fhirStore?.providerName || "unknown",
      },
      analytics: {
        status: analyticsHealth.status,
        latencyMs: analyticsHealth.latencyMs,
        provider: this.analyticsStore?.providerName || "unknown",
      },
      riskModel: {
        status: riskHealth.status,
        latencyMs: riskHealth.latencyMs,
        provider: this.riskModel?.providerName || "unknown",
      },
      audit: {
        status: "healthy",
        provider: this.auditLogger?.providerName || "unknown",
      },
      lastChecked: new Date().toISOString(),
    };
  }

  async shutdown(): Promise<void> {
    if (this.fhirStore?.isConnected) {
      await this.fhirStore.disconnect();
    }
    if (this.analyticsStore?.isConnected) {
      await this.analyticsStore.disconnect();
    }
    if (this.riskModel?.isConnected) {
      await this.riskModel.disconnect();
    }
    this.initialized = false;
    console.log("[IntegrationManager] All integrations shut down");
  }
}

export const integrationManager = IntegrationManager.getInstance();

export function getFhirStore(): IFhirStore {
  return integrationManager.getFhirStore();
}

export function getAnalyticsStore(): IAnalyticsStore {
  return integrationManager.getAnalyticsStore();
}

export function getRiskModel(): IRiskModel {
  return integrationManager.getRiskModel();
}

export function getAuditLogger(): IAuditLogger {
  return integrationManager.getAuditLogger();
}

export async function initializeIntegrations(): Promise<void> {
  await integrationManager.initialize();
}

export async function getIntegrationHealthStatus(): Promise<IntegrationHealthStatus> {
  return integrationManager.getHealthStatus();
}
