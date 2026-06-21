import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  Calendar,
  Pill,
  Stethoscope,
  Heart,
  AlertTriangle,
  MessageSquare,
  FileText,
  GraduationCap,
  TestTube,
  Activity,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  User,
} from "lucide-react";
import { formatDate, formatTime } from "@/components/shared";

const PATIENT_ID = "patient-001";

type EventCategory = "appointment" | "message" | "medication" | "condition" | "vital" | "allergy" | "summary" | "education" | "lab_result";

interface TimelineEvent {
  id: string;
  category: EventCategory;
  title: string;
  description: string;
  date: string;
  provider?: string;
  status?: string;
  severity?: "info" | "warning" | "critical";
  metadata?: Record<string, any>;
}

interface UnifiedRecordData {
  events: TimelineEvent[];
  totalCount: number;
  filteredCount: number;
  categoryCounts: Record<string, number>;
  patient: { id: string; name: string; dateOfBirth: string };
}

const categoryConfig: Record<EventCategory, { label: string; icon: typeof Calendar; color: string; bgClass: string }> = {
  appointment: { label: "Appointments", icon: Calendar, color: "text-blue-600 dark:text-blue-400", bgClass: "bg-blue-50 dark:bg-blue-950/40" },
  condition: { label: "Conditions", icon: Heart, color: "text-rose-600 dark:text-rose-400", bgClass: "bg-rose-50 dark:bg-rose-950/40" },
  medication: { label: "Medications", icon: Pill, color: "text-violet-600 dark:text-violet-400", bgClass: "bg-violet-50 dark:bg-violet-950/40" },
  vital: { label: "Vitals", icon: Activity, color: "text-emerald-600 dark:text-emerald-400", bgClass: "bg-emerald-50 dark:bg-emerald-950/40" },
  lab_result: { label: "Lab Results", icon: TestTube, color: "text-amber-600 dark:text-amber-400", bgClass: "bg-amber-50 dark:bg-amber-950/40" },
  allergy: { label: "Allergies", icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bgClass: "bg-red-50 dark:bg-red-950/40" },
  message: { label: "Messages", icon: MessageSquare, color: "text-sky-600 dark:text-sky-400", bgClass: "bg-sky-50 dark:bg-sky-950/40" },
  summary: { label: "Summaries", icon: FileText, color: "text-teal-600 dark:text-teal-400", bgClass: "bg-teal-50 dark:bg-teal-950/40" },
  education: { label: "Education", icon: GraduationCap, color: "text-indigo-600 dark:text-indigo-400", bgClass: "bg-indigo-50 dark:bg-indigo-950/40" },
};

const allCategories: EventCategory[] = ["appointment", "condition", "medication", "vital", "lab_result", "allergy", "message", "summary", "education"];

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 0) return `In ${Math.abs(diffDays)} days`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function SeverityBadge({ severity }: { severity?: string }) {
  if (!severity || severity === "info") return null;
  if (severity === "warning") return <Badge variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 text-xs">Attention</Badge>;
  if (severity === "critical") return <Badge variant="destructive" className="text-xs">Alert</Badge>;
  return null;
}

