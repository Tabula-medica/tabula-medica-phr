import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Svg, { Circle } from "react-native-svg";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { axiosInstance } from "@/lib/api";

interface Team {
  id: string;
  name: string;
  description: string | null;
  iconName: string;
  teamColor: string;
  conditionFocus: string | null;
  memberCount?: number;
  currentMembers: number;
  maxMembers: number | null;
  captainId: string;
  totalPoints: number;
  weeklyPoints: number;
  monthlyPoints: number;
  inviteCode: string | null;
  isPublic: boolean;
  isActive: boolean;
  createdAt: string;
  members?: TeamMember[];
}

interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: string;
  contributedPoints: number;
  weeklyContribution: number;
  lastContributionAt: string | null;
  joinedAt: string;
}

interface TeamMembership {
  id: string;
  userId: string;
  teamId: string;
  role: string;
  contributedPoints: number;
  weeklyContribution: number;
  joinedAt: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  challengeType: string;
  targetValue: number;
  targetUnit: string;
  startDate: string;
  endDate: string;
  pointsReward: number;
  status: string;
  minTeamSize: number | null;
  maxTeamSize: number | null;
  participantCount: number;
  isActive: boolean;
}

interface ChallengeParticipation {
  id: string;
  teamId: string;
  challengeId: string;
  currentProgress: number;
  targetProgress: number;
  progressPercentage: number;
  isCompleted: boolean;
  pointsEarned: number | null;
  completedAt: string | null;
  joinedAt: string;
}

interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  rank: number;
  points: number;
  memberCount: number;
}

interface Leaderboard {
  id: string;
  period: string;
  periodStart: string;
  rankings: LeaderboardEntry[];
  totalTeams: number;
  createdAt: string;
}

