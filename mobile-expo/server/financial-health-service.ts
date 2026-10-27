// @ts-nocheck
import { logger } from "./utils/logger";
import { db } from "./db";
import { healthRecords } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface FinancialHealthSummary {
  userId: string;
  saidPatientId: string | null;
  totalSavings: number;
  savingsBreakdown: SavingsItem[];
  spendingByCategory: Record<string, number>;
  ordersCompleted: number;
  ordersInProgress: number;
  recentOrders: OrderSummary[];
  insightText: string;
  generatedAt: string;
}

interface SavingsItem {
  service: string;
  cptCode: string;
  retailPrice: number;
  medicarePaidPrice: number;
  savings: number;
  date: string;
}

interface OrderSummary {
  orderId: string;
  service: string;
  status: "completed" | "pending" | "in_progress";
  amount: number;
  date: string;
  source: "uninsurance" | "direct";
}

const MEDICARE_RATE_ESTIMATES: Record<string, { retail: number; medicare: number; service: string }> = {
  "83036": { retail: 75, medicare: 18, service: "HbA1c (diabetes screening)" },
  "80061": { retail: 120, medicare: 32, service: "Lipid panel (cholesterol)" },
  "85025": { retail: 45, medicare: 11, service: "CBC (complete blood count)" },
  "80053": { retail: 95, medicare: 22, service: "CMP (comprehensive metabolic panel)" },
  "36415": { retail: 25, medicare: 3, service: "Venipuncture (blood draw)" },
  "81001": { retail: 35, medicare: 4, service: "Urinalysis" },
  "82947": { retail: 30, medicare: 8, service: "Glucose test" },
  "84443": { retail: 85, medicare: 23, service: "TSH (thyroid)" },
  "25600": { retail: 55, medicare: 14, service: "Vitamin D test" },
  "45378": { retail: 3500, medicare: 1100, service: "Colonoscopy" },
  "77067": { retail: 350, medicare: 147, service: "Mammogram" },
  "88175": { retail: 120, medicare: 28, service: "Pap smear" },
  "71271": { retail: 500, medicare: 130, service: "Low-dose CT (lung screening)" },
  "99213": { retail: 250, medicare: 105, service: "Office visit (primary care)" },
  "96127": { retail: 40, medicare: 8, service: "Depression screening (PHQ-9)" },
};

const orderStore: Map<string, OrderSummary & { userId: string }> = new Map();

export function recordOrder(
  userId: string,
  orderId: string,
  service: string,
  cptCode: string,
  amount: number,
  source: "uninsurance" | "direct" = "uninsurance"
): void {
  orderStore.set(orderId, {
    orderId,
    service,
    status: "pending",
    amount,
    date: new Date().toISOString(),
    source,
    userId,
  });
  logger.info("[FinancialHealth] Order recorded", { userId, orderId, service, cptCode });
}

export function completeOrder(orderId: string): boolean {
  const order = orderStore.get(orderId);
  if (!order) return false;
  order.status = "completed";
  return true;
}

export async function getFinancialHealthSummary(userId: string): Promise<FinancialHealthSummary> {
  let saidPatientId: string | null = null;
  try {
    const result = await db.execute(
      `SELECT said_patient_id FROM patients WHERE user_id = $1 LIMIT 1`,
      [userId] as any
    );
    saidPatientId = (result as any).rows?.[0]?.said_patient_id ?? null;
  } catch {
    logger.debug("[FinancialHealth] Could not look up SAID for user", { userId });
  }

  const userOrders = Array.from(orderStore.values()).filter(o => o.userId === userId);

  let savingsBreakdown: SavingsItem[] = [];
  let totalSavings = 0;
  const spendingByCategory: Record<string, number> = {};

  let userRecords: any[] = [];
  try {
    userRecords = await db.select().from(healthRecords).where(eq(healthRecords.userId, userId));
  } catch {
    logger.debug("[FinancialHealth] Could not fetch health records", { userId });
  }

  const labRecords = userRecords.filter(r => ["lab_result", "lab", "observation"].includes(r.type || ""));
  for (const record of labRecords) {
    const details = typeof record.details === "object" && record.details ? record.details as any : {};
    const cptCode = details.cptCode || details.cpt_code;
    if (cptCode && MEDICARE_RATE_ESTIMATES[cptCode]) {
      const rates = MEDICARE_RATE_ESTIMATES[cptCode];
      const savings = rates.retail - rates.medicare;
      savingsBreakdown.push({
        service: rates.service,
        cptCode,
        retailPrice: rates.retail,
        medicarePaidPrice: rates.medicare,
        savings,
        date: record.date?.toISOString() || new Date().toISOString(),
      });
      totalSavings += savings;
      const cat = cptCode.startsWith("8") ? "Laboratory" : "Procedures";
      spendingByCategory[cat] = (spendingByCategory[cat] || 0) + rates.medicare;
    }
  }

  for (const order of userOrders) {
    if (order.status === "completed") {
      spendingByCategory["Orders"] = (spendingByCategory["Orders"] || 0) + order.amount;
    }
  }

  const ordersCompleted = userOrders.filter(o => o.status === "completed").length;
  const ordersInProgress = userOrders.filter(o => o.status !== "completed").length;

  let insightText = "No financial activity recorded yet.";
  if (totalSavings > 0) {
    insightText = `You have saved an estimated $${totalSavings.toLocaleString()} this year by using Medicare-rate pricing instead of retail lab pricing.`;
    if (ordersCompleted > 0) {
      insightText += ` You completed ${ordersCompleted} order${ordersCompleted > 1 ? "s" : ""} through the care access platform.`;
    }
  } else if (ordersCompleted > 0) {
    insightText = `You completed ${ordersCompleted} healthcare order${ordersCompleted > 1 ? "s" : ""} through the care access platform.`;
  }

  try {
    const vertexConfigured = !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GCP_SERVICE_ACCOUNT_KEY || process.env.GCP_KEY);
    if (vertexConfigured && (savingsBreakdown.length > 0 || userOrders.length > 0)) {
      const prompt = `Summarize this patient's financial health in 2-3 sentences:
        - Total estimated savings from Medicare-rate pricing: $${totalSavings}
        - Lab tests with savings: ${savingsBreakdown.length}
        - Orders completed: ${ordersCompleted}
        - Spending by category: ${JSON.stringify(spendingByCategory)}
        Be encouraging and specific about dollar amounts saved.`;

      try {
        const { callAI } = await import("./ai-service-helpers");
        if (typeof callAI === "function") {
          const aiInsight = await callAI(prompt);
          if (aiInsight) insightText = aiInsight;
        }
      } catch {
        logger.debug("[FinancialHealth] AI insight generation skipped");
      }
    }
  } catch {
    logger.debug("[FinancialHealth] Vertex AI not available for financial insights");
  }

  return {
    userId,
    saidPatientId,
    totalSavings,
    savingsBreakdown,
    spendingByCategory,
    ordersCompleted,
    ordersInProgress,
    recentOrders: userOrders.slice(-10).map(({ userId: _uid, ...rest }) => rest),
    insightText,
    generatedAt: new Date().toISOString(),
  };
}
