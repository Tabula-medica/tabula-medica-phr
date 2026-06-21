import { Router, Request, Response } from "express";
import {
  createDeviceSession,
  getUserDeviceSessions,
  revokeSession,
  revokeAllUserSessions,
  revokeAllExceptCurrent,
  refreshTokens_rotate,
  validateAccessToken,
  getSessionStats,
} from "../security/device-session-service";
import { z } from "zod";

const router = Router();

const createSessionSchema = z.object({
  deviceName: z.string().optional(),
});

const revokeSessionSchema = z.object({
  sessionId: z.string().uuid(),
  reason: z.string().optional(),
});

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const user = req.user as { claims?: { sub?: string } } | undefined;
    const userId = user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const { deviceName } = createSessionSchema.parse(req.body);
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"] || "Unknown";

    const { session, tokens } = await createDeviceSession(
      userId,
      ipAddress,
      userAgent,
      deviceName
    );

    const sessionWithoutSensitive = {
      ...session,
      ipAddressHash: undefined,
    };

    res.json({
      success: true,
      data: {
        session: sessionWithoutSensitive,
        tokens,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        details: error.errors,
      });
    }
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/sessions", async (req: Request, res: Response) => {
  try {
    const user = req.user as { claims?: { sub?: string } } | undefined;
    const userId = user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const sessions = await getUserDeviceSessions(userId);

    const currentSessionId = req.headers["x-session-id"] as string | undefined;

    const sessionsWithCurrent = sessions.map(s => ({
      ...s,
      ipAddressHash: undefined,
      isCurrent: s.id === currentSessionId,
    }));

    res.json({
      success: true,
      data: {
        sessions: sessionsWithCurrent,
        count: sessionsWithCurrent.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.delete("/sessions/:sessionId", async (req: Request, res: Response) => {
  try {
    const user = req.user as { claims?: { sub?: string } } | undefined;
    const userId = user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const { sessionId } = req.params;
    const { reason } = req.body as { reason?: string };

    const success = await revokeSession(sessionId, userId, reason || "user_logout");

    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Session not found or already revoked",
      });
    }

    res.json({
      success: true,
      message: "Session revoked successfully",
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/sessions/logout-all", async (req: Request, res: Response) => {
  try {
    const user = req.user as { claims?: { sub?: string } } | undefined;
    const userId = user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const { reason } = req.body as { reason?: string };
    const revokedCount = await revokeAllUserSessions(userId, reason || "logout_all_devices");

    res.json({
      success: true,
      message: `Logged out from ${revokedCount} device(s)`,
      data: {
        revokedCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/sessions/logout-others", async (req: Request, res: Response) => {
  try {
    const user = req.user as { claims?: { sub?: string } } | undefined;
    const userId = user?.claims?.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const currentSessionId = req.headers["x-session-id"] as string;

    if (!currentSessionId) {
      return res.status(400).json({
        success: false,
        error: "Current session ID required in X-Session-ID header",
      });
    }

    const revokedCount = await revokeAllExceptCurrent(userId, currentSessionId);

    res.json({
      success: true,
      message: `Logged out from ${revokedCount} other device(s)`,
      data: {
        revokedCount,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: "Refresh token required",
      });
    }

    const ipAddress = getClientIp(req);
    const result = await refreshTokens_rotate(refreshToken, ipAddress);

    if (!result) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired refresh token",
      });
    }

    res.json({
      success: true,
      data: {
        tokens: result.tokens,
        session: {
          ...result.session,
          ipAddressHash: undefined,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/validate", async (req: Request, res: Response) => {
  try {
    const { accessToken } = req.body as { accessToken: string };

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: "Access token required",
      });
    }

    const result = await validateAccessToken(accessToken);

    if (!result) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired access token",
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const user = req.user as { claims?: { sub?: string }; role?: string } | undefined;
    
    if (user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        error: "Admin access required",
      });
    }

    const stats = getSessionStats();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export function registerDeviceSessionRoutes(app: any): void {
  app.use("/api/device-sessions", router);
  console.log("[Routes] Device Session Management routes registered at /api/device-sessions/*");
}

export default router;
