import Constants from "expo-constants";

/**
 * Resolves the live backend base URL. Precedence:
 *   1. EXPO_PUBLIC_API_BASE_URL (build-time env, recommended)
 *   2. app.json -> expo.extra.apiBaseUrl
 *   3. https://tabulamedica.us (production default — same Cloud Run service
 *      as tabulamedica.world)
 */
function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  const fromExtra = (Constants.expoConfig?.extra as Record<string, string> | undefined)
    ?.apiBaseUrl;
  const url = fromEnv || fromExtra || "https://tabulamedica.us";
  return url.replace(/\/+$/, "");
}

export const API_BASE_URL = resolveApiBaseUrl();

export const gcipConfig = {
  apiKey: process.env.EXPO_PUBLIC_GCIP_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_GCIP_AUTH_DOMAIN,
  projectId:
    process.env.EXPO_PUBLIC_GCIP_PROJECT_ID || "united-planet-485003-n7-9f345",
};

export const googleConfig = {
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

export const REQUEST_TIMEOUT_MS = 15000;
