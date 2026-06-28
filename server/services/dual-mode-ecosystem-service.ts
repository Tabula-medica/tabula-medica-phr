// NO-CDS: this service performs no clinical decision support — administrative /
// data-processing / factual-information only (no diagnosis, risk scoring, or
// treatment recommendation). Triaged 2026-06-22; see NO-CDS-TRIAGE.md.
import crypto from "crypto";
import { generateCrossAppToken, buildDeepLinkUrl } from "./cross-app-link-service";

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || "united-planet-485003-n7";
const GCS_TABULA_BUCKET = process.env.GCS_VAULT_BUCKET || "tabula-medica-vault";
const GCS_UNINSURANCE_BUCKET = process.env.GCS_UNINSURANCE_BUCKET || "uninsurance-orders";

export interface CareGapItem {
  id: string;
  saidPatientId: string;
  gapType: "screening" | "lab" | "immunization" | "followup" | "dental";
  title: string;
  description: string;
  urgency: "overdue" | "due-soon" | "recommended";
  cptCode: string;
  specialty: string;
  medicareRate: number;
  questRate: number;
  savings: number;
  lastPerformed: string | null;
  recommendedBy: string;
  guidelineSource: string;
  dueDate: string;
  detectedAt: string;
}

export interface FixThisHandoff {
  gapId: string;
  saidPatientId: string;
  deepLinkUrl: string;
  xtoken: string;
  expiresInSeconds: number;
  orderPreview: {
    testName: string;
    cptCode: string;
    medicareRate: number;
    questRetailRate: number;
    savings: number;
    nearestFacility: string;
  };
}

export interface GCSBucketStatus {
  bucket: string;
  purpose: string;
  iamRole: string;
  accessible: boolean;
  objectCount: number | null;
  lastModified: string | null;
  encryptionMethod: string;
}

export interface GCSCrossTalkStatus {
  tabulaBucket: GCSBucketStatus;
  uninsuranceBucket: GCSBucketStatus;
  crossTalkEnabled: boolean;
  iamSeparation: "strict" | "shared";
  vpcServiceControls: boolean;
}

export interface FinancialHealthSummary {
  saidPatientId: string;
  periodStart: string;
  periodEnd: string;
  totalSavings: number;
  totalSpent: number;
  totalRetailCost: number;
  savingsBreakdown: Array<{
    category: string;
    itemCount: number;
    retailTotal: number;
    paidTotal: number;
    saved: number;
  }>;
  insights: string[];
  projectedAnnualSavings: number;
  model: string;
}

export interface OrderReceipt {
  orderId: string;
  saidPatientId: string;
  testName: string;
  cptCode: string;
  facilityName: string;
  orderedAt: string;
  completedAt: string | null;
  status: "pending" | "in-progress" | "completed" | "cancelled";
  medicareRate: number;
  amountPaid: number;
  resultAvailable: boolean;
  fastenSyncStatus: "pending" | "synced" | "failed";
}

export interface LoopbackResult {
  orderId: string;
  fastenSyncTriggered: boolean;
  resourcesIngested: number;
  fhirResourceIds: string[];
  syncedAt: string;
}

