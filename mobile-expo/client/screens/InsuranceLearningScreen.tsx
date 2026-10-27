import React, { useState, useRef, useCallback } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useHeaderHeight } from "@react-navigation/elements";
import { useLanguage } from "@/context/LanguageContext";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { LoadingState } from "@/components/ui";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withDelay,
  interpolate,
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInRight,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface LearningStep {
  title: string;
  content: string;
  example: string;
  animation: string;
}

interface LearningModule {
  id: string;
  title: string;
  icon: string;
  color: string;
  difficulty: string;
  durationMinutes: number;
  steps: LearningStep[];
}

interface ModulesData {
  modules: LearningModule[];
  totalModules: number;
  categories: { beginner: number; intermediate: number; advanced: number };
}

const DIFFICULTY_LABELS: Record<string, { label: string; color: string }> = {
  beginner: { label: "Beginner", color: "#10B981" },
  intermediate: { label: "Intermediate", color: "#F59E0B" },
  advanced: { label: "Advanced", color: "#EF4444" },
};

function AnimatedProgressBar({ progress, color }: { progress: number; color: string }) {
  const width = useSharedValue(0);

  React.useEffect(() => {
    width.value = withSpring(progress, { damping: 15, stiffness: 90 });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
    backgroundColor: color,
    height: 6,
    borderRadius: 3,
  }));

  return (
    <View style={{ height: 6, backgroundColor: "rgba(0,0,0,0.1)", borderRadius: 3, overflow: "hidden" }}>
      <Animated.View style={animatedStyle} />
    </View>
  );
}

function CostSplitAnimation({ step, color, theme }: { step: LearningStep; color: string; theme: any }) {
  const animProgress = useSharedValue(0);

  React.useEffect(() => {
    animProgress.value = withDelay(300, withSpring(1, { damping: 12, stiffness: 80 }));
  }, []);

  const leftBarStyle = useAnimatedStyle(() => ({
    height: interpolate(animProgress.value, [0, 1], [0, 60], Extrapolation.CLAMP),
    backgroundColor: color,
    width: 40,
    borderRadius: 6,
    marginRight: 8,
  }));

  const rightBarStyle = useAnimatedStyle(() => ({
    height: interpolate(animProgress.value, [0, 1], [0, 120], Extrapolation.CLAMP),
    backgroundColor: theme.primary,
    width: 40,
    borderRadius: 6,
  }));

  return (
    <View style={{ alignItems: "center", marginVertical: Spacing.md }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: 130 }}>
        <View style={{ alignItems: "center" }}>
          <Animated.View style={leftBarStyle} />
          <ThemedText type="small" style={{ marginTop: 4, fontWeight: "600" }}>You</ThemedText>
        </View>
        <View style={{ alignItems: "center" }}>
          <Animated.View style={rightBarStyle} />
          <ThemedText type="small" style={{ marginTop: 4, fontWeight: "600" }}>Insurance</ThemedText>
        </View>
      </View>
    </View>
  );
}

function TierAnimation({ color, theme }: { color: string; theme: any }) {
  const tiers = [
    { label: "Tier 1", amount: "$10", width: 30, delay: 0 },
    { label: "Tier 2", amount: "$35", width: 50, delay: 150 },
    { label: "Tier 3", amount: "$60", width: 70, delay: 300 },
    { label: "Tier 4", amount: "$100+", width: 90, delay: 450 },
  ];

  return (
    <View style={{ marginVertical: Spacing.md }}>
      {tiers.map((tier) => (
        <Animated.View
          key={tier.label}
          entering={FadeInDown.delay(tier.delay).springify()}
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <ThemedText type="small" style={{ width: 50, fontWeight: "600" }}>{tier.label}</ThemedText>
          <View
            style={{
              height: 28,
              width: `${tier.width}%`,
              backgroundColor: color + "30",
              borderRadius: 14,
              justifyContent: "center",
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: color + "50",
            }}
          >
            <ThemedText type="small" style={{ fontWeight: "700", color }}>{tier.amount}</ThemedText>
          </View>
        </Animated.View>
      ))}
    </View>
  );
}

