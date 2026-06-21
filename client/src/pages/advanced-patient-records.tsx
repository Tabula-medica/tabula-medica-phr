import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, parseISO } from "date-fns";
import { formatDate, formatDateTime } from "@/components/shared";
import {
  Clock,
  Search,
  Pill,
  FileText,
  Activity,
  Syringe,
  Heart,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Bell,
  RefreshCw,
  Filter,
  Stethoscope,
  Building2,
  Loader2,
  ChevronRight,
  LineChart,
  ClipboardList,
  Thermometer,
  Brain,
  Sparkles,
  ShieldAlert,
  Info,
  BarChart3,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

interface TimelineEvent {
  id: string;
  type: "condition" | "medication" | "procedure" | "lab_result" | "immunization" | "encounter" | "alert" | "vital_sign";
  title: string;
  description: string;
  date: string;
  provider?: string;
  facility?: string;
  status?: string;
  severity?: string;
  details?: Record<string, any>;
}

interface Medication {
  id: string;
  name: string;
  genericName?: string;
  dosage: string;
  frequency: string;
  prescriber: string;
  startDate: string;
  endDate?: string;
  status: "active" | "discontinued" | "on_hold";
  refillsRemaining: number;
  daysUntilRefill: number;
  isHighRisk: boolean;
  highRiskCategory?: string;
  instructions?: string;
}

interface DrugInteraction {
  id: string;
  drug1: string;
  drug2: string;
  severity: "minor" | "moderate" | "major" | "contraindicated";
  description: string;
  clinicalEffect: string;
  recommendation: string;
}

interface PatientOutcome {
  id: string;
  date: string;
  symptomName: string;
  severity: number;
  notes?: string;
  triggers?: string[];
}

interface OutcomeTrend {
  symptom: string;
  data: { date: string; severity: number }[];
  averageSeverity: number;
  trend: "improving" | "stable" | "worsening";
  frequencyPerWeek: number;
}

const EVENT_TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  condition: { icon: Heart, label: "Conditions", color: "bg-red-500/10 text-red-600 dark:text-red-400" },
  medication: { icon: Pill, label: "Medications", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  procedure: { icon: Stethoscope, label: "Procedures", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
  lab_result: { icon: FileText, label: "Labs", color: "bg-green-500/10 text-green-600 dark:text-green-400" },
  immunization: { icon: Syringe, label: "Vaccines", color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400" },
  encounter: { icon: Building2, label: "Visits", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  alert: { icon: AlertTriangle, label: "Alerts", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400" },
  vital_sign: { icon: Activity, label: "Vitals", color: "bg-pink-500/10 text-pink-600 dark:text-pink-400" },
};

const SEVERITY_CONFIG: Record<string, { color: string; bg: string }> = {
  minor: { color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10" },
  moderate: { color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10" },
  major: { color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
  contraindicated: { color: "text-red-700 dark:text-red-300", bg: "bg-red-600/20" },
};

const SYMPTOM_OPTIONS = [
  "Headache", "Fatigue", "Nausea", "Dizziness", "Pain", "Shortness of breath",
  "Chest discomfort", "Joint pain", "Muscle aches", "Sleep issues", "Anxiety",
  "Stomach upset", "Skin rash", "Swelling", "Numbness", "Other"
];

const TRIGGER_OPTIONS = [
  "Medication", "Food", "Exercise", "Stress", "Weather", "Sleep", "None identified"
];

export default function AdvancedPatientRecords() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("timeline");
  const [timelineFilter, setTimelineFilter] = useState<string[]>([]);
  const [timelineSearch, setTimelineSearch] = useState("");
  const [dateRange, setDateRange] = useState("90");
  const [showLogOutcomeDialog, setShowLogOutcomeDialog] = useState(false);
  const [newOutcome, setNewOutcome] = useState({
    symptomName: "",
    severity: 5,
    notes: "",
    triggers: [] as string[],
  });

  const { data: timelineEvents, isLoading: timelineLoading, error: timelineError } = useQuery<TimelineEvent[]>({
    queryKey: ["/api/advanced-records/timeline", { dateRange }],
    queryFn: async () => {
      const res = await fetch(`/api/advanced-records/timeline?dateRange=${dateRange}`);
      if (!res.ok) throw new Error("Failed to fetch timeline");
      return res.json();
    },
  });

  const { data: medications, isLoading: medicationsLoading, error: medicationsError } = useQuery<Medication[]>({
    queryKey: ["/api/advanced-records/medications"],
  });

  const { data: drugInteractions, isLoading: interactionsLoading, error: interactionsError } = useQuery<DrugInteraction[]>({
    queryKey: ["/api/advanced-records/drug-interactions"],
  });

  const { data: outcomes, isLoading: outcomesLoading, error: outcomesError } = useQuery<PatientOutcome[]>({
    queryKey: ["/api/advanced-records/outcomes", { dateRange }],
    queryFn: async () => {
      const res = await fetch(`/api/advanced-records/outcomes?dateRange=${dateRange}`);
      if (!res.ok) throw new Error("Failed to fetch outcomes");
      return res.json();
    },
  });

  const { data: outcomeTrends, isLoading: trendsLoading, error: trendsError } = useQuery<OutcomeTrend[]>({
    queryKey: ["/api/advanced-records/outcome-trends"],
  });

  const logOutcomeMutation = useMutation({
    mutationFn: async (data: typeof newOutcome) => {
      return apiRequest("POST", "/api/advanced-records/outcomes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/advanced-records/outcomes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/advanced-records/outcome-trends"] });
      setShowLogOutcomeDialog(false);
      setNewOutcome({ symptomName: "", severity: 5, notes: "", triggers: [] });
      toast({ title: "Symptom logged", description: "Your symptom has been recorded successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log symptom. Please try again.", variant: "destructive" });
    }
  });

  const filteredEvents = useMemo(() => {
    if (!timelineEvents) return [];
    return timelineEvents.filter(event => {
      const matchesFilter = timelineFilter.length === 0 || timelineFilter.includes(event.type);
      const matchesSearch = timelineSearch === "" || 
        event.title.toLowerCase().includes(timelineSearch.toLowerCase()) ||
        event.description.toLowerCase().includes(timelineSearch.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [timelineEvents, timelineFilter, timelineSearch]);

  const medicationStats = useMemo(() => {
    if (!medications) return { active: 0, needsRefill: 0, highRisk: 0 };
    const active = medications.filter(m => m.status === "active").length;
    const needsRefill = medications.filter(m => m.daysUntilRefill <= 7 && m.status === "active").length;
    const highRisk = medications.filter(m => m.isHighRisk && m.status === "active").length;
    return { active, needsRefill, highRisk };
  }, [medications]);

  const interactionStats = useMemo(() => {
    if (!drugInteractions) return { total: 0, major: 0 };
    const major = drugInteractions.filter(i => i.severity === "major" || i.severity === "contraindicated").length;
    return { total: drugInteractions.length, major };
  }, [drugInteractions]);

  if (timelineLoading && medicationsLoading && outcomesLoading) {
    return (
      <div className="container mx-auto p-4 max-w-7xl">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Advanced Patient Records</h1>
          <p className="text-muted-foreground">Comprehensive view of your medical history, medications, and health outcomes</p>
        </div>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[180px]" data-testid="select-date-range">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="180">Last 6 months</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/10">
                <Pill className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{medicationStats.active}</p>
                <p className="text-sm text-muted-foreground">Active Medications</p>
              </div>
            </div>
            {medicationStats.needsRefill > 0 && (
              <div className="mt-3 flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                <Bell className="h-4 w-4" />
                {medicationStats.needsRefill} need refill soon
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-500/10">
                <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{interactionStats.total}</p>
                <p className="text-sm text-muted-foreground">Drug Interactions</p>
              </div>
            </div>
            {interactionStats.major > 0 && (
              <div className="mt-3 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <ShieldAlert className="h-4 w-4" />
                {interactionStats.major} require attention
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <LineChart className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{outcomes?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Logged Outcomes</p>
              </div>
            </div>
            <div className="mt-3">
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full"
                onClick={() => setShowLogOutcomeDialog(true)}
                data-testid="button-log-outcome"
              >
                <Plus className="h-4 w-4 mr-1" />
                Log Symptom
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-records">
        <TabsList className="mb-6" data-testid="tablist-records">
          <TabsTrigger value="timeline" data-testid="tab-timeline">
            <Clock className="h-4 w-4 mr-2" />
            Medical Timeline
          </TabsTrigger>
          <TabsTrigger value="medications" data-testid="tab-medications">
            <Pill className="h-4 w-4 mr-2" />
            Medications
          </TabsTrigger>
          <TabsTrigger value="outcomes" data-testid="tab-outcomes">
            <BarChart3 className="h-4 w-4 mr-2" />
            Reported Outcomes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <CardTitle>Medical History Timeline</CardTitle>
                  <CardDescription>Filter and explore your complete medical history</CardDescription>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
                    <Info className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>This information is for educational purposes only and does not constitute medical advice. Always consult your healthcare provider.</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search events..."
                      className="pl-9 w-[200px]"
                      value={timelineSearch}
                      onChange={(e) => setTimelineSearch(e.target.value)}
                      data-testid="input-timeline-search"
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => {
                  const Icon = config.icon;
                  const isActive = timelineFilter.includes(key);
                  return (
                    <Badge
                      key={key}
                      variant={isActive ? "default" : "outline"}
                      className={`cursor-pointer hover-elevate ${isActive ? "" : "opacity-70"}`}
                      onClick={() => {
                        setTimelineFilter(prev => 
                          prev.includes(key) 
                            ? prev.filter(f => f !== key)
                            : [...prev, key]
                        );
                      }}
                      data-testid={`filter-${key}`}
                    >
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                  );
                })}
                {timelineFilter.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTimelineFilter([])}
                    data-testid="button-clear-filters"
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {timelineLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20" />)}
                  </div>
                ) : timelineError ? (
                  <div className="text-center py-6 text-destructive" data-testid="error-timeline">
                    <XCircle className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Failed to load timeline events</p>
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No events found matching your filters</p>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                    <div className="space-y-4">
                      {filteredEvents.map((event, idx) => {
                        const config = EVENT_TYPE_CONFIG[event.type] || EVENT_TYPE_CONFIG.encounter;
                        const Icon = config.icon;
                        return (
                          <div 
                            key={event.id} 
                            className="relative pl-10 hover-elevate"
                            data-testid={`timeline-event-${event.id}`}
                          >
                            <div className={`absolute left-2 w-5 h-5 rounded-full ${config.color} flex items-center justify-center`}>
                              <Icon className="h-3 w-3" />
                            </div>
                            <Card>
                              <CardContent className="p-4">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="font-medium">{event.title}</h4>
                                      <Badge variant="outline" className="text-xs">
                                        {config.label}
                                      </Badge>
                                      {event.severity && (
                                        <Badge variant="secondary" className="text-xs">
                                          {event.severity}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                      {event.description}
                                    </p>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {formatDate(event.date)}
                                      </span>
                                      {event.provider && (
                                        <span className="flex items-center gap-1">
                                          <Stethoscope className="h-3 w-3" />
                                          {event.provider}
                                        </span>
                                      )}
                                      {event.facility && (
                                        <span className="flex items-center gap-1">
                                          <Building2 className="h-3 w-3" />
                                          {event.facility}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="icon" data-testid={`button-view-event-${event.id}`}>
                                    <ChevronRight className="h-4 w-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medications">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Active Medications</CardTitle>
                  <CardDescription>
                    Your current prescription medications with refill tracking. This is educational information only.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {medicationsLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
                    </div>
                  ) : medicationsError ? (
                    <div className="text-center py-6 text-destructive" data-testid="error-medications">
                      <XCircle className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">Failed to load medications</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {medications?.filter(m => m.status === "active").map(med => (
                        <div 
                          key={med.id} 
                          className={`p-4 rounded-lg border ${med.isHighRisk ? "border-orange-500/50 bg-orange-500/5" : ""}`}
                          data-testid={`medication-${med.id}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-medium">{med.name}</h4>
                                {med.isHighRisk && (
                                  <Badge variant="destructive" className="text-xs">
                                    <ShieldAlert className="h-3 w-3 mr-1" />
                                    {med.highRiskCategory || "High Risk"}
                                  </Badge>
                                )}
                                {med.daysUntilRefill <= 7 && (
                                  <Badge variant="secondary" className="text-xs bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                    <Bell className="h-3 w-3 mr-1" />
                                    Refill in {med.daysUntilRefill} days
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{med.dosage} - {med.frequency}</p>
                              {med.instructions && (
                                <p className="text-xs text-muted-foreground mt-1">{med.instructions}</p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span>Prescribed by: {med.prescriber}</span>
                                <span>Started: {formatDate(med.startDate)}</span>
                                <span>{med.refillsRemaining} refills remaining</span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" data-testid={`button-refill-${med.id}`}>
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Request Refill
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    Drug Interactions
                  </CardTitle>
                  <CardDescription>
                    Potential interactions between your medications. Consult your healthcare provider.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {interactionsLoading ? (
                    <div className="space-y-3">
                      {[1, 2].map(i => <Skeleton key={i} className="h-20" />)}
                    </div>
                  ) : interactionsError ? (
                    <div className="text-center py-6 text-destructive" data-testid="error-interactions">
                      <XCircle className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">Failed to load drug interactions</p>
                    </div>
                  ) : drugInteractions?.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm">No known interactions detected</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {drugInteractions?.map(interaction => {
                        const severityConfig = SEVERITY_CONFIG[interaction.severity];
                        return (
                          <div 
                            key={interaction.id} 
                            className={`p-3 rounded-lg border ${severityConfig.bg}`}
                            data-testid={`interaction-${interaction.id}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={severityConfig.color}>
                                {interaction.severity.charAt(0).toUpperCase() + interaction.severity.slice(1)}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium">
                              {interaction.drug1} + {interaction.drug2}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {interaction.description}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-4 p-2 bg-muted rounded">
                    This information is for educational purposes only. Always consult your healthcare provider about medication interactions.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="outcomes">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Symptom Trends</CardTitle>
                    <CardDescription>
                      Visualization of your reported symptoms over time. Educational purposes only.
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => setShowLogOutcomeDialog(true)}
                    data-testid="button-log-symptom"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Log Symptom
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {trendsLoading ? (
                  <Skeleton className="h-[300px]" />
                ) : trendsError ? (
                  <div className="text-center py-6 text-destructive" data-testid="error-trends">
                    <XCircle className="h-8 w-8 mx-auto mb-2" />
                    <p className="text-sm">Failed to load symptom trends</p>
                  </div>
                ) : outcomeTrends?.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No symptom data yet. Start logging to see trends.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {outcomeTrends?.slice(0, 3).map(trend => {
                      const TrendIcon = trend.trend === "improving" ? TrendingDown : 
                                       trend.trend === "worsening" ? TrendingUp : Minus;
                      const trendColor = trend.trend === "improving" ? "text-green-500" :
                                        trend.trend === "worsening" ? "text-red-500" : "text-muted-foreground";
                      
                      const chartData = trend.data.map(d => ({
                        date: format(parseISO(d.date), "MM/dd"),
                        severity: d.severity,
                      }));

                      return (
                        <div key={trend.symptom} className="space-y-2" data-testid={`trend-${trend.symptom}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Thermometer className="h-4 w-4" />
                              <span className="font-medium">{trend.symptom}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <TrendIcon className={`h-4 w-4 ${trendColor}`} />
                              <span className={trendColor}>
                                {trend.trend.charAt(0).toUpperCase() + trend.trend.slice(1)}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                Avg: {trend.averageSeverity.toFixed(1)}/10
                              </Badge>
                            </div>
                          </div>
                          <div className="h-[80px]">
                            <ChartContainer config={{ severity: { label: "Severity", color: "hsl(var(--primary))" } }}>
                              <AreaChart data={chartData}>
                                <defs>
                                  <linearGradient id={`gradient-${trend.symptom}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <XAxis dataKey="date" hide />
                                <YAxis domain={[0, 10]} hide />
                                <Area
                                  type="monotone"
                                  dataKey="severity"
                                  stroke="hsl(var(--primary))"
                                  fill={`url(#gradient-${trend.symptom})`}
                                  strokeWidth={2}
                                />
                                <ChartTooltip content={<ChartTooltipContent />} />
                              </AreaChart>
                            </ChartContainer>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Symptom Logs</CardTitle>
                <CardDescription>Your most recent reported symptoms and outcomes</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {outcomesLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16" />)}
                    </div>
                  ) : outcomesError ? (
                    <div className="text-center py-6 text-destructive" data-testid="error-outcomes">
                      <XCircle className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">Failed to load symptom logs</p>
                    </div>
                  ) : outcomes?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No symptoms logged yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {outcomes?.map(outcome => (
                        <div 
                          key={outcome.id} 
                          className="p-3 rounded-lg border hover-elevate"
                          data-testid={`outcome-${outcome.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{outcome.symptomName}</span>
                                <Badge variant="outline">
                                  Severity: {outcome.severity}/10
                                </Badge>
                              </div>
                              {outcome.notes && (
                                <p className="text-sm text-muted-foreground mt-1">{outcome.notes}</p>
                              )}
                              {outcome.triggers && outcome.triggers.length > 0 && (
                                <div className="flex gap-1 mt-2">
                                  {outcome.triggers.map(t => (
                                    <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDateTime(outcome.date)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showLogOutcomeDialog} onOpenChange={setShowLogOutcomeDialog}>
        <DialogContent data-testid="dialog-log-outcome">
          <DialogHeader>
            <DialogTitle>Log a Symptom</DialogTitle>
            <DialogDescription>
              Record how you're feeling. This helps track patterns over time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Symptom</Label>
              <Select 
                value={newOutcome.symptomName} 
                onValueChange={(v) => setNewOutcome(prev => ({ ...prev, symptomName: v }))}
              >
                <SelectTrigger data-testid="select-symptom">
                  <SelectValue placeholder="Select a symptom" />
                </SelectTrigger>
                <SelectContent>
                  {SYMPTOM_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Severity: {newOutcome.severity}/10</Label>
              <Slider
                value={[newOutcome.severity]}
                onValueChange={([v]) => setNewOutcome(prev => ({ ...prev, severity: v }))}
                max={10}
                min={1}
                step={1}
                data-testid="slider-severity"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Mild</span>
                <span>Moderate</span>
                <span>Severe</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Possible Triggers</Label>
              <ToggleGroup
                type="multiple"
                value={newOutcome.triggers}
                onValueChange={(v) => setNewOutcome(prev => ({ ...prev, triggers: v }))}
                className="flex flex-wrap gap-2 justify-start"
              >
                {TRIGGER_OPTIONS.map(t => (
                  <ToggleGroupItem key={t} value={t} size="sm" data-testid={`trigger-${t}`}>
                    {t}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className="space-y-2">
              <Label>Additional Notes (optional)</Label>
              <Textarea
                placeholder="Describe how you're feeling..."
                value={newOutcome.notes}
                onChange={(e) => setNewOutcome(prev => ({ ...prev, notes: e.target.value }))}
                data-testid="textarea-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogOutcomeDialog(false)} data-testid="button-cancel-outcome">
              Cancel
            </Button>
            <Button 
              onClick={() => logOutcomeMutation.mutate(newOutcome)}
              disabled={!newOutcome.symptomName || logOutcomeMutation.isPending}
              data-testid="button-submit-outcome"
            >
              {logOutcomeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Log Symptom
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
