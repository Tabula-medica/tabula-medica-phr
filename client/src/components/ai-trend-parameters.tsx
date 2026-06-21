import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Settings2, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw,
  Gauge,
  Calendar,
  TrendingUp
} from "lucide-react";
import type { TrendParameters } from "@shared/schema";
import { DEFAULT_TREND_PARAMETERS } from "@shared/schema";

interface AITrendParametersProps {
  parameters: TrendParameters;
  onChange: (params: TrendParameters) => void;
  onApply?: (params: TrendParameters) => void;
  showApplyButton?: boolean;
  compact?: boolean;
}

export function AITrendParameters({
  parameters,
  onChange,
  onApply,
  showApplyButton = true,
  compact = false
}: AITrendParametersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localParams, setLocalParams] = useState<TrendParameters>(parameters);

  useEffect(() => {
    setLocalParams(parameters);
  }, [parameters]);

  const handleChange = <K extends keyof TrendParameters>(
    key: K, 
    value: TrendParameters[K]
  ) => {
    const updated = { ...localParams, [key]: value };
    setLocalParams(updated);
    if (!showApplyButton) {
      onChange(updated);
    }
  };

  const handleApply = () => {
    onChange(localParams);
    onApply?.(localParams);
  };

  const handleReset = () => {
    setLocalParams(DEFAULT_TREND_PARAMETERS);
    onChange(DEFAULT_TREND_PARAMETERS);
  };

  const sensitivityLabels = {
    low: "Low - Major trends only",
    medium: "Medium - Balanced detection",
    high: "High - All variations"
  };

  const smoothingLabels = {
    none: "None - Raw data",
    light: "Light - Minor smoothing",
    moderate: "Moderate - Balanced",
    heavy: "Heavy - Smooth curves"
  };

  const timeframeLabel = (days: number) => {
    if (days <= 7) return "1 week";
    if (days <= 30) return "1 month";
    if (days <= 90) return "3 months";
    if (days <= 180) return "6 months";
    return "1 year";
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 flex-wrap" data-testid="ai-trend-params-compact">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          <Select
            value={localParams.sensitivity}
            onValueChange={(v) => handleChange("sensitivity", v as TrendParameters["sensitivity"])}
          >
            <SelectTrigger className="w-28" data-testid="select-sensitivity-compact">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select
            value={String(localParams.timeframeDays)}
            onValueChange={(v) => handleChange("timeframeDays", Number(v))}
          >
            <SelectTrigger className="w-28" data-testid="select-timeframe-compact">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">1 week</SelectItem>
              <SelectItem value="30">1 month</SelectItem>
              <SelectItem value="90">3 months</SelectItem>
              <SelectItem value="180">6 months</SelectItem>
              <SelectItem value="365">1 year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card data-testid="ai-trend-parameters-panel">
        <CardHeader className="py-3 px-4">
          <CollapsibleTrigger asChild>
            <button 
              className="flex items-center justify-between w-full text-left"
              data-testid="button-toggle-trend-params"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <CardTitle className="text-sm font-medium">Analysis Parameters</CardTitle>
                  <CardDescription className="text-xs">
                    Customize trend detection and visualization
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
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-2">
                  <Gauge className="h-4 w-4" />
                  Sensitivity
                </Label>
                <span className="text-xs text-muted-foreground capitalize">
                  {localParams.sensitivity}
                </span>
              </div>
              <Select
                value={localParams.sensitivity}
                onValueChange={(v) => handleChange("sensitivity", v as TrendParameters["sensitivity"])}
              >
                <SelectTrigger data-testid="select-sensitivity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{sensitivityLabels.low}</SelectItem>
                  <SelectItem value="medium">{sensitivityLabels.medium}</SelectItem>
                  <SelectItem value="high">{sensitivityLabels.high}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Controls how many variations are detected as significant trends
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Timeframe
                </Label>
                <span className="text-xs text-muted-foreground">
                  {timeframeLabel(localParams.timeframeDays)}
                </span>
              </div>
              <Slider
                value={[localParams.timeframeDays]}
                onValueChange={([v]) => handleChange("timeframeDays", v)}
                min={7}
                max={365}
                step={1}
                className="w-full"
                data-testid="slider-timeframe"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 week</span>
                <span>1 year</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Smoothing
                </Label>
                <span className="text-xs text-muted-foreground capitalize">
                  {localParams.smoothingLevel}
                </span>
              </div>
              <Select
                value={localParams.smoothingLevel}
                onValueChange={(v) => handleChange("smoothingLevel", v as TrendParameters["smoothingLevel"])}
              >
                <SelectTrigger data-testid="select-smoothing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{smoothingLabels.none}</SelectItem>
                  <SelectItem value="light">{smoothingLabels.light}</SelectItem>
                  <SelectItem value="moderate">{smoothingLabels.moderate}</SelectItem>
                  <SelectItem value="heavy">{smoothingLabels.heavy}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-sm">Comparison Mode</Label>
              <Select
                value={localParams.comparisonMode}
                onValueChange={(v) => handleChange("comparisonMode", v as TrendParameters["comparisonMode"])}
              >
                <SelectTrigger data-testid="select-comparison-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="absolute">Absolute values</SelectItem>
                  <SelectItem value="percentage">Percentage change</SelectItem>
                  <SelectItem value="standard_deviation">Standard deviation</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Include Outliers</Label>
                <p className="text-xs text-muted-foreground">
                  Show data points outside normal ranges
                </p>
              </div>
              <Switch
                checked={localParams.includeOutliers}
                onCheckedChange={(checked) => handleChange("includeOutliers", checked)}
                data-testid="switch-include-outliers"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleReset}
                className="flex-1"
                data-testid="button-reset-params"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              {showApplyButton && (
                <Button 
                  size="sm" 
                  onClick={handleApply}
                  className="flex-1"
                  data-testid="button-apply-params"
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
