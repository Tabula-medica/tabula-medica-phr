import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { LongitudinalTimeline, TimelineEvent, HealthDomain } from "@/components/longitudinal-timeline";
import { LabResultWithSparkline, TrendSparkline } from "@/components/trend-sparkline";
import { EpisodesOfCareList, EpisodeOfCare } from "@/components/episodes-of-care";
import { EnhancedAIHealthSummary } from "@/components/enhanced-ai-health-summary";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  RefreshCw,
  AlertCircle,
  Calendar,
  Activity,
  Pill,
  Stethoscope,
  Syringe,
  HeartPulse,
  TrendingUp,
  FileText,
  Clock,
  Scissors,
  Shield,
  Info,
  Sparkles,
  Copy,
  Check,
  Share2,
  Loader2,
  Link2,
} from "lucide-react";

interface LabResult {
  id: string;
  name: string;
  code: string;
  value: number;
  unit: string;
  date: string;
  normalRange?: { min: number; max: number };
  historicalData: { date: string; value: number }[];
}

interface LongitudinalData {
  patientId: string;
  patientName: string;
  timelineEvents: TimelineEvent[];
  labResults: LabResult[];
  summary: {
    totalMedications: number;
    activeMedications: number;
    totalProcedures: number;
    totalVaccinations: number;
    chronicConditions: number;
    lastVisitDate: string;
  };
  landmarks: {
    surgeries: number;
    chronicDiagnoses: number;
    vaccinations: number;
    hospitalizations: number;
  };
  generatedAt: string;
}

