/**
 * GCIP (Firebase) client wrapper.
 *
 * The backend mobile auth surface is GCIP-only (no Auth0 — no BAA, HIPAA).
 * The flow is:
 *   1. User signs in with Firebase (email/password, Google, or Apple).
 *   2. We get a Firebase ID token via `getGcipIdToken()`.
 *   3. Every API call sends `Authorization: Bearer <idToken>`; the backend
 *      verifies it through `server/auth/gcip.ts#verifyAndResolveGcip`.
 *   4. Once after sign-in we POST /api/mobile/auth/gcip/session to record the
 *      login and learn onboarding status (see api/auth.ts).
 *
 * This mirrors tabula-medica-mobile/src/lib/gcip.ts but reads config from
 * EXPO_PUBLIC_* env (api/config.ts) instead of app.config.js extra.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser,
  type Unsubscribe,
} from "firebase/auth";
// RN-only export not present in @firebase/auth web typings (resolved by Metro
// via the react-native package export condition). Scoped ts-expect-error.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - RN-only export
import { getReactNativePersistence } from "@firebase/auth";
import { gcipConfig } from "./config";

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export function isGcipConfigured(): boolean {
  return Boolean(gcipConfig.apiKey && gcipConfig.authDomain && gcipConfig.projectId);
}

function getApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  if (!isGcipConfigured()) {
    throw new Error(
      "[GCIP] Missing client config. Set EXPO_PUBLIC_GCIP_API_KEY, EXPO_PUBLIC_GCIP_AUTH_DOMAIN, EXPO_PUBLIC_GCIP_PROJECT_ID."
    );
  }
  const existing = getApps().find((a) => a.name === "[DEFAULT]");
  cachedApp =
    existing ??
    initializeApp({
      apiKey: gcipConfig.apiKey!,
      authDomain: gcipConfig.authDomain!,
      projectId: gcipConfig.projectId!,
    });
  return cachedApp;
}

export function getGcipAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  const app = getApp();
  try {
    cachedAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // initializeAuth throws if already initialized (fast refresh / re-entry).
    cachedAuth = getAuth(app);
  }
  return cachedAuth;
}

export async function signInGcipWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(getGcipAuth(), email, password);
  return cred.user;
}

export async function signUpGcipWithEmail(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(getGcipAuth(), email, password);
  return cred.user;
}

export async function signInGcipWithGoogleIdToken(
  googleIdToken: string,
  googleAccessToken?: string
) {
  const credential = GoogleAuthProvider.credential(googleIdToken, googleAccessToken);
  const cred = await signInWithCredential(getGcipAuth(), credential);
  return cred.user;
}

export async function signInGcipWithAppleIdToken(appleIdToken: string, rawNonce?: string) {
  const provider = new OAuthProvider("apple.com");
  const credential = provider.credential({ idToken: appleIdToken, rawNonce });
  const cred = await signInWithCredential(getGcipAuth(), credential);
  return cred.user;
}

export async function sendGcipPasswordResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(getGcipAuth(), email);
}

export async function sendGcipEmailVerification(user?: FirebaseUser): Promise<boolean> {
  const target = user ?? getGcipAuth().currentUser;
  if (!target) return false;
  await sendEmailVerification(target);
  return true;
}

export async function signOutGcip(): Promise<void> {
  await signOut(getGcipAuth());
}

/**
 * Fresh Firebase ID token for the current user, or null if signed out.
 * Pass forceRefresh=true after a 401 to defeat clock-skew/expiry races.
 */
export async function getGcipIdToken(forceRefresh = false): Promise<string | null> {
  const user = getGcipAuth().currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export function onGcipAuthChange(cb: (user: FirebaseUser | null) => void): Unsubscribe {
  return onAuthStateChanged(getGcipAuth(), cb);
}

export type { FirebaseUser };
