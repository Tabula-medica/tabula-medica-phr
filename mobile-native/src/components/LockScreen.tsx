/**
 * Full-screen biometric unlock gate. Shown over the app whenever the user is
 * signed in but the session is locked. Auto-prompts on mount; offers a manual
 * retry and a sign-out escape hatch.
 */
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui";
import { colors, spacing, typography } from "@/theme/tokens";

export function LockScreen() {
  const { unlock, signOut, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const attempt = useCallback(async () => {
    setBusy(true);
    setFailed(false);
    const ok = await unlock();
    setBusy(false);
    setFailed(!ok);
  }, [unlock]);

  useEffect(() => {
    attempt();
  }, [attempt]);

  return (
    <View style={styles.overlay}>
      <View style={styles.iconWrap}>
        <Ionicons name="lock-closed" size={40} color={colors.textInverse} />
      </View>
      <Text style={styles.title}>Tabula Medica is locked</Text>
      <Text style={styles.subtitle}>
        {user?.name ? `Welcome back, ${user.name.split(" ")[0]}.` : "Welcome back."}{" "}
        Unlock to view your health record.
      </Text>

      <View style={styles.actions}>
        <Button
          title={failed ? "Try again" : "Unlock"}
          icon="finger-print"
          onPress={attempt}
          loading={busy}
        />
        <Button title="Sign out" variant="ghost" onPress={signOut} />
      </View>

      {failed ? (
        <Text style={styles.error}>Authentication failed. Please try again.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    zIndex: 100,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.brandLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  title: { ...typography.h2, color: colors.textInverse, textAlign: "center" },
  subtitle: {
    ...typography.body,
    color: colors.accentLight,
    textAlign: "center",
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  actions: { alignSelf: "stretch", gap: spacing.md, marginTop: spacing.xxl },
  error: { color: colors.accentLight, marginTop: spacing.lg },
});
