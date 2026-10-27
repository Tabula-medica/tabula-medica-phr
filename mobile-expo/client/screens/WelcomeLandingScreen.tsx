import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import WebView from "react-native-webview";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Gradients } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface WelcomeLandingScreenProps {
  onComplete: () => void;
  onSkip?: () => void;
}

export default function WelcomeLandingScreen({ onComplete, onSkip }: WelcomeLandingScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();
  const [showConnect, setShowConnect] = useState(false);
  const [connectNonce, setConnectNonce] = useState<string | null>(null);
  const [connectionMade, setConnectionMade] = useState(false);

  const { data: config, isLoading, isError } = useQuery<{
    configured: boolean;
    publicId: string | null;
    tefcaSupported: boolean;
    coverageCount: number;
  }>({
    queryKey: ["/api/fasten/config"],
    retry: 1,
  });

  const isFastenAvailable = !isLoading && !isError && config?.configured && config?.publicId;

  const fetchConnectNonce = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/fasten/connect-nonce");
      const data = await res.json();
      setConnectNonce(data.nonce || null);
    } catch {
      setConnectNonce(null);
    }
  }, []);

  const connectionEventMutation = useMutation({
    mutationFn: async ({ event, nonce }: { event: any; nonce: string | null }) => {
      return apiRequest("POST", "/api/fasten/connection-event", { event, connectNonce: nonce });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-records"] });
    },
  });

  const consentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/consent", {
        consentAiSummary: true,
        consentFastenHealth: true,
      });
      return res.json();
    },
  });

  const handleStitchEvent = useCallback((event: any) => {
    if (event?.type === "patient.connection_success" || event?.type === "patient.connection_pending") {
      setConnectionMade(true);
      connectionEventMutation.mutate({ event, nonce: connectNonce });
      consentMutation.mutate();
    }
    if (event?.type === "widget.complete") {
      setShowConnect(false);
      onComplete();
    }
  }, [connectionEventMutation, consentMutation, onComplete, connectNonce]);

  const handleWebViewMessage = useCallback((messageEvent: any) => {
    try {
      const data = JSON.parse(messageEvent.nativeEvent.data);
      if (data.source === "fasten-stitch") {
        handleStitchEvent(data.event);
      }
    } catch {}
  }, [handleStitchEvent]);

  const getStitchHtml = (): string => {
    const publicId = config?.publicId || "";
    return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link href="https://cdn.fastenhealth.com/connect/v4/fasten-stitch-element.css" rel="stylesheet">
  <script src="https://cdn.fastenhealth.com/connect/v4/fasten-stitch-element.js" type="module"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${isDark ? "#1a1a2e" : "#f8f9fa"};
      min-height: 100vh;
    }
    fasten-stitch-element { display: block; width: 100%; min-height: 100vh; }
  </style>
</head>
<body>
  <fasten-stitch-element public-id="${publicId}"></fasten-stitch-element>
  <script>
    const el = document.querySelector('fasten-stitch-element');
    if (el) {
      el.addEventListener('eventBus', (e) => {
        const event = JSON.parse(e.detail.data);
        const msg = JSON.stringify({ source: 'fasten-stitch', event: event });
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(msg);
        } else if (window.parent && window.parent !== window) {
          window.parent.postMessage(msg, window.location.origin);
        }
      });
    }
  </script>
