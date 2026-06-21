import { useState } from "react";
import { ClinicalDisclaimer } from "@/components/clinical-disclaimer";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
  BookOpen,
  Plus,
  Calendar,
  Pill,
  Heart,
  Activity,
  Brain,
  Moon,
  Utensils,
  Stethoscope,
  GraduationCap,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Smile,
  Meh,
  Frown,
  Sparkles,
  Clock,
  ChevronRight,
  FileText,
  RefreshCw,
  MessageSquare,
  Check,
  X,
  Thermometer,
  Zap,
  Filter,
  Trophy,
  Award,
  ArrowRight,
} from "lucide-react";
import { format, formatDistanceToNow, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek } from "date-fns";
import type { JournalEntry, JournalSummary, JournalEventType, MoodLevel, SentimentType } from "@shared/schema";

const eventTypeConfig: Record<JournalEventType, { icon: typeof Pill; color: string; label: string }> = {
  medication_taken: { icon: Pill, color: "text-green-500", label: "Medication Taken" },
  medication_missed: { icon: Pill, color: "text-red-500", label: "Medication Missed" },
  vital_logged: { icon: Activity, color: "text-blue-500", label: "Vital Signs" },
  appointment_attended: { icon: Calendar, color: "text-emerald-500", label: "Appointment" },
  appointment_missed: { icon: Calendar, color: "text-red-500", label: "Missed Appointment" },
  lab_result_received: { icon: Stethoscope, color: "text-purple-500", label: "Lab Result" },
  education_completed: { icon: GraduationCap, color: "text-indigo-500", label: "Education" },
  symptom_reported: { icon: Thermometer, color: "text-orange-500", label: "Symptom" },
  mood_logged: { icon: Smile, color: "text-yellow-500", label: "Mood" },
  exercise_logged: { icon: Zap, color: "text-pink-500", label: "Exercise" },
  sleep_logged: { icon: Moon, color: "text-violet-500", label: "Sleep" },
  diet_logged: { icon: Utensils, color: "text-amber-500", label: "Diet" },
  manual_entry: { icon: FileText, color: "text-slate-500", label: "Journal Entry" },
};

const moodConfig: Record<MoodLevel, { icon: typeof Smile; color: string; label: string; value: number }> = {
  very_low: { icon: Frown, color: "text-red-500", label: "Very Low", value: 1 },
  low: { icon: Frown, color: "text-orange-500", label: "Low", value: 2 },
  neutral: { icon: Meh, color: "text-yellow-500", label: "Neutral", value: 3 },
  good: { icon: Smile, color: "text-green-500", label: "Good", value: 4 },
  excellent: { icon: Smile, color: "text-emerald-500", label: "Excellent", value: 5 },
};

const sentimentConfig: Record<SentimentType, { color: string; bgColor: string; label: string }> = {
  positive: { color: "text-green-600 dark:text-green-400", bgColor: "bg-green-500/10", label: "Positive" },
  neutral: { color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-500/10", label: "Neutral" },
  negative: { color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-500/10", label: "Negative" },
  concerning: { color: "text-red-600 dark:text-red-400", bgColor: "bg-red-500/10", label: "Concerning" },
};

const manualEntrySchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Journal entry is required"),
  mood: z.enum(["very_low", "low", "neutral", "good", "excellent"]).optional(),
  symptoms: z.string().optional(),
});

type ManualEntryForm = z.infer<typeof manualEntrySchema>;

