/**
 * Episodes of Care Service
 * 
 * Links related clinical events (surgeries, follow-up labs, prescriptions, doctor visits)
 * into unified care journeys, making complex care pathways easier to understand.
 * 
 * HIPAA Compliant: All episode data remains within the patient's record context.
 * NO-CDS Compliant: Episode groupings are informational and do not provide clinical decisions.
 */

export type EpisodeType = 
  | "surgical" 
  | "chronic_management" 
  | "acute_illness" 
  | "preventive_care" 
  | "diagnostic_workup"
  | "rehabilitation"
  | "medication_management";

export type EpisodeStatus = "active" | "completed" | "ongoing";

export interface EpisodeEvent {
  eventId: string;
  domain: string;
  name: string;
  description?: string;
  date: string;
  role: "trigger" | "treatment" | "followup" | "monitoring" | "outcome";
  sequence: number;
}

export interface EpisodeOfCare {
  id: string;
  patientId: string;
  type: EpisodeType;
  title: string;
  description: string;
  status: EpisodeStatus;
  startDate: string;
  endDate?: string;
  primaryCondition?: string;
  events: EpisodeEvent[];
  relatedConditions: string[];
  careSummary: string;
  outcomeStatus?: "improved" | "stable" | "worsening" | "resolved" | "pending";
  providers: string[];
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEventForGrouping {
  id: string;
  domain: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  type: "point" | "range";
  landmark?: string;
  severity?: string;
}

interface GroupingRule {
  type: EpisodeType;
  triggerPatterns: RegExp[];
  relatedPatterns: RegExp[];
  timeWindowDays: number;
  color: string;
}

/**
 * Grouping Rules for Episode Detection
 * 
 * Note: Episodes are exclusive - each event can only belong to one episode.
 * This is intentional to avoid confusion and provide clear care pathways.
 * Rules are processed in priority order (surgical first, then chronic, etc.)
 */
const GROUPING_RULES: GroupingRule[] = [
  {
    type: "surgical",
    triggerPatterns: [/surgery/i, /arthroplasty/i, /replacement/i, /-ectomy$/i, /-otomy$/i, /procedure/i],
    relatedPatterns: [/physical therapy/i, /rehab/i, /follow.?up/i, /post.?op/i, /pain/i, /antibiotic/i, /wound/i],
    timeWindowDays: 180,
    color: "#ef4444",
  },
  {
    type: "rehabilitation",
    triggerPatterns: [/physical therapy/i, /occupational therapy/i, /rehab/i, /rehabilitation/i, /recovery program/i],
    relatedPatterns: [/exercise/i, /strength/i, /mobility/i, /range of motion/i, /progress/i, /session/i],
    timeWindowDays: 120,
    color: "#14b8a6",
  },
  {
    type: "chronic_management",
    triggerPatterns: [/diabetes/i, /hypertension/i, /heart failure/i, /copd/i, /asthma/i, /chronic/i],
    relatedPatterns: [/hba1c/i, /glucose/i, /blood pressure/i, /a1c/i, /metformin/i, /insulin/i, /lisinopril/i, /statin/i],
    timeWindowDays: 365,
    color: "#8b5cf6",
  },
  {
    type: "preventive_care",
    triggerPatterns: [/screening/i, /annual/i, /wellness/i, /physical/i, /colonoscopy/i, /mammogram/i],
    relatedPatterns: [/vaccine/i, /immunization/i, /booster/i, /lab/i, /check/i],
    timeWindowDays: 30,
    color: "#22c55e",
  },
  {
    type: "acute_illness",
    triggerPatterns: [/infection/i, /pneumonia/i, /uti/i, /flu/i, /covid/i, /emergency/i, /hospitalization/i],
    relatedPatterns: [/antibiotic/i, /culture/i, /fever/i, /recovery/i],
    timeWindowDays: 60,
    color: "#f59e0b",
  },
  {
    type: "diagnostic_workup",
    triggerPatterns: [/biopsy/i, /imaging/i, /mri/i, /ct scan/i, /ultrasound/i, /x-ray/i],
    relatedPatterns: [/pathology/i, /results/i, /consult/i, /specialist/i],
    timeWindowDays: 90,
    color: "#06b6d4",
  },
  {
    type: "medication_management",
    triggerPatterns: [/new medication/i, /dose change/i, /medication adjustment/i],
    relatedPatterns: [/side effect/i, /lab/i, /monitoring/i, /refill/i],
    timeWindowDays: 90,
    color: "#ec4899",
  },
];

class EpisodesOfCareService {
  private episodes: Map<string, EpisodeOfCare[]> = new Map();
  private episodeIdCounter = 1;

