import { useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

export interface MessageNotification {
  id: string;
  threadId: string;
  subject: string;
  senderName: string;
  senderRole: string;
  preview: string;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationState {
  unreadCount: number;
  messages: MessageNotification[];
  isLoading: boolean;
  markAsRead: (threadId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => void;
  isMarkingRead: boolean;
  isMarkingAllRead: boolean;
}

export function useNotifications(): NotificationState {
  const { data: unreadData, isLoading: loadingCount, refetch: refetchCount } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 30000,
  });

  const { data: recentMessages, isLoading: loadingMessages, refetch: refetchMessages } = useQuery<MessageNotification[]>({
    queryKey: ["/api/messages/notifications/recent"],
    refetchInterval: 30000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      await apiRequest("POST", `/api/messages/threads/${threadId}/read`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/notifications/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/messages/mark-all-read", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/notifications/recent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/threads"] });
    },
  });

  const markAsRead = useCallback(async (threadId: string) => {
    await markAsReadMutation.mutateAsync(threadId);
  }, [markAsReadMutation]);

  const markAllAsRead = useCallback(async () => {
    await markAllAsReadMutation.mutateAsync();
  }, [markAllAsReadMutation]);

  const refresh = useCallback(() => {
    refetchCount();
    refetchMessages();
  }, [refetchCount, refetchMessages]);

  return {
    unreadCount: unreadData?.unreadCount ?? 0,
    messages: recentMessages ?? [],
    isLoading: loadingCount || loadingMessages,
    markAsRead,
    markAllAsRead,
    refresh,
    isMarkingRead: markAsReadMutation.isPending,
    isMarkingAllRead: markAllAsReadMutation.isPending,
  };
}