function JournalEntryCard({ entry }: { entry: JournalEntry }) {
  const config = eventTypeConfig[entry.eventType];
  const Icon = config.icon;
  const analysis = entry.aiAnalysis;

  return (
    <div className="p-4 rounded-lg border hover-elevate" data-testid={`entry-${entry.id}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-muted shrink-0`}>
          <Icon className={`h-5 w-5 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{entry.title}</span>
              <Badge variant="outline" className="text-xs">{config.label}</Badge>
              {entry.source === "automatic" && (
                <Badge variant="secondary" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  Auto
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
            </span>
          </div>
          {entry.content && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{entry.content}</p>
          )}
          {entry.mood && (
            <div className="flex items-center gap-2 mt-2">
              {(() => {
                const moodInfo = moodConfig[entry.mood];
                const MoodIcon = moodInfo.icon;
                return (
                  <>
                    <MoodIcon className={`h-4 w-4 ${moodInfo.color}`} />
                    <span className="text-xs text-muted-foreground">Mood: {moodInfo.label}</span>
                  </>
                );
              })()}
            </div>
          )}
          {entry.symptoms && entry.symptoms.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Thermometer className="h-3 w-3 text-muted-foreground" />
              {entry.symptoms.map((symptom, i) => (
                <Badge key={i} variant="outline" className="text-xs">{symptom}</Badge>
              ))}
            </div>
          )}
          {analysis && (
            <div className={`mt-3 p-2 rounded-md ${sentimentConfig[analysis.sentiment].bgColor}`}>
              <div className="flex items-center gap-2">
                <Brain className={`h-4 w-4 ${sentimentConfig[analysis.sentiment].color}`} />
                <span className={`text-xs font-medium ${sentimentConfig[analysis.sentiment].color}`}>
                  AI Analysis: {sentimentConfig[analysis.sentiment].label}
                </span>
              </div>
              {analysis.concerningIndicators.length > 0 && (
                <div className="flex items-start gap-2 mt-2">
                  <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {analysis.concerningIndicators.join(", ")}
                  </p>
                </div>
              )}
              {analysis.suggestedFollowUp && (
                <p className="text-xs text-muted-foreground mt-1">
                  Suggestion: {analysis.suggestedFollowUp}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function JournalFeed() {
  const [filter, setFilter] = useState<string>("all");
  const { data: entries, isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal/entries"],
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const filteredEntries = filter === "all" 
    ? entries 
    : entries?.filter(e => e.eventType === filter);

  return (
    <Card data-testid="card-journal-feed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-blue-500" />
            Health Journal
          </CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40" data-testid="select-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="medication_taken">Medications</SelectItem>
              <SelectItem value="vital_logged">Vitals</SelectItem>
              <SelectItem value="appointment_attended">Appointments</SelectItem>
              <SelectItem value="symptom_reported">Symptoms</SelectItem>
              <SelectItem value="manual_entry">Journal Entries</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardDescription>Automatic and manual health event logging</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-3">
            {filteredEntries && filteredEntries.length > 0 ? (
              filteredEntries.map((entry) => (
                <JournalEntryCard key={entry.id} entry={entry} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center">
                <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No journal entries yet</p>
                <p className="text-xs text-muted-foreground mt-1">Your health events will appear here automatically</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function ManualEntrySection() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<ManualEntryForm>({
    resolver: zodResolver(manualEntrySchema),
    defaultValues: {
      title: "",
      content: "",
      mood: undefined,
      symptoms: "",
    },
  });

  const awardPointsMutation = useMutation({
    mutationFn: async (entryType: string) => {
      const response = await apiRequest("POST", "/api/gamification/record-journal", { entryType });
      return response.json();
    },
  });

  const createEntryMutation = useMutation({
    mutationFn: async (data: ManualEntryForm) => {
      const payload = {
        ...data,
        eventType: "manual_entry",
        source: "manual",
        symptoms: data.symptoms ? data.symptoms.split(",").map(s => s.trim()).filter(Boolean) : [],
      };
      const response = await apiRequest("POST", "/api/journal/entries", payload);
      return response.json().catch(() => null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal/entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/summary"] });
      awardPointsMutation.mutate("manual_entry", {
        onSuccess: (gamData: { pointsEarned: number; totalPoints: number; level: number; levelName: string }) => {
          toast({ title: `Entry Saved (+${gamData.pointsEarned} pts)`, description: `Journal entry saved and analyzed. Level ${gamData.level} ${gamData.levelName} - ${gamData.totalPoints} total points.` });
        },
        onError: () => {
          toast({ title: "Entry Saved", description: "Your journal entry has been analyzed and saved." });
        },
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Journal entry creation failed:", error);
      toast({ title: "Error", description: "Failed to save journal entry.", variant: "destructive" });
    },
  });

  return (
    <Card data-testid="card-manual-entry">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-violet-500" />
          Add Journal Entry
        </CardTitle>
        <CardDescription>Record your thoughts, symptoms, or how you're feeling</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-new-entry">
              <Plus className="h-4 w-4 mr-2" />
              New Journal Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Journal Entry</DialogTitle>
              <DialogDescription>
                Share how you're feeling. Our AI will analyze your entry for any health trends or concerns.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createEntryMutation.mutate(data))} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="How I'm feeling today..." {...field} data-testid="input-entry-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="content" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Journal Entry</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe your symptoms, mood, or anything about your health you'd like to track..." 
                        className="min-h-[120px]"
                        {...field} 
                        data-testid="input-entry-content" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="mood" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Mood (Optional)</FormLabel>
                    <div className="flex gap-2">
                      {(Object.keys(moodConfig) as MoodLevel[]).map((mood) => {
                        const config = moodConfig[mood];
                        const MoodIcon = config.icon;
                        const isSelected = field.value === mood;
                        return (
                          <Button
                            key={mood}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            size="icon"
                            onClick={() => field.onChange(mood)}
                            className={isSelected ? "" : ""}
                            data-testid={`mood-${mood}`}
                          >
                            <MoodIcon className={`h-5 w-5 ${isSelected ? "" : config.color}`} />
                          </Button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="symptoms" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Symptoms (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., headache, fatigue, nausea (comma-separated)" {...field} data-testid="input-symptoms" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <Button type="submit" disabled={createEntryMutation.isPending} data-testid="button-save-entry">
                    {createEntryMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Save & Analyze
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        <div className="mt-4 p-3 rounded-lg bg-muted/50">
          <div className="flex items-start gap-2">
            <Brain className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">AI-Powered Analysis</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your entries are analyzed for symptoms, mood trends, and potential health concerns. 
                We'll alert you if we detect anything that needs attention.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AISummarySection() {
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");
  const { data: summary, isLoading, refetch } = useQuery<JournalSummary>({
    queryKey: ["/api/journal/summary", period],
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/journal/summary/generate`, { period });
    },
    onSuccess: () => {
      refetch();
    },
  });

  if (isLoading) {
    return <Skeleton className="h-80" />;
  }

  return (
    <Card data-testid="card-ai-summary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-amber-500" />
            AI Health Summary
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as "daily" | "weekly")}>
              <SelectTrigger className="w-28" data-testid="select-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => generateSummaryMutation.mutate()} disabled={generateSummaryMutation.isPending} data-testid="button-refresh-summary">
              <RefreshCw className={`h-4 w-4 ${generateSummaryMutation.isPending ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <CardDescription>
          {period === "daily" ? "Today's" : "This week's"} activity summary and insights
        </CardDescription>
      </CardHeader>
      <CardContent>
        {summary ? (
          <div className="space-y-4">
            <div className={`p-3 rounded-lg ${sentimentConfig[summary.overallSentiment].bgColor}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Heart className={`h-5 w-5 ${sentimentConfig[summary.overallSentiment].color}`} />
                  <span className={`font-medium ${sentimentConfig[summary.overallSentiment].color}`}>
                    Overall: {sentimentConfig[summary.overallSentiment].label}
                  </span>
                </div>
                <Badge variant="secondary">{summary.totalEntries} events</Badge>
              </div>
              {summary.averageMood && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-muted-foreground">Avg Mood:</span>
                  <Progress value={(summary.averageMood / 5) * 100} className="h-2 flex-1" />
                  <span className="text-sm font-medium">{summary.averageMood.toFixed(1)}/5</span>
                </div>
              )}
              {summary.medicationAdherence !== undefined && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-muted-foreground">Med Adherence:</span>
                  <Progress value={summary.medicationAdherence} className="h-2 flex-1" />
                  <span className="text-sm font-medium">{summary.medicationAdherence}%</span>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium mb-2">AI Summary</p>
              <p className="text-sm text-muted-foreground">{summary.aiSummary}</p>
            </div>

            {summary.keyHighlights.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Key Highlights
                </p>
                <ul className="space-y-1">
                  {summary.keyHighlights.map((highlight, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <Check className="h-3 w-3 text-green-500 mt-1 shrink-0" />
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.concerningTrends.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  Areas of Concern
                </p>
                <ul className="space-y-1">
                  {summary.concerningTrends.map((trend, i) => (
                    <li key={i} className="text-sm text-orange-600 dark:text-orange-400 flex items-start gap-2">
                      <AlertTriangle className="h-3 w-3 mt-1 shrink-0" />
                      {trend}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.recommendations.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Brain className="h-4 w-4 text-violet-500" />
                  Recommendations
                </p>
                <ul className="space-y-1">
                  {summary.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <Sparkles className="h-3 w-3 text-violet-500 mt-1 shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Brain className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No summary available</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => generateSummaryMutation.mutate()} disabled={generateSummaryMutation.isPending} data-testid="button-generate-summary">
              Generate Summary
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuickLogSection() {
  const { toast } = useToast();

  const awardQuickLogPointsMutation = useMutation({
    mutationFn: async (entryType: string) => {
      const response = await apiRequest("POST", "/api/gamification/record-journal", { entryType });
      return response.json();
    },
  });

  const quickLogMutation = useMutation({
    mutationFn: async (eventType: JournalEventType) => {
      return apiRequest("POST", "/api/journal/quick-log", { eventType });
    },
    onSuccess: (_, eventType) => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal/entries"] });
      const config = eventTypeConfig[eventType];
      awardQuickLogPointsMutation.mutate(eventType, {
        onSuccess: (gamData: { pointsEarned: number; totalPoints: number }) => {
          toast({ title: `${config.label} (+${gamData.pointsEarned} pts)`, description: `Recorded successfully. ${gamData.totalPoints} total points.` });
        },
        onError: () => {
          toast({ title: "Logged", description: `${config.label} recorded successfully.` });
        },
      });
    },
  });

  const quickActions: { type: JournalEventType; label: string }[] = [
    { type: "medication_taken", label: "Took Medication" },
    { type: "vital_logged", label: "Logged Vitals" },
    { type: "exercise_logged", label: "Exercised" },
    { type: "sleep_logged", label: "Slept Well" },
  ];

  return (
    <Card data-testid="card-quick-log">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5 text-yellow-500" />
          Quick Log
        </CardTitle>
        <CardDescription>Quickly record common events</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map(({ type, label }) => {
            const config = eventTypeConfig[type];
            const Icon = config.icon;
            return (
              <Button
                key={type}
                variant="outline"
                className="h-auto flex-col py-3 gap-1 hover-elevate"
                onClick={() => quickLogMutation.mutate(type)}
                disabled={quickLogMutation.isPending}
                data-testid={`quick-log-${type}`}
              >
                <Icon className={`h-5 w-5 ${config.color}`} />
                <span className="text-xs">{label}</span>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentSymptomsCard() {
  const { data: entries } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal/entries"],
  });

  const symptomEntries = entries?.filter(e => e.symptoms && e.symptoms.length > 0) || [];
  const allSymptoms = symptomEntries.flatMap(e => e.symptoms || []);
  const symptomCounts = allSymptoms.reduce((acc, s) => {
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topSymptoms = Object.entries(symptomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <Card data-testid="card-recent-symptoms">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Thermometer className="h-5 w-5 text-orange-500" />
          Recent Symptoms
        </CardTitle>
      </CardHeader>
      <CardContent>
        {topSymptoms.length > 0 ? (
          <div className="space-y-2">
            {topSymptoms.map(([symptom, count]) => (
              <div key={symptom} className="flex items-center justify-between gap-2">
                <span className="text-sm">{symptom}</span>
                <Badge variant="secondary">{count}x</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No symptoms reported recently</p>
        )}
      </CardContent>
    </Card>
  );
}

function EngagementLinksWidget() {
  return (
    <Card data-testid="card-engagement-links">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Award className="h-5 w-5 text-amber-500" />
          Your Engagement
        </CardTitle>
        <CardDescription>Earn points and learn more about your health</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Link href="/gamification-dashboard">
          <div className="flex items-center justify-between gap-2 p-3 rounded-lg hover-elevate cursor-pointer" data-testid="link-gamification-from-journal">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm font-medium">Achievements & Rewards</p>
                <p className="text-xs text-muted-foreground">View badges, streaks, and level progress</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>
        <Link href="/education-library">
          <div className="flex items-center justify-between gap-2 p-3 rounded-lg hover-elevate cursor-pointer" data-testid="link-education-from-journal">
            <div className="flex items-center gap-3">
              <BookOpen className="h-5 w-5 text-indigo-500" />
              <div>
                <p className="text-sm font-medium">Learn About Your Health</p>
                <p className="text-xs text-muted-foreground">Personalized articles based on your conditions</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function HealthJournal() {
  return (
    <div className="p-6 space-y-6" data-testid="page-health-journal">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Health Journal</h1>
          <p className="text-muted-foreground">Automated health logging with AI-powered insights</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <JournalFeed />
        </div>
        <div className="space-y-6">
          <ManualEntrySection />
          <AISummarySection />
          <QuickLogSection />
          <RecentSymptomsCard />
          <EngagementLinksWidget />
        </div>
      </div>
    <ClinicalDisclaimer variant="compact" className="mt-6" testId="text-health-journal-disclaimer" />
    </div>
  );
}