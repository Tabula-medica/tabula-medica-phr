import type {
  IAnalyticsStore,
  AnalyticsQuery,
  AnalyticsResult,
  PopulationHealthMetrics,
  CohortDefinition,
  IntegrationConfig,
} from "../integrations/interfaces";
import { BigQuery } from "@google-cloud/bigquery";

export class BigQueryAnalyticsStore implements IAnalyticsStore {
  readonly providerName = "bigquery";
  private _isConnected = false;
  private client: BigQuery | null = null;
  private datasetId: string;
  private config: IntegrationConfig;

  constructor(config: IntegrationConfig) {
    this.config = config;
    this.datasetId = config.gcp?.bigQueryDataset || "healthcare_analytics";
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(): Promise<void> {
    try {
      this.client = new BigQuery({
        projectId: this.config.gcp?.projectId,
        ...(this.config.gcp?.credentialsPath && {
          keyFilename: this.config.gcp.credentialsPath,
        }),
      });

      await this.client.dataset(this.datasetId).get();
      this._isConnected = true;
      console.log(`[BigQuery] Connected to dataset: ${this.datasetId}`);
    } catch (error: any) {
      if (error.code === 404) {
        console.log(`[BigQuery] Dataset ${this.datasetId} not found, creating...`);
        await this.client?.createDataset(this.datasetId);
        this._isConnected = true;
        console.log(`[BigQuery] Created dataset: ${this.datasetId}`);
      } else {
        console.error("[BigQuery] Connection failed:", error);
        throw error;
      }
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this._isConnected = false;
    console.log("[BigQuery] Disconnected");
  }

  async healthCheck(): Promise<{ status: "healthy" | "unhealthy"; latencyMs: number; message?: string }> {
    const start = Date.now();
    try {
      if (!this.client) {
        return { status: "unhealthy", latencyMs: 0, message: "Client not initialized" };
      }

      await this.client.query("SELECT 1");
      return {
        status: "healthy",
        latencyMs: Date.now() - start,
        message: "BigQuery is accessible",
      };
    } catch (error: any) {
      return {
        status: "unhealthy",
        latencyMs: Date.now() - start,
        message: error.message || "Health check failed",
      };
    }
  }

  async query(query: AnalyticsQuery): Promise<AnalyticsResult> {
    if (!this.client) throw new Error("Not connected");

    const start = Date.now();

    let sql: string;
    if (query.sql) {
      sql = query.sql;
    } else if (query.table) {
      const columns = query.columns?.join(", ") || "*";
      sql = `SELECT ${columns} FROM \`${this.datasetId}.${query.table}\``;

      if (query.filters && Object.keys(query.filters).length > 0) {
        const conditions = Object.entries(query.filters)
          .map(([key, value]) => `${key} = @${key}`)
          .join(" AND ");
        sql += ` WHERE ${conditions}`;
      }

      if (query.groupBy?.length) {
        sql += ` GROUP BY ${query.groupBy.join(", ")}`;
      }

      if (query.orderBy) {
        sql += ` ORDER BY ${query.orderBy}`;
      }

      if (query.limit) {
        sql += ` LIMIT ${query.limit}`;
      }

      if (query.offset) {
        sql += ` OFFSET ${query.offset}`;
      }
    } else {
      throw new Error("Query must have either sql or table specified");
    }

    const options: any = {
      query: sql,
      params: query.filters || {},
    };

    const [job] = await this.client.createQueryJob(options);
    const [rows] = await job.getQueryResults();
    const metadata = await job.getMetadata();

    return {
      rows: rows as Record<string, unknown>[],
      totalRows: rows.length,
      executionTimeMs: Date.now() - start,
      bytesProcessed: Number(metadata[0]?.statistics?.query?.totalBytesProcessed || 0),
      cacheHit: metadata[0]?.statistics?.query?.cacheHit || false,
    };
  }

  async getPopulationHealthMetrics(cohortId?: string): Promise<PopulationHealthMetrics> {
    if (!this.client) throw new Error("Not connected");

    const metricsQuery = `
      SELECT 
        COUNT(DISTINCT patient_id) as total_patients,
        AVG(age) as avg_age
      FROM \`${this.datasetId}.patients\`
    `;

    try {
      const [rows] = await this.client.query(metricsQuery);
      const row = rows[0] || {};

      return {
        totalPatients: Number(row.total_patients) || 0,
        avgAge: Number(row.avg_age) || 0,
        genderDistribution: {},
        topConditions: [],
        topMedications: [],
        riskDistribution: {},
        adherenceRate: 0,
        readmissionRate: 0,
      };
    } catch (error) {
      return {
        totalPatients: 0,
        avgAge: 0,
        genderDistribution: {},
        topConditions: [],
        topMedications: [],
        riskDistribution: {},
        adherenceRate: 0,
        readmissionRate: 0,
      };
    }
  }

  async getCohort(definition: CohortDefinition): Promise<string[]> {
    if (!this.client) throw new Error("Not connected");

    const conditions: string[] = [];

    if (definition.criteria.ageRange) {
      if (definition.criteria.ageRange.min !== undefined) {
        conditions.push(`age >= ${definition.criteria.ageRange.min}`);
      }
      if (definition.criteria.ageRange.max !== undefined) {
        conditions.push(`age <= ${definition.criteria.ageRange.max}`);
      }
    }

    if (definition.criteria.gender?.length) {
      const genders = definition.criteria.gender.map((g) => `'${g}'`).join(",");
      conditions.push(`gender IN (${genders})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `SELECT patient_id FROM \`${this.datasetId}.patients\` ${whereClause}`;

    try {
      const [rows] = await this.client.query(sql);
      return rows.map((r: any) => String(r.patient_id));
    } catch (error) {
      return [];
    }
  }

  async insertData(table: string, rows: Record<string, unknown>[]): Promise<{ insertedCount: number }> {
    if (!this.client) throw new Error("Not connected");

    const tableRef = this.client.dataset(this.datasetId).table(table);
    await tableRef.insert(rows);

    return { insertedCount: rows.length };
  }

  async createTable(
    table: string,
    schema: Array<{ name: string; type: string; mode?: string }>
  ): Promise<boolean> {
    if (!this.client) throw new Error("Not connected");

    const options = {
      schema: schema.map((f) => ({
        name: f.name,
        type: f.type.toUpperCase(),
        mode: f.mode || "NULLABLE",
      })),
    };

    await this.client.dataset(this.datasetId).createTable(table, options);
    return true;
  }

  async getLabTrends(patientId: string, labCodes: string[], months: number): Promise<AnalyticsResult> {
    const sql = `
      SELECT 
        code,
        DATE_TRUNC(effective_date, MONTH) as month,
        AVG(value) as avg_value,
        MIN(value) as min_value,
        MAX(value) as max_value
      FROM \`${this.datasetId}.observations\`
      WHERE patient_id = @patientId
        AND code IN UNNEST(@labCodes)
        AND effective_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @months MONTH)
      GROUP BY code, month
      ORDER BY month
    `;

    return this.query({
      sql,
      filters: { patientId, labCodes, months },
    });
  }

  async getVitalTrends(patientId: string, vitalTypes: string[], months: number): Promise<AnalyticsResult> {
    const sql = `
      SELECT 
        code,
        DATE_TRUNC(effective_date, WEEK) as week,
        AVG(value) as avg_value
      FROM \`${this.datasetId}.observations\`
      WHERE patient_id = @patientId
        AND category = 'vital-signs'
        AND code IN UNNEST(@vitalTypes)
        AND effective_date >= DATE_SUB(CURRENT_DATE(), INTERVAL @months MONTH)
      GROUP BY code, week
      ORDER BY week
    `;

    return this.query({
      sql,
      filters: { patientId, vitalTypes, months },
    });
  }

  async getAdherenceTrends(patientId: string, months: number): Promise<AnalyticsResult> {
    const sql = `
      SELECT 
        DATE_TRUNC(date, WEEK) as week,
        AVG(adherence_rate) as avg_adherence
      FROM \`${this.datasetId}.medication_adherence\`
      WHERE patient_id = @patientId
        AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL @months MONTH)
      GROUP BY week
      ORDER BY week
    `;

    return this.query({
      sql,
      filters: { patientId, months },
    });
  }

  async getMedicationSafetyMetrics(): Promise<AnalyticsResult> {
    const sql = `
      SELECT 
        COUNT(*) as total_interactions,
        COUNTIF(severity = 'contraindicated') as contraindicated,
        COUNTIF(severity = 'serious') as serious,
        COUNTIF(severity = 'moderate') as moderate,
        COUNTIF(severity = 'minor') as minor
      FROM \`${this.datasetId}.drug_interactions\`
      WHERE detected_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    `;

    return this.query({ sql });
  }
}

export class MockAnalyticsStore implements IAnalyticsStore {
  readonly providerName = "mock";
  private _isConnected = false;

  get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(): Promise<void> {
    this._isConnected = true;
    console.log("[MockAnalyticsStore] Connected");
  }

  async disconnect(): Promise<void> {
    this._isConnected = false;
    console.log("[MockAnalyticsStore] Disconnected");
  }

  async healthCheck(): Promise<{ status: "healthy" | "unhealthy"; latencyMs: number; message?: string }> {
    return { status: "healthy", latencyMs: 5, message: "Mock analytics store" };
  }

  async query(_query: AnalyticsQuery): Promise<AnalyticsResult> {
    return { rows: [], totalRows: 0, executionTimeMs: 5, cacheHit: true };
  }

  async getPopulationHealthMetrics(_cohortId?: string): Promise<PopulationHealthMetrics> {
    return {
      totalPatients: 1250,
      avgAge: 52.3,
      genderDistribution: { male: 580, female: 670 },
      topConditions: [
        { code: "38341003", display: "Hypertension", count: 425 },
        { code: "73211009", display: "Diabetes mellitus", count: 312 },
        { code: "53741008", display: "Coronary heart disease", count: 198 },
      ],
      topMedications: [
        { code: "310965", display: "Lisinopril", count: 380 },
        { code: "200345", display: "Metformin", count: 290 },
        { code: "429503", display: "Atorvastatin", count: 275 },
      ],
      riskDistribution: { low: 450, moderate: 520, high: 220, critical: 60 },
      adherenceRate: 78.5,
      readmissionRate: 12.3,
    };
  }

  async getCohort(_definition: CohortDefinition): Promise<string[]> {
    return ["patient-1", "patient-2", "patient-3"];
  }

  async insertData(_table: string, rows: Record<string, unknown>[]): Promise<{ insertedCount: number }> {
    return { insertedCount: rows.length };
  }

  async createTable(_table: string, _schema: Array<{ name: string; type: string; mode?: string }>): Promise<boolean> {
    return true;
  }

  async getLabTrends(_patientId: string, _labCodes: string[], _months: number): Promise<AnalyticsResult> {
    return {
      rows: [
        { code: "2093-3", month: "2024-01", avg_value: 185 },
        { code: "2093-3", month: "2024-02", avg_value: 178 },
        { code: "2093-3", month: "2024-03", avg_value: 172 },
      ],
      totalRows: 3,
      executionTimeMs: 10,
    };
  }

  async getVitalTrends(_patientId: string, _vitalTypes: string[], _months: number): Promise<AnalyticsResult> {
    return {
      rows: [
        { code: "8867-4", week: "2024-01-01", avg_value: 72 },
        { code: "8867-4", week: "2024-01-08", avg_value: 74 },
      ],
      totalRows: 2,
      executionTimeMs: 8,
    };
  }

  async getAdherenceTrends(_patientId: string, _months: number): Promise<AnalyticsResult> {
    return {
      rows: [
        { week: "2024-01-01", avg_adherence: 85 },
        { week: "2024-01-08", avg_adherence: 82 },
      ],
      totalRows: 2,
      executionTimeMs: 6,
    };
  }

  async getMedicationSafetyMetrics(): Promise<AnalyticsResult> {
    return {
      rows: [{ total_interactions: 45, contraindicated: 2, serious: 8, moderate: 25, minor: 10 }],
      totalRows: 1,
      executionTimeMs: 5,
    };
  }
}
