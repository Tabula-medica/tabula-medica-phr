import { useState, useEffect, useCallback } from "react";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import { api, User, getUserId, clearUserId, clearTokens } from "@/lib/api";
import {
  isGcipConfigured,
  gcipSignInWithEmail,
  gcipSignUpWithEmail,
  gcipSendPasswordReset,
  gcipSignOut,
  useGcipGoogleAuth,
} from "@/lib/gcip";

WebBrowser.maybeCompleteAuthSession();

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);

  // GCIP Google sign-in hook — must be called unconditionally at the top of
  // the hook (rules-of-hooks). Internals lazy-load Firebase and no-op when
  // GCIP isn't configured for this build.
  const gcipGoogle = useGcipGoogleAuth();

  useEffect(() => {
    checkAuth();
    checkAppleAuthAvailability();
  }, []);

  const checkAuth = async () => {
    try {
      const userId = await getUserId();
      if (userId) {
        // 20s timeout accommodates Cloud Run cold-starts on the prod backend.
        // If we exceed it we fall through to the unauthenticated landing state
        // — the user can sign in again and AsyncStorage gets cleared below.
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Auth check timed out")), 20000)
        );
        const savedUser = await Promise.race([
          api.users.get(userId),
          timeoutPromise,
        ]);
        setUser(savedUser);
      }
    } catch (error) {
      // Use warn (not error) so the React Native LogBox does NOT show a red
      // full-screen overlay for a benign startup recovery: a timeout or a
      // 401 here simply means "force the user back to sign-in", not a crash.
      console.warn("Auth check failed, clearing session:", error);
      await clearUserId();
      await clearTokens();
    } finally {
      setIsLoading(false);
    }
  };

  const checkAppleAuthAvailability = async () => {
    if (Platform.OS === "ios") {
      const available = await AppleAuthentication.isAvailableAsync();
      setIsAppleAuthAvailable(available);
    }
  };

  /**
   * Email/password sign-in. When GCIP is configured for this build we route
   * through Firebase Auth and exchange the resulting ID token for one of our
   * opaque session tokens. Otherwise we fall back to the legacy
   * email/password endpoint backed by the local users table. Task #68
   * (dual-validation cutover).
   */
  const signInWithEmail = useCallback(async (email: string, password: string) => {
    if (isGcipConfigured()) {
      try {
        const idToken = await gcipSignInWithEmail(email, password);
        const { user: gcipUser } = await api.auth.gcip({ idToken });
        setUser(gcipUser);
        return gcipUser;
      } catch (gcipErr: any) {
        const code: string = gcipErr?.code ?? "";
        // Firebase throws auth/internal-error or auth/unauthorized-domain when
        // the current origin (localhost, *.replit.dev, etc.) is not authorized.
        // Fall back to our server-side login so email/password works in dev.
        if (
          code === "auth/internal-error" ||
          code === "auth/unauthorized-domain" ||
          code === "auth/network-request-failed"
        ) {
          const { user: loggedInUser } = await api.auth.login({ email, password });
          setUser(loggedInUser);
          return loggedInUser;
        }
        throw gcipErr;
      }
    }
    const { user: loggedInUser } = await api.auth.login({ email, password });
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, name: string) => {
    if (isGcipConfigured()) {
      try {
        const idToken = await gcipSignUpWithEmail(email, password, name);
        const { user: gcipUser } = await api.auth.gcip({ idToken });
        setUser(gcipUser);
        return gcipUser;
      } catch (gcipErr: any) {
        const code: string = gcipErr?.code ?? "";
        // Firebase throws auth/internal-error or auth/unauthorized-domain when
        // the current origin (localhost, *.replit.dev, etc.) is not in the
        // project's authorized-domain list. Fall through to our own server-side
        // register endpoint so sign-up works in dev without Firebase setup.
        if (
          code === "auth/internal-error" ||
          code === "auth/unauthorized-domain" ||
          code === "auth/network-request-failed"
        ) {
          const { user: newUser } = await api.auth.register({ email, password, name });
          setUser(newUser);
          return newUser;
        }
        throw gcipErr;
      }
    }
    const { user: newUser } = await api.auth.register({ email, password, name });
    setUser(newUser);
    return newUser;
  }, []);

  /**
   * Send a password-reset email via GCIP. No-op on legacy stack — caller
   * should fall back to the existing forgot-password flow there.
   */
  const sendPasswordReset = useCallback(async (email: string) => {
    if (!isGcipConfigured()) {
      throw new Error("Password reset via GCIP is not configured for this build");
    }
    await gcipSendPasswordReset(email);
  }, []);

  const signInWithApple = useCallback(async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const fullName = credential.fullName
        ? `${credential.fullName.givenName || ""} ${credential.fullName.familyName || ""}`.trim()
        : undefined;

      const { user: newUser } = await api.auth.apple({
        appleId: credential.user,
        email: credential.email || undefined,
        fullName: fullName || undefined,
        identityToken: credential.identityToken || undefined,
      });

      setUser(newUser);
      return newUser;
    } catch (error: any) {
      if (error.code === "ERR_REQUEST_CANCELED" || error.code === "ERR_CANCELED") {
        return null;
      }
      if (error.code === "ERR_APPLE_AUTHENTICATION_UNAVAILABLE") {
        throw new Error("Apple Sign-in is not available on this device. Please use email and password instead.");
      }
      if (error.code === "ERR_APPLE_AUTHENTICATION_REQUEST_FAILED") {
        throw new Error("Apple Sign-in request failed. Please try again or use email and password.");
      }
      const serverCode = error?.response?.data?.code;
      if (serverCode === "APPLE_IDENTITY_TOKEN_INVALID" || serverCode === "APPLE_IDENTITY_TOKEN_REQUIRED") {
        throw new Error("Apple Sign-in token could not be verified. Please update the app and try again.");
      }
      if (serverCode === "APPLE_USER_PROVISION_FAILED") {
        throw new Error("Could not finish creating your account. Please try again or contact support.");
      }
      throw error;
    }
  }, []);

  // Task #71 — `signInWithAuth0` was removed. Federated user login now
  // routes exclusively through GCIP (`signInWithGoogle` below + email/password
  // through `signInWithEmail` above). The Auth0 SMART-on-FHIR / TEFCA broker
  // is server-side only and never wired into client login.

  /**
   * GCIP Google sign-in. Triggers the platform Google chooser via
   * expo-auth-session, exchanges the Google ID token for a Firebase
   * credential, then exchanges the Firebase ID token for one of our opaque
   * session tokens via POST /api/auth/gcip. Returns null on user cancel.
   */
  const signInWithGoogle = useCallback(async () => {
    if (!isGcipConfigured()) {
      throw new Error("Google sign-in via GCIP is not configured for this build");
    }
    const firebaseIdToken = await gcipGoogle.signInWithGoogle();
    if (!firebaseIdToken) {
      return null; // user cancelled / dismissed the chooser or popup
    }
    const { user: gcipUser } = await api.auth.gcip({ idToken: firebaseIdToken });
    setUser(gcipUser);
    return gcipUser;
  }, [gcipGoogle]);

  const signOut = useCallback(async () => {
    if (isGcipConfigured()) {
      // best-effort — clear Firebase auth state too so the next sign-in
      // doesn't silently reuse a cached GCIP session.
      await gcipSignOut();
    }
    await clearTokens();
    await clearUserId();
    setUser(null);
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAppleAuthAvailable,
    isGcipEnabled: isGcipConfigured(),
    signInWithEmail,
    signUpWithEmail,
    signInWithApple,
    signInWithGoogle,
    // Enable the Google button only when the platform's Google flow is wired:
    // web needs the Firebase config (popup uses the managed Web SDK client),
    // native needs the expo-auth-session request + a platform client ID. See
    // `isReady` in useGcipGoogleAuth (lib/gcip.ts).
    isGoogleSignInReady: gcipGoogle.isReady,
    sendPasswordReset,
    signOut,
    refreshUser: checkAuth,
  };
}
