import { db } from "./db";
import { labOrders, healthRecords } from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { labsIntegrationService } from "./labs-integration-service";
import crypto from "crypto";

export interface LabTestCatalogEntry {
  code: string;
  name: string;
  loincCode: string;
  category: string;
  specimenType: string;
  fastingRequired: boolean;
  turnaroundDays: number;
  availableAt: string[];
  commonDiagnoses: Array<{ code: string; description: string }>;
  panelComponents?: string[];
  estimatedCost?: { quest: number; labcorp: number };
}

export interface CreateLabOrderRequest {
  patientId: string;
  providerId: string;
  labProvider: "quest" | "labcorp";
  tests: Array<{
    code: string;
    name: string;
    loincCode: string;
    category: string;
  }>;
  diagnoses: Array<{ code: string; description: string }>;
  priority: "routine" | "stat" | "urgent";
  specialInstructions?: string;
  collectionSite?: string;
  fastingRequired: boolean;
  scheduledDate?: string;
}

export interface LabOrderSubmissionResult {
  orderId: string;
  orderNumber: string;
  status: "submitted" | "error";
  labProvider: string;
  estimatedResultDate: string;
  confirmationDetails: {
    accessionNumber: string;
    submittedAt: string;
    testCount: number;
  };
  cdsAlerts?: Array<{
    type: string;
    severity: string;
    message: string;
    recommendation: string;
  }>;
}

