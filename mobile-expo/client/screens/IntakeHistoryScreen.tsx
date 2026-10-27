import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  FlatList,
  Platform,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";

type SectionKey =
  | "diagnoses"
  | "surgeries"
  | "medications"
  | "allergies"
  | "preventive"
  | "vaccines"
  | "social"
  | "peg"
  | "phq9"
  | "sdoh";

interface SectionConfig {
  key: SectionKey;
  title: string;
  shortTitle: string;
  icon: keyof typeof Feather.glyphMap;
}

const SECTIONS: SectionConfig[] = [
  { key: "diagnoses", title: "Diagnoses", shortTitle: "Dx", icon: "file-text" },
  { key: "surgeries", title: "Surgeries", shortTitle: "Surg", icon: "scissors" },
  { key: "medications", title: "Medications", shortTitle: "Meds", icon: "package" },
  { key: "allergies", title: "Allergies", shortTitle: "Allergy", icon: "alert-triangle" },
  { key: "preventive", title: "Preventive Care", shortTitle: "Prev", icon: "shield" },
  { key: "vaccines", title: "Vaccines", shortTitle: "Vax", icon: "check-circle" },
  { key: "social", title: "Social History", shortTitle: "Social", icon: "users" },
  { key: "peg", title: "PEG Pain Scale", shortTitle: "PEG", icon: "thermometer" },
  { key: "phq9", title: "PHQ-9 Depression", shortTitle: "PHQ-9", icon: "heart" },
  { key: "sdoh", title: "SDOH", shortTitle: "SDOH", icon: "home" },
];

