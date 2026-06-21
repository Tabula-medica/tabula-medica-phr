import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Trash2, Shield, Eye, EyeOff, Loader2, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getInitials } from "@/components/shared";

interface PhotoPrivacySettings {
  showInProfile: boolean;
  showToProviders: boolean;
  showToCaregivers: boolean;
  excludeFromExternalShares: boolean;
}

interface ProfilePhotoUploadProps {
  profileId: string;
  firstName: string;
  lastName: string;
  currentPhotoUrl?: string | null;
  onPhotoChange?: (newUrl: string | null) => void;
}

export function ProfilePhotoUpload({
  profileId,
  firstName,
  lastName,
  currentPhotoUrl,
  onPhotoChange,
}: ProfilePhotoUploadProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [privacySettings, setPrivacySettings] = useState<PhotoPrivacySettings>({
    showInProfile: true,
    showToProviders: true,
    showToCaregivers: true,
    excludeFromExternalShares: true,
  });
  const [privacyInitialized, setPrivacyInitialized] = useState(false);

  const { data: photoMetadata } = useQuery<{
    success: boolean;
    hasPhoto: boolean;
    isOwner?: boolean;
    metadata?: {
      privacySettings: PhotoPrivacySettings;
      uploadedAt: string;
    };
  }>({
    queryKey: ["/api/profile-photos", profileId, "metadata"],
    enabled: !!profileId,
  });

  if (photoMetadata?.metadata?.privacySettings && !privacyInitialized && !selectedFile) {
    setPrivacySettings(photoMetadata.metadata.privacySettings);
    setPrivacyInitialized(true);
  }

  const updatePrivacyMutation = useMutation({
    mutationFn: async (settings: Partial<PhotoPrivacySettings>) => {
      const res = await apiRequest("PATCH", `/api/profile-photos/${profileId}/privacy`, {
        privacySettings: settings,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-photos", profileId] });
      toast({
        title: "Privacy Updated",
        description: "Your photo privacy settings have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update privacy settings",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/profile-photos/${profileId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile-photos", profileId] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      setShowDeleteConfirm(false);
      onPhotoChange?.(null);
      toast({
        title: "Photo Deleted",
        description: "Your profile photo has been permanently removed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete photo",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please select a JPEG, PNG, GIF, or WebP image.",
        variant: "destructive",
      });
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File Too Large",
        description: "Please select an image under 5MB.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    setSelectedFile(file);
    setShowPrivacyDialog(true);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const requestRes = await apiRequest("POST", "/api/profile-photos/request-upload", {
        profileId,
        fileName: selectedFile.name,
        contentType: selectedFile.type,
        sizeBytes: selectedFile.size,
      });
      const { uploadUrl, objectPath } = await requestRes.json();

      await fetch(uploadUrl, {
        method: "PUT",
        body: selectedFile,
        headers: {
          "Content-Type": selectedFile.type,
        },
      });

      await apiRequest("POST", "/api/profile-photos/confirm-upload", {
        profileId,
        objectPath,
        originalFileName: selectedFile.name,
        contentType: selectedFile.type,
        sizeBytes: selectedFile.size,
        privacySettings,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/profile-photos", profileId] });
      queryClient.invalidateQueries({ queryKey: ["/api/profiles"] });
      
      onPhotoChange?.(previewUrl);
      setShowPrivacyDialog(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      
      toast({
        title: "Photo Uploaded",
        description: "Your profile photo has been saved securely.",
      });
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelUpload = () => {
    setShowPrivacyDialog(false);
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const hasPhoto = !!currentPhotoUrl || photoMetadata?.hasPhoto;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-20 w-20">
            <AvatarImage src={currentPhotoUrl || undefined} />
            <AvatarFallback className="text-xl">
              {getInitials(firstName, lastName)}
            </AvatarFallback>
          </Avatar>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-photo-file"
          />
          
          <Button
            variant="secondary"
            size="icon"
            className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full"
            onClick={() => fileInputRef.current?.click()}
            data-testid="button-change-photo"
          >
            <Camera className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium">Profile Photo</p>
          <p className="text-xs text-muted-foreground">
            Optional. JPEG, PNG, GIF or WebP. Max 5MB.
          </p>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-upload-photo"
            >
              <Upload className="h-4 w-4 mr-2" />
              {hasPhoto ? "Change" : "Upload"}
            </Button>
            
            {hasPhoto && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (photoMetadata?.metadata?.privacySettings) {
                      setPrivacySettings(photoMetadata.metadata.privacySettings);
                    }
                    setShowPrivacyDialog(true);
                  }}
                  data-testid="button-privacy-settings"
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Privacy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  data-testid="button-delete-photo"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showPrivacyDialog} onOpenChange={setShowPrivacyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {selectedFile ? "Upload Photo" : "Photo Privacy Settings"}
            </DialogTitle>
            <DialogDescription>
              Control who can see your profile photo
            </DialogDescription>
          </DialogHeader>

          {selectedFile && previewUrl && (
            <div className="flex justify-center py-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={previewUrl} />
                <AvatarFallback>{getInitials(firstName, lastName)}</AvatarFallback>
              </Avatar>
            </div>
          )}

          <div className="space-y-4">
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <Shield className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-700 dark:text-blue-300">
                Your photo is stored securely with encryption. It is never used for identity verification.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="showInProfile">Show in my profile</Label>
                  <p className="text-xs text-muted-foreground">Display photo in your profile view</p>
                </div>
                <Switch
                  id="showInProfile"
                  checked={privacySettings.showInProfile}
                  onCheckedChange={(checked) => 
                    setPrivacySettings({ ...privacySettings, showInProfile: checked })
                  }
                  data-testid="switch-show-profile"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="showToProviders">Visible to healthcare providers</Label>
                  <p className="text-xs text-muted-foreground">Allow providers to see your photo</p>
                </div>
                <Switch
                  id="showToProviders"
                  checked={privacySettings.showToProviders}
                  onCheckedChange={(checked) => 
                    setPrivacySettings({ ...privacySettings, showToProviders: checked })
                  }
                  data-testid="switch-show-providers"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="showToCaregivers">Visible to caregivers</Label>
                  <p className="text-xs text-muted-foreground">Allow caregivers to see your photo</p>
                </div>
                <Switch
                  id="showToCaregivers"
                  checked={privacySettings.showToCaregivers}
                  onCheckedChange={(checked) => 
                    setPrivacySettings({ ...privacySettings, showToCaregivers: checked })
                  }
                  data-testid="switch-show-caregivers"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="excludeFromShares" className="flex items-center gap-2">
                    <EyeOff className="h-4 w-4" />
                    Exclude from external shares
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Preference to exclude photo from external share packets (applied when sharing is configured)
                  </p>
                </div>
                <Switch
                  id="excludeFromShares"
                  checked={privacySettings.excludeFromExternalShares}
                  onCheckedChange={(checked) => 
                    setPrivacySettings({ ...privacySettings, excludeFromExternalShares: checked })
                  }
                  data-testid="switch-exclude-shares"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelUpload} data-testid="button-cancel-upload">
              Cancel
            </Button>
            {selectedFile ? (
              <Button onClick={handleUpload} disabled={isUploading} data-testid="button-confirm-upload">
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Photo
                  </>
                )}
              </Button>
            ) : (
              <Button 
                onClick={() => {
                  updatePrivacyMutation.mutate(privacySettings);
                  setShowPrivacyDialog(false);
                }}
                disabled={updatePrivacyMutation.isPending}
                data-testid="button-save-privacy"
              >
                Save Settings
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              Delete Profile Photo
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this profile photo? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} data-testid="button-cancel-delete">
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Photo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
