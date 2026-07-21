// GCIP (Google Cloud Identity Platform / Firebase Auth) — React Native / Expo.
// Portfolio auth standard: email/password only, NO third-party login vendors.
// Replaces @clerk/expo. Uses the Firebase JS SDK with AsyncStorage persistence
// (works in Expo managed — no native modules). Config from EXPO_PUBLIC_FIREBASE_*.

import { initializeApp, getApps } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  // @ts-ignore — getReactNativePersistence is provided by firebase/auth for RN
  getReactNativePersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const cfg = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
};

export function gcipConfigured(): boolean {
  return Boolean(cfg.apiKey && cfg.projectId);
}

let _auth: Auth | null = null;
function authInstance(): Auth {
  if (!_auth) {
    const app = getApps().length
      ? getApps()[0]!
      : initializeApp({
          apiKey: cfg.apiKey,
          authDomain: cfg.authDomain ?? `${cfg.projectId}.firebaseapp.com`,
          projectId: cfg.projectId,
        });
    try {
      _auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    } catch {
      // Already initialized (e.g. Fast Refresh) — reuse it.
      _auth = getAuth(app);
    }
  }
  return _auth;
}

export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(authInstance(), cb);
}

export function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(authInstance(), email.trim(), password);
}

export function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(authInstance(), email.trim(), password);
}

export function firebaseSignOut() {
  return signOut(authInstance());
}

export async function getIdToken(): Promise<string | null> {
  const u = authInstance().currentUser;
  return u ? u.getIdToken() : null;
}

export function friendlyAuthError(code?: string): string {
  switch (code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email or password is incorrect.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}
