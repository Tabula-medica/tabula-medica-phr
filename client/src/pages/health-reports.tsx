import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  FileText,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Activity,
  Moon,
  Heart,
  Zap,
  Award,
  AlertCircle,
  Loader2,
  RefreshCw,
  Download,
  Clock,
  Building2,
  Info,
  CheckCircle,
  XCircle,
  ChevronRight,
  FileDown,
  CalendarClock,
  Plus,
  Trash2,
  Play,
  Pause,
  Settings,
  Filter
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface DataSource {
  type: "wearable" | "health_record" | "translated_document" | "lab_result" | "medication";
  name: string;
  date: string;
  provider?: string;
}

interface HealthTrend {
  id: string;
  metric: string;
  category: string;
  currentValue: number;
  previousValue: number;
  unit: string;
  changePercent: number;
  trend: "improving" | "declining" | "stable";
  dataPoints: Array<{ date: string; value: number }>;
  insight: string;
  sources: DataSource[];
}

interface HealthGoal {
  id: string;
  name: string;
  category: string;
  target: number;
  current: number;
  unit: string;
  progressPercent: number;
  status: "on_track" | "behind" | "exceeded" | "not_started";
  sources: DataSource[];
}

interface ReportCorrelation {
  id: string;
  factorA: { metric: string; trend: "up" | "down" | "stable" };
  factorB: { metric: string; trend: "up" | "down" | "stable" };
  strength: number;
  relationship: "positive" | "negative" | "unclear";
  observation: string;
  sources: DataSource[];
  noCdsDisclaimer: string;
}

interface ReportHighlight {
  id: string;
  type: "achievement" | "concern" | "milestone" | "observation";
  title: string;
  description: string;
  importance: "high" | "medium" | "low";
  sources: DataSource[];
  date: string;
}

interface HealthReport {
  id: string;
  patientId: string;
  period: "weekly" | "monthly";
  startDate: string;
  endDate: string;
  generatedAt: string;
  summary: string;
  trends: HealthTrend[];
  goals: HealthGoal[];
  correlations: ReportCorrelation[];
  highlights: ReportHighlight[];
  allSources: DataSource[];
  disclaimer: string;
  localizedDisclaimer: string;
  language: string;
}

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "zh", name: "Chinese" },
  { code: "vi", name: "Vietnamese" },
  { code: "ar", name: "Arabic" },
  { code: "fr", name: "French" },
  { code: "hi", name: "Hindi" },
  { code: "ko", name: "Korean" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "tl", name: "Tagalog" }
];

function TrendIcon({ trend }: { trend: "improving" | "declining" | "stable" }) {
  if (trend === "improving") return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (trend === "declining") return <TrendingDown className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function CategoryIcon({ category }: { category: string }) {
  switch (category) {
    case "activity": return <Activity className="h-5 w-5 text-blue-600" />;
    case "sleep": return <Moon className="h-5 w-5 text-purple-600" />;
    case "vitals": return <Heart className="h-5 w-5 text-red-600" />;
    default: return <Zap className="h-5 w-5 text-yellow-600" />;
  }
}

function HighlightIcon({ type }: { type: ReportHighlight["type"] }) {
  switch (type) {
    case "achievement": return <Award className="h-5 w-5 text-green-600" />;
    case "milestone": return <CheckCircle className="h-5 w-5 text-blue-600" />;
    case "concern": return <AlertCircle className="h-5 w-5 text-orange-600" />;
    default: return <Info className="h-5 w-5 text-muted-foreground" />;
  }
}

function GoalStatusBadge({ status }: { status: HealthGoal["status"] }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    exceeded: "default",
    on_track: "secondary",
    behind: "destructive",
    not_started: "outline"
  };
  const labels: Record<string, string> = {
    exceeded: "Exceeded",
    on_track: "On Track",
    behind: "Behind",
    not_started: "Not Started"
  };
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}

