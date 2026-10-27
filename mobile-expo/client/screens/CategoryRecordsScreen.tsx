import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { api, HealthRecord } from "@/lib/api";

type RecordType = "visit" | "lab" | "medication" | "imaging" | "procedure" | "immunization" | "allergy" | "vital";

type CategoryRecordsParams = {
  CategoryRecords: {
    category: string;
    type: RecordType;
    records?: HealthRecord[];
  };
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const RECORD_TYPE_CONFIG: Record<
  RecordType,
  { icon: keyof typeof Feather.glyphMap; colorKey: keyof typeof Colors.light }
> = {
  visit: { icon: "user", colorKey: "recordVisit" },
  lab: { icon: "activity", colorKey: "recordLab" },
  medication: { icon: "package", colorKey: "recordMedication" },
  imaging: { icon: "image", colorKey: "recordImaging" },
  procedure: { icon: "tool", colorKey: "recordVisit" },
  immunization: { icon: "shield", colorKey: "recordLab" },
  allergy: { icon: "alert-triangle", colorKey: "warning" },
  vital: { icon: "heart", colorKey: "recordMedication" },
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function RecordCard({
  record,
  index,
  onPress,
  theme,
}: {
  record: HealthRecord;
  index: number;
  onPress: () => void;
  theme: typeof Colors.light;
}) {
  const scale = useSharedValue(1);
  const config = RECORD_TYPE_CONFIG[record.type as RecordType] || RECORD_TYPE_CONFIG.visit;
  const recordColor = theme[config.colorKey] as string;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 150 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle]}
      testID={`card-record-${record.id}`}
    >
      <Animated.View
        entering={FadeInDown.delay(index * 50).springify()}
        style={[
          styles.card,
          {
            backgroundColor: theme.backgroundDefault,
            borderLeftColor: recordColor,
          },
        ]}
      >
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <ThemedText type="h4" numberOfLines={1} style={styles.cardTitle}>
              {record.title}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              {formatDate(record.date)}
            </ThemedText>
          </View>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary }}
            numberOfLines={1}
          >
            {record.provider}
          </ThemedText>
          <ThemedText
            type="small"
            numberOfLines={2}
            style={[styles.cardSummary, { color: theme.text }]}
          >
            {record.summary}
          </ThemedText>
        </View>
        <Feather
          name="chevron-right"
          size={20}
          color={theme.textSecondary}
        />
      </Animated.View>
    </AnimatedPressable>
  );
}

