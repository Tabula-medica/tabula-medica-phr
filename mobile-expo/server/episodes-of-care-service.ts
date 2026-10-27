/**
 * Episodes of Care Service
 * Groups related health events into unified care journeys
 * using clinical logic and AI-assisted pattern recognition
 */

import { db } from "./db";
import { 
  episodesOfCare, 
  episodeEvents, 
  episodeSummaries,
  healthRecords,
  type EpisodeOfCare,
  type EpisodeEvent,
  EPISODE_TYPES,
  EPISODE_EVENT_ROLES
} from "@shared/schema";
import { eq, desc, asc, and, gte, lte, sql, inArray } from "drizzle-orm";
import { chatComplete } from "./ai-client";

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  normalizedTitle?: string;
  date: Date;
  provider?: string;
  facility?: string;
  details?: Record<string, unknown>;
  severity?: string;
}

interface EpisodeWithEvents extends EpisodeOfCare {
  events: Array<EpisodeEvent & { healthRecord?: typeof healthRecords.$inferSelect }>;
  eventCount: number;
}

interface ClinicalGroupingResult {
  episodes: EpisodeWithEvents[];
  ungroupedEvents: TimelineEvent[];
}

// Clinical keywords for episode type detection
const SURGERY_KEYWORDS = [
  "surgery", "surgical", "operation", "procedure", "excision", "resection",
  "replacement", "repair", "transplant", "biopsy", "arthroscopy", "laparoscopy",
  "appendectomy", "cholecystectomy", "hysterectomy", "mastectomy", "ectomy",
  "plasty", "otomy", "ostomy"
];

const CHRONIC_KEYWORDS = [
  "diabetes", "hypertension", "copd", "asthma", "heart failure", "chf",
  "kidney disease", "ckd", "arthritis", "lupus", "multiple sclerosis",
  "parkinson", "alzheimer", "dementia", "epilepsy", "hiv", "hepatitis"
];

const MATERNITY_KEYWORDS = [
  "pregnancy", "prenatal", "obstetric", "labor", "delivery", "postpartum",
  "cesarean", "c-section", "ultrasound fetal", "gestational", "trimester"
];

const MENTAL_HEALTH_KEYWORDS = [
  "depression", "anxiety", "bipolar", "schizophrenia", "ptsd",
  "psychiatric", "psychotherapy", "counseling", "mental health"
];

const REHABILITATION_KEYWORDS = [
  "physical therapy", "pt", "occupational therapy", "ot", "rehabilitation",
  "rehab", "recovery", "therapy session"
];

export class EpisodesOfCareService {
  private static instance: EpisodesOfCareService;

  static getInstance(): EpisodesOfCareService {
    if (!EpisodesOfCareService.instance) {
      EpisodesOfCareService.instance = new EpisodesOfCareService();
    }
    return EpisodesOfCareService.instance;
  }

  /**
   * Get all episodes for a user with their linked events
   */
  async getEpisodesForUser(userId: string): Promise<EpisodeWithEvents[]> {
    const episodes = await db
      .select()
      .from(episodesOfCare)
      .where(eq(episodesOfCare.userId, userId))
      .orderBy(desc(episodesOfCare.startDate));

    const episodesWithEvents: EpisodeWithEvents[] = [];

    for (const episode of episodes) {
      const events = await db
        .select({
          episodeEvent: episodeEvents,
          healthRecord: healthRecords,
        })
        .from(episodeEvents)
        .leftJoin(healthRecords, eq(episodeEvents.healthRecordId, healthRecords.id))
        .where(eq(episodeEvents.episodeId, episode.id))
        .orderBy(asc(episodeEvents.sequenceOrder));

      episodesWithEvents.push({
        ...episode,
        events: events.map(e => ({
          ...e.episodeEvent,
          healthRecord: e.healthRecord || undefined,
        })),
        eventCount: events.length,
      });
    }

    return episodesWithEvents;
  }

