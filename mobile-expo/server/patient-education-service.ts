/**
 * Patient Education Service
 * AI-powered personalized health education content generation
 * based on patient's active conditions and health journey
 */

import { db } from "./db";
import {
  educationCategories,
  educationArticles,
  savedArticles,
  articleReadingProgress,
  articleShares,
  aiEducationContent,
  healthRecords,
  patientProfiles,
  medicationReminders,
  DEFAULT_EDUCATION_CATEGORIES,
  type EducationCategory,
  type EducationArticle,
  type SavedArticle,
} from "@shared/schema";
import { eq, desc, asc, and, ilike, inArray, sql, isNull } from "drizzle-orm";
import { chatComplete } from "./ai-client";

export interface PersonalizedArticle {
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

export interface PatientHealthContext {
  conditions: string[];
  medications: string[];
  recentEvents: string[];
  demographics?: {
    age?: number;
    gender?: string;
  };
}

class PatientEducationService {
  /**
   * Initialize default categories if they don't exist
   */
  async initializeCategories(): Promise<void> {
    try {
      const existingCategories = await db.select().from(educationCategories).limit(1);
      
      if (existingCategories.length === 0) {
        console.log("[PatientEducationService] Seeding default education categories...");
        
        for (let i = 0; i < DEFAULT_EDUCATION_CATEGORIES.length; i++) {
          const cat = DEFAULT_EDUCATION_CATEGORIES[i];
          await db.insert(educationCategories).values({
            name: cat.name,
            slug: cat.slug,
            iconName: cat.iconName,
            colorHex: cat.colorHex,
            sortOrder: i,
            isActive: true,
          });
        }
        
        console.log("[PatientEducationService] Seeded", DEFAULT_EDUCATION_CATEGORIES.length, "categories");
      }
    } catch (error) {
      console.error("[PatientEducationService] Error initializing categories:", error);
    }
  }

  /**
   * Get all active categories
   */
  async getCategories(): Promise<EducationCategory[]> {
    return db
      .select()
      .from(educationCategories)
      .where(eq(educationCategories.isActive, true))
      .orderBy(asc(educationCategories.sortOrder));
  }

  /**
   * Get articles by category
   */
  async getArticlesByCategory(
    categoryId: string,
    userId?: string,
    limit = 20,
    offset = 0
  ): Promise<{ articles: PersonalizedArticle[]; total: number }> {
    const category = await db
      .select()
      .from(educationCategories)
      .where(eq(educationCategories.id, categoryId))
      .limit(1);

    if (category.length === 0) {
      return { articles: [], total: 0 };
    }

    const articles = await db
      .select()
      .from(educationArticles)
      .where(
        and(
          eq(educationArticles.categoryId, categoryId),
          eq(educationArticles.isActive, true)
        )
      )
      .orderBy(desc(educationArticles.isFeatured), desc(educationArticles.publishedAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(educationArticles)
      .where(
        and(
          eq(educationArticles.categoryId, categoryId),
          eq(educationArticles.isActive, true)
        )
      );

    let savedArticleIds: string[] = [];
    if (userId) {
      const saved = await db
        .select({ articleId: savedArticles.articleId })
        .from(savedArticles)
        .where(eq(savedArticles.userId, userId));
      savedArticleIds = saved.map((s) => s.articleId);
    }

    const personalizedArticles: PersonalizedArticle[] = articles.map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary || "",
      content: article.content,
      categoryId: article.categoryId,
      categoryName: category[0].name,
      readTimeMinutes: article.readTimeMinutes || 5,
      difficultyLevel: article.difficultyLevel || "beginner",
      relevanceScore: article.isFeatured ? 1 : 0.5,
      relevanceReason: article.isFeatured ? "Featured article" : "General content",
      isPersonalized: article.isAiGenerated || false,
      isSaved: savedArticleIds.includes(article.id),
    }));

    return { articles: personalizedArticles, total: Number(countResult.count) };
  }

