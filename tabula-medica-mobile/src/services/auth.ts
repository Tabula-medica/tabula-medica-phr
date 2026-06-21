import * as LocalAuthentication from "expo-local-authentication";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useCallback, useEffect, useState } from "react";
import api from "./api";
import {
  signInGcipWithEmail,
  signUpGcipWithEmail,
  signInGcipWithGoogleIdToken,
  signInGcipWithAppleIdToken,
  sendGcipPasswordResetEmail,
  signOutGcip,
  getGcipAuth,
  getGcipIdToken,
  isGcipConfigured,
  sendGcipEmailVerification,
  type FirebaseUser,
} from "../lib/gcip";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
  needsOnboarding?: boolean;
}

/**
 * Mobile equivalent of the web's POST /api/auth/gcip/session handoff.
 *
 * After a successful Firebase sign-in (Google, Apple, or email/password),
 * call this once to (a) record the login on the server for security audit
 * and (b) learn whether the user still needs to complete onboarding.
 *
 * Mobile does NOT receive or need a session cookie — subsequent API calls
 * keep working through the existing bearer-token path: `services/api.ts`'s
 * axios interceptor auto-attaches the Firebase ID token, and the backend
 * accepts it via the GCIP branch of `authMiddleware` in
 * `server/mobile-api-routes.ts` (and `isAuthenticated` in
 * `server/replit_integrations/auth/replitAuth.ts`).
 *
 * Returns `null` if no Firebase user is signed in or the handoff fails;
 * callers may still treat the underlying sign-in as successful because
 * the bearer-auth path is independent of this handoff.
 */
export async function exchangeGcipSession(): Promise<{
  user: User;
  needsOnboarding: boolean | null;
} | null> {
  const token = await getGcipIdToken(true);
  if (!token) return null;
  try {
    const res = await api.post<{
      user: { id: string; email: string; name: string; role: string };
      needsOnboarding: boolean | null;
    }>(
      "/api/mobile/auth/gcip/session",
      undefined,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = res.data;
    return {
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        emailVerified: getGcipAuth().currentUser?.emailVerified ?? false,
      },
      // `null` means the backend could not determine onboarding status
      // (transient storage error). Callers should treat null as "unknown"
      // rather than "no onboarding needed".
      needsOnboarding: data.needsOnboarding ?? null,
    };
  } catch {
    return null;
  }
}

export interface SmartFhirConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  scopes: string[];
}

export interface SmartFhirTokens {
  accessToken: string;
  refreshToken?: string;
  patientId?: string;
  expiresIn?: number;
}

const fhirDiscovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: Constants.expoConfig?.extra?.fhirAuthUrl,
  tokenEndpoint: Constants.expoConfig?.extra?.fhirTokenUrl,
};

function firebaseUserToUser(fbUser: FirebaseUser): User {
  const name =
    fbUser.displayName ||
    fbUser.email?.split("@")[0] ||
    "Patient";
  return {
    id: fbUser.uid,
    email: fbUser.email ?? "",
    name,
    role: "patient",
    emailVerified: fbUser.emailVerified,
  };
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const fbUser = await signInGcipWithEmail(email, password);
  const token = await fbUser.getIdToken();
  // Email/password sign-ins for verified users get the same backend handoff
  // as Google/Apple so the login is audited and onboarding state is known.
  // Unverified users won't resolve to an internal user yet — handoff returns
  // null and the verify-email flow takes over.
  const handoff = fbUser.emailVerified ? await exchangeGcipSession() : null;
  return {
    token,
    user: handoff?.user ?? firebaseUserToUser(fbUser),
    needsOnboarding: handoff?.needsOnboarding,
  };
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  const fbUser = await signUpGcipWithEmail(email, password);
  // Kick off the verification email immediately after sign-up. The backend
  // (`server/auth/gcip.ts`) only links a Firebase identity to a real patient
  // account when `email_verified === true`, so unverified users would
  // otherwise sign in but see an empty dashboard.
  try {
    await sendGcipEmailVerification(fbUser);
  } catch {
    // Surface failures via the UI's resend action; don't block the sign-up.
  }
  const token = await fbUser.getIdToken();
  return { token, user: firebaseUserToUser(fbUser) };
}

export async function sendPasswordReset(email: string): Promise<void> {
  await sendGcipPasswordResetEmail(email);
}

export async function resendVerificationEmail(): Promise<boolean> {
  return sendGcipEmailVerification();
}

/**
 * React hook that wraps Expo's Google AuthSession provider and exchanges
 * the resulting Google ID token for a Firebase credential, mirroring the
 * web client's `signInGcipWithGoogle` flow. Returns `null` if Google
 * client IDs are not configured for this build.
 *
 * Usage in a screen:
 *   const google = useGoogleSignIn();
 *   await google?.signIn();
 */
