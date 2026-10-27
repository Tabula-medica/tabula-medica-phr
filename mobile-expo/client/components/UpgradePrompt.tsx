import React, { useState, useCallback } from "react";
import {
  View,
  Modal,
  Pressable,
  StyleSheet,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { presentPaywall, useSubscription } from "@/lib/revenuecat";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/feature-flags";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const FEATURE_INFO: Record<string, { title: string; description: string; icon: keyof typeof Feather.glyphMap }> = {
  ai_summaries: {
    title: "AI Health Summaries",
    description: "Get intelligent summaries of your complete health record powered by advanced AI.",
    icon: "cpu",
  },
  ai_dedup: {
    title: "AI Record Deduplication",
    description: "Automatically detect and merge duplicate records from multiple providers.",
    icon: "layers",
  },
  unlimited_fhir: {
    title: "Unlimited Health Sources",
    description: "Connect all your hospitals, clinics, and pharmacies in one place. Free plan includes 1 source.",
    icon: "link",
  },
  advanced_export: {
    title: "Advanced Export",
    description: "Export your health records in FHIR, C-CDA, and other clinical formats.",
    icon: "download",
  },
  bulk_export: {
    title: "Bulk Export",
    description: "Export all your records at once in FHIR JSON, C-CDA, and more clinical formats.",
    icon: "download-cloud",
  },
  provider_sharing: {
    title: "Provider Sharing",
    description: "Securely share your records with healthcare providers.",
    icon: "share-2",
  },
  secure_messaging: {
    title: "Secure Messaging",
    description: "Send HIPAA-compliant messages directly to your care team.",
    icon: "message-circle",
  },
  cds: {
    title: "Clinical Decision Support",
    description: "Get real-time drug interaction alerts, care gap detection, and prior authorization letters.",
    icon: "alert-circle",
  },
  npi_lookup: {
    title: "Provider Lookup",
    description: "Search and verify providers by NPI number with full credential details.",
    icon: "search",
  },
  dental_integrations: {
    title: "Dental Integrations",
    description: "Connect your dental records from OpenDental, Dentrix, and Eaglesoft.",
    icon: "smile",
  },
  gfe: {
    title: "Good Faith Estimates",
    description: "Generate and receive Good Faith Estimates for upcoming procedures.",
    icon: "file-text",
  },
  family_hub: {
    title: "Family Health Hub",
    description: "Manage health records for your family members in one secure place.",
    icon: "users",
  },
  dicom_viewer: {
    title: "DICOM Image Viewer",
    description: "View and analyze your medical imaging studies (X-rays, CT, MRI, ultrasound) directly on your device.",
    icon: "image",
  },
  ambient_encounter: {
    title: "Ambient Encounter Notes",
    description: "Record visits and get AI-generated SOAP notes, action items, and translations.",
    icon: "mic",
  },
  advanced_fhir_search: {
    title: "Advanced FHIR Search",
    description: "Run complex multi-parameter searches across your health record with AI-suggested queries.",
    icon: "filter",
  },
  prior_auth: {
    title: "Prior Authorization",
    description: "Generate and submit prior authorization letters for medications and procedures.",
    icon: "file-text",
  },
  drug_interactions: {
    title: "Drug Interaction Checks",
    description: "Get real-time alerts on dangerous drug-drug, drug-allergy, and dosing interactions.",
    icon: "alert-triangle",
  },
  care_gaps: {
    title: "Care Gap Detection",
    description: "AI-driven detection of missed screenings, vaccinations, and overdue preventive care.",
    icon: "target",
  },
  provider_collaboration: {
    title: "Provider Collaboration",
    description: "Coordinate care across your providers with shared notes and tasks.",
    icon: "users",
  },
  ai_soap_note: {
    title: "AI SOAP Notes",
    description: "Convert free-text clinical notes into structured SOAP format with entity extraction, coding suggestions, and AI refinement.",
    icon: "file-text",
  },
};

const DEFAULT_FEATURE = {
  title: "Professional Feature",
  description: "Upgrade to Tabula Medica Professional to unlock this feature and more.",
  icon: "lock" as keyof typeof Feather.glyphMap,
};

export type UpgradePromptProps = {
  visible: boolean;
  featureKey: string | null;
  onDismiss: () => void;
  overrideTitle?: string;
  overrideDescription?: string;
};

export function useFeatureGate() {
  const { isSubscribed } = useSubscription();
  const [promptVisible, setPromptVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState<string | null>(null);

  const checkFeature = useCallback(
    (featureKey: string): boolean => {
      if (isSubscribed) return true;
      setActiveFeature(featureKey);
      setPromptVisible(true);
      return false;
    },
    [isSubscribed],
  );

  const promptProps: UpgradePromptProps = {
    visible: promptVisible,
    featureKey: activeFeature,
    onDismiss: () => setPromptVisible(false),
  };

  return { checkFeature, promptProps, isSubscribed };
}

export default function UpgradePrompt({ visible, featureKey, onDismiss, overrideTitle, overrideDescription }: UpgradePromptProps) {
  const { theme, isDark } = useTheme();
  const [loading, setLoading] = useState(false);

  if (!SUBSCRIPTIONS_ENABLED) return null;

  const baseInfo = featureKey ? FEATURE_INFO[featureKey] || DEFAULT_FEATURE : DEFAULT_FEATURE;
  const info = {
    title: overrideTitle || baseInfo.title,
    description: overrideDescription || baseInfo.description,
    icon: baseInfo.icon,
  };

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const purchased = await presentPaywall();
      if (purchased) {
        onDismiss();
      }
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        <BlurView intensity={isDark ? 40 : 30} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill} />

        <Animated.View
          entering={SlideInDown.springify().damping(18).stiffness(140)}
          exiting={SlideOutDown.duration(200)}
          style={[
            styles.card,
            {
              backgroundColor: isDark ? theme.glassModal : theme.backgroundDefault,
              borderColor: theme.glassBorder,
            },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: theme.primary + "18" }]}>
            <Feather name={info.icon} size={28} color={theme.primary} />
          </View>

          <ThemedText style={styles.title}>{info.title}</ThemedText>
          <ThemedText style={[styles.description, { color: theme.textSecondary }]}>
            {info.description}
          </ThemedText>

          <Pressable
            testID="button-upgrade-prompt"
            style={({ pressed }) => [
              styles.upgradeButton,
              { backgroundColor: theme.primary, opacity: pressed || loading ? 0.85 : 1 },
            ]}
            onPress={handleUpgrade}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Upgrade to Professional"
          >
            <Feather name="star" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <ThemedText style={styles.upgradeText}>
              {loading ? "Loading..." : "Upgrade to Professional"}
            </ThemedText>
          </Pressable>

          <Pressable
            testID="button-upgrade-dismiss"
            style={styles.dismissButton}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Not now"
          >
            <ThemedText style={[styles.dismissText, { color: theme.textSecondary }]}>
              Not Now
            </ThemedText>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: SCREEN_WIDTH - Spacing.xl * 2,
    maxWidth: 380,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: "center",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    width: "100%",
    minHeight: 48,
  },
  upgradeText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  dismissButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  dismissText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
