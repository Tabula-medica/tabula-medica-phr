import type { Express } from "express";
import { requireAuth } from "../middleware/require-auth";
import { getUserId, auditLog } from "./_helpers";
import { createPayerReauthorization, PayerReauthError } from "../payer-reauthorization";

export function registerPayerReauthorizationRoutes(app: Express) {
  const service = createPayerReauthorization();
  for (const operation of ["start", "complete"] as const) {
    app.post(`/api/fasten/reauthorize/${operation}`, requireAuth, async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      try {
        const { sourceType, code, state, platform } = req.body ?? {};
        const result = operation === "start"
          ? await service.start(userId, sourceType, platform)
          : await service.complete(userId, sourceType, code, state);
        if (operation === "complete") {
          await auditLog(req, "payer_token_reauthorized", "data_source", sourceType);
        }
        return res.json(result);
      } catch (error) {
        return res.status(error instanceof PayerReauthError ? error.status : 503).json({
          error: error instanceof PayerReauthError
            ? error.message
            : "Reconnecting is temporarily unavailable. Please try again later.",
        });
      }
    });
  }
}
