import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { CodeLookup, type CodeResult } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { axiosInstance } from "@/lib/api";

interface LabTest {
  code: string;
  name: string;
  loincCode: string;
  category: string;
  specimenType: string;
  fastingRequired: boolean;
  turnaroundDays: number;
  availableAt: string[];
  commonDiagnoses: Array<{ code: string; description: string }>;
  panelComponents?: string[];
  estimatedCost?: { quest: number; labcorp: number };
}

interface TestCategory {
  id: string;
  name: string;
  count: number;
}

interface SelectedTest {
  code: string;
  name: string;
  loincCode: string;
  category: string;
}

type OrderStep = "select_tests" | "configure" | "review";
type LabProvider = "quest" | "labcorp";
type Priority = "routine" | "stat" | "urgent";

export default function LabOrderingScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<OrderStep>("select_tests");
  const [selectedTests, setSelectedTests] = useState<SelectedTest[]>([]);
  const [labProvider, setLabProvider] = useState<LabProvider>("quest");
  const [priority, setPriority] = useState<Priority>("routine");
  const [patientId, setPatientId] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<Array<{ code: string; description: string }>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const [showOrderDetail, setShowOrderDetail] = useState<any>(null);
  const [loincSuggestions, setLoincSuggestions] = useState<CodeResult[]>([]);

  const { data: catalogData, isLoading: catalogLoading } = useQuery({
    queryKey: ["/api/lab-orders/catalog"],
  });

  const { data: ordersData, isLoading: ordersLoading, refetch: refetchOrders } = useQuery({
    queryKey: ["/api/lab-orders"],
  });

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await axiosInstance.post("/api/lab-orders", orderData);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lab-orders"] });
    },
  });

  const submitOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await axiosInstance.post(`/api/lab-orders/${orderId}/submit`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lab-orders"] });
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const response = await axiosInstance.post(`/api/lab-orders/${orderId}/cancel`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lab-orders"] });
    },
  });

  const catalog: LabTest[] = (catalogData as any)?.catalog || [];
  const categories: TestCategory[] = (catalogData as any)?.categories || [];
  const orders: any[] = (ordersData as any)?.orders || [];

  const filteredTests = useMemo(() => {
    let filtered = [...catalog];
    if (selectedCategory) {
      filtered = filtered.filter((t) => t.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.code.toLowerCase().includes(q) ||
          t.loincCode.includes(q)
      );
    }
    filtered = filtered.filter((t) => t.availableAt.includes(labProvider));
    return filtered;
  }, [catalog, selectedCategory, searchQuery, labProvider]);

  const fastingRequired = useMemo(
    () => selectedTests.some((t) => catalog.find((c) => c.code === t.code)?.fastingRequired),
    [selectedTests, catalog]
  );

  const estimatedCost = useMemo(() => {
    return selectedTests.reduce((total, t) => {
      const entry = catalog.find((c) => c.code === t.code);
      const cost = entry?.estimatedCost?.[labProvider] || 0;
      return total + cost;
    }, 0);
  }, [selectedTests, catalog, labProvider]);

  const toggleTest = useCallback(
    (test: LabTest) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedTests((prev) => {
        const exists = prev.find((t) => t.code === test.code);
        if (exists) {
          return prev.filter((t) => t.code !== test.code);
        }
        return [...prev, { code: test.code, name: test.name, loincCode: test.loincCode, category: test.category }];
      });
    },
    []
  );

  const availableDiagnoses = useMemo(() => {
    const diagMap = new Map<string, { code: string; description: string }>();
    selectedTests.forEach((t) => {
      const entry = catalog.find((c) => c.code === t.code);
      entry?.commonDiagnoses.forEach((d) => {
        if (!diagMap.has(d.code)) {
          diagMap.set(d.code, d);
        }
      });
    });
    return Array.from(diagMap.values());
  }, [selectedTests, catalog]);

  const handleCreateAndSubmit = useCallback(async () => {
    if (!patientId.trim()) {
      Alert.alert("Patient Required", "Please enter a patient ID to place the order.");
      return;
    }

    if (selectedTests.length === 0) {
      Alert.alert("No Tests Selected", "Please select at least one test.");
      return;
    }

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const result = await createOrderMutation.mutateAsync({
        patientId: patientId.trim(),
        labProvider,
        tests: selectedTests,
        diagnoses: selectedDiagnoses,
        priority,
        specialInstructions: specialInstructions.trim() || undefined,
        fastingRequired,
      });

      const submitResult = await submitOrderMutation.mutateAsync(result.orderId);

      setStep("select_tests");
      setSelectedTests([]);
      setSelectedDiagnoses([]);
      setPatientId("");
      setSpecialInstructions("");
      setPriority("routine");

      Alert.alert(
        "Order Submitted",
        `Order ${submitResult.orderNumber} submitted to ${labProvider === "quest" ? "Quest Diagnostics" : "LabCorp"}.\n\nAccession: ${submitResult.confirmationDetails.accessionNumber}\nEstimated results: ${new Date(submitResult.estimatedResultDate).toLocaleDateString()}`
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit order");
    }
  }, [patientId, selectedTests, labProvider, selectedDiagnoses, priority, specialInstructions, fastingRequired, createOrderMutation, submitOrderMutation]);

  const handleCancelOrder = useCallback(
    (orderId: string) => {
      Alert.alert("Cancel Order", "Are you sure you want to cancel this order?", [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelOrderMutation.mutateAsync({ orderId, reason: "Provider cancelled" });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to cancel order");
            }
          },
        },
      ]);
    },
    [cancelOrderMutation]
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return theme.textSecondary;
      case "submitted": return theme.info;
      case "in_progress": return theme.warning;
      case "resulted": return theme.success;
      case "cancelled": return theme.error;
      default: return theme.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "draft": return "Draft";
      case "submitted": return "Submitted";
      case "in_progress": return "In Progress";
      case "resulted": return "Resulted";
      case "cancelled": return "Cancelled";
      default: return status;
    }
  };

  const getPriorityIcon = (p: Priority): React.ComponentProps<typeof Feather>["name"] => {
    switch (p) {
      case "stat": return "alert-circle";
      case "urgent": return "alert-triangle";
      default: return "clock";
    }
  };

  const renderTestItem = useCallback(
    (test: LabTest) => {
      const isSelected = selectedTests.some((t) => t.code === test.code);
      return (
        <Pressable
          key={test.code}
          testID={`test-item-${test.code}`}
          accessibilityRole="checkbox"
          accessibilityLabel={`${test.name}, ${test.code}, LOINC ${test.loincCode}`}
          accessibilityState={{ checked: isSelected }}
          accessibilityHint={isSelected ? "Double tap to deselect this test" : "Double tap to select this test"}
          style={[
            styles.testItem,
            {
              backgroundColor: isSelected ? `${theme.primary}15` : theme.backgroundDefault,
              borderColor: isSelected ? theme.primary : theme.border,
            },
          ]}
          onPress={() => toggleTest(test)}
        >
          <View style={styles.testItemHeader}>
            <View style={styles.testItemInfo}>
              <View style={[styles.checkbox, { borderColor: isSelected ? theme.primary : theme.border, backgroundColor: isSelected ? theme.primary : "transparent" }]}>
                {isSelected ? <Feather name="check" size={14} color="#fff" /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.testName}>{test.name}</ThemedText>
                <ThemedText style={[styles.testMeta, { color: theme.textSecondary }]}>
                  {test.code} | LOINC: {test.loincCode}
                </ThemedText>
              </View>
            </View>
            {test.estimatedCost ? (
              <ThemedText style={[styles.testCost, { color: theme.primary }]}>
                ${test.estimatedCost[labProvider]}
              </ThemedText>
            ) : null}
          </View>
          <View style={styles.testDetails}>
            <View style={styles.testDetailRow}>
              <Feather name="droplet" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.testDetailText, { color: theme.textSecondary }]}>
                {test.specimenType}
              </ThemedText>
            </View>
            <View style={styles.testDetailRow}>
              <Feather name="clock" size={12} color={theme.textSecondary} />
              <ThemedText style={[styles.testDetailText, { color: theme.textSecondary }]}>
                {test.turnaroundDays}d TAT
              </ThemedText>
            </View>
            {test.fastingRequired ? (
              <View style={[styles.badge, { backgroundColor: `${theme.warning}20` }]}>
                <ThemedText style={[styles.badgeText, { color: theme.warning }]}>Fasting</ThemedText>
              </View>
            ) : null}
          </View>
          {test.panelComponents ? (
            <ThemedText style={[styles.panelInfo, { color: theme.textSecondary }]} numberOfLines={2}>
              Includes: {test.panelComponents.join(", ")}
            </ThemedText>
          ) : null}
        </Pressable>
      );
    },
    [selectedTests, theme, labProvider, toggleTest]
  );

  const renderSelectTestsStep = () => (
    <Animated.View entering={FadeIn.duration(300)}>
      <CodeLookup
        type="loinc"
        label="Search Lab Tests"
        value={searchQuery}
        onChangeText={setSearchQuery}
        onSelect={(item: CodeResult) => {
          setSearchQuery(item.display);
          const matchingTest = catalog.find((t: LabTest) => t.loincCode === item.code);
          if (matchingTest) {
            toggleTest(matchingTest);
          }
        }}
        placeholder="Search by test name or LOINC code"
        testID="input-lab-search"
      />

      <View style={styles.labProviderRow}>
        <ThemedText style={styles.sectionLabel}>Lab Provider</ThemedText>
        <View style={styles.providerToggle}>
          <Pressable
            testID="button-quest"
            accessibilityRole="button"
            accessibilityLabel="Quest Diagnostics"
            accessibilityState={{ selected: labProvider === "quest" }}
            style={[styles.providerButton, { backgroundColor: labProvider === "quest" ? theme.primary : theme.backgroundSecondary, borderColor: theme.border }]}
            onPress={() => { setLabProvider("quest"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <ThemedText style={[styles.providerButtonText, { color: labProvider === "quest" ? "#fff" : theme.text }]}>Quest</ThemedText>
          </Pressable>
          <Pressable
            testID="button-labcorp"
            accessibilityRole="button"
            accessibilityLabel="LabCorp"
            accessibilityState={{ selected: labProvider === "labcorp" }}
            style={[styles.providerButton, { backgroundColor: labProvider === "labcorp" ? theme.primary : theme.backgroundSecondary, borderColor: theme.border }]}
            onPress={() => { setLabProvider("labcorp"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <ThemedText style={[styles.providerButtonText, { color: labProvider === "labcorp" ? "#fff" : theme.text }]}>LabCorp</ThemedText>
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryContainer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`All categories, ${catalog.length} tests`}
          accessibilityState={{ selected: selectedCategory === null }}
          style={[styles.categoryChip, { backgroundColor: selectedCategory === null ? theme.primary : theme.backgroundSecondary, borderColor: theme.border }]}
          onPress={() => setSelectedCategory(null)}
        >
          <ThemedText style={[styles.categoryChipText, { color: selectedCategory === null ? "#fff" : theme.text }]}>All ({catalog.length})</ThemedText>
        </Pressable>
        {categories.map((cat) => (
          <Pressable
            key={cat.id}
            accessibilityRole="button"
            accessibilityLabel={`${cat.name}, ${cat.count} tests`}
            accessibilityState={{ selected: selectedCategory === cat.id }}
            style={[styles.categoryChip, { backgroundColor: selectedCategory === cat.id ? theme.primary : theme.backgroundSecondary, borderColor: theme.border }]}
            onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
          >
            <ThemedText style={[styles.categoryChipText, { color: selectedCategory === cat.id ? "#fff" : theme.text }]}>{cat.name} ({cat.count})</ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      {catalogLoading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <View style={styles.testList}>{filteredTests.map(renderTestItem)}</View>
      )}

      {selectedTests.length > 0 ? (
        <Animated.View entering={FadeInDown.duration(200)} style={[styles.selectionBar, { backgroundColor: theme.primary }]}>
          <View>
            <ThemedText style={styles.selectionBarText}>{selectedTests.length} test{selectedTests.length > 1 ? "s" : ""} selected</ThemedText>
            <ThemedText style={[styles.selectionBarSubtext, { color: "rgba(255,255,255,0.8)" }]}>Est. ${estimatedCost}</ThemedText>
          </View>
          <Pressable
            testID="button-next-configure"
            accessibilityRole="button"
            accessibilityLabel="Configure order"
            accessibilityHint="Proceed to configure the lab order"
            style={[styles.nextButton, { backgroundColor: "rgba(255,255,255,0.2)" }]}
            onPress={() => { setStep("configure"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
          >
            <ThemedText style={styles.nextButtonText}>Configure</ThemedText>
            <Feather name="arrow-right" size={18} color="#fff" />
          </Pressable>
        </Animated.View>
      ) : null}
    </Animated.View>
  );

  const renderConfigureStep = () => (
    <Animated.View entering={FadeIn.duration(300)}>
      <Card elevation={1} style={styles.configCard}>
        <ThemedText style={styles.configSectionTitle}>Patient</ThemedText>
        <TextInput
          style={[styles.configInput, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text }]}
          placeholder="Enter patient ID..."
          placeholderTextColor={theme.textSecondary}
          value={patientId}
          onChangeText={setPatientId}
          testID="input-patient-id"
          accessibilityLabel="Patient ID"
          accessibilityHint="Enter the patient identifier"
        />
      </Card>

      <Card elevation={1} style={styles.configCard}>
        <ThemedText style={styles.configSectionTitle}>Priority</ThemedText>
        <View style={styles.priorityRow}>
          {(["routine", "urgent", "stat"] as Priority[]).map((p) => (
            <Pressable
              key={p}
              testID={`button-priority-${p}`}
              accessibilityRole="button"
              accessibilityLabel={`${p.charAt(0).toUpperCase() + p.slice(1)} priority`}
              accessibilityState={{ selected: priority === p }}
              style={[
                styles.priorityButton,
                {
                  backgroundColor: priority === p ? (p === "stat" ? theme.error : p === "urgent" ? theme.warning : theme.primary) : theme.backgroundSecondary,
                  borderColor: theme.border,
                },
              ]}
              onPress={() => { setPriority(p); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
            >
              <Feather name={getPriorityIcon(p)} size={16} color={priority === p ? "#fff" : theme.text} />
              <ThemedText style={[styles.priorityButtonText, { color: priority === p ? "#fff" : theme.text }]}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card elevation={1} style={styles.configCard}>
        <View style={styles.configHeaderRow}>
          <ThemedText style={styles.configSectionTitle}>Diagnoses (ICD-10)</ThemedText>
          <Pressable
            testID="button-add-diagnosis"
            accessibilityRole="button"
            accessibilityLabel="Add diagnosis"
            accessibilityHint="Open diagnosis selection"
            style={[styles.addButton, { backgroundColor: `${theme.primary}15` }]}
            onPress={() => setShowDiagnosisModal(true)}
          >
            <Feather name="plus" size={16} color={theme.primary} />
            <ThemedText style={[styles.addButtonText, { color: theme.primary }]}>Add</ThemedText>
          </Pressable>
        </View>
        {selectedDiagnoses.length > 0 ? (
          selectedDiagnoses.map((d) => (
            <View key={d.code} style={[styles.diagnosisItem, { borderColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.diagnosisCode}>{d.code}</ThemedText>
                <ThemedText style={[styles.diagnosisDesc, { color: theme.textSecondary }]}>{d.description}</ThemedText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove diagnosis ${d.code}`}
                onPress={() => setSelectedDiagnoses((prev) => prev.filter((x) => x.code !== d.code))}
              >
                <Feather name="x-circle" size={20} color={theme.error} />
              </Pressable>
            </View>
          ))
        ) : (
          <ThemedText style={[styles.emptyDiagnoses, { color: theme.textSecondary }]}>
            No diagnoses added. Tap "Add" to select from common diagnoses for your selected tests.
          </ThemedText>
        )}
      </Card>

      {fastingRequired ? (
        <Card elevation={1} style={StyleSheet.flatten([styles.configCard, { borderLeftWidth: 3, borderLeftColor: theme.warning }])}>
          <View style={styles.alertRow}>
            <Feather name="alert-triangle" size={20} color={theme.warning} />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <ThemedText style={styles.alertTitle}>Fasting Required</ThemedText>
              <ThemedText style={[styles.alertDesc, { color: theme.textSecondary }]}>
                Patient should fast 8-12 hours before specimen collection for accurate results.
              </ThemedText>
            </View>
          </View>
        </Card>
      ) : null}

      <Card elevation={1} style={styles.configCard}>
        <ThemedText style={styles.configSectionTitle}>Special Instructions</ThemedText>
        <TextInput
          style={[styles.configTextArea, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, color: theme.text }]}
          placeholder="Add notes for the lab..."
          placeholderTextColor={theme.textSecondary}
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          multiline
          numberOfLines={3}
          testID="input-special-instructions"
          accessibilityLabel="Special instructions"
          accessibilityHint="Add notes for the lab"
        />
      </Card>

      <View style={styles.stepButtons}>
        <Pressable
          testID="button-back-tests"
          accessibilityRole="button"
          accessibilityLabel="Back to test selection"
          style={[styles.stepBackButton, { borderColor: theme.border }]}
          onPress={() => setStep("select_tests")}
        >
          <Feather name="arrow-left" size={18} color={theme.text} />
          <ThemedText style={styles.stepBackText}>Tests</ThemedText>
        </Pressable>
        <Pressable
          testID="button-next-review"
          accessibilityRole="button"
          accessibilityLabel="Review order"
          accessibilityHint="Proceed to review and submit the order"
          style={[styles.stepNextButton, { backgroundColor: theme.primary }]}
          onPress={() => setStep("review")}
        >
          <ThemedText style={styles.stepNextText}>Review Order</ThemedText>
          <Feather name="arrow-right" size={18} color="#fff" />
        </Pressable>
      </View>
    </Animated.View>
  );

  const renderReviewStep = () => (
    <Animated.View entering={FadeIn.duration(300)}>
      <Card elevation={1} style={styles.reviewCard}>
        <ThemedText style={styles.reviewHeader}>Order Summary</ThemedText>

        <View style={[styles.reviewRow, { borderColor: theme.border }]}>
          <ThemedText style={[styles.reviewLabel, { color: theme.textSecondary }]}>Lab</ThemedText>
          <ThemedText style={styles.reviewValue}>{labProvider === "quest" ? "Quest Diagnostics" : "LabCorp"}</ThemedText>
        </View>

        <View style={[styles.reviewRow, { borderColor: theme.border }]}>
          <ThemedText style={[styles.reviewLabel, { color: theme.textSecondary }]}>Patient</ThemedText>
          <ThemedText style={styles.reviewValue}>{patientId || "Not set"}</ThemedText>
        </View>

        <View style={[styles.reviewRow, { borderColor: theme.border }]}>
          <ThemedText style={[styles.reviewLabel, { color: theme.textSecondary }]}>Priority</ThemedText>
          <View style={[styles.priorityBadge, { backgroundColor: priority === "stat" ? `${theme.error}20` : priority === "urgent" ? `${theme.warning}20` : `${theme.primary}20` }]}>
            <ThemedText style={[styles.priorityBadgeText, { color: priority === "stat" ? theme.error : priority === "urgent" ? theme.warning : theme.primary }]}>
              {priority.toUpperCase()}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.reviewRow, { borderColor: theme.border }]}>
          <ThemedText style={[styles.reviewLabel, { color: theme.textSecondary }]}>Est. Cost</ThemedText>
          <ThemedText style={[styles.reviewValue, { color: theme.primary, fontWeight: "600" }]}>${estimatedCost}</ThemedText>
        </View>

        {fastingRequired ? (
          <View style={[styles.reviewRow, { borderColor: theme.border }]}>
            <ThemedText style={[styles.reviewLabel, { color: theme.textSecondary }]}>Fasting</ThemedText>
            <View style={[styles.badge, { backgroundColor: `${theme.warning}20` }]}>
              <ThemedText style={[styles.badgeText, { color: theme.warning }]}>Required</ThemedText>
            </View>
          </View>
        ) : null}
      </Card>

      <Card elevation={1} style={styles.reviewCard}>
        <ThemedText style={styles.reviewSectionTitle}>Tests ({selectedTests.length})</ThemedText>
        {selectedTests.map((t, i) => {
          const entry = catalog.find((c) => c.code === t.code);
          return (
            <View key={t.code} style={[styles.reviewTestItem, i < selectedTests.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : {}]}>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.reviewTestName}>{t.name}</ThemedText>
                <ThemedText style={[styles.reviewTestMeta, { color: theme.textSecondary }]}>
                  {t.code} | LOINC: {t.loincCode} | {entry?.turnaroundDays}d TAT
                </ThemedText>
              </View>
              {entry?.estimatedCost ? (
                <ThemedText style={[styles.reviewTestCost, { color: theme.primary }]}>${entry.estimatedCost[labProvider]}</ThemedText>
              ) : null}
            </View>
          );
        })}
      </Card>

      {selectedDiagnoses.length > 0 ? (
        <Card elevation={1} style={styles.reviewCard}>
          <ThemedText style={styles.reviewSectionTitle}>Diagnoses</ThemedText>
          {selectedDiagnoses.map((d) => (
            <ThemedText key={d.code} style={styles.reviewDiagnosis}>{d.code} - {d.description}</ThemedText>
          ))}
        </Card>
      ) : null}

      {specialInstructions.trim() ? (
        <Card elevation={1} style={styles.reviewCard}>
          <ThemedText style={styles.reviewSectionTitle}>Special Instructions</ThemedText>
          <ThemedText style={[styles.reviewInstructions, { color: theme.textSecondary }]}>{specialInstructions}</ThemedText>
        </Card>
      ) : null}

      <View style={styles.stepButtons}>
        <Pressable
          testID="button-back-configure"
          accessibilityRole="button"
          accessibilityLabel="Back to configuration"
          style={[styles.stepBackButton, { borderColor: theme.border }]}
          onPress={() => setStep("configure")}
        >
          <Feather name="arrow-left" size={18} color={theme.text} />
          <ThemedText style={styles.stepBackText}>Back</ThemedText>
        </Pressable>
        <Pressable
          testID="button-submit-order"
          accessibilityRole="button"
          accessibilityLabel="Submit order"
          accessibilityHint="Submit the lab order for processing"
          accessibilityState={{ disabled: createOrderMutation.isPending || submitOrderMutation.isPending }}
          style={[styles.submitOrderButton, { backgroundColor: theme.success }]}
          onPress={handleCreateAndSubmit}
          disabled={createOrderMutation.isPending || submitOrderMutation.isPending}
        >
          {(createOrderMutation.isPending || submitOrderMutation.isPending) ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="send" size={18} color="#fff" />
              <ThemedText style={styles.submitOrderText}>Submit Order</ThemedText>
            </>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );

  const renderOrderHistory = () => (
    <Animated.View entering={FadeIn.duration(300)}>
      <ThemedText style={styles.historyTitle}>Recent Orders</ThemedText>
      {ordersLoading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: Spacing.lg }} />
      ) : orders.length > 0 ? (
        orders.slice(0, 10).map((order) => {
          const tests = (order.tests || []) as Array<{ name: string; code: string }>;
          return (
            <Pressable
              key={order.id}
              testID={`order-item-${order.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Order ${order.orderNumber}, status ${getStatusLabel(order.status)}`}
              accessibilityHint="View order details"
              onPress={() => setShowOrderDetail(order)}
            >
              <Card elevation={1} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View>
                    <ThemedText style={styles.orderNumber}>{order.orderNumber}</ThemedText>
                    <ThemedText style={[styles.orderDate, { color: theme.textSecondary }]}>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </ThemedText>
                  </View>
                  <View style={styles.orderStatusRow}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]} />
                    <ThemedText style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                      {getStatusLabel(order.status)}
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={[styles.orderTests, { color: theme.textSecondary }]} numberOfLines={2}>
                  {tests.map((t) => t.name).join(", ")}
                </ThemedText>
                <View style={styles.orderFooter}>
                  <ThemedText style={[styles.orderLab, { color: theme.textSecondary }]}>
                    {order.labProvider === "quest" ? "Quest" : "LabCorp"} | {order.priority.toUpperCase()}
                  </ThemedText>
                  {["draft", "submitted"].includes(order.status) ? (
                    <Pressable
                      testID={`button-cancel-${order.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Cancel order ${order.orderNumber}`}
                      style={[styles.cancelButton, { borderColor: theme.error }]}
                      onPress={() => handleCancelOrder(order.id)}
                    >
                      <ThemedText style={[styles.cancelButtonText, { color: theme.error }]}>Cancel</ThemedText>
                    </Pressable>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          );
        })
      ) : (
        <Card elevation={1} style={styles.emptyCard}>
          <Feather name="clipboard" size={40} color={theme.textSecondary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No orders yet</ThemedText>
        </Card>
      )}
    </Animated.View>
  );

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {(["select_tests", "configure", "review"] as OrderStep[]).map((s, i) => (
        <React.Fragment key={s}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Step ${i + 1}: ${s === "select_tests" ? "Tests" : s === "configure" ? "Configure" : "Review"}`}
            accessibilityState={{ selected: step === s }}
            onPress={() => {
              if (s === "select_tests") setStep(s);
              else if (s === "configure" && selectedTests.length > 0) setStep(s);
              else if (s === "review" && selectedTests.length > 0 && patientId) setStep(s);
            }}
            style={styles.stepDotContainer}
          >
            <View style={[styles.stepDot, { backgroundColor: step === s ? theme.primary : s === "select_tests" || (s === "configure" && step !== "select_tests") || step === "review" ? theme.primary : theme.border }]}>
              <ThemedText style={styles.stepDotText}>{i + 1}</ThemedText>
            </View>
            <ThemedText style={[styles.stepDotLabel, { color: step === s ? theme.primary : theme.textSecondary }]}>
              {s === "select_tests" ? "Tests" : s === "configure" ? "Configure" : "Review"}
            </ThemedText>
          </Pressable>
          {i < 2 ? <View style={[styles.stepLine, { backgroundColor: theme.border }]} /> : null}
        </React.Fragment>
      ))}
    </View>
  );

  const [activeTab, setActiveTab] = useState<"new" | "history">("new");

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tabRow}>
          <Pressable
            testID="tab-new-order"
            accessibilityRole="tab"
            accessibilityLabel="New Order"
            accessibilityState={{ selected: activeTab === "new" }}
            style={[styles.tab, { borderBottomColor: activeTab === "new" ? theme.primary : "transparent" }]}
            onPress={() => setActiveTab("new")}
          >
            <Feather name="plus-circle" size={18} color={activeTab === "new" ? theme.primary : theme.textSecondary} />
            <ThemedText style={[styles.tabText, { color: activeTab === "new" ? theme.primary : theme.textSecondary }]}>New Order</ThemedText>
          </Pressable>
          <Pressable
            testID="tab-history"
            accessibilityRole="tab"
            accessibilityLabel="Order History"
            accessibilityState={{ selected: activeTab === "history" }}
            style={[styles.tab, { borderBottomColor: activeTab === "history" ? theme.primary : "transparent" }]}
            onPress={() => { setActiveTab("history"); refetchOrders(); }}
          >
            <Feather name="list" size={18} color={activeTab === "history" ? theme.primary : theme.textSecondary} />
            <ThemedText style={[styles.tabText, { color: activeTab === "history" ? theme.primary : theme.textSecondary }]}>Order History</ThemedText>
          </Pressable>
        </View>

        <View style={styles.content}>
          {activeTab === "new" ? (
            <>
              {renderStepIndicator()}
              {step === "select_tests" ? renderSelectTestsStep() : null}
              {step === "configure" ? renderConfigureStep() : null}
              {step === "review" ? renderReviewStep() : null}
            </>
          ) : (
            renderOrderHistory()
          )}
        </View>
      </ScrollView>

      <Modal visible={showDiagnosisModal} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <ThemedText style={styles.modalTitle}>Common Diagnoses</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close diagnoses modal"
                onPress={() => setShowDiagnosisModal(false)}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <FlatList
              data={availableDiagnoses}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => {
                const isSelected = selectedDiagnoses.some((d) => d.code === item.code);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={`${item.code}, ${item.description}`}
                    accessibilityState={{ checked: isSelected }}
                    style={[styles.diagnosisOption, { borderBottomColor: theme.border, backgroundColor: isSelected ? `${theme.primary}10` : "transparent" }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedDiagnoses((prev) =>
                        isSelected ? prev.filter((d) => d.code !== item.code) : [...prev, item]
                      );
                    }}
                  >
                    <View style={[styles.checkbox, { borderColor: isSelected ? theme.primary : theme.border, backgroundColor: isSelected ? theme.primary : "transparent" }]}>
                      {isSelected ? <Feather name="check" size={14} color="#fff" /> : null}
                    </View>
                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      <ThemedText style={styles.diagnosisOptionCode}>{item.code}</ThemedText>
                      <ThemedText style={[styles.diagnosisOptionDesc, { color: theme.textSecondary }]}>{item.description}</ThemedText>
                    </View>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyDiagList}>
                  <ThemedText style={{ color: theme.textSecondary }}>Select tests first to see relevant diagnoses</ThemedText>
                </View>
              }
            />
            <Pressable
              testID="button-done-diagnoses"
              accessibilityRole="button"
              accessibilityLabel={`Done, ${selectedDiagnoses.length} diagnoses selected`}
              style={[styles.doneButton, { backgroundColor: theme.primary }]}
              onPress={() => setShowDiagnosisModal(false)}
            >
              <ThemedText style={styles.doneButtonText}>Done ({selectedDiagnoses.length} selected)</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={showOrderDetail !== null} animationType="slide" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <ThemedText style={styles.modalTitle}>Order Details</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close order details"
                onPress={() => setShowOrderDetail(null)}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            {showOrderDetail ? (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md }}>
                <View style={[styles.reviewRow, { borderColor: theme.border }]}>
                  <ThemedText style={[styles.reviewLabel, { color: theme.textSecondary }]}>Order #</ThemedText>
                  <ThemedText style={styles.reviewValue}>{showOrderDetail.orderNumber}</ThemedText>
                </View>
                <View style={[styles.reviewRow, { borderColor: theme.border }]}>
                  <ThemedText style={[styles.reviewLabel, { color: theme.textSecondary }]}>Status</ThemedText>
                  <View style={styles.orderStatusRow}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(showOrderDetail.status) }]} />
                    <ThemedText style={{ color: getStatusColor(showOrderDetail.status) }}>{getStatusLabel(showOrderDetail.status)}</ThemedText>
                  </View>
                </View>
                <View style={[styles.reviewRow, { borderColor: theme.border }]}>
                  <ThemedText style={[styles.reviewLabel, { color: theme.textSecondary }]}>Lab</ThemedText>
                  <ThemedText style={styles.reviewValue}>{showOrderDetail.labProvider === "quest" ? "Quest Diagnostics" : "LabCorp"}</ThemedText>
                </View>
                <View style={[styles.reviewRow, { borderColor: theme.border }]}>
                  <ThemedText style={[styles.reviewLabel, { color: theme.textSecondary }]}>Priority</ThemedText>
                  <ThemedText style={styles.reviewValue}>{showOrderDetail.priority?.toUpperCase()}</ThemedText>
                </View>
                {showOrderDetail.accessionNumber ? (
                  <View style={[styles.reviewRow, { borderColor: theme.border }]}>
                    <ThemedText style={[styles.reviewLabel, { color: theme.textSecondary }]}>Accession</ThemedText>
                    <ThemedText style={styles.reviewValue}>{showOrderDetail.accessionNumber}</ThemedText>
                  </View>
                ) : null}
                <ThemedText style={[styles.reviewSectionTitle, { marginTop: Spacing.md }]}>Tests</ThemedText>
                {((showOrderDetail.tests || []) as Array<{ name: string; code: string }>).map((t) => (
                  <ThemedText key={t.code} style={[styles.reviewDiagnosis, { marginBottom: Spacing.xs }]}>{t.code} - {t.name}</ThemedText>
                ))}
                {showOrderDetail.results ? (
                  <>
                    <ThemedText style={[styles.reviewSectionTitle, { marginTop: Spacing.md }]}>Results</ThemedText>
                    {((showOrderDetail.results as any)?.components || []).map((c: any, i: number) => (
                      <View key={i} style={[styles.resultRow, { borderColor: theme.border }]}>
                        <ThemedText style={styles.resultName}>{c.name}</ThemedText>
                        <View style={{ alignItems: "flex-end" }}>
                          <ThemedText style={[styles.resultValue, { color: c.interpretation === "normal" ? theme.success : c.interpretation === "critical_low" || c.interpretation === "critical_high" ? theme.error : theme.warning }]}>
                            {c.value} {c.units || ""}
                          </ThemedText>
                          {c.referenceRange ? (
                            <ThemedText style={[styles.resultRange, { color: theme.textSecondary }]}>{c.referenceRange.text}</ThemedText>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </>
                ) : null}
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.md },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 2,
  },
  tabText: { fontSize: 15, fontWeight: "600" },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  stepDotContainer: { alignItems: "center" },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  stepDotLabel: { fontSize: 11, marginTop: 4 },
  stepLine: { height: 2, width: 40, marginHorizontal: Spacing.xs },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 4 },
  labProviderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  sectionLabel: { fontSize: 14, fontWeight: "600" },
  providerToggle: { flexDirection: "row", gap: Spacing.xs },
  providerButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  providerButtonText: { fontSize: 13, fontWeight: "600" },
  categoryScroll: { marginBottom: Spacing.sm },
  categoryContainer: { gap: Spacing.xs, paddingVertical: Spacing.xs },
  categoryChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  categoryChipText: { fontSize: 12, fontWeight: "500" },
  testList: { gap: Spacing.sm },
  testItem: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.sm,
  },
  testItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  testItemInfo: { flexDirection: "row", alignItems: "flex-start", flex: 1, gap: Spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  testName: { fontSize: 14, fontWeight: "600" },
  testMeta: { fontSize: 11, marginTop: 2 },
  testCost: { fontSize: 14, fontWeight: "700" },
  testDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.xs,
    marginLeft: 30,
  },
  testDetailRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  testDetailText: { fontSize: 11 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  badgeText: { fontSize: 11, fontWeight: "600" },
  panelInfo: { fontSize: 11, marginTop: 4, marginLeft: 30 },
  selectionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  selectionBarText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  selectionBarSubtext: { fontSize: 12, marginTop: 2 },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  nextButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  configCard: { marginBottom: Spacing.md },
  configSectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: Spacing.sm },
  configHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  configInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: 15,
  },
  configTextArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  priorityRow: { flexDirection: "row", gap: Spacing.sm },
  priorityButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  priorityButtonText: { fontSize: 13, fontWeight: "600" },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  addButtonText: { fontSize: 13, fontWeight: "600" },
  diagnosisItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  diagnosisCode: { fontSize: 13, fontWeight: "700" },
  diagnosisDesc: { fontSize: 12 },
  emptyDiagnoses: { fontSize: 13, fontStyle: "italic" },
  alertRow: { flexDirection: "row", alignItems: "flex-start" },
  alertTitle: { fontSize: 14, fontWeight: "700" },
  alertDesc: { fontSize: 12, marginTop: 2 },
  stepButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  stepBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  stepBackText: { fontSize: 14, fontWeight: "500" },
  stepNextButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  stepNextText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  submitOrderButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  submitOrderText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  reviewCard: { marginBottom: Spacing.md },
  reviewHeader: { fontSize: 18, fontWeight: "700", marginBottom: Spacing.sm },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  reviewLabel: { fontSize: 13 },
  reviewValue: { fontSize: 14, fontWeight: "500" },
  priorityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  priorityBadgeText: { fontSize: 12, fontWeight: "700" },
  reviewSectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: Spacing.sm },
  reviewTestItem: { paddingVertical: Spacing.sm, flexDirection: "row", alignItems: "center" },
  reviewTestName: { fontSize: 14, fontWeight: "500" },
  reviewTestMeta: { fontSize: 11, marginTop: 2 },
  reviewTestCost: { fontSize: 14, fontWeight: "600" },
  reviewDiagnosis: { fontSize: 13, marginBottom: Spacing.xs },
  reviewInstructions: { fontSize: 13 },
  historyTitle: { fontSize: 18, fontWeight: "700", marginBottom: Spacing.md },
  orderCard: { marginBottom: Spacing.sm },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  orderNumber: { fontSize: 14, fontWeight: "700" },
  orderDate: { fontSize: 12, marginTop: 2 },
  orderStatusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "600" },
  orderTests: { fontSize: 13, marginBottom: Spacing.xs },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  orderLab: { fontSize: 12 },
  cancelButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  cancelButtonText: { fontSize: 12, fontWeight: "600" },
  emptyCard: {
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  emptyText: { fontSize: 15 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: {
    height: "70%",
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  diagnosisOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  diagnosisOptionCode: { fontSize: 14, fontWeight: "700" },
  diagnosisOptionDesc: { fontSize: 12 },
  emptyDiagList: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  doneButton: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  doneButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
  },
  resultName: { fontSize: 13, fontWeight: "500" },
  resultValue: { fontSize: 14, fontWeight: "700" },
  resultRange: { fontSize: 11, marginTop: 2 },
});
