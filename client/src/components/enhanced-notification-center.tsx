import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Bell,
  Check,
  CheckCheck,
  X,
  MessageSquare,
  AlertTriangle,
  Heart,
  Clock,
  Calendar,
  Pill,
  Users,
  Settings,
  Filter,
  Volume2,
  VolumeX,
  RefreshCw,
  ChevronRight,
  Inbox,
  FileText,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";

type NotificationCategory = "message" | "alert" | "health_update" | "reminder" | "appointment" | "medication" | "caregiver" | "system";
type NotificationPriority = "low" | "normal" | "high" | "urgent";

interface UnifiedNotification {
  id: string;
  userId: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  icon?: string;
  actionUrl?: string;
  actionLabel?: string;
  read: boolean;
  dismissed: boolean;
  createdAt: string;
  readAt?: string;
  metadata?: Record<string, unknown>;
}

interface NotificationStats {
  total: number;
  unread: number;
  byCategory: Record<NotificationCategory, { total: number; unread: number }>;
  byPriority: Record<NotificationPriority, number>;
}

const categoryIcons: Record<NotificationCategory, typeof Bell> = {
  message: MessageSquare,
  alert: AlertTriangle,
  health_update: Heart,
  reminder: Clock,
  appointment: Calendar,
  medication: Pill,
  caregiver: Users,
  system: Settings,
};

const categoryLabels: Record<NotificationCategory, string> = {
  message: "Messages",
  alert: "Alerts",
  health_update: "Health Updates",
  reminder: "Reminders",
  appointment: "Appointments",
  medication: "Medications",
  caregiver: "Caregiver",
  system: "System",
};

const priorityColors: Record<NotificationPriority, string> = {
  low: "text-muted-foreground",
  normal: "text-foreground",
  high: "text-amber-500",
  urgent: "text-destructive",
};

function getCategoryIcon(category: NotificationCategory) {
  const Icon = categoryIcons[category] || Bell;
  return Icon;
}

