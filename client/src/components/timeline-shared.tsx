import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ehrPlatformInfo as platformInfo } from "@shared/schema";
import type { KeyValueItem, ProvenanceInfo } from "@/components/health-record-detail";
import {
  Clock,
  Stethoscope,
  Pill,
  FileText,
  Activity,
  Syringe,
  Info,
  ChevronDown,
  ChevronUp,
  Loader2,
  Image,
  Heart,
  ClipboardList,
  Watch,
} from "lucide-react";
import type { TimelineEvent } from "@shared/schema";

export const filterChips = [
  { id: "all", label: "All", icon: ClipboardList },
  { id: "lab_result", label: "Labs", icon: FileText },
  { id: "imaging", label: "Imaging", icon: Image },
  { id: "medication", label: "Medications", icon: Pill },
  { id: "diagnosis", label: "Diagnoses", icon: Heart },
  { id: "procedure", label: "Procedures", icon: Stethoscope },
  { id: "immunization", label: "Vaccines", icon: Syringe },
  { id: "encounter", label: "Visits", icon: Stethoscope },
  { id: "vital_sign", label: "Vitals", icon: Activity },
  { id: "wearable", label: "Wearables", icon: Watch },
] as const;

export const eventTypeIcons: Record<string, React.ElementType> = {
  encounter: Stethoscope,
  diagnosis: Heart,
  medication: Pill,
  lab_result: FileText,
  imaging: Image,
  procedure: Stethoscope,
  immunization: Syringe,
  vital_sign: Activity,
  note: FileText,
  wearable: Watch,
};

export const eventTypeColors: Record<string, string> = {
  encounter: "bg-primary/10 text-primary",
  diagnosis: "bg-destructive/10 text-destructive",
  medication: "bg-secondary text-secondary-foreground",
  lab_result: "bg-primary/10 text-primary",
  imaging: "bg-accent text-accent-foreground",
  procedure: "bg-secondary text-secondary-foreground",
  immunization: "bg-primary/10 text-primary",
  vital_sign: "bg-secondary text-secondary-foreground",
  note: "bg-muted text-muted-foreground",
  wearable: "bg-accent text-accent-foreground",
};

export interface TimelineEventWithSource extends TimelineEvent {
  sourceFacility: string;
  sourcePlatform: string;
  wearablePlatform?: string;
  wearableColor?: string;
}

export const wearablePlatformColors: Record<string, { name: string; color: string }> = {
  fitbit: { name: "Fitbit", color: "#00B0B9" },
  apple_health: { name: "Apple Health", color: "#FF2D55" },
  garmin: { name: "Garmin", color: "#1B4D8F" },
  withings: { name: "Withings", color: "#00A7B8" },
  oura: { name: "Oura", color: "#5CCBB1" },
  whoop: { name: "WHOOP", color: "#000000" },
  samsung_health: { name: "Samsung Health", color: "#1428A0" },
  google_fit: { name: "Google Fit", color: "#4285F4" },
};

