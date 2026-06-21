import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Check, ChevronRight, Edit2, Plus, Trash2, User, Users, Heart, UserCheck, Baby, UserPlus, Shield, Camera } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Profile, ProfileSummary } from "@shared/schema";
import { ProfilePhotoUpload } from "@/components/ProfilePhotoUpload";
import { getInitials } from "@/components/shared";

const RELATIONSHIP_LABELS: Record<string, { label: string; icon: typeof User; description: string }> = {
  self: { label: "Myself", icon: User, description: "Your personal health profile" },
  child: { label: "Child", icon: Baby, description: "Son, daughter, or minor dependent" },
  parent: { label: "Parent", icon: Users, description: "Mother or father" },
  spouse: { label: "Spouse", icon: Heart, description: "Husband, wife, or partner" },
  sibling: { label: "Sibling", icon: Users, description: "Brother or sister" },
  grandparent: { label: "Grandparent", icon: Users, description: "Grandmother or grandfather" },
  guardian: { label: "Guardian", icon: Shield, description: "Legal guardian" },
  other: { label: "Other", icon: UserPlus, description: "Other family member or dependent" },
};

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

function getRelationshipColor(relationship: string): string {
  const colors: Record<string, string> = {
    self: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
    child: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
    parent: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
    spouse: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100",
    sibling: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100",
    grandparent: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
    guardian: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100",
    other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100",
  };
  return colors[relationship] || colors.other;
}

