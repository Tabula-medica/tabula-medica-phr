import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInRight } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface DuplicateCandidate {
  id: string;
  primaryPatient: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    middleName: string | null;
    middleNameStatus: string | null;
    dateOfBirth: string | null;
    email: string | null;
    phone: string | null;
  };
  duplicatePatient: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    middleName: string | null;
    middleNameStatus: string | null;
    dateOfBirth: string | null;
    email: string | null;
    phone: string | null;
  };
  similarityScore: number;
  matchedFields: Record<string, number>;
  autoMergeEligible: boolean;
  createdAt: string;
}

interface DeduplicationStats {
  totalPatients: number;
  pendingDuplicates: number;
  autoMerged: number;
  manuallyResolved: number;
  confirmedUnique: number;
}

const COMPARISON_FIELDS = [
  { key: "firstName", label: "First Name" },
  { key: "middleName", label: "Middle Name" },
  { key: "lastName", label: "Last Name" },
  { key: "dateOfBirth", label: "Date of Birth" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
];

function StatsCard({
  icon,
  label,
  value,
  color,
  theme,
  delay = 0,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: number;
  color: string;
  theme: ReturnType<typeof useTheme>["theme"];
  delay?: number;
}) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).springify()}>
      <Card style={styles.statsCard}>
        <View style={[styles.statsIconContainer, { backgroundColor: color + "20" }]}>
          <Feather name={icon} size={20} color={color} />
        </View>
        <ThemedText style={styles.statsValue}>{value}</ThemedText>
        <ThemedText style={[styles.statsLabel, { color: theme.textSecondary }]}>
          {label}
        </ThemedText>
      </Card>
    </Animated.View>
  );
}

function MatchScoreBadge({ score, theme }: { score: number; theme: ReturnType<typeof useTheme>["theme"] }) {
  const percentage = Math.round(score * 100);
  let backgroundColor = theme.success;
  let label = "High Match";
  let icon: keyof typeof Feather.glyphMap = "check-circle";

  if (percentage >= 95) {
    backgroundColor = "#10b981";
    label = "Auto-Merge Ready";
    icon = "zap";
  } else if (percentage >= 90) {
    backgroundColor = "#22c55e";
    label = "Very High";
    icon = "check-circle";
  } else if (percentage >= 85) {
    backgroundColor = "#eab308";
    label = "High";
    icon = "alert-circle";
  } else {
    backgroundColor = "#f97316";
    label = "Moderate";
    icon = "alert-triangle";
  }

  return (
    <View style={[styles.matchScoreBadge, { backgroundColor }]}>
      <Feather name={icon} size={14} color="#fff" />
      <ThemedText style={styles.matchScoreText}>
        {percentage}% - {label}
      </ThemedText>
    </View>
  );
}

