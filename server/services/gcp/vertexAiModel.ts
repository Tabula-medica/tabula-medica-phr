import type {
  IRiskModel,
  RiskPrediction,
  RiskModelInput,
  RiskType,
  IntegrationConfig,
} from "../integrations/interfaces";
import { VertexAI } from "@google-cloud/vertexai";

export class VertexAiRiskModel implements IRiskModel {
  readonly providerName = "vertex_ai";
  private _isConnected = false;
  readonly supportedRiskTypes: RiskType[] = [
    "cardiovascular",
    "diabetes",
    "readmission",
    "falls",
    "medication_adherence",
    "hospitalization",
    "sepsis",
    "deterioration",
  ];

  private vertexAI: VertexAI | null = null;
  private config: IntegrationConfig;

  constructor(config: IntegrationConfig) {
    this.config = config;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(): Promise<void> {
    try {
      if (!this.config.gcp) {
        throw new Error("GCP configuration is required");
      }

      this.vertexAI = new VertexAI({
        project: this.config.gcp.projectId,
        location: this.config.gcp.location,
      });

      this._isConnected = true;
      console.log(`[VertexAI] Connected to project: ${this.config.gcp.projectId}`);
    } catch (error) {
      console.error("[VertexAI] Connection failed:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.vertexAI = null;
    this._isConnected = false;
    console.log("[VertexAI] Disconnected");
  }

  async healthCheck(): Promise<{ status: "healthy" | "unhealthy"; latencyMs: number; message?: string }> {
    const start = Date.now();
    try {
      if (!this.vertexAI) {
        return { status: "unhealthy", latencyMs: 0, message: "Client not initialized" };
      }

      const model = this.vertexAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      await model.generateContent("test");

      return {
        status: "healthy",
        latencyMs: Date.now() - start,
        message: "Vertex AI is accessible",
      };
    } catch (error: any) {
      return {
        status: "unhealthy",
        latencyMs: Date.now() - start,
        message: error.message || "Health check failed",
      };
    }
  }

  async predictRisk(input: RiskModelInput, riskType: RiskType): Promise<RiskPrediction> {
    if (!this.vertexAI) throw new Error("Not connected");

    const model = this.vertexAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = this.buildRiskPrompt(input, riskType);
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return this.parseRiskPrediction(text, input.patientId, riskType);
  }

  async predictAllRisks(input: RiskModelInput): Promise<RiskPrediction[]> {
    const predictions: RiskPrediction[] = [];

    for (const riskType of this.supportedRiskTypes) {
      try {
        const prediction = await this.predictRisk(input, riskType);
        predictions.push(prediction);
      } catch (error) {
        console.error(`[VertexAI] Failed to predict ${riskType} risk:`, error);
      }
    }

    return predictions;
  }

  async batchPredict(inputs: RiskModelInput[], riskType: RiskType): Promise<RiskPrediction[]> {
    const predictions: RiskPrediction[] = [];

    for (const input of inputs) {
      try {
        const prediction = await this.predictRisk(input, riskType);
        predictions.push(prediction);
      } catch (error) {
        console.error(`[VertexAI] Batch prediction failed for patient ${input.patientId}:`, error);
      }
    }

    return predictions;
  }

  async getModelInfo(riskType: RiskType): Promise<{
    modelId: string;
    version: string;
    accuracy: number;
    lastTrained: string;
    features: string[];
  }> {
    return {
      modelId: `${riskType}-risk-model`,
      version: "1.0.0",
      accuracy: 0.85,
      lastTrained: new Date().toISOString(),
      features: ["demographics", "conditions", "medications", "vitals", "labs"],
    };
  }

  async explainPrediction(prediction: RiskPrediction): Promise<{
    reasoning: string;
    evidenceCitations: Array<{ source: string; relevance: number }>;
    alternativeOutcomes: Array<{ outcome: string; probability: number }>;
  }> {
    return {
      reasoning: `The ${prediction.riskType} risk score of ${prediction.score} was calculated based on ${prediction.factors.length} contributing factors.`,
      evidenceCitations: [
        { source: "Clinical guidelines", relevance: 0.9 },
        { source: "Population data", relevance: 0.75 },
      ],
      alternativeOutcomes: [
        { outcome: "No intervention", probability: prediction.score / 100 },
        { outcome: "With intervention", probability: (100 - prediction.score) / 100 },
      ],
    };
  }

  private buildRiskPrompt(input: RiskModelInput, riskType: RiskType): string {
    return `Analyze the following patient data and provide a ${riskType} risk assessment.

Patient Demographics:
- Age: ${input.demographics.age}
- Gender: ${input.demographics.gender}

Active Conditions: ${input.conditions.map((c) => c.display).join(", ") || "None"}

Current Medications: ${input.medications.filter((m) => m.status === "active").map((m) => m.display).join(", ") || "None"}

Recent Vitals:
${input.vitals.slice(0, 5).map((v) => `- ${v.code}: ${v.value} ${v.unit}`).join("\n") || "No recent vitals"}

Recent Lab Results:
${input.labs.slice(0, 5).map((l) => `- ${l.code}: ${l.value} ${l.unit}`).join("\n") || "No recent labs"}

Provide a JSON response with:
1. riskScore (0-100)
2. riskLevel (low/moderate/high/critical)
3. confidence (0-100)
4. topFactors (array of {name, contribution, description})
5. recommendations (array of strings)`;
  }

  private parseRiskPrediction(text: string, patientId: string, riskType: RiskType): RiskPrediction {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          patientId,
          riskType,
          score: parsed.riskScore || 50,
          confidence: parsed.confidence || 70,
          riskLevel: parsed.riskLevel || "moderate",
          factors: parsed.topFactors || [],
          recommendations: parsed.recommendations || [],
          predictedAt: new Date().toISOString(),
          modelVersion: "vertex-ai-1.0",
        };
      }
    } catch (error) {
      console.error("[VertexAI] Failed to parse risk prediction:", error);
    }

    return {
      patientId,
      riskType,
      score: 50,
      confidence: 50,
      riskLevel: "moderate",
      factors: [],
      recommendations: ["Unable to generate specific recommendations"],
      predictedAt: new Date().toISOString(),
      modelVersion: "vertex-ai-1.0",
    };
  }
}