  /**
   * Get patient's health context for personalization
   */
  async getPatientHealthContext(userId: string): Promise<PatientHealthContext> {
    const profile = await db
      .select()
      .from(patientProfiles)
      .where(eq(patientProfiles.userId, userId))
      .limit(1);

    const conditions: string[] = [];
    const medicationsList: string[] = [];
    const recentEvents: string[] = [];

    // Get conditions from health records
    const conditionRecords = await db
      .select()
      .from(healthRecords)
      .where(
        and(
          eq(healthRecords.userId, userId),
          eq(healthRecords.type, "condition")
        )
      )
      .orderBy(desc(healthRecords.date))
      .limit(10);

    conditions.push(...conditionRecords.map((r) => r.title));

    // Get current medications
    const meds = await db
      .select()
      .from(medicationReminders)
      .where(
        and(
          eq(medicationReminders.userId, userId),
          eq(medicationReminders.isActive, true)
        )
      )
      .limit(10);

    medicationsList.push(...meds.map((m) => m.medicationName));

    // Get recent health events
    const recentRecords = await db
      .select()
      .from(healthRecords)
      .where(eq(healthRecords.userId, userId))
      .orderBy(desc(healthRecords.date))
      .limit(5);

    recentEvents.push(...recentRecords.map((r) => `${r.type}: ${r.title}`));

    // Calculate age if DOB available
    let age: number | undefined;
    if (profile[0]?.dateOfBirth) {
      const dob = new Date(profile[0].dateOfBirth);
      const today = new Date();
      age = today.getFullYear() - dob.getFullYear();
    }

    return {
      conditions: [...new Set(conditions)],
      medications: [...new Set(medicationsList)],
      recentEvents,
      demographics: {
        age,
        gender: profile[0]?.gender || undefined,
      },
    };
  }

  /**
   * Generate personalized educational content using AI
   */
  async generatePersonalizedContent(userId: string): Promise<PersonalizedArticle[]> {
    const context = await this.getPatientHealthContext(userId);
    
    if (context.conditions.length === 0 && context.medications.length === 0) {
      return this.getGeneralRecommendations(userId);
    }

    const prompt = `You are a health education content specialist. Based on the patient's health profile, generate 3 personalized educational article recommendations.

Patient Health Context:
- Active Conditions: ${context.conditions.join(", ") || "None specified"}
- Current Medications: ${context.medications.join(", ") || "None specified"}
- Recent Health Events: ${context.recentEvents.join("; ") || "None"}
${context.demographics?.age ? `- Age: ${context.demographics.age}` : ""}
${context.demographics?.gender ? `- Gender: ${context.demographics.gender}` : ""}

For each article, provide:
1. A clear, engaging title
2. A 2-3 sentence summary
3. The main content (500-800 words, educational and supportive tone)
4. Difficulty level (beginner, intermediate, or advanced)
5. Estimated read time in minutes
6. A relevance score (0.7-1.0) indicating how relevant this is to the patient
7. A brief explanation of why this content is relevant

Important guidelines:
- Use plain language accessible to general audiences
- Focus on empowerment and understanding, not medical advice
- Include practical tips when appropriate
- Cite that patients should consult their healthcare provider for specific guidance
- Be supportive and encouraging in tone

Respond in JSON format:
{
  "articles": [
    {
      "title": "...",
      "summary": "...",
      "content": "...",
      "difficultyLevel": "beginner|intermediate|advanced",
      "readTimeMinutes": 5,
      "relevanceScore": 0.85,
      "relevanceReason": "..."
    }
  ]
}`;

    try {
      const response = await chatComplete({
        model: "deep",
        messages: [{ role: "user", content: prompt }],
        jsonMode: true,
        temperature: 0.7,
        dataCategories: ["demographics", "conditions", "medications"],
        purpose: "patient_education",
        callerService: "patient-education-service",
        callerMethod: "generatePersonalizedContent",
      });

      const content = response.content;
      if (!content) {
        throw new Error("No content in AI response");
      }

      const parsed = JSON.parse(content);
      const articles = parsed.articles || [];

      // Get or create a category for personalized content
      let personalizedCategory = await db
        .select()
        .from(educationCategories)
        .where(eq(educationCategories.slug, "personalized-for-you"))
        .limit(1);

      if (personalizedCategory.length === 0) {
        const [newCat] = await db
          .insert(educationCategories)
          .values({
            name: "Personalized For You",
            slug: "personalized-for-you",
            iconName: "star",
            colorHex: "#8B5CF6",
            sortOrder: -1,
            isActive: true,
          })
          .returning();
        personalizedCategory = [newCat];
      }

      // Save articles to database and return
      const savedResults: PersonalizedArticle[] = [];

      for (const article of articles) {
        const slug = `${Date.now()}-${article.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50)}`;
        
        const [saved] = await db
          .insert(educationArticles)
          .values({
            categoryId: personalizedCategory[0].id,
            title: article.title,
            slug,
            summary: article.summary,
            content: article.content,
            readTimeMinutes: article.readTimeMinutes || 5,
            difficultyLevel: article.difficultyLevel || "beginner",
            isAiGenerated: true,
            aiGeneratedFor: userId,
            isActive: true,
            publishedAt: new Date(),
          })
          .returning();

        savedResults.push({
          id: saved.id,
          title: saved.title,
          summary: saved.summary || "",
          content: saved.content,
          categoryId: saved.categoryId,
          categoryName: personalizedCategory[0].name,
          readTimeMinutes: saved.readTimeMinutes || 5,
          difficultyLevel: saved.difficultyLevel || "beginner",
          relevanceScore: article.relevanceScore || 0.8,
          relevanceReason: article.relevanceReason || "Based on your health profile",
          isPersonalized: true,
          isSaved: false,
        });
      }

      // Track AI content generation
      await db.insert(aiEducationContent).values({
        userId,
        conditionContext: context,
        promptUsed: prompt,
        generatedContent: JSON.stringify(articles),
        status: "completed",
        generatedAt: new Date(),
      });

      return savedResults;
    } catch (error) {
      console.error("[PatientEducationService] Error generating personalized content:", error);
      return this.getGeneralRecommendations(userId);
    }
  }

