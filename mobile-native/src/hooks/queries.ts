/**
 * React Query hooks. Centralizes query keys + fetchers so screens stay thin
 * and caches share consistently (e.g. the records list + detail read the same
 * timeline cache).
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchMe } from "@/api/auth";
import {
  getDashboard,
  getRecordsSummary,
  getTimeline,
  type TimelineQuery,
} from "@/api/records";
import {
  cancelAccountDeletion,
  getDataRightsRequests,
  getDpoContact,
  getPrivacyPreferences,
  requestAccountDeletion,
  requestDataExport,
  updateProcessingPrefs,
  type ProcessingPrefKey,
} from "@/api/gdpr";
import { createShareLink, listShareLinks, revokeShareLink } from "@/api/share";

export const queryKeys = {
  me: ["me"] as const,
  dashboard: ["dashboard"] as const,
  summary: ["records", "summary"] as const,
  timeline: (q: TimelineQuery) => ["records", "timeline", q] as const,
  shareLinks: ["share-links"] as const,
  privacyPrefs: ["gdpr", "preferences"] as const,
  dataRights: ["gdpr", "requests"] as const,
  dpo: ["gdpr", "dpo"] as const,
};

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: fetchMe });
}

export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: getDashboard });
}

export function useRecordsSummary() {
  return useQuery({ queryKey: queryKeys.summary, queryFn: getRecordsSummary });
}

export function useTimeline(query: TimelineQuery = {}) {
  return useQuery({
    queryKey: queryKeys.timeline(query),
    queryFn: () => getTimeline(query),
  });
}

export function useShareLinks() {
  return useQuery({ queryKey: queryKeys.shareLinks, queryFn: listShareLinks });
}

export function useCreateShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createShareLink,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shareLinks }),
  });
}

export function useRevokeShareLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: revokeShareLink,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.shareLinks }),
  });
}

export function usePrivacyPreferences() {
  return useQuery({ queryKey: queryKeys.privacyPrefs, queryFn: getPrivacyPreferences });
}

export function useDataRightsRequests() {
  return useQuery({ queryKey: queryKeys.dataRights, queryFn: getDataRightsRequests });
}

export function useDpoContact() {
  return useQuery({ queryKey: queryKeys.dpo, queryFn: getDpoContact });
}

export function useUpdateProcessingPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Record<ProcessingPrefKey, boolean>>) =>
      updateProcessingPrefs(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.privacyPrefs }),
  });
}

export function useRequestDataExport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => requestDataExport("gdpr"),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.dataRights }),
  });
}

export function useRequestAccountDeletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => requestAccountDeletion("gdpr"),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.dataRights }),
  });
}

export function useCancelAccountDeletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelAccountDeletion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.dataRights }),
  });
}
