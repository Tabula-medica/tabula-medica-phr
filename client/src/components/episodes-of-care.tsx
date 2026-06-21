import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  Activity,
  Pill,
  Stethoscope,
  HeartPulse,
  Syringe,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Link2,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

export type EpisodeType = 
  | "surgical" 
  | "chronic_management" 
  | "acute_illness" 
  | "preventive_care" 
  | "diagnostic_workup"
  | "rehabilitation"
  | "medication_management";

export type EpisodeStatus = "active" | "completed" | "ongoing";

export interface EpisodeEvent {
  eventId: string;
  domain: string;
  name: string;
  description?: string;
  date: string;
  role: "trigger" | "treatment" | "followup" | "monitoring" | "outcome";
  sequence: number;
}

export interface EpisodeOfCare {
  id: string;
  patientId: string;
  type: EpisodeType;
  title: string;
  description: string;
  status: EpisodeStatus;
  startDate: string;
  endDate?: string;
  primaryCondition?: string;
  events: EpisodeEvent[];
  relatedConditions: string[];
  careSummary: string;
  outcomeStatus?: "improved" | "stable" | "worsening" | "resolved" | "pending";
  providers: string[];
  color: string;
  createdAt: string;
  updatedAt: string;
}

interface EpisodesOfCareProps {
  episodes: EpisodeOfCare[];
  onEventClick?: (eventId: string) => void;
  isLoading?: boolean;
}

const getDomainIcon = (domain: string) => {
  switch (domain) {
    case "medications": return <Pill className="h-3 w-3" />;
    case "procedures": return <Stethoscope className="h-3 w-3" />;
    case "vitals": return <HeartPulse className="h-3 w-3" />;
    case "conditions": return <AlertCircle className="h-3 w-3" />;
    case "immunizations": return <Syringe className="h-3 w-3" />;
    default: return <Activity className="h-3 w-3" />;
  }
};

const getRoleColor = (role: EpisodeEvent["role"]) => {
  switch (role) {
    case "trigger": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "treatment": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "followup": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
    case "monitoring": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "outcome": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default: return "bg-muted text-muted-foreground";
  }
};

const getStatusBadge = (status: EpisodeStatus) => {
  switch (status) {
    case "active":
      return <Badge variant="default" className="bg-blue-500">Active</Badge>;
    case "completed":
      return <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Completed</Badge>;
    case "ongoing":
      return <Badge variant="outline" className="border-purple-500 text-purple-600">Ongoing</Badge>;
    default:
      return null;
  }
};

