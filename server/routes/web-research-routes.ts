/**
 * Admin-only web research routes backed by Firecrawl (no BAA).
 *
 * NON-PHI ONLY: inputs are restricted to a public https URL or a short search
 * query screened for identifiers. Request bodies are strict (no extra fields),
 * and nothing from a patient record may be forwarded here.
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { logger } from "../lib/logger";
import {
  NonPhiInputError,
  isFirecrawlConfigured,
  scrapePublicPage,
  searchPublicWeb,
} from "../lib/firecrawl-client";

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as { role?: string } | undefined;
  if (user?.role !== "admin") {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }
  next();
}

function requireConfigured(_req: Request, res: Response, next: NextFunction) {
  if (!isFirecrawlConfigured()) {
    return res.status(503).json({ success: false, error: "Web research is not configured" });
  }
  next();
}

const scrapeSchema = z.object({ url: z.string().min(1).max(2048) }).strict();
const searchSchema = z
  .object({ query: z.string().min(1).max(200), limit: z.number().int().min(1).max(10).default(5) })
  .strict();

function handleError(res: Response, err: unknown, op: string) {
  if (err instanceof NonPhiInputError) {
    return res.status(400).json({ success: false, error: err.message });
  }
  // Never log request inputs; the operation name is enough for triage.
  logger.error({ op, errName: err instanceof Error ? err.name : "unknown" }, "firecrawl request failed");
  return res.status(502).json({ success: false, error: "Upstream web research request failed" });
}

router.post("/scrape", requireAdmin, requireConfigured, async (req: Request, res: Response) => {
  const parsed = scrapeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: "Body must be { url }" });
  try {
    const data = await scrapePublicPage(parsed.data.url);
    res.json({ success: true, data });
  } catch (err) {
    handleError(res, err, "scrape");
  }
});

router.post("/search", requireAdmin, requireConfigured, async (req: Request, res: Response) => {
  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: "Body must be { query, limit? }" });
  try {
    const results = await searchPublicWeb(parsed.data.query, parsed.data.limit);
    res.json({ success: true, data: results });
  } catch (err) {
    handleError(res, err, "search");
  }
});

export default router;