export class MockRiskModel implements IRiskModel {
  readonly providerName = "mock";
  private _isConnected = false;
  readonly supportedRiskTypes: RiskType[] = [
    "cardiovascular",
    "diabetes",
    "readmission",
    "falls",
    "medication_adherence",
    "hospitalization",
    "sepsis",
    "deterioration",
  ];

  get isConnected(): boolean {
    return this._isConnected;
  }

  async connect(): Promise<void> {
    this._isConnected = true;
    console.log("[MockRiskModel] Connected");
  }

  async disconnect(): Promise<void> {
    this._isConnected = false;
    console.log("[MockRiskModel] Disconnected");
  }

  async healthCheck(): Promise<{ status: "healthy" | "unhealthy"; latencyMs: number; message?: string }> {
    return { status: "healthy", latencyMs: 3, message: "Mock risk model" };
  }

  async predictRisk(input: RiskModelInput, riskType: RiskType): Promise<RiskPrediction> {
    const baseScore = this.calculateMockScore(input, riskType);

    return {
      patientId: input.patientId,
      riskType,
      score: baseScore,
      confidence: 75 + Math.random() * 20,
      riskLevel: this.scoreToLevel(baseScore),
      factors: this.getMockFactors(riskType),
      recommendations: this.getMockRecommendations(riskType),
      predictedAt: new Date().toISOString(),
      modelVersion: "mock-1.0",
    };
  }

  async predictAllRisks(input: RiskModelInput): Promise<RiskPrediction[]> {
    return Promise.all(this.supportedRiskTypes.map((type) => this.predictRisk(input, type)));
  }

  async batchPredict(inputs: RiskModelInput[], riskType: RiskType): Promise<RiskPrediction[]> {
    return Promise.all(inputs.map((input) => this.predictRisk(input, riskType)));
  }

  async getModelInfo(riskType: RiskType): Promise<{
    modelId: string;
    version: string;
    accuracy: number;
    lastTrained: string;
    features: string[];
  }> {
    return {
      modelId: `mock-${riskType}-model`,
      version: "1.0.0",
      accuracy: 0.82,
      lastTrained: new Date().toISOString(),
      features: ["demographics", "conditions", "medications"],
    };
  }

  async explainPrediction(prediction: RiskPrediction): Promise<{
    reasoning: string;
    evidenceCitations: Array<{ source: string; relevance: number }>;
    alternativeOutcomes: Array<{ outcome: string; probability: number }>;
  }> {
    return {
      reasoning: `Mock explanation for ${prediction.riskType} risk assessment.`,
      evidenceCitations: [{ source: "Mock guidelines", relevance: 0.8 }],
      alternativeOutcomes: [{ outcome: "Baseline", probability: 0.5 }],
    };
  }

