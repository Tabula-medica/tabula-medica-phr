import { Router, Request, Response } from "express";
import { z } from "zod";
import { sendSmsSchema, smsCategories, smsStatuses } from "@shared/schema";
import { sendSms, getSmsHistory, getSmsById, getSmsStats } from "./sms-service";

const router = Router();

const smsHistoryQuerySchema = z.object({
  patientId: z.string().optional(),
  category: z.enum(smsCategories).optional(),
  status: z.enum(smsStatuses).optional(),
});

router.post("/send", async (req: Request, res: Response) => {
  try {
    const parsed = sendSmsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await sendSms({
      to: parsed.data.to,
      body: parsed.data.body,
      category: parsed.data.category,
      patientId: parsed.data.patientId,
      sentBy: "system",
    });

    if (result.status === "failed") {
      return res.status(502).json(result);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("[SMS] Error sending SMS:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/history", (req: Request, res: Response) => {
  const parsed = smsHistoryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid query parameters",
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const messages = getSmsHistory(parsed.data);
  return res.json(messages);
});

router.get("/stats", (_req: Request, res: Response) => {
  return res.json(getSmsStats());
});

router.get("/:id", (req: Request, res: Response) => {
  const message = getSmsById(req.params.id);
  if (!message) {
    return res.status(404).json({ error: "SMS message not found" });
  }
  return res.json(message);
});

export function registerSmsRoutes(app: any) {
  app.use("/api/sms", router);
  console.log("[Routes] SMS routes registered at /api/sms/*");
}

export default router;
