import { Router, Request, Response } from "express";
import {
  configurableSessionTimeout,
  securePushNotifications,
  biometricAuth,
} from "./security/mobile-security";
import { logPhiAccess } from "./security/hipaa-audit";
import { requireUser } from "./middleware/require-user";

const router = Router();

router.use(requireUser);

router.get("/session-timeout/preferences", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const preferences = configurableSessionTimeout.getPreferences(userId);
    const ranges = configurableSessionTimeout.getTimeoutRanges();

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "SecuritySettings",
      resourceId: userId,
      details: "Viewed session timeout preferences",
    });

    res.json({
      preferences,
      allowedRanges: ranges,
    });
  } catch (error) {
    console.error("[MobileSecurity] Error getting session preferences:", error);
    res.status(500).json({ error: "Failed to get session preferences" });
  }
});

router.put("/session-timeout/preferences", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      idleTimeoutMinutes,
      absoluteTimeoutHours,
      autoLockEnabled,
      autoLockDelaySeconds,
      requireBiometricOnResume,
      extendOnActivity,
      warningBeforeTimeoutSeconds,
    } = req.body;

    const updated = configurableSessionTimeout.updatePreferences(userId, {
      idleTimeoutMinutes,
      absoluteTimeoutHours,
      autoLockEnabled,
      autoLockDelaySeconds,
      requireBiometricOnResume,
      extendOnActivity,
      warningBeforeTimeoutSeconds,
    });

    res.json({
      success: true,
      preferences: updated,
    });
  } catch (error) {
    console.error("[MobileSecurity] Error updating session preferences:", error);
    res.status(500).json({ error: "Failed to update session preferences" });
  }
});

router.post("/session-timeout/reset", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const defaults = configurableSessionTimeout.resetToDefaults(userId);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "SecuritySettings",
      resourceId: userId,
      details: "Reset session timeout preferences to defaults",
    });

    res.json({
      success: true,
      preferences: defaults,
    });
  } catch (error) {
    console.error("[MobileSecurity] Error resetting session preferences:", error);
    res.status(500).json({ error: "Failed to reset session preferences" });
  }
});

router.get("/notifications", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const unreadOnly = req.query.unreadOnly === "true";
    const limit = parseInt(req.query.limit as string) || 50;

    const notifications = securePushNotifications.getUserNotifications(userId, {
      unreadOnly,
      limit,
    });

    const unreadCount = securePushNotifications.getUnreadCount(userId);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "Notification",
      resourceId: userId,
      details: `Retrieved ${notifications.length} notifications (unreadOnly: ${unreadOnly})`,
    });

    res.json({
      notifications,
      unreadCount,
      total: notifications.length,
    });
  } catch (error) {
    console.error("[MobileSecurity] Error getting notifications:", error);
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

router.get("/notifications/:notificationId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { notificationId } = req.params;

    const notification = securePushNotifications.getFullNotificationContent(
      userId,
      notificationId
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ notification });
  } catch (error) {
    console.error("[MobileSecurity] Error getting notification:", error);
    res.status(500).json({ error: "Failed to get notification" });
  }
});

router.post("/notifications/test", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { type, title, body, priority } = req.body;

    const notification = securePushNotifications.createSecureNotification({
      userId,
      type: type || "system",
      title: title || "Test Notification",
      body: body || "This is a test notification to verify PHI masking.",
      priority: priority || "normal",
    });

    const pushPayload = securePushNotifications.getPushPayload(notification);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "Notification",
      resourceId: notification.id,
      details: "Created test notification for PHI masking verification",
    });

    res.json({
      success: true,
      notification: {
        id: notification.id,
        originalTitle: notification.title,
        originalBody: notification.body,
        maskedTitle: notification.phiMaskedTitle,
        maskedBody: notification.phiMaskedBody,
      },
      pushPayload,
      message: "Test notification created. Push payload shows PHI-masked content.",
    });
  } catch (error) {
    console.error("[MobileSecurity] Error creating test notification:", error);
    res.status(500).json({ error: "Failed to create test notification" });
  }
});

router.post("/notifications/:notificationId/delivered", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { notificationId } = req.params;

    const success = securePushNotifications.markAsDelivered(userId, notificationId);

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "Notification",
      resourceId: notificationId,
      details: "Marked notification as delivered",
    });

    res.json({ success });
  } catch (error) {
    console.error("[MobileSecurity] Error marking notification delivered:", error);
    res.status(500).json({ error: "Failed to mark notification delivered" });
  }
});

router.delete("/notifications", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    securePushNotifications.clearNotifications(userId);

    logPhiAccess({
      userId,
      action: "delete",
      resourceType: "Notification",
      resourceId: userId,
      details: "Cleared all notifications",
    });

    res.json({ success: true });
  } catch (error) {
    console.error("[MobileSecurity] Error clearing notifications:", error);
    res.status(500).json({ error: "Failed to clear notifications" });
  }
});

router.get("/biometric/status", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const status = biometricAuth.getBiometricStatus(userId);
    const credentials = biometricAuth.getUserCredentials(userId);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "BiometricCredential",
      resourceId: userId,
      details: `Viewed biometric status (${credentials.length} credentials)`,
    });

    res.json({
      ...status,
      credentials,
    });
  } catch (error) {
    console.error("[MobileSecurity] Error getting biometric status:", error);
    res.status(500).json({ error: "Failed to get biometric status" });
  }
});

