import { createContext, useContext, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

export interface AIPreferences {
  userId: string;
  aiExplanationsEnabled: boolean;
  aiSummariesEnabled: boolean;
  updatedAt: string | null;
}

interface AIPreferencesContextValue {
  preferences: AIPreferences | null;
  isLoading: boolean;
  aiExplanationsEnabled: boolean;
  aiSummariesEnabled: boolean;
  updatePreferences: (updates: Partial<Pick<AIPreferences, "aiExplanationsEnabled" | "aiSummariesEnabled">>) => void;
  isUpdating: boolean;
}

const AIPreferencesContext = createContext<AIPreferencesContextValue | undefined>(undefined);

export function AIPreferencesProvider({ children }: { children: React.ReactNode }) {
  const { data: preferences, isLoading } = useQuery<AIPreferences>({
    queryKey: ["/api/ai-preferences"],
    staleTime: 60000,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<AIPreferences>) => {
      const response = await apiRequest("PUT", "/api/ai-preferences", updates);
      if (!response.ok) throw new Error("Failed to update AI preferences");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-preferences"] });
    },
  });

  const value = useMemo<AIPreferencesContextValue>(() => ({
    preferences: preferences || null,
    isLoading,
    aiExplanationsEnabled: preferences?.aiExplanationsEnabled ?? true,
    aiSummariesEnabled: preferences?.aiSummariesEnabled ?? true,
    updatePreferences: (updates) => updateMutation.mutate(updates),
    isUpdating: updateMutation.isPending,
  }), [preferences, isLoading, updateMutation.isPending]);

  return (
    <AIPreferencesContext.Provider value={value}>
      {children}
    </AIPreferencesContext.Provider>
  );
}

export function useAIPreferences() {
  const context = useContext(AIPreferencesContext);
  if (context === undefined) {
    throw new Error("useAIPreferences must be used within an AIPreferencesProvider");
  }
  return context;
}

export function useAIExplanationsEnabled() {
  const { aiExplanationsEnabled, isLoading } = useAIPreferences();
  return { enabled: aiExplanationsEnabled, isLoading };
}

export function useAISummariesEnabled() {
  const { aiSummariesEnabled, isLoading } = useAIPreferences();
  return { enabled: aiSummariesEnabled, isLoading };
}

interface AIFeatureGateProps {
  feature: "explanations" | "summaries";
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AIFeatureGate({ feature, children, fallback = null }: AIFeatureGateProps) {
  const { aiExplanationsEnabled, aiSummariesEnabled, isLoading } = useAIPreferences();

  if (isLoading) {
    return null;
  }

  const isEnabled = feature === "explanations" ? aiExplanationsEnabled : aiSummariesEnabled;

  if (!isEnabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
