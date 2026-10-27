import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { useSubscription, presentPaywall } from "@/lib/revenuecat";

interface GatedResponse<T = any> {
  gated: boolean;
  tier: string;
  requiredTier?: string;
  upgradeMessage?: string;
  showPaywall?: boolean;
  preview?: Partial<T>;
  data?: T;
}

interface SummarySections {
  activeConditions: string;
  medications: string;
  recentLabs: string;
  allergies: string;
  procedures: string;
  immunizations: string;
  upcomingCarePlans: string;
}

export interface DeduplicatedSummary {
  summary: string;
  sections: SummarySections;
  resourceCounts: Record<string, number>;
  duplicatesRemoved: number;
  provider: string;
  disclaimer: string;
  generatedAt: string;
}

export type SummaryResult =
  | { status: "full"; data: DeduplicatedSummary }
  | { status: "preview"; preview: Partial<DeduplicatedSummary>; upgradeMessage: string }
  | { status: "upgraded"; data: DeduplicatedSummary }
  | { status: "cancelled" };

export function useGatedSummary() {
  const { isSubscribed } = useSubscription();
  const queryClient = useQueryClient();

  const mutation = useMutation<SummaryResult, Error, string>({
    mutationFn: async (patientId: string): Promise<SummaryResult> => {
      try {
        const res = await apiRequest("POST", `/api/ai-summary/patient/${patientId}`);
        const json: GatedResponse<DeduplicatedSummary> = await res.json();

        if (!json.gated && json.data) {
          return { status: "full", data: json.data };
        }

        return {
          status: "preview",
          preview: json.preview || {},
          upgradeMessage: json.upgradeMessage || "Upgrade to Professional for full summaries.",
        };
      } catch (err: any) {
        const errorText = err.message || "";
        if (errorText.includes("403")) {
          const previewRes = await apiRequest("POST", `/api/ai-summary/patient/${patientId}/preview`);
          const previewJson: GatedResponse<DeduplicatedSummary> = await previewRes.json();

          const purchased = await presentPaywall();

          if (purchased) {
            queryClient.invalidateQueries({ queryKey: ["revenuecat", "customer-info"] });
            const fullRes = await apiRequest("POST", `/api/ai-summary/patient/${patientId}`);
            const fullJson: GatedResponse<DeduplicatedSummary> = await fullRes.json();

            if (!fullJson.gated && fullJson.data) {
              return { status: "upgraded", data: fullJson.data };
            }
          }

          return {
            status: "preview",
            preview: previewJson.preview || {},
            upgradeMessage: previewJson.upgradeMessage || "Upgrade to Professional for full summaries.",
          };
        }
        throw err;
      }
    },
  });

  return {
    generateSummary: mutation.mutateAsync,
    isGenerating: mutation.isPending,
    result: mutation.data ?? null,
    error: mutation.error,
    reset: mutation.reset,
    isSubscribed,
  };
}
