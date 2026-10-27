import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useHeaderHeight } from "@react-navigation/elements";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { apiRequest } from "@/lib/query-client";
import { useLanguage } from "@/context/LanguageContext";
import { Spacing } from "@/constants/theme";
import { LoadingState, BaseModal, FormInput, Button } from "@/components/ui";

type JournalEntry = {
  id: string;
  entryType: string;
  title: string | null;
  content: string | null;
  mood: number | null;
  painLevel: number | null;
  energyLevel: number | null;
  symptoms: string[] | null;
  tags: string[] | null;
  entryDate: string;
  createdAt: string;
};

const MOOD_LABELS = ["Terrible", "Bad", "Okay", "Good", "Great"];
const MOOD_ICONS: Array<keyof typeof Feather.glyphMap> = ["frown", "meh", "minus", "smile", "sun"];
const MOOD_COLORS = ["#EF4444", "#F59E0B", "#94A3B8", "#10B981", "#3B82F6"];

const COMMON_SYMPTOMS = [
  "Headache", "Fatigue", "Nausea", "Dizziness", "Back Pain",
  "Joint Pain", "Cough", "Shortness of Breath", "Chest Pain",
  "Stomach Pain", "Insomnia", "Anxiety", "Muscle Ache", "Fever",
];

const ENTRY_TYPES = [
  { id: "symptom", label: "Symptom Log", icon: "activity" as const },
  { id: "note", label: "Personal Note", icon: "edit-3" as const },
  { id: "mood", label: "Mood Check", icon: "smile" as const },
  { id: "medication_note", label: "Medication Note", icon: "heart" as const },
];

