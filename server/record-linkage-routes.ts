import { Router, type Request, type Response } from "express";
import { bigQueryRecordLinkage } from "./services/bigquery-record-linkage";

const router = Router();

router.post("/api/record-linkage/run", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const { recordsA, recordsB, sourceA, sourceB, config } = req.body;

    if (!recordsA || !recordsB || !sourceA || !sourceB) {
      return res.status(400).json({ error: "recordsA, recordsB, sourceA, and sourceB are required" });
    }

    const job = await bigQueryRecordLinkage.startLinkageJob(
      recordsA,
      recordsB,
      sourceA,
      sourceB,
      config,
      userId
    );

    res.json(job);
  } catch (error: any) {
    console.error("[RecordLinkage] Error:", error.message);
    res.status(500).json({ error: "Record linkage failed" });
  }
});

router.get("/api/record-linkage/jobs/:id", async (req: Request, res: Response) => {
  try {
    const job = await bigQueryRecordLinkage.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch job" });
  }
});

router.post("/api/record-linkage/jobs/:id/confirm/:index", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const success = await bigQueryRecordLinkage.confirmMatch(
      req.params.id,
      parseInt(req.params.index),
      userId
    );
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to confirm match" });
  }
});

router.post("/api/record-linkage/jobs/:id/reject/:index", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Authentication required" });

    const success = await bigQueryRecordLinkage.rejectMatch(
      req.params.id,
      parseInt(req.params.index),
      userId
    );
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to reject match" });
  }
});

router.get("/api/record-linkage/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await bigQueryRecordLinkage.getLinkageStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

export function registerRecordLinkageRoutes(app: any) {
  app.use(router);
  console.log("[RecordLinkageRoutes] Registered: /api/record-linkage/*");
}
