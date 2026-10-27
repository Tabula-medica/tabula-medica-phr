import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
  Text,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { LoadingState, BaseModal, Button } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: string;
  pointsAwarded: number;
  earned: boolean;
  earnedAt?: string;
}

interface GamificationProfile {
  id: string;
  userId: string;
  totalPoints: number;
  currentLevel: number;
  levelProgress: number;
  currentStreak: number;
  longestStreak: number;
  goalsCompleted: number;
  recordsLogged: number;
  daysActive: number;
  leaderboardOptIn: boolean;
  displayName: string | null;
  earnedBadges: any[];
  recentTransactions: PointTransaction[];
  nextLevelPoints: number;
  progressToNextLevel: number;
}

interface PointTransaction {
  id: string;
  points: number;
  reason: string;
  category: string;
  createdAt: string;
}

interface LeaderboardEntry {
  displayName: string;
  totalPoints: number;
  currentLevel: number;
  currentStreak: number;
}

const TIER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  bronze: { bg: "#CD7F32", border: "#8B4513", text: "#FFFFFF" },
  silver: { bg: "#C0C0C0", border: "#808080", text: "#1F2937" },
  gold: { bg: "#FFD700", border: "#DAA520", text: "#1F2937" },
  platinum: { bg: "#E5E4E2", border: "#A0AEC0", text: "#1F2937" },
};

const CATEGORY_ICONS: Record<string, string> = {
  milestones: "flag",
  goals: "target",
  streaks: "zap",
  logging: "clipboard",
  achievements: "award",
  daily: "calendar",
};

function LevelRing({ level, progress, size = 120 }: { level: number; progress: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (progress / 100) * circumference;

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="levelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#0066CC" />
            <Stop offset="100%" stopColor="#00BFFF" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(0, 102, 204, 0.2)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#levelGradient)"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={progressOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ fontSize: 32, fontWeight: "700", color: "#0066CC" }}>
          {level}
        </Text>
        <ThemedText type="small" style={{ color: "#6B7280", marginTop: -4 }}>
          LEVEL
        </ThemedText>
      </View>
    </View>
  );
}

function BadgeCard({ badge, theme, isDark }: { badge: Badge; theme: any; isDark: boolean }) {
  const tierColors = TIER_COLORS[badge.tier] || TIER_COLORS.bronze;
  const isEarned = badge.earned;

  return (
    <Animated.View
      entering={FadeInDown.delay(100).springify()}
      style={[
        styles.badgeCard,
        {
          backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)",
          borderColor: isEarned ? tierColors.border : "rgba(156, 163, 175, 0.3)",
          opacity: isEarned ? 1 : 0.5,
        },
      ]}
    >
      <View
        style={[
          styles.badgeIcon,
          {
            backgroundColor: isEarned ? tierColors.bg : "#E5E7EB",
          },
        ]}
      >
        <Feather
          name={badge.icon as any}
          size={20}
          color={isEarned ? tierColors.text : "#9CA3AF"}
        />
      </View>
      <View style={styles.badgeContent}>
        <Text style={{ fontWeight: "600", color: theme.text }} numberOfLines={1}>
          {badge.name}
        </Text>
        <ThemedText type="small" style={{ color: theme.textSecondary }} numberOfLines={2}>
          {badge.description}
        </ThemedText>
        {isEarned && badge.earnedAt ? (
          <ThemedText type="small" style={{ color: "#10B981", marginTop: 4 }}>
            Earned {new Date(badge.earnedAt).toLocaleDateString()}
          </ThemedText>
        ) : null}
      </View>
      <View
        style={[
          styles.tierBadge,
          { backgroundColor: isEarned ? tierColors.bg : "#E5E7EB" },
        ]}
      >
        <Text style={{ color: isEarned ? tierColors.text : "#9CA3AF", fontWeight: "600", fontSize: 10 }}>
          {badge.tier.toUpperCase()}
        </Text>
      </View>
    </Animated.View>
  );
}

