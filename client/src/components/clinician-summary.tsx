import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Sparkles,
  Activity,
  Heart,
  Pill,
  Calendar,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  User,
  Loader2,
  RefreshCw,
  ClipboardList,
  Stethoscope,
  Brain,
  Quote,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface KeyChange {
  category: string;
  description: string;
  timeframe: string;
  significance: string;
}

interface PatientConcern {
  concern: string;
  source: string;
  frequency?: string;
  relatedSymptoms?: string[];
}

interface DiscussionPoint {
  topic: string;
  context: string;
  suggestedQuestions?: string[];
}

interface ClinicianHealthSummary {
  patientId: string;
  patientName: string;
  generatedAt: string;
  reportPeriod: string;
  executiveSummary: string;
  keyChanges: KeyChange[];
  patientReportedConcerns: PatientConcern[];
  symptomOverview: {
    totalEntries: number;
    mostFrequent: Array<{ name: string; count: number; avgSeverity: string }>;
    recentTrends: string[];
    triggerPatterns: string[];
  };
  vitalSignsSummary: {
    currentReadings: Array<{ type: string; value: string; trend: string }>;
    outOfRangeFlags: string[];
  };
  medicationNotes: string[];
  journalHighlights: {
    moodTrends: string;
    patientQuotes: string[];
    emotionalPatterns: string[];
  };
  discussionPoints: DiscussionPoint[];
  upcomingCare: Array<{ type: string; date: string; provider: string }>;
  disclaimer: string;
}

function SignificanceBadge({ significance }: { significance: string }) {
  const colors: Record<string, string> = {
    routine: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    notable: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    significant: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };
  return (
    <Badge className={colors[significance] || colors.routine} variant="secondary">
      {significance}
    </Badge>
  );
}

function CategoryIcon({ category }: { category: string }) {
  const icons: Record<string, typeof Activity> = {
    symptom: Activity,
    vital: Heart,
    medication: Pill,
    condition: Stethoscope,
    general: FileText,
  };
  const Icon = icons[category] || FileText;
  return <Icon className="h-4 w-4" />;
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "increasing") return <TrendingUp className="h-4 w-4 text-orange-500" />;
  if (trend === "decreasing") return <TrendingDown className="h-4 w-4 text-green-500" />;
  return <Minus className="h-4 w-4 text-blue-500" />;
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    mild: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    moderate: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    severe: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  };
  return (
    <Badge className={colors[severity] || colors.mild} variant="secondary">
      {severity}
    </Badge>
  );
}

function ExecutiveSummarySection({ summary }: { summary: string }) {
  return (
    <div className="p-4 rounded-lg border bg-primary/5">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Executive Summary</span>
      </div>
      <p className="text-sm">{summary}</p>
    </div>
  );
}

