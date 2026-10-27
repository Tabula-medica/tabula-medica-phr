import * as crypto from "crypto";

export interface BenchmarkDataPoint {
  metricName: string;
  value: number;
  unit: string;
  percentile: number;
  referenceRange: { low: number; high: number };
  populationMean: number;
  populationMedian: number;
  standardDeviation: number;
  ageGroup: string;
  gender: string;
  ethnicity: string;
}

export interface BenchmarkComparison {
  patientValue: number;
  benchmarkData: BenchmarkDataPoint;
  trend: "above_average" | "below_average" | "within_normal" | "critical_high" | "critical_low";
  zScore: number;
  percentileRank: number;
  clinicalSignificance: string;
}

export interface PopulationCohort {
  id: string;
  name: string;
  criteria: {
    ageRange: { min: number; max: number };
    gender: string;
    conditions: string[];
    region: string;
  };
  sampleSize: number;
  lastUpdated: string;
}

export interface BenchmarkCategory {
  id: string;
  name: string;
  metrics: string[];
  description: string;
}

export interface TrendPoint {
  date: string;
  patientValue: number;
  benchmarkMean: number;
  percentile: number;
}

type RiskLevel = "low" | "moderate" | "high" | "critical";
type ChartType = "line_chart" | "bar_chart" | "histogram" | "box_plot" | "radar_chart";

interface MetricDefinition {
  metricName: string;
  unit: string;
  populationMean: number;
  populationMedian: number;
  standardDeviation: number;
  referenceRange: { low: number; high: number };
  category: string;
}

class PopulationBenchmarksService {
  private metrics: Map<string, MetricDefinition> = new Map();
  private cohorts: PopulationCohort[] = [];
  private categories: BenchmarkCategory[] = [];
  private initialized = false;

  constructor() {
    this.seedData();
  }