function SourceAttribution({ sources }: { sources: DataSource[] }) {
  if (sources.length === 0) return null;
  
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-2">
      <span className="font-medium flex items-center gap-1">
        <FileText className="h-3 w-3" />
        Based on:
      </span>
      {sources.slice(0, 3).map((source, idx) => (
        <Badge key={idx} variant="outline" className="text-xs">
          {source.name}
        </Badge>
      ))}
      {sources.length > 3 && (
        <span className="text-muted-foreground">+{sources.length - 3} more</span>
      )}
    </div>
  );
}

const DATA_TYPES = [
  { id: "vitals", name: "Vitals", description: "Blood pressure, heart rate, weight" },
  { id: "medications", name: "Medications", description: "Current and past medications" },
  { id: "lab_results", name: "Lab Results", description: "Laboratory test results" },
  { id: "appointments", name: "Appointments", description: "Upcoming and past visits" },
  { id: "conditions", name: "Conditions", description: "Active health conditions" },
  { id: "allergies", name: "Allergies", description: "Known allergies" },
  { id: "immunizations", name: "Immunizations", description: "Vaccination history" },
  { id: "documents", name: "Documents", description: "Medical documents" },
  { id: "ai_insights", name: "AI Insights", description: "Educational health insights" },
  { id: "wearable_data", name: "Wearable Data", description: "Fitness device data" },
];

const DATE_RANGE_OPTIONS = [
  { id: "last_7_days", name: "Last 7 Days" },
  { id: "last_30_days", name: "Last 30 Days" },
  { id: "last_90_days", name: "Last 90 Days" },
  { id: "custom", name: "Custom Range" },
];

interface ReportSchedule {
  id: string;
  name: string;
  frequency: string;
  dataTypes: string[];
  exportFormat: string;
  isActive: boolean;
  nextRunAt?: string;
}

interface GeneratedReport {
  id: string;
  name: string;
  exportFormat: string;
  generatedAt: string;
  status: string;
}

