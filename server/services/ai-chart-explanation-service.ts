import { healthGraphService, HealthNode, HealthEdge, HealthGraph } from "./health-graph-service";
import { generatePhiSafeText } from "./ai-gateway";

const NO_CDS_DISCLAIMER = "This information is for educational purposes only and does not constitute medical advice. Always consult with your healthcare provider for medical decisions.";

export interface ChartExplanation {
  explanationId: string;
  explanationType: "correlation" | "trend" | "timeline" | "comparison" | "medication_effect" | "condition_progression";
  title: string;
  explanation: string;
  summary: string;
  confidence: number;
  relatedItems: string[];
  evidence: ExplanationEvidence[];
  generatedAt: string;
  noCdsDisclaimer: string;
}

export interface ExplanationEvidence {
  type: "data_point" | "temporal" | "clinical_pattern" | "literature";
  description: string;
  source?: string;
  date?: string;
  value?: string;
}

export interface TrendAnalysis {
  labName: string;
  labCode: string;
  currentValue: number;
  unit: string;
  trend: "rising" | "falling" | "stable" | "fluctuating";
  percentChange: number;
  timespan: string;
  dataPoints: Array<{ date: string; value: number }>;
  correlatedEvents: CorrelatedEvent[];
  explanation: string;
  significance: "normal" | "attention" | "concern";
}

export interface CorrelatedEvent {
  eventDate: string;
  eventType: string;
  eventDescription: string;
  correlation: "positive" | "negative" | "neutral";
  temporalRelation: "before" | "after" | "concurrent";
  daysFromTrendChange: number;
}

export interface MedicationEffect {
  medicationName: string;
  medicationCode: string;
  startDate: string;
  affectedLabs: LabEffect[];
  affectedConditions: ConditionEffect[];
  overallAssessment: string;
  noCdsDisclaimer: string;
}

export interface LabEffect {
  labName: string;
  beforeValue?: number;
  afterValue?: number;
  change: "increased" | "decreased" | "stable" | "unknown";
  percentChange?: number;
  explanation: string;
}

export interface ConditionEffect {
  conditionName: string;
  statusChange: "improved" | "worsened" | "stable" | "unknown";
  evidence: string;
}

export interface HealthNarrative {
  patientId: string;
  narrative: string;
  sections: NarrativeSection[];
  generatedAt: string;
  noCdsDisclaimer: string;
}

export interface NarrativeSection {
  title: string;
  content: string;
  relatedNodeIds: string[];
  timeframe?: { start: string; end: string };
}

