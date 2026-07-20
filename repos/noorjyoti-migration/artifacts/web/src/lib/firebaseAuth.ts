// GCIP (Google Cloud Identity Platform / Firebase Auth) — web client.
// Portfolio auth standard: email/password only, NO third-party login vendors.
// Replaces the Clerk web SDK. Config from build-time VITE_FIREBASE_* env.

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
};

export function gcipConfigured(): boolean {
  return Boolean(cfg.apiKey && cfg.projectId);
}

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

function authInstance(): Auth {
  if (!_auth) {
    _app = initializeApp({
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain ?? `${cfg.projectId}.firebaseapp.com`,
      projectId: cfg.projectId,
    });
    _auth = getAuth(_app);
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