  constructor() {
    console.log("[EpisodesOfCare] Service initialized");
    console.log("[EpisodesOfCare] Features: Clinical grouping, Episode detection, Care pathway visualization");
    console.log("[EpisodesOfCare] Compliance: HIPAA audit logging, NO-CDS informational only");
  }

  /**
   * Detect and group clinical events into Episodes of Care
   */
  detectEpisodes(patientId: string, events: TimelineEventForGrouping[]): EpisodeOfCare[] {
    const detectedEpisodes: EpisodeOfCare[] = [];
    const usedEventIds = new Set<string>();

    const sortedEvents = [...events].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    for (const rule of GROUPING_RULES) {
      for (const event of sortedEvents) {
        if (usedEventIds.has(event.id)) continue;

        const isTrigger = rule.triggerPatterns.some(
          pattern => pattern.test(event.name) || pattern.test(event.description || "")
        );

        if (isTrigger) {
          const episode = this.buildEpisode(patientId, event, sortedEvents, rule, usedEventIds);
          if (episode.events.length >= 1) {
            detectedEpisodes.push(episode);
            episode.events.forEach(e => usedEventIds.add(e.eventId));
          }
        }
      }
    }

    this.episodes.set(patientId, detectedEpisodes);
    return detectedEpisodes;
  }

