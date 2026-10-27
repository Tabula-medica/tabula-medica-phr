interface GraphNode {
  id: string;
  type: "medication" | "diagnosis" | "lab" | "procedure" | "imaging" | "specialist" | "episode" | "therapy" | "outcome" | "vital" | "allergy" | "immunization" | "symptom";
  label: string;
  data: Record<string, any>;
  metadata: {
    sourceId: string;
    sourceName: string;
    recordDate: Date;
    confidence: number;
    fhirResourceType?: string;
    codes?: Array<{ system: string; code: string; display: string }>;
  };
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: EdgeRelationship;
  strength: number;
  evidence: EdgeEvidence[];
  inferredBy?: "temporal" | "clinical_rule" | "ai_analysis" | "explicit";
  confidence: number;
  metadata: {
    createdAt: Date;
    lastValidated?: Date;
    validatedBy?: string;
  };
}

type EdgeRelationship = 
  | "treats" | "caused_by" | "resulted_in" | "monitored_by" | "ordered_for"
  | "performed_by" | "revealed" | "led_to" | "contraindicated_with"
  | "alternative_to" | "part_of_episode" | "follow_up_for" | "adjusted_due_to"
  | "correlates_with" | "preceded" | "administered_during" | "indicated_by"
  | "symptom_of" | "side_effect_of" | "exacerbates" | "alleviates" | "co_occurs_with"
  | "reported_before" | "triggered_by";

interface EdgeEvidence {
  type: "temporal" | "code_relationship" | "clinical_guideline" | "provider_note" | "ai_inference";
  description: string;
  confidence: number;
  source?: string;
}

interface Episode {
  id: string;
  type: "acute" | "chronic" | "preventive" | "surgical" | "diagnostic" | "emergency";
  title: string;
  description: string;
  startDate: Date;
  endDate?: Date;
  status: "active" | "resolved" | "ongoing" | "monitoring";
  primaryDiagnosis?: string;
  relatedNodes: string[];
  timeline: EpisodeEvent[];
  outcomes: EpisodeOutcome[];
  providers: string[];
  totalCost?: number;
  qualityMetrics?: Record<string, number>;
}

interface EpisodeEvent {
  nodeId: string;
  nodeType: GraphNode["type"];
  date: Date;
  description: string;
  significance: "critical" | "major" | "routine" | "minor";
}

interface EpisodeOutcome {
  metric: string;
  baseline?: number;
  current: number;
  target?: number;
  trend: "improving" | "stable" | "worsening" | "unknown";
  lastMeasured: Date;
}

interface HealthGraph {
  patientId: string;
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  episodes: Map<string, Episode>;
  lastUpdated: Date;
  statistics: GraphStatistics;
}

interface GraphStatistics {
  totalNodes: number;
  totalEdges: number;
  totalEpisodes: number;
  nodesByType: Record<string, number>;
  edgesByRelationship: Record<string, number>;
  averageNodeConnections: number;
  longestEpisodeDays: number;
  mostConnectedNodes: Array<{ id: string; label: string; connections: number }>;
}

interface GraphQuery {
  startNode?: string;
  nodeTypes?: GraphNode["type"][];
  relationships?: EdgeRelationship[];
  dateRange?: { start: Date; end: Date };
  minConfidence?: number;
  maxDepth?: number;
  includeInferred?: boolean;
}

interface PathResult {
  path: GraphNode[];
  edges: GraphEdge[];
  totalConfidence: number;
  clinicalNarrative: string;
}

const clinicalRelationshipRules: Array<{
  sourceType: GraphNode["type"];
  targetType: GraphNode["type"];
  relationship: EdgeRelationship;
  condition?: (source: GraphNode, target: GraphNode) => boolean;
  confidence: number;
}> = [
  { sourceType: "medication", targetType: "diagnosis", relationship: "treats", confidence: 0.9 },
  { sourceType: "diagnosis", targetType: "medication", relationship: "indicated_by", confidence: 0.85 },
  { sourceType: "diagnosis", targetType: "lab", relationship: "monitored_by", confidence: 0.8 },
  { sourceType: "lab", targetType: "diagnosis", relationship: "revealed", confidence: 0.85 },
  { sourceType: "diagnosis", targetType: "procedure", relationship: "led_to", confidence: 0.75 },
  { sourceType: "procedure", targetType: "outcome", relationship: "resulted_in", confidence: 0.9 },
  { sourceType: "imaging", targetType: "diagnosis", relationship: "revealed", confidence: 0.85 },
  { sourceType: "specialist", targetType: "procedure", relationship: "performed_by", confidence: 0.95 },
  { sourceType: "medication", targetType: "lab", relationship: "monitored_by", confidence: 0.7 },
  { sourceType: "medication", targetType: "medication", relationship: "contraindicated_with", confidence: 0.95 },
  { sourceType: "diagnosis", targetType: "imaging", relationship: "ordered_for", confidence: 0.8 },
  { sourceType: "vital", targetType: "medication", relationship: "adjusted_due_to", confidence: 0.65 },
  { sourceType: "lab", targetType: "therapy", relationship: "led_to", confidence: 0.75 },
  { sourceType: "immunization", targetType: "diagnosis", relationship: "alternative_to", confidence: 0.8 },
  { sourceType: "symptom", targetType: "diagnosis", relationship: "symptom_of", confidence: 0.75 },
  { sourceType: "symptom", targetType: "medication", relationship: "side_effect_of", confidence: 0.7 },
  { sourceType: "medication", targetType: "symptom", relationship: "alleviates", confidence: 0.65 },
  { sourceType: "symptom", targetType: "symptom", relationship: "co_occurs_with", confidence: 0.6 },
  { sourceType: "diagnosis", targetType: "symptom", relationship: "caused_by", confidence: 0.8 },
  { sourceType: "symptom", targetType: "lab", relationship: "monitored_by", confidence: 0.6 },
  { sourceType: "symptom", targetType: "procedure", relationship: "led_to", confidence: 0.65 },
  { sourceType: "vital", targetType: "symptom", relationship: "triggered_by", confidence: 0.55 },
  { sourceType: "symptom", targetType: "imaging", relationship: "ordered_for", confidence: 0.6 },
  { sourceType: "allergy", targetType: "symptom", relationship: "caused_by", confidence: 0.85 }
];

