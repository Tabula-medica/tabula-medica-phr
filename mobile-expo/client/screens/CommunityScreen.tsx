import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors, Typography } from "@/constants/theme";
import { axiosInstance } from "@/lib/api";

interface Community {
  id: string;
  name: string;
  description: string | null;
  conditionType: string | null;
  iconName: string;
  bannerColor: string;
  memberCount: number;
  postCount: number;
  isVerified: boolean;
  isActive: boolean;
  guidelines: string | null;
  createdAt: string;
}

interface CommunityMembership {
  id: string;
  userId: string;
  communityId: string;
  role: string;
  displayName: string | null;
  isAnonymous: boolean;
  notificationsEnabled: boolean;
  createdAt: string;
}

interface CommunityPost {
  id: string;
  communityId: string;
  authorId: string;
  authorDisplayName: string;
  postType: string;
  title: string | null;
  content: string;
  tags: string[];
  isAnonymous: boolean;
  isPinned: boolean;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

const CONDITION_ICONS: Record<string, string> = {
  diabetes: "activity",
  heart: "heart",
  mental_health: "smile",
  chronic_pain: "zap",
  autoimmune: "shield",
  respiratory: "wind",
  cancer: "star",
  neurological: "cpu",
  general: "users",
};

const POST_TYPE_COLORS: Record<string, string> = {
  experience: "#10B981",
  question: "#3B82F6",
  tip: "#F59E0B",
  support: "#EC4899",
  milestone: "#8B5CF6",
};

function CommunityCard({
  community,
  isMember,
  onPress,
  onJoin,
  onLeave,
  theme,
  isDark,
}: {
  community: Community;
  isMember: boolean;
  onPress: () => void;
  onJoin: () => void;
  onLeave: () => void;
  theme: any;
  isDark: boolean;
}) {
  const iconName = CONDITION_ICONS[community.conditionType || "general"] || "users";

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(400)}>
      <Pressable
        onPress={onPress}
        testID={`community-card-${community.id}`}
        accessibilityRole="button"
        accessibilityLabel={`${community.name} community, ${community.memberCount} members, ${community.postCount} posts`}
        style={[
          styles.communityCard,
          {
            backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.9)",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
          },
        ]}
      >
        <View
          style={[
            styles.communityBanner,
            { backgroundColor: community.bannerColor || "#4A90A4" },
          ]}
        >
          <View style={styles.communityIconContainer}>
            <Feather name={iconName as any} size={24} color="white" />
          </View>
          {community.isVerified && (
            <View style={styles.verifiedBadge}>
              <Feather name="check-circle" size={14} color="white" />
            </View>
          )}
        </View>

        <View style={styles.communityContent}>
          <ThemedText type="h3" style={{ color: theme.text }}>
            {community.name}
          </ThemedText>
          {community.description ? (
            <ThemedText
              type="small"
              style={{ color: theme.textSecondary, marginTop: 4 }}
              numberOfLines={2}
            >
              {community.description}
            </ThemedText>
          ) : null}

          <View style={styles.communityStats}>
            <View style={styles.statItem}>
              <Feather name="users" size={12} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {community.memberCount}
              </ThemedText>
            </View>
            <View style={styles.statItem}>
              <Feather name="message-circle" size={12} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {community.postCount}
              </ThemedText>
            </View>
          </View>

          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              isMember ? onLeave() : onJoin();
            }}
            testID={`community-${isMember ? "leave" : "join"}-${community.id}`}
            accessibilityRole="button"
            accessibilityLabel={isMember ? `Leave ${community.name}` : `Join ${community.name}`}
            style={[
              styles.joinButton,
              {
                backgroundColor: isMember
                  ? isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.05)"
                  : theme.primary,
              },
            ]}
          >
            <ThemedText
              type="small"
              style={{
                color: isMember ? theme.textSecondary : "white",
                fontWeight: "600",
              }}
            >
              {isMember ? "Joined" : "Join"}
            </ThemedText>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function PostCard({
  post,
  onPress,
  onLike,
  onReport,
  onModAction,
  isModerator,
  theme,
  isDark,
}: {
  post: CommunityPost;
  onPress?: () => void;
  onLike: () => void;
  onReport: () => void;
  onModAction?: (action: string) => void;
  isModerator?: boolean;
  theme: any;
  isDark: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const typeColor = POST_TYPE_COLORS[post.postType] || "#6B7280";
  const timeAgo = getTimeAgo(post.createdAt);
  const cardStyle = [
    styles.postCard,
    {
      backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)",
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
    },
  ];
  const accessibilityLabel = `${post.postType} post by ${post.isAnonymous ? "Anonymous" : post.authorDisplayName}${post.title ? `: ${post.title}` : ""}`;
  const cardTestID = `post-card-${post.id}`;
  const inner = (
    <>
        <View style={styles.postHeader}>
          <View style={[styles.postTypeBadge, { backgroundColor: `${typeColor}20` }]}>
            <ThemedText type="small" style={{ color: typeColor, fontWeight: "600" }}>
              {post.postType.charAt(0).toUpperCase() + post.postType.slice(1)}
            </ThemedText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {timeAgo}
            </ThemedText>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                setShowActions(!showActions);
              }}
              testID={`post-menu-${post.id}`}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Post actions menu"
            >
              <Feather name="more-horizontal" size={16} color={theme.textSecondary} />
            </Pressable>
          </View>
        </View>

        {showActions ? (
          <View style={[styles.actionMenu, {
            backgroundColor: isDark ? "rgba(40,40,50,0.95)" : "rgba(255,255,255,0.98)",
            borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
          }]}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                setShowActions(false);
                onReport();
              }}
              testID={`report-post-${post.id}`}
              style={styles.actionMenuItem}
              accessibilityRole="button"
              accessibilityLabel="Report post"
            >
              <Feather name="flag" size={14} color="#EF4444" />
              <ThemedText type="small" style={{ color: "#EF4444", marginLeft: 8 }}>
                Report
              </ThemedText>
            </Pressable>
            {isModerator && onModAction ? (
              <>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowActions(false);
                    onModAction("hide_post");
                  }}
                  testID={`hide-post-${post.id}`}
                  style={styles.actionMenuItem}
                  accessibilityRole="button"
                  accessibilityLabel="Hide post"
                >
                  <Feather name="eye-off" size={14} color="#F59E0B" />
                  <ThemedText type="small" style={{ color: "#F59E0B", marginLeft: 8 }}>
                    Hide Post
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowActions(false);
                    onModAction("warn_user");
                  }}
                  testID={`warn-user-${post.id}`}
                  style={styles.actionMenuItem}
                  accessibilityRole="button"
                  accessibilityLabel="Warn post author"
                >
                  <Feather name="alert-triangle" size={14} color="#F97316" />
                  <ThemedText type="small" style={{ color: "#F97316", marginLeft: 8 }}>
                    Warn Author
                  </ThemedText>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}

        {post.title ? (
          <ThemedText type="h4" style={{ color: theme.text, marginTop: 8 }}>
            {post.title}
          </ThemedText>
        ) : null}

        <ThemedText
          type="body"
          style={{ color: theme.text, marginTop: 8 }}
          numberOfLines={3}
        >
          {post.content}
        </ThemedText>

        <View style={styles.postFooter}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {post.isAnonymous ? "Anonymous" : post.authorDisplayName}
          </ThemedText>

          <View style={styles.postActions}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onLike();
              }}
              style={styles.postActionButton}
              accessibilityRole="button"
              accessibilityLabel={`Like post, ${post.likesCount} likes`}
            >
              <Feather name="heart" size={16} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {post.likesCount}
              </ThemedText>
            </Pressable>

            <View style={styles.postActionButton}>
              <Feather name="message-circle" size={16} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {post.commentsCount}
              </ThemedText>
            </View>
          </View>
        </View>

        {post.tags.length > 0 ? (
          <View style={styles.tagsContainer}>
            {post.tags.slice(0, 3).map((tag, index) => (
              <View
                key={index}
                style={[
                  styles.tag,
                  { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" },
                ]}
              >
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  #{tag}
                </ThemedText>
              </View>
            ))}
          </View>
        ) : null}
    </>
  );

  return (
    <Animated.View entering={FadeInDown.delay(50).duration(300)}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          testID={cardTestID}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={cardStyle}
        >
          {inner}
        </Pressable>
      ) : (
        <View testID={cardTestID} accessibilityLabel={accessibilityLabel} style={cardStyle}>
          {inner}
        </View>
      )}
    </Animated.View>
  );
}

