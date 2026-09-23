import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Sliders, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw,
  FileText,
  AlertTriangle,
  Languages,
  Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InsightPreferences } from "@shared/schema";
import { DEFAULT_INSIGHT_PREFERENCES } from "@shared/schema";

interface AIInsightPreferencesProps {
  preferences: InsightPreferences;
  onChange: (prefs: InsightPreferences) => void;
  onApply?: (prefs: InsightPreferences) => void;
  showApplyButton?: boolean;
}

const FOCUS_AREAS = [
  { value: "all", label: "All Areas" },
  { value: "medications", label: "Medications" },
  { value: "conditions", label: "Conditions" },
  { value: "vitals", label: "Vitals" },
  { value: "labs", label: "Lab Results" },
  { value: "encounters", label: "Encounters" },
] as const;

export function AIInsightPreferences({
  preferences,
  onChange,
  onApply,
  showApplyButton = true
}: AIInsightPreferencesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<InsightPreferences>(preferences);

  useEffect(() => {
    setLocalPrefs(preferences);
  }, [preferences]);

  const handleChange = <K extends keyof InsightPreferences>(
    key: K, 
    value: InsightPreferences[K]
  ) => {
    const updated = { ...localPrefs, [key]: value };
    setLocalPrefs(updated);
    if (!showApplyButton) {
      onChange(updated);
    }
  };

  const toggleFocusArea = (area: InsightPreferences["focusAreas"][number]) => {
    let newAreas: InsightPreferences["focusAreas"];
    
    if (area === "all") {
      newAreas = ["all"];
    } else {
      const currentAreas = localPrefs.focusAreas.filter(a => a !== "all");
      if (currentAreas.includes(area)) {
        newAreas = currentAreas.filter(a => a !== area);
        if (newAreas.length === 0) newAreas = ["all"];
      } else {
        newAreas = [...currentAreas, area];
      }
    }
    
    handleChange("focusAreas", newAreas as InsightPreferences["focusAreas"]);
  };

  const handleApply = () => {
    onChange(localPrefs);
    onApply?.(localPrefs);
  };

  const handleReset = () => {
    const resetPrefs = { ...DEFAULT_INSIGHT_PREFERENCES, userId: localPrefs.userId };
    setLocalPrefs(resetPrefs);
    onChange(resetPrefs);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card data-testid="ai-insight-preferences-panel">
        <CardHeader className="py-3 px-4">
          <CollapsibleTrigger asChild>
            <button 
              className="flex items-center justify-between w-full text-left"
              data-testid="button-toggle-insight-prefs"
            >
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-muted-foreground" />
                <div>
                  <CardTitle className="text-sm font-medium">Insight Preferences</CardTitle>
                  <CardDescription className="text-xs">
                    Customize AI insight generation
                  </CardDescription>
                </div>
              </div>
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4 space-y-5">
            <div className="space-y-3">
              <Label htmlFor="ai-insight-preferences-detail-level" className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Detail Level
              </Label>
              <Select
                value={localPrefs.detailLevel}
                onValueChange={(v) => handleChange("detailLevel", v as InsightPreferences["detailLevel"])}
              >
                <SelectTrigger id="ai-insight-preferences-detail-level" data-testid="select-detail-level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Summary - Key points only</SelectItem>
                  <SelectItem value="standard">Standard - Balanced detail</SelectItem>
                  <SelectItem value="detailed">Detailed - Comprehensive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="ai-insight-preferences-language-style" className="text-sm flex items-center gap-2">
                <Languages className="h-4 w-4" />
                Language Style
              </Label>
              <Select
                value={localPrefs.language}
                onValueChange={(v) => handleChange("language", v as InsightPreferences["language"])}
              >
                <SelectTrigger id="ai-insight-preferences-language-style" data-testid="select-language-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple - Plain language</SelectItem>
                  <SelectItem value="clinical">Clinical - Medical terminology</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <FieldCaption className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Focus Areas
              </FieldCaption>
              <div className="flex flex-wrap gap-2">
                {FOCUS_AREAS.map((area) => (
                  <Badge
                    key={area.value}
                    variant={localPrefs.focusAreas.includes(area.value) ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer transition-colors",
                      localPrefs.focusAreas.includes(area.value) 
                        ? "" 
                        : "hover-elevate"
                    )}
                    onClick={() => toggleFocusArea(area.value)}
                    data-testid={`badge-focus-${area.value}`}
                  >
                    {area.label}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Select areas to prioritize in AI insights
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <FieldCaption className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Highlight Critical
                  </FieldCaption>
                  <p className="text-xs text-muted-foreground">
                    Emphasize critical findings in insights
                  </p>
                </div>
                <Switch
                  checked={localPrefs.highlightCritical}
                  onCheckedChange={(checked) => handleChange("highlightCritical", checked)}
                  data-testid="switch-highlight-critical"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <FieldCaption className="text-sm">Show Confidence Scores</FieldCaption>
                  <p className="text-xs text-muted-foreground">
                    Display AI confidence levels
                  </p>
                </div>
                <Switch
                  checked={localPrefs.showConfidenceScores}
                  onCheckedChange={(checked) => handleChange("showConfidenceScores", checked)}
                  data-testid="switch-show-confidence"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleReset}
                className="flex-1"
                data-testid="button-reset-preferences"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              {showApplyButton && (
                <Button 
                  size="sm" 
                  onClick={handleApply}
                  className="flex-1"
                  data-testid="button-apply-preferences"
                >
                  Apply Changes
                </Button>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