export default function HealthJournalScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [showAddModal, setShowAddModal] = useState(false);
  const [entryType, setEntryType] = useState("symptom");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [painLevel, setPainLevel] = useState<number | null>(null);
  const [energyLevel, setEnergyLevel] = useState<number | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  const { data: entries = [], isLoading, refetch } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/journal", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/summary"] });
      resetForm();
      setShowAddModal(false);
    },
  });

  const resetForm = useCallback(() => {
    setEntryType("symptom");
    setTitle("");
    setContent("");
    setMood(null);
    setPainLevel(null);
    setEnergyLevel(null);
    setSelectedSymptoms([]);
  }, []);

  const handleSave = useCallback(() => {
    addMutation.mutate({
      entryType,
      title: title || null,
      content: content || null,
      mood,
      painLevel,
      energyLevel,
      symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : null,
      entryDate: new Date().toISOString(),
    });
  }, [entryType, title, content, mood, painLevel, energyLevel, selectedSymptoms]);

  const toggleSymptom = useCallback((symptom: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom]
    );
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  const getEntryIcon = (type: string): keyof typeof Feather.glyphMap => {
    const found = ENTRY_TYPES.find(e => e.id === type);
    return found ? found.icon : "file-text";
  };

  const handleCloseModal = useCallback(() => {
    setShowAddModal(false);
    resetForm();
  }, [resetForm]);

  if (isLoading) {
    return (
      <LoadingState message="Loading journal..." fullScreen />
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingBottom: 100, paddingHorizontal: Spacing.lg }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <ThemedText type="h3">Health Journal</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }}>
              Track symptoms, mood, and personal notes
            </ThemedText>
          </View>
          <Button
            testID="button-new-journal-entry"
            onPress={() => setShowAddModal(true)}
            icon="plus"
            size="sm"
          >
            New Entry
          </Button>
        </View>

        {entries.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Feather name="book-open" size={40} color={theme.textSecondary} />
            <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: 12, textAlign: "center" }}>
              Your health journal is empty. Start tracking how you feel each day.
            </ThemedText>
          </View>
        ) : null}

        {entries.map((entry) => (
          <View
            key={entry.id}
            testID={`card-journal-${entry.id}`}
            style={[styles.entryCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
          >
            <View style={styles.entryHeader}>
              <View style={[styles.entryIcon, { backgroundColor: theme.primary + "15" }]}>
                <Feather name={getEntryIcon(entry.entryType)} size={16} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText type="body" style={{ fontWeight: "600" }}>
                  {entry.title || ENTRY_TYPES.find(e => e.id === entry.entryType)?.label || entry.entryType}
                </ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {formatDate(entry.entryDate)}
                </ThemedText>
              </View>
              {entry.mood !== null && entry.mood !== undefined ? (
                <View style={[styles.moodBadge, { backgroundColor: MOOD_COLORS[entry.mood] + "20" }]}>
                  <Feather name={MOOD_ICONS[entry.mood]} size={14} color={MOOD_COLORS[entry.mood]} />
                  <ThemedText type="caption" style={{ color: MOOD_COLORS[entry.mood], marginLeft: 4, fontSize: 11 }}>
                    {MOOD_LABELS[entry.mood]}
                  </ThemedText>
                </View>
              ) : null}
            </View>

            {entry.content ? (
              <ThemedText type="body" style={{ marginTop: 8, color: theme.textSecondary, fontSize: 13 }}>
                {entry.content}
              </ThemedText>
            ) : null}

            {entry.symptoms && Array.isArray(entry.symptoms) && entry.symptoms.length > 0 ? (
              <View style={styles.symptomsRow}>
                {(entry.symptoms as string[]).map((s: string) => (
                  <View key={s} style={[styles.symptomTag, { backgroundColor: theme.backgroundSecondary }]}>
                    <ThemedText type="caption" style={{ fontSize: 11 }}>{s}</ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.metricsRow}>
              {entry.painLevel !== null && entry.painLevel !== undefined ? (
                <View style={[styles.metricBadge, { backgroundColor: "#EF4444" + "10" }]}>
                  <ThemedText type="caption" style={{ color: "#EF4444", fontSize: 11 }}>
                    Pain: {entry.painLevel}/10
                  </ThemedText>
                </View>
              ) : null}
              {entry.energyLevel !== null && entry.energyLevel !== undefined ? (
                <View style={[styles.metricBadge, { backgroundColor: "#10B981" + "10" }]}>
                  <ThemedText type="caption" style={{ color: "#10B981", fontSize: 11 }}>
                    Energy: {entry.energyLevel}/10
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        ))}
      </ScrollView>

      <BaseModal visible={showAddModal} onClose={handleCloseModal} title="New Journal Entry">
        <ThemedText type="caption" style={{ fontWeight: "600", marginBottom: 8 }}>
          Entry Type
        </ThemedText>
        <View style={styles.typeRow}>
          {ENTRY_TYPES.map((et) => (
            <Pressable
              key={et.id}
              onPress={() => setEntryType(et.id)}
              style={[
                styles.typeChip,
                {
                  backgroundColor: entryType === et.id ? theme.primary : theme.backgroundSecondary,
                  borderColor: entryType === et.id ? theme.primary : theme.border,
                },
              ]}
            >
              <Feather name={et.icon} size={13} color={entryType === et.id ? "#FFFFFF" : theme.text} />
              <ThemedText type="caption" style={{ color: entryType === et.id ? "#FFFFFF" : theme.text, marginLeft: 4, fontSize: 11 }}>
                {et.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <FormInput
          label="Title"
          testID="input-journal-title"
          value={title}
          onChangeText={setTitle}
          placeholder="Brief summary..."
        />

        <FormInput
          label="Notes"
          testID="input-journal-content"
          value={content}
          onChangeText={setContent}
          placeholder="How are you feeling? Any observations..."
          multiline
          numberOfLines={4}
        />

        <View style={styles.formGroup}>
          <ThemedText type="caption" style={{ fontWeight: "600", marginBottom: 8 }}>
            Mood
          </ThemedText>
          <View style={styles.moodRow}>
            {MOOD_LABELS.map((label, i) => (
              <Pressable
                key={label}
                onPress={() => setMood(i)}
                style={[
                  styles.moodItem,
                  {
                    backgroundColor: mood === i ? MOOD_COLORS[i] + "20" : theme.backgroundSecondary,
                    borderColor: mood === i ? MOOD_COLORS[i] : theme.border,
                  },
                ]}
              >
                <Feather name={MOOD_ICONS[i]} size={20} color={mood === i ? MOOD_COLORS[i] : theme.textSecondary} />
                <ThemedText type="caption" style={{ fontSize: 10, marginTop: 2, color: mood === i ? MOOD_COLORS[i] : theme.textSecondary }}>
                  {label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {entryType === "symptom" ? (
          <View style={styles.formGroup}>
            <ThemedText type="caption" style={{ fontWeight: "600", marginBottom: 8 }}>
              Symptoms
            </ThemedText>
            <View style={styles.symptomsGrid}>
              {COMMON_SYMPTOMS.map((symptom) => (
                <Pressable
                  key={symptom}
                  onPress={() => toggleSymptom(symptom)}
                  style={[
                    styles.symptomChip,
                    {
                      backgroundColor: selectedSymptoms.includes(symptom) ? theme.primary + "15" : theme.backgroundSecondary,
                      borderColor: selectedSymptoms.includes(symptom) ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <ThemedText type="caption" style={{
                    color: selectedSymptoms.includes(symptom) ? theme.primary : theme.text,
                    fontSize: 12,
                    fontWeight: selectedSymptoms.includes(symptom) ? "600" : "400",
                  }}>
                    {symptom}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.sliderGroup}>
          <View style={styles.sliderItem}>
            <ThemedText type="caption" style={{ fontWeight: "600" }}>
              Pain Level: {painLevel !== null ? `${painLevel}/10` : "Not set"}
            </ThemedText>
            <View style={styles.scaleRow}>
              {Array.from({ length: 11 }, (_, i) => (
                <Pressable
                  key={i}
                  onPress={() => setPainLevel(i)}
                  style={[
                    styles.scaleBtn,
                    {
                      backgroundColor: painLevel === i ? "#EF4444" : theme.backgroundSecondary,
                      borderColor: painLevel === i ? "#EF4444" : theme.border,
                    },
                  ]}
                >
                  <ThemedText type="caption" style={{ color: painLevel === i ? "#FFFFFF" : theme.text, fontSize: 10 }}>
                    {i}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.sliderItem}>
            <ThemedText type="caption" style={{ fontWeight: "600" }}>
              Energy Level: {energyLevel !== null ? `${energyLevel}/10` : "Not set"}
            </ThemedText>
            <View style={styles.scaleRow}>
              {Array.from({ length: 11 }, (_, i) => (
                <Pressable
                  key={i}
                  onPress={() => setEnergyLevel(i)}
                  style={[
                    styles.scaleBtn,
                    {
                      backgroundColor: energyLevel === i ? "#10B981" : theme.backgroundSecondary,
                      borderColor: energyLevel === i ? "#10B981" : theme.border,
                    },
                  ]}
                >
                  <ThemedText type="caption" style={{ color: energyLevel === i ? "#FFFFFF" : theme.text, fontSize: 10 }}>
                    {i}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <Button
          testID="button-save-journal"
          onPress={handleSave}
          loading={addMutation.isPending}
          disabled={addMutation.isPending}
          fullWidth
          style={{ marginTop: 8, marginBottom: 20 }}
        >
          {t.common.save} Entry
        </Button>
      </BaseModal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
  },
  entryCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  entryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  entryIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  moodBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  symptomsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  symptomTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  metricBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  formGroup: { marginBottom: 16 },
  moodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  moodItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  symptomsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  symptomChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  sliderGroup: { marginBottom: 16, gap: 16 },
  sliderItem: { gap: 8 },
  scaleRow: {
    flexDirection: "row",
    gap: 4,
  },
  scaleBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
});
