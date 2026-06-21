import { logPhiAccess } from "../security/hipaa-audit";

export type OnboardingMode = "fast" | "advanced";

export interface OnboardingModeConfig {
  mode: OnboardingMode;
  collectsPortalCredentials: false;
  collectsMRN: false;
  collectsSSN: false;
  collectsInsuranceId: false;
  requiredFields: string[];
  optionalFields: string[];
  features: string[];
}

export const ONBOARDING_MODES: Record<OnboardingMode, OnboardingModeConfig> = {
  fast: {
    mode: "fast",
    collectsPortalCredentials: false,
    collectsMRN: false,
    collectsSSN: false,
    collectsInsuranceId: false,
    requiredFields: ["facilityName"],
    optionalFields: ["facilityType", "userCity", "userState", "portalKnown"],
    features: ["autocomplete_search", "manual_add", "skip_option"],
  },
  advanced: {
    mode: "advanced",
    collectsPortalCredentials: false,
    collectsMRN: false,
    collectsSSN: false,
    collectsInsuranceId: false,
    requiredFields: ["facilityName", "facilityType"],
    optionalFields: ["userCity", "userState", "portalKnown", "consentGiven"],
    features: [
      "autocomplete_search",
      "manual_add",
      "skip_option",
      "portal_linking",
      "consent_management",
      "data_retrieval",
    ],
  },
};

export function getOnboardingConfig(mode: OnboardingMode = "fast"): OnboardingModeConfig {
  return ONBOARDING_MODES[mode];
}

export type FacilityAnalyticsEventType =
  | "facility_onboarding_started"
  | "facility_search_used"
  | "facility_selected"
  | "facility_manual_added"
  | "facility_onboarding_completed"
  | "facility_portal_known_yes"
  | "facility_portal_known_no"
  | "facility_skipped";

export interface FacilityAnalyticsEvent {
  id: string;
  eventType: FacilityAnalyticsEventType;
  userId: string;
  sessionId?: string;
  timestamp: Date;
  metadata: {
    facilityId?: string;
    facilityType?: string;
    facilityName?: string;
    searchQuery?: string;
    searchResultCount?: number;
    matchScore?: number;
    userCity?: string;
    userState?: string;
    portalKnown?: boolean;
    fhirSupported?: boolean;
    completionStep?: string;
    skipReason?: string;
  };
}

const facilityAnalyticsEvents: FacilityAnalyticsEvent[] = [];

export function trackFacilityEvent(
  eventType: FacilityAnalyticsEventType,
  userId: string,
  metadata: FacilityAnalyticsEvent["metadata"] = {},
  sessionId?: string
): FacilityAnalyticsEvent {
  const event: FacilityAnalyticsEvent = {
    id: crypto.randomUUID(),
    eventType,
    userId,
    sessionId,
    timestamp: new Date(),
    metadata,
  };

  facilityAnalyticsEvents.push(event);

  logPhiAccess({
    userId,
    action: "read",
    resourceType: "FacilityAnalytics",
    details: `Analytics event: ${eventType}, metadata: ${JSON.stringify(metadata)}`,
  });

  console.log(`[FacilityAnalytics] ${eventType}:`, {
    userId,
    sessionId,
    ...metadata,
  });

  return event;
}

export function getFacilityAnalyticsEvents(filters?: {
  userId?: string;
  eventType?: FacilityAnalyticsEventType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): FacilityAnalyticsEvent[] {
  let events = [...facilityAnalyticsEvents];

  if (filters?.userId) {
    events = events.filter((e) => e.userId === filters.userId);
  }
  if (filters?.eventType) {
    events = events.filter((e) => e.eventType === filters.eventType);
  }
  if (filters?.startDate) {
    events = events.filter((e) => e.timestamp >= filters.startDate!);
  }
  if (filters?.endDate) {
    events = events.filter((e) => e.timestamp <= filters.endDate!);
  }

  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  if (filters?.limit) {
    events = events.slice(0, filters.limit);
  }

  return events;
}

export function getFacilityOnboardingFunnel(startDate?: Date, endDate?: Date) {
  const events = getFacilityAnalyticsEvents({ startDate, endDate });

  const started = events.filter((e) => e.eventType === "facility_onboarding_started").length;
  const searched = events.filter((e) => e.eventType === "facility_search_used").length;
  const selected = events.filter((e) => e.eventType === "facility_selected").length;
  const manualAdded = events.filter((e) => e.eventType === "facility_manual_added").length;
  const completed = events.filter((e) => e.eventType === "facility_onboarding_completed").length;
  const skipped = events.filter((e) => e.eventType === "facility_skipped").length;
  const portalKnownYes = events.filter((e) => e.eventType === "facility_portal_known_yes").length;
  const portalKnownNo = events.filter((e) => e.eventType === "facility_portal_known_no").length;

  const facilityTypeBreakdown: Record<string, number> = {};
  events
    .filter((e) => e.eventType === "facility_selected" && e.metadata.facilityType)
    .forEach((e) => {
      const type = e.metadata.facilityType!;
      facilityTypeBreakdown[type] = (facilityTypeBreakdown[type] || 0) + 1;
    });

  return {
    funnel: {
      started,
      searched,
      selected,
      manualAdded,
      completed,
      skipped,
    },
    conversionRates: {
      searchToSelect: started > 0 ? Math.round((selected / started) * 100) : 0,
      selectToComplete: selected > 0 ? Math.round((completed / selected) * 100) : 0,
      overallCompletion: started > 0 ? Math.round((completed / started) * 100) : 0,
      skipRate: started > 0 ? Math.round((skipped / started) * 100) : 0,
    },
    portalKnowledge: {
      yes: portalKnownYes,
      no: portalKnownNo,
      rate: portalKnownYes + portalKnownNo > 0
        ? Math.round((portalKnownYes / (portalKnownYes + portalKnownNo)) * 100)
        : 0,
    },
    facilityTypeBreakdown,
    totalEvents: events.length,
  };
}

export function getPopularFacilities(limit = 10) {
  const events = getFacilityAnalyticsEvents({ eventType: "facility_selected" });

  const facilityCounts: Record<string, { count: number; name: string; type: string }> = {};

  events.forEach((e) => {
    if (e.metadata.facilityId) {
      const id = e.metadata.facilityId;
      if (!facilityCounts[id]) {
        facilityCounts[id] = {
          count: 0,
          name: e.metadata.facilityName || "Unknown",
          type: e.metadata.facilityType || "unknown",
        };
      }
      facilityCounts[id].count++;
    }
  });

  return Object.entries(facilityCounts)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
