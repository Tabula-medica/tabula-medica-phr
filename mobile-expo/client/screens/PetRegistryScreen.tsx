import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, RouteProp } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { FormInput } from "@/components/FormInput";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { PetStateRegistration } from "../../shared/schema";

type PetRegistryParams = {
  PetRegistry: { petId: string };
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "#10B98115", text: "#10B981" },
  expired: { bg: "#EF444415", text: "#EF4444" },
  pending: { bg: "#F59E0B15", text: "#F59E0B" },
};

const REGISTRATION_TYPES = ["license", "microchip"];

function formatDate(dateStr: string | Date | null): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function RegistrationCard({
  reg,
  theme,
  onOpenUrl,
}: {
  reg: PetStateRegistration;
  theme: any;
  onOpenUrl: (url: string) => void;
}) {
  const statusColors = STATUS_COLORS[reg.status] || STATUS_COLORS.pending;
  const isExpired = reg.expirationDate ? new Date(reg.expirationDate) < new Date() : false;
  const displayStatus = isExpired ? "expired" : reg.status;
  const displayColors = STATUS_COLORS[displayStatus] || STATUS_COLORS.pending;

  return (
    <View
      style={[styles.regCard, { backgroundColor: theme.backgroundDefault }]}
      testID={`card-registration-${reg.id}`}
    >
      <View style={styles.regHeader}>
        <View style={styles.regTitleRow}>
          <Feather
            name={reg.registrationType === "license" ? "file-text" : "cpu"}
            size={18}
            color={theme.primary}
          />
          <ThemedText type="h4">
            {reg.registrationType === "license" ? "License" : "Microchip"} - {reg.state}
          </ThemedText>
        </View>
        <View
          style={[styles.statusBadge, { backgroundColor: displayColors.bg }]}
        >
          <ThemedText
            type="caption"
            style={{ color: displayColors.text, fontWeight: "600" }}
          >
            {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
          </ThemedText>
        </View>
      </View>

      {reg.registrationNumber ? (
        <View style={styles.regRow}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Number
          </ThemedText>
          <ThemedText type="body">{reg.registrationNumber}</ThemedText>
        </View>
      ) : null}

      <View style={styles.regDates}>
        {reg.issuedDate ? (
          <View style={{ flex: 1 }}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Issued
            </ThemedText>
            <ThemedText type="small">{formatDate(reg.issuedDate)}</ThemedText>
          </View>
        ) : null}
        {reg.expirationDate ? (
          <View style={{ flex: 1 }}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Expires
            </ThemedText>
            <ThemedText
              type="small"
              style={{ color: isExpired ? theme.error : theme.text }}
            >
              {formatDate(reg.expirationDate)}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {reg.registryUrl ? (
        <Pressable
          onPress={() => onOpenUrl(reg.registryUrl!)}
          style={({ pressed }) => [
            styles.linkButton,
            { borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
          ]}
          testID={`button-registry-link-${reg.id}`}
        >
          <Feather name="external-link" size={14} color={theme.primary} />
          <ThemedText type="small" style={{ color: theme.primary }}>
            View State Registry
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function PetRegistryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<RouteProp<PetRegistryParams, "PetRegistry">>();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);

  const petId = route.params.petId;

  const { data: registrations = [], isLoading } = useQuery<PetStateRegistration[]>({
    queryKey: [`/api/pets/${petId}/registrations`],
  });

  const [regType, setRegType] = useState("license");
  const [regState, setRegState] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [regIssuedDate, setRegIssuedDate] = useState("");
  const [regExpirationDate, setRegExpirationDate] = useState("");
  const [regUrl, setRegUrl] = useState("");

  const addMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        petId,
        registrationType: regType,
        state: regState,
        registrationNumber: regNumber || null,
        issuedDate: regIssuedDate ? new Date(regIssuedDate).toISOString() : null,
        expirationDate: regExpirationDate ? new Date(regExpirationDate).toISOString() : null,
        status: "active",
        registryUrl: regUrl || null,
      };
      await apiRequest("POST", `/api/pets/${petId}/registrations`, body);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: [`/api/pets/${petId}/registrations`] });
      setShowAddModal(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setRegType("license");
    setRegState("");
    setRegNumber("");
    setRegIssuedDate("");
    setRegExpirationDate("");
    setRegUrl("");
  };

  const handleOpenUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (e) {
      console.error("Failed to open URL:", e);
    }
  };

  const canAdd = regState.trim().length > 0;

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
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <ThemedText type="h2">State Registrations</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Track licenses and microchip registrations
            </ThemedText>
          </View>
          <Pressable
            onPress={() => setShowAddModal(true)}
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            testID="button-add-registration"
          >
            <Feather name="plus" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator
            size="large"
            color={theme.primary}
            style={{ marginTop: Spacing["4xl"] }}
          />
        ) : registrations.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: `${theme.primary}10` }]}>
              <Feather name="globe" size={40} color={theme.primary} />
            </View>
            <ThemedText type="h3" style={{ textAlign: "center", marginTop: Spacing.lg }}>
              No Registrations
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
              Add state licenses and microchip registrations to keep track of your pet's legal status.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.regList}>
            {registrations.map((reg) => (
              <RegistrationCard
                key={reg.id}
                reg={reg}
                theme={theme}
                onOpenUrl={handleOpenUrl}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={showAddModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAwareScrollViewCompat
            style={[styles.modalScroll, { backgroundColor: theme.backgroundDefault }]}
            contentContainerStyle={{ padding: Spacing.xl }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Add Registration</ThemedText>
              <Pressable
                onPress={() => { setShowAddModal(false); resetForm(); }}
                testID="button-close-add-registration"
              >
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.typeRow}>
              {REGISTRATION_TYPES.map((rt) => (
                <Pressable
                  key={rt}
                  onPress={() => setRegType(rt)}
                  style={[
                    styles.typeOption,
                    {
                      backgroundColor: regType === rt ? theme.primary : theme.backgroundSecondary,
                      borderColor: regType === rt ? theme.primary : theme.border,
                    },
                  ]}
                  testID={`picker-reg-type-${rt}`}
                >
                  <Feather
                    name={rt === "license" ? "file-text" : "cpu"}
                    size={16}
                    color={regType === rt ? "#FFFFFF" : theme.text}
                  />
                  <ThemedText
                    type="small"
                    style={{
                      color: regType === rt ? "#FFFFFF" : theme.text,
                      fontWeight: regType === rt ? "600" : "400",
                    }}
                  >
                    {rt.charAt(0).toUpperCase() + rt.slice(1)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <FormInput
              label="State"
              value={regState}
              onChangeText={setRegState}
              placeholder="e.g., California"
              testID="input-reg-state"
              autoCapitalize="words"
            />
            <FormInput
              label="Registration Number"
              value={regNumber}
              onChangeText={setRegNumber}
              placeholder="Registration or tag number"
              testID="input-reg-number"
            />
            <FormInput
              label="Issued Date (YYYY-MM-DD)"
              value={regIssuedDate}
              onChangeText={setRegIssuedDate}
              placeholder="2024-01-15"
              testID="input-reg-issued"
              keyboardType="numbers-and-punctuation"
            />
            <FormInput
              label="Expiration Date (YYYY-MM-DD)"
              value={regExpirationDate}
              onChangeText={setRegExpirationDate}
              placeholder="2025-01-15"
              testID="input-reg-expiration"
              keyboardType="numbers-and-punctuation"
            />
            <FormInput
              label="Registry Website URL"
              value={regUrl}
              onChangeText={setRegUrl}
              placeholder="https://..."
              testID="input-reg-url"
              keyboardType="url"
            />

            <Pressable
              onPress={() => addMutation.mutate()}
              disabled={!canAdd || addMutation.isPending}
              style={({ pressed }) => [
                styles.saveButton,
                {
                  backgroundColor: canAdd ? theme.primary : theme.backgroundTertiary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
              testID="button-save-registration"
            >
              {addMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
                  Add Registration
                </ThemedText>
              )}
            </Pressable>

            {addMutation.isError ? (
              <ThemedText type="small" style={{ color: theme.error, textAlign: "center", marginTop: Spacing.sm }}>
                Failed to add registration.
              </ThemedText>
            ) : null}
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  regList: {
    gap: Spacing.md,
  },
  regCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  regHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  regTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  regRow: {
    marginBottom: Spacing.sm,
  },
  regDates: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.sm,
  },
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: Spacing.md,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: Spacing["4xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalScroll: {
    maxHeight: "85%",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  typeRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  typeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  saveButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
});
