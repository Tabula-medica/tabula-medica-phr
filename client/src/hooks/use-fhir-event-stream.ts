import { useState, useEffect, useCallback, useRef } from "react";
import type { FhirEvent, FhirStreamMessage, FhirEventType } from "../../../shared/fhir-event-types";

interface UseFhirEventStreamOptions {
  autoConnect?: boolean;
  maxEvents?: number;
  channels?: FhirEventType[];
  onEvent?: (event: FhirEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

interface FhirEventStreamState {
  isConnected: boolean;
  isConnecting: boolean;
  events: FhirEvent[];
  error: string | null;
  subscribedChannels: FhirEventType[];
}

export function useFhirEventStream(options: UseFhirEventStreamOptions = {}) {
  const {
    autoConnect = true,
    maxEvents = 100,
    channels = [],
    onEvent,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [state, setState] = useState<FhirEventStreamState>({
    isConnected: false,
    isConnecting: false,
    events: [],
    error: null,
    subscribedChannels: [],
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws/fhir-events`;
  }, []);

  const addEvent = useCallback((event: FhirEvent) => {
    setState((prev) => ({
      ...prev,
      events: [...prev.events.slice(-(maxEvents - 1)), event],
    }));
    onEvent?.(event);
  }, [maxEvents, onEvent]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[FHIR-WS] Connected to event stream");
        setState((prev) => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null,
        }));
        reconnectAttempts.current = 0;
        onConnect?.();

        if (channels.length > 0) {
          ws.send(JSON.stringify({
            type: "subscribe",
            payload: { channels },
            timestamp: new Date().toISOString(),
          }));
        }
      };

      ws.onmessage = (messageEvent) => {
        try {
          const message: FhirStreamMessage = JSON.parse(messageEvent.data);

          switch (message.type) {
            case "event":
              if (Array.isArray(message.payload)) {
                (message.payload as FhirEvent[]).forEach(addEvent);
              } else if (message.payload && "id" in message.payload) {
                addEvent(message.payload as FhirEvent);
              }
              break;

            case "subscribed":
              if (message.payload && "channels" in message.payload) {
                setState((prev) => ({
                  ...prev,
                  subscribedChannels: (message.payload as { channels: FhirEventType[] }).channels,
                }));
              }
              break;

            case "heartbeat":
              break;

            case "error":
              if (message.payload && "message" in message.payload) {
                console.error("[FHIR-WS] Server error:", (message.payload as { message: string }).message);
              }
              break;
          }
        } catch (error) {
          console.error("[FHIR-WS] Error parsing message:", error);
        }
      };

      ws.onclose = () => {
        console.log("[FHIR-WS] Disconnected from event stream");
        setState((prev) => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
        }));
        wsRef.current = null;
        onDisconnect?.();

        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          console.log(`[FHIR-WS] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = (error) => {
        console.error("[FHIR-WS] WebSocket error:", error);
        setState((prev) => ({
          ...prev,
          error: "Connection error",
          isConnecting: false,
        }));
        onError?.(error);
      };
    } catch (error) {
      console.error("[FHIR-WS] Failed to create WebSocket:", error);
      setState((prev) => ({
        ...prev,
        error: "Failed to connect",
        isConnecting: false,
      }));
    }
  }, [getWebSocketUrl, channels, addEvent, onConnect, onDisconnect, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    reconnectAttempts.current = maxReconnectAttempts;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
    }));
  }, []);

  const subscribe = useCallback((newChannels: FhirEventType[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "subscribe",
        payload: { channels: newChannels },
        timestamp: new Date().toISOString(),
      }));
    }
  }, []);

  const unsubscribe = useCallback((channelsToRemove: FhirEventType[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "unsubscribe",
        payload: { channels: channelsToRemove },
        timestamp: new Date().toISOString(),
      }));
    }
  }, []);

  const clearEvents = useCallback(() => {
    setState((prev) => ({ ...prev, events: [] }));
  }, []);

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    clearEvents,
  };
}
