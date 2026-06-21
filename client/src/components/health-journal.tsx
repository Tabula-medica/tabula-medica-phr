import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Plus,
  Calendar,
  Sparkles,
  Heart,
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Smile,
  Frown,
  Meh,
  Lock,
  MessageCircleQuestion,
  Loader2,
  Trash2,
  Edit2,
  Save,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface JournalEntry {
  id: string;
  patientId: string;
  date: string;
  content: string;
  mood: "very_negative" | "negative" | "neutral" | "positive" | "very_positive";
  tags: string[];
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

interface EmotionalPattern {
  emotion: string;
  frequency: number;
  observation: string;
  relatedEntryDates: string[];
}

interface StressTrigger {
  trigger: string;
  frequency: number;
  observation: string;
  examples: string[];
}

interface SymptomCorrelation {
  pattern: string;
  confidence: "low" | "medium" | "high";
  observation: string;
  supportingData: string[];
}

interface JournalInsights {
  emotionalPatterns: EmotionalPattern[];
  stressTriggers: StressTrigger[];
  symptomCorrelations: SymptomCorrelation[];
  moodTrend: {
    direction: "improving" | "stable" | "declining";
    observation: string;
  };
  positiveObservations: string[];
  suggestedTopicsForClinician: string[];
  disclaimer: string;
}

const moodOptions = [
  { value: "very_positive", label: "Great", icon: Smile, color: "text-green-500" },
  { value: "positive", label: "Good", icon: Smile, color: "text-green-400" },
  { value: "neutral", label: "Okay", icon: Meh, color: "text-yellow-500" },
  { value: "negative", label: "Not great", icon: Frown, color: "text-orange-500" },
  { value: "very_negative", label: "Difficult", icon: Frown, color: "text-red-500" },
];

const journalFormSchema = z.object({
  date: z.string(),
  content: z.string().min(1, "Please write something in your journal"),
  mood: z.enum(["very_negative", "negative", "neutral", "positive", "very_positive"]),
  tags: z.string().optional(),
});

type JournalFormValues = z.infer<typeof journalFormSchema>;

function MoodIcon({ mood, className }: { mood: string; className?: string }) {
  const option = moodOptions.find(o => o.value === mood);
  if (!option) return null;
  const Icon = option.icon;
  return <Icon className={`${className} ${option.color}`} />;
}

function MoodBadge({ mood }: { mood: string }) {
  const option = moodOptions.find(o => o.value === mood);
  if (!option) return null;
  return (
    <Badge variant="outline" className="gap-1">
      <MoodIcon mood={mood} className="h-3 w-3" />
      {option.label}
    </Badge>
  );
}

function TrendIcon({ direction }: { direction: string }) {
  if (direction === "improving") return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (direction === "declining") return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-yellow-500" />;
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const colors: Record<string, string> = {
    low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    high: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  };
  return (
    <Badge className={colors[confidence] || colors.low} variant="secondary">
      {confidence} confidence
    </Badge>
  );
}

function JournalEntryCard({ 
  entry, 
  onDelete 
}: { 
  entry: JournalEntry; 
  onDelete: (id: string) => void;
}) {
  const date = new Date(entry.date);
  
  return (
    <div className="p-4 rounded-lg border hover-elevate">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{format(date, "MMMM d, yyyy")}</span>
          <span className="text-xs text-muted-foreground">
            ({formatDistanceToNow(date, { addSuffix: true })})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <MoodBadge mood={entry.mood} />
          <Lock className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>
      
      <p className="text-sm mb-3 whitespace-pre-wrap">{entry.content}</p>
      
      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {entry.tags.map((tag, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      
      <div className="flex justify-end">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => onDelete(entry.id)}
          className="text-destructive hover:text-destructive"
          data-testid={`button-delete-entry-${entry.id}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function InsightsPanel({ insights }: { insights: JournalInsights }) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border bg-primary/5">
        <div className="flex items-center gap-2 mb-2">
          <TrendIcon direction={insights.moodTrend.direction} />
          <span className="font-medium capitalize">{insights.moodTrend.direction} Mood Trend</span>
        </div>
        <p className="text-sm text-muted-foreground">{insights.moodTrend.observation}</p>
      </div>

      {insights.symptomCorrelations.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="correlations">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-500" />
                Symptom Correlations ({insights.symptomCorrelations.length})
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3">
                {insights.symptomCorrelations.map((corr, i) => (
                  <div key={i} className="p-3 rounded-lg border">
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-medium text-sm">{corr.pattern}</span>
                      <ConfidenceBadge confidence={corr.confidence} />
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{corr.observation}</p>
                    <div className="flex flex-wrap gap-1">
                      {corr.supportingData.map((data, j) => (
                        <Badge key={j} variant="outline" className="text-xs">
                          {data}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {insights.emotionalPatterns.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="emotions">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2">
                <Heart className="h-4 w-4 text-red-500" />
                Emotional Patterns ({insights.emotionalPatterns.length})
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {insights.emotionalPatterns.map((pattern, i) => (
                  <div key={i} className="p-3 rounded-lg border">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{pattern.emotion}</span>
                      <Badge variant="secondary" className="text-xs">
                        {pattern.frequency}x mentioned
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{pattern.observation}</p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {insights.stressTriggers.length > 0 && (
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="triggers">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Stress Triggers ({insights.stressTriggers.length})
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {insights.stressTriggers.map((trigger, i) => (
                  <div key={i} className="p-3 rounded-lg border">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{trigger.trigger}</span>
                      <Badge variant="secondary" className="text-xs">
                        {trigger.frequency}x
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{trigger.observation}</p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {insights.positiveObservations.length > 0 && (
        <div className="p-3 rounded-lg border bg-green-50/50 dark:bg-green-950/20">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Smile className="h-3 w-3 text-green-500" />
            Positive Observations
          </p>
          <ul className="space-y-1">
            {insights.positiveObservations.map((obs, i) => (
              <li key={i} className="text-sm">{obs}</li>
            ))}
          </ul>
        </div>
      )}

      {insights.suggestedTopicsForClinician.length > 0 && (
        <div className="p-3 rounded-lg border">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <MessageCircleQuestion className="h-3 w-3" />
            Questions for Your Clinician
          </p>
          <ul className="space-y-1">
            {insights.suggestedTopicsForClinician.map((topic, i) => (
              <li key={i} className="text-sm">• {topic}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="p-2 rounded-lg bg-muted/50 border">
        <p className="text-xs text-muted-foreground text-center">
          {insights.disclaimer}
        </p>
      </div>
    </div>
  );
}

export function HealthJournalCard() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [newEntryOpen, setNewEntryOpen] = useState(false);

  const form = useForm<JournalFormValues>({
    resolver: zodResolver(journalFormSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      content: "",
      mood: "neutral",
      tags: "",
    },
  });

  const { data: entries, isLoading: entriesLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal"],
    enabled: open,
  });

  const { data: insights, isLoading: insightsLoading } = useQuery<JournalInsights>({
    queryKey: ["/api/journal/insights"],
    enabled: open,
  });

  const createEntryMutation = useMutation({
    mutationFn: async (data: JournalFormValues) => {
      const tags = data.tags 
        ? data.tags.split(",").map(t => t.trim()).filter(Boolean) 
        : [];
      const res = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: data.date,
          content: data.content,
          mood: data.mood,
          tags,
        }),
      });
      if (!res.ok) throw new Error("Failed to create entry");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/insights"] });
      form.reset({
        date: new Date().toISOString().split("T")[0],
        content: "",
        mood: "neutral",
        tags: "",
      });
      setNewEntryOpen(false);
      toast({
        title: "Entry saved",
        description: "Your journal entry has been saved privately.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save journal entry. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await fetch(`/api/journal/${entryId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete entry");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/insights"] });
      toast({ title: "Entry deleted" });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete entry.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: JournalFormValues) => {
    createEntryMutation.mutate(data);
  };

  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          AI Health Journal
        </CardTitle>
        <CardDescription>
          Private journal with AI-powered emotional and symptom pattern insights
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Your entries are private and only analyzed by AI for personal insights
          </span>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-open-journal">
              <BookOpen className="h-4 w-4 mr-2" />
              Open Health Journal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                AI Health Journal
              </DialogTitle>
              <DialogDescription className="flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Private journal with AI pattern analysis
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="entries" className="w-full flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="entries" data-testid="tab-entries">
                  Journal Entries
                </TabsTrigger>
                <TabsTrigger value="insights" data-testid="tab-insights">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI Insights
                </TabsTrigger>
              </TabsList>

              <TabsContent value="entries" className="mt-4 flex-1 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">
                    {entries?.length || 0} entries
                  </p>
                  <Dialog open={newEntryOpen} onOpenChange={setNewEntryOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="button-new-entry">
                        <Plus className="h-4 w-4 mr-2" />
                        New Entry
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>New Journal Entry</DialogTitle>
                        <DialogDescription>
                          Write about your health experiences, thoughts, and feelings today.
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Date</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} data-testid="input-date" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="mood"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>How are you feeling?</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-mood">
                                      <SelectValue placeholder="Select your mood" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {moodOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        <div className="flex items-center gap-2">
                                          <option.icon className={`h-4 w-4 ${option.color}`} />
                                          {option.label}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="content"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>What's on your mind?</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Write about your day, how you're feeling, any symptoms, activities, or thoughts..."
                                    className="min-h-[150px]"
                                    {...field} 
                                    data-testid="textarea-content"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="tags"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tags (optional)</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="e.g., stress, exercise, headache (comma separated)"
                                    {...field} 
                                    data-testid="input-tags"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button 
                              type="submit" 
                              disabled={createEntryMutation.isPending}
                              data-testid="button-save-entry"
                            >
                              {createEntryMutation.isPending ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4 mr-2" />
                                  Save Entry
                                </>
                              )}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>

                <ScrollArea className="flex-1 pr-4">
                  {entriesLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-32" />
                      <Skeleton className="h-32" />
                      <Skeleton className="h-32" />
                    </div>
                  ) : entries && entries.length > 0 ? (
                    <div className="space-y-3">
                      {entries.map((entry) => (
                        <JournalEntryCard 
                          key={entry.id} 
                          entry={entry}
                          onDelete={(id) => deleteEntryMutation.mutate(id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground mb-2">No journal entries yet</p>
                      <p className="text-sm text-muted-foreground">
                        Start writing to track your health journey and discover patterns
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="insights" className="mt-4 flex-1 overflow-hidden">
                <ScrollArea className="h-full pr-4">
                  {insightsLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-24" />
                      <Skeleton className="h-32" />
                      <Skeleton className="h-24" />
                    </div>
                  ) : insights ? (
                    <InsightsPanel insights={insights} />
                  ) : (
                    <div className="text-center py-8">
                      <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        Add more journal entries to see AI-powered insights
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
