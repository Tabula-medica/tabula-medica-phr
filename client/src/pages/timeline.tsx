import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { GuidedTour, useCompletedTours } from "@/components/guided-tour";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiRequest } from "@/lib/queryClient";
import { 
  Clock, 
  Search, 
  Stethoscope,
  Pill,
  FileText,
  Activity,
  Syringe,
  X,
  Info,
  Building2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Image,
  Heart,
  ClipboardList,
  Watch,
  Link2,
  ArrowRight,
  Languages,
  Plus,
  Share2,
} from "lucide-react";
import { Link } from "wouter";
import { TranslateButton } from "@/components/translate-button";
import type { TimelineEvent, EhrConnection } from "@shared/schema";
import { useUnifiedTimeline } from "@/hooks/use-unified-timeline";
import { HealthRecordDetail } from "@/components/health-record-detail";
import { ExplainDialog } from "@/components/explain-dialog";
import { AdvancedSearchFilter, useAdvancedFilters, defaultFilters, type SearchFilters, type FilterOption } from "@/components/advanced-search-filter";
import {
  filterChips,
  eventTypeIcons,
  eventTypeColors,
  TimelineEventCard,
  SourceBadge,
  FilterChip,
  formatEventType,
  generateKeyValues,
  generateProvenance,
  type TimelineEventWithSource,
  type ExplainContext,
} from "@/components/timeline-shared";

function LoadMoreRow({ 
  isLoading, 
  hasMore, 
  onLoadMore 
}: { 
  isLoading: boolean; 
  hasMore: boolean; 
  onLoadMore: () => void;
}) {
  if (!hasMore) return null;
  
  return (
    <div className="flex justify-center py-6" data-testid="load-more-row">
      <Button 
        variant="outline" 
        onClick={onLoadMore}
        disabled={isLoading}
        className="min-w-[200px]"
        data-testid="button-load-more"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading more...
          </>
        ) : (
          "Load more events"
        )}
      </Button>
    </div>
  );
}

const timelineTypeOptions: FilterOption[] = filterChips.filter(c => c.id !== "all").map(c => ({
  id: c.id,
  label: c.label,
  icon: c.icon,
}));