  private seedData(): void {
    console.log("[Benchmarks] Seeding population benchmark data...");

    this.categories = [
      {
        id: "vitals",
        name: "Vitals",
        metrics: ["systolic_bp", "diastolic_bp", "heart_rate", "respiratory_rate", "temperature", "bmi", "spo2"],
        description: "Core vital signs and body measurements",
      },
      {
        id: "labs",
        name: "Laboratory Results",
        metrics: [
          "glucose_fasting", "hba1c", "total_cholesterol", "ldl", "hdl",
          "triglycerides", "creatinine", "egfr", "tsh", "hemoglobin", "wbc", "platelets",
        ],
        description: "Common laboratory test results and blood work",
      },
      {
        id: "biometrics",
        name: "Biometrics",
        metrics: ["bmi", "heart_rate", "spo2"],
        description: "Body composition and biometric measurements",
      },
      {
        id: "screening",
        name: "Screening",
        metrics: ["psa", "mammography_birads", "colonoscopy_interval"],
        description: "Preventive screening test results and intervals",
      },
    ];

    const metricDefs: MetricDefinition[] = [
      { metricName: "systolic_bp", unit: "mmHg", populationMean: 120, populationMedian: 118, standardDeviation: 15, referenceRange: { low: 90, high: 140 }, category: "vitals" },
      { metricName: "diastolic_bp", unit: "mmHg", populationMean: 80, populationMedian: 78, standardDeviation: 10, referenceRange: { low: 60, high: 90 }, category: "vitals" },
      { metricName: "heart_rate", unit: "bpm", populationMean: 72, populationMedian: 72, standardDeviation: 12, referenceRange: { low: 60, high: 100 }, category: "vitals" },
      { metricName: "respiratory_rate", unit: "breaths/min", populationMean: 16, populationMedian: 16, standardDeviation: 3, referenceRange: { low: 12, high: 20 }, category: "vitals" },
      { metricName: "temperature", unit: "°F", populationMean: 98.6, populationMedian: 98.6, standardDeviation: 0.5, referenceRange: { low: 97.0, high: 99.5 }, category: "vitals" },
      { metricName: "bmi", unit: "kg/m²", populationMean: 25.0, populationMedian: 24.5, standardDeviation: 4.5, referenceRange: { low: 18.5, high: 30.0 }, category: "vitals" },
      { metricName: "spo2", unit: "%", populationMean: 97, populationMedian: 97, standardDeviation: 1.5, referenceRange: { low: 95, high: 100 }, category: "vitals" },
      { metricName: "glucose_fasting", unit: "mg/dL", populationMean: 99, populationMedian: 95, standardDeviation: 15, referenceRange: { low: 70, high: 100 }, category: "labs" },
      { metricName: "hba1c", unit: "%", populationMean: 5.7, populationMedian: 5.5, standardDeviation: 0.5, referenceRange: { low: 4.0, high: 5.7 }, category: "labs" },
      { metricName: "total_cholesterol", unit: "mg/dL", populationMean: 200, populationMedian: 197, standardDeviation: 35, referenceRange: { low: 125, high: 200 }, category: "labs" },
      { metricName: "ldl", unit: "mg/dL", populationMean: 100, populationMedian: 98, standardDeviation: 30, referenceRange: { low: 0, high: 100 }, category: "labs" },
      { metricName: "hdl", unit: "mg/dL", populationMean: 60, populationMedian: 58, standardDeviation: 15, referenceRange: { low: 40, high: 90 }, category: "labs" },
      { metricName: "triglycerides", unit: "mg/dL", populationMean: 150, populationMedian: 140, standardDeviation: 50, referenceRange: { low: 0, high: 150 }, category: "labs" },
      { metricName: "creatinine", unit: "mg/dL", populationMean: 1.0, populationMedian: 0.95, standardDeviation: 0.2, referenceRange: { low: 0.6, high: 1.2 }, category: "labs" },
      { metricName: "egfr", unit: "mL/min/1.73m²", populationMean: 90, populationMedian: 92, standardDeviation: 15, referenceRange: { low: 60, high: 120 }, category: "labs" },
      { metricName: "tsh", unit: "mIU/L", populationMean: 2.5, populationMedian: 2.3, standardDeviation: 1.0, referenceRange: { low: 0.4, high: 4.0 }, category: "labs" },
      { metricName: "hemoglobin", unit: "g/dL", populationMean: 14, populationMedian: 14.2, standardDeviation: 1.5, referenceRange: { low: 12.0, high: 17.5 }, category: "labs" },
      { metricName: "wbc", unit: "x10³/µL", populationMean: 7.5, populationMedian: 7.2, standardDeviation: 2.0, referenceRange: { low: 4.5, high: 11.0 }, category: "labs" },
      { metricName: "platelets", unit: "x10³/µL", populationMean: 250, populationMedian: 245, standardDeviation: 60, referenceRange: { low: 150, high: 400 }, category: "labs" },
      { metricName: "psa", unit: "ng/mL", populationMean: 1.0, populationMedian: 0.8, standardDeviation: 0.7, referenceRange: { low: 0, high: 4.0 }, category: "screening" },
      { metricName: "mammography_birads", unit: "score", populationMean: 2, populationMedian: 2, standardDeviation: 0.8, referenceRange: { low: 1, high: 3 }, category: "screening" },
      { metricName: "colonoscopy_interval", unit: "years", populationMean: 10, populationMedian: 10, standardDeviation: 2, referenceRange: { low: 5, high: 10 }, category: "screening" },
    ];

    for (const def of metricDefs) {
      this.metrics.set(def.metricName, def);
    }

    this.cohorts = [
      {
        id: crypto.randomUUID(),
        name: "General Adult",
        criteria: { ageRange: { min: 18, max: 65 }, gender: "all", conditions: [], region: "national" },
        sampleSize: 50000,
        lastUpdated: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: "Senior",
        criteria: { ageRange: { min: 65, max: 120 }, gender: "all", conditions: [], region: "national" },
        sampleSize: 25000,
        lastUpdated: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: "Pediatric",
        criteria: { ageRange: { min: 0, max: 17 }, gender: "all", conditions: [], region: "national" },
        sampleSize: 30000,
        lastUpdated: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: "Male Adult",
        criteria: { ageRange: { min: 18, max: 65 }, gender: "male", conditions: [], region: "national" },
        sampleSize: 24000,
        lastUpdated: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: "Female Adult",
        criteria: { ageRange: { min: 18, max: 65 }, gender: "female", conditions: [], region: "national" },
        sampleSize: 26000,
        lastUpdated: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: "Diabetic",
        criteria: { ageRange: { min: 18, max: 120 }, gender: "all", conditions: ["diabetes_type2", "diabetes_type1"], region: "national" },
        sampleSize: 15000,
        lastUpdated: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: "Cardiovascular Risk",
        criteria: { ageRange: { min: 30, max: 120 }, gender: "all", conditions: ["hypertension", "hyperlipidemia", "coronary_artery_disease"], region: "national" },
        sampleSize: 18000,
        lastUpdated: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        name: "Prenatal",
        criteria: { ageRange: { min: 15, max: 50 }, gender: "female", conditions: ["pregnancy"], region: "national" },
        sampleSize: 12000,
        lastUpdated: new Date().toISOString(),
      },
    ];

    this.initialized = true;
    console.log(`[Benchmarks] Seeded ${this.metrics.size} metrics, ${this.cohorts.length} cohorts, ${this.categories.length} categories`);
  }

