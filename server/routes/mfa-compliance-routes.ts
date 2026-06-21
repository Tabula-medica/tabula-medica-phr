import { Router, type Request, type Response } from "express";
import { mfaComplianceService } from "../services/mfa-compliance-service";

const router = Router();

router.get("/metadata", (_req: Request, res: Response) => {
  res.json(mfaComplianceService.getMetadata());
});

router.get("/policy", (_req: Request, res: Response) => {
  res.json({ policy: mfaComplianceService.getPolicy() });
});

router.patch("/policy", (req: Request, res: Response) => {
  try {
    const updated = mfaComplianceService.updatePolicy(req.body);
    res.json({ policy: updated, message: "MFA policy updated successfully" });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/enrollment-status", async (_req: Request, res: Response) => {
  try {
    const status = await mfaComplianceService.getEnrollmentStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/compliance-report", async (_req: Request, res: Response) => {
  try {
    const report = await mfaComplianceService.generateComplianceReport();
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/audit-events", (req: Request, res: Response) => {
  const { eventType, userId, startDate, endDate } = req.query;
  const events = mfaComplianceService.getAuditEvents({
    eventType: eventType as string,
    userId: userId as string,
    startDate: startDate as string,
    endDate: endDate as string,
  });
  res.json({ events, total: events.length });
});

router.post("/audit-events", (req: Request, res: Response) => {
  try {
    const event = mfaComplianceService.logAuditEvent(req.body);
    res.status(201).json(event);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