  /**
   * Get a single episode with all its events
   */
  async getEpisodeById(episodeId: string): Promise<EpisodeWithEvents | null> {
    const [episode] = await db
      .select()
      .from(episodesOfCare)
      .where(eq(episodesOfCare.id, episodeId))
      .limit(1);

    if (!episode) return null;

    const events = await db
      .select({
        episodeEvent: episodeEvents,
        healthRecord: healthRecords,
      })
      .from(episodeEvents)
      .leftJoin(healthRecords, eq(episodeEvents.healthRecordId, healthRecords.id))
      .where(eq(episodeEvents.episodeId, episodeId))
      .orderBy(asc(episodeEvents.sequenceOrder));

    return {
      ...episode,
      events: events.map(e => ({
        ...e.episodeEvent,
        healthRecord: e.healthRecord || undefined,
      })),
      eventCount: events.length,
    };
  }

  /**
   * Detect and create episodes from health records using clinical grouping logic
   */
  async detectAndCreateEpisodes(userId: string): Promise<ClinicalGroupingResult> {
    // Get all health records for the user
    const records = await db
      .select()
      .from(healthRecords)
      .where(eq(healthRecords.userId, userId))
      .orderBy(asc(healthRecords.date));

    // Convert to timeline events
    const timelineEvents: TimelineEvent[] = records.map(r => ({
      id: r.id,
      type: r.type,
      title: r.title,
      date: r.date,
      provider: r.provider || undefined,
      facility: r.facility || undefined,
      details: (r.details as Record<string, unknown>) || undefined,
      severity: this.determineSeverity(r.type, r.title),
    }));

    // Group events into episodes
    const groupedEvents = this.groupEventsIntoClusters(timelineEvents);
    
    const createdEpisodes: EpisodeWithEvents[] = [];
    const ungroupedEvents: TimelineEvent[] = [];

    for (const group of groupedEvents) {
      if (group.events.length >= 2) {
        // Create episode for groups with 2+ related events
        const episode = await this.createEpisodeFromCluster(userId, group);
        if (episode) {
          createdEpisodes.push(episode);
        }
      } else {
        ungroupedEvents.push(...group.events);
      }
    }

    return {
      episodes: createdEpisodes,
      ungroupedEvents,
    };
  }

  /**
   * Group events into clusters based on clinical relationships
   */
  private groupEventsIntoClusters(events: TimelineEvent[]): Array<{
    type: string;
    triggerEvent: TimelineEvent;
    events: TimelineEvent[];
  }> {
    const clusters: Array<{
      type: string;
      triggerEvent: TimelineEvent;
      events: TimelineEvent[];
    }> = [];

    const usedEventIds = new Set<string>();

    // First pass: Find trigger events (surgeries, major diagnoses, etc.)
    const triggerEvents = events.filter(e => 
      this.isTriggerEvent(e) && !usedEventIds.has(e.id)
    );

    for (const trigger of triggerEvents) {
      const episodeType = this.determineEpisodeType(trigger);
      const cluster = {
        type: episodeType,
        triggerEvent: trigger,
        events: [trigger],
      };

      usedEventIds.add(trigger.id);

      // Find related follow-up events within a time window
      const relatedEvents = this.findRelatedEvents(trigger, events, usedEventIds);
      for (const related of relatedEvents) {
        cluster.events.push(related);
        usedEventIds.add(related.id);
      }

      // Sort by date
      cluster.events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      clusters.push(cluster);
    }

    // Second pass: Group remaining chronic condition management
    const remainingEvents = events.filter(e => !usedEventIds.has(e.id));
    const chronicClusters = this.groupChronicConditionEvents(remainingEvents, usedEventIds);
    clusters.push(...chronicClusters);

    return clusters;
  }

