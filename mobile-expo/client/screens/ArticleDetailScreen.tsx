import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
  TextInput,
  Modal,
  Alert,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import * as MailComposer from "expo-mail-composer";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type ArticleDetailRouteParams = {
  ArticleDetail: {
    articleId: string;
  };
};

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

export default function ArticleDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ArticleDetailRouteParams, "ArticleDetail">>();
  const queryClient = useQueryClient();
  const { theme: colors } = useTheme();
  
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [shareLoading, setShareLoading] = useState(false);

  const { articleId } = route.params;

  const { data: article, isLoading, error } = useQuery<PersonalizedArticle>({
    queryKey: ["/api/education/articles", articleId],
  });

  const saveArticleMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/education/articles/${articleId}/save`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/education/articles", articleId] });
      queryClient.invalidateQueries({ queryKey: ["/api/education/saved"] });
    },
  });

  const unsaveArticleMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/education/articles/${articleId}/save`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/education/articles", articleId] });
      queryClient.invalidateQueries({ queryKey: ["/api/education/saved"] });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/education/articles/${articleId}/read`, {}),
  });

  const handleSaveToggle = () => {
    if (article?.isSaved) {
      unsaveArticleMutation.mutate();
    } else {
      saveArticleMutation.mutate();
    }
  };

  const handleNativeShare = async () => {
    if (!article) return;
    
    try {
      await Share.share({
        title: article.title,
        message: `Check out this health article: ${article.title}\n\n${article.summary}`,
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const handleEmailShare = async () => {
    if (!article || !shareEmail) return;
    
    setShareLoading(true);
    try {
      const isAvailable = await MailComposer.isAvailableAsync();
      
      if (isAvailable) {
        await MailComposer.composeAsync({
          recipients: [shareEmail],
          subject: `Health Article: ${article.title}`,
          body: `${shareMessage ? shareMessage + "\n\n" : ""}${article.title}\n\n${article.summary}\n\n---\n\n${article.content}`,
        });
      } else {
        await apiRequest("POST", `/api/education/articles/${articleId}/share`, {
          recipientEmail: shareEmail,
          personalMessage: shareMessage,
        });
        
        if (Platform.OS === "web") {
          alert(`Article shared to ${shareEmail}`);
        }
      }
      
      setShowShareModal(false);
      setShareEmail("");
      setShareMessage("");
    } catch (error) {
      console.error("Email share error:", error);
    } finally {
      setShareLoading(false);
    }
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

  const renderContent = (content: string) => {
    const paragraphs = content.split("\n\n").filter((p) => p.trim());
    
    return paragraphs.map((paragraph, index) => {
      if (paragraph.startsWith("# ")) {
        return (
          <ThemedText key={index} style={styles.heading1}>
            {paragraph.slice(2)}
          </ThemedText>
        );
      }
      if (paragraph.startsWith("## ")) {
        return (
          <ThemedText key={index} style={styles.heading2}>
            {paragraph.slice(3)}
          </ThemedText>
        );
      }
      if (paragraph.startsWith("### ")) {
        return (
          <ThemedText key={index} style={styles.heading3}>
            {paragraph.slice(4)}
          </ThemedText>
        );
      }
      if (paragraph.startsWith("- ") || paragraph.startsWith("* ")) {
        const items = paragraph.split("\n").filter((item) => item.trim());
        return (
          <View key={index} style={styles.listContainer}>
            {items.map((item, itemIndex) => (
              <View key={itemIndex} style={styles.listItem}>
                <View style={[styles.bullet, { backgroundColor: colors.primary }]} />
                <ThemedText style={styles.listItemText}>
                  {item.slice(2)}
                </ThemedText>
              </View>
            ))}
          </View>
        );
      }
      if (paragraph.startsWith("> ")) {
        return (
          <View
            key={index}
            style={[styles.blockquote, { borderLeftColor: colors.primary }]}
          >
            <ThemedText style={styles.blockquoteText}>
              {paragraph.slice(2)}
            </ThemedText>
          </View>
        );
      }
      return (
        <ThemedText key={index} style={styles.paragraph}>
          {paragraph}
        </ThemedText>
      );
    });
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ThemedView>
    );
  }

  if (error || !article) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.errorContainer, { paddingTop: headerHeight + Spacing.xl }]}>
          <Feather name="alert-circle" size={48} color={colors.error} />
          <ThemedText style={styles.errorText}>
            Unable to load article. Please try again.
          </ThemedText>
          <Pressable
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => queryClient.invalidateQueries({ queryKey: ["/api/education/articles", articleId] })}
          >
            <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        onScrollEndDrag={() => {
          markAsReadMutation.mutate();
        }}
      >
        <View style={styles.header}>
          <View style={styles.badges}>
            <View
              style={[styles.categoryBadge, { backgroundColor: `${colors.primary}20` }]}
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
            {article.isPersonalized ? (
              <View style={[styles.personalizedBadge, { backgroundColor: `${colors.warning}15` }]}>
                <Feather name="star" size={10} color={colors.warning} />
                <ThemedText style={[styles.personalizedText, { color: colors.warning }]}>
                  Personalized
                </ThemedText>
              </View>
            ) : null}
          </View>

          <ThemedText style={styles.title}>{article.title}</ThemedText>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Feather name="clock" size={14} color={colors.textSecondary} />
              <ThemedText style={styles.metaText}>
                {article.readTimeMinutes} min read
              </ThemedText>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={[
                styles.actionButton,
                article.isSaved && { backgroundColor: `${colors.primary}15` },
              ]}
              onPress={handleSaveToggle}
              testID="save-article-button"
            >
              <Feather
                name="bookmark"
                size={18}
                color={article.isSaved ? colors.primary : colors.textSecondary}
              />
              <ThemedText
                style={[
                  styles.actionButtonText,
                  article.isSaved && { color: colors.primary },
                ]}
              >
                {article.isSaved ? "Saved" : "Save"}
              </ThemedText>
            </Pressable>

            <Pressable
              style={styles.actionButton}
              onPress={handleNativeShare}
              testID="share-article-button"
            >
              <Feather name="share-2" size={18} color={colors.textSecondary} />
              <ThemedText style={styles.actionButtonText}>Share</ThemedText>
            </Pressable>

            <Pressable
              style={styles.actionButton}
              onPress={() => setShowShareModal(true)}
              testID="email-share-button"
            >
              <Feather name="mail" size={18} color={colors.textSecondary} />
              <ThemedText style={styles.actionButtonText}>Email</ThemedText>
            </Pressable>
          </View>
        </View>

        <Card style={styles.summaryCard}>
          <ThemedText style={styles.summaryLabel}>Summary</ThemedText>
          <ThemedText style={styles.summaryText}>{article.summary}</ThemedText>
        </Card>

        <View style={styles.contentContainer}>
          {renderContent(article.content)}
        </View>

        <Card style={styles.disclaimerCard}>
          <View style={styles.disclaimerHeader}>
            <Feather name="info" size={16} color={colors.warning} />
            <ThemedText style={[styles.disclaimerTitle, { color: colors.warning }]}>
              Important Notice
            </ThemedText>
          </View>
          <ThemedText style={styles.disclaimerText}>
            This content is for educational purposes only and should not replace professional medical advice. Always consult with your healthcare provider for personalized guidance about your health conditions.
          </ThemedText>
        </Card>
      </ScrollView>

      <Modal
        visible={showShareModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.backgroundRoot }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Share via Email</ThemedText>
              <Pressable onPress={() => setShowShareModal(false)}>
                <Feather name="x" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <ThemedText style={styles.inputLabel}>Recipient Email</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.backgroundSecondary, color: colors.text },
                ]}
                placeholder="Enter email address"
                placeholderTextColor={colors.textSecondary}
                value={shareEmail}
                onChangeText={setShareEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                testID="share-email-input"
              />

              <ThemedText style={styles.inputLabel}>Personal Message (optional)</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  styles.messageInput,
                  { backgroundColor: colors.backgroundSecondary, color: colors.text },
                ]}
                placeholder="Add a personal note..."
                placeholderTextColor={colors.textSecondary}
                value={shareMessage}
                onChangeText={setShareMessage}
                multiline
                numberOfLines={3}
                testID="share-message-input"
              />

              <Pressable
                style={[
                  styles.sendButton,
                  { backgroundColor: colors.primary },
                  !shareEmail && { opacity: 0.5 },
                ]}
                onPress={handleEmailShare}
                disabled={!shareEmail || shareLoading}
                testID="send-share-button"
              >
                {shareLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="send" size={16} color="#FFFFFF" />
                    <ThemedText style={styles.sendButtonText}>Send Article</ThemedText>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    opacity: 0.7,
  },
  retryButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  header: {
    marginBottom: Spacing.lg,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  categoryBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600",
  },
  difficultyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  personalizedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  personalizedText: {
    fontSize: 12,
    fontWeight: "600",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 32,
    marginBottom: Spacing.sm,
  },
  metaRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    opacity: 0.6,
  },
  actionRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "500",
    opacity: 0.8,
  },
  summaryCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    opacity: 0.5,
    marginBottom: Spacing.xs,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
  },
  contentContainer: {
    marginBottom: Spacing.lg,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 26,
    marginBottom: Spacing.md,
  },
  heading1: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  heading2: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  heading3: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  listContainer: {
    marginBottom: Spacing.md,
    paddingLeft: Spacing.sm,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.xs,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 10,
    marginRight: Spacing.sm,
  },
  listItemText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 26,
  },
  blockquote: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.md,
    marginVertical: Spacing.md,
  },
  blockquoteText: {
    fontSize: 16,
    lineHeight: 24,
    fontStyle: "italic",
    opacity: 0.8,
  },
  disclaimerCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  disclaimerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  disclaimerText: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing["2xl"],
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  modalBody: {
    paddingHorizontal: Spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  messageInput: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: Spacing.sm,
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  sendButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
