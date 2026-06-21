import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar, 
  Clock, 
  Pill, 
  Activity, 
  FileText, 
  Stethoscope, 
  Hospital, 
  Syringe,
  AlertCircle,
  BookOpen,
  ChevronRight,
  RefreshCw,
  Heart,
  TestTube,
  Image as ImageIcon,
} from "lucide-react";
import { AIDisclaimer } from "@/components/ai-transparency";
import { AiSummaryFeedback } from "@/components/ai-summary-feedback";

interface TimelineEvent {
  id: string;
  type: string;
  date: string;
  title: string;
  description: string;
  source?: string;
  provider?: string;
  significance: "routine" | "notable" | "significant" | "critical";
}

interface QuarterlyPeriod {
  quarter: string;
  startDate: string;
  endDate: string;
  events: TimelineEvent[];
  summary: string;
  keyHighlights: string[];
}

interface TimelineStory {
  patientId: string;
  generatedAt: string;
  periodMonths: number;
  periodLabel: string;
  quarters: QuarterlyPeriod[];
  overallNarrative: string;
  keyTakeaways: string[];
  eventCounts: Record<string, number>;
  disclaimer: string;
}

const eventTypeIcons: Record<string, React.ElementType> = {
  visit: Stethoscope,
  medication_started: Pill,
  medication_stopped: Pill,
  lab_result: TestTube,
  imaging: ImageIcon,
  hospitalization: Hospital,
  procedure: Activity,
  diagnosis: FileText,
  vaccination: Syringe,
};

const eventTypeLabels: Record<string, string> = {
  visit: "Visit",
  medication_started: "Medication Started",
  medication_stopped: "Medication Stopped",
  lab_result: "Lab Result",
  imaging: "Imaging",
  hospitalization: "Hospitalization",
  procedure: "Procedure",
  diagnosis: "Diagnosis",
  vaccination: "Vaccination",
};

const significanceColors: Record<string, string> = {
  routine: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  notable: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  significant: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
};

function EventCard({ event }: { event: TimelineEvent }) {
  const Icon = eventTypeIcons[event.type] || Activity;
  
  return (
    <div className="flex gap-3 p-3 rounded-lg border bg-card hover-elevate" data-testid={`event-card-${event.id}`}>
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h4 className="font-medium text-sm">{event.title}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
          </div>
          <Badge variant="outline" className={`text-xs shrink-0 ${significanceColors[event.significance]}`}>
            {event.significance}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(event.date).toLocaleDateString()}
          </span>
          {event.source && (
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {event.source}
            </span>
          )}
          {event.provider && (
            <span>{event.provider}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function QuarterSection({ quarter }: { quarter: QuarterlyPeriod }) {
  return (
    <AccordionItem value={quarter.quarter} className="border rounded-lg mb-4" data-testid={`quarter-section-${quarter.quarter.replace(/\s/g, "-")}`}>
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center justify-between w-full pr-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-primary" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-lg">{quarter.quarter}</h3>
              <p className="text-sm text-muted-foreground">
                {new Date(quarter.startDate).toLocaleDateString()} - {new Date(quarter.endDate).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="ml-auto mr-4">
            {quarter.events.length} events
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="mb-4 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Period Summary
          </h4>
          <p className="text-sm text-muted-foreground">{quarter.summary}</p>
          {quarter.keyHighlights.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {quarter.keyHighlights.map((highlight, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {highlight}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          {quarter.events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function EventCountCard({ type, count }: { type: string; count: number }) {
  const Icon = eventTypeIcons[type] || Activity;
  const label = eventTypeLabels[type] || type;
  
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-2xl font-bold">{count}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full mt-2" />
          <Skeleton className="h-4 w-3/4 mt-1" />
        </CardHeader>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function TimelineStoryPage() {
  const [period, setPeriod] = useState<string>("12");

  const { data: story, isLoading, refetch, isFetching } = useQuery<TimelineStory>({
    queryKey: ["/api/timeline-story", period],
    queryFn: async () => {
      const res = await fetch(`/api/timeline-story?period=${period}`);
      if (!res.ok) throw new Error("Failed to fetch timeline story");
      return res.json();
    },
  });

  return (
    <ScrollArea className="h-full">
      <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Heart className="w-6 h-6 text-primary" />
              Your Health Story
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Your health history, finally readable
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={period} onValueChange={setPeriod} data-testid="select-period">
              <SelectTrigger className="w-40" data-testid="select-period-trigger">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6" data-testid="option-6-months">Last 6 months</SelectItem>
                <SelectItem value="12" data-testid="option-12-months">Last 12 months</SelectItem>
                <SelectItem value="18" data-testid="option-18-months">Last 18 months</SelectItem>
                <SelectItem value="24" data-testid="option-24-months">Last 2 years</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : story ? (
          <>
            <Card data-testid="card-narrative">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Your Health Journey
                </CardTitle>
                <CardDescription>
                  {story.periodLabel} • Generated {new Date(story.generatedAt).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <AIDisclaimer text="your health record timeline" />
                <p className="text-muted-foreground leading-relaxed" data-testid="text-narrative">
                  {story.overallNarrative}
                </p>
                
                {story.keyTakeaways.length > 0 && (
                  <div className="pt-4 border-t">
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <ChevronRight className="w-4 h-4" />
                      Key Observations
                    </h4>
                    <ul className="space-y-2">
                      {story.keyTakeaways.map((takeaway, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground" data-testid={`takeaway-${idx}`}>
                          <span className="text-primary font-medium">{idx + 1}.</span>
                          {takeaway}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="event-counts">
              {Object.entries(story.eventCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([type, count]) => (
                  <EventCountCard key={type} type={type} count={count} />
                ))}
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Timeline by Quarter
              </h2>
              <Accordion type="multiple" defaultValue={story.quarters.slice(0, 2).map(q => q.quarter)} data-testid="quarterly-accordion">
                {story.quarters.map((quarter) => (
                  <QuarterSection key={quarter.quarter} quarter={quarter} />
                ))}
              </Accordion>
            </div>

            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10" data-testid="card-disclaimer">
              <CardContent className="pt-4">
                <div className="flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    {story.disclaimer}
                  </p>
                </div>
              </CardContent>
            </Card>

            <AiSummaryFeedback
              feedbackType="timeline_summary"
              summaryId={`timeline-${story.patientId}-${story.generatedAt}`}
            />
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium text-lg mb-2">Unable to Load Timeline</h3>
              <p className="text-muted-foreground text-sm mb-4">
                We couldn't generate your health timeline. Please try again.
              </p>
              <Button onClick={() => refetch()} data-testid="button-retry">
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
