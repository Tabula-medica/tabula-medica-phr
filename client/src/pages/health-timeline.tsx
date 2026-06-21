import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Calendar,
  Clock,
  Stethoscope,
  Pill,
  FileText,
  Activity,
  Syringe,
  Image,
  Heart,
  Building2,
  ChevronDown,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Layers,
  Filter,
  Share2,
  Download,
  User,
  Shield,
  Fingerprint,
  RefreshCw,
  Search,
  AlertCircle,
  CheckCircle,
  Info,
} from "lucide-react";
import { Input } from "@/components/ui/input";

type ZoomLevel = "day" | "month" | "year" | "all";
type EventLane = "visits" | "labs" | "imaging" | "meds" | "problems" | "procedures" | "immunizations";

interface TimelineEvent {
  id: string;
  eventType: string;
  title: string;
  date: string;
  endDate?: string;
  provider?: string;
  facility?: string;
  source: "manual" | "fhir";
  sourceOrg?: string;
  sourceDate?: string;
  details?: Record<string, unknown>;
  loincCode?: string;
  value?: string;
  unit?: string;
  status?: string;
  episodeId?: string;
}

interface Episode {
  id: string;
  name: string;
  type: "cancer" | "pregnancy" | "surgery" | "chronic" | "acute";
  startDate: string;
  endDate?: string;
  events: TimelineEvent[];
  isActive: boolean;
}

const eventTypeConfig: Record<string, { icon: React.ElementType; color: string; lane: EventLane; label: string }> = {
  encounter: { icon: Stethoscope, color: "bg-blue-500", lane: "visits", label: "Visits" },
  visit: { icon: Stethoscope, color: "bg-blue-500", lane: "visits", label: "Visits" },
  lab_result: { icon: FileText, color: "bg-green-500", lane: "labs", label: "Labs" },
  observation: { icon: FileText, color: "bg-green-500", lane: "labs", label: "Labs" },
  imaging: { icon: Image, color: "bg-purple-500", lane: "imaging", label: "Imaging" },
  diagnostic_report: { icon: Image, color: "bg-purple-500", lane: "imaging", label: "Imaging" },
  medication: { icon: Pill, color: "bg-orange-500", lane: "meds", label: "Medications" },
  medication_request: { icon: Pill, color: "bg-orange-500", lane: "meds", label: "Medications" },
  condition: { icon: Heart, color: "bg-red-500", lane: "problems", label: "Problems" },
  diagnosis: { icon: Heart, color: "bg-red-500", lane: "problems", label: "Problems" },
  procedure: { icon: Activity, color: "bg-teal-500", lane: "procedures", label: "Procedures" },
  immunization: { icon: Syringe, color: "bg-yellow-500", lane: "immunizations", label: "Immunizations" },
};

const episodeTypeConfig: Record<string, { color: string; icon: React.ElementType }> = {
  cancer: { color: "bg-red-100 border-red-300 text-red-800", icon: Heart },
  pregnancy: { color: "bg-pink-100 border-pink-300 text-pink-800", icon: Heart },
  surgery: { color: "bg-blue-100 border-blue-300 text-blue-800", icon: Activity },
  chronic: { color: "bg-orange-100 border-orange-300 text-orange-800", icon: AlertCircle },
  acute: { color: "bg-yellow-100 border-yellow-300 text-yellow-800", icon: Clock },
};

