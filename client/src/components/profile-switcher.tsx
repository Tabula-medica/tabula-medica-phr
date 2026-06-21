import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  ChevronDown, 
  User, 
  Users, 
  Settings, 
  LogOut, 
  Baby, 
  Heart, 
  Plus,
  Check,
  Shield,
  Ribbon,
  Pill,
  Calendar,
  Syringe,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import type { 
  Profile, 
  ExtendedProfile, 
  ProfileTypeValue, 
  ProfileMemberRole,
  ProfileTag,
  ProfileSummary,
} from "@shared/schema";
import { getInitials } from "@/components/shared";

const profileTypeIcons: Record<ProfileTypeValue, typeof User> = {
  self: User,
  child: Baby,
  dependent_adult: Users,
  elder: Heart,
};

const profileTypeLabels: Record<ProfileTypeValue, string> = {
  self: "Self",
  child: "Child",
  dependent_adult: "Dependent",
  elder: "Elder",
};

const roleLabels: Record<ProfileMemberRole, string> = {
  owner: "Owner",
  caregiver_full: "Full Access",
  caregiver_limited: "Limited Access",
  clinician_readonly: "Read-only",
  emergency_access: "Emergency",
};

interface ActiveProfileResponse {
  profile: Profile;
  tags: ProfileTag[];
  role: ProfileMemberRole;
  accessScopes: string[];
}

