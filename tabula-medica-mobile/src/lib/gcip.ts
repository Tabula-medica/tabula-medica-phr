import Constants from "expo-constants";
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
// `getReactNativePersistence` exists at runtime in `@firebase/auth`'s React
// Native entry (resolved by Metro via the `react-native` package export
// condition), but `@firebase/auth`'s top-level `types` export points at the
// web-only `auth-public.d.ts`, so TypeScript can't see the symbol. The
// ts-expect-error is intentional and scoped to this single import.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - RN-only export not present in web typings
import { getReactNativePersistence } from "@firebase/auth";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

const apiKey = extra.gcipApiKey;
const authDomain = extra.gcipAuthDomain;
const projectId = extra.gcipProjectId;

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export function isGcipConfigured(): boolean {
  return Boolean(apiKey && authDomain && projectId);
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
      apiKey: apiKey!,
      authDomain: authDomain!,
      projectId: projectId!,
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
    // initializeAuth throws if already initialized for this app (e.g. fast refresh).
    cachedAuth = getAuth(app);
  }
  return cachedAuth;
}

export async function signInGcipWithEmail(
  email: string,
  password: string
): Promise<FirebaseUser> {
  const cred = await signInWithEmailAndPassword(getGcipAuth(), email, password);
  return cred.user;
}

export async function signUpGcipWithEmail(
  email: string,
  password: string
): Promise<FirebaseUser> {
  const cred = await createUserWithEmailAndPassword(
    getGcipAuth(),
    email,
    password
  );
  return cred.user;
}

/**
 * Mobile equivalent of the web client's `signInGcipWithGoogle`. The web
 * uses `signInWithPopup`, which is not available in React Native, so the
 * mobile flow obtains a Google ID token via `expo-auth-session/providers/
 * google` (see `useGoogleSignIn` in `services/auth.ts`) and then exchanges
 * it for a Firebase credential here. The backend accepts the resulting
 * Firebase ID token through the same `verifyAndResolveGcip` path.
 */
export async function signInGcipWithGoogleIdToken(
  googleIdToken: string,
  googleAccessToken?: string
): Promise<FirebaseUser> {
  const credential = GoogleAuthProvider.credential(googleIdToken, googleAccessToken);
  const cred = await signInWithCredential(getGcipAuth(), credential);
  return cred.user;
}

export async function sendGcipPasswordResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(getGcipAuth(), email);
}

/**
 * Sends a Firebase email-verification message to the given user (defaults to
 * the currently signed-in user). Returns false when there is no user to send
 * to. The actionCodeSettings are left as Firebase defaults; the verification
 * link opens Firebase's hosted handler, which marks the account verified.
 */
export async function sendGcipEmailVerification(
  user?: FirebaseUser
): Promise<boolean> {
  const target = user ?? getGcipAuth().currentUser;
  if (!target) return false;
  await sendEmailVerification(target);
  return true;
}

/**
 * Forces a refresh of the current user's profile from Firebase so that
 * `emailVerified` reflects the latest server-side state after the user
 * clicks the verification link in their email.
 */
export async function reloadGcipUser(): Promise<FirebaseUser | null> {
  const user = getGcipAuth().currentUser;
  if (!user) return null;
  await user.reload();
  return getGcipAuth().currentUser;
}

/**
 * Mobile equivalent of Apple Sign-in via Firebase. Apple credentials are
 * obtained on iOS through `expo-apple-authentication` (see
 * `useAppleSignIn` in `services/auth.ts`) and exchanged for a Firebase
 * credential here. The backend accepts the resulting Firebase ID token
 * through the same `verifyAndResolveGcip` path.
 */
export async function signInGcipWithAppleIdToken(
  appleIdToken: string,
  rawNonce?: string
): Promise<FirebaseUser> {
  const provider = new OAuthProvider("apple.com");
  const credential = provider.credential({
    idToken: appleIdToken,
    rawNonce,
  });
  const cred = await signInWithCredential(getGcipAuth(), credential);
  return cred.user;
}

export async function signOutGcip(): Promise<void> {
  await signOut(getGcipAuth());
}

/**
 * Returns a fresh GCIP/Firebase ID token for the current user, or null when
 * no user is signed in. The Firebase SDK auto-refreshes ~5 minutes before
 * expiry; pass `forceRefresh=true` after a 401 to force a new token.
 *
 * Send the returned string as `Authorization: Bearer <token>` to the
 * backend — `server/auth/gcip.ts#verifyAndResolveGcip` accepts it.
 */
export async function getGcipIdToken(forceRefresh = false): Promise<string | null> {
  const user = getGcipAuth().currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}

export function onGcipAuthChange(
  cb: (user: FirebaseUser | null) => void
): Unsubscribe {
  return onAuthStateChanged(getGcipAuth(), cb);
}

export type { FirebaseUser };