const sampleData: LongitudinalData = {
  patientId: "patient_001",
  patientName: "John Smith",
  timelineEvents: [
    {
      id: "med-1",
      domain: "medications",
      name: "Lisinopril 10mg",
      description: "Daily for blood pressure management",
      startDate: "2023-03-15",
      endDate: "2024-12-31",
      type: "range",
    },
    {
      id: "med-2",
      domain: "medications",
      name: "Metformin 500mg",
      description: "Twice daily for diabetes management",
      startDate: "2023-06-01",
      type: "range",
    },
    {
      id: "med-3",
      domain: "medications",
      name: "Atorvastatin 20mg",
      description: "Daily for cholesterol",
      startDate: "2024-01-15",
      type: "range",
    },
    {
      id: "proc-1",
      domain: "procedures",
      name: "Knee Replacement Surgery",
      description: "Left knee total arthroplasty",
      startDate: "2023-08-20",
      type: "point",
      landmark: "surgery",
    },
    {
      id: "proc-2",
      domain: "procedures",
      name: "Annual Physical",
      description: "Routine wellness exam",
      startDate: "2024-02-15",
      type: "point",
    },
    {
      id: "proc-3",
      domain: "procedures",
      name: "Colonoscopy",
      description: "Screening procedure",
      startDate: "2024-06-10",
      type: "point",
    },
    {
      id: "vital-1",
      domain: "vitals",
      name: "Blood Pressure Check",
      description: "Elevated 145/92",
      startDate: "2023-03-01",
      type: "point",
      severity: "warning",
    },
    {
      id: "vital-2",
      domain: "vitals",
      name: "Blood Pressure Normal",
      description: "Controlled 128/82",
      startDate: "2024-06-15",
      type: "point",
    },
    {
      id: "cond-1",
      domain: "conditions",
      name: "Type 2 Diabetes",
      description: "Newly diagnosed",
      startDate: "2023-05-20",
      type: "point",
      landmark: "chronic_diagnosis",
    },
    {
      id: "cond-2",
      domain: "conditions",
      name: "Hypertension",
      description: "Essential hypertension",
      startDate: "2023-03-01",
      type: "range",
      landmark: "chronic_diagnosis",
    },
    {
      id: "imm-1",
      domain: "immunizations",
      name: "Flu Vaccine 2023",
      description: "Annual influenza vaccination",
      startDate: "2023-10-15",
      type: "point",
      landmark: "vaccination",
    },
    {
      id: "imm-2",
      domain: "immunizations",
      name: "COVID-19 Booster",
      description: "Updated 2024 vaccine",
      startDate: "2024-09-20",
      type: "point",
      landmark: "vaccination",
    },
    {
      id: "imm-3",
      domain: "immunizations",
      name: "Tdap Booster",
      description: "Tetanus-diphtheria-pertussis",
      startDate: "2024-02-28",
      type: "point",
      landmark: "vaccination",
    },
  ],
  labResults: [
    {
      id: "lab-1",
      name: "HbA1c",
      code: "4548-4",
      value: 6.8,
      unit: "%",
      date: "2024-10-15",
      normalRange: { min: 4.0, max: 5.6 },
      historicalData: [
        { date: "2023-06-01", value: 7.8 },
        { date: "2023-09-15", value: 7.4 },
        { date: "2023-12-20", value: 7.1 },
        { date: "2024-04-10", value: 6.9 },
        { date: "2024-07-22", value: 6.7 },
        { date: "2024-10-15", value: 6.8 },
      ],
    },
    {
      id: "lab-2",
      name: "Fasting Glucose",
      code: "1558-6",
      value: 118,
      unit: "mg/dL",
      date: "2024-10-15",
      normalRange: { min: 70, max: 100 },
      historicalData: [
        { date: "2023-06-01", value: 142 },
        { date: "2023-09-15", value: 135 },
        { date: "2023-12-20", value: 128 },
        { date: "2024-04-10", value: 122 },
        { date: "2024-07-22", value: 115 },
        { date: "2024-10-15", value: 118 },
      ],
    },
    {
      id: "lab-3",
      name: "Total Cholesterol",
      code: "2093-3",
      value: 185,
      unit: "mg/dL",
      date: "2024-10-15",
      normalRange: { min: 0, max: 200 },
      historicalData: [
        { date: "2024-01-15", value: 228 },
        { date: "2024-04-10", value: 210 },
        { date: "2024-07-22", value: 195 },
        { date: "2024-10-15", value: 185 },
      ],
    },
    {
      id: "lab-4",
      name: "LDL Cholesterol",
      code: "2089-1",
      value: 98,
      unit: "mg/dL",
      date: "2024-10-15",
      normalRange: { min: 0, max: 100 },
      historicalData: [
        { date: "2024-01-15", value: 145 },
        { date: "2024-04-10", value: 125 },
        { date: "2024-07-22", value: 108 },
        { date: "2024-10-15", value: 98 },
      ],
    },
    {
      id: "lab-5",
      name: "Blood Pressure (Systolic)",
      code: "8480-6",
      value: 128,
      unit: "mmHg",
      date: "2024-10-15",
      normalRange: { min: 90, max: 120 },
      historicalData: [
        { date: "2023-03-01", value: 152 },
        { date: "2023-06-15", value: 145 },
        { date: "2023-09-20", value: 138 },
        { date: "2024-01-10", value: 132 },
        { date: "2024-04-25", value: 130 },
        { date: "2024-07-18", value: 125 },
        { date: "2024-10-15", value: 128 },
      ],
    },
    {
      id: "lab-6",
      name: "eGFR",
      code: "33914-3",
      value: 85,
      unit: "mL/min",
      date: "2024-10-15",
      normalRange: { min: 90, max: 120 },
      historicalData: [
        { date: "2023-06-01", value: 88 },
        { date: "2023-12-20", value: 86 },
        { date: "2024-07-22", value: 84 },
        { date: "2024-10-15", value: 85 },
      ],
    },
  ],
  summary: {
    totalMedications: 5,
    activeMedications: 3,
    totalProcedures: 8,
    totalVaccinations: 6,
    chronicConditions: 2,
    lastVisitDate: "2024-10-15",
  },
  landmarks: {
    surgeries: 1,
    chronicDiagnoses: 2,
    vaccinations: 3,
    hospitalizations: 1,
  },
  generatedAt: new Date().toISOString(),
};

interface JourneySummary {
  id: string;
  patientId: string;
  generatedAt: string;
  dateRange: { start: string; end: string };
  summary: string;
  keyHighlights: string[];
  healthTrends: string[];
  specialistNotes: string;
  shareableVersion: string;
  model: string;
}