export function ProfileSwitcher() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: profiles = [], isLoading: isProfilesLoading } = useQuery<ExtendedProfile[]>({
    queryKey: ["/api/profiles"],
  });

  const { data: activeData, isLoading: isActiveLoading } = useQuery<ActiveProfileResponse>({
    queryKey: ["/api/profiles/active"],
    retry: false,
  });

  const switchMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const response = await apiRequest("POST", `/api/profiles/switch/${profileId}`);
      return response.json();
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/profiles/active"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      toast({
        title: "Profile switched",
        description: "You are now viewing a different health profile.",
      });
      setOpen(false);
    },
    onError: () => {
      toast({
        title: "Failed to switch profile",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSwitch = async (profileId: string) => {
    if (profileId !== activeData?.profile?.id) {
      await switchMutation.mutateAsync(profileId);
    } else {
      setOpen(false);
    }
  };

  if (isProfilesLoading || isActiveLoading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-4 w-20 hidden sm:block" />
      </div>
    );
  }

  const activeProfile = activeData?.profile;
  const activeTags = activeData?.tags || [];
  const activeRole = activeData?.role || "owner";

  if (!activeProfile) {
    return (
      <Button variant="ghost" size="sm" className="gap-2" data-testid="button-profile-switcher">
        <User className="h-4 w-4" />
        <span className="hidden sm:inline">No Profile</span>
      </Button>
    );
  }

  const ProfileIcon = profileTypeIcons[activeProfile.profileType] || User;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-2 px-2"
          disabled={switchMutation.isPending}
          data-testid="button-profile-switcher"
        >
          <Avatar className="h-6 w-6">
            {activeProfile.profileImageUrl ? (
              <AvatarImage src={activeProfile.profileImageUrl} alt={activeProfile.firstName} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {getInitials(activeProfile.firstName, activeProfile.lastName)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden sm:inline text-sm font-medium max-w-[100px] truncate">
            {activeProfile.firstName}
          </span>
          {activeTags.length > 0 && (
            <Badge variant="secondary" className="hidden md:flex h-4 px-1 text-[10px]">
              <Ribbon className="h-2.5 w-2.5" />
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Health Profiles</span>
          {activeRole !== "owner" && (
            <Badge variant="outline" className="text-xs">
              {roleLabels[activeRole]}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {profiles.map((profile) => {
          const Icon = profileTypeIcons[profile.profileType] || User;
          const isActive = profile.id === activeProfile?.id;

          return (
            <DropdownMenuItem 
              key={profile.id}
              onClick={() => handleSwitch(profile.id)}
              className="gap-3 cursor-pointer"
              data-testid={`profile-${profile.id}`}
            >
              <Avatar className="h-8 w-8">
                {profile.profileImageUrl ? (
                  <AvatarImage src={profile.profileImageUrl} alt={profile.firstName} />
                ) : null}
                <AvatarFallback className={`text-xs ${isActive ? "bg-primary/20 text-primary" : "bg-muted"}`}>
                  {getInitials(profile.firstName, profile.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">
                    {profile.firstName} {profile.lastName}
                  </span>
                  {isActive && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="h-3 w-3" />
                  <span>{profileTypeLabels[profile.profileType]}</span>
                  {profile.tags && profile.tags.length > 0 && (
                    <Badge variant="secondary" className="px-1 py-0 text-[10px] h-4">
                      {profile.tags.length} tag{profile.tags.length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </div>
              </div>
              {profile.hasEmergencyAccess && (
                <span title="Emergency access enabled">
                  <Shield className="h-4 w-4 text-amber-500 flex-shrink-0" />
                </span>
              )}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        <Link href="/profiles/new">
          <DropdownMenuItem className="gap-3 cursor-pointer" data-testid="menu-add-profile">
            <Plus className="h-4 w-4" />
            Add Profile
          </DropdownMenuItem>
        </Link>

        <Link href="/profiles">
          <DropdownMenuItem className="gap-3 cursor-pointer" data-testid="menu-manage-profiles">
            <Settings className="h-4 w-4" />
            Manage Profiles
          </DropdownMenuItem>
        </Link>

        <Link href="/caregivers">
          <DropdownMenuItem className="gap-3 cursor-pointer" data-testid="menu-caregivers">
            <Users className="h-4 w-4" />
            Manage Caregivers
          </DropdownMenuItem>
        </Link>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="gap-3 text-muted-foreground cursor-pointer" data-testid="menu-logout">
          <LogOut className="h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ActiveProfileIndicator() {
  const { data: activeData } = useQuery<ActiveProfileResponse>({
    queryKey: ["/api/profiles/active"],
    retry: false,
  });

  if (!activeData?.profile) {
    return null;
  }

  const { profile, tags, role } = activeData;
  const ProfileIcon = profileTypeIcons[profile.profileType] || User;

  return (
    <div 
      className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-md border border-primary/10"
      data-testid="active-profile-indicator"
    >
      <ProfileIcon className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium">
        {profile.firstName} {profile.lastName}
      </span>
      <Badge variant="secondary" className="text-xs">
        {profileTypeLabels[profile.profileType]}
      </Badge>
      {role !== "owner" && (
        <Badge variant="outline" className="text-xs">
          {roleLabels[role]}
        </Badge>
      )}
      {tags.length > 0 && (
        <Badge variant="secondary" className="text-xs flex items-center gap-1">
          <Ribbon className="h-3 w-3" />
          {tags.length}
        </Badge>
      )}
    </div>
  );
}

interface ProfileSwitcherSheetProps {
  currentProfileId?: string;
  onProfileSelect?: (profileId: string) => void;
  trigger: React.ReactNode;
}

export function ProfileSwitcherSheet({ currentProfileId, onProfileSelect, trigger }: ProfileSwitcherSheetProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: profiles, isLoading } = useQuery<ProfileSummary[]>({
    queryKey: ["/api/profiles/summaries"],
  });

  const switchMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const response = await apiRequest("POST", `/api/profiles/switch/${profileId}`);
      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/profiles/active"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/profiles/summaries"] });
      toast({
        title: "Profile switched",
        description: "You are now viewing a different health profile.",
      });
      setOpen(false);
    },
    onError: () => {
      toast({
        title: "Failed to switch profile",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleProfileSelect = (profileId: string) => {
    if (profileId !== currentProfileId) {
      switchMutation.mutate(profileId);
    } else {
      setOpen(false);
    }
    onProfileSelect?.(profileId);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent 
        side="bottom" 
        className="h-[85vh] sm:h-[70vh] rounded-t-2xl flex flex-col"
        data-testid="profile-switcher-sheet"
      >
        <SheetHeader className="flex flex-row items-center justify-between pb-4 border-b shrink-0">
          <SheetTitle className="text-xl font-semibold">Profiles</SheetTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="min-h-[44px] min-w-[44px] gap-2"
            asChild
            data-testid="button-add-profile"
          >
            <Link href="/profiles/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add Profile
            </Link>
          </Button>
        </SheetHeader>

        <div className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground bg-muted/50 rounded-md mt-2 shrink-0">
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Educational only. NOT medical advice. Consult your healthcare provider.</span>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-2">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : profiles && profiles.length > 0 ? (
            <div className="space-y-2">
              {profiles.map((profile) => (
                <ProfileSummaryCard
                  key={profile.id}
                  profile={profile}
                  isActive={profile.id === currentProfileId}
                  onSelect={() => handleProfileSelect(profile.id)}
                  isPending={switchMutation.isPending}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" aria-hidden="true" />
              <p className="text-muted-foreground">No profiles found</p>
              <Button 
                variant="outline" 
                className="mt-4 min-h-[44px]"
                asChild
                data-testid="button-create-first-profile"
              >
                <Link href="/profiles/new">
                  <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                  Create Your First Profile
                </Link>
              </Button>
            </div>
          )}
        </div>

        <SheetFooter className="flex flex-col gap-2 pt-4 border-t sm:flex-col shrink-0">
          <Button 
            variant="outline" 
            className="w-full min-h-[44px] justify-start gap-3"
            asChild
            data-testid="button-manage-caregiver-access"
          >
            <Link href="/caregivers">
              <Users className="h-5 w-5" aria-hidden="true" />
              Manage Caregiver Access
            </Link>
          </Button>
          <Button 
            variant="outline" 
            className="w-full min-h-[44px] justify-start gap-3"
            asChild
            data-testid="button-settings"
          >
            <Link href="/settings">
              <Settings className="h-5 w-5" aria-hidden="true" />
              Settings
            </Link>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ProfileSummaryCard({ 
  profile, 
  isActive, 
  onSelect,
  isPending,
}: { 
  profile: ProfileSummary; 
  isActive: boolean;
  onSelect: () => void;
  isPending?: boolean;
}) {
  const ProfileIcon = profileTypeIcons[profile.profileType] || User;

  return (
    <button
      onClick={onSelect}
      disabled={isPending}
      className={`w-full flex items-start gap-4 p-4 rounded-lg border text-left transition-colors min-h-[44px] hover-elevate active-elevate-2 ${
        isActive 
          ? "border-primary bg-primary/5" 
          : "border-border hover:border-primary/50"
      } ${isPending ? "opacity-50 cursor-not-allowed" : ""}`}
      data-testid={`profile-card-${profile.id}`}
      aria-current={isActive ? "true" : undefined}
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={profile.profileImageUrl || undefined} />
          <AvatarFallback className="text-sm font-medium">
            {getInitials(profile.firstName, profile.lastName)}
          </AvatarFallback>
        </Avatar>
        {isActive && (
          <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
            <Check className="h-3 w-3 text-primary-foreground" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">
            {profile.firstName} {profile.lastName}
          </span>
          <Badge 
            variant={profile.profileType === "self" ? "default" : "secondary"}
            className="text-xs"
          >
            <ProfileIcon className="h-3 w-3 mr-1" aria-hidden="true" />
            {profileTypeLabels[profile.profileType]}
          </Badge>
        </div>

        <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <Pill className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{profile.medsCount} med{profile.medsCount !== 1 ? "s" : ""}</span>
          </span>
          
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{profile.upcomingFollowUps} upcoming visit{profile.upcomingFollowUps !== 1 ? "s" : ""}</span>
          </span>

          {profile.hasVaccineRecord && (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <Syringe className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Vaccine record</span>
            </span>
          )}

          {profile.hasCancerTrack && (
            <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
              <Ribbon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Cancer Track</span>
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
