import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface EducationCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconName: string | null;
  colorHex: string | null;
  sortOrder: number;
}

interface PersonalizedArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  categoryId: string;
  categoryName: string;
  readTimeMinutes: number;
  difficultyLevel: string;
  relevanceScore: number;
  relevanceReason: string;
  isPersonalized: boolean;
  isSaved: boolean;
}

interface ReadingStats {
  articlesRead: number;
  articlesSaved: number;
  totalReadTime: number;
}

type TabType = "forYou" | "browse" | "saved" | "progress";

export default function EducationHubScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabType>("forYou");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const { theme: colors } = useTheme();

  const { data: categories, isLoading: categoriesLoading } = useQuery<EducationCategory[]>({
    queryKey: ["/api/education/categories"],
  });

  const { data: personalizedArticles, isLoading: personalizedLoading } = useQuery<PersonalizedArticle[]>({
    queryKey: ["/api/education/articles/personalized"],
    enabled: selectedTab === "forYou",
  });

  const { data: savedArticles, isLoading: savedLoading } = useQuery<PersonalizedArticle[]>({
    queryKey: ["/api/education/saved"],
    enabled: selectedTab === "saved",
  });

  const { data: categoryArticles, isLoading: categoryArticlesLoading } = useQuery<{
    articles: PersonalizedArticle[];
    total: number;
  }>({
    queryKey: ["/api/education/categories", selectedCategoryId, "articles"],
    enabled: selectedTab === "browse" && !!selectedCategoryId,
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery<PersonalizedArticle[]>({
    queryKey: ["/api/education/articles/search", searchQuery],
    enabled: searchQuery.length >= 2,
  });

  const { data: readingStats } = useQuery<ReadingStats>({
    queryKey: ["/api/education/stats"],
    enabled: selectedTab === "progress",
  });

  const saveArticleMutation = useMutation({
    mutationFn: (articleId: string) =>
      apiRequest("POST", `/api/education/articles/${articleId}/save`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/education"] });
    },
  });

  const unsaveArticleMutation = useMutation({
    mutationFn: (articleId: string) =>
      apiRequest("DELETE", `/api/education/articles/${articleId}/save`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/education"] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["/api/education"] });
    setRefreshing(false);
  }, [queryClient]);

  const getCategoryIcon = (iconName: string | null): keyof typeof Feather.glyphMap => {
    if (!iconName) return "book-open";
    const validIcons: Record<string, keyof typeof Feather.glyphMap> = {
      heart: "heart",
      droplet: "droplet",
      smile: "smile",
      coffee: "coffee",
      package: "package",
      shield: "shield",
      activity: "activity",
      user: "user",
      users: "users",
      sunset: "sunset",
      scissors: "scissors",
      star: "star",
    };
    return validIcons[iconName] || "book-open";
  };

  const getDifficultyColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "beginner":
        return colors.success;
      case "intermediate":
        return colors.warning;
      case "advanced":
        return colors.error;
      default:
        return colors.textSecondary;
    }
  };

  const handleArticlePress = (article: PersonalizedArticle) => {
    navigation.navigate("ArticleDetail", { articleId: article.id });
  };

  const handleSaveToggle = (article: PersonalizedArticle) => {
    if (article.isSaved) {
      unsaveArticleMutation.mutate(article.id);
    } else {
      saveArticleMutation.mutate(article.id);
    }
  };

  const renderArticleCard = (article: PersonalizedArticle, showRelevance = false) => (
    <Pressable
      key={article.id}
      onPress={() => handleArticlePress(article)}
      testID={`article-card-${article.id}`}
    >
      <Card style={styles.articleCard}>
        <View style={styles.articleHeader}>
          <View style={styles.articleContent}>
            <View style={styles.articleBadges}>
              <View
                style={[
                  styles.categoryBadge,
                  { backgroundColor: `${colors.primary}20` },
                ]}
              >
                <ThemedText style={[styles.categoryText, { color: colors.primary }]}>
                  {article.categoryName}
                </ThemedText>
              </View>
              <View
                style={[
                  styles.difficultyBadge,
                  { backgroundColor: `${getDifficultyColor(article.difficultyLevel)}15` },
                ]}
              >
                <ThemedText
                  style={[
                    styles.difficultyText,
                    { color: getDifficultyColor(article.difficultyLevel) },
                  ]}
                >
                  {article.difficultyLevel}
                </ThemedText>
              </View>
              {showRelevance && article.relevanceScore > 0.7 ? (
                <View style={[styles.relevanceBadge, { backgroundColor: `${colors.success}15` }]}>
                  <ThemedText style={[styles.relevanceText, { color: colors.success }]}>
                    {Math.round(article.relevanceScore * 100)}% match
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <ThemedText style={styles.articleTitle}>{article.title}</ThemedText>
            <ThemedText style={styles.articleSummary} numberOfLines={2}>
              {article.summary}
            </ThemedText>
            <View style={styles.articleMeta}>
              <View style={styles.metaItem}>
                <Feather name="clock" size={12} color={colors.textSecondary} />
                <ThemedText style={styles.metaText}>{article.readTimeMinutes} min</ThemedText>
              </View>
              {article.isPersonalized ? (
                <View style={styles.metaItem}>
                  <Feather name="star" size={12} color={colors.warning} />
                  <ThemedText style={[styles.metaText, { color: colors.warning }]}>
                    Personalized
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
          <Pressable
            onPress={() => handleSaveToggle(article)}
            style={styles.saveButton}
            testID={`save-button-${article.id}`}
          >
            <Feather
              name={article.isSaved ? "bookmark" : "bookmark"}
              size={22}
              color={article.isSaved ? colors.primary : colors.textSecondary}
              style={article.isSaved ? { opacity: 1 } : { opacity: 0.5 }}
            />
          </Pressable>
        </View>
      </Card>
    </Pressable>
  );

  const renderForYouTab = () => {
    if (personalizedLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={styles.loadingText}>Personalizing content for you...</ThemedText>
        </View>
      );
    }

    if (!personalizedArticles || personalizedArticles.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name="book-open" size={32} color={colors.primary} />
          </View>
          <ThemedText style={styles.emptyTitle}>Your Personalized Content</ThemedText>
          <ThemedText style={styles.emptyText}>
            We analyze your health profile to recommend educational content tailored to your conditions and medications.
          </ThemedText>
        </View>
      );
    }

    return (
      <View>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Recommended for You</ThemedText>
          <Pressable onPress={() => queryClient.invalidateQueries({ queryKey: ["/api/education/articles/personalized"] })}>
            <View style={styles.refreshBadge}>
              <Feather name="refresh-cw" size={14} color={colors.primary} />
              <ThemedText style={[styles.refreshText, { color: colors.primary }]}>Refresh</ThemedText>
            </View>
          </Pressable>
        </View>
        {personalizedArticles.map((article) => renderArticleCard(article, true))}
      </View>
    );
  };

  const renderBrowseTab = () => {
    if (categoriesLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (!selectedCategoryId) {
      return (
        <View>
          <View style={styles.searchContainer}>
            <View style={[styles.searchInputContainer, { backgroundColor: colors.backgroundSecondary }]}>
              <Feather name="search" size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search articles..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                testID="search-input"
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Feather name="x" size={18} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {searchQuery.length >= 2 ? (
            <View>
              <ThemedText style={styles.sectionTitle}>Search Results</ThemedText>
              {searchLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : searchResults && searchResults.length > 0 ? (
                searchResults.map((article) => renderArticleCard(article))
              ) : (
                <ThemedText style={styles.noResultsText}>No articles found</ThemedText>
              )}
            </View>
          ) : (
            <View>
              <ThemedText style={styles.sectionTitle}>Browse by Topic</ThemedText>
              <View style={styles.categoriesGrid}>
                {categories?.map((category) => (
                  <Pressable
                    key={category.id}
                    onPress={() => setSelectedCategoryId(category.id)}
                    style={styles.categoryCardWrapper}
                    testID={`category-${category.slug}`}
                  >
                    <Card style={styles.categoryCard}>
                      <View
                        style={[
                          styles.categoryIcon,
                          { backgroundColor: `${category.colorHex || colors.primary}15` },
                        ]}
                      >
                        <Feather
                          name={getCategoryIcon(category.iconName)}
                          size={24}
                          color={category.colorHex || colors.primary}
                        />
                      </View>
                      <ThemedText style={styles.categoryName}>{category.name}</ThemedText>
                    </Card>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>
      );
    }

    const selectedCategory = categories?.find((c) => c.id === selectedCategoryId);

    return (
      <View>
        <Pressable
          onPress={() => setSelectedCategoryId(null)}
          style={styles.backButton}
          testID="back-button"
        >
          <Feather name="arrow-left" size={20} color={colors.primary} />
          <ThemedText style={[styles.backText, { color: colors.primary }]}>All Topics</ThemedText>
        </Pressable>

        <ThemedText style={styles.sectionTitle}>{selectedCategory?.name || "Articles"}</ThemedText>

        {categoryArticlesLoading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : categoryArticles && categoryArticles.articles.length > 0 ? (
          categoryArticles.articles.map((article) => renderArticleCard(article))
        ) : (
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>
              No articles in this category yet. Check back soon!
            </ThemedText>
          </View>
        )}
      </View>
    );
  };

  const renderSavedTab = () => {
    if (savedLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (!savedArticles || savedArticles.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name="bookmark" size={32} color={colors.primary} />
          </View>
          <ThemedText style={styles.emptyTitle}>No Saved Articles</ThemedText>
          <ThemedText style={styles.emptyText}>
            Save articles to read later by tapping the bookmark icon.
          </ThemedText>
        </View>
      );
    }

    return (
      <View>
        <ThemedText style={styles.sectionTitle}>
          Your Saved Articles ({savedArticles.length})
        </ThemedText>
        {savedArticles.map((article) => renderArticleCard(article))}
      </View>
    );
  };

  const renderProgressTab = () => {
    return (
      <View style={styles.progressContainer}>
        <Card style={styles.statsCard}>
          <ThemedText style={styles.statsTitle}>Your Learning Stats</ThemedText>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: colors.primary }]}>
                {readingStats?.articlesRead || 0}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Articles Read</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: colors.success }]}>
                {readingStats?.articlesSaved || 0}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Articles Saved</ThemedText>
            </View>
            <View style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: colors.warning }]}>
                {readingStats?.totalReadTime || 0}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Minutes Read</ThemedText>
            </View>
          </View>
        </Card>

        <Card style={styles.tipCard}>
          <View style={styles.tipHeader}>
            <Feather name="info" size={20} color={colors.primary} />
            <ThemedText style={styles.tipTitle}>Learning Tip</ThemedText>
          </View>
          <ThemedText style={styles.tipText}>
            Reading health education content for just 10 minutes a day can significantly improve your understanding of your conditions and treatments.
          </ThemedText>
        </Card>
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.tabContainer}>
          <Pressable
            style={[styles.tab, selectedTab === "forYou" && { backgroundColor: colors.primary }]}
            onPress={() => setSelectedTab("forYou")}
            testID="tab-for-you"
          >
            <Feather
              name="star"
              size={16}
              color={selectedTab === "forYou" ? "#FFFFFF" : colors.textSecondary}
            />
            <ThemedText
              style={[styles.tabText, selectedTab === "forYou" && { color: "#FFFFFF" }]}
            >
              For You
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.tab, selectedTab === "browse" && { backgroundColor: colors.primary }]}
            onPress={() => {
              setSelectedTab("browse");
              setSelectedCategoryId(null);
            }}
            testID="tab-browse"
          >
            <Feather
              name="grid"
              size={16}
              color={selectedTab === "browse" ? "#FFFFFF" : colors.textSecondary}
            />
            <ThemedText
              style={[styles.tabText, selectedTab === "browse" && { color: "#FFFFFF" }]}
            >
              Browse
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.tab, selectedTab === "saved" && { backgroundColor: colors.primary }]}
            onPress={() => setSelectedTab("saved")}
            testID="tab-saved"
          >
            <Feather
              name="bookmark"
              size={16}
              color={selectedTab === "saved" ? "#FFFFFF" : colors.textSecondary}
            />
            <ThemedText
              style={[styles.tabText, selectedTab === "saved" && { color: "#FFFFFF" }]}
            >
              Saved
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.tab, selectedTab === "progress" && { backgroundColor: colors.primary }]}
            onPress={() => setSelectedTab("progress")}
            testID="tab-progress"
          >
            <Feather
              name="trending-up"
              size={16}
              color={selectedTab === "progress" ? "#FFFFFF" : colors.textSecondary}
            />
            <ThemedText
              style={[styles.tabText, selectedTab === "progress" && { color: "#FFFFFF" }]}
            >
              Progress
            </ThemedText>
          </Pressable>
        </View>

        {selectedTab === "forYou" && renderForYouTab()}
        {selectedTab === "browse" && renderBrowseTab()}
        {selectedTab === "saved" && renderSavedTab()}
        {selectedTab === "progress" && renderProgressTab()}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
    opacity: 0.7,
  },
  tabContainer: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  refreshBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  refreshText: {
    fontSize: 13,
    fontWeight: "500",
  },
  articleCard: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  articleHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  articleContent: {
    flex: 1,
  },
  articleBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "600",
  },
  difficultyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  difficultyText: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  relevanceBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  relevanceText: {
    fontSize: 11,
    fontWeight: "600",
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  articleSummary: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.7,
    marginBottom: Spacing.sm,
  },
  articleMeta: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    opacity: 0.6,
  },
  saveButton: {
    padding: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  searchContainer: {
    marginBottom: Spacing.lg,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  noResultsText: {
    textAlign: "center",
    opacity: 0.6,
    marginTop: Spacing.lg,
  },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  categoryCardWrapper: {
    width: "47%",
  },
  categoryCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  categoryIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  backText: {
    fontSize: 15,
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
    paddingHorizontal: Spacing.lg,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.7,
    textAlign: "center",
  },
  progressContainer: {
    gap: Spacing.lg,
  },
  statsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  tipCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  tipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.8,
  },
});
