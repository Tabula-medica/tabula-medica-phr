import { chatComplete } from "./ai-client";

interface TestOrder {
  id: string;
  orderId: string;
  patientId: string;
  orderType: "imaging" | "lab" | "procedure";
  testCode: string;
  testName: string;
  cptCode?: string;
  loincCode?: string;
  orderingProvider: {
    npi: string;
    name: string;
    specialty?: string;
    facility?: string;
  };
  clinicalIndication?: string;
  icd10Codes?: string[];
  priority: "stat" | "routine" | "urgent";
  orderedAt: Date;
  status: "pending" | "scheduled" | "in_progress" | "completed" | "cancelled";
}

interface PriorTest {
  id: string;
  testType: "imaging" | "lab" | "procedure";
  testCode: string;
  testName: string;
  performedAt: Date;
  facility: string;
  provider?: string;
  result?: TestResult;
  source: "local" | "hie" | "claims" | "patient_portal";
  retrievable: boolean;
  retrievalMethod?: "fhir" | "direct_connect" | "fax" | "patient_upload";
  estimatedCost?: number;
  clinicalRelevance: "high" | "medium" | "low";
}

interface TestResult {
  status: "normal" | "abnormal" | "critical" | "pending";
  summary?: string;
  findings?: string[];
  impression?: string;
  radiologistNotes?: string;
  labValues?: LabValue[];
}

interface LabValue {
  component: string;
  value: number;
  unit: string;
  referenceRange: { low: number; high: number };
  flag?: "high" | "low" | "critical_high" | "critical_low";
}

interface DuplicateAlert {
  id: string;
  orderId: string;
  patientId: string;
  alertType: "exact_duplicate" | "similar_test" | "recent_normal" | "pending_result" | "cost_opportunity";
  severity: "high" | "medium" | "low";
  title: string;
  message: string;
  priorTests: PriorTest[];
  recommendation: DuplicateRecommendation;
  potentialSavings: number;
  clinicalJustification?: string;
  overrideReasons?: string[];
  createdAt: Date;
  status: "active" | "acknowledged" | "overridden" | "accepted";
  responseRequired: boolean;
  responseDeadline?: Date;
}

interface DuplicateRecommendation {
  action: "cancel_order" | "retrieve_prior" | "modify_order" | "proceed_with_justification" | "delay_order";
  rationale: string;
  alternativeTests?: string[];
  retrievalOptions?: RetrievalOption[];
  estimatedTimeSaved?: number;
  clinicalConsiderations?: string[];
}

interface RetrievalOption {
  priorTestId: string;
  method: "fhir" | "direct_connect" | "fax" | "patient_upload";
  estimatedTime: string;
  cost: number;
  reliability: "high" | "medium" | "low";
}

interface DuplicateAnalytics {
  patientId: string;
  period: { start: Date; end: Date };
  totalOrdersScreened: number;
  duplicatesDetected: number;
  duplicatesPrevented: number;
  duplicatesOverridden: number;
  totalSavings: number;
  savingsByCategory: Record<string, number>;
  topDuplicateTests: Array<{ testName: string; count: number; savings: number }>;
  providerStats: Array<{ providerId: string; duplicateRate: number; savingsGenerated: number }>;
}

interface TestEquivalenceRule {
  primaryCode: string;
  primaryName: string;
  equivalentCodes: string[];
  equivalentNames: string[];
  clinicalContext?: string;
  validityWindow: number;
  requiresSameBodyPart?: boolean;
  requiresSameModality?: boolean;
}

