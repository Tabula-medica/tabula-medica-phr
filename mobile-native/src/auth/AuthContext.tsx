/**
 * AuthContext — single source of truth for "is the user signed in" and "is
 * the app unlocked behind the biometric gate".
 *
 * Two independent gates:
 *   1. Firebase/GCIP session (signedIn): persisted by the Firebase SDK across
 *      launches. We subscribe via onGcipAuthChange.
 *   2. Biometric lock (unlocked): a device-local gate that re-locks every cold
 *      start (and can be re-locked on background). Face ID / fingerprint /
 *      passcode. Opt-out via Settings.
 *
 * A user must pass BOTH gates to reach the app. The router (app/_layout.tsx +
 * route guards) reads this context to decide where to send the user.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
  authenticateWithBiometrics,
  firebaseUserToUser,
  getBiometricCapability,
  logout as apiLogout,
} from "@/api/auth";
import { isGcipConfigured, onGcipAuthChange } from "@/api/gcip";
import {
  clearUser,
  getBiometricEnabled,
  loadUser,
  saveUser,
  setBiometricEnabled as persistBiometricEnabled,
} from "@/api/secureStore";
import type { User } from "@/api/types";

interface AuthState {
  /** Still resolving the persisted session on cold start. */
  initializing: boolean;
  signedIn: boolean;
  user: User | null;
  /** Whether the biometric gate has been satisfied this session. */
  unlocked: boolean;
  biometricEnabled: boolean;
  /** Device can do biometrics AND a credential is enrolled. */
  biometricAvailable: boolean;
}

interface AuthContextValue extends AuthState {
  /** Re-hydrate the cached user after a successful sign-in handoff. */
  setSessionUser: (user: User) => Promise<void>;
  unlock: () => Promise<boolean>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    initializing: true,
    signedIn: false,
    user: null,
    unlocked: false,
    biometricEnabled: true,
    biometricAvailable: false,
  });
  const appState = useRef(AppState.currentState);

  // Resolve biometric capability + preference + cached user once.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [cap, enabled, cachedUser] = await Promise.all([
        getBiometricCapability().catch(() => ({
          hasHardware: false,
          isEnrolled: false,
          types: [],
        })),
        getBiometricEnabled().catch(() => true),
        loadUser().catch(() => null),
      ]);
      if (!mounted) return;
      setState((s) => ({
        ...s,
        biometricEnabled: enabled,
        biometricAvailable: cap.hasHardware && cap.isEnrolled,
        user: cachedUser ?? s.user,
      }));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to Firebase auth state. If GCIP isn't configured (e.g. local
  // dev without keys) we stop initializing so the login screen still renders.
  useEffect(() => {
    if (!isGcipConfigured()) {
      setState((s) => ({ ...s, initializing: false }));
      return;
    }
    const unsub = onGcipAuthChange(async (fbUser) => {
      if (fbUser) {
        const user = firebaseUserToUser(fbUser);
        await saveUser(user).catch(() => {});
        setState((s) => ({ ...s, signedIn: true, user, initializing: false }));
      } else {
        await clearUser().catch(() => {});
        setState((s) => ({
          ...s,
          signedIn: false,
          user: null,
          unlocked: false,
          initializing: false,
        }));
      }
    });
    return unsub;
  }, []);

  // Re-lock when the app returns from background (HIPAA: short auto-lock).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;
      if (prev === "active" && next.match(/inactive|background/)) {
        setState((s) => (s.biometricEnabled ? { ...s, unlocked: false } : s));
      }
    });
    return () => sub.remove();
  }, []);

  const setSessionUser = useCallback(async (user: User) => {
    await saveUser(user).catch(() => {});
    setState((s) => ({ ...s, signedIn: true, user }));
  }, []);

  const unlock = useCallback(async (): Promise<boolean> => {
    // If biometrics are disabled or unavailable, the gate is a no-op.
    if (!state.biometricEnabled || !state.biometricAvailable) {
      setState((s) => ({ ...s, unlocked: true }));
      return true;
    }
    const ok = await authenticateWithBiometrics().catch(() => false);
    if (ok) setState((s) => ({ ...s, unlocked: true }));
    return ok;
  }, [state.biometricEnabled, state.biometricAvailable]);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    await persistBiometricEnabled(enabled).catch(() => {});
    setState((s) => ({
      ...s,
      biometricEnabled: enabled,
      // Disabling the gate immediately unlocks; enabling re-locks.
      unlocked: enabled ? false : true,
    }));
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout().catch(() => {});
    await clearUser().catch(() => {});
    setState((s) => ({ ...s, signedIn: false, user: null, unlocked: false }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, setSessionUser, unlock, setBiometricEnabled, signOut }),
    [state, setSessionUser, unlock, setBiometricEnabled, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
