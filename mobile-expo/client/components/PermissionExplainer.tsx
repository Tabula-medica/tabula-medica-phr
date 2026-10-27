import React, { useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

type PermissionType = "camera" | "photos" | "location" | "contacts" | "notifications" | "biometrics" | "microphone" | "health";

interface PermissionConfig {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  headline: string;
  reason: string;
  bullets: string[];
  privacyNote: string;
}

const PERMISSION_CONFIGS: Record<PermissionType, PermissionConfig> = {
  camera: {
    icon: "camera",
    title: "Camera Access",
    headline: "Scan your insurance card or medical documents",
    reason: "Tabula Medica needs camera access to photograph your insurance cards, prescriptions, and medical documents so they can be securely digitized into your health record.",
    bullets: [
      "Photos are processed on-device and encrypted before storage",
      "Camera is only active while you are scanning",
      "No images are shared without your explicit consent",
    ],
    privacyNote: "You can revoke camera access anytime in Settings.",
  },
  photos: {
    icon: "image",
    title: "Photo Library Access",
    headline: "Upload existing photos of medical documents",
    reason: "Tabula Medica needs access to your photo library so you can select existing photos of insurance cards, lab results, or prescriptions to add to your health record.",
    bullets: [
      "Only photos you select are accessed",
      "Selected images are encrypted before upload",
      "Your photo library is never browsed automatically",
    ],
    privacyNote: "You can change photo access anytime in Settings.",
  },
  location: {
    icon: "map-pin",
    title: "Location Access",
    headline: "Find nearby healthcare providers",
    reason: "Tabula Medica uses your location to find hospitals, clinics, and pharmacies near you for faster record imports and provider lookups.",
    bullets: [
      "Location is only used while the app is open",
      "Your location is never stored or shared",
      "Used solely for provider search results",
    ],
    privacyNote: "You can disable location access anytime in Settings.",
  },
  contacts: {
    icon: "users",
    title: "Contacts Access",
    headline: "Add emergency contacts and family members",
    reason: "Tabula Medica can read your contacts to help you quickly add emergency contacts and family members to your health profile.",
    bullets: [
      "Only contacts you select are used",
      "Contact data is not uploaded to our servers",
      "Used for emergency contact and caregiver setup",
    ],
    privacyNote: "You can revoke contacts access anytime in Settings.",
  },
  notifications: {
    icon: "bell",
    title: "Notification Access",
    headline: "Medication reminders and health alerts",
    reason: "Tabula Medica sends notifications for medication reminders, appointment alerts, and important health record updates.",
    bullets: [
      "Notifications never contain your health data",
      "You control which notifications you receive",
      "No marketing or promotional notifications",
    ],
    privacyNote: "You can manage notifications anytime in Settings.",
  },
  biometrics: {
    icon: "shield",
    title: "Biometric Authentication",
    headline: "Protect your health records with Face ID or Touch ID",
    reason: "Tabula Medica uses biometric authentication to ensure only you can access your encrypted health records, meeting HIPAA security requirements.",
    bullets: [
      "Your biometric data never leaves your device",
      "Biometrics are processed by your device's secure enclave",
      "Passcode fallback is always available",
    ],
    privacyNote: "Required for HIPAA-compliant health record access.",
  },
  microphone: {
    icon: "mic",
    title: "Microphone Access",
    headline: "Transcribe your medical appointments",
    reason: "Tabula Medica can transcribe your medical consultations so you never miss important instructions from your provider.",
    bullets: [
      "Recording only starts when you tap the record button",
      "Audio is encrypted and processed securely",
      "Transcripts are stored in your encrypted health record",
    ],
    privacyNote: "You can revoke microphone access anytime in Settings.",
  },
  health: {
    icon: "heart",
    title: "Health Data Access",
    headline: "Import your health data from Apple Health",
    reason: "Tabula Medica can read your Apple Health data to provide a complete picture of your health, including vitals, activity, and lab results from connected devices.",
    bullets: [
      "Only the data categories you approve are accessed",
      "Health data is encrypted end-to-end",
      "Data never leaves your device without your consent",
    ],
    privacyNote: "You control exactly which health categories are shared.",
  },
};

interface PermissionExplainerProps {
  type: PermissionType;
  onAllow: () => void | Promise<void>;
  onDeny?: () => void;
  denied?: boolean;
  loading?: boolean;
}

export function PermissionExplainer({
  type,
  onAllow,
  onDeny,
  denied = false,
  loading = false,
}: PermissionExplainerProps) {
  const { theme, isDark } = useTheme();
  const config = PERMISSION_CONFIGS[type];
  const [pressing, setPressing] = useState(false);

  const handleAllow = async () => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
    setPressing(true);
    try {
      await onAllow();
    } finally {
      setPressing(false);
    }
  };

  const handleOpenSettings = async () => {
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
    if (Platform.OS !== "web") {
      try { await Linking.openSettings(); } catch {}
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.iconContainer}>
        <View style={[styles.iconCircle, { backgroundColor: theme.primary + "15" }]}>
          <View style={[styles.iconInner, { backgroundColor: theme.primary + "25" }]}>
            <Feather name={config.icon} size={36} color={theme.primary} />
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.textSection}>
        <ThemedText style={[styles.title, { color: theme.text }]}>
          {config.title}
        </ThemedText>
        <ThemedText style={[styles.headline, { color: theme.text }]}>
          {config.headline}
        </ThemedText>
        <ThemedText style={[styles.reason, { color: theme.textSecondary }]}>
          {config.reason}
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.bulletsSection}>
        {config.bullets.map((bullet, i) => (
          <View
            key={i}
            style={[styles.bulletRow, { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)" }]}
          >
            <Feather name="check-circle" size={16} color={theme.success} />
            <ThemedText style={[styles.bulletText, { color: theme.text }]}>
              {bullet}
            </ThemedText>
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.privacyRow}>
        <Feather name="lock" size={14} color={theme.textSecondary} />
        <ThemedText style={[styles.privacyText, { color: theme.textSecondary }]}>
          {config.privacyNote}
        </ThemedText>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.buttonSection}>
        {denied ? (
          <>
            <View style={[styles.deniedBanner, { backgroundColor: theme.warning + "15" }]}>
              <Feather name="alert-circle" size={16} color={theme.warning} />
              <ThemedText style={[styles.deniedText, { color: theme.warning }]}>
                Permission was denied. Please enable it in Settings.
              </ThemedText>
            </View>
            {Platform.OS !== "web" ? (
              <Button
                onPress={handleOpenSettings}
                variant="primary"
                icon="settings"
                fullWidth
                testID="button-open-settings"
              >
                Open Settings
              </Button>
            ) : null}
          </>
        ) : (
          <Button
            onPress={handleAllow}
            variant="primary"
            icon={config.icon}
            loading={loading || pressing}
            fullWidth
            testID={`button-allow-${type}`}
            accessibilityLabel={`Allow ${config.title}`}
            accessibilityHint={config.headline}
          >
            Allow {config.title}
          </Button>
        )}

        {onDeny && !denied ? (
          <Button
            onPress={onDeny}
            variant="ghost"
            fullWidth
            testID={`button-skip-${type}`}
          >
            Not Now
          </Button>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing["2xl"],
  },
  iconContainer: {
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  iconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  textSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  headline: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  reason: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: Spacing.md,
  },
  bulletsSection: {
    width: "100%",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  bulletText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.xl,
  },
  privacyText: {
    fontSize: 13,
  },
  buttonSection: {
    width: "100%",
    gap: Spacing.sm,
  },
  deniedBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  deniedText: {
    fontSize: 14,
    flex: 1,
  },
});