  /**
   * Determine if an event is a trigger event (starts an episode)
   */
  private isTriggerEvent(event: TimelineEvent): boolean {
    const titleLower = event.title.toLowerCase();
    const typeLower = event.type.toLowerCase();

    // Surgeries and major procedures
    if (SURGERY_KEYWORDS.some(kw => titleLower.includes(kw))) return true;
    if (typeLower === "surgery" || typeLower === "procedure") return true;

    // Major diagnoses
    if (event.severity === "major" || event.severity === "urgent") return true;

    // Hospitalizations
    if (titleLower.includes("admission") || titleLower.includes("hospitalization")) return true;
    if (titleLower.includes("emergency") || titleLower.includes("er visit")) return true;

    return false;
  }

  /**
   * Determine the episode type based on the trigger event
   */
  private determineEpisodeType(event: TimelineEvent): string {
    const titleLower = event.title.toLowerCase();

    if (SURGERY_KEYWORDS.some(kw => titleLower.includes(kw))) return "surgery";
    if (MATERNITY_KEYWORDS.some(kw => titleLower.includes(kw))) return "maternity";
    if (MENTAL_HEALTH_KEYWORDS.some(kw => titleLower.includes(kw))) return "mental_health";
    if (REHABILITATION_KEYWORDS.some(kw => titleLower.includes(kw))) return "rehabilitation";
    if (CHRONIC_KEYWORDS.some(kw => titleLower.includes(kw))) return "chronic_management";

    if (titleLower.includes("emergency") || titleLower.includes("er ")) return "emergency";
    if (titleLower.includes("diagnostic") || titleLower.includes("workup")) return "diagnostic_workup";

    return "acute_illness";
  }

  /**
   * Find events related to a trigger event
   */
  private findRelatedEvents(
    trigger: TimelineEvent,
    allEvents: TimelineEvent[],
    usedIds: Set<string>
  ): TimelineEvent[] {
    const related: TimelineEvent[] = [];
    const triggerDate = new Date(trigger.date);
    const triggerTitle = trigger.title.toLowerCase();
    
    // Time windows based on episode type
    const episodeType = this.determineEpisodeType(trigger);
    const maxDaysAfter = this.getTimeWindowDays(episodeType);

    for (const event of allEvents) {
      if (usedIds.has(event.id) || event.id === trigger.id) continue;

      const eventDate = new Date(event.date);
      const daysDiff = (eventDate.getTime() - triggerDate.getTime()) / (1000 * 60 * 60 * 24);

      // Only look forward in time (follow-ups)
      if (daysDiff < 0 || daysDiff > maxDaysAfter) continue;

      // Check if event is clinically related
      if (this.areEventsClinicallyRelated(trigger, event)) {
        related.push(event);
      }
    }

    return related;
  }

  /**
   * Get the time window in days for finding related events
   */
  private getTimeWindowDays(episodeType: string): number {
    switch (episodeType) {
      case "surgery": return 90; // 3 months post-op
      case "acute_illness": return 30;
      case "emergency": return 14;
      case "chronic_management": return 365;
      case "maternity": return 365;
      case "mental_health": return 180;
      case "rehabilitation": return 120;
      default: return 60;
    }
  }

