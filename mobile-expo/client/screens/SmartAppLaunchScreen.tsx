import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { apiRequest } from "@/lib/query-client";
import { Card } from "@/components/Card";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

interface SmartApp {
  id: string;
  name: string;
  clientId: string;
  redirectUri: string;
  scopes: string[];
  launchUrl?: string;
  description?: string;
  isActive: boolean;
}

interface LaunchResponse {
  authorizationUrl: string;
  state: string;
  pkce: {
    codeVerifier: string;
    codeChallenge: string;
    codeChallengeMethod: string;
  };
}

type RouteParams = {
  SmartAppLaunch: {
    appId: string;
  };
};

export default function SmartAppLaunchScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, "SmartAppLaunch">>();
  const queryClient = useQueryClient();

  const [launchState, setLaunchState] = useState<"preparing" | "ready" | "launching" | "success" | "error">("preparing");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const appId = route.params.appId;

  const { data: app, isLoading: appLoading } = useQuery<SmartApp>({
    queryKey: ["/api/smart-apps", appId],
  });

  const launchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/smart-apps/${appId}/launch`);
      return res.json() as Promise<LaunchResponse>;
    },
    onSuccess: async (data) => {
      setLaunchState("launching");
      try {
        if (app?.launchUrl) {
          const launchUrlWithParams = new URL(app.launchUrl);
          launchUrlWithParams.searchParams.set("iss", "https://api.tabulamedica.health/fhir");
          launchUrlWithParams.searchParams.set("launch", data.state);
          
          await WebBrowser.openBrowserAsync(launchUrlWithParams.toString(), {
            dismissButtonStyle: "close",
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
          });
        } else {
          await WebBrowser.openBrowserAsync(data.authorizationUrl, {
            dismissButtonStyle: "close",
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
          });
        }
        
        setLaunchState("success");
        
        queryClient.invalidateQueries({ queryKey: ["/api/smart-apps"] });
        queryClient.invalidateQueries({ queryKey: ["/api/smart-apps", appId] });
        queryClient.invalidateQueries({ queryKey: [`/api/smart-apps/${appId}/access-logs`] });
      } catch (error) {
        console.error("Launch error:", error);
        setLaunchState("error");
        setErrorMessage("Failed to open the app. Please try again.");
      }
    },
    onError: (error: any) => {
      setLaunchState("error");
      setErrorMessage(error.message || "Failed to prepare app launch");
    },
  });

  useEffect(() => {
    if (app && !appLoading) {
      setLaunchState("ready");
    }
  }, [app, appLoading]);

  const handleLaunch = () => {
    setLaunchState("preparing");
    launchMutation.mutate();
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  const renderContent = () => {
    if (appLoading) {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.md }]}>
            Loading app information...
          </Text>
        </View>
      );
    }

    if (!app) {
      return (
        <View style={styles.centerContent}>
          <Feather name="alert-circle" size={48} color={theme.error} />
          <Text style={[Typography.h3, { color: theme.text, marginTop: Spacing.md }]}>App Not Found</Text>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleGoBack}
          >
            <Text style={[Typography.body, { color: "#FFFFFF" }]}>Go Back</Text>
          </Pressable>
        </View>
      );
    }

    if (launchState === "error") {
      return (
        <View style={styles.centerContent}>
          <View style={[styles.iconCircle, { backgroundColor: theme.error + "20" }]}>
            <Feather name="x-circle" size={48} color={theme.error} />
          </View>
          <Text style={[Typography.h3, { color: theme.text, marginTop: Spacing.lg }]}>Launch Failed</Text>
          <Text style={[Typography.body, { color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }]}>
            {errorMessage}
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.secondaryButton,
                { borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleGoBack}
            >
              <Text style={[Typography.body, { color: theme.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleLaunch}
            >
              <Feather name="refresh-cw" size={18} color="#FFFFFF" />
              <Text style={[Typography.body, { color: "#FFFFFF" }]}>Retry</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (launchState === "success") {
      return (
        <View style={styles.centerContent}>
          <View style={[styles.iconCircle, { backgroundColor: theme.success + "20" }]}>
            <Feather name="check-circle" size={48} color={theme.success} />
          </View>
          <Text style={[Typography.h3, { color: theme.text, marginTop: Spacing.lg }]}>App Launched</Text>
          <Text style={[Typography.body, { color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }]}>
            {app.name} has been launched successfully
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1, marginTop: Spacing.xl },
            ]}
            onPress={handleGoBack}
          >
            <Text style={[Typography.body, { color: "#FFFFFF" }]}>Done</Text>
          </Pressable>
        </View>
      );
    }

    if (launchState === "launching" || launchState === "preparing") {
      return (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[Typography.h3, { color: theme.text, marginTop: Spacing.lg }]}>
            {launchState === "preparing" ? "Preparing Launch..." : "Launching App..."}
          </Text>
          <Text style={[Typography.body, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
            {launchState === "preparing" 
              ? "Setting up secure connection"
              : "Opening in browser"}
          </Text>
        </View>
      );
    }

    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Card style={styles.launchCard}>
          <View style={[styles.appIcon, { backgroundColor: theme.primary + "20" }]}>
            <Feather name="grid" size={40} color={theme.primary} />
          </View>
          <Text style={[Typography.h2, { color: theme.text, marginTop: Spacing.lg }]}>{app.name}</Text>
          {app.description ? (
            <Text style={[Typography.body, { color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }]}>
              {app.description}
            </Text>
          ) : null}
        </Card>

        <Card style={styles.permissionsCard}>
          <View style={styles.permissionsHeader}>
            <Feather name="shield" size={20} color={theme.primary} />
            <Text style={[Typography.h4, { color: theme.text, marginLeft: Spacing.sm }]}>
              Permissions Requested
            </Text>
          </View>
          <Text style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.xs, marginBottom: Spacing.md }]}>
            This app will have access to:
          </Text>
          <View style={styles.scopesList}>
            {(app.scopes || []).map((scope, idx) => (
              <View key={idx} style={styles.scopeItem}>
                <Feather name="check" size={14} color={theme.success} />
                <Text style={[Typography.small, { color: theme.text, marginLeft: Spacing.sm }]}>
                  {formatScope(scope)}
                </Text>
              </View>
            ))}
          </View>
        </Card>

        <Card style={styles.warningCard}>
          <View style={styles.warningHeader}>
            <Feather name="info" size={18} color={theme.warning} />
            <Text style={[Typography.body, { color: theme.warning, marginLeft: Spacing.sm, fontWeight: "500" }]}>
              Security Notice
            </Text>
          </View>
          <Text style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
            Only authorize apps you trust. This app will be able to read your health data 
            according to the permissions listed above. You can revoke access at any time.
          </Text>
        </Card>

        <Pressable
          style={({ pressed }) => [
            styles.launchButton,
            { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleLaunch}
        >
          <Feather name="external-link" size={20} color="#FFFFFF" />
          <Text style={[Typography.body, { color: "#FFFFFF", fontWeight: "600" }]}>
            Launch {app.name}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.cancelButton,
            { opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleGoBack}
        >
          <Text style={[Typography.body, { color: theme.textSecondary }]}>Cancel</Text>
        </Pressable>
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
      {renderContent()}
    </View>
  );
}

function formatScope(scope: string): string {
  const scopeDescriptions: Record<string, string> = {
    "openid": "Verify your identity",
    "profile": "Access your profile information",
    "fhirUser": "Access your FHIR user identity",
    "offline_access": "Access data while offline",
    "launch/patient": "Access patient context",
    "patient/*.read": "Read all patient data",
    "patient/Patient.read": "Read patient demographics",
    "patient/Observation.read": "Read observations and vitals",
    "patient/Condition.read": "Read conditions and diagnoses",
    "patient/MedicationRequest.read": "Read medication prescriptions",
    "patient/MedicationStatement.read": "Read medication history",
    "patient/Immunization.read": "Read immunization records",
    "patient/AllergyIntolerance.read": "Read allergy information",
    "patient/Procedure.read": "Read procedure records",
    "patient/Encounter.read": "Read visit records",
    "patient/DiagnosticReport.read": "Read lab and imaging reports",
    "patient/DocumentReference.read": "Read clinical documents",
  };

  return scopeDescriptions[scope] || scope;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing["3xl"],
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  launchCard: {
    alignItems: "center",
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionsCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  permissionsHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  scopesList: {
    gap: Spacing.sm,
  },
  scopeItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  warningCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  launchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  cancelButton: {
    alignItems: "center",
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
});
