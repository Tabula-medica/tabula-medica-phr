import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { PetProfile, PetHealthRecord, PetStateRegistration } from "../../shared/schema";

type PetDetailParams = {
  PetDetail: { petId: string };
};

const RECORD_TYPE_CONFIG: Record<string, { label: string; icon: keyof typeof Feather.glyphMap; color: string }> = {
  vaccination: { label: "Vaccination", icon: "shield", color: "#10B981" },
  vet_visit: { label: "Vet Visit", icon: "home", color: "#0066CC" },
  medication: { label: "Medication", icon: "package", color: "#8B5CF6" },
  lab_result: { label: "Lab Result", icon: "activity", color: "#F59E0B" },
  procedure: { label: "Procedure", icon: "tool", color: "#EF4444" },
  dental: { label: "Dental", icon: "smile", color: "#06B6D4" },
  allergy: { label: "Allergy", icon: "alert-triangle", color: "#F97316" },
  condition: { label: "Condition", icon: "clipboard", color: "#6366F1" },
  weight_check: { label: "Weight Check", icon: "trending-up", color: "#14B8A6" },
};

function formatDate(dateStr: string | Date | null): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function InfoRow({ icon, label, value, theme }: { icon: keyof typeof Feather.glyphMap; label: string; value: string; theme: any }) {
  return (
    <View style={styles.infoRow}>
      <Feather name={icon} size={16} color={theme.textSecondary} />
      <View style={{ flex: 1 }}>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>{label}</ThemedText>
        <ThemedText type="body">{value}</ThemedText>
      </View>
    </View>
  );
}

function RecordItem({ record, onPress, theme }: { record: PetHealthRecord; onPress?: () => void; theme: any }) {
  const config = RECORD_TYPE_CONFIG[record.type] || { label: record.type, icon: "file-text" as const, color: "#6B7280" };

  const inner = (
    <>
      <View style={[styles.recordIcon, { backgroundColor: `${config.color}15` }]}>
        <Feather name={config.icon} size={18} color={config.color} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText type="body" numberOfLines={1}>{record.title}</ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {config.label} - {formatDate(record.date)}
        </ThemedText>
      </View>
      {onPress ? <Feather name="chevron-right" size={16} color={theme.textSecondary} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.recordItem, { backgroundColor: theme.backgroundDefault }]} testID={`record-pet-${record.id}`}>
        {inner}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.recordItem, { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.7 : 1 }]}
      testID={`record-pet-${record.id}`}
    >
      {inner}
    </Pressable>
  );
}

