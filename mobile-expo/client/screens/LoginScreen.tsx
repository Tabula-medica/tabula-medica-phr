import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Image,
  Platform,
  Pressable,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Modal,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuthContext } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Spacing, BorderRadius, Gradients, Shadows } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

function FloatingParticle({ size, left, top, duration, delay, color }: { size: number; left: number; top: number; duration: number; delay: number; color: string }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(-30, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          left,
          top,
        },
        animatedStyle,
      ]}
    />
  );
}

const FEATURE_PILLS = [
  { icon: "cloud" as const, label: "50K+ Providers" },
  { icon: "shield" as const, label: "HIPAA Compliant" },
  { icon: "globe" as const, label: "50+ Languages" },
  { icon: "dollar-sign" as const, label: "Free to Join" },
];

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    isGoogleSignInReady,
    isGcipEnabled,
    isAppleAuthAvailable,
  } = useAuthContext();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStep, setResetStep] = useState<"email" | "done">("email");
  const [secureLoadingMessage, setSecureLoadingMessage] = useState("");
  const secureLoadingTimer = useRef<ReturnType<typeof setTimeout>[]>([]);

  const trustPulse = useSharedValue(1);

  useEffect(() => {
    trustPulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const trustPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: trustPulse.value }],
  }));

  const startSecureLoading = () => {
    secureLoadingTimer.current.forEach(t => clearTimeout(t));
    secureLoadingTimer.current = [];
    setSecureLoadingMessage("Establishing secure connection...");
    secureLoadingTimer.current.push(
      setTimeout(() => setSecureLoadingMessage("Verifying identity..."), 2000),
      setTimeout(() => setSecureLoadingMessage("Encrypting session..."), 4500),
      setTimeout(() => setSecureLoadingMessage("Preparing your records..."), 7000),
    );
  };

  const stopSecureLoading = () => {
    secureLoadingTimer.current.forEach(t => clearTimeout(t));
    secureLoadingTimer.current = [];
    setSecureLoadingMessage("");
  };

  const handleForgotPassword = async () => {
    setResetError("");
    setResetMessage("");

    if (resetStep === "email") {
      if (!resetEmail.trim()) {
        setResetError("Please enter your email address");
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(resetEmail.trim())) {
        setResetError("Please enter a valid email address");
        return;
      }

      try {
        setResetLoading(true);
        setResetStep("done");
        setResetMessage("For security reasons, password resets require identity verification by our support team. Please contact support with your email address and we will assist you promptly.");
      } catch (error: any) {
        setResetError(error?.message || "Something went wrong");
      } finally {
        setResetLoading(false);
      }
    }
  };

  const closeForgotPassword = () => {
    setShowForgotPassword(false);
    setResetEmail("");
    setResetMessage("");
    setResetError("");
    setResetStep("email");
  };

  const friendlyError = (error: any, fallback: string): string => {
    const raw = error?.response?.data?.error || error?.response?.data?.message || error?.message || "";
    if (raw.includes("timeout") || raw.includes("ECONNABORTED")) {
      return "Connection timed out. The server may be starting up — please try again in a moment.";
    }
    if (raw.includes("Network Error") || raw.includes("ERR_NETWORK")) {
      return "Unable to reach the server. Please check your internet connection and try again.";
    }
    if (raw.includes("Security") && raw.includes("blocked")) {
      return "Connection security check failed. Please try again.";
    }
    if (raw.includes("Token exchange failed") || raw.includes("invalid_grant") || raw.includes("code") && raw.includes("expired")) {
      return "Sign-in session expired. Please try again — the login window will reopen.";
    }
    if (raw.includes("callback") || raw.includes("redirect") || raw.includes("mismatch")) {
      return "Sign-in could not complete. Please try again.";
    }
    if (raw.includes("not configured")) {
      return "This sign-in method is not available yet. Please use email and password.";
    }
    if (
      raw.includes("auth/internal-error") ||
      raw.includes("auth/unauthorized-domain") ||
      raw.includes("internal-error")
    ) {
      return "Google Sign-In is not available on this domain. Please use email and password to sign in.";
    }
    if (error?.response?.status === 423 || raw.includes("ACCOUNT_LOCKED") || raw.includes("temporarily locked")) {
      const retryAfter = error?.response?.data?.retryAfter;
      if (retryAfter && retryAfter > 60) {
        const mins = Math.ceil(retryAfter / 60);
        return `Too many failed attempts. Please try again in ${mins} minute${mins > 1 ? "s" : ""}.`;
      }
      return "Too many failed attempts. Please wait a moment and try again.";
    }
    if (error?.response?.status === 429) {
      return "Too many requests. Please wait a moment before trying again.";
    }
    if (error?.response?.status >= 500) {
      return "The server encountered an issue. Please try again shortly.";
    }
    return raw || fallback;
  };

  const handleEmailAuth = async () => {
    setErrorMessage("");
    if (!email.trim()) {
      setErrorMessage("Please enter your email address");
      return;
    }
    if (!password || password.length < 8) {
      setErrorMessage(t.login.passwordMinLength);
      return;
    }
    if (isSignUp && !name.trim()) {
      setErrorMessage("Please enter your name");
      return;
    }

    try {
      setIsLoading(true);
      startSecureLoading();
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
      const loginTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Connection timed out. The server may be starting up — please try again in a moment.")), 12000)
      );
      if (isSignUp) {
        await Promise.race([signUpWithEmail(email.trim(), password, name.trim()), loginTimeout]);
      } else {
        await Promise.race([signInWithEmail(email.trim(), password), loginTimeout]);
      }
    } catch (error: any) {
      setErrorMessage(friendlyError(error, "Authentication failed. Please try again."));
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
    } finally {
      setIsLoading(false);
      stopSecureLoading();
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      startSecureLoading();
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
      const appleTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Connection timed out. Please try again.")), 12000)
      );
      await Promise.race([signInWithApple(), appleTimeout]);
    } catch (error: any) {
      setErrorMessage(friendlyError(error, "Apple sign-in failed. Please try again."));
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
    } finally {
      setIsLoading(false);
      stopSecureLoading();
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");
      startSecureLoading();
      try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
      await signInWithGoogle();
    } catch (error: any) {
      setErrorMessage(friendlyError(error, "Google sign-in failed. Please try again."));
      try { await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
    } finally {
      setIsLoading(false);
      stopSecureLoading();
    }
  };

  const inputBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)";
  const inputBorder = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)";
  const particleColor = isDark ? "rgba(96, 165, 250, 0.06)" : "rgba(0, 102, 204, 0.04)";

  return (
    <LinearGradient
      colors={isDark ? ["#0f172a", "#1e3a5f", "#0f172a"] : ["#f0f9ff", "#e0f2fe", "#f0f9ff"]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <FloatingParticle size={120} left={-30} top={80} duration={4000} delay={0} color={particleColor} />
      <FloatingParticle size={80} left={280} top={200} duration={5000} delay={500} color={particleColor} />
      <FloatingParticle size={60} left={40} top={500} duration={3500} delay={1000} color={particleColor} />
      <FloatingParticle size={90} left={220} top={600} duration={4500} delay={300} color={particleColor} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing["3xl"],
            paddingBottom: insets.bottom + Spacing["2xl"],
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            style={styles.iconGlowWrapper}
          >
            <View
              style={[
                styles.iconGlowRing,
                {
                  borderColor: isDark ? "rgba(96, 165, 250, 0.2)" : "rgba(0, 102, 204, 0.15)",
                },
              ]}
            />
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: isDark ? "rgba(96, 165, 250, 0.15)" : "rgba(0, 102, 204, 0.1)" },
              ]}
            >
              <Image
                source={require("../../assets/images/icon.png")}
                style={styles.appIcon}
                resizeMode="contain"
                accessibilityLabel="Tabula Medica app icon"
              />
            </View>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <ThemedText type="h1" style={styles.title}>
              {t.login.title}
            </ThemedText>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <ThemedText
              type="body"
              style={[styles.subtitle, { color: theme.textSecondary }]}
            >
              {t.login.subtitle}
            </ThemedText>
          </Animated.View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).springify()}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featurePillsContainer}
          >
            {FEATURE_PILLS.map((pill) => (
              <View
                key={pill.label}
                style={[
                  styles.featurePill,
                  {
                    backgroundColor: isDark ? "rgba(96, 165, 250, 0.12)" : "rgba(0, 102, 204, 0.08)",
                    borderColor: isDark ? "rgba(96, 165, 250, 0.2)" : "rgba(0, 102, 204, 0.12)",
                  },
                ]}
              >
                <Feather name={pill.icon} size={14} color={theme.primary} />
                <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "500" }}>
                  {pill.label}
                </ThemedText>
              </View>
            ))}
          </ScrollView>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(400).springify()}
          style={[
            styles.formSection,
            {
              backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.65)",
              borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
              ...Shadows.cardGlass,
            },
          ]}
        >
          {errorMessage ? (
            <View
              style={[styles.errorContainer, { backgroundColor: `${theme.error}15`, borderColor: `${theme.error}30` }]}
              accessibilityLiveRegion="assertive"
              accessibilityRole="alert"
            >
              <Feather name="alert-circle" size={16} color={theme.error} />
              <ThemedText type="small" style={{ color: theme.error, flex: 1 }}>
                {errorMessage}
              </ThemedText>
            </View>
          ) : null}

          {isSignUp ? (
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: inputBg,
                  borderColor: focusedInput === "name" ? theme.primary : inputBorder,
                },
              ]}
            >
              <Feather name="user" size={18} color={focusedInput === "name" ? theme.primary : theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                testID="input-name"
                style={[styles.input, { color: theme.text }]}
                placeholder={t.login.namePlaceholder}
                placeholderTextColor={theme.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!isLoading}
                onFocus={() => setFocusedInput("name")}
                onBlur={() => setFocusedInput(null)}
                accessibilityLabel="Full name"
                accessibilityHint="Enter your full name"
              />
            </View>
          ) : null}

          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: inputBg,
                borderColor: focusedInput === "email" ? theme.primary : inputBorder,
              },
            ]}
          >
            <Feather name="mail" size={18} color={focusedInput === "email" ? theme.primary : theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              testID="input-email"
              style={[styles.input, { color: theme.text }]}
              placeholder={t.login.emailPlaceholder}
              placeholderTextColor={theme.textSecondary}
              value={email}
              onChangeText={(text) => { setEmail(text); setErrorMessage(""); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
              onFocus={() => setFocusedInput("email")}
              onBlur={() => setFocusedInput(null)}
              accessibilityLabel="Email address"
              accessibilityHint="Enter your email address"
            />
          </View>

          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: inputBg,
                borderColor: focusedInput === "password" ? theme.primary : inputBorder,
              },
            ]}
          >
            <Feather name="lock" size={18} color={focusedInput === "password" ? theme.primary : theme.textSecondary} style={styles.inputIcon} />
            <TextInput
              testID="input-password"
              style={[styles.input, { color: theme.text, flex: 1 }]}
              placeholder={t.login.passwordPlaceholder}
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={(text) => { setPassword(text); setErrorMessage(""); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
              onFocus={() => setFocusedInput("password")}
              onBlur={() => setFocusedInput(null)}
              accessibilityLabel="Password"
              accessibilityHint="Enter your password"
            />
            <Pressable
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}
            >
              <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          {!isSignUp ? (
            <Pressable
              testID="button-forgot-password"
              onPress={() => {
                setResetEmail(email);
                setShowForgotPassword(true);
              }}
              style={{ alignSelf: "flex-end", marginTop: -Spacing.xs, minHeight: 44, justifyContent: "center" }}
              accessibilityRole="button"
              accessibilityLabel="Forgot Password"
              accessibilityHint="Opens password reset form"
            >
              <ThemedText type="caption" style={{ color: theme.primary, fontWeight: "500" }}>
                Forgot Password?
              </ThemedText>
            </Pressable>
          ) : null}

          <Pressable
            testID="button-email-auth"
            onPress={handleEmailAuth}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityState={{ disabled: isLoading, busy: isLoading }}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                opacity: isLoading ? 0.7 : pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <LinearGradient
              colors={Gradients.primary as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButtonGradient}
            >
              {isLoading ? (
                <View style={styles.secureLoadingRow}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                  <ThemedText type="small" style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>
                    {secureLoadingMessage || "Connecting..."}
                  </ThemedText>
                </View>
              ) : (
                <ThemedText type="body" style={styles.primaryButtonText}>
                  {isSignUp ? t.login.createAccount : t.login.signInEmail}
                </ThemedText>
              )}
            </LinearGradient>
          </Pressable>

          <View style={styles.switchRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {isSignUp ? t.login.hasAccount : t.login.noAccount}
            </ThemedText>
            <Pressable
              testID="button-toggle-mode"
              onPress={() => {
                setIsSignUp(!isSignUp);
                setErrorMessage("");
              }}
              accessibilityRole="button"
              accessibilityLabel={isSignUp ? "Switch to sign in" : "Switch to create account"}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>
                {" "}{isSignUp ? t.login.signInEmail : t.login.createAccount}
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(600).springify()} style={styles.dividerSection}>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          <ThemedText type="small" style={[styles.dividerText, { color: theme.textSecondary }]}>
            {t.login.orContinueWith}
          </ThemedText>
          <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(700).springify()} style={styles.altAuthSection}>
          {isGcipEnabled ? (
            <Pressable
              testID="button-google-sign-in"
              onPress={handleGoogleSignIn}
              disabled={isLoading || !isGoogleSignInReady}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
              accessibilityState={{ disabled: isLoading || !isGoogleSignInReady }}
              style={({ pressed }) => [
                styles.googleButton,
                {
                  opacity: isLoading ? 0.7 : !isGoogleSignInReady ? 0.5 : pressed ? 0.9 : 1,
                },
              ]}
            >
              <View style={styles.altAuthButtonInner}>
                <View style={styles.googleLogoContainer}>
                  <Feather name="chrome" size={20} color="#4285F4" />
                </View>
                <ThemedText type="body" style={styles.googleButtonText}>
                  {isGoogleSignInReady ? "Continue with Google" : "Google Sign-In (not configured)"}
                </ThemedText>
              </View>
            </Pressable>
          ) : null}

          {Platform.OS === "ios" && isAppleAuthAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={
                isDark
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={BorderRadius.button}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />
          ) : null}

          <ThemedText
            type="caption"
            style={[styles.disclaimer, { color: theme.textSecondary }]}
          >
            {t.login.termsPrefix} {t.login.privacyPolicy}{"\n"}{t.login.and} {t.login.termsOfService}
          </ThemedText>

          <Animated.View style={[styles.trustBadgeRow, trustPulseStyle]}>
            <View style={[styles.trustBadgeEnhanced, { backgroundColor: isDark ? "rgba(16, 185, 129, 0.08)" : "rgba(16, 185, 129, 0.06)", borderColor: isDark ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0.15)" }]}>
              <Feather name="shield" size={13} color="#10B981" />
              <ThemedText type="caption" style={{ color: "#10B981", fontWeight: "600" }}>
                {"HIPAA"}
              </ThemedText>
            </View>
            <View style={[styles.trustBadgeEnhanced, { backgroundColor: isDark ? "rgba(59, 130, 246, 0.08)" : "rgba(59, 130, 246, 0.06)", borderColor: isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.15)" }]}>
              <Feather name="lock" size={13} color="#3B82F6" />
              <ThemedText type="caption" style={{ color: "#3B82F6", fontWeight: "600" }}>
                {"AES-256"}
              </ThemedText>
            </View>
            <View style={[styles.trustBadgeEnhanced, { backgroundColor: isDark ? "rgba(139, 92, 246, 0.08)" : "rgba(139, 92, 246, 0.06)", borderColor: isDark ? "rgba(139, 92, 246, 0.2)" : "rgba(139, 92, 246, 0.15)" }]}>
              <Feather name="eye-off" size={13} color="#8B5CF6" />
              <ThemedText type="caption" style={{ color: "#8B5CF6", fontWeight: "600" }}>
                {"Zero-sell"}
              </ThemedText>
            </View>
          </Animated.View>
          <ThemedText type="caption" style={[styles.trustTagline, { color: theme.textSecondary }]}>
            {"Your health data never leaves your control"}
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(900).springify()} style={styles.adminPortalRow}>
          <Pressable
            testID="button-admin-portal"
            onPress={() => navigation.navigate("AdminLogin")}
            accessibilityRole="button"
            accessibilityLabel="Admin Portal"
            style={({ pressed }) => [styles.adminPortalButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="shield" size={13} color={theme.textSecondary} />
            <ThemedText type="caption" style={[styles.adminPortalText, { color: theme.textSecondary }]}>
              {"Admin Portal"}
            </ThemedText>
            <Feather name="chevron-right" size={13} color={theme.textSecondary} />
          </Pressable>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showForgotPassword}
        transparent
        animationType="slide"
        onRequestClose={closeForgotPassword}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.container, { backgroundColor: theme.backgroundDefault }]}>
            <View style={modalStyles.header}>
              <ThemedText type="h3" style={{ flex: 1 }}>
                {resetStep === "done" ? "Request Received" : "Account Recovery"}
              </ThemedText>
              <Pressable
                onPress={closeForgotPassword}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close password reset"
                style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}
              >
                <Feather name="x" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>

            {resetError ? (
              <View style={[styles.errorContainer, { backgroundColor: `${theme.error}15`, borderColor: `${theme.error}30` }]}>
                <Feather name="alert-circle" size={16} color={theme.error} />
                <ThemedText type="small" style={{ color: theme.error, flex: 1 }}>
                  {resetError}
                </ThemedText>
              </View>
            ) : null}

            {resetStep === "email" ? (
              <>
                <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
                  Enter your email address and our support team will help you securely recover access to your account.
                </ThemedText>
                <View style={[styles.inputContainer, { backgroundColor: inputBg, borderColor: inputBorder, marginBottom: Spacing.md }]}>
                  <Feather name="mail" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    testID="input-reset-email"
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Email address"
                    placeholderTextColor={theme.textSecondary}
                    value={resetEmail}
                    onChangeText={setResetEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />
                </View>
              </>
            ) : null}

            {resetStep === "done" ? (
              <View style={{ alignItems: "center", paddingVertical: Spacing.xl }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${theme.success || "#22C55E"}20`, alignItems: "center", justifyContent: "center", marginBottom: Spacing.md }}>
                  <Feather name="shield" size={28} color={theme.success || "#22C55E"} />
                </View>
                <ThemedText type="body" style={{ textAlign: "center", color: theme.textSecondary }}>
                  {resetMessage}
                </ThemedText>
              </View>
            ) : null}

            <View style={{ marginTop: Spacing.lg }}>
              {resetStep === "done" ? (
                <Pressable
                  testID="button-reset-done"
                  onPress={closeForgotPassword}
                  style={({ pressed }) => [styles.primaryButton, { opacity: pressed ? 0.9 : 1 }]}
                >
                  <LinearGradient
                    colors={Gradients.primary as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryButtonGradient}
                  >
                    <ThemedText type="body" style={styles.primaryButtonText}>
                      Back to Sign In
                    </ThemedText>
                  </LinearGradient>
                </Pressable>
              ) : (
                <Pressable
                  testID="button-reset-submit"
                  onPress={handleForgotPassword}
                  disabled={resetLoading}
                  style={({ pressed }) => [styles.primaryButton, { opacity: resetLoading ? 0.7 : pressed ? 0.9 : 1 }]}
                >
                  <LinearGradient
                    colors={Gradients.primary as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.primaryButtonGradient}
                  >
                    {resetLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <ThemedText type="body" style={styles.primaryButtonText}>
                        Contact Support
                      </ThemedText>
                    )}
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  container: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    paddingBottom: Spacing["3xl"],
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing["2xl"],
    justifyContent: "center",
    gap: Spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  iconGlowWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
    width: 120,
    height: 120,
  },
  iconGlowRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.cardGlass,
  },
  appIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 24,
    fontSize: 15,
  },
  featurePillsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  formSection: {
    gap: Spacing.md,
    borderRadius: BorderRadius.cardFeatured,
    borderWidth: 1,
    padding: Spacing["2xl"],
    marginHorizontal: 0,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  primaryButton: {
    borderRadius: BorderRadius.button,
    marginTop: Spacing.sm,
    ...Shadows.buttonPrimary,
    overflow: "hidden",
  },
  primaryButtonGradient: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.button,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.3,
  },
  altAuthButtonInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  googleButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.button,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    ...Shadows.small,
    marginBottom: Spacing.sm,
  },
  googleLogoContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(66,133,244,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  googleButtonText: {
    color: "#1F1F1F",
    fontWeight: "700",
    fontSize: 16,
    letterSpacing: 0.3,
  },
  
  switchRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  dividerSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontWeight: "500",
  },
  altAuthSection: {
    gap: Spacing.md,
  },
  appleButton: {
    height: Spacing.buttonHeight,
    width: "100%",
  },
  disclaimer: {
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  trustBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  trustBadgeEnhanced: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  trustTagline: {
    textAlign: "center",
    marginTop: Spacing.sm,
    fontStyle: "italic",
    fontSize: 11,
  },
  secureLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  adminPortalRow: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  adminPortalButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  adminPortalText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