export function EnhancedNotificationCenter() {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"all" | NotificationCategory>("all");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: statsData } = useQuery<{ success: boolean; stats: NotificationStats }>({
    queryKey: ["/api/unified-notifications/stats"],
    refetchInterval: 30000,
  });

  const { data: notificationsData, isLoading, refetch } = useQuery<{
    success: boolean;
    notifications: UnifiedNotification[];
    total: number;
    unreadCount: number;
  }>({
    queryKey: ["/api/unified-notifications", activeCategory],
    refetchInterval: 30000,
  });

  const initializeSampleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/unified-notifications/initialize-sample");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified-notifications"] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("POST", `/api/unified-notifications/${notificationId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified-notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async (category?: NotificationCategory) => {
      return apiRequest("POST", "/api/unified-notifications/read-all", { category });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified-notifications"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      return apiRequest("POST", `/api/unified-notifications/${notificationId}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/unified-notifications"] });
    },
  });

  useEffect(() => {
    if (notificationsData?.notifications?.length === 0 && !isLoading) {
      initializeSampleMutation.mutate();
    }
  }, [notificationsData?.notifications?.length, isLoading]);

  const stats = statsData?.stats;
  const notifications = notificationsData?.notifications || [];
  const unreadCount = stats?.unread || 0;

  const filteredNotifications = activeCategory === "all"
    ? notifications
    : notifications.filter(n => n.category === activeCategory);

  const handleNotificationClick = (notification: UnifiedNotification) => {
    if (!notification.read) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.actionUrl) {
      setOpen(false);
      setLocation(notification.actionUrl);
    }
  };

  const handleDismiss = (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    dismissMutation.mutate(notificationId);
  };

  const getCategoryUnread = (category: NotificationCategory): number => {
    return stats?.byCategory?.[category]?.unread || 0;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          data-testid="button-enhanced-notification-center"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
              data-testid="badge-unread-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" data-testid="notification-popover">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute notifications" : "Unmute notifications"}
            >
              {soundEnabled ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => refetch()}
              title="Refresh notifications"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setOpen(false);
                setLocation("/settings/notifications");
              }}
              title="Notification settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="border-b">
          <ScrollArea className="w-full">
            <div className="flex gap-1 p-2">
              <Button
                variant={activeCategory === "all" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() => setActiveCategory("all")}
              >
                <Inbox className="h-3 w-3 mr-1" />
                All
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 min-w-4 text-[10px] px-1">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
              {(["message", "alert", "health_update", "appointment", "medication"] as NotificationCategory[]).map(cat => {
                const Icon = categoryIcons[cat];
                const catUnread = getCategoryUnread(cat);
                return (
                  <Button
                    key={cat}
                    variant={activeCategory === cat ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={() => setActiveCategory(cat)}
                  >
                    <Icon className="h-3 w-3 mr-1" />
                    {categoryLabels[cat].split(" ")[0]}
                    {catUnread > 0 && (
                      <Badge variant="destructive" className="ml-1 h-4 min-w-4 text-[10px] px-1">
                        {catUnread}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {unreadCount > 0 && (
          <div className="flex items-center justify-between px-3 py-2 bg-muted/30">
            <span className="text-xs text-muted-foreground">
              {activeCategory === "all" ? `${unreadCount} unread` : `${getCategoryUnread(activeCategory as NotificationCategory)} unread`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => markAllReadMutation.mutate(activeCategory === "all" ? undefined : activeCategory as NotificationCategory)}
              disabled={markAllReadMutation.isPending}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          </div>
        )}

        <ScrollArea className="h-80">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Bell className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1">
                {activeCategory === "all" ? "You're all caught up!" : `No ${categoryLabels[activeCategory as NotificationCategory].toLowerCase()}`}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredNotifications.map((notification) => {
                const Icon = getCategoryIcon(notification.category);
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-3 hover-elevate cursor-pointer relative group",
                      !notification.read && "bg-primary/5"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                    data-testid={`notification-item-${notification.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "rounded-full p-2 shrink-0",
                        notification.priority === "urgent" && "bg-destructive/10",
                        notification.priority === "high" && "bg-amber-500/10",
                        notification.priority === "normal" && "bg-primary/10",
                        notification.priority === "low" && "bg-muted"
                      )}>
                        <Icon className={cn(
                          "h-4 w-4",
                          priorityColors[notification.priority]
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-sm truncate flex-1">
                            {notification.title}
                          </span>
                          {!notification.read && (
                            <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          )}
                          {notification.priority === "urgent" && (
                            <Badge variant="destructive" className="text-[10px] h-4 px-1">
                              Urgent
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {categoryLabels[notification.category]}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={(e) => handleDismiss(e, notification.id)}
                        title="Dismiss"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    {notification.actionUrl && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                        <span>{notification.actionLabel || "View details"}</span>
                        <ChevronRight className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <Separator />
        <div className="p-2 flex gap-2">
          <Button
            variant="ghost"
            className="flex-1 justify-center text-sm h-8"
            onClick={() => {
              setOpen(false);
              setLocation("/notifications");
            }}
            data-testid="button-view-all-notifications"
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function NotificationToast({ 
  notification, 
  onDismiss 
}: { 
  notification: UnifiedNotification; 
  onDismiss: () => void;
}) {
  const [, setLocation] = useLocation();
  const Icon = getCategoryIcon(notification.category);

  return (
    <div className={cn(
      "flex items-start gap-3 p-4 bg-card border rounded-lg shadow-lg max-w-sm",
      notification.priority === "urgent" && "border-destructive"
    )}>
      <div className={cn(
        "rounded-full p-2 shrink-0",
        notification.priority === "urgent" && "bg-destructive/10",
        notification.priority === "high" && "bg-amber-500/10",
        notification.priority === "normal" && "bg-primary/10",
        notification.priority === "low" && "bg-muted"
      )}>
        <Icon className={cn("h-4 w-4", priorityColors[notification.priority])} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{notification.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notification.message}
        </p>
        {notification.actionUrl && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 mt-1 text-xs text-primary"
            onClick={() => {
              onDismiss();
              setLocation(notification.actionUrl!);
            }}
          >
            {notification.actionLabel || "View details"}
          </Button>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onDismiss}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
