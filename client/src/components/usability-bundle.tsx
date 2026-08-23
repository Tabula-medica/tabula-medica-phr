import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  HelpCircle,
  BookOpen,
  ArrowUpDown,
  Search,
  FileText,
  Calendar,
  Pill,
  FlaskConical,
  Stethoscope,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Printer,
  Clock,
  User,
  Heart,
  Activity,
  FileDown,
  Sparkles,
  ChevronRight,
  Star,
  MessageCircleQuestion,
  FileCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ============================================
// ELI12 Component - Explain Like I'm 12
// 3-part structure: Definition, Where in Record, Questions for Clinician
// ============================================

interface ELI12Explanation {
  term: string;
  definition: string;
  whereInRecord: {
    quote: string;
    source: string;
    date: string;
  } | null;
  questionsForClinician: string[];
  disclaimer: string;
}

export function ExplainButton({ term, context, recordQuote, recordSource, recordDate }: { 
  term: string; 
  context?: string;
  recordQuote?: string;
  recordSource?: string;
  recordDate?: string;
}) {
  const [open, setOpen] = useState(false);

  const { data: explanation, isLoading } = useQuery<ELI12Explanation>({
    queryKey: ["/api/eli12", term],
    queryFn: async () => {
      const params = new URLSearchParams({ term });
      if (context) params.append("context", context);
      if (recordQuote) params.append("recordQuote", recordQuote);
      if (recordSource) params.append("recordSource", recordSource);
      if (recordDate) params.append("recordDate", recordDate);
      const res = await fetch(`/api/eli12/explain?${params}`);
      if (!res.ok) throw new Error("Failed to get explanation");
      return res.json();
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`button-explain-${term}`}>
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            What is "{term}"?
          </DialogTitle>
          <DialogDescription>Plain language explanation</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : explanation ? (
          <div className="space-y-4">
            {/* Part 1: Definition */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <BookOpen className="h-4 w-4" />
                Definition
              </div>
              <p className="text-sm" data-testid="text-eli12-definition">{explanation.definition}</p>
            </div>

            <Separator />

            {/* Part 2: Where in Record */}
            {explanation.whereInRecord && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <FileCheck className="h-4 w-4" />
                    Where this appears in your record
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-sm">
                    <p className="italic">"{explanation.whereInRecord.quote}"</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Source: {explanation.whereInRecord.source} ({explanation.whereInRecord.date})
                    </p>
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Part 3: Questions for Clinician */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <MessageCircleQuestion className="h-4 w-4" />
                Questions to ask your clinician
              </div>
              <ul className="space-y-2">
                {explanation.questionsForClinician.map((q, i) => (
                  <li key={i} className="text-sm flex items-start gap-2" data-testid={`question-${i}`}>
                    <ChevronRight className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-2 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground text-center">
                {explanation.disclaimer}
              </p>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ELI12Card() {
  const [term, setTerm] = useState("");
  const { toast } = useToast();

  const explainMutation = useMutation({
    mutationFn: async (searchTerm: string) => {
      const res = await fetch(`/api/eli12/explain?term=${encodeURIComponent(searchTerm)}`);
      if (!res.ok) throw new Error("Failed to explain");
      return res.json();
    },
  });

  const [result, setResult] = useState<ELI12Explanation | null>(null);

  const handleExplain = async () => {
    if (!term.trim()) return;
    try {
      const data = await explainMutation.mutateAsync(term);
      setResult(data);
    } catch {
      toast({ title: "Error", description: "Could not explain term", variant: "destructive" });
    }
  };

  return (
    <Card data-testid="card-eli12">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <HelpCircle className="h-5 w-5 text-primary" />
          Explain Anything
        </CardTitle>
        <CardDescription>Medical terms in plain language</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Enter any medical term..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleExplain()}
            data-testid="input-eli12-term"
          />
          <Button onClick={handleExplain} disabled={explainMutation.isPending} data-testid="button-eli12-explain">
            {explainMutation.isPending ? "..." : "Explain"}
          </Button>
        </div>

        {result && (
          <div className="p-3 rounded-lg border space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Definition</p>
              <p className="text-sm">{result.definition}</p>
            </div>
            
            <Separator />
            
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Questions to ask your clinician</p>
              <ul className="space-y-1">
                {result.questionsForClinician.slice(0, 2).map((q, i) => (
                  <li key={i} className="text-sm flex items-start gap-1">
                    <ChevronRight className="h-3 w-3 mt-1 text-primary shrink-0" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-muted-foreground text-center">{result.disclaimer}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          <p className="text-xs text-muted-foreground w-full">Common terms:</p>
          {["A1C", "CBC", "LDL", "HDL", "BMI", "TSH"].map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="cursor-pointer"
              onClick={() => { setTerm(t); }}
              data-testid={`badge-quick-term-${t}`}
            >
              {t}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Timeline Story Mode
// ============================================

interface TimelineEvent {
  id: string;
  date: string;
  type: string;
  title: string;
  description: string;
  provider?: string;
}

interface TimelineStory {
  period: string;
  summary: string;
  keyEvents: TimelineEvent[];
  overallTakeaway: string;
}

const eventIcons: Record<string, typeof Calendar> = {
  visit: Stethoscope,
  medication: Pill,
  lab: FlaskConical,
  imaging: FileText,
  procedure: Activity,
  diagnosis: AlertCircle,
  vaccination: Heart,
};

export function TimelineStoryCard() {
  const [months, setMonths] = useState("12");
  const [open, setOpen] = useState(false);

  const { data: story, isLoading, refetch } = useQuery<TimelineStory>({
    queryKey: ["/api/timeline-story", months],
    queryFn: async () => {
      const res = await fetch(`/api/timeline-story?months=${months}`);
      if (!res.ok) throw new Error("Failed to get story");
      return res.json();
    },
    enabled: open,
  });

  return (
    <Card data-testid="card-timeline-story">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5 text-primary" />
          Timeline Story
        </CardTitle>
        <CardDescription>Your health history, readable</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-view-story">
              <BookOpen className="h-4 w-4 mr-2" />
              View Your Health Story
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                Your Health Story
              </DialogTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Period:</span>
                <Select value={months} onValueChange={(v) => { setMonths(v); refetch(); }}>
                  <SelectTrigger className="w-[140px]" data-testid="select-story-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6" data-testid="option-6-months">Last 6 months</SelectItem>
                    <SelectItem value="12" data-testid="option-12-months">Last 12 months</SelectItem>
                    <SelectItem value="18" data-testid="option-18-months">Last 18 months</SelectItem>
                    <SelectItem value="24" data-testid="option-24-months">Last 24 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </DialogHeader>

            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-48" />
              </div>
            ) : story ? (
              <ScrollArea className="flex-1">
                <div className="space-y-6 pr-4">
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm whitespace-pre-line" data-testid="text-story-summary">{story.summary}</p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">Events in Your Records</h4>
                    <div className="space-y-3">
                      {story.keyEvents.map((event) => {
                        const Icon = eventIcons[event.type] || Calendar;
                        return (
                          <div key={event.id} className="flex gap-3 p-3 rounded-lg border" data-testid={`event-${event.id}`}>
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">{event.title}</p>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(event.date).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">{event.description}</p>
                              {event.provider && (
                                <p className="text-xs text-muted-foreground mt-1">{event.provider}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">{story.overallTakeaway}</p>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    Informational only. Not medical advice.
                  </p>
                </div>
              </ScrollArea>
            ) : null}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============================================
// What Changed Since Last Time
// ============================================

interface HealthChange {
  id: string;
  category: string;
  type: "new" | "updated" | "resolved" | "discontinued";
  title: string;
  description: string;
  date: string;
  previousValue?: string;
  newValue?: string;
}

interface ChangesSummary {
  lastVisitDate: string;
  daysSinceLastVisit: number;
  totalChanges: number;
  changes: HealthChange[];
  summary: string;
}

const changeTypeConfig: Record<string, { icon: typeof TrendingUp; color: string }> = {
  new: { icon: Star, color: "text-blue-600" },
  updated: { icon: TrendingUp, color: "text-green-600" },
  resolved: { icon: TrendingDown, color: "text-gray-500" },
  discontinued: { icon: Minus, color: "text-orange-600" },
};

export function WhatChangedCard() {
  const [open, setOpen] = useState(false);

  const { data: changes, isLoading } = useQuery<ChangesSummary>({
    queryKey: ["/api/what-changed"],
    enabled: open,
  });

  return (
    <Card data-testid="card-what-changed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ArrowUpDown className="h-5 w-5 text-primary" />
          What Changed
        </CardTitle>
        <CardDescription>Updates since your last visit</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full" data-testid="button-view-changes">
              <Clock className="h-4 w-4 mr-2" />
              See What's New
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5 text-primary" />
                What Changed Since Last Time
              </DialogTitle>
              {changes && (
                <DialogDescription>{changes.summary}</DialogDescription>
              )}
            </DialogHeader>

            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : changes ? (
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-4">
                  {changes.changes.map((change) => {
                    const config = changeTypeConfig[change.type] || changeTypeConfig.updated;
                    const Icon = config.icon;
                    return (
                      <div
                        key={change.id}
                        className="p-3 rounded-lg border"
                        data-testid={`change-${change.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 ${config.color}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{change.title}</p>
                            <p className="text-sm text-muted-foreground">{change.description}</p>
                            {change.previousValue && change.newValue && (
                              <div className="flex items-center gap-2 mt-1 text-xs">
                                <span className="text-muted-foreground">{change.previousValue}</span>
                                <ChevronRight className="h-3 w-3" />
                                <span className="font-medium">{change.newValue}</span>
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(change.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-muted-foreground italic mt-4">
                  Discuss any changes with your healthcare provider.
                </p>
              </ScrollArea>
            ) : null}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============================================
// Smart Search
// ============================================

interface SearchResult {
  id: string;
  type: string;
  title: string;
  snippet: string;
  date: string;
  highlights: string[];
}

interface SmartSearchResponse {
  query: string;
  totalResults: number;
  results: SearchResult[];
  suggestions: string[];
}

const resultTypeIcons: Record<string, typeof FileText> = {
  medication: Pill,
  lab: FlaskConical,
  condition: AlertCircle,
  document: FileText,
  provider: User,
  appointment: Calendar,
  note: FileText,
};

export function SmartSearchCard() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const { data: results, isLoading } = useQuery<SmartSearchResponse>({
    queryKey: ["/api/smart-search", query],
    queryFn: async () => {
      const res = await fetch(`/api/smart-search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Failed to search");
      return res.json();
    },
    enabled: query.length >= 2 && open,
  });

  return (
    <Card data-testid="card-smart-search">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Search className="h-5 w-5 text-primary" />
          Smart Search
        </CardTitle>
        <CardDescription>Find anything in your records</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full" data-testid="button-open-search">
              <Search className="h-4 w-4 mr-2" />
              Search Records
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Smart Search
              </DialogTitle>
            </DialogHeader>

            <div className="flex gap-2">
              <Input
                placeholder="Search medications, labs, conditions..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                data-testid="input-smart-search"
                // The dialog exists only to run this search, so opening it and
                // landing anywhere else would cost every user an extra step.
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
            </div>

            {query.length >= 2 && (
              <div className="flex-1 overflow-hidden">
                {isLoading ? (
                  <div className="space-y-2 mt-4">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                  </div>
                ) : results ? (
                  <ScrollArea className="h-[300px] mt-4">
                    {results.totalResults > 0 ? (
                      <div className="space-y-2 pr-4">
                        <p className="text-sm text-muted-foreground">
                          {results.totalResults} result{results.totalResults !== 1 ? "s" : ""}
                        </p>
                        {results.results.map((r) => {
                          const Icon = resultTypeIcons[r.type] || FileText;
                          return (
                            <div key={r.id} className="p-3 rounded-lg border hover-elevate cursor-pointer" data-testid={`result-${r.id}`}>
                              <div className="flex items-start gap-3">
                                <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium">{r.title}</p>
                                  <p className="text-sm text-muted-foreground truncate">{r.snippet}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="text-xs">{r.type}</Badge>
                                    <span className="text-xs text-muted-foreground">{r.date}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No results for "{query}"</p>
                        {results.suggestions.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm">Try:</p>
                            <div className="flex flex-wrap gap-1 justify-center mt-1">
                              {results.suggestions.map((s, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="cursor-pointer"
                                  onClick={() => setQuery(s)}
                                  data-testid={`suggestion-${i}`}
                                >
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </ScrollArea>
                ) : null}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============================================
// One-Page Snapshot Export
// ============================================

interface SnapshotSection {
  title: string;
  items: Array<{ label: string; value: string; date?: string }>;
}

interface OnePageSnapshot {
  generatedAt: string;
  patientName: string;
  dateOfBirth: string;
  sections: SnapshotSection[];
  emergencyContacts: Array<{ name: string; relationship: string; phone: string }>;
  notes: string;
}

export function SnapshotExportCard() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: snapshot, isLoading } = useQuery<OnePageSnapshot>({
    queryKey: ["/api/snapshot"],
    enabled: open,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!snapshot) return;
    const content = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-snapshot-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "Snapshot saved to your device" });
  };

  return (
    <Card data-testid="card-snapshot-export">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileDown className="h-5 w-5 text-primary" />
          One-Page Snapshot
        </CardTitle>
        <CardDescription>Summary for appointments</CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" data-testid="button-generate-snapshot">
              <FileDown className="h-4 w-4 mr-2" />
              Generate Snapshot
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col print:max-w-full print:max-h-full">
            <DialogHeader className="print:hidden">
              <DialogTitle className="flex items-center gap-2">
                <FileDown className="h-5 w-5 text-primary" />
                Health Snapshot
              </DialogTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handlePrint} data-testid="button-print-snapshot">
                  <Printer className="h-4 w-4 mr-1" />
                  Print
                </Button>
                <Button size="sm" variant="outline" onClick={handleDownload} data-testid="button-download-snapshot">
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
            </DialogHeader>

            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </div>
            ) : snapshot ? (
              <ScrollArea className="flex-1 print:overflow-visible">
                <div className="space-y-4 pr-4 print:pr-0" id="snapshot-content">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 print:bg-transparent print:border">
                    <div>
                      <p className="font-bold text-lg" data-testid="text-patient-name">{snapshot.patientName}</p>
                      <p className="text-sm text-muted-foreground">DOB: {snapshot.dateOfBirth}</p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>Generated: {new Date(snapshot.generatedAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 print:gap-2">
                    {snapshot.sections.map((section, i) => (
                      <div key={i} className="p-3 rounded-lg border print:border-gray-300" data-testid={`section-${i}`}>
                        <p className="font-semibold text-sm mb-2">{section.title}</p>
                        <div className="space-y-1">
                          {section.items.map((item, j) => (
                            <div key={j} className="flex justify-between text-sm">
                              <span className="text-muted-foreground">{item.label}</span>
                              <span className="font-medium text-right">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-lg border">
                    <p className="font-semibold text-sm mb-2">Emergency Contacts</p>
                    <div className="grid grid-cols-2 gap-2">
                      {snapshot.emergencyContacts.map((contact, i) => (
                        <div key={i} className="text-sm" data-testid={`contact-${i}`}>
                          <p className="font-medium">{contact.name}</p>
                          <p className="text-muted-foreground">{contact.relationship} - {contact.phone}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground italic">{snapshot.notes}</p>
                </div>
              </ScrollArea>
            ) : null}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
