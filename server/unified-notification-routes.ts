import { Router, Request, Response } from "express";
import { unifiedNotificationService, NotificationCategory } from "./services/unified-notification-service";

const router = Router();

function getUserId(req: Request): string {
  return (req as any).user?.id || "current-user";
}

router.get("/", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const category = req.query.category as NotificationCategory | undefined;
    const unreadOnly = req.query.unreadOnly === "true";
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = unifiedNotificationService.getNotifications(userId, {
      category,
      unreadOnly,
      limit,
      offset,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[UnifiedNotification] Error fetching notifications:", error);
    res.status(500).json({ success: false, error: "Failed to fetch notifications" });
  }
});

router.get("/stats", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const stats = unifiedNotificationService.getNotificationStats(userId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error("[UnifiedNotification] Error fetching stats:", error);
    res.status(500).json({ success: false, error: "Failed to fetch notification stats" });
  }
});

router.get("/grouped", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const grouped = unifiedNotificationService.getGroupedNotifications(userId);

    res.json({
      success: true,
      grouped,
    });
  } catch (error) {
    console.error("[UnifiedNotification] Error fetching grouped notifications:", error);
    res.status(500).json({ success: false, error: "Failed to fetch grouped notifications" });
  }
});

router.post("/:id/read", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const success = unifiedNotificationService.markAsRead(userId, id);

    res.json({ success });
  } catch (error) {
    console.error("[UnifiedNotification] Error marking notification as read:", error);
    res.status(500).json({ success: false, error: "Failed to mark notification as read" });
  }
});

router.post("/read-all", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const category = req.body.category as NotificationCategory | undefined;

    const count = unifiedNotificationService.markAllAsRead(userId, category);

    res.json({
      success: true,
      markedCount: count,
    });
  } catch (error) {
    console.error("[UnifiedNotification] Error marking all as read:", error);
    res.status(500).json({ success: false, error: "Failed to mark all as read" });
  }
});

router.post("/:id/dismiss", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const success = unifiedNotificationService.dismissNotification(userId, id);

    res.json({ success });
  } catch (error) {
    console.error("[UnifiedNotification] Error dismissing notification:", error);
    res.status(500).json({ success: false, error: "Failed to dismiss notification" });
  }
});

router.post("/dismiss-category/:category", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const category = req.params.category as NotificationCategory;

    const count = unifiedNotificationService.dismissAllByCategory(userId, category);

    res.json({
      success: true,
      dismissedCount: count,
    });
  } catch (error) {
    console.error("[UnifiedNotification] Error dismissing category:", error);
    res.status(500).json({ success: false, error: "Failed to dismiss category" });
  }
});

router.get("/preferences", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const preferences = unifiedNotificationService.getPreferences(userId);

    res.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error("[UnifiedNotification] Error fetching preferences:", error);
    res.status(500).json({ success: false, error: "Failed to fetch preferences" });
  }
});

router.put("/preferences", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const updates = req.body;

    const preferences = unifiedNotificationService.updatePreferences(userId, updates);

    res.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error("[UnifiedNotification] Error updating preferences:", error);
    res.status(500).json({ success: false, error: "Failed to update preferences" });
  }
});

router.post("/test", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    const notification = unifiedNotificationService.sendTestNotification(userId);

    res.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error("[UnifiedNotification] Error sending test notification:", error);
    res.status(500).json({ success: false, error: "Failed to send test notification" });
  }
});

router.post("/initialize-sample", (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    unifiedNotificationService.initializeSampleData(userId);

    res.json({
      success: true,
      message: "Sample notifications initialized",
    });
  } catch (error) {
    console.error("[UnifiedNotification] Error initializing sample data:", error);
    res.status(500).json({ success: false, error: "Failed to initialize sample data" });
  }
});

export default router;
console.log("[Routes] Unified Notification routes registered at /api/unified-notifications/*");
