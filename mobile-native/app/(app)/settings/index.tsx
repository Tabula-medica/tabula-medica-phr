import React from "react";
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth/AuthContext";
import { Card, Screen } from "@/components/ui";
import { colors, radius, spacing, typography } from "@/theme/tokens";

export default function SettingsScreen() {
  const router = useRouter();
  const {
    user,
    signOut,
    biometricEnabled,
    biometricAvailable,
    setBiometricEnabled,
  } = useAuth();

  const confirmSignOut = () =>
    Alert.alert("Sign out", "You'll need to sign in again to view your records.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: signOut },
    ]);

  return (
    <Screen scroll>
      <Card style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.name ?? "?").slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={typography.h3}>{user?.name ?? "Patient"}</Text>
          <Text style={typography.bodyMuted}>{user?.email}</Text>
        </View>
      </Card>

      <Section title="Security">
        <Row
          icon="finger-print-outline"
          label="Biometric unlock"
          subtitle={
            biometricAvailable
              ? "Require Face ID / fingerprint to open the app"
              : "Not available on this device"
          }
          right={
            <Switch
              value={biometricEnabled && biometricAvailable}
              disabled={!biometricAvailable}
              onValueChange={setBiometricEnabled}
              trackColor={{ true: colors.accent }}
            />
          }
        />
      </Section>

      <Section title="Privacy">
        <Row
          icon="shield-checkmark-outline"
          label="Privacy & Data Rights"
          subtitle="Export your data, opt-outs, account deletion"
          onPress={() => router.push("/(app)/settings/privacy")}
          chevron
        />
        <Row
          icon="document-text-outline"
          label="Privacy Policy"
          onPress={() => Linking.openURL("https://tabulamedica.us/privacy-policy")}
          chevron
        />
        <Row
          icon="reader-outline"
          label="Terms of Service"
          onPress={() => Linking.openURL("https://tabulamedica.us/terms-of-service")}
          chevron
        />
      </Section>

      <Section title="Support">
        <Row
          icon="help-circle-outline"
          label="Help & FAQ"
          onPress={() => Linking.openURL("https://tabulamedica.us/faq")}
          chevron
        />
        <Row
          icon="mail-outline"
          label="Contact support"
          onPress={() => Linking.openURL("mailto:support@tabulamedica.health")}
          chevron
        />
      </Section>

      <Pressable onPress={confirmSignOut} style={styles.signOut}>
        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <Text style={styles.version}>
        Tabula Medica v{Constants.expoConfig?.version ?? "1.0.0"}
        {"  ·  "}
        {Constants.expoConfig?.ios?.bundleIdentifier ?? "com.tabulamedica.app"}
      </Text>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <Card style={{ padding: 0, overflow: "hidden" }}>{children}</Card>
    </View>
  );
}

function Row({
  icon,
  label,
  subtitle,
  right,
  onPress,
  chevron,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const content = (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={typography.body}>{label}</Text>
        {subtitle ? <Text style={typography.caption}>{subtitle}</Text> : null}
      </View>
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} /> : null}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.textInverse, fontSize: 22, fontWeight: "700" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSubtle,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  signOutText: { color: colors.danger, fontWeight: "600", fontSize: 16 },
  version: { textAlign: "center", color: colors.textSubtle, fontSize: 12, marginTop: spacing.lg },
});
