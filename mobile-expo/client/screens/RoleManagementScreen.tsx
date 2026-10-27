import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiRequest } from "@/lib/query-client";
import { Card } from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";
import * as Haptics from "expo-haptics";

interface UserRole {
  id: string;
  name: string;
  displayName: string;
  description: string;
  isSystem: boolean;
  priority: number;
}

interface UserWithRoles {
  id: string;
  email: string;
  name: string;
  roles: UserRole[];
}

interface RoleSuggestion {
  roleName: string;
  displayName: string;
  confidence: number;
  reasoning: string;
}

interface AIRoleSuggestions {
  suggestedRoles: RoleSuggestion[];
  activityAnalysis: string;
  securityRecommendations: string[];
}

const ROLE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  patient: "user",
  caregiver: "heart",
  provider: "user-plus",
  admin: "shield",
  researcher: "book",
  read_only: "eye",
  data_manager: "database",
  auditor: "clipboard",
  data_analyst: "bar-chart-2",
  emergency_responder: "alert-circle",
};

const ROLE_COLORS: Record<string, string> = {
  patient: "#3B82F6",
  caregiver: "#EC4899",
  provider: "#10B981",
  admin: "#EF4444",
  researcher: "#8B5CF6",
  read_only: "#6B7280",
  data_manager: "#F59E0B",
  auditor: "#06B6D4",
  data_analyst: "#6366F1",
  emergency_responder: "#DC2626",
};

