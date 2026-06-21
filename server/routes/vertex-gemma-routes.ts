import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { askGemma } from "../services/vertex-gemma";
import { type AuthRequest } from "../middleware/require-feature";

const router = Router();

const askSchema = z.object({
  text: z.string().min(1).max(8000),
});

/**
 * POST /api/ai/gemma/ask
 *
 * Single-shot Vertex Gemma call. Fires only on user submit — no caching,
 * no streaming, no background invocation. Auth-gated so anonymous traffic
 * cannot burn through quota while it is "PENDING-QUOTA-APPROVAL".
 */
router.post("/ask", async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (!authReq.session || !(authReq.session as { userId?: string }).userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const parse = askSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid input", details: parse.error.flatten() });
  }

  try {
    const result = await askGemma(parse.data.text);
    res.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown Vertex error";
    const status = /quota|exceeded|exhausted/i.test(message)
      ? 429
      : /permission|denied|unauthor|credentials/i.test(message)
        ? 502
        : /not.*found|unavailable|model/i.test(message)
          ? 503
          : 500;
    console.error("[vertex-gemma] generateContent failed:", message);
    res.status(status).json({ success: false, error: message });
  }
});

export default router;