export default function Timeline() {
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [explainContext, setExplainContext] = useState<ExplainContext | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEventWithSource | null>(null);
  const [showTour, setShowTour] = useState(false);
  const { isComplete } = useCompletedTours();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const hasLoggedOpened = useRef(false);

  const logAnalytics = useMutation({
    mutationFn: async ({ eventType, metadata }: { eventType: string; metadata?: Record<string, string> }) => {
      return apiRequest("POST", "/api/timeline/analytics", { eventType, metadata });
    },
  });

  useEffect(() => {
    if (!hasLoggedOpened.current) {
      hasLoggedOpened.current = true;
      logAnalytics.mutate({ eventType: "timeline_opened" });
    }
  }, []);

  useEffect(() => {
    const hasSeenTour = isComplete("timeline");
    const isFirstVisit = !localStorage.getItem("tabula_timeline_visited");
    if (!hasSeenTour && isFirstVisit) {
      localStorage.setItem("tabula_timeline_visited", "true");
      const timer = setTimeout(() => setShowTour(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [isComplete]);


  const { events: rawEvents, isLoading, error } = useUnifiedTimeline();
  const events = rawEvents.length > 0 ? rawEvents : undefined;

  const filteredEvents = useAdvancedFilters(
    events || [],
    filters,
    {
      getKeywords: (event) => [event.title, event.description, event.provider || "", event.sourceFacility],
      getDate: (event) => event.date,
      getType: (event) => event.type,
      getTags: () => [],
    }
  );

  const hasActiveFilters = filters.keyword || filters.dateRange.from || filters.dateRange.to || 
    filters.selectedTypes.length > 0 || filters.selectedTags.length > 0;

  const visibleEvents = filteredEvents.slice(0, visibleCount);
  const hasMore = visibleCount < filteredEvents.length;

  interface TypeGroup {
    type: string;
    events: TimelineEventWithSource[];
  }

  interface DateGroup {
    date: string;
    typeGroups: TypeGroup[];
    totalCount: number;
  }

  const groupEventsByDateAndType = (events: TimelineEventWithSource[]): DateGroup[] => {
    const dateMap = new Map<string, Map<string, TimelineEventWithSource[]>>();
    
    events.forEach(event => {
      const date = new Date(event.date);
      const dateKey = date.toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
      });
      
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, new Map<string, TimelineEventWithSource[]>());
      }
      
      const typeMap = dateMap.get(dateKey)!;
      if (!typeMap.has(event.type)) {
        typeMap.set(event.type, []);
      }
      typeMap.get(event.type)!.push(event);
    });
    
    const result: DateGroup[] = [];
    dateMap.forEach((typeMap, dateKey) => {
      const typeGroups: TypeGroup[] = [];
      let totalCount = 0;
      
      typeMap.forEach((events, type) => {
        typeGroups.push({ type, events });
        totalCount += events.length;
      });
      
      typeGroups.sort((a, b) => a.type.localeCompare(b.type));
      result.push({ date: dateKey, typeGroups, totalCount });
    });
    
    return result;
  };

  const groupedEvents = groupEventsByDateAndType(visibleEvents);

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(prev => prev + 20);
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [handleLoadMore, hasMore, isLoadingMore]);

  const handleFilterClick = (filterId: string) => {
    if (filterId === "all") {
      setFilters(prev => ({ ...prev, selectedTypes: [] }));
    } else {
      setFilters(prev => ({ ...prev, selectedTypes: [filterId] }));
    }
    setVisibleCount(20);
    logAnalytics.mutate({ 
      eventType: "timeline_filter_applied", 
      metadata: { filter: filterId } 
    });
  };

  const handleItemOpened = (event: TimelineEventWithSource) => {
    setSelectedEvent(event);
    logAnalytics.mutate({ 
      eventType: "timeline_item_opened", 
      metadata: { itemType: event.type, itemId: event.id } 
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in">
      <div className="p-4 md:p-6 space-y-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Timeline</h1>
            <p className="text-muted-foreground">Your complete health history from all sources</p>
          </div>
          <div className="flex items-center gap-2">
            <Button data-testid="button-add-event">
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
            <Button variant="outline" asChild data-testid="button-export-timeline">
              <Link href="/care-packets">
                <Share2 className="h-4 w-4 mr-2" />
                Export
              </Link>
            </Button>
          </div>
        </div>

        {/* Advanced Search Filter */}
        <AdvancedSearchFilter
          placeholder="Search timeline (e.g., 'lipid panel', 'metformin')..."
          typeOptions={timelineTypeOptions}
          tagOptions={[]}
          showDateFilter={true}
          showTypeFilter={true}
          showTagFilter={false}
          filters={filters}
          onFiltersChange={(newFilters) => {
            setFilters(newFilters);
            setVisibleCount(20);
          }}
        />
        
        {/* Quick Filter Chips */}
        <ScrollArea className="w-full" data-testid="timeline-filters">
          <div className="flex flex-wrap gap-2 pb-2" data-testid="filter-chips-container">
            {filterChips.map(chip => (
              <FilterChip
                key={chip.id}
                id={chip.id}
                label={chip.label}
                icon={chip.icon}
                isActive={chip.id === "all" ? filters.selectedTypes.length === 0 : filters.selectedTypes.includes(chip.id)}
                onClick={() => handleFilterClick(chip.id)}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        
        {/* Results count */}
        {!isLoading && (
          <p className="text-sm text-muted-foreground" data-testid="text-results-count">
            {filteredEvents.length > 0 ? (
              <>Showing {visibleEvents.length} of {filteredEvents.length} events{hasActiveFilters && ' (filtered)'}</>
            ) : hasActiveFilters ? (
              'No events match your filters'
            ) : null}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 pt-0">
        {isLoading ? (
          <div className="space-y-4" data-testid="timeline-loading">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="pl-12">
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : error ? (
          <Card className="p-8 text-center" data-testid="timeline-error">
            <Clock className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Unable to Load Timeline</h3>
            <p className="text-muted-foreground">
              There was a problem loading your health timeline. Please try again later.
            </p>
          </Card>
        ) : filteredEvents.length === 0 ? (
          <Card className="p-8 text-center" data-testid="timeline-empty">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2" data-testid="text-empty-title">
              {hasActiveFilters ? "No Matching Events" : "Your Timeline is Empty"}
            </h3>
            <p className="text-muted-foreground mb-4" data-testid="text-empty-description">
              {hasActiveFilters
                ? "Try adjusting your search terms or clearing filters to see more results."
                : "Connect your health data sources to start building your unified health timeline."}
            </p>
            {!hasActiveFilters && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                  <span>Link your EHR providers to import records</span>
                </div>
                <Button 
                  variant="default" 
                  onClick={() => window.location.href = "/connections"}
                  data-testid="button-connect-sources"
                >
                  Connect Data Sources
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
            {hasActiveFilters && (
              <Button 
                variant="outline" 
                onClick={() => setFilters(defaultFilters)}
                data-testid="button-clear-filters"
              >
                Clear All Filters
              </Button>
            )}
          </Card>
        ) : (
          <div className="relative space-y-8">
            {groupedEvents.map((dateGroup) => (
              <div key={dateGroup.date} data-testid={`group-${dateGroup.date.replace(/\s+/g, '-').toLowerCase()}`}>
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2 mb-4 border-b">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h2 className="text-base font-semibold flex items-center gap-2" data-testid={`text-group-header-${dateGroup.date.replace(/\s+/g, '-').toLowerCase()}`}>
                      <Clock className="h-4 w-4 text-primary" />
                      {dateGroup.date}
                      <Badge variant="secondary" className="ml-2">{dateGroup.totalCount} events</Badge>
                    </h2>
                    <TranslateButton
                      documentId={`timeline-${dateGroup.date.replace(/\s+/g, '-').toLowerCase()}`}
                      documentType="timeline_monthly"
                      originalTitle={`${dateGroup.date} Summary`}
                      originalContent={`Monthly health summary for ${dateGroup.date}: ${dateGroup.totalCount} health events including ${dateGroup.typeGroups.map(g => `${g.events.length} ${g.type.replace('_', ' ')}s`).join(', ')}.`}
                      variant="ghost"
                      size="sm"
                    />
                  </div>
                </div>
                
                <div className="space-y-6">
                  {dateGroup.typeGroups.map((typeGroup) => {
                    const TypeIcon = eventTypeIcons[typeGroup.type] || FileText;
                    const colorClass = eventTypeColors[typeGroup.type] || "bg-muted text-muted-foreground";
                    return (
                      <div key={typeGroup.type} data-testid={`subgroup-${typeGroup.type}`}>
                        <div className="flex items-center gap-2 mb-3 ml-2">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full ${colorClass}`}>
                            <TypeIcon className="h-3 w-3" />
                          </div>
                          <h3 className="text-sm font-medium text-muted-foreground capitalize">
                            {typeGroup.type.replace('_', ' ')}s
                          </h3>
                          <span className="text-xs text-muted-foreground">({typeGroup.events.length})</span>
                        </div>
                        {typeGroup.events.map(event => (
                          <TimelineEventCard
                            key={event.id}
                            event={event}
                            onExplain={setExplainContext}
                            onViewDetails={handleItemOpened}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            
            <div ref={loadMoreRef} className="py-4">
              {isLoadingMore && (
                <div className="flex justify-center" data-testid="infinite-scroll-loader">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {!hasMore && filteredEvents.length > 0 && (
                <p className="text-center text-sm text-muted-foreground" data-testid="text-end-of-timeline">
                  You have reached the end of your timeline
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {explainContext && (
        <ExplainDialog
          open={!!explainContext}
          onOpenChange={(open) => !open && setExplainContext(null)}
          term={explainContext.term}
          recordType={explainContext.recordType}
          sourceQuote={explainContext.sourceQuote}
        />
      )}

      <div className="px-4 py-3 border-t flex-shrink-0">
        <ClinicalDisclaimer variant="compact" className="mt-0" testId="text-timeline-disclaimer" />
      </div>

      <Sheet open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-xl overflow-auto" data-testid="sheet-record-detail">
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

      {showTour && (
        <GuidedTour
          tourId="timeline"
          steps={[
            {
              target: "[data-testid='timeline-filters']",
              title: "Filter Your Timeline",
              content: "Use filters to focus on specific types of health events like labs, encounters, or medications.",
              placement: "bottom",
            },
            {
              target: "[data-testid='timeline-search']",
              title: "Search Events",
              content: "Search for specific conditions, medications, or providers across your entire health history.",
              placement: "bottom",
            },
          ]}
          onComplete={() => setShowTour(false)}
          onSkip={() => setShowTour(false)}
        />
      )}
    </div>
  );
}