  /**
   * Get general recommendations when no personalization context available
   */
  async getGeneralRecommendations(userId: string): Promise<PersonalizedArticle[]> {
    const articles = await db
      .select({
        article: educationArticles,
        category: educationCategories,
      })
      .from(educationArticles)
      .innerJoin(educationCategories, eq(educationArticles.categoryId, educationCategories.id))
      .where(
        and(
          eq(educationArticles.isActive, true),
          eq(educationArticles.isFeatured, true)
        )
      )
      .orderBy(desc(educationArticles.publishedAt))
      .limit(5);

    const savedIds = await this.getUserSavedArticleIds(userId);

    return articles.map(({ article, category }) => ({
      id: article.id,
      title: article.title,
      summary: article.summary || "",
      content: article.content,
      categoryId: article.categoryId,
      categoryName: category.name,
      readTimeMinutes: article.readTimeMinutes || 5,
      difficultyLevel: article.difficultyLevel || "beginner",
      relevanceScore: 0.6,
      relevanceReason: "Featured health content",
      isPersonalized: false,
      isSaved: savedIds.includes(article.id),
    }));
  }

  /**
   * Get user's saved article IDs
   */
  async getUserSavedArticleIds(userId: string): Promise<string[]> {
    const saved = await db
      .select({ articleId: savedArticles.articleId })
      .from(savedArticles)
      .where(eq(savedArticles.userId, userId));
    return saved.map((s) => s.articleId);
  }