function ComparisonTable({
  primaryPatient,
  duplicatePatient,
  matchedFields,
  theme,
}: {
  primaryPatient: DuplicateCandidate["primaryPatient"];
  duplicatePatient: DuplicateCandidate["duplicatePatient"];
  matchedFields: Record<string, number>;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const formatValue = (key: string, value: string | null, status?: string | null) => {
    if (key === "middleName") {
      if (status === "no_middle_name") return "NMN";
      if (status === "unknown" || !value) return "UNK";
      return value;
    }
    if (key === "dateOfBirth" && value) {
      return new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    return value || "—";
  };

  const isDifferent = (key: string) => {
    const val1 = (primaryPatient as any)[key];
    const val2 = (duplicatePatient as any)[key];
    if (!val1 && !val2) return false;
    if (!val1 || !val2) return true;
    return val1.toString().toLowerCase() !== val2.toString().toLowerCase();
  };

  const getMatchScore = (key: string) => matchedFields[key];

  return (
    <View style={[styles.comparisonTable, { backgroundColor: theme.backgroundSecondary }]}>
      <View style={[styles.tableHeader, { borderBottomColor: theme.border }]}>
        <View style={styles.tableHeaderCell}>
          <ThemedText style={[styles.tableHeaderText, { color: theme.textSecondary }]}>
            FIELD
          </ThemedText>
        </View>
        <View style={styles.tableHeaderCell}>
          <ThemedText style={[styles.tableHeaderText, { color: theme.textSecondary }]}>
            NEW RECORD
          </ThemedText>
        </View>
        <View style={styles.tableHeaderCell}>
          <ThemedText style={[styles.tableHeaderText, { color: theme.textSecondary }]}>
            EXISTING RECORD
          </ThemedText>
        </View>
      </View>

      {COMPARISON_FIELDS.map((field, index) => {
        const hasDifference = isDifferent(field.key);
        const score = getMatchScore(field.key);
        const primaryValue = formatValue(
          field.key,
          (primaryPatient as any)[field.key],
          field.key === "middleName" ? primaryPatient.middleNameStatus : null
        );
        const duplicateValue = formatValue(
          field.key,
          (duplicatePatient as any)[field.key],
          field.key === "middleName" ? duplicatePatient.middleNameStatus : null
        );

        return (
          <Animated.View
            key={field.key}
            entering={SlideInRight.delay(index * 50)}
            style={[
              styles.tableRow,
              { borderBottomColor: theme.border + "40" },
              index % 2 === 0 && { backgroundColor: theme.backgroundDefault + "60" },
            ]}
          >
            <View style={styles.tableCell}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {field.label}
              </ThemedText>
            </View>
            <View style={styles.tableCell}>
              <ThemedText style={styles.fieldValue}>{primaryValue}</ThemedText>
            </View>
            <View style={styles.tableCell}>
              <View style={styles.existingValueContainer}>
                <ThemedText
                  style={[
                    styles.fieldValue,
                    hasDifference && styles.differenceHighlight,
                    hasDifference && { backgroundColor: "#fef3c7" },
                  ]}
                >
                  {duplicateValue}
                </ThemedText>
                {score !== undefined ? (
                  <View
                    style={[
                      styles.matchIndicator,
                      {
                        backgroundColor:
                          score >= 0.95 ? theme.success + "20" :
                          score >= 0.8 ? "#eab30820" : "#f9731620",
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.matchIndicatorText,
                        {
                          color:
                            score >= 0.95 ? theme.success :
                            score >= 0.8 ? "#eab308" : "#f97316",
                        },
                      ]}
                    >
                      {Math.round(score * 100)}%
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

function SafetyWarning({ theme }: { theme: ReturnType<typeof useTheme>["theme"] }) {
  return (
    <Animated.View
      entering={FadeIn.delay(300)}
      style={[styles.safetyWarning, { backgroundColor: "#fef3c7", borderColor: "#fde68a" }]}
    >
      <Feather name="alert-triangle" size={18} color="#d97706" style={styles.safetyIcon} />
      <View style={styles.safetyContent}>
        <ThemedText style={[styles.safetyTitle, { color: "#92400e" }]}>
          Check Carefully
        </ThemedText>
        <ThemedText style={[styles.safetyText, { color: "#a16207" }]}>
          Merging these records will combine all medical history. If these are not the same person, select "This isn't me" to prevent record overlay.
        </ThemedText>
      </View>
    </Animated.View>
  );
}

function PatientMatchReviewCard({
  candidate,
  onResolve,
  isResolving,
  theme,
}: {
  candidate: DuplicateCandidate;
  onResolve: (id: string, resolution: "confirmed_duplicate" | "confirmed_unique", notes?: string) => void;
  isResolving: boolean;
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState<"merge" | "unique" | null>(null);

  const handleMerge = () => {
    setIsProcessing("merge");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onResolve(candidate.id, "confirmed_duplicate", notes);
  };

  const handleReject = () => {
    setIsProcessing("unique");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onResolve(candidate.id, "confirmed_unique", notes);
  };

  return (
    <Card style={styles.reviewCard}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setExpanded(!expanded);
        }}
        style={styles.reviewCardHeader}
      >
        <View style={styles.reviewHeaderLeft}>
          <View style={[styles.shieldIcon, { backgroundColor: theme.primary + "15" }]}>
            <Feather name="shield" size={20} color={theme.primary} />
          </View>
          <View style={styles.reviewHeaderInfo}>
            <ThemedText style={styles.reviewHeaderTitle}>Verify Your Identity</ThemedText>
            <ThemedText style={[styles.reviewHeaderSubtitle, { color: theme.textSecondary }]}>
              We found a potential match
            </ThemedText>
          </View>
        </View>
        <View style={styles.reviewHeaderRight}>
          <MatchScoreBadge score={candidate.similarityScore} theme={theme} />
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={theme.textSecondary}
          />
        </View>
      </Pressable>

      {expanded ? (
        <Animated.View entering={FadeInDown.springify()} style={styles.reviewCardContent}>
          <View style={styles.patientNames}>
            <View style={[styles.patientNameBadge, { backgroundColor: theme.primary + "15" }]}>
              <Feather name="user" size={14} color={theme.primary} />
              <ThemedText style={[styles.patientNameText, { color: theme.primary }]}>
                {candidate.primaryPatient.firstName} {candidate.primaryPatient.lastName}
              </ThemedText>
            </View>
            <Feather name="arrow-right" size={16} color={theme.textSecondary} />
            <View style={[styles.patientNameBadge, { backgroundColor: theme.success + "15" }]}>
              <Feather name="user-check" size={14} color={theme.success} />
              <ThemedText style={[styles.patientNameText, { color: theme.success }]}>
                {candidate.duplicatePatient.firstName} {candidate.duplicatePatient.lastName}
              </ThemedText>
            </View>
          </View>

          <ComparisonTable
            primaryPatient={candidate.primaryPatient}
            duplicatePatient={candidate.duplicatePatient}
            matchedFields={candidate.matchedFields}
            theme={theme}
          />

          <SafetyWarning theme={theme} />

          <View style={styles.notesContainer}>
            <ThemedText style={[styles.notesLabel, { color: theme.textSecondary }]}>
              Review Notes (Optional)
            </ThemedText>
            <TextInput
              style={[
                styles.notesInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Add notes about this review decision..."
              placeholderTextColor={theme.textSecondary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />
          </View>

          <View style={styles.actionButtons}>
            <Pressable
              style={[
                styles.actionButton,
                styles.rejectButton,
                { borderColor: theme.textSecondary },
                (isResolving || isProcessing) && styles.buttonDisabled,
              ]}
              onPress={handleReject}
              disabled={isResolving || isProcessing !== null}
            >
              {isProcessing === "unique" ? (
                <ActivityIndicator size="small" color={theme.textSecondary} />
              ) : (
                <>
                  <Feather name="x" size={18} color={theme.textSecondary} />
                  <ThemedText style={[styles.rejectButtonText, { color: theme.textSecondary }]}>
                    This isn't me
                  </ThemedText>
                </>
              )}
            </Pressable>
            <Pressable
              style={[
                styles.actionButton,
                styles.confirmButton,
                { backgroundColor: theme.primary },
                (isResolving || isProcessing) && styles.buttonDisabled,
              ]}
              onPress={handleMerge}
              disabled={isResolving || isProcessing !== null}
            >
              {isProcessing === "merge" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#fff" />
                  <ThemedText style={styles.confirmButtonText}>
                    Yes, Merge Records
                  </ThemedText>
                </>
              )}
            </Pressable>
          </View>

          <View style={[styles.auditNote, { backgroundColor: theme.backgroundDefault }]}>
            <Feather name="lock" size={14} color={theme.textSecondary} />
            <ThemedText style={[styles.auditNoteText, { color: theme.textSecondary }]}>
              This action will be logged for HIPAA compliance
            </ThemedText>
          </View>
        </Animated.View>
      ) : null}
    </Card>
  );
}

export default function DuplicateReviewScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<DeduplicationStats>({
    queryKey: ["/api/deduplication/stats"],
  });

  const { data: candidates, isLoading: candidatesLoading, refetch } = useQuery<DuplicateCandidate[]>({
    queryKey: ["/api/deduplication/pending"],
  });

  const resolveMutation = useMutation({
    mutationFn: async ({
      id,
      resolution,
      notes,
    }: {
      id: string;
      resolution: "confirmed_duplicate" | "confirmed_unique";
      notes?: string;
    }) => {
      const res = await apiRequest("POST", `/api/deduplication/resolve/${id}`, { resolution, notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deduplication/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deduplication/pending"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Alert.alert("Error", "Failed to resolve duplicate. Please try again.");
    },
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/deduplication/scan");
      return res.json();
    },
    onSuccess: (result: { autoMerged: number; flaggedForReview: number; newRecords: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deduplication/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deduplication/pending"] });
      Alert.alert(
        "Scan Complete",
        `Scanned records:\n\n• Auto-merged: ${result.autoMerged}\n• Flagged for review: ${result.flaggedForReview}\n• Unique records: ${result.newRecords}`
      );
    },
    onError: () => {
      Alert.alert("Error", "Failed to run deduplication scan.");
    },
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleResolve = (
    id: string,
    resolution: "confirmed_duplicate" | "confirmed_unique",
    notes?: string
  ) => {
    resolveMutation.mutate({ id, resolution, notes });
  };

  const handleRunScan = () => {
    Alert.alert(
      "Run Deduplication Scan",
      "This will scan all patient records for potential duplicates using the MPI algorithm.\n\nContinue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Run Scan",
          style: "default",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            scanMutation.mutate();
          },
        },
      ]
    );
  };

  const isLoading = statsLoading || candidatesLoading;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <Animated.View entering={FadeInDown.delay(100)} style={styles.header}>
          <View>
            <ThemedText style={styles.title}>Patient Match Review</ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              Verify your identity to prevent record errors
            </ThemedText>
          </View>
          <Pressable
            style={[
              styles.scanButton,
              { backgroundColor: theme.primary },
              scanMutation.isPending && { opacity: 0.5 },
            ]}
            onPress={handleRunScan}
            disabled={scanMutation.isPending}
          >
            {scanMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="search" size={16} color="#fff" />
                <ThemedText style={styles.scanButtonText}>Scan</ThemedText>
              </>
            )}
          </Pressable>
        </Animated.View>

        <View style={styles.statsGrid}>
          <StatsCard
            icon="users"
            label="Total Records"
            value={stats?.totalPatients || 0}
            color={theme.primary}
            theme={theme}
            delay={0}
          />
          <StatsCard
            icon="alert-circle"
            label="Pending"
            value={stats?.pendingDuplicates || 0}
            color="#f97316"
            theme={theme}
            delay={50}
          />
          <StatsCard
            icon="git-merge"
            label="Merged"
            value={stats?.autoMerged || 0}
            color={theme.success}
            theme={theme}
            delay={100}
          />
          <StatsCard
            icon="check-circle"
            label="Resolved"
            value={stats?.manuallyResolved || 0}
            color="#22c55e"
            theme={theme}
            delay={150}
          />
        </View>

        <Animated.View entering={FadeInDown.delay(200)} style={styles.candidatesSection}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              Pending Reviews ({candidates?.length || 0})
            </ThemedText>
          </View>

          {isLoading ? (
            <Card style={styles.emptyCard}>
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                Loading records...
              </ThemedText>
            </Card>
          ) : candidates && candidates.length > 0 ? (
            candidates.map((candidate, index) => (
              <Animated.View key={candidate.id} entering={FadeInDown.delay(250 + index * 100)}>
                <PatientMatchReviewCard
                  candidate={candidate}
                  onResolve={handleResolve}
                  isResolving={resolveMutation.isPending}
                  theme={theme}
                />
              </Animated.View>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.success + "20" }]}>
                <Feather name="check-circle" size={48} color={theme.success} />
              </View>
              <ThemedText style={styles.emptyTitle}>All Clear</ThemedText>
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No duplicate candidates pending review
              </ThemedText>
            </Card>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400)}>
          <Card style={styles.infoCard}>
            <View style={[styles.infoHeader, { borderBottomColor: theme.border }]}>
              <Feather name="info" size={18} color={theme.primary} />
              <ThemedText style={styles.infoTitle}>
                How Match Detection Works
              </ThemedText>
            </View>
            <View style={styles.infoContent}>
              <View style={styles.infoStep}>
                <View style={[styles.stepNumber, { backgroundColor: theme.primary + "20" }]}>
                  <ThemedText style={[styles.stepNumberText, { color: theme.primary }]}>1</ThemedText>
                </View>
                <View style={styles.stepContent}>
                  <ThemedText style={styles.stepTitle}>Deterministic Match</ThemedText>
                  <ThemedText style={[styles.stepText, { color: theme.textSecondary }]}>
                    Exact matches on SSN, MRN, or Email + DOB
                  </ThemedText>
                </View>
              </View>
              <View style={styles.infoStep}>
                <View style={[styles.stepNumber, { backgroundColor: theme.primary + "20" }]}>
                  <ThemedText style={[styles.stepNumberText, { color: theme.primary }]}>2</ThemedText>
                </View>
                <View style={styles.stepContent}>
                  <ThemedText style={styles.stepTitle}>Probabilistic Match</ThemedText>
                  <ThemedText style={[styles.stepText, { color: theme.textSecondary }]}>
                    Fuzzy matching using Levenshtein distance
                  </ThemedText>
                </View>
              </View>
              <View style={styles.thresholds}>
                <View style={styles.thresholdItem}>
                  <View style={[styles.thresholdDot, { backgroundColor: "#10b981" }]} />
                  <ThemedText style={[styles.thresholdText, { color: theme.textSecondary }]}>
                    95%+ Auto-Merge
                  </ThemedText>
                </View>
                <View style={styles.thresholdItem}>
                  <View style={[styles.thresholdDot, { backgroundColor: "#eab308" }]} />
                  <ThemedText style={[styles.thresholdText, { color: theme.textSecondary }]}>
                    80-95% Review
                  </ThemedText>
                </View>
                <View style={styles.thresholdItem}>
                  <View style={[styles.thresholdDot, { backgroundColor: "#ef4444" }]} />
                  <ThemedText style={[styles.thresholdText, { color: theme.textSecondary }]}>
                    &lt;80% New Record
                  </ThemedText>
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(500)}>
          <Card style={[styles.nmnInfoCard, { borderColor: theme.primary + "30" }]}>
            <View style={styles.nmnHeader}>
              <Feather name="user" size={18} color={theme.primary} />
              <ThemedText style={styles.nmnTitle}>NMN Standard</ThemedText>
            </View>
            <ThemedText style={[styles.nmnText, { color: theme.textSecondary }]}>
              "NMN" indicates No Middle Name was explicitly recorded, not just left blank. This reduces duplicates when importing from different systems.
            </ThemedText>
          </Card>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  scanButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  statsCard: {
    flex: 1,
    minWidth: 150,
    alignItems: "center",
    padding: Spacing.md,
  },
  statsIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  statsValue: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  statsLabel: {
    fontSize: 12,
    textAlign: "center",
  },
  candidatesSection: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  reviewCard: {
    marginBottom: Spacing.md,
    padding: 0,
    overflow: "hidden",
  },
  reviewCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
  },
  reviewHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  shieldIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewHeaderInfo: {
    flex: 1,
  },
  reviewHeaderTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  reviewHeaderSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  reviewHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  matchScoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  matchScoreText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  reviewCardContent: {
    padding: Spacing.md,
    paddingTop: 0,
    gap: Spacing.md,
  },
  patientNames: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  patientNameBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  patientNameText: {
    fontSize: 13,
    fontWeight: "600",
  },
  comparisonTable: {
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  tableHeaderCell: {
    flex: 1,
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  tableCell: {
    flex: 1,
    justifyContent: "center",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  fieldValue: {
    fontSize: 14,
  },
  existingValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    flexWrap: "wrap",
  },
  differenceHighlight: {
    fontWeight: "700",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  matchIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  matchIndicatorText: {
    fontSize: 10,
    fontWeight: "600",
  },
  safetyWarning: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  safetyIcon: {
    marginTop: 2,
  },
  safetyContent: {
    flex: 1,
  },
  safetyTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  safetyText: {
    fontSize: 12,
    lineHeight: 18,
  },
  notesContainer: {
    gap: Spacing.xs,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  notesInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: "top",
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  rejectButton: {
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  confirmButton: {},
  buttonDisabled: {
    opacity: 0.5,
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  confirmButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  auditNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  auditNoteText: {
    fontSize: 11,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  infoCard: {
    padding: 0,
    overflow: "hidden",
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  infoContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  infoStep: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: "700",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  stepText: {
    fontSize: 12,
  },
  thresholds: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  thresholdItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  thresholdDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  thresholdText: {
    fontSize: 12,
  },
  nmnInfoCard: {
    padding: Spacing.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  nmnHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  nmnTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  nmnText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