  /**
   * Check if two events are clinically related
   */
  private areEventsClinicallyRelated(trigger: TimelineEvent, event: TimelineEvent): boolean {
    const triggerTitle = trigger.title.toLowerCase();
    const eventTitle = event.title.toLowerCase();
    const eventType = event.type.toLowerCase();

    // Follow-up visits
    if (eventTitle.includes("follow") && eventTitle.includes("up")) return true;

    // Post-operative care
    if (triggerTitle.includes("surgery") || triggerTitle.includes("procedure")) {
      if (eventTitle.includes("post-op") || eventTitle.includes("postop")) return true;
      if (eventTitle.includes("wound") || eventTitle.includes("recovery")) return true;
      if (eventType === "lab" || eventType === "imaging") return true;
    }

    // Same provider/facility
    if (trigger.provider && event.provider && trigger.provider === event.provider) {
      // Labs, medications, imaging from same provider likely related
      if (["lab", "medication", "imaging", "vital"].includes(eventType)) return true;
    }

    // Same facility suggests relationship
    if (trigger.facility && event.facility && trigger.facility === event.facility) {
      if (eventType === "visit" || eventType === "encounter") return true;
    }

    // Medication related to condition
    if (eventType === "medication") {
      // Any medication within the window is potentially related
      return true;
    }

    // Labs related to monitoring
    if (eventType === "lab") {
      return true;
    }

    // Physical therapy after surgery
    if ((triggerTitle.includes("surgery") || triggerTitle.includes("joint")) &&
        REHABILITATION_KEYWORDS.some(kw => eventTitle.includes(kw))) {
      return true;
    }

    return false;
  }

  /**
   * Group chronic condition management events
   */
  private groupChronicConditionEvents(
    events: TimelineEvent[],
    usedIds: Set<string>
  ): Array<{ type: string; triggerEvent: TimelineEvent; events: TimelineEvent[] }> {
    const clusters: Array<{ type: string; triggerEvent: TimelineEvent; events: TimelineEvent[] }> = [];

    // Group by chronic condition keywords
    for (const condition of CHRONIC_KEYWORDS) {
      const conditionEvents = events.filter(e => 
        !usedIds.has(e.id) && 
        e.title.toLowerCase().includes(condition)
      );

      if (conditionEvents.length >= 2) {
        const trigger = conditionEvents[0];
        clusters.push({
          type: "chronic_management",
          triggerEvent: trigger,
          events: conditionEvents,
        });
        conditionEvents.forEach(e => usedIds.add(e.id));
      }
    }

    return clusters;
  }

  /**
   * Create an episode from a cluster of related events
   */
  private async createEpisodeFromCluster(
    userId: string,
    cluster: { type: string; triggerEvent: TimelineEvent; events: TimelineEvent[] }
  ): Promise<EpisodeWithEvents | null> {
    try {
      const startDate = new Date(Math.min(...cluster.events.map(e => new Date(e.date).getTime())));
      const endDate = new Date(Math.max(...cluster.events.map(e => new Date(e.date).getTime())));

      // Generate title based on trigger event
      const title = this.generateEpisodeTitle(cluster.triggerEvent, cluster.type);

      // Create the episode
      const [episode] = await db.insert(episodesOfCare).values({
        userId,
        title,
        description: `Episode grouping ${cluster.events.length} related health events`,
        episodeType: cluster.type,
        status: endDate < new Date() ? "resolved" : "active",
        primaryCondition: cluster.triggerEvent.title,
        startDate,
        endDate: endDate < new Date() ? endDate : null,
        triggerEventId: cluster.triggerEvent.id,
        primaryProvider: cluster.triggerEvent.provider || null,
        aiGenerated: true,
        confidence: 75,
      }).returning();

      // Link events to the episode
      const eventLinks = cluster.events.map((event, index) => ({
        episodeId: episode.id,
        healthRecordId: event.id,
        eventRole: this.determineEventRole(event, cluster.triggerEvent),
        sequenceOrder: index + 1,
        clinicalRelevance: this.generateClinicalRelevance(event, cluster.triggerEvent),
        isKeyMilestone: event.id === cluster.triggerEvent.id || event.severity === "major",
        aiLinked: true,
      }));

      await db.insert(episodeEvents).values(eventLinks);

      return this.getEpisodeById(episode.id);
    } catch (error) {
      console.error("[EpisodesOfCareService] Error creating episode:", error);
      return null;
    }
  }

