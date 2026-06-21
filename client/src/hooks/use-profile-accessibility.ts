import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccessibility } from "@/components/accessibility-provider";
import { apiRequest } from "@/lib/queryClient";

interface ProfileAccessibilitySettings {
  id: string;
  profileId: string;
  simplifiedMode: boolean;
  largeText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: "normal" | "large" | "extra-large";
  simpleLanguage: boolean;
  screenReaderOptimized: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useProfileAccessibility(profileId: string | null) {
  const queryClient = useQueryClient();
  const { settings: globalSettings, updateSetting } = useAccessibility();

  const { data: profileSettings, isLoading } = useQuery<ProfileAccessibilitySettings>({
    queryKey: ["/api/profiles", profileId, "accessibility"],
    enabled: !!profileId,
  });

  const toggleSimplifiedMode = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!profileId) throw new Error("No profile selected");
      return apiRequest("PATCH", `/api/profiles/${profileId}/accessibility/simplified-mode`, {
        enabled,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles", profileId, "accessibility"] });
    },
  });

  const updateProfileSettings = useMutation({
    mutationFn: async (settings: Partial<ProfileAccessibilitySettings>) => {
      if (!profileId) throw new Error("No profile selected");
      return apiRequest("PUT", `/api/profiles/${profileId}/accessibility`, settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles", profileId, "accessibility"] });
    },
  });

  const effectiveSettings = {
    simplifiedMode: profileSettings?.simplifiedMode ?? globalSettings.simplifiedView,
    largeText: profileSettings?.largeText ?? globalSettings.largeText,
    highContrast: profileSettings?.highContrast ?? globalSettings.highContrast,
    reducedMotion: profileSettings?.reducedMotion ?? globalSettings.reducedMotion,
    fontSize: profileSettings?.fontSize ?? globalSettings.fontSize,
    simpleLanguage: profileSettings?.simpleLanguage ?? globalSettings.simpleLanguage,
    screenReaderOptimized: profileSettings?.screenReaderOptimized ?? globalSettings.screenReaderOptimized,
  };

  return {
    profileSettings,
    effectiveSettings,
    isLoading,
    toggleSimplifiedMode: toggleSimplifiedMode.mutate,
    updateProfileSettings: updateProfileSettings.mutate,
    isToggling: toggleSimplifiedMode.isPending,
    isUpdating: updateProfileSettings.isPending,
  };
}
