import { Router, Request, Response } from "express";
import { z } from "zod";
import * as onboardingAssistant from "./services/ai-onboarding-assistant";
import { requireRole } from "./rbac";

const router = Router();

function getRequestInfo(req: Request): { userId: string; ipAddress: string } {
  const user = (req as any).user;
  return {
    userId: user?.id || "anonymous",
    ipAddress: req.ip || req.socket.remoteAddress || "unknown",
  };
}

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  context: z.object({
    currentRoute: z.string().optional(),
    currentFeature: z.string().optional(),
    recentActivity: z.array(z.string()).optional(),
    userRole: z.enum(["admin", "data_steward", "care_team", "patient"]).optional(),
  }).optional(),
});

router.post("/chat",
  requireRole("admin", "provider"),
  async (req: Request, res: Response) => {
    try {
      const validation = chatSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: "Validation failed", details: validation.error.errors });
      }

      const { userId, ipAddress } = getRequestInfo(req);
      const result = await onboardingAssistant.chat(
        userId,
        validation.data.message,
        validation.data.context,
        ipAddress
      );

      res.json({
        success: true,
        ...result,
        compliance: {
          noCdsPolicy: "ENFORCED",
          identifiersHashed: true,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/features",
  requireRole("admin", "provider"),
  async (req: Request, res: Response) => {
    try {
      const role = req.query.role as onboardingAssistant.UserRole | undefined;
      const features = onboardingAssistant.getFeatureGuides(role);
      res.json({ success: true, features, total: features.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/features/:id",
  requireRole("admin", "provider"),
  async (req: Request, res: Response) => {
    try {
      const feature = onboardingAssistant.getFeatureGuide(req.params.id);
      if (!feature) {
        return res.status(404).json({ error: "Feature guide not found" });
      }
      res.json({ success: true, feature });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post("/features/:id/complete",
  requireRole("admin", "provider"),
  async (req: Request, res: Response) => {
    try {
      const { userId, ipAddress } = getRequestInfo(req);
      const success = await onboardingAssistant.markFeatureComplete(
        userId,
        req.params.id,
        ipAddress
      );
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/tutorials",
  requireRole("admin", "provider"),
  async (req: Request, res: Response) => {
    try {
      const role = req.query.role as onboardingAssistant.UserRole | undefined;
      const tutorials = onboardingAssistant.getTutorials(role);
      res.json({ success: true, tutorials, total: tutorials.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/tutorials/:id",
  requireRole("admin", "provider"),
  async (req: Request, res: Response) => {
    try {
      const tutorial = onboardingAssistant.getTutorial(req.params.id);
      if (!tutorial) {
        return res.status(404).json({ error: "Tutorial not found" });
      }
      res.json({ success: true, tutorial });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post("/tutorials/:id/complete",
  requireRole("admin", "provider"),
  async (req: Request, res: Response) => {
    try {
      const { userId, ipAddress } = getRequestInfo(req);
      const success = await onboardingAssistant.markTutorialComplete(
        userId,
        req.params.id,
        ipAddress
      );
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/tips",
  requireRole("admin", "provider"),
  async (req: Request, res: Response) => {
    try {
      const route = req.query.route as string || "/";
      const role = (req.query.role as onboardingAssistant.UserRole) || "admin";
      const tips = onboardingAssistant.getContextualTips(route, role);
      res.json({ success: true, tips, total: tips.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.post("/tips/:id/dismiss",
  requireRole("admin", "provider"),
  async (req: Request, res: Response) => {
    try {
      const { userId, ipAddress } = getRequestInfo(req);
      const success = await onboardingAssistant.dismissTip(
        userId,
        req.params.id,
        ipAddress
      );
      res.json({ success });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/progress",
  requireRole("admin", "provider"),
  async (req: Request, res: Response) => {
    try {
      const { userId } = getRequestInfo(req);
      const progress = onboardingAssistant.getUserProgress(userId);
      res.json({ success: true, progress: progress || null });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get("/stats",
  requireRole("admin"),
  async (req: Request, res: Response) => {
    try {
      const stats = onboardingAssistant.getOnboardingStats();
      res.json({ success: true, stats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