  getAvailableBenchmarks(): BenchmarkCategory[] {
    console.log("[Benchmarks] Retrieving available benchmark categories");
    return this.categories;
  }

  comparePatientMetric(
    metricName: string,
    patientValue: number,
    cohortCriteria?: { ageGroup?: string; gender?: string; ethnicity?: string }
  ): BenchmarkComparison | null {
    console.log(`[Benchmarks] Comparing patient metric: ${metricName} = ${patientValue}`);
    const metric = this.metrics.get(metricName);
    if (!metric) {
      console.log(`[Benchmarks] Metric not found: ${metricName}`);
      return null;
    }

    const zScore = (patientValue - metric.populationMean) / metric.standardDeviation;
    const percentileRank = this.zScoreToPercentile(zScore);
    const trend = this.determineTrend(patientValue, metric);
    const clinicalSignificance = this.determineClinicalSignificance(zScore, trend, metricName);

    const benchmarkData: BenchmarkDataPoint = {
      metricName: metric.metricName,
      value: metric.populationMean,
      unit: metric.unit,
      percentile: 50,
      referenceRange: metric.referenceRange,
      populationMean: metric.populationMean,
      populationMedian: metric.populationMedian,
      standardDeviation: metric.standardDeviation,
      ageGroup: cohortCriteria?.ageGroup || "18-65",
      gender: cohortCriteria?.gender || "all",
      ethnicity: cohortCriteria?.ethnicity || "all",
    };

    return {
      patientValue,
      benchmarkData,
      trend,
      zScore: Math.round(zScore * 100) / 100,
      percentileRank: Math.round(percentileRank * 10) / 10,
      clinicalSignificance,
    };
  }

  comparePatientProfile(
    userId: string,
    metrics: Array<{ name: string; value: number }>
  ): BenchmarkComparison[] {
    console.log(`[Benchmarks] Comparing patient profile for user: ${userId}, ${metrics.length} metrics`);
    const results: BenchmarkComparison[] = [];

    for (const m of metrics) {
      const comparison = this.comparePatientMetric(m.name, m.value);
      if (comparison) {
        results.push(comparison);
      }
    }

    console.log(`[Benchmarks] Profile comparison complete: ${results.length} metrics compared`);
    return results;
  }

  getMetricTrend(
    metricName: string,
    patientValues: Array<{ date: string; value: number }>,
    cohortCriteria?: { ageGroup?: string; gender?: string }
  ): TrendPoint[] {
    console.log(`[Benchmarks] Generating metric trend for: ${metricName}, ${patientValues.length} data points`);
    const metric = this.metrics.get(metricName);
    if (!metric) {
      console.log(`[Benchmarks] Metric not found for trend: ${metricName}`);
      return [];
    }

    return patientValues.map((pv) => {
      const zScore = (pv.value - metric.populationMean) / metric.standardDeviation;
      const percentile = this.zScoreToPercentile(zScore);
      return {
        date: pv.date,
        patientValue: pv.value,
        benchmarkMean: metric.populationMean,
        percentile: Math.round(percentile * 10) / 10,
      };
    });
  }

  getPercentileDistribution(
    metricName: string,
    cohortCriteria?: { ageGroup?: string; gender?: string }
  ): { percentile: number; value: number }[] {
    console.log(`[Benchmarks] Generating percentile distribution for: ${metricName}`);
    const metric = this.metrics.get(metricName);
    if (!metric) {
      return [];
    }

    const distribution: { percentile: number; value: number }[] = [];
    const percentiles = [1, 5, 10, 25, 50, 75, 90, 95, 99];

    for (const p of percentiles) {
      const zScore = this.percentileToZScore(p);
      const value = metric.populationMean + zScore * metric.standardDeviation;
      distribution.push({
        percentile: p,
        value: Math.round(value * 100) / 100,
      });
    }

    return distribution;
  }

