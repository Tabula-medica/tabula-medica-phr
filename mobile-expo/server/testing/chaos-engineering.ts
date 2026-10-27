import { db } from "../db";
import { sql } from "drizzle-orm";

export type ChaosTestType =
  | "database_connection"
  | "database_latency"
  | "database_timeout"
  | "api_error"
  | "memory_pressure"
  | "disk_space"
  | "network_partition";

export interface ChaosTestConfig {
  type: ChaosTestType;
  duration?: number;
  intensity?: "low" | "medium" | "high";
  targetService?: string;
  parameters?: Record<string, unknown>;
}

export interface ChaosTestResult {
  testId: string;
  type: ChaosTestType;
  startTime: Date;
  endTime: Date;
  success: boolean;
  recoveryTimeMs: number;
  errors: string[];
  metrics: ChaosMetrics;
}

export interface ChaosMetrics {
  requestsAttempted: number;
  requestsSucceeded: number;
  requestsFailed: number;
  averageLatencyMs: number;
  maxLatencyMs: number;
  availabilityPercent: number;
}

export interface HealthCheckResult {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs: number;
  lastCheck: Date;
  details?: Record<string, unknown>;
}

class ChaosState {
  private static instance: ChaosState;
  
  private activeTests: Map<string, ChaosTestConfig> = new Map();
  private simulatedLatency: number = 0;
  private simulatedErrorRate: number = 0;
  private connectionPoolExhausted: boolean = false;
  
  static getInstance(): ChaosState {
    if (!ChaosState.instance) {
      ChaosState.instance = new ChaosState();
    }
    return ChaosState.instance;
  }
  
  setLatency(ms: number) {
    this.simulatedLatency = ms;
  }
  
  getLatency(): number {
    return this.simulatedLatency;
  }
  
  setErrorRate(rate: number) {
    this.simulatedErrorRate = rate;
  }
  
  getErrorRate(): number {
    return this.simulatedErrorRate;
  }
  
  setConnectionPoolExhausted(exhausted: boolean) {
    this.connectionPoolExhausted = exhausted;
  }
  
  isConnectionPoolExhausted(): boolean {
    return this.connectionPoolExhausted;
  }
  
  addActiveTest(id: string, config: ChaosTestConfig) {
    this.activeTests.set(id, config);
  }
  
  removeActiveTest(id: string) {
    this.activeTests.delete(id);
  }
  
  getActiveTests(): Map<string, ChaosTestConfig> {
    return this.activeTests;
  }
  
  reset() {
    this.simulatedLatency = 0;
    this.simulatedErrorRate = 0;
    this.connectionPoolExhausted = false;
    this.activeTests.clear();
  }
}

export class ChaosEngineeringService {
  private state = ChaosState.getInstance();

  async runChaosTest(config: ChaosTestConfig): Promise<ChaosTestResult> {
    const testId = crypto.randomUUID();
    const startTime = new Date();
    const errors: string[] = [];
    const metrics: ChaosMetrics = {
      requestsAttempted: 0,
      requestsSucceeded: 0,
      requestsFailed: 0,
      averageLatencyMs: 0,
      maxLatencyMs: 0,
      availabilityPercent: 100,
    };

    this.state.addActiveTest(testId, config);

    try {
      switch (config.type) {
        case "database_connection":
          await this.testDatabaseConnection(config, metrics, errors);
          break;
        case "database_latency":
          await this.testDatabaseLatency(config, metrics, errors);
          break;
        case "database_timeout":
          await this.testDatabaseTimeout(config, metrics, errors);
          break;
        case "api_error":
          await this.testApiErrors(config, metrics, errors);
          break;
        case "memory_pressure":
          await this.testMemoryPressure(config, metrics, errors);
          break;
        default:
          errors.push(`Unsupported chaos test type: ${config.type}`);
      }
    } catch (error) {
      errors.push(`Chaos test failed: ${error}`);
    } finally {
      this.state.removeActiveTest(testId);
    }

    const endTime = new Date();
    const recoveryTimeMs = await this.measureRecoveryTime();

    return {
      testId,
      type: config.type,
      startTime,
      endTime,
      success: errors.length === 0,
      recoveryTimeMs,
      errors,
      metrics,
    };
  }