export default function LongitudinalHealthJourney() {
  const [activeTab, setActiveTab] = useState("timeline");
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [aiSummary, setAiSummary] = useState<JourneySummary | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const { data, isLoading, isError, refetch } = useQuery<LongitudinalData>({
    queryKey: ["/api/longitudinal-health-journey", "patient_001"],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return sampleData;
    },
  });

  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      
      const journeyData = {
        patientId: data?.patientId || "patient_001",
        dateRange: {
          start: sixMonthsAgo.toISOString().split("T")[0],
          end: now.toISOString().split("T")[0]
        },
        medications: data?.timelineEvents
          .filter(e => e.domain === "medications")
          .map(e => ({
            name: e.name,
            dosage: e.description,
            startDate: e.startDate,
            endDate: e.endDate,
            status: "active"
          })) || [],
        conditions: data?.timelineEvents
          .filter(e => e.domain === "conditions")
          .map(e => ({
            name: e.name,
            diagnosedDate: e.startDate,
            status: "active"
          })) || [],
        vitals: data?.timelineEvents
          .filter(e => e.domain === "vitals")
          .map(e => ({
            type: e.name,
            value: 120,
            unit: "mmHg",
            date: e.startDate,
            isAbnormal: false
          })) || [],
        procedures: data?.timelineEvents
          .filter(e => e.domain === "procedures")
          .map(e => ({
            name: e.name,
            date: e.startDate,
            type: e.landmark || "routine"
          })) || [],
        immunizations: data?.timelineEvents
          .filter(e => e.domain === "immunizations")
          .map(e => ({
            name: e.name,
            date: e.startDate
          })) || [],
        labResults: data?.labResults?.map(l => ({
          name: l.name,
          value: l.value,
          unit: l.unit,
          date: l.date,
          normalRange: l.normalRange,
          trend: l.historicalData.length > 1 
            ? (l.historicalData[l.historicalData.length - 1].value > l.historicalData[0].value ? "up" as const : "down" as const)
            : "stable" as const
        })) || [],
        hedisMetrics: [
          { measure: "Diabetes Care - HbA1c Control", status: "met" as const },
          { measure: "Controlling High Blood Pressure", status: "met" as const }
        ]
      };
      
      const response = await apiRequest("POST", "/api/ai-journey-summary/generate", journeyData);
      return response.json();
    },
    onSuccess: (result) => {
      setAiSummary(result);
      toast({
        title: "Summary Generated",
        description: "Your health journey summary is ready to view and share."
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Unable to generate summary. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleCopyToClipboard = async () => {
    if (aiSummary?.shareableVersion) {
      await navigator.clipboard.writeText(aiSummary.shareableVersion);
      setCopied(true);
      toast({ title: "Copied to clipboard", description: "Summary ready to share with your specialist." });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const [episodes, setEpisodes] = useState<EpisodeOfCare[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);

  const detectEpisodesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/episodes-of-care/detect", {
        patientId: data?.patientId || "patient_001",
        events: data?.timelineEvents || [],
      });
      return response.json();
    },
    onSuccess: (result) => {
      setEpisodes(result.episodes || []);
      toast({
        title: "Episodes Detected",
        description: `Found ${result.episodeCount} care episodes linking your clinical events.`
      });
    },
    onError: () => {
      toast({
        title: "Detection Failed",
        description: "Unable to detect episodes. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleDetectEpisodes = () => {
    if (data?.timelineEvents && data.timelineEvents.length > 0) {
      detectEpisodesMutation.mutate();
    }
  };

  const handleEventClick = (event: TimelineEvent) => {
    setSelectedEvent(event);
  };

  const handleEpisodeEventClick = (eventId: string) => {
    const event = data?.timelineEvents.find(e => e.id === eventId);
    if (event) {
      setSelectedEvent(event);
      setActiveTab("timeline");
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 space-y-6" data-testid="loading-state">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container mx-auto p-4 space-y-6" data-testid="error-state">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h3 className="font-semibold">Unable to load health journey data</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Please try again later.</p>
            <Button onClick={() => refetch()} className="gap-2" data-testid="btn-retry">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6" data-testid="longitudinal-health-journey-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Longitudinal Health Journey
          </h1>
          <p className="text-muted-foreground">Your complete health timeline with trends and insights</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2" data-testid="btn-refresh">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="stat-medications">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <Pill className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.activeMedications}</p>
                <p className="text-xs text-muted-foreground">Active Medications</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-procedures">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.totalProcedures}</p>
                <p className="text-xs text-muted-foreground">Total Procedures</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-vaccinations">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                <Syringe className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.totalVaccinations}</p>
                <p className="text-xs text-muted-foreground">Vaccinations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-conditions">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                <HeartPulse className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.chronicConditions}</p>
                <p className="text-xs text-muted-foreground">Chronic Conditions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent" data-testid="ai-summary-section">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Health Summary
            </CardTitle>
            <div className="flex items-center gap-2">
              {aiSummary && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleCopyToClipboard}
                    className="gap-2"
                    data-testid="btn-copy-summary"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied" : "Copy for Specialist"}
                  </Button>
                </>
              )}
              <Button
                size="sm"
                onClick={() => generateSummaryMutation.mutate()}
                disabled={generateSummaryMutation.isPending}
                className="gap-2"
                data-testid="btn-generate-summary"
              >
                {generateSummaryMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {aiSummary ? "Regenerate" : "Generate Summary"}
                  </>
                )}
              </Button>
            </div>
          </div>
          <CardDescription>
            Get a natural language overview of your health journey for the past 3-6 months
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!aiSummary && !generateSummaryMutation.isPending && (
            <div className="text-center py-6 text-muted-foreground">
              <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Click "Generate Summary" to create an AI-powered overview of your health journey.</p>
              <p className="text-sm mt-1">Perfect for sharing with specialists or preparing for appointments.</p>
            </div>
          )}

          {generateSummaryMutation.isPending && (
            <div className="space-y-3 py-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}

          {aiSummary && !generateSummaryMutation.isPending && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>
                  {new Date(aiSummary.dateRange.start).toLocaleDateString("en-US", { month: "short", year: "numeric" })} - {new Date(aiSummary.dateRange.end).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </span>
                <Separator orientation="vertical" className="h-3" />
                <span>Generated {new Date(aiSummary.generatedAt).toLocaleTimeString()}</span>
              </div>

              <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="ai-summary-text">
                <p className="text-foreground leading-relaxed">{aiSummary.summary}</p>
              </div>

              {aiSummary.keyHighlights.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Key Highlights
                  </h4>
                  <ul className="space-y-1">
                    {aiSummary.keyHighlights.map((highlight, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {aiSummary.healthTrends.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Health Trends
                  </h4>
                  <ul className="space-y-1">
                    {aiSummary.healthTrends.map((trend, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">•</span>
                        {trend}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {aiSummary.specialistNotes && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <h4 className="text-sm font-medium mb-1 flex items-center gap-2">
                    <Share2 className="h-4 w-4" />
                    Notes for Specialist
                  </h4>
                  <p className="text-sm text-muted-foreground">{aiSummary.specialistNotes}</p>
                </div>
              )}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  This AI-generated summary is for informational purposes only. It does not constitute medical advice. Always consult with your healthcare provider for medical decisions.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </CardContent>
      </Card>

      {data.patientId && <EnhancedAIHealthSummary patientId={data.patientId} />}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-1" data-testid="landmarks-summary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Journey Landmarks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scissors className="h-4 w-4 text-red-500" />
                <span className="text-sm">Surgeries</span>
              </div>
              <Badge variant="secondary">{data.landmarks.surgeries}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <span className="text-sm">Chronic Diagnoses</span>
              </div>
              <Badge variant="secondary">{data.landmarks.chronicDiagnoses}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Syringe className="h-4 w-4 text-green-500" />
                <span className="text-sm">Vaccinations</span>
              </div>
              <Badge variant="secondary">{data.landmarks.vaccinations}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-purple-500" />
                <span className="text-sm">Hospitalizations</span>
              </div>
              <Badge variant="secondary">{data.landmarks.hospitalizations}</Badge>
            </div>
          </CardContent>
        </Card>

        {selectedEvent && (
          <Card className="md:col-span-3" data-testid="selected-event-details">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Event Details</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedEvent(null)} data-testid="btn-close-details">
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{selectedEvent.name}</h3>
                  <Badge variant="outline">{selectedEvent.domain}</Badge>
                  {selectedEvent.landmark && (
                    <Badge variant="secondary" className="capitalize">{selectedEvent.landmark.replace("_", " ")}</Badge>
                  )}
                </div>
                {selectedEvent.description && (
                  <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(selectedEvent.startDate).toLocaleDateString()}
                    {selectedEvent.endDate && ` - ${new Date(selectedEvent.endDate).toLocaleDateString()}`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList data-testid="journey-tabs">
          <TabsTrigger value="timeline" data-testid="tab-timeline">
            <Calendar className="h-4 w-4 mr-2" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="episodes" data-testid="tab-episodes">
            <Link2 className="h-4 w-4 mr-2" />
            Episodes
          </TabsTrigger>
          <TabsTrigger value="labs" data-testid="tab-labs">
            <TrendingUp className="h-4 w-4 mr-2" />
            Lab Trends
          </TabsTrigger>
          <TabsTrigger value="summary" data-testid="tab-summary">
            <FileText className="h-4 w-4 mr-2" />
            Summary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4" data-testid="content-timeline">
          <LongitudinalTimeline
            events={data.timelineEvents}
            onEventClick={handleEventClick}
          />
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Click and drag to pan the timeline. Use zoom controls to adjust the view. Click on events to see details.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="episodes" className="space-y-4" data-testid="content-episodes">
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-primary" />
                    Episodes of Care
                  </CardTitle>
                  <CardDescription>
                    Related clinical events grouped into unified care pathways
                  </CardDescription>
                </div>
                <Button
                  onClick={handleDetectEpisodes}
                  disabled={detectEpisodesMutation.isPending}
                  className="gap-2"
                  data-testid="btn-detect-episodes"
                >
                  {detectEpisodesMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Detecting...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4" />
                      {episodes.length > 0 ? "Refresh Episodes" : "Detect Episodes"}
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
          </Card>

          {!detectEpisodesMutation.isPending && episodes.length === 0 && (
            <Card data-testid="episodes-intro">
              <CardContent className="py-12 text-center">
                <Link2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">Discover Care Episodes</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                  Episodes of Care link related clinical events together - like a surgery with its follow-up visits, 
                  lab tests, and prescriptions - making your care journey easier to understand.
                </p>
                <Button onClick={handleDetectEpisodes} className="gap-2" data-testid="btn-detect-episodes-intro">
                  <Link2 className="h-4 w-4" />
                  Detect Episodes
                </Button>
              </CardContent>
            </Card>
          )}

          {(detectEpisodesMutation.isPending || episodes.length > 0) && (
            <EpisodesOfCareList
              episodes={episodes}
              onEventClick={handleEpisodeEventClick}
              isLoading={detectEpisodesMutation.isPending}
            />
          )}

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Episodes group related events to show complete care pathways. Click on an event within an episode to view it on the timeline.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="labs" className="space-y-4" data-testid="content-labs">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Lab Results with Trends
              </CardTitle>
              <CardDescription>
                Sparklines show your lab value trends over time. Hover for details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {data.labResults.map(lab => (
                  <LabResultWithSparkline
                    key={lab.id}
                    name={lab.name}
                    value={lab.value}
                    unit={lab.unit}
                    date={lab.date}
                    historicalData={lab.historicalData}
                    normalRange={lab.normalRange}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Lab values are for informational purposes only. Please consult your healthcare provider for medical advice. Values outside normal range should be discussed with your doctor.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4" data-testid="content-summary">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Health Timeline Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total Events Recorded</span>
                    <span className="font-medium">{data.timelineEvents.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Lab Results Tracked</span>
                    <span className="font-medium">{data.labResults.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last Visit</span>
                    <span className="font-medium">{new Date(data.summary.lastVisitDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Data Last Updated</span>
                    <span className="font-medium">{new Date(data.generatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Domain Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(["medications", "procedures", "vitals", "conditions", "immunizations"] as const).map(domain => {
                  const count = data.timelineEvents.filter(e => e.domain === domain).length;
                  const config = {
                    medications: { icon: Pill, color: "text-blue-500" },
                    procedures: { icon: Stethoscope, color: "text-purple-500" },
                    vitals: { icon: Activity, color: "text-green-500" },
                    conditions: { icon: HeartPulse, color: "text-red-500" },
                    immunizations: { icon: Syringe, color: "text-amber-500" },
                  }[domain];
                  return (
                    <div key={domain} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <config.icon className={`h-4 w-4 ${config.color}`} />
                        <span className="text-sm capitalize">{domain}</span>
                      </div>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
