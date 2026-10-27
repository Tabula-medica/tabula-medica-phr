import React, { useState, useMemo } from "react";
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useHeaderHeight } from "@react-navigation/elements";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { LoadingState, BaseModal } from "@/components/ui";
import { useLanguage } from "@/context/LanguageContext";
import { Spacing } from "@/constants/theme";

type Article = {
  id: string;
  title: string;
  description: string;
  category: string;
  readTime: number;
  content: string;
  relatedConditions: string[];
  relevanceScore: number;
};

type EducationData = {
  articles: Article[];
  categories: string[];
  patientConditions: string[];
  patientMedications: string[];
};

const CATEGORY_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap; color: string; label: string }> = {
  conditions: { icon: "activity", color: "#3B82F6", label: "Conditions" },
  medications: { icon: "heart", color: "#EF4444", label: "Medications" },
  wellness: { icon: "sun", color: "#10B981", label: "Wellness" },
  nutrition: { icon: "coffee", color: "#F59E0B", label: "Nutrition" },
  mental_health: { icon: "smile", color: "#8B5CF6", label: "Mental Health" },
  preventive_care: { icon: "shield", color: "#06B6D4", label: "Preventive Care" },
};

export default function EducationLibraryScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const { data, isLoading, refetch } = useQuery<EducationData>({
    queryKey: ["/api/education/library"],
  });

  const filteredArticles = useMemo(() => {
    if (!data) return [];
    if (!selectedCategory) return data.articles;
    return data.articles.filter(a => a.category === selectedCategory);
  }, [data, selectedCategory]);

  const personalizedArticles = useMemo(() => {
    if (!data) return [];
    return data.articles.filter(a => a.relevanceScore > 0).slice(0, 4);
  }, [data]);

  if (isLoading) {
    return <LoadingState fullScreen />;
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.md, paddingBottom: 100, paddingHorizontal: Spacing.lg }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
      >
        <ThemedText type="h3" style={{ marginBottom: 4 }}>
          Education Library
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: 20 }}>
          Personalized health education based on your records
        </ThemedText>

        {personalizedArticles.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Feather name="star" size={16} color={theme.primary} />
              <ThemedText type="body" style={{ fontWeight: "600", marginLeft: 6 }}>
                Recommended for You
              </ThemedText>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
              {personalizedArticles.map((article) => {
                const cat = CATEGORY_CONFIG[article.category];
                return (
                  <Pressable
                    key={article.id}
                    testID={`card-recommended-${article.id}`}
                    onPress={() => setSelectedArticle(article)}
                    style={[styles.featuredCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
                  >
                    <View style={[styles.catBadge, { backgroundColor: (cat?.color || theme.primary) + "15" }]}>
                      <Feather name={cat?.icon || "book"} size={14} color={cat?.color || theme.primary} />
                      <ThemedText type="caption" style={{ color: cat?.color || theme.primary, marginLeft: 4, fontSize: 10 }}>
                        {cat?.label || article.category}
                      </ThemedText>
                    </View>
                    <ThemedText type="body" style={{ fontWeight: "600", marginTop: 8 }} numberOfLines={2}>
                      {article.title}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 4 }} numberOfLines={2}>
                      {article.description}
                    </ThemedText>
                    <View style={styles.readTimeRow}>
                      <Feather name="clock" size={11} color={theme.textSecondary} />
                      <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4, fontSize: 11 }}>
                        {article.readTime} min read
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        <ThemedText type="body" style={{ fontWeight: "600", marginBottom: 12 }}>
          Browse by Category
        </ThemedText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          <Pressable
            onPress={() => setSelectedCategory(null)}
            style={[
              styles.categoryChip,
              {
                backgroundColor: !selectedCategory ? theme.primary : theme.backgroundSecondary,
                borderColor: !selectedCategory ? theme.primary : theme.border,
              },
            ]}
          >
            <ThemedText type="caption" style={{ color: !selectedCategory ? "#FFFFFF" : theme.text, fontSize: 12 }}>
              All
            </ThemedText>
          </Pressable>
          {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
            <Pressable
              key={key}
              onPress={() => setSelectedCategory(key)}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selectedCategory === key ? config.color + "15" : theme.backgroundSecondary,
                  borderColor: selectedCategory === key ? config.color : theme.border,
                },
              ]}
            >
              <Feather name={config.icon} size={12} color={selectedCategory === key ? config.color : theme.textSecondary} />
              <ThemedText type="caption" style={{
                color: selectedCategory === key ? config.color : theme.text,
                marginLeft: 4,
                fontSize: 12,
              }}>
                {config.label}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>

        {filteredArticles.map((article) => {
          const cat = CATEGORY_CONFIG[article.category];
          return (
            <Pressable
              key={article.id}
              testID={`card-article-${article.id}`}
              onPress={() => setSelectedArticle(article)}
              style={[styles.articleCard, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
            >
              <View style={styles.articleRow}>
                <View style={[styles.articleIcon, { backgroundColor: (cat?.color || theme.primary) + "15" }]}>
                  <Feather name={cat?.icon || "book"} size={18} color={cat?.color || theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    {article.title}
                  </ThemedText>
                  <ThemedText type="caption" style={{ color: theme.textSecondary, marginTop: 2 }} numberOfLines={2}>
                    {article.description}
                  </ThemedText>
                  <View style={styles.articleMeta}>
                    <View style={[styles.catTag, { backgroundColor: (cat?.color || theme.primary) + "10" }]}>
                      <ThemedText type="caption" style={{ color: cat?.color || theme.primary, fontSize: 10 }}>
                        {cat?.label || article.category}
                      </ThemedText>
                    </View>
                    <Feather name="clock" size={10} color={theme.textSecondary} />
                    <ThemedText type="caption" style={{ color: theme.textSecondary, fontSize: 11, marginLeft: 3 }}>
                      {article.readTime} min
                    </ThemedText>
                    {article.relevanceScore > 0 ? (
                      <View style={[styles.relevantTag, { backgroundColor: "#10B981" + "10" }]}>
                        <Feather name="target" size={9} color="#10B981" />
                        <ThemedText type="caption" style={{ color: "#10B981", fontSize: 10, marginLeft: 3 }}>
                          Relevant
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={theme.textSecondary} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <BaseModal
        visible={!!selectedArticle}
        onClose={() => setSelectedArticle(null)}
        title={selectedArticle?.title || ""}
        testID="modal-article-detail"
      >
        {selectedArticle ? (
          <>
            <View style={styles.articleDetailMeta}>
              <View style={[styles.catTag, { backgroundColor: (CATEGORY_CONFIG[selectedArticle.category]?.color || theme.primary) + "15" }]}>
                <Feather
                  name={CATEGORY_CONFIG[selectedArticle.category]?.icon || "book"}
                  size={12}
                  color={CATEGORY_CONFIG[selectedArticle.category]?.color || theme.primary}
                />
                <ThemedText type="caption" style={{
                  color: CATEGORY_CONFIG[selectedArticle.category]?.color || theme.primary,
                  marginLeft: 4,
                }}>
                  {CATEGORY_CONFIG[selectedArticle.category]?.label || selectedArticle.category}
                </ThemedText>
              </View>
              <Feather name="clock" size={12} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: 4 }}>
                {selectedArticle.readTime} min read
              </ThemedText>
            </View>

            <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: 16 }}>
              {selectedArticle.description}
            </ThemedText>

            <View style={[styles.contentDivider, { backgroundColor: theme.border }]} />

            <ThemedText type="body" style={{ lineHeight: 22, color: theme.text }}>
              {selectedArticle.content}
            </ThemedText>

            {selectedArticle.relatedConditions.length > 0 ? (
              <View style={{ marginTop: 20 }}>
                <ThemedText type="caption" style={{ fontWeight: "600", marginBottom: 8 }}>
                  Related Topics
                </ThemedText>
                <View style={styles.relatedRow}>
                  {selectedArticle.relatedConditions.map((c) => (
                    <View key={c} style={[styles.relatedTag, { backgroundColor: theme.backgroundSecondary }]}>
                      <ThemedText type="caption" style={{ fontSize: 11 }}>{c}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </BaseModal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  featuredCard: {
    width: 220,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 12,
  },
  catBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  readTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  articleCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  articleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  articleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  articleMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  catTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  relevantTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  articleDetailMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  contentDivider: {
    height: 1,
    marginBottom: 16,
  },
  relatedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  relatedTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
});
