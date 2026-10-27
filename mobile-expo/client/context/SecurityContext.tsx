import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import {
  authenticateWithBiometrics,
  checkBiometricAvailability,
  checkInactivityTimeout,
  updateLastActivity,
  endSecureSession,
  wipeLocalPHI,
  getBiometricTypeName,
  INACTIVITY_TIMEOUT_MINUTES,
} from "@/lib/security";
import type { AuthenticationType } from "expo-local-authentication";
import { useAuthContext } from "@/context/AuthContext";

interface SecurityContextType {
  isUnlocked: boolean;
  isCheckingAuth: boolean;
  biometricAvailable: boolean;
  biometricTypeName: string;
  lastError: string | null;
  timeoutMinutes: number;
  unlock: () => Promise<boolean>;
  lock: () => Promise<void>;
  recordActivity: () => void;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export function SecurityProvider({ children }: { children: ReactNode }) {
  // The app ALWAYS starts unlocked. The biometric lock only protects an
  // already-authenticated session and is engaged on inactivity/background
  // timeout (see handleAppStateChange). It must never gate the unauthenticated
  // surface — locking the login screen behind a device biometric prompt on
  // launch caused an "error displayed on launch" App Review rejection
  // (Guideline 2.1).
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricTypes, setBiometricTypes] = useState<AuthenticationType[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef(AppState.currentState);
  const { isAuthenticated } = useAuthContext();

  // Refs mirror the latest auth/biometric state so the once-registered
  // AppState listener and the inactivity timer always read current values
  // instead of a stale closure captured at mount.
  const isAuthenticatedRef = useRef(isAuthenticated);
  const biometricAvailableRef = useRef(false);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    initSecurity();

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      subscription.remove();
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
      }
    };
  }, []);

  // Clear any stale lock whenever the user is signed out, so a subsequent
  // login is never gated behind a leftover biometric lock.
  useEffect(() => {
    if (!isAuthenticated) {
      setIsUnlocked(true);
      setLastError(null);
    }
  }, [isAuthenticated]);

  const initSecurity = async () => {
    try {
      const { available, biometricTypes: types } = await checkBiometricAvailability();
      biometricAvailableRef.current = available;
      setBiometricAvailable(available);
      setBiometricTypes(types);
    } catch (error) {
      console.error("Security init error:", error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleAppStateChange = useCallback(async (nextState: AppStateStatus) => {
    if (Platform.OS === "web") return;

    if (appState.current === "active" && nextState.match(/inactive|background/)) {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    }

    if (nextState === "active" && appState.current.match(/inactive|background/)) {
      const timedOut = await checkInactivityTimeout();
      if (timedOut && biometricAvailableRef.current && isAuthenticatedRef.current) {
        await wipeLocalPHI();
        await endSecureSession();
        setIsUnlocked(false);
      }
    }

    appState.current = nextState;
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (Platform.OS === "web") return;

    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }

    inactivityTimer.current = setTimeout(async () => {
      // Only an authenticated session is worth locking; an idle timer that
      // fired on the unauthenticated (login) surface must not lock, or the
      // next login would be gated behind a stale biometric lock.
      if (!isAuthenticatedRef.current) return;
      await wipeLocalPHI();
      await endSecureSession();
      setIsUnlocked(false);
    }, INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);
  }, []);

  const recordActivity = useCallback(() => {
    updateLastActivity();
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const unlock = useCallback(async (): Promise<boolean> => {
    setLastError(null);

    if (Platform.OS === "web" || !biometricAvailable) {
      setIsUnlocked(true);
      return true;
    }

    const result = await authenticateWithBiometrics();

    if (result.success) {
      setIsUnlocked(true);
      recordActivity();
      return true;
    }

    // A user-initiated cancellation is not an error worth surfacing — the
    // gate stays visible with its Unlock button and passcode fallback.
    const err = result.error || "Authentication failed";
    setLastError(/cancel/i.test(err) ? null : err);
    return false;
  }, [biometricAvailable, recordActivity]);

  const lock = useCallback(async () => {
    await wipeLocalPHI();
    await endSecureSession();
    setIsUnlocked(false);
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
  }, []);

  const biometricTypeName = getBiometricTypeName(biometricTypes);

  return (
    <SecurityContext.Provider
      value={{
        isUnlocked,
        isCheckingAuth,
        biometricAvailable,
        biometricTypeName,
        lastError,
        timeoutMinutes: INACTIVITY_TIMEOUT_MINUTES,
        unlock,
        lock,
        recordActivity,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurityContext() {
  const context = useContext(SecurityContext);
  if (context === undefined) {
    throw new Error("useSecurityContext must be used within a SecurityProvider");
  }
  return context;
}
