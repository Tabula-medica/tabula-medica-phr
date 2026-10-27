import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  FlatList,
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
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { LoadingState, BaseModal, FormInput, Button } from "@/components/ui";

interface CareTeam {
  id: string;
  name: string;
  description: string | null;
  teamType: string;
  status: string;
  leadProviderId: string | null;
  createdAt: string;
}

interface TeamMember {
  id: string;
  careTeamId: string;
  providerId: string;
  providerName: string;
  role: string;
  specialty: string | null;
  isPrimary: boolean;
  joinedAt: string;
}

interface CollaborationTask {
  id: string;
  careTeamId: string;
  patientId: string | null;
  title: string;
  description: string | null;
  taskType: string;
  priority: string;
  status: string;
  assignedToId: string | null;
  dueDate: string | null;
  createdAt: string;
}

interface PatientSummary {
  id: string;
  patientId: string;
  careTeamId: string | null;
  summaryType: string;
  content: string;
  aiGenerated: boolean;
  createdAt: string;
}

interface SharedPatientAccess {
  id: string;
  patientId: string;
  careTeamId: string;
  accessLevel: string;
  grantedById: string;
  purposeOfUse: string;
  expiresAt: string | null;
}

type TabType = "teams" | "tasks" | "summaries" | "access" | "invites";

interface TeamInvitation {
  id: string;
  patientId: string;
  inviteeEmail: string;
  inviteeName: string | null;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

const TEAM_TYPES = ["primary_care", "specialist", "emergency", "chronic_care", "surgical", "oncology"];
const INVITE_ROLES = ["provider", "family_member", "caregiver"];
const TASK_TYPES = ["general", "medication", "appointment", "lab_order", "referral", "follow_up", "documentation", "care_plan_step"];
const PRIORITY_LEVELS = ["low", "normal", "high", "urgent"];
const ACCESS_LEVELS = ["read", "read_write", "full"];

export default function CareTeamScreen() {
  const { theme: colors } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>("teams");
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showGrantAccessModal, setShowGrantAccessModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<CareTeam | null>(null);
  const [selectedTask, setSelectedTask] = useState<CollaborationTask | null>(null);

  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [teamType, setTeamType] = useState("primary_care");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskType, setTaskType] = useState("general");
  const [taskPriority, setTaskPriority] = useState("normal");

  const [accessPatientId, setAccessPatientId] = useState("");
  const [accessLevel, setAccessLevel] = useState("read");
  const [purposeOfUse, setPurposeOfUse] = useState("treatment");

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("provider");
  const [inviteMessage, setInviteMessage] = useState("");

  const { data: careTeams = [], isLoading: loadingTeams } = useQuery<CareTeam[]>({
    queryKey: ["/api/collaboration/teams"],
    enabled: activeTab === "teams",
  });

  const { data: teamMembers = [], isLoading: loadingMembers } = useQuery<TeamMember[]>({
    queryKey: ["/api/collaboration/teams", selectedTeam?.id, "members"],
    enabled: !!selectedTeam,
  });

  const { data: collaborationTasks = [], isLoading: loadingTasks } = useQuery<CollaborationTask[]>({
    queryKey: ["/api/collaboration/tasks"],
    enabled: activeTab === "tasks",
  });

  const { data: patientSummaries = [], isLoading: loadingSummaries } = useQuery<PatientSummary[]>({
    queryKey: ["/api/collaboration/patient-summaries"],
    enabled: activeTab === "summaries",
  });

  const { data: sharedAccess = [], isLoading: loadingAccess } = useQuery<SharedPatientAccess[]>({
    queryKey: ["/api/collaboration/shared-access"],
    enabled: activeTab === "access",
  });

  const { data: invitations = [], isLoading: loadingInvites } = useQuery<TeamInvitation[]>({
    queryKey: ["/api/collaboration/invitations"],
    enabled: activeTab === "invites",
  });

