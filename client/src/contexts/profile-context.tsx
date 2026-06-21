import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { 
  Profile, 
  ExtendedProfile, 
  ProfileMemberRole, 
  ProfileAccessScope,
  ProfileTag,
} from "@shared/schema";

interface ActiveProfileData {
  profile: Profile;
  tags: ProfileTag[];
  role: ProfileMemberRole;
  accessScopes: ProfileAccessScope[];
}

interface ProfileContextValue {
  profiles: ExtendedProfile[];
  activeProfile: Profile | null;
  activeTags: ProfileTag[];
  activeRole: ProfileMemberRole;
  activeScopes: ProfileAccessScope[];
  isLoading: boolean;
  isProfilesLoading: boolean;
  switchProfile: (profileId: string) => Promise<void>;
  hasAccess: (scope: ProfileAccessScope) => boolean;
  refreshProfiles: () => void;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [activeProfileData, setActiveProfileData] = useState<ActiveProfileData | null>(null);

  const { 
    data: profiles = [], 
    isLoading: isProfilesLoading,
    refetch: refreshProfiles,
  } = useQuery<ExtendedProfile[]>({
    queryKey: ["/api/profiles"],
  });

  const { 
    data: activeData, 
    isLoading: isActiveLoading,
  } = useQuery<ActiveProfileData>({
    queryKey: ["/api/profiles/active"],
    retry: false,
  });

  useEffect(() => {
    if (activeData) {
      setActiveProfileData(activeData);
    }
  }, [activeData]);

  const switchMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const response = await apiRequest("POST", `/api/profiles/switch/${profileId}`);
      return response.json();
    },
    onSuccess: async (data, profileId) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/profiles/active"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      
      const profile = profiles.find(p => p.id === profileId);
      if (profile) {
        setActiveProfileData({
          profile,
          tags: profile.tags || [],
          role: data.role,
          accessScopes: data.accessScopes,
        });
      }
    },
  });

  const switchProfile = useCallback(async (profileId: string) => {
    await switchMutation.mutateAsync(profileId);
  }, [switchMutation]);

  const hasAccess = useCallback((scope: ProfileAccessScope): boolean => {
    if (!activeProfileData) return false;
    const scopes = activeProfileData.accessScopes;
    return scopes.includes("all") || scopes.includes(scope);
  }, [activeProfileData]);

  const value: ProfileContextValue = {
    profiles,
    activeProfile: activeProfileData?.profile || null,
    activeTags: activeProfileData?.tags || [],
    activeRole: activeProfileData?.role || "owner",
    activeScopes: activeProfileData?.accessScopes || ["all"],
    isLoading: isActiveLoading || switchMutation.isPending,
    isProfilesLoading,
    switchProfile,
    hasAccess,
    refreshProfiles,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}

export function useActiveProfile() {
  const { activeProfile, activeTags, activeRole, activeScopes, hasAccess } = useProfile();
  return { profile: activeProfile, tags: activeTags, role: activeRole, scopes: activeScopes, hasAccess };
}

export function useProfiles() {
  const { profiles, isProfilesLoading, refreshProfiles } = useProfile();
  return { profiles, isLoading: isProfilesLoading, refresh: refreshProfiles };
}
