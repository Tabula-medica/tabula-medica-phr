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
import { Progress } from "@/components/ui/progress";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Activity,
  Pill,
  Calendar,
  Shield,
  Info,
  Copy,
  Check,
  Loader2,
  Clock,
  Heart,
  Thermometer,
  Droplets,
  Wind,
  Scale,
  FlaskConical,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileText,
  Stethoscope,
} from "lucide-react";

interface VitalTrendAnalysis {
  vitalType: string;
  displayName: string;
  unit: string;
  readings: { date: string; value: number; source: string }[];
  trend: 'improving' | 'worsening' | 'stable' | 'fluctuating';
  averageValue: number;
  minValue: number;
  maxValue: number;
  recommendation: string;
  clinicalSignificance: 'normal' | 'borderline' | 'concerning' | 'critical';
}

interface LabTrendAnalysis {
  labType: string;
  displayName: string;
  unit: string;
  results: { date: string; value: number; labId: string }[];
  trend: 'improving' | 'worsening' | 'stable' | 'fluctuating';
  averageValue: number;
  normalRange: { min: number; max: number };
  percentOutOfRange: number;
  recommendation: string;
  clinicalSignificance: 'normal' | 'borderline' | 'concerning' | 'critical';
}

interface MedicationAnalysis {
  medicationName: string;
  dosage: string;
  frequency: string;
  startDate: string;
  adherencePercentage: number;
  adherenceStatus: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  potentialInteractions: { medication: string; severity: string; description: string }[];
  nextRefillDate?: string;
  refillsRemaining?: number;
}

interface EpisodeOfCareSummary {
  episodeId: string;
  type: 'chronic' | 'acute' | 'preventive' | 'maternity' | 'mental_health' | 'surgical' | 'rehabilitation';
  title: string;
  status: 'active' | 'resolved' | 'ongoing';
  startDate: string;
  endDate?: string;
  summary: string;
  relatedResources: string[];
}

interface ProactiveHealthAlert {
  alertId: string;
  type: 'trend_warning' | 'gap_in_care' | 'medication_interaction' | 'preventive_care_due' | 'lifestyle_recommendation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendedAction: string;
  dueDate?: string;
  confidenceLevel: number;
}

interface EnhancedHealthSummary {
  patientId: string;
  generatedAt: string;
  healthScore: number;
  healthScoreTrend: 'improving' | 'declining' | 'stable';
  executiveSummary: string;
  detailedNarrative: string;
  specialistNotes: string;
  noCdsDisclaimer: string;
  vitalTrends: VitalTrendAnalysis[];
  labTrends: LabTrendAnalysis[];
  medicationAnalysis: MedicationAnalysis[];
  episodesOfCare: EpisodeOfCareSummary[];
  proactiveAlerts: ProactiveHealthAlert[];
}

interface EnhancedAIHealthSummaryProps {
  patientId: string;
}

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'improving':
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case 'worsening':
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    case 'stable':
      return <Minus className="h-4 w-4 text-blue-500" />;
    case 'fluctuating':
      return <Activity className="h-4 w-4 text-amber-500" />;
    default:
      return <Minus className="h-4 w-4 text-gray-500" />;
  }
};

const getSignificanceBadge = (significance: string) => {
  switch (significance) {
    case 'normal':
      return <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Normal</Badge>;
    case 'borderline':
      return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Borderline</Badge>;
    case 'concerning':
      return <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Concerning</Badge>;
    case 'critical':
      return <Badge variant="destructive">Critical</Badge>;
    default:
      return <Badge variant="secondary">Unknown</Badge>;
  }
};

const getAlertSeverityColor = (severity: string) => {
  switch (severity) {
    case 'critical':
      return 'border-l-red-500 bg-red-50 dark:bg-red-900/20';
    case 'high':
      return 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/20';
    case 'medium':
      return 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/20';
    case 'low':
      return 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/20';
    default:
      return 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/20';
  }
};