export default function PetDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<PetDetailParams, "PetDetail">>();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const petId = route.params.petId;

  const { data: pet, isLoading: petLoading } = useQuery<PetProfile>({
    queryKey: ["/api/pets", petId],
  });

  const { data: records = [] } = useQuery<PetHealthRecord[]>({
    queryKey: [`/api/pets/${petId}/records`],
    enabled: !!petId,
  });

  const { data: registrations = [] } = useQuery<PetStateRegistration[]>({
    queryKey: [`/api/pets/${petId}/registrations`],
    enabled: !!petId,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/pets/${petId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pets"] });
      navigation.goBack();
    },
  });

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("AddPet", { petId });
  };

  const handleAddRecord = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("AddPetRecord", { petId });
  };

  const handleRegistry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("PetRegistry", { petId });
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    setShowDeleteModal(false);
    deleteMutation.mutate();
  };

  if (petLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!pet) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, justifyContent: "center", alignItems: "center" }]}>
        <ThemedText type="body">Pet not found</ThemedText>
      </View>
    );
  }

  const age = pet.dateOfBirth
    ? Math.floor((Date.now() - new Date(pet.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <View style={[styles.avatarLarge, { backgroundColor: `${theme.primary}15` }]}>
            <Feather name="heart" size={40} color={theme.primary} />
          </View>
          <ThemedText type="h1" style={{ textAlign: "center" }}>{pet.name}</ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
            {pet.species}{pet.breed ? ` - ${pet.breed}` : ""}
          </ThemedText>
          <View style={styles.actionRow}>
            <Pressable
              onPress={handleEdit}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.7 : 1 }]}
              testID="button-edit-pet"
            >
              <Feather name="edit-2" size={16} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary }}>Edit</ThemedText>
            </Pressable>
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [styles.actionButton, { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.7 : 1 }]}
              testID="button-delete-pet"
            >
              <Feather name="trash-2" size={16} color={theme.error} />
              <ThemedText type="small" style={{ color: theme.error }}>Remove</ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText type="h4" style={styles.sectionTitle}>Details</ThemedText>
          {age !== null ? <InfoRow icon="calendar" label="Age" value={`${age} ${age === 1 ? "year" : "years"}`} theme={theme} /> : null}
          {pet.gender ? <InfoRow icon="user" label="Gender" value={pet.gender} theme={theme} /> : null}
          {pet.weight ? <InfoRow icon="trending-up" label="Weight" value={`${pet.weight} ${pet.weightUnit || "lbs"}`} theme={theme} /> : null}
          {pet.color ? <InfoRow icon="sun" label="Color" value={pet.color} theme={theme} /> : null}
          {pet.microchipId ? <InfoRow icon="cpu" label="Microchip ID" value={pet.microchipId} theme={theme} /> : null}
          {pet.licenseNumber ? <InfoRow icon="file-text" label="License" value={`${pet.licenseNumber}${pet.licenseState ? ` (${pet.licenseState})` : ""}`} theme={theme} /> : null}
        </View>

        {(pet.veterinarian || pet.vetClinic) ? (
          <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={styles.sectionTitle}>Veterinarian</ThemedText>
            {pet.veterinarian ? <InfoRow icon="user" label="Vet" value={pet.veterinarian} theme={theme} /> : null}
            {pet.vetClinic ? <InfoRow icon="home" label="Clinic" value={pet.vetClinic} theme={theme} /> : null}
            {pet.vetPhone ? <InfoRow icon="phone" label="Phone" value={pet.vetPhone} theme={theme} /> : null}
          </View>
        ) : null}

        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h4" style={{ flex: 1 }}>Health Records</ThemedText>
            <Pressable onPress={handleAddRecord} testID="button-add-pet-record" accessibilityRole="button" accessibilityLabel="Add health record">
              <Feather name="plus-circle" size={22} color={theme.primary} />
            </Pressable>
          </View>
          {records.length === 0 ? (
            <View style={styles.emptySection}>
              <Feather name="file-text" size={24} color={theme.textSecondary} />
              <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                No health records yet
              </ThemedText>
            </View>
          ) : (
            records.map((record) => (
              <RecordItem key={record.id} record={record} theme={theme} />
            ))
          )}
        </View>

        <Pressable
          onPress={handleRegistry}
          style={({ pressed }) => [styles.registryButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
          testID="button-pet-registry"
        >
          <Feather name="globe" size={20} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <ThemedText type="body" style={{ fontWeight: "600" }}>State Registrations</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {registrations.length > 0 ? `${registrations.length} registration(s)` : "Manage licenses & microchip registrations"}
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={18} color={theme.textSecondary} />
        </Pressable>

        {pet.notes ? (
          <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={styles.sectionTitle}>Notes</ThemedText>
            <ThemedText type="body" style={{ lineHeight: 22 }}>{pet.notes}</ThemedText>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={showDeleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h3" style={{ textAlign: "center" }}>Remove Pet</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
              Are you sure you want to remove {pet.name}? This will also delete all health records and registrations.
            </ThemedText>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowDeleteModal(false)}
                style={({ pressed }) => [styles.modalButton, { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 }]}
                testID="button-cancel-delete"
              >
                <ThemedText type="body" style={{ fontWeight: "600" }}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={confirmDelete}
                style={({ pressed }) => [styles.modalButton, { backgroundColor: theme.error, opacity: pressed ? 0.7 : 1 }]}
                testID="button-confirm-delete"
              >
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>Remove</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  recordItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.xs,
  },
  recordIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  emptySection: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  registryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
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
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
});
