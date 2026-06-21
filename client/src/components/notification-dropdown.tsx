import { useLocation } from "wouter";
import { useNotifications } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bell,
  MessageSquare,
  CheckCheck,
  User,
  Stethoscope,
  Users,
  Clock,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

const roleIcons: Record<string, typeof User> = {
  patient: User,
  provider: Stethoscope,
  nurse: Users,
  care_coordinator: Users,
  caregiver: Users,
  specialist: Stethoscope,
};

export function NotificationDropdown() {
  const { unreadCount, messages, isLoading, markAsRead, markAllAsRead, isMarkingAllRead } = useNotifications();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = async (threadId: string) => {
    setOpen(false);
    await markAsRead(threadId);
    setLocation(`/messages?thread=${threadId}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-testid="button-notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-4 min-w-4 p-0 flex items-center justify-center text-[10px] pointer-events-none"
              data-testid="badge-notification-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        align="end"
        data-testid="notification-dropdown"
      >
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm">Messages</h4>
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs"
              onClick={() => markAllAsRead()}
              disabled={isMarkingAllRead}
              data-testid="button-mark-all-read"
            >
              {isMarkingAllRead ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-1" />
              ) : (
                <CheckCheck className="h-3 w-3 mr-1" />
              )}
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No new messages</p>
              <p className="text-xs text-muted-foreground mt-1">
                You're all caught up!
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {messages.slice(0, 5).map((message) => {
                const RoleIcon = roleIcons[message.senderRole] || User;
                return (
                  <button 
                    key={message.id} 
                    onClick={() => handleNotificationClick(message.threadId)}
                    className="w-full text-left"
                  >
                    <div 
                      className={`p-3 hover-elevate cursor-pointer ${!message.isRead ? 'bg-primary/5' : ''}`}
                      data-testid={`notification-item-${message.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`rounded-full p-1.5 shrink-0 ${!message.isRead ? 'bg-primary/10' : 'bg-muted'}`}>
                          <RoleIcon className="h-3 w-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="font-medium text-sm truncate">
                              {message.senderName}
                            </span>
                            {!message.isRead && (
                              <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {message.subject}
                          </p>
                          <p className="text-xs text-muted-foreground/80 truncate mt-0.5">
                            {message.preview}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="h-2.5 w-2.5 text-muted-foreground/60" />
                            <span className="text-[10px] text-muted-foreground/60">
                              {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        <Separator />
        <div className="p-2">
          <Button 
            variant="ghost" 
            className="w-full justify-center text-sm h-8"
            onClick={() => { setOpen(false); setLocation("/messages"); }}
            data-testid="button-view-all-messages"
          >
            <ExternalLink className="h-3 w-3 mr-1.5" />
            View all messages
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function MobileNotificationDropdown() {
  const { unreadCount, messages, isLoading, markAsRead, markAllAsRead, isMarkingAllRead } = useNotifications();
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = async (threadId: string) => {
    setOpen(false);
    await markAsRead(threadId);
    setLocation(`/messages?thread=${threadId}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-testid="button-notifications-mobile"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-4 min-w-4 p-0 flex items-center justify-center text-[10px] pointer-events-none"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[calc(100vw-24px)] max-w-sm p-0" 
        align="end"
        data-testid="notification-dropdown-mobile"
      >
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <h4 className="font-semibold text-sm">Messages</h4>
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs"
              onClick={() => markAllAsRead()}
              disabled={isMarkingAllRead}
              data-testid="button-mark-all-read-mobile"
            >
              {isMarkingAllRead ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-1" />
              ) : (
                <CheckCheck className="h-3 w-3 mr-1" />
              )}
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="max-h-60">
          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <MessageSquare className="h-6 w-6 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No new messages</p>
            </div>
          ) : (
            <div className="divide-y">
              {messages.slice(0, 4).map((message) => {
                const RoleIcon = roleIcons[message.senderRole] || User;
                return (
                  <button 
                    key={message.id} 
                    onClick={() => handleNotificationClick(message.threadId)}
                    className="w-full text-left"
                  >
                    <div 
                      className={`p-3 hover-elevate cursor-pointer ${!message.isRead ? 'bg-primary/5' : ''}`}
                      data-testid={`notification-item-mobile-${message.id}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`rounded-full p-1.5 shrink-0 ${!message.isRead ? 'bg-primary/10' : 'bg-muted'}`}>
                          <RoleIcon className="h-3 w-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-sm truncate block">
                            {message.senderName}
                          </span>
                          <p className="text-xs text-muted-foreground truncate">
                            {message.preview}
                          </p>
                        </div>
                        {!message.isRead && (
                          <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        <Separator />
        <div className="p-2">
          <Button 
            variant="ghost" 
            className="w-full justify-center text-sm h-8"
            onClick={() => { setOpen(false); setLocation("/messages"); }}
            data-testid="button-view-all-messages-mobile"
          >
            View all messages
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
