import { useAuthState, friendlyAuthError } from "@/lib/auth";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { Body, Caption, Screen, Title } from "@/components/Themed";
import { useColors } from "@/hooks/useColors";

export default function SignUpScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signUp } = useAuthState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email || !password) return;
    setError(null);
    setBusy(true);
    try {
      await signUp(email, password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(friendlyAuthError(e?.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Caption>Begin</Caption>
        <Title style={{ marginTop: 12 }}>Create your account</Title>
        <Body style={{ marginTop: 8, color: colors.mutedForeground, fontSize: 14 }}>
          A small flame to keep your place.
        </Body>

        <View style={{ marginTop: 24, gap: 14 }}>
          <View>
            <Caption style={{ marginBottom: 6 }}>Email</Caption>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              style={inputStyle(colors)}
            />
          </View>
          <View>
            <Caption style={{ marginBottom: 6 }}>Password</Caption>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              style={inputStyle(colors)}
            />
          </View>
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={!email || !password || busy}
          style={({ pressed }) => [
            styles.btn,
            {
              backgroundColor: colors.primary,
              opacity: !email || !password || busy ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Body style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }}>
              Create account
            </Body>
          )}
        </Pressable>

        {error ? (
          <Body style={{ color: colors.destructive, marginTop: 12, fontSize: 13 }}>
            {error}
          </Body>
        ) : null}

        <View style={styles.footer}>
          <Body style={{ color: colors.mutedForeground }}>Already have an account? </Body>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable>
              <Body style={{ color: colors.primary, fontFamily: "Inter_500Medium" }}>
                Sign in
              </Body>
            </Pressable>
          </Link>
        </View>
      </View>
    </Screen>
  );
}

function inputStyle(colors: ReturnType<typeof useColors>) {
  return {
    backgroundColor: colors.card,
    color: colors.foreground,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: colors.radius,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  } as const;
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 80 },
  btn: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  footer: {
    marginTop: 28,
    flexDirection: "row",
    justifyContent: "center",
  },
});