const IMAGING_EQUIVALENCE_RULES: TestEquivalenceRule[] = [
  {
    primaryCode: "74176",
    primaryName: "CT Abdomen and Pelvis without Contrast",
    equivalentCodes: ["74177", "74178", "74150", "74160", "74170"],
    equivalentNames: ["CT Abdomen", "CT Pelvis", "CT Abdomen with Contrast", "CT Abdomen Pelvis with Contrast"],
    validityWindow: 30,
    requiresSameBodyPart: true
  },
  {
    primaryCode: "71250",
    primaryName: "CT Chest without Contrast",
    equivalentCodes: ["71260", "71270"],
    equivalentNames: ["CT Chest with Contrast", "CT Chest without and with Contrast"],
    validityWindow: 30,
    requiresSameBodyPart: true
  },
  {
    primaryCode: "70553",
    primaryName: "MRI Brain with and without Contrast",
    equivalentCodes: ["70551", "70552"],
    equivalentNames: ["MRI Brain without Contrast", "MRI Brain with Contrast"],
    validityWindow: 60,
    requiresSameBodyPart: true
  },
  {
    primaryCode: "73721",
    primaryName: "MRI Lower Extremity Joint",
    equivalentCodes: ["73722", "73723"],
    equivalentNames: ["MRI Lower Extremity with Contrast", "MRI Lower Extremity without and with Contrast"],
    validityWindow: 60,
    requiresSameBodyPart: true
  },
  {
    primaryCode: "76700",
    primaryName: "Ultrasound Abdomen Complete",
    equivalentCodes: ["76705", "76770", "76775"],
    equivalentNames: ["Ultrasound Abdomen Limited", "Ultrasound Retroperitoneal"],
    validityWindow: 30,
    requiresSameBodyPart: true
  },
  {
    primaryCode: "93306",
    primaryName: "Echocardiogram Complete",
    equivalentCodes: ["93307", "93308", "93312"],
    equivalentNames: ["Echocardiogram Limited", "Echo Follow-up", "Transesophageal Echo"],
    validityWindow: 90,
    requiresSameModality: true
  }
];

const LAB_EQUIVALENCE_RULES: TestEquivalenceRule[] = [
  {
    primaryCode: "80053",
    primaryName: "Comprehensive Metabolic Panel",
    equivalentCodes: ["80048", "80069"],
    equivalentNames: ["Basic Metabolic Panel", "Renal Function Panel"],
    validityWindow: 7,
    clinicalContext: "Contains overlapping chemistry values"
  },
  {
    primaryCode: "85025",
    primaryName: "Complete Blood Count with Differential",
    equivalentCodes: ["85027", "85004"],
    equivalentNames: ["CBC without Differential", "CBC with Manual Differential"],
    validityWindow: 3
  },
  {
    primaryCode: "80061",
    primaryName: "Lipid Panel",
    equivalentCodes: ["82465", "83718", "83721", "84478"],
    equivalentNames: ["Cholesterol Total", "HDL", "LDL Direct", "Triglycerides"],
    validityWindow: 30,
    clinicalContext: "Fasting lipid panel includes all components"
  },
  {
    primaryCode: "84443",
    primaryName: "TSH",
    equivalentCodes: ["84436", "84439", "84480", "84481"],
    equivalentNames: ["Thyroxine Total", "Free T4", "T3 Total", "Free T3"],
    validityWindow: 30
  },
  {
    primaryCode: "83036",
    primaryName: "Hemoglobin A1c",
    equivalentCodes: ["83037"],
    equivalentNames: ["Glycated Hemoglobin"],
    validityWindow: 60,
    clinicalContext: "Reflects 3-month glucose average"
  }
];

const AVERAGE_TEST_COSTS: Record<string, number> = {
  "CT Abdomen": 1200,
  "CT Chest": 1100,
  "CT Head": 900,
  "MRI Brain": 2500,
  "MRI Knee": 1800,
  "MRI Spine": 2200,
  "Ultrasound Abdomen": 400,
  "Echocardiogram": 800,
  "X-Ray Chest": 150,
  "PET Scan": 5000,
  "Nuclear Stress Test": 2500,
  "CBC": 25,
  "CMP": 35,
  "Lipid Panel": 40,
  "TSH": 50,
  "Hemoglobin A1c": 45,
  "Urinalysis": 20,
  "PSA": 60,
  "Vitamin D": 55,
  "B12": 45
};

class DuplicateTestPreventionService {
  private alerts: Map<string, DuplicateAlert> = new Map();
  private orderHistory: Map<string, TestOrder[]> = new Map();
  private priorTestCache: Map<string, PriorTest[]> = new Map();
  private analytics: Map<string, DuplicateAnalytics> = new Map();