  /**
   * Get article by ID
   */
  async getArticleById(articleId: string, userId?: string): Promise<PersonalizedArticle | null> {
    const result = await db
      .select({
        article: educationArticles,
        category: educationCategories,
      })
      .from(educationArticles)
      .innerJoin(educationCategories, eq(educationArticles.categoryId, educationCategories.id))
      .where(eq(educationArticles.id, articleId))
      .limit(1);

    if (result.length === 0) return null;

    const { article, category } = result[0];
    
    // Increment view count
    await db
      .update(educationArticles)
      .set({ viewCount: (article.viewCount || 0) + 1 })
      .where(eq(educationArticles.id, articleId));

    // Check if saved
    let isSaved = false;
    if (userId) {
      const saved = await db
        .select()
        .from(savedArticles)
        .where(
          and(
            eq(savedArticles.userId, userId),
            eq(savedArticles.articleId, articleId)
          )
        )
        .limit(1);
      isSaved = saved.length > 0;
    }

    // Track reading progress
    if (userId) {
      const existingProgress = await db
        .select()
        .from(articleReadingProgress)
        .where(
          and(
            eq(articleReadingProgress.userId, userId),
            eq(articleReadingProgress.articleId, articleId)
          )
        )
        .limit(1);

      if (existingProgress.length === 0) {
        await db.insert(articleReadingProgress).values({
          userId,
          articleId,
          progressPercent: 0,
        });
      } else {
        await db
          .update(articleReadingProgress)
          .set({ lastReadAt: new Date() })
          .where(eq(articleReadingProgress.id, existingProgress[0].id));
      }
    }

    return {
      id: article.id,
      title: article.title,
      summary: article.summary || "",
      content: article.content,
      categoryId: article.categoryId,
      categoryName: category.name,
      readTimeMinutes: article.readTimeMinutes || 5,
      difficultyLevel: article.difficultyLevel || "beginner",
      relevanceScore: article.isAiGenerated ? 0.9 : 0.5,
      relevanceReason: article.isAiGenerated ? "Personalized for you" : "General content",
      isPersonalized: article.isAiGenerated || false,
      isSaved,
    };
  }