class AIChartExplanationService {
  async explainLabTrend(patientId: string, labNodeId: string): Promise<ChartExplanation> {
    const graph = await healthGraphService.getGraph(patientId);
    if (!graph) {
      throw new Error("Patient graph not found");
    }

    const labNode = graph.nodes.find(n => n.id === labNodeId && n.nodeType === "lab");
    if (!labNode) {
      throw new Error("Lab result not found");
    }

    const trend = labNode.metadata?.trend as Array<{ date: string; value: number }> | undefined;
    
    // Find related medications and conditions
    const relatedEdges = graph.edges.filter(e => 
      e.sourceNodeId === labNodeId || e.targetNodeId === labNodeId
    );
    
    const relatedNodeIds = relatedEdges.flatMap(e => [e.sourceNodeId, e.targetNodeId]);
    const relatedNodes = graph.nodes.filter(n => relatedNodeIds.includes(n.id) && n.id !== labNodeId);
    
    // Find medications that started around trend changes
    const medications = relatedNodes.filter(n => n.nodeType === "medication");
    const conditions = relatedNodes.filter(n => n.nodeType === "condition");

    let explanation = "";
    const evidence: ExplanationEvidence[] = [];

    if (trend && trend.length > 1) {
      const firstPoint = trend[0];
      const lastPoint = trend[trend.length - 1];
      const percentChange = ((lastPoint.value - firstPoint.value) / firstPoint.value * 100).toFixed(1);
      const trendDirection = parseFloat(percentChange) > 5 ? "rising" : parseFloat(percentChange) < -5 ? "falling" : "stable";

      evidence.push({
        type: "data_point",
        description: `${labNode.label} was ${firstPoint.value} on ${firstPoint.date}`,
        date: firstPoint.date,
        value: String(firstPoint.value),
      });

      evidence.push({
        type: "data_point",
        description: `${labNode.label} is now ${lastPoint.value} on ${lastPoint.date}`,
        date: lastPoint.date,
        value: String(lastPoint.value),
      });

      // Check for medications that correlate with trend changes
      for (const med of medications) {
        if (med.startDate) {
          const medDate = new Date(med.startDate);
          for (let i = 1; i < trend.length; i++) {
            const trendDate = new Date(trend[i].date);
            const daysDiff = Math.abs((trendDate.getTime() - medDate.getTime()) / (1000 * 60 * 60 * 24));
            
            if (daysDiff < 90) { // Within 3 months
              evidence.push({
                type: "temporal",
                description: `${med.label} was started ${daysDiff.toFixed(0)} days before the ${labNode.label} change`,
                date: med.startDate,
                source: med.source,
              });
            }
          }
        }
      }

      // Generate AI explanation
      try {
        explanation = await this.generateAIExplanation(labNode, trend, medications, conditions);
      } catch (error) {
        explanation = `Your ${labNode.label} has been ${trendDirection} over time, changing by ${percentChange}% since ${firstPoint.date}. ` +
          `The current value is ${lastPoint.value} ${labNode.metadata?.unit || ''}. ` +
          (medications.length > 0 ? `This lab is monitored alongside your medications including ${medications.map(m => m.label).join(", ")}.` : "");
      }
    } else {
      explanation = `Your ${labNode.label} result is ${labNode.metadata?.value || "recorded"} ${labNode.metadata?.unit || ""}. ` +
        `This test was performed at ${labNode.source}.`;
    }

    console.log(`[HIPAA-AUDIT] Lab trend explanation generated - Patient: ${patientId}, Lab: ${labNodeId}`);

    return {
      explanationId: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      explanationType: "trend",
      title: `Understanding Your ${labNode.label} Results`,
      explanation,
      summary: `${labNode.label} trend analysis with ${evidence.length} supporting data points`,
      confidence: 0.85,
      relatedItems: relatedNodes.map(n => n.label),
      evidence,
      generatedAt: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  }

  private async generateAIExplanation(
    labNode: HealthNode,
    trend: Array<{ date: string; value: number }>,
    medications: HealthNode[],
    conditions: HealthNode[]
  ): Promise<string> {
    const prompt = `Explain this lab result trend to a patient in simple, clear language:

Lab Test: ${labNode.label}
Reference Range: ${labNode.metadata?.referenceRange || 'Not specified'}
Unit: ${labNode.metadata?.unit || ''}

Trend Data:
${trend.map(t => `- ${t.date}: ${t.value}`).join('\n')}

Related Medications (currently on):
${medications.map(m => `- ${m.label}, started ${m.startDate}`).join('\n') || 'None recorded'}

Related Conditions:
${conditions.map(c => `- ${c.label}, since ${c.startDate}`).join('\n') || 'None recorded'}

Instructions:
1. Describe what this lab measures in simple terms
2. Explain the trend (rising/falling/stable) and what it might indicate
3. If a medication correlates temporally with a trend change, mention it clearly (e.g., "Your creatinine began rising after you started taking [medication] in [year]")
4. Avoid medical jargon
5. Do NOT provide medical advice or treatment recommendations
6. Keep it under 200 words`;

    const text = await generatePhiSafeText({
      system: "You are a health educator explaining lab results to patients. Use clear, simple language. Never provide medical advice - only educational explanations. Always suggest discussing findings with their healthcare provider.",
      user: prompt,
      maxTokens: 400,
      temperature: 0.7,
    });

    return text || "Unable to generate explanation.";
  }

  async analyzeMedicationEffects(patientId: string, medicationNodeId: string): Promise<MedicationEffect> {
    const graph = await healthGraphService.getGraph(patientId);
    if (!graph) {
      throw new Error("Patient graph not found");
    }

    const medNode = graph.nodes.find(n => n.id === medicationNodeId && n.nodeType === "medication");
    if (!medNode) {
      throw new Error("Medication not found");
    }

    // Find labs that might be affected
    const labEffects: LabEffect[] = [];
    const labNodes = graph.nodes.filter(n => n.nodeType === "lab" && n.metadata?.trend);

    for (const lab of labNodes) {
      const trend = lab.metadata.trend as Array<{ date: string; value: number }>;
      if (!medNode.startDate || !trend?.length) continue;

      const medStartDate = new Date(medNode.startDate);
      const beforeValues = trend.filter(t => new Date(t.date) < medStartDate);
      const afterValues = trend.filter(t => new Date(t.date) >= medStartDate);

      if (beforeValues.length > 0 && afterValues.length > 0) {
        const avgBefore = beforeValues.reduce((sum, t) => sum + t.value, 0) / beforeValues.length;
        const avgAfter = afterValues.reduce((sum, t) => sum + t.value, 0) / afterValues.length;
        const percentChange = ((avgAfter - avgBefore) / avgBefore * 100);

        let change: LabEffect["change"] = "stable";
        if (percentChange > 10) change = "increased";
        else if (percentChange < -10) change = "decreased";

        labEffects.push({
          labName: lab.label,
          beforeValue: avgBefore,
          afterValue: avgAfter,
          change,
          percentChange,
          explanation: change !== "stable" 
            ? `Your ${lab.label} ${change} by ${Math.abs(percentChange).toFixed(1)}% after starting ${medNode.label}`
            : `Your ${lab.label} has remained stable since starting ${medNode.label}`,
        });
      }
    }

    // Find conditions that might be affected
    const conditionEffects: ConditionEffect[] = [];
    const relatedEdges = graph.edges.filter(e => 
      (e.sourceNodeId === medicationNodeId && e.relationshipType === "treats") ||
      (e.targetNodeId === medicationNodeId && e.relationshipType === "treats")
    );

    for (const edge of relatedEdges) {
      const conditionId = edge.sourceNodeId === medicationNodeId ? edge.targetNodeId : edge.sourceNodeId;
      const condition = graph.nodes.find(n => n.id === conditionId);
      
      if (condition) {
        conditionEffects.push({
          conditionName: condition.label,
          statusChange: condition.status === "active" && condition.metadata?.controlled ? "improved" : "stable",
          evidence: `${medNode.label} is prescribed to manage ${condition.label}`,
        });
      }
    }

    const overallAssessment = await this.generateMedicationAssessment(medNode, labEffects, conditionEffects);

    console.log(`[HIPAA-AUDIT] Medication effects analyzed - Patient: ${patientId}, Medication: ${medicationNodeId}`);

    return {
      medicationName: medNode.label,
      medicationCode: medNode.code || "",
      startDate: medNode.startDate || "",
      affectedLabs: labEffects,
      affectedConditions: conditionEffects,
      overallAssessment,
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  }

  private async generateMedicationAssessment(
    medication: HealthNode,
    labEffects: LabEffect[],
    conditionEffects: ConditionEffect[]
  ): Promise<string> {
    try {
      const prompt = `Summarize the observed effects of this medication for a patient:

Medication: ${medication.label}
Started: ${medication.startDate}
Dosage: ${medication.metadata?.dosage || 'Not specified'}

Lab Changes Observed:
${labEffects.map(l => `- ${l.labName}: ${l.change} by ${l.percentChange?.toFixed(1)}%`).join('\n') || 'No significant changes'}

Condition Status:
${conditionEffects.map(c => `- ${c.conditionName}: ${c.statusChange}`).join('\n') || 'No conditions linked'}

Write a 2-3 sentence patient-friendly summary. Do NOT provide medical advice.`;

      const text = await generatePhiSafeText({
        system: "You are a health educator. Summarize medication effects objectively without providing medical advice.",
        user: prompt,
        maxTokens: 200,
        temperature: 0.7,
      });

      return text || "Unable to generate assessment.";
    } catch (error) {
      return `${medication.label} has been taken since ${medication.startDate}. ` +
        (labEffects.length > 0 ? `Some lab values have changed since starting this medication. ` : "") +
        "Discuss any concerns with your healthcare provider.";
    }
  }

  async generateHealthNarrative(patientId: string): Promise<HealthNarrative> {
    const graph = await healthGraphService.getGraph(patientId);
    if (!graph) {
      throw new Error("Patient graph not found");
    }

    const sections: NarrativeSection[] = [];

    // Group by episodes
    for (const episode of graph.episodes) {
      const episodeNodes = graph.nodes.filter(n => episode.nodeIds.includes(n.id));
      
      sections.push({
        title: episode.title,
        content: await this.generateEpisodeNarrative(episode, episodeNodes),
        relatedNodeIds: episode.nodeIds,
        timeframe: { start: episode.startDate, end: episode.endDate || new Date().toISOString().split('T')[0] },
      });
    }

    // Generate overall narrative
    const narrative = await this.generateOverallNarrative(graph, sections);

    console.log(`[HIPAA-AUDIT] Health narrative generated - Patient: ${patientId}`);

    return {
      patientId,
      narrative,
      sections,
      generatedAt: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  }

  private async generateEpisodeNarrative(episode: any, nodes: HealthNode[]): Promise<string> {
    const conditions = nodes.filter(n => n.nodeType === "condition");
    const medications = nodes.filter(n => n.nodeType === "medication");
    const labs = nodes.filter(n => n.nodeType === "lab");
    const specialists = nodes.filter(n => n.nodeType === "specialist");

    try {
      const prompt = `Write a brief, patient-friendly narrative about this health episode:

Episode: ${episode.title}
Type: ${episode.episodeType}
Started: ${episode.startDate}
Status: ${episode.status}

Conditions: ${conditions.map(c => c.label).join(", ") || "None"}
Medications: ${medications.map(m => m.label).join(", ") || "None"}
Specialists: ${specialists.map(s => s.label).join(", ") || "None"}
Outcomes: ${episode.outcomes?.join("; ") || "Ongoing"}

Write 2-3 sentences explaining this health journey. Use first person ("Your..."). No medical advice.`;

      const text = await generatePhiSafeText({
        system: "You are a health educator helping patients understand their health journey. Be warm, clear, and supportive.",
        user: prompt,
        maxTokens: 150,
        temperature: 0.7,
      });

      return text || episode.description;
    } catch (error) {
      return episode.description;
    }
  }

  private async generateOverallNarrative(graph: HealthGraph, sections: NarrativeSection[]): Promise<string> {
    const conditionCount = graph.nodes.filter(n => n.nodeType === "condition").length;
    const medicationCount = graph.nodes.filter(n => n.nodeType === "medication").length;
    const specialistCount = graph.nodes.filter(n => n.nodeType === "specialist").length;

    try {
      const prompt = `Write a brief health summary paragraph for a patient:

Active Conditions: ${conditionCount}
Current Medications: ${medicationCount}
Care Team Size: ${specialistCount} specialists

Health Episodes:
${sections.map(s => `- ${s.title}`).join('\n')}

Write a 3-4 sentence overview. Use "you/your" language. Mention key health areas and care coordination. No medical advice.`;

      const text = await generatePhiSafeText({
        system: "You are a health educator summarizing a patient's health journey. Be encouraging and clear.",
        user: prompt,
        maxTokens: 200,
        temperature: 0.7,
      });

      return text ||
        `Your health record shows ${conditionCount} conditions being managed with ${medicationCount} medications and ${specialistCount} specialists.`;
    } catch (error) {
      return `Your health record includes ${conditionCount} conditions, ${medicationCount} medications, and care from ${specialistCount} specialists. ` +
        `You have ${sections.length} distinct health episodes being tracked.`;
    }
  }

  async explainCorrelation(patientId: string, nodeId1: string, nodeId2: string): Promise<ChartExplanation> {
    const graph = await healthGraphService.getGraph(patientId);
    if (!graph) {
      throw new Error("Patient graph not found");
    }

    const node1 = graph.nodes.find(n => n.id === nodeId1);
    const node2 = graph.nodes.find(n => n.id === nodeId2);

    if (!node1 || !node2) {
      throw new Error("One or both nodes not found");
    }

    const edge = graph.edges.find(e => 
      (e.sourceNodeId === nodeId1 && e.targetNodeId === nodeId2) ||
      (e.sourceNodeId === nodeId2 && e.targetNodeId === nodeId1)
    );

    const evidence: ExplanationEvidence[] = [];

    if (node1.startDate) {
      evidence.push({
        type: "temporal",
        description: `${node1.label} started on ${node1.startDate}`,
        date: node1.startDate,
      });
    }

    if (node2.startDate) {
      evidence.push({
        type: "temporal",
        description: `${node2.label} started on ${node2.startDate}`,
        date: node2.startDate,
      });
    }

    if (edge) {
      evidence.push({
        type: "clinical_pattern",
        description: `Known relationship: ${edge.relationshipType} (${(edge.confidence * 100).toFixed(0)}% confidence)`,
      });
      edge.evidence.forEach(e => {
        evidence.push({
          type: "clinical_pattern",
          description: e,
        });
      });
    }

    // Generate AI explanation
    let explanation = "";
    try {
      const prompt = `Explain the relationship between these two health items:

Item 1: ${node1.label} (${node1.nodeType})
- Started: ${node1.startDate || 'unknown'}
${node1.metadata ? `- Details: ${JSON.stringify(node1.metadata)}` : ''}

Item 2: ${node2.label} (${node2.nodeType})
- Started: ${node2.startDate || 'unknown'}
${node2.metadata ? `- Details: ${JSON.stringify(node2.metadata)}` : ''}

${edge ? `Known relationship: ${edge.relationshipType}` : 'No direct relationship recorded'}

Write a clear, patient-friendly explanation of how these might be connected. If temporal patterns exist (one started before/after the other), mention this specifically.
Example: "Your rising creatinine began after starting lisinopril in 2022 and has progressed gradually."

Do NOT provide medical advice.`;

      explanation = await generatePhiSafeText({
        system: "You are a health educator explaining medical correlations. Use simple language, mention specific dates when relevant. Never provide medical advice.",
        user: prompt,
        maxTokens: 300,
        temperature: 0.7,
      }) || "";
    } catch (error) {
      explanation = `${node1.label} and ${node2.label} are both part of your health record. ` +
        (edge ? `They appear to be related (${edge.relationshipType}).` : "Please discuss how they might be connected with your healthcare provider.");
    }

    console.log(`[HIPAA-AUDIT] Correlation explained - Patient: ${patientId}, Nodes: ${nodeId1}, ${nodeId2}`);

    return {
      explanationId: `exp_corr_${Date.now()}`,
      explanationType: "correlation",
      title: `How ${node1.label} Relates to ${node2.label}`,
      explanation,
      summary: `Analysis of relationship between ${node1.label} and ${node2.label}`,
      confidence: edge?.confidence || 0.7,
      relatedItems: [node1.label, node2.label],
      evidence,
      generatedAt: new Date().toISOString(),
      noCdsDisclaimer: NO_CDS_DISCLAIMER,
    };
  }

  async getSmartInsights(patientId: string): Promise<ChartExplanation[]> {
    const graph = await healthGraphService.getGraph(patientId);
    if (!graph) return [];

    const insights: ChartExplanation[] = [];

    // Find medication-lab correlations
    const medications = graph.nodes.filter(n => n.nodeType === "medication" && n.startDate);
    const labs = graph.nodes.filter(n => n.nodeType === "lab" && n.metadata?.trend);

    for (const med of medications) {
      for (const lab of labs) {
        const trend = lab.metadata.trend as Array<{ date: string; value: number }>;
        if (!trend?.length) continue;

        const medDate = new Date(med.startDate!);
        
        // Find if lab changed significantly after medication start
        const beforeTrend = trend.filter(t => new Date(t.date) < medDate);
        const afterTrend = trend.filter(t => new Date(t.date) >= medDate);

        if (beforeTrend.length > 0 && afterTrend.length > 0) {
          const avgBefore = beforeTrend.reduce((s, t) => s + t.value, 0) / beforeTrend.length;
          const avgAfter = afterTrend.reduce((s, t) => s + t.value, 0) / afterTrend.length;
          const pctChange = ((avgAfter - avgBefore) / avgBefore) * 100;

          if (Math.abs(pctChange) > 15) {
            const direction = pctChange > 0 ? "began rising" : "began falling";
            const year = medDate.getFullYear();

            insights.push({
              explanationId: `insight_${med.id}_${lab.id}`,
              explanationType: "medication_effect",
              title: `${lab.label} Change After ${med.label}`,
              explanation: `Your ${lab.label} ${direction} after starting ${med.label} in ${year} and has ${pctChange > 0 ? "increased" : "decreased"} by ${Math.abs(pctChange).toFixed(1)}% since then.`,
              summary: `Temporal correlation between ${med.label} and ${lab.label}`,
              confidence: 0.75,
              relatedItems: [med.label, lab.label],
              evidence: [
                { type: "temporal", description: `${med.label} started ${med.startDate}` },
                { type: "data_point", description: `${lab.label} average before: ${avgBefore.toFixed(2)}` },
                { type: "data_point", description: `${lab.label} average after: ${avgAfter.toFixed(2)}` },
              ],
              generatedAt: new Date().toISOString(),
              noCdsDisclaimer: NO_CDS_DISCLAIMER,
            });
          }
        }
      }
    }

    console.log(`[HIPAA-AUDIT] Smart insights generated - Patient: ${patientId}, Count: ${insights.length}`);
    return insights;
  }
}

export const aiChartExplanationService = new AIChartExplanationService();
