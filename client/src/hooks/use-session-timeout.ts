import { useState, useEffect, useCallback, useRef } from "react";

interface SessionTimeoutState {
  isWarningVisible: boolean;
  secondsRemaining: number;
  isExpired: boolean;
  resetTimer: () => void;
  dismissWarning: () => void;
}

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const WARNING_BEFORE_MS = 2 * 60 * 1000;
const CHECK_INTERVAL_MS = 1000;

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

export function useSessionTimeout(isAuthenticated: boolean): SessionTimeoutState {
  const [isWarningVisible, setIsWarningVisible] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningDismissedRef = useRef(false);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIsWarningVisible(false);
    setIsExpired(false);
    warningDismissedRef.current = false;
  }, []);

  const dismissWarning = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIsWarningVisible(false);
    warningDismissedRef.current = true;

    fetch("/api/session/heartbeat", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});
  }, []);

  const handleActivity = useCallback(() => {
    const now = Date.now();
    const idleTime = now - lastActivityRef.current;

    if (idleTime < IDLE_TIMEOUT_MS - WARNING_BEFORE_MS) {
      lastActivityRef.current = now;
      if (isWarningVisible) {
        setIsWarningVisible(false);
      }
      warningDismissedRef.current = false;
    }
  }, [isWarningVisible]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    lastActivityRef.current = Date.now();

    const throttledActivity = (() => {
      let lastCall = 0;
      return () => {
        const now = Date.now();
        if (now - lastCall > 5000) {
          lastCall = now;
          handleActivity();
        }
      };
    })();

    ACTIVITY_EVENTS.forEach((event) => {
      document.addEventListener(event, throttledActivity, { passive: true });
    });

    checkIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastActivityRef.current;
      const remaining = IDLE_TIMEOUT_MS - idleTime;

      if (remaining <= 0) {
        setIsExpired(true);
        setIsWarningVisible(false);
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
      } else if (remaining <= WARNING_BEFORE_MS && !warningDismissedRef.current) {
        setIsWarningVisible(true);
        setSecondsRemaining(Math.ceil(remaining / 1000));
      } else {
        setIsWarningVisible(false);
        setSecondsRemaining(0);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        document.removeEventListener(event, throttledActivity);
      });
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, handleActivity]);

  useEffect(() => {
    if (isExpired && isAuthenticated) {
      window.location.href = window.location.origin;
    }
  }, [isExpired, isAuthenticated]);

  return {
    isWarningVisible,
    secondsRemaining,
    isExpired,
    resetTimer,
    dismissWarning,
  };
}
