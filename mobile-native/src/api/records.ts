/**
 * Health records endpoints (server/mobile-api-routes.ts).
 *
 * NOTE: several of these backend routes currently return representative
 * fixture data (timeline/summary/dashboard) while the real aggregation +
 * de-dup pipeline is wired in. The client treats them as the source of
 * truth — when the backend swaps to live data, no client change is needed.
 */
import { api } from "./client";
import type {
  DashboardResponse,
  RecordsSummary,
  TimelineEvent,
  TimelineResponse,
} from "./types";

export interface TimelineQuery {
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export async function getTimeline(query: TimelineQuery = {}): Promise<TimelineResponse> {
  const params = new URLSearchParams();
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  params.set("limit", String(query.limit ?? 50));
  params.set("offset", String(query.offset ?? 0));
  return api.get<TimelineResponse>(`/api/records/timeline?${params.toString()}`);
}

export async function getRecordsSummary(): Promise<RecordsSummary> {
  return api.get<RecordsSummary>("/api/records/summary");
}

export async function getDashboard(): Promise<DashboardResponse> {
  return api.get<DashboardResponse>("/api/dashboard");
}

/**
 * The mobile timeline doubles as the "records list": each event is a record
 * the patient can open. Detail is resolved client-side from the timeline
 * cache by id (the backend exposes events, not a per-id record endpoint yet).
 */
export function findEventById(
  events: TimelineEvent[] | undefined,
  id: string
): TimelineEvent | undefined {
  return events?.find((e) => e.id === id);
}
