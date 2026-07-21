// GCIP auth context for the NoorJyoti mobile app. Replaces Clerk's provider/hooks.
// The api-client is authenticated via a Bearer ID token (see AuthBridge), so this
// context only tracks Firebase auth state + exposes sign-in/up/out.

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

export function GcipAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!gcipConfigured()) {
      setIsLoaded(true);
      return;
    }
    return onAuthChange((u) => {
      setUser(u);
      setIsLoaded(true);
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmail(email, password);
  }, []);
  const signUp = useCallback(async (email: string, password: string) => {
    await signUpWithEmail(email, password);
  }, []);
  const signOut = useCallback(async () => {
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
