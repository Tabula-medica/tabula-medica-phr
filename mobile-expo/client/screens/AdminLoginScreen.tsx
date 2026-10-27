import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Gradients } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export const PORTAL_TOKEN_KEY = "@tabula_admin_portal_token";

type Props = NativeStackScreenProps<RootStackParamList, "AdminLogin">;

export default function AdminLoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const inputBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const inputBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";

  const handleLogin = async () => {
    setErrorMessage("");
    if (!email.trim()) {
      setErrorMessage("Please enter your admin email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    try {
      setIsLoading(true);
      const base = getApiUrl();
      const res = await fetch(`${base}/api/portal/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Login failed.");
      }
      const token: string = data.token ?? data.accessToken ?? data.sessionToken ?? "";
      if (!token) throw new Error("No session token returned from server.");
      await AsyncStorage.setItem(PORTAL_TOKEN_KEY, token);
      navigation.replace("AdminDashboard", { token, providerName: data.provider?.name ?? "Admin" });
    } catch (err: any) {
      const msg = err?.message || "Something went wrong. Please try again.";
      if (msg.includes("pending") || msg.includes("deactivated")) {
        setErrorMessage("This account is pending approval or has been deactivated.");
      } else if (msg.includes("Invalid") || msg.includes("credentials") || msg.includes("password")) {
        setErrorMessage("Invalid email or password. Please try again.");
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={isDark ? ["#0A0A0F", "#0D1117", "#111827"] : ["#F8FAFC", "#EEF2FF", "#F0F9FF"]}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing["2xl"], paddingBottom: insets.bottom + Spacing["2xl"] },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={22} color={theme.textSecondary} />
        </Pressable>

        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.10)", borderColor: isDark ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.2)" }]}>
            <Feather name="shield" size={32} color="#6366F1" />
          </View>
          <ThemedText type="h2" style={styles.title}>Admin Portal</ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            Restricted access — authorised personnel only
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.formCard}>
          <View style={[styles.securityBadge, { backgroundColor: isDark ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.06)", borderColor: isDark ? "rgba(16,185,129,0.2)" : "rgba(16,185,129,0.15)" }]}>
            <Feather name="lock" size={12} color="#10B981" />
            <ThemedText type="caption" style={{ color: "#10B981", fontWeight: "600", marginLeft: 6 }}>
              HIPAA-compliant · AES-256 · Audit-logged
            </ThemedText>
          </View>

          {errorMessage ? (
            <Animated.View entering={FadeInDown} style={[styles.errorBox, { backgroundColor: `${theme.error}15`, borderColor: `${theme.error}30` }]}>
              <Feather name="alert-circle" size={15} color={theme.error} />
              <ThemedText type="small" style={{ color: theme.error, flex: 1, marginLeft: Spacing.sm }}>
                {errorMessage}
              </ThemedText>
            </Animated.View>
          ) : null}

          <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            Admin Email
          </ThemedText>
          <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: focusedInput === "email" ? "#6366F1" : inputBorder }]}>
            <Feather name="mail" size={17} color={focusedInput === "email" ? "#6366F1" : theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              testID="input-admin-email"
              style={[styles.input, { color: theme.text }]}
              placeholder="admin@yourorg.com"
              placeholderTextColor={theme.textSecondary}
              value={email}
              onChangeText={(t) => { setEmail(t); setErrorMessage(""); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
              onFocus={() => setFocusedInput("email")}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          <ThemedText type="small" style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            Password
          </ThemedText>
          <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: focusedInput === "password" ? "#6366F1" : inputBorder }]}>
            <Feather name="lock" size={17} color={focusedInput === "password" ? "#6366F1" : theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              testID="input-admin-password"
              style={[styles.input, { color: theme.text, flex: 1 }]}
              placeholder="Enter your password"
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={(t) => { setPassword(t); setErrorMessage(""); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
              onFocus={() => setFocusedInput("password")}
              onBlur={() => setFocusedInput(null)}
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={8}
              style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}
            >
              <Feather name={showPassword ? "eye-off" : "eye"} size={17} color={theme.textSecondary} />
            </Pressable>
          </View>

          <Pressable
            testID="button-admin-login"
            onPress={handleLogin}
            disabled={isLoading}
            style={({ pressed }) => [styles.loginButton, { opacity: isLoading ? 0.75 : pressed ? 0.92 : 1 }]}
          >
            <LinearGradient
              colors={["#6366F1", "#4F46E5"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.loginButtonGradient}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText type="body" style={styles.loginButtonText}>
                  Sign In to Admin Portal
                </ThemedText>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.footer}>
          <Feather name="eye-off" size={13} color={theme.textSecondary} />
          <ThemedText type="caption" style={[styles.footerText, { color: theme.textSecondary }]}>
            All admin actions are recorded in the HIPAA audit log
          </ThemedText>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing["2xl"],
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: Spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 14,
  },
  formCard: {
    gap: Spacing.sm,
  },
  securityBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  fieldLabel: {
    fontWeight: "600",
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  loginButton: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.button,
    overflow: "hidden",
  },
  loginButtonGradient: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: Spacing["2xl"],
  },
  footerText: {
    textAlign: "center",
    fontSize: 12,
  },
});
