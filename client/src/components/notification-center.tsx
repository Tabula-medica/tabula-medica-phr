import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, AlertTriangle, AlertCircle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface InAppNotification {
  id: string;
  userId: string;
  alertId?: string;
  type: "alert" | "info" | "warning" | "success";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  readAt?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

interface NotificationsResponse {
  success: boolean;
  notifications: InAppNotification[];
  unreadCount: number;
}

function getNotificationIcon(type: string, severity?: string) {
  if (severity === "critical" || severity === "high") {
    return <AlertCircle className="h-4 w-4 text-destructive" />;
  }
  if (type === "alert" || type === "warning") {
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  }
  if (type === "success") {
    return <Check className="h-4 w-4 text-green-500" />;
  }
  return <Info className="h-4 w-4 text-blue-500" />;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ["/api/alerting/notifications"],
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest(`/api/alerting/notifications/${notificationId}/read`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerting/notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/alerting/notifications/read-all", {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/alerting/notifications"] });
    },
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-notification-center"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              data-testid="button-mark-all-read"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 hover-elevate cursor-pointer",
                    !notification.read && "bg-muted/50"
                  )}
                  onClick={() => {
                    if (!notification.read) {
                      markReadMutation.mutate(notification.id);
                    }
                    if (notification.actionUrl) {
                      window.location.href = notification.actionUrl;
                    }
                  }}
                  data-testid={`notification-item-${notification.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(
                        notification.type,
                        notification.metadata?.severity as string
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            className="w-full"
            size="sm"
            onClick={() => {
              setOpen(false);
              window.location.href = "/alerts";
            }}
            data-testid="button-view-all-alerts"
          >
            View all alerts
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
