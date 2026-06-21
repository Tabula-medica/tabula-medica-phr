import type { 
  UserLanguagePreference, 
  SummaryLanguageCode, 
  LanguageAnalyticsEvent 
} from "@shared/schema";
import { supportedLanguages, clinicalSummaryTranslationService, type TranslatedSummary } from "./clinical-summary-translation";

class LanguagePreferencesService {
  private userPreferences: Map<string, UserLanguagePreference> = new Map();
  private analyticsEvents: LanguageAnalyticsEvent[] = [];
  private translationCache: Map<string, TranslatedSummary> = new Map();

  constructor() {
    this.initializeSampleData();
  }

  private initializeSampleData() {
    this.userPreferences.set("user-001", {
      userId: "user-001",
      defaultLanguage: "en",
      summaryLanguageOverrides: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    this.userPreferences.set("patient-001", {
      userId: "patient-001",
      defaultLanguage: "en",
      summaryLanguageOverrides: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  getSupportedLanguages() {
    return supportedLanguages;
  }

  getUserPreference(userId: string): UserLanguagePreference {
    const existing = this.userPreferences.get(userId);
    if (existing) {
      return existing;
    }

    const newPref: UserLanguagePreference = {
      userId,
      defaultLanguage: "en",
      summaryLanguageOverrides: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.userPreferences.set(userId, newPref);
    return newPref;
  }

  setDefaultLanguage(userId: string, language: SummaryLanguageCode): UserLanguagePreference {
    const pref = this.getUserPreference(userId);
    const previousLanguage = pref.defaultLanguage;

    pref.defaultLanguage = language;
    pref.updatedAt = new Date().toISOString();
    this.userPreferences.set(userId, pref);

    this.trackAnalyticsEvent({
      eventType: "language_selected",
      userId,
      previousLanguage,
      newLanguage: language,
      context: "profile_default",
      timestamp: new Date().toISOString()
    });

    console.log(`[LanguagePreferences] User ${userId} set default language to ${language}`);
    return pref;
  }

  setSummaryLanguage(
    userId: string, 
    summaryId: string, 
    language: SummaryLanguageCode
  ): UserLanguagePreference {
    const pref = this.getUserPreference(userId);
    const previousLanguage = pref.summaryLanguageOverrides[summaryId] || pref.defaultLanguage;

    pref.summaryLanguageOverrides[summaryId] = language;
    pref.updatedAt = new Date().toISOString();
    this.userPreferences.set(userId, pref);

    this.translationCache.delete(`${summaryId}-${previousLanguage}`);

    this.trackAnalyticsEvent({
      eventType: "summary_language_changed",
      userId,
      previousLanguage,
      newLanguage: language,
      summaryId,
      context: "quick_switch",
      timestamp: new Date().toISOString()
    });

    console.log(`[LanguagePreferences] User ${userId} set summary ${summaryId} language to ${language}`);
    return pref;
  }

  clearSummaryLanguageOverride(userId: string, summaryId: string): UserLanguagePreference {
    const pref = this.getUserPreference(userId);
    delete pref.summaryLanguageOverrides[summaryId];
    pref.updatedAt = new Date().toISOString();
    this.userPreferences.set(userId, pref);
    return pref;
  }

  getEffectiveLanguage(userId: string, summaryId?: string): SummaryLanguageCode {
    const pref = this.getUserPreference(userId);
    if (summaryId && pref.summaryLanguageOverrides[summaryId]) {
      return pref.summaryLanguageOverrides[summaryId];
    }
    return pref.defaultLanguage;
  }

  async translateSummaryForUser(
    userId: string,
    summaryId: string,
    targetLanguage?: SummaryLanguageCode,
    options?: {
      includePlainLanguage?: boolean;
      readingLevel?: "basic" | "intermediate" | "advanced";
    }
  ): Promise<TranslatedSummary> {
    const language = targetLanguage || this.getEffectiveLanguage(userId, summaryId);
    
    const cacheKey = `${summaryId}-${language}`;
    const cached = this.translationCache.get(cacheKey);
    if (cached) {
      console.log(`[LanguagePreferences] Cache hit for ${cacheKey}`);
      return cached;
    }

    const translated = await clinicalSummaryTranslationService.translateSummary(
      summaryId,
      language,
      options
    );

    this.translationCache.set(cacheKey, translated);

    return translated;
  }

  async getSummariesWithTranslation(
    userId: string,
    patientId: string,
    options?: {
      includePlainLanguage?: boolean;
      readingLevel?: "basic" | "intermediate" | "advanced";
    }
  ): Promise<{
    summaries: Array<{
      original: any;
      translated?: TranslatedSummary;
      effectiveLanguage: SummaryLanguageCode;
    }>;
    userPreference: UserLanguagePreference;
  }> {
    const summaries = clinicalSummaryTranslationService.getSummaries(patientId);
    const userPref = this.getUserPreference(userId);

    const results = await Promise.all(
      summaries.map(async (summary) => {
        const effectiveLanguage = this.getEffectiveLanguage(userId, summary.id);
        
        if (effectiveLanguage === "en" && summary.originalLanguage === "en") {
          return {
            original: summary,
            translated: undefined,
            effectiveLanguage
          };
        }

        try {
          const translated = await this.translateSummaryForUser(
            userId,
            summary.id,
            effectiveLanguage,
            options
          );
          return {
            original: summary,
            translated,
            effectiveLanguage
          };
        } catch (error) {
          console.error(`[LanguagePreferences] Translation failed for ${summary.id}:`, error);
          return {
            original: summary,
            translated: undefined,
            effectiveLanguage
          };
        }
      })
    );

    return {
      summaries: results,
      userPreference: userPref
    };
  }

  trackTranslationRequested(
    userId: string,
    documentId: string,
    documentType: "snapshot_pdf" | "discharge_summary" | "timeline_monthly",
    targetLanguage: SummaryLanguageCode
  ) {
    this.trackAnalyticsEvent({
      eventType: "translation_requested",
      userId,
      newLanguage: targetLanguage,
      summaryId: documentId,
      documentType,
      context: "document_translation",
      timestamp: new Date().toISOString()
    });
    console.log(`[LanguagePreferences] Translation requested: ${documentType} to ${targetLanguage}`);
  }

  trackTranslationCompleted(
    userId: string,
    documentId: string,
    documentType: "snapshot_pdf" | "discharge_summary" | "timeline_monthly",
    targetLanguage: SummaryLanguageCode
  ) {
    this.trackAnalyticsEvent({
      eventType: "translation_completed",
      userId,
      newLanguage: targetLanguage,
      summaryId: documentId,
      documentType,
      context: "document_translation",
      timestamp: new Date().toISOString()
    });
    console.log(`[LanguagePreferences] Translation completed: ${documentType} to ${targetLanguage}`);
  }

  trackViewedOriginal(
    userId: string,
    documentId: string,
    documentType: "snapshot_pdf" | "discharge_summary" | "timeline_monthly",
    originalLanguage: SummaryLanguageCode = "en"
  ) {
    this.trackAnalyticsEvent({
      eventType: "translation_viewed_original",
      userId,
      newLanguage: originalLanguage,
      summaryId: documentId,
      documentType,
      context: "view_original",
      timestamp: new Date().toISOString()
    });
    console.log(`[LanguagePreferences] Viewed original: ${documentType}`);
  }

  private trackAnalyticsEvent(event: LanguageAnalyticsEvent) {
    this.analyticsEvents.push(event);
    
    console.log(`[ANALYTICS] ${event.eventType} | userId: ${event.userId} | ` +
      `language: ${event.previousLanguage || 'none'} -> ${event.newLanguage} | ` +
      `context: ${event.context}${event.summaryId ? ` | summaryId: ${event.summaryId}` : ''}` +
      `${event.documentType ? ` | documentType: ${event.documentType}` : ''}`);
  }

  getAnalyticsEvents(filters?: {
    userId?: string;
    eventType?: "language_selected" | "summary_language_changed" | "translation_requested" | "translation_completed" | "translation_viewed_original";
    documentType?: "snapshot_pdf" | "discharge_summary" | "timeline_monthly";
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): LanguageAnalyticsEvent[] {
    let events = [...this.analyticsEvents];

    if (filters?.userId) {
      events = events.filter(e => e.userId === filters.userId);
    }
    if (filters?.eventType) {
      events = events.filter(e => e.eventType === filters.eventType);
    }
    if (filters?.documentType) {
      events = events.filter(e => e.documentType === filters.documentType);
    }
    if (filters?.startDate) {
      events = events.filter(e => e.timestamp >= filters.startDate!);
    }
    if (filters?.endDate) {
      events = events.filter(e => e.timestamp <= filters.endDate!);
    }

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filters?.limit) {
      events = events.slice(0, filters.limit);
    }

    return events;
  }

  getAnalyticsSummary(): {
    totalLanguageSelections: number;
    totalSummaryLanguageChanges: number;
    totalTranslationRequests: number;
    totalTranslationsCompleted: number;
    totalViewedOriginals: number;
    languageDistribution: Record<string, number>;
    documentTypeDistribution: Record<string, number>;
    recentEvents: LanguageAnalyticsEvent[];
  } {
    const languageSelections = this.analyticsEvents.filter(e => e.eventType === "language_selected");
    const summaryChanges = this.analyticsEvents.filter(e => e.eventType === "summary_language_changed");
    const translationRequests = this.analyticsEvents.filter(e => e.eventType === "translation_requested");
    const translationsCompleted = this.analyticsEvents.filter(e => e.eventType === "translation_completed");
    const viewedOriginals = this.analyticsEvents.filter(e => e.eventType === "translation_viewed_original");

    const languageDistribution: Record<string, number> = {};
    const documentTypeDistribution: Record<string, number> = {};
    
    this.analyticsEvents.forEach(e => {
      languageDistribution[e.newLanguage] = (languageDistribution[e.newLanguage] || 0) + 1;
      if (e.documentType) {
        documentTypeDistribution[e.documentType] = (documentTypeDistribution[e.documentType] || 0) + 1;
      }
    });

    return {
      totalLanguageSelections: languageSelections.length,
      totalSummaryLanguageChanges: summaryChanges.length,
      totalTranslationRequests: translationRequests.length,
      totalTranslationsCompleted: translationsCompleted.length,
      totalViewedOriginals: viewedOriginals.length,
      languageDistribution,
      documentTypeDistribution,
      recentEvents: this.analyticsEvents.slice(-10).reverse()
    };
  }
}

export const languagePreferencesService = new LanguagePreferencesService();