const LAB_TEST_CATALOG: LabTestCatalogEntry[] = [
  {
    code: "CBC",
    name: "Complete Blood Count with Differential",
    loincCode: "58410-2",
    category: "hematology",
    specimenType: "Whole Blood (EDTA)",
    fastingRequired: false,
    turnaroundDays: 1,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "D64.9", description: "Anemia, unspecified" },
      { code: "Z00.00", description: "General adult medical examination" },
      { code: "R53.83", description: "Other fatigue" },
    ],
    panelComponents: ["WBC", "RBC", "Hemoglobin", "Hematocrit", "Platelets", "MCV", "MCH", "MCHC", "RDW", "Neutrophils", "Lymphocytes", "Monocytes", "Eosinophils", "Basophils"],
    estimatedCost: { quest: 12, labcorp: 14 },
  },
  {
    code: "CMP",
    name: "Comprehensive Metabolic Panel",
    loincCode: "24323-8",
    category: "chemistry",
    specimenType: "Serum (SST)",
    fastingRequired: true,
    turnaroundDays: 1,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "E11.9", description: "Type 2 diabetes mellitus without complications" },
      { code: "Z00.00", description: "General adult medical examination" },
      { code: "N18.9", description: "Chronic kidney disease, unspecified" },
    ],
    panelComponents: ["Glucose", "BUN", "Creatinine", "eGFR", "Sodium", "Potassium", "Chloride", "CO2", "Calcium", "Total Protein", "Albumin", "Bilirubin", "ALP", "AST", "ALT"],
    estimatedCost: { quest: 14, labcorp: 16 },
  },
  {
    code: "BMP",
    name: "Basic Metabolic Panel",
    loincCode: "24320-4",
    category: "chemistry",
    specimenType: "Serum (SST)",
    fastingRequired: true,
    turnaroundDays: 1,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "E87.6", description: "Hypokalemia" },
      { code: "E11.9", description: "Type 2 diabetes mellitus" },
      { code: "I10", description: "Essential hypertension" },
    ],
    panelComponents: ["Glucose", "BUN", "Creatinine", "eGFR", "Sodium", "Potassium", "Chloride", "CO2", "Calcium"],
    estimatedCost: { quest: 10, labcorp: 11 },
  },
  {
    code: "LIPID",
    name: "Lipid Panel",
    loincCode: "57698-3",
    category: "chemistry",
    specimenType: "Serum (SST)",
    fastingRequired: true,
    turnaroundDays: 1,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "E78.5", description: "Hyperlipidemia, unspecified" },
      { code: "Z00.00", description: "General adult medical examination" },
      { code: "E78.0", description: "Pure hypercholesterolemia" },
    ],
    panelComponents: ["Total Cholesterol", "HDL Cholesterol", "LDL Cholesterol (calc)", "Triglycerides", "VLDL (calc)", "Total/HDL Ratio"],
    estimatedCost: { quest: 15, labcorp: 16 },
  },
  {
    code: "A1C",
    name: "Hemoglobin A1c",
    loincCode: "4548-4",
    category: "chemistry",
    specimenType: "Whole Blood (EDTA)",
    fastingRequired: false,
    turnaroundDays: 1,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "E11.9", description: "Type 2 diabetes mellitus" },
      { code: "E11.65", description: "Type 2 DM with hyperglycemia" },
      { code: "R73.09", description: "Other abnormal glucose" },
    ],
    estimatedCost: { quest: 20, labcorp: 22 },
  },
  {
    code: "TSH",
    name: "Thyroid Stimulating Hormone",
    loincCode: "3016-3",
    category: "chemistry",
    specimenType: "Serum (SST)",
    fastingRequired: false,
    turnaroundDays: 1,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "E03.9", description: "Hypothyroidism, unspecified" },
      { code: "E05.90", description: "Thyrotoxicosis, unspecified" },
      { code: "R53.83", description: "Other fatigue" },
    ],
    estimatedCost: { quest: 25, labcorp: 28 },
  },
  {
    code: "FT4",
    name: "Free T4 (Thyroxine)",
    loincCode: "3024-7",
    category: "chemistry",
    specimenType: "Serum (SST)",
    fastingRequired: false,
    turnaroundDays: 1,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "E03.9", description: "Hypothyroidism, unspecified" },
      { code: "E05.90", description: "Thyrotoxicosis, unspecified" },
    ],
    estimatedCost: { quest: 22, labcorp: 24 },
  },
  {
    code: "UA",
    name: "Urinalysis with Microscopy",
    loincCode: "24356-8",
    category: "urinalysis",
    specimenType: "Urine (Clean Catch)",
    fastingRequired: false,
    turnaroundDays: 1,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "N39.0", description: "Urinary tract infection, unspecified" },
      { code: "R30.0", description: "Dysuria" },
      { code: "Z00.00", description: "General adult medical examination" },
    ],
    estimatedCost: { quest: 8, labcorp: 10 },
  },
  {
    code: "PT_INR",
    name: "Prothrombin Time / INR",
    loincCode: "5902-2",
    category: "hematology",
    specimenType: "Plasma (Citrate)",
    fastingRequired: false,
    turnaroundDays: 1,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "Z79.01", description: "Long term use of anticoagulants" },
      { code: "D68.9", description: "Coagulation defect, unspecified" },
    ],
    estimatedCost: { quest: 12, labcorp: 14 },
  },
  {
    code: "PSA",
    name: "Prostate-Specific Antigen",
    loincCode: "2857-1",
    category: "chemistry",
    specimenType: "Serum (SST)",
    fastingRequired: false,
    turnaroundDays: 2,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "Z12.5", description: "Screening for malignant neoplasm of prostate" },
      { code: "N40.0", description: "Benign prostatic hyperplasia" },
    ],
    estimatedCost: { quest: 30, labcorp: 32 },
  },
  {
    code: "VITD",
    name: "Vitamin D, 25-Hydroxy",
    loincCode: "1989-3",
    category: "chemistry",
    specimenType: "Serum (SST)",
    fastingRequired: false,
    turnaroundDays: 3,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "E55.9", description: "Vitamin D deficiency, unspecified" },
      { code: "M81.0", description: "Age-related osteoporosis" },
    ],
    estimatedCost: { quest: 45, labcorp: 50 },
  },
  {
    code: "B12",
    name: "Vitamin B12",
    loincCode: "2132-9",
    category: "chemistry",
    specimenType: "Serum (SST)",
    fastingRequired: false,
    turnaroundDays: 2,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "E53.8", description: "Deficiency of other B group vitamins" },
      { code: "D51.9", description: "Vitamin B12 deficiency anemia" },
      { code: "R53.83", description: "Other fatigue" },
    ],
    estimatedCost: { quest: 20, labcorp: 22 },
  },
  {
    code: "IRON_PANEL",
    name: "Iron Panel (Fe, TIBC, Ferritin)",
    loincCode: "2498-4",
    category: "chemistry",
    specimenType: "Serum (SST)",
    fastingRequired: true,
    turnaroundDays: 2,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "D50.9", description: "Iron deficiency anemia, unspecified" },
      { code: "E61.1", description: "Iron deficiency" },
    ],
    panelComponents: ["Serum Iron", "TIBC", "% Saturation", "Ferritin"],
    estimatedCost: { quest: 35, labcorp: 38 },
  },
  {
    code: "LFT",
    name: "Liver Function Tests (Hepatic Panel)",
    loincCode: "24325-3",
    category: "chemistry",
    specimenType: "Serum (SST)",
    fastingRequired: false,
    turnaroundDays: 1,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "K76.0", description: "Fatty liver, not elsewhere classified" },
      { code: "R74.01", description: "Elevation of liver transaminase levels" },
      { code: "K70.30", description: "Alcoholic cirrhosis of liver" },
    ],
    panelComponents: ["AST", "ALT", "ALP", "Total Bilirubin", "Direct Bilirubin", "Total Protein", "Albumin", "GGT"],
    estimatedCost: { quest: 16, labcorp: 18 },
  },
  {
    code: "CRP",
    name: "C-Reactive Protein (High Sensitivity)",
    loincCode: "30522-7",
    category: "chemistry",
    specimenType: "Serum (SST)",
    fastingRequired: false,
    turnaroundDays: 1,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "I25.10", description: "Atherosclerotic heart disease" },
      { code: "M79.3", description: "Panniculitis, unspecified" },
      { code: "R70.0", description: "Elevated ESR" },
    ],
    estimatedCost: { quest: 25, labcorp: 28 },
  },
  {
    code: "ESR",
    name: "Erythrocyte Sedimentation Rate",
    loincCode: "30341-2",
    category: "hematology",
    specimenType: "Whole Blood (EDTA)",
    fastingRequired: false,
    turnaroundDays: 1,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "R70.0", description: "Elevated ESR" },
      { code: "M35.9", description: "Systemic involvement of connective tissue" },
    ],
    estimatedCost: { quest: 10, labcorp: 12 },
  },
  {
    code: "HCG_QUANT",
    name: "hCG, Quantitative (Beta)",
    loincCode: "19080-1",
    category: "chemistry",
    specimenType: "Serum (SST)",
    fastingRequired: false,
    turnaroundDays: 1,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "Z32.01", description: "Pregnancy confirmed" },
      { code: "O09.90", description: "Supervision of high risk pregnancy" },
    ],
    estimatedCost: { quest: 30, labcorp: 35 },
  },
  {
    code: "MONO",
    name: "Mono Spot (Heterophile Ab)",
    loincCode: "31418-7",
    category: "immunology",
    specimenType: "Serum (SST)",
    fastingRequired: false,
    turnaroundDays: 1,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "B27.90", description: "Infectious mononucleosis, unspecified" },
      { code: "R50.9", description: "Fever, unspecified" },
    ],
    estimatedCost: { quest: 15, labcorp: 18 },
  },
  {
    code: "URIC_ACID",
    name: "Uric Acid",
    loincCode: "3084-1",
    category: "chemistry",
    specimenType: "Serum (SST)",
    fastingRequired: false,
    turnaroundDays: 1,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "M10.9", description: "Gout, unspecified" },
      { code: "E79.0", description: "Hyperuricemia" },
    ],
    estimatedCost: { quest: 10, labcorp: 12 },
  },
  {
    code: "MAGNESIUM",
    name: "Magnesium",
    loincCode: "19123-9",
    category: "chemistry",
    specimenType: "Serum (SST)",
    fastingRequired: false,
    turnaroundDays: 1,
    availableAt: ["quest", "labcorp"],
    commonDiagnoses: [
      { code: "E83.42", description: "Hypomagnesemia" },
      { code: "R25.1", description: "Fasciculation" },
    ],
    estimatedCost: { quest: 12, labcorp: 14 },
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  hematology: "Hematology",
  chemistry: "Chemistry",
  urinalysis: "Urinalysis",
  immunology: "Immunology",
  microbiology: "Microbiology",
  toxicology: "Toxicology",
  genetics: "Genetics",
  pathology: "Pathology",
};