const getOutcomeIcon = (outcome?: EpisodeOfCare["outcomeStatus"]) => {
  switch (outcome) {
    case "improved":
    case "resolved":
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "worsening":
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case "stable":
      return <Minus className="h-4 w-4 text-blue-500" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

const getTypeLabel = (type: EpisodeType) => {
  const labels: Record<EpisodeType, string> = {
    surgical: "Surgical Care",
    chronic_management: "Chronic Management",
    acute_illness: "Acute Illness",
    preventive_care: "Preventive Care",
    diagnostic_workup: "Diagnostic Workup",
    rehabilitation: "Rehabilitation",
    medication_management: "Medication Management",
  };
  return labels[type] || type;
};

function EpisodeCard({ episode, onEventClick }: { episode: EpisodeOfCare; onEventClick?: (eventId: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDuration = () => {
    const start = new Date(episode.startDate);
    const end = episode.endDate ? new Date(episode.endDate) : new Date();
    const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (days < 7) return `${days} days`;
    if (days < 30) return `${Math.floor(days / 7)} weeks`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    return `${Math.floor(days / 365)} years`;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card 
        className="border-l-4 hover-elevate transition-colors"
        style={{ borderLeftColor: episode.color }}
        data-testid={`episode-card-${episode.id}`}
      >
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3 px-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div 
                  className="p-2 rounded-lg shrink-0"
                  style={{ backgroundColor: `${episode.color}20` }}
                >
                  <Link2 className="h-4 w-4" style={{ color: episode.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-sm font-medium truncate">{episode.title}</CardTitle>
                    {getStatusBadge(episode.status)}
                  </div>
                  <CardDescription className="text-xs mt-1 flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(episode.startDate)}
                      {episode.endDate && ` - ${formatDate(episode.endDate)}`}
                    </span>
                    <span className="text-muted-foreground">({getDuration()})</span>
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1">
                  {getOutcomeIcon(episode.outcomeStatus)}
                  <span className="text-xs text-muted-foreground capitalize">{episode.outcomeStatus || "pending"}</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {episode.events.length} events
                </Badge>
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            <Separator className="mb-4" />
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">{episode.careSummary}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">{getTypeLabel(episode.type)}</Badge>
                  {episode.relatedConditions.map((cond, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{cond}</Badge>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Care Pathway Timeline
                </h4>
                <div className="relative pl-6">
                  <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-border" />
                  
                  {episode.events.map((event, index) => (
                    <div 
                      key={event.eventId}
                      className="relative pb-4 last:pb-0"
                      data-testid={`episode-event-${event.eventId}`}
                    >
                      <div 
                        className="absolute left-[-18px] top-1 w-3 h-3 rounded-full border-2 border-background"
                        style={{ backgroundColor: episode.color }}
                      />
                      
                      <Button
                        variant="ghost"
                        className="w-full justify-start h-auto py-2 px-3 text-left"
                        onClick={() => onEventClick?.(event.eventId)}
                        data-testid={`btn-event-${event.eventId}`}
                      >
                        <div className="flex items-start gap-3 w-full">
                          <div className="shrink-0 mt-0.5">
                            {getDomainIcon(event.domain)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{event.name}</span>
                              <Badge className={`text-xs ${getRoleColor(event.role)}`}>
                                {event.role}
                              </Badge>
                            </div>
                            {event.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDate(event.date)}
                            </p>
                          </div>
                          {index < episode.events.length - 1 && (
                            <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function EpisodesOfCareList({ episodes, onEventClick, isLoading }: EpisodesOfCareProps) {
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");

  const filteredEpisodes = episodes.filter(ep => {
    if (filter === "all") return true;
    if (filter === "active") return ep.status === "active" || ep.status === "ongoing";
    if (filter === "completed") return ep.status === "completed";
    return true;
  });

  const activeCount = episodes.filter(e => e.status === "active" || e.status === "ongoing").length;
  const completedCount = episodes.filter(e => e.status === "completed").length;

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="episodes-loading">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-5 w-48 bg-muted rounded" />
              <div className="h-4 w-32 bg-muted rounded mt-2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  if (episodes.length === 0) {
    return (
      <Card data-testid="episodes-empty">
        <CardContent className="py-12 text-center">
          <Link2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-medium mb-1">No Episodes Detected</h3>
          <p className="text-sm text-muted-foreground">
            Clinical events will be grouped into care episodes when related events are detected.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" data-testid="episodes-of-care-list">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <h3 className="font-medium">Episodes of Care</h3>
          <Badge variant="secondary">{episodes.length} total</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            data-testid="btn-filter-all"
          >
            All ({episodes.length})
          </Button>
          <Button
            variant={filter === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("active")}
            data-testid="btn-filter-active"
          >
            Active ({activeCount})
          </Button>
          <Button
            variant={filter === "completed" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("completed")}
            data-testid="btn-filter-completed"
          >
            Completed ({completedCount})
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4 mb-4">
        <Card data-testid="stat-total-episodes">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Link2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{episodes.length}</p>
                <p className="text-xs text-muted-foreground">Total Episodes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-active-episodes">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Active/Ongoing</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-completed-episodes">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-linked-events">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{episodes.reduce((sum, ep) => sum + ep.events.length, 0)}</p>
                <p className="text-xs text-muted-foreground">Linked Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ScrollArea className="h-[500px]">
        <div className="space-y-3 pr-4">
          {filteredEpisodes.map(episode => (
            <EpisodeCard
              key={episode.id}
              episode={episode}
              onEventClick={onEventClick}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