function KeyChangesSection({ changes }: { changes: KeyChange[] }) {
  if (changes.length === 0) return null;
  
  return (
    <Accordion type="single" collapsible defaultValue="key-changes">
      <AccordionItem value="key-changes">
        <AccordionTrigger className="text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Key Changes ({changes.length})
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            {changes.map((change, i) => (
              <div key={i} className="p-3 rounded-lg border flex items-start gap-3">
                <CategoryIcon category={change.category} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <SignificanceBadge significance={change.significance} />
                    <span className="text-xs text-muted-foreground">{change.timeframe}</span>
                  </div>
                  <p className="text-sm">{change.description}</p>
                </div>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function PatientConcernsSection({ concerns }: { concerns: PatientConcern[] }) {
  if (concerns.length === 0) return null;
  
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="concerns">
        <AccordionTrigger className="text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-orange-500" />
            Patient-Reported Concerns ({concerns.length})
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            {concerns.map((concern, i) => (
              <div key={i} className="p-3 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10">
                <p className="text-sm font-medium mb-1">{concern.concern}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{concern.source.replace("_", " ")}</Badge>
                  {concern.frequency && <span>{concern.frequency}</span>}
                </div>
                {concern.relatedSymptoms && concern.relatedSymptoms.length > 0 && (
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {concern.relatedSymptoms.map((s, j) => (
                      <Badge key={j} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function SymptomOverviewSection({ overview }: { overview: ClinicianHealthSummary["symptomOverview"] }) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="symptoms">
        <AccordionTrigger className="text-sm">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-orange-500" />
            Symptom Overview ({overview.totalEntries} entries)
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3">
            {overview.mostFrequent.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Most Frequent</p>
                <div className="space-y-1">
                  {overview.mostFrequent.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded border">
                      <span className="text-sm">{s.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{s.count}x</span>
                        <SeverityBadge severity={s.avgSeverity} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {overview.recentTrends.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Recent Trends</p>
                <ul className="space-y-1">
                  {overview.recentTrends.map((trend, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <TrendingUp className="h-3 w-3 mt-1 text-muted-foreground shrink-0" />
                      {trend}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {overview.triggerPatterns.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Trigger Patterns</p>
                <ul className="space-y-1">
                  {overview.triggerPatterns.map((trigger, i) => (
                    <li key={i} className="text-sm">{trigger}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function VitalsSection({ vitals }: { vitals: ClinicianHealthSummary["vitalSignsSummary"] }) {
  if (vitals.currentReadings.length === 0 && vitals.outOfRangeFlags.length === 0) return null;
  
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="vitals">
        <AccordionTrigger className="text-sm">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-red-500" />
            Vital Signs
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            {vitals.currentReadings.map((reading, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded border">
                <span className="text-sm">{reading.type}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{reading.value}</span>
                  <TrendIcon trend={reading.trend} />
                </div>
              </div>
            ))}
            
            {vitals.outOfRangeFlags.length > 0 && (
              <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Flags</p>
                <ul className="space-y-1">
                  {vitals.outOfRangeFlags.map((flag, i) => (
                    <li key={i} className="text-sm text-red-600 dark:text-red-400">{flag}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function JournalHighlightsSection({ highlights }: { highlights: ClinicianHealthSummary["journalHighlights"] }) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="journal">
        <AccordionTrigger className="text-sm">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-purple-500" />
            Journal Highlights
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Mood Trends</p>
              <p className="text-sm">{highlights.moodTrends}</p>
            </div>
            
            {highlights.patientQuotes.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Patient Quotes</p>
                <div className="space-y-2">
                  {highlights.patientQuotes.map((quote, i) => (
                    <div key={i} className="p-2 rounded border-l-2 border-purple-500 bg-muted/50">
                      <Quote className="h-3 w-3 text-muted-foreground mb-1" />
                      <p className="text-sm italic">"{quote}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {highlights.emotionalPatterns.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Emotional Patterns</p>
                <ul className="space-y-1">
                  {highlights.emotionalPatterns.map((pattern, i) => (
                    <li key={i} className="text-sm">{pattern}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function DiscussionPointsSection({ points }: { points: DiscussionPoint[] }) {
  if (points.length === 0) return null;
  
  return (
    <div className="p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
      <p className="text-sm font-medium mb-3 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-blue-500" />
        Discussion Points
      </p>
      <div className="space-y-3">
        {points.map((point, i) => (
          <div key={i} className="p-2 rounded border bg-background">
            <p className="text-sm font-medium">{point.topic}</p>
            <p className="text-xs text-muted-foreground mb-2">{point.context}</p>
            {point.suggestedQuestions && point.suggestedQuestions.length > 0 && (
              <ul className="space-y-1">
                {point.suggestedQuestions.map((q, j) => (
                  <li key={j} className="text-xs text-muted-foreground flex items-start gap-1">
                    <span className="text-primary">•</span>
                    {q}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryReport({ summary }: { summary: ClinicianHealthSummary }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Generated {formatDistanceToNow(new Date(summary.generatedAt), { addSuffix: true })}</span>
        <span>{summary.reportPeriod}</span>
      </div>
      
      <ExecutiveSummarySection summary={summary.executiveSummary} />
      
      <KeyChangesSection changes={summary.keyChanges} />
      
      <PatientConcernsSection concerns={summary.patientReportedConcerns} />
      
      <SymptomOverviewSection overview={summary.symptomOverview} />
      
      <VitalsSection vitals={summary.vitalSignsSummary} />
      
      <JournalHighlightsSection highlights={summary.journalHighlights} />
      
      {summary.medicationNotes.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="meds">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-green-500" />
                Medication Notes
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-1">
                {summary.medicationNotes.map((note, i) => (
                  <li key={i} className="text-sm">{note}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
      
      <DiscussionPointsSection points={summary.discussionPoints} />
      
      {summary.upcomingCare.length > 0 && (
        <div className="p-3 rounded-lg border">
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            Upcoming Care
          </p>
          <div className="space-y-1">
            {summary.upcomingCare.map((apt, i) => (
              <div key={i} className="text-sm flex items-center justify-between">
                <span>{apt.type}</span>
                <span className="text-xs text-muted-foreground">{apt.date} - {apt.provider}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="p-2 rounded-lg bg-muted/50 border">
        <p className="text-xs text-muted-foreground text-center">{summary.disclaimer}</p>
      </div>
    </div>
  );
}

export function ClinicianSummaryCard() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: summary, isLoading, refetch } = useQuery<ClinicianHealthSummary>({
    queryKey: ["/api/clinician-summary"],
    enabled: open,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/clinician-summary/generate", { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate summary");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clinician-summary"] });
      toast({
        title: "Summary generated",
        description: "A new clinician summary has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate summary.",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary" />
          AI Clinician Summary
        </CardTitle>
        <CardDescription>
          Generate structured health summaries for clinician review before appointments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Synthesizes symptoms, journals, vitals, and more
          </span>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-open-clinician-summary">
              <FileText className="h-4 w-4 mr-2" />
              View Clinician Summary
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-primary" />
                Clinician Health Summary
              </DialogTitle>
              <DialogDescription>
                AI-generated summary of patient health data for clinical review
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-end gap-2 mb-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetch()}
                disabled={isLoading}
                data-testid="button-refresh-summary"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button 
                size="sm" 
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                data-testid="button-generate-summary"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate New
                  </>
                )}
              </Button>
            </div>

            <ScrollArea className="flex-1 pr-4">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-16" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-24" />
                </div>
              ) : summary ? (
                <SummaryReport summary={summary} />
              ) : (
                <div className="text-center py-8">
                  <Stethoscope className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-2">No summary generated yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate a summary to see synthesized health data for clinical review
                  </p>
                  <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Summary
                  </Button>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