function StatCard({ icon, label, value, color, theme, isDark }: { icon: string; label: string; value: string | number; color: string; theme: any; isDark: boolean }) {
  return (
    <View
      style={[
        styles.statCard,
        { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)" },
      ]}
    >
      <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <Text style={{ fontSize: 20, fontWeight: "600", color }}>
        {value}
      </Text>
      <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
        {label}
      </ThemedText>
    </View>
  );
}

function TransactionItem({ transaction, theme }: { transaction: PointTransaction; theme: any }) {
  const categoryIcon = CATEGORY_ICONS[transaction.category] || "plus";
  const formattedReason = transaction.reason
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <View style={styles.transactionItem}>
      <View style={[styles.transactionIcon, { backgroundColor: "rgba(16, 185, 129, 0.1)" }]}>
        <Feather name={categoryIcon as any} size={14} color="#10B981" />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText type="body" numberOfLines={1}>
          {formattedReason}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {new Date(transaction.createdAt).toLocaleDateString()}
        </ThemedText>
      </View>
      <Text style={{ fontWeight: "600", color: "#10B981" }}>
        +{transaction.points}
      </Text>
    </View>
  );
}

function LeaderboardItem({ entry, rank, theme, isDark }: { entry: LeaderboardEntry; rank: number; theme: any; isDark: boolean }) {
  const rankColors = ["#FFD700", "#C0C0C0", "#CD7F32"];
  const rankColor = rank <= 3 ? rankColors[rank - 1] : theme.textSecondary;

  return (
    <View
      style={[
        styles.leaderboardItem,
        { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.7)" },
      ]}
    >
      <View style={[styles.rankBadge, { backgroundColor: rank <= 3 ? rankColor : "#E5E7EB" }]}>
        <Text style={{ fontWeight: "600", color: rank <= 3 ? "#FFFFFF" : "#6B7280", fontSize: 12 }}>
          {rank}
        </Text>
      </View>
      <View style={{ flex: 1, marginLeft: Spacing.md }}>
        <Text style={{ fontWeight: "600", color: theme.text }}>{entry.displayName}</Text>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          Level {entry.currentLevel}
        </ThemedText>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontWeight: "600", color: "#0066CC" }}>
          {entry.totalPoints.toLocaleString()} pts
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Feather name="zap" size={12} color="#F59E0B" />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 2 }}>
            {entry.currentStreak} day streak
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

