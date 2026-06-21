import { useState, useCallback, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Clock,
  Search,
  X,
  Sparkles,
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  FileText,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { Link } from "wouter";
import {
  TimelineEventCard,
  FilterChipBar,
  TimelineLoadingSkeleton,
  TimelineEmptyState,
  formatEventType,
  generateKeyValues,
  generateProvenance,
  type TimelineEventWithSource,
  type ExplainContext,
} from "@/components/timeline-shared";
import { ExplainDialog } from "@/components/explain-dialog";
import { HealthRecordDetail } from "@/components/health-record-detail";
import { useUnifiedTimeline } from "@/hooks/use-unified-timeline";

interface UnifiedSummaryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UnifiedSummaryPanel({ open, onOpenChange }: UnifiedSummaryPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [explainContext, setExplainContext] = useState<ExplainContext | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEventWithSource | null>(null);
  const [narrativeExpanded, setNarrativeExpanded] = useState(true);
  const [visibleCount, setVisibleCount] = useState(20);
  const [wantNarrative, setWantNarrative] = useState(false);

  const { events, narrative, isLoading, isFetching, isNarrativeLoading, refetch, regenerateNarrative } = useUnifiedTimeline({
    includeNarrative: wantNarrative,
    enabled: open,
    autoRefresh: open,
  });

  useEffect(() => {
    if (open && events.length > 0 && !wantNarrative) {
      setWantNarrative(true);
    }
  }, [open, events.length, wantNarrative]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleRegenerateNarrative = useCallback(() => {
    regenerateNarrative();
  }, [regenerateNarrative]);

  const filteredEvents = (events || []).filter(event => {
    if (selectedTypes.length > 0 && !selectedTypes.includes(event.type)) {
      return false;
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const searchable = `${event.title} ${event.description} ${event.provider || ''} ${event.sourceFacility}`.toLowerCase();
      if (!searchable.includes(query)) return false;
    }
    return true;
  });

  const visibleEvents = filteredEvents.slice(0, visibleCount);
  const hasMore = visibleCount < filteredEvents.length;

  const handleFilterClick = useCallback((id: string) => {
    if (id === "all") {
      setSelectedTypes([]);
    } else {
      setSelectedTypes([id]);
    }
    setVisibleCount(20);
  }, []);

  const eventTypeCounts = (events || []).reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:w-[480px] md:w-[540px] p-0 flex flex-col" data-testid="panel-unified-summary">
          <SheetHeader className="px-4 pt-4 pb-2 border-b shrink-0">
            <SheetTitle className="flex items-center justify-between" data-testid="text-summary-title">
              <span className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Health Summary
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleRefresh}
                disabled={isFetching}
                aria-label="Refresh summary"
                data-testid="button-refresh-summary"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              <Card className="border-primary/20 bg-primary/5" data-testid="card-ai-narrative">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">AI Health Overview</span>
                      <Badge variant="secondary" className="text-xs">AI</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setNarrativeExpanded(!narrativeExpanded)}
                      data-testid="button-toggle-narrative"
                    >
                      {narrativeExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>

                  {narrativeExpanded && (
                    <div data-testid="narrative-content">
                      {isNarrativeLoading ? (
                        <div className="flex items-center gap-2 py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">Generating your health overview...</span>
                        </div>
                      ) : narrative ? (
                        <div className="space-y-2">
                          <p className="text-sm leading-relaxed" data-testid="text-narrative">
                            {narrative}
                          </p>
                          <div className="flex items-start gap-1.5 pt-1">
                            <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground italic">
                              AI-generated summary for informational purposes only. Always consult your healthcare provider.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {events && events.length > 0
                            ? "Your AI health overview is loading..."
                            : "Connect health data sources to get your AI-generated health overview."}
                        </p>
                      )}

                      {!isNarrativeLoading && events && events.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 w-full"
                          onClick={handleRegenerateNarrative}
                          data-testid="button-regenerate-narrative"
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          {narrative ? "Regenerate" : "Generate"} Summary
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {!isLoading && events && events.length > 0 && (
                <div className="flex flex-wrap gap-2" data-testid="event-type-counts">
                  {Object.entries(eventTypeCounts).sort(([,a], [,b]) => b - a).map(([type, count]) => (
                    <Badge
                      key={type}
                      variant={selectedTypes.includes(type) ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => handleFilterClick(selectedTypes.includes(type) ? "all" : type)}
                      data-testid={`badge-count-${type}`}
                    >
                      {formatEventType(type)}: {count}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setVisibleCount(20); }}
                  className="pl-9 pr-8"
                  data-testid="input-summary-search"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                    onClick={() => setSearchQuery("")}
                    data-testid="button-clear-search"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <FilterChipBar selectedTypes={selectedTypes} onFilterClick={handleFilterClick} />

              {!isLoading && filteredEvents.length > 0 && (
                <p className="text-xs text-muted-foreground" data-testid="text-summary-results-count">
                  Showing {visibleEvents.length} of {filteredEvents.length} events
                </p>
              )}

              {isLoading ? (
                <TimelineLoadingSkeleton count={3} />
              ) : filteredEvents.length === 0 ? (
                <TimelineEmptyState
                  hasFilters={!!searchQuery || selectedTypes.length > 0}
                  onClearFilters={() => { setSearchQuery(""); setSelectedTypes([]); }}
                />
              ) : (
                <div className="space-y-1">
                  {visibleEvents.map(event => (
                    <TimelineEventCard
                      key={event.id}
                      event={event}
                      onExplain={setExplainContext}
                      onViewDetails={setSelectedEvent}
                      compact
                    />
                  ))}
                  {hasMore && (
                    <div className="flex justify-center py-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVisibleCount(prev => prev + 20)}
                        data-testid="button-load-more-summary"
                      >
                        Load more events
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 pb-4">
                <Button
                  variant="outline"
                  className="w-full"
                  asChild
                  data-testid="button-view-full-timeline"
                >
                  <Link href="/timeline" onClick={() => onOpenChange(false)}>
                    <Clock className="h-4 w-4 mr-2" />
                    View Full Timeline
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {explainContext && (
        <ExplainDialog
          open={!!explainContext}
          onOpenChange={(o) => !o && setExplainContext(null)}
          term={explainContext.term}
          recordType={explainContext.recordType}
          sourceQuote={explainContext.sourceQuote}
        />
      )}

      <Sheet open={!!selectedEvent} onOpenChange={(o) => !o && setSelectedEvent(null)}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-xl overflow-auto" data-testid="sheet-summary-record-detail">
          <SheetHeader className="pb-4">
            <SheetTitle>Record Details</SheetTitle>
          </SheetHeader>
          {selectedEvent && (
            <HealthRecordDetail
              title={selectedEvent.title}
              type={formatEventType(selectedEvent.type)}
              date={selectedEvent.date}
              keyValues={generateKeyValues(selectedEvent)}
              provenance={generateProvenance(selectedEvent)}
              description={selectedEvent.description}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
