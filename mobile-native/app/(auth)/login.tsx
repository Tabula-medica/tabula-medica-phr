import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  registerWithEmail,
  resendVerificationEmail,
  sendPasswordReset,
  signInWithEmail,
} from "@/api/auth";
import { isGcipConfigured } from "@/api/gcip";
import { ApiError } from "@/api/types";
import { useAuth } from "@/auth/AuthContext";
import { useAppleSignIn, useGoogleSignIn } from "@/hooks/useSocialAuth";
import { Button, Card, NoCdsFooter, Screen } from "@/components/ui";
import { colors, radius, spacing, typography } from "@/theme/tokens";

type Mode = "signin" | "signup";

export default function LoginScreen() {
  const router = useRouter();
  const { setSessionUser } = useAuth();
  const google = useGoogleSignIn();
  const apple = useAppleSignIn();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<null | "email" | "google" | "apple">(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const configured = isGcipConfigured();

  const onSuccess = async (user: { id: string; email: string; name: string; role: string; emailVerified: boolean }) => {
    await setSessionUser(user);
    router.replace("/(app)");
  };

  const handleEmail = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy("email");
    try {
      const result =
        mode === "signin"
          ? await signInWithEmail(email, password)
          : await registerWithEmail(email, password);

      if (mode === "signup" || !result.emailVerified) {
        setNotice(
          "We've sent a verification link to your email. Verify it, then sign in to access your records."
        );
        setMode("signin");
        return;
      }
      await onSuccess(result.user);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(null);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy("google");
    try {
      const result = await google.signIn();
      if (result) await onSuccess(result.user);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(null);
    }
  };

  const handleApple = async () => {
    setError(null);
    setBusy("apple");
    try {
      const result = await apple.signIn();
      if (result) await onSuccess(result.user);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(null);
    }
  };

  const handleForgot = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Enter your email first, then tap Forgot password.");
      return;
    }
    try {
      await sendPasswordReset(email);
      setNotice("Password reset email sent. Check your inbox.");
    } catch (err) {
      setError(messageFor(err));
    }
  };

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <View style={styles.logo}>
            <Ionicons name="medical" size={34} color={colors.textInverse} />
          </View>
          <Text style={styles.brand}>Tabula Medica</Text>
          <Text style={styles.tagline}>Your complete health record, in one place you control.</Text>
        </View>

        <Card>
          <Text style={typography.h3}>
            {mode === "signin" ? "Sign in" : "Create your account"}
          </Text>

          {!configured ? (
            <View style={[styles.banner, styles.bannerWarn]}>
              <Ionicons name="warning-outline" size={16} color={colors.warning} />
              <Text style={styles.bannerWarnText}>
                Sign-in is not configured for this build. Set EXPO_PUBLIC_GCIP_* in
                .env (see .env.example).
              </Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={typography.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              editable={busy === null}
            />
          </View>

          <View style={styles.field}>
            <Text style={typography.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textSubtle}
              secureTextEntry
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              editable={busy === null}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <View style={{ marginTop: spacing.md }}>
            <Button
              title={mode === "signin" ? "Sign in" : "Create account"}
              onPress={handleEmail}
              loading={busy === "email"}
              disabled={!configured || busy !== null}
            />
          </View>

          {mode === "signin" ? (
            <Text style={styles.link} onPress={handleForgot}>
              Forgot password?
            </Text>
          ) : null}

          {(google.ready || apple.ready) && (
            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.line} />
            </View>
          )}

          {google.ready ? (
            <Button
              title="Continue with Google"
              variant="secondary"
              icon="logo-google"
              onPress={handleGoogle}
              loading={busy === "google"}
              disabled={busy !== null}
            />
          ) : null}

          {apple.ready ? (
            <View style={{ marginTop: spacing.sm }}>
              <Button
                title="Continue with Apple"
                variant="secondary"
                icon="logo-apple"
                onPress={handleApple}
                loading={busy === "apple"}
                disabled={busy !== null}
              />
            </View>
          ) : null}
        </Card>

        <Text style={styles.switch} onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </Text>

        {mode === "signin" ? (
          <Text style={styles.resend} onPress={() => resendVerificationEmail().catch(() => {})}>
            Didn't get a verification email? Resend
          </Text>
        ) : null}

        <NoCdsFooter />
      </KeyboardAvoidingView>
    </Screen>
  );
}

function messageFor(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  const code = (err as { code?: string })?.code ?? "";
  if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password"))
    return "Incorrect email or password.";
  if (code.includes("auth/user-not-found")) return "No account found for that email.";
  if (code.includes("auth/email-already-in-use")) return "That email is already registered.";
  if (code.includes("auth/weak-password")) return "Choose a stronger password (6+ characters).";
  if (code.includes("auth/too-many-requests")) return "Too many attempts. Try again later.";
  return (err as Error)?.message ?? "Something went wrong. Please try again.";
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginBottom: spacing.xl, marginTop: spacing.lg },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  brand: { ...typography.h1, color: colors.brand },
  tagline: {
    ...typography.bodyMuted,
    textAlign: "center",
    marginTop: spacing.xs,
    maxWidth: 300,
  },
  field: { marginTop: spacing.md, gap: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 14 },
  notice: { color: colors.success, marginTop: spacing.md, fontSize: 14 },
  link: {
    color: colors.accent,
    textAlign: "right",
    marginTop: spacing.md,
    fontWeight: "600",
  },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: spacing.lg, gap: spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { color: colors.textSubtle, fontSize: 13 },
  switch: {
    color: colors.brand,
    textAlign: "center",
    marginTop: spacing.xl,
    fontWeight: "600",
    fontSize: 15,
  },
  resend: { color: colors.textMuted, textAlign: "center", marginTop: spacing.md, fontSize: 13 },
  banner: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
    alignItems: "flex-start",
  },
  bannerWarn: { backgroundColor: "#fffbeb" },
  bannerWarnText: { color: colors.warning, flex: 1, fontSize: 13, lineHeight: 18 },
});