export function formatEventType(type: string) {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function SourceBadge({ platform, facility, wearablePlatform, wearableColor }: {
  platform: string;
  facility: string;
  wearablePlatform?: string;
  wearableColor?: string;
}) {
  if (!platform) {
    return (
      <Badge variant="outline" className="gap-1.5 text-xs font-normal">
        <span className="h-2 w-2 rounded-full shrink-0 bg-muted-foreground" />
        <span className="truncate max-w-[120px]">{facility || 'Unknown Source'}</span>
      </Badge>
    );
  }

  const isWearable = platform.startsWith('wearable_');
  let color = '#666';
  let displayName = facility;

  if (isWearable && wearablePlatform) {
    const wearableInfo = wearablePlatformColors[wearablePlatform];
    color = wearableColor || wearableInfo?.color || '#666';
    displayName = facility || wearableInfo?.name || wearablePlatform;
  } else {
    const platformData = platformInfo[platform as keyof typeof platformInfo];
    color = platformData?.color || '#666';
  }

  return (
    <Badge
      variant="outline"
      className="gap-1.5 text-xs font-normal"
      data-testid={`badge-source-${platform}`}
    >
      {isWearable && <Watch className="h-3 w-3 shrink-0" />}
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="truncate max-w-[120px]">{displayName}</span>
    </Badge>
  );
}

export function FilterChip({
  id,
  label,
  icon: Icon,
  isActive,
  onClick
}: {
  id: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={isActive ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="shrink-0 gap-1.5"
      data-testid={`filter-chip-${id}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

export interface ExplainContext {
  term: string;
  recordType?: string;
  sourceQuote?: {
    text: string;
    source: string;
    date?: string;
    recordId?: string;
  };
}

export function TimelineEventCard({ event, onExplain, onViewDetails, compact = false }: {
  event: TimelineEventWithSource;
  onExplain: (context: ExplainContext) => void;
  onViewDetails: (event: TimelineEventWithSource) => void;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = eventTypeIcons[event.type] || FileText;
  const colorClass = eventTypeColors[event.type] || "bg-muted text-muted-foreground";

  const findMedicalTerms = (text: string) => {
    const terms = ["LDL", "HDL", "A1C", "WBC", "RBC", "Hemoglobin", "atelectasis", "hypertension", "cholesterol", "triglycerides"];
    return terms.filter(term => text.toLowerCase().includes(term.toLowerCase()));
  };

  const medicalTerms = findMedicalTerms(event.title + ' ' + event.description);

  return (
    <div className={`relative ${compact ? 'pl-6 pb-3' : 'pl-8 pb-6'} last:pb-0`}>
      <div className="absolute left-0 top-0 flex flex-col items-center">
        <div className={`flex ${compact ? 'h-6 w-6' : 'h-8 w-8'} items-center justify-center rounded-full ${colorClass}`}>
          <Icon className={compact ? "h-3 w-3" : "h-4 w-4"} />
        </div>
        <div className={`w-0.5 h-full bg-border absolute ${compact ? 'top-6 left-3' : 'top-8 left-4'}`} />
      </div>

      <Card className={`${compact ? 'ml-3' : 'ml-4'} hover-elevate cursor-pointer`} onClick={() => setExpanded(!expanded)} data-testid={`card-timeline-event-${event.id}`}>
        <CardContent className={compact ? "p-3" : "p-4"}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1" data-testid={`text-event-date-${event.id}`}>
                {formatDate(event.date)}
              </p>
              <h4 className={`font-semibold ${compact ? 'text-xs' : 'text-sm'} mb-2`} data-testid={`text-event-title-${event.id}`}>
                {event.title}
              </h4>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className={compact ? "text-xs" : ""} data-testid={`badge-event-type-${event.id}`}>
                  {formatEventType(event.type)}
                </Badge>
                <SourceBadge
                  platform={event.sourcePlatform}
                  facility={event.sourceFacility}
                  wearablePlatform={event.wearablePlatform}
                  wearableColor={event.wearableColor}
                />
              </div>
              {event.description && (
                <p className={`text-sm text-muted-foreground mt-2 ${expanded ? '' : 'line-clamp-2'}`} data-testid={`text-event-description-${event.id}`}>
                  {event.description}
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon" className={compact ? "h-6 w-6" : ""} onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} data-testid={`button-toggle-event-${event.id}`}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>

          {expanded && (
            <div className="mt-4 pt-4 border-t space-y-3">
              {event.provider && (
                <div className="flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
                  <Stethoscope className="h-3.5 w-3.5" />
                  <span>Provider: {event.provider}</span>
                </div>
              )}
              {medicalTerms.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Tap to learn:</span>
                  {medicalTerms.map(term => (
                    <Button
                      key={term}
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onExplain({
                          term,
                          recordType: event.type,
                          sourceQuote: {
                            text: event.description || event.title,
                            source: event.sourceFacility || "Your Health Record",
                            date: event.date,
                            recordId: event.id,
                          },
                        });
                      }}
                      data-testid={`button-explain-${term.toLowerCase()}`}
                    >
                      <Info className="h-3 w-3 mr-1" />
                      {term}
                    </Button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExplain({
                      term: event.title,
                      recordType: event.type,
                      sourceQuote: {
                        text: event.description || event.title,
                        source: event.sourceFacility || "Your Health Record",
                        date: event.date,
                        recordId: event.id,
                      },
                    });
                  }}
                  data-testid={`button-explain-event-${event.id}`}
                >
                  <Info className="h-4 w-4 mr-1" />
                  Explain This
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => { e.stopPropagation(); onViewDetails(event); }}
                  data-testid={`button-view-details-${event.id}`}
                >
                  View Full Details
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function TimelineLoadingSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4" data-testid="timeline-loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="pl-12">
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function TimelineEmptyState({ hasFilters, onClearFilters, onConnect }: {
  hasFilters: boolean;
  onClearFilters?: () => void;
  onConnect?: () => void;
}) {
  return (
    <Card className="p-8 text-center" data-testid="timeline-empty">
      <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-title">
        {hasFilters ? "No Matching Events" : "No Health Events Yet"}
      </h3>
      <p className="text-muted-foreground mb-4" data-testid="text-empty-description">
        {hasFilters
          ? "Try adjusting your search terms or clearing filters to see more results."
          : "Connect your health data sources to start building your unified health timeline."}
      </p>
      {hasFilters && onClearFilters && (
        <Button variant="outline" onClick={onClearFilters} data-testid="button-clear-filters">
          Clear All Filters
        </Button>
      )}
    </Card>
  );
}

export function FilterChipBar({ selectedTypes, onFilterClick }: {
  selectedTypes: string[];
  onFilterClick: (id: string) => void;
}) {
  return (
    <ScrollArea className="w-full" data-testid="timeline-filters">
      <div className="flex flex-wrap gap-2 pb-2" data-testid="filter-chips-container">
        {filterChips.map(chip => (
          <FilterChip
            key={chip.id}
            id={chip.id}
            label={chip.label}
            icon={chip.icon}
            isActive={chip.id === "all" ? selectedTypes.length === 0 : selectedTypes.includes(chip.id)}
            onClick={() => onFilterClick(chip.id)}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

export function generateKeyValues(event: TimelineEventWithSource): KeyValueItem[] {
  const keyValues: KeyValueItem[] = [];
  if (event.type === "lab_result") {
    const labMatch = event.description.match(/(\d+\.?\d*)\s*(mg\/dL|%|g\/dL|cells\/mcL|mmol\/L)/i);
    if (labMatch) {
      keyValues.push({
        label: event.title.replace(" - ", ": ").split(":")[0] || event.title,
        value: labMatch[1],
        unit: labMatch[2],
        status: event.title.toLowerCase().includes("high") || event.title.toLowerCase().includes("abnormal") ? "abnormal" : "normal",
        isExplainable: true,
      });
    }
  }
  if (event.type === "vital_sign") {
    keyValues.push({ label: event.title, value: event.description.split(" ")[0] || "N/A", isExplainable: true });
  }
  if (event.type === "medication") {
    keyValues.push({ label: "Medication", value: event.title, isExplainable: true });
    if (event.description) keyValues.push({ label: "Instructions", value: event.description });
  }
  if (keyValues.length === 0) {
    keyValues.push({ label: "Details", value: event.description || event.title });
  }
  return keyValues;
}

export function generateProvenance(event: TimelineEventWithSource): ProvenanceInfo {
  const platform = platformInfo[event.sourcePlatform as keyof typeof platformInfo];
  return {
    source: platform?.name || event.sourcePlatform,
    facility: event.sourceFacility,
    recordedDate: new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    provider: event.provider,
    ehrPlatform: platform?.name || event.sourcePlatform,
    platformColor: platform?.color || '#666',
    originalId: event.id,
    recordType: formatEventType(event.type),
    fetchedTime: "2 hours ago",
    confidenceScore: 92,
    rawSourceAvailable: true,
  };
}