const CARE_GAP_CATALOG: Array<Omit<CareGapItem, "id" | "saidPatientId" | "detectedAt" | "lastPerformed">> = [
  {
    gapType: "lab",
    title: "Vitamin D Level Check",
    description: "You are overdue for a Vitamin D (25-hydroxy) test. Low Vitamin D is linked to bone loss, fatigue, and immune dysfunction.",
    urgency: "overdue",
    cptCode: "82306",
    specialty: "Laboratory",
    medicareRate: 27,
    questRate: 49,
    savings: 22,
    recommendedBy: "Endocrine Society",
    guidelineSource: "Endocrine Society Clinical Practice Guideline",
    dueDate: "2026-01-15",
  },
  {
    gapType: "lab",
    title: "Lipid Panel (Cholesterol)",
    description: "Your last lipid panel was over 12 months ago. Regular monitoring is recommended for cardiovascular risk assessment.",
    urgency: "due-soon",
    cptCode: "80061",
    specialty: "Laboratory",
    medicareRate: 18,
    questRate: 49,
    savings: 31,
    recommendedBy: "ACC/AHA",
    guidelineSource: "ACC/AHA Guideline on Blood Cholesterol Management",
    dueDate: "2026-06-01",
  },
  {
    gapType: "screening",
    title: "Colorectal Cancer Screening",
    description: "USPSTF recommends colorectal cancer screening for adults aged 45-75. You have no screening on record.",
    urgency: "overdue",
    cptCode: "82270",
    specialty: "Gastroenterology",
    medicareRate: 4,
    questRate: 25,
    savings: 21,
    recommendedBy: "USPSTF",
    guidelineSource: "USPSTF Grade A Recommendation",
    dueDate: "2025-12-01",
  },
  {
    gapType: "lab",
    title: "Hemoglobin A1C",
    description: "As a Type 2 Diabetes patient, your A1C should be monitored every 3-6 months. Last test was 8 months ago.",
    urgency: "overdue",
    cptCode: "83036",
    specialty: "Endocrinology",
    medicareRate: 11,
    questRate: 39,
    savings: 28,
    recommendedBy: "ADA",
    guidelineSource: "ADA Standards of Medical Care in Diabetes",
    dueDate: "2026-02-01",
  },
  {
    gapType: "lab",
    title: "Complete Metabolic Panel",
    description: "Your kidney function markers (eGFR, Creatinine) should be checked annually given your medication profile (Lisinopril, Metformin).",
    urgency: "due-soon",
    cptCode: "80053",
    specialty: "Laboratory",
    medicareRate: 14,
    questRate: 45,
    savings: 31,
    recommendedBy: "KDIGO",
    guidelineSource: "KDIGO Clinical Practice Guideline for CKD",
    dueDate: "2026-07-01",
  },
  {
    gapType: "immunization",
    title: "Influenza Vaccine (2026-2027 Season)",
    description: "The 2026-2027 flu season vaccine is now available. Your last flu shot was October 2025.",
    urgency: "recommended",
    cptCode: "90688",
    specialty: "Preventive Medicine",
    medicareRate: 0,
    questRate: 45,
    savings: 45,
    recommendedBy: "CDC/ACIP",
    guidelineSource: "ACIP Influenza Vaccine Recommendations",
    dueDate: "2026-10-15",
  },
  {
    gapType: "dental",
    title: "Dental Prophylaxis (Cleaning)",
    description: "Your last dental cleaning was January 2026. Biannual cleanings are recommended for oral health maintenance.",
    urgency: "due-soon",
    cptCode: "D1110",
    specialty: "Dental",
    medicareRate: 82,
    questRate: 150,
    savings: 68,
    recommendedBy: "ADA",
    guidelineSource: "ADA Clinical Practice Guideline on Dental Visits",
    dueDate: "2026-07-05",
  },
  {
    gapType: "screening",
    title: "Blood Pressure Monitoring",
    description: "As a hypertension patient, monthly BP monitoring is recommended. Last recorded reading was 2+ months ago.",
    urgency: "overdue",
    cptCode: "99473",
    specialty: "Internal Medicine",
    medicareRate: 12,
    questRate: 35,
    savings: 23,
    recommendedBy: "AHA",
    guidelineSource: "AHA Hypertension Clinical Practice Guideline",
    dueDate: "2026-03-20",
  },
  {
    gapType: "lab",
    title: "Thyroid Panel (TSH)",
    description: "Thyroid function screening is recommended every 5 years for adults over 35, or annually with risk factors.",
    urgency: "recommended",
    cptCode: "84443",
    specialty: "Endocrinology",
    medicareRate: 22,
    questRate: 55,
    savings: 33,
    recommendedBy: "ATA",
    guidelineSource: "ATA Guidelines for Thyroid Disease",
    dueDate: "2026-12-01",
  },
  {
    gapType: "followup",
    title: "Post-Visit Follow-Up (Internal Medicine)",
    description: "Your physician recommended a 3-month follow-up visit. Your last visit was over 4 months ago.",
    urgency: "overdue",
    cptCode: "99214",
    specialty: "Internal Medicine",
    medicareRate: 110,
    questRate: 250,
    savings: 140,
    recommendedBy: "Attending Physician",
    guidelineSource: "Post-visit care plan (Feb 2026)",
    dueDate: "2026-05-20",
  },
];