export function useGoogleSignIn(): {
  ready: boolean;
  signIn: () => Promise<AuthResponse | null>;
} {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<
    string,
    string | undefined
  >;
  const iosClientId = extra.googleIosClientId;
  const androidClientId = extra.googleAndroidClientId;
  const webClientId = extra.googleWebClientId;
  const ready = Boolean(iosClientId || androidClientId || webClientId);

  // Hook is always called (rules-of-hooks). When no client IDs are configured
  // the request is built with undefined IDs and `signIn` reports "not ready".
  const [, , promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId,
    androidClientId,
    clientId: webClientId,
  });

  const signIn = useCallback(async (): Promise<AuthResponse | null> => {
    if (!ready) return null;
    const result = await promptAsync();
    if (result.type !== "success") return null;
    const params = result.params as Record<string, string> | undefined;
    const idToken =
      params?.id_token ??
      (result.authentication && result.authentication.idToken) ??
      undefined;
    if (!idToken) return null;
    const accessToken = result.authentication?.accessToken ?? undefined;
    const fbUser = await signInGcipWithGoogleIdToken(idToken, accessToken);
    const token = await fbUser.getIdToken();
    // Hand off to the mobile backend so the login is audited and we know
    // whether onboarding still needs to run. Bearer auth keeps working
    // either way via the axios interceptor in services/api.ts.
    const handoff = await exchangeGcipSession();
    return {
      token,
      user: handoff?.user ?? firebaseUserToUser(fbUser),
      needsOnboarding: handoff?.needsOnboarding,
    };
  }, [promptAsync, ready]);

  return { ready, signIn };
}

/**
 * React hook that wraps `expo-apple-authentication` and exchanges the
 * resulting Apple identity token for a Firebase credential, mirroring the
 * web client's GCIP OAuth flow. Returns `ready: false` on platforms
 * where Sign in with Apple is unavailable (Android, web, simulator
 * without Apple ID) so callers can hide the button.
 *
 * Usage in a screen:
 *   const apple = useAppleSignIn();
 *   if (apple.ready) await apple.signIn();
 */
export function useAppleSignIn(): {
  ready: boolean;
  signIn: () => Promise<AuthResponse | null>;
} {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      setAvailable(false);
      return;
    }
    AppleAuthentication.isAvailableAsync()
      .then(setAvailable)
      .catch(() => setAvailable(false));
  }, []);

  const signIn = useCallback(async (): Promise<AuthResponse | null> => {
    if (!available) return null;
    // Firebase requires a SHA256 hash of the nonce in the Apple request
    // and the raw nonce when exchanging the credential.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce
    );
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) return null;
    const fbUser = await signInGcipWithAppleIdToken(
      credential.identityToken,
      rawNonce
    );
    const token = await fbUser.getIdToken();
    const handoff = await exchangeGcipSession();
    return {
      token,
      user: handoff?.user ?? firebaseUserToUser(fbUser),
      needsOnboarding: handoff?.needsOnboarding,
    };
  }, [available]);

  return { ready: available, signIn };
}

export async function logout(): Promise<void> {
  try {
    await api.post("/api/mobile/auth/logout");
  } catch {
    // best-effort server-side audit; client signs out either way.
  }
  await signOutGcip();
}

export async function getStoredUser(): Promise<User | null> {
  if (!isGcipConfigured()) return null;
  try {
    const fbUser = getGcipAuth().currentUser;
    return fbUser ? firebaseUserToUser(fbUser) : null;
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getGcipIdToken();
  return !!token;
}

export async function checkBiometricSupport(): Promise<{
  isSupported: boolean;
  biometryType: LocalAuthentication.AuthenticationType[];
}> {
  const isSupported = await LocalAuthentication.hasHardwareAsync();
  const biometryType = await LocalAuthentication.supportedAuthenticationTypesAsync();
  return { isSupported, biometryType };
}

export async function authenticateWithBiometrics(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Authenticate to access Tabula Medica",
    fallbackLabel: "Use passcode",
    disableDeviceFallback: false,
  });
  return result.success;
}

export async function smartFhirLogin(): Promise<AuthSession.AuthSessionResult> {
  const clientId = Constants.expoConfig?.extra?.fhirClientId || "tabula-medica";

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: ["openid", "profile", "fhirUser", "launch/patient", "patient/*.read"],
    redirectUri: AuthSession.makeRedirectUri({
      scheme: "com.tabulamedica.app",
      path: "auth/callback",
    }),
    usePKCE: true,
  });

  return request.promptAsync(fhirDiscovery);
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<SmartFhirTokens> {
  const clientId = Constants.expoConfig?.extra?.fhirClientId || "tabula-medica";

  const response = await AuthSession.exchangeCodeAsync(
    {
      clientId,
      code,
      redirectUri: AuthSession.makeRedirectUri({
        scheme: "com.tabulamedica.app",
        path: "auth/callback",
      }),
      extraParams: { code_verifier: codeVerifier },
    },
    fhirDiscovery
  );

  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken || undefined,
    expiresIn: response.expiresIn || undefined,
  };
}

export async function connectEhrProvider(
  providerType: string,
  tokens: SmartFhirTokens
): Promise<void> {
  await api.post("/api/fhir/connect", {
    providerType,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
  });
}
