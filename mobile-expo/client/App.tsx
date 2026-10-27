import React, { useEffect, useState, useCallback, useRef } from "react";
import { StyleSheet, View, Pressable, Platform } from "react-native";
import { setupWebLiveRegion, setupFocusIndicators } from "@/lib/accessibility";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuthContext } from "@/context/AuthContext";
import { AccessibilityProvider } from "@/context/AccessibilityContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { SecurityProvider, useSecurityContext } from "@/context/SecurityContext";
import { AIConsentProvider } from "@/context/AIConsentContext";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import BiometricGateScreen from "@/screens/BiometricGateScreen";
import { ActivityTracker } from "@/components/ActivityTracker";
import {
  initializeRevenueCat,
  SubscriptionProvider,
} from "@/lib/revenuecat";
import { ServerFeatureGateListener } from "@/components/ServerFeatureGateListener";

try {
  initializeRevenueCat();
} catch (err: any) {
  console.warn("[RevenueCat] Init failed:", err?.message ?? "Unknown error");
}
import { CommandPalette, useCommandPaletteShortcut } from "@/components/CommandPalette";
import { useTheme } from "@/hooks/useTheme";
import { initSentry } from "@/lib/sentry";
import { useScreenCaptureProtection } from "@/hooks/useScreenCaptureProtection";

try {
  initSentry();
} catch (err: any) {
  console.warn("[Sentry] Init failed:", err?.message ?? "Unknown error");
}

export const navigationRef = createNavigationContainerRef<any>();

function CommandPaletteFAB() {
  const [visible, setVisible] = useState(false);
  const { theme: colors } = useTheme();
  const insets = useSafeAreaInsets();
  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  useCommandPaletteShortcut(open);

  return (
    <>
      <Pressable
        testID="cmd-palette-fab"
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 90 }]}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel="Open command palette"
        accessibilityHint={Platform.OS === "web" ? "Or press Cmd+K" : undefined}
      >
        <Feather name="command" size={22} color="#FFFFFF" />
      </Pressable>
      <CommandPalette visible={visible} onClose={close} navigationRef={navigationRef} />
    </>
  );
}

function SecureAppContent() {
  const { isUnlocked, isCheckingAuth } = useSecurityContext();
  const { isAuthenticated } = useAuthContext();

  // Audit H-9: block screenshots / screen recording for the entire
  // authenticated app surface. Unauthenticated screens (login,
  // landing) deliberately skip this so users can capture support
  // info on the public surface.
  useScreenCaptureProtection(isAuthenticated && isUnlocked);

  if (isCheckingAuth) {
    return null;
  }

  // The biometric lock ONLY protects an already-authenticated session
  // (engaged on inactivity/background timeout). It must never gate the
  // unauthenticated surface — gating the login screen behind a device
  // biometric prompt on launch caused an "error displayed on launch"
  // App Review rejection (Guideline 2.1) because the reviewer could not
  // satisfy the biometric and was blocked before reaching the demo login.
  if (isAuthenticated && !isUnlocked) {
    return <BiometricGateScreen />;
  }

  return (
    <ActivityTracker>
      <View style={styles.root}>
        <DemoModeBanner />
        <View style={styles.content}>
          <NavigationContainer ref={navigationRef}>
            <RootStackNavigator />
          </NavigationContainer>
          <CommandPaletteFAB />
        </View>
      </View>
    </ActivityTracker>
  );
}

export default function App() {
  useEffect(() => {
    setupWebLiveRegion();
    setupFocusIndicators();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.root}>
            <KeyboardProvider>
              <AuthProvider>
                <LanguageProvider>
                  <AccessibilityProvider>
                    <SecurityProvider>
                      <AIConsentProvider>
                        <SubscriptionProvider>
                          <SecureAppContent />
                          <ServerFeatureGateListener />
                        </SubscriptionProvider>
                      </AIConsentProvider>
                    </SecurityProvider>
                  </AccessibilityProvider>
                </LanguageProvider>
              </AuthProvider>
              <StatusBar style="auto" />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  fab: {
    position: "absolute",
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    zIndex: 999,
  },
});