  async screenOrder(order: TestOrder, priorTests: PriorTest[]): Promise<DuplicateAlert[]> {
    const alerts: DuplicateAlert[] = [];

    const exactDuplicates = this.findExactDuplicates(order, priorTests);
    if (exactDuplicates.length > 0) {
      alerts.push(this.createExactDuplicateAlert(order, exactDuplicates));
    }

    const similarTests = this.findSimilarTests(order, priorTests);
    if (similarTests.length > 0 && exactDuplicates.length === 0) {
      alerts.push(this.createSimilarTestAlert(order, similarTests));
    }

    const recentNormals = this.findRecentNormalResults(order, priorTests);
    if (recentNormals.length > 0 && exactDuplicates.length === 0) {
      alerts.push(this.createRecentNormalAlert(order, recentNormals));
    }

    const pendingTests = this.findPendingResults(order, priorTests);
    if (pendingTests.length > 0) {
      alerts.push(this.createPendingResultAlert(order, pendingTests));
    }

    for (const alert of alerts) {
      this.alerts.set(alert.id, alert);
    }

    this.updateAnalytics(order.patientId, alerts);

    return alerts;
  }

  private findExactDuplicates(order: TestOrder, priorTests: PriorTest[]): PriorTest[] {
    const validityWindow = this.getValidityWindow(order);
    const cutoffDate = new Date(Date.now() - validityWindow * 24 * 60 * 60 * 1000);

    return priorTests.filter(prior => {
      if (prior.performedAt < cutoffDate) return false;

      const codeMatch = prior.testCode === order.testCode || 
                        prior.testName.toLowerCase() === order.testName.toLowerCase();

      return codeMatch;
    });
  }

  private findSimilarTests(order: TestOrder, priorTests: PriorTest[]): PriorTest[] {
    const rules = order.orderType === "imaging" ? IMAGING_EQUIVALENCE_RULES : LAB_EQUIVALENCE_RULES;
    const matchingRule = rules.find(r => 
      r.primaryCode === order.testCode || 
      r.equivalentCodes.includes(order.testCode) ||
      r.primaryName.toLowerCase().includes(order.testName.toLowerCase()) ||
      r.equivalentNames.some(n => n.toLowerCase().includes(order.testName.toLowerCase()))
    );

    if (!matchingRule) return [];

    const cutoffDate = new Date(Date.now() - matchingRule.validityWindow * 24 * 60 * 60 * 1000);

    return priorTests.filter(prior => {
      if (prior.performedAt < cutoffDate) return false;

      const allEquivalentCodes = [matchingRule.primaryCode, ...matchingRule.equivalentCodes];
      const allEquivalentNames = [matchingRule.primaryName, ...matchingRule.equivalentNames];

      const isEquivalent = allEquivalentCodes.includes(prior.testCode) ||
                           allEquivalentNames.some(n => prior.testName.toLowerCase().includes(n.toLowerCase()));

      return isEquivalent && prior.testCode !== order.testCode;
    });
  }

  private findRecentNormalResults(order: TestOrder, priorTests: PriorTest[]): PriorTest[] {
    const validityWindow = this.getValidityWindow(order);
    const cutoffDate = new Date(Date.now() - validityWindow * 24 * 60 * 60 * 1000);

    return priorTests.filter(prior => {
      if (prior.performedAt < cutoffDate) return false;
      if (!prior.result) return false;

      const isNormal = prior.result.status === "normal";
      const isSameTest = prior.testCode === order.testCode || 
                         prior.testName.toLowerCase() === order.testName.toLowerCase();

      return isNormal && isSameTest;
    });
  }

  private findPendingResults(order: TestOrder, priorTests: PriorTest[]): PriorTest[] {
    return priorTests.filter(prior => {
      if (!prior.result) return false;
      if (prior.result.status !== "pending") return false;

      const isSameTest = prior.testCode === order.testCode || 
                         prior.testName.toLowerCase() === order.testName.toLowerCase();

      const daysSinceOrder = (Date.now() - prior.performedAt.getTime()) / (1000 * 60 * 60 * 24);
      const isRecent = daysSinceOrder < 7;

      return isSameTest && isRecent;
    });
  }

