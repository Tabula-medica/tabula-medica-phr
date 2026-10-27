/**
 * Client-side GCIP (Firebase) helper. Task #68.
 *
 * Lazy-initializes a Firebase app + auth instance configured against the
 * BAA-covered GCIP project, exposes email/password + Google sign-in flows,
 * and returns the resulting ID token so the caller can exchange it for one
 * of our opaque session tokens via `POST /api/auth/gcip`.
 *
 * Why lazy: the `firebase` SDK pulls in IndexedDB / browser globals at
 * import time. Lazy init keeps cold-start RN code paths clean and lets us
 * fall back to email/password + Apple + Auth0 if GCIP isn't configured for
 * a given build.
 */
import Constants from "expo-constants";
import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

type FirebaseApp = import("firebase/app").FirebaseApp;
type Auth = import("firebase/auth").Auth;
type UserCredential = import("firebase/auth").UserCredential;

WebBrowser.maybeCompleteAuthSession();

interface GcipExtra {
  gcipApiKey?: string;
  gcipAuthDomain?: string;
  gcipProjectId?: string;
  googleIosClientId?: string;
  googleAndroidClientId?: string;
}

/**
 * When an `EXPO_PUBLIC_*` env var is unset at build time, Expo passes the
 * literal string (e.g. "$EXPO_PUBLIC_GCIP_API_KEY") straight through to the
 * extras block instead of substituting an empty string. Without this scrub,
 * downstream code thinks GCIP / Google sign-in is configured, forwards the
 * placeholder as a client_id to accounts.google.com, and the user sees a
 * "400 — That's an error" page. Treat any value that still looks like an
 * unsubstituted Expo placeholder as missing.
 */
function cleanExtraValue(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;
  if (s.startsWith("$EXPO_PUBLIC_") || s.startsWith("${EXPO_PUBLIC_")) return undefined;
  return s;
}

function getExtra(): GcipExtra {
  const raw = (Constants.expoConfig?.extra || (Constants as any).manifest?.extra || {}) as Record<string, unknown>;
  return {
    gcipApiKey: cleanExtraValue(raw.gcipApiKey),
    gcipAuthDomain: cleanExtraValue(raw.gcipAuthDomain),
    gcipProjectId: cleanExtraValue(raw.gcipProjectId),
    googleIosClientId: cleanExtraValue(raw.googleIosClientId),
    googleAndroidClientId: cleanExtraValue(raw.googleAndroidClientId),
  };
}

export function isGcipConfigured(): boolean {
  const extra = getExtra();
  return Boolean(extra.gcipApiKey && extra.gcipAuthDomain && extra.gcipProjectId);
}

/**
 * Google sign-in needs a real client ID for the current platform. Returns
 * false in builds where the EAS secret was never set, so the Login screen
 * can hide the Google button instead of opening a malformed OAuth URL.
 */
export function isGoogleClientConfigured(): boolean {
  const extra = getExtra();
  if (Platform.OS === "ios") return Boolean(extra.googleIosClientId);
  if (Platform.OS === "android") return Boolean(extra.googleAndroidClientId);
  // Web uses the Firebase-managed popup, which needs no hand-entered OAuth
  // client ID — only the Firebase project config (apiKey/authDomain/projectId).
  return isGcipConfigured();
}

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