class HealthGraphService {
  private graphs: Map<string, HealthGraph> = new Map();

  async buildGraph(patientId: string, healthRecords: any[]): Promise<HealthGraph> {
    const graph: HealthGraph = {
      patientId,
      nodes: new Map(),
      edges: new Map(),
      episodes: new Map(),
      lastUpdated: new Date(),
      statistics: this.initializeStatistics()
    };

    for (const record of healthRecords) {
      const node = this.recordToNode(record);
      graph.nodes.set(node.id, node);
    }

    this.inferEdges(graph);
    this.detectEpisodes(graph);
    this.calculateStatistics(graph);

    this.graphs.set(patientId, graph);
    return graph;
  }

  private recordToNode(record: any): GraphNode {
    const typeMapping: Record<string, GraphNode["type"]> = {
      medication: "medication",
      condition: "diagnosis",
      lab: "lab",
      procedure: "procedure",
      imaging: "imaging",
      vital: "vital",
      allergy: "allergy",
      immunization: "immunization",
      visit: "episode",
      symptom: "symptom"
    };

    const nodeType = typeMapping[record.type] || "diagnosis";

    return {
      id: record.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: nodeType,
      label: record.title || record.name || "Unknown",
      data: {
        ...record.details,
        summary: record.summary,
        provider: record.provider,
        facility: record.facility
      },
      metadata: {
        sourceId: record.sourceId || "unknown",
        sourceName: record.sourceName || "Unknown Source",
        recordDate: new Date(record.date),
        confidence: 0.9,
        fhirResourceType: record.fhirResourceType,
        codes: this.extractCodes(record)
      }
    };
  }

  private extractCodes(record: any): Array<{ system: string; code: string; display: string }> {
    const codes: Array<{ system: string; code: string; display: string }> = [];
    
    if (record.details?.code) {
      codes.push({
        system: record.details.system || "unknown",
        code: record.details.code,
        display: record.title || ""
      });
    }
    
    if (record.details?.loincCode) {
      codes.push({
        system: "http://loinc.org",
        code: record.details.loincCode,
        display: record.title || ""
      });
    }
    
    if (record.details?.rxnormCode) {
      codes.push({
        system: "http://www.nlm.nih.gov/research/umls/rxnorm",
        code: record.details.rxnormCode,
        display: record.title || ""
      });
    }
    
    if (record.details?.snomedCode) {
      codes.push({
        system: "http://snomed.info/sct",
        code: record.details.snomedCode,
        display: record.title || ""
      });
    }
    
    return codes;
  }

