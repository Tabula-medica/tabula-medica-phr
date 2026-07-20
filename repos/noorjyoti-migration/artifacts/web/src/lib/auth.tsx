// GCIP auth context for the NoorJyoti web app. Replaces Clerk's provider/hooks.
//
// Source of truth for the UI is the Firebase client auth state. On every auth
// change (sign-in, token refresh, reload) we mint/refresh a first-party httpOnly
// session cookie via /api/auth/session so the cookie-based api-client
// (credentials: "include") is always authenticated in lock-step. Sign-out clears
// the cookie (/api/auth/logout) and the Firebase session.

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import {
  gcipConfigured,
  onAuthChange,
  signInWithEmail,
  signUpWithEmail,
  firebaseSignOut,
  friendlyAuthError,
} from "./firebaseAuth";

export interface AuthState {
  user: User | null;
  isSignedIn: boolean;
  isLoaded: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

async function syncSessionCookie(user: User): Promise<void> {
  try {
    const idToken = await user.getIdToken();
    await fetch("/api/auth/session", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
  } catch {
    /* best-effort; api calls will 401 and prompt re-login if this fails */
  }
}

export function GcipAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!gcipConfigured()) {
      setIsLoaded(true);
      return;
    }
    return onAuthChange(async (u) => {
      setUser(u);
      setIsLoaded(true);
      if (u) await syncSessionCookie(u);
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmail(email, password); // onAuthChange handles the session cookie
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    await signUpWithEmail(email, password);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    await firebaseSignOut();
  }, []);

  return (
    <AuthCtx.Provider value={{ user, isSignedIn: !!user, isLoaded, signIn, signUp, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuthState(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) {
    return {
      user: null,
      isSignedIn: false,
      isLoaded: true,
      signIn: async () => {},
      signUp: async () => {},
      signOut: async () => {},
    };
  }
  return ctx;
}

export { friendlyAuthError };
