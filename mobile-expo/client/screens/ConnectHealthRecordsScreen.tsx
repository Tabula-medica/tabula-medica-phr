import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import Animated, { FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import WebView from "react-native-webview";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import UpgradePrompt, { useFeatureGate } from "@/components/UpgradePrompt";
import { ConnectionHealthNotices } from "@/components/ConnectionHealthNotices";
import { CONNECTION_HEALTH_QUERY_KEY, useConnectionHealth } from "@/hooks/useConnectionHealth";

const FASTEN_URL = "https://app.fastenhealth.com";

// Completes the browser popup when an OAuth provider returns to the web app.
WebBrowser.maybeCompleteAuthSession();

export default function ConnectHealthRecordsScreen({ route, navigation }: {
  route?: { params?: { reconnectSource?: string } };
  navigation?: { setParams: (params: { reconnectSource?: string }) => void };
}) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const queryClient = useQueryClient();
  const [showConnect, setShowConnect] = useState(false);
  const [connectNonce, setConnectNonce] = useState<string | null>(null);
  const [openingSource, setOpeningSource] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [reconnectMessage, setReconnectMessage] = useState<string | null>(null);
  const handledReconnect = useRef<string | null>(null);
  const reconnectInProgress = useRef(false);
  const connectionHealth = useConnectionHealth();
  const [autoDiscoverResult, setAutoDiscoverResult] = useState<{
    discovered: boolean;
    message: string;
    importedCount?: number;
    networksWithRecords?: number;
  } | null>(null);
  const webViewRef = useRef<WebView>(null);
  const { checkFeature, promptProps } = useFeatureGate();

  const { data: config, isLoading } = useQuery<{
    configured: boolean;
    publicId: string | null;
    tefcaSupported: boolean;
    coverageCount: number;
    connectedSourceCount: number;
  }>({
    queryKey: ["/api/fasten/config"],
  });

  const fetchConnectNonce = useCallback(async () => {
    setConnectNonce(null);
    const res = await apiRequest("GET", "/api/fasten/connect-nonce");
    const data = await res.json();
    if (!data.nonce) throw new Error("Connection session unavailable");
    setConnectNonce(data.nonce);
  }, []);

  const connectionEventMutation = useMutation({
    mutationFn: async ({ event, nonce }: { event: any; nonce: string | null }) => {
      return apiRequest("POST", "/api/fasten/connection-event", { event, connectNonce: nonce });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-records"] });
      queryClient.invalidateQueries({ queryKey: CONNECTION_HEALTH_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/fasten/config"] });
    },
  });

  const autoDiscoverMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/tefca/auto-discover", {});
    },
    onSuccess: (data: any) => {
      setAutoDiscoverResult(data);
      if (data.discovered) {
        queryClient.invalidateQueries({ queryKey: ["/api/health-records"] });
        queryClient.invalidateQueries({ queryKey: ["/api/fasten/config"] });
      }
    },
    onError: () => {
      setAutoDiscoverResult({
        discovered: false,
        message: "Could not reach TEFCA networks. Try importing manually instead.",
      });
    },
  });

  const handleAutoDiscover = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    setAutoDiscoverResult(null);
    autoDiscoverMutation.mutate();
  };

  const handleStitchEvent = useCallback((event: any) => {
    if (event?.type === "patient.connection_success" || event?.type === "patient.connection_pending") {
      connectionEventMutation.mutate({ event, nonce: connectNonce });
    }
    if (event?.type === "widget.complete") {
      setShowConnect(false);
      queryClient.invalidateQueries({ queryKey: CONNECTION_HEALTH_QUERY_KEY });
    }
  }, [connectionEventMutation, connectNonce, queryClient]);

  const handleWebViewMessage = useCallback((messageEvent: any) => {
    try {
      const data = JSON.parse(messageEvent.nativeEvent.data);
      if (data.source === "fasten-stitch") {
        handleStitchEvent(data.event);
      }
    } catch {
    }
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
  <fasten-stitch-element
    public-id="${publicId}"
  ></fasten-stitch-element>
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

  const connectedSourceCount = config?.connectedSourceCount ?? 0;

  const fastenIframeRef = useRef<any>(null);

  const beginConnectAndOpen = async () => {
    setConnectError(null);
    try {
      await fetchConnectNonce();
      setShowConnect(true);
    } catch {
      setConnectError("Could not start a secure connection. Please try again.");
    }
  };

  const handleReconnect = useCallback(async (sourceType: string) => {
    if (reconnectInProgress.current) return;
    reconnectInProgress.current = true;
    setConnectError(null);
    setReconnectMessage(null);
    setOpeningSource(sourceType);
    try {
      // The payer-token broker is independent of the Fasten import widget.
      // Renewing an existing grant must not trigger the add-source paywall.
      const startResponse = await apiRequest("POST", "/api/fasten/reauthorize/start", {
        sourceType, platform: Platform.OS === "web" ? "web" : "native",
      });
      const session = await startResponse.json();
      const result = await WebBrowser.openAuthSessionAsync(session.authorizationUrl, session.redirectUri);
      if (result.type !== "success") {
        setReconnectMessage("Reconnection was cancelled. Your connection still needs attention.");
        return;
      }
      const callback = new URL(result.url);
      const expectedCallback = new URL(session.redirectUri);
      if (callback.protocol !== expectedCallback.protocol || callback.host !== expectedCallback.host ||
          callback.pathname !== expectedCallback.pathname ||
          callback.searchParams.get("state") !== session.state ||
          callback.searchParams.has("error") || !callback.searchParams.get("code")) {
        throw new Error("Invalid authorization response");
      }
      await apiRequest("POST", "/api/fasten/reauthorize/complete", {
        sourceType, code: callback.searchParams.get("code"), state: session.state,
      });
      await queryClient.invalidateQueries({ queryKey: CONNECTION_HEALTH_QUERY_KEY });
      setReconnectMessage(`Your ${sourceType} connection has been renewed.`);
    } catch {
      setConnectError("Could not renew this connection. Reconnecting may be temporarily unavailable. Please try again later.");
    } finally {
      reconnectInProgress.current = false;
      setOpeningSource(null);
    }
  }, [queryClient]);

  useEffect(() => {
    const source = route?.params?.reconnectSource;
    if (!source) {
      handledReconnect.current = null;
      return;
    }
    if (isLoading || handledReconnect.current === source) return;
    handledReconnect.current = source;
    navigation?.setParams({ reconnectSource: undefined });
    void handleReconnect(source);
  }, [route?.params?.reconnectSource, isLoading, handleReconnect, navigation]);

  const handleImportRecords = () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    if (connectedSourceCount >= 1 && !checkFeature("unlimited_fhir")) return;
    beginConnectAndOpen();
  };

  const handleOpenFasten = async () => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    if (connectedSourceCount >= 1 && !checkFeature("unlimited_fhir")) return;
    if (Platform.OS === "web") {
      try {
        const result = await WebBrowser.openBrowserAsync(FASTEN_URL);
        if (result.type === "cancel" || result.type === "dismiss") return;
      } catch {
        try { window.open(FASTEN_URL, "_blank"); } catch {}
      }
    } else {
      beginConnectAndOpen();
    }
  };

  useEffect(() => {
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

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.xl }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  if (showConnect) {
    if (Platform.OS === "web") {
      const stitchHtml = getStitchHtml();
      return (
        <ThemedView style={[styles.container, { paddingTop: headerHeight }]}>
          <View style={[styles.connectHeader, { backgroundColor: isDark ? theme.backgroundDefault : "#f0f0f5" }]}>
            <Pressable
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
                setShowConnect(false);
                queryClient.invalidateQueries({ queryKey: CONNECTION_HEALTH_QUERY_KEY });
              }}
              style={styles.connectBackBtn}
              testID="button-back-overview"
            >
              <Feather name="arrow-left" size={20} color={theme.text} />
              <ThemedText style={styles.connectBackText}>Back</ThemedText>
            </Pressable>
            <ThemedText style={[styles.connectTitle, { color: theme.primary }]}>
              Import My Records
            </ThemedText>
            <View style={{ width: 60 }} />
          </View>
          <View style={styles.webIframeContainer}>
            <iframe
              ref={fastenIframeRef}
              srcDoc={stitchHtml}
              style={{ width: "100%", height: "100%", border: "none" }}
              title="Fasten Connect"
              allow="camera;microphone"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation"
            />
          </View>
        </ThemedView>
      );
    }

    return (
      <View style={[styles.webViewContainer, { paddingTop: headerHeight }]}>
        <View style={[styles.connectHeader, { backgroundColor: isDark ? theme.backgroundDefault : "#f0f0f5" }]}>
          <Pressable
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
              setShowConnect(false);
              queryClient.invalidateQueries({ queryKey: CONNECTION_HEALTH_QUERY_KEY });
            }}
            style={styles.connectBackBtn}
            testID="button-back-overview"
          >
            <Feather name="arrow-left" size={20} color={theme.text} />
            <ThemedText style={styles.connectBackText}>Back</ThemedText>
          </Pressable>
          <ThemedText style={[styles.connectTitle, { color: theme.primary }]}>
            Import My Records
          </ThemedText>
          <View style={{ width: 60 }} />
        </View>
        <WebView
          ref={webViewRef}
          source={{ html: getStitchHtml() }}
          style={styles.webView}
          onMessage={handleWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText style={{ marginTop: Spacing.md }}>
                Searching the national network...
              </ThemedText>
            </View>
          )}
        />
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ConnectionHealthNotices
          health={connectionHealth.data?.health ?? []}
          onReconnect={handleReconnect}
          reconnectingSource={openingSource}
        />
        {connectionHealth.isError ? (
          <Pressable onPress={() => { void connectionHealth.refetch(); }} accessibilityRole="button">
            <ThemedText style={{ color: theme.textSecondary }}>
              Could not check connection status. Tap to retry.
            </ThemedText>
          </Pressable>
        ) : null}
        {connectError ? (
          <ThemedText style={{ color: theme.error, marginBottom: Spacing.md }}>
            {connectError}
          </ThemedText>
        ) : null}
        {reconnectMessage ? (
          <ThemedText style={{ marginBottom: Spacing.md }}>
            {reconnectMessage}
          </ThemedText>
        ) : null}
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={styles.heroSection}>
            <View style={[styles.heroIconBg, { backgroundColor: theme.primary + "20" }]}>
              <Feather name="zap" size={32} color={theme.primary} />
            </View>
            <ThemedText style={styles.heroTitle}>
              Find My Records
            </ThemedText>
            <ThemedText style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
              Already signed in? We can search the national TEFCA network automatically. No extra logins needed.
            </ThemedText>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <Card style={[styles.tefcaBadge, { borderColor: theme.primary + "30" }]}>
            <View style={styles.tefcaBadgeHeader}>
              <View style={[styles.tefcaDot, { backgroundColor: "#10B981" }]} />
              <ThemedText style={[styles.tefcaBadgeTitle, { color: theme.primary }]}>
                TEFCA Individual Access Services
              </ThemedText>
            </View>
            <ThemedText style={[styles.tefcaBadgeDesc, { color: theme.textSecondary }]}>
              Your verified identity is used once to query {config?.coverageCount?.toLocaleString() || "50,000"}+ hospitals, clinics, and pharmacies. No portal passwords required.
            </ThemedText>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Pressable
            testID="button-auto-discover"
            onPress={handleAutoDiscover}
            disabled={autoDiscoverMutation.isPending}
            style={({ pressed }) => [
              styles.primaryBtn,
              { opacity: pressed || autoDiscoverMutation.isPending ? 0.85 : 1 },
            ]}
          >
            <LinearGradient
              colors={["#10B981", "#059669"] as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtnGradient}
            >
              {autoDiscoverMutation.isPending ? (
                <>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <ThemedText style={styles.primaryBtnText}>
                    Searching TEFCA networks...
                  </ThemedText>
                </>
              ) : (
                <>
                  <Feather name="zap" size={22} color="#FFFFFF" />
                  <ThemedText style={styles.primaryBtnText}>
                    Find My Records Automatically
                  </ThemedText>
                </>
              )}
            </LinearGradient>
          </Pressable>

          {autoDiscoverResult ? (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Card style={[
                styles.resultCard,
                {
                  borderColor: autoDiscoverResult.discovered ? "#10B981" + "40" : theme.textSecondary + "30",
                  backgroundColor: autoDiscoverResult.discovered
                    ? (isDark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.05)")
                    : (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)"),
                },
              ]}>
                <View style={styles.resultRow}>
                  <Feather
                    name={autoDiscoverResult.discovered ? "check-circle" : "info"}
                    size={20}
                    color={autoDiscoverResult.discovered ? "#10B981" : theme.textSecondary}
                  />
                  <ThemedText style={[styles.resultText, { color: theme.text }]}>
                    {autoDiscoverResult.message}
                  </ThemedText>
                </View>
                {autoDiscoverResult.discovered && autoDiscoverResult.networksWithRecords ? (
                  <ThemedText style={[styles.resultDetail, { color: theme.textSecondary }]}>
                    {autoDiscoverResult.importedCount} records from {autoDiscoverResult.networksWithRecords} network{autoDiscoverResult.networksWithRecords > 1 ? "s" : ""} imported to your health record.
                  </ThemedText>
                ) : null}
              </Card>
            </Animated.View>
          ) : null}

          <View style={styles.howItWorksContainer}>
            <ThemedText style={[styles.howItWorksTitle, { color: theme.textSecondary }]}>
              How TEFCA auto-discovery works
            </ThemedText>
            <View style={styles.stepRow}>
              <View style={[styles.stepCircle, { backgroundColor: "#10B981" + "15" }]}>
                <ThemedText style={[styles.stepNumber, { color: "#10B981" }]}>1</ThemedText>
              </View>
              <ThemedText style={[styles.stepText, { color: theme.textSecondary }]}>
                You sign in once with your account
              </ThemedText>
            </View>
            <View style={styles.stepRow}>
              <View style={[styles.stepCircle, { backgroundColor: "#10B981" + "15" }]}>
                <ThemedText style={[styles.stepNumber, { color: "#10B981" }]}>2</ThemedText>
              </View>
              <ThemedText style={[styles.stepText, { color: theme.textSecondary }]}>
                TEFCA queries all networks using your verified identity
              </ThemedText>
            </View>
            <View style={styles.stepRow}>
              <View style={[styles.stepCircle, { backgroundColor: "#10B981" + "15" }]}>
                <ThemedText style={[styles.stepNumber, { color: "#10B981" }]}>3</ThemedText>
              </View>
              <ThemedText style={[styles.stepText, { color: theme.textSecondary }]}>
                Records from all your providers are pulled automatically
              </ThemedText>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: theme.textSecondary + "20" }]} />
            <ThemedText style={[styles.dividerText, { color: theme.textSecondary }]}>
              or connect manually
            </ThemedText>
            <View style={[styles.dividerLine, { backgroundColor: theme.textSecondary + "20" }]} />
          </View>
        </Animated.View>

        {config?.configured ? (
          <Animated.View entering={FadeInDown.duration(400).delay(400)}>
            <Pressable
              testID="button-import-records"
              onPress={handleImportRecords}
              style={({ pressed }) => [
                styles.secondaryBtn,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                  borderColor: theme.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather name="download-cloud" size={20} color={theme.primary} />
              <ThemedText style={[styles.secondaryBtnText, { color: theme.primary }]}>
                Search by Provider
              </ThemedText>
            </Pressable>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.duration(400).delay(500)}>
          <Pressable
            testID="button-open-fasten"
            onPress={handleOpenFasten}
            style={({ pressed }) => [
              styles.secondaryBtn,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                borderColor: theme.textSecondary + "40",
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather name="external-link" size={20} color={theme.textSecondary} />
            <ThemedText style={[styles.secondaryBtnText, { color: theme.textSecondary }]}>
              Open Fasten Health Portal
            </ThemedText>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(400)}>
          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Feather name="shield" size={18} color="#10B981" />
              <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
                HIPAA compliant, SOC 2 readiness in flight. Your data is encrypted end-to-end.
              </ThemedText>
            </View>
            <View style={styles.infoRow}>
              <Feather name="lock" size={18} color="#10B981" />
              <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
                We never store your portal credentials. OAuth2 tokens only.
              </ThemedText>
            </View>
            <View style={styles.infoRow}>
              <Feather name="refresh-cw" size={18} color="#10B981" />
              <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
                Records sync automatically and stay up to date.
              </ThemedText>
            </View>
            <View style={styles.infoRow}>
              <Feather name="globe" size={18} color="#10B981" />
              <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
                Available in 52 languages. Your records, your language.
              </ThemedText>
            </View>
          </Card>
        </Animated.View>
      </ScrollView>
      <UpgradePrompt {...promptProps} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  heroIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  heroSubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  tefcaBadge: {
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  tefcaBadgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  tefcaDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tefcaBadgeTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  tefcaBadgeDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  primaryBtn: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    shadowColor: "#0066CC",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnGradient: {
    height: 56,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  howItWorksContainer: {
    marginBottom: Spacing.lg,
  },
  howItWorksTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumber: {
    fontSize: 13,
    fontWeight: "700",
  },
  stepText: {
    fontSize: 14,
    flex: 1,
  },
  resultCard: {
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  resultText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 21,
  },
  resultDetail: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: Spacing.xs,
    marginLeft: 28,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: "500",
  },
  secondaryBtn: {
    height: 50,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderWidth: 1.5,
    marginBottom: Spacing.lg,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  infoCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
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
  webViewContainer: {
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
  webIframeContainer: {
    flex: 1,
  },
});
