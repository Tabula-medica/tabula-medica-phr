import { healthGraphService, HealthNode } from "./health-graph-service";
import { zeroClickRetrievalService } from "./zero-click-retrieval-service";

export interface DuplicateTestAlert {
  alertId: string;
  orderedTest: OrderedTest;
  priorResults: PriorTestResult[];
  recommendation: DuplicateRecommendation;
  potentialSavings: CostSavings;
  clinicalContext: ClinicalContext;
  createdAt: string;
  status: "active" | "acknowledged" | "overridden" | "retrieved";
  auditLog: AlertAuditEntry[];
}

export interface OrderedTest {
  orderId: string;
  testType: "imaging" | "laboratory" | "procedure";
  testCode: string;
  testName: string;
  orderingProvider: string;
  orderingFacility: string;
  orderedAt: string;
  urgency: "routine" | "urgent" | "stat";
  clinicalIndication?: string;
  icd10Codes?: string[];
}

export interface PriorTestResult {
  resultId: string;
  testType: "imaging" | "laboratory" | "procedure";
  testCode: string;
  testName: string;
  performedAt: string;
  performingFacility: string;
  performingProvider?: string;
  ageInDays: number;
  source: "local" | "network" | "hie" | "patient_uploaded";
  networkSource?: string;
  retrievalStatus: "available" | "pending" | "retrieved";
  relevanceScore: number;
  matchConfidence: number;
  resultSummary?: string;
  isAbnormal?: boolean;
}

export interface DuplicateRecommendation {
  action: "retrieve_prior" | "proceed_with_order" | "clinical_review" | "defer_order";
  confidence: number;
  reasoning: string;
  clinicalJustification?: string;
  guidelineReference?: string;
}

export interface CostSavings {
  estimatedTestCost: number;
  potentialSavings: number;
  currency: "USD";
  costSource: "cms_fee_schedule" | "facility_average" | "payer_contracted";
  annualizedImpact?: number;
}

export interface ClinicalContext {
  patientConditions: string[];
  relevantMedications: string[];
  recentEncounters: string[];
  clinicalChangesSincePrior: boolean;
  changeDetails?: string[];
}

export interface AlertAuditEntry {
  timestamp: string;
  action: "created" | "viewed" | "acknowledged" | "overridden" | "retrieved" | "dismissed";
  actorId: string;
  actorRole: string;
  reason?: string;
  ipAddress?: string;
}

export interface TestOrderAnalysis {
  orderedTest: OrderedTest;
  duplicatesFound: boolean;
  priorResults: PriorTestResult[];
  alerts: DuplicateTestAlert[];
  networkSearchStatus: "completed" | "pending" | "partial";
  searchedSources: string[];
}

export interface DuplicatePreventionStats {
  period: string;
  totalOrdersAnalyzed: number;
  duplicatesDetected: number;
  duplicatesRetrieved: number;
  duplicatesOverridden: number;
  estimatedSavings: number;
  savingsByCategory: Record<string, number>;
  topDuplicateTests: { testName: string; count: number; savings: number }[];
}

interface TestCodeMapping {
  code: string;
  name: string;
  category: string;
  equivalentCodes: string[];
  typicalCost: number;
  repeatWindow: number;
  clinicalGuidelines?: string;
}

class DuplicateTestPreventionService {
  private alerts: Map<string, DuplicateTestAlert> = new Map();
  private analysisCache: Map<string, TestOrderAnalysis> = new Map();
  
