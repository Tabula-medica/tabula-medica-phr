import { useEffect } from "react";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../hooks/useAuth";
import { ActivityIndicator, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import LoginScreen from "../screens/LoginScreen";
import VerifyEmailScreen from "../screens/VerifyEmailScreen";
import OnboardingScreen from "../screens/OnboardingScreen";
import DashboardScreen from "../screens/DashboardScreen";
import RecordsTimelineScreen from "../screens/RecordsTimelineScreen";
import LabsScreen from "../screens/LabsScreen";
import MedicationsScreen from "../screens/MedicationsScreen";
import PacketExportScreen from "../screens/PacketExportScreen";
import ShareQRScreen from "../screens/ShareQRScreen";
import SettingsScreen from "../screens/SettingsScreen";
import AIAssistantScreen from "../screens/AIAssistantScreen";
import EHRConnectionScreen from "../screens/EHRConnectionScreen";
import ConnectDoctorScreen from "../screens/ConnectDoctorScreen";
import PrivacyMenuScreen from "../screens/PrivacyMenuScreen";
import MyAuditTrailScreen from "../screens/MyAuditTrailScreen";
import CcpaScreen from "../screens/CcpaScreen";
import GdprScreen from "../screens/GdprScreen";
import SymptomCheckerScreen from "../screens/SymptomCheckerScreen";

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

export type VerifyEmailStackParamList = {
  VerifyEmail: undefined;
};

export type OnboardingStackParamList = {
  Onboarding: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  RecordsTimeline: undefined;
  Labs: undefined;
  Medications: undefined;
  PacketExport: undefined;
  ShareQR: undefined;
  Settings: undefined;
  EHRConnection: undefined;
  ConnectDoctor: undefined;
  PrivacyMenu: undefined;
  MyAuditTrail: undefined;
  CcpaScreen: undefined;
  GdprScreen: undefined;
  SymptomChecker: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Records: undefined;
  AIAssistant: undefined;
  More: undefined;
};

const RootStack = createNativeStackNavigator<
  RootStackParamList & { VerifyEmail: undefined; Onboarding: undefined }
>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const VerifyEmailStack = createNativeStackNavigator<VerifyEmailStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

function VerifyEmailNavigator() {
  return (
    <VerifyEmailStack.Navigator screenOptions={{ headerShown: false }}>
      <VerifyEmailStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
    </VerifyEmailStack.Navigator>
  );
}

function OnboardingNavigator() {
  return (
    <OnboardingStack.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStack.Screen name="Onboarding" component={OnboardingScreen} />
    </OnboardingStack.Navigator>
  );
}

function TabNavigator() {
  return (
    <MainTab.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: "#0F766E" },
        headerTintColor: "#fff",
        tabBarActiveTintColor: "#0F766E",
        tabBarInactiveTintColor: "#6B7280",
        tabBarStyle: { paddingBottom: 8, height: 60 },
      }}
    >
      <MainTab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: "Tabula Medica",
          tabBarLabel: "Home",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <Feather name="home" size={size} color={color} />,
        }}
      />
      <MainTab.Screen
        name="Records"
        component={RecordsTimelineScreen}
        options={{
          title: "Health Timeline",
          tabBarLabel: "Timeline",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <Feather name="clock" size={size} color={color} />,
        }}
      />
      <MainTab.Screen
        name="AIAssistant"
        component={AIAssistantScreen}
        options={{
          title: "AI Assistant",
          tabBarLabel: "AI",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <Feather name="message-circle" size={size} color={color} />,
        }}
      />
      <MainTab.Screen
        name="More"
        component={SettingsScreen}
        options={{
          title: "Settings",
          tabBarLabel: "More",
          tabBarIcon: ({ color, size }: { color: string; size: number }) => <Feather name="menu" size={size} color={color} />,
        }}
      />
    </MainTab.Navigator>
  );
}

const navigationRef = createNavigationContainerRef<
  RootStackParamList & MainStackParamList & { VerifyEmail: undefined; Onboarding: undefined }
