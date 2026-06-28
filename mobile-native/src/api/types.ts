/**
 * Wire types for the live Tabula Medica backend (Express, /api/*).
 * These mirror the response shapes in:
 *   - server/mobile-api-routes.ts  (mobile auth, records, packets, share links, EHR)
 *   - server/routes/gdpr-routes.ts (data-rights / account deletion)
 *
 * NO_CDS compliance footer is attached to most clinical responses; we model
 * it but never surface it as clinical advice (this is a PHR, not CDS).
 */

export interface NoCdsCompliance {
  disclaimer: string;
  notForClinicalDecisionMaking: boolean;
  generatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
}

export interface GcipSessionResponse {
  user: { id: string; email: string; name: string; role: string };
  needsOnboarding: boolean | null;
}

export interface MeResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  noCdsCompliance?: NoCdsCompliance;
}

// ─── Records ────────────────────────────────────────────────────────────────

export type TimelineEventType =
  | "encounter"
  | "observation"
  | "medication"
  | "condition"
  | "procedure"
  | "immunization";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description: string;
  date: string;
  provider?: string;
}

export interface TimelineResponse {
  events: TimelineEvent[];
  total: number;
  hasMore: boolean;
  noCdsCompliance?: NoCdsCompliance;
}

export interface RecordsSummary {
  conditions: { total: number; active: number; resolved: number };
  medications: { total: number; active: number; stopped: number };
  labResults: { total: number; recent: number; abnormal: number };
  vitals: { lastRecorded: string; recentCount: number };
  immunizations: { total: number; upToDate: boolean };
  appointments: { upcoming: number; past: number };
  lastUpdated: string;
  noCdsCompliance?: NoCdsCompliance;
}

export interface DashboardResponse {
  upcomingAppointments: number;
  activeMedications: number;
  recentConditions: number;
  unreadMessages: number;
  recentLabs: number;
  lastSync: string;
  noCdsCompliance?: NoCdsCompliance;
}

// ─── Share links ────────────────────────────────────────────────────────────

export interface ShareLink {
  id: string;
  url: string;
  accessCode?: string;
  expiresAt: string;
  isExpired: boolean;
  createdAt: string;
}

export interface CreateShareLinkInput {
  expiresInHours?: number;
  includeConditions?: boolean;
  includeMedications?: boolean;
  includeLabResults?: boolean;
}

// ─── GDPR / data rights ─────────────────────────────────────────────────────

export type DataRightsType =
  | "access"
  | "portability"
  | "erasure"
  | "rectification"
  | "do_not_sell"
  | "limit_sensitive"
  | "opt_out_automated_decisions";

export interface DataRightsRequest {
  id: string;
  accountId: string;
  type: DataRightsType;
  framework: "gdpr" | "ccpa";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  notes: string | null;
  scheduledFor: string | null;
  requestedAt: string;
  completedAt?: string | null;
}

export interface PrivacyPreferences {
  accountId: string;
  aiProcessingOptOut: boolean;
  marketingEmailsOptOut: boolean;
  analyticsOptOut: boolean;
  doNotSell: boolean;
  limitSensitivePi: boolean;
  optOutAutomatedDecisions: boolean;
  updatedAt: string;
}

export interface ErasureResponse {
  request: DataRightsRequest;
  graceDays: number;
  scheduledFor: string;
  message: string;
}

// ─── Generic API error ──────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