  getCohortList(): PopulationCohort[] {
    console.log("[Benchmarks] Retrieving cohort list");
    return this.cohorts;
  }

  getRiskStratification(
    userId: string,
    metrics: Array<{ name: string; value: number }>
  ): {
    userId: string;
    overallRisk: RiskLevel;
    metricRisks: Array<{
      metricName: string;
      value: number;
      riskLevel: RiskLevel;
      zScore: number;
      deviation: string;
    }>;
    summary: string;
  } {
    console.log(`[Benchmarks] Risk stratification for user: ${userId}`);
    const metricRisks: Array<{
      metricName: string;
      value: number;
      riskLevel: RiskLevel;
      zScore: number;
      deviation: string;
    }> = [];

    let maxAbsZ = 0;

    for (const m of metrics) {
      const metric = this.metrics.get(m.name);
      if (!metric) continue;

      const zScore = (m.value - metric.populationMean) / metric.standardDeviation;
      const absZ = Math.abs(zScore);
      if (absZ > maxAbsZ) maxAbsZ = absZ;

      const riskLevel = this.zScoreToRiskLevel(absZ);
      const direction = zScore > 0 ? "above" : "below";

      metricRisks.push({
        metricName: m.name,
        value: m.value,
        riskLevel,
        zScore: Math.round(zScore * 100) / 100,
        deviation: `${Math.round(absZ * 10) / 10} SD ${direction} mean`,
      });
    }

    const overallRisk = this.zScoreToRiskLevel(maxAbsZ);

    const criticalCount = metricRisks.filter((r) => r.riskLevel === "critical").length;
    const highCount = metricRisks.filter((r) => r.riskLevel === "high").length;
    const moderateCount = metricRisks.filter((r) => r.riskLevel === "moderate").length;

    let summary: string;
    if (criticalCount > 0) {
      summary = `Critical risk identified: ${criticalCount} metric(s) exceed 3 standard deviations from population norms. Immediate clinical review recommended.`;
    } else if (highCount > 0) {
      summary = `Elevated risk: ${highCount} metric(s) are 2-3 standard deviations from norms. Follow-up with healthcare provider advised.`;
    } else if (moderateCount > 0) {
      summary = `Moderate risk: ${moderateCount} metric(s) are 1-2 standard deviations from norms. Monitor closely and consider lifestyle adjustments.`;
    } else {
      summary = `Low risk: All metrics are within 1 standard deviation of population norms. Continue routine monitoring.`;
    }

    console.log(`[Benchmarks] Risk stratification complete: overall risk = ${overallRisk}`);
    return { userId, overallRisk, metricRisks, summary };
  }

  getChartData(
    metricName: string,
    patientHistory: Array<{ date: string; value: number }>,
    chartType: ChartType
  ): Record<string, any> | null {
    console.log(`[Benchmarks] Generating ${chartType} chart data for: ${metricName}`);
    const metric = this.metrics.get(metricName);
    if (!metric) {
      console.log(`[Benchmarks] Metric not found for chart: ${metricName}`);
      return null;
    }

    switch (chartType) {
      case "line_chart":
        return this.buildLineChart(metric, patientHistory);
      case "bar_chart":
        return this.buildBarChart(metric, patientHistory);
      case "histogram":
        return this.buildHistogram(metric);
      case "box_plot":
        return this.buildBoxPlot(metric, patientHistory);
      case "radar_chart":
        return this.buildRadarChart(metricName, patientHistory);
      default:
        return null;
    }
  }

  getStats(): {
    totalMetrics: number;
    totalCohorts: number;
    totalCategories: number;
    initialized: boolean;
    metricsByCategory: Record<string, number>;
  } {
    console.log("[Benchmarks] Retrieving service statistics");
    const metricsByCategory: Record<string, number> = {};
    for (const cat of this.categories) {
      metricsByCategory[cat.id] = cat.metrics.length;
    }
    return {
      totalMetrics: this.metrics.size,
      totalCohorts: this.cohorts.length,
      totalCategories: this.categories.length,
      initialized: this.initialized,
      metricsByCategory,
    };
  }

