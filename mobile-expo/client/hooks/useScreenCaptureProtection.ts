/**
 * Screen-capture protection for PHI surfaces (Audit H-9).
 *
 * On iOS: blocks screen recording while active and shows a
 * placeholder during recents-switcher previews via
 * preventScreenCaptureAsync.
 * On Android: applies FLAG_SECURE via the same Expo API, which
 * blocks both screenshots and screen recording for the duration.
 *
 * Use this hook in any screen that renders PHI. It is also mounted
 * once at the authenticated-app level (SecureAppContent) so the whole
 * post-login surface is protected by default; per-screen mounts are
 * additive and harmless.
 */
import { useEffect } from "react";
import { Platform } from "react-native";
import * as ScreenCapture from "expo-screen-capture";

let activeCount = 0;

export function useScreenCaptureProtection(enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS === "web") return;

    let cancelled = false;
    activeCount += 1;

    (async () => {
      try {
        await ScreenCapture.preventScreenCaptureAsync("phi-guard");
      } catch {
        // best-effort; never crash a screen because of capture protection
      }
    })();

    return () => {
      if (cancelled) return;
      cancelled = true;
      activeCount = Math.max(0, activeCount - 1);
      if (activeCount === 0) {
        ScreenCapture.allowScreenCaptureAsync("phi-guard").catch(() => {});
      }
    };
  }, [enabled]);
}
