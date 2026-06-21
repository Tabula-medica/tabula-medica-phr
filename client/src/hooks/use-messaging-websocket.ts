import { useEffect, useRef, useState, useCallback } from "react";

export interface MessageEvent {
  type: "new_message" | "message_read" | "typing" | "stopped_typing" | "message_deleted" | "message_edited" | "connected" | "subscribed" | "notification";
  conversationId?: string;
  message?: any;
  senderId?: string;
  senderName?: string;
  messageId?: string;
  title?: string;
  body?: string;
  timestamp: string;
}

interface UseMessagingWebSocketOptions {
  userId: string;
  userName: string;
  onMessage?: (event: MessageEvent) => void;
  onNotification?: (event: MessageEvent) => void;
  onTyping?: (conversationId: string, userId: string, userName: string) => void;
  onStoppedTyping?: (conversationId: string, userId: string) => void;
}

export function useMessagingWebSocket({
  userId,
  userName,
  onMessage,
  onNotification,
  onTyping,
  onStoppedTyping,
}: UseMessagingWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [subscribedConversations, setSubscribedConversations] = useState<Set<string>>(new Set());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/messaging?userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[MessagingWS] Connected");
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        subscribedConversations.forEach(convId => {
          ws.send(JSON.stringify({ type: "subscribe", conversationId: convId }));
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as MessageEvent;
          
          switch (data.type) {
            case "new_message":
              onMessage?.(data);
              break;
            case "notification":
              onNotification?.(data);
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification(data.title || "New Message", {
                  body: data.body,
                  icon: "/favicon.ico",
                });
              }
              break;
            case "typing":
              if (data.conversationId && data.senderId && data.senderName) {
                onTyping?.(data.conversationId, data.senderId, data.senderName);
              }
              break;
            case "stopped_typing":
              if (data.conversationId && data.senderId) {
                onStoppedTyping?.(data.conversationId, data.senderId);
              }
              break;
            case "message_edited":
            case "message_deleted":
            case "message_read":
              onMessage?.(data);
              break;
            default:
              console.log("[MessagingWS] Event:", data.type);
          }
        } catch (error) {
          console.error("[MessagingWS] Parse error:", error);
        }
      };

      ws.onclose = () => {
        console.log("[MessagingWS] Disconnected");
        setIsConnected(false);
        wsRef.current = null;

        if (reconnectAttemptsRef.current < 5) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error("[MessagingWS] Error:", error);
      };
    } catch (error) {
      console.error("[MessagingWS] Connection error:", error);
    }
  }, [userId, userName, onMessage, onNotification, onTyping, onStoppedTyping, subscribedConversations]);

  useEffect(() => {
    if (userId) {
      connect();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect, userId]);

  const subscribeToConversation = useCallback((conversationId: string) => {
    setSubscribedConversations(prev => new Set(prev).add(conversationId));
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", conversationId }));
    }
  }, []);

  const unsubscribeFromConversation = useCallback((conversationId: string) => {
    setSubscribedConversations(prev => {
      const next = new Set(prev);
      next.delete(conversationId);
      return next;
    });
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "unsubscribe", conversationId }));
    }
  }, []);

  const sendTyping = useCallback((conversationId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", conversationId }));
    }
  }, []);

  const sendStoppedTyping = useCallback((conversationId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stopped_typing", conversationId }));
    }
  }, []);

  const markAsRead = useCallback((conversationId: string, messageId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "mark_read", conversationId, messageId }));
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }, []);

  return {
    isConnected,
    subscribeToConversation,
    unsubscribeFromConversation,
    sendTyping,
    sendStoppedTyping,
    markAsRead,
    requestNotificationPermission,
  };
}