function StepVisualizer({ step, color, theme }: { step: LearningStep; color: string; theme: any }) {
  if (step.animation === "cost_split" || step.animation === "percentage_split" || step.animation === "fixed_vs_percentage") {
    return <CostSplitAnimation step={step} color={color} theme={theme} />;
  }
  if (step.animation === "medication_tiers" || step.animation === "tier_comparison") {
    return <TierAnimation color={color} theme={theme} />;
  }

  const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
    wallet_to_desk: "dollar-sign",
    progress_bar_fill: "trending-up",
    family_buckets: "users",
    service_sorting: "list",
    insurance_kicks_in: "shield",
    safety_net: "umbrella",
    network_map: "map",
    cost_comparison: "bar-chart-2",
    emergency_shield: "alert-circle",
    checklist: "check-square",
    approval_flow: "check-circle",
    category_sort: "filter",
    timeline: "clock",
    appeal_steps: "arrow-up-circle",
    doctor_handoff: "send",
    plan_comparison: "columns",
    step_process: "git-branch",
  };

  const icon = iconMap[step.animation] || "info";

  return (
    <Animated.View
      entering={FadeIn.delay(200).springify()}
      style={{
        alignItems: "center",
        justifyContent: "center",
        marginVertical: Spacing.md,
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: color + "20",
        alignSelf: "center",
      }}
    >
      <Feather name={icon} size={36} color={color} />
    </Animated.View>
  );
}

