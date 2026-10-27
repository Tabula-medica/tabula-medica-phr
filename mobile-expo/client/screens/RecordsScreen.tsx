import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { api, HealthRecord } from "@/lib/api";

type RecordType = "visit" | "lab" | "medication" | "imaging" | "procedure" | "immunization" | "allergy" | "vital" | "dental";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CategoryConfig {
  type: RecordType;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  colorKey: keyof typeof Colors.light;
}

const CATEGORIES: CategoryConfig[] = [
  { type: "lab", title: "Lab Results", icon: "activity", colorKey: "recordLab" },
  { type: "medication", title: "Medications", icon: "package", colorKey: "recordMedication" },
  { type: "visit", title: "Visits", icon: "user", colorKey: "recordVisit" },
  { type: "imaging", title: "Imaging", icon: "image", colorKey: "recordImaging" },
  { type: "immunization", title: "Immunizations", icon: "shield", colorKey: "recordLab" },
  { type: "allergy", title: "Allergies", icon: "alert-triangle", colorKey: "warning" },
  { type: "vital", title: "Vitals", icon: "heart", colorKey: "recordMedication" },
  { type: "procedure", title: "Procedures", icon: "tool", colorKey: "recordVisit" },
  { type: "dental", title: "Dental", icon: "smile", colorKey: "recordDental" },
];

function CategoryCard({
  category,
  count,
  index,
  onPress,
  theme,
}: {
  category: CategoryConfig;
  count: number;
  index: number;
  onPress: () => void;
  theme: typeof Colors.light;
}) {
  const scale = useSharedValue(1);
  const categoryColor = theme[category.colorKey] as string;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.categoryCard, animatedStyle]}
      accessibilityRole="button"
      accessibilityLabel={`${category.title}, ${count} records`}
      accessibilityHint={`View ${category.title} records`}
    >
      <Animated.View
        entering={FadeInUp.delay(index * 80).springify()}
        style={[
          styles.categoryCardInner,
          { backgroundColor: theme.backgroundDefault },
        ]}
      >
        <View
          style={[
            styles.categoryIcon,
            { backgroundColor: `${categoryColor}15` },
          ]}
        >
          <Feather name={category.icon} size={24} color={categoryColor} />
        </View>
        <ThemedText type="h4" style={styles.categoryTitle}>
          {category.title}
        </ThemedText>
        {count > 0 ? (
          <View
            style={[styles.countBadge, { backgroundColor: categoryColor }]}
          >
            <ThemedText type="caption" style={styles.countText}>
              {count}
            </ThemedText>
          </View>
        ) : null}
      </Animated.View>
    </AnimatedPressable>
  );
}

