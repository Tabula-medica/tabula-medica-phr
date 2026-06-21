import OpenAI from "openai";
import { v4 as uuidv4 } from "uuid";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string;
    fill?: boolean;
  }[];
}

export interface VisualizationConfig {
  id: string;
  title: string;
  description: string;
  chartType: "line" | "bar" | "pie" | "doughnut" | "area" | "scatter" | "radar" | "heatmap";
  data: ChartData;
  insights: string[];
  category: "clinical_trends" | "patient_population" | "data_quality" | "utilization" | "outcomes";
  priority: number;
  aiGenerated: boolean;
  recommendations: string[];
}

export interface DashboardLayout {
  id: string;
  name: string;
  description: string;
  visualizations: VisualizationConfig[];
  generatedAt: string;
  dataSourceSummary: {
    resourceTypes: string[];
    totalRecords: number;
    dateRange: { start: string; end: string };
  };
}

export interface AIInsight {
  id: string;
  type: "trend" | "anomaly" | "correlation" | "recommendation" | "warning";
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  relatedVisualization?: string;
  actionItems: string[];
  confidence: number;
}

export interface FHIRDataAnalysis {
  resourceCounts: Record<string, number>;
  temporalDistribution: { date: string; count: number }[];
  qualityMetrics: {
    completeness: number;
    validity: number;
    consistency: number;
    timeliness: number;
  };
  patientDemographics?: {
    ageGroups: Record<string, number>;
    genderDistribution: Record<string, number>;
  };
  clinicalMetrics?: {
    conditionPrevalence: Record<string, number>;
    medicationUsage: Record<string, number>;
    labResultTrends: { name: string; values: number[]; dates: string[] }[];
  };
}

class AIFHIRVisualizationService {
  private colorPalette = {
    primary: ["#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe", "#dbeafe"],
    success: ["#22c55e", "#4ade80", "#86efac", "#bbf7d0", "#dcfce7"],
    warning: ["#f59e0b", "#fbbf24", "#fcd34d", "#fde68a", "#fef3c7"],
    danger: ["#ef4444", "#f87171", "#fca5a5", "#fecaca", "#fee2e2"],
    purple: ["#8b5cf6", "#a78bfa", "#c4b5fd", "#ddd6fe", "#ede9fe"],
    teal: ["#14b8a6", "#2dd4bf", "#5eead4", "#99f6e4", "#ccfbf1"],
  };

  async analyzeFHIRData(resources: any[]): Promise<FHIRDataAnalysis> {
    const resourceCounts: Record<string, number> = {};
    const temporalData: Record<string, number> = {};
    const conditions: Record<string, number> = {};
    const medications: Record<string, number> = {};
    const ageGroups: Record<string, number> = {
      "0-17": 0, "18-34": 0, "35-49": 0, "50-64": 0, "65+": 0
    };
    const genderDistribution: Record<string, number> = {};
    let completenessScore = 0;
    let validityScore = 0;

    for (const resource of resources) {
      const type = resource.resourceType || "Unknown";
      resourceCounts[type] = (resourceCounts[type] || 0) + 1;

      const date = this.extractDate(resource);
      if (date) {
        const month = date.substring(0, 7);
        temporalData[month] = (temporalData[month] || 0) + 1;
      }

      if (type === "Patient") {
        const age = this.calculateAge(resource.birthDate);
        if (age !== null) {
          if (age < 18) ageGroups["0-17"]++;
          else if (age < 35) ageGroups["18-34"]++;
          else if (age < 50) ageGroups["35-49"]++;
          else if (age < 65) ageGroups["50-64"]++;
          else ageGroups["65+"]++;
        }
        const gender = resource.gender || "unknown";
        genderDistribution[gender] = (genderDistribution[gender] || 0) + 1;
      }

      if (type === "Condition") {
        const conditionName = resource.code?.coding?.[0]?.display || resource.code?.text || "Unknown";
        conditions[conditionName] = (conditions[conditionName] || 0) + 1;
      }

      if (type === "MedicationRequest" || type === "MedicationStatement") {
        const medName = resource.medicationCodeableConcept?.coding?.[0]?.display || 
                       resource.medicationCodeableConcept?.text || "Unknown";
        medications[medName] = (medications[medName] || 0) + 1;
      }

      completenessScore += this.calculateCompleteness(resource);
      validityScore += this.validateResource(resource) ? 1 : 0;
    }

    const totalResources = resources.length || 1;
    const sortedDates = Object.keys(temporalData).sort();

    return {
      resourceCounts,
      temporalDistribution: sortedDates.map(date => ({ date, count: temporalData[date] })),
      qualityMetrics: {
        completeness: Math.round((completenessScore / totalResources) * 100),
        validity: Math.round((validityScore / totalResources) * 100),
        consistency: this.calculateConsistency(resources),
        timeliness: this.calculateTimeliness(resources),
      },
      patientDemographics: {
        ageGroups,
        genderDistribution,
      },
      clinicalMetrics: {
        conditionPrevalence: conditions,
        medicationUsage: medications,
        labResultTrends: [],
      },
    };
  }

