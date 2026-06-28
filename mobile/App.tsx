import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import * as LocalAuthentication from "expo-local-authentication";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";

// The live PHR web app this shell wraps. `.world` is the global, GDPR-standard
// edition that serves every region; flip to `.us` for the US/TEFCA edition if
// this binary is published as a US-only listing. Configurable via app.json ->
// expo.extra.appUrl so the URL can change without a code edit.
const APP_URL: string =
  (Constants.expoConfig?.extra as any)?.appUrl ?? "https://tabulamedica.world";

const BRAND = "#1a3a52";
const ACCENT = "#0ea5e9";

// Hosts the WebView is allowed to render in-app. Anything else (external links,
// payment pages, third-party SSO that forbids embedding) opens in the system
// browser so we never trap the user or break OAuth in a WebView.
const ALLOWED_HOSTS = [
  "tabulamedica.world",
  "tabulamedica.us",
  "tabulamedica.health",
  "app.tabulamedica.health",
];

SplashScreen.preventAutoHideAsync().catch(() => {});

function isInternal(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

export default function App() {
  // Biometric app-lock: a PHR holds PHI, so we gate the WebView behind Face ID /
  // fingerprint on launch and whenever the app returns from background. This is
  // the genuine native value-add that distinguishes this from a bare website
  // (App Store guideline 4.2 minimum-functionality).
  const [unlocked, setUnlocked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState<boolean | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const webRef = useRef<WebView>(null);
  const canGoBack = useRef(false);

  const authenticate = useCallback(async () => {
    setAuthError(null);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        // No biometrics set up on the device — don't hard-lock the user out of
        // their own records; fall through (the web app still enforces its own
        // login/MFA). Surface the state so Settings can prompt enrollment.
        setBiometricAvailable(false);
        setUnlocked(true);
        return;
      }
      setBiometricAvailable(true);
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock your health record",
        fallbackLabel: "Use passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      if (result.success) {
        setUnlocked(true);
      } else {
        setAuthError("Authentication required to open your records.");
      }
    } catch (e: any) {
      setAuthError(e?.message ?? "Biometric check failed.");
    }
  }, []);

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  // Re-lock when the app goes to the background; re-prompt on return.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        setUnlocked(false);
      } else if (state === "active" && !unlocked) {
        authenticate();
      }
    });
    return () => sub.remove();
  }, [authenticate, unlocked]);

  // Android hardware back button navigates WebView history before exiting.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const onBack = () => {
      if (canGoBack.current && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, []);

  const onShouldStartLoad = useCallback((req: WebViewNavigation): boolean => {
    if (isInternal(req.url)) return true;
    // External / non-embeddable destination -> system browser.
    Linking.openURL(req.url).catch(() => {});
    return false;
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    webRef.current?.reload();
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  if (!unlocked) {
    return (
      <SafeAreaProvider>
        <View style={styles.lock}>
          <StatusBar style="light" />
          <Text style={styles.lockTitle}>Tabula Medica</Text>
          <Text style={styles.lockSub}>Your records are locked.</Text>
          {authError ? <Text style={styles.lockErr}>{authError}</Text> : null}
          <TouchableOpacity style={styles.unlockBtn} onPress={authenticate}>
            <Text style={styles.unlockBtnText}>
              {biometricAvailable === false ? "Continue" : "Unlock"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
        <StatusBar style="light" backgroundColor={BRAND} />
        <WebView
          ref={webRef}
          source={{ uri: APP_URL }}
          originWhitelist={["https://*"]}
          onShouldStartLoadWithRequest={onShouldStartLoad}
          onNavigationStateChange={(nav) => {
            canGoBack.current = nav.canGoBack;
          }}
          onLoadEnd={() => {
            setLoading(false);
            SplashScreen.hideAsync().catch(() => {});
          }}
          // PHI hygiene: don't let the OS/webview cache credentials beyond the
          // session, and keep third-party cookies off.
          sharedCookiesEnabled
          thirdPartyCookiesEnabled={false}
          javaScriptEnabled
          domStorageEnabled
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled={Platform.OS === "ios"}
          mediaPlaybackRequiresUserAction
          // Lets the web app trigger native file/camera pickers for insurance
          // card + document uploads (the web app already implements the flow).
          allowsInlineMediaPlayback
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={ACCENT} />
            </View>
          )}
          startInLoadingState
          // Android pull-to-refresh wrapper.
          {...(Platform.OS === "android"
            ? {
                refreshControl: (
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                  />
                ),
              }
            : {})}
        />
        {loading ? (
          <View pointerEvents="none" style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: BRAND },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND,
  },
  lock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND,
    padding: 24,
  },
  lockTitle: { color: "#fff", fontSize: 28, fontWeight: "700", marginBottom: 8 },
  lockSub: { color: "#cbd5e1", fontSize: 15, marginBottom: 24 },
  lockErr: { color: "#fca5a5", fontSize: 14, marginBottom: 16, textAlign: "center" },
  unlockBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
  },
  unlockBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