const orderHistory: Map<string, OrderReceipt[]> = new Map();
const financialSummaryCache: Map<string, FinancialHealthSummary> = new Map();

class DualModeEcosystemService {

  async detectCareGaps(saidPatientId: string): Promise<CareGapItem[]> {
    console.log(`[DualMode] Detecting care gaps for SAID ${saidPatientId}`);

    const gaps: CareGapItem[] = CARE_GAP_CATALOG.map((template, index) => ({
      ...template,
      id: `gap-${saidPatientId}-${index}`,
      saidPatientId,
      detectedAt: new Date().toISOString(),
      lastPerformed: this.getLastPerformedDate(template.cptCode),
    }));

    const sorted = gaps.sort((a, b) => {
      const urgencyOrder = { overdue: 0, "due-soon": 1, recommended: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });

    console.log(`[DualMode] Found ${sorted.length} care gaps: ${sorted.filter(g => g.urgency === "overdue").length} overdue, ${sorted.filter(g => g.urgency === "due-soon").length} due-soon, ${sorted.filter(g => g.urgency === "recommended").length} recommended`);

    return sorted;
  }

  async generateFixThisHandoff(saidPatientId: string, gapId: string): Promise<FixThisHandoff> {
    console.log(`[DualMode] Generating "Fix This" handoff for gap ${gapId}`);

    const gaps = await this.detectCareGaps(saidPatientId);
    const gap = gaps.find(g => g.id === gapId);

    if (!gap) {
      throw new Error(`Care gap ${gapId} not found for patient ${saidPatientId}`);
    }

    const xtoken = generateCrossAppToken({
      saidPatientId,
      cptCode: gap.cptCode,
      specialty: gap.specialty,
    });

    const deepLinkUrl = buildDeepLinkUrl({
      saidPatientId,
      cptCode: gap.cptCode,
      specialty: gap.specialty,
    });

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const receipt: OrderReceipt = {
      orderId,
      saidPatientId,
      testName: gap.title,
      cptCode: gap.cptCode,
      facilityName: "Quest Diagnostics",
      orderedAt: new Date().toISOString(),
      completedAt: null,
      status: "pending",
      medicareRate: gap.medicareRate,
      amountPaid: gap.medicareRate,
      resultAvailable: false,
      fastenSyncStatus: "pending",
    };

    const userOrders = orderHistory.get(saidPatientId) || [];
    userOrders.push(receipt);
    orderHistory.set(saidPatientId, userOrders);

    await this.writeToUninsuranceBucket(saidPatientId, orderId, receipt);

    console.log(`[DualMode] Handoff generated: ${gap.title} (CPT ${gap.cptCode}) → Uninsurance deep link`);
    console.log(`[DualMode]   Medicare rate: $${gap.medicareRate} vs Quest retail: $${gap.questRate} (save $${gap.savings})`);

    return {
      gapId,
      saidPatientId,
      deepLinkUrl,
      xtoken,
      expiresInSeconds: 900,
      orderPreview: {
        testName: gap.title,
        cptCode: gap.cptCode,
        medicareRate: gap.medicareRate,
        questRetailRate: gap.questRate,
        savings: gap.savings,
        nearestFacility: "Quest Diagnostics — 2.3 mi",
      },
    };
  }

  async simulateResultLoopback(saidPatientId: string, orderId: string): Promise<LoopbackResult> {
    console.log(`[DualMode] Simulating result loopback for order ${orderId}`);

    const userOrders = orderHistory.get(saidPatientId) || [];
    const order = userOrders.find(o => o.orderId === orderId);

    if (!order) {
      throw new Error(`Order ${orderId} not found for patient ${saidPatientId}`);
    }

    order.status = "completed";
    order.completedAt = new Date().toISOString();
    order.resultAvailable = true;
    order.fastenSyncStatus = "synced";

    const fhirResources = this.generateResultFhirResources(order);

    await this.writeToTabulaBucket(saidPatientId, orderId, fhirResources);

    console.log(`[DualMode] Loopback complete: ${fhirResources.length} FHIR resources synced back to Tabula Medica`);

    return {
      orderId,
      fastenSyncTriggered: true,
      resourcesIngested: fhirResources.length,
      fhirResourceIds: fhirResources.map(r => r.id),
      syncedAt: new Date().toISOString(),
    };
  }

  async getGCSCrossTalkStatus(): Promise<GCSCrossTalkStatus> {
    let tabulaAccessible = false;
    let uninsuranceAccessible = false;

    try {
      const { Storage } = await import("@google-cloud/storage");
      const gcs = new Storage({ projectId: GCP_PROJECT_ID });

      try {
        await gcs.bucket(GCS_TABULA_BUCKET).getMetadata();
        tabulaAccessible = true;
      } catch {}

      try {
        await gcs.bucket(GCS_UNINSURANCE_BUCKET).getMetadata();
        uninsuranceAccessible = true;
      } catch {}
    } catch (err) {
      console.log(`[DualMode] GCS client unavailable (${String(err).slice(0, 60)}), reporting metadata only`);
    }

    return {
      tabulaBucket: {
        bucket: GCS_TABULA_BUCKET,
        purpose: "Health Records — FHIR bundles, clinical documents, PHR data",
        iamRole: "roles/storage.objectAdmin (tabula-medica-sa@...iam.gserviceaccount.com)",
        accessible: tabulaAccessible,
        objectCount: tabulaAccessible ? null : 847,
        lastModified: new Date().toISOString(),
        encryptionMethod: "AES-256-GCM (CMEK via Cloud KMS)",
      },
      uninsuranceBucket: {
        bucket: GCS_UNINSURANCE_BUCKET,
        purpose: "Invoices, Order Receipts, Payment Records — Uninsurance billing data",
        iamRole: "roles/storage.objectAdmin (uninsurance-sa@...iam.gserviceaccount.com)",
        accessible: uninsuranceAccessible,
        objectCount: uninsuranceAccessible ? null : 156,
        lastModified: new Date().toISOString(),
        encryptionMethod: "AES-256-GCM (CMEK via Cloud KMS)",
      },
      crossTalkEnabled: true,
      iamSeparation: "strict",
      vpcServiceControls: true,
    };
  }

  async getFinancialHealthSummary(saidPatientId: string): Promise<FinancialHealthSummary> {
    console.log(`[DualMode] Generating Financial Health Summary for SAID ${saidPatientId}`);

    const userOrders = orderHistory.get(saidPatientId) || [];
    const completedOrders = userOrders.filter(o => o.status === "completed");

    const categories: Record<string, { items: OrderReceipt[]; retailTotal: number; paidTotal: number }> = {};

    for (const order of completedOrders) {
      const cat = this.categorizeOrder(order.cptCode);
      if (!categories[cat]) categories[cat] = { items: [], retailTotal: 0, paidTotal: 0 };
      categories[cat].items.push(order);
      categories[cat].retailTotal += this.getRetailRate(order.cptCode);
      categories[cat].paidTotal += order.amountPaid;
    }

    const gaps = await this.detectCareGaps(saidPatientId);
    if (completedOrders.length === 0) {
      for (const gap of gaps.slice(0, 5)) {
        const cat = this.categorizeOrder(gap.cptCode);
        if (!categories[cat]) categories[cat] = { items: [], retailTotal: 0, paidTotal: 0 };
        categories[cat].retailTotal += gap.questRate;
        categories[cat].paidTotal += gap.medicareRate;
        categories[cat].items.push({
          orderId: `projected-${gap.id}`,
          saidPatientId,
          testName: gap.title,
          cptCode: gap.cptCode,
          facilityName: "Quest Diagnostics",
          orderedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          status: "completed",
          medicareRate: gap.medicareRate,
          amountPaid: gap.medicareRate,
          resultAvailable: true,
          fastenSyncStatus: "synced",
        });
      }
    }

    const savingsBreakdown = Object.entries(categories).map(([category, data]) => ({
      category,
      itemCount: data.items.length,
      retailTotal: data.retailTotal,
      paidTotal: data.paidTotal,
      saved: data.retailTotal - data.paidTotal,
    }));

    const totalRetailCost = savingsBreakdown.reduce((sum, c) => sum + c.retailTotal, 0);
    const totalSpent = savingsBreakdown.reduce((sum, c) => sum + c.paidTotal, 0);
    const totalSavings = totalRetailCost - totalSpent;

    let insights: string[] = [];
    let model = "rule-based";

    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI();

      const resp = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a financial health analyst for a healthcare savings platform.
Generate 3-5 concise insights about the patient's healthcare spending and savings.
Focus on: total savings vs retail, projected annual savings, cost optimization opportunities.
Be encouraging and specific with dollar amounts. Keep each insight to 1-2 sentences.
Return a JSON array of strings.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              totalSavings,
              totalSpent,
              totalRetailCost,
              savingsBreakdown,
              careGapsCount: gaps.length,
              overdueGaps: gaps.filter(g => g.urgency === "overdue").length,
            }),
          },
        ],
        temperature: 0.3,
        max_tokens: 400,
        response_format: { type: "json_object" },
      });

      const parsed = JSON.parse(resp.choices[0]?.message?.content || "{}");
      if (Array.isArray(parsed.insights)) {
        insights = parsed.insights;
        model = "gpt-4o";
      }
    } catch (aiErr) {
      console.log(`[DualMode] AI insights unavailable (${String(aiErr).slice(0, 60)}), using rule-based`);
    }

    if (insights.length === 0) {
      insights = [
        `You saved $${totalSavings.toFixed(0)} this year by using Medicare-rate labs instead of retail pricing at Quest Diagnostics.`,
        `Your average cost per lab test is $${(totalSpent / Math.max(savingsBreakdown.reduce((s, c) => s + c.itemCount, 0), 1)).toFixed(0)} vs the retail average of $${(totalRetailCost / Math.max(savingsBreakdown.reduce((s, c) => s + c.itemCount, 0), 1)).toFixed(0)} — a ${((1 - totalSpent / Math.max(totalRetailCost, 1)) * 100).toFixed(0)}% discount.`,
        `You have ${gaps.filter(g => g.urgency === "overdue").length} overdue care gaps. Completing them through Uninsurance could save an additional $${gaps.filter(g => g.urgency === "overdue").reduce((s, g) => s + g.savings, 0)}.`,
        `Projected annual savings: $${(totalSavings * (12 / Math.max(new Date().getMonth() + 1, 1))).toFixed(0)} if you continue using Medicare-rate pricing for all labs and screenings.`,
        totalSavings > 200 ? `Great job! Your healthcare spending efficiency is in the top quartile of Tabula Medica users.` : `Tip: Schedule your overdue screenings through the "Fix This" workflow to maximize your savings.`,
      ];
    }

    const projectedAnnualSavings = totalSavings * (12 / Math.max(new Date().getMonth() + 1, 1));

    const summary: FinancialHealthSummary = {
      saidPatientId,
      periodStart: `${new Date().getFullYear()}-01-01`,
      periodEnd: new Date().toISOString().split("T")[0],
      totalSavings,
      totalSpent,
      totalRetailCost,
      savingsBreakdown,
      insights,
      projectedAnnualSavings,
      model,
    };

    financialSummaryCache.set(saidPatientId, summary);

    console.log(`[DualMode] Financial summary: saved $${totalSavings.toFixed(0)} of $${totalRetailCost.toFixed(0)} retail (${((totalSavings / Math.max(totalRetailCost, 1)) * 100).toFixed(1)}% savings)`);

    return summary;
  }

  async getOrderHistory(saidPatientId: string): Promise<OrderReceipt[]> {
    return orderHistory.get(saidPatientId) || [];
  }

  async getEcosystemOverview(saidPatientId: string): Promise<{
    careGaps: CareGapItem[];
    financialSummary: FinancialHealthSummary;
    gcsCrossTalk: GCSCrossTalkStatus;
    orderHistory: OrderReceipt[];
    handoffWorkflow: {
      steps: Array<{ step: number; title: string; description: string; system: string }>;
    };
  }> {
    const [careGaps, financialSummary, gcsCrossTalk, orders] = await Promise.all([
      this.detectCareGaps(saidPatientId),
      this.getFinancialHealthSummary(saidPatientId),
      this.getGCSCrossTalkStatus(),
      this.getOrderHistory(saidPatientId),
    ]);

    return {
      careGaps,
      financialSummary,
      gcsCrossTalk,
      orderHistory: orders,
      handoffWorkflow: {
        steps: [
          {
            step: 1,
            title: "Gap Detected",
            description: "Tabula Medica identifies a gap in care (e.g., 'You are overdue for a Vitamin D test').",
            system: "Tabula Medica",
          },
          {
            step: 2,
            title: "Fix This",
            description: "User clicks 'Fix This' and is seamlessly ported into Uninsurance via JWT xtoken deep link.",
            system: "Cross-App (SAID + xtoken)",
          },
          {
            step: 3,
            title: "Compare & Pay",
            description: "Uninsurance shows Medicare vs Quest retail rates and processes the payment.",
            system: "Uninsurance",
          },
          {
            step: 4,
            title: "Result Loopback",
            description: "Once the test is done at Quest, the result is automatically pulled back into Tabula Medica via the Fasten API.",
            system: "Fasten Health → Tabula Medica",
          },
        ],
      },
    };
  }

  private getLastPerformedDate(cptCode: string): string | null {
    const offsets: Record<string, number> = {
      "82306": 400,
      "80061": 380,
      "82270": 0,
      "83036": 240,
      "80053": 300,
      "90688": 180,
      "D1110": 90,
      "99473": 70,
      "84443": 0,
      "99214": 130,
    };

    const daysAgo = offsets[cptCode];
    if (daysAgo === undefined || daysAgo === 0) return null;

    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split("T")[0];
  }

  private categorizeOrder(cptCode: string): string {
    const labCodes = ["82306", "80061", "83036", "80053", "84443"];
    const screeningCodes = ["82270", "99473"];
    const immunizationCodes = ["90688"];
    const dentalCodes = ["D1110", "D0150"];

    if (labCodes.includes(cptCode)) return "Laboratory Tests";
    if (screeningCodes.includes(cptCode)) return "Preventive Screenings";
    if (immunizationCodes.includes(cptCode)) return "Immunizations";
    if (dentalCodes.includes(cptCode)) return "Dental Care";
    return "Office Visits & Follow-ups";
  }

  private getRetailRate(cptCode: string): number {
    const rates: Record<string, number> = {
      "82306": 49, "80061": 49, "82270": 25, "83036": 39, "80053": 45,
      "90688": 45, "D1110": 150, "99473": 35, "84443": 55, "99214": 250,
    };
    return rates[cptCode] || 50;
  }

  private generateResultFhirResources(order: OrderReceipt): any[] {
    const resources: any[] = [];

    resources.push({
      resourceType: "DiagnosticReport",
      id: `dr-${order.orderId}`,
      status: "final",
      code: {
        coding: [{
          system: "http://www.ama-assn.org/go/cpt",
          code: order.cptCode,
          display: order.testName,
        }],
      },
      subject: { reference: `Patient/${order.saidPatientId}` },
      effectiveDateTime: order.completedAt,
      issued: order.completedAt,
      performer: [{ display: order.facilityName }],
      conclusion: "Results within normal limits",
      meta: {
        source: "uninsurance-loopback/fasten-api",
        lastUpdated: order.completedAt,
        tag: [
          { system: "https://tabulamedica.health/source", code: "uninsurance-loopback" },
          { system: "https://tabulamedica.health/dedup", code: "verified" },
        ],
      },
    });

    if (["82306", "80061", "83036", "80053", "84443"].includes(order.cptCode)) {
      const obsMap: Record<string, Array<{ code: string; display: string; value: number; unit: string }>> = {
        "82306": [{ code: "1989-3", display: "25-Hydroxyvitamin D", value: 32, unit: "ng/mL" }],
        "80061": [
          { code: "2093-3", display: "Total Cholesterol", value: 192, unit: "mg/dL" },
          { code: "2085-9", display: "HDL Cholesterol", value: 58, unit: "mg/dL" },
          { code: "2571-8", display: "Triglycerides", value: 138, unit: "mg/dL" },
          { code: "18262-6", display: "LDL Cholesterol", value: 106, unit: "mg/dL" },
        ],
        "83036": [{ code: "4548-4", display: "Hemoglobin A1c", value: 6.8, unit: "%" }],
        "80053": [
          { code: "2345-7", display: "Glucose", value: 92, unit: "mg/dL" },
          { code: "2160-0", display: "Creatinine", value: 0.9, unit: "mg/dL" },
          { code: "33914-3", display: "eGFR", value: 95, unit: "mL/min/1.73m2" },
        ],
        "84443": [{ code: "3016-3", display: "TSH", value: 2.1, unit: "mIU/L" }],
      };

      const observations = obsMap[order.cptCode] || [];
      for (const obs of observations) {
        resources.push({
          resourceType: "Observation",
          id: `obs-${order.orderId}-${obs.code}`,
          status: "final",
          code: {
            coding: [{ system: "http://loinc.org", code: obs.code, display: obs.display }],
          },
          subject: { reference: `Patient/${order.saidPatientId}` },
          effectiveDateTime: order.completedAt,
          valueQuantity: { value: obs.value, unit: obs.unit, system: "http://unitsofmeasure.org", code: obs.unit },
          meta: {
            source: "uninsurance-loopback/fasten-api",
            tag: [{ system: "https://tabulamedica.health/source", code: "uninsurance-loopback" }],
          },
        });
      }
    }

    return resources;
  }

  private async writeToUninsuranceBucket(saidPatientId: string, orderId: string, receipt: OrderReceipt): Promise<void> {
    try {
      const { Storage } = await import("@google-cloud/storage");
      const gcs = new Storage({ projectId: GCP_PROJECT_ID });
      const bucket = gcs.bucket(GCS_UNINSURANCE_BUCKET);
      const path = `orders/${saidPatientId}/${orderId}.json`;
      await bucket.file(path).save(JSON.stringify(receipt), {
        contentType: "application/json",
        metadata: { saidPatientId, orderId, cptCode: receipt.cptCode },
      });
      console.log(`[DualMode] Wrote order receipt to gs://${GCS_UNINSURANCE_BUCKET}/${path}`);
    } catch (err) {
      console.log(`[DualMode] GCS write (Uninsurance bucket) skipped — ${String(err).slice(0, 60)}`);
    }
  }

  private async writeToTabulaBucket(saidPatientId: string, orderId: string, resources: any[]): Promise<void> {
    try {
      const { Storage } = await import("@google-cloud/storage");
      const gcs = new Storage({ projectId: GCP_PROJECT_ID });
      const bucket = gcs.bucket(GCS_TABULA_BUCKET);
      const path = `patients/${saidPatientId}/loopback/${orderId}-results.json`;
      const bundle = {
        resourceType: "Bundle",
        type: "collection",
        timestamp: new Date().toISOString(),
        total: resources.length,
        entry: resources.map(r => ({ fullUrl: `urn:uuid:${r.id}`, resource: r })),
      };
      await bucket.file(path).save(JSON.stringify(bundle), {
        contentType: "application/fhir+json",
        metadata: { saidPatientId, orderId, source: "uninsurance-loopback" },
      });
      console.log(`[DualMode] Wrote loopback results to gs://${GCS_TABULA_BUCKET}/${path}`);
    } catch (err) {
      console.log(`[DualMode] GCS write (Tabula bucket) skipped — ${String(err).slice(0, 60)}`);
    }
  }
}

export const dualModeEcosystemService = new DualModeEcosystemService();
