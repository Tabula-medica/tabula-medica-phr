import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import WebView from "react-native-webview";
import type { WebViewNavigation } from "react-native-webview";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { storage, generateMockRecords, type DataSource } from "@/lib/storage";
import { api } from "@/lib/api";
import {
  searchEpicHospitals,
  buildAuthorizeUrl,
  extractCodeFromUrl,
  isCallbackUrl,
  exchangeCodeOnServer,
  EpicSearchResult,
  SmartAuthSession,
} from "@/lib/fhir-auth";
import { apiRequest } from "@/lib/query-client";

const QUICK_CONNECT_PROVIDERS = [
  { id: "quest", name: "Quest Diagnostics", type: "lab" as const },
  { id: "labcorp", name: "Labcorp", type: "lab" as const },
  { id: "cvs", name: "CVS Pharmacy", type: "pharmacy" as const },
  { id: "walgreens", name: "Walgreens", type: "pharmacy" as const },
];

const SOURCE_TYPE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  hospital: "home",
  health_system: "home",
  clinic: "briefcase",
  pharmacy: "package",
  lab: "activity",
  insurance: "shield",
  tefca: "globe",
};

function HospitalResultCard({
  result,
  onPress,
  isConnecting,
  theme,
}: {
  result: EpicSearchResult;
  onPress: () => void;
  isConnecting: boolean;
  theme: typeof Colors.light;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(200)}>
      <Pressable
        onPress={onPress}
        disabled={isConnecting || result.isConfigured}
        style={({ pressed }) => [
          styles.providerCard,
          {
            backgroundColor: theme.backgroundDefault,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        testID={`hospital-result-${result.id}`}
      >
        <View
          style={[styles.providerIcon, { backgroundColor: `${theme.primary}15` }]}
        >
          <Feather name="home" size={20} color={theme.primary} />
        </View>
        <View style={styles.providerContent}>
          <ThemedText type="h4" numberOfLines={2}>{result.name}</ThemedText>
          <ThemedText type="caption" style={{ color: theme.textSecondary }} numberOfLines={1}>
            Epic MyChart
          </ThemedText>
        </View>
        {isConnecting ? (
          <ActivityIndicator color={theme.primary} size="small" />
        ) : result.isConfigured ? (
          <View style={[styles.connectedBadge, { backgroundColor: `${theme.success}20` }]}>
            <Feather name="check" size={14} color={theme.success} />
          </View>
        ) : (
          <Feather name="log-in" size={22} color={theme.primary} />
        )}
      </Pressable>
    </Animated.View>
  );
}

export default function AddSourceScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<any>();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<EpicSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [authSession, setAuthSession] = useState<SmartAuthSession | null>(null);
  const [showLoginWebView, setShowLoginWebView] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [selectedHospital, setSelectedHospital] = useState<EpicSearchResult | null>(null);
  const codeIntercepted = useRef(false);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await searchEpicHospitals(searchQuery);
        setSearchResults(results);
        setHasSearched(true);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery]);

  const handleStartLogin = useCallback(async (result: EpicSearchResult) => {
    setIsConnecting(true);
    setConnectingId(result.id);
    setSelectedHospital(result);
    codeIntercepted.current = false;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const session = await buildAuthorizeUrl(result);
      setAuthSession(session);
      setWebViewLoading(true);
      setShowLoginWebView(true);
    } catch (error: any) {
      console.error("[AddSource] Failed to build auth URL:", error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Unable to connect to this hospital. Please try again.", [{ text: "OK" }]);
      setIsConnecting(false);
      setConnectingId(null);
      setSelectedHospital(null);
    }
  }, []);

  const handleWebViewNavigationChange = useCallback(async (navState: WebViewNavigation) => {
    const { url } = navState;
    if (!url || codeIntercepted.current) return;

    if (isCallbackUrl(url)) {
      codeIntercepted.current = true;
      setShowLoginWebView(false);

      const extracted = extractCodeFromUrl(url);
      if (extracted && selectedHospital && authSession) {
        try {
          await exchangeCodeOnServer(
            authSession.organizationId,
            extracted.code
          );

          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            "Connected",
            `Successfully connected to ${selectedHospital.name}. Your health records are syncing now.`,
            [{ text: "View Records", onPress: () => navigation.goBack() }]
          );
        } catch (error: any) {
          console.error("[AddSource] Token exchange error:", error);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(
            "Connection Failed",
            error?.message || "Could not complete the connection. Please try again.",
            [{ text: "OK" }]
          );
        }
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Connection Failed", "No authorization code received from the hospital.", [{ text: "OK" }]);
      }

      setIsConnecting(false);
      setConnectingId(null);
      setSelectedHospital(null);
      setAuthSession(null);
    }
  }, [selectedHospital, authSession, navigation]);

  const handleCloseWebView = useCallback(() => {
    setShowLoginWebView(false);
    setIsConnecting(false);
    setConnectingId(null);
    setSelectedHospital(null);
    setAuthSession(null);
    codeIntercepted.current = false;
  }, []);

  const handleTefcaConnect = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsConnecting(true);
    try {
      const demoPatient = {
        firstName: "Demo",
        lastName: "User",
        dateOfBirth: "1985-03-15",
        zipCode: "90210",
      };
      const result = await api.tefca.queryPatient({
        patient: demoPatient,
        exchangePurpose: "T-IAS",
      });
      if (result.results.length > 0 && result.totalRecords > 0) {
        const firstResult = result.results[0];
        const importResult = await api.tefca.importRecords({
          queryResults: firstResult,
          networkName: firstResult.networkName,
        });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "Records Imported",
          `Successfully imported ${importResult.importedCount} records from ${firstResult.networkName}.`,
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert("No Records Found", "No health records were found in the national exchange.", [{ text: "OK" }]);
      }
    } catch {
      Alert.alert("Connection Error", "Unable to connect to the health exchange. Please try again later.", [{ text: "OK" }]);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleQuickConnect = async (provider: typeof QUICK_CONNECT_PROVIDERS[0]) => {
    setIsConnecting(true);
    setConnectingId(provider.id);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const newSource: DataSource = {
      id: `source-${Date.now()}`,
      name: provider.name,
      type: provider.type,
      fhirEndpoint: "",
      connected: true,
      lastSync: new Date().toISOString(),
      recordCount: Math.floor(Math.random() * 20) + 5,
    };
    await storage.addDataSource(newSource);
    const existingRecords = await storage.getHealthRecords();
    if (existingRecords.length === 0) {
      await storage.setHealthRecords(generateMockRecords());
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsConnecting(false);
    setConnectingId(null);
    navigation.goBack();
  };

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <ThemedText type="h2" style={styles.title}>
          Connect Your Hospital
        </ThemedText>
        <ThemedText
          type="body"
          style={[styles.subtitle, { color: theme.textSecondary }]}
        >
          Search from thousands of Epic-connected hospitals to securely access your health records via MyChart
        </ThemedText>

        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: isSearching ? theme.primary : theme.border,
            },
          ]}
        >
          {isSearching ? (
            <ActivityIndicator color={theme.primary} size="small" />
          ) : (
            <Feather name="search" size={20} color={theme.textSecondary} />
          )}
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search hospitals (e.g. Inova, UVA, Mayo)..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            testID="hospital-search-input"
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery("")} testID="clear-search">
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.infoCard}>
          <Feather name="shield" size={20} color={theme.primary} />
          <View style={styles.infoContent}>
            <ThemedText type="small" style={{ color: theme.text }}>
              HIPAA Secure SMART on FHIR Connection
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              You'll sign in directly with your hospital's MyChart. We never see your password.
            </ThemedText>
          </View>
        </View>

        {searchResults.length > 0 ? (
          <>
            <ThemedText
              type="caption"
              style={[styles.sectionLabel, { color: theme.textSecondary }]}
            >
              HOSPITALS FOUND ({searchResults.length})
            </ThemedText>
            <View style={styles.providersList}>
              {searchResults.map((result) => (
                <HospitalResultCard
                  key={result.id + result.fhirBaseUrl}
                  result={result}
                  onPress={() => handleStartLogin(result)}
                  isConnecting={connectingId === result.id && isConnecting}
                  theme={theme}
                />
              ))}
            </View>
          </>
        ) : hasSearched && !isSearching ? (
          <View style={styles.noResults}>
            <Feather name="search" size={32} color={theme.textSecondary} />
            <ThemedText
              type="body"
              style={[styles.noResultsText, { color: theme.textSecondary }]}
            >
              No hospitals found for "{searchQuery}"
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center" }}>
              Try a different name or check the spelling
            </ThemedText>
          </View>
        ) : null}

        <ThemedText
          type="caption"
          style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: Spacing.xl }]}
        >
          NATIONAL HEALTH EXCHANGE
        </ThemedText>

        <Pressable
          onPress={handleTefcaConnect}
          disabled={isConnecting}
          style={({ pressed }) => [
            styles.tefcaCard,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.primary,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          testID="tefca-connect"
        >
          <View style={[styles.tefcaIcon, { backgroundColor: `${theme.primary}15` }]}>
            <Feather name="globe" size={24} color={theme.primary} />
          </View>
          <View style={styles.providerContent}>
            <ThemedText type="h4">TEFCA Health Exchange</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Query records from 600+ hospitals nationwide
            </ThemedText>
            <View style={styles.tefcaBadges}>
              <View style={[styles.badge, { backgroundColor: `${theme.success}20` }]}>
                <ThemedText type="caption" style={{ color: theme.success }}>Epic</ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: `${theme.success}20` }]}>
                <ThemedText type="caption" style={{ color: theme.success }}>Cerner</ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: `${theme.success}20` }]}>
                <ThemedText type="caption" style={{ color: theme.success }}>Carequality</ThemedText>
              </View>
            </View>
          </View>
          <Feather name="chevron-right" size={24} color={theme.primary} />
        </Pressable>

        <ThemedText
          type="caption"
          style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: Spacing.xl }]}
        >
          LABS & PHARMACIES
        </ThemedText>

        <View style={styles.providersList}>
          {QUICK_CONNECT_PROVIDERS.map((provider) => (
            <View key={provider.id}>
              {connectingId === provider.id && isConnecting ? (
                <View
                  style={[
                    styles.providerCard,
                    styles.connectingCard,
                    { backgroundColor: theme.backgroundDefault },
                  ]}
                >
                  <ActivityIndicator color={theme.primary} />
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>
                    Connecting to {provider.name}...
                  </ThemedText>
                </View>
              ) : (
                <Pressable
                  onPress={() => handleQuickConnect(provider)}
                  style={({ pressed }) => [
                    styles.providerCard,
                    {
                      backgroundColor: theme.backgroundDefault,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <View
                    style={[styles.providerIcon, { backgroundColor: `${theme.primary}15` }]}
                  >
                    <Feather
                      name={SOURCE_TYPE_ICONS[provider.type] || "database"}
                      size={20}
                      color={theme.primary}
                    />
                  </View>
                  <View style={styles.providerContent}>
                    <ThemedText type="h4">{provider.name}</ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {provider.type.charAt(0).toUpperCase() + provider.type.slice(1)}
                    </ThemedText>
                  </View>
                  <Feather name="plus-circle" size={24} color={theme.primary} />
                </Pressable>
              )}
            </View>
          ))}
        </View>

        <View
          style={[styles.helpCard, { backgroundColor: theme.backgroundSecondary }]}
        >
          <Feather name="help-circle" size={20} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary, flex: 1 }}>
            Don't see your hospital? Search above — we support thousands of Epic-connected facilities across the US.
          </ThemedText>
        </View>
      </ScrollView>

      <Modal
        visible={showLoginWebView}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseWebView}
      >
        <View style={[styles.webViewContainer, { backgroundColor: isDark ? "#1a1a2e" : "#fff" }]}>
          <View
            style={[
              styles.webViewHeader,
              {
                backgroundColor: isDark ? "#1a1a2e" : "#fff",
                borderBottomColor: theme.border,
                paddingTop: Platform.OS === "web" ? 67 : insets.top,
              },
            ]}
          >
            <Pressable onPress={handleCloseWebView} style={styles.webViewCloseBtn} testID="close-webview" accessibilityRole="button" accessibilityLabel="Close web view">
              <Feather name="x" size={22} color={theme.text} />
            </Pressable>
            <View style={styles.webViewTitleContainer}>
              <Feather name="lock" size={14} color={theme.success} />
              <ThemedText type="body" style={{ fontWeight: "600" as const, color: theme.text }} numberOfLines={1}>
                {selectedHospital?.name || "Hospital Login"}
              </ThemedText>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {webViewLoading ? (
            <View style={styles.webViewLoader}>
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                Loading hospital login...
              </ThemedText>
            </View>
          ) : null}

          {authSession ? (
            <WebView
              source={{ uri: authSession.authorizeUrl }}
              onNavigationStateChange={handleWebViewNavigationChange}
              onLoadStart={() => setWebViewLoading(true)}
              onLoadEnd={() => setWebViewLoading(false)}
              onError={() => {
                setWebViewLoading(false);
                Alert.alert("Error", "Could not load the hospital login page. Please try again.", [
                  { text: "OK", onPress: handleCloseWebView },
                ]);
              }}
              style={[styles.webView, webViewLoading ? styles.webViewHidden : null]}
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
              incognito={false}
              userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
              testID="hospital-login-webview"
            />
          ) : null}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  infoContent: {
    flex: 1,
    gap: 2,
  },
  sectionLabel: {
    marginBottom: Spacing.md,
    marginLeft: Spacing.xs,
  },
  providersList: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  providerCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  connectingCard: {
    justifyContent: "center",
  },
  providerIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  providerContent: {
    flex: 1,
    gap: 2,
  },
  connectedBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  noResults: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  noResultsText: {
    textAlign: "center",
  },
  helpCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  tefcaCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  tefcaIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  tefcaBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  webViewContainer: {
    flex: 1,
  },
  webViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  webViewCloseBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  webViewTitleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  webView: {
    flex: 1,
  },
  webViewHidden: {
    opacity: 0,
    height: 0,
  },
  webViewLoader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
});
