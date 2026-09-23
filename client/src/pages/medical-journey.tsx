import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Activity, 
  Pill, 
  Stethoscope, 
  Heart, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  ChevronRight,
  Sparkles,
  FileText,
  Syringe,
  AlertTriangle,
  Share2,
  Shield,
  Download,
  Link,
  Copy,
  X,
  ExternalLink
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCaption } from "@/components/ui/field-caption";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { LanesOfCare } from "@/components/lanes-of-care";

interface TimelineEvent {
  id: string;
  type: string;
  date: string;
  endDate?: string;
  title: string;
  description?: string;
  category: string;
  severity?: string;
  source: string;
  normalizedCode?: string;
  codeSystem?: string;
  value?: number;
  unit?: string;
}

interface VitalTrendData {
  loincCode: string;
  displayName: string;
  dataPoints: Array<{
    date: string;
    value: number;
    unit: string;
    source: string;
    status?: string;
  }>;
  currentValue?: number;
  trend?: string;
  normalRange?: { low: number; high: number };
}

interface MedicationTimelineEntry {
  rxNormCode: string;
  displayName: string;
  startDate: string;
  endDate?: string;
  status: string;
  dosage?: string;
  frequency?: string;
  isActive: boolean;
  source: string;
}

interface ConditionTimelineEntry {
  snomedCode: string;
  displayName: string;
  category: string;
  onsetDate?: string;
  clinicalStatus: string;
  isActive: boolean;
  source: string;
}

interface JourneyLandmark {
  id: string;
  date: string;
  title: string;
  description: string;
  type: string;
  significance: string;
}

interface EncounterEntry {
  id: string;
  type: string;
  date: string;
  endDate?: string;
  provider?: string;
  location?: string;
  reason?: string;
  source: string;
}

interface JourneySummary {
  statusUpdate: string;
  keyInsights: string[];
  recentChanges: string[];
  healthTrends: Array<{
    metric: string;
    trend: string;
    details: string;
  }>;
  lastCheckup?: {
    date: string;
    provider?: string;
  };
}

interface PatientJourneyTimeline {
  patientId: string;
  timeRange: { start: string; end: string };
  summary: JourneySummary;
  events: TimelineEvent[];
  vitalsTracking: VitalTrendData[];
  medicationAdherence: MedicationTimelineEntry[];
  conditions: ConditionTimelineEntry[];
  encounters?: EncounterEntry[];
  landmarks: JourneyLandmark[];
  generatedAt: string;
}