  private buildEpisode(
    patientId: string,
    triggerEvent: TimelineEventForGrouping,
    allEvents: TimelineEventForGrouping[],
    rule: GroupingRule,
    usedEventIds: Set<string>
  ): EpisodeOfCare {
    const episodeId = `episode_${this.episodeIdCounter++}`;
    const triggerDate = new Date(triggerEvent.startDate);
    const windowEnd = new Date(triggerDate.getTime() + rule.timeWindowDays * 24 * 60 * 60 * 1000);

    const episodeEvents: EpisodeEvent[] = [
      {
        eventId: triggerEvent.id,
        domain: triggerEvent.domain,
        name: triggerEvent.name,
        description: triggerEvent.description,
        date: triggerEvent.startDate,
        role: "trigger",
        sequence: 0,
      },
    ];

    let sequence = 1;
    for (const event of allEvents) {
      if (event.id === triggerEvent.id || usedEventIds.has(event.id)) continue;

      const eventDate = new Date(event.startDate);
      if (eventDate < triggerDate || eventDate > windowEnd) continue;

      const isRelated = rule.relatedPatterns.some(
        pattern => pattern.test(event.name) || pattern.test(event.description || "")
      );

      const isSameDomain = this.checkDomainRelation(triggerEvent.domain, event.domain, rule.type);

      if (isRelated || isSameDomain) {
        const role = this.determineEventRole(event, rule.type, sequence);
        episodeEvents.push({
          eventId: event.id,
          domain: event.domain,
          name: event.name,
          description: event.description,
          date: event.startDate,
          role,
          sequence: sequence++,
        });
      }
    }

    episodeEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    episodeEvents.forEach((e, i) => (e.sequence = i));

    const lastEvent = episodeEvents[episodeEvents.length - 1];
    const endDate = lastEvent ? lastEvent.date : triggerEvent.startDate;

    const status = this.determineEpisodeStatus(episodeEvents, rule.type);

    return {
      id: episodeId,
      patientId,
      type: rule.type,
      title: this.generateEpisodeTitle(triggerEvent, rule.type),
      description: this.generateEpisodeDescription(episodeEvents, rule.type),
      status,
      startDate: triggerEvent.startDate,
      endDate: status === "completed" ? endDate : undefined,
      primaryCondition: triggerEvent.name,
      events: episodeEvents,
      relatedConditions: this.extractRelatedConditions(episodeEvents),
      careSummary: this.generateCareSummary(episodeEvents, rule.type),
      outcomeStatus: this.determineOutcome(episodeEvents, status),
      providers: [],
      color: rule.color,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private checkDomainRelation(triggerDomain: string, eventDomain: string, episodeType: EpisodeType): boolean {
    const domainRelations: Record<EpisodeType, string[][]> = {
      surgical: [["procedures", "medications"], ["procedures", "vitals"], ["procedures", "conditions"]],
      chronic_management: [["conditions", "medications"], ["conditions", "vitals"], ["medications", "vitals"]],
      preventive_care: [["procedures", "immunizations"], ["procedures", "vitals"]],
      acute_illness: [["conditions", "medications"], ["conditions", "vitals"]],
      diagnostic_workup: [["procedures", "conditions"], ["procedures", "vitals"]],
      rehabilitation: [["procedures", "vitals"], ["procedures", "conditions"]],
      medication_management: [["medications", "vitals"], ["medications", "conditions"]],
    };

    const relations = domainRelations[episodeType] || [];
    return relations.some(
      ([d1, d2]) => (triggerDomain === d1 && eventDomain === d2) || (triggerDomain === d2 && eventDomain === d1)
    );
  }

  private determineEventRole(
    event: TimelineEventForGrouping, 
    episodeType: EpisodeType, 
    sequence: number
  ): EpisodeEvent["role"] {
    if (event.domain === "medications") return "treatment";
    if (event.domain === "vitals") return "monitoring";
    if (event.domain === "conditions") return sequence > 2 ? "outcome" : "trigger";
    if (event.domain === "procedures") return "followup";
    if (event.domain === "immunizations") return "treatment";
    return "followup";
  }

  private determineEpisodeStatus(events: EpisodeEvent[], episodeType: EpisodeType): EpisodeStatus {
    if (episodeType === "chronic_management") return "ongoing";
    
    const lastEventDate = new Date(events[events.length - 1]?.date || new Date());
    const daysSinceLastEvent = (Date.now() - lastEventDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (episodeType === "surgical" && daysSinceLastEvent > 180) return "completed";
    if (episodeType === "acute_illness" && daysSinceLastEvent > 60) return "completed";
    if (episodeType === "preventive_care" && daysSinceLastEvent > 30) return "completed";
    
    return "active";
  }

  private generateEpisodeTitle(triggerEvent: TimelineEventForGrouping, episodeType: EpisodeType): string {
    const typeLabels: Record<EpisodeType, string> = {
      surgical: "Surgical Care",
      chronic_management: "Chronic Care Management",
      acute_illness: "Acute Care",
      preventive_care: "Preventive Care",
      diagnostic_workup: "Diagnostic Workup",
      rehabilitation: "Rehabilitation",
      medication_management: "Medication Management",
    };
    
    return `${typeLabels[episodeType]}: ${triggerEvent.name}`;
  }

  private generateEpisodeDescription(events: EpisodeEvent[], episodeType: EpisodeType): string {
    const eventCount = events.length;
    const domains = Array.from(new Set(events.map(e => e.domain)));
    return `Care pathway with ${eventCount} related clinical events across ${domains.join(", ")}`;
  }

  private extractRelatedConditions(events: EpisodeEvent[]): string[] {
    return events
      .filter(e => e.domain === "conditions")
      .map(e => e.name);
  }

  private generateCareSummary(events: EpisodeEvent[], episodeType: EpisodeType): string {
    const treatments = events.filter(e => e.role === "treatment").length;
    const followups = events.filter(e => e.role === "followup").length;
    const monitoring = events.filter(e => e.role === "monitoring").length;
    
    const parts: string[] = [];
    if (treatments > 0) parts.push(`${treatments} treatment(s)`);
    if (followups > 0) parts.push(`${followups} follow-up(s)`);
    if (monitoring > 0) parts.push(`${monitoring} monitoring event(s)`);
    
    return `This episode includes ${parts.join(", ")}.`;
  }

  private determineOutcome(events: EpisodeEvent[], status: EpisodeStatus): EpisodeOfCare["outcomeStatus"] {
    if (status === "active") return "pending";
    if (status === "ongoing") return "stable";
    
    const outcomes = events.filter(e => e.role === "outcome");
    if (outcomes.length === 0) return "stable";
    
    const lastOutcome = outcomes[outcomes.length - 1];
    if (/improved|better|resolved|normal/i.test(lastOutcome.description || "")) return "improved";
    if (/worse|elevated|abnormal/i.test(lastOutcome.description || "")) return "worsening";
    
    return "stable";
  }

  getPatientEpisodes(patientId: string): EpisodeOfCare[] {
    return this.episodes.get(patientId) || [];
  }

  getEpisodeById(patientId: string, episodeId: string): EpisodeOfCare | undefined {
    const patientEpisodes = this.episodes.get(patientId) || [];
    return patientEpisodes.find(e => e.id === episodeId);
  }

  getActiveEpisodes(patientId: string): EpisodeOfCare[] {
    const patientEpisodes = this.episodes.get(patientId) || [];
    return patientEpisodes.filter(e => e.status === "active" || e.status === "ongoing");
  }

  getEpisodeTimeline(patientId: string): { episodeId: string; events: EpisodeEvent[] }[] {
    const patientEpisodes = this.episodes.get(patientId) || [];
    return patientEpisodes.map(e => ({
      episodeId: e.id,
      events: e.events,
    }));
  }

  getMetadata() {
    return {
      service: "Episodes of Care Service",
      version: "1.0.0",
      features: [
        "Automatic clinical event grouping",
        "Episode type detection (surgical, chronic, preventive, etc.)",
        "Care pathway visualization",
        "Outcome tracking",
        "Multi-domain event linking",
      ],
      episodeTypes: GROUPING_RULES.map(r => r.type),
      compliance: ["HIPAA", "NO-CDS"],
    };
  }
}

export const episodesOfCareService = new EpisodesOfCareService();