  private inferEdges(graph: HealthGraph): void {
    const nodes = Array.from(graph.nodes.values());

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const source = nodes[i];
        const target = nodes[j];

        const temporalEdge = this.checkTemporalRelationship(source, target);
        if (temporalEdge) {
          graph.edges.set(temporalEdge.id, temporalEdge);
        }

        for (const rule of clinicalRelationshipRules) {
          if (this.matchesRule(source, target, rule)) {
            const edge = this.createEdgeFromRule(source, target, rule);
            graph.edges.set(edge.id, edge);
          }
          if (this.matchesRule(target, source, rule)) {
            const edge = this.createEdgeFromRule(target, source, rule);
            graph.edges.set(edge.id, edge);
          }
        }

        const codeEdge = this.checkCodeRelationship(source, target);
        if (codeEdge) {
          graph.edges.set(codeEdge.id, codeEdge);
        }
      }
    }
  }

  private checkTemporalRelationship(source: GraphNode, target: GraphNode): GraphEdge | null {
    const sourceDate = source.metadata.recordDate;
    const targetDate = target.metadata.recordDate;
    
    const daysDiff = Math.abs(targetDate.getTime() - sourceDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff <= 7) {
      const earlier = sourceDate < targetDate ? source : target;
      const later = sourceDate < targetDate ? target : source;
      
      if (earlier.type === "diagnosis" && later.type === "medication") {
        return this.createEdge(earlier, later, "led_to", 0.7, "temporal", [
          { type: "temporal", description: `${later.label} prescribed within 7 days of ${earlier.label} diagnosis`, confidence: 0.7 }
        ]);
      }
      
      if (earlier.type === "lab" && later.type === "diagnosis") {
        return this.createEdge(earlier, later, "revealed", 0.6, "temporal", [
          { type: "temporal", description: `${later.label} diagnosed after abnormal ${earlier.label} result`, confidence: 0.6 }
        ]);
      }

      if (earlier.type === "symptom" && later.type === "diagnosis") {
        return this.createEdge(earlier, later, "reported_before", 0.75, "temporal", [
          { type: "temporal", description: `${earlier.label} reported ${Math.round(daysDiff)} days before ${later.label} diagnosis`, confidence: 0.75 }
        ]);
      }

      if (earlier.type === "medication" && later.type === "symptom") {
        return this.createEdge(earlier, later, "side_effect_of", 0.65, "temporal", [
          { type: "temporal", description: `${later.label} appeared ${Math.round(daysDiff)} days after starting ${earlier.label}`, confidence: 0.65 }
        ]);
      }

      if (earlier.type === "symptom" && later.type === "medication") {
        return this.createEdge(earlier, later, "led_to", 0.7, "temporal", [
          { type: "temporal", description: `${later.label} prescribed ${Math.round(daysDiff)} days after ${earlier.label} reported`, confidence: 0.7 }
        ]);
      }

      if (earlier.type === "symptom" && later.type === "lab") {
        return this.createEdge(earlier, later, "led_to", 0.6, "temporal", [
          { type: "temporal", description: `${later.label} ordered ${Math.round(daysDiff)} days after ${earlier.label} reported`, confidence: 0.6 }
        ]);
      }
    }

    if (daysDiff <= 3 && source.type === "symptom" && target.type === "symptom") {
      return this.createEdge(source, target, "co_occurs_with", 0.7, "temporal", [
        { type: "temporal", description: `${source.label} and ${target.label} reported within ${Math.round(daysDiff)} days of each other`, confidence: 0.7 }
      ]);
    }
    
    return null;
  }

  private matchesRule(source: GraphNode, target: GraphNode, rule: typeof clinicalRelationshipRules[0]): boolean {
    if (source.type !== rule.sourceType || target.type !== rule.targetType) {
      return false;
    }
    
    if (rule.condition && !rule.condition(source, target)) {
      return false;
    }
    
    return true;
  }

  private createEdgeFromRule(source: GraphNode, target: GraphNode, rule: typeof clinicalRelationshipRules[0]): GraphEdge {
    return this.createEdge(source, target, rule.relationship, rule.confidence, "clinical_rule", [
      { type: "clinical_guideline", description: `Clinical rule: ${source.type} ${rule.relationship} ${target.type}`, confidence: rule.confidence }
    ]);
  }

  private checkCodeRelationship(source: GraphNode, target: GraphNode): GraphEdge | null {
    if (!source.metadata.codes?.length || !target.metadata.codes?.length) {
      return null;
    }

    for (const sourceCode of source.metadata.codes) {
      for (const targetCode of target.metadata.codes) {
        if (sourceCode.system === targetCode.system) {
          return this.createEdge(source, target, "correlates_with", 0.8, "clinical_rule", [
            { type: "code_relationship", description: `Shared coding system: ${sourceCode.system}`, confidence: 0.8 }
          ]);
        }
      }
    }
    
    return null;
  }

  private createEdge(
    source: GraphNode,
    target: GraphNode,
    relationship: EdgeRelationship,
    confidence: number,
    inferredBy: GraphEdge["inferredBy"],
    evidence: EdgeEvidence[]
  ): GraphEdge {
    return {
      id: `edge_${source.id}_${target.id}_${relationship}`,
      source: source.id,
      target: target.id,
      relationship,
      strength: confidence,
      evidence,
      inferredBy,
      confidence,
      metadata: {
        createdAt: new Date()
      }
    };
  }

  private detectEpisodes(graph: HealthGraph): void {
    const nodesByDate = Array.from(graph.nodes.values())
      .sort((a, b) => a.metadata.recordDate.getTime() - b.metadata.recordDate.getTime());

    const diagnosisNodes = nodesByDate.filter(n => n.type === "diagnosis");
    
    for (const diagnosis of diagnosisNodes) {
      const relatedNodes = this.findRelatedNodes(graph, diagnosis.id, 3);
      
      if (relatedNodes.length >= 2) {
        const episode = this.createEpisode(diagnosis, relatedNodes, graph);
        graph.episodes.set(episode.id, episode);
      }
    }

    const procedureNodes = nodesByDate.filter(n => n.type === "procedure");
    for (const procedure of procedureNodes) {
      const relatedNodes = this.findRelatedNodes(graph, procedure.id, 2);
      
      if (relatedNodes.length >= 1) {
        const existing = Array.from(graph.episodes.values())
          .find(e => e.relatedNodes.includes(procedure.id));
        
        if (!existing) {
          const episode = this.createEpisode(procedure, relatedNodes, graph, "surgical");
          graph.episodes.set(episode.id, episode);
        }
      }
    }
  }

  private findRelatedNodes(graph: HealthGraph, nodeId: string, maxDepth: number): string[] {
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];
    const related: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current.id) || current.depth > maxDepth) continue;
      visited.add(current.id);
      
      if (current.id !== nodeId) {
        related.push(current.id);
      }

      for (const edge of graph.edges.values()) {
        if (edge.source === current.id && !visited.has(edge.target)) {
          queue.push({ id: edge.target, depth: current.depth + 1 });
        }
        if (edge.target === current.id && !visited.has(edge.source)) {
          queue.push({ id: edge.source, depth: current.depth + 1 });
        }
      }
    }

    return related;
  }

  private createEpisode(
    primaryNode: GraphNode,
    relatedNodes: string[],
    graph: HealthGraph,
    episodeType?: Episode["type"]
  ): Episode {
    const allNodeIds = [primaryNode.id, ...relatedNodes];
    const allNodes = allNodeIds.map(id => graph.nodes.get(id)!).filter(Boolean);
    
    const dates = allNodes.map(n => n.metadata.recordDate);
    const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const endDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    const daysDuration = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const isOngoing = daysDuration < 30 || allNodes.some(n => n.type === "medication" && n.data.status === "active");

    const timeline: EpisodeEvent[] = allNodes
      .sort((a, b) => a.metadata.recordDate.getTime() - b.metadata.recordDate.getTime())
      .map(node => ({
        nodeId: node.id,
        nodeType: node.type,
        date: node.metadata.recordDate,
        description: node.label,
        significance: this.determineSignificance(node)
      }));

    const providers = [...new Set(allNodes.map(n => n.data.provider).filter(Boolean))];

    return {
      id: `episode_${primaryNode.id}_${Date.now()}`,
      type: episodeType || this.inferEpisodeType(primaryNode, allNodes),
      title: `${primaryNode.label} Care Episode`,
      description: this.generateEpisodeDescription(primaryNode, allNodes),
      startDate,
      endDate: isOngoing ? undefined : endDate,
      status: isOngoing ? "ongoing" : "resolved",
      primaryDiagnosis: primaryNode.type === "diagnosis" ? primaryNode.label : undefined,
      relatedNodes: allNodeIds,
      timeline,
      outcomes: this.extractOutcomes(allNodes),
      providers,
      qualityMetrics: this.calculateQualityMetrics(allNodes)
    };
  }

  private determineSignificance(node: GraphNode): EpisodeEvent["significance"] {
    if (node.type === "diagnosis" || node.type === "procedure") return "major";
    if (node.type === "imaging" || node.type === "specialist") return "major";
    if (node.data.critical || node.data.abnormal) return "critical";
    if (node.type === "symptom" && (node.data.severity === "severe" || node.data.severity >= 8)) return "major";
    if (node.type === "symptom") return "routine";
    if (node.type === "medication" || node.type === "lab") return "routine";
    return "minor";
  }

  private inferEpisodeType(primaryNode: GraphNode, allNodes: GraphNode[]): Episode["type"] {
    if (primaryNode.type === "procedure") return "surgical";
    if (allNodes.some(n => n.data.emergent || n.data.emergency)) return "emergency";
    if (allNodes.some(n => n.type === "immunization")) return "preventive";
    if (allNodes.length >= 5 && this.spansDays(allNodes) > 90) return "chronic";
    return "acute";
  }

  private spansDays(nodes: GraphNode[]): number {
    const dates = nodes.map(n => n.metadata.recordDate.getTime());
    return (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24);
  }

  private generateEpisodeDescription(primaryNode: GraphNode, allNodes: GraphNode[]): string {
    const medications = allNodes.filter(n => n.type === "medication").map(n => n.label);
    const labs = allNodes.filter(n => n.type === "lab").map(n => n.label);
    const procedures = allNodes.filter(n => n.type === "procedure").map(n => n.label);
    
    const symptoms = allNodes.filter(n => n.type === "symptom").map(n => n.label);

    let description = `Care episode for ${primaryNode.label}`;
    
    if (symptoms.length > 0) {
      description += `. Reported symptoms: ${symptoms.slice(0, 3).join(", ")}`;
      if (symptoms.length > 3) description += ` and ${symptoms.length - 3} more`;
    }

    if (medications.length > 0) {
      description += `. Treatments: ${medications.slice(0, 3).join(", ")}`;
      if (medications.length > 3) description += ` and ${medications.length - 3} more`;
    }
    
    if (procedures.length > 0) {
      description += `. Procedures: ${procedures.join(", ")}`;
    }
    
    if (labs.length > 0) {
      description += `. Monitored with: ${labs.slice(0, 3).join(", ")}`;
    }
    
    return description;
  }

  private extractOutcomes(nodes: GraphNode[]): EpisodeOutcome[] {
    const outcomes: EpisodeOutcome[] = [];
    
    const labNodes = nodes.filter(n => n.type === "lab" && n.data.value !== undefined);
    
    const labsByType = new Map<string, GraphNode[]>();
    for (const lab of labNodes) {
      const key = lab.label;
      if (!labsByType.has(key)) labsByType.set(key, []);
      labsByType.get(key)!.push(lab);
    }
    
    for (const [labType, labs] of labsByType) {
      if (labs.length >= 2) {
        const sorted = labs.sort((a, b) => a.metadata.recordDate.getTime() - b.metadata.recordDate.getTime());
        const baseline = sorted[0].data.value;
        const current = sorted[sorted.length - 1].data.value;
        
        let trend: EpisodeOutcome["trend"] = "stable";
        if (current > baseline * 1.1) trend = "worsening";
        else if (current < baseline * 0.9) trend = "improving";
        
        outcomes.push({
          metric: labType,
          baseline,
          current,
          target: sorted[0].data.referenceRange?.high,
          trend,
          lastMeasured: sorted[sorted.length - 1].metadata.recordDate
        });
      }
    }
    
    return outcomes;
  }

  private calculateQualityMetrics(nodes: GraphNode[]): Record<string, number> {
    const metrics: Record<string, number> = {};
    
    const hasMedication = nodes.some(n => n.type === "medication");
    const hasLab = nodes.some(n => n.type === "lab");
    const hasFollowUp = nodes.filter(n => n.type === "diagnosis" || n.type === "procedure").length > 1;
    
    metrics.care_completeness = ((hasMedication ? 33 : 0) + (hasLab ? 33 : 0) + (hasFollowUp ? 34 : 0));
    metrics.documentation_quality = nodes.filter(n => (n.metadata.codes?.length ?? 0) > 0).length / nodes.length * 100;
    
    return metrics;
  }

  private initializeStatistics(): GraphStatistics {
    return {
      totalNodes: 0,
      totalEdges: 0,
      totalEpisodes: 0,
      nodesByType: {},
      edgesByRelationship: {},
      averageNodeConnections: 0,
      longestEpisodeDays: 0,
      mostConnectedNodes: []
    };
  }

  private calculateStatistics(graph: HealthGraph): void {
    graph.statistics.totalNodes = graph.nodes.size;
    graph.statistics.totalEdges = graph.edges.size;
    graph.statistics.totalEpisodes = graph.episodes.size;

    for (const node of graph.nodes.values()) {
      graph.statistics.nodesByType[node.type] = (graph.statistics.nodesByType[node.type] || 0) + 1;
    }

    for (const edge of graph.edges.values()) {
      graph.statistics.edgesByRelationship[edge.relationship] = 
        (graph.statistics.edgesByRelationship[edge.relationship] || 0) + 1;
    }

    const connectionCounts = new Map<string, number>();
    for (const edge of graph.edges.values()) {
      connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
      connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
    }

    if (connectionCounts.size > 0) {
      graph.statistics.averageNodeConnections = 
        Array.from(connectionCounts.values()).reduce((a, b) => a + b, 0) / connectionCounts.size;

      graph.statistics.mostConnectedNodes = Array.from(connectionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, connections]) => ({
          id,
          label: graph.nodes.get(id)?.label || "Unknown",
          connections
        }));
    }

    for (const episode of graph.episodes.values()) {
      if (episode.endDate) {
        const days = (episode.endDate.getTime() - episode.startDate.getTime()) / (1000 * 60 * 60 * 24);
        graph.statistics.longestEpisodeDays = Math.max(graph.statistics.longestEpisodeDays, days);
      }
    }
  }

  queryGraph(patientId: string, query: GraphQuery): { nodes: GraphNode[]; edges: GraphEdge[]; paths: PathResult[] } {
    const graph = this.graphs.get(patientId);
    if (!graph) {
      return { nodes: [], edges: [], paths: [] };
    }

    let filteredNodes = Array.from(graph.nodes.values());
    let filteredEdges = Array.from(graph.edges.values());

    if (query.nodeTypes?.length) {
      filteredNodes = filteredNodes.filter(n => query.nodeTypes!.includes(n.type));
    }

    if (query.dateRange) {
      filteredNodes = filteredNodes.filter(n => 
        n.metadata.recordDate >= query.dateRange!.start && 
        n.metadata.recordDate <= query.dateRange!.end
      );
    }

    if (query.minConfidence) {
      filteredNodes = filteredNodes.filter(n => n.metadata.confidence >= query.minConfidence!);
      filteredEdges = filteredEdges.filter(e => e.confidence >= query.minConfidence!);
    }

    if (!query.includeInferred) {
      filteredEdges = filteredEdges.filter(e => e.inferredBy === "explicit");
    }

    if (query.relationships?.length) {
      filteredEdges = filteredEdges.filter(e => query.relationships!.includes(e.relationship));
    }

    const nodeIds = new Set(filteredNodes.map(n => n.id));
    filteredEdges = filteredEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    const paths: PathResult[] = [];
    if (query.startNode) {
      const startPaths = this.findPaths(graph, query.startNode, query.maxDepth || 3);
      paths.push(...startPaths);
    }

    return { nodes: filteredNodes, edges: filteredEdges, paths };
  }

  private findPaths(graph: HealthGraph, startNodeId: string, maxDepth: number): PathResult[] {
    const paths: PathResult[] = [];
    const visited = new Set<string>();
    
    const dfs = (nodeId: string, currentPath: GraphNode[], currentEdges: GraphEdge[], depth: number) => {
      if (depth > maxDepth) return;
      
      const node = graph.nodes.get(nodeId);
      if (!node || visited.has(nodeId)) return;
      
      visited.add(nodeId);
      currentPath.push(node);

      if (currentPath.length >= 2) {
        paths.push({
          path: [...currentPath],
          edges: [...currentEdges],
          totalConfidence: currentEdges.reduce((sum, e) => sum * e.confidence, 1),
          clinicalNarrative: this.generatePathNarrative(currentPath, currentEdges)
        });
      }

      for (const edge of graph.edges.values()) {
        if (edge.source === nodeId && !visited.has(edge.target)) {
          dfs(edge.target, currentPath, [...currentEdges, edge], depth + 1);
        }
        if (edge.target === nodeId && !visited.has(edge.source)) {
          dfs(edge.source, currentPath, [...currentEdges, edge], depth + 1);
        }
      }

      currentPath.pop();
      visited.delete(nodeId);
    };

    dfs(startNodeId, [], [], 0);
    return paths.sort((a, b) => b.totalConfidence - a.totalConfidence).slice(0, 10);
  }

  private generatePathNarrative(path: GraphNode[], edges: GraphEdge[]): string {
    if (path.length < 2) return path[0]?.label || "";
    
    const parts: string[] = [path[0].label];
    
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const nextNode = path[i + 1];
      
      const relationshipText = this.relationshipToText(edge.relationship);
      parts.push(relationshipText);
      parts.push(nextNode.label);
    }
    
    return parts.join(" ");
  }

  private relationshipToText(relationship: EdgeRelationship): string {
    const mapping: Record<EdgeRelationship, string> = {
      treats: "is treated by",
      caused_by: "was caused by",
      resulted_in: "resulted in",
      monitored_by: "is monitored by",
      ordered_for: "was ordered for",
      performed_by: "was performed by",
      revealed: "revealed",
      led_to: "led to",
      contraindicated_with: "is contraindicated with",
      alternative_to: "is an alternative to",
      part_of_episode: "is part of",
      follow_up_for: "is follow-up for",
      adjusted_due_to: "was adjusted due to",
      correlates_with: "correlates with",
      preceded: "preceded",
      administered_during: "was administered during",
      indicated_by: "is indicated by",
      symptom_of: "is a symptom of",
      side_effect_of: "is a side effect of",
      exacerbates: "exacerbates",
      alleviates: "alleviates",
      co_occurs_with: "co-occurs with",
      reported_before: "was reported before",
      triggered_by: "was triggered by"
    };
    
    return mapping[relationship] || relationship;
  }

  addSymptomNode(patientId: string, symptomData: {
    name: string;
    severity: number;
    bodyLocation?: string;
    duration?: string;
    frequency?: string;
    triggers?: string[];
    notes?: string;
    onsetDate: Date;
    snomedCode?: string;
  }): GraphNode | null {
    const graph = this.graphs.get(patientId);
    if (!graph) return null;

    const codes: Array<{ system: string; code: string; display: string }> = [];
    if (symptomData.snomedCode) {
      codes.push({ system: "http://snomed.info/sct", code: symptomData.snomedCode, display: symptomData.name });
    }

    const node: GraphNode = {
      id: `symptom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: "symptom",
      label: symptomData.name,
      data: {
        severity: symptomData.severity,
        bodyLocation: symptomData.bodyLocation,
        duration: symptomData.duration,
        frequency: symptomData.frequency,
        triggers: symptomData.triggers || [],
        notes: symptomData.notes,
        reportedBy: "patient",
        status: "active"
      },
      metadata: {
        sourceId: "patient_reported",
        sourceName: "Patient Self-Report",
        recordDate: new Date(symptomData.onsetDate),
        confidence: 0.7,
        fhirResourceType: "Observation",
        codes
      }
    };

    graph.nodes.set(node.id, node);

    const existingNodes = Array.from(graph.nodes.values()).filter(n => n.id !== node.id);
    for (const existing of existingNodes) {
      for (const rule of clinicalRelationshipRules) {
        if (this.matchesRule(node, existing, rule)) {
          const edge = this.createEdgeFromRule(node, existing, rule);
          graph.edges.set(edge.id, edge);
        }
        if (this.matchesRule(existing, node, rule)) {
          const edge = this.createEdgeFromRule(existing, node, rule);
          graph.edges.set(edge.id, edge);
        }
      }

      const temporalEdge = this.checkTemporalRelationship(node, existing);
      if (temporalEdge) {
        graph.edges.set(temporalEdge.id, temporalEdge);
      }
    }

    this.calculateStatistics(graph);
    graph.lastUpdated = new Date();

    return node;
  }

  analyzeSymptomConditionLinks(patientId: string): {
    links: Array<{
      symptomId: string;
      symptomName: string;
      conditionId: string;
      conditionName: string;
      relationship: EdgeRelationship;
      confidence: number;
      evidence: string;
      temporalPattern: string;
    }>;
    unlinkedSymptoms: Array<{ id: string; name: string; severity: number; reportedDate: Date }>;
    symptomClusters: Array<{
      clusterId: string;
      symptoms: string[];
      possibleCondition: string;
      confidence: number;
    }>;
  } {
    const graph = this.graphs.get(patientId);
    if (!graph) return { links: [], unlinkedSymptoms: [], symptomClusters: [] };

    const symptomNodes = Array.from(graph.nodes.values()).filter(n => n.type === "symptom");
    const diagnosisNodes = Array.from(graph.nodes.values()).filter(n => n.type === "diagnosis");

    const links: Array<{
      symptomId: string;
      symptomName: string;
      conditionId: string;
      conditionName: string;
      relationship: EdgeRelationship;
      confidence: number;
      evidence: string;
      temporalPattern: string;
    }> = [];

    const linkedSymptomIds = new Set<string>();

    for (const edge of graph.edges.values()) {
      const source = graph.nodes.get(edge.source);
      const target = graph.nodes.get(edge.target);
      if (!source || !target) continue;

      if (source.type === "symptom" && target.type === "diagnosis") {
        links.push({
          symptomId: source.id,
          symptomName: source.label,
          conditionId: target.id,
          conditionName: target.label,
          relationship: edge.relationship,
          confidence: edge.confidence,
          evidence: edge.evidence.map(e => e.description).join("; "),
          temporalPattern: this.describeTemporalPattern(source, target)
        });
        linkedSymptomIds.add(source.id);
      } else if (target.type === "symptom" && source.type === "diagnosis") {
        links.push({
          symptomId: target.id,
          symptomName: target.label,
          conditionId: source.id,
          conditionName: source.label,
          relationship: edge.relationship,
          confidence: edge.confidence,
          evidence: edge.evidence.map(e => e.description).join("; "),
          temporalPattern: this.describeTemporalPattern(target, source)
        });
        linkedSymptomIds.add(target.id);
      }
    }

    const unlinkedSymptoms = symptomNodes
      .filter(s => !linkedSymptomIds.has(s.id))
      .map(s => ({
        id: s.id,
        name: s.label,
        severity: s.data.severity || 0,
        reportedDate: s.metadata.recordDate
      }));

    const symptomClusters = this.detectSymptomClusters(symptomNodes, diagnosisNodes, graph);

    return { links, unlinkedSymptoms, symptomClusters };
  }

  analyzeSymptomMedicationLinks(patientId: string): {
    sideEffects: Array<{
      symptomId: string;
      symptomName: string;
      medicationId: string;
      medicationName: string;
      confidence: number;
      onsetDelay: string;
      evidence: string;
    }>;
    alleviations: Array<{
      symptomId: string;
      symptomName: string;
      medicationId: string;
      medicationName: string;
      confidence: number;
      evidence: string;
    }>;
    untreatedSymptoms: Array<{ id: string; name: string; severity: number; durationDays: number }>;
  } {
    const graph = this.graphs.get(patientId);
    if (!graph) return { sideEffects: [], alleviations: [], untreatedSymptoms: [] };

    const symptomNodes = Array.from(graph.nodes.values()).filter(n => n.type === "symptom");
    const medicationNodes = Array.from(graph.nodes.values()).filter(n => n.type === "medication");

    const sideEffects: Array<{
      symptomId: string;
      symptomName: string;
      medicationId: string;
      medicationName: string;
      confidence: number;
      onsetDelay: string;
      evidence: string;
    }> = [];

    const alleviations: Array<{
      symptomId: string;
      symptomName: string;
      medicationId: string;
      medicationName: string;
      confidence: number;
      evidence: string;
    }> = [];

    const treatedSymptomIds = new Set<string>();

    for (const edge of graph.edges.values()) {
      const source = graph.nodes.get(edge.source);
      const target = graph.nodes.get(edge.target);
      if (!source || !target) continue;

      if (edge.relationship === "side_effect_of" || (source.type === "medication" && target.type === "symptom" && edge.relationship === "caused_by")) {
        const medNode = source.type === "medication" ? source : target;
        const symNode = source.type === "symptom" ? source : target;
        const daysDiff = Math.abs(symNode.metadata.recordDate.getTime() - medNode.metadata.recordDate.getTime()) / (1000 * 60 * 60 * 24);

        sideEffects.push({
          symptomId: symNode.id,
          symptomName: symNode.label,
          medicationId: medNode.id,
          medicationName: medNode.label,
          confidence: edge.confidence,
          onsetDelay: daysDiff < 1 ? "Same day" : `${Math.round(daysDiff)} days after starting medication`,
          evidence: edge.evidence.map(e => e.description).join("; ")
        });
      }

      if (edge.relationship === "alleviates" || edge.relationship === "treats") {
        const medNode = source.type === "medication" ? source : target;
        const symNode = source.type === "symptom" ? source : target;
        if (medNode.type === "medication" && symNode.type === "symptom") {
          treatedSymptomIds.add(symNode.id);
          alleviations.push({
            symptomId: symNode.id,
            symptomName: symNode.label,
            medicationId: medNode.id,
            medicationName: medNode.label,
            confidence: edge.confidence,
            evidence: edge.evidence.map(e => e.description).join("; ")
          });
        }
      }
    }

    const untreatedSymptoms = symptomNodes
      .filter(s => !treatedSymptomIds.has(s.id) && s.data.status === "active")
      .map(s => {
        const durationDays = (Date.now() - s.metadata.recordDate.getTime()) / (1000 * 60 * 60 * 24);
        return {
          id: s.id,
          name: s.label,
          severity: s.data.severity || 0,
          durationDays: Math.round(durationDays)
        };
      });

    return { sideEffects, alleviations, untreatedSymptoms };
  }

  getSymptomTimeline(patientId: string): {
    timeline: Array<{
      date: string;
      symptomId: string;
      symptomName: string;
      severity: number;
      status: string;
      linkedConditions: string[];
      linkedMedications: string[];
    }>;
    severityTrends: Array<{
      symptomName: string;
      dataPoints: Array<{ date: string; severity: number }>;
      trend: "improving" | "stable" | "worsening";
      averageSeverity: number;
    }>;
  } {
    const graph = this.graphs.get(patientId);
    if (!graph) return { timeline: [], severityTrends: [] };

    const symptomNodes = Array.from(graph.nodes.values())
      .filter(n => n.type === "symptom")
      .sort((a, b) => a.metadata.recordDate.getTime() - b.metadata.recordDate.getTime());

    const timeline = symptomNodes.map(symptom => {
      const linkedConditions: string[] = [];
      const linkedMedications: string[] = [];

      for (const edge of graph.edges.values()) {
        if (edge.source === symptom.id || edge.target === symptom.id) {
          const otherId = edge.source === symptom.id ? edge.target : edge.source;
          const other = graph.nodes.get(otherId);
          if (other?.type === "diagnosis") linkedConditions.push(other.label);
          if (other?.type === "medication") linkedMedications.push(other.label);
        }
      }

      return {
        date: symptom.metadata.recordDate.toISOString(),
        symptomId: symptom.id,
        symptomName: symptom.label,
        severity: symptom.data.severity || 0,
        status: symptom.data.status || "unknown",
        linkedConditions: [...new Set(linkedConditions)],
        linkedMedications: [...new Set(linkedMedications)]
      };
    });

    const symptomsByName = new Map<string, GraphNode[]>();
    for (const s of symptomNodes) {
      if (!symptomsByName.has(s.label)) symptomsByName.set(s.label, []);
      symptomsByName.get(s.label)!.push(s);
    }

    const severityTrends = Array.from(symptomsByName.entries())
      .filter(([_, nodes]) => nodes.length >= 2)
      .map(([name, nodes]) => {
        const sorted = nodes.sort((a, b) => a.metadata.recordDate.getTime() - b.metadata.recordDate.getTime());
        const dataPoints = sorted.map(n => ({
          date: n.metadata.recordDate.toISOString(),
          severity: n.data.severity || 0
        }));
        const severities = dataPoints.map(d => d.severity);
        const averageSeverity = severities.reduce((a, b) => a + b, 0) / severities.length;
        const first = severities[0];
        const last = severities[severities.length - 1];
        let trend: "improving" | "stable" | "worsening" = "stable";
        if (last < first * 0.8) trend = "improving";
        else if (last > first * 1.2) trend = "worsening";

        return { symptomName: name, dataPoints, trend, averageSeverity };
      });

    return { timeline, severityTrends };
  }

  private describeTemporalPattern(symptom: GraphNode, condition: GraphNode): string {
    const daysDiff = (condition.metadata.recordDate.getTime() - symptom.metadata.recordDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 0) return `Symptom reported ${Math.round(Math.abs(daysDiff))} days before diagnosis`;
    if (daysDiff < 0) return `Symptom reported ${Math.round(Math.abs(daysDiff))} days after diagnosis`;
    return "Symptom reported on same day as diagnosis";
  }

  private detectSymptomClusters(
    symptoms: GraphNode[],
    diagnoses: GraphNode[],
    graph: HealthGraph
  ): Array<{ clusterId: string; symptoms: string[]; possibleCondition: string; confidence: number }> {
    const clusters: Array<{ clusterId: string; symptoms: string[]; possibleCondition: string; confidence: number }> = [];

    const coOccurring = new Map<string, Set<string>>();
    for (const edge of graph.edges.values()) {
      if (edge.relationship === "co_occurs_with") {
        const s = graph.nodes.get(edge.source);
        const t = graph.nodes.get(edge.target);
        if (s?.type === "symptom" && t?.type === "symptom") {
          if (!coOccurring.has(s.id)) coOccurring.set(s.id, new Set());
          if (!coOccurring.has(t.id)) coOccurring.set(t.id, new Set());
          coOccurring.get(s.id)!.add(t.id);
          coOccurring.get(t.id)!.add(s.id);
        }
      }
    }

    const visited = new Set<string>();
    for (const [symptomId, neighbors] of coOccurring.entries()) {
      if (visited.has(symptomId)) continue;
      const clusterIds = new Set<string>([symptomId]);
      const queue = [...neighbors];
      while (queue.length > 0) {
        const next = queue.shift()!;
        if (clusterIds.has(next)) continue;
        clusterIds.add(next);
        const nextNeighbors = coOccurring.get(next);
        if (nextNeighbors) {
          for (const n of nextNeighbors) {
            if (!clusterIds.has(n)) queue.push(n);
          }
        }
      }

      if (clusterIds.size >= 2) {
        for (const id of clusterIds) visited.add(id);

        const clusterSymptomNames = Array.from(clusterIds)
          .map(id => graph.nodes.get(id)?.label || "Unknown")
          .filter(Boolean);

        let bestCondition = "Undiagnosed - further evaluation recommended";
        let bestConfidence = 0.3;

        for (const diagnosis of diagnoses) {
          let matchCount = 0;
          for (const symptomId of clusterIds) {
            const hasLink = Array.from(graph.edges.values()).some(
              e => (e.source === symptomId && e.target === diagnosis.id) ||
                   (e.target === symptomId && e.source === diagnosis.id)
            );
            if (hasLink) matchCount++;
          }
          const confidence = matchCount / clusterIds.size;
          if (confidence > bestConfidence) {
            bestCondition = diagnosis.label;
            bestConfidence = confidence;
          }
        }

        clusters.push({
          clusterId: `cluster_${clusters.length + 1}`,
          symptoms: clusterSymptomNames,
          possibleCondition: bestCondition,
          confidence: Math.min(bestConfidence, 0.95)
        });
      }
    }

    return clusters;
  }

  getGraph(patientId: string): HealthGraph | null {
    return this.graphs.get(patientId) || null;
  }

  getEpisodes(patientId: string): Episode[] {
    const graph = this.graphs.get(patientId);
    return graph ? Array.from(graph.episodes.values()) : [];
  }

  getStatistics(patientId: string): GraphStatistics | null {
    return this.graphs.get(patientId)?.statistics || null;
  }

  exportGraphForVisualization(patientId: string): { nodes: any[]; links: any[] } {
    const graph = this.graphs.get(patientId);
    if (!graph) return { nodes: [], links: [] };

    const nodes = Array.from(graph.nodes.values()).map(node => ({
      id: node.id,
      label: node.label,
      type: node.type,
      date: node.metadata.recordDate.toISOString(),
      group: this.getNodeGroup(node.type),
      size: this.getNodeSize(node, graph),
      data: node.data
    }));

    const links = Array.from(graph.edges.values()).map(edge => ({
      source: edge.source,
      target: edge.target,
      relationship: edge.relationship,
      strength: edge.strength,
      confidence: edge.confidence,
      inferredBy: edge.inferredBy
    }));

    return { nodes, links };
  }

  private getNodeGroup(type: GraphNode["type"]): number {
    const groups: Record<GraphNode["type"], number> = {
      medication: 1,
      diagnosis: 2,
      lab: 3,
      procedure: 4,
      imaging: 5,
      specialist: 6,
      episode: 7,
      therapy: 8,
      outcome: 9,
      vital: 10,
      allergy: 11,
      immunization: 12,
      symptom: 13
    };
    return groups[type] || 0;
  }

  private getNodeSize(node: GraphNode, graph: HealthGraph): number {
    let connections = 0;
    for (const edge of graph.edges.values()) {
      if (edge.source === node.id || edge.target === node.id) {
        connections++;
      }
    }
    return Math.min(30, 10 + connections * 2);
  }
}

export const healthGraphService = new HealthGraphService();

export function initializeHealthGraph() {
  console.log("Longitudinal health graph service initialized");
}