</body>
</html>`;
  };

  const fastenIframeRef = useRef<any>(null);

  const beginConnectAndOpen = async () => {
    await fetchConnectNonce();
    setShowConnect(true);
  };

  const handleConnectPress = () => {
    if (!isFastenAvailable) {
      handleGetStarted();
      return;
    }
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    beginConnectAndOpen();
  };

  const handleGetStarted = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    consentMutation.mutate();
    onComplete();
  };

  const handleSkipForNow = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    consentMutation.mutate();
    onComplete();
  };

  const handleBackFromConnect = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    setShowConnect(false);
    if (connectionMade) {
      onComplete();
    }
  };

  React.useEffect(() => {
    if (Platform.OS !== "web" || !showConnect) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data.source === "fasten-stitch") {
          handleStitchEvent(data.event);
        }
      } catch {}
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [showConnect, handleStitchEvent]);

  if (showConnect) {
    if (Platform.OS === "web") {
      return (
        <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
          <View style={[styles.connectHeader, { backgroundColor: isDark ? theme.backgroundDefault : "#f0f0f5" }]}>
            <Pressable
              onPress={handleBackFromConnect}
              style={styles.connectBackBtn}
              testID="button-back-welcome"
            >
              <Feather name="arrow-left" size={20} color={theme.text} />
              <ThemedText style={styles.connectBackText}>Back</ThemedText>
            </Pressable>
            <ThemedText style={[styles.connectTitle, { color: theme.primary }]}>
              Connect Provider
            </ThemedText>
            <View style={{ width: 60 }} />
          </View>
          <View style={styles.webIframeContainer}>
            <iframe
              ref={fastenIframeRef}
              srcDoc={getStitchHtml()}
              style={{ width: "100%", height: "100%", border: "none" } as any}
              title="Fasten Connect"
              allow="camera;microphone"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
            />
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}>
        <View style={[styles.connectHeader, { backgroundColor: isDark ? theme.backgroundDefault : "#f0f0f5" }]}>
          <Pressable
            onPress={handleBackFromConnect}
            style={styles.connectBackBtn}
            testID="button-back-welcome"
          >
            <Feather name="arrow-left" size={20} color={theme.text} />
            <ThemedText style={styles.connectBackText}>Back</ThemedText>
          </Pressable>
          <ThemedText style={[styles.connectTitle, { color: theme.primary }]}>
            Connect Provider
          </ThemedText>
          <View style={{ width: 60 }} />
        </View>
        <WebView
          source={{ html: getStitchHtml() }}
          style={styles.webView}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
                Loading Fasten Connect...
              </ThemedText>
            </View>
          )}
          onError={() => {
            setShowConnect(false);
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing["2xl"],
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.heroArea}>
          <View style={[styles.logoCircle, { backgroundColor: theme.primary + "12" }]}>
            <Image
              source={require("../../assets/images/icon.png")}
              style={styles.appIconImage}
              resizeMode="contain"
            />
          </View>
          <ThemedText style={[styles.appName, { color: theme.text }]}>
            Tabula Medica
          </ThemedText>
          <ThemedText style={[styles.tagline, { color: theme.textSecondary }]}>
            Your health records, in your hands
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).springify()} style={styles.benefitsArea}>
          {[
            { icon: "cloud" as const, title: "50K+ Providers", text: "Connect to hospitals and clinics nationwide" },
            { icon: "shield" as const, title: "HIPAA Compliant", text: "AES-256 encrypted, SOC 2 readiness in flight" },
            { icon: "globe" as const, title: "50+ Languages", text: "Health records in your language" },
            { icon: "dollar-sign" as const, title: "Free to Join", text: "$0 premiums, your data stays yours" },
          ].map((item, idx) => (
            <Animated.View key={idx} entering={FadeInDown.delay(250 + idx * 80).springify()}>
              <View style={[styles.benefitRow, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <View style={[styles.benefitIcon, { backgroundColor: `${theme.primary}15` }]}>
                  <Feather name={item.icon} size={18} color={theme.primary} />
                </View>
                <View style={styles.benefitTextWrap}>
                  <ThemedText style={[styles.benefitTitle, { color: theme.text }]}>
                    {item.title}
                  </ThemedText>
                  <ThemedText style={[styles.benefitDesc, { color: theme.textSecondary }]}>
                    {item.text}
                  </ThemedText>
                </View>
              </View>
            </Animated.View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(550).springify()} style={styles.ctaArea}>
          {isFastenAvailable ? (
            <>
              <Pressable
                testID="button-connect-records"
                onPress={handleConnectPress}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <LinearGradient
                  colors={Gradients.primary as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtnGradient}
                >
                  <Feather name="link" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.primaryBtnText}>
                    Connect Health Records
                  </ThemedText>
                </LinearGradient>
              </Pressable>

              <Pressable
                testID="button-skip-for-now"
                onPress={handleSkipForNow}
                style={({ pressed }) => [
                  styles.skipBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <ThemedText style={[styles.skipBtnText, { color: theme.textSecondary }]}>
                  Skip for now
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <Pressable
              testID="button-get-started"
              onPress={handleGetStarted}
              style={({ pressed }) => [
                styles.primaryBtn,
                { opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <LinearGradient
                colors={Gradients.primary as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryBtnGradient}
              >
                <Feather name="arrow-right" size={20} color="#FFFFFF" />
                <ThemedText style={styles.primaryBtnText}>
                  Get Started
                </ThemedText>
              </LinearGradient>
            </Pressable>
          )}

          <View style={styles.trustBadges}>
            <View style={styles.trustBadge}>
              <Feather name="check-circle" size={12} color={theme.success} />
              <ThemedText style={[styles.trustBadgeText, { color: theme.textSecondary }]}>
                SOC 2 in flight
              </ThemedText>
            </View>
            <View style={[styles.trustDivider, { backgroundColor: theme.border }]} />
            <View style={styles.trustBadge}>
              <Feather name="shield" size={12} color={theme.success} />
              <ThemedText style={[styles.trustBadgeText, { color: theme.textSecondary }]}>
                HIPAA
              </ThemedText>
            </View>
            <View style={[styles.trustDivider, { backgroundColor: theme.border }]} />
            <View style={styles.trustBadge}>
              <Feather name="lock" size={12} color={theme.success} />
              <ThemedText style={[styles.trustBadgeText, { color: theme.textSecondary }]}>
                AES-256
              </ThemedText>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  heroArea: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  appIconImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  appName: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: Spacing.xs,
  },
  tagline: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  benefitsArea: {
    marginBottom: Spacing["2xl"],
    gap: Spacing.sm,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitTextWrap: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  benefitDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  ctaArea: {
    alignItems: "center",
  },
  primaryBtn: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    shadowColor: "#0066CC",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: Spacing.md,
  },
  primaryBtnGradient: {
    height: 56,
    borderRadius: BorderRadius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  skipBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: "500",
  },
  trustBadges: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  trustBadgeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  trustDivider: {
    width: 1,
    height: 14,
  },
  connectHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  connectBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.md,
  },
  connectBackText: {
    fontSize: 15,
    fontWeight: "500",
  },
  connectTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  webIframeContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