function ProgressRing({ progress, size = 48, strokeWidth = 4, color }: { progress: number; size?: number; color: string; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(0,0,0,0.1)" strokeWidth={strokeWidth} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

function ChallengeCard({
  challenge,
  participation,
  userTeam,
  onJoin,
  onContribute,
  theme,
  isDark,
}: {
  challenge: Challenge;
  participation?: ChallengeParticipation;
  userTeam: Team | null;
  onJoin: () => void;
  onContribute: () => void;
  theme: any;
  isDark: boolean;
}) {
  const isParticipating = !!participation;
  const daysLeft = Math.max(0, Math.ceil((new Date(challenge.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  const typeColors: Record<string, string> = {
    steps: "#10B981",
    exercise: "#3B82F6",
    medication: "#8B5CF6",
    nutrition: "#F59E0B",
    sleep: "#6366F1",
    mindfulness: "#EC4899",
  };
  const color = typeColors[challenge.challengeType] || "#4A90A4";

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
      <View
        style={[
          styles.challengeCard,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
          },
        ]}
      >
        <View style={styles.challengeHeader}>
          <View style={[styles.challengeIcon, { backgroundColor: `${color}20` }]}>
            <Feather name="target" size={20} color={color} />
          </View>
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <ThemedText type="h4" style={{ color: theme.text }}>
              {challenge.title}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
              {challenge.participantCount} teams participating
            </ThemedText>
          </View>
          <View style={styles.rewardBadge}>
            <Feather name="award" size={14} color="#F59E0B" />
            <ThemedText type="small" style={{ color: "#F59E0B", marginLeft: 4, fontWeight: "600" }}>
              {challenge.pointsReward}
            </ThemedText>
          </View>
        </View>

        {challenge.description ? (
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }} numberOfLines={2}>
            {challenge.description}
          </ThemedText>
        ) : null}

        <View style={styles.challengeStats}>
          <View style={styles.statBox}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Target
            </ThemedText>
            <ThemedText type="h4" style={{ color: theme.text }}>
              {challenge.targetValue} {challenge.targetUnit}
            </ThemedText>
          </View>
          <View style={styles.statBox}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Time Left
            </ThemedText>
            <ThemedText type="h4" style={{ color: daysLeft < 3 ? "#EF4444" : theme.text }}>
              {daysLeft} days
            </ThemedText>
          </View>
        </View>

        {isParticipating ? (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <ThemedText type="body" style={{ color: theme.text, fontWeight: "600" }}>
                Your Team's Progress
              </ThemedText>
              <ThemedText type="body" style={{ color: color, fontWeight: "600" }}>
                {participation.progressPercentage}%
              </ThemedText>
            </View>
            <View style={[styles.progressBar, { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: color,
                    width: `${Math.min(100, participation.progressPercentage)}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.progressDetails}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {participation.currentProgress} / {participation.targetProgress} {challenge.targetUnit}
              </ThemedText>
            </View>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onContribute();
              }}
              testID={`contribute-challenge-${challenge.id}`}
              style={[styles.actionButton, { backgroundColor: color }]}
            >
              <Feather name="plus-circle" size={18} color="white" />
              <ThemedText type="body" style={{ color: "white", marginLeft: 8, fontWeight: "600" }}>
                Log Contribution
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onJoin();
            }}
            disabled={!userTeam}
            testID={`join-challenge-${challenge.id}`}
            style={[
              styles.actionButton,
              {
                backgroundColor: userTeam ? color : theme.textSecondary,
                opacity: userTeam ? 1 : 0.5,
              },
            ]}
          >
            <Feather name="flag" size={18} color="white" />
            <ThemedText type="body" style={{ color: "white", marginLeft: 8, fontWeight: "600" }}>
              {userTeam ? "Join Challenge" : "Join a Team First"}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

function LeaderboardRow({
  entry,
  isCurrentTeam,
  theme,
  isDark,
}: {
  entry: LeaderboardEntry;
  isCurrentTeam: boolean;
  theme: any;
  isDark: boolean;
}) {
  const getRankColor = (rank: number) => {
    if (rank === 1) return "#F59E0B";
    if (rank === 2) return "#9CA3AF";
    if (rank === 3) return "#CD7F32";
    return theme.textSecondary;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return "award";
    if (rank <= 3) return "star";
    return null;
  };

  return (
    <View
      style={[
        styles.leaderboardRow,
        {
          backgroundColor: isCurrentTeam
            ? isDark
              ? "rgba(96, 165, 250, 0.15)"
              : "rgba(0, 102, 204, 0.1)"
            : "transparent",
          borderColor: isCurrentTeam ? theme.primary : "transparent",
        },
      ]}
    >
      <View style={[styles.rankBadge, { backgroundColor: `${getRankColor(entry.rank)}20` }]}>
        {getRankIcon(entry.rank) ? (
          <Feather name={getRankIcon(entry.rank) as any} size={16} color={getRankColor(entry.rank)} />
        ) : (
          <ThemedText type="body" style={{ color: getRankColor(entry.rank), fontWeight: "700" }}>
            {entry.rank}
          </ThemedText>
        )}
      </View>

      <View style={{ flex: 1, marginLeft: Spacing.md }}>
        <ThemedText type="body" style={{ color: theme.text, fontWeight: isCurrentTeam ? "700" : "500" }}>
          {entry.teamName}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {entry.memberCount} members
        </ThemedText>
      </View>

      <View style={styles.pointsContainer}>
        <ThemedText type="h4" style={{ color: theme.primary }}>
          {entry.points.toLocaleString()}
        </ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          pts
        </ThemedText>
      </View>
    </View>
  );
}

export default function TeamChallengesScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"challenges" | "team" | "leaderboard">("challenges");
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"weekly" | "monthly" | "all_time">("weekly");
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showJoinTeamModal, setShowJoinTeamModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [teamColor, setTeamColor] = useState("#4A90A4");
  const [inviteCode, setInviteCode] = useState("");
  const [contributionValue, setContributionValue] = useState("");
  const [contributionNotes, setContributionNotes] = useState("");

  const { data: userTeamData, isLoading: loadingUserTeam, refetch: refetchUserTeam } = useQuery<{ team: Team | null; membership: TeamMembership | null }>({
    queryKey: ["/api/user/team"],
  });

  const { data: challenges = [], isLoading: loadingChallenges, refetch: refetchChallenges } = useQuery<Challenge[]>({
    queryKey: ["/api/challenges"],
  });

  const { data: leaderboard, isLoading: loadingLeaderboard, refetch: refetchLeaderboard } = useQuery<Leaderboard>({
    queryKey: ["/api/leaderboard", leaderboardPeriod],
  });

  const { data: publicTeams = [], isLoading: loadingTeams } = useQuery<Team[]>({
    queryKey: ["/api/teams"],
  });

  const userTeam = userTeamData?.team || null;
  const userMembership = userTeamData?.membership || null;

  const getParticipationForChallenge = (challengeId: string): ChallengeParticipation | undefined => {
    return undefined;
  };

  const createTeamMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; teamColor: string }) => {
      const response = await axiosInstance.post("/api/teams", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setShowCreateTeamModal(false);
      setNewTeamName("");
      setNewTeamDescription("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const joinTeamMutation = useMutation({
    mutationFn: async (teamIdOrCode: string) => {
      if (teamIdOrCode.length === 8) {
        const response = await axiosInstance.post("/api/teams/join-code", { inviteCode: teamIdOrCode });
        return response.data;
      } else {
        const response = await axiosInstance.post(`/api/teams/${teamIdOrCode}/join`);
        return response.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      setShowJoinTeamModal(false);
      setInviteCode("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const leaveTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      await axiosInstance.delete(`/api/teams/${teamId}/leave`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
    },
  });

  const joinChallengeMutation = useMutation({
    mutationFn: async (challengeId: string) => {
      const response = await axiosInstance.post(`/api/challenges/${challengeId}/join`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const contributeMutation = useMutation({
    mutationFn: async (data: { challengeId: string; value: number; notes: string }) => {
      const response = await axiosInstance.post(`/api/challenges/${data.challengeId}/contribute`, {
        value: data.value,
        notes: data.notes,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/challenges"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/team"] });
      setShowContributeModal(false);
      setContributionValue("");
      setContributionNotes("");
      setSelectedChallenge(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const onRefresh = useCallback(() => {
    refetchUserTeam();
    refetchChallenges();
    refetchLeaderboard();
  }, []);

  const isLoading = loadingUserTeam || loadingChallenges;

  const teamColors = ["#4A90A4", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#EF4444", "#6366F1", "#14B8A6"];

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.loadingContainer, { paddingTop: headerHeight }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            Loading team challenges...
          </ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        <Animated.View entering={FadeIn.duration(400)}>
          <ThemedText type="h2" style={{ color: theme.text }}>
            Team Challenges
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 4 }}>
            Compete with others to achieve health goals together
          </ThemedText>
        </Animated.View>

        <View style={styles.tabContainer}>
          {(["challenges", "team", "leaderboard"] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab);
              }}
              testID={`tab-${tab}`}
              style={[
                styles.tab,
                {
                  backgroundColor: activeTab === tab ? theme.primary : "transparent",
                  borderColor: activeTab === tab ? theme.primary : theme.border,
                },
              ]}
            >
              <ThemedText
                type="body"
                style={{
                  color: activeTab === tab ? "white" : theme.textSecondary,
                  fontWeight: activeTab === tab ? "600" : "400",
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {activeTab === "challenges" ? (
          <>
            <ThemedText type="h3" style={{ color: theme.text, marginTop: Spacing.lg, marginBottom: Spacing.md }}>
              Active Challenges
            </ThemedText>
            {challenges.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="flag" size={48} color={theme.textSecondary} />
                <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
                  No active challenges at the moment.
                </ThemedText>
              </View>
            ) : (
              challenges.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  participation={getParticipationForChallenge(challenge.id)}
                  userTeam={userTeam}
                  onJoin={() => joinChallengeMutation.mutate(challenge.id)}
                  onContribute={() => {
                    setSelectedChallenge(challenge);
                    setShowContributeModal(true);
                  }}
                  theme={theme}
                  isDark={isDark}
                />
              ))
            )}
          </>
        ) : activeTab === "team" ? (
          <>
            {userTeam ? (
              <View style={styles.teamSection}>
                <View
                  style={[
                    styles.teamCard,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)",
                      borderColor: userTeam.teamColor,
                    },
                  ]}
                >
                  <View style={[styles.teamHeader, { backgroundColor: userTeam.teamColor }]}>
                    <Feather name="users" size={24} color="white" />
                    <ThemedText type="h2" style={{ color: "white", marginLeft: Spacing.md }}>
                      {userTeam.name}
                    </ThemedText>
                  </View>

                  <View style={styles.teamContent}>
                    {userTeam.description ? (
                      <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
                        {userTeam.description}
                      </ThemedText>
                    ) : null}

                    <View style={styles.teamStats}>
                      <View style={styles.teamStatBox}>
                        <ThemedText type="h3" style={{ color: theme.primary }}>
                          {userTeam.currentMembers}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          Members
                        </ThemedText>
                      </View>
                      <View style={styles.teamStatBox}>
                        <ThemedText type="h3" style={{ color: "#10B981" }}>
                          {userTeam.weeklyPoints}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          This Week
                        </ThemedText>
                      </View>
                      <View style={styles.teamStatBox}>
                        <ThemedText type="h3" style={{ color: "#F59E0B" }}>
                          {userTeam.totalPoints}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          Total Points
                        </ThemedText>
                      </View>
                    </View>

                    {userTeam.inviteCode ? (
                      <View
                        style={[
                          styles.inviteCodeBox,
                          { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" },
                        ]}
                      >
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          Invite Code
                        </ThemedText>
                        <ThemedText type="h3" style={{ color: theme.text, fontFamily: "monospace" }}>
                          {userTeam.inviteCode}
                        </ThemedText>
                      </View>
                    ) : null}

                    <ThemedText type="h4" style={{ color: theme.text, marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
                      Team Members
                    </ThemedText>

                    {userTeam.members?.map((member) => (
                      <View key={member.id} style={styles.memberRow}>
                        <View style={[styles.memberAvatar, { backgroundColor: userTeam.teamColor }]}>
                          <ThemedText type="body" style={{ color: "white", fontWeight: "600" }}>
                            {member.role === "captain" ? "C" : "M"}
                          </ThemedText>
                        </View>
                        <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                          <ThemedText type="body" style={{ color: theme.text }}>
                            {member.role === "captain" ? "Captain" : "Member"}
                          </ThemedText>
                          <ThemedText type="small" style={{ color: theme.textSecondary }}>
                            {member.contributedPoints} points contributed
                          </ThemedText>
                        </View>
                      </View>
                    ))}

                    <Pressable
                      onPress={() => leaveTeamMutation.mutate(userTeam.id)}
                      style={[styles.leaveButton, { borderColor: "#EF4444" }]}
                    >
                      <Feather name="log-out" size={16} color="#EF4444" />
                      <ThemedText type="body" style={{ color: "#EF4444", marginLeft: 8 }}>
                        Leave Team
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.noTeamSection}>
                <View style={styles.emptyState}>
                  <Feather name="users" size={48} color={theme.textSecondary} />
                  <ThemedText type="h3" style={{ color: theme.text, marginTop: Spacing.md }}>
                    Join a Team
                  </ThemedText>
                  <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 4, textAlign: "center" }}>
                    Team up with others to compete in challenges
                  </ThemedText>
                </View>

                <View style={styles.teamActions}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowCreateTeamModal(true);
                    }}
                    testID="create-team-button"
                    style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                  >
                    <Feather name="plus" size={18} color="white" />
                    <ThemedText type="body" style={{ color: "white", marginLeft: 8, fontWeight: "600" }}>
                      Create Team
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowJoinTeamModal(true);
                    }}
                    testID="join-team-button"
                    style={[
                      styles.secondaryButton,
                      {
                        borderColor: theme.primary,
                        backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)",
                      },
                    ]}
                  >
                    <Feather name="link" size={18} color={theme.primary} />
                    <ThemedText type="body" style={{ color: theme.primary, marginLeft: 8, fontWeight: "600" }}>
                      Join with Code
                    </ThemedText>
                  </Pressable>
                </View>

                <ThemedText type="h3" style={{ color: theme.text, marginTop: Spacing.xl, marginBottom: Spacing.md }}>
                  Public Teams
                </ThemedText>

                {loadingTeams ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : publicTeams.length === 0 ? (
                  <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
                    No public teams available
                  </ThemedText>
                ) : (
                  publicTeams.slice(0, 5).map((team) => (
                    <Pressable
                      key={team.id}
                      onPress={() => joinTeamMutation.mutate(team.id)}
                      style={[
                        styles.publicTeamRow,
                        {
                          backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)",
                          borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                        },
                      ]}
                    >
                      <View style={[styles.teamColorDot, { backgroundColor: team.teamColor }]} />
                      <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                        <ThemedText type="body" style={{ color: theme.text, fontWeight: "500" }}>
                          {team.name}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          {team.currentMembers}/{team.maxMembers || 20} members
                        </ThemedText>
                      </View>
                      <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.periodSelector}>
              {(["weekly", "monthly", "all_time"] as const).map((period) => (
                <Pressable
                  key={period}
                  onPress={() => setLeaderboardPeriod(period)}
                  style={[
                    styles.periodTab,
                    {
                      backgroundColor: leaderboardPeriod === period ? theme.primary : "transparent",
                      borderColor: leaderboardPeriod === period ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: leaderboardPeriod === period ? "white" : theme.textSecondary,
                      fontWeight: leaderboardPeriod === period ? "600" : "400",
                    }}
                  >
                    {period === "all_time" ? "All Time" : period.charAt(0).toUpperCase() + period.slice(1)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText type="h3" style={{ color: theme.text, marginTop: Spacing.lg, marginBottom: Spacing.md }}>
              Top Teams
            </ThemedText>

            {loadingLeaderboard ? (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: Spacing.lg }} />
            ) : !leaderboard || leaderboard.rankings.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="bar-chart-2" size={48} color={theme.textSecondary} />
                <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
                  No leaderboard data yet
                </ThemedText>
              </View>
            ) : (
              <View
                style={[
                  styles.leaderboardContainer,
                  {
                    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)",
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                  },
                ]}
              >
                {leaderboard.rankings.map((entry) => (
                  <LeaderboardRow
                    key={entry.teamId}
                    entry={entry}
                    isCurrentTeam={entry.teamId === userTeam?.id}
                    theme={theme}
                    isDark={isDark}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={showCreateTeamModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreateTeamModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowCreateTeamModal(false)}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                Cancel
              </ThemedText>
            </Pressable>
            <ThemedText type="h3" style={{ color: theme.text }}>
              Create Team
            </ThemedText>
            <Pressable
              onPress={() => createTeamMutation.mutate({ name: newTeamName, description: newTeamDescription, teamColor })}
              disabled={!newTeamName.trim() || createTeamMutation.isPending}
            >
              <ThemedText
                type="body"
                style={{
                  color: newTeamName.trim() ? theme.primary : theme.textSecondary,
                  fontWeight: "600",
                }}
              >
                {createTeamMutation.isPending ? "Creating..." : "Create"}
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            <TextInput
              placeholder="Team Name"
              value={newTeamName}
              onChangeText={setNewTeamName}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                  color: theme.text,
                },
              ]}
              placeholderTextColor={theme.textSecondary}
            />

            <TextInput
              placeholder="Description (optional)"
              value={newTeamDescription}
              onChangeText={setNewTeamDescription}
              multiline
              numberOfLines={3}
              style={[
                styles.textArea,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                  color: theme.text,
                },
              ]}
              placeholderTextColor={theme.textSecondary}
              textAlignVertical="top"
            />

            <ThemedText type="body" style={{ color: theme.text, marginTop: Spacing.md, marginBottom: Spacing.sm }}>
              Team Color
            </ThemedText>
            <View style={styles.colorPicker}>
              {teamColors.map((color) => (
                <Pressable
                  key={color}
                  onPress={() => setTeamColor(color)}
                  style={[
                    styles.colorOption,
                    {
                      backgroundColor: color,
                      borderWidth: teamColor === color ? 3 : 0,
                      borderColor: "white",
                    },
                  ]}
                >
                  {teamColor === color ? <Feather name="check" size={16} color="white" /> : null}
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showJoinTeamModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowJoinTeamModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowJoinTeamModal(false)}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                Cancel
              </ThemedText>
            </Pressable>
            <ThemedText type="h3" style={{ color: theme.text }}>
              Join Team
            </ThemedText>
            <Pressable
              onPress={() => joinTeamMutation.mutate(inviteCode)}
              disabled={!inviteCode.trim() || joinTeamMutation.isPending}
            >
              <ThemedText
                type="body"
                style={{
                  color: inviteCode.trim() ? theme.primary : theme.textSecondary,
                  fontWeight: "600",
                }}
              >
                {joinTeamMutation.isPending ? "Joining..." : "Join"}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.modalContent}>
            <ThemedText type="body" style={{ color: theme.text, marginBottom: Spacing.md }}>
              Enter the 8-character invite code shared by a team member
            </ThemedText>

            <TextInput
              placeholder="Enter invite code"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="characters"
              maxLength={8}
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                  color: theme.text,
                  fontSize: 24,
                  textAlign: "center",
                  fontFamily: "monospace",
                  letterSpacing: 4,
                },
              ]}
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showContributeModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowContributeModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setShowContributeModal(false)}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                Cancel
              </ThemedText>
            </Pressable>
            <ThemedText type="h3" style={{ color: theme.text }}>
              Log Contribution
            </ThemedText>
            <Pressable
              onPress={() => {
                if (selectedChallenge && contributionValue) {
                  contributeMutation.mutate({
                    challengeId: selectedChallenge.id,
                    value: parseFloat(contributionValue),
                    notes: contributionNotes,
                  });
                }
              }}
              disabled={!contributionValue || contributeMutation.isPending}
            >
              <ThemedText
                type="body"
                style={{
                  color: contributionValue ? theme.primary : theme.textSecondary,
                  fontWeight: "600",
                }}
              >
                {contributeMutation.isPending ? "Saving..." : "Save"}
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.modalContent}>
            {selectedChallenge ? (
              <>
                <ThemedText type="h3" style={{ color: theme.text, marginBottom: Spacing.md }}>
                  {selectedChallenge.title}
                </ThemedText>

                <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
                  Log your progress toward the team goal of {selectedChallenge.targetValue} {selectedChallenge.targetUnit}
                </ThemedText>

                <TextInput
                  placeholder={`Amount (${selectedChallenge.targetUnit})`}
                  value={contributionValue}
                  onChangeText={setContributionValue}
                  keyboardType="numeric"
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                      color: theme.text,
                      fontSize: 24,
                      textAlign: "center",
                    },
                  ]}
                  placeholderTextColor={theme.textSecondary}
                />

                <TextInput
                  placeholder="Notes (optional)"
                  value={contributionNotes}
                  onChangeText={setContributionNotes}
                  multiline
                  numberOfLines={3}
                  style={[
                    styles.textArea,
                    {
                      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                      color: theme.text,
                    },
                  ]}
                  placeholderTextColor={theme.textSecondary}
                  textAlignVertical="top"
                />
              </>
            ) : null}
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  tabContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  tab: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  challengeCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  challengeHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  challengeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  rewardBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  challengeStats: {
    flexDirection: "row",
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  statBox: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  progressSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressDetails: {
    marginTop: Spacing.xs,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  teamSection: {
    marginTop: Spacing.lg,
  },
  teamCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    overflow: "hidden",
  },
  teamHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  teamContent: {
    padding: Spacing.lg,
  },
  teamStats: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  teamStatBox: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(0,0,0,0.03)",
  },
  inviteCodeBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  leaveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  noTeamSection: {
    marginTop: Spacing.lg,
  },
  teamActions: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  publicTeamRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  teamColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  periodSelector: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  periodTab: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  leaderboardContainer: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  leaderboardRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
    borderWidth: 2,
    borderRadius: BorderRadius.md,
    marginBottom: 2,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  pointsContainer: {
    alignItems: "flex-end",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  modalContent: {
    padding: Spacing.lg,
  },
  input: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  textArea: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    fontSize: 16,
    minHeight: 100,
    marginBottom: Spacing.md,
  },
  colorPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
});