export default function RoleManagementScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [suggestionsModalVisible, setSuggestionsModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery<{
    users: UserWithRoles[];
  }>({
    queryKey: ["/api/access-control/users"],
  });

  const { data: rolesData, isLoading: rolesLoading } = useQuery<{
    roles: UserRole[];
  }>({
    queryKey: ["/api/access-control/roles"],
  });

  const { data: suggestionsData, isLoading: suggestionsLoading, refetch: refetchSuggestions } = useQuery<AIRoleSuggestions>({
    queryKey: ["/api/access-control/users", selectedUser?.id, "suggestions"],
    enabled: !!selectedUser && suggestionsModalVisible,
  });

  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleName }: { userId: string; roleName: string }) => {
      const res = await apiRequest("POST", `/api/access-control/users/${userId}/roles`, { roleName });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access-control/users"] });
      Alert.alert("Success", "Role assigned successfully");
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to assign role");
    },
  });

  const revokeRoleMutation = useMutation({
    mutationFn: async ({ userId, roleName }: { userId: string; roleName: string }) => {
      await apiRequest("DELETE", `/api/access-control/users/${userId}/roles/${roleName}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access-control/users"] });
      Alert.alert("Success", "Role revoked successfully");
    },
    onError: (error: Error) => {
      Alert.alert("Error", error.message || "Failed to revoke role");
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetchUsers();
    setRefreshing(false);
  };

  const handleOpenRoleModal = (user: UserWithRoles) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedUser(user);
    setRoleModalVisible(true);
  };

  const handleOpenSuggestions = (user: UserWithRoles) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedUser(user);
    setSuggestionsModalVisible(true);
    refetchSuggestions();
  };

  const handleAssignRole = (roleName: string) => {
    if (!selectedUser) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    assignRoleMutation.mutate({ userId: selectedUser.id, roleName });
  };

  const handleRevokeRole = (roleName: string) => {
    if (!selectedUser) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Revoke Role",
      `Are you sure you want to revoke the "${roleName}" role from this user?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: () => revokeRoleMutation.mutate({ userId: selectedUser.id, roleName }),
        },
      ]
    );
  };

  const filteredUsers = (usersData?.users || []).filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.roles.some((r) => r.displayName.toLowerCase().includes(query))
    );
  });

  const renderUserCard = (user: UserWithRoles) => {
    return (
      <Card key={user.id} style={styles.userCard}>
        <View style={styles.userHeader}>
          <View style={[styles.userAvatar, { backgroundColor: `${theme.primary}15` }]}>
            <Feather name="user" size={24} color={theme.primary} />
          </View>
          <View style={styles.userInfo}>
            <ThemedText type="h4">{user.name || "Unnamed User"}</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {user.email || "No email"}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => handleOpenSuggestions(user)}
            style={({ pressed }) => [
              styles.aiButton,
              { backgroundColor: `${theme.primary}15`, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="cpu" size={16} color={theme.primary} />
          </Pressable>
        </View>

        <View style={styles.rolesContainer}>
          {user.roles.length > 0 ? (
            user.roles.map((role) => (
              <View
                key={role.id}
                style={[
                  styles.roleBadge,
                  { backgroundColor: `${ROLE_COLORS[role.name] || theme.primary}20` },
                ]}
              >
                <Feather
                  name={ROLE_ICONS[role.name] || "shield"}
                  size={12}
                  color={ROLE_COLORS[role.name] || theme.primary}
                />
                <ThemedText
                  type="small"
                  style={{ color: ROLE_COLORS[role.name] || theme.primary, marginLeft: 4 }}
                >
                  {role.displayName}
                </ThemedText>
              </View>
            ))
          ) : (
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              No roles assigned
            </ThemedText>
          )}
        </View>

        <Pressable
          onPress={() => handleOpenRoleModal(user)}
          style={({ pressed }) => [
            styles.manageButton,
            { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="edit-2" size={14} color="#fff" />
          <ThemedText type="small" style={{ color: "#fff", marginLeft: Spacing.xs }}>
            Manage Roles
          </ThemedText>
        </Pressable>
      </Card>
    );
  };

  const renderRoleModal = () => {
    const userRoleNames = selectedUser?.roles.map((r) => r.name) || [];
    const allRoles = rolesData?.roles || [];

    return (
      <Modal
        visible={roleModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRoleModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Manage Roles</ThemedText>
              <Pressable onPress={() => setRoleModalVisible(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
              {selectedUser?.name || selectedUser?.email}
            </ThemedText>

            <ScrollView style={styles.rolesList} showsVerticalScrollIndicator={false}>
              {allRoles.map((role) => {
                const hasRole = userRoleNames.includes(role.name);
                const roleColor = ROLE_COLORS[role.name] || theme.primary;

                return (
                  <View key={role.id} style={styles.roleRow}>
                    <View style={styles.roleInfo}>
                      <View style={[styles.roleIcon, { backgroundColor: `${roleColor}15` }]}>
                        <Feather
                          name={ROLE_ICONS[role.name] || "shield"}
                          size={18}
                          color={roleColor}
                        />
                      </View>
                      <View style={styles.roleDetails}>
                        <ThemedText type="body" style={{ fontWeight: "600" }}>
                          {role.displayName}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: theme.textSecondary }}>
                          {role.description}
                        </ThemedText>
                      </View>
                    </View>

                    {hasRole ? (
                      <Pressable
                        onPress={() => handleRevokeRole(role.name)}
                        style={[styles.actionButton, { backgroundColor: `${theme.error}15` }]}
                        disabled={revokeRoleMutation.isPending}
                      >
                        {revokeRoleMutation.isPending ? (
                          <ActivityIndicator size="small" color={theme.error} />
                        ) : (
                          <Feather name="x" size={16} color={theme.error} />
                        )}
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => handleAssignRole(role.name)}
                        style={[styles.actionButton, { backgroundColor: `${theme.success}15` }]}
                        disabled={assignRoleMutation.isPending}
                      >
                        {assignRoleMutation.isPending ? (
                          <ActivityIndicator size="small" color={theme.success} />
                        ) : (
                          <Feather name="plus" size={16} color={theme.success} />
                        )}
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderSuggestionsModal = () => {
    return (
      <Modal
        visible={suggestionsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSuggestionsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText type="h3">AI Role Suggestions</ThemedText>
              <Pressable onPress={() => setSuggestionsModalVisible(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ThemedText type="body" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
              {selectedUser?.name || selectedUser?.email}
            </ThemedText>

            {suggestionsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
                  Analyzing user activity...
                </ThemedText>
              </View>
            ) : suggestionsData ? (
              <ScrollView style={styles.suggestionsContent} showsVerticalScrollIndicator={false}>
                <View style={[styles.analysisCard, { backgroundColor: `${theme.primary}10` }]}>
                  <Feather name="bar-chart-2" size={18} color={theme.primary} />
                  <View style={styles.analysisContent}>
                    <ThemedText type="body" style={{ fontWeight: "600" }}>
                      Activity Analysis
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: 4 }}>
                      {suggestionsData.activityAnalysis}
                    </ThemedText>
                  </View>
                </View>

                <ThemedText type="h4" style={styles.sectionTitle}>
                  Suggested Roles
                </ThemedText>
                {suggestionsData.suggestedRoles.map((suggestion, index) => {
                  const roleColor = ROLE_COLORS[suggestion.roleName] || theme.primary;
                  const confidencePercent = Math.round(suggestion.confidence * 100);

                  return (
                    <View key={index} style={styles.suggestionCard}>
                      <View style={styles.suggestionHeader}>
                        <View style={[styles.roleIcon, { backgroundColor: `${roleColor}15` }]}>
                          <Feather
                            name={ROLE_ICONS[suggestion.roleName] || "shield"}
                            size={18}
                            color={roleColor}
                          />
                        </View>
                        <View style={styles.suggestionInfo}>
                          <ThemedText type="body" style={{ fontWeight: "600" }}>
                            {suggestion.displayName}
                          </ThemedText>
                          <View style={styles.confidenceBar}>
                            <View
                              style={[
                                styles.confidenceFill,
                                { width: `${confidencePercent}%`, backgroundColor: roleColor },
                              ]}
                            />
                          </View>
                          <ThemedText type="small" style={{ color: theme.textSecondary }}>
                            {confidencePercent}% confidence
                          </ThemedText>
                        </View>
                        <Pressable
                          onPress={() => {
                            handleAssignRole(suggestion.roleName);
                            setSuggestionsModalVisible(false);
                          }}
                          style={[styles.applyButton, { backgroundColor: roleColor }]}
                        >
                          <ThemedText type="small" style={{ color: "#fff" }}>
                            Apply
                          </ThemedText>
                        </Pressable>
                      </View>
                      <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                        {suggestion.reasoning}
                      </ThemedText>
                    </View>
                  );
                })}

                {suggestionsData.securityRecommendations.length > 0 ? (
                  <>
                    <ThemedText type="h4" style={styles.sectionTitle}>
                      Security Recommendations
                    </ThemedText>
                    {suggestionsData.securityRecommendations.map((rec, index) => (
                      <View key={index} style={styles.recommendationRow}>
                        <Feather name="check-circle" size={16} color={theme.success} />
                        <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm, flex: 1 }}>
                          {rec}
                        </ThemedText>
                      </View>
                    ))}
                  </>
                ) : null}
              </ScrollView>
            ) : (
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                Unable to generate suggestions
              </ThemedText>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  if (usersLoading || rolesLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
          Loading users...
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.headerSection}>
        <ThemedText type="h2">Role Management</ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
          Assign and manage user roles and permissions
        </ThemedText>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="search" size={18} color={theme.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search users..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <Pressable onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <Card style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <ThemedText type="h2" style={{ color: theme.primary }}>
              {usersData?.users.length || 0}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Total Users
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText type="h2" style={{ color: ROLE_COLORS.admin }}>
              {rolesData?.roles.length || 0}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Available Roles
            </ThemedText>
          </View>
        </View>
      </Card>

      <View style={styles.usersSection}>
        <ThemedText type="h4" style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          Users ({filteredUsers.length})
        </ThemedText>
        {filteredUsers.map(renderUserCard)}
      </View>

      {filteredUsers.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Feather name="users" size={48} color={theme.textSecondary} />
          <ThemedText type="h4" style={{ marginTop: Spacing.md }}>
            No Users Found
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.xs }}>
            {searchQuery ? "Try a different search term" : "No users have been created yet"}
          </ThemedText>
        </Card>
      ) : null}

      {renderRoleModal()}
      {renderSuggestionsModal()}
    </ScrollView>
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
  headerSection: {
    marginBottom: Spacing.xl,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  statsCard: {
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  usersSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  userCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  userHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  aiButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  rolesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  manageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
    marginTop: Spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    maxHeight: "80%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  rolesList: {
    maxHeight: 400,
  },
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  roleInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.md,
  },
  roleIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  roleDetails: {
    flex: 1,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionsContent: {
    maxHeight: 400,
  },
  analysisCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  analysisContent: {
    flex: 1,
  },
  suggestionCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    marginBottom: Spacing.md,
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  suggestionInfo: {
    flex: 1,
  },
  confidenceBar: {
    height: 4,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 2,
    marginTop: 4,
    marginBottom: 2,
  },
  confidenceFill: {
    height: "100%",
    borderRadius: 2,
  },
  applyButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  recommendationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
});