export default function ProfileManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state for new profile
  const [newProfile, setNewProfile] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    relationship: "",
    notes: "",
    medicalRecordNumber: "",
    insuranceId: "",
    emergencyContact: "",
  });

  // Queries
  const { data: profiles = [], isLoading: profilesLoading } = useQuery<Profile[]>({
    queryKey: ["/api/profiles"],
  });

  const { data: activeProfile } = useQuery<Profile>({
    queryKey: ["/api/profiles/active"],
  });

  const { data: summaries = [] } = useQuery<ProfileSummary[]>({
    queryKey: ["/api/profiles/summaries"],
  });

  // Mutations
  const createProfileMutation = useMutation({
    mutationFn: async (data: typeof newProfile) => {
      const res = await apiRequest("POST", "/api/profiles", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/summaries"] });
      setIsAddDialogOpen(false);
      resetNewProfileForm();
      toast({
        title: "Profile Created",
        description: "The new family member profile has been added successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create profile",
        variant: "destructive",
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Profile> }) => {
      const res = await apiRequest("PATCH", `/api/profiles/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/summaries"] });
      setEditingProfile(null);
      toast({
        title: "Profile Updated",
        description: "Profile information has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/profiles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/summaries"] });
      setDeleteConfirmId(null);
      toast({
        title: "Profile Deleted",
        description: "The family member profile has been removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete profile",
        variant: "destructive",
      });
    },
  });

  const activateProfileMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/profiles/${id}/activate`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles/summaries"] });
      toast({
        title: "Profile Switched",
        description: "You are now viewing health records for the selected profile.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to switch profile",
        variant: "destructive",
      });
    },
  });

  const resetNewProfileForm = () => {
    setNewProfile({
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "",
      relationship: "",
      notes: "",
      medicalRecordNumber: "",
      insuranceId: "",
      emergencyContact: "",
    });
  };

  const handleCreateProfile = () => {
    if (!newProfile.firstName || !newProfile.lastName || !newProfile.relationship) {
      toast({
        title: "Required Fields",
        description: "Please fill in first name, last name, and relationship.",
        variant: "destructive",
      });
      return;
    }
    createProfileMutation.mutate(newProfile);
  };

  const handleUpdateProfile = () => {
    if (!editingProfile) return;
    updateProfileMutation.mutate({
      id: editingProfile.id,
      updates: {
        firstName: editingProfile.firstName,
        lastName: editingProfile.lastName,
        dateOfBirth: editingProfile.dateOfBirth,
        gender: editingProfile.gender,
        notes: editingProfile.notes,
        medicalRecordNumber: editingProfile.medicalRecordNumber,
        insuranceId: editingProfile.insuranceId,
        emergencyContact: editingProfile.emergencyContact,
      },
    });
  };

  if (profilesLoading) {
    return (
      <div className="container mx-auto p-4" data-testid="profile-management-loading">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6" data-testid="profile-management-page">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Family Health Records</h1>
          <p className="text-muted-foreground">
            Manage health profiles for yourself and your family members
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-profile">
              <Plus className="h-4 w-4 mr-2" />
              Add Family Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Family Member</DialogTitle>
              <DialogDescription>
                Create a new health profile for a family member or dependent
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    data-testid="input-first-name"
                    value={newProfile.firstName}
                    onChange={(e) => setNewProfile({ ...newProfile, firstName: e.target.value })}
                    placeholder="First name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    data-testid="input-last-name"
                    value={newProfile.lastName}
                    onChange={(e) => setNewProfile({ ...newProfile, lastName: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="relationship">Relationship *</Label>
                <Select
                  value={newProfile.relationship}
                  onValueChange={(value) => setNewProfile({ ...newProfile, relationship: value })}
                >
                  <SelectTrigger data-testid="select-relationship">
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RELATIONSHIP_LABELS)
                      .filter(([key]) => key !== "self")
                      .map(([value, { label, description }]) => (
                        <SelectItem key={value} value={value}>
                          <div className="flex flex-col">
                            <span>{label}</span>
                            <span className="text-xs text-muted-foreground">{description}</span>
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    data-testid="input-dob"
                    value={newProfile.dateOfBirth}
                    onChange={(e) => setNewProfile({ ...newProfile, dateOfBirth: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select
                    value={newProfile.gender}
                    onValueChange={(value) => setNewProfile({ ...newProfile, gender: value })}
                  >
                    <SelectTrigger data-testid="select-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  data-testid="input-notes"
                  value={newProfile.notes}
                  onChange={(e) => setNewProfile({ ...newProfile, notes: e.target.value })}
                  placeholder="Any additional information about this family member"
                  className="resize-none"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="medicalRecordNumber">Medical Record Number</Label>
                <Input
                  id="medicalRecordNumber"
                  data-testid="input-mrn"
                  value={newProfile.medicalRecordNumber}
                  onChange={(e) => setNewProfile({ ...newProfile, medicalRecordNumber: e.target.value })}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="insuranceId">Insurance ID</Label>
                <Input
                  id="insuranceId"
                  data-testid="input-insurance-id"
                  value={newProfile.insuranceId}
                  onChange={(e) => setNewProfile({ ...newProfile, insuranceId: e.target.value })}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="emergencyContact">Emergency Contact</Label>
                <Input
                  id="emergencyContact"
                  data-testid="input-emergency-contact"
                  value={newProfile.emergencyContact}
                  onChange={(e) => setNewProfile({ ...newProfile, emergencyContact: e.target.value })}
                  placeholder="Phone number or name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} data-testid="button-cancel-add">
                Cancel
              </Button>
              <Button 
                onClick={handleCreateProfile} 
                disabled={createProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                {createProfileMutation.isPending ? "Adding..." : "Add Profile"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Profile Card */}
      {activeProfile && (
        <Card className="border-primary" data-testid="card-active-profile">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Currently Viewing</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={activeProfile.profileImageUrl || undefined} />
                <AvatarFallback>{getInitials(activeProfile.firstName, activeProfile.lastName)}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium" data-testid="text-active-profile-name">
                  {activeProfile.firstName} {activeProfile.lastName}
                </p>
                <Badge className={getRelationshipColor(activeProfile.relationship)}>
                  {RELATIONSHIP_LABELS[activeProfile.relationship]?.label || activeProfile.relationship}
                </Badge>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <Check className="h-3 w-3" />
                Active
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profiles Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all" data-testid="tab-all-profiles">All Profiles ({profiles.length})</TabsTrigger>
          <TabsTrigger value="dependents" data-testid="tab-dependents">
            Dependents ({profiles.filter(p => p.relationship !== "self").length})
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => {
              const RelIcon = RELATIONSHIP_LABELS[profile.relationship]?.icon || User;
              const isActive = activeProfile?.id === profile.id;
              
              return (
                <Card 
                  key={profile.id} 
                  className={`relative ${isActive ? "ring-2 ring-primary" : ""}`}
                  data-testid={`card-profile-${profile.id}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={profile.profileImageUrl || undefined} />
                          <AvatarFallback>
                            {getInitials(profile.firstName, profile.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base" data-testid={`text-profile-name-${profile.id}`}>
                            {profile.firstName} {profile.lastName}
                          </CardTitle>
                          <Badge className={`text-xs ${getRelationshipColor(profile.relationship)}`}>
                            <RelIcon className="h-3 w-3 mr-1" />
                            {RELATIONSHIP_LABELS[profile.relationship]?.label || profile.relationship}
                          </Badge>
                        </div>
                      </div>
                      {isActive && (
                        <Badge variant="secondary" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {profile.dateOfBirth && (
                      <p className="text-sm text-muted-foreground">
                        DOB: {new Date(profile.dateOfBirth).toLocaleDateString()}
                      </p>
                    )}
                    {profile.notes && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{profile.notes}</p>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                      {!isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => activateProfileMutation.mutate(profile.id)}
                          disabled={activateProfileMutation.isPending}
                          data-testid={`button-switch-${profile.id}`}
                        >
                          <ChevronRight className="h-4 w-4 mr-1" />
                          Switch
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingProfile(profile)}
                        data-testid={`button-edit-${profile.id}`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      {profile.relationship !== "self" && !profile.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(profile.id)}
                          data-testid={`button-delete-${profile.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {profiles.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No profiles yet. Add your first profile to get started.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="dependents" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profiles
              .filter((p) => p.relationship !== "self")
              .map((profile) => {
                const RelIcon = RELATIONSHIP_LABELS[profile.relationship]?.icon || User;
                
                return (
                  <Card key={profile.id} data-testid={`card-dependent-${profile.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={profile.profileImageUrl || undefined} />
                          <AvatarFallback>
                            {getInitials(profile.firstName, profile.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-base">
                            {profile.firstName} {profile.lastName}
                          </CardTitle>
                          <Badge className={`text-xs ${getRelationshipColor(profile.relationship)}`}>
                            <RelIcon className="h-3 w-3 mr-1" />
                            {RELATIONSHIP_LABELS[profile.relationship]?.label}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => activateProfileMutation.mutate(profile.id)}
                          disabled={activateProfileMutation.isPending}
                          data-testid={`button-view-${profile.id}`}
                        >
                          View Records
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingProfile(profile)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

            {profiles.filter((p) => p.relationship !== "self").length === 0 && (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Baby className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No dependents added yet.</p>
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Family Member
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ProfileActivityLog />
        </TabsContent>
      </Tabs>

      {/* Edit Profile Dialog */}
      <Dialog open={!!editingProfile} onOpenChange={(open) => !open && setEditingProfile(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update information for {editingProfile?.firstName} {editingProfile?.lastName}
            </DialogDescription>
          </DialogHeader>
          {editingProfile && (
            <div className="space-y-4 py-4">
              <ProfilePhotoUpload
                profileId={editingProfile.id}
                firstName={editingProfile.firstName}
                lastName={editingProfile.lastName}
                currentPhotoUrl={editingProfile.profileImageUrl}
                onPhotoChange={(newUrl) => {
                  setEditingProfile({ ...editingProfile, profileImageUrl: newUrl });
                  queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
                }}
              />
              
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-firstName">First Name</Label>
                  <Input
                    id="edit-firstName"
                    data-testid="input-edit-first-name"
                    value={editingProfile.firstName}
                    onChange={(e) => setEditingProfile({ ...editingProfile, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-lastName">Last Name</Label>
                  <Input
                    id="edit-lastName"
                    data-testid="input-edit-last-name"
                    value={editingProfile.lastName}
                    onChange={(e) => setEditingProfile({ ...editingProfile, lastName: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-dateOfBirth">Date of Birth</Label>
                  <Input
                    id="edit-dateOfBirth"
                    type="date"
                    data-testid="input-edit-dob"
                    value={editingProfile.dateOfBirth || ""}
                    onChange={(e) => setEditingProfile({ ...editingProfile, dateOfBirth: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-gender">Gender</Label>
                  <Select
                    value={editingProfile.gender || ""}
                    onValueChange={(value) => setEditingProfile({ ...editingProfile, gender: value })}
                  >
                    <SelectTrigger data-testid="select-edit-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  data-testid="input-edit-notes"
                  value={editingProfile.notes || ""}
                  onChange={(e) => setEditingProfile({ ...editingProfile, notes: e.target.value })}
                  className="resize-none"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="edit-mrn">Medical Record Number</Label>
                <Input
                  id="edit-mrn"
                  data-testid="input-edit-mrn"
                  value={editingProfile.medicalRecordNumber || ""}
                  onChange={(e) => setEditingProfile({ ...editingProfile, medicalRecordNumber: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-insuranceId">Insurance ID</Label>
                <Input
                  id="edit-insuranceId"
                  data-testid="input-edit-insurance-id"
                  value={editingProfile.insuranceId || ""}
                  onChange={(e) => setEditingProfile({ ...editingProfile, insuranceId: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-emergencyContact">Emergency Contact</Label>
                <Input
                  id="edit-emergencyContact"
                  data-testid="input-edit-emergency-contact"
                  value={editingProfile.emergencyContact || ""}
                  onChange={(e) => setEditingProfile({ ...editingProfile, emergencyContact: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProfile(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateProfile} 
              disabled={updateProfileMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete Profile
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this family member profile? This action cannot be undone and all associated health data will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => deleteConfirmId && deleteProfileMutation.mutate(deleteConfirmId)}
              disabled={deleteProfileMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteProfileMutation.isPending ? "Deleting..." : "Delete Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileActivityLog() {
  const { data: events = [], isLoading } = useQuery<Array<{
    id: string;
    userId: string;
    profileId: string;
    eventType: string;
    metadata: Record<string, unknown> | null;
    createdAt: string;
  }>>({
    queryKey: ["/api/profiles/analytics/events"],
  });

  const getEventDescription = (eventType: string, metadata: Record<string, unknown> | null): string => {
    switch (eventType) {
      case "profile_created":
        return `Created new profile${metadata?.firstName ? ` for ${metadata.firstName}` : ""}`;
      case "profile_switched":
        return `Switched to ${metadata?.relationship || "a different"} profile`;
      case "dependent_added":
        return `Added ${metadata?.relationship || "family member"}: ${metadata?.firstName || ""}`;
      default:
        return eventType.replace(/_/g, " ");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-activity-log">
      <CardHeader>
        <CardTitle className="text-lg">Profile Activity</CardTitle>
        <CardDescription>Recent changes to your family health profiles</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No activity recorded yet.</p>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {events.map((event) => (
                <div 
                  key={event.id} 
                  className="flex items-start gap-3 p-3 rounded-md bg-muted/50"
                  data-testid={`activity-item-${event.id}`}
                >
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {getEventDescription(event.eventType, event.metadata)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}