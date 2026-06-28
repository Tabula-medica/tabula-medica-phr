/**
 * Google + Apple sign-in hooks. Each obtains a provider ID token, exchanges
 * it for a Firebase credential (api/gcip.ts), then runs the backend session
 * handoff. Mirrors tabula-medica-mobile/src/services/auth.ts.
 *
 * Returns `ready: false` when the provider isn't configured/available so the
 * Login screen can hide the button instead of showing a dead control.
 */
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import {
  signInGcipWithAppleIdToken,
  signInGcipWithGoogleIdToken,
} from "@/api/gcip";
import { exchangeGcipSession, firebaseUserToUser, type SignInResult } from "@/api/auth";
import { googleConfig } from "@/api/config";

export function useGoogleSignIn(): {
  ready: boolean;
  signIn: () => Promise<SignInResult | null>;
} {
  const { iosClientId, androidClientId, webClientId } = googleConfig;
  const ready = Boolean(iosClientId || androidClientId || webClientId);

  // Always called (rules-of-hooks); request is inert when IDs are undefined.
  const [, , promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId,
    androidClientId,
    clientId: webClientId,
  });

  const signIn = useCallback(async (): Promise<SignInResult | null> => {
    if (!ready) return null;
    const result = await promptAsync();
    if (result.type !== "success") return null;
    const params = result.params as Record<string, string> | undefined;
    const idToken = params?.id_token ?? result.authentication?.idToken ?? undefined;
    if (!idToken) return null;
    const fb = await signInGcipWithGoogleIdToken(
      idToken,
      result.authentication?.accessToken ?? undefined
    );
    const handoff = await exchangeGcipSession();
    return {
      user: handoff?.user ?? firebaseUserToUser(fb),
      needsOnboarding: handoff?.needsOnboarding ?? null,
      emailVerified: fb.emailVerified,
    };
  }, [promptAsync, ready]);

  return { ready, signIn };
}

export function useAppleSignIn(): {
  ready: boolean;
  signIn: () => Promise<SignInResult | null>;
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

  const signIn = useCallback(async (): Promise<SignInResult | null> => {
    if (!available) return null;
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
    const fb = await signInGcipWithAppleIdToken(credential.identityToken, rawNonce);
    const handoff = await exchangeGcipSession();
    return {
      user: handoff?.user ?? firebaseUserToUser(fb),
      needsOnboarding: handoff?.needsOnboarding ?? null,
      emailVerified: fb.emailVerified,
    };
  }, [available]);

  return { ready: available, signIn };
}
