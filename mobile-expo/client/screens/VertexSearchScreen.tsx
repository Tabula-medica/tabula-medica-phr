// @ts-nocheck
import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { Card } from "@/components/Card";
import { ThemedText } from "@/components/ThemedText";

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  link?: string;
  metadata: Record<string, string>;
  relevanceScore?: number;
}

interface SearchResponse {
  results: SearchResult[];
  totalSize: number;
  query: string;
  correctedQuery?: string;
  searchTime: number;
  summary?: string;
}

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Standards: "book-open",
  Compliance: "shield",
  Coding: "hash",
  Clinical: "activity",
  Practice: "briefcase",
  general: "file-text",
};

const QUICK_SEARCHES = [
  { label: "FHIR Resources", query: "FHIR R4 resources" },
  { label: "HIPAA", query: "HIPAA compliance" },
  { label: "ICD-10 Codes", query: "ICD-10 diagnosis codes" },
  { label: "Medications", query: "medication interactions" },
  { label: "Preventive Care", query: "preventive care guidelines" },
  { label: "Lab Results", query: "lab results interpretation" },
];

export default function VertexSearchScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [searchText, setSearchText] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  const { data: suggestionsData } = useQuery<{ suggestions: string[] }>({
    queryKey: [`/api/vertex-search/suggestions?q=${encodeURIComponent(searchText)}`],
    enabled: searchText.length >= 2 && submittedQuery !== searchText,
  });

  const {
    data: searchData,
    isLoading,
    isFetching,
  } = useQuery<SearchResponse>({
    queryKey: [`/api/vertex-search?q=${encodeURIComponent(submittedQuery)}`],
    enabled: submittedQuery.length > 0,
  });

  const handleSearch = useCallback(() => {
    if (searchText.trim().length > 0) {
      setSubmittedQuery(searchText.trim());
      Keyboard.dismiss();
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }, [searchText]);

  const handleQuickSearch = useCallback((query: string) => {
    setSearchText(query);
    setSubmittedQuery(query);
    Keyboard.dismiss();
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleSuggestionTap = useCallback((suggestion: string) => {
    setSearchText(suggestion);
    setSubmittedQuery(suggestion);
    Keyboard.dismiss();
  }, []);

  const handleClear = useCallback(() => {
    setSearchText("");
    setSubmittedQuery("");
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const showSuggestions =
    searchText.length >= 2 &&
    submittedQuery !== searchText &&
    (suggestionsData?.suggestions?.length ?? 0) > 0;

  const renderResultItem = useCallback(
    ({ item, index }: { item: SearchResult; index: number }) => {
      const category = item.metadata?.category || "general";
      const icon = CATEGORY_ICONS[category] || "file-text";

      return (
        <Animated.View entering={FadeInDown.delay(index * 60).springify()}>
          <Card style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: `${theme.primary}15` },
                ]}
              >
                <Feather name={icon} size={14} color={theme.primary} />
                <ThemedText
                  style={[styles.categoryText, { color: theme.primary }]}
                >
                  {category}
                </ThemedText>
              </View>
              {item.relevanceScore ? (
                <ThemedText
                  style={[styles.scoreText, { color: theme.textSecondary }]}
                >
                  {Math.round(item.relevanceScore * 100)}% match
                </ThemedText>
              ) : null}
            </View>
            <ThemedText
              style={[styles.resultTitle, { color: theme.text }]}
              numberOfLines={2}
            >
              {item.title}
            </ThemedText>
            <ThemedText
              style={[styles.resultSnippet, { color: theme.textSecondary }]}
              numberOfLines={4}
            >
              {item.snippet}
            </ThemedText>
            {item.metadata?.source ? (
              <View style={styles.sourceRow}>
                <Feather
                  name="external-link"
                  size={11}
                  color={theme.textSecondary}
                />
                <ThemedText
                  style={[styles.sourceText, { color: theme.textSecondary }]}
                >
                  {item.metadata.source}
                </ThemedText>
              </View>
            ) : null}
          </Card>
        </Animated.View>
      );
    },
    [theme]
  );

  const renderEmptyState = useCallback(() => {
    if (isLoading || isFetching) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText
            style={[styles.stateText, { color: theme.textSecondary }]}
          >
            Searching knowledge base...
          </ThemedText>
        </View>
      );
    }

    if (submittedQuery && searchData && searchData.results.length === 0) {
      return (
        <View style={styles.centerState}>
          <Feather name="search" size={48} color={theme.textSecondary} />
          <ThemedText style={[styles.stateTitle, { color: theme.text }]}>
            No results found
          </ThemedText>
          <ThemedText
            style={[styles.stateText, { color: theme.textSecondary }]}
          >
            Try different keywords or check your spelling
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.centerState}>
          <View
            style={[
              styles.searchIconCircle,
              { backgroundColor: `${theme.primary}12` },
            ]}
          >
            <Feather name="search" size={32} color={theme.primary} />
          </View>
          <ThemedText style={[styles.stateTitle, { color: theme.text }]}>
            Search Tabula Medica
          </ThemedText>
          <ThemedText
            style={[styles.stateText, { color: theme.textSecondary }]}
          >
            Search across health standards, clinical guidelines, medical codes,
            and compliance resources
          </ThemedText>
        </View>
        <View style={styles.quickSearchSection}>
          <ThemedText
            style={[styles.quickSearchLabel, { color: theme.textSecondary }]}
          >
            Quick searches
          </ThemedText>
          <View style={styles.quickSearchGrid}>
            {QUICK_SEARCHES.map((item) => (
              <Pressable
                key={item.query}
                testID={`quick-search-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                onPress={() => handleQuickSearch(item.query)}
                style={({ pressed }) => [
                  styles.quickSearchChip,
                  {
                    backgroundColor: theme.backgroundDefault,
                    borderColor: theme.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Feather name="search" size={12} color={theme.primary} />
                <ThemedText
                  style={[styles.quickSearchText, { color: theme.text }]}
                >
                  {item.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    );
  }, [
    isLoading,
    isFetching,
    submittedQuery,
    searchData,
    theme,
    handleQuickSearch,
  ]);

  const renderHeader = useCallback(() => {
    if (!searchData || !submittedQuery) return null;

    return (
      <View style={styles.resultsHeader}>
        {searchData.summary ? (
          <Card style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Feather name="zap" size={14} color={theme.primary} />
              <ThemedText
                style={[styles.summaryLabel, { color: theme.primary }]}
              >
                AI Summary
              </ThemedText>
            </View>
            <ThemedText
              style={[styles.summaryText, { color: theme.text }]}
            >
              {searchData.summary}
            </ThemedText>
          </Card>
        ) : null}
        <View style={styles.metaRow}>
          <ThemedText
            style={[styles.metaText, { color: theme.textSecondary }]}
          >
            {searchData.totalSize} result
            {searchData.totalSize !== 1 ? "s" : ""} ({searchData.searchTime}ms)
          </ThemedText>
          {searchData.correctedQuery ? (
            <ThemedText
              style={[styles.correctedQuery, { color: theme.primary }]}
            >
              Showing results for: {searchData.correctedQuery}
            </ThemedText>
          ) : null}
        </View>
      </View>
    );
  }, [searchData, submittedQuery, theme]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.searchBarContainer,
          {
            paddingTop: headerHeight + Spacing.sm,
            backgroundColor: theme.backgroundRoot,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            ref={inputRef}
            testID="input-vertex-search"
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search health knowledge..."
            placeholderTextColor={theme.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchText.length > 0 ? (
            <Pressable
              testID="button-clear-search"
              onPress={handleClear}
              hitSlop={8}
            >
              <Feather name="x-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {showSuggestions ? (
          <View
            style={[
              styles.suggestionsDropdown,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.border,
              },
            ]}
          >
            {suggestionsData!.suggestions.map((suggestion) => (
              <Pressable
                key={suggestion}
                onPress={() => handleSuggestionTap(suggestion)}
                style={({ pressed }) => [
                  styles.suggestionItem,
                  {
                    backgroundColor: pressed
                      ? `${theme.primary}10`
                      : "transparent",
                  },
                ]}
              >
                <Feather
                  name="corner-down-right"
                  size={14}
                  color={theme.textSecondary}
                />
                <ThemedText
                  style={[styles.suggestionText, { color: theme.text }]}
                >
                  {suggestion}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <FlatList
        data={searchData?.results || []}
        renderItem={renderResultItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmptyState}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBarContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.body,
    fontFamily: undefined,
    paddingVertical: 0,
  },
  suggestionsDropdown: {
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  suggestionText: {
    fontSize: Typography.sizes.small,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    flexGrow: 1,
  },
  centerState: {
    alignItems: "center",
    paddingTop: Spacing["2xl"],
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  searchIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  stateTitle: {
    fontSize: Typography.sizes.subtitle,
    fontWeight: "600" as const,
    textAlign: "center",
  },
  stateText: {
    fontSize: Typography.sizes.small,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
  },
  quickSearchSection: {
    paddingTop: Spacing["2xl"],
  },
  quickSearchLabel: {
    fontSize: Typography.sizes.caption,
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  quickSearchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  quickSearchChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  quickSearchText: {
    fontSize: Typography.sizes.small,
  },
  resultsHeader: {
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  summaryCard: {
    padding: Spacing.md,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  summaryLabel: {
    fontSize: Typography.sizes.caption,
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  summaryText: {
    fontSize: Typography.sizes.small,
    lineHeight: 20,
  },
  metaRow: {
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  metaText: {
    fontSize: Typography.sizes.caption,
  },
  correctedQuery: {
    fontSize: Typography.sizes.caption,
    fontStyle: "italic",
  },
  resultCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  scoreText: {
    fontSize: 11,
  },
  resultTitle: {
    fontSize: Typography.sizes.body,
    fontWeight: "600" as const,
    marginBottom: Spacing.xs,
    lineHeight: 22,
  },
  resultSnippet: {
    fontSize: Typography.sizes.small,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sourceText: {
    fontSize: 11,
  },
});
