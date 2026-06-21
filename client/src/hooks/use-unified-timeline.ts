import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { TimelineEventWithSource } from "@/components/timeline-shared";

interface UnifiedSummaryResponse {
  events: TimelineEventWithSource[];
  narrative: string | null;
}

interface UseUnifiedTimelineOptions {
  includeNarrative?: boolean;
  enabled?: boolean;
  autoRefresh?: boolean;
}

export function useUnifiedTimeline({
  includeNarrative = false,
  enabled = true,
  autoRefresh = false,
}: UseUnifiedTimelineOptions = {}) {
  const queryClient = useQueryClient();

  const eventsQuery = useQuery<UnifiedSummaryResponse>({
    queryKey: ['/api/unified-summary', { narrative: false }],
    queryFn: async () => {
      const res = await fetch('/api/unified-summary', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch timeline data');
      return res.json();
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: autoRefresh ? 60_000 : false,
    refetchOnWindowFocus: autoRefresh,
  });

  const narrativeQuery = useQuery<UnifiedSummaryResponse>({
    queryKey: ['/api/unified-summary', { narrative: true }],
    queryFn: async () => {
      const res = await fetch('/api/unified-summary?narrative=true', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to generate narrative');
      return res.json();
    },
    enabled: enabled && includeNarrative,
    staleTime: 5 * 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const regenerateNarrative = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/unified-summary', { narrative: true }] });
  }, [queryClient]);

  return {
    events: eventsQuery.data?.events ?? [],
    narrative: narrativeQuery.data?.narrative ?? null,
    isLoading: eventsQuery.isLoading,
    isFetching: eventsQuery.isFetching,
    isNarrativeLoading: narrativeQuery.isLoading || narrativeQuery.isFetching,
    error: eventsQuery.error,
    refetch: eventsQuery.refetch,
    regenerateNarrative,
  };
}