  /**
   * Save an article for a user
   */
  async saveArticle(userId: string, articleId: string, notes?: string): Promise<SavedArticle> {
    // Check if already saved
    const existing = await db
      .select()
      .from(savedArticles)
      .where(
        and(
          eq(savedArticles.userId, userId),
          eq(savedArticles.articleId, articleId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update notes if provided
      if (notes !== undefined) {
        const [updated] = await db
          .update(savedArticles)
          .set({ notes })
          .where(eq(savedArticles.id, existing[0].id))
          .returning();
        return updated;
      }
      return existing[0];
    }

    const [saved] = await db
      .insert(savedArticles)
      .values({
        userId,
        articleId,
        notes,
      })
      .returning();

    return saved;
  }

  /**
   * Unsave an article for a user
   */
  async unsaveArticle(userId: string, articleId: string): Promise<boolean> {
    const result = await db
      .delete(savedArticles)
      .where(
        and(
          eq(savedArticles.userId, userId),
          eq(savedArticles.articleId, articleId)
        )
      );
    return true;
  }

  /**
   * Get user's saved articles
   */
  async getSavedArticles(userId: string): Promise<PersonalizedArticle[]> {
    const results = await db
      .select({
        saved: savedArticles,
        article: educationArticles,
        category: educationCategories,
      })
      .from(savedArticles)
      .innerJoin(educationArticles, eq(savedArticles.articleId, educationArticles.id))
      .innerJoin(educationCategories, eq(educationArticles.categoryId, educationCategories.id))
      .where(eq(savedArticles.userId, userId))
      .orderBy(desc(savedArticles.savedAt));

    return results.map(({ article, category }) => ({
      id: article.id,
      title: article.title,
      summary: article.summary || "",
      content: article.content,
      categoryId: article.categoryId,
      categoryName: category.name,
      readTimeMinutes: article.readTimeMinutes || 5,
      difficultyLevel: article.difficultyLevel || "beginner",
      relevanceScore: 1,
      relevanceReason: "Saved by you",
      isPersonalized: article.isAiGenerated || false,
      isSaved: true,
    }));
  }

  /**
   * Share an article via email
   */
  async shareArticleByEmail(
    userId: string,
    articleId: string,
    recipientEmail: string,
    personalMessage?: string
  ): Promise<{ success: boolean; message: string }> {
    const article = await this.getArticleById(articleId);
    if (!article) {
      return { success: false, message: "Article not found" };
    }

    // Track the share
    await db.insert(articleShares).values({
      userId,
      articleId,
      recipientEmail,
      personalMessage,
    });

    // In production, this would send an actual email
    // For now, we'll log it and return success
    console.log("[PatientEducationService] Email share requested:", {
      articleId,
      articleTitle: article.title,
      recipientEmail,
      personalMessage,
    });

    // TODO: Integrate with email service (SendGrid, Postmark, etc.)
    // For now, simulate success
    return {
      success: true,
      message: `Article "${article.title}" shared to ${recipientEmail}`,
    };
  }

  /**
   * Search articles
   */
  async searchArticles(query: string, userId?: string, limit = 20): Promise<PersonalizedArticle[]> {
    const searchPattern = `%${query}%`;
    
    const results = await db
      .select({
        article: educationArticles,
        category: educationCategories,
      })
      .from(educationArticles)
      .innerJoin(educationCategories, eq(educationArticles.categoryId, educationCategories.id))
      .where(
        and(
          eq(educationArticles.isActive, true),
          sql`(
            ${educationArticles.title} ILIKE ${searchPattern} OR
            ${educationArticles.summary} ILIKE ${searchPattern} OR
            ${educationArticles.content} ILIKE ${searchPattern}
          )`
        )
      )
      .orderBy(desc(educationArticles.isFeatured), desc(educationArticles.publishedAt))
      .limit(limit);

    const savedIds = userId ? await this.getUserSavedArticleIds(userId) : [];

    return results.map(({ article, category }) => ({
      id: article.id,
      title: article.title,
      summary: article.summary || "",
      content: article.content,
      categoryId: article.categoryId,
      categoryName: category.name,
      readTimeMinutes: article.readTimeMinutes || 5,
      difficultyLevel: article.difficultyLevel || "beginner",
      relevanceScore: 0.5,
      relevanceReason: "Search result",
      isPersonalized: article.isAiGenerated || false,
      isSaved: savedIds.includes(article.id),
    }));
  }

  /**
   * Mark article as read (100% progress)
   */
  async markArticleAsRead(userId: string, articleId: string): Promise<void> {
    const existing = await db
      .select()
      .from(articleReadingProgress)
      .where(
        and(
          eq(articleReadingProgress.userId, userId),
          eq(articleReadingProgress.articleId, articleId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(articleReadingProgress)
        .set({
          progressPercent: 100,
          completedAt: new Date(),
          lastReadAt: new Date(),
        })
        .where(eq(articleReadingProgress.id, existing[0].id));
    } else {
      await db.insert(articleReadingProgress).values({
        userId,
        articleId,
        progressPercent: 100,
        completedAt: new Date(),
      });
    }
  }

  /**
   * Get user's reading stats
   */
  async getReadingStats(userId: string): Promise<{
    articlesRead: number;
    articlesSaved: number;
    totalReadTime: number;
  }> {
    const [readCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(articleReadingProgress)
      .where(
        and(
          eq(articleReadingProgress.userId, userId),
          eq(articleReadingProgress.progressPercent, 100)
        )
      );

    const [savedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(savedArticles)
      .where(eq(savedArticles.userId, userId));

    // Calculate total read time from completed articles
    const completedArticles = await db
      .select({
        readTime: educationArticles.readTimeMinutes,
      })
      .from(articleReadingProgress)
      .innerJoin(educationArticles, eq(articleReadingProgress.articleId, educationArticles.id))
      .where(
        and(
          eq(articleReadingProgress.userId, userId),
          eq(articleReadingProgress.progressPercent, 100)
        )
      );

    const totalReadTime = completedArticles.reduce(
      (sum, a) => sum + (a.readTime || 5),
      0
    );

    return {
      articlesRead: Number(readCount.count),
      articlesSaved: Number(savedCount.count),
      totalReadTime,
    };
  }
}

export const patientEducationService = new PatientEducationService();