  /**
   * Generate a descriptive title for the episode
   */
  private generateEpisodeTitle(trigger: TimelineEvent, episodeType: string): string {
    const date = new Date(trigger.date);
    const monthYear = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });

    switch (episodeType) {
      case "surgery":
        return `${trigger.title} (${monthYear})`;
      case "chronic_management":
        return `${trigger.title} Management`;
      case "acute_illness":
        return `${trigger.title} Treatment (${monthYear})`;
      case "emergency":
        return `Emergency Care: ${trigger.title} (${monthYear})`;
      case "maternity":
        return `Pregnancy Care (${monthYear})`;
      case "rehabilitation":
        return `Rehabilitation: ${trigger.title}`;
      default:
        return `${trigger.title} (${monthYear})`;
    }
  }

  /**
   * Determine the role of an event within an episode
   */
  private determineEventRole(event: TimelineEvent, trigger: TimelineEvent): string {
    if (event.id === trigger.id) return "trigger";

    const type = event.type.toLowerCase();
    const title = event.title.toLowerCase();

    if (type === "lab") return "lab";
    if (type === "medication") return "medication";
    if (type === "imaging") return "imaging";
    if (type === "procedure" || type === "surgery") return "procedure";
    if (title.includes("follow") || title.includes("post")) return "follow_up";
    if (title.includes("consult")) return "consultation";
    if (title.includes("outcome") || title.includes("result")) return "outcome";
    if (title.includes("complication")) return "complication";

    return "follow_up";
  }

  /**
   * Generate a brief clinical relevance explanation
   */
  private generateClinicalRelevance(event: TimelineEvent, trigger: TimelineEvent): string {
    const role = this.determineEventRole(event, trigger);
    
    switch (role) {
      case "trigger":
        return "Initial event that started this episode of care";
      case "lab":
        return "Laboratory testing to monitor progress";
      case "medication":
        return "Medication prescribed as part of treatment";
      case "imaging":
        return "Imaging study for diagnostic or monitoring purposes";
      case "procedure":
        return "Additional procedure related to initial treatment";
      case "follow_up":
        return "Follow-up visit to assess recovery and progress";
      case "consultation":
        return "Specialist consultation for additional expertise";
      case "outcome":
        return "Assessment of treatment outcomes";
      case "complication":
        return "Complication that required additional intervention";
      default:
        return "Related healthcare event";
    }
  }

  /**
   * Determine event severity
   */
  private determineSeverity(type: string, title: string): string {
    const typeLower = type.toLowerCase();
    const titleLower = title.toLowerCase();

    if (typeLower === "surgery" || titleLower.includes("surgery")) return "major";
    if (titleLower.includes("emergency") || titleLower.includes("urgent")) return "urgent";
    if (titleLower.includes("hospitalization") || titleLower.includes("admission")) return "major";
    if (typeLower === "lab" || typeLower === "vital") return "routine";

    return "routine";
  }

  /**
   * Manually add an event to an episode
   */
  async addEventToEpisode(
    episodeId: string, 
    healthRecordId: string, 
    eventRole: string,
    clinicalRelevance?: string
  ): Promise<EpisodeEvent | null> {
    try {
      const [episode] = await db
        .select()
        .from(episodesOfCare)
        .where(eq(episodesOfCare.id, episodeId))
        .limit(1);

      if (!episode) return null;

      // Get current max sequence order
      const existingEvents = await db
        .select()
        .from(episodeEvents)
        .where(eq(episodeEvents.episodeId, episodeId));

      const maxOrder = Math.max(...existingEvents.map(e => e.sequenceOrder || 0), 0);

      const [newEvent] = await db.insert(episodeEvents).values({
        episodeId,
        healthRecordId,
        eventRole,
        sequenceOrder: maxOrder + 1,
        clinicalRelevance: clinicalRelevance || "Manually linked event",
        isKeyMilestone: false,
        aiLinked: false,
      }).returning();

      return newEvent;
    } catch (error) {
      console.error("[EpisodesOfCareService] Error adding event to episode:", error);
      return null;
    }
  }

  /**
   * Remove an event from an episode
   */
  async removeEventFromEpisode(episodeId: string, healthRecordId: string): Promise<boolean> {
    try {
      await db
        .delete(episodeEvents)
        .where(and(
          eq(episodeEvents.episodeId, episodeId),
          eq(episodeEvents.healthRecordId, healthRecordId)
        ));
      return true;
    } catch (error) {
      console.error("[EpisodesOfCareService] Error removing event:", error);
      return false;
    }
  }

  /**
   * Update episode status
   */
  async updateEpisodeStatus(episodeId: string, status: string): Promise<EpisodeOfCare | null> {
    try {
      const [updated] = await db
        .update(episodesOfCare)
        .set({ status, updatedAt: new Date() })
        .where(eq(episodesOfCare.id, episodeId))
        .returning();
      return updated;
    } catch (error) {
      console.error("[EpisodesOfCareService] Error updating episode status:", error);
      return null;
    }
  }

  /**
   * Generate AI summary for an episode
   */
  async generateEpisodeSummary(episodeId: string): Promise<string | null> {
    const episode = await this.getEpisodeById(episodeId);
    if (!episode) return null;

    try {
      const eventsDescription = episode.events.map(e => {
        const record = e.healthRecord;
        if (!record) return "";
        return `- ${new Date(record.date).toLocaleDateString()}: ${record.title} (${e.eventRole})`;
      }).filter(Boolean).join("\n");

      const prompt = `Generate a brief clinical summary for this episode of care:

Episode: ${episode.title}
Type: ${episode.episodeType}
Status: ${episode.status}
Duration: ${episode.startDate.toLocaleDateString()} - ${episode.endDate?.toLocaleDateString() || "Ongoing"}
Primary Condition: ${episode.primaryCondition || "Not specified"}

Events:
${eventsDescription}

Generate a 3-4 sentence patient-friendly summary that explains:
1. What the episode is about
2. Key events and their significance
3. Current status or outcome`;

      const response = await chatComplete({
        model: "deep",
        messages: [
          {
            role: "system",
            content: "You are a medical documentation assistant. Generate clear, patient-friendly summaries of care episodes.",
          },
          { role: "user", content: prompt },
        ],
        maxOutputTokens: 300,
        dataCategories: ["conditions", "clinical_notes"],
        purpose: "documentation",
        callerService: "episodes-of-care-service",
        callerMethod: "generateEpisodeSummary",
      });

      const summary = response.content;

      if (summary) {
        // Store the summary
        await db.insert(episodeSummaries).values({
          episodeId,
          summaryType: "patient_friendly",
          content: summary,
          aiModel: "vertex-ai",
        });
      }

      return summary || this.generateFallbackSummary(episode);
    } catch (error) {
      console.error("[EpisodesOfCareService] Error generating AI summary:", error);
      return this.generateFallbackSummary(episode);
    }
  }

  /**
   * Generate fallback summary without AI
   */
  private generateFallbackSummary(episode: EpisodeWithEvents): string {
    const duration = episode.endDate 
      ? `from ${episode.startDate.toLocaleDateString()} to ${episode.endDate.toLocaleDateString()}`
      : `starting ${episode.startDate.toLocaleDateString()}`;

    return `This ${episode.episodeType.replace("_", " ")} episode involves ${episode.eventCount} related healthcare events ${duration}. ` +
      `The episode ${episode.status === "resolved" ? "has been resolved" : "is currently " + episode.status}. ` +
      `Primary focus: ${episode.primaryCondition || episode.title}.`;
  }

  /**
   * Delete an episode
   */
  async deleteEpisode(episodeId: string): Promise<boolean> {
    try {
      await db.delete(episodesOfCare).where(eq(episodesOfCare.id, episodeId));
      return true;
    } catch (error) {
      console.error("[EpisodesOfCareService] Error deleting episode:", error);
      return false;
    }
  }
}

export const episodesOfCareService = EpisodesOfCareService.getInstance();