export default function HealthReportsPage() {
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [language, setLanguage] = useState("en");
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRangeType, setDateRangeType] = useState("last_30_days");
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>(["vitals", "medications", "lab_results"]);
  const [exportFormat, setExportFormat] = useState<"pdf" | "csv">("pdf");
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState("weekly");
  const [scheduleEmail, setScheduleEmail] = useState("");
  const patientId = "patient-001";

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/health-reports/generate/${patientId}?period=${period}&language=${language}`);
      return (await res.json()) as { success: boolean; data: HealthReport };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/health-reports/history", patientId] });
    }
  });

  const { data: schedulesData } = useQuery<{ success: boolean; data: ReportSchedule[] }>({
    queryKey: ["/api/report-schedules", patientId],
    queryFn: async () => {
      const res = await fetch(`/api/report-schedules/${patientId}`);
      return res.json();
    }
  });

  const { data: generatedReportsData } = useQuery<{ success: boolean; data: GeneratedReport[] }>({
    queryKey: ["/api/generated-reports", patientId],
    queryFn: async () => {
      const res = await fetch(`/api/generated-reports/${patientId}`);
      return res.json();
    }
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      let startDate = new Date();
      if (dateRangeType === "last_7_days") startDate.setDate(now.getDate() - 7);
      else if (dateRangeType === "last_30_days") startDate.setDate(now.getDate() - 30);
      else if (dateRangeType === "last_90_days") startDate.setDate(now.getDate() - 90);

      const res = await apiRequest("POST", "/api/generated-reports/generate", {
        patientId,
        dataTypes: selectedDataTypes,
        exportFormat,
        dateRangeStart: startDate.toISOString(),
        dateRangeEnd: now.toISOString(),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && data.data?.id) {
        window.open(`/api/generated-reports/${data.data.id}/download?patientId=${patientId}`, "_blank");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/generated-reports", patientId] });
      setShowExportDialog(false);
    }
  });

  const createScheduleMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/report-schedules", {
        patientId,
        name: scheduleName,
        frequency: scheduleFrequency,
        dataTypes: selectedDataTypes,
        exportFormat,
        dateRangeType,
        emailRecipients: [scheduleEmail],
        isActive: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/report-schedules", patientId] });
      setShowScheduleDialog(false);
      setScheduleName("");
      setScheduleEmail("");
    }
  });

  const toggleDataType = (dataType: string) => {
    setSelectedDataTypes(prev =>
      prev.includes(dataType)
        ? prev.filter(d => d !== dataType)
        : [...prev, dataType]
    );
  };

  const { data: historyData, isLoading: historyLoading } = useQuery<{ success: boolean; data: HealthReport[] }>({
    queryKey: ["/api/health-reports/history", patientId],
    queryFn: async () => {
      const res = await fetch(`/api/health-reports/history/${patientId}`);
      return res.json();
    }
  });

  const { data: goalsData } = useQuery<{ success: boolean; data: HealthGoal[] }>({
    queryKey: ["/api/health-reports/goals", patientId],
    queryFn: async () => {
      const res = await fetch(`/api/health-reports/goals/${patientId}`);
      return res.json();
    }
  });

  const report = generateMutation.data?.data || historyData?.data?.[0];
  const goals = goalsData?.data || report?.goals || [];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
          <FileText className="h-7 w-7 text-primary" />
          Health Reports
        </h1>
        <p className="text-muted-foreground">
          Personalized health insights synthesized from your records, wearables, and documents.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Report Period:</span>
          <Select value={period} onValueChange={(v) => setPeriod(v as "weekly" | "monthly")}>
            <SelectTrigger className="w-32" data-testid="select-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Language:</span>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-36" data-testid="select-language">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          data-testid="button-generate-report"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate Report
            </>
          )}
        </Button>

        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="button-export-report">
              <FileDown className="h-4 w-4 mr-2" />
              Export
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Export Health Report</DialogTitle>
              <DialogDescription>
                Choose what data to include and your preferred format.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="health-reports-date-range">Date Range</Label>
                <Select value={dateRangeType} onValueChange={setDateRangeType}>
                  <SelectTrigger id="health-reports-date-range" data-testid="select-date-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_RANGE_OPTIONS.map(opt => (
                      <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldCaption>Data Types</FieldCaption>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {DATA_TYPES.map(dt => (
                    <div key={dt.id} className="flex items-center space-x-2">
                      <Checkbox aria-label="Data Types"
                        id={dt.id}
                        checked={selectedDataTypes.includes(dt.id)}
                        onCheckedChange={() => toggleDataType(dt.id)}
                        data-testid={`checkbox-${dt.id}`}
                      />
                      <label htmlFor={dt.id} className="text-sm cursor-pointer">
                        {dt.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="health-reports-export-format">Export Format</Label>
                <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as "pdf" | "csv")}>
                  <SelectTrigger id="health-reports-export-format" data-testid="select-export-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF Document</SelectItem>
                    <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowExportDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending || selectedDataTypes.length === 0}
                data-testid="button-confirm-export"
              >
                {exportMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export {exportFormat.toUpperCase()}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="button-schedule-report">
              <CalendarClock className="h-4 w-4 mr-2" />
              Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule Regular Reports</DialogTitle>
              <DialogDescription>
                Set up automatic report generation and delivery.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="schedule-name">Schedule Name</Label>
                <Input
                  id="schedule-name"
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  placeholder="Weekly Health Summary"
                  data-testid="input-schedule-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="health-reports-frequency">Frequency</Label>
                <Select value={scheduleFrequency} onValueChange={setScheduleFrequency}>
                  <SelectTrigger id="health-reports-frequency" data-testid="select-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldCaption>Data Types</FieldCaption>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {DATA_TYPES.slice(0, 6).map(dt => (
                    <div key={dt.id} className="flex items-center space-x-2">
                      <Checkbox aria-label="Data Types"
                        id={`sched-${dt.id}`}
                        checked={selectedDataTypes.includes(dt.id)}
                        onCheckedChange={() => toggleDataType(dt.id)}
                      />
                      <label htmlFor={`sched-${dt.id}`} className="text-sm cursor-pointer">
                        {dt.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="schedule-email">Email Address</Label>
                <Input
                  id="schedule-email"
                  type="email"
                  value={scheduleEmail}
                  onChange={(e) => setScheduleEmail(e.target.value)}
                  placeholder="your@email.com"
                  data-testid="input-schedule-email"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createScheduleMutation.mutate()}
                disabled={createScheduleMutation.isPending || !scheduleName || !scheduleEmail}
                data-testid="button-confirm-schedule"
              >
                {createScheduleMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Schedule
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {schedulesData?.data && schedulesData.data.length > 0 && (
        <Card data-testid="card-scheduled-reports">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4" />
              Scheduled Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {schedulesData.data.map(schedule => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between p-2 rounded-lg border"
                  data-testid={`schedule-${schedule.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={schedule.isActive ? "default" : "secondary"}>
                      {schedule.isActive ? "Active" : "Paused"}
                    </Badge>
                    <div>
                      <div className="font-medium text-sm">{schedule.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {schedule.frequency} | {schedule.exportFormat.toUpperCase()} | {schedule.dataTypes.length} data types
                      </div>
                    </div>
                  </div>
                  {schedule.nextRunAt && (
                    <div className="text-xs text-muted-foreground">
                      Next: {formatDate(schedule.nextRunAt)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {report && (
        <div className="space-y-6">
          <Card data-testid="card-report-summary">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {period === "weekly" ? "Weekly" : "Monthly"} Health Summary
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {formatDate(report.startDate)} - {formatDate(report.endDate)}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Generated {formatDate(report.generatedAt)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm" data-testid="text-report-summary">{report.summary}</p>
              
              <SourceAttribution sources={report.allSources} />
            </CardContent>
          </Card>

          <Tabs defaultValue="trends" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="trends" data-testid="tab-trends">Trends</TabsTrigger>
              <TabsTrigger value="goals" data-testid="tab-goals">Goals</TabsTrigger>
              <TabsTrigger value="correlations" data-testid="tab-correlations">Correlations</TabsTrigger>
              <TabsTrigger value="highlights" data-testid="tab-highlights">Highlights</TabsTrigger>
            </TabsList>

            <TabsContent value="trends" className="space-y-4 mt-4">
              {report.trends.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No trend data available yet. Connect wearable devices to track your health trends.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {report.trends.map((trend) => (
                    <Card key={trend.id} data-testid={`card-trend-${trend.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CategoryIcon category={trend.category} />
                            <div>
                              <CardTitle className="text-base">{trend.metric}</CardTitle>
                              <CardDescription className="flex items-center gap-2">
                                <TrendIcon trend={trend.trend} />
                                <span className={
                                  trend.trend === "improving" ? "text-green-600" :
                                  trend.trend === "declining" ? "text-red-600" : ""
                                }>
                                  {trend.changePercent > 0 ? "+" : ""}{trend.changePercent}% from previous period
                                </span>
                              </CardDescription>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">{trend.currentValue}</div>
                            <div className="text-xs text-muted-foreground">{trend.unit}</div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="h-32 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trend.dataPoints.slice(-14)}>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                              <XAxis
                                dataKey="date"
                                tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                className="text-xs"
                              />
                              <YAxis className="text-xs" />
                              <Tooltip
                                labelFormatter={(d) => new Date(d).toLocaleDateString()}
                                formatter={(value: number) => [value.toFixed(1), trend.metric]}
                              />
                              <Area
                                type="monotone"
                                dataKey="value"
                                stroke={trend.trend === "improving" ? "#22c55e" : trend.trend === "declining" ? "#ef4444" : "#6b7280"}
                                fill={trend.trend === "improving" ? "#22c55e20" : trend.trend === "declining" ? "#ef444420" : "#6b728020"}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="text-sm text-muted-foreground mt-3">{trend.insight}</p>
                        <SourceAttribution sources={trend.sources} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="goals" className="space-y-4 mt-4">
              {goals.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No health goals set yet. Set goals to track your progress.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {goals.map((goal) => (
                    <Card key={goal.id} data-testid={`card-goal-${goal.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Target className="h-5 w-5 text-primary" />
                            <CardTitle className="text-base">{goal.name}</CardTitle>
                          </div>
                          <GoalStatusBadge status={goal.status} />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Progress value={goal.progressPercent} className="h-2" />
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Current: <span className="font-medium text-foreground">{goal.current} {goal.unit}</span>
                          </span>
                          <span className="text-muted-foreground">
                            Target: <span className="font-medium text-foreground">{goal.target} {goal.unit}</span>
                          </span>
                        </div>
                        <div className="text-center text-lg font-bold">
                          {goal.progressPercent}% Complete
                        </div>
                        {goal.sources && <SourceAttribution sources={goal.sources} />}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="correlations" className="space-y-4 mt-4">
              {report.correlations.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Not enough data to detect correlations yet. Continue tracking to reveal patterns.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {report.correlations.map((correlation) => (
                    <Card key={correlation.id} data-testid={`card-correlation-${correlation.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={correlation.relationship === "positive" ? "default" : correlation.relationship === "negative" ? "destructive" : "secondary"}>
                            {correlation.relationship === "positive" ? "Positive" : correlation.relationship === "negative" ? "Negative" : "Unclear"} Correlation
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Strength: {Math.round(correlation.strength * 100)}%
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-3 text-sm">
                          <div className="flex items-center gap-1 p-2 bg-muted rounded">
                            <span className="font-medium">{correlation.factorA.metric}</span>
                            {correlation.factorA.trend === "up" ? <TrendingUp className="h-4 w-4 text-green-600" /> :
                             correlation.factorA.trend === "down" ? <TrendingDown className="h-4 w-4 text-red-600" /> :
                             <Minus className="h-4 w-4" />}
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          <div className="flex items-center gap-1 p-2 bg-muted rounded">
                            <span className="font-medium">{correlation.factorB.metric}</span>
                            {correlation.factorB.trend === "up" ? <TrendingUp className="h-4 w-4 text-green-600" /> :
                             correlation.factorB.trend === "down" ? <TrendingDown className="h-4 w-4 text-red-600" /> :
                             <Minus className="h-4 w-4" />}
                          </div>
                        </div>
                        <p className="text-sm">{correlation.observation}</p>
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            {correlation.noCdsDisclaimer}
                          </AlertDescription>
                        </Alert>
                        <SourceAttribution sources={correlation.sources} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="highlights" className="space-y-4 mt-4">
              {report.highlights.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    No highlights for this period yet.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {report.highlights.map((highlight) => (
                    <Card
                      key={highlight.id}
                      className={
                        highlight.type === "concern" ? "border-orange-500/50" :
                        highlight.type === "achievement" ? "border-green-500/50" :
                        highlight.type === "milestone" ? "border-blue-500/50" : ""
                      }
                      data-testid={`card-highlight-${highlight.id}`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start gap-3">
                          <HighlightIcon type={highlight.type} />
                          <div className="flex-1">
                            <CardTitle className="text-base">{highlight.title}</CardTitle>
                            <CardDescription>{formatDate(highlight.date)}</CardDescription>
                          </div>
                          <Badge variant={
                            highlight.importance === "high" ? "default" :
                            highlight.importance === "medium" ? "secondary" : "outline"
                          }>
                            {highlight.importance}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{highlight.description}</p>
                        <SourceAttribution sources={highlight.sources} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <Alert data-testid="alert-report-disclaimer">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-muted-foreground">
              {report.localizedDisclaimer}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {!report && !generateMutation.isPending && (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <h3 className="text-lg font-medium">No Reports Generated Yet</h3>
              <p className="text-muted-foreground mt-1">
                Generate your first health report to see personalized insights.
              </p>
            </div>
            <Button onClick={() => generateMutation.mutate()} data-testid="button-generate-first-report">
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate Your First Report
            </Button>
          </CardContent>
        </Card>
      )}

      {historyData?.data && historyData.data.length > 1 && (
        <Card data-testid="card-report-history">
          <CardHeader>
            <CardTitle className="text-lg">Report History</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {historyData.data.slice(1).map((hist) => (
                  <div
                    key={hist.id}
                    className="flex items-center justify-between p-2 rounded-md hover-elevate cursor-pointer"
                    data-testid={`item-history-${hist.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">
                          {hist.period === "weekly" ? "Weekly" : "Monthly"} Report
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(hist.startDate)} - {formatDate(hist.endDate)}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
