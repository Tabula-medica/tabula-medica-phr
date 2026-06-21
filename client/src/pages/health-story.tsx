import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  Clock,
  FileText,
  Pill,
  Heart,
  Stethoscope,
  Activity,
  Syringe,
  Image,
  Building2,
  Calendar,
  ChevronRight,
  Download,
  Share2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  BookOpen,
  Loader2,
  ArrowRight,
  Quote,
  Link2,
  ExternalLink,
} from "lucide-react";

interface HealthEvent {
  id: string;
  date: string;
  type: string;
  title: string;
  description: string;
  source: string;
  sourceFacility: string;
  details?: Record<string, unknown>;
}

interface Citation {
  id: string;
  eventId: string;
  text: string;
  date: string;
  source: string;
  type: string;
}

interface AISummarySection {
  title: string;
  content: string;
  citations: Citation[];
}

interface HealthStorySummary {
  generatedAt: string;
  overallNarrative: string;
  keyFindings: string[];
  sections: AISummarySection[];
  recommendations: string[];
  citations: Citation[];
  disclaimer: string;
}

interface HealthStoryData {
  patientName: string;
  dateRange: { start: string; end: string };
  eventCount: number;
  sourceCount: number;
  duplicatesResolved: number;
  timeline: HealthEvent[];
  summary: HealthStorySummary | null;
}

const eventTypeIcons: Record<string, React.ElementType> = {
  encounter: Stethoscope,
  visit: Stethoscope,
  diagnosis: Heart,
  medication: Pill,
  lab_result: FileText,
  imaging: Image,
  procedure: Stethoscope,
  immunization: Syringe,
  vital_sign: Activity,
  hospitalization: Building2,
};