export default function CategoryRecordsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<CategoryRecordsParams, "CategoryRecords">>();
  const { category, type: recordType } = route.params;

  const [records, setRecords] = useState<HealthRecord[]>(route.params.records || []);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);

  const [tempDateFrom, setTempDateFrom] = useState("");
  const [tempDateTo, setTempDateTo] = useState("");

  const hasActiveFilters = selectedProvider !== null || dateFrom !== null || dateTo !== null;
  const activeFilterCount = (selectedProvider ? 1 : 0) + (dateFrom || dateTo ? 1 : 0);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.records.list({
        type: recordType,
        provider: selectedProvider || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: "date",
        sortOrder,
      });
      setRecords(data);
    } catch (error) {
      console.error("Error loading records:", error);
    } finally {
      setIsLoading(false);
    }
  }, [recordType, selectedProvider, dateFrom, dateTo, sortOrder]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    api.records.getProviders().then(setProviders).catch(() => {});
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await api.records.list({
        type: recordType,
        provider: selectedProvider || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy: "date",
        sortOrder,
      });
      setRecords(data);
    } catch (error) {
      console.error("Error refreshing records:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [recordType, selectedProvider, dateFrom, dateTo, sortOrder]);

  const handleRecordPress = (record: HealthRecord) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate("RecordDetail", { record });
  };

  const handleSortToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  const handleProviderSelect = (provider: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedProvider(provider);
    setShowProviderModal(false);
  };

  const handleDateApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDateFrom(tempDateFrom || null);
    setDateTo(tempDateTo || null);
    setShowDateModal(false);
  };

  const handleDateClear = () => {
    setTempDateFrom("");
    setTempDateTo("");
    setDateFrom(null);
    setDateTo(null);
    setShowDateModal(false);
  };

  const handleClearAllFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedProvider(null);
    setDateFrom(null);
    setDateTo(null);
    setSortOrder("desc");
  };

  const openDateModal = () => {
    setTempDateFrom(dateFrom || "");
    setTempDateTo(dateTo || "");
    setShowDateModal(true);
  };

  const getProviderLabel = () => {
    if (selectedProvider) {
      return selectedProvider.length > 15
        ? selectedProvider.substring(0, 15) + "..."
        : selectedProvider;
    }
    return "Provider";
  };

  const getDateRangeLabel = () => {
    if (dateFrom || dateTo) {
      const from = dateFrom || "...";
      const to = dateTo || "...";
      return `${from} - ${to}`;
    }
    return "Date Range";
  };

  const renderFilterToolbar = () => (
    <View style={styles.filterContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScrollContent}
      >
        <Pressable
          testID="button-sort-toggle"
          onPress={handleSortToggle}
          style={[
            styles.filterPill,
            { borderColor: theme.border },
          ]}
        >
          <Feather
            name={sortOrder === "desc" ? "arrow-down" : "arrow-up"}
            size={14}
            color={theme.text}
          />
          <ThemedText type="caption" style={{ marginLeft: 4 }}>
            {sortOrder === "desc" ? "Newest" : "Oldest"}
          </ThemedText>
        </Pressable>

        <Pressable
          testID="button-provider-filter"
          onPress={() => setShowProviderModal(true)}
          style={[
            styles.filterPill,
            selectedProvider
              ? { backgroundColor: theme.primary, borderColor: theme.primary }
              : { borderColor: theme.border },
          ]}
        >
          <Feather
            name="user"
            size={14}
            color={selectedProvider ? "#FFFFFF" : theme.text}
          />
          <ThemedText
            type="caption"
            style={{
              marginLeft: 4,
              color: selectedProvider ? "#FFFFFF" : theme.text,
            }}
          >
            {getProviderLabel()}
          </ThemedText>
        </Pressable>

        <Pressable
          testID="button-date-filter"
          onPress={openDateModal}
          style={[
            styles.filterPill,
            dateFrom || dateTo
              ? { backgroundColor: theme.primary, borderColor: theme.primary }
              : { borderColor: theme.border },
          ]}
        >
          <Feather
            name="calendar"
            size={14}
            color={dateFrom || dateTo ? "#FFFFFF" : theme.text}
          />
          <ThemedText
            type="caption"
            style={{
              marginLeft: 4,
              color: dateFrom || dateTo ? "#FFFFFF" : theme.text,
            }}
          >
            {getDateRangeLabel()}
          </ThemedText>
        </Pressable>

        {hasActiveFilters ? (
          <Pressable
            testID="button-clear-filters"
            onPress={handleClearAllFilters}
            style={[styles.filterPill, { borderColor: theme.error }]}
          >
            <Feather name="x" size={14} color={theme.error} />
            <ThemedText
              type="caption"
              style={{ marginLeft: 4, color: theme.error }}
            >
              Clear
            </ThemedText>
          </Pressable>
        ) : null}
      </ScrollView>

      {activeFilterCount > 0 ? (
        <View style={[styles.filterBadge, { backgroundColor: theme.primary }]}>
          <ThemedText type="caption" style={{ color: "#FFFFFF", fontSize: 10 }}>
            {activeFilterCount}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Image
        source={require("../../assets/images/empty-timeline.png")}
        style={styles.emptyImage}
        resizeMode="contain"
      />
      <ThemedText type="h3" style={styles.emptyTitle}>
        No {category}
      </ThemedText>
      <ThemedText
        type="body"
        style={[styles.emptyText, { color: theme.textSecondary }]}
      >
        No records found in this category
      </ThemedText>
    </View>
  );

  const renderListHeader = () => (
    <View>
      {renderFilterToolbar()}
      {isLoading && records.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={isLoading && records.length === 0 ? [] : records}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <RecordCard
            record={item}
            index={index}
            onPress={() => handleRecordPress(item)}
            theme={theme}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
          records.length === 0 && !isLoading && styles.emptyListContent,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={isLoading ? null : renderEmpty}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            progressViewOffset={headerHeight}
          />
        }
      />

      <Modal
        visible={showProviderModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowProviderModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.backgroundDefault,
                paddingBottom: insets.bottom + Spacing.lg,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Select Provider</ThemedText>
              <Pressable
                testID="button-close-provider-modal"
                onPress={() => setShowProviderModal(false)}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <FlatList
              data={providers}
              keyExtractor={(item) => item}
              ListHeaderComponent={
                <Pressable
                  testID="button-provider-all"
                  onPress={() => handleProviderSelect(null)}
                  style={[
                    styles.providerRow,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <ThemedText
                    type="body"
                    style={
                      selectedProvider === null
                        ? { color: theme.primary, fontWeight: "600" }
                        : undefined
                    }
                  >
                    All Providers
                  </ThemedText>
                  {selectedProvider === null ? (
                    <Feather name="check" size={18} color={theme.primary} />
                  ) : null}
                </Pressable>
              }
              renderItem={({ item }) => (
                <Pressable
                  testID={`button-provider-${item}`}
                  onPress={() => handleProviderSelect(item)}
                  style={[
                    styles.providerRow,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <ThemedText
                    type="body"
                    style={
                      selectedProvider === item
                        ? { color: theme.primary, fontWeight: "600" }
                        : undefined
                    }
                    numberOfLines={1}
                  >
                    {item}
                  </ThemedText>
                  {selectedProvider === item ? (
                    <Feather name="check" size={18} color={theme.primary} />
                  ) : null}
                </Pressable>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDateModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.backgroundDefault,
                paddingBottom: insets.bottom + Spacing.lg,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <ThemedText type="h3">Date Range</ThemedText>
              <Pressable
                testID="button-close-date-modal"
                onPress={() => setShowDateModal(false)}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.dateInputGroup}>
              <ThemedText type="small" style={{ marginBottom: Spacing.xs }}>
                From (YYYY-MM-DD)
              </ThemedText>
              <TextInput
                testID="input-date-from"
                style={[
                  styles.dateInput,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={tempDateFrom}
                onChangeText={setTempDateFrom}
                placeholder="2024-01-01"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <View style={styles.dateInputGroup}>
              <ThemedText type="small" style={{ marginBottom: Spacing.xs }}>
                To (YYYY-MM-DD)
              </ThemedText>
              <TextInput
                testID="input-date-to"
                style={[
                  styles.dateInput,
                  {
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={tempDateTo}
                onChangeText={setTempDateTo}
                placeholder="2024-12-31"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
              />
            </View>

            <View style={styles.dateButtonRow}>
              <Pressable
                testID="button-date-clear"
                onPress={handleDateClear}
                style={[
                  styles.dateButton,
                  { borderColor: theme.border, borderWidth: 1 },
                ]}
              >
                <ThemedText type="body">Clear</ThemedText>
              </Pressable>
              <Pressable
                testID="button-date-apply"
                onPress={handleDateApply}
                style={[
                  styles.dateButton,
                  { backgroundColor: theme.primary },
                ]}
              >
                <ThemedText type="body" style={{ color: "#FFFFFF" }}>
                  Apply
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: "center",
  },
  filterContainer: {
    marginBottom: Spacing.md,
    position: "relative",
  },
  filterScrollContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.lg,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: Spacing.lg,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    gap: Spacing.md,
  },
  cardContent: {
    flex: 1,
    gap: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  cardSummary: {
    marginTop: 4,
  },
  loadingContainer: {
    paddingVertical: Spacing["3xl"],
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  emptyImage: {
    width: 160,
    height: 160,
    marginBottom: Spacing.xl,
    opacity: 0.9,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptyText: {
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  providerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  dateInputGroup: {
    marginBottom: Spacing.lg,
  },
  dateInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  dateButtonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  dateButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
});
