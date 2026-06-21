import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Users,
  Baby,
  Heart,
  Plus,
  Settings,
  Shield,
  Share2,
  Trash2,
  AlertTriangle,
  Check,
  Link as LinkIcon,
  Clock,
  Eye,
  Ribbon,
  Copy,
  Mail,
} from "lucide-react";
import { Link } from "wouter";
import type { 
  ExtendedProfile, 
  ProfileMemberSummary,
  ProfileShareLink,
  BreakGlassEvent,
  ProfileTypeValue,
  ProfileTag,
  ProfileMemberRole,
} from "@shared/schema";
import { getInitials } from "@/components/shared";
import { formatDate } from "@/components/shared/format-helpers";

const profileTypeIcons: Record<ProfileTypeValue, typeof User> = {
  self: User,
  child: Baby,
  dependent_adult: Users,
  elder: Heart,
};

const profileTypeLabels: Record<ProfileTypeValue, string> = {
  self: "Self",
  child: "Child (Minor)",
  dependent_adult: "Dependent Adult",
  elder: "Elder Care",
};

const roleLabels: Record<ProfileMemberRole, string> = {
  owner: "Owner",
  caregiver_full: "Full Caregiver",
  caregiver_limited: "Limited Caregiver",
  clinician_readonly: "Read-only Clinician",
  emergency_access: "Emergency Access",
};

const tagLabels: Record<ProfileTag, string> = {
  cancer_survivorship: "Cancer Survivorship",
  chronic_condition: "Chronic Condition",
  pregnancy: "Pregnancy",
  mental_health: "Mental Health",
  post_surgery: "Post-Surgery",
};

