import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface NppSection {
  id: string;
  title: string;
  content: string;
  badge?: string;
}

interface NppData {
  currentVersion: string;
  effectiveDate: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  previousAcknowledgments: { version: string; acknowledgedAt: string }[];
  npp: {
    title: string;
    lastUpdated: string;
    effectiveDate: string;
    sections: NppSection[];
  };
}

export default function PrivacyPracticesScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const { data: nppData, isLoading, refetch, isRefetching } = useQuery<NppData>({
    queryKey: ["/api/compliance/npp"],
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/compliance/npp/acknowledge");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/npp"] });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/2026-status"] });
      setShowConfirmModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const toggleSection = useCallback((sectionId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (nppData?.npp.sections) {
      setExpandedSections(new Set(nppData.npp.sections.map(s => s.id)));
    }
  }, [nppData]);

  const collapseAll = useCallback(() => {
    setExpandedSections(new Set());
  }, []);

  const getSectionIcon = (sectionId: string): keyof typeof Feather.glyphMap => {
    const icons: Record<string, keyof typeof Feather.glyphMap> = {
      "overview": "info",
      "sud-protections": "shield",
      "reproductive-health": "heart",
      "your-rights": "check-circle",
      "information-blocking": "unlock",
      "data-uses": "database",
      "security": "lock",
      "contact": "mail",
    };
    return icons[sectionId] || "file-text";
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundRoot, paddingTop: headerHeight }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
          Loading Privacy Practices...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + Spacing.md, paddingBottom: Spacing.xl * 3 }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {nppData ? (
          <>
            <Animated.View entering={FadeIn.duration(300)} style={[styles.headerCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <View style={[styles.headerIconContainer, { backgroundColor: `${theme.primary}15` }]}>
                <Feather name="file-text" size={28} color={theme.primary} />
              </View>
              <ThemedText type="h2" style={{ color: theme.text, textAlign: "center", marginTop: Spacing.md }}>
                {nppData.npp.title}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs }}>
                Version {nppData.currentVersion}
              </ThemedText>
              <View style={styles.dateRow}>
                <View style={[styles.dateBadge, { backgroundColor: `${theme.info}15` }]}>
                  <Feather name="calendar" size={12} color={theme.info} />
                  <ThemedText type="small" style={{ color: theme.info, marginLeft: 4 }}>
                    Updated: {nppData.npp.lastUpdated}
                  </ThemedText>
                </View>
                <View style={[styles.dateBadge, { backgroundColor: `${theme.warning}15` }]}>
                  <Feather name="clock" size={12} color={theme.warning} />
                  <ThemedText type="small" style={{ color: theme.warning, marginLeft: 4 }}>
                    Effective: {nppData.effectiveDate}
                  </ThemedText>
                </View>
              </View>

              {nppData.acknowledged ? (
                <View style={[styles.statusBanner, { backgroundColor: `${theme.success}12` }]}>
                  <Feather name="check-circle" size={16} color={theme.success} />
                  <ThemedText type="body" style={{ color: theme.success, marginLeft: Spacing.xs, flex: 1 }}>
                    Acknowledged on {new Date(nppData.acknowledgedAt!).toLocaleDateString()}
                  </ThemedText>
                </View>
              ) : (
                <View style={[styles.statusBanner, { backgroundColor: `${theme.warning}12` }]}>
                  <Feather name="alert-triangle" size={16} color={theme.warning} />
                  <ThemedText type="body" style={{ color: theme.warning, marginLeft: Spacing.xs, flex: 1 }}>
                    Review and acknowledgment required
                  </ThemedText>
                </View>
              )}
            </Animated.View>

            <View style={styles.controlRow}>
              <Pressable
                onPress={expandAll}
                style={[styles.controlButton, { backgroundColor: `${theme.primary}12` }]}
              >
                <Feather name="maximize-2" size={14} color={theme.primary} />
                <ThemedText type="small" style={{ color: theme.primary, marginLeft: 4 }}>Expand All</ThemedText>
              </Pressable>
              <Pressable
                onPress={collapseAll}
                style={[styles.controlButton, { backgroundColor: `${theme.textSecondary}12` }]}
              >
                <Feather name="minimize-2" size={14} color={theme.textSecondary} />
                <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>Collapse All</ThemedText>
              </Pressable>
            </View>

            {nppData.npp.sections.map((section, index) => {
              const isExpanded = expandedSections.has(section.id);
              return (
                <Animated.View
                  key={section.id}
                  entering={FadeInDown.delay(index * 60).duration(300)}
                >
                  <Pressable
                    onPress={() => toggleSection(section.id)}
                    style={[styles.sectionCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                    testID={`npp-section-${section.id}`}
                  >
                    <View style={styles.sectionHeader}>
                      <View style={[styles.sectionIconWrap, { backgroundColor: `${theme.primary}10` }]}>
                        <Feather name={getSectionIcon(section.id)} size={18} color={theme.primary} />
                      </View>
                      <View style={styles.sectionTitleArea}>
                        <View style={styles.sectionTitleRow}>
                          <ThemedText type="body" style={{ color: theme.text, flex: 1, fontWeight: "600" }}>
                            {section.title}
                          </ThemedText>
                          {section.badge ? (
                            <View style={[
                              styles.badge,
                              { backgroundColor: section.badge.includes("NEW") ? `${theme.error}15` : `${theme.info}15` }
                            ]}>
                              <ThemedText type="small" style={{
                                color: section.badge.includes("NEW") ? theme.error : theme.info,
                                fontWeight: "700",
                                fontSize: 10,
                              }}>
                                {section.badge}
                              </ThemedText>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <Feather
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={theme.textSecondary}
                      />
                    </View>

                    {isExpanded ? (
                      <Animated.View entering={FadeIn.duration(200)} style={styles.sectionContent}>
                        <View style={[styles.contentDivider, { backgroundColor: theme.border }]} />
                        <ThemedText type="body" style={{ color: theme.text, lineHeight: 22 }}>
                          {section.content}
                        </ThemedText>
                      </Animated.View>
                    ) : null}
                  </Pressable>
                </Animated.View>
              );
            })}

            {!nppData.acknowledged ? (
              <Animated.View entering={FadeInDown.delay(500).duration(300)}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowConfirmModal(true);
                  }}
                  style={[styles.acknowledgeButton, { backgroundColor: theme.primary }]}
                  testID="button-acknowledge-npp"
                >
                  <Feather name="check" size={20} color="#FFFFFF" />
                  <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.sm, fontWeight: "600" }}>
                    I Have Read and Acknowledge This Notice
                  </ThemedText>
                </Pressable>
              </Animated.View>
            ) : null}

            {nppData.previousAcknowledgments.length > 0 ? (
              <Animated.View entering={FadeInDown.delay(600).duration(300)} style={[styles.historyCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <ThemedText type="body" style={{ color: theme.text, marginBottom: Spacing.sm, fontWeight: "600" }}>
                  Acknowledgment History
                </ThemedText>
                {nppData.previousAcknowledgments.map((ack, i) => (
                  <View key={i} style={[styles.historyRow, i > 0 ? { borderTopWidth: 1, borderTopColor: theme.border } : undefined]}>
                    <Feather name="check-circle" size={14} color={theme.success} />
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                      Version {ack.version} - {new Date(ack.acknowledgedAt).toLocaleDateString()}
                    </ThemedText>
                  </View>
                ))}
              </Animated.View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={[styles.modalIcon, { backgroundColor: `${theme.primary}15` }]}>
              <Feather name="shield" size={32} color={theme.primary} />
            </View>
            <ThemedText type="h3" style={{ color: theme.text, textAlign: "center", marginBottom: Spacing.sm }}>
              Confirm Acknowledgment
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginBottom: Spacing.lg }}>
              By acknowledging, you confirm that you have read and understood the Notice of Privacy Practices, including the updated 2026 protections for Substance Use Disorder records and reproductive health information.
            </ThemedText>
            <Pressable
              onPress={() => acknowledgeMutation.mutate()}
              disabled={acknowledgeMutation.isPending}
              style={[styles.modalButton, { backgroundColor: theme.primary, opacity: acknowledgeMutation.isPending ? 0.7 : 1 }]}
              testID="button-confirm-acknowledge"
            >
              {acknowledgeMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#FFFFFF" />
                  <ThemedText type="body" style={{ color: "#FFFFFF", marginLeft: Spacing.xs, fontWeight: "600" }}>
                    Confirm
                  </ThemedText>
                </>
              )}
            </Pressable>
            <Pressable
              onPress={() => setShowConfirmModal(false)}
              style={[styles.modalCancelButton, { borderColor: theme.border }]}
            >
              <ThemedText type="body" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  headerCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  dateRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    width: "100%",
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  sectionTitleArea: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sectionContent: {
    marginTop: Spacing.sm,
  },
  contentDivider: {
    height: 1,
    marginBottom: Spacing.sm,
  },
  acknowledgeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  historyCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    width: "100%",
  },
  modalCancelButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    width: "100%",
    marginTop: Spacing.sm,
  },
});