  async generateVisualizationSuggestions(
    analysis: FHIRDataAnalysis,
    userPreferences?: { focus?: string; chartTypes?: string[] }
  ): Promise<VisualizationConfig[]> {
    const visualizations: VisualizationConfig[] = [];

    if (Object.keys(analysis.resourceCounts).length > 0) {
      visualizations.push(this.createResourceDistributionChart(analysis.resourceCounts));
    }

    if (analysis.temporalDistribution.length > 0) {
      visualizations.push(this.createTemporalTrendChart(analysis.temporalDistribution));
    }

    visualizations.push(this.createDataQualityChart(analysis.qualityMetrics));

    if (analysis.patientDemographics) {
      if (Object.values(analysis.patientDemographics.ageGroups).some(v => v > 0)) {
        visualizations.push(this.createAgeDistributionChart(analysis.patientDemographics.ageGroups));
      }
      if (Object.keys(analysis.patientDemographics.genderDistribution).length > 0) {
        visualizations.push(this.createGenderDistributionChart(analysis.patientDemographics.genderDistribution));
      }
    }

    if (analysis.clinicalMetrics) {
      if (Object.keys(analysis.clinicalMetrics.conditionPrevalence).length > 0) {
        visualizations.push(this.createConditionPrevalenceChart(analysis.clinicalMetrics.conditionPrevalence));
      }
      if (Object.keys(analysis.clinicalMetrics.medicationUsage).length > 0) {
        visualizations.push(this.createMedicationUsageChart(analysis.clinicalMetrics.medicationUsage));
      }
    }

    const aiEnhanced = await this.enhanceWithAIInsights(visualizations, analysis);
    return aiEnhanced;
  }

  async generateDashboard(
    resources: any[],
    dashboardName: string = "FHIR Data Dashboard"
  ): Promise<DashboardLayout> {
    const analysis = await this.analyzeFHIRData(resources);
    const visualizations = await this.generateVisualizationSuggestions(analysis);

    const dates = resources
      .map(r => this.extractDate(r))
      .filter(Boolean)
      .sort();

    return {
      id: uuidv4(),
      name: dashboardName,
      description: "AI-generated dashboard providing insights into FHIR data patterns, clinical trends, and data quality metrics",
      visualizations: visualizations.sort((a, b) => b.priority - a.priority),
      generatedAt: new Date().toISOString(),
      dataSourceSummary: {
        resourceTypes: Object.keys(analysis.resourceCounts),
        totalRecords: resources.length,
        dateRange: {
          start: dates[0] || new Date().toISOString(),
          end: dates[dates.length - 1] || new Date().toISOString(),
        },
      },
    };
  }