async function getAuth(): Promise<Auth> {
  if (_auth) return _auth;
  const extra = getExtra();
  if (!extra.gcipApiKey || !extra.gcipAuthDomain || !extra.gcipProjectId) {
    throw new Error("GCIP is not configured for this build");
  }
  const { initializeApp, getApps, getApp } = await import("firebase/app");
  const firebaseAuth = await import("firebase/auth");

  _app = getApps().length > 0 ? getApp() : initializeApp({
    apiKey: extra.gcipApiKey,
    authDomain: extra.gcipAuthDomain,
    projectId: extra.gcipProjectId,
  });

  // RN needs explicit persistence; web/SSR uses the default
  // (in-memory + IndexedDB) wiring. `getReactNativePersistence` is shipped
  // by `firebase/auth` but intentionally omitted from its public types,
  // hence the @ts-expect-error per the locked reference port.
  //
  // SECURITY (Audit C-1): we back persistence with expo-secure-store
  // (iOS Keychain / Android Keystore, WHEN_UNLOCKED_THIS_DEVICE_ONLY)
  // instead of raw AsyncStorage so the Firebase ID + refresh tokens are
  // not stored in plaintext on the device. This matches what our App
  // Store Review Notes promise Apple.
  if (Platform.OS === "ios" || Platform.OS === "android") {
    const { secureFirebaseStorage } = await import("./secure-firebase-persistence");
    try {
      _auth = firebaseAuth.initializeAuth(_app, {
        // @ts-expect-error - getReactNativePersistence is not in firebase/auth public types
        persistence: firebaseAuth.getReactNativePersistence(secureFirebaseStorage),
      });
    } catch {
      // initializeAuth throws if already initialized for this app (hot reload).
      _auth = firebaseAuth.getAuth(_app);
    }
  } else {
    _auth = firebaseAuth.getAuth(_app);
  }
  return _auth;
}

export async function gcipSignInWithEmail(email: string, password: string): Promise<string> {
  const auth = await getAuth();
  const { signInWithEmailAndPassword } = await import("firebase/auth");
  const cred: UserCredential = await signInWithEmailAndPassword(auth, email, password);
  return cred.user.getIdToken();
}

export async function gcipSignUpWithEmail(
  email: string,
  password: string,
  displayName?: string,
): Promise<string> {
  const auth = await getAuth();
  const { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } =
    await import("firebase/auth");
  const cred: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName && cred.user) {
    try {
      await updateProfile(cred.user, { displayName });
    } catch {
      // non-fatal — name can be backfilled later via PATCH /api/users/:id
    }
  }
  if (cred.user) {
    try {
      await sendEmailVerification(cred.user);
    } catch {
      // non-fatal — user can request a resend later
    }
  }
  return cred.user.getIdToken();
}

export async function gcipSendPasswordReset(email: string): Promise<void> {
  const auth = await getAuth();
  const { sendPasswordResetEmail } = await import("firebase/auth");
  await sendPasswordResetEmail(auth, email);
}

export async function gcipSignOut(): Promise<void> {
  if (!_auth) return;
  const { signOut } = await import("firebase/auth");
  try {
    await signOut(_auth);
  } catch {
    // best-effort
  }
}

/**
 * Hook for Google sign-in. `signInWithGoogle()` runs the platform-appropriate
 * flow and resolves to a Firebase ID token (or `null` if the user cancels).
 *
 *   • Web   — Firebase-managed popup (`signInWithPopup`), matching the Vite SPA
 *     portal. Google selects the project's Firebase-managed "Web SDK" OAuth
 *     client automatically, so there is NO hand-entered web client ID. The
 *     deployed origin must be registered under Firebase Auth → Settings →
 *     Authorized domains.
 *   • iOS / Android — native Google chooser via expo-auth-session, exchanging
 *     the returned Google ID token for a Firebase credential.
 *
 * Returned shape: { signInWithGoogle() -> firebaseIdToken | null, isReady, platform }
 */
/**
 * Native-only expo-auth-session request. Isolated into its own hook so the
 * platform-split in `useGcipGoogleAuth` never calls `useIdTokenAuthRequest` on
 * web — without a `webClientId`, that hook trips a "Client Id must be defined"
 * invariant during render and crashes the web Login screen.
 *
 * `useIdTokenAuthRequest` consistently returns `id_token` in response.params on
 * native, which the generic `useAuthRequest` does not guarantee.
 */
