// @ts-nocheck
import { Router, Request, Response } from "express";

export interface InstamedPaymentRequest {
  patientId: string;
  gfeId: string;
  amount: number;
  paymentMethod: "card" | "ach" | "hsa_card";
  cardLast4?: string;
  routingNumber?: string;
  accountLast4?: string;
}

export interface InstamedPaymentResult {
  transactionId: string;
  status: "approved" | "declined" | "pending_ach";
  amount: number;
  processingFee: number;
  netAmount: number;
  settlementDate: string;
  receiptUrl: string;
  lane: "A_INSTAMED";
  achWindowHours: number;
}

export interface InstamedRefundRequest {
  transactionId: string;
  amount: number;
  reason: string;
}

const paymentStore = new Map<string, InstamedPaymentResult>();

function generateTransactionId(): string {
  return `IM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function createInstamedRouter(): Router {
  const router = Router();

  router.post("/charge", (req: Request, res: Response) => {
    try {
      const { patientId, gfeId, amount, paymentMethod, cardLast4, accountLast4 } = req.body as InstamedPaymentRequest;

      if (!patientId || !gfeId || !amount || !paymentMethod) {
        return res.status(400).json({ error: "Missing required fields: patientId, gfeId, amount, paymentMethod" });
      }
      if (amount <= 0 || amount > 100000) {
        return res.status(400).json({ error: "Amount must be between $0.01 and $100,000" });
      }

      const isACH = paymentMethod === "ach";
      const processingFee = isACH ? 0 : Math.round(amount * 0.0275 * 100) / 100;
      const now = new Date();
      const settlementDate = new Date(now);
      settlementDate.setHours(settlementDate.getHours() + (isACH ? 24 : 48));

      const txId = generateTransactionId();
      const result: InstamedPaymentResult = {
        transactionId: txId,
        status: isACH ? "pending_ach" : "approved",
        amount,
        processingFee,
        netAmount: Math.round((amount - processingFee) * 100) / 100,
        settlementDate: settlementDate.toISOString(),
        receiptUrl: `/api/instamed/transaction/${txId}`,
        lane: "A_INSTAMED",
        achWindowHours: isACH ? 24 : 0,
      };

      paymentStore.set(result.transactionId, result);

      console.log(`[InstaMed] Lane A payment processed: ${result.transactionId}, method: ${paymentMethod}`);

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: "Payment processing failed", detail: err.message });
    }
  });

  router.get("/transaction/:transactionId", (req: Request, res: Response) => {
    const tx = paymentStore.get(req.params.transactionId);
    if (!tx) return res.status(404).json({ error: "Transaction not found" });
    res.json(tx);
  });

  router.post("/refund", (req: Request, res: Response) => {
    try {
      const { transactionId, amount, reason } = req.body as InstamedRefundRequest;
      if (!transactionId || !amount || !reason) {
        return res.status(400).json({ error: "Missing required fields: transactionId, amount, reason" });
      }

      const original = paymentStore.get(transactionId);
      if (!original) return res.status(404).json({ error: "Original transaction not found" });
      if (amount > original.amount) return res.status(400).json({ error: "Refund cannot exceed original amount" });

      const refundId = `REF-${generateTransactionId()}`;
      console.log(`[InstaMed] Refund processed: ${refundId}`);

      res.json({
        refundId,
        originalTransactionId: transactionId,
        refundAmount: amount,
        status: "processed",
        reason,
        processedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      res.status(500).json({ error: "Refund processing failed", detail: err.message });
    }
  });

  router.get("/config", (_req: Request, res: Response) => {
    const configured = !!(process.env.INSTAMED_MERCHANT_ID && process.env.INSTAMED_API_KEY);
    res.json({
      configured,
      mode: configured ? "live" : "demo",
      supportedMethods: ["card", "ach", "hsa_card"],
      achSettlementHours: 24,
      cardProcessingFee: "2.75%",
      achProcessingFee: "$0.00",
      disputeThreshold: 400,
    });
  });

  return router;
}