  async generateAIInsights(analysis: FHIRDataAnalysis): Promise<AIInsight[]> {
    const insights: AIInsight[] = [];

    if (analysis.qualityMetrics.completeness < 70) {
      insights.push({
        id: uuidv4(),
        type: "warning",
        title: "Data Completeness Below Threshold",
        description: `Current data completeness is ${analysis.qualityMetrics.completeness}%, which is below the recommended 70% threshold.`,
        severity: analysis.qualityMetrics.completeness < 50 ? "high" : "medium",
        actionItems: [
          "Review required fields for each resource type",
          "Implement validation rules at data entry points",
          "Consider data enrichment strategies",
        ],
        confidence: 0.95,
      });
    }

    if (analysis.temporalDistribution.length >= 3) {
      const trend = this.detectTrend(analysis.temporalDistribution.map(t => t.count));
      if (trend !== "stable") {
        insights.push({
          id: uuidv4(),
          type: "trend",
          title: `${trend === "increasing" ? "Increasing" : "Decreasing"} Data Volume Trend`,
          description: `Data volume shows a ${trend} trend over the analyzed period.`,
          severity: "low",
          actionItems: trend === "decreasing" 
            ? ["Investigate potential data integration issues", "Check source system connectivity"]
            : ["Monitor system capacity", "Review data retention policies"],
          confidence: 0.85,
        });
      }
    }

    try {
      const aiInsights = await this.getAIGeneratedInsights(analysis);
      insights.push(...aiInsights);
    } catch (error) {
      console.error("AI insight generation error:", error);
    }

    return insights;
  }

  private async getAIGeneratedInsights(analysis: FHIRDataAnalysis): Promise<AIInsight[]> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a healthcare data analyst expert. Analyze FHIR data metrics and provide actionable insights.
Return a JSON object with an "insights" array containing objects with:
- type: "trend" | "anomaly" | "correlation" | "recommendation"
- title: Brief title
- description: Detailed description
- severity: "low" | "medium" | "high"
- actionItems: Array of recommended actions
- confidence: 0-1 score

Focus on clinical relevance and data quality improvements. Keep insights actionable and specific.`,
          },
          {
            role: "user",
            content: `Analyze these FHIR data metrics and provide 2-3 key insights:
${JSON.stringify(analysis, null, 2)}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      const parsed = JSON.parse(content);
      return (parsed.insights || []).map((insight: any) => ({
        id: uuidv4(),
        ...insight,
        confidence: insight.confidence || 0.8,
      }));
    } catch (error) {
      console.error("AI insights error:", error);
      return [];
    }
  }

  private async enhanceWithAIInsights(
    visualizations: VisualizationConfig[],
    analysis: FHIRDataAnalysis
  ): Promise<VisualizationConfig[]> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a healthcare data visualization expert. Enhance chart configurations with AI-generated insights.
Return a JSON object with an "enhancements" array containing objects with:
- chartId: ID of the chart to enhance
- additionalInsights: Array of insight strings
- recommendations: Array of action recommendations

Focus on clinical significance and actionable findings.`,
          },
          {
            role: "user",
            content: `Enhance these visualizations with clinical insights:
Charts: ${JSON.stringify(visualizations.map(v => ({ id: v.id, title: v.title, category: v.category })))}
Data Analysis: ${JSON.stringify(analysis)}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return visualizations;

      const parsed = JSON.parse(content);
      const enhancements = parsed.enhancements || [];

      return visualizations.map(viz => {
        const enhancement = enhancements.find((e: any) => e.chartId === viz.id);
        if (enhancement) {
          return {
            ...viz,
            insights: [...viz.insights, ...(enhancement.additionalInsights || [])],
            recommendations: [...viz.recommendations, ...(enhancement.recommendations || [])],
            aiGenerated: true,
          };
        }
        return viz;
      });
    } catch (error) {
      console.error("AI enhancement error:", error);
      return visualizations;
    }
  }

  private createResourceDistributionChart(resourceCounts: Record<string, number>): VisualizationConfig {
    const labels = Object.keys(resourceCounts);
    const data = Object.values(resourceCounts);

    return {
      id: uuidv4(),
      title: "FHIR Resource Distribution",
      description: "Distribution of resource types in the dataset",
      chartType: "doughnut",
      data: {
        labels,
        datasets: [{
          label: "Resource Count",
          data,
          backgroundColor: this.colorPalette.primary,
        }],
      },
      insights: [
        `${labels.length} different resource types found`,
        `Most common: ${labels[data.indexOf(Math.max(...data))]} (${Math.max(...data)} records)`,
      ],
      category: "data_quality",
      priority: 8,
      aiGenerated: false,
      recommendations: ["Ensure balanced resource representation", "Review under-represented resource types"],
    };
  }

  private createTemporalTrendChart(temporalData: { date: string; count: number }[]): VisualizationConfig {
    return {
      id: uuidv4(),
      title: "Data Volume Over Time",
      description: "Temporal distribution of FHIR resources",
      chartType: "area",
      data: {
        labels: temporalData.map(t => t.date),
        datasets: [{
          label: "Records",
          data: temporalData.map(t => t.count),
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          borderColor: this.colorPalette.primary[0],
          fill: true,
        }],
      },
      insights: [
        `Data spans ${temporalData.length} time periods`,
        `Average: ${Math.round(temporalData.reduce((a, b) => a + b.count, 0) / temporalData.length)} records per period`,
      ],
      category: "clinical_trends",
      priority: 9,
      aiGenerated: false,
      recommendations: ["Monitor for data gaps", "Investigate volume spikes or drops"],
    };
  }

  private createDataQualityChart(metrics: FHIRDataAnalysis["qualityMetrics"]): VisualizationConfig {
    return {
      id: uuidv4(),
      title: "Data Quality Metrics",
      description: "Key quality indicators for FHIR data",
      chartType: "radar",
      data: {
        labels: ["Completeness", "Validity", "Consistency", "Timeliness"],
        datasets: [{
          label: "Quality Score",
          data: [metrics.completeness, metrics.validity, metrics.consistency, metrics.timeliness],
          backgroundColor: "rgba(34, 197, 94, 0.2)",
          borderColor: this.colorPalette.success[0],
        }],
      },
      insights: [
        `Overall quality: ${Math.round((metrics.completeness + metrics.validity + metrics.consistency + metrics.timeliness) / 4)}%`,
        metrics.completeness < 70 ? "Completeness needs attention" : "Completeness is acceptable",
      ],
      category: "data_quality",
      priority: 10,
      aiGenerated: false,
      recommendations: this.getQualityRecommendations(metrics),
    };
  }

  private createAgeDistributionChart(ageGroups: Record<string, number>): VisualizationConfig {
    return {
      id: uuidv4(),
      title: "Patient Age Distribution",
      description: "Distribution of patients by age group",
      chartType: "bar",
      data: {
        labels: Object.keys(ageGroups),
        datasets: [{
          label: "Patients",
          data: Object.values(ageGroups),
          backgroundColor: this.colorPalette.purple,
        }],
      },
      insights: [
        `Total patients: ${Object.values(ageGroups).reduce((a, b) => a + b, 0)}`,
        `Largest group: ${Object.entries(ageGroups).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"}`,
      ],
      category: "patient_population",
      priority: 7,
      aiGenerated: false,
      recommendations: ["Consider age-specific care programs", "Review population health strategies"],
    };
  }

  private createGenderDistributionChart(genderDist: Record<string, number>): VisualizationConfig {
    return {
      id: uuidv4(),
      title: "Patient Gender Distribution",
      description: "Gender breakdown of patient population",
      chartType: "pie",
      data: {
        labels: Object.keys(genderDist).map(g => g.charAt(0).toUpperCase() + g.slice(1)),
        datasets: [{
          label: "Patients",
          data: Object.values(genderDist),
          backgroundColor: [this.colorPalette.primary[0], this.colorPalette.teal[0], this.colorPalette.purple[0]],
        }],
      },
      insights: [`${Object.keys(genderDist).length} gender categories recorded`],
      category: "patient_population",
      priority: 6,
      aiGenerated: false,
      recommendations: ["Ensure gender-inclusive data collection"],
    };
  }

  private createConditionPrevalenceChart(conditions: Record<string, number>): VisualizationConfig {
    const sorted = Object.entries(conditions).sort((a, b) => b[1] - a[1]).slice(0, 10);
    
    return {
      id: uuidv4(),
      title: "Top Clinical Conditions",
      description: "Most prevalent conditions in patient population",
      chartType: "bar",
      data: {
        labels: sorted.map(([name]) => name.length > 25 ? name.substring(0, 25) + "..." : name),
        datasets: [{
          label: "Cases",
          data: sorted.map(([, count]) => count),
          backgroundColor: this.colorPalette.warning,
        }],
      },
      insights: [
        `${Object.keys(conditions).length} unique conditions identified`,
        `Most common: ${sorted[0]?.[0] || "N/A"}`,
      ],
      category: "clinical_trends",
      priority: 8,
      aiGenerated: false,
      recommendations: ["Review care pathways for top conditions", "Consider population health interventions"],
    };
  }

  private createMedicationUsageChart(medications: Record<string, number>): VisualizationConfig {
    const sorted = Object.entries(medications).sort((a, b) => b[1] - a[1]).slice(0, 10);

    return {
      id: uuidv4(),
      title: "Medication Usage Patterns",
      description: "Most frequently prescribed medications",
      chartType: "bar",
      data: {
        labels: sorted.map(([name]) => name.length > 20 ? name.substring(0, 20) + "..." : name),
        datasets: [{
          label: "Prescriptions",
          data: sorted.map(([, count]) => count),
          backgroundColor: this.colorPalette.teal,
        }],
      },
      insights: [
        `${Object.keys(medications).length} unique medications tracked`,
        `Top medication: ${sorted[0]?.[0] || "N/A"}`,
      ],
      category: "utilization",
      priority: 7,
      aiGenerated: false,
      recommendations: ["Review medication adherence programs", "Monitor for polypharmacy risks"],
    };
  }

  private extractDate(resource: any): string | null {
    return resource.meta?.lastUpdated ||
           resource.issued ||
           resource.effectiveDateTime ||
           resource.recordedDate ||
           resource.authoredOn ||
           resource.date ||
           null;
  }

  private calculateAge(birthDate: string | undefined): number | null {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  private calculateCompleteness(resource: any): number {
    if (!resource || typeof resource !== "object") return 0;
    const requiredFields = ["id", "resourceType"];
    const presentFields = requiredFields.filter(f => resource[f]);
    const totalFields = Object.keys(resource).filter(k => resource[k] !== null && resource[k] !== undefined).length;
    return (presentFields.length / requiredFields.length + Math.min(totalFields / 10, 1)) / 2;
  }

  private validateResource(resource: any): boolean {
    return resource && 
           typeof resource === "object" && 
           resource.resourceType && 
           resource.id;
  }

  private calculateConsistency(resources: any[]): number {
    if (resources.length === 0) return 100;
    const typeGroups: Record<string, any[]> = {};
    for (const r of resources) {
      const type = r.resourceType || "Unknown";
      if (!typeGroups[type]) typeGroups[type] = [];
      typeGroups[type].push(r);
    }
    let consistencyScore = 0;
    let groupCount = 0;
    for (const [, group] of Object.entries(typeGroups)) {
      if (group.length < 2) continue;
      const fieldSets = group.map(r => new Set(Object.keys(r)));
      const commonFields = Array.from(fieldSets[0]).filter(f => fieldSets.every(s => s.has(f)));
      consistencyScore += (commonFields.length / fieldSets[0].size) * 100;
      groupCount++;
    }
    return groupCount > 0 ? Math.round(consistencyScore / groupCount) : 85;
  }

  private calculateTimeliness(resources: any[]): number {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    let recentCount = 0;
    for (const r of resources) {
      const date = this.extractDate(r);
      if (date && new Date(date) >= oneMonthAgo) recentCount++;
    }
    return resources.length > 0 ? Math.round((recentCount / resources.length) * 100) : 50;
  }

  private detectTrend(values: number[]): "increasing" | "decreasing" | "stable" {
    if (values.length < 3) return "stable";
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const change = (secondAvg - firstAvg) / firstAvg;
    if (change > 0.15) return "increasing";
    if (change < -0.15) return "decreasing";
    return "stable";
  }

  private getQualityRecommendations(metrics: FHIRDataAnalysis["qualityMetrics"]): string[] {
    const recommendations: string[] = [];
    if (metrics.completeness < 80) recommendations.push("Implement required field validation");
    if (metrics.validity < 80) recommendations.push("Review data validation rules");
    if (metrics.consistency < 80) recommendations.push("Standardize data entry workflows");
    if (metrics.timeliness < 50) recommendations.push("Improve data synchronization frequency");
    if (recommendations.length === 0) recommendations.push("Maintain current data quality practices");
    return recommendations;
  }
}

export const aiFHIRVisualizationService = new AIFHIRVisualizationService();