function TimelineEventCard({ event, isExpanded, onToggle }: { event: TimelineEvent; isExpanded: boolean; onToggle: () => void }) {
  const config = categoryConfig[event.category];
  const Icon = config.icon;

  return (
    <div className="relative flex gap-3 group" data-testid={`timeline-event-${event.id}`}>
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${config.bgClass} shrink-0`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        <div className="w-px flex-1 bg-border min-h-[16px]" />
      </div>

      <Card className={`flex-1 mb-3 hover-elevate ${isExpanded ? "ring-1 ring-primary/20" : ""}`}>
        <CardContent className="p-3">
          <button
            onClick={onToggle}
            className="w-full text-left"
            data-testid={`button-expand-${event.id}`}
          >
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {config.label}
                  </Badge>
                  <SeverityBadge severity={event.severity} />
                </div>
                <h4 className="font-medium mt-1 text-sm" data-testid={`text-event-title-${event.id}`}>{event.title}</h4>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground whitespace-nowrap">{relativeTime(event.date)}</span>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </div>
          </button>

          {isExpanded && (
            <div className="mt-3 pt-3 border-t space-y-2" data-testid={`detail-${event.id}`}>
              <p className="text-sm text-muted-foreground">{event.description}</p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(event.date)} at {formatTime(event.date)}
                </span>
                {event.provider && (
                  <span className="flex items-center gap-1">
                    <Stethoscope className="w-3 h-3" />
                    {event.provider}
                  </span>
                )}
                {event.status && (
                  <span className="flex items-center gap-1">
                    Status: {event.status}
                  </span>
                )}
              </div>
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {event.category === "lab_result" && event.metadata.status && (
                    <Badge variant={event.metadata.status === "Normal" ? "secondary" : "outline"} className={`text-xs ${event.metadata.status !== "Normal" ? "text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700" : ""}`}>
                      {event.metadata.status}
                    </Badge>
                  )}
                  {event.category === "medication" && event.metadata.medication && (
                    <Badge variant="secondary" className="text-xs">Active Rx</Badge>
                  )}
                  {event.category === "message" && event.metadata.threadCount > 0 && (
                    <Badge variant="secondary" className="text-xs">{event.metadata.threadCount} replies</Badge>
                  )}
                  {event.category === "education" && event.metadata.aiGenerated && (
                    <Badge variant="secondary" className="text-xs">AI Generated</Badge>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function UnifiedPatientRecord() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategories, setActiveCategories] = useState<Set<EventCategory>>(new Set(allCategories));
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const queryCategories = activeCategories.size === allCategories.length ? "" : Array.from(activeCategories).join(",");

  const { data, isLoading, error } = useQuery<UnifiedRecordData>({
    queryKey: ["/api/telehealth/patient", PATIENT_ID, "unified-record", { search: searchTerm, categories: queryCategories, severity: severityFilter === "all" ? "" : severityFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (queryCategories) params.set("categories", queryCategories);
      if (severityFilter !== "all") params.set("severity", severityFilter);
      const res = await fetch(`/api/telehealth/patient/${PATIENT_ID}/unified-record?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load record");
      return res.json();
    },
  });

  const toggleCategory = (cat: EventCategory) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size > 1) next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const toggleEvent = (id: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const groupedEvents = useMemo(() => {
    if (!data?.events) return {};
    const groups: Record<string, TimelineEvent[]> = {};
    for (const event of data.events) {
      const key = formatDate(event.date);
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    }
    return groups;
  }, [data?.events]);

  const expandAll = () => {
    if (data?.events) {
      setExpandedEvents(new Set(data.events.map((e) => e.id)));
    }
  };

  const collapseAll = () => {
    setExpandedEvents(new Set());
  };

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-destructive">Failed to load your health record. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background/95 backdrop-blur p-4 space-y-3 sticky top-0 z-30">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold" data-testid="text-page-title">Health Journey</h1>
              {data?.patient && (
                <p className="text-sm text-muted-foreground" data-testid="text-patient-name">
                  {data.patient.name}
                  {data.totalCount !== undefined && ` \u00b7 ${data.totalCount} records`}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-filters"
            >
              <Filter className="w-4 h-4 mr-1" />
              Filters
              {activeCategories.size < allCategories.length && (
                <Badge variant="secondary" className="ml-1 text-xs">{activeCategories.size}</Badge>
              )}
            </Button>
            {data?.events && data.events.length > 0 && (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={expandAll} data-testid="button-expand-all">
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Expand
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAll} data-testid="button-collapse-all">
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Collapse
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search records, medications, providers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-9"
            data-testid="input-search"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              data-testid="button-clear-search"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {showFilters && (
          <div className="space-y-3" data-testid="filter-panel">
            <div className="flex flex-wrap gap-2">
              {allCategories.map((cat) => {
                const config = categoryConfig[cat];
                const Icon = config.icon;
                const isActive = activeCategories.has(cat);
                const count = data?.categoryCounts?.[cat] || 0;
                return (
                  <Button
                    key={cat}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleCategory(cat)}
                    className="gap-1"
                    data-testid={`filter-${cat}`}
                  >
                    <Icon className="w-3 h-3" />
                    {config.label}
                    <span className="text-xs opacity-70">({count})</span>
                  </Button>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-severity">
                  <SelectValue placeholder="All Severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warning">Attention</SelectItem>
                  <SelectItem value="critical">Alert</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActiveCategories(new Set(allCategories));
                  setSeverityFilter("all");
                  setSearchTerm("");
                }}
                data-testid="button-reset-filters"
              >
                Reset All
              </Button>
              {data && (
                <span className="text-xs text-muted-foreground ml-auto" data-testid="text-result-count">
                  Showing {data.filteredCount} of {data.totalCount} records
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20" data-testid="loading-indicator">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.events || data.events.length === 0 ? (
          <div className="text-center py-20">
            <Search className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground" data-testid="text-no-results">No records found matching your criteria.</p>
            <Button
              variant="ghost"
              onClick={() => {
                setActiveCategories(new Set(allCategories));
                setSeverityFilter("all");
                setSearchTerm("");
              }}
              data-testid="button-clear-filters"
            >
              Clear all filters
            </Button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto" data-testid="timeline-container">
            {Object.entries(groupedEvents).map(([dateLabel, events]) => (
              <div key={dateLabel}>
                <div className="flex items-center gap-2 mb-3 mt-2 sticky top-0 z-10">
                  <div className="text-xs font-medium text-muted-foreground bg-background px-2 py-1 rounded-md border" data-testid={`date-group-${dateLabel}`}>
                    {dateLabel}
                  </div>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">{events.length} events</span>
                </div>
                {events.map((event) => (
                  <TimelineEventCard
                    key={event.id}
                    event={event}
                    isExpanded={expandedEvents.has(event.id)}
                    onToggle={() => toggleEvent(event.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