export default function GamificationScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<"overview" | "badges" | "leaderboard">("overview");
  const [showOptInModal, setShowOptInModal] = useState(false);
  const [displayName, setDisplayName] = useState("");

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery<GamificationProfile>({
    queryKey: ["/api/gamification/profile"],
  });

  const { data: badgesData, isLoading: badgesLoading } = useQuery<{
    available: Badge[];
    earnedCount: number;
    totalCount: number;
  }>({
    queryKey: ["/api/gamification/badges"],
  });

  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery<{
    leaderboard: LeaderboardEntry[];
    userOptedIn: boolean;
    userDisplayName: string | null;
  }>({
    queryKey: ["/api/gamification/leaderboard"],
    enabled: selectedTab === "leaderboard",
  });

  const { data: motivation } = useQuery<{ message: string }>({
    queryKey: ["/api/gamification/motivation"],
  });

  const checkInMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/gamification/check-in"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/profile"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const optInMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest("POST", "/api/gamification/leaderboard/opt-in", { displayName: name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/leaderboard"] });
      setShowOptInModal(false);
      setDisplayName("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const optOutMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/gamification/leaderboard/opt-out"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/leaderboard"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const handleCheckIn = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    checkInMutation.mutate();
  }, []);

  const handleOptIn = useCallback(() => {
    if (displayName.length >= 3) {
      optInMutation.mutate(displayName);
    }
  }, [displayName]);

  if (profileLoading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight }]}>
        <LoadingState message="Loading your progress..." />
      </ThemedView>
    );
  }

  const badges = badgesData?.available || [];
  const earnedBadges = badges.filter((b) => b.earned);
  const unearnedBadges = badges.filter((b) => !b.earned);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={() => refetchProfile()} tintColor="#0066CC" />
        }
      >
        {profile ? (
          <>
            <Animated.View entering={FadeIn.duration(400)} style={styles.levelSection}>
              <LevelRing level={profile.currentLevel} progress={profile.progressToNextLevel} />
              <View style={styles.levelInfo}>
                <ThemedText type="h1" style={{ fontSize: 28 }}>
                  {profile.totalPoints.toLocaleString()}
                </ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Total Points
                </ThemedText>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${profile.progressToNextLevel}%` },
                    ]}
                  />
                </View>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {Math.round(profile.nextLevelPoints - profile.totalPoints)} pts to Level {profile.currentLevel + 1}
                </ThemedText>
              </View>
            </Animated.View>

            {motivation?.message ? (
              <Animated.View
                entering={FadeInDown.delay(200)}
                style={[
                  styles.motivationCard,
                  { backgroundColor: isDark ? "rgba(0, 102, 204, 0.15)" : "rgba(0, 102, 204, 0.08)" },
                ]}
              >
                <Feather name="message-circle" size={20} color="#0066CC" />
                <ThemedText type="body" style={{ flex: 1, marginLeft: Spacing.sm, color: theme.text }}>
                  {motivation.message}
                </ThemedText>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(300)} style={styles.statsGrid}>
              <StatCard icon="zap" label="Current Streak" value={`${profile.currentStreak} days`} color="#F59E0B" theme={theme} isDark={isDark} />
              <StatCard icon="award" label="Longest Streak" value={`${profile.longestStreak} days`} color="#8B5CF6" theme={theme} isDark={isDark} />
              <StatCard icon="target" label="Goals Done" value={profile.goalsCompleted} color="#10B981" theme={theme} isDark={isDark} />
              <StatCard icon="file-text" label="Records" value={profile.recordsLogged} color="#0066CC" theme={theme} isDark={isDark} />
            </Animated.View>

            <Button
              onPress={handleCheckIn}
              loading={checkInMutation.isPending}
              disabled={checkInMutation.isPending}
              icon="check-circle"
              fullWidth
              style={styles.checkInButton}
              testID="button-check-in"
            >
              Daily Check-In
            </Button>

            <View style={styles.tabContainer}>
              {(["overview", "badges", "leaderboard"] as const).map((tab) => (
                <Pressable
                  key={tab}
                  style={[
                    styles.tab,
                    selectedTab === tab && styles.tabActive,
                    selectedTab === tab && { borderColor: "#0066CC" },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedTab(tab);
                  }}
                >
                  <ThemedText
                    type="body"
                    style={{
                      color: selectedTab === tab ? "#0066CC" : theme.textSecondary,
                      fontSize: 14,
                    }}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {selectedTab === "overview" ? (
              <Animated.View entering={FadeIn}>
                <ThemedText type="h3" style={{ marginBottom: Spacing.md }}>
                  Recent Activity
                </ThemedText>
                {profile.recentTransactions.length > 0 ? (
                  profile.recentTransactions.slice(0, 10).map((transaction) => (
                    <TransactionItem key={transaction.id} transaction={transaction} theme={theme} />
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Feather name="activity" size={40} color={theme.textSecondary} />
                    <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                      Start earning points by logging health data!
                    </ThemedText>
                  </View>
                )}
              </Animated.View>
            ) : null}

            {selectedTab === "badges" ? (
              <Animated.View entering={FadeIn}>
                <View style={styles.badgeHeader}>
                  <ThemedText type="h3">
                    Badges Earned ({earnedBadges.length}/{badges.length})
                  </ThemedText>
                </View>
                
                {earnedBadges.length > 0 ? (
                  <>
                    <ThemedText type="body" style={{ marginBottom: Spacing.sm, color: "#10B981" }}>
                      Earned
                    </ThemedText>
                    {earnedBadges.map((badge) => (
                      <BadgeCard key={badge.id} badge={badge} theme={theme} isDark={isDark} />
                    ))}
                  </>
                ) : null}

                {unearnedBadges.length > 0 ? (
                  <>
                    <ThemedText type="body" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm, color: theme.textSecondary }}>
                      Locked
                    </ThemedText>
                    {unearnedBadges.map((badge) => (
                      <BadgeCard key={badge.id} badge={badge} theme={theme} isDark={isDark} />
                    ))}
                  </>
                ) : null}
              </Animated.View>
            ) : null}

            {selectedTab === "leaderboard" ? (
              <Animated.View entering={FadeIn}>
                <View style={styles.leaderboardHeader}>
                  <ThemedText type="h3">Top Health Champions</ThemedText>
                  {leaderboardData?.userOptedIn ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        optOutMutation.mutate();
                      }}
                      style={styles.optOutButton}
                      testID="button-opt-out"
                    >
                      Leave Leaderboard
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      icon="plus"
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowOptInModal(true);
                      }}
                      style={styles.optInButton}
                      testID="button-opt-in"
                    >
                      Join
                    </Button>
                  )}
                </View>

                <View style={[styles.privacyNote, { backgroundColor: isDark ? "rgba(251, 191, 36, 0.1)" : "rgba(251, 191, 36, 0.15)" }]}>
                  <Feather name="shield" size={16} color="#F59E0B" />
                  <ThemedText type="small" style={{ flex: 1, marginLeft: Spacing.sm, color: theme.textSecondary }}>
                    Privacy-first: Only users who opt-in appear here with their chosen display name.
                  </ThemedText>
                </View>

                {leaderboardLoading ? (
                  <LoadingState size="small" style={{ marginTop: Spacing.xl }} />
                ) : leaderboardData?.leaderboard && leaderboardData.leaderboard.length > 0 ? (
                  leaderboardData.leaderboard.map((entry, index) => (
                    <LeaderboardItem
                      key={index}
                      entry={entry}
                      rank={index + 1}
                      theme={theme}
                      isDark={isDark}
                    />
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Feather name="users" size={40} color={theme.textSecondary} />
                    <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
                      No one has joined the leaderboard yet.{"\n"}Be the first!
                    </ThemedText>
                  </View>
                )}
              </Animated.View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <BaseModal
        visible={showOptInModal}
        onClose={() => setShowOptInModal(false)}
        title="Join the Leaderboard"
        scrollable={false}
        testID="modal-opt-in"
      >
        <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
          Choose a display name to appear on the leaderboard. Your real name won't be shown.
        </ThemedText>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F3F4F6",
              color: theme.text,
            },
          ]}
          placeholder="Display Name (min 3 characters)"
          placeholderTextColor={theme.textSecondary}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="none"
        />
        <View style={styles.modalButtons}>
          <Button
            variant="secondary"
            onPress={() => setShowOptInModal(false)}
            style={{ flex: 1 }}
            testID="button-modal-cancel"
          >
            Cancel
          </Button>
          <Button
            onPress={handleOptIn}
            disabled={displayName.length < 3 || optInMutation.isPending}
            loading={optInMutation.isPending}
            style={{ flex: 1 }}
            testID="button-modal-join"
          >
            Join
          </Button>
        </View>
      </BaseModal>
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
  levelSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  levelInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  progressBar: {
    height: 6,
    backgroundColor: "rgba(0, 102, 204, 0.2)",
    borderRadius: 3,
    marginVertical: Spacing.sm,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#0066CC",
    borderRadius: 3,
  },
  motivationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -Spacing.xs,
    marginBottom: Spacing.lg,
  },
  statCard: {
    width: "48%",
    marginHorizontal: "1%",
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  checkInButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  tabContainer: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderBottomWidth: 2,
    borderColor: "transparent",
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  transactionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl * 2,
  },
  badgeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  badgeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  badgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeContent: {
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
  },
  tierBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  leaderboardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  optInButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B981",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  optOutButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  privacyNote: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  leaderboardItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: 16,
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
});