export default function IntakeHistoryScreen() {
  const { theme, isDark, fontScale } = useTheme();
  const headerHeight = useHeaderHeight();
  const [activeSection, setActiveSection] = useState<SectionKey>("diagnoses");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<any[]>([]);
  const [selectedSurgeries, setSelectedSurgeries] = useState<any[]>([]);
  const [selectedMedications, setSelectedMedications] = useState<any[]>([]);
  const [selectedAllergies, setSelectedAllergies] = useState<any[]>([]);
  const [selectedPreventive, setSelectedPreventive] = useState<any[]>([]);
  const [selectedVaccines, setSelectedVaccines] = useState<any[]>([]);
  const [socialHistory, setSocialHistory] = useState<Record<string, any>>({});
  const [pegScores, setPegScores] = useState({ pain: 0, enjoyment: 0, activity: 0 });
  const [phq9Answers, setPhq9Answers] = useState<Record<number, number>>({});
  const [sdohAnswers, setSdohAnswers] = useState<Record<string, any>>({});
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const tabScrollRef = useRef<ScrollView>(null);

  const { data: refData, isLoading: refLoading } = useQuery({
    queryKey: ["/api/intake/reference-data"],
  });

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/intake/submit", data);
      return res.json();
    },
    onSuccess: () => {
      Alert.alert("Saved", "Your health intake history has been saved successfully.");
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to save intake history.");
    },
  });

  const aiAssistMutation = useMutation({
    mutationFn: async (params: { section: string; userInput: string }) => {
      const res = await apiRequest("POST", "/api/intake/ai-assist", {
        currentData: {
          diagnoses: selectedDiagnoses,
          medications: selectedMedications,
          allergies: selectedAllergies,
        },
        section: params.section,
        userInput: params.userInput,
      });
      return res.json();
    },
  });

  const handleAiAssist = useCallback(async () => {
    setAiSuggesting(true);
    try {
      const result = await aiAssistMutation.mutateAsync({
        section: activeSection,
        userInput: searchQuery || "suggest based on my current entries",
      });
      if (result.narrative) {
        Alert.alert("AI Suggestion", result.narrative);
      }
    } catch {
    } finally {
      setAiSuggesting(false);
    }
  }, [activeSection, searchQuery]);

  const handleSubmit = useCallback(() => {
    const phq9Total = Object.values(phq9Answers).reduce((s, v) => s + (v || 0), 0);
    const pegAvg = Math.round(((pegScores.pain + pegScores.enjoyment + pegScores.activity) / 3) * 10) / 10;

    submitMutation.mutate({
      diagnoses: selectedDiagnoses,
      surgeries: selectedSurgeries,
      medications: selectedMedications,
      allergies: selectedAllergies,
      preventiveCare: selectedPreventive,
      vaccines: selectedVaccines,
      socialHistory,
      pegScale: pegScores,
      phq9: phq9Answers,
      phq9Score: phq9Total,
      pegAverage: pegAvg,
      sdoh: sdohAnswers,
    });
  }, [selectedDiagnoses, selectedSurgeries, selectedMedications, selectedAllergies, selectedPreventive, selectedVaccines, socialHistory, pegScores, phq9Answers, sdohAnswers]);

  const totalItems = selectedDiagnoses.length + selectedSurgeries.length + selectedMedications.length + selectedAllergies.length + selectedPreventive.length + selectedVaccines.length;

  const getCount = (key: SectionKey): number => {
    switch (key) {
      case "diagnoses": return selectedDiagnoses.length;
      case "surgeries": return selectedSurgeries.length;
      case "medications": return selectedMedications.length;
      case "allergies": return selectedAllergies.length;
      case "preventive": return selectedPreventive.length;
      case "vaccines": return selectedVaccines.length;
      case "social": return Object.keys(socialHistory).length;
      case "peg": return (pegScores.pain + pegScores.enjoyment + pegScores.activity) > 0 ? 1 : 0;
      case "phq9": return Object.keys(phq9Answers).length;
      case "sdoh": return Object.keys(sdohAnswers).length;
      default: return 0;
    }
  };

  if (refLoading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: headerHeight + Spacing.xl, backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="body" style={{ marginTop: Spacing.lg }}>Loading intake form...</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.sm, paddingBottom: Spacing["5xl"] + 80 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <Animated.View entering={FadeInDown.duration(400)}>
            <ThemedText type="h2" style={{ marginBottom: Spacing.xs }}>Health Intake History</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
              Complete your comprehensive health history. {totalItems > 0 ? `${totalItems} items entered so far.` : "Tap items to add them."}
            </ThemedText>
          </Animated.View>

          <ScrollView
            ref={tabScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabContainer}
            contentContainerStyle={{ paddingRight: Spacing.lg }}
          >
            {SECTIONS.map((section) => {
              const isActive = activeSection === section.key;
              const count = getCount(section.key);
              return (
                <Pressable
                  key={section.key}
                  testID={`tab-${section.key}`}
                  accessibilityRole="tab"
                  accessibilityLabel={`${section.title}${count > 0 ? `, ${count} items` : ""}`}
                  accessibilityState={{ selected: isActive }}
                  onPress={() => { setActiveSection(section.key); setSearchQuery(""); }}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: isActive ? theme.primary : theme.backgroundDefault,
                      borderColor: isActive ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Feather name={section.icon} size={14 * fontScale} color={isActive ? "#FFFFFF" : theme.textSecondary} />
                  <ThemedText
                    type="caption"
                    style={{ color: isActive ? "#FFFFFF" : theme.text, marginLeft: 4 }}
                  >
                    {section.shortTitle}
                  </ThemedText>
                  {count > 0 ? (
                    <View style={[styles.badge, { backgroundColor: isActive ? "#FFFFFF" : theme.primary }]}>
                      <ThemedText type="caption" style={{ color: isActive ? theme.primary : "#FFFFFF", fontSize: 10 * fontScale }}>
                        {count}
                      </ThemedText>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {(activeSection === "diagnoses" || activeSection === "surgeries" || activeSection === "medications" || activeSection === "allergies") ? (
            <View style={[styles.searchRow, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <Feather name="search" size={18} color={theme.textSecondary} />
              <TextInput
                testID="intake-search"
                accessibilityLabel={`Search ${SECTIONS.find(s => s.key === activeSection)?.title?.toLowerCase()}`}
                style={[styles.searchInput, { color: theme.text, fontSize: 15 * fontScale }]}
                placeholder={`Search ${SECTIONS.find(s => s.key === activeSection)?.title?.toLowerCase()}...`}
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setSearchQuery("")}
                >
                  <Feather name="x" size={18} color={theme.textSecondary} />
                </Pressable>
              ) : null}
              <Pressable
                testID="ai-assist-btn"
                accessibilityRole="button"
                accessibilityLabel="AI assist"
                accessibilityHint="Get AI suggestions for this section"
                accessibilityState={{ disabled: aiSuggesting }}
                onPress={handleAiAssist}
                style={[styles.aiButton, { backgroundColor: theme.primary }]}
                disabled={aiSuggesting}
              >
                {aiSuggesting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="zap" size={14} color="#FFFFFF" />
                    <ThemedText type="caption" style={{ color: "#FFFFFF", marginLeft: 4 }}>AI</ThemedText>
                  </>
                )}
              </Pressable>
            </View>
          ) : null}

          <View style={{ marginTop: Spacing.md }}>
            {activeSection === "diagnoses" ? (
              <DiagnosesSection
                refData={refData}
                searchQuery={searchQuery}
                selected={selectedDiagnoses}
                setSelected={setSelectedDiagnoses}
                theme={theme}
                fontScale={fontScale}
              />
            ) : null}
            {activeSection === "surgeries" ? (
              <SurgeriesSection
                refData={refData}
                searchQuery={searchQuery}
                selected={selectedSurgeries}
                setSelected={setSelectedSurgeries}
                theme={theme}
                fontScale={fontScale}
              />
            ) : null}
            {activeSection === "medications" ? (
              <MedicationsSection
                refData={refData}
                searchQuery={searchQuery}
                selected={selectedMedications}
                setSelected={setSelectedMedications}
                theme={theme}
                fontScale={fontScale}
              />
            ) : null}
            {activeSection === "allergies" ? (
              <AllergiesSection
                refData={refData}
                searchQuery={searchQuery}
                selected={selectedAllergies}
                setSelected={setSelectedAllergies}
                theme={theme}
                fontScale={fontScale}
              />
            ) : null}
            {activeSection === "preventive" ? (
              <PreventiveCareSection
                refData={refData}
                selected={selectedPreventive}
                setSelected={setSelectedPreventive}
                theme={theme}
                fontScale={fontScale}
              />
            ) : null}
            {activeSection === "vaccines" ? (
              <VaccinesSection
                refData={refData}
                selected={selectedVaccines}
                setSelected={setSelectedVaccines}
                theme={theme}
                fontScale={fontScale}
              />
            ) : null}
            {activeSection === "social" ? (
              <SocialHistorySection
                refData={refData}
                values={socialHistory}
                setValues={setSocialHistory}
                theme={theme}
                fontScale={fontScale}
              />
            ) : null}
            {activeSection === "peg" ? (
              <PEGScaleSection
                refData={refData}
                scores={pegScores}
                setScores={setPegScores}
                theme={theme}
                fontScale={fontScale}
              />
            ) : null}
            {activeSection === "phq9" ? (
              <PHQ9Section
                refData={refData}
                answers={phq9Answers}
                setAnswers={setPhq9Answers}
                theme={theme}
                fontScale={fontScale}
              />
            ) : null}
            {activeSection === "sdoh" ? (
              <SDOHSection
                refData={refData}
                answers={sdohAnswers}
                setAnswers={setSdohAnswers}
                theme={theme}
                fontScale={fontScale}
              />
            ) : null}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { backgroundColor: theme.backgroundDefault, borderTopColor: theme.border }]}>
        <View style={styles.progressRow}>
          {SECTIONS.map((s) => {
            const filled = getCount(s.key) > 0;
            return (
              <View
                key={s.key}
                style={[styles.progressDot, { backgroundColor: filled ? theme.success : theme.backgroundTertiary }]}
              />
            );
          })}
        </View>
        <Pressable
          testID="submit-intake"
          accessibilityRole="button"
          accessibilityLabel="Save intake history"
          accessibilityState={{ disabled: submitMutation.isPending }}
          onPress={handleSubmit}
          disabled={submitMutation.isPending}
          style={[styles.submitButton, { backgroundColor: theme.primary, opacity: submitMutation.isPending ? 0.6 : 1 }]}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="save" size={18} color="#FFFFFF" />
              <ThemedText type="h4" style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>Save Intake History</ThemedText>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function SelectableItemList({
  items,
  selected,
  onToggle,
  renderLabel,
  renderSubLabel,
  theme,
  fontScale,
}: {
  items: any[];
  selected: any[];
  onToggle: (item: any) => void;
  renderLabel: (item: any) => string;
  renderSubLabel?: (item: any) => string;
  theme: any;
  fontScale: number;
}) {
  return (
    <View>
      {items.map((item, idx) => {
        const isSelected = selected.some(s => (s.name || s.code) === (item.name || item.code));
        return (
          <Pressable
            key={`${item.name || item.code}-${idx}`}
            testID={`item-${(item.name || item.code || "").replace(/\s+/g, "-").toLowerCase()}`}
            accessibilityRole="checkbox"
            accessibilityLabel={`${renderLabel(item)}${renderSubLabel ? `, ${renderSubLabel(item)}` : ""}`}
            accessibilityState={{ checked: isSelected }}
            onPress={() => onToggle(item)}
            style={[
              styles.listItem,
              {
                backgroundColor: isSelected ? (theme.primary + "15") : theme.backgroundDefault,
                borderColor: isSelected ? theme.primary : theme.border,
              },
            ]}
          >
            <View style={[styles.checkbox, { borderColor: isSelected ? theme.primary : theme.border, backgroundColor: isSelected ? theme.primary : "transparent" }]}>
              {isSelected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <ThemedText type="body" style={{ fontSize: 15 * fontScale }}>{renderLabel(item)}</ThemedText>
              {renderSubLabel ? (
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>{renderSubLabel(item)}</ThemedText>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function DiagnosesSection({ refData, searchQuery, selected, setSelected, theme, fontScale }: any) {
  const items = useMemo(() => {
    const all = refData?.diagnoses || [];
    if (!searchQuery) return all;
    const q = searchQuery.toLowerCase();
    return all.filter((d: any) => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q) || d.category.toLowerCase().includes(q));
  }, [refData, searchQuery]);

  const categories = useMemo(() => {
    const cats = [...new Set(items.map((i: any) => i.category))];
    return cats as string[];
  }, [items]);

  const toggle = (item: any) => {
    setSelected((prev: any[]) => {
      const exists = prev.some(p => p.code === item.code);
      if (exists) return prev.filter(p => p.code !== item.code);
      return [...prev, { ...item, status: "active", yearDiagnosed: "" }];
    });
  };

  return (
    <View>
      {selected.length > 0 ? (
        <View style={{ marginBottom: Spacing.md }}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Selected ({selected.length})</ThemedText>
          {selected.map((d: any) => (
            <View key={d.code} style={[styles.selectedChip, { backgroundColor: theme.primary + "15", borderColor: theme.primary }]}>
              <ThemedText type="small" style={{ flex: 1 }}>{d.name}</ThemedText>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${d.name}`} onPress={() => toggle(d)}>
                <Feather name="x-circle" size={18} color={theme.error} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Top 50 Diagnoses (ICD-10)</ThemedText>
      {categories.map(cat => (
        <View key={cat} style={{ marginBottom: Spacing.md }}>
          <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600", marginBottom: Spacing.xs }}>{cat}</ThemedText>
          <SelectableItemList
            items={items.filter((i: any) => i.category === cat)}
            selected={selected}
            onToggle={toggle}
            renderLabel={(i) => i.name}
            renderSubLabel={(i) => `ICD-10: ${i.code}`}
            theme={theme}
            fontScale={fontScale}
          />
        </View>
      ))}
    </View>
  );
}

function SurgeriesSection({ refData, searchQuery, selected, setSelected, theme, fontScale }: any) {
  const items = useMemo(() => {
    const all = refData?.surgeries || [];
    if (!searchQuery) return all;
    const q = searchQuery.toLowerCase();
    return all.filter((s: any) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
  }, [refData, searchQuery]);

  const toggle = (item: any) => {
    setSelected((prev: any[]) => {
      const exists = prev.some(p => p.code === item.code);
      if (exists) return prev.filter(p => p.code !== item.code);
      return [...prev, { ...item, year: "", hospital: "" }];
    });
  };

  return (
    <View>
      {selected.length > 0 ? (
        <View style={{ marginBottom: Spacing.md }}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Selected ({selected.length})</ThemedText>
          {selected.map((s: any) => (
            <View key={s.code} style={[styles.selectedChip, { backgroundColor: theme.primary + "15", borderColor: theme.primary }]}>
              <ThemedText type="small" style={{ flex: 1 }}>{s.name}</ThemedText>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${s.name}`} onPress={() => toggle(s)}>
                <Feather name="x-circle" size={18} color={theme.error} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Top 10 Surgeries</ThemedText>
      <SelectableItemList
        items={items}
        selected={selected}
        onToggle={toggle}
        renderLabel={(i) => i.name}
        renderSubLabel={(i) => i.category}
        theme={theme}
        fontScale={fontScale}
      />
    </View>
  );
}

function MedicationsSection({ refData, searchQuery, selected, setSelected, theme, fontScale }: any) {
  const items = useMemo(() => {
    const all = refData?.medications || [];
    if (!searchQuery) return all;
    const q = searchQuery.toLowerCase();
    return all.filter((m: any) => m.name.toLowerCase().includes(q) || m.class.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
  }, [refData, searchQuery]);

  const categories = useMemo(() => {
    const cats = [...new Set(items.map((i: any) => i.category))];
    return cats as string[];
  }, [items]);

  const toggle = (item: any) => {
    setSelected((prev: any[]) => {
      const exists = prev.some(p => p.name === item.name);
      if (exists) return prev.filter(p => p.name !== item.name);
      return [...prev, { ...item, dosage: "", frequency: "", prescriber: "" }];
    });
  };

  return (
    <View>
      {selected.length > 0 ? (
        <View style={{ marginBottom: Spacing.md }}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Selected ({selected.length})</ThemedText>
          {selected.map((m: any, idx: number) => (
            <View key={`${m.name}-${idx}`} style={[styles.selectedChip, { backgroundColor: theme.primary + "15", borderColor: theme.primary }]}>
              <ThemedText type="small" style={{ flex: 1 }}>{m.name}</ThemedText>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${m.name}`} onPress={() => toggle(m)}>
                <Feather name="x-circle" size={18} color={theme.error} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Top 75 Medications (RxNorm)</ThemedText>
      {categories.map(cat => (
        <View key={cat} style={{ marginBottom: Spacing.md }}>
          <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600", marginBottom: Spacing.xs }}>{cat}</ThemedText>
          <SelectableItemList
            items={items.filter((i: any) => i.category === cat)}
            selected={selected}
            onToggle={toggle}
            renderLabel={(i) => i.name}
            renderSubLabel={(i) => `${i.class} | RxNorm: ${i.rxNorm}`}
            theme={theme}
            fontScale={fontScale}
          />
        </View>
      ))}
    </View>
  );
}

function AllergiesSection({ refData, searchQuery, selected, setSelected, theme, fontScale }: any) {
  const allergyData = refData?.allergies || { medication: [], food: [], environmental: [] };

  const allItems = useMemo(() => {
    const all = [...(allergyData.medication || []), ...(allergyData.food || []), ...(allergyData.environmental || [])];
    if (!searchQuery) return all;
    const q = searchQuery.toLowerCase();
    return all.filter((a: any) => a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q));
  }, [allergyData, searchQuery]);

  const toggle = (item: any) => {
    setSelected((prev: any[]) => {
      const exists = prev.some(p => p.name === item.name);
      if (exists) return prev.filter(p => p.name !== item.name);
      return [...prev, { ...item, reaction: "" }];
    });
  };

  const allergyGroups = [
    { title: "Medication Allergies", type: "medication", icon: "package" as const },
    { title: "Food Allergies", type: "food", icon: "coffee" as const },
    { title: "Environmental Allergies", type: "environmental", icon: "wind" as const },
  ];

  return (
    <View>
      {selected.length > 0 ? (
        <View style={{ marginBottom: Spacing.md }}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Selected ({selected.length})</ThemedText>
          {selected.map((a: any, idx: number) => (
            <View key={`${a.name}-${idx}`} style={[styles.selectedChip, { backgroundColor: theme.warning + "15", borderColor: theme.warning }]}>
              <View style={[styles.severityDot, { backgroundColor: a.severity === "severe" ? theme.error : a.severity === "moderate" ? theme.warning : theme.success }]} />
              <ThemedText type="small" style={{ flex: 1 }}>{a.name}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginRight: Spacing.sm }}>{a.type}</ThemedText>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${a.name}`} onPress={() => toggle(a)}>
                <Feather name="x-circle" size={18} color={theme.error} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Top 50 Allergies</ThemedText>
      {allergyGroups.map(group => {
        const groupItems = allItems.filter((i: any) => i.type === group.type);
        if (groupItems.length === 0) return null;
        return (
          <View key={group.type} style={{ marginBottom: Spacing.md }}>
            <View style={styles.groupHeader}>
              <Feather name={group.icon} size={16} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600", marginLeft: Spacing.sm }}>{group.title}</ThemedText>
            </View>
            <SelectableItemList
              items={groupItems}
              selected={selected}
              onToggle={toggle}
              renderLabel={(i) => i.name}
              renderSubLabel={(i) => `Severity: ${i.severity}`}
              theme={theme}
              fontScale={fontScale}
            />
          </View>
        );
      })}
    </View>
  );
}

function PreventiveCareSection({ refData, selected, setSelected, theme, fontScale }: any) {
  const items = refData?.preventiveCare || [];

  const toggle = (item: any) => {
    setSelected((prev: any[]) => {
      const exists = prev.some(p => p.name === item.name);
      if (exists) return prev.filter(p => p.name !== item.name);
      return [...prev, { ...item, lastDate: "", result: "", nextDue: "" }];
    });
  };

  const categories = useMemo(() => [...new Set(items.map((i: any) => i.category))] as string[], [items]);

  return (
    <View>
      {selected.length > 0 ? (
        <View style={{ marginBottom: Spacing.md }}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Completed ({selected.length})</ThemedText>
          {selected.map((p: any, idx: number) => (
            <View key={`${p.name}-${idx}`} style={[styles.selectedChip, { backgroundColor: theme.success + "15", borderColor: theme.success }]}>
              <Feather name="check-circle" size={16} color={theme.success} style={{ marginRight: Spacing.sm }} />
              <ThemedText type="small" style={{ flex: 1 }}>{p.name}</ThemedText>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`} onPress={() => toggle(p)}>
                <Feather name="x-circle" size={18} color={theme.error} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Preventive Care Checklist</ThemedText>
      {categories.map(cat => (
        <View key={cat} style={{ marginBottom: Spacing.md }}>
          <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600", marginBottom: Spacing.xs }}>{cat}</ThemedText>
          {items.filter((i: any) => i.category === cat).map((item: any, idx: number) => {
            const isSelected = selected.some((s: any) => s.name === item.name);
            return (
              <Pressable
                key={`${item.name}-${idx}`}
                accessibilityRole="checkbox"
                accessibilityLabel={`${item.name}, ${item.frequency}, Ages ${item.ageGroup}`}
                accessibilityState={{ checked: isSelected }}
                onPress={() => toggle(item)}
                style={[styles.listItem, { backgroundColor: isSelected ? theme.success + "10" : theme.backgroundDefault, borderColor: isSelected ? theme.success : theme.border }]}
              >
                <View style={[styles.checkbox, { borderColor: isSelected ? theme.success : theme.border, backgroundColor: isSelected ? theme.success : "transparent" }]}>
                  {isSelected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <ThemedText type="body" style={{ fontSize: 15 * fontScale }}>{item.name}</ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {item.frequency} | Ages: {item.ageGroup}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function VaccinesSection({ refData, selected, setSelected, theme, fontScale }: any) {
  const items = refData?.vaccines || [];

  const toggle = (item: any) => {
    setSelected((prev: any[]) => {
      const exists = prev.some(p => p.name === item.name);
      if (exists) return prev.filter(p => p.name !== item.name);
      return [...prev, { ...item, date: "", lotNumber: "", administeredBy: "", source: "self-reported" }];
    });
  };

  return (
    <View>
      <View style={[styles.infoBox, { backgroundColor: theme.info + "15", borderColor: theme.info }]}>
        <Feather name="info" size={16} color={theme.info} />
        <ThemedText type="small" style={{ flex: 1, marginLeft: Spacing.sm, color: theme.info }}>
          Vaccine records can also be pulled from your state immunization registry. Check the items you have received.
        </ThemedText>
      </View>
      {selected.length > 0 ? (
        <View style={{ marginBottom: Spacing.md, marginTop: Spacing.md }}>
          <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>Received ({selected.length})</ThemedText>
          {selected.map((v: any, idx: number) => (
            <View key={`${v.name}-${idx}`} style={[styles.selectedChip, { backgroundColor: theme.success + "15", borderColor: theme.success }]}>
              <Feather name="check-circle" size={16} color={theme.success} style={{ marginRight: Spacing.sm }} />
              <ThemedText type="small" style={{ flex: 1 }}>{v.name}</ThemedText>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${v.name}`} onPress={() => toggle(v)}>
                <Feather name="x-circle" size={18} color={theme.error} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <ThemedText type="h4" style={{ marginBottom: Spacing.sm, marginTop: Spacing.md }}>Vaccine Registry ({items.length})</ThemedText>
      {items.map((item: any, idx: number) => {
        const isSelected = selected.some((s: any) => s.name === item.name);
        return (
          <Pressable
            key={`${item.name}-${idx}`}
            accessibilityRole="checkbox"
            accessibilityLabel={`${item.name}, ${item.schedule}, ${item.doses} doses`}
            accessibilityState={{ checked: isSelected }}
            onPress={() => toggle(item)}
            style={[styles.listItem, { backgroundColor: isSelected ? theme.success + "10" : theme.backgroundDefault, borderColor: isSelected ? theme.success : theme.border }]}
          >
            <View style={[styles.checkbox, { borderColor: isSelected ? theme.success : theme.border, backgroundColor: isSelected ? theme.success : "transparent" }]}>
              {isSelected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <ThemedText type="body" style={{ fontSize: 15 * fontScale }}>{item.name}</ThemedText>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {item.schedule} | Ages: {item.ageGroup} | {item.doses} dose(s)
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function SocialHistorySection({ refData, values, setValues, theme, fontScale }: any) {
  const fields = refData?.socialHistoryFields || [];

  const updateField = (id: string, value: any) => {
    setValues((prev: any) => ({ ...prev, [id]: value }));
  };

  return (
    <View>
      <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>Social History</ThemedText>
      {fields.map((field: any) => (
        <View key={field.id} style={[styles.formField, { borderColor: theme.border }]}>
          <ThemedText type="body" style={{ fontSize: 14 * fontScale, fontWeight: "600", marginBottom: Spacing.xs }}>{field.label}</ThemedText>
          {field.type === "select" ? (
            <View style={styles.optionsRow}>
              {field.options.map((opt: string) => {
                const isSelected = values[field.id] === opt;
                return (
                  <Pressable
                    key={opt}
                    accessibilityRole="radio"
                    accessibilityLabel={opt}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => updateField(field.id, opt)}
                    style={[styles.optionChip, { backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary, borderColor: isSelected ? theme.primary : theme.border }]}
                  >
                    <ThemedText type="caption" style={{ color: isSelected ? "#FFFFFF" : theme.text, fontSize: 12 * fontScale }}>{opt}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {field.type === "multiselect" ? (
            <View style={styles.optionsRow}>
              {field.options.map((opt: string) => {
                const arr = values[field.id] || [];
                const isSelected = arr.includes(opt);
                return (
                  <Pressable
                    key={opt}
                    accessibilityRole="checkbox"
                    accessibilityLabel={opt}
                    accessibilityState={{ checked: isSelected }}
                    onPress={() => {
                      if (isSelected) {
                        updateField(field.id, arr.filter((v: string) => v !== opt));
                      } else {
                        updateField(field.id, [...arr, opt]);
                      }
                    }}
                    style={[styles.optionChip, { backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary, borderColor: isSelected ? theme.primary : theme.border }]}
                  >
                    <ThemedText type="caption" style={{ color: isSelected ? "#FFFFFF" : theme.text, fontSize: 12 * fontScale }}>{opt}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {field.type === "text" ? (
            <TextInput
              accessibilityLabel={field.label}
              style={[styles.textField, { color: theme.text, backgroundColor: theme.backgroundSecondary, borderColor: theme.border, fontSize: 14 * fontScale }]}
              placeholder={field.placeholder}
              placeholderTextColor={theme.textSecondary}
              value={values[field.id] || ""}
              onChangeText={(t) => updateField(field.id, t)}
            />
          ) : null}
          {field.type === "number" ? (
            <TextInput
              accessibilityLabel={field.label}
              style={[styles.textField, { color: theme.text, backgroundColor: theme.backgroundSecondary, borderColor: theme.border, fontSize: 14 * fontScale, width: 100 }]}
              placeholder={field.placeholder}
              placeholderTextColor={theme.textSecondary}
              value={values[field.id]?.toString() || ""}
              onChangeText={(t) => updateField(field.id, t)}
              keyboardType="numeric"
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

function PEGScaleSection({ refData, scores, setScores, theme, fontScale }: any) {
  const questions = refData?.pegScaleQuestions || [];
  const avgScore = Math.round(((scores.pain + scores.enjoyment + scores.activity) / 3) * 10) / 10;

  const getSliderColor = (value: number) => {
    if (value <= 3) return theme.success;
    if (value <= 6) return theme.warning;
    return theme.error;
  };

  return (
    <View>
      <ThemedText type="h4" style={{ marginBottom: Spacing.xs }}>PEG Pain Assessment Scale</ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
        Rate each question from 0-10 based on your experience in the past week.
      </ThemedText>
      {questions.map((q: any) => {
        const val = scores[q.id as keyof typeof scores] || 0;
        return (
          <View key={q.id} style={[styles.scaleCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <ThemedText type="body" style={{ fontSize: 14 * fontScale, marginBottom: Spacing.md }}>{q.text}</ThemedText>
            <View style={styles.scaleRow}>
              <ThemedText type="caption" style={{ color: theme.textSecondary, width: 60 }}>{q.anchor_low}</ThemedText>
              <View style={styles.scaleButtons}>
                {Array.from({ length: 11 }, (_, i) => (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityLabel={`Score ${i}`}
                    accessibilityState={{ selected: val === i }}
                    onPress={() => setScores((prev: any) => ({ ...prev, [q.id]: i }))}
                    style={[
                      styles.scaleButton,
                      {
                        backgroundColor: val === i ? getSliderColor(i) : theme.backgroundSecondary,
                        borderColor: val === i ? getSliderColor(i) : theme.border,
                      },
                    ]}
                  >
                    <ThemedText type="caption" style={{ color: val === i ? "#FFFFFF" : theme.text, fontSize: 11 * fontScale }}>{i}</ThemedText>
                  </Pressable>
                ))}
              </View>
              <ThemedText type="caption" style={{ color: theme.textSecondary, width: 60, textAlign: "right" }}>{q.anchor_high}</ThemedText>
            </View>
          </View>
        );
      })}
      {(scores.pain + scores.enjoyment + scores.activity) > 0 ? (
        <View style={[styles.scoreResult, { backgroundColor: getSliderColor(avgScore) + "15", borderColor: getSliderColor(avgScore) }]}>
          <ThemedText type="h3" style={{ color: getSliderColor(avgScore) }}>PEG Average: {avgScore}/10</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
            {avgScore <= 3 ? "Mild pain impact" : avgScore <= 6 ? "Moderate pain impact" : "Severe pain impact"}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function PHQ9Section({ refData, answers, setAnswers, theme, fontScale }: any) {
  const questions = refData?.phq9Questions || [];
  const scoring = refData?.phq9Scoring || [];
  const totalScore = Object.values(answers).reduce((s: number, v: any) => s + (v || 0), 0);

  const getSeverityColor = (score: number) => {
    if (score <= 4) return theme.success;
    if (score <= 9) return theme.info;
    if (score <= 14) return theme.warning;
    if (score <= 19) return theme.warning;
    return theme.error;
  };

  const getSeverityLabel = (score: number) => {
    if (score <= 4) return "Minimal";
    if (score <= 9) return "Mild";
    if (score <= 14) return "Moderate";
    if (score <= 19) return "Moderately Severe";
    return "Severe";
  };

  return (
    <View>
      <ThemedText type="h4" style={{ marginBottom: Spacing.xs }}>PHQ-9 Depression Screening</ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
        Over the last 2 weeks, how often have you been bothered by the following problems?
      </ThemedText>
      {questions.map((q: any) => (
        <View key={q.id} style={[styles.phq9Card, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <ThemedText type="body" style={{ fontSize: 14 * fontScale, marginBottom: Spacing.md }}>
            {q.id}. {q.text}
          </ThemedText>
          <View style={styles.phq9Options}>
            {scoring.map((opt: any) => {
              const isSelected = answers[q.id] === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  testID={`phq9-q${q.id}-${opt.value}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`${opt.label} for question ${q.id}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setAnswers((prev: any) => ({ ...prev, [q.id]: opt.value }))}
                  style={[
                    styles.phq9Option,
                    {
                      backgroundColor: isSelected ? theme.primary : theme.backgroundSecondary,
                      borderColor: isSelected ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <ThemedText type="caption" style={{ color: isSelected ? "#FFFFFF" : theme.text, fontSize: 11 * fontScale, textAlign: "center" }}>
                    {opt.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {Object.keys(answers).length > 0 ? (
        <View style={[styles.scoreResult, { backgroundColor: getSeverityColor(totalScore) + "15", borderColor: getSeverityColor(totalScore) }]}>
          <ThemedText type="h3" style={{ color: getSeverityColor(totalScore) }}>PHQ-9 Score: {totalScore}/27</ThemedText>
          <ThemedText type="body" style={{ color: theme.text, marginTop: Spacing.xs, fontWeight: "600" }}>
            {getSeverityLabel(totalScore)} Depression
          </ThemedText>
          {totalScore >= 10 ? (
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
              A score of 10 or higher may indicate a need for further evaluation. Please discuss with your healthcare provider.
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function SDOHSection({ refData, answers, setAnswers, theme, fontScale }: any) {
  const questions = refData?.sdohQuestions || [];

  const categories = useMemo(() => [...new Set(questions.map((q: any) => q.category))] as string[], [questions]);

  const updateAnswer = (id: string, value: any) => {
    setAnswers((prev: any) => ({ ...prev, [id]: value }));
  };

  return (
    <View>
      <ThemedText type="h4" style={{ marginBottom: Spacing.xs }}>Social Determinants of Health</ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.lg }}>
        These questions help your care team understand factors that may affect your health and well-being.
      </ThemedText>
      {categories.map(cat => (
        <View key={cat} style={{ marginBottom: Spacing.lg }}>
          <View style={[styles.categoryHeader, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="small" style={{ color: theme.primary, fontWeight: "600" }}>{cat}</ThemedText>
          </View>
          {questions.filter((q: any) => q.category === cat).map((q: any) => (
            <View key={q.id} style={[styles.sdohCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
              <ThemedText type="body" style={{ fontSize: 14 * fontScale, marginBottom: Spacing.md }}>{q.text}</ThemedText>
              {q.type === "boolean" ? (
                <View style={styles.booleanRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Yes"
                    accessibilityState={{ selected: answers[q.id] === true }}
                    onPress={() => updateAnswer(q.id, true)}
                    style={[styles.booleanBtn, { backgroundColor: answers[q.id] === true ? theme.primary : theme.backgroundSecondary, borderColor: answers[q.id] === true ? theme.primary : theme.border }]}
                  >
                    <ThemedText type="body" style={{ color: answers[q.id] === true ? "#FFFFFF" : theme.text, fontSize: 14 * fontScale }}>Yes</ThemedText>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="No"
                    accessibilityState={{ selected: answers[q.id] === false }}
                    onPress={() => updateAnswer(q.id, false)}
                    style={[styles.booleanBtn, { backgroundColor: answers[q.id] === false ? theme.primary : theme.backgroundSecondary, borderColor: answers[q.id] === false ? theme.primary : theme.border }]}
                  >
                    <ThemedText type="body" style={{ color: answers[q.id] === false ? "#FFFFFF" : theme.text, fontSize: 14 * fontScale }}>No</ThemedText>
                  </Pressable>
                </View>
              ) : null}
              {q.type === "select" ? (
                <View style={{ gap: Spacing.xs }}>
                  {q.options.map((opt: string) => {
                    const isSelected = answers[q.id] === opt;
                    return (
                      <Pressable
                        key={opt}
                        accessibilityRole="radio"
                        accessibilityLabel={opt}
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => updateAnswer(q.id, opt)}
                        style={[styles.sdohOption, { backgroundColor: isSelected ? theme.primary + "15" : theme.backgroundSecondary, borderColor: isSelected ? theme.primary : theme.border }]}
                      >
                        <View style={[styles.radioOuter, { borderColor: isSelected ? theme.primary : theme.border }]}>
                          {isSelected ? <View style={[styles.radioInner, { backgroundColor: theme.primary }]} /> : null}
                        </View>
                        <ThemedText type="small" style={{ flex: 1, marginLeft: Spacing.sm, fontSize: 13 * fontScale }}>{opt}</ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ))}
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
    marginBottom: Spacing.md,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
    paddingHorizontal: 4,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === "ios" ? Spacing.md : Spacing.xs,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  aiButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginLeft: Spacing.sm,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.xs,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
  },
  formField: {
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  optionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  textField: {
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    padding: Spacing.md,
  },
  scaleCard: {
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  scaleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  scaleButtons: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 3,
  },
  scaleButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  scoreResult: {
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
    alignItems: "center",
  },
  phq9Card: {
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  phq9Options: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  phq9Option: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    alignItems: "center",
  },
  categoryHeader: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginBottom: Spacing.sm,
  },
  sdohCard: {
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  booleanRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  booleanBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    alignItems: "center",
  },
  sdohOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    borderTopWidth: 1,
    paddingBottom: Spacing.xl + 20,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
    marginBottom: Spacing.md,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
});
