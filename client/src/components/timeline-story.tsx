import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BookOpen,
  Calendar,
  ChevronRight,
  Stethoscope,
  Pill,
  FlaskConical,
  Scan,
  Building2,
  Scissors,
  ClipboardList,
  Syringe,
  FileText,
  Lightbulb,
  RefreshCw,
} from "lucide-react";

interface HealthEvent {
  id: string;
  date: string;
  type: "visit" | "medication_started" | "medication_stopped" | "lab_result" | "imaging" | "hospitalization" | "procedure" | "diagnosis" | "vaccination";
  title: string;
  description: string;
  provider?: string;
  location?: string;
}

interface TimelineStorySection {
  period: string;
  startDate: string;
  endDate: string;
  summary: string;
  events: HealthEvent[];
  highlights: string[];
}

interface TimelineStory {
  patientName: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  overallSummary: string;
  sections: TimelineStorySection[];
  keyTakeaways: string[];
}

const eventTypeIcons: Record<HealthEvent["type"], typeof Stethoscope> = {
  visit: Stethoscope,
  medication_started: Pill,
  medication_stopped: Pill,
  lab_result: FlaskConical,
  imaging: Scan,
  hospitalization: Building2,
  procedure: Scissors,
  diagnosis: ClipboardList,
  vaccination: Syringe,
};

const eventTypeColors: Record<HealthEvent["type"], string> = {
  visit: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  medication_started: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  medication_stopped: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  lab_result: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  imaging: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  hospitalization: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  procedure: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  diagnosis: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  vaccination: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
};

const eventTypeLabels: Record<HealthEvent["type"], string> = {
  visit: "Visit",
  medication_started: "Started Med",
  medication_stopped: "Stopped Med",
  lab_result: "Lab Result",
  imaging: "Imaging",
  hospitalization: "Hospitalization",
  procedure: "Procedure",
  diagnosis: "Diagnosis",
  vaccination: "Vaccination",
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function EventCard({ event }: { event: HealthEvent }) {
  const Icon = eventTypeIcons[event.type] || FileText;

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover-elevate"
      data-testid={`timeline-event-${event.id}`}
    >
      <div className={`p-2 rounded-md ${eventTypeColors[event.type]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm" data-testid={`event-title-${event.id}`}>
            {event.title}
          </span>
          <Badge variant="secondary" className="text-xs">
            {eventTypeLabels[event.type]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1" data-testid={`event-description-${event.id}`}>
          {event.description}
        </p>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(event.date)}</span>
          {event.provider && (
            <>
              <span className="mx-1">|</span>
              <span>{event.provider}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineSectionCard({ section }: { section: TimelineStorySection }) {
  return (
    <AccordionItem value={section.period} className="border rounded-lg mb-3 overflow-visible">
      <AccordionTrigger className="px-4 py-3 hover:no-underline hover-elevate rounded-t-lg">
        <div className="flex items-center gap-3 w-full">
          <div className="p-2 rounded-md bg-primary/10">
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <h4 className="font-semibold" data-testid={`section-period-${section.period}`}>
              {section.period}
            </h4>
            <p className="text-sm text-muted-foreground font-normal">
              {section.events.length} event{section.events.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed" data-testid={`section-summary-${section.period}`}>
            {section.summary}
          </p>

          {section.highlights.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-medium flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Key Highlights
              </h5>
              <ul className="space-y-1">
                {section.highlights.map((highlight, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2 pt-2 border-t">
            <h5 className="text-sm font-medium">Events</h5>
            <div className="space-y-2">
              {section.events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function TimelineStorySkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function TimelineStoryMode() {
  const [months, setMonths] = useState("12");

  const { data: story, isLoading, refetch, isFetching } = useQuery<TimelineStory>({
    queryKey: ["/api/timeline-story", months],
    queryFn: async () => {
      const response = await fetch(`/api/timeline-story?months=${months}`);
      if (!response.ok) throw new Error("Failed to fetch timeline story");
      return response.json();
    },
  });

  return (
    <Card className="w-full" data-testid="timeline-story-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              Your Health Story
            </CardTitle>
            <CardDescription>
              Your health history, finally readable
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={months} onValueChange={setMonths}>
            <SelectTrigger className="w-32" data-testid="select-months">
              <SelectValue placeholder="Time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6 months</SelectItem>
              <SelectItem value="12">12 months</SelectItem>
              <SelectItem value="18">18 months</SelectItem>
              <SelectItem value="24">24 months</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh timeline story"
            data-testid="button-refresh-story"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <TimelineStorySkeleton />
        ) : story ? (
          <div className="space-y-6">
            <div className="space-y-3 p-4 rounded-lg bg-muted/50" data-testid="story-overview">
              <h3 className="font-semibold text-lg">Overview</h3>
              <p className="text-sm leading-relaxed" data-testid="story-summary">
                {story.overallSummary}
              </p>

              {story.keyTakeaways.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                    Key Observations
                  </h4>
                  <ul className="space-y-1">
                    {story.keyTakeaways.map((takeaway, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                        data-testid={`takeaway-${idx}`}
                      >
                        <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <ScrollArea className="h-[500px] pr-4">
              <Accordion type="multiple" className="space-y-0" data-testid="timeline-sections">
                {story.sections.map((section) => (
                  <TimelineSectionCard key={section.period} section={section} />
                ))}
              </Accordion>
            </ScrollArea>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No health history available for this period.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