router.post("/biometric/register/options", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub;
    const username = (req as any).user?.claims?.email || "user";
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const options = biometricAuth.generateRegistrationOptions(userId, username);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "BiometricCredential",
      resourceId: options.challenge,
      details: "Generated biometric registration options",
    });

    res.json({ options });
  } catch (error) {
    console.error("[MobileSecurity] Error generating registration options:", error);
    res.status(500).json({ error: "Failed to generate registration options" });
  }
});

router.post("/biometric/register/verify", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { challenge, credentialId, publicKey, deviceName, deviceType } = req.body;

    if (!challenge || !credentialId || !publicKey) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await biometricAuth.verifyRegistration(
      userId,
      challenge,
      credentialId,
      publicKey,
      deviceName || "Unknown Device",
      deviceType || "unknown"
    );

    if (!result.success) {
      logPhiAccess({
        userId,
        action: "write",
        resourceType: "BiometricCredential",
        resourceId: credentialId,
        details: `Biometric registration failed: ${result.error}`,
      });
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      credentialId: result.credentialId,
    });
  } catch (error) {
    console.error("[MobileSecurity] Error verifying registration:", error);
    res.status(500).json({ error: "Failed to verify registration" });
  }
});

router.post("/biometric/authenticate/options", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const options = biometricAuth.generateAuthenticationOptions(userId);

    if (!options) {
      logPhiAccess({
        userId,
        action: "read",
        resourceType: "BiometricCredential",
        resourceId: userId,
        details: "Biometric auth options requested but no credentials registered",
      });
      return res.status(400).json({
        error: "No biometric credentials registered",
        message: "Please register a biometric credential first",
      });
    }

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "BiometricCredential",
      resourceId: options.challenge,
      details: "Generated biometric authentication options",
    });

    res.json({ options });
  } catch (error) {
    console.error("[MobileSecurity] Error generating authentication options:", error);
    res.status(500).json({ error: "Failed to generate authentication options" });
  }
});

router.post("/biometric/authenticate/verify", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { challenge, credentialId, signature, counter } = req.body;

    if (!challenge || !credentialId || !signature || counter === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const result = await biometricAuth.verifyAuthentication(
      userId,
      challenge,
      credentialId,
      signature,
      counter
    );

    if (!result.success) {
      logPhiAccess({
        userId,
        action: "read",
        resourceType: "BiometricCredential",
        resourceId: credentialId,
        details: `Biometric authentication failed: ${result.error}`,
      });
      return res.status(401).json({ error: result.error });
    }

    res.json({
      success: true,
      message: "Biometric authentication successful",
    });
  } catch (error) {
    console.error("[MobileSecurity] Error verifying authentication:", error);
    res.status(500).json({ error: "Failed to verify authentication" });
  }
});

router.put("/biometric/credentials/:credentialId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { credentialId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: "enabled must be a boolean" });
    }

    const success = biometricAuth.toggleCredential(userId, credentialId, enabled);

    if (!success) {
      return res.status(404).json({ error: "Credential not found" });
    }

    logPhiAccess({
      userId,
      action: "write",
      resourceType: "BiometricCredential",
      resourceId: credentialId,
      details: `${enabled ? "Enabled" : "Disabled"} biometric credential`,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("[MobileSecurity] Error toggling credential:", error);
    res.status(500).json({ error: "Failed to toggle credential" });
  }
});

router.delete("/biometric/credentials/:credentialId", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { credentialId } = req.params;

    const success = biometricAuth.removeCredential(userId, credentialId);

    if (!success) {
      return res.status(404).json({ error: "Credential not found" });
    }

    logPhiAccess({
      userId,
      action: "delete",
      resourceType: "BiometricCredential",
      resourceId: credentialId,
      details: "Removed biometric credential",
    });

    res.json({ success: true });
  } catch (error) {
    console.error("[MobileSecurity] Error removing credential:", error);
    res.status(500).json({ error: "Failed to remove credential" });
  }
});

router.get("/security-status", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const sessionPrefs = configurableSessionTimeout.getPreferences(userId);
    const biometricStatus = biometricAuth.getBiometricStatus(userId);
    const unreadNotifications = securePushNotifications.getUnreadCount(userId);

    logPhiAccess({
      userId,
      action: "read",
      resourceType: "SecuritySettings",
      resourceId: userId,
      details: "Viewed mobile security status summary",
    });

    res.json({
      atsEnabled: true,
      httpsEnforced: process.env.NODE_ENV === "production",
      sessionTimeout: {
        idleMinutes: sessionPrefs.idleTimeoutMinutes,
        absoluteHours: sessionPrefs.absoluteTimeoutHours,
        autoLockEnabled: sessionPrefs.autoLockEnabled,
      },
      biometric: biometricStatus,
      notifications: {
        unreadCount: unreadNotifications,
        phiMaskingEnabled: true,
      },
      hipaaCompliant: true,
    });
  } catch (error) {
    console.error("[MobileSecurity] Error getting security status:", error);
    res.status(500).json({ error: "Failed to get security status" });
  }
});

export default router;
