import React, { useState, useEffect, useRef } from "react";
import { ActivityIndicator, View, StyleSheet, Image } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";

import MainTabNavigator from "@/navigation/MainTabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import AdminLoginScreen from "@/screens/AdminLoginScreen";
import AdminDashboardScreen from "@/screens/AdminDashboardScreen";
import WelcomeLandingScreen from "@/screens/WelcomeLandingScreen";
import OnboardingTutorialScreen from "@/screens/OnboardingTutorialScreen";
import OnboardingIntakeScreen from "@/screens/OnboardingIntakeScreen";
import RecordDetailScreen from "@/screens/RecordDetailScreen";
import CategoryRecordsScreen from "@/screens/CategoryRecordsScreen";
import AddSourceScreen from "@/screens/AddSourceScreen";
import SourceDetailScreen from "@/screens/SourceDetailScreen";
import VideoConsultationScreen from "@/screens/VideoConsultationScreen";
import AIAssistantScreen from "@/screens/AIAssistantScreen";
import ProviderShareSummaryScreen from "@/screens/ProviderShareSummaryScreen";
import PreVisitChartPrepScreen from "@/screens/PreVisitChartPrepScreen";
import OnboardingProviderScreen from "@/screens/OnboardingProviderScreen";
import { ThemedText } from "@/components/ThemedText";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuthContext } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { HealthRecord, DataSource, RecordType } from "@/lib/storage";

const WELCOME_KEY = "@tabula_medica_onboarding_complete";
const INTAKE_KEY = "@tabula_medica_intake_complete";
const TUTORIAL_KEY = "@tabula_medica_tutorial_seen";
const LOADING_TIMEOUT_MS = 6000;

export type RootStackParamList = {
  Login: undefined;
  AdminLogin: undefined;
  AdminDashboard: { token: string; providerName: string };
  Main: undefined;
  RecordDetail: { record: HealthRecord };
  CategoryRecords: { category: string; type: RecordType; records: HealthRecord[] };
  AddSource: undefined;
  SourceDetail: { source: DataSource };
  VideoConsultation: { visitId: string };
  AIAssistant: undefined;
  ProviderShareSummary: undefined;
  PreVisitChartPrep: undefined;
  OnboardingProvider: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAuthenticated, isLoading } = useAuthContext();
  const { theme } = useTheme();
  const [hasCompletedWelcome, setHasCompletedWelcome] = useState<boolean | null>(null);
  const [hasCompletedIntake, setHasCompletedIntake] = useState<boolean | null>(null);
  const [hasSeenTutorial, setHasSeenTutorial] = useState<boolean | null>(null);
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  useEffect(() => {
    if (isLoading) {
      setLoadingTimedOut(false);
      loadingTimerRef.current = setTimeout(() => {
        setLoadingTimedOut(true);
      }, LOADING_TIMEOUT_MS);
    }
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
    };
  }, [isLoading]);

  const checkOnboardingStatus = async () => {
    try {
      const [welcome, intake, tutorial] = await Promise.all([
        AsyncStorage.getItem(WELCOME_KEY),
        AsyncStorage.getItem(INTAKE_KEY),
        AsyncStorage.getItem(TUTORIAL_KEY),
      ]);
      setHasCompletedWelcome(welcome === "true");
      setHasCompletedIntake(intake === "true");
      setHasSeenTutorial(tutorial === "true");
    } catch {
      setHasCompletedWelcome(false);
      setHasCompletedIntake(false);
      setHasSeenTutorial(false);
    }
  };

  const handleWelcomeComplete = async () => {
    await AsyncStorage.setItem(WELCOME_KEY, "true");
    setHasCompletedWelcome(true);
  };

  const handleIntakeComplete = async () => {
    await AsyncStorage.setItem(INTAKE_KEY, "true");
    setHasCompletedIntake(true);
  };

  const handleTutorialComplete = async () => {
    await AsyncStorage.setItem(TUTORIAL_KEY, "true");
    setHasSeenTutorial(true);
  };

  const stillInitializing =
    (isLoading && !loadingTimedOut) ||
    hasCompletedWelcome === null ||
    hasCompletedIntake === null ||
    hasSeenTutorial === null;

  if (stillInitializing) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.backgroundRoot }]}>
        <Image
          source={require("../../assets/images/icon.png")}
          style={styles.splashIcon}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 24 }} />
        <ThemedText type="caption" style={[styles.loadingText, { color: theme.textSecondary }]}>
          Preparing your records...
        </ThemedText>
      </View>
    );
  }

  if (isAuthenticated && !hasSeenTutorial) {
    return (
      <OnboardingTutorialScreen
        onComplete={handleTutorialComplete}
        onSkip={handleTutorialComplete}
      />
    );
  }

  if (isAuthenticated && !hasCompletedWelcome) {
    return (
      <WelcomeLandingScreen
        onComplete={handleWelcomeComplete}
        onSkip={handleWelcomeComplete}
      />
    );
  }

  if (isAuthenticated && !hasCompletedIntake) {
    return (
      <OnboardingIntakeScreen
        onComplete={handleIntakeComplete}
        onSkip={handleIntakeComplete}
      />
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!isAuthenticated ? (
        <>
          {/* Login is first so it is the initial route when unauthenticated */}
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          {/* Admin portal reachable from the Login screen "Admin Portal" link */}
          <Stack.Screen name="AdminLogin" component={AdminLoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ headerShown: false }} />
        </>
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="RecordDetail"
            component={RecordDetailScreen}
            options={{
              presentation: "modal",
              headerTitle: "Record Details",
            }}
          />
          <Stack.Screen
            name="CategoryRecords"
            component={CategoryRecordsScreen}
            options={({ route }) => ({
              headerTitle: route.params.category,
            })}
          />
          <Stack.Screen
            name="AddSource"
            component={AddSourceScreen}
            options={{
              presentation: "modal",
              headerTitle: "Add Source",
            }}
          />
          <Stack.Screen
            name="SourceDetail"
            component={SourceDetailScreen}
            options={({ route }) => ({
              headerTitle: route.params.source.name,
            })}
          />
          <Stack.Screen
            name="AIAssistant"
            component={AIAssistantScreen}
            options={{
              headerTitle: "Health Assistant",
            }}
          />
          <Stack.Screen
            name="ProviderShareSummary"
            component={ProviderShareSummaryScreen}
            options={{
              headerTitle: "Share with Provider",
            }}
          />
          <Stack.Screen
            name="VideoConsultation"
            component={VideoConsultationScreen}
            options={{
              headerShown: false,
              presentation: "fullScreenModal",
            }}
          />
          <Stack.Screen
            name="PreVisitChartPrep"
            component={PreVisitChartPrepScreen}
            options={{ headerTitle: "Pre-Visit Chart Prep" }}
          />
          <Stack.Screen
            name="OnboardingProvider"
            component={OnboardingProviderScreen}
            options={{ headerTitle: "Provider Onboarding" }}
          />
          {/* Admin portal also reachable from within an authenticated session */}
          <Stack.Screen name="AdminLogin" component={AdminLoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ headerShown: false }} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  splashIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
});