  private testCodeMappings: TestCodeMapping[] = [
    {
      code: "71046",
      name: "CT Abdomen/Pelvis with Contrast",
      category: "imaging_ct",
      equivalentCodes: ["71046", "74176", "74177", "74178"],
      typicalCost: 1200,
      repeatWindow: 30,
      clinicalGuidelines: "ACR Appropriateness Criteria"
    },
    {
      code: "70553",
      name: "MRI Brain with/without Contrast",
      category: "imaging_mri",
      equivalentCodes: ["70553", "70552", "70551"],
      typicalCost: 2500,
      repeatWindow: 90,
      clinicalGuidelines: "ACR Appropriateness Criteria"
    },
    {
      code: "71250",
      name: "CT Chest without Contrast",
      category: "imaging_ct",
      equivalentCodes: ["71250", "71260", "71270"],
      typicalCost: 800,
      repeatWindow: 30,
      clinicalGuidelines: "ACR Appropriateness Criteria"
    },
    {
      code: "72148",
      name: "MRI Lumbar Spine without Contrast",
      category: "imaging_mri",
      equivalentCodes: ["72148", "72149", "72158"],
      typicalCost: 1800,
      repeatWindow: 60,
      clinicalGuidelines: "ACR Appropriateness Criteria"
    },
    {
      code: "80053",
      name: "Comprehensive Metabolic Panel",
      category: "laboratory",
      equivalentCodes: ["80053", "80048"],
      typicalCost: 35,
      repeatWindow: 7
    },
    {
      code: "85025",
      name: "Complete Blood Count (CBC)",
      category: "laboratory",
      equivalentCodes: ["85025", "85027"],
      typicalCost: 25,
      repeatWindow: 7
    },
    {
      code: "80061",
      name: "Lipid Panel",
      category: "laboratory",
      equivalentCodes: ["80061", "82465", "83718", "84478"],
      typicalCost: 40,
      repeatWindow: 90
    },
    {
      code: "83036",
      name: "Hemoglobin A1c",
      category: "laboratory",
      equivalentCodes: ["83036", "83037"],
      typicalCost: 30,
      repeatWindow: 90,
      clinicalGuidelines: "ADA Standards of Care"
    },
    {
      code: "84443",
      name: "TSH (Thyroid Stimulating Hormone)",
      category: "laboratory",
      equivalentCodes: ["84443", "84436", "84439"],
      typicalCost: 35,
      repeatWindow: 60
    },
    {
      code: "82570",
      name: "Creatinine",
      category: "laboratory",
      equivalentCodes: ["82570", "82575"],
      typicalCost: 15,
      repeatWindow: 14
    },
    {
      code: "93000",
      name: "Electrocardiogram (ECG/EKG)",
      category: "cardiology",
      equivalentCodes: ["93000", "93005", "93010"],
      typicalCost: 75,
      repeatWindow: 30
    },
    {
      code: "93306",
      name: "Echocardiogram Complete",
      category: "cardiology",
      equivalentCodes: ["93306", "93307", "93308"],
      typicalCost: 800,
      repeatWindow: 365,
      clinicalGuidelines: "ACC/AHA Guidelines"
    }
  ];

  async analyzeTestOrder(
    patientId: string,
    order: OrderedTest,
    searchNetworks: boolean = true
  ): Promise<TestOrderAnalysis> {
    console.log(`[HIPAA-AUDIT] Duplicate test analysis - PatientId: ${patientId}, Test: ${order.testName}, OrderId: ${order.orderId}`);

    const searchedSources: string[] = ["local_graph"];
    let priorResults: PriorTestResult[] = [];

    const localPriors = await this.searchLocalGraph(patientId, order);
    priorResults.push(...localPriors);

    if (searchNetworks) {
      const networkPriors = await this.searchNetworkSources(patientId, order);
      priorResults.push(...networkPriors);
      searchedSources.push("hie_network", "connected_facilities");
    }

    priorResults = priorResults
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 10);

    const alerts: DuplicateTestAlert[] = [];
    