function useNativeGoogleAuthRequest() {
  const extra = getExtra();
  // Always pass a non-empty fallback so useIdTokenAuthRequest NEVER receives
  // undefined for the platform client ID. The hook throws a render-time
  // "Client Id property `iosClientId` must be defined" invariant (from inside
  // its useMemo) when the value is falsy — that is the exact App Review
  // Guideline 2.1(a) launch crash seen on iPad Air M3 / iPadOS 26.5.
  // The "placeholder" value is harmless: isReady (in useGcipGoogleAuth) gates
  // on isGoogleClientConfigured(), so the Google button never shows and
  // signInWithGoogle is never reachable unless the real client ID is present.
  const [request, , promptAsync] = AuthSession.useIdTokenAuthRequest({
    iosClientId: extra.googleIosClientId ?? "placeholder",
    androidClientId: extra.googleAndroidClientId ?? "placeholder",
  });
  return { request, promptAsync };
}

export function useGcipGoogleAuth() {
  // Always call useNativeGoogleAuthRequest on native — Platform.OS is a
  // build-time constant so hook order is unconditionally stable, and the
  // placeholder fallback above means it never throws regardless of whether the
  // EAS Google client-ID secret was set. Skip on web only (the Firebase popup
  // flow needs no OAuth request object; and expo-auth-session's webClientId
  // requirement would trigger its own invariant).
  const native = Platform.OS !== "web" ? useNativeGoogleAuthRequest() : null;

  const signInNative = async (): Promise<string | null> => {
    if (!native) throw new Error("Native Google sign-in is unavailable on this platform");
    const result = await native.promptAsync();
    if (!result || result.type === "cancel" || result.type === "dismiss") {
      return null;
    }
    if (result.type === "error") {
      const msg =
        result.error?.description ||
        (result.error as any)?.params?.error ||
        "Unknown error";
      throw new Error(`Google sign-in error: ${msg}`);
    }
    const googleIdToken =
      (result as any)?.params?.id_token ||
      (result as any)?.authentication?.idToken;
    if (!googleIdToken) {
      throw new Error("Google sign-in did not return an ID token");
    }
    const auth = await getAuth();
    const { GoogleAuthProvider, signInWithCredential } = await import("firebase/auth");
    const credential = GoogleAuthProvider.credential(googleIdToken);
    const cred: UserCredential = await signInWithCredential(auth, credential);
    return cred.user.getIdToken();
  };

  const signInWeb = async (): Promise<string | null> => {
    const auth = await getAuth();
    const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
    const provider = new GoogleAuthProvider();
    try {
      const cred: UserCredential = await signInWithPopup(auth, provider);
      return cred.user.getIdToken();
    } catch (e: any) {
      const code = e?.code;
      if (
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request" ||
        code === "auth/user-cancelled"
      ) {
        return null;
      }
      throw e;
    }
  };

  const signInWithGoogle = async (): Promise<string | null> =>
    Platform.OS === "web" ? signInWeb() : signInNative();

  // Web readiness rides on the Firebase config alone (popup needs no extra
  // client id); native readiness needs the expo-auth-session request plus a
  // configured platform client id.
  //
  // On web, also gate on the current origin being a Firebase-authorized domain.
  // localhost and Replit dev-proxy hostnames are NOT added to Firebase's
  // authorized-domain list, so signInWithPopup() throws auth/internal-error
  // (or auth/unauthorized-domain) before the OAuth flow even starts.
  // Returning false here keeps the Google button hidden in local dev, which
  // is the correct UX: use email/password locally, Google in production.
  const isWebDomainLikelyAuthorized =
    Platform.OS === "web" && typeof window !== "undefined"
      ? (() => {
          const h = window.location.hostname;
          if (h === "localhost" || h === "127.0.0.1") return false;
          if (h.endsWith(".replit.dev") || h.endsWith(".repl.co") || h.endsWith(".replit.app")) return false;
          return true;
        })()
      : false;

  const isReady =
    Platform.OS === "web"
      ? isGcipConfigured() && isWebDomainLikelyAuthorized
      : Boolean(native?.request) && isGoogleClientConfigured();

  return { signInWithGoogle, isReady, platform: Platform.OS };
}
