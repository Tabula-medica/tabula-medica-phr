import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { apiRequest } from "@/lib/query-client";
import { Card } from "@/components/Card";
import * as Haptics from "expo-haptics";

interface ScopeCategory {
  name: string;
  scopes: string[];
  description: string;
}

const SCOPE_CATEGORIES: ScopeCategory[] = [
  {
    name: "Patient Read",
    description: "Read patient health records",
    scopes: [
      "patient/Patient.read",
      "patient/Observation.read",
      "patient/Condition.read",
      "patient/MedicationRequest.read",
      "patient/Immunization.read",
      "patient/AllergyIntolerance.read",
    ],
  },
  {
    name: "Identity",
    description: "OpenID Connect identity",
    scopes: ["openid", "profile", "fhirUser"],
  },
  {
    name: "Launch",
    description: "Launch context",
    scopes: ["launch/patient"],
  },
  {
    name: "Offline Access",
    description: "Refresh tokens for offline access",
    scopes: ["offline_access"],
  },
];

export default function SmartAppRegisterScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [launchUrl, setLaunchUrl] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "openid",
    "profile",
    "fhirUser",
    "launch/patient",
    "patient/Patient.read",
  ]);
  const [showSecretInput, setShowSecretInput] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const registerMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/smart-apps", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/smart-apps"] });
      Alert.alert("Success", "SMART app registered successfully", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to register app");
    },
  });

  const handleScopeToggle = (scope: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedScopes(prev =>
      prev.includes(scope)
        ? prev.filter(s => s !== scope)
        : [...prev, scope]
    );
  };

  const handleCategoryToggle = (category: ScopeCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const allSelected = category.scopes.every(s => selectedScopes.includes(s));
    if (allSelected) {
      setSelectedScopes(prev => prev.filter(s => !category.scopes.includes(s)));
    } else {
      setSelectedScopes(prev => [...new Set([...prev, ...category.scopes])]);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Validation Error", "App name is required");
      return;
    }
    if (!clientId.trim()) {
      Alert.alert("Validation Error", "Client ID is required");
      return;
    }
    if (!redirectUri.trim()) {
      Alert.alert("Validation Error", "Redirect URI is required");
      return;
    }
    if (selectedScopes.length === 0) {
      Alert.alert("Validation Error", "At least one scope is required");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    registerMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim() || undefined,
      redirectUri: redirectUri.trim(),
      launchUrl: launchUrl.trim() || undefined,
      scopes: selectedScopes,
      isActive: true,
    });
  };

  const generateClientId = () => {
    const id = `app-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    setClientId(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + Spacing.md }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerSection}>
          <Text style={[Typography.h2, { color: theme.text }]}>Register SMART App</Text>
          <Text style={[Typography.small, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
            Configure a third-party app to access your health data via FHIR
          </Text>
        </View>

        <Card style={styles.formCard}>
          <Text style={[Typography.h4, { color: theme.text, marginBottom: Spacing.md }]}>
            App Information
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
              App Name *
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="My Health App"
              placeholderTextColor={theme.textSecondary}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
              Description
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Brief description of the app"
              placeholderTextColor={theme.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>
        </Card>

        <Card style={styles.formCard}>
          <Text style={[Typography.h4, { color: theme.text, marginBottom: Spacing.md }]}>
            OAuth Credentials
          </Text>

          <View style={styles.inputGroup}>
            <View style={styles.inputHeader}>
              <Text style={[Typography.caption, { color: theme.textSecondary }]}>
                Client ID *
              </Text>
              <Pressable onPress={generateClientId}>
                <Text style={[Typography.caption, { color: theme.primary }]}>Generate</Text>
              </Pressable>
            </View>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="your-client-id"
              placeholderTextColor={theme.textSecondary}
              value={clientId}
              onChangeText={setClientId}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.inputHeader}>
              <Text style={[Typography.caption, { color: theme.textSecondary }]}>
                Client Secret (Optional)
              </Text>
              <Pressable onPress={() => setShowSecretInput(!showSecretInput)}>
                <Text style={[Typography.caption, { color: theme.primary }]}>
                  {showSecretInput ? "Hide" : "Show"}
                </Text>
              </Pressable>
            </View>
            {showSecretInput ? (
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="For confidential clients only"
                placeholderTextColor={theme.textSecondary}
                value={clientSecret}
                onChangeText={setClientSecret}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
              Redirect URI *
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="https://your-app.com/callback"
              placeholderTextColor={theme.textSecondary}
              value={redirectUri}
              onChangeText={setRedirectUri}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>
        </Card>

        <Pressable
          style={styles.advancedToggle}
          onPress={() => setShowAdvanced(!showAdvanced)}
        >
          <Text style={[Typography.body, { color: theme.primary }]}>
            {showAdvanced ? "Hide Advanced Options" : "Show Advanced Options"}
          </Text>
          <Feather
            name={showAdvanced ? "chevron-up" : "chevron-down"}
            size={20}
            color={theme.primary}
          />
        </Pressable>

        {showAdvanced ? (
          <Card style={styles.formCard}>
            <Text style={[Typography.h4, { color: theme.text, marginBottom: Spacing.md }]}>
              Advanced Options
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.xs }]}>
                Launch URL
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="https://your-app.com/launch"
                placeholderTextColor={theme.textSecondary}
                value={launchUrl}
                onChangeText={setLaunchUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Text style={[Typography.caption, { color: theme.textSecondary, marginTop: Spacing.xs }]}>
                URL to launch the app with SMART context
              </Text>
            </View>
          </Card>
        ) : null}

        <Card style={styles.formCard}>
          <Text style={[Typography.h4, { color: theme.text, marginBottom: Spacing.sm }]}>
            Permissions (Scopes)
          </Text>
          <Text style={[Typography.caption, { color: theme.textSecondary, marginBottom: Spacing.md }]}>
            Select what data this app can access
          </Text>

          {SCOPE_CATEGORIES.map((category, idx) => {
            const allSelected = category.scopes.every(s => selectedScopes.includes(s));
            const someSelected = category.scopes.some(s => selectedScopes.includes(s));

            return (
              <View key={category.name} style={[styles.scopeCategory, idx > 0 && { marginTop: Spacing.md }]}>
                <Pressable
                  style={styles.categoryHeader}
                  onPress={() => handleCategoryToggle(category)}
                >
                  <View style={styles.categoryInfo}>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: allSelected
                            ? theme.primary
                            : someSelected
                            ? theme.primary + "40"
                            : theme.backgroundSecondary,
                          borderColor: allSelected || someSelected ? theme.primary : theme.border,
                        },
                      ]}
                    >
                      {allSelected ? (
                        <Feather name="check" size={12} color="#FFFFFF" />
                      ) : someSelected ? (
                        <View style={[styles.partialCheck, { backgroundColor: theme.primary }]} />
                      ) : null}
                    </View>
                    <View>
                      <Text style={[Typography.body, { color: theme.text, fontWeight: "500" }]}>
                        {category.name}
                      </Text>
                      <Text style={[Typography.caption, { color: theme.textSecondary }]}>
                        {category.description}
                      </Text>
                    </View>
                  </View>
                </Pressable>

                <View style={styles.scopeList}>
                  {category.scopes.map(scope => (
                    <Pressable
                      key={scope}
                      style={styles.scopeItem}
                      onPress={() => handleScopeToggle(scope)}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          styles.smallCheckbox,
                          {
                            backgroundColor: selectedScopes.includes(scope)
                              ? theme.primary
                              : theme.backgroundSecondary,
                            borderColor: selectedScopes.includes(scope) ? theme.primary : theme.border,
                          },
                        ]}
                      >
                        {selectedScopes.includes(scope) ? (
                          <Feather name="check" size={10} color="#FFFFFF" />
                        ) : null}
                      </View>
                      <Text
                        style={[
                          Typography.caption,
                          {
                            color: selectedScopes.includes(scope) ? theme.text : theme.textSecondary,
                            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                          },
                        ]}
                      >
                        {scope}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            );
          })}
        </Card>

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: theme.primary,
              opacity: pressed || registerMutation.isPending ? 0.8 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Feather name="plus-circle" size={20} color="#FFFFFF" />
              <Text style={[Typography.body, { color: "#FFFFFF", fontWeight: "600" }]}>
                Register App
              </Text>
            </>
          )}
        </Pressable>

        <View style={{ height: Spacing["3xl"] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing["3xl"],
  },
  headerSection: {
    marginBottom: Spacing.lg,
  },
  formCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
    paddingTop: Spacing.sm,
  },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  scopeCategory: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.xs,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  smallCheckbox: {
    width: 18,
    height: 18,
  },
  partialCheck: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  scopeList: {
    marginTop: Spacing.sm,
    marginLeft: 40,
    gap: Spacing.xs,
  },
  scopeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
});