  const createInvitationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/collaboration/invitations", {
        inviteeEmail: inviteEmail,
        inviteeName: inviteName || null,
        role: inviteRole,
        message: inviteMessage || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaboration/invitations"] });
      setShowInviteModal(false);
      resetInviteForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiRequest("DELETE", `/api/collaboration/invitations/${invitationId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaboration/invitations"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiRequest("POST", `/api/collaboration/invitations/${invitationId}/resend`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaboration/invitations"] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/collaboration/teams", {
        name: teamName,
        description: teamDescription,
        teamType: teamType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaboration/teams"] });
      setShowCreateTeamModal(false);
      resetTeamForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/collaboration/tasks", {
        careTeamId: selectedTeam?.id,
        title: taskTitle,
        description: taskDescription,
        taskType: taskType,
        priority: taskPriority,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaboration/tasks"] });
      setShowCreateTaskModal(false);
      resetTaskForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      return apiRequest("PATCH", `/api/collaboration/tasks/${taskId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaboration/tasks"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const grantAccessMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTeam) return;
      return apiRequest("POST", "/api/collaboration/shared-access", {
        patientId: accessPatientId,
        careTeamId: selectedTeam.id,
        accessLevel: accessLevel,
        purposeOfUse: purposeOfUse,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaboration/shared-access"] });
      setShowGrantAccessModal(false);
      resetAccessForm();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const resetTeamForm = () => {
    setTeamName("");
    setTeamDescription("");
    setTeamType("primary_care");
  };

  const resetTaskForm = () => {
    setTaskTitle("");
    setTaskDescription("");
    setTaskType("general");
    setTaskPriority("normal");
  };

  const resetAccessForm = () => {
    setAccessPatientId("");
    setAccessLevel("read");
    setPurposeOfUse("treatment");
  };

  const resetInviteForm = () => {
    setInviteEmail("");
    setInviteName("");
    setInviteRole("provider");
    setInviteMessage("");
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["/api/collaboration"] });
    setRefreshing(false);
  }, [queryClient]);

  const getTabIcon = (tab: TabType): keyof typeof Feather.glyphMap => {
    switch (tab) {
      case "teams": return "users";
      case "tasks": return "check-square";
      case "summaries": return "file-text";
      case "access": return "shield";
      case "invites": return "mail";
      default: return "folder";
    }
  };

  const getTabLabel = (tab: TabType): string => {
    switch (tab) {
      case "teams": return "Teams";
      case "tasks": return "Tasks";
      case "summaries": return "Summaries";
      case "access": return "Access";
      case "invites": return "Invites";
      default: return tab;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return colors.error;
      case "high": return colors.warning;
      case "normal": return colors.primary;
      case "low": return colors.textSecondary;
      default: return colors.textSecondary;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return colors.success;
      case "in_progress": return colors.info;
      case "pending": return colors.warning;
      case "cancelled": return colors.error;
      default: return colors.textSecondary;
    }
  };

  const renderTabs = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={[styles.tabsContainer, { backgroundColor: colors.backgroundRootDefault }]}
      contentContainerStyle={styles.tabsContent}
    >
      {(["teams", "tasks", "summaries", "access", "invites"] as TabType[]).map((tab) => (
        <Pressable
          key={tab}
          style={[
            styles.tab,
            activeTab === tab && { backgroundColor: colors.primary + "20" },
          ]}
          onPress={() => {
            setActiveTab(tab);
            setSelectedTeam(null);
            setSelectedTask(null);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <Feather
            name={getTabIcon(tab)}
            size={18}
            color={activeTab === tab ? colors.primary : colors.textSecondary}
          />
          <ThemedText
            style={[
              styles.tabText,
              { color: activeTab === tab ? colors.primary : colors.textSecondary },
            ]}
          >
            {getTabLabel(tab)}
          </ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderTeamDetail = () => {
    if (!selectedTeam) return null;

    return (
      <View style={styles.section}>
        <Pressable
          style={[styles.backButton, { borderColor: colors.border }]}
          onPress={() => setSelectedTeam(null)}
        >
          <Feather name="arrow-left" size={20} color={colors.primary} />
          <ThemedText style={[styles.backText, { color: colors.primary }]}>Back to Teams</ThemedText>
        </Pressable>

        <View style={[styles.teamDetailCard, { backgroundColor: colors.backgroundRootDefault }]}>
          <View style={styles.teamHeader}>
            <View style={[styles.teamIcon, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="users" size={24} color={colors.primary} />
            </View>
            <View style={styles.teamInfo}>
              <ThemedText style={[styles.teamName, { color: colors.text }]}>{selectedTeam.name}</ThemedText>
              <View style={[styles.badge, { backgroundColor: colors.info + "20" }]}>
                <ThemedText style={[styles.badgeText, { color: colors.info }]}>
                  {selectedTeam.teamType.replace(/_/g, " ")}
                </ThemedText>
              </View>
            </View>
          </View>
          {selectedTeam.description ? (
            <ThemedText style={[styles.teamDescription, { color: colors.textSecondary }]}>
              {selectedTeam.description}
            </ThemedText>
          ) : null}
        </View>

        <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>Team Members</ThemedText>
        
        {loadingMembers ? (
          <LoadingState message="Loading team members..." />
        ) : teamMembers.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.backgroundRootDefault }]}>
            <Feather name="user-plus" size={36} color={colors.textSecondary} />
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No Team Members</ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Add providers to this care team to begin collaboration
            </ThemedText>
          </View>
        ) : (
          teamMembers.map((member, index) => (
            <Animated.View
              key={member.id}
              entering={FadeInDown.delay(index * 50)}
              style={[styles.memberCard, { backgroundColor: colors.backgroundRootDefault }]}
            >
              <View style={[styles.memberAvatar, { backgroundColor: colors.primary + "20" }]}>
                <ThemedText style={[styles.avatarText, { color: colors.primary }]}>
                  {member.providerName.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
              <View style={styles.memberInfo}>
                <ThemedText style={[styles.memberName, { color: colors.text }]}>{member.providerName}</ThemedText>
                <ThemedText style={[styles.memberRole, { color: colors.textSecondary }]}>
                  {member.role}{member.specialty ? ` - ${member.specialty}` : ""}
                </ThemedText>
              </View>
              {member.isPrimary ? (
                <View style={[styles.primaryBadge, { backgroundColor: colors.success + "20" }]}>
                  <ThemedText style={[styles.primaryText, { color: colors.success }]}>Primary</ThemedText>
                </View>
              ) : null}
            </Animated.View>
          ))
        )}

        <View style={styles.actionButtons}>
          <Button
            variant="primary"
            icon="plus"
            size="md"
            onPress={() => setShowCreateTaskModal(true)}
            style={{ flex: 1 }}
          >
            Add Task
          </Button>
          <Button
            variant="secondary"
            icon="shield"
            size="md"
            onPress={() => setShowGrantAccessModal(true)}
            style={{ flex: 1 }}
          >
            Grant Access
          </Button>
        </View>
      </View>
    );
  };

  const renderTeams = () => {
    if (selectedTeam) return renderTeamDetail();

    return (
      <View style={styles.section}>
        <Button
          variant="primary"
          icon="plus"
          onPress={() => setShowCreateTeamModal(true)}
          fullWidth
          style={{ marginBottom: Spacing.lg }}
        >
          Create Care Team
        </Button>

        {loadingTeams ? (
          <LoadingState message="Loading care teams..." />
        ) : careTeams.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.backgroundRootDefault }]}>
            <Feather name="users" size={48} color={colors.textSecondary} />
            <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No Care Teams</ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Create care teams to coordinate patient care with other providers
            </ThemedText>
          </View>
        ) : (
          careTeams.map((team, index) => (
            <Animated.View
              key={team.id}
              entering={FadeInDown.delay(index * 50)}
            >
              <Pressable
                style={[styles.card, { backgroundColor: colors.backgroundRootDefault }]}
                onPress={() => setSelectedTeam(team)}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.teamIconSmall, { backgroundColor: colors.primary + "20" }]}>
                    <Feather name="users" size={18} color={colors.primary} />
                  </View>
                  <View style={[styles.badge, { backgroundColor: colors.info + "20" }]}>
                    <ThemedText style={[styles.badgeText, { color: colors.info }]}>
                      {team.teamType.replace(/_/g, " ")}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={[styles.cardTitle, { color: colors.text }]}>{team.name}</ThemedText>
                {team.description ? (
                  <ThemedText style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                    {team.description}
                  </ThemedText>
                ) : null}
                <View style={styles.cardFooter}>
                  <ThemedText style={[styles.timestamp, { color: colors.textSecondary }]}>
                    Created {new Date(team.createdAt).toLocaleDateString()}
                  </ThemedText>
                  <View style={[styles.statusDot, { backgroundColor: team.status === "active" ? colors.success : colors.warning }]} />
                </View>
                <View style={styles.cardArrow}>
                  <Feather name="chevron-right" size={20} color={colors.textSecondary} />
                </View>
              </Pressable>
            </Animated.View>
          ))
        )}
      </View>
    );
  };

  const renderTasks = () => (
    <View style={styles.section}>
      <Button
        variant="primary"
        icon="plus"
        onPress={() => {
          if (careTeams.length === 0) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return;
          }
          setSelectedTeam(careTeams[0]);
          setShowCreateTaskModal(true);
        }}
        fullWidth
        style={{ marginBottom: Spacing.lg }}
      >
        Create Task
      </Button>

      {loadingTasks ? (
        <LoadingState message="Loading tasks..." />
      ) : collaborationTasks.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.backgroundRootDefault }]}>
          <Feather name="check-square" size={48} color={colors.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No Tasks</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Create tasks to coordinate care activities with your team
          </ThemedText>
        </View>
      ) : (
        collaborationTasks.map((task, index) => (
          <Animated.View
            key={task.id}
            entering={FadeInDown.delay(index * 50)}
            style={[styles.card, { backgroundColor: colors.backgroundRootDefault }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.priorityIndicator, { backgroundColor: getPriorityColor(task.priority) }]} />
              <View style={[styles.badge, { backgroundColor: getStatusColor(task.status) + "20" }]}>
                <ThemedText style={[styles.badgeText, { color: getStatusColor(task.status) }]}>
                  {task.status.replace(/_/g, " ")}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>{task.title}</ThemedText>
            {task.description ? (
              <ThemedText style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                {task.description}
              </ThemedText>
            ) : null}
            <View style={styles.taskMeta}>
              <View style={[styles.taskTypeBadge, { backgroundColor: colors.backgroundRoot }]}>
                <ThemedText style={[styles.taskTypeText, { color: colors.textSecondary }]}>
                  {task.taskType.replace(/_/g, " ")}
                </ThemedText>
              </View>
              {task.dueDate ? (
                <ThemedText style={[styles.dueDate, { color: colors.warning }]}>
                  Due: {new Date(task.dueDate).toLocaleDateString()}
                </ThemedText>
              ) : null}
            </View>
            {task.status !== "completed" ? (
              <View style={styles.taskActions}>
                <Pressable
                  style={[styles.taskActionButton, { backgroundColor: colors.success + "20" }]}
                  onPress={() => updateTaskStatusMutation.mutate({ taskId: task.id, status: "completed" })}
                >
                  <Feather name="check" size={16} color={colors.success} />
                  <ThemedText style={[styles.taskActionText, { color: colors.success }]}>Complete</ThemedText>
                </Pressable>
                {task.status === "pending" ? (
                  <Pressable
                    style={[styles.taskActionButton, { backgroundColor: colors.info + "20" }]}
                    onPress={() => updateTaskStatusMutation.mutate({ taskId: task.id, status: "in_progress" })}
                  >
                    <Feather name="play" size={16} color={colors.info} />
                    <ThemedText style={[styles.taskActionText, { color: colors.info }]}>Start</ThemedText>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </Animated.View>
        ))
      )}
    </View>
  );

  const renderSummaries = () => (
    <View style={styles.section}>
      {loadingSummaries ? (
        <LoadingState message="Loading summaries..." />
      ) : patientSummaries.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.backgroundRootDefault }]}>
          <Feather name="file-text" size={48} color={colors.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No Patient Summaries</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            AI-generated patient summaries will appear here when shared with your team
          </ThemedText>
        </View>
      ) : (
        patientSummaries.map((summary, index) => (
          <Animated.View
            key={summary.id}
            entering={FadeInDown.delay(index * 50)}
            style={[styles.card, { backgroundColor: colors.backgroundRootDefault }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.badge, { backgroundColor: colors.primary + "20" }]}>
                <ThemedText style={[styles.badgeText, { color: colors.primary }]}>
                  {summary.summaryType.replace(/_/g, " ")}
                </ThemedText>
              </View>
              {summary.aiGenerated ? (
                <View style={[styles.aiBadge, { backgroundColor: colors.success + "20" }]}>
                  <Feather name="cpu" size={12} color={colors.success} />
                  <ThemedText style={[styles.aiBadgeText, { color: colors.success }]}>AI</ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText style={[styles.summaryContent, { color: colors.text }]} numberOfLines={5}>
              {summary.content}
            </ThemedText>
            <ThemedText style={[styles.timestamp, { color: colors.textSecondary }]}>
              {new Date(summary.createdAt).toLocaleDateString()}
            </ThemedText>
          </Animated.View>
        ))
      )}
    </View>
  );

  const renderAccess = () => (
    <View style={styles.section}>
      {loadingAccess ? (
        <LoadingState message="Loading access records..." />
      ) : sharedAccess.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.backgroundRootDefault }]}>
          <Feather name="shield" size={48} color={colors.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No Shared Access</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Grant access to patient records for your care team members
          </ThemedText>
        </View>
      ) : (
        sharedAccess.map((access, index) => (
          <Animated.View
            key={access.id}
            entering={FadeInDown.delay(index * 50)}
            style={[styles.card, { backgroundColor: colors.backgroundRootDefault }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.accessIcon, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="shield" size={16} color={colors.primary} />
              </View>
              <View style={[
                styles.accessLevelBadge,
                { backgroundColor: access.accessLevel === "full" ? colors.success + "20" : access.accessLevel === "read_write" ? colors.info + "20" : colors.warning + "20" }
              ]}>
                <ThemedText style={[
                  styles.accessLevelText,
                  { color: access.accessLevel === "full" ? colors.success : access.accessLevel === "read_write" ? colors.info : colors.warning }
                ]}>
                  {access.accessLevel.replace(/_/g, " ")}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>Patient Access</ThemedText>
            <View style={styles.accessMeta}>
              <View style={[styles.purposeBadge, { backgroundColor: colors.backgroundRoot }]}>
                <Feather name="target" size={12} color={colors.textSecondary} />
                <ThemedText style={[styles.purposeText, { color: colors.textSecondary }]}>
                  {access.purposeOfUse}
                </ThemedText>
              </View>
            </View>
            {access.expiresAt ? (
              <ThemedText style={[styles.expiration, { color: colors.warning }]}>
                Expires: {new Date(access.expiresAt).toLocaleDateString()}
              </ThemedText>
            ) : null}
          </Animated.View>
        ))
      )}
    </View>
  );

  const getInviteStatusColor = (status: string) => {
    switch (status) {
      case "pending": return colors.warning;
      case "accepted": return colors.success;
      case "declined": return colors.error;
      case "expired": return colors.textSecondary;
      case "revoked": return colors.error;
      default: return colors.textSecondary;
    }
  };

  const renderInvites = () => (
    <View style={styles.section}>
      <Button
        variant="primary"
        icon="user-plus"
        onPress={() => {
          setShowInviteModal(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }}
        fullWidth
        style={{ marginBottom: Spacing.lg }}
        testID="invite-member-button"
      >
        Invite Team Member
      </Button>

      {loadingInvites ? (
        <LoadingState message="Loading invitations..." />
      ) : invitations.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.backgroundRootDefault }]}>
          <Feather name="mail" size={48} color={colors.textSecondary} />
          <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>No Invitations Sent</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Invite healthcare providers or family members to join your care team
          </ThemedText>
        </View>
      ) : (
        invitations.map((invite, index) => (
          <Animated.View
            key={invite.id}
            entering={FadeInDown.delay(index * 50)}
            style={[styles.card, { backgroundColor: colors.backgroundRootDefault }]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.teamIconSmall, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="mail" size={16} color={colors.primary} />
              </View>
              <View style={[styles.badge, { backgroundColor: getInviteStatusColor(invite.status) + "20" }]}>
                <ThemedText style={[styles.badgeText, { color: getInviteStatusColor(invite.status) }]}>
                  {invite.status}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.cardTitle, { color: colors.text }]}>
              {invite.inviteeName || invite.inviteeEmail}
            </ThemedText>
            <ThemedText style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
              {invite.inviteeEmail}
            </ThemedText>
            <View style={styles.taskMeta}>
              <View style={[styles.badge, { backgroundColor: colors.info + "20" }]}>
                <ThemedText style={[styles.badgeText, { color: colors.info }]}>
                  {invite.role.replace(/_/g, " ")}
                </ThemedText>
              </View>
              <ThemedText style={[styles.timestamp, { color: colors.textSecondary }]}>
                Sent {new Date(invite.createdAt).toLocaleDateString()}
              </ThemedText>
            </View>
            {invite.status === "pending" ? (
              <View style={styles.taskActions}>
                <Pressable
                  style={[styles.taskActionButton, { backgroundColor: colors.primary + "15" }]}
                  onPress={() => {
                    resendInvitationMutation.mutate(invite.id);
                  }}
                >
                  <Feather name="refresh-cw" size={14} color={colors.primary} />
                  <ThemedText style={[styles.taskActionText, { color: colors.primary }]}>Resend</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.taskActionButton, { backgroundColor: colors.error + "15" }]}
                  onPress={() => {
                    revokeInvitationMutation.mutate(invite.id);
                  }}
                >
                  <Feather name="x" size={14} color={colors.error} />
                  <ThemedText style={[styles.taskActionText, { color: colors.error }]}>Revoke</ThemedText>
                </Pressable>
              </View>
            ) : null}
          </Animated.View>
        ))
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Animated.View entering={FadeIn.delay(100)}>
          <View style={styles.header}>
            <ThemedText style={[styles.title, { color: colors.text }]}>Care Team Collaboration</ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
              Coordinate patient care with your healthcare team
            </ThemedText>
          </View>

          {renderTabs()}

          {activeTab === "teams" && renderTeams()}
          {activeTab === "tasks" && renderTasks()}
          {activeTab === "summaries" && renderSummaries()}
          {activeTab === "access" && renderAccess()}
          {activeTab === "invites" && renderInvites()}
        </Animated.View>
      </ScrollView>

      <BaseModal visible={showCreateTeamModal} onClose={() => setShowCreateTeamModal(false)} title="Create Care Team">
        <FormInput
          label="Team Name"
          value={teamName}
          onChangeText={setTeamName}
          placeholder="Enter team name..."
        />

        <FormInput
          label="Description"
          value={teamDescription}
          onChangeText={setTeamDescription}
          placeholder="Describe the team's purpose..."
          multiline
          numberOfLines={3}
        />

        <ThemedText style={[styles.optionLabel, { color: colors.text }]}>Team Type</ThemedText>
        <View style={styles.optionsGrid}>
          {TEAM_TYPES.map((type) => (
            <Pressable
              key={type}
              style={[
                styles.optionButton,
                { borderColor: colors.border },
                teamType === type && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setTeamType(type)}
            >
              <ThemedText style={[
                styles.optionText,
                { color: teamType === type ? "#fff" : colors.text },
              ]}>
                {type.replace(/_/g, " ")}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <Button
          variant="primary"
          icon="users"
          loading={createTeamMutation.isPending}
          disabled={createTeamMutation.isPending || !teamName}
          onPress={() => createTeamMutation.mutate()}
          fullWidth
          style={{ marginTop: Spacing.xl }}
        >
          Create Team
        </Button>
      </BaseModal>

      <BaseModal visible={showCreateTaskModal} onClose={() => setShowCreateTaskModal(false)} title="Create Task">
        <FormInput
          label="Task Title"
          value={taskTitle}
          onChangeText={setTaskTitle}
          placeholder="Enter task title..."
        />

        <FormInput
          label="Description"
          value={taskDescription}
          onChangeText={setTaskDescription}
          placeholder="Describe the task..."
          multiline
          numberOfLines={3}
        />

        <ThemedText style={[styles.optionLabel, { color: colors.text }]}>Task Type</ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalOptions}>
          {TASK_TYPES.map((type) => (
            <Pressable
              key={type}
              style={[
                styles.optionButton,
                { borderColor: colors.border },
                taskType === type && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setTaskType(type)}
            >
              <ThemedText style={[
                styles.optionText,
                { color: taskType === type ? "#fff" : colors.text },
              ]}>
                {type.replace(/_/g, " ")}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        <ThemedText style={[styles.optionLabel, { color: colors.text }]}>Priority</ThemedText>
        <View style={styles.optionsRow}>
          {PRIORITY_LEVELS.map((priority) => (
            <Pressable
              key={priority}
              style={[
                styles.optionButton,
                { borderColor: colors.border },
                taskPriority === priority && { backgroundColor: getPriorityColor(priority), borderColor: getPriorityColor(priority) },
              ]}
              onPress={() => setTaskPriority(priority)}
            >
              <ThemedText style={[
                styles.optionText,
                { color: taskPriority === priority ? "#fff" : colors.text },
              ]}>
                {priority}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <Button
          variant="primary"
          icon="check-square"
          loading={createTaskMutation.isPending}
          disabled={createTaskMutation.isPending || !taskTitle}
          onPress={() => createTaskMutation.mutate()}
          fullWidth
          style={{ marginTop: Spacing.xl }}
        >
          Create Task
        </Button>
      </BaseModal>

      <BaseModal visible={showGrantAccessModal} onClose={() => setShowGrantAccessModal(false)} title="Grant Patient Access">
        <FormInput
          label="Patient ID"
          value={accessPatientId}
          onChangeText={setAccessPatientId}
          placeholder="Enter patient ID..."
        />

        <ThemedText style={[styles.optionLabel, { color: colors.text }]}>Access Level</ThemedText>
        <View style={styles.optionsRow}>
          {ACCESS_LEVELS.map((level) => (
            <Pressable
              key={level}
              style={[
                styles.optionButton,
                { borderColor: colors.border },
                accessLevel === level && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setAccessLevel(level)}
            >
              <ThemedText style={[
                styles.optionText,
                { color: accessLevel === level ? "#fff" : colors.text },
              ]}>
                {level.replace(/_/g, " ")}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <FormInput
          label="Purpose of Use"
          value={purposeOfUse}
          onChangeText={setPurposeOfUse}
          placeholder="e.g., treatment, care coordination"
        />

        <Button
          variant="primary"
          icon="shield"
          loading={grantAccessMutation.isPending}
          disabled={grantAccessMutation.isPending || !accessPatientId || !selectedTeam}
          onPress={() => grantAccessMutation.mutate()}
          fullWidth
          style={{ marginTop: Spacing.xl }}
        >
          Grant Access
        </Button>
      </BaseModal>

      <BaseModal visible={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invite Team Member">
        <FormInput
          label="Email Address"
          value={inviteEmail}
          onChangeText={setInviteEmail}
          placeholder="Enter email address..."
          keyboardType="email-address"
          autoCapitalize="none"
          testID="invite-email-input"
        />

        <FormInput
          label="Name (Optional)"
          value={inviteName}
          onChangeText={setInviteName}
          placeholder="Enter name..."
          testID="invite-name-input"
        />

        <ThemedText style={[styles.optionLabel, { color: colors.text }]}>Role</ThemedText>
        <View style={styles.optionsRow}>
          {INVITE_ROLES.map((role) => (
            <Pressable
              key={role}
              style={[
                styles.optionButton,
                { borderColor: colors.border },
                inviteRole === role && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setInviteRole(role)}
            >
              <ThemedText style={[
                styles.optionText,
                { color: inviteRole === role ? "#fff" : colors.text },
              ]}>
                {role.replace(/_/g, " ")}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <FormInput
          label="Personal Message (Optional)"
          value={inviteMessage}
          onChangeText={setInviteMessage}
          placeholder="Add a personal message to the invitation..."
          multiline
          numberOfLines={3}
          testID="invite-message-input"
        />

        <Button
          variant="primary"
          icon="send"
          loading={createInvitationMutation.isPending}
          disabled={createInvitationMutation.isPending || !inviteEmail}
          onPress={() => createInvitationMutation.mutate()}
          fullWidth
          style={{ marginTop: Spacing.xl }}
          testID="send-invite-button"
        >
          Send Invitation
        </Button>
      </BaseModal>
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
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  tabsContainer: {
    marginHorizontal: -Spacing.lg,
    marginBottom: Spacing.lg,
  },
  tabsContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginVertical: Spacing.md,
  },
  card: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardArrow: {
    position: "absolute",
    right: Spacing.md,
    top: "50%",
  },
  cardSubtitle: {
    fontSize: 13,
    marginBottom: Spacing.xs,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  timestamp: {
    fontSize: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyState: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  backText: {
    fontSize: 14,
    fontWeight: "500",
  },
  teamDetailCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  teamHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  teamIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  teamIconSmall: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  teamInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  teamName: {
    fontSize: 20,
    fontWeight: "700",
  },
  teamDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "600",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "600",
  },
  memberRole: {
    fontSize: 13,
  },
  primaryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  primaryText: {
    fontSize: 12,
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  taskMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  taskTypeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  taskTypeText: {
    fontSize: 12,
    textTransform: "capitalize",
  },
  dueDate: {
    fontSize: 12,
    fontWeight: "500",
  },
  taskActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  taskActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  taskActionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  summaryContent: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  accessIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  accessLevelBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  accessLevelText: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  accessMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  purposeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  purposeText: {
    fontSize: 12,
  },
  expiration: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: Spacing.sm,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  horizontalOptions: {
    marginBottom: Spacing.md,
  },
  optionButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 13,
    fontWeight: "500",
    textTransform: "capitalize",
  },
});