class LabOrderingService {
  getTestCatalog(options?: {
    category?: string;
    labProvider?: string;
    search?: string;
  }): LabTestCatalogEntry[] {
    let catalog = [...LAB_TEST_CATALOG];

    if (options?.category) {
      catalog = catalog.filter(t => t.category === options.category);
    }

    if (options?.labProvider) {
      catalog = catalog.filter(t => t.availableAt.includes(options.labProvider!));
    }

    if (options?.search) {
      const searchLower = options.search.toLowerCase();
      catalog = catalog.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        t.code.toLowerCase().includes(searchLower) ||
        t.loincCode.includes(searchLower)
      );
    }

    return catalog;
  }

  getTestCategories(): Array<{ id: string; name: string; count: number }> {
    const categoryCounts: Record<string, number> = {};
    LAB_TEST_CATALOG.forEach(t => {
      categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
    });

    return Object.entries(categoryCounts).map(([id, count]) => ({
      id,
      name: CATEGORY_LABELS[id] || id,
      count,
    }));
  }

  async createOrder(request: CreateLabOrderRequest): Promise<{ orderId: string; order: any }> {
    const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const fastingRequired = request.fastingRequired ||
      request.tests.some(t => {
        const catalogEntry = LAB_TEST_CATALOG.find(c => c.code === t.code);
        return catalogEntry?.fastingRequired ?? false;
      });

    const cdsAlerts = this.runPreOrderCDSChecks(request);

    const [order] = await db.insert(labOrders).values({
      patientId: request.patientId,
      providerId: request.providerId,
      labProvider: request.labProvider,
      status: "draft",
      priority: request.priority,
      orderNumber,
      tests: request.tests,
      diagnoses: request.diagnoses || [],
      specialInstructions: request.specialInstructions || null,
      collectionSite: request.collectionSite || null,
      fastingRequired,
      scheduledDate: request.scheduledDate ? new Date(request.scheduledDate) : null,
      cdsAlerts: cdsAlerts.length > 0 ? cdsAlerts : null,
    }).returning();

    return { orderId: order.id, order };
  }

  async submitOrder(orderId: string, providerId: string): Promise<LabOrderSubmissionResult> {
    const [order] = await db.select().from(labOrders)
      .where(and(eq(labOrders.id, orderId), eq(labOrders.providerId, providerId)));

    if (!order) {
      throw new Error("Order not found or access denied");
    }

    if (order.status !== "draft") {
      throw new Error(`Cannot submit order in status: ${order.status}`);
    }

    const accessionNumber = `ACC-${order.labProvider.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const submittedAt = new Date();

    const tests = order.tests as Array<{ code: string; name: string; loincCode: string; category: string }>;
    const maxTurnaround = Math.max(...tests.map(t => {
      const catalogEntry = LAB_TEST_CATALOG.find(c => c.code === t.code);
      return catalogEntry?.turnaroundDays ?? 3;
    }));

    let turnaroundMultiplier = 1;
    if (order.priority === "stat") turnaroundMultiplier = 0.25;
    else if (order.priority === "urgent") turnaroundMultiplier = 0.5;

    const estimatedResultDate = new Date(submittedAt.getTime() + maxTurnaround * turnaroundMultiplier * 24 * 60 * 60 * 1000);

    await db.update(labOrders)
      .set({
        status: "submitted",
        accessionNumber,
        submittedAt,
        updatedAt: new Date(),
      })
      .where(eq(labOrders.id, orderId));

    return {
      orderId: order.id,
      orderNumber: order.orderNumber!,
      status: "submitted",
      labProvider: order.labProvider,
      estimatedResultDate: estimatedResultDate.toISOString(),
      confirmationDetails: {
        accessionNumber,
        submittedAt: submittedAt.toISOString(),
        testCount: tests.length,
      },
      cdsAlerts: order.cdsAlerts as any[] || undefined,
    };
  }

  async cancelOrder(orderId: string, providerId: string, reason: string): Promise<void> {
    const [order] = await db.select().from(labOrders)
      .where(and(eq(labOrders.id, orderId), eq(labOrders.providerId, providerId)));

    if (!order) {
      throw new Error("Order not found or access denied");
    }

    if (!["draft", "submitted"].includes(order.status)) {
      throw new Error(`Cannot cancel order in status: ${order.status}`);
    }

    await db.update(labOrders)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(labOrders.id, orderId));
  }

  async getOrders(options: {
    providerId?: string;
    patientId?: string;
    status?: string[];
    limit?: number;
    offset?: number;
  }): Promise<{ orders: any[]; total: number }> {
    const conditions: any[] = [];

    if (options.providerId) {
      conditions.push(eq(labOrders.providerId, options.providerId));
    }

    if (options.patientId) {
      conditions.push(eq(labOrders.patientId, options.patientId));
    }

    if (options.status && options.status.length > 0) {
      conditions.push(inArray(labOrders.status, options.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orders = await db.select().from(labOrders)
      .where(whereClause)
      .orderBy(desc(labOrders.createdAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0);

    return { orders, total: orders.length };
  }

  async getOrder(orderId: string): Promise<any> {
    const [order] = await db.select().from(labOrders)
      .where(eq(labOrders.id, orderId));
    return order || null;
  }

  async receiveResults(orderId: string, results: any): Promise<void> {
    await db.update(labOrders)
      .set({
        status: "resulted",
        results,
        resultedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(labOrders.id, orderId));
  }

  async integrateResultsIntoPatientRecord(orderId: string): Promise<{ recordIds: string[] }> {
    const order = await this.getOrder(orderId);
    if (!order || !order.results) {
      throw new Error("Order not found or no results available");
    }

    const results = order.results as any;
    const tests = order.tests as Array<{ code: string; name: string; loincCode: string; category: string }>;
    const recordIds: string[] = [];

    for (const test of tests) {
      const testResult = results.components?.find((c: any) => c.testCode === test.code) || results;

      const [record] = await db.insert(healthRecords).values({
        userId: order.patientId,
        type: "lab",
        title: `${test.name} Results`,
        summary: this.generateResultSummary(testResult),
        date: order.resultedAt || new Date(),
        provider: order.providerId,
        facility: order.labProvider === "quest" ? "Quest Diagnostics" : "LabCorp",
        details: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          testCode: test.code,
          loincCode: test.loincCode,
          category: test.category,
          priority: order.priority,
          results: testResult,
          accessionNumber: order.accessionNumber,
        },
        fhirResourceType: "DiagnosticReport",
        isManual: false,
      }).returning();

      recordIds.push(record.id);
    }

    return { recordIds };
  }

  private generateResultSummary(result: any): string {
    if (!result || !result.components) {
      return "Lab results received. Review details with your healthcare provider.";
    }

    const abnormal = result.components.filter((c: any) =>
      c.interpretation && c.interpretation !== "normal"
    );

    if (abnormal.length === 0) {
      return "All values within normal range.";
    }

    const critical = abnormal.filter((c: any) =>
      c.interpretation === "critical_low" || c.interpretation === "critical_high"
    );

    if (critical.length > 0) {
      return `${critical.length} critical value(s) detected. Immediate medical attention may be needed. ${abnormal.length - critical.length} additional abnormal result(s).`;
    }

    return `${abnormal.length} value(s) outside normal range. Discuss with your healthcare provider.`;
  }

  private runPreOrderCDSChecks(request: CreateLabOrderRequest): Array<{
    type: string;
    severity: string;
    message: string;
    recommendation: string;
  }> {
    const alerts: Array<{ type: string; severity: string; message: string; recommendation: string }> = [];

    const testCodes = request.tests.map(t => t.code);

    if (testCodes.includes("CMP") && testCodes.includes("BMP")) {
      alerts.push({
        type: "duplicate_coverage",
        severity: "moderate",
        message: "CMP already includes all BMP components",
        recommendation: "Consider removing BMP as CMP provides a superset of the same tests. This avoids unnecessary cost and extra blood draw volume.",
      });
    }

    if (testCodes.includes("LFT") && testCodes.includes("CMP")) {
      alerts.push({
        type: "partial_overlap",
        severity: "low",
        message: "CMP includes AST, ALT, ALP, Bilirubin, Albumin which overlap with Hepatic Panel",
        recommendation: "If only basic liver screening is needed, the CMP may suffice. Order Hepatic Panel separately only if GGT or Direct Bilirubin is specifically needed.",
      });
    }

    const fastingTests = request.tests.filter(t => {
      const entry = LAB_TEST_CATALOG.find(c => c.code === t.code);
      return entry?.fastingRequired;
    });

    if (fastingTests.length > 0 && !request.fastingRequired) {
      alerts.push({
        type: "fasting_required",
        severity: "high",
        message: `Fasting is required for: ${fastingTests.map(t => t.name).join(", ")}`,
        recommendation: "Ensure patient fasts for 8-12 hours before specimen collection. Non-fasting specimens may produce inaccurate glucose and lipid results.",
      });
    }

    if (request.priority === "stat" && testCodes.some(c => ["VITD", "B12", "PSA"].includes(c))) {
      alerts.push({
        type: "priority_mismatch",
        severity: "low",
        message: "STAT priority may not be clinically indicated for screening-type tests",
        recommendation: "Consider whether routine or urgent priority is more appropriate. STAT orders incur additional cost and may not result faster for send-out tests.",
      });
    }

    if (!request.diagnoses || request.diagnoses.length === 0) {
      alerts.push({
        type: "missing_diagnosis",
        severity: "moderate",
        message: "No diagnosis codes provided for the order",
        recommendation: "Include ICD-10 diagnosis codes to support medical necessity and ensure insurance coverage. Orders without diagnosis codes may be rejected or not covered.",
      });
    }

    return alerts;
  }

  async simulateResultReceival(orderId: string): Promise<any> {
    const order = await this.getOrder(orderId);
    if (!order) throw new Error("Order not found");

    const tests = order.tests as Array<{ code: string; name: string; loincCode: string; category: string }>;
    const simulatedResults: any = {
      reportDate: new Date().toISOString(),
      status: "final",
      performingLab: {
        name: order.labProvider === "quest" ? "Quest Diagnostics" : "LabCorp",
        clia: order.labProvider === "quest" ? "21D0862735" : "34D0655043",
        director: "Jane Smith, MD, PhD",
      },
      components: [],
    };

    for (const test of tests) {
      const catalogEntry = LAB_TEST_CATALOG.find(c => c.code === test.code);
      if (catalogEntry?.panelComponents) {
        for (const component of catalogEntry.panelComponents) {
          simulatedResults.components.push(this.generateSimulatedComponent(component, test.code));
        }
      } else {
        simulatedResults.components.push(this.generateSimulatedComponent(test.name, test.code));
      }
    }

    await this.receiveResults(orderId, simulatedResults);
    await this.integrateResultsIntoPatientRecord(orderId);

    return simulatedResults;
  }

  private generateSimulatedComponent(name: string, testCode: string): any {
    const ranges: Record<string, { low: number; high: number; unit: string; typical: number }> = {
      "WBC": { low: 4.5, high: 11.0, unit: "x10^3/uL", typical: 7.2 },
      "RBC": { low: 4.2, high: 5.9, unit: "x10^6/uL", typical: 4.8 },
      "Hemoglobin": { low: 12.0, high: 17.5, unit: "g/dL", typical: 14.5 },
      "Hematocrit": { low: 36.0, high: 50.0, unit: "%", typical: 43.0 },
      "Platelets": { low: 150, high: 400, unit: "x10^3/uL", typical: 250 },
      "Glucose": { low: 70, high: 100, unit: "mg/dL", typical: 92 },
      "BUN": { low: 7, high: 20, unit: "mg/dL", typical: 14 },
      "Creatinine": { low: 0.7, high: 1.3, unit: "mg/dL", typical: 1.0 },
      "Sodium": { low: 136, high: 145, unit: "mEq/L", typical: 140 },
      "Potassium": { low: 3.5, high: 5.0, unit: "mEq/L", typical: 4.2 },
      "Total Cholesterol": { low: 0, high: 200, unit: "mg/dL", typical: 185 },
      "HDL Cholesterol": { low: 40, high: 100, unit: "mg/dL", typical: 55 },
      "LDL Cholesterol (calc)": { low: 0, high: 130, unit: "mg/dL", typical: 110 },
      "Triglycerides": { low: 0, high: 150, unit: "mg/dL", typical: 120 },
      "TSH": { low: 0.4, high: 4.5, unit: "mIU/L", typical: 2.1 },
      "AST": { low: 10, high: 40, unit: "U/L", typical: 25 },
      "ALT": { low: 7, high: 56, unit: "U/L", typical: 30 },
      "ALP": { low: 44, high: 147, unit: "U/L", typical: 80 },
      "Total Bilirubin": { low: 0.1, high: 1.2, unit: "mg/dL", typical: 0.7 },
      "Albumin": { low: 3.5, high: 5.5, unit: "g/dL", typical: 4.2 },
      "Calcium": { low: 8.5, high: 10.5, unit: "mg/dL", typical: 9.5 },
    };

    const range = ranges[name];
    if (range) {
      const variation = (Math.random() - 0.5) * (range.high - range.low) * 0.6;
      const value = Math.round((range.typical + variation) * 10) / 10;
      const interpretation = value < range.low ? "low" : value > range.high ? "high" : "normal";

      return {
        name,
        testCode,
        value: value.toString(),
        valueNumeric: value,
        units: range.unit,
        referenceRange: { low: range.low, high: range.high, text: `${range.low}-${range.high} ${range.unit}` },
        interpretation,
      };
    }

    return {
      name,
      testCode,
      value: "Normal",
      interpretation: "normal",
    };
  }
}

export const labOrderingService = new LabOrderingService();