const REPORT_REASONS = [
  { key: "spam", label: "Spam", icon: "slash" },
  { key: "harassment", label: "Harassment", icon: "alert-circle" },
  { key: "misinformation", label: "Misinformation", icon: "x-circle" },
  { key: "inappropriate", label: "Inappropriate", icon: "alert-octagon" },
  { key: "self_harm", label: "Self-harm concern", icon: "heart" },
  { key: "other", label: "Other", icon: "more-horizontal" },
] as const;

const GOAL_CATEGORIES = [
  { key: "exercise", label: "Exercise", icon: "activity" },
  { key: "nutrition", label: "Nutrition", icon: "coffee" },
  { key: "medication", label: "Medication", icon: "thermometer" },
  { key: "sleep", label: "Sleep", icon: "moon" },
  { key: "wellness", label: "Wellness", icon: "sun" },
  { key: "custom", label: "Custom", icon: "target" },
] as const;

const PRIVACY_LEVELS = [
  { key: "anonymized", label: "Fully Anonymous", desc: "No identifying info shared" },
  { key: "pseudonymous", label: "Pseudonym", desc: "Use a display name" },
  { key: "named", label: "Named", desc: "Share with your name" },
] as const;

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function CommunityScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"discover" | "joined" | "feed">("discover");
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostType, setNewPostType] = useState<string>("experience");
  const [isAnonymous, setIsAnonymous] = useState(true);

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetPost, setReportTargetPost] = useState<CommunityPost | null>(null);
  const [reportReason, setReportReason] = useState<string>("");
  const [reportDescription, setReportDescription] = useState("");

  const [showGoalShareModal, setShowGoalShareModal] = useState(false);
  const [goalCategory, setGoalCategory] = useState<string>("exercise");
  const [goalMilestone, setGoalMilestone] = useState("");
  const [goalProgress, setGoalProgress] = useState("");
  const [goalInsight, setGoalInsight] = useState("");
  const [goalPrivacyLevel, setGoalPrivacyLevel] = useState<string>("anonymized");
  const [goalAnonymous, setGoalAnonymous] = useState(true);

  const [showModerationPanel, setShowModerationPanel] = useState(false);

  const { data: communities = [], isLoading: loadingCommunities, refetch: refetchCommunities } = useQuery<Community[]>({
    queryKey: ["/api/communities"],
  });

  const { data: memberships = [], isLoading: loadingMemberships, refetch: refetchMemberships } = useQuery<CommunityMembership[]>({
    queryKey: ["/api/user/communities"],
  });

  const { data: posts = [], isLoading: loadingPosts, refetch: refetchPosts } = useQuery<CommunityPost[]>({
    queryKey: ["/api/communities", selectedCommunity?.id, "posts"],
    enabled: !!selectedCommunity,
  });

  const joinMutation = useMutation({
    mutationFn: async (communityId: string) => {
      const response = await axiosInstance.post(`/api/communities/${communityId}/join`, {
        isAnonymous: true,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/communities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communities"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async (communityId: string) => {
      await axiosInstance.delete(`/api/communities/${communityId}/leave`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/communities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/communities"] });
    },
  });

  const createPostMutation = useMutation({
    mutationFn: async (data: { communityId: string; title: string; content: string; postType: string; isAnonymous: boolean }) => {
      const response = await axiosInstance.post(`/api/communities/${data.communityId}/posts`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communities", selectedCommunity?.id, "posts"] });
      setShowNewPostModal(false);
      setNewPostContent("");
      setNewPostTitle("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await axiosInstance.post("/api/reactions", {
        targetType: "post",
        targetId: postId,
        reactionType: "like",
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communities", selectedCommunity?.id, "posts"] });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (data: { targetType: string; targetId: string; communityId: string; reason: string; description: string }) => {
      const response = await axiosInstance.post("/api/reports", data);
      return response.data;
    },
    onSuccess: () => {
      setShowReportModal(false);
      setReportReason("");
      setReportDescription("");
      setReportTargetPost(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const goalShareMutation = useMutation({
    mutationFn: async (data: {
      communityId: string;
      goalCategory: string;
      milestoneTitle: string;
      progressPercent: number;
      insightText: string;
      privacyLevel: string;
      isAnonymous: boolean;
    }) => {
      const response = await axiosInstance.post(`/api/communities/${data.communityId}/goal-share`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communities", selectedCommunity?.id, "posts"] });
      setShowGoalShareModal(false);
      setGoalMilestone("");
      setGoalProgress("");
      setGoalInsight("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const moderationMutation = useMutation({
    mutationFn: async (data: {
      communityId: string;
      actionType: string;
      targetPostId?: string;
      targetUserId?: string;
      reason?: string;
    }) => {
      const response = await axiosInstance.post("/api/moderation/action", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communities", selectedCommunity?.id, "posts"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const { data: pendingReports = [] } = useQuery<any[]>({
    queryKey: ["/api/communities", selectedCommunity?.id, "reports"],
    enabled: !!selectedCommunity && memberships.some(m => m.communityId === selectedCommunity?.id && (m.role === "moderator" || m.role === "admin")),
  });

  const memberCommunityIds = new Set(memberships.map((m) => m.communityId));

  const joinedCommunities = communities.filter((c) => memberCommunityIds.has(c.id));
  const discoverCommunities = communities.filter((c) => !memberCommunityIds.has(c.id));

  const currentMembership = selectedCommunity
    ? memberships.find(m => m.communityId === selectedCommunity.id)
    : null;
  const isModerator = currentMembership?.role === "moderator" || currentMembership?.role === "admin";

  const handleCreatePost = () => {
    if (!selectedCommunity || !newPostContent.trim()) return;
    createPostMutation.mutate({
      communityId: selectedCommunity.id,
      title: newPostTitle.trim(),
      content: newPostContent.trim(),
      postType: newPostType,
      isAnonymous,
    });
  };

  const handleReport = (post: CommunityPost) => {
    setReportTargetPost(post);
    setShowReportModal(true);
  };

  const handleSubmitReport = () => {
    if (!reportTargetPost || !reportReason || !selectedCommunity) return;
    reportMutation.mutate({
      targetType: "post",
      targetId: reportTargetPost.id,
      communityId: selectedCommunity.id,
      reason: reportReason,
      description: reportDescription.trim(),
    });
  };

  const handleModAction = (post: CommunityPost, action: string) => {
    if (!selectedCommunity) return;
    moderationMutation.mutate({
      communityId: selectedCommunity.id,
      actionType: action,
      targetPostId: post.id,
      targetUserId: post.authorId,
      reason: `Moderator action: ${action}`,
    });
  };

  const handleGoalShare = () => {
    if (!selectedCommunity || !goalMilestone.trim()) return;
    goalShareMutation.mutate({
      communityId: selectedCommunity.id,
      goalCategory,
      milestoneTitle: goalMilestone.trim(),
      progressPercent: parseInt(goalProgress) || 0,
      insightText: goalInsight.trim(),
      privacyLevel: goalPrivacyLevel,
      isAnonymous: goalAnonymous,
    });
  };

  const onRefresh = useCallback(() => {
    refetchCommunities();
    refetchMemberships();
    if (selectedCommunity) {
      refetchPosts();
    }
  }, [selectedCommunity]);

  const isLoading = loadingCommunities || loadingMemberships;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.loadingContainer, { paddingTop: headerHeight }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            Loading communities...
          </ThemedText>
        </View>
      </View>
    );
  }

  if (selectedCommunity) {
    const isMember = memberCommunityIds.has(selectedCommunity.id);

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
          <Pressable
            onPress={() => setSelectedCommunity(null)}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Back to all communities"
          >
            <Feather name="arrow-left" size={20} color={theme.primary} />
            <ThemedText type="body" style={{ color: theme.primary, marginLeft: 8 }}>
              All Communities
            </ThemedText>
          </Pressable>

          <View
            style={[
              styles.communityHeader,
              { backgroundColor: selectedCommunity.bannerColor || "#4A90A4" },
            ]}
          >
            <View style={styles.communityHeaderContent}>
              <Feather
                name={CONDITION_ICONS[selectedCommunity.conditionType || "general"] as any || "users"}
                size={32}
                color="white"
              />
              <View style={{ marginLeft: Spacing.md, flex: 1 }}>
                <ThemedText type="h2" style={{ color: "white" }}>
                  {selectedCommunity.name}
                </ThemedText>
                <ThemedText type="small" style={{ color: "rgba(255,255,255,0.8)", marginTop: 4 }}>
                  {selectedCommunity.memberCount} members
                </ThemedText>
              </View>
            </View>
          </View>

          {selectedCommunity.description ? (
            <View
              style={[
                styles.descriptionCard,
                {
                  backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)",
                  borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                },
              ]}
            >
              <ThemedText type="body" style={{ color: theme.text }}>
                {selectedCommunity.description}
              </ThemedText>
            </View>
          ) : null}

          {isMember ? (
            <View style={{ gap: Spacing.sm }}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowNewPostModal(true);
                }}
                testID="new-post-button"
                style={[styles.newPostButton, { backgroundColor: theme.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Share your experience"
              >
                <Feather name="edit-3" size={18} color="white" />
                <ThemedText type="body" style={{ color: "white", marginLeft: 8, fontWeight: "600" }}>
                  Share Your Experience
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowGoalShareModal(true);
                }}
                testID="share-goal-button"
                accessibilityRole="button"
                accessibilityLabel="Share goal progress"
                style={[styles.newPostButton, {
                  backgroundColor: isDark ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.1)",
                  borderWidth: 1,
                  borderColor: "#8B5CF6",
                }]}
              >
                <Feather name="target" size={18} color="#8B5CF6" />
                <ThemedText type="body" style={{ color: "#8B5CF6", marginLeft: 8, fontWeight: "600" }}>
                  Share Goal Progress
                </ThemedText>
              </Pressable>
              {isModerator ? (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowModerationPanel(!showModerationPanel);
                  }}
                  testID="moderation-panel-button"
                  accessibilityRole="button"
                  accessibilityLabel={`Moderation, ${pendingReports.filter((r: any) => r.status === "pending").length} pending`}
                  style={[styles.newPostButton, {
                    backgroundColor: isDark ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.08)",
                    borderWidth: 1,
                    borderColor: "#F59E0B",
                  }]}
                >
                  <Feather name="shield" size={18} color="#F59E0B" />
                  <ThemedText type="body" style={{ color: "#F59E0B", marginLeft: 8, fontWeight: "600" }}>
                    Moderation ({pendingReports.filter((r: any) => r.status === "pending").length} pending)
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Pressable
              onPress={() => joinMutation.mutate(selectedCommunity.id)}
              testID="join-community-button"
              accessibilityRole="button"
              accessibilityLabel="Join community to post"
              style={[styles.newPostButton, { backgroundColor: theme.primary }]}
            >
              <Feather name="user-plus" size={18} color="white" />
              <ThemedText type="body" style={{ color: "white", marginLeft: 8, fontWeight: "600" }}>
                Join Community to Post
              </ThemedText>
            </Pressable>
          )}

          <ThemedText type="h3" style={{ color: theme.text, marginTop: Spacing.xl, marginBottom: Spacing.md }}>
            Recent Posts
          </ThemedText>

          {loadingPosts ? (
            <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: Spacing.lg }} />
          ) : posts.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="message-circle" size={48} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
                No posts yet. Be the first to share!
              </ThemedText>
            </View>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={() => likeMutation.mutate(post.id)}
                onReport={() => handleReport(post)}
                onModAction={(action) => handleModAction(post, action)}
                isModerator={isModerator}
                theme={theme}
                isDark={isDark}
              />
            ))
          )}
        </ScrollView>

        <Modal
          visible={showNewPostModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowNewPostModal(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowNewPostModal(false)} accessibilityRole="button" accessibilityLabel="Cancel">
                <ThemedText type="body" style={{ color: theme.textSecondary }}>
                  Cancel
                </ThemedText>
              </Pressable>
              <ThemedText type="h3" style={{ color: theme.text }}>
                New Post
              </ThemedText>
              <Pressable
                onPress={handleCreatePost}
                disabled={!newPostContent.trim() || createPostMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel={createPostMutation.isPending ? "Posting" : "Post"}
                accessibilityState={{ disabled: !newPostContent.trim() || createPostMutation.isPending }}
              >
                <ThemedText
                  type="body"
                  style={{
                    color: newPostContent.trim() ? theme.primary : theme.textSecondary,
                    fontWeight: "600",
                  }}
                >
                  {createPostMutation.isPending ? "Posting..." : "Post"}
                </ThemedText>
              </Pressable>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.postTypeSelector}>
                {Object.entries(POST_TYPE_COLORS).map(([type, color]) => (
                  <Pressable
                    key={type}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setNewPostType(type);
                    }}
                    style={[
                      styles.postTypeOption,
                      {
                        backgroundColor: newPostType === type ? `${color}20` : "transparent",
                        borderColor: newPostType === type ? color : theme.border,
                      },
                    ]}
                    accessibilityRole="radio"
                    accessibilityLabel={type.charAt(0).toUpperCase() + type.slice(1)}
                    accessibilityState={{ selected: newPostType === type }}
                  >
                    <ThemedText
                      type="small"
                      style={{
                        color: newPostType === type ? color : theme.textSecondary,
                        fontWeight: newPostType === type ? "600" : "400",
                      }}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <TextInput
                placeholder="Title (optional)"
                value={newPostTitle}
                onChangeText={setNewPostTitle}
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                    color: theme.text,
                  },
                ]}
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Post title"
              />

              <TextInput
                placeholder="Share your experience..."
                value={newPostContent}
                onChangeText={setNewPostContent}
                multiline
                numberOfLines={6}
                style={[
                  styles.textArea,
                  {
                    backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                    color: theme.text,
                  },
                ]}
                placeholderTextColor={theme.textSecondary}
                textAlignVertical="top"
                accessibilityLabel="Post content"
              />

              <Pressable
                onPress={() => setIsAnonymous(!isAnonymous)}
                style={styles.anonymousToggle}
                accessibilityRole="checkbox"
                accessibilityLabel="Post anonymously"
                accessibilityState={{ checked: isAnonymous }}
              >
                <Feather
                  name={isAnonymous ? "check-square" : "square"}
                  size={20}
                  color={theme.primary}
                />
                <ThemedText type="body" style={{ color: theme.text, marginLeft: 12 }}>
                  Post anonymously
                </ThemedText>
              </Pressable>

              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 8 }}>
                Your identity will not be shared with other community members.
              </ThemedText>
            </ScrollView>
          </View>
        </Modal>

        <Modal
          visible={showReportModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowReportModal(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => { setShowReportModal(false); setReportReason(""); setReportDescription(""); }} accessibilityRole="button" accessibilityLabel="Cancel">
                <ThemedText type="body" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
              </Pressable>
              <ThemedText type="h3" style={{ color: theme.text }}>Report Content</ThemedText>
              <Pressable
                onPress={handleSubmitReport}
                disabled={!reportReason || reportMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel={reportMutation.isPending ? "Sending report" : "Submit report"}
                accessibilityState={{ disabled: !reportReason || reportMutation.isPending }}
              >
                <ThemedText type="body" style={{
                  color: reportReason ? "#EF4444" : theme.textSecondary,
                  fontWeight: "600",
                }}>
                  {reportMutation.isPending ? "Sending..." : "Submit"}
                </ThemedText>
              </Pressable>
            </View>

            <ScrollView style={styles.modalContent}>
              <ThemedText type="body" style={{ color: theme.text, marginBottom: Spacing.md }}>
                Why are you reporting this content?
              </ThemedText>

              {REPORT_REASONS.map(({ key, label, icon }) => (
                <Pressable
                  key={key}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setReportReason(key);
                  }}
                  testID={`report-reason-${key}`}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: reportReason === key }}
                  style={[styles.reportReasonItem, {
                    backgroundColor: reportReason === key
                      ? (isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.08)")
                      : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)"),
                    borderColor: reportReason === key ? "#EF4444" : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
                  }]}
                >
                  <Feather name={icon as any} size={18} color={reportReason === key ? "#EF4444" : theme.textSecondary} />
                  <ThemedText type="body" style={{
                    color: reportReason === key ? "#EF4444" : theme.text,
                    marginLeft: 12,
                    fontWeight: reportReason === key ? "600" : "400",
                  }}>
                    {label}
                  </ThemedText>
                  {reportReason === key ? (
                    <View style={{ marginLeft: "auto" }}>
                      <Feather name="check-circle" size={18} color="#EF4444" />
                    </View>
                  ) : null}
                </Pressable>
              ))}

              <TextInput
                placeholder="Additional details (optional)"
                value={reportDescription}
                onChangeText={setReportDescription}
                multiline
                numberOfLines={3}
                style={[styles.textArea, {
                  backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                  color: theme.text,
                  marginTop: Spacing.md,
                  minHeight: 80,
                }]}
                placeholderTextColor={theme.textSecondary}
                textAlignVertical="top"
                accessibilityLabel="Additional details for report"
              />

              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                Reports are reviewed by community moderators. False reports may result in warnings.
              </ThemedText>
            </ScrollView>
          </View>
        </Modal>

        <Modal
          visible={showGoalShareModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowGoalShareModal(false)}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowGoalShareModal(false)} accessibilityRole="button" accessibilityLabel="Cancel">
                <ThemedText type="body" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
              </Pressable>
              <ThemedText type="h3" style={{ color: theme.text }}>Share Progress</ThemedText>
              <Pressable
                onPress={handleGoalShare}
                disabled={!goalMilestone.trim() || goalShareMutation.isPending}
                accessibilityRole="button"
                accessibilityLabel={goalShareMutation.isPending ? "Sharing" : "Share"}
                accessibilityState={{ disabled: !goalMilestone.trim() || goalShareMutation.isPending }}
              >
                <ThemedText type="body" style={{
                  color: goalMilestone.trim() ? "#8B5CF6" : theme.textSecondary,
                  fontWeight: "600",
                }}>
                  {goalShareMutation.isPending ? "Sharing..." : "Share"}
                </ThemedText>
              </Pressable>
            </View>

            <ScrollView style={styles.modalContent}>
              <ThemedText type="h4" style={{ color: theme.text, marginBottom: Spacing.sm }}>
                Goal Category
              </ThemedText>
              <View style={styles.postTypeSelector}>
                {GOAL_CATEGORIES.map(({ key, label, icon }) => (
                  <Pressable
                    key={key}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setGoalCategory(key);
                    }}
                    testID={`goal-category-${key}`}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: goalCategory === key }}
                    style={[styles.postTypeOption, {
                      backgroundColor: goalCategory === key ? "rgba(139,92,246,0.15)" : "transparent",
                      borderColor: goalCategory === key ? "#8B5CF6" : theme.border,
                    }]}
                  >
                    <Feather name={icon as any} size={14} color={goalCategory === key ? "#8B5CF6" : theme.textSecondary} style={{ marginRight: 4 }} />
                    <ThemedText type="small" style={{
                      color: goalCategory === key ? "#8B5CF6" : theme.textSecondary,
                      fontWeight: goalCategory === key ? "600" : "400",
                    }}>
                      {label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <TextInput
                placeholder="Milestone (e.g., '30 days of daily walks')"
                value={goalMilestone}
                onChangeText={setGoalMilestone}
                style={[styles.input, {
                  backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                  color: theme.text,
                }]}
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Milestone title"
              />

              <TextInput
                placeholder="Progress % (0-100)"
                value={goalProgress}
                onChangeText={(t) => setGoalProgress(t.replace(/[^0-9]/g, ""))}
                keyboardType="numeric"
                maxLength={3}
                style={[styles.input, {
                  backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                  color: theme.text,
                }]}
                placeholderTextColor={theme.textSecondary}
                accessibilityLabel="Progress percentage"
              />

              {goalProgress ? (
                <View style={[styles.progressBarContainer, { backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)" }]}>
                  <View style={[styles.progressBarFill, {
                    width: `${Math.min(parseInt(goalProgress) || 0, 100)}%`,
                    backgroundColor: "#8B5CF6",
                  }]} />
                </View>
              ) : null}

              <TextInput
                placeholder="Share your insight or experience (optional)"
                value={goalInsight}
                onChangeText={setGoalInsight}
                multiline
                numberOfLines={4}
                style={[styles.textArea, {
                  backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                  color: theme.text,
                  minHeight: 100,
                }]}
                placeholderTextColor={theme.textSecondary}
                textAlignVertical="top"
                accessibilityLabel="Insight or experience"
              />

              <ThemedText type="h4" style={{ color: theme.text, marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
                Privacy Level
              </ThemedText>
              {PRIVACY_LEVELS.map(({ key, label, desc }) => (
                <Pressable
                  key={key}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setGoalPrivacyLevel(key);
                    setGoalAnonymous(key === "anonymized");
                  }}
                  testID={`privacy-level-${key}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`${label}: ${desc}`}
                  accessibilityState={{ selected: goalPrivacyLevel === key }}
                  style={[styles.reportReasonItem, {
                    backgroundColor: goalPrivacyLevel === key
                      ? (isDark ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.08)")
                      : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)"),
                    borderColor: goalPrivacyLevel === key ? "#8B5CF6" : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"),
                  }]}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText type="body" style={{
                      color: goalPrivacyLevel === key ? "#8B5CF6" : theme.text,
                      fontWeight: goalPrivacyLevel === key ? "600" : "400",
                    }}>
                      {label}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 2 }}>
                      {desc}
                    </ThemedText>
                  </View>
                  {goalPrivacyLevel === key ? (
                    <Feather name="check-circle" size={18} color="#8B5CF6" />
                  ) : null}
                </Pressable>
              ))}

              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                Your health data is never shared. Only the milestone and progress you enter will be visible.
              </ThemedText>
            </ScrollView>
          </View>
        </Modal>

        {showModerationPanel && isModerator ? (
          <Modal
            visible={showModerationPanel}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowModerationPanel(false)}
          >
            <View style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}>
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setShowModerationPanel(false)} accessibilityRole="button" accessibilityLabel="Close moderation queue">
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>Close</ThemedText>
                </Pressable>
                <ThemedText type="h3" style={{ color: theme.text }}>Moderation Queue</ThemedText>
                <View style={{ width: 50 }} />
              </View>

              <ScrollView style={styles.modalContent}>
                {pendingReports.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Feather name="check-circle" size={48} color="#10B981" />
                    <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
                      No pending reports. Community is healthy!
                    </ThemedText>
                  </View>
                ) : (
                  pendingReports.map((report: any) => (
                    <View
                      key={report.id}
                      style={[styles.reportCard, {
                        backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)",
                        borderColor: report.status === "pending" ? "#F59E0B" : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"),
                      }]}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={[styles.postTypeBadge, {
                          backgroundColor: report.status === "pending" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
                        }]}>
                          <ThemedText type="small" style={{
                            color: report.status === "pending" ? "#F59E0B" : "#10B981",
                            fontWeight: "600",
                          }}>
                            {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                          </ThemedText>
                        </View>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          {getTimeAgo(report.createdAt)}
                        </ThemedText>
                      </View>

                      <ThemedText type="body" style={{ color: theme.text, marginTop: Spacing.sm }}>
                        Reason: {report.reason.replace("_", " ").charAt(0).toUpperCase() + report.reason.replace("_", " ").slice(1)}
                      </ThemedText>

                      {report.description ? (
                        <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                          "{report.description}"
                        </ThemedText>
                      ) : null}

                      {report.status === "pending" ? (
                        <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md }}>
                          <Pressable
                            onPress={() => {
                              moderationMutation.mutate({
                                communityId: selectedCommunity?.id || "",
                                actionType: "hide_post",
                                targetPostId: report.targetId,
                                reason: `Report: ${report.reason}`,
                              });
                            }}
                            testID={`mod-hide-${report.id}`}
                            accessibilityRole="button"
                            accessibilityLabel="Hide reported post"
                            style={[styles.modActionButton, { backgroundColor: "rgba(239,68,68,0.1)", borderColor: "#EF4444" }]}
                          >
                            <Feather name="eye-off" size={14} color="#EF4444" />
                            <ThemedText type="small" style={{ color: "#EF4444", marginLeft: 4 }}>Hide</ThemedText>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              reportMutation.mutate({
                                targetType: report.targetType,
                                targetId: report.targetId,
                                communityId: selectedCommunity?.id || "",
                                reason: "dismissed",
                                description: "Report dismissed by moderator",
                              });
                            }}
                            testID={`mod-dismiss-${report.id}`}
                            accessibilityRole="button"
                            accessibilityLabel="Dismiss report"
                            style={[styles.modActionButton, { backgroundColor: "rgba(107,114,128,0.1)", borderColor: "#6B7280" }]}
                          >
                            <Feather name="x" size={14} color="#6B7280" />
                            <ThemedText type="small" style={{ color: "#6B7280", marginLeft: 4 }}>Dismiss</ThemedText>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </Modal>
        ) : null}
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
            Health Communities
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 4 }}>
            Connect with others on similar health journeys
          </ThemedText>
        </Animated.View>

        <View style={styles.tabContainer}>
          {(["discover", "joined", "feed"] as const).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveTab(tab);
              }}
              testID={`tab-${tab}`}
              accessibilityRole="tab"
              accessibilityLabel={tab.charAt(0).toUpperCase() + tab.slice(1)}
              accessibilityState={{ selected: activeTab === tab }}
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

        {activeTab === "discover" ? (
          <>
            <ThemedText type="h3" style={{ color: theme.text, marginTop: Spacing.lg, marginBottom: Spacing.md }}>
              Explore Communities
            </ThemedText>
            {discoverCommunities.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="compass" size={48} color={theme.textSecondary} />
                <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
                  You've joined all available communities!
                </ThemedText>
              </View>
            ) : (
              discoverCommunities.map((community) => (
                <CommunityCard
                  key={community.id}
                  community={community}
                  isMember={false}
                  onPress={() => setSelectedCommunity(community)}
                  onJoin={() => joinMutation.mutate(community.id)}
                  onLeave={() => leaveMutation.mutate(community.id)}
                  theme={theme}
                  isDark={isDark}
                />
              ))
            )}
          </>
        ) : activeTab === "joined" ? (
          <>
            <ThemedText type="h3" style={{ color: theme.text, marginTop: Spacing.lg, marginBottom: Spacing.md }}>
              Your Communities
            </ThemedText>
            {joinedCommunities.length === 0 ? (
              <View style={styles.emptyState}>
                <Feather name="users" size={48} color={theme.textSecondary} />
                <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
                  You haven't joined any communities yet.
                </ThemedText>
                <Pressable
                  onPress={() => setActiveTab("discover")}
                  style={[styles.ctaButton, { backgroundColor: theme.primary }]}
                  accessibilityRole="button"
                  accessibilityLabel="Explore Communities"
                >
                  <ThemedText type="body" style={{ color: "white", fontWeight: "600" }}>
                    Explore Communities
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              joinedCommunities.map((community) => (
                <CommunityCard
                  key={community.id}
                  community={community}
                  isMember={true}
                  onPress={() => setSelectedCommunity(community)}
                  onJoin={() => joinMutation.mutate(community.id)}
                  onLeave={() => leaveMutation.mutate(community.id)}
                  theme={theme}
                  isDark={isDark}
                />
              ))
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="rss" size={48} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
              Join communities to see their posts in your feed.
            </ThemedText>
          </View>
        )}
      </ScrollView>
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
  communityCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  communityBanner: {
    height: 60,
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  communityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  verifiedBadge: {
    position: "absolute",
    right: Spacing.md,
    top: Spacing.sm,
  },
  communityContent: {
    padding: Spacing.md,
  },
  communityStats: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  joinButton: {
    alignSelf: "flex-start",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  postCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  postTypeBadge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  postFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  postActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  postActionButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  tag: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  communityHeader: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  communityHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  descriptionCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  newPostButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  ctaButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
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
  postTypeSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  postTypeOption: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
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
    minHeight: 150,
    marginBottom: Spacing.md,
  },
  anonymousToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  actionMenu: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xs,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  actionMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  reportReasonItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  reportCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  modActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
});