  private async testDatabaseConnection(
    config: ChaosTestConfig,
    metrics: ChaosMetrics,
    errors: string[]
  ): Promise<void> {
    const iterations = config.intensity === "high" ? 20 : config.intensity === "medium" ? 10 : 5;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      metrics.requestsAttempted++;
      const start = Date.now();

      try {
        await db.execute(sql`SELECT 1`);
        const latency = Date.now() - start;
        latencies.push(latency);
        metrics.requestsSucceeded++;
        metrics.maxLatencyMs = Math.max(metrics.maxLatencyMs, latency);
      } catch (error) {
        metrics.requestsFailed++;
        errors.push(`Connection test ${i + 1} failed: ${error}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (latencies.length > 0) {
      metrics.averageLatencyMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    }
    metrics.availabilityPercent = (metrics.requestsSucceeded / metrics.requestsAttempted) * 100;
  }

  private async testDatabaseLatency(
    config: ChaosTestConfig,
    metrics: ChaosMetrics,
    errors: string[]
  ): Promise<void> {
    const simulatedLatency = 
      config.intensity === "high" ? 2000 :
      config.intensity === "medium" ? 500 : 100;

    const duration = config.duration || 5000;
    const endTime = Date.now() + duration;
    const latencies: number[] = [];

    this.state.setLatency(simulatedLatency);

    try {
      while (Date.now() < endTime) {
        metrics.requestsAttempted++;
        const start = Date.now();

        try {
          await new Promise((resolve) => setTimeout(resolve, simulatedLatency));
          await db.execute(sql`SELECT 1`);
          
          const latency = Date.now() - start;
          latencies.push(latency);
          metrics.requestsSucceeded++;
          metrics.maxLatencyMs = Math.max(metrics.maxLatencyMs, latency);
        } catch (error) {
          metrics.requestsFailed++;
          errors.push(`Latency test failed: ${error}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } finally {
      this.state.setLatency(0);
    }

    if (latencies.length > 0) {
      metrics.averageLatencyMs = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    }
    metrics.availabilityPercent = (metrics.requestsSucceeded / metrics.requestsAttempted) * 100;
  }

  private async testDatabaseTimeout(
    config: ChaosTestConfig,
    metrics: ChaosMetrics,
    errors: string[]
  ): Promise<void> {
    const timeoutMs = config.intensity === "high" ? 100 : config.intensity === "medium" ? 500 : 1000;
    const iterations = 5;

    for (let i = 0; i < iterations; i++) {
      metrics.requestsAttempted++;
      const start = Date.now();

      try {
        const result = await Promise.race([
          db.execute(sql`SELECT pg_sleep(0.5), 1 as result`),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Query timeout")), timeoutMs)
          ),
        ]);
        
        metrics.requestsSucceeded++;
        const latency = Date.now() - start;
        metrics.maxLatencyMs = Math.max(metrics.maxLatencyMs, latency);
      } catch (error) {
        metrics.requestsFailed++;
        if ((error as Error).message === "Query timeout") {
          errors.push(`Query ${i + 1} timed out after ${timeoutMs}ms`);
        } else {
          errors.push(`Query ${i + 1} failed: ${error}`);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    metrics.availabilityPercent = (metrics.requestsSucceeded / metrics.requestsAttempted) * 100;
  }

  private async testApiErrors(
    config: ChaosTestConfig,
    metrics: ChaosMetrics,
    errors: string[]
  ): Promise<void> {
    const errorRate = 
      config.intensity === "high" ? 0.5 :
      config.intensity === "medium" ? 0.25 : 0.1;

    const duration = config.duration || 5000;
    const endTime = Date.now() + duration;

    this.state.setErrorRate(errorRate);

    try {
      while (Date.now() < endTime) {
        metrics.requestsAttempted++;
        
        if (Math.random() < errorRate) {
          metrics.requestsFailed++;
          errors.push(`Simulated API error at ${new Date().toISOString()}`);
        } else {
          metrics.requestsSucceeded++;
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } finally {
      this.state.setErrorRate(0);
    }

    metrics.availabilityPercent = (metrics.requestsSucceeded / metrics.requestsAttempted) * 100;
  }

  private async testMemoryPressure(
    config: ChaosTestConfig,
    metrics: ChaosMetrics,
    errors: string[]
  ): Promise<void> {
    const duration = config.duration || 3000;
    const startMemory = process.memoryUsage();
    
    metrics.requestsAttempted = 1;
    
    try {
      const start = Date.now();
      const arrays: number[][] = [];
      
      const targetSize = 
        config.intensity === "high" ? 50 :
        config.intensity === "medium" ? 20 : 10;
      
      for (let i = 0; i < targetSize; i++) {
        arrays.push(new Array(1024 * 1024).fill(0));
        await new Promise((resolve) => setTimeout(resolve, 50));
        
        if (Date.now() - start > duration) break;
      }

      const endMemory = process.memoryUsage();
      const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
      
      metrics.requestsSucceeded = 1;
      metrics.averageLatencyMs = Date.now() - start;
      
      arrays.length = 0;
      if (global.gc) {
        global.gc();
      }

    } catch (error) {
      metrics.requestsFailed = 1;
      errors.push(`Memory pressure test failed: ${error}`);
    }

    metrics.availabilityPercent = metrics.requestsSucceeded > 0 ? 100 : 0;
  }

  private async measureRecoveryTime(): Promise<number> {
    const start = Date.now();
    const maxAttempts = 10;
    
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await db.execute(sql`SELECT 1`);
        return Date.now() - start;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    
    return Date.now() - start;
  }

  async performHealthCheck(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    const dbStart = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      results.push({
        service: "database",
        status: "healthy",
        latencyMs: Date.now() - dbStart,
        lastCheck: new Date(),
      });
    } catch (error) {
      results.push({
        service: "database",
        status: "unhealthy",
        latencyMs: Date.now() - dbStart,
        lastCheck: new Date(),
        details: { error: String(error) },
      });
    }

    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
    const heapPercent = (heapUsedMB / heapTotalMB) * 100;

    results.push({
      service: "memory",
      status: heapPercent > 90 ? "unhealthy" : heapPercent > 75 ? "degraded" : "healthy",
      latencyMs: 0,
      lastCheck: new Date(),
      details: {
        heapUsedMB: Math.round(heapUsedMB),
        heapTotalMB: Math.round(heapTotalMB),
        heapPercent: Math.round(heapPercent),
      },
    });

    const activeTests = this.state.getActiveTests();
    results.push({
      service: "chaos_state",
      status: activeTests.size > 0 ? "degraded" : "healthy",
      latencyMs: 0,
      lastCheck: new Date(),
      details: {
        activeTests: activeTests.size,
        simulatedLatency: this.state.getLatency(),
        simulatedErrorRate: this.state.getErrorRate(),
      },
    });

    return results;
  }

  async runAvailabilityTest(durationMs: number = 60000): Promise<{
    availability: number;
    totalChecks: number;
    successfulChecks: number;
    failedChecks: number;
    averageLatencyMs: number;
    p99LatencyMs: number;
  }> {
    const endTime = Date.now() + durationMs;
    const latencies: number[] = [];
    let successfulChecks = 0;
    let failedChecks = 0;

    while (Date.now() < endTime) {
      const start = Date.now();
      try {
        await db.execute(sql`SELECT 1`);
        successfulChecks++;
        latencies.push(Date.now() - start);
      } catch {
        failedChecks++;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    latencies.sort((a, b) => a - b);
    const p99Index = Math.floor(latencies.length * 0.99);

    return {
      availability: (successfulChecks / (successfulChecks + failedChecks)) * 100,
      totalChecks: successfulChecks + failedChecks,
      successfulChecks,
      failedChecks,
      averageLatencyMs: latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0,
      p99LatencyMs: latencies[p99Index] || 0,
    };
  }

  getActiveTests(): { id: string; config: ChaosTestConfig }[] {
    return Array.from(this.state.getActiveTests().entries()).map(([id, config]) => ({
      id,
      config,
    }));
  }

  reset(): void {
    this.state.reset();
  }
}

export const chaosEngineeringService = new ChaosEngineeringService();