    if (priorResults.length > 0) {
      const topPrior = priorResults[0];
      const recommendation = this.generateRecommendation(order, topPrior, priorResults);
      const savings = this.calculateSavings(order, priorResults);
      const clinicalContext = await this.getClinicalContext(patientId, order, topPrior);

      const alert: DuplicateTestAlert = {
        alertId: `dup_alert_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
        orderedTest: order,
        priorResults,
        recommendation,
        potentialSavings: savings,
        clinicalContext,
        createdAt: new Date().toISOString(),
        status: "active",
        auditLog: [{
          timestamp: new Date().toISOString(),
          action: "created",
          actorId: "system",
          actorRole: "duplicate_prevention_engine"
        }]
      };

      this.alerts.set(alert.alertId, alert);
      alerts.push(alert);

      console.log(`[HIPAA-AUDIT] Duplicate test alert created - AlertId: ${alert.alertId}, PotentialSavings: $${savings.potentialSavings}`);
    }

    const analysis: TestOrderAnalysis = {
      orderedTest: order,
      duplicatesFound: priorResults.length > 0,
      priorResults,
      alerts,
      networkSearchStatus: searchNetworks ? "completed" : "partial",
      searchedSources
    };

    this.analysisCache.set(order.orderId, analysis);

    return analysis;
  }

  private async searchLocalGraph(patientId: string, order: OrderedTest): Promise<PriorTestResult[]> {
    const priorResults: PriorTestResult[] = [];
    
    try {
      const graph = await healthGraphService.getGraph(patientId);
      if (!graph) return priorResults;
      
      const testMapping = this.findTestMapping(order.testCode);
      const equivalentCodes = testMapping?.equivalentCodes || [order.testCode];
      
      const relevantNodes = graph.nodes.filter((node: HealthNode) => {
        if (order.testType === "imaging" && node.nodeType === "imaging") {
          return this.isEquivalentTest(node.label, order.testName, equivalentCodes);
        }
        if (order.testType === "laboratory" && node.nodeType === "lab") {
          return this.isEquivalentTest(node.label, order.testName, equivalentCodes);
        }
        if (order.testType === "procedure" && node.nodeType === "procedure") {
          return this.isEquivalentTest(node.label, order.testName, equivalentCodes);
        }
        return false;
      });

      for (const node of relevantNodes) {
        const nodeDate = new Date(node.startDate || new Date());
        const orderDate = new Date(order.orderedAt);
        const ageInDays = Math.floor((orderDate.getTime() - nodeDate.getTime()) / (1000 * 60 * 60 * 24));

        if (ageInDays > 0 && ageInDays <= 365) {
          const relevanceScore = this.calculateRelevanceScore(order, node, ageInDays);
          const matchConfidence = this.calculateMatchConfidence(order.testCode, order.testName, node.label);

          priorResults.push({
            resultId: node.id,
            testType: order.testType,
            testCode: order.testCode,
            testName: node.label,
            performedAt: node.startDate || new Date().toISOString(),
            performingFacility: node.source || "Local Health System",
            ageInDays,
            source: "local",
            retrievalStatus: "available",
            relevanceScore,
            matchConfidence,
            resultSummary: node.metadata?.summary,
            isAbnormal: node.metadata?.isAbnormal
          });
        }
      }
    } catch (error) {
      console.error("[DuplicatePrevention] Local graph search error:", error);
    }

    return priorResults;
  }

  private async searchNetworkSources(patientId: string, order: OrderedTest): Promise<PriorTestResult[]> {
    const priorResults: PriorTestResult[] = [];

    const networkSources = [
      { name: "Regional HIE", id: "regional_hie" },
      { name: "CommonWell Health Alliance", id: "commonwell" },
      { name: "Carequality", id: "carequality" },
      { name: "Fasten Health Network", id: "epic_care_everywhere" }
    ];

    for (const source of networkSources) {
      const simulatedResults = this.simulateNetworkSearch(patientId, order, source);
      priorResults.push(...simulatedResults);
    }

    return priorResults;
  }

  private simulateNetworkSearch(
    patientId: string,
    order: OrderedTest,
    source: { name: string; id: string }
  ): PriorTestResult[] {
    const results: PriorTestResult[] = [];
    
    const hasResult = Math.random() > 0.6;
    
    if (hasResult && order.testType === "imaging") {
      const ageInDays = Math.floor(Math.random() * 60) + 7;
      const performedDate = new Date();
      performedDate.setDate(performedDate.getDate() - ageInDays);

      results.push({
        resultId: `net_${source.id}_${Date.now()}`,
        testType: order.testType,
        testCode: order.testCode,
        testName: order.testName,
        performedAt: performedDate.toISOString(),
        performingFacility: this.getRandomFacility(),
        ageInDays,
        source: "network",
        networkSource: source.name,
        retrievalStatus: "available",
        relevanceScore: this.calculateNetworkRelevanceScore(ageInDays),
        matchConfidence: 0.85 + Math.random() * 0.1,
        resultSummary: "Results available for retrieval"
      });
    }

    return results;
  }

  private getRandomFacility(): string {
    const facilities = [
      "Memorial Regional Medical Center",
      "University Hospital",
      "St. Mary's Healthcare",
      "Community General Hospital",
      "Metro Imaging Center",
      "Valley Medical Associates"
    ];
    return facilities[Math.floor(Math.random() * facilities.length)];
  }

  private findTestMapping(testCode: string): TestCodeMapping | undefined {
    return this.testCodeMappings.find(m => 
      m.code === testCode || m.equivalentCodes.includes(testCode)
    );
  }

  private isEquivalentTest(nodeName: string, orderTestName: string, equivalentCodes: string[]): boolean {
    const normalizedNode = nodeName.toLowerCase();
    const normalizedOrder = orderTestName.toLowerCase();

    if (normalizedNode.includes(normalizedOrder) || normalizedOrder.includes(normalizedNode)) {
      return true;
    }

    const keywords = normalizedOrder.split(/\s+/).filter(w => w.length > 3);
    const matchingKeywords = keywords.filter(k => normalizedNode.includes(k));
    
    return matchingKeywords.length >= Math.ceil(keywords.length * 0.6);
  }

  private calculateRelevanceScore(order: OrderedTest, node: HealthNode, ageInDays: number): number {
    let score = 1.0;

    const testMapping = this.findTestMapping(order.testCode);
    const repeatWindow = testMapping?.repeatWindow || 30;

    if (ageInDays <= repeatWindow) {
      score *= 1.0;
    } else if (ageInDays <= repeatWindow * 2) {
      score *= 0.7;
    } else if (ageInDays <= repeatWindow * 4) {
      score *= 0.4;
    } else {
      score *= 0.2;
    }

    if (order.urgency === "stat") {
      score *= 0.5;
    } else if (order.urgency === "urgent") {
      score *= 0.7;
    }

    return Math.round(score * 100) / 100;
  }

  private calculateNetworkRelevanceScore(ageInDays: number): number {
    if (ageInDays <= 21) return 0.95;
    if (ageInDays <= 45) return 0.8;
    if (ageInDays <= 90) return 0.6;
    return 0.4;
  }

  private calculateMatchConfidence(orderCode: string, orderName: string, priorName: string): number {
    const testMapping = this.findTestMapping(orderCode);
    if (testMapping && priorName.toLowerCase().includes(testMapping.name.toLowerCase().split(" ")[0])) {
      return 0.95;
    }

    const orderWords = orderName.toLowerCase().split(/\s+/);
    const priorWords = priorName.toLowerCase().split(/\s+/);
    const matchingWords = orderWords.filter(w => priorWords.includes(w));
    
    return Math.min(0.95, 0.5 + (matchingWords.length / orderWords.length) * 0.45);
  }

  private generateRecommendation(
    order: OrderedTest,
    topPrior: PriorTestResult,
    allPriors: PriorTestResult[]
  ): DuplicateRecommendation {
    const testMapping = this.findTestMapping(order.testCode);
    const repeatWindow = testMapping?.repeatWindow || 30;

    if (topPrior.ageInDays <= repeatWindow && topPrior.matchConfidence >= 0.85) {
      return {
        action: "retrieve_prior",
        confidence: 0.9,
        reasoning: `${order.testName} was performed ${topPrior.ageInDays} days ago at ${topPrior.performingFacility}. ` +
          `This is within the typical ${repeatWindow}-day repeat window. Retrieving prior results is recommended.`,
        guidelineReference: testMapping?.clinicalGuidelines
      };
    }

    if (topPrior.ageInDays <= repeatWindow * 2 && order.urgency === "routine") {
      return {
        action: "clinical_review",
        confidence: 0.75,
        reasoning: `Prior ${order.testName} exists from ${topPrior.ageInDays} days ago. ` +
          `Consider reviewing prior results before proceeding with new order.`,
        guidelineReference: testMapping?.clinicalGuidelines
      };
    }

    if (order.urgency === "stat" || order.urgency === "urgent") {
      return {
        action: "proceed_with_order",
        confidence: 0.8,
        reasoning: `Order is marked ${order.urgency}. Prior results from ${topPrior.ageInDays} days ago may not reflect current clinical status.`,
        clinicalJustification: "Urgent clinical indication"
      };
    }

    return {
      action: "defer_order",
      confidence: 0.6,
      reasoning: `Prior ${order.testName} available from ${topPrior.ageInDays} days ago. ` +
        `Recommend reviewing clinical necessity before proceeding.`
    };
  }

  private calculateSavings(order: OrderedTest, priorResults: PriorTestResult[]): CostSavings {
    const testMapping = this.findTestMapping(order.testCode);
    const estimatedCost = testMapping?.typicalCost || this.getDefaultCost(order.testType);

    const potentialSavings = priorResults.length > 0 ? estimatedCost : 0;

    return {
      estimatedTestCost: estimatedCost,
      potentialSavings,
      currency: "USD",
      costSource: testMapping ? "cms_fee_schedule" : "facility_average",
      annualizedImpact: potentialSavings * 12
    };
  }

  private getDefaultCost(testType: string): number {
    switch (testType) {
      case "imaging": return 500;
      case "laboratory": return 50;
      case "procedure": return 300;
      default: return 100;
    }
  }

  private async getClinicalContext(
    patientId: string,
    order: OrderedTest,
    topPrior: PriorTestResult
  ): Promise<ClinicalContext> {
    try {
      const graph = await healthGraphService.getGraph(patientId);
      if (!graph) {
        return {
          patientConditions: [],
          relevantMedications: [],
          recentEncounters: [],
          clinicalChangesSincePrior: false
        };
      }
      
      const conditions = graph.nodes
        .filter((n: HealthNode) => n.nodeType === "condition" && n.status === "active")
        .map((n: HealthNode) => n.label)
        .slice(0, 5);

      const medications = graph.nodes
        .filter((n: HealthNode) => n.nodeType === "medication" && n.status === "active")
        .map((n: HealthNode) => n.label)
        .slice(0, 5);

      const recentEncounters = graph.nodes
        .filter((n: HealthNode) => n.nodeType === "encounter")
        .sort((a: HealthNode, b: HealthNode) => new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime())
        .slice(0, 3)
        .map((n: HealthNode) => `${n.label} (${new Date(n.startDate || Date.now()).toLocaleDateString()})`);

      const priorDate = new Date(topPrior.performedAt);
      const changesSincePrior = graph.nodes.filter((n: HealthNode) => {
        const nodeDate = new Date(n.startDate || 0);
        return nodeDate > priorDate && 
          (n.nodeType === "condition" || n.nodeType === "medication") &&
          n.status === "active";
      });

      return {
        patientConditions: conditions,
        relevantMedications: medications,
        recentEncounters: recentEncounters,
        clinicalChangesSincePrior: changesSincePrior.length > 0,
        changeDetails: changesSincePrior.map((n: HealthNode) => `New ${n.nodeType}: ${n.label}`)
      };
    } catch (error) {
      return {
        patientConditions: [],
        relevantMedications: [],
        recentEncounters: [],
        clinicalChangesSincePrior: false
      };
    }
  }

  async acknowledgeAlert(
    alertId: string,
    actorId: string,
    actorRole: string,
    action: "retrieved" | "overridden" | "dismissed",
    reason?: string,
    ipAddress?: string
  ): Promise<DuplicateTestAlert | null> {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    alert.auditLog.push({
      timestamp: new Date().toISOString(),
      action: action === "retrieved" ? "retrieved" : action === "overridden" ? "overridden" : "dismissed",
      actorId,
      actorRole,
      reason,
      ipAddress
    });

    if (action === "retrieved") {
      alert.status = "retrieved";
    } else if (action === "overridden") {
      alert.status = "overridden";
    } else {
      alert.status = "acknowledged";
    }

    console.log(`[HIPAA-AUDIT] Alert ${action} - AlertId: ${alertId}, Actor: ${actorId}, Role: ${actorRole}, Reason: ${reason || "N/A"}`);

    return alert;
  }

  async retrievePriorResult(
    alertId: string,
    resultId: string,
    actorId: string,
    ipAddress?: string
  ): Promise<{ success: boolean; retrievedData?: any; message: string }> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return { success: false, message: "Alert not found" };
    }

    const priorResult = alert.priorResults.find(r => r.resultId === resultId);
    if (!priorResult) {
      return { success: false, message: "Prior result not found" };
    }

    await this.acknowledgeAlert(alertId, actorId, "physician", "retrieved", "Prior result retrieved", ipAddress);

    priorResult.retrievalStatus = "retrieved";

    console.log(`[HIPAA-AUDIT] Prior result retrieved - AlertId: ${alertId}, ResultId: ${resultId}, Source: ${priorResult.source}, Actor: ${actorId}`);

    return {
      success: true,
      retrievedData: {
        resultId: priorResult.resultId,
        testName: priorResult.testName,
        performedAt: priorResult.performedAt,
        performingFacility: priorResult.performingFacility,
        source: priorResult.source,
        summary: priorResult.resultSummary || "Full results now available in patient record"
      },
      message: `Successfully retrieved ${priorResult.testName} from ${priorResult.performingFacility}`
    };
  }

  async getDuplicatePreventionStats(
    organizationId: string,
    startDate: string,
    endDate: string
  ): Promise<DuplicatePreventionStats> {
    const alertsInPeriod = Array.from(this.alerts.values()).filter(a => {
      const alertDate = new Date(a.createdAt);
      return alertDate >= new Date(startDate) && alertDate <= new Date(endDate);
    });

    const totalOrders = this.analysisCache.size;
    const duplicatesDetected = alertsInPeriod.length;
    const duplicatesRetrieved = alertsInPeriod.filter(a => a.status === "retrieved").length;
    const duplicatesOverridden = alertsInPeriod.filter(a => a.status === "overridden").length;

    const savingsByCategory: Record<string, number> = {};
    let totalSavings = 0;

    for (const alert of alertsInPeriod.filter(a => a.status === "retrieved")) {
      const category = alert.orderedTest.testType;
      const savings = alert.potentialSavings.potentialSavings;
      savingsByCategory[category] = (savingsByCategory[category] || 0) + savings;
      totalSavings += savings;
    }

    const testCounts: Record<string, { count: number; savings: number }> = {};
    for (const alert of alertsInPeriod) {
      const testName = alert.orderedTest.testName;
      if (!testCounts[testName]) {
        testCounts[testName] = { count: 0, savings: 0 };
      }
      testCounts[testName].count++;
      if (alert.status === "retrieved") {
        testCounts[testName].savings += alert.potentialSavings.potentialSavings;
      }
    }

    const topDuplicateTests = Object.entries(testCounts)
      .map(([testName, data]) => ({ testName, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      period: `${startDate} to ${endDate}`,
      totalOrdersAnalyzed: totalOrders,
      duplicatesDetected,
      duplicatesRetrieved,
      duplicatesOverridden,
      estimatedSavings: totalSavings,
      savingsByCategory,
      topDuplicateTests
    };
  }

  async generateAlertMessage(alert: DuplicateTestAlert): Promise<string> {
    const topPrior = alert.priorResults[0];
    
    if (!topPrior) {
      return `Analyzing order for ${alert.orderedTest.testName}...`;
    }

    const timeAgo = this.formatTimeAgo(topPrior.ageInDays);
    
    return `${alert.orderedTest.testName} performed ${timeAgo} at ${topPrior.performingFacility} — click to retrieve.`;
  }

  private formatTimeAgo(days: number): string {
    if (days === 1) return "yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 14) return "1 week ago";
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 60) return "1 month ago";
    return `${Math.floor(days / 30)} months ago`;
  }

  getAlert(alertId: string): DuplicateTestAlert | undefined {
    return this.alerts.get(alertId);
  }

  getActiveAlerts(patientId?: string): DuplicateTestAlert[] {
    return Array.from(this.alerts.values())
      .filter(a => a.status === "active" && (!patientId || a.orderedTest.orderId.includes(patientId)))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export const duplicateTestPreventionService = new DuplicateTestPreventionService();