const getVitalIcon = (vitalType: string) => {
  const type = vitalType?.toLowerCase() || '';
  switch (type) {
    case 'blood_pressure':
    case 'heart_rate':
      return <Heart className="h-4 w-4" />;
    case 'temperature':
      return <Thermometer className="h-4 w-4" />;
    case 'oxygen_saturation':
      return <Droplets className="h-4 w-4" />;
    case 'respiratory_rate':
      return <Wind className="h-4 w-4" />;
    case 'weight':
    case 'bmi':
      return <Scale className="h-4 w-4" />;
    default:
      return <Activity className="h-4 w-4" />;
  }
};

const getEpisodeTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    chronic: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    acute: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    preventive: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    maternity: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    mental_health: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    surgical: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    rehabilitation: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  };
  return colors[type] || 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
};

export function EnhancedAIHealthSummary({ patientId }: EnhancedAIHealthSummaryProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set());

  const { data: summary, isLoading, error, refetch } = useQuery<EnhancedHealthSummary>({
    queryKey: ['/api/ai-health-journey-enhanced/summary', patientId],
    enabled: !!patientId,
    retry: 1,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/ai-health-journey-enhanced/summary/${patientId}`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/ai-health-journey-enhanced/summary', patientId], data);
      toast({
        title: "Summary Generated",
        description: "Your enhanced health summary has been created.",
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Could not generate health summary. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (error) {
    return (
      <Card className="border-destructive/20 bg-destructive/5" data-testid="enhanced-summary-error">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Enhanced AI Health Summary
          </CardTitle>
          <CardDescription>
            Unable to load health summary data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-4">There was an error loading your health summary. Please try again.</p>
            <Button
              onClick={() => refetch()}
              variant="outline"
              data-testid="btn-retry-enhanced-summary"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleCopy = async () => {
    if (!summary) return;
    try {
      const text = `
Health Summary for Patient ${summary.patientId || 'Unknown'}
Generated: ${summary.generatedAt ? new Date(summary.generatedAt).toLocaleString() : 'N/A'}
Health Score: ${summary.healthScore ?? 0}/100 (${summary.healthScoreTrend || 'N/A'})

${summary.executiveSummary || 'No summary available.'}

${summary.detailedNarrative || ''}

Notes for Specialist:
${summary.specialistNotes || 'None'}

${summary.noCdsDisclaimer || ''}
      `.trim();
      
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied to Clipboard",
        description: "Summary ready to share with your healthcare provider.",
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  const toggleAlert = (alertId: string) => {
    setExpandedAlerts(prev => {
      const next = new Set(prev);
      if (next.has(alertId)) {
        next.delete(alertId);
      } else {
        next.add(alertId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <Card data-testid="enhanced-summary-loading">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-6 w-48" />
          </div>
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card data-testid="enhanced-summary-empty">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Enhanced AI Health Journey Summary
          </CardTitle>
          <CardDescription>
            Get a comprehensive AI-powered analysis of your health journey
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">No health summary has been generated yet.</p>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="btn-generate-enhanced-summary"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Health Summary
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const safeVitalTrends = summary.vitalTrends || [];
  const safeLabTrends = summary.labTrends || [];
  const safeMedicationAnalysis = summary.medicationAnalysis || [];
  const safeEpisodesOfCare = summary.episodesOfCare || [];
  const safeProactiveAlerts = summary.proactiveAlerts || [];

  return (
    <Card data-testid="enhanced-summary-card">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Enhanced AI Health Journey Summary</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Generated {summary.generatedAt ? new Date(summary.generatedAt).toLocaleDateString() : 'N/A'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              data-testid="btn-copy-enhanced-summary"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="btn-regenerate-enhanced-summary"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="text-3xl font-bold">{summary.healthScore ?? 0}</div>
              <div>
                <p className="text-sm font-medium">Health Score</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {getTrendIcon(summary.healthScoreTrend || 'stable')}
                  <span className="capitalize">{summary.healthScoreTrend || 'stable'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {safeProactiveAlerts.filter(a => a.severity === 'critical' || a.severity === 'high').length > 0 && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {safeProactiveAlerts.filter(a => a.severity === 'critical' || a.severity === 'high').length} Priority Alerts
                </Badge>
              )}
            </div>
          </div>
          <Progress value={summary.healthScore ?? 0} className="h-3" />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="enhanced-summary-tabs">
          <TabsList className="grid grid-cols-5 mb-4">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="vitals" data-testid="tab-vitals">Vitals</TabsTrigger>
            <TabsTrigger value="labs" data-testid="tab-labs">Labs</TabsTrigger>
            <TabsTrigger value="medications" data-testid="tab-medications">Medications</TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4" data-testid="tab-content-overview">
            <div className="bg-muted/30 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Executive Summary
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{summary.executiveSummary || 'No summary available.'}</p>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Detailed Narrative
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{summary.detailedNarrative || 'No detailed narrative available.'}</p>
            </div>

            {safeEpisodesOfCare.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Episodes of Care
                  </h4>
                  <div className="grid gap-3">
                    {safeEpisodesOfCare.map((episode) => (
                      <div
                        key={episode.episodeId}
                        className="p-3 rounded-lg border bg-card"
                        data-testid={`episode-${episode.episodeId}`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <Badge className={getEpisodeTypeColor(episode.type || '')}>
                              {(episode.type || 'unknown').replace('_', ' ')}
                            </Badge>
                            <span className="font-medium text-sm">{episode.title || 'Untitled Episode'}</span>
                          </div>
                          <Badge variant={episode.status === 'active' ? 'default' : 'secondary'}>
                            {episode.status || 'unknown'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          {episode.startDate ? new Date(episode.startDate).toLocaleDateString() : 'N/A'} - {episode.endDate ? new Date(episode.endDate).toLocaleDateString() : 'Ongoing'}
                        </p>
                        <p className="text-sm text-muted-foreground">{episode.summary || ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Stethoscope className="h-4 w-4" />
                Notes for Specialist
              </h4>
              <p className="text-sm text-muted-foreground">{summary.specialistNotes || 'None'}</p>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {summary.noCdsDisclaimer || 'This information is for educational purposes only and should not replace professional medical advice.'}
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="vitals" className="space-y-4" data-testid="tab-content-vitals">
            <ScrollArea className="h-[400px] pr-4">
              <div className="grid gap-4">
                {safeVitalTrends.map((vital) => (
                  <Card key={vital.vitalType} className="p-4" data-testid={`vital-${vital.vitalType}`}>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          {getVitalIcon(vital.vitalType)}
                        </div>
                        <div>
                          <h5 className="font-medium text-sm">{vital.displayName || vital.vitalType}</h5>
                          <p className="text-xs text-muted-foreground">
                            Avg: {(vital.averageValue ?? 0).toFixed(1)} {vital.unit || ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSignificanceBadge(vital.clinicalSignificance || 'normal')}
                        {getTrendIcon(vital.trend || 'stable')}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                      <span>Min: {vital.minValue ?? 0} {vital.unit || ''}</span>
                      <span>Max: {vital.maxValue ?? 0} {vital.unit || ''}</span>
                      <span>{(vital.readings || []).length} readings</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{vital.recommendation || ''}</p>
                  </Card>
                ))}
                {safeVitalTrends.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No vital trend data available</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="labs" className="space-y-4" data-testid="tab-content-labs">
            <ScrollArea className="h-[400px] pr-4">
              <div className="grid gap-4">
                {safeLabTrends.map((lab) => (
                  <Card key={lab.labType} className="p-4" data-testid={`lab-${lab.labType}`}>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                          <FlaskConical className="h-4 w-4" />
                        </div>
                        <div>
                          <h5 className="font-medium text-sm">{lab.displayName || lab.labType}</h5>
                          <p className="text-xs text-muted-foreground">
                            Avg: {(lab.averageValue ?? 0).toFixed(1)} {lab.unit || ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSignificanceBadge(lab.clinicalSignificance || 'normal')}
                        {getTrendIcon(lab.trend || 'stable')}
                      </div>
                    </div>
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">
                          Normal range: {lab.normalRange?.min ?? 0} - {lab.normalRange?.max ?? 0} {lab.unit || ''}
                        </span>
                        <span className={(lab.percentOutOfRange ?? 0) > 20 ? "text-amber-600" : "text-muted-foreground"}>
                          {(lab.percentOutOfRange ?? 0).toFixed(0)}% out of range
                        </span>
                      </div>
                      <Progress value={100 - (lab.percentOutOfRange ?? 0)} className="h-2" />
                    </div>
                    <p className="text-sm text-muted-foreground">{lab.recommendation || ''}</p>
                  </Card>
                ))}
                {safeLabTrends.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No lab trend data available</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="medications" className="space-y-4" data-testid="tab-content-medications">
            <ScrollArea className="h-[400px] pr-4">
              <div className="grid gap-4">
                {safeMedicationAnalysis.map((med) => (
                  <Card key={med.medicationName} className="p-4" data-testid={`medication-${med.medicationName}`}>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                          <Pill className="h-4 w-4" />
                        </div>
                        <div>
                          <h5 className="font-medium text-sm">{med.medicationName || 'Unknown Medication'}</h5>
                          <p className="text-xs text-muted-foreground">
                            {med.dosage || ''} - {med.frequency || ''}
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        med.adherenceStatus === 'excellent' ? 'default' :
                        med.adherenceStatus === 'good' ? 'secondary' :
                        'destructive'
                      }>
                        {med.adherencePercentage ?? 0}% adherence
                      </Badge>
                    </div>
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Medication Adherence</span>
                        <span className={
                          med.adherenceStatus === 'excellent' || med.adherenceStatus === 'good' 
                            ? "text-green-600" 
                            : "text-amber-600"
                        }>
                          {(med.adherenceStatus || 'unknown').replace('_', ' ')}
                        </span>
                      </div>
                      <Progress value={med.adherencePercentage ?? 0} className="h-2" />
                    </div>
                    {(med.potentialInteractions || []).length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Potential Interactions
                        </p>
                        <div className="space-y-1">
                          {(med.potentialInteractions || []).map((interaction, idx) => (
                            <div key={idx} className="text-xs text-muted-foreground">
                              <span className="font-medium">{interaction.medication || ''}</span>
                              <Badge variant="outline" className="ml-2 text-[10px] px-1.5">
                                {interaction.severity || 'unknown'}
                              </Badge>
                              <p className="ml-2">{interaction.description || ''}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {med.nextRefillDate && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Next refill: {new Date(med.nextRefillDate).toLocaleDateString()} ({med.refillsRemaining ?? 0} remaining)
                      </p>
                    )}
                  </Card>
                ))}
                {safeMedicationAnalysis.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Pill className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No medication data available</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4" data-testid="tab-content-alerts">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {safeProactiveAlerts.map((alert) => (
                  <div
                    key={alert.alertId}
                    className={`p-4 rounded-lg border-l-4 ${getAlertSeverityColor(alert.severity || 'low')}`}
                    data-testid={`alert-${alert.alertId}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {alert.severity === 'critical' || alert.severity === 'high' ? (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                          ) : alert.severity === 'medium' ? (
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                          ) : (
                            <Info className="h-5 w-5 text-blue-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h5 className="font-medium text-sm">{alert.title || 'Alert'}</h5>
                            <Badge variant="outline" className="text-[10px]">
                              {(alert.type || 'unknown').replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{alert.description || ''}</p>
                          {expandedAlerts.has(alert.alertId) && (
                            <div className="mt-3 pt-3 border-t space-y-2">
                              <div>
                                <p className="text-xs font-medium text-foreground mb-1">Recommended Action:</p>
                                <p className="text-sm text-muted-foreground">{alert.recommendedAction || ''}</p>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Shield className="h-3 w-3" />
                                <span>Confidence: {((alert.confidenceLevel ?? 0) * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleAlert(alert.alertId)}
                        data-testid={`btn-toggle-alert-${alert.alertId}`}
                      >
                        {expandedAlerts.has(alert.alertId) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
                {safeProactiveAlerts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No proactive alerts at this time</p>
                    <p className="text-xs mt-1">We'll notify you if any health trends need attention</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
