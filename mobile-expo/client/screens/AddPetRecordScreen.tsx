import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { FormInput } from "@/components/FormInput";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type AddPetRecordParams = {
  AddPetRecord: { petId: string };
};

const RECORD_TYPES = [
  { key: "vaccination", label: "Vaccination", icon: "shield" as const },
  { key: "vet_visit", label: "Vet Visit", icon: "home" as const },
  { key: "medication", label: "Medication", icon: "package" as const },
  { key: "lab_result", label: "Lab Result", icon: "activity" as const },
  { key: "procedure", label: "Procedure", icon: "tool" as const },
  { key: "dental", label: "Dental", icon: "smile" as const },
  { key: "allergy", label: "Allergy", icon: "alert-triangle" as const },
  { key: "condition", label: "Condition", icon: "clipboard" as const },
  { key: "weight_check", label: "Weight Check", icon: "trending-up" as const },
];

export default function AddPetRecordScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<AddPetRecordParams, "AddPetRecord">>();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const petId = route.params.petId;

  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [provider, setProvider] = useState("");
  const [facility, setFacility] = useState("");
  const [notes, setNotes] = useState("");
  const [reminderDate, setReminderDate] = useState("");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        petId,
        type,
        title,
        summary: summary || null,
        date: new Date(date).toISOString(),
        provider: provider || null,
        facility: facility || null,
        notes: notes || null,
        reminderDate: reminderDate ? new Date(reminderDate).toISOString() : null,
      };
      await apiRequest("POST", `/api/pets/${petId}/records`, body);
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: [`/api/pets/${petId}/records`] });
      navigation.goBack();
    },
  });

  const canSave = type.length > 0 && title.trim().length > 0 && date.length > 0;

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      <ThemedText type="h2" style={styles.heading}>Add Health Record</ThemedText>

      <View style={[styles.formSection, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>Record Type</ThemedText>
        <View style={styles.typeGrid}>
          {RECORD_TYPES.map((rt) => (
            <Pressable
              key={rt.key}
              onPress={() => setType(rt.key)}
              style={[
                styles.typeChip,
                {
                  backgroundColor: type === rt.key ? `${theme.primary}15` : theme.backgroundSecondary,
                  borderColor: type === rt.key ? theme.primary : theme.border,
                },
              ]}
              testID={`picker-record-type-${rt.key}`}
            >
              <Feather
                name={rt.icon}
                size={16}
                color={type === rt.key ? theme.primary : theme.textSecondary}
              />
              <ThemedText
                type="caption"
                style={{
                  color: type === rt.key ? theme.primary : theme.text,
                  fontWeight: type === rt.key ? "600" : "400",
                }}
              >
                {rt.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[styles.formSection, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>Details</ThemedText>
        <FormInput
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="e.g., Rabies Vaccination"
          testID="input-record-title"
          autoCapitalize="words"
        />
        <FormInput
          label="Date (YYYY-MM-DD)"
          value={date}
          onChangeText={setDate}
          placeholder="2024-01-15"
          testID="input-record-date"
          keyboardType="numbers-and-punctuation"
        />
        <FormInput
          label="Summary"
          value={summary}
          onChangeText={setSummary}
          placeholder="Brief description..."
          multiline
          numberOfLines={3}
          testID="input-record-summary"
          autoCapitalize="sentences"
        />
      </View>

      <View style={[styles.formSection, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>Provider</ThemedText>
        <FormInput
          label="Veterinarian"
          value={provider}
          onChangeText={setProvider}
          placeholder="Dr. Smith"
          icon="user"
          testID="input-record-provider"
          autoCapitalize="words"
        />
        <FormInput
          label="Facility"
          value={facility}
          onChangeText={setFacility}
          placeholder="Happy Paws Clinic"
          icon="home"
          testID="input-record-facility"
          autoCapitalize="words"
        />
      </View>

      <View style={[styles.formSection, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText type="h4" style={styles.sectionTitle}>Reminder & Notes</ThemedText>
        <FormInput
          label="Reminder Date (YYYY-MM-DD)"
          value={reminderDate}
          onChangeText={setReminderDate}
          placeholder="Next due date (optional)"
          testID="input-record-reminder"
          keyboardType="numbers-and-punctuation"
        />
        <FormInput
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Additional notes..."
          multiline
          numberOfLines={3}
          testID="input-record-notes"
          autoCapitalize="sentences"
        />
      </View>

      <Pressable
        onPress={() => saveMutation.mutate()}
        disabled={!canSave || saveMutation.isPending}
        style={({ pressed }) => [
          styles.saveButton,
          {
            backgroundColor: canSave ? theme.primary : theme.backgroundTertiary,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
        testID="button-save-pet-record"
      >
        {saveMutation.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Feather name="check" size={18} color="#FFFFFF" />
            <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600" }}>
              Save Record
            </ThemedText>
          </>
        )}
      </Pressable>

      {saveMutation.isError ? (
        <ThemedText type="small" style={{ color: theme.error, textAlign: "center", marginTop: Spacing.sm }}>
          Failed to save record. Please try again.
        </ThemedText>
      ) : null}
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heading: {
    marginBottom: Spacing.xl,
  },
  formSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
});