  private buildLineChart(metric: MetricDefinition, patientHistory: Array<{ date: string; value: number }>): Record<string, any> {
    const sorted = [...patientHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return {
      chartType: "line_chart",
      title: `${metric.metricName} Over Time`,
      xAxis: { label: "Date", values: sorted.map((p) => p.date) },
      yAxis: { label: `${metric.unit}`, min: metric.referenceRange.low * 0.8, max: metric.referenceRange.high * 1.2 },
      series: [
        { name: "Patient Values", data: sorted.map((p) => p.value), color: "#0ea5e9" },
        { name: "Population Mean", data: sorted.map(() => metric.populationMean), color: "#22c55e", dashStyle: "dashed" },
        { name: "Reference Low", data: sorted.map(() => metric.referenceRange.low), color: "#f59e0b", dashStyle: "dotted" },
        { name: "Reference High", data: sorted.map(() => metric.referenceRange.high), color: "#ef4444", dashStyle: "dotted" },
      ],
    };
  }

  private buildBarChart(metric: MetricDefinition, patientHistory: Array<{ date: string; value: number }>): Record<string, any> {
    const latestValue = patientHistory.length > 0 ? patientHistory[patientHistory.length - 1].value : 0;
    return {
      chartType: "bar_chart",
      title: `${metric.metricName} vs Population`,
      categories: ["Patient", "Population Mean", "Population Median", "Ref Low", "Ref High"],
      values: [latestValue, metric.populationMean, metric.populationMedian, metric.referenceRange.low, metric.referenceRange.high],
      colors: ["#0ea5e9", "#22c55e", "#8b5cf6", "#f59e0b", "#ef4444"],
      unit: metric.unit,
    };
  }

  private buildHistogram(metric: MetricDefinition): Record<string, any> {
    const bins: Array<{ range: string; frequency: number; midpoint: number }> = [];
    const numBins = 20;
    const minVal = metric.populationMean - 4 * metric.standardDeviation;
    const maxVal = metric.populationMean + 4 * metric.standardDeviation;
    const binWidth = (maxVal - minVal) / numBins;

    for (let i = 0; i < numBins; i++) {
      const binStart = minVal + i * binWidth;
      const binEnd = binStart + binWidth;
      const midpoint = (binStart + binEnd) / 2;
      const zStart = (binStart - metric.populationMean) / metric.standardDeviation;
      const zEnd = (binEnd - metric.populationMean) / metric.standardDeviation;
      const frequency = Math.round((this.normalCDF(zEnd) - this.normalCDF(zStart)) * 10000);
      bins.push({
        range: `${Math.round(binStart * 10) / 10}-${Math.round(binEnd * 10) / 10}`,
        frequency,
        midpoint: Math.round(midpoint * 10) / 10,
      });
    }

    return {
      chartType: "histogram",
      title: `${metric.metricName} Population Distribution`,
      bins,
      mean: metric.populationMean,
      median: metric.populationMedian,
      standardDeviation: metric.standardDeviation,
      unit: metric.unit,
    };
  }

  private buildBoxPlot(metric: MetricDefinition, patientHistory: Array<{ date: string; value: number }>): Record<string, any> {
    const q1z = this.percentileToZScore(25);
    const q3z = this.percentileToZScore(75);
    const p5z = this.percentileToZScore(5);
    const p95z = this.percentileToZScore(95);

    return {
      chartType: "box_plot",
      title: `${metric.metricName} Quartile Distribution`,
      whiskerLow: Math.round((metric.populationMean + p5z * metric.standardDeviation) * 100) / 100,
      q1: Math.round((metric.populationMean + q1z * metric.standardDeviation) * 100) / 100,
      median: metric.populationMedian,
      q3: Math.round((metric.populationMean + q3z * metric.standardDeviation) * 100) / 100,
      whiskerHigh: Math.round((metric.populationMean + p95z * metric.standardDeviation) * 100) / 100,
      outliers: patientHistory
        .filter((p) => {
          const z = Math.abs((p.value - metric.populationMean) / metric.standardDeviation);
          return z > 2;
        })
        .map((p) => p.value),
      patientValues: patientHistory.map((p) => p.value),
      unit: metric.unit,
    };
  }

  private buildRadarChart(metricName: string, patientHistory: Array<{ date: string; value: number }>): Record<string, any> {
    const category = this.categories.find((c) => c.metrics.includes(metricName));
    if (!category) return { chartType: "radar_chart", title: "Unavailable", axes: [] };

    const axes = category.metrics.map((mn) => {
      const m = this.metrics.get(mn);
      if (!m) return { metric: mn, populationNormalized: 0, patientNormalized: 0 };
      const latestPatient = mn === metricName && patientHistory.length > 0 ? patientHistory[patientHistory.length - 1].value : m.populationMean;
      const range = m.referenceRange.high - m.referenceRange.low;
      const patientNormalized = range > 0 ? ((latestPatient - m.referenceRange.low) / range) * 100 : 50;
      const populationNormalized = range > 0 ? ((m.populationMean - m.referenceRange.low) / range) * 100 : 50;
      return {
        metric: mn,
        populationNormalized: Math.round(Math.max(0, Math.min(100, populationNormalized)) * 10) / 10,
        patientNormalized: Math.round(Math.max(0, Math.min(100, patientNormalized)) * 10) / 10,
      };
    });

    return {
      chartType: "radar_chart",
      title: `${category.name} Multi-Metric Comparison`,
      axes,
    };
  }

  private determineTrend(
    patientValue: number,
    metric: MetricDefinition
  ): "above_average" | "below_average" | "within_normal" | "critical_high" | "critical_low" {
    const zScore = (patientValue - metric.populationMean) / metric.standardDeviation;
    const absZ = Math.abs(zScore);

    if (absZ > 3) {
      return zScore > 0 ? "critical_high" : "critical_low";
    }
    if (patientValue >= metric.referenceRange.low && patientValue <= metric.referenceRange.high) {
      if (absZ <= 0.5) return "within_normal";
      return zScore > 0 ? "above_average" : "below_average";
    }
    return zScore > 0 ? "above_average" : "below_average";
  }

  private determineClinicalSignificance(zScore: number, trend: string, metricName: string): string {
    const absZ = Math.abs(zScore);
    if (absZ > 3) return `${metricName} is critically ${zScore > 0 ? "elevated" : "low"} at >3 SD from population mean. Urgent clinical evaluation recommended.`;
    if (absZ > 2) return `${metricName} is significantly ${zScore > 0 ? "above" : "below"} population norms (${Math.round(absZ * 10) / 10} SD). Clinical follow-up advised.`;
    if (absZ > 1) return `${metricName} is mildly ${zScore > 0 ? "elevated" : "reduced"} compared to population benchmarks. Monitor trend over time.`;
    return `${metricName} is within normal population range. No immediate clinical concern.`;
  }

  private zScoreToPercentile(z: number): number {
    return this.normalCDF(z) * 100;
  }

  private percentileToZScore(percentile: number): number {
    const p = percentile / 100;
    if (p <= 0) return -4;
    if (p >= 1) return 4;
    const a1 = -3.969683028665376e1;
    const a2 = 2.209460984245205e2;
    const a3 = -2.759285104469687e2;
    const a4 = 1.383577518672690e2;
    const a5 = -3.066479806614716e1;
    const a6 = 2.506628277459239e0;
    const b1 = -5.447609879822406e1;
    const b2 = 1.615858368580409e2;
    const b3 = -1.556989798598866e2;
    const b4 = 6.680131188771972e1;
    const b5 = -1.328068155288572e1;
    const c1 = -7.784894002430293e-3;
    const c2 = -3.223964580411365e-1;
    const c3 = -2.400758277161838e0;
    const c4 = -2.549732539343734e0;
    const c5 = 4.374664141464968e0;
    const c6 = 2.938163982698783e0;
    const d1 = 7.784695709041462e-3;
    const d2 = 3.224671290700398e-1;
    const d3 = 2.445134137142996e0;
    const d4 = 3.754408661907416e0;
    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    let q: number;
    let r: number;
    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q / (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
    }
  }

  private normalCDF(z: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = z < 0 ? -1 : 1;
    const x = Math.abs(z) / Math.sqrt(2);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1.0 + sign * y);
  }

  private zScoreToRiskLevel(absZ: number): RiskLevel {
    if (absZ > 3) return "critical";
    if (absZ > 2) return "high";
    if (absZ > 1) return "moderate";
    return "low";
  }
}

export const populationBenchmarksService = new PopulationBenchmarksService();

export function initializePopulationBenchmarks(): void {
  console.log("[Benchmarks] Population benchmarks service initialized");
  const stats = populationBenchmarksService.getStats();
  console.log(`[Benchmarks] Ready: ${stats.totalMetrics} metrics, ${stats.totalCohorts} cohorts, ${stats.totalCategories} categories`);
}
