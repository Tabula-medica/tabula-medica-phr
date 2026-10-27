import React, { useState } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useSubscription, REVENUECAT_ENTITLEMENT_IDENTIFIER, presentPaywall } from "@/lib/revenuecat";
import { Spacing, BorderRadius } from "@/constants/theme";

const PRIVACY_URL = "https://tabulamedica.com/privacy";
const TERMS_URL = "https://tabulamedica.com/terms";
const CONSUMER_HEALTH_URL = "https://tabulamedica.com/consumer-health-privacy";

interface ProFeature {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
}

interface FreeFeature {
  icon: keyof typeof Feather.glyphMap;
  title: string;
}

const FREE_FEATURES: FreeFeature[] = [
  { icon: "heart", title: "View all health records (FHIR R4)" },
  { icon: "link", title: "Connect 1 health source" },
  { icon: "globe", title: "50-language record translation" },
  { icon: "lock", title: "Biometric authentication" },
  { icon: "cpu", title: "Basic AI health insights" },
  { icon: "bell", title: "Medication reminders" },
  { icon: "file-text", title: "Insurance card storage" },
  { icon: "calendar", title: "Appointment tracking" },
];

const PRO_FEATURES: ProFeature[] = [
  {
    icon: "link",
    title: "Unlimited Health Sources",
    description:
      "Connect all your hospitals, clinics, and pharmacies. Free plan includes 1.",
  },
  {
    icon: "layers",
    title: "AI Record Deduplication",
    description:
      "Automatically detect and merge duplicate records across providers.",
  },
  {
    icon: "message-circle",
    title: "Secure Messaging",
    description:
      "HIPAA-compliant messaging directly with your care team.",
  },
  {
    icon: "users",
    title: "Family Health Hub",
    description:
      "Manage health records for your entire family in one place.",
  },
  {
    icon: "activity",
    title: "Clinical Decision Support",
    description:
      "Drug interaction alerts, care gap detection, and prior auth letters.",
  },
  {
    icon: "download-cloud",
    title: "Bulk Export",
    description:
      "Export all records in FHIR JSON, C-CDA, and other clinical formats.",
  },
  {
    icon: "smile",
    title: "Dental Integrations",
    description:
      "Connect dental records from OpenDental, Dentrix, and Eaglesoft.",
  },
  {
    icon: "file-text",
    title: "Good Faith Estimates",
    description:
      "Generate and track price estimates for upcoming procedures.",
  },
];