export default function RecordsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();

  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadRecords = useCallback(async () => {
    try {
      setLoadError(false);
      const data = await api.records.list();
      setRecords(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [loadRecords])
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await loadRecords();
    setIsRefreshing(false);
  }, [loadRecords]);

  const getCountForCategory = (type: RecordType): number => {
    const safeRecords = Array.isArray(records) ? records : [];
    return safeRecords.filter((r) => r.type === type).length;
  };

  const handleCategoryPress = useCallback(
    (category: CategoryConfig) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const safeRecords = Array.isArray(records) ? records : [];
      const categoryRecords = safeRecords.filter((r) => r.type === category.type);
      navigation.navigate("CategoryRecords", {
        category: category.title,
        type: category.type,
        records: categoryRecords,
      });
    },
    [navigation, records]
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconBg, { backgroundColor: theme.primary + "12" }]}>
        <Feather name="download-cloud" size={36} color={theme.primary} />
      </View>
      <ThemedText type="h3" style={styles.emptyTitle}>
        Import My Records
      </ThemedText>
      <ThemedText
        type="body"
        style={[styles.emptyText, { color: theme.textSecondary }]}
      >
        We find your records automatically from the national TEFCA network. No portal passwords needed.
      </ThemedText>
      <Pressable
        testID="button-empty-connect"
        style={[styles.emptyConnectBtn, { backgroundColor: theme.primary }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          navigation.navigate("AddSource");
        }}
        accessibilityRole="button"
        accessibilityLabel="Import your medical records from the national network"
      >
        <Feather name="download-cloud" size={16} color="#FFFFFF" />
        <ThemedText style={styles.emptyConnectBtnText}>Import My Records</ThemedText>
      </Pressable>

      <View style={styles.emptyDivider}>
        <View style={[styles.emptyDividerLine, { backgroundColor: theme.border }]} />
        <ThemedText type="small" style={[styles.emptyDividerText, { color: theme.textSecondary }]}>
          OR ADD HISTORY MANUALLY
        </ThemedText>
        <View style={[styles.emptyDividerLine, { backgroundColor: theme.border }]} />
      </View>

      <Pressable
        testID="button-empty-questionnaire"
        style={[styles.emptySecondaryBtn, { borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate("ProfileTab", { screen: "IntakeHistory" });
        }}
        accessibilityRole="button"
        accessibilityLabel="Enter your complete health history using a guided questionnaire"
      >
        <View style={[styles.emptySecondaryIcon, { backgroundColor: theme.primary + "12" }]}>
          <Feather name="clipboard" size={18} color={theme.primary} />
        </View>
        <View style={styles.emptySecondaryText}>
          <ThemedText style={[styles.emptySecondaryTitle, { color: theme.text }]}>
            Enter History with Questionnaire
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Answer a guided set of questions about your past health
          </ThemedText>
        </View>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </Pressable>

      <Pressable
        testID="button-empty-scan"
        style={[styles.emptySecondaryBtn, { borderColor: theme.border, backgroundColor: theme.backgroundDefault, marginTop: Spacing.sm }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate("ProfileTab", { screen: "ScanPaperRecord" });
        }}
        accessibilityRole="button"
        accessibilityLabel="Scan paper medical records with AI assistance"
      >
        <View style={[styles.emptySecondaryIcon, { backgroundColor: theme.primary + "12" }]}>
          <Feather name="camera" size={18} color={theme.primary} />
        </View>
        <View style={styles.emptySecondaryText}>
          <ThemedText style={[styles.emptySecondaryTitle, { color: theme.text }]}>
            Scan Paper Records (AI Assist)
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Snap photos of paper charts — AI extracts the details
          </ThemedText>
        </View>
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      </Pressable>
    </View>
  );

  const totalRecords = Array.isArray(records) ? records.length : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <FlatList
        data={CATEGORIES}
        keyExtractor={(item) => item.type}
        numColumns={2}
        columnWrapperStyle={styles.row}
        renderItem={({ item, index }) => (
          <CategoryCard
            category={item}
            count={getCountForCategory(item.type)}
            index={index}
            onPress={() => handleCategoryPress(item)}
            theme={theme}
          />
        )}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
            progressViewOffset={headerHeight}
          />
        }
        ListHeaderComponent={
          totalRecords > 0 ? (
            <View style={styles.header}>
              <ThemedText type="h2">Browse by Category</ThemedText>
              <ThemedText
                type="small"
                style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
              >
                {totalRecords} total records across all categories
              </ThemedText>
            </View>
          ) : null
        }
        ListEmptyComponent={!isLoading ? (loadError ? (
          <View style={{ padding: Spacing.xl, alignItems: "center" }} accessibilityRole="alert" accessibilityLiveRegion="assertive">
            <Feather name="wifi-off" size={32} color={theme.error} />
            <ThemedText style={{ fontSize: 16, fontWeight: "600", color: theme.error, marginTop: Spacing.md }}>
              Unable to load records
            </ThemedText>
            <ThemedText style={{ fontSize: 13, color: theme.textSecondary, marginTop: Spacing.sm, textAlign: "center" }}>
              Pull down to refresh and try again
            </ThemedText>
          </View>
        ) : renderEmpty) : null}
        showsVerticalScrollIndicator={false}
      />
      <Pressable
        style={[
          styles.fab,
          {
            backgroundColor: theme.primary,
            bottom: tabBarHeight + Spacing.md,
          },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          navigation.navigate("AddSource");
        }}
        testID="add-records-button"
        accessibilityRole="button"
        accessibilityLabel="Add health records"
        accessibilityHint="Navigate to add a new health record source"
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  categoryCard: {
    flex: 1,
    maxWidth: "48%",
  },
  categoryCardInner: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    gap: Spacing.sm,
    minHeight: 130,
    justifyContent: "center",
  },
  categoryIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryTitle: {
    textAlign: "center",
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 24,
    alignItems: "center",
  },
  countText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
    paddingTop: Spacing["4xl"],
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
    marginBottom: Spacing.xl,
  },
  emptyConnectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  emptyConnectBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  emptyDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    width: "100%",
    maxWidth: 340,
  },
  emptyDividerLine: {
    flex: 1,
    height: 1,
  },
  emptyDividerText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  emptySecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    width: "100%",
    maxWidth: 340,
  },
  emptySecondaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  emptySecondaryText: {
    flex: 1,
  },
  emptySecondaryTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
});