function ProfileCard({ profile, onSelect }: { profile: ExtendedProfile; onSelect: () => void }) {
  const Icon = profileTypeIcons[profile.profileType] || User;

  return (
    <Card 
      className="hover-elevate cursor-pointer" 
      onClick={onSelect}
      data-testid={`card-profile-${profile.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            {profile.profileImageUrl ? (
              <AvatarImage src={profile.profileImageUrl} alt={profile.firstName} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary">
              {getInitials(profile.firstName, profile.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">
                {profile.firstName} {profile.lastName}
              </h3>
              {profile.isDefault && (
                <Badge variant="secondary" className="text-xs">Default</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Icon className="h-4 w-4" />
              <span>{profileTypeLabels[profile.profileType]}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {profile.tags?.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs flex items-center gap-1">
                  <Ribbon className="h-3 w-3" />
                  {tagLabels[tag]}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {profile.hasEmergencyAccess && (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Emergency
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {profile.memberCount} member{profile.memberCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileDetails({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [emergencyDialogOpen, setEmergencyDialogOpen] = useState(false);

  const { data: profiles = [] } = useQuery<ExtendedProfile[]>({
    queryKey: ["/api/profiles"],
  });

  const profile = profiles.find(p => p.id === profileId);

  const { data: members = [], isLoading: membersLoading } = useQuery<ProfileMemberSummary[]>({
    queryKey: ["/api/profiles", profileId, "members"],
    enabled: !!profileId,
  });

  const { data: shareLinks = [] } = useQuery<ProfileShareLink[]>({
    queryKey: ["/api/profiles", profileId, "share-links"],
    enabled: !!profileId,
  });

  const { data: breakGlassEvents = [] } = useQuery<BreakGlassEvent[]>({
    queryKey: ["/api/profiles", profileId, "break-glass/events"],
    enabled: !!profileId,
  });

  const createShareLinkMutation = useMutation({
    mutationFn: async (data: { expiresAt: string; recipientName?: string; recipientEmail?: string }) => {
      const response = await apiRequest("POST", `/api/profiles/${profileId}/share-link`, data);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles", profileId, "share-links"] });
      toast({
        title: "Share link created",
        description: "The link has been copied to your clipboard.",
      });
      navigator.clipboard.writeText(window.location.origin + data.shareUrl);
      setShareDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Failed to create share link",
        variant: "destructive",
      });
    },
  });

  const setupEmergencyMutation = useMutation({
    mutationFn: async (data: { pin: string; accessDurationMinutes: number }) => {
      const response = await apiRequest("POST", `/api/profiles/${profileId}/break-glass/setup`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      toast({
        title: "Emergency access configured",
        description: "You can now share your PIN with trusted individuals.",
      });
      setEmergencyDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Failed to configure emergency access",
        variant: "destructive",
      });
    },
  });

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Select a profile to view details
      </div>
    );
  }

  const Icon = profileTypeIcons[profile.profileType] || User;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {profile.profileImageUrl ? (
              <AvatarImage src={profile.profileImageUrl} alt={profile.firstName} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-primary text-xl">
              {getInitials(profile.firstName, profile.lastName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-semibold">
              {profile.firstName} {profile.lastName}
            </h2>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4" />
              <span>{profileTypeLabels[profile.profileType]}</span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" data-testid="button-edit-profile">
          <Settings className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </div>

      {profile.tags && profile.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {profile.tags.map(tag => (
            <Badge key={tag} variant="secondary" className="flex items-center gap-1">
              <Ribbon className="h-3 w-3" />
              {tagLabels[tag]}
            </Badge>
          ))}
        </div>
      )}

      <Separator />

      <Tabs defaultValue="members" className="w-full">
        <TabsList>
          <TabsTrigger value="members" data-testid="tab-members">
            <Users className="h-4 w-4 mr-2" />
            Members ({members.length})
          </TabsTrigger>
          <TabsTrigger value="sharing" data-testid="tab-sharing">
            <Share2 className="h-4 w-4 mr-2" />
            Sharing ({shareLinks.filter(l => l.isActive).length})
          </TabsTrigger>
          <TabsTrigger value="emergency" data-testid="tab-emergency">
            <Shield className="h-4 w-4 mr-2" />
            Emergency
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Profile Members</h3>
              <Button size="sm" data-testid="button-invite-member">
                <Plus className="h-4 w-4 mr-2" />
                Invite
              </Button>
            </div>

            {membersLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : (
              <ScrollArea className="h-64">
                <div className="space-y-2">
                  {members.map(member => (
                    <div 
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      data-testid={`member-${member.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="text-xs">
                            {member.userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.userName}</p>
                          <p className="text-sm text-muted-foreground">
                            {member.userEmail || "No email"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                          {roleLabels[member.role]}
                        </Badge>
                        {member.expiresAt && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Expires {formatDate(member.expiresAt)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sharing" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Share Links</h3>
              <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-create-share-link">
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Create Link
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Share Link</DialogTitle>
                    <DialogDescription>
                      Create a time-limited link to share this profile with a clinician or caregiver.
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      const days = parseInt(formData.get("days") as string) || 7;
                      const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
                      createShareLinkMutation.mutate({
                        expiresAt,
                        recipientName: formData.get("recipientName") as string,
                        recipientEmail: formData.get("recipientEmail") as string,
                      });
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="recipientName">Recipient Name</Label>
                      <Input
                        id="recipientName"
                        name="recipientName"
                        placeholder="Dr. Smith"
                        data-testid="input-recipient-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="recipientEmail">Recipient Email (optional)</Label>
                      <Input
                        id="recipientEmail"
                        name="recipientEmail"
                        type="email"
                        placeholder="doctor@clinic.com"
                        data-testid="input-recipient-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="days">Link expires in</Label>
                      <Select name="days" defaultValue="7">
                        <SelectTrigger data-testid="select-expiry-days">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 day</SelectItem>
                          <SelectItem value="3">3 days</SelectItem>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button 
                        type="submit" 
                        disabled={createShareLinkMutation.isPending}
                        data-testid="button-submit-share-link"
                      >
                        {createShareLinkMutation.isPending ? "Creating..." : "Create Link"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <ScrollArea className="h-64">
              <div className="space-y-2">
                {shareLinks.filter(l => l.isActive).map(link => (
                  <div 
                    key={link.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`share-link-${link.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-primary/10">
                        <LinkIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {link.recipientName || "Unnamed recipient"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {link.recipientEmail || "No email"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {link.viewCount} view{link.viewCount !== 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expires {formatDate(link.expiresAt)}
                      </Badge>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin + `/shared/${link.token}`);
                          toast({ title: "Link copied to clipboard" });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {shareLinks.filter(l => l.isActive).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <LinkIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No active share links</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        <TabsContent value="emergency" className="mt-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Emergency Access (Break Glass)</h3>
                <p className="text-sm text-muted-foreground">
                  Allow emergency responders to access critical health information with a PIN.
                </p>
              </div>
              <Dialog open={emergencyDialogOpen} onOpenChange={setEmergencyDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant={profile.hasEmergencyAccess ? "outline" : "default"} 
                    size="sm"
                    data-testid="button-setup-emergency"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    {profile.hasEmergencyAccess ? "Update" : "Enable"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-amber-500" />
                      Configure Emergency Access
                    </DialogTitle>
                    <DialogDescription>
                      Set a PIN that emergency responders can use to access critical health information
                      like medications, allergies, and diagnoses.
                    </DialogDescription>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      setupEmergencyMutation.mutate({
                        pin: formData.get("pin") as string,
                        accessDurationMinutes: parseInt(formData.get("duration") as string) || 30,
                      });
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label htmlFor="pin">Emergency PIN (4-8 digits)</Label>
                      <Input
                        id="pin"
                        name="pin"
                        type="password"
                        minLength={4}
                        maxLength={8}
                        pattern="[0-9]*"
                        placeholder="Enter PIN"
                        required
                        data-testid="input-emergency-pin"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration">Access Duration</Label>
                      <Select name="duration" defaultValue="30">
                        <SelectTrigger data-testid="select-access-duration">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                          <SelectItem value="120">2 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <div className="flex gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800 dark:text-amber-200">
                          <p className="font-medium">Important</p>
                          <p>Only share this PIN with trusted individuals who may need emergency access to your health information.</p>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        type="submit" 
                        disabled={setupEmergencyMutation.isPending}
                        data-testid="button-save-emergency"
                      >
                        {setupEmergencyMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {profile.hasEmergencyAccess && (
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <Check className="h-4 w-4" />
                  <span className="font-medium">Emergency access is enabled</span>
                </div>
              </div>
            )}

            <Separator />

            <div>
              <h4 className="font-medium mb-3">Emergency Access Log</h4>
              <ScrollArea className="h-48">
                <div className="space-y-2">
                  {breakGlassEvents.map(event => (
                    <div 
                      key={event.id}
                      className="flex items-start justify-between p-3 rounded-lg bg-muted/50"
                      data-testid={`emergency-event-${event.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                          <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="font-medium">{event.accessedByName}</p>
                          <p className="text-sm text-muted-foreground">{event.reason}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(event.accessGrantedAt)}
                          </p>
                        </div>
                      </div>
                      {event.accessRevokedAt ? (
                        <Badge variant="secondary">Revoked</Badge>
                      ) : new Date(event.accessExpiresAt) < new Date() ? (
                        <Badge variant="secondary">Expired</Badge>
                      ) : (
                        <Badge variant="default">Active</Badge>
                      )}
                    </div>
                  ))}
                  {breakGlassEvents.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No emergency access events</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ProfilesPage() {
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const { data: profiles = [], isLoading } = useQuery<ExtendedProfile[]>({
    queryKey: ["/api/profiles"],
  });

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Profiles</h1>
          <p className="text-muted-foreground">
            Manage your health profiles and share access with caregivers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button data-testid="button-add-profile">
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
          <Button variant="outline" asChild data-testid="button-export-profiles">
            <Link href="/care-packets">
              <Share2 className="h-4 w-4 mr-2" />
              Export
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Your Profiles
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : (
            <div className="space-y-3">
              {profiles.map(profile => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  onSelect={() => setSelectedProfileId(profile.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Profile Details</CardTitle>
              <CardDescription>
                View and manage profile members, sharing, and emergency access
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedProfileId ? (
                <ProfileDetails profileId={selectedProfileId} />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <User className="h-12 w-12 mb-3 opacity-50" />
                  <p>Select a profile to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
