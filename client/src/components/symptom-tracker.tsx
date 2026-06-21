import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Thermometer,
  Plus,
  Clock,
  Quote,
  MessageCircleQuestion,
  ChevronRight,
  Stethoscope,
  Pill,
  TestTube,
  Sparkles,
  AlertCircle,
  Loader2,
  Calendar,
  TrendingUp,
  FileText,
  Utensils,
  Activity,
  Sun,
  Brain,
  Moon,
  MoreHorizontal,
  BarChart3,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface SymptomTrigger {
  type: "diet" | "activity" | "environment" | "stress" | "sleep" | "other";
  description: string;
}

interface SymptomLog {
  id: string;
  patientId: string;
  symptomName: string;
  severity: "mild" | "moderate" | "severe";
  duration: string;
  notes?: string;
  triggers?: SymptomTrigger[];
  loggedAt: string;
}

interface RecordCorrelation {
  type: "condition" | "medication" | "lab_result";
  name: string;
  quote: string;
  source: string;
  observation: string;
}

interface MedicationSideEffectPattern {
  medicationName: string;
  knownSideEffects: string[];
  patternObservation: string;
  source: string;
}

interface TriggerPattern {
  triggerType: string;
  frequency: number;
  observation: string;
}

interface SymptomInsight {
  symptomId: string;
  symptomName: string;
  correlations: RecordCorrelation[];
  medicationPatterns: MedicationSideEffectPattern[];
  triggerPatterns: TriggerPattern[];
  questionsForClinician: string[];
  disclaimer: string;
}

interface SymptomPeriodSummary {
  periodStart: string;
  periodEnd: string;
  totalSymptoms: number;
  mostFrequent: Array<{ symptom: string; count: number }>;
  severityBreakdown: { mild: number; moderate: number; severe: number };
  keyChanges: string[];
  persistentIssues: string[];
  triggerSummary: TriggerPattern[];
  medicationCorrelations: string[];
  aiSummary: string;
  disclaimer: string;
}

const triggerTypes = [
  { value: "diet", label: "Diet / Food" },
  { value: "activity", label: "Activity / Exercise" },
  { value: "environment", label: "Environment" },
  { value: "stress", label: "Stress" },
  { value: "sleep", label: "Sleep" },
  { value: "other", label: "Other" },
];

const symptomFormSchema = z.object({
  symptomName: z.string().min(2, "Symptom name is required"),
  severity: z.enum(["mild", "moderate", "severe"]),
  duration: z.string().min(1, "Duration is required"),
  notes: z.string().optional(),
  triggerType: z.string().optional(),
  triggerDescription: z.string().optional(),
});

type SymptomFormValues = z.infer<typeof symptomFormSchema>;

function CorrelationCard({ correlation }: { correlation: RecordCorrelation }) {
  const iconMap = {
    condition: Stethoscope,
    medication: Pill,
    lab_result: TestTube,
  };
  const Icon = iconMap[correlation.type];

  return (
    <div className="p-3 rounded-lg border">
      <div className="flex items-start gap-2 mb-2">
        <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-sm">{correlation.name}</p>
          <Badge variant="outline" className="text-xs mt-1">
            {correlation.type.replace("_", " ")}
          </Badge>
        </div>
      </div>
      <div className="pl-6 space-y-2">
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Quote className="h-3 w-3" />
            Quote:
          </p>
          <p className="text-xs italic bg-muted/50 p-2 rounded border-l-2 border-primary">
            "{correlation.quote}"
          </p>
          <p className="text-xs text-muted-foreground mt-1">({correlation.source})</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Observation:</p>
          <p className="text-sm">{correlation.observation}</p>
        </div>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: "mild" | "moderate" | "severe" }) {
  const variants: Record<string, "secondary" | "default" | "destructive"> = {
    mild: "secondary",
    moderate: "default",
    severe: "destructive",
  };
  return (
    <Badge variant={variants[severity]} className="capitalize">
      {severity}
    </Badge>
  );
}

function TriggerIcon({ type }: { type: string }) {
  const icons: Record<string, typeof Utensils> = {
    diet: Utensils,
    activity: Activity,
    environment: Sun,
    stress: Brain,
    sleep: Moon,
    other: MoreHorizontal,
  };
  const Icon = icons[type] || MoreHorizontal;
  return <Icon className="h-3 w-3" />;
}