export default function MedicalJourneyPage() {
  const [selectedPatientId] = useState("patient-001");
  const [selectedTab, setSelectedTab] = useState("overview");
  const [timeRange, setTimeRange] = useState("2y");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [breakGlassDialogOpen, setBreakGlassDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [shareSections, setShareSections] = useState<string[]>(["summary", "vitals", "medications", "conditions"]);
  const [shareExpiration, setShareExpiration] = useState("24");
  const [sharePurpose, setSharePurpose] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const { toast } = useToast();

  const { data: journeyData, isLoading, error } = useQuery<{ success: boolean; data: PatientJourneyTimeline }>({
    queryKey: ["/api/medical-journey/timeline", selectedPatientId]
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/medical-journey/timeline/${selectedPatientId}/regenerate-summary`, {
        userId: "current-user"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medical-journey/timeline", selectedPatientId] });
      toast({ title: "Summary regenerated", description: "AI health summary has been updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to regenerate summary", variant: "destructive" });
    }
  });

  const createShareLinkMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/shareability/smart-links", {
        patientId: selectedPatientId,
        userId: "current-user",
        purpose: sharePurpose || "Sharing health summary with specialist",
        expirationHours: parseInt(shareExpiration),
        maxAccesses: 3,
        recipientEmail: recipientEmail || undefined,
        includedSections: shareSections
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setShareLink(data.data.shareableUrl);
        toast({ title: "Link Created", description: "Secure share link generated. It will expire in " + shareExpiration + " hours." });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create share link", variant: "destructive" });
    }
  });

  const exportFHIRMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/shareability/fhir-export/generate", {
        patientId: selectedPatientId,
        userId: "current-user",
        includeResources: ["all"],
        format: "json",
        purpose: "Patient data portability export"
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        const blob = new Blob([JSON.stringify(data.data.bundle, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `health-record-${selectedPatientId}-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ 
          title: "Export Complete", 
          description: `Exported ${data.data.resourceCounts.Patient ? Object.keys(data.data.resourceCounts).length : 0} resource types (${data.data.sizeBytes} bytes)` 
        });
        setExportDialogOpen(false);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to export FHIR bundle", variant: "destructive" });
    }
  });

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      toast({ title: "Copied", description: "Link copied to clipboard" });
    } catch {
      toast({ title: "Error", description: "Failed to copy link", variant: "destructive" });
    }
  };

  const toggleSection = (section: string) => {
    setShareSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const timeline = journeyData?.data;

  const TrendIcon = ({ trend }: { trend?: string }) => {
    if (trend === "improving") return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === "declining") return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "lab": return <Activity className="w-4 h-4" />;
      case "medication": return <Pill className="w-4 h-4" />;
      case "clinical": return <Stethoscope className="w-4 h-4" />;
      case "vital": return <Heart className="w-4 h-4" />;
      case "immunization": return <Syringe className="w-4 h-4" />;
      case "procedure": return <FileText className="w-4 h-4" />;
      case "condition": return <AlertCircle className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "warning": return "secondary";
      default: return "outline";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <span>Failed to load medical journey data</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-medical-journey">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Longitudinal Medical Journey
          </h1>
          <p className="text-muted-foreground">
            Your unified health timeline with normalized data from all sources
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32" data-testid="select-time-range">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6m">6 Months</SelectItem>
              <SelectItem value="1y">1 Year</SelectItem>
              <SelectItem value="2y">2 Years</SelectItem>
              <SelectItem value="5y">5 Years</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          
          <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-share-link">
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Link className="w-5 h-5" />
                  Smart Health Link
                </DialogTitle>
                <DialogDescription>
                  Create a secure, time-limited link to share your health summary with a specialist.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="medical-journey-recipient-email-optional">Recipient Email (optional)</Label>
                  <Input id="medical-journey-recipient-email-optional"
                    placeholder="doctor@hospital.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    data-testid="input-recipient-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medical-journey-purpose">Purpose</Label>
                  <Input id="medical-journey-purpose"
                    placeholder="e.g., Cardiology consultation"
                    value={sharePurpose}
                    onChange={(e) => setSharePurpose(e.target.value)}
                    data-testid="input-share-purpose"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medical-journey-link-expiration">Link Expiration</Label>
                  <Select value={shareExpiration} onValueChange={setShareExpiration}>
                    <SelectTrigger id="medical-journey-link-expiration" data-testid="select-expiration">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="6">6 hours</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="48">48 hours</SelectItem>
                      <SelectItem value="72">3 days</SelectItem>
                      <SelectItem value="168">1 week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <FieldCaption>Include Sections</FieldCaption>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "summary", label: "AI Summary" },
                      { id: "vitals", label: "Vital Signs" },
                      { id: "medications", label: "Medications" },
                      { id: "conditions", label: "Conditions" },
                      { id: "timeline", label: "Timeline" },
                      { id: "landmarks", label: "Landmarks" }
                    ].map(section => (
                      <div key={section.id} className="flex items-center space-x-2">
                        <Checkbox aria-label="Include Sections"
                          id={section.id}
                          checked={shareSections.includes(section.id)}
                          onCheckedChange={() => toggleSection(section.id)}
                        />
                        <label htmlFor={section.id} className="text-sm">{section.label}</label>
                      </div>
                    ))}
                  </div>
                </div>
                {shareLink && (
                  <div className="space-y-2 p-3 bg-muted rounded-md">
                    <Label htmlFor="medical-journey-share-link">Share Link</Label>
                    <div className="flex gap-2">
                      <Input id="medical-journey-share-link" value={shareLink} readOnly className="text-xs" data-testid="input-share-link" />
                      <Button size="sm" variant="outline" onClick={copyToClipboard} data-testid="button-copy-link">
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This link will expire in {shareExpiration} hours and can be accessed up to 3 times.
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button 
                  onClick={() => createShareLinkMutation.mutate()} 
                  disabled={createShareLinkMutation.isPending || shareSections.length === 0}
                  data-testid="button-create-share-link"
                >
                  {createShareLinkMutation.isPending ? "Creating..." : "Generate Secure Link"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-export">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Export Health Record
                </DialogTitle>
                <DialogDescription>
                  Download a FHIR-compliant JSON bundle of your health data for portability.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <Card className="p-4 bg-muted/50">
                  <h4 className="font-medium mb-2">What's included:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Patient demographics and identifiers
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Vital signs and lab results (LOINC coded)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Medications (RxNorm coded)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Conditions (SNOMED CT coded)
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      Data provenance for audit trail
                    </li>
                  </ul>
                </Card>
                <p className="text-sm text-muted-foreground">
                  This FHIR R4 bundle follows US Core profiles and can be imported by any FHIR-enabled 
                  healthcare system in the country.
                </p>
              </div>
              <DialogFooter>
                <Button 
                  onClick={() => exportFHIRMutation.mutate()} 
                  disabled={exportFHIRMutation.isPending}
                  data-testid="button-download-fhir"
                >
                  {exportFHIRMutation.isPending ? "Generating..." : "Download FHIR Bundle"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={breakGlassDialogOpen} onOpenChange={setBreakGlassDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950" data-testid="button-break-glass">
                <Shield className="w-4 h-4 mr-2" />
                Break-Glass
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-orange-600">
                  <Shield className="w-5 h-5" />
                  Break-Glass Protocol
                </DialogTitle>
                <DialogDescription>
                  Emergency access protocol for authorized healthcare providers.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <Card className="p-4 bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-orange-800 dark:text-orange-200">Important Notice</h4>
                      <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                        This feature allows authorized providers to access your records in an emergency. 
                        When activated:
                      </p>
                      <ul className="text-sm text-orange-700 dark:text-orange-300 mt-2 space-y-1 list-disc list-inside">
                        <li>You will receive an immediate SMS and email alert</li>
                        <li>A permanent audit log entry will be created</li>
                        <li>Access expires after 4 hours</li>
                        <li>You can revoke access at any time</li>
                      </ul>
                    </div>
                  </div>
                </Card>
                <p className="text-sm text-muted-foreground">
                  This protocol is designed for life-threatening emergencies when your medical history 
                  is needed urgently and you cannot provide authorization.
                </p>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => setBreakGlassDialogOpen(false)}>
                  Close
                </Button>
                <Button 
                  variant="outline" 
                  className="border-orange-500 text-orange-600"
                  onClick={() => {
                    toast({ 
                      title: "Break-Glass Protocol", 
                      description: "Providers can initiate break-glass access through their portal using their NPI credentials." 
                    });
                  }}
                  data-testid="button-view-break-glass-history"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Access History
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-3/4" />
              <Skeleton className="h-12 w-1/2" />
            </div>
          </CardContent>
        </Card>
      ) : timeline ? (
        <>
          <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" data-testid="card-summary">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  AI Health Summary
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => regenerateMutation.mutate()}
                  disabled={regenerateMutation.isPending}
                  data-testid="button-regenerate-summary"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${regenerateMutation.isPending ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-lg mb-4" data-testid="text-status-update">
                {timeline.summary.statusUpdate}
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Key Insights</h4>
                  <ul className="space-y-1">
                    {timeline.summary.keyInsights.slice(0, 3).map((insight, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Health Trends</h4>
                  <ul className="space-y-1">
                    {timeline.summary.healthTrends.slice(0, 3).map((trend, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <TrendIcon trend={trend.trend} />
                        <span>{trend.metric}: {trend.details}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Last Checkup</h4>
                  {timeline.summary.lastCheckup ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {formatDate(timeline.summary.lastCheckup.date)}
                        {timeline.summary.lastCheckup.provider && ` with ${timeline.summary.lastCheckup.provider}`}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">No recent checkups</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview" data-testid="tab-overview">Timeline</TabsTrigger>
              <TabsTrigger value="lanes" data-testid="tab-lanes">Lanes</TabsTrigger>
              <TabsTrigger value="vitals" data-testid="tab-vitals">Vitals</TabsTrigger>
              <TabsTrigger value="medications" data-testid="tab-medications">Medications</TabsTrigger>
              <TabsTrigger value="conditions" data-testid="tab-conditions">Conditions</TabsTrigger>
              <TabsTrigger value="landmarks" data-testid="tab-landmarks">Landmarks</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Health Timeline</CardTitle>
                  <CardDescription>
                    All clinical events, labs, medications, and vitals in chronological order
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                    <div className="space-y-4">
                      {timeline.events.slice().reverse().slice(0, 20).map((event) => (
                        <div key={event.id} className="relative pl-10" data-testid={`event-${event.id}`}>
                          <div className="absolute left-2 w-5 h-5 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                            {getEventIcon(event.type)}
                          </div>
                          <div className="flex flex-wrap items-start justify-between gap-2 p-3 rounded-lg border hover-elevate">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{event.title}</span>
                                <Badge variant={getSeverityColor(event.severity)}>
                                  {event.category}
                                </Badge>
                                {event.codeSystem && (
                                  <Badge variant="outline" className="text-xs">
                                    {event.codeSystem}: {event.normalizedCode}
                                  </Badge>
                                )}
                              </div>
                              {event.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {event.description}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                Source: {event.source}
                              </p>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatDate(event.date)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lanes" className="mt-4">
              <LanesOfCare 
                vitals={timeline.vitalsTracking}
                medications={timeline.medicationAdherence}
                encounters={timeline.encounters || []}
                timeRange={timeline.timeRange}
              />
            </TabsContent>

            <TabsContent value="vitals" className="mt-4">
              <div className="grid md:grid-cols-2 gap-4">
                {timeline.vitalsTracking.map((vital) => (
                  <Card key={vital.loincCode} data-testid={`vital-${vital.loincCode}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Heart className="w-5 h-5 text-primary" />
                          {vital.displayName}
                        </CardTitle>
                        <TrendIcon trend={vital.trend} />
                      </div>
                      <CardDescription>LOINC: {vital.loincCode}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-baseline gap-2 mb-4">
                        <span className="text-3xl font-bold">
                          {vital.currentValue?.toFixed(vital.loincCode === "4548-4" ? 1 : 0)}
                        </span>
                        <span className="text-muted-foreground">
                          {vital.dataPoints[0]?.unit}
                        </span>
                        {vital.normalRange && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (Normal: {vital.normalRange.low}-{vital.normalRange.high})
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Recent Readings</h4>
                        <div className="flex flex-wrap gap-2">
                          {vital.dataPoints.slice(-6).map((dp, i) => (
                            <div 
                              key={i} 
                              className={`px-2 py-1 rounded text-xs ${
                                dp.status === "critical" ? "bg-destructive/20 text-destructive" :
                                dp.status === "high" || dp.status === "low" ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400" :
                                "bg-muted"
                              }`}
                            >
                              {dp.value.toFixed(vital.loincCode === "4548-4" ? 1 : 0)} ({formatDate(dp.date).slice(0, 6)})
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="medications" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Medication History</CardTitle>
                  <CardDescription>
                    Normalized medication timeline using RxNorm codes - "Tylenol" and "Acetaminophen" are unified
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {timeline.medicationAdherence.map((med) => (
                      <div 
                        key={med.rxcui} 
                        className="flex flex-wrap items-start justify-between gap-4 p-4 rounded-lg border hover-elevate"
                        data-testid={`medication-${med.rxcui}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${med.isActive ? "bg-green-500/20" : "bg-muted"}`}>
                            <Pill className={`w-5 h-5 ${med.isActive ? "text-green-500" : "text-muted-foreground"}`} />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{med.displayName}</span>
                              <Badge variant={med.isActive ? "default" : "secondary"}>
                                {med.isActive ? "Active" : "Completed"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Generic: {med.genericName} | Class: {med.drugClass}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              RxNorm: {med.rxcui}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {med.periods.map((period, i) => (
                            <div key={i} className="text-sm">
                              <p>
                                {formatDate(period.startDate)}
                                {period.endDate && ` - ${formatDate(period.endDate)}`}
                              </p>
                              {period.dosage && (
                                <p className="text-muted-foreground">
                                  {period.dosage} {period.frequency}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="conditions" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Health Conditions</CardTitle>
                  <CardDescription>
                    Active and historical conditions normalized using SNOMED CT
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {timeline.conditions.map((condition) => (
                      <div 
                        key={condition.snomedCode}
                        className="flex flex-wrap items-start justify-between gap-4 p-4 rounded-lg border hover-elevate"
                        data-testid={`condition-${condition.snomedCode}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-full ${condition.isActive ? "bg-yellow-500/20" : "bg-muted"}`}>
                            <AlertTriangle className={`w-5 h-5 ${condition.isActive ? "text-yellow-500" : "text-muted-foreground"}`} />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{condition.displayName}</span>
                              <Badge variant={condition.isActive ? "secondary" : "outline"}>
                                {condition.clinicalStatus}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Category: {condition.category}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              SNOMED CT: {condition.snomedCode} | Source: {condition.source}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {condition.onsetDate && `Since ${formatDate(condition.onsetDate)}`}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="landmarks" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Key Health Landmarks</CardTitle>
                  <CardDescription>
                    Significant events in your health journey
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-primary/30" />
                    <div className="space-y-6">
                      {timeline.landmarks.map((landmark) => (
                        <div key={landmark.id} className="relative pl-10" data-testid={`landmark-${landmark.id}`}>
                          <div className={`absolute left-1 w-7 h-7 rounded-full flex items-center justify-center ${
                            landmark.significance === "high" ? "bg-primary text-primary-foreground" :
                            landmark.significance === "medium" ? "bg-secondary" : "bg-muted"
                          }`}>
                            {landmark.type === "diagnosis" && <Stethoscope className="w-4 h-4" />}
                            {landmark.type === "treatment_start" && <Pill className="w-4 h-4" />}
                            {landmark.type === "er_visit" && <AlertCircle className="w-4 h-4" />}
                            {landmark.type === "surgery" && <Activity className="w-4 h-4" />}
                            {!["diagnosis", "treatment_start", "er_visit", "surgery"].includes(landmark.type) && 
                              <ChevronRight className="w-4 h-4" />}
                          </div>
                          <div className="p-4 rounded-lg border bg-card hover-elevate">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <h4 className="font-medium">{landmark.title}</h4>
                              <span className="text-sm text-muted-foreground">
                                {formatDate(landmark.date)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {landmark.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground text-center">
                <strong>NO-CDS Disclaimer:</strong> This longitudinal health summary is for informational purposes only and is NOT intended as clinical decision support. 
                Data is normalized from multiple sources using LOINC, RxNorm, and SNOMED CT terminology standards. 
                Always consult your healthcare provider for medical advice and treatment decisions.
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