function ModuleCard({
  module,
  onPress,
  theme,
}: {
  module: LearningModule;
  onPress: () => void;
  theme: any;
}) {
  const diff = DIFFICULTY_LABELS[module.difficulty] || DIFFICULTY_LABELS.beginner;

  return (
    <Pressable testID={`module-${module.id}`} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${module.title}, ${diff.label}, ${module.durationMinutes} minutes, ${module.steps.length} steps`}>
      <Card style={{ marginBottom: Spacing.md, padding: Spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: module.color + "20",
              alignItems: "center",
              justifyContent: "center",
              marginRight: Spacing.md,
            }}
          >
            <Feather name={module.icon as any} size={24} color={module.color} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText type="subtitle" style={{ fontWeight: "700", marginBottom: 2 }}>
              {module.title}
            </ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  backgroundColor: diff.color + "20",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 10,
                }}
              >
                <ThemedText type="small" style={{ color: diff.color, fontWeight: "600", fontSize: 11 }}>
                  {diff.label}
                </ThemedText>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather name="clock" size={12} color={theme.textSecondary} />
                <ThemedText type="small" style={{ marginLeft: 4, color: theme.textSecondary }}>
                  {module.durationMinutes} min
                </ThemedText>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Feather name="layers" size={12} color={theme.textSecondary} />
                <ThemedText type="small" style={{ marginLeft: 4, color: theme.textSecondary }}>
                  {module.steps.length} steps
                </ThemedText>
              </View>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </View>
      </Card>
    </Pressable>
  );
}

function LessonView({
  module,
  onBack,
  theme,
}: {
  module: LearningModule;
  onBack: () => void;
  theme: any;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = module.steps[currentStep];
  const isLastStep = currentStep === module.steps.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.md }}>
        <Pressable testID="button-back-modules" onPress={onBack} style={{ marginRight: Spacing.md }} accessibilityRole="button" accessibilityLabel="Back to modules">
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText type="subtitle" style={{ fontWeight: "700" }}>{module.title}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Step {currentStep + 1} of {module.steps.length}
          </ThemedText>
        </View>
      </View>

      <AnimatedProgressBar
        progress={(currentStep + 1) / module.steps.length}
        color={module.color}
      />

      <ScrollView
        key={currentStep}
        style={{ flex: 1, marginTop: Spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={SlideInRight.duration(300)}>
          <StepVisualizer step={step} color={module.color} theme={theme} />

          <ThemedText
            type="subtitle"
            style={{ fontWeight: "700", marginBottom: Spacing.sm, textAlign: "center" }}
          >
            {step.title}
          </ThemedText>

          <ThemedText
            type="body"
            style={{
              lineHeight: 24,
              color: theme.text,
              marginBottom: Spacing.lg,
            }}
          >
            {step.content}
          </ThemedText>

          <Card
            style={{
              padding: Spacing.md,
              backgroundColor: module.color + "10",
              borderLeftWidth: 4,
              borderLeftColor: module.color,
              marginBottom: Spacing.xl,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
              <Feather name="zap" size={14} color={module.color} />
              <ThemedText
                type="small"
                style={{ fontWeight: "700", marginLeft: 6, color: module.color }}
              >
                Example
              </ThemedText>
            </View>
            <ThemedText type="body" style={{ lineHeight: 22 }}>
              {step.example}
            </ThemedText>
          </Card>
        </Animated.View>
      </ScrollView>

      <View style={{ flexDirection: "row", gap: Spacing.md, paddingTop: Spacing.md }}>
        {!isFirstStep ? (
          <Pressable
            testID="button-prev-step"
            onPress={() => setCurrentStep(s => s - 1)}
            style={[
              styles.navButton,
              { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, borderWidth: 1, flex: 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Previous step"
          >
            <Feather name="arrow-left" size={18} color={theme.text} />
            <ThemedText style={{ marginLeft: 6, fontWeight: "600" }}>Previous</ThemedText>
          </Pressable>
        ) : null}
        <Pressable
          testID="button-next-step"
          onPress={() => {
            if (isLastStep) {
              onBack();
            } else {
              setCurrentStep(s => s + 1);
            }
          }}
          style={[
            styles.navButton,
            { backgroundColor: module.color, flex: 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={isLastStep ? "Complete module" : "Next step"}
        >
          <ThemedText style={{ color: "#FFF", fontWeight: "700", marginRight: 6 }}>
            {isLastStep ? "Complete" : "Next"}
          </ThemedText>
          <Feather name={isLastStep ? "check" : "arrow-right"} size={18} color="#FFF" />
        </Pressable>
      </View>
    </View>
  );
}

export default function InsuranceLearningScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const { language } = useLanguage();
  const [selectedModule, setSelectedModule] = useState<LearningModule | null>(null);
  const [filterDifficulty, setFilterDifficulty] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ModulesData>({
    queryKey: ["/api/savings/insurance-learning/modules"],
  });

  const filteredModules = React.useMemo(() => {
    if (!data) return [];
    if (!filterDifficulty) return data.modules;
    return data.modules.filter(m => m.difficulty === filterDifficulty);
  }, [data, filterDifficulty]);

  if (isLoading) {
    return <LoadingState fullScreen />;
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: 100,
          paddingHorizontal: Spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {selectedModule ? (
          <LessonView
            module={selectedModule}
            onBack={() => setSelectedModule(null)}
            theme={theme}
          />
        ) : (
          <>
            <Animated.View entering={FadeInDown.duration(400)}>
              <Card style={{ padding: Spacing.lg, marginBottom: Spacing.lg }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: theme.primary + "20",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: Spacing.md,
                    }}
                  >
                    <Feather name="book-open" size={22} color={theme.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText type="subtitle" style={{ fontWeight: "700" }}>
                      Insurance Navigator
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      Learn how insurance works — step by step
                    </ThemedText>
                  </View>
                </View>
                <ThemedText type="body" style={{ lineHeight: 22, color: theme.textSecondary }}>
                  Interactive lessons explain copays, deductibles, networks, prior auth, and referrals with real examples and animated visuals. Available in {language === "en" ? "50+ languages" : "your language"}.
                </ThemedText>
              </Card>
            </Animated.View>

            <View style={{ flexDirection: "row", marginBottom: Spacing.md, gap: 8 }}>
              {[
                { key: null, label: "All" },
                { key: "beginner", label: "Beginner" },
                { key: "intermediate", label: "Intermediate" },
                { key: "advanced", label: "Advanced" },
              ].map((f) => (
                <Pressable
                  key={f.key || "all"}
                  testID={`filter-${f.key || "all"}`}
                  onPress={() => setFilterDifficulty(f.key)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: BorderRadius.full,
                    backgroundColor:
                      filterDifficulty === f.key
                        ? theme.primary
                        : theme.backgroundSecondary,
                    borderWidth: 1,
                    borderColor:
                      filterDifficulty === f.key ? theme.primary : theme.border,
                  }}
                  accessibilityRole="tab"
                  accessibilityLabel={`Filter by ${f.label}`}
                  accessibilityState={{ selected: filterDifficulty === f.key }}
                >
                  <ThemedText
                    type="small"
                    style={{
                      fontWeight: "600",
                      color: filterDifficulty === f.key ? "#FFF" : theme.textSecondary,
                    }}
                  >
                    {f.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {filteredModules.map((mod) => (
              <ModuleCard
                key={mod.id}
                module={mod}
                onPress={() => setSelectedModule(mod)}
                theme={theme}
              />
            ))}

            {filteredModules.length === 0 ? (
              <Card style={{ padding: Spacing.xl, alignItems: "center" }}>
                <Feather name="search" size={32} color={theme.textSecondary} />
                <ThemedText
                  type="body"
                  style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
                >
                  No modules match this filter
                </ThemedText>
              </Card>
            ) : null}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
  },
});
