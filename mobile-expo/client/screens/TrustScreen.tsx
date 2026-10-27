import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface TrustItemProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  theme: any;
  index: number;
}

function TrustItem({ icon, title, description, theme, index }: TrustItemProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50)}
      style={[styles.trustItem, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={[styles.trustIcon, { backgroundColor: `${theme.primary}15` }]}>
        <Feather name={icon} size={24} color={theme.primary} />
      </View>
      <View style={styles.trustContent}>
        <ThemedText type="h4">{title}</ThemedText>
        <ThemedText style={[styles.trustDescription, { color: theme.textSecondary }]}>
          {description}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

export default function TrustScreen() {
  const { theme: colors } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const trustItems = [
    {
      icon: "lock" as const,
      title: "Encryption at Rest & In Transit",
      description: "All your health data is encrypted using AES-256 encryption at rest and TLS 1.3 for data in transit. Your information is protected at every step.",
    },
    {
      icon: "users" as const,
      title: "Role-Based Access Control (RBAC)",
      description: "Fine-grained permissions for Self, Caregiver, and Provider roles. Read-only packet access for healthcare providers you share with.",
    },
    {
      icon: "file-text" as const,
      title: "Complete Audit Logs",
      description: "Every access to your health records is logged. You can view and export your complete access history at any time for full transparency.",
    },
    {
      icon: "trash-2" as const,
      title: "Data Deletion on Request",
      description: "Exercise your right to be forgotten. Request complete deletion of your data and receive confirmation within 30 days per HIPAA requirements.",
    },
    {
      icon: "shield" as const,
      title: "HIPAA Compliant",
      description: "We maintain full compliance with the Health Insurance Portability and Accountability Act, including all technical, administrative, and physical safeguards.",
    },
    {
      icon: "award" as const,
      title: "SOC 2 Type II Aligned",
      description: "Our security practices align with SOC 2 Type II standards covering security, availability, processing integrity, confidentiality, and privacy.",
    },
  ];

  const handleContactSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL("mailto:privacy@tabulamedica.com");
  };

  const handleViewPrivacyPolicy = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRequestDeletion = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL("mailto:privacy@tabulamedica.com?subject=Data%20Deletion%20Request");
  };

  const handleExportAuditLog = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.delay(100)}>
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: `${colors.success}15` }]}>
              <Feather name="shield" size={32} color={colors.success} />
            </View>
            <ThemedText type="h1">Trust & Security</ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              How we protect your health information
            </ThemedText>
          </View>

          <View style={[styles.pledgeCard, { backgroundColor: colors.backgroundDefault, borderColor: colors.primary }]}>
            <Feather name="check-circle" size={24} color={colors.primary} />
            <View style={styles.pledgeContent}>
              <ThemedText type="h4" style={{ color: colors.primary }}>Our Promise to You</ThemedText>
              <ThemedText style={[styles.pledgeText, { color: colors.text }]}>
                We don't sell your Protected Health Information (PHI). Ever. Your health data belongs to you, and we're simply the secure vault that helps you access and share it on your terms.
              </ThemedText>
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="h3" style={styles.sectionTitle}>Security & Privacy</ThemedText>
            {trustItems.map((item, index) => (
              <TrustItem
                key={item.title}
                icon={item.icon}
                title={item.title}
                description={item.description}
                theme={colors}
                index={index}
              />
            ))}
          </View>

          <View style={styles.section}>
            <ThemedText type="h3" style={styles.sectionTitle}>Your Rights</ThemedText>
            
            <Animated.View entering={FadeInDown.delay(350)} style={[styles.rightCard, { backgroundColor: colors.backgroundDefault }]}>
              <ThemedText type="h4">Access Your Records</ThemedText>
              <ThemedText style={{ color: colors.textSecondary, marginTop: Spacing.xs }}>
                View and download all your health data at any time.
              </ThemedText>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(400)} style={[styles.rightCard, { backgroundColor: colors.backgroundDefault }]}>
              <ThemedText type="h4">Request Corrections</ThemedText>
              <ThemedText style={{ color: colors.textSecondary, marginTop: Spacing.xs }}>
                Submit requests to correct inaccurate information.
              </ThemedText>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(450)} style={[styles.rightCard, { backgroundColor: colors.backgroundDefault }]}>
              <ThemedText type="h4">Control Sharing</ThemedText>
              <ThemedText style={{ color: colors.textSecondary, marginTop: Spacing.xs }}>
                Decide who can access your records and revoke access instantly.
              </ThemedText>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(500)} style={[styles.rightCard, { backgroundColor: colors.backgroundDefault }]}>
              <ThemedText type="h4">Request Deletion</ThemedText>
              <ThemedText style={{ color: colors.textSecondary, marginTop: Spacing.xs }}>
                Exercise your right to be forgotten with complete data removal.
              </ThemedText>
            </Animated.View>
          </View>

          <View style={styles.section}>
            <ThemedText type="h3" style={styles.sectionTitle}>Quick Actions</ThemedText>
            
            <View style={styles.actionsGrid}>
              <Pressable
                style={[styles.actionCard, { backgroundColor: colors.backgroundDefault }]}
                onPress={handleExportAuditLog}
              >
                <View style={[styles.actionIcon, { backgroundColor: `${colors.primary}15` }]}>
                  <Feather name="download" size={20} color={colors.primary} />
                </View>
                <ThemedText style={styles.actionText}>Export Audit Log</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.actionCard, { backgroundColor: colors.backgroundDefault }]}
                onPress={handleViewPrivacyPolicy}
              >
                <View style={[styles.actionIcon, { backgroundColor: `${colors.primary}15` }]}>
                  <Feather name="file-text" size={20} color={colors.primary} />
                </View>
                <ThemedText style={styles.actionText}>Privacy Policy</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.actionCard, { backgroundColor: colors.backgroundDefault }]}
                onPress={handleContactSupport}
              >
                <View style={[styles.actionIcon, { backgroundColor: `${colors.primary}15` }]}>
                  <Feather name="mail" size={20} color={colors.primary} />
                </View>
                <ThemedText style={styles.actionText}>Contact Privacy Team</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.actionCard, { backgroundColor: colors.backgroundDefault, borderColor: colors.error, borderWidth: 1 }]}
                onPress={handleRequestDeletion}
              >
                <View style={[styles.actionIcon, { backgroundColor: `${colors.error}15` }]}>
                  <Feather name="trash-2" size={20} color={colors.error} />
                </View>
                <ThemedText style={[styles.actionText, { color: colors.error }]}>Request Deletion</ThemedText>
              </Pressable>
            </View>
          </View>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <ThemedText style={[styles.footerText, { color: colors.textSecondary }]}>
              Questions about your privacy? Email us at{" "}
              <ThemedText style={{ color: colors.primary }}>privacy@tabulamedica.com</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.version, { color: colors.textSecondary }]}>
              Last updated: February 1, 2026
            </ThemedText>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  subtitle: {
    marginTop: Spacing.xs,
    fontSize: 15,
    textAlign: "center",
  },
  pledgeCard: {
    flexDirection: "row",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  pledgeContent: {
    flex: 1,
  },
  pledgeText: {
    marginTop: Spacing.xs,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  trustItem: {
    flexDirection: "row",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  trustIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  trustContent: {
    flex: 1,
  },
  trustDescription: {
    marginTop: Spacing.xs,
    fontSize: 13,
    lineHeight: 18,
  },
  rightCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  actionCard: {
    width: "48%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  footer: {
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    alignItems: "center",
  },
  footerText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  version: {
    marginTop: Spacing.sm,
    fontSize: 12,
  },
});