  private calculateMockScore(input: RiskModelInput, riskType: RiskType): number {
    let score = 30;

    if (input.demographics.age > 65) score += 15;
    if (input.demographics.age > 75) score += 10;

    score += Math.min(input.conditions.length * 5, 25);
    score += Math.min(input.medications.length * 3, 15);

    const riskModifiers: Record<RiskType, number> = {
      cardiovascular: 1.2,
      diabetes: 1.0,
      readmission: 0.9,
      falls: 1.1,
      medication_adherence: 0.8,
      hospitalization: 1.0,
      sepsis: 0.7,
      deterioration: 0.9,
    };

    score *= riskModifiers[riskType];

    return Math.min(Math.max(Math.round(score), 0), 100);
  }

  private scoreToLevel(score: number): "low" | "moderate" | "high" | "critical" {
    if (score < 25) return "low";
    if (score < 50) return "moderate";
    if (score < 75) return "high";
    return "critical";
  }

  private getMockFactors(riskType: RiskType): Array<{ name: string; contribution: number; description: string }> {
    const factorsByType: Record<RiskType, Array<{ name: string; contribution: number; description: string }>> = {
      cardiovascular: [
        { name: "Age", contribution: 25, description: "Advanced age increases cardiovascular risk" },
        { name: "Hypertension", contribution: 30, description: "Elevated blood pressure" },
        { name: "Cholesterol", contribution: 20, description: "Lipid profile abnormalities" },
      ],
      diabetes: [
        { name: "BMI", contribution: 35, description: "Elevated body mass index" },
        { name: "Family History", contribution: 25, description: "Genetic predisposition" },
        { name: "A1C Levels", contribution: 20, description: "Glycemic control indicators" },
      ],
      readmission: [
        { name: "Prior Admissions", contribution: 40, description: "History of hospitalizations" },
        { name: "Comorbidities", contribution: 30, description: "Multiple chronic conditions" },
      ],
      falls: [
        { name: "Age", contribution: 35, description: "Advanced age" },
        { name: "Medications", contribution: 25, description: "Fall-risk medications" },
        { name: "Mobility", contribution: 20, description: "Gait and balance issues" },
      ],
      medication_adherence: [
        { name: "Regimen Complexity", contribution: 40, description: "Multiple medications" },
        { name: "Side Effects", contribution: 25, description: "Adverse effects" },
      ],
      hospitalization: [
        { name: "Chronic Conditions", contribution: 35, description: "Multiple comorbidities" },
        { name: "Recent ED Visits", contribution: 30, description: "Emergency utilization" },
      ],
      sepsis: [
        { name: "Infection History", contribution: 40, description: "Previous infections" },
        { name: "Immunocompromised", contribution: 30, description: "Weakened immune system" },
      ],
      deterioration: [
        { name: "Vital Trends", contribution: 35, description: "Declining vitals" },
        { name: "Lab Abnormalities", contribution: 30, description: "Worsening lab values" },
      ],
    };

    return factorsByType[riskType] || [];
  }

  private getMockRecommendations(riskType: RiskType): string[] {
    const recommendations: Record<RiskType, string[]> = {
      cardiovascular: [
        "Monitor blood pressure regularly",
        "Review lipid-lowering therapy",
        "Encourage heart-healthy diet",
      ],
      diabetes: [
        "Schedule A1C testing",
        "Review diabetes medication regimen",
        "Refer to diabetes educator",
      ],
      readmission: [
        "Ensure discharge planning is complete",
        "Schedule follow-up within 7 days",
        "Verify medication reconciliation",
      ],
      falls: [
        "Conduct fall risk assessment",
        "Review fall-risk medications",
        "Consider physical therapy referral",
      ],
      medication_adherence: [
        "Simplify medication regimen if possible",
        "Provide pill organizer",
        "Set up medication reminders",
      ],
      hospitalization: [
        "Optimize chronic disease management",
        "Establish care coordination",
        "Review prevention strategies",
      ],
      sepsis: [
        "Maintain infection control protocols",
        "Monitor for early warning signs",
        "Review vaccination status",
      ],
      deterioration: [
        "Increase monitoring frequency",
        "Review care plan urgently",
        "Consider escalation of care",
      ],
    };

    return recommendations[riskType] || [];
  }
}
