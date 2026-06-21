import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Eye } from "lucide-react";
import { useProfileAccessibility } from "@/hooks/use-profile-accessibility";
import { useAccessibility } from "@/components/accessibility-provider";

interface SimplifiedModeToggleProps {
  profileId: string | null;
  showLabel?: boolean;
  className?: string;
}

export function SimplifiedModeToggle({ 
  profileId, 
  showLabel = true,
  className 
}: SimplifiedModeToggleProps) {
  const { effectiveSettings, toggleSimplifiedMode, isToggling } = useProfileAccessibility(profileId);
  const { settings: globalSettings, updateSetting } = useAccessibility();
  
  const handleToggle = (checked: boolean) => {
    if (profileId) {
      toggleSimplifiedMode(checked);
    } else {
      updateSetting("simplifiedView", checked);
    }
  };
  
  const isEnabled = profileId 
    ? effectiveSettings.simplifiedMode 
    : globalSettings.simplifiedView;

  return (
    <div className={`flex items-center gap-3 ${className || ""}`}>
      {showLabel && (
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Label 
            htmlFor="simplified-mode-toggle" 
            className="text-sm font-medium cursor-pointer"
          >
            Simplified Mode
          </Label>
        </div>
      )}
      <Switch
        id="simplified-mode-toggle"
        checked={isEnabled}
        onCheckedChange={handleToggle}
        disabled={isToggling}
        aria-label="Toggle simplified mode for easier reading"
        data-testid="switch-simplified-mode"
      />
      {!showLabel && (
        <span className="sr-only">Simplified Mode</span>
      )}
    </div>
  );
}

export function SimplifiedModeCard({ profileId }: { profileId: string | null }) {
  const { effectiveSettings, toggleSimplifiedMode, isToggling } = useProfileAccessibility(profileId);
  const { settings: globalSettings, updateSetting } = useAccessibility();
  
  const handleToggle = (checked: boolean) => {
    if (profileId) {
      toggleSimplifiedMode(checked);
    } else {
      updateSetting("simplifiedView", checked);
    }
  };
  
  const isEnabled = profileId 
    ? effectiveSettings.simplifiedMode 
    : globalSettings.simplifiedView;

  return (
    <div className="flex items-center justify-between gap-4 p-4 border rounded-lg">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" aria-hidden="true" />
          <Label htmlFor="simplified-mode-card" className="text-base font-medium">
            Simplified Mode
          </Label>
        </div>
        <p className="text-sm text-muted-foreground">
          Show only essential information with larger text and buttons for easier reading
        </p>
        {profileId && (
          <p className="text-xs text-muted-foreground">
            This setting is saved for this profile only
          </p>
        )}
      </div>
      <Switch
        id="simplified-mode-card"
        checked={isEnabled}
        onCheckedChange={handleToggle}
        disabled={isToggling}
        aria-label="Toggle simplified mode"
        data-testid="switch-simplified-mode-card"
      />
    </div>
  );
}