const eventTypeColors: Record<string, string> = {
  encounter: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  visit: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  diagnosis: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  medication: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  lab_result: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  imaging: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  procedure: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  immunization: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  vital_sign: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  hospitalization: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CitationBadge({ citation, onClick }: { citation: Citation; onClick: () => void }) {
  return (
    <Badge
      variant="outline"
      className="cursor-pointer hover-elevate"
      onClick={onClick}
      data-testid={`citation-${citation.id}`}
    >
      <Link2 className="h-3 w-3 mr-1" />
      <span className="font-medium">{citation.id}</span>
    </Badge>
  );
}

function TimelineEventCard({ 
  event, 
  isHighlighted,
  onSelect 
}: { 
  event: HealthEvent; 
  isHighlighted: boolean;
  onSelect: () => void;
}) {
  const Icon = eventTypeIcons[event.type] || FileText;
  const colorClass = eventTypeColors[event.type] || "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300";

  return (
    <div
      className={`relative flex gap-4 p-4 rounded-lg border transition-all cursor-pointer hover-elevate ${
        isHighlighted ? "ring-2 ring-primary bg-primary/5" : "bg-card"
      }`}
      onClick={onSelect}
      data-testid={`timeline-event-${event.id}`}
    >
      <div className="flex flex-col items-center gap-2">
        <div className={`p-2 rounded-full ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="w-px flex-1 bg-border" />
      </div>
      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-medium text-sm">{event.title}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">
            {event.sourceFacility}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(event.date)}</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  highlight 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number; 
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary bg-primary/5" : ""}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={`p-3 rounded-full ${highlight ? "bg-primary/10" : "bg-muted"}`}>
          <Icon className={`h-5 w-5 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HealthStory() {
  const { toast } = useToast();
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("summary");

  const storyQuery = useQuery<{ success: boolean; data: HealthStoryData }>({
    queryKey: ["/api/health-story"],
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/health-story/generate-summary");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-story"] });
      toast({
        title: "Summary generated",
        description: "Your health story summary has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to generate summary",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const story = storyQuery.data?.data;
  const timeline = story?.timeline || [];
  const summary = story?.summary;

  const groupedTimeline = useMemo(() => {
    const groups: Record<string, HealthEvent[]> = {};
    timeline.forEach((event) => {
      const year = new Date(event.date).getFullYear().toString();
      if (!groups[year]) groups[year] = [];
      groups[year].push(event);
    });
    return Object.entries(groups).sort(([a], [b]) => Number(b) - Number(a));
  }, [timeline]);

  const handleCitationClick = (citation: Citation) => {
    setHighlightedEventId(citation.eventId);
    setActiveTab("timeline");
    setTimeout(() => {
      const element = document.querySelector(`[data-testid="timeline-event-${citation.eventId}"]`);
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  if (storyQuery.isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (storyQuery.isError) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Health Story</AlertTitle>
          <AlertDescription>
            Unable to load your health story. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
            <BookOpen className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Your Health Story</h1>
            <p className="text-muted-foreground">
              A complete view of your health journey with AI insights
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" data-testid="button-share-story">
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="outline" size="sm" data-testid="button-download-story">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={FileText}
          label="Health Records"
          value={story?.eventCount || 0}
        />
        <StatCard
          icon={Building2}
          label="Connected Sources"
          value={story?.sourceCount || 0}
        />
        <StatCard
          icon={CheckCircle2}
          label="Duplicates Resolved"
          value={story?.duplicatesResolved || 0}
          highlight={!!story?.duplicatesResolved}
        />
        <StatCard
          icon={Calendar}
          label="Date Range"
          value={story?.dateRange ? `${new Date(story.dateRange.start).getFullYear()}-${new Date(story.dateRange.end).getFullYear()}` : "N/A"}
        />
      </div>

      <Alert className="mb-6 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-800 dark:text-yellow-200">
          Educational Content Only
        </AlertTitle>
        <AlertDescription className="text-yellow-700 dark:text-yellow-300">
          AI-generated summaries are for informational purposes only and do not constitute medical advice. 
          Always consult with your healthcare provider for medical decisions.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="summary" data-testid="tab-summary">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Summary
          </TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">
            <Clock className="h-4 w-4 mr-2" />
            Timeline ({timeline.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          {!summary ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Generate AI Summary</h3>
                <p className="text-muted-foreground text-center mb-4 max-w-md">
                  Let AI analyze your health records and create a comprehensive summary 
                  with citations to specific events in your timeline.
                </p>
                <Button
                  onClick={() => generateSummaryMutation.mutate()}
                  disabled={generateSummaryMutation.isPending}
                  data-testid="button-generate-summary"
                >
                  {generateSummaryMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing Records...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate Summary
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Health Overview</CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => generateSummaryMutation.mutate()}
                      disabled={generateSummaryMutation.isPending}
                      data-testid="button-refresh-summary"
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${generateSummaryMutation.isPending ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>
                  <CardDescription>
                    Generated on {formatDate(summary.generatedAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-base leading-relaxed">{summary.overallNarrative}</p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Key Findings</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {summary.keyFindings.map((finding, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 text-primary mt-1 shrink-0" />
                          <span className="text-sm">{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Quote className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Source Citations</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-40">
                      <div className="space-y-2">
                        {summary.citations.map((citation) => (
                          <button
                            key={citation.id}
                            onClick={() => handleCitationClick(citation)}
                            className="w-full text-left p-2 rounded-lg border hover-elevate transition-all"
                            data-testid={`citation-link-${citation.id}`}
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="shrink-0">
                                [{citation.id}]
                              </Badge>
                              <span className="text-sm font-medium truncate">{citation.text}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(citation.date)}</span>
                              <span className="mx-1">-</span>
                              <span>{citation.source}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {summary.sections.map((section, i) => (
                <Card key={i}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{section.content}</p>
                    {section.citations.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-muted-foreground">Sources:</span>
                        {section.citations.map((citation) => (
                          <CitationBadge
                            key={citation.id}
                            citation={citation}
                            onClick={() => handleCitationClick(citation)}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Health Timeline
              </CardTitle>
              <CardDescription>
                Your complete health journey from all connected sources
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                {groupedTimeline.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No health events found</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {groupedTimeline.map(([year, events]) => (
                      <div key={year}>
                        <div className="flex items-center gap-2 mb-4">
                          <Badge variant="secondary" className="text-sm font-medium">
                            {year}
                          </Badge>
                          <Separator className="flex-1" />
                          <span className="text-xs text-muted-foreground">
                            {events.length} events
                          </span>
                        </div>
                        <div className="space-y-2 ml-2">
                          {events.map((event) => (
                            <TimelineEventCard
                              key={event.id}
                              event={event}
                              isHighlighted={highlightedEventId === event.id}
                              onSelect={() => setHighlightedEventId(event.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