  private getValidityWindow(order: TestOrder): number {
    const rules = order.orderType === "imaging" ? IMAGING_EQUIVALENCE_RULES : LAB_EQUIVALENCE_RULES;
    const matchingRule = rules.find(r => 
      r.primaryCode === order.testCode || 
      r.equivalentCodes.includes(order.testCode)
    );

    if (matchingRule) return matchingRule.validityWindow;

    if (order.orderType === "imaging") return 30;
    if (order.orderType === "lab") return 7;
    return 14;
  }

  private createExactDuplicateAlert(order: TestOrder, duplicates: PriorTest[]): DuplicateAlert {
    const mostRecent = duplicates.sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime())[0];
    const daysSince = Math.floor((Date.now() - mostRecent.performedAt.getTime()) / (1000 * 60 * 60 * 24));
    const estimatedCost = this.estimateTestCost(order.testName);

    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId: order.orderId,
      patientId: order.patientId,
      alertType: "exact_duplicate",
      severity: "high",
      title: `${order.testName} performed ${daysSince} ${daysSince === 1 ? "day" : "days"} ago`,
      message: `This exact test was performed at ${mostRecent.facility} on ${mostRecent.performedAt.toLocaleDateString()}. Results are ${mostRecent.retrievable ? "available for retrieval" : "not electronically available"}.`,
      priorTests: duplicates,
      recommendation: {
        action: mostRecent.retrievable ? "retrieve_prior" : "cancel_order",
        rationale: `Recent ${order.testName} results exist. Repeating this test may be unnecessary and adds ${this.formatCurrency(estimatedCost)} in costs.`,
        retrievalOptions: mostRecent.retrievable ? [{
          priorTestId: mostRecent.id,
          method: mostRecent.retrievalMethod || "fhir",
          estimatedTime: "< 5 minutes",
          cost: 0,
          reliability: "high"
        }] : undefined,
        estimatedTimeSaved: 60,
        clinicalConsiderations: [
          "Clinical status may have changed since prior test",
          "New symptoms may warrant repeat imaging",
          "Treatment monitoring may require serial testing"
        ]
      },
      potentialSavings: estimatedCost,
      overrideReasons: [
        "Clinical status has significantly changed",
        "New symptoms require fresh baseline",
        "Prior study inadequate for current clinical question",
        "Different contrast/protocol needed",
        "Monitoring response to treatment"
      ],
      createdAt: new Date(),
      status: "active",
      responseRequired: true,
      responseDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000)
    };
  }

  private createSimilarTestAlert(order: TestOrder, similarTests: PriorTest[]): DuplicateAlert {
    const mostRecent = similarTests.sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime())[0];
    const daysSince = Math.floor((Date.now() - mostRecent.performedAt.getTime()) / (1000 * 60 * 60 * 24));
    const estimatedCost = this.estimateTestCost(order.testName);

    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId: order.orderId,
      patientId: order.patientId,
      alertType: "similar_test",
      severity: "medium",
      title: `Similar test: ${mostRecent.testName} performed ${daysSince} days ago`,
      message: `A clinically equivalent study (${mostRecent.testName}) was performed at ${mostRecent.facility}. The prior study may address the current clinical question.`,
      priorTests: similarTests,
      recommendation: {
        action: "retrieve_prior",
        rationale: `${mostRecent.testName} may provide the information needed. Review prior results before ordering additional imaging.`,
        alternativeTests: similarTests.map(t => t.testName),
        retrievalOptions: similarTests.filter(t => t.retrievable).map(t => ({
          priorTestId: t.id,
          method: t.retrievalMethod || "fhir",
          estimatedTime: "< 5 minutes",
          cost: 0,
          reliability: "high"
        })),
        clinicalConsiderations: [
          "Prior study may partially or fully address clinical question",
          "Different modality/contrast may still be needed",
          "Compare prior images before deciding"
        ]
      },
      potentialSavings: estimatedCost * 0.7,
      createdAt: new Date(),
      status: "active",
      responseRequired: false
    };
  }

  private createRecentNormalAlert(order: TestOrder, normalResults: PriorTest[]): DuplicateAlert {
    const mostRecent = normalResults.sort((a, b) => b.performedAt.getTime() - a.performedAt.getTime())[0];
    const daysSince = Math.floor((Date.now() - mostRecent.performedAt.getTime()) / (1000 * 60 * 60 * 24));
    const estimatedCost = this.estimateTestCost(order.testName);

    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId: order.orderId,
      patientId: order.patientId,
      alertType: "recent_normal",
      severity: "low",
      title: `Recent normal ${order.testName} (${daysSince} days ago)`,
      message: `This test was normal ${daysSince} days ago at ${mostRecent.facility}. Consider whether clinical status has changed enough to warrant repeat testing.`,
      priorTests: normalResults,
      recommendation: {
        action: "delay_order",
        rationale: `Normal results from ${daysSince} days ago suggest low yield for repeat testing unless clinical status has changed.`,
        clinicalConsiderations: [
          "Normal results were recent",
          "Low probability of new findings unless symptoms changed",
          "Consider clinical indication for repeat"
        ]
      },
      potentialSavings: estimatedCost * 0.5,
      createdAt: new Date(),
      status: "active",
      responseRequired: false
    };
  }

  private createPendingResultAlert(order: TestOrder, pendingTests: PriorTest[]): DuplicateAlert {
    const pending = pendingTests[0];

    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      orderId: order.orderId,
      patientId: order.patientId,
      alertType: "pending_result",
      severity: "high",
      title: `${order.testName} results pending from ${pending.facility}`,
      message: `This test was ordered ${Math.floor((Date.now() - pending.performedAt.getTime()) / (1000 * 60 * 60 * 24))} days ago and results are still pending. Duplicate order may be unnecessary.`,
      priorTests: pendingTests,
      recommendation: {
        action: "cancel_order",
        rationale: "Results from a previously ordered test are expected soon. Wait for those results before ordering again.",
        estimatedTimeSaved: 120,
        clinicalConsiderations: [
          "Prior test may have been delayed",
          "Contact prior facility to expedite results",
          "Check if prior order was cancelled"
        ]
      },
      potentialSavings: this.estimateTestCost(order.testName),
      createdAt: new Date(),
      status: "active",
      responseRequired: true
    };
  }

  private estimateTestCost(testName: string): number {
    for (const [name, cost] of Object.entries(AVERAGE_TEST_COSTS)) {
      if (testName.toLowerCase().includes(name.toLowerCase())) {
        return cost;
      }
    }
    return 500;
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }

  async respondToAlert(
    alertId: string,
    response: "accept" | "override",
    overrideReason?: string,
    clinicalJustification?: string
  ): Promise<{ success: boolean; alert: DuplicateAlert | null }> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return { success: false, alert: null };
    }

    if (response === "accept") {
      alert.status = "accepted";
    } else {
      alert.status = "overridden";
      alert.clinicalJustification = clinicalJustification;
    }

    this.updateAnalytics(alert.patientId, [], response === "accept" ? alert.potentialSavings : 0);

    return { success: true, alert };
  }

  async retrievePriorResult(alertId: string, priorTestId: string): Promise<{
    success: boolean;
    result?: TestResult;
    retrievalTime?: number;
  }> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return { success: false };
    }

    const priorTest = alert.priorTests.find(t => t.id === priorTestId);
    if (!priorTest || !priorTest.retrievable) {
      return { success: false };
    }

    const startTime = Date.now();

    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    const mockResult: TestResult = {
      status: Math.random() > 0.3 ? "normal" : "abnormal",
      summary: `${priorTest.testName} performed on ${priorTest.performedAt.toLocaleDateString()}`,
      impression: priorTest.testType === "imaging" 
        ? "No acute findings. Comparison with prior studies shows stability."
        : undefined,
      labValues: priorTest.testType === "lab" ? [{
        component: priorTest.testName,
        value: 45 + Math.random() * 30,
        unit: "mg/dL",
        referenceRange: { low: 30, high: 100 }
      }] : undefined
    };

    return {
      success: true,
      result: mockResult,
      retrievalTime: Date.now() - startTime
    };
  }

  private updateAnalytics(patientId: string, alerts: DuplicateAlert[], savings: number = 0): void {
    let analytics = this.analytics.get(patientId);
    
    if (!analytics) {
      analytics = {
        patientId,
        period: { start: new Date(), end: new Date() },
        totalOrdersScreened: 0,
        duplicatesDetected: 0,
        duplicatesPrevented: 0,
        duplicatesOverridden: 0,
        totalSavings: 0,
        savingsByCategory: {},
        topDuplicateTests: [],
        providerStats: []
      };
    }

    analytics.totalOrdersScreened++;
    analytics.duplicatesDetected += alerts.length;
    analytics.totalSavings += savings;
    analytics.period.end = new Date();

    this.analytics.set(patientId, analytics);
  }

  getAlertsByPatient(patientId: string, status?: DuplicateAlert["status"][]): DuplicateAlert[] {
    return Array.from(this.alerts.values())
      .filter(a => a.patientId === patientId)
      .filter(a => !status || status.includes(a.status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getAlertById(alertId: string): DuplicateAlert | null {
    return this.alerts.get(alertId) || null;
  }

  getAnalytics(patientId: string): DuplicateAnalytics | null {
    return this.analytics.get(patientId) || null;
  }

  getSystemAnalytics(): {
    totalAlerts: number;
    totalSavings: number;
    preventionRate: number;
    alertsByType: Record<DuplicateAlert["alertType"], number>;
    alertsBySeverity: Record<DuplicateAlert["severity"], number>;
  } {
    const allAlerts = Array.from(this.alerts.values());
    
    const alertsByType: Record<DuplicateAlert["alertType"], number> = {
      exact_duplicate: 0,
      similar_test: 0,
      recent_normal: 0,
      pending_result: 0,
      cost_opportunity: 0
    };

    const alertsBySeverity: Record<DuplicateAlert["severity"], number> = {
      high: 0,
      medium: 0,
      low: 0
    };

    let totalSavings = 0;
    let prevented = 0;

    for (const alert of allAlerts) {
      alertsByType[alert.alertType]++;
      alertsBySeverity[alert.severity]++;
      
      if (alert.status === "accepted") {
        totalSavings += alert.potentialSavings;
        prevented++;
      }
    }

    return {
      totalAlerts: allAlerts.length,
      totalSavings,
      preventionRate: allAlerts.length > 0 ? (prevented / allAlerts.length) * 100 : 0,
      alertsByType,
      alertsBySeverity
    };
  }

  async generateAIRecommendation(order: TestOrder, priorTests: PriorTest[]): Promise<string> {
    const context = `
Order: ${order.testName} (${order.orderType})
Ordered by: ${order.orderingProvider.name} (${order.orderingProvider.specialty || "Unknown specialty"})
Clinical Indication: ${order.clinicalIndication || "Not specified"}
Priority: ${order.priority}

Prior Tests (last 90 days):
${priorTests.map(t => `- ${t.testName} at ${t.facility} on ${t.performedAt.toLocaleDateString()} (${t.result?.status || "pending"})`).join("\n")}
`;

    try {
      const response = await chatComplete({
        model: "deep",
        messages: [
          {
            role: "system",
            content: `You are a clinical decision support system helping physicians avoid unnecessary duplicate testing. 
Provide a brief, actionable recommendation about whether this test should proceed, be modified, or if prior results should be retrieved.
Be concise (2-3 sentences). Focus on clinical utility and cost-effectiveness.
Do NOT diagnose or recommend treatments. Only advise on test appropriateness.`
          },
          {
            role: "user",
            content: context
          }
        ],
        maxOutputTokens: 200,
        temperature: 0.3
      ,
      dataCategories: ["conditions","lab_results"],
      purpose: "clinical_decision_support",
      callerService: "duplicate-test-prevention-service",
      callerMethod: "duplicateTestPrevention"});

      return response.content || "Unable to generate recommendation.";
    } catch (error) {
      console.error("AI recommendation error:", error);
      return "Unable to generate AI recommendation at this time.";
    }
  }

  getEquivalenceRules(testType: "imaging" | "lab"): TestEquivalenceRule[] {
    return testType === "imaging" ? IMAGING_EQUIVALENCE_RULES : LAB_EQUIVALENCE_RULES;
  }

  getCostEstimates(): Record<string, number> {
    return { ...AVERAGE_TEST_COSTS };
  }
}

export const duplicateTestPreventionService = new DuplicateTestPreventionService();

export function initializeDuplicateTestPrevention() {
  console.log("Duplicate test prevention service initialized");
}