function MedicationPatternCard({ pattern }: { pattern: MedicationSideEffectPattern }) {
  return (
    <div className="p-3 rounded-lg border bg-orange-50/50 dark:bg-orange-950/20">
      <div className="flex items-start gap-2 mb-2">
        <Pill className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-sm">{pattern.medicationName}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {pattern.knownSideEffects.map((effect, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {effect}
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground pl-6">{pattern.patternObservation}</p>
      <p className="text-xs text-muted-foreground pl-6 mt-1">({pattern.source})</p>
    </div>
  );
}

function PeriodSummaryView({ summary }: { summary: SymptomPeriodSummary }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg border text-center">
          <p className="text-2xl font-bold text-primary">{summary.totalSymptoms}</p>
          <p className="text-xs text-muted-foreground">Total Entries</p>
        </div>
        <div className="p-3 rounded-lg border text-center">
          <p className="text-lg font-semibold">
            {summary.mostFrequent[0]?.symptom || "None"}
          </p>
          <p className="text-xs text-muted-foreground">Most Frequent</p>
        </div>
      </div>

      <div className="p-3 rounded-lg border">
        <p className="text-xs font-medium text-muted-foreground mb-2">Severity Breakdown</p>
        <div className="flex gap-2">
          <Badge variant="secondary">{summary.severityBreakdown.mild} Mild</Badge>
          <Badge variant="default">{summary.severityBreakdown.moderate} Moderate</Badge>
          <Badge variant="destructive">{summary.severityBreakdown.severe} Severe</Badge>
        </div>
      </div>

      {summary.triggerSummary.length > 0 && (
        <div className="p-3 rounded-lg border">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Trigger Patterns
          </p>
          <div className="space-y-2">
            {summary.triggerSummary.map((trigger, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <TriggerIcon type={trigger.triggerType} />
                <div>
                  <span className="font-medium capitalize">{trigger.triggerType}</span>
                  <span className="text-muted-foreground"> - {trigger.frequency}x</span>
                  <p className="text-xs text-muted-foreground">{trigger.observation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {summary.keyChanges.length > 0 && (
        <div className="p-3 rounded-lg border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Key Changes</p>
          <ul className="space-y-1">
            {summary.keyChanges.map((change, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                {change}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.persistentIssues.length > 0 && (
        <div className="p-3 rounded-lg border bg-yellow-50/50 dark:bg-yellow-950/20">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Persistent Issues
          </p>
          <ul className="space-y-1">
            {summary.persistentIssues.map((issue, i) => (
              <li key={i} className="text-sm">{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.medicationCorrelations.length > 0 && (
        <div className="p-3 rounded-lg border">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Pill className="h-3 w-3" />
            Medication Correlations
          </p>
          <ul className="space-y-1">
            {summary.medicationCorrelations.map((corr, i) => (
              <li key={i} className="text-sm">{corr}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-3 rounded-lg bg-muted/50 border">
        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          AI Summary
        </p>
        <p className="text-sm">{summary.aiSummary}</p>
      </div>

      <div className="p-2 rounded-lg bg-muted/50 border">
        <p className="text-xs text-muted-foreground text-center">
          {summary.disclaimer}
        </p>
      </div>
    </div>
  );
}

export function SymptomTrackerCard() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [logDialogOpen, setLogDialogOpen] = useState(false);
  const [selectedSymptom, setSelectedSymptom] = useState<SymptomLog | null>(null);
  const [summaryPeriod, setSummaryPeriod] = useState(30);

  const form = useForm<SymptomFormValues>({
    resolver: zodResolver(symptomFormSchema),
    defaultValues: {
      symptomName: "",
      severity: "mild",
      duration: "",
      notes: "",
      triggerType: "",
      triggerDescription: "",
    },
  });

  const { data: periodSummary, isLoading: summaryLoading } = useQuery<SymptomPeriodSummary>({
    queryKey: ["/api/symptoms/summary", { days: summaryPeriod }],
    queryFn: async () => {
      const res = await fetch(`/api/symptoms/summary?days=${summaryPeriod}`);
      if (!res.ok) throw new Error("Failed to get summary");
      return res.json();
    },
    enabled: open,
  });

  const { data: symptoms, isLoading: symptomsLoading } = useQuery<SymptomLog[]>({
    queryKey: ["/api/symptoms"],
    enabled: open,
  });

  const { data: insight, isLoading: insightLoading } = useQuery<SymptomInsight>({
    queryKey: ["/api/symptoms", selectedSymptom?.id, "insights"],
    queryFn: async () => {
      const res = await fetch(`/api/symptoms/${selectedSymptom?.id}/insights`);
      if (!res.ok) throw new Error("Failed to get insights");
      return res.json();
    },
    enabled: !!selectedSymptom,
  });

  const logSymptomMutation = useMutation({
    mutationFn: async (data: SymptomFormValues) => {
      const res = await fetch("/api/symptoms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to log symptom");
      return res.json() as Promise<SymptomLog>;
    },
    onSuccess: () => {
      toast({
        title: "Symptom Logged",
        description: "Your symptom has been recorded.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/symptoms"] });
      setLogDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to log symptom. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: SymptomFormValues) => {
    logSymptomMutation.mutate(data);
  };

  return (
    <Card data-testid="card-symptom-tracker">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Thermometer className="h-5 w-5 text-primary" />
          Symptom Tracker
        </CardTitle>
        <CardDescription>Log symptoms and see record correlations</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-open-symptom-tracker">
              <Sparkles className="h-4 w-4 mr-2" />
              Track Symptoms
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Thermometer className="h-5 w-5 text-primary" />
                Enhanced Symptom Tracker
              </DialogTitle>
              <DialogDescription>
                Log symptoms with triggers, see medication patterns, and get AI summaries.
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="symptoms" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="symptoms" data-testid="tab-symptoms">
                  Symptoms
                </TabsTrigger>
                <TabsTrigger value="summary" data-testid="tab-summary">
                  <BarChart3 className="h-3 w-3 mr-1" />
                  AI Summary
                </TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-4">
                <div className="mb-4">
                  <Select
                    value={String(summaryPeriod)}
                    onValueChange={(v) => setSummaryPeriod(Number(v))}
                  >
                    <SelectTrigger className="w-full" data-testid="select-period">
                      <SelectValue placeholder="Select period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="14">Last 14 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <ScrollArea className="h-[400px] pr-4">
                  {summaryLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-20" />
                      <Skeleton className="h-32" />
                      <Skeleton className="h-24" />
                    </div>
                  ) : periodSummary ? (
                    <PeriodSummaryView summary={periodSummary} />
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No summary available</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="symptoms" className="mt-4">

            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {symptoms?.length || 0} symptoms logged
              </p>
              <Dialog open={logDialogOpen} onOpenChange={setLogDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-log-symptom">
                    <Plus className="h-4 w-4 mr-2" />
                    Log Symptom
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Log a Symptom</DialogTitle>
                    <DialogDescription>
                      Record what you're experiencing to track over time.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="symptomName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Symptom</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="e.g., Headache, Fatigue, Nausea" 
                                {...field} 
                                data-testid="input-symptom-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="severity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Severity</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-severity">
                                  <SelectValue placeholder="Select severity" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="mild">Mild</SelectItem>
                                <SelectItem value="moderate">Moderate</SelectItem>
                                <SelectItem value="severe">Severe</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="duration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Duration</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-duration">
                                  <SelectValue placeholder="How long?" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="A few hours">A few hours</SelectItem>
                                <SelectItem value="1 day">1 day</SelectItem>
                                <SelectItem value="2-3 days">2-3 days</SelectItem>
                                <SelectItem value="1 week">1 week</SelectItem>
                                <SelectItem value="More than 1 week">More than 1 week</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="triggerType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Potential Trigger (optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-trigger-type">
                                  <SelectValue placeholder="What might have triggered this?" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {triggerTypes.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {form.watch("triggerType") && (
                        <FormField
                          control={form.control}
                          name="triggerDescription"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Describe the trigger</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="e.g., Skipped breakfast, poor sleep, hot weather" 
                                  {...field} 
                                  data-testid="input-trigger-description"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes (optional)</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Any additional details..." 
                                {...field} 
                                data-testid="textarea-notes"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button 
                          type="submit" 
                          disabled={logSymptomMutation.isPending}
                          data-testid="button-submit-symptom"
                        >
                          {logSymptomMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4 mr-2" />
                          )}
                          Log Symptom
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-4">
                {symptomsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20" />
                    <Skeleton className="h-20" />
                    <Skeleton className="h-20" />
                  </div>
                ) : symptoms && symptoms.length > 0 ? (
                  <Accordion type="single" collapsible className="space-y-2">
                    {symptoms.map((symptom) => (
                      <AccordionItem 
                        key={symptom.id} 
                        value={symptom.id}
                        className="border rounded-lg px-4"
                      >
                        <AccordionTrigger 
                          className="hover:no-underline"
                          onClick={() => setSelectedSymptom(symptom)}
                          data-testid={`accordion-symptom-${symptom.id}`}
                        >
                          <div className="flex items-center gap-3 text-left flex-1">
                            <Thermometer className="h-4 w-4 text-primary shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{symptom.symptomName}</span>
                                <SeverityBadge severity={symptom.severity} />
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {symptom.duration}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(symptom.loggedAt), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4 pt-2">
                            {symptom.notes && (
                              <div className="p-3 rounded-lg bg-muted/50">
                                <p className="text-xs text-muted-foreground mb-1">Notes:</p>
                                <p className="text-sm">{symptom.notes}</p>
                              </div>
                            )}

                            <Separator />

                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />
                                Record Correlations
                              </p>
                              {selectedSymptom?.id === symptom.id && insightLoading ? (
                                <div className="space-y-2">
                                  <Skeleton className="h-24" />
                                  <Skeleton className="h-24" />
                                </div>
                              ) : selectedSymptom?.id === symptom.id && insight ? (
                                <div className="space-y-3">
                                  {insight.correlations.length > 0 ? (
                                    insight.correlations.map((corr, i) => (
                                      <CorrelationCard key={i} correlation={corr} />
                                    ))
                                  ) : (
                                    <div className="p-3 rounded-lg border text-center">
                                      <AlertCircle className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                                      <p className="text-sm text-muted-foreground">
                                        No direct correlations found in your records.
                                      </p>
                                    </div>
                                  )}

                                  {insight.medicationPatterns && insight.medicationPatterns.length > 0 && (
                                    <div className="mt-3">
                                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                        <Pill className="h-3 w-3" />
                                        Medication Side Effect Patterns
                                      </p>
                                      <div className="space-y-2">
                                        {insight.medicationPatterns.map((pattern, i) => (
                                          <MedicationPatternCard key={i} pattern={pattern} />
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {insight.triggerPatterns && insight.triggerPatterns.length > 0 && (
                                    <div className="mt-3">
                                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                        <TrendingUp className="h-3 w-3" />
                                        Trigger Patterns Detected
                                      </p>
                                      <div className="p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20">
                                        {insight.triggerPatterns.map((trigger, i) => (
                                          <div key={i} className="flex items-start gap-2 text-sm mb-2 last:mb-0">
                                            <TriggerIcon type={trigger.triggerType} />
                                            <div>
                                              <span className="font-medium capitalize">{trigger.triggerType}</span>
                                              <span className="text-muted-foreground"> ({trigger.frequency}x)</span>
                                              <p className="text-xs text-muted-foreground">{trigger.observation}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {insight.questionsForClinician.length > 0 && (
                                    <div className="mt-4">
                                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                        <MessageCircleQuestion className="h-3 w-3" />
                                        Questions to ask your clinician:
                                      </p>
                                      <ul className="space-y-1">
                                        {insight.questionsForClinician.map((q, i) => (
                                          <li key={i} className="text-sm flex items-start gap-2">
                                            <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                                            {q}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  <div className="p-2 rounded-lg bg-muted/50 border mt-3">
                                    <p className="text-xs text-muted-foreground text-center">
                                      {insight.disclaimer}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-3 rounded-lg border text-center">
                                  <p className="text-sm text-muted-foreground">
                                    Click to see record correlations
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <div className="text-center py-8">
                    <Thermometer className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground mb-4">No symptoms logged yet</p>
                    <Button 
                      variant="outline" 
                      onClick={() => setLogDialogOpen(true)}
                      data-testid="button-log-first-symptom"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Log your first symptom
                    </Button>
                  </div>
                )}

                <div className="p-2 rounded-lg bg-muted/50 border mt-4">
                  <p className="text-xs text-muted-foreground text-center">
                    Informational only. Not medical advice.
                  </p>
                </div>
              </div>
            </ScrollArea>

              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