function ProvenanceBadge({ 
  source, 
  sourceOrg, 
  sourceDate 
}: { 
  source: "manual" | "fhir"; 
  sourceOrg?: string; 
  sourceDate?: string;
}) {
  const isManual = source === "manual";
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={`gap-1 text-xs ${isManual ? "border-yellow-500" : "border-green-500"}`}
          data-testid="badge-provenance"
        >
          {isManual ? (
            <User className="h-3 w-3 text-yellow-600" />
          ) : (
            <Shield className="h-3 w-3 text-green-600" />
          )}
          {isManual ? "Manual" : "FHIR"}
          {sourceOrg && <span className="text-muted-foreground">| {sourceOrg}</span>}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-1">
          <p className="font-medium">{isManual ? "Manually Entered" : "Electronic Health Record"}</p>
          {sourceOrg && <p>Source: {sourceOrg}</p>}
          {sourceDate && <p>Retrieved: {new Date(sourceDate).toLocaleDateString()}</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

function TimelineEventCard({ event }: { event: TimelineEvent }) {
  const config = eventTypeConfig[event.eventType] || eventTypeConfig.encounter;
  const Icon = config.icon;
  
  return (
    <Card className="hover-elevate" data-testid={`event-card-${event.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`h-8 w-8 rounded-full ${config.color} flex items-center justify-center shrink-0`}>
            <Icon className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-sm truncate">{event.title}</h4>
              <ProvenanceBadge 
                source={event.source} 
                sourceOrg={event.sourceOrg}
                sourceDate={event.sourceDate}
              />
            </div>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {new Date(event.date).toLocaleDateString()}
              {event.endDate && ` - ${new Date(event.endDate).toLocaleDateString()}`}
            </div>
            
            {event.facility && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                {event.facility}
                {event.provider && ` • ${event.provider}`}
              </div>
            )}
            
            {event.value && (
              <div className="flex items-center gap-2 text-xs mt-2">
                <Badge variant="secondary" className="font-mono">
                  {event.value} {event.unit}
                </Badge>
                {event.loincCode && (
                  <span className="text-muted-foreground">LOINC: {event.loincCode}</span>
                )}
              </div>
            )}
            
            {event.status && (
              <Badge 
                variant={event.status === "active" ? "default" : "secondary"}
                className="text-xs mt-1"
              >
                {event.status}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EpisodeSection({ episode, expanded, onToggle }: { 
  episode: Episode; 
  expanded: boolean;
  onToggle: () => void;
}) {
  const config = episodeTypeConfig[episode.type] || episodeTypeConfig.acute;
  const Icon = config.icon;
  
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <Card className={`border-2 ${config.color}`} data-testid={`episode-${episode.id}`}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Icon className="h-5 w-5" />
                <div>
                  <CardTitle className="text-base">{episode.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {new Date(episode.startDate).toLocaleDateString()}
                    {episode.endDate ? ` - ${new Date(episode.endDate).toLocaleDateString()}` : " - Present"}
                    <span className="mx-2">•</span>
                    {episode.events.length} events
                  </CardDescription>
                </div>
              </div>
              {episode.isActive && (
                <Badge variant="default" className="text-xs">Active</Badge>
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {episode.events.map((event) => (
              <TimelineEventCard key={event.id} event={event} />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function LaneView({ 
  events, 
  activeLanes,
  zoomLevel 
}: { 
  events: TimelineEvent[]; 
  activeLanes: EventLane[];
  zoomLevel: ZoomLevel;
}) {
  const lanes = useMemo(() => {
    const grouped: Record<EventLane, TimelineEvent[]> = {
      visits: [],
      labs: [],
      imaging: [],
      meds: [],
      problems: [],
      procedures: [],
      immunizations: [],
    };
    
    events.forEach((event) => {
      const config = eventTypeConfig[event.eventType];
      if (config && activeLanes.includes(config.lane)) {
        grouped[config.lane].push(event);
      }
    });
    
    return grouped;
  }, [events, activeLanes]);

  const laneOrder: EventLane[] = ["visits", "labs", "imaging", "meds", "problems", "procedures", "immunizations"];
  const laneLabels: Record<EventLane, string> = {
    visits: "Visits",
    labs: "Labs",
    imaging: "Imaging",
    meds: "Medications",
    problems: "Problems",
    procedures: "Procedures",
    immunizations: "Immunizations",
  };

  return (
    <div className="space-y-4">
      {laneOrder.filter(lane => activeLanes.includes(lane)).map((lane) => (
        <div key={lane} className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {laneLabels[lane]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {lanes[lane].length} items
            </span>
          </div>
          {lanes[lane].length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {lanes[lane].slice(0, zoomLevel === "day" ? 10 : zoomLevel === "month" ? 20 : 50).map((event) => (
                <TimelineEventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No {laneLabels[lane].toLowerCase()} in this period
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function HealthTimeline() {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("month");
  const [viewMode, setViewMode] = useState<"timeline" | "lanes" | "episodes">("timeline");
  const [activeLanes, setActiveLanes] = useState<EventLane[]>([
    "visits", "labs", "imaging", "meds", "problems", "procedures", "immunizations"
  ]);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const { data: events, isLoading: eventsLoading } = useQuery<TimelineEvent[]>({
    queryKey: ["/api/timeline/events", { zoom: zoomLevel }],
  });

  const { data: episodes, isLoading: episodesLoading } = useQuery<Episode[]>({
    queryKey: ["/api/timeline/episodes"],
  });

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (!searchQuery) return events;
    
    const query = searchQuery.toLowerCase();
    return events.filter(e => 
      e.title.toLowerCase().includes(query) ||
      e.facility?.toLowerCase().includes(query) ||
      e.provider?.toLowerCase().includes(query)
    );
  }, [events, searchQuery]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {};
    
    filteredEvents.forEach((event) => {
      let key: string;
      const date = new Date(event.date);
      
      if (zoomLevel === "day") {
        key = date.toISOString().split("T")[0];
      } else if (zoomLevel === "month") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      } else if (zoomLevel === "year") {
        key = String(date.getFullYear());
      } else {
        key = "all";
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredEvents, zoomLevel]);

  const toggleLane = (lane: EventLane) => {
    setActiveLanes(prev => 
      prev.includes(lane) 
        ? prev.filter(l => l !== lane)
        : [...prev, lane]
    );
  };

  const toggleEpisode = (episodeId: string) => {
    setExpandedEpisodes(prev => {
      const next = new Set(prev);
      if (next.has(episodeId)) {
        next.delete(episodeId);
      } else {
        next.add(episodeId);
      }
      return next;
    });
  };

  const formatDateGroupLabel = (key: string): string => {
    if (key === "all") return "All Time";
    
    if (zoomLevel === "day") {
      return new Date(key).toLocaleDateString("en-US", { 
        weekday: "long", 
        year: "numeric", 
        month: "long", 
        day: "numeric" 
      });
    } else if (zoomLevel === "month") {
      const [year, month] = key.split("-");
      return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", { 
        year: "numeric", 
        month: "long" 
      });
    } else if (zoomLevel === "year") {
      return key;
    }
    return key;
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Health Timeline
          </h1>
          <p className="text-muted-foreground">
            Chronological view of your complete health history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-share">
            <Share2 className="h-4 w-4" />
            Quick Share
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-export">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Zoom:</span>
              <div className="flex gap-1">
                {(["day", "month", "year", "all"] as ZoomLevel[]).map((level) => (
                  <Button
                    key={level}
                    variant={zoomLevel === level ? "default" : "outline"}
                    size="sm"
                    onClick={() => setZoomLevel(level)}
                    data-testid={`button-zoom-${level}`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </Button>
                ))}
              </div>
            </div>

            {/* View Mode */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">View:</span>
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
                <TabsList className="h-8">
                  <TabsTrigger value="timeline" className="text-xs h-7" data-testid="tab-timeline">
                    Timeline
                  </TabsTrigger>
                  <TabsTrigger value="lanes" className="text-xs h-7" data-testid="tab-lanes">
                    <Layers className="h-3 w-3 mr-1" />
                    Lanes
                  </TabsTrigger>
                  <TabsTrigger value="episodes" className="text-xs h-7" data-testid="tab-episodes">
                    <Filter className="h-3 w-3 mr-1" />
                    Episodes
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px]"
                data-testid="input-search"
              />
            </div>
          </div>

          {/* Lane Filters (when in lanes view) */}
          {viewMode === "lanes" && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="text-sm text-muted-foreground">Event Lanes:</span>
              {(Object.keys(eventTypeConfig) as string[])
                .reduce((lanes, type) => {
                  const lane = eventTypeConfig[type]?.lane;
                  if (lane && !lanes.includes(lane)) lanes.push(lane);
                  return lanes;
                }, [] as EventLane[])
                .map((lane) => (
                  <Button
                    key={lane}
                    variant={activeLanes.includes(lane) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleLane(lane)}
                    className="text-xs"
                    data-testid={`button-lane-${lane}`}
                  >
                    {lane.charAt(0).toUpperCase() + lane.slice(1)}
                  </Button>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content */}
      <ScrollArea className="h-[600px]">
        {eventsLoading || episodesLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-48 mb-2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : viewMode === "episodes" ? (
          <div className="space-y-4">
            {episodes?.length ? (
              episodes.map((episode) => (
                <EpisodeSection
                  key={episode.id}
                  episode={episode}
                  expanded={expandedEpisodes.has(episode.id)}
                  onToggle={() => toggleEpisode(episode.id)}
                />
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Info className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold">No Episodes Found</h3>
                  <p className="text-sm text-muted-foreground">
                    Episodes group related events like surgeries, chronic conditions, or pregnancies.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : viewMode === "lanes" ? (
          <LaneView 
            events={filteredEvents} 
            activeLanes={activeLanes}
            zoomLevel={zoomLevel}
          />
        ) : (
          <div className="space-y-6">
            {groupedByDate.length > 0 ? (
              groupedByDate.map(([dateKey, dateEvents]) => (
                <div key={dateKey} className="space-y-3">
                  <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-2">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {formatDateGroupLabel(dateKey)}
                      <Badge variant="secondary" className="text-xs ml-2">
                        {dateEvents.length} events
                      </Badge>
                    </h3>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {dateEvents.map((event) => (
                      <TimelineEventCard key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="font-semibold">No Events Found</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery 
                      ? "Try adjusting your search terms."
                      : "Connect health sources to populate your timeline."}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