>();

function MainNavigator() {
  return (
    <MainStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#0F766E" },
        headerTintColor: "#fff",
        headerBackTitle: "Back",
      }}
    >
      <MainStack.Screen
        name="MainTabs"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <MainStack.Screen
        name="RecordsTimeline"
        component={RecordsTimelineScreen}
        options={{ title: "Health Timeline" }}
      />
      <MainStack.Screen
        name="Labs"
        component={LabsScreen}
        options={{ title: "Lab Results" }}
      />
      <MainStack.Screen
        name="Medications"
        component={MedicationsScreen}
        options={{ title: "Medications" }}
      />
      <MainStack.Screen
        name="PacketExport"
        component={PacketExportScreen}
        options={{ title: "Export PDF" }}
      />
      <MainStack.Screen
        name="ShareQR"
        component={ShareQRScreen}
        options={{ title: "Share Records" }}
      />
      <MainStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />
      <MainStack.Screen
        name="EHRConnection"
        component={EHRConnectionScreen}
        options={{ title: "Connect Health Records" }}
      />
      <MainStack.Screen
        name="ConnectDoctor"
        component={ConnectDoctorScreen}
        options={{ title: "Find a Doctor" }}
      />
      <MainStack.Screen
        name="PrivacyMenu"
        component={PrivacyMenuScreen}
        options={{ title: "Privacy & Compliance" }}
      />
      <MainStack.Screen
        name="MyAuditTrail"
        component={MyAuditTrailScreen}
        options={{ title: "My Audit Trail" }}
      />
      <MainStack.Screen
        name="CcpaScreen"
        component={CcpaScreen}
        options={{ title: "California Privacy" }}
      />
      <MainStack.Screen
        name="GdprScreen"
        component={GdprScreen}
        options={{ title: "EU/UK Privacy (GDPR)" }}
      />
      <MainStack.Screen
        name="SymptomChecker"
        component={SymptomCheckerScreen}
        options={{ title: "Symptom Checker" }}
      />
    </MainStack.Navigator>
  );
}

export default function AppNavigator() {
  const {
    isLoading,
    isLoggedIn,
    isEmailVerified,
    needsOnboarding,
    isOnboardingResolved,
    pendingPostOnboardingRoute,
    setPendingPostOnboardingRoute,
  } = useAuth();

  // When the user finishes onboarding having chosen "connect a doctor",
  // the Main stack mounts and we navigate straight to ConnectDoctor on top
  // of the dashboard. We consume the flag so it only fires once.
  const inMain = isLoggedIn && isEmailVerified && !needsOnboarding;
  useEffect(() => {
    if (!inMain || !pendingPostOnboardingRoute) return;
    const target = pendingPostOnboardingRoute;
    let cancelled = false;
    const tryNavigate = () => {
      if (cancelled) return;
      if (navigationRef.isReady()) {
        navigationRef.navigate(target as never);
        setPendingPostOnboardingRoute(null);
      } else {
        setTimeout(tryNavigate, 50);
      }
    };
    tryNavigate();
    return () => {
      cancelled = true;
    };
  }, [inMain, pendingPostOnboardingRoute, setPendingPostOnboardingRoute]);

  // For verified users, hold on a splash until we know whether onboarding
  // is required, so we never flash the main tabs before swapping to the
  // welcome screen. Login/Google/Apple paths set this synchronously; for
  // restored sessions the useAuth effect resolves it (with bounded retries).
  const awaitingOnboardingDecision =
    isLoggedIn && isEmailVerified && !isOnboardingResolved;

  if (isLoading || awaitingOnboardingDecision) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0F766E" }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!isLoggedIn ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        ) : !isEmailVerified ? (
          <RootStack.Screen name="VerifyEmail" component={VerifyEmailNavigator} />
        ) : needsOnboarding ? (
          <RootStack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <RootStack.Screen name="Main" component={MainNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