export default function PaywallScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const {
    selectedPackage,
    isSubscribed,
    isLoading,
    isConfigured,
    purchase,
    purchaseError,
    restore,
    restoreError,
    isPurchasing,
    isRestoring,
    resetPurchaseError,
  } = useSubscription();
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);

  const priceString = selectedPackage?.product?.priceString || "$10";
  const periodLabel = "/year";

  const handleUpgrade = async () => {
    if (!isConfigured || presenting) return;
    setPresenting(true);
    resetPurchaseError();
    try {
      await presentPaywall();
    } finally {
      setPresenting(false);
    }
  };

  const handleRestore = async () => {
    setRestoreMessage(null);
    try {
      const info = await restore();
      const hasActive =
        info?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
      setRestoreMessage(
        hasActive
          ? "Purchases restored successfully!"
          : "No active subscriptions found for this account.",
      );
    } catch {
      setRestoreMessage("Could not restore purchases. Please try again.");
    }
  };

  const openPrivacy = async () => {
    try {
      await Linking.openURL(PRIVACY_URL);
    } catch {}
  };

  const openTerms = async () => {
    try {
      await Linking.openURL(TERMS_URL);
    } catch {}
  };

  const openConsumerHealth = async () => {
    try {
      await Linking.openURL(CONSUMER_HEALTH_URL);
    } catch {}
  };

  if (isSubscribed) {
    return (
      <ThemedView style={styles.container}>
        <View
          style={[
            styles.subscribedContent,
            { paddingTop: headerHeight + Spacing.xl },
          ]}
        >
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: theme.success + "15" },
            ]}
          >
            <Feather name="check-circle" size={48} color={theme.success} />
          </View>
          <ThemedText style={styles.heroTitle}>You're a Pro</ThemedText>
          <ThemedText
            style={[styles.heroSubtitle, { color: theme.textSecondary }]}
          >
            All Professional features are unlocked. Thank you for supporting
            Tabula Medica.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(500).delay(100)}
          style={styles.heroSection}
        >
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: theme.primary + "15" },
            ]}
          >
            <Feather name="award" size={48} color={theme.primary} />
          </View>
          <ThemedText style={styles.heroTitle}>
            Tabula Medica Professional
          </ThemedText>
          <ThemedText
            style={[styles.heroSubtitle, { color: theme.textSecondary }]}
          >
            Unlock the full power of your health records with advanced AI tools
            and compliance features.
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(200)}>
          <View
            style={[
              styles.priceBadge,
              { backgroundColor: theme.primary + "12" },
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <>
                <ThemedText
                  style={[styles.priceAmount, { color: theme.primary }]}
                >
                  {priceString}
                </ThemedText>
                <ThemedText
                  style={[styles.pricePeriod, { color: theme.textSecondary }]}
                >
                  {periodLabel}
                </ThemedText>
              </>
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(300)}>
          <ThemedText
            style={[styles.sectionLabel, { color: theme.textSecondary }]}
          >
            INCLUDED IN PROFESSIONAL
          </ThemedText>
        </Animated.View>

        {PRO_FEATURES.map((feature, index) => (
          <Animated.View
            key={feature.title}
            entering={FadeInDown.duration(400).delay(350 + index * 80)}
          >
            <Card variant="glass" style={styles.featureCard}>
              <View style={styles.featureRow}>
                <View
                  style={[
                    styles.featureIconWrap,
                    { backgroundColor: theme.primary + "15" },
                  ]}
                >
                  <Feather
                    name={feature.icon}
                    size={20}
                    color={theme.primary}
                  />
                </View>
                <View style={styles.featureText}>
                  <ThemedText style={styles.featureTitle}>
                    {feature.title}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.featureDesc,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {feature.description}
                  </ThemedText>
                </View>
              </View>
            </Card>
          </Animated.View>
        ))}

        <Animated.View entering={FadeInDown.duration(500).delay(850)}>
          <Card variant="outlined" style={styles.freeIncludedCard}>
            <View style={styles.freeHeaderRow}>
              <Feather name="check-circle" size={18} color={theme.success} />
              <ThemedText style={[styles.freeTitle, { color: theme.success }]}>
                Always Free
              </ThemedText>
            </View>
            <ThemedText
              style={[styles.freeDesc, { color: theme.textSecondary }]}
            >
              These core features are free forever — no trial, no expiration.
            </ThemedText>
            <View style={styles.freeFeatureList}>
              {FREE_FEATURES.map((f) => (
                <View key={f.title} style={styles.freeFeatureRow}>
                  <Feather name={f.icon} size={15} color={theme.success} />
                  <ThemedText style={[styles.freeFeatureText, { color: theme.text }]}>
                    {f.title}
                  </ThemedText>
                </View>
              ))}
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(950)}>
          {purchaseError && !purchaseError.userCancelled ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={16} color="#FF3B30" />
              <ThemedText style={styles.errorText}>
                {purchaseError.message}
              </ThemedText>
            </View>
          ) : null}

          <Pressable
            onPress={handleUpgrade}
            disabled={presenting || isLoading || !isConfigured}
            style={({ pressed }) => [
              styles.upgradeButton,
              {
                backgroundColor: theme.primary,
                opacity:
                  pressed || presenting || !isConfigured ? 0.65 : 1,
              },
            ]}
            testID="button-upgrade-pro"
          >
            {presenting ? (
              <ActivityIndicator color="#FFFFFF" style={styles.buttonIcon} />
            ) : (
              <Feather
                name="zap"
                size={20}
                color="#FFFFFF"
                style={styles.buttonIcon}
              />
            )}
            <ThemedText style={styles.upgradeButtonText}>
              Upgrade for {priceString}/Year
            </ThemedText>
          </Pressable>

          {!isConfigured ? (
            <ThemedText
              style={[styles.unavailableText, { color: theme.textSecondary }]}
            >
              In-app purchases are not available in this environment.
            </ThemedText>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(1050)}>
          <View style={styles.legalSection}>
            <ThemedText
              style={[styles.legalConsentText, { color: theme.textSecondary }]}
            >
              By subscribing, you agree to our{" "}
              <ThemedText
                style={[styles.legalInlineLink, { color: theme.primary }]}
                onPress={openTerms}
              >
                Terms of Service
              </ThemedText>
              {" "}and{" "}
              <ThemedText
                style={[styles.legalInlineLink, { color: theme.primary }]}
                onPress={openPrivacy}
              >
                Privacy Policy
              </ThemedText>
              .
            </ThemedText>

            <ThemedText
              style={[styles.legalHeading, { color: theme.textSecondary }]}
            >
              Standard Apple Subscription Terms:
            </ThemedText>

            <ThemedText
              style={[styles.legalNote, { color: theme.textSecondary }]}
            >
              Payment will be charged to your iTunes Account at confirmation of
              purchase. Subscription automatically renews for $10/year unless
              auto-renew is turned off at least 24 hours before the end of the
              current period. Your account will be charged for renewal within
              24 hours prior to the end of the current period. You can manage
              or turn off auto-renew in your Apple ID Account Settings at any
              time after purchase.
            </ThemedText>

            <View style={styles.consumerHealthSection}>
              <ThemedText
                style={[styles.legalNote, { color: theme.textSecondary }]}
              >
                Washington & California Residents: View our{" "}
                <ThemedText
                  style={[styles.legalInlineLink, { color: theme.primary }]}
                  onPress={openConsumerHealth}
                  testID="link-consumer-health"
                >
                  Consumer Health Data Privacy Policy
                </ThemedText>
                {" "}regarding your rights to data access and deletion.
              </ThemedText>
            </View>

            <View style={styles.legalLinks}>
              <Pressable onPress={openPrivacy} testID="link-privacy-policy">
                <ThemedText
                  style={[styles.legalLink, { color: theme.primary }]}
                >
                  Privacy Policy
                </ThemedText>
              </Pressable>

              <ThemedText
                style={[
                  styles.legalSeparator,
                  { color: theme.textSecondary },
                ]}
              >
                |
              </ThemedText>

              <Pressable onPress={openTerms} testID="link-terms-of-use">
                <ThemedText
                  style={[styles.legalLink, { color: theme.primary }]}
                >
                  Terms of Use
                </ThemedText>
              </Pressable>

              <ThemedText
                style={[
                  styles.legalSeparator,
                  { color: theme.textSecondary },
                ]}
              >
                |
              </ThemedText>

              <Pressable onPress={openConsumerHealth} testID="link-consumer-health-footer">
                <ThemedText
                  style={[styles.legalLink, { color: theme.primary }]}
                >
                  Consumer Health Privacy
                </ThemedText>
              </Pressable>
            </View>

            <Pressable
              onPress={handleRestore}
              disabled={isRestoring}
              testID="button-restore-purchases"
            >
              <ThemedText
                style={[styles.restoreText, { color: theme.textSecondary }]}
              >
                {isRestoring
                  ? "Restoring..."
                  : "Already subscribed? Tap to restore purchases."}
              </ThemedText>
            </Pressable>

            {restoreMessage ? (
              <ThemedText
                style={[styles.restoreResult, { color: theme.textSecondary }]}
              >
                {restoreMessage}
              </ThemedText>
            ) : null}
          </View>
        </Animated.View>
      </ScrollView>

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  subscribedContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  heroSection: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: Spacing.md,
  },
  priceBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    alignSelf: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    minHeight: 70,
    justifyContent: "center",
  },
  priceAmount: {
    fontSize: 40,
    fontWeight: "800",
  },
  pricePeriod: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
    paddingLeft: Spacing.xs,
  },
  featureCard: {
    marginBottom: Spacing.sm,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  freeIncludedCard: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  freeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  freeTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginLeft: Spacing.xs,
  },
  freeDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  freeFeatureList: {
    gap: 8,
  },
  freeFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  freeFeatureText: {
    fontSize: 14,
    flex: 1,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    backgroundColor: "rgba(255,59,48,0.08)",
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  errorText: {
    fontSize: 13,
    color: "#FF3B30",
    flex: 1,
  },
  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  buttonIcon: {
    marginRight: Spacing.sm,
  },
  upgradeButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  unavailableText: {
    fontSize: 12,
    textAlign: "center",
    marginTop: -Spacing.md,
    marginBottom: Spacing.md,
  },
  legalSection: {
    alignItems: "center",
    paddingHorizontal: Spacing.md,
  },
  legalConsentText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  legalInlineLink: {
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  legalHeading: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  legalNote: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  consumerHealthSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(142,142,147,0.3)",
    paddingTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  legalLinks: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  legalLink: {
    fontSize: 13,
    fontWeight: "600",
  },
  legalSeparator: {
    fontSize: 13,
    marginHorizontal: Spacing.sm,
  },
  restoreText: {
    fontSize: 12,
    textAlign: "center",
  },
  restoreResult: {
    fontSize: 12,
    textAlign: "center",
    marginTop: Spacing.xs,
    fontWeight: "500",
  },
});
